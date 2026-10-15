"""
Test suite for MICE Imputation endpoint and analysis_impl.py
"""
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


if __name__ == "__main__":
    test_run_mice_imputation_basic()
    print("test_run_mice_imputation_basic passed!")
    test_run_mice_imputation_with_discrete_missing_codes()
    print("test_run_mice_imputation_with_discrete_missing_codes passed!")
    test_mice_impute_api_endpoint()
    print("test_mice_impute_api_endpoint passed!")
    print("All MICE tests passed!")
