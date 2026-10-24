import { VariableMetadata } from "../types";
import { isMissingValue, inferVariableMetadata } from "./metadata";

export type ImputationStrategy = "mean" | "median" | "mode";

export interface PairwiseOptions {
  keepAllColumns?: boolean;
}

/**
 * Listwise Deletion (Complete-Case Analysis):
 * Removes any row that contains missing values, empty strings, "NaN",
 * or user-defined discrete missing codes in any of the selectedColumns.
 */
export function imputeListwise(
  data: string[][],
  selectedColumns?: string[],
  variables?: Record<string, VariableMetadata>
): string[][] {
  if (!data || data.length === 0) return [];
  if (data.length === 1) return [data[0]];

  const header = data[0];
  const targetCols =
    selectedColumns && selectedColumns.length > 0 ? selectedColumns : header;
  const colIndices = targetCols
    .map((col) => ({ col, ci: header.indexOf(col) }))
    .filter((item) => item.ci !== -1);

  if (colIndices.length === 0) return data.map((r) => [...r]);

  const keptRows = data.slice(1).filter((row) => {
    return colIndices.every(({ col, ci }) => {
      const val = row[ci];
      const meta = variables?.[col];
      if (isMissingValue(val, meta)) return false;
      const str = String(val ?? "").trim();
      if (str === "" || str.toLowerCase() === "nan") return false;
      return true;
    });
  });

  return [header, ...keptRows];
}

/**
 * Mean / Median / Mode Imputation (Client-side):
 * Enforces statistical measure constraints:
 * - Scale variables: Mean or Median (excluding discrete missing codes from sample).
 * - Nominal / Ordinal variables: Mode (most frequent category).
 * Fills missing cells with the calculated metric.
 */
export function imputeMeanMedianMode(
  data: string[][],
  selectedColumns?: string[],
  variables?: Record<string, VariableMetadata>,
  strategy?: ImputationStrategy
): string[][] {
  if (!data || data.length <= 1) return data ? data.map((r) => [...r]) : [];

  const header = data[0];
  const dataRows = data.slice(1);
  const targetCols =
    selectedColumns && selectedColumns.length > 0 ? selectedColumns : header;

  const outputRows: string[][] = [
    [...header],
    ...dataRows.map((r) => [...r]),
  ];

  targetCols.forEach((col) => {
    const ci = header.indexOf(col);
    if (ci === -1) return;

    let meta = variables?.[col];
    if (!meta) {
      const colVals = dataRows.map((r) => r[ci] ?? "");
      meta = inferVariableMetadata(col, colVals);
    }

    const isScale = meta.measure === "scale";
    const isNumeric = meta.type === "numeric";

    // Enforce statistical rules: Mean/Median only for Scale, Mode for Nominal/Ordinal
    let effectiveStrategy: ImputationStrategy = strategy ?? (isScale ? "mean" : "mode");
    if (!isScale && (effectiveStrategy === "mean" || effectiveStrategy === "median")) {
      effectiveStrategy = "mode";
    }

    // Collect valid observations (strictly excluding discrete missing codes & empty/NaN)
    const validValues = dataRows
      .map((r) => r[ci])
      .filter((v) => {
        if (isMissingValue(v, meta)) return false;
        const s = String(v ?? "").trim();
        if (s === "" || s.toLowerCase() === "nan") return false;
        if (isNumeric && Number.isNaN(Number(s))) return false;
        return true;
      })
      .map((v) => String(v).trim());

    let fillValue = "";

    if (effectiveStrategy === "mode") {
      if (validValues.length > 0) {
        const counts: Record<string, number> = {};
        validValues.forEach((v) => {
          counts[v] = (counts[v] || 0) + 1;
        });
        let maxCount = 0;
        let bestVal = "";
        Object.entries(counts).forEach(([val, cnt]) => {
          if (cnt > maxCount) {
            maxCount = cnt;
            bestVal = val;
          }
        });
        fillValue = bestVal;
      }
    } else if (effectiveStrategy === "median") {
      const nums = validValues.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
      if (nums.length > 0) {
        nums.sort((a, b) => a - b);
        const mid = Math.floor(nums.length / 2);
        const med = nums.length % 2 !== 0 ? nums[mid] : (nums[mid - 1] + nums[mid]) / 2;
        const decimals = meta.decimals ?? 2;
        fillValue = med.toFixed(decimals);
      }
    } else {
      // Mean
      const nums = validValues.map((v) => Number(v)).filter((n) => !Number.isNaN(n));
      if (nums.length > 0) {
        const sum = nums.reduce((acc, curr) => acc + curr, 0);
        const avg = sum / nums.length;
        const decimals = meta.decimals ?? 2;
        fillValue = avg.toFixed(decimals);
      }
    }

    if (fillValue !== "") {
      for (let rIdx = 0; rIdx < dataRows.length; rIdx++) {
        const currentCell = dataRows[rIdx][ci];
        const s = String(currentCell ?? "").trim();
        const isMissing =
          isMissingValue(currentCell, meta) ||
          s === "" ||
          s.toLowerCase() === "nan" ||
          (isNumeric && Number.isNaN(Number(s)));

        if (isMissing) {
          outputRows[rIdx + 1][ci] = fillValue;
        }
      }
    }
  });

  return outputRows;
}

/**
 * Các cột sẽ bị đổi từ trung bình/trung vị sang MỐT: chỉ biến thang đo `scale` mới được điền mean/median
 * (điền trung bình lên thang thứ bậc/danh định tạo ra mã không tồn tại, vd 3,4 trên thang Likert).
 * `imputeMeanMedianMode` vẫn áp quy tắc này; hàm này để giao diện CẢNH BÁO người dùng thay vì đổi âm thầm.
 */
export function getModeFallbackColumns(
  data: string[][],
  selectedColumns: string[] | undefined,
  variables: Record<string, VariableMetadata> | undefined,
  strategy: ImputationStrategy
): string[] {
  if (strategy === "mode" || !data || data.length <= 1) return [];
  const header = data[0];
  const targetCols = selectedColumns && selectedColumns.length > 0 ? selectedColumns : header;
  const out: string[] = [];
  for (const col of targetCols) {
    const ci = header.indexOf(col);
    if (ci === -1) continue;
    const meta =
      variables?.[col] ?? inferVariableMetadata(col, data.slice(1).map((r) => r[ci] ?? ""));
    if (meta.measure !== "scale") out.push(col);
  }
  return out;
}

/**
 * Pairwise Deletion:
 * Filters valid observation pairs between colA and colB for correlation or covariance,
 * without discarding rows due to missingness in unrelated variables.
 */
export function imputePairwise(
  data: string[][],
  colA: string,
  colB: string,
  variables?: Record<string, VariableMetadata>,
  options?: PairwiseOptions
): string[][] {
  if (!data || data.length <= 1) return [];

  const header = data[0];
  const ciA = header.indexOf(colA);
  const ciB = header.indexOf(colB);

  if (ciA === -1 || ciB === -1) return [];

  const metaA = variables?.[colA];
  const metaB = variables?.[colB];

  const validRows = data.slice(1).filter((row) => {
    const vA = row[ciA];
    const vB = row[ciB];

    if (isMissingValue(vA, metaA) || isMissingValue(vB, metaB)) return false;

    const sA = String(vA ?? "").trim();
    const sB = String(vB ?? "").trim();

    if (sA === "" || sA.toLowerCase() === "nan") return false;
    if (sB === "" || sB.toLowerCase() === "nan") return false;

    return true;
  });

  if (options?.keepAllColumns) {
    return [header, ...validRows];
  }

  return [[colA, colB], ...validRows.map((r) => [r[ciA], r[ciB]])];
}

/** Số ứng viên cho tối đa xét cho MỖI ô khuyết (giữ thời gian ~ tuyến tính theo số dòng). */
export const HOT_DECK_MAX_DONOR_CANDIDATES = 1000;

const isBlankOrNan = (cell: unknown): boolean => {
  const s = String(cell ?? "").trim();
  return s === "" || s.toLowerCase() === "nan";
};

/**
 * Hot-deck Imputation (Nearest Neighbor):
 * For each row missing a value in a target column, finds the most similar donor row
 * using normalized Euclidean distance over other valid variables and borrows the donor's value.
 *
 * Hiệu năng: mỗi ô được giải mã MỘT lần vào mảng số (Float64Array/Int32Array) rồi vòng khoảng cách chỉ
 * làm phép tính trên mảng; khi số người cho > HOT_DECK_MAX_DONOR_CANDIDATES thì mỗi người nhận chỉ xét một
 * tập con người cho cách đều nhau (lệch pha theo chỉ số dòng, nên tất định và không dồn vào cùng một nhóm).
 * Dưới ngưỡng đó kết quả giống hệt bản duyệt toàn bộ.
 */
export function imputeHotDeck(
  data: string[][],
  selectedColumns?: string[],
  variables?: Record<string, VariableMetadata>
): string[][] {
  if (!data || data.length <= 1) return data ? data.map((r) => [...r]) : [];

  const header = data[0];
  const dataRows = data.slice(1);
  const nRows = dataRows.length;
  const nCols = header.length;
  const targetCols =
    selectedColumns && selectedColumns.length > 0 ? selectedColumns : header;

  const targetColIndices = targetCols
    .map((col) => ({ col, ci: header.indexOf(col) }))
    .filter((item) => item.ci !== -1);

  if (targetColIndices.length === 0) return data.map((r) => [...r]);

  // Giải mã mỗi ô một lần: present (không khuyết) / số / mã danh mục.
  const present: Uint8Array[] = [];
  const nums: Float64Array[] = [];
  const cats: Int32Array[] = [];
  const colIsNumeric: (boolean | null)[] = []; // null = không có metadata -> quyết định theo từng ô
  const ranges: number[] = [];
  const catIds = new Map<string, number>();
  for (let c = 0; c < nCols; c++) {
    const meta = variables?.[header[c]];
    colIsNumeric.push(meta ? meta.type === "numeric" : null);
    const pres = new Uint8Array(nRows);
    const nv = new Float64Array(nRows).fill(NaN);
    const cv = new Int32Array(nRows).fill(-1);
    let min = Infinity;
    let max = -Infinity;
    let count = 0;
    for (let i = 0; i < nRows; i++) {
      const cell = dataRows[i][c];
      if (isMissingValue(cell, meta) || isBlankOrNan(cell)) continue;
      pres[i] = 1;
      const n = Number(cell);
      nv[i] = Number.isNaN(n) ? NaN : n;
      if (!Number.isNaN(n)) {
        // Vòng lặp thay cho Math.min(...nums): spread tràn ngăn xếp từ ~100.000 phần tử.
        if (n < min) min = n;
        if (n > max) max = n;
        count++;
      }
      const key = String(cell);
      let id = catIds.get(key);
      if (id === undefined) {
        id = catIds.size;
        catIds.set(key, id);
      }
      cv[i] = id;
    }
    present.push(pres);
    nums.push(nv);
    cats.push(cv);
    const isNumericCol = meta ? meta.type === "numeric" : true;
    ranges.push(isNumericCol && count > 1 && max > min ? max - min : 1);
  }

  const outputRows: string[][] = [
    [...header],
    ...dataRows.map((r) => [...r]),
  ];

  targetColIndices.forEach(({ ci }) => {
    // Find donor pool: rows where this column is NOT missing
    const donors: number[] = [];
    for (let i = 0; i < nRows; i++) {
      if (present[ci][i]) donors.push(i);
    }
    if (donors.length === 0) return; // No donor available

    const cap = HOT_DECK_MAX_DONOR_CANDIDATES;
    const stride = donors.length > cap ? Math.ceil(donors.length / cap) : 1;

    // Impute recipients
    for (let i = 0; i < nRows; i++) {
      if (present[ci][i]) continue;

      let bestDonorIdx = -1;
      let minDistance = Infinity;
      const offset = stride > 1 ? i % stride : 0;

      for (let k = offset; k < donors.length; k += stride) {
        const donorIdx = donors[k];
        if (donorIdx === i) continue;

        let sumSqDist = 0;
        let matchingCount = 0;

        for (let c = 0; c < nCols; c++) {
          if (c === ci) continue; // Don't compare the column being imputed
          if (!present[c][i] || !present[c][donorIdx]) continue; // Skip attributes missing in either

          matchingCount++;
          const numRec = nums[c][i];
          const isNum = colIsNumeric[c] ?? !Number.isNaN(numRec);

          if (isNum) {
            const numDon = nums[c][donorIdx];
            if (!Number.isNaN(numRec) && !Number.isNaN(numDon)) {
              const diff = (numRec - numDon) / (ranges[c] || 1);
              sumSqDist += diff * diff;
            }
          } else {
            sumSqDist += cats[c][i] === cats[c][donorIdx] ? 0 : 1;
          }
        }

        const dist = matchingCount > 0 ? Math.sqrt(sumSqDist / matchingCount) : Infinity;

        if (dist < minDistance) {
          minDistance = dist;
          bestDonorIdx = donorIdx;
        }
      }

      if (bestDonorIdx !== -1) {
        outputRows[i + 1][ci] = dataRows[bestDonorIdx][ci];
      } else {
        outputRows[i + 1][ci] = dataRows[donors[0]][ci];
      }
    }
  });

  return outputRows;
}
