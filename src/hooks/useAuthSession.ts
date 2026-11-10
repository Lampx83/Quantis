import { useEffect } from "react";
import { useSyncStore } from "@/stores";
import * as quantisApi from "@/api";

export function useAuthSession() {
  const {
    useBackend,
    isOnline,
    embedConfigGeneration,
    authConfig,
    setAuthConfig,
    authUser,
    setAuthUser,
    setAuthLoading,
    setIsPortalAdmin,
  } = useSyncStore();

  // Kiểm tra cờ admin mỗi khi authUser hoặc embedConfigGeneration thay đổi
  useEffect(() => {
    quantisApi.checkAdminStatus().then(setIsPortalAdmin);
  }, [authUser, embedConfigGeneration, setIsPortalAdmin]);

  // Auth: cấu hình + phiên khi có backend; Portal embed: __PORTAL_USER__ hoặc postMessage
  useEffect(() => {
    if (!useBackend || !isOnline) {
      setAuthLoading(false);
      return;
    }
    const portal = quantisApi.isPortalEmbed();
    const auth = useSyncStore.getState();
    let ownerEpoch = auth.workspaceEpoch;
    let cancelled = false;
    const current = () => {
      const state = useSyncStore.getState();
      return !cancelled && state.isOnline && state.useBackend && state.workspaceEpoch === ownerEpoch;
    };
    const portalUser = portal ? auth.authUser ?? (ownerEpoch === 0 ? quantisApi.getPortalUserFromWindow() : null) : null;
    if (portalUser) {
      setAuthUser(portalUser);
      ownerEpoch = useSyncStore.getState().workspaceEpoch;
      quantisApi
        .getAuthConfig()
        .then((c) => { if (current()) setAuthConfig(c ?? null); })
        .finally(() => setAuthLoading(false));
      return () => { cancelled = true; };
    }
    Promise.all([quantisApi.getAuthConfig(), quantisApi.getAuthMe()])
      .then(([config, user]) => {
        if (!current()) return;
        setAuthConfig(config ?? null);
        if (portal) {
          const fromWindow = quantisApi.getPortalUserFromWindow();
          const realUser = user && (user.email !== "guest@local" || user.name !== "Guest") ? user : null;
          const u = fromWindow ?? realUser;
          if (u) setAuthUser(u);
        } else if (user !== undefined) {
          setAuthUser(user);
          useSyncStore.setState({ workspaceSessionVerified: !!config || !!user });
        }
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [useBackend, isOnline, embedConfigGeneration, setAuthConfig, setAuthUser, setAuthLoading]);

  // Iframe (AI Portal): xin user và nhận PORTAL_USER
  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window;
    if (win.parent === win) return;
    const requestUser = () => {
      win.parent.postMessage({ type: "QUANTIS_NEED_PORTAL_USER" }, "*");
      win.parent.postMessage({ type: "SURVEYLAB_NEED_PORTAL_USER" }, "*");
    };
    requestUser();
    const t0 = setTimeout(requestUser, 400);
    const t1 = setTimeout(requestUser, 1000);
    const t2 = setTimeout(requestUser, 2500);
    const onMessage = (e: MessageEvent) => {
      if (e.source !== win.parent && e.source !== win.top) return;
      const d = e.data as { type?: string; user?: { id?: string; email?: string; name?: string; isAdmin?: boolean } } | null;
      if (d?.type !== "PORTAL_USER" || !d?.user || typeof d.user.id !== "string") return;
      setAuthUser({
        id: d.user.id.trim(),
        email: typeof d.user.email === "string" ? d.user.email : "",
        name: typeof d.user.name === "string" ? d.user.name : d.user.email ?? "",
        isAdmin: Boolean(d.user.isAdmin),
      });
    };
    win.addEventListener("message", onMessage);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      win.removeEventListener("message", onMessage);
    };
  }, [setAuthUser]);

  // Tab visibility change re-check
  useEffect(() => {
    if (quantisApi.isPortalEmbed() || !authConfig?.authEnabled || !authUser) return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        const epoch = useSyncStore.getState().workspaceEpoch;
        quantisApi.getAuthMe().then((user) => {
          if (user === null && useSyncStore.getState().workspaceEpoch === epoch) setAuthUser(null);
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [authConfig?.authEnabled, authUser, setAuthUser]);
}
