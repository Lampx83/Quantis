import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "../useDataStore";
import { useUIStore } from "../useUIStore";
import { useAnalysisStore, type RegressionRun } from "../useAnalysisStore";
import { Dataset, VariableMetadata } from "../../types";

const mockDataset: Dataset = {
  id: "ds_test",
  name: "Test Dataset",
  rows: 3,
  columns: 3,
  columnNames: ["ID", "GENDER", "SCORE"],
  preview: [
    ["ID", "GENDER", "SCORE"],
    ["1", "1", "85"],
    ["2", "2", "90"],
    ["3", "1", "78"],
  ],
  data: [
    ["ID", "GENDER", "SCORE"],
    ["1", "1", "85"],
    ["2", "2", "90"],
    ["3", "1", "78"],
  ],
  variables: {
    ID: {
      name: "ID",
      type: "numeric",
      label: "Participant ID",
      measure: "nominal",
      decimals: 0,
      align: "right",
    },
    GENDER: {
      name: "GENDER",
      type: "numeric",
      label: "Gender",
      measure: "nominal",
      valueLabels: { "1": "Nam", "2": "Nữ" },
      decimals: 0,
      align: "center",
    },
    SCORE: {
      name: "SCORE",
      type: "numeric",
      label: "Exam Score",
      measure: "scale",
      decimals: 2,
      align: "right",
    },
  },
  sourceFormat: "csv",
  createdAt: "2026-10-12T00:00:00Z",
  updatedAt: "2026-10-12T00:00:00Z",
};

describe("DataStore & UIStore Expansion", () => {
  beforeEach(() => {
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(mockDataset))],
      historyByDataset: new Map(),
      selectedDatasetId: "ds_test",
    });
    useUIStore.setState({
      dataEditorView: "data",
      showValueLabels: false,
    });
  });

  describe("useDataStore Actions", () => {
    it("reverses a whole paste and ignores invalid or unchanged batches", () => {
      const store = useDataStore.getState();
      store.batchUpdateCells([
        { rowIndex: 0, colIndex: 2, value: "96" },
        { rowIndex: 1, colIndex: 2, value: "98" },
      ]);
      expect(useDataStore.getState().datasets[0].preview.map((row) => row[2])).toEqual(["SCORE", "96", "98", "78"]);
      expect(store.undoDataset()).toBe(true);
      expect(useDataStore.getState().datasets[0].preview).toEqual(mockDataset.preview);
      expect(store.undoDataset()).toBe(false);

      store.batchUpdateCells([
        { rowIndex: 0, colIndex: 2, value: "temporary" },
        { rowIndex: 0, colIndex: 2, value: "85" },
      ]);
      store.batchUpdateCells([
        { rowIndex: 0, colIndex: 2, value: "ignored" },
        { rowIndex: 3, colIndex: 2, value: "invalid" },
      ]);
      expect(useDataStore.getState().datasets[0].preview).toEqual(mockDataset.preview);
      expect(store.redoDataset()).toBe(true);
    });

    it.each([true, false])("restores row order, preview and counts with a header present: %s", (header) => {
      const store = useDataStore.getState();
      const rows = header ? mockDataset.preview : mockDataset.preview.slice(1);
      store.setDatasets([{ ...mockDataset, data: rows, preview: rows.slice(0, header ? 3 : 2) }]);
      const before = useDataStore.getState().datasets[0];
      store.addRow(["7", "1", "99"], 1);
      const inserted = useDataStore.getState().datasets[0];
      expect(inserted.rows).toBe(4);
      expect(inserted.data?.[header ? 2 : 1]).toEqual(["7", "1", "99"]);
      store.removeRow(0);
      expect(useDataStore.getState().datasets[0].rows).toBe(3);
      expect(store.undoDataset()).toBe(true);
      expect(useDataStore.getState().datasets[0].preview).toEqual(inserted.preview);
      expect(store.undoDataset()).toBe(true);
      expect(useDataStore.getState().datasets[0]).toMatchObject({ rows: before.rows, preview: before.preview, data: before.data });
      store.removeRow(-1);
      expect(store.redoDataset()).toBe(true);
      expect(store.redoDataset()).toBe(true);
      expect(useDataStore.getState().datasets[0].data?.[header ? 1 : 0]).toEqual(["7", "1", "99"]);
    });

    it("keeps other histories when importing, replacing, or deleting datasets", () => {
      const store = useDataStore.getState();
      store.updateCell(0, 2, "92");
      const first = useDataStore.getState().datasets[0];
      const revision = store.getDatasetRevision(first.id);
      store.addDataset({ ...mockDataset, id: "second" });
      store.setSelectedDatasetId("second");
      expect(store.getDatasetRevision(first.id)).toBe(revision);
      store.updateCell(0, 2, "93");
      store.setDatasets((datasets) => datasets.map((d) => d.id === first.id ? { ...first } : d));
      expect(store.getDatasetRevision(first.id)).not.toBe(revision);
      expect(store.undoDataset(first.id)).toBe(false);
      expect(store.undoDataset()).toBe(true);
      store.removeDataset(first.id);
      store.addDataset(first);
      expect(store.getDatasetRevision(first.id)).not.toBe(revision);
    });

    it("invalidates histories and revision tokens on hydration even if datasets are reused", async () => {
      const store = useDataStore.getState();
      store.updateCell(0, 2, "92");
      const { datasets } = useDataStore.getState();
      const revision = store.getDatasetRevision(mockDataset.id);
      store.hydrateFromServer(datasets);
      expect(store.getDatasetRevision(mockDataset.id)).not.toBe(revision);
      expect(store.undoDataset()).toBe(false);
      store.updateCell(0, 2, "96");
      await useDataStore.persist.rehydrate();
      expect(store.undoDataset()).toBe(false);
      store.setDatasets([]);
      expect(store.getDatasetRevision(mockDataset.id)).toBeUndefined();
    });

    it("retains at most 50 undo steps per dataset", () => {
      const store = useDataStore.getState();
      for (let i = 0; i < 52; i++) store.updateCell(0, 2, String(i));
      for (let i = 0; i < 50; i++) expect(store.undoDataset()).toBe(true);
      expect(store.undoDataset()).toBe(false);
      expect(useDataStore.getState().datasets[0].data?.[1][2]).toBe("1");
    });

    it("commits an oversized edit while dropping only that dataset's disconnected history", () => {
      const store = useDataStore.getState();
      store.addDataset({ ...mockDataset, id: "second" });
      store.updateCell(0, 2, "95");
      store.updateCell(0, 2, "96", "second");
      const oversized = "x".repeat(9 * 1024 * 1024);
      store.updateCell(0, 2, oversized);
      expect(useDataStore.getState().datasets[0].data?.[1][2]).toBe(oversized);
      expect(useDataStore.getState().historyLimitDatasetId).toBe("ds_test");
      expect(store.undoDataset()).toBe(false);
      expect(store.undoDataset("second")).toBe(true);
    });

    it("drops dependent redos when the workspace budget evicts their prerequisite", () => {
      const store = useDataStore.getState();
      const rows = Array.from({ length: 50_000 }, () => ["1", "1", "85"]);
      store.setDatasets([{ ...mockDataset, rows: rows.length, data: rows, preview: rows.slice(0, 5) }]);
      store.addDataset({ ...mockDataset, id: "second", rows: rows.length, data: rows });
      store.updateCell(0, 2, "first");
      store.updateCell(0, 2, "second");
      store.undoDataset();
      store.undoDataset();
      for (let i = 0; i < 20; i++) store.updateCell(0, 2, String(i), "second");
      expect(store.redoDataset()).toBe(false);
      expect(store.undoDataset("second")).toBe(true);
    });

    it("undoes and redoes only the selected dataset and preserves redo on invalid or unchanged edits", () => {
      const store = useDataStore.getState();
      store.addDataset({ ...mockDataset, id: "second" });
      store.updateCell(0, 2, "95");
      store.updateCell(0, 2, "99", "second");

      expect(store.undoDataset()).toBe(true);
      expect(useDataStore.getState().datasets.map((d) => d.preview[1][2])).toEqual(["85", "99"]);
      expect(useDataStore.getState().datasets[0].data).toEqual(mockDataset.data);

      store.updateCell(0, 2, "85");
      store.updateCell(-1, 2, "ignored");
      store.updateCell(0, 3, "ignored");
      expect(store.redoDataset()).toBe(true);
      expect(useDataStore.getState().datasets[0].data?.[1][2]).toBe("95");

      store.undoDataset();
      store.updateCell(0, 2, "96");
      expect(store.redoDataset()).toBe(false);
      store.setSelectedDatasetId("second");
      expect(store.undoDataset()).toBe(true);
      expect(useDataStore.getState().datasets.map((d) => d.preview[1][2])).toEqual(["96", "85"]);
    });

    it("addDataset should add a new dataset and prevent duplicate entries with identical IDs", () => {
      const { addDataset } = useDataStore.getState();
      const newDataset: Dataset = {
        id: "ds_new_unique",
        name: "New Unique Dataset",
        rows: 1,
        columns: 1,
        columnNames: ["X"],
        preview: [["X"], ["1"]],
        data: [["X"], ["1"]],
        sourceFormat: "csv",
        createdAt: "2026-10-16T00:00:00Z",
        updatedAt: "2026-10-16T00:00:00Z",
      };

      addDataset(newDataset);
      expect(useDataStore.getState().datasets.filter((d) => d.id === "ds_new_unique").length).toBe(1);

      // Adding the same dataset again should update/upsert, not duplicate
      addDataset({ ...newDataset, name: "New Unique Dataset Updated" });
      const matches = useDataStore.getState().datasets.filter((d) => d.id === "ds_new_unique");
      expect(matches.length).toBe(1);
      expect(matches[0].name).toBe("New Unique Dataset Updated");
    });

    it("updateCell should immutably update a cell in data and preview", () => {
      const { updateCell } = useDataStore.getState();
      updateCell(0, 2, "95"); // row 0 (data row 0), col 2 (SCORE) -> update to 95

      const ds = useDataStore.getState().datasets.find((d) => d.id === "ds_test");
      expect(ds?.data?.[1][2]).toBe("95");
      expect(ds?.preview?.[1][2]).toBe("95");
      // Other rows should remain unchanged
      expect(ds?.data?.[2][2]).toBe("90");
    });

    it("batchUpdateCells should update multiple cells immutably", () => {
      const { batchUpdateCells } = useDataStore.getState();
      batchUpdateCells([
        { rowIndex: 0, colIndex: 2, value: "88" },
        { rowIndex: 1, colIndex: 1, value: "1" },
      ]);

      const ds = useDataStore.getState().datasets.find((d) => d.id === "ds_test");
      expect(ds?.data?.[1][2]).toBe("88");
      expect(ds?.data?.[2][1]).toBe("1");
    });

    it("updateVariableMetadata should patch metadata of a variable", () => {
      const { updateVariableMetadata } = useDataStore.getState();
      updateVariableMetadata("GENDER", {
        label: "Giới tính đối tượng",
        decimals: 1,
      });

      const ds = useDataStore.getState().datasets.find((d) => d.id === "ds_test");
      expect(ds?.variables?.["GENDER"].label).toBe("Giới tính đối tượng");
      expect(ds?.variables?.["GENDER"].decimals).toBe(1);
      // measure and other properties should remain
      expect(ds?.variables?.["GENDER"].measure).toBe("nominal");
    });

    it("updateVariableMetadata should preserve inferred numeric type when variables dict is initially undefined", () => {
      const legacyDataset: Dataset = {
        id: "ds_uninit",
        name: "Uninitialized Dataset",
        rows: 2,
        columns: 1,
        columnNames: ["SCORE"],
        preview: [["SCORE"], ["10"], ["20"]],
        data: [["SCORE"], ["10"], ["20"]],
        sourceFormat: "csv",
        createdAt: "2026-10-13T00:00:00Z",
        updatedAt: "2026-10-13T00:00:00Z",
      };
      useDataStore.setState((s) => ({ datasets: [...s.datasets, legacyDataset] }));

      useDataStore.getState().updateVariableMetadata("SCORE", { decimals: 2 }, "ds_uninit");

      const ds = useDataStore.getState().datasets.find((d) => d.id === "ds_uninit");
      expect(ds?.variables?.["SCORE"].decimals).toBe(2);
      expect(ds?.variables?.["SCORE"].type).toBe("numeric");
    });

    it("renameVariable should rename in columnNames, header rows, and variables dict", () => {
      const { renameVariable } = useDataStore.getState();
      renameVariable("SCORE", "FINAL_SCORE");

      const ds = useDataStore.getState().datasets.find((d) => d.id === "ds_test");
      expect(ds?.columnNames).toContain("FINAL_SCORE");
      expect(ds?.columnNames).not.toContain("SCORE");
      expect(ds?.data?.[0][2]).toBe("FINAL_SCORE");
      expect(ds?.variables?.["FINAL_SCORE"]).toBeDefined();
      expect(ds?.variables?.["FINAL_SCORE"].name).toBe("FINAL_SCORE");
      expect(ds?.variables?.["SCORE"]).toBeUndefined();
    });

    it("addVariable should append column to metadata, columnNames, and all rows", () => {
      const { addVariable } = useDataStore.getState();
      const newVar: VariableMetadata = {
        name: "AGE",
        type: "numeric",
        label: "Tuổi",
        measure: "scale",
        decimals: 0,
        align: "right",
      };
      addVariable(newVar, ["20", "22", "21"]);

      const ds = useDataStore.getState().datasets.find((d) => d.id === "ds_test");
      expect(ds?.columns).toBe(4);
      expect(ds?.columnNames).toContain("AGE");
      expect(ds?.variables?.["AGE"]).toBeDefined();
      expect(ds?.data?.[0][3]).toBe("AGE");
      expect(ds?.data?.[1][3]).toBe("20");
      expect(ds?.data?.[2][3]).toBe("22");
      expect(ds?.data?.[3][3]).toBe("21");
    });

    it("removeVariable should remove column from columnNames, variables, and all rows", () => {
      const { removeVariable } = useDataStore.getState();
      removeVariable("GENDER");

      const ds = useDataStore.getState().datasets.find((d) => d.id === "ds_test");
      expect(ds?.columns).toBe(2);
      expect(ds?.columnNames).toEqual(["ID", "SCORE"]);
      expect(ds?.variables?.["GENDER"]).toBeUndefined();
      expect(ds?.data?.[0]).toEqual(["ID", "SCORE"]);
      expect(ds?.data?.[1]).toEqual(["1", "85"]);
    });

    it("addRow and removeRow should correctly mutate rows immutably", () => {
      const { addRow, removeRow } = useDataStore.getState();
      addRow(["4", "2", "92"]);

      let ds = useDataStore.getState().datasets.find((d) => d.id === "ds_test");
      expect(ds?.rows).toBe(4);
      expect(ds?.data?.[4]).toEqual(["4", "2", "92"]);

      removeRow(1); // remove row 1 (which was "2", "2", "90")
      ds = useDataStore.getState().datasets.find((d) => d.id === "ds_test");
      expect(ds?.rows).toBe(3);
      expect(ds?.data?.[1]).toEqual(["1", "1", "85"]);
      expect(ds?.data?.[2]).toEqual(["3", "1", "78"]);
      expect(ds?.data?.[3]).toEqual(["4", "2", "92"]);
    });
  });

  describe("useUIStore Actions", () => {
    it("should manage dataEditorView and showValueLabels", () => {
      const {
        setDataEditorView,
        toggleDataEditorView,
        setShowValueLabels,
        toggleShowValueLabels,
      } = useUIStore.getState();

      expect(useUIStore.getState().dataEditorView).toBe("data");
      expect(useUIStore.getState().showValueLabels).toBe(false);

      setDataEditorView("variable");
      expect(useUIStore.getState().dataEditorView).toBe("variable");

      toggleDataEditorView();
      expect(useUIStore.getState().dataEditorView).toBe("data");

      setShowValueLabels(true);
      expect(useUIStore.getState().showValueLabels).toBe(true);

      toggleShowValueLabels();
      expect(useUIStore.getState().showValueLabels).toBe(false);
    });
  });
});

describe("useUIStore row focus requests", () => {
  beforeEach(() => {
    useUIStore.setState({ rowFocus: null });
  });

  it("stores the request with an incremented nonce", () => {
    useUIStore.getState().requestRowFocus("ds_a", 12);
    expect(useUIStore.getState().rowFocus).toEqual({
      datasetId: "ds_a",
      rowIndex: 12,
      nonce: 1,
    });

    useUIStore.getState().requestRowFocus("ds_a", 99);
    expect(useUIStore.getState().rowFocus).toEqual({
      datasetId: "ds_a",
      rowIndex: 99,
      nonce: 2,
    });
  });

  it("gives a repeat request to the same row a new nonce", () => {
    useUIStore.getState().requestRowFocus("ds_a", 7);
    const first = useUIStore.getState().rowFocus!.nonce;
    useUIStore.getState().requestRowFocus("ds_a", 7);
    const second = useUIStore.getState().rowFocus!.nonce;

    expect(second).toBe(first + 1);
  });

  it("clears only the request whose nonce matches", () => {
    useUIStore.getState().requestRowFocus("ds_a", 5);
    const nonce = useUIStore.getState().rowFocus!.nonce;

    useUIStore.getState().clearRowFocus(nonce + 1);
    expect(useUIStore.getState().rowFocus).not.toBeNull();

    useUIStore.getState().clearRowFocus(nonce);
    expect(useUIStore.getState().rowFocus).toBeNull();
  });
});

describe("useAnalysisStore regression run slice", () => {
  const resultA = {
    n: 80,
    coefficients: { "(Intercept)": 1.5 },
    diagnostics: { ok: true },
  } as unknown as RegressionRun["result"];
  const resultB = {
    n: 60,
    coefficients: { "(Intercept)": 0.5 },
    diagnostics: { ok: false, errorCode: "insufficient_n" },
  } as unknown as RegressionRun["result"];

  const runA: RegressionRun = {
    datasetId: "ds_test",
    datasetUpdatedAt: "2026-11-04T00:00:00Z",
    datasetRowCount: 80,
    yCol: "Y",
    xCols: ["X1", "X2"],
    activeImputationIndex: 1,
    result: resultA,
  };

  beforeEach(() => {
    useAnalysisStore.getState().clearRegressionRun();
  });

  it("stores the whole run context", () => {
    useAnalysisStore.getState().setRegressionRun(runA);

    expect(useAnalysisStore.getState().regressionRun).toEqual(runA);
  });

  it("replaces the previous run when a second one is stored", () => {
    useAnalysisStore.getState().setRegressionRun(runA);
    const runB: RegressionRun = {
      ...runA,
      yCol: "Z",
      xCols: ["W"],
      datasetRowCount: 60,
      activeImputationIndex: null,
      result: resultB,
    };

    useAnalysisStore.getState().setRegressionRun(runB);

    const stored = useAnalysisStore.getState().regressionRun;
    expect(stored?.yCol).toBe("Z");
    expect(stored?.xCols).toEqual(["W"]);
    expect(stored?.datasetRowCount).toBe(60);
    expect(stored?.activeImputationIndex).toBeNull();
    expect(stored?.result).toBe(resultB);
  });

  it("clears the run on request", () => {
    useAnalysisStore.getState().setRegressionRun(runA);
    useAnalysisStore.getState().clearRegressionRun();

    expect(useAnalysisStore.getState().regressionRun).toBeNull();
  });

  it("leaves the regression run alone when the analysis cache is cleared", () => {
    useAnalysisStore.getState().setCorrelationBackendResult({
      matrix: [[1]],
      columnNames: ["X"],
    });
    useAnalysisStore.getState().setRegressionRun(runA);

    useAnalysisStore.getState().clearAnalysisCache();

    expect(useAnalysisStore.getState().correlationBackendResult).toBeNull();
    expect(useAnalysisStore.getState().regressionRun).toEqual(runA);
  });
});
