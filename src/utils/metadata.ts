import { Dataset, VariableAlign, VariableMeasure, VariableMetadata, VariableType } from "../types";

/**
 * Validate variable name according to academic standard (SPSS-like identifier)
 * Regex: ^[a-zA-Z_][a-zA-Z0-9_]*$
 */
export function validateVariableName(
  name: string,
  existingNames: string[] = [],
  currentName?: string
): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: "Tên biến không được để trống." };
  }
  if (!/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(trimmed)) {
    return {
      valid: false,
      error: "Tên biến chỉ được chứa chữ cái, số và dấu gạch dưới, không bắt đầu bằng số hoặc chứa khoảng trắng.",
    };
  }
  if (
    currentName !== trimmed &&
    existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())
  ) {
    return { valid: false, error: `Tên biến "${trimmed}" đã tồn tại trong bộ dữ liệu.` };
  }
  return { valid: true };
}

/**
 * Automatically infer metadata for a variable based on its observed values.
 */
export function inferVariableMetadata(name: string, values: string[]): VariableMetadata {
  const cleanValues = values
    .map((v) => (v !== undefined && v !== null ? String(v).trim() : ""))
    .filter((v) => v !== "");

  if (cleanValues.length === 0) {
    return {
      name,
      type: "string",
      label: name,
      measure: "nominal",
      missingValues: [],
      decimals: 0,
      align: "left",
      width: 120,
    };
  }

  // Check numeric ratio
  const numericCount = cleanValues.filter((v) => !isNaN(Number(v))).length;
  const numericRatio = numericCount / cleanValues.length;

  let type: VariableType = "string";
  if (numericRatio >= 0.9) {
    type = "numeric";
  } else {
    // Check if ISO/valid date format
    const dateCount = cleanValues.filter((v) => {
      if (v.length < 8) return false;
      const parsed = Date.parse(v);
      return !isNaN(parsed);
    }).length;
    if (dateCount / cleanValues.length >= 0.9) {
      type = "date";
    }
  }

  // Determine measure
  let measure: VariableMeasure = "nominal";
  const uniqueValues = new Set(cleanValues);

  if (type === "numeric") {
    // If unique distinct values <= 7, likely ordinal (e.g. Likert scale 1-5 or 1-7)
    if (uniqueValues.size <= 7) {
      measure = "ordinal";
    } else {
      measure = "scale";
    }
  } else if (type === "date") {
    measure = "scale";
  } else {
    measure = "nominal";
  }

  // Determine decimals
  let decimals = 0;
  if (type === "numeric") {
    const hasDecimals = cleanValues.some((v) => {
      const num = Number(v);
      return !isNaN(num) && !Number.isInteger(num);
    });
    decimals = hasDecimals ? 2 : 0;
  }

  // Determine alignment
  let align: VariableAlign = "left";
  if (type === "numeric") {
    align = "right";
  } else if (type === "date") {
    align = "center";
  } else {
    align = "left";
  }

  return {
    name,
    type,
    label: name,
    measure,
    missingValues: [],
    decimals,
    align,
    width: 120,
  };
}

/**
 * Ensures backward compatibility by populating default variable metadata
 * for datasets that do not have `variables` defined.
 */
export function ensureDatasetMetadata(dataset: Dataset): Dataset {
  const existingVariables = dataset.variables ? { ...dataset.variables } : {};
  let modified = false;

  const hasHeaderInData = Boolean(
    dataset.data &&
      dataset.data.length > 0 &&
      dataset.columnNames.length > 0 &&
      dataset.data[0][0] === dataset.columnNames[0]
  );
  const hasHeaderInPreview = Boolean(
    dataset.preview &&
      dataset.preview.length > 0 &&
      dataset.columnNames.length > 0 &&
      dataset.preview[0][0] === dataset.columnNames[0]
  );

  const effectiveData = hasHeaderInData ? dataset.data!.slice(1) : dataset.data;
  const effectivePreview = hasHeaderInPreview ? dataset.preview!.slice(1) : dataset.preview;

  dataset.columnNames.forEach((colName, colIdx) => {
    if (!existingVariables[colName]) {
      modified = true;
      let values: string[] = [];
      if (effectiveData && effectiveData.length > 0) {
        values = effectiveData.map((row) => row[colIdx] ?? "");
      } else if (effectivePreview && effectivePreview.length > 0) {
        values = effectivePreview.map((row) => row[colIdx] ?? "");
      }
      existingVariables[colName] = inferVariableMetadata(colName, values);
    }
  });

  // String variables cannot have scale measure (IBM SPSS Statistics standard)
  for (const colName of dataset.columnNames) {
    const v = existingVariables[colName];
    if (v && v.type === "string" && v.measure === "scale") {
      existingVariables[colName] = { ...v, measure: "nominal" };
      modified = true;
    }
  }

  if (!dataset.variables || modified) {
    return {
      ...dataset,
      variables: existingVariables,
    };
  }

  return dataset;
}

/**
 * Formats a raw cell value using the variable's valueLabels dictionary if present.
 */
export function formatCellValueWithLabels(
  value: string,
  metadata?: VariableMetadata
): string {
  if (!metadata?.valueLabels) return value;
  if (Object.prototype.hasOwnProperty.call(metadata.valueLabels, value)) {
    return metadata.valueLabels[value];
  }
  const normalized = value.endsWith(".0") ? value.slice(0, -2) : value;
  if (Object.prototype.hasOwnProperty.call(metadata.valueLabels, normalized)) {
    return metadata.valueLabels[normalized];
  }
  if (!value.includes(".") && Object.prototype.hasOwnProperty.call(metadata.valueLabels, `${value}.0`)) {
    return metadata.valueLabels[`${value}.0`];
  }
  return value;
}

/**
 * Checks whether a given cell value represents a missing value (empty string, null, or user-defined missing code).
 */
export function isMissingValue(
  value: string | undefined | null,
  metadata?: VariableMetadata
): boolean {
  if (value === undefined || value === null) return true;
  const trimmed = String(value).trim();
  if (trimmed === "") return true;

  if (metadata?.missingValues && metadata.missingValues.length > 0) {
    const normalizedTrimmed = trimmed.endsWith(".0") ? trimmed.slice(0, -2) : trimmed;
    return metadata.missingValues.some((mv) => {
      const normalizedMv = mv.endsWith(".0") ? mv.slice(0, -2) : mv;
      return mv === trimmed || normalizedMv === normalizedTrimmed;
    });
  }
  return false;
}

/**
 * Masks a missing cell value to null, or returns the original string value.
 */
export function maskMissingValues(
  value: string | undefined | null,
  metadata?: VariableMetadata
): string | null {
  if (isMissingValue(value, metadata)) {
    return null;
  }
  return String(value);
}
