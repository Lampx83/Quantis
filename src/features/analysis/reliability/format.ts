/** Số thống kê 3 chữ số thập phân; ô không tính được in "—" thay vì 0 hay NaN. */
export function formatStat(value: number | null | undefined, digits = 3): string {
  return value === null || value === undefined || Number.isNaN(value) ? "—" : value.toFixed(digits);
}

/**
 * Định dạng tham số số của câu lý do trước khi nội suy i18n: `t()` chỉ nối chuỗi thô,
 * nên 0.793043907252 sẽ xuất hiện nguyên văn nếu không làm tròn ở đây. Số đếm (n, k) giữ nguyên.
 */
export function formatParams(
  params: Record<string, string | number>
): Record<string, string | number> {
  const out: Record<string, string | number> = {};
  for (const [key, value] of Object.entries(params)) {
    out[key] = typeof value === "number" && !Number.isInteger(value) ? value.toFixed(3) : value;
  }
  return out;
}

