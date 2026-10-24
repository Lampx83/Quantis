import { describe, it, expect } from "vitest";
import { safeMin, safeMax, safeMinMax } from "../math";

describe("safeMin", () => {
  it("returns the smallest value", () => {
    expect(safeMin([3, 1, 2])).toBe(1);
    expect(safeMin([-5, -1, -10])).toBe(-10);
    expect(safeMin([1.5, 0.25, 2.75])).toBe(0.25);
  });

  it("propagates NaN like Math.min", () => {
    expect(safeMin([1, NaN, 2])).toBeNaN();
    expect(safeMin([NaN])).toBeNaN();
  });

  it("returns Infinity for an empty array, or the provided fallback", () => {
    expect(safeMin([])).toBe(Infinity);
    expect(safeMin([], NaN)).toBeNaN();
    expect(safeMin([], 0)).toBe(0);
  });

  it("handles typed arrays", () => {
    expect(safeMin(new Float64Array([4, 2, 9]))).toBe(2);
  });

  it("handles 150,000 values without overflowing the call stack", () => {
    const values = Array.from({ length: 150_000 }, (_, i) => 150_000 - i);
    expect(safeMin(values)).toBe(1);
  });
});

describe("safeMax", () => {
  it("returns the largest value", () => {
    expect(safeMax([3, 1, 2])).toBe(3);
    expect(safeMax([-5, -1, -10])).toBe(-1);
    expect(safeMax([1.5, 0.25, 2.75])).toBe(2.75);
  });

  it("propagates NaN like Math.max", () => {
    expect(safeMax([1, NaN, 2])).toBeNaN();
    expect(safeMax([NaN])).toBeNaN();
  });

  it("returns -Infinity for an empty array, or the provided fallback", () => {
    expect(safeMax([])).toBe(-Infinity);
    expect(safeMax([], NaN)).toBeNaN();
    expect(safeMax([], 0)).toBe(0);
  });

  it("handles typed arrays", () => {
    expect(safeMax(new Float64Array([4, 2, 9]))).toBe(9);
  });

  it("handles 150,000 values without overflowing the call stack", () => {
    const values = Array.from({ length: 150_000 }, (_, i) => i + 1);
    expect(safeMax(values)).toBe(150_000);
  });
});

describe("safeMinMax", () => {
  it("returns both extremes in one pass", () => {
    expect(safeMinMax([3, 1, 2])).toEqual([1, 3]);
    expect(safeMinMax([-5, -1, -10])).toEqual([-10, -1]);
  });

  it("propagates NaN", () => {
    expect(safeMinMax([1, NaN, 2])).toEqual([NaN, NaN]);
  });

  it("returns [Infinity, -Infinity] for an empty array", () => {
    expect(safeMinMax([])).toEqual([Infinity, -Infinity]);
  });

  it("handles 150,000 values without overflowing the call stack", () => {
    const values = new Float64Array(150_000);
    for (let i = 0; i < values.length; i++) values[i] = i - 75_000;
    expect(safeMinMax(values)).toEqual([-75_000, 74_999]);
  });
});
