import type { Request, Response } from "express"
import { Router } from "express"
import { query, withSchema } from "../db.js"

/** Chỉ dùng khi có đặt biến môi trường; không mặc định URL ngoài. Upstream chính: ollamaUpstreamUrl trong cài đặt (admin). */
const ENV_OLLAMA = String(process.env.OLLAMA_URL ?? "")
  .trim()
  .replace(/\/+$/, "")

/** Khóa bảo mật của gateway Ollama (Kong) — gửi kèm header `x-ollama-seckey`. */
const ENV_OLLAMA_SECKEY = String(process.env.OLLAMA_SECKEY ?? "").trim()

function normalizeUpstream(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/v1$/i, "")
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

export function createOllamaProxyRouter(): Router {
  const r = Router({ mergeParams: true })

  r.use(async (req: Request, res: Response) => {
    let cfg: OllamaUpstreamConfig
    try {
      cfg = await resolveOllamaConfig()
    } catch (e) {
      console.error("[quantis-api] ollama upstream:", e)
      res.status(503).json({ error: "Cannot resolve Ollama upstream" })
      return
    }
    const upstream = cfg.upstream
    if (!upstream) {
      res.status(503).json({
        error: "Ollama upstream not configured",
        detail: "Set ollamaUpstreamUrl in Quantis admin (Cấu hình kết nối) or OLLAMA_URL on the server.",
      })
      return
    }

    const pathAndQuery = req.url.startsWith("/") ? req.url : `/${req.url}`
    const targetUrl = `${upstream}${pathAndQuery}`
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
    delete headers["x-ollama-seckey"]
    if (cfg.seckey) headers["x-ollama-seckey"] = cfg.seckey

    try {
      const opt: RequestInit = { method: req.method, headers: headers as HeadersInit, redirect: "follow" }
      if (req.method !== "GET" && req.method !== "HEAD") {
        if (req.body != null && typeof req.body === "object" && !Buffer.isBuffer(req.body) && !Array.isArray(req.body)) {
          opt.body = JSON.stringify(req.body)
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
        if (lower.startsWith("access-control-")) return
        res.setHeader(k, v)
      })
      if (contentType.includes("application/json")) {
        res.json(await proxyRes.json())
        return
      }
      const buf = Buffer.from(await proxyRes.arrayBuffer())
      res.send(buf)
    } catch (e) {
      const msg = e instanceof Error ? e.message : String(e)
      console.error("[quantis-api] Ollama proxy:", msg)
      res.status(502).json({ error: "Ollama proxy failed", detail: msg })
    }
  })

  return r
}
