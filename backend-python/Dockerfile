# Quantis Analysis Backend (Python) — scipy, statsmodels, pandas
FROM python:3.12-slim

WORKDIR /app

COPY requirements.txt ./
RUN pip install --no-cache-dir -r requirements.txt

COPY main.py routes_analyze.py analysis_impl.py parse_file.py ./

EXPOSE 8000

# Uvicorn với path /api/quantis/analyze cần mount tại root (trong container chạy 8000, publish ra host 4000)
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8000"]
