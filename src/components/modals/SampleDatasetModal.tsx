import React, { useCallback, useEffect } from "react";
import { X } from "lucide-react";
import { useUIStore, useDataStore, useWorkflowStore, useSyncStore } from "@/stores";
import type { SampleDatasetListItem } from "@/api";
import * as quantisApi from "@/api";
import { SAMPLE_DATASETS } from "@/sampleDatasets";
import { generateId } from "@/utils/helpers";
import { t } from "@/i18n";

export function SampleDatasetModal() {
  const {
    showSampleModal,
    setShowSampleModal,
    setShowSampleAdminModal,
    sampleDatasetSearch,
    setSampleDatasetSearch,
    showToast,
  } = useUIStore();

  const { isPortalAdmin, sampleDatasetsList, sampleDatasetsLoading, refreshSampleDatasets } = useSyncStore();
  const { setDatasets, setSelectedDatasetId } = useDataStore();
  const { selectedWorkflowId, setWorkflows } = useWorkflowStore();

  useEffect(() => {
    if (showSampleModal && sampleDatasetsList.length === 0) {
      refreshSampleDatasets();
    }
  }, [showSampleModal, sampleDatasetsList.length, refreshSampleDatasets]);

  const handleSelectSample = useCallback(
    async (def: SampleDatasetListItem) => {
      let full = await quantisApi.fetchSampleDatasetFull(def.id);
      let header: string[];
      let dataRows: string[][];
      let fullData: string[][];
      let name = def.name;

      if (full) {
        header = full.header ?? full.data?.[0] ?? [];
        dataRows = full.rows_data ?? (full.data ?? []).slice(1);
        fullData = full.data ?? [header, ...dataRows];
        name = full.name;
        if (!header.length || !Array.isArray(dataRows)) {
          showToast(t("app.errCannotLoadFile"));
          return;
        }
      } else {
        // Fallback về SAMPLE_DATASETS tĩnh cục bộ
        const localDef = SAMPLE_DATASETS.find((d) => d.id === def.id);
        if (localDef) {
          const raw = localDef.getData();
          header = raw[0];
          dataRows = raw.slice(1);
          fullData = raw;
          name = localDef.name;
        } else {
          showToast(t("app.errCannotLoadFile"));
          return;
        }
      }

      const sourceKey = `sample:${def.id}:${generateId()}`;
      const id = generateId();
      const now = new Date().toISOString();
      const preview = fullData.slice(0, 6);

      setDatasets((prev) => [
        ...prev,
        {
          id,
          name,
          rows: dataRows.length,
          columns: header.length,
          columnNames: header,
          preview,
          data: fullData,
          sourceFormat: "csv",
          sourceKey,
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
      setShowSampleModal(false);
    },
    [selectedWorkflowId, setDatasets, setSelectedDatasetId, setWorkflows, setShowSampleModal, showToast]
  );

  if (!showSampleModal) return null;

  const q = sampleDatasetSearch.trim().toLowerCase();
  const list = !q
    ? sampleDatasetsList
    : sampleDatasetsList.filter((def) => {
        const name = def.name.toLowerCase();
        const domain = def.domain.toLowerCase();
        const desc = (def.description || "").toLowerCase();
        const tagsStr = (def.tags || []).join(" ").toLowerCase();
        return name.includes(q) || domain.includes(q) || desc.includes(q) || tagsStr.includes(q);
      });

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={() => setShowSampleModal(false)}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
            {t("app.chooseSampleDataset")}
          </h2>
          <div className="flex items-center gap-1">
            {isPortalAdmin && (
              <button
                type="button"
                onClick={() => {
                  setShowSampleModal(false);
                  setShowSampleAdminModal(true);
                }}
                className="px-2 py-1 rounded-lg text-xs font-medium text-brand border border-brand/40 hover:bg-brand/10"
              >
                {t("app.manageSampleDatasets")}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowSampleModal(false)}
              className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>
        <div className="px-4 pb-2">
          <input
            type="text"
            value={sampleDatasetSearch}
            onChange={(e) => setSampleDatasetSearch(e.target.value)}
            placeholder={t("app.searchByNameDomainDesc")}
            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm placeholder-neutral-400 focus:ring-2 focus:ring-brand/50 focus:border-brand"
          />
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sampleDatasetsLoading && sampleDatasetsList.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4">{t("app.loadingList")}</p>
          )}
          {!sampleDatasetsLoading && list.length === 0 ? (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4">{t("app.noSampleDatasetMatch")}</p>
          ) : (
            list.map((def) => (
              <button
                key={def.id}
                type="button"
                onClick={() => handleSelectSample(def)}
                className="w-full text-left p-3 rounded-lg border border-neutral-200 dark:border-neutral-600 hover:border-brand/50 hover:bg-brand/5 dark:hover:bg-brand/10 transition-colors"
              >
                <p className="font-medium text-neutral-800 dark:text-neutral-200">{def.name}</p>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{def.description}</p>
              </button>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
