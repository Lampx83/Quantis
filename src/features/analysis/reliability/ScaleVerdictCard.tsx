import type { ReliabilityScaleAssessment, ReliabilityVerdict } from "@/types";
import { t } from "@/i18n";
import { formatParams } from "./format";
import { InfoHint } from "@/components/common/InfoHint";

export interface ScaleVerdictCardProps {
  assessment: ReliabilityScaleAssessment;
}

/** Đánh giá duy nhất cạnh chỉ số α; lý do chi tiết mở qua biểu tượng thông tin. */
const CARD_CLASS: Record<ReliabilityVerdict, string> = {
  pass: "border-emerald-200 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-200",
  caution: "border-amber-200 bg-amber-50 text-amber-900 dark:border-amber-800 dark:bg-amber-900/30 dark:text-amber-200",
  violation: "border-red-200 bg-red-50 text-red-900 dark:border-red-800 dark:bg-red-900/30 dark:text-red-200",
  notApplicable: "border-neutral-200 bg-neutral-100 text-neutral-700 dark:border-neutral-700 dark:bg-neutral-800 dark:text-neutral-300",
};

export function ScaleVerdictCard({ assessment }: ScaleVerdictCardProps) {
  return (
    <div
      className={`inline-flex items-center rounded-full border px-2 py-0.5 ${CARD_CLASS[assessment.verdict]}`}
      data-testid="scale-verdict"
      data-verdict={assessment.verdict}
    >
      <span className="text-xs font-medium" data-testid="scale-verdict-label">
        {t(`reliabilityVerdict.verdict.${assessment.verdict}`)}
      </span>
      <InfoHint
        title={assessment.bandKey ? t(assessment.bandKey) : t(`reliabilityVerdict.verdict.${assessment.verdict}`)}
        text={t(assessment.reasonKey, formatParams(assessment.reasonParams))}
        className="!text-inherit"
      />
    </div>
  );
}
