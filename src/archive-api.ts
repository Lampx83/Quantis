/**
 * API client cho Archive NEU (DataD3 / archive.neu.edu.vn).
 * Định dạng API theo code DataD3: search/ask, requests list, files by request_id, preview, download.
 * - Có thể cấu hình địa chỉ Archive trong Cài đặt (lưu localStorage). Nếu trống: dùng proxy qua backend hoặc mặc định.
 * - Tải file: dùng địa chỉ trong Cài đặt (hoặc env VITE_ARCHIVE_FILE_BASE_URL). Không fix cứng.
 */

import { loadArchiveUrl, loadArchiveFileUrl, loadBackendApiUrl } from "./store";

const _env = typeof import.meta !== "undefined" ? (import.meta as { env?: { VITE_ARCHIVE_NEU_URL?: string; VITE_QUANTIS_API_URL?: string; VITE_RESEARCH_NEU_ARCHIVE?: string; VITE_RESEARCH_NEU_ARCHIVE_FILE?: string } }).env : undefined;
const explicitBase = _env?.VITE_ARCHIVE_NEU_URL;
const envBackendBase = _env?.VITE_QUANTIS_API_URL;
const isLocalhost =
  typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
const isResearchNeu =
  typeof window !== "undefined" && window.location.hostname.toLowerCase() === "research.neu.edu.vn";
const RESEARCH_NEU_ARCHIVE = _env?.VITE_RESEARCH_NEU_ARCHIVE ?? "https://research.neu.edu.vn/api/archive";
const RESEARCH_NEU_ARCHIVE_FILE = _env?.VITE_RESEARCH_NEU_ARCHIVE_FILE ?? "https://research.neu.edu.vn/api/archive-file";

/** URL Archive mặc định để hiển thị trong form (research.neu.edu.vn). */
export function getDefaultArchiveUrl(): string {
  return isResearchNeu ? RESEARCH_NEU_ARCHIVE : "";
}

/** URL Archive file mặc định để hiển thị trong form (research.neu.edu.vn). */
export function getDefaultArchiveFileUrl(): string {
  return isResearchNeu ? RESEARCH_NEU_ARCHIVE_FILE : "";
}

/** Trả về base URL hiện tại cho Archive API (cấu hình từ Cài đặt > env > proxy > mặc định). */
function getEffectiveArchiveBase(): string {
  const stored = loadArchiveUrl();
  if (stored != null && String(stored).trim() !== "") return String(stored).trim().replace(/\/+$/, "");
  const backendBase = loadBackendApiUrl() || (envBackendBase != null && String(envBackendBase).trim() !== "" ? String(envBackendBase).trim().replace(/\/+$/, "") : "");
  if (backendBase) return backendBase + "/api/quantis/archive";
  if (explicitBase != null && String(explicitBase).trim() !== "") return String(explicitBase).trim();
  if (isResearchNeu) return RESEARCH_NEU_ARCHIVE;
  return isLocalhost ? "/api/quantis/archive" : RESEARCH_NEU_ARCHIVE;
}

/** Base URL đầy đủ cho API (có /api/v1 khi gọi trực tiếp, hoặc origin + path khi proxy). */
function getEffectiveArchiveApi(): string {
  const base = getEffectiveArchiveBase();
  const isProxy = base.startsWith("/");
  if (isProxy) return (typeof window !== "undefined" ? window.location.origin : "") + base;
  return `${base}/api/v1`;
}

/** Host tải file: chỉ từ Cài đặt hoặc env; research.neu.edu.vn mặc định /api/archive-file. */
function getEffectiveArchiveFileBase(): string {
  const stored = loadArchiveFileUrl();
  if (stored != null && String(stored).trim() !== "") return String(stored).trim().replace(/\/+$/, "");
  const envBase =
    typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_ARCHIVE_FILE_BASE_URL?: string } }).env?.VITE_ARCHIVE_FILE_BASE_URL;
  if (envBase != null && String(envBase).trim() !== "") return String(envBase).trim().replace(/\/+$/, "");
  if (isResearchNeu) return RESEARCH_NEU_ARCHIVE_FILE;
  return "";
}

/** Prefix proxy tải file: localhost (Vite) → /api/quantis/archive-file; research.neu.edu.vn → /api/archive-file. */
function getArchiveFileProxyPath(): string | null {
  if (typeof window === "undefined") return null;
  const h = window.location.hostname.toLowerCase();
  if (h === "localhost" || h === "127.0.0.1") return "/api/quantis/archive-file";
  if (h === "research.neu.edu.vn") return "/api/archive-file";
  return null;
}

/** Chuyển URL tải file: dùng proxy same-origin khi có (localhost, research.neu.edu.vn), còn lại dùng base từ Cài đặt/env; nếu không có thì giữ URL gốc. */
function rewriteFileDownloadUrl(url: string): string {
  try {
    const u = new URL(url);
    const pathAndSearch = (u.pathname.startsWith("/") ? u.pathname : "/" + u.pathname) + u.search;
    const proxyPath = getArchiveFileProxyPath();
    if (proxyPath) {
      return (typeof window !== "undefined" ? window.location.origin : "") + proxyPath + pathAndSearch;
    }
    const base = getEffectiveArchiveFileBase();
    if (!base) return url;
    return base + pathAndSearch;
  } catch {
    return url;
  }
}

function getHeaders(): HeadersInit {
  const token =
    typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_ARCHIVE_NEU_TOKEN?: string } }).env?.VITE_ARCHIVE_NEU_TOKEN;
  const h: HeadersInit = { "Content-Type": "application/json" };
  if (token) (h as Record<string, string>)["Authorization"] = `Bearer ${token}`;
  return h;
}

export interface ArchiveSearchItem {
  id: string;
  requestId?: string;
  title: string;
  description?: string;
  status?: string;
  public?: boolean;
  [key: string]: unknown;
}

export interface ArchiveSearchResult {
  items?: ArchiveSearchItem[];
  data?: ArchiveSearchItem[];
  total?: number;
  page?: number;
  page_size?: number;
}

function normalizeRequestItems(raw: unknown): ArchiveSearchItem[] {
  if (!raw || !Array.isArray(raw)) return [];
  return raw.map((x: Record<string, unknown>) => ({
    id: String(x.id ?? x.requestId ?? x.request_id ?? x.RequestID ?? ""),
    requestId: String(x.requestId ?? x.request_id ?? x.id ?? x.RequestID ?? ""),
    title: String(x.title ?? x.name ?? x.Title ?? "Dataset"),
    description: x.description != null ? String(x.description) : (x.Description != null ? String(x.Description) : undefined),
    status: x.status != null ? String(x.status) : undefined,
    public: x.public as boolean | undefined,
    ...x,
  }));
}

/**
 * 1. Danh sách / tìm dataset (DataD3).
 * Không dùng /requests/search — chỉ dùng:
 * - GET /api/v1/requests/?skip=&limit= (khi không có query)
 * - GET /api/v1/search/ask?query=&limit=&offset= (khi có query)
 */
export async function searchDatasets(
  page: number = 1,
  pageSize: number = 10,
  query?: string
): Promise<ArchiveSearchResult> {
  const skip = (page - 1) * pageSize;
  const hasQuery = typeof query === "string" && query.trim() !== "";

  if (hasQuery) {
    const url = `${getEffectiveArchiveApi()}/search/ask?query=${encodeURIComponent(query.trim())}&limit=${pageSize}&offset=${skip}`;
    const res = await fetch(url, { method: "GET", headers: getHeaders(), credentials: "omit" });
    if (!res.ok) {
      const body = await res.text();
      const target = res.headers.get("X-Archive-Target-URL");
      const method = res.headers.get("X-Archive-Target-Method") || "GET";
      const reqLine = target ? `Backend gọi Archive: ${method} ${target}` : `Request: GET ${url}`;
      throw new Error(`Archive search failed: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}\n${reqLine}`);
    }
    const json = (await res.json()) as { data?: unknown[]; items?: unknown[]; total?: number };
    const items = normalizeRequestItems(json.data ?? json.items ?? json);
    return {
      items,
      total: json.total ?? items.length,
      page,
      page_size: pageSize,
    };
  }

  const url = `${getEffectiveArchiveApi()}/requests/?skip=${skip}&limit=${pageSize}`;
  const res = await fetch(url, { method: "GET", headers: getHeaders(), credentials: "omit" });
  if (!res.ok) {
    const body = await res.text();
    const target = res.headers.get("X-Archive-Target-URL");
    const method = res.headers.get("X-Archive-Target-Method") || "GET";
    const reqLine = target ? `Backend gọi Archive: ${method} ${target}` : `Request: GET ${url}`;
    throw new Error(`Archive list requests failed: ${res.status} ${res.statusText}${body ? ` — ${body.slice(0, 200)}` : ""}\n${reqLine}`);
  }
  const json = (await res.json()) as { data?: unknown[]; total?: number };
  const items = normalizeRequestItems(json.data ?? json);
  return {
    items,
    total: json.total ?? items.length,
    page,
    page_size: pageSize,
  };
}

export interface ArchiveRequestDetail {
  id?: string;
  requestId?: string;
  title?: string;
  description?: string;
  metadata?: Record<string, unknown>;
  files?: { id: string; file_name: string; file_type?: string; size?: number }[];
  [key: string]: unknown;
}

/** 2. Chi tiết dataset: GET /api/v1/requests/{requestId} */
export async function getRequestDetail(requestId: string): Promise<ArchiveRequestDetail> {
  const url = `${getEffectiveArchiveApi()}/requests/${encodeURIComponent(requestId)}`;
  const res = await fetch(url, { method: "GET", headers: getHeaders(), credentials: "omit" });
  if (!res.ok) {
    const target = res.headers.get("X-Archive-Target-URL");
    const method = res.headers.get("X-Archive-Target-Method") || "GET";
    const reqLine = target ? `Backend gọi Archive: ${method} ${target}` : `Request: GET ${url}`;
    throw new Error(`Archive request detail failed: ${res.status}\n${reqLine}`);
  }
  return res.json();
}

export interface ArchiveFileItem {
  id: string;
  file_name: string;
  file_type?: string;
  size?: number;
  [key: string]: unknown;
}

/** 3. Danh sách file theo request (DataD3: GET /api/v1/files/?request_id=) */
export async function getFilesByRequest(requestId: string): Promise<ArchiveFileItem[]> {
  const url = `${getEffectiveArchiveApi()}/files/?request_id=${encodeURIComponent(requestId)}&limit=100`;
  const res = await fetch(url, { method: "GET", headers: getHeaders(), credentials: "omit" });
  if (!res.ok) {
    const target = res.headers.get("X-Archive-Target-URL");
    const method = res.headers.get("X-Archive-Target-Method") || "GET";
    const reqLine = target ? `Backend gọi Archive: ${method} ${target}` : `Request: GET ${url}`;
    throw new Error(`Archive files list failed: ${res.status}\n${reqLine}`);
  }
  const data = await res.json();
  const list = (data?.data ?? data?.files ?? data?.items ?? data);
  const arr = Array.isArray(list) ? list : [];
  return arr.map((f: Record<string, unknown>) => {
    const fileId = f.id ?? f.FileID ?? f.file_id ?? f.Id ?? "";
    return {
      id: String(fileId),
      file_name: String(f.file_name ?? f.name ?? f.filename ?? f.FileName ?? ""),
      file_type: f.file_type != null ? String(f.file_type) : (f.FileType != null ? String(f.FileType) : undefined),
      size: typeof f.size === "number" ? f.size : (typeof (f as { Size?: number }).Size === "number" ? (f as { Size?: number }).Size : undefined),
      ...f,
    };
  });
}

/** 4. Download (DataD3: POST /api/v1/files/download → download_url). */
export async function requestDownload(
  fileId: string,
  _requestId: string
): Promise<{ url?: string; blob?: Blob; text?: string }> {
  const id = String(fileId ?? "").trim();
  if (!id) throw new Error("File ID trống. Kiểm tra API danh sách file trả về trường id/FileID.");
  const url = `${getEffectiveArchiveApi()}/files/download`;
  const res = await fetch(url, {
    method: "POST",
    headers: getHeaders(),
    credentials: "omit",
    body: JSON.stringify({ file_id: id }),
  });
  if (!res.ok) {
    const target = res.headers.get("X-Archive-Target-URL");
    const method = res.headers.get("X-Archive-Target-Method") || "POST";
    const reqLine = target ? `Backend gọi Archive: ${method} ${target} body: {"file_id":"${fileId}"}` : `Request: POST ${url} body: {"file_id":"${fileId}"}`;
    throw new Error(`Archive download failed: ${res.status} ${res.statusText}\n${reqLine}`);
  }

  const contentType = res.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    const json = (await res.json()) as { download_url?: string; url?: string; presigned_url?: string; data?: { url?: string } };
    const url = json.download_url ?? json.url ?? json.presigned_url ?? json.data?.url;
    if (url && typeof url === "string") return { url };
    throw new Error("Archive download response has no URL");
  }

  const blob = await res.blob();
  const text = await blob.text();
  return { blob, text };
}

/** Tải nội dung file CSV từ Archive (DataD3: ưu tiên GET preview, fallback POST download + fetch URL). */
export async function fetchArchiveFileAsText(
  fileId: string,
  requestId: string
): Promise<string> {
  const previewUrl = `${getEffectiveArchiveApi()}/files/${encodeURIComponent(fileId)}/preview`;
  const previewRes = await fetch(previewUrl, { method: "GET", headers: getHeaders(), credentials: "omit" });
  if (previewRes.ok) {
    const ct = previewRes.headers.get("content-type") ?? "";
    if (ct.includes("text/") || ct.includes("application/csv") || ct.includes("application/octet-stream")) {
      return previewRes.text();
    }
    const text = await previewRes.text();
    const trimmed = text.trim();
    if (trimmed.startsWith("{") || trimmed.startsWith("[")) {
      const json = JSON.parse(text) as { content?: string; data?: string; text?: string };
      if (typeof json.content === "string") return json.content;
      if (typeof json.data === "string") return json.data;
      if (typeof json.text === "string") return json.text;
    } else {
      return text;
    }
  }

  const out = await requestDownload(fileId, requestId);
  if (out.text) return out.text;
  if (out.url) {
    const fileUrl = rewriteFileDownloadUrl(out.url);
    const isPresigned = out.url.includes("X-Amz-");
    // Presigned URL: chỉ dùng query string, không gửi Authorization/Content-Type (dễ gây 403)
    const r = await fetch(fileUrl, {
      method: "GET",
      ...(isPresigned ? { credentials: "omit" } : { headers: getHeaders(), credentials: "include" }),
    });
    if (!r.ok) throw new Error(`Fetch download URL failed: ${r.status}`);
    return r.text();
  }
  if (out.blob) return out.blob.text();
  throw new Error("Archive download returned no content");
}

/** Kiểm tra Archive API có phản hồi (GET /requests/?limit=1). urlOverride: địa chỉ base Archive (tùy chọn). */
export async function checkArchiveApiAvailable(archiveBaseUrl?: string): Promise<boolean> {
  let apiRoot: string;
  if (archiveBaseUrl != null && String(archiveBaseUrl).trim() !== "") {
    const b = String(archiveBaseUrl).trim().replace(/\/+$/, "");
    apiRoot = b.includes("/api/archive") || b.includes("/api/quantis/archive") ? b : `${b}/api/v1`;
  } else {
    apiRoot = getEffectiveArchiveApi();
  }
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 5000);
    const res = await fetch(`${apiRoot}/requests/?limit=1`, { method: "GET", headers: getHeaders(), credentials: "omit", signal: c.signal });
    clearTimeout(t);
    return res.ok;
  } catch {
    return false;
  }
}

/** Kiểm tra Archive file base có phản hồi (GET base URL). urlOverride: địa chỉ base tải file (tùy chọn). */
export async function checkArchiveFileBaseAvailable(fileBaseUrl?: string): Promise<boolean> {
  const base = (fileBaseUrl != null && String(fileBaseUrl).trim() !== "") ? String(fileBaseUrl).trim().replace(/\/+$/, "") : getEffectiveArchiveFileBase();
  if (!base) return false;
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 5000);
    const res = await fetch(base, { method: "GET", credentials: "omit", signal: c.signal });
    clearTimeout(t);
    return res.status < 500;
  } catch {
    return false;
  }
}
