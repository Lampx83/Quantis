import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "@/stores/useDataStore";
import type { Dataset } from "@/types";
import {
  VariableViewGrid,
  getOrderedVariableMetadataList,
  buildTypeChangePatch,
} from "../VariableViewGrid";

const sampleDataset: Dataset = {
  id: "ds_var_view",
  name: "Survey Dataset",
  rows: 2,
  columns: 3,
  columnNames: ["Q1_SAT", "GENDER", "COMMENTS"],
  preview: [
    ["Q1_SAT", "GENDER", "COMMENTS"],
    ["5", "1", "Tốt"],
    ["4", "2", "Ổn"],
  ],
  data: [
    ["Q1_SAT", "GENDER", "COMMENTS"],
    ["5", "1", "Tốt"],
    ["4", "2", "Ổn"],
  ],
  variables: {
    Q1_SAT: {
      name: "Q1_SAT",
      type: "numeric",
      width: 100,
      decimals: 2,
      label: "Mức độ hài lòng chung",
      valueLabels: { "1": "Rất không hài lòng", "5": "Rất hài lòng" },
      missingValues: ["99"],
      align: "right",
      measure: "ordinal",
    },
    GENDER: {
      name: "GENDER",
      type: "numeric",
      width: 80,
      decimals: 0,
      label: "Giới tính",
      valueLabels: { "1": "Nam", "2": "Nữ" },
      missingValues: [],
      align: "center",
      measure: "nominal",
    },
    COMMENTS: {
      name: "COMMENTS",
      type: "string",
      width: 140,
      decimals: 0,
      label: "Ý kiến đóng góp thêm",
      missingValues: [],
      align: "left",
      measure: "nominal",
    },
  },
  sourceFormat: "sav",
  createdAt: "2026-10-13T00:00:00Z",
  updatedAt: "2026-10-13T00:00:00Z",
};

describe("Task 5: VariableViewGrid", () => {
  beforeEach(() => {
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDataset))],
      selectedDatasetId: "ds_var_view",
    });
  });

  it("extracts ordered variable metadata list and ensures backward compatibility", () => {
    const legacyDataset: Dataset = {
      ...sampleDataset,
      id: "ds_legacy",
      variables: undefined,
    };
    const list = getOrderedVariableMetadataList(legacyDataset);
    expect(list).toHaveLength(3);
    expect(list.map((v) => v.name)).toEqual(["Q1_SAT", "GENDER", "COMMENTS"]);
    expect(list[0].type).toBe("numeric");
    expect(list[2].type).toBe("string");
  });

  it("builds safe metadata patches when changing variable Type", () => {
    const toStringPatch = buildTypeChangePatch(sampleDataset.variables!.Q1_SAT, "string");
    expect(toStringPatch.type).toBe("string");
    expect(toStringPatch.decimals).toBe(0);
    expect(toStringPatch.align).toBe("left");
    expect(toStringPatch.measure).toBe("nominal");

    const toNumericPatch = buildTypeChangePatch(sampleDataset.variables!.COMMENTS, "numeric");
    expect(toNumericPatch.type).toBe("numeric");
    expect(toNumericPatch.decimals).toBe(0);
    expect(toNumericPatch.align).toBe("right");
  });

  it("renders all 10 standard SPSS columns and all variables in the dataset", () => {
    const html = renderToStaticMarkup(<VariableViewGrid dataset={sampleDataset} />);

    // 10 standard SPSS columns
    expect(html).toContain("#");
    expect(html).toContain("Name");
    expect(html).toContain("Type");
    expect(html).toContain("Width");
    expect(html).toContain("Decimals");
    expect(html).toContain("Label");
    expect(html).toContain("Values");
    expect(html).toContain("Missing");
    expect(html).toContain("Align");
    expect(html).toContain("Measure");

    // Variable rows & values
    expect(html).toContain('value="Q1_SAT"');
    expect(html).toContain('value="GENDER"');
    expect(html).toContain('value="COMMENTS"');
    expect(html).toContain("Mức độ hài lòng chung");
    expect(html).toContain("1=&quot;Rất không hài lòng&quot;");
    expect(html).toContain("99");

    // Modal trigger buttons [...]
    expect(html).toContain("...");
  });

  it("renders top toolbar with variable count, search box, and add variable button", () => {
    const html = renderToStaticMarkup(<VariableViewGrid dataset={sampleDataset} />);
    expect(html).toContain("Variable View — Quản trị Thuộc tính Biến số (3 biến)");
    expect(html).toContain("Tìm theo tên hoặc nhãn...");
    expect(html).toContain("Thêm biến");
  });

  it("hides Scale option in Measure dropdown for string variables but retains it for numeric", () => {
    const html = renderToStaticMarkup(<VariableViewGrid dataset={sampleDataset} />);

    // COMMENTS is string -> Measure dropdown should NOT contain Scale option
    const commentsSelectMatch = html.match(/<select[^>]*aria-label="Measure for COMMENTS"[^>]*>([\s\S]*?)<\/select>/);
    expect(commentsSelectMatch).not.toBeNull();
    const commentsOptions = commentsSelectMatch![1];
    expect(commentsOptions).not.toContain('value="scale"');
    expect(commentsOptions).toContain('value="ordinal"');
    expect(commentsOptions).toContain('value="nominal"');

    // Q1_SAT is numeric -> Measure dropdown DOES contain Scale option
    const q1SelectMatch = html.match(/<select[^>]*aria-label="Measure for Q1_SAT"[^>]*>([\s\S]*?)<\/select>/);
    expect(q1SelectMatch).not.toBeNull();
    const q1Options = q1SelectMatch![1];
    expect(q1Options).toContain('value="scale"');
    expect(q1Options).toContain('value="ordinal"');
    expect(q1Options).toContain('value="nominal"');
  });

  it("safeguards updateVariableMetadata to coerce string variables with scale measure to nominal", () => {
    const store = useDataStore.getState();
    store.updateVariableMetadata("COMMENTS", { measure: "scale" as any }, "ds_var_view");
    const updated = useDataStore.getState().datasets.find((d) => d.id === "ds_var_view");
    expect(updated?.variables?.COMMENTS.measure).toBe("nominal");
  });
});
