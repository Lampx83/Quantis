import numpy as np
import pytest

import factor_analysis
from test_factor_pca import ANALYZE, assert_reference_solution, client, factor_fixture


def request_paf(rows, count, columns=None):
    return client.post(f"{ANALYZE}/paf", json={
        "rows": rows, "columnNames": rows[0] if columns is None else columns, "nFactors": count,
    })


def test_manual_paf_matches_r_and_preserves_listwise_count_and_item_order():
    rows, expected = factor_fixture("survey", "paf")
    rows.append(["Inf"] * len(rows[0]))
    items = rows[0][::-1]
    response = request_paf(rows, 2, items)
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    assert result["method"] == "paf"
    assert result["nUsed"] == len(rows) - 2
    assert result["columnNames"] == items
    assert result["nFactors"] == 2
    assert result["rotation"] == "varimax"
    assert_reference_solution(result, expected)


def test_one_factor_needs_no_rotation():
    rows, _ = factor_fixture("survey", "paf")
    response = request_paf(rows, 1)
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    assert result["nFactors"] == 1
    assert result["rotation"] == "none"
    assert result["loadings"] == result["unrotatedLoadings"]
    assert result["varianceBefore"] == result["varianceAfter"]


@pytest.mark.parametrize("count", [None, 0, 1.5, 9])
def test_manual_paf_count_must_be_an_integer_smaller_than_item_count(count):
    rows, _ = factor_fixture("survey", "paf")
    response = request_paf(rows, count)
    assert response.status_code == 400
    assert response.json()["detail"] == {"code": "pafInvalidCount", "max": 8}


def test_paf_rejects_insufficient_and_singular_samples():
    rows = [["x", "y", "copy"]] + [[str(i), str(i % 3), str(i)] for i in range(12)]
    too_small = request_paf(rows[:10], 1)
    assert too_small.status_code == 400
    assert too_small.json()["detail"] == {"code": "pafMinimumRows"}
    singular = request_paf(rows, 1)
    assert singular.status_code == 400
    assert singular.json()["detail"] == {"code": "pafSingular"}


def test_paf_rejects_nonpositive_extraction_roots():
    rows, _ = factor_fixture("no_signal", "paf")
    response = request_paf(rows, 1)
    assert response.status_code == 422
    assert response.json()["detail"] == {"code": "pafNonpositiveRoots"}


def test_paf_rejects_a_converged_heywood_solution():
    # The one-factor model implies h²(x) = r(x,y) * r(x,z) / r(y,z) > 1.
    correlation = np.array([[1, .6, .6], [.6, 1, .3], [.6, .3, 1]])
    basis = np.array([[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]])
    sample = np.tile(basis @ np.linalg.cholesky(correlation).T, (4, 1))
    rows = [["x", "y", "z"], *sample.astype(str).tolist()]
    response = request_paf(rows, 1)
    assert response.status_code == 422, response.text
    assert response.json()["detail"] == {"code": "pafHeywood", "columns": ["x"]}


def test_paf_distinguishes_extraction_and_rotation_nonconvergence(monkeypatch):
    rows, _ = factor_fixture("survey", "paf")
    with monkeypatch.context() as patch:
        patch.setattr(factor_analysis, "PAF_MAX_ITERATIONS", 1, raising=False)
        extraction = request_paf(rows, 2)
    assert extraction.status_code == 422
    assert extraction.json()["detail"] == {"code": "pafNonconvergence"}

    monkeypatch.setattr(factor_analysis, "VARIMAX_MAX_SWEEPS", 0, raising=False)
    rotation = request_paf(rows, 2)
    assert rotation.status_code == 422
    assert rotation.json()["detail"] == {"code": "pafRotationFailed"}
