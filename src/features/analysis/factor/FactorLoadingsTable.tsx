import { useState } from "react";
import { t } from "@/i18n";
import type { FactorSolution } from "@/utils/factorPca";
import type { FactorMethod } from "./runFactorAnalysis";
import { getLoadingFlags } from "./loadingFlags";

interface FactorLoadingsTableProps {
  method: FactorMethod;
  columnNames: string[];
  solution: FactorSolution;
}

export function FactorLoadingsTable({ method, columnNames, solution }: FactorLoadingsTableProps) {
  const [reviewOnly, setReviewOnly] = useState(false);
  const { loadings, communalities, nFactors, rotation } = solution;
  const pca = method === "pca";
  const prefix = pca ? "PC" : "F";
  const title = pca
    ? t(rotation === "none" ? "factorTab.pcaUnrotatedLoadings" : "factorTab.loadingsMatrixHeader")
    : t(rotation === "none" ? "factorTab.pafUnrotatedLoadings" : "factorTab.pafLoadingsHeader");
  const items = columnNames.map((name, i) => ({
    name, values: loadings[i], communality: communalities[i], ...getLoadingFlags(loadings[i], communalities[i]),
  }));
  const visible = reviewOnly ? items.filter((item) => item.flags.length > 0) : items;

  return (
    <section className="overflow-x-auto rounded-lg border border-neutral-200 bg-white text-sm dark:border-neutral-700 dark:bg-neutral-800">
      <h3 className="p-2 font-medium">{title}</h3>
      <label className="inline-flex cursor-pointer items-center gap-2 px-2 pb-2">
        <input type="checkbox" checked={reviewOnly} onChange={(event) => setReviewOnly(event.target.checked)} />
        {t("factorTab.reviewOnly")}
      </label>
      <table className="w-full tabular-nums" aria-label={title}>
        <thead>
          <tr className="border-y border-neutral-200 dark:border-neutral-700">
            <th scope="col" className="p-2 text-left">{t("factorTab.variableColumnHeader")}</th>
            {Array.from({ length: nFactors }, (_, i) => (
              <th scope="col" key={i} className="p-2 text-right">{prefix}{i + 1}</th>
            ))}
            <th scope="col" className="p-2 text-right">{t("factorTab.communalityHeader")}</th>
            <th scope="col" className="p-2 text-left">{t("factorTab.reviewHeader")}</th>
          </tr>
        </thead>
        <tbody>
          {visible.map(({ name, values, communality, primaryIndex, flags }) => (
            <tr key={name} className="border-b border-neutral-100 dark:border-neutral-700/50">
              <th scope="row" className="p-2 text-left font-medium">{name}</th>
              {values.map((value, j) => (
                <td key={j} className="p-2 text-right">
                  {j === primaryIndex ? (
                    <strong title={t("factorTab.primaryLoading")} className="rounded bg-blue-50 px-1 dark:bg-blue-950">{value.toFixed(3)}</strong>
                  ) : value.toFixed(3)}
                </td>
              ))}
              <td className="p-2 text-right">{communality.toFixed(3)}</td>
              <td className="p-2 text-amber-800 dark:text-amber-300">
                {flags.length ? flags.map((flag) => t(`factorTab.${flag}`)).join(" · ") : "—"}
              </td>
            </tr>
          ))}
          {visible.length === 0 && (
            <tr><td colSpan={nFactors + 3} className="p-2">{t("factorTab.noItemsToReview")}</td></tr>
          )}
        </tbody>
      </table>
    </section>
  );
}
