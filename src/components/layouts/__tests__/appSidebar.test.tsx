import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { AppSidebar } from "../AppSidebar";
import * as stores from "@/stores";
import { setLocale } from "@/i18n";
import type { Dataset } from "@/types";

const mockStandardDataset: Dataset = {
  id: "ds_standard",
  name: "Standard Dataset",
  rows: 10,
  columns: 2,
  columnNames: ["A", "B"],
  preview: [["A", "B"], ["1", "2"]],
  data: [["A", "B"], ["1", "2"]],
  sourceFormat: "csv",
  createdAt: "2026-10-15T00:00:00Z",
  updatedAt: "2026-10-15T00:00:00Z",
};

const mockBundleDataset: Dataset = {
  id: "ds_bundle",
  name: "Bundle Dataset",
  rows: 10,
  columns: 2,
  columnNames: ["A", "B"],
  preview: [["A", "B"], ["1", "2"]],
  data: [["A", "B"], ["1", "2"]],
  readOnly: true,
  imputationMeta: {
    bundleId: "bundle_abc",
    m: 5,
    activeImputationIndex: 0,
    imputedColumns: ["B"],
    originalRows: [["A", "B"], ["1", "2"]],
    sparsePatches: {},
  },
  sourceFormat: "csv",
  createdAt: "2026-10-15T00:00:00Z",
  updatedAt: "2026-10-15T00:00:00Z",
};

describe("AppSidebar - Multiple Imputation Badge", () => {
  beforeEach(() => {
    setLocale("vi");
    vi.spyOn(stores, "useDataStore").mockReturnValue({
      datasets: [mockStandardDataset, mockBundleDataset],
      setDatasets: vi.fn(),
      selectedDatasetId: "ds_bundle",
      setSelectedDatasetId: vi.fn(),
    } as any);
    vi.spyOn(stores, "useWorkflowStore").mockReturnValue({
      workflows: [],
      setWorkflows: vi.fn(),
      selectedWorkflowId: null,
      setSelectedWorkflowId: vi.fn(),
      setSelectedWorkflowStepId: vi.fn(),
    } as any);
    vi.spyOn(stores, "useUIStore").mockReturnValue({
      sidebarOpen: true,
      setSidebarOpen: vi.fn(),
      isMobileLayout: false,
      setShowSampleModal: vi.fn(),
      setArchiveModalOpen: vi.fn(),
      setConfirmDialog: vi.fn(),
      showToast: vi.fn(),
    } as any);
  });

  it("renders dataset names and MI badge when dataset has imputationMeta", () => {
    const htmlVi = renderToStaticMarkup(<AppSidebar />);
    expect(htmlVi).toContain("Bundle Dataset");
    expect(htmlVi).toContain("MI · 5 bộ");

    setLocale("en");
    const htmlEn = renderToStaticMarkup(<AppSidebar />);
    expect(htmlEn).toContain("MI · 5 sets");
  });

  it("does not render MI badge for standard dataset without imputationMeta", () => {
    vi.spyOn(stores, "useDataStore").mockReturnValue({
      datasets: [mockStandardDataset],
      setDatasets: vi.fn(),
      selectedDatasetId: "ds_standard",
      setSelectedDatasetId: vi.fn(),
    } as any);

    const html = renderToStaticMarkup(<AppSidebar />);
    expect(html).toContain("Standard Dataset");
    expect(html).not.toContain("MI ·");
  });
});
