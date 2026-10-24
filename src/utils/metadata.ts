import { Dataset, VariableAlign, VariableMeasure, VariableMetadata, VariableType } from "../types";
import { t } from "../i18n";

/**
 * Validate variable name according to academic standard (SPSS-like identifier)
 * Regex: ^[\p{L}_][\p{L}\p{M}\p{N}_]*$ (chữ cái Unicode, kể cả tiếng Việt có dấu; số/dấu gạch dưới;
 * không bắt đầu bằng số, không khoảng trắng). Nhập CSV vốn đã cho tên cột tiếng Việt nên đổi tên cũng phải cho phép.
 */
export function validateVariableName(
  name: string,
  existingNames: string[] = [],
  currentName?: string
): { valid: boolean; error?: string } {
  const trimmed = name.trim();
  if (!trimmed) {
    return { valid: false, error: t("metadata.validation.empty") };
  }
  if (!/^[\p{L}_][\p{L}\p{M}\p{N}_]*$/u.test(trimmed)) {
    return {
      valid: false,
      error: t("metadata.validation.invalidChars"),
    };
  }
  const targetLower = trimmed.toLowerCase();
  const currentLower = currentName?.toLowerCase();
  if (
    existingNames.some(
      (n) => n.toLowerCase() === targetLower && n.toLowerCase() !== currentLower
    )
  ) {
    return { valid: false, error: t("metadata.validation.duplicate", { name: trimmed }) };
  }
  return { valid: true };
}

function isCalendarDate(y: number, m: number, d: number): boolean {
  if (!(y >= 1000 && y <= 9999) || !(m >= 1 && m <= 12) || !(d >= 1 && d <= 31)) return false;
  const dt = new Date(Date.UTC(y, m - 1, d));
  return dt.getUTCFullYear() === y && dt.getUTCMonth() === m - 1 && dt.getUTCDate() === d;
}

const MONTH_NAMES = ["jan", "feb", "mar", "apr", "may", "jun", "jul", "aug", "sep", "oct", "nov", "dec"];
const TIME_SUFFIX = String.raw`(?:[T ]\d{1,2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:\s?[AaPp][Mm])?(?:Z|[+-]\d{2}:?\d{2})?)?`;
const RE_Y_FIRST = new RegExp(String.raw`^(\d{4})([-/.])(\d{1,2})\2(\d{1,2})${TIME_SUFFIX}$`);
const RE_D_FIRST = new RegExp(String.raw`^(\d{1,2})([-/.])(\d{1,2})\2(\d{4})${TIME_SUFFIX}$`);
const RE_D_MON_Y = /^(\d{1,2})[ -]([A-Za-z]{3,9})\.?,?[ -](\d{4})$/;
const RE_MON_D_Y = /^([A-Za-z]{3,9})\.? (\d{1,2}),? (\d{4})$/;

/**
 * Chuỗi có phải NGÀY THẬT không (để tự đoán kiểu Date). Chỉ nhận định dạng ngày rõ ràng và kiểm hợp lệ lịch:
 * `yyyy-mm-dd` (/ hoặc .; có thể kèm giờ), `dd/mm/yyyy`, `dd-mm-yyyy`, `dd.mm.yyyy` (hoặc tháng/ngày kiểu Mỹ nếu một trong hai
 * cách đọc hợp lệ), `12 Jan 2024`, `Jan 12, 2024`. KHÔNG nhận mã chữ-số-gạch nối như «phong-van-01», «2024-A», «S-01»,
 * «01-02», số điện thoại, mã sinh viên — kể cả khi `Date.parse` của trình duyệt “cố hiểu” chúng thành ngày.
 */
export function isDateString(raw: string | undefined | null): boolean {
  if (raw === undefined || raw === null) return false;
  const v = String(raw).trim();
  if (v.length < 8 || v.length > 40) return false;
  let m = RE_Y_FIRST.exec(v);
  if (m) return isCalendarDate(+m[1], +m[3], +m[4]);
  m = RE_D_FIRST.exec(v);
  if (m) return isCalendarDate(+m[4], +m[3], +m[1]) || isCalendarDate(+m[4], +m[1], +m[3]);
  const monthIdx = (name: string) => MONTH_NAMES.indexOf(name.slice(0, 3).toLowerCase());
  m = RE_D_MON_Y.exec(v);
  if (m) return monthIdx(m[2]) >= 0 && isCalendarDate(+m[3], monthIdx(m[2]) + 1, +m[1]);
  m = RE_MON_D_Y.exec(v);
  if (m) return monthIdx(m[1]) >= 0 && isCalendarDate(+m[3], monthIdx(m[1]) + 1, +m[2]);
  return false;
}

/** Tỉ lệ ô khớp định dạng ngày tối thiểu để cả cột được đoán là Date. */
const DATE_COLUMN_RATIO = 0.9;

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
    // Chỉ là Date khi đa số ô khớp định dạng ngày thật (không dùng Date.parse: nó hiểu nhầm «phong-van-01» là ngày)
    const dateCount = cleanValues.filter(isDateString).length;
    if (dateCount / cleanValues.length >= DATE_COLUMN_RATIO) {
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

/** Chuẩn hóa mã để so khớp: bỏ khoảng trắng, "99.0" -> "99". */
function normalizeCode(v: string): string {
  const trimmed = String(v).trim();
  return trimmed.endsWith(".0") ? trimmed.slice(0, -2) : trimmed;
}

/** Biến có khai báo mã khuyết (rời rạc hoặc khoảng) hay không. */
export function hasMissingRule(metadata?: VariableMetadata): boolean {
  return Boolean(
    (metadata?.missingValues && metadata.missingValues.length > 0) || metadata?.missingRange
  );
}

/** Chuỗi định danh quy tắc khuyết của một biến — dùng làm khóa cache/so sánh. */
export function missingRuleSignature(metadata?: VariableMetadata): string {
  if (!hasMissingRule(metadata)) return "";
  const r = metadata?.missingRange;
  return `${(metadata?.missingValues ?? []).join("|")}#${r ? `${r.min}..${r.max}` : ""}#${metadata?.type ?? ""}`;
}

/**
 * Tạo hàm kiểm tra «ô này có phải mã khuyết người dùng khai báo» cho một biến (biên dịch một lần,
 * dùng cho cả cột hàng chục nghìn dòng). Trả về `null` nếu biến không khai báo mã khuyết nào.
 * Chỉ xét mã khai báo; ô trống/null xử lý riêng ở `isMissingValue`.
 */
export function buildMissingMatcher(
  metadata?: VariableMetadata
): ((trimmed: string) => boolean) | null {
  if (!hasMissingRule(metadata)) return null;
  const isString = metadata?.type === "string";
  const codes = new Set<string>();
  const numericCodes = new Set<number>();
  for (const mv of metadata?.missingValues ?? []) {
    const norm = normalizeCode(mv);
    if (norm === "") continue;
    codes.add(norm);
    if (!isString) {
      const n = Number(norm);
      if (Number.isFinite(n)) numericCodes.add(n);
    }
  }
  const range = metadata?.missingRange;
  const lo = range ? Math.min(range.min, range.max) : NaN;
  const hi = range ? Math.max(range.min, range.max) : NaN;
  const hasRange = Number.isFinite(lo) && Number.isFinite(hi) && !isString;
  if (codes.size === 0 && !hasRange) return null;
  return (trimmed: string) => {
    if (codes.has(trimmed) || codes.has(normalizeCode(trimmed))) return true;
    if (numericCodes.size > 0 || hasRange) {
      const n = Number(trimmed);
      if (Number.isFinite(n)) {
        if (numericCodes.has(n)) return true;
        if (hasRange && n >= lo && n <= hi) return true;
      }
    }
    return false;
  };
}

/** Cache hàm so khớp theo đối tượng metadata (tránh dựng lại Set cho từng ô). */
const matcherCache = new WeakMap<
  VariableMetadata,
  { sig: string; matcher: ((trimmed: string) => boolean) | null }
>();

/**
 * Checks whether a given cell value represents a missing value (empty string, null,
 * or a user-defined missing code: discrete codes and/or a numeric range like SPSS).
 */
export function isMissingValue(
  value: string | undefined | null,
  metadata?: VariableMetadata
): boolean {
  if (value === undefined || value === null) return true;
  const trimmed = String(value).trim();
  if (trimmed === "") return true;
  if (!metadata || !hasMissingRule(metadata)) return false;
  const sig = missingRuleSignature(metadata);
  let cached = matcherCache.get(metadata);
  if (!cached || cached.sig !== sig) {
    cached = { sig, matcher: buildMissingMatcher(metadata) };
    matcherCache.set(metadata, cached);
  }
  return cached.matcher ? cached.matcher(trimmed) : false;
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

const STRICT_NUMERIC_REGEX = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/;

/**
 * Kiểm tra xem một chuỗi có phải là định dạng số chuẩn quốc tế hay không (dấu chấm thập phân).
 * Ô trống/khoảng trắng được coi là hợp lệ (ô khuyết).
 */
export function isValidNumericValue(val: string | undefined | null): boolean {
  if (val === undefined || val === null) return true;
  const trimmed = String(val).trim();
  if (trimmed === "") return true;
  return STRICT_NUMERIC_REGEX.test(trimmed);
}

/**
 * Kiểm tra xem ô dữ liệu có phải là giá trị số không hợp lệ trong một biến numeric hay không.
 * Trả về false nếu biến không phải numeric, hoặc ô trống, hoặc ô là mã khuyết đã khai báo.
 */
export function isInvalidNumericCell(
  val: string | undefined | null,
  metadata?: VariableMetadata
): boolean {
  if (metadata?.type !== "numeric") return false;
  if (val === undefined || val === null) return false;
  const trimmed = String(val).trim();
  if (trimmed === "") return false;
  if (isMissingValue(trimmed, metadata)) return false;
  return !isValidNumericValue(trimmed);
}
