import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import * as api from "@/api";
import { useDataStore, useSyncStore, useWorkflowStore } from "@/stores";
import type { Dataset, Workflow } from "@/types";
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
    useSyncStore.setState({ useBackend: false, isOnline: true, authConfig: null, workspaceSessionVerified: false });
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

  it("preserves each account's fallback when another account saves locally", () => {
    const sync = useSyncStore.getState();
    const data = useDataStore.getState();
    const workflow = useWorkflowStore.getState();
    const a = { id: "a-workflow", name: "A", steps: [], createdAt: "", updatedAt: "" };
    const b = { ...a, id: "b-workflow", name: "B" };
    data.addDataset(dataset("a-data"));
    workflow.setWorkflows([a]);

    sync.setAuthUser(userB);
    expect(useDataStore.getState().datasets).toEqual([]);
    expect(useWorkflowStore.getState().workflows).toEqual([]);
    data.addDataset(dataset("b-data"));
    workflow.setWorkflows([b]);

    sync.setAuthUser(userA);
    expect(useDataStore.getState().datasets.map((d) => d.id)).toEqual(["a-data"]);
    expect(useWorkflowStore.getState().workflows).toEqual([a]);
    sync.setAuthUser(userB);
    expect(useDataStore.getState().datasets.map((d) => d.id)).toEqual(["b-data"]);
    expect(useWorkflowStore.getState().workflows).toEqual([b]);
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

  it("reports failed server saves, persists the audit locally, and reloads a recovered save", async () => {
    const pull = vi.spyOn(api, "getData").mockResolvedValue({ datasets: [dataset("a-data")], workflows: [] });
    const save = vi.spyOn(api, "saveData").mockResolvedValueOnce(false).mockResolvedValueOnce(true);
    useSyncStore.getState().setUseBackend(true);
    stop = startWorkspaceSync();
    await vi.advanceTimersByTimeAsync(0);

    const data = useDataStore.getState();
    data.updateCell(0, 0, "2", "a-data");
    await vi.advanceTimersByTimeAsync(1500);
    expect(useSyncStore.getState().workspaceSaveStatus).toBe("failed");
    const fallback = JSON.parse(localStorage.getItem("quantis_data:user:a")!).state;
    expect(fallback.datasets[0].audit.entries).toHaveLength(1);
    expect(fallback).not.toHaveProperty("historyByDataset");
    expect(useSyncStore.getState().localSaveFailures.datasets).toBe(false);

    data.updateCell(0, 0, "3", "a-data");
    await vi.advanceTimersByTimeAsync(1500);
    expect(useSyncStore.getState().workspaceSaveStatus).toBe("saved");
    const remote = JSON.parse(JSON.stringify(save.mock.calls[1][0]));
    expect(Object.keys(remote)).toEqual(["datasets", "workflows"]);
    expect(remote.datasets[0].audit.entries).toHaveLength(2);
    expect(remote.datasets[0].data[1][0]).toBe("3");
    expect(JSON.parse(localStorage.getItem("quantis_data:user:a")!).state.datasets).toEqual([]);

    stop();
    data.hydrateFromServer([]);
    pull.mockResolvedValue(remote);
    stop = startWorkspaceSync();
    await vi.advanceTimersByTimeAsync(0);
    expect(useDataStore.getState().datasets[0].audit).toEqual(remote.datasets[0].audit);
    expect(data.undoDataset("a-data")).toBe(false);
  });

  it("serializes saves so an older result cannot overtake a newer edit", async () => {
    vi.spyOn(api, "getData").mockResolvedValue({ datasets: [dataset("a-data")], workflows: [] });
    const first = deferred<boolean>();
    const save = vi.spyOn(api, "saveData").mockReturnValueOnce(first.promise).mockResolvedValue(true);
    useSyncStore.getState().setUseBackend(true);
    stop = startWorkspaceSync();
    await vi.advanceTimersByTimeAsync(0);
    const data = useDataStore.getState();
    data.updateCell(0, 0, "2", "a-data");
    await vi.advanceTimersByTimeAsync(1500);
    data.updateCell(0, 0, "3", "a-data");
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).toHaveBeenCalledOnce();
    first.resolve(true);
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[1][0].datasets[0].data?.[1][0]).toBe("3");
  });

  it("keeps offline edits cached until the reconnect save succeeds", async () => {
    vi.spyOn(api, "getData").mockResolvedValue({ datasets: [dataset("a-data")], workflows: [] });
    const pending = deferred<boolean>();
    const save = vi.spyOn(api, "saveData").mockReturnValue(pending.promise);
    const sync = useSyncStore.getState();
    sync.setUseBackend(true);
    stop = startWorkspaceSync();
    await vi.advanceTimersByTimeAsync(0);

    const data = useDataStore.getState();
    sync.setIsOnline(false);
    sync.setUseBackend(false);
    data.updateCell(0, 0, "offline edit", "a-data");
    sync.setIsOnline(true);
    sync.setUseBackend(true);
    data.setSelectedDatasetId("a-data");
    const cached = () => JSON.parse(localStorage.getItem("quantis_data:user:a")!).state.datasets;
    expect(cached()[0]?.data[1][0]).toBe("offline edit");
    await vi.advanceTimersByTimeAsync(1500);
    expect(save.mock.calls[0]?.[0].datasets[0].data?.[1][0]).toBe("offline edit");
    pending.resolve(true);
    await vi.advanceTimersByTimeAsync(0);
    expect(cached()).toEqual([]);
  });

  it("restores pending edits and deletions after a reload and keeps unrelated server items", async () => {
    const workflow: Workflow = { id: "deleted", name: "Deleted", steps: [], createdAt: "", updatedAt: "" };
    const remote = { datasets: [dataset("a-data")], workflows: [workflow] };
    const pull = vi.spyOn(api, "getData").mockResolvedValue(remote);
    const save = vi.spyOn(api, "saveData").mockResolvedValue(true);
    const sync = useSyncStore.getState();
    sync.setUseBackend(true);
    stop = startWorkspaceSync();
    await vi.advanceTimersByTimeAsync(0);

    sync.setIsOnline(false);
    useDataStore.getState().updateCell(0, 0, "offline edit", "a-data");
    useWorkflowStore.getState().removeWorkflow(workflow.id);
    stop();

    sync.setAuthUser(null);
    sync.setAuthUser(userA);
    pull.mockResolvedValue({
      datasets: [...remote.datasets, dataset("remote-only")],
      workflows: [...remote.workflows, { ...workflow, id: "remote-only" }],
    });
    stop = startWorkspaceSync();
    sync.setIsOnline(true);
    await vi.advanceTimersByTimeAsync(1500);

    expect(save).toHaveBeenCalledOnce();
    const sent = save.mock.calls[0][0];
    expect(sent.datasets.map((d) => d.id)).toEqual(["a-data", "remote-only"]);
    expect(sent.datasets[0].data?.[1][0]).toBe("offline edit");
    expect(sent.datasets[0].audit?.entries).toHaveLength(1);
    expect(sent.workflows.map((w) => w.id)).toEqual(["remote-only"]);
    expect(JSON.parse(localStorage.getItem("quantis_data:user:a")!).state.pendingChanges).toEqual({});
  });

  it("keeps a partial offline workspace local until the first pull succeeds", async () => {
    const pull = vi.spyOn(api, "getData").mockResolvedValueOnce(null)
      .mockResolvedValue({ datasets: [dataset("remote")], workflows: [] });
    const save = vi.spyOn(api, "saveData").mockResolvedValue(true);
    const sync = useSyncStore.getState();
    sync.setIsOnline(false);
    stop = startWorkspaceSync();
    useDataStore.getState().addDataset(dataset("offline"));

    sync.setIsOnline(true);
    sync.setUseBackend(true);
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).not.toHaveBeenCalled();
    expect(useSyncStore.getState().workspaceSaveStatus).toBe("failed");
    expect(JSON.parse(localStorage.getItem("quantis_data:user:a")!).state.pendingChanges).toEqual({ offline: "edit" });

    sync.setIsOnline(false);
    sync.setIsOnline(true);
    await vi.advanceTimersByTimeAsync(1500);
    expect(pull).toHaveBeenCalledTimes(2);
    expect(save.mock.calls[0]?.[0].datasets.map((d) => d.id)).toEqual(["remote", "offline"]);
  });

  it("recovers legacy cached items without overwriting a newer server copy", async () => {
    const sync = useSyncStore.getState();
    sync.setAuthUser(null);
    localStorage.setItem("quantis_data:user:a", JSON.stringify({
      state: { datasets: [dataset("offline-only"), { ...dataset("shared"), updatedAt: "2026-11-09T00:00:00Z" }] },
      version: 0,
    }));
    sync.setAuthUser(userA);
    const serverCopy = { ...dataset("shared"), updatedAt: "2026-11-10T00:00:00Z" };
    vi.spyOn(api, "getData").mockResolvedValue({ datasets: [serverCopy], workflows: [] });
    const save = vi.spyOn(api, "saveData").mockResolvedValue(true);
    sync.setUseBackend(true);
    stop = startWorkspaceSync();
    await vi.advanceTimersByTimeAsync(1500);

    expect(save).toHaveBeenCalledOnce();
    expect(save.mock.calls[0][0].datasets.map((d) => d.id)).toEqual(["shared", "offline-only"]);
    expect(save.mock.calls[0][0].datasets[0]).toBe(serverCopy);
  });

  it("waits for standalone session verification and keeps a signed-out owner's pending edits separate", async () => {
    vi.mocked(api.isPortalEmbed).mockReturnValue(false);
    vi.spyOn(api, "getData").mockResolvedValue({ datasets: [dataset("a-data")], workflows: [] });
    const save = vi.spyOn(api, "saveData").mockResolvedValue(true);
    const sync = useSyncStore.getState();
    sync.setAuthConfig({ authEnabled: true, authRequired: false, ssoEnabled: false, ssoLabel: "" });
    sync.setUseBackend(true);
    useSyncStore.setState({ workspaceSessionVerified: true });
    stop = startWorkspaceSync();
    await vi.advanceTimersByTimeAsync(0);

    sync.setIsOnline(false);
    sync.setUseBackend(false);
    useDataStore.getState().updateCell(0, 0, "private offline edit", "a-data");
    sync.setIsOnline(true);
    sync.setUseBackend(true);
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).not.toHaveBeenCalled();

    sync.setAuthUser(null);
    useSyncStore.setState({ workspaceSessionVerified: true });
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).not.toHaveBeenCalled();
    const cached = JSON.parse(localStorage.getItem("quantis_data:user:a")!).state;
    expect(cached.datasets[0].data[1][0]).toBe("private offline edit");
  });

  it("ignores an in-flight save result after the Portal owner changes", async () => {
    const pull = vi.spyOn(api, "getData").mockResolvedValue({ datasets: [dataset("a-data")], workflows: [] });
    const pending = deferred<boolean>();
    const save = vi.spyOn(api, "saveData").mockReturnValueOnce(pending.promise);
    const auth = useSyncStore.getState();
    auth.setUseBackend(true);
    stop = startWorkspaceSync();
    await vi.advanceTimersByTimeAsync(0);
    useDataStore.getState().updateCell(0, 0, "2", "a-data");
    await vi.advanceTimersByTimeAsync(1500);
    expect(save).toHaveBeenCalledOnce();

    pull.mockResolvedValue({ datasets: [dataset("b-data")], workflows: [] });
    auth.setAuthUser(userB);
    await vi.advanceTimersByTimeAsync(0);
    pending.resolve(false);
    await vi.advanceTimersByTimeAsync(0);
    expect(useSyncStore.getState().workspaceSaveStatus).toBe("idle");
    expect(useSyncStore.getState().useBackend).toBe(true);
    expect(useDataStore.getState().datasets[0]).toMatchObject({ id: "b-data" });
    expect(useDataStore.getState().datasets[0].audit).toBeUndefined();
  });
});
