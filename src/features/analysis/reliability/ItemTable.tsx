import type { ReliabilityItemDiagnostic, ReliabilityVerdict } from "@/types";
import { t } from "@/i18n";
import { InfoHint } from "@/components/common/InfoHint";
import { formatParams, formatStat } from "./format";

export interface ItemTableProps {
  items: ReliabilityItemDiagnostic[];
}

/** Màu hàng theo Verdict; `pass` để trung tính vì không cần hành động. */
const ROW_CLASS: Record<ReliabilityVerdict, string> = {
  pass: "",
  caution: "bg-amber-50 dark:bg-amber-900/20",
  violation: "bg-red-50 dark:bg-red-900/20",
  notApplicable: "bg-neutral-50 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400",
};

const BADGE_CLASS: Record<ReliabilityVerdict, string> = {
  pass: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/40 dark:text-emerald-200",
  caution: "bg-amber-100 text-amber-800 dark:bg-amber-900/40 dark:text-amber-200",
  violation: "bg-red-100 text-red-800 dark:bg-red-900/40 dark:text-red-200",
  notApplicable: "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300",
};

/**
 * Bảng chẩn đoán từng item (spec R2). "Missing" đếm trên input sample nên luôn ≥ phần bị
 * Scale sample listwise loại — đó là cách người dùng thấy dữ liệu nào đã mất.
 */
export function ItemTable({ items }: ItemTableProps) {
  return (
    <div
      className="mt-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm"
      data-testid="item-total-table"
    >
      <table className="w-full">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-600">
            <th className="text-left p-2">{t("reliabilityTab.colItem")}</th>
            <th className="text-right p-2">{t("reliabilityTab.colMean")}</th>
            <th className="text-right p-2">{t("reliabilityTab.colSd")}</th>
            <th className="text-right p-2">{t("reliabilityTab.colMissing")}</th>
            <th className="text-right p-2">
              {t("reliabilityTab.colCitc")}
              <InfoHint term="correctedItemTotal" />
            </th>
            <th className="text-right p-2">
              {t("reliabilityTab.colAlphaDel")}
              <InfoHint term="alphaIfDeleted" />
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => (
            <tr
              key={item.name}
              className={`border-b border-neutral-100 dark:border-neutral-700/50 ${ROW_CLASS[item.verdict]}`}
              data-testid={`item-row-${item.name}`}
              data-verdict={item.verdict}
            >
              <td className="p-2">
                <div className="flex flex-wrap items-baseline gap-2">
                  <span className="font-medium">{item.name}</span>
                  {item.reverse && (
                    <span className="text-xs text-neutral-500 dark:text-neutral-400">
                      ({t("reliabilityTab.reversedBadge")}
                      {item.reflectionConstant !== null ? ` ${item.reflectionConstant}` : ""})
                    </span>
                  )}
                  <span
                    className={`rounded px-1.5 py-0.5 text-xs font-medium ${BADGE_CLASS[item.verdict]}`}
                    data-testid={`item-verdict-${item.name}`}
                  >
                    {t(`reliabilityVerdict.verdict.${item.verdict}`)}
                  </span>
                </div>
                <div
                  className="mt-0.5 text-xs opacity-80"
                  data-testid={`item-reason-${item.name}`}
                >
                  {t(item.reasonKey, formatParams(item.reasonParams))}
                </div>
              </td>
              <td className="p-2 text-right">{formatStat(item.mean)}</td>
              <td className="p-2 text-right">{formatStat(item.sd)}</td>
              <td className="p-2 text-right" data-testid={`item-missing-${item.name}`}>
                {item.missingInInput}
              </td>
              <td className="p-2 text-right" data-testid={`item-citc-${item.name}`}>
                {item.correctedItemTotal === null ? (
                  <span title={t("reliabilityTab.notApplicable")}>—</span>
                ) : (
                  formatStat(item.correctedItemTotal)
                )}
              </td>
              <td className="p-2 text-right" data-testid={`item-alpha-deleted-${item.name}`}>
                {item.alphaIfDeleted === null ? (
                  <span title={t("reliabilityTab.notApplicable")}>—</span>
                ) : (
                  formatStat(item.alphaIfDeleted)
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
