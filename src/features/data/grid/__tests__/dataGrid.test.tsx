import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDataStore } from "@/stores/useDataStore";
import { useUIStore } from "@/stores/useUIStore";
import { setLocale } from "@/i18n";
import type { Dataset, VariableMetadata } from "@/types";
import {
  DataGrid,
  filterAndSortDataRows,
  paginateIndexedRows,
  formatDisplayCellValue,
  parseClipboardPasteMatrix,
} from "../DataGrid";
import { GridContextMenu } from "../GridContextMenu";

const mockDataset: Dataset = {
  id: "ds_grid_test",
  name: "Grid Test Dataset",
  rows: 3,
  columns: 3,
  columnNames: ["ID", "GENDER", "SCORE"],
  preview: [
    ["ID", "GENDER", "SCORE"],
    ["1", "1", "85.5"],
    ["2", "2", "92.0"],
    ["3", "1", "74.0"],
  ],
  data: [
    ["ID", "GENDER", "SCORE"],
    ["1", "1", "85.5"],
    ["2", "2", "92.0"],
    ["3", "1", "74.0"],
  ],
  variables: {
    ID: {
      name: "ID",
      type: "numeric",
      label: "Mã quan sát",
      measure: "nominal",
      decimals: 0,
      align: "right",
    },
    GENDER: {
      name: "GENDER",
      type: "numeric",
      label: "Giới tính",
      measure: "nominal",
      valueLabels: { "1": "Nam", "2": "Nữ" },
      missingValues: ["99"],
      decimals: 0,
      align: "center",
    },
    SCORE: {
      name: "SCORE",
      type: "numeric",
      label: "Điểm tổng kết",
      measure: "scale",
      missingValues: ["999"],
      decimals: 2,
      align: "right",
    },
  },
  sourceFormat: "sav",
  createdAt: "2026-10-13T00:00:00Z",
  updatedAt: "2026-10-13T00:00:00Z",
};

describe("Task 6: DataGrid & GridContextMenu", () => {
  beforeEach(() => {
    setLocale("vi");
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(mockDataset))],
      selectedDatasetId: "ds_grid_test",
    });
    useUIStore.setState({
      dataEditorView: "data",
      showValueLabels: false,
    });
  });

  it("filters and sorts data rows while preserving originalRowIndex", () => {
    const rawRows = [
      ["1", "1", "85.5"],
      ["2", "2", "92.0"],
      ["3", "1", "74.0"],
    ];

    // Sort by SCORE (col 2) descending
    const sortedDesc = filterAndSortDataRows(rawRows, {
      sortColIndex: 2,
      sortDir: "desc",
    });
    expect(sortedDesc.map((r) => r.cells[2])).toEqual(["92.0", "85.5", "74.0"]);
    expect(sortedDesc.map((r) => r.originalRowIndex)).toEqual([1, 0, 2]);

    // Filter by query "92.0"
    const filtered = filterAndSortDataRows(rawRows, { query: "92.0" });
    expect(filtered).toHaveLength(1);
    expect(filtered[0].originalRowIndex).toBe(1);
  });

  it("paginates indexed rows accurately across pages", () => {
    const indexed = Array.from({ length: 45 }, (_, i) => ({
      originalRowIndex: i,
      cells: [String(i + 1)],
    }));

    const page1 = paginateIndexedRows(indexed, 1, 20);
    expect(page1.totalPages).toBe(3);
    expect(page1.pageRows).toHaveLength(20);
    expect(page1.startIdx).toBe(0);
    expect(page1.endIdx).toBe(20);

    const page3 = paginateIndexedRows(indexed, 3, 20);
    expect(page3.pageRows).toHaveLength(5);
    expect(page3.pageRows[0].originalRowIndex).toBe(40);
  });

  it("formats display cell value according to showValueLabels and missingValues", () => {
    const genderMeta = mockDataset.variables!.GENDER;

    const rawMode = formatDisplayCellValue("1", genderMeta, false);
    expect(rawMode.text).toBe("1");
    expect(rawMode.isLabel).toBe(false);

    const labelMode = formatDisplayCellValue("1", genderMeta, true);
    expect(labelMode.text).toBe("Nam");
    expect(labelMode.isLabel).toBe(true);

    const missingCode = formatDisplayCellValue("99", genderMeta, true);
    expect(missingCode.isMissingCode).toBe(true);
  });

  it("formats numeric cell with decimals when meta.type is numeric and decimals is configured", () => {
    const scoreMeta = mockDataset.variables!.SCORE; // type: numeric, decimals: 2

    // Whole number formatted with 2 decimals
    const wholeVal = formatDisplayCellValue("85", scoreMeta, false);
    expect(wholeVal.text).toBe("85.00");

    // Existing decimal formatted with 2 decimals
    const singleDecVal = formatDisplayCellValue("85.5", scoreMeta, false);
    expect(singleDecVal.text).toBe("85.50");

    // Rounded with 2 decimals
    const multiDecVal = formatDisplayCellValue("85.556", scoreMeta, false);
    expect(multiDecVal.text).toBe("85.56");

    // With 1 decimal
    const oneDecMeta = { ...scoreMeta, decimals: 1 };
    expect(formatDisplayCellValue("85", oneDecMeta, false).text).toBe("85.0");
    expect(formatDisplayCellValue("85.5", oneDecMeta, false).text).toBe("85.5");

    // With 0 decimals
    const zeroDecMeta = { ...scoreMeta, decimals: 0 };
    expect(formatDisplayCellValue("85.6", zeroDecMeta, false).text).toBe("86");
    expect(formatDisplayCellValue("85", zeroDecMeta, false).text).toBe("85");

    // Non-numeric or empty value remains unchanged
    expect(formatDisplayCellValue("", scoreMeta, false).text).toBe("");
    expect(formatDisplayCellValue("N/A", scoreMeta, false).text).toBe("N/A");

    // String variable does not apply decimals
    const stringMeta: VariableMetadata = {
      name: "COMMENT",
      type: "string",
      label: "Bình luận",
      decimals: 2,
      align: "left",
      measure: "nominal",
    };
    expect(formatDisplayCellValue("10", stringMeta, false).text).toBe("10");

    // Discrete missing code should NOT be formatted with decimals (e.g. 999 not 999.00)
    const missingVal = formatDisplayCellValue("999", scoreMeta, false);
    expect(missingVal.text).toBe("999");
    expect(missingVal.isMissingCode).toBe(true);

    const missingValFloat = formatDisplayCellValue("999.0", scoreMeta, false);
    expect(missingValFloat.text).toBe("999.0");
    expect(missingValFloat.isMissingCode).toBe(true);
  });

  it("parses multi-cell clipboard TSV paste matrix within bounds", () => {
    const updates = parseClipboardPasteMatrix("10\t20\n30\t40\n", 1, 1, 3, 3);
    expect(updates).toEqual([
      { rowIndex: 1, colIndex: 1, value: "10" },
      { rowIndex: 1, colIndex: 2, value: "20" },
      { rowIndex: 2, colIndex: 1, value: "30" },
      { rowIndex: 2, colIndex: 2, value: "40" },
    ]);
  });

  it("renders DataGrid with headers, MeasureIcons, raw values or Value Labels, and pagination bar", () => {
    const rawHtml = renderToStaticMarkup(
      <DataGrid dataset={mockDataset} showValueLabels={false} />
    );
    expect(rawHtml).toContain("GENDER");
    expect(rawHtml).toContain("SCORE");
    expect(rawHtml).toContain("85.5");
    expect(rawHtml).not.toContain(">Nam<");

    const labeledHtml = renderToStaticMarkup(
      <DataGrid dataset={mockDataset} showValueLabels={true} />
    );
    expect(labeledHtml).toContain("Nam");
    expect(labeledHtml).toContain("Nữ");
  });

  it("renders GridContextMenu options for column and row targets", () => {
    const colMenuHtml = renderToStaticMarkup(
      <GridContextMenu
        menu={{
          type: "column",
          x: 100,
          y: 100,
          colIndex: 1,
          colName: "GENDER",
        }}
        onClose={vi.fn()}
        onSortAsc={vi.fn()}
        onSortDesc={vi.fn()}
        onRenameColumn={vi.fn()}
        onInsertColumn={vi.fn()}
        onDeleteColumn={vi.fn()}
        onInsertRowAbove={vi.fn()}
        onInsertRowBelow={vi.fn()}
        onDeleteRow={vi.fn()}
      />
    );
    expect(colMenuHtml).toContain("GENDER");
    expect(colMenuHtml).toContain("Sắp xếp tăng dần");
    expect(colMenuHtml).toContain("Đổi tên biến");

    const rowMenuHtml = renderToStaticMarkup(
      <GridContextMenu
        menu={{
          type: "row",
          x: 120,
          y: 140,
          rowIndex: 0,
        }}
        onClose={vi.fn()}
        onSortAsc={vi.fn()}
        onSortDesc={vi.fn()}
        onRenameColumn={vi.fn()}
        onInsertColumn={vi.fn()}
        onDeleteColumn={vi.fn()}
        onInsertRowAbove={vi.fn()}
        onInsertRowBelow={vi.fn()}
        onDeleteRow={vi.fn()}
      />
    );
    expect(rowMenuHtml).toContain("Chèn dòng phía trên");
    expect(rowMenuHtml).toContain("Xóa dòng");
  });

  it("renders empty missing cells as (khuyết) or (missing) based on active locale", () => {
    const dsWithEmptyCell: Dataset = {
      ...mockDataset,
      preview: [
        ["ID", "GENDER", "SCORE"],
        ["1", "", "85.5"],
      ],
      data: [
        ["ID", "GENDER", "SCORE"],
        ["1", "", "85.5"],
      ],
      variables: {
        ...mockDataset.variables,
        GENDER: {
          ...mockDataset.variables!.GENDER,
          missingValues: [], // No discrete missing values configured
        },
      },
    };

    setLocale("vi");
    const htmlVi = renderToStaticMarkup(
      <DataGrid dataset={dsWithEmptyCell} showValueLabels={false} />
    );
    expect(htmlVi).toContain("(khuyết)");
    expect(htmlVi).toContain("bg-rose-50/40");

    setLocale("en");
    const htmlEn = renderToStaticMarkup(
      <DataGrid dataset={dsWithEmptyCell} showValueLabels={false} />
    );
    expect(htmlEn).toContain("(missing)");
    expect(htmlEn).toContain("bg-rose-50/40");
  });

  it("prompts confirmation dialog before deleting column or row from DataGrid context menu", () => {
    useUIStore.setState({ confirmDialog: null });
    let rendered: any = null;
    function Harness() {
      rendered = DataGrid({ dataset: mockDataset });
      return rendered;
    }
    renderToStaticMarkup(<Harness />);

    const children = Array.isArray(rendered.props.children)
      ? rendered.props.children
      : [rendered.props.children];
    const contextMenu = children.find((c: any) => c && c.type === GridContextMenu);
    expect(contextMenu).toBeDefined();

    // 1. Verify column deletion requires confirmation
    contextMenu.props.onDeleteColumn("SCORE");
    let dialogState = useUIStore.getState().confirmDialog;
    expect(dialogState).not.toBeNull();
    expect(dialogState?.message).toContain("SCORE");

    let currentDs = useDataStore.getState().datasets.find((d) => d.id === mockDataset.id);
    expect(currentDs?.columnNames).toContain("SCORE");

    dialogState?.onConfirm();
    expect(useUIStore.getState().confirmDialog).toBeNull();
    currentDs = useDataStore.getState().datasets.find((d) => d.id === mockDataset.id);
    expect(currentDs?.columnNames).not.toContain("SCORE");

    // 2. Verify row deletion requires confirmation
    contextMenu.props.onDeleteRow(0);
    dialogState = useUIStore.getState().confirmDialog;
    expect(dialogState).not.toBeNull();
    expect(dialogState?.message).toContain("#1");

    expect(currentDs?.rows).toBe(3);

    dialogState?.onConfirm();
    expect(useUIStore.getState().confirmDialog).toBeNull();
    currentDs = useDataStore.getState().datasets.find((d) => d.id === mockDataset.id);
    expect(currentDs?.rows).toBe(2);
  });

  it("highlights invalid non-numeric cells in numeric columns with amber warning style, AlertTriangle, and localized tooltip", () => {
    const dsWithInvalidCell: Dataset = {
      ...mockDataset,
      preview: [
        ["ID", "GENDER", "SCORE"],
        ["1", "1", "invalid_text"],
      ],
      data: [
        ["ID", "GENDER", "SCORE"],
        ["1", "1", "invalid_text"],
      ],
    };

    setLocale("vi");
    const htmlVi = renderToStaticMarkup(
      <DataGrid dataset={dsWithInvalidCell} showValueLabels={false} />
    );
    expect(htmlVi).toContain("bg-amber-50");
    expect(htmlVi).toContain("Giá trị không hợp lệ");
    expect(htmlVi).toContain("invalid_text");

    setLocale("en");
    const htmlEn = renderToStaticMarkup(
      <DataGrid dataset={dsWithInvalidCell} showValueLabels={false} />
    );
    expect(htmlEn).toContain("bg-amber-50");
    expect(htmlEn).toContain("Invalid value");
  });

  it("does not flag empty cells, valid numbers, or text in string columns as invalid", () => {
    const dsMixed: Dataset = {
      ...mockDataset,
      preview: [
        ["ID", "GENDER", "SCORE", "COMMENT"],
        ["1", "1", "", "Good student"],
        ["2", "2", "95.5", "Excellent"],
      ],
      data: [
        ["ID", "GENDER", "SCORE", "COMMENT"],
        ["1", "1", "", "Good student"],
        ["2", "2", "95.5", "Excellent"],
      ],
      columnNames: ["ID", "GENDER", "SCORE", "COMMENT"],
      variables: {
        ...mockDataset.variables,
        COMMENT: {
          name: "COMMENT",
          type: "string",
          label: "Bình luận",
          align: "left",
          measure: "nominal",
          decimals: 0,
        },
      },
    };

    setLocale("vi");
    const html = renderToStaticMarkup(
      <DataGrid dataset={dsMixed} showValueLabels={false} />
    );
    expect(html).not.toContain("bg-amber-50");
    expect(html).toContain("(khuyết)");
    expect(html).toContain("Good student");
    expect(html).toContain("95.50");
  });
});
