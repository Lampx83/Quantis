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
# Statistic blocks — always on the model's own objects (AD-6)
# ---------------------------------------------------------------------------


def _stride_indices(n: int) -> list[int]:
    """Deterministic plot sample: start at 0, step ceil(n / 5000) (R5.4)."""
    if n <= PLOT_SAMPLE_LIMIT:
        return list(range(n))
    step = max(1, math.ceil(n / PLOT_SAMPLE_LIMIT))
    return list(range(0, n, step))


def _obs_block(model: Any, used: list[int], influence: Any) -> dict:
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
        "studentized": _finite_list(np.asarray(influence.resid_studentized_external, dtype=float)[idx]),
        "leverage": _finite_list(np.asarray(influence.hat_matrix_diag, dtype=float)[idx]),
        "cookD": _finite_list(cooks[idx]),
    }


def _qq_block(resid: Any) -> dict:
    """Normal Q-Q using Blom plotting positions (statsmodels ProbPlot convention)."""
    osm, osr = scipy_stats.probplot(np.asarray(resid, dtype=float), dist="norm", fit=False)
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


def _hc3_block(model: Any, x_cols: list[str]) -> dict:
    robust = model.get_robustcov_results(cov_type="HC3")
    ci = np.asarray(robust.conf_int(), dtype=float)
    source_names = list(model.model.exog_names)

    def at(container: Any, position: int) -> float:
        return float(container.iloc[position] if hasattr(container, "iloc") else container[position])

    block: dict[str, dict] = {"se": {}, "tStat": {}, "pValue": {}, "ciLower": {}, "ciUpper": {}}
    for display, source in [("(Intercept)", "const")] + [(c, c) for c in x_cols]:
        position = source_names.index(source) if source in source_names else 0
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
    out: list[dict] = []
    for i in np.argsort(-cooks, kind="stable"):
        if not np.isfinite(cooks[i]) or cooks[i] <= cut:
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
        influence = model.get_influence()
        cooks = np.asarray(influence.cooks_distance[0], dtype=float)
        n_used = len(used)
        return {
            "ok": True,
            "errorCode": None,
            "errorDetail": None,
            "sample": _sample_block(max(0, len(rows) - 1), n_used, method, m, active_imputation),
            "obs": _obs_block(model, used, influence),
            "qq": _qq_block(model.resid),
            "vif": _vif_block(model, x_cols),
            "influential": _influential_block(
                used,
                cooks,
                np.asarray(influence.hat_matrix_diag, dtype=float),
                np.asarray(influence.resid_studentized_external, dtype=float),
            ),
            "robustHC3": _hc3_block(model, x_cols),
            "sampled": n_used > PLOT_SAMPLE_LIMIT,
        }
    except _DiagError as exc:
        return diagnostics_failure(exc.code)
    except Exception as exc:  # fault isolation: a working regression outranks diagnostics
        return diagnostics_failure("internal", str(exc))

