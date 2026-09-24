import React, { useCallback, useRef } from "react";
import {
  GitBranch,
  Database,
  Upload,
  Plus,
  Cloud,
  FilePlus,
  Trash2,
} from "lucide-react";
import { useUIStore, useDataStore, useWorkflowStore, useSyncStore } from "@/stores";
import { generateId } from "@/utils/helpers";
import { getSampleWorkflowStandalone } from "@/sample-data";
import {
  parseFileContent,
  getFormatFromFilename,
  isBackendParseFormat,
  MAX_ROWS_STORED,
} from "@/utils/stats";
import * as quantisApi from "@/api";
import * as archiveApi from "@/archive-api";
import { t } from "@/i18n";

export function AppSidebar() {
  const {
    sidebarOpen,
    setSidebarOpen,
    isMobileLayout,
    setShowSampleModal,
    setArchiveModalOpen,
    setConfirmDialog,
    showToast,
  } = useUIStore();

  const { datasets, setDatasets, selectedDatasetId, setSelectedDatasetId } = useDataStore();

  const {
    workflows,
    setWorkflows,
    selectedWorkflowId,
    setSelectedWorkflowId,
    setSelectedWorkflowStepId,
  } = useWorkflowStore();

  const {
    setSidebarImportBusy,
    setArchiveSearchError,
    setArchiveSearchResult,
    setSelectedArchiveRequestId,
    setArchiveFiles,
    setArchiveSearchLoading,
    setArchivePage,
  } = useSyncStore();

  const csvFileInputRef = useRef<HTMLInputElement>(null);

  const selectedWorkflow = selectedWorkflowId ? workflows.find((w) => w.id === selectedWorkflowId) : null;
  const workflowDatasets = selectedWorkflow
    ? datasets.filter((d) => (selectedWorkflow.datasetIds ?? []).includes(d.id))
    : [];

  const handleSidebarCsvImport = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const format = getFormatFromFilename(file.name);

      const applyRows = (rows: string[][], fmt: string) => {
        if (!rows || rows.length < 2) return;
        const headers = rows[0];
        const kept = rows.slice(1, MAX_ROWS_STORED + 1);
        const id = generateId();
        const now = new Date().toISOString();
        const baseName =
          file.name.replace(/\.(csv|tsv|json|txt|xlsx|xls|ods|sav|dta|sas7bdat|rds|rdata)$/i, "") || file.name;
        setDatasets((prev) => [
          ...prev,
          {
            id,
            name: baseName,
            rows: kept.length,
            columns: headers.length,
            columnNames: headers,
            preview: rows.slice(0, 6),
            data: [headers, ...kept],
            sourceFormat: fmt,
            createdAt: now,
            updatedAt: now,
          },
        ]);
        setSelectedDatasetId(id);
        if (selectedWorkflowId) {
          setWorkflows((prev) =>
            prev.map((w) =>
              w.id !== selectedWorkflowId
                ? w
                : {
                    ...w,
                    datasetIds: [...(w.datasetIds ?? []), id].filter((x, i, a) => a.indexOf(x) === i),
                    updatedAt: now,
                  }
            )
          );
        }
      };

      if (isBackendParseFormat(format)) {
        setSidebarImportBusy(true);
        quantisApi
          .parseFileViaBackend(file)
          .then(({ rows, format: fmt }) => applyRows(rows, fmt))
          .catch((err) => {
            showToast?.(err?.message ?? t("app.errCannotReadFileNeedBackend"));
          })
          .finally(() => setSidebarImportBusy(false));
        e.target.value = "";
        return;
      }

      const reader = new FileReader();
      reader.onload = () => {
        try {
          const { rows, format: fmt } = parseFileContent(String(reader.result), file.name);
          applyRows(rows, fmt);
        } catch (_) {
          /* ignore */
        }
      };
      reader.readAsText(file, "UTF-8");
      e.target.value = "";
    },
    [selectedWorkflowId, setDatasets, setSelectedDatasetId, setWorkflows, setSidebarImportBusy, showToast]
  );

  return (
    <>
      {isMobileLayout && sidebarOpen && (
        <button
          type="button"
          aria-label={t("app.closeLeftPanel")}
          className="fixed inset-x-0 top-14 bottom-8 z-30 bg-black/45 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={`flex flex-col overflow-hidden border-neutral-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 transition-[transform,width] duration-200 ease-out
          max-md:fixed max-md:top-14 max-md:bottom-8 max-md:left-0 max-md:z-40 max-md:w-[min(18rem,calc(100vw-0.75rem))] max-md:shadow-2xl max-md:border-r
          ${sidebarOpen ? "max-md:translate-x-0 max-md:border-r" : "max-md:-translate-x-full max-md:pointer-events-none max-md:border-transparent max-md:shadow-none"}
          md:relative md:translate-x-0 md:pointer-events-auto md:flex-shrink-0
          ${sidebarOpen ? "md:w-64 md:border-r" : "md:w-0 md:border-transparent md:overflow-hidden"}`}
      >
        {sidebarOpen && (
          <div className="flex flex-col h-full min-h-0">
            <div className="p-3 flex flex-col gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                <GitBranch className="w-4 h-4 shrink-0" />
                <span className="text-sm font-semibold">Workflow</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedWorkflowId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setSelectedWorkflowId(v);
                    setSelectedWorkflowStepId(null);
                  }}
                  className="flex-1 min-w-0 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 truncate"
                  title={selectedWorkflow?.name}
                >
                  <option value="">{t("app.selectWorkflowPlaceholder")}</option>
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>
                      {w.name} ({w.steps.length})
                    </option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const w = getSampleWorkflowStandalone();
                    setWorkflows((prev) => [...prev, { ...w, name: `Workflow ${prev.length + 1}` }]);
                    setSelectedWorkflowId(w.id);
                    setSelectedWorkflowStepId(null);
                  }}
                  className="flex-shrink-0 flex items-center justify-center p-2 rounded-lg border border-brand bg-brand/10 dark:bg-brand/20 text-brand text-sm font-medium hover:bg-brand/20 dark:hover:bg-brand/30"
                  title={t("app.createNewWorkflow")}
                >
                  <FilePlus className="w-4 h-4" />
                </button>
              </div>
            </div>

            {/* Bộ dữ liệu + Import */}
            <div className="flex flex-col flex-1 min-h-0 border-t border-neutral-200 dark:border-neutral-700">
              <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                <Database className="w-4 h-4 shrink-0" />
                <span className="text-sm font-semibold">{t("app.datasetsImportSection")}</span>
              </div>
              <div className="flex-shrink-0 px-3 pb-2 flex flex-col gap-1.5">
                <input
                  ref={csvFileInputRef}
                  type="file"
                  accept=".csv,.tsv,.txt,.json,.xlsx,.xls,.ods,.sav,.dta,.sas7bdat,.rds,.RData,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                  className="hidden"
                  onChange={handleSidebarCsvImport}
                />
                <button
                  type="button"
                  onClick={() => csvFileInputRef.current?.click()}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                >
                  <Upload className="w-4 h-4" /> {t("app.uploadFile")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowSampleModal(true)}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                >
                  <Plus className="w-4 h-4" /> {t("app.addSampleDataset")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setArchiveModalOpen(true);
                    setArchiveSearchError(null);
                    setArchiveSearchResult([]);
                    setSelectedArchiveRequestId(null);
                    setArchiveFiles([]);
                    setArchiveSearchLoading(true);
                    archiveApi
                      .searchDatasets(1, 10)
                      .then((r) => {
                        setArchiveSearchResult(r.items ?? []);
                        setArchivePage(1);
                        setArchiveSearchLoading(false);
                      })
                      .catch((e) => {
                        setArchiveSearchError(e instanceof Error ? e.message : t("app.errCannotLoadList"));
                        setArchiveSearchLoading(false);
                      });
                  }}
                  className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-sky-300 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-200 text-sm hover:bg-sky-100 dark:hover:bg-sky-800/30"
                >
                  <Cloud className="w-4 h-4" /> {t("app.getFromArchiveNeu")}
                </button>
              </div>
              <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
                {(selectedWorkflowId && selectedWorkflow ? workflowDatasets : datasets).length === 0 ? (
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 py-2">{t("app.noDatasetsYet")}</p>
                ) : (
                  <ul className="space-y-1">
                    {(selectedWorkflowId && selectedWorkflow ? workflowDatasets : datasets).map((d) => {
                      const ext = d.sourceFormat
                        ? d.sourceFormat === "csv"
                          ? ".csv"
                          : d.sourceFormat === "tsv"
                          ? ".tsv"
                          : d.sourceFormat === "excel"
                          ? ".xlsx"
                          : `.${d.sourceFormat}`
                        : "";
                      const sourceLabel = d.sourceKey?.startsWith("sample:")
                        ? t("app.sourceLabelSampleData")
                        : d.sourceKey?.startsWith("archive:")
                        ? "Archive NEU"
                        : null;
                      return (
                        <li
                          key={d.id}
                          className="group flex items-stretch gap-0.5 rounded-lg overflow-hidden border border-transparent hover:border-neutral-200 dark:hover:border-neutral-600"
                        >
                          <button
                            type="button"
                            onClick={() => {
                              setSelectedDatasetId(d.id);
                              if (isMobileLayout) setSidebarOpen(false);
                            }}
                            className={`flex-1 min-w-0 text-left px-2.5 py-2 min-h-[44px] rounded-l-lg text-sm truncate border transition-colors ${
                              selectedDatasetId === d.id
                                ? "bg-brand/15 dark:bg-brand/25 border-brand/40 text-brand dark:text-brand"
                                : "border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300"
                            }`}
                            title={`${d.name} (${d.rows}×${d.columns})${ext ? ` ${ext}` : ""}${sourceLabel ? ` · ${sourceLabel}` : ""}`}
                          >
                            <span className="font-medium truncate block">{d.name}</span>
                            <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 flex-wrap">
                              <span>
                                {d.rows}×{d.columns}
                              </span>
                              {ext && <span className="opacity-80">{ext}</span>}
                              {sourceLabel && (
                                <span
                                  className={
                                    d.sourceKey?.startsWith("archive:")
                                      ? "text-sky-600 dark:text-sky-400"
                                      : "text-amber-600 dark:text-amber-400"
                                  }
                                >
                                  {sourceLabel}
                                </span>
                              )}
                            </span>
                          </button>
                          <button
                            type="button"
                            onClick={(e) => {
                              e.stopPropagation();
                              setConfirmDialog({
                                message: `${t("app.confirmDeleteDatasetPrefix")} "${d.name}"?`,
                                onConfirm: () => {
                                  setDatasets((prev) => prev.filter((x) => x.id !== d.id));
                                  if (selectedDatasetId === d.id) setSelectedDatasetId(null);
                                  const now = new Date().toISOString();
                                  setWorkflows((prev) =>
                                    prev.map((w) => ({
                                      ...w,
                                      datasetIds: (w.datasetIds ?? []).filter((id) => id !== d.id),
                                      updatedAt: now,
                                    }))
                                  );
                                  setConfirmDialog(null);
                                  showToast(t("app.toastDatasetDeleted"));
                                },
                              });
                            }}
                            className="flex-shrink-0 p-1.5 rounded-r-lg border border-transparent hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                            title={t("app.deleteDataset")}
                            aria-label={t("app.deleteDataset")}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </div>
            </div>
          </div>
        )}
      </aside>
    </>
  );
}
