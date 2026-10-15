import React, { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Dataset } from "@/types";
import { getDataRows, computeEFA, computeKMOBartlett, type EFAResult, type KMOBartlettResult } from "@/utils/stats";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";
import { InfoHint, GlossaryBar } from "@/components/common/InfoHint";

export interface FactorTabProps {
  selectedDataset: Dataset;
  analysisBackendAvailable?: boolean;
  showToast?: (msg: string) => void;
}

export function FactorTab({
  selectedDataset,
  analysisBackendAvailable = false,
  showToast: _showToast,
}: FactorTabProps) {
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
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [nFactors, setNFactors] = useState<number | "">("");
  const [result, setResult] = useState<EFAResult | null>(null);
  const [efaLoading, setEfaLoading] = useState(false);
  const [kmoResult, setKmoResult] = useState<KMOBartlettResult | null>(null);

  const toggleCol = (c: string) =>
    setSelectedCols((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );

  const runEFA = async () => {
    if (selectedCols.length < 2) return;
    const k = typeof nFactors === "number" && nFactors >= 1 ? nFactors : undefined;
    // KMO + Bartlett luôn tính ở frontend (độc lập backend Python) trên đúng các biến được chọn.
    setKmoResult(computeKMOBartlett(rows, selectedCols));
    if (analysisBackendAvailable) {
      setEfaLoading(true);
      try {
        const res = await quantisApi.analyzeEFA(rows, selectedCols, k);
        setResult(res ?? null);
      } finally {
        setEfaLoading(false);
      }
      return;
    }
    const res = computeEFA(rows, selectedCols, k);
    setResult(res ?? null);
  };

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">{t("factorTab.title")}<InfoHint term="efa" /></h2>
      <GlossaryBar terms={["efa", "kmo", "bartlett"]} />
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("factorTab.description")}</p>
      <div className="mb-4">
        <AIAssistPanel
          metadata={
            selectedDataset
              ? `Dataset: ${selectedDataset.name}. Số cột số: ${numericCols.length}.`
              : undefined
          }
          context="Phân tích nhân tố khám phá (EFA): trích xuất nhân tố (PCA), xoay varimax. Chọn ít nhất 2 biến (item), có thể chỉ định số nhân tố hoặc để eigenvalue > 1."
          quickPrompts={[
            {
              label: t("factorTab.aiPromptSuggestFactorsLabel"),
              systemHint: `Bạn là chuyên gia EFA. Gợi ý cách chọn số nhân tố (eigenvalue > 1, scree plot), ý nghĩa loadings và đặt tên nhân tố. ${aiAnswerLangHint()}`,
            },
          ]}
          title={t("factorTab.askAiTitle")}
        />
      </div>
      {numericCols.length >= 2 ? (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-sm font-medium">{t("factorTab.selectItemsLabel")}</span>
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
              <label className="block text-sm font-medium mb-1">{t("factorTab.numFactorsLabel")}</label>
              <input
                type="number"
                min={1}
                max={selectedCols.length}
                value={nFactors}
                onChange={(e) => {
                  const v = e.target.value;
                  setNFactors(v === "" ? "" : Math.max(1, parseInt(v, 10) || 1));
                  setResult(null);
                  setKmoResult(null);
                }}
                className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-28"
                placeholder="Auto"
              />
            </div>
            <button
              type="button"
              onClick={runEFA}
              disabled={efaLoading}
              className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {efaLoading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden />{" "}
                  {t("factorTab.processingLabel")}
                </>
              ) : (
                t("factorTab.runEfaButton")
              )}
            </button>
          </div>
          {result && (
            <div className="space-y-4">
              <AIAssistPanel
                context={`EFA: ${result.nFactors} nhân tố. Eigenvalues: ${result.eigenvalues
                  .slice(0, result.nFactors)
                  .map((e) => e.toFixed(2))
                  .join(", ")}. Phương sai giải thích: ${
                  result.varianceExplained
                    ?.slice(0, result.nFactors)
                    .map((v) => v?.toFixed(1) + "%")
                    .join(", ") ?? "—"
                }. Loadings (varimax) cho các biến: ${result.columnNames
                  .slice(0, 6)
                  .join(", ")}${result.columnNames.length > 6 ? "..." : ""}.${
                  kmoResult && kmoResult.kmo != null
                    ? ` KMO = ${kmoResult.kmo.toFixed(3)}; Bartlett χ²(${kmoResult.bartlettDf}) = ${
                        kmoResult.bartlettChi2?.toFixed(2) ?? "—"
                      }, p ${
                        kmoResult.bartlettP != null && kmoResult.bartlettP < 0.001
                          ? "< 0.001"
                          : "= " + (kmoResult.bartlettP?.toFixed(3) ?? "—")
                      }; MSA thấp (<0.5): ${
                        kmoResult.columnNames.filter((_, i) => (kmoResult.msa[i] ?? 1) < 0.5).join(", ") || "không có"
                      }.`
                    : ""
                }`}
                quickPrompts={[
                  {
                    label: t("factorTab.explainResultsLabel"),
                    systemHint: `Bạn là chuyên gia phân tích nhân tố (EFA). Giải thích: số nhân tố trích, eigenvalue (>1), % phương sai giải thích, loadings (trọng số từng biến trên từng nhân tố). Gợi ý cách đặt tên nhân tố dựa trên biến có loading cao. ${aiAnswerLangHint()}`,
                  },
                ]}
                title={t("factorTab.askAiTitle")}
              />
              {kmoResult && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm" data-testid="kmo-bartlett">
                  <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">
                    {t("factorTab.kmoTitle")}
                    <span className="ml-2 font-normal text-neutral-500">({t("factorTab.casesLabel")}: {kmoResult.n})</span>
                  </p>
                  {kmoResult.singular || kmoResult.kmo == null ? (
                    <p className="p-3 text-amber-700 dark:text-amber-400">{t("factorTab.kmoSingular")}</p>
                  ) : (
                    <>
                      <table className="w-full">
                        <tbody>
                          <tr className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-2">{t("factorTab.kmoLabel")}<InfoHint term="kmo" /></td>
                            <td className={`p-2 text-right font-semibold ${kmoResult.kmo >= 0.5 ? "" : "text-red-600 dark:text-red-400"}`}>{kmoResult.kmo.toFixed(3)}</td>
                          </tr>
                          <tr className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-2">{t("factorTab.bartlettChi2Label")}<InfoHint term="bartlett" /></td>
                            <td className="p-2 text-right">{kmoResult.bartlettChi2 != null ? kmoResult.bartlettChi2.toFixed(3) : "—"}</td>
                          </tr>
                          <tr className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-2">{t("factorTab.bartlettDfLabel")}</td>
                            <td className="p-2 text-right">{kmoResult.bartlettDf}</td>
                          </tr>
                          <tr className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-2">{t("factorTab.bartlettSigLabel")}</td>
                            <td className={`p-2 text-right font-semibold ${kmoResult.bartlettP != null && kmoResult.bartlettP < 0.05 ? "" : "text-red-600 dark:text-red-400"}`}>
                              {kmoResult.bartlettP == null ? "—" : kmoResult.bartlettP < 0.001 ? "< 0.001" : kmoResult.bartlettP.toFixed(3)}
                            </td>
                          </tr>
                        </tbody>
                      </table>
                      <div className="p-2 border-t border-neutral-100 dark:border-neutral-700/50">
                        <p className="font-medium mb-1">{t("factorTab.msaHeader")}</p>
                        <div className="flex flex-wrap gap-x-4 gap-y-1">
                          {kmoResult.columnNames.map((name, i) => {
                            const m = kmoResult.msa[i];
                            return (
                              <span key={name} className={m != null && m < 0.5 ? "text-red-600 dark:text-red-400 font-semibold" : ""}>
                                {name}: {m != null ? m.toFixed(3) : "—"}{m != null && m < 0.5 ? ` (${t("factorTab.msaLowFlag")})` : ""}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                      <div className="p-2 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
                        <p>{kmoResult.kmo >= 0.9 ? t("factorTab.kmoMarvelous") : kmoResult.kmo >= 0.8 ? t("factorTab.kmoMeritorious") : kmoResult.kmo >= 0.7 ? t("factorTab.kmoMiddling") : kmoResult.kmo >= 0.6 ? t("factorTab.kmoMediocre") : kmoResult.kmo >= 0.5 ? t("factorTab.kmoMiserable") : t("factorTab.kmoUnacceptable")}</p>
                        {kmoResult.bartlettP != null && <p>{kmoResult.bartlettP < 0.05 ? t("factorTab.bartlettSignificant") : t("factorTab.bartlettNotSignificant")}</p>}
                        <p>{t("factorTab.kmoCriteria")}</p>
                      </div>
                    </>
                  )}
                </div>
              )}
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
                <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">
                  {t("factorTab.eigenvaluesHeader")}
                </p>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-600">
                      <th className="text-left p-2">{t("factorTab.factorColumnHeader")}</th>
                      <th className="text-right p-2">Eigenvalue</th>
                      <th className="text-right p-2">{t("factorTab.varianceExplainedHeader")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.eigenvalues.slice(0, result.nFactors).map((e, i) => (
                      <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/50">
                        <td className="p-2 font-medium">F{i + 1}</td>
                        <td className="p-2 text-right">{e.toFixed(3)}</td>
                        <td className="p-2 text-right">
                          {result.varianceExplained[i]?.toFixed(1) ?? "—"}%
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
                <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">
                  {t("factorTab.loadingsMatrixHeader")}
                </p>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-600">
                      <th className="text-left p-2">{t("factorTab.variableColumnHeader")}</th>
                      {Array.from({ length: result.nFactors }, (_, i) => (
                        <th key={i} className="text-right p-2">
                          F{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {result.columnNames.map((name, i) => (
                      <tr key={name} className="border-b border-neutral-100 dark:border-neutral-700/50">
                        <td className="p-2 font-medium">{name}</td>
                        {result.loadings[i]?.slice(0, result.nFactors).map((v, j) => (
                          <td key={j} className="p-2 text-right">
                            {v.toFixed(3)}
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
        <p className="text-neutral-500">{t("factorTab.insufficientColumns")}</p>
      )}
    </div>
  );
}
