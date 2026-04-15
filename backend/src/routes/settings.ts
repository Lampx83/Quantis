import { Request, Response } from "express"
import { query, withSchema } from "../db.js"

type ServerSettings = {
  backendApiUrl?: string | null
  archiveUrl?: string | null
  archiveFileUrl?: string | null
  /** @deprecated Trình duyệt không còn gọi trực tiếp; dùng proxy /api/quantis/ollama */
  aiApiUrl?: string | null
  /** URL gốc Ollama mà Node proxy tới (vd. http://127.0.0.1:11434), dùng chung mọi tài khoản */
  ollamaUpstreamUrl?: string | null
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
      defaultAiModel: s.defaultAiModel ?? null,
    })
  } catch (err: unknown) {
    console.error("[quantis-api] getSettings:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function putSettings(req: Request, res: Response): Promise<void> {
  try {
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
    res.json({ status: "ok", settings: next })
  } catch (err: unknown) {
    console.error("[quantis-api] putSettings:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}
