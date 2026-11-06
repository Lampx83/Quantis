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
}

interface FactorOutcome {
  issue: FactorIssue | null;
  solution: FactorSolution | null;
  eigenvalues: number[];
  suggestedCount: number | null;
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
]);

function asRecord(value: unknown): Record<string, unknown> | null {
  return typeof value === "object" && value !== null ? value as Record<string, unknown> : null;
}

function readAnalysisError(value: unknown): FactorIssue {
  const detail = asRecord(value);
  if (typeof detail?.code !== "string" || !analysisErrorCodes.has(detail.code)) return { code: "backendAnalysisFailed" };
  const { code, max, columns } = detail;
  return {
    code,
    max: typeof max === "number" ? max : undefined,
    columns: Array.isArray(columns) && columns.every((name) => typeof name === "string") ? columns : undefined,
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

export async function runFactorAnalysis({ input, sample }: FactorRequest): Promise<FactorOutcome> {
  const { method, count, backendAvailable } = input;
  if (sample.issue && sample.issue.code !== "insufficientRows") return { ...emptyOutcome, issue: sample.issue };
  if (sample.nUsed < 10) return failed(method === "pca" ? "pcaMinimumRows" : "pafMinimumRows");
  if (!backendAvailable) {
    return method === "pca" ? computeFactorPca(sample, count) : failed("pafBackendRequired");
  }
  if (method === "paf" && count == null) return failed("pafCountRequired");

  const response = await requestFactorAnalysis(method, factorApiRows(sample), sample.columnNames, count);
  if (!response || [502, 503, 504].includes(response.status)) return failed("backendConnectionFailed");
  if (response.status === 404 || response.status === 405) {
    return failed(method === "paf" ? "pafEndpointUnavailable" : "backendResponseMismatch");
  }
  const body = asRecord(response.body);
  if (response.status < 200 || response.status >= 300) return { ...emptyOutcome, issue: readAnalysisError(body?.detail) };

  const result = asRecord(body?.result);
  const { columnNames, nUsed } = sample;
  const p = columnNames.length;
  if (result?.method !== method || result.nUsed !== nUsed || !Array.isArray(result.columnNames)
    || result.columnNames.length !== p || !result.columnNames.every((name, i) => name === columnNames[i])) {
    return failed("backendResponseMismatch");
  }
  const solution = readSolution(result, p, count);
  if (!solution || (method === "paf" && solution.nFactors === p)) return failed("backendResponseMismatch");
  if (method === "paf") return { ...emptyOutcome, issue: null, solution };

  const { screeEigenvalues, suggestedCount } = result;
  if (!isVector(screeEigenvalues, p) || typeof suggestedCount !== "number" || !Number.isInteger(suggestedCount)
    || suggestedCount < 0 || suggestedCount > p || (count == null && solution.nFactors !== Math.max(1, suggestedCount))) {
    return failed("backendResponseMismatch");
  }
  return { issue: null, solution, eigenvalues: screeEigenvalues, suggestedCount };
}
