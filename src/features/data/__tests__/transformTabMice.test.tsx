import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TransformTab, convertSparsePatches } from "../TransformTab";
import { useDataStore } from "@/stores/useDataStore";
import * as api from "@/api";
import { setLocale, t } from "@/i18n";
import type { Dataset, RubinColumnStatistic } from "@/types";

vi.mock("@/utils/imputation-worker-client", () => ({
  runHotDeckImputation: vi.fn(),
}));

vi.mock("@/utils/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/storage")>();
  return { ...actual, loadBackendApiUrl: () => "http://localhost:3001" };
});

const sampleDatasetWithMissing: Dataset = {
  id: "ds_mice_test",
  name: "Survey Data",
  rows: 4,
  columns: 3,
  columnNames: ["ID", "INCOME", "GENDER"],
  preview: [
    ["ID", "INCOME", "GENDER"],
    ["1", "1000", "Nam"],
    ["2", "", "Nữ"],      // empty cell
    ["3", "99", "Nam"],   // discrete missing 99 in INCOME
    ["4", "1500", "Nam"],
  ],
  data: [
    ["ID", "INCOME", "GENDER"],
    ["1", "1000", "Nam"],
    ["2", "", "Nữ"],
    ["3", "99", "Nam"],
    ["4", "1500", "Nam"],
  ],
  variables: {
    ID: { name: "ID", label: "ID", type: "string", measure: "nominal", decimals: 0, align: "left" },
    INCOME: {
      name: "INCOME",
      label: "INCOME",
      type: "numeric",
      measure: "scale",
      decimals: 2,
      align: "right",
      missingValues: ["99"],
    },
    GENDER: { name: "GENDER", label: "GENDER", type: "string", measure: "nominal", decimals: 0, align: "left" },
  },
  sourceFormat: "csv",
  createdAt: "2026-10-15T00:00:00Z",
  updatedAt: "2026-10-15T00:00:00Z",
};

describe("Task 4: MICE Multiple Imputation & Rubin Descriptive Pooling Report", () => {
  beforeEach(() => {
    setLocale("vi");
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDatasetWithMissing))],
      selectedDatasetId: "ds_mice_test",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("1. renders number of datasets (m) input with default 5 and range 2 to 20 when fill_mice is selected", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        setDatasets={useDataStore.getState().setDatasets}
        onSelectDataset={vi.fn()}
        initialAction="fill_mice"
        initialColsMultiple={["INCOME"]}
      />
    );

    // Kiểm tra label và input điều khiển tham số m
    expect(html).toContain(t("transformTab.mice.mLabel"));
    expect(html).toContain('min="2"');
    expect(html).toContain('max="20"');
    expect(html).toContain('value="5"');

    // Clamping logic
    expect(api.clampMiceM(1)).toBe(2);
    expect(api.clampMiceM(25)).toBe(20);
    expect(api.clampMiceM(10)).toBe(10);
    expect(api.clampMiceM(undefined)).toBe(5);
  });

  it("2. converts imputedDatasets into sparsePatches accurately using convertSparsePatches", () => {
    const originalRows = [
      ["ID", "INCOME", "GENDER"],
      ["1", "1000", "Nam"],
      ["2", "", "Nữ"],     // index 0 in data rows: empty
      ["3", "99", "Nam"],  // index 1 in data rows: missing code 99
      ["4", "1500", "Nam"],
    ];

    const imputedDatasets = [
      [
        ["ID", "INCOME", "GENDER"],
        ["1", "1000", "Nam"],
        ["2", "1200", "Nữ"],
        ["3", "1100", "Nam"],
        ["4", "1500", "Nam"],
      ],
      [
        ["ID", "INCOME", "GENDER"],
        ["1", "1000", "Nam"],
        ["2", "1250", "Nữ"],
        ["3", "1150", "Nam"],
        ["4", "1500", "Nam"],
      ],
      [
        ["ID", "INCOME", "GENDER"],
        ["1", "1000", "Nam"],
        ["2", "1300", "Nữ"],
        ["3", "1200", "Nam"],
        ["4", "1500", "Nam"],
      ],
    ];

    const patches = convertSparsePatches(
      originalRows,
      imputedDatasets,
      ["INCOME"],
      sampleDatasetWithMissing.variables
    );

    expect(patches["INCOME"]).toBeDefined();
    expect(patches["INCOME"]).toHaveLength(2);

    // Row 2 is dataRow index 1 (0-indexed without header)
    expect(patches["INCOME"][0]).toEqual({
      rowIndex: 1,
      values: ["1200", "1250", "1300"],
    });

    // Row 3 is dataRow index 2 (0-indexed without header)
    expect(patches["INCOME"][1]).toEqual({
      rowIndex: 2,
      values: ["1100", "1150", "1200"],
    });
  });

  it("3. applies MICE imputation, saves bundle dataset with readOnly and sparsePatches, and renders Rubin report table", async () => {
    const mockRubinStats: RubinColumnStatistic[] = [
      {
        column: "INCOME",
        missingCount: 2,
        originalMean: 1250.0,
        originalStd: 353.55,
        pooledMean: 1200.0,
        withinVariance: 12500.0,
        betweenVariance: 2500.0,
        totalVariance: 15833.33,
        rubinSe: 125.83,
        df: 2.85,
        fmi: 0.28,
        ciLower: 850.5,
        ciUpper: 1549.5,
      },
    ];

    const mockMiceResponse: api.MiceImputationResponse = {
      rows: [
        ["ID", "INCOME", "GENDER"],
        ["1", "1000", "Nam"],
        ["2", "1200", "Nữ"],
        ["3", "1100", "Nam"],
        ["4", "1500", "Nam"],
      ],
      imputedDatasets: [
        [
          ["ID", "INCOME", "GENDER"],
          ["1", "1000", "Nam"],
          ["2", "1200", "Nữ"],
          ["3", "1100", "Nam"],
          ["4", "1500", "Nam"],
        ],
        [
          ["ID", "INCOME", "GENDER"],
          ["1", "1000", "Nam"],
          ["2", "1250", "Nữ"],
          ["3", "1150", "Nam"],
          ["4", "1500", "Nam"],
        ],
        [
          ["ID", "INCOME", "GENDER"],
          ["1", "1000", "Nam"],
          ["2", "1300", "Nữ"],
          ["3", "1200", "Nam"],
          ["4", "1500", "Nam"],
        ],
      ],
      m: 3,
      imputedColumns: ["INCOME"],
      iterations: 5,
      rubinStatistics: mockRubinStats,
      statistics: [
        {
          column: "INCOME",
          missingCount: 2,
          originalMean: 1250.0,
          originalStd: 353.55,
          imputedMean: 1200.0,
          imputedStd: 216.02,
          min: 1000.0,
          max: 1500.0,
        },
      ],
    };

    const analyzeSpy = vi.spyOn(api, "analyzeMiceImputation").mockResolvedValue(mockMiceResponse);

    let rendered: any = null;
    function Harness() {
      rendered = TransformTab({
        selectedDs: sampleDatasetWithMissing,
        setDatasets: useDataStore.getState().setDatasets,
        onSelectDataset: vi.fn(),
        initialShowChoiceModal: true,
        initialColsMultiple: ["INCOME"],
        initialAction: "fill_mice",
        initialMiceM: 3,
      });
      return rendered;
    }

    renderToStaticMarkup(<Harness />);

    const buttons: any[] = [];
    function collectButtons(node: any) {
      if (!node) return;
      if (node.type === "button") buttons.push(node);
      if (node.props?.children) {
        const ch = Array.isArray(node.props.children) ? node.props.children : [node.props.children];
        ch.forEach(collectButtons);
      }
    }
    collectButtons(rendered);

    const createNewBtn = buttons.find((b) =>
      String(b.props?.children).includes(t("transformTab.createNewButton"))
    );
    expect(createNewBtn).toBeDefined();

    // Trigger create new dataset with MICE Bundle
    await createNewBtn.props.onClick();

    expect(analyzeSpy).toHaveBeenCalledWith(
      sampleDatasetWithMissing.data,
      ["INCOME"],
      sampleDatasetWithMissing.variables,
      expect.any(Number),
      3
    );

    const datasets = useDataStore.getState().datasets;
    expect(datasets).toHaveLength(2);

    const bundleDs = datasets[1];
    expect(bundleDs.name).toBe("Survey Data (MICE m=3)");
    expect(bundleDs.readOnly).toBe(true);
    expect(bundleDs.imputationMeta).toBeDefined();
    expect(bundleDs.imputationMeta?.m).toBe(3);
    expect(bundleDs.imputationMeta?.bundleId).toBeTruthy();
    expect(bundleDs.imputationMeta?.activeImputationIndex).toBe(1);
    expect(bundleDs.imputationMeta?.imputedColumns).toEqual(["INCOME"]);
    expect(bundleDs.imputationMeta?.rubinStatistics).toEqual(mockRubinStats);
    expect(bundleDs.imputationMeta?.sparsePatches["INCOME"]).toHaveLength(2);
    expect(bundleDs.imputationMeta?.originalRows).toEqual(sampleDatasetWithMissing.data);

    // Verify Rubin Descriptive Report Table rendering in Vietnamese
    const htmlVi = renderToStaticMarkup(
      <TransformTab
        selectedDs={bundleDs}
        setDatasets={useDataStore.getState().setDatasets}
        onSelectDataset={vi.fn()}
        initialLastTransformResult={{
          before: sampleDatasetWithMissing.data!,
          after: mockMiceResponse.rows,
          actionLabel: " (MICE m=3)",
          rubinStats: mockRubinStats,
        }}
      />
    );

    // Verify Rubin table headers in Vietnamese
    expect(htmlVi).toContain(t("transformTab.mice.colVariable"));
    expect(htmlVi).toContain(t("transformTab.mice.colMissingCount"));
    expect(htmlVi).toContain(t("transformTab.mice.colOriginalMeanRubin"));
    expect(htmlVi).toContain(t("transformTab.mice.colPooledMean"));
    expect(htmlVi).toContain(t("transformTab.mice.colRubinSe"));
    expect(htmlVi).toContain(t("transformTab.mice.colWithinVar"));
    expect(htmlVi).toContain(t("transformTab.mice.colBetweenVar"));
    expect(htmlVi).toContain(t("transformTab.mice.colDf"));
    expect(htmlVi).toContain(t("transformTab.mice.colFmi"));
    expect(htmlVi).toContain(t("transformTab.mice.colCi95"));

    // Verify numeric values in Rubin table
    expect(htmlVi).toContain("1200.00"); // pooledMean
    expect(htmlVi).toContain("125.83");  // rubinSe
    expect(htmlVi).toContain("2.85");    // df
    expect(htmlVi).toContain("28.0%");   // fmi
    expect(htmlVi).toContain("850.50");  // ciLower
    expect(htmlVi).toContain("1549.50"); // ciUpper

    // Verify Rubin Descriptive Report Table rendering in English
    setLocale("en");
    const htmlEn = renderToStaticMarkup(
      <TransformTab
        selectedDs={bundleDs}
        setDatasets={useDataStore.getState().setDatasets}
        onSelectDataset={vi.fn()}
        initialLastTransformResult={{
          before: sampleDatasetWithMissing.data!,
          after: mockMiceResponse.rows,
          actionLabel: " (MICE m=3)",
          rubinStats: mockRubinStats,
        }}
      />
    );

    expect(htmlEn).toContain(t("transformTab.mice.rubinReportTitle"));
    expect(htmlEn).toContain(t("transformTab.mice.colVariable"));
    expect(htmlEn).toContain(t("transformTab.mice.colOriginalMeanRubin"));
    expect(htmlEn).toContain(t("transformTab.mice.colPooledMean"));
    expect(htmlEn).toContain(t("transformTab.mice.colRubinSe"));
    expect(htmlEn).toContain(t("transformTab.mice.colWithinVar"));
    expect(htmlEn).toContain(t("transformTab.mice.colBetweenVar"));
    expect(htmlEn).toContain(t("transformTab.mice.colDf"));
    expect(htmlEn).toContain(t("transformTab.mice.colFmi"));
    expect(htmlEn).toContain(t("transformTab.mice.colCi95"));
  });
});
