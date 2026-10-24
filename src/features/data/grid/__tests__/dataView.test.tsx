import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDataStore } from "@/stores/useDataStore";
import { useUIStore } from "@/stores/useUIStore";
import { setLocale } from "@/i18n";
import type { Dataset } from "@/types";
import * as DataFeatureExports from "../../index";
import { DataView } from "../../DataView";

const mockDataset: Dataset = {
  id: "ds_workspace",
  name: "Workspace Dataset",
  rows: 2,
  columns: 2,
  columnNames: ["GENDER", "SATISFACTION"],
  preview: [
    ["GENDER", "SATISFACTION"],
    ["1", "5"],
    ["2", "4"],
  ],
  data: [
    ["GENDER", "SATISFACTION"],
    ["1", "5"],
    ["2", "4"],
  ],
  variables: {
    GENDER: {
      name: "GENDER",
      type: "numeric",
      label: "Giới tính",
      valueLabels: { "1": "Nam", "2": "Nữ" },
      missingValues: [],
      measure: "nominal",
      decimals: 0,
      align: "center",
    },
    SATISFACTION: {
      name: "SATISFACTION",
      type: "numeric",
      label: "Mức độ hài lòng",
      valueLabels: { "4": "Hài lòng", "5": "Rất hài lòng" },
      missingValues: ["99"],
      measure: "ordinal",
      decimals: 2,
      align: "right",
    },
  },
  sourceFormat: "sav",
  createdAt: "2026-10-13T00:00:00Z",
  updatedAt: "2026-10-13T00:00:00Z",
};

describe("Task 7: DataView Integration & Bottom Tab Strip Switcher", () => {
  beforeEach(() => {
    setLocale("en");
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(mockDataset))],
      selectedDatasetId: "ds_workspace",
    });
    useUIStore.setState({
      dataEditorView: "data",
      showValueLabels: false,
    });
  });

  it("exports all new grid and modal components from src/features/data/index.ts", () => {
    expect(DataFeatureExports.DataView).toBeDefined();
    expect((DataFeatureExports as Record<string, unknown>).DataGrid).toBeDefined();
    expect((DataFeatureExports as Record<string, unknown>).VariableViewGrid).toBeDefined();
    expect((DataFeatureExports as Record<string, unknown>).ValueLabelsModal).toBeDefined();
    expect((DataFeatureExports as Record<string, unknown>).MissingValuesModal).toBeDefined();
    expect((DataFeatureExports as Record<string, unknown>).GridContextMenu).toBeDefined();
  });

  it("renders empty prompt gracefully when no dataset is selected", () => {
    const html = renderToStaticMarkup(
      <DataView
        tab="preview"
        datasets={[]}
        setDatasets={vi.fn()}
        selectedDatasetId={null}
        onSelectDataset={vi.fn()}
      />
    );
    expect(html).toBeTruthy();
    expect(html).not.toContain("Variable View");
  });

  it("renders DataGrid, Value Labels toggle button, and bottom-left tab strip in Data View mode bilingually", () => {
    setLocale("en");
    useUIStore.setState({ dataEditorView: "data", showValueLabels: true });
    const ds = useDataStore.getState().datasets[0];

    const html = renderToStaticMarkup(
      <DataView
        tab="preview"
        datasets={[ds]}
        setDatasets={vi.fn()}
        selectedDatasetId="ds_workspace"
        onSelectDataset={vi.fn()}
      />
    );

    expect(html).toContain("Data View");
    expect(html).toContain("Variable View");
    expect(html).toContain("Value Labels");
    expect(html).toContain("Nam");
    expect(html).toContain("Rất hài lòng");

    setLocale("vi");
    const htmlVi = renderToStaticMarkup(
      <DataView
        tab="preview"
        datasets={[ds]}
        setDatasets={vi.fn()}
        selectedDatasetId="ds_workspace"
        onSelectDataset={vi.fn()}
      />
    );
    expect(htmlVi).toContain("Xem Dữ liệu");
    expect(htmlVi).toContain("Xem Biến số");
    expect(htmlVi).toContain("Nhãn Giá trị");
  });

  it("renders VariableViewGrid when switched to Variable View and reflects metadata updates immediately in Data View", () => {
    // 1. Update variable metadata as in Variable View
    useDataStore.getState().renameVariable("SATISFACTION", "SAT_SCORE", "ds_workspace");
    useDataStore.getState().updateVariableMetadata(
      "GENDER",
      { valueLabels: { "1": "Nam giới", "2": "Nữ giới" } },
      "ds_workspace"
    );

    // 2. Render in Variable View mode
    useUIStore.setState({ dataEditorView: "variable" });
    const updatedDs = useDataStore.getState().datasets[0];
    const varViewHtml = renderToStaticMarkup(
      <DataView
        tab="preview"
        datasets={[updatedDs]}
        setDatasets={vi.fn()}
        selectedDatasetId="ds_workspace"
        onSelectDataset={vi.fn()}
      />
    );
    expect(varViewHtml).toContain("Data View");
    expect(varViewHtml).toContain("Variable View");
    expect(varViewHtml).toContain('value="SAT_SCORE"');
    expect(varViewHtml).toContain("Decimals");

    // 3. Switch back to Data View mode with Value Labels ON -> reflects new name & labels immediately
    useUIStore.setState({ dataEditorView: "data", showValueLabels: true });
    const dataViewHtml = renderToStaticMarkup(
      <DataView
        tab="preview"
        datasets={[updatedDs]}
        setDatasets={vi.fn()}
        selectedDatasetId="ds_workspace"
        onSelectDataset={vi.fn()}
      />
    );
    expect(dataViewHtml).toContain("SAT_SCORE");
    expect(dataViewHtml).toContain("Nam giới");

    // 4. Update decimals for GENDER to 2 in store and switch Value Labels OFF -> reflects formatted decimals
    useDataStore.getState().updateVariableMetadata("GENDER", { decimals: 2 }, "ds_workspace");
    useUIStore.setState({ showValueLabels: false });
    const dsWithDecimals = useDataStore.getState().datasets[0];
    const dataViewDecimalsHtml = renderToStaticMarkup(
      <DataView
        tab="preview"
        datasets={[dsWithDecimals]}
        setDatasets={vi.fn()}
        selectedDatasetId="ds_workspace"
        onSelectDataset={vi.fn()}
      />
    );
    expect(dataViewDecimalsHtml).toContain("1.00");
    expect(dataViewDecimalsHtml).toContain("2.00");
  });
});
