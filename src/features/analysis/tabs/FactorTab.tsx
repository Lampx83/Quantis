import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Dataset } from "@/types";
import { getAnalysisRows, numCell, type KMOBartlettResult } from "@/utils/stats";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";
import { InfoHint, GlossaryBar } from "@/components/common/InfoHint";
import { activeFactorRun, finishFactorRun, runFactorAnalysis, startFactorRun, type FactorMethod, type FactorRunInput } from "../factor/runFactorAnalysis";
import { ScreePlot } from "../factor/ScreePlot";

export interface FactorTabProps {
  selectedDataset: Dataset;
  analysisBackendAvailable?: boolean;
  showToast?: (msg: string) => void;
}

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
  const { id: datasetId, columnNames, variables } = selectedDataset;
  const numericCols = useMemo(() => {
    if (rows.length < 2) return [];
    const records = rows.slice(1);
    return (columnNames ?? []).filter((c) => {
      const ci = rows[0].indexOf(c);
      return ci >= 0 && (variables?.[c]?.type === "numeric" ||
        records.every((r) => !String(r[ci] ?? "").trim() || !Number.isNaN(numCell(r[ci]))));
    });
  }, [rows, columnNames, variables]);
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [method, setMethod] = useState<FactorMethod>("pca");
  const [count, setCount] = useState<number>();
  const [run, setRun] = useState<ReturnType<typeof startFactorRun> | null>(null);
  const input = useMemo<FactorRunInput>(() => ({
    datasetId, rows, columns: selectedCols.filter((name) => numericCols.includes(name)), method, count,
    backendAvailable: analysisBackendAvailable,
  }), [datasetId, rows, selectedCols, numericCols, method, count, analysisBackendAvailable]);
  const activeRun = activeFactorRun(run, input);
  const kmoResult = activeRun?.adequacy;
  const outcome = activeRun?.outcome;
  const result = outcome?.solution;
  const processing = activeRun != null && outcome == null;
  const paf = method === "paf";
  const issue = outcome?.issue;
  const columnPrefix = paf ? "F" : "PC";

  const runAnalysis = async () => {
    const next = startFactorRun(input);
    setRun(next);
    const outcome = await runFactorAnalysis(next.request);
    setRun((current) => finishFactorRun(current, next.request, outcome));
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
          context={t(paf ? "factorTab.pafContext" : "factorTab.pcaContext")}
          quickPrompts={[
            {
              label: t("factorTab.aiPromptSuggestFactorsLabel"),
              systemHint: `${t(paf ? "factorTab.pafContext" : "factorTab.pcaContext")} ${aiAnswerLangHint()}`,
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
                  checked={input.columns.includes(c)}
                  onChange={() => setSelectedCols(input.columns.includes(c) ? input.columns.filter((name) => name !== c) : [...input.columns, c])}
                  className="rounded"
                />
                <span className="text-sm">{c}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label htmlFor="factor-method" className="block text-sm font-medium mb-1">{t("factorTab.methodLabel")}</label>
              <select
                id="factor-method"
                value={method}
                onChange={(e) => setMethod(e.target.value === "paf" ? "paf" : "pca")}
                className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2"
              >
                <option value="pca">{t("factorTab.pcaMethod")}</option>
                <option value="paf">{t("factorTab.pafMethod")}</option>
              </select>
            </div>
            <div>
              <label htmlFor="factor-count" className="block text-sm font-medium mb-1">{t(paf ? "factorTab.pafCountLabel" : "factorTab.numFactorsLabel")}</label>
              <input
                id="factor-count"
                type="number"
                min={1}
                max={Math.max(1, input.columns.length - (paf ? 1 : 0))}
                value={count ?? ""}
                placeholder={t("factorTab.automatic")}
                onChange={(e) => setCount(e.target.value === "" ? undefined : e.target.valueAsNumber)}
                className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-28"
              />
            </div>
            <button
              type="button"
              onClick={runAnalysis}
              disabled={processing || input.columns.length < 2}
              className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {processing ? (
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
          {paf && !analysisBackendAvailable && (
            <p className="my-3 text-amber-700 dark:text-amber-400">{t("factorTab.pafBackendRequired")}</p>
          )}
          {issue && issue.code !== kmoResult?.issue?.code && issue.code !== "pafBackendRequired" && (
            <p role="alert" className="my-3 text-amber-700 dark:text-amber-400">
              {t(issue.code === "pafSuggestionOutOfRange" && issue.max === 0 ? "factorTab.pafNoUsableRoots" : `factorTab.${issue.code}`, {
                max: issue.max ?? "—", items: issue.columns?.join(", ") ?? "—",
              })}
            </p>
          )}
          {outcome?.parallelIssue && (
            <p role="status" className="my-3 text-amber-700 dark:text-amber-400">
              {t(`factorTab.${outcome.parallelIssue.code}`, {
                maxRows: outcome.parallelIssue.maxRows ?? "—", maxItems: outcome.parallelIssue.maxItems ?? "—",
              })}
            </p>
          )}
          {outcome && (
            <ScreePlot method={method} eigenvalues={outcome.eigenvalues} parallelCutoff={outcome.parallelCutoff}
              suggestedCount={outcome.suggestedCount} usedCount={result?.nFactors ?? null} />
          )}
          {result && outcome && (
            <div className="space-y-4">
              {!paf && count == null && outcome.suggestedCount === 0 && <p className="text-sm">{t("factorTab.pcaFallback")}</p>}
              {result.rotation === "none" && <p className="text-sm">{t(paf ? "factorTab.pafNoRotation" : "factorTab.pcaNoRotation")}</p>}
              <AIAssistPanel
                context={`${method.toUpperCase()}, ${result.nFactors}, ${result.rotation}. Variance before rotation: ${
                  result.varianceBefore.map((v) => v.toFixed(1) + "%").join(", ")
                }. Loadings: ${input.columns.map((name, i) => `${name} ${result.loadings[i].map((v) => v.toFixed(3)).join(", ")}`).join(" | ")}.${
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
                    systemHint: `${t(paf ? "factorTab.pafContext" : "factorTab.pcaContext")} ${aiAnswerLangHint()}`,
                  },
                ]}
                title={t("factorTab.askAiTitle")}
              />
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
                <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">
                  {t(paf ? "factorTab.pafVarianceHeader" : "factorTab.eigenvaluesHeader")}
                </p>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-600">
                      <th className="text-left p-2">{t(paf ? "factorTab.pafColumnHeader" : "factorTab.factorColumnHeader")}</th>
                      {!paf && <th className="text-right p-2">Eigenvalue</th>}
                      <th className="text-right p-2">{t("factorTab.varianceExplainedHeader")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {result.varianceBefore.map((variance, i) => (
                      <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/50">
                        <td className="p-2 font-medium">{columnPrefix}{i + 1}</td>
                        {!paf && <td className="p-2 text-right">{outcome.eigenvalues[i].toFixed(3)}</td>}
                        <td className="p-2 text-right">{variance.toFixed(1)}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
                <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">
                  {paf
                    ? t(result.rotation === "none" ? "factorTab.pafUnrotatedLoadings" : "factorTab.pafLoadingsHeader")
                    : t(result.rotation === "none" ? "factorTab.pcaUnrotatedLoadings" : "factorTab.loadingsMatrixHeader")}
                </p>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-600">
                      <th className="text-left p-2">{t("factorTab.variableColumnHeader")}</th>
                      {Array.from({ length: result.nFactors }, (_, i) => (
                        <th key={i} className="text-right p-2">
                          {columnPrefix}{i + 1}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {input.columns.map((name, i) => (
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
