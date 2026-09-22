import { create } from "zustand";
import type {
  DescriptiveRow,
  TTestResult,
  ChiSquareResult,
  ANOVAResult,
  MannWhitneyResult,
} from "@/utils/stats";

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

  // Actions
  setCorrelationMethod: (method: "pearson" | "spearman" | "kendall") => void;
  setCorrelationBackendResult: (result: { matrix: number[][]; columnNames: string[] } | null) => void;
  setCorrelationLoading: (loading: boolean) => void;
  setLastHypothesisResult: (result: AnalysisState["lastHypothesisResult"]) => void;
  setDescriptiveBackendResult: (result: DescriptiveRow[] | null) => void;
  clearAnalysisCache: () => void;
}

export const useAnalysisStore = create<AnalysisState>((set) => ({
  correlationMethod: "pearson",
  correlationBackendResult: null,
  correlationLoading: false,
  lastHypothesisResult: null,
  descriptiveBackendResult: null,

  setCorrelationMethod: (correlationMethod) => set({ correlationMethod }),
  setCorrelationBackendResult: (correlationBackendResult) => set({ correlationBackendResult }),
  setCorrelationLoading: (correlationLoading) => set({ correlationLoading }),
  setLastHypothesisResult: (lastHypothesisResult) => set({ lastHypothesisResult }),
  setDescriptiveBackendResult: (descriptiveBackendResult) => set({ descriptiveBackendResult }),
  clearAnalysisCache: () =>
    set({
      correlationBackendResult: null,
      lastHypothesisResult: null,
      descriptiveBackendResult: null,
      correlationLoading: false,
    }),
}));
