import csv

import numpy as np
import pytest

import factor_analysis as factor
from test_factor_paf import request_paf
from test_factor_pca import ANALYZE, FIXTURES, client, factor_fixture


@pytest.mark.parametrize("case", ["survey", "no_signal"])
def test_reduced_scree_and_quantiles_match_r_with_shared_permutations(case, monkeypatch):
    rows, expected = factor_fixture(case, "parallel")
    items = rows[0]
    with (FIXTURES / "permutations.csv").open(newline="") as handle:
        indices = np.array([
            [int(row[item]) - 1 for item in items]
            for row in csv.DictReader(handle) if row["case"] == case
        ]).reshape(32, len(rows) - 1, len(items))
    monkeypatch.setattr(factor, "permutation_indices", lambda *_: iter(indices), raising=False)
    response = request_paf(rows, None)
    assert response.status_code == 200, response.text
    result = response.json()["result"]
    for field, statistic in [("screeEigenvalues", "scree"), ("parallelCutoff", "cutoff_95")]:
        np.testing.assert_allclose(result[field], [expected[statistic, "", j + 1] for j in range(len(items))], atol=1e-10, rtol=0)
    assert result["suggestedCount"] == expected["suggested", "", 0]
    if case == "survey":
        assert result["nFactors"] == 2
        assert result["issue"] is None
    else:
        # Some later roots exceed their cutoffs, but the first does not.
        assert result["screeEigenvalues"][-1] > result["parallelCutoff"][-1]
        assert result["nFactors"] is None
        assert result["issue"] == {"code": "pafNoSuggestion"}
        assert "loadings" not in result


def test_seeded_auto_and_manual_runs_share_the_same_recommendation():
    rows, _ = factor_fixture("survey", "parallel")
    auto = client.post(f"{ANALYZE}/paf", json={"rows": rows, "columnNames": rows[0]})
    manual = request_paf(rows, 1)
    assert auto.status_code == manual.status_code == 200
    automatic = auto.json()["result"]
    override = manual.json()["result"]
    assert automatic["suggestedCount"] == override["suggestedCount"] == 2
    assert automatic["parallelCutoff"] == override["parallelCutoff"]
    assert automatic["nFactors"] == 2
    assert override["nFactors"] == 1


def test_permutations_are_reproducible_and_independent_by_column():
    first = next(factor.permutation_indices(64, 6))
    np.testing.assert_array_equal(first, next(factor.permutation_indices(64, 6)))
    np.testing.assert_array_equal(np.sort(first, axis=0), np.broadcast_to(np.arange(64)[:, None], (64, 6)))
    assert len({tuple(column) for column in first.T}) == 6


def test_unextractable_suggestion_keeps_scree_and_waits_for_manual_count(monkeypatch):
    rows, _ = factor_fixture("survey", "parallel")
    monkeypatch.setattr(factor, "permutation_cutoff", lambda normalized: np.full(normalized.shape[1], -2), raising=False)
    automatic = request_paf(rows, None).json()["result"]
    assert automatic["suggestedCount"] == 9
    assert automatic["issue"] == {"code": "pafSuggestionOutOfRange", "max": 4}
    assert automatic["nFactors"] is None
    assert len(automatic["screeEigenvalues"]) == len(automatic["parallelCutoff"]) == 9
    manual = request_paf(rows, 2).json()["result"]
    assert manual["suggestedCount"] == 9
    assert manual["nFactors"] == 2


def test_parallel_size_limit_preserves_manual_extraction(monkeypatch):
    rows, _ = factor_fixture("survey", "parallel")
    monkeypatch.setattr(factor, "PARALLEL_MAX_ROWS", 159, raising=False)
    automatic = request_paf(rows, None).json()["result"]
    assert automatic["suggestedCount"] is None
    assert automatic["parallelCutoff"] is None
    assert len(automatic["screeEigenvalues"]) == 9
    assert automatic["parallelIssue"]["code"] == "pafParallelLimit"
    assert automatic["nFactors"] is None
    manual = request_paf(rows, 2).json()["result"]
    assert manual["nFactors"] == 2
    assert manual["parallelIssue"] == automatic["parallelIssue"]


def test_unusable_permutations_preserve_manual_extraction(monkeypatch):
    rows, _ = factor_fixture("survey", "parallel")
    original = factor.smc_reduced_correlation

    def reject_singular_null(correlation):
        if correlation[0, 1] < 0.4:  # The survey pair is correlated before permutation.
            raise factor.FactorAnalysisError("pafSingular")
        return original(correlation)

    monkeypatch.setattr(factor, "smc_reduced_correlation", reject_singular_null)
    manual = request_paf(rows, 2).json()["result"]
    assert manual["parallelIssue"] == {"code": "pafParallelFailed"}
    assert manual["suggestedCount"] is None
    assert manual["nFactors"] == 2
