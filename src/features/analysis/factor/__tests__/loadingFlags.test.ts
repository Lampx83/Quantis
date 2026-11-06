import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLocale, setLocale } from "@/i18n";
import { FactorLoadingsTable } from "../FactorLoadingsTable";
import { getLoadingFlags } from "../loadingFlags";

describe("loading flags", () => {
  it("chooses a negative primary loading by magnitude", () => {
    expect(getLoadingFlags([0.30, -0.72, 0.28], 0.71)).toEqual({ primaryIndex: 1, flags: [] });
  });

  it("uses the first column for tied primary loadings and reports all applicable reasons", () => {
    expect(getLoadingFlags([0.09, -0.35, 0.35], 0.25)).toEqual({
      primaryIndex: 1, flags: ["weakLoading", "crossLoading", "lowCommunality"],
    });
  });

  it.each([
    { loadings: [0.3999], communality: 0.4, flags: ["weakLoading"] },
    { loadings: [0.40], communality: 0.4, flags: [] },
    { loadings: [0.48, 0.2999], communality: 0.4, flags: [] },
    { loadings: [0.48, -0.30], communality: 0.4, flags: ["crossLoading"] },
    { loadings: [-0.60, 0.40], communality: 0.4, flags: [] },
    { loadings: [-0.5999, 0.40], communality: 0.4, flags: ["crossLoading"] },
    { loadings: [0.61, 0.19], communality: 0.2999, flags: ["lowCommunality"] },
    { loadings: [0.61, 0.19], communality: 0.30, flags: [] },
  ])("uses the unrounded cutoffs for $loadings with communality $communality", ({ loadings, communality, flags }) => {
    expect(getLoadingFlags(loadings, communality).flags).toEqual(flags);
  });
});

describe("loadings table", () => {
  const originalLocale = getLocale();
  beforeEach(() => setLocale("en"));
  afterEach(() => setLocale(originalLocale));

  it("shows every item by default, preserving signs and highlighting the primary loading", () => {
    const html = renderToStaticMarkup(createElement(FactorLoadingsTable, {
      method: "paf", columnNames: ["clean_item", "cross_item"],
      solution: {
        nFactors: 2, rotation: "varimax", loadings: [[0.20, -0.72], [0.52, -0.48]],
        unrotatedLoadings: [[0.20, -0.72], [0.52, -0.48]], communalities: [0.5584, 0.5008],
        varianceBefore: [29.5, 23.46], varianceAfter: [15.52, 37.44],
      },
    }));
    expect(html).toContain("clean_item");
    expect(html).toContain("cross_item");
    expect(html).toMatch(/<strong[^>]*>-0\.720<\/strong>/);
    expect(html).toContain("0.558");
    expect(html).toContain("Cross-loading");
    expect(html).toContain("Needs review only");
  });
});
