import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  RegressionDiagnosticsPanel,
  buildDiagnosticsTsv,
  type RegressionDiagnosticsPanelProps,
} from "../RegressionDiagnosticsPanel";
import { RegressionTab } from "../../tabs/RegressionTab";
import { setLocale, t } from "@/i18n";
import type { RegressionRun, RegressionRunResult } from "@/stores/useAnalysisStore";
import type {
  AssumptionRow,
  Dataset,
  DiagnosticsPayload,
  DiagnosticsPayloadOk,
} from "@/types";

// The panel owns judgment and actions; the charts are asserted in diagnosticsPlots.test.tsx.
vi.mock("../DiagnosticsPlots", () => ({
  DiagnosticsPlots: () => <div data-testid="regdiag-plots-stub" />,
}));

const copyButtonLabel = () => t("regDiag.copy");

function makeDataset(overrides: Partial<Dataset> = {}): Dataset {
  return {
    id: "ds_reg",
    name: "Regression Data",
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
    createdAt: "2026-11-04T00:00:00Z",
    updatedAt: "2026-11-04T00:00:00Z",
    ...overrides,
  };
}

const baseResult: RegressionRunResult = {
  coefficients: { "(Intercept)": 1.2345, X1: 3.4567, X2: 0.8912 },
  intercept: 1.2345,
  r2: 0.885,
  adjR2: 0.842,
  se: { "(Intercept)": 0.456, X1: 0.234, X2: 0.123 },
  tStat: { "(Intercept)": 2.707, X1: 14.772, X2: 7.245 },
  pValue: { "(Intercept)": 0.025, X1: 0.0001, X2: 0.0012 },
  ciLower: { "(Intercept)": 0.123, X1: 2.912, X2: 0.612 },
  ciUpper: { "(Intercept)": 2.345, X1: 4.001, X2: 1.17 },
  n: 350,
  df: 347,
  s2: 0.05,
  yName: "Y",
  xNames: ["X1", "X2"],
  rubinPooled: false,
  nInput: 412,
  nDropped: 62,
  missingMethod: "listwise",
};

function makeDiagnostics(
  overrides: Partial<DiagnosticsPayloadOk> = {}
): DiagnosticsPayloadOk {
  return {
    ok: true,
    errorCode: null,
    errorDetail: null,
    sample: {
      nInput: 412,
      nUsed: 350,
      nDropped: 62,
      method: "listwise",
      m: null,
      activeImputation: null,
    },
    obs: {
      rowIndex: [0, 1],
      fitted: [1, 2],
      resid: [0.1, -0.1],
      stdResid: [0.1, -0.1],
      studentized: [0.1, -0.1],
      leverage: [0.01, 0.02],
      cookD: [0.001, 0.002],
    },
    qq: { theoretical: [-1, 1], sample: [-0.9, 0.9] },
    assumptions: [
      {
        id: "linearity",
        applicable: true,
        verdict: "caution",
        stats: {
          bp: { chi2: 12.41, df: 3, p: 0.0061 },
          reset: { f: 2.1, df1: 1, df2: 344, p: 0.148 },
        },
      },
      {
        id: "normality",
        applicable: true,
        verdict: "pass",
        stats: { test: "shapiro", stat: 0.991, p: 0.412, skewness: -0.21, excessKurtosis: 0.34 },
      },
      {
        id: "influence",
        applicable: true,
        verdict: "violation",
        stats: {
          maxCookD: 1.42,
          nAbove4n: 3,
          maxLeverage: 0.19,
          leverageCut: 0.046,
          maxStudentized: 3.9,
          nStudentizedAbove3: 1,
        },
      },
      {
        id: "collinearity",
        applicable: true,
        verdict: "pass",
        stats: { maxVif: 2.31 },
      },
    ],
    vif: {
      X1: { vif: 1.82, tolerance: 0.55 },
      X2: { vif: 2.31, tolerance: 0.43 },
    },
    influential: [{ rowIndex: 87, cookD: 1.42, leverage: 0.11, studentized: 3.9 }],
    robustHC3: { se: {}, tStat: {}, pValue: {}, ciLower: {}, ciUpper: {} },
    sampled: false,
    ...overrides,
  };
}

function makeRun(
  resultOverrides: Partial<RegressionRunResult> = {},
  diagnostics: DiagnosticsPayload | undefined = makeDiagnostics()
): RegressionRun {
  return {
    datasetId: "ds_reg",
    datasetUpdatedAt: "2026-11-04T00:00:00Z",
    datasetRowCount: 4,
    yCol: "Y",
    xCols: ["X1", "X2"],
    activeImputationIndex: null,
    result: {
      ...baseResult,
      ...(diagnostics ? { diagnostics } : {}),
      ...resultOverrides,
    },
  };
}

function panelProps(overrides: Partial<RegressionDiagnosticsPanelProps> = {}): RegressionDiagnosticsPanelProps {
  return {
    run: makeRun(),
    selectedDatasetId: "ds_reg",
    submittedRows: 412,
    ...overrides,
  };
}

function renderPanel(props: RegressionDiagnosticsPanelProps): string {
  return renderToStaticMarkup(<RegressionDiagnosticsPanel {...props} />);
}

/** Render through a harness so the element tree can be searched for props. */
function capturePanel(props: RegressionDiagnosticsPanelProps): any {
  let captured: any = null;
  function Harness() {
    captured = RegressionDiagnosticsPanel(props);
    return captured;
  }
  renderToStaticMarkup(<Harness />);
  return captured;
}

function findByTestId(node: any, testId: string): any {
  if (!node || typeof node !== "object") return null;
  if (node.props?.["data-testid"] === testId) return node;
  const children = node.props?.children;
  const list = Array.isArray(children) ? children : [children];
  for (const child of list) {
    const found = findByTestId(child, testId);
    if (found) return found;
  }
  return null;
}

describe("Phase 4.1 Task 7: regression diagnostics panel", () => {
  beforeEach(() => {
    setLocale("en");
    vi.restoreAllMocks();
  });

  it("renders the four rows in fixed order with verdict, statistic, threshold, explanation and one action", () => {
    const html = renderPanel(panelProps());

    const order = ["linearity", "normality", "influence", "collinearity"].map((id) =>
      html.indexOf(`data-testid="regdiag-verdict-${id}"`)
    );
    expect(order.every((index) => index >= 0)).toBe(true);
    expect([...order].sort((a, b) => a - b)).toEqual(order);

    // Verdicts
    expect(html).toContain("Caution");
    expect(html).toContain("Violation");

    // Statistics
    expect(html).toContain("Breusch-Pagan χ²(3) = 12.4100, p = 0.0061");
    expect(html).toContain("RESET F(1, 344) = 2.1000, p = 0.1480");
    expect(html).toContain("Shapiro-Wilk W = 0.9910, p = 0.4120");
    expect(html).toContain("Skewness = -0.2100, excess kurtosis = 0.3400");
    expect(html).toContain("Largest Cook&#x27;s D = 1.4200");
    expect(html).toContain("largest |t| = 3.9000");
    expect(html).toContain("Largest VIF = 2.3100");

    // Thresholds come from the constants, not from literals in the UI.
    expect(html).toContain("BP p ≥ 0.05 and RESET p ≥ 0.05");
    expect(html).toContain("VIF &lt; 5; violation from 10");

    // One explanation sentence and exactly one action per applicable row.
    expect(html).toContain("One of the two tests shows a mild sign of non-linearity");
    expect(html).toContain("Reconsider the functional form");
    for (const id of ["linearity", "normality", "influence", "collinearity"]) {
      expect(html.split(`data-testid="regdiag-action-${id}"`).length - 1).toBe(1);
    }
  });

  it("renders the same section in Vietnamese", () => {
    setLocale("vi");
    const html = renderPanel(panelProps());

    expect(html).toContain("Kiểm định giả định hồi quy");
    expect(html).toContain("Cần lưu ý");
    expect(html).toContain("Vi phạm");
    expect(html).toContain("Tuyến tính và phương sai đồng nhất");
    expect(html).toContain("Đa cộng tuyến");
    expect(html).toContain("Mẫu của mô hình: dùng 350 / nộp 412 / loại 62 dòng (loại theo danh sách).");
  });

  it("renders an inapplicable row with the reason and no statistic or action", () => {
    const diagnostics = makeDiagnostics();
    const assumptions = [...diagnostics.assumptions];
    assumptions[3] = {
      id: "collinearity",
      applicable: false,
      notApplicableReason: "singlePredictor",
    };
    const html = renderPanel(
      panelProps({ run: makeRun({}, { ...diagnostics, assumptions, vif: {} }) })
    );

    expect(html).toContain('data-testid="regdiag-verdict-collinearity"');
    expect(html).toContain("Not applicable");
    expect(html).toContain("The model has a single predictor, so multicollinearity cannot exist.");
    expect(html).not.toContain('data-testid="regdiag-stat-collinearity"');
    expect(html).not.toContain('data-testid="regdiag-action-collinearity"');
  });

  it("shows the sample line in the collapsed state too", () => {
    const expanded = renderPanel(panelProps());
    expect(expanded).toContain(
      "Model sample: 350 used / 412 submitted / 62 dropped (listwise deletion)."
    );
    expect(expanded).toContain('data-testid="regdiag-table"');

    const collapsed = renderPanel(panelProps({ initialExpanded: false }));
    expect(collapsed).not.toContain('data-testid="regdiag-table"');
    expect(collapsed).toContain('data-testid="regdiag-sample"');
    expect(collapsed).toContain(
      "Model sample: 350 used / 412 submitted / 62 dropped (listwise deletion)."
    );
    expect(collapsed).toContain('data-testid="regdiag-chips"');
  });

  it("keeps the judged table's sample separate from the coefficients' sample under MICE index 0", () => {
    const diagnostics = makeDiagnostics({
      sample: {
        nInput: 412,
        nUsed: 350,
        nDropped: 62,
        method: "listwise",
        m: 3,
        activeImputation: 0,
      },
    });
    const run = makeRun(
      { n: 360, nInput: 412, nDropped: 52, missingMethod: "mice-active", rubinPooled: true },
      diagnostics
    );
    const html = renderPanel(panelProps({ run }));

    expect(html).toContain(
      "Model sample: 360 used / 412 submitted / 52 dropped (multiple imputation)."
    );
    expect(html).toContain('data-testid="regdiag-judged-sample"');
    expect(html).toContain(
      "Judged table sample: 350 used / 412 submitted / 62 dropped."
    );
    expect(html).toContain("The assumption checks describe the original data, not pooled inference.");
  });

  it("names the imputed dataset it judged when the active index is k", () => {
    const diagnostics = makeDiagnostics({
      sample: {
        nInput: 60,
        nUsed: 60,
        nDropped: 0,
        method: "mice-active",
        m: 5,
        activeImputation: 3,
      },
    });
    const run = makeRun(
      { n: 60, nInput: 60, nDropped: 0, missingMethod: "mice-active", rubinPooled: true },
      diagnostics
    );
    const html = renderPanel(panelProps({ run }));

    expect(html).toContain(
      "The assumption checks describe imputed dataset 3 of 5, not pooled inference."
    );
    expect(html).not.toContain('data-testid="regdiag-judged-sample"');
  });

  it("builds the exact tab-separated copy table", () => {
    const expected = [
      "Assumption\tStatistic\tThreshold\tVerdict",
      "Linearity and constant variance\tBreusch-Pagan χ²(3) = 12.4100, p = 0.0061; RESET F(1, 344) = 2.1000, p = 0.1480\tBP p ≥ 0.05 and RESET p ≥ 0.05\tCaution",
      "Residual normality\tShapiro-Wilk W = 0.9910, p = 0.4120; Skewness = -0.2100, excess kurtosis = 0.3400\tp ≥ 0.05; violation when p < 0.001 and |skewness| ≥ 1 or excess kurtosis ≥ 2\tPass",
      "Influential observations\tLargest Cook's D = 1.4200 (3 observations above 4/n); largest leverage = 0.1900 (cut-off 0.0460); largest |t| = 3.9000\tCook's D > 4/n or |t| > 3; violation when Cook's D > 1\tViolation",
      "Multicollinearity\tLargest VIF = 2.3100\tVIF < 5; violation from 10\tPass",
      "",
    ].join("\n");

    expect(buildDiagnosticsTsv(makeDiagnostics(), t)).toBe(expected);
  });

  it("writes the copy table to the clipboard without a toast", async () => {
    let clipboardText = "";
    Object.assign(navigator, {
      clipboard: {
        writeText: vi.fn(async (text: string) => {
          clipboardText = text;
        }),
      },
    });
    const showToast = vi.fn();

    const tree = capturePanel(panelProps());
    const copyButton = findByTestId(tree, "regdiag-copy");
    expect(copyButton).not.toBeNull();
    expect(String(copyButton.props.children)).toContain(copyButtonLabel().slice(0, 4));

    await copyButton.props.onClick();

    expect(clipboardText).toBe(buildDiagnosticsTsv(makeDiagnostics(), t));
    expect(showToast).not.toHaveBeenCalled();
  });

  it("renders no section when the run belongs to another dataset", () => {
    const html = renderPanel(panelProps({ selectedDatasetId: "ds_other" }));
    expect(html).toBe("");
  });

  describe("degraded states through the Regression tab", () => {
    function renderTab(resultOverrides: Partial<RegressionRunResult>, backendAvailable = true) {
      return renderToStaticMarkup(
        <RegressionTab
          selectedDataset={makeDataset()}
          analysisBackendAvailable={backendAvailable}
          showToast={vi.fn()}
          initialOlsYCol="Y"
          initialOlsXSelected={["X1", "X2"]}
          initialOlsResult={{ ...baseResult, n: 4, nInput: 4, nDropped: 0, df: 1, ...resultOverrides }}
        />
      );
    }

    it("states that the Python backend is required when the response has no diagnostics", () => {
      const html = renderTab({});
      expect(html).toContain('data-testid="regdiag-needs-backend"');
      expect(html).toContain("Assumption checks need the Python backend.");
      // The coefficient table still renders.
      expect(html).toContain("R² = 0.8850");
    });

    it("states it in client-only mode as well", () => {
      const html = renderTab({}, false);
      expect(html).toContain('data-testid="regdiag-needs-backend"');
      expect(html).toContain("R² = 0.8850");
    });

    for (const [code, text] of [
      ["insufficient_n", "does not have enough residual degrees of freedom"],
      ["singular_x", "diagnostics design matrix is singular"],
      ["not_available", "requested data table is not part of this request"],
      ["internal", "Something went wrong while computing the assumption checks"],
    ] as const) {
      it(`renders the ${code} failure in place with the coefficients intact`, () => {
        const html = renderTab({
          diagnostics: {
            ok: false,
            errorCode: code,
            errorDetail: "technical detail",
          },
        });
        expect(html).toContain(`data-testid="regdiag-error-${code}"`);
        expect(html).toContain(text);
        expect(html).toContain("The coefficients above are still valid; the assumption checks are unavailable.");
        expect(html).toContain("R² = 0.8850");
      });
    }
  });
});

// Keep the imported type used so the fixture shape stays checked by tsc.
const _assumptionTypeCheck: AssumptionRow = {
  id: "collinearity",
  applicable: false,
  notApplicableReason: "notComputable",
};
void _assumptionTypeCheck;
