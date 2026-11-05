import { useState } from "react";
import { t } from "@/i18n";
import { InfoHint } from "@/components/common/InfoHint";
import { computeInterItemMatrix } from "@/utils/reliability";
import { formatStat } from "./format";

export interface ItemCorrelationMatrixProps {
  /** Ma trận Scale sample (m × k), cột theo đúng thứ tự `names`. */
  data: number[][];
  names: string[];
  meanInterItemR: number | null;
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
  meanInterItemR,
  initialOpen = false,
}: ItemCorrelationMatrixProps) {
  const [open, setOpen] = useState(initialOpen);
  const matrix = open ? computeInterItemMatrix(data) : null;

  return (
    <div
      className="mt-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-2 text-sm"
      data-testid="item-correlation-matrix"
    >
      <div className="flex flex-wrap items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => setOpen((prev) => !prev)}
          aria-expanded={open}
          className="rounded-md border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm"
        >
          {open ? t("reliabilityTab.hideMatrix") : t("reliabilityTab.showMatrix")}
        </button>
        <span className="text-neutral-600 dark:text-neutral-400">
          {t("reliabilityTab.meanInterItemRLabel")}:{" "}
          <span className="font-medium">{formatStat(meanInterItemR)}</span>
          <InfoHint term="interItemCorrelation" />
        </span>
      </div>
      {matrix && (
        <div className="overflow-x-auto mt-2">
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-600">
                <th className="p-2"></th>
                {names.map((name) => (
                  <th key={name} className="p-2 text-right font-medium whitespace-nowrap">
                    {name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.map((row, i) => (
                <tr key={names[i]} className="border-b border-neutral-100 dark:border-neutral-700/50">
                  <td className="p-2 font-medium whitespace-nowrap">{names[i]}</td>
                  {row.map((value, j) => (
                    <td key={`${names[i]}-${names[j]}`} className="p-2 text-right">
                      {formatStat(value)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
