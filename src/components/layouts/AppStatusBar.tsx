import React from "react";
import { PanelLeftClose, PanelLeftOpen, User } from "lucide-react";
import { useUIStore, useDataStore, useWorkflowStore, useSyncStore } from "@/stores";
import * as quantisApi from "@/api";
import { t } from "@/i18n";

export function AppStatusBar() {
  const {
    sidebarOpen,
    setSidebarOpen,
    setShowAccountDialog,
    setLoginModalInitialTab,
    setShowLoginModal,
  } = useUIStore();

  const { datasets, selectedDatasetId } = useDataStore();
  const { workflows, selectedWorkflowId, selectedWorkflowStepId } = useWorkflowStore();
  const { useBackend, authConfig, authUser, authLoading } = useSyncStore();

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);
  const selectedWorkflow = selectedWorkflowId ? workflows.find((w) => w.id === selectedWorkflowId) : null;
  const selectedStep =
    selectedWorkflow && selectedWorkflowStepId
      ? selectedWorkflow.steps.find((s) => s.id === selectedWorkflowStepId)
      : null;

  return (
    <footer className="sticky bottom-0 z-40 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-200 bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/90 dark:text-neutral-300 sm:px-3 sm:text-xs pb-[max(0.375rem,env(safe-area-inset-bottom,0px))]">
      <button
        type="button"
        onClick={() => setSidebarOpen((o) => !o)}
        className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md p-1.5 text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700 touch-manipulation sm:min-h-0 sm:min-w-0 sm:p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
        title={sidebarOpen ? t("app.collapseSidebar") : t("app.openSidebar")}
        aria-label={sidebarOpen ? t("app.collapseSidebar") : t("app.openSidebar")}
      >
        {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
      </button>
      <span
        className="min-w-0 flex-1 truncate text-left"
        title={
          selectedDataset
            ? `${selectedDataset.name} (${selectedDataset.rows}×${selectedDataset.columns})`
            : t("app.selectOrImportDataset")
        }
      >
        {selectedDataset ? (
          <>
            Dataset: <strong className="font-medium text-neutral-700 dark:text-neutral-300">{selectedDataset.name}</strong>{" "}
            ({selectedDataset.rows}×{selectedDataset.columns})
            {selectedWorkflow ? (
              <>
                {" "}· Workflow: {selectedWorkflow.name}
                {selectedStep ? ` · ${selectedStep.label}` : ""}
              </>
            ) : (
              ""
            )}{" "}
            · {datasets.length} {t("app.datasetsCountSuffix")}
          </>
        ) : (
          <>
            {t("app.noDatasetSelected")}
            {selectedWorkflow ? (
              <>
                {" "}· Workflow: {selectedWorkflow.name}
                {selectedStep ? ` · ${selectedStep.label}` : ""}
              </>
            ) : (
              ""
            )}{" "}
            · {datasets.length} {t("app.datasetsCountSuffix")}
          </>
        )}
      </span>
      <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1.5 border-l border-neutral-200 pl-2 dark:border-neutral-600 sm:gap-2">
        {quantisApi.isPortalEmbed() && authLoading && !authUser && (
          <span className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap truncate">
            {t("app.loadingEllipsis")}
          </span>
        )}
        {authUser && (
          <button
            type="button"
            onClick={() => setShowAccountDialog(true)}
            className="flex items-center gap-1.5 min-h-[36px] max-w-full rounded-md px-2 py-1 text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
            title={authUser.name || authUser.email || t("app.account")}
            aria-label={`${t("app.account")}: ${authUser.name || authUser.email || ""}`}
          >
            <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-brand" />
            <span className="truncate font-medium text-[10px] sm:text-xs">
              {authUser.name || authUser.email || t("app.account")}
            </span>
          </button>
        )}
        {!quantisApi.isPortalEmbed() &&
          authConfig?.authEnabled &&
          authConfig.authRequired === false &&
          !authUser &&
          useBackend && (
            <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
              <button
                type="button"
                onClick={() => {
                  setLoginModalInitialTab("login");
                  setShowLoginModal(true);
                }}
                className="rounded px-1.5 py-1 text-[10px] sm:text-xs font-medium text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {t("app.login")}
              </button>
              <span className="text-neutral-400" aria-hidden>
                ·
              </span>
              <button
                type="button"
                onClick={() => {
                  setLoginModalInitialTab("register");
                  setShowLoginModal(true);
                }}
                className="rounded px-1.5 py-1 text-[10px] sm:text-xs font-medium text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {t("app.register")}
              </button>
            </div>
          )}
      </div>
    </footer>
  );
}
