import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Dataset } from "@/types";

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
      storage: {
        getItem: (name) => {
          const newData = localStorage.getItem(name);
          if (newData) {
            try {
              return JSON.parse(newData);
            } catch {
              return null;
            }
          }

          // Fallback: migration từ keys cũ
          const oldDatasets = localStorage.getItem("quantis_datasets");
          const oldSelectedId = localStorage.getItem("quantis_selectedDatasetId");
          if (oldDatasets) {
            try {
              const migrated = {
                state: {
                  datasets: JSON.parse(oldDatasets),
                  selectedDatasetId: oldSelectedId || null,
                },
                version: 0,
              };
              localStorage.setItem(name, JSON.stringify(migrated));
              localStorage.removeItem("quantis_datasets");
              localStorage.removeItem("quantis_selectedDatasetId");
              return migrated;
            } catch {
              return null;
            }
          }
          return null;
        },
        setItem: (name, value) => localStorage.setItem(name, JSON.stringify(value)),
        removeItem: (name) => localStorage.removeItem(name),
      },
    }
  )
);
