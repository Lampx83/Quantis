/**
 * Các hàm tiện ích dùng chung
 */

export { formatAPA } from "@/features/analysis/utils/formatAPA";

export function generateId(): string {
  return crypto.randomUUID?.() ?? `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

/** Chọn ngẫu nhiên n phần tử (partial Fisher–Yates), không đổi mảng gốc. */
export function pickRandomN<T>(items: readonly T[], n: number): T[] {
  if (n <= 0 || items.length === 0) return [];
  const copy = [...items];
  const take = Math.min(n, copy.length);
  for (let i = 0; i < take; i++) {
    const j = i + Math.floor(Math.random() * (copy.length - i));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy.slice(0, take);
}
