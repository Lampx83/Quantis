import React from "react";
import { Loader2, Copy } from "lucide-react";
import {
  useUIStore,
  useSyncStore,
  useDataStore,
  useWorkflowStore,
  useAnalysisStore,
} from "@/stores";
import * as quantisApi from "@/api";
import { QuantLoginModal } from "@/auth-ui";
import { clearQuantisLocalAppData, setServerSettings, getServerSettings } from "@/utils/storage";
import { SettingsModal } from "./SettingsModal";
import { GuideModal } from "./GuideModal";
import { AppFeedbackModal } from "./AppFeedbackModal";
import { AccountModal } from "./AccountModal";
import { ConfirmDialog } from "./ConfirmDialog";
import { DemoGalleryModal } from "./DemoGalleryModal";
import { SampleDatasetModal } from "./SampleDatasetModal";
import { ArchiveModal } from "./ArchiveModal";
import { t } from "@/i18n";

export function AppModals() {
  const {
    showSettings,
    setShowSettings,
    guideOpen,
    setGuideOpen,
    showAppFeedbackModal,
    setShowAppFeedbackModal,
    showLoginModal,
    setShowLoginModal,
    loginModalInitialTab,
    setLoginModalInitialTab,
    setConfirmDialog,
    toast,
    showToast,
    setMainSection,
    setReproTab,
  } = useUIStore();

  const {
    useBackend,
    setUseBackend,
    authConfig,
    authUser,
    setAuthUser,
    authLoading,
    analysisBackendAvailable,
    setAnalysisBackendAvailable,
    sidebarImportBusy,
  } = useSyncStore();

  const { setDatasets, setSelectedDatasetId } = useDataStore();
  const { setWorkflows, setSelectedWorkflowId, setSelectedWorkflowStepId } = useWorkflowStore();
  const {
    setDescriptiveBackendResult,
    setCorrelationBackendResult,
    setLastHypothesisResult,
  } = useAnalysisStore();

  const handleRequestFactoryReset = () => {
    setShowSettings(false);
    setConfirmDialog({
      message: t("app.confirmFactoryReset"),
      onConfirm: () => {
        setConfirmDialog(null);
        clearQuantisLocalAppData();
        setServerSettings(null);
        setDatasets([]);
        setWorkflows([]);
        setSelectedDatasetId(null);
        setSelectedWorkflowId(null);
        setSelectedWorkflowStepId(null);
        setDescriptiveBackendResult(null);
        setCorrelationBackendResult(null);
        setLastHypothesisResult(null);
        void (async () => {
          const hasBackend = Boolean(quantisApi.getApiBase()?.trim());
          const online = typeof navigator !== "undefined" && navigator.onLine;
          if (hasBackend && online) {
            const ok = await quantisApi.saveData({ datasets: [], workflows: [] });
            if (!ok) showToast(t("app.toastResetLocalOnlyServerFailed"));
            else showToast(t("app.toastResetAppLocalAndServer"));
          } else {
            showToast(t("app.toastResetAppLocalOnly"));
          }
          quantisApi.checkBackendAvailable().then(setUseBackend);
          quantisApi.checkAnalysisBackendAvailable().then(setAnalysisBackendAvailable);
        })();
      },
    });
  };

  return (
    <>
      {sidebarImportBusy && (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/35 backdrop-blur-[2px] p-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-5 py-4 shadow-xl max-w-sm">
            <Loader2 className="w-8 h-8 shrink-0 animate-spin text-brand" aria-hidden />
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">{t("app.readingFileOnServer")}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t("app.readingFileOnServerDesc")}
              </p>
            </div>
          </div>
        </div>
      )}

      {showLoginModal && authConfig && !quantisApi.isPortalEmbed() && (
        <QuantLoginModal
          config={authConfig}
          ssoUrl={quantisApi.getSsoLoginUrl()}
          initialTab={loginModalInitialTab}
          onSuccess={setAuthUser}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      <AccountModal />
      <ConfirmDialog />
      <DemoGalleryModal />
      <SampleDatasetModal />
      <ArchiveModal />

      {guideOpen && (
        <GuideModal
          onClose={() => setGuideOpen(false)}
          onOpenSettings={() => {
            setGuideOpen(false);
            setShowSettings(true);
          }}
          onGoRepro={(sub) => {
            setGuideOpen(false);
            setMainSection("reproducibility");
            setReproTab(sub ?? "workflows");
          }}
        />
      )}

      {showSettings && (
        <SettingsModal
          ollamaUpstreamServer={getServerSettings()?.ollamaUpstreamUrl}
          onFactoryResetRequest={handleRequestFactoryReset}
          accountAuthHint={
            useBackend && authLoading
              ? { state: "loading" }
              : quantisApi.isPortalEmbed()
              ? { state: "portal" }
              : !useBackend
              ? { state: "no-backend" }
              : !authConfig
              ? { state: "config-unavailable" }
              : !authConfig.authEnabled
              ? { state: "disabled" }
              : authConfig.authRequired === false
              ? { state: "optional" }
              : { state: "required" }
          }
          authUser={authUser}
          onRequestLogin={() => {
            setShowSettings(false);
            setLoginModalInitialTab("login");
            setShowLoginModal(true);
          }}
          onClose={() => {
            setShowSettings(false);
            quantisApi.checkBackendAvailable().then(setUseBackend);
            quantisApi.checkAnalysisBackendAvailable().then(setAnalysisBackendAvailable);
          }}
        />
      )}

      {showAppFeedbackModal && <AppFeedbackModal onClose={() => setShowAppFeedbackModal(false)} />}

      {toast && (
        <div className="fixed z-50 rounded-lg bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 px-3 sm:px-4 py-2 shadow-lg text-sm flex items-center gap-2 max-w-[calc(100vw-1.5rem)] left-3 right-3 sm:left-auto sm:right-4 bottom-[max(1rem,env(safe-area-inset-bottom,0px))] sm:bottom-4 sm:max-w-md">
          <Copy className="w-4 h-4" />
          {toast}
        </div>
      )}
    </>
  );
}
