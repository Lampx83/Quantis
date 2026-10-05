import { Request, Response } from "express"
import { query, withSchema } from "../db.js"

/** AI Portal proxy đặt X-User-Is-Admin server-side (không client nào spoof được) — cùng gate với PaperFinder embed.mjs. */
function isAdminRequest(req: Request): boolean {
  return req.headers["x-user-is-admin"] === "1"
}

type ServerSettings = {
  backendApiUrl?: string | null
  archiveUrl?: string | null
  archiveFileUrl?: string | null
  /** @deprecated Trình duyệt không còn gọi trực tiếp; dùng proxy /api/quantis/ollama */
  aiApiUrl?: string | null
  /** URL gốc Ollama mà Node proxy tới (vd. http://127.0.0.1:11434), dùng chung mọi tài khoản */
  ollamaUpstreamUrl?: string | null
  /** Khóa bảo mật gateway Ollama (header `x-ollama-seckey`). Chỉ ghi, không trả về khi GET. */
  ollamaSeckey?: string | null
  defaultAiModel?: string | null
}

export async function getSettings(_req: Request, res: Response): Promise<void> {
  try {
    const r = await query<{ settings: unknown }>(
      withSchema(`SELECT settings FROM __SCHEMA__.app_settings WHERE id = 1`)
    )
    const row = r.rows[0]
    const s = (row?.settings as Record<string, unknown>) || {}
    res.json({
      backendApiUrl: s.backendApiUrl ?? null,
      archiveUrl: s.archiveUrl ?? null,
      archiveFileUrl: s.archiveFileUrl ?? null,
      aiApiUrl: s.aiApiUrl ?? null,
      ollamaUpstreamUrl: s.ollamaUpstreamUrl ?? null,
      ollamaSeckeySet: String(s.ollamaSeckey ?? "").trim() !== "",
      defaultAiModel: s.defaultAiModel ?? null,
    })
  } catch (err: unknown) {
    console.error("[quantis-api] getSettings:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function putSettings(req: Request, res: Response): Promise<void> {
  try {
    /**
     * BUG đã vá: trước đây route này không kiểm tra quyền — bất kỳ user embedded nào đăng nhập
     * cũng ghi đè được cấu hình dùng chung (kể cả ollamaSeckey). Chỉ áp dụng gate khi RUN_MODE=embedded
     * (Portal proxy luôn set X-User-Is-Admin server-side, không client nào spoof được — xem
     * routes/sample-datasets.ts / PaperFinder backend/embed.mjs isAdminRequest()); standalone
     * (self-hosted, không qua Portal) không có header này nên giữ nguyên hành vi cũ để không phá vỡ triển khai đơn lẻ.
     */
    if (process.env.RUN_MODE === "embedded" && !isAdminRequest(req)) {
      res.status(403).json({ error: "Chỉ quản trị viên mới có quyền thay đổi cấu hình dùng chung." })
      return
    }
    const body = req.body as ServerSettings | null
    const currentR = await query<{ settings: unknown }>(
      withSchema(`SELECT settings FROM __SCHEMA__.app_settings WHERE id = 1`)
    )
    const cur = (currentR.rows[0]?.settings as Record<string, unknown>) || {}
    const next: Record<string, unknown> = { ...cur }
    if (body && typeof body === "object") {
      if (body.backendApiUrl !== undefined) next.backendApiUrl = body.backendApiUrl
      if (body.archiveUrl !== undefined) next.archiveUrl = body.archiveUrl
      if (body.archiveFileUrl !== undefined) next.archiveFileUrl = body.archiveFileUrl
      if (body.aiApiUrl !== undefined) next.aiApiUrl = body.aiApiUrl
      if (body.ollamaUpstreamUrl !== undefined) next.ollamaUpstreamUrl = body.ollamaUpstreamUrl
      if (body.ollamaSeckey !== undefined) {
        const key = body.ollamaSeckey == null ? "" : String(body.ollamaSeckey).trim()
        if (key) next.ollamaSeckey = key
        else delete next.ollamaSeckey
      }
      if (body.defaultAiModel !== undefined) next.defaultAiModel = body.defaultAiModel
    }
    await query(
      withSchema(
        `INSERT INTO __SCHEMA__.app_settings (id, settings, updated_at)
         VALUES (1, $1::jsonb, now())
         ON CONFLICT (id) DO UPDATE SET settings = EXCLUDED.settings, updated_at = now()`
      ),
      [JSON.stringify(next)]
    )
    const { ollamaSeckey, ...safe } = next
    res.json({ status: "ok", settings: { ...safe, ollamaSeckeySet: String(ollamaSeckey ?? "").trim() !== "" } })
  } catch (err: unknown) {
    console.error("[quantis-api] putSettings:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}
