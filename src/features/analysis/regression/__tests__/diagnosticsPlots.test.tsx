import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  DiagnosticsPlots,
  axisLabel,
  buildCookPoints,
  buildQqPoints,
  buildResidualPoints,
  cookThreshold,
  qqDiagonal,
  RESIDUAL_ZERO,
} from "../DiagnosticsPlots";
import { setLocale, t } from "@/i18n";
import type { Dataset, DiagnosticsObs, DiagnosticsPayloadOk, DiagnosticsQq } from "@/types";

// Recharts needs a DOM to measure; SSR tests stub the chart primitives.
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => <div>{children}</div>,
    ScatterChart: ({ children }: any) => <div data-testid="scatter-chart">{children}</div>,
    XAxis: ({ label }: any) => <div data-testid="x-axis" data-label={label?.value} />,
    YAxis: ({ label }: any) => <div data-testid="y-axis" data-label={label?.value} />,
    CartesianGrid: () => null,
    Tooltip: () => null,
    ReferenceLine: ({ y, segment }: any) => (
      <div
        data-testid="reference-line"
        data-y={y}
        data-segment={segment ? JSON.stringify(segment) : undefined}
      />
    ),
    Scatter: ({ data }: any) => (
      <div data-testid="scatter-series" data-points={JSON.stringify(data)} />
    ),
  };
});

const obs: DiagnosticsObs = {
  rowIndex: [0, 3, 7],
  fitted: [1, 2, 3],
  resid: [0.1, -0.2, 0],
  stdResid: [0.1, -0.2, 0],
  studentized: [0.1, -0.2, 0],
  leverage: [0.01, 0.02, 0.03],
  cookD: [0.01, 0.5, 0.02],
};

const qq: DiagnosticsQq = {
  theoretical: [-1.2, 0, 1.2],
  sample: [-1.0, 0.1, 1.1],
};

function makeDiagnostics(overrides: Partial<DiagnosticsPayloadOk> = {}): DiagnosticsPayloadOk {
  return {
    ok: true,
    errorCode: null,
    errorDetail: null,
    sample: {
      nInput: 100,
      nUsed: 100,
      nDropped: 0,
      method: "listwise",
      m: null,
      activeImputation: null,
    },
    obs,
    qq,
    assumptions: [
      {
        id: "linearity",
        applicable: true,
        verdict: "pass",
        stats: { bp: { chi2: 1, df: 2, p: 0.5 }, reset: { f: 1, df1: 1, df2: 97, p: 0.5 } },
      },
      {
        id: "normality",
        applicable: true,
        verdict: "pass",
        stats: { test: "shapiro", stat: 0.99, p: 0.5, skewness: 0, excessKurtosis: 0 },
      },
      {
        id: "influence",
        applicable: true,
        verdict: "pass",
        stats: {
          maxCookD: 0.5,
          nAbove4n: 0,
          maxLeverage: 0.03,
          leverageCut: 0.06,
          maxStudentized: 0.2,
          nStudentizedAbove3: 0,
        },
      },
      {
        id: "collinearity",
        applicable: true,
        verdict: "pass",
        stats: { maxVif: 1.2 },
      },
    ],
    vif: { X1: { vif: 1.2, tolerance: 0.83 } },
    influential: [],
    robustHC3: { se: {}, tStat: {}, pValue: {}, ciLower: {}, ciUpper: {} },
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

const variables: Dataset["variables"] = {
  Y: { name: "Y", label: "Satisfaction score", type: "numeric", measure: "scale", decimals: 2, align: "right" },
  X1: { name: "X1", label: "Service quality", type: "numeric", measure: "scale", decimals: 2, align: "right" },
  X2: { name: "X2", label: "  ", type: "numeric", measure: "scale", decimals: 2, align: "right" },
};

function escapeHtml(text: string): string {
  return text.replace(/'/g, "&#x27;");
}

function renderPlots(diagnostics: DiagnosticsPayloadOk): string {
  return renderToStaticMarkup(
    <DiagnosticsPlots
      diagnostics={diagnostics}
      yCol="Y"
      xCols={["X1", "X2"]}
      variables={variables}
    />
  );
}

describe("Phase 4.1 Task 8: diagnostic plots", () => {
  beforeEach(() => {
    setLocale("en");
  });

  it("builds one point per finite observation for residuals vs fitted", () => {
    const points = buildResidualPoints(obs);
    expect(points).toHaveLength(3);
    expect(points[0]).toEqual({ x: 1, y: 0.1 });
    expect(points[2]).toEqual({ x: 3, y: 0 });

    const withGap: DiagnosticsObs = { ...obs, resid: [0.1, null, 0] };
    expect(buildResidualPoints(withGap)).toHaveLength(2);
    expect(RESIDUAL_ZERO).toBe(0);
  });

  it("builds the Q-Q series, caps it at 2,000 points and keeps a 45-degree reference", () => {
    expect(buildQqPoints(qq)).toEqual([
      { x: -1.2, y: -1 },
      { x: 0, y: 0.1 },
      { x: 1.2, y: 1.1 },
    ]);

    const diagonal = qqDiagonal(qq.theoretical);
    expect(diagonal).not.toBeNull();
    expect(diagonal!.from.x).toBe(diagonal!.from.y);
    expect(diagonal!.to.x).toBe(diagonal!.to.y);
    expect(diagonal!.from.x).toBe(-1.2);
    expect(diagonal!.to.x).toBe(1.2);

    const long = {
      theoretical: Array.from({ length: 2500 }, (_, i) => i),
      sample: Array.from({ length: 2500 }, (_, i) => i),
    };
    expect(buildQqPoints(long)).toHaveLength(2000);
  });

  it("builds Cook's distance on the 1-based Analysis row and caps at 5,000 points", () => {
    const points = buildCookPoints(obs);
    expect(points).toHaveLength(3);
    expect(points.map((point) => point.x)).toEqual([1, 4, 8]);
    expect(points[1].y).toBe(0.5);

    const long: DiagnosticsObs = {
      ...obs,
      rowIndex: Array.from({ length: 6000 }, (_, i) => i),
      cookD: Array.from({ length: 6000 }, () => 0.01),
    };
    expect(buildCookPoints(long)).toHaveLength(5000);

    expect(cookThreshold(makeDiagnostics())).toBe(0.04);
  });

  it("uses variable labels for axis titles and falls back to the column name", () => {
    expect(axisLabel("Y", variables)).toBe("Satisfaction score");
    expect(axisLabel("X2", variables)).toBe("X2");
    expect(axisLabel("MISSING", variables)).toBe("MISSING");
    expect(axisLabel("Y", undefined)).toBe("Y");
  });

  it("renders three titled plots with reference lines and the model caption", () => {
    const html = renderPlots(makeDiagnostics());

    expect(html).toContain('data-testid="regdiag-plot-resid"');
    expect(html).toContain('data-testid="regdiag-plot-qq"');
    expect(html).toContain('data-testid="regdiag-plot-cooks"');
    expect(html).toContain(t("regDiag.plot.residVsFitted"));
    expect(html).toContain(t("regDiag.plot.qq"));
    expect(html).toContain(escapeHtml(t("regDiag.plot.cooks")));

    // Labels in the model caption, table names untouched.
    expect(html).toContain("Model: Satisfaction score ~ Service quality, X2");
    expect(html).toContain(t("regDiag.plot.axisFitted", { y: "Satisfaction score" }));

    // Zero line, 45-degree diagonal and the 4/n threshold are all drawn.
    expect(html.split('data-testid="reference-line"').length - 1).toBe(3);
    expect(html).toContain('data-y="0"');
    expect(html).toContain('data-y="0.04"');
    expect(html).toContain('data-segment=');
  });

  it("states that only a sample of the points is drawn", () => {
    expect(renderPlots(makeDiagnostics())).not.toContain(
      t("regDiag.plot.sampled")
    );
    expect(renderPlots(makeDiagnostics({ sampled: true }))).toContain(
      t("regDiag.plot.sampled")
    );
  });

  it("renders nothing when the payload carries no observation or Q-Q blocks", () => {
    const broken = { ...makeDiagnostics(), obs: undefined, qq: undefined } as unknown as DiagnosticsPayloadOk;
    expect(renderPlots(broken)).toBe("");
  });
});
