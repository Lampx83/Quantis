import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { getLocale, setLocale } from "@/i18n";
import { ScreePlot } from "../ScreePlot";

const originalLocale = getLocale();
beforeEach(() => setLocale("en"));
afterEach(() => setLocale(originalLocale));

describe("Scree plot and its accessible values", () => {
  it("shows each PCA eigenvalue against 1 and reports suggested and used components separately", () => {
    const html = renderToStaticMarkup(<ScreePlot method="pca" eigenvalues={[1.775, 1.125, 0.1]} suggestedCount={2} usedCount={1} />);
    expect(html).toContain("Components suggested</dt><dd");
    expect(html).toMatch(/Components suggested<\/dt><dd[^>]*>2<\/dd>/);
    expect(html).toMatch(/Components used<\/dt><dd[^>]*>1<\/dd>/);
    expect(html).toContain("Eigenvalue threshold (1)");
    expect(html).toContain("View Scree values");
    expect(html).toMatch(/1\.775<\/td><td[^>]*>1\.000<\/td>/);
    expect(html).toMatch(/0\.100<\/td><td[^>]*>1\.000<\/td>/);
  });

  it("shows signed reduced eigenvalues and matched p95 cutoffs when PAF suggests zero", () => {
    const html = renderToStaticMarkup(<ScreePlot method="paf" eigenvalues={[0.05, -0.15]} parallelCutoff={[0.6, -0.35]} suggestedCount={0} usedCount={null} />);
    expect(html).toMatch(/Factors suggested<\/dt><dd[^>]*>0<\/dd>/);
    expect(html).toMatch(/Factors used<\/dt><dd[^>]*>—<\/dd>/);
    expect(html).toContain("SMC-reduced eigenvalues");
    expect(html).toContain("95th percentile of permutations");
    expect(html).toMatch(/-0\.150<\/td><td[^>]*>-0\.350<\/td>/);
  });

  it("keeps observed PAF values when the recommendation is unavailable", () => {
    setLocale("vi");
    const html = renderToStaticMarkup(<ScreePlot method="paf" eigenvalues={[1.5, -0.2]} suggestedCount={null} usedCount={1} />);
    expect(html).toMatch(/Số nhân tố gợi ý<\/dt><dd[^>]*>—<\/dd>/);
    expect(html).toMatch(/Số nhân tố đã dùng<\/dt><dd[^>]*>1<\/dd>/);
    expect(html).toContain("-0.200");
    expect(html).not.toContain("Phân vị 95");
  });
});
