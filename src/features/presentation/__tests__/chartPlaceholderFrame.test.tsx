import { describe, it, expect, beforeEach, vi } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartPlaceholderFrame } from "../ChartPlaceholderFrame";
import { PresentationView } from "../PresentationView";
import { setLocale } from "@/i18n";
import type { Dataset } from "@/types";

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
    XAxis: () => null,
    YAxis: () => null,
    CartesianGrid: () => null,
    Legend: () => null,
    Tooltip: () => null,
    Bar: ({ children }: any) => <div>{children}</div>,
    Line: ({ children }: any) => <div>{children}</div>,
    Scatter: () => null,
    LabelList: () => null,
    ErrorBar: () => null,
  };
});

const sampleDataset: Dataset = {
  id: "ds1",
  name: "Sales Q3",
  columnNames: ["Department", "Score", "Rating"],
  data: [
    ["Department", "Score", "Rating"],
    ["Marketing", "85", "4"],
    ["Marketing", "90", "5"],
    ["Sales", "70", "3"],
    ["Sales", "95", "5"],
  ],
  variables: {
    Department: { name: "Department", type: "string", measure: "nominal" },
    Score: { name: "Score", type: "numeric", measure: "scale" },
    Rating: { name: "Rating", type: "numeric", measure: "scale" },
  },
};

describe("ChartPlaceholderFrame Component", () => {
  beforeEach(() => {
    setLocale("en");
  });

  it("renders with data-testid='chart-placeholder-frame'", () => {
    const html = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="bar" />
    );

    expect(html).toContain('data-testid="chart-placeholder-frame"');
  });

  it("contains no text inside the placeholder frame", () => {
    const html = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="bar" />
    );

    // Strips HTML tags and checks that there is no inner text
    const textOnly = html.replace(/<[^>]*>/g, "").trim();
    expect(textOnly).toBe("");
    expect(html).not.toContain("Configure");
    expect(html).not.toContain("Required");
    expect(html).not.toContain("Optional");
    expect(html).not.toContain("Select");
    expect(html).not.toContain("Inspector");
  });

  it("renders the dynamic watermark silhouette for column/bar chart", () => {
    const html = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="bar" />
    );

    expect(html).toContain('data-testid="watermark-silhouette-bar"');
  });

  it("renders the dynamic watermark silhouette for line chart", () => {
    const html = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="line" />
    );

    expect(html).toContain('data-testid="watermark-silhouette-line"');
  });

  it("renders the dynamic watermark silhouette for scatter chart", () => {
    const html = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="scatter" />
    );

    expect(html).toContain('data-testid="watermark-silhouette-scatter"');
  });

  it("renders the dynamic watermark silhouette for pie and donut charts", () => {
    const htmlPie = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="pie" />
    );
    expect(htmlPie).toContain('data-testid="watermark-silhouette-pie"');

    const htmlDonut = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="donut" />
    );
    expect(htmlDonut).toContain('data-testid="watermark-silhouette-donut"');
  });

  it("renders the dynamic watermark silhouette for histogram, box, and area", () => {
    const htmlHist = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="histogram" />
    );
    expect(htmlHist).toContain('data-testid="watermark-silhouette-histogram"');

    const htmlBox = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="box" />
    );
    expect(htmlBox).toContain('data-testid="watermark-silhouette-box"');

    const htmlArea = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="area" />
    );
    expect(htmlArea).toContain('data-testid="watermark-silhouette-area"');
  });

  it("renders the dynamic watermark silhouette for radar, heatmap, and barH", () => {
    const htmlRadar = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="radar" />
    );
    expect(htmlRadar).toContain('data-testid="watermark-silhouette-radar"');

    const htmlHeatmap = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="heatmap" />
    );
    expect(htmlHeatmap).toContain('data-testid="watermark-silhouette-heatmap"');

    const htmlBarH = renderToStaticMarkup(
      <ChartPlaceholderFrame chartType="barH" />
    );
    expect(htmlBarH).toContain('data-testid="watermark-silhouette-barH"');
  });
});

describe("PresentationView Empty State Integration with ChartPlaceholderFrame", () => {
  beforeEach(() => {
    setLocale("en");
  });

  it("renders ChartPlaceholderFrame when user has not chosen X axis for Column chart", () => {
    const html = renderToStaticMarkup(
      <PresentationView
        tab="visualization"
        selectedDataset={sampleDataset}
        chartType="bar"
        setChartType={() => {}}
        initialXCol=""
      />
    );

    expect(html).toContain('data-testid="chart-placeholder-frame"');
    expect(html).toContain('data-testid="watermark-silhouette-bar"');
    expect(html).toContain('data-testid="chart-inspector-panel"');
    expect(html).not.toContain('data-testid="bar-chart"');
  });

  it("replaces ChartPlaceholderFrame with BarChart once X axis is chosen", () => {
    const html = renderToStaticMarkup(
      <PresentationView
        tab="visualization"
        selectedDataset={sampleDataset}
        chartType="bar"
        setChartType={() => {}}
        initialXCol="Department"
      />
    );

    expect(html).not.toContain('data-testid="chart-placeholder-frame"');
    expect(html).toContain('data-testid="bar-chart"');
  });

  it("renders ChartPlaceholderFrame with line watermark when user has not chosen axes for Line chart", () => {
    const html = renderToStaticMarkup(
      <PresentationView
        tab="visualization"
        selectedDataset={sampleDataset}
        chartType="line"
        setChartType={() => {}}
        initialXCol=""
        initialYCol=""
      />
    );

    expect(html).toContain('data-testid="chart-placeholder-frame"');
    expect(html).toContain('data-testid="watermark-silhouette-line"');
    expect(html).not.toContain('data-testid="line-chart"');
  });
});
