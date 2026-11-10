/// <reference types="vite/client" />
import { describe, expect, it } from "vitest";
import casesCsv from "../../../tests/fixtures/efa/cases.csv?raw";
import expectedCsv from "../../../tests/fixtures/efa/expected.csv?raw";
import { createFactorSample } from "../factorSample";
import { computeFactorPca } from "../factorPca";
import { computeKMOBartlett, parseDelimited } from "../stats";

const [header, ...cases] = parseDelimited(casesCsv, ",");
const [, ...reference] = parseDelimited(expectedCsv, ",");

function fixtureSample(name: string) {
  const rows = cases.filter(([caseName]) => caseName === name);
  const columns = header.slice(2).filter((_, j) => rows[0][j + 2] !== "");
  return createFactorSample([columns, ...rows.map((row) => row.slice(2, columns.length + 2))], columns);
}

function expected(name: string, statistic: string, method = "pca") {
  return reference
    .filter(([caseName, source, measure]) => caseName === name && source === method && measure === statistic)
    .map((row) => Number(row[5]));
}

describe("browser PCA against independent R fixtures", () => {
  it("resolves the full spectrum of the many-item correlation matrix", () => {
    const result = computeFactorPca(fixtureSample("many_items"));
    const roots = expected("many_items", "scree");

    expect(result.eigenvalues).toHaveLength(18);
    roots.forEach((root, i) => expect(result.eigenvalues[i]).toBeCloseTo(root, 9));
  });

  it.each(["survey", "many_items"])("matches %s loadings and variance before and after rotation", (name) => {
    const result = computeFactorPca(fixtureSample(name));
    expect(result.suggestedCount).toBe(expected(name, "suggested")[0]);
    const solution = result.solution!;
    expect(solution?.rotation).toBe("varimax");
    const p = result.columnNames.length;
    for (const [stage, matrix, variance] of [
      ["before", solution.unrotatedLoadings, solution.varianceBefore],
      ["after", solution.loadings, solution.varianceAfter],
    ] as const) {
      const reference = expected(name, `loadings_${stage}`);
      const referenceVariance = expected(name, `variance_${stage}`);
      const referenceCumulative = expected(name, `cumulative_${stage}`);
      const matched = new Set<number>();
      let cumulative = 0;
      for (let axis = 0; axis < solution.nFactors; axis++) {
        const target = reference.slice(axis * p, (axis + 1) * p);
        const [match] = matrix[0].map((_, j) => ({
          j, dot: matrix.reduce((sum, row, i) => sum + row[j] * target[i], 0),
        })).sort((a, b) => Math.abs(b.dot) - Math.abs(a.dot));
        expect(matched.has(match.j)).toBe(false);
        matched.add(match.j);
        target.forEach((value, i) => expect(Math.sign(match.dot) * matrix[i][match.j]).toBeCloseTo(value, 5));
        expect(variance[match.j]).toBeCloseTo(referenceVariance[axis], 4);
        cumulative += variance[match.j];
        expect(cumulative).toBeCloseTo(referenceCumulative[axis], 4);
      }
    }
    expected(name, "communalities").forEach((value, i) => expect(solution.communalities[i]).toBeCloseTo(value, 9));
    expect(solution.varianceAfter.reduce((sum, value) => sum + value, 0))
      .toBeCloseTo(solution.varianceBefore.reduce((sum, value) => sum + value, 0), 10);
  });

  it("retains one unrotated component when no eigenvalue exceeds 1", () => {
    const sample = fixtureSample("no_signal");
    const result = computeFactorPca(sample);
    expect(result).toMatchObject({ method: "pca", nUsed: 64, suggestedCount: 0, issue: null });
    expect(result.solution).toMatchObject({ nFactors: 1, rotation: "none" });
    expect(result.solution?.loadings).toEqual(result.solution?.unrotatedLoadings);
  });

  it.each([0, -1, 1.5, 2])("rejects count %s for a rank-one sample while retaining the scree", (count) => {
    const columns = ["a", "b"];
    const rows = Array.from({ length: 10 }, (_, i) => [String(i), String(-i)]);
    const sample = createFactorSample([columns, ...rows], columns);
    const result = computeFactorPca(sample, count);
    expect(result).toMatchObject({ solution: null, issue: { code: "pcaInvalidCount", max: 1 } });
    expect(result.eigenvalues).toHaveLength(2);
    expect(computeFactorPca(sample, 1).solution?.nFactors).toBe(1);
  });

  it("matches R adequacy statistics on the same survey sample", () => {
    const sample = fixtureSample("survey");
    const diagnostics = computeKMOBartlett(sample);
    expect(diagnostics.n).toBe(computeFactorPca(sample).nUsed);
    expect(diagnostics.kmo).toBeCloseTo(expected("survey", "kmo", "adequacy")[0], 10);
    expected("survey", "msa", "adequacy").forEach((value, i) => expect(diagnostics.msa[i]).toBeCloseTo(value, 10));
    expect(diagnostics.bartlettChi2).toBeCloseTo(expected("survey", "bartlett_chi2", "adequacy")[0], 9);
    expect(diagnostics.bartlettP! / expected("survey", "bartlett_p", "adequacy")[0]).toBeCloseTo(1, 9);
  });
});
