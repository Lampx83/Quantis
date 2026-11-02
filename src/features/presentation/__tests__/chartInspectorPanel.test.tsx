import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { ChartInspectorPanel, usesConfigAxes, supportsAutoTitle, supportsDataLabels, supportsOptions } from "../ChartInspectorPanel";
import { setLocale, t } from "@/i18n";
import { DEFAULT_CHART_CONFIG, DEFAULT_CHART_CONTROLS, type Dataset, type ChartConfig } from "@/types";

describe("ChartInspectorPanel Component", () => {
  beforeEach(() => {
    setLocale("en");
  });

  const mockDataset: Dataset = {
    id: "ds_panel_test",
    name: "Survey Dataset",
    rows: 4,
    columns: 3,
    columnNames: ["Department", "Satisfaction", "Gender"],
    preview: [
      ["Department", "Satisfaction", "Gender"],
      ["HR", "4.2", "F"],
      ["Sales", "3.8", "M"],
    ],
    data: [
      ["Department", "Satisfaction", "Gender"],
      ["HR", "4.2", "F"],
      ["Sales", "3.8", "M"],
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
      Satisfaction: {
        name: "Satisfaction",
        label: "Mức độ hài lòng",
        type: "numeric",
        measure: "scale",
        decimals: 2,
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
    createdAt: "2026-10-22",
    updatedAt: "2026-10-22",
  };

  const toHtmlEntities = (str: string) => str.replace(/&/g, "&amp;");

  it("renders all 4 accordion headers with i18n labels in English and Vietnamese", () => {
    setLocale("en");
    const htmlEn = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="bar"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        onChange={() => {}}
      />
    );

    expect(htmlEn).toContain(toHtmlEntities(t("presentationView.inspectorTitle")));
    expect(htmlEn).toContain(toHtmlEntities(t("presentationView.accordionData")));
    expect(htmlEn).toContain(toHtmlEntities(t("presentationView.accordionStyle")));
    expect(htmlEn).toContain(toHtmlEntities(t("presentationView.accordionErrorBars")));
    expect(htmlEn).toContain(toHtmlEntities(t("presentationView.accordionLabels")));

    setLocale("vi");
    const htmlVi = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="bar"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        onChange={() => {}}
      />
    );

    expect(htmlVi).toContain(toHtmlEntities(t("presentationView.inspectorTitle")));
    expect(htmlVi).toContain(toHtmlEntities(t("presentationView.accordionData")));
    expect(htmlVi).toContain(toHtmlEntities(t("presentationView.accordionStyle")));
    expect(htmlVi).toContain(toHtmlEntities(t("presentationView.accordionErrorBars")));
    expect(htmlVi).toContain(toHtmlEntities(t("presentationView.accordionLabels")));
  });

  it("defaults to only opening Data & Axes accordion and closing the rest", () => {
    // Academic chart (e.g., bar)
    const htmlBar = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="bar"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        onChange={() => {}}
      />
    );
    // Data & Axes is open
    expect(htmlBar).toMatch(/<details\s+open=""\s+class="group">[\s\S]*?Data &amp; Axes/);
    // Style & Palette, Error Bars, Labels & Typography are closed (no open attribute)
    expect(htmlBar).toMatch(/<details\s+class="group">[\s\S]*?Style &amp; Palette/);
    expect(htmlBar).toMatch(/<details\s+class="group">[\s\S]*?Error Bars/);
    expect(htmlBar).toMatch(/<details\s+class="group">[\s\S]*?Labels &amp; Typography/);

    // Non-academic chart with options (e.g., pie)
    const htmlPie = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="pie"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        onChange={() => {}}
      />
    );
    expect(htmlPie).toMatch(/<details\s+open=""\s+class="group">[\s\S]*?Data &amp; Axes/);
    expect(htmlPie).toMatch(/<details\s+class="group">[\s\S]*?Options/);
    expect(htmlPie).toMatch(/<details\s+class="group">[\s\S]*?Labels &amp; Typography/);
  });

  it("shows Legend selector for bar, line, and scatter, but hides it for pie and heatmap", () => {
    // Bar chart: should have legend selector
    const htmlBar = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="bar"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        onChange={() => {}}
      />
    );
    expect(htmlBar).toContain('data-testid="legend-col-select"');

    // Line chart: should have legend selector
    const htmlLine = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="line"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        onChange={() => {}}
      />
    );
    expect(htmlLine).toContain('data-testid="legend-col-select"');

    // Scatter chart: should have legend selector
    const htmlScatter = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="scatter"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        onChange={() => {}}
      />
    );
    expect(htmlScatter).toContain('data-testid="legend-col-select"');

    // Pie chart: should NOT have legend selector
    const htmlPie = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="pie"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        onChange={() => {}}
      />
    );
    expect(htmlPie).not.toContain('data-testid="legend-col-select"');

    // Heatmap chart: should NOT have legend selector
    const htmlHeatmap = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="heatmap"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        onChange={() => {}}
      />
    );
    expect(htmlHeatmap).not.toContain('data-testid="legend-col-select"');
  });

  it("disables error-bar type selector and shows notice when aggregation is not mean", () => {
    const configSum: ChartConfig = {
      ...DEFAULT_CHART_CONFIG,
      aggregation: "sum",
    };

    const html = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="bar"
        dataset={mockDataset}
        config={configSum}
        onChange={() => {}}
      />
    );

    expect(html).toContain('data-testid="error-bar-select"');
    expect(html).toContain("disabled");
    expect(html).toContain(toHtmlEntities(t("presentationView.errorBarMeanOnlyNotice")));
  });

  it("enables error-bar type selector when aggregation is mean", () => {
    const configMean: ChartConfig = {
      ...DEFAULT_CHART_CONFIG,
      aggregation: "mean",
    };

    const html = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="bar"
        dataset={mockDataset}
        config={configMean}
        onChange={() => {}}
      />
    );

    expect(html).toContain('data-testid="error-bar-select"');
    // Notice is not shown when mean
    expect(html).not.toContain(toHtmlEntities(t("presentationView.errorBarMeanOnlyNotice")));
  });

  it("defaults error-bar to 'none' (Off) in DEFAULT_CHART_CONFIG", () => {
    expect(DEFAULT_CHART_CONFIG.errorBar).toBe("none");
    const html = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="bar"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        onChange={() => {}}
      />
    );
    expect(html).toContain('data-testid="error-bar-select"');
    expect(html).toContain('<option value="none" selected=""');
  });

  it("renders variable labels in option elements alongside raw names", () => {
    const html = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="bar"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        onChange={() => {}}
      />
    );

    expect(html).toContain("Mức độ hài lòng (Satisfaction)");
    expect(html).toContain("Phòng ban (Department)");
  });

  it("renders Data & Axes and Options accordions for non-academic charts, excluding academic accordions", () => {
    const nonAcademicCharts = ["pie", "donut", "histogram", "box", "heatmap", "area", "density", "radar"];

    for (const chartType of nonAcademicCharts) {
      const html = renderToStaticMarkup(
        <ChartInspectorPanel
          chartType={chartType}
          dataset={mockDataset}
          config={DEFAULT_CHART_CONFIG}
          onChange={() => {}}
        />
      );

      expect(html, `chartType ${chartType} should have accordionData`).toContain(
        toHtmlEntities(t("presentationView.accordionData"))
      );
      if (["box", "area", "density"].includes(chartType)) {
        expect(html, `chartType ${chartType} without options should not have accordionOptions`).not.toContain(
          toHtmlEntities(t("presentationView.accordionOptions"))
        );
      } else {
        expect(html, `chartType ${chartType} with options should have accordionOptions`).toContain(
          toHtmlEntities(t("presentationView.accordionOptions"))
        );
      }
      expect(html, `chartType ${chartType} should not have accordionStyle`).not.toContain(
        toHtmlEntities(t("presentationView.accordionStyle"))
      );
      expect(html, `chartType ${chartType} should not have accordionErrorBars`).not.toContain(
        toHtmlEntities(t("presentationView.accordionErrorBars"))
      );
      expect(html, `chartType ${chartType} should have accordionLabels`).toContain(
        toHtmlEntities(t("presentationView.accordionLabels"))
      );
    }
  });

  it("verifies supportsOptions predicate correctly identifies charts with options", () => {
    const chartsWithOptions = ["pie", "donut", "histogram", "heatmap", "radar"];
    const chartsWithoutOptions = ["box", "area", "density", "bar", "barH", "line", "scatter"];

    for (const ct of chartsWithOptions) {
      expect(supportsOptions(ct), `${ct} should support options`).toBe(true);
    }
    for (const ct of chartsWithoutOptions) {
      expect(supportsOptions(ct), `${ct} should not support options`).toBe(false);
    }
  });

  it("renders pie and donut controls in panel", () => {
    // Pie: Legend + Values in Data & Axes, bin numeric toggle in Options
    const htmlPie = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="pie"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        controls={{ ...DEFAULT_CHART_CONTROLS, pieBinNumeric: true }}
        onChange={() => {}}
      />
    );
    expect(htmlPie).toContain('data-testid="pie-legend-col-select"');
    expect(htmlPie).toContain('data-testid="pie-values-col-select"');
    expect(htmlPie).not.toContain('data-testid="pie-y-col-select"');
    expect(htmlPie).toContain('data-testid="pie-bin-numeric-checkbox"');
    expect(htmlPie).toContain('data-testid="pie-numeric-col-select"');
    expect(htmlPie).toContain('data-testid="pie-bin-count-select"');

    // Donut: Legend + Values in Data & Axes, bin numeric in Options
    const htmlDonut = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="donut"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        controls={{ ...DEFAULT_CHART_CONTROLS, pieBinNumeric: false }}
        onChange={() => {}}
      />
    );
    expect(htmlDonut).toContain('data-testid="donut-legend-col-select"');
    expect(htmlDonut).toContain('data-testid="donut-values-col-select"');
    expect(htmlDonut).toContain('data-testid="pie-bin-numeric-checkbox"');
    expect(htmlDonut).not.toContain('data-testid="pie-numeric-col-select"');
  });

  it("renders area chart X and Y selectors in panel", () => {
    const htmlArea = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="area"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        controls={DEFAULT_CHART_CONTROLS}
        onChange={() => {}}
      />
    );
    expect(htmlArea).toContain('data-testid="area-x-col-select"');
    expect(htmlArea).toContain('data-testid="area-y-col-select"');
  });

  it("renders histogram distribution column and KDE overlay toggle in panel", () => {
    const htmlHist = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="histogram"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        controls={{ ...DEFAULT_CHART_CONTROLS, showHistogramDensity: true }}
        onChange={() => {}}
      />
    );
    expect(htmlHist).toContain('data-testid="histogram-col-select"');
    expect(htmlHist).toContain('data-testid="histogram-kde-checkbox"');
  });

  it("renders box chart group and value variable selectors in panel", () => {
    const htmlBox = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="box"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        controls={DEFAULT_CHART_CONTROLS}
        onChange={() => {}}
      />
    );
    expect(htmlBox).toContain('data-testid="box-group-col-select"');
    expect(htmlBox).toContain('data-testid="box-value-col-select"');
  });

  it("renders heatmap method buttons and CSV export in panel", () => {
    const htmlHeatmap = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="heatmap"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        controls={{ ...DEFAULT_CHART_CONTROLS, heatmapCorrMethod: "pearson" }}
        onExportCsv={() => {}}
        onChange={() => {}}
      />
    );
    expect(htmlHeatmap).toContain('data-testid="heatmap-method-pearson"');
    expect(htmlHeatmap).toContain('data-testid="heatmap-method-spearman"');
    expect(htmlHeatmap).toContain('data-testid="heatmap-method-kendall"');
    expect(htmlHeatmap).toContain('data-testid="heatmap-export-csv-btn"');
  });

  it("renders density group and value selectors in panel", () => {
    const htmlDensity = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="density"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        controls={DEFAULT_CHART_CONTROLS}
        onChange={() => {}}
      />
    );
    expect(htmlDensity).toContain('data-testid="density-group-col-select"');
    expect(htmlDensity).toContain('data-testid="density-value-col-select"');
  });

  it("renders radar group selector and numeric axes multi-select in panel", () => {
    const htmlRadar = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="radar"
        dataset={mockDataset}
        config={DEFAULT_CHART_CONFIG}
        controls={{ ...DEFAULT_CHART_CONTROLS, radarNumericCols: ["Satisfaction"] }}
        onChange={() => {}}
      />
    );
    expect(htmlRadar).toContain('data-testid="radar-group-col-select"');
    expect(htmlRadar).toContain('data-testid="radar-axis-checkbox-Satisfaction"');
    expect(htmlRadar).toContain(t("presentationView.numericAxesLabel"));
  });

  it("does not disable radar axis checkboxes when stale radarNumericCols from a previous dataset exceed limit", () => {
    const radarDataset: Dataset = {
      id: "ds_radar_stale_test",
      name: "Radar Stale Test Dataset",
      rows: 2,
      columns: 2,
      columnNames: ["Score", "Rating"],
      preview: [
        ["Score", "Rating"],
        ["10", "20"],
      ],
      data: [
        ["Score", "Rating"],
        ["10", "20"],
      ],
      variables: {
        Score: {
          name: "Score",
          label: "Score",
          type: "numeric",
          measure: "scale",
          decimals: 0,
          align: "right",
        },
        Rating: {
          name: "Rating",
          label: "Rating",
          type: "numeric",
          measure: "scale",
          decimals: 0,
          align: "right",
        },
      },
      sourceFormat: "csv",
      createdAt: "2026-10-22",
      updatedAt: "2026-10-22",
    };

    const html = renderToStaticMarkup(
      <ChartInspectorPanel
        chartType="radar"
        dataset={radarDataset}
        config={DEFAULT_CHART_CONFIG}
        controls={{
          ...DEFAULT_CHART_CONTROLS,
          radarNumericCols: ["A", "B", "C", "D", "E", "F", "G", "H"],
        }}
        onChange={() => {}}
      />
    );

    const scoreCheckbox = html.match(/<input[^>]*data-testid="radar-axis-checkbox-Score"[^>]*>/)?.[0];
    expect(scoreCheckbox).toBeDefined();
    expect(scoreCheckbox).not.toContain("disabled");

    const ratingCheckbox = html.match(/<input[^>]*data-testid="radar-axis-checkbox-Rating"[^>]*>/)?.[0];
    expect(ratingCheckbox).toBeDefined();
    expect(ratingCheckbox).not.toContain("disabled");
  });

  describe("Task 1: Axis Unification in Inspector", () => {
    it("restricts usesConfigAxes strictly to academic charts", () => {
      expect(usesConfigAxes("bar")).toBe(true);
      expect(usesConfigAxes("barH")).toBe(true);
      expect(usesConfigAxes("line")).toBe(true);
      expect(usesConfigAxes("scatter")).toBe(true);
      expect(usesConfigAxes("pie")).toBe(false);
      expect(usesConfigAxes("donut")).toBe(false);
      expect(usesConfigAxes("area")).toBe(false);
      expect(usesConfigAxes("box")).toBe(false);
      expect(usesConfigAxes("histogram")).toBe(false);
      expect(usesConfigAxes("heatmap")).toBe(false);
      expect(usesConfigAxes("density")).toBe(false);
      expect(usesConfigAxes("radar")).toBe(false);
    });

    it("binds pie, donut, area, and box X/Y selectors to chartConfig xCol and yCol", () => {
      const configWithAxes: ChartConfig = {
        ...DEFAULT_CHART_CONFIG,
        xCol: "Department",
        yCol: "Satisfaction",
      };

      // Pie chart
      const htmlPie = renderToStaticMarkup(
        <ChartInspectorPanel
          chartType="pie"
          dataset={mockDataset}
          config={configWithAxes}
          controls={DEFAULT_CHART_CONTROLS}
          onChange={() => {}}
        />
      );
      expect(htmlPie).toContain('data-testid="pie-legend-col-select"');
      expect(htmlPie).toContain('data-testid="pie-values-col-select"');
      expect(htmlPie).toContain('data-testid="pie-aggregation-select"');
      expect(htmlPie).toMatch(/<select[^>]*data-testid="pie-legend-col-select"[^>]*>[\s\S]*?<option[^>]*value="Department"[^>]*selected=""/);
      expect(htmlPie).toMatch(/<select[^>]*data-testid="pie-values-col-select"[^>]*>[\s\S]*?<option[^>]*value="Satisfaction"[^>]*selected=""/);

      // Donut chart
      const htmlDonut = renderToStaticMarkup(
        <ChartInspectorPanel
          chartType="donut"
          dataset={mockDataset}
          config={configWithAxes}
          controls={DEFAULT_CHART_CONTROLS}
          onChange={() => {}}
        />
      );
      expect(htmlDonut).toContain('data-testid="donut-legend-col-select"');
      expect(htmlDonut).toContain('data-testid="donut-values-col-select"');
      expect(htmlDonut).toContain('data-testid="donut-aggregation-select"');
      expect(htmlDonut).toMatch(/<select[^>]*data-testid="donut-legend-col-select"[^>]*>[\s\S]*?<option[^>]*value="Department"[^>]*selected=""/);
      expect(htmlDonut).toMatch(/<select[^>]*data-testid="donut-values-col-select"[^>]*>[\s\S]*?<option[^>]*value="Satisfaction"[^>]*selected=""/);

      // Area chart
      const htmlArea = renderToStaticMarkup(
        <ChartInspectorPanel
          chartType="area"
          dataset={mockDataset}
          config={configWithAxes}
          controls={DEFAULT_CHART_CONTROLS}
          onChange={() => {}}
        />
      );
      expect(htmlArea).toContain('data-testid="area-x-col-select"');
      expect(htmlArea).toContain('data-testid="area-y-col-select"');
      expect(htmlArea).toMatch(/<select[^>]*data-testid="area-x-col-select"[^>]*>[\s\S]*?<option[^>]*value="Department"[^>]*selected=""/);
      expect(htmlArea).toMatch(/<select[^>]*data-testid="area-y-col-select"[^>]*>[\s\S]*?<option[^>]*value="Satisfaction"[^>]*selected=""/);

      // Box plot
      const htmlBox = renderToStaticMarkup(
        <ChartInspectorPanel
          chartType="box"
          dataset={mockDataset}
          config={configWithAxes}
          controls={DEFAULT_CHART_CONTROLS}
          onChange={() => {}}
        />
      );
      expect(htmlBox).toContain('data-testid="box-group-col-select"');
      expect(htmlBox).toContain('data-testid="box-value-col-select"');
      expect(htmlBox).toMatch(/<select[^>]*data-testid="box-group-col-select"[^>]*>[\s\S]*?<option[^>]*value="Department"[^>]*selected=""/);
      expect(htmlBox).toMatch(/<select[^>]*data-testid="box-value-col-select"[^>]*>[\s\S]*?<option[^>]*value="Satisfaction"[^>]*selected=""/);
    });

    it("verifies supportsAutoTitle returns true for all 12 reachable charts", () => {
      const all12Charts = [
        "bar", "barH", "line", "scatter",
        "pie", "donut", "histogram", "box",
        "heatmap", "area", "density", "radar"
      ];
      for (const ct of all12Charts) {
        expect(supportsAutoTitle(ct), `${ct} should support auto title`).toBe(true);
      }
      expect(supportsAutoTitle("unsupported_chart")).toBe(false);
    });
  });

  describe("Task 5: Universal Labels & Typography Accordion in Inspector", () => {
    const all12Charts = [
      "bar", "barH", "line", "scatter",
      "pie", "donut", "histogram", "box",
      "heatmap", "area", "density", "radar"
    ];

    it("verifies supportsDataLabels predicate", () => {
      const dataLabelCharts = ["bar", "barH", "line", "pie", "donut", "histogram", "area", "radar"];
      const nonDataLabelCharts = ["scatter", "box", "density", "heatmap"];

      for (const ct of dataLabelCharts) {
        expect(supportsDataLabels(ct), `${ct} should support data labels`).toBe(true);
      }
      for (const ct of nonDataLabelCharts) {
        expect(supportsDataLabels(ct), `${ct} should not support data labels`).toBe(false);
      }
      expect(supportsDataLabels("unknown")).toBe(false);
    });

    it("renders Labels & Typography accordion with title override and subtitle for ALL 12 charts", () => {
      for (const chartType of all12Charts) {
        const html = renderToStaticMarkup(
          <ChartInspectorPanel
            chartType={chartType}
            dataset={mockDataset}
            config={DEFAULT_CHART_CONFIG}
            onChange={() => {}}
          />
        );
        expect(html, `${chartType} must have Labels & Typography accordion`).toContain(
          toHtmlEntities(t("presentationView.accordionLabels"))
        );
        expect(html, `${chartType} must have title override input`).toContain('data-testid="title-override-input"');
        expect(html, `${chartType} must have subtitle input`).toContain('data-testid="subtitle-input"');
      }
    });

    it("renders data labels checkbox only for supported charts, and excludes it for scatter, box, density, and heatmap", () => {
      const supported = ["bar", "barH", "line", "pie", "donut", "histogram", "area", "radar"];
      const excluded = ["scatter", "box", "density", "heatmap"];

      for (const chartType of supported) {
        const html = renderToStaticMarkup(
          <ChartInspectorPanel
            chartType={chartType}
            dataset={mockDataset}
            config={DEFAULT_CHART_CONFIG}
            onChange={() => {}}
          />
        );
        expect(html, `${chartType} should have show-data-labels-checkbox`).toContain('data-testid="show-data-labels-checkbox"');
      }

      for (const chartType of excluded) {
        const html = renderToStaticMarkup(
          <ChartInspectorPanel
            chartType={chartType}
            dataset={mockDataset}
            config={DEFAULT_CHART_CONFIG}
            onChange={() => {}}
          />
        );
        expect(html, `${chartType} should NOT have show-data-labels-checkbox`).not.toContain('data-testid="show-data-labels-checkbox"');
      }
    });
  });
  describe("Sort order controls in Data & Axes", () => {
    it("renders sort-order-select strictly for bar and barH charts", () => {
      const allowed = ["bar", "barH"];
      const excluded = ["line", "scatter", "pie", "donut", "histogram", "box", "area", "heatmap", "density", "radar"];

      for (const chartType of allowed) {
        const html = renderToStaticMarkup(
          <ChartInspectorPanel
            chartType={chartType}
            dataset={mockDataset}
            config={DEFAULT_CHART_CONFIG}
            onChange={() => {}}
          />
        );
        expect(html, `${chartType} should render sort-order-select`).toContain('data-testid="sort-order-select"');
        expect(html).toContain('value="category-asc"');
        expect(html).toContain('value="category-desc"');
        expect(html).toContain('value="value-asc"');
        expect(html).toContain('value="value-desc"');
        expect(html).toContain('value="none"');
      }

      for (const chartType of excluded) {
        const html = renderToStaticMarkup(
          <ChartInspectorPanel
            chartType={chartType}
            dataset={mockDataset}
            config={DEFAULT_CHART_CONFIG}
            onChange={() => {}}
          />
        );
        expect(html, `${chartType} should NOT render sort-order-select`).not.toContain('data-testid="sort-order-select"');
      }
    });

    it("disables value-asc and value-desc when a legend column is selected", () => {
      const htmlWithLegend = renderToStaticMarkup(
        <ChartInspectorPanel
          chartType="bar"
          dataset={mockDataset}
          config={{
            ...DEFAULT_CHART_CONFIG,
            xCol: "gender",
            yCol: "score",
            legendCol: "department",
          }}
          onChange={() => {}}
        />
      );

      // Verify disabled attribute on value-asc and value-desc
      expect(htmlWithLegend).toContain('<option value="value-asc" disabled=""');
      expect(htmlWithLegend).toContain('<option value="value-desc" disabled=""');
    });

    it("auto-falls back to category-asc if sortOrder was value-asc and legend is selected", () => {
      const html = renderToStaticMarkup(
        <ChartInspectorPanel
          chartType="bar"
          dataset={mockDataset}
          config={{
            ...DEFAULT_CHART_CONFIG,
            xCol: "gender",
            yCol: "score",
            legendCol: "department",
            sortOrder: "value-asc",
          }}
          onChange={() => {}}
        />
      );

      // The select element value should not remain value-asc when legend is selected
      expect(html).not.toContain('<option value="value-asc" selected');
    });

    it("rejects non-numeric columns in y-axis fallback when dataset has no variable metadata (F10)", () => {
      const datasetWithoutMeta: Dataset = {
        id: "ds_no_meta",
        name: "No Meta Dataset",
        rows: 2,
        columns: 2,
        columnNames: ["Department", "Score"],
        preview: [
          ["Department", "Score"],
          ["HR", "10"],
          ["Sales", "20"],
        ],
        data: [
          ["Department", "Score"],
          ["HR", "10"],
          ["Sales", "20"],
        ],
        variables: {},
        sourceFormat: "csv",
        createdAt: "2026-10-22",
        updatedAt: "2026-10-22",
      };

      const html = renderToStaticMarkup(
        <ChartInspectorPanel
          chartType="bar"
          dataset={datasetWithoutMeta}
          config={DEFAULT_CHART_CONFIG}
          onChange={() => {}}
        />
      );

      const ySelectMatch = html.match(/<select[^>]*data-testid="y-col-select"[^>]*>([\s\S]*?)<\/select>/);
      expect(ySelectMatch).toBeTruthy();
      const ySelectHtml = ySelectMatch![0];

      expect(ySelectHtml).toContain('value="Score"');
      expect(ySelectHtml).not.toContain('value="Department"');
    });
  });
});