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

export type TransformOperation =
  | "drop_missing" | "fill_mean" | "fill_median" | "fill_mode" | "fill_hot_deck" | "fill_mice"
  | "z_score" | "min_max" | "filter" | "sort" | "recode"
  | "rename" | "coerce_numeric" | "coerce_text" | "compute" | "log" | "outlier_iqr" | "dedupe";

export interface DatasetChangeSummary {
  action: "cell" | "paste" | "insertRow" | "deleteRow" | "metadata" | "renameColumn"
    | "insertColumn" | "deleteColumn" | "transform" | "extractImputation";
  columns?: string[];
  columnCount?: number;
  firstRow?: number;
  lastRow?: number;
  cellCount?: number;
  rowCount?: number;
  operation?: TransformOperation;
  formula?: string;
}

export type TransformChangeSummary = DatasetChangeSummary & { action: "transform"; operation: TransformOperation };
export type DerivationSummary = TransformChangeSummary | { action: "extractImputation"; member: number };

export type DatasetChangeDetails =
  | { kind: "commit" }
  | { kind: "undo" | "redo"; originalChangeId: string }
  | { kind: "derive"; source: { datasetId: string; name: string; member?: number } };

export type DatasetChange = DatasetChangeSummary & DatasetChangeDetails & {
  id: string;
  datasetId: string;
  timestamp: string;
};

export interface DatasetAuditLog {
  entries: DatasetChange[];
  /** Timestamp of the most recent entry removed by retention. */
  cutoffAt?: string;
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
  audit?: DatasetAuditLog;
}

// ---------------------------------------------------------------------------
// Regression diagnostics (Phase 4.1) — the /ols payload contract (spec R12)
// ---------------------------------------------------------------------------

export type RegressionVerdict = "pass" | "caution" | "violation";

export type AssumptionId = "linearity" | "normality" | "influence" | "collinearity";

export type NotApplicableReason = "singlePredictor" | "insufficientDf" | "notComputable";

export type DiagnosticsErrorCode = "insufficient_n" | "singular_x" | "not_available" | "internal";

export interface DiagnosticsSample {
  nInput: number;
  nUsed: number;
  nDropped: number;
  method: "listwise" | "mice-active";
  /** Multiplicity m; null without MICE. */
  m: number | null;
  /** 0 = original data, 1..m = the k-th imputed table; null without MICE. */
  activeImputation: number | null;
}

/** One observation of the Model sample; `rowIndex` is an Analysis row coordinate. */
export interface DiagnosticsObs {
  rowIndex: number[];
  fitted: Array<number | null>;
  resid: Array<number | null>;
  stdResid: Array<number | null>;
  studentized: Array<number | null>;
  leverage: Array<number | null>;
  cookD: Array<number | null>;
}

export interface DiagnosticsQq {
  theoretical: Array<number | null>;
  sample: Array<number | null>;
}

export interface LinearityStats {
  bp: { chi2: number; df: number; p: number };
  reset: { f: number; df1: number; df2: number; p: number };
}

export interface NormalityStats {
  test: "shapiro" | "jarqueBera";
  stat: number;
  p: number;
  skewness: number;
  excessKurtosis: number;
}

export interface InfluenceStats {
  maxCookD: number | null;
  nAbove4n: number;
  maxLeverage: number;
  leverageCut: number;
  /** null when the externally studentized residual is undefined (df_resid = 1). */
  maxStudentized: number | null;
  nStudentizedAbove3: number;
}

export interface CollinearityStats {
  maxVif: number | null;
}

/**
 * One Assumption Check row. An applicable row carries a Verdict and its statistics;
 * an inapplicable row carries only the reason (spec R2.5).
 */
export type AssumptionRow =
  | { id: "linearity"; applicable: true; verdict: RegressionVerdict; stats: LinearityStats }
  | { id: "normality"; applicable: true; verdict: RegressionVerdict; stats: NormalityStats }
  | { id: "influence"; applicable: true; verdict: RegressionVerdict; stats: InfluenceStats }
  | { id: "collinearity"; applicable: true; verdict: RegressionVerdict; stats: CollinearityStats }
  | { id: AssumptionId; applicable: false; notApplicableReason: NotApplicableReason };

export interface VifEntry {
  vif: number | null;
  tolerance: number | null;
}

/** A flagged observation: Cook's D above 4/n, largest first. */
export interface InfluentialObservation {
  rowIndex: number;
  cookD: number | null;
  leverage: number | null;
  studentized: number | null;
}

export interface RobustHC3Block {
  se: Record<string, number | null>;
  tStat: Record<string, number | null>;
  pValue: Record<string, number | null>;
  ciLower: Record<string, number | null>;
  ciUpper: Record<string, number | null>;
}

/** The numbers behind each threshold sentence, shipped from the backend constants (R3.6). */
export interface DiagnosticsThresholds {
  linearityAlpha: number;
  normalityAlpha: number;
  normalityViolationAlpha: number;
  normalitySkewGuard: number;
  normalityExcessKurtosisGuard: number;
  vifCaution: number;
  vifViolation: number;
  cookAbsolute: number;
  cookRelativeMultiplier: number;
  studentized: number;
}

export interface DiagnosticsPayloadOk {
  ok: true;
  errorCode: null;
  errorDetail: null;
  sample: DiagnosticsSample;
  obs: DiagnosticsObs;
  qq: DiagnosticsQq;
  assumptions: AssumptionRow[];
  vif: Record<string, VifEntry>;
  influential: InfluentialObservation[];
  robustHC3: RobustHC3Block;
  thresholds: DiagnosticsThresholds;
  sampled: boolean;
}

export interface DiagnosticsPayloadFailure {
  ok: false;
  errorCode: DiagnosticsErrorCode;
  errorDetail: string | null;
  /** Derivable sample accounting survives a failure (spec R1.2, R12). */
  sample?: DiagnosticsSample;
}

/** The immutable diagnostics result bound to one OLS run (spec R1.4). */
export type DiagnosticsPayload = DiagnosticsPayloadOk | DiagnosticsPayloadFailure;

// ---------------------------------------------------------------------------
// Reliability (Phase 4.2) — the data contract of spec §5
// ---------------------------------------------------------------------------

/** Cùng bộ từ vựng Verdict với Phase 4.1, thêm `notApplicable` cho thống kê không tính được. */
export type ReliabilityVerdict = "pass" | "caution" | "violation" | "notApplicable";

/** Verdict + câu lý do i18n (luôn kèm giá trị và ngưỡng đã dùng). */
export interface ReliabilityAssessment {
  verdict: ReliabilityVerdict;
  reasonKey: string;
  reasonParams: Record<string, string | number>;
}

/** Verdict cấp thang đo, kèm nhãn bậc chất lượng của α (null khi α không tính được). */
export interface ReliabilityScaleAssessment extends ReliabilityAssessment {
  bandKey: string | null;
}


export interface ReliabilityStatistics {
  alpha: number | null;
  /** α trên item đã chuẩn hóa (z-score) — dùng khi các item khác thang điểm. */
  alphaStandardized: number | null;
  /** Feldt 95% CI, kẹp về [0, 1]. */
  ci: { lower: number; upper: number } | null;
  k: number;
  nScaleSample: number;
  nInput: number;
  meanInterItemR: number | null;
}

export interface ReliabilityItemDiagnostic {
  name: string;
  reverse: boolean;
  /** Hằng số (min + max) đã dùng để phản chiếu; null khi không bật reverse. */
  reflectionConstant: number | null;
  mean: number;
  sd: number;
  /** Số ô thiếu của item này trên input sample. */
  missingInInput: number;
  correctedItemTotal: number | null;
  alphaIfDeleted: number | null;
  verdict: ReliabilityVerdict;
  /** i18n key + tham số, để lý do luôn đi kèm Verdict. */
  reasonKey: string;
  reasonParams: Record<string, string | number>;
}

/** Bước trong workflow phân tích (reproducible) */export interface WorkflowStep {
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


export type BarMode = "clustered" | "stacked";
export type ErrorBarType = "none" | "ci95" | "se" | "sd";
export type ColorPaletteName = "academic" | "colorblind" | "grayscale";
export type ChartSortOrder =
  | "category-asc"
  | "category-desc"
  | "value-asc"
  | "value-desc"
  | "none";

export interface ChartConfig {
  xCol: string;
  yCol: string;
  legendCol: string;
  aggregation: import("./utils/aggregation").AggregateFunction;
  barMode: BarMode;
  errorBar: ErrorBarType;
  palette: ColorPaletteName;
  titleOverride: string;
  subtitle: string;
  showDataLabels: boolean;
  decimals: number;
  sortOrder: ChartSortOrder;
}

export const DEFAULT_CHART_CONFIG: ChartConfig = {
  xCol: "",
  yCol: "",
  legendCol: "",
  aggregation: "mean",
  barMode: "clustered",
  errorBar: "none",
  palette: "academic",
  titleOverride: "",
  subtitle: "",
  showDataLabels: false,
  decimals: 2,
  sortOrder: "category-asc",
};

export interface ChartControls {
  histogramCol: string;
  showHistogramDensity: boolean;
  heatmapCorrMethod: "pearson" | "spearman" | "kendall";
  radarGroupCol: string;
  radarNumericCols: string[];
  densityGroupCol: string;
  densityValueCol: string;
  pieBinNumeric: boolean;
  pieBinCount: number;
  pieNumericCol: string;
}

export const DEFAULT_CHART_CONTROLS: ChartControls = {
  histogramCol: "",
  showHistogramDensity: false,
  heatmapCorrMethod: "pearson",
  radarGroupCol: "",
  radarNumericCols: [],
  densityGroupCol: "",
  densityValueCol: "",
  pieBinNumeric: false,
  pieBinCount: 4,
  pieNumericCol: "",
};
