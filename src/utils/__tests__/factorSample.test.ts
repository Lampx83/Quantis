import { describe, expect, it } from "vitest";
import { createFactorSample, factorApiRows } from "../factorSample";
import { computeEFA, computeKMOBartlett, getAnalysisRows } from "../stats";
import type { VariableMetadata } from "../../types";

describe("factor analysis sample", () => {
  it("uses one finite listwise sample in selection order without editing the source", () => {
    const data = [
      ["a", "b", "unused"], [" 1 ", "2", ""], ["99", "3"], ["2", "  "],
      ["3", "Infinity"], ["4", "NaN"], ["4"], ["2", "3"], ["3", "1"], ["4", "2"],
    ];
    const a: VariableMetadata = {
      name: "a", type: "numeric", measure: "scale", label: "", decimals: 0,
      align: "right", missingValues: ["99"],
    };
    const sample = createFactorSample(getAnalysisRows({ data, variables: { a } }), ["b", "a"]);

    expect(sample).toMatchObject({ columnNames: ["b", "a"], nInput: 9, nUsed: 4, issue: null });
    expect(sample.data).toEqual([[2, 1], [3, 2], [1, 3], [2, 4]]);
    expect(computeKMOBartlett(sample).n).toBe(sample.nUsed);
    expect(factorApiRows(sample)).toEqual([["b", "a"], ["2", "1"], ["3", "2"], ["1", "3"], ["2", "4"]]);
    expect(data[1]).toEqual([" 1 ", "2", ""]);
    expect(data[2][0]).toBe("99");
  });

  it("reports missing and constant items by name instead of substituting columns", () => {
    const rows = [["a", "b"], ["1", "5"], ["2", "5"], ["3", "5"]];
    const missing = createFactorSample(rows, ["b", "missing", "a"]);
    expect(missing).toMatchObject({ nInput: 3, nUsed: 0, issue: { code: "missingColumns", columns: ["missing"] } });

    const constant = createFactorSample(rows, ["b", "a"]);
    expect(constant).toMatchObject({ nUsed: 3, issue: { code: "constantColumns", columns: ["b"] } });
    expect(computeKMOBartlett(constant)).toMatchObject({ n: 3, kmo: null, bartlettP: null });
    expect(computeEFA(constant)).toBeNull();
  });

  it("keeps Bartlett's result when KMO and MSA are undefined for uncorrelated items", () => {
    const sample = createFactorSample([["a", "b"], ["1", "1"], ["1", "2"], ["2", "1"], ["2", "2"]], ["a", "b"]);

    expect(computeKMOBartlett(sample)).toMatchObject({
      n: 4, kmo: null, msa: [null, null], issue: null,
      bartlettDf: 1, bartlettP: 1,
    });
  });

  it("distinguishes a short sample from a singular correlation matrix", () => {
    const rows = [["a", "b"], ["1", "2"], ["2", "4"], ["3", "6"]];
    expect(computeKMOBartlett(createFactorSample(rows.slice(0, 3), ["a", "b"]))?.issue)
      .toEqual({ code: "insufficientRows" });
    expect(computeKMOBartlett(createFactorSample(rows, ["a", "b"]))?.issue)
      .toEqual({ code: "singular" });
  });
});
