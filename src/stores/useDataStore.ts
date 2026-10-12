import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Dataset, VariableMetadata } from "@/types";
import { useSyncStore, canSyncToServer } from "./useSyncStore";

export interface DataState {
  // --- State ---
  datasets: Dataset[];
  selectedDatasetId: string | null;

  // --- Actions ---
  setDatasets: (datasets: Dataset[] | ((prev: Dataset[]) => Dataset[])) => void;
  addDataset: (dataset: Dataset) => void;
  removeDataset: (id: string) => void;
  updateDataset: (id: string, patch: Partial<Dataset>) => void;
  setSelectedDatasetId: (id: string | null | ((prev: string | null) => string | null)) => void;
  hydrateFromServer: (datasets: Dataset[]) => void;

  // --- Cell & Row & Column Editing Actions ---
  updateCell: (rowIndex: number, colIndex: number, value: string, datasetId?: string) => void;
  batchUpdateCells: (updates: Array<{ rowIndex: number; colIndex: number; value: string }>, datasetId?: string) => void;
  updateVariableMetadata: (varName: string, patch: Partial<VariableMetadata>, datasetId?: string) => void;
  renameVariable: (oldName: string, newName: string, datasetId?: string) => void;
  addVariable: (metadata: VariableMetadata, defaultValues?: string[], datasetId?: string) => void;
  removeVariable: (varName: string, datasetId?: string) => void;
  addRow: (values?: string[], atIndex?: number, datasetId?: string) => void;
  removeRow: (rowIndex: number, datasetId?: string) => void;
}

export const useDataStore = create<DataState>()(
  persist(
    (set) => ({
      datasets: [],
      selectedDatasetId: null,

      setDatasets: (datasets) =>
        set((s) => ({
          datasets: typeof datasets === "function" ? datasets(s.datasets) : datasets,
        })),
      addDataset: (dataset) =>
        set((s) => ({ datasets: [...s.datasets, dataset] })),
      removeDataset: (id) =>
        set((s) => ({
          datasets: s.datasets.filter((d) => d.id !== id),
          selectedDatasetId: s.selectedDatasetId === id ? null : s.selectedDatasetId,
        })),
      updateDataset: (id, patch) =>
        set((s) => ({
          datasets: s.datasets.map((d) => (d.id === id ? { ...d, ...patch } : d)),
        })),
      setSelectedDatasetId: (id) =>
        set((s) => ({
          selectedDatasetId: typeof id === "function" ? id(s.selectedDatasetId) : id,
        })),
      hydrateFromServer: (datasets) => set({ datasets }),

      updateCell: (rowIndex, colIndex, value, datasetId) =>
        set((s) => {
          const targetId = datasetId ?? s.selectedDatasetId;
          if (!targetId) return s;
          return {
            datasets: s.datasets.map((d) => {
              if (d.id !== targetId) return d;
              const now = new Date().toISOString();
              let newData = d.data;
              if (d.data && d.data.length > 0) {
                const hasHeader =
                  d.data.length === d.rows + 1 ||
                  (d.columnNames && d.data[0][0] === d.columnNames[0]);
                const actualRow = hasHeader ? rowIndex + 1 : rowIndex;
                if (actualRow >= 0 && actualRow < d.data.length) {
                  const updatedRow = [...d.data[actualRow]];
                  updatedRow[colIndex] = value;
                  newData = [...d.data];
                  newData[actualRow] = updatedRow;
                }
              }
              let newPreview = d.preview;
              if (d.preview && d.preview.length > 0) {
                const hasPreviewHeader =
                  d.preview.length === d.rows + 1 ||
                  (d.columnNames && d.preview[0][0] === d.columnNames[0]);
                const actualPreviewRow = hasPreviewHeader ? rowIndex + 1 : rowIndex;
                if (actualPreviewRow >= 0 && actualPreviewRow < d.preview.length) {
                  const updatedRow = [...d.preview[actualPreviewRow]];
                  updatedRow[colIndex] = value;
                  newPreview = [...d.preview];
                  newPreview[actualPreviewRow] = updatedRow;
                }
              }
              return {
                ...d,
                data: newData,
                preview: newPreview,
                updatedAt: now,
              };
            }),
          };
        }),

      batchUpdateCells: (updates, datasetId) =>
        set((s) => {
          const targetId = datasetId ?? s.selectedDatasetId;
          if (!targetId || updates.length === 0) return s;
          return {
            datasets: s.datasets.map((d) => {
              if (d.id !== targetId) return d;
              const now = new Date().toISOString();
              const hasHeader =
                d.data &&
                d.data.length > 0 &&
                (d.data.length === d.rows + 1 || (d.columnNames && d.data[0][0] === d.columnNames[0]));
              const hasPreviewHeader =
                d.preview &&
                d.preview.length > 0 &&
                (d.preview.length === d.rows + 1 ||
                  (d.columnNames && d.preview[0][0] === d.columnNames[0]));

              const newData = d.data ? [...d.data] : undefined;
              const newPreview = d.preview ? [...d.preview] : undefined;

              for (const { rowIndex, colIndex, value } of updates) {
                if (newData) {
                  const actualRow = hasHeader ? rowIndex + 1 : rowIndex;
                  if (actualRow >= 0 && actualRow < newData.length) {
                    const updatedRow = [...newData[actualRow]];
                    updatedRow[colIndex] = value;
                    newData[actualRow] = updatedRow;
                  }
                }
                if (newPreview) {
                  const actualPreviewRow = hasPreviewHeader ? rowIndex + 1 : rowIndex;
                  if (actualPreviewRow >= 0 && actualPreviewRow < newPreview.length) {
                    const updatedRow = [...newPreview[actualPreviewRow]];
                    updatedRow[colIndex] = value;
                    newPreview[actualPreviewRow] = updatedRow;
                  }
                }
              }
              return {
                ...d,
                data: newData,
                preview: newPreview ?? d.preview,
                updatedAt: now,
              };
            }),
          };
        }),

      updateVariableMetadata: (varName, patch, datasetId) =>
        set((s) => {
          const targetId = datasetId ?? s.selectedDatasetId;
          if (!targetId) return s;
          return {
            datasets: s.datasets.map((d) => {
              if (d.id !== targetId) return d;
              const currentVars = d.variables ? { ...d.variables } : {};
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
          return {
            datasets: s.datasets.map((d) => {
              if (d.id !== targetId) return d;
              const colIdx = d.columnNames.indexOf(oldName);
              if (colIdx === -1) return d;

              const newColumnNames = [...d.columnNames];
              newColumnNames[colIdx] = trimmedNew;

              const newVars = { ...d.variables };
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

      addRow: (values, atIndex, datasetId) =>
        set((s) => {
          const targetId = datasetId ?? s.selectedDatasetId;
          if (!targetId) return s;
          return {
            datasets: s.datasets.map((d) => {
              if (d.id !== targetId) return d;
              const cols = d.columns || d.columnNames.length;
              const rowToAdd = values ? [...values] : new Array(cols).fill("");
              while (rowToAdd.length < cols) rowToAdd.push("");

              const hasHeader =
                d.data &&
                d.data.length > 0 &&
                (d.data.length === d.rows + 1 || (d.columnNames && d.data[0][0] === d.columnNames[0]));
              const hasPreviewHeader =
                d.preview &&
                d.preview.length > 0 &&
                (d.preview.length === d.rows + 1 ||
                  (d.columnNames && d.preview[0][0] === d.columnNames[0]));

              let newData = d.data ? [...d.data] : undefined;
              let newPreview = d.preview ? [...d.preview] : undefined;

              if (newData) {
                if (atIndex != null && atIndex >= 0 && atIndex <= d.rows) {
                  const insertIdx = hasHeader ? atIndex + 1 : atIndex;
                  newData.splice(insertIdx, 0, rowToAdd);
                } else {
                  newData.push(rowToAdd);
                }
              }

              if (newPreview) {
                if (atIndex != null && atIndex >= 0 && atIndex < newPreview.length) {
                  const insertIdx = hasPreviewHeader ? atIndex + 1 : atIndex;
                  if (insertIdx <= newPreview.length) {
                    newPreview.splice(insertIdx, 0, rowToAdd);
                  }
                } else if (newPreview.length < 50) {
                  newPreview.push(rowToAdd);
                }
              }

              return {
                ...d,
                rows: d.rows + 1,
                data: newData,
                preview: newPreview ?? d.preview,
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),

      removeRow: (rowIndex, datasetId) =>
        set((s) => {
          const targetId = datasetId ?? s.selectedDatasetId;
          if (!targetId) return s;
          return {
            datasets: s.datasets.map((d) => {
              if (d.id !== targetId || d.rows <= 0) return d;

              const hasHeader =
                d.data &&
                d.data.length > 0 &&
                (d.data.length === d.rows + 1 || (d.columnNames && d.data[0][0] === d.columnNames[0]));
              const hasPreviewHeader =
                d.preview &&
                d.preview.length > 0 &&
                (d.preview.length === d.rows + 1 ||
                  (d.columnNames && d.preview[0][0] === d.columnNames[0]));

              let newData = d.data ? [...d.data] : undefined;
              let newPreview = d.preview ? [...d.preview] : undefined;

              if (newData) {
                const actualRow = hasHeader ? rowIndex + 1 : rowIndex;
                if (actualRow >= 0 && actualRow < newData.length) {
                  newData.splice(actualRow, 1);
                }
              }

              if (newPreview) {
                const actualPreviewRow = hasPreviewHeader ? rowIndex + 1 : rowIndex;
                if (actualPreviewRow >= 0 && actualPreviewRow < newPreview.length) {
                  newPreview.splice(actualPreviewRow, 1);
                }
              }

              return {
                ...d,
                rows: Math.max(0, d.rows - 1),
                data: newData,
                preview: newPreview ?? d.preview,
                updatedAt: new Date().toISOString(),
              };
            }),
          };
        }),
    }),
    {
      name: "quantis_data",
      partialize: (s) =>
        ({
          datasets: s.datasets,
          selectedDatasetId: s.selectedDatasetId,
        } as DataState),
      storage: {
        getItem: (name) => {
          try {
            const newData = localStorage.getItem(name);
            if (newData) {
              return JSON.parse(newData);
            }

            // Fallback: migration từ keys cũ
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
          try {
            const syncState = useSyncStore.getState();
            const canSync = canSyncToServer(syncState);
            const persistWorkspaceLocally = !canSync || !syncState.isOnline;
            if (!persistWorkspaceLocally) {
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
