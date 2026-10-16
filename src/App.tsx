import React, { useEffect } from "react";
import { Loader2 } from "lucide-react";
import { getPortalTheme } from "./portal-theme";
import { AppHeader, AppSidebar, AppStatusBar, MainContent } from "@/components/layouts";
import { AppModals } from "@/components/modals";
import { useURLSync, useAuthSession, useServerSync } from "@/hooks";
import {
  useDataStore,
  useWorkflowStore,
  useUIStore,
  useSyncStore,
} from "@/stores";
import * as quantisApi from "./api";
import { QuantAuthGate } from "./auth-ui";
import { t } from "./i18n";

export default function App() {
  const { datasets, selectedDatasetId, setSelectedDatasetId } = useDataStore();
  const { workflows, selectedWorkflowId, setSelectedWorkflowId } = useWorkflowStore();
  const { setIsMobileLayout, setSidebarOpen, setTheme } = useUIStore();
  const {
    useBackend,
    authConfig,
    authUser,
    setAuthUser,
    authLoading,
    setIsOnline,
    workspacePullLoading,
  } = useSyncStore();

  // Custom lifecycle & synchronization hooks
  useURLSync();
  useAuthSession();
  useServerSync();

  // Online / offline network status
  useEffect(() => {
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, [setIsOnline]);

  // Responsive layout listener
  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onViewport = () => {
      const narrow = mq.matches;
      setIsMobileLayout(narrow);
      if (narrow) setSidebarOpen(false);
    };
    mq.addEventListener("change", onViewport);
    return () => mq.removeEventListener("change", onViewport);
  }, [setIsMobileLayout, setSidebarOpen]);

  // Select initial workflow if none selected
  useEffect(() => {
    if (workflows.length > 0 && !selectedWorkflowId) setSelectedWorkflowId(workflows[0].id);
  }, [workflows, selectedWorkflowId, setSelectedWorkflowId]);

  // Clear dataset selection if it no longer exists
  useEffect(() => {
    // Danh sách rỗng = chưa nạp xong (đang kéo workspace từ server) → giữ lựa chọn đã lưu, đừng xoá.
    if (datasets.length > 0 && selectedDatasetId && !datasets.some((d) => d.id === selectedDatasetId)) {
      setSelectedDatasetId(null);
    }
  }, [datasets, selectedDatasetId, setSelectedDatasetId]);

  // Portal theme sync via storage & message events
  useEffect(() => {
    const sync = () => setTheme(getPortalTheme());
    window.addEventListener("storage", sync);
    window.addEventListener("message", (e: MessageEvent) => {
      const d = e.data as { type?: string } | null;
      if (d?.type === "portal-theme") sync();
    });
    return () => {
      window.removeEventListener("storage", sync);
    };
  }, [setTheme]);

  if (useBackend && authLoading) {
    return (
      <div className="min-h-dvh bg-neutral-100 dark:bg-neutral-900 flex flex-col items-center justify-center gap-3 text-neutral-600 dark:text-neutral-400 px-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand" />
        <p className="text-sm">{t("app.connecting")}</p>
      </div>
    );
  }

  if (
    !quantisApi.isPortalEmbed() &&
    authConfig &&
    authConfig.authEnabled &&
    authConfig.authRequired !== false &&
    authUser === null &&
    !authLoading
  ) {
    return (
      <QuantAuthGate
        config={authConfig}
        onSuccess={setAuthUser}
        ssoUrl={quantisApi.getSsoLoginUrl()}
      />
    );
  }

  return (
    <div className="flex flex-col h-dvh min-h-0 max-h-dvh overflow-hidden bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
      <AppHeader />

      {workspacePullLoading && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-xs sm:text-sm border-b border-brand/25 bg-brand/10 text-brand dark:bg-brand/15 dark:text-brand-200"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
          <span>{t("app.loadingWorkspaceFromServer")}</span>
        </div>
      )}

      <div className="flex flex-1 min-h-0 min-w-0">
        <AppSidebar />
        <MainContent />
      </div>

      <AppStatusBar />
      <AppModals />
    </div>
  );
}
