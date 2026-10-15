# Quantis

Quantitative analysis and statistics platform for research and education: data management, descriptive statistics, hypothesis testing, reliability, visualisation and academic reporting (APA). Can run **frontend-only** (data in browser), or with **`backend/`** — cùng package gồm **PostgreSQL** (khuyến nghị, giống SurveyLab) hoặc **JSON + proxy** (dev nhanh) — **schema `quantis`** trên DB AI Portal khi nhúng.

**Hai cách triển khai UI:** **Standalone** (tab trình duyệt / dev) dùng đăng nhập Quantis khi bật auth; **Embed AI Portal** nhận diện qua `__PORTAL_USER__`, `__WRITE_API_BASE__`, `embed-config.json`, URL `/embed/quantis`, hoặc `__QUANTIS_PORTAL_EMBED__` — không bắt form đăng nhập Node, đồng bộ `/data` theo header Portal. Chi tiết: [`docs/QUANTIS-DATABASE.md`](docs/QUANTIS-DATABASE.md) mục *Frontend: nhận biết embed*. So sánh triển khai với SurveyLab: [`docs/QUANTIS-PORTAL-AND-SURVEYLAB.md`](docs/QUANTIS-PORTAL-AND-SURVEYLAB.md).

## Có gì mới (10/2026)

> Các tính năng trong mục này **đã chạy trên hệ thống hỗ trợ nghiên cứu khoa học dựa trên AI của Đại học Kinh tế Quốc dân từ 15/10/2026**. Mã nguồn hiện nằm ở nhánh `feat/dataprep-panel-glossary-20261015`, **chưa gộp vào `main`**.

- **Dữ liệu → Biến đổi** có thêm các thao tác chuẩn bị dữ liệu:
  - **Đổi tên biến (cột)**.
  - **Đổi loại biến**: văn bản → số (đọc được cả `6,84`, `1.234,5`, `1,234.5`; ô không đọc được để trống) hoặc số → văn bản (bỏ khoảng trắng thừa).
  - **Tính biến mới từ công thức**: tham chiếu cột bằng `[Tên cột]`, ví dụ `([Điểm 1] + [Điểm 2]) / 2`. Hỗ trợ `+ − * / ^` và các hàm `ln`, `log10`, `sqrt`, `abs`, `exp`, `round`, `mean`, `sum`, `min`, `max` (`mean/sum/min/max` bỏ qua ô thiếu; các phép tính khác gặp ô thiếu thì kết quả thiếu).
  - **Biến đổi log** (thêm cột mới): `ln(x)`, `log10(x)` (x phải > 0) hoặc `ln(1 + x)` (dùng khi có giá trị 0).
  - **Loại dòng có giá trị ngoại lai (quy tắc IQR)** với hệ số k tuỳ chọn (mặc định 1,5).
  - **Xoá dòng trùng lặp** (không chọn cột = so sánh mọi cột; giữ dòng xuất hiện đầu tiên).
  - Các thao tác sẵn có vẫn giữ nguyên: loại dòng thiếu, thay giá trị thiếu bằng mean/median/mode, lọc, sắp xếp, recode, chuẩn hoá min-max và z-score.
- **Phân tích → Dữ liệu bảng** (panel): chọn biến định danh đơn vị, biến thời gian, biến phụ thuộc (Y) và các biến độc lập (X); có thể tick **Thêm hiệu ứng thời gian**. Kết quả gồm tóm tắt cấu trúc dữ liệu (cân bằng / không cân bằng), thống kê mô tả overall / between / within, **OLS gộp (Pooled OLS)**, **Ảnh hưởng cố định (Fixed Effects)**, **Ảnh hưởng ngẫu nhiên (Random Effects, Swamy-Arora)** và **Kiểm định Hausman** (FE so với RE, kèm bảng so sánh hệ số).
  - **Giới hạn:** chỉ có **sai số chuẩn dạng cổ điển** — **chưa có** sai số chuẩn vững (robust) hay theo cụm (cluster). Nếu nghiên cứu cần các loại sai số này, hãy kiểm tra lại bằng phần mềm khác (Stata, R, Python `linearmodels`).
  - Cần backend Python (`backend-python`, `POST /api/quantis/analyze/panel`); nếu thiếu, giao diện báo «Phân tích dữ liệu bảng cần backend Python».
- **Chú giải thuật ngữ (i):** bấm biểu tượng (i) cạnh thuật ngữ để xem giải thích ngắn (bấm ra ngoài hoặc Esc để đóng). Đầu các tab Kiểm định, Hồi quy, Tương quan, Độ tin cậy, Nhân tố, Dữ liệu bảng có dải **«Giải thích thuật ngữ:»** (p-value, t-test, ANOVA, Cohen's d, hệ số hồi quy, R², VIF, Cronbach's alpha, KMO, Bartlett, EFA, FE/RE, Hausman, within/between…). Trong Biến đổi, (i) hiện khi chọn chuẩn hoá z-score hoặc loại ngoại lai IQR.

## Hướng dẫn sử dụng nhanh

1. **Chọn dữ liệu:** ở thanh bên trái, mục **Bộ dữ liệu (Import)** → **Tải file** hoặc thêm dataset mẫu, rồi bấm chọn một bộ dữ liệu.
2. **Kiểm tra và làm sạch:** tab **Dữ liệu** → **Xem dữ liệu**, **Sơ bộ** (thiếu, kiểu biến, độ lệch, ngoại lai), **Mô tả**.
3. **Biến đổi:** tab **Dữ liệu** → **Biến đổi** → chọn **Hành động**, điền thông tin → **Áp dụng**. Hệ thống hỏi **Biến đổi dữ liệu gốc** hay **Sinh file mới (dataset mới)**; nên chọn sinh file mới để giữ bản gốc.
4. **Phân tích:** tab **Phân tích** → chọn Kiểm định, Hồi quy, Tương quan, Độ tin cậy, Nhân tố, Dữ liệu bảng… Bấm (i) khi gặp thuật ngữ chưa rõ.
5. **Hỏi AI:** các tab phân tích và tab Biến đổi có khung hỏi AI về kết quả. AI chỉ gợi ý cách đọc kết quả; người nghiên cứu tự kiểm tra lại số liệu và kết luận.

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
- **Cấu hình kết nối (menu ⋮):** Kiểm tra Backend + LLM (vLLM), lưu URL; cuối cửa sổ có **Đặt lại ứng dụng** — xóa toàn bộ dữ liệu cục bộ (`quantis_*` trong localStorage, v.v.) như mới cài; nếu đang đăng nhập có thể ghi workspace rỗng lên server (có hộp thoại xác nhận).

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

Lưu `data/store.json` + tùy chọn auth file-based. Proxy Archive, LLM (vLLM, OpenAI-compatible; `/api/quantis/ollama/*` → `/v1/chat/completions`, `/v1/models`), parse-file → Python.

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
