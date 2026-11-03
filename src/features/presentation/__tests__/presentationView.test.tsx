import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { PresentationView } from "../PresentationView";
import { setLocale, t } from "@/i18n";
import type { Dataset } from "@/types";
import type { PresentationChartType } from "@/stores";

// Mock recharts components for renderToStaticMarkup SSR testing
vi.mock("recharts", async (importOriginal) => {
  const actual = await importOriginal<typeof import("recharts")>();
  return {
    ...actual,
    ResponsiveContainer: ({ children }: any) => (
      <div className="recharts-responsive-container">{children}</div>
    ),
    BarChart: ({ children, data }: any) => (
      <div data-testid="bar-chart" data-chart-data={JSON.stringify(data)}>
        {children}
      </div>
    ),
    LineChart: ({ children, data }: any) => (
      <div data-testid="line-chart" data-chart-data={JSON.stringify(data)}>
        {children}
      </div>
    ),
    ScatterChart: ({ children }: any) => <div data-testid="scatter-chart">{children}</div>,
    PieChart: ({ children }: any) => <div data-testid="pie-chart">{children}</div>,
    ComposedChart: ({ children }: any) => <div data-testid="composed-chart">{children}</div>,
    XAxis: ({ domain, ticks, type, dataKey }: any) => (
      <div
        data-testid="x-axis"
        data-type={type}
        data-key={dataKey}
        data-domain={domain ? JSON.stringify(domain) : undefined}
        data-ticks={ticks ? JSON.stringify(ticks) : undefined}
      />
    ),
    YAxis: ({ domain, ticks, dataKey }: any) => (
      <div
        data-testid="y-axis"
        data-key={dataKey}
        data-domain={domain ? JSON.stringify(domain) : undefined}
        data-ticks={ticks ? JSON.stringify(ticks) : undefined}
      />
    ),
    CartesianGrid: () => null,
    Legend: () => null,
    Tooltip: () => <div data-testid="tooltip" />,
    Bar: ({ name, dataKey, stackId, children }: any) => (
      <div data-testid="bar-series" data-name={name} data-key={dataKey} data-stack-id={stackId}>
        {name}
        {children}
      </div>
    ),
    Line: ({ name, dataKey, children }: any) => (
      <div data-testid="line-series" data-name={name} data-key={dataKey}>
        {name}
        {children}
      </div>
    ),
    Scatter: ({ name, data }: any) => (
      <div data-testid="scatter-series" data-name={name} data-points={JSON.stringify(data)}>
        {name}
      </div>
    ),
    AreaChart: ({ children, data }: any) => (
      <div data-testid="area-chart" data-chart-data={JSON.stringify(data)}>
        {children}
      </div>
    ),
    Area: ({ name, dataKey, children }: any) => (
      <div data-testid="area-series" data-name={name} data-key={dataKey}>
        {children}
      </div>
    ),
    RadarChart: ({ children, data }: any) => (
      <div data-testid="radar-chart" data-chart-data={JSON.stringify(data)}>
        {children}
      </div>
    ),
    Radar: ({ name, dataKey, children }: any) => (
      <div data-testid="radar-series" data-name={name} data-key={dataKey}>
        {children}
      </div>
    ),
    Pie: ({ children, label, data }: any) => (
      <div
        data-testid="pie-series"
        data-label={typeof label === "function" ? "custom-formatter" : String(label)}
        data-chart-data={JSON.stringify(data)}
      >
        {children}
      </div>
    ),
    LabelList: ({ dataKey, position }: any) => (
      <div data-testid="label-list" data-key={dataKey} data-position={position} />
    ),
    ErrorBar: ({ dataKey, direction }: any) => (
      <div data-testid="error-bar" data-error-key={dataKey} data-direction={direction} />
    ),
  };
});

describe("PresentationView Component — Aggregation Integration", () => {
  const sampleDataset: Dataset = {
    id: "ds_pres_test",
    name: "Survey Scores",
    rows: 4,
    columns: 2,
    columnNames: ["Department", "Score"],
    preview: [
      ["Department", "Score"],
      ["Sales", "10"],
      ["Sales", "20"],
      ["Marketing", "30"],
      ["Marketing", "40"],
    ],
    data: [
      ["Department", "Score"],
      ["Sales", "10"],
      ["Sales", "20"],
      ["Marketing", "30"],
      ["Marketing", "40"],
    ],
    variables: {
      Department: {
        name: "Department",
        label: "Department",
        type: "string",
        measure: "nominal",
        decimals: 0,
        align: "left",
      },
      Score: {
        name: "Score",
        label: "Score",
        type: "numeric",
        measure: "scale",
        decimals: 2,
        align: "right",
      },
    },
    sourceFormat: "csv",
    createdAt: "2026-10-21T00:00:00Z",
    updatedAt: "2026-10-21T00:00:00Z",
  };

  const groupedDataset: Dataset = {
    id: "ds_pres_grouped",
    name: "Survey Scores by Gender",
    rows: 4,
    columns: 4,
    columnNames: ["Department", "Score", "Age", "Gender"],
    preview: [
      ["Department", "Score", "Age", "Gender"],
      ["Sales", "10", "25", "F"],
      ["Sales", "20", "30", "M"],
      ["Marketing", "30", "35", "F"],
      ["Marketing", "40", "40", "M"],
    ],
    data: [
      ["Department", "Score", "Age", "Gender"],
      ["Sales", "10", "25", "F"],
      ["Sales", "20", "30", "M"],
      ["Marketing", "30", "35", "F"],
      ["Marketing", "40", "40", "M"],
    ],
    variables: {
      Department: {
        name: "Department",
        label: "Phòng ban",
        type: "string",
        measure: "nominal",
        decimals: 0,
        align: "left",
      },
      Score: {
        name: "Score",
        label: "Điểm số",
        type: "numeric",
        measure: "scale",
        decimals: 2,
        align: "right",
      },
      Age: {
        name: "Age",
        label: "Độ tuổi",
        type: "numeric",
        measure: "scale",
        decimals: 0,
        align: "right",
      },
      Gender: {
        name: "Gender",
        label: "Giới tính",
        type: "string",
        measure: "nominal",
        decimals: 0,
        align: "left",
      },
    },
    sourceFormat: "csv",
    createdAt: "2026-10-21T00:00:00Z",
    updatedAt: "2026-10-21T00:00:00Z",
  };

  const defaultProps = {
    tab: "visualization" as const,
    selectedDataset: sampleDataset,
    chartType: "bar" as const,
    setChartType: () => {},
  };

  beforeEach(() => {
    setLocale("en");
  });

  it("does not render aggregation dropdown when Y axis is not selected (frequency count path)", () => {
    const html = renderToStaticMarkup(
      <PresentationView
        {...defaultProps}
        chartType="bar"
        initialXCol="Department"
        initialYCol=""
      />
    );

    // Label for aggregation should not be present
    expect(html).not.toContain(t("presentationView.aggregationLabel"));
    expect(html).not.toContain('value="median"');
    // Bar series name should be the default Count label
    expect(html).toContain(t("presentationView.barCountLabel"));

    // Frequency count data: Marketing = 2, Sales = 2
    expect(html).toContain('&quot;name&quot;:&quot;Sales&quot;,&quot;count&quot;:2');
    expect(html).toContain('&quot;name&quot;:&quot;Marketing&quot;,&quot;count&quot;:2');
  });

  it("renders aggregation dropdown with all 7 options when numeric Y is selected on Bar chart", () => {
    const html = renderToStaticMarkup(
      <PresentationView
        {...defaultProps}
        chartType="bar"
        initialXCol="Department"
        initialYCol="Score"
        initialYAggregation="mean"
      />
    );

    expect(html).toContain(t("presentationView.aggregationLabel"));
    expect(html).toContain('value="mean"');
    expect(html).toContain('value="sum"');
    expect(html).toContain('value="count"');
    expect(html).toContain('value="median"');
    expect(html).toContain('value="std"');
    expect(html).toContain('value="min"');
    expect(html).toContain('value="max"');

    // Dynamic legend label with default Mean
    expect(html).toContain("Mean of Score");

    // Aggregated data: Marketing mean = 35, Sales mean = 15
    expect(html).toContain('&quot;name&quot;:&quot;Sales&quot;,&quot;count&quot;:15');
    expect(html).toContain('&quot;name&quot;:&quot;Marketing&quot;,&quot;count&quot;:35');
    // Check that metrics are attached to each datum
    expect(html).toContain('&quot;metrics&quot;:{');
  });

  it("updates legend label and aggregated values when a different aggregation function is selected", () => {
    const htmlSum = renderToStaticMarkup(
      <PresentationView
        {...defaultProps}
        chartType="bar"
        initialXCol="Department"
        initialYCol="Score"
        initialYAggregation="sum"
      />
    );
    expect(htmlSum).toContain("Sum of Score");
    // Marketing sum: 30 + 40 = 70; Sales sum: 10 + 20 = 30
    expect(htmlSum).toContain('&quot;name&quot;:&quot;Marketing&quot;,&quot;count&quot;:70');
    expect(htmlSum).toContain('&quot;name&quot;:&quot;Sales&quot;,&quot;count&quot;:30');

    const htmlStd = renderToStaticMarkup(
      <PresentationView
        {...defaultProps}
        chartType="bar"
        initialXCol="Department"
        initialYCol="Score"
        initialYAggregation="std"
      />
    );
    expect(htmlStd).toContain("Std Dev of Score");
  });

  it("supports Y selector and aggregation dropdown on Horizontal Bar (barH) chart", () => {
    // When no Y selected on barH, aggregation select should be absent, but Y axis select is present
    const htmlNoY = renderToStaticMarkup(
      <PresentationView
        {...defaultProps}
        chartType="barH"
        initialXCol="Department"
        initialYCol=""
      />
    );
    expect(htmlNoY).toContain(t("presentationView.axisYNumericLabel"));
    expect(htmlNoY).not.toContain(t("presentationView.aggregationLabel"));

    // When Y is selected on barH, aggregation select is rendered
    const htmlWithY = renderToStaticMarkup(
      <PresentationView
        {...defaultProps}
        chartType="barH"
        initialXCol="Department"
        initialYCol="Score"
        initialYAggregation="median"
      />
    );
    expect(htmlWithY).toContain(t("presentationView.aggregationLabel"));
    expect(htmlWithY).toContain("Median of Score");
    expect(htmlWithY).toContain('&quot;name&quot;:&quot;Marketing&quot;,&quot;count&quot;:35');
  });

  it("supports aggregation on Line chart when Y is selected", () => {
    const html = renderToStaticMarkup(
      <PresentationView
        {...defaultProps}
        chartType="line"
        initialXCol="Department"
        initialYCol="Score"
        initialYAggregation="mean"
      />
    );

    expect(html).toContain(t("presentationView.aggregationLabel"));
    expect(html).toContain("Mean of Score");
    expect(html).toContain('&quot;x&quot;:&quot;Marketing&quot;,&quot;y&quot;:35');
    expect(html).toContain('&quot;x&quot;:&quot;Sales&quot;,&quot;y&quot;:15');
  });

  it("does not render aggregation dropdown on other chart types like scatter", () => {
    const html = renderToStaticMarkup(
      <PresentationView
        {...defaultProps}
        chartType="scatter"
        initialXCol="Score"
        initialYCol="Score"
      />
    );

    expect(html).not.toContain(t("presentationView.aggregationLabel"));
  });

  it("renders correctly in Vietnamese locale", () => {
    setLocale("vi");
    const html = renderToStaticMarkup(
      <PresentationView
        {...defaultProps}
        chartType="bar"
        initialXCol="Department"
        initialYCol="Score"
        initialYAggregation="mean"
      />
    );

    expect(html).toContain("Phép gộp");
    expect(html).toContain("Trung bình của Score");
  });

  it("carries full metrics in data objects for enhanced tooltip rendering", () => {
    const html = renderToStaticMarkup(
      <PresentationView
        {...defaultProps}
        chartType="bar"
        initialXCol="Department"
        initialYCol="Score"
        initialYAggregation="mean"
      />
    );

    expect(html).toContain('&quot;count&quot;:2');
    expect(html).toContain('&quot;ci95Lower&quot;:');
    expect(html).toContain('&quot;ci95Upper&quot;:');
  });

  describe("Legend and Multi-series Integration", () => {
    it("renders N series on Bar chart when legendCol is configured (clustered default)", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={groupedDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            legendCol: "Gender",
            barMode: "clustered",
          }}
        />
      );

      // Should render a Bar element for each distinct gender value: F and M
      expect(html).toContain('data-key="F"');
      expect(html).toContain('data-key="M"');
      // In clustered mode, stackId is not set
      expect(html).not.toContain('data-stack-id="stack"');
    });

    it("applies stackId on Bar chart when barMode is stacked", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={groupedDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            legendCol: "Gender",
            barMode: "stacked",
          }}
        />
      );

      expect(html).toContain('data-key="F"');
      expect(html).toContain('data-key="M"');
      expect(html).toContain('data-stack-id="stack"');
    });

    it("renders N lines on Line chart when legendCol is configured", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={groupedDataset}
          chartType="line"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            legendCol: "Gender",
          }}
        />
      );

      expect(html).toContain('data-testid="line-series" data-name="F"');
      expect(html).toContain('data-testid="line-series" data-name="M"');
    });

    it("renders N scatters on Scatter chart when legendCol is configured", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={groupedDataset}
          chartType="scatter"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Score",
            yCol: "Age",
            legendCol: "Gender",
          }}
        />
      );

      expect(html).toContain('data-testid="scatter-series" data-name="F"');
      expect(html).toContain('data-testid="scatter-series" data-name="M"');
    });

    it("renders clustered Bar chart for categorical frequency count when legendCol is configured without yCol", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={groupedDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "",
            legendCol: "Gender",
            barMode: "clustered",
          }}
        />
      );

      expect(html).toContain('data-key="F"');
      expect(html).toContain('data-key="M"');
      expect(html).toContain('data-testid="bar-chart"');
    });

    it("renders multi-series count Line chart when legendCol is configured without yCol and suppresses lineEmptyHint", () => {
      const ratingDataset: Dataset = {
        id: "ds_pres_rating",
        name: "Department Ratings",
        rows: 4,
        columns: 2,
        columnNames: ["Department", "Rating"],
        preview: [
          ["Department", "Rating"],
          ["Sales", "Good"],
          ["Sales", "Poor"],
          ["Marketing", "Good"],
          ["Marketing", "Excellent"],
        ],
        data: [
          ["Department", "Rating"],
          ["Sales", "Good"],
          ["Sales", "Poor"],
          ["Marketing", "Good"],
          ["Marketing", "Excellent"],
        ],
        variables: {
          Department: {
            name: "Department",
            label: "Department",
            type: "string",
            measure: "nominal",
            decimals: 0,
            align: "left",
          },
          Rating: {
            name: "Rating",
            label: "Rating",
            type: "string",
            measure: "nominal",
            decimals: 0,
            align: "left",
          },
        },
        sourceFormat: "csv",
        createdAt: "2026-10-21T00:00:00Z",
        updatedAt: "2026-10-21T00:00:00Z",
      };

      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={ratingDataset}
          chartType="line"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            legendCol: "Rating",
            yCol: "",
          }}
        />
      );

      expect(html).toContain('data-testid="line-chart"');
      expect(html).not.toContain(t("presentationView.lineEmptyHint"));
    });
  });

  describe("Error Bars on Academic Charts", () => {
    it("does not render ErrorBar by default when errorBar is not specified (defaults to none/Off)", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            aggregation: "mean",
          }}
        />
      );

      expect(html).not.toContain('data-testid="error-bar"');
    });

    it("renders ErrorBar inside Bar when aggregation is mean and errorBar is ci95 (single series)", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            aggregation: "mean",
            errorBar: "ci95",
          }}
        />
      );

      expect(html).toContain('data-testid="error-bar"');
      expect(html).toContain('data-error-key="error"');
      expect(html).toContain('data-direction="y"');
    });

    it("does not render ErrorBar when aggregation is not mean (e.g. sum)", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            aggregation: "sum",
            errorBar: "ci95",
          }}
        />
      );

      expect(html).not.toContain('data-testid="error-bar"');
    });

    it("does not render ErrorBar when errorBar is none", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            aggregation: "mean",
            errorBar: "none",
          }}
        />
      );

      expect(html).not.toContain('data-testid="error-bar"');
    });

    it("renders per-series ErrorBar for grouped Bar chart when legendCol is configured", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={groupedDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            legendCol: "Gender",
            aggregation: "mean",
            errorBar: "se",
          }}
        />
      );

      expect(html).toContain('data-error-key="_err_F"');
      expect(html).toContain('data-error-key="_err_M"');
      expect(html).toContain('data-direction="y"');
    });

    it("renders ErrorBar with direction x on horizontal bar (barH)", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="barH"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            aggregation: "mean",
            errorBar: "sd",
          }}
        />
      );

      expect(html).toContain('data-testid="error-bar"');
      expect(html).toContain('data-error-key="error"');
      expect(html).toContain('data-direction="x"');
    });

    it("renders ErrorBar inside Line series when aggregation is mean", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={groupedDataset}
          chartType="line"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            legendCol: "Gender",
            aggregation: "mean",
            errorBar: "ci95",
          }}
        />
      );

      expect(html).toContain('data-testid="error-bar"');
      expect(html).toContain('data-error-key="_err_F"');
      expect(html).toContain('data-error-key="_err_M"');
      expect(html).toContain('data-direction="y"');
    });
  });

  describe("Smart Typography and Data Labels", () => {
    it("generates auto title inheriting Variable Label for aggregated chart", () => {
      const datasetWithLabels: Dataset = {
        ...sampleDataset,
        variables: {
          ...sampleDataset.variables,
          Score: {
            ...sampleDataset.variables!.Score,
            label: "Customer Satisfaction",
          },
        },
      };

      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={datasetWithLabels}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            aggregation: "mean",
          }}
        />
      );

      expect(html).toContain('data-testid="chart-title"');
      expect(html).toContain("Mean of Customer Satisfaction by Department");
    });

    it("includes Legend variable label in auto title when grouped", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={groupedDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            legendCol: "Gender",
            aggregation: "mean",
          }}
        />
      );

      expect(html).toContain('data-testid="chart-title"');
      expect(html).toContain("Mean of Điểm số by Phòng ban and Giới tính");
    });

    it("respects titleOverride and renders subtitle", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            aggregation: "mean",
            titleOverride: "Custom Publication Title",
            subtitle: "Note: Error bars represent 95% CI (n = 350)",
          }}
        />
      );

      expect(html).toContain('data-testid="chart-title"');
      expect(html).toContain("Custom Publication Title");
      expect(html).not.toContain("Mean of Score by Department");
      expect(html).toContain('data-testid="chart-subtitle"');
      expect(html).toContain("Note: Error bars represent 95% CI (n = 350)");
    });

    it("renders LabelList when showDataLabels is true", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            aggregation: "mean",
            showDataLabels: true,
          }}
        />
      );

      expect(html).toContain('data-testid="label-list"');
      expect(html).toContain('data-key="count"');
      expect(html).toContain('data-position="top"');
    });

    it("does not render LabelList when showDataLabels is false", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            aggregation: "mean",
            showDataLabels: false,
          }}
        />
      );

      expect(html).not.toContain('data-testid="label-list"');
    });
  });

  describe("Error Bar & Academic Axis Scaling", () => {
    // Five rows per group: with the t-based CI a 2-row group's lower whisker drops
    // below zero, so the zero-baseline assertions below need a realistic sample size.
    const errorBarDataset: Dataset = {
      id: "ds_error_bar_scale",
      name: "Survey Scores",
      rows: 10,
      columns: 2,
      columnNames: ["Department", "Score"],
      preview: [
        ["Department", "Score"],
        ["Sales", "11"],
        ["Sales", "13"],
        ["Sales", "15"],
        ["Sales", "17"],
        ["Sales", "19"],
        ["Marketing", "31"],
        ["Marketing", "33"],
        ["Marketing", "35"],
        ["Marketing", "37"],
        ["Marketing", "39"],
      ],
      data: [
        ["Department", "Score"],
        ["Sales", "11"],
        ["Sales", "13"],
        ["Sales", "15"],
        ["Sales", "17"],
        ["Sales", "19"],
        ["Marketing", "31"],
        ["Marketing", "33"],
        ["Marketing", "35"],
        ["Marketing", "37"],
        ["Marketing", "39"],
      ],
      variables: {
        Department: { name: "Department", label: "Department", type: "string", measure: "nominal", decimals: 0, align: "left" },
        Score: { name: "Score", label: "Score", type: "numeric", measure: "scale", decimals: 2, align: "right" },
      },
      sourceFormat: "csv",
      createdAt: "2026-10-21T00:00:00Z",
      updatedAt: "2026-10-21T00:00:00Z",
    };

    it("expands YAxis domain ceiling with headroom on vertical Bar chart with error bars", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={errorBarDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            aggregation: "mean",
            errorBar: "ci95",
          }}
        />
      );

      // In errorBarDataset: Sales mean = 15, Marketing mean = 35 (n = 5 each).
      // With CI95 error bars, domain ceiling must be strictly greater than max bar value (35).
      expect(html).toContain('data-testid="y-axis"');
      const domainMatch = html.match(/data-testid="y-axis"[^>]*data-domain="([^"]+)"/);
      expect(domainMatch).not.toBeNull();
      const domain = JSON.parse(domainMatch![1].replace(/&quot;/g, '"'));
      expect(domain[0]).toBe(0);
      expect(domain[1]).toBeGreaterThan(35);
    });

    it("attaches error property to single-series barChartData and renders ErrorBar", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            aggregation: "mean",
            errorBar: "ci95",
          }}
        />
      );

      // Check bar chart data has error property
      const chartDataMatch = html.match(/data-testid="bar-chart"[^>]*data-chart-data="([^"]+)"/);
      expect(chartDataMatch).not.toBeNull();
      const chartData = JSON.parse(chartDataMatch![1].replace(/&quot;/g, '"'));
      expect(chartData.length).toBe(2);
      expect(chartData[0].error).toBeDefined();
      expect(Array.isArray(chartData[0].error)).toBe(true);

      // ErrorBar rendered
      expect(html).toContain('data-testid="error-bar"');
      expect(html).toContain('data-error-key="error"');
      expect(html).toContain('data-direction="y"');
    });

    it("expands XAxis domain ceiling with headroom on Horizontal Bar (barH) chart", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={errorBarDataset}
          chartType="barH"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            yCol: "Score",
            aggregation: "mean",
            errorBar: "ci95",
          }}
        />
      );

      expect(html).toContain('data-testid="x-axis"');
      const domainMatch = html.match(/data-testid="x-axis"[^>]*data-domain="([^"]+)"/);
      expect(domainMatch).not.toBeNull();
      const domain = JSON.parse(domainMatch![1].replace(/&quot;/g, '"'));
      expect(domain[0]).toBe(0);
      expect(domain[1]).toBeGreaterThan(35);
    });

    it("expands YAxis domain ceiling on multi-series clustered Bar chart (user reported bug reproduction)", () => {
      const multiDataset: Dataset = {
        id: "ds_multi_error_test",
        name: "Survey",
        rows: 4,
        columns: 3,
        columnNames: ["Name", "Group", "Score"],
        preview: [
          ["Name", "Group", "Score"],
          ["A", "G1", "1.5"],
          ["A", "G1", "1.5"],
          ["A", "G2", "2.0"],
          ["A", "G2", "2.0"],
        ],
        data: [
          ["Name", "Group", "Score"],
          ["A", "G1", "1.5"],
          ["A", "G1", "1.5"],
          ["A", "G2", "2.0"],
          ["A", "G2", "2.0"],
        ],
        variables: {
          Name: { name: "Name", label: "Name", type: "string", measure: "nominal", decimals: 0, align: "left" },
          Group: { name: "Group", label: "Group", type: "string", measure: "nominal", decimals: 0, align: "left" },
          Score: { name: "Score", label: "Score", type: "numeric", measure: "scale", decimals: 2, align: "right" },
        },
        sourceFormat: "csv",
        createdAt: "2026-10-22",
        updatedAt: "2026-10-22",
      };

      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Name",
            legendCol: "Group",
            yCol: "Score",
            aggregation: "mean",
            errorBar: "ci95",
          }}
        />
      );

      const domainMatch = html.match(/data-testid="y-axis"[^>]*data-domain="([^"]+)"/);
      expect(domainMatch).not.toBeNull();
      const domain = JSON.parse(domainMatch![1].replace(/&quot;/g, '"'));
      expect(domain[0]).toBe(0);
      // Even though highest bar is 2.0, ceiling must expand (e.g. 2.5) to provide breathing room
      expect(domain[1]).toBeGreaterThan(2.0);
    });
  });

  describe("Chart Inspector Panel Mounting", () => {
    it("renders the inspector toggle button and panel for non-academic chart types", () => {
      const nonAcademicCharts: PresentationChartType[] = ["pie", "donut", "histogram", "box", "heatmap", "area", "density", "radar"];

      for (const chartType of nonAcademicCharts) {
        const html = renderToStaticMarkup(
          <PresentationView
            tab="visualization"
            selectedDataset={sampleDataset}
            chartType={chartType}
            setChartType={() => {}}
          />
        );

        expect(html, `chartType ${chartType} should have inspector toggle button`).toContain('data-testid="inspector-toggle-btn"');
        expect(html, `chartType ${chartType} should render chart inspector panel`).toContain('data-testid="chart-inspector-panel"');
      }
    });

    it("does not render inline toolbar blocks for pie and donut", () => {
      for (const chartType of ["pie", "donut"] as PresentationChartType[]) {
        const html = renderToStaticMarkup(
          <PresentationView
            tab="visualization"
            selectedDataset={sampleDataset}
            chartType={chartType}
            setChartType={() => {}}
          />
        );
        const [toolbarPart] = html.split('data-testid="chart-inspector-panel"');
        expect(toolbarPart).not.toContain(t("presentationView.pieHint"));
        expect(toolbarPart).not.toContain(t("presentationView.binNumericLabel"));
        expect(toolbarPart).not.toContain(t("presentationView.categoricalColumnLabel"));
      }
    });

    it("does not render inline toolbar blocks for area", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="area"
          setChartType={() => {}}
        />
      );
      const [toolbarPart] = html.split('data-testid="chart-inspector-panel"');
      expect(toolbarPart).not.toContain(t("presentationView.axisYNumericLabel"));
    });

    it("does not render inline toolbar blocks for histogram", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="histogram"
          setChartType={() => {}}
        />
      );
      const [toolbarPart] = html.split('data-testid="chart-inspector-panel"');
      expect(toolbarPart).not.toContain(t("presentationView.distributionColumnLabel"));
      expect(toolbarPart).not.toContain(t("presentationView.showKdeLabel"));
    });

    it("does not render inline toolbar blocks for box", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="box"
          setChartType={() => {}}
        />
      );
      const [toolbarPart] = html.split('data-testid="chart-inspector-panel"');
      expect(toolbarPart).not.toContain(t("presentationView.groupVarXLabel"));
      expect(toolbarPart).not.toContain(t("presentationView.numericVarYLabel"));
    });

    it("does not render inline toolbar blocks for heatmap", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="heatmap"
          setChartType={() => {}}
        />
      );
      const [toolbarPart] = html.split('data-testid="chart-inspector-panel"');
      expect(toolbarPart).not.toContain(t("presentationView.coefficientLabel"));
      expect(toolbarPart).not.toContain(t("presentationView.exportCsvButton"));
    });

    it("does not render inline toolbar blocks for density", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="density"
          setChartType={() => {}}
        />
      );
      const [toolbarPart] = html.split('data-testid="chart-inspector-panel"');
      expect(toolbarPart).not.toContain(t("presentationView.densityGroupLabel"));
      expect(toolbarPart).not.toContain(t("presentationView.densityValueLabel"));
    });

    it("does not render inline toolbar blocks for radar", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="radar"
          setChartType={() => {}}
        />
      );
      const [toolbarPart] = html.split('data-testid="chart-inspector-panel"');
      expect(toolbarPart).not.toContain(t("presentationView.groupColumnOptionalLabel"));
      expect(toolbarPart).not.toContain(t("presentationView.numericAxesLabel"));
    });
  });

  describe("Task 1: Axis Unification in PresentationView", () => {
    it("renders pie and donut charts driven by initialConfig.xCol", () => {
      const htmlPie = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="pie"
          setChartType={() => {}}
          initialConfig={{ xCol: "Department", yCol: "Score" }}
        />
      );
      expect(htmlPie).toContain('data-testid="pie-chart"');

      const htmlDonut = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="donut"
          setChartType={() => {}}
          initialConfig={{ xCol: "Department" }}
        />
      );
      expect(htmlDonut).toContain('data-testid="pie-chart"');
    });

    it("renders area chart driven by initialConfig.xCol and initialConfig.yCol", () => {
      const htmlArea = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="area"
          setChartType={() => {}}
          initialConfig={{ xCol: "Department", yCol: "Score" }}
        />
      );
      expect(htmlArea).toContain('data-testid="area-chart"');
    });

    it("renders box plot driven by initialConfig.xCol and initialConfig.yCol", () => {
      const htmlBox = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="box"
          setChartType={() => {}}
          initialConfig={{ xCol: "Department", yCol: "Score" }}
        />
      );
      expect(htmlBox).toContain('data-testid="composed-chart"');
    });
  });

  describe("Task 3: Global Smart Titles & Canvas Title Blocks", () => {
    const multiColDataset: Dataset = {
      id: "ds_smart_titles_test",
      name: "Research Dataset",
      rows: 4,
      columns: 4,
      columnNames: ["Department", "Score", "Performance", "Experience"],
      preview: [
        ["Department", "Score", "Performance", "Experience"],
        ["HR", "80", "85", "5"],
        ["HR", "82", "88", "6"],
        ["Sales", "90", "92", "4"],
        ["Sales", "95", "96", "7"],
      ],
      data: [
        ["Department", "Score", "Performance", "Experience"],
        ["HR", "80", "85", "5"],
        ["HR", "82", "88", "6"],
        ["Sales", "90", "92", "4"],
        ["Sales", "95", "96", "7"],
      ],
      variables: {
        Department: { name: "Department", label: "Phòng ban", type: "string", measure: "nominal", decimals: 0, align: "left" },
        Score: { name: "Score", label: "Điểm số", type: "numeric", measure: "scale", decimals: 2, align: "right" },
        Performance: { name: "Performance", label: "Hiệu suất", type: "numeric", measure: "scale", decimals: 2, align: "right" },
        Experience: { name: "Experience", label: "Kinh nghiệm", type: "numeric", measure: "scale", decimals: 1, align: "right" },
      },
      sourceFormat: "csv",
      createdAt: "2026-10-22",
      updatedAt: "2026-10-22",
    };

    it("renders smart title blocks on pie and donut charts", () => {
      setLocale("en");
      const htmlPie = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiColDataset}
          chartType="pie"
          setChartType={() => {}}
          initialConfig={{ xCol: "Department" }}
        />
      );
      expect(htmlPie).toContain('data-testid="chart-title-block"');
      expect(htmlPie).toContain('data-testid="chart-title"');
      expect(htmlPie).toContain("Distribution of Phòng ban");

      const htmlDonut = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiColDataset}
          chartType="donut"
          setChartType={() => {}}
          initialConfig={{ xCol: "Department" }}
        />
      );
      expect(htmlDonut).toContain('data-testid="chart-title-block"');
      expect(htmlDonut).toContain("Distribution of Phòng ban");
    });

    it("renders smart title block on histogram", () => {
      setLocale("en");
      const htmlHist = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiColDataset}
          chartType="histogram"
          setChartType={() => {}}
          initialControls={{ histogramCol: "Score" }}
        />
      );
      expect(htmlHist).toContain('data-testid="chart-title-block"');
      expect(htmlHist).toContain("Frequency Distribution of Điểm số");
    });

    it("renders smart title block on box plot", () => {
      setLocale("en");
      const htmlBox = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiColDataset}
          chartType="box"
          setChartType={() => {}}
          initialConfig={{ xCol: "Department", yCol: "Score" }}
        />
      );
      expect(htmlBox).toContain('data-testid="chart-title-block"');
      expect(htmlBox).toContain("Distribution of Điểm số by Phòng ban");
    });

    it("renders smart title block on area chart", () => {
      setLocale("en");
      const htmlArea = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiColDataset}
          chartType="area"
          setChartType={() => {}}
          initialConfig={{ xCol: "Department", yCol: "Score" }}
        />
      );
      expect(htmlArea).toContain('data-testid="chart-title-block"');
      expect(htmlArea).toContain("Điểm số by Phòng ban");
    });

    it("renders smart title block on density estimation chart", () => {
      setLocale("en");
      const htmlDensity = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiColDataset}
          chartType="density"
          setChartType={() => {}}
          initialControls={{ densityGroupCol: "Department", densityValueCol: "Score" }}
        />
      );
      expect(htmlDensity).toContain('data-testid="chart-title-block"');
      expect(htmlDensity).toContain("Density Estimation of Điểm số by Phòng ban");
    });

    it("renders smart title block on heatmap", () => {
      setLocale("en");
      const htmlHeatmap = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiColDataset}
          chartType="heatmap"
          setChartType={() => {}}
          initialControls={{ heatmapCorrMethod: "spearman" }}
        />
      );
      expect(htmlHeatmap).toContain('data-testid="chart-title-block"');
      expect(htmlHeatmap).toContain("Spearman Correlation Matrix");
    });

    it("renders smart title block on radar chart", () => {
      setLocale("en");
      const htmlRadar = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiColDataset}
          chartType="radar"
          setChartType={() => {}}
          initialControls={{ radarGroupCol: "Department", radarNumericCols: ["Score", "Performance"] }}
        />
      );
      expect(htmlRadar).toContain('data-testid="chart-title-block"');
      expect(htmlRadar).toContain("Radar Profile by Phòng ban");
    });

    it("renders title override and subtitle on non-academic charts when provided", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiColDataset}
          chartType="pie"
          setChartType={() => {}}
          initialConfig={{
            xCol: "Department",
            titleOverride: "Figure 1. Department Breakdown",
            subtitle: "Note: Sample size N = 4",
          }}
        />
      );
      expect(html).toContain('data-testid="chart-title-block"');
      expect(html).toContain('data-testid="chart-title"');
      expect(html).toContain("Figure 1. Department Breakdown");
      expect(html).toContain('data-testid="chart-subtitle"');
      expect(html).toContain("Note: Sample size N = 4");
    });
  });

  describe("Task 4: Data Labels & Precision Formatting in PresentationView", () => {
    const dataLabelDataset: Dataset = {
      id: "ds_datalabels_test",
      name: "Performance Dataset",
      rows: 4,
      columns: 3,
      columnNames: ["Category", "MetricA", "MetricB"],
      preview: [
        ["Category", "MetricA", "MetricB"],
        ["Cat1", "10.555", "20.123"],
        ["Cat1", "12.444", "22.333"],
        ["Cat2", "15.000", "25.000"],
      ],
      data: [
        ["Category", "MetricA", "MetricB"],
        ["Cat1", "10.555", "20.123"],
        ["Cat1", "12.444", "22.333"],
        ["Cat2", "15.000", "25.000"],
      ],
      variables: {
        Category: { name: "Category", label: "Category", type: "string", measure: "nominal", decimals: 0, align: "left" },
        MetricA: { name: "MetricA", label: "Metric A", type: "numeric", measure: "scale", decimals: 2, align: "right" },
        MetricB: { name: "MetricB", label: "Metric B", type: "numeric", measure: "scale", decimals: 2, align: "right" },
      },
      sourceFormat: "csv",
      createdAt: "2026-10-22",
      updatedAt: "2026-10-22",
    };

    it("initializes pie and donut slice labels to visible by default, and hides them when showDataLabels is false", () => {
      // Pie default (visible)
      const htmlPieDefault = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="pie"
          setChartType={() => {}}
          initialConfig={{ xCol: "Category" }}
        />
      );
      expect(htmlPieDefault).toContain('data-testid="pie-series"');
      expect(htmlPieDefault).toContain('data-label="custom-formatter"');

      // Pie toggled off
      const htmlPieOff = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="pie"
          setChartType={() => {}}
          initialConfig={{ xCol: "Category", showDataLabels: false }}
        />
      );
      expect(htmlPieOff).toContain('data-testid="pie-series"');
      expect(htmlPieOff).toContain('data-label="false"');

      // Donut default (visible)
      const htmlDonutDefault = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="donut"
          setChartType={() => {}}
          initialConfig={{ xCol: "Category" }}
        />
      );
      expect(htmlDonutDefault).toContain('data-testid="pie-series"');
      expect(htmlDonutDefault).toContain('data-label="custom-formatter"');

      // Donut toggled off
      const htmlDonutOff = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="donut"
          setChartType={() => {}}
          initialConfig={{ xCol: "Category", showDataLabels: false }}
        />
      );
      expect(htmlDonutOff).toContain('data-testid="pie-series"');
      expect(htmlDonutOff).toContain('data-label="false"');
    });

    it("renders data labels on histogram, area, and radar when showDataLabels is enabled", () => {
      // Histogram with data labels
      const htmlHistOn = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="histogram"
          setChartType={() => {}}
          initialControls={{ histogramCol: "MetricA" }}
          initialConfig={{ showDataLabels: true, decimals: 1 }}
        />
      );
      expect(htmlHistOn).toContain('data-testid="label-list"');
      expect(htmlHistOn).toContain('data-key="count"');

      // Histogram without data labels
      const htmlHistOff = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="histogram"
          setChartType={() => {}}
          initialControls={{ histogramCol: "MetricA" }}
          initialConfig={{ showDataLabels: false }}
        />
      );
      expect(htmlHistOff).not.toContain('data-testid="label-list"');

      // Area with data labels
      const htmlAreaOn = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="area"
          setChartType={() => {}}
          initialConfig={{ xCol: "Category", yCol: "MetricA", showDataLabels: true, decimals: 2 }}
        />
      );
      expect(htmlAreaOn).toContain('data-testid="label-list"');
      expect(htmlAreaOn).toContain('data-key="y"');

      // Area without data labels
      const htmlAreaOff = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="area"
          setChartType={() => {}}
          initialConfig={{ xCol: "Category", yCol: "MetricA", showDataLabels: false }}
        />
      );
      expect(htmlAreaOff).not.toContain('data-testid="label-list"');

      // Radar with data labels
      const htmlRadarOn = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="radar"
          setChartType={() => {}}
          initialControls={{ radarGroupCol: "Category", radarNumericCols: ["MetricA", "MetricB"] }}
          initialConfig={{ showDataLabels: true, decimals: 2 }}
        />
      );
      expect(htmlRadarOn).toContain('data-testid="label-list"');
      expect(htmlRadarOn).toContain('data-key="Cat1"');

      // Radar without data labels
      const htmlRadarOff = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="radar"
          setChartType={() => {}}
          initialControls={{ radarGroupCol: "Category", radarNumericCols: ["MetricA", "MetricB"] }}
          initialConfig={{ showDataLabels: false }}
        />
      );
      expect(htmlRadarOff).not.toContain('data-testid="label-list"');
    });

    it("does not render data labels for density, box, and heatmap even if showDataLabels is true", () => {
      // Density
      const htmlDensity = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="density"
          setChartType={() => {}}
          initialControls={{ densityGroupCol: "Category", densityValueCol: "MetricA" }}
          initialConfig={{ showDataLabels: true }}
        />
      );
      expect(htmlDensity).not.toContain('data-testid="label-list"');

      // Box plot
      const htmlBox = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="box"
          setChartType={() => {}}
          initialConfig={{ xCol: "Category", yCol: "MetricA", showDataLabels: true }}
        />
      );
      expect(htmlBox).not.toContain('data-testid="label-list"');

      // Heatmap
      const htmlHeatmap = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="heatmap"
          setChartType={() => {}}
          initialControls={{ heatmapCorrMethod: "pearson" }}
          initialConfig={{ showDataLabels: true }}
        />
      );
      expect(htmlHeatmap).not.toContain('data-testid="label-list"');
    });

    it("aggregates values when Values (yCol) is provided for pie and donut charts", () => {
      const htmlPieAgg = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="pie"
          setChartType={() => {}}
          initialConfig={{ xCol: "Category", yCol: "MetricA", aggregation: "sum" }}
        />
      );
      expect(htmlPieAgg).toContain('data-testid="pie-chart"');
      expect(htmlPieAgg).toContain('data-testid="pie-series"');

      const htmlDonutAgg = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={dataLabelDataset}
          chartType="donut"
          setChartType={() => {}}
          initialConfig={{ xCol: "Category", yCol: "MetricA", aggregation: "sum" }}
        />
      );
      expect(htmlDonutAgg).toContain('data-testid="pie-chart"');
      expect(htmlDonutAgg).toContain('data-testid="pie-series"');
    });
    describe("Bar & Horizontal Bar column sorting", () => {
      const numericSortDataset: Dataset = {
        id: "ds-numeric-sort",
        name: "Numeric Sort Dataset",
        rows: 5,
        columns: 2,
        columnNames: ["id", "val"],
        data: [
          ["id", "val"],
          ["1", "10"],
          ["10", "50"],
          ["2", "30"],
          ["20", "20"],
          ["3", "40"],
        ],
        preview: [
          ["id", "val"],
          ["1", "10"],
          ["10", "50"],
          ["2", "30"],
          ["20", "20"],
          ["3", "40"],
        ],
        sourceFormat: "csv",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      };

      it("naturally sorts categories ascending (1, 2, 3, 10, 20) by default", () => {
        const html = renderToStaticMarkup(
          <PresentationView
            tab="visualization"
            selectedDataset={numericSortDataset}
            chartType="bar"
            setChartType={() => {}}
            initialConfig={{ xCol: "id", yCol: "val", aggregation: "mean", sortOrder: "category-asc" }}
          />
        );
        const match = html.match(/data-testid="bar-chart"[^>]*data-chart-data="([^"]+)"/);
        expect(match).not.toBeNull();
        const data = JSON.parse(match![1].replace(/&quot;/g, '"'));
        const names = data.map((d: any) => d.name);
        expect(names).toEqual(["1", "2", "3", "10", "20"]);
      });

      it("sorts categories descending (20, 10, 3, 2, 1) when sortOrder is category-desc", () => {
        const html = renderToStaticMarkup(
          <PresentationView
            tab="visualization"
            selectedDataset={numericSortDataset}
            chartType="bar"
            setChartType={() => {}}
            initialConfig={{ xCol: "id", yCol: "val", aggregation: "mean", sortOrder: "category-desc" }}
          />
        );
        const match = html.match(/data-testid="bar-chart"[^>]*data-chart-data="([^"]+)"/);
        expect(match).not.toBeNull();
        const data = JSON.parse(match![1].replace(/&quot;/g, '"'));
        const names = data.map((d: any) => d.name);
        expect(names).toEqual(["20", "10", "3", "2", "1"]);
      });

      it("sorts by value ascending when sortOrder is value-asc", () => {
        const html = renderToStaticMarkup(
          <PresentationView
            tab="visualization"
            selectedDataset={numericSortDataset}
            chartType="bar"
            setChartType={() => {}}
            initialConfig={{ xCol: "id", yCol: "val", aggregation: "mean", sortOrder: "value-asc" }}
          />
        );
        const match = html.match(/data-testid="bar-chart"[^>]*data-chart-data="([^"]+)"/);
        expect(match).not.toBeNull();
        const data = JSON.parse(match![1].replace(/&quot;/g, '"'));
        const values = data.map((d: any) => d.count);
        expect(values).toEqual([10, 20, 30, 40, 50]);
      });

      it("sorts by value descending when sortOrder is value-desc", () => {
        const html = renderToStaticMarkup(
          <PresentationView
            tab="visualization"
            selectedDataset={numericSortDataset}
            chartType="bar"
            setChartType={() => {}}
            initialConfig={{ xCol: "id", yCol: "val", aggregation: "mean", sortOrder: "value-desc" }}
          />
        );
        const match = html.match(/data-testid="bar-chart"[^>]*data-chart-data="([^"]+)"/);
        expect(match).not.toBeNull();
        const data = JSON.parse(match![1].replace(/&quot;/g, '"'));
        const values = data.map((d: any) => d.count);
        expect(values).toEqual([50, 40, 30, 20, 10]);
      });

      it("preserves original data order when sortOrder is none", () => {
        const html = renderToStaticMarkup(
          <PresentationView
            tab="visualization"
            selectedDataset={numericSortDataset}
            chartType="bar"
            setChartType={() => {}}
            initialConfig={{ xCol: "id", yCol: "val", aggregation: "mean", sortOrder: "none" }}
          />
        );
        const match = html.match(/data-testid="bar-chart"[^>]*data-chart-data="([^"]+)"/);
        expect(match).not.toBeNull();
        const data = JSON.parse(match![1].replace(/&quot;/g, '"'));
        const names = data.map((d: any) => d.name);
        expect(names).toEqual(["1", "10", "2", "20", "3"]);
      });

      it("sorts Horizontal Bar (barH) categories naturally", () => {
        const html = renderToStaticMarkup(
          <PresentationView
            tab="visualization"
            selectedDataset={numericSortDataset}
            chartType="barH"
            setChartType={() => {}}
            initialConfig={{ xCol: "id", yCol: "val", aggregation: "mean", sortOrder: "category-asc" }}
          />
        );
        const match = html.match(/data-testid="bar-chart"[^>]*data-chart-data="([^"]+)"/);
        expect(match).not.toBeNull();
        const data = JSON.parse(match![1].replace(/&quot;/g, '"'));
        const names = data.map((d: any) => d.name);
        expect(names).toEqual(["1", "2", "3", "10", "20"]);
      });
    });

    describe("Line chart source ordering and capacity regressions", () => {
      beforeEach(() => {
        setLocale("en");
      });

      const lineOrderDataset: Dataset = {
        id: "ds-line-order",
        name: "Line Order Dataset",
        rows: 3,
        columns: 2,
        columnNames: ["Month", "Score"],
        data: [
          ["Month", "Score"],
          ["Mar", "30"],
          ["Jan", "10"],
          ["Feb", "20"],
        ],
        preview: [
          ["Month", "Score"],
          ["Mar", "30"],
          ["Jan", "10"],
          ["Feb", "20"],
        ],
        variables: {
          Month: {
            name: "Month",
            label: "Month",
            type: "string",
            measure: "nominal",
            decimals: 0,
            align: "left",
          },
          Score: {
            name: "Score",
            label: "Score",
            type: "numeric",
            measure: "scale",
            decimals: 0,
            align: "right",
          },
        },
        sourceFormat: "csv",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      };

      const categories35 = Array.from({ length: 35 }, (_, i) => `C${i + 1}`);
      const rows35: string[][] = [
        ["Category", "Score"],
        ...categories35.map((c, i) => [c, String((i + 1) * 10)]),
      ];
      const lineCapacityDataset: Dataset = {
        id: "ds-line-capacity",
        name: "Line Capacity Dataset",
        rows: 35,
        columns: 2,
        columnNames: ["Category", "Score"],
        data: rows35,
        preview: rows35,
        variables: {
          Category: {
            name: "Category",
            label: "Category",
            type: "string",
            measure: "nominal",
            decimals: 0,
            align: "left",
          },
          Score: {
            name: "Score",
            label: "Score",
            type: "numeric",
            measure: "scale",
            decimals: 0,
            align: "right",
          },
        },
        sourceFormat: "csv",
        createdAt: "2026-01-01",
        updatedAt: "2026-01-01",
      };

      it("keeps source row order on line charts (F2)", () => {
        const html = renderToStaticMarkup(
          <PresentationView
            tab="visualization"
            selectedDataset={lineOrderDataset}
            chartType="line"
            setChartType={() => {}}
            initialConfig={{ xCol: "Month", yCol: "Score" }}
          />
        );
        const match = html.match(/data-testid="line-chart"[^>]*data-chart-data="([^"]+)"/);
        expect(match).not.toBeNull();
        const data = JSON.parse(match![1].replace(/&quot;/g, '"'));
        const xValues = data.map((d: any) => d.x);
        expect(xValues).toEqual(["Mar", "Jan", "Feb"]);
      });

      it("does not truncate line charts at 30 categories (F4)", () => {
        const html = renderToStaticMarkup(
          <PresentationView
            tab="visualization"
            selectedDataset={lineCapacityDataset}
            chartType="line"
            setChartType={() => {}}
            initialConfig={{ xCol: "Category", yCol: "Score" }}
          />
        );
        const match = html.match(/data-testid="line-chart"[^>]*data-chart-data="([^"]+)"/);
        expect(match).not.toBeNull();
        const data = JSON.parse(match![1].replace(/&quot;/g, '"'));
        expect(data).toHaveLength(35);
      });

      it("preserves source order and does not cap at 30 for unaggregated multi-series line charts", () => {
        const quarters = [
          "2024-Q3",
          "2024-Q1",
          "2024-Q4",
          ...Array.from({ length: 32 }, (_, i) => `Cat-${String(35 - i).padStart(2, "0")}`),
        ];
        const unaggRows: string[][] = [
          ["Quarter", "Series"],
          ...quarters.flatMap((q) => [
            [q, "SeriesA"],
            [q, "SeriesB"],
          ]),
        ];
        const unaggMultiSeriesDataset: Dataset = {
          id: "ds-unagg-multi-series",
          name: "Unaggregated Multi-Series Dataset",
          rows: unaggRows.length - 1,
          columns: 2,
          columnNames: ["Quarter", "Series"],
          data: unaggRows,
          preview: unaggRows,
          variables: {
            Quarter: {
              name: "Quarter",
              label: "Quarter",
              type: "string",
              measure: "nominal",
              decimals: 0,
              align: "left",
            },
            Series: {
              name: "Series",
              label: "Series",
              type: "string",
              measure: "nominal",
              decimals: 0,
              align: "left",
            },
          },
          sourceFormat: "csv",
          createdAt: "2026-01-01",
          updatedAt: "2026-01-01",
        };

        const html = renderToStaticMarkup(
          <PresentationView
            tab="visualization"
            selectedDataset={unaggMultiSeriesDataset}
            chartType="line"
            setChartType={() => {}}
            initialConfig={{ xCol: "Quarter", legendCol: "Series", yCol: "" }}
          />
        );

        const match = html.match(/data-testid="line-chart"[^>]*data-chart-data="([^"]+)"/);
        expect(match).not.toBeNull();
        const data = JSON.parse(match![1].replace(/&quot;/g, '"'));
        expect(data).toHaveLength(35);
        expect(data.map((d: any) => d.name)).toEqual(quarters);
        expect(data.map((d: any) => d.x)).toEqual(quarters);
        expect(data[0].SeriesA).toBe(1);
        expect(data[0].SeriesB).toBe(1);
      });
    });
  });

  describe("Synchronized Chart Instructions with Inspector UI", () => {
    it("renders synchronized instruction for pie chart without legacy 'X axis above' phrasing", () => {
      setLocale("en");
      const htmlPie = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="pie"
          setChartType={() => {}}
          initialConfig={{ xCol: "" }}
        />
      );
      expect(htmlPie).toContain(t("presentationView.pieEmptyHint"));
      expect(htmlPie).toContain("Select a Legend (category column) in the Chart Inspector");
      expect(htmlPie).not.toContain("Pick the X axis");
      expect(htmlPie).not.toContain("above to draw the pie chart");

      // Vietnamese
      setLocale("vi");
      const htmlPieVi = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="pie"
          setChartType={() => {}}
          initialConfig={{ xCol: "" }}
        />
      );
      expect(htmlPieVi).toContain(t("presentationView.pieEmptyHint"));
      expect(htmlPieVi).toContain("Chọn Phân nhóm (Legend - cột phân loại) trong Bảng điều khiển");
      expect(htmlPieVi).not.toContain("ở trên");
    });

    it("renders synchronized instruction for donut chart", () => {
      setLocale("en");
      const htmlDonut = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="donut"
          setChartType={() => {}}
          initialConfig={{ xCol: "" }}
        />
      );
      expect(htmlDonut).toContain(t("presentationView.donutEmptyHint"));
      expect(htmlDonut).toContain("Select a Legend (category column) in the Chart Inspector");
      expect(htmlDonut).not.toContain("field above");
    });

    it("renders synchronized empty instructions for column (bar) and horizontal bar (barH)", () => {
      setLocale("en");
      const htmlBar = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="bar"
          setChartType={() => {}}
          initialConfig={{ xCol: "" }}
        />
      );
      expect(htmlBar).toContain(t("presentationView.barEmptyHint"));
      expect(htmlBar).toContain("Select an X axis (category) in the Chart Inspector");

      const htmlBarH = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="barH"
          setChartType={() => {}}
          initialConfig={{ xCol: "" }}
        />
      );
      expect(htmlBarH).toContain(t("presentationView.barHEmptyHint"));
      expect(htmlBarH).toContain("Select an X axis (category) in the Chart Inspector");
    });

    it("renders synchronized instructions for line, area, box, and histogram", () => {
      setLocale("en");
      const htmlLine = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="line"
          setChartType={() => {}}
          initialConfig={{ xCol: "", yCol: "" }}
        />
      );
      expect(htmlLine).toContain(t("presentationView.lineEmptyHint"));
      expect(htmlLine).toContain("Chart Inspector");

      const htmlArea = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="area"
          setChartType={() => {}}
          initialConfig={{ xCol: "", yCol: "" }}
        />
      );
      expect(htmlArea).toContain(t("presentationView.areaEmptyHint"));
      expect(htmlArea).toContain("Chart Inspector");

      const htmlBox = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="box"
          setChartType={() => {}}
          initialConfig={{ xCol: "", yCol: "" }}
        />
      );
      expect(htmlBox).toContain(t("presentationView.boxEmptyHint"));
      expect(htmlBox).toContain("Chart Inspector");

      const htmlHist = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="histogram"
          setChartType={() => {}}
          initialControls={{ histogramCol: "" }}
        />
      );
      expect(htmlHist).toContain(t("presentationView.histogramEmptyHint"));
      expect(htmlHist).toContain("Chart Inspector");
    });

    it("renders synchronized empty instructions for scatter plot", () => {
      setLocale("en");
      const htmlScatter = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="scatter"
          setChartType={() => {}}
          initialConfig={{ xCol: "", yCol: "" }}
        />
      );
      expect(htmlScatter).toContain(t("presentationView.scatterEmptyHint"));
      expect(htmlScatter).toContain("Chart Inspector");

      // Vietnamese
      setLocale("vi");
      const htmlScatterVi = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={sampleDataset}
          chartType="scatter"
          setChartType={() => {}}
          initialConfig={{ xCol: "", yCol: "" }}
        />
      );
      expect(htmlScatterVi).toContain(t("presentationView.scatterEmptyHint"));
      expect(htmlScatterVi).toContain("Bảng điều khiển");
    });
  });

  describe("Task 5: Memoized Scatter, Box Plot, and Density Data", () => {
    const multiGroupDataset: Dataset = {
      id: "ds_memo_test",
      name: "Memo Test Dataset",
      rows: 6,
      columns: 3,
      columnNames: ["Group", "XVal", "YVal"],
      preview: [
        ["Group", "XVal", "YVal"],
        ["Alpha", "10", "100"],
        ["Alpha", "15", "120"],
        ["Alpha", "20", "110"],
        ["Beta", "25", "200"],
        ["Beta", "30", "220"],
        ["Beta", "35", "210"],
      ],
      data: [
        ["Group", "XVal", "YVal"],
        ["Alpha", "10", "100"],
        ["Alpha", "15", "120"],
        ["Alpha", "20", "110"],
        ["Beta", "25", "200"],
        ["Beta", "30", "220"],
        ["Beta", "35", "210"],
      ],
      variables: {
        Group: { name: "Group", label: "Group", type: "string", measure: "nominal", decimals: 0, align: "left" },
        XVal: { name: "XVal", label: "X Value", type: "numeric", measure: "scale", decimals: 1, align: "right" },
        YVal: { name: "YVal", label: "Y Value", type: "numeric", measure: "scale", decimals: 1, align: "right" },
      },
      sourceFormat: "csv",
      createdAt: "2026-10-21T00:00:00Z",
      updatedAt: "2026-10-21T00:00:00Z",
    };

    it("renders grouped scatter data when legendCol is configured", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiGroupDataset}
          chartType="scatter"
          setChartType={() => {}}
          initialConfig={{ xCol: "XVal", yCol: "YVal", legendCol: "Group" }}
        />
      );
      expect(html).toContain('data-testid="scatter-chart"');
      expect(html).toContain('data-name="Alpha"');
      expect(html).toContain('data-name="Beta"');
    });

    it("renders box plot statistics table and box chart data accurately", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiGroupDataset}
          chartType="box"
          setChartType={() => {}}
          initialConfig={{ xCol: "Group", yCol: "YVal" }}
        />
      );
      expect(html).toContain('data-testid="composed-chart"');
      expect(html).toContain("Alpha");
      expect(html).toContain("Beta");
      // Check summary table values
      expect(html).toContain("100.00");
      expect(html).toContain("220.00");
    });

    it("renders density estimation chart for groups", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiGroupDataset}
          chartType="density"
          setChartType={() => {}}
          initialControls={{ densityGroupCol: "Group", densityValueCol: "YVal" }}
        />
      );
      expect(html).toContain('data-testid="line-chart"');
      expect(html).toContain("Alpha");
      expect(html).toContain("Beta");
    });

    it("renders histogram combo chart with KDE density curve when showHistogramDensity is true", () => {
      const html = renderToStaticMarkup(
        <PresentationView
          tab="visualization"
          selectedDataset={multiGroupDataset}
          chartType="histogram"
          setChartType={() => {}}
          initialControls={{ histogramCol: "YVal", showHistogramDensity: true }}
        />
      );
      expect(html).toContain('data-testid="composed-chart"');
      expect(html).toContain('data-testid="line-series"');
    });
  });
});
