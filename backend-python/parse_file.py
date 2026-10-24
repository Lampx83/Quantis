"""
Parse file upload (Excel, ODS, SPSS, Stata, SAS, R) → rows (string[][]) + format + variables metadata.
Dùng bởi Quantis frontend khi import dữ liệu từ các định dạng bảng / thống kê.
"""
import io
import os
import tempfile
from pathlib import Path
from typing import Any

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


def _format_cell(val: Any) -> str:
    """Chuyển ô dữ liệu thành chuỗi, chuẩn hóa float nguyên (1.0 -> '1') và NaN -> ''."""
    if val == "" or pd.isna(val):
        return ""
    if isinstance(val, bool):
        return str(val)
    if isinstance(val, (int, float)):
        try:
            if float(val).is_integer():
                return str(int(val))
        except (ValueError, OverflowError):
            pass
    return str(val)


def _df_to_rows(df: pd.DataFrame) -> list[list[str]]:
    """Chuyển DataFrame thành [headers] + data rows, mỗi ô là string."""
    df = df.fillna("")
    cols = list(df.columns)
    headers = [str(c) for c in cols]
    rows = [headers]
    for _, r in df.iterrows():
        rows.append([_format_cell(r[c]) for c in cols])
    return rows


def _format_val_key(val: Any) -> str:
    """Format numerical or string value label key to clean string (e.g. 1.0 -> '1')."""
    if isinstance(val, (int, float)):
        try:
            if float(val).is_integer():
                return str(int(val))
        except (ValueError, OverflowError):
            pass
    return str(val).strip()


def _numeric_decimals(series: pd.Series) -> int:
    """0 nếu mọi giá trị của cột số đều là số nguyên (id, tuổi, đếm…); 2 nếu có giá trị lẻ."""
    try:
        non_null = pd.to_numeric(series.dropna(), errors="coerce").dropna()
        if len(non_null) == 0:
            return 0
        return 2 if bool((non_null % 1 != 0).any()) else 0
    except (ValueError, TypeError):
        return 0


_RANGE_BOUND_LIMIT = 1e300


def _range_bound(val: Any) -> int | float | None:
    """Chuẩn hóa biên khoảng khuyết thành số JSON hợp lệ (±inf của SPSS LO/HI -> ±1e300)."""
    try:
        f = float(val)
    except (TypeError, ValueError):
        return None
    if f != f:  # NaN
        return None
    f = max(-_RANGE_BOUND_LIMIT, min(_RANGE_BOUND_LIMIT, f))
    return int(f) if f.is_integer() and abs(f) < 1e15 else f


def _extract_pyreadstat_metadata(meta: Any, df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """
    Trích xuất metadata học thuật từ PyreadstatMetaData:
    column_names, column_labels, variable_value_labels, variable_measure,
    missing_user_values, missing_ranges, variable_alignment, variable_display_width.
    """
    variables: dict[str, dict[str, Any]] = {}
    col_names = getattr(meta, "column_names", []) or list(df.columns)
    col_labels = getattr(meta, "column_names_to_labels", {}) or getattr(meta, "variable_to_label", {}) or {}
    val_labels = getattr(meta, "variable_value_labels", {}) or {}
    var_measure = getattr(meta, "variable_measure", {}) or {}
    var_types = getattr(meta, "readstat_variable_types", {}) or {}
    user_missing = getattr(meta, "missing_user_values", {}) or {}
    missing_ranges = getattr(meta, "missing_ranges", {}) or {}
    alignments = getattr(meta, "variable_alignment", {}) or {}
    display_widths = getattr(meta, "variable_display_width", {}) or {}

    for col in col_names:
        str_col = str(col)

        # 1. Label
        label = col_labels.get(col) or str_col

        # 2. Type
        raw_type = str(var_types.get(col, "")).lower()
        if any(t in raw_type for t in ("double", "float", "int", "numeric", "number")):
            var_type = "numeric"
        elif any(t in raw_type for t in ("date", "time", "datetime")):
            var_type = "date"
        else:
            if col in df.columns and pd.api.types.is_numeric_dtype(df[col]):
                var_type = "numeric"
            elif col in df.columns and pd.api.types.is_datetime64_any_dtype(df[col]):
                var_type = "date"
            else:
                var_type = "string"

        # 3. Value Labels (ánh xạ mã -> nhãn)
        raw_vl = val_labels.get(col)
        value_labels: dict[str, str] = {}
        if isinstance(raw_vl, dict):
            for k, v in raw_vl.items():
                clean_k = _format_val_key(k)
                if clean_k != "":
                    value_labels[clean_k] = str(v)

        # 4. Measure
        raw_meas = str(var_measure.get(col, "")).lower()
        if raw_meas in ("nominal", "ordinal", "scale"):
            measure = raw_meas
        else:
            if var_type == "numeric":
                unique_cnt = df[col].dropna().nunique() if col in df.columns else 0
                if unique_cnt <= 7 or len(value_labels) > 0:
                    measure = "ordinal"
                else:
                    measure = "scale"
            elif var_type == "date":
                measure = "scale"
            else:
                measure = "nominal"

        # 5. Missing Values
        missing_vals: list[str] = []
        if col in user_missing and isinstance(user_missing[col], (list, tuple)):
            for mv in user_missing[col]:
                formatted_mv = _format_val_key(mv)
                if formatted_mv:
                    missing_vals.append(formatted_mv)
        missing_range: dict[str, Any] | None = None
        if col in missing_ranges and isinstance(missing_ranges[col], (list, tuple)):
            for mr in missing_ranges[col]:
                if not isinstance(mr, dict):
                    continue
                lo = mr.get("lo")
                hi = mr.get("hi")
                if lo is None or hi is None:
                    continue
                if lo == hi:
                    # Mã rời rạc (pyreadstat biểu diễn là khoảng lo == hi)
                    formatted_lo = _format_val_key(lo)
                    if formatted_lo:
                        missing_vals.append(formatted_lo)
                elif missing_range is None:
                    # Khoảng thật (vd 98–99): SPSS cho tối đa 1 khoảng (+ 1 mã rời rạc)
                    b_lo, b_hi = _range_bound(lo), _range_bound(hi)
                    if b_lo is not None and b_hi is not None:
                        missing_range = {"min": min(b_lo, b_hi), "max": max(b_lo, b_hi)}

        # 6. Decimals: biến số nguyên (id, tuổi, đếm, Likert…) hiển thị 0 chữ số; chỉ 2 khi có giá trị lẻ
        if var_type == "numeric" and col in df.columns:
            decimals = _numeric_decimals(df[col])
        else:
            decimals = 0

        # 7. Align
        raw_align = str(alignments.get(col, "")).lower()
        if raw_align in ("left", "right", "center"):
            align = raw_align
        else:
            align = "right" if var_type == "numeric" else ("center" if var_type == "date" else "left")

        # 8. Width
        width = display_widths.get(col)
        if isinstance(width, (int, float)) and width > 0:
            pixel_width = max(80, min(300, int(width * 12)))
        else:
            pixel_width = 120

        var_entry: dict[str, Any] = {
            "name": str_col,
            "type": var_type,
            "label": label,
            "measure": measure,
            "decimals": decimals,
            "align": align,
            "width": pixel_width,
            "missingValues": list(dict.fromkeys(missing_vals)),
        }
        if missing_range is not None:
            var_entry["missingRange"] = missing_range
        if value_labels:
            var_entry["valueLabels"] = value_labels

        variables[str_col] = var_entry

    return variables


def _infer_dataframe_metadata(df: pd.DataFrame) -> dict[str, dict[str, Any]]:
    """
    Suy luận VariableMetadata từ pandas DataFrame cho các định dạng không có metadata (Excel, ODS, CSV).
    """
    variables: dict[str, dict[str, Any]] = {}
    for col in df.columns:
        str_col = str(col)
        series = df[col].dropna()
        if pd.api.types.is_numeric_dtype(series):
            var_type = "numeric"
            unique_cnt = series.nunique()
            measure = "ordinal" if unique_cnt <= 7 else "scale"
            decimals = _numeric_decimals(series)
            align = "right"
        elif pd.api.types.is_datetime64_any_dtype(series):
            var_type = "date"
            measure = "scale"
            decimals = 0
            align = "center"
        else:
            var_type = "string"
            measure = "nominal"
            decimals = 0
            align = "left"

        variables[str_col] = {
            "name": str_col,
            "type": var_type,
            "label": str_col,
            "measure": measure,
            "decimals": decimals,
            "align": align,
            "width": 120,
            "missingValues": [],
        }
    return variables


def parse_excel(buffer: io.BytesIO, ext: str) -> tuple[list[list[str]], dict[str, dict[str, Any]]]:
    """Đọc .xlsx hoặc .xls (sheet đầu tiên)."""
    if ext == ".xlsx":
        df = pd.read_excel(buffer, engine="openpyxl", sheet_name=0)
    else:
        df = pd.read_excel(buffer, engine="xlrd", sheet_name=0)
    rows = _df_to_rows(df)
    variables = _infer_dataframe_metadata(df)
    return rows, variables


def parse_ods(buffer: io.BytesIO) -> tuple[list[list[str]], dict[str, dict[str, Any]]]:
    """Đọc .ods (sheet đầu tiên)."""
    df = pd.read_excel(buffer, engine="odf", sheet_name=0)
    rows = _df_to_rows(df)
    variables = _infer_dataframe_metadata(df)
    return rows, variables


def parse_sav(buffer: io.BytesIO) -> tuple[list[list[str]], dict[str, dict[str, Any]]]:
    """Đọc SPSS .sav (pyreadstat cần file trên đĩa) và trích xuất metadata."""
    import pyreadstat
    with tempfile.NamedTemporaryFile(suffix=".sav", delete=False) as tmp:
        tmp.write(buffer.getvalue())
        tmp_path = tmp.name
    try:
        df, meta = pyreadstat.read_sav(tmp_path, user_missing=True)
        rows = _df_to_rows(df)
        variables = _extract_pyreadstat_metadata(meta, df)
        return rows, variables
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def parse_dta(buffer: io.BytesIO) -> tuple[list[list[str]], dict[str, dict[str, Any]]]:
    """Đọc Stata .dta (pyreadstat cần file trên đĩa) và trích xuất metadata."""
    import pyreadstat
    with tempfile.NamedTemporaryFile(suffix=".dta", delete=False) as tmp:
        tmp.write(buffer.getvalue())
        tmp_path = tmp.name
    try:
        df, meta = pyreadstat.read_dta(tmp_path, user_missing=True)
        rows = _df_to_rows(df)
        variables = _extract_pyreadstat_metadata(meta, df)
        return rows, variables
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def parse_sas(buffer: io.BytesIO) -> tuple[list[list[str]], dict[str, dict[str, Any]]]:
    """Đọc SAS .sas7bdat (pyreadstat cần file trên đĩa)."""
    import pyreadstat
    with tempfile.NamedTemporaryFile(suffix=".sas7bdat", delete=False) as tmp:
        tmp.write(buffer.getvalue())
        tmp_path = tmp.name
    try:
        df, meta = pyreadstat.read_sas7bdat(tmp_path, user_missing=True)
        rows = _df_to_rows(df)
        variables = _extract_pyreadstat_metadata(meta, df)
        return rows, variables
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def parse_rdata(buffer: io.BytesIO) -> tuple[list[list[str]], dict[str, dict[str, Any]]]:
    """Đọc R .rds hoặc .RData — lấy frame đầu tiên."""
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
        rows = _df_to_rows(df)
        variables = _infer_dataframe_metadata(df)
        return rows, variables
    finally:
        try:
            os.unlink(tmp_path)
        except OSError:
            pass


def parse_file(content: bytes, filename: str) -> tuple[list[list[str]], str, dict[str, dict[str, Any]]]:
    """
    Phân tích file theo extension. Trả về (rows, format, variables).
    format: excel, ods, sav, dta, sas7bdat, rds, rdata.
    """
    ext = _normalize_extension(filename)
    buffer = io.BytesIO(content)

    if ext in EXCEL_EXTENSIONS:
        rows, variables = parse_excel(buffer, ext)
        return rows, "excel", variables
    if ext == ODS_EXTENSION:
        rows, variables = parse_ods(buffer)
        return rows, "ods", variables
    if ext == ".sav":
        rows, variables = parse_sav(buffer)
        return rows, "sav", variables
    if ext == ".dta":
        rows, variables = parse_dta(buffer)
        return rows, "dta", variables
    if ext == ".sas7bdat":
        rows, variables = parse_sas(buffer)
        return rows, "sas7bdat", variables
    if ext in (".rds", ".rdata"):
        rows, variables = parse_rdata(buffer)
        return rows, "rdata" if ext == ".rdata" else "rds", variables
    raise ValueError(f"Unsupported format: {ext}. Supported: .xlsx, .xls, .ods, .sav, .dta, .sas7bdat, .rds, .RData")
