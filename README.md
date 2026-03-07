# Quantis

Quantitative analysis and statistics platform for research and education: data management, descriptive statistics, hypothesis testing, reliability, visualisation and academic reporting (APA). Can run frontend-only (data in browser) or with a dedicated backend (JSON store).

## Main features

- **Data management:** CSV import, profiling (missing, type, skewness, IQR outliers), transform (treat missing / replace with mean), table view.
- **Descriptive statistics:** Mean, median, std, min, max, Q25, Q75; frequency for categorical variables.
- **Hypothesis testing:** Independent two-sample t-test (Welch), one-way ANOVA (F, η²), Chi-square independence, Mann-Whitney U (non-parametric), Shapiro-Wilk (normality), power analysis (sample size for t-test).
- **Regression:** OLS (linear), logistic (binary Y), VIF (multicollinearity), mediation (Baron-Kenny), moderation (interaction term).
- **Factor analysis:** EFA (PCA extraction, varimax rotation).
- **Correlation:** Pearson and Spearman (correlation matrix).
- **Reliability:** Cronbach's alpha for scales (e.g. Likert).
- **Machine learning (ML):** K-means clustering; **multi-class classification** (One-vs-Rest logistic regression) with **confusion matrix**, **classification report** (accuracy, precision, recall, F1 per class, macro/weighted); **feature importance / explainability**: coefficient-based importance and **permutation importance** (shuffle each feature, measure accuracy drop).
- **Visualisation:** Scatter, bar, line (trend), pie, box plot by group, histogram.
- **Reporting:** HTML export with descriptive stats and APA-style test results (t, F, χ²).
- **Workflow:** Save workflow, generate R script, versioning.

## Run

### Frontend only

```bash
cd Quantis
npm install
npm run dev
```

Open http://localhost:3000. Data is stored in localStorage.

### Frontend + backend

```bash
# Terminal 1: backend Node (lưu dataset/workflow, proxy Archive & proxy phân tích)
cd Quantis/backend
npm install
# Bật thêm backend Python phân tích (tùy chọn):
export ANALYZE_PYTHON_URL=http://localhost:4000
npm start

# Terminal 2 (tùy chọn): backend phân tích Python (scipy, statsmodels) — chỉ cần khi dùng ANALYZE_PYTHON_URL
cd Quantis/backend-python
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 4000

# Terminal 3: frontend
cd Quantis
echo 'VITE_QUANTIS_API_URL=http://localhost:4001' > .env
npm install
npm run dev
```

Backend Node tại http://localhost:4001. Nếu chạy thêm backend Python và set `ANALYZE_PYTHON_URL=http://localhost:4000`, các phân tích (thống kê mô tả, t-test, ANOVA, Chi-square, tương quan, OLS, logistic) sẽ chạy trên Python (scipy/statsmodels) thay vì JavaScript trong trình duyệt — phù hợp dataset lớn và kết quả chuẩn nghiên cứu.

**Build:** `npm run build` — output in `public/`.

**Archive NEU:** With backend, app calls Archive via backend proxy (`/api/quantis/archive/*`). Set `VITE_ARCHIVE_NEU_URL` and tokens if needed.

**Note:** When embedded in Research Portal, Quantis uses the Portal backend (PostgreSQL, auth). The local `backend/` is for standalone use only.
