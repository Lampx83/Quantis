import { useState } from "react";
import { Loader2 } from "lucide-react";
import type { Dataset } from "@/types";
import { getAnalysisRows, numCell, computeKMOBartlett, type KMOBartlettResult } from "@/utils/stats";
import { createFactorSample, factorApiRows } from "@/utils/factorSample";
import { computeFactorPca } from "@/utils/factorPca";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";
import { InfoHint, GlossaryBar } from "@/components/common/InfoHint";

export interface FactorTabProps {
  selectedDataset: Dataset;
  analysisBackendAvailable?: boolean;
  showToast?: (msg: string) => void;
}

type DisplayedPca = NonNullable<Awaited<ReturnType<typeof quantisApi.analyzeEFA>>> & { usedFallback?: boolean };

function FactorAdequacy({ result }: { result: KMOBartlettResult }) {
  const { n, nInput, kmo, msa, issue, bartlettChi2, bartlettDf, bartlettP } = result;
  const rows = [
    { label: t("factorTab.kmoLabel"), value: kmo?.toFixed(3), term: "kmo", warn: kmo != null && kmo < 0.5 },
    { label: t("factorTab.bartlettChi2Label"), value: bartlettChi2?.toFixed(3), term: "bartlett" },
    { label: t("factorTab.bartlettDfLabel"), value: bartlettChi2 != null ? bartlettDf : null },
    { label: t("factorTab.bartlettSigLabel"), value: bartlettP != null && bartlettP < 0.001 ? "< 0.001" : bartlettP?.toFixed(3), warn: bartlettP != null && bartlettP >= 0.05 },
  ] as const;
  const warningClass = "font-semibold text-amber-700 dark:text-amber-400";
  return (
    <section className="mb-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm" data-testid="kmo-bartlett">
      <h3 className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">
        {t("factorTab.kmoTitle")}
        <span className="ml-2 font-normal text-neutral-500">{t("factorTab.casesLabel")}: {n}/{nInput}</span>
      </h3>
      {issue ? (
        <p className="p-2 text-amber-700 dark:text-amber-400">
          {t(`factorTab.${issue.code}`, "columns" in issue ? { items: issue.columns.join(", ") } : undefined)}
        </p>
      ) : (
        <>
          <table className="w-full">
            <tbody>
              {rows.map(({ label, value, ...detail }) => (
                <tr key={label} className="border-b border-neutral-100 dark:border-neutral-700/50">
                  <th scope="row" className="p-2 text-left font-normal">{label}{"term" in detail && <InfoHint term={detail.term} />}</th>
                  <td className={`p-2 text-right ${"warn" in detail && detail.warn ? warningClass : ""}`}>{value ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-2">
            <p className="font-medium mb-1">{t("factorTab.msaHeader")}</p>
            <div className="flex flex-wrap gap-x-4 gap-y-1">
              {result.columnNames.map((name, i) => {
                const value = msa[i];
                return (
                  <span key={name} className={value != null && value < 0.5 ? warningClass : ""}>
                    {name}: {value?.toFixed(3) ?? "—"}
                  </span>
                );
              })}
            </div>
          </div>
          <div className="p-2 space-y-1 text-amber-700 dark:text-amber-400">
            {msa.includes(null) && <p>{t("factorTab.uncorrelatedItems")}</p>}
            {kmo != null && kmo < 0.5 && <p>{t("factorTab.kmoUnacceptable")}</p>}
            {msa.some((value) => value != null && value < 0.5) && <p>{t("factorTab.msaLowFlag")}</p>}
            {bartlettP != null && bartlettP >= 0.05 && <p>{t("factorTab.bartlettNotSignificant")}</p>}
          </div>
        </>
      )}
    </section>
  );
}

export function FactorTab({
  selectedDataset,
  analysisBackendAvailable = false,
  showToast: _showToast,
}: FactorTabProps) {
  const rows = getAnalysisRows(selectedDataset);
  const cols = selectedDataset.columnNames ?? [];
  const numericCols =
    rows.length >= 2
      ? cols.filter((c) => {
          const ci = rows[0].indexOf(c);
          return ci >= 0 && (selectedDataset.variables?.[c]?.type === "numeric" ||
            rows.slice(1).every((r) => !String(r[ci] ?? "").trim() || !Number.isNaN(numCell(r[ci]))));
        })
      : [];
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [nFactors, setNFactors] = useState<number | "">("");
  const [result, setResult] = useState<DisplayedPca | null>(null);
  const [efaLoading, setEfaLoading] = useState(false);
  const [kmoResult, setKmoResult] = useState<KMOBartlettResult | null>(null);
  const [pcaError, setPcaError] = useState<string | null>(null);

  const clearResult = () => {
    setResult(null);
    setKmoResult(null);
    setPcaError(null);
  };

  const toggleCol = (c: string) => {
    setSelectedCols((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );
    clearResult();
  };

  const runEFA = async () => {
    if (selectedCols.length < 2) return;
    const k = nFactors === "" ? undefined : nFactors;
    clearResult();
    const sample = createFactorSample(rows, selectedCols);
    setKmoResult(computeKMOBartlett(sample));
    if (sample.issue && sample.issue.code !== "insufficientRows") return;
    if (sample.nUsed < 10) {
      setPcaError(t("factorTab.pcaMinimumRows"));
      return;
    }
    if (analysisBackendAvailable) {
      if (k != null && (!Number.isInteger(k) || k < 1 || k > sample.columnNames.length)) {
        setPcaError(t("factorTab.pcaInvalidCount", { max: sample.columnNames.length }));
        return;
      }
      setEfaLoading(true);
      try {
        const res = await quantisApi.analyzeEFA(factorApiRows(sample), sample.columnNames, k);
        setResult(res);
        if (!res) setPcaError(t("factorTab.pcaFailed"));
      } finally {
        setEfaLoading(false);
      }
      return;
    }
    const { issue, solution, eigenvalues, suggestedCount, columnNames } = computeFactorPca(sample, k);
    if (issue) {
      setPcaError(t(`factorTab.${issue.code}`, "max" in issue ? { max: issue.max } : undefined));
    }
    if (solution) {
      setResult({
        eigenvalues, columnNames, loadings: solution.loadings, nFactors: solution.nFactors,
        varianceExplained: solution.varianceBefore, usedFallback: k == null && suggestedCount === 0,
      });
    }
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
              <label htmlFor="pca-component-count" className="block text-sm font-medium mb-1">{t("factorTab.numFactorsLabel")}</label>
              <input
                id="pca-component-count"
                type="number"
                min={1}
                max={selectedCols.length}
                value={nFactors}
                onChange={(e) => {
                  const v = e.target.value;
                  setNFactors(v === "" ? "" : Number(v));
                  clearResult();
                }}
                className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-28"
                placeholder="Auto"
              />
            </div>
            <button
              type="button"
              onClick={runEFA}
              disabled={efaLoading || selectedCols.length < 2}
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
          {kmoResult && <FactorAdequacy result={kmoResult} />}
          {pcaError && <p role="alert" className="my-3 text-amber-700 dark:text-amber-400">{pcaError}</p>}
          {result && (
            <div className="space-y-4">
              {result.usedFallback && <p className="text-sm">{t("factorTab.pcaFallback")}</p>}
              {result.nFactors === 1 && <p className="text-sm">{t("factorTab.pcaNoRotation")}</p>}
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
                        <td className="p-2 font-medium">PC{i + 1}</td>
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
                  {t(result.nFactors === 1 ? "factorTab.pcaUnrotatedLoadings" : "factorTab.loadingsMatrixHeader")}
                </p>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-600">
                      <th className="text-left p-2">{t("factorTab.variableColumnHeader")}</th>
                      {Array.from({ length: result.nFactors }, (_, i) => (
                        <th key={i} className="text-right p-2">
                          PC{i + 1}
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
