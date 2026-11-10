import { afterEach, expect, it, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import * as api from "@/api";
import { useSyncStore } from "@/stores";
import { useServerSync } from "../useServerSync";
import { useAuthSession } from "../useAuthSession";

const { effects } = vi.hoisted(() => ({ effects: [] as (() => void | (() => void))[] }));
vi.mock("react", async (importOriginal) => ({
  ...await importOriginal<typeof import("react")>(),
  useEffect: (effect: () => void | (() => void)) => { effects.push(effect); },
}));
vi.mock("@/stores", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/stores")>();
  return {
    ...actual,
    useSyncStore: Object.assign(() => actual.useSyncStore.getState(), actual.useSyncStore),
  };
});

afterEach(() => {
  effects.length = 0;
  vi.restoreAllMocks();
});

it("disables an active backend offline and probes again on reconnect", async () => {
  vi.spyOn(api, "checkBackendAvailable").mockResolvedValue(true);
  vi.spyOn(api, "checkAnalysisBackendAvailable").mockResolvedValue(false);
  vi.spyOn(api, "getApiBase").mockReturnValue("");
  vi.spyOn(api, "getData").mockResolvedValue(null);
  useSyncStore.setState({ useBackend: true, isOnline: true });

  function Harness() {
    useServerSync();
    return null;
  }
  async function renderEffects() {
    renderToStaticMarkup(<Harness />);
    const cleanups = effects.splice(0).map((effect) => effect());
    await Promise.resolve();
    return () => cleanups.forEach((cleanup) => cleanup?.());
  }

  let cleanup = await renderEffects();
  expect(useSyncStore.getState().useBackend).toBe(true);
  expect(api.checkBackendAvailable).not.toHaveBeenCalled();
  cleanup();
  useSyncStore.getState().setIsOnline(false);
  cleanup = await renderEffects();
  expect(useSyncStore.getState().useBackend).toBe(false);
  expect(api.checkBackendAvailable).not.toHaveBeenCalled();
  cleanup();
  useSyncStore.getState().setIsOnline(true);
  cleanup = await renderEffects();
  expect(useSyncStore.getState().useBackend).toBe(true);
  expect(api.checkBackendAvailable).toHaveBeenCalledOnce();
  cleanup();
});

it("verifies the standalone owner only after the session request settles", async () => {
  vi.spyOn(api, "isPortalEmbed").mockReturnValue(false);
  vi.spyOn(api, "checkAdminStatus").mockResolvedValue(false);
  vi.spyOn(api, "getAuthConfig").mockResolvedValue({
    authEnabled: true, authRequired: false, ssoEnabled: false, ssoLabel: "",
  });
  let resolve!: (user: api.AuthUser | null) => void;
  const session = new Promise<api.AuthUser | null>((done) => { resolve = done; });
  vi.spyOn(api, "getAuthMe").mockReturnValue(session);
  useSyncStore.setState({ isOnline: true, useBackend: true, authConfig: null, workspaceSessionVerified: false });
  useSyncStore.getState().setAuthUser({ id: "a", email: "a@example.test" });

  function Harness() {
    useAuthSession();
    return null;
  }
  renderToStaticMarkup(<Harness />);
  const cleanups = effects.splice(0).map((effect) => effect());
  try {
    expect(useSyncStore.getState().workspaceSessionVerified).toBe(false);
    resolve(null);
    await session;
    await Promise.resolve();
    expect(useSyncStore.getState().authUser).toBeNull();
    expect(useSyncStore.getState().workspaceSessionVerified).toBe(true);
  } finally {
    cleanups.forEach((cleanup) => cleanup?.());
  }
});
