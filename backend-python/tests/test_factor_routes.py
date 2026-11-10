import os
import sys

import pytest
from fastapi import HTTPException

sys.path.insert(0, os.path.join(os.path.dirname(__file__), ".."))

from factor_analysis import FactorAnalysisError
import routes_analyze
from routes_analyze import FactorBody, analyze_efa, analyze_paf


def test_efa_route_handles_generic_exception(monkeypatch):
    def mock_run_efa(*args, **kwargs):
        raise RuntimeError("numpy LinAlgError")

    monkeypatch.setattr(routes_analyze, "run_efa", mock_run_efa)
    body = FactorBody(rows=[["a", "b"], ["1", "2"]], columnNames=["a", "b"], nFactors=1)
    with pytest.raises(HTTPException) as exc_info:
        analyze_efa(body)
    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "numpy LinAlgError"


def test_efa_route_handles_value_error(monkeypatch):
    def mock_run_efa(*args, **kwargs):
        raise ValueError("bad row shape")

    monkeypatch.setattr(routes_analyze, "run_efa", mock_run_efa)
    body = FactorBody(rows=[["a", "b"], ["1", "2"]], columnNames=["a", "b"], nFactors=1)
    with pytest.raises(HTTPException) as exc_info:
        analyze_efa(body)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "bad row shape"


def test_efa_route_preserves_factor_analysis_error(monkeypatch):
    def mock_run_efa(*args, **kwargs):
        raise FactorAnalysisError("efaFailed", status=422, custom="detail")

    monkeypatch.setattr(routes_analyze, "run_efa", mock_run_efa)
    body = FactorBody(rows=[["a", "b"], ["1", "2"]], columnNames=["a", "b"], nFactors=1)
    with pytest.raises(HTTPException) as exc_info:
        analyze_efa(body)
    assert exc_info.value.status_code == 422
    assert exc_info.value.detail == {"code": "efaFailed", "custom": "detail"}


def test_efa_route_preserves_http_exception(monkeypatch):
    def mock_run_efa(*args, **kwargs):
        raise HTTPException(status_code=403, detail="Forbidden")

    monkeypatch.setattr(routes_analyze, "run_efa", mock_run_efa)
    body = FactorBody(rows=[["a", "b"], ["1", "2"]], columnNames=["a", "b"], nFactors=1)
    with pytest.raises(HTTPException) as exc_info:
        analyze_efa(body)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Forbidden"


def test_paf_route_handles_generic_exception(monkeypatch):
    def mock_run_paf(*args, **kwargs):
        raise RuntimeError("numpy LinAlgError")

    monkeypatch.setattr(routes_analyze, "run_paf", mock_run_paf)
    body = FactorBody(rows=[["a", "b"], ["1", "2"]], columnNames=["a", "b"], nFactors=1)
    with pytest.raises(HTTPException) as exc_info:
        analyze_paf(body)
    assert exc_info.value.status_code == 500
    assert exc_info.value.detail == "numpy LinAlgError"


def test_paf_route_handles_value_error(monkeypatch):
    def mock_run_paf(*args, **kwargs):
        raise ValueError("invalid parameter")

    monkeypatch.setattr(routes_analyze, "run_paf", mock_run_paf)
    body = FactorBody(rows=[["a", "b"], ["1", "2"]], columnNames=["a", "b"], nFactors=1)
    with pytest.raises(HTTPException) as exc_info:
        analyze_paf(body)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == "invalid parameter"


def test_paf_route_preserves_factor_analysis_error(monkeypatch):
    def mock_run_paf(*args, **kwargs):
        raise FactorAnalysisError("pafSingular", status=400)

    monkeypatch.setattr(routes_analyze, "run_paf", mock_run_paf)
    body = FactorBody(rows=[["a", "b"], ["1", "2"]], columnNames=["a", "b"], nFactors=1)
    with pytest.raises(HTTPException) as exc_info:
        analyze_paf(body)
    assert exc_info.value.status_code == 400
    assert exc_info.value.detail == {"code": "pafSingular"}


def test_paf_route_preserves_http_exception(monkeypatch):
    def mock_run_paf(*args, **kwargs):
        raise HTTPException(status_code=403, detail="Forbidden")

    monkeypatch.setattr(routes_analyze, "run_paf", mock_run_paf)
    body = FactorBody(rows=[["a", "b"], ["1", "2"]], columnNames=["a", "b"], nFactors=1)
    with pytest.raises(HTTPException) as exc_info:
        analyze_paf(body)
    assert exc_info.value.status_code == 403
    assert exc_info.value.detail == "Forbidden"
