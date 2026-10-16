export type VariableType = "numeric" | "string" | "date";
export type VariableMeasure = "scale" | "ordinal" | "nominal";
export type VariableAlign = "left" | "right" | "center";

export interface VariableMetadata {
  /** Tên định danh biến (chuẩn hóa không dấu, không khoảng trắng, vd: Q1_1, AGE) */
  name: string;
  /** Kiểu dữ liệu */
  type: VariableType;
  /** Nhãn diễn giải đầy đủ (vd: "Tôi hài lòng với chất lượng dịch vụ của nhà trường") */
  label: string;
  /** Ánh xạ giá trị mã hóa -> nhãn định tính (vd: { "1": "Hoàn toàn không đồng ý", ..., "5": "Hoàn toàn đồng ý" }) */
  valueLabels?: Record<string, string>;
  /** Thước đo thang đo quyết định gợi ý kiểm định và đồ thị */
  measure: VariableMeasure;
  /** Danh sách các mã số quy ước khuyết dữ liệu (vd: ["99", "999", "-1"]) */
  missingValues?: string[];
  /** Số chữ số sau dấu phẩy hiển thị (mặc định: 0) */
  decimals: number;
  /** Căn lề hiển thị (numeric: right; string: left; nominal/ordinal: center/left) */
  align: VariableAlign;
  /** Độ rộng cột mặc định (pixels) */
  width?: number;
}

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
  /** Bổ sung từ điển metadata cho từng biến (key là column name) */
  variables?: Record<string, VariableMetadata>;
  /** Định dạng nguồn: csv, excel, spss, stata, … */
  sourceFormat: string;
  /** Nguồn gốc để tránh thêm trùng: sample:<id> hoặc archive:<requestId>:<fileId> */
  sourceKey?: string;
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
  /** Mô tả ngắn đã thực hiện phân tích gì (cho mẫu/demo) */
  resultSummary?: string;
  /** Ghi chú của người dùng cho bước này */
  note?: string;
}

/** Workflow nghiên cứu – chuỗi bước có thể tái lập */
export interface Workflow {
  id: string;
  name: string;
  description?: string;
  steps: WorkflowStep[];
  /** @deprecated Dùng datasetIds. Một workflow có thể dùng nhiều bộ dữ liệu. */
  datasetId?: string | null;
  /** Các bộ dữ liệu đã dùng trong workflow (import hoặc gắn vào bước). */
  datasetIds?: string[];
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
