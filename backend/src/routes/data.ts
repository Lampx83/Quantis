/**
 * GET/POST /data — datasets + workflows trong PostgreSQL (theo user hoặc global).
 * Embedded: X-User-Id (+ X-User-Email, X-User-Name) giống SurveyLab.
 */
import { Request, Response } from "express"
import { query, withTransaction, withSchema } from "../db.js"
import { AUTH_ENABLED, AUTH_REQUIRED } from "../env.js"

const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i

function isValidUuid(s: unknown): s is string {
  return typeof s === "string" && UUID_REGEX.test(s)
}

/** Portal gửi X-User-Id — ưu tiên trước session (ổn định khi embed load). */
function getUserId(req: Request): string | null {
  const headerId = (req.headers["x-user-id"] as string)?.trim()
  if (headerId && isValidUuid(headerId)) return headerId
  if (process.env.RUN_MODE !== "embedded") {
    const sess = (req.session as { userId?: string } | undefined)?.userId
    if (sess && isValidUuid(sess)) return sess
  }
  return null
}

async function ensureUserExistsBeforeTransaction(userId: string, req: Request): Promise<void> {
  if (!userId || !isValidUuid(userId)) return
  const existing = await query<{ n: number }>(
    withSchema(`SELECT 1 AS n FROM __SCHEMA__.users WHERE id = $1::uuid LIMIT 1`),
    [userId]
  )
  if ((existing?.rows?.length ?? 0) > 0) return
  const email = (req.headers["x-user-email"] as string)?.trim() || `user-${userId}@portal.local`
  const name = (req.headers["x-user-name"] as string)?.trim() || email
  await query(
    withSchema(
      `INSERT INTO __SCHEMA__.users (id, email, name, created_at)
       VALUES ($1::uuid, $2, $3, now())
       ON CONFLICT (id) DO UPDATE SET email = EXCLUDED.email, name = EXCLUDED.name`
    ),
    [userId, email, name || "User"]
  )
}

function mustHaveUserForEmbedded(userId: string | null, res: Response): userId is string {
  if (process.env.RUN_MODE !== "embedded") return true
  if (userId && isValidUuid(userId)) return true
  res.status(401).json({ error: "Thiếu X-User-Id (AI Portal)" })
  return false
}

export async function getData(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req)

    if (process.env.RUN_MODE !== "embedded" && AUTH_ENABLED && AUTH_REQUIRED && !userId) {
      res.status(401).json({ error: "Cần đăng nhập" })
      return
    }

    if (process.env.RUN_MODE === "embedded" && !mustHaveUserForEmbedded(userId, res)) return

    if (userId && isValidUuid(userId)) {
      const r = await query<{ datasets: unknown; workflows: unknown }>(
        withSchema(
          `SELECT datasets, workflows FROM __SCHEMA__.workspaces WHERE user_id = $1::uuid`
        ),
        [userId]
      )
      const row = r.rows[0]
      res.json({
        datasets: Array.isArray(row?.datasets) ? row.datasets : [],
        workflows: Array.isArray(row?.workflows) ? row.workflows : [],
      })
      return
    }

    const g = await query<{ datasets: unknown; workflows: unknown }>(
      withSchema(`SELECT datasets, workflows FROM __SCHEMA__.global_workspace WHERE id = 1`)
    )
    const row = g.rows[0]
    res.json({
      datasets: Array.isArray(row?.datasets) ? row.datasets : [],
      workflows: Array.isArray(row?.workflows) ? row.workflows : [],
    })
  } catch (err: unknown) {
    console.error("[quantis-api] getData:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}

const MAX_JSON_CHARS = 48_000_000

export async function postData(req: Request, res: Response): Promise<void> {
  try {
    const userId = getUserId(req)

    if (process.env.RUN_MODE !== "embedded" && AUTH_ENABLED && AUTH_REQUIRED && !userId) {
      res.status(401).json({ error: "Cần đăng nhập" })
      return
    }

    if (process.env.RUN_MODE === "embedded" && !mustHaveUserForEmbedded(userId, res)) return

    const body = req.body
    if (body == null || typeof body !== "object") {
      res.status(400).json({ error: "Body phải là object" })
      return
    }
    const datasets = Array.isArray(body.datasets) ? body.datasets : []
    const workflows = Array.isArray(body.workflows) ? body.workflows : []
    const payload = JSON.stringify({ datasets, workflows })
    if (payload.length > MAX_JSON_CHARS) {
      res.status(400).json({ error: "Payload quá lớn" })
      return
    }

    if (userId && isValidUuid(userId)) {
      await ensureUserExistsBeforeTransaction(userId, req)
      await withTransaction(async (client) => {
        await client.query(
          withSchema(
            `INSERT INTO __SCHEMA__.workspaces (user_id, datasets, workflows, updated_at)
             VALUES ($1::uuid, $2::jsonb, $3::jsonb, now())
             ON CONFLICT (user_id) DO UPDATE SET
               datasets = EXCLUDED.datasets,
               workflows = EXCLUDED.workflows,
               updated_at = now()`
          ),
          [userId, JSON.stringify(datasets), JSON.stringify(workflows)]
        )
      })
    } else {
      await withTransaction(async (client) => {
        await client.query(
          withSchema(
            `INSERT INTO __SCHEMA__.global_workspace (id, datasets, workflows, updated_at)
             VALUES (1, $1::jsonb, $2::jsonb, now())
             ON CONFLICT (id) DO UPDATE SET
               datasets = EXCLUDED.datasets,
               workflows = EXCLUDED.workflows,
               updated_at = now()`
          ),
          [JSON.stringify(datasets), JSON.stringify(workflows)]
        )
      })
    }

    res.json({ status: "ok" })
  } catch (err: unknown) {
    console.error("[quantis-api] postData:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}
