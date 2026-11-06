import { renderToStaticMarkup } from "react-dom/server";
import { expect, it } from "vitest";
import type { Dataset } from "@/types";
import { MLTab } from "../MLTab";
import { RegressionTab } from "../RegressionTab";
import { SEMTab } from "../SEMTab";

const dataset: Dataset = {
  id: "column-picker-test",
  name: "Column picker test",
  rows: 2,
  columns: 3,
  columnNames: ["Y", "X1", "X2"],
  preview: [["Y", "X1", "X2"], ["0", "2", "3"], ["1", "4", "5"]],
  sourceFormat: "csv",
  createdAt: "",
  updatedAt: "",
  variables: {
    X1: { name: "X1", label: "First predictor", type: "numeric", measure: "scale", decimals: 0, align: "right" },
  },
};
const showToast = () => {};
const unselectedX1 = /<button[^>]*aria-pressed="false"[^>]*><span[^>]*>X1<\/span><span[^>]*>— First predictor<\/span><\/button>/g;

it("shows the selected Regression predictor and excludes its outcome from the predictor buttons", () => {
  const html = renderToStaticMarkup(
    <RegressionTab selectedDataset={dataset} showToast={showToast} initialOlsYCol="Y" initialOlsXSelected={["X1"]} />,
  );
  const predictors = html.slice(html.indexOf('aria-pressed="true"'));
  expect(predictors).toMatch(/^aria-pressed="true"[^>]*><span[^>]*>X1<\/span><span[^>]*>— First predictor<\/span><\/button>/);
  expect(predictors.split("</div>", 1)[0]).not.toContain(">Y</span>");
});

it("shows SEM column buttons for mediation, path analysis, CFA, and PLS-SEM", () => {
  const html = renderToStaticMarkup(<SEMTab selectedDataset={dataset} analysisBackendAvailable showToast={showToast} />);
  expect(html.match(unselectedX1)).toHaveLength(4);
});

it("shows Machine Learning classification feature buttons", () => {
  const html = renderToStaticMarkup(<MLTab selectedDataset={dataset} />);
  expect(html.match(unselectedX1)).toHaveLength(1);
});
