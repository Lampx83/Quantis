import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Dataset } from "@/types";
import type { AnalysisTab } from "@/stores";
import type {
  DescriptiveRow,
  TTestResult,
  ChiSquareResult,
  ANOVAResult,
  MannWhitneyResult,
} from "@/utils/stats";
import {
  getDataRows,
  computeCorrelationMatrix,
  computePartialCorrelation,
  computeCorrelationCI,
} from "@/utils/stats";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";
import { InfoHint, GlossaryBar } from "@/components/common/InfoHint";
import {
  BayesianTab,
  ReliabilityTab,
  FactorTab,
  MLTab,
  RegressionTab,
  SEMTab,
  HypothesisTab,
  PanelTab,
} from "./tabs";

export interface AnalysisViewProps {
  tab: AnalysisTab;
  selectedDataset: Dataset | undefined;
  onHypothesisResult?: (r: {
    type: "ttest" | "chisquare" | "anova" | "mannwhitney";
    payload: TTestResult | ChiSquareResult | ANOVAResult | MannWhitneyResult;
    meta?: Record<string, string>;
  } | null) => void;
  correlationMethod: "pearson" | "spearman" | "kendall";
  setCorrelationMethod: (m: "pearson" | "spearman" | "kendall") => void;
  analysisBackendAvailable?: boolean;
  descriptiveBackendResult?: DescriptiveRow[] | null;
  correlationBackendResult?: { matrix: number[][]; columnNames: string[] } | null;
  correlationLoading?: boolean;
  showToast: (msg: string) => void;
}

export function AnalysisView({
  tab,
  selectedDataset,
  onHypothesisResult,
  correlationMethod,
  setCorrelationMethod,
  analysisBackendAvailable = false,
  descriptiveBackendResult: _descriptiveBackendResult = null,
  correlationBackendResult = null,
  correlationLoading = false,
  showToast,
}: AnalysisViewProps) {
  const BACKEND_PYTHON_REQUIRED_MSG = t("app.backendPythonRequiredMsg");
  const effectiveTab = tab === "descriptive" ? "hypothesis" : tab;
  const tabs: Record<AnalysisTab, { title: string; desc: string }> = {
    descriptive: {
      title: t("analysisView.tabDescriptiveTitle"),
      desc: t("analysisView.tabDescriptiveDesc"),
    },
    hypothesis: {
      title: t("analysisView.tabHypothesisTitle"),
      desc: t("analysisView.tabHypothesisDesc"),
    },
    regression: {
      title: t("analysisView.tabRegressionTitle"),
      desc: t("analysisView.tabRegressionDesc"),
    },
    sem: {
      title: t("analysisView.tabSemTitle"),
      desc: t("analysisView.tabSemDesc"),
    },
    correlation: {
      title: t("analysisView.tabCorrelationTitle"),
      desc: t("analysisView.tabCorrelationDesc"),
    },
    reliability: {
      title: t("analysisView.tabReliabilityTitle"),
      desc: t("analysisView.tabReliabilityDesc"),
    },
    factor: {
      title: t("analysisView.tabFactorTitle"),
      desc: t("analysisView.tabFactorDesc"),
    },
    ml: {
      title: t("analysisView.tabMlTitle"),
      desc: t("analysisView.tabMlDesc"),
    },
    bayesian: {
      title: t("analysisView.tabBayesianTitle"),
      desc: t("analysisView.tabBayesianDesc"),
    },
    panel: {
      title: t("analysisView.tabPanelTitle"),
      desc: t("analysisView.tabPanelDesc"),
    },
  };
  const { title, desc } = tabs[effectiveTab] ?? { title: effectiveTab, desc: "" };
  const [partialCol1, setPartialCol1] = useState("");
  const [partialCol2, setPartialCol2] = useState("");
  const [partialControls, setPartialControls] = useState<string[]>([]);
  const [partialResult, setPartialResult] = useState<{ r: number; n: number } | null>(null);
  const [covarianceResult, setCovarianceResult] = useState<{
    matrix: number[][];
    columnNames: string[];
    ddof: number;
  } | null>(null);
  const [covarianceMethod, setCovarianceMethod] = useState<"population" | "sample">("sample");
  const [covarianceLoading, setCovarianceLoading] = useState(false);

  if (effectiveTab === "correlation" && selectedDataset) {
    const rows = getDataRows(selectedDataset);
    const corr =
      (analysisBackendAvailable ? correlationBackendResult : null) ??
      computeCorrelationMatrix(rows, correlationMethod);
    if (!corr || corr.matrix.length < 2)
      return (
        <div className="w-full max-w-full">
          <h2 className="text-xl font-semibold mb-2">{t("analysisView.correlationTitle")}</h2>
          <p className="text-neutral-500">{t("analysisView.correlationInsufficientData")}</p>
        </div>
      );
    return (
      <div className="w-full max-w-full">
        <h2 className="text-xl font-semibold mb-2">{t("analysisView.correlationTitle")}<InfoHint term="correlationMatrix" /></h2>
        <GlossaryBar terms={["correlationMatrix", "pValue"]} />
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          {t("analysisView.correlationDesc")}
        </p>
        {corr && corr.columnNames.length > 0 && (
          <AIAssistPanel
            context={`Ma trận tương quan (${correlationMethod}). Cột: ${corr.columnNames.join(
              ", "
            )}. Mẫu hệ số: ${corr.matrix
              .slice(0, 4)
              .map(
                (row, i) =>
                  `${corr.columnNames[i]}: ${row
                    .slice(0, 4)
                    .map((v) => v.toFixed(2))
                    .join(", ")}`
              )
              .join("; ")}.`}
            quickPrompts={[
              {
                label: t("analysisView.explainCorrelationLabel"),
                systemHint: `Bạn là chuyên gia thống kê. Giải thích ma trận tương quan: ý nghĩa hệ số Pearson/Spearman/Kendall (cường độ, hướng), mối quan hệ giữa các cặp biến. Gợi ý khi nào cần kiểm định ý nghĩa (test r=0). ${aiAnswerLangHint()}`,
              },
            ]}
            title={t("analysisView.askAiCorrelationTitle")}
          />
        )}
        {analysisBackendAvailable && correlationLoading && (
          <p className="flex items-center gap-2 text-sm text-brand mb-2">
            <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />
            {t("analysisView.loadingCorrelation")}
          </p>
        )}
        <div className="flex gap-2 mb-3">
          <button
            type="button"
            disabled={correlationLoading}
            onClick={() => setCorrelationMethod("pearson")}
            className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-60 ${
              correlationMethod === "pearson"
                ? "bg-brand text-white"
                : "border border-neutral-300 dark:border-neutral-600"
            }`}
          >
            Pearson
          </button>
          <button
            type="button"
            disabled={correlationLoading}
            onClick={() => setCorrelationMethod("spearman")}
            className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-60 ${
              correlationMethod === "spearman"
                ? "bg-brand text-white"
                : "border border-neutral-300 dark:border-neutral-600"
            }`}
          >
            Spearman
          </button>
          <button
            type="button"
            disabled={correlationLoading}
            onClick={() => setCorrelationMethod("kendall")}
            className={`rounded-md px-3 py-1.5 text-sm disabled:opacity-60 ${
              correlationMethod === "kendall"
                ? "bg-brand text-white"
                : "border border-neutral-300 dark:border-neutral-600"
            }`}
          >
            Kendall
          </button>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto mb-4">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="p-2 text-left font-medium"></th>
                {corr.columnNames.map((c) => (
                  <th key={c} className="p-2 text-right font-medium whitespace-nowrap">
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corr.matrix.map((row, i) => (
                <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/50">
                  <td className="p-2 font-medium whitespace-nowrap">{corr.columnNames[i]}</td>
                  {row.map((v, j) => (
                    <td key={j} className="p-2 text-right">
                      {v.toFixed(3)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="text-sm font-medium mb-2">{t("analysisView.heatmapCaption")}</p>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto inline-block">
          <table className="text-sm border-collapse">
            <thead>
              <tr>
                <th className="p-1.5 text-left font-medium border-b border-r border-neutral-200 dark:border-neutral-600"></th>
                {corr.columnNames.map((c) => (
                  <th
                    key={c}
                    className="p-1.5 text-right font-medium whitespace-nowrap border-b border-r border-neutral-200 dark:border-neutral-600 text-xs max-w-[80px] truncate"
                    title={c}
                  >
                    {c}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corr.matrix.map((row, i) => (
                <tr key={i}>
                  <td
                    className="p-1.5 font-medium border-b border-r border-neutral-200 dark:border-neutral-600 text-xs max-w-[80px] truncate"
                    title={corr.columnNames[i]}
                  >
                    {corr.columnNames[i]}
                  </td>
                  {row.map((v, j) => {
                    const tVal = (v + 1) / 2;
                    const r = Math.round(255 * (1 - tVal));
                    const b = Math.round(255 * tVal);
                    const bg = `rgb(${r}, ${200 - Math.abs(v) * 100}, ${b})`;
                    return (
                      <td
                        key={j}
                        className="p-1.5 text-right border-b border-r border-neutral-200 dark:border-neutral-600"
                        style={{ background: bg }}
                        title={v.toFixed(3)}
                      >
                        {v.toFixed(2)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-sm font-semibold mb-2">{t("analysisView.covarianceTitle")}</p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">
            {t("analysisView.covarianceDesc")}
          </p>
          <div className="flex flex-wrap gap-4 items-end mb-2">
            <div>
              <label className="block text-xs font-medium mb-1">
                {t("analysisView.methodLabel")}
              </label>
              <select
                value={covarianceMethod}
                onChange={(e) => {
                  setCovarianceMethod(e.target.value as "population" | "sample");
                  setCovarianceResult(null);
                }}
                className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm"
              >
                <option value="sample">{t("analysisView.covarianceSample")}</option>
                <option value="population">{t("analysisView.covariancePopulation")}</option>
              </select>
            </div>
            <button
              type="button"
              disabled={covarianceLoading}
              onClick={async () => {
                if (!analysisBackendAvailable) {
                  showToast(BACKEND_PYTHON_REQUIRED_MSG);
                  return;
                }
                setCovarianceLoading(true);
                try {
                  const res = await quantisApi.analyzeCovariance(rows, covarianceMethod);
                  setCovarianceResult(res ?? null);
                } finally {
                  setCovarianceLoading(false);
                }
              }}
              className="rounded-md bg-brand text-white px-3 py-1.5 text-sm disabled:opacity-50 inline-flex items-center gap-2"
            >
              {covarianceLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />{" "}
                  {t("analysisView.processingLabel")}
                </>
              ) : (
                t("analysisView.computeCovarianceButton")
              )}
            </button>
          </div>
          {covarianceResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto mt-2">
              <AIAssistPanel
                context={`Ma trận hiệp phương sai (${covarianceMethod}): ${covarianceResult.columnNames.join(
                  ", "
                )}. Mẫu: ${covarianceResult.matrix
                  .slice(0, 3)
                  .map(
                    (row, i) =>
                      `${covarianceResult.columnNames[i]}: [${row
                        .slice(0, 4)
                        .map((v) => v.toFixed(2))
                        .join(", ")}${row.length > 4 ? "…" : ""}]`
                  )
                  .join("; ")}.`}
                quickPrompts={[
                  {
                    label: t("analysisView.explainCovarianceLabel"),
                    systemHint: `Bạn là chuyên gia thống kê. Giải thích ma trận hiệp phương sai (covariance): ý nghĩa đường chéo (phương sai từng biến), ngoài đường chéo (hiệp phương sai cặp biến). So sánh với tương quan. ${aiAnswerLangHint()}`,
                  },
                ]}
                title={t("analysisView.askAiCovarianceTitle")}
              />
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="p-2 text-left font-medium"></th>
                    {covarianceResult.columnNames.map((c) => (
                      <th key={c} className="p-2 text-right font-medium whitespace-nowrap">
                        {c}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {covarianceResult.matrix.map((row, i) => (
                    <tr
                      key={i}
                      className="border-b border-neutral-100 dark:border-neutral-700/50"
                    >
                      <td className="p-2 font-medium whitespace-nowrap">
                        {covarianceResult.columnNames[i]}
                      </td>
                      {row.map((v, j) => (
                        <td key={j} className="p-2 text-right">
                          {v.toFixed(4)}
                        </td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-sm font-semibold mb-2">
            {t("analysisView.partialCorrelationTitle")}
          </p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">
            {t("analysisView.partialCorrelationDesc")}
          </p>
          <div className="flex flex-wrap gap-4 items-end mb-2">
            <div>
              <label className="block text-xs font-medium mb-1">
                {t("analysisView.variable1Label")}
              </label>
              <select
                value={partialCol1}
                onChange={(e) => {
                  setPartialCol1(e.target.value);
                  setPartialResult(null);
                }}
                className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm"
              >
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {corr.columnNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                {t("analysisView.variable2Label")}
              </label>
              <select
                value={partialCol2}
                onChange={(e) => {
                  setPartialCol2(e.target.value);
                  setPartialResult(null);
                }}
                className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm"
              >
                <option value="">{t("analysisView.selectPlaceholder")}</option>
                {corr.columnNames.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">
                {t("analysisView.controlVariablesLabel")}
              </label>
              <div className="flex flex-wrap gap-1">
                {corr.columnNames
                  .filter((c) => c !== partialCol1 && c !== partialCol2)
                  .map((c) => (
                    <label key={c} className="inline-flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={partialControls.includes(c)}
                        onChange={(e) => {
                          setPartialControls((prev) =>
                            e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)
                          );
                          setPartialResult(null);
                        }}
                      />
                      {c}
                    </label>
                  ))}
              </div>
            </div>
            <button
              type="button"
              onClick={() => {
                const res =
                  partialCol1 && partialCol2
                    ? computePartialCorrelation(rows, partialCol1, partialCol2, partialControls)
                    : null;
                setPartialResult(res ?? null);
              }}
              disabled={!partialCol1 || !partialCol2}
              className="rounded-md bg-brand text-white px-3 py-1.5 text-sm disabled:opacity-50"
            >
              {t("analysisView.computePartialRButton")}
            </button>
          </div>
          {partialResult && (
            <div className="mt-2">
              <AIAssistPanel
                context={`Tương quan từng phần: r(${partialCol1}, ${partialCol2} | ${
                  partialControls.length ? partialControls.join(", ") : "—"
                }) = ${partialResult.r.toFixed(4)}, n = ${partialResult.n}.`}
                quickPrompts={[
                  {
                    label: t("analysisView.explainPartialCorrelationLabel"),
                    systemHint: `Bạn là chuyên gia thống kê. Giải thích tương quan từng phần (partial correlation): mối liên hệ giữa hai biến khi đã kiểm soát (loại trừ ảnh hưởng) các biến khác. Nêu ý nghĩa hệ số và cách đọc. ${aiAnswerLangHint()}`,
                  },
                ]}
                title={t("analysisView.askAiPartialCorrelationTitle")}
              />
              <p className="text-sm">
                r({partialCol1}, {partialCol2} |{" "}
                {partialControls.length ? partialControls.join(", ") : "—"}) ={" "}
                <strong>{partialResult.r.toFixed(4)}</strong>, n = {partialResult.n}
              </p>
              {(() => {
                const ci = computeCorrelationCI(partialResult.r, partialResult.n);
                return ci ? (
                  <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">
                    {t("analysisView.confidenceIntervalPrefix")} [{ci.ciLower.toFixed(4)},{" "}
                    {ci.ciUpper.toFixed(4)}]
                  </p>
                ) : null;
              })()}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (effectiveTab === "hypothesis" && selectedDataset) {
    return (
      <HypothesisTab
        selectedDataset={selectedDataset}
        onHypothesisResult={onHypothesisResult}
        analysisBackendAvailable={analysisBackendAvailable}
        showToast={showToast}
      />
    );
  }

  if (effectiveTab === "reliability" && selectedDataset) {
    const rows = getDataRows(selectedDataset);
    const cols = selectedDataset.columnNames || [];
    const numericCols =
      rows.length >= 2
        ? cols.filter((c) => {
            const ci = rows[0].indexOf(c);
            const vals = rows.slice(1).map((r) => r[ci]);
            return vals.every((v) => v === "" || !Number.isNaN(Number(v)));
          })
        : [];
    return (
      <ReliabilityTab
        selectedDataset={selectedDataset}
        rows={rows}
        numericCols={numericCols}
        analysisBackendAvailable={analysisBackendAvailable}
      />
    );
  }

  if (effectiveTab === "regression") {
    return (
      <RegressionTab
        selectedDataset={selectedDataset}
        analysisBackendAvailable={analysisBackendAvailable}
        showToast={showToast}
      />
    );
  }

  if (effectiveTab === "sem") {
    return (
      <SEMTab
        selectedDataset={selectedDataset}
        analysisBackendAvailable={analysisBackendAvailable}
        showToast={showToast}
      />
    );
  }

  if (effectiveTab === "factor" && selectedDataset) {
    return (
      <FactorTab
        selectedDataset={selectedDataset}
        analysisBackendAvailable={analysisBackendAvailable}
        showToast={showToast}
      />
    );
  }

  if (effectiveTab === "ml" && selectedDataset) {
    return (
      <MLTab
        selectedDataset={selectedDataset}
        analysisBackendAvailable={analysisBackendAvailable}
        showToast={showToast}
      />
    );
  }

  if (effectiveTab === "panel" && selectedDataset) {
    return (
      <PanelTab
        selectedDataset={selectedDataset}
        analysisBackendAvailable={analysisBackendAvailable}
        showToast={showToast}
      />
    );
  }

  if (effectiveTab === "bayesian" && selectedDataset) {
    return (
      <BayesianTab
        selectedDataset={selectedDataset}
        analysisBackendAvailable={analysisBackendAvailable}
        showToast={showToast}
      />
    );
  }

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{desc}</p>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm text-neutral-500">
        {selectedDataset ? t("analysisView.featureComingSoon") : t("analysisView.needDataset")}
      </div>
    </div>
  );
}
