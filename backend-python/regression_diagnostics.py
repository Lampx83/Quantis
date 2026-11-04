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
from typing import Any

import numpy as np
import pandas as pd

from analysis_impl import _rows_to_df


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
    except _DiagError as exc:
        return diagnostics_failure(exc.code)
    except Exception as exc:  # fault isolation: a working regression outranks diagnostics
        return diagnostics_failure("internal", str(exc))

    n_input = max(0, len(rows) - 1)
    return {
        "ok": True,
        "errorCode": None,
        "errorDetail": None,
        "sample": _sample_block(n_input, len(used), method, m, active_imputation),
    }
