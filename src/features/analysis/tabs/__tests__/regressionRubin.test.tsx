import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RegressionTab,
  reconstructImputedDatasets,
} from "../RegressionTab";
import * as quantisApi from "@/api";
import { setLocale, t } from "@/i18n";
import type { Dataset } from "@/types";
import type { OLSResult } from "@/utils/stats";

const mockBundleDataset: Dataset = {
  id: "ds_bundle_regression_test",
  name: "Survey Bundle Data",
  rows: 4,
  columns: 3,
  columnNames: ["Y", "X1", "X2"],
  preview: [
    ["Y", "X1", "X2"],
    ["10", "2", "5"],
    ["15", "", "7"],
    ["20", "4", "9"],
    ["25", "5", ""],
  ],
  data: [
    ["Y", "X1", "X2"],
    ["10", "2", "5"],
    ["15", "", "7"],
    ["20", "4", "9"],
    ["25", "5", ""],
  ],
  variables: {
    Y: { name: "Y", label: "Dependent Y", type: "numeric", measure: "scale", decimals: 2, align: "right" },
    X1: { name: "X1", label: "Predictor X1", type: "numeric", measure: "scale", decimals: 2, align: "right" },
    X2: { name: "X2", label: "Predictor X2", type: "numeric", measure: "scale", decimals: 2, align: "right" },
  },
  readOnly: true,
  imputationMeta: {
    bundleId: "bundle_reg_123",
    m: 3,
    activeImputationIndex: 0,
    imputedColumns: ["X1", "X2"],
    originalRows: [
      ["Y", "X1", "X2"],
      ["10", "2", "5"],
      ["15", "", "7"],
      ["20", "4", "9"],
      ["25", "5", ""],
    ],
    sparsePatches: {
      X1: [
        { rowIndex: 1, values: ["2.5", "2.8", "3.0"] },
      ],
      X2: [
        { rowIndex: 3, values: ["10.1", "10.5", "10.2"] },
      ],
    },
  },
  sourceFormat: "csv",
  createdAt: "2026-10-15T00:00:00Z",
  updatedAt: "2026-10-15T00:00:00Z",
};

const mockStandardDataset: Dataset = {
  id: "ds_standard_regression_test",
  name: "Standard Dataset",
  rows: 4,
  columns: 3,
  columnNames: ["Y", "X1", "X2"],
  preview: [
    ["Y", "X1", "X2"],
    ["10", "2", "5"],
    ["15", "3", "7"],
    ["20", "4", "9"],
    ["25", "5", "11"],
  ],
  data: [
    ["Y", "X1", "X2"],
    ["10", "2", "5"],
    ["15", "3", "7"],
    ["20", "4", "9"],
    ["25", "5", "11"],
  ],
  variables: {
    Y: { name: "Y", label: "Dependent Y", type: "numeric", measure: "scale", decimals: 2, align: "right" },
    X1: { name: "X1", label: "Predictor X1", type: "numeric", measure: "scale", decimals: 2, align: "right" },
    X2: { name: "X2", label: "Predictor X2", type: "numeric", measure: "scale", decimals: 2, align: "right" },
  },
  sourceFormat: "csv",
  createdAt: "2026-10-15T00:00:00Z",
  updatedAt: "2026-10-15T00:00:00Z",
};

const mockRubinOlsResult: OLSResult = {
  coefficients: {
    "(Intercept)": 1.2345,
    X1: 3.4567,
    X2: 0.8912,
  },
  intercept: 1.2345,
  r2: 0.885,
  adjR2: 0.842,
  se: {
    "(Intercept)": 0.456,
    X1: 0.234,
    X2: 0.123,
  },
  tStat: {
    "(Intercept)": 2.707,
    X1: 14.772,
    X2: 7.245,
  },
  pValue: {
    "(Intercept)": 0.025,
    X1: 0.0001,
    X2: 0.0012,
  },
  ciLower: {
    "(Intercept)": 0.123,
    X1: 2.912,
    X2: 0.612,
  },
  ciUpper: {
    "(Intercept)": 2.345,
    X1: 4.001,
    X2: 1.170,
  },
  n: 4,
  df: 1.0,
  s2: 0.05,
  yName: "Y",
  xNames: ["X1", "X2"],
  rubinPooled: true,
  rubinDf: {
    "(Intercept)": 2.4,
    X1: 2.1,
    X2: 2.8,
  },
  fmi: {
    "(Intercept)": 0.125,
    X1: 0.284,
    X2: 0.056,
  },
  withinVar: {
    "(Intercept)": 0.18,
    X1: 0.04,
    X2: 0.01,
  },
  betweenVar: {
    "(Intercept)": 0.02,
    X1: 0.01,
    X2: 0.003,
  },
};

describe("Task 6: Frontend Regression Tab - Hồi Quy Tuyến Tính Gộp Rubin", () => {
  beforeEach(() => {
    setLocale("vi");
    vi.restoreAllMocks();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. reconstructs m tables from imputationMeta Sparse Delta accurately", () => {
    const tables = reconstructImputedDatasets(mockBundleDataset);
    expect(tables).toHaveLength(3);

    // Table 1 (m=1): X1[1] should be 2.5, X2[3] should be 10.1
    expect(tables[0][2][1]).toBe("2.5");
    expect(tables[0][4][2]).toBe("10.1");

    // Table 2 (m=2): X1[1] should be 2.8, X2[3] should be 10.5
    expect(tables[1][2][1]).toBe("2.8");
    expect(tables[1][4][2]).toBe("10.5");

    // Table 3 (m=3): X1[1] should be 3.0, X2[3] should be 10.2
    expect(tables[2][2][1]).toBe("3.0");
    expect(tables[2][4][2]).toBe("10.2");

    // Non-missing values remain intact
    expect(tables[0][1][0]).toBe("10");
    expect(tables[1][1][1]).toBe("2");
    expect(tables[2][1][2]).toBe("5");
  });

  it("2. displays MICE bundle banner with Rubin pooling notice when dataset has imputationMeta", () => {
    const htmlVi = renderToStaticMarkup(
      <RegressionTab
        selectedDataset={mockBundleDataset}
        analysisBackendAvailable={true}
        showToast={vi.fn()}
      />
    );

    expect(htmlVi).toContain("Đa nhập liệu MICE (m=3): Kết quả hồi quy OLS sẽ tự động áp dụng quy tắc gộp Rubin.");

    // English locale
    setLocale("en");
    const htmlEn = renderToStaticMarkup(
      <RegressionTab
        selectedDataset={mockBundleDataset}
        analysisBackendAvailable={true}
        showToast={vi.fn()}
      />
    );
    expect(htmlEn).toContain("MICE Multiple Imputation (m=3)");
    expect(htmlEn).toContain("Rubin&#x27;s pooling rules");

    // When dataset does NOT have imputationMeta, banner is not rendered
    const htmlStandard = renderToStaticMarkup(
      <RegressionTab
        selectedDataset={mockStandardDataset}
        analysisBackendAvailable={true}
        showToast={vi.fn()}
      />
    );
    expect(htmlStandard).not.toContain("MICE Multiple Imputation");
    expect(htmlStandard).not.toContain("Đa nhập liệu MICE");
  });

  it("3. sends reconstructed m datasets to analyzeOLS API when clicking Run OLS on a MICE Bundle", async () => {
    const analyzeSpy = vi.spyOn(quantisApi, "analyzeOLS").mockResolvedValue(mockRubinOlsResult);

    let rendered: any = null;
    function Harness() {
      rendered = RegressionTab({
        selectedDataset: mockBundleDataset,
        analysisBackendAvailable: true,
        showToast: vi.fn(),
        initialOlsYCol: "Y",
        initialOlsXSelected: ["X1", "X2"],
      });
      return rendered;
    }
    renderToStaticMarkup(<Harness />);

    // Collect buttons
    const buttons: any[] = [];
    function collect(node: any) {
      if (!node) return;
      if (node.type === "button") buttons.push(node);
      if (node.props?.children) {
        const ch = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
        ch.forEach(collect);
      }
    }
    collect(rendered);

    const runBtn = buttons.find((b) =>
      String(b.props?.children).includes(t("regressionExplainer.runOlsButton"))
    );
    expect(runBtn).toBeDefined();

    await runBtn.props.onClick();

    expect(analyzeSpy).toHaveBeenCalledTimes(1);
    const callArgs = analyzeSpy.mock.calls[0];
    expect(callArgs[0]).toBeDefined(); // rows
    expect(callArgs[1]).toBe("Y"); // yCol
    expect(callArgs[2]).toEqual(["X1", "X2"]); // xCols
    expect(callArgs[3]).toHaveLength(3); // 3 reconstructed tables from bundle
  });

  it("4. renders Rubin columns (df, FMI %) and Barnard-Rubin footnote when olsResult.rubinPooled is true", () => {
    const html = renderToStaticMarkup(
      <RegressionTab
        selectedDataset={mockBundleDataset}
        analysisBackendAvailable={true}
        showToast={vi.fn()}
        initialOlsYCol="Y"
        initialOlsXSelected={["X1", "X2"]}
        initialOlsResult={mockRubinOlsResult}
      />
    );

    // Headers
    expect(html).toContain("df (Rubin)");
    expect(html).toContain("FMI (%)");

    // Values for (Intercept)
    expect(html).toContain("2.4"); // rubinDf
    expect(html).toContain("12.5%"); // fmi 0.125 * 100

    // Values for X1
    expect(html).toContain("2.1"); // rubinDf
    expect(html).toContain("28.4%"); // fmi 0.284 * 100

    // Values for X2
    expect(html).toContain("2.8"); // rubinDf
    expect(html).toContain("5.6%"); // fmi 0.056 * 100

    // Footnote explaining Barnard-Rubin (1999)
    expect(html).toContain("Barnard &amp; Rubin (1999)");
  });

  it("5. formats Rubin columns into TSV when clicking copy table button", async () => {
    let clipboardText = "";
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async (text: string) => {
          clipboardText = text;
        }),
      },
    });

    let rendered: any = null;
    function Harness() {
      rendered = RegressionTab({
        selectedDataset: mockBundleDataset,
        analysisBackendAvailable: true,
        showToast: vi.fn(),
        initialOlsYCol: "Y",
        initialOlsXSelected: ["X1", "X2"],
        initialOlsResult: mockRubinOlsResult,
      });
      return rendered;
    }
    renderToStaticMarkup(<Harness />);

    const buttons: any[] = [];
    function collect(node: any) {
      if (!node) return;
      if (node.type === "button") buttons.push(node);
      if (node.props?.children) {
        const ch = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
        ch.forEach(collect);
      }
    }
    collect(rendered);

    const copyBtn = buttons.find((b) =>
      String(b.props?.children).includes(t("regressionExplainer.copyTableButton"))
    );
    expect(copyBtn).toBeDefined();

    copyBtn.props.onClick();

    expect(clipboardText).toContain("df (Rubin)");
    expect(clipboardText).toContain("FMI (%)");
    expect(clipboardText).toContain("2.4\t12.5%");
    expect(clipboardText).toContain("2.1\t28.4%");
    expect(clipboardText).toContain("2.8\t5.6%");
  });

  it("6. displays active set note in other models (Logistic, Poisson, Ridge) when dataset is a MICE Bundle", () => {
    // Dataset with binary column for logistic
    const bundleWithBinary: Dataset = {
      ...mockBundleDataset,
      columnNames: ["Y", "X1", "X2", "BinaryY"],
      data: [
        ["Y", "X1", "X2", "BinaryY"],
        ["10", "2", "5", "0"],
        ["15", "3", "7", "1"],
        ["20", "4", "9", "0"],
        ["25", "5", "11", "1"],
      ],
      preview: [
        ["Y", "X1", "X2", "BinaryY"],
        ["10", "2", "5", "0"],
        ["15", "3", "7", "1"],
        ["20", "4", "9", "0"],
        ["25", "5", "11", "1"],
      ],
      variables: {
        ...mockBundleDataset.variables,
        BinaryY: { name: "BinaryY", label: "Binary Y", type: "numeric", measure: "nominal", decimals: 0, align: "center" },
      },
    };

    const htmlVi = renderToStaticMarkup(
      <RegressionTab
        selectedDataset={bundleWithBinary}
        analysisBackendAvailable={true}
        showToast={vi.fn()}
      />
    );

    // Note should mention Bộ 0 and that Rubin pooling currently applies to OLS
    expect(htmlVi).toContain("Phân tích trên bộ dữ liệu đang hiển thị (Bộ 0). Quy tắc Rubin hiện áp dụng cho OLS.");

    // English check
    setLocale("en");
    const htmlEn = renderToStaticMarkup(
      <RegressionTab
        selectedDataset={bundleWithBinary}
        analysisBackendAvailable={true}
        showToast={vi.fn()}
      />
    );
    expect(htmlEn).toContain("Analysis on currently displayed dataset (Set 0)");
    expect(htmlEn).toContain("Rubin&#x27;s rules currently apply to OLS");
  });
});
