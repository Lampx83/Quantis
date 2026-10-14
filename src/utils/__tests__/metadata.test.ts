import { describe, it, expect } from "vitest";
import {
  inferVariableMetadata,
  ensureDatasetMetadata,
  formatCellValueWithLabels,
  maskMissingValues,
  isMissingValue,
  validateVariableName,
} from "../metadata";
import { Dataset } from "../../types";

describe("Metadata Utilities", () => {
  describe("validateVariableName", () => {
    it("should accept valid SPSS variable names", () => {
      expect(validateVariableName("Q1_1").valid).toBe(true);
      expect(validateVariableName("AGE").valid).toBe(true);
      expect(validateVariableName("_temp_var").valid).toBe(true);
    });

    it("should reject invalid variable names", () => {
      expect(validateVariableName("").valid).toBe(false);
      expect(validateVariableName("1VAR").valid).toBe(false); // starts with number
      expect(validateVariableName("VAR NAME").valid).toBe(false); // has space
      expect(validateVariableName("VAR-NAME").valid).toBe(false); // has dash
      expect(validateVariableName("Biến_1").valid).toBe(false); // has non-ascii characters
    });

    it("should reject duplicate variable names", () => {
      expect(validateVariableName("AGE", ["AGE", "GENDER"]).valid).toBe(false);
      expect(validateVariableName("age", ["AGE", "GENDER"]).valid).toBe(false);
      // allows keeping same name when currentName matches
      expect(validateVariableName("AGE", ["AGE", "GENDER"], "AGE").valid).toBe(true);
      // allows renaming with case change on currentName without colliding with itself
      expect(validateVariableName("age", ["AGE", "GENDER"], "AGE").valid).toBe(true);
      // still rejects renaming when colliding with another variable
      expect(validateVariableName("gender", ["AGE", "GENDER"], "AGE").valid).toBe(false);
      expect(validateVariableName("GENDER", ["AGE", "GENDER"], "AGE").valid).toBe(false);
    });
  });
  describe("inferVariableMetadata", () => {
    it("should infer numeric scale variable for continuous numbers", () => {
      const values = ["10.5", "12.3", "14.1", "15.9", "18.2", "20.0", "22.4", "25.1", "30.0", "35.2"];
      const meta = inferVariableMetadata("INCOME", values);

      expect(meta.name).toBe("INCOME");
      expect(meta.type).toBe("numeric");
      expect(meta.measure).toBe("scale");
      expect(meta.decimals).toBe(2);
      expect(meta.align).toBe("right");
      expect(meta.missingValues).toEqual([]);
    });

    it("should infer ordinal variable for numeric values with <= 7 unique values (e.g. Likert scale)", () => {
      const values = ["1", "2", "3", "4", "5", "5", "4", "3", "2", "1", "4", "5"];
      const meta = inferVariableMetadata("Q1_1", values);

      expect(meta.name).toBe("Q1_1");
      expect(meta.type).toBe("numeric");
      expect(meta.measure).toBe("ordinal");
      expect(meta.align).toBe("right");
    });

    it("should infer string nominal variable for text data", () => {
      const values = ["Male", "Female", "Female", "Male", "Other"];
      const meta = inferVariableMetadata("GENDER", values);

      expect(meta.name).toBe("GENDER");
      expect(meta.type).toBe("string");
      expect(meta.measure).toBe("nominal");
      expect(meta.decimals).toBe(0);
      expect(meta.align).toBe("left");
    });

    it("should handle empty or whitespace values gracefully", () => {
      const values = ["", "  ", "100", "200", "", "300"];
      const meta = inferVariableMetadata("SALARY", values);

      expect(meta.type).toBe("numeric");
      expect(meta.measure).toBe("ordinal"); // 3 unique values: 100, 200, 300
    });
  });

  describe("ensureDatasetMetadata", () => {
    it("should add variables metadata to dataset missing variables field", () => {
      const rawDataset: Dataset = {
        id: "ds_1",
        name: "Test Dataset",
        rows: 3,
        columns: 2,
        columnNames: ["AGE", "CITY"],
        preview: [
          ["25", "Hanoi"],
          ["30", "HCM"],
          ["28", "Danang"],
        ],
        sourceFormat: "csv",
        createdAt: "2026-10-12T00:00:00Z",
        updatedAt: "2026-10-12T00:00:00Z",
      };

      const enriched = ensureDatasetMetadata(rawDataset);

      expect(enriched.variables).toBeDefined();
      expect(enriched.variables?.["AGE"]).toBeDefined();
      expect(enriched.variables?.["AGE"].type).toBe("numeric");
      expect(enriched.variables?.["CITY"]).toBeDefined();
      expect(enriched.variables?.["CITY"].type).toBe("string");
    });

    it("should preserve existing variables and only infer missing columns", () => {
      const dataset: Dataset = {
        id: "ds_2",
        name: "Partial Dataset",
        rows: 2,
        columns: 2,
        columnNames: ["GENDER", "SCORE"],
        preview: [
          ["1", "85.5"],
          ["2", "90.0"],
        ],
        variables: {
          GENDER: {
            name: "GENDER",
            type: "numeric",
            label: "Giới tính",
            measure: "nominal",
            valueLabels: { "1": "Nam", "2": "Nữ" },
            decimals: 0,
            align: "center",
          },
        },
        sourceFormat: "spss",
        createdAt: "2026-10-12T00:00:00Z",
        updatedAt: "2026-10-12T00:00:00Z",
      };

      const enriched = ensureDatasetMetadata(dataset);

      expect(enriched.variables?.["GENDER"].label).toBe("Giới tính");
      expect(enriched.variables?.["GENDER"].valueLabels).toEqual({ "1": "Nam", "2": "Nữ" });
      expect(enriched.variables?.["SCORE"]).toBeDefined();
      expect(enriched.variables?.["SCORE"].type).toBe("numeric");
    });

    it("should sanitize string variables with scale measure to nominal", () => {
      const dataset: Dataset = {
        id: "ds_str_scale",
        name: "String Scale Dataset",
        rows: 1,
        columns: 1,
        columnNames: ["NOTES"],
        preview: [["Some text"]],
        variables: {
          NOTES: {
            name: "NOTES",
            type: "string",
            label: "Notes",
            measure: "scale",
            decimals: 0,
            align: "left",
          },
        },
        sourceFormat: "sav",
        createdAt: "2026-10-12T00:00:00Z",
        updatedAt: "2026-10-12T00:00:00Z",
      };

      const enriched = ensureDatasetMetadata(dataset);
      expect(enriched.variables?.["NOTES"].measure).toBe("nominal");
    });
  });

  describe("formatCellValueWithLabels", () => {
    it("should format encoded values to labels when valueLabels exist", () => {
      const meta = {
        name: "GENDER",
        type: "numeric" as const,
        label: "Giới tính",
        measure: "nominal" as const,
        valueLabels: { "1": "Nam", "2": "Nữ" },
        decimals: 0,
        align: "center" as const,
      };

      expect(formatCellValueWithLabels("1", meta)).toBe("Nam");
      expect(formatCellValueWithLabels("1.0", meta)).toBe("Nam");
      expect(formatCellValueWithLabels("2", meta)).toBe("Nữ");
      expect(formatCellValueWithLabels("2.0", meta)).toBe("Nữ");
      expect(formatCellValueWithLabels("99", meta)).toBe("99");
    });

    it("should return raw value if metadata or valueLabels is absent", () => {
      expect(formatCellValueWithLabels("Hello", undefined)).toBe("Hello");
    });
  });

  describe("maskMissingValues & isMissingValue", () => {
    const meta = {
      name: "Q1",
      type: "numeric" as const,
      label: "Question 1",
      measure: "ordinal" as const,
      missingValues: ["99", "-1"],
      decimals: 0,
      align: "right" as const,
    };

    it("should identify missing values according to metadata missing codes and empty strings", () => {
      expect(isMissingValue("99", meta)).toBe(true);
      expect(isMissingValue("99.0", meta)).toBe(true);
      expect(isMissingValue("-1", meta)).toBe(true);
      expect(isMissingValue("-1.0", meta)).toBe(true);
      expect(isMissingValue("", meta)).toBe(true);
      expect(isMissingValue("   ", meta)).toBe(true);
      expect(isMissingValue("5", meta)).toBe(false);
    });

    it("should mask missing values to null", () => {
      expect(maskMissingValues("99", meta)).toBeNull();
      expect(maskMissingValues("99.0", meta)).toBeNull();
      expect(maskMissingValues("-1", meta)).toBeNull();
      expect(maskMissingValues("", meta)).toBeNull();
      expect(maskMissingValues("4", meta)).toBe("4");
    });
  });
});
