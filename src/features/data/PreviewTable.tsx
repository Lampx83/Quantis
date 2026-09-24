import { useState, useMemo } from "react";
import type { Dataset } from "@/types";
import { getDataRows } from "@/utils/stats";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";

export const PREVIEW_PAGE_SIZE_DEFAULT = 100;
export const PREVIEW_PAGE_SIZES = [20, 50, 100, 200] as const;

export interface PreviewTableProps {
  selectedDs: Dataset;
}

export function PreviewTable({ selectedDs }: PreviewTableProps) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PREVIEW_PAGE_SIZE_DEFAULT);
  const [sortColIndex, setSortColIndex] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = getDataRows(selectedDs);
  const headers = rows[0] || [];
  const dataRows = rows.slice(1);

  const sortedRows =
    sortColIndex == null
      ? dataRows
      : [...dataRows].sort((a, b) => {
          const av = a[sortColIndex] ?? "";
          const bv = b[sortColIndex] ?? "";
          const isNum =
            dataRows.length > 0 &&
            dataRows.every((r) => {
              const v = r[sortColIndex];
              return v === "" || !Number.isNaN(Number(v));
            });
          let cmp = 0;
          if (isNum) {
            const an = Number(av);
            const bn = Number(bv);
            cmp =
              (Number.isNaN(an) ? -Infinity : an) -
              (Number.isNaN(bn) ? -Infinity : bn);
          } else {
            cmp = String(av).localeCompare(String(bv));
          }
          return sortDir === "asc" ? cmp : -cmp;
        });

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const start = (page - 1) * pageSize;
  const slice = sortedRows.slice(start, start + pageSize);

  const handleSort = (colIndex: number) => {
    if (sortColIndex === colIndex) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortColIndex(colIndex);
      setSortDir("asc");
    }
    setPage(1);
  };

  const aiContext = useMemo(() => {
    if (!selectedDs) return "";
    const colNames = headers.length > 0 ? headers : (selectedDs.columnNames || []);
    if (colNames.length === 0 && dataRows.length === 0) return "";
    const sample = dataRows.slice(0, 5).map((r) => colNames.map((h, i) => `${h}: ${r[i] ?? ""}`).join(" | ")).join("\n");
    return `Bộ dữ liệu: ${selectedDs.name}. Số hàng: ${dataRows.length}, số cột: ${colNames.length}. Tên cột: ${colNames.join(", ")}.\nMẫu 5 hàng đầu:\n${sample}`;
  }, [selectedDs, headers, dataRows]);

  return (
    <div className="w-full max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-xl font-semibold">{t("previewTable.title")}</h2>
        {aiContext ? (
          <AIAssistPanel
            context={aiContext}
            quickPrompts={[{ label: t("previewTable.aiExplainLabel"), systemHint: `Bạn là chuyên gia phân tích dữ liệu. Tóm tắt bộ dữ liệu: tên, số hàng/số cột, tên các biến, và mẫu vài hàng đầu. Nêu ý nghĩa tổng quan để người dùng nắm nhanh nội dung dataset. ${aiAnswerLangHint()}` }]}
            title={t("previewTable.aiAskTitle")}
          />
        ) : null}
      </div>
      <p className="text-neutral-600 dark:text-neutral-400 mb-2">
        {`${dataRows.length} ${t("previewTable.rowsUnit")} × ${headers.length} ${t("previewTable.colsUnit")}.`}
      </p>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800 z-10">
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              {headers.map((h, ci) => (
                <th key={ci} className="text-left p-2">
                  <button
                    type="button"
                    onClick={() => handleSort(ci)}
                    className="w-full text-left font-medium whitespace-nowrap hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded px-2 py-1.5 flex items-center gap-1 -mx-2 -my-1.5"
                    title={t("previewTable.sortTooltip")}
                  >
                    {h}
                    {sortColIndex === ci && (
                      <span className="text-brand" aria-label={sortDir === "asc" ? t("previewTable.sortAscLabel") : t("previewTable.sortDescLabel")}>{sortDir === "asc" ? " ↑" : " ↓"}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, ri) => (
              <tr key={start + ri} className="border-b border-neutral-100 dark:border-neutral-700/50">
                {headers.map((_, ci) => (
                  <td key={ci} className="p-2 whitespace-nowrap">{r[ci] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-4 px-2 py-2 border border-t-0 border-neutral-200 dark:border-neutral-700 rounded-b-lg bg-neutral-50 dark:bg-neutral-800/80 text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">
          {`${t("previewTable.showingPrefix")} ${sortedRows.length === 0 ? "0" : start + 1}–${Math.min(start + pageSize, sortedRows.length)} / ${sortedRows.length} ${t("previewTable.recordsUnit")}`}
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
            {t("previewTable.rowsPerPageLabel")}
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1 text-sm">
              {PREVIEW_PAGE_SIZES.map((n) => <option key={n} value={n}>{n} {t("previewTable.rowsOptionSuffix")}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2">
            <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50">‹ {t("previewTable.prevButton")}</button>
            <span className="min-w-[5rem] text-center tabular-nums">{`${t("previewTable.pagePrefix")} ${page} / ${totalPages}`}</span>
            <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50">{t("previewTable.nextButton")} ›</button>
          </div>
        </div>
      </div>
    </div>
  );
}
