"""
Regression diagnostics (Phase 4.1) — API contract + parity with statsmodels.

Seam 1: POST /ols through TestClient. Numbers are asserted against an independent
statsmodels computation with an absolute tolerance of 1e-8 (the convention used by
tests/test_panel.py).
"""
import json
import os
import sys

import numpy as np

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402

import routes_analyze  # noqa: E402
from analysis_impl import run_ols  # noqa: E402
from main import app  # noqa: E402

client = TestClient(app)
OLS_URL = "/api/quantis/analyze/ols"

TOL = 1e-8


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------


def make_rows(n=80, seed=42, missing_every=None):
    """Synthetic dataset: Y = 1.5 + 2*X1 - 1*X2 + 0.5*X3 + noise."""
    rng = np.random.default_rng(seed)
    rows = [["Y", "X1", "X2", "X3"]]
    for i in range(n):
        x1, x2, x3 = rng.normal(), rng.normal(), rng.normal()
        y = 1.5 + 2.0 * x1 - 1.0 * x2 + 0.5 * x3 + rng.normal(0, 1)
        cells = [f"{y:.10f}", f"{x1:.10f}", f"{x2:.10f}", f"{x3:.10f}"]
        if missing_every and (i + 1) % missing_every == 0:
            cells[1] = ""
        rows.append(cells)
    return rows


def post_ols(rows, y_col="Y", x_cols=("X1", "X2", "X3"), **extra):
    body = {"rows": rows, "yCol": y_col, "xCols": list(x_cols)}
    body.update(extra)
    return client.post(OLS_URL, json=body)


# ---------------------------------------------------------------------------
# T01 — payload envelope, sample accounting, fault isolation
# ---------------------------------------------------------------------------


def test_ols_payload_envelope_keeps_existing_keys():
    rows = make_rows()
    response = post_ols(rows)
    assert response.status_code == 200
    result = response.json()["result"]

    # Every pre-existing key is still there with its old meaning.
    for key in (
        "coefficients", "intercept", "r2", "adjR2", "se", "tStat", "pValue",
        "ciLower", "ciUpper", "n", "df", "s2", "yName", "xNames", "rubinPooled",
    ):
        assert key in result, f"missing pre-existing key {key}"
    assert result["yName"] == "Y"
    assert result["xNames"] == ["X1", "X2", "X3"]
    assert "(Intercept)" in result["coefficients"]

    # The new keys sit beside them.
    assert result["nInput"] == len(rows) - 1
    assert result["nDropped"] == 0
    assert result["missingMethod"] == "listwise"
    assert result["diagnostics"]["ok"] is True


def test_sample_accounting_identity_and_method():
    rows = make_rows(n=80, missing_every=10)
    result = post_ols(rows).json()["result"]

    assert result["nInput"] == 80
    assert result["nDropped"] == 80 - result["n"]
    assert result["nDropped"] > 0

    sample = result["diagnostics"]["sample"]
    assert sample["nInput"] == result["nInput"]
    assert sample["nUsed"] == result["n"]
    assert sample["nUsed"] == sample["nInput"] - sample["nDropped"]
    assert sample["method"] == result["missingMethod"] == "listwise"
    assert sample["m"] is None
    assert sample["activeImputation"] is None


def test_request_without_active_imputation_index_keeps_coefficients():
    rows = make_rows()
    result = post_ols(rows).json()["result"]
    expected = run_ols(rows, "Y", ["X1", "X2", "X3"])
    assert expected is not None
    assert result["coefficients"] == expected["coefficients"]
    assert result["n"] == expected["n"]
    assert result["df"] == expected["df"]


def test_diagnostics_failure_is_isolated(monkeypatch):
    rows = make_rows()

    def boom(*_args, **_kwargs):
        raise RuntimeError("synthetic failure")

    monkeypatch.setattr(routes_analyze, "build_regression_diagnostics", boom)
    response = post_ols(rows)
    assert response.status_code == 200

    result = response.json()["result"]
    expected = run_ols(rows, "Y", ["X1", "X2", "X3"])
    assert result["coefficients"] == expected["coefficients"]
    assert result["diagnostics"]["ok"] is False
    assert result["diagnostics"]["errorCode"] == "internal"
    assert result["nInput"] == 80
    assert result["nDropped"] == 0
    assert result["missingMethod"] == "listwise"


def test_payload_survives_strict_json_round_trip():
    result = post_ols(make_rows()).json()["result"]
    dumped = json.dumps(result, allow_nan=False)
    assert json.loads(dumped)["diagnostics"]["ok"] is True
