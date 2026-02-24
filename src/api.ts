/**
 * Quantis API client: gọi backend Quantis khi nhúng Portal (có đăng nhập).
 * Khi backend không có hoặc chưa đăng nhập: dữ liệu chỉ lưu localStorage.
 */
import type { Dataset, Workflow } from "./types";

const base = (typeof import.meta !== "undefined" && (import.meta as { env?: { VITE_QUANTIS_API_URL?: string } }).env?.VITE_QUANTIS_API_URL) || "";
const API_BASE = `${String(base).replace(/\/+$/, "")}/api/quantis`;

function getHeaders(): HeadersInit {
  return { "Content-Type": "application/json" };
}

export async function checkBackendAvailable(): Promise<boolean> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 4000);
    const res = await fetch(`${API_BASE}/health`, {
      method: "GET",
      credentials: "include",
      signal: controller.signal,
    });
    clearTimeout(timeoutId);
    return res.ok;
  } catch {
    return false;
  }
}

/** Lấy toàn bộ datasets + workflows (cần đăng nhập). Trả về null nếu 401/lỗi. */
export async function getData(): Promise<{ datasets: Dataset[]; workflows: Workflow[] } | null> {
  try {
    const res = await fetch(`${API_BASE}/data`, { method: "GET", credentials: "include" });
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
  try {
    const res = await fetch(`${API_BASE}/data`, {
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
