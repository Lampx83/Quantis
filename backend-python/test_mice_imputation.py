"""
Test suite for MICE Imputation endpoint and analysis_impl.py
"""
import numpy as np
import pandas as pd
import pytest
from fastapi.testclient import TestClient
from main import app
from analysis_impl import run_mice_imputation, run_ols

client = TestClient(app)


def test_run_mice_imputation_basic():
    # Dataset with 5 rows and missing values
    rows = [
        ["AGE", "INCOME", "EXPERIENCE"],
        ["25", "1000", "2"],
        ["30", "", "5"],       # missing INCOME
        ["40", "2000", ""],    # missing EXPERIENCE
        ["35", "1800", "7"],
        ["28", "1200", "3"],
    ]
    variables = {
        "AGE": {"measure": "scale", "type": "numeric", "decimals": 0},
        "INCOME": {"measure": "scale", "type": "numeric", "decimals": 2},
        "EXPERIENCE": {"measure": "scale", "type": "numeric", "decimals": 1},
    }

    result = run_mice_imputation(rows, columns=["AGE", "INCOME", "EXPERIENCE"], variables=variables, max_iter=10)
    assert result is not None
    assert "rows" in result
    assert "statistics" in result
    assert "iterations" in result

    imputed_rows = result["rows"]
    assert len(imputed_rows) == 6 # header + 5 rows
    # Check that row 2 INCOME (col 1) is no longer empty
    assert imputed_rows[2][1] != ""
    income_val = float(imputed_rows[2][1])
    assert 1000 <= income_val <= 2000

    # Check that row 3 EXPERIENCE (col 2) is no longer empty
    assert imputed_rows[3][2] != ""
    exp_val = float(imputed_rows[3][2])
    assert 1 <= exp_val <= 10


def test_run_mice_imputation_with_discrete_missing_codes():
    rows = [
        ["ID", "SCORE1", "SCORE2"],
        ["1", "10", "20"],
        ["2", "99", "22"],     # SCORE1 has discrete missing code 99
        ["3", "12", "999"],    # SCORE2 has discrete missing code 999
        ["4", "15", "30"],
        ["5", "14", "28"],
        ["6", "11", "21"],
    ]
    variables = {
        "SCORE1": {"missingValues": ["99"], "type": "numeric", "measure": "scale", "decimals": 1},
        "SCORE2": {"missingValues": ["999"], "type": "numeric", "measure": "scale", "decimals": 1},
    }

    result = run_mice_imputation(rows, columns=["SCORE1", "SCORE2"], variables=variables, max_iter=5)
    imputed_rows = result["rows"]
    # Row 2 SCORE1 should NOT be 99 anymore
    score1_r2 = float(imputed_rows[2][1])
    assert score1_r2 != 99.0
    assert 9 <= score1_r2 <= 16

    # Row 3 SCORE2 should NOT be 999 anymore
    score2_r3 = float(imputed_rows[3][2])
    assert score2_r3 != 999.0
    assert 18 <= score2_r3 <= 32


def test_mice_impute_api_endpoint():
    payload = {
        "rows": [
            ["X", "Y"],
            ["1", "2"],
            ["2", "4"],
            ["3", ""],
            ["4", "8"],
            ["5", "10"],
        ],
        "columns": ["X", "Y"],
        "maxIter": 10,
    }
    response = client.post("/api/quantis/analyze/impute-mice", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "rows" in data
    assert len(data["rows"]) == 6
    # Row 3 Y value filled
    assert data["rows"][3][1] != ""
    y_filled = float(data["rows"][3][1])
    # Since Y = 2*X, for X=3, Y should be close to 6
    assert abs(y_filled - 6.0) < 1.0


def test_missing_code_mask_discrete_range_and_strings():
    from analysis_impl import missing_code_mask
    s = pd.Series(["1", "99", "99.0", "98", "100", "", None, "abc", " 98.5 "])
    m = missing_code_mask(s, {"type": "numeric", "missingValues": ["99"], "missingRange": {"min": 98, "max": 98.9}})
    assert m.tolist() == [False, True, True, True, False, False, False, False, True]
    # Biến chuỗi: không áp dụng khoảng số, chỉ mã rời rạc
    m2 = missing_code_mask(pd.Series(["NA", "x", "98"]), {"type": "string", "missingValues": ["NA"], "missingRange": {"min": 90, "max": 99}})
    assert m2.tolist() == [True, False, False]
    # Không khai báo gì -> không ô nào bị coi là mã khuyết
    assert not missing_code_mask(s, {"type": "numeric"}).any()
    assert not missing_code_mask(s, None).any()


def test_mice_range_missing_codes_are_imputed():
    rows = [["A", "B"]] + [[str(i), str(2 * i)] for i in range(1, 11)]
    rows[3][1] = "98"   # nằm trong khoảng khuyết 98–99
    rows[6][1] = "99"
    variables = {"B": {"type": "numeric", "measure": "scale", "decimals": 0, "missingRange": {"min": 98, "max": 99}}}
    result = run_mice_imputation(rows, columns=["A", "B"], variables=variables, max_iter=10)
    out = result["rows"]
    assert float(out[3][1]) < 90 and float(out[6][1]) < 90
    stat_b = next(x for x in result["statistics"] if x["column"] == "B")
    assert stat_b["missingCount"] == 2


def test_mice_blank_cells_in_unselected_columns_do_not_break_json():
    """Ô trống ở cột KHÔNG được chọn (ghi chú…) từng làm NaN lọt vào JSON -> 500."""
    rows = [
        ["age", "income", "note"],
        ["25", "1000", ""],
        ["30", "", "ok"],
        ["40", "2000", ""],
        ["35", "1800", "x"],
        ["28", "1200", ""],
    ]
    payload = {"rows": rows, "columns": ["age", "income"], "maxIter": 10}
    response = client.post("/api/quantis/analyze/impute-mice", json=payload)
    assert response.status_code == 200, response.text
    out = response.json()["rows"]
    assert out[2][1] != ""            # income đã được điền
    assert [r[2] for r in out[1:]] == ["", "ok", "", "x", ""]   # note giữ nguyên, trống vẫn là chuỗi rỗng


def test_mice_20000_rows_each_single_column_selection():
    """Tái hiện ca trong review: CSV 20.000 dòng, chọn riêng từng cột age / income / q1."""
    rng = np.random.default_rng(0)
    n = 20000
    age = rng.integers(18, 70, n).astype(float)
    income = age * 100 + rng.normal(0, 300, n)
    q1 = rng.integers(1, 6, n).astype(float)
    notes = np.where(rng.random(n) < 0.7, "", "ghi chú")
    age_s = [str(int(a)) for a in age]
    inc_s = [f"{v:.1f}" for v in income]
    q1_s = [str(int(q)) for q in q1]
    for i in range(0, n, 10):
        inc_s[i] = ""
    for i in range(1, n, 17):
        q1_s[i] = ""
    for i in range(2, n, 23):
        age_s[i] = ""
    rows = [["age", "income", "q1", "note"]] + [[age_s[i], inc_s[i], q1_s[i], notes[i]] for i in range(n)]
    for col in ("age", "income", "q1"):
        response = client.post(
            "/api/quantis/analyze/impute-mice",
            json={"rows": rows, "columns": [col], "maxIter": 10},
        )
        assert response.status_code == 200, (col, response.text[:200])
        out = response.json()["rows"]
        assert len(out) == n + 1
        ci = ["age", "income", "q1", "note"].index(col)
        assert all(r[ci] != "" for r in out[1:])
        assert [r[3] for r in out[1:]] == [r[3] for r in rows[1:]]  # cột note không bị đụng


def test_mice_imputed_values_stay_within_observed_range():
    """Thang Likert 1–5: giá trị điền không được ra ngoài [1, 5]."""
    rng = np.random.default_rng(1)
    n = 300
    base = rng.integers(1, 6, n)
    q1 = [str(int(v)) for v in base]
    q2 = [str(int(min(5, max(1, v + rng.integers(-1, 2))))) for v in base]
    for i in range(0, n, 7):
        q2[i] = ""
    rows = [["q1", "q2"]] + [[q1[i], q2[i]] for i in range(n)]
    result = run_mice_imputation(rows, columns=["q1", "q2"], variables={"q2": {"decimals": 2}}, max_iter=10)
    vals = [float(r[1]) for r in result["rows"][1:]]
    assert min(vals) >= 1.0 and max(vals) <= 5.0


def test_mice_max_iter_is_clamped():
    rows = [["x", "y"]] + [[str(i), str(2 * i) if i != 3 else ""] for i in range(1, 12)]
    response = client.post(
        "/api/quantis/analyze/impute-mice",
        json={"rows": rows, "columns": ["x", "y"], "maxIter": 100000},
    )
    assert response.status_code == 200
    assert 1 <= response.json()["iterations"] <= 50
    result = run_mice_imputation(rows, columns=["x", "y"], max_iter=0)
    assert result["iterations"] >= 1


def test_run_mice_imputation_m_datasets_distinct():
    # Multi-variable dataset with missing values in column Y
    rows = [
        ["X", "Y"],
        ["1.0", "2.0"],
        ["2.0", "4.1"],
        ["3.0", "5.9"],
        ["4.0", "8.2"],
        ["5.0", "10.1"],
        ["6.0", ""],
        ["7.0", ""],
        ["8.0", "16.0"],
        ["9.0", "18.0"],
        ["10.0", "20.0"],
    ]
    variables = {
        "X": {"measure": "scale", "type": "numeric", "decimals": 1},
        "Y": {"measure": "scale", "type": "numeric", "decimals": 2},
    }
    result = run_mice_imputation(rows, columns=["X", "Y"], variables=variables, max_iter=10, m=3, random_state=42)
    assert result is not None
    assert "imputedDatasets" in result
    assert len(result["imputedDatasets"]) == 3
    assert result["m"] == 3
    assert "rubinStatistics" in result

    # Backward compatibility
    assert "rows" in result
    assert result["rows"] == result["imputedDatasets"][0]
    assert "statistics" in result

    # Check that datasets are distinct in the imputed cells (betweenVariance > 0)
    d0 = result["imputedDatasets"][0]
    d1 = result["imputedDatasets"][1]
    d2 = result["imputedDatasets"][2]
    # Check that row 6 or row 7 Y value differs between datasets
    y_vals_r6 = {d0[6][1], d1[6][1], d2[6][1]}
    y_vals_r7 = {d0[7][1], d1[7][1], d2[7][1]}
    assert len(y_vals_r6) > 1 or len(y_vals_r7) > 1

    # Check Rubin statistics for Y
    stat_y = next(s for s in result["rubinStatistics"] if s["column"] == "Y")
    assert stat_y["missingCount"] == 2
    assert stat_y["betweenVariance"] > 0
    assert stat_y["totalVariance"] > stat_y["withinVariance"]
    assert stat_y["rubinSe"] > 0
    assert stat_y["df"] > 0
    assert 0 <= stat_y["fmi"] <= 1
    assert stat_y["ciLower"] < stat_y["pooledMean"] < stat_y["ciUpper"]


def test_rubin_descriptive_statistics_formulas():
    from analysis_impl import _compute_rubin_descriptive
    import scipy.stats as stats
    import math

    # Reference data: m = 3 datasets, n = 5 rows
    d1 = pd.DataFrame({"Y": [1.0, 2.0, 3.0, 4.0, 5.0]})
    d2 = pd.DataFrame({"Y": [1.2, 2.1, 2.9, 4.2, 5.1]})
    d3 = pd.DataFrame({"Y": [0.9, 1.9, 3.1, 3.9, 4.9]})
    orig = pd.DataFrame({"Y": [1.0, np.nan, 3.0, np.nan, 5.0]})

    m = 3
    n = 5
    y_bars = [float(d1["Y"].mean()), float(d2["Y"].mean()), float(d3["Y"].mean())]
    s_sqs = [float(d1["Y"].var(ddof=1)), float(d2["Y"].var(ddof=1)), float(d3["Y"].var(ddof=1))]
    q_bar = float(np.mean(y_bars))
    u_bar = float(np.mean([s / n for s in s_sqs]))
    b = float(sum((y - q_bar) ** 2 for y in y_bars) / (m - 1))
    t = float(u_bar + (1.0 + 1.0 / m) * b)
    rubin_se = float(math.sqrt(t))

    nu_m = (m - 1.0) * (1.0 + u_bar / ((1.0 + 1.0 / m) * b)) ** 2
    nu_0 = n - 1.0
    gamma = (1.0 + 1.0 / m) * b / t
    nu_obs = ((nu_0 + 1.0) / (nu_0 + 3.0)) * nu_0 * (1.0 - gamma)
    nu_adj = float((nu_m * nu_obs) / (nu_m + nu_obs))

    r = (1.0 + 1.0 / m) * b / u_bar
    fmi = float((r + 2.0 / (nu_adj + 3.0)) / (r + 1.0))

    t_crit = float(stats.t.ppf(0.975, df=nu_adj))
    ci_lower = float(q_bar - t_crit * rubin_se)
    ci_upper = float(q_bar + t_crit * rubin_se)

    stats_list = _compute_rubin_descriptive([d1, d2, d3], orig)
    assert len(stats_list) == 1
    res = stats_list[0]

    assert res["column"] == "Y"
    assert res["missingCount"] == 2
    assert res["originalMean"] == pytest.approx(3.0)
    assert res["originalStd"] == pytest.approx(2.0)
    assert res["pooledMean"] == pytest.approx(q_bar, rel=1e-5)
    assert res["withinVariance"] == pytest.approx(u_bar, rel=1e-5)
    assert res["betweenVariance"] == pytest.approx(b, rel=1e-5)
    assert res["totalVariance"] == pytest.approx(t, rel=1e-5)
    assert res["rubinSe"] == pytest.approx(rubin_se, rel=1e-5)
    assert res["df"] == pytest.approx(nu_adj, rel=1e-5)
    assert res["fmi"] == pytest.approx(fmi, rel=1e-5)
    assert res["ciLower"] == pytest.approx(ci_lower, rel=1e-5)
    assert res["ciUpper"] == pytest.approx(ci_upper, rel=1e-5)


def test_mice_api_endpoint_with_m():
    payload = {
        "rows": [
            ["X", "Y"],
            ["1", "2"],
            ["2", "4"],
            ["3", ""],
            ["4", "8"],
            ["5", "10"],
            ["6", ""],
        ],
        "columns": ["X", "Y"],
        "m": 3,
        "maxIter": 10,
    }
    response = client.post("/api/quantis/analyze/impute-mice", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert "imputedDatasets" in data
    assert len(data["imputedDatasets"]) == 3
    assert data["m"] == 3
    assert "rubinStatistics" in data
    assert len(data["rubinStatistics"]) == 2

    # Backward compatibility
    assert "rows" in data
    assert data["rows"] == data["imputedDatasets"][0]
    assert "statistics" in data
    assert len(data["statistics"]) == 2


def test_mice_m_is_clamped():
    rows = [["x", "y"]] + [[str(i), str(2 * i) if i != 3 else ""] for i in range(1, 10)]
    # m = 0 should clamp to 2
    res_min = run_mice_imputation(rows, columns=["x", "y"], m=0)
    assert res_min["m"] == 2
    assert len(res_min["imputedDatasets"]) == 2

    # m = 100 should clamp to 20
    res_max = run_mice_imputation(rows, columns=["x", "y"], m=100)
    assert res_max["m"] == 20
    assert len(res_max["imputedDatasets"]) == 20

    # m omitted should default to 5
    res_default = run_mice_imputation(rows, columns=["x", "y"])
    assert res_default["m"] == 5
    assert len(res_default["imputedDatasets"]) == 5


def test_run_ols_rubin_pooling():
    import math
    import scipy.stats as stats

    rng = np.random.default_rng(42)
    m = 5
    n = 20
    header = ["y", "x1", "x2"]

    datasets = []
    for l in range(m):
        x1 = rng.normal(10, 2, n)
        x2 = rng.normal(5, 1, n)
        # Varying noise across imputations to simulate imputed data variance
        y = 3.0 + 2.0 * x1 - 1.5 * x2 + rng.normal(0, 1 + 0.3 * l, n)
        data_rows = [[f"{y[i]:.4f}", f"{x1[i]:.4f}", f"{x2[i]:.4f}"] for i in range(n)]
        datasets.append([header] + data_rows)

    result = run_ols(rows=[], y_col="y", x_cols=["x1", "x2"], imputed_datasets=datasets)
    assert result is not None
    assert result["rubinPooled"] is True
    assert result["yName"] == "y"
    assert result["xNames"] == ["x1", "x2"]
    assert result["n"] == n
    assert result["df"] == float(n - 3)
    assert "rubinDf" in result
    assert "withinVar" in result
    assert "betweenVar" in result
    assert "fmi" in result

    for var in ["(Intercept)", "x1", "x2"]:
        assert var in result["coefficients"]
        assert var in result["se"]
        assert var in result["tStat"]
        assert var in result["pValue"]
        assert var in result["ciLower"]
        assert var in result["ciUpper"]
        assert var in result["rubinDf"]
        assert var in result["withinVar"]
        assert var in result["betweenVar"]
        assert var in result["fmi"]

        # Between variance should be positive due to variation across datasets
        assert result["betweenVar"][var] > 0
        assert result["withinVar"][var] > 0
        # SE must be strictly greater than sqrt(withinVar) due to (1 + 1/m) * betweenVar > 0
        assert result["se"][var] > math.sqrt(result["withinVar"][var])

        # Degrees of freedom must be float > 0
        nu_adj = result["rubinDf"][var]
        assert isinstance(nu_adj, float)
        assert nu_adj > 0

        # t-statistic = beta_bar / SE
        expected_t = result["coefficients"][var] / result["se"][var]
        assert result["tStat"][var] == pytest.approx(expected_t, rel=1e-5)

        # p-value = 2 * sf(|t|, df=nu_adj)
        expected_p = 2.0 * float(stats.t.sf(abs(expected_t), df=nu_adj))
        assert result["pValue"][var] == pytest.approx(expected_p, rel=1e-5)

        # 95% Confidence interval
        t_crit = float(stats.t.ppf(0.975, df=nu_adj))
        expected_ci_lower = result["coefficients"][var] - t_crit * result["se"][var]
        expected_ci_upper = result["coefficients"][var] + t_crit * result["se"][var]
        assert result["ciLower"][var] == pytest.approx(expected_ci_lower, rel=1e-5)
        assert result["ciUpper"][var] == pytest.approx(expected_ci_upper, rel=1e-5)

        # FMI within [0, 1]
        assert 0.0 <= result["fmi"][var] <= 1.0


def test_run_ols_rubin_exact_math():
    import math
    import scipy.stats as stats
    from statsmodels.regression.linear_model import OLS
    from statsmodels.tools import add_constant

    m = 3
    n = 10
    header = ["y", "x"]

    # 3 datasets with distinct values
    d1_data = [[1.0, 2.0], [2.1, 3.8], [3.0, 6.2], [4.2, 8.1], [5.0, 9.9],
               [5.9, 12.1], [7.1, 14.0], [8.0, 16.2], [9.1, 18.1], [10.2, 19.8]]
    d2_data = [[1.2, 2.0], [2.0, 3.8], [3.2, 6.2], [4.0, 8.1], [5.2, 9.9],
               [6.1, 12.1], [6.9, 14.0], [8.2, 16.2], [8.9, 18.1], [10.0, 19.8]]
    d3_data = [[0.9, 2.0], [2.2, 3.8], [2.9, 6.2], [4.3, 8.1], [4.9, 9.9],
               [5.8, 12.1], [7.2, 14.0], [7.9, 16.2], [9.2, 18.1], [10.4, 19.8]]

    datasets = [
        [header] + [[str(v[0]), str(v[1])] for v in d1_data],
        [header] + [[str(v[0]), str(v[1])] for v in d2_data],
        [header] + [[str(v[0]), str(v[1])] for v in d3_data],
    ]

    # Manual calculation with statsmodels on each
    models = []
    for raw in [d1_data, d2_data, d3_data]:
        df_raw = pd.DataFrame(raw, columns=["y", "x"])
        X = add_constant(df_raw[["x"]])
        y = df_raw["y"]
        models.append(OLS(y, X).fit())

    result = run_ols(rows=[], y_col="y", x_cols=["x"], imputed_datasets=datasets)
    assert result is not None
    assert result["rubinPooled"] is True

    # Check pooled R2 and adjR2
    expected_r2 = float(np.mean([m.rsquared for m in models]))
    expected_adj_r2 = float(np.mean([m.rsquared_adj for m in models]))
    expected_s2 = float(np.mean([m.mse_resid for m in models]))
    assert result["r2"] == pytest.approx(expected_r2, rel=1e-5)
    assert result["adjR2"] == pytest.approx(expected_adj_r2, rel=1e-5)
    assert result["s2"] == pytest.approx(expected_s2, rel=1e-5)

    k = 2  # const and x
    nu_0 = n - k  # 8

    for var_sm, var_key in [("const", "(Intercept)"), ("x", "x")]:
        betas = [float(mod.params[var_sm]) for mod in models]
        ses = [float(mod.bse[var_sm]) for mod in models]

        beta_bar = sum(betas) / m
        u_bar = sum(s ** 2 for s in ses) / m
        b = sum((b_val - beta_bar) ** 2 for b_val in betas) / (m - 1)
        t = u_bar + (1.0 + 1.0 / m) * b
        se = math.sqrt(t)

        nu_m = (m - 1.0) * (1.0 + u_bar / ((1.0 + 1.0 / m) * b)) ** 2
        gamma = (1.0 + 1.0 / m) * b / t
        nu_obs = ((nu_0 + 1.0) / (nu_0 + 3.0)) * nu_0 * (1.0 - gamma)
        nu_adj = (nu_m * nu_obs) / (nu_m + nu_obs)

        t_stat = beta_bar / se
        p_val = 2.0 * float(stats.t.sf(abs(t_stat), df=nu_adj))
        ci_lower = beta_bar - float(stats.t.ppf(0.975, df=nu_adj)) * se
        ci_upper = beta_bar + float(stats.t.ppf(0.975, df=nu_adj)) * se
        r = (1.0 + 1.0 / m) * b / u_bar
        fmi = (r + 2.0 / (nu_adj + 3.0)) / (r + 1.0)

        assert result["coefficients"][var_key] == pytest.approx(beta_bar, rel=1e-5)
        assert result["withinVar"][var_key] == pytest.approx(u_bar, rel=1e-5)
        assert result["betweenVar"][var_key] == pytest.approx(b, rel=1e-5)
        assert result["se"][var_key] == pytest.approx(se, rel=1e-5)
        assert result["rubinDf"][var_key] == pytest.approx(nu_adj, rel=1e-5)
        assert result["tStat"][var_key] == pytest.approx(t_stat, rel=1e-5)
        assert result["pValue"][var_key] == pytest.approx(p_val, rel=1e-5)
        assert result["ciLower"][var_key] == pytest.approx(ci_lower, rel=1e-5)
        assert result["ciUpper"][var_key] == pytest.approx(ci_upper, rel=1e-5)
        assert result["fmi"][var_key] == pytest.approx(fmi, rel=1e-5)


def test_ols_api_with_imputed_datasets():
    header = ["y", "x1", "x2"]
    d1 = [header] + [[str(i * 2.0 + (i % 2) * 0.5), str(i), str((i % 4) * 1.5 + 1.0)] for i in range(1, 15)]
    d2 = [header] + [[str(i * 2.1 - (i % 2) * 0.3), str(i), str((i % 4) * 1.5 + 1.0)] for i in range(1, 15)]
    datasets = [d1, d2]

    # Test with snake_case imputed_datasets
    payload = {
        "rows": [],
        "yCol": "y",
        "xCols": ["x1", "x2"],
        "imputed_datasets": datasets,
    }
    response = client.post("/api/quantis/analyze/ols", json=payload)
    assert response.status_code == 200, response.text
    data = response.json()
    assert "result" in data
    res = data["result"]
    assert res["rubinPooled"] is True
    assert "rubinDf" in res
    assert "withinVar" in res
    assert "betweenVar" in res
    assert "fmi" in res

    # Test with camelCase imputedDatasets
    payload_camel = {
        "rows": [],
        "yCol": "y",
        "xCols": ["x1", "x2"],
        "imputedDatasets": datasets,
    }
    response_camel = client.post("/api/quantis/analyze/ols", json=payload_camel)
    assert response_camel.status_code == 200, response_camel.text
    res_camel = response_camel.json()["result"]
    assert res_camel["rubinPooled"] is True


def test_run_ols_backward_compatibility():
    header = ["y", "x1"]
    rows = [header] + [[str(i * 2), str(i)] for i in range(1, 15)]

    # Direct function call without imputed_datasets
    res = run_ols(rows, "y", ["x1"])
    assert res is not None
    assert res.get("rubinPooled", False) is False
    assert "coefficients" in res
    assert "se" in res
    assert "tStat" in res
    assert "pValue" in res
    assert "r2" in res

    # API call without imputed_datasets
    payload = {
        "rows": rows,
        "yCol": "y",
        "xCols": ["x1"],
    }
    response = client.post("/api/quantis/analyze/ols", json=payload)
    assert response.status_code == 200, response.text
    api_res = response.json()["result"]
    assert api_res.get("rubinPooled", False) is False





def test_run_ols_rubin_constant_predictor_returns_none():
    """Finding 1: Zero-variance predictor causes add_constant to drop 'const', returning None gracefully."""
    header = ["y", "x1", "x_const"]
    # x_const has zero variance (all 5.0)
    datasets = []
    for _ in range(3):
        rows = [header] + [
            [str(float(i * 2 + 1)), str(float(i)), "5.0"]
            for i in range(1, 15)
        ]
        datasets.append(rows)

    # Imputed datasets mode
    result_imputed = run_ols(rows=[], y_col="y", x_cols=["x1", "x_const"], imputed_datasets=datasets)
    assert result_imputed is None, "Expected None when a predictor has zero variance in imputed datasets"

    # Single dataset fallback mode
    result_single = run_ols(rows=datasets[0], y_col="y", x_cols=["x1", "x_const"])
    assert result_single is None, "Expected None when a predictor has zero variance in single dataset"


def test_run_ols_rubin_mismatched_dataset_lengths_returns_none():
    """Finding 2: Enforce identical observation counts across all m imputations."""
    header = ["y", "x1"]
    ds1 = [header] + [[str(float(i * 2)), str(float(i))] for i in range(1, 15)] # 14 rows
    ds2 = [header] + [[str(float(i * 2)), str(float(i))] for i in range(1, 12)] # 11 rows

    result = run_ols(rows=[], y_col="y", x_cols=["x1"], imputed_datasets=[ds1, ds2])
    assert result is None, "Expected None when imputed datasets have mismatched lengths"


if __name__ == "__main__":
    test_run_mice_imputation_basic()
    print("test_run_mice_imputation_basic passed!")
    test_run_mice_imputation_with_discrete_missing_codes()
    print("test_run_mice_imputation_with_discrete_missing_codes passed!")
    test_mice_impute_api_endpoint()
    print("test_mice_impute_api_endpoint passed!")
    test_run_mice_imputation_m_datasets_distinct()
    print("test_run_mice_imputation_m_datasets_distinct passed!")
    test_rubin_descriptive_statistics_formulas()
    print("test_rubin_descriptive_statistics_formulas passed!")
    test_mice_api_endpoint_with_m()
    print("test_mice_api_endpoint_with_m passed!")
    print("All MICE tests passed!")
