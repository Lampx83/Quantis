"""
Chẩn đoán hồi quy OLS (Phase 4.1) — Regression Diagnostics.

Mô-đun duy nhất quyết định mọi Verdict: ngưỡng, quy tắc, các khối thống kê và payload.
`run_ols` không bị sửa; route `/ols` gọi hàm ở đây rồi gộp kết quả vào response (R11.1).

Bất biến:
- Không bao giờ raise ra ngoài: mọi lỗi thành `{ok: False, errorCode, errorDetail}` (R7.1).
- Mọi số trong payload là số hữu hạn; NaN/Inf → None tại biên (R1.3).
- Mọi thống kê tính trên đúng Model sample của mô hình đã fit (R1.6).
"""
from __future__ import annotations

import math
import warnings
from typing import Any

import numpy as np
import pandas as pd
from scipy import stats as scipy_stats

from analysis_impl import _rows_to_df

# Plot sampling and caps (R5.4–R5.6). Verdicts always use the full Model sample.
PLOT_SAMPLE_LIMIT = 5000
QQ_MAX_POINTS = 2000
INFLUENTIAL_MAX = 20

# Assumption thresholds (R3.2). Verdicts and the on-screen threshold sentences
# must both come from these numbers — a literal elsewhere is a defect (R3.6).
ALPHA_PASS = 0.05
ALPHA_VIOLATION = 0.01
NORMALITY_ALPHA = 0.05
NORMALITY_VIOLATION_ALPHA = 0.001
NORMALITY_SKEW_GUARD = 1.0
NORMALITY_EXCESS_KURTOSIS_GUARD = 2.0
VIF_CAUTION = 5.0
VIF_VIOLATION = 10.0
COOK_ABSOLUTE_LIMIT = 1.0
COOK_RELATIVE_MULTIPLIER = 4.0
STUDENTIZED_LIMIT = 3.0
LEVERAGE_MULTIPLIER = 2.0
SHAPIRO_MAX_N = 5000

PASS = "pass"
CAUTION = "caution"
VIOLATION = "violation"
_SEVERITY = {PASS: 0, CAUTION: 1, VIOLATION: 2}



class _DiagError(Exception):
    """A known diagnostics condition, mapped to a payload errorCode."""

    def __init__(self, code: str):
        super().__init__(code)
        self.code = code


# ---------------------------------------------------------------------------
# Boundary helpers
# ---------------------------------------------------------------------------


def _finite(value: Any) -> float | None:
    """JSON-safe float: NaN and ±inf become None."""
    try:
        number = float(value)
    except (TypeError, ValueError):
        return None
    return number if math.isfinite(number) else None


def _finite_list(values: Any) -> list[float | None]:
    return [_finite(v) for v in values]


def diagnostics_failure(error_code: str, detail: str | None = None) -> dict:
    """The failed-run envelope: model-bearing keys absent (R12)."""
    return {"ok": False, "errorCode": error_code, "errorDetail": detail}


# ---------------------------------------------------------------------------
# The judged table and the diagnostics' own fit
# ---------------------------------------------------------------------------


def _fit_judged_table(
    rows: list, y_col: str, x_cols: list[str]
) -> tuple[Any, list[int]]:
    """Fit the judged table; return (fitted model, Model-sample row positions).

    Row positions are Analysis row coordinates: 0-based positions in `rows[1:]`,
    so listwise deletion is expressed by rows *absent* from the list (R1.5).
    """
    from statsmodels.regression.linear_model import OLS
    from statsmodels.tools import add_constant

    try:
        df = _rows_to_df(rows)
    except Exception:
        raise _DiagError("insufficient_n")
    for column in [y_col] + list(x_cols):
        if column not in df.columns:
            raise _DiagError("not_available")

    numeric = df[[y_col] + list(x_cols)].apply(pd.to_numeric, errors="coerce")
    mask = numeric.notna().all(axis=1).to_numpy()
    used = [int(i) for i in np.flatnonzero(mask)]
    data = numeric.loc[mask]

    # No residual degrees of freedom: the defensive guard (R7.3).
    if len(data) <= len(x_cols) + 1:
        raise _DiagError("insufficient_n")

    design = add_constant(data[list(x_cols)])
    try:
        model = OLS(data[y_col], design).fit()
    except Exception:
        raise _DiagError("singular_x")
    return model, used


def _sample_block(
    n_input: int,
    n_used: int,
    method: str,
    m: int | None,
    active_imputation: int | None,
) -> dict:
    return {
        "nInput": int(n_input),
        "nUsed": int(n_used),
        "nDropped": int(max(0, n_input - n_used)),
        "method": method,
        "m": m,
        "activeImputation": active_imputation,
    }


# ---------------------------------------------------------------------------
# Verdict rules — the single place a Verdict is decided (R3.1, AD-4)
# ---------------------------------------------------------------------------


def verdict_for_p(p: float) -> str:
    """One p-value: pass at ≥ .05, caution in [.01, .05), violation below .01."""
    if p < ALPHA_VIOLATION:
        return VIOLATION
    if p < ALPHA_PASS:
        return CAUTION
    return PASS


def _worse(first: str, second: str) -> str:
    return first if _SEVERITY[first] >= _SEVERITY[second] else second


def linearity_verdict(bp_p: float, reset_p: float) -> str:
    """The worse of the two linearity tests (R3.4)."""
    return _worse(verdict_for_p(bp_p), verdict_for_p(reset_p))


def normality_verdict(p: float, skewness: float, excess_kurtosis: float) -> str:
    """A p-value alone never produces a Violation: the magnitude guard must also trip (R3.3)."""
    if p >= NORMALITY_ALPHA:
        return PASS
    if p < NORMALITY_VIOLATION_ALPHA and (
        abs(skewness) >= NORMALITY_SKEW_GUARD
        or excess_kurtosis >= NORMALITY_EXCESS_KURTOSIS_GUARD
    ):
        return VIOLATION
    return CAUTION


def influence_verdict(cook_d: np.ndarray, studentized: np.ndarray) -> str:
    """Cook's D decides; the studentized residual can only raise Caution (R3.4).

    Non-finite studentized residuals (undefined when df_resid is 1) are ignored:
    an undefined statistic must not manufacture a Verdict (R1.3).
    """
    cooks = np.asarray(cook_d, dtype=float)
    stud = np.asarray(studentized, dtype=float)
    finite_cooks = cooks[np.isfinite(cooks)]
    finite_stud = stud[np.isfinite(stud)]
    n = len(finite_cooks)
    if n and float(np.max(finite_cooks)) > COOK_ABSOLUTE_LIMIT:
        return VIOLATION
    cut = COOK_RELATIVE_MULTIPLIER / n if n else 0.0
    if np.any(finite_cooks > cut) or np.any(np.abs(finite_stud) > STUDENTIZED_LIMIT):
        return CAUTION
    return PASS


def collinearity_verdict(max_vif: float | None) -> str:
    """None means a non-finite (infinite) VIF — perfect collinearity, a Violation (R2.5)."""
    if max_vif is None:
        return VIOLATION
    if max_vif >= VIF_VIOLATION:
        return VIOLATION
    if max_vif >= VIF_CAUTION:
        return CAUTION
    return PASS


# ---------------------------------------------------------------------------
# Assumption rows
# ---------------------------------------------------------------------------


def _inapplicable(row_id: str, reason: str) -> dict:
    return {"id": row_id, "applicable": False, "notApplicableReason": reason}


def _linearity_row(model: Any, n: int, k: int) -> dict:
    # RESET's denominator df is n - k - 2; at n = k + 2 it is 0 (R7.3).
    if n - k - 2 < 1:
        return _inapplicable("linearity", "insufficientDf")
    from statsmodels.stats.diagnostic import het_breuschpagan, linear_reset

    try:
        design = np.asarray(model.model.exog, dtype=float)
        augmented = np.column_stack((design, np.asarray(model.fittedvalues) ** 2))
        # Binary and saturated group models already span fitted values squared.
        # RESET's coefficient test is not identifiable without an added rank.
        if np.linalg.matrix_rank(augmented) <= np.linalg.matrix_rank(design):
            return _inapplicable("linearity", "notComputable")
        lm, lm_p, _, _ = het_breuschpagan(model.resid, design)
        reset = linear_reset(model, power=2, use_f=True)
        stats = {
            "bp": {"chi2": _finite(lm), "df": int(k), "p": _finite(lm_p)},
            "reset": {
                "f": _finite(reset.statistic),
                "df1": int(reset.df_num),
                "df2": int(reset.df_denom),
                "p": _finite(reset.pvalue),
            },
        }
        if any(
            value is None
            for value in (
                stats["bp"]["chi2"], stats["bp"]["p"],
                stats["reset"]["f"], stats["reset"]["p"],
            )
        ):
            return _inapplicable("linearity", "notComputable")
    except Exception:
        return _inapplicable("linearity", "notComputable")
    return {
        "id": "linearity",
        "applicable": True,
        "verdict": linearity_verdict(lm_p, reset.pvalue),
        "stats": stats,
    }


def _normality_row(model: Any, n: int) -> dict:
    if n < 3:
        return _inapplicable("normality", "notComputable")
    resid = np.asarray(model.resid, dtype=float)
    try:
        if n <= SHAPIRO_MAX_N:
            test_name = "shapiro"
            stat, p = scipy_stats.shapiro(resid)
        else:
            test_name = "jarqueBera"
            stat, p = scipy_stats.jarque_bera(resid)
        skewness = float(scipy_stats.skew(resid))
        excess_kurtosis = float(scipy_stats.kurtosis(resid, fisher=True))
        stats = {
            "test": test_name,
            "stat": _finite(stat),
            "p": _finite(p),
            "skewness": _finite(skewness),
            "excessKurtosis": _finite(excess_kurtosis),
        }
        if any(stats[key] is None for key in ("stat", "p", "skewness", "excessKurtosis")):
            return _inapplicable("normality", "notComputable")
    except Exception:
        return _inapplicable("normality", "notComputable")
    return {
        "id": "normality",
        "applicable": True,
        "verdict": normality_verdict(p, skewness, excess_kurtosis),
        "stats": stats,
    }


def _influence_row(
    n: int, k: int, cooks: np.ndarray, leverage: np.ndarray, studentized: np.ndarray
) -> dict:
    try:
        finite_cooks = cooks[np.isfinite(cooks)]
        finite_stud = studentized[np.isfinite(studentized)]
        stats = {
            "maxCookD": _finite(np.max(finite_cooks)) if finite_cooks.size else None,
            "nAbove4n": int(np.sum(finite_cooks > COOK_RELATIVE_MULTIPLIER / n)),
            "maxLeverage": _finite(np.max(leverage)),
            "leverageCut": _finite(LEVERAGE_MULTIPLIER * (k + 1) / n),
            # None when df_resid is 1: the externally studentized residual is undefined.
            "maxStudentized": (
                _finite(np.max(np.abs(finite_stud))) if finite_stud.size else None
            ),
            "nStudentizedAbove3": int(np.sum(np.abs(finite_stud) > STUDENTIZED_LIMIT)),
        }
        if any(stats[key] is None for key in ("maxCookD", "maxLeverage", "leverageCut")):
            return _inapplicable("influence", "notComputable")
    except Exception:
        return _inapplicable("influence", "notComputable")
    return {
        "id": "influence",
        "applicable": True,
        "verdict": influence_verdict(cooks, studentized),
        "stats": stats,
    }


def _collinearity_row(x_cols: list[str], vif: dict) -> dict:
    if len(x_cols) < 2:
        return _inapplicable("collinearity", "singlePredictor")
    try:
        values = [entry.get("vif") for entry in vif.values()]
        if not values:
            return _inapplicable("collinearity", "notComputable")
        max_vif = None if any(value is None for value in values) else float(max(values))
    except Exception:
        return _inapplicable("collinearity", "notComputable")
    return {
        "id": "collinearity",
        "applicable": True,
        "verdict": collinearity_verdict(max_vif),
        "stats": {"maxVif": max_vif},
    }


def _safe_row(builder: Any, row_id: str, *args: Any) -> dict:
    """Per-row fault isolation: one failed statistic keeps the other three rows (AD-5)."""
    try:
        return builder(*args)
    except Exception:
        return _inapplicable(row_id, "notComputable")


def _assumptions(
    model: Any,
    n: int,
    k: int,
    x_cols: list[str],
    vif: dict,
    cooks: np.ndarray,
    leverage: np.ndarray,
    studentized: np.ndarray,
) -> list[dict]:
    return [
        _safe_row(_linearity_row, "linearity", model, n, k),
        _safe_row(_normality_row, "normality", model, n),
        _safe_row(_influence_row, "influence", n, k, cooks, leverage, studentized),
        _safe_row(_collinearity_row, "collinearity", x_cols, vif),
    ]


# ---------------------------------------------------------------------------
# Statistic blocks — always on the model's own objects (AD-6)
# ---------------------------------------------------------------------------


def thresholds_block() -> dict:
    """The numbers the UI prints in its threshold sentences, from the constants above (R3.6)."""
    return {
        "linearityAlpha": ALPHA_PASS,
        "normalityAlpha": NORMALITY_ALPHA,
        "normalityViolationAlpha": NORMALITY_VIOLATION_ALPHA,
        "normalitySkewGuard": NORMALITY_SKEW_GUARD,
        "normalityExcessKurtosisGuard": NORMALITY_EXCESS_KURTOSIS_GUARD,
        "vifCaution": VIF_CAUTION,
        "vifViolation": VIF_VIOLATION,
        "cookAbsolute": COOK_ABSOLUTE_LIMIT,
        "cookRelativeMultiplier": COOK_RELATIVE_MULTIPLIER,
        "studentized": STUDENTIZED_LIMIT,
    }


def _stride_indices(n: int) -> list[int]:
    """Deterministic plot sample: start at 0, step ceil(n / 5000) (R5.4)."""
    if n <= PLOT_SAMPLE_LIMIT:
        return list(range(n))
    step = max(1, math.ceil(n / PLOT_SAMPLE_LIMIT))
    return list(range(0, n, step))


def _external_studentized(model: Any, leverage: np.ndarray) -> np.ndarray:
    resid = np.asarray(model.resid, dtype=float)
    if model.df_resid <= 1:
        return np.full_like(resid, np.nan)

    # Removing observation i reduces SSE by e_i² / (1 − h_i).
    remaining = 1 - leverage
    deleted_ssr = model.ssr - resid**2 / remaining
    variance = remaining * deleted_ssr / (model.df_resid - 1)
    return resid / np.sqrt(np.where((remaining > 0) & (deleted_ssr > 0), variance, np.nan))


def _obs_block(model: Any, used: list[int], influence: Any, studentized: np.ndarray) -> dict:
    n = len(used)
    idx = np.asarray(_stride_indices(n), dtype=int)
    cooks = np.asarray(influence.cooks_distance[0], dtype=float)
    fitted = np.asarray(model.fittedvalues, dtype=float)
    resid = np.asarray(model.resid, dtype=float)
    return {
        "rowIndex": [used[i] for i in idx],
        "fitted": _finite_list(fitted[idx]),
        "resid": _finite_list(resid[idx]),
        "stdResid": _finite_list(np.asarray(influence.resid_studentized_internal, dtype=float)[idx]),
        "studentized": _finite_list(studentized[idx]),
        "leverage": _finite_list(np.asarray(influence.hat_matrix_diag, dtype=float)[idx]),
        "cookD": _finite_list(cooks[idx]),
    }


def _qq_block(resid: Any) -> dict:
    """Standardized residual quantiles for the UI's standard-normal y=x line."""
    residuals = np.asarray(resid, dtype=float)
    # Rescale first so computing the sample SD cannot overflow or underflow.
    magnitude = np.max(np.abs(residuals))
    scaled = residuals / magnitude if magnitude > 0 else residuals
    sd = np.std(scaled, ddof=1)
    standardized = (scaled - scaled.mean()) / sd if sd > 0 else np.full_like(scaled, np.nan)
    osm, osr = scipy_stats.probplot(standardized, dist="norm", fit=False)
    theoretical = np.asarray(osm, dtype=float)
    sample = np.asarray(osr, dtype=float)
    n = len(theoretical)
    if n > QQ_MAX_POINTS:
        keep = np.unique(np.round(np.linspace(0, n - 1, QQ_MAX_POINTS)).astype(int))
        theoretical = theoretical[keep]
        sample = sample[keep]
    return {"theoretical": _finite_list(theoretical), "sample": _finite_list(sample)}


def _vif_block(model: Any, x_cols: list[str]) -> dict:
    """VIF and tolerance from the model's own design matrix — never a re-fit per predictor."""
    if len(x_cols) < 2:
        return {}
    from statsmodels.stats.outliers_influence import variance_inflation_factor

    exog = np.asarray(model.model.exog, dtype=float)
    names = list(model.model.exog_names)
    out: dict[str, dict] = {}
    with warnings.catch_warnings():
        warnings.simplefilter("ignore")
        with np.errstate(divide="ignore", invalid="ignore"):
            for column in x_cols:
                if column not in names:
                    continue
                vif = _finite(variance_inflation_factor(exog, names.index(column)))
                out[column] = {
                    "vif": vif,
                    "tolerance": None if vif in (None, 0.0) else _finite(1.0 / vif),
                }
    return out


def _safe_vif(model: Any, x_cols: list[str]) -> dict:
    """VIF failure degrades only the collinearity row, never the payload."""
    try:
        return _vif_block(model, x_cols)
    except Exception:
        return {}


def _hc3_block(model: Any, x_cols: list[str]) -> dict:
    robust = model.get_robustcov_results(cov_type="HC3")
    ci = np.asarray(robust.conf_int(), dtype=float)
    source_names = list(model.model.exog_names)

    def at(container: Any, position: int) -> float:
        return float(container.iloc[position] if hasattr(container, "iloc") else container[position])

    block: dict[str, dict] = {"se": {}, "tStat": {}, "pValue": {}, "ciLower": {}, "ciUpper": {}}
    for display, source in [("(Intercept)", "const")] + [(c, c) for c in x_cols]:
        if source not in source_names:
            block["se"][display] = None
            block["tStat"][display] = None
            block["pValue"][display] = None
            block["ciLower"][display] = None
            block["ciUpper"][display] = None
            continue
        position = source_names.index(source)
        block["se"][display] = _finite(at(robust.bse, position))
        block["tStat"][display] = _finite(at(robust.tvalues, position))
        block["pValue"][display] = _finite(at(robust.pvalues, position))
        block["ciLower"][display] = _finite(ci[position, 0])
        block["ciUpper"][display] = _finite(ci[position, 1])
    return block


def _influential_block(
    used: list[int], cooks: np.ndarray, leverage: np.ndarray, studentized: np.ndarray
) -> list[dict]:
    """The flagged observations: Cook's D above 4/n, largest first, capped at 20 (R5.6)."""
    n = len(used)
    if n == 0:
        return []
    cut = 4.0 / n
    finite_mask = np.isfinite(cooks)
    indices = np.flatnonzero(finite_mask)
    if indices.size == 0:
        return []
    out: list[dict] = []
    for i in indices[np.argsort(-cooks[indices], kind="stable")]:
        if cooks[i] <= cut:
            break
        out.append(
            {
                "rowIndex": int(used[i]),
                "cookD": _finite(cooks[i]),
                "leverage": _finite(leverage[i]),
                "studentized": _finite(studentized[i]),
            }
        )
        if len(out) >= INFLUENTIAL_MAX:
            break
    return out


# ---------------------------------------------------------------------------
# Payload builder
# ---------------------------------------------------------------------------


def build_regression_diagnostics(
    rows: list,
    y_col: str,
    x_cols: list[str],
    *,
    method: str = "listwise",
    m: int | None = None,
    active_imputation: int | None = None,
) -> dict:
    """Diagnostics payload for one fitted OLS model; never raises."""
    try:
        model, used = _fit_judged_table(rows, y_col, x_cols)
        with warnings.catch_warnings():
            # Undefined influence statistics are serialized as null.
            warnings.simplefilter("ignore", RuntimeWarning)
            influence = model.get_influence()
            cooks = np.asarray(influence.cooks_distance[0], dtype=float)
            leverage = np.asarray(influence.hat_matrix_diag, dtype=float)
            studentized = _external_studentized(model, leverage)
            obs = _obs_block(model, used, influence, studentized)
        n_used = len(used)
        n_predictors = len(x_cols)
        vif = _safe_vif(model, x_cols)
        return {
            "ok": True,
            "errorCode": None,
            "errorDetail": None,
            "sample": _sample_block(max(0, len(rows) - 1), n_used, method, m, active_imputation),
            "obs": obs,
            "qq": _qq_block(model.resid),
            "assumptions": _assumptions(
                model, n_used, n_predictors, x_cols, vif, cooks, leverage, studentized
            ),
            "vif": vif,
            "influential": _influential_block(used, cooks, leverage, studentized),
            "robustHC3": _hc3_block(model, x_cols),
            "thresholds": thresholds_block(),
            "sampled": n_used > PLOT_SAMPLE_LIMIT,
        }
    except _DiagError as exc:
        return diagnostics_failure(exc.code)
    except Exception as exc:  # fault isolation: a working regression outranks diagnostics
        return diagnostics_failure("internal", str(exc))

