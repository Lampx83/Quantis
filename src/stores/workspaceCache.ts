export const DATA_CACHE = "quantis_data";
export const WORKFLOW_CACHE = "quantis_workflows_data";

type WorkspaceItem = { id: string; updatedAt: string };
type ChangeKind = "edit" | "legacy";
type PendingChanges = Readonly<Record<string, ChangeKind>>;
export type WorkspaceChangeScope = "datasets" | "workflows";
export type WorkspaceChanges = Record<WorkspaceChangeScope, PendingChanges>;

export function workspaceCacheKey(name: string, owner: string): string {
  return `${name}:${owner}`;
}

export function readWorkspaceCache(name: string, owner: string) {
  const key = workspaceCacheKey(name, owner);
  const cached = localStorage.getItem(key);
  if (cached !== null) return JSON.parse(cached);

  const legacy = localStorage.getItem(name);
  if (legacy === null) return null;
  const parsed = JSON.parse(legacy);
  if ((parsed?.state?.owner ?? "local") !== owner) return null;
  try {
    localStorage.setItem(key, legacy);
    localStorage.removeItem(name);
  } catch {
    // Keep the old copy if the migration cannot write the new key.
  }
  return parsed;
}

export function readWorkspaceChanges(name: string, owner: string, scope: WorkspaceChangeScope): PendingChanges {
  try {
    const state = readWorkspaceCache(name, owner)?.state;
    const pending = state?.pendingChanges;
    if (pending && typeof pending === "object" && !Array.isArray(pending)) return pending;
    // Older caches do not distinguish edits from snapshots taken on disconnect.
    if (Array.isArray(state?.[scope])) {
      return Object.fromEntries(state[scope].map((item: WorkspaceItem) => [item.id, "legacy"]));
    }
  } catch {
    // The persisted workspace may be unavailable.
  }
  return {};
}

export function recordWorkspaceChanges<T extends WorkspaceItem>(pending: PendingChanges, before: T[], after: T[]) {
  const changes = new Map(Object.entries(pending));
  const previous = new Map(before.map((item) => [item.id, item]));
  for (const item of after) {
    if (previous.get(item.id) !== item) changes.set(item.id, "edit");
    previous.delete(item.id);
  }
  for (const id of previous.keys()) changes.set(id, "edit");
  return Object.fromEntries(changes);
}

export function reconcileWorkspaceItems<T extends WorkspaceItem>(
  remote: T[], local: T[], pending: PendingChanges,
) {
  const entries = Object.entries(pending);
  if (!entries.length) return { items: remote, pending };
  const merged = new Map(remote.map((item) => [item.id, item]));
  const byId = new Map(local.map((item) => [item.id, item]));
  const applied: [string, ChangeKind][] = [];
  for (const [id, kind] of entries) {
    const item = byId.get(id);
    const serverItem = merged.get(id);
    if (kind === "legacy" && (!item || (serverItem && item.updatedAt <= serverItem.updatedAt))) continue;
    if (item) merged.set(id, item);
    else merged.delete(id);
    applied.push([id, "edit"]);
  }
  return { items: [...merged.values()], pending: Object.fromEntries(applied) };
}
