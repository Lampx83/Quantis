import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Dataset } from "@/types";
import { useSyncStore, canSyncToServer, persistsWorkspaceLocally } from "./useSyncStore";

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

// Khi chuyển từ "ghi lên server" sang "lưu cục bộ" (server từ chối, mất mạng, khách…) phải ghi lại bản đầy đủ xuống
// localStorage — nếu không chỉ còn bản lưu nhẹ (danh sách rỗng) và dữ liệu mất khi tải lại trang.
let wasPersistingLocally = persistsWorkspaceLocally(useSyncStore.getState());
useSyncStore.subscribe((state) => {
  const now = persistsWorkspaceLocally(state);
  if (now && !wasPersistingLocally) useDataStore.setState({});
  wasPersistingLocally = now;
});
