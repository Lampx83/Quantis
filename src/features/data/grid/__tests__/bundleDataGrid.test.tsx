import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, beforeEach, vi } from "vitest";
import { useDataStore } from "@/stores/useDataStore";
import { setLocale } from "@/i18n";
import type { Dataset } from "@/types";
import { DataGrid } from "../DataGrid";
import { BundleNavigationBar, generateBundleCsv } from "../BundleNavigationBar";
import { DataView } from "../../DataView";

const mockBundleDataset: Dataset = {
  id: "ds_mice_bundle_test",
  name: "Survey Data (MICE)",
  rows: 4,
  columns: 3,
  columnNames: ["ID", "INCOME", "GENDER"],
  preview: [
    ["ID", "INCOME", "GENDER"],
    ["1", "1000", "Nam"],
    ["2", "", "Nữ"],
    ["3", "99", "Nam"],
    ["4", "1500", "Nam"],
  ],
  data: [
    ["ID", "INCOME", "GENDER"],
    ["1", "1000", "Nam"],
    ["2", "", "Nữ"],
    ["3", "99", "Nam"],
    ["4", "1500", "Nam"],
  ],
  variables: {
    ID: { name: "ID", label: "ID", type: "string", measure: "nominal", decimals: 0, align: "left" },
    INCOME: {
      name: "INCOME",
      label: "Thu nhập",
      type: "numeric",
      measure: "scale",
      decimals: 2,
      align: "right",
      missingValues: ["99"],
    },
    GENDER: { name: "GENDER", label: "Giới tính", type: "string", measure: "nominal", decimals: 0, align: "left" },
  },
  readOnly: true,
  imputationMeta: {
    bundleId: "bundle_123",
    m: 5,
    activeImputationIndex: 0,
    imputedColumns: ["INCOME"],
    originalRows: [
      ["ID", "INCOME", "GENDER"],
      ["1", "1000", "Nam"],
      ["2", "", "Nữ"],
      ["3", "99", "Nam"],
      ["4", "1500", "Nam"],
    ],
    sparsePatches: {
      INCOME: [
        { rowIndex: 1, values: ["1200", "1250", "1220", "1240", "1230"] },
        { rowIndex: 2, values: ["1400", "1450", "1420", "1440", "1430"] },
      ],
    },
  },
  sourceFormat: "csv",
  createdAt: "2026-10-15T00:00:00Z",
  updatedAt: "2026-10-15T00:00:00Z",
};

describe("Task 5: Bundle Navigation Bar & Imputed Cell Highlighting", () => {
  beforeEach(() => {
    setLocale("vi");
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(mockBundleDataset))],
      selectedDatasetId: "ds_mice_bundle_test",
    });
  });

  it("1. renders switcher bar with original (m=0) and m set buttons when dataset has imputationMeta", () => {
    const ds = useDataStore.getState().datasets[0];
    const html = renderToStaticMarkup(<BundleNavigationBar dataset={ds} />);

    // Should contain original button and buttons for 1..5
    expect(html).toContain("Gốc (m=0)");
    expect(html).toContain("Bộ 1");
    expect(html).toContain("Bộ 2");
    expect(html).toContain("Bộ 3");
    expect(html).toContain("Bộ 4");
    expect(html).toContain("Bộ 5");

    // Button 0 should have active styling (brand, font-semibold)
    expect(html).toContain("data-testid=\"bundle-nav-btn-0\"");
    expect(html).toContain("data-testid=\"bundle-nav-btn-2\"");
  });

  it("2. calls setActiveImputationIndex(dataset.id, 2) when clicking 'Bộ 2' button", () => {
    const spy = vi.spyOn(useDataStore.getState(), "setActiveImputationIndex");
    const ds = useDataStore.getState().datasets[0];

    let rendered: any = null;
    function Harness() {
      rendered = BundleNavigationBar({ dataset: ds });
      return rendered;
    }
    renderToStaticMarkup(<Harness />);
    expect(rendered).not.toBeNull();

    // Find the button for Bộ 2 (data-testid="bundle-nav-btn-2" or data-index=2)
    // The buttons are in the left container
    const leftContainer = rendered.props.children[0];
    const buttons = leftContainer.props.children;
    // buttons[0] is original (m=0), buttons[1] is array of 1..m buttons
    const btn2 = buttons[1].find((b: any) => b?.props?.["data-testid"] === "bundle-nav-btn-2" || b?.props?.["data-index"] === 2);
    expect(btn2).toBeDefined();

    btn2.props.onClick();

    expect(spy).toHaveBeenCalledWith(ds.id, 2);
    spy.mockRestore();
  });

  it("3. displays 'Chỉ đọc (MICE Bundle)' badge and 'Nhân bản để chỉnh sửa' button", () => {
    const ds = useDataStore.getState().datasets[0];
    const html = renderToStaticMarkup(<BundleNavigationBar dataset={ds} />);

    expect(html).toContain("Chỉ đọc (MICE Bundle)");
    expect(html).toContain("Nhân bản để chỉnh sửa");

    // Check English translation
    setLocale("en");
    const htmlEn = renderToStaticMarkup(<BundleNavigationBar dataset={ds} />);
    expect(htmlEn).toContain("Read-only (MICE Bundle)");
    expect(htmlEn).toContain("Clone to edit");
    expect(htmlEn).toContain("Original (m=0)");
    expect(htmlEn).toContain("Set 1");
  });

  it("4. calls cloneBundleAsStandardDataset when clicking 'Nhân bản để chỉnh sửa'", () => {
    const spy = vi.spyOn(useDataStore.getState(), "cloneBundleAsStandardDataset");
    const ds = useDataStore.getState().datasets[0];
    const showToast = vi.fn();

    let rendered: any = null;
    function Harness() {
      rendered = BundleNavigationBar({ dataset: ds, showToast });
      return rendered;
    }
    renderToStaticMarkup(<Harness />);

    // Find clone button in right container
    const rightContainer = rendered.props.children[1];
    const rightChildren = rightContainer.props.children;
    // badge is rightChildren[0], clone button is rightChildren[1]
    const cloneBtn = Array.isArray(rightChildren)
      ? rightChildren.find((c: any) => c?.props?.["data-testid"] === "bundle-clone-btn")
      : rightChildren;
    expect(cloneBtn).toBeDefined();

    cloneBtn.props.onClick();

    expect(spy).toHaveBeenCalledWith(ds.id, 0);
    // A new cloned dataset should be added to the store without imputationMeta and readOnly: false
    const datasets = useDataStore.getState().datasets;
    expect(datasets.length).toBe(2);
    const cloned = datasets[1];
    expect(cloned.name).toContain("(Imp 0)");
    expect(cloned.readOnly).toBe(false);
    expect(cloned.imputationMeta).toBeUndefined();

    spy.mockRestore();
  });

  it("5. highlights sparsePatches cells when activeImputationIndex is 1..m and displays tooltip", () => {
    // Switch to set 2 in store
    useDataStore.getState().setActiveImputationIndex("ds_mice_bundle_test", 2);
    const activeDs = useDataStore.getState().datasets.find((d) => d.id === "ds_mice_bundle_test")!;
    expect(activeDs.imputationMeta?.activeImputationIndex).toBe(2);

    const html = renderToStaticMarkup(<DataGrid dataset={activeDs} />);

    // In set 2:
    // row index 1 INCOME should have value "1250"
    // row index 2 INCOME should have value "1450"
    expect(html).toContain("1250");
    expect(html).toContain("1450");

    // Imputed cells should have highlight classes and tooltip
    expect(html).toContain("Giá trị nội suy (Bộ 2)");
    expect(html).toContain("bg-brand/10");
  });

  it("6. shows original values/missing placeholders without imputed highlight when at set 0", () => {
    const ds = useDataStore.getState().datasets[0];
    expect(ds.imputationMeta?.activeImputationIndex).toBe(0);

    const html = renderToStaticMarkup(<DataGrid dataset={ds} />);

    // In set 0, row 1 is empty, row 2 has missing code "99"
    expect(html).toContain("(khuyết)");
    expect(html).toContain("99");
    expect(html).not.toContain("Giá trị nội suy");
    expect(html).not.toContain("1250");
  });

  it("7. prevents cell editing when dataset is readOnly", () => {
    const ds = useDataStore.getState().datasets[0];
    expect(ds.readOnly).toBe(true);

    const html = renderToStaticMarkup(<DataGrid dataset={ds} />);
    // "Thêm dòng" button should be disabled or marked read-only
    expect(html).toContain("disabled");
  });

  it("8. integrates BundleNavigationBar into DataView above grid when dataset has imputationMeta", () => {
    const setDatasets = vi.fn();
    const onSelectDataset = vi.fn();
    const datasets = useDataStore.getState().datasets;

    const html = renderToStaticMarkup(
      <DataView
        tab="preview"
        datasets={datasets}
        setDatasets={setDatasets}
        selectedDatasetId="ds_mice_bundle_test"
        onSelectDataset={onSelectDataset}
      />
    );

    expect(html).toContain("Gốc (m=0)");
    expect(html).toContain("Chỉ đọc (MICE Bundle)");
    expect(html).toContain("Nhân bản để chỉnh sửa");
  });

  it("9. renders 'Xuất {m} bộ (CSV)' button on BundleNavigationBar beside clone button", () => {
    const ds = useDataStore.getState().datasets[0];
    const htmlVi = renderToStaticMarkup(<BundleNavigationBar dataset={ds} />);
    expect(htmlVi).toContain("bundle-export-csv-btn");
    expect(htmlVi).toContain("Xuất 5 bộ (CSV)");

    setLocale("en");
    const htmlEn = renderToStaticMarkup(<BundleNavigationBar dataset={ds} />);
    expect(htmlEn).toContain("Export 5 sets (CSV)");
  });

  it("10. generateBundleCsv generates accurate long-format CSV with _imputation column and m * n data rows", () => {
    const ds = useDataStore.getState().datasets[0];
    const csv = generateBundleCsv(ds);

    const lines = csv.split("\r\n");
    // Header should be _imputation,ID,INCOME,GENDER
    expect(lines[0]).toBe("_imputation,ID,INCOME,GENDER");

    // Total rows: 1 header + m (5) * n (4 data rows) = 21 rows
    expect(lines).toHaveLength(21);

    // First data row of set 1: _imputation=1, ID=1, INCOME=1000, GENDER=Nam
    expect(lines[1]).toBe("1,1,1000,Nam");

    // Second data row of set 1: _imputation=1, ID=2, INCOME=1200 (patched!), GENDER=Nữ
    expect(lines[2]).toBe("1,2,1200,Nữ");

    // Third data row of set 1: _imputation=1, ID=3, INCOME=1400 (patched!), GENDER=Nam
    expect(lines[3]).toBe("1,3,1400,Nam");

    // Set 2 data row 2: _imputation=2, ID=2, INCOME=1250 (patched for set 2!)
    expect(lines[6]).toBe("2,2,1250,Nữ");
  });

  it("11. clicking export CSV triggers download with correct filename", () => {
    const ds = useDataStore.getState().datasets[0];
    const createUrlSpy = vi.fn().mockReturnValue("blob:mock-url");
    const revokeUrlSpy = vi.fn();
    globalThis.URL.createObjectURL = createUrlSpy;
    globalThis.URL.revokeObjectURL = revokeUrlSpy;

    const clickedA: any[] = [];
    const mockElement = {
      href: "",
      download: "",
      click: vi.fn(function (this: any) {
        clickedA.push({ href: this.href, download: this.download });
      }),
    };
    (globalThis as any).document = {
      createElement: vi.fn(() => mockElement),
      body: {
        appendChild: vi.fn(),
        removeChild: vi.fn(),
      },
    };

    let rendered: any = null;
    function Harness() {
      rendered = BundleNavigationBar({ dataset: ds });
      return rendered;
    }
    renderToStaticMarkup(<Harness />);

    const rightContainer = rendered.props.children[1];
    const rightChildren = rightContainer.props.children;
    const exportBtn = rightChildren.find((c: any) => c?.props?.["data-testid"] === "bundle-export-csv-btn");
    expect(exportBtn).toBeDefined();

    exportBtn.props.onClick();

    expect(createUrlSpy).toHaveBeenCalledTimes(1);
    expect(clickedA).toHaveLength(1);
    expect(clickedA[0].download).toBe("Survey Data (MICE)_MI_m5.csv");
  });
});
