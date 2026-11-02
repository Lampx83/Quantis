import { numCell } from "./stats";

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
  ci95Lower: number; // mean - 1.96 * se
  ci95Upper: number; // mean + 1.96 * se
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
  sortOrder?: "category-asc" | "category-desc" | "value-asc" | "value-desc" | "none";
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

    const ci95Lower = mean - 1.96 * se;
    const ci95Upper = mean + 1.96 * se;

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
  if (sortOrder === "category-asc") {
    results.sort((a, b) =>
      a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
    );
  } else if (sortOrder === "category-desc") {
    results.sort((a, b) =>
      b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: "base" })
    );
  } else if (sortOrder === "value-asc") {
    results.sort((a, b) => a.value - b.value);
  } else if (sortOrder === "value-desc") {
    results.sort((a, b) => b.value - a.value);
  }
  // "none" giữ nguyên thứ tự xuất hiện ban đầu

  const limit = options.limit ?? 30;
  return results.slice(0, limit);
}
