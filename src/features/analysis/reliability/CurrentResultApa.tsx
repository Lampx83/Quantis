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
    <div className="mt-4 border-t border-neutral-200 pt-4 text-sm dark:border-neutral-700" data-testid="current-result-apa">
      {sentence ? (
        <details className="mb-3 text-neutral-600 dark:text-neutral-400">
          <summary className="w-fit cursor-pointer rounded focus-visible:outline-brand">{t("reliabilityTab.apaPreview")}</summary>
          <p className="mt-2 max-w-3xl" data-testid="apa-sentence">{sentence}</p>
        </details>
      ) : (
        <p className="mb-3 text-neutral-600 dark:text-neutral-400" data-testid="apa-sentence">{t("reliabilityTab.apaUnavailable")}</p>
      )}
      <button type="button" onClick={onCopy} disabled={!sentence}
        className="rounded-md border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 disabled:opacity-50">
        {t("reliabilityTab.copyApa")}
      </button>
    </div>
  );
}
