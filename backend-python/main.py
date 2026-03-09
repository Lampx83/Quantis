"""
Quantis Analysis Backend (Python)
Phân tích thống kê bằng scipy/statsmodels/pandas — chuẩn, ổn định, hỗ trợ dataset lớn.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI, File, UploadFile, HTTPException
from fastapi.middleware.cors import CORSMiddleware

from routes_analyze import router
from parse_file import parse_file as parse_file_impl


@asynccontextmanager
async def lifespan(app: FastAPI):
    yield


app = FastAPI(
    title="Quantis Analysis API",
    description="Backend phân tích thống kê cho Quantis (scipy, statsmodels, pandas)",
    version="1.0.0",
    lifespan=lifespan,
)
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router, prefix="/api/quantis/analyze", tags=["analyze"])


async def _parse_file_impl(file: UploadFile):
    """Shared logic: read file and return rows + format."""
    try:
        content = await file.read()
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Failed to read file: {e}")
    if not content:
        raise HTTPException(status_code=400, detail="Empty file")
    try:
        rows, format_name = parse_file_impl(content, file.filename or "data")
    except ValueError as e:
        raise HTTPException(status_code=400, detail=str(e))
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Parse error: {e}")
    return {"rows": rows, "format": format_name}


@app.post("/parse-file")
async def parse_file_upload(file: UploadFile = File(..., description="File: .xlsx, .xls, .ods, .sav, .dta, .sas7bdat, .rds, .RData")):
    """Parse file upload thành bảng rows (string[][]) + format. Dùng khi Quantis import dữ liệu từ Excel, ODS, SPSS, Stata, SAS, R."""
    return await _parse_file_impl(file)


# Khi Python được expose qua proxy với prefix /api/quantis/backend-python (vd. AI Portal), Node gọi .../api/quantis/backend-python/parse-file
@app.post("/api/quantis/backend-python/parse-file")
async def parse_file_upload_prefixed(file: UploadFile = File(..., description="File: .xlsx, .xls, .ods, .sav, .dta, .sas7bdat, .rds, .RData")):
    return await _parse_file_impl(file)


@app.get("/health")
async def health():
    return {"status": "ok", "service": "quantis-analysis", "engine": "python"}


@app.get("/")
async def root():
    return {"service": "Quantis Analysis API", "version": "1.0.0", "docs": "/docs", "analyze_health": "/api/quantis/analyze/health"}
