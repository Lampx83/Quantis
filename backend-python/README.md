# Backend phân tích Quantis (Python)

Dịch vụ phân tích định lượng bằng **scipy**, **statsmodels**, **pandas**, **scikit-learn**. Frontend gọi qua proxy Node (`/api/quantis/analyze/*`).

## Cài đặt

```bash
cd backend-python
python3 -m venv venv
source venv/bin/activate   # Windows: venv\Scripts\activate
pip install -r requirements.txt
```

## Chạy

```bash
uvicorn main:app --reload --host 0.0.0.0 --port 4000
```

API: http://localhost:4000  
Docs: http://localhost:4000/docs

**Docker:** Trong container chạy cổng **8000**, map ra host cổng **4000** (`4000:8000`). Backend Node gọi nội bộ `http://quantis-python:8000`.

## Endpoints (prefix `/api/quantis/analyze`)

| Method | Path | Mô tả |
|--------|------|--------|
| GET | `/health` | Health check |
| POST | `/descriptive` | Thống kê mô tả |
| POST | `/ttest` | t-test hai mẫu (Welch) |
| POST | `/chi2` | Chi-square độc lập |
| POST | `/correlation` | Ma trận tương quan (Pearson/Spearman) |
| POST | `/anova` | ANOVA một nhân tố |
| POST | `/kruskal` | Kruskal-Wallis H (non-parametric, 3+ nhóm) |
| POST | `/ols` | Hồi quy OLS |
| POST | `/logistic` | Hồi quy logistic nhị phân |
| POST | `/mannwhitney` | Mann-Whitney U (non-parametric) |
| POST | `/shapiro` | Shapiro-Wilk (kiểm định chuẩn) |
| POST | `/cronbach` | Cronbach's alpha (độ tin cậy thang đo) |
| POST | `/vif` | VIF – đa cộng tuyến |
| POST | `/mediation` | Mediation (Baron-Kenny: X→M→Y) |
| POST | `/moderation` | Moderation (tương tác X×M) |
| POST | `/kmeans` | K-means clustering |
| POST | `/efa` | EFA (trích nhân tố PCA + xoay varimax) |
| POST | `/pairwise-posthoc` | So sánh từng cặp sau ANOVA (Welch t + Bonferroni) |
| POST | `/crosstab` | Bảng tần số 2 chiều |
| POST | `/boxstats` | Thống kê box plot theo nhóm (min, Q1, median, Q3, max, n) |
| POST | `/histogram-bins` | Chia bins cho histogram |
| POST | `/power-ttest` | Cỡ mẫu / power cho t-test (Cohen d) |
| POST | `/sample-size-proportion` | Cỡ mẫu cho kiểm định tỉ lệ |
| POST | `/sample-size-anova` | Cỡ mẫu cho ANOVA 1 nhân tố |
| POST | `/outlier-iqr` | Số điểm ngoại lai (quy tắc 1.5×IQR) |
| POST | `/beta-posterior` | Hậu nghiệm Beta (Bayesian tỉ lệ) |
| POST | `/sample-size-chisquare` | Cỡ mẫu cho Chi-square (Cohen w) |
| POST | `/sample-size-regression` | Cỡ mẫu hồi quy (quy tắc 10/20 trên biến) |
| POST | `/text-stats` | Phân tích định tính: thống kê văn bản (số từ, tần số từ) |
| POST | `/keyword-counts` | Phân tích định tính: đếm từ khóa/mã (số dòng chứa, tổng lần xuất hiện) |
| POST | `/ngram-freq` | Phân tích định tính: tần số cụm từ (n-gram: bigram, trigram) |
| POST | `/cohens-kappa` | Phân tích định tính: Cohen's Kappa — độ đồng nhất mã hóa 2 coder |

## Tích hợp với Node

Trong thư mục `backend/` (Node), set biến môi trường:

```bash
export ANALYZE_PYTHON_URL=http://localhost:4000
node server.js
```

Khi đó mọi request tới `http://localhost:3001/api/quantis/analyze/*` sẽ được proxy tới Python. Frontend chỉ cần `VITE_QUANTIS_API_URL=http://localhost:3001` và sẽ tự dùng backend phân tích khi có.

## Giới hạn

- Số dòng tối đa mặc định: 100000 (override bằng `QUANTIS_ANALYSIS_MAX_ROWS`).
