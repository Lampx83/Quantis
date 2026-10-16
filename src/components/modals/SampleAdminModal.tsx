import React, { useState } from "react";
import { X, Plus, Edit2, Trash2 } from "lucide-react";
import { useUIStore, useSyncStore } from "@/stores";
import * as quantisApi from "@/api";
import { t } from "@/i18n";

export function SampleAdminModal() {
  const { showSampleAdminModal, setShowSampleAdminModal, setConfirmDialog, showToast } = useUIStore();
  const { sampleDatasetsList, refreshSampleDatasets } = useSyncStore();

  const [sampleAdminForm, setSampleAdminForm] = useState<{
    id: string;
    isNew: boolean;
    name: string;
    domain: string;
    description: string;
    tags: string;
    csv: string;
  } | null>(null);

  const [sampleAdminSaving, setSampleAdminSaving] = useState(false);
  const [sampleAdminError, setSampleAdminError] = useState<string | null>(null);

  if (!showSampleAdminModal) return null;

  const handleClose = () => {
    setShowSampleAdminModal(false);
    setSampleAdminForm(null);
    setSampleAdminError(null);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={handleClose}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
            {t("app.manageSampleDatasets")}
          </h2>
          <button
            type="button"
            onClick={handleClose}
            className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {!sampleAdminForm ? (
          <>
            <div className="px-4 pt-3">
              <button
                type="button"
                onClick={() => {
                  setSampleAdminError(null);
                  setSampleAdminForm({
                    id: "",
                    isNew: true,
                    name: "",
                    domain: "",
                    description: "",
                    tags: "",
                    csv: "col1,col2\nvalue1,value2",
                  });
                }}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium bg-brand text-white hover:opacity-90"
              >
                <Plus className="w-4 h-4" /> {t("app.addNew")}
              </button>
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {sampleDatasetsList.length === 0 && (
                <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4">
                  {t("app.noSampleDatasetMatch")}
                </p>
              )}
              {sampleDatasetsList.map((def) => (
                <div
                  key={def.id}
                  className="flex items-center justify-between gap-2 p-3 rounded-lg border border-neutral-200 dark:border-neutral-600"
                >
                  <div className="min-w-0">
                    <p className="font-medium text-neutral-800 dark:text-neutral-200 truncate">
                      {def.name}
                    </p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">
                      {def.domain} · {def.rows}×{def.columns}
                    </p>
                  </div>
                  <div className="flex items-center gap-1 shrink-0">
                    <button
                      type="button"
                      title={t("app.edit")}
                      onClick={async () => {
                        setSampleAdminError(null);
                        const full = await quantisApi.fetchSampleDatasetFull(def.id);
                        if (!full) {
                          setSampleAdminError(t("app.errCannotLoadFile"));
                          return;
                        }
                        const csv = [full.header, ...full.rows_data]
                          .map((row) => row.map((c) => (c ?? "")).join(","))
                          .join("\n");
                        setSampleAdminForm({
                          id: full.id,
                          isNew: false,
                          name: full.name,
                          domain: full.domain,
                          description: full.description,
                          tags: (full.tags || []).join(", "),
                          csv,
                        });
                      }}
                      className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                    >
                      <Edit2 className="w-4 h-4" />
                    </button>
                    <button
                      type="button"
                      title={t("app.delete")}
                      onClick={() => {
                        setConfirmDialog({
                          message: t("app.confirmDeleteSampleDataset").replace("{name}", def.name),
                          onConfirm: async () => {
                            setConfirmDialog(null);
                            const result = await quantisApi.deleteSampleDatasetAdmin(def.id);
                            if (!result.ok) {
                              showToast(result.error || t("api.connectionError"));
                              return;
                            }
                            await refreshSampleDatasets();
                          },
                        });
                      }}
                      className="p-2 rounded-md text-red-500 hover:bg-red-50 dark:hover:bg-red-900/20"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {sampleAdminError && (
              <p className="text-sm text-red-600 dark:text-red-400">{sampleAdminError}</p>
            )}
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                {t("app.sampleFormName")}
              </label>
              <input
                type="text"
                value={sampleAdminForm.name}
                onChange={(e) => setSampleAdminForm((f) => (f ? { ...f, name: e.target.value } : f))}
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                  {t("app.sampleFormDomain")}
                </label>
                <input
                  type="text"
                  value={sampleAdminForm.domain}
                  onChange={(e) => setSampleAdminForm((f) => (f ? { ...f, domain: e.target.value } : f))}
                  className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
                />
              </div>
              <div>
                <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                  {t("app.sampleFormTags")}
                </label>
                <input
                  type="text"
                  value={sampleAdminForm.tags}
                  onChange={(e) => setSampleAdminForm((f) => (f ? { ...f, tags: e.target.value } : f))}
                  placeholder="t-test, ANOVA, ..."
                  className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                {t("app.sampleFormDescription")}
              </label>
              <textarea
                value={sampleAdminForm.description}
                onChange={(e) =>
                  setSampleAdminForm((f) => (f ? { ...f, description: e.target.value } : f))
                }
                rows={2}
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-neutral-500 dark:text-neutral-400 mb-1">
                {t("app.sampleFormCsv")}
              </label>
              <textarea
                value={sampleAdminForm.csv}
                onChange={(e) => setSampleAdminForm((f) => (f ? { ...f, csv: e.target.value } : f))}
                rows={10}
                spellCheck={false}
                className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm font-mono"
              />
              <p className="text-xs text-neutral-400 mt-1">{t("app.sampleFormCsvHint")}</p>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => {
                  setSampleAdminForm(null);
                  setSampleAdminError(null);
                }}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600"
              >
                {t("app.cancel")}
              </button>
              <button
                type="button"
                disabled={sampleAdminSaving}
                onClick={async () => {
                  const form = sampleAdminForm;
                  if (!form) return;
                  const name = form.name.trim();
                  if (!name) {
                    setSampleAdminError(t("app.sampleFormNameRequired"));
                    return;
                  }
                  const parsedRows = form.csv
                    .split(/\r?\n/)
                    .filter((line) => line.trim() !== "")
                    .map((line) => line.split(/\t|,/).map((cell) => cell.trim()));
                  if (parsedRows.length < 1) {
                    setSampleAdminError(t("app.sampleFormCsvRequired"));
                    return;
                  }
                  const header = parsedRows[0];
                  const rows = parsedRows.slice(1);
                  const tags = form.tags
                    .split(",")
                    .map((s) => s.trim())
                    .filter(Boolean);
                  setSampleAdminSaving(true);
                  setSampleAdminError(null);
                  const payload = {
                    name,
                    domain: form.domain.trim(),
                    description: form.description.trim(),
                    tags,
                    header,
                    rows,
                  };
                  const result = form.isNew
                    ? await quantisApi.createSampleDatasetAdmin(payload)
                    : await quantisApi.updateSampleDatasetAdmin(form.id, payload);
                  setSampleAdminSaving(false);
                  if ("error" in result) {
                    setSampleAdminError(result.error);
                    return;
                  }
                  setSampleAdminForm(null);
                  await refreshSampleDatasets();
                }}
                className="px-3 py-1.5 rounded-md text-sm font-medium bg-brand text-white hover:opacity-90 disabled:opacity-60"
              >
                {sampleAdminSaving ? t("app.saving") : t("app.save")}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
