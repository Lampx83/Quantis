import { create } from "zustand";
import type {
  DescriptiveRow,
  TTestResult,
  ChiSquareResult,
  ANOVAResult,
  MannWhitneyResult,
} from "@/utils/stats";
import type { analyzeOLS } from "@/api";

/** The /ols result a regression run produced, including its diagnostics payload. */
export type RegressionRunResult = NonNullable<Awaited<ReturnType<typeof analyzeOLS>>>;

/**
 * One completed OLS run and the context it was fitted in (R9.1).
 * Immutable: a new run replaces it, and the panel renders only from it.
 */
export interface RegressionRun {
  datasetId: string;
  /** The dataset's `updatedAt` at fit time — a later value marks the run stale (R9.2). */
  datasetUpdatedAt: string;
  datasetRowCount: number;
  yCol: string;
  xCols: string[];
  activeImputationIndex: number | null;
  result: RegressionRunResult;
}

export interface AnalysisState {
  // Correlation
  correlationMethod: "pearson" | "spearman" | "kendall";
  correlationBackendResult: { matrix: number[][]; columnNames: string[] } | null;
  correlationLoading: boolean;

  // Hypothesis test results
  lastHypothesisResult: {
    type: "ttest" | "chisquare" | "anova" | "mannwhitney";
    payload: TTestResult | ChiSquareResult | ANOVAResult | MannWhitneyResult;
    meta?: {
      groupCol?: string;
      groupVal1?: string;
      groupVal2?: string;
      numCol?: string;
      chiCol1?: string;
      chiCol2?: string;
      factorCol?: string;
      valueCol?: string;
    };
  } | null;

  // Descriptive
  descriptiveBackendResult: DescriptiveRow[] | null;

  // Last OLS run, bound to the dataset context it was fitted in
  regressionRun: RegressionRun | null;

  // Actions
  setCorrelationMethod: (method: "pearson" | "spearman" | "kendall") => void;
  setCorrelationBackendResult: (result: { matrix: number[][]; columnNames: string[] } | null) => void;
  setCorrelationLoading: (loading: boolean) => void;
  setLastHypothesisResult: (result: AnalysisState["lastHypothesisResult"]) => void;
  setDescriptiveBackendResult: (result: DescriptiveRow[] | null) => void;
  setRegressionRun: (run: RegressionRun) => void;
  clearRegressionRun: () => void;
  clearAnalysisCache: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  correlationMethod: "pearson",
  correlationBackendResult: null,
  correlationLoading: false,
  lastHypothesisResult: null,
  descriptiveBackendResult: null,
  regressionRun: null,

  setCorrelationMethod: (correlationMethod) => set({ correlationMethod }),
  setCorrelationBackendResult: (correlationBackendResult) => set({ correlationBackendResult }),
  setCorrelationLoading: (correlationLoading) => set({ correlationLoading }),
  setLastHypothesisResult: (lastHypothesisResult) => set({ lastHypothesisResult }),
  setDescriptiveBackendResult: (descriptiveBackendResult) => set({ descriptiveBackendResult }),
  setRegressionRun: (regressionRun) => set({ regressionRun }),
  clearRegressionRun: () => set({ regressionRun: null }),
  clearAnalysisCache: () =>
    set({
      correlationBackendResult: null,
      lastHypothesisResult: null,
      descriptiveBackendResult: null,
      correlationLoading: false,
    }),
}));
