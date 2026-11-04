import { describe, it, expect, beforeEach } from "vitest";
import { t, setLocale } from "../../i18n";
import { EXTRA_EN, EXTRA_VI } from "../../i18n-extra";

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

  describe("Compute & Recode i18n keys", () => {
    const requiredKeys = [
      "transformTab.computeHint",
      "transformTab.recodeTargetMode",
      "transformTab.recodeTargetSame",
      "transformTab.recodeTargetDifferent",
      "transformTab.recodeNewColLabel",
      "transformTab.recodeNewColPlaceholder",
      "transformTab.recodeNewColErrorEmpty",
      "transformTab.recodeNewColErrorDuplicate",
      "transformTab.recodeTypeValue",
      "transformTab.recodeTypeRange",
      "transformTab.recodeFromPlaceholder",
      "transformTab.recodeMinPlaceholder",
      "transformTab.recodeMaxPlaceholder",
      "transformTab.recodeToPlaceholder",
      "transformTab.recodeElseToggle",
      "transformTab.recodeElseActionCopy",
      "transformTab.recodeElseActionSysmis",
      "transformTab.recodeElseActionCustom",
      "transformTab.recodeElseCustomPlaceholder",
      "transformTab.recodeAddRule",
      "transformTab.recodeDeleteRule",
      "transformTab.resultRecode",
      "transformTab.suffixRecode",
    ];

    it("has all keys defined in both English and Vietnamese", () => {
      for (const key of requiredKeys) {
        setLocale("en");
        const enVal = t(key);
        expect(enVal, `Missing English key: ${key}`).not.toBe(key);

        setLocale("vi");
        const viVal = t(key);
        expect(viVal, `Missing Vietnamese key: ${key}`).not.toBe(key);
      }
    });

    it("includes MEDIAN and SD in computeHint", () => {
      setLocale("en");
      expect(t("transformTab.computeHint")).toContain("median");
      expect(t("transformTab.computeHint")).toContain("sd");

      setLocale("vi");
      expect(t("transformTab.computeHint")).toContain("median");
      expect(t("transformTab.computeHint")).toContain("sd");
    });

    it("interpolates resultRecode correctly", () => {
      setLocale("en");
      expect(t("transformTab.resultRecode", { recoded: 5, total: 10 })).toContain("5");
      expect(t("transformTab.resultRecode", { recoded: 5, total: 10 })).toContain("10");

      setLocale("vi");
      expect(t("transformTab.resultRecode", { recoded: 5, total: 10 })).toContain("5");
      expect(t("transformTab.resultRecode", { recoded: 5, total: 10 })).toContain("10");
    });
  });

  describe("Aggregation Engine i18n keys", () => {
    const requiredKeys = [
      "presentationView.aggregationLabel",
      "presentationView.aggLabel.mean",
      "presentationView.aggLabel.sum",
      "presentationView.aggLabel.count",
      "presentationView.aggLabel.median",
      "presentationView.aggLabel.std",
      "presentationView.aggLabel.min",
      "presentationView.aggLabel.max",
      "presentationView.ofPreposition",
      "presentationView.aggTooltipSampleSize",
      "presentationView.aggTooltipStd",
      "presentationView.contextAggregationLabel",
    ];

    it("has all aggregation keys defined in both English and Vietnamese", () => {
      for (const key of requiredKeys) {
        setLocale("en");
        const enVal = t(key);
        expect(enVal, `Missing English key: ${key}`).not.toBe(key);

        setLocale("vi");
        const viVal = t(key);
        expect(viVal, `Missing Vietnamese key: ${key}`).not.toBe(key);
      }
    });

    it("verifies accurate translation values for aggregation keys", () => {
      setLocale("en");
      expect(t("presentationView.aggregationLabel")).toBe("Aggregation");
      expect(t("presentationView.aggLabel.mean")).toBe("Mean");
      expect(t("presentationView.aggLabel.sum")).toBe("Sum");
      expect(t("presentationView.aggLabel.count")).toBe("Count");
      expect(t("presentationView.aggLabel.median")).toBe("Median");
      expect(t("presentationView.aggLabel.std")).toBe("Std Dev");
      expect(t("presentationView.aggLabel.min")).toBe("Min");
      expect(t("presentationView.aggLabel.max")).toBe("Max");
      expect(t("presentationView.ofPreposition")).toBe("of");
      expect(t("presentationView.aggTooltipSampleSize")).toBe("n");
      expect(t("presentationView.aggTooltipStd")).toBe("s");
      expect(t("presentationView.contextAggregationLabel")).toBe("Aggregation:");

      setLocale("vi");
      expect(t("presentationView.aggregationLabel")).toBe("Phép gộp");
      expect(t("presentationView.aggLabel.mean")).toBe("Trung bình");
      expect(t("presentationView.aggLabel.sum")).toBe("Tổng");
      expect(t("presentationView.aggLabel.count")).toBe("Đếm");
      expect(t("presentationView.aggLabel.median")).toBe("Trung vị");
      expect(t("presentationView.aggLabel.std")).toBe("Độ lệch chuẩn");
      expect(t("presentationView.aggLabel.min")).toBe("Nhỏ nhất");
      expect(t("presentationView.aggLabel.max")).toBe("Lớn nhất");
      expect(t("presentationView.ofPreposition")).toBe("của");
      expect(t("presentationView.aggTooltipSampleSize")).toBe("n");
      expect(t("presentationView.aggTooltipStd")).toBe("s");
      expect(t("presentationView.contextAggregationLabel")).toBe("Phép gộp:");
    });
  });

  describe("Academic Visualization Suite i18n keys", () => {
    const vizKeys = [
      "presentationView.inspectorTitle",
      "presentationView.accordionData",
      "presentationView.accordionOptions",
      "presentationView.accordionStyle",
      "presentationView.accordionErrorBars",
      "presentationView.accordionLabels",
      "presentationView.accordionExport",
      "presentationView.legendLabel",
      "presentationView.noneOption",
      "presentationView.barModeLabel",
      "presentationView.barModeClustered",
      "presentationView.barModeStacked",
      "presentationView.errorBarLabel",
      "presentationView.errorBarNone",
      "presentationView.errorBarCi95",
      "presentationView.errorBarSe",
      "presentationView.errorBarSd",
      "presentationView.errorBarMeanOnlyNotice",
      "presentationView.showDataLabelsLabel",
      "presentationView.decimalsLabel",
      "presentationView.titleOverrideLabel",
      "presentationView.titleOverridePlaceholder",
      "presentationView.subtitleLabel",
      "presentationView.subtitlePlaceholder",
      "presentationView.autoTitleMeanOf",
      "presentationView.autoTitleBy",
      "presentationView.autoTitleAnd",
      "presentationView.paletteLabel",
      "presentationView.paletteAcademic",
      "presentationView.paletteColorblind",
      "presentationView.paletteGrayscale",
    ];

    it("has all visualization suite keys defined in both English and Vietnamese", () => {
      for (const key of vizKeys) {
        setLocale("en");
        const enVal = t(key);
        expect(enVal, `Missing English key: ${key}`).not.toBe(key);

        setLocale("vi");
        const viVal = t(key);
        expect(viVal, `Missing Vietnamese key: ${key}`).not.toBe(key);
      }
    });
  });

  describe("Task 2: Smart Titles i18n Dictionary", () => {    const autoTitleKeys = [
      "presentationView.autoTitlePieCategorical",
      "presentationView.autoTitlePieBinned",
      "presentationView.autoTitleHistogram",
      "presentationView.autoTitleBox",
      "presentationView.autoTitleArea",
      "presentationView.autoTitleDensityGrouped",
      "presentationView.autoTitleDensitySingle",
      "presentationView.autoTitleHeatmap",
      "presentationView.autoTitleRadarGrouped",
      "presentationView.autoTitleRadarNoGroup",
    ];

    it("has all smart title template keys defined in both English and Vietnamese with 100% parity", () => {
      for (const key of autoTitleKeys) {
        setLocale("en");
        const enVal = t(key);
        expect(enVal, `Missing English key: ${key}`).not.toBe(key);

        setLocale("vi");
        const viVal = t(key);
        expect(viVal, `Missing Vietnamese key: ${key}`).not.toBe(key);
      }
    });

    it("verifies accurate translations and parameter interpolation for all smart title templates", () => {
      // English
      setLocale("en");
      expect(t("presentationView.autoTitlePieCategorical", { x: "Department" })).toBe("Distribution of Department");
      expect(t("presentationView.autoTitlePieBinned", { col: "Score" })).toBe("Distribution of Score (Binned)");
      expect(t("presentationView.autoTitleHistogram", { col: "Score" })).toBe("Frequency Distribution of Score");
      expect(t("presentationView.autoTitleBox", { x: "Department", y: "Score" })).toBe("Distribution of Score by Department");
      expect(t("presentationView.autoTitleArea", { x: "Department", y: "Score" })).toBe("Score by Department");
      expect(t("presentationView.autoTitleDensityGrouped", { x: "Department", y: "Score" })).toBe("Density Estimation of Score by Department");
      expect(t("presentationView.autoTitleDensitySingle", { y: "Score" })).toBe("Density Estimation of Score");
      expect(t("presentationView.autoTitleHeatmap", { method: "Pearson" })).toBe("Pearson Correlation Matrix");
      expect(t("presentationView.autoTitleRadarGrouped", { group: "Department" })).toBe("Radar Profile by Department");
      expect(t("presentationView.autoTitleRadarNoGroup")).toBe("Multi-axis Radar Chart");

      // Vietnamese
      setLocale("vi");
      expect(t("presentationView.autoTitlePieCategorical", { x: "Phòng ban" })).toBe("Phân phối của Phòng ban");
      expect(t("presentationView.autoTitlePieBinned", { col: "Điểm" })).toBe("Phân phối theo khoảng Điểm");
      expect(t("presentationView.autoTitleHistogram", { col: "Điểm" })).toBe("Phân phối tần số Điểm");
      expect(t("presentationView.autoTitleBox", { x: "Phòng ban", y: "Điểm" })).toBe("Phân phối Điểm theo Phòng ban");
      expect(t("presentationView.autoTitleArea", { x: "Phòng ban", y: "Điểm" })).toBe("Điểm theo Phòng ban");
      expect(t("presentationView.autoTitleDensityGrouped", { x: "Phòng ban", y: "Điểm" })).toBe("Ước lượng mật độ Điểm theo Phòng ban");
      expect(t("presentationView.autoTitleDensitySingle", { y: "Điểm" })).toBe("Ước lượng mật độ Điểm");
      expect(t("presentationView.autoTitleHeatmap", { method: "Pearson" })).toBe("Ma trận tương quan Pearson");
      expect(t("presentationView.autoTitleRadarGrouped", { group: "Phòng ban" })).toBe("Hồ sơ đa chiều theo Phòng ban");
      expect(t("presentationView.autoTitleRadarNoGroup")).toBe("Biểu đồ radar đa chiều");
    });
  });

  describe("Phase 4.1 regression diagnostics i18n", () => {
    const REGDIAG_KEYS = [
      "title",
      "expand",
      "collapse",
      "copy",
      "notApplicable",
      "needsBackend",
      "unavailable",
      "stale",
      "staleJump",
      "failureConsequence",
      "modelLine",
      "sampleLine",
      "method.listwise",
      "method.miceActive",
      "miceLine",
      "miceOriginalLine",
      "judgedSampleLine",
      "judgedSampleDiffers",
      "table.assumption",
      "table.statistic",
      "table.threshold",
      "table.verdict",
      "table.action",
      "verdict.pass",
      "verdict.caution",
      "verdict.violation",
      "row.linearity",
      "row.normality",
      "row.influence",
      "row.collinearity",
      "explain.linearity.pass",
      "explain.linearity.caution",
      "explain.linearity.violation",
      "explain.normality.pass",
      "explain.normality.caution",
      "explain.normality.violation",
      "explain.influence.pass",
      "explain.influence.caution",
      "explain.influence.violation",
      "explain.collinearity.pass",
      "explain.collinearity.caution",
      "explain.collinearity.violation",
      "threshold.linearity",
      "threshold.normality",
      "threshold.influence",
      "threshold.collinearity",
      "action.linearity",
      "action.normality",
      "action.influence",
      "action.influenceNone",
      "action.collinearity",
      "error.insufficient_n",
      "error.singular_x",
      "error.not_available",
      "error.internal",
      "reason.singlePredictor",
      "reason.insufficientDf",
      "reason.notComputable",
      "stat.bp",
      "stat.reset",
      "stat.shapiro",
      "stat.jarqueBera",
      "stat.skewness",
      "stat.influence",
      "stat.collinearity",
      "stat.unavailable",
      "plot.residVsFitted",
      "plot.qq",
      "plot.cooks",
      "plot.axisFitted",
      "plot.axisResid",
      "plot.axisTheoretical",
      "plot.axisSample",
      "plot.axisObservation",
      "plot.axisCookD",
      "plot.sampled",
      "plot.cooksCut",
      "copy.assumption",
      "copy.statistic",
      "copy.threshold",
      "copy.verdict",
      "hc3.toggle",
      "hc3.classical",
      "hc3.pooledNote",
      "hc3.columnSe",
      "hc3.columnT",
      "hc3.columnP",
      "influential.heading",
      "influential.row",
      "influential.more",
    ];

    const GLOSSARY_TERMS = [
      "bpTest",
      "resetTest",
      "cooksDistance",
      "leverage",
      "studentizedResidual",
      "hc3",
      "qqPlot",
      "assumptionCheck",
    ];

    it("defines every regDiag key in both locales with a non-empty value", () => {
      for (const key of REGDIAG_KEYS) {
        const full = `regDiag.${key}`;
        expect(typeof EXTRA_EN[full], `missing English key: ${full}`).toBe("string");
        expect(typeof EXTRA_VI[full], `missing Vietnamese key: ${full}`).toBe("string");
        expect(EXTRA_EN[full].trim().length, `empty English key: ${full}`).toBeGreaterThan(0);
        expect(EXTRA_VI[full].trim().length, `empty Vietnamese key: ${full}`).toBeGreaterThan(0);
      }
    });

    it("has no regDiag key present in only one locale", () => {
      const english = new Set(Object.keys(EXTRA_EN).filter((k) => k.startsWith("regDiag.")));
      const vietnamese = new Set(Object.keys(EXTRA_VI).filter((k) => k.startsWith("regDiag.")));

      expect([...english].filter((k) => !vietnamese.has(k))).toEqual([]);
      expect([...vietnamese].filter((k) => !english.has(k))).toEqual([]);
    });

    it("interpolates the numeric thresholds instead of hardcoding them", () => {
      expect(EXTRA_EN["regDiag.threshold.linearity"]).toContain("{pass}");
      expect(EXTRA_EN["regDiag.threshold.normality"]).toContain("{violationP}");
      expect(EXTRA_EN["regDiag.threshold.normality"]).toContain("{skew}");
      expect(EXTRA_EN["regDiag.threshold.influence"]).toContain("{relative}");
      expect(EXTRA_EN["regDiag.threshold.influence"]).toContain("{studentized}");
      expect(EXTRA_EN["regDiag.threshold.collinearity"]).toContain("{caution}");
      expect(EXTRA_EN["regDiag.threshold.collinearity"]).toContain("{violation}");
      expect(EXTRA_VI["regDiag.threshold.linearity"]).toContain("{pass}");
      expect(EXTRA_VI["regDiag.threshold.collinearity"]).toContain("{violation}");
    });

    it("resolves every regDiag key through t() in both locales", () => {
      for (const key of REGDIAG_KEYS) {
        const full = `regDiag.${key}`;
        setLocale("en");
        expect(t(full), `unresolved English key: ${full}`).not.toBe(full);
        setLocale("vi");
        expect(t(full), `unresolved Vietnamese key: ${full}`).not.toBe(full);
      }
    });

    it("defines the eight new glossary terms with title and text in both locales", () => {
      for (const term of GLOSSARY_TERMS) {
        const title = `glossary.${term}.title`;
        const text = `glossary.${term}.text`;
        for (const key of [title, text]) {
          expect(typeof EXTRA_EN[key], `missing English key: ${key}`).toBe("string");
          expect(typeof EXTRA_VI[key], `missing Vietnamese key: ${key}`).toBe("string");
          expect(EXTRA_EN[key].trim().length, `empty English key: ${key}`).toBeGreaterThan(0);
          expect(EXTRA_VI[key].trim().length, `empty Vietnamese key: ${key}`).toBeGreaterThan(0);
        }
      }
    });
  });
});
