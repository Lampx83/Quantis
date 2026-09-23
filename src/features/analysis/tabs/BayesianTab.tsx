import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Dataset } from "@/types";
import { computeBetaPosterior, type BetaPosteriorResult } from "@/utils/stats";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";

export interface BayesianTabProps {
  selectedDataset?: Dataset;
  analysisBackendAvailable?: boolean;
  showToast?: (msg: string) => void;
}

export function BayesianTab({
  selectedDataset: _selectedDataset,
  analysisBackendAvailable = false,
  showToast: _showToast,
}: BayesianTabProps) {
  const [successes, setSuccesses] = useState(10);
  const [n, setN] = useState(50);
  const [priorAlpha, setPriorAlpha] = useState(1);
  const [priorBeta, setPriorBeta] = useState(1);
  const [result, setResult] = useState<BetaPosteriorResult | null>(null);
  const [bayesianLoading, setBayesianLoading] = useState(false);

  const runBeta = async () => {
    if (analysisBackendAvailable) {
      setBayesianLoading(true);
      try {
        const res = await quantisApi.analyzeBetaPosterior(successes, n, priorAlpha, priorBeta);
        setResult(res ?? null);
      } finally {
        setBayesianLoading(false);
      }
      return;
    }
    const res = computeBetaPosterior(successes, n, priorAlpha, priorBeta);
    setResult(res);
  };

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">Bayesian</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("bayesianTab.subtitle")}</p>
      <div className="mb-4">
        <AIAssistPanel
          context="Bayesian: ước lượng tỉ lệ (proportion) với prior Beta, posterior Beta-Binomial. Nhập số lần thành công và tổng n, prior α và β (mặc định 1,1)."
          quickPrompts={[{ label: t("bayesianTab.quickPromptExplainPriorPosterior"), systemHint: `Bạn là chuyên gia thống kê Bayesian. Giải thích prior Beta, posterior sau khi quan sát dữ liệu, khoảng tin cậy 95%. ${aiAnswerLangHint()}` }]}
          title={t("bayesianTab.aiTitleBayesian")}
        />
      </div>
      <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-900/20 p-4 mb-4">
        <h3 className="font-medium text-sky-800 dark:text-sky-200 mb-3">{t("bayesianTab.betaBinomialHeading")}</h3>
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("bayesianTab.successesLabel")}</label>
            <input type="number" min={0} value={successes} onChange={(e) => { setSuccesses(Math.max(0, parseInt(e.target.value, 10) || 0)); setResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("bayesianTab.totalNLabel")}</label>
            <input type="number" min={1} value={n} onChange={(e) => { setN(Math.max(1, parseInt(e.target.value, 10) || 1)); setResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("bayesianTab.priorAlphaLabel")}</label>
            <input type="number" min={0.01} step={0.5} value={priorAlpha} onChange={(e) => { setPriorAlpha(Math.max(0.01, parseFloat(e.target.value) || 1)); setResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("bayesianTab.priorBetaLabel")}</label>
            <input type="number" min={0.01} step={0.5} value={priorBeta} onChange={(e) => { setPriorBeta(Math.max(0.01, parseFloat(e.target.value) || 1)); setResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
          </div>
          <button type="button" onClick={runBeta} disabled={bayesianLoading} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
            {bayesianLoading ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("bayesianTab.processing")}</> : t("bayesianTab.computePosterior")}
          </button>
        </div>
        {result && (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm mt-2">
            <AIAssistPanel
              context={`Posterior Beta(α=${result.postAlpha.toFixed(2)}, β=${result.postBeta.toFixed(2)}). Trung bình (tỉ lệ) = ${result.mean.toFixed(4)}, phương sai = ${result.variance.toFixed(6)}, 95% CI = [${result.ci95Lower.toFixed(4)}, ${result.ci95Upper.toFixed(4)}]. Dữ liệu: ${n} trials, ${successes} thành công.`}
              quickPrompts={[{ label: t("bayesianTab.quickPromptInterpretPosterior"), systemHint: `Bạn là chuyên gia thống kê Bayesian. Giải thích: posterior Beta sau khi quan sát dữ liệu, trung bình (ước lượng tỉ lệ), khoảng tin cậy 95%; so sánh với prior. ${aiAnswerLangHint()}` }]}
              title={t("bayesianTab.aiTitleBayesianBeta")}
            />
            <p className="font-medium mb-1">Posterior Beta(α = {result.postAlpha.toFixed(2)}, β = {result.postBeta.toFixed(2)})</p>
            <p>{t("bayesianTab.meanProportionLabel")} {result.mean.toFixed(4)}</p>
            <p>{t("bayesianTab.varianceLabel")} {result.variance.toFixed(6)}</p>
            <p>{t("bayesianTab.ci95Label")} [{result.ci95Lower.toFixed(4)}, {result.ci95Upper.toFixed(4)}]</p>
          </div>
        )}
      </div>
      <p className="text-sm text-neutral-500">{t("bayesianTab.advancedModelsComingSoon")}</p>
    </div>
  );
}
