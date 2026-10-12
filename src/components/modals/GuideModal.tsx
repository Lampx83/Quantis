import React, { useState, useEffect } from "react";
import { BookOpen, X, Server, GitBranch, FileText, Settings } from "lucide-react";
import { t } from "@/i18n";
import { useUIStore, type ReproducibilityTab } from "@/stores";

export type GuideHelpTab = "overview" | "ui" | "data" | "analysis" | "sync" | "ai" | "portal";

export const GUIDE_HELP_TABS: { id: GuideHelpTab; label: string }[] = [
  { id: "overview", label: t("guideModal.tabOverview") },
  { id: "ui", label: t("guideModal.tabUi") },
  { id: "data", label: t("guideModal.tabData") },
  { id: "analysis", label: t("guideModal.tabAnalysis") },
  { id: "sync", label: t("guideModal.tabSync") },
  { id: "ai", label: t("guideModal.tabAi") },
  { id: "portal", label: t("guideModal.tabPortal") },
];

export interface GuideModalProps {
  onClose?: () => void;
  onOpenSettings?: () => void;
  onGoRepro?: (sub?: ReproducibilityTab) => void;
}

export function GuideModal({
  onClose,
  onOpenSettings,
  onGoRepro,
}: GuideModalProps) {
  const [helpTab, setHelpTab] = useState<GuideHelpTab>("overview");

  const close = onClose ?? (() => useUIStore.getState().setGuideOpen(false));
  const openSettings =
    onOpenSettings ??
    (() => {
      useUIStore.getState().setGuideOpen(false);
      useUIStore.getState().setShowSettings(true);
    });
  const goRepro =
    onGoRepro ??
    ((sub) => {
      useUIStore.getState().setGuideOpen(false);
      useUIStore.getState().setMainSection("reproducibility");
      useUIStore.getState().setReproTab(sub ?? "workflows");
    });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") close();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [close]);

  return (
    <div
      className="fixed inset-0 z-[220] flex items-center justify-center bg-black/50 p-3 sm:p-4"
      onClick={close}
      role="presentation"
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-2xl w-full flex flex-col max-h-[min(90dvh,44rem)] overflow-hidden border border-neutral-200/80 dark:border-neutral-700"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="quantis-help-title"
      >
        <div className="flex items-center justify-between p-3 sm:p-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0 gap-2">
          <h3 id="quantis-help-title" className="text-base sm:text-lg font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2 min-w-0">
            <BookOpen className="w-5 h-5 text-brand shrink-0" />
            <span className="truncate">{t("guideModal.title")}</span>
          </h3>
          <button type="button" onClick={close} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 shrink-0" aria-label={t("app.close")}>
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="shrink-0 border-b border-neutral-200 dark:border-neutral-700 px-2 sm:px-3 py-2 bg-neutral-50/90 dark:bg-neutral-900/50">
          <div className="flex gap-1 overflow-x-auto pb-1 [scrollbar-width:thin] snap-x">
            {GUIDE_HELP_TABS.map((gt) => (
              <button
                key={gt.id}
                type="button"
                onClick={() => setHelpTab(gt.id)}
                className={`snap-start shrink-0 rounded-lg px-2.5 py-1.5 text-xs sm:text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900 ${
                  helpTab === gt.id
                    ? "bg-brand text-white"
                    : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80"
                }`}
              >
                {gt.label}
              </button>
            ))}
          </div>
        </div>

        <div className="p-3 sm:p-5 overflow-y-auto text-sm text-neutral-600 dark:text-neutral-400 space-y-4 min-h-0 flex-1">
          {helpTab === "overview" && (
            <>
              <p>
                <strong className="text-neutral-800 dark:text-neutral-200">Quantis</strong> {t("guideModal.overview.introSuffix")}
              </p>
              <div className="flex flex-wrap gap-2">
                <button type="button" onClick={openSettings} className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 dark:bg-brand/20 px-3 py-2 text-sm font-medium text-brand hover:bg-brand/15 dark:hover:bg-brand/30 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <Server className="w-4 h-4 shrink-0" />
                  {t("guideModal.overview.openSettingsButton")}
                </button>
                <button type="button" onClick={() => goRepro("workflows")} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <GitBranch className="w-4 h-4 shrink-0" />
                  {t("guideModal.overview.goWorkflowsButton")}
                </button>
                <button type="button" onClick={() => goRepro("openscience")} className="inline-flex items-center gap-1.5 rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                  <FileText className="w-4 h-4 shrink-0" />
                  {t("openScience.title")}
                </button>
              </div>
              <section className="rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-50/80 dark:bg-neutral-900/40 p-3 text-xs sm:text-sm">
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.overview.suggestedFlowHeading")}</p>
                <ol className="list-decimal pl-4 space-y-1">
                  <li>{t("guideModal.overview.step1Part1")} <strong>Quantis</strong> {t("guideModal.overview.step1Part2")} <strong>{t("guideModal.overview.step1Strong")}</strong> {t("guideModal.overview.step1Part3")}</li>
                  <li>{t("guideModal.overview.step2Part1")} <strong>{t("guideModal.overview.step2Strong")}</strong> {t("guideModal.overview.step2Part2")}</li>
                  <li>{t("guideModal.overview.step3Part1")} <strong>{t("guideModal.tabData")}</strong> {t("guideModal.overview.step3Part2")}</li>
                  <li>{t("guideModal.overview.step4Part1")} <strong>{t("guideModal.tabAnalysis")}</strong> {t("guideModal.overview.step4Part2")}</li>
                  <li>{t("guideModal.overview.step5Part1")} <strong>{t("guideModal.overview.step5Strong1")}</strong> {t("guideModal.overview.step5Mid")} <strong>{t("guideModal.overview.step5Strong2")}</strong> {t("guideModal.overview.step5Part2")}</li>
                </ol>
              </section>
            </>
          )}

          {helpTab === "ui" && (
            <>
              <section>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.ui.headerHeading")}</p>
                <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm">
                  <li><strong>{t("guideModal.ui.item1Strong1")}</strong> {t("guideModal.ui.item1Mid")} <strong>{t("workflowView.title")}</strong> {t("guideModal.ui.item1Suffix")}</li>
                  <li>
                    {t("guideModal.ui.item2Prefix")} <strong>{t("guideModal.ui.item2Strong")}</strong> {t("guideModal.ui.item2Suffix")}
                  </li>
                  <li>{t("guideModal.ui.item3")}</li>
                </ul>
              </section>
              <section>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.ui.sidebarHeading")}</p>
                <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm">
                  <li>{t("guideModal.ui.sidebarItem1Prefix")} {t("guideModal.ui.sidebarItem1Suffix")}</li>
                  <li><strong>{t("guideModal.ui.sidebarItem2Strong")}</strong>{t("guideModal.ui.sidebarItem2Suffix")}</li>
                  <li>{t("guideModal.ui.sidebarItem3")}</li>
                </ul>
              </section>
              <section>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.ui.toolbarHeading")}</p>
                <p className="text-xs sm:text-sm">
                  {t("guideModal.ui.toolbarText")}
                </p>
              </section>
            </>
          )}

          {helpTab === "data" && (
            <>
              <section>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.data.formatsHeading")}</p>
                <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm">
                  <li><strong>{t("guideModal.data.formatsItem1Strong")}</strong> {t("guideModal.data.formatsItem1Suffix")}</li>
                  <li>
                    {t("guideModal.data.formatsItem2")}
                  </li>
                </ul>
              </section>
              <section>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.data.tabHeading")}</p>
                <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm">
                  <li><strong>{t("transformTab.viewDataTabName")}</strong> {t("guideModal.data.tabItem1Suffix")}</li>
                  <li><strong>{t("guideModal.data.tabItem2Strong")}</strong> {t("guideModal.data.tabItem2Suffix")}</li>
                  <li><strong>{t("guideModal.data.tabItem3Strong")}</strong> {t("guideModal.data.tabItem3Suffix")}</li>
                  <li><strong>{t("guideModal.data.tabItem4Strong")}</strong> {t("guideModal.data.tabItem4Suffix")}</li>
                </ul>
              </section>
              <section className="rounded-lg border border-sky-200/80 dark:border-sky-900/40 bg-sky-50/50 dark:bg-sky-950/20 p-3 text-xs sm:text-sm">
                <p className="font-semibold text-sky-900 dark:text-sky-200 mb-1">{t("guideModal.data.syncHeading")}</p>
                <p>{t("guideModal.data.syncText")}</p>
              </section>
            </>
          )}

          {helpTab === "analysis" && (
            <>
              <p className="text-xs sm:text-sm">
                {t("guideModal.analysis.introPrefix")} <strong>{t("guideModal.analysis.introStrong")}</strong>{t("guideModal.analysis.introSuffix")}
              </p>
              <ul className="list-disc pl-4 space-y-1.5 text-xs sm:text-sm">
                <li><strong>{t("app.analysisTab.correlation")}</strong> {t("guideModal.analysis.item1Suffix")}</li>
                <li><strong>{t("app.analysisTab.hypothesis")}</strong> {t("guideModal.analysis.item2Suffix")}</li>
                <li><strong>{t("app.analysisTab.reliability")}</strong> {t("guideModal.analysis.item3Suffix")}</li>
                <li><strong>{t("regressionExplainer.title")}</strong> {t("guideModal.analysis.item4Suffix")}</li>
                <li><strong>{t("guideModal.analysis.item5Strong")}</strong> {t("guideModal.analysis.item5Suffix")}</li>
                <li><strong>{t("analysisView.tabSemTitle")}</strong> {t("guideModal.analysis.item6Suffix")}</li>
                <li><strong>{t("analysisView.tabMlTitle")}</strong> {t("guideModal.analysis.item7Suffix")}</li>
                <li><strong>{t("analysisView.tabBayesianTitle")}</strong> {t("guideModal.analysis.item8Suffix")}</li>
              </ul>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t("guideModal.analysis.processingNote")}
              </p>
            </>
          )}

          {helpTab === "sync" && (
            <>
              <section className="rounded-lg border border-brand/20 bg-brand/5 dark:bg-brand/10 p-3 text-xs sm:text-sm">
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1">{t("guideModal.sync.loginHeading")}</p>
                <p>
                  {t("guideModal.sync.loginText")}
                </p>
              </section>
              <section>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.sync.browserOnlyHeading")}</p>
                <p className="text-xs sm:text-sm">{t("guideModal.sync.browserOnlyText")}</p>
              </section>
              <section>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.sync.standaloneHeading")}</p>
                <p className="text-xs sm:text-sm">
                  {t("guideModal.sync.standaloneText")}
                </p>
              </section>
              <section>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.sync.portalEmbedHeading")}</p>
                <p className="text-xs sm:text-sm">
                  {t("guideModal.sync.portalEmbedText")}
                </p>
              </section>
              <button type="button" onClick={openSettings} className="inline-flex items-center gap-1.5 rounded-lg bg-brand text-white px-3 py-2 text-sm font-medium hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800">
                <Settings className="w-4 h-4 shrink-0" />
                {t("guideModal.sync.resetButton")}
              </button>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t("guideModal.sync.resetNote")}
              </p>
            </>
          )}

          {helpTab === "ai" && (
            <>
              <section>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.ai.tabHeading")}</p>
                <p className="text-xs sm:text-sm">
                  {t("guideModal.ai.tabText")}
                </p>
              </section>
              <section>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.ai.pythonHeading")}</p>
                <p className="text-xs sm:text-sm">
                  {t("guideModal.ai.pythonText")}
                </p>
              </section>
              <section className="rounded-lg border border-amber-200/80 dark:border-amber-900/50 bg-amber-50/60 dark:bg-amber-950/20 p-3 text-xs sm:text-sm">
                <p className="font-semibold text-amber-900 dark:text-amber-200 mb-1">{t("guideModal.ai.timeoutHeading")}</p>
                <p>{t("guideModal.ai.timeoutText")}</p>
              </section>
              <button type="button" onClick={openSettings} className="inline-flex items-center gap-1.5 rounded-lg border border-brand/40 bg-brand/10 dark:bg-brand/20 px-3 py-2 text-sm font-medium text-brand hover:bg-brand/15 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand">
                <Server className="w-4 h-4 shrink-0" />
                {t("guideModal.ai.checkBackendButton")}
              </button>
            </>
          )}

          {helpTab === "portal" && (
            <>
              <section>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.portal.embedHeading")}</p>
                <ul className="list-disc pl-4 space-y-1 text-xs sm:text-sm">
                  <li>{t("guideModal.portal.embedItem1")}</li>
                  <li>{t("guideModal.portal.embedItem2")}</li>
                  <li>{t("guideModal.portal.embedItem3")}</li>
                </ul>
              </section>
              <section>
                <p className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("guideModal.portal.privacyHeading")}</p>
                <p className="text-xs sm:text-sm">{t("guideModal.portal.privacyText")}</p>
              </section>
            </>
          )}
        </div>

        <div className="p-3 sm:p-4 border-t border-neutral-200 dark:border-neutral-700 shrink-0 flex flex-wrap items-center justify-between gap-2 bg-neutral-50/50 dark:bg-neutral-900/30">
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("guideModal.escPrefix")} <kbd className="px-1 py-0.5 rounded bg-neutral-200 dark:bg-neutral-700 text-[0.65rem] font-mono">Esc</kbd> {t("guideModal.escSuffix")}
          </p>
          <button type="button" onClick={close} className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-800">
            {t("app.close")}
          </button>
        </div>
      </div>
    </div>
  );
}
