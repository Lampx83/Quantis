import { describe, it, expect } from "vitest";
import {
  compileFormula,
  computeVariable,
  applyRecode,
  type RecodeConfig,
} from "../dataPrep";

describe("Formula Engine: Statistical Functions", () => {
  const header = ["Q1", "Q2", "Q3", "Q4"];

  describe("MEDIAN function", () => {
    it("calculates median for odd number of items", () => {
      const { fn } = compileFormula("MEDIAN([Q1], [Q2], [Q3])", header);
      // Q1=10, Q2=30, Q3=20 -> sorted: 10, 20, 30 -> median = 20
      const res = fn(["10", "30", "20", ""]);
      expect(res).toBe(20);
    });

    it("calculates median for even number of items", () => {
      const { fn } = compileFormula("MEDIAN([Q1], [Q2], [Q3], [Q4])", header);
      // Q1=10, Q2=20, Q3=30, Q4=40 -> median = (20 + 30) / 2 = 25
      const res = fn(["10", "20", "30", "40"]);
      expect(res).toBe(25);
    });

    it("ignores empty cells or NaN in multi-argument median (MULTI_SKIP_NAN)", () => {
      const { fn } = compileFormula("MEDIAN([Q1], [Q2], [Q3])", header);
      // Q1=10, Q2="", Q3=30 -> valid: 10, 30 -> median = (10 + 30) / 2 = 20
      const res = fn(["10", "", "30", ""]);
      expect(res).toBe(20);
    });

    it("returns NaN if all arguments are empty or non-numeric", () => {
      const { fn } = compileFormula("MEDIAN([Q1], [Q2])", header);
      const res = fn(["", "invalid"]);
      expect(Number.isNaN(res)).toBe(true);
    });

    it("works with lowercase formula name: median([Q1], [Q2], [Q3])", () => {
      const { fn } = compileFormula("median([Q1], [Q2], [Q3])", header);
      expect(fn(["5", "1", "9", ""])).toBe(5);
    });
  });

  describe("SD and STD functions (Sample Standard Deviation, N-1)", () => {
    it("calculates sample standard deviation with N-1 denominator", () => {
      const { fn } = compileFormula("SD([Q1], [Q2])", header);
      // Q1=10, Q2=20 -> mean=15, diffs: -5, 5 -> diffs^2: 25, 25 -> sum=50 -> ss/(2-1) = 50 -> sqrt(50) ≈ 7.0710678
      const res = fn(["10", "20", "", ""]);
      expect(res).toBeCloseTo(Math.sqrt(50), 5);
    });

    it("STD is an alias for SD", () => {
      const { fn } = compileFormula("STD([Q1], [Q2], [Q3])", header);
      // Q1=2, Q2=4, Q3=6 -> mean=4, diffs^2: 4, 0, 4 -> sum=8 -> 8/(3-1)=4 -> sqrt(4)=2
      const res = fn(["2", "4", "6", ""]);
      expect(res).toBe(2);
    });

    it("ignores missing values in multi-argument list", () => {
      const { fn } = compileFormula("SD([Q1], [Q2], [Q3])", header);
      // Q1=10, Q2="", Q3=20 -> N=2 -> sqrt(50)
      const res = fn(["10", "", "20", ""]);
      expect(res).toBeCloseTo(Math.sqrt(50), 5);
    });

    it("returns NaN when valid sample size N < 2", () => {
      const { fn } = compileFormula("SD([Q1], [Q2], [Q3])", header);
      // Only Q1 is valid
      const res1 = fn(["10", "", ""]);
      expect(Number.isNaN(res1)).toBe(true);

      // All missing
      const res0 = fn(["", "", ""]);
      expect(Number.isNaN(res0)).toBe(true);
    });
  });

  describe("computeVariable integration", () => {
    it("adds a new column computed using MEDIAN and SD", () => {
      const rows = [
        ["ID", "Q1", "Q2", "Q3"],
        ["1", "10", "20", "30"],
        ["2", "5", "", "15"],
        ["3", "", "", ""],
      ];

      const resMedian = computeVariable(rows, "Q_MEDIAN", "MEDIAN([Q1], [Q2], [Q3])");
      expect(resMedian.error).toBeUndefined();
      expect(resMedian.rows[0]).toEqual(["ID", "Q1", "Q2", "Q3", "Q_MEDIAN"]);
      expect(resMedian.rows[1][4]).toBe("20");
      expect(resMedian.rows[2][4]).toBe("10"); // median of 5 and 15 is 10
      expect(resMedian.rows[3][4]).toBe(""); // missing

      const resSd = computeVariable(rows, "Q_SD", "SD([Q1], [Q2], [Q3])");
      expect(resSd.error).toBeUndefined();
      expect(resSd.rows[0]).toEqual(["ID", "Q1", "Q2", "Q3", "Q_SD"]);
      expect(Number(resSd.rows[1][4])).toBeCloseTo(10, 4); // SD(10, 20, 30): mean=20, ss=100+0+100=200, 200/2=100, sqrt(100)=10
      expect(Number(resSd.rows[2][4])).toBeCloseTo(Math.sqrt(50), 4); // SD(5, 15): mean=10, ss=25+25=50, 50/1=50, sqrt(50)
      expect(resSd.rows[3][4]).toBe("");
    });
  });
});

describe("applyRecode pure function", () => {
  const sampleRows = [
    ["ID", "AGE", "GENDER_CODE", "STATUS"],
    ["1", "20", "1", "Active"],
    ["2", "35", "2", "Inactive"],
    ["3", "18", "1", "Pending"],
    ["4", "65", "9", "Active"],
    ["5", "text", "", "Active"],
  ];

  it("recodes with Value rules into same variable (targetMode: 'same')", () => {
    const config: RecodeConfig = {
      sourceCol: "GENDER_CODE",
      targetMode: "same",
      rules: [
        { type: "value", from: "1", to: "Male" },
        { type: "value", from: "2", to: "Female" },
      ],
      elseRule: { enabled: true, action: "copy" },
    };

    const res = applyRecode(sampleRows, config);
    expect(res.error).toBeUndefined();
    expect(res.rows[0]).toEqual(["ID", "AGE", "GENDER_CODE", "STATUS"]);
    expect(res.rows[1][2]).toBe("Male");
    expect(res.rows[2][2]).toBe("Female");
    expect(res.rows[3][2]).toBe("Male");
    expect(res.rows[4][2]).toBe("9"); // untouched via copy
    expect(res.rows[5][2]).toBe(""); // untouched via copy
  });

  it("recodes with Range rules (inclusive) into different variable", () => {
    const config: RecodeConfig = {
      sourceCol: "AGE",
      targetMode: "different",
      targetCol: "AGE_GROUP",
      rules: [
        { type: "range", rangeMin: "18", rangeMax: "25", to: "Young Adult" },
        { type: "range", rangeMin: "26", rangeMax: "60", to: "Middle Age" },
        { type: "range", rangeMin: "61", rangeMax: "100", to: "Senior" },
      ],
      elseRule: { enabled: true, action: "custom", customValue: "Other" },
    };

    const res = applyRecode(sampleRows, config);
    expect(res.error).toBeUndefined();
    expect(res.rows[0]).toEqual(["ID", "AGE", "GENDER_CODE", "STATUS", "AGE_GROUP"]);
    expect(res.rows[1][4]).toBe("Young Adult"); // 20
    expect(res.rows[2][4]).toBe("Middle Age"); // 35
    expect(res.rows[3][4]).toBe("Young Adult"); // 18 (inclusive boundary)
    expect(res.rows[4][4]).toBe("Senior"); // 65
    expect(res.rows[5][4]).toBe("Other"); // non-numeric "text" falls to ELSE custom
    // Original column AGE is preserved completely
    expect(res.rows[1][1]).toBe("20");
    expect(res.rows[2][1]).toBe("35");
  });

  it("handles decimal numbers in Range rules inclusively", () => {
    const rows = [
      ["SCORE"],
      ["1.0"],
      ["1.5"],
      ["2.0"],
      ["2.1"],
    ];

    const config: RecodeConfig = {
      sourceCol: "SCORE",
      targetMode: "different",
      targetCol: "TIER",
      rules: [
        { type: "range", rangeMin: "1.0", rangeMax: "2.0", to: "Tier 1" },
      ],
      elseRule: { enabled: true, action: "custom", customValue: "Tier 2" },
    };

    const res = applyRecode(rows, config);
    expect(res.rows[1][1]).toBe("Tier 1"); // 1.0
    expect(res.rows[2][1]).toBe("Tier 1"); // 1.5
    expect(res.rows[3][1]).toBe("Tier 1"); // 2.0
    expect(res.rows[4][1]).toBe("Tier 2"); // 2.1
  });

  it("handles rule precedence: first matching rule wins", () => {
    const rows = [["X"], ["10"]];
    const config: RecodeConfig = {
      sourceCol: "X",
      targetMode: "same",
      rules: [
        { type: "value", from: "10", to: "Rule 1" },
        { type: "range", rangeMin: "0", rangeMax: "20", to: "Rule 2" },
      ],
      elseRule: { enabled: false, action: "copy" },
    };

    const res = applyRecode(rows, config);
    expect(res.rows[1][0]).toBe("Rule 1");
  });

  it("handles ELSE sysmis by setting unmatched values to empty string", () => {
    const config: RecodeConfig = {
      sourceCol: "STATUS",
      targetMode: "same",
      rules: [
        { type: "value", from: "Active", to: "A" },
      ],
      elseRule: { enabled: true, action: "sysmis" },
    };

    const res = applyRecode(sampleRows, config);
    expect(res.rows[1][3]).toBe("A");
    expect(res.rows[2][3]).toBe(""); // Inactive -> sysmis
    expect(res.rows[3][3]).toBe(""); // Pending -> sysmis
  });

  it("returns error if source column does not exist", () => {
    const config: RecodeConfig = {
      sourceCol: "NON_EXISTENT",
      targetMode: "same",
      rules: [{ type: "value", from: "1", to: "2" }],
      elseRule: { enabled: false, action: "copy" },
    };

    const res = applyRecode(sampleRows, config);
    expect(res.error).toBeDefined();
    expect(res.error).toContain("Chưa chọn cột nguồn");
  });

  it("returns error if targetMode is different and targetCol is empty", () => {
    const config: RecodeConfig = {
      sourceCol: "AGE",
      targetMode: "different",
      targetCol: "   ",
      rules: [{ type: "value", from: "20", to: "Twenty" }],
      elseRule: { enabled: false, action: "copy" },
    };

    const res = applyRecode(sampleRows, config);
    expect(res.error).toBeDefined();
    expect(res.error).toContain("Hãy đặt tên cho cột mới");
  });

  it("returns error if targetMode is different and targetCol already exists", () => {
    const config: RecodeConfig = {
      sourceCol: "AGE",
      targetMode: "different",
      targetCol: "STATUS",
      rules: [{ type: "value", from: "20", to: "Twenty" }],
      elseRule: { enabled: false, action: "copy" },
    };

    const res = applyRecode(sampleRows, config);
    expect(res.error).toBeDefined();
    expect(res.error).toContain("Đã có cột tên «STATUS»");
  });

  it("does not mutate original rows (immutability)", () => {
    const originalCopy = JSON.parse(JSON.stringify(sampleRows));
    const config: RecodeConfig = {
      sourceCol: "GENDER_CODE",
      targetMode: "same",
      rules: [{ type: "value", from: "1", to: "Male" }],
      elseRule: { enabled: true, action: "copy" },
    };

    applyRecode(sampleRows, config);
    expect(sampleRows).toEqual(originalCopy);
  });
});

