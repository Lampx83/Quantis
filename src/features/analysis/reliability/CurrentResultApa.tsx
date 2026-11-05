import type { ReliabilityScaleAssessment, ReliabilityStatistics } from "@/types";
import { t } from "@/i18n";
import { formatParams } from "./format";

const APA_LEVEL: Record<string, string> = {
  "reliabilityVerdict.band.good": "reliabilityTab.apaLevel.good",
  "reliabilityVerdict.band.acceptable": "reliabilityTab.apaLevel.acceptable",
  "reliabilityVerdict.band.poor": "reliabilityTab.apaLevel.poor",
  "reliabilityVerdict.band.redundancy": "reliabilityTab.apaLevel.veryHigh",
};

/** Số APA: hai chữ số thập phân, bỏ số 0 trước dấu chấm. */
export function formatApaNumber(value: number): string {
  return value.toFixed(2).replace(/^(-?)0\./, "$1.");
}

/** Câu báo cáo lấy đúng kết quả và Verdict hiện tại, không có snapshot riêng. */
export function apaSentence(
  statistics: ReliabilityStatistics,
  assessment: ReliabilityScaleAssessment
): string | null {
  const levelKey = assessment.bandKey ? APA_LEVEL[assessment.bandKey] : undefined;
  if (statistics.alpha === null || !Number.isFinite(statistics.alpha) || !levelKey || assessment.verdict === "notApplicable") return null;
  const ci = statistics.ci;
  const ciClause = ci && Number.isFinite(ci.lower) && Number.isFinite(ci.upper)
    ? t("reliabilityTab.apaCi", { lower: formatApaNumber(ci.lower), upper: formatApaNumber(ci.upper) })
    : "";
  const sentence = t("reliabilityTab.apaSentence", {
    k: statistics.k,
    level: t(levelKey),
    alpha: formatApaNumber(statistics.alpha),
    ci: ciClause,
    n: statistics.nScaleSample,
  });
  return assessment.verdict === "pass"
    ? sentence
    : `${sentence} ${t(`reliabilityVerdict.verdict.${assessment.verdict}`)}: ${t(assessment.reasonKey, formatParams(assessment.reasonParams))}`;
}

export function CurrentResultApa({ statistics, assessment, onCopy }: {
  statistics: ReliabilityStatistics;
  assessment: ReliabilityScaleAssessment;
  onCopy: () => void;
}) {
  const sentence = apaSentence(statistics, assessment);
  return (
    <div className="mb-3 text-sm" data-testid="current-result-apa">
      <button type="button" onClick={onCopy} disabled={!sentence}
        className="rounded-md border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 disabled:opacity-50">
        {t("reliabilityTab.copyApa")}
      </button>
      <p className="mt-2 text-neutral-600 dark:text-neutral-400" data-testid="apa-sentence">
        {sentence ?? t("reliabilityTab.apaUnavailable")}
      </p>
    </div>
  );
}
