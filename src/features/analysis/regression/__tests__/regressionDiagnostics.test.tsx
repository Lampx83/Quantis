import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReactElement } from "react";
import {
  RegressionDiagnosticsPanel,
  InfluenceAction,
  buildDiagnosticsTsv,
  requestDiagnosticsRowFocus,
  type RegressionDiagnosticsPanelProps,
} from "../RegressionDiagnosticsPanel";
import { RegressionTab } from "../../tabs/RegressionTab";
import * as quantisApi from "@/api";
import { useUIStore } from "@/stores/useUIStore";
import { useAnalysisStore } from "@/stores/useAnalysisStore";
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
    robustHC3: {
      se: { "(Intercept)": 0.5, X1: 0.25, X2: 0.15 },
      tStat: { "(Intercept)": 2.1, X1: 3.2, X2: 1.4 },
      pValue: { "(Intercept)": 0.04, X1: 0.002, X2: 0.16 },
      ciLower: { "(Intercept)": 0.1, X1: 1.2, X2: 0.1 },
      ciUpper: { "(Intercept)": 2.0, X1: 3.9, X2: 1.0 },
    },
    thresholds: {
      linearityAlpha: 0.05,
      normalityAlpha: 0.05,
      normalityViolationAlpha: 0.001,
      normalitySkewGuard: 1,
      normalityExcessKurtosisGuard: 2,
      vifCaution: 5,
      vifViolation: 10,
      cookAbsolute: 1,
      cookRelativeMultiplier: 4,
      studentized: 3,
    },
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

function captureElement(element: ReactElement): any {
  let captured: any = null;
  function Harness() {
    captured = (element.type as (props: unknown) => unknown)(element.props);
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
    useAnalysisStore.setState({ regressionRun: null });
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

    expect(html).toContain("Chẩn đoán &amp; giả định hồi quy");
    expect(html).toContain("Cần lưu ý");
    expect(html).toContain("Vi phạm");
    expect(html).toContain("Tuyến tính và phương sai đồng nhất");
    expect(html).toContain("Đa cộng tuyến");
    expect(html).toContain("350/412 dòng được dùng, 62 dòng bị bỏ (loại theo danh sách)");
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
      "350 of 412 rows used, 62 excluded (listwise deletion)"
    );
    expect(expanded).toContain('data-testid="regdiag-table"');

    const collapsed = renderPanel(panelProps({ initialExpanded: false }));
    expect(collapsed).not.toContain('data-testid="regdiag-table"');
    expect(collapsed).toContain('data-testid="regdiag-sample"');
    expect(collapsed).toContain(
      "350 of 412 rows used, 62 excluded (listwise deletion)"
    );
    expect(collapsed).toContain('data-testid="regdiag-chips"');
  });

  it("shows an explicit disclosure label and keeps the worst verdict visible when collapsed", () => {
    const expanded = renderPanel(panelProps());
    expect(expanded).toContain('data-testid="regdiag-toggle"');
    expect(expanded).toContain(t("regDiag.collapse"));
    expect(expanded).not.toContain("border-l-red-500");

    // The fixture's worst applicable verdict is the influence violation.
    const collapsed = renderPanel(panelProps({ initialExpanded: false }));
    expect(collapsed).toContain(t("regDiag.expand"));
    expect(collapsed).toContain("border-l-red-500");
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
      "360 of 412 rows used, 52 excluded (multiple imputation)"
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

  it("switches to the data view and posts the run's dataset with the observation row", () => {
    useUIStore.setState({
      rowFocus: null,
      mainSection: "analysis",
      dataTab: "transform",
      dataEditorView: "variable",
    });

    const tree = captureElement(
      <InfluenceAction
        diagnostics={makeDiagnostics()}
        stale={false}
        onJumpToRow={(rowIndex) => requestDiagnosticsRowFocus("ds_reg", rowIndex)}
      />
    );
    const jump = findByTestId(tree, "regdiag-jump-influence");
    expect(jump).not.toBeNull();
    jump.props.onClick();

    const state = useUIStore.getState();
    expect(state.mainSection).toBe("data");
    // Only the Preview tab mounts the grid that consumes the request.
    expect(state.dataTab).toBe("preview");
    expect(state.dataEditorView).toBe("data");
    expect(state.rowFocus).toEqual({ datasetId: "ds_reg", rowIndex: 87, nonce: 1 });
  });

  it("increments the request nonce on a repeat jump to the same row", () => {
    useUIStore.setState({ rowFocus: null });
    requestDiagnosticsRowFocus("ds_reg", 87);
    requestDiagnosticsRowFocus("ds_reg", 87);

    expect(useUIStore.getState().rowFocus?.nonce).toBe(2);
  });

  it("disables the jump on a stale run", () => {
    const html = renderPanel(panelProps({ stale: true }));
    const buttonTag =
      html.match(/<button[^>]*data-testid="regdiag-jump-influence"[^>]*>/)?.[0] ?? "";

    expect(buttonTag).toContain("disabled");
    expect(html).toContain('data-testid="regdiag-stale"');
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

  describe("staleness and hydration", () => {
    function storedRun(overrides: Partial<RegressionRun> = {}): RegressionRun {
      return {
        datasetId: "ds_reg",
        datasetUpdatedAt: "2026-11-04T00:00:00Z",
        datasetRowCount: 4,
        yCol: "Y",
        xCols: ["X1", "X2"],
        activeImputationIndex: null,
        result: {
          ...baseResult,
          n: 4,
          nInput: 4,
          nDropped: 0,
          df: 1,
          diagnostics: makeDiagnostics(),
        },
        ...overrides,
      };
    }

    function renderHydrated(dataset = makeDataset()): string {
      return renderToStaticMarkup(
        <RegressionTab
          selectedDataset={dataset}
          analysisBackendAvailable={true}
          showToast={vi.fn()}
        />
      );
    }

    it("hydrates the last run when the tab remounts on the same dataset", () => {
      useAnalysisStore.setState({ regressionRun: storedRun() });

      const html = renderHydrated();

      expect(html).toContain('data-testid="regdiag-section"');
      expect(html).toContain('data-testid="regdiag-verdict-influence"');
      expect(html).toContain("Model: Y ~ X1, X2");
      expect(html).toContain("R² = 0.8850");
    });

    it("never hydrates a run that belongs to another dataset", () => {
      useAnalysisStore.setState({ regressionRun: storedRun({ datasetId: "ds_other" }) });

      const html = renderHydrated();

      expect(html).not.toContain('data-testid="regdiag-section"');
    });

    it("labels a run stale when the data changed, keeping its numbers and the HC3 toggle", () => {
      useAnalysisStore.setState({ regressionRun: storedRun() });

      const html = renderHydrated(makeDataset({ updatedAt: "2026-11-05T00:00:00Z" }));

      expect(html).toContain('data-testid="regdiag-stale"');
      expect(html).toContain('data-testid="regdiag-table"');
      // The run's own numbers and plots are unchanged.
      expect(html).toContain("Breusch-Pagan χ²(3) = 12.4100, p = 0.0061");
      expect(html).toContain('data-testid="regdiag-plots-stub"');
      // HC3 stays available; only navigation into the changed data is blocked.
      expect(html).toContain('data-testid="regdiag-hc3-toggle"');
      const buttonTag =
        html.match(/<button[^>]*data-testid="regdiag-jump-influence"[^>]*>/)?.[0] ?? "";
      expect(buttonTag).toContain("disabled");
    });

    it("labels a run stale when the row count changed", () => {
      useAnalysisStore.setState({ regressionRun: storedRun({ datasetRowCount: 3 }) });

      const html = renderHydrated();

      expect(html).toContain('data-testid="regdiag-stale"');
    });

    it("uses the original submitted row count when reopening a stale run without backend accounting", () => {
      useAnalysisStore.setState({
        regressionRun: storedRun({
          datasetRowCount: 8,
          result: { ...baseResult, n: 7, nInput: undefined, nDropped: undefined, diagnostics: undefined },
        }),
      });

      const html = renderHydrated();

      expect(html).toContain('data-testid="regdiag-stale"');
      expect(html).toContain("7 of 8 rows used, 1 excluded (listwise deletion)");
    });
  });

  describe("HC3 robust standard errors", () => {
    function renderTab(
      resultOverrides: Partial<RegressionRunResult> = {},
      options: { backendAvailable?: boolean; hc3Enabled?: boolean } = {}
    ) {
      return renderToStaticMarkup(
        <RegressionTab
          selectedDataset={makeDataset()}
          analysisBackendAvailable={options.backendAvailable ?? true}
          showToast={vi.fn()}
          initialOlsYCol="Y"
          initialOlsXSelected={["X1", "X2"]}
          initialOlsResult={{
            ...baseResult,
            n: 4,
            nInput: 4,
            nDropped: 0,
            df: 1,
            diagnostics: makeDiagnostics(),
            ...resultOverrides,
          }}
          initialHc3Enabled={options.hc3Enabled}
        />
      );
    }

    it("offers the toggle on a single-table fit and shows the robust columns side by side when on", () => {
      const off = renderTab();
      expect(off).toContain('data-testid="regdiag-hc3-toggle"');
      expect(off).not.toContain("HC3 SE");

      const on = renderTab({}, { hc3Enabled: true });
      expect(on).toContain("HC3 SE");
      expect(on).toContain("HC3 t");
      expect(on).toContain("HC3 p");
      // Classical columns are still beside them.
      expect(on).toContain("SE");
      expect(on).toContain("HC3 SE");
      // Robust values for the intercept and every predictor.
      expect(on).toContain(">0.5000<"); // intercept HC3 SE
      expect(on).toContain(">0.2500<"); // X1 HC3 SE
      expect(on).toContain(">3.200<"); // X1 HC3 t
      expect(on).toContain(">0.002<"); // X1 HC3 p
    });

    it("is absent when diagnostics are missing or failed", () => {
      const missing = renderTab({ diagnostics: undefined });
      expect(missing).not.toContain('data-testid="regdiag-hc3-toggle"');
      expect(missing).not.toContain("HC3 SE");

      const failed = renderTab({
        diagnostics: { ok: false, errorCode: "internal", errorDetail: null },
      });
      expect(failed).not.toContain('data-testid="regdiag-hc3-toggle"');
      expect(failed).not.toContain("HC3 SE");
    });

    it("is absent on a Rubin-pooled run, which says in one line why", () => {
      const html = renderTab({ rubinPooled: true });

      expect(html).not.toContain('data-testid="regdiag-hc3-toggle"');
      expect(html).not.toContain("HC3 SE");
      expect(html).toContain('data-testid="regdiag-hc3-pooled-note"');
      expect(html).toContain("HC3 robust standard errors describe a single table");
    });

    it("does not refit when the toggle is switched", async () => {
      const olsSpy = vi.spyOn(quantisApi, "analyzeOLS");
      const vifSpy = vi.spyOn(quantisApi, "analyzeVIF");

      let tree: any = null;
      function Harness() {
        tree = RegressionTab({
          selectedDataset: makeDataset(),
          analysisBackendAvailable: true,
          showToast: vi.fn(),
          initialOlsYCol: "Y",
          initialOlsXSelected: ["X1", "X2"],
          initialOlsResult: {
            ...baseResult,
            n: 4,
            nInput: 4,
            nDropped: 0,
            df: 1,
            diagnostics: makeDiagnostics(),
          },
          initialHc3Enabled: true,
        });
        return tree;
      }
      renderToStaticMarkup(<Harness />);

      const toggle = findByTestId(tree, "regdiag-hc3-toggle");
      expect(toggle).not.toBeNull();
      toggle.props.onChange({ target: { checked: false } });
      toggle.props.onChange({ target: { checked: true } });

      expect(olsSpy).not.toHaveBeenCalled();
      expect(vifSpy).not.toHaveBeenCalled();
    });

    it("uses the VIF from the diagnostics payload instead of a second request", () => {
      const diagnostics = makeDiagnostics({
        vif: {
          X1: { vif: 9.99, tolerance: 0.1 },
          X2: { vif: 1.5, tolerance: 0.66 },
        },
      });
      const html = renderTab({ diagnostics });

      expect(html).toContain("X1: 9.99");
      expect(html).toContain("X2: 1.50");
    });
  });
});

// Keep the imported type used so the fixture shape stays checked by tsc.
const _assumptionTypeCheck: AssumptionRow = {
  id: "collinearity",
  applicable: false,
  notApplicableReason: "notComputable",
};
void _assumptionTypeCheck;
