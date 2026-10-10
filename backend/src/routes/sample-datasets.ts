/**
 * GET/POST/PUT/DELETE /sample-datasets — admin-curated sample datasets, browsable/importable by every user.
 * List (GET /sample-datasets) is public and light (no row data). Detail (GET /sample-datasets/:id) is public,
 * full row data. Write routes (POST/PUT/DELETE) require admin: AI Portal's own proxy sets X-User-Is-Admin
 * server-side (unconditionally, not client-spoofable) before forwarding the request — same gate as PaperFinder's
 * backend/embed.mjs isAdminRequest()/requireAdmin().
 */
import { Request, Response } from "express"
import { query, withSchema } from "../db.js"

function isAdminRequest(req: Request): boolean {
  return req.headers["x-user-is-admin"] === "1"
}

function requireAdmin(req: Request, res: Response): boolean {
  if (!isAdminRequest(req)) {
    res.status(403).json({ error: "Chỉ quản trị viên mới có quyền thực hiện thao tác này." })
    return false
  }
  return true
}

interface SampleDatasetRow {
  id: string
  name: string
  domain: string | null
  description: string | null
  tags: string[] | null
  header: string[] | null
  rows_data: string[][] | null
  display_order: number
  created_at: string
  updated_at: string
}

function toListItem(r: SampleDatasetRow) {
  const header = Array.isArray(r.header) ? r.header : []
  const rows = Array.isArray(r.rows_data) ? r.rows_data : []
  return {
    id: r.id,
    name: r.name,
    domain: r.domain ?? "",
    description: r.description ?? "",
    tags: Array.isArray(r.tags) ? r.tags : [],
    rows: rows.length,
    columns: header.length,
    displayOrder: r.display_order,
  }
}

function toFullItem(r: SampleDatasetRow) {
  const header = Array.isArray(r.header) ? r.header : []
  const rows = Array.isArray(r.rows_data) ? r.rows_data : []
  return {
    id: r.id,
    name: r.name,
    domain: r.domain ?? "",
    description: r.description ?? "",
    tags: Array.isArray(r.tags) ? r.tags : [],
    header,
    rows,
    /** [header, ...rows] — cùng hình dạng với SampleDatasetDef.getData() cũ để frontend dùng lại được. */
    data: [header, ...rows],
    rowsCount: rows.length,
    columnsCount: header.length,
    displayOrder: r.display_order,
    createdAt: r.created_at,
    updatedAt: r.updated_at,
  }
}

const SELECT_COLUMNS = "id, name, domain, description, tags, header, rows_data, display_order, created_at, updated_at"

export async function listSampleDatasets(_req: Request, res: Response): Promise<void> {
  try {
    const r = await query<SampleDatasetRow>(
      withSchema(`SELECT ${SELECT_COLUMNS} FROM __SCHEMA__.sample_datasets ORDER BY display_order ASC, created_at ASC`)
    )
    res.json({ datasets: r.rows.map(toListItem) })
  } catch (err: unknown) {
    console.error("[quantis-api] listSampleDatasets:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function getSampleDataset(req: Request, res: Response): Promise<void> {
  try {
    const id = String(req.params.id || "").trim()
    if (!id) {
      res.status(400).json({ error: "Thiếu id" })
      return
    }
    const r = await query<SampleDatasetRow>(
      withSchema(`SELECT ${SELECT_COLUMNS} FROM __SCHEMA__.sample_datasets WHERE id = $1`),
      [id]
    )
    const row = r.rows[0]
    if (!row) {
      res.status(404).json({ error: "Không tìm thấy bộ dữ liệu mẫu" })
      return
    }
    res.json(toFullItem(row))
  } catch (err: unknown) {
    console.error("[quantis-api] getSampleDataset:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}

const ID_REGEX = /^[a-z0-9][a-z0-9-]{1,63}$/i

function slugify(input: string): string {
  return String(input)
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/đ/g, "d")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 64)
}

interface SampleDatasetWriteBody {
  id?: string
  name?: string
  domain?: string | null
  description?: string | null
  tags?: string[] | null
  header?: string[] | null
  rows?: string[][] | null
  displayOrder?: number | null
}

function normalizeRows(rows: unknown): string[][] | null {
  if (!Array.isArray(rows)) return null
  for (const row of rows) {
    if (!Array.isArray(row)) return null
  }
  return (rows as unknown[][]).map((row) => row.map((cell) => (cell == null ? "" : String(cell))))
}

function normalizeStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return []
  return v.map((x) => String(x ?? "").trim()).filter(Boolean)
}

export async function createSampleDataset(req: Request, res: Response): Promise<void> {
  if (!requireAdmin(req, res)) return
  try {
    const body = req.body as SampleDatasetWriteBody
    const name = typeof body?.name === "string" ? body.name.trim() : ""
    if (!name) {
      res.status(400).json({ error: "Thiếu tên bộ dữ liệu" })
      return
    }
    const header = normalizeStringArray(body?.header)
    if (header.length === 0) {
      res.status(400).json({ error: "Thiếu cột dữ liệu (header)" })
      return
    }
    const rows = normalizeRows(body?.rows) ?? []

    let id = typeof body?.id === "string" && body.id.trim() ? body.id.trim() : slugify(name)
    if (!ID_REGEX.test(id)) id = slugify(id) || `sample-${Date.now()}`
    if (!ID_REGEX.test(id)) {
      res.status(400).json({ error: "id không hợp lệ (chỉ chữ, số, dấu gạch ngang)" })
      return
    }

    const existing = await query<{ n: number }>(
      withSchema(`SELECT 1 AS n FROM __SCHEMA__.sample_datasets WHERE id = $1`),
      [id]
    )
    if ((existing?.rows?.length ?? 0) > 0) {
      res.status(409).json({ error: `id "${id}" đã tồn tại` })
      return
    }

    const orderR = await query<{ maxorder: number | null }>(
      withSchema(`SELECT MAX(display_order) AS maxorder FROM __SCHEMA__.sample_datasets`)
    )
    const nextOrder =
      typeof body?.displayOrder === "number" ? body.displayOrder : (orderR.rows[0]?.maxorder ?? -1) + 1

    const r = await query<SampleDatasetRow>(
      withSchema(
        `INSERT INTO __SCHEMA__.sample_datasets (id, name, domain, description, tags, header, rows_data, display_order, updated_at)
         VALUES ($1, $2, $3, $4, $5::text[], $6::text[], $7::jsonb, $8, now())
         RETURNING ${SELECT_COLUMNS}`
      ),
      [
        id,
        name,
        body?.domain != null ? String(body.domain).trim() : null,
        body?.description != null ? String(body.description).trim() : null,
        normalizeStringArray(body?.tags),
        header,
        JSON.stringify(rows),
        nextOrder,
      ]
    )
    res.status(201).json(toFullItem(r.rows[0]))
  } catch (err: unknown) {
    console.error("[quantis-api] createSampleDataset:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function updateSampleDataset(req: Request, res: Response): Promise<void> {
  if (!requireAdmin(req, res)) return
  try {
    const id = String(req.params.id || "").trim()
    if (!id) {
      res.status(400).json({ error: "Thiếu id" })
      return
    }
    const body = req.body as SampleDatasetWriteBody

    const currentR = await query<SampleDatasetRow>(
      withSchema(`SELECT ${SELECT_COLUMNS} FROM __SCHEMA__.sample_datasets WHERE id = $1`),
      [id]
    )
    const current = currentR.rows[0]
    if (!current) {
      res.status(404).json({ error: "Không tìm thấy bộ dữ liệu mẫu" })
      return
    }

    const name = typeof body?.name === "string" && body.name.trim() ? body.name.trim() : current.name
    const domain = body?.domain !== undefined ? (body.domain != null ? String(body.domain).trim() : null) : current.domain
    const description =
      body?.description !== undefined ? (body.description != null ? String(body.description).trim() : null) : current.description
    const tags = body?.tags !== undefined ? normalizeStringArray(body.tags) : current.tags ?? []
    const header = body?.header !== undefined ? normalizeStringArray(body.header) : current.header ?? []
    if (header.length === 0) {
      res.status(400).json({ error: "Thiếu cột dữ liệu (header)" })
      return
    }
    const rows = body?.rows !== undefined ? normalizeRows(body.rows) ?? [] : current.rows_data ?? []
    const displayOrder = typeof body?.displayOrder === "number" ? body.displayOrder : current.display_order

    const r = await query<SampleDatasetRow>(
      withSchema(
        `UPDATE __SCHEMA__.sample_datasets
         SET name = $2, domain = $3, description = $4, tags = $5::text[], header = $6::text[], rows_data = $7::jsonb,
             display_order = $8, updated_at = now()
         WHERE id = $1
         RETURNING ${SELECT_COLUMNS}`
      ),
      [id, name, domain, description, tags, header, JSON.stringify(rows), displayOrder]
    )
    res.json(toFullItem(r.rows[0]))
  } catch (err: unknown) {
    console.error("[quantis-api] updateSampleDataset:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}

export async function deleteSampleDataset(req: Request, res: Response): Promise<void> {
  if (!requireAdmin(req, res)) return
  try {
    const id = String(req.params.id || "").trim()
    if (!id) {
      res.status(400).json({ error: "Thiếu id" })
      return
    }
    const r = await query(withSchema(`DELETE FROM __SCHEMA__.sample_datasets WHERE id = $1 RETURNING id`), [id])
    if ((r.rowCount ?? 0) === 0) {
      res.status(404).json({ error: "Không tìm thấy bộ dữ liệu mẫu" })
      return
    }
    res.json({ status: "ok" })
  } catch (err: unknown) {
    console.error("[quantis-api] deleteSampleDataset:", err)
    res.status(500).json({ error: (err as Error).message })
  }
}
