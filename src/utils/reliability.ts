/**
 * Thống kê độ tin cậy nội tại (Cronbach's alpha) — nguồn DUY NHẤT của công thức (ADR-0002).
 *
 * Hàm thuần: chỉ nhận mảng chuỗi/số và trả số. Không store, không localStorage, không fetch —
 * nhờ vậy mọi thao tác tương tác (đảo điểm, loại item, chốt thang đo) test được trực tiếp
 * trong môi trường `node` mà không cần jsdom.
 */

import type {
  ReliabilityAssessment,
  ReliabilityItemDiagnostic,
  ReliabilityScaleAssessment,
  ReliabilityStatistics,
} from "../types";
import { fQuantile } from "./stats";

/** Một Scale sample dạng listwise: mọi dòng đều có giá trị số ở MỌI item. */
export interface ScaleSample {
  /** Ma trận m × k, đã áp dụng đảo điểm; cột theo đúng thứ tự `items`. */
  data: number[][];
  /** Chỉ số dòng trong mảng `rows` ban đầu (header ở 0) của từng dòng được giữ. */
  sourceRowIndexes: number[];
  /** Số dòng đầu vào trước khi loại listwise — để người dùng thấy phần dữ liệu bị mất. */
  nInput: number;
}

/** Số liệu thô của một item; Verdict/lý do được gắn ở tầng ngưỡng (`assessItems`). */
export interface ReliabilityItemStatistics {
  name: string;
  mean: number;
  sd: number;
  missingInInput: number;
  correctedItemTotal: number | null;
  alphaIfDeleted: number | null;
}

const meanOf = (a: number[]) => a.reduce((x, y) => x + y, 0) / a.length;

/** Phương sai mẫu (n − 1): α và SD của item đều dùng ước lượng không lệch này, giống SPSS. */
const varOf = (a: number[]) => {
  const m = meanOf(a);
  return a.reduce((s, x) => s + (x - m) ** 2, 0) / (a.length - 1);
};

const sdOf = (a: number[]) => Math.sqrt(varOf(a));

/**
 * Đọc một ô thành số. Ô trống / chỉ khoảng trắng / chữ → NaN (thiếu), KHÔNG phải 0:
 * `Number("") === 0` sẽ biến ô khuyết thành câu trả lời "0" và làm lệch mọi thống kê.
 */
function parseNumber(raw: unknown): number {
  if (raw === null || raw === undefined) return NaN;
  const s = typeof raw === "string" ? raw.trim() : String(raw);
  if (s === "") return NaN;
  const v = Number(s);
  return Number.isFinite(v) ? v : NaN;
}

/** Tương quan Pearson; null khi một trong hai biến không có phương sai (không xác định). */
function correlation(x: number[], y: number[]): number | null {
  const n = x.length;
  if (n < 2) return null;
  const mx = meanOf(x);
  const my = meanOf(y);
  let sxy = 0;
  let sxx = 0;
  let syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = x[i] - mx;
    const dy = y[i] - my;
    sxy += dx * dy;
    sxx += dx * dx;
    syy += dy * dy;
  }
  if (!(sxx > 0) || !(syy > 0)) return null;
  return sxy / Math.sqrt(sxx * syy);
}

const columnOf = (data: number[][], j: number) => data.map((row) => row[j]);

/**
 * Dựng Scale sample listwise từ dữ liệu phân tích.
 *
 * Chỉ giữ dòng có đủ giá trị số ở mọi item (listwise như SPSS): một ô thiếu loại cả dòng khỏi
 * mọi thống kê của thang đo, nhưng dòng đó vẫn được đếm trong `nInput` để thấy dữ liệu bị mất.
 * Đảo điểm là phép phản chiếu `reflection − x`, chỉ áp dụng cho ma trận trả về — dữ liệu gốc
 * không bao giờ bị sửa.
 *
 * @param reverse Cờ đảo điểm theo tên item; mặc định không đảo.
 * @param reflection Hằng số phản chiếu theo tên item; thiếu thì lấy (min + max) quan sát trong
 *   chính Scale sample, đúng thứ tự ưu tiên của spec R4.
 */
export function buildScaleSample(
  rows: string[][],
  items: string[],
  reverse: Record<string, boolean> = {},
  reflection: Record<string, number> = {}
): ScaleSample {
  const header = rows[0] ?? [];
  const dataRows = rows.slice(1);
  const indexes = items.map((name) => header.indexOf(name));
  const data: number[][] = [];
  const sourceRowIndexes: number[] = [];

  for (let r = 0; r < dataRows.length; r++) {
    const row = dataRows[r];
    const values: number[] = new Array(indexes.length);
    let complete = true;
    for (let j = 0; j < indexes.length; j++) {
      const ci = indexes[j];
      const value = ci < 0 ? NaN : parseNumber(row[ci]);
      if (Number.isNaN(value)) {
        complete = false;
        break;
      }
      values[j] = value;
    }
    if (!complete) continue;
    data.push(values);
    // +1: chỉ số dòng trong `rows`, vì header chiếm vị trí 0.
    sourceRowIndexes.push(r + 1);
  }

  // Hằng số phản chiếu mặc định phải tính trên Scale sample (sau listwise), không trên input:
  // dòng bị loại không được kéo min/max ra ngoài thang thật.
  const reflected = data.map((row) => row.slice());
  for (let j = 0; j < items.length; j++) {
    if (!reverse[items[j]]) continue;
    const declared = reflection[items[j]];
    const constant =
      declared !== undefined && Number.isFinite(declared)
        ? declared
        : deriveObservedReflection(data, j);
    for (let i = 0; i < reflected.length; i++) reflected[i][j] = constant - reflected[i][j];
  }

  return { data: reflected, sourceRowIndexes, nInput: Math.max(0, rows.length - 1) };
}

/** (min + max) quan sát được của một cột; NaN khi cột rỗng. */
function deriveObservedReflection(data: number[][], j: number): number {
  let min = Infinity;
  let max = -Infinity;
  for (const row of data) {
    const v = row[j];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return min === Infinity ? NaN : min + max;
}

/**
 * α = k/(k − 1) · (1 − Σσ²ᵢ / σ²total) trên phương sai mẫu.
 *
 * Trả null khi không tính được: dưới 3 dòng, dưới 2 item, hoặc có item phương sai 0
 * (item hằng số khiến tỉ số vô nghĩa — UI hiển thị *Not applicable* kèm lý do).
 */
export function computeAlpha(data: number[][]): number | null {
  const k = data[0]?.length ?? 0;
  const n = data.length;
  if (k < 2 || n < 3) return null;
  const itemSds = Array.from({ length: k }, (_, j) => sdOf(columnOf(data, j)));
  if (itemSds.some((sd) => !(sd > 0))) return null;
  const totalVar = varOf(data.map((row) => row.reduce((a, b) => a + b, 0)));
  if (!(totalVar > 0)) return null;
  const sumItemVar = itemSds.reduce((s, sd) => s + sd * sd, 0);
  return (k / (k - 1)) * (1 - sumItemVar / totalVar);
}

/**
 * α chuẩn hóa = k·r̄ / (1 + (k − 1)·r̄), r̄ là trung bình tương quan item–item ngoài đường chéo.
 *
 * Dùng khi các item khác thang điểm (1–5 trộn 1–7): α thô phụ thuộc phương sai từng item,
 * còn α chuẩn hóa chỉ phụ thuộc cấu trúc tương quan.
 */
export function computeStandardizedAlpha(data: number[][]): number | null {
  const k = data[0]?.length ?? 0;
  const n = data.length;
  if (k < 2 || n < 2) return null;
  const rbar = computeMeanInterItemR(data);
  if (rbar === null) return null;
  const denominator = 1 + (k - 1) * rbar;
  if (Math.abs(denominator) < 1e-12) return null;
  return (k * rbar) / denominator;
}

/**
 * Thống kê từng item: Mean, SD (n − 1), Missing trên input sample, CITC và α-if-deleted.
 *
 * CITC = tương quan giữa item và TỔNG các item còn lại (hiệu chỉnh, không phải tổng toàn thang):
 * nhờ vậy item không tự tương quan với chính nó. α-if-deleted cần k ≥ 3 vì với k = 2 thang
 * còn lại chỉ có 1 item, α không xác định.
 */
export function computeItemDiagnostics(
  rows: string[][],
  items: string[],
  sample: ScaleSample
): ReliabilityItemStatistics[] {
  const data = sample.data;
  const k = items.length;
  const n = data.length;
  if (k < 2 || n < 2) return [];
  const header = rows[0] ?? [];
  const inputRows = rows.slice(1);
  const totals = data.map((row) => row.reduce((a, b) => a + b, 0));

  return items.map((name, j) => {
    const column = columnOf(data, j);
    const ci = header.indexOf(name);
    const missingInInput =
      ci < 0
        ? sample.nInput
        : inputRows.reduce((count, row) => (Number.isNaN(parseNumber(row[ci])) ? count + 1 : count), 0);

    const rest = totals.map((total, i) => total - data[i][j]);
    const sd = sdOf(column);
    const correctedItemTotal = sd > 0 ? correlation(column, rest) : null;

    let alphaIfDeleted: number | null = null;
    if (k >= 3) {
      const remaining = data.map((row) => row.filter((_, col) => col !== j));
      alphaIfDeleted = computeAlpha(remaining);
    }

    return { name, mean: meanOf(column), sd, missingInInput, correctedItemTotal, alphaIfDeleted };
  });
}

/**
 * Ma trận tương quan Pearson item–item (đối xứng, đường chéo = 1).
 *
 * Ô của item có phương sai 0 là NaN (tương quan không xác định) — UI in "—" thay vì bịa số.
 */
export function computeInterItemMatrix(data: number[][]): number[][] {
  const k = data[0]?.length ?? 0;
  const columns = Array.from({ length: k }, (_, j) => columnOf(data, j));
  const sds = columns.map(sdOf);
  return columns.map((x, i) =>
    columns.map((y, j) => {
      if (i === j) return sds[i] > 0 ? 1 : NaN;
      if (!(sds[i] > 0) || !(sds[j] > 0)) return NaN;
      const r = correlation(x, y);
      return r === null ? NaN : r;
    })
  );
}

/**
 * Trung bình các tương quan item–item ngoài đường chéo (r̄ của α chuẩn hóa); null khi
 * không có cặp nào xác định — ví dụ mọi item đều hằng số.
 */
export function computeMeanInterItemR(data: number[][]): number | null {
  const matrix = computeInterItemMatrix(data);
  const k = matrix.length;
  let sum = 0;
  let count = 0;
  for (let i = 0; i < k; i++) {
    for (let j = i + 1; j < k; j++) {
      const r = matrix[i][j];
      if (Number.isNaN(r)) continue;
      sum += r;
      count++;
    }
  }
  return count === 0 ? null : sum / count;
}

// ---------------------------------------------------------------------------
// Ngưỡng và Verdict (spec §4 R3)
// ---------------------------------------------------------------------------

/**
 * Bảng ngưỡng DUY NHẤT của độ tin cậy (spec R3): component chỉ được đọc các số này,
 * không được tự viết `.70` / `.30` / `.95` trong JSX.
 */
export const RELIABILITY_THRESHOLDS = {
  alpha: {
    /** Dưới mức này α bị coi là vi phạm. */
    acceptable: 0.7,
    /** Từ mức này α đạt. */
    good: 0.8,
    /** Từ mức này trở lên là dấu hiệu item trùng lặp, không phải "tốt hơn". */
    redundancy: 0.95,
  },
  itemTotal: {
    /** CITC dưới mức này là item yếu. */
    low: 0.3,
  },
  /** Dưới mức n này CI rất rộng: chỉ cảnh báo, không chặn chốt. */
  smallSampleN: 30,
  /** Thang đo cần tối thiểu bấy nhiêu item mới đáng báo cáo như một thang. */
  minItems: 3,
} as const;

/** Nhãn bậc chất lượng của α — tách khỏi Verdict để thẻ thang đo vẫn nêu được "đang ở bậc nào". */
function bandKeyOf(alpha: number | null): string | null {
  if (alpha === null) return null;
  if (alpha >= RELIABILITY_THRESHOLDS.alpha.redundancy) return "reliabilityVerdict.band.redundancy";
  if (alpha >= RELIABILITY_THRESHOLDS.alpha.good) return "reliabilityVerdict.band.good";
  if (alpha >= RELIABILITY_THRESHOLDS.alpha.acceptable) return "reliabilityVerdict.band.acceptable";
  return "reliabilityVerdict.band.poor";
}

/**
 * Verdict cấp thang đo.
 *
 * Thứ tự ưu tiên có chủ đích: không tính được (Not applicable) → vi phạm (α < .70) → quá ít item
 * → nghi trùng lặp → đạt. Mẫu nhỏ chỉ đẩy một kết quả "đạt" xuống "cần lưu ý" (CI rộng), chứ
 * không che mất một vi phạm hay một thang hai item.
 *
 * @param stats Thống kê của thang đo; `alpha` null nghĩa là không tính được.
 * @param constantItems Tên các item Kept có SD = 0 — cần để phân biệt "α không tính được" với
 *   "có item hằng số" khi cả hai cùng cho `alpha === null`.
 */
export function scaleVerdict(
  stats: ReliabilityStatistics,
  constantItems: string[] = []
): ReliabilityScaleAssessment {
  const bandKey = constantItems.length > 0 ? null : bandKeyOf(stats.alpha);

  if (constantItems.length > 0) {
    return {
      verdict: "notApplicable",
      bandKey: null,
      reasonKey: "reliabilityVerdict.scale.notApplicable.constantItem",
      reasonParams: { items: constantItems.join(", ") },
    };
  }

  const alpha = stats.alpha;
  if (alpha === null) {
    return {
      verdict: "notApplicable",
      bandKey: null,
      reasonKey: "reliabilityVerdict.scale.notApplicable.alphaUndefined",
      reasonParams: { n: stats.nScaleSample, k: stats.k },
    };
  }

  if (alpha < RELIABILITY_THRESHOLDS.alpha.acceptable) {
    return {
      verdict: "violation",
      bandKey,
      reasonKey: "reliabilityVerdict.scale.violation.low",
      reasonParams: { alpha, threshold: RELIABILITY_THRESHOLDS.alpha.acceptable },
    };
  }

  if (stats.k < RELIABILITY_THRESHOLDS.minItems) {
    return {
      verdict: "caution",
      bandKey,
      reasonKey: "reliabilityVerdict.scale.caution.twoItems",
      reasonParams: { k: stats.k, minItems: RELIABILITY_THRESHOLDS.minItems },
    };
  }

  if (alpha >= RELIABILITY_THRESHOLDS.alpha.redundancy) {
    return {
      verdict: "caution",
      bandKey,
      reasonKey: "reliabilityVerdict.scale.caution.redundancy",
      reasonParams: { alpha, threshold: RELIABILITY_THRESHOLDS.alpha.redundancy },
    };
  }

  if (alpha >= RELIABILITY_THRESHOLDS.alpha.good) {
    if (stats.nScaleSample < RELIABILITY_THRESHOLDS.smallSampleN) {
      return {
        verdict: "caution",
        bandKey,
        reasonKey: "reliabilityVerdict.scale.caution.smallSample",
        reasonParams: {
          alpha,
          n: stats.nScaleSample,
          threshold: RELIABILITY_THRESHOLDS.smallSampleN,
        },
      };
    }
    return {
      verdict: "pass",
      bandKey,
      reasonKey: "reliabilityVerdict.scale.pass.good",
      reasonParams: { alpha, threshold: RELIABILITY_THRESHOLDS.alpha.good },
    };
  }

  return {
    verdict: "caution",
    bandKey,
    reasonKey: "reliabilityVerdict.scale.caution.acceptable",
    reasonParams: { alpha, threshold: RELIABILITY_THRESHOLDS.alpha.acceptable },
  };
}

/** Phần của một item mà Verdict cần — nhận cả thống kê thô lẫn diagnostic đã gắn Verdict. */
export type ItemVerdictInput = Pick<
  ReliabilityItemDiagnostic,
  "name" | "sd" | "correctedItemTotal" | "alphaIfDeleted"
>;

/**
 * Verdict của một item.
 *
 * CITC âm là vi phạm nặng nhất (nghi item đảo điểm) nên được xét trước CITC thấp; α-if-deleted
 * chỉ là cảnh báo "loại item này sẽ tăng α", không tự loại item (spec R5: gợi ý ≠ hành động).
 *
 * @param scaleAlpha α hiện tại của thang — chỉ dùng để so với α-if-deleted; null khi không tính được.
 */
export function itemVerdict(item: ItemVerdictInput, scaleAlpha: number | null): ReliabilityAssessment {
  if (!(item.sd > 0)) {
    return {
      verdict: "notApplicable",
      reasonKey: "reliabilityVerdict.item.constantItem",
      reasonParams: { item: item.name },
    };
  }

  const citc = item.correctedItemTotal;
  if (citc === null) {
    return {
      verdict: "notApplicable",
      reasonKey: "reliabilityVerdict.item.notComputable",
      reasonParams: { item: item.name },
    };
  }

  if (citc < 0) {
    return {
      verdict: "violation",
      reasonKey: "reliabilityVerdict.item.negativeCitc",
      reasonParams: { citc },
    };
  }

  if (citc < RELIABILITY_THRESHOLDS.itemTotal.low) {
    return {
      verdict: "caution",
      reasonKey: "reliabilityVerdict.item.lowCitc",
      reasonParams: { citc, threshold: RELIABILITY_THRESHOLDS.itemTotal.low },
    };
  }

  if (item.alphaIfDeleted !== null && scaleAlpha !== null && item.alphaIfDeleted > scaleAlpha) {
    return {
      verdict: "caution",
      reasonKey: "reliabilityVerdict.item.raisesAlpha",
      reasonParams: { alphaIfDeleted: item.alphaIfDeleted, alpha: scaleAlpha },
    };
  }

  return {
    verdict: "pass",
    reasonKey: "reliabilityVerdict.item.pass",
    reasonParams: { citc, threshold: RELIABILITY_THRESHOLDS.itemTotal.low },
  };
}

/**
 * Khoảng tin cậy Feldt 95% cho α (spec §6), kẹp về [0, 1] như SPSS.
 *
 *   lower = 1 − (1 − α) · F.975(n − 1, (k − 1)(n − 1))
 *   upper = 1 − (1 − α) · F.025((k − 1)(n − 1), n − 1)
 *
 * Khoảng rất rộng khi n nhỏ — đây là lý do ngưỡng n < 30 chỉ cảnh báo chứ không chặn.
 */
export function computeFeldtCi(
  alpha: number | null,
  k: number,
  n: number
): { lower: number; upper: number } | null {
  if (alpha === null || !Number.isFinite(alpha) || k < 2 || n < 2) return null;
  const df1 = n - 1;
  const df2 = (k - 1) * (n - 1);
  const upperF = fQuantile(0.975, df1, df2);
  const lowerF = fQuantile(0.025, df2, df1);
  if (!Number.isFinite(upperF) || !Number.isFinite(lowerF)) return null;
  const lower = 1 - (1 - alpha) * upperF;
  const upper = 1 - (1 - alpha) * lowerF;
  return { lower: Math.min(1, Math.max(0, lower)), upper: Math.min(1, Math.max(0, upper)) };
}

/** Toàn bộ kết quả của một lần tính thang đo — tab chỉ việc render. */
export interface ReliabilityScaleResult {
  sample: ScaleSample;
  statistics: ReliabilityStatistics;
  itemStatistics: ReliabilityItemStatistics[];
  verdict: ReliabilityScaleAssessment;
}

/**
 * Điểm vào DUY NHẤT của tab: dựng Scale sample, tính mọi thống kê và Verdict cấp thang đo
 * từ cùng một mẫu listwise. Nhờ vậy headline α và bảng item không bao giờ lệch mẫu nhau.
 */
export function computeReliability(
  rows: string[][],
  items: string[],
  reverse: Record<string, boolean> = {},
  reflection: Record<string, number> = {}
): ReliabilityScaleResult {
  const sample = buildScaleSample(rows, items, reverse, reflection);
  const k = items.length;
  const alpha = computeAlpha(sample.data);
  const statistics: ReliabilityStatistics = {
    alpha,
    alphaStandardized: computeStandardizedAlpha(sample.data),
    ci: computeFeldtCi(alpha, k, sample.data.length),
    k,
    nScaleSample: sample.data.length,
    nInput: sample.nInput,
    meanInterItemR: computeMeanInterItemR(sample.data),
  };
  const itemStatistics = computeItemDiagnostics(rows, items, sample);
  const constantItems = itemStatistics.filter((it) => it.sd === 0).map((it) => it.name);
  return { sample, statistics, itemStatistics, verdict: scaleVerdict(statistics, constantItems) };
}
