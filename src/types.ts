/** Dataset: bảng dữ liệu đã import (CSV, Excel, SPSS, …) */
export interface Dataset {
  id: string;
  name: string;
  /** Số dòng, số cột */
  rows: number;
  columns: number;
  /** Tên cột */
  columnNames: string[];
  /** Mẫu dữ liệu (preview) */
  preview: string[][];
  /** Toàn bộ dữ liệu (khi import CSV); nếu có thì dùng cho profiling/stats */
  data?: string[][];
  /** Định dạng nguồn: csv, excel, spss, stata, … */
  sourceFormat: string;
  createdAt: string;
  updatedAt: string;
}

/** Bước trong workflow phân tích (reproducible) */
export interface WorkflowStep {
  id: string;
  type: "import" | "clean" | "transform" | "describe" | "test" | "model" | "visualize" | "report";
  label: string;
  config: Record<string, unknown>;
  order: number;
  createdAt: string;
}

/** Workflow nghiên cứu – chuỗi bước có thể tái lập */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  datasetId: string | null;
  createdAt: string;
  updatedAt: string;
}

/** Kết quả data profiling (missing, outliers, distribution) */
export interface DataProfile {
  column: string;
  type: string;
  missing: number;
  missingPct: number;
  unique: number;
  min?: number;
  max?: number;
  mean?: number;
  std?: number;
  skew?: number;
}

/** Gợi ý AI: phương pháp thống kê / diễn giải */
export interface AIRecommendation {
  id: string;
  type: "method" | "interpretation" | "warning";
  title: string;
  message: string;
  createdAt: string;
}
