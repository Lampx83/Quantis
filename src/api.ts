/**
 * Quantis API client: gọi backend Quantis khi nhúng Portal (có đăng nhập).
 * Khi backend không có hoặc chưa đăng nhập: dữ liệu chỉ lưu localStorage.
 * Phân tích: nếu có backend Python (proxy qua Node), gọi API phân tích thay vì tính trên client.
 */
import type { Dataset, Workflow } from "./types";
import type { MediationResult } from "./utils/stats";
import { loadBackendApiUrl } from "./store";

/** Base URL backend Quantis (để hiển thị trong Cài đặt). Mặc định research.neu.edu.vn */
const RESEARCH_NEU_HOST = "research.neu.edu.vn";
const RESEARCH_NEU_BACKEND = "https://research.neu.edu.vn/api/quantis/backend";
const RESEARCH_NEU_BACKEND_PYTHON = "https://research.neu.edu.vn/api/quantis/backend-python";
const RESEARCH_NEU_DEFAULT_MODEL = "qwen3:8b";

function isResearchNeu(): boolean {
  return typeof window !== "undefined" && window.location.hostname.toLowerCase() === RESEARCH_NEU_HOST;
}

function isLoopbackHost(hostname: string): boolean {
  const h = String(hostname || "").toLowerCase();
  return h === "localhost" || h === "127.0.0.1" || h === "[::1]";
}

/** Không dùng base URL dev (localhost) khi trang đang trên domain thật — tránh POST tới máy người dùng. */
function shouldDiscardBackendBase(url: string | null | undefined): boolean {
  if (url == null || String(url).trim() === "") return false;
  if (typeof window === "undefined") return false;
  if (isLoopbackHost(window.location.hostname)) return false;
  try {
    const s = String(url).trim();
    const u = new URL(/^(https?:)?\/\//i.test(s) || s.startsWith("http://") || s.startsWith("https://") ? s : `https://${s}`);
    return isLoopbackHost(u.hostname);
  } catch {
    return false;
  }
}

function getBase(): string {
  const stored = loadBackendApiUrl();
  const env = (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_QUANTIS_API_URL?: string } }).env?.VITE_QUANTIS_API_URL) || "";
  let candidate = (stored != null && String(stored).trim() !== "") ? stored : env;
  if (shouldDiscardBackendBase(candidate)) candidate = "";
  const base = String(candidate).replace(/\/+$/, "");
  if (base) return base;
  if (isResearchNeu()) return RESEARCH_NEU_BACKEND;
  return "";
}

/** Base URL backend Quantis (để hiển thị trong Cài đặt). */
export function getApiBase(): string {
  return getBase();
}

// ——— Auth (giống SurveyLab / Portal): session cookie, lưu workspace theo tài khoản khi backend bật QUANTIS_AUTH_ENABLED ———

export interface AuthConfig {
  authEnabled: boolean;
  ssoEnabled: boolean;
  ssoLabel: string;
  authRequired: boolean;
}

export interface AuthUser {
  id: string;
  email: string;
  name?: string;
  isAdmin?: boolean;
}

function getAuthPrefix(): string {
  const b = getBase();
  if (!b || String(b).trim() === "") return "";
  return `${String(b).replace(/\/+$/, "")}/api/quantis/auth`;
}

/** Khi backend tắt auth hoặc không phản hồi: null. */
export async function getAuthConfig(): Promise<AuthConfig | null> {
  const prefix = getAuthPrefix();
  if (!prefix) return null;
  try {
    const res = await fetch(`${prefix}/config`, { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    return await res.json();
  } catch {
    return null;
  }
}

export async function getAuthMe(): Promise<AuthUser | null> {
  const prefix = getAuthPrefix();
  if (!prefix) return null;
  try {
    const res = await fetch(`${prefix}/me`, { credentials: "include", cache: "no-store" });
    if (!res.ok) return null;
    const data = await res.json();
    return data.user ?? null;
  } catch {
    return null;
  }
}

export async function authRegister(params: {
  email: string;
  password: string;
  name?: string;
}): Promise<{ user: AuthUser } | { error: string }> {
  const prefix = getAuthPrefix();
  if (!prefix) return { error: "Chưa cấu hình backend" };
  try {
    const res = await fetch(`${prefix}/register`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "Đăng ký thất bại" };
    return { user: data.user };
  } catch {
    return { error: "Lỗi kết nối" };
  }
}

export async function authLogin(params: { email: string; password: string }): Promise<{ user: AuthUser } | { error: string }> {
  const prefix = getAuthPrefix();
  if (!prefix) return { error: "Chưa cấu hình backend" };
  try {
    const res = await fetch(`${prefix}/login`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(params),
    });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) return { error: data.error || "Đăng nhập thất bại" };
    return { user: data.user };
  } catch {
    return { error: "Lỗi kết nối" };
  }
}

export async function authLogout(): Promise<void> {
  const prefix = getAuthPrefix();
  if (!prefix) return;
  try {
    await fetch(`${prefix}/logout`, { method: "POST", credentials: "include" });
  } catch {
    /* ignore */
  }
}

/** URL mở SSO (redirect ngoài) khi backend cấu hình QUANTIS_SSO_REDIRECT_URL. */
export function getSsoLoginUrl(): string {
  const prefix = getAuthPrefix();
  if (!prefix) return "";
  return `${prefix}/sso`;
}

type PortalGlobals = Window & {
  __WRITE_API_BASE__?: string;
  __PORTAL_USER__?: { id?: string };
  __QUANTIS_PORTAL_EMBED__?: boolean;
  __PORTAL_BASE_PATH__?: string;
};

/**
 * Đang chạy trong ngữ cảnh AI Portal (embed), không dùng form đăng nhập Quantis standalone.
 * Nhận diện theo (bất kỳ): Writium `__WRITE_API_BASE__`, user inject `__PORTAL_USER__`, cờ `__QUANTIS_PORTAL_EMBED__`,
 * iframe + `__PORTAL_BASE_PATH__`, hoặc URL chứa `/embed/quantis` (gói cài Portal).
 * Portal có thể set `window.__QUANTIS_PORTAL_EMBED__ = true` nếu không dùng các tín hiệu trên.
 */
export function isPortalEmbed(): boolean {
  if (typeof window === "undefined") return false;
  const w = window as PortalGlobals;
  if (w.__QUANTIS_PORTAL_EMBED__ === false) return false;
  if (w.__QUANTIS_PORTAL_EMBED__ === true) return true;
  if (w.__WRITE_API_BASE__?.trim()) return true;
  const pid = w.__PORTAL_USER__?.id;
  if (pid != null && String(pid).trim() !== "") return true;
  if (w.parent !== w && w.__PORTAL_BASE_PATH__?.trim()) return true;
  try {
    if (/\/embed\/quantis/i.test(w.location.pathname)) return true;
  } catch {
    /* ignore */
  }
  return false;
}

/** User Portal inject (__PORTAL_USER__) khi mở embed. */
export function getPortalUserFromWindow(): AuthUser | null {
  if (typeof window === "undefined") return null;
  const u = (window as { __PORTAL_USER__?: { id?: string; email?: string; name?: string } }).__PORTAL_USER__;
  if (!u || typeof u.id !== "string" || !u.id.trim()) return null;
  return {
    id: u.id.trim(),
    email: typeof u.email === "string" ? u.email : "",
    name: typeof u.name === "string" ? u.name : u.email,
  };
}

/** URL backend Python mặc định khi chạy trên research.neu.edu.vn (phân tích định lượng). */
export function getDefaultBackendPythonUrl(): string {
  return isResearchNeu() ? RESEARCH_NEU_BACKEND_PYTHON : "";
}

/** Lấy cấu hình dùng chung từ server (áp dụng cho mọi tài khoản). */
export async function getQuantisSettings(baseUrl?: string): Promise<import("./store").ServerSettings> {
  const base = (baseUrl != null && String(baseUrl).trim() !== "") ? String(baseUrl).trim().replace(/\/+$/, "") : getBase();
  if (!base) return {};
  try {
    const res = await fetch(`${base}/api/quantis/settings`, { method: "GET", credentials: "include", cache: "no-store" });
    if (!res.ok) return {};
    const data = await res.json();
    return {
      backendApiUrl: data.backendApiUrl ?? null,
      archiveUrl: data.archiveUrl ?? null,
      archiveFileUrl: data.archiveFileUrl ?? null,
      aiApiUrl: data.aiApiUrl ?? null,
      ollamaUpstreamUrl: data.ollamaUpstreamUrl ?? null,
      defaultAiModel: data.defaultAiModel ?? null,
    };
  } catch {
    return {};
  }
}

/** Lưu cấu hình dùng chung lên server (áp dụng cho mọi tài khoản). */
export async function putQuantisSettings(settings: import("./store").ServerSettings, baseUrl?: string): Promise<boolean> {
  const base = (baseUrl != null && String(baseUrl).trim() !== "") ? String(baseUrl).trim().replace(/\/+$/, "") : getBase();
  if (!base) return false;
  try {
    const res = await fetch(`${base}/api/quantis/settings`, {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(settings),
    });
    return res.ok;
  } catch {
    return false;
  }
}

function getAPI_BASE(): string {
  const b = getBase();
  return b ? `${b}/api/quantis` : "";
}

function getANALYZE_BASE(): string {
  const api = getAPI_BASE();
  return api ? `${api}/analyze` : "";
}

function getHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

/** Chi tiết lỗi FastAPI / proxy phân tích (detail string hoặc mảng validation). */
function formatAnalyzeErrorJson(json: unknown, httpStatus: number): string {
  if (!json || typeof json !== "object") return `Phân tích thất bại (HTTP ${httpStatus}).`;
  const j = json as { detail?: unknown; error?: unknown };
  const d = j.detail ?? j.error;
  if (typeof d === "string") return d;
  if (Array.isArray(d)) {
    const parts = d.map((x) => {
      if (x && typeof x === "object" && "msg" in x) return String((x as { msg: string }).msg);
      try {
        return JSON.stringify(x);
      } catch {
        return String(x);
      }
    });
    return parts.filter(Boolean).join("; ") || `Phân tích thất bại (HTTP ${httpStatus}).`;
  }
  return `Phân tích thất bại (HTTP ${httpStatus}).`;
}

export async function checkBackendAvailable(baseUrl?: string): Promise<boolean> {
  const base = (baseUrl != null && String(baseUrl).trim() !== "") ? String(baseUrl).trim().replace(/\/+$/, "") : getBase();
  if (!base) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const apiBase = `${base}/api/quantis`;
    const res = await fetch(`${apiBase}/health`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/** Gửi file lên backend để parse (Excel, ODS, SPSS, Stata, SAS, R). Cần backend Node + Python. */
export async function parseFileViaBackend(file: File): Promise<{ rows: string[][]; format: string }> {
  const base = getBase();
  if (!base) throw new Error("Backend chưa cấu hình. Cần cấu hình URL backend Quantis để import file ODS, SPSS, Stata, SAS, R.");
  const form = new FormData();
  form.append("file", file, file.name);
  const res = await fetch(`${base}/api/quantis/parse-file`, {
    method: "POST",
    credentials: "include",
    body: form,
  });
  const errBody = await res.json().catch(() => ({ error: res.statusText }));
  if (!res.ok) {
    const msg = errBody.detail ?? errBody.error ?? `Parse file failed: ${res.status}`;
    if (typeof msg === "string") {
      console.error("[Quantis parse-file]", res.status, msg);
      throw new Error(msg);
    }
    console.error("[Quantis parse-file]", res.status, errBody);
    throw new Error(JSON.stringify(msg));
  }
  if (!Array.isArray(errBody.rows)) throw new Error("Invalid response: missing rows");
  return { rows: errBody.rows, format: errBody.format ?? "unknown" };
}

/** Kiểm tra backend phân tích Python (qua proxy Node) có sẵn không. */
export async function checkAnalysisBackendAvailable(baseUrl?: string): Promise<boolean> {
  const base = (baseUrl != null && String(baseUrl).trim() !== "") ? String(baseUrl).trim().replace(/\/+$/, "") : getBase();
  if (!base) return false;
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 3000);
    const analyzeBase = `${base}/api/quantis/analyze`;
    const res = await fetch(`${analyzeBase}/health`, {
      method: "GET",
      credentials: "include",
      cache: "no-store",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/** Phân tích: thống kê mô tả (backend Python). Trả về null nếu lỗi hoặc không dùng backend. */
export async function analyzeDescriptive(rows: string[][]): Promise<Array<{ column: string; type: string; n: number; missing: number; mean?: number; median?: number; std?: number; min?: number; max?: number; q25?: number; q75?: number; freq?: { value: string; count: number }[] }> | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/descriptive`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json?.result) ? json.result : null;
  } catch {
    return null;
  }
}

/** Phân tích: t-test hai mẫu độc lập (Welch hoặc equal variance). */
export async function analyzeTTest(
  rows: string[][],
  groupCol: string,
  groupVal1: string,
  groupVal2: string,
  numCol: string,
  equalVar?: boolean
): Promise<{ t: number; df: number; pValue: number; cohenD: number; mean1: number; mean2: number; n1: number; n2: number; std1: number; std2: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/ttest`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, groupCol, groupVal1, groupVal2, numCol, equalVar: equalVar ?? false }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Chi-square độc lập. */
export async function analyzeChiSquare(
  rows: string[][],
  col1: string,
  col2: string
): Promise<{ chi2: number; df: number; pValue: number; table: { row: string; col: string; count: number }[]; rowLabels: string[]; colLabels: string[] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/chi2`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, col1, col2 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: ma trận tương quan (Pearson hoặc Spearman). */
export async function analyzeCorrelation(
  rows: string[][],
  method: "pearson" | "spearman" = "pearson"
): Promise<{ matrix: number[][]; columnNames: string[] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/correlation`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, method }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: ANOVA một nhân tố. */
export async function analyzeAnova(
  rows: string[][],
  factorCol: string,
  valueCol: string
): Promise<{ f: number; dfBetween: number; dfWithin: number; dfTotal: number; ssBetween: number; ssWithin: number; ssTotal: number; msBetween: number; msWithin: number; pValue: number; etaSq: number; groupMeans: { group: string; n: number; mean: number; std: number }[] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/anova`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, factorCol, valueCol }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: ANCOVA (Analysis of Covariance) — kiểm soát covariate khi so sánh nhóm. */
export async function analyzeAncova(
  rows: string[][],
  factorCol: string,
  valueCol: string,
  covariateCols: string[]
): Promise<{ f: number; dfBetween: number; dfWithin: number; dfTotal: number; pValue: number; etaSq: number; factorCol: string; valueCol: string; covariateCols: string[]; groupMeans: { group: string; n: number; mean: number; std: number }[]; n: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/ancova`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, factorCol, valueCol, covariateCols }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: MANOVA (nhiều biến phụ thuộc, một nhân tố). */
export async function analyzeManova(
  rows: string[][],
  factorCol: string,
  valueCols: string[]
): Promise<{ factorCol: string; valueCols: string[]; n: number; summary?: string; factorTest?: string; error?: string } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/manova`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, factorCol, valueCols }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: MANCOVA (MANOVA + kiểm soát covariate). */
export async function analyzeMancova(
  rows: string[][],
  factorCol: string,
  valueCols: string[],
  covariateCols: string[]
): Promise<{ factorCol: string; valueCols: string[]; covariateCols: string[]; n: number; summary?: string; factorTest?: string; error?: string } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/mancova`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, factorCol, valueCols, covariateCols }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Kruskal-Wallis H (non-parametric ANOVA cho 3+ nhóm). */
export async function analyzeKruskalWallis(
  rows: string[][],
  factorCol: string,
  valueCol: string
): Promise<{ h: number; pValue: number; df: number; nGroups: number; groupMedians: { group: string; n: number; median: number; mean: number; std: number }[] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/kruskal`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, factorCol, valueCol }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: hồi quy OLS. */
export async function analyzeOLS(
  rows: string[][],
  yCol: string,
  xCols: string[]
): Promise<{ coefficients: Record<string, number>; intercept: number; r2: number; adjR2: number; se: Record<string, number>; tStat: Record<string, number>; pValue: Record<string, number>; ciLower?: Record<string, number>; ciUpper?: Record<string, number>; n: number; df: number; s2: number; yName: string; xNames: string[] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/ols`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, yCol, xCols }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: hồi quy logistic nhị phân. */
export async function analyzeLogistic(
  rows: string[][],
  yCol: string,
  xCols: string[]
): Promise<{ coefficients: Record<string, number>; intercept: number; oddsRatios: Record<string, number>; se: Record<string, number>; zStat: Record<string, number>; pValue: Record<string, number>; logLikelihood: number; aic: number; n: number; yName: string; xNames: string[]; classCounts: { "0": number; "1": number } } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/logistic`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, yCol, xCols }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Hồi quy Poisson (Y đếm: số nguyên ≥ 0). */
export async function analyzePoisson(
  rows: string[][],
  yCol: string,
  xCols: string[]
): Promise<{ coefficients: Record<string, number>; intercept: number; irr: Record<string, number>; se: Record<string, number>; zStat: Record<string, number>; pValue: Record<string, number>; logLikelihood: number; aic: number; n: number; yName: string; xNames: string[] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/poisson`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, yCol, xCols }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Hồi quy Ridge (L2 regularized). */
export async function analyzeRidge(
  rows: string[][],
  yCol: string,
  xCols: string[],
  alpha?: number
): Promise<{ coefficients: Record<string, number>; intercept: number; r2: number; alpha: number; n: number; yName: string; xNames: string[] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/ridge`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, yCol, xCols, alpha: alpha ?? 1 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Mann-Whitney U (non-parametric). */
export async function analyzeMannWhitney(
  rows: string[][],
  groupCol: string,
  groupVal1: string,
  groupVal2: string,
  numCol: string
): Promise<{ u: number; z: number; pValue: number; n1: number; n2: number; median1: number; median2: number; rankSum1: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/mannwhitney`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, groupCol, groupVal1, groupVal2, numCol }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Shapiro-Wilk (kiểm định chuẩn). */
export async function analyzeShapiro(values: number[]): Promise<{ w: number; pValue: number; n: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/shapiro`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ values }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Cronbach's alpha. */
export async function analyzeCronbach(rows: string[][], columnNames: string[]): Promise<number | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/cronbach`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, columnNames }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return typeof json?.result === "number" ? json.result : null;
  } catch {
    return null;
  }
}

/** Phân tích: VIF (đa cộng tuyến). */
export async function analyzeVIF(rows: string[][], xCols: string[]): Promise<Record<string, number> | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/vif`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, xCols }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Mediation (X→M→Y; nhiều M = trung gian song song). */
export async function analyzeMediation(
  rows: string[][],
  xCol: string,
  mCols: string[],
  yCol: string
): Promise<MediationResult | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/mediation`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, xCol, mCols, yCol }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Moderation (Y ~ X + M + X×M). */
export async function analyzeModeration(
  rows: string[][],
  yCol: string,
  xCol: string,
  mCol: string
): Promise<{ coefficients: Record<string, number>; intercept: number; r2: number; adjR2: number; se: Record<string, number>; tStat: Record<string, number>; pValue: Record<string, number>; n: number; df: number; s2: number; yName: string; xNames: string[] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/moderation`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, yCol, xCol, mCol }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Path analysis (nhiều phương trình hồi quy — AMOS-style). */
export async function analyzePathAnalysis(
  rows: string[][],
  equations: Array<{ yCol: string; xCols: string[] }>
): Promise<{
  pathCoefficients: Array<{ from: string; to: string; coefficient: number; se: number; tStat: number; pValue: number }>;
  equationsR2: Array<{ yCol: string; r2: number; adjR2: number; n: number }>;
  n: number;
} | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/path-analysis`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, equations }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: CFA — Confirmatory Factor Analysis (AMOS/SmartPLS-style). Luôn trả về object (có `error` khi lỗi mạng/HTTP/máy chủ). */
export async function analyzeCFA(
  rows: string[][],
  factorSpec: Record<string, string[]>
): Promise<{
  loadings?: Array<{ factor: string; indicator: string; estimate: number; se: number; z: number; pValue: number }>;
  factorCovariances?: Array<{ factor1: string; factor2: string; covariance: number; se: number }>;
  fitIndices?: Record<string, number | string>;
  n?: number;
  model?: string;
  error?: string;
}> {
  const base = getANALYZE_BASE();
  if (!base) {
    return { error: "Chưa cấu hình URL backend Quantis — không gọi được phân tích CFA." };
  }
  try {
    const res = await fetch(`${base}/cfa`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, factorSpec }),
    });
    const json: unknown = await res.json().catch(() => null);
    if (!res.ok) {
      return { error: formatAnalyzeErrorJson(json, res.status) };
    }
    if (json && typeof json === "object" && "result" in json) {
      const r = (json as { result: unknown }).result;
      if (r && typeof r === "object") {
        return r as {
          loadings?: Array<{ factor: string; indicator: string; estimate: number; se: number; z: number; pValue: number }>;
          factorCovariances?: Array<{ factor1: string; factor2: string; covariance: number; se: number }>;
          fitIndices?: Record<string, number | string>;
          n?: number;
          model?: string;
          error?: string;
        };
      }
    }
    return { error: "Phản hồi CFA không hợp lệ (thiếu result)." };
  } catch {
    return { error: "Không kết nối được backend phân tích (CFA)." };
  }
}

/** Phân tích: PLS-SEM (SmartPLS-style, variance-based). */
export async function analyzePLSSEM(
  rows: string[][],
  outerModel: Record<string, string[]>,
  innerPaths: Array<{ from: string; to: string }>,
  nBootstrap?: number
): Promise<{
  pathCoefficients: Array<{ from: string; to: string; coefficient: number; se?: number; tStat?: number; pValue?: number; ciLower?: number; ciUpper?: number }>;
  loadings: Array<{ latent: string; indicator: string; loading: number }>;
  r2: Record<string, number>;
  n: number;
  bootstrapSamples: number;
  fornellLarcker: Record<string, number>;
} | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/pls-sem`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, outerModel, innerPaths, nBootstrap: nBootstrap ?? 500 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: K-means clustering. */
export async function analyzeKMeans(
  rows: string[][],
  columnNames: string[],
  k: number,
  maxIter?: number
): Promise<{ assignments: number[]; centroids: number[][]; iterations: number; withinSS: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/kmeans`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, columnNames, k, maxIter: maxIter ?? 100 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: EFA (trích nhân tố PCA + varimax). */
export async function analyzeEFA(
  rows: string[][],
  columnNames: string[],
  nFactors?: number
): Promise<{ eigenvalues: number[]; varianceExplained: number[]; loadings: number[][]; columnNames: string[]; nFactors: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/efa`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, columnNames, nFactors: nFactors ?? undefined }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Pairwise post-hoc sau ANOVA. */
export async function analyzePairwisePosthoc(
  groupMeans: { group: string; n: number; mean: number; std: number }[]
): Promise<Array<{ group1: string; group2: string; meanDiff: number; t: number; df: number; p: number; pBonferroni: number }> | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/pairwise-posthoc`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ groupMeans }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json?.result) ? json.result : null;
  } catch {
    return null;
  }
}

/** Phân tích: Crosstab (bảng tần số 2 chiều). */
export async function analyzeCrosstab(
  rows: string[][],
  col1: string,
  col2: string
): Promise<{ rowLabels: string[]; colLabels: string[]; counts: number[][] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/crosstab`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, col1, col2 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Box stats theo nhóm. */
export async function analyzeBoxStats(
  rows: string[][],
  groupCol: string,
  valueCol: string
): Promise<Array<{ group: string; min: number; q1: number; median: number; q3: number; max: number; n: number }> | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/boxstats`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, groupCol, valueCol }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json?.result) ? json.result : null;
  } catch {
    return null;
  }
}

/** Phân tích: Chia bins cho histogram (numpy). */
export async function analyzeHistogramBins(
  values: number[],
  binCount?: number
): Promise<Array<{ binStart: number; binEnd: number; count: number }> | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/histogram-bins`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ values, binCount: binCount ?? undefined }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return Array.isArray(json?.result) ? json.result : null;
  } catch {
    return null;
  }
}

/** Phân tích: Số điểm ngoại lai (quy tắc 1.5×IQR). */
export async function analyzeOutlierIqr(
  values: number[]
): Promise<{ outlierCount: number; q1: number | null; q3: number | null; iqr: number | null; lower: number | null; upper: number | null } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/outlier-iqr`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ values }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Power t-test (cỡ mẫu). */
export async function analyzePowerTTest(
  effectSizeD: number,
  alpha?: number,
  power?: number
): Promise<{ nRequired: number; power: number; effectSize: number; alpha: number; testType: string } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/power-ttest`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ effectSizeD, alpha: alpha ?? 0.05, power: power ?? 0.8 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Beta posterior (Bayesian). */
export async function analyzeBetaPosterior(
  successes: number,
  n: number,
  priorAlpha?: number,
  priorBeta?: number
): Promise<{ postAlpha: number; postBeta: number; mean: number; variance: number; ci95Lower: number; ci95Upper: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/beta-posterior`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ successes, n, priorAlpha: priorAlpha ?? 1, priorBeta: priorBeta ?? 1 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Cỡ mẫu cho kiểm định tỉ lệ (z-test 2 tỉ lệ). */
export async function analyzeSampleSizeProportion(
  p0: number,
  p1: number,
  alpha?: number,
  power?: number
): Promise<{ nRequired: number; p0: number; p1: number; alpha: number; power: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/sample-size-proportion`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ p0, p1, alpha: alpha ?? 0.05, power: power ?? 0.8 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Cỡ mẫu cho Chi-square (Cohen w). */
export async function analyzeSampleSizeChisquare(
  effectSizeW: number,
  df: number,
  alpha?: number,
  power?: number
): Promise<{ nRequired: number; effectSizeW: number; df: number; alpha: number; power: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/sample-size-chisquare`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ effectSizeW, df, alpha: alpha ?? 0.05, power: power ?? 0.8 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Cỡ mẫu cho ANOVA 1 nhân tố. */
export async function analyzeSampleSizeAnova(
  k: number,
  effectSizeF: number,
  alpha?: number,
  power?: number
): Promise<{ nRequired: number; nPerGroup: number; k: number; effectSizeF: number; alpha: number; power: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/sample-size-anova`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ k, effectSizeF, alpha: alpha ?? 0.05, power: power ?? 0.8 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Cỡ mẫu hồi quy (quy tắc 10/20). */
export async function analyzeSampleSizeRegression(
  nPredictors: number,
  rule?: "10" | "20"
): Promise<{ nRequired: number; nPredictors: number; rule: string } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/sample-size-regression`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ nPredictors, rule: rule ?? "10" }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích định tính: thống kê văn bản (số từ, tần số từ). */
export async function analyzeTextStats(
  rows: string[][],
  col: string,
  topN?: number
): Promise<{ column: string; nRows: number; nEmpty: number; totalWords: number; uniqueWords: number; avgWordsPerRow: number; minWordsPerRow: number; maxWordsPerRow: number; wordFreq: { word: string; count: number }[] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/text-stats`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, col, topN: topN ?? 100 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích định tính: đếm từ khóa / mã (số dòng chứa từ khóa, tổng số lần xuất hiện). */
export async function analyzeKeywordCounts(
  rows: string[][],
  col: string,
  keywords: string[]
): Promise<{ column: string; keywords: string[]; counts: { keyword: string; rowCount: number; totalOccurrences: number }[] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/keyword-counts`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, col, keywords }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích định tính: tần số cụm từ (n-gram: bigram, trigram, ...). */
export async function analyzeNgramFreq(
  rows: string[][],
  col: string,
  n?: number,
  topN?: number
): Promise<{ column: string; n: number; totalNgrams: number; uniqueNgrams: number; ngramFreq: { ngram: string; count: number }[] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/ngram-freq`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, col, n: n ?? 2, topN: topN ?? 50 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích định tính: Cohen's Kappa — độ đồng nhất mã hóa giữa 2 coder. */
export async function analyzeCohensKappa(
  rows: string[][],
  col1: string,
  col2: string
): Promise<{ col1: string; col2: string; n: number; kappa: number; observedAgreement: number; expectedAgreement: number; table: Record<string, Record<string, number>> } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/cohens-kappa`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, col1, col2 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Ma trận hiệp phương sai (Covariance). */
export async function analyzeCovariance(
  rows: string[][],
  method?: "population" | "sample"
): Promise<{ matrix: number[][]; columnNames: string[]; ddof: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/covariance`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, method: method ?? "population" }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: F-test hai mẫu cho phương sai. */
export async function analyzeFTestTwoSample(
  rows: string[][],
  groupCol: string,
  groupVal1: string,
  groupVal2: string,
  numCol: string
): Promise<{ f: number; pValue: number; df1: number; df2: number; var1: number; var2: number; n1: number; n2: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/ftest-two-sample`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, groupCol, groupVal1, groupVal2, numCol }),
    });
    if (!res.ok) {
      const err = (await res.json().catch(() => ({}))) as { detail?: string };
      throw new Error(err.detail || res.statusText || "F-test lỗi");
    }
    const json = await res.json();
    return json?.result ?? null;
  } catch (e) {
    if (e instanceof Error) throw e;
    return null;
  }
}

/** Phân tích: Làm mượt hàm mũ (Exponential Smoothing). */
export async function analyzeExponentialSmoothing(
  values: number[],
  alpha?: number
): Promise<{ smoothed: number[]; alpha: number; n: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/exponential-smoothing`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ values, alpha: alpha ?? 0.3 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Trung bình trượt (Moving Average). */
export async function analyzeMovingAverage(
  values: number[],
  period: number
): Promise<{ movingAverage: number[]; period: number; n: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/moving-average`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ values, period }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: ANOVA hai nhân tố có lặp. */
export async function analyzeAnovaTwoFactorReplication(
  rows: string[][],
  factorA: string,
  factorB: string,
  valueCol: string
): Promise<{ table: Array<{ source: string; ss: number; df: number; ms: number; f: number | null; pValue: number | null }>; factorA: string; factorB: string; valueCol: string; n: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/anova-two-factor-replication`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, factorA, factorB, valueCol }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: ANOVA hai nhân tố không lặp. */
export async function analyzeAnovaTwoFactorNoReplication(
  rows: string[][],
  factorA: string,
  factorB: string,
  valueCol: string
): Promise<{ table: Array<{ source: string; ss: number; df: number; ms: number; f: number | null; pValue: number | null }>; factorA: string; factorB: string; valueCol: string; n: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/anova-two-factor-no-replication`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, factorA, factorB, valueCol }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Fourier (FFT). */
export async function analyzeFourier(
  values: number[]
): Promise<{ magnitudes: number[]; frequencies: number[]; n: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/fourier`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ values }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Rank and Percentile. */
export async function analyzeRankPercentile(
  rows: string[][],
  valueCol: string
): Promise<{ column: string; n: number; data: Array<{ value: number; rank: number; percentile: number }> } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/rank-percentile`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, valueCol }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Sinh số ngẫu nhiên. */
export async function analyzeRandomNumber(
  n: number,
  distribution: "uniform" | "normal" | "integer" | "binomial",
  options?: { seed?: number; low?: number; high?: number; mean?: number; std?: number; nTrials?: number; p?: number }
): Promise<{ values: number[]; n: number; distribution: string; error?: string } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/random-number`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ n, distribution, ...options }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: Lấy mẫu (Sampling). */
export async function analyzeSampling(
  rows: string[][],
  n: number,
  method?: "random" | "periodic",
  seed?: number
): Promise<{ rows: string[][]; nSampled: number; method: string; indices?: number[] } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/sampling`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, n, method: method ?? "random", seed }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: t-test hai mẫu phụ thuộc (Paired). */
export async function analyzeTTestPaired(
  rows: string[][],
  col1: string,
  col2: string
): Promise<{ t: number; df: number; pValue: number; cohenD: number; meanDiff: number; stdDiff: number; mean1: number; mean2: number; n: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/ttest-paired`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, col1, col2 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Phân tích: z-Test hai mẫu cho trung bình (biết phương sai tổng thể). */
export async function analyzeZTestTwoMeans(
  rows: string[][],
  groupCol: string,
  groupVal1: string,
  groupVal2: string,
  numCol: string,
  knownVar1: number,
  knownVar2: number
): Promise<{ z: number; pValue: number; mean1: number; mean2: number; n1: number; n2: number; knownVar1: number; knownVar2: number } | null> {
  try {
    const res = await fetch(`${getANALYZE_BASE()}/ztest-two-means`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({ rows, groupCol, groupVal1, groupVal2, numCol, knownVar1, knownVar2 }),
    });
    if (!res.ok) return null;
    const json = await res.json();
    return json?.result ?? null;
  } catch {
    return null;
  }
}

/** Lấy toàn bộ datasets + workflows (cần đăng nhập). Trả về null nếu 401/lỗi. */
export async function getData(): Promise<{ datasets: Dataset[]; workflows: Workflow[] } | null> {
  try {
    const res = await fetch(`${getAPI_BASE()}/data`, { method: "GET", credentials: "include" });
    if (!res.ok) return null;
    const json = await res.json();
    return {
      datasets: Array.isArray(json.datasets) ? json.datasets : [],
      workflows: Array.isArray(json.workflows) ? json.workflows : [],
    };
  } catch {
    return null;
  }
}

/** Ghi đè toàn bộ datasets + workflows lên server (cần đăng nhập). Trả về true nếu thành công. */
export async function saveData(payload: { datasets: Dataset[]; workflows: Workflow[] }): Promise<boolean> {
  const base = getBase();
  if (!base || String(base).trim() === "") return false;
  try {
    const res = await fetch(`${getAPI_BASE()}/data`, {
      method: "POST",
      credentials: "include",
      headers: getHeaders(),
      body: JSON.stringify({
        datasets: payload.datasets,
        workflows: payload.workflows,
      }),
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Gọi LLM (OpenAI/Ollama). Có thể cấu hình địa chỉ API trong Cài đặt (hoặc .env OLLAMA_URL / VITE_OLLAMA_URL). */
const DEFAULT_OLLAMA = "http://localhost:11434/v1";
const defModel = (import.meta as { env?: { VITE_QUANTIS_AI_MODEL?: string } }).env?.VITE_QUANTIS_AI_MODEL;

/** Chuẩn hóa base Ollama thành URL API (có /v1). */
function normalizeOllamaApiBase(url: string): string {
  const u = String(url).trim().replace(/\/+$/, "");
  if (!u) return "";
  return u.endsWith("/v1") ? u : `${u}/v1`;
}

/**
 * Base URL API AI (OpenAI-compatible) mà **trình duyệt** gọi tới — luôn là backend Node (proxy), không gọi thẳng Ollama.
 * Khi `getBase()` là gốc API đã mount (vd. `https://host/api/quantis/backend`), nối thêm `/api/quantis/ollama` vì
 * trong app Express route proxy nằm dưới path đó; reverse proxy giữ nguyên path → URL có thể trông lặp `/api/quantis` nhưng đúng với cách deploy.
 * Ollama thật chỉ do **Node** gọi theo `ollamaUpstreamUrl` / `OLLAMA_URL`.
 * Không có backend: dev dùng `VITE_OLLAMA_URL` hoặc mặc định localhost:11434.
 */
export function getAiApiBase(): string {
  const b = getBase().replace(/\/+$/, "");
  if (b) return normalizeOllamaApiBase(`${b}/api/quantis/ollama`);
  const envOllama = (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_OLLAMA_URL?: string } }).env?.VITE_OLLAMA_URL);
  if (envOllama != null && envOllama !== false && String(envOllama).trim() !== "") return normalizeOllamaApiBase(String(envOllama));
  return DEFAULT_OLLAMA;
}

/** Mô hình AI mặc định khi không cấu hình: research.neu.edu.vn = qwen3:8b, còn lại = llama3.2:8b. */
export function getDefaultAiModel(): string {
  if (isResearchNeu()) return RESEARCH_NEU_DEFAULT_MODEL;
  return "llama3.2:8b";
}

/** Kiểm tra API AI (Ollama) có phản hồi /api/tags không. */
export async function checkAiApiAvailable(apiBase?: string): Promise<boolean> {
  const base = (apiBase != null && String(apiBase).trim() !== "") ? String(apiBase).trim().replace(/\/+$/, "") : getAiApiBase();
  if (!base) return false;
  try {
    const urlBase = base.replace(/\/v1\/?$/, "");
    const controller = new AbortController();
    const t = setTimeout(() => controller.abort(), 5000);
    const res = await fetch(`${urlBase.replace(/\/+$/, "")}/api/tags`, { signal: controller.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** Trích size (tỉ tham số, đơn vị B) từ tên model, ví dụ "llama3.2:7b" -> 7, "phi3:14b" -> 14. Không khớp thì trả về null. */
export function parseModelSizeB(name: string): number | null {
  if (!name || typeof name !== "string") return null
  const m = name.match(/(\d+(?:\.\d+)?)\s*b\b/i)
  return m ? parseFloat(m[1]) : null
}

/** Lọc danh sách model chỉ giữ những model có size >= minB (hoặc không xác định được size). */
export function filterModelsMinSize(models: string[], minB: number): string[] {
  return models.filter((m) => {
    const size = parseModelSizeB(m)
    return size === null || size >= minB
  })
}

/** Lấy danh sách model từ Ollama API /api/tags. apiBase thường là .../v1, sẽ gọi .../api/tags. */
export async function getOllamaModels(apiBase: string): Promise<string[]> {
  const base = (apiBase || DEFAULT_OLLAMA).replace(/\/v1\/?$/, "")
  const url = `${base.replace(/\/+$/, "")}/api/tags`
  try {
    const res = await fetch(url)
    if (!res.ok) return []
    const data = (await res.json()) as { models?: Array<{ name: string }> }
    const list = data?.models?.map((m) => m.name) ?? []
    return list
  } catch {
    return []
  }
}

/** Kiểm tra proxy Ollama trên backend Quantis (`GET .../api/quantis/ollama/api/tags`). */
export async function checkOllamaProxyAvailable(backendBase: string): Promise<boolean> {
  const base = (backendBase || "").replace(/\/+$/, "");
  if (!base) return false;
  try {
    const res = await fetch(`${base}/api/quantis/ollama/api/tags`, {
      credentials: "include",
      cache: "no-store",
    });
    return res.ok;
  } catch {
    return false;
  }
}

/** Lấy danh sách model qua proxy backend Quantis (tránh CORS khi Ollama ở domain khác). */
export async function getOllamaModelsViaProxy(backendBase: string): Promise<string[]> {
  const base = (backendBase || "").replace(/\/+$/, "");
  if (!base) return [];
  const url = `${base}/api/quantis/ollama/api/tags`;
  try {
    const res = await fetch(url, { credentials: "include", cache: "no-store" });
    if (!res.ok) return [];
    const data = (await res.json()) as { models?: Array<{ name: string }> };
    return data?.models?.map((m) => m.name) ?? [];
  } catch {
    return [];
  }
}

/** Timeout gọi AI (ms). */
export const AI_REQUEST_TIMEOUT_MS = 90_000
/** Giới hạn độ dài prompt gửi lên (ký tự) để tránh vượt context window. */
export const AI_MAX_PROMPT_CHARS = 14_000
/** Số token tối đa cho câu trả lời. */
export const AI_MAX_TOKENS = 1024

/** Rút gọn chuỗi để gửi AI: giữ đầu + đánh dấu cắt + đuôi (ưu tiên thông tin cuối). */
export function truncateForAI(text: string, maxChars: number): { text: string; truncated: boolean } {
  if (!text || text.length <= maxChars) return { text: text.trim(), truncated: false }
  const half = Math.floor(maxChars / 2)
  const head = text.slice(0, half).trim()
  const tail = text.slice(-(maxChars - half - 80)).trim()
  const marker = "\n\n[... đã rút gọn bớt nội dung giữa ...]\n\n"
  return { text: head + marker + tail, truncated: true }
}

function extractContent(obj: unknown): string {
  if (obj == null || typeof obj !== "object") return ""
  const o = obj as Record<string, unknown>
  const choice0 = o.choices?.[0] && typeof o.choices[0] === "object" && o.choices[0] !== null ? (o.choices[0] as Record<string, unknown>) : null
  const msg = choice0?.message && typeof choice0.message === "object" && choice0.message !== null ? (choice0.message as Record<string, unknown>) : null
  if (msg) {
    const content = msg.content
    if (typeof content === "string" && content.trim()) return content.trim()
    if (Array.isArray(content)) {
      const t = content.map((c) => (c && typeof c === "object" && typeof (c as Record<string, unknown>).text === "string" ? (c as Record<string, unknown>).text : "")).join("").trim()
      if (t) return t
    }
    if (typeof msg.reasoning === "string" && msg.reasoning.trim()) return msg.reasoning.trim()
    if (typeof choice0?.text === "string" && choice0.text.trim()) return (choice0 as Record<string, unknown>).text as string
  }
  if (typeof o.response === "string") return o.response
  if (o.message && typeof o.message === "object" && o.message !== null) {
    const m = o.message as Record<string, unknown>
    if (typeof m.content === "string" && m.content.trim()) return m.content.trim()
    if (typeof m.reasoning === "string" && m.reasoning.trim()) return m.reasoning.trim()
    if (Array.isArray(m.content)) {
      const t = m.content.map((c) => (c && typeof c === "object" && typeof (c as Record<string, unknown>).text === "string" ? (c as Record<string, unknown>).text : "")).join("").trim()
      if (t) return t
    }
  }
  if (typeof o.text === "string") return o.text
  if (typeof o.content === "string") return o.content
  if (typeof o.output === "string") return o.output
  return ""
}

function parseAiResponse(rawText: string): string {
  const data = (() => { try { return JSON.parse(rawText) as unknown } catch { return null } })()
  if (data !== null) {
    const single = extractContent(data)
    if (single.trim()) return single.trim()
  }
  const lines = rawText.split(/\r?\n/).filter((s) => s.trim())
  const parts: string[] = []
  for (const line of lines) {
    try {
      const data = JSON.parse(line) as unknown
      const o = data as Record<string, unknown>
      if (typeof o.response === "string") parts.push(o.response)
      else if (o.choices?.[0] && typeof o.choices[0] === "object") {
        const c = (o.choices[0] as Record<string, unknown>).delta ?? (o.choices[0] as Record<string, unknown>).message
        if (c && typeof c === "object" && c !== null && typeof (c as Record<string, unknown>).content === "string")
          parts.push((c as Record<string, unknown>).content as string)
      } else {
        const msg = extractContent(data)
        if (msg) parts.push(msg)
      }
    } catch { /* bỏ qua */ }
  }
  return parts.join("").trim() || ""
}

export async function aiComplete(apiBase: string, prompt: string, systemHint?: string, modelOverride?: string, options?: { timeoutMs?: number; maxPromptChars?: number; maxTokens?: number }): Promise<string> {
  const timeoutMs = options?.timeoutMs ?? AI_REQUEST_TIMEOUT_MS
  const maxPromptChars = options?.maxPromptChars ?? AI_MAX_PROMPT_CHARS
  const maxTokens = options?.maxTokens ?? AI_MAX_TOKENS
  const { text: promptToSend, truncated: promptTruncated } = truncateForAI(prompt, maxPromptChars)
  const systemWithHint = systemHint && promptTruncated
    ? systemHint + "\n\n[Lưu ý: Ngữ cảnh có thể đã được rút gọn; chỉ diễn giải dựa trên phần nội dung có sẵn.]"
    : systemHint

  const base = apiBase || DEFAULT_OLLAMA
  const url = String(base).includes("completions") ? base : `${String(base).replace(/\/+$/, "")}/chat/completions`
  const isLocalOllama = /ollama/i.test(String(base)) || /localhost:11434/.test(String(base))
  const fallbackModel = isLocalOllama ? "llama3.2:8b" : "gpt-4o-mini"
  const model = modelOverride || defModel || fallbackModel
  const messages = systemWithHint
    ? [{ role: "system" as const, content: systemWithHint }, { role: "user" as const, content: promptToSend }]
    : [{ role: "user" as const, content: promptToSend }]
  const body = { model, messages, max_tokens: maxTokens, stream: false }

  const doRequest = async (): Promise<Response> => {
    const controller = new AbortController()
    const timeoutId = setTimeout(() => controller.abort(), timeoutMs)
    try {
      const res = await fetch(url, { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), signal: controller.signal })
      clearTimeout(timeoutId)
      return res
    } catch (e) {
      clearTimeout(timeoutId)
      throw e
    }
  }

  let lastError: Error | null = null
  for (let attempt = 0; attempt <= 1; attempt++) {
    try {
      const res = await doRequest()
      if (res.ok) {
        const rawText = await res.text()
        return parseAiResponse(rawText)
      }
      const errText = await res.text()
      const isRetryable = res.status >= 500 || res.status === 408 || /timeout|network|failed|refused/i.test(errText)
      lastError = new Error(errText || `AI API error ${res.status}`)
      if (!isRetryable || attempt === 1) throw lastError
    } catch (e) {
      lastError = e instanceof Error ? e : new Error(String(e))
      const isRetryable = /abort|timeout|network|failed|refused/i.test(lastError.message)
      if (attempt === 1 || !isRetryable) throw lastError
    }
  }
  throw lastError || new Error("Lỗi kết nối AI")
}
