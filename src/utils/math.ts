/**
 * Stack-safe replacements for `Math.min(...arr)` / `Math.max(...arr)`.
 *
 * Spreading a large array into a call puts every element on the JS call stack.
 * V8 rejects that at roughly 100,000 arguments with
 * `RangeError: Maximum call stack size exceeded`, which crashes profiling,
 * histograms, box plots and text statistics on large datasets.
 *
 * These helpers iterate instead, matching `Math.min` / `Math.max` semantics:
 * NaN propagates, empty input returns the boundary value (or the fallback).
 */

export function safeMin(arr: ArrayLike<number>, fallback: number = Infinity): number {
  const len = arr.length;
  if (len === 0) return fallback;
  let min = arr[0];
  if (Number.isNaN(min)) return NaN;
  for (let i = 1; i < len; i++) {
    const v = arr[i];
    if (Number.isNaN(v)) return NaN;
    if (v < min) min = v;
  }
  return min;
}

export function safeMax(arr: ArrayLike<number>, fallback: number = -Infinity): number {
  const len = arr.length;
  if (len === 0) return fallback;
  let max = arr[0];
  if (Number.isNaN(max)) return NaN;
  for (let i = 1; i < len; i++) {
    const v = arr[i];
    if (Number.isNaN(v)) return NaN;
    if (v > max) max = v;
  }
  return max;
}

/** Both extremes in a single pass. Empty input returns `[Infinity, -Infinity]`. */
export function safeMinMax(arr: ArrayLike<number>): [number, number] {
  const len = arr.length;
  if (len === 0) return [Infinity, -Infinity];
  let min = arr[0];
  let max = arr[0];
  if (Number.isNaN(min)) return [NaN, NaN];
  for (let i = 1; i < len; i++) {
    const v = arr[i];
    if (Number.isNaN(v)) return [NaN, NaN];
    if (v < min) min = v;
    if (v > max) max = v;
  }
  return [min, max];
}
