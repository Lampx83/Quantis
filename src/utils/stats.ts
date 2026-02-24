/**
 * Utils: parse CSV, data profiling, descriptive statistics, t-test (client-side).
 */

import type { DataProfile } from "../types";

const MAX_ROWS_STORED = 50000;

/** Parse CSV text (handles quoted fields with commas). */
export function parseCSV(text: string): string[][] {
  const lines: string[][] = [];
  let current: string[] = [];
  let field = "";
  let inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (c === '"') {
      inQuotes = !inQuotes;
    } else if (inQuotes) {
      if (c === "\n") field += "\n";
      else field += c;
    } else if (c === ",") {
      current.push(field.trim());
      field = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && text[i + 1] === "\n") i++;
      current.push(field.trim());
      field = "";
      if (current.some((s) => s !== "")) lines.push(current);
      current = [];
    } else {
      field += c;
    }
  }
  if (field !== "" || current.length > 0) {
    current.push(field.trim());
    if (current.some((s) => s !== "")) lines.push(current);
  }
  return lines;
}

function isNumeric(val: string): boolean {
  if (val === "" || val === null || val === undefined) return false;
  const n = Number(val);
  return !Number.isNaN(n) && Number.isFinite(n);
}

function toNum(val: string): number {
  return Number(val);
}

/** Compute data profile for each column. */
export function computeProfile(rows: string[][]): DataProfile[] {
  if (rows.length === 0) return [];
  const headers = rows[0];
  const dataRows = rows.slice(1);
  return headers.map((col, ci) => {
    const values = dataRows.map((r) => (r[ci] !== undefined ? String(r[ci]).trim() : ""));
    const nonEmpty = values.filter((v) => v !== "");
    const missing = values.length - nonEmpty.length;
    const unique = new Set(nonEmpty).size;
    const nums = nonEmpty.filter(isNumeric).map(toNum);
    const type = nums.length === nonEmpty.length && nonEmpty.length > 0 ? "numeric" : "categorical";
    const profile: DataProfile = {
      column: col,
      type,
      missing,
      missingPct: values.length ? (missing / values.length) * 100 : 0,
      unique,
    };
    if (nums.length > 0) {
      const n = nums.length;
      const sum = nums.reduce((a, b) => a + b, 0);
      const mean = sum / n;
      const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
      profile.min = Math.min(...nums);
      profile.max = Math.max(...nums);
      profile.mean = mean;
      profile.std = Math.sqrt(variance);
      const m3 = nums.reduce((a, b) => a + (b - mean) ** 3, 0) / n;
      profile.skew = profile.std && profile.std > 0 ? m3 / profile.std ** 3 : undefined;
    }
    return profile;
  });
}

export interface DescriptiveRow {
  column: string;
  type: string;
  n: number;
  missing: number;
  mean?: number;
  median?: number;
  std?: number;
  min?: number;
  max?: number;
  q25?: number;
  q75?: number;
  freq?: { value: string; count: number }[];
}

/** Descriptive statistics per column. */
export function computeDescriptive(rows: string[][]): DescriptiveRow[] {
  if (rows.length === 0) return [];
  const headers = rows[0];
  const dataRows = rows.slice(1);
  return headers.map((col, ci) => {
    const values = dataRows.map((r) => (r[ci] !== undefined ? String(r[ci]).trim() : ""));
    const nonEmpty = values.filter((v) => v !== "");
    const missing = values.length - nonEmpty.length;
    const nums = nonEmpty.filter(isNumeric).map(toNum);
    const type = nums.length === nonEmpty.length && nonEmpty.length > 0 ? "numeric" : "categorical";
    const row: DescriptiveRow = { column: col, type, n: values.length, missing };
    if (type === "numeric" && nums.length > 0) {
      const sorted = [...nums].sort((a, b) => a - b);
      const n = sorted.length;
      row.mean = nums.reduce((a, b) => a + b, 0) / n;
      row.median = sorted[Math.floor(n / 2)];
      const mean = row.mean;
      row.std = Math.sqrt(nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n);
      row.min = Math.min(...nums);
      row.max = Math.max(...nums);
      row.q25 = sorted[Math.floor(n * 0.25)];
      row.q75 = sorted[Math.floor(n * 0.75)];
    } else {
      const counts: Record<string, number> = {};
      nonEmpty.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
      row.freq = Object.entries(counts).map(([value, count]) => ({ value, count })).sort((a, b) => b.count - a.count);
    }
    return row;
  });
}

export interface TTestResult {
  t: number;
  df: number;
  pValue: number;
  cohenD: number;
  mean1: number;
  mean2: number;
  n1: number;
  n2: number;
  std1: number;
  std2: number;
}

/** Independent samples t-test (Welch). */
export function computeTTest(
  rows: string[][],
  groupCol: string,
  groupVal1: string,
  groupVal2: string,
  numCol: string
): TTestResult | null {
  const headers = rows[0];
  const gi = headers.indexOf(groupCol);
  const ni = headers.indexOf(numCol);
  if (gi === -1 || ni === -1) return null;
  const dataRows = rows.slice(1);
  const g1 = dataRows.filter((r) => String(r[gi]).trim() === groupVal1).map((r) => toNum(r[ni])).filter((v) => !Number.isNaN(v));
  const g2 = dataRows.filter((r) => String(r[gi]).trim() === groupVal2).map((r) => toNum(r[ni])).filter((v) => !Number.isNaN(v));
  if (g1.length < 2 || g2.length < 2) return null;
  const n1 = g1.length;
  const n2 = g2.length;
  const mean1 = g1.reduce((a, b) => a + b, 0) / n1;
  const mean2 = g2.reduce((a, b) => a + b, 0) / n2;
  const var1 = g1.reduce((a, b) => a + (b - mean1) ** 2, 0) / (n1 - 1) || 0;
  const var2 = g2.reduce((a, b) => a + (b - mean2) ** 2, 0) / (n2 - 1) || 0;
  const std1 = Math.sqrt(var1);
  const std2 = Math.sqrt(var2);
  const se = Math.sqrt(var1 / n1 + var2 / n2);
  if (se === 0) return null;
  const t = (mean1 - mean2) / se;
  const denom = var1 / n1 + var2 / n2;
  const df = denom > 0 ? (denom ** 2) / ((var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1)) : 0;
  const pValue = twoTailedPValue(t, df);
  const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
  const cohenD = pooledStd > 0 ? (mean1 - mean2) / pooledStd : 0;
  return { t, df, pValue, cohenD, mean1, mean2, n1, n2, std1, std2 };
}

/** Two-tailed p-value for t-statistic. */
function twoTailedPValue(t: number, df: number): number {
  const absT = Math.abs(t);
  if (df <= 0) return 1;
  if (df >= 100) return 2 * (1 - normalCDF(absT));
  const x = df / (df + absT * absT);
  return regularizedIncompleteBeta(x, df / 2, 0.5);
}

function normalCDF(z: number): number {
  const a1 = 0.254829592, a2 = -0.284496736, a3 = 1.421413741, a4 = -1.453152027, a5 = 1.061405429;
  const p = 0.3275911;
  const t = 1 / (1 + p * z);
  const y = 1 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-z * z / 2);
  return z >= 0 ? y : 1 - y;
}

function regularizedIncompleteBeta(x: number, a: number, b: number): number {
  if (x <= 0) return 0;
  if (x >= 1) return 1;
  const logBeta = logGamma(a) + logGamma(b) - logGamma(a + b);
  const bt = Math.exp(Math.log(x) * a + Math.log(1 - x) * b - logBeta);
  if (x < (a + 1) / (a + b + 2)) return (bt * betacf(x, a, b)) / a;
  return 1 - (bt * betacf(1 - x, b, a)) / b;
}

function betacf(x: number, a: number, b: number): number {
  const maxIter = 200;
  const epsilon = 3e-7;
  let m = 1;
  let aa: number;
  const qab = a + b;
  const qap = a + 1;
  const qam = a - 1;
  let c = 1;
  let d = 1 - (qab * x) / qap;
  if (Math.abs(d) < 1e-30) d = 1e-30;
  d = 1 / d;
  let h = d;
  for (let i = 1; i <= maxIter; i++) {
    const m2 = 2 * m;
    aa = (m * (b - m) * x) / ((qam + m2) * (a + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    h *= d * c;
    aa = (-(a + m) * (qab + m) * x) / ((a + m2) * (qap + m2));
    d = 1 + aa * d;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    c = 1 + aa / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < epsilon) return h;
    m++;
  }
  return h;
}

function logGamma(z: number): number {
  if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - logGamma(1 - z);
  z -= 1;
  let x = 0.99999999999980993;
  const cof = [
    676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059,
    12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351913114e-7,
  ];
  for (let i = 0; i < 8; i++) x += cof[i] / (z + i + 1);
  return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(z + 7.5) - (z + 7.5) + Math.log(x);
}

export function getDataRows(d: { preview: string[][]; data?: string[][] }): string[][] {
  if (d.data && d.data.length > 0) return d.data;
  return d.preview.length > 0 ? d.preview : [];
}

export function getUniqueValues(rows: string[][], columnName: string): string[] {
  const headers = rows[0] || [];
  const ci = headers.indexOf(columnName);
  if (ci === -1) return [];
  const values = (rows.slice(1) || []).map((r) => String(r[ci] ?? "").trim()).filter((v) => v !== "");
  return [...new Set(values)].sort();
}

export interface ChiSquareResult {
  chi2: number;
  df: number;
  pValue: number;
  table: { row: string; col: string; count: number }[];
  rowLabels: string[];
  colLabels: string[];
}

/** Chi-square test of independence (two categorical variables). */
export function computeChiSquare(rows: string[][], col1: string, col2: string): ChiSquareResult | null {
  const headers = rows[0] || [];
  const i1 = headers.indexOf(col1);
  const i2 = headers.indexOf(col2);
  if (i1 === -1 || i2 === -1) return null;
  const data = rows.slice(1);
  const rVals = [...new Set(data.map((r) => String(r[i1] ?? "").trim()).filter(Boolean))].sort();
  const cVals = [...new Set(data.map((r) => String(r[i2] ?? "").trim()).filter(Boolean))].sort();
  if (rVals.length < 2 || cVals.length < 2) return null;
  const counts: Record<string, Record<string, number>> = {};
  rVals.forEach((r) => { counts[r] = {}; cVals.forEach((c) => { counts[r][c] = 0; }); });
  data.forEach((r) => {
    const rv = String(r[i1] ?? "").trim();
    const cv = String(r[i2] ?? "").trim();
    if (rv && cv && counts[rv] != null) counts[rv][cv] = (counts[rv][cv] || 0) + 1;
  });
  const rowSums = rVals.map((r) => cVals.reduce((s, c) => s + (counts[r]?.[c] ?? 0), 0));
  const colSums = cVals.map((c) => rVals.reduce((s, r) => s + (counts[r]?.[c] ?? 0), 0));
  const total = rowSums.reduce((a, b) => a + b, 0);
  if (total === 0) return null;
  let chi2 = 0;
  rVals.forEach((r, ri) => {
    cVals.forEach((c, ci) => {
      const obs = counts[r]?.[c] ?? 0;
      const exp = (rowSums[ri] * colSums[ci]) / total;
      if (exp > 0) chi2 += (obs - exp) ** 2 / exp;
    });
  });
  const df = (rVals.length - 1) * (cVals.length - 1);
  const pValue = df > 0 ? 1 - chiSquareCDF(chi2, df) : 1;
  const table: { row: string; col: string; count: number }[] = [];
  rVals.forEach((r) => cVals.forEach((c) => table.push({ row: r, col: c, count: counts[r]?.[c] ?? 0 })));
  return { chi2, df, pValue, table, rowLabels: rVals, colLabels: cVals };
}

function chiSquareCDF(x: number, df: number): number {
  if (df <= 0 || x <= 0) return 0;
  if (x > 1000) return 1;
  return regularizedIncompleteGammaP(df / 2, x / 2);
}

function regularizedIncompleteGammaP(a: number, x: number): number {
  if (x < 0 || a <= 0) return 0;
  if (x === 0) return 0;
  return 1 - regularizedIncompleteGammaQ(a, x);
}

function regularizedIncompleteGammaQ(a: number, x: number): number {
  if (x < 0 || a <= 0) return 1;
  if (x === 0) return 1;
  const logGammaA = logGamma(a);
  let b = x + 1 - a;
  let c = 1 / 1e-30;
  let d = 1 / b;
  let h = d;
  for (let n = 1; n <= 200; n++) {
    const an = -n * (n - a);
    b += 2;
    d = an * d + b;
    c = b + an / c;
    if (Math.abs(c) < 1e-30) c = 1e-30;
    if (Math.abs(d) < 1e-30) d = 1e-30;
    d = 1 / d;
    const del = d * c;
    h *= del;
    if (Math.abs(del - 1) < 1e-7) break;
  }
  return Math.exp(-x + a * Math.log(x) - logGammaA) * h;
}

/** Pearson correlation matrix for numeric columns (returns matrix and column names). */
export function computeCorrelationMatrix(rows: string[][]): { matrix: number[][]; columnNames: string[] } | null {
  if (rows.length < 3) return null;
  const headers = rows[0];
  const data = rows.slice(1);
  const numericIndices: number[] = [];
  headers.forEach((_, ci) => {
    const vals = data.map((r) => r[ci]);
    if (vals.every((v) => v === "" || !Number.isNaN(Number(v)))) numericIndices.push(ci);
  });
  if (numericIndices.length < 2) return null;
  const n = data.length;
  const colNames = numericIndices.map((i) => headers[i]);
  const matrix: number[][] = numericIndices.map(() => numericIndices.map(() => 0));
  const means = numericIndices.map((ci) => data.reduce((s, r) => s + Number(r[ci]) || 0, 0) / n);
  const stds = numericIndices.map((ci) => Math.sqrt(data.reduce((s, r) => s + (Number(r[ci]) - means[numericIndices.indexOf(ci)]) ** 2, 0) / n) || 1);
  for (let i = 0; i < numericIndices.length; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < numericIndices.length; j++) {
      const ci = numericIndices[i];
      const cj = numericIndices[j];
      let sum = 0;
      for (let k = 0; k < n; k++) {
        const vi = (Number(data[k][ci]) - means[i]) / stds[i];
        const vj = (Number(data[k][cj]) - means[j]) / stds[j];
        sum += vi * vj;
      }
      const r = sum / n;
      matrix[i][j] = r;
      matrix[j][i] = r;
    }
  }
  return { matrix, columnNames: colNames };
}

export { MAX_ROWS_STORED };
