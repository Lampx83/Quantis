"""
Test suite for MICE Imputation endpoint and analysis_impl.py
"""
import numpy as np
import pandas as pd
from fastapi.testclient import TestClient
from main import app
from analysis_impl import run_mice_imputation

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


if __name__ == "__main__":
    test_run_mice_imputation_basic()
    print("test_run_mice_imputation_basic passed!")
    test_run_mice_imputation_with_discrete_missing_codes()
    print("test_run_mice_imputation_with_discrete_missing_codes passed!")
    test_mice_impute_api_endpoint()
    print("test_mice_impute_api_endpoint passed!")
    print("All MICE tests passed!")
