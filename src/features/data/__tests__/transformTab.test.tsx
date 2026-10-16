import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { TransformTab } from "../TransformTab";
import { useDataStore } from "@/stores/useDataStore";
import { analyzeMiceImputation } from "@/api";
import { setLocale, t } from "@/i18n";
import {
  imputeListwise,
  imputeMeanMedianMode,
  imputeHotDeck,
} from "@/utils/missing-imputation";
import type { Dataset } from "@/types";

const sampleDatasetWithMissing: Dataset = {
  id: "ds_transform_test",
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
    ID: { name: "ID", type: "string", measure: "nominal", decimals: 0, align: "left" },
    INCOME: {
      name: "INCOME",
      type: "numeric",
      measure: "scale",
      decimals: 2,
      align: "right",
      missingValues: ["99"],
    },
    GENDER: { name: "GENDER", type: "string", measure: "nominal", decimals: 0, align: "left" },
  },
  sourceFormat: "csv",
  createdAt: "2026-10-15T00:00:00Z",
  updatedAt: "2026-10-15T00:00:00Z",
};

describe("Task 10: TransformTab Refactor & Missing Data Suite", () => {
  beforeEach(() => {
    setLocale("en");
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDatasetWithMissing))],
      selectedDatasetId: "ds_transform_test",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("renders all missing data imputation options including fill_hot_deck and fill_mice", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        setDatasets={vi.fn()}
        onSelectDataset={vi.fn()}
      />
    );

    expect(html).toContain('value="drop_missing"');
    expect(html).toContain('value="fill_mean"');
    expect(html).toContain('value="fill_median"');
    expect(html).toContain('value="fill_mode"');
    expect(html).toContain('value="fill_hot_deck"');
    expect(html).toContain('value="fill_mice"');
  });

  it("exports and imports missing imputation utilities from src/utils/missing-imputation", async () => {
    const missingModule = await import("@/utils/missing-imputation");
    expect(missingModule.imputeListwise).toBeDefined();
    expect(missingModule.imputeMeanMedianMode).toBeDefined();
    expect(missingModule.imputeHotDeck).toBeDefined();
    expect(missingModule.imputePairwise).toBeDefined();
  });

  it("applies imputeListwise to eliminate rows with missing codes without modifying original dataset immutability", () => {
    const dataRows = sampleDatasetWithMissing.data!;
    const result = imputeListwise(dataRows, ["INCOME"], sampleDatasetWithMissing.variables);

    // Row 2 (empty) and Row 3 (99) dropped
    expect(result.length).toBe(3); // header + rows 1 & 4
    expect(result[1][0]).toBe("1");
    expect(result[2][0]).toBe("4");
    // Original data remains untouched
    expect(sampleDatasetWithMissing.data!.length).toBe(5);
  });

  it("applies imputeMeanMedianMode and correctly replaces empty cells and discrete missing codes (99)", () => {
    const dataRows = sampleDatasetWithMissing.data!;
    const result = imputeMeanMedianMode(
      dataRows,
      ["INCOME"],
      sampleDatasetWithMissing.variables,
      "mean"
    );

    // Valid values are 1000 and 1500 -> Mean = 1250.00
    expect(result[2][1]).toBe("1250.00"); // row 2 was empty
    expect(result[3][1]).toBe("1250.00"); // row 3 was "99"
    expect(result[1][1]).toBe("1000");    // preserved
    expect(result[4][1]).toBe("1500");    // preserved
  });

  it("applies imputeHotDeck to borrow from closest donor", () => {
    const donorData = [
      ["ID", "AGE", "SALARY"],
      ["1", "25", "1000"],
      ["2", "50", "5000"],
      ["3", "26", ""], // missing SALARY, should borrow from row 1 (AGE 25 vs 50)
    ];
    const vars = {
      AGE: { name: "AGE", type: "numeric" as const, measure: "scale" as const, decimals: 0, align: "right" as const },
      SALARY: { name: "SALARY", type: "numeric" as const, measure: "scale" as const, decimals: 0, align: "right" as const },
    };

    const res = imputeHotDeck(donorData, ["SALARY"], vars);
    expect(res[3][2]).toBe("1000");
  });

  it("calls analyzeMiceImputation API and parses response with imputed rows and statistics", async () => {
    const mockMiceResponse = {
      rows: [
        ["ID", "INCOME", "GENDER"],
        ["1", "1000.00", "Nam"],
        ["2", "1250.00", "Nữ"],
        ["3", "1250.00", "Nam"],
        ["4", "1500.00", "Nam"],
      ],
      imputedColumns: ["INCOME"],
      statistics: [
        {
          column: "INCOME",
          missingCount: 2,
          originalMean: 1250.0,
          originalStd: 353.55,
          imputedMean: 1250.0,
          imputedStd: 204.12,
          min: 1000.0,
          max: 1500.0,
        },
      ],
      iterations: 3,
    };

    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockMiceResponse,
    });

    const res = await analyzeMiceImputation(
      sampleDatasetWithMissing.data!,
      ["INCOME"],
      sampleDatasetWithMissing.variables,
      10
    );

    expect(res).toEqual(mockMiceResponse);
    expect(res.imputedColumns).toContain("INCOME");
    expect(res.statistics[0].missingCount).toBe(2);
    expect(res.iterations).toBe(3);
  });

  it("provides bilingual localization for MICE parameters, descriptions, and reports", () => {
    // English verification
    setLocale("en");
    expect(t("transformTab.mice.maxIterLabel")).toBe("Maximum iterations (max_iter)");
    expect(t("transformTab.mice.loading")).toBe("Executing MICE imputation via Python backend...");
    expect(t("transformTab.processing")).toBe("Processing...");
    expect(t("transformTab.mice.reportTitle")).toBe("MICE Report: Pre & Post Imputation Statistics");
    expect(t("transformTab.mice.colVariable")).toBe("Variable");
    expect(t("transformTab.mice.colMissingCount")).toBe("Missing cells");
    expect(t("transformTab.mice.colOriginalMean")).toBe("Mean (before)");
    expect(t("transformTab.mice.colImputedMean")).toBe("Mean (after MICE)");
    expect(t("transformTab.mice.colImputedStd")).toBe("Std (after MICE)");

    // Vietnamese verification
    setLocale("vi");
    expect(t("transformTab.mice.maxIterLabel")).toBe("Số vòng lặp tối đa (max_iter)");
    expect(t("transformTab.mice.loading")).toBe("Đang thực thi nội suy MICE qua Python backend...");
    expect(t("transformTab.processing")).toBe("Đang xử lý...");
    expect(t("transformTab.mice.reportTitle")).toBe("Báo cáo MICE: Thống kê trước và sau nội suy");
    expect(t("transformTab.mice.colVariable")).toBe("Biến số");
    expect(t("transformTab.mice.colMissingCount")).toBe("Số ô khuyết");
    expect(t("transformTab.mice.colOriginalMean")).toBe("Mean (trước)");
    expect(t("transformTab.mice.colImputedMean")).toBe("Mean (sau MICE)");
    expect(t("transformTab.mice.colImputedStd")).toBe("Std (sau MICE)");
  });

  it("does not duplicate dataset in useDataStore when creating a new dataset from transform", async () => {
    setLocale("en");
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDatasetWithMissing))],
      selectedDatasetId: "ds_transform_test",
    });

    let rendered: any = null;
    function Harness() {
      rendered = TransformTab({
        selectedDs: sampleDatasetWithMissing,
        setDatasets: useDataStore.getState().setDatasets,
        onSelectDataset: vi.fn(),
        initialShowChoiceModal: true,
        initialColsMultiple: ["INCOME"],
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

    // Trigger create new dataset
    await createNewBtn.props.onClick();

    const datasets = useDataStore.getState().datasets;
    // Before action: 1 dataset.
    // After action: exactly 2 datasets (1 original + 1 newly created), NOT 3!
    expect(datasets.length).toBe(2);
    expect(datasets[0].id).toBe("ds_transform_test");
    expect(datasets[1].id).not.toBe("ds_transform_test");

    // Deleting the newly created dataset should delete ONLY that dataset, leaving the original
    const newDsId = datasets[1].id;
    useDataStore.getState().removeDataset(newDsId);
    expect(useDataStore.getState().datasets.length).toBe(1);
    expect(useDataStore.getState().datasets[0].id).toBe("ds_transform_test");
  });
});
