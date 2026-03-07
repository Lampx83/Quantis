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

/** Parse TSV text (tab-separated). Handles quoted fields. */
export function parseTSV(text: string): string[][] {
  const lines = text.split(/\r?\n/);
  const result: string[][] = [];
  for (const line of lines) {
    if (line.trim() === "") continue;
    const row: string[] = [];
    let field = "";
    let inQuotes = false;
    for (let i = 0; i < line.length; i++) {
      const c = line[i];
      if (c === '"') {
        inQuotes = !inQuotes;
      } else if (inQuotes) {
        field += c;
      } else if (c === "\t") {
        row.push(field.trim());
        field = "";
      } else {
        field += c;
      }
    }
    row.push(field.trim());
    result.push(row);
  }
  return result;
}

/** Parse JSON (array of objects) thành bảng string[][]. Cột = keys của object đầu. Cũng chấp nhận object có một key là mảng. */
export function parseJSONToRows(text: string): string[][] {
  const raw = JSON.parse(text);
  let arr: unknown[] = [];
  if (Array.isArray(raw)) arr = raw;
  else if (raw !== null && typeof raw === "object" && !Array.isArray(raw)) {
    const firstKey = Object.keys(raw).find((k) => Array.isArray((raw as Record<string, unknown>)[k]));
    if (firstKey) arr = (raw as Record<string, unknown>)[firstKey] as unknown[];
  }
  if (arr.length === 0) return [];
  const first = arr[0];
  if (first === null || typeof first !== "object" || Array.isArray(first)) return [];
  const headers = Object.keys(first);
  const rows: string[][] = [headers];
  for (const obj of arr) {
    if (obj === null || typeof obj !== "object") continue;
    rows.push(headers.map((h) => (obj as Record<string, unknown>)[h] != null ? String((obj as Record<string, unknown>)[h]) : ""));
  }
  return rows;
}

/** Đoán định dạng từ tên file. */
export function getFormatFromFilename(filename: string): "csv" | "tsv" | "json" | "txt" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".tsv")) return "tsv";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".txt")) return "txt";
  return "csv";
}

/** Parse nội dung file theo định dạng, trả về rows và format. */
export function parseFileContent(text: string, filename: string): { rows: string[][]; format: string } {
  const ext = getFormatFromFilename(filename);
  if (ext === "json") {
    const rows = parseJSONToRows(text);
    return { rows, format: "json" };
  }
  if (ext === "tsv") {
    const rows = parseTSV(text);
    return { rows, format: "tsv" };
  }
  if (ext === "txt") {
    const firstLine = text.split(/\r?\n/)[0] || "";
    const tabCount = (firstLine.match(/\t/g) || []).length;
    const commaCount = (firstLine.match(/,/g) || []).length;
    const rows = tabCount >= commaCount ? parseTSV(text) : parseCSV(text);
    return { rows, format: tabCount >= commaCount ? "tsv" : "csv" };
  }
  const rows = parseCSV(text);
  return { rows, format: "csv" };
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
  if (!rows || !Array.isArray(rows) || rows.length === 0) return [];
  const headers = rows[0];
  if (!headers || !Array.isArray(headers)) return [];
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
  q10?: number;
  q90?: number;
  kurtosis?: number;
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
      const variance = nums.reduce((a, b) => a + (b - mean) ** 2, 0) / n;
      row.std = Math.sqrt(variance);
      row.min = Math.min(...nums);
      row.max = Math.max(...nums);
      row.q25 = sorted[Math.floor(n * 0.25)];
      row.q75 = sorted[Math.floor(n * 0.75)];
      row.q10 = sorted[Math.floor(n * 0.1)];
      row.q90 = sorted[Math.floor(n * 0.9)];
      if (n >= 4 && variance > 0) {
        const m4 = nums.reduce((s, v) => s + (v - mean) ** 4, 0) / n;
        row.kurtosis = m4 / (variance ** 2) - 3;
      }
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

/** Paired t-test (2 cột số tương ứng từng cặp — trước/sau, điều kiện A/B). */
export interface PairedTTestResult {
  t: number;
  df: number;
  pValue: number;
  cohenD: number;
  meanDiff: number;
  stdDiff: number;
  n: number;
  mean1: number;
  mean2: number;
}

export function computePairedTTest(rows: string[][], col1: string, col2: string): PairedTTestResult | null {
  const headers = rows[0] || [];
  const i1 = headers.indexOf(col1);
  const i2 = headers.indexOf(col2);
  if (i1 === -1 || i2 === -1) return null;
  const data = rows.slice(1);
  const pairs: [number, number][] = [];
  data.forEach((r) => {
    const a = Number(r[i1]);
    const b = Number(r[i2]);
    if (!Number.isNaN(a) && !Number.isNaN(b)) pairs.push([a, b]);
  });
  if (pairs.length < 2) return null;
  const n = pairs.length;
  const d = pairs.map(([a, b]) => a - b);
  const meanDiff = d.reduce((s, v) => s + v, 0) / n;
  const variance = d.reduce((s, v) => s + (v - meanDiff) ** 2, 0) / (n - 1) || 0;
  const stdDiff = Math.sqrt(variance);
  const se = stdDiff / Math.sqrt(n);
  if (se === 0) return null;
  const t = meanDiff / se;
  const df = n - 1;
  const pValue = twoTailedPValue(t, df);
  const cohenD = stdDiff > 0 ? meanDiff / stdDiff : 0;
  const mean1 = pairs.reduce((s, [a]) => s + a, 0) / n;
  const mean2 = pairs.reduce((s, [, b]) => s + b, 0) / n;
  return { t, df, pValue, cohenD, meanDiff, stdDiff, n, mean1, mean2 };
}

/** Wilcoxon signed-rank test (phi tham số cho dữ liệu cặp). */
export interface WilcoxonSignedRankResult {
  w: number;
  z: number;
  pValue: number;
  n: number;
  medianDiff: number;
}

export function computeWilcoxonSignedRank(rows: string[][], col1: string, col2: string): WilcoxonSignedRankResult | null {
  const headers = rows[0] || [];
  const i1 = headers.indexOf(col1);
  const i2 = headers.indexOf(col2);
  if (i1 === -1 || i2 === -1) return null;
  const data = rows.slice(1);
  const diffs: number[] = [];
  data.forEach((r) => {
    const a = Number(r[i1]);
    const b = Number(r[i2]);
    if (!Number.isNaN(a) && !Number.isNaN(b)) diffs.push(a - b);
  });
  const nonZero = diffs.filter((d) => d !== 0);
  if (nonZero.length < 2) return null;
  const n = nonZero.length;
  const absD = nonZero.map((d) => Math.abs(d));
  const sorted = absD.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks: number[] = new Array(n);
  let r = 0;
  while (r < sorted.length) {
    let end = r;
    while (end < sorted.length && sorted[end].v === sorted[r].v) end++;
    const avgRank = (r + 1 + end) / 2;
    for (let t = r; t < end; t++) ranks[sorted[t].i] = avgRank;
    r = end;
  }
  let wPlus = 0;
  for (let i = 0; i < n; i++) if (nonZero[i] > 0) wPlus += ranks[i];
  const wMinus = (n * (n + 1)) / 2 - wPlus;
  const w = Math.min(wPlus, wMinus);
  const meanW = (n * (n + 1)) / 4;
  const stdW = Math.sqrt((n * (n + 1) * (2 * n + 1)) / 24);
  const z = stdW > 0 ? (w - meanW) / stdW : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  const sortedD = [...nonZero].sort((a, b) => a - b);
  const medianDiff = n % 2 ? sortedD[(n - 1) / 2] : (sortedD[n / 2 - 1] + sortedD[n / 2]) / 2;
  return { w, z, pValue, n, medianDiff };
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

export function getDataRows(d: { preview?: string[][]; data?: string[][] } | null | undefined): string[][] {
  if (!d) return [];
  if (d.data && Array.isArray(d.data) && d.data.length > 0) return d.data;
  if (d.preview && Array.isArray(d.preview) && d.preview.length > 0) return d.preview;
  return [];
}

export function getUniqueValues(rows: string[][], columnName: string): string[] {
  const headers = rows[0] || [];
  const ci = headers.indexOf(columnName);
  if (ci === -1) return [];
  const values = (rows.slice(1) || []).map((r) => String(r[ci] ?? "").trim()).filter((v) => v !== "");
  return [...new Set(values)].sort();
}

/** Giá trị mode (xuất hiện nhiều nhất) của một cột — dùng cho fill missing categorical. */
export function getColumnMode(rows: string[][], columnName: string): string {
  const headers = rows[0] || [];
  const ci = headers.indexOf(columnName);
  if (ci === -1) return "";
  const values = (rows.slice(1) || []).map((r) => String(r[ci] ?? "").trim()).filter((v) => v !== "");
  if (values.length === 0) return "";
  const counts: Record<string, number> = {};
  values.forEach((v) => { counts[v] = (counts[v] || 0) + 1; });
  let maxCount = 0;
  let mode = "";
  Object.entries(counts).forEach(([val, c]) => {
    if (c > maxCount) { maxCount = c; mode = val; }
  });
  return mode;
}

/** Bảng chéo 2 chiều (chỉ tần số, không kiểm định). */
export function getCrosstab(rows: string[][], col1: string, col2: string): { rowLabels: string[]; colLabels: string[]; counts: number[][] } | null {
  const headers = rows[0] || [];
  const i1 = headers.indexOf(col1);
  const i2 = headers.indexOf(col2);
  if (i1 === -1 || i2 === -1) return null;
  const data = rows.slice(1);
  const rVals = [...new Set(data.map((r) => String(r[i1] ?? "").trim()).filter(Boolean))].sort();
  const cVals = [...new Set(data.map((r) => String(r[i2] ?? "").trim()).filter(Boolean))].sort();
  const counts: Record<string, Record<string, number>> = {};
  rVals.forEach((r) => { counts[r] = {}; cVals.forEach((c) => { counts[r][c] = 0; }); });
  data.forEach((r) => {
    const rv = String(r[i1] ?? "").trim();
    const cv = String(r[i2] ?? "").trim();
    if (rv && cv && counts[rv] != null) counts[rv][cv] = (counts[rv][cv] || 0) + 1;
  });
  const matrix = rVals.map((r) => cVals.map((c) => counts[r]?.[c] ?? 0));
  return { rowLabels: rVals, colLabels: cVals, counts: matrix };
}

export interface ChiSquareResult {
  chi2: number;
  df: number;
  pValue: number;
  phi?: number;
  cramersV?: number;
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
  const n = total;
  const phi = (rVals.length === 2 && cVals.length === 2) ? Math.sqrt(chi2 / n) : undefined;
  const cramersV = Math.sqrt(chi2 / (n * Math.min(rVals.length - 1, cVals.length - 1)));
  const table: { row: string; col: string; count: number }[] = [];
  rVals.forEach((r) => cVals.forEach((c) => table.push({ row: r, col: c, count: counts[r]?.[c] ?? 0 })));
  return { chi2, df, pValue, phi, cramersV, table, rowLabels: rVals, colLabels: cVals };
}

/** Fisher's exact test (bảng 2×2). Dùng khi kỳ vọng ô nhỏ; SPSS/R fisher.test / scipy.stats.fisher_exact. */
export interface FisherExactResult {
  pValueTwoTailed: number;
  pValueOneTailed?: number;
  a: number;
  b: number;
  c: number;
  d: number;
  n: number;
}

function logFactorial(n: number): number {
  return n <= 1 ? 0 : logGamma(n + 1);
}

export function computeFisherExact(a: number, b: number, c: number, d: number): FisherExactResult | null {
  const n = a + b + c + d;
  if (n <= 0 || [a, b, c, d].some((x) => x < 0)) return null;
  const row1 = a + b, row2 = c + d, col1 = a + c, col2 = b + d;
  const logPObs = logFactorial(row1) + logFactorial(row2) + logFactorial(col1) + logFactorial(col2) - logFactorial(n) - logFactorial(a) - logFactorial(b) - logFactorial(c) - logFactorial(d);
  const pObs = Math.exp(logPObs);
  let sumLeft = 0, sumRight = 0;
  const aMin = Math.max(0, row1 - col2);
  const aMax = Math.min(row1, col1);
  for (let ai = aMin; ai <= aMax; ai++) {
    const bi = row1 - ai, ci = col1 - ai, di = col2 - bi;
    if (bi < 0 || ci < 0 || di < 0) continue;
    const logP = logFactorial(row1) + logFactorial(row2) + logFactorial(col1) + logFactorial(col2) - logFactorial(n) - logFactorial(ai) - logFactorial(bi) - logFactorial(ci) - logFactorial(di);
    const p = Math.exp(logP);
    if (p <= pObs + 1e-15) sumLeft += p;
    if (p <= pObs + 1e-15) sumRight += p;
  }
  const pTwoTailed = Math.min(1, sumLeft);
  return { pValueTwoTailed: pTwoTailed, a, b, c, d, n };
}

/** Odds ratio (OR) cho bảng 2×2: OR = (a*d)/(b*c). CI 95% qua log(OR) ± 1.96*SE. SPSS/R/Python: exp(log(OR)), SE = sqrt(1/a+1/b+1/c+1/d). */
export interface OddsRatioResult {
  or: number;
  logOr: number;
  seLogOr: number;
  ci95Lower: number;
  ci95Upper: number;
  a: number;
  b: number;
  c: number;
  d: number;
}

export function computeOddsRatio(a: number, b: number, c: number, d: number): OddsRatioResult | null {
  let aa = a, bb = b, cc = c, dd = d;
  if ([aa, bb, cc, dd].some((x) => x === 0)) { aa += 0.5; bb += 0.5; cc += 0.5; dd += 0.5; }
  const or = (aa * dd) / (bb * cc);
  if (!Number.isFinite(or) || or <= 0) return null;
  const logOr = Math.log(or);
  const seLogOr = Math.sqrt(1 / aa + 1 / bb + 1 / cc + 1 / dd);
  const z = 1.96;
  const ci95Lower = Math.exp(logOr - z * seLogOr);
  const ci95Upper = Math.exp(logOr + z * seLogOr);
  return { or, logOr, seLogOr, ci95Lower, ci95Upper, a, b, c, d };
}

/** One-sample t-test: so sánh trung bình mẫu với giá trị hằng mu0. R: t.test(x, mu=); Python: scipy.stats.ttest_1samp. */
export interface OneSampleTTestResult {
  t: number;
  df: number;
  pValue: number;
  mean: number;
  std: number;
  n: number;
  mu0: number;
}

export function computeOneSampleTTest(values: number[], mu0: number): OneSampleTTestResult | null {
  if (values.length < 2) return null;
  const n = values.length;
  const mean = values.reduce((a, b) => a + b, 0) / n;
  const variance = values.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) || 0;
  const std = Math.sqrt(variance);
  const se = std / Math.sqrt(n);
  if (se === 0) return null;
  const t = (mean - mu0) / se;
  const df = n - 1;
  const pValue = twoTailedPValue(t, df);
  return { t, df, pValue, mean, std, n, mu0 };
}

/** Binomial test: kiểm định tỉ lệ một mẫu (H0: p = p0). R: binom.test; Python: scipy.stats.binom_test. */
export interface BinomialTestResult {
  pValueTwoTailed: number;
  proportion: number;
  n: number;
  successes: number;
  p0: number;
  ci95Lower: number;
  ci95Upper: number;
}

export function computeBinomialTest(successes: number, n: number, p0: number): BinomialTestResult | null {
  if (n < 1 || successes < 0 || successes > n || p0 <= 0 || p0 >= 1) return null;
  const prop = successes / n;
  const pLeft = regularizedIncompleteBeta(1 - p0, n - successes, successes + 1);
  const pRight = 1 - regularizedIncompleteBeta(1 - p0, n - successes + 1, successes);
  const pTwoTailed = Math.min(1, 2 * Math.min(pLeft, pRight));
  const z = 1.96;
  const denom = 1 + z * z / n;
  const center = (successes + z * z / 2) / n;
  const margin = (z / n) * Math.sqrt((successes * (n - successes)) / n + z * z / 4);
  const ci95Lower = (center - margin) / denom;
  const ci95Upper = (center + margin) / denom;
  return { pValueTwoTailed: pTwoTailed, proportion: prop, n, successes, p0, ci95Lower: Math.max(0, ci95Lower), ci95Upper: Math.min(1, ci95Upper) };
}

/** Z-test so sánh hai tỉ lệ độc lập (two-proportion z-test). R: prop.test; Python: proportions_ztest. */
export interface TwoProportionZTestResult {
  z: number;
  pValue: number;
  p1: number;
  p2: number;
  n1: number;
  n2: number;
  success1: number;
  success2: number;
  diff: number;
  ci95Lower: number;
  ci95Upper: number;
}

export function computeTwoProportionZTest(success1: number, n1: number, success2: number, n2: number): TwoProportionZTestResult | null {
  if (n1 < 1 || n2 < 1 || success1 < 0 || success1 > n1 || success2 < 0 || success2 > n2) return null;
  const p1 = success1 / n1;
  const p2 = success2 / n2;
  const pooled = (success1 + success2) / (n1 + n2);
  const sePooled = Math.sqrt(pooled * (1 - pooled) * (1 / n1 + 1 / n2));
  if (sePooled === 0) return null;
  const z = (p1 - p2) / sePooled;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  const seUnpooled = Math.sqrt((p1 * (1 - p1)) / n1 + (p2 * (1 - p2)) / n2);
  const zCrit = 1.96;
  const margin = zCrit * (seUnpooled || 0);
  const diff = p1 - p2;
  return { z, pValue, p1, p2, n1, n2, success1, success2, diff, ci95Lower: diff - margin, ci95Upper: diff + margin };
}

/** Khoảng tin cậy 95% cho hệ số tương quan Pearson r (Fisher z). R: cor.test; Python: pingouin. */
export function computeCorrelationCI(r: number, n: number, confidence: number = 0.95): { r: number; ciLower: number; ciUpper: number; n: number } | null {
  if (n < 4 || Math.abs(r) >= 1) return null;
  const zCrit = confidence === 0.95 ? 1.96 : confidence === 0.99 ? 2.576 : 1.96;
  const fisherZ = 0.5 * Math.log((1 + r) / (1 - r));
  const seZ = 1 / Math.sqrt(n - 3);
  const zL = fisherZ - zCrit * seZ;
  const zU = fisherZ + zCrit * seZ;
  const toR = (z: number) => (Math.exp(2 * z) - 1) / (Math.exp(2 * z) + 1);
  return { r, ciLower: toR(zL), ciUpper: toR(zU), n };
}

/** Sign test (dữ liệu cặp): đếm dương/âm, kiểm định tỉ lệ = 0.5 (phi tham số). R: binom.test; tương đương Wilcoxon khi chỉ dùng dấu. */
export interface SignTestResult {
  positiveCount: number;
  negativeCount: number;
  n: number;
  pValueTwoTailed: number;
  proportionPositive: number;
}

export function computeSignTest(rows: string[][], col1: string, col2: string): SignTestResult | null {
  const headers = rows[0] || [];
  const i1 = headers.indexOf(col1);
  const i2 = headers.indexOf(col2);
  if (i1 === -1 || i2 === -1) return null;
  const data = rows.slice(1);
  let pos = 0, neg = 0;
  data.forEach((r) => {
    const a = Number(r[i1]);
    const b = Number(r[i2]);
    if (Number.isNaN(a) || Number.isNaN(b)) return;
    const d = a - b;
    if (d > 0) pos++;
    else if (d < 0) neg++;
  });
  const n = pos + neg;
  if (n < 1) return null;
  const bin = computeBinomialTest(pos, n, 0.5);
  if (!bin) return null;
  return { positiveCount: pos, negativeCount: neg, n, pValueTwoTailed: bin.pValueTwoTailed, proportionPositive: pos / n };
}

/** McNemar test (paired binary: cùng đối tượng, 2 thời điểm). Hai cột nhị phân (2 giá trị). */
export interface McNemarResult {
  chi2: number;
  pValue: number;
  nDiscordant: number;
  b: number;
  c: number;
}

export function computeMcNemar(rows: string[][], col1: string, col2: string): McNemarResult | null {
  const headers = rows[0] || [];
  const i1 = headers.indexOf(col1);
  const i2 = headers.indexOf(col2);
  if (i1 === -1 || i2 === -1) return null;
  const data = rows.slice(1);
  const v1 = [...new Set(data.map((r) => String(r[i1]).trim()).filter(Boolean))].sort();
  const v2 = [...new Set(data.map((r) => String(r[i2]).trim()).filter(Boolean))].sort();
  if (v1.length !== 2 || v2.length !== 2) return null;
  let b = 0, c = 0;
  data.forEach((r) => {
    const a1 = String(r[i1]).trim();
    const a2 = String(r[i2]).trim();
    if (a1 === "" || a2 === "") return;
    if (a1 === v1[0] && a2 === v2[1]) b++;
    else if (a1 === v1[1] && a2 === v2[0]) c++;
  });
  const nDiscordant = b + c;
  if (nDiscordant === 0) return null;
  const chi2 = (b - c) ** 2 / nDiscordant;
  const pValue = 1 - chiSquareCDF(chi2, 1);
  return { chi2, pValue, nDiscordant, b, c };
}

/** Kết quả Mann-Whitney U (hai mẫu độc lập, không giả định phân phối chuẩn). */
export interface MannWhitneyResult {
  u: number;
  z: number;
  pValue: number;
  n1: number;
  n2: number;
  median1: number;
  median2: number;
  rankSum1: number;
}

/** Mann-Whitney U test (non-parametric thay thế t-test khi dữ liệu không chuẩn). */
export function computeMannWhitneyU(
  rows: string[][],
  groupCol: string,
  groupVal1: string,
  groupVal2: string,
  numCol: string
): MannWhitneyResult | null {
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
  const all = g1.map((v) => ({ v, g: 1 })).concat(g2.map((v) => ({ v, g: 2 })));
  all.sort((a, b) => a.v - b.v);
  const ranks: number[] = [];
  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j < all.length && all[j].v === all[i].v) j++;
    const tieCount = j - i;
    const avgRank = (2 * (i + 1) + tieCount - 1) / 2;
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    i = j;
  }
  let rankSum1 = 0;
  for (let k = 0; k < all.length; k++) if (all[k].g === 1) rankSum1 += ranks[k];
  const u1 = n1 * n2 + (n1 * (n1 + 1)) / 2 - rankSum1;
  const u2 = n1 * n2 - u1;
  const u = Math.min(u1, u2);
  const meanU = (n1 * n2) / 2;
  const tieFactor = 1;
  const stdU = Math.sqrt((n1 * n2 * (n1 + n2 + 1)) / 12) * tieFactor;
  const z = stdU > 0 ? (u - meanU) / stdU : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  const med = (arr: number[]) => {
    const s = [...arr].sort((a, b) => a - b);
    const m = Math.floor(s.length / 2);
    return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2;
  };
  return { u, z, pValue, n1, n2, median1: med(g1), median2: med(g2), rankSum1 };
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
export function computeCorrelationMatrix(rows: string[][], method: "pearson" | "spearman" | "kendall" = "pearson"): { matrix: number[][]; columnNames: string[] } | null {
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

  const rank = (arr: number[]): number[] => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const out: number[] = new Array(arr.length);
    let r = 0;
    while (r < sorted.length) {
      let end = r;
      while (end < sorted.length && sorted[end].v === sorted[r].v) end++;
      const avgRank = (r + 1 + end) / 2;
      for (let t = r; t < end; t++) out[sorted[t].i] = avgRank;
      r = end;
    }
    return out;
  };

  const kendallTau = (x: number[], y: number[]): number => {
    const nn = x.length;
    const tx: Record<number, number> = {};
    const ty: Record<number, number> = {};
    for (let i = 0; i < nn; i++) {
      tx[x[i]] = (tx[x[i]] || 0) + 1;
      ty[y[i]] = (ty[y[i]] || 0) + 1;
    }
    let n1 = 0, n2 = 0;
    Object.values(tx).forEach((t) => { n1 += (t * (t - 1)) / 2; });
    Object.values(ty).forEach((t) => { n2 += (t * (t - 1)) / 2; });
    const n0 = (nn * (nn - 1)) / 2;
    let C = 0, D = 0;
    for (let i = 0; i < nn; i++) {
      for (let j = i + 1; j < nn; j++) {
        const prod = (x[i] - x[j]) * (y[i] - y[j]);
        if (prod > 0) C++;
        else if (prod < 0) D++;
      }
    }
    const denom = Math.sqrt((n0 - n1) * (n0 - n2));
    if (denom <= 0) return 0;
    return (C - D) / denom;
  };

  for (let i = 0; i < numericIndices.length; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < numericIndices.length; j++) {
      const ci = numericIndices[i];
      const cj = numericIndices[j];
      const pairs: [number, number][] = [];
      data.forEach((r) => {
        const a = Number(r[ci]);
        const b = Number(r[cj]);
        if (!Number.isNaN(a) && !Number.isNaN(b)) pairs.push([a, b]);
      });
      if (pairs.length < 2) continue;
      let xi = pairs.map((p) => p[0]);
      let xj = pairs.map((p) => p[1]);
      if (method === "kendall") {
        const tau = kendallTau(xi, xj);
        matrix[i][j] = tau;
        matrix[j][i] = tau;
      } else {
        if (method === "spearman") {
          xi = rank(xi);
          xj = rank(xj);
        }
        const nP = xi.length;
        const meanI = xi.reduce((a, b) => a + b, 0) / nP;
        const meanJ = xj.reduce((a, b) => a + b, 0) / nP;
        const stdI = Math.sqrt(xi.reduce((s, v) => s + (v - meanI) ** 2, 0) / nP) || 1;
        const stdJ = Math.sqrt(xj.reduce((s, v) => s + (v - meanJ) ** 2, 0) / nP) || 1;
        let sum = 0;
        for (let k = 0; k < nP; k++) sum += ((xi[k] - meanI) / stdI) * ((xj[k] - meanJ) / stdJ);
        const rVal = sum / nP;
        matrix[i][j] = rVal;
        matrix[j][i] = rVal;
      }
    }
  }
  return { matrix, columnNames: colNames };
}

/** Tương quan từng phần: r(col1, col2 | controlCols). 1 biến kiểm soát: công thức; nhiều: hồi quy lấy phần dư rồi tương quan. */
export function computePartialCorrelation(rows: string[][], col1: string, col2: string, controlCols: string[]): { r: number; n: number } | null {
  if (rows.length < 4) return null;
  const headers = rows[0] || [];
  const data = rows.slice(1);
  const i1 = headers.indexOf(col1);
  const i2 = headers.indexOf(col2);
  if (i1 === -1 || i2 === -1) return null;
  const controlIndices = controlCols.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
  const validRows = data.filter((r) => {
    const v1 = Number(r[i1]);
    const v2 = Number(r[i2]);
    if (Number.isNaN(v1) || Number.isNaN(v2)) return false;
    return controlIndices.every((ci) => r[ci] !== "" && !Number.isNaN(Number(r[ci])));
  });
  if (validRows.length < 3) return null;
  if (controlCols.length === 0) {
    const x = validRows.map((r) => Number(r[i1]));
    const y = validRows.map((r) => Number(r[i2]));
    const n = x.length;
    const mx = x.reduce((a, b) => a + b, 0) / n;
    const my = y.reduce((a, b) => a + b, 0) / n;
    const sx = Math.sqrt(x.reduce((s, v) => s + (v - mx) ** 2, 0) / n) || 1;
    const sy = Math.sqrt(y.reduce((s, v) => s + (v - my) ** 2, 0) / n) || 1;
    const rVal = x.reduce((s, v, i) => s + ((v - mx) / sx) * ((y[i] - my) / sy), 0) / n;
    return { r: rVal, n };
  }
  if (controlIndices.length === 1) {
    const ic = controlIndices[0];
    const x = validRows.map((r) => Number(r[i1]));
    const y = validRows.map((r) => Number(r[i2]));
    const z = validRows.map((r) => Number(r[ic]));
    const n = x.length;
    const corr = (a: number[], b: number[]) => {
      const ma = a.reduce((s, v) => s + v, 0) / n;
      const mb = b.reduce((s, v) => s + v, 0) / n;
      const sa = Math.sqrt(a.reduce((s, v) => s + (v - ma) ** 2, 0) / n) || 1;
      const sb = Math.sqrt(b.reduce((s, v) => s + (v - mb) ** 2, 0) / n) || 1;
      return a.reduce((s, v, i) => s + ((v - ma) / sa) * ((b[i] - mb) / sb), 0) / n;
    };
    const r12 = corr(x, y);
    const r13 = corr(x, z);
    const r23 = corr(y, z);
    const denom = Math.sqrt((1 - r13 * r13) * (1 - r23 * r23));
    if (denom < 1e-10) return null;
    const r = (r12 - r13 * r23) / denom;
    return { r, n };
  }
  const olsResiduals = (yCol: string, xCols: string[]): number[] | null => {
    const res = computeOLS(rows, yCol, xCols);
    if (!res) return null;
    const yIdx = headers.indexOf(yCol);
    const xIdxs = xCols.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
    if (yIdx === -1 || xIdxs.length !== xCols.length) return null;
    return validRows.map((r) => {
      let pred = res.intercept;
      xCols.forEach((c, i) => { pred += (res.coefficients[c] ?? 0) * Number(r[xIdxs[i]]); });
      return Number(r[yIdx]) - pred;
    });
  };
  const res1 = olsResiduals(col1, controlCols);
  const res2 = olsResiduals(col2, controlCols);
  if (!res1 || !res2) return null;
  const n = res1.length;
  const m1 = res1.reduce((a, b) => a + b, 0) / n;
  const m2 = res2.reduce((a, b) => a + b, 0) / n;
  const s1 = Math.sqrt(res1.reduce((s, v) => s + (v - m1) ** 2, 0) / n) || 1;
  const s2 = Math.sqrt(res2.reduce((s, v) => s + (v - m2) ** 2, 0) / n) || 1;
  const rVal = res1.reduce((s, v, i) => s + ((v - m1) / s1) * ((res2[i] - m2) / s2), 0) / n;
  return { r: rVal, n };
}

/** Bootstrap 95% CI cho trung bình (lấy mẫu có hoàn lại). */
export function computeBootstrapMeanCI(values: number[], nBootstrap: number = 2000, confidence: number = 0.95): { mean: number; ciLower: number; ciUpper: number; n: number } | null {
  if (values.length < 2 || nBootstrap < 10) return null;
  const n = values.length;
  const means: number[] = [];
  for (let b = 0; b < nBootstrap; b++) {
    let sum = 0;
    for (let i = 0; i < n; i++) sum += values[Math.floor(Math.random() * n)];
    means.push(sum / n);
  }
  means.sort((a, b) => a - b);
  const alpha = (1 - confidence) / 2;
  const lo = Math.floor(nBootstrap * alpha);
  const hi = Math.ceil(nBootstrap * (1 - alpha));
  const mean = values.reduce((a, b) => a + b, 0) / n;
  return { mean, ciLower: means[lo] ?? mean, ciUpper: means[hi] ?? mean, n };
}

/** One-way ANOVA result. */
export interface ANOVAResult {
  f: number;
  dfBetween: number;
  dfWithin: number;
  dfTotal: number;
  ssBetween: number;
  ssWithin: number;
  ssTotal: number;
  msBetween: number;
  msWithin: number;
  pValue: number;
  etaSq: number;
  omegaSq?: number;
  groupMeans: { group: string; n: number; mean: number; std: number }[];
}

/** One-way ANOVA (fixed effects). */
export function computeOneWayANOVA(rows: string[][], factorCol: string, valueCol: string): ANOVAResult | null {
  const headers = rows[0] || [];
  const fi = headers.indexOf(factorCol);
  const vi = headers.indexOf(valueCol);
  if (fi === -1 || vi === -1) return null;
  const data = rows.slice(1);
  const groups: Record<string, number[]> = {};
  data.forEach((r) => {
    const g = String(r[fi] ?? "").trim();
    const v = Number(r[vi]);
    if (g === "" || Number.isNaN(v)) return;
    if (!groups[g]) groups[g] = [];
    groups[g].push(v);
  });
  const groupNames = Object.keys(groups).sort();
  if (groupNames.length < 2) return null;
  const allValues: number[] = [];
  groupNames.forEach((g) => allValues.push(...groups[g]));
  const N = allValues.length;
  const grandMean = allValues.reduce((a, b) => a + b, 0) / N;
  const k = groupNames.length;
  let ssBetween = 0;
  const groupMeans: { group: string; n: number; mean: number; std: number }[] = [];
  groupNames.forEach((g) => {
    const vals = groups[g];
    const n = vals.length;
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) || 0;
    groupMeans.push({ group: g, n, mean, std: Math.sqrt(variance) });
    ssBetween += n * (mean - grandMean) ** 2;
  });
  let ssWithin = 0;
  groupNames.forEach((g) => {
    const vals = groups[g];
    const mean = groupMeans.find((m) => m.group === g)!.mean;
    ssWithin += vals.reduce((s, v) => s + (v - mean) ** 2, 0);
  });
  const ssTotal = ssBetween + ssWithin;
  const dfBetween = k - 1;
  const dfWithin = N - k;
  const msBetween = dfBetween > 0 ? ssBetween / dfBetween : 0;
  const msWithin = dfWithin > 0 ? ssWithin / dfWithin : 0;
  const f = msWithin > 0 ? msBetween / msWithin : 0;
  const pValue = dfWithin > 0 && dfBetween > 0 ? 1 - fCDF(f, dfBetween, dfWithin) : 1;
  const etaSq = ssTotal > 0 ? ssBetween / ssTotal : 0;
  const omegaSq = (ssTotal + msWithin) > 0 ? (ssBetween - dfBetween * msWithin) / (ssTotal + msWithin) : 0;
  return { f, dfBetween, dfWithin, dfTotal: N - 1, ssBetween, ssWithin, ssTotal, msBetween, msWithin, pValue, etaSq, omegaSq: Math.max(0, omegaSq), groupMeans };
}

/** Post-hoc pairwise comparisons từ group means (Welch t, Bonferroni). */
export function pairwisePostHoc(groupMeans: { group: string; n: number; mean: number; std: number }[]): { group1: string; group2: string; meanDiff: number; t: number; df: number; p: number; pBonferroni: number }[] {
  const pairs: { group1: string; group2: string; meanDiff: number; t: number; df: number; p: number; pBonferroni: number }[] = [];
  const k = groupMeans.length;
  const nPairs = (k * (k - 1)) / 2;
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const m1 = groupMeans[i];
      const m2 = groupMeans[j];
      const var1 = m1.std * m1.std;
      const var2 = m2.std * m2.std;
      const n1 = m1.n;
      const n2 = m2.n;
      const se = Math.sqrt(var1 / n1 + var2 / n2);
      if (se === 0) continue;
      const t = (m1.mean - m2.mean) / se;
      const denom = var1 / n1 + var2 / n2;
      const df = denom > 0 ? (denom ** 2) / ((var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1)) : 0;
      const p = twoTailedPValue(t, df);
      pairs.push({
        group1: m1.group,
        group2: m2.group,
        meanDiff: m1.mean - m2.mean,
        t,
        df,
        p,
        pBonferroni: Math.min(1, p * nPairs),
      });
    }
  }
  return pairs;
}

/** Kruskal-Wallis H (non-parametric one-way ANOVA): so sánh 3+ nhóm độc lập. */
export function computeKruskalWallis(rows: string[][], factorCol: string, valueCol: string): { h: number; pValue: number; df: number; nGroups: number; groupMedians: { group: string; n: number; median: number; mean: number; std: number }[] } | null {
  const headers = rows[0] || [];
  const fi = headers.indexOf(factorCol);
  const vi = headers.indexOf(valueCol);
  if (fi === -1 || vi === -1) return null;
  const data = rows.slice(1);
  const groups: Record<string, number[]> = {};
  data.forEach((r) => {
    const g = String(r[fi] ?? "").trim();
    const v = Number(r[vi]);
    if (g === "" || Number.isNaN(v)) return;
    if (!groups[g]) groups[g] = [];
    groups[g].push(v);
  });
  const groupNames = Object.keys(groups).sort();
  const k = groupNames.length;
  if (k < 2) return null;
  const allValues: number[] = [];
  groupNames.forEach((name) => allValues.push(...groups[name]));
  const N = allValues.length;
  const rank = (arr: number[]): number[] => {
    const sorted = arr.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
    const out: number[] = new Array(arr.length);
    let r = 0;
    while (r < sorted.length) {
      let end = r;
      while (end < sorted.length && sorted[end].v === sorted[r].v) end++;
      const avgRank = (r + 1 + end) / 2;
      for (let t = r; t < end; t++) out[sorted[t].i] = avgRank;
      r = end;
    }
    return out;
  };
  const ranks = rank(allValues);
  let idx = 0;
  let sumTerm = 0;
  const groupMedians: { group: string; n: number; median: number; mean: number; std: number }[] = [];
  groupNames.forEach((name) => {
    const vals = groups[name];
    const n = vals.length;
    const start = idx;
    let Rj = 0;
    for (let i = 0; i < n; i++) Rj += ranks[start + i];
    idx += n;
    sumTerm += (Rj * Rj) / n;
    const sorted = [...vals].sort((a, b) => a - b);
    const med = n % 2 ? sorted[(n - 1) / 2] : (sorted[n / 2 - 1] + sorted[n / 2]) / 2;
    const mean = vals.reduce((a, b) => a + b, 0) / n;
    const variance = vals.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1) || 0;
    groupMedians.push({ group: name, n, median: med, mean, std: Math.sqrt(variance) });
  });
  const H = (12 / (N * (N + 1))) * sumTerm - 3 * (N + 1);
  const df = k - 1;
  const pValue = H <= 0 ? 1 : 1 - chiSquareCDF(H, df);
  return { h: H, pValue, df, nGroups: k, groupMedians };
}

/** Levene's test (đồng phương sai — homogeneity of variance). Dùng trước ANOVA. */
export interface LeveneResult {
  w: number;
  df1: number;
  df2: number;
  pValue: number;
  groupMeans: { group: string; n: number; meanAbsDev: number }[];
}

export function computeLeveneTest(rows: string[][], groupCol: string, valueCol: string): LeveneResult | null {
  const headers = rows[0] || [];
  const gi = headers.indexOf(groupCol);
  const vi = headers.indexOf(valueCol);
  if (gi === -1 || vi === -1) return null;
  const data = rows.slice(1);
  const groups: Record<string, number[]> = {};
  data.forEach((r) => {
    const g = String(r[gi]).trim();
    const v = Number(r[vi]);
    if (g === "" || Number.isNaN(v)) return;
    if (!groups[g]) groups[g] = [];
    groups[g].push(v);
  });
  const groupNames = Object.keys(groups).sort();
  const k = groupNames.length;
  if (k < 2) return null;
  const absDevs: Record<string, number[]> = {};
  groupNames.forEach((name) => {
    const vals = groups[name];
    const med = (() => { const s = [...vals].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; })();
    absDevs[name] = vals.map((v) => Math.abs(v - med));
  });
  const n = data.length;
  const grandMean = groupNames.reduce((s, name) => s + absDevs[name].reduce((a, b) => a + b, 0), 0) / n;
  let ssBetween = 0;
  let ssWithin = 0;
  const groupMeans: { group: string; n: number; meanAbsDev: number }[] = [];
  groupNames.forEach((name) => {
    const devs = absDevs[name];
    const nj = devs.length;
    const meanJ = devs.reduce((a, b) => a + b, 0) / nj;
    groupMeans.push({ group: name, n: nj, meanAbsDev: meanJ });
    ssBetween += nj * (meanJ - grandMean) ** 2;
    ssWithin += devs.reduce((s, d) => s + (d - meanJ) ** 2, 0);
  });
  const df1 = k - 1;
  const df2 = n - k;
  if (df2 <= 0) return null;
  const msBetween = ssBetween / df1;
  const msWithin = ssWithin / df2;
  if (msWithin === 0) return { w: 0, df1, df2, pValue: 1, groupMeans };
  const w = msBetween / msWithin;
  const pValue = 1 - fCDF(w, df1, df2);
  return { w, df1, df2, pValue, groupMeans };
}

/** Friedman test (phi tham số cho repeated measures — k điều kiện, mỗi hàng là 1 đối tượng). Cột = các điều kiện. */
export interface FriedmanResult {
  chi2: number;
  df: number;
  pValue: number;
  nBlocks: number;
  kConditions: number;
  meanRanks: { condition: string; meanRank: number; n: number }[];
}

export function computeFriedmanTest(rows: string[][], valueColumns: string[]): FriedmanResult | null {
  if (rows.length < 2 || valueColumns.length < 3) return null;
  const headers = rows[0] || [];
  const indices = valueColumns.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
  if (indices.length !== valueColumns.length) return null;
  const data = rows.slice(1);
  const nBlocks = data.length;
  const k = indices.length;
  const rankInRow = (row: string[]): number[] => {
    const vals = indices.map((ci, pos) => ({ v: Number(row[ci]), pos }));
    const valid = vals.filter((x) => !Number.isNaN(x.v));
    if (valid.length < 2) return indices.map(() => NaN);
    const sorted = [...valid].sort((a, b) => a.v - b.v);
    const out: number[] = new Array(indices.length).fill(NaN);
    let r = 0;
    while (r < sorted.length) {
      let end = r;
      while (end < sorted.length && sorted[end].v === sorted[r].v) end++;
      const avgRank = (r + 1 + end) / 2;
      for (let t = r; t < end; t++) out[sorted[t].pos] = avgRank;
      r = end;
    }
    return out;
  };
  const rankMatrix: number[][] = data.map((r) => rankInRow(r));
  const sumRanks = indices.map((_, j) => {
    let s = 0;
    let count = 0;
    rankMatrix.forEach((row) => { if (!Number.isNaN(row[j])) { s += row[j]; count++; } });
    return { sum: s, count };
  });
  const N = sumRanks.reduce((a, x) => a + x.count, 0) / k;
  const Rj = sumRanks.map((x) => x.sum);
  const sumRjSq = Rj.reduce((s, r) => s + r * r, 0);
  const chi2 = (12 / (nBlocks * k * (k + 1))) * sumRjSq - 3 * nBlocks * (k + 1);
  const df = k - 1;
  const pValue = chi2 <= 0 ? 1 : 1 - chiSquareCDF(chi2, df);
  const meanRanks = valueColumns.map((name, j) => ({
    condition: name,
    meanRank: Rj[j] / nBlocks,
    n: nBlocks,
  }));
  return { chi2, df, pValue, nBlocks, kConditions: k, meanRanks };
}

function fCDF(x: number, df1: number, df2: number): number {
  if (x <= 0 || df1 <= 0 || df2 <= 0) return 0;
  const t = (df1 * x) / (df1 * x + df2);
  return regularizedIncompleteBeta(t, df1 / 2, df2 / 2);
}

/** Cronbach's alpha for reliability (e.g. Likert scale items). Columns = items. */
export function computeCronbachAlpha(rows: string[][], columnNames: string[]): number | null {
  if (rows.length < 3 || columnNames.length < 2) return null;
  const headers = rows[0] || [];
  const indices = columnNames.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
  if (indices.length < 2) return null;
  const data = rows.slice(1);
  const itemVars: number[] = [];
  let totalVar = 0;
  const n = data.length;
  const itemSums = data.map((r) => {
    let s = 0;
    indices.forEach((ci) => { s += Number(r[ci]) || 0; });
    return s;
  });
  const totalMean = itemSums.reduce((a, b) => a + b, 0) / n;
  totalVar = itemSums.reduce((s, v) => s + (v - totalMean) ** 2, 0) / n;
  indices.forEach((ci) => {
    const vals = data.map((r) => Number(r[ci])).filter((v) => !Number.isNaN(v));
    if (vals.length < 2) return;
    const mean = vals.reduce((a, b) => a + b, 0) / vals.length;
    const v = vals.reduce((s, x) => s + (x - mean) ** 2, 0) / vals.length;
    itemVars.push(v);
  });
  if (itemVars.length < 2 || totalVar <= 0) return null;
  const sumVar = itemVars.reduce((a, b) => a + b, 0);
  const k = itemVars.length;
  return (k / (k - 1)) * (1 - sumVar / totalVar);
}

/** OLS regression: coefficients (intercept + each predictor), R², adj R², SE, t, p-value. ciLower/ciUpper khi có từ backend. */
export interface OLSResult {
  coefficients: Record<string, number>;
  intercept: number;
  r2: number;
  adjR2: number;
  se: Record<string, number>;
  tStat: Record<string, number>;
  pValue: Record<string, number>;
  ciLower?: Record<string, number>;
  ciUpper?: Record<string, number>;
  n: number;
  df: number;
  s2: number;
  yName: string;
  xNames: string[];
}

function matMul(A: number[][], B: number[][]): number[][] {
  const rows = A.length;
  const cols = B[0]?.length ?? 0;
  const inner = A[0]?.length ?? 0;
  if (inner !== B.length) return [];
  const out: number[][] = [];
  for (let i = 0; i < rows; i++) {
    out[i] = [];
    for (let j = 0; j < cols; j++) {
      let s = 0;
      for (let k = 0; k < inner; k++) s += A[i][k] * B[k][j];
      out[i][j] = s;
    }
  }
  return out;
}

function matTranspose(A: number[][]): number[][] {
  const rows = A.length;
  const cols = A[0]?.length ?? 0;
  const out: number[][] = [];
  for (let j = 0; j < cols; j++) {
    out[j] = [];
    for (let i = 0; i < rows; i++) out[j][i] = A[i][j];
  }
  return out;
}

/** Invert square matrix by Gauss-Jordan (in-place on augmented [A|I]). */
function matInverse(A: number[][]): number[][] | null {
  const n = A.length;
  if (n === 0 || A[0].length !== n) return null;
  const aug: number[][] = A.map((row, i) => [...row, ...Array(n).fill(0).map((_, j) => j === i ? 1 : 0)]);
  for (let col = 0; col < n; col++) {
    let pivot = col;
    for (let r = col + 1; r < n; r++) if (Math.abs(aug[r][col]) > Math.abs(aug[pivot][col])) pivot = r;
    if (Math.abs(aug[pivot][col]) < 1e-12) return null;
    [aug[col], aug[pivot]] = [aug[pivot], aug[col]];
    const div = aug[col][col];
    for (let j = 0; j < aug[0].length; j++) aug[col][j] /= div;
    for (let r = 0; r < n; r++) {
      if (r === col) continue;
      const factor = aug[r][col];
      for (let j = 0; j < aug[0].length; j++) aug[r][j] -= factor * aug[col][j];
    }
  }
  return aug.map((row) => row.slice(n));
}

/** Ordinary Least Squares regression: y = intercept + sum(xNames * coef). */
export function computeOLS(rows: string[][], yCol: string, xCols: string[]): OLSResult | null {
  const headers = rows[0] || [];
  const yi = headers.indexOf(yCol);
  const xIndices = xCols.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
  if (yi === -1 || xIndices.length === 0 || xIndices.includes(yi)) return null;
  const data = rows.slice(1);
  const n = data.length;
  const p = xIndices.length;
  if (n <= p + 1) return null;
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const yv = Number(r[yi]);
    if (Number.isNaN(yv)) continue;
    let ok = true;
    const row = [1];
    for (const xi of xIndices) {
      const v = Number(r[xi]);
      if (Number.isNaN(v)) { ok = false; break; }
      row.push(v);
    }
    if (ok) { X.push(row); y.push(yv); }
  }
  const N = X.length;
  if (N <= p + 1) return null;
  const Xt = matTranspose(X);
  const XtX = matMul(Xt, X);
  const XtY = matTranspose([y]);
  const invXtX = matInverse(XtX);
  if (!invXtX) return null;
  const betaMat = matMul(invXtX, matMul(Xt, XtY));
  const beta = betaMat.map((b) => b[0]);
  const yHat = X.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  const yMean = y.reduce((a, b) => a + b, 0) / N;
  const ssRes = y.reduce((s, yi, i) => s + (yi - yHat[i]) ** 2, 0);
  const ssTot = y.reduce((s, yi) => s + (yi - yMean) ** 2, 0);
  const df = N - p - 1;
  const s2 = df > 0 ? ssRes / df : 0;
  const r2 = ssTot > 0 ? 1 - ssRes / ssTot : 0;
  const adjR2 = N > 1 ? 1 - (1 - r2) * (N - 1) / (N - p - 1) : 0;
  const se: Record<string, number> = {};
  const tStat: Record<string, number> = {};
  const pValue: Record<string, number> = {};
  const coeff: Record<string, number> = { "(Intercept)": beta[0] };
  const names = ["(Intercept)", ...xCols.filter((c) => headers.indexOf(c) >= 0)];
  for (let j = 0; j < beta.length; j++) {
    const name = names[j] ?? `x${j}`;
    const stdErr = Math.sqrt(s2 * (invXtX[j]?.[j] ?? 0));
    se[name] = stdErr;
    tStat[name] = stdErr > 0 ? beta[j] / stdErr : 0;
    pValue[name] = df > 0 ? twoTailedPValue(tStat[name], df) : 1;
    if (j > 0) coeff[name] = beta[j];
  }
  return {
    coefficients: coeff,
    intercept: beta[0],
    r2,
    adjR2,
    se,
    tStat,
    pValue,
    n: N,
    df,
    s2,
    yName: yCol,
    xNames: xCols,
  };
}

/** Beta-Binomial posterior: prior Beta(alpha, beta), data = successes out of n → posterior Beta(alpha+s, beta+n-s). */
export interface BetaPosteriorResult {
  postAlpha: number;
  postBeta: number;
  mean: number;
  variance: number;
  ci95Lower: number;
  ci95Upper: number;
}

export function computeBetaPosterior(
  successes: number,
  n: number,
  priorAlpha: number = 1,
  priorBeta: number = 1
): BetaPosteriorResult {
  if (n < 0 || successes < 0 || successes > n) return { postAlpha: 0.5, postBeta: 0.5, mean: 0.5, variance: 0.25, ci95Lower: 0, ci95Upper: 1 };
  const postAlpha = priorAlpha + successes;
  const postBeta = priorBeta + (n - successes);
  const sum = postAlpha + postBeta;
  const mean = postAlpha / sum;
  const variance = (postAlpha * postBeta) / (sum * sum * (sum + 1));
  const std = Math.sqrt(variance);
  const ci95Lower = Math.max(0, mean - 1.96 * std);
  const ci95Upper = Math.min(1, mean + 1.96 * std);
  return { postAlpha, postBeta, mean, variance, ci95Lower, ci95Upper };
}

/** K-means clustering (simple Lloyd). Returns assignments (row index -> cluster) and centroids. */
export interface KMeansResult {
  assignments: number[];
  centroids: number[][];
  iterations: number;
  withinSS: number;
}

export function computeKMeans(
  rows: string[][],
  columnNames: string[],
  K: number,
  maxIter: number = 100
): KMeansResult | null {
  const headers = rows[0] || [];
  const indices = columnNames.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
  if (indices.length === 0 || K < 2) return null;
  const data: number[][] = [];
  for (let i = 1; i < rows.length; i++) {
    const row = indices.map((ci) => Number(rows[i][ci]));
    if (row.every((v) => !Number.isNaN(v))) data.push(row);
  }
  const n = data.length;
  const dim = indices.length;
  if (n < K) return null;
  let assignments = data.map(() => Math.floor(Math.random() * K));
  let centroids: number[][] = [];
  for (let iter = 0; iter < maxIter; iter++) {
    centroids = [];
    for (let k = 0; k < K; k++) {
      const points = data.filter((_, i) => assignments[i] === k);
      if (points.length === 0) {
        centroids.push([...data[Math.floor(Math.random() * n)]]);
        continue;
      }
      const mean = points[0].map((_, d) => points.reduce((s, p) => s + p[d], 0) / points.length);
      centroids.push(mean);
    }
    let changed = false;
    for (let i = 0; i < n; i++) {
      let best = 0;
      let bestDist = Infinity;
      for (let k = 0; k < K; k++) {
        const d = data[i].reduce((s, v, d) => s + (v - centroids[k][d]) ** 2, 0);
        if (d < bestDist) { bestDist = d; best = k; }
      }
      if (assignments[i] !== best) { assignments[i] = best; changed = true; }
    }
    if (!changed) {
      const withinSS = data.reduce((s, row, i) => {
        const k = assignments[i];
        return s + row.reduce((a, v, d) => a + (v - centroids[k][d]) ** 2, 0);
      }, 0);
      return { assignments, centroids, iterations: iter + 1, withinSS };
    }
  }
  const withinSS = data.reduce((s, row, i) => {
    const k = assignments[i];
    return s + row.reduce((a, v, d) => a + (v - centroids[k][d]) ** 2, 0);
  }, 0);
  return { assignments, centroids, iterations: maxIter, withinSS };
}

/** Outlier count by IQR (1.5 * IQR rule) for a numeric column. */
export function getOutlierCountIQR(values: number[]): number {
  if (values.length < 4) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  if (iqr <= 0) return 0;
  const low = q1 - 1.5 * iqr;
  const high = q3 + 1.5 * iqr;
  return values.filter((v) => v < low || v > high).length;
}

/** Outlier IQR full stats (q1, q3, iqr, lower, upper, count) — cùng format với backend. */
export function computeOutlierIqr(values: number[]): { outlierCount: number; q1: number | null; q3: number | null; iqr: number | null; lower: number | null; upper: number | null } {
  const valid = values.filter((v) => !Number.isNaN(v));
  if (valid.length < 4) return { outlierCount: 0, q1: null, q3: null, iqr: null, lower: null, upper: null };
  const sorted = [...valid].sort((a, b) => a - b);
  const q1 = sorted[Math.floor(sorted.length * 0.25)];
  const q3 = sorted[Math.floor(sorted.length * 0.75)];
  const iqr = q3 - q1;
  if (iqr <= 0) return { outlierCount: 0, q1, q3, iqr: 0, lower: q1, upper: q3 };
  const lower = q1 - 1.5 * iqr;
  const upper = q3 + 1.5 * iqr;
  const count = valid.filter((v) => v < lower || v > upper).length;
  return { outlierCount: count, q1, q3, iqr, lower, upper };
}

/** Add outlier counts and skew to profiling: returns profile with optional outlierCount. */
export function computeProfileWithOutliers(rows: string[][]): (DataProfile & { outlierCount?: number })[] {
  if (!rows || !Array.isArray(rows) || rows.length === 0) return [];
  const profiles = computeProfile(rows);
  if (rows.length < 2) return profiles;
  const headers = rows[0];
  if (!headers || !Array.isArray(headers)) return profiles;
  const dataRows = rows.slice(1);
  return profiles.map((p, ci) => {
    const values = dataRows.map((r) => (r[ci] !== undefined ? String(r[ci]).trim() : ""));
    const nums = values.filter((v) => v !== "" && isNumeric(v)).map(toNum);
    const outlierCount = nums.length >= 4 ? getOutlierCountIQR(nums) : undefined;
    return { ...p, outlierCount };
  });
}

/** Box plot stats per group: min, Q1, median, Q3, max, n. */
export interface BoxGroupStats {
  group: string;
  min: number;
  q1: number;
  median: number;
  q3: number;
  max: number;
  n: number;
}

export function getBoxStatsByGroup(rows: string[][], groupCol: string, valueCol: string): BoxGroupStats[] {
  const headers = rows[0] || [];
  const gi = headers.indexOf(groupCol);
  const vi = headers.indexOf(valueCol);
  if (gi === -1 || vi === -1) return [];
  const data = rows.slice(1);
  const groups: Record<string, number[]> = {};
  data.forEach((r) => {
    const g = String(r[gi] ?? "").trim();
    const v = Number(r[vi]);
    if (g === "" || Number.isNaN(v)) return;
    if (!groups[g]) groups[g] = [];
    groups[g].push(v);
  });
  const quantile = (sorted: number[], p: number) => {
    const idx = p * (sorted.length - 1);
    const lo = Math.floor(idx);
    const hi = Math.ceil(idx);
    return lo === hi ? sorted[lo] : sorted[lo] + (idx - lo) * (sorted[hi] - sorted[lo]);
  };
  return Object.keys(groups)
    .sort()
    .map((group) => {
      const vals = groups[group].sort((a, b) => a - b);
      const n = vals.length;
      return {
        group,
        min: vals[0],
        q1: quantile(vals, 0.25),
        median: quantile(vals, 0.5),
        q3: quantile(vals, 0.75),
        max: vals[n - 1],
        n,
      };
    });
}

/** Histogram bins for a numeric column. */
export function getHistogramBins(values: number[], binCount?: number): { binStart: number; binEnd: number; count: number }[] {
  const valid = values.filter((v) => !Number.isNaN(v));
  if (valid.length === 0) return [];
  const min = Math.min(...valid);
  const max = Math.max(...valid);
  const k = binCount ?? Math.min(20, Math.max(5, Math.ceil(Math.sqrt(valid.length))));
  const step = (max - min) / k || 1;
  const bins: { binStart: number; binEnd: number; count: number }[] = [];
  for (let i = 0; i < k; i++) {
    const binStart = min + i * step;
    const binEnd = i === k - 1 ? max + 0.01 : min + (i + 1) * step;
    const count = valid.filter((v) => v >= binStart && (i === k - 1 ? v <= binEnd : v < binEnd)).length;
    bins.push({ binStart, binEnd, count });
  }
  return bins;
}

export { MAX_ROWS_STORED };

// --- Logistic regression ---
export interface LogisticResult {
  coefficients: Record<string, number>;
  intercept: number;
  oddsRatios: Record<string, number>;
  se: Record<string, number>;
  zStat: Record<string, number>;
  pValue: Record<string, number>;
  logLikelihood: number;
  aic: number;
  n: number;
  yName: string;
  xNames: string[];
  classCounts: { "0": number; "1": number };
}

/** Binary logistic regression (IRLS). Y must be 0/1 or convertible. */
export function computeLogisticRegression(rows: string[][], yCol: string, xCols: string[]): LogisticResult | null {
  const headers = rows[0] || [];
  const yi = headers.indexOf(yCol);
  const xIndices = xCols.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
  if (yi === -1 || xIndices.length === 0 || xIndices.includes(yi)) return null;
  const data = rows.slice(1);
  const X: number[][] = [];
  const y: number[] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const yv = Number(r[yi]);
    if (yv !== 0 && yv !== 1) continue;
    let ok = true;
    const row = [1];
    for (const xi of xIndices) {
      const v = Number(r[xi]);
      if (Number.isNaN(v)) { ok = false; break; }
      row.push(v);
    }
    if (ok) { X.push(row); y.push(yv); }
  }
  const N = X.length;
  if (N < 10 || y.every((v) => v === 0) || y.every((v) => v === 1)) return null;
  const p = xIndices.length + 1;
  let beta = new Array(p).fill(0);
  for (let iter = 0; iter < 50; iter++) {
    const eta = X.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
    const mu = eta.map((e) => 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, e)))));
    const W = mu.map((m, i) => m * (1 - m));
    const z = eta.map((e, i) => e + (y[i] - mu[i]) / (W[i] || 0.01));
    const XtWX: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
    const XtWz: number[] = Array(p).fill(0);
    for (let i = 0; i < N; i++) {
      const w = W[i];
      for (let j = 0; j < p; j++) {
        for (let k = 0; k < p; k++) XtWX[j][k] += X[i][j] * w * X[i][k];
        XtWz[j] += X[i][j] * w * z[i];
      }
    }
    const inv = matInverse(XtWX);
    if (!inv) break;
    const delta = inv.map((row) => row.reduce((s, v, k) => s + v * XtWz[k], 0));
    let maxD = 0;
    for (let j = 0; j < p; j++) {
      beta[j] += delta[j];
      maxD = Math.max(maxD, Math.abs(delta[j]));
    }
    if (maxD < 1e-8) break;
  }
  const eta = X.map((row) => row.reduce((s, v, j) => s + v * beta[j], 0));
  const mu = eta.map((e) => 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, e)))));
  let logLik = 0;
  for (let i = 0; i < N; i++) logLik += y[i] * Math.log(mu[i] || 1e-10) + (1 - y[i]) * Math.log(1 - mu[i] || 1e-10);
  const aic = -2 * logLik + 2 * p;
  const invXtWX: number[][] = [];
  const W = mu.map((m, i) => m * (1 - m));
  for (let j = 0; j < p; j++) {
    invXtWX[j] = [];
    for (let k = 0; k < p; k++) {
      let v = 0;
      for (let i = 0; i < N; i++) v += X[i][j] * W[i] * X[i][k];
      invXtWX[j][k] = v;
    }
  }
  const covInv = matInverse(invXtWX);
  const names = ["(Intercept)", ...xCols.filter((c) => headers.indexOf(c) >= 0)];
  const coeff: Record<string, number> = {};
  const se: Record<string, number> = {};
  const zStat: Record<string, number> = {};
  const pValue: Record<string, number> = {};
  const oddsRatios: Record<string, number> = {};
  for (let j = 0; j < p; j++) {
    const name = names[j] ?? `x${j}`;
    coeff[name] = beta[j];
    oddsRatios[name] = Math.exp(beta[j]);
    const stdErr = covInv && covInv[j] ? Math.sqrt(Math.max(0, covInv[j][j])) : 0;
    se[name] = stdErr;
    zStat[name] = stdErr > 0 ? beta[j] / stdErr : 0;
    pValue[name] = 2 * (1 - normalCDF(Math.abs(zStat[name])));
  }
  const count0 = y.filter((v) => v === 0).length;
  const count1 = y.filter((v) => v === 1).length;
  return { coefficients: coeff, intercept: beta[0], oddsRatios, se, zStat, pValue, logLikelihood: logLik, aic, n: N, yName: yCol, xNames: xCols, classCounts: { "0": count0, "1": count1 } };
}

// --- VIF (Variance Inflation Factor) ---
/** Compute VIF for each predictor in OLS. VIF > 5 suggests multicollinearity. */
export function computeVIF(rows: string[][], xCols: string[]): Record<string, number> | null {
  if (rows.length < 4 || xCols.length < 2) return null;
  const headers = rows[0] || [];
  const data = rows.slice(1);
  const vif: Record<string, number> = {};
  for (let i = 0; i < xCols.length; i++) {
    const target = xCols[i];
    const others = xCols.filter((_, j) => j !== i);
    const res = computeOLS(rows, target, others);
    if (!res || res.r2 >= 1 - 1e-10) return null;
    vif[target] = 1 / (1 - res.r2);
  }
  return vif;
}

// --- EFA (PCA-based factor extraction) ---
export interface EFAResult {
  eigenvalues: number[];
  varianceExplained: number[];
  loadings: number[][];
  columnNames: string[];
  nFactors: number;
}

/** Exploratory factor analysis (PCA extraction, varimax rotation). */
export function computeEFA(rows: string[][], columnNames: string[], nFactors?: number): EFAResult | null {
  if (rows.length < 10 || columnNames.length < 2) return null;
  const headers = rows[0] || [];
  const indices = columnNames.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
  if (indices.length < 2) return null;
  const data = rows.slice(1).map((r) => indices.map((ci) => Number(r[ci]))).filter((row) => row.every((v) => !Number.isNaN(v)));
  const n = data.length;
  if (n < 10) return null;
  const p = indices.length;
  const colNames = indices.map((i) => headers[i]);
  const mean = colNames.map((_, j) => data.reduce((s, r) => s + r[j], 0) / n);
  const centered = data.map((r) => r.map((v, j) => v - mean[j]));
  const cov: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) {
    let s = 0;
    for (let k = 0; k < n; k++) s += centered[k][i] * centered[k][j];
    cov[i][j] = s / (n - 1);
  }
  const { eigenvalues, eigenvectors } = eigenDecomposition(cov);
  const K = nFactors ?? Math.min(p, eigenvalues.filter((e) => e > 1).length || 1);
  const loadings = eigenvectors.map((ev, i) => ev.map((v, j) => v * Math.sqrt(Math.max(0, eigenvalues[j]))));
  const rotated = varimax(loadings.slice(0, p).map((row) => row.slice(0, K)));
  const totalVar = eigenvalues.reduce((a, b) => a + b, 0);
  const varianceExplained = eigenvalues.slice(0, K).map((e) => (e / totalVar) * 100);
  return { eigenvalues: eigenvalues.slice(0, p), varianceExplained, loadings: rotated, columnNames: colNames, nFactors: K };
}

function eigenDecomposition(matrix: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = matrix.length;
  let A = matrix.map((r) => r.map((x) => x));
  const V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
  for (let iter = 0; iter < 100; iter++) {
    let maxOff = 0;
    let p = 0, q = 1;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      if (Math.abs(A[i][j]) > maxOff) { maxOff = Math.abs(A[i][j]); p = i; q = j; }
    }
    if (maxOff < 1e-12) break;
    const theta = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]);
    const c = Math.cos(theta); const s = Math.sin(theta);
    for (let i = 0; i < n; i++) {
      const api = A[p][i]; const aqi = A[q][i];
      A[p][i] = c * api - s * aqi; A[q][i] = s * api + c * aqi;
    }
    for (let i = 0; i < n; i++) {
      const aip = A[i][p]; const aiq = A[i][q];
      A[i][p] = c * aip - s * aiq; A[i][q] = s * aip + c * aiq;
    }
    for (let i = 0; i < n; i++) {
      const vip = V[i][p]; const viq = V[i][q];
      V[i][p] = c * vip - s * viq; V[i][q] = s * vip + c * viq;
    }
  }
  const diag = A.map((r, i) => ({ val: r[i], idx: i }));
  diag.sort((a, b) => b.val - a.val);
  const eigenvalues = diag.map((d) => d.val);
  const perm = diag.map((d) => d.idx);
  const eigenvectors = V.map((row) => perm.map((p) => row[p]));
  return { eigenvalues, eigenvectors };
}

function varimax(loadings: number[][]): number[][] {
  const nRows = loadings.length;
  const nCols = loadings[0]?.length ?? 0;
  if (nCols < 2) return loadings;
  let L = loadings.map((r) => r.map((x) => x));
  for (let iter = 0; iter < 20; iter++) {
    for (let j = 0; j < nCols; j++) {
      for (let k = j + 1; k < nCols; k++) {
        let a = 0, b = 0, c = 0, d = 0;
        for (let i = 0; i < nRows; i++) {
          const u = L[i][j]; const v = L[i][k];
          a += u * u - v * v; b += 2 * u * v; c += u * u + v * v; d += u * v * (u * u - v * v);
        }
        const denom = c * c - b * b;
        if (Math.abs(denom) < 1e-12) continue;
        const theta = 0.25 * Math.atan2(2 * (nRows * d - a * b), nRows * (a - c) + a * c - b * b);
        const cos = Math.cos(theta); const sin = Math.sin(theta);
        for (let i = 0; i < nRows; i++) {
          const u = L[i][j]; const v = L[i][k];
          L[i][j] = u * cos - v * sin; L[i][k] = u * sin + v * cos;
        }
      }
    }
  }
  return L;
}

// --- Mediation (Baron-Kenny) ---
export interface MediationResult {
  a: number; b: number; c: number; cPrime: number;
  aSE: number; bSE: number; cSE: number; cPrimeSE: number;
  aP: number; bP: number; cP: number; cPrimeP: number;
  indirectEffect: number;
  pctMediated: number;
}

/** Simple mediation: X -> M -> Y. Returns path coefficients. */
export function computeMediation(rows: string[][], xCol: string, mCol: string, yCol: string): MediationResult | null {
  const pathA = computeOLS(rows, mCol, [xCol]);
  const pathC = computeOLS(rows, yCol, [xCol]);
  const pathBC = computeOLS(rows, yCol, [xCol, mCol]);
  if (!pathA || !pathC || !pathBC) return null;
  const a = pathA.coefficients[xCol] ?? 0;
  const c = pathC.coefficients[xCol] ?? 0;
  const b = pathBC.coefficients[mCol] ?? 0;
  const cPrime = pathBC.coefficients[xCol] ?? 0;
  const indirect = a * b;
  const pctMed = c !== 0 ? (indirect / c) * 100 : 0;
  return {
    a, b, c, cPrime,
    aSE: pathA.se[xCol] ?? 0, bSE: pathBC.se[mCol] ?? 0, cSE: pathC.se[xCol] ?? 0, cPrimeSE: pathBC.se[xCol] ?? 0,
    aP: pathA.pValue[xCol] ?? 1, bP: pathBC.pValue[mCol] ?? 1, cP: pathC.pValue[xCol] ?? 1, cPrimeP: pathBC.pValue[xCol] ?? 1,
    indirectEffect: indirect, pctMediated: pctMed,
  };
}

// --- Moderation (interaction term) ---
/** Moderation: Y ~ X + M + X*M. Returns coefficients including interaction. */
export function computeModeration(rows: string[][], yCol: string, xCol: string, mCol: string): OLSResult | null {
  const headers = rows[0] || [];
  const data = rows.slice(1);
  const xi = headers.indexOf(xCol);
  const mi = headers.indexOf(mCol);
  const yi = headers.indexOf(yCol);
  if (xi === -1 || mi === -1 || yi === -1) return null;
  const interactionCol = `${xCol}_x_${mCol}`;
  const newHeaders = [...headers, interactionCol];
  const newData: string[][] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const xv = Number(r[xi]);
    const mv = Number(r[mi]);
    const yv = Number(r[yi]);
    if (Number.isNaN(xv) || Number.isNaN(mv) || Number.isNaN(yv)) continue;
    newData.push([...r, String(xv * mv)]);
  }
  const fullData = [newHeaders, ...newData];
  const res = computeOLS(fullData, yCol, [xCol, mCol, interactionCol]);
  return res;
}

// --- Shapiro-Wilk (normality) ---
export interface ShapiroWilkResult { w: number; pValue: number; n: number; }

/** Shapiro-Wilk test for normality (approximation for n <= 5000). */
export function computeShapiroWilk(values: number[]): ShapiroWilkResult | null {
  const n = values.length;
  if (n < 3 || n > 5000) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const mean = sorted.reduce((a, b) => a + b, 0) / n;
  const sumSq = sorted.reduce((s, v) => s + (v - mean) ** 2, 0);
  if (sumSq === 0) return { w: 1, pValue: 1, n };
  const m = sorted.map((_, i) => {
    const u = (i + 1 - 0.375) / (n + 0.25);
    return normalQuantile(u);
  });
  const m2 = m.reduce((s, v) => s + v * v, 0);
  let b = 0;
  for (let i = 0; i < Math.floor(n / 2); i++) b += m[i] * (sorted[n - 1 - i] - sorted[i]);
  const a = 1 / Math.sqrt(m2);
  const w = (b * a) ** 2 / sumSq;
  const lnN = Math.log(n);
  const mu = -1.2725 + 1.0521 * (lnN - 3);
  const sigma = 1.0308 - 0.26758 * (lnN - 3);
  const z = (Math.log(1 - w) - mu) / sigma;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  return { w, pValue: Math.min(1, Math.max(0, pValue)), n };
}

function normalQuantile(p: number): number {
  if (p <= 0 || p >= 1) return 0;
  const a = [-3.969683028665376e1, 2.209460984245205e2, -2.759285104469687e2, 1.383577518672690e2, -3.066479806614716e1, 2.506628277459239e0];
  const b = [-5.447609879822406e1, 1.615858368580409e2, -1.556989798598866e2, 6.680131188771972e1, -1.328068155288572e1];
  const c = [-7.784894002430293e-3, -3.223964580411365e-1, -2.400758277161838e0, -2.549732539343734e0, 4.374664141464968e0, 2.938163982698783e0];
  const d = [7.784695709041462e-3, 3.224671290700398e-1, 2.445134137142996e0, 3.754408661907416e0];
  const pLow = 0.02425; const pHigh = 1 - pLow;
  if (p < pLow) {
    const q = Math.sqrt(-2 * Math.log(p));
    return (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
  }
  if (p <= pHigh) {
    const q = p - 0.5;
    const r = q * q;
    return ((((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) * q) / (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1);
  }
  const q = Math.sqrt(-2 * Math.log(1 - p));
  return -(((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) / ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1);
}

// --- Power analysis ---
export interface PowerAnalysisResult {
  nRequired: number;
  power: number;
  effectSize: number;
  alpha: number;
  testType: "ttest" | "anova";
}

/** Sample size for independent t-test (2 groups, equal n). Cohen d, alpha=0.05, power=0.8. */
export function computePowerTTest(effectSizeD: number, alpha: number = 0.05, power: number = 0.8): PowerAnalysisResult {
  const zAlpha = 1.96; // two-tailed alpha .05
  const zBeta = 0.84;  // power .8
  const nPerGroup = Math.ceil((2 * (zAlpha + zBeta) ** 2) / (effectSizeD * effectSizeD));
  return { nRequired: Math.max(4, nPerGroup * 2), power, effectSize: effectSizeD, alpha, testType: "ttest" };
}

export interface SampleSizeProportionResult {
  nRequired: number;
  p0: number;
  p1: number;
  alpha: number;
  power: number;
}

/** Sample size for testing proportion (one-sample z-test). p0=null proportion, p1=alt, alpha=0.05, power=0.8. */
export function computeSampleSizeProportion(p0: number, p1: number, alpha: number = 0.05, power: number = 0.8): SampleSizeProportionResult {
  const zAlpha = 1.96;
  const zBeta = 0.84;
  const pBar = (p0 + p1) / 2;
  const effect = p1 - p0;
  const n = Math.ceil(((zAlpha * Math.sqrt(2 * pBar * (1 - pBar))) + (zBeta * Math.sqrt(p0 * (1 - p0) + p1 * (1 - p1)))) ** 2 / (effect * effect));
  return { nRequired: Math.max(10, n), p0, p1, alpha, power };
}

export interface SampleSizeChiSquareResult {
  nRequired: number;
  effectSizeW: number;
  df: number;
  alpha: number;
  power: number;
}

/** Sample size for Chi-square test. effectSizeW (Cohen w), df, alpha=0.05, power=0.8. */
export function computeSampleSizeChiSquare(effectSizeW: number, df: number, alpha: number = 0.05, power: number = 0.8): SampleSizeChiSquareResult {
  const ncp = effectSizeW * effectSizeW;
  const zBeta = 0.84;
  const zAlpha = 1.96;
  const n = Math.ceil((df + 1 + (zAlpha + zBeta) ** 2) / (effectSizeW * effectSizeW));
  return { nRequired: Math.max(df + 1, n), effectSizeW, df, alpha, power };
}

export interface SampleSizeAnovaResult {
  nRequired: number;
  nPerGroup: number;
  k: number;
  effectSizeF: number;
  alpha: number;
  power: number;
}

/** Sample size for one-way ANOVA. k groups, effectSizeF (f = sqrt(eta²/(1-eta²))), alpha=0.05, power=0.8. */
export function computeSampleSizeAnova(k: number, effectSizeF: number, alpha: number = 0.05, power: number = 0.8): SampleSizeAnovaResult {
  const zBeta = 0.84;
  const zAlpha = 1.96;
  const nPerGroup = Math.ceil((2 * (zAlpha + zBeta) ** 2) / (effectSizeF * effectSizeF));
  const n = Math.max(k, nPerGroup) * k;
  return { nRequired: n, nPerGroup: Math.max(2, nPerGroup), k, effectSizeF, alpha, power };
}

export interface SampleSizeRegressionResult {
  nRequired: number;
  nPredictors: number;
  rule: string;
}

/** Sample size for linear regression: rule of thumb n >= 10–20 per predictor. */
export function computeSampleSizeRegression(nPredictors: number, rule: "10" | "20" = "10"): SampleSizeRegressionResult {
  const mult = rule === "20" ? 20 : 10;
  const n = Math.max(20, nPredictors * mult + 10);
  return { nRequired: n, nPredictors, rule: `n ≥ ${mult} × số biến + 10` };
}

// --- Multiclass classification & explainability ---

/** Confusion matrix: rows = actual, cols = predicted. Labels order determines indices. */
export function computeConfusionMatrix(actual: string[], predicted: string[]): { matrix: number[][]; labels: string[] } {
  const labels = [...new Set([...actual, ...predicted])].filter(Boolean).sort();
  const n = labels.length;
  const idx = (l: string) => labels.indexOf(l);
  const matrix = Array.from({ length: n }, () => Array(n).fill(0));
  for (let i = 0; i < actual.length; i++) {
    const a = idx(actual[i]);
    const p = idx(predicted[i]);
    if (a >= 0 && p >= 0) matrix[a][p]++;
  }
  return { matrix, labels };
}

export interface ClassificationClassMetrics {
  label: string;
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface ClassificationReportResult {
  accuracy: number;
  perClass: ClassificationClassMetrics[];
  macroPrecision: number;
  macroRecall: number;
  macroF1: number;
  weightedPrecision: number;
  weightedRecall: number;
  weightedF1: number;
}

/** Classification metrics from actual vs predicted (multi-class). */
export function computeClassificationReport(actual: string[], predicted: string[]): ClassificationReportResult {
  const { matrix, labels } = computeConfusionMatrix(actual, predicted);
  const n = labels.length;
  const perClass: ClassificationClassMetrics[] = [];
  for (let i = 0; i < n; i++) {
    const rowSum = matrix[i].reduce((a, b) => a + b, 0);
    const colSum = matrix.map((r) => r[i]).reduce((a, b) => a + b, 0);
    const tp = matrix[i][i];
    const precision = colSum > 0 ? tp / colSum : 0;
    const recall = rowSum > 0 ? tp / rowSum : 0;
    const f1 = precision + recall > 0 ? (2 * precision * recall) / (precision + recall) : 0;
    perClass.push({ label: labels[i], precision, recall, f1, support: rowSum });
  }
  const total = actual.length;
  const correct = actual.reduce((s, a, i) => s + (a === predicted[i] ? 1 : 0), 0);
  const accuracy = total > 0 ? correct / total : 0;
  const macroPrecision = n ? perClass.reduce((s, p) => s + p.precision, 0) / n : 0;
  const macroRecall = n ? perClass.reduce((s, p) => s + p.recall, 0) / n : 0;
  const macroF1 = n ? perClass.reduce((s, p) => s + p.f1, 0) / n : 0;
  const sumSupport = perClass.reduce((s, p) => s + p.support, 0);
  const weightedPrecision = sumSupport ? perClass.reduce((s, p) => s + p.precision * p.support, 0) / sumSupport : 0;
  const weightedRecall = sumSupport ? perClass.reduce((s, p) => s + p.recall * p.support, 0) / sumSupport : 0;
  const weightedF1 = sumSupport ? perClass.reduce((s, p) => s + p.f1 * p.support, 0) / sumSupport : 0;
  return { accuracy, perClass, macroPrecision, macroRecall, macroF1, weightedPrecision, weightedRecall, weightedF1 };
}

export interface MulticlassLogisticResult {
  classes: string[];
  models: LogisticResult[];
  predicted: string[];
  confusionMatrix: { matrix: number[][]; labels: string[] };
  metrics: ClassificationReportResult;
}

/** One-vs-rest multiclass logistic: one binary model per class. Y column can be string labels. */
export function computeMulticlassLogisticOneVsRest(rows: string[][], yCol: string, xCols: string[]): MulticlassLogisticResult | null {
  const headers = rows[0] || [];
  const yi = headers.indexOf(yCol);
  const xIndices = xCols.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
  if (yi === -1 || xIndices.length === 0) return null;
  const data = rows.slice(1);
  const classes = [...new Set(data.map((r) => String(r[yi] ?? "").trim()).filter(Boolean))].sort();
  if (classes.length < 2) return null;
  const binaryCol = " __binary_y__ ";
  const models: LogisticResult[] = [];
  for (const cls of classes) {
    const modifiedRows = [
      [...headers, binaryCol],
      ...data.map((r) => {
        const yVal = String(r[yi] ?? "").trim();
        const bin = yVal === cls ? "1" : "0";
        return [...r, bin];
      }),
    ];
    const res = computeLogisticRegression(modifiedRows, binaryCol, xCols);
    if (!res) return null;
    models.push(res);
  }
  const predicted = predictMulticlassOneVsRest(rows, models, classes, yCol, xCols);
  const actual = data.map((r) => String(r[yi] ?? "").trim());
  const confusionMatrix = computeConfusionMatrix(actual, predicted);
  const metrics = computeClassificationReport(actual, predicted);
  return { classes, models, predicted, confusionMatrix, metrics };
}

function predictMulticlassOneVsRest(rows: string[][], models: LogisticResult[], classes: string[], yCol: string, xCols: string[]): string[] {
  const headers = rows[0] || [];
  const data = rows.slice(1);
  const xIndices = xCols.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
  const predicted: string[] = [];
  for (let i = 0; i < data.length; i++) {
    const r = data[i];
    const xVec = xIndices.map((ci) => Number(r[ci]));
    if (xVec.some((v) => Number.isNaN(v))) {
      predicted.push(classes[0]);
      continue;
    }
    let bestIdx = 0;
    let bestProb = -1;
    for (let c = 0; c < classes.length; c++) {
      const m = models[c];
      const logit = (m?.intercept ?? 0) + xVec.reduce((s, v, j) => {
        const name = headers[xIndices[j]];
        return s + v * (m?.coefficients?.[name] ?? 0);
      }, 0);
      const prob = 1 / (1 + Math.exp(-Math.max(-20, Math.min(20, logit))));
      if (prob > bestProb) {
        bestProb = prob;
        bestIdx = c;
      }
    }
    predicted.push(classes[bestIdx]);
  }
  return predicted;
}

/** Feature importance from one-vs-rest: mean absolute coefficient per predictor (generic explainability). */
export function computeFeatureImportanceFromMulticlass(multiclassResult: MulticlassLogisticResult): { feature: string; importance: number }[] {
  const xNames = multiclassResult.models[0]?.xNames?.filter((n) => n !== "(Intercept)") ?? [];
  const byFeature: Record<string, number[]> = {};
  xNames.forEach((name) => { byFeature[name] = []; });
  multiclassResult.models.forEach((m) => {
    xNames.forEach((name) => {
      const coef = m.coefficients[name];
      if (coef != null) byFeature[name].push(Math.abs(coef));
    });
  });
  return xNames.map((feature) => {
    const vals = byFeature[feature] ?? [];
    const importance = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    return { feature, importance };
  }).sort((a, b) => b.importance - a.importance);
}

/** Permutation importance: shuffle each feature column and measure accuracy drop (generic, model-agnostic style). */
export function computePermutationImportanceMulticlass(rows: string[][], yCol: string, xCols: string[], nPermutations: number = 5): { feature: string; importance: number; std?: number }[] | null {
  const base = computeMulticlassLogisticOneVsRest(rows, yCol, xCols);
  if (!base) return null;
  const baseAcc = base.metrics.accuracy;
  const headers = rows[0] || [];
  const data = rows.slice(1);
  const results: Record<string, number[]> = {};
  xCols.forEach((c) => { results[c] = []; });
  for (let perm = 0; perm < nPermutations; perm++) {
    for (const col of xCols) {
      const ci = headers.indexOf(col);
      if (ci === -1) continue;
      const shuffled = data.map((r) => [...r]);
      const colVals = shuffled.map((r) => r[ci]);
      for (let i = colVals.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [colVals[i], colVals[j]] = [colVals[j], colVals[i]];
      }
      shuffled.forEach((r, i) => { r[ci] = colVals[i]; });
      const modifiedRows = [headers, ...shuffled];
      const pred = predictMulticlassOneVsRest(modifiedRows, base.models, base.classes, yCol, xCols);
      const actual = data.map((r) => String(r[headers.indexOf(yCol)] ?? "").trim());
      const acc = actual.reduce((s, a, i) => s + (a === pred[i] ? 1 : 0), 0) / actual.length;
      results[col].push(baseAcc - acc);
    }
  }
  return xCols.map((feature) => {
    const vals = results[feature] ?? [];
    const importance = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
    const mean = importance;
    const variance = vals.length ? vals.reduce((s, v) => s + (v - mean) ** 2, 0) / vals.length : 0;
    return { feature, importance, std: Math.sqrt(variance) };
  }).sort((a, b) => b.importance - a.importance);
}

/** Thống kê văn bản (phân tích định tính): đếm từ, tần số từ. */
export function computeTextStats(rows: string[][], col: string, topN: number = 100): { column: string; nRows: number; nEmpty: number; totalWords: number; uniqueWords: number; avgWordsPerRow: number; minWordsPerRow: number; maxWordsPerRow: number; wordFreq: { word: string; count: number }[] } | null {
  const headers = rows[0] || [];
  const ci = headers.indexOf(col);
  if (ci === -1) return null;
  const data = rows.slice(1);
  const texts = data.map((r) => String(r[ci] ?? "").trim());
  const nRows = texts.length;
  const nEmpty = texts.filter((t) => !t.length).length;
  const wordsPerRow = texts.map((t) => t ? t.split(/\s+/).length : 0);
  const totalWords = wordsPerRow.reduce((a, b) => a + b, 0);
  const count: Record<string, number> = {};
  texts.forEach((t) => {
    if (!t) return;
    t.toLowerCase().split(/\s+/).forEach((w) => {
      if (w) count[w] = (count[w] || 0) + 1;
    });
  });
  const wordFreq = Object.entries(count)
    .map(([word, count]) => ({ word, count }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
  const uniqueWords = Object.keys(count).length;
  return {
    column: col,
    nRows,
    nEmpty,
    totalWords,
    uniqueWords,
    avgWordsPerRow: nRows ? totalWords / nRows : 0,
    minWordsPerRow: wordsPerRow.length ? Math.min(...wordsPerRow) : 0,
    maxWordsPerRow: wordsPerRow.length ? Math.max(...wordsPerRow) : 0,
    wordFreq,
  };
}

/** Đếm từ khóa / mã (định tính): số dòng chứa từ khóa và tổng số lần xuất hiện. Fallback khi không có backend. */
export function computeKeywordCounts(
  rows: string[][],
  col: string,
  keywords: string[]
): { column: string; keywords: string[]; counts: { keyword: string; rowCount: number; totalOccurrences: number }[] } | null {
  const headers = rows[0] || [];
  const ci = headers.indexOf(col);
  if (ci === -1 || !keywords.length) return null;
  const data = rows.slice(1);
  const texts = data.map((r) => String(r[ci] ?? "").trim().toLowerCase());
  const counts: { keyword: string; rowCount: number; totalOccurrences: number }[] = [];
  for (const kw of keywords) {
    const kwClean = kw.trim().toLowerCase();
    if (!kwClean) continue;
    let rowCount = 0;
    let totalOccurrences = 0;
    for (const t of texts) {
      const n = (t.match(new RegExp(kwClean.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
      if (n > 0) rowCount += 1;
      totalOccurrences += n;
    }
    counts.push({ keyword: kwClean, rowCount, totalOccurrences });
  }
  return { column: col, keywords: counts.map((c) => c.keyword), counts };
}

/** Tần số cụm từ (n-gram) — định tính. Fallback khi không có backend. */
export function computeNgramFreq(
  rows: string[][],
  col: string,
  n: number = 2,
  topN: number = 50
): { column: string; n: number; totalNgrams: number; uniqueNgrams: number; ngramFreq: { ngram: string; count: number }[] } | null {
  const headers = rows[0] || [];
  const ci = headers.indexOf(col);
  if (ci === -1 || n < 1) return null;
  const data = rows.slice(1);
  const count: Record<string, number> = {};
  let totalNgrams = 0;
  for (const r of data) {
    const t = String(r[ci] ?? "").trim().toLowerCase();
    if (!t) continue;
    const tokens = t.split(/\s+/);
    for (let i = 0; i <= tokens.length - n; i++) {
      const ngram = tokens.slice(i, i + n).join(" ");
      count[ngram] = (count[ngram] || 0) + 1;
      totalNgrams += 1;
    }
  }
  const ngramFreq = Object.entries(count)
    .map(([ngram, c]) => ({ ngram, count: c }))
    .sort((a, b) => b.count - a.count)
    .slice(0, topN);
  return { column: col, n, totalNgrams, uniqueNgrams: Object.keys(count).length, ngramFreq };
}

/** Cohen's Kappa — độ đồng nhất mã hóa 2 coder. Fallback khi không có backend. */
export function computeCohensKappa(
  rows: string[][],
  col1: string,
  col2: string
): { col1: string; col2: string; n: number; kappa: number; observedAgreement: number; expectedAgreement: number; table: Record<string, Record<string, number>> } | null {
  const headers = rows[0] || [];
  const i1 = headers.indexOf(col1);
  const i2 = headers.indexOf(col2);
  if (i1 === -1 || i2 === -1) return null;
  const data = rows.slice(1);
  const n = data.length;
  if (n === 0) return null;
  let agree = 0;
  const cnt1: Record<string, number> = {};
  const cnt2: Record<string, number> = {};
  const table: Record<string, Record<string, number>> = {};
  for (const r of data) {
    const a = String(r[i1] ?? "").trim();
    const b = String(r[i2] ?? "").trim();
    if (a === b) agree += 1;
    cnt1[a] = (cnt1[a] || 0) + 1;
    cnt2[b] = (cnt2[b] || 0) + 1;
    if (!table[a]) table[a] = {};
    table[a][b] = (table[a][b] || 0) + 1;
  }
  const p_o = agree / n;
  const labels = [...new Set([...Object.keys(cnt1), ...Object.keys(cnt2)])].sort();
  let p_e = 0;
  for (const lab of labels) {
    p_e += ((cnt1[lab] || 0) / n) * ((cnt2[lab] || 0) / n);
  }
  const kappa = p_e >= 1 ? 0 : (p_o - p_e) / (1 - p_e);
  return { col1, col2, n, kappa: Math.round(kappa * 1e4) / 1e4, observedAgreement: Math.round(p_o * 1e4) / 1e4, expectedAgreement: Math.round(p_e * 1e4) / 1e4, table };
}
