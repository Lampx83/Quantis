import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { getLocale, setLocale } from "@/i18n";
import { FactorVarianceTable } from "../FactorVarianceTable";

function tableRows(html: string) {
  return [...(html.match(/<tbody>.*<\/tbody>/)?.[0] ?? "").matchAll(/<tr[^>]*>(.*?)<\/tr>/g)]
    .map((row) => [...row[1].matchAll(/<(?:th|td)[^>]*>([^<]+)<\/(?:th|td)>/g)].map((cell) => cell[1]));
}

describe("factor variance table", () => {
  const locale = getLocale();
  afterEach(() => setLocale(locale));

  it("shows R survey PAF percentages and accumulates in the displayed loading order", () => {
    setLocale("en");
    const html = renderToStaticMarkup(
      <FactorVarianceTable method="paf" rotation="varimax"
        varianceBefore={[27.9104034708965, 21.5334458216664]}
        varianceAfter={[23.2335297270417, 26.2103195655213]} />,
    );
    expect(html).toContain("Before rotation");
    expect(html).toContain("After rotation");
    expect(html).toContain("total variance of the standardized items");
    expect(html).not.toContain("Eigenvalue");
    expect(tableRows(html)).toEqual([
      ["F1", "27.9%", "27.9%", "23.2%", "23.2%"],
      ["F2", "21.5%", "49.4%", "26.2%", "49.4%"],
    ]);
  });

  it("sums percentages before rounding them for display", () => {
    setLocale("en");
    const html = renderToStaticMarkup(
      <FactorVarianceTable method="pca" rotation="varimax"
        varianceBefore={[40.04, 20.04]} varianceAfter={[30.04, 30.04]} />,
    );
    expect(tableRows(html)[1]).toEqual(["PC2", "20.0%", "60.1%", "30.0%", "60.1%"]);
  });

  it("labels a single unrotated PCA component in Vietnamese", () => {
    setLocale("vi");
    const html = renderToStaticMarkup(
      <FactorVarianceTable method="pca" rotation="none" varianceBefore={[33.33]} varianceAfter={[33.33]} />,
    );
    expect(html).toContain("Thành phần");
    expect(html).not.toContain("Sau khi xoay");
    expect(tableRows(html)).toEqual([["PC1", "33.3%", "33.3%"]]);
  });
});
