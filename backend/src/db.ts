import { Pool, QueryResultRow } from "pg"
import { DATABASE_URL, DB_SCHEMA } from "./env.js"

const SAFE_SCHEMA_REGEX = /^[a-zA-Z0-9_]+$/

function getSchemaSafe(): string {
  const s = typeof DB_SCHEMA === "string" ? DB_SCHEMA.trim() : ""
  return SAFE_SCHEMA_REGEX.test(s) ? s : "quantis"
}

let poolInstance: Pool | null = null

function getPool(): Pool {
  if (!poolInstance) {
    if (!DATABASE_URL) {
      throw new Error("DATABASE_URL or PORTAL_DATABASE_URL is required for Quantis PostgreSQL backend")
    }
    poolInstance = new Pool({
      connectionString: DATABASE_URL,
      max: 10,
      idleTimeoutMillis: 30_000,
      connectionTimeoutMillis: 10_000,
    })
    poolInstance.on("error", (err) => {
      console.error("[quantis-backend] Pool error:", err.message)
    })
  }
  return poolInstance
}

export function getSchema(): string {
  return getSchemaSafe()
}

export function resetPool(): void {
  if (poolInstance) {
    poolInstance.end().catch(() => {})
    poolInstance = null
  }
}

const STATEMENT_TIMEOUT_MS = 60_000

export async function query<T extends QueryResultRow = Record<string, unknown>>(text: string, params?: unknown[]) {
  const schema = getSchemaSafe()
  const client = await getPool().connect()
  try {
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    const normalized = text.replace(/__SCHEMA__/g, `"${schema}"`)
    return await client.query<T>(normalized, params)
  } finally {
    client.release()
  }
}

export async function withTransaction<T>(callback: (client: import("pg").PoolClient) => Promise<T>): Promise<T> {
  const schema = getSchemaSafe()
  const client = await getPool().connect()
  try {
    await client.query(`SET statement_timeout = ${STATEMENT_TIMEOUT_MS}`)
    await client.query("BEGIN")
    try {
      const result = await callback(client)
      await client.query("COMMIT")
      return result
    } catch (err) {
      await client.query("ROLLBACK")
      throw err
    }
  } finally {
    client.release()
  }
}

export function withSchema(sql: string): string {
  return sql.replace(/__SCHEMA__/g, `"${getSchemaSafe()}"`)
}
