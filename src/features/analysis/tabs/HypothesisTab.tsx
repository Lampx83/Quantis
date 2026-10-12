import { useState, useEffect, useMemo } from "react";
import { Loader2, Copy } from "lucide-react";
import type { Dataset } from "@/types";
import {
  numCell,
  getDataRows,
  getUniqueValues,
  computeTTest,
  computeChiSquare,
  computeOneWayANOVA,
  computeKruskalWallis,
  computeMannWhitneyU,
  computeShapiroWilk,
  computePairedTTest,
  computeWilcoxonSignedRank,
  computeFriedmanTest,
  computeLeveneTest,
  computeMcNemar,
  computeOddsRatio,
  computeOneSampleTTest,
  computeBinomialTest,
  computeTwoProportionZTest,
  computeSignTest,
  computePowerTTest,
  computeSampleSizeProportion,
  computeSampleSizeChiSquare,
  computeSampleSizeAnova,
  computeSampleSizeRegression,
  pairwisePostHoc,
  computeFisherExact,
  type TTestResult,
  type ChiSquareResult,
  type ANOVAResult,
  type MannWhitneyResult,
  type PairedTTestResult,
  type WilcoxonSignedRankResult,
  type FriedmanResult,
  type LeveneResult,
  type McNemarResult,
  type FisherExactResult,
  type OneSampleTTestResult,
  type BinomialTestResult,
  type TwoProportionZTestResult,
  type SignTestResult,
  type SampleSizeProportionResult,
  type SampleSizeChiSquareResult,
  type SampleSizeAnovaResult,
  type SampleSizeRegressionResult,
  type ShapiroWilkResult,
} from "@/utils/stats";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";

export interface HypothesisTabProps {
  selectedDataset: Dataset;
  onHypothesisResult?: (r: {
    type: "ttest" | "chisquare" | "anova" | "mannwhitney";
    payload: TTestResult | ChiSquareResult | ANOVAResult | MannWhitneyResult;
    meta?: Record<string, string>;
  } | null) => void;
  analysisBackendAvailable?: boolean;
  showToast: (msg: string) => void;
}

export function HypothesisTab({
  selectedDataset,
  onHypothesisResult,
  analysisBackendAvailable = false,
  showToast,
}: HypothesisTabProps) {
  const BACKEND_PYTHON_REQUIRED_MSG = t("app.backendPythonRequiredMsg");
  const rows = getDataRows(selectedDataset);
  const [testKind, setTestKind] = useState<"ttest" | "chisquare" | "anova" | "ancova" | "manova" | "mancova" | "kruskal" | "nonparametric" | "normality" | "power" | "paired" | "wilcoxon_paired" | "friedman" | "levene" | "mcnemar" | "fisher" | "onesample_ttest" | "binomial" | "twoprop" | "sign_test" | "ftest" | "ztest_means">("ttest");
  const [groupCol, setGroupCol] = useState("");
  const [groupVal1, setGroupVal1] = useState("");
  const [groupVal2, setGroupVal2] = useState("");
  const [numCol, setNumCol] = useState("");
  const [ttestEqualVar, setTtestEqualVar] = useState(false);
  const [tResult, setTResult] = useState<TTestResult | null>(null);
  const [pairedCol1, setPairedCol1] = useState("");
  const [pairedCol2, setPairedCol2] = useState("");
  const [pairedResult, setPairedResult] = useState<PairedTTestResult | null>(null);
  const [wilcoxonPairedResult, setWilcoxonPairedResult] = useState<WilcoxonSignedRankResult | null>(null);
  const [friedmanCols, setFriedmanCols] = useState<string[]>([]);
  const [friedmanResult, setFriedmanResult] = useState<FriedmanResult | null>(null);
  const [leveneGroupCol, setLeveneGroupCol] = useState("");
  const [leveneValueCol, setLeveneValueCol] = useState("");
  const [leveneResult, setLeveneResult] = useState<LeveneResult | null>(null);
  const [mcnemarCol1, setMcNemarCol1] = useState("");
  const [mcnemarCol2, setMcNemarCol2] = useState("");
  const [mcnemarResult, setMcNemarResult] = useState<McNemarResult | null>(null);
  const [mcnemarRan, setMcNemarRan] = useState(false);
  const [fisherCol1, setFisherCol1] = useState("");
  const [fisherCol2, setFisherCol2] = useState("");
  const [fisherResult, setFisherResult] = useState<FisherExactResult | null>(null);
  const [onesampleCol, setOnesampleCol] = useState("");
  const [onesampleMu0, setOnesampleMu0] = useState("");
  const [onesampleResult, setOnesampleResult] = useState<OneSampleTTestResult | null>(null);
  const [binomialCol, setBinomialCol] = useState("");
  const [binomialP0, setBinomialP0] = useState("0.5");
  const [binomialResult, setBinomialResult] = useState<BinomialTestResult | null>(null);
  const [twopropGroupCol, setTwopropGroupCol] = useState("");
  const [twopropGroupVal1, setTwopropGroupVal1] = useState("");
  const [twopropGroupVal2, setTwopropGroupVal2] = useState("");
  const [twopropOutcomeCol, setTwopropOutcomeCol] = useState("");
  const [twopropResult, setTwopropResult] = useState<TwoProportionZTestResult | null>(null);
  const [signTestCol1, setSignTestCol1] = useState("");
  const [signTestCol2, setSignTestCol2] = useState("");
  const [signTestResult, setSignTestResult] = useState<SignTestResult | null>(null);
  const [ftestResult, setFtestResult] = useState<{ f: number; pValue: number; df1: number; df2: number; var1: number; var2: number; n1: number; n2: number } | null>(null);
  const [ztestMeansResult, setZtestMeansResult] = useState<{ z: number; pValue: number; mean1: number; mean2: number; n1: number; n2: number; knownVar1: number; knownVar2: number } | null>(null);
  const [ztestKnownVar1, setZtestKnownVar1] = useState("");
  const [ztestKnownVar2, setZtestKnownVar2] = useState("");
  const [chiCol1, setChiCol1] = useState("");
  const [chiCol2, setChiCol2] = useState("");
  const [chiResult, setChiResult] = useState<ChiSquareResult | null>(null);
  const [anovaFactorCol, setAnovaFactorCol] = useState("");
  const [anovaValueCol, setAnovaValueCol] = useState("");
  const [anovaResult, setAnovaResult] = useState<ANOVAResult | null>(null);
  const [ancovaFactorCol, setAncovaFactorCol] = useState("");
  const [ancovaValueCol, setAncovaValueCol] = useState("");
  const [ancovaCovariateCols, setAncovaCovariateCols] = useState<string[]>([]);
  const [ancovaResult, setAncovaResult] = useState<{ f: number; dfBetween: number; dfWithin: number; pValue: number; etaSq: number; groupMeans: { group: string; n: number; mean: number; std: number }[] } | null>(null);
  const [manovaFactorCol, setManovaFactorCol] = useState("");
  const [manovaValueCols, setManovaValueCols] = useState<string[]>([]);
  const [manovaResult, setManovaResult] = useState<{ factorCol: string; valueCols: string[]; n: number; summary?: string; factorTest?: string; error?: string } | null>(null);
  const [mancovaFactorCol, setMancovaFactorCol] = useState("");
  const [mancovaValueCols, setMancovaValueCols] = useState<string[]>([]);
  const [mancovaCovariateCols, setMancovaCovariateCols] = useState<string[]>([]);
  const [mancovaResult, setMancovaResult] = useState<{ factorCol: string; valueCols: string[]; covariateCols: string[]; n: number; summary?: string; factorTest?: string; error?: string } | null>(null);
  const [kruskalResult, setKruskalResult] = useState<{ h: number; pValue: number; df: number; nGroups: number; groupMedians: { group: string; n: number; median: number; mean: number; std: number }[] } | null>(null);
  const [mannWhitneyResult, setMannWhitneyResult] = useState<MannWhitneyResult | null>(null);
  const [normalityCol, setNormalityCol] = useState("");
  const [shapiroResult, setShapiroResult] = useState<ShapiroWilkResult | null>(null);
  const [effectSizeD, setEffectSizeD] = useState(0.5);
  const [powerResult, setPowerResult] = useState<{ nRequired: number; power: number; effectSize: number; alpha: number } | null>(null);
  const [sampleSizeKind, setSampleSizeKind] = useState<"ttest" | "proportion" | "chisquare" | "anova" | "regression">("ttest");
  const [proportionP0, setProportionP0] = useState(0.5);
  const [proportionP1, setProportionP1] = useState(0.65);
  const [chiEffectW, setChiEffectW] = useState(0.3);
  const [chiDf, setChiDf] = useState(1);
  const [anovaK, setAnovaK] = useState(3);
  const [anovaF, setAnovaF] = useState(0.25);
  const [regressionP, setRegressionP] = useState(5);
  const [regressionRule, setRegressionRule] = useState<"10" | "20">("10");
  const [sampleSizeExtra, setSampleSizeExtra] = useState<SampleSizeProportionResult | SampleSizeChiSquareResult | SampleSizeAnovaResult | SampleSizeRegressionResult | null>(null);
  const [pairwisePosthocBackendResult, setPairwisePosthocBackendResult] = useState<Array<{ group1: string; group2: string; meanDiff: number; t: number; df: number; p: number; pBonferroni: number }> | null>(null);
  const [hypothesisLoading, setHypothesisLoading] = useState<string | null>(null);
  const cols = selectedDataset.columnNames || [];
  const groupValues = groupCol ? getUniqueValues(rows, groupCol) : [];
  const numericCols = rows.length >= 2 ? cols.filter((c) => { const ci = rows[0].indexOf(c); const vals = rows.slice(1).map((r) => r[ci]); return vals.every((v) => v === "" || !Number.isNaN(Number(v))); }) : [];

  const hypothesisMetadata = useMemo(() => {
    const n = rows.length;
    const colList = cols.length <= 20 ? cols.join(", ") : cols.slice(0, 18).join(", ") + ", ...";
    return `Dataset: ${selectedDataset.name}. Số hàng: ${n}, số cột: ${cols.length}. Các cột: ${colList}.`;
  }, [selectedDataset.name, selectedDataset.rows, rows.length, cols]);

  const hypothesisProcess = useMemo(() => {
    if (tResult) return `Phương pháp: t-test hai mẫu độc lập (Welch). Biến nhóm: ${groupCol}, so sánh nhóm "${groupVal1}" vs "${groupVal2}". Biến số: ${numCol}.`;
    if (chiResult) return `Phương pháp: Kiểm định Chi-square độc lập. Biến 1: ${chiCol1}, Biến 2: ${chiCol2}.`;
    if (anovaResult) return `Phương pháp: ANOVA một nhân tố. Nhân tố: ${anovaFactorCol}, biến phụ thuộc: ${anovaValueCol}.`;
    if (mannWhitneyResult) return `Phương pháp: Mann-Whitney U (non-parametric). Biến nhóm: ${groupCol}, nhóm "${groupVal1}" vs "${groupVal2}". Biến số: ${numCol}.`;
    if (pairedResult) return `Phương pháp: t-test hai mẫu phụ thuộc (cặp). Cột 1: ${pairedCol1}, Cột 2: ${pairedCol2}.`;
    if (kruskalResult) return `Phương pháp: Kruskal-Wallis H (non-parametric, nhiều nhóm). Nhân tố: ${anovaFactorCol}, biến số: ${anovaValueCol}.`;
    if (wilcoxonPairedResult) return `Phương pháp: Wilcoxon signed-rank (cặp). Cột 1: ${pairedCol1}, Cột 2: ${pairedCol2}.`;
    if (friedmanResult) return `Phương pháp: Friedman (nhiều điều kiện phụ thuộc). Các cột: ${friedmanCols.join(", ")}.`;
    if (leveneResult) return `Phương pháp: Levene (đồng phương sai). Biến nhóm: ${leveneGroupCol}, biến số: ${leveneValueCol}.`;
    if (mcnemarResult) return `Phương pháp: McNemar (cặp nhị phân). Biến 1: ${mcnemarCol1}, Biến 2: ${mcnemarCol2}.`;
    if (fisherResult) return `Phương pháp: Fisher exact (bảng 2x2). Biến 1: ${fisherCol1}, Biến 2: ${fisherCol2}.`;
    if (onesampleResult) return `Phương pháp: t-test một mẫu. Biến số: ${onesampleCol}, giá trị so sánh μ0 = ${onesampleMu0}.`;
    if (binomialResult) return `Phương pháp: Kiểm định tỉ lệ (Binomial). Biến: ${binomialCol}, p0 = ${binomialP0}.`;
    if (twopropResult) return `Phương pháp: Z-test hai tỉ lệ. Nhóm: ${twopropGroupCol} (${twopropGroupVal1} vs ${twopropGroupVal2}), biến kết quả: ${twopropOutcomeCol}.`;
    if (signTestResult) return `Phương pháp: Sign test (cặp). Cột 1: ${signTestCol1}, Cột 2: ${signTestCol2}.`;
    if (shapiroResult) return `Phương pháp: Shapiro-Wilk (kiểm định phân phối chuẩn). Biến số: ${normalityCol}.`;
    if (powerResult) return `Phương pháp: Power analysis (cỡ mẫu t-test). Effect size d = ${effectSizeD}, α = ${powerResult.alpha}, power = ${(powerResult.power * 100).toFixed(0)}%.`;
    return "";
  }, [tResult, chiResult, anovaResult, mannWhitneyResult, pairedResult, kruskalResult, wilcoxonPairedResult, friedmanResult, leveneResult, mcnemarResult, fisherResult, onesampleResult, binomialResult, twopropResult, signTestResult, shapiroResult, powerResult, groupCol, groupVal1, groupVal2, numCol, chiCol1, chiCol2, anovaFactorCol, anovaValueCol, pairedCol1, pairedCol2, friedmanCols, leveneGroupCol, leveneValueCol, mcnemarCol1, mcnemarCol2, fisherCol1, fisherCol2, onesampleCol, onesampleMu0, binomialCol, binomialP0, twopropGroupCol, twopropGroupVal1, twopropGroupVal2, twopropOutcomeCol, signTestCol1, signTestCol2, normalityCol, effectSizeD]);

  const hypothesisResultContext = useMemo(() => {
    if (tResult) return `t-test: t=${tResult.t.toFixed(2)}, df=${tResult.df.toFixed(1)}, p=${tResult.pValue < 0.001 ? "<.001" : tResult.pValue.toFixed(3)}, Cohen's d=${tResult.cohenD.toFixed(2)}. Mean nhóm 1=${tResult.mean1.toFixed(2)} (n=${tResult.n1}), nhóm 2=${tResult.mean2.toFixed(2)} (n=${tResult.n2}).`;
    if (chiResult) return `Chi-square: χ²=${chiResult.chi2.toFixed(2)}, df=${chiResult.df}, p=${chiResult.pValue < 0.001 ? "<.001" : chiResult.pValue.toFixed(3)}, Cramér's V=${chiResult.cramersV?.toFixed(3) ??"?"}.`;
    if (anovaResult) return `ANOVA 1 nhân tố: F=${anovaResult.f.toFixed(2)}, df=${anovaResult.dfBetween}/${anovaResult.dfWithin}, p=${anovaResult.pValue < 0.001 ? "<.001" : anovaResult.pValue.toFixed(3)}, χ²=${anovaResult.etaSq.toFixed(3)}.`;
    if (mannWhitneyResult) return `Mann-Whitney U: U=${mannWhitneyResult.u.toFixed(0)}, z=${mannWhitneyResult.z.toFixed(2)}, p=${mannWhitneyResult.pValue < 0.001 ? "<.001" : mannWhitneyResult.pValue.toFixed(3)}. Median nhóm 1=${mannWhitneyResult.median1.toFixed(2)}, nhóm 2=${mannWhitneyResult.median2.toFixed(2)}.`;
    if (pairedResult) return `t-test cặp: t=${pairedResult.t.toFixed(2)}, df=${pairedResult.df}, p=${pairedResult.pValue < 0.001 ? "<.001" : pairedResult.pValue.toFixed(3)}, d (Cohen) = ${pairedResult.cohenD.toFixed(2)}. Mean khác biệt = ${pairedResult.meanDiff.toFixed(2)}, n = ${pairedResult.n}.`;
    if (kruskalResult) return `Kruskal-Wallis: H = ${kruskalResult.h.toFixed(2)}, df = ${kruskalResult.df}, p = ${kruskalResult.pValue < 0.001 ? "<.001" : kruskalResult.pValue.toFixed(3)}, ${kruskalResult.nGroups} nhóm.`;
    if (wilcoxonPairedResult) return `Wilcoxon cặp: W = ${wilcoxonPairedResult.w.toFixed(0)}, z = ${wilcoxonPairedResult.z.toFixed(2)}, p = ${wilcoxonPairedResult.pValue < 0.001 ? "<.001" : wilcoxonPairedResult.pValue.toFixed(3)}, n = ${wilcoxonPairedResult.n}.`;
    if (friedmanResult) return `Friedman: χ² = ${friedmanResult.chi2.toFixed(2)}, df = ${friedmanResult.df}, p = ${friedmanResult.pValue < 0.001 ? "<.001" : friedmanResult.pValue.toFixed(3)}.`;
    if (leveneResult) return `Levene (Đồng phương sai): W = ${leveneResult.w.toFixed(4)}, p = ${leveneResult.pValue < 0.001 ? "<.001" : leveneResult.pValue.toFixed(3)}.`;
    if (mcnemarResult) return `McNemar (cặp nhị phân, hiệu chỉnh liên tục): χ² = ${mcnemarResult.chi2.toFixed(2)}, p = ${mcnemarResult.pValue < 0.001 ? "<.001" : mcnemarResult.pValue.toFixed(3)}.`;
    if (shapiroResult) return `Shapiro-Wilk (chuẩn): W = ${shapiroResult.w.toFixed(4)}, p = ${shapiroResult.pValue < 0.001 ? "<.001" : shapiroResult.pValue.toFixed(3)}. p < 0.05 → bác bỏ chuẩn.`;
    if (powerResult) return `Phân tích lực mẫu: cần n = ${powerResult.nRequired} để đạt power = ${(powerResult.power * 100).toFixed(0)}%, effect size d = ${powerResult.effectSize}, α = ${powerResult.alpha}.`;
    return "";
  }, [tResult, chiResult, anovaResult, mannWhitneyResult, pairedResult, kruskalResult, wilcoxonPairedResult, friedmanResult, leveneResult, mcnemarResult, shapiroResult, powerResult]);

  useEffect(() => {
    if (!analysisBackendAvailable || !anovaResult?.groupMeans?.length) {
      setPairwisePosthocBackendResult(null);
      return;
    }
    quantisApi.analyzePairwisePosthoc(anovaResult.groupMeans).then(setPairwisePosthocBackendResult);
  }, [analysisBackendAvailable, anovaResult]);

  const runTTest = async () => {
    if (!groupCol || !groupVal1 || !groupVal2 || !numCol) return;
    if (analysisBackendAvailable) {
      setHypothesisLoading("ttest");
      try {
        const res = await quantisApi.analyzeTTest(rows, groupCol, groupVal1, groupVal2, numCol, ttestEqualVar);
        setTResult(res ?? null);
        setChiResult(null);
        setAnovaResult(null);
        if (res) onHypothesisResult?.({ type: "ttest", payload: res, meta: { groupCol, groupVal1, groupVal2, numCol } });
        else onHypothesisResult?.(null);
      } finally {
        setHypothesisLoading(null);
      }
      return;
    }
    const res = computeTTest(rows, groupCol, groupVal1, groupVal2, numCol);
    setTResult(res ?? null);
    setChiResult(null);
    setAnovaResult(null);
    if (res) onHypothesisResult?.({ type: "ttest", payload: res, meta: { groupCol, groupVal1, groupVal2, numCol } });
    else onHypothesisResult?.(null);
  };
  const runChiSquare = async () => {
    if (!chiCol1 || !chiCol2) return;
    if (analysisBackendAvailable) {
      setHypothesisLoading("chi2");
      try {
        const raw = await quantisApi.analyzeChiSquare(rows, chiCol1, chiCol2);
        // Backend Python không trả Cramér's V / phi → bổ sung từ χ², n và kích thước bảng; lỗi backend → tính cục bộ.
        let res: ChiSquareResult | null = null;
        if (raw) {
          const nTot = raw.table.reduce((a, c) => a + c.count, 0);
          const minDim = Math.min(raw.rowLabels.length, raw.colLabels.length) - 1;
          res = {
            ...(raw as ChiSquareResult),
            cramersV: nTot > 0 && minDim > 0 ? Math.sqrt(raw.chi2 / (nTot * minDim)) : undefined,
            phi: nTot > 0 && raw.rowLabels.length === 2 && raw.colLabels.length === 2 ? Math.sqrt(raw.chi2 / nTot) : undefined,
          };
        } else {
          res = computeChiSquare(rows, chiCol1, chiCol2);
        }
        setChiResult(res ?? null);
        setTResult(null);
        setAnovaResult(null);
        if (res) onHypothesisResult?.({ type: "chisquare", payload: res, meta: { chiCol1, chiCol2 } });
        else onHypothesisResult?.(null);
      } finally {
        setHypothesisLoading(null);
      }
      return;
    }
    const res = computeChiSquare(rows, chiCol1, chiCol2);
    setChiResult(res ?? null);
    setTResult(null);
    setAnovaResult(null);
    if (res) onHypothesisResult?.({ type: "chisquare", payload: res, meta: { chiCol1, chiCol2 } });
    else onHypothesisResult?.(null);
  };
  const runANOVA = async () => {
    if (!anovaFactorCol || !anovaValueCol) return;
    if (analysisBackendAvailable) {
      setHypothesisLoading("anova");
      try {
        const res = await quantisApi.analyzeAnova(rows, anovaFactorCol, anovaValueCol);
        setAnovaResult(res ?? null);
        setKruskalResult(null);
        setTResult(null);
        setChiResult(null);
        if (res) onHypothesisResult?.({ type: "anova", payload: res, meta: { factorCol: anovaFactorCol, valueCol: anovaValueCol } });
        else onHypothesisResult?.(null);
      } finally {
        setHypothesisLoading(null);
      }
      return;
    }
    const res = computeOneWayANOVA(rows, anovaFactorCol, anovaValueCol);
    setAnovaResult(res ?? null);
      setKruskalResult(null);
    setTResult(null);
    setChiResult(null);
    if (res) onHypothesisResult?.({ type: "anova", payload: res, meta: { factorCol: anovaFactorCol, valueCol: anovaValueCol } });
    else onHypothesisResult?.(null);
  };
  const runKruskalWallis = async () => {
    if (!anovaFactorCol || !anovaValueCol) return;
    if (analysisBackendAvailable) {
      setHypothesisLoading("kruskal");
      try {
        const res = await quantisApi.analyzeKruskalWallis(rows, anovaFactorCol, anovaValueCol);
        setKruskalResult(res ?? null);
        setAnovaResult(null);
      } finally {
        setHypothesisLoading(null);
      }
      return;
    }
    const res = computeKruskalWallis(rows, anovaFactorCol, anovaValueCol);
    setKruskalResult(res ?? null);
    setAnovaResult(null);
  };
  const runAncova = async () => {
    if (!ancovaFactorCol || !ancovaValueCol || ancovaCovariateCols.length === 0) {
      showToast(t("hypothesisTab.toast.ancovaMissingFields"));
      return;
    }
    if (!analysisBackendAvailable) {
      showToast(BACKEND_PYTHON_REQUIRED_MSG);
      return;
    }
    setHypothesisLoading("ancova");
    try {
      const res = await quantisApi.analyzeAncova(rows, ancovaFactorCol, ancovaValueCol, ancovaCovariateCols);
      setAncovaResult(res ?? null);
    } finally {
      setHypothesisLoading(null);
    }
  };
  const runManova = async () => {
    if (!manovaFactorCol || manovaValueCols.length < 2) {
      showToast(t("hypothesisTab.toast.manovaMissingFields"));
      return;
    }
    if (!analysisBackendAvailable) {
      showToast(BACKEND_PYTHON_REQUIRED_MSG);
      return;
    }
    setHypothesisLoading("manova");
    try {
      const res = await quantisApi.analyzeManova(rows, manovaFactorCol, manovaValueCols);
      setManovaResult(res ?? null);
    } finally {
      setHypothesisLoading(null);
    }
  };
  const runMancova = async () => {
    if (!mancovaFactorCol || mancovaValueCols.length < 2 || mancovaCovariateCols.length === 0) {
      showToast(t("hypothesisTab.toast.mancovaMissingFields"));
      return;
    }
    if (!analysisBackendAvailable) {
      showToast(BACKEND_PYTHON_REQUIRED_MSG);
      return;
    }
    setHypothesisLoading("mancova");
    try {
      const res = await quantisApi.analyzeMancova(rows, mancovaFactorCol, mancovaValueCols, mancovaCovariateCols);
      setMancovaResult(res ?? null);
    } finally {
      setHypothesisLoading(null);
    }
  };
    const runMannWhitney = async () => {
    if (!groupCol || !groupVal1 || !groupVal2 || !numCol) return;
    if (analysisBackendAvailable) {
      setHypothesisLoading("mannwhitney");
      try {
        const res = await quantisApi.analyzeMannWhitney(rows, groupCol, groupVal1, groupVal2, numCol);
        setMannWhitneyResult(res ?? null);
        if (res) onHypothesisResult?.({ type: "mannwhitney", payload: res, meta: { groupCol, groupVal1, groupVal2, numCol } });
        else onHypothesisResult?.(null);
      } finally {
        setHypothesisLoading(null);
      }
      return;
    }
    const res = computeMannWhitneyU(rows, groupCol, groupVal1, groupVal2, numCol);
    setMannWhitneyResult(res ?? null);
    if (res) onHypothesisResult?.({ type: "mannwhitney", payload: res, meta: { groupCol, groupVal1, groupVal2, numCol } });
    else onHypothesisResult?.(null);
  };
  const clearResults = () => { setTResult(null); setChiResult(null); setAnovaResult(null); setAncovaResult(null); setManovaResult(null); setMancovaResult(null); setKruskalResult(null); setMannWhitneyResult(null); setShapiroResult(null); setPowerResult(null); setSampleSizeExtra(null); setPairedResult(null); setWilcoxonPairedResult(null); setFriedmanResult(null); setLeveneResult(null); setMcNemarResult(null); setFisherResult(null); setOnesampleResult(null); setBinomialResult(null); setTwopropResult(null); setSignTestResult(null); setFtestResult(null); setZtestMeansResult(null); };
  const runShapiroWilk = async () => {
    if (!normalityCol || !numericCols.includes(normalityCol)) return;
    const ci = rows[0].indexOf(normalityCol);
    const vals = rows.slice(1).map((r) => numCell(r[ci])).filter((v) => !Number.isNaN(v));
    if (analysisBackendAvailable) {
      setHypothesisLoading("shapiro");
      try {
        const res = await quantisApi.analyzeShapiro(vals);
        setShapiroResult(res ?? null);
      } finally {
        setHypothesisLoading(null);
      }
      return;
    }
    const res = computeShapiroWilk(vals);
    setShapiroResult(res ?? null);
  };
  const runPowerAnalysis = async () => {
    if (sampleSizeKind === "ttest") {
      if (analysisBackendAvailable) {
        setHypothesisLoading("power");
        try {
          const res = await quantisApi.analyzePowerTTest(effectSizeD);
          setPowerResult(res ?? null);
          setSampleSizeExtra(null);
        } finally {
          setHypothesisLoading(null);
        }
        return;
      }
      const res = computePowerTTest(effectSizeD);
      setPowerResult(res);
      setSampleSizeExtra(null);
    } else if (sampleSizeKind === "proportion") {
      if (analysisBackendAvailable) {
        setHypothesisLoading("power");
        try {
          const res = await quantisApi.analyzeSampleSizeProportion(proportionP0, proportionP1);
          setSampleSizeExtra(res ?? null);
          setPowerResult(null);
        } finally {
          setHypothesisLoading(null);
        }
        return;
      }
      const res = computeSampleSizeProportion(proportionP0, proportionP1);
      setSampleSizeExtra(res);
      setPowerResult(null);
    } else if (sampleSizeKind === "chisquare") {
      if (analysisBackendAvailable) {
        setHypothesisLoading("power");
        try {
          const res = await quantisApi.analyzeSampleSizeChisquare(chiEffectW, chiDf);
          setSampleSizeExtra(res ?? null);
          setPowerResult(null);
        } finally {
          setHypothesisLoading(null);
        }
        return;
      }
      const res = computeSampleSizeChiSquare(chiEffectW, chiDf);
      setSampleSizeExtra(res);
      setPowerResult(null);
    } else if (sampleSizeKind === "anova") {
      if (analysisBackendAvailable) {
        setHypothesisLoading("power");
        try {
          const res = await quantisApi.analyzeSampleSizeAnova(anovaK, anovaF);
          setSampleSizeExtra(res ?? null);
          setPowerResult(null);
        } finally {
          setHypothesisLoading(null);
        }
        return;
      }
      const res = computeSampleSizeAnova(anovaK, anovaF);
      setSampleSizeExtra(res);
      setPowerResult(null);
    } else {
      if (analysisBackendAvailable) {
        setHypothesisLoading("power");
        try {
          const res = await quantisApi.analyzeSampleSizeRegression(regressionP, regressionRule);
          setSampleSizeExtra(res ?? null);
          setPowerResult(null);
        } finally {
          setHypothesisLoading(null);
        }
        return;
      }
      const res = computeSampleSizeRegression(regressionP, regressionRule);
      setSampleSizeExtra(res);
      setPowerResult(null);
    }
  };

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">{t("hypothesisTab.title")}</h2>
      <div className="mb-4">
        <AIAssistPanel
          metadata={selectedDataset ? `Dataset: ${selectedDataset.name}. Số hàng: ${selectedDataset.rows}, số cột: ${selectedDataset.columns}. Cột: ${(selectedDataset.columnNames || []).slice(0, 20).join(", ")}${(selectedDataset.columnNames?.length || 0) > 20 ? "…" : ""}.` : undefined}
          context="Trang Kiểm định giả thuyết: t-test, ANOVA, Chi-square, Mann-Whitney, Wilcoxon, Kruskal-Wallis, Friedman, Levene, Shapiro-Wilk, Power analysis, v.v. Chọn kiểm định từ dropdown, chọn cột/nhóm, rồi bấm Chạy."
          quickPrompts={[{ label: t("hypothesisTab.aiAssist.suggestTestLabel"), systemHint: `Bạn là chuyên gia thống kê. Gợi ý loại kiểm định phù hợp theo: so sánh trung bình 2 nhóm (t-test) hay nhiều nhóm (ANOVA), dữ liệu không chuẩn (Mann-Whitney, Kruskal-Wallis), hai biến phân loại (Chi-square), dữ liệu cặp (t-test cặp, Wilcoxon), kiểm tra giả định (Shapiro-Wilk, Levene). ${aiAnswerLangHint()}` }, { label: t("hypothesisTab.aiAssist.readPValueLabel"), systemHint: `Bạn là chuyên gia thống kê. Giải thích p-value (α = 0.05), effect size (Cohen d, η², Cramér V…), cách trình bày kết quả trong báo cáo (APA). ${aiAnswerLangHint()}` }]}
          title={t("hypothesisTab.aiAssist.askAboutTestTitle")}
        />
      </div>
      {hypothesisResultContext && (
        <AIAssistPanel
          metadata={hypothesisMetadata}
          process={hypothesisProcess}
          context={hypothesisResultContext}
          quickPrompts={[{ label: t("hypothesisTab.aiAssist.explainResultLabel"), systemHint: `Bạn là chuyên gia thống kê. Giải thích kết quả kiểm định giả thuyết: p-value (có ý nghĩa thống kê hay không), effect size (độ mạnh hiệu ứng), cỡ mẫu. Gợi ý cách trình bày trong báo cáo (ví dụ APA). ${aiAnswerLangHint()}` }]}
          title={t("hypothesisTab.aiAssist.askAboutResultTitle")}
        />
      )}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <span>{t("hypothesisTab.common.selectTest")}</span>
          <select
            value={testKind}
            onChange={(e) => { setTestKind(e.target.value as typeof testKind); clearResults(); }}
            className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm min-w-[200px]"
          >
            <optgroup label={t("hypothesisTab.optgroup.compareMeans")}>
              <option value="ttest">{t("hypothesisTab.option.ttestIndependent")}</option>
              <option value="anova">{t("hypothesisTab.option.anovaOneWay")}</option>
              <option value="ancova">{t("hypothesisTab.option.ancova")}</option>
              <option value="manova">{t("hypothesisTab.option.manova")}</option>
              <option value="mancova">{t("hypothesisTab.option.mancova")}</option>
              <option value="paired">{t("hypothesisTab.option.pairedTtest")}</option>
              <option value="onesample_ttest">{t("hypothesisTab.option.onesampleTtest")}</option>
              <option value="ztest_means">{t("hypothesisTab.option.ztestMeans")}</option>
            </optgroup>
            <optgroup label={t("hypothesisTab.optgroup.nonparametric")}>
              <option value="nonparametric">{t("hypothesisTab.option.mannWhitney")}</option>
              <option value="wilcoxon_paired">{t("hypothesisTab.option.wilcoxonPaired")}</option>
              <option value="kruskal">{t("hypothesisTab.option.kruskalWallis")}</option>
              <option value="friedman">Friedman</option>
              <option value="sign_test">{t("hypothesisTab.option.signTest")}</option>
            </optgroup>
            <optgroup label={t("hypothesisTab.optgroup.categoricalProportions")}>
              <option value="chisquare">{t("hypothesisTab.option.chisquareIndependence")}</option>
              <option value="mcnemar">{t("hypothesisTab.option.mcnemar")}</option>
              <option value="fisher">{t("hypothesisTab.option.fisherExact")}</option>
              <option value="binomial">{t("hypothesisTab.option.binomialTest")}</option>
              <option value="twoprop">{t("hypothesisTab.option.twoPropZtest")}</option>
            </optgroup>
            <optgroup label={t("hypothesisTab.optgroup.normalityTools")}>
              <option value="normality">{t("hypothesisTab.option.shapiroWilk")}</option>
              <option value="levene">{t("hypothesisTab.option.levene")}</option>
              <option value="ftest">{t("hypothesisTab.option.ftestTwoVariances")}</option>
              <option value="power">{t("hypothesisTab.option.powerAnalysis")}</option>
            </optgroup>
          </select>
        </label>
      </div>
      {testKind === "ttest" && (
      <>
      <div className="flex flex-wrap gap-4 items-end mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.groupVariable")}</label>
          <select value={groupCol} onChange={(e) => { setGroupCol(e.target.value); setGroupVal1(""); setGroupVal2(""); setTResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
            <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
            {cols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.group1")}</label>
          <select value={groupVal1} onChange={(e) => { setGroupVal1(e.target.value); setTResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
            <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
            {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.group2")}</label>
          <select value={groupVal2} onChange={(e) => { setGroupVal2(e.target.value); setTResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
            <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
            {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.numericVariable")}</label>
          <select value={numCol} onChange={(e) => { setNumCol(e.target.value); setTResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
            <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
            {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={ttestEqualVar} onChange={(e) => { setTtestEqualVar(e.target.checked); setTResult(null); }} className="rounded border-neutral-300" />
          <span className="text-sm">{t("hypothesisTab.ttest.equalVarianceLabel")}</span>
        </label>
        <button type="button" onClick={runTTest} disabled={hypothesisLoading !== null} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
          {hypothesisLoading === "ttest" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.ttest.runButton")}
        </button>
      </div>
      {tResult && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="font-medium">{t("hypothesisTab.common.resultLabel")} ({ttestEqualVar ? "Two-sample t-test (Equal variance)" : "Welch two-sample t-test"})</p>
            <button type="button" onClick={() => navigator.clipboard.writeText(`t = ${tResult.t.toFixed(4)}, df = ${tResult.df.toFixed(1)}, p = ${tResult.pValue < 0.001 ? "< .001" : tResult.pValue.toFixed(4)}, Cohen's d = ${tResult.cohenD.toFixed(4)}\nMean nhóm 1 = ${tResult.mean1.toFixed(2)} (n = ${tResult.n1}), Mean nhóm 2 = ${tResult.mean2.toFixed(2)} (n = ${tResult.n2})`)} className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs flex items-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"><Copy className="w-3.5 h-3.5" /> {t("hypothesisTab.common.copy")}</button>
          </div>
          <p>t = {tResult.t.toFixed(4)}, df = {tResult.df.toFixed(1)}, p-value = {tResult.pValue < 0.001 ? "< 0.001" : tResult.pValue.toFixed(4)}</p>
          <p>Cohen's d = {tResult.cohenD.toFixed(4)}</p>
          <p>{t("hypothesisTab.ttest.meanGroup1")} = {tResult.mean1.toFixed(2)} (n = {tResult.n1}), {t("hypothesisTab.ttest.meanGroup2")} = {tResult.mean2.toFixed(2)} (n = {tResult.n2})</p>
        </div>
      )}
      </>
      )}
      {testKind === "anova" && (
        <>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.factorVariable")}</label>
              <select value={anovaFactorCol} onChange={(e) => { setAnovaFactorCol(e.target.value); setAnovaResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.dependentVariable")}</label>
              <select value={anovaValueCol} onChange={(e) => { setAnovaValueCol(e.target.value); setAnovaResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={runANOVA} disabled={hypothesisLoading !== null} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {hypothesisLoading === "anova" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.anova.runButton")}
            </button>
          </div>
          {anovaResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-medium">{t("hypothesisTab.anova.resultTitle")}</p>
                <button type="button" onClick={() => { const lines = [`F(${anovaResult.dfBetween}, ${anovaResult.dfWithin}) = ${anovaResult.f.toFixed(4)}, p = ${anovaResult.pValue < 0.001 ? "< .001" : anovaResult.pValue.toFixed(4)}, η² = ${anovaResult.etaSq.toFixed(4)}${typeof anovaResult.omegaSq === "number" ? `, ω² = ${anovaResult.omegaSq.toFixed(4)}` : ""}`, "Nhóm\tM\tSD\tn", ...anovaResult.groupMeans.map((m) => `${m.group}\t${m.mean.toFixed(4)}\t${m.std.toFixed(4)}\t${m.n}`)]; const posthoc = analysisBackendAvailable && pairwisePosthocBackendResult ? pairwisePosthocBackendResult : pairwisePostHoc(anovaResult.groupMeans); if (posthoc.length) lines.push("", "Nhóm 1\tNhóm 2\tHiệu TB\tp (Bonferroni)", ...posthoc.map((r) => `${r.group1}\t${r.group2}\t${r.meanDiff.toFixed(4)}\t${r.pBonferroni < 0.001 ? "< .001" : r.pBonferroni.toFixed(4)}`)); navigator.clipboard.writeText(lines.join("\n")); }} className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs flex items-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"><Copy className="w-3.5 h-3.5" /> {t("hypothesisTab.common.copy")}</button>
              </div>
              <p>F({anovaResult.dfBetween}, {anovaResult.dfWithin}) = {anovaResult.f.toFixed(4)}, p-value = {anovaResult.pValue < 0.001 ? "< 0.001" : anovaResult.pValue.toFixed(4)}, η² = {anovaResult.etaSq.toFixed(4)}{typeof anovaResult.omegaSq === "number" ? `, ω² = ${anovaResult.omegaSq.toFixed(4)}` : ""}</p>
              <p className="text-neutral-600 dark:text-neutral-400">{t("hypothesisTab.common.meanByGroup")}</p>
              <ul className="list-disc list-inside">
                {anovaResult.groupMeans.map((m) => (
                  <li key={m.group}>{m.group}: M = {m.mean.toFixed(2)}, SD = {m.std.toFixed(2)}, n = {m.n}</li>
                ))}
              </ul>
              {anovaResult.groupMeans.length >= 2 && (
                <>
                  <p className="font-medium mt-2">{t("hypothesisTab.anova.posthocTitle")}</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-neutral-200 dark:border-neutral-600"><th className="text-left p-1.5">{t("hypothesisTab.common.group1")}</th><th className="text-left p-1.5">{t("hypothesisTab.common.group2")}</th><th className="text-right p-1.5">{t("hypothesisTab.anova.meanDiffHeader")}</th><th className="text-right p-1.5">t</th><th className="text-right p-1.5">p (Bonferroni)</th></tr></thead>
                      <tbody>
                        {(analysisBackendAvailable && pairwisePosthocBackendResult ? pairwisePosthocBackendResult : pairwisePostHoc(anovaResult.groupMeans)).map((row, i) => (
                          <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-1.5">{row.group1}</td>
                            <td className="p-1.5">{row.group2}</td>
                            <td className="p-1.5 text-right">{row.meanDiff.toFixed(3)}</td>
                            <td className="p-1.5 text-right">{row.t.toFixed(3)}</td>
                            <td className="p-1.5 text-right">{row.pBonferroni < 0.001 ? "< .001" : row.pBonferroni.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
      {testKind === "ancova" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.ancova.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.factorGroup")}</label>
              <select value={ancovaFactorCol} onChange={(e) => { setAncovaFactorCol(e.target.value); setAncovaResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.dependentVariableDV")}</label>
              <select value={ancovaValueCol} onChange={(e) => { setAncovaValueCol(e.target.value); setAncovaResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.ancova.covariatesMultiLabel")}</label>
              <select multiple value={ancovaCovariateCols} onChange={(e) => { const sel = Array.from(e.target.selectedOptions, (o) => o.value); setAncovaCovariateCols(sel); setAncovaResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 min-h-[80px]">
                {numericCols.filter((c) => c !== ancovaValueCol).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-neutral-500 mt-0.5">{t("hypothesisTab.common.multiSelectHint")}</p>
            </div>
            <button type="button" onClick={runAncova} disabled={hypothesisLoading !== null} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {hypothesisLoading === "ancova" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.ancova.runButton")}
            </button>
          </div>
          {ancovaResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm space-y-3">
              <p className="font-medium">{t("hypothesisTab.ancova.resultTitle")}</p>
              <p>F({ancovaResult.dfBetween}, {ancovaResult.dfWithin}) = {ancovaResult.f.toFixed(4)}, p-value = {ancovaResult.pValue < 0.001 ? "< 0.001" : ancovaResult.pValue.toFixed(4)}, η² = {ancovaResult.etaSq.toFixed(4)}</p>
              <p className="text-neutral-600 dark:text-neutral-400">{t("hypothesisTab.common.covariateLabel")}: {ancovaCovariateCols.join(", ")}</p>
              <p className="text-neutral-600 dark:text-neutral-400">{t("hypothesisTab.ancova.adjustedMeanByGroup")}</p>
              <ul className="list-disc list-inside">
                {ancovaResult.groupMeans.map((m) => (
                  <li key={m.group}>{m.group}: M = {m.mean.toFixed(2)}, SD = {m.std.toFixed(2)}, n = {m.n}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {testKind === "manova" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.manova.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.factorGroup")}</label>
              <select value={manovaFactorCol} onChange={(e) => { setManovaFactorCol(e.target.value); setManovaResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.manova.dvMultiLabel")}</label>
              <select multiple value={manovaValueCols} onChange={(e) => { const sel = Array.from(e.target.selectedOptions, (o) => o.value); setManovaValueCols(sel); setManovaResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 min-h-[80px]">
                {numericCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-neutral-500 mt-0.5">{t("hypothesisTab.manova.multiSelectHintMin2")}</p>
            </div>
            <button type="button" onClick={runManova} disabled={hypothesisLoading !== null} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {hypothesisLoading === "manova" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.manova.runButton")}
            </button>
          </div>
          {manovaResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm space-y-3">
              <p className="font-medium">{t("hypothesisTab.manova.resultTitle")}</p>
              {manovaResult.error && <p className="text-amber-600 dark:text-amber-400">{manovaResult.error}</p>}
              <p>{t("hypothesisTab.manova.factorPrefix")} {manovaResult.factorCol}, {t("hypothesisTab.manova.dvPrefix")} {manovaResult.valueCols.join(", ")}, n = {manovaResult.n}</p>
              {manovaResult.factorTest != null && <p className="font-medium">{t("hypothesisTab.manova.factorTestPrefix")} {String(manovaResult.factorTest)}</p>}
              {manovaResult.summary && <pre className="text-xs whitespace-pre-wrap bg-neutral-100 dark:bg-neutral-900 p-2 rounded overflow-x-auto">{manovaResult.summary}</pre>}
            </div>
          )}
        </>
      )}
      {testKind === "mancova" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.mancova.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.factorGroup")}</label>
              <select value={mancovaFactorCol} onChange={(e) => { setMancovaFactorCol(e.target.value); setMancovaResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.manova.dvMultiLabel")}</label>
              <select multiple value={mancovaValueCols} onChange={(e) => { const sel = Array.from(e.target.selectedOptions, (o) => o.value); setMancovaValueCols(sel); setMancovaResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 min-h-[80px]">
                {numericCols.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-neutral-500 mt-0.5">{t("hypothesisTab.manova.multiSelectHintMin2")}</p>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.mancova.covariatesAtLeast1Label")}</label>
              <select multiple value={mancovaCovariateCols} onChange={(e) => { const sel = Array.from(e.target.selectedOptions, (o) => o.value); setMancovaCovariateCols(sel); setMancovaResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 min-h-[80px]">
                {numericCols.filter((c) => !mancovaValueCols.includes(c)).map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
              <p className="text-xs text-neutral-500 mt-0.5">{t("hypothesisTab.common.multiSelectHint")}</p>
            </div>
            <button type="button" onClick={runMancova} disabled={hypothesisLoading !== null} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {hypothesisLoading === "mancova" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.mancova.runButton")}
            </button>
          </div>
          {mancovaResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm space-y-3">
              <p className="font-medium">{t("hypothesisTab.mancova.resultTitle")}</p>
              {mancovaResult.error && <p className="text-amber-600 dark:text-amber-400">{mancovaResult.error}</p>}
              <p>{t("hypothesisTab.manova.factorPrefix")} {mancovaResult.factorCol}, {t("hypothesisTab.mancova.dvShortPrefix")} {mancovaResult.valueCols.join(", ")}, {t("hypothesisTab.mancova.covariateShortPrefix")} {mancovaResult.covariateCols.join(", ")}, n = {mancovaResult.n}</p>
              {mancovaResult.factorTest != null && <p className="font-medium">{t("hypothesisTab.manova.factorTestPrefix")} {String(mancovaResult.factorTest)}</p>}
              {mancovaResult.summary && <pre className="text-xs whitespace-pre-wrap bg-neutral-100 dark:bg-neutral-900 p-2 rounded overflow-x-auto">{mancovaResult.summary}</pre>}
            </div>
          )}
        </>
      )}
      {testKind === "kruskal" && (
        <>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.kruskal.factorLabel")}</label>
              <select value={anovaFactorCol} onChange={(e) => { setAnovaFactorCol(e.target.value); setKruskalResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.kruskal.numericLabel")}</label>
              <select value={anovaValueCol} onChange={(e) => { setAnovaValueCol(e.target.value); setKruskalResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={runKruskalWallis} disabled={hypothesisLoading !== null} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {hypothesisLoading === "kruskal" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.kruskal.runButton")}
            </button>
          </div>
          {kruskalResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm space-y-3">
              <p className="font-medium">{t("hypothesisTab.kruskal.resultTitle")}</p>
              <p>H = {kruskalResult.h.toFixed(4)}, df = {kruskalResult.df}, p-value = {kruskalResult.pValue < 0.001 ? "< 0.001" : kruskalResult.pValue.toFixed(4)}</p>
              <p className="text-neutral-600 dark:text-neutral-400">{t("hypothesisTab.kruskal.medianByGroupLabel")}</p>
              <ul className="list-disc list-inside">
                {kruskalResult.groupMedians.map((m) => (
                  <li key={m.group}>{m.group}: Mdn = {m.median.toFixed(2)}, M = {m.mean.toFixed(2)}, n = {m.n}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {testKind === "chisquare" && (
        <>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.chisquare.col1Label")}</label>
              <select value={chiCol1} onChange={(e) => { setChiCol1(e.target.value); setChiResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.chisquare.col2Label")}</label>
              <select value={chiCol2} onChange={(e) => { setChiCol2(e.target.value); setChiResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={runChiSquare} disabled={hypothesisLoading !== null} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {hypothesisLoading === "chi2" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.chisquare.runButton")}
            </button>
          </div>
          {chiResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-medium">{t("hypothesisTab.chisquare.resultTitle")}</p>
                <button type="button" onClick={() => { let t = `chi2 = ${chiResult.chi2.toFixed(4)}, df = ${chiResult.df}, p = ${chiResult.pValue < 0.001 ? "< .001" : chiResult.pValue.toFixed(4)}`; if (chiResult.phi != null) t += `, Phi = ${chiResult.phi.toFixed(4)}`; if (chiResult.cramersV != null) t += `, Cramer V = ${chiResult.cramersV.toFixed(4)}`; if (chiResult.rowLabels.length === 2 && chiResult.colLabels.length === 2) { const a = chiResult.table.find(x => x.row === chiResult.rowLabels[0] && x.col === chiResult.colLabels[0])?.count ?? 0; const b = chiResult.table.find(x => x.row === chiResult.rowLabels[0] && x.col === chiResult.colLabels[1])?.count ?? 0; const c = chiResult.table.find(x => x.row === chiResult.rowLabels[1] && x.col === chiResult.colLabels[0])?.count ?? 0; const d = chiResult.table.find(x => x.row === chiResult.rowLabels[1] && x.col === chiResult.colLabels[1])?.count ?? 0; const orRes = computeOddsRatio(a, b, c, d); if (orRes) t += `, OR = ${orRes.or.toFixed(4)} [${orRes.ci95Lower.toFixed(4)}, ${orRes.ci95Upper.toFixed(4)}]`; } void navigator.clipboard.writeText(t); }} className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs flex items-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"><Copy className="w-3.5 h-3.5" /> {t("hypothesisTab.common.copy")}</button>
              </div>
              <p>χ² = {chiResult.chi2.toFixed(4)}, df = {chiResult.df}, p-value = {chiResult.pValue < 0.001 ? "< 0.001" : chiResult.pValue.toFixed(4)}</p>
              {chiResult.phi != null && <p>φ (Phi) = {chiResult.phi.toFixed(4)} {t("hypothesisTab.chisquare.effectSize2x2Suffix")}</p>}
              <p>{t("hypothesisTab.chisquare.cramersVPrefix")} {chiResult.cramersV != null ? chiResult.cramersV.toFixed(4) : "—"} {t("hypothesisTab.chisquare.strengthSuffix")}</p>
            </div>
          )}
        </>
      )}
      {testKind === "nonparametric" && (
        <>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.groupVariable")}</label>
              <select value={groupCol} onChange={(e) => { setGroupCol(e.target.value); setGroupVal1(""); setGroupVal2(""); setMannWhitneyResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.group1")}</label>
              <select value={groupVal1} onChange={(e) => { setGroupVal1(e.target.value); setMannWhitneyResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.group2")}</label>
              <select value={groupVal2} onChange={(e) => { setGroupVal2(e.target.value); setMannWhitneyResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.numericVariable")}</label>
              <select value={numCol} onChange={(e) => { setNumCol(e.target.value); setMannWhitneyResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={runMannWhitney} disabled={hypothesisLoading !== null} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {hypothesisLoading === "mannwhitney" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.mannwhitney.runButton")}
            </button>
          </div>
          {mannWhitneyResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.mannwhitney.resultTitle")}</p>
              <p>U = {mannWhitneyResult.u.toFixed(0)}, z = {mannWhitneyResult.z.toFixed(4)}, p-value = {mannWhitneyResult.pValue < 0.001 ? "< 0.001" : mannWhitneyResult.pValue.toFixed(4)}</p>
              <p>{t("hypothesisTab.mannwhitney.medianGroup1Prefix")} {mannWhitneyResult.median1.toFixed(2)} (n = {mannWhitneyResult.n1}), {t("hypothesisTab.mannwhitney.medianGroup2Prefix")} {mannWhitneyResult.median2.toFixed(2)} (n = {mannWhitneyResult.n2})</p>
            </div>
          )}
        </>
      )}
      {testKind === "paired" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.paired.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.paired.col1Label")}</label>
              <select value={pairedCol1} onChange={(e) => { setPairedCol1(e.target.value); setPairedResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.paired.col2Label")}</label>
              <select value={pairedCol2} onChange={(e) => { setPairedCol2(e.target.value); setPairedResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              type="button"
              disabled={!pairedCol1 || !pairedCol2 || hypothesisLoading !== null}
              onClick={async () => {
                if (!pairedCol1 || !pairedCol2) return;
                if (analysisBackendAvailable) {
                  setHypothesisLoading("paired");
                  try {
                    const res = await quantisApi.analyzeTTestPaired(rows, pairedCol1, pairedCol2);
                    setPairedResult(res ? { t: res.t, df: res.df, pValue: res.pValue, cohenD: res.cohenD, meanDiff: res.meanDiff, stdDiff: res.stdDiff, n: res.n, mean1: res.mean1, mean2: res.mean2 } : null);
                  } finally {
                    setHypothesisLoading(null);
                  }
                  return;
                }
                const res = computePairedTTest(rows, pairedCol1, pairedCol2);
                setPairedResult(res ?? null);
              }}
              className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {hypothesisLoading === "paired" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.paired.runButton")}
            </button>
          </div>
          {pairedResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.paired.resultTitle")}</p>
              <p>t = {pairedResult.t.toFixed(4)}, df = {pairedResult.df}, p-value = {pairedResult.pValue < 0.001 ? "< 0.001" : pairedResult.pValue.toFixed(4)}</p>
              <p>Cohen's d = {pairedResult.cohenD.toFixed(4)}, {t("hypothesisTab.paired.meanDiffPrefix")} {pairedResult.meanDiff.toFixed(4)} ({t("hypothesisTab.paired.sdDiffLabel")} {pairedResult.stdDiff.toFixed(4)}), n = {pairedResult.n}</p>
              <p>{t("hypothesisTab.paired.meanCol1Prefix")} {pairedResult.mean1.toFixed(2)}, {t("hypothesisTab.paired.meanCol2Prefix")} {pairedResult.mean2.toFixed(2)}</p>
            </div>
          )}
        </>
      )}
      {testKind === "wilcoxon_paired" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.wilcoxon.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.wilcoxon.col1Label")}</label>
              <select value={pairedCol1} onChange={(e) => { setPairedCol1(e.target.value); setWilcoxonPairedResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.wilcoxon.col2Label")}</label>
              <select value={pairedCol2} onChange={(e) => { setPairedCol2(e.target.value); setWilcoxonPairedResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { const res = computeWilcoxonSignedRank(rows, pairedCol1, pairedCol2); setWilcoxonPairedResult(res ?? null); }} disabled={!pairedCol1 || !pairedCol2} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">{t("hypothesisTab.wilcoxon.runButton")}</button>
          </div>
          {wilcoxonPairedResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.wilcoxon.resultTitle")}</p>
              <p>W = {wilcoxonPairedResult.w.toFixed(0)}, z = {wilcoxonPairedResult.z.toFixed(4)}, p-value = {wilcoxonPairedResult.pValue < 0.001 ? "< 0.001" : wilcoxonPairedResult.pValue.toFixed(4)}</p>
              <p>{t("hypothesisTab.wilcoxon.medianDiffPrefix")} {wilcoxonPairedResult.medianDiff.toFixed(4)}, {t("hypothesisTab.wilcoxon.nPairsLabel")} {wilcoxonPairedResult.n}</p>
            </div>
          )}
        </>
      )}
      {testKind === "friedman" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.friedman.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div className="w-full">
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.friedman.conditionsColsLabel")}</label>
              <div className="flex flex-wrap gap-2">
                {numericCols.map((c) => (
                  <label key={c} className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={friedmanCols.includes(c)} onChange={(e) => { setFriedmanCols((prev) => e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)); setFriedmanResult(null); }} />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => { const res = friedmanCols.length >= 3 ? computeFriedmanTest(rows, friedmanCols) : null; setFriedmanResult(res ?? null); }} disabled={friedmanCols.length < 3} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">{t("hypothesisTab.friedman.runButton")}</button>
          </div>
          {friedmanResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm space-y-2">
              <p className="font-medium">{t("hypothesisTab.friedman.resultTitle")}</p>
              <p>χ² = {friedmanResult.chi2.toFixed(4)}, df = {friedmanResult.df}, p-value = {friedmanResult.pValue < 0.001 ? "< 0.001" : friedmanResult.pValue.toFixed(4)}</p>
              <p>{t("hypothesisTab.friedman.blocksLabel")} {friedmanResult.nBlocks}, {t("hypothesisTab.friedman.conditionsCountLabel")} {friedmanResult.kConditions}</p>
              <p className="text-neutral-600 dark:text-neutral-400">{t("hypothesisTab.friedman.meanRankByConditionLabel")}</p>
              <ul className="list-disc list-inside">
                {friedmanResult.meanRanks.map((m) => (
                  <li key={m.condition}>{m.condition}: {t("hypothesisTab.friedman.meanRankPrefix")} {m.meanRank.toFixed(2)}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {testKind === "levene" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.levene.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.groupVariable")}</label>
              <select value={leveneGroupCol} onChange={(e) => { setLeveneGroupCol(e.target.value); setLeveneResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.numericVariable")}</label>
              <select value={leveneValueCol} onChange={(e) => { setLeveneValueCol(e.target.value); setLeveneResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { const res = computeLeveneTest(rows, leveneGroupCol, leveneValueCol); setLeveneResult(res ?? null); }} disabled={!leveneGroupCol || !leveneValueCol} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">{t("hypothesisTab.levene.runButton")}</button>
          </div>
          {leveneResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.levene.resultTitle")}</p>
              <p>W = {leveneResult.w.toFixed(4)}, df1 = {leveneResult.df1}, df2 = {leveneResult.df2}, p-value = {leveneResult.pValue < 0.001 ? "< 0.001" : leveneResult.pValue.toFixed(4)}</p>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">{t("hypothesisTab.levene.interpretationNote")}</p>
            </div>
          )}
        </>
      )}
      {testKind === "mcnemar" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.mcnemar.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.mcnemar.col1Label")}</label>
              <select value={mcnemarCol1} onChange={(e) => { setMcNemarCol1(e.target.value); setMcNemarResult(null); setMcNemarRan(false); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.mcnemar.col2Label")}</label>
              <select value={mcnemarCol2} onChange={(e) => { setMcNemarCol2(e.target.value); setMcNemarResult(null); setMcNemarRan(false); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { const res = computeMcNemar(rows, mcnemarCol1, mcnemarCol2); setMcNemarResult(res ?? null); setMcNemarRan(true); }} disabled={!mcnemarCol1 || !mcnemarCol2} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">{t("hypothesisTab.mcnemar.runButton")}</button>
          </div>
          {mcnemarRan && !mcnemarResult && (
            <p className="text-sm text-amber-700 dark:text-amber-400">{t("hypothesisTab.mcnemar.noResult")}</p>
          )}
          {mcnemarResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.mcnemar.resultTitle")}</p>
              <p>{t("hypothesisTab.mcnemar.chi2Label")} = {mcnemarResult.chi2.toFixed(4)}, df = 1, p-value = {mcnemarResult.pValue < 0.001 ? "< 0.001" : mcnemarResult.pValue.toFixed(4)}</p>
              {mcnemarResult.exactPValue != null && (
                <p className="text-neutral-600 dark:text-neutral-400">{t("hypothesisTab.mcnemar.exactLabel")} {mcnemarResult.exactPValue < 0.001 ? "< 0.001" : mcnemarResult.exactPValue.toFixed(4)}</p>
              )}
              <p>{t("hypothesisTab.mcnemar.discordantPairsLabel")} b = {mcnemarResult.b}, c = {mcnemarResult.c}, n_discordant = {mcnemarResult.nDiscordant}</p>
            </div>
          )}
        </>
      )}
      {testKind === "fisher" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.fisher.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.fisher.rowVarLabel")}</label>
              <select value={fisherCol1} onChange={(e) => { setFisherCol1(e.target.value); setFisherResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.fisher.colVarLabel")}</label>
              <select value={fisherCol2} onChange={(e) => { setFisherCol2(e.target.value); setFisherResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { const chi = computeChiSquare(rows, fisherCol1, fisherCol2); if (chi && chi.rowLabels.length === 2 && chi.colLabels.length === 2) { const a = chi.table.find(t => t.row === chi.rowLabels[0] && t.col === chi.colLabels[0])?.count ?? 0; const b = chi.table.find(t => t.row === chi.rowLabels[0] && t.col === chi.colLabels[1])?.count ?? 0; const c = chi.table.find(t => t.row === chi.rowLabels[1] && t.col === chi.colLabels[0])?.count ?? 0; const d = chi.table.find(t => t.row === chi.rowLabels[1] && t.col === chi.colLabels[1])?.count ?? 0; setFisherResult(computeFisherExact(a, b, c, d) ?? null); } else setFisherResult(null); }} disabled={!fisherCol1 || !fisherCol2} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">{t("hypothesisTab.fisher.runButton")}</button>
          </div>
          {fisherResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.fisher.resultTitle")}</p>
              <p>{t("hypothesisTab.fisher.tableLabel")} a={fisherResult.a}, b={fisherResult.b}, c={fisherResult.c}, d={fisherResult.d}, n={fisherResult.n}</p>
              <p>{t("hypothesisTab.fisher.pValueTwoTailedLabel")} {fisherResult.pValueTwoTailed < 0.001 ? "< 0.001" : fisherResult.pValueTwoTailed.toFixed(4)}</p>
              {(() => { const orRes = computeOddsRatio(fisherResult.a, fisherResult.b, fisherResult.c, fisherResult.d); return orRes ? <p>Odds ratio (OR) = {orRes.or.toFixed(4)}, CI 95%: [{orRes.ci95Lower.toFixed(4)}, {orRes.ci95Upper.toFixed(4)}]</p> : null; })()}
            </div>
          )}
        </>
      )}
      {testKind === "onesample_ttest" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.onesample.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.numericVariable")}</label>
              <select value={onesampleCol} onChange={(e) => { setOnesampleCol(e.target.value); setOnesampleResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.onesample.mu0Label")}</label>
              <input type="number" step="any" value={onesampleMu0} onChange={(e) => { setOnesampleMu0(e.target.value); setOnesampleResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-28" placeholder="0" />
            </div>
            <button type="button" onClick={() => { if (!onesampleCol || onesampleMu0 === "") return; const h = rows[0] || []; const idx = h.indexOf(onesampleCol); if (idx === -1) return; const vals = rows.slice(1).map(r => numCell(r[idx])).filter(n => !Number.isNaN(n)); const res = computeOneSampleTTest(vals, parseFloat(onesampleMu0) || 0); setOnesampleResult(res ?? null); }} disabled={!onesampleCol || onesampleMu0 === ""} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">{t("hypothesisTab.onesample.runButton")}</button>
          </div>
          {onesampleResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.onesample.resultTitle")}</p>
              <p>t = {onesampleResult.t.toFixed(4)}, df = {onesampleResult.df}, p-value = {onesampleResult.pValue < 0.001 ? "< 0.001" : onesampleResult.pValue.toFixed(4)}</p>
              <p>{t("hypothesisTab.onesample.sampleMeanLabel")} {onesampleResult.mean.toFixed(4)}, μ₀ = {onesampleResult.mu0}, n = {onesampleResult.n}, SD = {onesampleResult.std.toFixed(4)}</p>
            </div>
          )}
        </>
      )}
      {testKind === "binomial" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.binomial.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.binomial.binaryVarLabel")}</label>
              <select value={binomialCol} onChange={(e) => { setBinomialCol(e.target.value); setBinomialResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.binomial.p0Label")}</label>
              <input type="number" step="0.01" min="0.01" max="0.99" value={binomialP0} onChange={(e) => { setBinomialP0(e.target.value); setBinomialResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
            </div>
            <button type="button" onClick={() => { if (!binomialCol) return; const h = rows[0] || []; const idx = h.indexOf(binomialCol); if (idx === -1) return; const raw = rows.slice(1).map(r => String(r[idx] ?? "").trim()).filter(Boolean); const uniq = [...new Set(raw)].sort(); if (uniq.length !== 2) return; const successVal = uniq[0]; const successes = raw.filter(v => v === successVal).length; const n = raw.length; const p0 = Math.max(0.01, Math.min(0.99, parseFloat(binomialP0) || 0.5)); const res = computeBinomialTest(successes, n, p0); setBinomialResult(res ?? null); }} disabled={!binomialCol} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">{t("hypothesisTab.binomial.runButton")}</button>
          </div>
          {binomialResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.binomial.resultTitle")}</p>
              <p>{t("hypothesisTab.binomial.sampleProportionLabel")} {binomialResult.proportion.toFixed(4)} ({binomialResult.successes}/{binomialResult.n}), p₀ = {binomialResult.p0}</p>
              <p>{t("hypothesisTab.fisher.pValueTwoTailedLabel")} {binomialResult.pValueTwoTailed < 0.001 ? "< 0.001" : binomialResult.pValueTwoTailed.toFixed(4)}</p>
              <p>{t("hypothesisTab.binomial.ci95Label")} [{binomialResult.ci95Lower.toFixed(4)}, {binomialResult.ci95Upper.toFixed(4)}]</p>
            </div>
          )}
        </>
      )}
      {testKind === "twoprop" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.twoprop.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.groupVariable")}</label>
              <select value={twopropGroupCol} onChange={(e) => { setTwopropGroupCol(e.target.value); setTwopropGroupVal1(""); setTwopropGroupVal2(""); setTwopropResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.group1")}</label>
              <select value={twopropGroupVal1} onChange={(e) => { setTwopropGroupVal1(e.target.value); setTwopropResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {(twopropGroupCol ? getUniqueValues(rows, twopropGroupCol) : []).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.group2")}</label>
              <select value={twopropGroupVal2} onChange={(e) => { setTwopropGroupVal2(e.target.value); setTwopropResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {(twopropGroupCol ? getUniqueValues(rows, twopropGroupCol) : []).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.twoprop.outcomeVarLabel")}</label>
              <select value={twopropOutcomeCol} onChange={(e) => { setTwopropOutcomeCol(e.target.value); setTwopropResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { if (!twopropGroupCol || !twopropGroupVal1 || !twopropGroupVal2 || !twopropOutcomeCol) return; const h = rows[0] || []; const gIdx = h.indexOf(twopropGroupCol); const oIdx = h.indexOf(twopropOutcomeCol); if (gIdx === -1 || oIdx === -1) return; const outVals = [...new Set(rows.slice(1).map(r => String(r[oIdx] ?? "").trim()).filter(Boolean))].sort(); if (outVals.length !== 2) return; const successVal = outVals[0]; const data = rows.slice(1); const g1 = data.filter(r => String(r[gIdx]).trim() === twopropGroupVal1); const g2 = data.filter(r => String(r[gIdx]).trim() === twopropGroupVal2); const success1 = g1.filter(r => String(r[oIdx]).trim() === successVal).length; const success2 = g2.filter(r => String(r[oIdx]).trim() === successVal).length; const res = computeTwoProportionZTest(success1, g1.length, success2, g2.length); setTwopropResult(res ?? null); }} disabled={!twopropGroupCol || !twopropGroupVal1 || !twopropGroupVal2 || !twopropOutcomeCol} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">{t("hypothesisTab.twoprop.runButton")}</button>
          </div>
          {twopropResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.twoprop.resultTitle")}</p>
              <p>{t("hypothesisTab.twoprop.proportionGroup1Prefix")} {twopropResult.p1.toFixed(4)} ({twopropResult.success1}/{twopropResult.n1}), {t("hypothesisTab.twoprop.proportionGroup2Prefix")} {twopropResult.p2.toFixed(4)} ({twopropResult.success2}/{twopropResult.n2})</p>
              <p>z = {twopropResult.z.toFixed(4)}, p-value = {twopropResult.pValue < 0.001 ? "< 0.001" : twopropResult.pValue.toFixed(4)}</p>
              <p>{t("hypothesisTab.twoprop.diffLabel")} {twopropResult.diff.toFixed(4)}, CI 95%: [{twopropResult.ci95Lower.toFixed(4)}, {twopropResult.ci95Upper.toFixed(4)}]</p>
            </div>
          )}
        </>
      )}
      {testKind === "sign_test" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.signtest.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.wilcoxon.col1Label")}</label>
              <select value={signTestCol1} onChange={(e) => { setSignTestCol1(e.target.value); setSignTestResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.wilcoxon.col2Label")}</label>
              <select value={signTestCol2} onChange={(e) => { setSignTestCol2(e.target.value); setSignTestResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { const res = computeSignTest(rows, signTestCol1, signTestCol2); setSignTestResult(res ?? null); }} disabled={!signTestCol1 || !signTestCol2} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">{t("hypothesisTab.signtest.runButton")}</button>
          </div>
          {signTestResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.signtest.resultTitle")}</p>
              <p>{t("hypothesisTab.signtest.positiveCountPrefix")} {signTestResult.positiveCount}, {t("hypothesisTab.signtest.negativeSuffix")} {signTestResult.negativeCount}, n = {signTestResult.n}</p>
              <p>{t("hypothesisTab.signtest.positiveProportionLabel")} {signTestResult.proportionPositive.toFixed(4)}, p-value (hai phía) = {signTestResult.pValueTwoTailed < 0.001 ? "< 0.001" : signTestResult.pValueTwoTailed.toFixed(4)}</p>
            </div>
          )}
        </>
      )}
      {testKind === "ftest" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.ftest.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.groupVariable")}</label>
              <select value={groupCol} onChange={(e) => { setGroupCol(e.target.value); setGroupVal1(""); setGroupVal2(""); setFtestResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.group1")}</label>
              <select value={groupVal1} onChange={(e) => { setGroupVal1(e.target.value); setFtestResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.group2")}</label>
              <select value={groupVal2} onChange={(e) => { setGroupVal2(e.target.value); setFtestResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.numericVariable")}</label>
              <select value={numCol} onChange={(e) => { setNumCol(e.target.value); setFtestResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button
              type="button"
              disabled={!groupCol || !groupVal1 || !groupVal2 || !numCol || hypothesisLoading !== null}
              onClick={async () => {
                if (!groupCol || !groupVal1 || !groupVal2 || !numCol) return;
                if (!analysisBackendAvailable) { showToast(BACKEND_PYTHON_REQUIRED_MSG); return; }
                setHypothesisLoading("ftest");
                try {
                  const res = await quantisApi.analyzeFTestTwoSample(rows, groupCol, groupVal1, groupVal2, numCol);
                  setFtestResult(res ?? null);
                } catch (e) {
                  showToast(e instanceof Error ? e.message : t("hypothesisTab.toast.ftestError"));
                  setFtestResult(null);
                } finally {
                  setHypothesisLoading(null);
                }
              }}
              className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {hypothesisLoading === "ftest" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.ftest.runButton")}
            </button>
          </div>
          {ftestResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.ftest.resultTitle")}</p>
              <p>F = {ftestResult.f.toFixed(4)}, df1 = {ftestResult.df1}, df2 = {ftestResult.df2}, p-value = {ftestResult.pValue < 0.001 ? "< 0.001" : ftestResult.pValue.toFixed(4)}</p>
              <p>{t("hypothesisTab.ftest.varianceGroup1Prefix")} {ftestResult.var1.toFixed(4)} (n = {ftestResult.n1}), {t("hypothesisTab.ftest.varianceGroup2Prefix")} {ftestResult.var2.toFixed(4)} (n = {ftestResult.n2})</p>
            </div>
          )}
        </>
      )}
      {testKind === "ztest_means" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">{t("hypothesisTab.ztestMeans.description")}</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.groupVariable")}</label>
              <select value={groupCol} onChange={(e) => { setGroupCol(e.target.value); setGroupVal1(""); setGroupVal2(""); setZtestMeansResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.group1")}</label>
              <select value={groupVal1} onChange={(e) => { setGroupVal1(e.target.value); setZtestMeansResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.group2")}</label>
              <select value={groupVal2} onChange={(e) => { setGroupVal2(e.target.value); setZtestMeansResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.common.numericVariable")}</label>
              <select value={numCol} onChange={(e) => { setNumCol(e.target.value); setZtestMeansResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.ztestMeans.knownVar1Label")}</label>
              <input type="number" step="any" min="0" value={ztestKnownVar1} onChange={(e) => { setZtestKnownVar1(e.target.value); setZtestMeansResult(null); }} placeholder="VD: 4" className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.ztestMeans.knownVar2Label")}</label>
              <input type="number" step="any" min="0" value={ztestKnownVar2} onChange={(e) => { setZtestKnownVar2(e.target.value); setZtestMeansResult(null); }} placeholder="VD: 9" className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24" />
            </div>
            <button
              type="button"
              disabled={!groupCol || !groupVal1 || !groupVal2 || !numCol || !ztestKnownVar1 || !ztestKnownVar2 || hypothesisLoading !== null}
              onClick={async () => {
                if (!groupCol || !groupVal1 || !groupVal2 || !numCol || !ztestKnownVar1 || !ztestKnownVar2) return;
                const v1 = parseFloat(ztestKnownVar1);
                const v2 = parseFloat(ztestKnownVar2);
                if (Number.isNaN(v1) || Number.isNaN(v2) || v1 <= 0 || v2 <= 0) return;
                if (!analysisBackendAvailable) { showToast(BACKEND_PYTHON_REQUIRED_MSG); return; }
                setHypothesisLoading("ztest");
                try {
                  const res = await quantisApi.analyzeZTestTwoMeans(rows, groupCol, groupVal1, groupVal2, numCol, v1, v2);
                  setZtestMeansResult(res ?? null);
                } finally {
                  setHypothesisLoading(null);
                }
              }}
              className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
            >
              {hypothesisLoading === "ztest" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.ztestMeans.runButton")}
            </button>
          </div>
          {ztestMeansResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.ztestMeans.resultTitle")}</p>
              <p>z = {ztestMeansResult.z.toFixed(4)}, p-value = {ztestMeansResult.pValue < 0.001 ? "< 0.001" : ztestMeansResult.pValue.toFixed(4)}</p>
              <p>{t("hypothesisTab.ttest.meanGroup1")} = {ztestMeansResult.mean1.toFixed(2)} (n = {ztestMeansResult.n1}), {t("hypothesisTab.ttest.meanGroup2")} = {ztestMeansResult.mean2.toFixed(2)} (n = {ztestMeansResult.n2})</p>
              <p className="text-neutral-600 dark:text-neutral-400 text-xs">{t("hypothesisTab.ztestMeans.knownVarianceLabel")} σ²₁ = {ztestMeansResult.knownVar1}, σ²₂ = {ztestMeansResult.knownVar2}</p>
            </div>
          )}
        </>
      )}
      {testKind === "normality" && (
        <>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">{t("hypothesisTab.normality.numericVarLabel")}</label>
              <select value={normalityCol} onChange={(e) => { setNormalityCol(e.target.value); setShapiroResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">{t("hypothesisTab.common.selectPlaceholder")}</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={runShapiroWilk} disabled={hypothesisLoading !== null} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {hypothesisLoading === "shapiro" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.normality.runButton")}
            </button>
          </div>
          {shapiroResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.normality.resultTitle")}</p>
              <p>W = {shapiroResult.w.toFixed(4)}, p-value = {shapiroResult.pValue < 0.001 ? "< 0.001" : shapiroResult.pValue.toFixed(4)}, n = {shapiroResult.n}</p>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">{t("hypothesisTab.normality.interpretationNote")}</p>
            </div>
          )}
        </>
      )}
      {testKind === "power" && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <button type="button" onClick={() => { setSampleSizeKind("ttest"); clearResults(); }} className={`rounded-md px-3 py-1.5 text-sm ${sampleSizeKind === "ttest" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>{t("hypothesisTab.power.tabTtest")}</button>
            <button type="button" onClick={() => { setSampleSizeKind("proportion"); clearResults(); }} className={`rounded-md px-3 py-1.5 text-sm ${sampleSizeKind === "proportion" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>{t("hypothesisTab.power.tabProportion")}</button>
            <button type="button" onClick={() => { setSampleSizeKind("chisquare"); clearResults(); }} className={`rounded-md px-3 py-1.5 text-sm ${sampleSizeKind === "chisquare" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>{t("hypothesisTab.power.tabChisquare")}</button>
            <button type="button" onClick={() => { setSampleSizeKind("anova"); clearResults(); }} className={`rounded-md px-3 py-1.5 text-sm ${sampleSizeKind === "anova" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>{t("hypothesisTab.power.tabAnova")}</button>
            <button type="button" onClick={() => { setSampleSizeKind("regression"); clearResults(); }} className={`rounded-md px-3 py-1.5 text-sm ${sampleSizeKind === "regression" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>{t("hypothesisTab.power.tabRegression")}</button>
          </div>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            {sampleSizeKind === "ttest" && (
              <div>
                <label className="block text-sm font-medium mb-1">{t("hypothesisTab.power.effectSizeDLabel")}</label>
                <input type="number" step={0.05} min={0.1} max={2} value={effectSizeD} onChange={(e) => { setEffectSizeD(Math.max(0.1, Math.min(2, parseFloat(e.target.value) || 0.5))); setPowerResult(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24" />
              </div>
            )}
            {sampleSizeKind === "proportion" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("hypothesisTab.binomial.p0Label")}</label>
                  <input type="number" step={0.05} min={0.01} max={0.99} value={proportionP0} onChange={(e) => { setProportionP0(Math.max(0.01, Math.min(0.99, parseFloat(e.target.value) || 0.5))); setSampleSizeExtra(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("hypothesisTab.binomial.p0Label")}</label>
                  <input type="number" step={0.05} min={0.01} max={0.99} value={proportionP1} onChange={(e) => { setProportionP1(Math.max(0.01, Math.min(0.99, parseFloat(e.target.value) || 0.65))); setSampleSizeExtra(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
                </div>
              </>
            )}
            {sampleSizeKind === "chisquare" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("hypothesisTab.power.effectSizeWLabel")}</label>
                  <input type="number" step={0.05} min={0.1} max={1} value={chiEffectW} onChange={(e) => { setChiEffectW(Math.max(0.1, Math.min(1, parseFloat(e.target.value) || 0.3))); setSampleSizeExtra(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("hypothesisTab.power.dfEqualLabel")}</label>
                  <input type="number" min={1} max={20} value={chiDf} onChange={(e) => { setChiDf(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))); setSampleSizeExtra(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-16" />
                </div>
              </>
            )}
            {sampleSizeKind === "anova" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("hypothesisTab.power.groupCountKLabel")}</label>
                  <input type="number" min={2} max={20} value={anovaK} onChange={(e) => { setAnovaK(Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 3))); setSampleSizeExtra(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-16" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("hypothesisTab.power.effectSizeFLabel")}</label>
                  <input type="number" step={0.05} min={0.1} max={1} value={anovaF} onChange={(e) => { setAnovaF(Math.max(0.1, Math.min(1, parseFloat(e.target.value) || 0.25))); setSampleSizeExtra(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
                </div>
              </>
            )}
            {sampleSizeKind === "regression" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("hypothesisTab.power.predictorCountLabel")}</label>
                  <input type="number" min={1} max={50} value={regressionP} onChange={(e) => { setRegressionP(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 5))); setSampleSizeExtra(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">{t("hypothesisTab.power.ruleLabel")}</label>
                  <select value={regressionRule} onChange={(e) => { setRegressionRule(e.target.value as "10" | "20"); setSampleSizeExtra(null); }} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                    <option value="10">{t("hypothesisTab.power.rule10Option")}</option>
                    <option value="20">{t("hypothesisTab.power.rule20Option")}</option>
                  </select>
                </div>
              </>
            )}
            <button type="button" onClick={runPowerAnalysis} disabled={hypothesisLoading !== null} className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2">
              {hypothesisLoading === "power" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("hypothesisTab.common.processing")}</> : t("hypothesisTab.power.runButton")}
            </button>
          </div>
          {powerResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.power.resultTitleTtest")}</p>
              <p>{t("hypothesisTab.power.withPrefix")} d = {powerResult.effectSize.toFixed(2)}{t("hypothesisTab.power.alphaPowerNeedSuffix")} <strong>{t("hypothesisTab.power.atLeastLabel")} {powerResult.nRequired} {t("hypothesisTab.power.peopleUnit")}</strong> {t("hypothesisTab.power.perGroupAboutPrefix")} {Math.ceil(powerResult.nRequired / 2)} {t("hypothesisTab.power.perGroupAboutSuffix")}</p>
            </div>
          )}
          {sampleSizeExtra && sampleSizeKind === "proportion" && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.power.resultTitleProportion")}</p>
              <p>{t("hypothesisTab.power.withPrefix")} p₀ = {(sampleSizeExtra as { p0: number }).p0.toFixed(2)}, p₁ = {(sampleSizeExtra as { p1: number }).p1.toFixed(2)}{t("hypothesisTab.power.alphaPowerNeedSuffix")} <strong>{t("hypothesisTab.power.atLeastLabel")} {(sampleSizeExtra as { nRequired: number }).nRequired} {t("hypothesisTab.power.peopleUnit")}</strong>.</p>
            </div>
          )}
          {sampleSizeExtra && sampleSizeKind === "chisquare" && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.power.resultTitleChisquare")}</p>
              <p>{t("hypothesisTab.power.withPrefix")} w = {(sampleSizeExtra as { effectSizeW: number }).effectSizeW.toFixed(2)}, df = {(sampleSizeExtra as { df: number }).df}{t("hypothesisTab.power.alphaPowerNeedSuffix")} <strong>{t("hypothesisTab.power.atLeastLabel")} {(sampleSizeExtra as { nRequired: number }).nRequired} {t("hypothesisTab.power.peopleUnit")}</strong>.</p>
            </div>
          )}
          {sampleSizeExtra && sampleSizeKind === "anova" && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.power.resultTitleAnova")}</p>
              <p>{t("hypothesisTab.power.withPrefix")} k = {(sampleSizeExtra as { k: number }).k} {t("hypothesisTab.power.withGroupsSuffix")} f = {(sampleSizeExtra as { effectSizeF: number }).effectSizeF.toFixed(2)}{t("hypothesisTab.power.alphaPowerNeedSuffix")} <strong>{t("hypothesisTab.power.atLeastLabel")} {(sampleSizeExtra as { nRequired: number }).nRequired} {t("hypothesisTab.power.peopleUnit")}</strong> {t("hypothesisTab.power.perGroupAboutPrefix")} {(sampleSizeExtra as { nPerGroup: number }).nPerGroup} {t("hypothesisTab.power.perGroupAboutSuffix")}</p>
            </div>
          )}
          {sampleSizeExtra && sampleSizeKind === "regression" && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">{t("hypothesisTab.power.resultTitleRegression")}</p>
              <p>{t("hypothesisTab.power.withPrefix")} {(sampleSizeExtra as { nPredictors: number }).nPredictors} {t("hypothesisTab.power.withPredictorsSuffix")} {(sampleSizeExtra as { rule: string }).rule}: {t("hypothesisTab.power.needLabel")} <strong>{t("hypothesisTab.power.atLeastLabel")} {(sampleSizeExtra as { nRequired: number }).nRequired} {t("hypothesisTab.power.peopleUnit")}</strong>.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}