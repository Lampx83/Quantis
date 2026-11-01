import { describe, it, expect } from "vitest";
import { computeProfile, getHistogramBins, binNumericForPie, computeTextStats } from "../stats";

const ROWS = 150_000;

function numericTable(): string[][] {
  const rows: string[][] = [["score"]];
  for (let i = 0; i < ROWS; i++) rows.push([String(i)]);
  return rows;
}

describe("large numeric datasets (150k rows)", () => {
  it("computes min and max in the data profile without a stack overflow", () => {
    const profile = computeProfile(numericTable())[0];
    expect(profile.min).toBe(0);
    expect(profile.max).toBe(ROWS - 1);
  });

  it("builds histogram bins without a stack overflow", () => {
    const values = Array.from({ length: ROWS }, (_, i) => i);
    const bins = getHistogramBins(values);
    expect(bins.length).toBeGreaterThan(0);
    expect(bins[0].binStart).toBe(0);
    expect(bins[bins.length - 1].binEnd).toBeGreaterThanOrEqual(ROWS - 1);
    expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(ROWS);
  });

  it("bins numeric values for a pie chart without a stack overflow", () => {
    const values = Array.from({ length: ROWS }, (_, i) => i);
    const bins = binNumericForPie(values, 4);
    expect(bins.length).toBe(4);
    expect(bins.reduce((sum, b) => sum + b.count, 0)).toBe(ROWS);
  });

  it("computes text statistics without a stack overflow", () => {
    const rows: string[][] = [["comment"]];
    for (let i = 0; i < ROWS; i++) rows.push(["two words"]);
    const stats = computeTextStats(rows, "comment");
    expect(stats).not.toBeNull();
    expect(stats!.minWordsPerRow).toBe(2);
    expect(stats!.maxWordsPerRow).toBe(2);
  });
});
