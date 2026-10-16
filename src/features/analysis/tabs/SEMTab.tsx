import React, { useState } from "react";
import { Loader2, Cpu } from "lucide-react";
import type { Dataset } from "@/types";
import {
  getDataRows,
  computeMediation,
  computeModeration,
  type MediationResult,
  type OLSResult,
} from "@/utils/stats";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";

export interface SEMTabProps {
  selectedDataset: Dataset | undefined;
  analysisBackendAvailable?: boolean;
  showToast: (msg: string) => void;
}

export function SEMTab({
  selectedDataset,
  analysisBackendAvailable = false,
  showToast,
}: SEMTabProps) {
  const BACKEND_PYTHON_REQUIRED_MSG = t("app.backendPythonRequiredMsg");
  const rows = selectedDataset ? getDataRows(selectedDataset) : [];
  const numericCols =
    rows.length >= 2
      ? (selectedDataset?.columnNames ?? []).filter((c) => {
          const ci = rows[0].indexOf(c);
          const vals = rows.slice(1).map((r) => r[ci]);
          return vals.every((v) => v === "" || !Number.isNaN(Number(v)));
        })
      : [];
  const [mediationX, setMediationX] = useState("");
  const [mediationMs, setMediationMs] = useState<string[]>([]);
  const [mediationY, setMediationY] = useState("");
  const [mediationResult, setMediationResult] = useState<MediationResult | null>(null);
  const [moderationX, setModerationX] = useState("");
  const [moderationM, setModerationM] = useState("");
  const [moderationY, setModerationY] = useState("");
  const [moderationResult, setModerationResult] = useState<OLSResult | null>(null);

  // Path analysis (AMOS-style)
  const [pathEquations, setPathEquations] = useState<Array<{ yCol: string; xCols: string[] }>>([
    { yCol: "", xCols: [] },
  ]);
  const [pathResult, setPathResult] = useState<{
    pathCoefficients: Array<{
      from: string;
      to: string;
      coefficient: number;
      se: number;
      tStat: number;
      pValue: number;
    }>;
    equationsR2: Array<{ yCol: string; r2: number; adjR2: number; n: number }>;
    n: number;
  } | null>(null);
  const [pathRunning, setPathRunning] = useState(false);

  // CFA
  const [cfaFactors, setCfaFactors] = useState<Array<{ name: string; indicators: string[] }>>([
    { name: "F1", indicators: [] },
  ]);
  const [cfaResult, setCfaResult] = useState<{
    loadings?: Array<{
      factor: string;
      indicator: string;
      estimate: number;
      se: number;
      z: number;
      pValue: number;
    }>;
    factorCovariances?: Array<{
      factor1: string;
      factor2: string;
      covariance: number;
      se: number;
    }>;
    fitIndices?: Record<string, number | string>;
    n?: number;
    model?: string;
    error?: string;
  } | null>(null);
  const [cfaRunning, setCfaRunning] = useState(false);

  // PLS-SEM
  const [plsOuter, setPlsOuter] = useState<Array<{ lv: string; indicators: string[] }>>([
    { lv: "LV1", indicators: [] },
  ]);
  const [plsInner, setPlsInner] = useState<Array<{ from: string; to: string }>>([]);
  const [plsResult, setPlsResult] = useState<{
    pathCoefficients: Array<{
      from: string;
      to: string;
      coefficient: number;
      se?: number;
      tStat?: number;
      pValue?: number;
      ciLower?: number;
      ciUpper?: number;
    }>;
    loadings: Array<{ latent: string; indicator: string; loading: number }>;
    r2: Record<string, number>;
    n: number;
    fornellLarcker: Record<string, number>;
    ave?: Record<string, number>;
    compositeReliability?: Record<string, number | null>;
    fornellLarckerConstructs?: string[];
    fornellLarckerMatrix?: number[][];
    htmtConstructs?: string[];
    htmtMatrix?: (number | null)[][];
    estimationNote?: string;
  } | null>(null);
  const [plsRunning, setPlsRunning] = useState(false);
  const [semLoading, setSemLoading] = useState<string | null>(null);

  const runMediation = async () => {
    if (!mediationX || mediationMs.length === 0 || !mediationY || !rows.length) return;
    if (analysisBackendAvailable) {
      setSemLoading("mediation");
      try {
        const res = await quantisApi.analyzeMediation(rows, mediationX, mediationMs, mediationY);
        setMediationResult(res ?? null);
      } finally {
        setSemLoading(null);
      }
      return;
    }
    const res = computeMediation(rows, mediationX, mediationMs, mediationY);
    setMediationResult(res ?? null);
  };

  const runModeration = async () => {
    if (!moderationX || !moderationM || !moderationY || !rows.length) return;
    if (analysisBackendAvailable) {
      setSemLoading("moderation");
      try {
        const res = await quantisApi.analyzeModeration(rows, moderationY, moderationX, moderationM);
        setModerationResult(res ?? null);
      } finally {
        setSemLoading(null);
      }
      return;
    }
    const res = computeModeration(rows, moderationY, moderationX, moderationM);
    setModerationResult(res ?? null);
  };

  const runPathAnalysis = async () => {
    const equations = pathEquations.filter((e) => e.yCol && e.xCols.length > 0);
    if (!analysisBackendAvailable) {
      showToast(BACKEND_PYTHON_REQUIRED_MSG);
      return;
    }
    if (!rows.length || equations.length === 0) return;
    setPathRunning(true);
    setPathResult(null);
    try {
      const res = await quantisApi.analyzePathAnalysis(rows, equations);
      setPathResult(res ?? null);
    } finally {
      setPathRunning(false);
    }
  };

  const runCFA = async () => {
    const factorSpec: Record<string, string[]> = {};
    for (const f of cfaFactors) {
      if (f.name && f.indicators.length > 0) factorSpec[f.name] = f.indicators;
    }
    if (!analysisBackendAvailable) {
      showToast(BACKEND_PYTHON_REQUIRED_MSG);
      return;
    }
    if (!rows.length || Object.keys(factorSpec).length === 0) return;
    setCfaRunning(true);
    setCfaResult(null);
    try {
      const res = await quantisApi.analyzeCFA(rows, factorSpec);
      setCfaResult(res);
    } finally {
      setCfaRunning(false);
    }
  };

  const runPLSSEM = async () => {
    const outerModel: Record<string, string[]> = {};
    for (const o of plsOuter) {
      if (o.lv && o.indicators.length > 0) outerModel[o.lv] = o.indicators;
    }
    const innerPaths = plsInner.filter((p) => p.from && p.to);
    if (!analysisBackendAvailable) {
      showToast(BACKEND_PYTHON_REQUIRED_MSG);
      return;
    }
    if (!rows.length || Object.keys(outerModel).length < 2 || innerPaths.length === 0) return;
    setPlsRunning(true);
    setPlsResult(null);
    try {
      const res = await quantisApi.analyzePLSSEM(rows, outerModel, innerPaths);
      setPlsResult(res ?? null);
    } finally {
      setPlsRunning(false);
    }
  };

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">{t("semExplainer.title")}</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("semExplainer.subtitle")}</p>
      {analysisBackendAvailable && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5" /> {t("semExplainer.backendNote")}
        </p>
      )}
      <div className="mb-4">
        <AIAssistPanel
          metadata={
            selectedDataset
              ? `Dataset: ${selectedDataset.name}. ${t("semExplainer.numericColsLabel")}: ${
                  numericCols.length
                }.`
              : undefined
          }
          context="SEM: Mediation (X → M → Y; có thể nhiều M song song) và Moderation (tương tác X×M ảnh hưởng lên Y). Chọn X, một hoặc nhiều M, Y rồi chạy phân tích."
          quickPrompts={[
            {
              label: t("semExplainer.quickPromptMediationVsModeration"),
              systemHint: `Bạn là chuyên gia SEM. So sánh Mediation (M nằm giữa X và Y) và Moderation (M điều tiết ảnh hưởng của X lên Y). ${aiAnswerLangHint()}`,
            },
          ]}
          title={t("semExplainer.aiTitleSem")}
        />
      </div>

      {selectedDataset && numericCols.length >= 3 && (
        <section className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/30 dark:bg-sky-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-1">
            {t("semExplainer.mediationHeading")}
          </h3>
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-3">
            {t("semExplainer.mediationDesc")}
          </p>
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <select
              value={mediationX}
              onChange={(e) => {
                const v = e.target.value;
                setMediationX(v);
                setMediationMs((ms) => ms.filter((m) => m !== v));
                setMediationResult(null);
              }}
              className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2"
            >
              <option value="">{t("semExplainer.xIndependent")}</option>
              {numericCols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <span className="text-neutral-500 self-center" aria-hidden="true">
              →
            </span>
            <select
              value={mediationY}
              onChange={(e) => {
                const v = e.target.value;
                setMediationY(v);
                setMediationMs((ms) => ms.filter((m) => m !== v));
                setMediationResult(null);
              }}
              className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2"
            >
              <option value="">{t("semExplainer.yDependent")}</option>
              {numericCols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={runMediation}
              disabled={semLoading !== null || mediationMs.length === 0}
              className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {semLoading === "mediation" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />{" "}
                  {t("semExplainer.processing")}
                </>
              ) : (
                t("semExplainer.runMediation")
              )}
            </button>
          </div>
          <div className="mb-3">
            <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">
              {t("semExplainer.mediatorSelectLabel")}
            </p>
            <div className="flex flex-wrap gap-x-4 gap-y-2 max-h-40 overflow-y-auto rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white/80 dark:bg-neutral-800/80 p-2">
              {numericCols.filter((c) => c !== mediationX && c !== mediationY).length === 0 ? (
                <span className="text-sm text-neutral-500">{t("semExplainer.selectXYFirst")}</span>
              ) : (
                numericCols
                  .filter((c) => c !== mediationX && c !== mediationY)
                  .map((c) => (
                    <label
                      key={c}
                      className="inline-flex items-center gap-2 text-sm cursor-pointer select-none"
                    >
                      <input
                        type="checkbox"
                        className="rounded border-neutral-400"
                        checked={mediationMs.includes(c)}
                        onChange={() => {
                          setMediationMs((prev) =>
                            prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                          );
                          setMediationResult(null);
                        }}
                      />
                      <span>{c}</span>
                    </label>
                  ))
              )}
            </div>
          </div>
          {mediationResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm mt-3">
              <AIAssistPanel
                context={`Mediation (Baron–Kenny, ${
                  mediationResult.paths.length
                } M song song). ${mediationResult.paths
                  .map(
                    (p) =>
                      `${p.mCol}: a=${p.a.toFixed(3)} (p ${
                        p.aP < 0.001 ? "<.001" : p.aP.toFixed(3)
                      }), b=${p.b.toFixed(3)} (p ${
                        p.bP < 0.001 ? "<.001" : p.bP.toFixed(3)
                      }), gián tiếp riêng=${p.indirect.toFixed(3)}`
                  )
                  .join(" | ")}. c=${mediationResult.c.toFixed(3)}, c'=${mediationResult.cPrime.toFixed(
                  3
                )}, gián tiếp tổng=${mediationResult.indirectEffect.toFixed(
                  3
                )}, % trung gian=${mediationResult.pctMediated.toFixed(1)}%, n=${
                  mediationResult.n
                }.`}
                quickPrompts={[
                  {
                    label: t("semExplainer.quickPromptInterpretMediation"),
                    systemHint: `Bạn là chuyên gia phân tích trung gian (mediation). Giải thích đường a (X→M), b (M→Y trong mô hình đa M), c (tổng X→Y), c' (trực tiếp); hiệu ứng gián tiếp từng M và tổng; % trung gian. ${aiAnswerLangHint()}`,
                  },
                ]}
                title={t("semExplainer.aiTitleMediation")}
              />
              <p className="font-medium mb-2">
                {t("semExplainer.overviewCLabel")} {mediationResult.c.toFixed(4)} (p=
                {mediationResult.cP < 0.001 ? "<.001" : mediationResult.cP.toFixed(3)}),{" "}
                {t("semExplainer.overviewCPrimeLabel")} {mediationResult.cPrime.toFixed(4)} (p=
                {mediationResult.cPrimeP < 0.001 ? "<.001" : mediationResult.cPrimeP.toFixed(3)}
                ). {t("semExplainer.totalIndirectLabel")}{" "}
                {mediationResult.indirectEffect.toFixed(4)}, {t("semExplainer.pctMediatedLabel")}{" "}
                {mediationResult.pctMediated.toFixed(1)}%,{" "}
                <span className="whitespace-nowrap">
                  {t("semExplainer.nLabel")} {mediationResult.n}
                </span>
                .
              </p>
              {mediationResult.paths.length > 0 && (
                <table className="w-full text-xs border-collapse border border-neutral-200 dark:border-neutral-600 mt-2">
                  <thead>
                    <tr className="bg-neutral-100 dark:bg-neutral-900">
                      <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-left">
                        M
                      </th>
                      <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right">
                        a (X→M)
                      </th>
                      <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right">
                        p(a)
                      </th>
                      <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right">
                        {t("semExplainer.colBOther")}
                      </th>
                      <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right">
                        p(b)
                      </th>
                      <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right">
                        a×b
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {mediationResult.paths.map((p) => (
                      <tr key={p.mCol}>
                        <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 font-medium">
                          {p.mCol}
                        </td>
                        <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right tabular-nums">
                          {p.a.toFixed(4)}
                        </td>
                        <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right tabular-nums">
                          {p.aP < 0.001 ? "<.001" : p.aP.toFixed(3)}
                        </td>
                        <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right tabular-nums">
                          {p.b.toFixed(4)}
                        </td>
                        <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right tabular-nums">
                          {p.bP < 0.001 ? "<.001" : p.bP.toFixed(3)}
                        </td>
                        <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right tabular-nums">
                          {p.indirect.toFixed(4)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          )}
        </section>
      )}

      {selectedDataset && numericCols.length >= 3 && (
        <section className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">
            {t("semExplainer.moderationHeading")}
          </h3>
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <select
              value={moderationX}
              onChange={(e) => {
                setModerationX(e.target.value);
                setModerationResult(null);
              }}
              className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2"
            >
              <option value="">{t("semExplainer.xIndependent")}</option>
              {numericCols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={moderationM}
              onChange={(e) => {
                setModerationM(e.target.value);
                setModerationResult(null);
              }}
              className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2"
            >
              <option value="">{t("semExplainer.mediatorModerator")}</option>
              {numericCols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <select
              value={moderationY}
              onChange={(e) => {
                setModerationY(e.target.value);
                setModerationResult(null);
              }}
              className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2"
            >
              <option value="">{t("semExplainer.yDependent")}</option>
              {numericCols.map((c) => (
                <option key={c} value={c}>
                  {c}
                </option>
              ))}
            </select>
            <button
              type="button"
              onClick={runModeration}
              disabled={semLoading !== null}
              className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {semLoading === "moderation" ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />{" "}
                  {t("semExplainer.processing")}
                </>
              ) : (
                t("semExplainer.runModeration")
              )}
            </button>
          </div>
          {moderationResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm mt-3">
              <AIAssistPanel
                context={`Moderation: R² = ${moderationResult.r2.toFixed(3)}, n = ${
                  moderationResult.n
                }. Biến: ${moderationResult.xNames.join(
                  ", "
                )}. Hệ số tương tác p < 0.05 → có điều tiết.`}
                quickPrompts={[
                  {
                    label: t("semExplainer.quickPromptInterpretModeration"),
                    systemHint: `Bạn là chuyên gia phân tích điều tiết (moderation). Giải thích: tương tác giữa X và M (biến điều tiết) ảnh hưởng lên Y; khi nào điều tiết có ý nghĩa (hệ số tương tác p<0.05). Nêu cách đọc và báo cáo. ${aiAnswerLangHint()}`,
                  },
                ]}
                title={t("semExplainer.aiTitleModeration")}
              />
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">{t("semExplainer.colVariable")}</th>
                    <th className="text-right p-2">{t("semExplainer.colCoefficient")}</th>
                    <th className="text-right p-2">SE</th>
                    <th className="text-right p-2">t</th>
                    <th className="text-right p-2">p-value</th>
                  </tr>
                </thead>
                <tbody>
                  {["(Intercept)", ...moderationResult.xNames].map((name) => (
                    <tr
                      key={name}
                      className="border-b border-neutral-100 dark:border-neutral-700/50"
                    >
                      <td className="p-2 font-medium">{name}</td>
                      <td className="p-2 text-right">
                        {name === "(Intercept)"
                          ? moderationResult.intercept.toFixed(4)
                          : moderationResult.coefficients[name]?.toFixed(4) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {moderationResult.se[name]?.toFixed(4) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {moderationResult.tStat[name]?.toFixed(3) ?? "—"}
                      </td>
                      <td className="p-2 text-right">
                        {moderationResult.pValue[name] != null
                          ? moderationResult.pValue[name] < 0.001
                            ? "< .001"
                            : moderationResult.pValue[name].toFixed(3)
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 text-neutral-600 dark:text-neutral-400 border-t border-neutral-100">
                R² = {moderationResult.r2.toFixed(4)}, n = {moderationResult.n}.{" "}
                {t("semExplainer.interactionSignificantNote")}
              </p>
            </div>
          )}
        </section>
      )}

      {!analysisBackendAvailable && selectedDataset && (
        <section className="rounded-lg border border-dashed border-amber-300/80 dark:border-amber-700/60 bg-amber-50/40 dark:bg-amber-950/20 p-4 mb-6 text-sm">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
            {t("semExplainer.whyNotSeeHeading")}
          </h3>
          <p className="text-neutral-700 dark:text-neutral-300 mb-2">
            {t("semExplainer.pythonBackendRequiredPrefix")}{" "}
            <strong>{t("semExplainer.pythonBackendRequiredStrong")}</strong>{" "}
            {t("semExplainer.pythonBackendRequiredSuffix")}
          </p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400">
            {t("semExplainer.checkMenuPrefix")}{" "}
            <strong className="text-neutral-800 dark:text-neutral-200">
              {t("semExplainer.checkMenuStrong")}
            </strong>{" "}
            {t("semExplainer.checkMenuMiddle")}{" "}
            <code className="rounded bg-neutral-200/90 dark:bg-neutral-800 px-1 py-0.5 text-[11px]">
              ANALYZE_PYTHON_URL
            </code>{" "}
            {t("semExplainer.checkMenuPointTo")}{" "}
            <code className="rounded bg-neutral-200/90 dark:bg-neutral-800 px-1 py-0.5 text-[11px]">
              backend-python
            </code>{" "}
            {t("semExplainer.checkMenuOfQuantis")}
          </p>
        </section>
      )}

      {analysisBackendAvailable && selectedDataset && numericCols.length >= 2 && (
        <section className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">
            {t("semExplainer.pathAnalysisHeading")}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
            {t("semExplainer.pathAnalysisDesc")}
          </p>
          {pathEquations.map((eq, idx) => (
            <div key={idx} className="flex flex-wrap gap-2 items-center mb-2">
              <select
                value={eq.yCol}
                onChange={(e) => {
                  const next = [...pathEquations];
                  next[idx] = { ...next[idx], yCol: e.target.value };
                  setPathEquations(next);
                  setPathResult(null);
                }}
                className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm"
              >
                <option value="">{t("semExplainer.yDependent")}</option>
                {numericCols.map((c) => (
                  <option key={c} value={c}>
                    {c}
                  </option>
                ))}
              </select>
              <span className="text-neutral-500">~</span>
              <div className="flex flex-wrap gap-1">
                {numericCols
                  .filter((c) => c !== eq.yCol)
                  .map((col) => (
                    <label key={col} className="flex items-center gap-1 text-sm">
                      <input
                        type="checkbox"
                        checked={eq.xCols.includes(col)}
                        onChange={() => {
                          const next = [...pathEquations];
                          const x = next[idx].xCols.includes(col)
                            ? next[idx].xCols.filter((x) => x !== col)
                            : [...next[idx].xCols, col];
                          next[idx] = { ...next[idx], xCols: x };
                          setPathEquations(next);
                          setPathResult(null);
                        }}
                      />
                      {col}
                    </label>
                  ))}
              </div>
              {pathEquations.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setPathEquations(pathEquations.filter((_, i) => i !== idx));
                    setPathResult(null);
                  }}
                  className="text-red-600 text-sm"
                >
                  {t("semExplainer.delete")}
                </button>
              )}
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() => setPathEquations([...pathEquations, { yCol: "", xCols: [] }])}
              className="rounded-md border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm"
            >
              {t("semExplainer.addEquation")}
            </button>
            <button
              type="button"
              onClick={runPathAnalysis}
              disabled={
                pathRunning || pathEquations.every((e) => !e.yCol || e.xCols.length === 0)
              }
              className="rounded-md bg-violet-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {pathRunning ? t("semExplainer.running") : t("semExplainer.runPathAnalysis")}
            </button>
          </div>
          {pathResult && (
            <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
              <p className="p-2 font-medium">
                {t("semExplainer.pathCoefficientsLabel")} (n = {pathResult.n})
              </p>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">From</th>
                    <th className="text-left p-2">To</th>
                    <th className="text-right p-2">{t("semExplainer.colCoefficient")}</th>
                    <th className="text-right p-2">SE</th>
                    <th className="text-right p-2">t</th>
                    <th className="text-right p-2">p</th>
                  </tr>
                </thead>
                <tbody>
                  {pathResult.pathCoefficients.map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-neutral-100 dark:border-neutral-700/50"
                    >
                      <td className="p-2">{p.from}</td>
                      <td className="p-2">{p.to}</td>
                      <td className="p-2 text-right">{p.coefficient.toFixed(4)}</td>
                      <td className="p-2 text-right">{p.se.toFixed(4)}</td>
                      <td className="p-2 text-right">{p.tStat.toFixed(3)}</td>
                      <td className="p-2 text-right">
                        {p.pValue < 0.001 ? "<.001" : p.pValue.toFixed(3)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 text-neutral-600 dark:text-neutral-400 border-t">
                {t("semExplainer.r2ByEquationLabel")}:{" "}
                {pathResult.equationsR2.map((e) => `${e.yCol}=${e.r2.toFixed(3)}`).join(", ")}
              </p>
            </div>
          )}
        </section>
      )}

      {analysisBackendAvailable && selectedDataset && numericCols.length >= 2 && (
        <section className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">
            {t("semExplainer.cfaHeading")}
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
            {t("semExplainer.cfaDesc")}
          </p>
          {cfaFactors.map((f, idx) => (
            <div key={idx} className="mb-3">
              <div className="flex flex-wrap gap-2 items-center mb-1">
                <input
                  type="text"
                  value={f.name}
                  onChange={(e) => {
                    const next = [...cfaFactors];
                    next[idx] = { ...next[idx], name: e.target.value };
                    setCfaFactors(next);
                    setCfaResult(null);
                  }}
                  placeholder={t("semExplainer.factorNamePlaceholder")}
                  className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-24"
                />
                <span className="text-neutral-500">=~</span>
                {numericCols.map((col) => (
                  <label key={col} className="flex items-center gap-1 text-sm">
                    <input
                      type="checkbox"
                      checked={f.indicators.includes(col)}
                      onChange={() => {
                        const next = [...cfaFactors];
                        const ind = next[idx].indicators.includes(col)
                          ? next[idx].indicators.filter((x) => x !== col)
                          : [...next[idx].indicators, col];
                        next[idx] = { ...next[idx], indicators: ind };
                        setCfaFactors(next);
                        setCfaResult(null);
                      }}
                    />
                    {col}
                  </label>
                ))}
                {cfaFactors.length > 1 && (
                  <button
                    type="button"
                    onClick={() => {
                      setCfaFactors(cfaFactors.filter((_, i) => i !== idx));
                      setCfaResult(null);
                    }}
                    className="text-red-600 text-sm"
                  >
                    {t("semExplainer.delete")}
                  </button>
                )}
              </div>
            </div>
          ))}
          <div className="flex gap-2 mt-2">
            <button
              type="button"
              onClick={() =>
                setCfaFactors([...cfaFactors, { name: `F${cfaFactors.length + 1}`, indicators: [] }])
              }
              className="rounded-md border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm"
            >
              {t("semExplainer.addFactor")}
            </button>
            <button
              type="button"
              onClick={runCFA}
              disabled={
                cfaRunning || cfaFactors.every((f) => !f.name || f.indicators.length === 0)
              }
              className="rounded-md bg-emerald-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
            >
              {cfaRunning ? t("semExplainer.running") : t("semExplainer.runCfa")}
            </button>
          </div>
          {cfaResult && (
            <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
              {cfaResult.error ? (
                <p className="p-2 text-red-600">{cfaResult.error}</p>
              ) : (
                <>
                  <p className="p-2 font-medium">Loadings (n = {cfaResult.n ?? "—"})</p>
                  {cfaResult.loadings && cfaResult.loadings.length > 0 && (
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="text-left p-2">{t("semExplainer.colFactor")}</th>
                          <th className="text-left p-2">{t("semExplainer.colIndicator")}</th>
                          <th className="text-right p-2">Estimate</th>
                          <th className="text-right p-2">SE</th>
                          <th className="text-right p-2">z</th>
                          <th className="text-right p-2">p</th>
                        </tr>
                      </thead>
                      <tbody>
                        {cfaResult.loadings.map((l, i) => (
                          <tr
                            key={i}
                            className="border-b border-neutral-100 dark:border-neutral-700/50"
                          >
                            <td className="p-2">{l.factor}</td>
                            <td className="p-2">{l.indicator}</td>
                            <td className="p-2 text-right">{l.estimate.toFixed(4)}</td>
                            <td className="p-2 text-right">{l.se.toFixed(4)}</td>
                            <td className="p-2 text-right">{l.z.toFixed(3)}</td>
                            <td className="p-2 text-right">
                              {l.pValue < 0.001 ? "<.001" : l.pValue.toFixed(3)}
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  )}
                  {cfaResult.fitIndices && Object.keys(cfaResult.fitIndices).length > 0 && (
                    <p className="p-2 border-t text-neutral-600 dark:text-neutral-400">
                      Fit:{" "}
                      {Object.entries(cfaResult.fitIndices)
                        .map(([k, v]) => `${k}=${typeof v === "number" ? v.toFixed(3) : v}`)
                        .join(", ")}
                    </p>
                  )}
                </>
              )}
            </div>
          )}
        </section>
      )}

      {analysisBackendAvailable && selectedDataset && numericCols.length >= 2 && (
        <section className="rounded-lg border border-orange-200 dark:border-orange-800 bg-orange-50/30 dark:bg-orange-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">
            PLS-SEM (SmartPLS-style)
          </h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">
            {t("semExplainer.plsDesc")}
          </p>
          <p className="text-xs text-neutral-500 mb-2">{t("semExplainer.plsDesc2")}</p>
          {plsOuter.map((o, idx) => (
            <div key={idx} className="flex flex-wrap gap-2 items-center mb-2">
              <input
                type="text"
                value={o.lv}
                onChange={(e) => {
                  const next = [...plsOuter];
                  next[idx] = { ...next[idx], lv: e.target.value };
                  setPlsOuter(next);
                  setPlsResult(null);
                }}
                placeholder="Construct"
                className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-24"
              />
              <span className="text-neutral-500">←</span>
              {numericCols.map((col) => (
                <label key={col} className="flex items-center gap-1 text-sm">
                  <input
                    type="checkbox"
                    checked={o.indicators.includes(col)}
                    onChange={() => {
                      const next = [...plsOuter];
                      const ind = next[idx].indicators.includes(col)
                        ? next[idx].indicators.filter((x) => x !== col)
                        : [...next[idx].indicators, col];
                      next[idx] = { ...next[idx], indicators: ind };
                      setPlsOuter(next);
                      setPlsResult(null);
                    }}
                  />
                  {col}
                </label>
              ))}
              {plsOuter.length > 1 && (
                <button
                  type="button"
                  onClick={() => {
                    setPlsOuter(plsOuter.filter((_, i) => i !== idx));
                    setPlsResult(null);
                  }}
                  className="text-red-600 text-sm"
                >
                  {t("semExplainer.delete")}
                </button>
              )}
            </div>
          ))}
          <div className="flex flex-wrap gap-2 items-center mt-2 mb-2">
            <button
              type="button"
              onClick={() =>
                setPlsOuter([...plsOuter, { lv: `LV${plsOuter.length + 1}`, indicators: [] }])
              }
              className="rounded-md border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm"
            >
              {t("semExplainer.addConstruct")}
            </button>
            <span className="text-neutral-500 text-sm">{t("semExplainer.innerPathLabel")}</span>
            {plsInner.map((p, idx) => (
              <span key={idx} className="flex items-center gap-1">
                <select
                  value={p.from}
                  onChange={(e) => {
                    const next = [...plsInner];
                    next[idx] = { ...next[idx], from: e.target.value };
                    setPlsInner(next);
                    setPlsResult(null);
                  }}
                  className="rounded border px-1.5 py-0.5 text-sm"
                >
                  {plsOuter.map((o) => (
                    <option key={o.lv} value={o.lv}>
                      {o.lv}
                    </option>
                  ))}
                </select>
                →{" "}
                <select
                  value={p.to}
                  onChange={(e) => {
                    const next = [...plsInner];
                    next[idx] = { ...next[idx], to: e.target.value };
                    setPlsInner(next);
                    setPlsResult(null);
                  }}
                  className="rounded border px-1.5 py-0.5 text-sm"
                >
                  {plsOuter.map((o) => (
                    <option key={o.lv} value={o.lv}>
                      {o.lv}
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => setPlsInner(plsInner.filter((_, i) => i !== idx))}
                  className="text-red-600 text-xs"
                >
                  x
                </button>
              </span>
            ))}
            <button
              type="button"
              onClick={() =>
                setPlsInner([
                  ...plsInner,
                  { from: plsOuter[0]?.lv ?? "", to: plsOuter[1]?.lv ?? "" },
                ])
              }
              className="rounded border border-neutral-300 px-2 py-0.5 text-sm"
            >
              {t("semExplainer.addPath")}
            </button>
          </div>
          <button
            type="button"
            onClick={runPLSSEM}
            disabled={
              plsRunning ||
              plsOuter.every((o) => !o.lv || o.indicators.length === 0) ||
              plsInner.length === 0
            }
            className="rounded-md bg-orange-600 text-white px-4 py-2 text-sm hover:opacity-90 disabled:opacity-50"
          >
            {plsRunning ? t("semExplainer.running") : t("semExplainer.runPlsSem")}
          </button>
          {plsResult && (
            <div className="mt-3 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
              <p className="p-2 font-medium">Path coefficients (n = {plsResult.n}, bootstrap)</p>
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">From</th>
                    <th className="text-left p-2">To</th>
                    <th className="text-right p-2">Hệ số</th>
                    <th className="text-right p-2">SE</th>
                    <th className="text-right p-2">t</th>
                    <th className="text-right p-2">p</th>
                    <th className="text-right p-2">CI 95%</th>
                  </tr>
                </thead>
                <tbody>
                  {plsResult.pathCoefficients.map((p, i) => (
                    <tr
                      key={i}
                      className="border-b border-neutral-100 dark:border-neutral-700/50"
                    >
                      <td className="p-2">{p.from}</td>
                      <td className="p-2">{p.to}</td>
                      <td className="p-2 text-right">{p.coefficient.toFixed(4)}</td>
                      <td className="p-2 text-right">{p.se != null ? p.se.toFixed(4) : "—"}</td>
                      <td className="p-2 text-right">
                        {p.tStat != null ? p.tStat.toFixed(3) : "—"}
                      </td>
                      <td className="p-2 text-right">
                        {p.pValue != null
                          ? p.pValue < 0.001
                            ? "<.001"
                            : p.pValue.toFixed(3)
                          : "—"}
                      </td>
                      <td className="p-2 text-right">
                        {p.ciLower != null && p.ciUpper != null
                          ? `[${p.ciLower.toFixed(3)}, ${p.ciUpper.toFixed(3)}]`
                          : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 border-t text-neutral-600 dark:text-neutral-400">
                R²:{" "}
                {Object.entries(plsResult.r2)
                  .map(([k, v]) => `${k}=${v.toFixed(3)}`)
                  .join(", ")}
              </p>
              {plsResult.ave && Object.keys(plsResult.ave).length > 0 && (
                <div className="p-2 border-t">
                  <p className="font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                    {t("semExplainer.aveCompositeReliabilityHeading")}
                  </p>
                  <table className="w-full text-xs border-collapse border border-neutral-200 dark:border-neutral-600">
                    <thead>
                      <tr className="bg-neutral-100 dark:bg-neutral-900">
                        <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-left">
                          Construct
                        </th>
                        <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right">
                          AVE
                        </th>
                        <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right">
                          CR
                        </th>
                        <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right">
                          √AVE
                        </th>
                      </tr>
                    </thead>
                    <tbody>
                      {Object.keys(plsResult.ave).map((lv) => (
                        <tr key={lv}>
                          <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 font-medium">
                            {lv}
                          </td>
                          <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right tabular-nums">
                            {plsResult.ave![lv].toFixed(3)}
                          </td>
                          <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right tabular-nums">
                            {plsResult.compositeReliability?.[lv] != null
                              ? (plsResult.compositeReliability![lv] as number).toFixed(3)
                              : "—"}
                          </td>
                          <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-right tabular-nums">
                            {(plsResult.fornellLarcker[lv] ?? 0).toFixed(3)}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
              {plsResult.fornellLarckerConstructs &&
                plsResult.fornellLarckerMatrix &&
                plsResult.fornellLarckerConstructs.length > 0 && (
                  <div className="p-2 border-t overflow-x-auto">
                    <p className="font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                      Fornell–Larcker
                    </p>
                    <p className="text-neutral-500 text-xs mb-1">
                      {t("semExplainer.fornellLarckerNote")}
                    </p>
                    <table className="w-full text-xs border-collapse border border-neutral-200 dark:border-neutral-600">
                      <thead>
                        <tr className="bg-neutral-100 dark:bg-neutral-900">
                          <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-left" />
                          {plsResult.fornellLarckerConstructs.map((c) => (
                            <th
                              key={c}
                              className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-center"
                            >
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {plsResult.fornellLarckerConstructs.map((rowLv, i) => (
                          <tr key={rowLv}>
                            <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 font-medium">
                              {rowLv}
                            </td>
                            {plsResult.fornellLarckerConstructs!.map((_, j) => {
                              const M = plsResult.fornellLarckerMatrix!;
                              const v = M[i]?.[j];
                              const show = v != null && !Number.isNaN(v);
                              const isDiag = i === j;
                              return (
                                <td
                                  key={`${i}-${j}`}
                                  className={`border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-center tabular-nums ${
                                    isDiag
                                      ? "bg-neutral-100/80 dark:bg-neutral-800/80 font-medium"
                                      : j < i
                                      ? "text-neutral-700 dark:text-neutral-300"
                                      : ""
                                  }`}
                                >
                                  {show ? v.toFixed(3) : "—"}
                                </td>
                              );
                            })}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              {plsResult.htmtConstructs &&
                plsResult.htmtMatrix &&
                plsResult.htmtConstructs.length > 1 && (
                  <div className="p-2 border-t overflow-x-auto">
                    <p className="font-medium text-neutral-800 dark:text-neutral-200 mb-1">
                      HTMT (Heterotrait–Monotrait)
                    </p>
                    <p className="text-neutral-500 text-xs mb-1">
                      {t("semExplainer.htmtNote")}
                    </p>
                    <table className="w-full text-xs border-collapse border border-neutral-200 dark:border-neutral-600">
                      <thead>
                        <tr className="bg-neutral-100 dark:bg-neutral-900">
                          <th className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-left" />
                          {plsResult.htmtConstructs.map((c) => (
                            <th
                              key={c}
                              className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-center"
                            >
                              {c}
                            </th>
                          ))}
                        </tr>
                      </thead>
                      <tbody>
                        {plsResult.htmtConstructs.map((rowLv, i) => (
                          <tr key={rowLv}>
                            <td className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 font-medium">
                              {rowLv}
                            </td>
                            {plsResult.htmtConstructs!.map((_, j) => (
                              <td
                                key={`h-${i}-${j}`}
                                className="border border-neutral-200 dark:border-neutral-600 px-2 py-1 text-center tabular-nums"
                              >
                                {j >= i
                                  ? ""
                                  : (() => {
                                      const v = plsResult.htmtMatrix![i][j];
                                      return v == null ? "—" : v.toFixed(3);
                                    })()}
                              </td>
                            ))}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              {plsResult.fornellLarcker &&
                Object.keys(plsResult.fornellLarcker).length > 0 &&
                !plsResult.fornellLarckerMatrix && (
                  <p className="p-2 text-neutral-600 dark:text-neutral-400">
                    {t("semExplainer.fornellLarckerDiagOnlyLabel")}:{" "}
                    {Object.entries(plsResult.fornellLarcker)
                      .map(([k, v]) => `${k}=${v.toFixed(3)}`)
                      .join(", ")}
                  </p>
                )}
              {plsResult.loadings && plsResult.loadings.length > 0 && (
                <p className="p-2 text-neutral-500 text-xs">
                  Loadings:{" "}
                  {plsResult.loadings
                    .slice(0, 8)
                    .map((l) => `${l.indicator}→${l.latent}=${l.loading.toFixed(2)}`)
                    .join("; ")}
                  {plsResult.loadings.length > 8 ? " ..." : ""}
                </p>
              )}
            </div>
          )}
        </section>
      )}

      {(!selectedDataset || numericCols.length < 3) && (
        <p className="text-neutral-500">{t("semExplainer.selectDatasetPrompt")}</p>
      )}
    </div>
  );
}

export { SEMTab as SEMExplainerView };
