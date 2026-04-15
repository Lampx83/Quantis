/**
 * Màn hình / modal đăng nhập — cùng luồng SurveyLab, style Quantis.
 */
import React, { useState, useEffect } from "react";
import { Sigma, Mail, Lock, User, Globe, X } from "lucide-react";
import { authLogin, authRegister, type AuthConfig, type AuthUser } from "./api";

export function QuantAuthGate({
  config,
  onSuccess,
  ssoUrl,
  subtitle,
}: {
  config: AuthConfig;
  onSuccess: (user: AuthUser) => void;
  ssoUrl: string;
  subtitle?: string;
}) {
  const [tab, setTab] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const ssoError = typeof window !== "undefined" && new URLSearchParams(window.location.search).get("sso_error") === "1";

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authLogin({ email: email.trim(), password });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSuccess(result.user);
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Mật khẩu tối thiểu 6 ký tự");
      return;
    }
    setLoading(true);
    try {
      const result = await authRegister({ email: email.trim(), password, name: name.trim() || undefined });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSuccess(result.user);
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent";
  const labelClass = "flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 mb-1";

  return (
    <div className="min-h-dvh bg-neutral-100 dark:bg-neutral-900 flex items-center justify-center p-3 sm:p-4 pt-[max(0.75rem,env(safe-area-inset-top,0px))] pb-[max(0.75rem,env(safe-area-inset-bottom,0px))]">
      <div className="w-full max-w-md min-w-0">
        <div className="flex items-center justify-center gap-2.5 mb-8">
          <span className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand/15 text-brand">
            <Sigma className="h-7 w-7" />
          </span>
          <div>
            <h1 className="text-xl font-semibold text-neutral-900 dark:text-neutral-100">Quantis</h1>
            {subtitle && <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">{subtitle}</p>}
            {!subtitle && (
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-1">Đăng nhập để đồng bộ workspace lên tài khoản</p>
            )}
          </div>
        </div>
        <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 sm:p-6 shadow-lg">
          <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-600 p-0.5 mb-4">
            <button
              type="button"
              onClick={() => {
                setTab("login");
                setError(null);
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === "login" ? "bg-brand text-white" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/80"
              }`}
            >
              Đăng nhập
            </button>
            <button
              type="button"
              onClick={() => {
                setTab("register");
                setError(null);
              }}
              className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
                tab === "register" ? "bg-brand text-white" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/80"
              }`}
            >
              Đăng ký
            </button>
          </div>
          {ssoError && (
            <p className="text-sm text-amber-600 dark:text-amber-400 mb-3">Đăng nhập SSO thất bại. Thử lại hoặc dùng email/mật khẩu.</p>
          )}
          {config.ssoEnabled && ssoUrl && (
            <div className="mb-4">
              <a
                href={ssoUrl}
                className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 text-sm font-medium transition-colors"
              >
                <Globe className="h-4 w-4" />
                {config.ssoLabel}
              </a>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 text-center">hoặc</p>
            </div>
          )}
          {tab === "login" ? (
            <form onSubmit={handleLogin} className="space-y-4">
              <div>
                <label className={labelClass}>
                  <Mail className="h-3.5 w-3.5 text-neutral-500" /> Email
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="you@example.com" />
              </div>
              <div>
                <label className={labelClass}>
                  <Lock className="h-3.5 w-3.5 text-neutral-500" /> Mật khẩu
                </label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} placeholder="••••••••" />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {loading ? "Đang xử lý…" : "Đăng nhập"}
              </button>
            </form>
          ) : (
            <form onSubmit={handleRegister} className="space-y-4">
              <div>
                <label className={labelClass}>
                  <Mail className="h-3.5 w-3.5 text-neutral-500" /> Email
                </label>
                <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="you@example.com" />
              </div>
              <div>
                <label className={labelClass}>
                  <User className="h-3.5 w-3.5 text-neutral-500" /> Họ tên (tùy chọn)
                </label>
                <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Nguyễn Văn A" />
              </div>
              <div>
                <label className={labelClass}>
                  <Lock className="h-3.5 w-3.5 text-neutral-500" /> Mật khẩu (tối thiểu 6 ký tự)
                </label>
                <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputClass} placeholder="••••••••" />
              </div>
              {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
              <button
                type="submit"
                disabled={loading}
                className="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 disabled:opacity-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {loading ? "Đang xử lý…" : "Đăng ký"}
              </button>
            </form>
          )}
        </div>
      </div>
    </div>
  );
}

export function QuantLoginModal({
  config,
  ssoUrl,
  onSuccess,
  onClose,
  initialTab = "login",
}: {
  config: AuthConfig;
  ssoUrl: string;
  onSuccess: (user: AuthUser) => void;
  onClose: () => void;
  /** Tab mở khi mở modal (Đăng nhập / Đăng ký từ header hoặc status bar). */
  initialTab?: "login" | "register";
}) {
  const [tab, setTab] = useState<"login" | "register">(initialTab);
  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    try {
      const result = await authLogin({ email: email.trim(), password });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSuccess(result.user);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    if (password.length < 6) {
      setError("Mật khẩu tối thiểu 6 ký tự");
      return;
    }
    setLoading(true);
    try {
      const result = await authRegister({ email: email.trim(), password, name: name.trim() || undefined });
      if ("error" in result) {
        setError(result.error);
        return;
      }
      onSuccess(result.user);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const inputClass =
    "w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus:outline-none focus:ring-2 focus:ring-brand focus:border-transparent";
  const labelClass = "flex items-center gap-1.5 text-xs font-medium text-neutral-700 dark:text-neutral-200 mb-1";

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center p-3 sm:p-4 bg-black/40 backdrop-blur-sm" onClick={onClose}>
      <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 max-w-md w-full max-h-[min(90dvh,100vh)] overflow-y-auto overscroll-contain shadow-xl p-4 sm:p-6 min-w-0" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
            <User className="h-5 w-5" />
            Đăng nhập / Đăng ký
          </h2>
          <button type="button" onClick={onClose} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700" aria-label="Đóng">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex rounded-lg border border-neutral-200 dark:border-neutral-600 p-0.5 mb-4">
          <button
            type="button"
            onClick={() => {
              setTab("login");
              setError(null);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "login" ? "bg-brand text-white" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/80"
            }`}
          >
            Đăng nhập
          </button>
          <button
            type="button"
            onClick={() => {
              setTab("register");
              setError(null);
            }}
            className={`flex-1 py-2 text-sm font-medium rounded-md transition-colors ${
              tab === "register" ? "bg-brand text-white" : "text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700/80"
            }`}
          >
            Đăng ký
          </button>
        </div>
        {config.ssoEnabled && ssoUrl && (
          <div className="mb-4">
            <a
              href={ssoUrl}
              className="flex items-center justify-center gap-2 w-full py-2.5 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 text-sm font-medium"
            >
              <Globe className="h-4 w-4" />
              {config.ssoLabel}
            </a>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2 text-center">hoặc</p>
          </div>
        )}
        {tab === "login" ? (
          <form onSubmit={handleLogin} className="space-y-4">
            <div>
              <label className={labelClass}>
                <Mail className="h-3.5 w-3.5" /> Email
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="you@example.com" />
            </div>
            <div>
              <label className={labelClass}>
                <Lock className="h-3.5 w-3.5" /> Mật khẩu
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required className={inputClass} placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-50">
              {loading ? "Đang xử lý…" : "Đăng nhập"}
            </button>
          </form>
        ) : (
          <form onSubmit={handleRegister} className="space-y-4">
            <div>
              <label className={labelClass}>
                <Mail className="h-3.5 w-3.5" /> Email
              </label>
              <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required className={inputClass} placeholder="you@example.com" />
            </div>
            <div>
              <label className={labelClass}>
                <User className="h-3.5 w-3.5" /> Họ tên (tùy chọn)
              </label>
              <input type="text" value={name} onChange={(e) => setName(e.target.value)} className={inputClass} placeholder="Nguyễn Văn A" />
            </div>
            <div>
              <label className={labelClass}>
                <Lock className="h-3.5 w-3.5" /> Mật khẩu (tối thiểu 6 ký tự)
              </label>
              <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} className={inputClass} placeholder="••••••••" />
            </div>
            {error && <p className="text-sm text-red-600 dark:text-red-400">{error}</p>}
            <button type="submit" disabled={loading} className="w-full py-2.5 rounded-lg bg-brand text-white text-sm font-medium disabled:opacity-50">
              {loading ? "Đang xử lý…" : "Đăng ký"}
            </button>
          </form>
        )}
      </div>
    </div>
  );
}
