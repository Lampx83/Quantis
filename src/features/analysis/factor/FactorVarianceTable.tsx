import { t } from "@/i18n";
import type { FactorSolution } from "@/utils/factorPca";
import type { FactorMethod } from "./runFactorAnalysis";

interface FactorVarianceTableProps extends Pick<FactorSolution, "rotation" | "varianceBefore" | "varianceAfter"> {
  method: FactorMethod;
}

function varianceRows(values: number[]) {
  let cumulative = 0;
  return values.map((value) => {
    cumulative += value;
    return { value, cumulative };
  });
}

export function FactorVarianceTable({ method, rotation, varianceBefore, varianceAfter }: FactorVarianceTableProps) {
  const pca = method === "pca";
  const rotated = rotation === "varimax";
  const groups = [{ label: t("factorTab.varianceBeforeRotation"), rows: varianceRows(varianceBefore) }];
  if (rotated) {
    groups.push({ label: t("factorTab.varianceAfterRotation"), rows: varianceRows(varianceAfter) });
  }
  const title = t("factorTab.varianceTitle");

  return (
    <section className="overflow-x-auto rounded-lg border border-neutral-200 bg-white text-sm dark:border-neutral-700 dark:bg-neutral-800">
      <h3 className="px-2 pt-2 font-medium">{title}</h3>
      <p className="px-2 pb-2 text-neutral-600 dark:text-neutral-400">{t("factorTab.varianceDenominator")}</p>
      <table aria-label={title} className="w-full tabular-nums">
        <colgroup span={1} />
        {groups.map(({ label }) => <colgroup key={label} span={2} />)}
        <thead>
          <tr className="border-y border-neutral-200 dark:border-neutral-700">
            <th scope="col" rowSpan={2} className="p-2 text-left">{t(pca ? "factorTab.factorColumnHeader" : "factorTab.pafColumnHeader")}</th>
            {groups.map(({ label }) => <th key={label} scope="colgroup" colSpan={2} className="p-2 text-right">{label}</th>)}
          </tr>
          <tr className="border-b border-neutral-200 dark:border-neutral-700">
            {groups.flatMap(({ label }) => [
              <th key={label} scope="col" className="p-2 text-right">{t("factorTab.varianceExplainedHeader")}</th>,
              <th key={`${label}-cumulative`} scope="col" className="p-2 text-right">{t("factorTab.cumulativeVariance")}</th>,
            ])}
          </tr>
        </thead>
        <tbody>
          {varianceBefore.map((_, i) => (
            <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/50">
              <th scope="row" className="p-2 text-left font-medium">{pca ? "PC" : "F"}{i + 1}</th>
              {groups.flatMap(({ label, rows }) => [
                <td key={label} className="p-2 text-right">{rows[i].value.toFixed(1)}%</td>,
                <td key={`${label}-cumulative`} className="p-2 text-right">{rows[i].cumulative.toFixed(1)}%</td>,
              ])}
            </tr>
          ))}
        </tbody>
      </table>
    </section>
  );
}
