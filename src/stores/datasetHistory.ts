import type { Dataset, DatasetChange, DatasetChangeDetails, DatasetChangeSummary } from "@/types";
import { generateId } from "@/utils/helpers";
import { appendDatasetAudit } from "./transformationAudit";

export type DatasetContentPatch = Partial<Pick<Dataset,
  "name" | "data" | "preview" | "variables" | "columnNames" | "rows" | "columns" | "readOnly" | "imputationMeta"
>>;

export interface HistoryStep {
  change: DatasetChange;
  before: DatasetContentPatch;
  after: DatasetContentPatch;
  bytes: number;
  sequence: number;
}

export interface DatasetHistory {
  undo: HistoryStep[];
  redo: HistoryStep[];
}

export const HISTORY_BYTE_LIMIT = 16 * 1024 * 1024;
const HISTORY_STEP_LIMIT = 50;
let sequence = 0;

export function createHistoryStep(
  dataset: Dataset,
  after: DatasetContentPatch,
  change: DatasetChange,
  affectedRows?: readonly number[],
): HistoryStep {
  const before = previousContent(dataset, after);
  const seen = new WeakSet<object>();
  function size(value: unknown): number {
    if (typeof value === "string") return 16 + 2 * value.length;
    if (!value || typeof value !== "object" || seen.has(value)) return 0;
    seen.add(value);
    if (Array.isArray(value)) return value.reduce<number>((bytes, item) => bytes + size(item), 24 + value.length * 8);
    return Object.entries(value).reduce((bytes, [key, item]) => bytes + size(key) + size(item) + 8, 32);
  }

  let bytes = 160 + size(change);
  for (const key of Object.keys(after) as (keyof DatasetContentPatch)[]) {
    if (before[key] === after[key]) continue;
    if ((key === "data" || key === "preview") && affectedRows) {
      // Account for copied outer arrays and touched rows without visiting the other cells.
      const offset = datasetRowOffset(before[key], dataset);
      for (const matrix of [before[key], after[key]]) {
        if (!matrix) continue;
        bytes += 24 + matrix.length * 8;
        for (const row of affectedRows) bytes += size(matrix[row + offset]);
      }
    } else {
      bytes += size(before[key]) + size(after[key]);
    }
  }
  return { before, after, change, bytes, sequence: ++sequence };
}

export function retainHistoryStep(histories: ReadonlyMap<string, DatasetHistory>, step: HistoryStep) {
  const id = step.change.datasetId;
  const next = new Map(histories);
  if (step.bytes > HISTORY_BYTE_LIMIT) {
    next.delete(id);
    return next;
  }

  const undo = next.get(id)?.undo ?? [];
  next.set(id, { undo: [...undo.slice(-(HISTORY_STEP_LIMIT - 1)), step], redo: [] });
  let bytes = 0;
  for (const history of next.values()) {
    for (const entry of [...history.undo, ...history.redo]) bytes += entry.bytes;
  }
  while (bytes > HISTORY_BYTE_LIMIT) {
    let oldest: HistoryStep | undefined;
    for (const history of next.values()) {
      const first = history.undo[0] ?? history.redo[history.redo.length - 1];
      if (first && (!oldest || first.sequence < oldest.sequence)) oldest = first;
    }
    if (!oldest) break;
    const oldestId = oldest.change.datasetId;
    const history = next.get(oldestId)!;
    if (history.undo.length) {
      bytes -= oldest.bytes;
      const undo = history.undo.slice(1);
      if (undo.length || history.redo.length) next.set(oldestId, { ...history, undo });
      else next.delete(oldestId);
    } else {
      // Redo is stored in reverse order. Later steps depend on the evicted one.
      for (const entry of history.redo) bytes -= entry.bytes;
      next.delete(oldestId);
    }
  }
  return next;
}

export function newDatasetChange(
  datasetId: string,
  summary: DatasetChangeSummary,
  details: DatasetChangeDetails,
): DatasetChange {
  return { ...summary, ...details, id: generateId(), datasetId, timestamp: new Date().toISOString() };
}

export function previousContent(dataset: Dataset, patch: DatasetContentPatch): DatasetContentPatch {
  return Object.fromEntries(Object.keys(patch).map((key) => [key, dataset[key as keyof DatasetContentPatch]]));
}

export function applyDatasetChange(dataset: Dataset, patch: DatasetContentPatch, change: DatasetChange): Dataset {
  return {
    ...dataset,
    ...patch,
    updatedAt: change.timestamp,
    audit: appendDatasetAudit(dataset.audit, change),
  };
}

export function datasetRowOffset(matrix: string[][] | undefined, dataset: Dataset): number {
  if (!matrix?.length) return 0;
  // A truncated preview follows the full matrix's header convention.
  if (dataset.data && matrix !== dataset.data) return datasetRowOffset(dataset.data, dataset);
  if (matrix.length === dataset.rows) return 0;
  return matrix.length === dataset.rows + 1 || matrix[0][0] === dataset.columnNames[0]
    ? 1
    : 0;
}

export function sameContent(a: unknown, b: unknown): boolean {
  if (Object.is(a, b)) return true;
  if (Array.isArray(a)) return Array.isArray(b) && a.length === b.length &&
    a.every((value, index) => sameContent(value, b[index]));
  if (!a || !b || typeof a !== "object" || typeof b !== "object" || Array.isArray(b)) return false;
  const left = a as Record<string, unknown>;
  const right = b as Record<string, unknown>;
  return [...new Set([...Object.keys(left), ...Object.keys(right)])].every((key) => sameContent(left[key], right[key]));
}

export function validCell(dataset: Dataset, row: number, column: number): boolean {
  return Number.isInteger(row) && row >= 0 && row < dataset.rows &&
    Number.isInteger(column) && column >= 0 && column < dataset.columnNames.length;
}

export interface CellEdit {
  rowIndex: number;
  colIndex: number;
  value: string;
}

export function editMatrixCells(
  matrix: string[][] | undefined,
  dataset: Dataset,
  edits: Iterable<CellEdit>,
  changed: Set<CellEdit>,
) {
  if (!matrix) return matrix;
  const offset = datasetRowOffset(matrix, dataset);
  const rows = new Map<number, string[]>();
  for (const edit of edits) {
    const row = edit.rowIndex + offset;
    if (!matrix[row] || matrix[row][edit.colIndex] === edit.value) continue;
    const next = rows.get(row) ?? [...matrix[row]];
    next[edit.colIndex] = edit.value;
    rows.set(row, next);
    changed.add(edit);
  }
  if (!rows.size) return matrix;
  const next = [...matrix];
  for (const [row, values] of rows) next[row] = values;
  return next;
}

export function editMatrixRow(
  matrix: string[][] | undefined, dataset: Dataset, row: number, inserted?: string[],
) {
  if (!matrix) return matrix;
  const index = row + datasetRowOffset(matrix, dataset);
  if (inserted ? index > matrix.length : index >= matrix.length) return matrix;
  const next = [...matrix];
  if (inserted) next.splice(index, 0, inserted);
  else next.splice(index, 1);
  return next;
}
