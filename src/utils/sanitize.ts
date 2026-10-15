/**
 * Làm sạch văn bản nhập từ CSV/Excel/API: bỏ NUL (\u0000), surrogate đơn lẻ và ký tự điều khiển C0 (trừ tab, xuống dòng).
 * Nếu để lại, máy chủ PostgreSQL từ chối lưu workspace ("unsupported Unicode escape sequence").
 */
// eslint-disable-next-line no-control-regex
const BAD_CHARS = /[\u0000-\u0008\u000B\u000C\u000E-\u001F\u007F]|[\uD800-\uDBFF](?![\uDC00-\uDFFF])|(?<![\uD800-\uDBFF])[\uDC00-\uDFFF]/g;

export function cleanText(s: string): string {
  return s.replace(BAD_CHARS, "");
}

/** Làm sạch bảng string[][] (giữ nguyên hình dạng). */
export function cleanRows(rows: string[][]): string[][] {
  return rows.map((r) => r.map((c) => (typeof c === "string" ? cleanText(c) : c)));
}

/** Dùng làm replacer của JSON.stringify để lọc mọi chuỗi (giá trị) trong payload gửi lên máy chủ. */
export function cleanJsonReplacer(_key: string, value: unknown): unknown {
  return typeof value === "string" ? cleanText(value) : value;
}
