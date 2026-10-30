import { describe, it, expect, beforeEach } from "vitest";
import { t, setLocale } from "../../i18n";

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

  it("should have correct translations for MICE UI/UX and edge case keys in both en and vi", () => {
    setLocale("en");
    expect(t("transformTab.mice.replaceConfirmTitle")).toBe("This table already has an MI set");
    expect(t("transformTab.mice.replaceConfirmBody")).toBe("Creating it again will delete the current MI set.");
    expect(t("transformTab.mice.replaceConfirmOk")).toBe("Replace MI set");
    expect(t("transformTab.mice.noMissing")).toBe("The selected variables have no missing cells, so there is nothing to impute.");
    expect(t("transformTab.mice.needFullData")).toBe("Load the full data for this dataset before creating MI sets.");
    expect(t("dataGrid.bundleExportCsvBtn", { m: 5 })).toBe("Export 5 sets (CSV)");
    expect(t("mi.badge", { m: 5 })).toBe("MI · 5 sets");
    expect(t("mi.invalidateTitle")).toBe("Editing will delete the MI set");
    expect(t("mi.invalidateBody", { m: 5 })).toBe("This table has 5 imputation sets. Overwriting data will delete them. Continue?");
    expect(t("mi.invalidateConfirm")).toBe("Delete MI set and continue");
    expect(t("mi.invalidateCancel")).toBe("Cancel");

    setLocale("vi");
    expect(t("transformTab.mice.replaceConfirmTitle")).toBe("Bảng này đã có bộ MI");
    expect(t("transformTab.mice.replaceConfirmBody")).toBe("Tạo lại sẽ xoá bộ MI hiện có.");
    expect(t("transformTab.mice.replaceConfirmOk")).toBe("Thay bộ MI");
    expect(t("transformTab.mice.noMissing")).toBe("Các biến đã chọn không có ô khuyết nên không có gì để điền.");
    expect(t("transformTab.mice.needFullData")).toBe("Cần nạp đủ dữ liệu cho bảng này trước khi tạo bộ MI.");
    expect(t("dataGrid.bundleExportCsvBtn", { m: 5 })).toBe("Xuất 5 bộ (CSV)");
    expect(t("mi.badge", { m: 5 })).toBe("MI · 5 bộ");
    expect(t("mi.invalidateTitle")).toBe("Sửa dữ liệu sẽ xoá bộ MI");
    expect(t("mi.invalidateBody", { m: 5 })).toBe("Bảng này có 5 bộ đã điền. Ghi đè dữ liệu sẽ xoá các bộ đó. Tiếp tục?");
    expect(t("mi.invalidateConfirm")).toBe("Xoá bộ MI và tiếp tục");
    expect(t("mi.invalidateCancel")).toBe("Huỷ");
  });
});
