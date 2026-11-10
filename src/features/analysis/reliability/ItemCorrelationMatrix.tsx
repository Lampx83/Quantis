import { useId, useMemo, useState } from "react";
import { ChevronDown } from "lucide-react";
import { t } from "@/i18n";
import { InfoHint } from "@/components/common/InfoHint";
import { computeInterItemMatrix } from "@/utils/reliability";
import { formatStat } from "./format";

export interface ItemCorrelationMatrixProps {
  /** Ma trận Scale sample (m × k), cột theo đúng thứ tự `names`. */
  data: number[][];
  names: string[];
  /** Mở sẵn ma trận — dùng cho in ấn/kiểm thử; mặc định gập để tab gọn. */
  initialOpen?: boolean;
}

/**
 * Ma trận tương quan Pearson item–item, gập mặc định. Ma trận chỉ được TÍNH khi mở
 * (k × k phép tương quan là phần đắt nhất của panel và không cần cho quyết định giữ/loại).
 */
export function ItemCorrelationMatrix({
  data,
  names,
  initialOpen = false,
}: ItemCorrelationMatrixProps) {
  const [open, setOpen] = useState(initialOpen);
  const panelId = useId();
  const matrix = useMemo(() => open ? computeInterItemMatrix(data) : null, [open, data]);

  return (
    <div
      className="mt-4 overflow-hidden rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-sm"
      data-testid="item-correlation-matrix"
    >
      <button
        type="button"
        onClick={() => setOpen((prev) => !prev)}
        aria-expanded={open}
        aria-controls={panelId}
        className="flex w-full items-center justify-between gap-3 p-3 text-left font-medium hover:bg-neutral-50 dark:hover:bg-neutral-700/40 focus-visible:outline-brand"
      >
        {t("reliabilityTab.matrixTitle")}
        <ChevronDown className={`h-4 w-4 shrink-0 transition-transform ${open ? "rotate-180" : ""}`} aria-hidden="true" />
      </button>
      <div id={panelId} hidden={!open}>
        {matrix && (
          <div className="border-t border-neutral-200 p-3 dark:border-neutral-700">
            <div className="mb-3 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-600 dark:text-neutral-400">
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-amber-100 dark:bg-amber-900/50" aria-hidden="true" />{t("reliabilityTab.matrixLowLegend")}</span>
              <span className="inline-flex items-center gap-1.5"><span className="h-3 w-3 rounded-sm bg-teal-100 dark:bg-teal-900/50" aria-hidden="true" />{t("reliabilityTab.matrixPositiveLegend")}</span>
              <InfoHint term="interItemCorrelation" />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full border-separate border-spacing-1 tabular-nums">
                <caption className="sr-only">{t("reliabilityTab.matrixTitle")}</caption>
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-600">
                    <th className="p-2"></th>
                    {names.map((name) => (
                      <th key={name} scope="col" className="p-2 text-right font-medium whitespace-nowrap">
                        {name}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {matrix.map((row, i) => (
                    <tr key={names[i]} className="border-b border-neutral-100 dark:border-neutral-700/50">
                      <th scope="row" className="p-2 text-left font-medium whitespace-nowrap">{names[i]}</th>
                      {row.map((value, j) => {
                        const defined = Number.isFinite(value);
                        const low = i !== j && defined && value < 0.15;
                        const color = !defined || i === j
                          ? "bg-neutral-100 text-neutral-500 dark:bg-neutral-700/50 dark:text-neutral-400"
                          : low ? "bg-amber-100/70 text-amber-900 dark:bg-amber-900/40 dark:text-amber-200"
                          : value < 0.3 ? "bg-teal-50 text-teal-900 dark:bg-teal-900/20 dark:text-teal-200"
                          : value < 0.5 ? "bg-teal-100/60 text-teal-900 dark:bg-teal-900/30 dark:text-teal-200"
                          : "bg-teal-200/60 text-teal-950 dark:bg-teal-800/40 dark:text-teal-100";
                        return (
                          <td key={`${names[i]}-${names[j]}`}
                            className={`rounded p-2 text-right whitespace-nowrap ${color}`}
                            data-testid={`correlation-${i}-${j}`}
                            data-low={low || undefined}
                          >
                            <InfoHint
                              title={`${names[i]} × ${names[j]}`}
                              text={`r = ${formatStat(value)}${low ? `. ${t("reliabilityTab.matrixLowHint")}` : !defined ? `. ${t("reliabilityTab.notApplicable")}` : ""}`}
                              icon={<span>{low && <span className="mr-1">⚠</span>}{formatStat(value)}</span>}
                              className="!ml-0 !rounded !text-inherit"
                            />
                          </td>
                        );
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
