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

/**
 * Hot-deck Imputation (Nearest Neighbor):
 * For each row missing a value in a target column, finds the most similar donor row
 * using normalized Euclidean distance over other valid variables and borrows the donor's value.
 */
export function imputeHotDeck(
  data: string[][],
  selectedColumns?: string[],
  variables?: Record<string, VariableMetadata>
): string[][] {
  if (!data || data.length <= 1) return data ? data.map((r) => [...r]) : [];

  const header = data[0];
  const dataRows = data.slice(1);
  const targetCols =
    selectedColumns && selectedColumns.length > 0 ? selectedColumns : header;

  const targetColIndices = targetCols
    .map((col) => ({ col, ci: header.indexOf(col) }))
    .filter((item) => item.ci !== -1);

  if (targetColIndices.length === 0) return data.map((r) => [...r]);

  // Compute min-max range for all numeric columns to normalize Euclidean distance
  const ranges: Record<number, number> = {};
  header.forEach((col, ci) => {
    const meta = variables?.[col];
    const isNumeric = meta ? meta.type === "numeric" : true;
    if (isNumeric) {
      const nums = dataRows
        .map((r) => r[ci])
        .filter(
          (v) =>
            !isMissingValue(v, meta) &&
            String(v).trim() !== "" &&
            !Number.isNaN(Number(v))
        )
        .map(Number);
      if (nums.length > 1) {
        const min = Math.min(...nums);
        const max = Math.max(...nums);
        ranges[ci] = max > min ? max - min : 1;
      } else {
        ranges[ci] = 1;
      }
    }
  });

  const outputRows: string[][] = [
    [...header],
    ...dataRows.map((r) => [...r]),
  ];

  targetColIndices.forEach(({ col, ci }) => {
    const meta = variables?.[col];

    // Find donor pool: rows where this column is NOT missing
    const donorRowIndices: number[] = [];
    for (let i = 0; i < dataRows.length; i++) {
      const cell = dataRows[i][ci];
      const isMiss =
        isMissingValue(cell, meta) ||
        String(cell ?? "").trim() === "" ||
        String(cell ?? "").trim().toLowerCase() === "nan";
      if (!isMiss) {
        donorRowIndices.push(i);
      }
    }

    if (donorRowIndices.length === 0) return; // No donor available

    // Impute recipients
    for (let i = 0; i < dataRows.length; i++) {
      const cell = outputRows[i + 1][ci];
      const isMiss =
        isMissingValue(cell, meta) ||
        String(cell ?? "").trim() === "" ||
        String(cell ?? "").trim().toLowerCase() === "nan";

      if (!isMiss) continue;

      let bestDonorIdx = -1;
      let minDistance = Infinity;

      for (const donorIdx of donorRowIndices) {
        if (donorIdx === i) continue;

        let sumSqDist = 0;
        let matchingCount = 0;

        for (let c = 0; c < header.length; c++) {
          if (c === ci) continue; // Don't compare the column being imputed

          const colMeta = variables?.[header[c]];
          const valRec = dataRows[i][c];
          const valDon = dataRows[donorIdx][c];

          const missRec =
            isMissingValue(valRec, colMeta) ||
            String(valRec ?? "").trim() === "" ||
            String(valRec ?? "").trim().toLowerCase() === "nan";
          const missDon =
            isMissingValue(valDon, colMeta) ||
            String(valDon ?? "").trim() === "" ||
            String(valDon ?? "").trim().toLowerCase() === "nan";

          if (missRec || missDon) continue; // Skip attributes missing in either

          matchingCount++;
          const isNum = colMeta ? colMeta.type === "numeric" : !Number.isNaN(Number(valRec));

          if (isNum) {
            const numRec = Number(valRec);
            const numDon = Number(valDon);
            if (!Number.isNaN(numRec) && !Number.isNaN(numDon)) {
              const diff = (numRec - numDon) / (ranges[c] || 1);
              sumSqDist += diff * diff;
            }
          } else {
            sumSqDist += valRec === valDon ? 0 : 1;
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
      } else if (donorRowIndices.length > 0) {
        outputRows[i + 1][ci] = dataRows[donorRowIndices[0]][ci];
      }
    }
  });

  return outputRows;
}
