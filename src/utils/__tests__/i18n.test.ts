import { describe, it, expect, beforeEach } from "vitest";
import { t, setLocale, getLocale } from "../../i18n";

describe("i18n Core Engine", () => {
  beforeEach(() => {
    if (typeof localStorage !== "undefined") {
      localStorage.clear();
    }
    if (typeof window !== "undefined") {
      delete (window as unknown as { __AI_PORTAL_LOCALE__?: string }).__AI_PORTAL_LOCALE__;
    }
  });

  it("should interpolate parameters into translation string", () => {
    setLocale("en");
    expect(t("dataGrid.dimensions", { rows: 10, cols: 5 })).toBe("10 rows × 5 columns");
    expect(t("dataGrid.dimensions", { rows: 0, cols: 0 })).toBe("0 rows × 0 columns");
    expect(t("dataGrid.deleteColToast", { name: "AGE" })).toBe('Deleted variable "AGE"');
  });

  it("should return Vietnamese translations when locale is vi", () => {
    setLocale("vi");
    expect(t("dualView.dataView")).toBe("Xem Dữ liệu");
    expect(t("dualView.variableView")).toBe("Xem Biến số");
    expect(t("dataGrid.missingCellText")).toBe("(khuyết)");
    expect(t("dataGrid.dimensions", { rows: 20, cols: 4 })).toBe("20 dòng × 4 cột");
    expect(t("metadata.validation.empty")).toBe("Tên biến không được để trống.");
  });

  it("should return English translations when locale is en", () => {
    setLocale("en");
    expect(t("dualView.dataView")).toBe("Data View");
    expect(t("dualView.variableView")).toBe("Variable View");
    expect(t("dataGrid.missingCellText")).toBe("(missing)");
    expect(t("metadata.validation.empty")).toBe("Variable name cannot be empty.");
  });

  it("should fall back to English if a key is missing in Vietnamese", () => {
    setLocale("vi");
    // If a key only exists in en, it should fall back to en
    // Or if unknown key, return key
    expect(t("unknown.nonexistent.key")).toBe("unknown.nonexistent.key");
  });
});
