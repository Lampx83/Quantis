/** Số thống kê 3 chữ số thập phân; ô không tính được in "—" thay vì 0 hay NaN. */
export function formatStat(value: number | null | undefined, digits = 3): string {
  return value === null || value === undefined || Number.isNaN(value) ? "—" : value.toFixed(digits);
}
