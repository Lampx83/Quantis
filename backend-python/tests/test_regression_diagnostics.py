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
import pandas as pd

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

import pytest  # noqa: E402
from fastapi.testclient import TestClient  # noqa: E402
from scipy import stats as scipy_stats  # noqa: E402
from statsmodels.regression.linear_model import OLS  # noqa: E402
from statsmodels.stats.outliers_influence import variance_inflation_factor  # noqa: E402
from statsmodels.tools import add_constant  # noqa: E402

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


def fitted_reference(rows, y_col="Y", x_cols=("X1", "X2", "X3")):
    """Independent statsmodels fit on the same listwise-deleted sample."""
    df = pd.DataFrame(rows[1:], columns=rows[0])
    numeric = df[[y_col] + list(x_cols)].apply(pd.to_numeric, errors="coerce").dropna()
    design = add_constant(numeric[list(x_cols)])
    return OLS(numeric[y_col], design).fit(), numeric


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


# ---------------------------------------------------------------------------
# T02 — residual blocks, VIF, HC3, sampling
# ---------------------------------------------------------------------------


OBS_KEYS = ("fitted", "resid", "stdResid", "studentized", "leverage", "cookD")


def test_obs_block_matches_statsmodels():
    rows = make_rows()
    diag = post_ols(rows).json()["result"]["diagnostics"]
    obs = diag["obs"]
    model, data = fitted_reference(rows)
    influence = model.get_influence()

    assert len(data) == 80
    assert obs["rowIndex"] == list(range(80))
    for key in OBS_KEYS:
        assert len(obs[key]) == 80, key

    np.testing.assert_allclose(obs["fitted"], model.fittedvalues, atol=TOL)
    np.testing.assert_allclose(obs["resid"], model.resid, atol=TOL)
    np.testing.assert_allclose(obs["stdResid"], influence.resid_studentized_internal, atol=TOL)
    np.testing.assert_allclose(obs["studentized"], influence.resid_studentized_external, atol=TOL)
    np.testing.assert_allclose(obs["leverage"], influence.hat_matrix_diag, atol=TOL)
    np.testing.assert_allclose(obs["cookD"], influence.cooks_distance[0], atol=TOL)


def test_obs_row_index_is_ascending_model_sample():
    rows = make_rows(n=60, missing_every=7)
    obs = post_ols(rows).json()["result"]["diagnostics"]["obs"]
    expected_used = [i for i in range(60) if (i + 1) % 7 != 0]

    assert obs["rowIndex"] == expected_used
    assert obs["rowIndex"] == sorted(obs["rowIndex"])
    for key in OBS_KEYS:
        assert len(obs[key]) == len(expected_used), key
    model, _ = fitted_reference(rows)
    np.testing.assert_allclose(
        obs["cookD"], model.get_influence().cooks_distance[0], atol=TOL
    )


def test_vif_matches_model_design_matrix():
    rows = make_rows()
    diag = post_ols(rows).json()["result"]["diagnostics"]
    model, _ = fitted_reference(rows)
    exog = np.asarray(model.model.exog, dtype=float)
    names = list(model.model.exog_names)

    assert set(diag["vif"]) == {"X1", "X2", "X3"}
    assert "(Intercept)" not in diag["vif"]
    for column in ("X1", "X2", "X3"):
        expected = float(variance_inflation_factor(exog, names.index(column)))
        assert abs(diag["vif"][column]["vif"] - expected) < TOL
        assert abs(diag["vif"][column]["tolerance"] - 1.0 / expected) < TOL


def test_robust_hc3_matches_statsmodels():
    rows = make_rows()
    diag = post_ols(rows).json()["result"]["diagnostics"]
    model, _ = fitted_reference(rows)
    robust = model.get_robustcov_results(cov_type="HC3")
    ci = np.asarray(robust.conf_int(), dtype=float)
    names = list(model.model.exog_names)
    mapping = {"(Intercept)": "const", "X1": "X1", "X2": "X2", "X3": "X3"}

    for key, source in mapping.items():
        pos = names.index(source)
        assert abs(diag["robustHC3"]["se"][key] - float(robust.bse[pos])) < TOL
        assert abs(diag["robustHC3"]["tStat"][key] - float(robust.tvalues[pos])) < TOL
        assert abs(diag["robustHC3"]["pValue"][key] - float(robust.pvalues[pos])) < TOL
        assert abs(diag["robustHC3"]["ciLower"][key] - ci[pos, 0]) < TOL
        assert abs(diag["robustHC3"]["ciUpper"][key] - ci[pos, 1]) < TOL


def test_qq_matches_blom_positions():
    rows = make_rows()
    diag = post_ols(rows).json()["result"]["diagnostics"]
    model, _ = fitted_reference(rows)
    osm, osr = scipy_stats.probplot(np.asarray(model.resid), dist="norm", fit=False)

    assert len(diag["qq"]["theoretical"]) == len(diag["qq"]["sample"]) == 80
    np.testing.assert_allclose(diag["qq"]["theoretical"], osm, atol=TOL)
    np.testing.assert_allclose(diag["qq"]["sample"], osr, atol=TOL)


def test_small_sample_is_not_sampled():
    diag = post_ols(make_rows(n=120)).json()["result"]["diagnostics"]
    assert diag["sampled"] is False
    assert len(diag["obs"]["rowIndex"]) == 120
    assert len(diag["qq"]["theoretical"]) == 120


def test_large_sample_is_strided_deterministic_and_full_sample_numbers_survive():
    rows = make_rows(n=6000, seed=7)
    rows[321][1] = f"{float(rows[321][1]) + 50:.10f}"  # a clear influence outlier

    first = post_ols(rows).json()["result"]["diagnostics"]
    second = post_ols(rows).json()["result"]["diagnostics"]

    assert first["sampled"] is True
    assert len(first["obs"]["rowIndex"]) <= 5000
    assert first["obs"]["rowIndex"][0] == 0
    assert first["obs"]["rowIndex"] == second["obs"]["rowIndex"]
    assert first["obs"]["cookD"] == second["obs"]["cookD"]
    assert len(first["qq"]["theoretical"]) <= 2000
    assert len(first["qq"]["sample"]) == len(first["qq"]["theoretical"])

    assert 0 < len(first["influential"]) <= 20
    cooks = [row["cookD"] for row in first["influential"]]
    assert cooks == sorted(cooks, reverse=True)

    model, _ = fitted_reference(rows)
    full_max = float(np.max(model.get_influence().cooks_distance[0]))
    assert abs(first["influential"][0]["cookD"] - full_max) < TOL

