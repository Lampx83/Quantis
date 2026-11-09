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
