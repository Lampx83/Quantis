/// <reference types="vite/client" />
import { describe, it, expect } from "vitest";
import {
  getAnalysisRows,
  getDataRows,
  computeDescriptive,
  computeProfile,
  computeCorrelationMatrix,
  computeTTest,
  getCrosstab,
} from "../stats";
import { isMissingValue } from "../metadata";
import type { Dataset, VariableMetadata } from "../../types";

/** Tái hiện ca trong review PR #7: q1 là Likert 1–5, 99 = không trả lời. */
function buildRows(opts: { codes: Record<number, string> }): string[][] {
  const header = ["id", "q1", "q2", "grp"];
  const rows: string[][] = [header];
  for (let i = 0; i < 300; i++) {
    const q1 = opts.codes[i] ?? String((i % 5) + 1);
    const q2 = String(((i * 7) % 5) + 1 + (i % 4 === 0 ? 0.5 : 0));
    rows.push([String(i + 1), q1, q2, i % 2 === 0 ? "A" : "B"]);
  }
  return rows;
}

function meta(name: string, patch: Partial<VariableMetadata> = {}): VariableMetadata {
  return {
    name,
    type: "numeric",
    label: name,
    measure: "scale",
    decimals: 0,
    align: "right",
    missingValues: [],
    ...patch,
  };
}

function makeDataset(rows: string[][], variables?: Record<string, VariableMetadata>): Dataset {
  return {
    id: "d1",
    name: "Likert",
    rows: rows.length - 1,
    columns: rows[0].length,
    columnNames: rows[0],
    preview: rows.slice(0, 6),
    data: rows,
    variables,
    sourceFormat: "spss",
    createdAt: "2026-01-01",
    updatedAt: "2026-01-01",
  };
}

const codes99: Record<number, string> = {};
for (let i = 0; i < 300; i += 6) codes99[i] = "99"; // 50 ô mã 99
const nCoded = Object.keys(codes99).length;

/** Chuẩn so sánh: cùng dữ liệu nhưng ô mã khuyết đã là ô trống ngay từ đầu (đúng hành vi `main`). */
function referenceRows(rows: string[][], isBad: (v: string) => boolean, col = 1): string[][] {
  return rows.map((r, i) => (i === 0 ? r : r.map((v, c) => (c === col && isBad(v) ? "" : v))));
}

describe("getAnalysisRows — mã khuyết người dùng khai báo không lọt vào phân tích", () => {
  it("rời rạc: Descriptive N / Missing / Mean / Max khớp với việc coi 99 là ô trống", () => {
    const raw = buildRows({ codes: codes99 });
    const ds = makeDataset(raw, { q1: meta("q1", { measure: "ordinal", missingValues: ["99"] }) });

    // Trước khi sửa (bug B1): đi thẳng getDataRows -> 99 vào dữ liệu
    const buggy = computeDescriptive(getDataRows(ds)).find((d) => d.column === "q1")!;
    expect(buggy.max).toBe(99);
    expect(buggy.missing).toBe(0);

    const got = computeDescriptive(getAnalysisRows(ds)).find((d) => d.column === "q1")!;
    const want = computeDescriptive(referenceRows(raw, (v) => v === "99")).find((d) => d.column === "q1")!;
    expect(got.missing).toBe(nCoded);
    expect(got.n - got.missing).toBe(300 - nCoded); // N hữu hiệu
    expect(got.max).toBe(5);
    expect(got.mean).toBeCloseTo(want.mean!, 12);
    expect(got.std).toBeCloseTo(want.std!, 12);
    expect(got.median).toBe(want.median);
    expect(got.mean!).toBeGreaterThan(2.5);
    expect(got.mean!).toBeLessThan(3.5);
  });

  it("khoảng 98–99 (kiểu SPSS) + một mã rời rạc", () => {
    const codes: Record<number, string> = { 0: "98", 1: "99", 2: "98.5", 3: "97", 4: "100", 5: "-1" };
    const raw = buildRows({ codes });
    const ds = makeDataset(raw, {
      q1: meta("q1", { missingValues: ["97"], missingRange: { min: 98, max: 99 } }),
    });
    const rows = getAnalysisRows(ds);
    // 98, 99, 98.5 (trong khoảng) và 97 (mã rời rạc) -> trống; 100 và -1 vẫn là số bình thường
    expect([1, 2, 3, 4, 5, 6].map((i) => rows[i][1])).toEqual(["", "", "", "", "100", "-1"]);
    const d = computeDescriptive(rows).find((x) => x.column === "q1")!;
    expect(d.missing).toBe(4);
    expect(d.max).toBe(100);
    expect(d.min).toBe(-1);
  });

  it("khoảng đảo đầu mút vẫn hiểu đúng; biến chuỗi không áp dụng khoảng số", () => {
    const rows = [["s", "n"], ["98", "98"], ["abc", "5"], ["NA", "x"]];
    const ds = makeDataset(rows, {
      s: meta("s", { type: "string", measure: "nominal", missingValues: ["NA"], missingRange: { min: 90, max: 99 } }),
      n: meta("n", { missingRange: { min: 99, max: 90 } }),
    });
    const out = getAnalysisRows(ds);
    expect(out.map((r) => r[0])).toEqual(["s", "98", "abc", ""]);
    expect(out.map((r) => r[1])).toEqual(["n", "", "5", "x"]);
  });

  it("không khai báo mã khuyết: trả đúng mảng gốc (không sao chép) và số liệu như cũ", () => {
    const raw = buildRows({ codes: codes99 });
    const ds = makeDataset(raw, { q1: meta("q1", { measure: "ordinal" }), id: meta("id") });
    expect(getAnalysisRows(ds)).toBe(getDataRows(ds));
    expect(getAnalysisRows(ds)).toBe(raw);
    expect(computeDescriptive(getAnalysisRows(ds))).toEqual(computeDescriptive(raw));
  });

  it("dataset cũ trong localStorage (không có `variables`) hoặc null không gây lỗi", () => {
    const raw = buildRows({ codes: codes99 });
    const legacy = makeDataset(raw);
    delete (legacy as Partial<Dataset>).variables;
    expect(getAnalysisRows(legacy)).toBe(raw);
    expect(getAnalysisRows(null)).toEqual([]);
    expect(getAnalysisRows(undefined)).toEqual([]);
    expect(getAnalysisRows({ preview: [] })).toEqual([]);
    expect(getAnalysisRows(makeDataset([["a"]], { a: meta("a", { missingValues: ["1"] }) }))).toEqual([["a"]]);
  });

  it("chỉ có preview (không có data) vẫn được xử lý; dữ liệu gốc không bị sửa", () => {
    const raw = buildRows({ codes: codes99 });
    const snapshot = JSON.stringify(raw);
    const ds = { ...makeDataset(raw, { q1: meta("q1", { missingValues: ["99"] }) }), data: undefined };
    ds.preview = raw.slice(0, 20);
    const out = getAnalysisRows(ds);
    expect(out.length).toBe(20);
    expect(out.slice(1).every((r) => r[1] !== "99")).toBe(true);
    const full = makeDataset(raw, { q1: meta("q1", { missingValues: ["99"] }) });
    getAnalysisRows(full);
    expect(JSON.stringify(raw)).toBe(snapshot);
  });

  it("sửa mã khuyết trong Variable View thì kết quả tự cập nhật (cache theo chữ ký quy tắc)", () => {
    const raw = buildRows({ codes: codes99 });
    const v1 = { q1: meta("q1", { missingValues: ["99"] }) };
    const a = getAnalysisRows(makeDataset(raw, v1));
    // cùng mảng gốc, quy tắc khác
    const b = getAnalysisRows(makeDataset(raw, { q1: meta("q1", { missingValues: ["99", "5"] }) }));
    const c = getAnalysisRows(makeDataset(raw, { q1: meta("q1", { missingValues: [] }) }));
    expect(a).not.toBe(b);
    expect(computeDescriptive(b).find((d) => d.column === "q1")!.max).toBe(4);
    expect(c).toBe(raw);
    // gọi lại với cùng quy tắc -> dùng lại cache
    expect(getAnalysisRows(makeDataset(raw, v1))).toBe(a);
  });

  it("ô trống / chuỗi rỗng vẫn là khuyết và KHÔNG bao giờ thành 0", () => {
    const rows = [["x"], [""], ["  "], ["99"], ["4"], ["6"]];
    const ds = makeDataset(rows, { x: meta("x", { missingValues: ["99"] }) });
    const d = computeDescriptive(getAnalysisRows(ds))[0];
    expect(d.missing).toBe(3);
    expect(d.mean).toBe(5);
    expect(d.min).toBe(4);
  });

  it("các phép phân tích khác cũng đúng: tương quan, t-test, bảng chéo, profiling", () => {
    const raw = buildRows({ codes: codes99 });
    const ds = makeDataset(raw, { q1: meta("q1", { measure: "ordinal", missingValues: ["99"] }) });
    const ref = referenceRows(raw, (v) => v === "99");

    const corr = computeCorrelationMatrix(getAnalysisRows(ds), "pearson")!;
    const corrRef = computeCorrelationMatrix(ref, "pearson")!;
    expect(corr.columnNames).toEqual(corrRef.columnNames);
    corr.matrix.forEach((row, i) => row.forEach((v, j) => expect(v).toBeCloseTo(corrRef.matrix[i][j], 12)));

    const tt = computeTTest(getAnalysisRows(ds), "grp", "A", "B", "q1");
    const ttRef = computeTTest(ref, "grp", "A", "B", "q1");
    expect(tt).not.toBeNull();
    expect(JSON.stringify(tt)).toBe(JSON.stringify(ttRef));
    // và khác hẳn kết quả sai khi 99 lọt vào
    expect(JSON.stringify(computeTTest(raw, "grp", "A", "B", "q1"))).not.toBe(JSON.stringify(tt));

    expect(getCrosstab(getAnalysisRows(ds), "q1", "grp")!.rowLabels).not.toContain("99");

    const prof = computeProfile(getAnalysisRows(ds)).find((p) => p.column === "q1")!;
    expect(prof.missing).toBe(nCoded);
  });

  it("isMissingValue: khoảng, số dạng chữ ('99.0', '+99'), bỏ qua khoảng trắng", () => {
    const m = meta("q", { missingValues: ["-1"], missingRange: { min: 98, max: 99 } });
    expect(isMissingValue("98", m)).toBe(true);
    expect(isMissingValue(" 99.0 ", m)).toBe(true);
    expect(isMissingValue("98.5", m)).toBe(true);
    expect(isMissingValue("-1.0", m)).toBe(true);
    expect(isMissingValue("97.99", m)).toBe(false);
    expect(isMissingValue("100", m)).toBe(false);
    expect(isMissingValue("abc", m)).toBe(false);
    expect(isMissingValue("", m)).toBe(true);
  });

  it("hiệu năng: 100.000 dòng, 5 cột có mã khuyết dưới 1 giây (và gọi lại là O(1))", () => {
    const n = 100_000;
    const rows: string[][] = [["a", "b", "c", "d", "e"]];
    for (let i = 0; i < n; i++) rows.push([String(i), String(i % 5), "99", String((i % 7) - 1), "x"]);
    const variables: Record<string, VariableMetadata> = {
      a: meta("a", { missingRange: { min: 0, max: 9 } }),
      b: meta("b", { missingValues: ["0", "1", "2"] }),
      c: meta("c", { missingValues: ["99"] }),
      d: meta("d", { missingValues: ["-1"], missingRange: { min: 5, max: 6 } }),
    };
    const ds = makeDataset(rows, variables);
    const t0 = performance.now();
    const out = getAnalysisRows(ds);
    const t1 = performance.now();
    expect(getAnalysisRows(ds)).toBe(out);
    const t2 = performance.now();
    expect(out.length).toBe(n + 1);
    expect(out[1].slice(0, 4)).toEqual(["", "", "", ""]);
    expect(t1 - t0).toBeLessThan(1500);
    expect(t2 - t1).toBeLessThan(50);
  });
});

/**
 * Lưới chắn: mọi nơi chạy phân tích / biểu đồ / gửi dữ liệu lên backend phải dùng `getAnalysisRows`.
 * Chỉ các file được liệt kê (cần thấy và sửa mã gốc như 99) mới được gọi `getDataRows`.
 */
describe("guard: không có tab phân tích nào đọc dữ liệu thô", () => {
  // Đọc mã nguồn dạng chuỗi qua Vite (không cần module node:fs).
  const sources = import.meta.glob("../../**/*.{ts,tsx}", {
    query: "?raw",
    import: "default",
    eager: true,
  }) as Record<string, string>;
  const ALLOW_RAW = [
    "../stats.ts", // định nghĩa
    "features/data/grid/DataGrid.tsx", // lưới dữ liệu: phải hiện mã gốc
    "features/data/TransformTab.tsx", // lọc/sắp xếp/recode cần mã gốc; phép tính số dùng getAnalysisRows
  ];
  it("getDataRows( chỉ xuất hiện ở các file được phép", () => {
    const files = Object.keys(sources).filter((p) => !p.includes("__tests__"));
    expect(files.length).toBeGreaterThan(50); // glob phải quét được mã nguồn thật
    const offenders = files
      .filter((p) => !ALLOW_RAW.some((a) => p === a || p.endsWith("/" + a)))
      .filter((p) => /\bgetDataRows\s*\(/.test(sources[p]));
    expect(offenders).toEqual([]);
  });
});
