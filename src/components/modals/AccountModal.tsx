import React from "react";
import { User, X, Settings, LogOut } from "lucide-react";
import { useUIStore, useSyncStore, useDataStore, useWorkflowStore } from "@/stores";
import * as quantisApi from "@/api";
import { t } from "@/i18n";

export function AccountModal() {
  const { showAccountDialog, setShowAccountDialog, setShowSettings, showToast } = useUIStore();
  const { authUser, setAuthUser } = useSyncStore();

  if (!showAccountDialog || !authUser) return null;

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
      onClick={() => setShowAccountDialog(false)}
    >
      <div
        className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full max-w-md shadow-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
              <User className="h-5 w-5" />
            </span>
            {t("app.account")}
          </h2>
          <button
            type="button"
            onClick={() => setShowAccountDialog(false)}
            className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
            aria-label={t("app.close")}
          >
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="p-4 space-y-4">
          <div className="space-y-1">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("app.fullName")}</p>
            <p className="text-sm text-neutral-800 dark:text-neutral-100">{authUser.name || "—"}</p>
          </div>
          <div className="space-y-1">
            <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Email</p>
            <p className="text-sm text-neutral-800 dark:text-neutral-100 break-all">{authUser.email}</p>
          </div>
          <div className="flex flex-col gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => {
                setShowAccountDialog(false);
                setShowSettings(true);
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
            >
              <Settings className="h-4 w-4 shrink-0" />
              {t("app.connectionSettingsBackendOllama")}
            </button>
            <button
              type="button"
              onClick={async () => {
                await quantisApi.authLogout();
                setAuthUser(null);
                setShowAccountDialog(false);
                void useDataStore.persist.rehydrate();
                void useWorkflowStore.persist.rehydrate();
                showToast(t("app.toastLoggedOut"));
              }}
              className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
            >
              <LogOut className="h-4 w-4" />
              {t("app.logout")}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
