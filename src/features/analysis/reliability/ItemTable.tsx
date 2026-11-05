import type { ReliabilityItemDiagnostic } from "@/types";
import { t } from "@/i18n";
import { InfoHint } from "@/components/common/InfoHint";
import { formatStat } from "./format";

export interface ItemTableProps {
  items: ReliabilityItemDiagnostic[];
}

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
              className="border-b border-neutral-100 dark:border-neutral-700/50"
              data-testid={`item-row-${item.name}`}
            >
              <td className="p-2 font-medium">
                {item.name}
                {item.reverse && (
                  <span className="ml-1 text-xs text-neutral-500 dark:text-neutral-400">
                    ({t("reliabilityTab.reversedBadge")}
                    {item.reflectionConstant !== null ? ` ${item.reflectionConstant}` : ""})
                  </span>
                )}
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
