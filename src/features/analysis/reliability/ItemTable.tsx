import type { ReliabilityItemDiagnostic, ReliabilityVerdict } from "@/types";
import { t } from "@/i18n";
import { InfoHint } from "@/components/common/InfoHint";
import { formatParams, formatStat } from "./format";
import { RELIABILITY_THRESHOLDS } from "@/utils/reliability";

export interface ItemTableProps {
  items: ReliabilityItemDiagnostic[];
  /** Có mặt nghĩa là bảng cho phép bật/tắt đảo điểm tại chỗ. */
  onToggleReverse?: (name: string) => void;
  /** Item có CITC âm mà loại đi sẽ tăng α — hiện gợi ý, KHÔNG tự bật. */
  reverseSuggestions?: string[];
}

/** Màu hàng theo Verdict; `pass` để trung tính vì không cần hành động. */
const ROW_CLASS: Record<ReliabilityVerdict, string> = {
  pass: "",
  caution: "bg-amber-50 dark:bg-amber-900/20",
  violation: "bg-red-50 dark:bg-red-900/20",
  notApplicable: "bg-neutral-50 dark:bg-neutral-800/40 text-neutral-500 dark:text-neutral-400",
};

const BADGE_CLASS: Record<ReliabilityVerdict, string> = {
  pass: "bg-emerald-100 !text-emerald-800 dark:bg-emerald-900/40 dark:!text-emerald-200",
  caution: "bg-amber-100 !text-amber-800 dark:bg-amber-900/40 dark:!text-amber-200",
  violation: "bg-red-100 !text-red-800 dark:bg-red-900/40 dark:!text-red-200",
  notApplicable: "bg-neutral-200 !text-neutral-700 dark:bg-neutral-700 dark:!text-neutral-300",
};

/**
 * Bảng chẩn đoán từng item (spec R2). "Missing" đếm trên input sample nên luôn ≥ phần bị
 * Scale sample listwise loại — đó là cách người dùng thấy dữ liệu nào đã mất.
 */
export function ItemTable({ items, onToggleReverse, reverseSuggestions = [] }: ItemTableProps) {
  const showReverse = !!onToggleReverse || items.some((item) => item.reverse);
  return (
    <div
      className="mt-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm"
      data-testid="item-total-table"
    >
      <table className="w-full min-w-[720px]">
        <caption className="p-3 text-left font-medium">{t("reliabilityTab.itemTotalTitle")}</caption>
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-600">
            <th className="text-left p-2">{t("reliabilityTab.colItem")}</th>
            {showReverse && <th scope="col" className="p-2 text-center">{t("reliabilityTab.reverseToggle")}</th>}
            <th className="text-right p-2">{t("reliabilityTab.colMean")}</th>
            <th className="text-right p-2">{t("reliabilityTab.colSd")}</th>
            <th className="text-right p-2">{t("reliabilityTab.colMissing")}</th>
            <th className="text-right p-2">
              {t("reliabilityTab.colCitc")}
              <InfoHint term="correctedItemTotal" text={t("reliabilityTab.citcRule")} />
            </th>
            <th className="text-right p-2">
              {t("reliabilityTab.colAlphaDel")}
              <InfoHint term="alphaIfDeleted" />
            </th>
          </tr>
        </thead>
        <tbody>
          {items.map((item) => {
            const reason = t(item.reasonKey, formatParams(item.reasonParams));
            const citc = item.correctedItemTotal;
            const citcVerdict = citc === null ? "notApplicable" : citc < 0 ? "violation" : citc < RELIABILITY_THRESHOLDS.itemTotal.low ? "caution" : "pass";
            const citcLabel = citc === null ? t("reliabilityTab.notApplicable") : citc < 0 ? "⚠ < 0" : citc < RELIABILITY_THRESHOLDS.itemTotal.low ? "⚠ < 0.30" : `✓ ${t("reliabilityTab.citcGood")}`;
            const citcReason = citc === null ? reason : t(
              citcVerdict === "pass" ? "reliabilityVerdict.item.pass" : citcVerdict === "violation" ? "reliabilityVerdict.item.negativeCitc" : "reliabilityVerdict.item.lowCitc",
              formatParams({ citc, threshold: RELIABILITY_THRESHOLDS.itemTotal.low })
            );
            const suggested = !!onToggleReverse && reverseSuggestions.includes(item.name);
            const reverseTitle = [
              t("reliabilityTab.reverseItem", { item: item.name }),
              item.reverse && item.reflectionConstant !== null ? t("reliabilityTab.reflectionConstant", { value: formatStat(item.reflectionConstant, 0) }) : "",
              suggested ? t("reliabilityTab.reverseSuggestion") : "",
            ].filter(Boolean).join(". ");
            return (
              <tr
                key={item.name}
                className={`border-b border-neutral-100 dark:border-neutral-700/50 ${ROW_CLASS[item.verdict]}`}
                data-testid={`item-row-${item.name}`}
                data-verdict={item.verdict}
              >
                <th scope="row" className="p-2 text-left font-medium" data-testid={`item-name-${item.name}`}>{item.name}</th>
                {showReverse && (
                  <td className="p-2 text-center" data-testid={`item-reverse-${item.name}`}>
                    <div className="inline-flex items-center justify-center gap-1.5 whitespace-nowrap">
                      <input
                        type="checkbox"
                        checked={item.reverse}
                        disabled={!onToggleReverse}
                        onChange={() => onToggleReverse?.(item.name)}
                        aria-label={reverseTitle}
                        className="h-4 w-4 cursor-pointer accent-brand disabled:cursor-default"
                      />
                      {suggested && <InfoHint title={t("reliabilityTab.reverseItem", { item: item.name })} text={t("reliabilityTab.reverseSuggestion")} icon={<span>⚠</span>} className="!ml-0 !text-amber-700 dark:!text-amber-300" />}
                      {item.reverse && item.reflectionConstant !== null && (
                        <span className="text-xs text-neutral-500 dark:text-neutral-400" data-testid={`item-reflection-${item.name}`}>
                          <InfoHint title={t("reliabilityTab.reverseItem", { item: item.name })} text={t("reliabilityTab.reflectionConstant", { value: formatStat(item.reflectionConstant, 0) })} icon={<span>{formatStat(item.reflectionConstant, 0)} − x</span>} className="!ml-0 !text-inherit" />
                        </span>
                      )}
                    </div>
                  </td>
                )}
                <td className="p-2 text-right tabular-nums">{formatStat(item.mean)}</td>
                <td className="p-2 text-right tabular-nums">{formatStat(item.sd)}</td>
                <td className="p-2 text-right" data-testid={`item-missing-${item.name}`}>
                  {item.missingInInput}
                </td>
                <td className="p-2 text-right tabular-nums" data-testid={`item-citc-${item.name}`}>
                  <div className="flex items-center justify-end gap-2 whitespace-nowrap">
                    <span>{formatStat(citc)}</span>
                    <span data-testid={`item-verdict-${item.name}`}>
                      <InfoHint
                        title={citcLabel}
                        text={citcReason}
                        icon={<span>{citcLabel}</span>}
                        className={`!ml-0 !rounded px-1.5 py-0.5 text-xs font-medium ${BADGE_CLASS[citcVerdict]}`}
                      />
                    </span>
                  </div>
                </td>
                <td className="p-2 text-right tabular-nums whitespace-nowrap" data-testid={`item-alpha-deleted-${item.name}`}>
                  {item.alphaIfDeleted === null ? (
                    <span title={t("reliabilityTab.notApplicable")}>—</span>
                  ) : (
                    formatStat(item.alphaIfDeleted)
                  )}
                  {item.reasonKey === "reliabilityVerdict.item.raisesAlpha" && (
                    <InfoHint title={t("reliabilityTab.flagRaisesAlpha")} text={reason} icon={<span>⚠ {t("reliabilityTab.flagRaisesAlpha")}</span>} className="!ml-2 !rounded bg-amber-100 px-1.5 py-0.5 text-xs !text-amber-800 dark:bg-amber-900/40 dark:!text-amber-200" />
                  )}
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
