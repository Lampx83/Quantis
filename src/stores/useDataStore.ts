import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Dataset, DatasetChangeSummary, DerivationSummary, TransformChangeSummary, VariableMetadata } from "@/types";
import { ensureDatasetMetadata } from "@/utils/metadata";
import { generateId } from "@/utils/helpers";
import { reconstructImputedRows } from "@/utils/sparseDelta";
import { useSyncStore, persistsWorkspaceLocally, shouldWriteWorkspaceCache, workspaceOwner } from "./useSyncStore";
import { readWorkspaceCache, workspaceCacheKey } from "./workspaceCache";
import {
  applyDatasetChange,
  createHistoryStep,
  datasetRowOffset,
  editMatrixCells,
  editMatrixRow,
  newDatasetChange,
  HISTORY_BYTE_LIMIT,
  retainHistoryStep,
  sameContent,
  validCell,
  type CellEdit,
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
  commitDatasetTransform: (id: string, revision: symbol, result: Dataset, summary: TransformChangeSummary) => Dataset | undefined;
  deriveDataset: (
    sourceId: string,
    result: Omit<Dataset, "id" | "createdAt" | "updatedAt" | "audit">,
    summary: DerivationSummary,
    revision?: symbol,
  ) => Dataset | undefined;

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

function bundleMember(dataset: Dataset, index: number) {
  const meta = dataset.imputationMeta;
  if (!meta || !Number.isInteger(index) || index < 0 || index > meta.m) return;
  const data = reconstructImputedRows(meta.originalRows, dataset.columnNames, meta.sparsePatches, index, dataset.rows);
  const preview = data.slice(0, dataset.preview?.length || data.length).map((row) => [...row]);
  return { data, preview };
}

function commitDatasetChange(
  state: DataState,
  dataset: Dataset,
  patch: DatasetContentPatch,
  summary: DatasetChangeSummary,
  affectedRows?: readonly number[],
) {
  const change = newDatasetChange(dataset.id, summary, { kind: "commit" });
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
  const change = newDatasetChange(dataset.id, step.change, { kind: direction, originalChangeId: step.change.id });
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

      function editSchema(id: string | undefined, edit: (dataset: Dataset) => {
        patch: DatasetContentPatch;
        summary: DatasetChangeSummary;
        affectedRows?: number[];
      } | undefined) {
        const state = get();
        const dataset = state.datasets.find((d) => d.id === (id ?? state.selectedDatasetId));
        if (!dataset || dataset.readOnly) return;
        const result = edit(dataset);
        if (result) set(commitDatasetChange(state, dataset, result.patch, result.summary, result.affectedRows));
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
      commitDatasetTransform: (id, revision, result, summary) => {
        const state = get();
        const dataset = state.datasets.find((d) => d.id === id);
        if (!dataset || result.id !== id || revisionOf(dataset) !== revision) return;

        const { name, rows, columns, columnNames, variables, preview, data, readOnly, imputationMeta } = result;
        if (rows === dataset.rows && columns === dataset.columns && sameContent(columnNames, dataset.columnNames) &&
          sameContent(data, dataset.data) && sameContent(variables, dataset.variables ?? ensureDatasetMetadata(dataset).variables) &&
          Boolean(readOnly) === Boolean(dataset.readOnly) && sameContent(imputationMeta, dataset.imputationMeta)) return;

        const next = commitDatasetChange(state, dataset, {
          name, rows, columns, columnNames, variables, preview, data, readOnly, imputationMeta,
        }, summary);
        set(next);
        return next.datasets.find((d) => d.id === id);
      },
      deriveDataset: (sourceId, result, summary, revision) => {
        const state = get();
        const source = state.datasets.find((d) => d.id === sourceId);
        if (!source || (revision !== undefined && revisionOf(source) !== revision)) return;
        const id = generateId();
        const extraction = summary.action === "extractImputation";
        const change = newDatasetChange(id, extraction ? { action: summary.action, rowCount: result.rows } : summary, {
          kind: "derive",
          source: { datasetId: sourceId, name: source.name, member: extraction ? summary.member : undefined },
        });
        const child = applyDatasetChange(ensureDatasetMetadata({
          ...result, id, audit: undefined, createdAt: change.timestamp, updatedAt: change.timestamp,
        }), {}, change);
        set({ datasets: [...state.datasets, child] });
        return child;
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

      updateVariableMetadata: (varName, patch, id) => editSchema(id, (dataset) => {
        if (!dataset.columnNames.includes(varName) || (patch.name !== undefined && patch.name !== varName)) return;
        const variables = ensureDatasetMetadata(dataset).variables!;
        const previous = variables[varName];
        const updated = { ...previous, ...patch };
        if (updated.type === "string" && updated.measure === "scale") updated.measure = "nominal";
        if (sameContent(previous, updated)) return;
        return {
          patch: { variables: { ...variables, [varName]: updated } },
          summary: { action: "metadata", columns: [varName] },
        };
      }),

      renameVariable: (oldName, newName, id) => editSchema(id, (dataset) => {
        const name = newName.trim();
        const column = dataset.columnNames.indexOf(oldName);
        if (column === -1 || !name || dataset.columnNames.includes(name)) return;
        const columnNames = [...dataset.columnNames];
        columnNames[column] = name;
        const variables = { ...dataset.variables };
        const oldMetadata = variables[oldName];
        delete variables[oldName];
        function renameHeader(matrix: string[][] | undefined) {
          if (!matrix?.length || (!datasetRowOffset(matrix, dataset) && matrix[0][column] !== oldName)) return matrix;
          const header = [...matrix[0]];
          header[column] = name;
          return [header, ...matrix.slice(1)];
        }
        return {
          patch: {
            columnNames,
            variables: oldMetadata ? { ...variables, [name]: { ...oldMetadata, name } } : variables,
            data: renameHeader(dataset.data),
            preview: renameHeader(dataset.preview) ?? dataset.preview,
          },
          summary: { action: "renameColumn", columns: [oldName, name] },
          affectedRows: [0, -1],
        };
      }),

      addVariable: (metadata, defaultValues = [], id) => editSchema(id, (dataset) => {
        const name = metadata.name;
        if (!name.trim() || dataset.columnNames.includes(name)) return;
        const columnNames = [...dataset.columnNames, name];
        function addColumn(matrix: string[][] | undefined) {
          const offset = datasetRowOffset(matrix, dataset);
          return matrix?.map((row, index) => [...row, index < offset ? name : defaultValues[index - offset] ?? ""]);
        }
        return {
          patch: {
            columnNames,
            columns: columnNames.length,
            variables: { ...dataset.variables, [name]: metadata },
            data: addColumn(dataset.data),
            preview: addColumn(dataset.preview) ?? dataset.preview,
          },
          summary: { action: "insertColumn", columns: [name], rowCount: dataset.rows },
        };
      }),

      removeVariable: (varName, id) => editSchema(id, (dataset) => {
        const column = dataset.columnNames.indexOf(varName);
        if (column === -1) return;
        const columnNames = dataset.columnNames.filter((_, index) => index !== column);
        const variables = { ...dataset.variables };
        delete variables[varName];
        function removeColumn(matrix: string[][] | undefined) {
          return matrix?.map((row) => row.filter((_, index) => index !== column));
        }
        return {
          patch: {
            columnNames,
            columns: columnNames.length,
            variables,
            data: removeColumn(dataset.data),
            preview: removeColumn(dataset.preview) ?? dataset.preview,
          },
          summary: { action: "deleteColumn", columns: [varName], rowCount: dataset.rows },
        };
      }),

      addRow: (values, atIndex, id) => editRow("insertRow", id, atIndex, values),
      removeRow: (rowIndex, id) => editRow("deleteRow", id, rowIndex),

      setActiveImputationIndex: (id, index) =>
        set((state) => {
          const dataset = state.datasets.find((d) => d.id === id);
          if (!dataset?.imputationMeta || index === dataset.imputationMeta.activeImputationIndex) return state;
          const member = bundleMember(dataset, index);
          if (!member) return state;
          const updated = {
            ...dataset,
            ...member,
            imputationMeta: { ...dataset.imputationMeta, activeImputationIndex: index },
            updatedAt: new Date().toISOString(),
          };
          return { datasets: state.datasets.map((d) => d === dataset ? updated : d) };
        }),

      cloneBundleAsStandardDataset: (id, index) => {
        const state = get();
        const source = state.datasets.find((d) => d.id === id);
        if (!source) return;
        const member = bundleMember(source, index);
        if (!member) return;
        return state.deriveDataset(id, {
          ...member,
          name: `${source.name} (Imp ${index})`,
          rows: source.rows,
          columns: source.columns,
          columnNames: source.columnNames,
          variables: source.variables,
          sourceFormat: source.sourceFormat || "csv",
          readOnly: false,
        }, { action: "extractImputation", member: index });
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
            const parsed = readWorkspaceCache(name, owner);
            if (parsed) {
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
                localStorage.setItem(workspaceCacheKey(name, owner), JSON.stringify(migrated));
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
          if (switchingOwner || (typeof window === "undefined" && typeof localStorage === "undefined")) return;
          const sync = useSyncStore.getState();
          const local = persistsWorkspaceLocally(sync);
          const key = workspaceCacheKey(name, value.state.owner);
          try {
            if (!local) {
              // Khi online và kết nối server: Server/DB là nguồn chính, chỉ lưu selectedDatasetId xuống localStorage để giữ ngữ cảnh
              const lightweightValue = {
                ...value,
                state: {
                  ...value.state,
                  datasets: [],
                },
              };
              localStorage.setItem(key, JSON.stringify(lightweightValue));
              return;
            }
            localStorage.setItem(key, JSON.stringify(value));
            sync.setLocalSaveFailure("datasets", false);
          } catch {
            if (local) sync.setLocalSaveFailure("datasets", true);
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(workspaceCacheKey(name, workspaceOwner(useSyncStore.getState().authUser)));
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
  } else if (shouldWriteWorkspaceCache(state, previous)) {
    useDataStore.setState({});
  }
});
