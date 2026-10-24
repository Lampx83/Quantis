import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "@/stores/useDataStore";
import { useUIStore } from "@/stores/useUIStore";
import { setLocale } from "@/i18n";
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
    setLocale("en");
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

  it("renders all 10 standard SPSS columns and all variables in the dataset bilingually", () => {
    setLocale("en");
    const htmlEn = renderToStaticMarkup(<VariableViewGrid dataset={sampleDataset} />);

    // 10 standard SPSS columns in English
    expect(htmlEn).toContain("#");
    expect(htmlEn).toContain("Name");
    expect(htmlEn).toContain("Type");
    expect(htmlEn).toContain("Width");
    expect(htmlEn).toContain("Decimals");
    expect(htmlEn).toContain("Label");
    expect(htmlEn).toContain("Values");
    expect(htmlEn).toContain("Missing");
    expect(htmlEn).toContain("Align");
    expect(htmlEn).toContain("Measure");

    // Variable rows & values
    expect(htmlEn).toContain('value="Q1_SAT"');
    expect(htmlEn).toContain('value="GENDER"');
    expect(htmlEn).toContain('value="COMMENTS"');
    expect(htmlEn).toContain("Mức độ hài lòng chung");
    expect(htmlEn).toContain("1=&quot;Rất không hài lòng&quot;");
    expect(htmlEn).toContain("99");

    // Modal trigger buttons [...]
    expect(htmlEn).toContain("...");

    // Test Vietnamese headers
    setLocale("vi");
    const htmlVi = renderToStaticMarkup(<VariableViewGrid dataset={sampleDataset} />);
    expect(htmlVi).toContain("Tên biến");
    expect(htmlVi).toContain("Kiểu");
    expect(htmlVi).toContain("Độ rộng");
    expect(htmlVi).toContain("Thập phân");
    expect(htmlVi).toContain("Nhãn biến số");
    expect(htmlVi).toContain("Nhãn giá trị");
    expect(htmlVi).toContain("Giá trị khuyết");
    expect(htmlVi).toContain("Căn lề");
    expect(htmlVi).toContain("Thang đo");
  });

  it("renders top toolbar with variable count, search box, and add variable button bilingually", () => {
    setLocale("vi");
    const htmlVi = renderToStaticMarkup(<VariableViewGrid dataset={sampleDataset} />);
    expect(htmlVi).toContain("Variable View — Quản trị Thuộc tính Biến số (3 biến)");
    expect(htmlVi).toContain("Tìm theo tên hoặc nhãn...");
    expect(htmlVi).toContain("Thêm biến");

    setLocale("en");
    const htmlEn = renderToStaticMarkup(<VariableViewGrid dataset={sampleDataset} />);
    expect(htmlEn).toContain("Variable View — Manage Variable Metadata (3 variables)");
    expect(htmlEn).toContain("Search by name or label...");
    expect(htmlEn).toContain("Add Variable");
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

  it("triggers confirm dialog when deleting a variable and automatically closes on confirm", () => {
    useUIStore.setState({ confirmDialog: null });
    let rendered: any = null;
    function Harness() {
      rendered = VariableViewGrid({ dataset: sampleDataset });
      return rendered;
    }
    renderToStaticMarkup(<Harness />);
    // tableContainer is child index 2 of root div
    const tableContainer = rendered.props.children[2];
    const table = tableContainer.props.children;
    const tbody = table.props.children[1];
    const rows = tbody.props.children[0];
    const firstRow = rows[0];
    const actionsCell = firstRow.props.children[10];
    const deleteBtn = actionsCell.props.children;

    expect(deleteBtn).toBeDefined();
    // Simulate delete button click
    deleteBtn.props.onClick();

    const dialogState = useUIStore.getState().confirmDialog;
    expect(dialogState).not.toBeNull();
    expect(dialogState?.message).toContain("Q1_SAT");

    // Execute onConfirm
    dialogState?.onConfirm();

    // Verify variable was deleted and dialog is closed
    expect(useUIStore.getState().confirmDialog).toBeNull();
    const updated = useDataStore.getState().datasets.find((d) => d.id === "ds_var_view");
    expect(updated?.columnNames).not.toContain("Q1_SAT");
  });

  it("handles Width input draft without clamping on keystroke, clamping on blur", () => {
    let rendered: any = null;
    function Harness() {
      rendered = VariableViewGrid({ dataset: sampleDataset });
      return rendered;
    }
    renderToStaticMarkup(<Harness />);
    const tableContainer = rendered.props.children[2];
    const table = tableContainer.props.children;
    const tbody = table.props.children[1];
    const rows = tbody.props.children[0];
    const firstRow = rows[0]; // Q1_SAT
    // Cell index 3 is Width (cells: 0: #, 1: Name, 2: Type, 3: Width, ...)
    const widthCell = firstRow.props.children[3];
    const widthInput = widthCell.props.children;

    expect(widthInput.props["aria-label"]).toBe("Width for Q1_SAT");
    expect(widthInput.props.value).toBe(100);

    // Typing '1' sets draft and does not prematurely clamp store to 40
    widthInput.props.onChange({ target: { value: "1" } });
    expect(useDataStore.getState().datasets[0].variables?.Q1_SAT.width).toBe(100);

    // Typing '120' and blurring commits 120 without getting clamped by '1'
    widthInput.props.onBlur({ target: { value: "120" } });
    expect(useDataStore.getState().datasets[0].variables?.Q1_SAT.width).toBe(120);

    // Blurring with a value under 40 clamps to minimum 40
    widthInput.props.onBlur({ target: { value: "25" } });
    expect(useDataStore.getState().datasets[0].variables?.Q1_SAT.width).toBe(40);

    // Blurring with a value over 400 clamps to maximum 400
    widthInput.props.onBlur({ target: { value: "500" } });
    expect(useDataStore.getState().datasets[0].variables?.Q1_SAT.width).toBe(400);
  });
});

