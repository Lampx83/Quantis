import csv
from itertools import permutations
from pathlib import Path

import numpy as np
import pytest
from fastapi.testclient import TestClient

from main import app


FIXTURES = Path(__file__).resolve().parents[2] / "tests" / "fixtures" / "efa"
ANALYZE = "/api/quantis/analyze"
client = TestClient(app)


def factor_fixture(case, method):
    with (FIXTURES / "cases.csv").open(newline="") as handle:
        sample = [row for row in csv.DictReader(handle) if row["case"] == case]
    items = [name for name, value in sample[0].items() if name.startswith("item_") and value]
    rows = [items] + [[row[name] for name in items] for row in sample]
    with (FIXTURES / "expected.csv").open(newline="") as handle:
        expected = {
            (row["statistic"], row["item"], int(row["axis"] or 0)): float(row["value"])
            for row in csv.DictReader(handle) if row["case"] == case and row["method"] == method
        }
    return rows, expected


def assert_reference_solution(result, expected):
    count = result["nFactors"]
    items = result["columnNames"]
    for phase, key in [("before", "unrotatedLoadings"), ("after", "loadings")]:
        target = np.array([[expected[f"loadings_{phase}", item, j + 1] for j in range(count)] for item in items])
        actual = np.array(result[key])
        order = max(permutations(range(count)), key=lambda p: np.abs((actual[:, p] * target).sum(axis=0)).sum())
        aligned = actual[:, order]
        signs = np.where((aligned * target).sum(axis=0) < 0, -1, 1)
        np.testing.assert_allclose(aligned * signs, target, atol=2e-5, rtol=0)

        variance = np.array(result[f"variance{phase.capitalize()}"])[list(order)]
        target_variance = [expected[f"variance_{phase}", "", j + 1] for j in range(count)]
        target_cumulative = [expected[f"cumulative_{phase}", "", j + 1] for j in range(count)]
        np.testing.assert_allclose(variance, target_variance, atol=2e-4, rtol=0)
        np.testing.assert_allclose(np.cumsum(variance), target_cumulative, atol=2e-4, rtol=0)

    np.testing.assert_allclose(result["communalities"], [expected["communalities", item, 0] for item in items], atol=2e-5, rtol=0)
    np.testing.assert_allclose(np.sum(result["varianceBefore"]), np.sum(result["varianceAfter"]), atol=1e-10, rtol=0)


@pytest.mark.parametrize("case", ["survey", "many_items", "no_signal"])
def test_legacy_pca_request_agrees_with_r(case):
    rows, expected = factor_fixture(case, "pca")
    response = client.post(f"{ANALYZE}/efa", json={"rows": rows, "columnNames": rows[0]})
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    assert result["method"] == "pca"
    assert result["nUsed"] == len(rows) - 1
    assert result["columnNames"] == rows[0]
    assert result["nFactors"] == expected["retained", "", 0]
    assert result["suggestedCount"] == expected["suggested", "", 0]
    assert result["rotation"] == ("none" if result["nFactors"] == 1 else "varimax")
    assert result["varianceExplained"] == result["varianceBefore"]
    np.testing.assert_allclose(result["eigenvalues"], [expected["scree", "", j + 1] for j in range(len(rows[0]))], atol=1e-10, rtol=0)
    if case == "no_signal":
        # A tied leading eigenspace has no unique leading eigenvector.
        assert result["varianceBefore"] == pytest.approx([expected["variance_before", "", 1]])
        assert sum(result["communalities"]) == pytest.approx(1)
    else:
        assert_reference_solution(result, expected)


def test_pca_filters_nonfinite_rows_and_preserves_requested_item_order():
    rows, _ = factor_fixture("survey", "pca")
    rows += [["Inf"] * len(rows[0]), ["invalid"] * len(rows[0]), [""] * len(rows[0])]
    columns = rows[0][::-1]
    response = client.post(f"{ANALYZE}/efa", json={"rows": rows, "columnNames": columns, "nFactors": 1})
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    assert result["columnNames"] == columns
    assert result["nUsed"] == len(rows) - 4
    assert result["nFactors"] == 1
    assert result["rotation"] == "none"
    assert result["loadings"] == result["unrotatedLoadings"]


@pytest.mark.parametrize("count", [0, -1, 1.5, True, 3])
def test_pca_rejects_counts_outside_the_numerical_rank(count):
    rows = [["x", "y", "copy"]] + [[str(i), str(i % 3), str(i)] for i in range(12)]
    response = client.post(f"{ANALYZE}/efa", json={"rows": rows, "columnNames": rows[0], "nFactors": count})
    assert response.status_code == 400, response.text
    assert response.json()["detail"] == {"code": "pcaInvalidCount", "max": 2}


def test_pca_keeps_legacy_eigenvalue_length_and_returns_full_scree_for_wide_samples():
    rows, _ = factor_fixture("many_items", "pca")
    response = client.post(f"{ANALYZE}/efa", json={"rows": rows[:11], "columnNames": rows[0], "nFactors": 1})
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    assert len(result["eigenvalues"]) == 9
    assert len(result["screeEigenvalues"]) == 18
    assert result["eigenvalues"] == result["screeEigenvalues"][:9]


def test_pca_reports_bad_input_and_numerical_failure_separately(monkeypatch):
    rows = [["x", "constant"]] + [[str(i), "1"] for i in range(12)]
    bad = client.post(f"{ANALYZE}/efa", json={"rows": rows, "columnNames": rows[0]})
    assert bad.status_code == 400
    assert bad.json()["detail"] == {"code": "constantColumns", "columns": ["constant"]}

    def fail_eigen(*args):
        raise np.linalg.LinAlgError("forced failure")

    monkeypatch.setattr(np.linalg, "eigh", fail_eigen)
    rows, _ = factor_fixture("survey", "pca")
    failure = client.post(f"{ANALYZE}/efa", json={"rows": rows, "columnNames": rows[0]})
    assert failure.status_code == 422
    assert failure.json()["detail"] == {"code": "pcaEigenFailed"}
