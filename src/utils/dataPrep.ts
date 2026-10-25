/**
 * Chuẩn bị dữ liệu thứ cấp — các phép biến đổi thuần (không phụ thuộc React) trên bảng string[][]
 * (hàng 0 = tên cột). Mọi hàm trả bảng mới, không sửa bảng đầu vào.
 *
 * Quy ước: ô trống / chỉ có khoảng trắng = giá trị thiếu; ô không phải số trong cột số = thiếu khi tính toán.
 */

import { safeMax, safeMin } from "./math";

export type Rows = string[][];

export interface PrepResult {
  rows: Rows;
  /** Thông báo lỗi (tiếng Việt, ngắn) — khi có, `rows` là bảng đầu vào không đổi. */
  error?: string;
  /** Số liệu tóm tắt để hiện cho người dùng. */
  stats?: Record<string, number>;
}

const fail = (rows: Rows, error: string): PrepResult => ({ rows, error });

/** Số -> chuỗi, tối đa 10 chữ số có nghĩa, không dùng "1e+21" cho số thường. */
export function fmtNum(x: number): string {
  if (!Number.isFinite(x)) return "";
  return String(+x.toPrecision(10));
}

function cellNum(v: string | undefined): number {
  const s = (v ?? "").toString().trim();
  if (s === "") return NaN;
  return Number(s);
}

function headerIndex(rows: Rows, col: string): number {
  return (rows[0] ?? []).indexOf(col);
}

/** Phân vị tuyến tính (giống numpy.percentile mặc định). */
export function quantileSorted(sorted: number[], p: number): number {
  if (sorted.length === 0) return NaN;
  const idx = (sorted.length - 1) * p;
  const lo = Math.floor(idx);
  const hi = Math.ceil(idx);
  return sorted[lo] + (sorted[hi] - sorted[lo]) * (idx - lo);
}

// ---------------------------------------------------------------------------------------------
// Đổi tên biến
// ---------------------------------------------------------------------------------------------
export function renameColumn(rows: Rows, from: string, to: string): PrepResult {
  const ci = headerIndex(rows, from);
  if (ci < 0) return fail(rows, "Chưa chọn cột cần đổi tên.");
  const name = to.trim();
  if (name === "") return fail(rows, "Tên mới không được để trống.");
  if (rows[0].some((h, i) => i !== ci && h === name)) return fail(rows, `Đã có cột tên «${name}».`);
  const out = rows.map((r) => r.slice());
  out[0][ci] = name;
  return { rows: out };
}

// ---------------------------------------------------------------------------------------------
// Đổi loại biến (ép kiểu)
// ---------------------------------------------------------------------------------------------
const RE_EU_THOUSANDS = /^[+-]?\d{1,3}(\.\d{3})+(,\d+)?$/; // 1.234,5
const RE_US_THOUSANDS = /^[+-]?\d{1,3}(,\d{3})+(\.\d+)?$/; // 1,234.5
const RE_DEC_COMMA = /^[+-]?\d*,\d+$/; // 6,84

/** Cố gắng đọc một chuỗi thành số (hỗ trợ dấu phẩy thập phân, dấu phân cách hàng nghìn, khoảng trắng, %). */
export function parseLooseNumber(raw: string): number {
  let s = raw.trim().replace(/ /g, "").replace(/\s+/g, "");
  if (s === "") return NaN;
  let pct = false;
  if (s.endsWith("%")) {
    pct = true;
    s = s.slice(0, -1);
  }
  let v = Number(s);
  if (!Number.isFinite(v)) {
    if (RE_EU_THOUSANDS.test(s)) v = Number(s.replace(/\./g, "").replace(",", "."));
    else if (RE_US_THOUSANDS.test(s)) v = Number(s.replace(/,/g, ""));
    else if (RE_DEC_COMMA.test(s)) v = Number(s.replace(",", "."));
    else return NaN;
  }
  if (!Number.isFinite(v)) return NaN;
  return pct ? v / 100 : v;
}

export function coerceColumns(rows: Rows, cols: string[], kind: "numeric" | "text"): PrepResult {
  const idx = cols.map((c) => headerIndex(rows, c));
  if (cols.length === 0 || idx.some((i) => i < 0)) return fail(rows, "Chưa chọn cột.");
  let converted = 0;
  let invalid = 0;
  const out = rows.map((r) => r.slice());
  for (let r = 1; r < out.length; r++) {
    for (const ci of idx) {
      const raw = (out[r][ci] ?? "").toString();
      if (raw.trim() === "") {
        out[r][ci] = "";
        continue;
      }
      if (kind === "text") {
        out[r][ci] = raw.trim().replace(/\s+/g, " ");
        converted++;
      } else {
        const v = parseLooseNumber(raw);
        if (Number.isNaN(v)) {
          out[r][ci] = "";
          invalid++;
        } else {
          out[r][ci] = fmtNum(v);
          converted++;
        }
      }
    }
  }
  return { rows: out, stats: { converted, invalid } };
}

// ---------------------------------------------------------------------------------------------
// Tính biến mới từ công thức: [Điểm 1] + [Điểm 2], mean(a, b, c), ln(x), sqrt(x), (a-b)/b*100, x^2 …
// ---------------------------------------------------------------------------------------------
type Node = (row: number[]) => number;

interface Tok {
  t: "num" | "id" | "col" | "op" | "lp" | "rp" | "comma" | "end";
  v: string;
  n?: number;
}

function tokenize(src: string): Tok[] {
  const out: Tok[] = [];
  let i = 0;
  while (i < src.length) {
    const c = src[i];
    if (/\s/.test(c)) {
      i++;
    } else if (c === "[") {
      const j = src.indexOf("]", i + 1);
      if (j < 0) throw new Error("Thiếu dấu ] đóng tên cột.");
      out.push({ t: "col", v: src.slice(i + 1, j).trim() });
      i = j + 1;
    } else if (/[0-9.]/.test(c)) {
      const m = /^(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?/.exec(src.slice(i));
      if (!m) throw new Error(`Số không hợp lệ gần «${src.slice(i, i + 6)}».`);
      out.push({ t: "num", v: m[0], n: Number(m[0]) });
      i += m[0].length;
    } else if (/[\p{L}_]/u.test(c)) {
      const m = /^[\p{L}_][\p{L}\p{N}_.]*/u.exec(src.slice(i))!;
      out.push({ t: "id", v: m[0] });
      i += m[0].length;
    } else if ("+-*/^".includes(c)) {
      out.push({ t: "op", v: c });
      i++;
    } else if (c === "(") {
      out.push({ t: "lp", v: c });
      i++;
    } else if (c === ")") {
      out.push({ t: "rp", v: c });
      i++;
    } else if (c === "," || c === ";") {
      out.push({ t: "comma", v: "," });
      i++;
    } else {
      throw new Error(`Ký tự không hợp lệ «${c}» trong công thức.`);
    }
  }
  out.push({ t: "end", v: "" });
  return out;
}

const finite = (xs: number[]) => xs.filter((x) => Number.isFinite(x));

const FUNCS: Record<string, { min: number; max: number; f: (a: number[]) => number }> = {
  ln: { min: 1, max: 1, f: (a) => (a[0] > 0 ? Math.log(a[0]) : NaN) },
  log: { min: 1, max: 1, f: (a) => (a[0] > 0 ? Math.log10(a[0]) : NaN) }, // như Excel: LOG = log10
  log10: { min: 1, max: 1, f: (a) => (a[0] > 0 ? Math.log10(a[0]) : NaN) },
  log1p: { min: 1, max: 1, f: (a) => (a[0] > -1 ? Math.log1p(a[0]) : NaN) },
  exp: { min: 1, max: 1, f: (a) => Math.exp(a[0]) },
  sqrt: { min: 1, max: 1, f: (a) => (a[0] >= 0 ? Math.sqrt(a[0]) : NaN) },
  abs: { min: 1, max: 1, f: (a) => Math.abs(a[0]) },
  round: {
    min: 1,
    max: 2,
    f: (a) => {
      const d = a.length > 1 ? a[1] : 0;
      const m = Math.pow(10, d);
      return Math.round(a[0] * m) / m;
    },
  },
  // Hàm nhiều đối số: bỏ qua ô thiếu (như SPSS MEAN/SUM); không còn giá trị hợp lệ nào -> thiếu
  sum: { min: 1, max: 99, f: (a) => (finite(a).length ? finite(a).reduce((s, x) => s + x, 0) : NaN) },
  mean: { min: 1, max: 99, f: (a) => (finite(a).length ? finite(a).reduce((s, x) => s + x, 0) / finite(a).length : NaN) },
  min: { min: 1, max: 99, f: (a) => safeMin(finite(a), NaN) },
  max: { min: 1, max: 99, f: (a) => safeMax(finite(a), NaN) },
};
const MULTI_SKIP_NAN = new Set(["sum", "mean", "min", "max"]);

/** Biên dịch công thức thành hàm tính theo một dòng. `header` dùng để tra tên cột. */
export function compileFormula(formula: string, header: string[]): { fn: (cells: string[]) => number; refs: string[] } {
  const toks = tokenize(formula);
  let p = 0;
  const refs: string[] = [];
  const colIndex = (name: string): number => {
    let i = header.indexOf(name);
    if (i < 0) {
      const lower = header.map((h) => h.toLowerCase());
      const j = lower.indexOf(name.toLowerCase());
      if (j >= 0 && lower.lastIndexOf(name.toLowerCase()) === j) i = j;
    }
    return i;
  };
  const peek = () => toks[p];
  const next = () => toks[p++];

  const parseExpr = (): ((cells: number[]) => number) => parseAdd();
  const parseAdd = (): Node => {
    let l = parseMul();
    while (peek().t === "op" && (peek().v === "+" || peek().v === "-")) {
      const op = next().v;
      const r = parseMul();
      const a = l;
      l = op === "+" ? (row) => a(row) + r(row) : (row) => a(row) - r(row);
    }
    return l;
  };
  const parseMul = (): Node => {
    let l = parseUnary();
    while (peek().t === "op" && (peek().v === "*" || peek().v === "/")) {
      const op = next().v;
      const r = parseUnary();
      const a = l;
      l = op === "*" ? (row) => a(row) * r(row) : (row) => {
        const d = r(row);
        return d === 0 ? NaN : a(row) / d;
      };
    }
    return l;
  };
  const parseUnary = (): Node => {
    if (peek().t === "op" && (peek().v === "-" || peek().v === "+")) {
      const op = next().v;
      const e = parseUnary();
      return op === "-" ? (row) => -e(row) : e;
    }
    return parsePow();
  };
  const parsePow = (): Node => {
    const base = parsePrimary();
    if (peek().t === "op" && peek().v === "^") {
      next();
      const ex = parseUnary(); // kết hợp phải
      return (row) => {
        const v = Math.pow(base(row), ex(row));
        return Number.isFinite(v) ? v : NaN;
      };
    }
    return base;
  };
  const parsePrimary = (): Node => {
    const tk = next();
    if (tk.t === "num") {
      const n = tk.n as number;
      return () => n;
    }
    if (tk.t === "col") {
      const i = colIndex(tk.v);
      if (i < 0) throw new Error(`Không có cột «${tk.v}».`);
      refs.push(header[i]);
      return (row) => row[i];
    }
    if (tk.t === "lp") {
      const e = parseExpr();
      if (next().t !== "rp") throw new Error("Thiếu dấu ) đóng ngoặc.");
      return e;
    }
    if (tk.t === "id") {
      const low = tk.v.toLowerCase();
      if (peek().t === "lp") {
        next();
        const fn = FUNCS[low];
        if (!fn) throw new Error(`Hàm «${tk.v}» không được hỗ trợ.`);
        const args: Node[] = [];
        if (peek().t !== "rp") {
          for (;;) {
            args.push(parseExpr());
            if (peek().t === "comma") {
              next();
              continue;
            }
            break;
          }
        }
        if (next().t !== "rp") throw new Error("Thiếu dấu ) đóng ngoặc.");
        if (args.length < fn.min || args.length > fn.max) throw new Error(`Hàm ${low} nhận ${fn.min}${fn.max !== fn.min ? "–" + fn.max : ""} đối số.`);
        if (MULTI_SKIP_NAN.has(low)) return (row) => fn.f(args.map((a) => a(row)));
        return (row) => {
          const vals = args.map((a) => a(row));
          return vals.some((v) => Number.isNaN(v)) ? NaN : fn.f(vals);
        };
      }
      // tên cột viết trần (không dấu cách) hoặc hằng số
      const i = colIndex(tk.v);
      if (i >= 0) {
        refs.push(header[i]);
        return (row) => row[i];
      }
      if (low === "pi") return () => Math.PI;
      if (low === "e") return () => Math.E;
      throw new Error(`Không hiểu «${tk.v}». Tên cột có dấu cách hoặc dấu tiếng Việt hãy đặt trong ngoặc vuông, ví dụ [Điểm TB].`);
    }
    throw new Error("Công thức chưa hoàn chỉnh.");
  };

  const root = parseExpr();
  if (peek().t !== "end") throw new Error(`Công thức thừa gần «${peek().v}».`);
  return {
    refs,
    fn: (cells: string[]) => {
      const row = header.map((_, i) => cellNum(cells[i]));
      return root(row);
    },
  };
}

export function computeVariable(rows: Rows, newName: string, formula: string): PrepResult {
  const name = newName.trim();
  if (name === "") return fail(rows, "Hãy đặt tên cho biến mới.");
  if (formula.trim() === "") return fail(rows, "Hãy nhập công thức.");
  const header = rows[0] ?? [];
  if (header.includes(name)) return fail(rows, `Đã có cột tên «${name}» — hãy chọn tên khác.`);
  let compiled: ReturnType<typeof compileFormula>;
  try {
    compiled = compileFormula(formula, header);
  } catch (e) {
    return fail(rows, (e as Error).message);
  }
  let missing = 0;
  const out: Rows = [[...header, name]];
  for (let r = 1; r < rows.length; r++) {
    const v = compiled.fn(rows[r]);
    if (!Number.isFinite(v)) missing++;
    out.push([...rows[r], fmtNum(v)]);
  }
  return { rows: out, stats: { computed: rows.length - 1 - missing, missing } };
}

// ---------------------------------------------------------------------------------------------
// Biến đổi log (thêm cột mới, giữ nguyên cột gốc)
// ---------------------------------------------------------------------------------------------
export type LogKind = "ln" | "log10" | "log1p";

export function logTransform(rows: Rows, cols: string[], kind: LogKind): PrepResult {
  const idx = cols.map((c) => headerIndex(rows, c));
  if (cols.length === 0 || idx.some((i) => i < 0)) return fail(rows, "Chưa chọn cột.");
  const prefix = kind === "ln" ? "ln" : kind === "log10" ? "log10" : "ln1p";
  const header = [...rows[0]];
  const newNames = cols.map((c) => {
    let nm = `${prefix}(${c})`;
    while (header.includes(nm)) nm += "_";
    header.push(nm);
    return nm;
  });
  let invalid = 0;
  const out: Rows = [header];
  for (let r = 1; r < rows.length; r++) {
    const add: string[] = [];
    for (const ci of idx) {
      const x = cellNum(rows[r][ci]);
      let v = NaN;
      if (Number.isFinite(x)) {
        if (kind === "ln") v = x > 0 ? Math.log(x) : NaN;
        else if (kind === "log10") v = x > 0 ? Math.log10(x) : NaN;
        else v = x > -1 ? Math.log1p(x) : NaN;
        if (Number.isNaN(v)) invalid++;
      }
      add.push(fmtNum(v));
    }
    out.push([...rows[r], ...add]);
  }
  return { rows: out, stats: { invalid, newColumns: newNames.length } };
}

// ---------------------------------------------------------------------------------------------
// Loại giá trị ngoại lai theo IQR (Tukey): ngoài [Q1 − k·IQR, Q3 + k·IQR] ở BẤT KỲ cột đã chọn -> loại cả dòng
// ---------------------------------------------------------------------------------------------
export function removeOutliersIQR(rows: Rows, cols: string[], k = 1.5): PrepResult {
  const idx = cols.map((c) => headerIndex(rows, c));
  if (cols.length === 0 || idx.some((i) => i < 0)) return fail(rows, "Chưa chọn cột.");
  const fences = idx.map((ci) => {
    const vals = rows.slice(1).map((r) => cellNum(r[ci])).filter((v) => Number.isFinite(v)).sort((a, b) => a - b);
    if (vals.length < 4) return null;
    const q1 = quantileSorted(vals, 0.25);
    const q3 = quantileSorted(vals, 0.75);
    const iqr = q3 - q1;
    return { lo: q1 - k * iqr, hi: q3 + k * iqr, q1, q3, iqr };
  });
  if (fences.every((f) => f === null)) return fail(rows, "Cần ít nhất 4 giá trị số trong cột để tính IQR.");
  const out: Rows = [rows[0]];
  let removed = 0;
  for (let r = 1; r < rows.length; r++) {
    let bad = false;
    idx.forEach((ci, j) => {
      const f = fences[j];
      if (!f) return;
      const v = cellNum(rows[r][ci]);
      if (Number.isFinite(v) && (v < f.lo || v > f.hi)) bad = true;
    });
    if (bad) removed++;
    else out.push(rows[r]);
  }
  return { rows: out, stats: { removed, kept: out.length - 1 } };
}

// ---------------------------------------------------------------------------------------------
// Xoá dòng trùng (giữ dòng đầu tiên). cols rỗng = so sánh toàn bộ các cột.
// ---------------------------------------------------------------------------------------------
export function removeDuplicates(rows: Rows, cols: string[]): PrepResult {
  const header = rows[0] ?? [];
  const idx = cols.length ? cols.map((c) => header.indexOf(c)) : header.map((_, i) => i);
  if (idx.some((i) => i < 0)) return fail(rows, "Cột không hợp lệ.");
  const seen = new Set<string>();
  const out: Rows = [rows[0]];
  let removed = 0;
  for (let r = 1; r < rows.length; r++) {
    const key = JSON.stringify(idx.map((ci) => (rows[r][ci] ?? "").toString().trim()));
    if (seen.has(key)) removed++;
    else {
      seen.add(key);
      out.push(rows[r]);
    }
  }
  return { rows: out, stats: { removed, kept: out.length - 1 } };
}
