import React, { useState } from "react";
import { FileText, X } from "lucide-react";
import { saveAppFeedback } from "@/utils/storage";
import { useUIStore } from "@/stores";
import { t } from "@/i18n";

export interface AppFeedbackModalProps {
  onClose?: () => void;
}

export function AppFeedbackModal({ onClose }: AppFeedbackModalProps) {
  const close = onClose ?? (() => useUIStore.getState().setShowAppFeedbackModal(false));
  const [content, setContent] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (trimmed.length < 5) return;
    setSending(true);
    saveAppFeedback(trimmed);
    setSending(false);
    setSent(true);
    setContent("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={close}>
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-md w-full mx-4 flex flex-col max-h-[90vh] overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
          <h3 className="text-lg font-semibold flex items-center gap-2 text-neutral-800 dark:text-neutral-200">
            <FileText className="w-5 h-5" /> {t("app.appFeedback")}
          </h3>
          <button type="button" onClick={close} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700" aria-label={t("app.close")}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-6 overflow-y-auto">
        {sent ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">{t("appFeedbackModal.sentThanks")}</p>
        ) : (
          <>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">{t("appFeedbackModal.description")}</p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder={t("appFeedbackModal.contentPlaceholder")}
              rows={4}
              maxLength={4000}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm resize-none mb-3"
            />
            <p className="text-xs text-neutral-500 mb-3">{content.length}/4000</p>
            <div className="flex gap-2">
              <button type="button" onClick={handleSubmit} disabled={content.trim().length < 5 || sending} className="rounded-lg bg-amber-500 text-white px-4 py-2 hover:bg-amber-600 disabled:opacity-50">{t("appFeedbackModal.sendButton")}</button>
              <button type="button" onClick={close} className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700">{t("app.close")}</button>
            </div>
          </>
        )}
        {sent && <button type="button" onClick={close} className="mt-2 rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">{t("app.close")}</button>}
        </div>
      </div>
    </div>
  );
}
