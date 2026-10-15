/**
 * Làm sạch chuỗi trước khi ghi vào PostgreSQL (cột jsonb).
 * Postgres từ chối "\u0000" ("unsupported Unicode escape sequence") và surrogate đơn lẻ; ký tự điều khiển C0 khác
 * (trừ tab, xuống dòng) cũng là rác khi nhập từ CSV/Excel nên bỏ luôn.
 */
// eslint-disable-next-line no-control-regex
const BAD_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g

export function cleanString(s: string): string {
  return s.replace(BAD_CHARS, "")
}

/** Đệ quy: làm sạch mọi chuỗi (cả khoá object) trong giá trị JSON. */
export function sanitizeJson<T>(value: T): T {
  if (typeof value === "string") return cleanString(value) as unknown as T
  if (Array.isArray(value)) return value.map((v) => sanitizeJson(v)) as unknown as T
  if (value !== null && typeof value === "object") {
    const out: Record<string, unknown> = {}
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) out[cleanString(k)] = sanitizeJson(v)
    return out as T
  }
  return value
}
