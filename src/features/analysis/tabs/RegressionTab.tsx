import React, { useState, useEffect } from "react";
import { Loader2, Copy } from "lucide-react";
import type { Dataset } from "@/types";
import {
  getDataRows,
  computeOLS,
  computeLogisticRegression,
  computeVIF,
  type OLSResult,
  type LogisticResult,
} from "@/utils/stats";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";

export interface RegressionTabProps {
  selectedDataset: Dataset | undefined;
  analysisBackendAvailable?: boolean;
  showToast: (msg: string) => void;
}

export function RegressionTab({
  selectedDataset,
  analysisBackendAvailable = false,
  showToast,
}: RegressionTabProps) {
  const BACKEND_PYTHON_REQUIRED_MSG = t("app.backendPythonRequiredMsg");
  const rows = selectedDataset ? getDataRows(selectedDataset) : [];
  const cols = selectedDataset?.columnNames ?? [];
  const numericCols =
    rows.length >= 2
      ? cols.filter((c) => {
          const ci = rows[0].indexOf(c);
          const vals = rows.slice(1).map((r) => r[ci]);
          return vals.every((v) => v === "" || !Number.isNaN(Number(v)));
        })
      : [];
  const yBinaryOptions = numericCols.filter((c) => {
    const ci = rows[0]?.indexOf(c) ?? -1;
    if (ci === -1) return false;
    const vals = rows
      .slice(1)
      .map((r) => Number(r[ci]))
      .filter((v) => !Number.isNaN(v));
    const uniq = [...new Set(vals)];
    return uniq.length === 2 && uniq.every((v) => v === 0 || v === 1);
  });

  const [olsYCol, setOlsYCol] = useState("");
  const [olsXSelected, setOlsXSelected] = useState<string[]>([]);
  const [olsResult, setOlsResult] = useState<OLSResult | null>(null);
  const [logYCol, setLogYCol] = useState("");
  const [logXSelected, setLogXSelected] = useState<string[]>([]);
  const [logResult, setLogResult] = useState<LogisticResult | null>(null);
  const [poissonYCol, setPoissonYCol] = useState("");
  const [poissonXSelected, setPoissonXSelected] = useState<string[]>([]);
  const [poissonResult, setPoissonResult] = useState<{
    coefficients: Record<string, number>;
    intercept: number;
    irr: Record<string, number>;
    se: Record<string, number>;
    zStat: Record<string, number>;
    pValue: Record<string, number>;
    logLikelihood: number;
    aic: number;
    n: number;
    yName: string;
    xNames: string[];
  } | null>(null);
  const [ridgeYCol, setRidgeYCol] = useState("");
  const [ridgeXSelected, setRidgeXSelected] = useState<string[]>([]);
  const [ridgeAlpha, setRidgeAlpha] = useState(1);
  const [ridgeResult, setRidgeResult] = useState<{
    coefficients: Record<string, number>;
    intercept: number;
    r2: number;
    alpha: number;
    n: number;
    yName: string;
    xNames: string[];
  } | null>(null);
  const [regressionLoading, setRegressionLoading] = useState<string | null>(null);

  const toggleX = (col: string) =>
    setOlsXSelected((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  const toggleLogX = (col: string) =>
    setLogXSelected((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  const togglePoissonX = (col: string) =>
    setPoissonXSelected((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );
  const toggleRidgeX = (col: string) =>
    setRidgeXSelected((prev) =>
      prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]
    );

  const runOLS = async () => {
    if (!olsYCol || olsXSelected.length === 0 || !rows.length) return;
    if (analysisBackendAvailable) {
      setRegressionLoading("ols");
      try {
        const res = await quantisApi.analyzeOLS(rows, olsYCol, olsXSelected);
        setOlsResult(res ?? null);
      } finally {
        setRegressionLoading(null);
      }
      return;
    }
    const res = computeOLS(rows, olsYCol, olsXSelected);
    setOlsResult(res ?? null);
  };

  const runLogistic = async () => {
    if (!logYCol || logXSelected.length === 0 || !rows.length) return;
    if (analysisBackendAvailable) {
      setRegressionLoading("logistic");
      try {
        const res = await quantisApi.analyzeLogistic(rows, logYCol, logXSelected);
        setLogResult(res ?? null);
      } finally {
        setRegressionLoading(null);
      }
      return;
    }
    const res = computeLogisticRegression(rows, logYCol, logXSelected);
    setLogResult(res ?? null);
  };

  const [vifBackendResult, setVifBackendResult] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!analysisBackendAvailable || !olsResult || olsXSelected.length < 2) {
      setVifBackendResult(null);
      return;
    }
    quantisApi.analyzeVIF(rows, olsXSelected).then(setVifBackendResult);
  }, [analysisBackendAvailable, olsResult, olsXSelected.join(","), rows.length]);
  const vifResult =
    (analysisBackendAvailable ? vifBackendResult : null) ??
    (olsResult && olsXSelected.length >= 2 ? computeVIF(rows, olsXSelected) : null);

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">{t("regressionExplainer.title")}</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">
        {t("regressionExplainer.description")}
      </p>
      <div className="mb-4">
        <AIAssistPanel
          metadata={
            selectedDataset
              ? `Dataset: ${selectedDataset.name}. Số hàng: ${selectedDataset.rows}, số cột: ${
                  selectedDataset.columns
                }. Cột số: ${numericCols.slice(0, 15).join(", ")}${
                  numericCols.length > 15 ? "…" : ""
                }.`
              : undefined
          }
          context="Hồi quy: OLS khi Y liên tục, Logistic khi Y nhị phân (0/1). VIF kiểm tra đa cộng tuyến. Chọn Y và các biến X rồi Chạy."
          quickPrompts={[
            {
              label: t("regressionExplainer.whenToUseOlsVsLogisticLabel"),
              systemHint: `Bạn là chuyên gia hồi quy. So sánh OLS (Y liên tục) và Logistic (Y nhị phân 0/1). Giải thích hệ số, R², VIF. ${aiAnswerLangHint()}`,
            },
          ]}
          title={t("regressionExplainer.askAiTitle")}
        />
      </div>

      {selectedDataset && numericCols.length >= 2 && (
        <section className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">
            {t("regressionExplainer.olsSectionTitle")}
          </h3>
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("regressionExplainer.dependentVariableLabel")}
              </label>
              <select
                value={olsYCol}
                onChange={(e) => {
                  setOlsYCol(e.target.value);
                  setOlsResult(null);
                }}
                className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2"
              >
                <option value="">{t("regressionExplainer.selectYPlaceholder")}</option>
                {numericCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("regressionExplainer.independentVariablesLabel")}
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {numericCols
                  .filter((c) => c !== olsYCol)
                  .map((c) => (
                    <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={olsXSelected.includes(c)}
                        onChange={() => {
                          toggleX(c);
                          setOlsResult(null);
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{c}</span>
                    </label>
                  ))}
              </div>
            </div>
            <button
              type="button"
              onClick={runOLS}
              disabled={regressionLoading !== null}
              className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {regressionLoading === "ols" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />{" "}
                  {t("regressionExplainer.processingLabel")}
                </>
              ) : (
                t("regressionExplainer.runOlsButton")
              )}
            </button>
          </div>
          {olsResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm mt-3">
              <div className="flex items-center justify-end gap-2 p-2 border-b border-neutral-100">
                <button
                  type="button"
                  onClick={() => {
                    const headers = [
                      t("regressionExplainer.tableVariable"),
                      t("regressionExplainer.tableCoefficient"),
                      "SE",
                      "t",
                      "p-value",
                    ];
                    const reportRows = [
                      [
                        t("regressionExplainer.interceptLabel"),
                        olsResult.intercept.toFixed(4),
                        olsResult.se["(Intercept)"]?.toFixed(4) ?? "",
                        olsResult.tStat["(Intercept)"]?.toFixed(4) ?? "",
                        olsResult.pValue["(Intercept)"] != null
                          ? olsResult.pValue["(Intercept)"] < 0.001
                            ? "< .001"
                            : olsResult.pValue["(Intercept)"].toFixed(4)
                          : "",
                      ],
                      ...olsResult.xNames.map((name) => [
                        name,
                        olsResult.coefficients[name]?.toFixed(4) ?? "",
                        olsResult.se[name]?.toFixed(4) ?? "",
                        olsResult.tStat[name]?.toFixed(4) ?? "",
                        olsResult.pValue[name] != null
                          ? olsResult.pValue[name]! < 0.001
                            ? "< .001"
                            : olsResult.pValue[name]!.toFixed(4)
                          : "",
                      ]),
                    ];
                    const tsv = [
                      headers.join("\t"),
                      ...reportRows.map((r) => r.join("\t")),
                      `R2 = ${olsResult.r2.toFixed(4)}, Adj R2 = ${olsResult.adjR2.toFixed(
                        4
                      )}, n = ${olsResult.n}`,
                    ].join("\n");
                    void navigator.clipboard.writeText(tsv);
                  }}
                  className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs flex items-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                >
                  <Copy className="w-3.5 h-3.5" /> {t("regressionExplainer.copyTableButton")}
                </button>
              </div>
              <AIAssistPanel
                metadata={
                  selectedDataset
                    ? `Dataset: ${selectedDataset.name}. Số hàng: ${
                        selectedDataset.rows ?? rows.length
                      }, số cột: ${selectedDataset.columns ?? (rows[0]?.length ?? 0)}. Các cột: ${(
                        selectedDataset.columnNames ||
                        rows[0] ||
                        []
                      )
                        .slice(0, 25)
                        .join(", ")}${
                        (selectedDataset.columnNames?.length ?? rows[0]?.length ?? 0) > 25
                          ? "..."
                          : ""
                      }.`
                    : undefined
                }
                process={`Phương pháp: Hồi quy OLS (bình phương tối thiểu). Biến phụ thuộc Y: ${olsYCol}. Biến độc lập X: ${olsResult.xNames.join(
                  ", "
                )}.`}
                context={`Hồi quy OLS: Y và ${olsResult.xNames.join(", ")}. R² = ${olsResult.r2.toFixed(
                  3
                )}, R² điều chỉnh = ${olsResult.adjR2.toFixed(3)}, n = ${olsResult.n}. Hệ số: (Intercept) = ${olsResult.intercept.toFixed(
                  3
                )}; ${olsResult.xNames
                  .map(
                    (n) =>
                      `${n} = ${olsResult.coefficients[n]?.toFixed(3)} (p = ${
                        olsResult.pValue[n] != null
                          ? olsResult.pValue[n]! < 0.001
                            ? "<.001"
                            : olsResult.pValue[n]!.toFixed(3)
                          : "—"
                      })`
                  )
                  .join("; ")}.`}
                quickPrompts={[
                  {
                    label: t("regressionExplainer.explainOlsLabel"),
                    systemHint: `Bạn là chuyên gia hồi quy tuyến tính (OLS). Giải thích ý nghĩa: hệ số hồi quy (beta), sai số chuẩn, t, p-value; R² và R² hiệu chỉnh; biến nào có ảnh hưởng có ý nghĩa thống kê. Gợi ý cách trình bày trong báo cáo. ${aiAnswerLangHint()}`,
                  },
                ]}
                title={t("regressionExplainer.askAiOlsTitle")}
              />
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">{t("regressionExplainer.tableVariable")}</th>
                    <th className="text-right p-2">{t("regressionExplainer.tableCoefficient")}</th>
                    <th className="text-right p-2">SE</th>
                    <th className="text-right p-2">t</th>
                    <th className="text-right p-2">p-value</th>
                    {olsResult.ciLower && <th className="text-right p-2">95% CI</th>}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="p-2 font-medium">{t("regressionExplainer.interceptLabel")}</td>
                    <td className="p-2 text-right">{olsResult.intercept.toFixed(4)}</td>
                    <td className="p-2 text-right">
                      {olsResult.se["(Intercept)"]?.toFixed(4) ?? "—"}
                    </td>
                    <td className="p-2 text-right">
                      {olsResult.tStat["(Intercept)"]?.toFixed(3) ?? "—"}
                    </td>
                    <td className="p-2 text-right">
                      {olsResult.pValue["(Intercept)"] != null
                        ? olsResult.pValue["(Intercept)"] < 0.001
                          ? "< .001"
                          : olsResult.pValue["(Intercept)"].toFixed(3)
                        : "—"}
                    </td>
                    {olsResult.ciLower && (
                      <td className="p-2 text-right text-xs">
                        [{olsResult.ciLower["(Intercept)"]?.toFixed(3) ?? "—"},{" "}
                        {olsResult.ciUpper?.["(Intercept)"]?.toFixed(3) ?? "—"}]
                      </td>
                    )}
                  </tr>
                  {olsResult.xNames.map((name) => (
                    <tr
                      key={name}
                      className="border-b border-neutral-100 dark:border-neutral-700/50"
                    >
                      <td className="p-2 font-medium">{name}</td>
                      <td className="p-2 text-right">
                        {olsResult.coefficients[name]?.toFixed(4) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {olsResult.se[name]?.toFixed(4) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {olsResult.tStat[name]?.toFixed(3) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {olsResult.pValue[name] != null
                          ? olsResult.pValue[name] < 0.001
                            ? "< .001"
                            : olsResult.pValue[name].toFixed(3)
                          : "—"}
                      </td>
                      {olsResult.ciLower && (
                        <td className="p-2 text-right text-xs">
                          [{olsResult.ciLower[name]?.toFixed(3) ?? "—"},{" "}
                          {olsResult.ciUpper?.[name]?.toFixed(3) ?? "—"}]
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 text-neutral-600 dark:text-neutral-400 border-t border-neutral-100">
                R² = {olsResult.r2.toFixed(4)}
                {t("regressionExplainer.adjRSquaredLabel")}
                {olsResult.adjR2.toFixed(4)}, n = {olsResult.n}, df = {olsResult.df}.
              </p>
              {vifResult && Object.keys(vifResult).length > 0 && (
                <div className="p-2 border-t border-neutral-100">
                  <p className="font-medium mb-1">{t("regressionExplainer.vifLabel")}</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(vifResult).map(([name, v]) => (
                      <span
                        key={name}
                        className={`text-xs px-2 py-0.5 rounded ${
                          v > 5
                            ? "bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100"
                            : "bg-neutral-100 dark:bg-neutral-700"
                        }`}
                        title={v > 5 ? t("regressionExplainer.vifWarningTooltip") : ""}
                      >
                        {name}: {v.toFixed(2)}
                      </span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {selectedDataset && numericCols.length >= 2 && yBinaryOptions.length > 0 && (
        <section className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">
            {t("regressionExplainer.logisticSectionTitle")}
          </h3>
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("regressionExplainer.logisticDependentVariableLabel")}
              </label>
              <select
                value={logYCol}
                onChange={(e) => {
                  setLogYCol(e.target.value);
                  setLogResult(null);
                }}
                className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2"
              >
                <option value="">{t("regressionExplainer.selectYPlaceholder")}</option>
                {yBinaryOptions.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("regressionExplainer.independentVariablesShortLabel")}
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {numericCols
                  .filter((c) => c !== logYCol)
                  .map((c) => (
                    <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={logXSelected.includes(c)}
                        onChange={() => {
                          toggleLogX(c);
                          setLogResult(null);
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{c}</span>
                    </label>
                  ))}
              </div>
            </div>
            <button
              type="button"
              onClick={runLogistic}
              disabled={regressionLoading !== null}
              className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {regressionLoading === "logistic" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />{" "}
                  {t("regressionExplainer.processingLabel")}
                </>
              ) : (
                t("regressionExplainer.runLogisticButton")
              )}
            </button>
          </div>
          {logResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm mt-3">
              <AIAssistPanel
                metadata={
                  selectedDataset
                    ? `Dataset: ${selectedDataset.name}. Số hàng: ${
                        selectedDataset.rows ?? rows.length
                      }, số cột: ${selectedDataset.columns ?? (rows[0]?.length ?? 0)}. Các cột: ${(
                        selectedDataset.columnNames ||
                        rows[0] ||
                        []
                      )
                        .slice(0, 25)
                        .join(", ")}${
                        (selectedDataset.columnNames?.length ?? rows[0]?.length ?? 0) > 25
                          ? "..."
                          : ""
                      }.`
                    : undefined
                }
                process={`Phương pháp: Hồi quy Logistic (Y nhị phân). Biến phụ thuộc Y: ${logYCol}. Biến độc lập X: ${logResult.xNames.join(
                  ", "
                )}.`}
                context={`Hồi quy Logistic: Y nhị phân, biến X: ${logResult.xNames.join(
                  ", "
                )}. AIC = ${logResult.aic.toFixed(2)}, n = ${logResult.n}. Hệ số & OR: ${logResult.xNames
                  .map(
                    (n) =>
                      `${n} = ${logResult.coefficients[n]?.toFixed(3)} (OR=${logResult.oddsRatios[
                        n
                      ]?.toFixed(3)}, p=${
                        logResult.pValue[n] != null
                          ? logResult.pValue[n]! < 0.001
                            ? "<.001"
                            : logResult.pValue[n]!.toFixed(3)
                          : "—"
                      })`
                  )
                  .join("; ")}.`}
                quickPrompts={[
                  {
                    label: t("regressionExplainer.explainLogisticLabel"),
                    systemHint: `Bạn là chuyên gia hồi quy logistic. Giải thích ý nghĩa: hệ số (log-odds), odds ratio (OR), p-value; biến nào làm tăng/giảm xác suất biến phụ thuộc nhị phân. Gợi ý cách báo cáo OR và khoảng tin cậy. ${aiAnswerLangHint()}`,
                  },
                ]}
                title={t("regressionExplainer.askAiLogisticTitle")}
              />
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">{t("regressionExplainer.tableVariable")}</th>
                    <th className="text-right p-2">{t("regressionExplainer.tableCoefficient")}</th>
                    <th className="text-right p-2">OR</th>
                    <th className="text-right p-2">SE</th>
                    <th className="text-right p-2">z</th>
                    <th className="text-right p-2">p-value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="p-2 font-medium">{t("regressionExplainer.interceptLabel")}</td>
                    <td className="p-2 text-right">{logResult.intercept.toFixed(4)}</td>
                    <td className="p-2 text-right">—</td>
                    <td className="p-2 text-right">
                      {logResult.se["(Intercept)"]?.toFixed(4) ?? "—"}
                    </td>
                    <td className="p-2 text-right">
                      {logResult.zStat["(Intercept)"]?.toFixed(3) ?? "—"}
                    </td>
                    <td className="p-2 text-right">
                      {logResult.pValue["(Intercept)"] != null
                        ? logResult.pValue["(Intercept)"] < 0.001
                          ? "< .001"
                          : logResult.pValue["(Intercept)"].toFixed(3)
                        : "—"}
                    </td>
                  </tr>
                  {logResult.xNames.map((name) => (
                    <tr
                      key={name}
                      className="border-b border-neutral-100 dark:border-neutral-700/50"
                    >
                      <td className="p-2 font-medium">{name}</td>
                      <td className="p-2 text-right">
                        {logResult.coefficients[name]?.toFixed(4) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {logResult.oddsRatios[name]?.toFixed(4) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {logResult.se[name]?.toFixed(4) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {logResult.zStat[name]?.toFixed(3) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {logResult.pValue[name] != null
                          ? logResult.pValue[name] < 0.001
                            ? "< .001"
                            : logResult.pValue[name].toFixed(3)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 text-neutral-600 dark:text-neutral-400 border-t border-neutral-100">
                Log-likelihood = {logResult.logLikelihood.toFixed(2)}, AIC ={" "}
                {logResult.aic.toFixed(2)}, n = {logResult.n}. {t("regressionExplainer.classYLabel")}{" "}
                0 = {logResult.classCounts["0"]}, 1 = {logResult.classCounts["1"]}.
              </p>
            </div>
          )}
        </section>
      )}

      {selectedDataset && numericCols.length >= 2 && analysisBackendAvailable && (
        <section className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">
            {t("regressionExplainer.poissonSectionTitle")}
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
            {t("regressionExplainer.poissonDescription")}
          </p>
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("regressionExplainer.poissonDependentVariableLabel")}
              </label>
              <select
                value={poissonYCol}
                onChange={(e) => {
                  setPoissonYCol(e.target.value);
                  setPoissonResult(null);
                }}
                className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2"
              >
                <option value="">{t("regressionExplainer.selectYPlaceholder")}</option>
                {numericCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("regressionExplainer.independentVariablesShortLabel")}
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {numericCols
                  .filter((c) => c !== poissonYCol)
                  .map((c) => (
                    <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={poissonXSelected.includes(c)}
                        onChange={() => {
                          togglePoissonX(c);
                          setPoissonResult(null);
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{c}</span>
                    </label>
                  ))}
              </div>
            </div>
            <button
              type="button"
              disabled={!poissonYCol || poissonXSelected.length === 0 || regressionLoading !== null}
              onClick={async () => {
                if (!poissonYCol || poissonXSelected.length === 0) return;
                if (!analysisBackendAvailable) {
                  showToast(BACKEND_PYTHON_REQUIRED_MSG);
                  return;
                }
                setRegressionLoading("poisson");
                try {
                  const res = await quantisApi.analyzePoisson(rows, poissonYCol, poissonXSelected);
                  setPoissonResult(res ?? null);
                } finally {
                  setRegressionLoading(null);
                }
              }}
              className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {regressionLoading === "poisson" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />{" "}
                  {t("regressionExplainer.processingLabel")}
                </>
              ) : (
                t("regressionExplainer.runPoissonButton")
              )}
            </button>
          </div>
          {poissonResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm mt-3">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">{t("regressionExplainer.tableVariable")}</th>
                    <th className="text-right p-2">{t("regressionExplainer.tableCoefficient")}</th>
                    <th className="text-right p-2">IRR</th>
                    <th className="text-right p-2">SE</th>
                    <th className="text-right p-2">z</th>
                    <th className="text-right p-2">p-value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="p-2 font-medium">{t("regressionExplainer.interceptLabel")}</td>
                    <td className="p-2 text-right">{poissonResult.intercept.toFixed(4)}</td>
                    <td className="p-2 text-right">—</td>
                    <td className="p-2 text-right">
                      {poissonResult.se["(Intercept)"]?.toFixed(4) ?? "—"}
                    </td>
                    <td className="p-2 text-right">
                      {poissonResult.zStat["(Intercept)"]?.toFixed(3) ?? "—"}
                    </td>
                    <td className="p-2 text-right">
                      {poissonResult.pValue["(Intercept)"] != null
                        ? poissonResult.pValue["(Intercept)"] < 0.001
                          ? "< .001"
                          : poissonResult.pValue["(Intercept)"].toFixed(3)
                        : "—"}
                    </td>
                  </tr>
                  {poissonResult.xNames.map((name) => (
                    <tr
                      key={name}
                      className="border-b border-neutral-100 dark:border-neutral-700/50"
                    >
                      <td className="p-2 font-medium">{name}</td>
                      <td className="p-2 text-right">
                        {poissonResult.coefficients[name]?.toFixed(4) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {poissonResult.irr[name]?.toFixed(4) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {poissonResult.se[name]?.toFixed(4) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {poissonResult.zStat[name]?.toFixed(3) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {poissonResult.pValue[name] != null
                          ? poissonResult.pValue[name] < 0.001
                            ? "< .001"
                            : poissonResult.pValue[name].toFixed(3)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 text-neutral-600 dark:text-neutral-400 border-t border-neutral-100">
                Log-likelihood = {poissonResult.logLikelihood.toFixed(2)}, AIC ={" "}
                {poissonResult.aic.toFixed(2)}, n = {poissonResult.n}.
              </p>
            </div>
          )}
        </section>
      )}

      {selectedDataset && numericCols.length >= 2 && analysisBackendAvailable && (
        <section className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/30 dark:bg-sky-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">
            {t("regressionExplainer.ridgeSectionTitle")}
          </h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">
            {t("regressionExplainer.ridgeDescription")}
          </p>
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("regressionExplainer.dependentVariableLabel")}
              </label>
              <select
                value={ridgeYCol}
                onChange={(e) => {
                  setRidgeYCol(e.target.value);
                  setRidgeResult(null);
                }}
                className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2"
              >
                <option value="">{t("regressionExplainer.selectYPlaceholder")}</option>
                {numericCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("regressionExplainer.independentVariablesShortLabel")}
              </label>
              <div className="flex flex-wrap gap-2 mt-1">
                {numericCols
                  .filter((c) => c !== ridgeYCol)
                  .map((c) => (
                    <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={ridgeXSelected.includes(c)}
                        onChange={() => {
                          toggleRidgeX(c);
                          setRidgeResult(null);
                        }}
                        className="rounded"
                      />
                      <span className="text-sm">{c}</span>
                    </label>
                  ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">
                {t("regressionExplainer.alphaLabel")}
              </label>
              <input
                type="number"
                min={0.01}
                step={0.1}
                value={ridgeAlpha}
                onChange={(e) => {
                  setRidgeAlpha(Math.max(0.01, parseFloat(e.target.value) || 1));
                  setRidgeResult(null);
                }}
                className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24"
              />
            </div>
            <button
              type="button"
              disabled={!ridgeYCol || ridgeXSelected.length === 0 || regressionLoading !== null}
              onClick={async () => {
                if (!ridgeYCol || ridgeXSelected.length === 0) return;
                if (!analysisBackendAvailable) {
                  showToast(BACKEND_PYTHON_REQUIRED_MSG);
                  return;
                }
                setRegressionLoading("ridge");
                try {
                  const res = await quantisApi.analyzeRidge(
                    rows,
                    ridgeYCol,
                    ridgeXSelected,
                    ridgeAlpha
                  );
                  setRidgeResult(res ?? null);
                } finally {
                  setRegressionLoading(null);
                }
              }}
              className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {regressionLoading === "ridge" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />{" "}
                  {t("regressionExplainer.processingLabel")}
                </>
              ) : (
                t("regressionExplainer.runRidgeButton")
              )}
            </button>
          </div>
          {ridgeResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm mt-3">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">{t("regressionExplainer.tableVariable")}</th>
                    <th className="text-right p-2">{t("regressionExplainer.tableCoefficient")}</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="p-2 font-medium">{t("regressionExplainer.interceptLabel")}</td>
                    <td className="p-2 text-right">{ridgeResult.intercept.toFixed(4)}</td>
                  </tr>
                  {ridgeResult.xNames.map((name) => (
                    <tr
                      key={name}
                      className="border-b border-neutral-100 dark:border-neutral-700/50"
                    >
                      <td className="p-2 font-medium">{name}</td>
                      <td className="p-2 text-right">
                        {ridgeResult.coefficients[name]?.toFixed(4) ?? "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 text-neutral-600 dark:text-neutral-400 border-t border-neutral-100">
                R² = {ridgeResult.r2.toFixed(4)}, alpha = {ridgeResult.alpha}, n = {ridgeResult.n}.
              </p>
            </div>
          )}
        </section>
      )}
    </div>
  );
}

export { RegressionTab as RegressionExplainerView };
