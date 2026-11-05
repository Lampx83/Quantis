import { beforeEach, describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { Dataset, ReliabilityStatistics } from "@/types";
import { setLocale, t } from "@/i18n";
import { computeReliability, scaleVerdict, selectItem, toggleReverse } from "@/utils/reliability";
import { CurrentResultApa, apaSentence, formatApaNumber } from "../CurrentResultApa";
import { ReliabilityTab } from "../../tabs/ReliabilityTab";

const statsOf = (patch: Partial<ReliabilityStatistics> = {}): ReliabilityStatistics => ({
  alpha: 0.87, alphaStandardized: 0.88, ci: { lower: 0.82, upper: 0.91 },
  k: 5, nScaleSample: 412, nInput: 420, meanInterItemR: 0.6, ...patch,
});
const sentenceOf = (stats: ReliabilityStatistics) => apaSentence(stats, scaleVerdict(stats));

beforeEach(() => setLocale("en"));

describe("current-result APA", () => {
  it("reports exact vi/en values with APA decimals", () => {
    expect(sentenceOf(statsOf())).toBe("Internal consistency of the 5-item scale was good, α = .87, 95% CI [.82, .91], N = 412.");
    setLocale("vi");
    expect(sentenceOf(statsOf())).toBe("Độ tin cậy nội tại của thang đo 5 biến ở mức tốt, α = .87, 95% CI [.82, .91], N = 412.");
    expect(formatApaNumber(-0.125)).toBe("-.13");
  });

  it("omits unavailable CI instead of inventing bounds", () => {
    for (const locale of ["en", "vi"] as const) {
      setLocale(locale);
      const sentence = sentenceOf(statsOf({ ci: null }))!;
      expect(sentence).toContain("α = .87, N = 412.");
      expect(sentence).not.toMatch(/CI|—|NaN/);
    }
  });

  it("includes applicable caution or violation rather than unconditional success", () => {
    for (const locale of ["en", "vi"] as const) {
      setLocale(locale);
      for (const stats of [statsOf({ k: 2 }), statsOf({ nScaleSample: 12 }), statsOf({ alpha: 0.97 }), statsOf({ alpha: 0.75 }), statsOf({ alpha: 0.4 })]) {
        const assessment = scaleVerdict(stats);
        expect(apaSentence(stats, assessment)).toContain(t(`reliabilityVerdict.verdict.${assessment.verdict}`));
      }
    }
    setLocale("en");
    expect(sentenceOf(statsOf({ k: 2 }))).toContain("2");
    expect(sentenceOf(statsOf({ k: 2 }))).toContain("3");
    expect(sentenceOf(statsOf({ alpha: 0.4 }))).toContain("was poor");
  });

  it("disables copy and explains an uncomputable alpha", () => {
    for (const alpha of [null, NaN, Infinity]) {
      const stats = statsOf({ alpha });
      expect(sentenceOf(stats)).toBeNull();
      const html = renderToStaticMarkup(<CurrentResultApa statistics={stats} assessment={scaleVerdict(stats)} onCopy={() => {}} />);
      expect(html).toContain('disabled=""');
      expect(html).toContain(t("reliabilityTab.apaUnavailable"));
      expect(html).not.toContain("was good");
    }
  });

  it("follows selection, reversal and data edits without mutating source data", () => {
    const rows = [["A", "B", "C"], ["1", "2", "5"], ["2", "1", "4"], ["3", "4", "2"], ["4", "3", "1"], ["", "4", "2"]];
    const original = JSON.stringify(rows);
    let selection = { items: ["A", "B", "C"], reverse: {} };
    const current = () => {
      const result = computeReliability(rows, selection.items, selection.reverse);
      const sentence = apaSentence(result.statistics, result.verdict)!;
      expect(sentence).toContain(`α = ${formatApaNumber(result.statistics.alpha!)}`);
      expect(sentence).toContain(`N = ${result.statistics.nScaleSample}.`);
      return sentence;
    };
    const plain = current();
    selection = toggleReverse(selection, "C");
    const reversed = current();
    expect(reversed).not.toBe(plain);
    selection = selectItem(selection, "A");
    const twoItems = current();
    expect(twoItems).toContain("2-item");
    expect(twoItems).toContain("N = 5.");
    expect(computeReliability(rows, selection.items, selection.reverse).items.every((item) => item.alphaIfDeleted === null)).toBe(true);
    expect(JSON.stringify(rows)).toBe(original);
    const edited = rows.map((row) => [...row]);
    edited[1][1] = "5";
    const result = computeReliability(edited, selection.items, selection.reverse);
    const sentence = apaSentence(result.statistics, result.verdict)!;
    expect(sentence).not.toBe(twoItems);
    expect(sentence).toContain(`α = ${formatApaNumber(result.statistics.alpha!)}`);
  });

  it("renders guidance and no retired controls or old result before selection", () => {
    const dataset = { id: "fixture", name: "Fixture", columnNames: ["A", "B"], rows: 3 } as Dataset;
    for (const locale of ["en", "vi"] as const) {
      setLocale(locale);
      const html = renderToStaticMarkup(<ReliabilityTab selectedDataset={dataset} rows={[["A", "B"], ["1", "2"], ["2", "3"], ["3", "4"]]} />);
      expect(html).toContain(t("reliabilityTab.description"));
      expect(html).toContain(t("reliabilityTab.transformGuidance"));
      expect(html).toContain(t("reliabilityTab.removalGuidance"));
      expect(html).not.toMatch(/reliability-summary|current-result-apa|reliability-run|run-stale|revised-scale|item-excluded|Commit scale|Create scale score/);
    }
  });
});
