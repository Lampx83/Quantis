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
const deleteRow: DatasetChange = {
  id: "delete-row", datasetId: dataset.id, kind: "commit", timestamp: compute.timestamp, action: "deleteRow",
};
const filter: DatasetChange = { ...deleteRow, id: "filter", action: "transform", operation: "filter" };

describe("dataset History", () => {
  it.each<[string, DatasetChange, string]>([
    ["deleting a row", deleteRow, "bg-red-600 dark:bg-red-400"],
    ["deleting a variable", { ...deleteRow, action: "deleteColumn" }, "bg-red-600 dark:bg-red-400"],
    ["undoing a deletion", { ...deleteRow, kind: "undo", originalChangeId: deleteRow.id }, "bg-slate-500 dark:bg-slate-400"],
    ["redoing a deletion", { ...deleteRow, kind: "redo", originalChangeId: deleteRow.id }, "bg-red-600 dark:bg-red-400"],
    ["filtering the current dataset", filter, "bg-amber-700 dark:bg-amber-400"],
    ["filtering into a new dataset", { ...filter, kind: "derive", source: { datasetId: "source", name: "Source" } }, "bg-blue-600 dark:bg-blue-400"],
    ["computing a variable", compute, "bg-emerald-600 dark:bg-emerald-400"],
    ["editing a cell", { ...deleteRow, action: "cell" }, "bg-slate-500 dark:bg-slate-400"],
    ["imputing missing values", { ...filter, operation: "fill_mice" }, "bg-violet-600 dark:bg-violet-400"],
  ])("shows the semantic dot for %s", (_name, change, colors) => {
    const html = renderToStaticMarkup(<TransformationHistory dataset={{
      ...dataset, audit: { entries: [change] },
    }} onClose={vi.fn()} />);
    expect(html).toContain(`${colors}"`);
  });

  it.each([
    ["en", "History", "Computed", "Undo", "Redo", "350 rows", "Total: 3 steps"],
    ["vi", "Lịch sử", "Đã tính", "Hoàn tác", "Làm lại", "350 dòng", "Tổng: 3 bước"],
  ] as const)("shows the latest changes first and localizes the dataset row total in %s", (locale, title, computed, undo, redo, rows, total) => {
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
    const date = new Date(compute.timestamp);
    const clock = new Intl.DateTimeFormat(locale, { timeStyle: "short" }).format(date);
    const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(date);
    expect(html).toContain(`dateTime="${compute.timestamp}" title="${fullDate}">${clock}</time>`);
    expect(html.indexOf(redo)).toBeLessThan(html.indexOf(undo));
    expect(html.lastIndexOf(undo)).toBeLessThan(html.lastIndexOf(computed));
  });

  it("keeps row locations and bulk counts while omitting routine edit counts", () => {
    setLocale("en");
    const html = renderToStaticMarkup(<TransformationHistory dataset={{
      ...dataset, audit: { entries: [
        { ...deleteRow, firstRow: 10, rowCount: 1 },
        { ...deleteRow, id: "delete-column", action: "deleteColumn", columns: ["TS1"], rowCount: 200 },
        { ...deleteRow, id: "edit-cell", action: "cell", columns: ["nam_hoc"], firstRow: 4, rowCount: 1, cellCount: 1 },
        { ...deleteRow, id: "paste", action: "paste", firstRow: 5, lastRow: 8, rowCount: 4, cellCount: 12 },
        { ...filter, rowCount: 2 },
      ] },
    }} onClose={vi.fn()} />);

    expect(html).toContain(">Row 10</span>");
    expect(html).toContain(">Row 4</span>");
    expect(html).toContain(">Rows 5–8</span>");
    expect(html).toContain(">12 cells</span>");
    expect(html).toContain(">2 rows affected</span>");
    expect(html).not.toContain("200 rows");
    expect(html).not.toContain("1 cell");
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
