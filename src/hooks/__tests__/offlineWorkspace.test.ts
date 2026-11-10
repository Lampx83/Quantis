import { afterEach, expect, it, vi } from "vitest";
import type { Dataset, Workflow } from "@/types";

vi.mock(import("@/api"), async (importOriginal) => ({
  ...await importOriginal(),
  isPortalEmbed: () => false,
}));

const account = { id: "a", email: "a@example.test" };
const dataset: Dataset = {
  id: "a-data", name: "Dataset", rows: 1, columns: 1, columnNames: ["X"],
  data: [["X"], ["1"]], preview: [["X"], ["1"]], sourceFormat: "csv", createdAt: "", updatedAt: "",
};
const workflow: Workflow = {
  id: "a-workflow", name: "Workflow", steps: [], createdAt: "", updatedAt: "",
};

afterEach(() => vi.unstubAllGlobals());

it.each([
  ["another account signs in", { id: "b", email: "b@example.test" }],
  ["the account signs out", null],
] as const)("restores the offline workspace until %s", async (_event, nextUser) => {
  const storage = new Map<string, string>();
  vi.stubGlobal("localStorage", {
    getItem: (key: string) => storage.get(key) ?? null,
    setItem: (key: string, value: string) => storage.set(key, value),
    removeItem: (key: string) => storage.delete(key),
  });
  vi.resetModules();
  const original = await import("@/stores");
  original.useSyncStore.getState().setAuthUser(account);
  original.useSyncStore.getState().setIsOnline(false);
  original.useDataStore.getState().addDataset(dataset);
  original.useWorkflowStore.getState().setWorkflows([workflow]);

  vi.resetModules();
  const { useSyncStore, useDataStore, useWorkflowStore, canSyncToServer } = await import("@/stores");
  useSyncStore.getState().setUseBackend(false);

  expect(useDataStore.getState().datasets.map((item) => item.id)).toEqual([dataset.id]);
  expect(useWorkflowStore.getState().workflows).toEqual([workflow]);
  expect(useSyncStore.getState().authUser).toBeNull();

  useSyncStore.getState().setIsOnline(true);
  useSyncStore.getState().setUseBackend(true);
  expect(canSyncToServer(useSyncStore.getState())).toBe(false);

  useSyncStore.getState().setAuthUser(nextUser);
  expect(useDataStore.getState().datasets).toEqual([]);
  expect(useWorkflowStore.getState().workflows).toEqual([]);

  vi.resetModules();
  const restarted = await import("@/stores");
  restarted.useSyncStore.getState().setUseBackend(false);
  expect(restarted.useDataStore.getState().datasets).toEqual([]);
  expect(restarted.useWorkflowStore.getState().workflows).toEqual([]);
});
