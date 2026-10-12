import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  ScatterChart,
  Scatter,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  BarChart,
  Bar,
} from "recharts";
import type { Dataset } from "@/types";
import {
  numCell,
  getDataRows,
  getUniqueValues,
  computeKMeans,
  computeMulticlassLogisticOneVsRest,
  computePermutationImportanceMulticlass,
  computeFeatureImportanceFromMulticlass,
  type KMeansResult,
  type MulticlassLogisticResult,
} from "@/utils/stats";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";

export type MLSubTab = "clustering" | "classification" | "explainability";

export interface MLTabProps {
  selectedDataset: Dataset;
  analysisBackendAvailable?: boolean;
  showToast?: (msg: string) => void;
}

export function MLTab({
  selectedDataset,
  analysisBackendAvailable = false,
  showToast: _showToast,
}: MLTabProps) {
  const rows = getDataRows(selectedDataset);
  const cols = selectedDataset.columnNames ?? [];
  const numericCols =
    rows.length >= 2
      ? cols.filter((c) => {
          const ci = rows[0].indexOf(c);
          const vals = rows.slice(1).map((r) => r[ci]);
          return vals.every((v) => v === "" || !Number.isNaN(Number(v)));
        })
      : [];
  const categoricalCols =
    rows.length >= 2
      ? cols.filter((c) => {
          const ci = rows[0].indexOf(c);
          const vals = rows
            .slice(1)
            .map((r) => String(r[ci] ?? "").trim())
            .filter(Boolean);
          return (
            vals.length > 0 &&
            [...new Set(vals)].length >= 2 &&
            [...new Set(vals)].length <= 20
          );
        })
      : [];
  const [mlSubTab, setMlSubTab] = useState<MLSubTab>("classification");
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [K, setK] = useState(3);
  const [kmeansResult, setKmeansResult] = useState<KMeansResult | null>(null);
  const [kmeansLoading, setKmeansLoading] = useState(false);
  const [classTargetCol, setClassTargetCol] = useState("");
  const [classFeatureCols, setClassFeatureCols] = useState<string[]>([]);
  const [multiclassResult, setMulticlassResult] = useState<MulticlassLogisticResult | null>(null);
  const [permutationN, setPermutationN] = useState(5);
  const [permutationResult, setPermutationResult] = useState<
    { feature: string; importance: number; std?: number }[] | null
  >(null);

  const toggleCol = (c: string) =>
    setSelectedCols((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
  const toggleClassFeature = (c: string) =>
    setClassFeatureCols((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );

  const runKMeans = async () => {
    if (selectedCols.length < 2 || K < 2) return;
    if (analysisBackendAvailable) {
      setKmeansLoading(true);
      try {
        const res = await quantisApi.analyzeKMeans(rows, selectedCols, K);
        setKmeansResult(res ?? null);
      } finally {
        setKmeansLoading(false);
      }
      return;
    }
    const res = computeKMeans(rows, selectedCols, K);
    setKmeansResult(res ?? null);
  };

  const runClassification = () => {
    if (!classTargetCol || classFeatureCols.length < 1) return;
    const res = computeMulticlassLogisticOneVsRest(rows, classTargetCol, classFeatureCols);
    setMulticlassResult(res ?? null);
    setPermutationResult(null);
  };

  const runPermutationImportance = () => {
    if (!multiclassResult || !classTargetCol || classFeatureCols.length < 1) return;
    const res = computePermutationImportanceMulticlass(
      rows,
      classTargetCol,
      classFeatureCols,
      Math.max(1, Math.min(20, permutationN))
    );
    setPermutationResult(res ?? null);
  };

  const importanceFromCoeffs = multiclassResult
    ? computeFeatureImportanceFromMulticlass(multiclassResult)
    : [];

  const KMEANS_CLUSTER_COLORS = [
    "#2563eb",
    "#16a34a",
    "#1f2937",
    "#7c3aed",
    "#dc2626",
    "#0891b2",
    "#ca8a04",
    "#db2777",
  ];

  const kmeansScatterData = (() => {
    if (!kmeansResult || selectedCols.length < 2 || kmeansResult.assignments.length === 0)
      return null;
    const headers = rows[0] || [];
    const indices = selectedCols.map((c) => headers.indexOf(c)).filter((i) => i >= 0);
    if (indices.length < 2) return null;
    const data: number[][] = [];
    for (let i = 1; i < rows.length; i++) {
      const row = indices.map((ci) => numCell(rows[i][ci]));
      if (row.every((v) => !Number.isNaN(v))) data.push(row);
    }
    if (data.length !== kmeansResult.assignments.length) return null;
    const pointsBefore = data.map((r) => ({ x: r[0], y: r[1] }));
    const pointsAfter = data.map((r, i) => ({
      x: r[0],
      y: r[1],
      cluster: kmeansResult!.assignments[i],
    }));
    const centroidPoints = kmeansResult.centroids.map((c) => ({ x: c[0], y: c[1] }));
    const colX = selectedCols[0];
    const colY = selectedCols[1];
    return { pointsBefore, pointsAfter, centroidPoints, colX, colY };
  })();

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">{t("mlTab.title")}</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("mlTab.subtitle")}</p>
      <div className="mb-4">
        <AIAssistPanel
          metadata={
            selectedDataset
              ? `Dataset: ${selectedDataset.name}. ${t("mlTab.numericColsLabel")}: ${
                  numericCols.length
                }, ${t("mlTab.categoricalColsLabel")}: ${categoricalCols.length}.`
              : undefined
          }
          context="Học máy: K-means (phân cụm), Phân loại đa lớp (One-vs-Rest logistic), Feature importance và Permutation importance (giải thích mô hình)."
          quickPrompts={[
            {
              label: t("mlTab.quickPromptKSuggestion"),
              systemHint: `Bạn là chuyên gia ML. Gợi ý cách chọn số cụm K (elbow, silhouette), diễn giải centroid và phân loại. ${aiAnswerLangHint()}`,
            },
          ]}
          title={t("mlTab.aiTitleMl")}
        />
      </div>

      <div className="flex gap-2 mb-4 border-b border-neutral-200 dark:border-neutral-700 pb-2">
        <button
          type="button"
          onClick={() => setMlSubTab("clustering")}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            mlSubTab === "clustering"
              ? "bg-brand text-white"
              : "border border-neutral-300 dark:border-neutral-600"
          }`}
        >
          {t("mlTab.tabClustering")}
        </button>
        <button
          type="button"
          onClick={() => setMlSubTab("classification")}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            mlSubTab === "classification"
              ? "bg-brand text-white"
              : "border border-neutral-300 dark:border-neutral-600"
          }`}
        >
          {t("mlTab.tabClassification")}
        </button>
        <button
          type="button"
          onClick={() => setMlSubTab("explainability")}
          className={`rounded-lg px-3 py-1.5 text-sm ${
            mlSubTab === "explainability"
              ? "bg-brand text-white"
              : "border border-neutral-300 dark:border-neutral-600"
          }`}
        >
          {t("mlTab.tabExplainability")}
        </button>
      </div>

      {mlSubTab === "clustering" && (
        <>
          {numericCols.length >= 2 ? (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-sm font-medium">{t("mlTab.colVariablesLabel")}</span>
                {numericCols.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={selectedCols.includes(c)}
                      onChange={() => toggleCol(c)}
                      className="rounded"
                    />
                    <span className="text-sm">{c}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 items-end mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">
                    {t("mlTab.numClustersLabel")}
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={20}
                    value={K}
                    onChange={(e) => {
                      setK(Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 2)));
                      setKmeansResult(null);
                    }}
                    className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20"
                  />
                </div>
                <button
                  type="button"
                  onClick={runKMeans}
                  disabled={kmeansLoading}
                  className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {kmeansLoading ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />{" "}
                      {t("mlTab.processing")}
                    </>
                  ) : (
                    t("mlTab.runKMeans")
                  )}
                </button>
              </div>
              {kmeansResult && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
                  {kmeansScatterData && selectedCols.length >= 2 && (
                    <div className="mb-6">
                      <p className="font-medium mb-3">
                        {t("mlTab.scatterPlotLabel")} (2D: {kmeansScatterData.colX} ×{" "}
                        {kmeansScatterData.colY})
                      </p>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                            {t("mlTab.beforeKMeans")}
                          </p>
                          <div className="aspect-square max-w-md w-full rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800/50 p-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart
                                margin={{ top: 12, right: 12, bottom: 24, left: 24 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="x" name={kmeansScatterData.colX} type="number" />
                                <YAxis dataKey="y" name={kmeansScatterData.colY} type="number" />
                                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                                <Scatter
                                  data={kmeansScatterData.pointsBefore}
                                  fill="#16a34a"
                                  name={t("mlTab.pointLabel")}
                                />
                              </ScatterChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                        <div>
                          <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2">
                            {t("mlTab.afterKMeans")}
                          </p>
                          <div className="aspect-square max-w-md w-full rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800/50 p-2">
                            <ResponsiveContainer width="100%" height="100%">
                              <ScatterChart
                                margin={{ top: 12, right: 12, bottom: 24, left: 24 }}
                              >
                                <CartesianGrid strokeDasharray="3 3" />
                                <XAxis dataKey="x" name={kmeansScatterData.colX} type="number" />
                                <YAxis dataKey="y" name={kmeansScatterData.colY} type="number" />
                                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                                {Array.from({ length: K }, (_, k) => (
                                  <Scatter
                                    key={k}
                                    data={kmeansScatterData.pointsAfter.filter(
                                      (p) => p.cluster === k
                                    )}
                                    fill={
                                      KMEANS_CLUSTER_COLORS[k % KMEANS_CLUSTER_COLORS.length]
                                    }
                                    name={`${t("mlTab.clusterLabel")} ${k + 1}`}
                                  />
                                ))}
                                <Scatter
                                  data={kmeansScatterData.centroidPoints}
                                  fill="#b91c1c"
                                  shape="diamond"
                                  name={t("mlTab.centroidLabel")}
                                />
                                <Legend />
                              </ScatterChart>
                            </ResponsiveContainer>
                          </div>
                        </div>
                      </div>
                    </div>
                  )}
                  <AIAssistPanel
                    context={`K-means: ${kmeansResult.centroids.length} cụm, ${
                      kmeansResult.iterations
                    } lần lặp, Within-SS = ${kmeansResult.withinSS.toFixed(
                      2
                    )}. Centroids từng cụm: ${kmeansResult.centroids
                      .map(
                        (c, i) =>
                          `Cụm ${i + 1}: [${c.map((v) => v.toFixed(2)).join(", ")}]`
                      )
                      .join("; ")}.`}
                    quickPrompts={[
                      {
                        label: t("mlTab.quickPromptInterpretKMeans"),
                        systemHint: `Bạn là chuyên gia phân cụm (clustering). Giải thích kết quả K-means: số cụm, tâm (centroid) từng cụm trên từng biến, Within-SS. Gợi ý cách đặt tên/đặc trưng từng cụm dựa trên centroid. ${aiAnswerLangHint()}`,
                      },
                    ]}
                    title={t("mlTab.aiTitleKMeans")}
                  />
                  <p className="font-medium mb-2">
                    {t("mlTab.kmeansResultPrefix")} {kmeansResult.iterations}{" "}
                    {t("mlTab.iterationsSuffix")} {kmeansResult.withinSS.toFixed(2)})
                  </p>
                  <p className="text-neutral-600 dark:text-neutral-400 mb-2">Centroids:</p>
                  <table className="w-full">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700">
                        <th className="text-left p-2">{t("mlTab.colCluster")}</th>
                        {selectedCols.map((c) => (
                          <th key={c} className="text-right p-2">
                            {c}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {kmeansResult.centroids.map((cent, k) => (
                        <tr
                          key={k}
                          className="border-b border-neutral-100 dark:border-neutral-700/50"
                        >
                          <td className="p-2 font-medium">{k + 1}</td>
                          {cent.map((v, d) => (
                            <td key={d} className="p-2 text-right">
                              {v.toFixed(4)}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-neutral-500">
                    {t("mlTab.pointsPerClusterLabel")}:{" "}
                    {Array.from(
                      { length: K },
                      (_, k) => kmeansResult.assignments.filter((a) => a === k).length
                    ).join(", ")}
                  </p>
                </div>
              )}
            </>
          ) : (
            <p className="text-neutral-500">{t("mlTab.needNumericColsMsg")}</p>
          )}
        </>
      )}

      {mlSubTab === "classification" && (
        <>
          {categoricalCols.length >= 1 && numericCols.length >= 1 ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">
                  {t("mlTab.targetVariableLabel")}
                </label>
                <select
                  value={classTargetCol}
                  onChange={(e) => {
                    setClassTargetCol(e.target.value);
                    setMulticlassResult(null);
                  }}
                  className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
                >
                  <option value="">{t("mlTab.selectLabelColPlaceholder")}</option>
                  {categoricalCols.map((c) => (
                    <option key={c} value={c}>
                      {c} ({getUniqueValues(rows, c).length} {t("mlTab.classesLabel")})
                    </option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-sm font-medium w-full">
                  {t("mlTab.predictorVariablesLabel")}
                </span>
                {numericCols
                  .filter((c) => c !== classTargetCol)
                  .map((c) => (
                    <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={classFeatureCols.includes(c)}
                        onChange={() => {
                          toggleClassFeature(c);
                          setMulticlassResult(null);
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{c}</span>
                    </label>
                  ))}
              </div>
              <button
                type="button"
                onClick={runClassification}
                disabled={!classTargetCol || classFeatureCols.length < 1}
                className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50"
              >
                {t("mlTab.runClassification")}
              </button>
              {multiclassResult && (
                <div className="mt-6 space-y-6">
                  <AIAssistPanel
                    context={`Phân loại đa lớp: Accuracy ${(
                      multiclassResult.metrics.accuracy * 100
                    ).toFixed(2)}%, Macro F1 = ${multiclassResult.metrics.macroF1.toFixed(
                      3
                    )}, Weighted F1 = ${multiclassResult.metrics.weightedF1.toFixed(
                      3
                    )}. Theo lớp: ${multiclassResult.metrics.perClass
                      .map(
                        (p) =>
                          `${p.label}: P=${p.precision.toFixed(2)}, R=${p.recall.toFixed(
                            2
                          )}, F1=${p.f1.toFixed(2)}`
                      )
                      .join("; ")}.`}
                    quickPrompts={[
                      {
                        label: t("mlTab.quickPromptInterpretClassification"),
                        systemHint: `Bạn là chuyên gia học máy. Giải thích kết quả phân loại đa lớp: accuracy tổng thể, macro/weighted F1, precision/recall/F1 theo từng lớp; ma trận nhầm lẫn. Nêu lớp nào được dự đoán tốt/kém. ${aiAnswerLangHint()}`,
                      },
                    ]}
                    title={t("mlTab.aiTitleClassification")}
                  />
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
                    <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">
                      {t("mlTab.classificationReportLabel")}
                    </p>
                    <p className="p-2 text-neutral-600 dark:text-neutral-400">
                      Accuracy: {(multiclassResult.metrics.accuracy * 100).toFixed(2)}% | Macro
                      F1: {multiclassResult.metrics.macroF1.toFixed(4)} | Weighted F1:{" "}
                      {multiclassResult.metrics.weightedF1.toFixed(4)}
                    </p>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="text-left p-2">{t("mlTab.colClass")}</th>
                          <th className="text-right p-2">Precision</th>
                          <th className="text-right p-2">Recall</th>
                          <th className="text-right p-2">F1</th>
                          <th className="text-right p-2">Support</th>
                        </tr>
                      </thead>
                      <tbody>
                        {multiclassResult.metrics.perClass.map((p) => (
                          <tr
                            key={p.label}
                            className="border-b border-neutral-100 dark:border-neutral-700/50"
                          >
                            <td className="p-2 font-medium">{p.label}</td>
                            <td className="p-2 text-right">{p.precision.toFixed(4)}</td>
                            <td className="p-2 text-right">{p.recall.toFixed(4)}</td>
                            <td className="p-2 text-right">{p.f1.toFixed(4)}</td>
                            <td className="p-2 text-right">{p.support}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
                    <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">
                      {t("mlTab.confusionMatrixLabel")}
                    </p>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="text-left p-2"></th>
                          {multiclassResult.confusionMatrix.labels.map((l) => (
                            <th key={l} className="text-right p-2">
                              {l}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {multiclassResult.confusionMatrix.matrix.map((row, i) => (
                          <tr
                            key={i}
                            className="border-b border-neutral-100 dark:border-neutral-700/50"
                          >
                            <td className="p-2 font-medium">
                              {multiclassResult.confusionMatrix.labels[i]}
                            </td>
                            {row.map((v, j) => (
                              <td key={j} className="p-2 text-right">
                                {v}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-neutral-500">{t("mlTab.needClassificationColsMsg")}</p>
          )}
        </>
      )}

      {mlSubTab === "explainability" && (
        <>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">
            {t("mlTab.explainabilityDesc")}
          </p>
          {multiclassResult ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10 p-4">
                <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                  {t("mlTab.featureImportanceCoefHeading")}
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                  {t("mlTab.featureImportanceCoefDesc")}
                </p>
                {importanceFromCoeffs.length > 0 && (
                  <AIAssistPanel
                    context={`Feature importance từ hệ số: ${importanceFromCoeffs
                      .map(({ feature, importance }) => `${feature}=${importance.toFixed(3)}`)
                      .join("; ")}.`}
                    quickPrompts={[
                      {
                        label: t("mlTab.quickPromptInterpretFeatureImportance"),
                        systemHint: `Bạn là chuyên gia học máy. Giải thích feature importance (từ hệ số mô hình): biến nào đóng góp nhiều/ít vào dự đoán phân loại; xếp hạng biến quan trọng. ${aiAnswerLangHint()}`,
                      },
                    ]}
                    title={t("mlTab.aiTitleFeatureImportance")}
                  />
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-neutral-200 dark:border-neutral-700">
                        <th className="text-left p-2">{t("mlTab.colVariable")}</th>
                        <th className="text-right p-2">Importance</th>
                      </tr>
                    </thead>
                    <tbody>
                      {importanceFromCoeffs.map(({ feature, importance }) => (
                        <tr
                          key={feature}
                          className="border-b border-neutral-100 dark:border-neutral-700/50"
                        >
                          <td className="p-2 font-medium">{feature}</td>
                          <td className="p-2 text-right">{importance.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importanceFromCoeffs.length > 0 && (
                  <div className="mt-3 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart
                        data={importanceFromCoeffs.map((d) => ({
                          name:
                            d.feature.length > 18
                              ? d.feature.slice(0, 16) + "…"
                              : d.feature,
                          value: d.importance,
                        }))}
                        layout="vertical"
                        margin={{ left: 4, right: 4 }}
                      >
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis
                          type="category"
                          dataKey="name"
                          width={120}
                          tick={{ fontSize: 10 }}
                        />
                        <Tooltip />
                        <Bar dataKey="value" fill="#0061bb" name="Importance" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
                <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
                  Permutation importance
                </h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
                  {t("mlTab.permutationDesc")}
                </p>
                <div className="flex flex-wrap gap-4 items-end mb-3">
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={permutationN}
                    onChange={(e) => {
                      setPermutationN(
                        Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))
                      );
                      setPermutationResult(null);
                    }}
                    className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20"
                  />
                  <button
                    type="button"
                    onClick={runPermutationImportance}
                    className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90"
                  >
                    {t("mlTab.runPermutationImportance")}
                  </button>
                </div>
                {permutationResult && (
                  <div className="overflow-x-auto mt-2">
                    <AIAssistPanel
                      context={`Permutation importance (độ giảm accuracy khi shuffle): ${permutationResult
                        .map(
                          ({ feature, importance }) =>
                            `${feature}=${importance.toFixed(3)}`
                        )
                        .join("; ")}.`}
                      quickPrompts={[
                        {
                          label: t("mlTab.quickPromptInterpretPermutation"),
                          systemHint: `Bạn là chuyên gia học máy. Giải thích permutation importance: độ giảm accuracy khi xáo trộn từng biến — biến nào quan trọng nhất cho dự đoán. So sánh với feature importance từ hệ số nếu có. ${aiAnswerLangHint()}`,
                        },
                      ]}
                      title={t("mlTab.aiTitlePermutation")}
                    />
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="text-left p-2">{t("mlTab.colVariable")}</th>
                          <th className="text-right p-2">Importance (Δ accuracy)</th>
                          <th className="text-right p-2">Std</th>
                        </tr>
                      </thead>
                      <tbody>
                        {permutationResult.map(({ feature, importance, std }) => (
                          <tr
                            key={feature}
                            className="border-b border-neutral-100 dark:border-neutral-700/50"
                          >
                            <td className="p-2 font-medium">{feature}</td>
                            <td className="p-2 text-right">{importance.toFixed(4)}</td>
                            <td className="p-2 text-right">
                              {std != null ? std.toFixed(4) : "—"}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-neutral-500">{t("mlTab.runClassificationFirstMsg")}</p>
          )}
        </>
      )}
    </div>
  );
}
