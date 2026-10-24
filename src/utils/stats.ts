/**
 * Utils: parse CSV, data profiling, descriptive statistics, t-test (client-side).
 */

import type { DataProfile, VariableMetadata } from "../types";
import { t } from "../i18n";
import { buildMissingMatcher, missingRuleSignature } from "./metadata";
import { safeMax, safeMin, safeMinMax } from "./math";

const MAX_ROWS_STORED = 50000;

/** Dòng đầu không rỗng (dùng đoán dấu phân cách CSV/TXT). */
function firstNonEmptyLine(text: string): string {
  const parts = text.split(/\r?\n/);
  for (const line of parts) {
    if (line.trim() !== "") return line;
  }
  return "";
}

/** Đoán `,` vs `;` cho file .csv (Excel/Google Form locale VN/EU hay xuất CSV phân tách bằng `;`). */
export function detectCsvDelimiter(text: string): "," | ";" {
  const line = firstNonEmptyLine(text);
  const semi = (line.match(/;/g) || []).length;
  const comma = (line.match(/,/g) || []).length;
  return semi > comma ? ";" : ",";
}

/**
 * Parse văn bản phân tách theo một ký tự (`,` hoặc `;`), có hỗ trợ trường bọc ngoặc kép.
 */
export function parseDelimited(text: string, delimiter: "," | ";"): string[][] {
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
    } else if (c === delimiter) {
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

/**
 * CSV kiểu Việt/châu Âu (phân tách `;`) viết số thập phân bằng dấu phẩy ("6,84", "1.234,5").
 * Đổi cả cột sang dạng "6.84" CHỈ KHI mọi ô không trống của cột đều là số (nguyên, thập phân dấu phẩy, hoặc có chấm hàng nghìn
 * kèm dấu phẩy thập phân) và có ít nhất một ô dùng dấu phẩy — cột văn bản/ngày/hỗn hợp giữ nguyên.
 */
export function normalizeDecimalCommaColumns(rows: string[][]): string[][] {
  if (rows.length < 2) return rows;
  const nCols = rows.reduce((m, r) => Math.max(m, r.length), 0);
  const out = rows.map((r) => r.slice());
  const reInt = /^[+-]?\d+$/;
  const reDec = /^[+-]?\d+,\d+$/;
  const reThousandsDec = /^[+-]?\d{1,3}(\.\d{3})+,\d+$/;
  for (let c = 0; c < nCols; c++) {
    let hasComma = false;
    let ok = true;
    let count = 0;
    for (let r = 1; r < rows.length; r++) {
      const v = (rows[r][c] ?? "").trim();
      if (v === "") continue;
      count++;
      if (reInt.test(v)) continue;
      if (reDec.test(v) || reThousandsDec.test(v)) { hasComma = true; continue; }
      ok = false;
      break;
    }
    if (!ok || !hasComma || count === 0) continue;
    for (let r = 1; r < out.length; r++) {
      const v = (out[r][c] ?? "").trim();
      if (v !== "") out[r][c] = v.replace(/\./g, "").replace(",", ".");
    }
  }
  return out;
}

/** Parse CSV text (dấu phẩy). Với file có thể là `;`, dùng `parseFileContent` hoặc `parseDelimited(text, detectCsvDelimiter(text))`. */
export function parseCSV(text: string): string[][] {
  return parseDelimited(text, ",");
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
export type DataFileFormat =
  | "csv"
  | "tsv"
  | "json"
  | "txt"
  | "xlsx"
  | "xls"
  | "ods"
  | "sav"
  | "dta"
  | "sas7bdat"
  | "rds"
  | "rdata";

export function getFormatFromFilename(filename: string): DataFileFormat | "csv" {
  const lower = filename.toLowerCase();
  if (lower.endsWith(".json")) return "json";
  if (lower.endsWith(".tsv")) return "tsv";
  if (lower.endsWith(".csv")) return "csv";
  if (lower.endsWith(".txt")) return "txt";
  if (lower.endsWith(".xlsx")) return "xlsx";
  if (lower.endsWith(".xls")) return "xls";
  if (lower.endsWith(".ods")) return "ods";
  if (lower.endsWith(".sav")) return "sav";
  if (lower.endsWith(".dta")) return "dta";
  if (lower.endsWith(".sas7bdat")) return "sas7bdat";
  if (lower.endsWith(".rds")) return "rds";
  if (lower.endsWith(".rdata")) return "rdata";
  return "csv";
}

/** Có phải định dạng cần đọc dưới dạng text (CSV, TSV, JSON, TXT) không. */
export function isTextFormat(format: string): boolean {
  return format === "csv" || format === "tsv" || format === "json" || format === "txt";
}

/** Có phải định dạng cần gửi lên backend để parse (Excel, ODS, SPSS, Stata, SAS, R) không. */
export function isBackendParseFormat(format: string): boolean {
  return ["xlsx", "xls", "ods", "sav", "dta", "sas7bdat", "rds", "rdata"].includes(format);
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
    const line = firstNonEmptyLine(text);
    const tabCount = (line.match(/\t/g) || []).length;
    const commaCount = (line.match(/,/g) || []).length;
    const semiCount = (line.match(/;/g) || []).length;
    const maxDelim = Math.max(tabCount, commaCount, semiCount);
    let rows: string[][];
    let format: string;
    if (maxDelim === 0) {
      rows = parseDelimited(text, ",");
      format = "csv";
    } else if (tabCount === maxDelim) {
      rows = parseTSV(text);
      format = "tsv";
    } else if (semiCount > commaCount) {
      rows = normalizeDecimalCommaColumns(parseDelimited(text, ";"));
      format = "csv";
    } else {
      rows = parseDelimited(text, ",");
      format = "csv";
    }
    return { rows, format };
  }
  const delimiter = detectCsvDelimiter(text);
  const parsed = parseDelimited(text, delimiter);
  return { rows: delimiter === ";" ? normalizeDecimalCommaColumns(parsed) : parsed, format: "csv" };
}

function isNumeric(val: string): boolean {
  if (val === "" || val === null || val === undefined || String(val).trim() === "") return false;
  const n = Number(val);
  return !Number.isNaN(n) && Number.isFinite(n);
}

/**
 * Chuyển ô dữ liệu thành số. Ô trống / chỉ có khoảng trắng / null → NaN (thiếu), KHÔNG phải 0
 * (Number("") === 0 khiến giá trị thiếu bị tính như 0 và làm lệch mọi thống kê).
 */
export function numCell(val: unknown): number {
  return toNum(val);
}

function toNum(val: unknown): number {
  if (val === null || val === undefined) return NaN;
  const s = typeof val === "string" ? val.trim() : String(val);
  if (s === "") return NaN;
  return Number(s);
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
      const ss = nums.reduce((a, b) => a + (b - mean) ** 2, 0);
      const variance = ss / n;
      const [min, max] = safeMinMax(nums);
      profile.min = min;
      profile.max = max;
      profile.mean = mean;
      // Độ lệch chuẩn MẪU (n−1) như SPSS/R/pandas và như bảng "Mô tả"; skewness G1 hiệu chỉnh theo n.
      profile.std = n > 1 ? Math.sqrt(ss / (n - 1)) : 0;
      const m3 = nums.reduce((a, b) => a + (b - mean) ** 3, 0) / n;
      const g1 = variance > 0 ? m3 / variance ** 1.5 : undefined;
      profile.skew = g1 !== undefined && n > 2 ? g1 * Math.sqrt(n * (n - 1)) / (n - 2) : g1;
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
      // Phân vị nội suy tuyến tính (như numpy/pandas/SPSS "HAVERAGE" gần đúng); median của n chẵn = trung bình hai giá trị giữa.
      const quantile = (pr: number): number => {
        if (n === 1) return sorted[0];
        const pos = (n - 1) * pr;
        const lo = Math.floor(pos);
        const hi = Math.ceil(pos);
        return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
      };
      row.mean = nums.reduce((a, b) => a + b, 0) / n;
      row.median = quantile(0.5);
      const mean = row.mean;
      const ss = nums.reduce((a, b) => a + (b - mean) ** 2, 0);
      row.std = n > 1 ? Math.sqrt(ss / (n - 1)) : 0; // độ lệch chuẩn mẫu (n−1)
      row.min = sorted[0];
      row.max = sorted[n - 1];
      row.q25 = quantile(0.25);
      row.q75 = quantile(0.75);
      row.q10 = quantile(0.1);
      row.q90 = quantile(0.9);
      const variance = ss / n;
      if (n >= 4 && variance > 0) {
        // Kurtosis dư (excess) hiệu chỉnh G2 (SPSS/pandas): ((n−1)/((n−2)(n−3)))·((n+1)·g2 + 6)
        const m4 = nums.reduce((acc, v) => acc + (v - mean) ** 4, 0) / n;
        const g2 = m4 / (variance ** 2) - 3;
        row.kurtosis = ((n - 1) / ((n - 2) * (n - 3))) * ((n + 1) * g2 + 6);
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

/** Independent samples t-test (Welch mặc định; equalVar = true → Student, phương sai gộp). */
export function computeTTest(
  rows: string[][],
  groupCol: string,
  groupVal1: string,
  groupVal2: string,
  numCol: string,
  equalVar: boolean = false
): TTestResult | null {
  const headers = rows[0];
  const gi = headers.indexOf(groupCol);
  const ni = headers.indexOf(numCol);
  if (gi === -1 || ni === -1) return null;
  const dataRows = rows.slice(1);
  const g1 = dataRows.filter((r) => String(r[gi]).trim() === groupVal1).map((r) => toNum(r[ni])).filter((v) => !Number.isNaN(v));
  const g2 = dataRows.filter((r) => String(r[gi]).trim() === groupVal2).map((r) => toNum(r[ni])).filter((v) => !Number.isNaN(v));
  return computeTTestFromSamples(g1, g2, equalVar);
}

/** t-test hai mẫu độc lập từ hai mảng số (Welch mặc định; equalVar = true → Student, phương sai gộp). */
export function computeTTestFromSamples(values1: number[], values2: number[], equalVar: boolean = false): TTestResult | null {
  const g1 = values1.filter((v) => Number.isFinite(v));
  const g2 = values2.filter((v) => Number.isFinite(v));
  if (g1.length < 2 || g2.length < 2) return null;
  const n1 = g1.length;
  const n2 = g2.length;
  const mean1 = g1.reduce((a, b) => a + b, 0) / n1;
  const mean2 = g2.reduce((a, b) => a + b, 0) / n2;
  const var1 = g1.reduce((a, b) => a + (b - mean1) ** 2, 0) / (n1 - 1) || 0;
  const var2 = g2.reduce((a, b) => a + (b - mean2) ** 2, 0) / (n2 - 1) || 0;
  const std1 = Math.sqrt(var1);
  const std2 = Math.sqrt(var2);
  const pooledStd = Math.sqrt(((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2));
  const se = equalVar ? pooledStd * Math.sqrt(1 / n1 + 1 / n2) : Math.sqrt(var1 / n1 + var2 / n2);
  if (se === 0) return null;
  const t = (mean1 - mean2) / se;
  const denom = var1 / n1 + var2 / n2;
  const df = equalVar ? n1 + n2 - 2 : denom > 0 ? (denom ** 2) / ((var1 / n1) ** 2 / (n1 - 1) + (var2 / n2) ** 2 / (n2 - 1)) : 0;
  const pValue = twoTailedPValue(t, df);
  const cohenD = pooledStd > 0 ? (mean1 - mean2) / pooledStd : 0;
  return { t, df, pValue, cohenD, mean1, mean2, n1, n2, std1, std2 };
}

/** t-test hai mẫu từ hai cột số (mỗi cột một mẫu, ô trống bỏ qua riêng từng cột — như Excel Data Analysis). */
export function computeTTestFromColumns(rows: string[][], col1: string, col2: string, equalVar: boolean = false): TTestResult | null {
  const headers = rows[0] || [];
  const i1 = headers.indexOf(col1);
  const i2 = headers.indexOf(col2);
  if (i1 < 0 || i2 < 0) return null;
  const data = rows.slice(1);
  return computeTTestFromSamples(data.map((r) => toNum(r[i1])), data.map((r) => toNum(r[i2])), equalVar);
}

/** Giá trị tới hạn t hai phía: x > 0 sao cho P(|T| ≥ x) = alpha (tương đương T.INV.2T của Excel). */
export function tCriticalTwoTail(alpha: number, df: number): number {
  if (!(df > 0) || !(alpha > 0 && alpha < 1)) return NaN;
  let lo = 0;
  let hi = 1;
  while (twoTailedPValue(hi, df) > alpha && hi < 1e9) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (twoTailedPValue(mid, df) > alpha) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

export interface TTestExcelTable {
  mean1: number;
  mean2: number;
  var1: number;
  var2: number;
  n1: number;
  n2: number;
  pooledVar: number | null;
  hypothesizedDiff: number;
  /** df hiển thị: Welch được làm tròn nguyên như Excel Data Analysis ("df 496"). */
  df: number;
  t: number;
  pOneTail: number;
  tCritOneTail: number;
  pTwoTail: number;
  tCritTwoTail: number;
  alpha: number;
}

/**
 * Bảng kết quả giống Excel "t-Test: Two-Sample Assuming Unequal/Equal Variances".
 * Excel làm tròn df (Welch) về số nguyên rồi mới tính P và giá trị tới hạn — làm vậy để số khớp từng chữ số.
 */
export function buildTTestExcelTable(res: TTestResult, equalVar: boolean, alpha = 0.05): TTestExcelTable {
  const var1 = res.std1 * res.std1;
  const var2 = res.std2 * res.std2;
  const df = equalVar ? res.n1 + res.n2 - 2 : Math.max(1, Math.round(res.df));
  const pTwoTail = twoTailedPValue(res.t, df);
  return {
    mean1: res.mean1,
    mean2: res.mean2,
    var1,
    var2,
    n1: res.n1,
    n2: res.n2,
    pooledVar: equalVar ? ((res.n1 - 1) * var1 + (res.n2 - 1) * var2) / (res.n1 + res.n2 - 2) : null,
    hypothesizedDiff: 0,
    df,
    t: res.t,
    pOneTail: pTwoTail / 2,
    tCritOneTail: tCriticalTwoTail(2 * alpha, df),
    pTwoTail,
    tCritTwoTail: tCriticalTwoTail(alpha, df),
    alpha,
  };
}

/** Two-tailed p-value for t-statistic. */
function twoTailedPValue(t: number, df: number): number {
  const absT = Math.abs(t);
  if (df <= 0) return 1;
  // Phân phối t chính xác cho mọi df (trước đây df ≥ 100 dùng xấp xỉ chuẩn nên p lệch ở chữ số thứ 3, có thể đảo kết luận quanh α = 0,05).
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
    const a = toNum(r[i1]);
    const b = toNum(r[i2]);
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
    const a = toNum(r[i1]);
    const b = toNum(r[i2]);
    if (!Number.isNaN(a) && !Number.isNaN(b)) diffs.push(a - b);
  });
  const nonZero = diffs.filter((d) => d !== 0);
  if (nonZero.length < 2) return null;
  const n = nonZero.length;
  const absD = nonZero.map((d) => Math.abs(d));
  const sorted = absD.map((v, i) => ({ v, i })).sort((a, b) => a.v - b.v);
  const ranks: number[] = new Array(n);
  let r = 0;
  let tieSum = 0; // Σ(t³ − t) trên các nhóm trùng hạng (hiệu chỉnh phương sai như scipy/SPSS)
  while (r < sorted.length) {
    let end = r;
    while (end < sorted.length && sorted[end].v === sorted[r].v) end++;
    const avgRank = (r + 1 + end) / 2;
    for (let t = r; t < end; t++) ranks[sorted[t].i] = avgRank;
    const tieLen = end - r;
    tieSum += tieLen * tieLen * tieLen - tieLen;
    r = end;
  }
  let wPlus = 0;
  for (let i = 0; i < n; i++) if (nonZero[i] > 0) wPlus += ranks[i];
  const wMinus = (n * (n + 1)) / 2 - wPlus;
  const w = Math.min(wPlus, wMinus);
  const meanW = (n * (n + 1)) / 4;
  const stdW = Math.sqrt(Math.max(0, (n * (n + 1) * (2 * n + 1)) / 24 - tieSum / 48));
  const z = stdW > 0 ? (w - meanW) / stdW : 0;
  const pValue = 2 * (1 - normalCDF(Math.abs(z)));
  const sortedD = [...nonZero].sort((a, b) => a - b);
  const medianDiff = n % 2 ? sortedD[(n - 1) / 2] : (sortedD[n / 2 - 1] + sortedD[n / 2]) / 2;
  return { w, z, pValue, n, medianDiff };
}

/** erfc(x) chính xác (chuỗi Taylor cho |x| < 3, liên phân số cho phần đuôi) — sai số tương đối ~1e-13. */
function erfcAccurate(x: number): number {
  if (Number.isNaN(x)) return NaN;
  const ax = Math.abs(x);
  let v: number;
  if (ax < 3) {
    // erf(x) = 2/sqrt(pi) * sum_{n>=0} (-1)^n x^(2n+1) / (n! (2n+1))
    let term = ax;
    let sum = ax;
    const x2 = ax * ax;
    for (let n = 1; n < 200; n++) {
      term *= -x2 / n;
      const add = term / (2 * n + 1);
      sum += add;
      if (Math.abs(add) < 1e-17 * Math.abs(sum)) break;
    }
    v = 1 - (2 / Math.sqrt(Math.PI)) * sum;
  } else {
    // erfc(x) = exp(-x^2)/(x sqrt(pi)) * 1/(1+ 1/(2x^2)/(1+ 2/(2x^2)/(1+ ...))) — liên phân số Lentz
    const tiny = 1e-300;
    let f = ax;
    let C = ax;
    let D = 0;
    for (let k = 1; k < 500; k++) {
      const a = k / 2;
      D = ax + a * D;
      if (D === 0) D = tiny;
      C = ax + a / C;
      if (C === 0) C = tiny;
      D = 1 / D;
      const delta = C * D;
      f *= delta;
      if (Math.abs(delta - 1) < 1e-15) break;
    }
    v = Math.exp(-ax * ax) / (f * Math.sqrt(Math.PI));
  }
  return x >= 0 ? v : 2 - v;
}

/** Hàm phân phối chuẩn tắc Φ(z) = ½·erfc(−z/√2) (trước đây dùng công thức erf nhầm đối số nên p-value lệch). */
function normalCDF(z: number): number {
  return 0.5 * erfcAccurate(-z / Math.SQRT2);
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
  const maxIter = 1000;
  const epsilon = 1e-12;
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

/**
 * Cache theo mảng hàng gốc: tránh dựng lại bản sao 100.000 dòng mỗi lần render.
 * Khóa phụ là chữ ký quy tắc khuyết của từng cột nên sửa mã khuyết thì cache tự làm mới.
 */
const analysisRowsCache = new WeakMap<string[][], Map<string, string[][]>>();
const ANALYSIS_CACHE_PER_ROWS = 4;

/**
 * ĐIỂM DUY NHẤT tạo «dữ liệu sẵn sàng phân tích» của một dataset.
 *
 * Giống `getDataRows` ([header, ...rows]) nhưng mọi ô trùng mã khuyết người dùng khai báo
 * (`variables[col].missingValues` rời rạc và/hoặc `missingRange` kiểu SPSS) được thay bằng "" —
 * cùng quy ước với ô trống (không bao giờ bị coi là 0), nên mọi hàm thống kê tự loại chúng
 * (N hữu hiệu, Missing, deletion listwise/pairwise…).
 *
 * MỌI tab phân tích / biểu đồ / gửi dữ liệu lên backend Python phải lấy hàng qua hàm này.
 * Chỉ lưới dữ liệu (DataGrid/Variable View) và thao tác sửa giá trị (recode, lọc, sắp xếp, đổi tên…)
 * mới dùng `getDataRows` để còn thấy và sửa được mã gốc (vd: 99).
 *
 * Không có biến nào khai báo mã khuyết (hoặc dataset cũ chưa có `variables`) thì trả đúng mảng gốc,
 * không sao chép. Không bao giờ sửa dữ liệu gốc.
 */
export function getAnalysisRows(
  d: { preview?: string[][]; data?: string[][]; variables?: Record<string, VariableMetadata> } | null | undefined
): string[][] {
  const rows = getDataRows(d);
  const variables = d?.variables;
  if (rows.length < 2 || !variables) return rows;
  const header = rows[0];
  const matchers: (((trimmed: string) => boolean) | null)[] = [];
  const active: number[] = [];
  let signature = "";
  for (let ci = 0; ci < header.length; ci++) {
    const meta = variables[String(header[ci])];
    const sig = missingRuleSignature(meta);
    if (sig === "") {
      matchers.push(null);
      continue;
    }
    matchers.push(buildMissingMatcher(meta));
    if (matchers[ci]) {
      active.push(ci);
      signature += `${ci}:${sig};`;
    }
  }
  if (active.length === 0) return rows;
  let perRows = analysisRowsCache.get(rows);
  const hit = perRows?.get(signature);
  if (hit) return hit;
  const out: string[][] = new Array(rows.length);
  out[0] = header;
  for (let i = 1; i < rows.length; i++) {
    const row = rows[i];
    let copy: string[] | null = null;
    for (const ci of active) {
      const v = row[ci];
      if (v === undefined || v === null) continue;
      const trimmed = String(v).trim();
      if (trimmed !== "" && matchers[ci]!(trimmed)) {
        if (!copy) copy = row.slice();
        copy[ci] = "";
      }
    }
    out[i] = copy ?? row;
  }
  if (!perRows) {
    perRows = new Map();
    analysisRowsCache.set(rows, perRows);
  }
  if (perRows.size >= ANALYSIS_CACHE_PER_ROWS) perRows.delete(perRows.keys().next().value as string);
  perRows.set(signature, out);
  return out;
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
    const a = toNum(r[i1]);
    const b = toNum(r[i2]);
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
  /** χ² có hiệu chỉnh liên tục (Edwards): (|b − c| − 1)² / (b + c), df = 1 — giống R mcnemar.test(correct = TRUE). */
  chi2: number;
  pValue: number;
  nDiscordant: number;
  b: number;
  c: number;
  /** χ² không hiệu chỉnh (b − c)² / (b + c), để đối chiếu. */
  chi2Uncorrected: number;
  /** p chính xác (nhị thức hai phía, p0 = 0,5) — nên dùng khi b + c < 25. */
  exactPValue: number | null;
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
  const chi2Uncorrected = (b - c) ** 2 / nDiscordant;
  // Hiệu chỉnh liên tục (Edwards, 1948): trừ 1 khỏi |b − c| (mặc định của R/statsmodels; SPSS dùng nhị thức chính xác khi b + c ≤ 25).
  const chi2 = (Math.abs(b - c) - 1) ** 2 / nDiscordant;
  const pValue = chiSquareSurvival(chi2, 1);
  const exactPValue = computeBinomialTest(Math.min(b, c), nDiscordant, 0.5)?.pValueTwoTailed ?? null;
  return { chi2, pValue, nDiscordant, b, c, chi2Uncorrected, exactPValue };
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
  let tieTerm = 0; // Σ(t³ − t) để hiệu chỉnh phương sai khi có trùng hạng
  let i = 0;
  while (i < all.length) {
    let j = i;
    while (j < all.length && all[j].v === all[i].v) j++;
    const tieCount = j - i;
    const avgRank = (2 * (i + 1) + tieCount - 1) / 2;
    for (let k = i; k < j; k++) ranks[k] = avgRank;
    tieTerm += tieCount * tieCount * tieCount - tieCount;
    i = j;
  }
  let rankSum1 = 0;
  for (let k = 0; k < all.length; k++) if (all[k].g === 1) rankSum1 += ranks[k];
  const u1 = n1 * n2 + (n1 * (n1 + 1)) / 2 - rankSum1;
  const u2 = n1 * n2 - u1;
  const u = Math.min(u1, u2);
  const meanU = (n1 * n2) / 2;
  const nTot = n1 + n2;
  const stdU = Math.sqrt(Math.max(0, (n1 * n2 / 12) * ((nTot + 1) - (nTot > 1 ? tieTerm / (nTot * (nTot - 1)) : 0))));
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

  // Kendall τ-b theo Knight (O(n log n)): sắp theo (x, y), đếm nghịch thế của y bằng merge sort — kết quả trùng scipy.stats.kendalltau.
  const kendallTau = (x: number[], y: number[]): number => {
    const nn = x.length;
    if (nn < 2) return 0;
    const idx = Array.from({ length: nn }, (_, i) => i).sort((a, b) => x[a] - x[b] || y[a] - y[b]);
    const xs = idx.map((i) => x[i]);
    const ys = idx.map((i) => y[i]);
    const tieCount = (arr: number[]): number => {
      let total = 0;
      let run = 1;
      for (let i = 1; i <= arr.length; i++) {
        if (i < arr.length && arr[i] === arr[i - 1]) run++;
        else { total += (run * (run - 1)) / 2; run = 1; }
      }
      return total;
    };
    const xtie = tieCount(xs);
    // cặp trùng cả x lẫn y (đã sắp theo (x, y) nên các cặp này liền nhau)
    let ntie = 0;
    {
      let run = 1;
      for (let i = 1; i <= nn; i++) {
        if (i < nn && xs[i] === xs[i - 1] && ys[i] === ys[i - 1]) run++;
        else { ntie += (run * (run - 1)) / 2; run = 1; }
      }
    }
    // số nghịch thế (i < j, ys[i] > ys[j]) bằng merge sort
    const buf = new Array<number>(nn);
    const countInversions = (a: number[], lo: number, hi: number): number => {
      if (hi - lo < 2) return 0;
      const mid = (lo + hi) >> 1;
      let inv = countInversions(a, lo, mid) + countInversions(a, mid, hi);
      let i = lo, j = mid, k = lo;
      while (i < mid && j < hi) {
        if (a[i] <= a[j]) buf[k++] = a[i++];
        else { buf[k++] = a[j++]; inv += mid - i; }
      }
      while (i < mid) buf[k++] = a[i++];
      while (j < hi) buf[k++] = a[j++];
      for (let m = lo; m < hi; m++) a[m] = buf[m];
      return inv;
    };
    const dis = countInversions(ys.slice(), 0, nn);
    const ysSorted = [...ys].sort((a, b) => a - b);
    const ytie = tieCount(ysSorted);
    const tot = (nn * (nn - 1)) / 2;
    const denom = Math.sqrt((tot - xtie) * (tot - ytie));
    if (denom <= 0) return 0;
    return (tot - xtie - ytie + ntie - 2 * dis) / denom;
  };

  for (let i = 0; i < numericIndices.length; i++) {
    matrix[i][i] = 1;
    for (let j = i + 1; j < numericIndices.length; j++) {
      const ci = numericIndices[i];
      const cj = numericIndices[j];
      const pairs: [number, number][] = [];
      data.forEach((r) => {
        const a = toNum(r[ci]);
        const b = toNum(r[cj]);
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
    const v1 = toNum(r[i1]);
    const v2 = toNum(r[i2]);
    if (Number.isNaN(v1) || Number.isNaN(v2)) return false;
    return controlIndices.every((ci) => r[ci] !== "" && !Number.isNaN(toNum(r[ci])));
  });
  if (validRows.length < 3) return null;
  if (controlCols.length === 0) {
    const x = validRows.map((r) => toNum(r[i1]));
    const y = validRows.map((r) => toNum(r[i2]));
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
    const x = validRows.map((r) => toNum(r[i1]));
    const y = validRows.map((r) => toNum(r[i2]));
    const z = validRows.map((r) => toNum(r[ic]));
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
      xCols.forEach((c, i) => { pred += (res.coefficients[c] ?? 0) * toNum(r[xIdxs[i]]); });
      return toNum(r[yIdx]) - pred;
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
    const v = toNum(r[vi]);
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

/** Phân vị dưới của phân phối F: x sao cho P(F ≤ x) = p (tương đương F.INV của Excel). */
export function fQuantile(p: number, df1: number, df2: number): number {
  if (!(df1 > 0) || !(df2 > 0) || !(p > 0 && p < 1)) return NaN;
  let lo = 0;
  let hi = 1;
  while (fCDF(hi, df1, df2) < p && hi < 1e9) hi *= 2;
  for (let i = 0; i < 200; i++) {
    const mid = (lo + hi) / 2;
    if (fCDF(mid, df1, df2) < p) lo = mid;
    else hi = mid;
  }
  return (lo + hi) / 2;
}

/** Giá trị tới hạn F một phía phải (tương đương F.INV.RT của Excel → cột "F crit" trong Anova: Single Factor). */
export function fCritical(alpha: number, df1: number, df2: number): number {
  return fQuantile(1 - alpha, df1, df2);
}

/**
 * Dữ liệu dạng rộng (mỗi cột = một nhóm, như Excel "Anova: Single Factor") → dạng dài [__group, __value]
 * để dùng chung computeOneWayANOVA. Ô trống / không phải số bị bỏ qua; thứ tự nhóm theo thứ tự cột chọn.
 */
export function wideToLongRows(rows: string[][], cols: string[]): string[][] {
  const headers = rows[0] || [];
  const out: string[][] = [["__group", "__value"]];
  cols.forEach((c) => {
    const ci = headers.indexOf(c);
    if (ci < 0) return;
    rows.slice(1).forEach((r) => {
      if (!Number.isNaN(toNum(r[ci]))) out.push([c, String(r[ci])]);
    });
  });
  return out;
}

export interface AnovaTable {
  groups: { group: string; n: number; sum: number; mean: number; variance: number; std: number }[];
  ssBetween: number;
  ssWithin: number;
  ssTotal: number;
  dfBetween: number;
  dfWithin: number;
  dfTotal: number;
  msBetween: number;
  msWithin: number;
  f: number;
  pValue: number;
  fCrit: number;
  alpha: number;
}

/** Bảng SUMMARY + ANOVA (Between / Within / Total, F, P-value, F crit) dựng từ n, trung bình, SD từng nhóm. */
export function buildAnovaTable(groupMeans: { group: string; n: number; mean: number; std: number }[], alpha = 0.05): AnovaTable | null {
  const gs = groupMeans.filter((g) => g.n > 0);
  const k = gs.length;
  const N = gs.reduce((a, g) => a + g.n, 0);
  if (k < 2 || N <= k) return null;
  const grand = gs.reduce((a, g) => a + g.n * g.mean, 0) / N;
  const ssBetween = gs.reduce((a, g) => a + g.n * (g.mean - grand) ** 2, 0);
  const ssWithin = gs.reduce((a, g) => a + (g.n - 1) * g.std * g.std, 0);
  const dfBetween = k - 1;
  const dfWithin = N - k;
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;
  const f = msWithin > 0 ? msBetween / msWithin : 0;
  const pValue = msWithin > 0 ? 1 - fCDF(f, dfBetween, dfWithin) : 1;
  return {
    groups: gs.map((g) => ({ group: g.group, n: g.n, sum: g.n * g.mean, mean: g.mean, variance: g.std * g.std, std: g.std })),
    ssBetween,
    ssWithin,
    ssTotal: ssBetween + ssWithin,
    dfBetween,
    dfWithin,
    dfTotal: N - 1,
    msBetween,
    msWithin,
    f,
    pValue,
    fCrit: fCritical(alpha, dfBetween, dfWithin),
    alpha,
  };
}

export interface FTestTwoSampleResult {
  label1: string;
  label2: string;
  mean1: number;
  mean2: number;
  var1: number;
  var2: number;
  n1: number;
  n2: number;
  df1: number;
  df2: number;
  f: number;
  /** P(F ≤ f) một phía khi F < 1, P(F ≥ f) khi F ≥ 1 — giống dòng "P(F<=f) one-tail" của Excel. */
  pOneTail: number;
  /** F tới hạn một phía (trái khi F < 1, phải khi F ≥ 1) tại α — "F Critical one-tail" của Excel. */
  fCritOneTail: number;
  pTwoTail: number;
  alpha: number;
  tail: "left" | "right";
}

/** F-test hai mẫu cho phương sai (H0: σ1² = σ2²), tương đương Excel "F-Test Two-Sample for Variances". */
export function computeFTestTwoSample(values1: number[], values2: number[], label1: string, label2: string, alpha = 0.05): FTestTwoSampleResult | null {
  const a = values1.filter((v) => Number.isFinite(v));
  const b = values2.filter((v) => Number.isFinite(v));
  if (a.length < 2 || b.length < 2) return null;
  const stat = (x: number[]) => {
    const n = x.length;
    const mean = x.reduce((s, v) => s + v, 0) / n;
    const variance = x.reduce((s, v) => s + (v - mean) ** 2, 0) / (n - 1);
    return { n, mean, variance };
  };
  const s1 = stat(a);
  const s2 = stat(b);
  if (!(s2.variance > 0)) return null;
  const df1 = s1.n - 1;
  const df2 = s2.n - 1;
  const f = s1.variance / s2.variance;
  const left = f < 1;
  const cdf = fCDF(f, df1, df2);
  const pOneTail = left ? cdf : 1 - cdf;
  const fCritOneTail = left ? fQuantile(alpha, df1, df2) : fCritical(alpha, df1, df2);
  return {
    label1, label2,
    mean1: s1.mean, mean2: s2.mean,
    var1: s1.variance, var2: s2.variance,
    n1: s1.n, n2: s2.n,
    df1, df2, f,
    pOneTail,
    fCritOneTail,
    pTwoTail: Math.min(1, 2 * pOneTail),
    alpha,
    tail: left ? "left" : "right",
  };
}

/** F-test từ hai cột số (mỗi cột một mẫu, ô trống bị bỏ qua riêng từng cột — như Excel). */
export function computeFTestFromColumns(rows: string[][], col1: string, col2: string, alpha = 0.05): FTestTwoSampleResult | null {
  const headers = rows[0] || [];
  const i1 = headers.indexOf(col1);
  const i2 = headers.indexOf(col2);
  if (i1 < 0 || i2 < 0) return null;
  const data = rows.slice(1);
  return computeFTestTwoSample(data.map((r) => toNum(r[i1])), data.map((r) => toNum(r[i2])), col1, col2, alpha);
}

/** F-test từ một cột nhóm + một cột số (hai giá trị nhóm được chọn). */
export function computeFTestFromGroups(rows: string[][], groupCol: string, group1: string, group2: string, numCol: string, alpha = 0.05): FTestTwoSampleResult | null {
  const headers = rows[0] || [];
  const gi = headers.indexOf(groupCol);
  const vi = headers.indexOf(numCol);
  if (gi < 0 || vi < 0) return null;
  const data = rows.slice(1);
  const pick = (g: string) => data.filter((r) => String(r[gi] ?? "").trim() === g).map((r) => toNum(r[vi]));
  return computeFTestTwoSample(pick(group1), pick(group2), `${groupCol} = ${group1}`, `${groupCol} = ${group2}`, alpha);
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
    const v = toNum(r[vi]);
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
    const v = toNum(r[vi]);
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
  // Tổng số quan sát HỢP LỆ (bỏ ô trống / nhóm trống) — không dùng data.length (kể cả dòng thiếu) làm df2 và mẫu số.
  const n = groupNames.reduce((s, name) => s + absDevs[name].length, 0);
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
  // Chỉ dùng các khối (dòng) đầy đủ ở mọi điều kiện (listwise) — ô trống không được tính là 0 hay bỏ dở.
  const data = rows.slice(1).filter((r) => indices.every((ci) => !Number.isNaN(toNum(r[ci]))));
  const nBlocks = data.length;
  const k = indices.length;
  if (nBlocks < 2) return null;
  let tieSum = 0; // Σ(t³ − t) trên mọi khối (hiệu chỉnh trùng hạng như SPSS/scipy)
  const rankInRow = (row: string[]): number[] => {
    const vals = indices.map((ci, pos) => ({ v: toNum(row[ci]), pos }));
    const sorted = [...vals].sort((a, b) => a.v - b.v);
    const out: number[] = new Array(indices.length).fill(NaN);
    let r = 0;
    while (r < sorted.length) {
      let end = r;
      while (end < sorted.length && sorted[end].v === sorted[r].v) end++;
      const avgRank = (r + 1 + end) / 2;
      for (let t = r; t < end; t++) out[sorted[t].pos] = avgRank;
      const tl = end - r;
      tieSum += tl * tl * tl - tl;
      r = end;
    }
    return out;
  };
  const rankMatrix: number[][] = data.map((r) => rankInRow(r));
  const Rj = indices.map((_, j) => rankMatrix.reduce((s, row) => s + row[j], 0));
  const sumRjSq = Rj.reduce((s, r) => s + r * r, 0);
  let chi2 = (12 / (nBlocks * k * (k + 1))) * sumRjSq - 3 * nBlocks * (k + 1);
  const tieDen = 1 - tieSum / (nBlocks * k * (k * k - 1));
  if (tieDen > 0) chi2 = chi2 / tieDen;
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
  // Listwise: chỉ dùng các dòng có đủ giá trị số ở mọi biến (ô trống KHÔNG được tính là 0).
  const data = rows.slice(1).filter((r) => indices.every((ci) => !Number.isNaN(toNum(r[ci]))));
  const itemVars: number[] = [];
  let totalVar = 0;
  const n = data.length;
  if (n < 3) return null;
  const itemSums = data.map((r) => {
    let s = 0;
    indices.forEach((ci) => { s += toNum(r[ci]); });
    return s;
  });
  const totalMean = itemSums.reduce((a, b) => a + b, 0) / n;
  totalVar = itemSums.reduce((s, v) => s + (v - totalMean) ** 2, 0) / n;
  indices.forEach((ci) => {
    const vals = data.map((r) => toNum(r[ci])).filter((v) => !Number.isNaN(v));
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

/** Một dòng của bảng "Item-Total Statistics" (kiểu SPSS) cho một biến quan sát. */
export interface CronbachItemRow {
  name: string;
  /** Trung bình thang đo khi loại biến này (Scale Mean if Item Deleted) */
  scaleMeanIfDeleted: number;
  /** Phương sai thang đo khi loại biến này (Scale Variance if Item Deleted, mẫu n−1) */
  scaleVarianceIfDeleted: number;
  /** Tương quan biến–tổng hiệu chỉnh: Pearson giữa biến i và tổng các biến còn lại */
  correctedItemTotal: number | null;
  /** Cronbach's alpha tính lại khi loại biến này (null nếu chỉ còn <2 biến) */
  alphaIfDeleted: number | null;
  /** Corrected Item-Total < 0,3 */
  lowItemTotal: boolean;
  /** Loại biến này làm α tăng (so với α hiện tại, làm tròn 3 chữ số) */
  raisesAlphaIfDeleted: boolean;
}

export interface CronbachDetail {
  alpha: number;
  nItems: number;
  /** Số quan sát đầy đủ (listwise) dùng để tính */
  nCases: number;
  items: CronbachItemRow[];
}

/**
 * Cronbach's alpha + bảng theo từng biến (Scale Mean/Variance if Item Deleted,
 * Corrected Item-Total Correlation, Cronbach's Alpha if Item Deleted).
 * Chỉ dùng các dòng có đủ giá trị số ở mọi biến được chọn (listwise, giống SPSS/backend Python).
 */
export function computeCronbachDetail(rows: string[][], columnNames: string[]): CronbachDetail | null {
  if (rows.length < 4 || columnNames.length < 2) return null;
  const headers = rows[0] || [];
  const names = columnNames.filter((c) => headers.indexOf(c) >= 0);
  const idx = names.map((c) => headers.indexOf(c));
  const k = idx.length;
  if (k < 2) return null;
  const data: number[][] = [];
  for (let r = 1; r < rows.length; r++) {
    const row = rows[r];
    const vals: number[] = new Array(k);
    let ok = true;
    for (let j = 0; j < k; j++) {
      const raw = row[idx[j]];
      const v = raw === undefined || raw === null || String(raw).trim() === "" ? NaN : Number(raw);
      if (Number.isNaN(v)) { ok = false; break; }
      vals[j] = v;
    }
    if (ok) data.push(vals);
  }
  const n = data.length;
  if (n < 3) return null;
  const total = data.map((r) => r.reduce((a, b) => a + b, 0));
  const meanOf = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;
  const varOf = (a: number[]) => { const m = meanOf(a); return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1); };
  const itemCols = names.map((_, j) => data.map((r) => r[j]));
  const itemVar = itemCols.map(varOf);
  const totalVar = varOf(total);
  if (!(totalVar > 0)) return null;
  const alphaOf = (kk: number, sumItemVar: number, tv: number) => (kk / (kk - 1)) * (1 - sumItemVar / tv);
  const sumVar = itemVar.reduce((a, b) => a + b, 0);
  const alpha = alphaOf(k, sumVar, totalVar);
  const round3 = (x: number) => Math.round(x * 1000) / 1000;
  const items: CronbachItemRow[] = names.map((name, j) => {
    const rest = total.map((tt, i) => tt - data[i][j]);
    const restMean = meanOf(rest);
    const restVar = varOf(rest);
    let corrected: number | null = null;
    if (itemVar[j] > 0 && restVar > 0) {
      const mi = meanOf(itemCols[j]);
      let cov = 0;
      for (let i = 0; i < n; i++) cov += (itemCols[j][i] - mi) * (rest[i] - restMean);
      cov /= n - 1;
      corrected = cov / Math.sqrt(itemVar[j] * restVar);
    }
    let alphaIfDeleted: number | null = null;
    if (k >= 3 && restVar > 0) alphaIfDeleted = alphaOf(k - 1, sumVar - itemVar[j], restVar);
    return {
      name,
      scaleMeanIfDeleted: restMean,
      scaleVarianceIfDeleted: restVar,
      correctedItemTotal: corrected,
      alphaIfDeleted,
      lowItemTotal: corrected != null && corrected < 0.3,
      raisesAlphaIfDeleted: alphaIfDeleted != null && round3(alphaIfDeleted) > round3(alpha),
    };
  });
  return { alpha, nItems: k, nCases: n, items };
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
    const yv = toNum(r[yi]);
    if (Number.isNaN(yv)) continue;
    let ok = true;
    const row = [1];
    for (const xi of xIndices) {
      const v = toNum(r[xi]);
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
  // Khoảng tin cậy (credible interval) 95% chính xác theo phân vị 2,5% và 97,5% của Beta(α, β)
  // (không dùng xấp xỉ chuẩn mean ± 1,96·SD vì sai khi n nhỏ hoặc tỉ lệ gần 0/1).
  const betaQuantile = (pr: number): number => {
    let lo = 0;
    let hi = 1;
    for (let it = 0; it < 80; it++) {
      const mid = (lo + hi) / 2;
      if (regularizedIncompleteBeta(mid, postAlpha, postBeta) < pr) lo = mid;
      else hi = mid;
    }
    return (lo + hi) / 2;
  };
  const ci95Lower = betaQuantile(0.025);
  const ci95Upper = betaQuantile(0.975);
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
    const row = indices.map((ci) => toNum(rows[i][ci]));
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
    const v = toNum(r[vi]);
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
  const [min, max] = safeMinMax(valid);
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

/** Simple Gaussian KDE: evaluate density at points `at` given samples. bandwidth: Silverman's rule of thumb if not provided. */
export function kernelDensityEstimate(samples: number[], at: number[], bandwidth?: number): { x: number; density: number }[] {
  const valid = samples.filter((v) => !Number.isNaN(v));
  if (valid.length === 0) return at.map((x) => ({ x, density: 0 }));
  const n = valid.length;
  const std = Math.sqrt(valid.reduce((s, v) => s + (v - valid.reduce((a, b) => a + b, 0) / n) ** 2, 0) / n) || 1;
  const h = bandwidth ?? 1.06 * std * n ** -0.2;
  const gaussian = (u: number) => Math.exp(-0.5 * u * u) / Math.sqrt(2 * Math.PI);
  return at.map((x) => {
    const density = valid.reduce((sum, xi) => sum + gaussian((x - xi) / h), 0) / (n * h);
    return { x, density };
  });
}

/** Bin numeric values into equal-interval or custom buckets for pie chart. */
export function binNumericForPie(
  values: number[],
  binCount: number = 4,
  customBreaks?: number[]
): { label: string; count: number; binStart: number; binEnd: number }[] {
  const valid = values.filter((v) => !Number.isNaN(v));
  if (valid.length === 0) return [];
  const [min, max] = safeMinMax(valid);
  const breaks: number[] = customBreaks?.length
    ? [...customBreaks].sort((a, b) => a - b)
    : (() => {
        const step = (max - min) / binCount || 1;
        const out: number[] = [min];
        for (let i = 1; i < binCount; i++) out.push(min + i * step);
        out.push(max + 0.0001);
        return out;
      })();
  const result: { label: string; count: number; binStart: number; binEnd: number }[] = [];
  for (let i = 0; i < breaks.length - 1; i++) {
    const binStart = breaks[i];
    const binEnd = breaks[i + 1];
    const count = valid.filter((v) => v >= binStart && (i === breaks.length - 2 ? v <= binEnd : v < binEnd)).length;
    const label =
      i === 0
        ? `< ${binEnd.toFixed(2)}`
        : i === breaks.length - 2
          ? `≥ ${binStart.toFixed(2)}`
          : `${binStart.toFixed(2)} – ${binEnd.toFixed(2)}`;
    result.push({ label, count, binStart, binEnd });
  }
  return result;
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
    const yv = toNum(r[yi]);
    if (yv !== 0 && yv !== 1) continue;
    let ok = true;
    const row = [1];
    for (const xi of xIndices) {
      const v = toNum(r[xi]);
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
    // IRLS: (XᵀWX)⁻¹XᵀWz CHÍNH LÀ β mới (không phải số gia) — trước đây cộng dồn vào β cũ làm hội tụ sai.
    const newBeta = inv.map((row) => row.reduce((s, v, k) => s + v * XtWz[k], 0));
    let maxD = 0;
    for (let j = 0; j < p; j++) {
      maxD = Math.max(maxD, Math.abs(newBeta[j] - beta[j]));
      beta[j] = newBeta[j];
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
  const data = rows.slice(1).map((r) => indices.map((ci) => toNum(r[ci]))).filter((row) => row.every((v) => !Number.isNaN(v)));
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
  // EFA/PCA theo MA TRẬN TƯƠNG QUAN (chuẩn hoá từng biến) như SPSS/R, để biến khác thang đo không lấn át nhau.
  const sdv = cov.map((row, i) => Math.sqrt(row[i]));
  for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) {
    const d = sdv[i] * sdv[j];
    cov[i][j] = d > 0 ? cov[i][j] / d : (i === j ? 1 : 0);
  }
  const { eigenvalues, eigenvectors } = eigenDecomposition(cov);
  const K = nFactors ?? Math.min(p, eigenvalues.filter((e) => e > 1).length || 1);
  const loadings = eigenvectors.map((ev, i) => ev.map((v, j) => v * Math.sqrt(Math.max(0, eigenvalues[j]))));
  const rotated = varimax(loadings.slice(0, p).map((row) => row.slice(0, K)));
  const totalVar = eigenvalues.reduce((a, b) => a + b, 0);
  const varianceExplained = eigenvalues.slice(0, K).map((e) => (e / totalVar) * 100);
  return { eigenvalues: eigenvalues.slice(0, p), varianceExplained, loadings: rotated, columnNames: colNames, nFactors: K };
}

/** Xác suất đuôi phải của χ² (survival function), chính xác cả khi p rất nhỏ. */
function chiSquareSurvival(x: number, df: number): number {
  if (df <= 0) return NaN;
  if (x <= 0) return 1;
  const a = df / 2;
  const xx = x / 2;
  const lg = logGamma(a);
  if (xx < a + 1) {
    // chuỗi cho P(a, x), Q = 1 − P
    let ap = a; let sum = 1 / a; let del = sum;
    for (let n = 0; n < 1000; n++) {
      ap += 1; del *= xx / ap; sum += del;
      if (Math.abs(del) < Math.abs(sum) * 1e-15) break;
    }
    return Math.max(0, Math.min(1, 1 - sum * Math.exp(-xx + a * Math.log(xx) - lg)));
  }
  // phân số liên tục (Lentz) cho Q(a, x)
  const tiny = 1e-300;
  let b = xx + 1 - a; let c = 1 / tiny; let d = 1 / b; let h = d;
  for (let i = 1; i <= 1000; i++) {
    const an = -i * (i - a);
    b += 2;
    d = an * d + b; if (Math.abs(d) < tiny) d = tiny;
    c = b + an / c; if (Math.abs(c) < tiny) c = tiny;
    d = 1 / d;
    const delta = d * c; h *= delta;
    if (Math.abs(delta - 1) < 1e-15) break;
  }
  return Math.max(0, Math.min(1, Math.exp(-xx + a * Math.log(xx) - lg) * h));
}

export interface KMOBartlettResult {
  columnNames: string[];
  /** Số quan sát đầy đủ (listwise) */
  n: number;
  /** KMO tổng thể; null nếu ma trận tương quan suy biến (không nghịch đảo được) */
  kmo: number | null;
  /** MSA theo từng biến (đường chéo anti-image) */
  msa: (number | null)[];
  /** Bartlett: χ², df, p; null nếu det(R) ≤ 0 */
  bartlettChi2: number | null;
  bartlettDf: number;
  bartlettP: number | null;
  /** det(R) */
  determinant: number;
  singular: boolean;
}

/** KMO (tổng thể + MSA từng biến) và kiểm định cầu Bartlett từ ma trận tương quan R. */
export function computeKMOBartlett(rows: string[][], columnNames: string[]): KMOBartlettResult | null {
  if (rows.length < 4 || columnNames.length < 2) return null;
  const headers = rows[0] || [];
  const names = columnNames.filter((c) => headers.indexOf(c) >= 0);
  const idx = names.map((c) => headers.indexOf(c));
  const p = idx.length;
  if (p < 2) return null;
  const data: number[][] = [];
  for (let r = 1; r < rows.length; r++) {
    const vals: number[] = new Array(p);
    let ok = true;
    for (let j = 0; j < p; j++) {
      const raw = rows[r][idx[j]];
      const v = raw === undefined || raw === null || String(raw).trim() === "" ? NaN : Number(raw);
      if (Number.isNaN(v)) { ok = false; break; }
      vals[j] = v;
    }
    if (ok) data.push(vals);
  }
  const n = data.length;
  if (n <= p) return null;
  const mean = names.map((_, j) => data.reduce((s, r) => s + r[j], 0) / n);
  const sd = names.map((_, j) => Math.sqrt(data.reduce((s, r) => s + (r[j] - mean[j]) ** 2, 0) / (n - 1)));
  if (sd.some((x) => !(x > 0))) return { columnNames: names, n, kmo: null, msa: names.map(() => null), bartlettChi2: null, bartlettDf: (p * (p - 1)) / 2, bartlettP: null, determinant: 0, singular: true };
  const R: number[][] = Array.from({ length: p }, () => Array(p).fill(0));
  for (let i = 0; i < p; i++) {
    R[i][i] = 1;
    for (let j = i + 1; j < p; j++) {
      let s = 0;
      for (let r = 0; r < n; r++) s += (data[r][i] - mean[i]) * (data[r][j] - mean[j]);
      R[i][j] = R[j][i] = s / (n - 1) / (sd[i] * sd[j]);
    }
  }
  // log|R| và nghịch đảo bằng Gauss-Jordan có chọn pivot
  let logDet = 0; let sign = 1; let singular = false;
  const aug: number[][] = R.map((row, i) => [...row, ...Array.from({ length: p }, (_, j) => (i === j ? 1 : 0))]);
  for (let col = 0; col < p; col++) {
    let piv = col;
    for (let r = col + 1; r < p; r++) if (Math.abs(aug[r][col]) > Math.abs(aug[piv][col])) piv = r;
    if (Math.abs(aug[piv][col]) < 1e-12) { singular = true; break; }
    if (piv !== col) { [aug[col], aug[piv]] = [aug[piv], aug[col]]; sign = -sign; }
    const d = aug[col][col];
    logDet += Math.log(Math.abs(d)); if (d < 0) sign = -sign;
    for (let j = 0; j < 2 * p; j++) aug[col][j] /= d;
    for (let r = 0; r < p; r++) {
      if (r === col) continue;
      const f = aug[r][col];
      if (f !== 0) for (let j = 0; j < 2 * p; j++) aug[r][j] -= f * aug[col][j];
    }
  }
  const df = (p * (p - 1)) / 2;
  if (singular || sign < 0) {
    return { columnNames: names, n, kmo: null, msa: names.map(() => null), bartlettChi2: null, bartlettDf: df, bartlettP: null, determinant: singular ? 0 : sign * Math.exp(logDet), singular: true };
  }
  const S = aug.map((row) => row.slice(p));
  let rSq = 0; let qSq = 0;
  const rSqI = Array(p).fill(0); const qSqI = Array(p).fill(0);
  for (let i = 0; i < p; i++) for (let j = 0; j < p; j++) {
    if (i === j) continue;
    const q = -S[i][j] / Math.sqrt(S[i][i] * S[j][j]);
    rSq += R[i][j] ** 2; qSq += q * q;
    rSqI[i] += R[i][j] ** 2; qSqI[i] += q * q;
  }
  const chi2 = -(n - 1 - (2 * p + 5) / 6) * logDet;
  return {
    columnNames: names,
    n,
    kmo: rSq / (rSq + qSq),
    msa: rSqI.map((r, i) => r / (r + qSqI[i])),
    bartlettChi2: chi2,
    bartlettDf: df,
    bartlettP: chiSquareSurvival(Math.max(0, chi2), df),
    determinant: Math.exp(logDet),
    singular: false,
  };
}

function eigenDecomposition(matrix: number[][]): { eigenvalues: number[]; eigenvectors: number[][] } {
  const n = matrix.length;
  let A = matrix.map((r) => r.map((x) => x));
  const V: number[][] = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => i === j ? 1 : 0));
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
  const L = loadings.map((r) => r.map((x) => x));
  // Xoay varimax thô (Kaiser 1958), từng cặp cột: tan 4θ = (D − 2AB/p) / (C − (A² − B²)/p),
  // với u = x² − y², v = 2xy, A = Σu, B = Σv, C = Σ(u² − v²), D = 2Σuv.
  for (let iter = 0; iter < 100; iter++) {
    let maxAngle = 0;
    for (let j = 0; j < nCols - 1; j++) {
      for (let k = j + 1; k < nCols; k++) {
        let A = 0, B = 0, C = 0, D = 0;
        for (let i = 0; i < nRows; i++) {
          const x = L[i][j]; const y = L[i][k];
          const u = x * x - y * y; const v = 2 * x * y;
          A += u; B += v; C += u * u - v * v; D += 2 * u * v;
        }
        const num = D - (2 * A * B) / nRows;
        const den = C - (A * A - B * B) / nRows;
        const theta = 0.25 * Math.atan2(num, den);
        if (Math.abs(theta) < 1e-10) continue;
        maxAngle = Math.max(maxAngle, Math.abs(theta));
        const cos = Math.cos(theta); const sin = Math.sin(theta);
        for (let i = 0; i < nRows; i++) {
          const x = L[i][j]; const y = L[i][k];
          L[i][j] = x * cos + y * sin; L[i][k] = -x * sin + y * cos;
        }
      }
    }
    if (maxAngle < 1e-8) break;
  }
  // Quy ước trình bày: dấu cột sao cho tổng loading dương; sắp xếp nhân tố theo tổng bình phương loading giảm dần (như SPSS).
  for (let j = 0; j < nCols; j++) {
    let sum = 0;
    for (let i = 0; i < nRows; i++) sum += L[i][j];
    if (sum < 0) for (let i = 0; i < nRows; i++) L[i][j] = -L[i][j];
  }
  const order = Array.from({ length: nCols }, (_, j) => j).sort((a, b) => {
    let sa = 0, sb = 0;
    for (let i = 0; i < nRows; i++) { sa += L[i][a] * L[i][a]; sb += L[i][b] * L[i][b]; }
    return sb - sa;
  });
  return L.map((row) => order.map((j) => row[j]));
}

// --- Mediation (Baron-Kenny; nhiều M = trung gian song song) ---
export interface MediationPathRow {
  mCol: string;
  a: number;
  b: number;
  aSE: number;
  bSE: number;
  aP: number;
  bP: number;
  /** Hiệu ứng gián tiếp qua M này: a * b (b từ mô hình Y ~ X + M₁ + …) */
  indirect: number;
}

export interface MediationResult {
  paths: MediationPathRow[];
  c: number;
  cPrime: number;
  cSE: number;
  cPrimeSE: number;
  cP: number;
  cPrimeP: number;
  /** Tổng hiệu ứng gián tiếp (song song): Σ aᵢ bᵢ */
  indirectEffect: number;
  pctMediated: number;
  n: number;
}

function uniqueMediationMs(mCols: string[], xCol: string, yCol: string): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of mCols) {
    const m = String(raw || "").trim();
    if (!m || m === xCol || m === yCol || seen.has(m)) continue;
    seen.add(m);
    out.push(m);
  }
  return out;
}

/**
 * Mediation (Baron–Kenny): một hoặc nhiều biến trung gian song song (parallel).
 * Với nhiều M: Mᵢ ~ X; Y ~ X + M₁ + …; hiệu ứng gián tiếp tổng = Σ (aᵢ bᵢ).
 */
export function computeMediation(rows: string[][], xCol: string, mCols: string[], yCol: string): MediationResult | null {
  const ms = uniqueMediationMs(mCols, xCol, yCol);
  if (ms.length === 0) return null;
  const pathC = computeOLS(rows, yCol, [xCol]);
  const pathBC = computeOLS(rows, yCol, [xCol, ...ms]);
  if (!pathC || !pathBC) return null;
  const paths: MediationPathRow[] = [];
  for (const mCol of ms) {
    const pathA = computeOLS(rows, mCol, [xCol]);
    if (!pathA) return null;
    const a = pathA.coefficients[xCol] ?? 0;
    const b = pathBC.coefficients[mCol] ?? 0;
    const indirect = a * b;
    paths.push({
      mCol,
      a,
      b,
      aSE: pathA.se[xCol] ?? 0,
      bSE: pathBC.se[mCol] ?? 0,
      aP: pathA.pValue[xCol] ?? 1,
      bP: pathBC.pValue[mCol] ?? 1,
      indirect,
    });
  }
  const c = pathC.coefficients[xCol] ?? 0;
  const cPrime = pathBC.coefficients[xCol] ?? 0;
  const indirectEffect = paths.reduce((s, p) => s + p.indirect, 0);
  const pctMediated = c !== 0 ? (indirectEffect / c) * 100 : 0;
  return {
    paths,
    c,
    cPrime,
    cSE: pathC.se[xCol] ?? 0,
    cPrimeSE: pathBC.se[xCol] ?? 0,
    cP: pathC.pValue[xCol] ?? 1,
    cPrimeP: pathBC.pValue[xCol] ?? 1,
    indirectEffect,
    pctMediated,
    n: pathBC.n,
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
    const xv = toNum(r[xi]);
    const mv = toNum(r[mi]);
    const yv = toNum(r[yi]);
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
  const clean = values.filter((v) => typeof v === "number" && Number.isFinite(v));
  const n = clean.length;
  if (n < 3 || n > 5000) return null;
  const x = [...clean].sort((a, b) => a - b);
  const mean = x.reduce((a, b) => a + b, 0) / n;
  const sumSq = x.reduce((s, v) => s + (v - mean) ** 2, 0);
  if (x[n - 1] - x[0] === 0 || sumSq === 0) return { w: 1, pValue: 1, n };
  // Royston (1995), thuật toán AS R94 — cùng thuật toán với R shapiro.test / scipy.stats.shapiro.
  const poly = (cc: number[], v: number): number => {
    let r = 0;
    for (let k = cc.length - 1; k >= 0; k--) r = r * v + cc[k];
    return r;
  };
  const nn2 = Math.floor(n / 2);
  const a: number[] = new Array(nn2).fill(0);
  if (n === 3) {
    a[0] = Math.SQRT1_2;
  } else {
    const an25 = n + 0.25;
    const m: number[] = [];
    let summ2 = 0;
    for (let i = 1; i <= nn2; i++) {
      const mi = normalQuantile((i - 0.375) / an25);
      m.push(mi);
      summ2 += mi * mi;
    }
    summ2 *= 2;
    const ssumm2 = Math.sqrt(summ2);
    const rsn = 1 / Math.sqrt(n);
    const c1 = [0, 0.221157, -0.147981, -2.07119, 4.434685, -2.706056];
    const c2 = [0, 0.042981, -0.293762, -1.752461, 5.682633, -3.582633];
    const a1 = poly(c1, rsn) - m[0] / ssumm2;
    let i1: number;
    let fac: number;
    if (n > 5) {
      i1 = 2;
      const a2 = -m[1] / ssumm2 + poly(c2, rsn);
      fac = Math.sqrt((summ2 - 2 * m[0] * m[0] - 2 * m[1] * m[1]) / (1 - 2 * a1 * a1 - 2 * a2 * a2));
      a[1] = a2;
    } else {
      i1 = 1;
      fac = Math.sqrt((summ2 - 2 * m[0] * m[0]) / (1 - 2 * a1 * a1));
    }
    a[0] = a1;
    for (let i = i1; i < nn2; i++) a[i] = -m[i] / fac;
  }
  let b = 0;
  for (let i = 0; i < nn2; i++) b += a[i] * (x[n - 1 - i] - x[i]);
  const w = Math.min(1, (b * b) / sumSq);
  let pValue: number;
  if (n === 3) {
    pValue = Math.max(0, (6 / Math.PI) * (Math.asin(Math.sqrt(w)) - Math.PI / 3));
  } else {
    const y = Math.log(1 - w);
    const xx = Math.log(n);
    let mu: number;
    let sigma: number;
    let yy = y;
    if (n <= 11) {
      const gamma = -2.273 + 0.459 * n;
      if (y >= gamma) {
        return { w, pValue: 1e-99, n };
      }
      yy = -Math.log(gamma - y);
      mu = poly([0.544, -0.39978, 0.025054, -6.714e-4], n);
      sigma = Math.exp(poly([1.3822, -0.77857, 0.062767, -0.0020322], n));
    } else {
      mu = poly([-1.5861, -0.31082, -0.083751, 0.0038915], xx);
      sigma = Math.exp(poly([-0.4803, -0.082676, 0.0030302], xx));
    }
    const z = (yy - mu) / sigma;
    pValue = 0.5 * erfcAccurate(z / Math.SQRT2);
  }
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
  return { nRequired: n, nPredictors, rule: `n ≥ ${mult} × ${t("stats.numVariables")} + 10` };
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
    const xVec = xIndices.map((ci) => toNum(r[ci]));
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
    minWordsPerRow: safeMin(wordsPerRow, 0),
    maxWordsPerRow: safeMax(wordsPerRow, 0),
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
