import { useState, useEffect, useCallback } from "react";
import { Copy, Loader2 } from "lucide-react";
import {
  ResponsiveContainer,
  BarChart,
  CartesianGrid,
  XAxis,
  YAxis,
  Tooltip,
  Bar,
} from "recharts";
import type { Dataset } from "@/types";
import {
  numCell,
  type DescriptiveRow,
  getDataRows,
  computeDescriptive,
  computeBootstrapMeanCI,
  getCrosstab,
  computeTextStats,
  computeKeywordCounts,
  computeNgramFreq,
  computeCohensKappa,
  computeOutlierIqr,
} from "@/utils/stats";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";

export interface DescriptiveStatsViewProps {
  selectedDataset: Dataset | undefined;
  analysisBackendAvailable?: boolean;
  descriptiveBackendResult?: DescriptiveRow[] | null;
}

export function DescriptiveStatsView({
  selectedDataset,
  analysisBackendAvailable = false,
  descriptiveBackendResult = null,
}: DescriptiveStatsViewProps) {
  const [freqCol, setFreqCol] = useState("");
  const [crosstabCol1, setCrosstabCol1] = useState("");
  const [crosstabCol2, setCrosstabCol2] = useState("");
  const [crosstabBackendResult, setCrosstabBackendResult] = useState<{ rowLabels: string[]; colLabels: string[]; counts: number[][] } | null>(null);
  const rows = selectedDataset ? getDataRows(selectedDataset) : [];
  const cols = selectedDataset?.columnNames ?? [];
  useEffect(() => {
    if (!analysisBackendAvailable || !crosstabCol1 || !crosstabCol2 || !selectedDataset) {
      setCrosstabBackendResult(null);
      return;
    }
    const r = getDataRows(selectedDataset);
    quantisApi.analyzeCrosstab(r, crosstabCol1, crosstabCol2).then(setCrosstabBackendResult);
  }, [analysisBackendAvailable, crosstabCol1, crosstabCol2, selectedDataset?.id]);
  const [textStatsCol, setTextStatsCol] = useState("");
  const [textStatsResult, setTextStatsResult] = useState<{ column: string; nRows: number; nEmpty: number; totalWords: number; uniqueWords: number; avgWordsPerRow: number; minWordsPerRow: number; maxWordsPerRow: number; wordFreq: { word: string; count: number }[] } | null>(null);
  const [outlierCol, setOutlierCol] = useState("");
  const [outlierResult, setOutlierResult] = useState<{ outlierCount: number; q1: number | null; q3: number | null; iqr: number | null; lower: number | null; upper: number | null } | null>(null);
  const [keywordCountsCol, setKeywordCountsCol] = useState("");
  const [keywordCountsInput, setKeywordCountsInput] = useState("");
  const [keywordCountsResult, setKeywordCountsResult] = useState<{ column: string; keywords: string[]; counts: { keyword: string; rowCount: number; totalOccurrences: number }[] } | null>(null);
  const [ngramCol, setNgramCol] = useState("");
  const [ngramN, setNgramN] = useState(2);
  const [ngramResult, setNgramResult] = useState<{ column: string; n: number; totalNgrams: number; uniqueNgrams: number; ngramFreq: { ngram: string; count: number }[] } | null>(null);
  const [kappaCol1, setKappaCol1] = useState("");
  const [kappaCol2, setKappaCol2] = useState("");
  const [kappaResult, setKappaResult] = useState<{ col1: string; col2: string; n: number; kappa: number; observedAgreement: number; expectedAgreement: number; table: Record<string, Record<string, number>> } | null>(null);
  const [exploreLoading, setExploreLoading] = useState<string | null>(null);
  const [bootstrapCICol, setBootstrapCICol] = useState("");
  const [bootstrapCIResult, setBootstrapCIResult] = useState<{ mean: number; ciLower: number; ciUpper: number; n: number } | null>(null);

  const stats = (analysisBackendAvailable ? descriptiveBackendResult : null) ?? (rows.length >= 2 ? computeDescriptive(rows) : []);
  const numericColsDesc = stats.filter((s) => s.mean != null).map((s) => s.column);
  const categorical = stats.filter((s) => s.freq && s.freq.length > 0);
  const chartCol = categorical[0];
  const chartData = chartCol?.freq?.slice(0, 15).map((f) => ({ name: f.value, count: f.count })) || [];

  const copyDescriptiveTsv = useCallback(() => {
    if (stats.length === 0) return;
    const headers = [t("descriptiveStats.table.column"), t("descriptiveStats.table.type"), "N", "Missing", "Mean", "Median", "Std", "Q25", "Q75", "P10", "P90", "Min", "Max", "Kurtosis"];
    const na = "\u2014";
    const tsvRows = stats.map((s) => [
      s.column,
      s.type,
      String(s.n - s.missing), // N hợp lệ (không gồm ô thiếu) — cột Missing là số ô thiếu; N + Missing = tổng số dòng
      String(s.missing),
      s.mean != null ? s.mean.toFixed(4) : na,
      s.median != null ? s.median.toFixed(4) : na,
      s.std != null ? s.std.toFixed(4) : na,
      s.q25 != null ? s.q25.toFixed(4) : na,
      s.q75 != null ? s.q75.toFixed(4) : na,
      s.q10 != null ? s.q10.toFixed(4) : na,
      s.q90 != null ? s.q90.toFixed(4) : na,
      s.min != null ? s.min.toFixed(4) : na,
      s.max != null ? s.max.toFixed(4) : na,
      s.kurtosis != null ? s.kurtosis.toFixed(4) : na,
    ]);
    const tsv = [headers.join("\t"), ...tsvRows.map((r) => r.join("\t"))].join("\n");
    void navigator.clipboard.writeText(tsv);
  }, [stats]);

  const aiContextDescriptive = stats.length > 0
    ? stats.map((s) => `Cột ${s.column}: N=${s.n - s.missing}, missing=${s.missing}, mean=${s.mean != null ? s.mean.toFixed(2) : "—"}, median=${s.median != null ? s.median.toFixed(2) : "—"}, std=${s.std != null ? s.std.toFixed(2) : "—"}, min=${s.min != null ? s.min.toFixed(2) : "—"}, max=${s.max != null ? s.max.toFixed(2) : "—"}`).join("\n")
    : "";

  return (
    <div className="w-full max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-xl font-semibold">{t("descriptiveStats.title")}</h2>
        <div className="flex items-center gap-2">
          {stats.length > 0 && (
            <button type="button" onClick={copyDescriptiveTsv} className="rounded-md border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700"><Copy className="w-4 h-4" /> {t("descriptiveStats.copyTable")}</button>
          )}
          {aiContextDescriptive ? (
            <AIAssistPanel
              context={aiContextDescriptive}
              quickPrompts={[{ label: t("descriptiveStats.aiExplainLabel"), systemHint: `Bạn là chuyên gia thống kê mô tả. Giải thích ý nghĩa từng chỉ số: N (cỡ mẫu), mean (trung bình), median (trung vị), std (độ lệch chuẩn), các phân vị. Nêu cách đọc và ý nghĩa trong nghiên cứu. ${aiAnswerLangHint()}` }]}
              title={t("descriptiveStats.aiAskTitle")}
            />
          ) : null}
        </div>
      </div>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("descriptiveStats.subtitle")}</p>
      {!selectedDataset ? (
        <p className="text-neutral-500">{t("descriptiveStats.selectDatasetPrompt")}</p>
      ) : stats.length > 0 ? (
        <>
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left p-2">{t("descriptiveStats.table.column")}</th>
                  <th className="text-left p-2">{t("descriptiveStats.table.type")}</th>
                  <th className="text-right p-2">N</th>
                  <th className="text-right p-2">Missing</th>
                  <th className="text-right p-2">Mean</th>
                  <th className="text-right p-2">Median</th>
                  <th className="text-right p-2">Std</th>
                  <th className="text-right p-2">Q25</th>
                  <th className="text-right p-2">Q75</th>
                  <th className="text-right p-2">P10</th>
                  <th className="text-right p-2">P90</th>
                  <th className="text-right p-2">Min</th>
                  <th className="text-right p-2">Max</th>
                  <th className="text-right p-2">Kurtosis</th>
                </tr>
              </thead>
              <tbody>
                {stats.map((s) => (
                  <tr key={s.column} className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="p-2 font-medium">{s.column}</td>
                    <td className="p-2">{s.type}</td>
                    <td className="p-2 text-right">{s.n - s.missing}</td>
                    <td className="p-2 text-right">{s.missing}</td>
                    <td className="p-2 text-right">{s.mean != null ? s.mean.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.median != null ? s.median.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.std != null ? s.std.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.q25 != null ? s.q25.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.q75 != null ? s.q75.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.q10 != null ? s.q10.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.q90 != null ? s.q90.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.min != null ? s.min.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.max != null ? s.max.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.kurtosis != null ? s.kurtosis.toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4 mb-4">
            <p className="text-sm font-medium mb-2">{t("descriptiveStats.bootstrapTitle")}</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">{t("descriptiveStats.bootstrapDesc")}</p>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-medium mb-1">{t("descriptiveStats.numericColumnLabel")}</label>
                <select value={bootstrapCICol} onChange={(e) => { setBootstrapCICol(e.target.value); setBootstrapCIResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm">
                  <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                  {numericColsDesc.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => { if (!bootstrapCICol || rows.length < 2) return; const ci = rows[0].indexOf(bootstrapCICol); if (ci === -1) return; const vals = rows.slice(1).map((r) => numCell(r[ci])).filter((v) => !Number.isNaN(v)); const res = computeBootstrapMeanCI(vals); setBootstrapCIResult(res ?? null); }} disabled={!bootstrapCICol} className="rounded-md bg-brand text-white px-3 py-1.5 text-sm disabled:opacity-50">{t("descriptiveStats.calculateCIButton")}</button>
            </div>
            {bootstrapCIResult && (
              <div className="mt-2">
                <AIAssistPanel
                  context={`Khoảng tin cậy bootstrap 95%: trung bình = ${bootstrapCIResult.mean.toFixed(4)}, CI = [${bootstrapCIResult.ciLower.toFixed(4)}, ${bootstrapCIResult.ciUpper.toFixed(4)}], n = ${bootstrapCIResult.n}.`}
                  quickPrompts={[{ label: t("descriptiveStats.aiInterpretCILabel"), systemHint: `Bạn là chuyên gia thống kê. Giải thích ý nghĩa khoảng tin cậy 95% (bootstrap): trung bình nằm trong khoảng [ciLower, ciUpper] với độ tin cậy 95%. Nêu cách đọc và dùng trong báo cáo. ${aiAnswerLangHint()}` }]}
                  title={t("descriptiveStats.aiInterpretCITitle")}
                />
                <p className="text-sm mt-2">{t("descriptiveStats.bootstrapResultMean")} {bootstrapCIResult.mean.toFixed(4)}, 95% CI [{bootstrapCIResult.ciLower.toFixed(4)}, {bootstrapCIResult.ciUpper.toFixed(4)}], n = {bootstrapCIResult.n}</p>
              </div>
            )}
          </div>
          {chartData.length > 0 && (
            <div className="h-64 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <p className="text-sm font-medium mb-2">{t("descriptiveStats.distributionLabel")} {chartCol?.column}</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0061bb" name={t("descriptiveStats.chartCountName")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-6 space-y-4">
            <div>
              <h3 className="font-medium mb-2">{t("descriptiveStats.freqTableTitle")}</h3>
              <select value={freqCol} onChange={(e) => setFreqCol(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm mb-2">
                <option value="">{t("descriptiveStats.selectColumnPlaceholder")}</option>
                {stats.filter((s) => s.freq && s.freq.length > 0).map((s) => <option key={s.column} value={s.column}>{s.column}</option>)}
              </select>
              {freqCol && (() => {
                const s = stats.find((x) => x.column === freqCol);
                if (!s?.freq?.length) return null;
                const total = s.freq.reduce((a, f) => a + f.count, 0);
                return (
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-neutral-200 dark:border-neutral-700"><th className="text-left p-2">{t("descriptiveStats.freqTable.value")}</th><th className="text-right p-2">{t("descriptiveStats.freqTable.freq")}</th><th className="text-right p-2">%</th></tr></thead>
                      <tbody>
                        {s.freq.map((f) => (
                          <tr key={f.value} className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-2">{f.value}</td>
                            <td className="p-2 text-right">{f.count}</td>
                            <td className="p-2 text-right">{total ? (100 * f.count / total).toFixed(1) : "0"}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
            <div>
              <h3 className="font-medium mb-2">{t("descriptiveStats.crosstabTitle")}</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.rowLabel")}</label>
                  <select value={crosstabCol1} onChange={(e) => setCrosstabCol1(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.columnLabel")}</label>
                  <select value={crosstabCol2} onChange={(e) => setCrosstabCol2(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {crosstabCol1 && crosstabCol2 && (() => {
                const ct = (analysisBackendAvailable ? crosstabBackendResult : null) ?? getCrosstab(rows, crosstabCol1, crosstabCol2);
                if (!ct) return null;
                const crosstabCtx = `Bảng chéo: hàng ${crosstabCol1}, cột ${crosstabCol2}. Hàng: ${ct.rowLabels.join(", ")}. Cột: ${ct.colLabels.join(", ")}. Số ô: ${ct.rowLabels.length * ct.colLabels.length}. Tổng quan: ${ct.rowLabels.slice(0, 3).map((r, i) => `${r}: ${ct.counts[i]?.join(", ")}`).join("; ")}.`;
                return (
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto">
                    <AIAssistPanel
                      context={crosstabCtx}
                      quickPrompts={[{ label: t("descriptiveStats.aiInterpretCrosstabLabel"), systemHint: `Bạn là chuyên gia thống kê. Giải thích ý nghĩa bảng chéo (crosstab): tần số chéo của hai biến phân loại, mối liên hệ giữa hai biến. Gợi ý khi nào dùng kiểm định Chi-square. ${aiAnswerLangHint()}` }]}
                      title={t("descriptiveStats.aiInterpretCrosstabTitle")}
                    />
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="text-left p-2 font-medium"></th>
                          {ct.colLabels.map((c) => <th key={c} className="p-2 text-right font-medium">{c}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {ct.rowLabels.map((r, i) => (
                          <tr key={r} className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-2 font-medium">{r}</td>
                            {ct.counts[i].map((v, j) => <td key={j} className="p-2 text-right">{v}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
            <div>
              <h3 className="font-medium mb-2">{t("descriptiveStats.textStatsTitle")}</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.textColumnLabel")}</label>
                  <select value={textStatsCol} onChange={(e) => { setTextStatsCol(e.target.value); setTextStatsResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={exploreLoading !== null}
                  onClick={async () => {
                    if (!textStatsCol) return;
                    if (analysisBackendAvailable) {
                      setExploreLoading("textstats");
                      try {
                        const res = await quantisApi.analyzeTextStats(rows, textStatsCol);
                        setTextStatsResult(res ?? null);
                      } finally {
                        setExploreLoading(null);
                      }
                      return;
                    }
                    const res = computeTextStats(rows, textStatsCol);
                    setTextStatsResult(res ?? null);
                  }}
                  className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {exploreLoading === "textstats" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("descriptiveStats.processingLabel")}</> : t("descriptiveStats.analyzeButton")}
                </button>
              </div>
              {textStatsResult && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm space-y-2">
                  <AIAssistPanel
                    context={`Thống kê văn bản cột "${textStatsResult.column}": ${textStatsResult.totalWords} từ, ${textStatsResult.uniqueWords} từ khác nhau, TB ${textStatsResult.avgWordsPerRow.toFixed(1)} từ/dòng. Dòng: ${textStatsResult.nRows}, trống: ${textStatsResult.nEmpty}. Top từ: ${textStatsResult.wordFreq.slice(0, 10).map((w) => `${w.word}(${w.count})`).join(", ")}.`}
                    quickPrompts={[{ label: t("descriptiveStats.aiInterpretTextStatsLabel"), systemHint: `Bạn là chuyên gia phân tích định tính. Giải thích ý nghĩa: tổng số từ, số từ khác nhau, tần số từ — dùng trong nghiên cứu định tính/ngôn ngữ như thế nào. ${aiAnswerLangHint()}` }]}
                    title={t("descriptiveStats.aiInterpretTextStatsTitle")}
                  />
                  <p><strong>{t("descriptiveStats.textStats.totalWordsLabel")}</strong> {textStatsResult.totalWords} | <strong>{t("descriptiveStats.textStats.uniqueWordsLabel")}</strong> {textStatsResult.uniqueWords} | <strong>{t("descriptiveStats.textStats.avgWordsLabel")}</strong> {textStatsResult.avgWordsPerRow.toFixed(1)} (min–max: {textStatsResult.minWordsPerRow}–{textStatsResult.maxWordsPerRow})</p>
                  <p><strong>{t("descriptiveStats.textStats.rowsLabel")}</strong> {textStatsResult.nRows} | <strong>{t("descriptiveStats.textStats.emptyRowsLabel")}</strong> {textStatsResult.nEmpty}</p>
                  <p className="font-medium mt-2">{t("descriptiveStats.textStats.topWordsTitle")}</p>
                  <table className="w-full text-xs"><thead><tr className="border-b border-neutral-200 dark:border-neutral-600"><th className="text-left p-1">{t("descriptiveStats.textStats.wordHeader")}</th><th className="text-right p-1">{t("descriptiveStats.textStats.countHeader")}</th></tr></thead><tbody>
                    {textStatsResult.wordFreq.slice(0, 30).map(({ word, count }) => (
                      <tr key={word} className="border-b border-neutral-100 dark:border-neutral-700/50"><td className="p-1">{word}</td><td className="p-1 text-right">{count}</td></tr>
                    ))}</tbody></table>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">{t("descriptiveStats.keywordCountTitle")}</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.textColumnLabel")}</label>
                  <select value={keywordCountsCol} onChange={(e) => { setKeywordCountsCol(e.target.value); setKeywordCountsResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm mb-1">{t("descriptiveStats.keywordInputLabel")}</label>
                  <textarea value={keywordCountsInput} onChange={(e) => { setKeywordCountsInput(e.target.value); setKeywordCountsResult(null); }} placeholder={t("descriptiveStats.keywordInputPlaceholder")} className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm min-h-[80px]" rows={3} />
                </div>
                <button
                  type="button"
                  disabled={exploreLoading !== null}
                  onClick={async () => {
                    if (!keywordCountsCol || !keywordCountsInput.trim()) return;
                    const raw = keywordCountsInput.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
                    if (!raw.length) return;
                    if (analysisBackendAvailable) {
                      setExploreLoading("keyword");
                      try {
                        const res = await quantisApi.analyzeKeywordCounts(rows, keywordCountsCol, raw);
                        setKeywordCountsResult(res ?? null);
                      } finally {
                        setExploreLoading(null);
                      }
                      return;
                    }
                    const res = computeKeywordCounts(rows, keywordCountsCol, raw);
                    setKeywordCountsResult(res ?? null);
                  }}
                  className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {exploreLoading === "keyword" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("descriptiveStats.processingLabel")}</> : t("descriptiveStats.countButton")}
                </button>
              </div>
              {keywordCountsResult && keywordCountsResult.counts.length > 0 && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm">
                  <AIAssistPanel
                    context={`Đếm từ khóa cột "${keywordCountsResult.column}": ${keywordCountsResult.counts.map((c) => `${c.keyword}: ${c.rowCount} dòng, ${c.totalOccurrences} lần`).join("; ")}.`}
                    quickPrompts={[{ label: t("descriptiveStats.aiInterpretKeywordLabel"), systemHint: `Bạn là chuyên gia phân tích định tính. Giải thích ý nghĩa đếm từ khóa: số dòng chứa từ khóa, tổng lần xuất hiện — dùng để đo mức độ xuất hiện chủ đề trong dữ liệu văn bản. ${aiAnswerLangHint()}` }]}
                    title={t("descriptiveStats.aiInterpretKeywordTitle")}
                  />
                  <p className="font-medium mb-2">{t("descriptiveStats.keywordResult.columnLabel")} {keywordCountsResult.column}</p>
                  <table className="w-full text-xs"><thead><tr className="border-b border-neutral-200 dark:border-neutral-600"><th className="text-left p-1">{t("descriptiveStats.keywordResult.keywordHeader")}</th><th className="text-right p-1">{t("descriptiveStats.keywordResult.rowCountHeader")}</th><th className="text-right p-1">{t("descriptiveStats.keywordResult.totalOccurHeader")}</th></tr></thead><tbody>
                    {keywordCountsResult.counts.map(({ keyword, rowCount, totalOccurrences }) => (
                      <tr key={keyword} className="border-b border-neutral-100 dark:border-neutral-700/50"><td className="p-1">{keyword}</td><td className="p-1 text-right">{rowCount}</td><td className="p-1 text-right">{totalOccurrences}</td></tr>
                    ))}</tbody></table>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">{t("descriptiveStats.ngramTitle")}</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.textColumnLabel")}</label>
                  <select value={ngramCol} onChange={(e) => { setNgramCol(e.target.value); setNgramResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.ngramNLabel")}</label>
                  <select value={ngramN} onChange={(e) => { setNgramN(Number(e.target.value)); setNgramResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value={2}>{t("descriptiveStats.ngramBigramOption")}</option>
                    <option value={3}>{t("descriptiveStats.ngramTrigramOption")}</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={exploreLoading !== null}
                  onClick={async () => {
                    if (!ngramCol) return;
                    if (analysisBackendAvailable) {
                      setExploreLoading("ngram");
                      try {
                        const res = await quantisApi.analyzeNgramFreq(rows, ngramCol, ngramN, 50);
                        setNgramResult(res ?? null);
                      } finally {
                        setExploreLoading(null);
                      }
                      return;
                    }
                    setNgramResult(computeNgramFreq(rows, ngramCol, ngramN, 50) ?? null);
                  }}
                  className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {exploreLoading === "ngram" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("descriptiveStats.processingLabel")}</> : t("descriptiveStats.analyzeButton")}
                </button>
              </div>
              {ngramResult && ngramResult.ngramFreq.length > 0 && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm">
                  <AIAssistPanel
                    context={`N-gram (n=${ngramResult.n}) cột "${ngramResult.column}": tổng ${ngramResult.totalNgrams} cụm, ${ngramResult.uniqueNgrams} khác nhau. Top: ${ngramResult.ngramFreq.slice(0, 8).map((x) => `${x.ngram}(${x.count})`).join(", ")}.`}
                    quickPrompts={[{ label: t("descriptiveStats.aiInterpretNgramLabel"), systemHint: `Bạn là chuyên gia phân tích văn bản. Giải thích ý nghĩa n-gram (bigram/trigram): tần số cụm từ phản ánh cụm từ hay đi cùng nhau trong dữ liệu, dùng trong nghiên cứu định tính. ${aiAnswerLangHint()}` }]}
                    title={t("descriptiveStats.aiInterpretNgramTitle")}
                  />
                  <p className="font-medium mb-2">{`${t("descriptiveStats.ngramResult.columnPrefix")} ${ngramResult.column} ${t("descriptiveStats.ngramResult.nPrefix")} ${ngramResult.n} ${t("descriptiveStats.ngramResult.totalPrefix")} ${ngramResult.totalNgrams} ${t("descriptiveStats.ngramResult.uniquePrefix")} ${ngramResult.uniqueNgrams}`}</p>
                  <table className="w-full text-xs"><thead><tr className="border-b border-neutral-200 dark:border-neutral-600"><th className="text-left p-1">{t("descriptiveStats.ngramResult.phraseHeader")}</th><th className="text-right p-1">{t("descriptiveStats.textStats.countHeader")}</th></tr></thead><tbody>
                    {ngramResult.ngramFreq.slice(0, 30).map(({ ngram, count }) => (
                      <tr key={ngram} className="border-b border-neutral-100 dark:border-neutral-700/50"><td className="p-1">{ngram}</td><td className="p-1 text-right">{count}</td></tr>
                    ))}</tbody></table>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">Cohen&apos;s Kappa</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.coder1Label")}</label>
                  <select value={kappaCol1} onChange={(e) => { setKappaCol1(e.target.value); setKappaResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.coder2Label")}</label>
                  <select value={kappaCol2} onChange={(e) => { setKappaCol2(e.target.value); setKappaResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={exploreLoading !== null}
                  onClick={async () => {
                    if (!kappaCol1 || !kappaCol2) return;
                    if (analysisBackendAvailable) {
                      setExploreLoading("kappa");
                      try {
                        const res = await quantisApi.analyzeCohensKappa(rows, kappaCol1, kappaCol2);
                        setKappaResult(res ?? null);
                      } finally {
                        setExploreLoading(null);
                      }
                      return;
                    }
                    setKappaResult(computeCohensKappa(rows, kappaCol1, kappaCol2) ?? null);
                  }}
                  className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {exploreLoading === "kappa" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("descriptiveStats.processingLabel")}</> : t("descriptiveStats.calculateKappaButton")}
                </button>
              </div>
              {kappaResult && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm space-y-2">
                  <AIAssistPanel
                    context={`Cohen's Kappa: ${kappaResult.col1} và ${kappaResult.col2}, κ = ${kappaResult.kappa.toFixed(4)}, n = ${kappaResult.n}.`}
                    quickPrompts={[{ label: t("descriptiveStats.aiInterpretKappaLabel"), systemHint: `Bạn là chuyên gia thống kê. Giải thích Cohen's Kappa: đo độ đồng nhất/đồng thuận giữa hai người mã hóa (coder). Nêu thang diễn giải (ví dụ <0 kém, 0.21–0.40 khá, 0.61–0.80 tốt, >0.81 rất tốt). ${aiAnswerLangHint()}` }]}
                    title={t("descriptiveStats.aiInterpretKappaTitle")}
                  />
                  <p><strong>κ = {kappaResult.kappa}</strong>{` ${t("descriptiveStats.kappaResult.observedAgreementPrefix")} ${kappaResult.observedAgreement}${t("descriptiveStats.kappaResult.expectedAgreementPrefix")} ${kappaResult.expectedAgreement} · n = ${kappaResult.n}`}</p>
                  <p className="text-neutral-600 dark:text-neutral-400 text-xs">{t("descriptiveStats.kappaResult.legend")}</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">{t("descriptiveStats.outlierTitle")}</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.numericColumnLabel")}</label>
                  <select value={outlierCol} onChange={(e) => { setOutlierCol(e.target.value); setOutlierResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {stats.filter((s) => s.type === "numeric").map((s) => (
                      <option key={s.column} value={s.column}>{s.column}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={exploreLoading !== null}
                  onClick={async () => {
                    if (!outlierCol) return;
                    const ci = cols.indexOf(outlierCol);
                    if (ci === -1) return;
                    const values = rows.slice(1).map((r) => numCell(r[ci])).filter((v) => !Number.isNaN(v));
                    if (analysisBackendAvailable) {
                      setExploreLoading("outlier");
                      try {
                        const res = await quantisApi.analyzeOutlierIqr(values);
                        setOutlierResult(res ?? null);
                      } finally {
                        setExploreLoading(null);
                      }
                      return;
                    }
                    setOutlierResult(computeOutlierIqr(values));
                  }}
                  className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {exploreLoading === "outlier" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("descriptiveStats.processingLabel")}</> : t("descriptiveStats.checkButton")}
                </button>
              </div>
              {outlierResult && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm">
                  <AIAssistPanel
                    context={`điểm ngoại lai IQR: cột số, số điểm = ${outlierResult.outlierCount}. Q1 = ${outlierResult.q1 ?? "?"}, Q3 = ${outlierResult.q3 ?? "?"}, IQR = ${outlierResult.iqr ?? "?"}, ngưỡng [${outlierResult.lower ?? "?"}, ${outlierResult.upper ?? "?"}].`}
                    quickPrompts={[{ label: t("descriptiveStats.aiInterpretOutlierLabel"), systemHint: `Bạn là chuyên gia thống kê. Giải thích điểm ngoại lai theo phương pháp IQR (1.5×IQR): ý nghĩa số điểm, Q1/Q3/ngưỡng. Gợi ý khi nào nên loại bỏ hay giữ lại (kiểm tra lỗi đo, ảnh hưởng phân tích). ${aiAnswerLangHint()}` }]}
                    title={t("descriptiveStats.aiInterpretOutlierTitle")}
                  />
                  <p><strong>{t("descriptiveStats.outlierResult.countLabel")}</strong> {outlierResult.outlierCount}</p>
                  {outlierResult.q1 != null && outlierResult.q3 != null && outlierResult.iqr != null && (
                    <p className="mt-1 text-neutral-600 dark:text-neutral-400">Q1 = {outlierResult.q1.toFixed(2)}, Q3 = {outlierResult.q3.toFixed(2)}, IQR = {outlierResult.iqr.toFixed(2)}. {t("descriptiveStats.outlierResult.thresholdLabel")} [{outlierResult.lower != null ? outlierResult.lower.toFixed(2) : "—"}, {outlierResult.upper != null ? outlierResult.upper.toFixed(2) : "—"}].</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-neutral-500">{t("descriptiveStats.notEnoughData")}</p>
      )}
    </div>
  );
}
