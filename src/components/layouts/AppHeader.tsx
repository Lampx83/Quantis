import React, { useCallback, useEffect, useMemo, useRef } from "react";
import {
  Sigma,
  Sun,
  Moon,
  User,
  MoreVertical,
  BookOpen,
  Download,
  GitBranch,
  FileText,
  Server,
  ThumbsUp,
  Database,
  BarChart3,
  LineChart as LineChartIcon,
  Sparkles,
} from "lucide-react";
import { useUIStore, useWorkflowStore, useSyncStore } from "@/stores";
import type { WorkflowStep } from "@/types";
import * as quantisApi from "@/api";
import { getDefaultStandardWorkflow } from "@/sample-data";
import { t } from "@/i18n";

export function AppHeader() {
  const {
    mainSection,
    setMainSection,
    setDataTab,
    setAnalysisTab,
    setReproTab,
    setPresentationTab,
    theme,
    toggleTheme,
    headerMenuOpen,
    setHeaderMenuOpen,
    setShowLoginModal,
    setLoginModalInitialTab,
    setShowAccountDialog,
    setGuideOpen,
    setShowDemoGallery,
    setShowSettings,
    setShowAppFeedbackModal,
  } = useUIStore();

  const {
    workflows,
    setWorkflows,
    selectedWorkflowId,
    setSelectedWorkflowId,
    setSelectedWorkflowStepId,
  } = useWorkflowStore();

  const { authConfig, authUser } = useSyncStore();

  const headerMenuRef = useRef<HTMLDivElement>(null);

  const defaultWorkflowForDisplay = useMemo(() => getDefaultStandardWorkflow(), []);
  const selectedWorkflow = selectedWorkflowId ? workflows.find((w) => w.id === selectedWorkflowId) : null;
  const workflowToShow = selectedWorkflow ?? defaultWorkflowForDisplay;

  const applyStepToNavigation = useCallback(
    (step: WorkflowStep) => {
      switch (step.type) {
        case "import":
          setMainSection("data");
          setDataTab("preview");
          break;
        case "clean":
        case "transform":
          setMainSection("data");
          setDataTab("transform");
          break;
        case "describe":
        case "test":
          setMainSection("analysis");
          setAnalysisTab("correlation");
          break;
        case "model":
          setMainSection("analysis");
          setAnalysisTab("regression");
          break;
        case "visualize":
        case "report":
          setMainSection("presentation");
          setPresentationTab("visualization");
          break;
        default:
          break;
      }
    },
    [setMainSection, setDataTab, setAnalysisTab, setPresentationTab]
  );

  const MAIN_TABS = [
    {
      id: "data" as const,
      label: t("app.mainTab.data.label"),
      shortLabel: t("app.mainTab.data.shortLabel"),
      icon: Database,
      section: "data" as const,
    },
    {
      id: "analysis" as const,
      label: t("app.mainTab.analysis.label"),
      shortLabel: t("app.mainTab.analysis.shortLabel"),
      icon: BarChart3,
      section: "analysis" as const,
    },
    {
      id: "presentation" as const,
      label: t("app.mainTab.presentation.label"),
      shortLabel: t("app.mainTab.presentation.label"),
      icon: LineChartIcon,
      section: "presentation" as const,
    },
    {
      id: "ai" as const,
      label: t("app.mainTab.ai.label"),
      shortLabel: "AI",
      icon: Sparkles,
      section: "ai" as const,
    },
  ] as const;

  const getFirstStepInGroup = useCallback(
    (group: "data" | "presentation" | "analysis") => {
      const sorted = [...workflowToShow.steps].sort((a, b) => a.order - b.order);
      if (group === "data") return sorted.find((s) => s.type === "import" || s.type === "clean" || s.type === "transform");
      if (group === "presentation") return sorted.find((s) => s.type === "visualize");
      if (group === "analysis") return sorted.find((s) => s.type === "describe" || s.type === "test" || s.type === "model");
      return undefined;
    },
    [workflowToShow.steps]
  );

  const handleMainTabClick = useCallback(
    (tab: typeof MAIN_TABS[number]) => {
      if (tab.section === "ai") {
        setMainSection("ai");
        return;
      }
      if (!selectedWorkflowId) {
        setWorkflows((prev) =>
          prev.some((w) => w.id === defaultWorkflowForDisplay.id) ? prev : [...prev, defaultWorkflowForDisplay]
        );
        setSelectedWorkflowId(defaultWorkflowForDisplay.id);
      }
      const step = getFirstStepInGroup(tab.section);
      if (step) {
        setSelectedWorkflowStepId(step.id);
        applyStepToNavigation(step);
      } else {
        setMainSection(tab.section);
        if (tab.section === "data") setDataTab("preview");
        if (tab.section === "analysis") setAnalysisTab("correlation");
        if (tab.section === "presentation") setPresentationTab("visualization");
      }
    },
    [
      selectedWorkflowId,
      defaultWorkflowForDisplay,
      getFirstStepInGroup,
      applyStepToNavigation,
      setWorkflows,
      setSelectedWorkflowId,
      setSelectedWorkflowStepId,
      setMainSection,
      setDataTab,
      setAnalysisTab,
      setPresentationTab,
    ]
  );

  useEffect(() => {
    if (!headerMenuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) {
        setHeaderMenuOpen(false);
      }
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [headerMenuOpen, setHeaderMenuOpen]);

  return (
    <header className="flex-shrink-0 min-h-14 pt-[env(safe-area-inset-top,0px)] px-2 sm:px-4 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 flex items-center gap-1">
      <button
        type="button"
        onClick={() => {
          setMainSection("workflow");
          setSelectedWorkflowId(null);
          setSelectedWorkflowStepId(null);
        }}
        className="flex items-center gap-1.5 sm:gap-2 min-w-0 rounded-lg hover:opacity-90 transition-opacity text-left flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
        title={t("app.backToResearchWorkflow")}
      >
        <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center flex-shrink-0">
          <Sigma className="w-4 h-4 text-white" />
        </div>
        <div className="min-w-0">
          <h1 className="font-semibold text-sm sm:text-base truncate leading-tight">Quantis</h1>
          <p className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 truncate hidden sm:block">
            {t("app.tagline")}
          </p>
        </div>
      </button>

      <div className="flex-1 flex items-center justify-center min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:thin] snap-x snap-mandatory">
        <div className="flex items-center h-full gap-0.5 px-0.5">
          {MAIN_TABS.map((tab) => {
            const isActive = mainSection === tab.section;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => handleMainTabClick(tab)}
                className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-2.5 min-h-[44px] text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0 snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                  isActive
                    ? "border-brand text-brand bg-brand/5 dark:bg-brand/10"
                    : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/50"
                }`}
                title={tab.label}
              >
                <tab.icon className="w-4 h-4 shrink-0" />
                <span className="max-md:inline md:hidden">{tab.shortLabel}</span>
                <span className="hidden md:inline">{tab.label}</span>
              </button>
            );
          })}
        </div>
      </div>

      <div className="flex items-center gap-1 flex-shrink-0" ref={headerMenuRef}>
        <button
          type="button"
          onClick={toggleTheme}
          className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          title={theme === "dark" ? t("app.lightMode") : t("app.darkMode")}
          aria-label={theme === "dark" ? t("app.lightMode") : t("app.darkMode")}
        >
          {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
        </button>

        {authConfig?.authEnabled && !quantisApi.isPortalEmbed() && !authUser && (
          <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
            <button
              type="button"
              onClick={() => {
                setLoginModalInitialTab("login");
                setShowLoginModal(true);
              }}
              className="flex min-h-[40px] items-center justify-center gap-1 rounded-lg px-2 sm:px-2.5 py-2 text-xs sm:text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              title={t("app.login")}
              aria-label={t("app.login")}
            >
              <User className="w-4 h-4 shrink-0" />
              <span className="hidden sm:inline">{t("app.login")}</span>
            </button>
            <button
              type="button"
              onClick={() => {
                setLoginModalInitialTab("register");
                setShowLoginModal(true);
              }}
              className="flex min-h-[40px] items-center justify-center rounded-lg px-2 sm:px-2.5 py-2 text-xs sm:text-sm font-semibold text-brand hover:bg-brand/10 dark:hover:bg-brand/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              title={t("app.registerAccount")}
              aria-label={t("app.register")}
            >
              {t("app.register")}
            </button>
          </div>
        )}

        <div className="relative">
          <button
            type="button"
            onClick={() => setHeaderMenuOpen((v) => !v)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            title={t("app.menuHelpConfigSampleWorkflow")}
            aria-label={t("app.openMenuHelpConfigMore")}
            aria-expanded={headerMenuOpen}
            aria-haspopup="menu"
          >
            <MoreVertical className="w-5 h-5" />
          </button>
          {headerMenuOpen && (
            <div
              role="menu"
              aria-label={t("app.appMenu")}
              className="absolute right-0 top-full mt-1 py-1 min-w-[min(100vw-2rem,16rem)] max-w-[calc(100vw-1rem)] max-h-[min(75vh,28rem)] overflow-y-auto overscroll-contain rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg z-50"
            >
              {authUser && (
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setShowAccountDialog(true);
                    setHeaderMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                >
                  <User className="w-4 h-4 shrink-0" />
                  <span className="flex-1 min-w-0 truncate" title={authUser.name || authUser.email || t("app.account")}>
                    {authUser.name || authUser.email || t("app.account")}
                  </span>
                </button>
              )}
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setGuideOpen(true);
                  setHeaderMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
              >
                <BookOpen className="w-4 h-4 shrink-0 text-brand" />
                <span className="flex flex-col min-w-0">
                  <span className="font-semibold text-neutral-800 dark:text-neutral-100">{t("app.guideAndHelp")}</span>
                  <span className="text-xs text-neutral-500 dark:text-neutral-400 font-normal leading-snug">
                    {t("app.guideAndHelpDesc")}
                  </span>
                </span>
              </button>
              <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-600 mx-2" role="separator" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowDemoGallery(true);
                  setHeaderMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
              >
                <Download className="w-4 h-4 shrink-0" />
                {t("app.downloadSampleWorkflow")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMainSection("reproducibility");
                  setReproTab("workflows");
                  setHeaderMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
              >
                <GitBranch className="w-4 h-4 shrink-0" />
                {t("app.workflowsAndReproducibility")}
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setMainSection("reproducibility");
                  setReproTab("openscience");
                  setHeaderMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
              >
                <FileText className="w-4 h-4 shrink-0" />
                {t("app.preRegAndOpenScience")}
              </button>
              <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-600 mx-2" role="separator" />
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowSettings(true);
                  setHeaderMenuOpen(false);
                }}
                className="w-full flex items-start gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
              >
                <Server className="w-4 h-4 shrink-0 mt-0.5 text-brand" />
                <span className="min-w-0">
                  <span className="block font-medium">{t("app.connectionSettings")}</span>
                  <span className="block text-xs text-neutral-500 dark:text-neutral-400 font-normal">
                    {t("app.connectionSettingsDesc")}
                  </span>
                </span>
              </button>
              <button
                type="button"
                role="menuitem"
                onClick={() => {
                  setShowAppFeedbackModal(true);
                  setHeaderMenuOpen(false);
                }}
                className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
              >
                <ThumbsUp className="w-4 h-4 shrink-0" />
                {t("app.appFeedback")}
              </button>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
