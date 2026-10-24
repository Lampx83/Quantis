import { describe, it, expect } from "vitest";
import {
  imputeListwise,
  imputeMeanMedianMode,
  imputePairwise,
  imputeHotDeck,
  getModeFallbackColumns,
  HOT_DECK_MAX_DONOR_CANDIDATES,
} from "../missing-imputation";
import { VariableMetadata } from "../../types";

describe("Missing Data Imputation Utilities", () => {
  const sampleVariables: Record<string, VariableMetadata> = {
    ID: {
      name: "ID",
      type: "string",
      label: "Identifier",
      measure: "nominal",
      decimals: 0,
      align: "left",
    },
    AGE: {
      name: "AGE",
      type: "numeric",
      label: "Age",
      measure: "scale",
      decimals: 1,
      align: "right",
      missingValues: ["999", "-1"],
    },
    INCOME: {
      name: "INCOME",
      type: "numeric",
      label: "Monthly Income",
      measure: "scale",
      decimals: 2,
      align: "right",
      missingValues: ["99"],
    },
    GENDER: {
      name: "GENDER",
      type: "string",
      label: "Gender",
      measure: "nominal",
      decimals: 0,
      align: "left",
      missingValues: ["9"],
    },
    SATISFACTION: {
      name: "SATISFACTION",
      type: "numeric",
      label: "Satisfaction Likert",
      measure: "ordinal",
      decimals: 0,
      align: "right",
      missingValues: ["99"],
    },
  };

  const sampleData: string[][] = [
    ["ID", "AGE", "INCOME", "GENDER", "SATISFACTION"],
    ["1", "25", "1000.00", "Nam", "4"],
    ["2", "30", "", "Nữ", "5"], // empty cell in INCOME
    ["3", "999", "1500.00", "Nam", "99"], // discrete missing 999 in AGE, 99 in SATISFACTION
    ["4", "40", "2000.00", "Nam", "4"],
    ["5", "35", "99", "9", "3"], // discrete missing 99 in INCOME, 9 in GENDER
    ["6", "28", "1200.00", "Nữ", "5"],
  ];

  describe("imputeListwise", () => {
    it("should drop rows containing empty cells in selected columns", () => {
      const result = imputeListwise(sampleData, ["INCOME"], sampleVariables);
      // Row 2 (empty INCOME) and row 5 (INCOME="99") should be removed
      expect(result.length).toBe(5); // Header + 4 valid rows
      const ids = result.slice(1).map((r) => r[0]);
      expect(ids).toEqual(["1", "3", "4", "6"]);
    });

    it("should drop rows containing user-defined discrete missing codes (99, 999, -1)", () => {
      const result = imputeListwise(sampleData, ["AGE", "INCOME"], sampleVariables);
      // Row 2: empty INCOME -> drop
      // Row 3: AGE=999 -> drop
      // Row 5: INCOME=99 -> drop
      // Valid rows: 1, 4, 6
      expect(result.length).toBe(4);
      const ids = result.slice(1).map((r) => r[0]);
      expect(ids).toEqual(["1", "4", "6"]);
    });

    it("should drop rows with NaN values", () => {
      const dataWithNaN = [
        ["X", "Y"],
        ["10", "20"],
        ["NaN", "25"],
        ["30", "NaN"],
        ["40", "50"],
      ];
      const result = imputeListwise(dataWithNaN, ["X", "Y"]);
      expect(result).toEqual([
        ["X", "Y"],
        ["10", "20"],
        ["40", "50"],
      ]);
    });

    it("should default to all columns when selectedColumns is empty", () => {
      const result = imputeListwise(sampleData, [], sampleVariables);
      // Valid across all columns: row 1, row 4, row 6
      expect(result.length).toBe(4);
      const ids = result.slice(1).map((r) => r[0]);
      expect(ids).toEqual(["1", "4", "6"]);
    });
  });

  describe("imputeMeanMedianMode", () => {
    it("should compute mean for Scale variables without distortion from missing codes (99, 999)", () => {
      // INCOME valid values:
      // Row 1: 1000
      // Row 3: 1500
      // Row 4: 2000
      // Row 6: 1200
      // Sum = 5700, N = 4, Mean = 1425.00
      const result = imputeMeanMedianMode(
        sampleData,
        ["INCOME"],
        sampleVariables,
        "mean"
      );
      // Header preserved
      expect(result[0]).toEqual(sampleData[0]);
      // Row 2 had empty cell, should now be 1425.00
      expect(result[2][2]).toBe("1425.00");
      // Row 5 had "99" (missing code), should now be replaced by 1425.00
      expect(result[5][2]).toBe("1425.00");
      // Row 1, 3, 4, 6 preserved
      expect(result[1][2]).toBe("1000.00");
      expect(result[3][2]).toBe("1500.00");
      expect(result[4][2]).toBe("2000.00");
      expect(result[6][2]).toBe("1200.00");
    });

    it("should compute median for Scale variables", () => {
      // AGE valid values:
      // Row 1: 25
      // Row 2: 30
      // Row 4: 40
      // Row 5: 35
      // Row 6: 28
      // Sorted: [25, 28, 30, 35, 40], N = 5, Median = 30.0
      const result = imputeMeanMedianMode(
        sampleData,
        ["AGE"],
        sampleVariables,
        "median"
      );
      // Row 3 had "999", should now be 30.0 (or 30)
      expect(Number(result[3][1])).toBe(30);
    });

    it("should fallback to mode for Nominal or Ordinal variables even if strategy is mean/median", () => {
      // GENDER valid values: Row 1: "Nam", Row 2: "Nữ", Row 3: "Nam", Row 4: "Nam", Row 6: "Nữ"
      // Mode is "Nam" (3 counts vs 2)
      // Row 5 has missing code "9"
      const result = imputeMeanMedianMode(
        sampleData,
        ["GENDER"],
        sampleVariables,
        "mean"
      );
      expect(result[5][3]).toBe("Nam");
    });

    it("should compute mode correctly for Ordinal Likert variables", () => {
      // SATISFACTION valid values:
      // Row 1: 4
      // Row 2: 5
      // Row 4: 4
      // Row 5: 3
      // Row 6: 5
      // Values: 4 (count 2), 5 (count 2), 3 (count 1)
      // Row 3 has missing code "99", should be filled with mode (4 or 5)
      const result = imputeMeanMedianMode(
        sampleData,
        ["SATISFACTION"],
        sampleVariables,
        "mode"
      );
      expect(["4", "5"]).toContain(result[3][4]);
    });
  });

  describe("imputePairwise", () => {
    it("should extract valid observation pairs between colA and colB without dropping for unrelated missing columns", () => {
      // Let's test between AGE and INCOME:
      // Row 1: AGE=25, INCOME=1000 (valid)
      // Row 2: AGE=30, INCOME="" (invalid because INCOME missing)
      // Row 3: AGE=999, INCOME=1500 (invalid because AGE=999 missing)
      // Row 4: AGE=40, INCOME=2000 (valid)
      // Row 5: AGE=35, INCOME=99 (invalid because INCOME=99 missing)
      // Row 6: AGE=28, INCOME=1200 (valid)
      // Notice: Row 4 and Row 1 are valid even though other rows have missing values
      const pairs = imputePairwise(sampleData, "AGE", "INCOME", sampleVariables);
      expect(pairs[0]).toEqual(["AGE", "INCOME"]);
      expect(pairs.slice(1)).toEqual([
        ["25", "1000.00"],
        ["40", "2000.00"],
        ["28", "1200.00"],
      ]);
    });

    it("should support keepAllColumns option to preserve all columns for valid pairwise rows", () => {
      const fullRows = imputePairwise(
        sampleData,
        "AGE",
        "INCOME",
        sampleVariables,
        { keepAllColumns: true }
      );
      expect(fullRows[0]).toEqual(sampleData[0]);
      const ids = fullRows.slice(1).map((r) => r[0]);
      expect(ids).toEqual(["1", "4", "6"]);
    });
  });

  describe("imputeHotDeck", () => {
    it("should find the nearest neighbor donor and borrow missing values", () => {
      // Let's create a clear nearest-neighbor scenario:
      const testData = [
        ["ID", "AGE", "EXPERIENCE", "SALARY"],
        ["A", "25", "2", "1000"],
        ["B", "26", "2", "1050"], // closest to D in AGE and EXPERIENCE
        ["C", "50", "20", "5000"],
        ["D", "25", "2", ""], // Missing SALARY, should borrow from A or B (closest)
      ];
      const vars: Record<string, VariableMetadata> = {
        AGE: { name: "AGE", label: "Age", type: "numeric", measure: "scale", decimals: 0, align: "right" },
        EXPERIENCE: { name: "EXPERIENCE", label: "Experience", type: "numeric", measure: "scale", decimals: 0, align: "right" },
        SALARY: { name: "SALARY", label: "Salary", type: "numeric", measure: "scale", decimals: 0, align: "right" },
      };

      const result = imputeHotDeck(testData, ["SALARY"], vars);
      // Recipient D should have SALARY borrowed from A ("1000") or B ("1050"), definitely not C ("5000")
      const dSalary = result[4][3];
      expect(["1000", "1050"]).toContain(dSalary);
    });

    it("should respect discrete missing codes during Hot-deck donor search and imputation", () => {
      const testData = [
        ["ID", "SCORE1", "SCORE2"],
        ["1", "10", "100"],
        ["2", "11", "99"], // SCORE2 is 99 (discrete missing) -> cannot be donor for SCORE2
        ["3", "10", ""],   // Missing SCORE2 -> should borrow from row 1, not row 2
      ];
      const vars: Record<string, VariableMetadata> = {
        SCORE1: { name: "SCORE1", label: "Score 1", type: "numeric", measure: "scale", decimals: 0, align: "right" },
        SCORE2: {
          name: "SCORE2",
          label: "Score 2",
          type: "numeric",
          measure: "scale",
          decimals: 0,
          align: "right",
          missingValues: ["99"],
        },
      };

      const result = imputeHotDeck(testData, ["SCORE2"], vars);
      expect(result[3][2]).toBe("100");
    });
  });
});


describe("imputeHotDeck: hiệu năng & tính đúng sau tối ưu", () => {
  /** Bản duyệt toàn bộ (tham chiếu) — kết quả phải giống hệt khi số người cho <= ngưỡng. */
  function bruteForceHotDeck(data: string[][], col: string): string[][] {
    const header = data[0];
    const rows = data.slice(1);
    const ci = header.indexOf(col);
    const isMiss = (v: string) => String(v ?? "").trim() === "";
    const ranges = header.map((_, c) => {
      const nums = rows.map((r) => r[c]).filter((v) => !isMiss(v) && !Number.isNaN(Number(v))).map(Number);
      if (nums.length < 2) return 1;
      let mn = Infinity, mx = -Infinity;
      for (const n of nums) { if (n < mn) mn = n; if (n > mx) mx = n; }
      return mx > mn ? mx - mn : 1;
    });
    const out = data.map((r) => [...r]);
    rows.forEach((rec, i) => {
      if (!isMiss(rec[ci])) return;
      let best = -1, bestD = Infinity;
      rows.forEach((don, j) => {
        if (isMiss(don[ci]) || j === i) return;
        let ss = 0, cnt = 0;
        for (let c = 0; c < header.length; c++) {
          if (c === ci || isMiss(rec[c]) || isMiss(don[c])) continue;
          cnt++;
          const a = Number(rec[c]), b = Number(don[c]);
          if (!Number.isNaN(a) && !Number.isNaN(b)) ss += ((a - b) / ranges[c]) ** 2;
          else if (Number.isNaN(a)) ss += rec[c] === don[c] ? 0 : 1;
        }
        const d = cnt > 0 ? Math.sqrt(ss / cnt) : Infinity;
        if (d < bestD) { bestD = d; best = j; }
      });
      if (best !== -1) out[i + 1][ci] = rows[best][ci];
    });
    return out;
  }

  function synth(n: number, missEvery: number): string[][] {
    let seed = 12345;
    const rnd = () => ((seed = (seed * 1664525 + 1013904223) % 4294967296) / 4294967296);
    const rows: string[][] = [["age", "income", "grp", "q1"]];
    for (let i = 0; i < n; i++) {
      const age = 18 + Math.floor(rnd() * 50);
      rows.push([String(age), (age * 100 + Math.floor(rnd() * 500)).toFixed(0), rnd() < 0.5 ? "A" : "B",
        i % missEvery === 0 ? "" : String(1 + Math.floor(rnd() * 5))]);
    }
    return rows;
  }

  it("giống hệt bản duyệt toàn bộ khi số người cho <= ngưỡng", () => {
    const data = synth(400, 9);
    expect(imputeHotDeck(data, ["q1"])).toEqual(bruteForceHotDeck(data, "q1"));
  });

  it("20.000 dòng, 1 cột khuyết (~10%) xong trong vài giây (trước tối ưu: ~17 giây)", () => {
    const data = synth(20_000, 10);
    const t0 = performance.now();
    const out = imputeHotDeck(data, ["q1"]);
    const ms = performance.now() - t0;
    expect(out.slice(1).every((r) => r[3] !== "")).toBe(true);
    expect(ms).toBeLessThan(5000);
    // giá trị điền luôn là giá trị có thật trong thang 1–5
    expect(new Set(out.slice(1).map((r) => r[3]))).toEqual(new Set(["1", "2", "3", "4", "5"]));
    expect(HOT_DECK_MAX_DONOR_CANDIDATES).toBeGreaterThan(0);
  });

  it("150.000 dòng không tràn ngăn xếp (Math.min(...nums))", () => {
    const n = 150_000;
    const data: string[][] = [["x", "y"]];
    for (let i = 0; i < n; i++) data.push([String(i % 977), i % 5000 === 0 ? "" : String(i % 13)]);
    expect(() => imputeHotDeck(data, ["y"])).not.toThrow();
  });
});

describe("getModeFallbackColumns: điền mean/median lên cột không phải scale phải được báo", () => {
  const data = [
    ["likert", "age", "gender"],
    ["1", "20", "a"], ["2", "30", "b"], ["", "40", "a"], ["4", "", "b"],
  ];
  const vars: Record<string, VariableMetadata> = {
    likert: { name: "likert", type: "numeric", label: "l", measure: "ordinal", decimals: 0, align: "right" },
    age: { name: "age", type: "numeric", label: "a", measure: "scale", decimals: 0, align: "right" },
    gender: { name: "gender", type: "string", label: "g", measure: "nominal", decimals: 0, align: "left" },
  };

  it("liệt kê cột ordinal/nominal sẽ bị đổi sang mốt", () => {
    expect(getModeFallbackColumns(data, ["likert", "age", "gender"], vars, "mean")).toEqual(["likert", "gender"]);
    expect(getModeFallbackColumns(data, ["age"], vars, "median")).toEqual([]);
    expect(getModeFallbackColumns(data, ["likert"], vars, "mode")).toEqual([]);
  });

  it("khớp với hành vi thực của imputeMeanMedianMode (mốt, không phải trung bình)", () => {
    const out = imputeMeanMedianMode(data, ["likert"], vars, "mean");
    // mean(1,2,4)=2.33 sẽ là giá trị không có trên thang; thực tế điền mốt (giá trị có thật)
    expect(["1", "2", "4"]).toContain(out[3][0]);
  });
});
