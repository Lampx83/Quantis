import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { VariableMetadata } from "@/types";
import { setLocale } from "@/i18n";
import {
  ItemPicker,
  groupItems,
  itemLabel,
  numericItemColumns,
  selectionWarnings,
  visibleItems,
} from "../ItemPicker";

const variables = (): Record<string, VariableMetadata> => ({
  Q1_1: {
    name: "Q1_1",
    label: "I feel satisfied",
    type: "numeric",
    measure: "ordinal",
    decimals: 0,
    align: "right",
    valueLabels: { "1": "Strongly disagree", "5": "Strongly agree" },
  },
  Q1_2: {
    name: "Q1_2",
    label: "I would recommend it",
    type: "numeric",
    measure: "ordinal",
    decimals: 0,
    align: "right",
  },
  Q1_3: { name: "Q1_3", label: "", type: "numeric", measure: "ordinal", decimals: 0, align: "right" },
  Q2_1: { name: "Q2_1", label: "Declared nominal", type: "numeric", measure: "nominal", decimals: 0, align: "right" },
  AGE: { name: "AGE", label: "Age in years", type: "numeric", measure: "scale", decimals: 0, align: "right" },
  NOTE: { name: "NOTE", label: "Free text", type: "string", measure: "nominal", decimals: 0, align: "left" },
  BLANK: { name: "BLANK", label: "Never filled", type: "numeric", measure: "scale", decimals: 0, align: "right" },
});

/** Header + 4 data rows. BLANK is empty everywhere, NOTE holds text, Q2_1 uses a 1–7 scale. */
const rows = (): string[][] => [
  ["Q1_1", "Q1_2", "Q1_3", "Q2_1", "AGE", "NOTE", "BLANK"],
  ["5", "4", "5", "6", "21", "hello", ""],
  ["4", "5", "4", "7", "34", "world", ""],
  ["", "3", "5", "3", "28", "text", ""],
  ["3", "3", "3", "5", "45", "more", ""],
];

beforeEach(() => {
  setLocale("en");
});

describe("numericItemColumns", () => {
  it("never offers an all-blank column", () => {
    const columns = numericItemColumns(rows(), ["Q1_1", "Q1_2", "Q1_3", "Q2_1", "AGE", "NOTE", "BLANK"]);
    expect(columns).not.toContain("BLANK");
    expect(columns).toContain("Q1_1");
  });

  it("drops a column that holds real text", () => {
    expect(numericItemColumns(rows(), ["NOTE", "AGE"])).toEqual(["AGE"]);
  });

  it("keeps a column whose only non-numeric cells are declared missing codes (already blank)", () => {
    // getAnalysisRows() turns a declared code like 99 into "" before this filter runs.
    expect(numericItemColumns(rows(), ["Q1_1"])).toEqual(["Q1_1"]);
  });

  it("keeps a numeric column even when every value is the same", () => {
    const flat = [
      ["CONST"],
      ["4"],
      ["4"],
      ["4"],
    ];
    expect(numericItemColumns(flat, ["CONST"])).toEqual(["CONST"]);
  });
});

describe("itemLabel", () => {
  it("returns the label when the variable declares one", () => {
    expect(itemLabel("Q1_1", variables())).toBe("I feel satisfied");
  });

  it("returns null when there is no label or it repeats the name", () => {
    expect(itemLabel("Q1_3", variables())).toBeNull();
    expect(itemLabel("UNKNOWN", variables())).toBeNull();
  });
});

describe("grouping and filtering", () => {
  it("derives the group from the name prefix", () => {
    const items = visibleItems(rows(), ["Q1_1", "Q1_2", "Q1_3", "Q2_1", "AGE"], variables());
    const groups = groupItems(items);

    expect(groups.map((g) => g.prefix)).toEqual(["Q1", "Q2", null]);
    expect(groups[0].items.map((it) => it.name)).toEqual(["Q1_1", "Q1_2", "Q1_3"]);
    expect(groups[2].items.map((it) => it.name)).toEqual(["AGE"]);
  });

  it("matches the filter box against name or label, case-insensitively", () => {
    expect(visibleItems(rows(), ["Q1_1", "Q1_2", "AGE"], variables(), "recommend").map((it) => it.name)).toEqual([
      "Q1_2",
    ]);
    expect(visibleItems(rows(), ["Q1_1", "Q1_2", "AGE"], variables(), "age").map((it) => it.name)).toEqual(["AGE"]);
    expect(visibleItems(rows(), ["Q1_1", "Q1_2", "AGE"], variables(), "zzz")).toEqual([]);
  });

  it("only offers numeric columns", () => {
    const items = visibleItems(rows(), ["Q1_1", "NOTE", "BLANK", "AGE"], variables());
    expect(items.map((it) => it.name)).toEqual(["Q1_1", "AGE"]);
  });
});

describe("selectionWarnings", () => {
  it("warns when a selected item is declared nominal", () => {
    const warnings = selectionWarnings(rows(), ["Q1_1", "Q2_1"], variables());
    expect(warnings.find((w) => w.key === "reliabilityTab.warnNominalItems")).toEqual({
      key: "reliabilityTab.warnNominalItems",
      params: { items: "Q2_1" },
    });
  });

  it("warns when the selected items mix response scales", () => {
    const warnings = selectionWarnings(rows(), ["Q1_1", "Q2_1"], variables());
    expect(warnings.map((w) => w.key)).toContain("reliabilityTab.warnMixedValueSets");
  });

  it("stays silent for a coherent Likert block", () => {
    expect(selectionWarnings(rows(), ["Q1_1", "Q1_2", "Q1_3"], variables())).toEqual([]);
  });

  it("does not treat a missing cell as a different response scale", () => {
    // Q1_1 has a blank cell; its value set is still {3, 4, 5} — same as Q1_2 {3, 4, 5}.
    expect(selectionWarnings(rows(), ["Q1_1", "Q1_2"], variables())).toEqual([]);
  });
});

describe("ItemPicker", () => {
  it("renders labels next to names and groups by prefix", () => {
    const html = renderToStaticMarkup(
      <ItemPicker
        rows={rows()}
        columns={["Q1_1", "Q1_2", "Q1_3", "Q2_1", "AGE", "NOTE", "BLANK"]}
        variables={variables()}
        selected={["Q1_1"]}
        onToggle={() => {}}
      />
    );

    expect(html).toContain("Q1_1");
    expect(html).toContain("I feel satisfied");
    expect(html).toContain("Q1");
    expect(html).not.toContain("BLANK");
    expect(html).not.toContain("Free text");
  });

  it("states the selected-item count", () => {
    const html = renderToStaticMarkup(
      <ItemPicker
        rows={rows()}
        columns={["Q1_1", "Q1_2"]}
        variables={variables()}
        selected={["Q1_1", "Q1_2"]}
        onToggle={() => {}}
      />
    );
    expect(html).toContain("2");
  });
});
