import type {
  TTestResult,
  ChiSquareResult,
  ANOVAResult,
  MannWhitneyResult,
} from "@/utils/stats";

export function formatAPA(result: {
  type: "ttest" | "chisquare" | "anova" | "mannwhitney";
  payload: TTestResult | ChiSquareResult | ANOVAResult | MannWhitneyResult;
  meta?: Record<string, string>;
}): string {
  if (result.type === "ttest") {
    const r = result.payload as TTestResult;
    const p = r.pValue < 0.001 ? "p < .001" : `p = ${r.pValue.toFixed(3).replace(/^0/, "")}`;
    return `Kiểm định t hai mẫu độc lập cho thấy sự khác biệt có ý nghĩa giữa hai nhóm, t(${r.df.toFixed(0)}) = ${r.t.toFixed(2)}, ${p}, Cohen's d = ${r.cohenD.toFixed(2)}. Nhóm 1: M = ${r.mean1.toFixed(2)}, SD = ${r.std1.toFixed(2)}, n = ${r.n1}; Nhóm 2: M = ${r.mean2.toFixed(2)}, SD = ${r.std2.toFixed(2)}, n = ${r.n2}.`;
  }
  if (result.type === "chisquare") {
    const r = result.payload as ChiSquareResult;
    const p = r.pValue < 0.001 ? "p < .001" : `p = ${r.pValue.toFixed(3).replace(/^0/, "")}`;
    return `Kiểm định Chi-square độc lập cho thấy mối liên hệ có ý nghĩa giữa hai biến, χ²(${r.df}) = ${r.chi2.toFixed(2)}, ${p}.`;
  }
  if (result.type === "anova") {
    const r = result.payload as ANOVAResult;
    const p = r.pValue < 0.001 ? "p < .001" : `p = ${r.pValue.toFixed(3).replace(/^0/, "")}`;
    return `ANOVA một nhân tố cho thấy hiệu ứng có ý nghĩa, F(${r.dfBetween}, ${r.dfWithin}) = ${r.f.toFixed(2)}, ${p}, η² = ${r.etaSq.toFixed(3)}.`;
  }
  if (result.type === "mannwhitney") {
    const r = result.payload as MannWhitneyResult;
    const p = r.pValue < 0.001 ? "p < .001" : `p = ${r.pValue.toFixed(3).replace(/^0/, "")}`;
    return `Kiểm định Mann-Whitney U (phi tham số) cho thấy sự khác biệt có ý nghĩa giữa hai nhóm, U = ${r.u.toFixed(0)}, z = ${r.z.toFixed(2)}, ${p}. Nhóm 1: Mdn = ${r.median1.toFixed(2)}, n = ${r.n1}; Nhóm 2: Mdn = ${r.median2.toFixed(2)}, n = ${r.n2}.`;
  }
  return "";
}
