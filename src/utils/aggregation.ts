import { numCell } from "./stats";
import type { ChartSortOrder } from "../types";

export type AggregateFunction =
  | "mean"
  | "sum"
  | "count"
  | "std"
  | "median"
  | "min"
  | "max";

export interface AggregateMetrics {
  mean: number;
  sum: number;
  count: number; // số lượng quan sát hợp lệ (không rỗng, không NaN)
  std: number; // độ lệch chuẩn mẫu (hiệu chỉnh Bessel n - 1; n < 2 -> 0)
  median: number;
  min: number;
  max: number;
  se: number; // sai số chuẩn = std / sqrt(count); n < 2 -> 0
  ci95Lower: number; // mean - t(0.975, n - 1) * se
  ci95Upper: number; // mean + t(0.975, n - 1) * se
}

/**
 * Two-tailed 97.5% critical values of Student's t for df = 1..30.
 * Above 30 the normal value (1.96) is close enough for chart error bars.
 * Using 1.96 for a 2-row group would understate the interval by more than 6×.
 */
const T_CRITICAL_975: Record<number, number> = {
  1: 12.706,
  2: 4.303,
  3: 3.182,
  4: 2.776,
  5: 2.571,
  6: 2.447,
  7: 2.365,
  8: 2.306,
  9: 2.262,
  10: 2.228,
  11: 2.201,
  12: 2.179,
  13: 2.160,
  14: 2.145,
  15: 2.131,
  16: 2.120,
  17: 2.110,
  18: 2.101,
  19: 2.093,
  20: 2.086,
  21: 2.080,
  22: 2.074,
  23: 2.069,
  24: 2.064,
  25: 2.060,
  26: 2.056,
  27: 2.052,
  28: 2.048,
  29: 2.045,
  30: 2.042,
};

/** t critical value for a two-tailed 95% interval with df degrees of freedom. */
function tCritical95(df: number): number {
  return T_CRITICAL_975[df] ?? 1.96;
}

export interface AggregatedGroup {
  /** Tên định danh nhóm (dùng làm trục X / Recharts `name`) */
  name: string;
  /**
   * Nhãn nhóm đã tách rời, đúng thứ tự `groupByCols`. `seriesPivot` đọc trường này
   * thay vì tách `name` theo dấu phân cách: giá trị dữ liệu có chứa " | " vẫn pivot đúng.
   */
  parts: string[];
  /** Giá trị của hàm tổng hợp đã chọn */
  value: number;
  /** Trọn bộ các chỉ số thống kê của nhóm */
  metrics: AggregateMetrics;
}

export interface AggregateOptions {
  /** Danh sách tên cột để gom nhóm (dòng 0 là header) */
  groupByCols: string[];
  /** Cột biến số cần đo lường / tổng hợp */
  measureCol: string;
  /** Hàm tổng hợp cần trích xuất vào trường `value` */
  func: AggregateFunction;
  /** Bỏ qua các dòng có khóa nhóm rỗng hoặc giá trị đo lường NaN (mặc định: true) */
  skipEmpty?: boolean;
  /** Giới hạn số lượng nhóm tối đa trả về (mặc định: 30) */
  limit?: number;
  /** Thứ tự sắp xếp kết quả (mặc định: category-asc) */
  sortOrder?: ChartSortOrder;
}

/** Natural, case-insensitive label comparison ("2" before "10"). */
export function compareCategoryLabels(a: string, b: string): number {
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/**
 * Sorts chart categories by label or by value. "none" keeps insertion order.
 * Shared by the aggregation engine and the count-based charts so every chart
 * follows the same ordering rules.
 */
export function sortChartCategories<T>(
  items: T[],
  getName: (item: T) => string,
  getValue: (item: T) => number,
  sortOrder: ChartSortOrder
): T[] {
  if (sortOrder === "category-asc" || sortOrder === "category-desc") {
    const dir = sortOrder === "category-desc" ? -1 : 1;
    return [...items].sort((a, b) => dir * compareCategoryLabels(getName(a), getName(b)));
  }
  if (sortOrder === "value-asc" || sortOrder === "value-desc") {
    const dir = sortOrder === "value-asc" ? 1 : -1;
    return [...items].sort((a, b) => dir * (getValue(a) - getValue(b)));
  }
  return items;
}

export interface CategoryCount {
  name: string;
  count: number;
}

/**
 * Counts rows per value of one column. `trim` collapses " A" and "A";
 * `skipEmpty` drops blank categories.
 */
export function countByCategory(
  rows: string[][],
  colIdx: number,
  options: { trim?: boolean; skipEmpty?: boolean } = {}
): CategoryCount[] {
  const { trim = false, skipEmpty = false } = options;
  const counts: Record<string, number> = Object.create(null);
  for (let i = 1; i < rows.length; i++) {
    const text = rows[i]?.[colIdx] ?? "";
    const name = trim ? text.trim() : text;
    if (skipEmpty && name === "") continue;
    counts[name] = (counts[name] ?? 0) + 1;
  }
  return Object.entries(counts).map(([name, count]) => ({ name, count }));
}

/**
 * Động cơ tổng hợp dữ liệu thuần túy (Pure Aggregation Engine).
 * Gom nhóm bảng rows (string[][]) theo 1 hoặc nhiều cột định tính và tính toán
 * các chỉ số thống kê mô tả (Mean, Sum, Count, Std, Median, Min, Max, SE, 95% CI).
 */
export function aggregateData(
  rows: string[][],
  options: AggregateOptions
): AggregatedGroup[] {
  if (!rows || !Array.isArray(rows) || rows.length < 2) {
    return [];
  }

  const header = rows[0];
  if (!header || !Array.isArray(header)) {
    return [];
  }

  if (!options.groupByCols || options.groupByCols.length === 0) {
    return [];
  }

  const groupIndices = options.groupByCols.map((c) => header.indexOf(c));
  if (groupIndices.some((idx) => idx === -1)) {
    return [];
  }

  const measureIdx = header.indexOf(options.measureCol);
  if (measureIdx === -1) {
    return [];
  }

  const skipEmpty = options.skipEmpty !== false;
  const groupMap = new Map<string, { parts: string[]; values: number[] }>();

  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    if (!row) continue;

    const groupParts = groupIndices.map((ci) => String(row[ci] ?? "").trim());
    if (skipEmpty && groupParts.some((p) => p === "")) {
      continue;
    }

    const groupKey = groupParts.join(" | ");
    const val = numCell(row[measureIdx]);

    if (Number.isNaN(val)) {
      if (!skipEmpty && !groupMap.has(groupKey)) {
        groupMap.set(groupKey, { parts: groupParts, values: [] });
      }
      continue;
    }

    let entry = groupMap.get(groupKey);
    if (!entry) {
      entry = { parts: groupParts, values: [] };
      groupMap.set(groupKey, entry);
    }
    entry.values.push(val);
  }

  const results: AggregatedGroup[] = [];

  for (const [groupKey, { parts, values }] of groupMap.entries()) {
    const n = values.length;
    // Nhóm không có quan sát hợp lệ (n = 0) bị loại khỏi kết quả
    if (n === 0) {
      continue;
    }

    const sum = values.reduce((a, b) => a + b, 0);
    const mean = sum / n;
    const sorted = [...values].sort((a, b) => a - b);
    const min = sorted[0];
    const max = sorted[n - 1];

    let median = sorted[0];
    if (n > 1) {
      const pos = (n - 1) * 0.5;
      const lo = Math.floor(pos);
      const hi = Math.ceil(pos);
      median = sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
    }

    let std = 0;
    if (n >= 2) {
      const ss = values.reduce((acc, x) => acc + (x - mean) ** 2, 0);
      std = Math.sqrt(ss / (n - 1));
    }

    let se = 0;
    if (n >= 2) {
      se = std / Math.sqrt(n);
    }

    const ci95Lower = mean - tCritical95(n - 1) * se;
    const ci95Upper = mean + tCritical95(n - 1) * se;

    const metrics: AggregateMetrics = {
      mean,
      sum,
      count: n,
      std,
      median,
      min,
      max,
      se,
      ci95Lower,
      ci95Upper,
    };

    const value = metrics[options.func];

    results.push({
      name: groupKey,
      parts,
      value,
      metrics,
    });
  }

    // Sắp xếp kết quả theo sortOrder (mặc định: category-asc với so sánh số/chữ tự nhiên)
  const sortOrder = options.sortOrder ?? "category-asc";
  const sorted = sortChartCategories(results, (g) => g.name, (g) => g.value, sortOrder);
  const limit = options.limit ?? 30;
  return sorted.slice(0, limit);
}
