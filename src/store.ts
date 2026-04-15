import type { Dataset, Workflow } from "./types";

const STORAGE_PREFIX = "quantis_";
const REPORT_CHARTS_KEY = "reportCharts";

/** Cấu hình lấy từ server (dùng chung mọi tài khoản). Ưu tiên hơn localStorage. */
export type ServerSettings = {
  backendApiUrl?: string | null;
  archiveUrl?: string | null;
  archiveFileUrl?: string | null;
  /** @deprecated Trình duyệt chỉ gọi Ollama qua backend /api/quantis/ollama */
  aiApiUrl?: string | null;
  /** URL Ollama mà Node proxy tới (vd. http://127.0.0.1:11434); lưu server, dùng chung mọi tài khoản */
  ollamaUpstreamUrl?: string | null;
  defaultAiModel?: string | null;
};

let serverSettingsCache: ServerSettings | null = null;

export function getServerSettings(): ServerSettings | null {
  return serverSettingsCache;
}

export function setServerSettings(settings: ServerSettings | null): void {
  serverSettingsCache = settings;
}

function getKey(key: string): string {
  return STORAGE_PREFIX + key;
}

export function loadDatasets(): Dataset[] {
  try {
    const raw = localStorage.getItem(getKey("datasets"));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveDatasets(datasets: Dataset[]): void {
  try {
    localStorage.setItem(getKey("datasets"), JSON.stringify(datasets));
  } catch {
    /* ignore */
  }
}

export function loadWorkflows(): Workflow[] {
  try {
    const raw = localStorage.getItem(getKey("workflows"));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveWorkflows(workflows: Workflow[]): void {
  try {
    localStorage.setItem(getKey("workflows"), JSON.stringify(workflows));
  } catch {
    /* ignore */
  }
}

export function generateId(): string {
  return crypto.randomUUID?.() ?? `q-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function loadSelectedDatasetId(): string | null {
  try {
    return localStorage.getItem(getKey("selectedDatasetId"));
  } catch {
    return null;
  }
}

export function saveSelectedDatasetId(id: string | null): void {
  try {
    if (id) localStorage.setItem(getKey("selectedDatasetId"), id);
    else localStorage.removeItem(getKey("selectedDatasetId"));
  } catch {
    /* ignore */
  }
}

/** Xóa toàn bộ dữ liệu Quantis khỏi localStorage (dùng khi reset workspace). */
export function clearWorkspaceStorage(): void {
  try {
    localStorage.removeItem(getKey("datasets"));
    localStorage.removeItem(getKey("workflows"));
    localStorage.removeItem(getKey("selectedDatasetId"));
    localStorage.removeItem(getKey(REPORT_CHARTS_KEY));
  } catch {
    /* ignore */
  }
}

/**
 * Xóa mọi khóa `quantis_*` trong localStorage + dữ liệu Writium đồng bộ (pre-reg / checklist).
 * Giống lần đầu mở app: không còn workspace, URL backend/Ollama/Archive lưu cục bộ, model AI, góp ý, v.v.
 * Không xóa theme/i18n toàn cục (portal-embed-theme, v.v.).
 */
export function clearQuantisLocalAppData(): void {
  try {
    const toRemove: string[] = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith(STORAGE_PREFIX)) toRemove.push(k);
    }
    toRemove.forEach((k) => localStorage.removeItem(k));
    localStorage.removeItem("writium_research_protocols");
    localStorage.removeItem("protocolum_protocols");
  } catch {
    /* ignore */
  }
}

/**
 * Chỉ xóa bản sao datasets/workflows trên localStorage.
 * Dùng sau khi đã hydrate từ server để tránh nhầm dữ liệu tài khoản khác / bản cũ.
 */
export function clearWorkspaceLocalData(): void {
  try {
    localStorage.removeItem(getKey("datasets"));
    localStorage.removeItem(getKey("workflows"));
  } catch {
    /* ignore */
  }
}

/** Mô hình AI đã chọn. Ưu tiên: server defaultAiModel → localStorage → env. */
export function loadAiModel(): string | null {
  const fromServer = getServerSettings()?.defaultAiModel;
  if (fromServer != null && String(fromServer).trim() !== "") return String(fromServer).trim();
  try {
    return localStorage.getItem(getKey("aiModel"));
  } catch {
    return null;
  }
}

export function saveAiModel(model: string | null): void {
  try {
    if (model) localStorage.setItem(getKey("aiModel"), model);
    else localStorage.removeItem(getKey("aiModel"));
  } catch {
    /* ignore */
  }
}

/** Địa chỉ backend Quantis (Node). Ưu tiên: server settings → localStorage → env. */
export function loadBackendApiUrl(): string | null {
  const fromServer = getServerSettings()?.backendApiUrl;
  if (fromServer != null && String(fromServer).trim() !== "") return String(fromServer).trim().replace(/\/+$/, "");
  try {
    return localStorage.getItem(getKey("backendApiUrl"));
  } catch {
    return null;
  }
}

export function saveBackendApiUrl(url: string | null): void {
  try {
    if (url != null && String(url).trim() !== "") {
      localStorage.setItem(getKey("backendApiUrl"), String(url).trim().replace(/\/+$/, ""));
    } else {
      localStorage.removeItem(getKey("backendApiUrl"));
    }
  } catch {
    /* ignore */
  }
}

/** Địa chỉ Archive (API tìm kiếm/tải dataset). Ưu tiên: server → localStorage → proxy/env. */
export function loadArchiveUrl(): string | null {
  const fromServer = getServerSettings()?.archiveUrl;
  if (fromServer != null && String(fromServer).trim() !== "") return String(fromServer).trim().replace(/\/+$/, "");
  try {
    return localStorage.getItem(getKey("archiveUrl"));
  } catch {
    return null;
  }
}

export function saveArchiveUrl(url: string | null): void {
  try {
    if (url != null && String(url).trim() !== "") {
      localStorage.setItem(getKey("archiveUrl"), String(url).trim().replace(/\/+$/, ""));
    } else {
      localStorage.removeItem(getKey("archiveUrl"));
    }
  } catch {
    /* ignore */
  }
}

/** Địa chỉ Archive file (tải file). Ưu tiên: server → localStorage → env. */
export function loadArchiveFileUrl(): string | null {
  const fromServer = getServerSettings()?.archiveFileUrl;
  if (fromServer != null && String(fromServer).trim() !== "") return String(fromServer).trim().replace(/\/+$/, "");
  try {
    return localStorage.getItem(getKey("archiveFileUrl"));
  } catch {
    return null;
  }
}

export function saveArchiveFileUrl(url: string | null): void {
  try {
    if (url != null && String(url).trim() !== "") {
      localStorage.setItem(getKey("archiveFileUrl"), String(url).trim().replace(/\/+$/, ""));
    } else {
      localStorage.removeItem(getKey("archiveFileUrl"));
    }
  } catch {
    /* ignore */
  }
}

/** URL upstream Ollama trên server (cấu hình dùng chung). Chỉ để hiển thị trong Cài đặt. */
export function loadOllamaUpstreamFromServer(): string | null {
  const fromServer = getServerSettings()?.ollamaUpstreamUrl;
  if (fromServer != null && String(fromServer).trim() !== "") return String(fromServer).trim().replace(/\/+$/, "");
  return null;
}
export type AiFeedbackEntry = {
  type: "ai_response";
  timestamp: string;
  feedback: "like" | "dislike";
  resultPreview: string;
  reason?: string;
  comment?: string;
};

/** Góp ý chung cho ứng dụng. */
export type AppFeedbackEntry = {
  type: "app";
  timestamp: string;
  content: string;
};

const FEEDBACK_KEY = "ai_feedback";

function loadFeedbackRaw(): (AiFeedbackEntry | AppFeedbackEntry)[] {
  try {
    const raw = localStorage.getItem(getKey(FEEDBACK_KEY));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveAiFeedback(entry: Omit<AiFeedbackEntry, "type" | "timestamp">): void {
  try {
    const list = loadFeedbackRaw();
    list.push({
      type: "ai_response",
      timestamp: new Date().toISOString(),
      ...entry,
    });
    localStorage.setItem(getKey(FEEDBACK_KEY), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

export function saveAppFeedback(content: string): void {
  try {
    const list = loadFeedbackRaw();
    list.push({
      type: "app",
      timestamp: new Date().toISOString(),
      content: content.trim().slice(0, 4000),
    });
    localStorage.setItem(getKey(FEEDBACK_KEY), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}

/** Biểu đồ đã lưu để đưa vào báo cáo nghiên cứu */
export type SavedReportChart = {
  id: string;
  title: string;
  caption?: string;
  chartType: string;
  /** PNG base64 data URL hoặc SVG string (prefix data:image/svg+xml;base64,...) */
  imageDataUrl: string;
  createdAt: string;
};

export function loadReportCharts(): SavedReportChart[] {
  try {
    const raw = localStorage.getItem(getKey(REPORT_CHARTS_KEY));
    if (!raw) return [];
    return JSON.parse(raw);
  } catch {
    return [];
  }
}

export function saveReportChart(entry: Omit<SavedReportChart, "id" | "createdAt">): SavedReportChart {
  const list = loadReportCharts();
  const newEntry: SavedReportChart = {
    ...entry,
    id: generateId(),
    createdAt: new Date().toISOString(),
  };
  list.push(newEntry);
  try {
    localStorage.setItem(getKey(REPORT_CHARTS_KEY), JSON.stringify(list));
  } catch {
    /* ignore */
  }
  return newEntry;
}

export function removeReportChart(id: string): void {
  const list = loadReportCharts().filter((c) => c.id !== id);
  try {
    localStorage.setItem(getKey(REPORT_CHARTS_KEY), JSON.stringify(list));
  } catch {
    /* ignore */
  }
}
