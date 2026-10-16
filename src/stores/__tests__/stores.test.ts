import { describe, it, expect, beforeEach } from "vitest";
import { useDataStore } from "../useDataStore";
import { useUIStore } from "../useUIStore";
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
      selectedDatasetId: "ds_test",
    });
    useUIStore.setState({
      dataEditorView: "data",
      showValueLabels: false,
    });
  });

  describe("useDataStore Actions", () => {
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
