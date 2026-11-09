import type { DatasetAuditLog, DatasetChange } from "@/types";

const MAX_ENTRIES = 200;
const MAX_BYTES = 32 * 1024;
const MAX_COLUMNS = 8;
const encoder = new TextEncoder();

function boundText(text: string, maxLength: number): string {
  if (text.length <= maxLength) return text;
  return text.slice(0, maxLength - 1).replace(/[\uD800-\uDBFF]$/, "") + "…";
}

function compactEntry(change: DatasetChange): DatasetChange {
  const { id, datasetId, timestamp, action, columns, firstRow, lastRow, rowCount, cellCount, operation, formula } = change;
  const summary = {
    id, datasetId, timestamp, action, firstRow, lastRow, rowCount, cellCount, operation,
    columns: columns?.slice(0, MAX_COLUMNS).map((column) => boundText(column, 64)),
    columnCount: columns && columns.length > MAX_COLUMNS ? columns.length : undefined,
    formula: formula && boundText(formula, 256),
  };
  if (change.kind === "derive") {
    return { ...summary, kind: change.kind, source: { ...change.source, name: boundText(change.source.name, 128) } };
  }
  if (change.kind === "commit") return { ...summary, kind: change.kind };
  return { ...summary, kind: change.kind, originalChangeId: change.originalChangeId };
}

export function appendDatasetAudit(previous: DatasetAuditLog | undefined, change: DatasetChange): DatasetAuditLog {
  const entries = [...(previous?.entries ?? []), compactEntry(change)];
  const dropped = entries.splice(0, Math.max(0, entries.length - MAX_ENTRIES));
  const audit: DatasetAuditLog = {
    entries,
    cutoffAt: dropped[dropped.length - 1]?.timestamp ?? previous?.cutoffAt,
  };
  while (entries.length && encoder.encode(JSON.stringify(audit)).byteLength > MAX_BYTES) {
    audit.cutoffAt = entries.shift()!.timestamp;
  }
  return audit;
}
