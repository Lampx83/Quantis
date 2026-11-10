import { numCell } from "./stats";

export type FactorSampleIssue =
  | { code: "missingColumns" | "constantColumns"; columns: string[] }
  | { code: "insufficientRows" };

export interface FactorSample {
  columnNames: string[];
  data: number[][];
  nInput: number;
  nUsed: number;
  correlation: number[][] | null;
  issue: FactorSampleIssue | null;
}

/** Prepare the selected columns from rows already normalized by getAnalysisRows. */
export function createFactorSample(rows: string[][], columns: string[]): FactorSample {
  const header = rows[0] ?? [];
  const columnNames = [...columns];
  const indices = columnNames.map((name) => header.indexOf(name));
  const data: number[][] = [];
  const sample = { columnNames, data, nInput: Math.max(0, rows.length - 1), nUsed: 0, correlation: null };
  const missing = columnNames.filter((_, j) => indices[j] < 0);
  if (missing.length) return { ...sample, issue: { code: "missingColumns", columns: missing } };

  for (let i = 1; i < rows.length; i++) {
    const values = indices.map((j) => numCell(rows[i][j]));
    if (values.every(Number.isFinite)) data.push(values);
  }
  sample.nUsed = data.length;
  if (data.length < 2) return { ...sample, issue: { code: "insufficientRows" } };
  const constant = columnNames.filter((_, j) => data.every((row) => row[j] === data[0][j]));
  if (constant.length) return { ...sample, issue: { code: "constantColumns", columns: constant } };

  const centered = columnNames.map((_, j) => {
    // Rescale before centering so sums and products stay finite for extreme inputs.
    const scale = data.reduce((largest, row) => Math.max(largest, Math.abs(row[j])), 0);
    const origin = data[0][j] / scale;
    const offsets = data.map((row) => row[j] / scale - origin);
    const mean = offsets.reduce((sum, value) => sum + value, 0) / offsets.length;
    return offsets.map((value) => value - mean);
  });
  const norms = centered.map((values) => Math.sqrt(values.reduce((sum, value) => sum + value ** 2, 0)));
  const correlation: number[][] = centered.map((_, i) => centered.map((_, j) => i === j ? 1 : 0));
  for (let i = 0; i < centered.length; i++) {
    for (let j = i + 1; j < centered.length; j++) {
      const dot = centered[i].reduce((sum, value, k) => sum + value * centered[j][k], 0);
      correlation[i][j] = correlation[j][i] = dot / (norms[i] * norms[j]);
    }
  }
  return { ...sample, correlation, issue: null };
}

export function factorApiRows(sample: FactorSample): string[][] {
  return [sample.columnNames, ...sample.data.map((row) => row.map(String))];
}
