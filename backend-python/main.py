"""
Quantis Analysis Backend (Python)
Phân tích thống kê bằng scipy/statsmodels/pandas — chuẩn, ổn định, hỗ trợ dataset lớn.
"""
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from routes_analyze import router


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


@app.get("/health")
async def health():
    return {"status": "ok", "service": "quantis-analysis", "engine": "python"}


@app.get("/")
async def root():
    return {"service": "Quantis Analysis API", "version": "1.0.0", "docs": "/docs", "analyze_health": "/api/quantis/analyze/health"}
