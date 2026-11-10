import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { Dataset } from "@/types";
import { useDataStore } from "../useDataStore";
import { useSyncStore } from "../useSyncStore";

const source: Dataset = {
  id: "source", name: "Original dataset", rows: 2, columns: 1, columnNames: ["X"],
  data: [["X"], ["1"], ["2"]], preview: [["X"], ["1"], ["2"]],
  sourceFormat: "csv", createdAt: "", updatedAt: "",
};
const storedWorkspace = () => JSON.parse(localStorage.getItem("quantis_data:local")!).state;
const currentDataset = () => useDataStore.getState().datasets[0];
const byteLength = (value: unknown) => new TextEncoder().encode(JSON.stringify(value)).length;

beforeEach(() => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: vi.fn((key: string, value: string) => { storage.set(key, value); }),
    removeItem: (key: string) => storage.delete(key),
  });
  useSyncStore.getState().setAuthUser(null);
  useSyncStore.setState({ isOnline: false, useBackend: false });
  const store = useDataStore.getState();
  store.hydrateFromServer([]);
  store.addDataset(source);
  store.setSelectedDatasetId(source.id);
});

afterEach(() => vi.unstubAllGlobals());

describe("transformation audit", () => {
  it("keeps the audit in memory on quota failure and clears the error after a successful write", async () => {
    const store = useDataStore.getState();
    vi.mocked(localStorage.setItem).mockImplementationOnce(() => {
      throw new DOMException("Quota exceeded", "QuotaExceededError");
    });
    store.updateCell(0, 0, "quota edit");
    expect(useSyncStore.getState().localSaveFailures.datasets).toBe(true);
    expect(currentDataset().data?.[1][0]).toBe("quota edit");
    expect(currentDataset().audit!.entries).toHaveLength(1);
    expect(storedWorkspace().datasets[0].audit).toBeUndefined();

    store.updateCell(1, 0, "recovered edit");
    expect(useSyncStore.getState().localSaveFailures.datasets).toBe(false);
    await useDataStore.persist.rehydrate();
    expect(currentDataset().audit!.entries).toHaveLength(2);
  });

  it("bounds audit size at 50,000 rows and retains a representative five-member bundle", () => {
    const store = useDataStore.getState();
    const header = ["ID", "SCORE", "GROUP"];
    const rows = [header, ...Array.from({ length: 50_000 }, (_, i) => [String(i + 1), i % 100 ? String(i % 37) : "", String(i % 3)])];
    store.addDataset({ ...source, id: "large", rows: 50_000, columns: 3, columnNames: header, data: rows, preview: rows.slice(0, 6) });
    store.updateCell(1, 1, "88", "large");
    const large = useDataStore.getState().datasets[1];
    const edit = useDataStore.getState().historyByDataset.get(large.id)!.undo[0];
    expect(edit.bytes).toBeLessThan(1024 * 1024);

    const imputed = large.data!.map((row) => [...row]);
    const patches = Array.from({ length: 500 }, (_, i) => {
      imputed[i * 100 + 1][1] = "10";
      return { rowIndex: i * 100, values: ["10", "11", "12", "13", "14"] };
    });
    store.commitDatasetTransform(large.id, store.getDatasetRevision(large.id)!, {
      ...large, data: imputed, preview: imputed.slice(0, 6), readOnly: true,
      imputationMeta: {
        bundleId: "large-mice", m: 5, activeImputationIndex: 1, imputedColumns: ["SCORE"],
        originalRows: large.data!, sparsePatches: { SCORE: patches },
      },
    }, { action: "transform", operation: "fill_mice", columns: ["SCORE"], rowCount: 500 });
    store.updateCell(0, 0, "small edit", source.id);
    const saved = storedWorkspace();
    expect(saved.datasets).toHaveLength(2);
    for (const dataset of saved.datasets) expect(byteLength(dataset.audit)).toBeLessThan(1024);
    expect(useDataStore.getState().historyByDataset.get(large.id)?.undo).toHaveLength(2);
    expect(store.undoDataset(large.id)).toBe(true);
    expect(store.redoDataset(large.id)).toBe(true);
    expect(useDataStore.getState().datasets[1].imputationMeta?.m).toBe(5);
  });

  it("atomically records a paste and its reversals without storing pasted values", () => {
    const store = useDataStore.getState();
    const updates: Dataset[] = [];
    const unsubscribe = useDataStore.subscribe((s, prev) => {
      if (s.datasets !== prev.datasets) updates.push(s.datasets[0]);
    });
    store.batchUpdateCells([
      { rowIndex: 0, colIndex: 0, value: "private first value" },
      { rowIndex: 1, colIndex: 0, value: "private second value" },
    ]);
    unsubscribe();
    expect(updates).toHaveLength(1);
    expect(updates[0].data?.[1][0]).toBe("private first value");
    const paste = updates[0].audit!.entries[0];
    expect(paste).toMatchObject({ action: "paste", kind: "commit", columns: ["X"], firstRow: 1, lastRow: 2, cellCount: 2 });
    expect(JSON.stringify(paste)).not.toContain("private");
    store.undoDataset();
    store.redoDataset();
    store.undoDataset();
    store.updateCell(0, 0, "4");
    expect(store.redoDataset()).toBe(false);
    const entries = currentDataset().audit!.entries;
    expect(entries.map((e) => e.kind)).toEqual(["commit", "undo", "redo", "undo", "commit"]);
    expect(entries.slice(1, 4)).toEqual(Array(3).fill(expect.objectContaining({ originalChangeId: paste.id })));
    expect(new Set(entries.map((e) => e.id)).size).toBe(5);
  });

  it("round-trips only the selected dataset and audit through offline storage", async () => {
    const store = useDataStore.getState();
    store.updateCell(0, 0, "4");
    const saved = storedWorkspace();
    expect(saved).not.toHaveProperty("historyByDataset");
    expect(saved.datasets[0].audit.entries).toHaveLength(1);
    await useDataStore.persist.rehydrate();
    expect(currentDataset().audit).toEqual(saved.datasets[0].audit);
    expect(currentDataset().data?.[1][0]).toBe("4");
    expect(store.undoDataset()).toBe(false);
  });

  it("captures the original source identity and name after source rename and deletion", () => {
    const store = useDataStore.getState();
    store.updateCell(0, 0, "4");
    const child = store.deriveDataset(source.id, currentDataset(), { action: "transform", operation: "compute", formula: "X * 2" })!;
    expect(currentDataset().audit!.entries).toHaveLength(1);
    expect(child.audit!.entries).toMatchObject([{
      kind: "derive", action: "transform", operation: "compute", source: { datasetId: source.id, name: source.name },
    }]);
    store.updateDataset(source.id, { name: "Renamed" });
    store.removeDataset(source.id);
    expect(currentDataset().audit).toEqual(child.audit);
    expect(storedWorkspace().datasets.map((d: Dataset) => d.id)).toEqual([child.id]);
  });

  it("loads older datasets with an empty audit", async () => {
    localStorage.removeItem("quantis_data:local");
    localStorage.setItem("quantis_data", JSON.stringify({
      state: { datasets: [source], selectedDatasetId: source.id }, version: 0,
    }));
    await useDataStore.persist.rehydrate();
    expect(currentDataset().audit?.entries ?? []).toEqual([]);
    expect(currentDataset().id).toBe(source.id);
  });

  it("marks the count cutoff and saves full audit when an online workspace falls back offline", () => {
    const store = useDataStore.getState();
    useSyncStore.setState({ useBackend: true, isOnline: true });
    for (let i = 0; i < 205; i++) store.updateVariableMetadata("X", { label: String(i) });
    const audit = currentDataset().audit!;
    expect(audit.entries).toHaveLength(200);
    expect(audit.cutoffAt).toBeTruthy();
    expect(byteLength(audit)).toBeLessThanOrEqual(32 * 1024);
    expect(storedWorkspace().datasets).toEqual([]);
    useSyncStore.getState().setIsOnline(false);
    expect(storedWorkspace().datasets[0].audit).toEqual(audit);
  });

  it("bounds UTF-8 bytes and keeps a reversal readable after the original entry expires", () => {
    const store = useDataStore.getState();
    const formula = "điểm".repeat(1000);
    store.updateCell(0, 0, "first");
    const original = currentDataset().audit!.entries[0];
    for (let i = 0; i < 48; i++) {
      const dataset = currentDataset();
      store.commitDatasetTransform(dataset.id, store.getDatasetRevision(dataset.id)!, {
        ...dataset, data: [["X"], [String(i)], ["2"]],
      }, { action: "transform", operation: "compute", formula, columns: ["biến".repeat(100)] });
    }
    expect(currentDataset().audit!.entries.some((entry) => entry.id === original.id)).toBe(false);
    for (let i = 0; i < 49; i++) expect(store.undoDataset()).toBe(true);
    const audit = currentDataset().audit!;
    expect(audit.cutoffAt).toBeTruthy();
    expect(byteLength(audit)).toBeLessThanOrEqual(32 * 1024);
    expect(audit.entries[audit.entries.length - 1]).toMatchObject({
      kind: "undo", originalChangeId: original.id, action: "cell", columns: ["X"], firstRow: 1,
    });
  });
});
