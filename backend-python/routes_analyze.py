"""
API routes cho phân tích — nhận rows (string[][]) + params, gọi analysis_impl, trả JSON.
"""
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from analysis_impl import (
    run_descriptive,
    run_ttest,
    run_chi2,
    run_correlation,
    run_anova,
    run_kruskal_wallis,
    run_ols,
    run_logistic,
    run_poisson,
    run_ridge,
    run_mann_whitney,
    run_shapiro_wilk,
    run_cronbach_alpha,
    run_vif,
    run_mediation,
    run_moderation,
    run_kmeans,
    run_efa,
    run_pairwise_posthoc,
    run_crosstab,
    run_box_stats,
    run_histogram_bins,
    run_power_ttest,
    run_sample_size_proportion,
    run_sample_size_anova,
    run_outlier_count_iqr,
    run_beta_posterior,
    run_sample_size_chisquare,
    run_sample_size_regression,
    run_text_stats,
    run_keyword_counts,
    run_ngram_freq,
    run_cohens_kappa,
    run_covariance,
    run_ftest_two_sample,
    run_exponential_smoothing,
    run_moving_average,
    run_anova_two_factor_replication,
    run_anova_two_factor_no_replication,
    run_fourier_analysis,
    run_rank_percentile,
    run_random_number_generation,
    run_sampling,
    run_ttest_paired,
    run_ztest_two_means,
)

router = APIRouter()


class RowsBody(BaseModel):
    rows: list[list[str]]


class TTestBody(BaseModel):
    rows: list[list[str]]
    groupCol: str
    groupVal1: str
    groupVal2: str
    numCol: str
    equalVar: bool = False


class Chi2Body(BaseModel):
    rows: list[list[str]]
    col1: str
    col2: str


class CorrelationBody(BaseModel):
    rows: list[list[str]]
    method: str = "pearson"


class AnovaBody(BaseModel):
    rows: list[list[str]]
    factorCol: str
    valueCol: str


class OLSBody(BaseModel):
    rows: list[list[str]]
    yCol: str
    xCols: list[str]


class LogisticBody(BaseModel):
    rows: list[list[str]]
    yCol: str
    xCols: list[str]


class PoissonBody(BaseModel):
    rows: list[list[str]]
    yCol: str
    xCols: list[str]


class RidgeBody(BaseModel):
    rows: list[list[str]]
    yCol: str
    xCols: list[str]
    alpha: float = 1.0


class MannWhitneyBody(BaseModel):
    rows: list[list[str]]
    groupCol: str
    groupVal1: str
    groupVal2: str
    numCol: str


class ShapiroWilkBody(BaseModel):
    values: list[float]


class CronbachBody(BaseModel):
    rows: list[list[str]]
    columnNames: list[str]


class VIFBody(BaseModel):
    rows: list[list[str]]
    xCols: list[str]


class MediationBody(BaseModel):
    rows: list[list[str]]
    xCol: str
    mCol: str
    yCol: str


class ModerationBody(BaseModel):
    rows: list[list[str]]
    yCol: str
    xCol: str
    mCol: str


class KMeansBody(BaseModel):
    rows: list[list[str]]
    columnNames: list[str]
    k: int = 3
    maxIter: int = 100


class EFABody(BaseModel):
    rows: list[list[str]]
    columnNames: list[str]
    nFactors: int | None = None


class PairwisePosthocBody(BaseModel):
    groupMeans: list[dict]  # [{"group": str, "n": int, "mean": float, "std": float}, ...]


class CrosstabBody(BaseModel):
    rows: list[list[str]]
    col1: str
    col2: str


class BoxStatsBody(BaseModel):
    rows: list[list[str]]
    groupCol: str
    valueCol: str


class HistogramBinsBody(BaseModel):
    values: list[float]
    binCount: int | None = None


class PowerTTestBody(BaseModel):
    effectSizeD: float
    alpha: float = 0.05
    power: float = 0.8


class SampleSizeProportionBody(BaseModel):
    p0: float
    p1: float
    alpha: float = 0.05
    power: float = 0.8


class SampleSizeAnovaBody(BaseModel):
    k: int
    effectSizeF: float
    alpha: float = 0.05
    power: float = 0.8


class OutlierIQRBody(BaseModel):
    values: list[float]


class BetaPosteriorBody(BaseModel):
    successes: int
    n: int
    priorAlpha: float = 1
    priorBeta: float = 1


class SampleSizeChisquareBody(BaseModel):
    effectSizeW: float
    df: int
    alpha: float = 0.05
    power: float = 0.8


class SampleSizeRegressionBody(BaseModel):
    nPredictors: int
    rule: str = "10"  # "10" or "20"


class TextStatsBody(BaseModel):
    rows: list[list[str]]
    col: str
    topN: int = 100


class KeywordCountsBody(BaseModel):
    rows: list[list[str]]
    col: str
    keywords: list[str]


class NgramFreqBody(BaseModel):
    rows: list[list[str]]
    col: str
    n: int = 2
    topN: int = 50


class CohensKappaBody(BaseModel):
    rows: list[list[str]]
    col1: str
    col2: str


class CovarianceBody(BaseModel):
    rows: list[list[str]]
    method: str = "population"


class FTestTwoSampleBody(BaseModel):
    rows: list[list[str]]
    groupCol: str
    groupVal1: str
    groupVal2: str
    numCol: str


class ExponentialSmoothingBody(BaseModel):
    values: list[float]
    alpha: float = 0.3


class MovingAverageBody(BaseModel):
    values: list[float]
    period: int = 3


class AnovaTwoFactorBody(BaseModel):
    rows: list[list[str]]
    factorA: str
    factorB: str
    valueCol: str


class FourierBody(BaseModel):
    values: list[float]


class RankPercentileBody(BaseModel):
    rows: list[list[str]]
    valueCol: str


class RandomNumberBody(BaseModel):
    n: int
    distribution: str = "uniform"
    seed: int | None = None
    low: float | None = None
    high: float | None = None
    mean: float | None = None
    std: float | None = None
    nTrials: int | None = None
    p: float | None = None


class SamplingBody(BaseModel):
    rows: list[list[str]]
    n: int
    method: str = "random"
    seed: int | None = None


class TTestPairedBody(BaseModel):
    rows: list[list[str]]
    col1: str
    col2: str


class ZTestTwoMeansBody(BaseModel):
    rows: list[list[str]]
    groupCol: str
    groupVal1: str
    groupVal2: str
    numCol: str
    knownVar1: float
    knownVar2: float


@router.get("/health")
async def analyze_health():
    return {"status": "ok", "service": "quantis-analysis", "engine": "python", "version": "1.0.0"}


@router.post("/descriptive")
async def analyze_descriptive(body: RowsBody):
    try:
        result = run_descriptive(body.rows)
        return {"result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ttest")
async def analyze_ttest(body: TTestBody):
    try:
        result = run_ttest(
            body.rows,
            body.groupCol,
            body.groupVal1,
            body.groupVal2,
            body.numCol,
            equal_var=body.equalVar,
        )
        if result is None:
            raise HTTPException(status_code=400, detail="Không đủ dữ liệu hoặc cột không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/chi2")
async def analyze_chi2(body: Chi2Body):
    try:
        result = run_chi2(body.rows, body.col1, body.col2)
        if result is None:
            raise HTTPException(status_code=400, detail="Không đủ dữ liệu hoặc cột không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/correlation")
async def analyze_correlation(body: CorrelationBody):
    try:
        result = run_correlation(body.rows, body.method)
        if result is None:
            raise HTTPException(status_code=400, detail="Cần ít nhất 2 cột số và đủ dữ liệu")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anova")
async def analyze_anova(body: AnovaBody):
    try:
        result = run_anova(body.rows, body.factorCol, body.valueCol)
        if result is None:
            raise HTTPException(status_code=400, detail="Không đủ nhóm hoặc cột không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/kruskal")
async def analyze_kruskal(body: AnovaBody):
    try:
        result = run_kruskal_wallis(body.rows, body.factorCol, body.valueCol)
        if result is None:
            raise HTTPException(status_code=400, detail="Không đủ nhóm hoặc cột không hợp lệ (cần ít nhất 2 nhóm)")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ols")
async def analyze_ols(body: OLSBody):
    try:
        result = run_ols(body.rows, body.yCol, body.xCols)
        if result is None:
            raise HTTPException(status_code=400, detail="Dữ liệu hoặc biến không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/logistic")
async def analyze_logistic(body: LogisticBody):
    try:
        result = run_logistic(body.rows, body.yCol, body.xCols)
        if result is None:
            raise HTTPException(status_code=400, detail="Dữ liệu hoặc biến không hợp lệ (Y phải 0/1)")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/poisson")
async def analyze_poisson(body: PoissonBody):
    try:
        result = run_poisson(body.rows, body.yCol, body.xCols)
        if result is None:
            raise HTTPException(status_code=400, detail="Dữ liệu hoặc biến không hợp lệ (Y đếm: số nguyên ≥ 0)")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ridge")
async def analyze_ridge(body: RidgeBody):
    try:
        result = run_ridge(body.rows, body.yCol, body.xCols, body.alpha)
        if result is None:
            raise HTTPException(status_code=400, detail="Dữ liệu hoặc biến không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mannwhitney")
async def analyze_mann_whitney(body: MannWhitneyBody):
    try:
        result = run_mann_whitney(
            body.rows,
            body.groupCol,
            body.groupVal1,
            body.groupVal2,
            body.numCol,
        )
        if result is None:
            raise HTTPException(status_code=400, detail="Không đủ dữ liệu hoặc cột không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/shapiro")
async def analyze_shapiro(body: ShapiroWilkBody):
    try:
        result = run_shapiro_wilk(body.values)
        if result is None:
            raise HTTPException(status_code=400, detail="Cần ít nhất 3 giá trị số")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cronbach")
async def analyze_cronbach(body: CronbachBody):
    try:
        result = run_cronbach_alpha(body.rows, body.columnNames)
        if result is None:
            raise HTTPException(status_code=400, detail="Cần ít nhất 2 cột và đủ dữ liệu")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/vif")
async def analyze_vif(body: VIFBody):
    try:
        result = run_vif(body.rows, body.xCols)
        if result is None:
            raise HTTPException(status_code=400, detail="Cần ít nhất 2 biến dự đoán")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/mediation")
async def analyze_mediation(body: MediationBody):
    try:
        result = run_mediation(body.rows, body.xCol, body.mCol, body.yCol)
        if result is None:
            raise HTTPException(status_code=400, detail="Dữ liệu hoặc biến không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/moderation")
async def analyze_moderation(body: ModerationBody):
    try:
        result = run_moderation(body.rows, body.yCol, body.xCol, body.mCol)
        if result is None:
            raise HTTPException(status_code=400, detail="Dữ liệu hoặc biến không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/kmeans")
async def analyze_kmeans(body: KMeansBody):
    try:
        result = run_kmeans(
            body.rows,
            body.columnNames,
            body.k,
            body.maxIter,
        )
        if result is None:
            raise HTTPException(status_code=400, detail="Dữ liệu hoặc tham số không hợp lệ (k >= 2)")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/efa")
async def analyze_efa(body: EFABody):
    try:
        result = run_efa(body.rows, body.columnNames, body.nFactors)
        if result is None:
            raise HTTPException(status_code=400, detail="Cần ít nhất 2 cột và đủ dữ liệu (n >= 10)")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/pairwise-posthoc")
async def analyze_pairwise_posthoc(body: PairwisePosthocBody):
    try:
        result = run_pairwise_posthoc(body.groupMeans)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/crosstab")
async def analyze_crosstab(body: CrosstabBody):
    try:
        result = run_crosstab(body.rows, body.col1, body.col2)
        if result is None:
            raise HTTPException(status_code=400, detail="Cột không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/boxstats")
async def analyze_box_stats(body: BoxStatsBody):
    try:
        result = run_box_stats(body.rows, body.groupCol, body.valueCol)
        return {"result": result}
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/histogram-bins")
async def analyze_histogram_bins(body: HistogramBinsBody):
    try:
        result = run_histogram_bins(body.values, body.binCount)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/power-ttest")
async def analyze_power_ttest(body: PowerTTestBody):
    try:
        result = run_power_ttest(body.effectSizeD, body.alpha, body.power)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sample-size-proportion")
async def analyze_sample_size_proportion(body: SampleSizeProportionBody):
    try:
        result = run_sample_size_proportion(body.p0, body.p1, body.alpha, body.power)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sample-size-anova")
async def analyze_sample_size_anova(body: SampleSizeAnovaBody):
    try:
        result = run_sample_size_anova(body.k, body.effectSizeF, body.alpha, body.power)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/outlier-iqr")
async def analyze_outlier_iqr(body: OutlierIQRBody):
    try:
        result = run_outlier_count_iqr(body.values)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/beta-posterior")
async def analyze_beta_posterior(body: BetaPosteriorBody):
    try:
        result = run_beta_posterior(
            body.successes,
            body.n,
            body.priorAlpha,
            body.priorBeta,
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sample-size-chisquare")
async def analyze_sample_size_chisquare(body: SampleSizeChisquareBody):
    try:
        result = run_sample_size_chisquare(
            body.effectSizeW,
            body.df,
            body.alpha,
            body.power,
        )
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sample-size-regression")
async def analyze_sample_size_regression(body: SampleSizeRegressionBody):
    try:
        result = run_sample_size_regression(body.nPredictors, body.rule)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/text-stats")
async def analyze_text_stats(body: TextStatsBody):
    try:
        result = run_text_stats(body.rows, body.col, body.topN)
        if result is None:
            raise HTTPException(status_code=400, detail="Cột không tồn tại")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/keyword-counts")
async def analyze_keyword_counts(body: KeywordCountsBody):
    try:
        result = run_keyword_counts(body.rows, body.col, body.keywords)
        if result is None:
            raise HTTPException(status_code=400, detail="Cột không tồn tại hoặc chưa nhập từ khóa")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ngram-freq")
async def analyze_ngram_freq(body: NgramFreqBody):
    try:
        result = run_ngram_freq(body.rows, body.col, body.n, body.topN)
        if result is None:
            raise HTTPException(status_code=400, detail="Cột không tồn tại hoặc n không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/cohens-kappa")
async def analyze_cohens_kappa(body: CohensKappaBody):
    try:
        result = run_cohens_kappa(body.rows, body.col1, body.col2)
        if result is None:
            raise HTTPException(status_code=400, detail="Cột không tồn tại")
        return {"result": result}
    except HTTPException:
        raise
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/covariance")
async def analyze_covariance(body: CovarianceBody):
    try:
        result = run_covariance(body.rows, body.method)
        if result is None:
            raise HTTPException(status_code=400, detail="Cần ít nhất 2 cột số và đủ dữ liệu")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ftest-two-sample")
async def analyze_ftest_two_sample(body: FTestTwoSampleBody):
    try:
        result = run_ftest_two_sample(
            body.rows, body.groupCol, body.groupVal1, body.groupVal2, body.numCol
        )
        if result is None:
            raise HTTPException(status_code=400, detail="Không đủ dữ liệu hoặc cột không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/exponential-smoothing")
async def analyze_exponential_smoothing(body: ExponentialSmoothingBody):
    try:
        result = run_exponential_smoothing(body.values, body.alpha)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/moving-average")
async def analyze_moving_average(body: MovingAverageBody):
    try:
        result = run_moving_average(body.values, body.period)
        if result is None:
            raise HTTPException(status_code=400, detail="Dữ liệu hoặc period không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anova-two-factor-replication")
async def analyze_anova_two_factor_replication(body: AnovaTwoFactorBody):
    try:
        result = run_anova_two_factor_replication(
            body.rows, body.factorA, body.factorB, body.valueCol
        )
        if result is None:
            raise HTTPException(status_code=400, detail="Dữ liệu hoặc cột không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/anova-two-factor-no-replication")
async def analyze_anova_two_factor_no_replication(body: AnovaTwoFactorBody):
    try:
        result = run_anova_two_factor_no_replication(
            body.rows, body.factorA, body.factorB, body.valueCol
        )
        if result is None:
            raise HTTPException(status_code=400, detail="Dữ liệu hoặc cột không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/fourier")
async def analyze_fourier(body: FourierBody):
    try:
        result = run_fourier_analysis(body.values)
        if result is None:
            raise HTTPException(status_code=400, detail="Cần ít nhất 4 giá trị")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/rank-percentile")
async def analyze_rank_percentile(body: RankPercentileBody):
    try:
        result = run_rank_percentile(body.rows, body.valueCol)
        if result is None:
            raise HTTPException(status_code=400, detail="Cột không tồn tại hoặc không có dữ liệu số")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/random-number")
async def analyze_random_number(body: RandomNumberBody):
    try:
        kwargs = {"seed": body.seed}
        if body.low is not None:
            kwargs["low"] = body.low
        if body.high is not None:
            kwargs["high"] = body.high
        if body.mean is not None:
            kwargs["mean"] = body.mean
        if body.std is not None:
            kwargs["std"] = body.std
        if body.nTrials is not None:
            kwargs["nTrials"] = body.nTrials
        if body.p is not None:
            kwargs["p"] = body.p
        result = run_random_number_generation(body.n, body.distribution, **kwargs)
        return {"result": result}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/sampling")
async def analyze_sampling(body: SamplingBody):
    try:
        result = run_sampling(body.rows, body.n, body.method, body.seed)
        if result is None:
            raise HTTPException(status_code=400, detail="Dữ liệu không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ttest-paired")
async def analyze_ttest_paired(body: TTestPairedBody):
    try:
        result = run_ttest_paired(body.rows, body.col1, body.col2)
        if result is None:
            raise HTTPException(status_code=400, detail="Cần ít nhất 2 cột số và đủ cặp dữ liệu")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))


@router.post("/ztest-two-means")
async def analyze_ztest_two_means(body: ZTestTwoMeansBody):
    try:
        result = run_ztest_two_means(
            body.rows,
            body.groupCol,
            body.groupVal1,
            body.groupVal2,
            body.numCol,
            body.knownVar1,
            body.knownVar2,
        )
        if result is None:
            raise HTTPException(status_code=400, detail="Không đủ dữ liệu hoặc cột không hợp lệ")
        return {"result": result}
    except HTTPException:
        raise
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
