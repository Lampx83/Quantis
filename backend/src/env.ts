import dotenv from "dotenv"
import path from "path"
import { fileURLToPath } from "url"

const __dirname = path.dirname(fileURLToPath(import.meta.url))
dotenv.config({ path: path.resolve(__dirname, "..", ".env") })
dotenv.config()

export function getEnv(key: string, defaultValue?: string): string {
  const v = typeof process.env[key] === "string" ? (process.env[key] as string).trim() : ""
  return v !== "" ? v : defaultValue !== undefined ? defaultValue : ""
}

export const RUN_MODE = getEnv("RUN_MODE", "standalone") as "standalone" | "embedded"
export const PORT = Number(getEnv("PORT", "4003"))
export const DB_SCHEMA = getEnv("DB_SCHEMA", "quantis")

export const AUTH_ENABLED = (() => {
  const v = getEnv("AUTH_ENABLED")
  if (v !== "") return v === "1" || v.toLowerCase() === "true"
  return RUN_MODE === "standalone"
})()

export const AUTH_REQUIRED = (() => {
  const v = getEnv("AUTH_REQUIRED")
  if (v !== "") return v === "1" || v.toLowerCase() === "true"
  return RUN_MODE === "standalone" && AUTH_ENABLED
})()

export const SESSION_SECRET = getEnv("SESSION_SECRET", "quantis-session-secret-change-in-production")

export const ADMIN_EMAILS = (() => {
  const v = getEnv("ADMIN_EMAILS", getEnv("QUANTIS_ADMIN_EMAILS", "")).trim()
  if (!v) return new Set<string>()
  return new Set(v.split(/[,;\s]+/).map((e) => e.trim().toLowerCase()).filter(Boolean))
})()

export const SSO_ISSUER_URL = getEnv("SSO_ISSUER_URL", "")
export const SSO_CLIENT_ID = getEnv("SSO_CLIENT_ID", "")
export const SSO_CLIENT_SECRET = getEnv("SSO_CLIENT_SECRET", "")
export const SSO_CALLBACK_URL = getEnv("SSO_CALLBACK_URL", "")
export const SSO_LABEL = getEnv("SSO_LABEL", "Đăng nhập bằng SSO")

export const DATABASE_URL =
  getEnv("DATABASE_URL") ||
  getEnv("PORTAL_DATABASE_URL") ||
  (() => {
    const host = getEnv("POSTGRES_HOST", "localhost")
    const port = getEnv("POSTGRES_PORT", "5432")
    const user = getEnv("POSTGRES_USER", "postgres")
    const password = getEnv("POSTGRES_PASSWORD", "postgres")
    const db = getEnv("POSTGRES_DB", "quantis")
    const enc = encodeURIComponent
    return `postgresql://${enc(user)}:${enc(password)}@${host}:${port}/${enc(db)}`
  })()
