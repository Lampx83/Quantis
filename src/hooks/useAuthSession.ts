import { useEffect } from "react";
import { useSyncStore } from "@/stores";
import * as quantisApi from "@/api";

export function useAuthSession() {
  const {
    useBackend,
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
    if (!useBackend) {
      setAuthLoading(false);
      return;
    }
    const portalUser = quantisApi.isPortalEmbed() ? quantisApi.getPortalUserFromWindow() : null;
    if (portalUser) {
      setAuthUser(portalUser);
      quantisApi
        .getAuthConfig()
        .then((c) => setAuthConfig(c ?? null))
        .finally(() => setAuthLoading(false));
      return;
    }
    let cancelled = false;
    Promise.all([quantisApi.getAuthConfig(), quantisApi.getAuthMe()])
      .then(([config, user]) => {
        if (cancelled) return;
        setAuthConfig(config ?? null);
        if (quantisApi.isPortalEmbed()) {
          const fromWindow = quantisApi.getPortalUserFromWindow();
          const realUser = user && (user.email !== "guest@local" || user.name !== "Guest") ? user : null;
          const u = fromWindow ?? realUser;
          if (u) setAuthUser(u);
        } else {
          setAuthUser(user ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [useBackend, embedConfigGeneration, setAuthConfig, setAuthUser, setAuthLoading]);

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
        quantisApi.getAuthMe().then((user) => {
          if (!user) setAuthUser(null);
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [authConfig?.authEnabled, authUser, setAuthUser]);
}
