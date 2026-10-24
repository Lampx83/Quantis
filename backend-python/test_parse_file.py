"""
Test script for parse_file.py and main.py metadata extraction.
"""
import io
import os
import tempfile
import pandas as pd
import pyreadstat
from parse_file import parse_file, parse_sav, parse_dta

def test_sav_metadata_extraction():
    # Create sample DataFrame
    df = pd.DataFrame({
        "GENDER": [1.0, 2.0, 1.0, 2.0, 99.0],
        "SATISFACTION": [4.0, 5.0, 3.0, 4.0, 2.0],
        "INCOME": [1500.5, 2300.0, 1800.75, 3200.0, 2100.0]
    })
    
    with tempfile.NamedTemporaryFile(suffix=".sav", delete=False) as f:
        path = f.name
        
    pyreadstat.write_sav(
        df,
        path,
        column_labels=["Giới tính", "Mức độ hài lòng", "Thu nhập hàng tháng"],
        variable_value_labels={
            "GENDER": {1.0: "Nam", 2.0: "Nữ"},
            "SATISFACTION": {1.0: "Rất không hài lòng", 5.0: "Rất hài lòng"}
        },
        variable_measure={
            "GENDER": "nominal",
            "SATISFACTION": "ordinal",
            "INCOME": "scale"
        },
        missing_ranges={
            "GENDER": [{"lo": 99.0, "hi": 99.0}]
        }
    )
    
    with open(path, "rb") as f:
        content = f.read()
        
    rows, fmt, variables = parse_file(content, "survey.sav")
    
    assert fmt == "sav"
    assert len(rows) == 6 # header + 5 data rows
    assert rows[1][0] == "1"
    assert rows[5][0] == "99"
    assert rows[1][2] == "1500.5"
    assert rows[2][2] == "2300"
    assert "GENDER" in variables
    gender_meta = variables["GENDER"]
    assert gender_meta["label"] == "Giới tính"
    assert gender_meta["measure"] == "nominal"
    assert gender_meta["valueLabels"] == {"1": "Nam", "2": "Nữ"}
    assert "99" in gender_meta["missingValues"]
    
    sat_meta = variables["SATISFACTION"]
    assert sat_meta["label"] == "Mức độ hài lòng"
    assert sat_meta["measure"] == "ordinal"
    assert sat_meta["valueLabels"] == {"1": "Rất không hài lòng", "5": "Rất hài lòng"}
    
    inc_meta = variables["INCOME"]
    assert inc_meta["label"] == "Thu nhập hàng tháng"
    assert inc_meta["measure"] == "scale"
    assert inc_meta["type"] == "numeric"
    assert inc_meta["decimals"] == 2
    
    print("test_sav_metadata_extraction passed!")

def test_excel_fallback():
    df = pd.DataFrame({
        "AGE": [25, 30, 35],
        "NAME": ["An", "Bình", "Cường"]
    })
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
        
    rows, fmt, variables = parse_file(buf.getvalue(), "data.xlsx")
    assert fmt == "excel"
    assert len(rows) == 4
    assert "AGE" in variables
    assert variables["AGE"]["type"] == "numeric"
    assert "NAME" in variables
    assert variables["NAME"]["type"] == "string"
    
    print("test_excel_fallback passed!")

def test_api_endpoint():
    from fastapi.testclient import TestClient
    from main import app
    
    client = TestClient(app)
    
    # Test Excel upload
    df = pd.DataFrame({"X": [1, 2, 3], "Y": ["A", "B", "C"]})
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
        
    res = client.post(
        "/parse-file",
        files={"file": ("data.xlsx", buf.getvalue(), "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet")}
    )
    assert res.status_code == 200
    data = res.json()
    assert "rows" in data
    assert "format" in data
    assert data["format"] == "excel"
    assert "variables" in data
    assert "X" in data["variables"]
    assert data["variables"]["X"]["type"] == "numeric"
    print("test_api_endpoint passed!")

def _write_sav(df, **kwargs) -> bytes:
    with tempfile.NamedTemporaryFile(suffix=".sav", delete=False) as f:
        path = f.name
    pyreadstat.write_sav(df, path, **kwargs)
    with open(path, "rb") as f:
        content = f.read()
    os.unlink(path)
    return content


def test_sav_missing_range_is_extracted():
    """Khoảng khuyết 98–99 phải vào metadata (`missingRange`), dữ liệu gốc vẫn giữ nguyên mã để Variable View hiển thị."""
    df = pd.DataFrame({"q1": [1.0, 2.0, 99.0, 3.0, 98.0, 5.0], "age": [20, 30, 40, 50, 60, 70]})
    content = _write_sav(df, missing_ranges={"q1": [{"lo": 98.0, "hi": 99.0}]})
    rows, fmt, variables = parse_file(content, "r.sav")
    q1 = variables["q1"]
    assert q1["missingRange"] == {"min": 98, "max": 99}
    assert q1["missingValues"] == []
    assert [r[0] for r in rows[1:]] == ["1", "2", "99", "3", "98", "5"]
    assert "missingRange" not in variables["age"]


def test_sav_range_plus_discrete_code():
    """SPSS cho phép 1 khoảng + 1 mã rời rạc (vd 97 và 98–99)."""
    df = pd.DataFrame({"q": [1.0, 97.0, 98.0, 99.0, 4.0]})
    content = _write_sav(df, missing_ranges={"q": [{"lo": 98.0, "hi": 99.0}, {"lo": 97.0, "hi": 97.0}]})
    _, _, variables = parse_file(content, "r.sav")
    assert variables["q"]["missingRange"] == {"min": 98, "max": 99}
    assert variables["q"]["missingValues"] == ["97"]


def test_range_bound_handles_infinite_and_nan():
    from parse_file import _range_bound
    assert _range_bound(float("-inf")) == -1e300
    assert _range_bound(float("inf")) == 1e300
    assert _range_bound(float("nan")) is None
    assert _range_bound(98.0) == 98
    assert _range_bound(0.5) == 0.5


def test_integer_scale_columns_have_zero_decimals():
    """Biến số nguyên (id, tuổi, đếm) không hiện '1.00'; cột có giá trị lẻ mới có 2 chữ số thập phân."""
    ids = list(range(1, 31))
    df = pd.DataFrame({"id": ids, "age": [20 + i for i in ids], "income": [i * 1.5 for i in ids]})
    content = _write_sav(df, variable_measure={"id": "scale", "age": "scale", "income": "scale"})
    _, _, variables = parse_file(content, "d.sav")
    assert variables["id"]["decimals"] == 0
    assert variables["age"]["decimals"] == 0
    assert variables["income"]["decimals"] == 2

    # Giá trị lẻ xuất hiện sau 100 dòng đầu vẫn phải được phát hiện
    vals = [float(i) for i in range(300)]
    vals[250] = 3.5
    content = _write_sav(pd.DataFrame({"x": vals}), variable_measure={"x": "scale"})
    _, _, variables = parse_file(content, "d.sav")
    assert variables["x"]["decimals"] == 2


def test_excel_integer_scale_decimals():
    df = pd.DataFrame({"id": list(range(1, 21)), "w": [i + 0.25 for i in range(20)]})
    buf = io.BytesIO()
    with pd.ExcelWriter(buf, engine="openpyxl") as writer:
        df.to_excel(writer, index=False)
    _, _, variables = parse_file(buf.getvalue(), "d.xlsx")
    assert variables["id"]["decimals"] == 0
    assert variables["w"]["decimals"] == 2


if __name__ == "__main__":
    test_sav_metadata_extraction()
    test_excel_fallback()
    test_api_endpoint()
    print("All python tests passed!")
