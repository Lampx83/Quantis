import { describe, it, expect, vi, afterEach } from "vitest";
import { analyzeOLS } from "../api";

interface CapturedRequest {
  url: string;
  body: Record<string, unknown>;
}

function stubFetch(): CapturedRequest[] {
  const captured: CapturedRequest[] = [];
  const fetchMock = vi.fn(async (url: string | URL, init?: RequestInit) => {
    captured.push({
      url: String(url),
      body: JSON.parse(String(init?.body ?? "{}")),
    });
    return {
      ok: true,
      status: 200,
      json: async () => ({ result: { n: 10 } }),
    } as unknown as Response;
  });
  vi.stubGlobal("fetch", fetchMock);
  return captured;
}

afterEach(() => {
  vi.unstubAllGlobals();
});

const ROWS = [
  ["Y", "X"],
  ["1", "1"],
  ["2", "2"],
];
const BUNDLE = [ROWS, ROWS];

describe("analyzeOLS request shape", () => {
  it("sends only the original rows and no index for a plain four-argument call", async () => {
    const captured = stubFetch();

    await analyzeOLS(ROWS, "Y", ["X"]);

    const body = captured[0].body;
    expect(body.rows).toEqual(ROWS);
    expect(body.yCol).toBe("Y");
    expect(body.xCols).toEqual(["X"]);
    expect(body).not.toHaveProperty("activeImputationIndex");
  });

  it("omits the rows when a bundle drives the fit and no index names a judged table", async () => {
    const captured = stubFetch();

    await analyzeOLS(ROWS, "Y", ["X"], BUNDLE);

    const body = captured[0].body;
    expect(body.rows).toEqual([]);
    expect(body.imputedDatasets).toEqual(BUNDLE);
    expect(body).not.toHaveProperty("activeImputationIndex");
  });

  it("sends the original rows and index 0 so diagnostics judge the original table", async () => {
    const captured = stubFetch();

    await analyzeOLS(ROWS, "Y", ["X"], BUNDLE, 0);

    const body = captured[0].body;
    expect(body.rows).toEqual(ROWS);
    expect(body.imputedDatasets).toEqual(BUNDLE);
    expect(body.activeImputationIndex).toBe(0);
  });

  it("sends index 0 without a bundle too", async () => {
    const captured = stubFetch();

    await analyzeOLS(ROWS, "Y", ["X"], undefined, 0);

    const body = captured[0].body;
    expect(body.rows).toEqual(ROWS);
    expect(body.activeImputationIndex).toBe(0);
  });

  it("drops the duplicated rows and names the imputed table when the index is k >= 1", async () => {
    const captured = stubFetch();

    await analyzeOLS(ROWS, "Y", ["X"], BUNDLE, 2);

    const body = captured[0].body;
    expect(body.rows).toEqual([]);
    expect(body.imputedDatasets).toEqual(BUNDLE);
    expect(body.activeImputationIndex).toBe(2);
  });
});
