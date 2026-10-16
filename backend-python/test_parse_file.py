"""
Test script for parse_file.py and main.py metadata extraction.
"""
import io
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

if __name__ == "__main__":
    test_sav_metadata_extraction()
    test_excel_fallback()
    test_api_endpoint()
    print("All python tests passed!")
