import React, { useState, useRef, useEffect } from "react";
import { Download, Copy } from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  LineChart,
  Line,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import type { Dataset } from "@/types";
import type { PresentationTab, PresentationChartType } from "@/stores";
import type {
  TTestResult,
  ChiSquareResult,
  ANOVAResult,
  MannWhitneyResult,
} from "@/utils/stats";
import {
  getDataRows,
  getBoxStatsByGroup,
  getHistogramBins,
  binNumericForPie,
  computeCorrelationMatrix,
  computeDescriptive,
  getCrosstab,
  kernelDensityEstimate,
} from "@/utils/stats";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel, type AIQuickPrompt } from "@/features/ai";

export interface PresentationViewProps {
  tab: PresentationTab;
  onTabChange?: (t: PresentationTab) => void;
  selectedDataset: Dataset | undefined;
  lastHypothesisResult?: {
    type: "ttest" | "chisquare" | "anova" | "mannwhitney";
    payload: TTestResult | ChiSquareResult | ANOVAResult | MannWhitneyResult;
    meta?: Record<string, string>;
  } | null;
  analysisBackendAvailable?: boolean;
  chartType: PresentationChartType;
  setChartType: (t: PresentationChartType) => void;
  showToast?: (msg: string) => void;
}

export function PresentationView({
  tab,
  onTabChange: _onTabChange,
  selectedDataset,
  lastHypothesisResult: _lastHypothesisResult,
  analysisBackendAvailable = false,
  chartType,
  setChartType: _setChartType,
  showToast,
}: PresentationViewProps) {
  const [chartXCol, setChartXCol] = useState("");
  const [chartYCol, setChartYCol] = useState("");
  const [histogramCol, setHistogramCol] = useState("");
  const [showHistogramDensity, setShowHistogramDensity] = useState(false);
  const [stackByCol, setStackByCol] = useState("");
  const [heatmapCorrMethod, setHeatmapCorrMethod] = useState<"pearson" | "spearman" | "kendall">("pearson");
  const [radarGroupCol, setRadarGroupCol] = useState("");
  const [radarNumericCols, setRadarNumericCols] = useState<string[]>([]);
  const [multiLineYCols, setMultiLineYCols] = useState<string[]>([]);
  const [crosstabCol1, setCrosstabCol1] = useState("");
  const [crosstabCol2, setCrosstabCol2] = useState("");
  const [barSortOrder, setBarSortOrder] = useState<"none" | "asc" | "desc">("none");
  const [densityGroupCol, setDensityGroupCol] = useState("");
  const [densityValueCol, setDensityValueCol] = useState("");
  const [pieBinNumeric, setPieBinNumeric] = useState(false);
  const [pieBinCount, setPieBinCount] = useState(4);
  const [pieNumericCol, setPieNumericCol] = useState("");
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [boxStatsBackendResult, setBoxStatsBackendResult] = useState<Array<{ group: string; min: number; q1: number; median: number; q3: number; max: number; n: number }> | null>(null);
  const [histBinsBackendResult, setHistBinsBackendResult] = useState<Array<{ binStart: number; binEnd: number; count: number }> | null>(null);
  const PIE_COLORS = ["#0061bb", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

  useEffect(() => {
    if (tab !== "visualization" || !selectedDataset || chartType !== "box" || !chartXCol || !chartYCol || !analysisBackendAvailable) {
      setBoxStatsBackendResult(null);
      return;
    }
    const rows = getDataRows(selectedDataset);
    quantisApi.analyzeBoxStats(rows, chartXCol, chartYCol).then(setBoxStatsBackendResult);
  }, [tab, selectedDataset?.id, chartType, chartXCol, chartYCol, analysisBackendAvailable]);

  useEffect(() => {
    if (tab !== "visualization" || !selectedDataset || chartType !== "histogram" || !histogramCol || !analysisBackendAvailable) {
      setHistBinsBackendResult(null);
      return;
    }
    const rows = getDataRows(selectedDataset);
    const cols = selectedDataset.columnNames || [];
    const histColIdx = cols.indexOf(histogramCol);
    const histValues = histColIdx >= 0 ? rows.slice(1).map((r) => Number(r[histColIdx])).filter((v) => !Number.isNaN(v)) : [];
    if (histValues.length === 0) { setHistBinsBackendResult(null); return; }
    quantisApi.analyzeHistogramBins(histValues).then(setHistBinsBackendResult);
  }, [tab, selectedDataset?.id, chartType, histogramCol, analysisBackendAvailable]);

  if (tab === "visualization" && selectedDataset) {
    const rows = getDataRows(selectedDataset);
    const cols = selectedDataset.columnNames || [];
    const xCol = chartXCol;
    const setXCol = setChartXCol;
    const yCol = chartYCol;
    const setYCol = setChartYCol;
    const numericCols = rows.length >= 2 ? cols.filter((c) => { const ci = rows[0].indexOf(c); const vals = rows.slice(1).map((r) => r[ci]); return vals.every((v) => v === "" || !Number.isNaN(Number(v))); }) : [];
    const xIdx = cols.indexOf(xCol);
    const yIdx = cols.indexOf(yCol);
    const isScatter = xCol && yCol && numericCols.includes(xCol) && numericCols.includes(yCol);
    const chartData = rows.length >= 2 && xIdx >= 0 && yIdx >= 0
      ? rows.slice(1).map((r) => ({ x: isScatter ? Number(r[xIdx]) : r[xIdx], y: Number(r[yIdx]) })).filter((d) => !Number.isNaN(d.y) && (!isScatter || !Number.isNaN(Number(d.x))))
      : [];
    const barData = !isScatter && xCol && xIdx >= 0 ? (() => { const counts: Record<string, number> = {}; rows.slice(1).forEach((r) => { const v = r[xIdx] ??""; counts[v] = (counts[v] || 0) + 1; }); return Object.entries(counts).map(([name, count]) => ({ name, count })).slice(0, 20); })() : [];
    /** Biểu đồ cột: dùng X làm danh mục; nếu có Y (số) thì chiều cao = tổng Y theo nhóm, không thì = tần số */
    const barChartData = (chartType === "bar" || chartType === "barH") && xCol && xIdx >= 0
      ? (yCol && yIdx >= 0 && numericCols.includes(yCol)
          ? (() => {
              const sums: Record<string, number> = {};
              rows.slice(1).forEach((r) => {
                const name = String(r[xIdx] ?? "").trim();
                const val = Number(r[yIdx]);
                if (name === "" || Number.isNaN(val)) return;
                sums[name] = (sums[name] || 0) + val;
              });
              return Object.entries(sums).map(([name, count]) => ({ name, count })).slice(0, 24);
            })()
          : (() => { const counts: Record<string, number> = {}; rows.slice(1).forEach((r) => { const v = r[xIdx] ??""; counts[v] = (counts[v] || 0) + 1; }); return Object.entries(counts).map(([name, count]) => ({ name, count })).slice(0, 24); })())
      : barData;
    const barDataSorted = barSortOrder === "none" ? barChartData : [...barChartData].sort((a, b) => (barSortOrder === "asc" ? a.count - b.count : b.count - a.count));
    const boxStats = (chartType === "box" && xCol && yCol && numericCols.includes(yCol))
      ? (analysisBackendAvailable && boxStatsBackendResult ? boxStatsBackendResult : getBoxStatsByGroup(rows, xCol, yCol))
      : [];
    const boxChartData = boxStats.map((b) => ({ name: b.group, median: b.median, min: b.min, max: b.max, q1: b.q1, q3: b.q3, n: b.n }));
    const densityGroupIdx = densityGroupCol ? cols.indexOf(densityGroupCol) : -1;
    const densityValueIdx = densityValueCol ? cols.indexOf(densityValueCol) : -1;
    const densityData = (chartType === "density" && densityGroupCol && densityValueCol && numericCols.includes(densityValueCol) && densityGroupIdx >= 0 && densityValueIdx >= 0 && rows.length >= 2) ? (() => {
      const groups: Record<string, number[]> = {};
      rows.slice(1).forEach((r) => {
        const g = String(r[densityGroupIdx] ?? "").trim();
        const v = Number(r[densityValueIdx]);
        if (g === "" || Number.isNaN(v)) return;
        if (!groups[g]) groups[g] = [];
        groups[g].push(v);
      });
      const allVals = Object.values(groups).flat();
      if (allVals.length < 2) return [];
      const lo = Math.min(...allVals);
      const hi = Math.max(...allVals);
      const grid = Array.from({ length: 60 }, (_, i) => lo + (hi - lo) * i / 59);
      const series: { group: string; points: { x: number; density: number }[] }[] = [];
      Object.entries(groups).forEach(([group, vals]) => {
        if (vals.length < 2) return;
        const pts = kernelDensityEstimate(vals, grid);
        series.push({ group, points: pts.map((p) => ({ x: p.x, density: p.density })) });
      });
      return series;
    })() : [];
    const histColIdx = cols.indexOf(histogramCol);
    const histValues = histogramCol && histColIdx >= 0 ? rows.slice(1).map((r) => Number(r[histColIdx])).filter((v) => !Number.isNaN(v)) : [];
    const histBins = histValues.length > 0 ? (analysisBackendAvailable && histBinsBackendResult ? histBinsBackendResult : getHistogramBins(histValues)) : [];
    const histChartData = histBins.map((b) => ({ name: b.binStart.toFixed(1) + "–" + b.binEnd.toFixed(1), count: b.count }));
    const histDensityCurve = (chartType === "histogram" && showHistogramDensity && histValues.length >= 2) ? (() => {
      const lo = Math.min(...histValues);
      const hi = Math.max(...histValues);
      const grid = Array.from({ length: 80 }, (_, i) => lo + (hi - lo) * i / 79);
      return kernelDensityEstimate(histValues, grid).map((p) => ({ x: p.x, density: p.density }));
    })() : [];
    const histComboData = (chartType === "histogram" && showHistogramDensity && histChartData.length > 0 && histDensityCurve.length > 0) ? (() => {
      const maxCount = Math.max(...histChartData.map((d) => d.count));
      const maxDens = Math.max(...histDensityCurve.map((d) => d.density));
      const scale = maxDens > 0 ? maxCount / maxDens : 1;
      return histChartData.map((d, i) => {
        const binStart = histBins[i].binStart;
        const binEnd = histBins[i].binEnd;
        const center = (binStart + binEnd) / 2;
        const nearest = histDensityCurve.reduce((a, p) => (Math.abs(p.x - center) < Math.abs(a.x - center) ? p : a));
        return { name: d.name, count: d.count, densityScaled: nearest.density * scale };
      });
    })() : [];
    const pieData = (chartType === "pie" || chartType === "donut")
      ? (pieBinNumeric && pieNumericCol && numericCols.includes(pieNumericCol)
          ? (() => {
              const idx = cols.indexOf(pieNumericCol);
              const vals = rows.slice(1).map((r) => Number(r[idx])).filter((v) => !Number.isNaN(v));
              const binned = binNumericForPie(vals, pieBinCount);
              return binned.map((b) => ({ name: b.label, value: b.count })).filter((d) => d.value > 0);
            })()
          : (xCol && xIdx >= 0
              ? (() => {
                  const counts: Record<string, number> = {};
                  rows.slice(1).forEach((r) => {
                    const v = String(r[xIdx] ?? "").trim();
                    if (v !== "") counts[v] = (counts[v] || 0) + 1;
                  });
                  return Object.entries(counts)
                    .map(([name, count]) => ({ name, value: count }))
                    .filter((d) => d.value > 0)
                    .slice(0, 24);
                })()
              : []))
      : (barData.length > 0 ? barData.map((d) => ({ name: d.name, value: d.count })) : []);
    const lineData = rows.length >= 2 && xIdx >= 0 && yIdx >= 0
      ? rows.slice(1).map((r) => ({ x: r[xIdx] ??"", y: Number(r[yIdx]) })).filter((d) => !Number.isNaN(d.y))
      : [];
    const areaData = lineData;
    const stackByIdx = stackByCol ? cols.indexOf(stackByCol) : -1;
    const stackedBarData = (chartType === "stackedBar" && xCol && stackByCol && yCol && xIdx >= 0 && yIdx >= 0 && stackByIdx >= 0 && rows.length >= 2) ? (() => {
      const xVals = Array.from(new Set(rows.slice(1).map((r) => r[xIdx] ??"")));
      const stackVals = Array.from(new Set(rows.slice(1).map((r) => r[stackByIdx] ??"")));
      const map: Record<string, Record<string, number>> = {};
      xVals.forEach((x) => { map[x] = {}; stackVals.forEach((s) => { map[x][s] = 0; }); });
      rows.slice(1).forEach((r) => {
        const x = r[xIdx] ??"";
        const s = r[stackByIdx] ??"";
        const y = Number(r[yIdx]);
        if (!Number.isNaN(y) && map[x] && map[x][s] !== undefined) map[x][s] += y;
      });
      return xVals.slice(0, 25).map((name) => ({ name, ...map[name] }));
    })() : [];
    const radarGroups = (radarGroupCol && rows.length >= 2) ? Array.from(new Set(rows.slice(1).map((r) => r[cols.indexOf(radarGroupCol)] ?? ""))) : [t("presentationView.radarAllLabel")];
    const radarData = (chartType === "radar" && radarNumericCols.length >= 2) ? (() => {
      const groupIdx = radarGroupCol ? cols.indexOf(radarGroupCol) : -1;
      const fullMark = 100;
      return radarNumericCols.map((col) => {
        const colIdx = cols.indexOf(col);
        const entry: Record<string, number | string> = { subject: col.length > 14 ? col.slice(0, 12) + "…" : col, fullMark };
        radarGroups.forEach((g) => {
          const subset = rows.slice(1).filter((r) => groupIdx < 0 || (r[groupIdx] ??"") === g);
          const vals = subset.map((r) => Number(r[colIdx])).filter((v) => !Number.isNaN(v));
          entry[g] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        });
        return entry;
      });
    })() : [];
    const corrResult = (chartType === "heatmap" && rows.length >= 2) ? computeCorrelationMatrix(rows, heatmapCorrMethod) : null;
    const summaryStats = (chartType === "summary" && rows.length >= 2) ? computeDescriptive(rows) : [];
    const dashboardCorrResult = (chartType === "dashboard" && rows.length >= 2) ? computeCorrelationMatrix(rows, "pearson") : null;
    const dashboardStats = (chartType === "dashboard" && rows.length >= 2) ? computeDescriptive(rows) : [];
    const multiLineXIdx = chartType === "multiLine" && chartXCol ? cols.indexOf(chartXCol) : -1;
    const multiLineData = (chartType === "multiLine" && multiLineXIdx >= 0 && multiLineYCols.length > 0 && rows.length >= 2) ? (() => {
      const yIndices = multiLineYCols.map((c) => cols.indexOf(c)).filter((i) => i >= 0);
      if (yIndices.length === 0) return [];
      return rows.slice(1).map((r) => {
        const point: Record<string, string | number> = { x: r[multiLineXIdx] ??"" };
        multiLineYCols.forEach((col) => {
          const idx = cols.indexOf(col);
          if (idx >= 0) { const v = Number(r[idx]); point[col] = Number.isNaN(v) ? "" : v; }
        });
        return point;
      }).filter((d) => multiLineYCols.some((c) => d[c] !== "" && d[c] !== undefined));
    })() : [];
    const crosstabResult: { rowLabels: string[]; colLabels: string[]; counts: number[][] } | null = (chartType === "crosstab" && crosstabCol1 && crosstabCol2 && rows.length >= 2) ? getCrosstab(rows, crosstabCol1, crosstabCol2) : null;

    const visualizationContext = [
      selectedDataset ? `${t("presentationView.contextDatasetLabel")} ${selectedDataset.name}, ${rows.length} ${t("transformTab.rowsUnit")}, ${cols.length} ${t("transformTab.columnsUnit")}.` : "",
      `${t("presentationView.contextChartTypeLabel")} ${chartType}.`,
      (chartType === "scatter" || chartType === "line" || chartType === "area") && xCol && yCol
        ? `${t("presentationView.axisXLabel")}: ${xCol}, ${t("presentationView.axisYLabel")}: ${yCol}. ${t("presentationView.contextPointsCountLabel")} ${chartData.length}.`
        : "",
      (chartType === "bar" || chartType === "barH" || chartType === "pie" || chartType === "donut") && xCol
        ? `${t("presentationView.contextVariableLabel")} ${xCol}. ${t("presentationView.contextGroupCountLabel")} ${barData.length}.`
        : "",
      chartType === "box" && xCol && yCol
        ? `${t("presentationView.contextGroupLabel")} ${xCol}, ${t("presentationView.contextValueLabel")} ${yCol}. ${t("presentationView.contextGroupCountLabel")} ${boxChartData.length}.`
        : "",
      chartType === "histogram" && histogramCol
        ? `${t("presentationView.contextVariableLabel")} ${histogramCol}. ${t("presentationView.contextBinsCountLabel")} ${histChartData.length}.${showHistogramDensity ? ` ${t("presentationView.contextHasDensityLine")}` : ""}`
        : "",
      chartType === "heatmap" ? t("presentationView.contextHeatmapText") : "",
      chartType === "radar" && radarNumericCols.length > 0
        ? `${t("presentationView.contextAxesLabel")} ${radarNumericCols.slice(0, 6).join(", ")}${radarNumericCols.length > 6 ? "..." : ""}.`
        : "",
      chartType === "multiLine" && chartXCol ? `${t("presentationView.axisXLabel")}: ${chartXCol}, ${t("presentationView.contextMultiLineSuffix")}` : "",
      chartType === "crosstab" && crosstabCol1 && crosstabCol2
        ? `${t("presentationView.contextCrosstabLabel")} ${crosstabCol1} × ${crosstabCol2}.`
        : "",
    ].filter(Boolean).join(" ");

    const visualizationQuickPrompts: AIQuickPrompt[] = [
      { label: t("presentationView.quickPromptInsightLabel"), systemHint: `${t("presentationView.quickPromptInsightHint")} ${aiAnswerLangHint()}`, userMessage: t("presentationView.quickPromptInsightUserMessage") },
      { label: t("presentationView.quickPromptSuggestChartLabel"), systemHint: `${t("presentationView.quickPromptSuggestChartHint")} ${aiAnswerLangHint("Trả lời bằng tiếng Việt.", "Answer in English.")}`, userMessage: t("presentationView.quickPromptSuggestChartUserMessage") },
      { label: t("presentationView.quickPromptCaptionLabel"), systemHint: `${t("presentationView.quickPromptCaptionHint")} ${aiAnswerLangHint("Trả lời bằng tiếng Việt.", "Answer in English.")}`, userMessage: t("presentationView.quickPromptCaptionUserMessage") },
      { label: t("presentationView.quickPromptHowToReadLabel"), systemHint: `${t("presentationView.quickPromptHowToReadHint")} ${aiAnswerLangHint()}`, userMessage: t("presentationView.quickPromptHowToReadUserMessage") },
    ];

    const hasExportableChart = (chartType === "scatter" && chartData.length > 0) || (chartType === "bar" && barChartData.length > 0) || (chartType === "barH" && barChartData.length > 0) || (chartType === "line" && lineData.length > 0) || (chartType === "pie" && pieData.length > 0) || (chartType === "donut" && pieData.length > 0) || (chartType === "area" && areaData.length > 0) || (chartType === "stackedBar" && stackedBarData.length > 0) || (chartType === "box" && boxChartData.length > 0) || (chartType === "histogram" && histChartData.length > 0) || (chartType === "density" && densityData.length > 0) || (chartType === "radar" && radarData.length > 0) || (chartType === "multiLine" && multiLineData.length > 0);
    const getChartSvgFromButton = (btn: HTMLElement): SVGElement | null => {
      const wrapper = btn.closest("[data-chart-export-wrapper]");
      if (!wrapper) return null;
      const chartBox = wrapper.querySelector(".h-80");
      return chartBox ? chartBox.querySelector("svg") : null;
    };
    const handleExportPng = (e: React.MouseEvent<HTMLButtonElement>) => {
      const el = getChartSvgFromButton(e.currentTarget);
      if (!el) return;
      const svg = new XMLSerializer().serializeToString(el);
      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(scale, scale);
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, img.width, img.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (blob) {
              const a = document.createElement("a");
              a.href = URL.createObjectURL(blob);
              a.download = `quantis-${chartType}.png`;
              a.click();
              URL.revokeObjectURL(a.href);
            }
          }, "image/png");
        }
        URL.revokeObjectURL(url);
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    };
    const handleCopyToClipboard = (e: React.MouseEvent<HTMLButtonElement>) => {
      const el = getChartSvgFromButton(e.currentTarget);
      if (!el) return;
      const svg = new XMLSerializer().serializeToString(el);
      const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
      const url = URL.createObjectURL(svgBlob);
      const img = new Image();
      img.onload = () => {
        const scale = 2;
        const canvas = document.createElement("canvas");
        canvas.width = img.width * scale;
        canvas.height = img.height * scale;
        const ctx = canvas.getContext("2d");
        if (ctx) {
          ctx.scale(scale, scale);
          ctx.fillStyle = "white";
          ctx.fillRect(0, 0, img.width, img.height);
          ctx.drawImage(img, 0, 0);
          canvas.toBlob((blob) => {
            if (!blob) { URL.revokeObjectURL(url); return; }
            navigator.clipboard.write([new ClipboardItem({ "image/png": blob })]).then(() => {
              URL.revokeObjectURL(url);
              if (typeof showToast === "function") showToast(t("presentationView.copyChartSuccessToast"));
            }).catch(() => {
              URL.revokeObjectURL(url);
              if (typeof showToast === "function") showToast(t("presentationView.copyChartFailToast"));
            });
          }, "image/png");
        } else {
          URL.revokeObjectURL(url);
        }
      };
      img.onerror = () => URL.revokeObjectURL(url);
      img.src = url;
    };
    const chartExportIcons = hasExportableChart ? (
      <div className="absolute top-2 right-2 z-10 flex gap-1 rounded-lg bg-white/95 dark:bg-neutral-800/95 border border-neutral-200 dark:border-neutral-600 p-1.5 shadow-sm opacity-0 group-hover:opacity-100 transition-opacity">
        <button type="button" onClick={handleExportPng} title={t("presentationView.savePngTitle")} className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"><Download className="w-4 h-4" /></button>
        <button type="button" onClick={handleCopyToClipboard} title={t("presentationView.copyToClipboardTitle")} className="p-1.5 rounded hover:bg-neutral-100 dark:hover:bg-neutral-700"><Copy className="w-4 h-4" /></button>
      </div>
    ) : null;

    return (
      <div ref={chartContainerRef} className="w-full max-w-full">
        <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
          <div className="flex flex-wrap items-center gap-4">
        <span className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 shrink-0">
          {({ bar: t("presentationView.chartTypeBar"), line: t("presentationView.chartTypeLine"), scatter: t("presentationView.chartTypeScatter"), histogram: t("presentationView.chartTypeHistogram"), box: t("presentationView.chartTypeBox"), heatmap: t("presentationView.chartTypeHeatmap"), pie: t("presentationView.chartTypePie"), stackedBar: t("presentationView.chartTypeStackedBar"), barH: t("presentationView.chartTypeBarH"), area: t("presentationView.chartTypeArea"), donut: t("presentationView.chartTypeDonut"), density: t("presentationView.chartTypeDensity"), radar: t("presentationView.chartTypeRadar") } as Record<string, string>)[chartType] ?? chartType}
        </span>
        {(chartType === "scatter" || chartType === "bar" || chartType === "line" || chartType === "pie" || chartType === "area") && (
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.axisXLabel")}</label>
              <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.axisYNumericLabel")}</label>
              <select value={yCol} onChange={(e) => setYCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            {chartType === "bar" && (
              <div>
                <label className="block text-sm font-medium mb-1">{t("presentationView.sortAxisXLabel")}</label>
                <select value={barSortOrder} onChange={(e) => setBarSortOrder(e.target.value as "none" | "asc" | "desc")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                  <option value="none">{t("presentationView.sortNone")}</option>
                  <option value="asc">{t("presentationView.sortAsc")}</option>
                  <option value="desc">{t("presentationView.sortDesc")}</option>
                </select>
              </div>
            )}
          </div>
        )}
        {chartType === "stackedBar" && (
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.axisXCategoryLabel")}</label>
              <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.stackByLabel")}</label>
              <select value={stackByCol} onChange={(e) => setStackByCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {cols.filter((c) => c !== xCol).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.valueNumericLabel")}</label>
              <select value={yCol} onChange={(e) => setYCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
        {chartType === "radar" && (
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.groupColumnOptionalLabel")}</label>
              <select value={radarGroupCol} onChange={(e) => setRadarGroupCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("presentationView.noGroupOption")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium mb-1">{t("presentationView.numericAxesLabel")}</label>
              <div className="flex flex-wrap gap-2">
                {numericCols.slice(0, 16).map((c) => {
                  const checked = radarNumericCols.includes(c);
                  const canAdd = checked || radarNumericCols.length < 8;
                  return (
                    <label key={c} className={`flex items-center gap-1.5 text-sm ${!canAdd ? "opacity-50" : ""}`}>
                      <input type="checkbox" checked={checked} disabled={!canAdd} onChange={() => setRadarNumericCols((prev) => checked ? prev.filter((x) => x !== c) : prev.length < 8 ? [...prev, c] : prev)} className="rounded border-neutral-400" />
                      {c.length > 18 ? c.slice(0, 16) + "…" : c}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {chartType === "heatmap" && (
          <div className="flex flex-wrap gap-4 mb-4">
            <span className="text-sm font-medium">{t("presentationView.coefficientLabel")}</span>
            <button type="button" onClick={() => setHeatmapCorrMethod("pearson")} className={`rounded-lg px-3 py-1.5 text-sm ${heatmapCorrMethod === "pearson" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Pearson</button>
            <button type="button" onClick={() => setHeatmapCorrMethod("spearman")} className={`rounded-lg px-3 py-1.5 text-sm ${heatmapCorrMethod === "spearman" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Spearman</button>
            <button type="button" onClick={() => setHeatmapCorrMethod("kendall")} className={`rounded-lg px-3 py-1.5 text-sm ${heatmapCorrMethod === "kendall" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Kendall</button>
            {corrResult && corrResult.columnNames.length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  const headers = ["", ...corrResult!.columnNames];
                  const rows = corrResult!.matrix.map((row, i) => [corrResult!.columnNames[i], ...row.map((v) => v.toFixed(4))]);
                  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `quantis-correlation-${heatmapCorrMethod}.csv`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
                className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                <Download className="w-4 h-4" /> {t("presentationView.exportCsvButton")}
              </button>
            )}
          </div>
        )}
        {chartType === "pie" && (
          <div className="mb-4 space-y-3">
            <p className="text-sm text-neutral-600 dark:text-neutral-400">{t("presentationView.pieHint")}</p>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pieBinNumeric} onChange={(e) => setPieBinNumeric(e.target.checked)} className="rounded border-neutral-400" />
              {t("presentationView.binNumericLabel")}
            </label>
            {pieBinNumeric && (
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">{t("presentationView.numericColumnLabel")}</label>
                  <select value={pieNumericCol} onChange={(e) => setPieNumericCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("analysisView.selectPlaceholder")}</option>
                    {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{t("presentationView.binCountLabel")}</label>
                  <select value={pieBinCount} onChange={(e) => setPieBinCount(Number(e.target.value))} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {t("presentationView.binCountUnit")}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
        {chartType === "donut" && (
          <div className="mb-4 space-y-3">
            <label className="block text-sm font-medium mb-1">{t("presentationView.categoricalColumnLabel")}</label>
            <select value={xCol} onChange={(e) => { setXCol(e.target.value); setPieBinNumeric(false); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">{t("analysisView.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <label className="flex items-center gap-2 text-sm">
              <input type="checkbox" checked={pieBinNumeric} onChange={(e) => setPieBinNumeric(e.target.checked)} className="rounded border-neutral-400" />
              {t("presentationView.binNumericLabel")}
            </label>
            {pieBinNumeric && (
              <div className="flex flex-wrap gap-4">
                <div>
                  <label className="block text-xs font-medium mb-1">{t("presentationView.numericColumnLabel")}</label>
                  <select value={pieNumericCol} onChange={(e) => setPieNumericCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("analysisView.selectPlaceholder")}</option>
                    {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-xs font-medium mb-1">{t("presentationView.binCountLabel")}</label>
                  <select value={pieBinCount} onChange={(e) => setPieBinCount(Number(e.target.value))} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    {[2, 3, 4, 5, 6].map((n) => <option key={n} value={n}>{n} {t("presentationView.binCountUnit")}</option>)}
                  </select>
                </div>
              </div>
            )}
          </div>
        )}
        {chartType === "barH" && (
          <div className="mb-4 flex flex-wrap items-end gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.axisCategoryLabel")}</label>
              <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.sortAxisLabel")}</label>
              <select value={barSortOrder} onChange={(e) => setBarSortOrder(e.target.value as "none" | "asc" | "desc")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="none">{t("presentationView.sortNone")}</option>
                <option value="asc">{t("presentationView.sortAsc")}</option>
                <option value="desc">{t("presentationView.sortDesc")}</option>
              </select>
            </div>
          </div>
        )}
        {chartType === "box" && (
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.groupVarXLabel")}</label>
              <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.numericVarYLabel")}</label>
              <select value={yCol} onChange={(e) => setYCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
        {chartType === "histogram" && (
          <div className="mb-4 flex flex-wrap items-center gap-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.distributionColumnLabel")}</label>
              <select value={histogramCol} onChange={(e) => setHistogramCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <label className="flex items-center gap-2 cursor-pointer mt-6">
              <input type="checkbox" checked={showHistogramDensity} onChange={(e) => setShowHistogramDensity(e.target.checked)} className="rounded border-neutral-400" />
              <span className="text-sm text-neutral-700 dark:text-neutral-300">{t("presentationView.showKdeLabel")}</span>
            </label>
          </div>
        )}
        {chartType === "density" && (
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.densityGroupLabel")}</label>
              <select value={densityGroupCol} onChange={(e) => setDensityGroupCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("presentationView.densityValueLabel")}</label>
              <select value={densityValueCol} onChange={(e) => setDensityValueCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
          </div>
          <AIAssistPanel
            context={visualizationContext}
            quickPrompts={visualizationQuickPrompts}
            defaultSystemHint={`${t("presentationView.askAiChartHint")} ${aiAnswerLangHint()}`}
            title={t("presentationView.askAiChartTitle")}
            includeStandardResultPrompts={false}
          />
        </div>
        {chartType === "scatter" && isScatter && chartData.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid />
                  <XAxis dataKey="x" name={xCol} />
                  <YAxis dataKey="y" name={yCol} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  <Scatter data={chartData} fill="#0061bb" name={t("presentationView.scatterPointName")} />
                </ScatterChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {chartType === "scatter" && (() => {
          if (!xCol || !yCol) return <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">{t("presentationView.scatterNoAxisWarningPart1")} <strong>{t("presentationView.axisXLabel")}</strong> {t("presentationView.scatterNoDataPart2")} <strong>{t("presentationView.axisYLabel")}</strong> {t("presentationView.scatterNoAxisWarningPart2")}</p>;
          if (!numericCols.includes(xCol)) return <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">{t("presentationView.scatterXNotNumericPart1")} <strong>"{xCol}"</strong> {t("presentationView.scatterXNotNumericPart2")}</p>;
          if (!numericCols.includes(yCol)) return <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">{t("presentationView.scatterYNotNumericPart1")} <strong>"{yCol}"</strong> {t("presentationView.scatterYNotNumericPart2")}</p>;
          if (chartData.length === 0) return <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">{t("presentationView.scatterNoDataPart1")} <strong>"{xCol}"</strong> {t("presentationView.scatterNoDataPart2")} <strong>"{yCol}"</strong> {t("presentationView.scatterNoDataPart3")}</p>;
          return null;
        })()}
        {chartType === "density" && densityData.length > 0 && (() => {
          const keys = densityData.map((d) => d.group);
          const merged = densityData[0].points.map((_, i) => ({
            x: densityData[0].points[i].x,
            ...Object.fromEntries(keys.map((k, j) => [k, densityData[j].points[i].density])),
          }));
          return (
            <div className="relative group" data-chart-export-wrapper>
              {chartExportIcons}
              <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <LineChart data={merged} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" name={densityValueCol} type="number" tick={{ fontSize: 11 }} />
                    <YAxis name={t("presentationView.densityYAxisLabel")} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Legend />
                    {keys.map((key, i) => (
                      <Line key={key} type="monotone" dataKey={key} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={false} name={key} />
                    ))}
                  </LineChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}
        {chartType === "bar" && barDataSorted.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barDataSorted} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0061bb" name={yCol && numericCols.includes(yCol) ? `${t("presentationView.barTotalPrefix")} ${yCol}` : t("presentationView.barCountLabel")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {chartType === "barH" && xCol && barDataSorted.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={barDataSorted} layout="vertical" margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" />
                  <YAxis type="category" dataKey="name" width={100} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0061bb" name={yCol && numericCols.includes(yCol) ? `${t("presentationView.barTotalPrefix")} ${yCol}` : t("presentationView.barCountLabel")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {chartType === "line" && lineData.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={lineData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" name={xCol} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="y" name={yCol} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Line type="monotone" dataKey="y" stroke="#0061bb" strokeWidth={2} dot={{ r: 4 }} name={yCol || t("presentationView.lineDefaultValueName")} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {chartType === "pie" && pieData.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent != null ? percent * 100 : 0).toFixed(0)}%`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, t("presentationView.barCountLabel")]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {chartType === "donut" && pieData.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={60} label={({ name, percent }) => `${name} ${(percent != null ? percent * 100 : 0).toFixed(0)}%`}>
                    {pieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v: number) => [v, t("presentationView.barCountLabel")]} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {chartType === "box" && boxChartData.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={boxChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={["auto", "auto"]} allowDataOverflow />
                  <Tooltip content={({ active, payload }) => {
                    if (!active || !payload?.length || !payload[0].payload) return null;
                    const b = payload[0].payload as { name: string; min: number; q1: number; median: number; q3: number; max: number; n: number };
                    return (
                      <div className="rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-2 text-sm shadow-lg">
                        <p className="font-medium">{b.name}</p>
                        <p>n = {b.n} | Min = {b.min.toFixed(2)} | Q1 = {b.q1.toFixed(2)} | Median = {b.median.toFixed(2)} | Q3 = {b.q3.toFixed(2)} | Max = {b.max.toFixed(2)}</p>
                      </div>
                    );
                  }} />
                  {boxStats.map((b) => (
                    <React.Fragment key={b.group}>
                      <ReferenceArea x1={b.group} x2={b.group} y1={b.q1} y2={b.q3} fill="#0061bb" fillOpacity={0.5} stroke="#0061bb" strokeWidth={1} />
                      <ReferenceLine x={b.group} y={b.median} stroke="#111" strokeWidth={2} />
                      <ReferenceLine segment={[{ x: b.group, y: b.q3 }, { x: b.group, y: b.max }]} stroke="#333" strokeWidth={1} />
                      <ReferenceLine segment={[{ x: b.group, y: b.q1 }, { x: b.group, y: b.min }]} stroke="#333" strokeWidth={1} />
                    </React.Fragment>
                  ))}
                </ComposedChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
              <table className="w-full">
                <thead><tr className="border-b border-neutral-200 dark:border-neutral-700"><th className="p-2 text-left">{t("presentationView.groupColumnHeader")}</th><th className="p-2 text-right">n</th><th className="p-2 text-right">Min</th><th className="p-2 text-right">Q1</th><th className="p-2 text-right">Median</th><th className="p-2 text-right">Q3</th><th className="p-2 text-right">Max</th></tr></thead>
                <tbody>
                  {boxStats.map((b) => (
                    <tr key={b.group} className="border-b border-neutral-100 dark:border-neutral-700/50">
                      <td className="p-2 font-medium">{b.group}</td><td className="p-2 text-right">{b.n}</td>
                      <td className="p-2 text-right">{b.min.toFixed(2)}</td><td className="p-2 text-right">{b.q1.toFixed(2)}</td><td className="p-2 text-right">{b.median.toFixed(2)}</td><td className="p-2 text-right">{b.q3.toFixed(2)}</td><td className="p-2 text-right">{b.max.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
        {chartType === "histogram" && histChartData.length > 0 && !(showHistogramDensity && histComboData.length > 0) && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={histChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" label={{ value: histogramCol, position: "insideBottom", offset: -5 }} />
                  <YAxis label={{ value: t("presentationView.histogramFrequencyLabel"), angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0061bb" name={t("presentationView.histogramFrequencyLabel")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {chartType === "histogram" && showHistogramDensity && histComboData.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <ComposedChart data={histComboData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" label={{ value: histogramCol, position: "insideBottom", offset: -5 }} />
                  <YAxis label={{ value: t("presentationView.histogramFrequencyDensityLabel"), angle: -90, position: "insideLeft" }} />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0061bb" name={t("presentationView.histogramFrequencyLabel")} />
                  <Line type="monotone" dataKey="densityScaled" stroke="#f59e0b" strokeWidth={2} dot={false} name={t("presentationView.kdeLineLabel")} />
                </ComposedChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {chartType === "area" && areaData.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={areaData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" name={xCol} tick={{ fontSize: 11 }} />
                  <YAxis dataKey="y" name={yCol} tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Area type="monotone" dataKey="y" stroke="#0061bb" fill="#0061bb" fillOpacity={0.4} name={yCol || t("presentationView.lineDefaultValueName")} />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {chartType === "stackedBar" && stackedBarData.length > 0 && (() => {
          const stackKeys = Object.keys(stackedBarData[0] || {}).filter((k) => k !== "name");
          return (
            <div className="relative group" data-chart-export-wrapper>
              {chartExportIcons}
              <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={stackedBarData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis />
                    <Tooltip />
                    <Legend />
                    {stackKeys.map((key, i) => (
                      <Bar key={key} dataKey={key} stackId="stack" fill={PIE_COLORS[i % PIE_COLORS.length]} name={key.length > 16 ? key.slice(0, 14) + "…" : key} />
                    ))}
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}
        {chartType === "radar" && radarData.length > 0 && (() => {
          const radarKeys = Object.keys(radarData[0] || {}).filter((k) => k !== "subject" && k !== "fullMark");
          return (
            <div className="relative group" data-chart-export-wrapper>
              {chartExportIcons}
              <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
                <ResponsiveContainer width="100%" height="100%">
                  <RadarChart data={radarData}>
                    <PolarGrid />
                    <PolarAngleAxis dataKey="subject" />
                    <PolarRadiusAxis angle={90} domain={[0, "auto"]} />
                    {radarKeys.map((key, i) => (
                      <Radar key={key} name={key} dataKey={key} stroke={PIE_COLORS[i % PIE_COLORS.length]} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.3} strokeWidth={2} />
                    ))}
                    <Legend />
                  </RadarChart>
                </ResponsiveContainer>
              </div>
            </div>
          );
        })()}
        {chartType === "multiLine" && multiLineData.length > 0 && multiLineYCols.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={multiLineData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                  <YAxis tick={{ fontSize: 11 }} />
                  <Tooltip />
                  <Legend />
                  {multiLineYCols.map((col, i) => (
                    <Line key={col} type="monotone" dataKey={col} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} name={col.length > 14 ? col.slice(0, 12) + "…" : col} />
                  ))}
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {chartType === "crosstab" && crosstabResult && (
          <div className="space-y-3">
            <AIAssistPanel
              context={`Bảng chéo trực quan: hàng ${crosstabCol1}, cột ${crosstabCol2}. Hàng: ${crosstabResult.rowLabels.join(", ")}. Cột: ${crosstabResult.colLabels.join(", ")}. Tổng: ${crosstabResult.counts.reduce((a, row) => a + row.reduce((b, c) => b + c, 0), 0)}.`}
              quickPrompts={[{ label: t("presentationView.crosstabAskAiLabel"), systemHint: `${t("presentationView.crosstabAskAiHint")} ${aiAnswerLangHint()}` }]}
              title={t("presentationView.crosstabAskAiTitle")}
            />
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-left font-medium">{crosstabCol1} \\ {crosstabCol2}</th>
                    {crosstabResult.colLabels.map((l) => (
                      <th key={l} className="p-2 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-left font-medium">{l}</th>
                    ))}
                    <th className="p-2 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-right font-medium">{t("presentationView.barTotalPrefix")}</th>
                  </tr>
                </thead>
                <tbody>
                  {crosstabResult.rowLabels.map((rowLabel, i) => {
                    const rowCounts = crosstabResult.counts[i];
                    const rowSum = rowCounts.reduce((a, b) => a + b, 0);
                    return (
                      <tr key={rowLabel}>
                        <td className="p-2 border border-neutral-200 dark:border-neutral-600 font-medium">{rowLabel}</td>
                        {rowCounts.map((v, j) => (
                          <td key={j} className="p-2 border border-neutral-200 dark:border-neutral-600 text-right">{v}</td>
                        ))}
                        <td className="p-2 border border-neutral-200 dark:border-neutral-600 text-right font-medium">{rowSum}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                    <td className="p-2 border border-neutral-200 dark:border-neutral-600 font-medium">{t("presentationView.barTotalPrefix")}</td>
                    {crosstabResult.colLabels.map((_, j) => {
                      const colSum = crosstabResult.counts.reduce((acc, row) => acc + row[j], 0);
                      return <td key={j} className="p-2 border border-neutral-200 dark:border-neutral-600 text-right font-medium">{colSum}</td>;
                    })}
                    <td className="p-2 border border-neutral-200 dark:border-neutral-600 text-right font-medium">{crosstabResult.counts.reduce((a, row) => a + row.reduce((b, c) => b + c, 0), 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="h-64 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={crosstabResult.rowLabels.map((name, i) => ({ name: name.length > 10 ? name.slice(0, 8) + "…" : name, ...Object.fromEntries(crosstabResult.colLabels.map((col, j) => [col, crosstabResult.counts[i][j]])), total: crosstabResult.counts[i].reduce((a, b) => a + b, 0) }))} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  {crosstabResult.colLabels.slice(0, 8).map((col, i) => (
                    <Bar key={col} dataKey={col} stackId="ct" fill={PIE_COLORS[i % PIE_COLORS.length]} name={col.length > 12 ? col.slice(0, 10) + "…" : col} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {chartType === "heatmap" && corrResult && (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto overflow-y-auto max-h-96 space-y-2">
            <div className="p-2">
              <AIAssistPanel
                context={`Ma trận tương quan (trực quan): ${corrResult.columnNames.join(", ")}. Mẫu hệ số: ${corrResult.matrix.slice(0, 3).map((row, i) => `${corrResult.columnNames[i]}: ${row.slice(0, 4).map((v) => v.toFixed(2)).join(", ")}`).join("; ")}.`}
                quickPrompts={[{ label: t("presentationView.heatmapAskAiLabel"), systemHint: `${t("presentationView.heatmapAskAiHint")} ${aiAnswerLangHint()}` }]}
                title={t("presentationView.heatmapAskAiTitle")}
              />
            </div>
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-1.5 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 font-medium" />
                  {corrResult.columnNames.map((c) => (
                    <th key={c} className="p-1.5 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 font-medium text-left whitespace-nowrap max-w-[120px] truncate" title={c}>{c.length > 12 ? c.slice(0, 10) + "…" : c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corrResult.matrix.map((row, i) => (
                  <tr key={i}>
                    <td className="p-1.5 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 font-medium whitespace-nowrap max-w-[120px] truncate" title={corrResult.columnNames[i]}>{corrResult.columnNames[i].length > 12 ? corrResult.columnNames[i].slice(0, 10) + "…" : corrResult.columnNames[i]}</td>
                    {row.map((v, j) => {
                      const r = v >= 0 ? 255 : Math.round(255 * (1 + v));
                      const g = Math.round(255 * (1 - Math.abs(v)));
                      const b = v <= 0 ? 255 : Math.round(255 * (1 - v));
                      const bg = `rgb(${r},${g},${b})`;
                      return (
                        <td key={j} className="p-1.5 border border-neutral-200 dark:border-neutral-600 text-center" style={{ backgroundColor: bg }} title={`${corrResult.columnNames[i]} vs ${corrResult.columnNames[j]}: ${v.toFixed(3)}`}>
                          {v.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {chartType === "summary" && summaryStats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summaryStats.slice(0, 24).map((s) => (
              <div key={s.column} className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-3">
                <p className="font-medium text-sm truncate" title={s.column}>{s.column}</p>
                <p className="text-xs text-neutral-500 mt-0.5">n = {s.n} | {t("presentationView.missingPrefix")} {s.missing}</p>
                {s.mean != null && <p className="text-sm mt-1">{t("presentationView.meanPrefix")} {s.mean.toFixed(2)}{s.std != null ? ` (${t("presentationView.sdAbbrev")}): ${s.std.toFixed(2)}` : ""}</p>}
                {s.median != null && <p className="text-xs text-neutral-600 dark:text-neutral-400">{t("presentationView.medianPrefix")} {s.median.toFixed(2)}</p>}
                {s.min != null && s.max != null && <p className="text-xs text-neutral-500">{t("presentationView.minMaxPrefix")} {s.min.toFixed(2)} – {s.max.toFixed(2)}</p>}
              </div>
            ))}
          </div>
        )}
        {chartType === "dashboard" && (dashboardStats.length > 0 || (dashboardCorrResult && dashboardCorrResult.columnNames.length >= 2)) && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{t("presentationView.quickSummaryHeading")}</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {dashboardStats.slice(0, 6).map((s) => (
                <div key={s.column} className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-2">
                  <p className="text-xs font-medium truncate" title={s.column}>{s.column.length > 10 ? s.column.slice(0, 8) + "…" : s.column}</p>
                  <p className="text-xs text-neutral-500">n={s.n}</p>
                  {s.mean != null && <p className="text-xs">{s.mean.toFixed(1)}</p>}
                </div>
              ))}
            </div>
            {dashboardCorrResult && dashboardCorrResult.columnNames.length >= 2 && (
              <>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">{t("presentationView.correlationMatrixPearsonHeading")}</h3>
                <div className="overflow-x-auto overflow-y-auto max-h-64 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <table className="border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="p-1 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700" />
                        {dashboardCorrResult.columnNames.map((c) => (
                          <th key={c} className="p-1 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 truncate max-w-[80px]" title={c}>{c.length > 8 ? c.slice(0, 6) + "…" : c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardCorrResult.matrix.map((row, i) => (
                        <tr key={i}>
                          <td className="p-1 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 truncate max-w-[80px]" title={dashboardCorrResult.columnNames[i]}>{dashboardCorrResult.columnNames[i].length > 8 ? dashboardCorrResult.columnNames[i].slice(0, 6) + "…" : dashboardCorrResult.columnNames[i]}</td>
                          {row.map((v, j) => {
                            const r = v >= 0 ? 255 : Math.round(255 * (1 + v));
                            const g = Math.round(255 * (1 - Math.abs(v)));
                            const b = v <= 0 ? 255 : Math.round(255 * (1 - v));
                            return (
                              <td key={j} className="p-1 border border-neutral-200 dark:border-neutral-600 text-center" style={{ backgroundColor: `rgb(${r},${g},${b})` }} title={v.toFixed(3)}>{v.toFixed(2)}</td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
        {chartType === "bar" && xCol && barChartData.length === 0 && <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">{t("presentationView.barNoDataPart1")} &quot;{xCol}&quot;{yCol ? ` ${t("presentationView.barNoDataYAxisSuffix")} ${yCol})` : ""}. {t("presentationView.barNoDataPart2")}</p>}
        {chartType === "line" && (!xCol || !yCol || lineData.length === 0) && <p className="text-neutral-500 text-sm">{t("presentationView.lineEmptyHint")}</p>}
        {chartType === "area" && (!xCol || !yCol || areaData.length === 0) && <p className="text-neutral-500 text-sm">{t("presentationView.areaEmptyHint")}</p>}
        {chartType === "stackedBar" && (!xCol || !stackByCol || !yCol || stackedBarData.length === 0) && <p className="text-neutral-500 text-sm">{t("presentationView.stackedBarEmptyHint")}</p>}
        {chartType === "pie" && (!xCol || pieData.length === 0) && <p className="text-neutral-500 text-sm">{t("presentationView.pieEmptyHint")}</p>}
        {chartType === "box" && (!xCol || !yCol || boxChartData.length === 0) && <p className="text-neutral-500 text-sm">{t("presentationView.boxEmptyHint")}</p>}
        {chartType === "histogram" && !histogramCol && <p className="text-neutral-500 text-sm">{t("presentationView.histogramEmptyHint")}</p>}
        {chartType === "density" && (!densityGroupCol || !densityValueCol) && <p className="text-neutral-500 text-sm">{t("presentationView.densityEmptyHint")}</p>}
        {chartType === "radar" && radarNumericCols.length < 2 && <p className="text-neutral-500 text-sm">{t("presentationView.radarEmptyHint")}</p>}
        {chartType === "heatmap" && (!corrResult || corrResult.columnNames.length < 2) && <p className="text-neutral-500 text-sm">{t("presentationView.heatmapEmptyHint")}</p>}
        {chartType === "summary" && summaryStats.length === 0 && <p className="text-neutral-500 text-sm">{t("presentationView.summaryEmptyHint")}</p>}
        {chartType === "donut" && (!xCol || pieData.length === 0) && <p className="text-neutral-500 text-sm">{t("presentationView.donutEmptyHint")}</p>}
        {chartType === "barH" && (!xCol || barChartData.length === 0) && <p className="text-neutral-500 text-sm">{t("presentationView.barHEmptyHint")}</p>}
        {chartType === "dashboard" && dashboardStats.length === 0 && !(dashboardCorrResult && dashboardCorrResult.columnNames.length >= 2) && <p className="text-neutral-500 text-sm">{t("presentationView.dashboardEmptyHint")}</p>}
      </div>
    );
  }
  if (tab === "visualization") return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">{t("presentationView.title")}</h2>
      <p className="text-neutral-500">{t("presentationView.noDatasetHint")}</p>
      <p className="text-sm text-neutral-500 mt-2">{t("presentationView.useAiGuidePrefix")} <strong>{t("aiAssistView.title")}</strong> {t("presentationView.useAiGuideSuffix")}</p>
    </div>
  );

  return null;
}
