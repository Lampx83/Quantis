import { describe, it, expect, beforeEach, vi, afterEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import { TransformTab, HotDeckLoadingBanner } from "../TransformTab";
import { useDataStore } from "@/stores/useDataStore";
import { analyzeMiceImputation } from "@/api";
import { setLocale, t } from "@/i18n";
import { runHotDeckImputation } from "@/utils/imputation-worker-client";
import {
  imputeListwise,
  imputeMeanMedianMode,
  imputeHotDeck,
} from "@/utils/missing-imputation";
import type { Dataset } from "@/types";

vi.mock("@/utils/imputation-worker-client", () => ({
  runHotDeckImputation: vi.fn(),
}));

// Test tự chứa: base URL backend do mock cấp, KHÔNG phụ thuộc file .env của máy chạy test
// (getBase đọc loadBackendApiUrl() rồi mới tới VITE_QUANTIS_API_URL).
vi.mock("@/utils/storage", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/utils/storage")>();
  return { ...actual, loadBackendApiUrl: () => "http://localhost:3001" };
});

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

describe("Task 10: TransformTab Refactor & Missing Data Suite", () => {
  beforeEach(() => {
    setLocale("en");
    vi.mocked(runHotDeckImputation).mockReset();
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDatasetWithMissing))],
      selectedDatasetId: "ds_transform_test",
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("renders all missing data imputation options including fill_hot_deck and fill_mice", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
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
      AGE: { name: "AGE", label: "Age", type: "numeric" as const, measure: "scale" as const, decimals: 0, align: "right" as const },
      SALARY: { name: "SALARY", label: "Salary", type: "numeric" as const, measure: "scale" as const, decimals: 0, align: "right" as const },
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
    expect(t("transformTab.mice.maxIterLabel")).toBe("Maximum iterations");
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
    expect(t("transformTab.mice.maxIterLabel")).toBe("Số vòng lặp tối đa");
    expect(t("transformTab.mice.loading")).toBe("Đang thực thi nội suy MICE qua Python backend...");
    expect(t("transformTab.processing")).toBe("Đang xử lý...");
    expect(t("transformTab.mice.reportTitle")).toBe("Báo cáo MICE: Thống kê trước và sau nội suy");
    expect(t("transformTab.mice.colVariable")).toBe("Biến số");
    expect(t("transformTab.mice.colMissingCount")).toBe("Số ô khuyết");
    expect(t("transformTab.mice.colOriginalMean")).toBe("Mean (trước)");
    expect(t("transformTab.mice.colImputedMean")).toBe("Mean (sau MICE)");
    expect(t("transformTab.mice.colImputedStd")).toBe("Std (sau MICE)");
  });

  it.each(["fill_mean", "fill_median", "fill_mode", "drop_missing"] as const)("creates one derived dataset with an accurate row-count summary for %s", async (action) => {
    setLocale("en");
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDatasetWithMissing))],
      selectedDatasetId: "ds_transform_test",
    });

    let rendered: any = null;
    function Harness() {
      rendered = TransformTab({
        selectedDs: useDataStore.getState().datasets[0],
        onSelectDataset: vi.fn(),
        initialShowChoiceModal: true,
        initialColsMultiple: ["INCOME"],
        initialAction: action,
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
    // Filling selected missing cells does not affect every row in the dataset.
    const change = datasets[1].audit?.entries.slice(-1)[0];
    expect(change?.operation).toBe(action);
    expect(change?.rowCount).toBe(action === "drop_missing" ? 2 : undefined);

    // Deleting the newly created dataset should delete ONLY that dataset, leaving the original
    const newDsId = datasets[1].id;
    useDataStore.getState().removeDataset(newDsId);
    expect(useDataStore.getState().datasets.length).toBe(1);
    expect(useDataStore.getState().datasets[0].id).toBe("ds_transform_test");
  });

  it("localizes the hot-deck worker message", () => {
    setLocale("en");
    expect(t("transformTab.hotDeck.loading")).toBe(
      "Running hot-deck imputation in a Web Worker..."
    );
    setLocale("vi");
    expect(t("transformTab.hotDeck.loading")).toBe(
      "Đang thực hiện nội suy Hot-deck qua Web Worker..."
    );
  });

  it("renders the hot-deck spinner with a cancel button", () => {
    setLocale("en");
    const html = renderToStaticMarkup(<HotDeckLoadingBanner onCancel={vi.fn()} />);
    expect(html).toContain(t("transformTab.hotDeck.loading"));
    expect(html).toContain(t("transformTab.cancelButton"));
  });

  it("sends hot-deck work through the worker client and creates a new dataset", async () => {
    vi.mocked(runHotDeckImputation).mockResolvedValue([
      ["ID", "INCOME", "GENDER"],
      ["1", "1000", "Nam"],
      ["2", "1250", "Nữ"],
      ["3", "1250", "Nam"],
      ["4", "1500", "Nam"],
    ]);
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDatasetWithMissing))],
      selectedDatasetId: "ds_transform_test",
    });

    let rendered: any = null;
    function Harness() {
      rendered = TransformTab({
        selectedDs: useDataStore.getState().datasets[0],
        onSelectDataset: vi.fn(),
        initialShowChoiceModal: true,
        initialColsMultiple: ["INCOME"],
        initialAction: "fill_hot_deck",
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

    await createNewBtn.props.onClick();

    expect(runHotDeckImputation).toHaveBeenCalledWith(
      sampleDatasetWithMissing.data,
      ["INCOME"],
      sampleDatasetWithMissing.variables,
      expect.objectContaining({ signal: expect.any(AbortSignal) })
    );
    const datasets = useDataStore.getState().datasets;
    expect(datasets).toHaveLength(2);
    expect(datasets[1].name).toContain("(hot-deck)");
    expect(datasets[1].data?.[2][1]).toBe("1250");
  });

  it("cancels an in-flight hot-deck run without creating a dataset", async () => {
    let controller: AbortController | undefined;
    class CapturingAbortController extends AbortController {
      constructor() {
        super();
        controller = this;
      }
    }
    vi.stubGlobal("AbortController", CapturingAbortController);

    let signal: AbortSignal | undefined;
    vi.mocked(runHotDeckImputation).mockImplementation(
      (_data, _columns, _variables, options) => {
        signal = options?.signal;
        return new Promise<string[][]>((_resolve, reject) => {
          signal?.addEventListener("abort", () =>
            reject(new DOMException("The operation was aborted", "AbortError"))
          );
        });
      }
    );
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDatasetWithMissing))],
      selectedDatasetId: "ds_transform_test",
    });

    let rendered: any = null;
    function Harness() {
      rendered = TransformTab({
        selectedDs: useDataStore.getState().datasets[0],
        onSelectDataset: vi.fn(),
        initialShowChoiceModal: true,
        initialColsMultiple: ["INCOME"],
        initialAction: "fill_hot_deck",
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
    const pending = createNewBtn.props.onClick();
    await Promise.resolve();

    expect(signal).toBeDefined();
    controller!.abort();
    await pending;

    const datasets = useDataStore.getState().datasets;
    expect(datasets).toHaveLength(1);
    expect(datasets[0].id).toBe("ds_transform_test");
  });

  it("associates form labels with controls and provides accessibility attributes", () => {
    const dsWithManyCols: Dataset = {
      ...sampleDatasetWithMissing,
      columnNames: ["C1", "C2", "C3", "C4", "C5", "C6", "C7"],
      preview: [["C1", "C2", "C3", "C4", "C5", "C6", "C7"]],
      data: [["C1", "C2", "C3", "C4", "C5", "C6", "C7"]],
    };

    const htmlMice = renderToStaticMarkup(
      <TransformTab
        selectedDs={dsWithManyCols}
        onSelectDataset={vi.fn()}
        initialAction="fill_mice"
      />
    );
    expect(htmlMice).toContain('id="transform-col-search"');
    expect(htmlMice).toContain('for="transform-col-search"');
    expect(htmlMice).toContain('id="transform-mice-m"');
    expect(htmlMice).toContain('for="transform-mice-m"');
    expect(htmlMice).toContain('id="transform-mice-max-iter"');
    expect(htmlMice).toContain('for="transform-mice-max-iter"');

    const htmlRename = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="rename"
      />
    );
    expect(htmlRename).toContain('id="transform-rename-from"');
    expect(htmlRename).toContain('for="transform-rename-from"');
    expect(htmlRename).toContain('id="transform-rename-to"');
    expect(htmlRename).toContain('for="transform-rename-to"');
    expect(htmlRename).toContain('autoComplete="off"');

    const htmlCompute = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="compute"
      />
    );
    expect(htmlCompute).toContain('id="transform-compute-name"');
    expect(htmlCompute).toContain('for="transform-compute-name"');
    expect(htmlCompute).toContain('id="transform-compute-formula"');
    expect(htmlCompute).toContain('for="transform-compute-formula"');

    const htmlFilter = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="filter"
      />
    );
    expect(htmlFilter).toContain('id="transform-filter-col"');
    expect(htmlFilter).toContain('for="transform-filter-col"');
    expect(htmlFilter).toContain('id="transform-filter-op"');
    expect(htmlFilter).toContain('for="transform-filter-op"');
    expect(htmlFilter).toContain('id="transform-filter-val"');
    expect(htmlFilter).toContain('for="transform-filter-val"');

    const htmlSort = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="sort"
      />
    );
    expect(htmlSort).toContain('id="transform-sort-col"');
    expect(htmlSort).toContain('for="transform-sort-col"');
    expect(htmlSort).toContain('id="transform-sort-order"');
    expect(htmlSort).toContain('for="transform-sort-order"');

    const htmlRecode = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="recode"
      />
    );
    expect(htmlRecode).toContain('id="transform-recode-col"');
    expect(htmlRecode).toContain('for="transform-recode-col"');
    expect(htmlRecode).toContain('aria-label="Old value 1"');
    expect(htmlRecode).toContain('aria-label="New value 1"');
  });

  it("provides dialog semantics, backdrop accessibility, and scroll chaining containment for modals", () => {
    // 1. Choice Modal
    const htmlChoice = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialShowChoiceModal={true}
      />
    );
    expect(htmlChoice).toContain('role="dialog"');
    expect(htmlChoice).toContain('aria-modal="true"');
    expect(htmlChoice).toContain('aria-labelledby="transform-choice-modal-title"');
    expect(htmlChoice).toContain('id="transform-choice-modal-title"');
    expect(htmlChoice).toContain("overscroll-contain");
    expect(htmlChoice).toContain("focus-visible:ring-brand");
    expect(htmlChoice).toContain('aria-hidden="true"');

    // 2. Replace Confirm Modal
    const htmlReplace = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialReplaceConfirm={true}
      />
    );
    expect(htmlReplace).toContain('role="dialog"');
    expect(htmlReplace).toContain('aria-modal="true"');
    expect(htmlReplace).toContain('aria-labelledby="transform-replace-modal-title"');
    expect(htmlReplace).toContain('id="transform-replace-modal-title"');
    expect(htmlReplace).toContain("overscroll-contain");
    expect(htmlReplace).toContain("focus-visible:ring-brand");

    // 3. Invalidate Confirm Modal
    const htmlInvalidate = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialInvalidateConfirm={true}
      />
    );
    expect(htmlInvalidate).toContain('role="dialog"');
    expect(htmlInvalidate).toContain('aria-modal="true"');
    expect(htmlInvalidate).toContain('aria-labelledby="transform-invalidate-modal-title"');
    expect(htmlInvalidate).toContain('id="transform-invalidate-modal-title"');
    expect(htmlInvalidate).toContain("overscroll-contain");
    expect(htmlInvalidate).toContain("focus-visible:ring-brand");
  });
  it("renders the 4-tab segmented category switcher with role=\"tablist\" and correct category tabs", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
      />
    );

    expect(html).toContain('role="tablist"');
    expect(html).toContain('id="tab-missing"');
    expect(html).toContain('id="tab-scale"');
    expect(html).toContain('id="tab-clean"');
    expect(html).toContain('id="tab-variables"');
    expect(html).toContain("Missing");
    expect(html).toContain("Scale");
    expect(html).toContain("Clean");
    expect(html).toContain("Variables");
  });

  it("marks active category tab with aria-selected=\"true\", tabIndex=0, and inactive tabs with aria-selected=\"false\", tabIndex=-1", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="drop_missing"
      />
    );

    expect(html).toContain('id="tab-missing" aria-selected="true" aria-controls="tabpanel-missing" tabindex="0"');
    expect(html).toContain('id="tab-scale" aria-selected="false" aria-controls="tabpanel-scale" tabindex="-1"');
    expect(html).toContain('id="tab-clean" aria-selected="false" aria-controls="tabpanel-clean" tabindex="-1"');
    expect(html).toContain('id="tab-variables" aria-selected="false" aria-controls="tabpanel-variables" tabindex="-1"');
  });

  it("associates category tabs with tabpanel via aria-controls and aria-labelledby", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="drop_missing"
      />
    );

    expect(html).toContain('id="tabpanel-missing" role="tabpanel" aria-labelledby="tab-missing"');
  });

  it("displays only missing operations (6 items) when Missing category is active", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="drop_missing"
      />
    );

    const panelMatch = html.match(/id="tabpanel-missing"[^>]*>([\s\S]*?)<\/div><\/aside>/);
    expect(panelMatch).toBeTruthy();
    const panelHtml = panelMatch![1];

    expect(panelHtml).toContain('value="drop_missing"');
    expect(panelHtml).toContain('value="fill_mean"');
    expect(panelHtml).toContain('value="fill_median"');
    expect(panelHtml).toContain('value="fill_mode"');
    expect(panelHtml).toContain('value="fill_hot_deck"');
    expect(panelHtml).toContain('value="fill_mice"');

    expect(panelHtml).not.toContain('value="z_score"');
    expect(panelHtml).not.toContain('value="min_max"');
    expect(panelHtml).not.toContain('value="filter"');
    expect(panelHtml).not.toContain('value="compute"');
  });

  it("displays only scale operations (3 items) when Scale category is active", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="z_score"
      />
    );

    const panelMatch = html.match(/id="tabpanel-scale"[^>]*>([\s\S]*?)<\/div><\/aside>/);
    expect(panelMatch).toBeTruthy();
    const panelHtml = panelMatch![1];

    expect(panelHtml).toContain('value="z_score"');
    expect(panelHtml).toContain('value="min_max"');
    expect(panelHtml).toContain('value="log"');

    expect(panelHtml).not.toContain('value="drop_missing"');
    expect(panelHtml).not.toContain('value="filter"');
    expect(panelHtml).not.toContain('value="compute"');
  });

  it("displays only filter & clean operations (4 items) when Clean category is active", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="filter"
      />
    );

    const panelMatch = html.match(/id="tabpanel-clean"[^>]*>([\s\S]*?)<\/div><\/aside>/);
    expect(panelMatch).toBeTruthy();
    const panelHtml = panelMatch![1];

    expect(panelHtml).toContain('value="filter"');
    expect(panelHtml).toContain('value="outlier_iqr"');
    expect(panelHtml).toContain('value="dedupe"');
    expect(panelHtml).toContain('value="sort"');

    expect(panelHtml).not.toContain('value="drop_missing"');
    expect(panelHtml).not.toContain('value="z_score"');
    expect(panelHtml).not.toContain('value="compute"');
  });

  it("displays only variable & recode operations (5 items) when Variables category is active", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="compute"
      />
    );

    const panelMatch = html.match(/id="tabpanel-variables"[^>]*>([\s\S]*?)<\/div><\/aside>/);
    expect(panelMatch).toBeTruthy();
    const panelHtml = panelMatch![1];

    expect(panelHtml).toContain('value="compute"');
    expect(panelHtml).toContain('value="recode"');
    expect(panelHtml).toContain('value="rename"');
    expect(panelHtml).toContain('value="coerce_numeric"');
    expect(panelHtml).toContain('value="coerce_text"');

    expect(panelHtml).not.toContain('value="drop_missing"');
    expect(panelHtml).not.toContain('value="z_score"');
    expect(panelHtml).not.toContain('value="filter"');
  });

  it("automatically syncs active category tab when initialAction prop points to different categories", () => {
    const htmlScale = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="log"
      />
    );
    expect(htmlScale).toContain('id="tab-scale" aria-selected="true"');

    const htmlClean = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="dedupe"
      />
    );
    expect(htmlClean).toContain('id="tab-clean" aria-selected="true"');

    const htmlVars = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="coerce_text"
      />
    );
    expect(htmlVars).toContain('id="tab-variables" aria-selected="true"');
  });

  it("renders concise action labels, operation icons, and subtle badges on action buttons", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="drop_missing"
      />
    );

    // Concise labels
    expect(html).toContain("Drop missing rows");
    expect(html).toContain("Mean imputation");
    expect(html).toContain("Median imputation");
    expect(html).toContain("Mode imputation");
    expect(html).toContain("Hot-deck (KNN)");
    expect(html).toContain("MICE imputation");

    // Badges
    expect(html).toContain("Listwise");
    expect(html).toContain("Mean");
    expect(html).toContain("Median");
    expect(html).toContain("Mode");
    expect(html).toContain("KNN");
    expect(html).toContain("MICE");
  });

  it("applies active styling to currently selected action button with value attribute preserved", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="drop_missing"
      />
    );

    expect(html).toContain('value="drop_missing"');
    expect(html).toContain("bg-brand/10 text-brand font-semibold ring-1 ring-brand/30");
  });

  it("preserves hidden accessible action-selector-dropdown with all 18 options intact", () => {
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
      />
    );

    const selectMatch = html.match(/<select id="action-selector-dropdown"[^>]*>([\s\S]*?)<\/select>/);
    expect(selectMatch).toBeTruthy();
    const selectHtml = selectMatch![1];

    const all18Actions = [
      "drop_missing",
      "fill_mean",
      "fill_median",
      "fill_mode",
      "fill_hot_deck",
      "fill_mice",
      "z_score",
      "min_max",
      "filter",
      "sort",
      "recode",
      "rename",
      "coerce_numeric",
      "coerce_text",
      "compute",
      "log",
      "outlier_iqr",
      "dedupe",
    ];

    all18Actions.forEach((act) => {
      expect(selectHtml).toContain(`value="${act}"`);
    });
  });

  it("provides bilingual translations in English and Vietnamese for category tabs and concise action titles", () => {
    // English
    setLocale("en");
    expect(t("transformTab.tabMissing")).toBe("Missing");
    expect(t("transformTab.tabScale")).toBe("Scale");
    expect(t("transformTab.tabClean")).toBe("Clean");
    expect(t("transformTab.tabVariables")).toBe("Variables");

    expect(t("transformTab.shortActionDropMissing")).toBe("Drop missing rows");
    expect(t("transformTab.shortActionZScore")).toBe("Z-score standardize");
    expect(t("transformTab.shortActionFilter")).toBe("Filter rows");
    expect(t("transformTab.shortActionCompute")).toBe("Compute formula");

    // Vietnamese
    setLocale("vi");
    expect(t("transformTab.tabMissing")).toBe("Khuyết");
    expect(t("transformTab.tabScale")).toBe("Chuẩn hóa");
    expect(t("transformTab.tabClean")).toBe("Làm sạch");
    expect(t("transformTab.tabVariables")).toBe("Biến số");

    expect(t("transformTab.shortActionDropMissing")).toBe("Loại bỏ dòng thiếu");
    expect(t("transformTab.shortActionZScore")).toBe("Chuẩn hóa Z-score");
    expect(t("transformTab.shortActionFilter")).toBe("Lọc dòng");
    expect(t("transformTab.shortActionCompute")).toBe("Tính biến mới");
  });

  it("does not render redundant multi-column hint paragraph in any transform actions", () => {
    setLocale("en");
    const actionsTesting = ["drop_missing", "fill_mean", "z_score", "min_max", "log", "outlier_iqr"];
    for (const act of actionsTesting) {
      const html = renderToStaticMarkup(
        <TransformTab
          selectedDs={sampleDatasetWithMissing}
          onSelectDataset={vi.fn()}
          initialAction={act as any}
        />
      );
      expect(html).not.toContain(t("transformTab.columnsMultiHint"));
      expect(html).not.toContain("Select at least one column. With");
      expect(html).not.toContain("columns selected");
    }
  });

  it("Task 4: Compute Variable initializes metadata with empty label instead of formula", async () => {
    setLocale("en");
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDatasetWithMissing))],
      selectedDatasetId: "ds_transform_test",
    });
    const store = useDataStore.getState();
    store.updateCell(0, 0, "edited");
    const attach = vi.fn();

    let rendered: any = null;
    function ComputeHarness() {
      rendered = TransformTab({
        selectedDs: useDataStore.getState().datasets[0],
        onSelectDataset: store.setSelectedDatasetId,
        onWorkflowDatasetAdd: attach,
        initialAction: "compute",
        initialComputeName: "MEDIAN_INC",
        initialComputeFormula: "MEDIAN([INCOME])",
        initialShowChoiceModal: true,
      });
      return rendered;
    }

    renderToStaticMarkup(<ComputeHarness />);

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

    await createNewBtn.props.onClick();

    const datasets = useDataStore.getState().datasets;
    expect(datasets.length).toBe(2);
    const newDs = datasets[1];
    expect(attach).toHaveBeenCalledExactlyOnceWith(newDs.id);
    expect(useDataStore.getState().selectedDatasetId).toBe(newDs.id);
    expect(store.undoDataset()).toBe(false);
    expect(store.undoDataset(sampleDatasetWithMissing.id)).toBe(true);
    expect(useDataStore.getState().datasets[1]).toBe(newDs);
    expect(newDs.columnNames).toContain("MEDIAN_INC");
    expect(newDs.variables).toBeDefined();
    expect(newDs.variables!["MEDIAN_INC"]).toBeDefined();
    expect(newDs.variables!["MEDIAN_INC"].name).toBe("MEDIAN_INC");
    expect(newDs.variables!["MEDIAN_INC"].type).toBe("numeric");
    expect(newDs.variables!["MEDIAN_INC"].measure).toBe("scale");
    // CRITICAL: Label must be empty string, NOT the formula!
    expect(newDs.variables!["MEDIAN_INC"].label).toBe("");
  });

  it("Task 5: Recode with Range rules into Different Variable creates column and metadata", async () => {
    setLocale("en");
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDatasetWithMissing))],
      selectedDatasetId: "ds_transform_test",
    });

    let rendered: any = null;
    function RecodeHarness() {
      rendered = TransformTab({
        selectedDs: useDataStore.getState().datasets[0],
        onSelectDataset: vi.fn(),
        initialAction: "recode",
        initialShowChoiceModal: true,
        initialRecodeCol: "INCOME",
        initialRecodeTargetMode: "different",
        initialRecodeNewColName: "INCOME_LEVEL",
        initialRecodeRules: [
          { type: "range", rangeMin: "900", rangeMax: "1100", to: "Level 1" },
          { type: "range", rangeMin: "1400", rangeMax: "1600", to: "Level 2" },
        ],
        initialRecodeElseEnabled: true,
        initialRecodeElseAction: "custom",
        initialRecodeElseValue: "Other",
      });
      return rendered;
    }

    renderToStaticMarkup(<RecodeHarness />);

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

    await createNewBtn.props.onClick();

    const datasets = useDataStore.getState().datasets;
    expect(datasets.length).toBe(2);
    const newDs = datasets[1];
    expect(newDs.columnNames).toContain("INCOME_LEVEL");
    expect(newDs.variables!["INCOME_LEVEL"]).toBeDefined();
    expect(newDs.variables!["INCOME_LEVEL"].type).toBe("string");
    expect(newDs.variables!["INCOME_LEVEL"].measure).toBe("nominal");

    // Check recoded data rows
    // Row 1: INCOME 1000 -> Level 1
    // Row 2: empty -> Other
    // Row 3: 99 -> Other
    // Row 4: 1500 -> Level 2
    const data = newDs.data!;
    const levelColIdx = newDs.columnNames.indexOf("INCOME_LEVEL");
    expect(data[1][levelColIdx]).toBe("Level 1");
    expect(data[2][levelColIdx]).toBe("Other");
    expect(data[3][levelColIdx]).toBe("Other");
    expect(data[4][levelColIdx]).toBe("Level 2");

    // Original INCOME is untouched
    const origIncIdx = newDs.columnNames.indexOf("INCOME");
    expect(data[1][origIncIdx]).toBe("1000");
  });

  it("Recode into Different Variable infers numeric variable metadata when recoded values are numeric", async () => {
    setLocale("en");
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDatasetWithMissing))],
      selectedDatasetId: "ds_transform_test",
    });

    let rendered: any = null;
    function RecodeNumericHarness() {
      rendered = TransformTab({
        selectedDs: useDataStore.getState().datasets[0],
        onSelectDataset: vi.fn(),
        initialAction: "recode",
        initialShowChoiceModal: true,
        initialRecodeCol: "INCOME",
        initialRecodeTargetMode: "different",
        initialRecodeNewColName: "INCOME_TIER",
        initialRecodeRules: [
          { type: "range", rangeMin: "900", rangeMax: "1100", to: "1" },
          { type: "range", rangeMin: "1400", rangeMax: "1600", to: "2" },
        ],
        initialRecodeElseEnabled: true,
        initialRecodeElseAction: "custom",
        initialRecodeElseValue: "3",
      });
      return rendered;
    }

    renderToStaticMarkup(<RecodeNumericHarness />);

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

    await createNewBtn.props.onClick();

    const datasets = useDataStore.getState().datasets;
    expect(datasets.length).toBe(2);
    const newDs = datasets[1];
    expect(newDs.columnNames).toContain("INCOME_TIER");
    expect(newDs.variables!["INCOME_TIER"]).toBeDefined();
    expect(newDs.variables!["INCOME_TIER"].type).toBe("numeric");
    expect(newDs.variables!["INCOME_TIER"].measure).toBe("ordinal");
    expect(newDs.variables!["INCOME_TIER"].align).toBe("right");
  });

  it("Recode into Same Variable re-infers string variable metadata when numeric column is recoded to strings", async () => {
    setLocale("en");
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDatasetWithMissing))],
      selectedDatasetId: "ds_transform_test",
    });

    let rendered: any = null;
    function RecodeSameStringHarness() {
      rendered = TransformTab({
        selectedDs: useDataStore.getState().datasets[0],
        onSelectDataset: vi.fn(),
        initialAction: "recode",
        initialShowChoiceModal: true,
        initialRecodeCol: "INCOME",
        initialRecodeTargetMode: "same",
        initialRecodeRules: [
          { type: "value", from: "1000", to: "Low" },
          { type: "value", from: "1500", to: "High" },
        ],
        initialRecodeElseEnabled: true,
        initialRecodeElseAction: "custom",
        initialRecodeElseValue: "Medium",
      });
      return rendered;
    }

    renderToStaticMarkup(<RecodeSameStringHarness />);

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

    await createNewBtn.props.onClick();

    const datasets = useDataStore.getState().datasets;
    expect(datasets.length).toBe(2);
    const newDs = datasets[1];
    expect(newDs.variables!["INCOME"]).toBeDefined();
    expect(newDs.variables!["INCOME"].type).toBe("string");
    expect(newDs.variables!["INCOME"].measure).toBe("nominal");
  });

  it("Task 6: renders all new Recode UI controls (Same/Diff, Range, ELSE) in static markup", () => {
    setLocale("en");
    const html = renderToStaticMarkup(
      <TransformTab
        selectedDs={sampleDatasetWithMissing}
        onSelectDataset={vi.fn()}
        initialAction="recode"
        initialRecodeElseEnabled={true}
      />
    );

    expect(html).toContain('name="recodeTargetMode"');
    expect(html).toContain(t("transformTab.recodeTargetSame"));
    expect(html).toContain(t("transformTab.recodeTargetDifferent"));
    expect(html).toContain(t("transformTab.recodeTypeValue"));
    expect(html).toContain(t("transformTab.recodeTypeRange"));
    expect(html).toContain(t("transformTab.recodeElseToggle"));
    expect(html).toContain(t("transformTab.recodeElseActionCopy"));
    expect(html).toContain(t("transformTab.recodeElseActionSysmis"));
    expect(html).toContain(t("transformTab.recodeElseActionCustom"));
  });

  it("Task 6: Recode into Same Variable overwrites in place when overwriteOriginal is true", async () => {
    setLocale("en");
    useDataStore.setState({
      datasets: [JSON.parse(JSON.stringify(sampleDatasetWithMissing))],
      selectedDatasetId: "ds_transform_test",
    });

    let rendered: any = null;
    function SameVarHarness() {
      rendered = TransformTab({
        selectedDs: useDataStore.getState().datasets[0],
        onSelectDataset: vi.fn(),
        initialAction: "recode",
        initialShowChoiceModal: true,
        initialRecodeCol: "GENDER",
        initialRecodeTargetMode: "same",
        initialRecodeRules: [
          { type: "value", from: "Nam", to: "Male" },
          { type: "value", from: "Nữ", to: "Female" },
        ],
        initialRecodeElseEnabled: false,
      });
      return rendered;
    }

    renderToStaticMarkup(<SameVarHarness />);

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

    const overwriteBtn = buttons.find((b) =>
      String(b.props?.children).includes(t("transformTab.overwriteOriginalButton"))
    );
    expect(overwriteBtn).toBeDefined();

    await overwriteBtn.props.onClick();

    const datasets = useDataStore.getState().datasets;
    expect(datasets.length).toBe(1);
    const updatedDs = datasets[0];
    const genderIdx = updatedDs.columnNames.indexOf("GENDER");
    expect(updatedDs.data![1][genderIdx]).toBe("Male");
    expect(updatedDs.data![2][genderIdx]).toBe("Female");
    expect(useDataStore.getState().undoDataset()).toBe(true);
    expect(useDataStore.getState().datasets[0].data).toEqual(sampleDatasetWithMissing.data);
    expect(useDataStore.getState().redoDataset()).toBe(true);
    expect(useDataStore.getState().datasets[0].data).toEqual(updatedDs.data);
  });
});
