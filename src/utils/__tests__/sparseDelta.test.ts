import { describe, it, expect } from "vitest";
import { reconstructImputedRows } from "../sparseDelta";
import type { ImputationSparseCell } from "../../types";

describe("reconstructImputedRows", () => {
  const originalRowsWithHeader: string[][] = [
    ["id", "income", "score"],
    ["1", "", "10"],
    ["2", "5000", ""],
    ["3", "", ""],
  ];

  const columnNames = ["id", "income", "score"];

  const sparsePatches: Record<string, ImputationSparseCell[]> = {
    income: [
      { rowIndex: 0, values: ["4500", "4600"] },
      { rowIndex: 2, values: ["6500", "6600"] },
    ],
    score: [
      { rowIndex: 1, values: ["20", "25"] },
      { rowIndex: 2, values: ["30", "35"] },
    ],
  };

  it("returns original rows unchanged when imputationIndex === 0", () => {
    const result = reconstructImputedRows(originalRowsWithHeader, columnNames, sparsePatches, 0);
    expect(result).toEqual(originalRowsWithHeader);
    // Ensure it's a clone, not same reference
    expect(result).not.toBe(originalRowsWithHeader);
  });

  it("reconstructs imputation 1 with header offset correctly", () => {
    const result = reconstructImputedRows(originalRowsWithHeader, columnNames, sparsePatches, 1, 3);
    expect(result[0]).toEqual(["id", "income", "score"]);
    expect(result[1]).toEqual(["1", "4500", "10"]);
    expect(result[2]).toEqual(["2", "5000", "20"]);
    expect(result[3]).toEqual(["3", "6500", "30"]);
  });

  it("reconstructs imputation 2 with header offset correctly", () => {
    const result = reconstructImputedRows(originalRowsWithHeader, columnNames, sparsePatches, 2, 3);
    expect(result[0]).toEqual(["id", "income", "score"]);
    expect(result[1]).toEqual(["1", "4600", "10"]);
    expect(result[2]).toEqual(["2", "5000", "25"]);
    expect(result[3]).toEqual(["3", "6600", "35"]);
  });

  it("handles table without header row when dataRowCount matches length", () => {
    const noHeaderRows: string[][] = [
      ["1", "", "10"],
      ["2", "5000", ""],
    ];
    const patches: Record<string, ImputationSparseCell[]> = {
      income: [{ rowIndex: 0, values: ["4500"] }],
      score: [{ rowIndex: 1, values: ["20"] }],
    };

    const result = reconstructImputedRows(noHeaderRows, columnNames, patches, 1, 2);
    expect(result[0]).toEqual(["1", "4500", "10"]);
    expect(result[1]).toEqual(["2", "5000", "20"]);
  });

  it("safely handles empty rows, missing columns, or out-of-bound indices", () => {
    expect(reconstructImputedRows([], columnNames, sparsePatches, 1)).toEqual([]);

    const invalidPatches: Record<string, ImputationSparseCell[]> = {
      nonExistentCol: [{ rowIndex: 0, values: ["999"] }],
      income: [{ rowIndex: 999, values: ["999"] }],
    };
    const result = reconstructImputedRows(originalRowsWithHeader, columnNames, invalidPatches, 1);
    expect(result).toEqual(originalRowsWithHeader);
  });
});
