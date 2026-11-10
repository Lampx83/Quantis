import { describe, it, expect, beforeEach } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import type { ReliabilityItemDiagnostic } from "@/types";
import { setLocale } from "@/i18n";
import { ItemCorrelationMatrix } from "../ItemCorrelationMatrix";
import { ItemTable, type ItemTableProps } from "../ItemTable";

const diagnostic = (overrides: Partial<ReliabilityItemDiagnostic> = {}): ReliabilityItemDiagnostic => ({
  name: "Q1",
  reverse: false,
  reflectionConstant: null,
  mean: 3.25,
  sd: 0.9574,
  missingInInput: 1,
  correctedItemTotal: 0.6123,
  alphaIfDeleted: 0.7009,
  verdict: "pass",
  reasonKey: "reliabilityVerdict.item.pass",
  reasonParams: { citc: 0.6123, threshold: 0.3 },
  ...overrides,
});

const render = (props: Partial<ItemTableProps> = {}) =>
  renderToStaticMarkup(
    <ItemTable
      items={[
        diagnostic(),
        diagnostic({ name: "Q2", mean: 4.1, sd: 0, missingInInput: 0, correctedItemTotal: null }),
      ]}
      {...props}
    />
  );

beforeEach(() => {
  setLocale("en");
});

describe("ItemTable", () => {
  it("shows Mean, SD, Missing, CITC and α-if-deleted for every item", () => {
    const html = render();

    expect(html).toContain("Mean");
    expect(html).toContain("SD");
    expect(html).toContain("Missing");
    expect(html).toContain("Corrected Item-Total Correlation");
    expect(html).toContain("Cronbach&#x27;s Alpha if Item Deleted");

    expect(html).toContain(">Q1<");
    expect(html).toContain(">Q2<");
    expect(html).toContain("3.250");
    expect(html).toContain("0.957");
    // Missing is counted on the input sample, not on the listwise sample.
    expect(html).toContain('data-testid="item-missing-Q1">1<');
    expect(html).toContain('data-testid="item-missing-Q2">0<');
    expect(html).toContain("0.612");
    expect(html).toContain("0.701");
  });

  it("renders α-if-deleted as Not applicable for k = 2, never as 0", () => {
    const html = render({
      items: [
        diagnostic({ name: "A", alphaIfDeleted: null, correctedItemTotal: 0.5 }),
        diagnostic({ name: "B", alphaIfDeleted: null, correctedItemTotal: 0.5 }),
      ],
    });

    expect(html).toContain('data-testid="item-alpha-deleted-A"');
    expect(html).toContain("Not applicable");
    expect(html).toContain("—");
  });

  it("says Not applicable for a constant item's CITC", () => {
    const html = render({
      items: [diagnostic({ name: "CONST", sd: 0, correctedItemTotal: null, verdict: "notApplicable" })],
    });
    expect(html).toContain('data-testid="item-citc-CONST"');
    expect(html).toContain("Not applicable");
  });
});

describe("ItemCorrelationMatrix", () => {
  const data = [
    [1, 2, 4],
    [2, 4, 3],
    [3, 6, 2],
    [4, 8, 1],
  ];
  const names = ["Q1", "Q2", "Q3"];

  it("is collapsed by default", () => {
    const html = renderToStaticMarkup(
      <ItemCorrelationMatrix data={data} names={names} />
    );
    expect(html).not.toContain("<table");
    expect(html).toContain("Inter-item correlations");
    expect(html).toContain('aria-expanded="false"');
    expect(html).not.toContain("Mean inter-item r");
  });

  it("renders a symmetric matrix with a unit diagonal when opened", () => {
    const html = renderToStaticMarkup(
      <ItemCorrelationMatrix data={data} names={names} initialOpen />
    );
    expect(html).toContain("<table");
    expect(html).toContain("1.000");
    expect(html).toContain("-1.000");
    // Q2 is a positive linear transform of Q1 → r = 1; Q3 is its mirror → r = -1.
    expect(html).toContain("Q3");
  });

  it("highlights negative and weak positive correlations, leaves undefined cells neutral", () => {
    // A and B are orthogonal. Weak has a small positive correlation with A.
    const fixture = [
      [-1, -1, -1.05, 1, 7],
      [-1, 1, 0.95, 1, 7],
      [1, -1, -0.95, -1, 7],
      [1, 1, 1.05, -1, 7],
    ];
    const html = renderToStaticMarkup(<ItemCorrelationMatrix data={fixture} names={["A", "B", "Weak", "Reverse", "Constant"]} initialOpen />);
    const cell = (i: number, j: number) => html.match(new RegExp(`<td[^>]*data-testid="correlation-${i}-${j}"[^>]*>[\\s\\S]*?</td>`))![0];
    for (const [i, j] of [[0, 1], [0, 2], [0, 3]]) {
      expect(cell(i, j)).toContain('data-low="true"');
      expect(cell(i, j)).toContain("bg-amber-100");
      expect(cell(i, j)).toContain("⚠");
    }
    expect(cell(0, 0)).not.toContain("data-low");
    expect(cell(0, 4)).toContain("bg-neutral-100");
    expect(cell(0, 4)).toContain("—");
    expect(cell(0, 4)).not.toContain("data-low");
    expect(cell(1, 2)).toContain("bg-teal-");
    expect(cell(1, 2)).not.toContain("data-low");
  });
});
