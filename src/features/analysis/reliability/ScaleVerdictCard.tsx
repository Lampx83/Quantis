import type { ReliabilityScaleAssessment, ReliabilityVerdict } from "@/types";
import { t } from "@/i18n";
import { formatParams } from "./format";

export interface ScaleVerdictCardProps {
  assessment: ReliabilityScaleAssessment;
}

/**
 * Kết luận của panel: Verdict + bậc α + câu lý do có cả giá trị và ngưỡng (spec R3).
 * `notApplicable` dùng màu trung tính vì "không tính được" không phải một phán đoán.
 */
const CARD_CLASS: Record<ReliabilityVerdict, string> = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  caution: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  violation: "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200",
  notApplicable: "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export function ScaleVerdictCard({ assessment }: ScaleVerdictCardProps) {
  return (
    <div
      className={`mt-4 rounded-lg border p-4 ${CARD_CLASS[assessment.verdict]}`}
      data-testid="scale-verdict"
      data-verdict={assessment.verdict}
    >
      <div className="flex flex-wrap items-baseline gap-2">
        <span className="text-sm font-semibold" data-testid="scale-verdict-label">
          {t(`reliabilityVerdict.verdict.${assessment.verdict}`)}
        </span>
        {assessment.bandKey && (
          <span className="text-xs opacity-80">{t(assessment.bandKey)}</span>
        )}
      </div>
      <p className="text-sm mt-1" data-testid="scale-verdict-reason">
        {t(assessment.reasonKey, formatParams(assessment.reasonParams))}
      </p>
    </div>
  );
}
