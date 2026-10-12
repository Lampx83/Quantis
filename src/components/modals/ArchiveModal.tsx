import React from "react";
import { Cloud, X } from "lucide-react";
import { useUIStore, useSyncStore, useDataStore, useWorkflowStore } from "@/stores";
import * as archiveApi from "@/archive-api";
import { parseFileContent, MAX_ROWS_STORED } from "@/utils/stats";
import { generateId } from "@/utils/helpers";
import type { Dataset } from "@/types";
import { t } from "@/i18n";

export function ArchiveModal() {
  const { archiveModalOpen, setArchiveModalOpen } = useUIStore();
  const {
    archiveSearchError,
    setArchiveSearchError,
    archiveSearchLoading,
    selectedArchiveRequestId,
    setSelectedArchiveRequestId,
    archiveSearchResult,
    selectedArchiveTitle,
    setSelectedArchiveTitle,
    archiveFiles,
    setArchiveFiles,
    archiveFilesLoading,
    setArchiveFilesLoading,
    archiveDownloadingFileId,
    setArchiveDownloadingFileId,
  } = useSyncStore();

  const { setDatasets, setSelectedDatasetId } = useDataStore();
  const { selectedWorkflowId, setWorkflows } = useWorkflowStore();

  if (!archiveModalOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={() => setArchiveModalOpen(false)}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
          <h3 className="font-semibold flex items-center gap-2">
            <Cloud className="w-5 h-5 text-sky-600" /> {t("app.archiveNeuChooseDataset")}
          </h3>
          <button
            type="button"
            onClick={() => setArchiveModalOpen(false)}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="flex-1 overflow-auto p-4">
          {archiveSearchError && (
            <pre className="text-red-600 dark:text-red-400 text-sm mb-3 whitespace-pre-wrap font-sans break-all">
              {archiveSearchError}
            </pre>
          )}
          {archiveSearchLoading && <p className="text-neutral-500 text-sm">{t("app.loadingList")}</p>}
          {!selectedArchiveRequestId ? (
            <ul className="space-y-2">
              {archiveSearchResult.map((item) => {
                const reqId = String(item.requestId ?? item.id ?? "");
                return (
                  <li key={reqId}>
                    <button
                      type="button"
                      onClick={() => {
                        setSelectedArchiveRequestId(reqId);
                        setSelectedArchiveTitle(String(item.title ?? "Dataset"));
                        setArchiveFiles([]);
                        setArchiveFilesLoading(true);
                        archiveApi
                          .getFilesByRequest(reqId)
                          .then((files) => {
                            setArchiveFiles(files);
                            setArchiveFilesLoading(false);
                          })
                          .catch((e) => {
                            setArchiveFiles([]);
                            setArchiveFilesLoading(false);
                            setArchiveSearchError(e instanceof Error ? e.message : t("app.errCannotLoadFile"));
                          });
                      }}
                      className="w-full text-left p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                    >
                      <span className="font-medium block">{item.title}</span>
                      {item.description && <span className="text-sm text-neutral-500 line-clamp-2">{item.description}</span>}
                    </button>
                  </li>
                );
              })}
            </ul>
          ) : (
            <div>
              <button
                type="button"
                onClick={() => {
                  setSelectedArchiveRequestId(null);
                  setArchiveFiles([]);
                  setArchiveSearchError(null);
                }}
                className="text-sm text-sky-600 dark:text-sky-400 mb-2"
              >
                {t("app.backToList")}
              </button>
              <p className="font-medium mb-2">Dataset: {selectedArchiveTitle}</p>
              {archiveFilesLoading && <p className="text-sm text-neutral-500">{t("app.loadingFileList")}</p>}
              <ul className="space-y-2">
                {archiveFiles.map((f) => {
                  const loading = archiveDownloadingFileId === f.id;
                  return (
                    <li
                      key={f.id}
                      className="flex items-center justify-between p-2 rounded-lg border border-neutral-200 dark:border-neutral-700"
                    >
                      <span className="text-sm truncate flex-1">{f.file_name}</span>
                      <button
                        type="button"
                        disabled={loading}
                        onClick={async () => {
                          if (!selectedArchiveRequestId) return;
                          setArchiveDownloadingFileId(f.id);
                          setArchiveSearchError(null);
                          try {
                            const text = await archiveApi.fetchArchiveFileAsText(f.id, selectedArchiveRequestId);
                            const { rows, format } = parseFileContent(text, f.file_name || "data.csv");
                            if (rows.length < 2) {
                              setArchiveSearchError(t("app.errFileNotEnoughRows"));
                              return;
                            }
                            const archiveSourceKey = `archive:${selectedArchiveRequestId}:${f.id}:${generateId()}`;
                            const headers = rows[0];
                            const kept = rows.slice(1, MAX_ROWS_STORED + 1);
                            const id = generateId();
                            const now = new Date().toISOString();
                            const newDs: Dataset = {
                              id,
                              name: (selectedArchiveTitle || f.file_name || "data").replace(
                                /\.(csv|tsv|json|txt)$/i,
                                ""
                              ),
                              rows: kept.length,
                              columns: headers.length,
                              columnNames: headers,
                              preview: rows.slice(0, 6),
                              data: [headers, ...kept],
                              sourceFormat: format,
                              sourceKey: archiveSourceKey,
                              createdAt: now,
                              updatedAt: now,
                            };
                            setDatasets((prev) => [...prev, newDs]);
                            setSelectedDatasetId(id);
                            if (selectedWorkflowId) {
                              setWorkflows((prev) =>
                                prev.map((w) =>
                                  w.id !== selectedWorkflowId
                                    ? w
                                    : {
                                        ...w,
                                        datasetIds: [...(w.datasetIds ?? []), id].filter(
                                          (x, i, a) => a.indexOf(x) === i
                                        ),
                                        updatedAt: now,
                                      }
                                )
                              );
                            }
                            setArchiveModalOpen(false);
                          } catch (e) {
                            setArchiveSearchError(e instanceof Error ? e.message : t("app.errFileDownloadFailed"));
                          } finally {
                            setArchiveDownloadingFileId(null);
                          }
                        }}
                        className="rounded px-3 py-1.5 text-sm bg-brand text-white hover:opacity-90 disabled:opacity-50"
                      >
                        {loading ? t("app.loadingEllipsis2") : t("app.loadIntoQuantis")}
                      </button>
                    </li>
                  );
                })}
              </ul>
              {!archiveFilesLoading && archiveFiles.length === 0 && selectedArchiveRequestId && (
                <p className="text-sm text-neutral-500">{t("app.noFiles")}</p>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
