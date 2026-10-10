import React, { useState, useEffect } from "react";
import { Server, X, User, Cpu, Sparkles, RotateCcw } from "lucide-react";
import * as quantisApi from "@/api";
import type { AuthUser } from "@/api";
import * as archiveApi from "@/archive-api";
import {
  loadAiModel,
  saveAiModel,
  loadBackendApiUrl,
  saveBackendApiUrl,
  loadArchiveUrl,
  saveArchiveUrl,
  loadArchiveFileUrl,
  saveArchiveFileUrl,
  loadOllamaUpstreamFromServer,
  setServerSettings,
  getServerSettings,
} from "@/utils/storage";
import { useSyncStore, useUIStore } from "@/stores";
import { t } from "@/i18n";

export type SettingsAccountAuthHint =
  | { state: "loading" }
  | { state: "portal" }
  | { state: "no-backend" }
  | { state: "config-unavailable" }
  | { state: "disabled" }
  | { state: "optional" }
  | { state: "required" };

export interface SettingsModalProps {
  /** Giá trị từ GET /api/quantis/settings (đồng bộ khi tải xong). */
  ollamaUpstreamServer?: string | null;
  onClose?: () => void;
  /** Xóa dữ liệu cục bộ + xác nhận đặt lại như mới cài (và đồng bộ rỗng lên server nếu có). */
  onFactoryResetRequest?: () => void;
  /** Trạng thái đăng nhập / tài khoản so với SurveyLab (giải thích vì sao có hoặc không có gate đăng nhập). */
  accountAuthHint?: SettingsAccountAuthHint;
  authUser?: AuthUser | null;
  /** Khi auth tùy chọn và chưa đăng nhập: mở modal đăng nhập. */
  onRequestLogin?: () => void;
}

export function SettingsModal({
  ollamaUpstreamServer: propOllamaUpstreamServer,
  onClose,
  onFactoryResetRequest,
  accountAuthHint: propAccountAuthHint,
  authUser: propAuthUser,
  onRequestLogin,
}: SettingsModalProps) {
  const storeAuthUser = useSyncStore((s) => s.authUser);
  const authUser = propAuthUser !== undefined ? propAuthUser : storeAuthUser;

  const { useBackend, authLoading, authConfig } = useSyncStore();

  const computedAuthHint: SettingsAccountAuthHint =
    useBackend && authLoading
      ? { state: "loading" }
      : quantisApi.isPortalEmbed()
        ? { state: "portal" }
        : !useBackend
          ? { state: "no-backend" }
          : !authConfig
            ? { state: "config-unavailable" }
            : !authConfig.authEnabled
              ? { state: "disabled" }
              : authConfig.authRequired === false
                ? { state: "optional" }
                : { state: "required" };

  const accountAuthHint = propAccountAuthHint ?? computedAuthHint;
  const ollamaUpstreamServer = propOllamaUpstreamServer !== undefined ? propOllamaUpstreamServer : (getServerSettings()?.ollamaUpstreamUrl ?? null);

  const handleClose = () => {
    if (onClose) {
      onClose();
    } else {
      useUIStore.getState().setShowSettings(false);
      quantisApi.checkBackendAvailable().then(useSyncStore.getState().setUseBackend);
      quantisApi.checkAnalysisBackendAvailable().then(useSyncStore.getState().setAnalysisBackendAvailable);
    }
  };

  const handleRequestLogin = () => {
    if (onRequestLogin) {
      onRequestLogin();
    } else {
      useUIStore.getState().setShowSettings(false);
      useUIStore.getState().setLoginModalInitialTab("login");
      useUIStore.getState().setShowLoginModal(true);
    }
  };

  const aiApiBase = quantisApi.getAiApiBase();
  const envModel = (import.meta as { env?: { VITE_QUANTIS_AI_MODEL?: string } }).env?.VITE_QUANTIS_AI_MODEL;
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>(() => loadAiModel() || envModel || quantisApi.getDefaultAiModel());

  const defaultBackendUrl = loadBackendApiUrl() || quantisApi.getApiBase() || "";
  const [backendUrlInput, setBackendUrlInput] = useState(defaultBackendUrl);
  const [backendTestLoading, setBackendTestLoading] = useState(false);
  const [backendTestResult, setBackendTestResult] = useState<{ node: boolean; python: boolean } | null>(null);
  const [quickTestLoading, setQuickTestLoading] = useState(false);

  const defaultArchiveUrl = loadArchiveUrl() || archiveApi.getDefaultArchiveUrl();
  const [archiveUrlInput, setArchiveUrlInput] = useState(defaultArchiveUrl);
  const [archiveTestLoading, setArchiveTestLoading] = useState(false);
  const [archiveTestResult, setArchiveTestResult] = useState<boolean | null>(null);

  const defaultArchiveFileUrl = loadArchiveFileUrl() || archiveApi.getDefaultArchiveFileUrl();
  const [archiveFileUrlInput, setArchiveFileUrlInput] = useState(defaultArchiveFileUrl);
  const [archiveFileTestLoading, setArchiveFileTestLoading] = useState(false);
  const [archiveFileTestResult, setArchiveFileTestResult] = useState<boolean | null>(null);

  const [ollamaUpstreamInput, setOllamaUpstreamInput] = useState(() => loadOllamaUpstreamFromServer() || "");
  const [aiTestLoading, setAiTestLoading] = useState(false);
  const [aiTestResult, setAiTestResult] = useState<boolean | null>(null);
  const [aiModelsKey, setAiModelsKey] = useState(0);

  useEffect(() => {
    setBackendUrlInput(loadBackendApiUrl() || quantisApi.getApiBase() || "");
    setArchiveUrlInput(loadArchiveUrl() || archiveApi.getDefaultArchiveUrl());
    setArchiveFileUrlInput(loadArchiveFileUrl() || archiveApi.getDefaultArchiveFileUrl());
    setOllamaUpstreamInput(loadOllamaUpstreamFromServer() || "");
  }, []);

  useEffect(() => {
    if (ollamaUpstreamServer === undefined || ollamaUpstreamServer === null) return;
    setOllamaUpstreamInput(String(ollamaUpstreamServer).trim());
  }, [ollamaUpstreamServer]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    const backendBase = quantisApi.getApiBase();
    const tryLoad = async () => {
      if (cancelled) return;
      if (backendBase) {
        try {
          const list = await quantisApi.getOllamaModelsViaProxy(backendBase);
          if (!cancelled) {
            setModels(list);
            const stored = loadAiModel();
            if (stored && list.includes(stored)) setSelectedModel(stored);
            else if (envModel && list.includes(envModel)) setSelectedModel(envModel);
            else if (list.length > 0 && !loadAiModel()) {
              const def = quantisApi.getDefaultAiModel();
              setSelectedModel(list.includes(def) ? def : list[0]);
            }
            setLoading(false);
            return;
          }
        } catch {
          /* im lặng */
        }
        if (!cancelled) {
          setModels([]);
          setLoading(false);
        }
        return;
      }
      quantisApi.getOllamaModels(aiApiBase).then((list) => {
        if (cancelled) return;
        setModels(list);
        setLoading(false);
        const stored = loadAiModel();
        if (stored && list.includes(stored)) setSelectedModel(stored);
        else if (envModel && list.includes(envModel)) setSelectedModel(envModel);
        else if (list.length > 0 && !loadAiModel()) {
          const def = quantisApi.getDefaultAiModel();
          setSelectedModel(list.includes(def) ? def : list[0]);
        }
      }).catch(() => { if (!cancelled) setLoading(false); });
    };
    void tryLoad();
    return () => { cancelled = true; };
  }, [aiApiBase, aiModelsKey, envModel]);

  const handleChange = (value: string) => {
    setSelectedModel(value);
    saveAiModel(value || null);
    saveSettingsToServer({ defaultAiModel: value || null });
  };

  /**
   * Chỉ gửi lên server đúng (các) trường được truyền vào `patch` — KHÔNG dựng lại cả khối
   * settings từ state input hiện tại. Trước đây dựng lại cả khối (kể cả khi chỉ đổi model ở
   * dropdown) đã vô tình ghi đè ollamaUpstreamUrl/archiveUrl/... dùng chung toàn hệ thống về
   * rỗng mỗi khi các ô input local (vd ollamaUpstreamInput) chưa kịp nạp giá trị hiện có —
   * gây mất cấu hình Ollama dùng chung nhiều lần trong thực tế.
   */
  const saveSettingsToServer = async (patch: Partial<import("@/utils/storage").ServerSettings>) => {
    const base = backendUrlInput.trim().replace(/\/+$/, "") || quantisApi.getApiBase();
    if (!base) return;
    const ok = await quantisApi.putQuantisSettings(patch, base);
    if (ok) setServerSettings({ ...(getServerSettings() ?? {}), ...patch });
  };

  const handleSaveBackendUrl = () => {
    const url = backendUrlInput.trim().replace(/\/+$/, "");
    if (url) saveBackendApiUrl(url);
    else saveBackendApiUrl(null);
    setBackendTestResult(null);
    saveSettingsToServer({ backendApiUrl: url || null });
  };

  const handleSaveArchiveUrl = () => {
    const url = archiveUrlInput.trim().replace(/\/+$/, "");
    if (url) saveArchiveUrl(url);
    else saveArchiveUrl(null);
    setArchiveTestResult(null);
    saveSettingsToServer({ archiveUrl: url || null });
  };

  const handleSaveArchiveFileUrl = () => {
    const url = archiveFileUrlInput.trim().replace(/\/+$/, "");
    if (url) saveArchiveFileUrl(url);
    else saveArchiveFileUrl(null);
    setArchiveFileTestResult(null);
    saveSettingsToServer({ archiveFileUrl: url || null });
  };

  const handleSaveOllamaUpstream = () => {
    setAiTestResult(null);
    setAiModelsKey((k) => k + 1);
    const ou = ollamaUpstreamInput.trim().replace(/\/+$/, "").replace(/\/v1$/i, "") || null;
    void saveSettingsToServer({ ollamaUpstreamUrl: ou });
  };

  const effectiveBackendUrl = (): string =>
    backendUrlInput.trim().replace(/\/+$/, "") || quantisApi.getApiBase() || "";

  const canTestOllama = Boolean(effectiveBackendUrl().trim());

  const pageIsLocalDev =
    typeof window !== "undefined" &&
    ["localhost", "127.0.0.1"].includes(window.location.hostname.toLowerCase());
  const backendHostIsRemote = (() => {
    const raw = effectiveBackendUrl().replace(/\/+$/, "");
    if (!raw) return false;
    try {
      const h = new URL(raw).hostname.toLowerCase();
      return h !== "localhost" && h !== "127.0.0.1" && h !== "[::1]";
    } catch {
      return false;
    }
  })();

  const handleTestBackend = async () => {
    const url = effectiveBackendUrl() || undefined;
    if (!url) return;
    setBackendTestLoading(true);
    setBackendTestResult(null);
    try {
      const [nodeOk, pythonOk] = await Promise.all([
        quantisApi.checkBackendAvailable(url),
        quantisApi.checkAnalysisBackendAvailable(url),
      ]);
      setBackendTestResult({ node: nodeOk, python: pythonOk });
    } finally {
      setBackendTestLoading(false);
    }
  };

  const handleTestArchive = async () => {
    setArchiveTestLoading(true);
    setArchiveTestResult(null);
    try {
      const url = archiveUrlInput.trim() || undefined;
      const ok = await archiveApi.checkArchiveApiAvailable(url);
      setArchiveTestResult(ok);
    } finally {
      setArchiveTestLoading(false);
    }
  };

  const handleTestArchiveFile = async () => {
    setArchiveFileTestLoading(true);
    setArchiveFileTestResult(null);
    try {
      const url = archiveFileUrlInput.trim() || undefined;
      const ok = await archiveApi.checkArchiveFileBaseAvailable(url);
      setArchiveFileTestResult(ok);
    } finally {
      setArchiveFileTestLoading(false);
    }
  };

  const handleTestAiApi = async () => {
    setAiTestLoading(true);
    setAiTestResult(null);
    try {
      const proxyBase = effectiveBackendUrl().replace(/\/+$/, "");
      if (!proxyBase) {
        setAiTestResult(false);
        return;
      }
      const proxyOk = await quantisApi.checkOllamaProxyAvailable(proxyBase);
      setAiTestResult(proxyOk);
      if (proxyOk) setAiModelsKey((k) => k + 1);
    } finally {
      setAiTestLoading(false);
    }
  };

  const handleQuickTestConnectivity = async () => {
    if (!effectiveBackendUrl()) return;
    setQuickTestLoading(true);
    setBackendTestResult(null);
    setAiTestResult(null);
    try {
      const b = effectiveBackendUrl();
      if (b) {
        const [nodeOk, pythonOk] = await Promise.all([
          quantisApi.checkBackendAvailable(b),
          quantisApi.checkAnalysisBackendAvailable(b),
        ]);
        setBackendTestResult({ node: nodeOk, python: pythonOk });
      }
      setAiTestLoading(true);
      try {
        const proxyBase = effectiveBackendUrl().replace(/\/+$/, "");
        const proxyOk = proxyBase ? await quantisApi.checkOllamaProxyAvailable(proxyBase) : false;
        setAiTestResult(proxyOk);
        if (proxyOk) setAiModelsKey((k) => k + 1);
      } finally {
        setAiTestLoading(false);
      }
    } finally {
      setQuickTestLoading(false);
    }
  };

  const rowClass = "space-y-1";
  const labelClass = "text-xs font-medium text-neutral-700 dark:text-neutral-300";
  const hintClass = "text-[11px] text-neutral-500 dark:text-neutral-400";
  const inputRowClass = "flex flex-wrap items-center gap-2";
  const inputClass = "flex-1 min-w-[140px] rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-xs";
  const btnClass = "rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1.5 text-xs whitespace-nowrap";
  const testBtnClass = "rounded bg-brand text-white px-2 py-1.5 text-xs whitespace-nowrap hover:opacity-90 disabled:opacity-50";

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-2 sm:p-4" role="presentation">
      <div
        className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full max-h-[min(90vh,85dvh)] flex flex-col overflow-hidden"
        role="dialog"
        aria-labelledby="quantis-settings-title"
        aria-describedby="quantis-settings-desc"
      >
        <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
          <div className="min-w-0 pr-2">
            <h3 id="quantis-settings-title" className="text-base font-semibold flex items-center gap-2 text-neutral-800 dark:text-neutral-200">
              <Server className="w-4 h-4 shrink-0 text-brand" /> {t("app.connectionSettings")}
            </h3>
            <p id="quantis-settings-desc" className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1">
              {t("settingsModal.descPrefix")} <strong>{t("settingsModal.descStrong")}</strong> {t("settingsModal.descSuffix")}
            </p>
          </div>
          <button type="button" onClick={handleClose} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 shrink-0" aria-label={t("app.close")}>
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="p-4 overflow-y-auto">
        <div className="mb-3 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-900/50 px-3 py-2.5">
          <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 flex items-center gap-2">
            <User className="w-3.5 h-3.5 shrink-0 text-brand" />
            {t("settingsModal.accountLoginHeading")}
          </p>
          {accountAuthHint.state === "loading" && (
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-1.5">{t("settingsModal.accountLoading")}</p>
          )}
          {accountAuthHint.state === "portal" && (
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1.5">
              {t("settingsModal.accountPortalPrefix")} <strong>{t("guideModal.tabPortal")}</strong>{t("settingsModal.accountPortalSuffix")}
            </p>
          )}
          {accountAuthHint.state === "no-backend" && (
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1.5">
              {t("settingsModal.accountNoBackend")}
            </p>
          )}
          {accountAuthHint.state === "config-unavailable" && (
            <p className="text-[11px] text-amber-800 dark:text-amber-200 mt-1.5">
              {t("settingsModal.accountConfigUnavailable")}
            </p>
          )}
          {accountAuthHint.state === "disabled" && (
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1.5">
              {t("settingsModal.accountDisabled")}
            </p>
          )}
          {accountAuthHint.state === "optional" && (
            <div className="mt-1.5 space-y-1.5">
              <p className="text-[11px] text-neutral-600 dark:text-neutral-400">
                {t("settingsModal.accountOptionalText")}
              </p>
              {!authUser && (
                <button type="button" onClick={handleRequestLogin} className="text-xs font-medium text-brand hover:underline">
                  {t("settingsModal.accountOptionalLoginLink")}
                </button>
              )}
              {authUser && (
                <p className="text-[11px] text-emerald-700 dark:text-emerald-400">{t("settingsModal.accountLoggedInPrefix")} {authUser.email || authUser.name || "—"}</p>
              )}
            </div>
          )}
          {accountAuthHint.state === "required" && (
            <p className="text-[11px] text-neutral-600 dark:text-neutral-400 mt-1.5">
              {t("settingsModal.accountRequiredText")}
            </p>
          )}
        </div>
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mb-3">
          {t("settingsModal.saveNote")}
        </p>
        <div className="mb-4 flex flex-col gap-2 rounded-lg border border-brand/25 bg-brand/5 dark:bg-brand/10 px-3 py-2.5 sm:flex-row sm:items-center sm:justify-between">
          <div className="min-w-0">
            <p className="text-xs font-semibold text-neutral-800 dark:text-neutral-200">{t("settingsModal.quickTestHeading")}</p>
            <p className="text-[11px] text-neutral-500 dark:text-neutral-400">{t("settingsModal.quickTestDesc")}</p>
          </div>
          <button
            type="button"
            onClick={handleQuickTestConnectivity}
            disabled={quickTestLoading || !effectiveBackendUrl()}
            className="shrink-0 rounded-lg bg-brand px-3 py-2 text-xs font-semibold text-white hover:opacity-90 disabled:opacity-50"
          >
            {quickTestLoading ? t("settingsModal.testingEllipsis") : t("settingsModal.quickTestButton")}
          </button>
        </div>
        <div className="space-y-5 text-sm">
          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-brand mb-2 flex items-center gap-2">
              <Cpu className="w-3.5 h-3.5" /> {t("settingsModal.backendSectionHeading")}
            </h4>
          <div className={rowClass}>
            <label className={labelClass}>{t("settingsModal.backendUrlLabel")}</label>
            <p className={hintClass}>{t("settingsModal.backendUrlHint")}</p>
            <div className={inputRowClass}>
              <input type="url" value={backendUrlInput} onChange={(e) => { setBackendUrlInput(e.target.value); setBackendTestResult(null); }} onBlur={handleSaveBackendUrl} placeholder="http://localhost:4001" className={inputClass} />
              <button type="button" onClick={handleSaveBackendUrl} className={btnClass}>{t("settingsModal.saveButton")}</button>
              <button type="button" onClick={handleTestBackend} disabled={backendTestLoading || !effectiveBackendUrl()} className={testBtnClass}>{backendTestLoading ? t("settingsModal.checkingEllipsis") : t("settingsModal.checkBackendButton")}</button>
            </div>
            {backendTestResult !== null && (
              <p className={backendTestResult.node ? "text-emerald-600 dark:text-emerald-400 text-xs" : "text-amber-600 dark:text-amber-400 text-xs"}>
                {backendTestResult.node ? t("settingsModal.nodeOkText") : t("settingsModal.nodeErrorText")}
                {backendTestResult.python ? ` ${t("settingsModal.pythonOkSuffix")}` : ` ${t("settingsModal.pythonNotConfiguredSuffix")}`}
              </p>
            )}
            {backendTestResult !== null && !backendTestResult.python && (
              <p className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">{t("settingsModal.pythonOptionalNote")}</p>
            )}
          </div>
          <div className={rowClass}>
            <label className={labelClass}>{t("settingsModal.archiveLabel")}</label>
            <p className={hintClass}>{t("settingsModal.archiveHint")}</p>
            <div className={inputRowClass}>
              <input type="url" value={archiveUrlInput} onChange={(e) => setArchiveUrlInput(e.target.value)} onBlur={handleSaveArchiveUrl} placeholder="http://host:8010" className={inputClass} />
              <button type="button" onClick={handleSaveArchiveUrl} className={btnClass}>{t("settingsModal.saveButton")}</button>
              <button type="button" onClick={handleTestArchive} disabled={archiveTestLoading} className={testBtnClass}>{archiveTestLoading ? t("settingsModal.checkingEllipsis") : t("settingsModal.checkButton")}</button>
            </div>
            {archiveTestResult !== null && <p className={archiveTestResult ? "text-emerald-600 dark:text-emerald-400 text-xs" : "text-amber-600 dark:text-amber-400 text-xs"}>{archiveTestResult ? t("settingsModal.okText") : t("settingsModal.errorText")}</p>}
          </div>
          <div className={rowClass}>
            <label className={labelClass}>{t("settingsModal.archiveFileLabel")}</label>
            <p className={hintClass}>{t("settingsModal.archiveFileHint")}</p>
            <div className={inputRowClass}>
              <input type="url" value={archiveFileUrlInput} onChange={(e) => setArchiveFileUrlInput(e.target.value)} onBlur={handleSaveArchiveFileUrl} placeholder="http://host:8013" className={inputClass} />
              <button type="button" onClick={handleSaveArchiveFileUrl} className={btnClass}>{t("settingsModal.saveButton")}</button>
              <button type="button" onClick={handleTestArchiveFile} disabled={archiveFileTestLoading} className={testBtnClass}>{archiveFileTestLoading ? t("settingsModal.checkingEllipsis") : t("settingsModal.checkButton")}</button>
            </div>
            {archiveFileTestResult !== null && <p className={archiveFileTestResult ? "text-emerald-600 dark:text-emerald-400 text-xs" : "text-amber-600 dark:text-amber-400 text-xs"}>{archiveFileTestResult ? t("settingsModal.okText") : t("settingsModal.errorText")}</p>}
          </div>
          </div>

          <div>
            <h4 className="text-xs font-semibold uppercase tracking-wide text-brand mb-2 flex items-center gap-2">
              <Sparkles className="w-3.5 h-3.5" /> {t("settingsModal.ollamaSectionHeading")}
            </h4>
          <div className={rowClass}>
            <label className={labelClass}>{t("settingsModal.ollamaUpstreamLabel")}</label>
            <p className={hintClass}>
              {t("settingsModal.ollamaUpstreamHint")}
            </p>
            <div className={inputRowClass}>
              <input
                type="url"
                value={ollamaUpstreamInput}
                onChange={(e) => setOllamaUpstreamInput(e.target.value)}
                onBlur={handleSaveOllamaUpstream}
                placeholder="http://127.0.0.1:8000"
                className={inputClass}
              />
              <button type="button" onClick={handleSaveOllamaUpstream} className={btnClass}>{t("settingsModal.saveButton")}</button>
              <button type="button" onClick={handleTestAiApi} disabled={aiTestLoading || !canTestOllama} className={testBtnClass} title={!canTestOllama ? t("settingsModal.needBackendUrlTitle") : undefined}>{aiTestLoading ? t("settingsModal.checkingEllipsis") : t("settingsModal.checkOllamaButton")}</button>
            </div>
            {aiTestResult !== null && (
              <div className="space-y-1">
                <p className={aiTestResult ? "text-emerald-600 dark:text-emerald-400 text-xs" : "text-amber-600 dark:text-amber-400 text-xs"}>
                  {aiTestResult ? t("settingsModal.proxyOkText") : t("settingsModal.proxyErrorText")}
                </p>
                {!aiTestResult && pageIsLocalDev && backendHostIsRemote ? (
                  <p className="text-[11px] leading-snug text-amber-800 dark:text-amber-200/95">
                    {t("settingsModal.localDevRemoteBackendWarning")}
                  </p>
                ) : null}
              </div>
            )}
          </div>
          <div className={rowClass}>
            <label className={labelClass}>{t("settingsModal.aiModelLabel")}</label>
            <p className={hintClass}>{t("settingsModal.aiModelHint")}</p>
            {loading ? (
              <p className="text-xs text-neutral-500">{t("settingsModal.loadingModelsText")}</p>
            ) : models.length > 0 ? (
              <div className="flex flex-wrap items-center gap-2">
                <select value={selectedModel} onChange={(e) => handleChange(e.target.value)} className={`${inputClass} max-w-[200px]`} title={t("settingsModal.selectModelTitle")}>
                  {models.map((m) => <option key={m} value={m}>{m}</option>)}
                </select>
                {selectedModel && <span className="text-xs text-neutral-500">{t("settingsModal.currentlyUsingPrefix")} {selectedModel}</span>}
              </div>
            ) : (
              <p className="text-xs text-amber-600 dark:text-amber-400">{t("settingsModal.noModelsListText")}</p>
            )}
          </div>
          </div>

          <div className="mt-6 rounded-lg border border-red-200 dark:border-red-900/60 bg-red-50/70 dark:bg-red-950/25 p-3 sm:p-4">
            <h4 className="text-xs font-semibold uppercase tracking-wide text-red-800 dark:text-red-300 mb-2 flex items-center gap-2">
              <RotateCcw className="w-3.5 h-3.5 shrink-0" /> {t("settingsModal.resetHeading")}
            </h4>
            <p className="text-[11px] text-red-900/80 dark:text-red-200/90 mb-3">
              {t("settingsModal.resetWarningPart1")}
              {" "}{t("settingsModal.resetWarningPart2")}
            </p>
            <button
              type="button"
              onClick={() => onFactoryResetRequest?.()}
              className="w-full sm:w-auto rounded-lg border-2 border-red-400 dark:border-red-700 bg-white dark:bg-neutral-900 text-red-800 dark:text-red-200 px-4 py-2.5 text-sm font-semibold hover:bg-red-100 dark:hover:bg-red-950/60 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-offset-2 dark:focus-visible:ring-offset-neutral-900"
            >
              {t("settingsModal.resetButton")}
            </button>
          </div>
        </div>
        </div>
        <div className="p-4 border-t border-neutral-200 dark:border-neutral-700 shrink-0">
          <button type="button" onClick={handleClose} className="rounded-lg bg-brand text-white px-4 py-2 text-sm hover:opacity-90">{t("app.close")}</button>
        </div>
      </div>
    </div>
  );
}
