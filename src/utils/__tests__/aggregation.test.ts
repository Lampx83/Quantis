import { describe, it, expect } from "vitest";
import { aggregateData, countByCategory, sortChartCategories } from "../aggregation";

describe("Aggregation Engine (src/utils/aggregation.ts)", () => {
  const sampleRows: string[][] = [
    ["Department", "Score"],
    ["Sales", "10"],
    ["Sales", "20"],
    ["Marketing", "30"],
    ["Marketing", "40"],
    ["Marketing", "50"],
  ];

  it("computes Mean correctly for simple groups", () => {
    const result = aggregateData(sampleRows, {
      groupByCols: ["Department"],
      measureCol: "Score",
      func: "mean",
    });

    expect(result).toHaveLength(2);
    // Alphabetical order: Marketing, Sales
    expect(result[0].name).toBe("Marketing");
    expect(result[0].value).toBe(40);
    expect(result[0].metrics.mean).toBe(40);

    expect(result[1].name).toBe("Sales");
    expect(result[1].value).toBe(15);
    expect(result[1].metrics.mean).toBe(15);
  });

  it("computes Sum, Count, Median, Min, and Max for groups", () => {
    const sumRes = aggregateData(sampleRows, {
      groupByCols: ["Department"],
      measureCol: "Score",
      func: "sum",
    });
    expect(sumRes[0].value).toBe(120); // Marketing: 30+40+50
    expect(sumRes[1].value).toBe(30);  // Sales: 10+20

    const countRes = aggregateData(sampleRows, {
      groupByCols: ["Department"],
      measureCol: "Score",
      func: "count",
    });
    expect(countRes[0].value).toBe(3);
    expect(countRes[1].value).toBe(2);

    const medianRes = aggregateData(sampleRows, {
      groupByCols: ["Department"],
      measureCol: "Score",
      func: "median",
    });
    expect(medianRes[0].value).toBe(40); // 30, 40, 50 -> 40
    expect(medianRes[1].value).toBe(15); // 10, 20 -> 15 (linear interpolation)

    const minRes = aggregateData(sampleRows, {
      groupByCols: ["Department"],
      measureCol: "Score",
      func: "min",
    });
    expect(minRes[0].value).toBe(30);
    expect(minRes[1].value).toBe(10);

    const maxRes = aggregateData(sampleRows, {
      groupByCols: ["Department"],
      measureCol: "Score",
      func: "max",
    });
    expect(maxRes[0].value).toBe(50);
    expect(maxRes[1].value).toBe(20);
  });

  it("computes sample Standard Deviation using Bessel's correction (n - 1)", () => {
    // Sales: [10, 20] -> mean = 15, ss = (10-15)^2 + (20-15)^2 = 50 -> std = sqrt(50 / 1) = sqrt(50)
    const result = aggregateData(sampleRows, {
      groupByCols: ["Department"],
      measureCol: "Score",
      func: "std",
    });

    const sales = result.find((g) => g.name === "Sales");
    expect(sales).toBeDefined();
    expect(sales!.metrics.std).toBeCloseTo(Math.sqrt(50), 6);
    expect(sales!.value).toBeCloseTo(Math.sqrt(50), 6);

    // Marketing: [30, 40, 50] -> mean = 40, ss = 100 + 0 + 100 = 200 -> std = sqrt(200 / 2) = 10
    const marketing = result.find((g) => g.name === "Marketing");
    expect(marketing).toBeDefined();
    expect(marketing!.metrics.std).toBeCloseTo(10, 6);
    expect(marketing!.value).toBeCloseTo(10, 6);
  });

  it("computes Standard Error (SE) and 95% Confidence Interval (CI)", () => {
    // Sales: [10, 20] -> std = sqrt(50), n = 2 -> SE = sqrt(50) / sqrt(2) = 5
    // 95% CI = mean +- 1.96 * SE = 15 +- 9.8 = [5.2, 24.8]
    const result = aggregateData(sampleRows, {
      groupByCols: ["Department"],
      measureCol: "Score",
      func: "mean",
    });

    const sales = result.find((g) => g.name === "Sales");
    expect(sales).toBeDefined();
    expect(sales!.metrics.se).toBeCloseTo(5, 6);
    expect(sales!.metrics.ci95Lower).toBeCloseTo(5.2, 6);
    expect(sales!.metrics.ci95Upper).toBeCloseTo(24.8, 6);
  });

  it("skips empty cells and NaN values and reflects valid count only", () => {
    const dirtyRows: string[][] = [
      ["Group", "Value"],
      ["A", "10"],
      ["A", ""],
      ["A", "   "],
      ["A", "not-a-number"],
      ["A", "20"],
      ["", "99"], // empty group key skipped when skipEmpty is true (default)
      ["  ", "100"],
    ];

    const result = aggregateData(dirtyRows, {
      groupByCols: ["Group"],
      measureCol: "Value",
      func: "mean",
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("A");
    expect(result[0].metrics.count).toBe(2);
    expect(result[0].metrics.mean).toBe(15);
  });

  it("handles group with n = 1: std=0, se=0, CI collapses to mean", () => {
    const singleItemRows: string[][] = [
      ["Group", "Value"],
      ["Solo", "42"],
    ];

    const result = aggregateData(singleItemRows, {
      groupByCols: ["Group"],
      measureCol: "Value",
      func: "std",
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Solo");
    expect(result[0].metrics.count).toBe(1);
    expect(result[0].metrics.mean).toBe(42);
    expect(result[0].metrics.std).toBe(0);
    expect(result[0].metrics.se).toBe(0);
    expect(result[0].metrics.ci95Lower).toBe(42);
    expect(result[0].metrics.ci95Upper).toBe(42);
    expect(result[0].value).toBe(0);
  });

  it("excludes group with n = 0 (all values NaN or empty)", () => {
    const ghostRows: string[][] = [
      ["Group", "Value"],
      ["Real", "100"],
      ["Ghost", ""],
      ["Ghost", "NaN"],
      ["Ghost", "invalid"],
    ];

    const result = aggregateData(ghostRows, {
      groupByCols: ["Group"],
      measureCol: "Value",
      func: "mean",
    });

    expect(result).toHaveLength(1);
    expect(result[0].name).toBe("Real");
  });

  it("supports multi-dimensional grouping (2 or more columns)", () => {
    const multiDimRows: string[][] = [
      ["Department", "Region", "Sales"],
      ["IT", "North", "100"],
      ["IT", "North", "150"],
      ["IT", "South", "200"],
      ["HR", "North", "50"],
    ];

    const result = aggregateData(multiDimRows, {
      groupByCols: ["Department", "Region"],
      measureCol: "Sales",
      func: "sum",
    });

    expect(result).toHaveLength(3);
    expect(result.map((g) => g.name)).toEqual([
      "HR | North",
      "IT | North",
      "IT | South",
    ]);

    const itNorth = result.find((g) => g.name === "IT | North");
    expect(itNorth?.value).toBe(250);
    // `parts` keeps the labels separate so a value containing " | " cannot corrupt the pivot
    expect(itNorth?.parts).toEqual(["IT", "North"]);
  });

  it("truncates output according to limit option (default 30)", () => {
    const rows: string[][] = [["Category", "Val"]];
    for (let i = 0; i < 50; i++) {
      rows.push([`Cat_${String(i).padStart(2, "0")}`, "10"]);
    }

    const defaultLimitResult = aggregateData(rows, {
      groupByCols: ["Category"],
      measureCol: "Val",
      func: "count",
    });
    expect(defaultLimitResult).toHaveLength(30);

    const customLimitResult = aggregateData(rows, {
      groupByCols: ["Category"],
      measureCol: "Val",
      func: "count",
      limit: 5,
    });
    expect(customLimitResult).toHaveLength(5);
  });

  it("returns empty array for empty or header-only data", () => {
    expect(
      aggregateData([], {
        groupByCols: ["A"],
        measureCol: "B",
        func: "mean",
      })
    ).toEqual([]);

    expect(
      aggregateData([["A", "B"]], {
        groupByCols: ["A"],
        measureCol: "B",
        func: "mean",
      })
    ).toEqual([]);
  });

  it("returns empty array when measureCol or groupByCols are missing from header", () => {
    expect(
      aggregateData(sampleRows, {
        groupByCols: ["NonExistent"],
        measureCol: "Score",
        func: "mean",
      })
    ).toEqual([]);

    expect(
      aggregateData(sampleRows, {
        groupByCols: ["Department"],
        measureCol: "NonExistent",
        func: "mean",
      })
    ).toEqual([]);

    expect(
      aggregateData(sampleRows, {
        groupByCols: [],
        measureCol: "Score",
        func: "mean",
      })
    ).toEqual([]);
  });

  it("respects exact case sensitivity in column headers", () => {
    expect(
      aggregateData(sampleRows, {
        groupByCols: ["department"], // lowercase should not match "Department"
        measureCol: "Score",
        func: "mean",
      })
    ).toEqual([]);

    expect(
      aggregateData(sampleRows, {
        groupByCols: ["Department"],
        measureCol: "score", // lowercase should not match "Score"
        func: "mean",
      })
    ).toEqual([]);
  });

  it("does not mutate the input rows array or nested arrays", () => {
    const original = [
      ["Department", "Score"],
      ["Sales", "10"],
      ["Marketing", "20"],
    ];
    const deepClone = original.map((r) => [...r]);

    aggregateData(original, {
      groupByCols: ["Department"],
      measureCol: "Score",
      func: "mean",
    });

    expect(original).toEqual(deepClone);
  });
  describe("Sorting behavior (sortOrder)", () => {
    const numericIdRows = [
      ["id", "val"],
      ["1", "10"],
      ["10", "20"],
      ["2", "30"],
      ["20", "40"],
      ["3", "50"],
    ];

    it("applies natural alphanumeric sort by default (1, 2, 3, 10, 20)", () => {
      const res = aggregateData(numericIdRows, {
        groupByCols: ["id"],
        measureCol: "val",
        func: "mean",
      });
      const names = res.map((r) => r.name);
      expect(names).toEqual(["1", "2", "3", "10", "20"]);
    });

    it("supports category-desc sortOrder (20, 10, 3, 2, 1)", () => {
      const res = aggregateData(numericIdRows, {
        groupByCols: ["id"],
        measureCol: "val",
        func: "mean",
        sortOrder: "category-desc",
      });
      const names = res.map((r) => r.name);
      expect(names).toEqual(["20", "10", "3", "2", "1"]);
    });

    it("supports value-asc sortOrder", () => {
      const res = aggregateData(numericIdRows, {
        groupByCols: ["id"],
        measureCol: "val",
        func: "mean",
        sortOrder: "value-asc",
      });
      const values = res.map((r) => r.value);
      expect(values).toEqual([10, 20, 30, 40, 50]);
    });

    it("supports value-desc sortOrder", () => {
      const res = aggregateData(numericIdRows, {
        groupByCols: ["id"],
        measureCol: "val",
        func: "mean",
        sortOrder: "value-desc",
      });
      const values = res.map((r) => r.value);
      expect(values).toEqual([50, 40, 30, 20, 10]);
    });

    it("supports none (preserves insertion order)", () => {
      const res = aggregateData(numericIdRows, {
        groupByCols: ["id"],
        measureCol: "val",
        func: "mean",
        sortOrder: "none",
      });
      const names = res.map((r) => r.name);
      expect(names).toEqual(["1", "10", "2", "20", "3"]);
    });
  });
});

describe("Shared category helpers", () => {
  it("countByCategory trims and skips blanks only when asked", () => {
    const rows = [["g"], [" A"], ["A"], [""], ["  "], ["B"]];
    expect(countByCategory(rows, 0)).toEqual([
      { name: " A", count: 1 },
      { name: "A", count: 1 },
      { name: "", count: 1 },
      { name: "  ", count: 1 },
      { name: "B", count: 1 },
    ]);
    expect(countByCategory(rows, 0, { trim: true, skipEmpty: true })).toEqual([
      { name: "A", count: 2 },
      { name: "B", count: 1 },
    ]);
  });

  it("sortChartCategories sorts by label or value and leaves 'none' untouched", () => {
    const items = [
      { name: "10", value: 1 },
      { name: "2", value: 3 },
      { name: "1", value: 2 },
    ];
    const name = (i: { name: string }) => i.name;
    const value = (i: { value: number }) => i.value;
    expect(sortChartCategories(items, name, value, "category-asc").map(name)).toEqual(["1", "2", "10"]);
    expect(sortChartCategories(items, name, value, "category-desc").map(name)).toEqual(["10", "2", "1"]);
    expect(sortChartCategories(items, name, value, "value-asc").map(value)).toEqual([1, 2, 3]);
    expect(sortChartCategories(items, name, value, "value-desc").map(value)).toEqual([3, 2, 1]);
    expect(sortChartCategories(items, name, value, "none")).toBe(items);
  });
});