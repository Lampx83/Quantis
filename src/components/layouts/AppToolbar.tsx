import React from "react";
import {
  Table2,
  ScanSearch,
  BarChart3,
  Shuffle,
  TestTube,
  CheckCircle2,
  TrendingUp,
  Calculator,
  Network,
  Cpu,
  Sigma,
  LineChart as LineChartIcon,
  ScatterChart as ScatterChartIcon,
  BarChart2,
  BoxSelect,
  Grid3X3,
  PieChart as PieChartIcon,
  Layers,
  CircleDot,
  AreaChart as AreaChartIcon,
  Gauge,
} from "lucide-react";
import { useUIStore, useWorkflowStore } from "@/stores";
import { t } from "@/i18n";

export function AppToolbar() {
  const {
    mainSection,
    dataTab,
    setDataTab,
    analysisTab,
    setAnalysisTab,
    presentationChartType,
    setPresentationChartType,
  } = useUIStore();

  const { workflows, selectedWorkflowId, selectedWorkflowStepId } = useWorkflowStore();

  const selectedWorkflow = selectedWorkflowId ? workflows.find((w) => w.id === selectedWorkflowId) : null;
  const selectedStep =
    selectedWorkflow && selectedWorkflowStepId
      ? selectedWorkflow.steps.find((s) => s.id === selectedWorkflowStepId)
      : null;

  return (
    <>
      {/* Toolbar ngang khi tab Khám phá & biến đổi — ẩn khi đang xem chi tiết workflow */}
      {mainSection === "data" && !(selectedWorkflowId && selectedWorkflow && !selectedStep) && (
        <div className="flex-shrink-0 px-2 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-1 flex-wrap min-w-0">
          <button
            type="button"
            onClick={() => setDataTab("preview")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
              dataTab === "preview"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <Table2 className="w-4 h-4 shrink-0" /> {t("app.dataTab.preview")}
          </button>
          <button
            type="button"
            onClick={() => setDataTab("profiling")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
              dataTab === "profiling"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <ScanSearch className="w-4 h-4 shrink-0" /> {t("app.dataTab.profiling")}
          </button>
          <button
            type="button"
            onClick={() => setDataTab("descriptive")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
              dataTab === "descriptive"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" /> {t("app.dataTab.descriptive")}
          </button>
          <button
            type="button"
            onClick={() => setDataTab("transform")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
              dataTab === "transform"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <Shuffle className="w-4 h-4 shrink-0" /> {t("app.dataTab.transform")}
          </button>
        </div>
      )}

      {/* Toolbar ở Analysis: Kiểm định / Hồi quy / SEM / ... */}
      {mainSection === "analysis" && (!selectedWorkflowId || selectedStep) && (
        <div
          role="toolbar"
          aria-label={t("app.analysisTabsAriaLabel")}
          className="toolbar flex-shrink-0 px-2 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-1 flex-nowrap overflow-x-auto min-w-0"
        >
          <button
            type="button"
            onClick={() => setAnalysisTab("correlation")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap shrink-0 ${
              analysisTab === "correlation"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <BarChart3 className="w-4 h-4 shrink-0" /> {t("app.analysisTab.correlation")}
          </button>
          <button
            type="button"
            onClick={() => setAnalysisTab("hypothesis")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap shrink-0 ${
              analysisTab === "hypothesis"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <TestTube className="w-4 h-4 shrink-0" /> {t("app.analysisTab.hypothesis")}
          </button>
          <button
            type="button"
            onClick={() => setAnalysisTab("reliability")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap shrink-0 ${
              analysisTab === "reliability"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <CheckCircle2 className="w-4 h-4 shrink-0" /> {t("app.analysisTab.reliability")}
          </button>
          <button
            type="button"
            onClick={() => setAnalysisTab("regression")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap shrink-0 ${
              analysisTab === "regression"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <TrendingUp className="w-4 h-4 shrink-0" /> {t("app.analysisTab.regression")}
          </button>
          <button
            type="button"
            onClick={() => setAnalysisTab("factor")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap shrink-0 ${
              analysisTab === "factor"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <Calculator className="w-4 h-4 shrink-0" /> {t("app.analysisTab.factor")}
          </button>
          <button
            type="button"
            onClick={() => setAnalysisTab("sem")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap shrink-0 ${
              analysisTab === "sem"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <Network className="w-4 h-4 shrink-0" /> SEM
          </button>
          <button
            type="button"
            onClick={() => setAnalysisTab("ml")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap shrink-0 ${
              analysisTab === "ml"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <Cpu className="w-4 h-4 shrink-0" /> {t("app.analysisTab.ml")}
          </button>
          <button
            type="button"
            onClick={() => setAnalysisTab("bayesian")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap shrink-0 ${
              analysisTab === "bayesian"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <Sigma className="w-4 h-4 shrink-0" /> Bayesian
          </button>
          <button
            type="button"
            onClick={() => setAnalysisTab("panel")}
            className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap shrink-0 ${
              analysisTab === "panel"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
          >
            <Layers className="w-4 h-4 shrink-0" /> {t("app.analysisTab.panel")}
          </button>
        </div>
      )}

      {/* Trực quan: toolbar loại biểu đồ (cùng vị trí với tab Data / Analysis) */}
      {mainSection === "presentation" && (!selectedWorkflowId || selectedStep) && (
        <div
          role="toolbar"
          aria-label={t("app.chartTypeAriaLabel")}
          className="toolbar flex-shrink-0 px-2 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-1 flex-nowrap overflow-x-auto min-w-0"
        >
          <button
            type="button"
            onClick={() => setPresentationChartType("bar")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "bar"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title={t("app.chartType.bar")}
          >
            <BarChart3 className="w-4 h-4 shrink-0" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              {t("app.chartType.bar")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPresentationChartType("line")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "line"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title={t("app.chartType.line")}
          >
            <LineChartIcon className="w-4 h-4 shrink-0" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              {t("app.chartType.line")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPresentationChartType("scatter")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "scatter"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title={t("app.chartType.scatter")}
          >
            <ScatterChartIcon className="w-4 h-4 shrink-0" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              {t("app.chartType.scatter")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPresentationChartType("histogram")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "histogram"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title="Histogram"
          >
            <BarChart2 className="w-4 h-4 shrink-0" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              Histogram
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPresentationChartType("box")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "box"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title="Box plot"
          >
            <BoxSelect className="w-4 h-4 shrink-0" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              Box plot
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPresentationChartType("heatmap")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "heatmap"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title={t("app.chartType.heatmap")}
          >
            <Grid3X3 className="w-4 h-4 shrink-0" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              {t("app.chartType.heatmap")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPresentationChartType("pie")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "pie"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title={t("app.chartType.pie")}
          >
            <PieChartIcon className="w-4 h-4 shrink-0" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              {t("app.chartType.pie")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPresentationChartType("stackedBar")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "stackedBar"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title={t("app.chartType.stackedBar")}
          >
            <Layers className="w-4 h-4 shrink-0" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              {t("app.chartType.stackedBar")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPresentationChartType("barH")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "barH"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title={t("app.chartType.barH")}
          >
            <BarChart3 className="w-4 h-4 shrink-0 rotate-90" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              {t("app.chartType.barH")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPresentationChartType("area")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "area"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title={t("app.chartType.area")}
          >
            <AreaChartIcon className="w-4 h-4 shrink-0" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              {t("app.chartType.area")}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPresentationChartType("donut")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "donut"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title="Donut"
          >
            <CircleDot className="w-4 h-4 shrink-0" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              Donut
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPresentationChartType("density")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "density"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title={t("app.chartType.densityCompareTwoGroups")}
          >
            <TrendingUp className="w-4 h-4 shrink-0" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              Density
            </span>
          </button>
          <button
            type="button"
            onClick={() => setPresentationChartType("radar")}
            className={`relative group flex items-center justify-center p-2 rounded-md text-sm shrink-0 ${
              presentationChartType === "radar"
                ? "bg-brand text-white"
                : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
            }`}
            title="Radar"
          >
            <Gauge className="w-4 h-4 shrink-0" />
            <span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">
              Radar
            </span>
          </button>
        </div>
      )}

      {/* Toolbar ở theo bước workflow (khi đang xem Các bước, chọn 1 bước) — không hiện khi đang ở tab AI hướng dẫn */}
      {selectedStep &&
        mainSection !== "data" &&
        mainSection !== "presentation" &&
        mainSection !== "analysis" &&
        mainSection !== "ai" && (
          <div
            role="toolbar"
            aria-label={t("app.stepTabsAriaLabel")}
            className="toolbar flex-shrink-0 px-2 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-1 flex-wrap min-w-0"
          >
            {selectedStep.type === "import" && (
              <>
                <button
                  type="button"
                  onClick={() => setDataTab("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    dataTab === "preview"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <Table2 className="w-4 h-4 shrink-0" /> {t("app.dataTab.preview")}
                </button>
                <button
                  type="button"
                  onClick={() => setDataTab("profiling")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    dataTab === "profiling"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <ScanSearch className="w-4 h-4 shrink-0" /> {t("app.dataTab.profiling")}
                </button>
                <button
                  type="button"
                  onClick={() => setDataTab("transform")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    dataTab === "transform"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <Shuffle className="w-4 h-4 shrink-0" /> {t("app.dataTab.transform")}
                </button>
              </>
            )}
            {(selectedStep.type === "clean" || selectedStep.type === "transform") && (
              <>
                <button
                  type="button"
                  onClick={() => setDataTab("transform")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    dataTab === "transform"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <Shuffle className="w-4 h-4 shrink-0" /> {t("app.dataTab.transform")}
                </button>
                <button
                  type="button"
                  onClick={() => setDataTab("preview")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    dataTab === "preview"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <Table2 className="w-4 h-4 shrink-0" /> {t("app.dataTab.preview")}
                </button>
              </>
            )}
            {(selectedStep.type === "describe" || selectedStep.type === "test" || selectedStep.type === "model") && (
              <>
                <button
                  type="button"
                  onClick={() => setAnalysisTab("correlation")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    analysisTab === "correlation"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <BarChart3 className="w-4 h-4 shrink-0" /> {t("app.analysisTab.correlation")}
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisTab("hypothesis")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    analysisTab === "hypothesis"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <TestTube className="w-4 h-4 shrink-0" /> {t("app.analysisTab.hypothesis")}
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisTab("reliability")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    analysisTab === "reliability"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <CheckCircle2 className="w-4 h-4 shrink-0" /> {t("app.analysisTab.reliability")}
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisTab("regression")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    analysisTab === "regression"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <TrendingUp className="w-4 h-4 shrink-0" /> {t("app.analysisTab.regression")}
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisTab("factor")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    analysisTab === "factor"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <Calculator className="w-4 h-4 shrink-0" /> {t("app.analysisTab.factor")}
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisTab("sem")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    analysisTab === "sem"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <Network className="w-4 h-4 shrink-0" /> SEM
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisTab("ml")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    analysisTab === "ml"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <Cpu className="w-4 h-4 shrink-0" /> {t("app.analysisTab.ml")}
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisTab("bayesian")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    analysisTab === "bayesian"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <Sigma className="w-4 h-4 shrink-0" /> Bayesian
                </button>
                <button
                  type="button"
                  onClick={() => setAnalysisTab("panel")}
                  className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm whitespace-nowrap ${
                    analysisTab === "panel"
                      ? "bg-brand text-white"
                      : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"
                  }`}
                >
                  <Layers className="w-4 h-4 shrink-0" /> {t("app.analysisTab.panel")}
                </button>
              </>
            )}
            {selectedStep.type === "visualize" && (
              <span className="text-sm text-neutral-500 dark:text-neutral-400">
                {t("app.mainTab.presentation.label")}
              </span>
            )}
          </div>
        )}
    </>
  );
}
