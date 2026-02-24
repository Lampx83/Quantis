import type { Dataset, Workflow } from "./types";

const STORAGE_PREFIX = "quantis_";

function getKey(key: string): string {
  return STORAGE_PREFIX + key;
}

export function loadDatasets(): Dataset[] {
  try {
    const raw = localStorage.getItem(getKey("datasets"));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveDatasets(datasets: Dataset[]): void {
  try {
    localStorage.setItem(getKey("datasets"), JSON.stringify(datasets));
  } catch {
    /* ignore */
  }
}

export function loadWorkflows(): Workflow[] {
  try {
    const raw = localStorage.getItem(getKey("workflows"));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveWorkflows(workflows: Workflow[]): void {
  try {
    localStorage.setItem(getKey("workflows"), JSON.stringify(workflows));
  } catch {
    /* ignore */
  }
}

export function generateId(): string {
  return crypto.randomUUID?.() ?? `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadSelectedDatasetId(): string | null {
  try {
    return localStorage.getItem(getKey("selectedDatasetId"));
  } catch {
    return null;
  }
}

export function saveSelectedDatasetId(id: string | null): void {
  try {
    if (id) localStorage.setItem(getKey("selectedDatasetId"), id);
    else localStorage.removeItem(getKey("selectedDatasetId"));
  } catch {
    /* ignore */
  }
}
