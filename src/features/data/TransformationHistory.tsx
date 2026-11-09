import { useEffect, useId, useRef } from "react";
import { X } from "lucide-react";
import type { Dataset, DatasetChange } from "@/types";
import { t, useLocale } from "@/i18n";
import { transformActionLabel } from "./TransformTab";

function describeChange(change: DatasetChange, number: Intl.NumberFormat): string {
  const { action, operation, columns = [], formula, firstRow, lastRow, rowCount, cellCount } = change;
  const parts: string[] = [];
  if (change.kind === "undo" || change.kind === "redo") parts.push(t(`datasetHistory.${change.kind}`));
  if (operation === "compute" && columns[0] && formula) {
    parts.push(`${t("datasetHistory.computed")} ${columns[0]} = ${formula}`);
  } else {
    parts.push(operation ? transformActionLabel(operation) : t(`datasetHistory.action.${action}`));
    if (columns.length) parts.push(columns.join(action === "renameColumn" || operation === "rename" ? " → " : ", "));
  }
  if (change.columnCount && change.columnCount > columns.length) {
    parts.push(t("datasetHistory.moreVariables", { n: number.format(change.columnCount - columns.length) }));
  }
  if (firstRow !== undefined) {
    parts.push(lastRow !== undefined && lastRow !== firstRow
      ? t("datasetHistory.rowRange", { first: number.format(firstRow), last: number.format(lastRow) })
      : t("datasetHistory.row", { n: number.format(firstRow) }));
  }
  if (rowCount !== undefined && (firstRow === undefined || rowCount < (lastRow ?? firstRow) - firstRow + 1)) {
    parts.push(t(rowCount === 1 ? "datasetHistory.oneRow" : "datasetHistory.rows", { n: number.format(rowCount) }));
  }
  if (cellCount !== undefined) {
    parts.push(t(cellCount === 1 ? "datasetHistory.oneCell" : "datasetHistory.cells", { n: number.format(cellCount) }));
  }
  return parts.join(" · ");
}

export function TransformationHistory({ dataset, onClose }: { dataset: Dataset; onClose: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const locale = useLocale();
  const number = new Intl.NumberFormat(locale);
  const date = new Intl.DateTimeFormat(locale, {
    year: "numeric", month: "short", day: "numeric", hour: "numeric", minute: "2-digit",
  });
  const entries = dataset.audit?.entries ?? [];
  const cutoff = dataset.audit?.cutoffAt;
  const formatTime = (value: string) => {
    const time = Date.parse(value);
    return Number.isNaN(time) ? value : date.format(time);
  };

  useEffect(() => {
    if (ref.current && !ref.current.open) ref.current.showModal();
  }, []);

  return (
    <dialog ref={ref} aria-labelledby={titleId} onCancel={onClose}
      className="fixed inset-0 m-auto w-[calc(100%_-_2rem)] max-w-2xl max-h-[80dvh] overflow-y-auto rounded-lg border border-neutral-200 bg-white text-neutral-800 shadow-xl backdrop:bg-black/40 dark:border-neutral-700 dark:bg-neutral-900 dark:text-neutral-100">
      <header className="sticky top-0 flex items-center justify-between gap-3 border-b border-neutral-200 bg-white px-4 py-3 dark:border-neutral-700 dark:bg-neutral-900">
        <h2 id={titleId} className="break-words text-base font-semibold">{t("datasetHistory.title", { name: dataset.name })}</h2>
        <button type="button" aria-label={t("datasetHistory.close")} className="shrink-0 rounded p-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          onClick={() => { ref.current?.close(); onClose(); }}>
          <X className="h-5 w-5" />
        </button>
      </header>
      {cutoff && <p className="bg-amber-50 px-4 py-2 text-sm text-amber-900 dark:bg-amber-950 dark:text-amber-200">
        {t("datasetHistory.cutoff", { time: formatTime(cutoff) })}
      </p>}
      {entries.length === 0 ? (
        <p className="px-4 py-6 text-sm text-neutral-600 dark:text-neutral-400">{t("datasetHistory.empty")}</p>
      ) : (
        <ol className="divide-y divide-neutral-100 px-4 dark:divide-neutral-800">
          {entries.map((change) => (
            <li key={change.id} className="break-words py-2.5 text-sm">
              <time className="text-neutral-500 dark:text-neutral-400" dateTime={change.timestamp}>{formatTime(change.timestamp)}</time>
              {" · "}{describeChange(change, number)}
              {change.kind === "derive" && (
                <span title={change.source.datasetId}>
                  {" · "}{t("datasetHistory.source", { name: change.source.name })}
                  {change.source.member !== undefined && (
                    <>{" · "}{change.source.member === 0 ? t("dataGrid.bundleOriginal") :
                      t("datasetHistory.member", { n: number.format(change.source.member) })}</>
                  )}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </dialog>
  );
}
