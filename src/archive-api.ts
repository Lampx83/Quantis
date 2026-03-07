/**
 * API client cho Archive NEU (DataD3 / archive.neu.edu.vn).
 * Định dạng API theo code DataD3: search/ask, requests list, files by request_id, preview, download.
 * - Proxy: VITE_ARCHIVE_NEU_URL=/api/quantis/archive (path tương đối).
 * - Tải file: URL trả về được chuyển sang VITE_ARCHIVE_FILE_BASE_URL (mặc định http://101.96.66.222:8013)
 *   để tránh CORS từ files-archive.neu.edu.vn. Auth: VITE_ARCHIVE_NEU_TOKEN hoặc credentials.
 */

const _env = typeof import.meta !== "undefined" ? (import.meta as { env?: { VITE_ARCHIVE_NEU_URL?: string } }).env : undefined;
const explicitBase = _env?.VITE_ARCHIVE_NEU_URL;
// Mặc định dev (localhost) dùng proxy qua backend để tránh 422 từ API gốc; production set VITE_ARCHIVE_NEU_URL nếu cần.
const isLocalhost =
  typeof window !== "undefined" && (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
/** API Archive mặc định: 101.96.66.222:8010 (DataNEU). Có thể ghi đè bằng VITE_ARCHIVE_NEU_URL. */
const DEFAULT_ARCHIVE_BASE = "http://101.96.66.222:8010";
const BASE =
  explicitBase != null && String(explicitBase).trim() !== ""
    ? String(explicitBase).trim()
    : isLocalhost
      ? "/api/quantis/archive"
      : DEFAULT_ARCHIVE_BASE;
const isProxy = typeof BASE === "string" && BASE.startsWith("/");
const API = isProxy
  ? (typeof window !== "undefined" ? window.location.origin : "") + String(BASE).replace(/\/+$/, "")
  : `${String(BASE).replace(/\/+$/, "")}/api/v1`;

/** Host tải file trực tiếp (có thể bị CORS). Dùng proxy khi chạy trên localhost. */
const FILE_DOWNLOAD_BASE =
  (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_ARCHIVE_FILE_BASE_URL?: string } }).env?.VITE_ARCHIVE_FILE_BASE_URL) ||
  "http://101.96.66.222:8013";

/** Prefix proxy tải file (Vite chuyển tiếp → 8013, tránh CORS). */
const ARCHIVE_FILE_PROXY_PATH = "/api/quantis/archive-file";

/** Chuyển URL tải file: trên localhost dùng proxy (tránh CORS), còn lại dùng FILE_DOWNLOAD_BASE. */
function rewriteFileDownloadUrl(url: string): string {
  try {
    const u = new URL(url);
    const pathAndSearch = (u.pathname.startsWith("/") ? u.pathname : "/" + u.pathname) + u.search;
    const isLocalhost =
      typeof window !== "undefined" &&
      (window.location.hostname === "localhost" || window.location.hostname === "127.0.0.1");
    if (isLocalhost) {
      return window.location.origin + ARCHIVE_FILE_PROXY_PATH + pathAndSearch;
    }
    const base = FILE_DOWNLOAD_BASE.replace(/\/+$/, "");
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
    const url = `${API}/search/ask?query=${encodeURIComponent(query.trim())}&limit=${pageSize}&offset=${skip}`;
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

  const url = `${API}/requests/?skip=${skip}&limit=${pageSize}`;
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
  const url = `${API}/requests/${encodeURIComponent(requestId)}`;
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
  const url = `${API}/files/?request_id=${encodeURIComponent(requestId)}&limit=100`;
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
  const url = `${API}/files/download`;
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
  const previewUrl = `${API}/files/${encodeURIComponent(fileId)}/preview`;
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
