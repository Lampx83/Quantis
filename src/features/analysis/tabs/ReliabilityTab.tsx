import React, { useState, useEffect } from "react";
import type { Dataset } from "@/types";
import { computeCronbachAlpha } from "@/utils/stats";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";

export interface ReliabilityTabProps {
  selectedDataset: Dataset;
  rows: string[][];
  numericCols: string[];
  analysisBackendAvailable?: boolean;
}

export function ReliabilityTab({
  selectedDataset,
  rows,
  numericCols,
  analysisBackendAvailable = false,
}: ReliabilityTabProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [cronbachBackendResult, setCronbachBackendResult] = useState<number | null>(null);

  const toggle = (c: string) =>
    setSelectedItems((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );

  useEffect(() => {
    if (!analysisBackendAvailable || selectedItems.length < 2) {
      setCronbachBackendResult(null);
      return;
    }
    quantisApi.analyzeCronbach(rows, selectedItems).then(setCronbachBackendResult);
  }, [analysisBackendAvailable, selectedItems.join(","), rows.length]);

  const alpha =
    (analysisBackendAvailable ? cronbachBackendResult : null) ??
    (selectedItems.length >= 2 ? computeCronbachAlpha(rows, selectedItems) : null);

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">{t("reliabilityTab.title")}</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("reliabilityTab.description")}</p>
      <div className="mb-4">
        <AIAssistPanel
          metadata={
            selectedDataset
              ? `Dataset: ${selectedDataset.name}. Số cột số: ${numericCols.length}. Cột: ${numericCols.slice(0, 15).join(", ")}${numericCols.length > 15 ? "…" : ""}.`
              : undefined
          }
          context={t("reliabilityTab.contextDesc")}
          quickPrompts={[
            {
              label: t("reliabilityTab.explainAlphaLabel"),
              systemHint: `${t("reliabilityTab.explainAlphaHint")} ${aiAnswerLangHint()}`,
            },
          ]}
          title={t("reliabilityTab.askAiTitle")}
        />
      </div>
      <div className="mb-4">
        <p className="text-sm font-medium mb-2">{t("reliabilityTab.selectItemsLabel")}</p>
        <div className="flex flex-wrap gap-2">
          {numericCols.map((c) => (
            <button
              key={c}
              type="button"
              onClick={() => toggle(c)}
              className={`rounded-lg px-3 py-1.5 text-sm ${
                selectedItems.includes(c)
                  ? "bg-brand text-white"
                  : "border border-neutral-300 dark:border-neutral-600"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>
      {alpha != null && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
          <AIAssistPanel
            context={`Cronbach's alpha = ${alpha.toFixed(4)}. Số item: ${selectedItems.length}. Đánh giá: ${
              alpha >= 0.9
                ? t("reliabilityTab.evalVeryGood")
                : alpha >= 0.8
                ? t("reliabilityTab.evalGood")
                : alpha >= 0.7
                ? t("reliabilityTab.evalAcceptable")
                : alpha >= 0.6
                ? t("reliabilityTab.evalNeedsImprovement")
                : t("reliabilityTab.evalLow")
            }. Các item: ${selectedItems.join(", ")}.`}
            quickPrompts={[
              {
                label: t("reliabilityTab.interpretAlphaLabel"),
                systemHint: `${t("reliabilityTab.interpretAlphaHint")} ${aiAnswerLangHint()}`,
              },
            ]}
            title={t("reliabilityTab.askAiAlphaTitle")}
          />
          <p className="font-medium">Cronbach&apos;s α = {alpha.toFixed(4)}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {alpha >= 0.9
              ? t("reliabilityTab.resultVeryGood")
              : alpha >= 0.8
              ? t("reliabilityTab.resultGood")
              : alpha >= 0.7
              ? t("reliabilityTab.resultAcceptable")
              : alpha >= 0.6
              ? t("reliabilityTab.resultNeedsImprovement")
              : t("reliabilityTab.resultLow")}
          </p>
        </div>
      )}
    </div>
  );
}
