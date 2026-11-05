import { describe, it, expect } from "vitest";
import type { ReliabilityItemDiagnostic, ReliabilityStatistics } from "@/types";
import {
  RELIABILITY_THRESHOLDS,
  buildScaleSample,
  computeAlpha,
  computeFeldtCi,
  computeItemDiagnostics,
  computeInterItemMatrix,
  computeMeanInterItemR,
  computeReliability,
  computeStandardizedAlpha,
  itemVerdict,
  scaleVerdict,
} from "../reliability";

/*
 * Golden fixture (spec R11). Expectations below are NOT produced by the code
 * under test: they come from dev-docs/golden/reliability_reference.py, an
 * independent pandas/scipy implementation, run on 2026-11-05:
 *
 *   n = 12, k = 5, Q3 reverse-keyed (reflection constant 6)
 *   alpha               = 0.793043907252
 *   alphaStandardized   = 0.841717477370
 *   meanInterItemR      = 0.515401364689
 *   feldtCI             = [0.523685594649, 0.910078671054]   (T2)
 *   item Q1: mean=3.916666666667 sd=0.996204919896 citc=0.937279131140 alphaIfDeleted=0.634593356243
 *   item Q2: mean=3.833333333333 sd=0.937436866561 citc=0.594804690767 alphaIfDeleted=0.749357626723
 *   item Q3: mean=3.750000000000 sd=1.055289706022 citc=0.657801750231 alphaIfDeleted=0.725971370143
 *   item Q4: mean=4.000000000000 sd=0.852802865422 citc=0.923200573288 alphaIfDeleted=0.663029358275
 *   item Q5: mean=2.916666666667 sd=1.378954368902 citc=0.102743928708 alphaIfDeleted=0.935928629359
 *   corr matrix:
 *     [[1, .6651953581, .756649908458, .963058106259, .391548748475],
 *      [.6651953581, 1, .964901281354, .682288239221, -.222698730464],
 *      [.756649908458, .964901281354, 1, .707106781187, -.140562099722],
 *      [.963058106259, .682288239221, .707106781187, 1, .386526054023],
 *      [.391548748475, -.222698730464, -.140562099722, .386526054023, 1]]
 *
 * Without the Q3 reflection the reference reports alpha = 0.191428571429 and
 * CITC(Q3) = -0.657801750231 — the "suspect reverse item" state.
 */

const ITEMS = ["Q1", "Q2", "Q3", "Q4", "Q5"];

/** 12 x 5 Likert 1–5. Q3 is written reverse-keyed; Q5 is the weak item. */
const RAW: number[][] = [
  [5, 4, 2, 5, 3],
  [4, 5, 1, 4, 2],
  [5, 4, 2, 5, 5],
  [3, 3, 3, 3, 2],
  [4, 4, 2, 4, 4],
  [2, 3, 4, 3, 2],
  [5, 5, 1, 5, 3],
  [3, 2, 4, 3, 4],
  [4, 4, 2, 4, 1],
  [3, 3, 3, 3, 3],
  [5, 4, 2, 5, 5],
  [4, 5, 1, 4, 1],
];

const ROWS: string[][] = [
  [...ITEMS],
  ...RAW.map((row) => row.map((v) => String(v))),
];

const REVERSE = { Q3: true };
const REFLECTION = { Q3: 6 };

const goldenSample = () => buildScaleSample(ROWS, ITEMS, REVERSE, REFLECTION);

describe("buildScaleSample", () => {
  it("keeps only rows complete on every item and reports the input size", () => {
    const rows = [
      ["A", "B"],
      ["1", "2"],
      ["3", ""],
      ["4", " 5 "],
      ["x", "6"],
      ["7", "8"],
    ];
    const sample = buildScaleSample(rows, ["A", "B"]);

    expect(sample.nInput).toBe(5);
    expect(sample.data).toEqual([
      [1, 2],
      [4, 5],
      [7, 8],
    ]);
    // Indexes point into `rows`, so the header keeps index 0.
    expect(sample.sourceRowIndexes).toEqual([1, 3, 5]);
  });

  it("never treats a blank or non-numeric cell as zero", () => {
    const rows = [
      ["A", "B"],
      ["0", "0"],
      ["", "0"],
      ["0", "abc"],
    ];
    const sample = buildScaleSample(rows, ["A", "B"]);
    expect(sample.data).toEqual([[0, 0]]);
    expect(sample.nInput).toBe(3);
  });

  it("applies the reflection constant to reverse-keyed items only", () => {
    const sample = goldenSample();
    expect(sample.nInput).toBe(12);
    expect(sample.sourceRowIndexes).toHaveLength(12);
    // Row 1 writes Q3 = 2, so the reflected value is 6 - 2 = 4.
    expect(sample.data[0]).toEqual([5, 4, 4, 5, 3]);
    // Q1 is untouched.
    expect(sample.data[0][0]).toBe(5);
  });

  it("leaves the data untouched when no item is reversed", () => {
    const sample = buildScaleSample(ROWS, ITEMS);
    expect(sample.data[0]).toEqual(RAW[0]);
  });
});

describe("computeAlpha", () => {
  it("reproduces the golden alpha from the sample (ddof = 1)", () => {
    expect(computeAlpha(goldenSample().data)).toBeCloseTo(0.793043907252, 9);
  });

  it("returns null when an item has zero variance", () => {
    const data = [
      [1, 2, 4],
      [2, 2, 5],
      [3, 2, 4],
      [4, 2, 5],
    ];
    expect(computeAlpha(data)).toBeNull();
  });

  it("returns null for fewer than two items or fewer than two rows", () => {
    expect(computeAlpha([[1], [2], [3]])).toBeNull();
    expect(computeAlpha([[1, 2]])).toBeNull();
  });
});

describe("computeStandardizedAlpha", () => {
  it("reproduces the golden standardized alpha", () => {
    expect(computeStandardizedAlpha(goldenSample().data)).toBeCloseTo(0.84171747737, 9);
  });
});

describe("computeItemDiagnostics", () => {
  it("reproduces every golden item statistic", () => {
    const sample = goldenSample();
    const diagnostics = computeItemDiagnostics(ROWS, ITEMS, sample);

    expect(diagnostics.map((d) => d.name)).toEqual(ITEMS);
    expect(diagnostics[0].mean).toBeCloseTo(3.916666666667, 9);
    expect(diagnostics[0].sd).toBeCloseTo(0.996204919896, 9);
    expect(diagnostics[0].correctedItemTotal).toBeCloseTo(0.93727913114, 9);
    expect(diagnostics[0].alphaIfDeleted).toBeCloseTo(0.634593356243, 9);

    expect(diagnostics[2].mean).toBeCloseTo(3.75, 9);
    expect(diagnostics[2].sd).toBeCloseTo(1.055289706022, 9);
    expect(diagnostics[2].correctedItemTotal).toBeCloseTo(0.657801750231, 9);
    expect(diagnostics[2].alphaIfDeleted).toBeCloseTo(0.725971370143, 9);

    expect(diagnostics[4].correctedItemTotal).toBeCloseTo(0.102743928708, 9);
    expect(diagnostics[4].alphaIfDeleted).toBeCloseTo(0.935928629359, 9);
  });

  it("counts missing cells on the input sample, not the listwise sample", () => {
    const rows = [
      ["A", "B"],
      ["1", "2"],
      ["", "3"],
      ["4", "5"],
      ["6", "7"],
    ];
    const sample = buildScaleSample(rows, ["A", "B"]);
    const diagnostics = computeItemDiagnostics(rows, ["A", "B"], sample);

    expect(diagnostics[0].missingInInput).toBe(1);
    expect(diagnostics[1].missingInInput).toBe(0);
    // The statistics themselves use the 3 complete rows.
    expect(diagnostics[0].mean).toBeCloseTo(11 / 3, 9);
  });

  it("reports a null alpha-if-deleted when only two items are kept", () => {
    const rows = [
      ["A", "B"],
      ["1", "2"],
      ["2", "3"],
      ["3", "5"],
      ["4", "4"],
    ];
    const sample = buildScaleSample(rows, ["A", "B"]);
    const diagnostics = computeItemDiagnostics(rows, ["A", "B"], sample);

    expect(diagnostics).toHaveLength(2);
    expect(diagnostics.every((d) => d.alphaIfDeleted === null)).toBe(true);
    expect(diagnostics[0].correctedItemTotal).not.toBeNull();
  });

  it("reports SD = 0 and no item-total correlation for a constant item", () => {
    const rows = [
      ["A", "B"],
      ["1", "4"],
      ["2", "4"],
      ["3", "4"],
      ["5", "4"],
    ];
    const sample = buildScaleSample(rows, ["A", "B"]);
    const diagnostics = computeItemDiagnostics(rows, ["A", "B"], sample);

    expect(diagnostics[1].sd).toBe(0);
    expect(diagnostics[1].correctedItemTotal).toBeNull();
  });
});

describe("computeInterItemMatrix", () => {
  it("is symmetric, has a unit diagonal and the golden off-diagonals", () => {
    const matrix = computeInterItemMatrix(goldenSample().data);
    expect(matrix).toHaveLength(5);
    for (let i = 0; i < 5; i++) {
      expect(matrix[i][i]).toBeCloseTo(1, 12);
      for (let j = 0; j < 5; j++) {
        expect(matrix[i][j]).toBeCloseTo(matrix[j][i], 12);
      }
    }
    expect(matrix[0][1]).toBeCloseTo(0.6651953581, 9);
    expect(matrix[1][4]).toBeCloseTo(-0.222698730464, 9);
    expect(matrix[0][3]).toBeCloseTo(0.963058106259, 9);
  });
});

describe("computeMeanInterItemR", () => {
  it("averages the off-diagonal correlations of the golden sample", () => {
    expect(computeMeanInterItemR(goldenSample().data)).toBeCloseTo(0.515401364689, 9);
  });

  it("skips pairs whose correlation is undefined", () => {
    const data = [
      [1, 4, 2],
      [2, 4, 3],
      [3, 4, 5],
      [4, 4, 4],
    ];
    // The constant middle item makes every pair with it undefined; the
    // remaining pair (1,3) is still averaged.
    expect(computeMeanInterItemR(data)).toBeCloseTo(0.8, 9);
  });
});

// ---------------------------------------------------------------------------
// Thresholds, Verdicts and the Feldt interval (spec R3, §6)
// ---------------------------------------------------------------------------

const statsOf = (overrides: Partial<ReliabilityStatistics> = {}): ReliabilityStatistics => ({
  alpha: 0.84,
  alphaStandardized: 0.85,
  ci: { lower: 0.7, upper: 0.9 },
  k: 5,
  nScaleSample: 100,
  nInput: 100,
  meanInterItemR: 0.5,
  ...overrides,
});

const itemOf = (overrides: Partial<ReliabilityItemDiagnostic> = {}): ReliabilityItemDiagnostic => ({
  name: "Q1",
  reverse: false,
  reflectionConstant: null,
  mean: 3,
  sd: 1,
  missingInInput: 0,
  correctedItemTotal: 0.5,
  alphaIfDeleted: 0.8,
  verdict: "pass",
  reasonKey: "",
  reasonParams: {},
  ...overrides,
});

describe("RELIABILITY_THRESHOLDS", () => {
  it("holds the spec's numbers in one place", () => {
    expect(RELIABILITY_THRESHOLDS.alpha.acceptable).toBe(0.7);
    expect(RELIABILITY_THRESHOLDS.alpha.good).toBe(0.8);
    expect(RELIABILITY_THRESHOLDS.alpha.redundancy).toBe(0.95);
    expect(RELIABILITY_THRESHOLDS.itemTotal.low).toBe(0.3);
    expect(RELIABILITY_THRESHOLDS.smallSampleN).toBe(30);
    expect(RELIABILITY_THRESHOLDS.minItems).toBe(3);
  });
});

describe("scaleVerdict", () => {
  it("flags α ≥ .95 as caution — suspected item redundancy", () => {
    const result = scaleVerdict(statsOf({ alpha: 0.96 }));
    expect(result.verdict).toBe("caution");
    expect(result.reasonKey).toBe("reliabilityVerdict.scale.caution.redundancy");
    expect(result.reasonParams).toMatchObject({ alpha: 0.96, threshold: 0.95 });
  });

  it("treats the .95 boundary as redundancy", () => {
    expect(scaleVerdict(statsOf({ alpha: 0.95 })).verdict).toBe("caution");
  });

  it("passes α in [.80, .95)", () => {
    const result = scaleVerdict(statsOf({ alpha: 0.8 }));
    expect(result.verdict).toBe("pass");
    expect(result.reasonKey).toBe("reliabilityVerdict.scale.pass.good");
    expect(result.reasonParams).toMatchObject({ alpha: 0.8, threshold: 0.8 });
    expect(scaleVerdict(statsOf({ alpha: 0.949 })).verdict).toBe("pass");
  });

  it("cautions α in [.70, .80)", () => {
    const result = scaleVerdict(statsOf({ alpha: 0.7 }));
    expect(result.verdict).toBe("caution");
    expect(result.reasonKey).toBe("reliabilityVerdict.scale.caution.acceptable");
    expect(result.reasonParams).toMatchObject({ alpha: 0.7, threshold: 0.7 });
    expect(scaleVerdict(statsOf({ alpha: 0.799 })).verdict).toBe("caution");
  });

  it("violates α below .70", () => {
    const result = scaleVerdict(statsOf({ alpha: 0.699 }));
    expect(result.verdict).toBe("violation");
    expect(result.reasonKey).toBe("reliabilityVerdict.scale.violation.low");
    expect(result.reasonParams).toMatchObject({ alpha: 0.699, threshold: 0.7 });
  });

  it("cautions a two-item scale even when α looks fine", () => {
    const result = scaleVerdict(statsOf({ alpha: 0.85, k: 2 }));
    expect(result.verdict).toBe("caution");
    expect(result.reasonKey).toBe("reliabilityVerdict.scale.caution.twoItems");
    expect(result.reasonParams).toMatchObject({ k: 2, minItems: 3 });
  });

  it("cautions a small sample even when α looks fine", () => {
    const result = scaleVerdict(statsOf({ alpha: 0.85, nScaleSample: 29 }));
    expect(result.verdict).toBe("caution");
    expect(result.reasonKey).toBe("reliabilityVerdict.scale.caution.smallSample");
    expect(result.reasonParams).toMatchObject({ n: 29, threshold: 30 });
    // 30 is enough: the rule is n < 30.
    expect(scaleVerdict(statsOf({ alpha: 0.85, nScaleSample: 30 })).verdict).toBe("pass");
  });

  it("keeps a violation a violation when the sample is also small", () => {
    const result = scaleVerdict(statsOf({ alpha: 0.6, nScaleSample: 10 }));
    expect(result.verdict).toBe("violation");
    expect(result.reasonKey).toBe("reliabilityVerdict.scale.violation.low");
  });

  it("reports a constant kept item as Not applicable, not as a Verdict", () => {
    const result = scaleVerdict(statsOf({ alpha: null }), ["Q4"]);
    expect(result.verdict).toBe("notApplicable");
    expect(result.reasonKey).toBe("reliabilityVerdict.scale.notApplicable.constantItem");
    expect(result.reasonParams).toMatchObject({ items: "Q4" });
    expect(result.bandKey).toBeNull();
  });

  it("reports an undefined α as Not applicable with the sample size", () => {
    const result = scaleVerdict(statsOf({ alpha: null, nScaleSample: 2 }));
    expect(result.verdict).toBe("notApplicable");
    expect(result.reasonKey).toBe("reliabilityVerdict.scale.notApplicable.alphaUndefined");
    expect(result.reasonParams).toMatchObject({ n: 2, k: 5 });
  });

  it("carries the α band even when another rule decides the Verdict", () => {
    const result = scaleVerdict(statsOf({ alpha: 0.85, nScaleSample: 20 }));
    expect(result.verdict).toBe("caution");
    expect(result.bandKey).toBe("reliabilityVerdict.band.good");
  });
});

describe("itemVerdict", () => {
  it("violates a negative corrected item-total correlation", () => {
    const result = itemVerdict(itemOf({ correctedItemTotal: -0.2 }), 0.8);
    expect(result.verdict).toBe("violation");
    expect(result.reasonKey).toBe("reliabilityVerdict.item.negativeCitc");
    expect(result.reasonParams).toMatchObject({ citc: -0.2 });
  });

  it("cautions a CITC in [0, .30)", () => {
    for (const citc of [0, 0.29]) {
      const result = itemVerdict(itemOf({ correctedItemTotal: citc }), 0.8);
      expect(result.verdict).toBe("caution");
      expect(result.reasonKey).toBe("reliabilityVerdict.item.lowCitc");
      expect(result.reasonParams).toMatchObject({ citc, threshold: 0.3 });
    }
  });

  it("passes a CITC of at least .30", () => {
    const result = itemVerdict(itemOf({ correctedItemTotal: 0.3 }), 0.8);
    expect(result.verdict).toBe("pass");
    expect(result.reasonKey).toBe("reliabilityVerdict.item.pass");
    expect(result.reasonParams).toMatchObject({ citc: 0.3, threshold: 0.3 });
  });

  it("cautions when deleting the item would raise α", () => {
    const result = itemVerdict(itemOf({ correctedItemTotal: 0.5, alphaIfDeleted: 0.86 }), 0.84);
    expect(result.verdict).toBe("caution");
    expect(result.reasonKey).toBe("reliabilityVerdict.item.raisesAlpha");
    expect(result.reasonParams).toMatchObject({ alphaIfDeleted: 0.86, alpha: 0.84 });
  });

  it("only cautions when α-if-deleted is strictly greater", () => {
    expect(itemVerdict(itemOf({ correctedItemTotal: 0.5, alphaIfDeleted: 0.84 }), 0.84).verdict).toBe(
      "pass"
    );
  });

  it("reports a constant item as Not applicable", () => {
    const result = itemVerdict(itemOf({ sd: 0, correctedItemTotal: null }), 0.8);
    expect(result.verdict).toBe("notApplicable");
    expect(result.reasonKey).toBe("reliabilityVerdict.item.constantItem");
    expect(result.reasonParams).toMatchObject({ item: "Q1" });
  });

  it("reports an uncomputable CITC as Not applicable", () => {
    const result = itemVerdict(itemOf({ correctedItemTotal: null, alphaIfDeleted: null }), null);
    expect(result.verdict).toBe("notApplicable");
    expect(result.reasonKey).toBe("reliabilityVerdict.item.notComputable");
  });

  it("judges a two-item scale by CITC only (α-if-deleted does not exist)", () => {
    const result = itemVerdict(
      itemOf({ correctedItemTotal: 0.5, alphaIfDeleted: null }),
      0.6
    );
    expect(result.verdict).toBe("pass");
  });
});

describe("computeFeldtCi", () => {
  it("matches scipy.stats.f.ppf on the golden sample", () => {
    // scipy.stats.f.ppf(.975, 11, 44) and .ppf(.025, 44, 11) on n = 12, k = 5.
    const ci = computeFeldtCi(0.793043907252, 5, 12);
    expect(ci).not.toBeNull();
    expect(ci!.lower).toBeCloseTo(0.523685594649, 9);
    expect(ci!.upper).toBeCloseTo(0.910078671054, 9);
  });

  it("matches scipy on a two-item scale", () => {
    const ci = computeFeldtCi(0.798053527981, 2, 12);
    expect(ci!.lower).toBeCloseTo(0.29849873177585906, 9);
    expect(ci!.upper).toBeCloseTo(0.9418641427914315, 9);
  });

  it("clamps the lower bound to zero (SPSS behaviour)", () => {
    const ci = computeFeldtCi(0.2, 5, 12);
    expect(ci!.lower).toBe(0);
    expect(ci!.upper).toBeGreaterThan(0);
  });

  it("returns null when the interval is undefined", () => {
    expect(computeFeldtCi(null, 5, 12)).toBeNull();
    expect(computeFeldtCi(0.8, 1, 12)).toBeNull();
    expect(computeFeldtCi(0.8, 5, 1)).toBeNull();
  });
});

describe("computeReliability", () => {
  it("assembles one scale sample, its statistics, the item table and the Verdict", () => {
    const result = computeReliability(ROWS, ITEMS, REVERSE, REFLECTION);

    expect(result.statistics.alpha).toBeCloseTo(0.793043907252, 9);
    expect(result.statistics.alphaStandardized).toBeCloseTo(0.84171747737, 9);
    expect(result.statistics.ci!.lower).toBeCloseTo(0.523685594649, 9);
    expect(result.statistics.ci!.upper).toBeCloseTo(0.910078671054, 9);
    expect(result.statistics.k).toBe(5);
    expect(result.statistics.nScaleSample).toBe(12);
    expect(result.statistics.nInput).toBe(12);
    expect(result.statistics.meanInterItemR).toBeCloseTo(0.515401364689, 9);

    expect(result.itemStatistics.map((it) => it.name)).toEqual(ITEMS);
    expect(result.itemStatistics[4].correctedItemTotal).toBeCloseTo(0.102743928708, 9);

    // α = .793 sits in the [.70, .80) band.
    expect(result.verdict.verdict).toBe("caution");
    expect(result.verdict.reasonKey).toBe("reliabilityVerdict.scale.caution.acceptable");
  });

  it("marks a scale with a constant kept item as Not applicable", () => {
    const rows = ROWS.map((row, i) =>
      i === 0 ? row : row.map((cell, j) => (j === 3 ? "4" : cell))
    );
    const result = computeReliability(rows, ITEMS, REVERSE, REFLECTION);

    expect(result.statistics.alpha).toBeNull();
    expect(result.verdict.verdict).toBe("notApplicable");
    expect(result.verdict.reasonKey).toBe("reliabilityVerdict.scale.notApplicable.constantItem");
    expect(result.verdict.reasonParams).toMatchObject({ items: "Q4" });
  });

  it("runs on a two-item scale", () => {
    const result = computeReliability(ROWS, ["Q1", "Q2"]);
    expect(result.statistics.alpha).toBeCloseTo(0.798053527981, 9);
    expect(result.verdict.verdict).toBe("caution");
    expect(result.verdict.reasonKey).toBe("reliabilityVerdict.scale.caution.twoItems");
  });
});
