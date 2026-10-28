import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "../useDataStore";
import type { Dataset } from "@/types";

describe("Imputed Dataset Bundle Store Actions & Guards", () => {
  const createMockBundleDataset = (): Dataset => ({
    id: "bundle_ds_1",
    name: "Survey Data",
    rows: 4,
    columns: 3,
    columnNames: ["id", "income", "satisfaction"],
    preview: [
      ["id", "income", "satisfaction"],
      ["1", "", "4"],
      ["2", "5000", ""],
      ["3", "6000", "5"],
      ["4", "", ""],
    ],
    data: [
      ["id", "income", "satisfaction"],
      ["1", "", "4"],
      ["2", "5000", ""],
      ["3", "6000", "5"],
      ["4", "", ""],
    ],
    variables: {
      id: {
        name: "id",
        type: "string",
        label: "ID",
        measure: "nominal",
        decimals: 0,
        align: "left",
      },
      income: {
        name: "income",
        type: "numeric",
        label: "Income",
        measure: "scale",
        decimals: 0,
        align: "right",
      },
      satisfaction: {
        name: "satisfaction",
        type: "numeric",
        label: "Satisfaction",
        measure: "ordinal",
        decimals: 0,
        align: "right",
      },
    },
    sourceFormat: "csv",
    readOnly: true,
    imputationMeta: {
      bundleId: "bundle_uuid_123",
      m: 3,
      activeImputationIndex: 0,
      imputedColumns: ["income", "satisfaction"],
      sparsePatches: {
        income: [
          { rowIndex: 0, values: ["4500", "4600", "4700"] },
          { rowIndex: 3, values: ["7000", "7100", "7200"] },
        ],
        satisfaction: [
          { rowIndex: 1, values: ["3", "4", "3"] },
          { rowIndex: 3, values: ["2", "3", "4"] },
        ],
      },
      originalRows: [
        ["id", "income", "satisfaction"],
        ["1", "", "4"],
        ["2", "5000", ""],
        ["3", "6000", "5"],
        ["4", "", ""],
      ],
      rubinStatistics: [
        {
          column: "income",
          missingCount: 2,
          originalMean: 5500,
          originalStd: 707.1,
          pooledMean: 5650,
          withinVariance: 50000,
          betweenVariance: 20000,
          totalVariance: 76666.67,
          rubinSe: 276.89,
          df: 8.5,
          fmi: 0.35,
          ciLower: 5012.3,
          ciUpper: 6287.7,
        },
        {
          column: "satisfaction",
          missingCount: 2,
          originalMean: 4.5,
          originalStd: 0.71,
          pooledMean: 3.8,
          withinVariance: 0.5,
          betweenVariance: 0.2,
          totalVariance: 0.767,
          rubinSe: 0.876,
          df: 12.1,
          fmi: 0.28,
          ciLower: 1.89,
          ciUpper: 5.71,
        },
      ],
    },
    createdAt: "2026-10-28T00:00:00.000Z",
    updatedAt: "2026-10-28T00:00:00.000Z",
  });

  beforeEach(() => {
    useDataStore.setState({
      datasets: [createMockBundleDataset()],
      selectedDatasetId: "bundle_ds_1",
    });
  });

  it("1. adds a dataset with imputationMeta (Sparse Delta) to useDataStore", () => {
    const ds = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1");
    expect(ds).toBeDefined();
    expect(ds?.readOnly).toBe(true);
    expect(ds?.imputationMeta).toBeDefined();
    expect(ds?.imputationMeta?.m).toBe(3);
    expect(ds?.imputationMeta?.activeImputationIndex).toBe(0);
    expect(ds?.imputationMeta?.sparsePatches.income).toHaveLength(2);
    expect(ds?.imputationMeta?.rubinStatistics).toHaveLength(2);
  });

  it("2. setActiveImputationIndex(id, 1) reconstructs data and preview with patch values for m=1", () => {
    const { setActiveImputationIndex } = useDataStore.getState();
    setActiveImputationIndex("bundle_ds_1", 1);

    const ds = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1");
    expect(ds).toBeDefined();
    expect(ds?.imputationMeta?.activeImputationIndex).toBe(1);

    // Row 0 of data (data[1]): id 1, income was "", now "4500", satisfaction "4" (unmodified)
    expect(ds?.data?.[1]).toEqual(["1", "4500", "4"]);
    // Row 1 of data (data[2]): id 2, income "5000" (unmodified), satisfaction was "", now "3"
    expect(ds?.data?.[2]).toEqual(["2", "5000", "3"]);
    // Row 2 of data (data[3]): id 3, income "6000", satisfaction "5" (unmodified)
    expect(ds?.data?.[3]).toEqual(["3", "6000", "5"]);
    // Row 3 of data (data[4]): id 4, income was "", now "7000", satisfaction was "", now "2"
    expect(ds?.data?.[4]).toEqual(["4", "7000", "2"]);

    // Preview should mirror the patched rows
    expect(ds?.preview).toEqual(ds?.data);
  });

  it("switches between multiple imputations (m=1 -> m=2) correctly", () => {
    const { setActiveImputationIndex } = useDataStore.getState();
    setActiveImputationIndex("bundle_ds_1", 2);

    const ds = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1");
    expect(ds?.imputationMeta?.activeImputationIndex).toBe(2);

    // values[1] for m=2: income row 0 has "4600", row 3 has "7100"
    expect(ds?.data?.[1]).toEqual(["1", "4600", "4"]);
    expect(ds?.data?.[2]).toEqual(["2", "5000", "4"]);
    expect(ds?.data?.[4]).toEqual(["4", "7100", "3"]);
  });

  it("3. setActiveImputationIndex(id, 0) restores original rows with missing cells", () => {
    const { setActiveImputationIndex } = useDataStore.getState();

    // Patch to m=1 first
    setActiveImputationIndex("bundle_ds_1", 1);
    let ds = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1");
    expect(ds?.data?.[1][1]).toBe("4500");

    // Revert back to original (0)
    setActiveImputationIndex("bundle_ds_1", 0);
    ds = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1");
    expect(ds?.imputationMeta?.activeImputationIndex).toBe(0);

    expect(ds?.data).toEqual(ds?.imputationMeta?.originalRows);
    expect(ds?.preview).toEqual(ds?.imputationMeta?.originalRows);
    expect(ds?.data?.[1][1]).toBe("");
    expect(ds?.data?.[2][2]).toBe("");
  });

  it("ignores invalid imputation indices (index < 0 or index > m)", () => {
    const { setActiveImputationIndex } = useDataStore.getState();
    setActiveImputationIndex("bundle_ds_1", 99);

    const ds = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1");
    expect(ds?.imputationMeta?.activeImputationIndex).toBe(0);
    expect(ds?.data?.[1][1]).toBe("");

    setActiveImputationIndex("bundle_ds_1", -1);
    expect(ds?.imputationMeta?.activeImputationIndex).toBe(0);
  });

  it("4. blocks mutation actions when dataset.readOnly === true", () => {
    const store = useDataStore.getState();

    // Attempt updateCell
    store.updateCell(0, 1, "99999", "bundle_ds_1");
    let ds = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1")!;
    expect(ds.data?.[1][1]).toBe(""); // unchanged

    // Attempt batchUpdateCells
    store.batchUpdateCells([{ rowIndex: 0, colIndex: 1, value: "88888" }], "bundle_ds_1");
    ds = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1")!;
    expect(ds.data?.[1][1]).toBe(""); // unchanged

    // Attempt addRow
    store.addRow(["5", "9000", "5"], undefined, "bundle_ds_1");
    ds = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1")!;
    expect(ds.rows).toBe(4);
    expect(ds.data?.length).toBe(5); // 1 header + 4 rows

    // Attempt removeRow
    store.removeRow(0, "bundle_ds_1");
    ds = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1")!;
    expect(ds.rows).toBe(4);
    expect(ds.data?.[1][0]).toBe("1"); // row 0 not deleted

    // Attempt removeVariable
    store.removeVariable("income", "bundle_ds_1");
    ds = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1")!;
    expect(ds.columnNames).toContain("income");
    expect(ds.columns).toBe(3);

    // Attempt renameVariable
    store.renameVariable("income", "income_mutated", "bundle_ds_1");
    ds = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1")!;
    expect(ds.columnNames).toContain("income");
    expect(ds.columnNames).not.toContain("income_mutated");
  });

  it("5. cloneBundleAsStandardDataset(id, 1) creates an independent standard dataset with readOnly=false and no imputationMeta", () => {
    const { cloneBundleAsStandardDataset } = useDataStore.getState();

    const cloned = cloneBundleAsStandardDataset("bundle_ds_1", 1);
    expect(cloned).toBeDefined();
    expect(cloned?.id).not.toBe("bundle_ds_1");
    expect(cloned?.name).toBe("Survey Data (Imp 1)");
    expect(cloned?.readOnly).toBe(false);
    expect(cloned?.imputationMeta).toBeUndefined();

    // Verify cloned dataset is added to store
    const inStore = useDataStore.getState().datasets.find((d) => d.id === cloned?.id);
    expect(inStore).toBeDefined();
    expect(inStore?.name).toBe("Survey Data (Imp 1)");
    expect(inStore?.readOnly).toBe(false);

    // Check data of cloned dataset has patched values
    expect(inStore?.data?.[1]).toEqual(["1", "4500", "4"]);
    expect(inStore?.data?.[2]).toEqual(["2", "5000", "3"]);
    expect(inStore?.data?.[4]).toEqual(["4", "7000", "2"]);

    // Verify mutations work on the cloned dataset
    useDataStore.getState().updateCell(0, 1, "9999", cloned!.id);
    const updatedCloned = useDataStore.getState().datasets.find((d) => d.id === cloned?.id);
    expect(updatedCloned?.data?.[1][1]).toBe("9999");

    // Verify original bundle dataset remains unchanged
    const originalBundle = useDataStore.getState().datasets.find((d) => d.id === "bundle_ds_1");
    expect(originalBundle?.data?.[1][1]).toBe("");
    expect(originalBundle?.readOnly).toBe(true);
  });

  it("cloneBundleAsStandardDataset(id, 0) clones the original unpatched dataset", () => {
    const { cloneBundleAsStandardDataset } = useDataStore.getState();

    const cloned = cloneBundleAsStandardDataset("bundle_ds_1", 0);
    expect(cloned).toBeDefined();
    expect(cloned?.name).toBe("Survey Data (Imp 0)");
    expect(cloned?.readOnly).toBe(false);
    expect(cloned?.imputationMeta).toBeUndefined();
    expect(cloned?.data?.[1][1]).toBe("");
  });
});
