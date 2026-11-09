import { describe, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { setLocale } from "@/i18n";
import type { Dataset, DatasetChange } from "@/types";
import { TransformationHistory } from "../TransformationHistory";

const dataset: Dataset = {
  id: "survey", name: "Survey", rows: 350, columns: 1, columnNames: ["TOTAL"],
  preview: [["TOTAL"], ["5"]], sourceFormat: "csv", createdAt: "", updatedAt: "",
};
const compute: DatasetChange = {
  id: "compute-1", datasetId: dataset.id, kind: "commit", timestamp: "2026-11-09T07:20:00Z",
  action: "transform", operation: "compute", columns: ["TOTAL"], formula: "MEAN(Q1, Q2, Q3)", rowCount: 350,
};

describe("dataset History", () => {
  it.each([
    ["en", "History", "Computed", "Undo", "Redo", "350 rows", "350 rows affected", "Total: 3 steps"],
    ["vi", "Lịch sử", "Đã tính", "Hoàn tác", "Làm lại", "350 dòng", "350 dòng bị ảnh hưởng", "Tổng: 3 bước"],
  ] as const)("shows the latest changes first and localizes affected rows in %s", (locale, title, computed, undo, redo, rows, affected, total) => {
    setLocale(locale);
    const html = renderToStaticMarkup(<TransformationHistory dataset={{
      ...dataset,
      audit: { entries: [
        compute,
        { ...compute, id: "undo-1", kind: "undo", originalChangeId: compute.id },
        { ...compute, id: "redo-1", kind: "redo", originalChangeId: compute.id },
      ] },
    }} onClose={vi.fn()} />);
    expect(html).toMatch(new RegExp(`<h2[^>]*>${title}</h2>`));
    expect(html).toContain(">Survey</span>");
    expect(html).toContain(total);
    expect(html).toContain("TOTAL = MEAN(Q1, Q2, Q3)");
    expect(html.match(new RegExp(`>${rows}</span>`, "g"))).toHaveLength(1);
    expect(html.match(new RegExp(`>${affected}</span>`, "g"))).toHaveLength(3);
    const date = new Date(compute.timestamp);
    const clock = new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
    const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
    expect(html).toContain(`dateTime="${compute.timestamp}" title="${fullDate}">${clock}</time>`);
    expect(html.indexOf(redo)).toBeLessThan(html.indexOf(undo));
    expect(html.lastIndexOf(undo)).toBeLessThan(html.lastIndexOf(computed));
  });

  it("shows four variable chips and counts all other variables, including names omitted by retention", () => {
    setLocale("en");
    const html = renderToStaticMarkup(<TransformationHistory dataset={{
      ...dataset,
      audit: { entries: [{
        ...compute, operation: "fill_mice", formula: undefined,
        columns: ["ma_nguoi_tra_loi", "TS1", "TS2", "TS3", "TS4", "TS5", "TS6", "TS7"], columnCount: 21,
      }] },
    }} onClose={vi.fn()} />);
    expect(html.match(/<code[^>]*>[^<]+<\/code>/g)).toHaveLength(4);
    expect(html).toContain(">ma_nguoi_tra_loi</code>");
    expect(html).toContain("+17 variables");
    expect(html).toContain('title="TS4, TS5, TS6, TS7');
    expect(html).not.toContain(">TS4</code>");
  });

  it("shows distinct empty and cutoff states for the selected dataset", () => {
    setLocale("en");
    const empty = renderToStaticMarkup(<TransformationHistory dataset={dataset} onClose={vi.fn()} />);
    expect(empty).toContain("No changes recorded yet");
    expect(empty).not.toContain("Earlier changes");
    const truncated = renderToStaticMarkup(<TransformationHistory dataset={{
      ...dataset, name: "Other dataset", audit: { entries: [compute], cutoffAt: compute.timestamp },
    }} onClose={vi.fn()} />);
    expect(truncated).toContain("Other dataset");
    expect(truncated).toContain("Earlier changes");
    expect(truncated).not.toContain("No changes recorded yet");
  });

  it("shows the captured source name and imputation member after the source is gone", () => {
    setLocale("en");
    const html = renderToStaticMarkup(<TransformationHistory dataset={{
      ...dataset, audit: { entries: [{
        id: "extract", datasetId: dataset.id, timestamp: compute.timestamp, action: "extractImputation",
        kind: "derive", source: { datasetId: "removed-source", name: "Original survey", member: 2 },
      }] },
    }} onClose={vi.fn()} />);
    expect(html).toContain("Original survey");
    expect(html).toContain("Imputation 2");
  });
});
