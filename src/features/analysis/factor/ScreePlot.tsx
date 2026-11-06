import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis } from "recharts";
import { t } from "@/i18n";
import type { FactorMethod } from "./runFactorAnalysis";

interface ScreePlotProps {
  method: FactorMethod;
  eigenvalues: number[];
  parallelCutoff?: number[] | null;
  suggestedCount: number | null;
  usedCount: number | null;
}

export function ScreePlot({ method, eigenvalues, parallelCutoff, suggestedCount, usedCount }: ScreePlotProps) {
  if (eigenvalues.length === 0) return null;

  const pca = method === "pca";
  const rankLabel = t(pca ? "factorTab.componentRank" : "factorTab.factorRank");
  const observedLabel = t(pca ? "factorTab.pearsonRoots" : "factorTab.smcRoots");
  const referenceLabel = t(pca ? "factorTab.kaiserCutoff" : "factorTab.parallelCutoff");
  const hasReference = pca || parallelCutoff != null;
  const points = eigenvalues.map((observed, i) => ({ rank: i + 1, observed, reference: pca ? 1 : parallelCutoff?.[i] }));
  return (
    <section className="mb-4 rounded-lg border border-neutral-200 bg-white p-3 text-sm dark:border-neutral-700 dark:bg-neutral-800" data-testid="factor-scree">
      <h3 className="font-medium">{t("factorTab.screeTitle")}</h3>
      <dl className="my-2 flex flex-wrap gap-x-8 gap-y-2">
        <div>
          <dt>{t(pca ? "factorTab.componentsSuggested" : "factorTab.factorsSuggested")}</dt>
          <dd className="font-semibold tabular-nums">{suggestedCount ?? "—"}</dd>
        </div>
        <div>
          <dt>{t(pca ? "factorTab.componentsUsed" : "factorTab.factorsUsed")}</dt>
          <dd className="font-semibold tabular-nums">{usedCount ?? "—"}</dd>
        </div>
      </dl>
      <ul className="mb-2 flex flex-wrap gap-x-5 gap-y-1">
        <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-blue-500" aria-hidden="true" />{observedLabel}</li>
        {hasReference && <li className="flex items-center gap-2"><span className="w-5 border-t-2 border-dashed border-orange-500" aria-hidden="true" />{referenceLabel}</li>}
      </ul>
      <div aria-hidden="true">
        <ResponsiveContainer width="100%" height={220}>
          <LineChart data={points} margin={{ top: 10, right: 16, bottom: 4, left: 0 }}>
            <CartesianGrid vertical={false} stroke="#737373" strokeOpacity={0.24} />
            <XAxis dataKey="rank" type="number" domain={[1, eigenvalues.length]} allowDecimals={false} tick={{ fill: "currentColor", fontSize: 12 }} />
            <YAxis domain={["auto", "auto"]} width={44} tick={{ fill: "currentColor", fontSize: 12 }} />
            <Line type="linear" dataKey="observed" stroke="#3b82f6" strokeWidth={2} dot={false} isAnimationActive={false} />
            {hasReference && <Line type="linear" dataKey="reference" stroke="#f97316" strokeWidth={2} strokeDasharray="6 4" dot={false} isAnimationActive={false} />}
          </LineChart>
        </ResponsiveContainer>
        <p className="text-center text-xs">{rankLabel}</p>
      </div>
      <details className="mt-3">
        <summary className="cursor-pointer font-medium">{t("factorTab.screeValues")}</summary>
        <table className="mt-2 w-full tabular-nums">
          <thead>
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              <th scope="col" className="p-2 text-left">{rankLabel}</th>
              <th scope="col" className="p-2 text-right">{observedLabel}</th>
              {hasReference && <th scope="col" className="p-2 text-right">{referenceLabel}</th>}
            </tr>
          </thead>
          <tbody>
            {points.map(({ rank, observed, reference }) => (
              <tr key={rank} className="border-b border-neutral-100 dark:border-neutral-700/50">
                <th scope="row" className="p-2 text-left font-normal">{rank}</th>
                <td className="p-2 text-right">{observed.toFixed(3)}</td>
                {reference != null && <td className="p-2 text-right">{reference.toFixed(3)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </details>
    </section>
  );
}
