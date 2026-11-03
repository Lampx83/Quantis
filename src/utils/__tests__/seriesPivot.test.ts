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

/** Nhóm như `aggregateData` trả về: `name` để hiển thị, `parts` để pivot. */
function createGroup(parts: string[], value: number, metrics: AggregateMetrics = createMockMetrics()): AggregatedGroup {
  return { name: parts.join(" | "), parts, value, metrics };
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
      const groups: AggregatedGroup[] = [createGroup(["Dept A", "M"], 10)];
      expect(pivotByLegend(groups, "", "ci95")).toEqual([]);
      expect(pivotByLegend(groups, "   ", "ci95")).toEqual([]);
    });

    it("returns empty array when groups have fewer than two parts (no X + Legend split)", () => {
      const groups: AggregatedGroup[] = [createGroup(["Dept A"], 10), createGroup(["Dept B"], 20)];
      expect(pivotByLegend(groups, "Gender", "ci95")).toEqual([]);
    });
  });

  describe("long to wide pivot", () => {
    it("pivots single legend column into wide format preserving values and emitting one row per X", () => {
      const groups: AggregatedGroup[] = [
        createGroup(["Dept A", "Female"], 12, createMockMetrics({ mean: 12 })),
        createGroup(["Dept A", "Male"], 18, createMockMetrics({ mean: 18 })),
        createGroup(["Dept B", "Female"], 15, createMockMetrics({ mean: 15 })),
        createGroup(["Dept B", "Male"], 20, createMockMetrics({ mean: 20 })),
      ];

      const pivoted = pivotByLegend(groups, "Gender", "ci95");

      expect(pivoted).toHaveLength(2);
      expect(pivoted[0].name).toBe("Dept A");
      expect(pivoted[0].series).toEqual({ Female: 12, Male: 18 });
      expect(pivoted[1].name).toBe("Dept B");
      expect(pivoted[1].series).toEqual({ Female: 15, Male: 20 });
    });

    it("keeps X and legend values intact when a value itself contains the ' | ' separator", () => {
      const groups: AggregatedGroup[] = [
        createGroup(["Dept A", "High | Low"], 7),
        createGroup(["Dept A", "Low"], 3),
      ];

      const pivoted = pivotByLegend(groups, "Rating", "ci95");

      expect(pivoted).toHaveLength(1);
      expect(pivoted[0].name).toBe("Dept A");
      expect(pivoted[0].series).toEqual({ "High | Low": 7, Low: 3 });
    });

    it("handles uneven series across different X categories", () => {
      const groups: AggregatedGroup[] = [
        createGroup(["Dept A", "Full-time"], 40),
        createGroup(["Dept A", "Part-time"], 20),
        createGroup(["Dept B", "Full-time"], 35),
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
        createGroup(["Group 1", "Alpha"], 15, createMockMetrics({ mean: 15, ci95Lower: 10, ci95Upper: 20 })),
      ];

      const pivoted = pivotByLegend(groups, "Type", "ci95");
      expect(pivoted[0].errors.Alpha).toEqual([5, 5]);
    });

    it("calculates se offsets as [se, se]", () => {
      const groups: AggregatedGroup[] = [
        createGroup(["Group 1", "Alpha"], 15, createMockMetrics({ se: 2.5 })),
      ];

      const pivoted = pivotByLegend(groups, "Type", "se");
      expect(pivoted[0].errors.Alpha).toEqual([2.5, 2.5]);
    });

    it("calculates sd offsets as [std, std]", () => {
      const groups: AggregatedGroup[] = [
        createGroup(["Group 1", "Alpha"], 15, createMockMetrics({ std: 5.2 })),
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

      const groups: AggregatedGroup[] = [createGroup(["Group 1", "Alpha"], 10, n1Metrics)];

      expect(pivotByLegend(groups, "Type", "ci95")[0].errors.Alpha).toEqual([0, 0]);
      expect(pivotByLegend(groups, "Type", "se")[0].errors.Alpha).toEqual([0, 0]);
      expect(pivotByLegend(groups, "Type", "sd")[0].errors.Alpha).toEqual([0, 0]);
    });
  });

  describe("series ordering and immutability", () => {
    it("sorts series keys in natural, deterministic order", () => {
      const groups: AggregatedGroup[] = [
        createGroup(["Row", "Charlie"], 3),
        createGroup(["Row", "Alpha"], 1),
        createGroup(["Row", "Bravo"], 2),
      ];

      const pivoted = pivotByLegend(groups, "Col", "ci95");
      expect(Object.keys(pivoted[0].series)).toEqual(["Alpha", "Bravo", "Charlie"]);
      expect(Object.keys(pivoted[0].errors)).toEqual(["Alpha", "Bravo", "Charlie"]);
      expect(getSeriesKeys(pivoted)).toEqual(["Alpha", "Bravo", "Charlie"]);
    });

    it("never mutates input groups or metrics", () => {
      const groups: AggregatedGroup[] = [createGroup(["A", "1"], 10), createGroup(["B", "2"], 20)];
      const snapshot = JSON.stringify(groups);

      pivotByLegend(groups, "Num", "ci95");

      expect(JSON.stringify(groups)).toBe(snapshot);
    });
  });
});
