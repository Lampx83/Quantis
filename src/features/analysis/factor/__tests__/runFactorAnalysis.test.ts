import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  activeFactorRun,
  finishFactorRun,
  runFactorAnalysis,
  startFactorRun,
  type FactorRunInput,
} from "../runFactorAnalysis";

vi.mock("@/utils/storage", async (importOriginal) => ({
  ...await importOriginal<typeof import("@/utils/storage")>(),
  loadBackendApiUrl: () => "http://127.0.0.1:4001",
}));

const columns = ["a", "b", "c"];
const rows = [columns, ...Array.from({ length: 12 }, (_, i) => [String(i), String(i % 4), String(i % 5)])];
const input: FactorRunInput = { datasetId: "survey", rows, columns, method: "paf", count: 1, backendAvailable: true };

const solution = {
  nFactors: 1, rotation: "none", loadings: [[0.5], [-0.6], [0.7]], unrotatedLoadings: [[0.5], [-0.6], [0.7]],
  communalities: [0.25, 0.36, 0.49], varianceBefore: [36.67], varianceAfter: [36.67],
};

function reply(overrides: Record<string, unknown> = {}) {
  return Response.json({ result: {
    method: "paf", columnNames: columns, nUsed: 12, ...solution,
    screeEigenvalues: [0.6, 0.1, -0.2], parallelCutoff: [0.5, 0.15, -0.3], suggestedCount: 1, parallelIssue: null, issue: null,
    ...overrides,
  } });
}

function deferredResponse() {
  let resolve!: (response: Response) => void;
  const promise = new Promise<Response>((done) => { resolve = done; });
  return { promise, resolve };
}

const fetchMock = vi.fn<typeof fetch>();
beforeEach(() => {
  fetchMock.mockReset();
  vi.stubGlobal("fetch", fetchMock);
});
afterEach(() => {
  vi.unstubAllGlobals();
});

describe("factor analysis routing and response validation", () => {
  it("runs PCA offline and reports the Python requirement for offline PAF", async () => {
    const pca = startFactorRun({ ...input, method: "pca", backendAvailable: false });
    expect(await runFactorAnalysis(pca.request)).toMatchObject({ issue: null, solution: { nFactors: 1 } });
    const paf = startFactorRun({ ...input, backendAvailable: false });
    expect(await runFactorAnalysis(paf.request)).toMatchObject({ issue: { code: "pafBackendRequired" }, solution: null });
    expect(fetchMock).not.toHaveBeenCalled();
  });

  it("posts only the ordered finite listwise sample to /paf", async () => {
    fetchMock.mockResolvedValueOnce(reply());
    const run = startFactorRun({ ...input, rows: [...rows, ["", "3", "4"], ["1", "Inf", "5"]] });
    expect(run.adequacy).toMatchObject({ n: 12, nInput: 14 });
    expect(await runFactorAnalysis(run.request)).toMatchObject({ issue: null, solution });
    const [url, init] = fetchMock.mock.calls[0];
    expect(url).toBe("http://127.0.0.1:4001/api/quantis/analyze/paf");
    expect(JSON.parse(String(init?.body))).toEqual({ rows, columnNames: columns, nFactors: 1 });
  });

  it("uses the compatible PCA endpoint and reads the full scree", async () => {
    fetchMock.mockResolvedValueOnce(reply({ method: "pca", screeEigenvalues: [1.5, 1.1, 0.4], suggestedCount: 2 }));
    const run = startFactorRun({ ...input, method: "pca" });
    expect(await runFactorAnalysis(run.request)).toMatchObject({ issue: null, eigenvalues: [1.5, 1.1, 0.4], suggestedCount: 2 });
    expect(fetchMock.mock.calls[0][0]).toBe("http://127.0.0.1:4001/api/quantis/analyze/efa");
  });

  it("requests automatic PAF when the count is blank", async () => {
    fetchMock.mockResolvedValueOnce(reply());
    const run = startFactorRun({ ...input, count: undefined });
    expect(await runFactorAnalysis(run.request)).toMatchObject({
      solution, suggestedCount: 1, eigenvalues: [0.6, 0.1, -0.2], parallelCutoff: [0.5, 0.15, -0.3],
    });
    expect(JSON.parse(String(fetchMock.mock.calls[0][1]?.body))).toEqual({ rows, columnNames: columns });
  });

  it.each([
    { suggestedCount: 0, issue: { code: "pafNoSuggestion" } },
    { suggestedCount: 3, issue: { code: "pafSuggestionOutOfRange", max: 1 } },
  ])("keeps the Scree without a solution when the automatic suggestion is %j", async (fields) => {
    fetchMock.mockResolvedValueOnce(reply({ nFactors: null, ...fields }));
    const run = startFactorRun({ ...input, count: undefined });
    expect(await runFactorAnalysis(run.request)).toMatchObject({
      ...fields, solution: null, eigenvalues: [0.6, 0.1, -0.2], parallelCutoff: [0.5, 0.15, -0.3],
    });
  });

  it("keeps a manual solution when the recommendation exceeds the computation limit", async () => {
    const limit = { code: "pafParallelLimit", maxRows: 3000, maxItems: 30 };
    fetchMock.mockResolvedValueOnce(reply({ suggestedCount: null, parallelCutoff: null, parallelIssue: limit }));
    const run = startFactorRun(input);
    expect(await runFactorAnalysis(run.request)).toMatchObject({ solution, suggestedCount: null, parallelCutoff: null, parallelIssue: limit });
  });

  it("preserves PAF Scree when extraction fails after computing the recommendation", async () => {
    const { result } = await reply({ nFactors: null }).json();
    fetchMock.mockResolvedValueOnce(Response.json({ detail: { code: "pafNonconvergence", result } }, { status: 422 }));
    expect(await runFactorAnalysis(startFactorRun(input).request)).toMatchObject({
      solution: null, issue: { code: "pafNonconvergence" }, suggestedCount: 1, eigenvalues: [0.6, 0.1, -0.2],
    });
  });

  it.each([
    { method: "pca" }, { nUsed: 13 }, { columnNames: ["b", "a", "c"] }, { nFactors: 2 }, { loadings: [[0.5]] },
  ])("rejects a response with mismatched or invalid fields %j", async (fields) => {
    fetchMock.mockResolvedValueOnce(reply(fields));
    const run = startFactorRun(input);
    expect(await runFactorAnalysis(run.request)).toMatchObject({ issue: { code: "backendResponseMismatch" }, solution: null });
  });

  it("distinguishes missing /paf, connection failures, and extraction errors", async () => {
    fetchMock.mockResolvedValueOnce(Response.json({ detail: "Not Found" }, { status: 404 }));
    fetchMock.mockRejectedValueOnce(new TypeError("Failed to fetch"));
    fetchMock.mockResolvedValueOnce(Response.json({ detail: { code: "pafHeywood", columns: ["a"] } }, { status: 422 }));
    const { request } = startFactorRun(input);
    expect(await runFactorAnalysis(request)).toMatchObject({ issue: { code: "pafEndpointUnavailable" } });
    expect(await runFactorAnalysis(request)).toMatchObject({ issue: { code: "backendConnectionFailed" } });
    expect(await runFactorAnalysis(request)).toMatchObject({ issue: { code: "pafHeywood", columns: ["a"] } });
    expect(fetchMock).toHaveBeenCalledTimes(3);
  });
});

describe("factor run state", () => {
  it("keeps the newer result when an earlier response arrives last", async () => {
    const slow = deferredResponse();
    fetchMock.mockReturnValueOnce(slow.promise).mockResolvedValueOnce(reply());
    const earlier = startFactorRun(input);
    const earlierResponse = runFactorAnalysis(earlier.request);
    const nextInput = { ...input };
    const next = startFactorRun(nextInput);
    const completed = finishFactorRun(next, next.request, await runFactorAnalysis(next.request));

    slow.resolve(Response.json({ detail: { code: "pafNonconvergence" } }, { status: 422 }));
    const final = finishFactorRun(completed, earlier.request, await earlierResponse);
    expect(activeFactorRun(final, nextInput)?.outcome).toMatchObject({ issue: null, solution });
  });

  it.each([
    { datasetId: "another" }, { rows: [...rows, ["0", "0", "0"]] }, { columns: ["b", "c"] }, { method: "pca" as const }, { count: 2 },
  ])("hides a pending run and its late result after input changes %j", async (change) => {
    const delayed = deferredResponse();
    fetchMock.mockReturnValueOnce(delayed.promise);
    const previous = startFactorRun(input);
    const response = runFactorAnalysis(previous.request);
    const changedInput = { ...input, ...change };
    expect(activeFactorRun(previous, changedInput)).toBeNull();

    delayed.resolve(reply());
    const completed = finishFactorRun(previous, previous.request, await response);
    expect(activeFactorRun(completed, changedInput)).toBeNull();
  });

  it("replaces a connection failure with a successful retry", async () => {
    fetchMock.mockRejectedValueOnce(new TypeError("offline")).mockResolvedValueOnce(reply());
    const failed = startFactorRun(input);
    const completed = finishFactorRun(failed, failed.request, await runFactorAnalysis(failed.request));
    expect(activeFactorRun(completed, input)?.outcome).toMatchObject({ issue: { code: "backendConnectionFailed" } });

    const retry = startFactorRun(input);
    expect(activeFactorRun(retry, input)?.outcome).toBeNull();
    const retried = finishFactorRun(retry, retry.request, await runFactorAnalysis(retry.request));
    expect(activeFactorRun(retried, input)?.outcome).toMatchObject({ issue: null, solution });
  });
});
