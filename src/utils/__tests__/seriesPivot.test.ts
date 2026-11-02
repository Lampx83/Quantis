import { describe, it, expect } from "vitest";
import { pivotByLegend, getSeriesKeys } from "../seriesPivot";
import type { AggregatedGroup, AggregateMetrics } from "../aggregation";

function createMockMetrics(overrides: Partial<AggregateMetrics> = {}): AggregateMetrics {
  return {
    mean: 15,
    sum: 150,
    count: 10,
    std: 5,
    median: 15,
    min: 5,
    max: 25,
    se: 2.5,
    ci95Lower: 10,
    ci95Upper: 20,
    ...overrides,
  };
}

describe("seriesPivot", () => {
  describe("empty and edge case inputs", () => {
    it("returns empty array when input groups is empty or undefined", () => {
      expect(pivotByLegend([], "Gender", "ci95")).toEqual([]);
      // @ts-expect-error testing null/undefined resilience
      expect(pivotByLegend(null, "Gender", "ci95")).toEqual([]);
      // @ts-expect-error testing null/undefined resilience
      expect(pivotByLegend(undefined, "Gender", "ci95")).toEqual([]);
    });

    it("returns empty array when legendCol is empty or whitespace", () => {
      const groups: AggregatedGroup[] = [
        { name: "Dept A | M", value: 10, metrics: createMockMetrics() },
      ];
      expect(pivotByLegend(groups, "", "ci95")).toEqual([]);
      expect(pivotByLegend(groups, "   ", "ci95")).toEqual([]);
    });

    it("returns empty array when groups lack the delimiter separator", () => {
      const groups: AggregatedGroup[] = [
        { name: "Dept A", value: 10, metrics: createMockMetrics() },
        { name: "Dept B", value: 20, metrics: createMockMetrics() },
      ];
      expect(pivotByLegend(groups, "Gender", "ci95")).toEqual([]);
    });
  });

  describe("long to wide pivot", () => {
    it("pivots single legend column into wide format preserving values and emitting one row per X", () => {
      const groups: AggregatedGroup[] = [
        { name: "Dept A | Female", value: 12, metrics: createMockMetrics({ mean: 12 }) },
        { name: "Dept A | Male", value: 18, metrics: createMockMetrics({ mean: 18 }) },
        { name: "Dept B | Female", value: 15, metrics: createMockMetrics({ mean: 15 }) },
        { name: "Dept B | Male", value: 20, metrics: createMockMetrics({ mean: 20 }) },
      ];

      const pivoted = pivotByLegend(groups, "Gender", "ci95");

      expect(pivoted).toHaveLength(2);
      expect(pivoted[0].name).toBe("Dept A");
      expect(pivoted[0].series).toEqual({ Female: 12, Male: 18 });
      expect(pivoted[1].name).toBe("Dept B");
      expect(pivoted[1].series).toEqual({ Female: 15, Male: 20 });
    });

    it("handles uneven series across different X categories", () => {
      const groups: AggregatedGroup[] = [
        { name: "Dept A | Full-time", value: 40, metrics: createMockMetrics() },
        { name: "Dept A | Part-time", value: 20, metrics: createMockMetrics() },
        { name: "Dept B | Full-time", value: 35, metrics: createMockMetrics() },
      ];

      const pivoted = pivotByLegend(groups, "Employment", "ci95");

      expect(pivoted).toHaveLength(2);
      expect(pivoted[0].name).toBe("Dept A");
      expect(pivoted[0].series).toEqual({ "Full-time": 40, "Part-time": 20 });
      expect(pivoted[1].name).toBe("Dept B");
      expect(pivoted[1].series).toEqual({ "Full-time": 35 });
    });
  });

  describe("error offset calculations", () => {
    it("calculates ci95 offsets as [mean - ci95Lower, ci95Upper - mean]", () => {
      const groups: AggregatedGroup[] = [
        {
          name: "Group 1 | Alpha",
          value: 15,
          metrics: createMockMetrics({ mean: 15, ci95Lower: 10, ci95Upper: 20 }),
        },
      ];

      const pivoted = pivotByLegend(groups, "Type", "ci95");
      expect(pivoted[0].errors.Alpha).toEqual([5, 5]);
    });

    it("calculates se offsets as [se, se]", () => {
      const groups: AggregatedGroup[] = [
        {
          name: "Group 1 | Alpha",
          value: 15,
          metrics: createMockMetrics({ se: 2.5 }),
        },
      ];

      const pivoted = pivotByLegend(groups, "Type", "se");
      expect(pivoted[0].errors.Alpha).toEqual([2.5, 2.5]);
    });

    it("calculates sd offsets as [std, std]", () => {
      const groups: AggregatedGroup[] = [
        {
          name: "Group 1 | Alpha",
          value: 15,
          metrics: createMockMetrics({ std: 5.2 }),
        },
      ];

      const pivoted = pivotByLegend(groups, "Type", "sd");
      expect(pivoted[0].errors.Alpha).toEqual([5.2, 5.2]);
    });

    it("collapses error offsets to [0, 0] when n = 1", () => {
      const n1Metrics: AggregateMetrics = {
        mean: 10,
        sum: 10,
        count: 1,
        std: 0,
        median: 10,
        min: 10,
        max: 10,
        se: 0,
        ci95Lower: 10,
        ci95Upper: 10,
      };

      const groups: AggregatedGroup[] = [
        { name: "Group 1 | Alpha", value: 10, metrics: n1Metrics },
      ];

      expect(pivotByLegend(groups, "Type", "ci95")[0].errors.Alpha).toEqual([0, 0]);
      expect(pivotByLegend(groups, "Type", "se")[0].errors.Alpha).toEqual([0, 0]);
      expect(pivotByLegend(groups, "Type", "sd")[0].errors.Alpha).toEqual([0, 0]);
    });
  });

  describe("series ordering and immutability", () => {
    it("sorts series keys in natural, deterministic order", () => {
      const groups: AggregatedGroup[] = [
        { name: "Row | Charlie", value: 3, metrics: createMockMetrics() },
        { name: "Row | Alpha", value: 1, metrics: createMockMetrics() },
        { name: "Row | Bravo", value: 2, metrics: createMockMetrics() },
      ];

      const pivoted = pivotByLegend(groups, "Col", "ci95");
      expect(Object.keys(pivoted[0].series)).toEqual(["Alpha", "Bravo", "Charlie"]);
      expect(Object.keys(pivoted[0].errors)).toEqual(["Alpha", "Bravo", "Charlie"]);
      expect(getSeriesKeys(pivoted)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });

    it("never mutates input groups or metrics", () => {
      const groups: AggregatedGroup[] = [
        { name: "A | 1", value: 10, metrics: createMockMetrics() },
        { name: "B | 2", value: 20, metrics: createMockMetrics() },
      ];
      const snapshot = JSON.stringify(groups);

      pivotByLegend(groups, "Num", "ci95");

      expect(JSON.stringify(groups)).toBe(snapshot);
    });
  });
});
