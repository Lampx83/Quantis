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
    ["en", "Computed", "Undo", "Redo", "350 rows"],
    ["vi", "Đã tính", "Hoàn tác", "Làm lại", "350 dòng"],
  ] as const)("localizes the same chronological changes and reversal context in %s", (locale, computed, undo, redo, rows) => {
    setLocale(locale);
    const html = renderToStaticMarkup(<TransformationHistory dataset={{
      ...dataset,
      audit: { entries: [
        compute,
        { ...compute, id: "undo-1", kind: "undo", originalChangeId: compute.id },
        { ...compute, id: "redo-1", kind: "redo", originalChangeId: compute.id },
      ] },
    }} onClose={vi.fn()} />);
    expect(html).toContain(computed);
    expect(html).toContain("TOTAL = MEAN(Q1, Q2, Q3)");
    expect(html).toContain(rows);
    expect(html).toContain(`dateTime="${compute.timestamp}"`);
    expect(html.indexOf(undo)).toBeGreaterThan(html.indexOf(computed));
    expect(html.indexOf(redo)).toBeGreaterThan(html.indexOf(undo));
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
