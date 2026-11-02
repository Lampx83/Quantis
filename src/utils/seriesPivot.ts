import type { AggregatedGroup, AggregateMetrics } from "./aggregation";

export interface PivotedSeries {
  /** X-axis category value (Recharts `name`) */
  name: string;
  /** Map of Legend category -> aggregated value */
  series: Record<string, number>;
  /** Map of Legend category -> [lowOffset, highOffset] for <ErrorBar> */
  errors: Record<string, [number, number]>;
}

export type ErrorBarType = "ci95" | "se" | "sd" | "none";

/**
 * Calculates [lowOffset, highOffset] for a group given its aggregate metrics and requested error type.
 * When count < 2, the sample variance / standard error cannot be computed (collapses to [0, 0]).
 */
export function calculateErrorOffsets(
  metrics: AggregateMetrics | undefined,
  errorType: ErrorBarType
): [number, number] {
  if (!metrics || errorType === "none") {
    return [0, 0];
  }

  if (metrics.count < 2) {
    return [0, 0];
  }

  switch (errorType) {
    case "ci95": {
      const low = metrics.mean - metrics.ci95Lower;
      const high = metrics.ci95Upper - metrics.mean;
      return [low, high];
    }
    case "se": {
      return [metrics.se, metrics.se];
    }
    case "sd": {
      return [metrics.std, metrics.std];
    }
    default:
      return [0, 0];
  }
}

/**
 * Reshapes the long output of `aggregateData({ groupByCols: [xCol, legendCol] })`
 * into a wide `PivotedSeries[]` format where each entry represents an X category
 * and contains a dictionary of series values and error offsets keyed by Legend category.
 */
export function pivotByLegend(
  groups: AggregatedGroup[],
  legendCol: string,
  errorType: ErrorBarType = "none"
): PivotedSeries[] {
  if (!groups || !Array.isArray(groups) || groups.length === 0) {
    return [];
  }

  if (!legendCol || typeof legendCol !== "string" || legendCol.trim() === "") {
    return [];
  }

  // Preserve row ordering while grouping entries by X value
  const rowOrder: string[] = [];
  const rowMap = new Map<
    string,
    {
      series: Map<string, number>;
      errors: Map<string, [number, number]>;
    }
  >();

  for (const group of groups) {
    // Cần ít nhất 2 phần: các phần đầu là X, phần cuối là Legend.
    if (!group || !group.parts || group.parts.length < 2) {
      continue;
    }

    const legendVal = group.parts[group.parts.length - 1];
    const xVal = group.parts.slice(0, -1).join(" | ").trim();

    if (!rowMap.has(xVal)) {
      rowOrder.push(xVal);
      rowMap.set(xVal, {
        series: new Map<string, number>(),
        errors: new Map<string, [number, number]>(),
      });
    }

    const row = rowMap.get(xVal)!;
    row.series.set(legendVal, group.value);
    row.errors.set(legendVal, calculateErrorOffsets(group.metrics, errorType));
  }

  // Construct final PivotedSeries with naturally sorted keys for determinism
  const result: PivotedSeries[] = [];

  for (const xVal of rowOrder) {
    const row = rowMap.get(xVal);
    if (!row) continue;

    const sortedLegendKeys = Array.from(row.series.keys()).sort((a, b) =>
      a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" })
    );

    const seriesRecord: Record<string, number> = {};
    const errorsRecord: Record<string, [number, number]> = {};

    for (const key of sortedLegendKeys) {
      seriesRecord[key] = row.series.get(key)!;
      errorsRecord[key] = row.errors.get(key) ?? [0, 0];
    }

    result.push({
      name: xVal,
      series: seriesRecord,
      errors: errorsRecord,
    });
  }

  return result;
}

/**
 * Extracts all unique, naturally sorted series (legend) keys across all pivoted rows.
 */
export function getSeriesKeys(pivoted: PivotedSeries[]): string[] {
  if (!pivoted || !Array.isArray(pivoted)) {
    return [];
  }

  const keySet = new Set<string>();
  for (const row of pivoted) {
    if (row && row.series) {
      for (const k of Object.keys(row.series)) {
        keySet.add(k);
      }
    }
  }

  return Array.from(keySet).sort((a, b) => a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" }));
}
