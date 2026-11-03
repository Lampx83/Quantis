/**
 * Academic Chart Axis Scaling & "Nice Numbers" Module
 *
 * Implements standard data visualization scale calculation (Wilkinson/Heckbert)
 * to provide proper breathing room (headroom) for ErrorBar whiskers and data labels,
 * avoiding visual clipping at axis boundaries.
 */

export interface ScaleDomainOptions {
  /** Headroom padding ratio applied to extent span (default: 0.15 = 15%) */
  padRatio?: number;
  /** Whether the axis belongs to a bar chart (forces 0 baseline when non-negative) */
  isBar?: boolean;
  /** Target number of tick intervals (default: 5) */
  targetTicks?: number;
}

export interface NiceScaleResult {
  domain: [number, number];
  ticks: number[];
  step: number;
}

export interface ChartExtentOptions {
  hasLegend: boolean;
  legendKeys?: string[];
  barMode?: "clustered" | "stacked";
  includeErrors?: boolean;
}

/**
 * Calculates human-friendly "nice" tick intervals and domain bounds.
 * Uses factors from {1, 2, 2.5, 5, 10} * 10^k.
 */
export function calculateNiceScale(
  minVal: number,
  maxVal: number,
  options: ScaleDomainOptions = {}
): NiceScaleResult {
  const { padRatio = 0.15, isBar = true, targetTicks = 5 } = options;

  let min = Number.isFinite(minVal) ? minVal : 0;
  let max = Number.isFinite(maxVal) ? maxVal : 1;

  if (min > max) {
    const tmp = min;
    min = max;
    max = tmp;
  }

  // Handle zero or equal range
  if (min === max) {
    if (max === 0) {
      min = 0;
      max = 1;
    } else if (max > 0) {
      min = isBar ? 0 : max * 0.8;
      max = max * 1.25;
    } else {
      max = isBar ? 0 : max * 0.8;
      min = min * 1.25;
    }
  }

  // Bar charts must anchor to 0 baseline if non-negative
  if (isBar) {
    if (min > 0) min = 0;
    if (max < 0) max = 0;
  }

  const span = max - min;
  const rawMax = isBar && max === 0 ? 0 : max + span * padRatio;
  const rawMin = isBar && min === 0 ? 0 : min - span * padRatio;

  const rawRange = rawMax - rawMin;
  const rawStep = rawRange / Math.max(1, targetTicks);
  const exponent = Math.floor(Math.log10(rawStep));
  const magnitude = Math.pow(10, exponent);
  const residual = rawStep / magnitude;

  let niceResidual: number;
  if (residual > 5) niceResidual = 10;
  else if (residual > 2.5) niceResidual = 5;
  else if (residual > 2) niceResidual = 2.5;
  else if (residual > 1) niceResidual = 2;
  else niceResidual = 1;

  const niceStep = niceResidual * magnitude;
  const niceMin = Math.floor(rawMin / niceStep) * niceStep;
  const niceMax = Math.ceil(rawMax / niceStep) * niceStep;

  // Decimal precision to guard against floating point artifacts (e.g. 0.30000000000000004)
  const precision = Math.max(0, -exponent + (niceResidual === 2.5 ? 1 : 0));

  const ticks: number[] = [];
  const epsilon = niceStep * 1e-6;
  for (let t = niceMin; t <= niceMax + epsilon; t += niceStep) {
    const rounded = Number(t.toFixed(precision));
    ticks.push(Object.is(rounded, -0) ? 0 : rounded);
  }

  return {
    domain: [ticks[0] ?? niceMin, ticks[ticks.length - 1] ?? niceMax],
    ticks,
    step: niceStep,
  };
}

/**
 * Scans single-series or multi-series chart data items, taking error offsets
 * (`error: [low, high]` or `_err_${key}: [low, high]`) into account to find true min and max extents.
 */
export function extractChartExtent(
  data: any[],
  options: ChartExtentOptions
): { min: number; max: number } {
  if (!data || !Array.isArray(data) || data.length === 0) {
    return { min: 0, max: 1 };
  }

  let min = Infinity;
  let max = -Infinity;

  if (options.hasLegend) {
    const keys = options.legendKeys ?? [];
    for (const row of data) {
      if (!row) continue;

      if (options.barMode === "stacked") {
        // Stacked bar: sum positive and negative series separately
        let stackSum = 0;
        let stackNeg = 0;
        let maxErr = 0;
        let minErr = 0;
        for (const k of keys) {
          const val = Number(row[k]);
          if (!Number.isNaN(val)) {
            if (val > 0) {
              stackSum += val;
            } else if (val < 0) {
              stackNeg += val;
            }
          }
          if (options.includeErrors) {
            const err = row[`_err_${k}`] ?? row._errors?.[k];
            if (Array.isArray(err)) {
              if (Number.isFinite(err[1])) {
                maxErr = Math.max(maxErr, err[1]);
              }
              if (val < 0 && Number.isFinite(err[0])) {
                minErr = Math.max(minErr, err[0]);
              }
            }
          }
        }
        min = Math.min(min, stackNeg - minErr);
        max = Math.max(max, stackSum + maxErr);
      } else {
        // Clustered bar or multi-series line
        for (const k of keys) {
          const val = Number(row[k]);
          if (Number.isNaN(val)) continue;

          let lower = val;
          let upper = val;

          if (options.includeErrors) {
            const err = row[`_err_${k}`] ?? row._errors?.[k];
            if (Array.isArray(err)) {
              const errLow = Number(err[0]) || 0;
              const errHigh = Number(err[1]) || 0;
              lower = val - errLow;
              upper = val + errHigh;
            }
          }

          min = Math.min(min, lower);
          max = Math.max(max, upper);
        }
      }
    }
  } else {
    // Single-series data
    for (const row of data) {
      if (!row) continue;

      const rawVal =
        row.count !== undefined
          ? row.count
          : row.y !== undefined
          ? row.y
          : row.value;

      const val = Number(rawVal);
      if (Number.isNaN(val)) continue;

      let lower = val;
      let upper = val;

      if (options.includeErrors && row.error && Array.isArray(row.error)) {
        const errLow = Number(row.error[0]) || 0;
        const errHigh = Number(row.error[1]) || 0;
        lower = val - errLow;
        upper = val + errHigh;
      }

      min = Math.min(min, lower);
      max = Math.max(max, upper);
    }
  }

  if (!Number.isFinite(min) || !Number.isFinite(max)) {
    return { min: 0, max: 1 };
  }

  return { min, max };
}

/**
 * Convenience helper computing nice domain and ticks directly from chart data and configuration.
 */
export function computeAxisScale(
  data: any[],
  extentOptions: ChartExtentOptions,
  scaleOptions?: ScaleDomainOptions
): NiceScaleResult {
  const extent = extractChartExtent(data, extentOptions);
  return calculateNiceScale(extent.min, extent.max, scaleOptions);
}
