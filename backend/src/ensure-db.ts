/**
 * Schema quantis trên PostgreSQL — standalone (DB riêng) hoặc embedded (schema trên DB AI Portal).
 */
import { Pool } from "pg"
import fs from "fs"
import path from "path"
import { fileURLToPath } from "url"
import { RUN_MODE, DATABASE_URL, DB_SCHEMA } from "./env.js"
import { resetPool } from "./db.js"

const CODE_DB_DOES_NOT_EXIST = "3D000"

function extractDatabaseNameFromUrl(conn: string): string | null {
  try {
    const u = new URL(conn.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:"))
    const p = u.pathname.replace(/^\//, "")
    if (!p) return null
    return decodeURIComponent(p.split("/")[0])
  } catch {
    return null
  }
}

function withDatabaseName(conn: string, database: string): string {
  const u = new URL(conn.replace(/^postgresql:/i, "http:").replace(/^postgres:/i, "http:"))
  u.pathname = "/" + encodeURIComponent(database)
  const proto = /^postgres:\/\//i.test(conn) ? "postgres:" : "postgresql:"
  return proto + u.href.slice("http:".length)
}

function quoteDbNameForCreate(name: string): string {
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(name)) {
    throw new Error(`Tên database "${name}" không hỗ trợ tự tạo. Hãy: createdb ${name}`)
  }
  return '"' + name.replace(/"/g, '""') + '"'
}

async function createStandaloneDatabaseIfMissing(): Promise<void> {
  if (RUN_MODE !== "standalone" || !DATABASE_URL) return
  const probe = new Pool({ connectionString: DATABASE_URL, max: 1, connectionTimeoutMillis: 10_000 })
  try {
    await probe.query("SELECT 1")
    return
  } catch (e: unknown) {
    const code = (e as { code?: string })?.code
    if (code !== CODE_DB_DOES_NOT_EXIST) throw e
  } finally {
    await probe.end().catch(() => {})
  }

  const dbName = extractDatabaseNameFromUrl(DATABASE_URL)
  if (!dbName) throw new Error("[quantis-ensure-db] Không đọc được tên DB từ DATABASE_URL")
  const quoted = quoteDbNameForCreate(dbName)
  let lastErr: unknown = null
  for (const adminDb of ["postgres", "template1"]) {
    const adminUrl = withDatabaseName(DATABASE_URL, adminDb)
    const adminPool = new Pool({ connectionString: adminUrl, max: 1, connectionTimeoutMillis: 10_000 })
    try {
      await adminPool.query(`CREATE DATABASE ${quoted}`)
      console.log("[quantis-ensure-db] Đã tạo database:", dbName)
      await adminPool.end()
      resetPool()
      return
    } catch (err: unknown) {
      await adminPool.end().catch(() => {})
      const code = (err as { code?: string })?.code
      if (code === "42P04") {
        resetPool()
        return
      }
      lastErr = err
    }
  }
  throw lastErr ?? new Error("CREATE DATABASE thất bại")
}

function getSchemaPath(): string {
  const __dirname = path.dirname(fileURLToPath(import.meta.url))
  const fromDist = path.join(__dirname, "..", "schema", "schema.sql")
  const fromSrc = path.join(__dirname, "..", "..", "schema", "schema.sql")
  if (fs.existsSync(fromDist)) return fromDist
  return fromSrc
}

function getSchemaContent(): string | null {
  const p = getSchemaPath()
  if (!fs.existsSync(p)) return null
  return fs.readFileSync(p, "utf-8")
}

async function schemaAlreadyApplied(): Promise<boolean> {
  const { query } = await import("./db.js")
  const ok = await query<{ n: number }>(
    `SELECT 1 AS n FROM information_schema.tables WHERE table_schema = $1 AND table_name = 'workspaces'`,
    [DB_SCHEMA]
  )
  return (ok?.rows?.length ?? 0) > 0
}

async function applySchema(): Promise<void> {
  let sqlRaw = getSchemaContent()
  if (!sqlRaw?.trim()) {
    console.warn("[quantis-ensure-db] schema/schema.sql not found")
    return
  }
  const quoted = `"${DB_SCHEMA}"`
  let sql = sqlRaw.replace(/__SCHEMA__/g, quoted)
  const statements = sql
    .split(/;\s*\n/)
    .map((s) => s.replace(/^\s*--[^\n]*\n?/gm, "").trim())
    .filter((s) => s.length > 0)
  const pool = new Pool({ connectionString: DATABASE_URL!, max: 1 })
  try {
    for (const stmt of statements) {
      if (!stmt) continue
      const s = stmt.endsWith(";") ? stmt : stmt + ";"
      try {
        await pool.query(s)
      } catch (stmtErr: unknown) {
        const code = (stmtErr as { code?: string })?.code
        const detail = (stmtErr as { detail?: string })?.detail ?? ""
        if (code === "23505" && (detail.includes("already exists") || (stmtErr as { constraint?: string })?.constraint === "pg_namespace_nspname_index")) {
          continue
        }
        throw stmtErr
      }
    }
    console.log("[quantis-ensure-db] Schema", DB_SCHEMA, "applied")
  } finally {
    await pool.end()
  }
}

export async function ensureDatabase(): Promise<void> {
  if (!DATABASE_URL) {
    console.warn("[quantis-ensure-db] No DATABASE_URL, skip")
    return
  }
  try {
    if (RUN_MODE === "standalone") {
      await createStandaloneDatabaseIfMissing()
    }
    if (!(await schemaAlreadyApplied())) {
      console.log("[quantis-ensure-db] Applying schema...")
      await applySchema()
    }
  } catch (err: unknown) {
    const code = (err as { code?: string })?.code
    if (code === CODE_DB_DOES_NOT_EXIST && RUN_MODE === "standalone") {
      console.log(
        "[quantis-ensure-db] Database chưa tồn tại. Chạy: createdb",
        extractDatabaseNameFromUrl(DATABASE_URL ?? "") || "quantis"
      )
    }
    throw err
  }
}
