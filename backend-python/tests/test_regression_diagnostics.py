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
from statsmodels.stats.outliers_influence import OLSInfluence, variance_inflation_factor  # noqa: E402
from statsmodels.tools import add_constant  # noqa: E402

import routes_analyze  # noqa: E402
from analysis_impl import run_ols  # noqa: E402
from main import app  # noqa: E402
from regression_diagnostics import (  # noqa: E402
    collinearity_verdict,
    influence_verdict,
    linearity_verdict,
    normality_verdict,
    verdict_for_p,
)

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


def test_payload_thresholds_are_the_verdict_constants():
    """The UI prints these numbers, so the payload must carry the constants, not copies (R3.6)."""
    from regression_diagnostics import (
        ALPHA_PASS,
        COOK_ABSOLUTE_LIMIT,
        COOK_RELATIVE_MULTIPLIER,
        NORMALITY_ALPHA,
        NORMALITY_EXCESS_KURTOSIS_GUARD,
        NORMALITY_SKEW_GUARD,
        NORMALITY_VIOLATION_ALPHA,
        STUDENTIZED_LIMIT,
        VIF_CAUTION,
        VIF_VIOLATION,
    )

    thresholds = post_ols(make_rows()).json()["result"]["diagnostics"]["thresholds"]
    assert thresholds == {
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


def test_ols_diagnostics_do_not_refit_for_external_studentization(monkeypatch):
    def reject_leave_one_out(_):
        raise AssertionError("diagnostics refit OLS for each observation")

    monkeypatch.setattr(OLSInfluence, "_res_looo", property(reject_leave_one_out))
    result = post_ols(make_rows(n=6000)).json()["result"]
    diag = result["diagnostics"]

    assert diag["ok"], diag.get("errorDetail")
    assert diag["sampled"]
    assert len(diag["obs"]["studentized"]) == 3000
    assert all(value is not None for value in diag["obs"]["studentized"])


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


def test_influential_block_ignores_infinite_or_nan_cooks():
    from regression_diagnostics import _influential_block

    used = list(range(10))
    cooks = np.array([np.inf, 0.8, np.nan, 0.6, 0.01, 0.02, 0.03, 0.04, 0.05, 0.06])
    leverage = np.zeros(10)
    studentized = np.zeros(10)

    influential = _influential_block(used, cooks, leverage, studentized)
    assert len(influential) == 2
    assert influential[0]["rowIndex"] == 1
    assert influential[0]["cookD"] == 0.8
    assert influential[1]["rowIndex"] == 3
    assert influential[1]["cookD"] == 0.6


# ---------------------------------------------------------------------------
# T03 — assumption rows, verdict rules, applicability
# ---------------------------------------------------------------------------


def test_assumptions_have_fixed_order_ids_and_stats():
    diag = post_ols(make_rows()).json()["result"]["diagnostics"]
    assumptions = diag["assumptions"]

    assert [row["id"] for row in assumptions] == [
        "linearity",
        "normality",
        "influence",
        "collinearity",
    ]
    for row in assumptions:
        assert row["applicable"] is True
        assert row["verdict"] in {"pass", "caution", "violation"}

    linearity, normality, influence, collinearity = assumptions
    assert set(linearity["stats"]) == {"bp", "reset"}
    assert set(linearity["stats"]["bp"]) == {"chi2", "df", "p"}
    assert set(linearity["stats"]["reset"]) == {"f", "df1", "df2", "p"}
    assert set(normality["stats"]) == {"test", "stat", "p", "skewness", "excessKurtosis"}
    assert set(influence["stats"]) == {
        "maxCookD", "nAbove4n", "maxLeverage", "leverageCut",
        "maxStudentized", "nStudentizedAbove3",
    }
    assert set(collinearity["stats"]) == {"maxVif"}


def test_linearity_stats_match_statsmodels():
    from statsmodels.stats.diagnostic import het_breuschpagan, linear_reset

    rows = make_rows()
    diag = post_ols(rows).json()["result"]["diagnostics"]
    model, _ = fitted_reference(rows)
    lm, lm_p, _, _ = het_breuschpagan(model.resid, model.model.exog)
    reset = linear_reset(model, power=2, use_f=True)

    stats = diag["assumptions"][0]["stats"]
    assert abs(stats["bp"]["chi2"] - float(lm)) < TOL
    assert stats["bp"]["df"] == 3
    assert abs(stats["bp"]["p"] - float(lm_p)) < TOL
    assert abs(stats["reset"]["f"] - float(reset.statistic)) < TOL
    assert stats["reset"]["df1"] == 1
    assert stats["reset"]["df2"] == 80 - 3 - 2
    assert abs(stats["reset"]["p"] - float(reset.pvalue)) < TOL


def test_normality_stats_match_scipy():
    rows = make_rows()
    diag = post_ols(rows).json()["result"]["diagnostics"]
    model, _ = fitted_reference(rows)
    resid = np.asarray(model.resid, dtype=float)
    stat, p = scipy_stats.shapiro(resid)

    stats = diag["assumptions"][1]["stats"]
    assert stats["test"] == "shapiro"
    assert abs(stats["stat"] - float(stat)) < TOL
    assert abs(stats["p"] - float(p)) < TOL
    assert abs(stats["skewness"] - float(scipy_stats.skew(resid))) < TOL
    assert abs(stats["excessKurtosis"] - float(scipy_stats.kurtosis(resid, fisher=True))) < TOL


def test_normality_switches_to_jarque_bera_above_5000():
    diag = post_ols(make_rows(n=5200, seed=3)).json()["result"]["diagnostics"]
    stats = diag["assumptions"][1]["stats"]
    assert stats["test"] == "jarqueBera"
    model, _ = fitted_reference(make_rows(n=5200, seed=3))
    expected_stat, expected_p = scipy_stats.jarque_bera(np.asarray(model.resid, dtype=float))
    assert abs(stats["stat"] - float(expected_stat)) < TOL
    assert abs(stats["p"] - float(expected_p)) < TOL


def test_influence_stats_match_statsmodels():
    rows = make_rows()
    diag = post_ols(rows).json()["result"]["diagnostics"]
    model, _ = fitted_reference(rows)
    influence = model.get_influence()
    cooks = np.asarray(influence.cooks_distance[0], dtype=float)
    hat = np.asarray(influence.hat_matrix_diag, dtype=float)
    studentized = np.asarray(influence.resid_studentized_external, dtype=float)
    n, k = 80, 3

    stats = diag["assumptions"][2]["stats"]
    assert abs(stats["maxCookD"] - float(np.max(cooks))) < TOL
    assert stats["nAbove4n"] == int(np.sum(cooks > 4.0 / n))
    assert abs(stats["maxLeverage"] - float(np.max(hat))) < TOL
    assert abs(stats["leverageCut"] - 2.0 * (k + 1) / n) < TOL
    assert abs(stats["maxStudentized"] - float(np.max(np.abs(studentized)))) < TOL
    assert stats["nStudentizedAbove3"] == int(np.sum(np.abs(studentized) > 3.0))


def test_collinearity_max_vif_is_largest_vif():
    diag = post_ols(make_rows()).json()["result"]["diagnostics"]
    assert abs(
        diag["assumptions"][3]["stats"]["maxVif"]
        - max(entry["vif"] for entry in diag["vif"].values())
    ) < TOL


@pytest.mark.parametrize(
    "p,expected",
    [(0.0499, "caution"), (0.05, "pass"), (0.0501, "pass"), (0.0099, "violation"), (0.01, "caution")],
)
def test_verdict_for_p_boundaries(p, expected):
    assert verdict_for_p(p) == expected


def test_linearity_verdict_is_the_worse_of_both_tests():
    assert linearity_verdict(0.06, 0.06) == "pass"
    assert linearity_verdict(0.06, 0.03) == "caution"
    assert linearity_verdict(0.03, 0.06) == "caution"
    assert linearity_verdict(0.03, 0.005) == "violation"
    assert linearity_verdict(0.005, 0.03) == "violation"


def test_normality_verdict_requires_a_meaningful_deviation():
    assert normality_verdict(0.06, 5.0, 9.0) == "pass"
    assert normality_verdict(0.03, 5.0, 9.0) == "caution"
    # p below .001 but the magnitude guard fails -> caution, never violation
    assert normality_verdict(0.0005, 0.2, 0.0) == "caution"
    assert normality_verdict(0.0005, -0.2, 1.0) == "caution"
    assert normality_verdict(0.0005, 1.0, 0.0) == "violation"
    assert normality_verdict(0.0005, -1.0, 0.0) == "violation"
    assert normality_verdict(0.0005, 0.0, 2.0) == "violation"


def test_influence_verdict_boundaries():
    n = 100
    zeros = np.zeros(n)
    assert influence_verdict(np.full(n, 0.04), zeros) == "pass"
    assert influence_verdict(np.concatenate([[0.0401], np.zeros(n - 1)]), zeros) == "caution"
    assert influence_verdict(np.concatenate([[1.0], np.zeros(n - 1)]), zeros) == "caution"
    assert influence_verdict(np.concatenate([[1.0001], np.zeros(n - 1)]), zeros) == "violation"
    assert influence_verdict(zeros, np.concatenate([[3.0], np.zeros(n - 1)])) == "pass"
    assert influence_verdict(zeros, np.concatenate([[3.1], np.zeros(n - 1)])) == "caution"


@pytest.mark.parametrize(
    "max_vif,expected",
    [(4.99, "pass"), (5.0, "caution"), (9.99, "caution"), (10.0, "violation")],
)
def test_collinearity_verdict_boundaries(max_vif, expected):
    assert collinearity_verdict(max_vif) == expected


def test_single_predictor_marks_collinearity_inapplicable():
    diag = post_ols(make_rows(), x_cols=("X1",)).json()["result"]["diagnostics"]
    row = diag["assumptions"][3]

    assert row["applicable"] is False
    assert row["notApplicableReason"] == "singlePredictor"
    assert "stats" not in row
    assert "verdict" not in row
    assert diag["vif"] == {}
    assert diag["assumptions"][0]["applicable"] is True


def test_minimum_residual_df_marks_only_linearity_inapplicable():
    rows = [
        ["Y", "X1", "X2"],
        ["1", "1", "0"],
        ["2", "0", "1"],
        ["3", "1", "1"],
        ["4", "2", "0"],
    ]
    result = post_ols(rows, x_cols=("X1", "X2")).json()["result"]
    diag = result["diagnostics"]

    assert diag["ok"] is True
    linearity = diag["assumptions"][0]
    assert linearity["applicable"] is False
    assert linearity["notApplicableReason"] == "insufficientDf"
    assert "stats" not in linearity
    for row in diag["assumptions"][1:]:
        assert row["applicable"] is True
        assert row["verdict"] in {"pass", "caution", "violation"}


# ---------------------------------------------------------------------------
# T04 — imputation selection, numeric safety, defensive guards
# ---------------------------------------------------------------------------


def make_imputation_bundle(n=60, seed=11):
    """An original table with missing cells plus three complete imputed tables."""
    original = make_rows(n=n, seed=seed, missing_every=10)
    tables = []
    for k in (1, 2, 3):
        table = make_rows(n=n, seed=seed)
        for i in range(1, len(table)):
            table[i][2] = f"{float(table[i][2]) + 0.7 * k * ((i % 5) - 2):.10f}"
        tables.append(table)
    return original, tables


def test_active_index_zero_judges_the_posted_rows():
    original, tables = make_imputation_bundle()
    result = post_ols(original, imputedDatasets=tables, activeImputationIndex=0).json()["result"]

    assert result["rubinPooled"] is True
    assert result["missingMethod"] == "mice-active"
    diag = result["diagnostics"]
    assert diag["ok"] is True
    assert diag["sample"]["nInput"] == len(original) - 1
    assert diag["sample"]["activeImputation"] == 0
    assert diag["sample"]["m"] == 3
    # R4.5: the two sample sizes stay separate — coefficient model is pooled,
    # the judged original table listwise-drops its incomplete rows.
    assert result["n"] == 60
    assert diag["sample"]["nUsed"] == 54
    assert diag["sample"]["method"] == "listwise"
    assert result["nDropped"] == result["nInput"] - result["n"]


def test_active_index_selects_the_imputed_table():
    original, tables = make_imputation_bundle()
    baseline = post_ols([], imputedDatasets=tables, activeImputationIndex=1).json()["result"]
    second = post_ols([], imputedDatasets=tables, activeImputationIndex=2).json()["result"]

    # Coefficients never depend on which table diagnostics judge.
    assert baseline["coefficients"] == second["coefficients"]
    assert baseline["rubinPooled"] is True

    first_diag = baseline["diagnostics"]
    second_diag = second["diagnostics"]
    assert first_diag["sample"]["activeImputation"] == 1
    assert second_diag["sample"]["activeImputation"] == 2
    assert first_diag["sample"]["nInput"] == 60
    assert second_diag["sample"]["nUsed"] == 60
    assert first_diag["sample"]["method"] == "mice-active"
    # Distinguishable residuals prove the judged table really changed.
    assert first_diag["obs"]["resid"] != second_diag["obs"]["resid"]


def test_out_of_range_or_missing_bundle_is_not_available():
    rows = make_rows()
    no_bundle = post_ols(rows, activeImputationIndex=2).json()["result"]
    assert no_bundle["diagnostics"]["ok"] is False
    assert no_bundle["diagnostics"]["errorCode"] == "not_available"
    assert "(Intercept)" in no_bundle["coefficients"]
    assert no_bundle["n"] == 80

    _, tables = make_imputation_bundle()
    out_of_range = post_ols([], imputedDatasets=tables, activeImputationIndex=9).json()["result"]
    assert out_of_range["diagnostics"]["ok"] is False
    assert out_of_range["diagnostics"]["errorCode"] == "not_available"
    assert out_of_range["n"] == 60


def test_perfect_collinearity_is_a_violation_with_null_statistics():
    rows = [["Y", "X1", "X2"]]
    rng = np.random.default_rng(5)
    for _ in range(50):
        x1 = rng.normal()
        y = 1.0 + 2.0 * x1 + rng.normal(0, 0.5)
        rows.append([f"{y:.10f}", f"{x1:.10f}", f"{2.0 * x1:.10f}"])

    result = post_ols(rows, x_cols=("X1", "X2")).json()["result"]
    diag = result["diagnostics"]
    assert diag["ok"] is True

    collinearity = diag["assumptions"][3]
    assert collinearity["applicable"] is True
    assert collinearity["verdict"] == "violation"
    assert collinearity["stats"]["maxVif"] is None
    assert diag["vif"]["X1"] == {"vif": None, "tolerance": None}
    assert diag["vif"]["X2"] == {"vif": None, "tolerance": None}

    # The other rows still judge.
    assert diag["assumptions"][0]["applicable"] is True
    assert diag["assumptions"][1]["applicable"] is True
    assert diag["assumptions"][2]["applicable"] is True

    json.dumps(result, allow_nan=False)
    assert not _has_non_finite(result)


def _has_non_finite(value):
    if isinstance(value, float):
        return not np.isfinite(value)
    if isinstance(value, dict):
        return any(_has_non_finite(v) for v in value.values())
    if isinstance(value, list):
        return any(_has_non_finite(v) for v in value)
    return False


def test_judged_table_too_small_is_insufficient_n():
    _, tables = make_imputation_bundle(n=30)
    original = [["Y", "X1", "X2", "X3"], ["1", "1", "1", "1"], ["2", "", "", ""]]
    for i in range(3, 30 + 1):
        original.append(["3", "", "", ""])

    result = post_ols(original, imputedDatasets=tables, activeImputationIndex=0).json()["result"]
    assert result["diagnostics"]["ok"] is False
    assert result["diagnostics"]["errorCode"] == "insufficient_n"
    assert "(Intercept)" in result["coefficients"]
    assert result["rubinPooled"] is True


def test_diagnostics_fit_that_raises_is_singular_x(monkeypatch):
    import statsmodels.regression.linear_model as linear_model

    real_ols = linear_model.OLS
    calls = {"fit": 0}

    class RaisesOnSecondFit(real_ols):
        def fit(self, *args, **kwargs):
            calls["fit"] += 1
            if calls["fit"] >= 2:
                raise np.linalg.LinAlgError("synthetic singular design")
            return super().fit(*args, **kwargs)

    monkeypatch.setattr(linear_model, "OLS", RaisesOnSecondFit)
    result = post_ols(make_rows()).json()["result"]

    assert result["diagnostics"]["ok"] is False
    assert result["diagnostics"]["errorCode"] == "singular_x"
    assert "(Intercept)" in result["coefficients"]
    assert result["n"] == 80


def test_one_failed_statistic_marks_only_its_row(monkeypatch):
    import regression_diagnostics

    def boom(*_args, **_kwargs):
        raise RuntimeError("synthetic statistic failure")

    monkeypatch.setattr(regression_diagnostics, "_linearity_row", boom)
    diag = post_ols(make_rows()).json()["result"]["diagnostics"]

    assert diag["ok"] is True
    assert diag["assumptions"][0] == {
        "id": "linearity",
        "applicable": False,
        "notApplicableReason": "notComputable",
    }
    for row in diag["assumptions"][1:]:
        assert row["applicable"] is True
        assert row["verdict"] in {"pass", "caution", "violation"}



