import { Lock, Copy } from "lucide-react";
import type { Dataset } from "@/types";
import { useDataStore } from "@/stores/useDataStore";
import { t } from "@/i18n";

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

      {/* Read-only Badge & Clone Action */}
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
      </div>
    </div>
  );
}
