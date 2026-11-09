import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/api";
import { useDataStore, useSyncStore, useWorkflowStore } from "@/stores";
import type { Dataset } from "@/types";
import { startWorkspaceSync } from "../useServerSync";

const userA = { id: "a", email: "a@example.test" };
const userB = { id: "b", email: "b@example.test" };
const dataset = (id: string): Dataset => ({
  id, name: id, rows: 1, columns: 1, columnNames: ["X"], data: [["X"], ["1"]],
  preview: [["X"], ["1"]], sourceFormat: "csv", createdAt: "", updatedAt: "",
});

function deferred<T>() {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((done) => { resolve = done; });
  return { promise, resolve };
}

describe("workspace sync ownership", () => {
  let stop: (() => void) | undefined;

  beforeEach(() => {
    vi.useFakeTimers();
    const storage = new Map<string, string>();
    vi.stubGlobal("localStorage", {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
      removeItem: (key: string) => storage.delete(key),
    });
    vi.spyOn(api, "isPortalEmbed").mockReturnValue(true);
    useSyncStore.setState({ useBackend: false, isOnline: true });
    useSyncStore.getState().setAuthUser(userA);
    useDataStore.getState().hydrateFromServer([]);
    useWorkflowStore.getState().hydrateFromServer([]);
  });

  afterEach(() => {
    stop?.();
    stop = undefined;
    useSyncStore.getState().setAuthUser(null);
    vi.useRealTimers();
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("keeps same-owner history and fallback but hides them immediately on logout", async () => {
    const data = useDataStore.getState();
    data.addDataset(dataset("a-data"));
    data.updateCell(0, 0, "2", "a-data");
    const revision = data.getDatasetRevision("a-data");
    const auth = useSyncStore.getState();
    auth.setAuthUser({ ...userA, name: "Updated name" });
    expect(data.getDatasetRevision("a-data")).toBe(revision);
    expect(useDataStore.getState().historyByDataset.get("a-data")?.undo).toHaveLength(1);
    auth.setAuthUser(null);
    await useDataStore.persist.rehydrate();
    expect(useDataStore.getState().datasets).toEqual([]);
    expect(data.getDatasetRevision("a-data")).toBeUndefined();
    expect(data.undoDataset("a-data")).toBe(false);
    auth.setAuthUser(userA);
    expect(useDataStore.getState().datasets[0].data?.[1][0]).toBe("2");
    expect(data.undoDataset("a-data")).toBe(false);
  });

  it("ignores a previous Portal owner's pull and saves only the current owner's data", async () => {
    const a = deferred<Awaited<ReturnType<typeof api.getData>>>();
    const b = deferred<Awaited<ReturnType<typeof api.getData>>>();
    const pull = vi.spyOn(api, "getData").mockReturnValueOnce(a.promise).mockReturnValueOnce(b.promise);
    const save = vi.spyOn(api, "saveData").mockResolvedValue(true);
    const auth = useSyncStore.getState();
    auth.setUseBackend(true);
    stop = startWorkspaceSync();
    expect(pull).toHaveBeenCalledOnce();

    auth.setAuthUser(userB);
    expect(pull).toHaveBeenCalledTimes(2);
    a.resolve({ datasets: [dataset("a-data")], workflows: [] });
    await a.promise;
    expect(useDataStore.getState().datasets).toEqual([]);
    b.resolve({ datasets: [dataset("b-data")], workflows: [] });
    await b.promise;
    expect(useDataStore.getState().datasets.map((d) => d.id)).toEqual(["b-data"]);

    useDataStore.getState().updateCell(0, 0, "2", "b-data");
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0].datasets.map((d) => d.id)).toEqual(["b-data"]);
  });

  it("cancels a queued save when the Portal owner changes", async () => {
    vi.spyOn(api, "getData").mockResolvedValue({ datasets: [dataset("a-data")], workflows: [] });
    const save = vi.spyOn(api, "saveData").mockResolvedValue(true);
    const auth = useSyncStore.getState();
    auth.setUseBackend(true);
    stop = startWorkspaceSync();
    await vi.advanceTimersByTimeAsync(0);
    useDataStore.getState().updateCell(0, 0, "2", "a-data");

    vi.mocked(api.getData).mockResolvedValue({ datasets: [dataset("b-data")], workflows: [] });
    auth.setAuthUser(userB);
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).not.toHaveBeenCalled();
    expect(useDataStore.getState().datasets.map((d) => d.id)).toEqual(["b-data"]);
  });
});
