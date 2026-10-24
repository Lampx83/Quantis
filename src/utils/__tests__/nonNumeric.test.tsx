import { describe, it, expect, beforeEach, beforeAll, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { computeProfile, computeProfileWithOutliers, computeDescriptive, getAnalysisRows } from "../stats";
import { numericColumnNames } from "../metadata";
import { setLocale } from "../../i18n";
import { DataView } from "../../features/data/DataView";
import { DescriptiveStatsView } from "../../features/data/DescriptiveStatsView";
import type { Dataset, VariableMetadata } from "../../types";

const meta = (name: string, over: Partial<VariableMetadata> = {}): VariableMetadata => ({
  name, type: "numeric", label: name, measure: "scale", missingValues: [], decimals: 2, align: "right", width: 120, ...over,
});

// q1: 1 ô trống, 3 ô sai kiểu («bốn», «N/A», «3,5»), 99 là mã khuyết khai báo
const data: string[][] = [
  ["id", "q1", "ten"],
  ["1", "3", "a"], ["2", "4", "b"], ["3", "bốn", "c"], ["4", "5", "d"], ["5", "N/A", "e"],
  ["6", "3,5", "f"], ["7", "", "g"], ["8", "99", "h"], ["9", "2", "i"],
];
const variables = { id: meta("id"), q1: meta("q1", { missingValues: ["99"] }), ten: meta("ten", { type: "string", measure: "nominal" }) };
const ds = (): Dataset => ({
  id: "d1", name: "d1", rows: 9, columns: 3, columnNames: data[0], preview: data.slice(0, 6), data, variables,
  sourceFormat: "csv", createdAt: "", updatedAt: "",
});

describe("bảng Sơ bộ: đếm riêng ô không phải số trong cột số", () => {
  it("không có metadata → hành vi cũ (không có nonNumeric)", () => {
    const p = computeProfile(data).find((x) => x.column === "q1")!;
    expect(p.nonNumeric).toBeUndefined();
    expect(p.type).toBe("categorical");
  });

  it("có metadata: nonNumeric = 3, Missing không đổi (chỉ ô trống + mã khuyết), thống kê bỏ qua ô sai kiểu", () => {
    const rows = getAnalysisRows(ds()); // 99 → ô trống
    const p = computeProfile(rows, variables).find((x) => x.column === "q1")!;
    expect(p.type).toBe("numeric");
    expect(p.nonNumeric).toBe(3);
    expect(p.missing).toBe(2); // 1 ô trống + mã 99
    expect(p.min).toBe(2);
    expect(p.max).toBe(5);
    expect(p.mean).toBeCloseTo((3 + 4 + 5 + 2) / 4, 10);
    // Missing KHÔNG đổi so với cách đếm cũ
    expect(computeProfile(rows).find((x) => x.column === "q1")!.missing).toBe(p.missing);
  });

  it("mã khuyết khai báo vẫn là Missing, không bị tính là «không phải số»", () => {
    const rows = getAnalysisRows(ds());
    const p = computeProfile(rows, variables).find((x) => x.column === "q1")!;
    expect(p.missing + p.nonNumeric!).toBe(5);
  });

  it("cột số sạch có nonNumeric = 0; cột chữ không có trường này", () => {
    const profiles = computeProfileWithOutliers(getAnalysisRows(ds()), variables);
    expect(profiles.find((x) => x.column === "id")!.nonNumeric).toBe(0);
    expect(profiles.find((x) => x.column === "ten")!.nonNumeric).toBeUndefined();
  });

  it("outlier tính trên các ô số hợp lệ", () => {
    const rows = [["x"], ["1"], ["2"], ["3"], ["2"], ["abc"], ["1000"]];
    const p = computeProfileWithOutliers(rows, { x: meta("x") })[0];
    expect(p.nonNumeric).toBe(1);
    expect(p.outlierCount).toBe(1);
  });

  it("numericColumnNames lấy đúng các cột Numeric", () => {
    expect(numericColumnNames(variables)).toEqual(["id", "q1"]);
    expect(numericColumnNames(undefined)).toEqual([]);
  });
});

describe("bảng Mô tả: cột số khai báo giữ kiểu số và đếm ô không phải số", () => {
  it("N hợp lệ + Missing + Không phải số = tổng số dòng", () => {
    const d = computeDescriptive(getAnalysisRows(ds()), variables).find((x) => x.column === "q1")!;
    expect(d.type).toBe("numeric");
    expect(d.nonNumeric).toBe(3);
    expect(d.missing).toBe(2);
    expect(d.n - d.missing - d.nonNumeric!).toBe(4);
    expect(d.mean).toBeCloseTo(3.5, 10);
    expect(d.min).toBe(2);
    expect(d.max).toBe(5);
  });
  it("không truyền metadata → như cũ", () => {
    const d = computeDescriptive(getAnalysisRows(ds())).find((x) => x.column === "q1")!;
    expect(d.type).toBe("categorical");
    expect(d.nonNumeric).toBeUndefined();
  });
});

describe("giao diện: cột «Không phải số» + chú giải", () => {
  beforeAll(() => {
    // InfoHint dùng useLayoutEffect: renderToStaticMarkup chỉ cảnh báo SSR, không ảnh hưởng kết quả
    const orig = console.error;
    vi.spyOn(console, "error").mockImplementation((...a: unknown[]) => {
      if (!String(a[0]).includes("useLayoutEffect")) orig(...a);
    });
  });
  beforeEach(() => setLocale("vi"));
  const noop = () => undefined;
  const profilingHtml = () =>
    renderToStaticMarkup(
      <DataView tab="profiling" datasets={[ds()]} setDatasets={noop} selectedDatasetId="d1" onSelectDataset={noop} />
    );

  it("Sơ bộ: có cột, số đếm và ghi chú khi có ô sai kiểu", () => {
    const html = profilingHtml();
    expect(html).toContain("Không phải số");
    expect(html).toMatch(/data-testid="nonnumeric-q1"[^>]*>3</);
    expect(html).toMatch(/data-testid="nonnumeric-id"[^>]*>0</);
    expect(html).toContain('data-testid="nonnumeric-note"');
    expect(html).toContain("KHÔNG nằm trong Missing");
    expect(html).toContain("Giải thích thuật ngữ"); // nút (i)
  });

  it("Sơ bộ: bản tiếng Anh", () => {
    setLocale("en");
    const html = profilingHtml();
    expect(html).toContain("Non-numeric");
    expect(html).toContain("NOT counted in Missing");
  });

  it("Sơ bộ: không có ghi chú khi mọi cột số đều sạch", () => {
    const clean = ds();
    clean.data = data.filter((r) => !["bốn", "N/A", "3,5"].includes(r[1]));
    const html = renderToStaticMarkup(
      <DataView tab="profiling" datasets={[clean]} setDatasets={noop} selectedDatasetId="d1" onSelectDataset={noop} />
    );
    expect(html).not.toContain('data-testid="nonnumeric-note"');
  });

  it("Mô tả: có cột Không phải số và N hợp lệ", () => {
    const html = renderToStaticMarkup(<DescriptiveStatsView selectedDataset={ds()} />);
    expect(html).toMatch(/data-testid="desc-nonnumeric-q1"[^>]*>3</);
    expect(html).toContain('data-testid="desc-nonnumeric-note"');
  });
});
