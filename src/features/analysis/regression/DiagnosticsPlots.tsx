import {
  CartesianGrid,
  ReferenceLine,
  ResponsiveContainer,
  Scatter,
  ScatterChart,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type {
  Dataset,
  DiagnosticsObs,
  DiagnosticsPayloadOk,
  DiagnosticsQq,
} from "@/types";
import { t } from "@/i18n";

/** Plot caps mirror the backend's payload caps (R5.4–R5.6). */
const QQ_PLOT_CAP = 2000;
const COOK_PLOT_CAP = 5000;
export const RESIDUAL_ZERO = 0;

interface NumericPoint {
  x: number;
  y: number;
}

interface PlotSegment {
  from: NumericPoint;
  to: NumericPoint;
}

function finitePoints(pairs: Array<[number | null, number | null]>): NumericPoint[] {
  const points: NumericPoint[] = [];
  for (const [x, y] of pairs) {
    if (x == null || y == null || !Number.isFinite(x) || !Number.isFinite(y)) continue;
    points.push({ x, y });
  }
  return points;
}

function cappedIndices(length: number, cap: number): number[] {
  if (length <= cap) return Array.from({ length }, (_, i) => i);
  return Array.from({ length: cap }, (_, i) =>
    Math.round((i * (length - 1)) / (cap - 1))
  );
}

/** Residuals vs fitted: one point per plotted observation. */
export function buildResidualPoints(obs: DiagnosticsObs): NumericPoint[] {
  return finitePoints(obs.rowIndex.map((_, i) => [obs.fitted[i], obs.resid[i]]));
}

/** Normal Q-Q: sample quantile against theoretical quantile, capped at 2,000. */
export function buildQqPoints(qq: DiagnosticsQq): NumericPoint[] {
  const length = Math.min(qq.theoretical.length, qq.sample.length);
  const points: NumericPoint[] = [];
  for (const index of cappedIndices(length, QQ_PLOT_CAP)) {
    const theoretical = qq.theoretical[index];
    const sample = qq.sample[index];
    if (theoretical == null || sample == null) continue;
    if (!Number.isFinite(theoretical) || !Number.isFinite(sample)) continue;
    points.push({ x: theoretical, y: sample });
  }
  return points;
}

/** The 45° reference line across the theoretical quantile range. */
export function qqDiagonal(theoretical: Array<number | null>): PlotSegment | null {
  const finite = theoretical.filter(
    (value): value is number => value != null && Number.isFinite(value)
  );
  if (finite.length === 0) return null;
  const min = Math.min(...finite);
  const max = Math.max(...finite);
  return { from: { x: min, y: min }, to: { x: max, y: max } };
}

/** Cook's distance by observation; x is the 1-based Analysis row, capped at 5,000. */
export function buildCookPoints(obs: DiagnosticsObs): NumericPoint[] {
  const length = Math.min(obs.rowIndex.length, obs.cookD.length);
  const points: NumericPoint[] = [];
  for (const index of cappedIndices(length, COOK_PLOT_CAP)) {
    const rowIndex = obs.rowIndex[index];
    const cookD = obs.cookD[index];
    if (rowIndex == null || cookD == null) continue;
    if (!Number.isFinite(rowIndex) || !Number.isFinite(cookD)) continue;
    points.push({ x: rowIndex + 1, y: cookD });
  }
  return points;
}

/** The 4/n line is computed on the full Model sample, never the plotted stride. */
export function cookThreshold(diagnostics: DiagnosticsPayloadOk): number {
  return diagnostics.sample.nUsed > 0 ? 4 / diagnostics.sample.nUsed : 0;
}

/** Axis titles follow the Variable View label, falling back to the column name (R5.2). */
export function axisLabel(
  column: string,
  variables?: Dataset["variables"]
): string {
  const label = variables?.[column]?.label?.trim();
  return label ? label : column;
}

export interface DiagnosticsPlotsProps {
  diagnostics: DiagnosticsPayloadOk;
  yCol: string;
  xCols: string[];
  variables?: Dataset["variables"];
}

export function DiagnosticsPlots({
  diagnostics,
  yCol,
  xCols,
  variables,
}: DiagnosticsPlotsProps) {
  const obs = diagnostics.obs;
  const qq = diagnostics.qq;
  if (!obs || !qq) return null;

  const residualPoints = buildResidualPoints(obs);
  const qqPoints = buildQqPoints(qq);
  const diagonal = qqDiagonal(qq.theoretical);
  const cookPoints = buildCookPoints(obs);
  const threshold = cookThreshold(diagnostics);

  const yLabel = axisLabel(yCol, variables);
  const xLabels = xCols.map((col) => axisLabel(col, variables)).join(", ");

  const axisProps = { stroke: "#9ca3af", tick: { fontSize: 10 } } as const;

  return (
    <section data-testid="regdiag-plots" className="space-y-2">
      <p data-testid="regdiag-plots-model" className="text-xs text-neutral-600 dark:text-neutral-400">
        {t("regDiag.modelLine", { y: yLabel, x: xLabels })}
      </p>

      <div className="grid gap-3 lg:grid-cols-3">
        <figure data-testid="regdiag-plot-resid" className="rounded border border-neutral-200 dark:border-neutral-700 p-2">
          <figcaption className="text-xs font-medium mb-1">
            {t("regDiag.plot.residVsFitted")}
          </figcaption>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 8, right: 8, bottom: 24, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="x"
                  {...axisProps}
                  label={{
                    value: t("regDiag.plot.axisFitted", { y: yLabel }),
                    position: "insideBottom",
                    offset: -12,
                    fontSize: 10,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  {...axisProps}
                  label={{
                    value: t("regDiag.plot.axisResid"),
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 10,
                  }}
                />
                <Tooltip />
                <ReferenceLine y={RESIDUAL_ZERO} stroke="#6b7280" />
                <Scatter data={residualPoints} fill="#0ea5e9" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </figure>

        <figure data-testid="regdiag-plot-qq" className="rounded border border-neutral-200 dark:border-neutral-700 p-2">
          <figcaption className="text-xs font-medium mb-1">{t("regDiag.plot.qq")}</figcaption>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 8, right: 8, bottom: 24, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="x"
                  {...axisProps}
                  label={{
                    value: t("regDiag.plot.axisTheoretical"),
                    position: "insideBottom",
                    offset: -12,
                    fontSize: 10,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  {...axisProps}
                  label={{
                    value: t("regDiag.plot.axisSample"),
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 10,
                  }}
                />
                <Tooltip />
                {diagonal && (
                  <ReferenceLine
                    segment={[diagonal.from, diagonal.to]}
                    stroke="#6b7280"
                    strokeDasharray="4 4"
                  />
                )}
                <Scatter data={qqPoints} fill="#0ea5e9" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </figure>

        <figure data-testid="regdiag-plot-cooks" className="rounded border border-neutral-200 dark:border-neutral-700 p-2">
          <figcaption className="text-xs font-medium mb-1">{t("regDiag.plot.cooks")}</figcaption>
          <div className="h-[220px]">
            <ResponsiveContainer width="100%" height={220}>
              <ScatterChart margin={{ top: 8, right: 8, bottom: 24, left: 8 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis
                  type="number"
                  dataKey="x"
                  {...axisProps}
                  label={{
                    value: t("regDiag.plot.axisObservation"),
                    position: "insideBottom",
                    offset: -12,
                    fontSize: 10,
                  }}
                />
                <YAxis
                  type="number"
                  dataKey="y"
                  {...axisProps}
                  label={{
                    value: t("regDiag.plot.axisCookD"),
                    angle: -90,
                    position: "insideLeft",
                    fontSize: 10,
                  }}
                />
                <Tooltip />
                <ReferenceLine
                  y={threshold}
                  stroke="#dc2626"
                  strokeDasharray="4 4"
                  label={{ value: t("regDiag.plot.cooksCut"), fontSize: 10, position: "insideTopRight" }}
                />
                <Scatter data={cookPoints} fill="#0ea5e9" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        </figure>
      </div>

      {diagnostics.sampled && (
        <p data-testid="regdiag-plot-sampled" className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("regDiag.plot.sampled")}
        </p>
      )}
    </section>
  );
}
