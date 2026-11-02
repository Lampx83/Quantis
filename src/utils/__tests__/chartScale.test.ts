import { describe, it, expect } from "vitest";
import {
  calculateNiceScale,
  extractChartExtent,
  computeAxisScale,
} from "../chartScale";

describe("calculateNiceScale — Nice Numbers Scale & Headroom Algorithm", () => {
  it("expands ceiling above 2.0 so error bar whiskers have headroom (user reported bug)", () => {
    // In user screenshot: values reach 2.0 with positive error offset
    const result = calculateNiceScale(0, 2.0, { isBar: true, padRatio: 0.15 });
    expect(result.domain[0]).toBe(0);
    expect(result.domain[1]).toBe(2.5);
    expect(result.ticks).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
    expect(result.step).toBe(0.5);
  });

  it("handles decimal scales cleanly without floating point precision issues", () => {
    const result = calculateNiceScale(0, 0.045, { isBar: true, padRatio: 0.15 });
    expect(result.domain[0]).toBe(0);
    expect(result.domain[1]).toBeGreaterThanOrEqual(0.045);
    // Ticks should be clean numbers (no 0.020000000000000004)
    result.ticks.forEach((tick) => {
      expect(Number.isFinite(tick)).toBe(true);
      expect(tick.toString().length).toBeLessThan(10);
    });
  });

  it("handles zero and equal values gracefully", () => {
    const zeroResult = calculateNiceScale(0, 0, { isBar: true });
    expect(zeroResult.domain[0]).toBe(0);
    expect(zeroResult.domain[1]).toBeGreaterThan(0);
    expect(zeroResult.ticks.length).toBeGreaterThan(1);

    const equalResult = calculateNiceScale(5, 5, { isBar: true });
    expect(equalResult.domain[0]).toBe(0);
    expect(equalResult.domain[1]).toBeGreaterThan(5);
  });

  it("anchors to 0 baseline for bar charts when values are non-negative", () => {
    const result = calculateNiceScale(10, 50, { isBar: true });
    expect(result.domain[0]).toBe(0);
    expect(result.domain[1]).toBeGreaterThanOrEqual(50);
  });

  it("allows non-zero baseline for line charts when isBar is false", () => {
    const result = calculateNiceScale(1.2, 1.8, { isBar: false, padRatio: 0.1 });
    expect(result.domain[0]).toBe(1);
    expect(result.domain[1]).toBe(2);
    expect(result.ticks).toEqual([1, 1.2, 1.4, 1.6, 1.8, 2]);
  });

  it("handles negative and mixed values", () => {
    const result = calculateNiceScale(-15, 25, { isBar: true });
    expect(result.domain[0]).toBeLessThanOrEqual(-15);
    expect(result.domain[1]).toBeGreaterThanOrEqual(25);
    expect(result.ticks).toContain(0);
  });
});

describe("extractChartExtent — Data Extent Extraction", () => {
  it("returns default [0, 1] for empty or invalid data", () => {
    expect(extractChartExtent([], { hasLegend: false })).toEqual({ min: 0, max: 1 });
    expect(extractChartExtent(null as any, { hasLegend: false })).toEqual({ min: 0, max: 1 });
  });

  it("extracts extent for single-series data without errors", () => {
    const data = [
      { name: "A", count: 1.2 },
      { name: "B", count: 2.0 },
      { name: "C", count: 0.8 },
    ];
    const extent = extractChartExtent(data, { hasLegend: false, includeErrors: false });
    expect(extent.min).toBe(0.8);
    expect(extent.max).toBe(2.0);
  });

  it("extracts extent for single-series data including error offsets", () => {
    const data = [
      { name: "A", count: 1.2, error: [0.1, 0.15] },
      { name: "B", count: 2.0, error: [0.05, 0.2] }, // max whisker is 2.2
      { name: "C", count: 0.5, error: [0.2, 0.1] },  // min whisker is 0.3
    ];
    const extent = extractChartExtent(data, { hasLegend: false, includeErrors: true });
    expect(extent.min).toBeCloseTo(0.3, 5);
    expect(extent.max).toBeCloseTo(2.2, 5);
  });

  it("extracts extent for multi-series clustered data with legend errors", () => {
    const data = [
      {
        name: "Cat 1",
        Series1: 1.5,
        Series2: 2.0,
        _err_Series1: [0.1, 0.1],
        _err_Series2: [0.05, 0.15], // max whisker: 2.15
      },
      {
        name: "Cat 2",
        Series1: 0.9,
        Series2: 1.1,
        _err_Series1: [0.2, 0.1], // min whisker: 0.7
        _err_Series2: [0.1, 0.1],
      },
    ];
    const extent = extractChartExtent(data, {
      hasLegend: true,
      legendKeys: ["Series1", "Series2"],
      barMode: "clustered",
      includeErrors: true,
    });
    expect(extent.min).toBeCloseTo(0.7, 5);
    expect(extent.max).toBeCloseTo(2.15, 5);
  });

  it("extracts cumulative extent for stacked bar chart", () => {
    const data = [
      { name: "Cat 1", Series1: 10, Series2: 20 }, // sum 30
      { name: "Cat 2", Series1: 15, Series2: 25 }, // sum 40
    ];
    const extent = extractChartExtent(data, {
      hasLegend: true,
      legendKeys: ["Series1", "Series2"],
      barMode: "stacked",
      includeErrors: false,
    });
    expect(extent.min).toBe(0);
    expect(extent.max).toBe(40);
  });

  it("extracts cumulative negative extent for stacked bar chart with negative values", () => {
    const data = [
      { name: "Cat 1", Series1: -5, Series2: -2 },
      { name: "Cat 2", Series1: -3, Series2: -1 },
    ];
    const extent = extractChartExtent(data, {
      hasLegend: true,
      legendKeys: ["Series1", "Series2"],
      barMode: "stacked",
      includeErrors: false,
    });
    expect(extent.min).toBe(-7);
    expect(extent.max).toBe(0);
  });
});

describe("computeAxisScale — Integration Helper", () => {
  it("computes end-to-end nice domain and ticks for clustered multi-series data with errors", () => {
    const data = [
      {
        name: "1",
        "Group A": 1.4,
        "Group B": 2.0, // reaches 2.0 with error 0.1 -> whisker 2.1
        _err_GroupA: [0.1, 0.1],
        _err_GroupB: [0.05, 0.1],
      },
    ];
    const scale = computeAxisScale(
      data,
      {
        hasLegend: true,
        legendKeys: ["Group A", "Group B"],
        barMode: "clustered",
        includeErrors: true,
      },
      { isBar: true, padRatio: 0.15 }
    );

    expect(scale.domain[0]).toBe(0);
    expect(scale.domain[1]).toBe(2.5);
    expect(scale.ticks).toEqual([0, 0.5, 1, 1.5, 2, 2.5]);
  });
});
