import { Lock, Copy, Download } from "lucide-react";
import type { Dataset } from "@/types";
import { useDataStore } from "@/stores/useDataStore";
import { reconstructImputedRows } from "@/utils/sparseDelta";
import { t } from "@/i18n";

export function csvEscapeCell(value: unknown): string {
  const s = String(value ?? "");
  return /[",\r\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

/**
 * Tái tạo long-format CSV chứa m bộ dữ liệu đã điền (MICE):
 * Header: _imputation, col1, col2, ...
 * Mỗi bộ k in [1..m] có n dòng dữ liệu với cột đầu là k.
 */
export function generateBundleCsv(dataset: Dataset): string {
  if (!dataset?.imputationMeta) return "";
  const { m, originalRows, sparsePatches } = dataset.imputationMeta;
  const cols = dataset.columnNames || (originalRows[0] ?? []);
  const header = ["_imputation", ...cols];
  const lines: string[][] = [header];

  const hasHeader =
    (dataset.rows !== undefined && originalRows.length === dataset.rows + 1) ||
    (cols.length > 0 && originalRows.length > 0 && originalRows[0]?.[0] === cols[0]);

  for (let k = 1; k <= m; k++) {
    const reconstructed = reconstructImputedRows(
      originalRows,
      dataset.columnNames,
      sparsePatches,
      k,
      dataset.rows
    );
    const dataRows = hasHeader ? reconstructed.slice(1) : reconstructed;
    for (const r of dataRows) {
      lines.push([String(k), ...r]);
    }
  }

  return lines.map((row) => row.map(csvEscapeCell).join(",")).join("\r\n");
}

export function downloadBundleCsv(dataset: Dataset): void {
  const csv = generateBundleCsv(dataset);
  if (!csv || typeof document === "undefined") return;
  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${dataset.name || "dataset"}_MI_m${dataset.imputationMeta?.m || 5}.csv`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export interface BundleNavigationBarProps {
  dataset: Dataset;
  showToast?: (msg: string) => void;
  onSelectDataset?: (id: string | null) => void;
  className?: string;
}

export function BundleNavigationBar({
  dataset,
  showToast,
  onSelectDataset,
  className = "",
}: BundleNavigationBarProps) {
  if (!dataset?.imputationMeta) {
    return null;
  }

  const { m, activeImputationIndex } = dataset.imputationMeta;

  const handleSelectSet = (idx: number) => {
    useDataStore.getState().setActiveImputationIndex(dataset.id, idx);
  };

  const handleClone = () => {
    const cloned = useDataStore.getState().cloneBundleAsStandardDataset(dataset.id, activeImputationIndex);
    if (cloned) {
      useDataStore.getState().setSelectedDatasetId(cloned.id);
      if (onSelectDataset) {
        onSelectDataset(cloned.id);
      }
      if (showToast) {
        showToast(
          t("dataGrid.bundleCloneSuccess", {
            index: activeImputationIndex,
            name: cloned.name,
          })
        );
      }
    }
  };

  const handleExportCsv = () => {
    downloadBundleCsv(dataset);
  };

  return (
    <div
      className={`flex flex-wrap items-center justify-between gap-2 px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/80 dark:bg-neutral-900/60 select-none ${className}`}
    >
      {/* Imputed dataset switcher tabs */}
      <div className="flex flex-wrap items-center gap-1.5">
        <button
          type="button"
          data-testid="bundle-nav-btn-0"
          data-index={0}
          onClick={() => handleSelectSet(0)}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition ${
            activeImputationIndex === 0
              ? "bg-brand text-white font-semibold shadow-xs"
              : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
          }`}
        >
          <span>{t("dataGrid.bundleOriginal")}</span>
        </button>

        {Array.from({ length: m }, (_, k) => k + 1).map((idx) => {
          const isActive = activeImputationIndex === idx;
          return (
            <button
              key={idx}
              type="button"
              data-testid={`bundle-nav-btn-${idx}`}
              data-index={idx}
              onClick={() => handleSelectSet(idx)}
              className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded transition ${
                isActive
                  ? "bg-brand text-white font-semibold shadow-xs"
                  : "text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200/60 dark:hover:bg-neutral-800 border border-neutral-200 dark:border-neutral-700"
              }`}
            >
              <span>{t("dataGrid.bundleSet", { i: idx })}</span>
            </button>
          );
        })}
      </div>

      {/* Read-only Badge, Clone Action & Export CSV */}
      <div className="flex items-center gap-2">
        <span
          data-testid="bundle-readonly-badge"
          className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded text-xs font-medium bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300 border border-amber-300 dark:border-amber-700/50"
        >
          <Lock className="w-3.5 h-3.5" />
          <span>{t("dataGrid.bundleReadOnlyBadge")}</span>
        </span>

        <button
          type="button"
          data-testid="bundle-clone-btn"
          onClick={handleClone}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 shadow-2xs transition"
          title={t("dataGrid.bundleCloneBtn")}
        >
          <Copy className="w-3.5 h-3.5" />
          <span>{t("dataGrid.bundleCloneBtn")}</span>
        </button>

        <button
          type="button"
          data-testid="bundle-export-csv-btn"
          onClick={handleExportCsv}
          className="inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-neutral-50 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-200 shadow-2xs transition"
          title={t("dataGrid.bundleExportCsvBtn", { m })}
        >
          <Download className="w-3.5 h-3.5" />
          <span>{t("dataGrid.bundleExportCsvBtn", { m })}</span>
        </button>
      </div>
    </div>
  );
}
