import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReliabilityItemDiagnostic, ReliabilityStatistics } from "@/types";
import { setLocale, t } from "@/i18n";
import { itemVerdict, scaleVerdict } from "@/utils/reliability";
import { ScaleVerdictCard } from "../ScaleVerdictCard";
import { ItemTable } from "../ItemTable";

const statsOf = (overrides: Partial<ReliabilityStatistics> = {}): ReliabilityStatistics => ({
  alpha: 0.85,
  alphaStandardized: 0.86,
  ci: { lower: 0.75, upper: 0.92 },
  k: 5,
  nScaleSample: 100,
  nInput: 100,
  meanInterItemR: 0.5,
  ...overrides,
});

const diagnostic = (overrides: Partial<ReliabilityItemDiagnostic> = {}): ReliabilityItemDiagnostic => ({
  name: "Q1",
  reverse: false,
  reflectionConstant: null,
  mean: 3.25,
  sd: 0.957,
  missingInInput: 0,
  correctedItemTotal: 0.5,
  alphaIfDeleted: 0.8,
  verdict: "pass",
  reasonKey: "reliabilityVerdict.item.pass",
  reasonParams: { citc: 0.5, threshold: 0.3 },
  ...overrides,
});

beforeEach(() => {
  setLocale("en");
});

describe("ScaleVerdictCard", () => {
  it("states the verdict, the α band and a reason with value and threshold", () => {
    const stats = statsOf({ alpha: 0.85 });
    const html = renderToStaticMarkup(
      <ScaleVerdictCard assessment={scaleVerdict(stats)} />
    );

    expect(html).toContain("Pass");
    expect(html).toContain("Good");
    expect(html).toContain("0.850");
    expect(html).toContain("0.800");
  });

  it("marks a redundancy warning as caution", () => {
    const stats = statsOf({ alpha: 0.96 });
    const html = renderToStaticMarkup(
      <ScaleVerdictCard assessment={scaleVerdict(stats)} />
    );

    expect(html).toContain("Caution");
    expect(html).toContain("0.960");
    expect(html).toContain("0.950");
  });

  it("marks a low alpha as a violation", () => {
    const stats = statsOf({ alpha: 0.6 });
    const html = renderToStaticMarkup(
      <ScaleVerdictCard assessment={scaleVerdict(stats)} />
    );

    expect(html).toContain("Violation");
    expect(html).toContain("0.600");
    expect(html).toContain("0.700");
  });

  it("renders Not applicable as a neutral state, not as a Verdict", () => {
    const stats = statsOf({ alpha: null });
    const html = renderToStaticMarkup(
      <ScaleVerdictCard assessment={scaleVerdict(stats, ["Q4"])} />
    );

    expect(html).toContain('data-verdict="notApplicable"');
    expect(html).toContain("Not applicable");
    expect(html).toContain("Q4");
    // Neutral styling, distinct from the three Verdict colours.
    expect(html).toContain("bg-neutral-100");
    expect(html).not.toContain("bg-amber-50");
    expect(html).not.toContain("bg-red-50");
  });
});

describe("ItemTable verdicts", () => {
  it("marks each row per verdict and states its reason", () => {
    const html = renderToStaticMarkup(
      <ItemTable
        items={[
          diagnostic({ name: "Q1", verdict: "pass" }),
          diagnostic({
            name: "Q2",
            verdict: "caution",
            correctedItemTotal: 0.12,
            reasonKey: "reliabilityVerdict.item.lowCitc",
            reasonParams: { citc: 0.12, threshold: 0.3 },
          }),
          diagnostic({
            name: "Q3",
            verdict: "violation",
            correctedItemTotal: -0.2,
            reasonKey: "reliabilityVerdict.item.negativeCitc",
            reasonParams: { citc: -0.2 },
          }),
        ]}
      />
    );

    expect(html).toContain('data-verdict="pass"');
    expect(html).toContain('data-verdict="caution"');
    expect(html).toContain('data-verdict="violation"');
    expect(html).toContain("CITC = 0.120 &lt; 0.300");
    expect(html).toContain("CITC = -0.200 &lt; 0");
    expect(html).toContain("⚠ &lt; 0.30");
    expect(html).toContain("⚠ &lt; 0");
    expect(html).toContain("✓ Good");
  });

  it("explains a Good CITC separately from the alpha-if-deleted warning", () => {
    for (const locale of ["en", "vi"] as const) {
      setLocale(locale);
      const html = renderToStaticMarkup(<ItemTable items={[diagnostic({
        verdict: "caution", reasonKey: "reliabilityVerdict.item.raisesAlpha",
        reasonParams: { alpha: 0.8, alphaIfDeleted: 0.9 }, alphaIfDeleted: 0.9,
      })]} />);
      const badge = html.match(/data-testid="item-verdict-Q1">([\s\S]*?)<\/button>/)![1];
      expect(badge).toContain(t("reliabilityVerdict.item.pass", { citc: "0.500", threshold: "0.300" }));
      expect(badge).not.toContain(t("reliabilityTab.citcRule"));
      expect(badge).not.toContain(t("reliabilityTab.flagRaisesAlpha"));
      expect(badge).toContain('data-testid="info-hint"');
    }
  });

  it("renders a Not applicable row without a verdict colour", () => {
    const html = renderToStaticMarkup(
      <ItemTable
        items={[
          diagnostic({
            name: "CONST",
            sd: 0,
            correctedItemTotal: null,
            verdict: "notApplicable",
            reasonKey: "reliabilityVerdict.item.constantItem",
            reasonParams: { item: "CONST" },
          }),
        ]}
      />
    );

    expect(html).toContain('data-verdict="notApplicable"');
    expect(html).not.toContain('data-verdict="violation"');
  });
});

describe("verdict i18n", () => {
  it("has both locales for every reason and band key the builders emit", () => {
    const cases: ReliabilityStatistics[] = [
      statsOf({ alpha: 0.96 }),
      statsOf({ alpha: 0.85 }),
      statsOf({ alpha: 0.75 }),
      statsOf({ alpha: 0.6 }),
      statsOf({ alpha: 0.85, k: 2 }),
      statsOf({ alpha: 0.85, nScaleSample: 10 }),
      statsOf({ alpha: null, nScaleSample: 2 }),
    ];
    const keys = new Set<string>([
      "reliabilityVerdict.verdict.pass",
      "reliabilityVerdict.verdict.caution",
      "reliabilityVerdict.verdict.violation",
      "reliabilityVerdict.verdict.notApplicable",
    ]);
    for (const stats of cases) {
      const assessment = scaleVerdict(stats);
      keys.add(assessment.reasonKey);
      if (assessment.bandKey) keys.add(assessment.bandKey);
    }
    keys.add(scaleVerdict(statsOf({ alpha: null }), ["Q4"]).reasonKey);

    const items: ReliabilityItemDiagnostic[] = [
      diagnostic({ name: "a", verdict: "pass" }),
      diagnostic({ name: "b", verdict: "caution", correctedItemTotal: 0.1 }),
      diagnostic({ name: "c", verdict: "violation", correctedItemTotal: -0.4 }),
      diagnostic({ name: "d", verdict: "notApplicable", sd: 0, correctedItemTotal: null }),
      diagnostic({ name: "e", verdict: "notApplicable", correctedItemTotal: null }),
      diagnostic({ name: "f", verdict: "caution", alphaIfDeleted: 0.9 }),
    ];
    for (const item of items) {
      keys.add(itemVerdict(item, 0.8).reasonKey);
    }

    for (const locale of ["en", "vi"] as const) {
      setLocale(locale);
      for (const key of keys) {
        expect(t(key), `${locale}:${key}`).not.toBe(key);
      }
    }
  });

  it("documents the two new glossary terms in both locales", () => {
    for (const term of ["standardizedAlpha", "interItemCorrelation"] as const) {
      for (const locale of ["en", "vi"] as const) {
        setLocale(locale);
        expect(t(`glossary.${term}.title`), `${locale}:${term}`).not.toBe(`glossary.${term}.title`);
        expect(t(`glossary.${term}.text`), `${locale}:${term}`).not.toBe(`glossary.${term}.text`);
      }
    }
  });
});

