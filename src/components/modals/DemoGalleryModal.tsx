import React from "react";
import { X } from "lucide-react";
import { useUIStore, useWorkflowStore, useDataStore } from "@/stores";
import { getDemoWorkflowTemplates } from "@/sample-data";
import { t } from "@/i18n";

export function DemoGalleryModal() {
  const { showDemoGallery, setShowDemoGallery } = useUIStore();
  const { setWorkflows, setSelectedWorkflowId, setSelectedWorkflowStepId } = useWorkflowStore();
  const { setDatasets, setSelectedDatasetId } = useDataStore();

  if (!showDemoGallery) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={() => setShowDemoGallery(false)}
    >
      <div
        className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">
            {t("app.chooseSampleWorkflow")}
          </h2>
          <button
            type="button"
            onClick={() => setShowDemoGallery(false)}
            className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <p className="px-4 pb-3 text-sm text-neutral-500 dark:text-neutral-400">
          {t("app.chooseSampleWorkflowDesc")}
        </p>
        <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
          {getDemoWorkflowTemplates().map((tpl) => (
            <button
              key={tpl.id}
              type="button"
              onClick={() => {
                const { workflow, datasets: newDatasets } = tpl.getWorkflowAndData();
                setWorkflows((prev) => [...prev, workflow]);
                setDatasets((prev) => [...prev, ...newDatasets]);
                setSelectedWorkflowId(workflow.id);
                setSelectedDatasetId(newDatasets[0]?.id ?? null);
                setSelectedWorkflowStepId(null);
                setShowDemoGallery(false);
              }}
              className="text-left p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-600 hover:border-brand/50 hover:bg-brand/5 dark:hover:bg-brand/10 transition-colors"
            >
              <span className="text-xs font-semibold text-brand uppercase tracking-wider">{tpl.domain}</span>
              <p className="font-semibold text-neutral-800 dark:text-neutral-200 mt-1">{tpl.name}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{tpl.description}</p>
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
