import type { Dataset, Workflow } from "./types";

const STORAGE_PREFIX = "quantis_";

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
  } catch {
    /* ignore */
  }
}

/** Mô hình AI (Ollama/OpenAI) đã chọn trong Cài đặt. null = dùng mặc định từ env. */
export function loadAiModel(): string | null {
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

/** Góp ý AI (like/dislike + comment khi dislike). Lưu local để sau có thể gửi lên server. */
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
