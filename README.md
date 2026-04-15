# Quantis

Quantitative analysis and statistics platform for research and education: data management, descriptive statistics, hypothesis testing, reliability, visualisation and academic reporting (APA). Can run **frontend-only** (data in browser), or with **`backend/`** — cùng package gồm **PostgreSQL** (khuyến nghị, giống SurveyLab) hoặc **JSON + proxy** (dev nhanh) — **schema `quantis`** trên DB AI Portal khi nhúng.

**Hai cách triển khai UI:** **Standalone** (tab trình duyệt / dev) dùng đăng nhập Quantis khi bật auth; **Embed AI Portal** nhận diện qua `__PORTAL_USER__`, `__WRITE_API_BASE__`, `embed-config.json`, URL `/embed/quantis`, hoặc `__QUANTIS_PORTAL_EMBED__` — không bắt form đăng nhập Node, đồng bộ `/data` theo header Portal. Chi tiết: [`docs/QUANTIS-DATABASE.md`](docs/QUANTIS-DATABASE.md) mục *Frontend: nhận biết embed*. So sánh triển khai với SurveyLab: [`docs/QUANTIS-PORTAL-AND-SURVEYLAB.md`](docs/QUANTIS-PORTAL-AND-SURVEYLAB.md).

### Tại sao chưa thấy màn hình đăng nhập?

Quantis **có** luồng giống SurveyLab (`/api/quantis/auth/register`, `login`, `me`, SSO OIDC, hộp thoại tài khoản) — **nhưng chỉ khi frontend kết nối được backend PostgreSQL** (`backend/` sau `npm run build && npm start`) và gọi được `GET …/auth/config` trả `authEnabled: true`.

| Tình huống | Kết quả |
|------------|---------|
| Chỉ chạy `npm run dev` (frontend), **không** có `VITE_QUANTIS_API_URL` / backend | Không đăng nhập — dữ liệu chỉ trên trình duyệt (`localStorage`). |
| Chạy **PostgreSQL backend** + `.env` có `VITE_QUANTIS_API_URL` trỏ đúng | **Standalone mặc định: bật auth + bắt buộc phiên** (trừ khi đặt `AUTH_REQUIRED=0` hoặc `AUTH_ENABLED=0` trong `backend/.env`). |
| Nhúng **AI Portal** | Không form Quantis — dùng tài khoản Portal + header `X-User-Id`. |

Xem thêm khối **Tài khoản & đăng nhập** trong menu **⋮ → Cấu hình kết nối** sau khi mở ứng dụng.

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
- **Reproducibility:** Tab **Pre-reg & tái lập** — pre-registration và checklist open science, đồng bộ `localStorage` với Writium (Đề cương nghiên cứu).
- **Mobile / màn hình nhỏ:** Layout `100dvh`, safe-area (notch), sidebar dạng overlay + nút footer; tab header nhãn rút gọn; thanh công cụ cuộn ngang; vùng chạm ~44px ở chỗ chính.
- **Cấu hình kết nối (menu ⋮):** Kiểm tra Backend + Ollama, lưu URL; cuối cửa sổ có **Đặt lại ứng dụng** — xóa toàn bộ dữ liệu cục bộ (`quantis_*` trong localStorage, v.v.) như mới cài; nếu đang đăng nhập có thể ghi workspace rỗng lên server (có hộp thoại xác nhận).

## Run

### Frontend only

```bash
cd Quantis
npm install
npm run dev
```

Open http://localhost:3000. Data is stored in localStorage.

### Frontend + backend (`Quantis/backend/` — một thư mục, hai chế độ)

#### A) PostgreSQL — **khuyến nghị** (standalone DB riêng + schema `quantis` trên AI Portal)

Giống SurveyLab: `DATABASE_URL` / `PORTAL_DATABASE_URL`, `ensure-db` tạo schema + bảng; đăng nhập session + OIDC SSO; trên Portal dùng **`X-User-Id`**.

```bash
cd Quantis/backend
cp .env.example .env   # chỉnh POSTGRES_* hoặc DATABASE_URL (phần PostgreSQL)
npm install && npm run build && npm start
# Mặc định http://localhost:4003 — API dưới /api/quantis/*

cd Quantis
echo 'VITE_QUANTIS_API_URL=http://localhost:4003' > .env
npm run dev
```

Chi tiết: [`docs/QUANTIS-DATABASE.md`](docs/QUANTIS-DATABASE.md). **Nhúng Portal:** `createEmbedRouter` từ `backend/dist/embed.js` (set `RUN_MODE=embedded`, `DB_SCHEMA=quantis`, `PORTAL_DATABASE_URL` trước khi load).

#### B) JSON + proxy — dev nhanh (`json-server.cjs`, port **4001**)

Lưu `data/store.json` + tùy chọn auth file-based. Proxy Archive, Ollama, parse-file → Python.

```bash
cd Quantis/backend
npm install
export ANALYZE_PYTHON_URL=http://localhost:4000   # tùy chọn
npm run start:json
# hoặc: npm run dev  (alias cùng lệnh)

cd Quantis
echo 'VITE_QUANTIS_API_URL=http://localhost:4001' > .env
npm run dev
```

**Đăng nhập (chế độ JSON)** — `QUANTIS_AUTH_ENABLED`, `QUANTIS_AUTH_REQUIRED`, `SESSION_SECRET`, `QUANTIS_ADMIN_EMAILS`, v.v. (xem `backend/.env.example` mục B).

**Python phân tích (tùy chọn):**

```bash
cd Quantis/backend-python
python3 -m venv venv && source venv/bin/activate
pip install -r requirements.txt
uvicorn main:app --reload --port 4000
```

### Auth & đồng bộ (tóm tắt)

- **PostgreSQL (`npm start`):** `AUTH_ENABLED` / `AUTH_REQUIRED` / `SESSION_SECRET` / `ADMIN_EMAILS` / SSO `SSO_*` — giống SurveyLab (`backend/.env.example`). API: `/api/quantis/auth/*`.
- **Frontend:** `GET /api/quantis/auth/config`. **Standalone:** nếu `authEnabled` và `authRequired !== false` → màn hình đăng nhập/đăng ký toàn trang; nếu `authRequired === false` → vào app ngay, **header** có Đăng nhập + Đăng ký, **status bar** có Đăng nhập · Đăng ký. **Embed Portal:** không form Quantis; user Portal + `postMessage`.
- **Portal:** middleware set **`X-User-Id`**.

**Build frontend:** `npm run build` — output in `public/`.

**Archive NEU:** With backend, app calls Archive via backend proxy (`/api/quantis/archive/*`).

**Gốc `npm start` (repo):** `concurrently` chạy Vite + **`npm run dev` trong `backend/`** = chế độ **JSON** (port 4001). Muốn song song **PostgreSQL**, chạy riêng `npm run dev:postgres` trong `backend/` (sau `npm run build`) và trỏ `VITE_QUANTIS_API_URL` tới 4003.
