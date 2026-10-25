"""Thống kê mô tả: cột khai báo số có ô không phải số hợp lệ (chữ, «3,5») → đếm riêng ở nonNumeric, không tính vào missing."""
import pytest

from analysis_impl import run_descriptive

ROWS = [
    ["id", "q1", "ten"],
    ["1", "3", "a"],
    ["2", "4", "b"],
    ["3", "bốn", "c"],
    ["4", "5", "d"],
    ["5", "N/A", "e"],
    ["6", "3,5", "f"],
    ["7", "", "g"],
    ["8", "2", "h"],
]


def _by_col(res):
    return {r["column"]: r for r in res}


def test_khai_bao_so_dem_rieng_o_sai_kieu():
    res = _by_col(run_descriptive(ROWS, ["id", "q1"]))
    q1 = res["q1"]
    assert q1["type"] == "numeric"
    assert q1["nonNumeric"] == 3          # «bốn», «N/A», «3,5»
    assert q1["missing"] == 1             # chỉ ô trống — ý nghĩa Missing không đổi
    assert q1["n"] == 8
    assert q1["n"] - q1["missing"] - q1["nonNumeric"] == 4
    assert q1["min"] == 2 and q1["max"] == 5
    assert q1["mean"] == pytest.approx(3.5)
    assert res["id"]["nonNumeric"] == 0
    assert "nonNumeric" not in res["ten"]


def test_khong_khai_bao_giu_hanh_vi_cu():
    res = _by_col(run_descriptive(ROWS))
    q1 = res["q1"]
    assert q1["type"] == "categorical"
    assert "nonNumeric" not in q1
    assert q1["missing"] == 1


def test_khai_bao_nhung_toan_chu_roi_ve_phan_loai():
    res = _by_col(run_descriptive(ROWS, ["ten"]))
    assert res["ten"]["type"] == "categorical"


def test_so_hop_le_theo_quy_uoc_quantis():
    rows = [["x"], ["1"], ["2.5"], ["-3"], ["1e3"], ["0x10"], ["3,5"], ["inf"], [" 4 "]]
    x = run_descriptive(rows, ["x"])[0]
    assert x["nonNumeric"] == 3           # 0x10, 3,5, inf không phải số hợp lệ
    assert x["max"] == 1000.0
    assert x["min"] == -3.0


def test_endpoint_nhan_numericColumns():
    from fastapi.testclient import TestClient
    from main import app

    client = TestClient(app)
    r = client.post("/api/quantis/analyze/descriptive", json={"rows": ROWS, "numericColumns": ["q1"]})
    assert r.status_code == 200, r.text
    q1 = {x["column"]: x for x in r.json()["result"]}["q1"]
    assert q1["nonNumeric"] == 3
    # Frontend cũ không gửi numericColumns vẫn chạy
    r2 = client.post("/api/quantis/analyze/descriptive", json={"rows": ROWS})
    assert r2.status_code == 200
