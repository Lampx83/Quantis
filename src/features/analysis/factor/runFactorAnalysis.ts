import { requestFactorAnalysis } from "@/api";
import { createFactorSample, factorApiRows } from "@/utils/factorSample";
import { computeFactorPca, type FactorSolution } from "@/utils/factorPca";
import { computeKMOBartlett } from "@/utils/stats";

export type FactorMethod = "pca" | "paf";

export interface FactorRunInput {
  datasetId: string;
  rows: string[][];
  columns: string[];
  method: FactorMethod;
  count: number | undefined;
  backendAvailable: boolean;
}

interface FactorIssue {
  code: string;
  max?: number;
  columns?: string[];
  maxRows?: number;
  maxItems?: number;
}

interface FactorOutcome {
  issue: FactorIssue | null;
  solution: FactorSolution | null;
  eigenvalues: number[];
  suggestedCount: number | null;
  parallelCutoff?: number[] | null;
  parallelIssue?: FactorIssue | null;
}

type FactorRequest = { input: FactorRunInput; sample: ReturnType<typeof createFactorSample> };

interface FactorRunState {
  request: FactorRequest;
  adequacy: ReturnType<typeof computeKMOBartlett>;
  outcome: FactorOutcome | null;
}

export function startFactorRun(input: FactorRunInput): FactorRunState {
  const sample = createFactorSample(input.rows, input.columns);
  return { request: { input, sample }, adequacy: computeKMOBartlett(sample), outcome: null };
}

export function activeFactorRun(run: FactorRunState | null, input: FactorRunInput): FactorRunState | null {
  // A new input hides the previous run immediately, even while its request is pending.
  return run?.request.input === input ? run : null;
}

export function finishFactorRun(run: FactorRunState | null, request: FactorRequest, outcome: FactorOutcome): FactorRunState | null {
  return run?.request === request ? { ...run, outcome } : run;
}

const emptyOutcome = { solution: null, eigenvalues: [], suggestedCount: null };
const failed = (code: string): FactorOutcome => ({ ...emptyOutcome, issue: { code } });

const analysisErrorCodes = new Set([
  "invalidColumns", "missingColumns", "constantColumns", "rowLimit",
  "pcaMinimumRows", "pcaInvalidCount", "pcaEigenFailed", "pcaRotationFailed",
  "pafMinimumRows", "pafInvalidCount", "pafSingular", "pafEigenFailed", "pafNonpositiveRoots",
  "pafNonconvergence", "pafHeywood", "pafRotationFailed",
  "pafNoSuggestion", "pafSuggestionOutOfRange", "pafParallelLimit", "pafParallelFailed",
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function readAnalysisError(value: unknown): FactorIssue {
  const detail = asRecord(value);
  if (typeof detail?.code !== "string" || !analysisErrorCodes.has(detail.code)) return { code: "backendAnalysisFailed" };
  const { code, max, columns, maxRows, maxItems } = detail;
  return {
    code,
    max: typeof max === "number" ? max : undefined,
    columns: Array.isArray(columns) && columns.every((name) => typeof name === "string") ? columns : undefined,
    maxRows: typeof maxRows === "number" ? maxRows : undefined,
    maxItems: typeof maxItems === "number" ? maxItems : undefined,
  };
}

function isVector(value: unknown, length: number): value is number[] {
  return Array.isArray(value) && value.length === length && value.every(Number.isFinite);
}

function isMatrix(value: unknown, rows: number, columns: number): value is number[][] {
  return Array.isArray(value) && value.length === rows && value.every((row) => isVector(row, columns));
}

function readSolution(result: Record<string, unknown>, p: number, requested?: number): FactorSolution | null {
  const { nFactors, rotation, loadings, unrotatedLoadings, communalities, varianceBefore, varianceAfter } = result;
  if (typeof nFactors !== "number" || !Number.isInteger(nFactors) || nFactors < 1 || nFactors > p
    || (requested != null && nFactors !== requested)
    || (rotation !== "none" && rotation !== "varimax") || (nFactors === 1) !== (rotation === "none")
    || !isMatrix(loadings, p, nFactors) || !isMatrix(unrotatedLoadings, p, nFactors)
    || !isVector(communalities, p) || !isVector(varianceBefore, nFactors) || !isVector(varianceAfter, nFactors)) return null;
  return { nFactors, rotation, loadings, unrotatedLoadings, communalities, varianceBefore, varianceAfter };
}

function isSuggestedCount(value: unknown, items: number): value is number {
  return typeof value === "number" && Number.isInteger(value) && value >= 0 && value <= items;
}

function readPaf(result: Record<string, unknown>, items: number, count: number | undefined, error: FactorIssue | null): FactorOutcome {
  const { screeEigenvalues, suggestedCount, parallelCutoff } = result;
  if (!isVector(screeEigenvalues, items) || (suggestedCount !== null && !isSuggestedCount(suggestedCount, items))
    || (parallelCutoff !== null && !isVector(parallelCutoff, items))
    || (suggestedCount === null) !== (parallelCutoff === null)) {
    return failed("backendResponseMismatch");
  }
  const parallelIssue = result.parallelIssue === null ? null : readAnalysisError(result.parallelIssue);
  const issue = error ?? (result.issue === null ? null : readAnalysisError(result.issue));
  const solution = result.nFactors === null ? null : readSolution(result, items, count ?? suggestedCount ?? undefined);
  if (result.nFactors === null) {
    if (!issue && (!parallelIssue || count != null)) return failed("backendResponseMismatch");
  } else if (!solution || solution.nFactors === items || issue || (count == null && suggestedCount == null)) {
    return failed("backendResponseMismatch");
  }
  return { issue, solution, eigenvalues: screeEigenvalues, suggestedCount, parallelCutoff, parallelIssue };
}

export async function runFactorAnalysis({ input, sample }: FactorRequest): Promise<FactorOutcome> {
  const { method, count, backendAvailable } = input;
  if (sample.issue && sample.issue.code !== "insufficientRows") return { ...emptyOutcome, issue: sample.issue };
  if (sample.nUsed < 10) return failed(method === "pca" ? "pcaMinimumRows" : "pafMinimumRows");
  if (!backendAvailable) {
    return method === "pca" ? computeFactorPca(sample, count) : failed("pafBackendRequired");
  }
  const response = await requestFactorAnalysis(method, factorApiRows(sample), sample.columnNames, count);
  if (!response || [502, 503, 504].includes(response.status)) return failed("backendConnectionFailed");
  if (response.status === 404 || response.status === 405) {
    return failed(method === "paf" ? "pafEndpointUnavailable" : "backendResponseMismatch");
  }
  const body = asRecord(response.body);
  const ok = response.status >= 200 && response.status < 300;
  const detail = asRecord(body?.detail);
  const result = asRecord(ok ? body?.result : detail?.result);
  if (!ok && (method !== "paf" || !result)) return { ...emptyOutcome, issue: readAnalysisError(detail) };
  const { columnNames, nUsed } = sample;
  const p = columnNames.length;
  if (result?.method !== method || result.nUsed !== nUsed || !Array.isArray(result.columnNames)
    || result.columnNames.length !== p || !result.columnNames.every((name, i) => name === columnNames[i])) {
    return failed("backendResponseMismatch");
  }
  if (method === "paf") return readPaf(result, p, count, ok ? null : readAnalysisError(detail));
  const solution = readSolution(result, p, count);
  const { screeEigenvalues, suggestedCount } = result;
  if (!solution || !isVector(screeEigenvalues, p) || !isSuggestedCount(suggestedCount, p)
    || (count == null && solution.nFactors !== Math.max(1, suggestedCount))) {
    return failed("backendResponseMismatch");
  }
  return { issue: null, solution, eigenvalues: screeEigenvalues, suggestedCount };
}
