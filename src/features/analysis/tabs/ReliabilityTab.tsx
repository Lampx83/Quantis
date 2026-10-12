import React, { useState, useEffect, useMemo } from "react";
import type { Dataset } from "@/types";
import { computeCronbachAlpha, computeCronbachDetail } from "@/utils/stats";
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

  // Bảng theo từng biến (Item-Total Statistics) luôn tính ở frontend, độc lập backend Python.
  const itemKey = selectedItems.join("\u0001");
  const detail = useMemo(() => (selectedItems.length >= 2 ? computeCronbachDetail(rows, selectedItems) : null), [rows, itemKey]);
  const lowItems = detail ? detail.items.filter((it) => it.lowItemTotal).map((it) => it.name) : [];
  const raiseItems = detail ? detail.items.filter((it) => it.raisesAlphaIfDeleted).map((it) => it.name) : [];
  const fmtNum = (x: number | null | undefined, d = 3) => (x == null || Number.isNaN(x) ? "—" : x.toFixed(d));

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
              className={`rounded-md px-3 py-1.5 text-sm ${
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
            }. Các item: ${selectedItems.join(", ")}.${detail ? ` Bảng biến–tổng: ${detail.items.map((it) => `${it.name} (corrected item-total=${fmtNum(it.correctedItemTotal)}, α nếu loại=${fmtNum(it.alphaIfDeleted)})`).join("; ")}.${lowItems.length ? ` ${t("reliabilityTab.aiFlaggedPrefix")} ${lowItems.join(", ")}.` : ""}${raiseItems.length ? ` ${t("reliabilityTab.aiRaisesPrefix")} ${raiseItems.join(", ")}.` : ""}` : ""}`}
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
      {detail && (
        <div className="mt-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm" data-testid="item-total-table">
          <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">
            {t("reliabilityTab.itemTotalTitle")}
            <span className="ml-2 font-normal text-neutral-500">({t("reliabilityTab.nCasesLabel")}: {detail.nCases})</span>
          </p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-600">
                <th className="text-left p-2">{t("reliabilityTab.colItem")}</th>
                <th className="text-right p-2">{t("reliabilityTab.colScaleMean")}</th>
                <th className="text-right p-2">{t("reliabilityTab.colScaleVar")}</th>
                <th className="text-right p-2">{t("reliabilityTab.colCitc")}</th>
                <th className="text-right p-2">{t("reliabilityTab.colAlphaDel")}</th>
              </tr>
            </thead>
            <tbody>
              {detail.items.map((it) => (
                <tr key={it.name} className={`border-b border-neutral-100 dark:border-neutral-700/50 ${it.lowItemTotal || it.raisesAlphaIfDeleted ? "bg-amber-50 dark:bg-amber-900/20" : ""}`}>
                  <td className="p-2 font-medium">{it.name}</td>
                  <td className="p-2 text-right">{fmtNum(it.scaleMeanIfDeleted)}</td>
                  <td className="p-2 text-right">{fmtNum(it.scaleVarianceIfDeleted)}</td>
                  <td className={`p-2 text-right ${it.lowItemTotal ? "font-semibold text-amber-700 dark:text-amber-400" : ""}`}>
                    {fmtNum(it.correctedItemTotal)}{it.lowItemTotal ? ` (${t("reliabilityTab.flagLowCitc")})` : ""}
                  </td>
                  <td className={`p-2 text-right ${it.raisesAlphaIfDeleted ? "font-semibold text-amber-700 dark:text-amber-400" : ""}`}>
                    {fmtNum(it.alphaIfDeleted)}{it.raisesAlphaIfDeleted ? ` (${t("reliabilityTab.flagRaisesAlpha")})` : ""}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-2 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
            {lowItems.length === 0 && raiseItems.length === 0 && <p>{t("reliabilityTab.noteAllGood")}</p>}
            {lowItems.length > 0 && <p>{t("reliabilityTab.noteLowCitc")} ({lowItems.join(", ")})</p>}
            {raiseItems.length > 0 && <p>{t("reliabilityTab.noteRaisesAlpha")} ({raiseItems.join(", ")})</p>}
            {detail.nItems < 3 && <p>{t("reliabilityTab.needThreeItems")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
