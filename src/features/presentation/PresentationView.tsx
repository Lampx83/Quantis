import React, { useState, useRef, useEffect } from "react";
import { Download, Copy, SlidersHorizontal, PanelRightOpen } from "lucide-react";
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
  ErrorBar,
  LabelList,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
} from "recharts";
import type { Dataset, ChartConfig, ChartControls } from "@/types";
import { DEFAULT_CHART_CONFIG } from "@/types";
import {
  ChartInspectorPanel,
  usesConfigAxes,
  supportsLegend,
  supportsAutoTitle,
} from "./ChartInspectorPanel";
import { pivotByLegend, getSeriesKeys, calculateErrorOffsets } from "@/utils/seriesPivot";
import { computeAxisScale } from "@/utils/chartScale";
import { ChartPlaceholderFrame } from "./ChartPlaceholderFrame";
import { getPaletteColor } from "./colorPalettes";
import type { PresentationTab, PresentationChartType } from "@/stores";
import type {
  TTestResult,
  ChiSquareResult,
  ANOVAResult,
  MannWhitneyResult,
} from "@/utils/stats";
import {
  numCell,
  getAnalysisRows,
  getBoxStatsByGroup,
  getHistogramBins,
  binNumericForPie,
  computeCorrelationMatrix,
  computeDescriptive,
  getCrosstab,
  kernelDensityEstimate,
} from "@/utils/stats";
import { safeMax, safeMin, safeMinMax } from "@/utils/math";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel, type AIQuickPrompt } from "@/features/ai";
import {
  aggregateData,
  type AggregateFunction,
  type AggregateMetrics,
} from "@/utils/aggregation";

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
  initialXCol?: string;
  initialYCol?: string;
  initialYAggregation?: AggregateFunction;
  initialConfig?: Partial<ChartConfig>;
  initialControls?: Partial<ChartControls>;
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
  initialXCol = "",
  initialYCol = "",
  initialYAggregation = "mean",
  initialConfig,
  initialControls,
}: PresentationViewProps) {
  const [chartConfig, setChartConfig] = useState<ChartConfig>(() => ({
    ...DEFAULT_CHART_CONFIG,
    xCol: initialConfig?.xCol ?? initialXCol,
    yCol: initialConfig?.yCol ?? initialYCol,
    aggregation: initialConfig?.aggregation ?? initialYAggregation,
    ...initialConfig,
    showDataLabels: initialConfig?.showDataLabels ?? (chartType === "pie" || chartType === "donut"),
  }));
  const [isInspectorOpen, setIsInspectorOpen] = useState(true);
  const [yAggregation] = useState<AggregateFunction>(initialYAggregation);
  const [histogramCol, setHistogramCol] = useState(initialControls?.histogramCol ?? "");
  const [showHistogramDensity, setShowHistogramDensity] = useState(initialControls?.showHistogramDensity ?? false);
  const [stackByCol, setStackByCol] = useState("");
  const [heatmapCorrMethod, setHeatmapCorrMethod] = useState<"pearson" | "spearman" | "kendall">(initialControls?.heatmapCorrMethod ?? "pearson");
  const [radarGroupCol, setRadarGroupCol] = useState(initialControls?.radarGroupCol ?? "");
  const [radarNumericCols, setRadarNumericCols] = useState<string[]>(initialControls?.radarNumericCols ?? []);
  const [multiLineYCols] = useState<string[]>([]);
  const [crosstabCol1] = useState("");
  const [crosstabCol2] = useState("");
  const [densityGroupCol, setDensityGroupCol] = useState(initialControls?.densityGroupCol ?? "");
  const [densityValueCol, setDensityValueCol] = useState(initialControls?.densityValueCol ?? "");
  const [pieBinNumeric, setPieBinNumeric] = useState(initialControls?.pieBinNumeric ?? false);
  const [pieBinCount, setPieBinCount] = useState(initialControls?.pieBinCount ?? 4);
  const [pieNumericCol, setPieNumericCol] = useState(initialControls?.pieNumericCol ?? "");
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const prevChartTypeRef = useRef(chartType);

  useEffect(() => {
    const prev = prevChartTypeRef.current;
    prevChartTypeRef.current = chartType;
    if (prev !== chartType) {
      const isPieOrDonut = chartType === "pie" || chartType === "donut";
      const wasPieOrDonut = prev === "pie" || prev === "donut";
      if (isPieOrDonut && !wasPieOrDonut) {
        setChartConfig((c) => ({ ...c, showDataLabels: true }));
      } else if (!isPieOrDonut && wasPieOrDonut) {
        setChartConfig((c) => ({ ...c, showDataLabels: false }));
      }
    }
  }, [chartType]);
  const [boxStatsBackendResult, setBoxStatsBackendResult] = useState<Array<{ group: string; min: number; q1: number; median: number; q3: number; max: number; n: number }> | null>(null);
  const [histBinsBackendResult, setHistBinsBackendResult] = useState<Array<{ binStart: number; binEnd: number; count: number }> | null>(null);
  const PIE_COLORS = ["#0061bb", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

  useEffect(() => {
    if (tab !== "visualization" || !selectedDataset || chartType !== "box" || !chartConfig.xCol || !chartConfig.yCol || !analysisBackendAvailable) {
      setBoxStatsBackendResult(null);
      return;
    }
    const rows = getAnalysisRows(selectedDataset);
    quantisApi.analyzeBoxStats(rows, chartConfig.xCol, chartConfig.yCol).then(setBoxStatsBackendResult);
  }, [tab, selectedDataset?.id, chartType, chartConfig.xCol, chartConfig.yCol, analysisBackendAvailable]);

  useEffect(() => {
    if (tab !== "visualization" || !selectedDataset || chartType !== "histogram" || !histogramCol || !analysisBackendAvailable) {
      setHistBinsBackendResult(null);
      return;
    }
    const rows = getAnalysisRows(selectedDataset);
    const cols = selectedDataset.columnNames || [];
    const histColIdx = cols.indexOf(histogramCol);
    const histValues = histColIdx >= 0 ? rows.slice(1).map((r) => numCell(r[histColIdx])).filter((v) => !Number.isNaN(v)) : [];
    if (histValues.length === 0) { setHistBinsBackendResult(null); return; }
    quantisApi.analyzeHistogramBins(histValues).then(setHistBinsBackendResult);
  }, [tab, selectedDataset?.id, chartType, histogramCol, analysisBackendAvailable]);

  if (tab === "visualization" && selectedDataset) {
    const rows = getAnalysisRows(selectedDataset);
    const cols = selectedDataset.columnNames || [];
    const xCol = chartConfig.xCol;
    const setXCol = (val: string) => setChartConfig((c) => ({ ...c, xCol: val }));
    const yCol = chartConfig.yCol;
    const setYCol = (val: string) => setChartConfig((c) => ({ ...c, yCol: val }));
    const activeYAggregation = usesConfigAxes(chartType) ? chartConfig.aggregation : yAggregation;
    const numericCols = rows.length >= 2 ? cols.filter((c) => { const ci = rows[0].indexOf(c); const vals = rows.slice(1).map((r) => r[ci]); return vals.every((v) => v === "" || !Number.isNaN(Number(v))); }) : [];
    const xIdx = cols.indexOf(xCol);
    const yIdx = cols.indexOf(yCol);
    const isScatter = xCol && yCol && numericCols.includes(xCol) && numericCols.includes(yCol);
    const chartData = rows.length >= 2 && xIdx >= 0 && yIdx >= 0
      ? rows.slice(1).map((r) => ({ x: isScatter ? numCell(r[xIdx]) : r[xIdx], y: numCell(r[yIdx]) })).filter((d) => !Number.isNaN(d.y) && (!isScatter || !Number.isNaN(Number(d.x))))
      : [];
    const barData = !isScatter && xCol && xIdx >= 0 ? (() => { const counts: Record<string, number> = {}; rows.slice(1).forEach((r) => { const v = r[xIdx] ??""; counts[v] = (counts[v] || 0) + 1; }); return Object.entries(counts).map(([name, count]) => ({ name, count })).slice(0, 20); })() : [];
    /** Biểu đồ cột: dùng X làm danh mục; nếu có Y (số) thì tính theo hàm gộp đã chọn, không thì = tần số */
    const barChartData = (chartType === "bar" || chartType === "barH") && xCol && xIdx >= 0
      ? (yCol && yIdx >= 0 && numericCols.includes(yCol)
          ? aggregateData(rows, {
              groupByCols: [xCol],
              measureCol: yCol,
              func: activeYAggregation,
              limit: 30,
              sortOrder: chartConfig.sortOrder,
            }).map((g) => ({
              name: g.name,
              count: g.value,
              metrics: g.metrics,
              error: calculateErrorOffsets(g.metrics, chartConfig.errorBar),
            }))
          : (() => {
              const counts: Record<string, number> = {};
              rows.slice(1).forEach((r) => {
                const v = r[xIdx] ?? "";
                counts[v] = (counts[v] || 0) + 1;
              });
              let entries = Object.entries(counts).map(([name, count]) => ({ name, count }));
              const sortMode = chartConfig.sortOrder || "category-asc";
              if (sortMode === "category-asc") {
                entries.sort((a, b) =>
                  a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
                );
              } else if (sortMode === "category-desc") {
                entries.sort((a, b) =>
                  b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: "base" })
                );
              } else if (sortMode === "value-asc") {
                entries.sort((a, b) => a.count - b.count);
              } else if (sortMode === "value-desc") {
                entries.sort((a, b) => b.count - a.count);
              }
              return entries.slice(0, 30);
            })())
      : barData;
    const barDataSorted = barChartData;
    const boxStats = (chartType === "box" && xCol && yCol && numericCols.includes(yCol))
      ? (analysisBackendAvailable && boxStatsBackendResult ? boxStatsBackendResult : getBoxStatsByGroup(rows, xCol, yCol))
      : [];
    // Hộp xếp chồng: phần đệm trong suốt (0→Q1) + hộp Q1→Median + hộp Median→Q3; râu = ErrorBar (Q1→Min, Q3→Max).
    const boxChartData = boxStats.map((b) => ({ name: b.group, median: b.median, min: b.min, max: b.max, q1: b.q1, q3: b.q3, n: b.n, boxLower: b.median - b.q1, boxUpper: b.q3 - b.median, whiskerLow: [b.q1 - b.min, 0], whiskerHigh: [0, b.max - b.q3] }));
    const boxYDomain: [number, number] = (() => {
      if (boxStats.length === 0) return [0, 1];
      const lo = safeMin(boxStats.map((b) => b.min));
      const hi = safeMax(boxStats.map((b) => b.max));
      const pad = (hi - lo) * 0.05 || 1;
      return [Math.floor(lo - pad), Math.ceil(hi + pad)];
    })();
    const densityGroupIdx = densityGroupCol ? cols.indexOf(densityGroupCol) : -1;
    const densityValueIdx = densityValueCol ? cols.indexOf(densityValueCol) : -1;
    const densityData = (chartType === "density" && densityGroupCol && densityValueCol && numericCols.includes(densityValueCol) && densityGroupIdx >= 0 && densityValueIdx >= 0 && rows.length >= 2) ? (() => {
      const groups: Record<string, number[]> = {};
      rows.slice(1).forEach((r) => {
        const g = String(r[densityGroupIdx] ?? "").trim();
        const v = numCell(r[densityValueIdx]);
        if (g === "" || Number.isNaN(v)) return;
        if (!groups[g]) groups[g] = [];
        groups[g].push(v);
      });
      const allVals = Object.values(groups).flat();
      if (allVals.length < 2) return [];
      const [lo, hi] = safeMinMax(allVals);
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
    const histValues = histogramCol && histColIdx >= 0 ? rows.slice(1).map((r) => numCell(r[histColIdx])).filter((v) => !Number.isNaN(v)) : [];
    const histBins = histValues.length > 0 ? (analysisBackendAvailable && histBinsBackendResult ? histBinsBackendResult : getHistogramBins(histValues)) : [];
    const histChartData = histBins.map((b) => ({ name: b.binStart.toFixed(1) + "–" + b.binEnd.toFixed(1), count: b.count }));
    const histDensityCurve = (chartType === "histogram" && showHistogramDensity && histValues.length >= 2) ? (() => {
      const [lo, hi] = safeMinMax(histValues);
      const grid = Array.from({ length: 80 }, (_, i) => lo + (hi - lo) * i / 79);
      return kernelDensityEstimate(histValues, grid).map((p) => ({ x: p.x, density: p.density }));
    })() : [];
    const histComboData = (chartType === "histogram" && showHistogramDensity && histChartData.length > 0 && histDensityCurve.length > 0) ? (() => {
      const maxCount = safeMax(histChartData.map((d) => d.count));
      const maxDens = safeMax(histDensityCurve.map((d) => d.density));
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
              const vals = rows.slice(1).map((r) => numCell(r[idx])).filter((v) => !Number.isNaN(v));
              const binned = binNumericForPie(vals, pieBinCount);
              return binned.map((b) => ({ name: b.label, value: b.count })).filter((d) => d.value > 0);
            })()
          : (xCol && xIdx >= 0
              ? (yCol && yIdx >= 0 && numericCols.includes(yCol)
                  ? aggregateData(rows, {
                      groupByCols: [xCol],
                      measureCol: yCol,
                      func: chartConfig.aggregation || "sum",
                      limit: 30,
                    })
                      .map((g) => ({ name: g.name, value: g.value, metrics: g.metrics }))
                      .filter((d) => Number.isFinite(d.value) && d.value > 0)
                  : (() => {
                      const counts: Record<string, number> = {};
                      rows.slice(1).forEach((r) => {
                        const v = String(r[xIdx] ?? "").trim();
                        if (v !== "") counts[v] = (counts[v] || 0) + 1;
                      });
                      return Object.entries(counts)
                        .map(([name, count]) => ({ name, value: count }))
                        .filter((d) => d.value > 0)
                        .slice(0, 24);
                    })())
              : []))
      : (barData.length > 0 ? barData.map((d) => ({ name: d.name, value: d.count })) : []);
    const lineData = rows.length >= 2 && xIdx >= 0 && yIdx >= 0
      ? rows.slice(1).map((r) => ({ x: r[xIdx] ??"", y: numCell(r[yIdx]) })).filter((d) => !Number.isNaN(d.y))
      : [];
    const areaData = lineData;
    const lineChartData = (chartType === "line" && xCol && yCol && xIdx >= 0 && yIdx >= 0 && numericCols.includes(yCol))
      ? aggregateData(rows, {
          groupByCols: [xCol],
          measureCol: yCol,
          func: activeYAggregation,
          limit: 30,
        }).map((g) => ({
          x: g.name,
          y: g.value,
          metrics: g.metrics,
          error: calculateErrorOffsets(g.metrics, chartConfig.errorBar),
        }))
      : lineData;
    const variables = selectedDataset?.variables ?? {};
    const xLabel = xCol ? (variables[xCol]?.label?.trim() || xCol) : "";
    const yLabel = yCol ? (variables[yCol]?.label?.trim() || yCol) : "";
    const legendLabel = chartConfig.legendCol ? (variables[chartConfig.legendCol]?.label?.trim() || chartConfig.legendCol) : "";

    const isAggregated = Boolean(yCol && yIdx >= 0 && numericCols.includes(yCol));
    const activeAggLegendName = isAggregated
      ? `${t("presentationView.aggLabel." + activeYAggregation)} ${t("presentationView.ofPreposition")} ${yLabel}`
      : "";

    const renderAggTooltip = ({ active, payload }: { active?: boolean; payload?: any[] }) => {
      if (!active || !payload?.length || !payload[0]?.payload) return null;
      const p = payload[0].payload as { name?: string; x?: string; count?: number; y?: number; metrics?: AggregateMetrics };
      const label = p.name ?? p.x ?? "";
      const val = p.count ?? p.y;
      if (!p.metrics) {
        return (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-2 text-sm shadow-lg">
            <p className="font-medium text-neutral-900 dark:text-neutral-100">{label}</p>
            <p className="text-neutral-600 dark:text-neutral-300">{val !== undefined ? val : ""}</p>
          </div>
        );
      }
      const formattedVal = val !== undefined ? Number(val).toFixed(2) : "";
      const stdVal = Number(p.metrics.std).toFixed(2);
      const funcLabel = t(`presentationView.aggLabel.${activeYAggregation}`);
      return (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-2 text-sm shadow-lg">
          <p className="font-medium text-neutral-900 dark:text-neutral-100">{label}</p>
          <p className="text-neutral-700 dark:text-neutral-200">
            <span className="font-medium">{funcLabel}:</span> {formattedVal}
          </p>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
            {t("presentationView.aggTooltipSampleSize")} = {p.metrics.count} | {t("presentationView.aggTooltipStd")} = {stdVal}
          </p>
        </div>
      );
    };
    const stackByIdx = stackByCol ? cols.indexOf(stackByCol) : -1;
    const stackedBarData = (chartType === "stackedBar" && xCol && stackByCol && yCol && xIdx >= 0 && yIdx >= 0 && stackByIdx >= 0 && rows.length >= 2) ? (() => {
      const xVals = Array.from(new Set(rows.slice(1).map((r) => r[xIdx] ??"")));
      const stackVals = Array.from(new Set(rows.slice(1).map((r) => r[stackByIdx] ??"")));
      const map: Record<string, Record<string, number>> = {};
      xVals.forEach((x) => { map[x] = {}; stackVals.forEach((s) => { map[x][s] = 0; }); });
      rows.slice(1).forEach((r) => {
        const x = r[xIdx] ??"";
        const s = r[stackByIdx] ??"";
        const y = numCell(r[yIdx]);
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
          const vals = subset.map((r) => numCell(r[colIdx])).filter((v) => !Number.isNaN(v));
          entry[g] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        });
        return entry;
      });
    })() : [];
    const corrResult = (chartType === "heatmap" && rows.length >= 2) ? computeCorrelationMatrix(rows, heatmapCorrMethod) : null;
    const summaryStats = (chartType === "summary" && rows.length >= 2) ? computeDescriptive(rows) : [];
    const dashboardCorrResult = (chartType === "dashboard" && rows.length >= 2) ? computeCorrelationMatrix(rows, "pearson") : null;
    const dashboardStats = (chartType === "dashboard" && rows.length >= 2) ? computeDescriptive(rows) : [];
    const multiLineXIdx = chartType === "multiLine" && xCol ? cols.indexOf(xCol) : -1;
    const multiLineData = (chartType === "multiLine" && multiLineXIdx >= 0 && multiLineYCols.length > 0 && rows.length >= 2) ? (() => {
      const yIndices = multiLineYCols.map((c) => cols.indexOf(c)).filter((i) => i >= 0);
      if (yIndices.length === 0) return [];
      return rows.slice(1).map((r) => {
        const point: Record<string, string | number> = { x: r[multiLineXIdx] ??"" };
        multiLineYCols.forEach((col) => {
          const idx = cols.indexOf(col);
          if (idx >= 0) { const v = numCell(r[idx]); point[col] = Number.isNaN(v) ? "" : v; }
        });
        return point;
      }).filter((d) => multiLineYCols.some((c) => d[c] !== "" && d[c] !== undefined));
    })() : [];
    const crosstabResult: { rowLabels: string[]; colLabels: string[]; counts: number[][] } | null = (chartType === "crosstab" && crosstabCol1 && crosstabCol2 && rows.length >= 2) ? getCrosstab(rows, crosstabCol1, crosstabCol2) : null;

        const hasLegend = Boolean(
      supportsLegend(chartType) &&
      chartConfig.legendCol &&
      chartConfig.legendCol.trim() !== "" &&
      cols.includes(chartConfig.legendCol) &&
      chartConfig.legendCol !== xCol
    );

    const { pivotedBarData, pivotedLineData, legendSeriesKeys } = (() => {
      if (!hasLegend || !xCol || xIdx < 0) {
        return { pivotedBarData: [], pivotedLineData: [], legendSeriesKeys: [] };
      }

      if (!isAggregated) {
        const legIdx = cols.indexOf(chartConfig.legendCol);
        if (legIdx < 0) return { pivotedBarData: [], pivotedLineData: [], legendSeriesKeys: [] };

        const countsMap = new Map<string, Map<string, number>>();
        const xOrder: string[] = [];
        for (let r = 1; r < rows.length; r++) {
          const row = rows[r];
          const xVal = String(row[xIdx] ?? "").trim();
          const legVal = String(row[legIdx] ?? "").trim();
          if (!xVal || !legVal) continue;
          if (!countsMap.has(xVal)) {
            xOrder.push(xVal);
            countsMap.set(xVal, new Map<string, number>());
          }
          const m = countsMap.get(xVal)!;
          m.set(legVal, (m.get(legVal) || 0) + 1);
        }

        const allKeys = new Set<string>();
        countsMap.forEach((m) => m.forEach((_, k) => allKeys.add(k)));
        const keys = Array.from(allKeys).sort((a, b) =>
          a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
        );

        const sortMode = chartConfig.sortOrder || "category-asc";
        const sortedXOrder = [...xOrder];
        if (sortMode === "category-asc") {
          sortedXOrder.sort((a, b) =>
            a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
          );
        } else if (sortMode === "category-desc") {
          sortedXOrder.sort((a, b) =>
            b.localeCompare(a, undefined, { numeric: true, sensitivity: "base" })
          );
        }

        const barDataList = sortedXOrder.slice(0, 30).map((name) => {
          const m = countsMap.get(name)!;
          const item: Record<string, any> = { name, _errors: {} };
          for (const k of keys) {
            item[k] = m.get(k) || 0;
          }
          return item;
        });

        return {
          pivotedBarData: barDataList,
          pivotedLineData: barDataList.map((d) => ({ ...d, x: d.name })),
          legendSeriesKeys: keys,
        };
      }

      const multiAgg = aggregateData(rows, {
        groupByCols: [xCol, chartConfig.legendCol],
        measureCol: yCol,
        func: activeYAggregation,
        limit: 1000,
      });
      const pivoted = pivotByLegend(multiAgg, chartConfig.legendCol, chartConfig.errorBar);
      const keys = getSeriesKeys(pivoted);

      const sortMode = chartConfig.sortOrder || "category-asc";
      const sortedPivoted = [...pivoted];
      if (sortMode === "category-asc") {
        sortedPivoted.sort((a, b) =>
          a.name.localeCompare(b.name, undefined, { numeric: true, sensitivity: "base" })
        );
      } else if (sortMode === "category-desc") {
        sortedPivoted.sort((a, b) =>
          b.name.localeCompare(a.name, undefined, { numeric: true, sensitivity: "base" })
        );
      }

      const barDataList = sortedPivoted.slice(0, 30).map((p) => {
        const item: Record<string, any> = {
          name: p.name,
          ...p.series,
          _errors: p.errors,
        };
        for (const [k, err] of Object.entries(p.errors)) {
          item[`_err_${k}`] = err;
        }
        return item;
      });
      const lineDataList = sortedPivoted.slice(0, 30).map((p) => {
        const item: Record<string, any> = {
          name: p.name,
          x: p.name,
          ...p.series,
          _errors: p.errors,
        };
        for (const [k, err] of Object.entries(p.errors)) {
          item[`_err_${k}`] = err;
        }
        return item;
      });
      return {
        pivotedBarData: barDataList,
        pivotedLineData: lineDataList,
        legendSeriesKeys: keys,
      };
    })();

    const showErrorBars = Boolean(
      isAggregated &&
      activeYAggregation === "mean" &&
      chartConfig.errorBar !== "none" &&
      ["bar", "barH", "line"].includes(chartType)
    );

    const barScale = computeAxisScale(
      hasLegend ? pivotedBarData : barDataSorted,
      {
        hasLegend,
        legendKeys: legendSeriesKeys,
        barMode: chartConfig.barMode,
        includeErrors: showErrorBars,
      },
      { isBar: true, padRatio: 0.15 }
    );

    const lineScale = computeAxisScale(
      hasLegend ? pivotedLineData : lineChartData,
      {
        hasLegend,
        legendKeys: legendSeriesKeys,
        includeErrors: showErrorBars,
      },
      { isBar: false, padRatio: 0.12 }
    );

    const autoTitle = (() => {
      if (!supportsAutoTitle(chartType)) return "";
      if (chartType === "scatter") {
        if (!xLabel || !yLabel) return "";
        const base = `${yLabel} vs ${xLabel}`;
        return hasLegend ? `${base} ${t("presentationView.autoTitleAnd")} ${legendLabel}` : base;
      }
      if (chartType === "pie" || chartType === "donut") {
        if (pieBinNumeric) {
          const col = pieNumericCol || xCol;
          const colLabel = col ? (variables[col]?.label?.trim() || col) : "";
          return colLabel ? t("presentationView.autoTitlePieBinned", { col: colLabel }) : "";
        }
        if (xLabel && yLabel && numericCols.includes(yCol)) {
          const aggFunc = chartConfig.aggregation || "sum";
          const aggPrefix = t("presentationView.aggLabel." + aggFunc);
          return `${aggPrefix} ${t("presentationView.ofPreposition")} ${yLabel} ${t("presentationView.autoTitleBy")} ${xLabel}`;
        }
        return xLabel ? t("presentationView.autoTitlePieCategorical", { x: xLabel }) : "";
      }
      if (chartType === "histogram") {
        const histLabel = histogramCol ? (variables[histogramCol]?.label?.trim() || histogramCol) : "";
        return histLabel ? t("presentationView.autoTitleHistogram", { col: histLabel }) : "";
      }
      if (chartType === "box") {
        if (xLabel && yLabel) {
          return t("presentationView.autoTitleBox", { x: xLabel, y: yLabel });
        }
        return yLabel || xLabel || "";
      }
      if (chartType === "area") {
        if (xLabel && yLabel) {
          return t("presentationView.autoTitleArea", { x: xLabel, y: yLabel });
        }
        return yLabel || xLabel || "";
      }
      if (chartType === "density") {
        const valLabel = densityValueCol ? (variables[densityValueCol]?.label?.trim() || densityValueCol) : "";
        const grpLabel = densityGroupCol ? (variables[densityGroupCol]?.label?.trim() || densityGroupCol) : "";
        if (valLabel && grpLabel) {
          return t("presentationView.autoTitleDensityGrouped", { x: grpLabel, y: valLabel });
        }
        if (valLabel) {
          return t("presentationView.autoTitleDensitySingle", { y: valLabel });
        }
        return "";
      }
      if (chartType === "heatmap") {
        const method = heatmapCorrMethod === "spearman" ? "Spearman" : heatmapCorrMethod === "kendall" ? "Kendall" : "Pearson";
        return t("presentationView.autoTitleHeatmap", { method });
      }
      if (chartType === "radar") {
        if (radarGroupCol) {
          const grpLabel = variables[radarGroupCol]?.label?.trim() || radarGroupCol;
          return t("presentationView.autoTitleRadarGrouped", { group: grpLabel });
        }
        return t("presentationView.autoTitleRadarNoGroup");
      }
      if (isAggregated) {
        const aggPrefix = activeYAggregation === "mean"
          ? t("presentationView.autoTitleMeanOf")
          : `${t("presentationView.aggLabel." + activeYAggregation)} ${t("presentationView.ofPreposition")}`;
        const base = `${aggPrefix} ${yLabel} ${t("presentationView.autoTitleBy")} ${xLabel}`;
        return hasLegend ? `${base} ${t("presentationView.autoTitleAnd")} ${legendLabel}` : base;
      }
      if (xLabel) {
        return xLabel;
      }
      return "";
    })();

    const effectiveTitle = (chartConfig.titleOverride && chartConfig.titleOverride.trim() !== "")
      ? chartConfig.titleOverride
      : autoTitle;

    const effectiveSubtitle = chartConfig.subtitle?.trim() || "";

    const chartTitleBlock = (effectiveTitle || effectiveSubtitle) ? (
      <div className="mb-3 text-center" data-testid="chart-title-block">
        {effectiveTitle && <h3 data-testid="chart-title" className="text-base font-semibold text-neutral-800 dark:text-neutral-100">{effectiveTitle}</h3>}
        {effectiveSubtitle && <p data-testid="chart-subtitle" className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{effectiveSubtitle}</p>}
      </div>
    ) : null;

    const activeDecimals = chartConfig.decimals ?? (yCol && variables[yCol]?.decimals !== undefined ? variables[yCol].decimals : 2);
    const formatDataLabel = (val: any) => {
      if (val === null || val === undefined || val === "" || Number.isNaN(Number(val))) return "";
      return Number(val).toFixed(activeDecimals);
    };

    const groupedScatterData = (() => {
      if (!hasLegend || !isScatter) {
        return [];
      }
      const legIdx = cols.indexOf(chartConfig.legendCol);
      if (legIdx < 0) return [];

      const map = new Map<string, Array<{ x: number; y: number }>>();
      for (let r = 1; r < rows.length; r++) {
        const row = rows[r];
        const legVal = String(row[legIdx] ?? "").trim();
        if (!legVal) continue;
        const xVal = numCell(row[xIdx]);
        const yVal = numCell(row[yIdx]);
        if (Number.isNaN(xVal) || Number.isNaN(yVal)) continue;

        let list = map.get(legVal);
        if (!list) {
          list = [];
          map.set(legVal, list);
        }
        list.push({ x: xVal, y: yVal });
      }

      const sortedKeys = Array.from(map.keys()).sort((a, b) => a.localeCompare(b));
      return sortedKeys.map((key) => ({
        key,
        points: map.get(key)!,
      }));
    })();

    const visualizationContext = [
      selectedDataset ? `${t("presentationView.contextDatasetLabel")} ${selectedDataset.name}, ${rows.length} ${t("transformTab.rowsUnit")}, ${cols.length} ${t("transformTab.columnsUnit")}.` : "",
      `${t("presentationView.contextChartTypeLabel")} ${chartType}.`,
      (chartType === "bar" || chartType === "barH" || chartType === "line") && yCol && numericCols.includes(yCol)
        ? `${t("presentationView.contextAggregationLabel")} ${t("presentationView.aggLabel." + activeYAggregation)}.`
        : "",
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
      chartType === "multiLine" && xCol ? `${t("presentationView.axisXLabel")}: ${xCol}, ${t("presentationView.contextMultiLineSuffix")}` : "",
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

    const hasExportableChart = (chartType === "scatter" && chartData.length > 0) || (chartType === "bar" && barChartData.length > 0) || (chartType === "barH" && barChartData.length > 0) || (chartType === "line" && lineChartData.length > 0) || (chartType === "pie" && pieData.length > 0) || (chartType === "donut" && pieData.length > 0) || (chartType === "area" && areaData.length > 0) || (chartType === "stackedBar" && stackedBarData.length > 0) || (chartType === "box" && boxChartData.length > 0) || (chartType === "histogram" && histChartData.length > 0) || (chartType === "density" && densityData.length > 0) || (chartType === "radar" && radarData.length > 0) || (chartType === "multiLine" && multiLineData.length > 0);

    const isChartRendered =
      (chartType === "scatter" && isScatter && (hasLegend ? groupedScatterData.length > 0 : chartData.length > 0)) ||
      (chartType === "bar" && (hasLegend ? pivotedBarData.length > 0 : barDataSorted.length > 0)) ||
      (chartType === "barH" && xCol && (hasLegend ? pivotedBarData.length > 0 : barDataSorted.length > 0)) ||
      (chartType === "line" && (hasLegend ? pivotedLineData.length > 0 : lineChartData.length > 0)) ||
      (chartType === "pie" && pieData.length > 0) ||
      (chartType === "donut" && pieData.length > 0) ||
      (chartType === "box" && boxChartData.length > 0) ||
      (chartType === "histogram" && histChartData.length > 0) ||
      (chartType === "area" && areaData.length > 0) ||
      (chartType === "stackedBar" && stackedBarData.length > 0) ||
      (chartType === "density" && densityData.length > 0) ||
      (chartType === "radar" && radarData.length > 0) ||
      (chartType === "multiLine" && multiLineData.length > 0 && multiLineYCols.length > 0) ||
      (chartType === "crosstab" && crosstabResult !== null) ||
      (chartType === "heatmap" && corrResult && corrResult.columnNames.length >= 2) ||
      (chartType === "summary" && summaryStats.length > 0) ||
      (chartType === "dashboard" && (dashboardStats.length > 0 || (dashboardCorrResult && dashboardCorrResult.columnNames.length >= 2)));

    const chartWarningMessage = (() => {
      if (chartType === "scatter") {
        if (xCol && !numericCols.includes(xCol)) {
          return `${t("presentationView.scatterXNotNumericPart1")} "${xCol}" ${t("presentationView.scatterXNotNumericPart2")}`;
        }
        if (yCol && !numericCols.includes(yCol)) {
          return `${t("presentationView.scatterYNotNumericPart1")} "${yCol}" ${t("presentationView.scatterYNotNumericPart2")}`;
        }
        if (xCol && yCol && chartData.length === 0) {
          return `${t("presentationView.scatterNoDataPart1")} "${xCol}" ${t("presentationView.scatterNoDataPart2")} "${yCol}" ${t("presentationView.scatterNoDataPart3")}`;
        }
      }
      if (chartType === "bar" && xCol && (hasLegend ? pivotedBarData.length === 0 : barChartData.length === 0)) {
        return `${t("presentationView.barNoDataPart1")} "${xCol}"${yCol ? ` ${t("presentationView.barNoDataYAxisSuffix")} ${yCol})` : ""}. ${t("presentationView.barNoDataPart2")}`;
      }
      if (chartType === "barH" && xCol && (hasLegend ? pivotedBarData.length === 0 : barChartData.length === 0)) {
        return `${t("presentationView.barNoDataPart1")} "${xCol}"${yCol ? ` ${t("presentationView.barNoDataYAxisSuffix")} ${yCol})` : ""}. ${t("presentationView.barNoDataPart2")}`;
      }
      if (chartType === "line" && xCol && yCol && lineChartData.length === 0) {
        return `${t("presentationView.placeholderNoDataFound")} ${t("presentationView.placeholderCheckVariables")}`;
      }
      if (chartType === "area" && xCol && yCol && areaData.length === 0) {
        return `${t("presentationView.placeholderNoDataFound")} ${t("presentationView.placeholderCheckVariables")}`;
      }
      if (chartType === "stackedBar" && xCol && stackByCol && yCol && stackedBarData.length === 0) {
        return `${t("presentationView.placeholderNoDataFound")} ${t("presentationView.placeholderCheckVariables")}`;
      }
      if (chartType === "pie" && xCol && pieData.length === 0) {
        return `${t("presentationView.placeholderNoDataFound")} ${t("presentationView.placeholderCheckVariables")}`;
      }
      if (chartType === "donut" && xCol && pieData.length === 0) {
        return `${t("presentationView.placeholderNoDataFound")} ${t("presentationView.placeholderCheckVariables")}`;
      }
      if (chartType === "box" && xCol && yCol && boxChartData.length === 0) {
        return `${t("presentationView.placeholderNoDataFound")} ${t("presentationView.placeholderCheckVariables")}`;
      }
      if (chartType === "heatmap" && (!corrResult || corrResult.columnNames.length < 2)) {
        return t("presentationView.placeholderNeedNumericCols");
      }
      return undefined;
    })();
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
    const handleExportHeatmapCsv = () => {
      if (!corrResult || corrResult.columnNames.length < 2) return;
      const headers = ["", ...corrResult.columnNames];
      const csvRows = corrResult.matrix.map((row, i) => [corrResult.columnNames[i], ...row.map((v) => v.toFixed(4))]);
      const csv = [headers.join(","), ...csvRows.map((r) => r.join(","))].join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = `quantis-correlation-${heatmapCorrMethod}.csv`;
      a.click();
      URL.revokeObjectURL(a.href);
    };

    const chartControls: ChartControls = {
      histogramCol,
      showHistogramDensity,
      heatmapCorrMethod,
      radarGroupCol,
      radarNumericCols,
      densityGroupCol,
      densityValueCol,
      pieBinNumeric,
      pieBinCount,
      pieNumericCol,
    };

    const handleControlsChange = (patch: Partial<ChartControls>) => {
      if (patch.histogramCol !== undefined) setHistogramCol(patch.histogramCol);
      if (patch.showHistogramDensity !== undefined) setShowHistogramDensity(patch.showHistogramDensity);
      if (patch.heatmapCorrMethod !== undefined) setHeatmapCorrMethod(patch.heatmapCorrMethod);
      if (patch.radarGroupCol !== undefined) setRadarGroupCol(patch.radarGroupCol);
      if (patch.radarNumericCols !== undefined) setRadarNumericCols(patch.radarNumericCols);
      if (patch.densityGroupCol !== undefined) setDensityGroupCol(patch.densityGroupCol);
      if (patch.densityValueCol !== undefined) setDensityValueCol(patch.densityValueCol);
      if (patch.pieBinNumeric !== undefined) setPieBinNumeric(patch.pieBinNumeric);
      if (patch.pieBinCount !== undefined) setPieBinCount(patch.pieBinCount);
      if (patch.pieNumericCol !== undefined) setPieNumericCol(patch.pieNumericCol);
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
            {chartType === "stackedBar" && (
              <div className="flex flex-wrap gap-4 mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">{t("presentationView.axisXCategoryLabel")}</label>
                  <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                    <option value="">{t("analysisView.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("presentationView.stackByLabel")}</label>
                  <select value={stackByCol} onChange={(e) => setStackByCol(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                    <option value="">{t("analysisView.selectPlaceholder")}</option>
                    {cols.filter((c) => c !== xCol).map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("presentationView.valueNumericLabel")}</label>
                  <select value={yCol} onChange={(e) => setYCol(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
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
        <div className="flex gap-4 items-start w-full">
          <div className="flex-1 min-w-0">
            {chartType === "scatter" && isScatter && (hasLegend ? groupedScatterData.length > 0 : chartData.length > 0) && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              {chartTitleBlock}
              <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid />
                  <XAxis dataKey="x" name={xLabel} type="number" domain={["auto", "auto"]} label={{ value: xLabel, position: "insideBottom", offset: -10 }} />
                  <YAxis dataKey="y" name={yLabel} type="number" domain={["auto", "auto"]} label={{ value: yLabel, angle: -90, position: "insideLeft", offset: 0 }} />
                  <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                  {hasLegend ? (
                    <>
                      <Legend />
                      {groupedScatterData.map((grp, i) => (
                        <Scatter
                          key={grp.key}
                          data={grp.points}
                          fill={getPaletteColor(chartConfig.palette, i)}
                          name={grp.key}
                        />
                      ))}
                    </>
                  ) : (
                    <Scatter data={chartData} fill={getPaletteColor(chartConfig.palette, 0)} name={t("presentationView.scatterPointName")} />
                  )}
                </ScatterChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        
        {chartType === "density" && densityData.length > 0 && (() => {
          const keys = densityData.map((d) => d.group);
          const merged = densityData[0].points.map((_, i) => ({
            x: densityData[0].points[i].x,
            ...Object.fromEntries(keys.map((k, j) => [k, densityData[j].points[i].density])),
          }));
          return (
            <div className="relative group" data-chart-export-wrapper>
              {chartExportIcons}
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
                {chartTitleBlock}
                <div className="h-80">
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
            </div>
          );
        })()}
        {chartType === "bar" && (hasLegend ? pivotedBarData.length > 0 : barDataSorted.length > 0) && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              {chartTitleBlock}
              <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hasLegend ? pivotedBarData : barDataSorted} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis domain={barScale.domain} ticks={barScale.ticks} />
                  {isAggregated ? <Tooltip content={renderAggTooltip} /> : <Tooltip />}
                  {hasLegend ? (
                    <>
                      <Legend />
                      {legendSeriesKeys.map((key, i) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={key}
                          stackId={chartConfig.barMode === "stacked" ? "stack" : undefined}
                          fill={getPaletteColor(chartConfig.palette, i)}
                        >
                          {showErrorBars && (
                            <ErrorBar
                              dataKey={`_err_${key}`}
                              direction="y"
                              width={4}
                              stroke="#475569"
                              strokeWidth={1.5}
                            />
                          )}
                          {chartConfig.showDataLabels && (
                            <LabelList dataKey={key} position="top" formatter={formatDataLabel} />
                          )}
                        </Bar>
                      ))}
                    </>
                  ) : (
                    <Bar dataKey="count" fill={getPaletteColor(chartConfig.palette, 0)} name={isAggregated ? activeAggLegendName : t("presentationView.barCountLabel")}>
                      {showErrorBars && (
                        <ErrorBar
                          dataKey="error"
                          direction="y"
                          width={4}
                          stroke="#475569"
                          strokeWidth={1.5}
                        />
                      )}
                      {chartConfig.showDataLabels && (
                        <LabelList dataKey="count" position="top" formatter={formatDataLabel} />
                      )}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        {chartType === "barH" && xCol && (hasLegend ? pivotedBarData.length > 0 : barDataSorted.length > 0) && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              {chartTitleBlock}
              <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={hasLegend ? pivotedBarData : barDataSorted} layout="vertical" margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis type="number" domain={barScale.domain} ticks={barScale.ticks} />
                  <YAxis type="category" dataKey="name" width={100} />
                  {isAggregated ? <Tooltip content={renderAggTooltip} /> : <Tooltip />}
                  {hasLegend ? (
                    <>
                      <Legend />
                      {legendSeriesKeys.map((key, i) => (
                        <Bar
                          key={key}
                          dataKey={key}
                          name={key}
                          stackId={chartConfig.barMode === "stacked" ? "stack" : undefined}
                          fill={getPaletteColor(chartConfig.palette, i)}
                        >
                          {showErrorBars && (
                            <ErrorBar
                              dataKey={`_err_${key}`}
                              direction="x"
                              width={4}
                              stroke="#475569"
                              strokeWidth={1.5}
                            />
                          )}
                          {chartConfig.showDataLabels && (
                            <LabelList dataKey={key} position="right" formatter={formatDataLabel} />
                          )}
                        </Bar>
                      ))}
                    </>
                  ) : (
                    <Bar dataKey="count" fill={getPaletteColor(chartConfig.palette, 0)} name={isAggregated ? activeAggLegendName : t("presentationView.barCountLabel")}>
                      {showErrorBars && (
                        <ErrorBar
                          dataKey="error"
                          direction="x"
                          width={4}
                          stroke="#475569"
                          strokeWidth={1.5}
                        />
                      )}
                      {chartConfig.showDataLabels && (
                        <LabelList dataKey="count" position="right" formatter={formatDataLabel} />
                      )}
                    </Bar>
                  )}
                </BarChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        {chartType === "line" && (hasLegend ? pivotedLineData.length > 0 : lineChartData.length > 0) && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              {chartTitleBlock}
              <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={hasLegend ? pivotedLineData : lineChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="x" name={xLabel} tick={{ fontSize: 11 }} />
                  <YAxis dataKey={hasLegend ? undefined : "y"} name={yLabel} domain={lineScale.domain} ticks={lineScale.ticks} tick={{ fontSize: 11 }} />
                  {isAggregated ? <Tooltip content={renderAggTooltip} /> : <Tooltip />}
                  {hasLegend ? (
                    <>
                      <Legend />
                      {legendSeriesKeys.map((key, i) => (
                        <Line
                          key={key}
                          type="monotone"
                          dataKey={key}
                          stroke={getPaletteColor(chartConfig.palette, i)}
                          strokeWidth={2}
                          dot={{ r: 4 }}
                          name={key}
                        >
                          {showErrorBars && (
                            <ErrorBar
                              dataKey={`_err_${key}`}
                              direction="y"
                              width={4}
                              stroke="#475569"
                              strokeWidth={1.5}
                            />
                          )}
                          {chartConfig.showDataLabels && (
                            <LabelList dataKey={key} position="top" formatter={formatDataLabel} />
                          )}
                        </Line>
                      ))}
                    </>
                  ) : (
                    <Line
                      type="monotone"
                      dataKey="y"
                      stroke={getPaletteColor(chartConfig.palette, 0)}
                      strokeWidth={2}
                      dot={{ r: 4 }}
                      name={isAggregated ? activeAggLegendName : (yLabel || t("presentationView.lineDefaultValueName"))}
                    >
                      {showErrorBars && (
                        <ErrorBar
                          dataKey="error"
                          direction="y"
                          width={4}
                          stroke="#475569"
                          strokeWidth={1.5}
                        />
                      )}
                      {chartConfig.showDataLabels && (
                        <LabelList dataKey="y" position="top" formatter={formatDataLabel} />
                      )}
                    </Line>
                  )}
                </LineChart>
              </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        {chartType === "pie" && pieData.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              {chartTitleBlock}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={chartConfig.showDataLabels ? ({ name, percent }) => `${name} ${(percent != null ? percent * 100 : 0).toFixed(chartConfig.decimals ?? 0)}%` : false}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [
                        v,
                        yCol && numericCols.includes(yCol)
                          ? `${t("presentationView.aggLabel." + (chartConfig.aggregation || "sum"))} ${t("presentationView.ofPreposition")} ${yLabel}`
                          : t("presentationView.barCountLabel"),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        {chartType === "donut" && pieData.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              {chartTitleBlock}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <PieChart>
                    <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={60} label={chartConfig.showDataLabels ? ({ name, percent }) => `${name} ${(percent != null ? percent * 100 : 0).toFixed(chartConfig.decimals ?? 0)}%` : false}>
                      {pieData.map((_, i) => (
                        <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip
                      formatter={(v: number) => [
                        v,
                        yCol && numericCols.includes(yCol)
                          ? `${t("presentationView.aggLabel." + (chartConfig.aggregation || "sum"))} ${t("presentationView.ofPreposition")} ${yLabel}`
                          : t("presentationView.barCountLabel"),
                      ]}
                    />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        {chartType === "box" && boxChartData.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 mb-2">
              {chartTitleBlock}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={boxChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" />
                    <YAxis domain={boxYDomain} allowDataOverflow />
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
                    <Bar dataKey="q1" stackId="box" fill="transparent" stroke="none" isAnimationActive={false} legendType="none">
                      <ErrorBar dataKey="whiskerLow" width={12} stroke="#94a3b8" strokeWidth={1.75} direction="y" />
                    </Bar>
                    <Bar dataKey="boxLower" stackId="box" fill="#0061bb" fillOpacity={0.55} stroke="#3b82f6" strokeWidth={1.5} isAnimationActive={false} legendType="none" />
                    <Bar dataKey="boxUpper" stackId="box" fill="#0061bb" fillOpacity={0.85} stroke="#3b82f6" strokeWidth={1.5} isAnimationActive={false} legendType="none">
                      <ErrorBar dataKey="whiskerHigh" width={12} stroke="#94a3b8" strokeWidth={1.75} direction="y" />
                    </Bar>
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
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
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              {chartTitleBlock}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <BarChart data={histChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" label={{ value: histogramCol, position: "insideBottom", offset: -5 }} />
                    <YAxis label={{ value: t("presentationView.histogramFrequencyLabel"), angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0061bb" name={t("presentationView.histogramFrequencyLabel")}>
                      {chartConfig.showDataLabels && (
                        <LabelList dataKey="count" position="top" formatter={formatDataLabel} />
                      )}
                    </Bar>
                  </BarChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        {chartType === "histogram" && showHistogramDensity && histComboData.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              {chartTitleBlock}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <ComposedChart data={histComboData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" label={{ value: histogramCol, position: "insideBottom", offset: -5 }} />
                    <YAxis label={{ value: t("presentationView.histogramFrequencyDensityLabel"), angle: -90, position: "insideLeft" }} />
                    <Tooltip />
                    <Bar dataKey="count" fill="#0061bb" name={t("presentationView.histogramFrequencyLabel")}>
                      {chartConfig.showDataLabels && (
                        <LabelList dataKey="count" position="top" formatter={formatDataLabel} />
                      )}
                    </Bar>
                    <Line type="monotone" dataKey="densityScaled" stroke="#f59e0b" strokeWidth={2} dot={false} name={t("presentationView.kdeLineLabel")} />
                  </ComposedChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>
        )}
        {chartType === "area" && areaData.length > 0 && (
          <div className="relative group" data-chart-export-wrapper>
            {chartExportIcons}
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              {chartTitleBlock}
              <div className="h-80">
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={areaData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="x" name={xCol} tick={{ fontSize: 11 }} />
                    <YAxis dataKey="y" name={yCol} tick={{ fontSize: 11 }} />
                    <Tooltip />
                    <Area type="monotone" dataKey="y" stroke="#0061bb" fill="#0061bb" fillOpacity={0.4} name={yCol || t("presentationView.lineDefaultValueName")}>
                      {chartConfig.showDataLabels && (
                        <LabelList dataKey="y" position="top" formatter={formatDataLabel} />
                      )}
                    </Area>
                  </AreaChart>
                </ResponsiveContainer>
              </div>
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
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
                {chartTitleBlock}
                <div className="h-80">
                  <ResponsiveContainer width="100%" height="100%">
                    <RadarChart data={radarData}>
                      <PolarGrid />
                      <PolarAngleAxis dataKey="subject" />
                      <PolarRadiusAxis angle={90} domain={[0, "auto"]} />
                      {radarKeys.map((key, i) => (
                        <Radar key={key} name={key} dataKey={key} stroke={PIE_COLORS[i % PIE_COLORS.length]} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.3} strokeWidth={2}>
                          {chartConfig.showDataLabels && (
                            <LabelList dataKey={key} position="top" formatter={formatDataLabel} />
                          )}
                        </Radar>
                      ))}
                      <Legend />
                    </RadarChart>
                  </ResponsiveContainer>
                </div>
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
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto overflow-y-auto max-h-96 space-y-2 p-4">
            {chartTitleBlock}
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
        {!isChartRendered && (
          <ChartPlaceholderFrame
            chartType={chartType}
            datasetName={selectedDataset?.name}
            xCol={xCol}
            yCol={yCol}
            histogramCol={histogramCol}
            densityGroupCol={densityGroupCol}
            densityValueCol={densityValueCol}
            radarNumericCols={radarNumericCols}
            stackByCol={stackByCol}
            activeAggregation={activeYAggregation}
            isInspectorOpen={isInspectorOpen}
            onOpenInspector={() => setIsInspectorOpen(true)}
            warningMessage={chartWarningMessage}
          />
        )}
        {chartType === "scatter" && (!xCol || !yCol) && <p className="text-neutral-500 text-sm">{t("presentationView.scatterEmptyHint")}</p>}
        {chartType === "scatter" && xCol && !numericCols.includes(xCol) && (
          <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            {t("presentationView.scatterXNotNumericPart1")} <strong>&quot;{xCol}&quot;</strong> {t("presentationView.scatterXNotNumericPart2")}
          </p>
        )}
        {chartType === "scatter" && yCol && !numericCols.includes(yCol) && (
          <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            {t("presentationView.scatterYNotNumericPart1")} <strong>&quot;{yCol}&quot;</strong> {t("presentationView.scatterYNotNumericPart2")}
          </p>
        )}
        {chartType === "scatter" && xCol && yCol && numericCols.includes(xCol) && numericCols.includes(yCol) && (hasLegend ? groupedScatterData.length === 0 : chartData.length === 0) && (
          <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">
            {t("presentationView.scatterNoDataPart1")} <strong>&quot;{xCol}&quot;</strong> {t("presentationView.scatterNoDataPart2")} <strong>&quot;{yCol}&quot;</strong> {t("presentationView.scatterNoDataPart3")}
          </p>
        )}
        {chartType === "bar" && !xCol && <p className="text-neutral-500 text-sm">{t("presentationView.barEmptyHint")}</p>}
        {chartType === "bar" && xCol && (hasLegend ? pivotedBarData.length === 0 : barChartData.length === 0) && <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">{t("presentationView.barNoDataPart1")} &quot;{xCol}&quot;{yCol ? ` ${t("presentationView.barNoDataYAxisSuffix")} ${yCol})` : ""}. {t("presentationView.barNoDataPart2")}</p>}
        {chartType === "line" && (!xCol || !yCol || (hasLegend ? pivotedLineData.length === 0 : lineChartData.length === 0)) && <p className="text-neutral-500 text-sm">{t("presentationView.lineEmptyHint")}</p>}
        {chartType === "area" && (!xCol || !yCol || areaData.length === 0) && <p className="text-neutral-500 text-sm">{t("presentationView.areaEmptyHint")}</p>}
        {chartType === "stackedBar" && (!xCol || !stackByCol || !yCol || stackedBarData.length === 0) && <p className="text-neutral-500 text-sm">{t("presentationView.stackedBarEmptyHint")}</p>}
        {chartType === "pie" && pieData.length === 0 && <p className="text-neutral-500 text-sm">{t("presentationView.pieEmptyHint")}</p>}
        {chartType === "box" && (!xCol || !yCol || boxChartData.length === 0) && <p className="text-neutral-500 text-sm">{t("presentationView.boxEmptyHint")}</p>}
        {chartType === "histogram" && !histogramCol && <p className="text-neutral-500 text-sm">{t("presentationView.histogramEmptyHint")}</p>}
        {chartType === "density" && (!densityGroupCol || !densityValueCol) && <p className="text-neutral-500 text-sm">{t("presentationView.densityEmptyHint")}</p>}
        {chartType === "radar" && radarNumericCols.length < 2 && <p className="text-neutral-500 text-sm">{t("presentationView.radarEmptyHint")}</p>}
        {chartType === "heatmap" && (!corrResult || corrResult.columnNames.length < 2) && <p className="text-neutral-500 text-sm">{t("presentationView.heatmapEmptyHint")}</p>}
        {chartType === "summary" && summaryStats.length === 0 && <p className="text-neutral-500 text-sm">{t("presentationView.summaryEmptyHint")}</p>}
        {chartType === "donut" && pieData.length === 0 && <p className="text-neutral-500 text-sm">{t("presentationView.donutEmptyHint")}</p>}
        {chartType === "barH" && (!xCol || (hasLegend ? pivotedBarData.length === 0 : barChartData.length === 0)) && <p className="text-neutral-500 text-sm">{t("presentationView.barHEmptyHint")}</p>}
        {chartType === "dashboard" && dashboardStats.length === 0 && !(dashboardCorrResult && dashboardCorrResult.columnNames.length >= 2) && <p className="text-neutral-500 text-sm">{t("presentationView.dashboardEmptyHint")}</p>}
      </div>
      {isInspectorOpen ? (
        <ChartInspectorPanel
          chartType={chartType}
          dataset={selectedDataset ?? null}
          config={chartConfig}
          onChange={(patch) => setChartConfig((prev) => ({ ...prev, ...patch }))}
              controls={chartControls}
              onControlsChange={handleControlsChange}
              onExportCsv={chartType === "heatmap" ? handleExportHeatmapCsv : undefined}
              onClose={() => setIsInspectorOpen(false)}
            />
          ) : (
            <button
              type="button"
              data-testid="inspector-toggle-btn"
              onClick={() => setIsInspectorOpen(true)}
              className="w-10 self-stretch min-h-[380px] bg-white dark:bg-neutral-900 border border-neutral-200/90 dark:border-neutral-800 rounded-xl hover:border-primary-400 dark:hover:border-primary-600 hover:bg-neutral-50/70 dark:hover:bg-neutral-800/50 flex flex-col items-center py-4 gap-3 text-neutral-500 hover:text-primary-600 dark:text-neutral-400 dark:hover:text-primary-400 transition-all shadow-2xs group cursor-pointer sticky top-4 shrink-0"
              title={t("presentationView.inspectorTitle")}
              aria-label={t("presentationView.inspectorTitle")}
            >
              <PanelRightOpen className="w-4 h-4 group-hover:scale-110 transition-transform text-neutral-600 dark:text-neutral-300 group-hover:text-primary-600 dark:group-hover:text-primary-400" />
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="[writing-mode:vertical-rl] rotate-180 text-[11px] font-semibold tracking-wider uppercase text-neutral-500 dark:text-neutral-400 group-hover:text-primary-600 dark:group-hover:text-primary-400 transition-colors mt-2 select-none">
                {t("presentationView.inspectorTitle")}
              </span>
            </button>
          )}
        </div>
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
