import type { Request, Response } from "express"
import { Router } from "express"
import { Readable } from "node:stream"
import { query, withSchema } from "../db.js"

/** Chỉ dùng khi có đặt biến môi trường; không mặc định URL ngoài. Upstream chính: ollamaUpstreamUrl trong cài đặt (admin). */
const ENV_OLLAMA = String(process.env.OLLAMA_URL ?? "")
  .trim()
  .replace(/\/+$/, "")

/** Khóa bảo mật của gateway Ollama (Kong) — gửi kèm header `x-ollama-seckey`. */
const ENV_OLLAMA_SECKEY = String(process.env.OLLAMA_SECKEY ?? "").trim()

/**
 * Chuẩn hoá upstream LLM (vLLM): bỏ "/v1" đuôi; nếu base kết thúc bằng "/ollama" (cấu hình cũ) thì đổi thành "/vllm".
 * Tên cấu hình (ollamaUpstreamUrl / OLLAMA_URL) giữ nguyên để không phải sửa tay.
 */
function normalizeUpstream(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/v1$/i, "")
    .replace(/\/ollama$/i, "/vllm")
}

const DEFAULT_LLM_MODEL = "qwen3.5-35b-a3b-int4"

/** Tên model kiểu Ollama ("a:b" hoặc "qwen2.5…") → model vLLM mặc định. */
function normalizeLlmModel(model: unknown): string {
  const m = String(model ?? "").trim()
  if (!m) return DEFAULT_LLM_MODEL
  if (m.includes(":") || /^qwen2\.5/i.test(m) || /^llama3/i.test(m)) return DEFAULT_LLM_MODEL
  return m
}

/** Bỏ khối <think>…</think> (nếu lọt vào nội dung). */
function stripThinkBlocks(s: string): string {
  return String(s || "")
    .replace(/<think>[\s\S]*?<\/think>/gi, "")
    .replace(/^[\s\S]*?<\/think>/i, "")
    .replace(/<think>[\s\S]*$/i, "")
    .trim()
}

type OllamaUpstreamConfig = { upstream: string; seckey: string }

async function resolveOllamaConfig(): Promise<OllamaUpstreamConfig> {
  let upstream = ""
  let seckey = ""
  try {
    const r = await query<{ settings: unknown }>(
      withSchema(`SELECT settings FROM __SCHEMA__.app_settings WHERE id = 1`)
    )
    const row = r.rows[0]
    const s = (row?.settings as Record<string, unknown>) || {}
    if (s.ollamaUpstreamUrl != null) upstream = String(s.ollamaUpstreamUrl).trim()
    if (s.ollamaSeckey != null) seckey = String(s.ollamaSeckey).trim()
  } catch {
    /* bảng chưa sẵn sàng hoặc lỗi DB */
  }
  return {
    upstream: normalizeUpstream(upstream || ENV_OLLAMA),
    seckey: seckey || ENV_OLLAMA_SECKEY,
  }
}

/**
 * Proxy LLM: giữ nguyên đường dẫn frontend đang dùng (/ollama/*) nhưng upstream là vLLM (OpenAI-compatible).
 *  - POST /v1/chat/completions -> chuyển tiếp; chuẩn hoá model, mặc định chat_template_kwargs.enable_thinking=false;
 *    lọc <think>…</think> khỏi nội dung (không stream); stream SSE được pipe nguyên.
 *  - GET /v1/models            -> chuyển tiếp.
 *  - GET /api/tags (cũ)        -> ánh xạ sang /v1/models, trả {models:[{name}]} (+ data) cho client cũ.
 *  - /api/embed*, /api/embeddings, /v1/embeddings -> vẫn Ollama (cùng gateway, đổi "/vllm" -> "/ollama").
 */
export function createOllamaProxyRouter(): Router {
  const r = Router({ mergeParams: true })

  r.use(async (req: Request, res: Response) => {
    let cfg: OllamaUpstreamConfig
    try {
      cfg = await resolveOllamaConfig()
    } catch (e) {
      console.error("[quantis-api] llm upstream:", e)
      res.status(503).json({ error: "Cannot resolve LLM upstream" })
      return
    }
    const llmUpstream = cfg.upstream
    if (!llmUpstream) {
      res.status(503).json({
        error: "LLM upstream not configured",
        detail: "Set ollamaUpstreamUrl in Quantis admin (Cấu hình kết nối) or OLLAMA_URL on the server.",
      })
      return
    }

    const pathAndQuery = req.url.startsWith("/") ? req.url : `/${req.url}`
    const qIdx = pathAndQuery.indexOf("?")
    const pathname = (qIdx >= 0 ? pathAndQuery.slice(0, qIdx) : pathAndQuery).replace(/\/+$/, "")
    const search = qIdx >= 0 ? pathAndQuery.slice(qIdx) : ""
    const isEmbedding = /^\/(api\/embed(dings)?|v1\/embeddings)$/i.test(pathname)
    const isTagsLegacy = req.method === "GET" && /^\/api\/tags$/i.test(pathname)
    const isChat = req.method === "POST" && /^\/v1\/chat\/completions$/i.test(pathname)
    const upstream = isEmbedding ? llmUpstream.replace(/\/vllm$/i, "/ollama") : llmUpstream
    const targetUrl = `${upstream}${isTagsLegacy ? "/v1/models" : pathname}${search}`
    let host: string
    try {
      host = new URL(upstream).host
    } catch {
      res.status(500).json({ error: "Invalid ollamaUpstreamUrl in settings" })
      return
    }

    const headers = { ...req.headers, host } as Record<string, string | string[] | undefined>
    delete headers.origin
    delete headers.referer
    delete headers.cookie
    // Body được serialize lại bên dưới nên độ dài cũ không còn đúng.
    delete headers["content-length"]
    delete headers["accept-encoding"]
    delete headers["x-ollama-seckey"]
    if (cfg.seckey) headers["x-ollama-seckey"] = cfg.seckey

    let wantsStream = false
    try {
      const opt: RequestInit = { method: req.method, headers: headers as HeadersInit, redirect: "follow" }
      if (req.method !== "GET" && req.method !== "HEAD") {
        if (req.body != null && typeof req.body === "object" && !Buffer.isBuffer(req.body) && !Array.isArray(req.body)) {
          const body: Record<string, unknown> = { ...(req.body as Record<string, unknown>) }
          if (isChat) {
            body.model = normalizeLlmModel(body.model)
            body.chat_template_kwargs = {
              enable_thinking: false,
              ...((body.chat_template_kwargs as Record<string, unknown> | undefined) ?? {}),
            }
            wantsStream = body.stream === true
          }
          opt.body = JSON.stringify(body)
          const h = opt.headers as Record<string, string>
          if (!h["content-type"]) h["content-type"] = "application/json"
        } else if (Buffer.isBuffer(req.body)) {
          opt.body = new Uint8Array(req.body)
        }
      }
      const proxyRes = await fetch(targetUrl, opt)
      const contentType = proxyRes.headers.get("content-type") || ""
      res.status(proxyRes.status)
      proxyRes.headers.forEach((v, k) => {
        const lower = k.toLowerCase()
        if (lower === "transfer-encoding" || lower === "connection") return
        if (lower === "content-length" || lower === "content-encoding") return
        if (lower.startsWith("access-control-")) return
        res.setHeader(k, v)
      })
      if (wantsStream && proxyRes.ok && proxyRes.body && contentType.includes("text/event-stream")) {
        const stream = Readable.fromWeb(proxyRes.body as unknown as import("node:stream/web").ReadableStream)
        stream.on("error", () => res.end())
        req.on("close", () => stream.destroy())
        stream.pipe(res)
        return
      }
      if (contentType.includes("application/json")) {
        const data = (await proxyRes.json()) as Record<string, unknown>
        if (proxyRes.ok && isTagsLegacy && Array.isArray(data?.data)) {
          const list = data.data as Array<{ id?: string }>
          res.json({ models: list.map((m) => ({ name: m.id, model: m.id })), data: list })
          return
        }
        if (proxyRes.ok && isChat && Array.isArray(data?.choices)) {
          for (const c of data.choices as Array<{ message?: { content?: unknown } }>) {
            if (c?.message && typeof c.message.content === "string") c.message.content = stripThinkBlocks(c.message.content)
          }
        }
        res.json(data)
        return
      }
      const buf = Buffer.from(await proxyRes.arrayBuffer())
      res.send(buf)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error("[quantis-api] LLM proxy:", msg)
      if (res.headersSent) {
        res.end()
        return
      }
      res.status(502).json({ error: "LLM proxy failed", detail: msg })
    }
  })

  return r
}
