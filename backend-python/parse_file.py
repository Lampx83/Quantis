"""
Parse file upload (Excel, ODS, SPSS, Stata, SAS, R) → rows (string[][]) + format.
Dùng bởi Quantis frontend khi import dữ liệu từ các định dạng bảng / thống kê.
"""
import io
import os
import tempfile
from pathlib import Path

import pandas as pd


# Định dạng hỗ trợ: extension -> (engine/reader, format label)
EXCEL_EXTENSIONS = (".xlsx", ".xls")
ODS_EXTENSION = ".ods"


def _normalize_extension(filename: str) -> str:
    """Trả về extension viết thường, bao gồm .rdata (hai phần)."""
    name = (filename or "").lower().strip()
    if name.endswith(".rdata"):
        return ".rdata"
    return Path(name).suffix


def _df_to_rows(df: pd.DataFrame) -> list[list[str]]:
    """Chuyển DataFrame thành [headers] + data rows, mỗi ô là string."""
    df = df.fillna("")
    cols = list(df.columns)
    headers = [str(c) for c in cols]
    rows = [headers]
    for _, r in df.iterrows():
        rows.append([str(r[c]) if r[c] != "" else "" for c in cols])
    return rows


def parse_excel(buffer: io.BytesIO, ext: str) -> list[list[str]]:
    """Đọc .xlsx hoặc .xls (sheet đầu tiên)."""
    if ext == ".xlsx":
        df = pd.read_excel(buffer, engine="openpyxl", sheet_name=0)
    else:
        df = pd.read_excel(buffer, engine="xlrd", sheet_name=0)
    return _df_to_rows(df)


def parse_ods(buffer: io.BytesIO) -> list[list[str]]:
    """Đọc .ods (sheet đầu tiên)."""
    df = pd.read_excel(buffer, engine="odf", sheet_name=0)
    return _df_to_rows(df)


def parse_sav(buffer: io.BytesIO) -> list[list[str]]:
    """Đọc SPSS .sav (pyreadstat cần file trên đĩa)."""
    import pyreadstat
    with tempfile.NamedTemporaryFile(suffix=".sav", delete=False) as tmp:
        tmp.write(buffer.getvalue())
        tmp_path = tmp.name
    try:
        df, _ = pyreadstat.read_sav(tmp_path)
        return _df_to_rows(df)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def parse_dta(buffer: io.BytesIO) -> list[list[str]]:
    """Đọc Stata .dta (pyreadstat cần file trên đĩa)."""
    import pyreadstat
    with tempfile.NamedTemporaryFile(suffix=".dta", delete=False) as tmp:
        tmp.write(buffer.getvalue())
        tmp_path = tmp.name
    try:
        df, _ = pyreadstat.read_dta(tmp_path)
        return _df_to_rows(df)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def parse_sas(buffer: io.BytesIO) -> list[list[str]]:
    """Đọc SAS .sas7bdat (pyreadstat cần file trên đĩa)."""
    import pyreadstat
    with tempfile.NamedTemporaryFile(suffix=".sas7bdat", delete=False) as tmp:
        tmp.write(buffer.getvalue())
        tmp_path = tmp.name
    try:
        df, _ = pyreadstat.read_sas7bdat(tmp_path)
        return _df_to_rows(df)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def parse_rdata(buffer: io.BytesIO) -> list[list[str]]:
    """Đọc R .rds hoặc .RData — lấy frame đầu tiên (pyreadr thường cần path)."""
    import pyreadr
    with tempfile.NamedTemporaryFile(suffix=".rds", delete=False) as tmp:
        tmp.write(buffer.getvalue())
        tmp_path = tmp.name
    try:
        result = pyreadr.read_r(tmp_path)
        if not result:
            raise ValueError("R file does not contain any readable object")
        df = next(iter(result.values()))
        if not isinstance(df, pd.DataFrame):
            raise ValueError("R object is not a data frame")
        return _df_to_rows(df)
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def parse_file(content: bytes, filename: str) -> tuple[list[list[str]], str]:
    """
    Phân tích file theo extension. Trả về (rows, format).
    format: excel, ods, sav, dta, sas7bdat, rds, rdata.
    """
    ext = _normalize_extension(filename)
    buffer = io.BytesIO(content)

    if ext in EXCEL_EXTENSIONS:
        rows = parse_excel(buffer, ext)
        return rows, "excel"
    if ext == ODS_EXTENSION:
        rows = parse_ods(buffer)
        return rows, "ods"
    if ext == ".sav":
        rows = parse_sav(buffer)
        return rows, "sav"
    if ext == ".dta":
        rows = parse_dta(buffer)
        return rows, "dta"
    if ext == ".sas7bdat":
        rows = parse_sas(buffer)
        return rows, "sas7bdat"
    if ext in (".rds", ".rdata"):
        rows = parse_rdata(buffer)
        return rows, "rdata" if ext == ".rdata" else "rds"
    raise ValueError(f"Unsupported format: {ext}. Supported: .xlsx, .xls, .ods, .sav, .dta, .sas7bdat, .rds, .RData")
