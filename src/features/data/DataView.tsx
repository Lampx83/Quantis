import type { Dispatch, SetStateAction } from "react";
import { Table2, SlidersHorizontal } from "lucide-react";
import type { Dataset } from "@/types";
import { useUIStore, type DataTab } from "@/stores";
import { type DescriptiveRow, getAnalysisRows, computeProfileWithOutliers } from "@/utils/stats";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";
import { DataGrid } from "./grid/DataGrid";
import { VariableViewGrid } from "./grid/VariableViewGrid";
import { TransformTab } from "./TransformTab";
import { DescriptiveStatsView } from "./DescriptiveStatsView";

export interface DataViewProps {
  tab: DataTab;
  datasets: Dataset[];
  setDatasets: Dispatch<SetStateAction<Dataset[]>>;
  selectedDatasetId: string | null;
  onSelectDataset: (id: string | null) => void;
  showToast?: (msg: string) => void;
  /** Gọi khi thêm dataset mới trong ngữ cảnh workflow (để gắn vào workflow). */
  onWorkflowDatasetAdd?: (datasetId: string) => void;
  analysisBackendAvailable?: boolean;
  descriptiveBackendResult?: DescriptiveRow[] | null;
}

function DualViewWorkspace({
  selectedDs,
  showToast,
}: {
  selectedDs: Dataset;
  showToast?: (msg: string) => void;
}) {
  const uiHook = useUIStore();
  const {
    dataEditorView,
    setDataEditorView,
    showValueLabels,
  } = typeof window === "undefined" ? useUIStore.getState() : uiHook;

  return (
    <div className="flex flex-col h-[calc(100vh-13rem)] min-h-[500px] w-full">
      {/* Main Active Grid View */}
      <div className="flex-1 min-h-0 w-full">
        {dataEditorView === "data" ? (
          <DataGrid
            dataset={selectedDs}
            showValueLabels={showValueLabels}
            showToast={showToast}
          />
        ) : (
          <VariableViewGrid dataset={selectedDs} showToast={showToast} />
        )}
      </div>

      {/* SPSS Style Bottom View Switcher Strip */}
      <div className="flex items-center gap-1.5 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-100/90 dark:bg-neutral-800/80 px-2 py-1 select-none">
        <button
          type="button"
          role="tab"
          aria-selected={dataEditorView === "data"}
          onClick={() => setDataEditorView("data")}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded font-medium transition ${
            dataEditorView === "data"
              ? "bg-white dark:bg-neutral-900 text-brand shadow-xs border border-neutral-200 dark:border-neutral-700 font-bold"
              : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
          }`}
        >
          <Table2 className="w-3.5 h-3.5" />
          <span>{t("dualView.dataView")}</span>
        </button>

        <button
          type="button"
          role="tab"
          aria-selected={dataEditorView === "variable"}
          onClick={() => setDataEditorView("variable")}
          className={`flex items-center gap-1.5 px-3 py-1 text-xs rounded font-medium transition ${
            dataEditorView === "variable"
              ? "bg-white dark:bg-neutral-900 text-brand shadow-xs border border-neutral-200 dark:border-neutral-700 font-bold"
              : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50"
          }`}
        >
          <SlidersHorizontal className="w-3.5 h-3.5" />
          <span>{t("dualView.variableView")}</span>
        </button>
      </div>
    </div>
  );
}

export function DataView({
  tab,
  datasets,
  setDatasets,
  selectedDatasetId,
  onSelectDataset,
  showToast,
  onWorkflowDatasetAdd,
  analysisBackendAvailable = false,
  descriptiveBackendResult = null,
}: DataViewProps) {
  const selectedDs = selectedDatasetId ? datasets.find((d) => d.id === selectedDatasetId) ?? null : null;

  if (tab === "descriptive") {
    return (
      <DescriptiveStatsView
        selectedDataset={selectedDs ?? undefined}
        analysisBackendAvailable={analysisBackendAvailable}
        descriptiveBackendResult={descriptiveBackendResult}
      />
    );
  }

  if (tab === "import") {
    // Tab import: hiển thị giống "Xem dữ liệu" để luôn có nội dung
    if (!selectedDs) {
      return (
        <div className="w-full max-w-full">
          <h2 className="text-xl font-semibold mb-2">{t("dataView.exploreDataTitle")}</h2>
          <p className="text-neutral-500">{t("dataView.selectDatasetImportPrompt")}</p>
          <p className="text-sm text-neutral-500 mt-2">{t("dataView.aiGuideHintPrefix")} <strong>{t("dataView.aiGuideHintLabel")}</strong> {t("dataView.importAiGuideHintSuffix")}</p>
        </div>
      );
    }
    return <DualViewWorkspace selectedDs={selectedDs} showToast={showToast} />;
  }

  if (tab === "profiling") {
    let rows: string[][] = [];
    try {
      rows = getAnalysisRows(selectedDs ?? undefined);
    } catch {
      rows = [];
    }
    const profiles = Array.isArray(rows) && rows.length >= 2 ? computeProfileWithOutliers(rows) : [];
    const aiContextProfiling = profiles.length > 0
      ? profiles.map((p) => `Cột ${p?.column}: kiểu ${p?.type}, missing ${p?.missing} (${typeof p?.missingPct === "number" ? p.missingPct.toFixed(1) : "—"}%), unique ${p?.unique}, mean ${p?.mean != null ? Number(p.mean).toFixed(2) : "—"}, std ${p?.std != null ? Number(p.std).toFixed(2) : "—"}, skew ${p?.skew != null ? Number(p.skew).toFixed(3) : "—"}, outlier ${p?.outlierCount ?? "?"}`).join("\n")
      : "";
    return (
      <div className="w-full max-w-full">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="text-xl font-semibold">{t("dataView.profiling.title")}</h2>
          {aiContextProfiling ? (
            <AIAssistPanel
              context={aiContextProfiling}
              quickPrompts={[{ label: t("dataView.profiling.aiExplainLabel"), systemHint: `Bạn là chuyên gia thống kê. Giải thích ý nghĩa bảng phân tích sơ bộ: missing (thiếu), kiểu cột, mean/std/min/max, skewness, số điểm ngoại lai — dùng để nắm nhanh chất lượng và phân bố từng biến trước khi phân tích sâu. ${aiAnswerLangHint()}` }]}
              title={t("dataView.profiling.aiAskTitle")}
            />
          ) : null}
        </div>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("dataView.profiling.subtitle")} <span className="text-neutral-500 dark:text-neutral-500" title={t("dataView.profiling.naTooltip")}>{t("dataView.profiling.naLabel")}</span></p>
        {selectedDs && profiles.length > 0 ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left p-2">{t("dataView.profiling.table.column")}</th>
                  <th className="text-left p-2">{t("dataView.profiling.table.type")}</th>
                  <th className="text-right p-2">Missing</th>
                  <th className="text-right p-2">%</th>
                  <th className="text-right p-2">Unique</th>
                  <th className="text-right p-2">Min</th>
                  <th className="text-right p-2">Max</th>
                  <th className="text-right p-2">Mean</th>
                  <th className="text-right p-2">Std</th>
                  <th className="text-right p-2">Skew</th>
                  <th className="text-right p-2">Outlier</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p, idx) => (
                  <tr key={p?.column != null ? String(p.column) || `col-${idx}` : `col-${idx}`} className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="p-2 font-medium">{p?.column ?? "—"}</td>
                    <td className="p-2">{p?.type ?? "—"}</td>
                    <td className="p-2 text-right">{p?.missing ?? "—"}</td>
                    <td className="p-2 text-right">{typeof p?.missingPct === "number" ? p.missingPct.toFixed(1) : "—"}%</td>
                    <td className="p-2 text-right">{p?.unique ?? "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? t("dataView.profiling.naCellTooltip") : undefined}>{p?.min != null ? Number(p.min).toFixed(2) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? t("dataView.profiling.naCellTooltip") : undefined}>{p?.max != null ? Number(p.max).toFixed(2) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? t("dataView.profiling.naCellTooltip") : undefined}>{p?.mean != null ? Number(p.mean).toFixed(2) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? t("dataView.profiling.naCellTooltip") : undefined}>{p?.std != null ? Number(p.std).toFixed(2) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? t("dataView.profiling.naCellTooltip") : undefined}>{p?.skew != null ? Number(p.skew).toFixed(3) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? t("dataView.profiling.naCellTooltip") : undefined}>{p?.outlierCount != null ? p.outlierCount : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : selectedDs ? (
          <p className="text-neutral-500">{t("dataView.profiling.notEnoughDataPrefix")} <strong>{t("dataView.profiling.addSampleDatasetLabel")}</strong> {t("dataView.profiling.notEnoughDataSuffix")}</p>
        ) : (
          <>
            <p className="text-neutral-500">{t("dataView.profiling.noDatasetPrefix")} <strong>{t("dataView.profiling.addSampleDatasetLabel")}</strong> {t("dataView.profiling.noDatasetSuffix")}</p>
            <p className="text-sm text-neutral-500 mt-2">{t("dataView.aiGuideHintPrefix")} <strong>{t("dataView.aiGuideHintLabel")}</strong> {t("dataView.profiling.aiGuideHintSuffix")}</p>
          </>
        )}
      </div>
    );
  }

  if (tab === "transform") {
    return (
      <TransformTab
        selectedDs={selectedDs}
        setDatasets={setDatasets}
        onSelectDataset={onSelectDataset}
        onWorkflowDatasetAdd={onWorkflowDatasetAdd}
      />
    );
  }

  if (tab === "preview") {
    if (!selectedDs) {
      return (
        <div className="w-full max-w-full">
          <h2 className="text-xl font-semibold mb-2">{t("dataView.preview.title")}</h2>
          <p className="text-neutral-500">{t("dataView.preview.selectDatasetPrompt")}</p>
          <p className="text-sm text-neutral-500 mt-2">{t("dataView.aiGuideHintPrefix")} <strong>{t("dataView.aiGuideHintLabel")}</strong> {t("dataView.previewAiGuideHintSuffix")}</p>
        </div>
      );
    }
    return <DualViewWorkspace selectedDs={selectedDs} showToast={showToast} />;
  }

  return null;
}
