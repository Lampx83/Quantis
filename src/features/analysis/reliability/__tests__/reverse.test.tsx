import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReliabilityItemDiagnostic, VariableMetadata } from "@/types";
import { setLocale, t } from "@/i18n";
import { buildMissingMatcher } from "@/utils/metadata";
import { getAnalysisRows } from "@/utils/stats";
import {
  computeReliability,
  reflectionConstant,
  reverseSuggestions,
  selectItem,
  toggleReverse,
  type ReliabilitySelection,
} from "@/utils/reliability";
import { ItemTable } from "../ItemTable";

/*
 * Golden fixture from dev-docs/golden/reliability_reference.py (same numbers as
 * src/utils/__tests__/reliability.test.ts): Q3 is written reverse-keyed.
 * Without the reflection:
 *   alpha = 0.191428571429, CITC(Q3) = -0.657801750231, alphaIfDeleted(Q3) = 0.725971370143
 * With the reflection (constant 6):
 *   alpha = 0.793043907252, CITC(Q3) = 0.657801750231
 */
const ITEMS = ["Q1", "Q2", "Q3", "Q4", "Q5"];
const RAW: number[][] = [
  [5, 4, 2, 5, 3],
  [4, 5, 1, 4, 2],
  [5, 4, 2, 5, 5],
  [3, 3, 3, 3, 2],
  [4, 4, 2, 4, 4],
  [2, 3, 4, 3, 2],
  [5, 5, 1, 5, 3],
  [3, 2, 4, 3, 4],
  [4, 4, 2, 4, 1],
  [3, 3, 3, 3, 3],
  [5, 4, 2, 5, 5],
  [4, 5, 1, 4, 1],
];
const ROWS: string[][] = [[...ITEMS], ...RAW.map((row) => row.map((v) => String(v)))];

beforeEach(() => {
  setLocale("en");
});

describe("reflectionConstant", () => {
  it("prefers the declared 1–5 scale from numeric value labels", () => {
    // The sample only shows 2–4, but the declared scale still reflects around 6.
    expect(reflectionConstant([2, 3, 4], { "1": "Disagree", "5": "Agree" })).toBe(6);
  });

  it("falls back to the observed min + max when there are no numeric labels", () => {
    expect(reflectionConstant([2, 3, 7])).toBe(9);
    expect(reflectionConstant([2, 3], { low: "Low", high: "High" })).toBe(5);
  });

  it("returns NaN for an empty column", () => {
    expect(Number.isNaN(reflectionConstant([]))).toBe(true);
  });

  it.each<Partial<VariableMetadata>>([
    { missingValues: ["99"], valueLabels: { "99": "No answer" } },
    { missingRange: { min: 98, max: 99 }, valueLabels: { "98": "Unknown", "99": "No answer" } },
    { missingValues: ["-1"], missingRange: { min: 98, max: 99 }, valueLabels: { "-1": "Not applicable", "98": "Unknown", "99": "No answer" } },
  ])("ignores declared missing labels when reversing a 1–5 item: %j", (missing) => {
    const variable: VariableMetadata = {
      name: "A", type: "numeric", label: "", measure: "ordinal", decimals: 0, align: "right",
      ...missing,
      valueLabels: { "1": "Disagree", "5": "Agree", ...missing.valueLabels },
    };
    const rows = [["A", "B"], ["1", "5"], ["2", "4"], ["3", "3"], ["4", "2"], ["5", "1"], ["99", "3"]];
    const clean = getAnalysisRows({ data: rows, variables: { A: variable } });
    const constant = reflectionConstant([], variable.valueLabels, buildMissingMatcher(variable));
    expect(constant).toBe(6);
    const result = computeReliability(clean, ["A", "B"], { A: true }, { A: constant });
    expect(result.sample.data.map((row) => row[0])).toEqual([5, 4, 3, 2, 1]);
    expect(result.items[0].mean).toBe(3);
    expect(result.items[0].missingInInput).toBe(1);
    expect(rows[1][0]).toBe("1");
  });

  it("falls back to valid observations when missing labels leave no declared scale", () => {
    expect(reflectionConstant([2, 3, 4, 99], { "99": "Missing" }, (value) => value === "99")).toBe(6);
  });
});

describe("reverse scoring", () => {
  it("flips the sign of CITC, raises α, and never touches the dataset", () => {
    const before = JSON.stringify(ROWS);
    const plain = computeReliability(ROWS, ITEMS);
    const reversed = computeReliability(ROWS, ITEMS, { Q3: true }, { Q3: 6 });

    expect(JSON.stringify(ROWS)).toBe(before);
    expect(plain.items[2].correctedItemTotal).toBeCloseTo(-0.657801750231, 9);
    expect(reversed.items[2].correctedItemTotal).toBeCloseTo(0.657801750231, 9);
    expect(reversed.statistics.alpha!).toBeGreaterThan(plain.statistics.alpha!);
    expect(reversed.statistics.alpha).toBeCloseTo(0.793043907252, 9);
  });

  it("displays the reflection constant that was used", () => {
    const reversed = computeReliability(ROWS, ITEMS, { Q3: true }, { Q3: 6 });
    expect(reversed.items[2].reverse).toBe(true);
    expect(reversed.items[2].reflectionConstant).toBe(6);
    expect(reversed.items[0].reflectionConstant).toBeNull();
  });
});

describe("reverseSuggestions", () => {
  it("suggests reversing an item whose CITC is negative and whose deletion would raise α", () => {
    const plain = computeReliability(ROWS, ITEMS);
    expect(reverseSuggestions(plain.items, plain.statistics.alpha)).toContain("Q3");
  });

  it("stops suggesting once the item is reversed", () => {
    const reversed = computeReliability(ROWS, ITEMS, { Q3: true }, { Q3: 6 });
    expect(reverseSuggestions(reversed.items, reversed.statistics.alpha)).toEqual([]);
  });

  it("never suggests when α is not computable", () => {
    const plain = computeReliability(ROWS, ITEMS);
    expect(reverseSuggestions(plain.items, null)).toEqual([]);
  });
});

describe("reliability selection state", () => {
  const base: ReliabilitySelection = { items: ["Q1", "Q2"], reverse: { Q1: true } };

  it("preserves retained reverse flags and discards a deselected flag", () => {
    expect(selectItem(base, "Q3")).toEqual({ items: ["Q1", "Q2", "Q3"], reverse: { Q1: true } });
    expect(selectItem(base, "Q1")).toEqual({ items: ["Q2"], reverse: {} });
    expect(selectItem(base, "Q2").reverse).toEqual({ Q1: true });
    expect(selectItem(selectItem(base, "Q1"), "Q1").reverse).toEqual({});
  });

  it("toggles one item's reverse flag without mutating the input", () => {
    const next = toggleReverse(base, "Q2");
    expect(next.reverse).toEqual({ Q1: true, Q2: true });
    expect(base.reverse).toEqual({ Q1: true });
    expect(toggleReverse(next, "Q1").reverse).toEqual({ Q1: false, Q2: true });
  });
});

describe("ItemTable reverse controls", () => {
  const item = (overrides: Partial<ReliabilityItemDiagnostic> = {}): ReliabilityItemDiagnostic => ({
    name: "Q3",
    reverse: false,
    reflectionConstant: null,
    mean: 3,
    sd: 1,
    missingInInput: 0,
    correctedItemTotal: -0.66,
    alphaIfDeleted: 0.73,
    verdict: "violation",
    reasonKey: "reliabilityVerdict.item.negativeCitc",
    reasonParams: { citc: -0.66 },
    ...overrides,
  });

  it("offers a reverse toggle for every row and marks the current state", () => {
    const html = renderToStaticMarkup(
      <ItemTable items={[item({ reverse: true, reflectionConstant: 6 })]} onToggleReverse={() => {}} />
    );
    expect(html).toContain(t("reliabilityTab.reverseToggle"));
    expect(html).toContain('aria-pressed="true"');
    // The constant that produced the reversed numbers stays visible.
    expect(html).toContain("6");
  });

  it("shows the suggestion with an action button, never an auto-enabled toggle", () => {
    const html = renderToStaticMarkup(
      <ItemTable
        items={[item()]}
        onToggleReverse={() => {}}
        reverseSuggestions={["Q3"]}
      />
    );
    expect(html).toContain(t("reliabilityTab.reverseSuggestion"));
    expect(html).toContain(t("reliabilityTab.reverseSuggestionAction"));
    // The toggle itself is still off — the suggestion must not flip it.
    expect(html).toContain('aria-pressed="false"');
  });

  it("renders no toggle when the table is read-only", () => {
    const html = renderToStaticMarkup(<ItemTable items={[item()]} />);
    expect(html).not.toContain(t("reliabilityTab.reverseToggle"));
  });
});
