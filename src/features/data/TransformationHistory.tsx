import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import type { Dataset, DatasetChange, TransformOperation } from "@/types";
import { t, useLocale } from "@/i18n";
import { transformActionLabel } from "./TransformTab";

const VISIBLE_VARIABLES = 4;
const dotClass = {
  delete: "bg-red-600 dark:bg-red-400",
  removeRows: "bg-amber-700 dark:bg-amber-400",
  transform: "bg-blue-600 dark:bg-blue-400",
  impute: "bg-violet-600 dark:bg-violet-400",
  create: "bg-emerald-600 dark:bg-emerald-400",
  edit: "bg-slate-500 dark:bg-slate-400",
};
type HistoryTone = keyof typeof dotClass;

const actionTone: Record<DatasetChange["action"], HistoryTone> = {
  cell: "edit",
  paste: "edit",
  metadata: "edit",
  renameColumn: "edit",
  insertRow: "create",
  insertColumn: "create",
  extractImputation: "create",
  deleteRow: "delete",
  deleteColumn: "delete",
  transform: "transform",
};

const operationTone: Record<TransformOperation, HistoryTone> = {
  drop_missing: "removeRows",
  filter: "removeRows",
  outlier_iqr: "removeRows",
  dedupe: "removeRows",
  fill_mean: "impute",
  fill_median: "impute",
  fill_mode: "impute",
  fill_hot_deck: "impute",
  fill_mice: "impute",
  z_score: "transform",
  min_max: "transform",
  log: "transform",
  sort: "transform",
  recode: "transform",
  coerce_numeric: "transform",
  coerce_text: "transform",
  compute: "create",
  rename: "edit",
};

function historyDotClass({ kind, action, operation }: DatasetChange): string {
  if (kind === "undo") return dotClass.edit;
  const tone = (operation && operationTone[operation]) ?? actionTone[action] ?? "edit";
  return dotClass[kind === "derive" && tone === "removeRows" ? "transform" : tone];
}

function formatTimestamp(timestamp: string, formatter: Intl.DateTimeFormat): string {
  const date = new Date(timestamp);
  return Number.isNaN(date.getTime()) ? timestamp : formatter.format(date);
}

export function TransformationHistory({ dataset, onClose }: { dataset: Dataset; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale);
  const clock = new Intl.DateTimeFormat(locale, { timeStyle: "short" });
  const date = new Intl.DateTimeFormat(locale, { dateStyle: "medium" });
  const entries = dataset.audit?.entries ?? [];
  const cutoff = dataset.audit?.cutoffAt;
  const count = { n: number.format(entries.length) };
  const plural = entries.length === 1 ? "one" : "many";

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  return (
    <dialog ref={ref} aria-labelledby={titleId} aria-describedby={`${titleId}-dataset`} onCancel={onClose}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-md overflow-hidden rounded-xl border border-slate-200 bg-white text-slate-900 shadow-2xl backdrop:bg-slate-950/45 dark:border-slate-700 dark:bg-slate-900 dark:text-slate-100">
      <div className="flex max-h-[min(84dvh,34rem)] flex-col">
        <header className="shrink-0 border-b border-slate-200 px-4 py-3 dark:border-slate-800">
          <div className="flex items-center justify-between gap-2">
            <h2 id={titleId} className="text-base font-semibold">{t("datasetHistory.open")}</h2>
            <button type="button" aria-label={t("datasetHistory.close")}
              className="-mr-1 grid size-8 shrink-0 place-items-center rounded-md text-slate-500 hover:bg-slate-100 hover:text-slate-900 focus-visible:outline-2 focus-visible:outline-brand dark:text-slate-400 dark:hover:bg-slate-800 dark:hover:text-white"
              onClick={() => { ref.current?.close(); onClose(); }}>
              <X className="size-4" />
            </button>
          </div>
          <div className="mt-1 flex items-center gap-2">
            <span id={`${titleId}-dataset`} title={dataset.name} className="min-w-0 truncate rounded-md border border-slate-200 bg-slate-50 px-2 py-0.5 font-mono text-xs text-slate-700 dark:border-slate-700 dark:bg-slate-950 dark:text-slate-300">{dataset.name}</span>
            <span className="shrink-0 text-xs text-slate-500 dark:text-slate-400">
              {t(dataset.rows === 1 ? "datasetHistory.oneRow" : "datasetHistory.rows", { n: number.format(dataset.rows) })}
            </span>
          </div>
        </header>

        <div className="min-h-0 overflow-y-auto overscroll-contain [scrollbar-width:thin] dark:[color-scheme:dark]">
          {cutoff && <p className="border-b border-amber-100 bg-amber-50 px-4 py-2 text-xs text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/50 dark:text-amber-200">
            {t("datasetHistory.cutoff", { time: formatTimestamp(cutoff, new Intl.DateTimeFormat(locale, { dateStyle: "medium", timeStyle: "short" })) })}
          </p>}
          {entries.length === 0 ? (
            <p className="px-4 py-6 text-sm text-slate-500 dark:text-slate-400">{t("datasetHistory.empty")}</p>
          ) : (
            <ol reversed className="divide-y divide-slate-100 dark:divide-slate-800">
              {[...entries].reverse().map((change) => {
                const { action, operation, columns = [], formula, firstRow, lastRow, rowCount, cellCount, timestamp } = change;
                const showRowCount = rowCount !== undefined && rowCount > 0 &&
                  operation !== undefined && operationTone[operation] === "removeRows";
                const showCellCount = action === "paste" && cellCount !== undefined && cellCount > 1;
                const computed = operation === "compute" && columns[0] && formula;
                const label = computed ? t("datasetHistory.computed") : operation ? transformActionLabel(operation) : t(`datasetHistory.action.${action}`);
                const shown = columns.slice(0, VISIBLE_VARIABLES);
                const overflow = (change.columnCount ?? columns.length) - shown.length;
                const overflowTitle = [columns.slice(VISIBLE_VARIABLES).join(", "),
                  (change.columnCount ?? 0) > columns.length ? t("datasetHistory.unlistedVariables") : "",
                ].filter(Boolean).join("\n");
                return (
                  <li key={change.id} className="grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3 px-4 py-2">
                    <div className="flex min-w-0 items-start gap-2.5">
                      <span aria-hidden="true" className={`mt-1.5 size-2 shrink-0 rounded-full ${historyDotClass(change)}`} />
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
                          <span className={`break-words text-sm font-semibold leading-5 ${locale === "en" ? "capitalize" : ""}`}>{label}</span>
                          {(change.kind === "undo" || change.kind === "redo") && (
                            <span className="rounded bg-slate-100 px-1.5 py-0.5 text-xs leading-none text-slate-600 dark:bg-slate-800 dark:text-slate-300">{t(`datasetHistory.${change.kind}`)}</span>
                          )}
                        </div>
                        {(shown.length > 0 || overflow > 0) && (
                          <div className="mt-1 flex flex-wrap items-center gap-1">
                            {shown.map((column, index) => (
                              <span key={index} className="inline-flex min-w-0 max-w-full items-center gap-1">
                                {index === 1 && (action === "renameColumn" || operation === "rename") && <span className="text-xs text-slate-500 dark:text-slate-400">→</span>}
                                <code title={column} className="min-w-0 truncate rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-[11px] leading-4 text-slate-700 dark:border-slate-800 dark:bg-slate-950 dark:text-slate-300">{column}</code>
                              </span>
                            ))}
                            {overflow > 0 && <span title={overflowTitle} className="rounded-full border border-slate-200 px-1.5 py-0.5 text-[11px] leading-4 text-slate-600 dark:border-slate-700 dark:text-slate-300">
                              {t("datasetHistory.moreVariables", { n: number.format(overflow) })}
                            </span>}
                          </div>
                        )}
                        {computed && <code className="mt-1 block break-words font-mono text-xs text-slate-500 dark:text-slate-400">{columns[0]} = {formula}</code>}
                        {(firstRow !== undefined || showRowCount || showCellCount || change.kind === "derive") && (
                          <div className="mt-1 flex flex-wrap gap-x-2 text-xs text-slate-500 dark:text-slate-400">
                            {firstRow !== undefined && <span>{lastRow !== undefined && lastRow !== firstRow
                              ? t("datasetHistory.rowRange", { first: number.format(firstRow), last: number.format(lastRow) })
                              : t("datasetHistory.row", { n: number.format(firstRow) })}</span>}
                            {showRowCount && <span>{t(rowCount === 1 ? "datasetHistory.oneRowAffected" : "datasetHistory.rowsAffected", { n: number.format(rowCount) })}</span>}
                            {showCellCount && <span>{t("datasetHistory.cells", { n: number.format(cellCount) })}</span>}
                            {change.kind === "derive" && <>
                              <span className="break-all" title={change.source.datasetId}>{t("datasetHistory.source", { name: change.source.name })}</span>
                              {change.source.member !== undefined && <span>{change.source.member === 0 ? t("dataGrid.bundleOriginal") :
                                t("datasetHistory.member", { n: number.format(change.source.member) })}</span>}
                            </>}
                          </div>
                        )}
                      </div>
                    </div>
                    <time className="max-w-24 break-all text-right font-mono text-xs leading-5 text-slate-500 dark:text-slate-400"
                      dateTime={timestamp} title={formatTimestamp(timestamp, date)}>{formatTimestamp(timestamp, clock)}</time>
                  </li>
                );
              })}
            </ol>
          )}
        </div>

        <footer className="shrink-0 border-t border-slate-200 bg-slate-50 px-4 py-2 text-xs text-slate-500 dark:border-slate-800 dark:bg-slate-950/40 dark:text-slate-400">
          {t(`datasetHistory.total.${plural}`, count)}
        </footer>
      </div>
    </dialog>
  );
}
