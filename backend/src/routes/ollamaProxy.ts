import type { Request, Response } from "express"
import { Router } from "express"
import { query, withSchema } from "../db.js"

/** Chỉ dùng khi có đặt biến môi trường; không mặc định URL ngoài. Upstream chính: ollamaUpstreamUrl trong cài đặt (admin). */
const ENV_OLLAMA = String(process.env.OLLAMA_URL ?? "")
  .trim()
  .replace(/\/+$/, "")

function normalizeUpstream(raw: string): string {
  return String(raw || "")
    .trim()
    .replace(/\/+$/, "")
    .replace(/\/v1$/i, "")
}

async function resolveOllamaUpstream(): Promise<string> {
  try {
    const r = await query<{ settings: unknown }>(
      withSchema(`SELECT settings FROM __SCHEMA__.app_settings WHERE id = 1`)
    )
    const row = r.rows[0]
    const s = (row?.settings as Record<string, unknown>) || {}
    const u = s.ollamaUpstreamUrl != null ? String(s.ollamaUpstreamUrl).trim() : ""
    if (u) return normalizeUpstream(u)
  } catch {
    /* bảng chưa sẵn sàng hoặc lỗi DB */
  }
  return normalizeUpstream(ENV_OLLAMA)
}

export function createOllamaProxyRouter(): Router {
  const r = Router({ mergeParams: true })

  r.use(async (req: Request, res: Response) => {
    let upstream: string
    try {
      upstream = await resolveOllamaUpstream()
    } catch (e) {
      console.error("[quantis-api] ollama upstream:", e)
      res.status(503).json({ error: "Cannot resolve Ollama upstream" })
      return
    }
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
