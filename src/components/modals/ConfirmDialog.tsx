import React from "react";
import { X } from "lucide-react";
import { useUIStore } from "@/stores";
import { t } from "@/i18n";

export function ConfirmDialog() {
  const { confirmDialog, setConfirmDialog } = useUIStore();

  if (!confirmDialog) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onClick={() => setConfirmDialog(null)}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl max-w-md w-full border border-neutral-200 dark:border-neutral-700 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-end p-2 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
          <button
            type="button"
            onClick={() => setConfirmDialog(null)}
            className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            aria-label={t("app.close")}
          >
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 flex flex-col gap-4">
          <p className="text-neutral-700 dark:text-neutral-300">{confirmDialog.message}</p>
          <div className="flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setConfirmDialog(null)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {t("app.cancel")}
            </button>
            <button
              type="button"
              onClick={() => confirmDialog.onConfirm()}
              className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            >
              {t("app.confirm")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
