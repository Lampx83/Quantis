import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Dataset, VariableMetadata } from "@/types";
import { ensureDatasetMetadata } from "@/utils/metadata";
import { generateId } from "@/utils/helpers";
import { reconstructImputedRows } from "@/utils/sparseDelta";
import { useSyncStore, persistsWorkspaceLocally, workspaceOwner } from "./useSyncStore";
import {
  applyDatasetChange,
  createHistoryStep,
  editMatrixCells,
  editMatrixRow,
  newDatasetChange,
  HISTORY_BYTE_LIMIT,
  retainHistoryStep,
  validCell,
  type CellEdit,
  type DatasetChangeSummary,
  type DatasetContentPatch,
  type DatasetHistory,
} from "./datasetHistory";

export interface DataState {
  // --- State ---
  datasets: Dataset[];
  selectedDatasetId: string | null;
  historyByDataset: ReadonlyMap<string, DatasetHistory>;
  historyLimitDatasetId: string | null;
  undoDataset: (datasetId?: string) => boolean;
  redoDataset: (datasetId?: string) => boolean;

  // --- Actions ---
  setDatasets: (datasets: Dataset[] | ((prev: Dataset[]) => Dataset[])) => void;
  addDataset: (dataset: Dataset) => void;
  removeDataset: (id: string) => void;
  updateDataset: (id: string, patch: Partial<Dataset>) => void;
  setSelectedDatasetId: (id: string | null | ((prev: string | null) => string | null)) => void;
  hydrateFromServer: (datasets: Dataset[]) => void;
  getDatasetRevision: (id: string) => symbol | undefined;

  // --- Cell & Row & Column Editing Actions ---
  updateCell: (rowIndex: number, colIndex: number, value: string, datasetId?: string) => void;
  batchUpdateCells: (updates: CellEdit[], datasetId?: string) => void;
  updateVariableMetadata: (varName: string, patch: Partial<VariableMetadata>, datasetId?: string) => void;
  renameVariable: (oldName: string, newName: string, datasetId?: string) => void;
  addVariable: (metadata: VariableMetadata, defaultValues?: string[], datasetId?: string) => void;
  removeVariable: (varName: string, datasetId?: string) => void;
  addRow: (values?: string[], atIndex?: number, datasetId?: string) => void;
  removeRow: (rowIndex: number, datasetId?: string) => void;

  // --- Imputed Bundle Actions ---
  setActiveImputationIndex: (datasetId: string, index: number) => void;
  cloneBundleAsStandardDataset: (datasetId: string, index: number) => Dataset | undefined;
}

// A new immutable dataset object is a new revision. Explicit replacement can reuse objects.
const datasetRevisions = new WeakMap<Dataset, symbol>();
let switchingOwner = false;

function revisionOf(dataset: Dataset): symbol {
  let revision = datasetRevisions.get(dataset);
  if (!revision) {
    revision = Symbol();
    datasetRevisions.set(dataset, revision);
  }
  return revision;
}

function replaceDatasets(state: DataState, datasets: Dataset[], invalidateAll = false) {
  const retained = new Set(datasets);
  const historyByDataset = new Map(state.historyByDataset);
  let historyLimitDatasetId = state.historyLimitDatasetId;
  for (const dataset of state.datasets) {
    if (!invalidateAll && retained.has(dataset)) continue;
    datasetRevisions.delete(dataset);
    historyByDataset.delete(dataset.id);
    if (historyLimitDatasetId === dataset.id) historyLimitDatasetId = null;
  }
  return { datasets, historyByDataset, historyLimitDatasetId };
}

function commitDatasetChange(
  state: DataState,
  dataset: Dataset,
  patch: DatasetContentPatch,
  summary: DatasetChangeSummary,
  affectedRows?: readonly number[],
): Partial<DataState> {
  const change = newDatasetChange(dataset.id, "commit", summary);
  const step = createHistoryStep(dataset, patch, change, affectedRows);
  return {
    datasets: state.datasets.map((d) => d === dataset ? applyDatasetChange(d, patch, change) : d),
    historyByDataset: retainHistoryStep(state.historyByDataset, step),
    historyLimitDatasetId: step.bytes > HISTORY_BYTE_LIMIT ? dataset.id :
      state.historyLimitDatasetId === dataset.id ? null : state.historyLimitDatasetId,
  };
}

function reverseDatasetChange(state: DataState, direction: "undo" | "redo", datasetId?: string): DataState | Partial<DataState> {
  const id = datasetId ?? state.selectedDatasetId;
  const dataset = state.datasets.find((d) => d.id === id);
  const history = dataset && state.historyByDataset.get(dataset.id);
  const stack = history?.[direction];
  const step = stack?.[stack.length - 1];
  if (!dataset || !history || !step) return state;

  const historyByDataset = new Map(state.historyByDataset);
  historyByDataset.set(dataset.id, direction === "undo"
    ? { undo: history.undo.slice(0, -1), redo: [...history.redo, step] }
    : { undo: [...history.undo, step], redo: history.redo.slice(0, -1) });
  const change = newDatasetChange(dataset.id, direction, step.change, step.change.id);
  const patch = direction === "undo" ? step.before : step.after;
  return {
    datasets: state.datasets.map((d) => d === dataset ? applyDatasetChange(d, patch, change) : d),
    historyByDataset,
  };
}

export const useDataStore = create<DataState>()(
  persist(
    (set, get) => {
      function reverse(direction: "undo" | "redo", datasetId?: string): boolean {
        const state = get();
        const next = reverseDatasetChange(state, direction, datasetId);
        if (next === state) return false;
        set(next);
        return true;
      }
      function editCells(action: "cell" | "paste", updates: readonly CellEdit[], id?: string) {
        const state = get();
        const dataset = state.datasets.find((d) => d.id === (id ?? state.selectedDatasetId));
        if (!dataset || dataset.readOnly || !updates.length) return;
        const cells = new Map<string, CellEdit>();
        for (const edit of updates) {
          if (!validCell(dataset, edit.rowIndex, edit.colIndex)) return;
          cells.set(`${edit.rowIndex}:${edit.colIndex}`, edit);
        }
        const changed = new Set<CellEdit>();
        const data = editMatrixCells(dataset.data, dataset, cells.values(), changed);
        const preview = editMatrixCells(dataset.preview, dataset, cells.values(), changed);
        if (!changed.size) return;

        const rows = new Set<number>();
        const columns = new Set<string>();
        let firstRow = dataset.rows;
        let lastRow = 0;
        for (const edit of changed) {
          rows.add(edit.rowIndex);
          columns.add(dataset.columnNames[edit.colIndex]);
          firstRow = Math.min(firstRow, edit.rowIndex + 1);
          lastRow = Math.max(lastRow, edit.rowIndex + 1);
        }
        const patch: DatasetContentPatch = { data, preview };
        if (!dataset.variables) patch.variables = ensureDatasetMetadata(dataset).variables;
        set(commitDatasetChange(state, dataset, patch, {
          action, columns: [...columns], firstRow, lastRow, rowCount: rows.size, cellCount: changed.size,
        }, [...rows]));
      }

      function editRow(action: "insertRow" | "deleteRow", id?: string, atIndex?: number, values?: string[]) {
        const state = get();
        const dataset = state.datasets.find((d) => d.id === (id ?? state.selectedDatasetId));
        if (!dataset || dataset.readOnly) return;
        const inserting = action === "insertRow";
        const row = atIndex ?? dataset.rows;
        if (!Number.isInteger(row) || row < 0 || row > dataset.rows || (!inserting && row === dataset.rows)) return;
        const columns = dataset.columns || dataset.columnNames.length;
        if (values && values.length > columns) return;
        const inserted = inserting ? Array.from({ length: columns }, (_, i) => values?.[i] ?? "") : undefined;
        set(commitDatasetChange(state, dataset, {
          rows: dataset.rows + (inserting ? 1 : -1),
          data: editMatrixRow(dataset.data, dataset, row, inserted),
          preview: editMatrixRow(dataset.preview, dataset, row, inserted) ?? dataset.preview,
        }, { action, firstRow: row + 1, lastRow: row + 1, rowCount: 1 }, [row]));
      }

      return {
      datasets: [],
      selectedDatasetId: null,
      historyByDataset: new Map(),
      historyLimitDatasetId: null,
      undoDataset: (id) => reverse("undo", id),
      redoDataset: (id) => reverse("redo", id),
      getDatasetRevision: (id) => {
        const dataset = get().datasets.find((d) => d.id === id);
        return dataset && revisionOf(dataset);
      },

      setDatasets: (datasets) =>
        set((s) => replaceDatasets(s, typeof datasets === "function" ? datasets(s.datasets) : datasets)),
      addDataset: (dataset) =>
        set((s) => {
          const ensured = dataset.variables ? dataset : ensureDatasetMetadata(dataset);
          return replaceDatasets(s,
            s.datasets.some((d) => d.id === ensured.id)
              ? s.datasets.map((d) => (d.id === ensured.id ? ensured : d))
              : [...s.datasets, ensured],
          );
        }),
      removeDataset: (id) =>
        set((s) => ({
          ...replaceDatasets(s, s.datasets.filter((d) => d.id !== id)),
          selectedDatasetId: s.selectedDatasetId === id ? null : s.selectedDatasetId,
        })),
      updateDataset: (id, patch) =>
        set((s) => replaceDatasets(s, s.datasets.map((d) => (d.id === id ? { ...d, ...patch } : d)))),
      setSelectedDatasetId: (id) =>
        set((s) => ({
          selectedDatasetId: typeof id === "function" ? id(s.selectedDatasetId) : id,
        })),
      hydrateFromServer: (datasets) => set((s) => replaceDatasets(s, datasets, true)),

      updateCell: (rowIndex, colIndex, value, id) =>
        editCells("cell", [{ rowIndex, colIndex, value }], id),
      batchUpdateCells: (updates, id) => editCells("paste", updates, id),

      updateVariableMetadata: (varName, patch, datasetId) =>
        set((s) => {
          const targetId = datasetId ?? s.selectedDatasetId;
          if (!targetId) return s;
          const target = s.datasets.find((d) => d.id === targetId);
          if (!target || target.readOnly) return s;
          return {
            datasets: s.datasets.map((d) => {
              if (d.id !== targetId) return d;
              const ensured = ensureDatasetMetadata(d);
              const currentVars = ensured.variables ? { ...ensured.variables } : {};
              if (!currentVars[varName]) {
                currentVars[varName] = {
                  name: varName,
                  type: "string",
                  label: varName,
                  measure: "nominal",
                  decimals: 0,
                  align: "left",
                  missingValues: [],
                  ...patch,
                };
              } else {
                currentVars[varName] = {
                  ...currentVars[varName],
                  ...patch,
                };
              }
              if (
                currentVars[varName].type === "string" &&
                currentVars[varName].measure === "scale"
              ) {
                currentVars[varName].measure = "nominal";
              }
              return {
                ...d,
                variables: currentVars,
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      renameVariable: (oldName, newName, datasetId) =>
        set((s) => {
          const targetId = datasetId ?? s.selectedDatasetId;
          const trimmedNew = newName.trim();
          if (!targetId || oldName === trimmedNew || !trimmedNew) return s;
          const target = s.datasets.find((d) => d.id === targetId);
          if (!target || target.readOnly) return s;
          return {
            datasets: s.datasets.map((d) => {
              if (d.id !== targetId) return d;
              const colIdx = d.columnNames.indexOf(oldName);
              if (colIdx === -1) return d;

              const newColumnNames = [...d.columnNames];
              newColumnNames[colIdx] = trimmedNew;

              const ensured = ensureDatasetMetadata(d);
              const newVars = { ...(ensured.variables ?? {}) };
              if (newVars[oldName]) {
                const oldMeta = newVars[oldName];
                delete newVars[oldName];
                newVars[trimmedNew] = {
                  ...oldMeta,
                  name: trimmedNew,
                };
              }

              let newData = d.data;
              if (d.data && d.data.length > 0) {
                const hasHeader =
                  d.data.length === d.rows + 1 ||
                  (d.columnNames && d.data[0][colIdx] === oldName);
                if (hasHeader) {
                  const updatedHeaderRow = [...d.data[0]];
                  updatedHeaderRow[colIdx] = trimmedNew;
                  newData = [updatedHeaderRow, ...d.data.slice(1)];
                }
              }

              let newPreview = d.preview;
              if (d.preview && d.preview.length > 0) {
                const hasHeader =
                  d.preview.length === d.rows + 1 ||
                  (d.columnNames && d.preview[0][colIdx] === oldName);
                if (hasHeader) {
                  const updatedHeaderRow = [...d.preview[0]];
                  updatedHeaderRow[colIdx] = trimmedNew;
                  newPreview = [updatedHeaderRow, ...d.preview.slice(1)];
                }
              }

              return {
                ...d,
                columnNames: newColumnNames,
                variables: newVars,
                data: newData,
                preview: newPreview,
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      addVariable: (metadata, defaultValues = [], datasetId) =>
        set((s) => {
          const targetId = datasetId ?? s.selectedDatasetId;
          if (!targetId || !metadata.name) return s;
          const target = s.datasets.find((d) => d.id === targetId);
          if (!target || target.readOnly) return s;
          return {
            datasets: s.datasets.map((d) => {
              if (d.id !== targetId) return d;
              if (d.columnNames.includes(metadata.name)) return d;

              const newColumnNames = [...d.columnNames, metadata.name];
              const newVars = {
                ...d.variables,
                [metadata.name]: metadata,
              };

              let newData = d.data;
              if (d.data && d.data.length > 0) {
                const hasHeader =
                  d.data.length === d.rows + 1 ||
                  (d.columnNames && d.data[0][0] === d.columnNames[0]);
                newData = d.data.map((row, rIdx) => {
                  if (hasHeader && rIdx === 0) {
                    return [...row, metadata.name];
                  }
                  const dataRowIdx = hasHeader ? rIdx - 1 : rIdx;
                  const val = defaultValues[dataRowIdx] ?? "";
                  return [...row, val];
                });
              }

              let newPreview = d.preview;
              if (d.preview && d.preview.length > 0) {
                const hasHeader =
                  d.preview.length === d.rows + 1 ||
                  (d.columnNames && d.preview[0][0] === d.columnNames[0]);
                newPreview = d.preview.map((row, rIdx) => {
                  if (hasHeader && rIdx === 0) {
                    return [...row, metadata.name];
                  }
                  const dataRowIdx = hasHeader ? rIdx - 1 : rIdx;
                  const val = defaultValues[dataRowIdx] ?? "";
                  return [...row, val];
                });
              }

              return {
                ...d,
                columns: newColumnNames.length,
                columnNames: newColumnNames,
                variables: newVars,
                data: newData,
                preview: newPreview,
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      removeVariable: (varName, datasetId) =>
        set((s) => {
          const targetId = datasetId ?? s.selectedDatasetId;
          if (!targetId) return s;
          const target = s.datasets.find((d) => d.id === targetId);
          if (!target || target.readOnly) return s;
          return {
            datasets: s.datasets.map((d) => {
              if (d.id !== targetId) return d;
              const colIdx = d.columnNames.indexOf(varName);
              if (colIdx === -1) return d;

              const newColumnNames = d.columnNames.filter((_, i) => i !== colIdx);
              const newVars = { ...d.variables };
              delete newVars[varName];

              let newData = d.data;
              if (d.data) {
                newData = d.data.map((row) => row.filter((_, i) => i !== colIdx));
              }
              let newPreview = d.preview;
              if (d.preview) {
                newPreview = d.preview.map((row) => row.filter((_, i) => i !== colIdx));
              }

              return {
                ...d,
                columns: newColumnNames.length,
                columnNames: newColumnNames,
                variables: newVars,
                data: newData,
                preview: newPreview,
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      addRow: (values, atIndex, id) => editRow("insertRow", id, atIndex, values),
      removeRow: (rowIndex, id) => editRow("deleteRow", id, rowIndex),

      setActiveImputationIndex: (datasetId, index) =>
        set((s) => {
          const targetId = datasetId ?? s.selectedDatasetId;
          if (!targetId) return s;
          const target = s.datasets.find((d) => d.id === targetId);
          if (!target || !target.imputationMeta) return s;
          if (index < 0 || index > target.imputationMeta.m) return s;

          const newRows = reconstructImputedRows(
            target.imputationMeta.originalRows,
            target.columnNames,
            target.imputationMeta.sparsePatches,
            index,
            target.rows
          );

          const previewLength =
            target.preview && target.preview.length < newRows.length && target.preview.length > 0
              ? target.preview.length
              : newRows.length;
          const newPreview = newRows.slice(0, previewLength).map((r) => [...r]);

          return {
            datasets: s.datasets.map((d) => {
              if (d.id !== targetId) return d;
              return {
                ...d,
                data: newRows,
                preview: newPreview,
                imputationMeta: {
                  ...d.imputationMeta!,
                  activeImputationIndex: index,
                },
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      cloneBundleAsStandardDataset: (datasetId, index) => {
        let created: Dataset | undefined;
        set((s) => {
          const targetId = datasetId ?? s.selectedDatasetId;
          if (!targetId) return s;
          const target = s.datasets.find((d) => d.id === targetId);
          if (!target || !target.imputationMeta) return s;
          if (index < 0 || index > target.imputationMeta.m) return s;

          const reconstructedRows = reconstructImputedRows(
            target.imputationMeta.originalRows,
            target.columnNames,
            target.imputationMeta.sparsePatches,
            index,
            target.rows
          );

          const previewLength =
            target.preview &&
            target.preview.length < reconstructedRows.length &&
            target.preview.length > 0
              ? target.preview.length
              : reconstructedRows.length;
          const newPreview = reconstructedRows.slice(0, previewLength).map((r) => [...r]);

          const now = new Date().toISOString();
          const cloned: Dataset = ensureDatasetMetadata({
            id: generateId(),
            name: `${target.name} (Imp ${index})`,
            rows: target.rows,
            columns: target.columns,
            columnNames: [...target.columnNames],
            preview: newPreview,
            data: reconstructedRows,
            variables: target.variables ? JSON.parse(JSON.stringify(target.variables)) : undefined,
            sourceFormat: target.sourceFormat || "csv",
            readOnly: false,
            createdAt: now,
            updatedAt: now,
          });

          delete (cloned as any).imputationMeta;
          created = cloned;

          return {
            datasets: [...s.datasets, cloned],
          };
        });
        return created;
      },
      };
    },
    {
      name: "quantis_data",
      merge: (persisted, current) => {
        const saved = persisted as Pick<DataState, "datasets" | "selectedDatasetId"> | undefined;
        return {
          ...current,
          ...replaceDatasets(current, saved?.datasets ?? current.datasets, true),
          selectedDatasetId: saved?.selectedDatasetId ?? null,
        };
      },
      partialize: (s) =>
        ({
          datasets: s.datasets,
          selectedDatasetId: s.selectedDatasetId,
          owner: workspaceOwner(useSyncStore.getState().authUser),
        }),
      storage: {
        getItem: (name) => {
          try {
            const owner = workspaceOwner(useSyncStore.getState().authUser);
            const newData = localStorage.getItem(name);
            if (newData) {
              const parsed = JSON.parse(newData);
              if ((parsed?.state?.owner ?? "local") !== owner) return null;
              if (parsed?.state?.datasets && Array.isArray(parsed.state.datasets)) {
                parsed.state.datasets = parsed.state.datasets.map((ds: Dataset) =>
                  ds.variables ? ds : ensureDatasetMetadata(ds)
                );
              }
              return parsed;
            }

            // Fallback: migration từ keys cũ
            if (owner !== "local") return null;
            const oldDatasets = localStorage.getItem("quantis_datasets");
            const oldSelectedId = localStorage.getItem("quantis_selectedDatasetId");
            if (oldDatasets) {
              const migrated = {
                state: {
                  datasets: JSON.parse(oldDatasets),
                  selectedDatasetId: oldSelectedId || null,
                },
                version: 0,
              };
              try {
                localStorage.setItem(name, JSON.stringify(migrated));
                localStorage.removeItem("quantis_datasets");
                localStorage.removeItem("quantis_selectedDatasetId");
              } catch {}
              return migrated;
            }
          } catch {
            return null;
          }
          return null;
        },
        setItem: (name, value) => {
          if (switchingOwner) return;
          try {
            if (!persistsWorkspaceLocally(useSyncStore.getState())) {
              // Khi online và kết nối server: Server/DB là nguồn chính, chỉ lưu selectedDatasetId xuống localStorage để giữ ngữ cảnh
              const lightweightValue = {
                ...value,
                state: {
                  ...value.state,
                  datasets: [],
                },
              };
              localStorage.setItem(name, JSON.stringify(lightweightValue));
              return;
            }
            localStorage.setItem(name, JSON.stringify(value));
          } catch {
            /* ignore QuotaExceededError giống bản cũ */
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(name);
          } catch {}
        },
      },
    }
  )
);

// Khi chuyển từ "ghi lên server" sang "lưu cục bộ" (server từ chối, mất mạng, khách…) phải ghi lại bản đầy đủ xuống
// localStorage — nếu không chỉ còn bản lưu nhẹ (danh sách rỗng) và dữ liệu mất khi tải lại trang.
useSyncStore.subscribe((state, previous) => {
  if (state.workspaceEpoch !== previous.workspaceEpoch) {
    switchingOwner = true;
    try {
      useDataStore.setState((current) => ({
        ...replaceDatasets(current, [], true),
        selectedDatasetId: null,
      }));
      void useDataStore.persist.rehydrate();
    } finally {
      switchingOwner = false;
    }
  } else if (persistsWorkspaceLocally(state) && !persistsWorkspaceLocally(previous)) {
    useDataStore.setState({});
  }
});
