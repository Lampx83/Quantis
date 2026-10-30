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
  /**
   * Khoảng mã khuyết kiểu SPSS (vd: 98–99) — chỉ áp dụng cho giá trị số, bao gồm cả hai đầu mút.
   * Có thể dùng kèm tối đa 1 mã rời rạc trong `missingValues` (giống hộp thoại Missing Values của SPSS).
   */
  missingRange?: { min: number; max: number };
  /** Số chữ số sau dấu phẩy hiển thị (mặc định: 0) */
  decimals: number;
  /** Căn lề hiển thị (numeric: right; string: left; nominal/ordinal: center/left) */
  align: VariableAlign;
  /** Độ rộng cột mặc định (pixels) */
  width?: number;
}

/** Ô dữ liệu khuyết được điền theo dạng Sparse Delta */
export interface ImputationSparseCell {
  /** Vị trí dòng (0-indexed trong dataRows) */
  rowIndex: number;
  /** Mảng m giá trị tương ứng cho m bộ nội suy */
  values: string[];
}

/** Thống kê mô tả gộp theo luật Rubin cho một biến số */
export interface RubinColumnStatistic {
  column: string;
  missingCount: number;
  originalMean?: number | null;
  originalStd?: number | null;
  pooledMean: number;
  withinVariance: number;
  betweenVariance: number;
  totalVariance: number;
  rubinSe: number;
  df: number;
  fmi: number;
  ciLower: number;
  ciUpper: number;
}

/** Metadata quản lý Bundle đa nhập liệu (MICE Multiple Imputation) */
export interface ImputationMeta {
  /** UUID định danh nhóm bundle */
  bundleId: string;
  /** Số lượng bộ dữ liệu (vd: 5) */
  m: number;
  /** 0: Gốc, 1..m: Bộ điền i */
  activeImputationIndex: number;
  /** Danh sách các cột đã nội suy */
  imputedColumns: string[];
  /** Thống kê Rubin tính sẵn */
  rubinStatistics?: RubinColumnStatistic[];
  /** Sparse delta: map từng cột khuyết sang danh sách các ô được điền */
  sparsePatches: Record<string, ImputationSparseCell[]>;
  /** Bảng dữ liệu gốc ban đầu chứa các ô khuyết */
  originalRows: string[][];
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
  /** Metadata đa nhập liệu nếu dataset là MICE Bundle */
  imputationMeta?: ImputationMeta;
  /** Khóa chỉnh sửa nếu là bundle chỉ đọc */
  readOnly?: boolean;
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
  /** Cột số khai báo: số ô không trống nhưng không phải số hợp lệ (bỏ qua khi tính, không tính vào `missing`). */
  nonNumeric?: number;
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
