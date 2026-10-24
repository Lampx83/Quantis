# Quantis

Quantitative analysis and statistics platform for research and education. Trên hệ thống nghiên cứu của Đại học Kinh tế Quốc dân (research.neu.edu.vn) công cụ này có tên tiếng Việt là **Phân tích định lượng** (alias `quantis`, mở tại `/embed/quantis`): quản lý và làm sạch dữ liệu, thống kê mô tả, kiểm định giả thuyết, hồi quy, SEM, học máy, trực quan hóa, workflow tái lập và trợ lý AI giải thích kết quả. Quantis chạy **chỉ frontend** (dữ liệu trong trình duyệt) hoặc với **`backend/`** — cùng package gồm **PostgreSQL** (khuyến nghị, giống SurveyLab) hoặc **JSON + proxy** (dev nhanh) — **schema `quantis`** trên DB AI Portal khi nhúng. AI chỉ hỗ trợ: các con số do Quantis tính, AI diễn giải và có thể sai nên cần kiểm chứng.

**Hai cách triển khai UI:** **Standalone** (tab trình duyệt / dev) dùng đăng nhập Quantis khi bật auth; **Embed AI Portal** nhận diện qua `__PORTAL_USER__`, `__WRITE_API_BASE__`, `embed-config.json`, URL `/embed/quantis`, hoặc `__QUANTIS_PORTAL_EMBED__` — không bắt form đăng nhập Node, đồng bộ `/data` theo header Portal. Chi tiết: [`docs/QUANTIS-DATABASE.md`](docs/QUANTIS-DATABASE.md) mục *Frontend: nhận biết embed*. So sánh triển khai với SurveyLab: [`docs/QUANTIS-PORTAL-AND-SURVEYLAB.md`](docs/QUANTIS-PORTAL-AND-SURVEYLAB.md).

### Tại sao chưa thấy màn hình đăng nhập?

Quantis **có** luồng giống SurveyLab (`/api/quantis/auth/register`, `login`, `me`, SSO OIDC, hộp thoại tài khoản) — **nhưng chỉ khi frontend kết nối được backend PostgreSQL** (`backend/` sau `npm run build && npm start`) và gọi được `GET …/auth/config` trả `authEnabled: true`.

| Tình huống | Kết quả |
|------------|---------|
| Chỉ chạy `npm run dev` (frontend), **không** có `VITE_QUANTIS_API_URL` / backend | Không đăng nhập — dữ liệu chỉ trên trình duyệt (`localStorage`). |
| Chạy **PostgreSQL backend** + `.env` có `VITE_QUANTIS_API_URL` trỏ đúng | **Standalone mặc định: bật auth + bắt buộc phiên** (trừ khi đặt `AUTH_REQUIRED=0` hoặc `AUTH_ENABLED=0` trong `backend/.env`). |
| Nhúng **AI Portal** | Không form Quantis — dùng tài khoản Portal + header `X-User-Id`. |

Xem thêm khối **Tài khoản & đăng nhập** trong menu **⋮ → Cấu hình kết nối** sau khi mở ứng dụng.

## Tính năng chính

Đối chiếu trực tiếp với bản chạy thật và mã nguồn (12/10/2026). Tên nút/tab dưới đây là tên trên giao diện tiếng Việt.

### Tab «Khám phá & biến đổi dữ liệu» (rút gọn: Dữ liệu)

- **Tải dữ liệu:** *Tải file* — CSV, TSV, JSON, TXT đọc ngay trong trình duyệt; Excel (.xlsx, .xls), ODS, SPSS (.sav), Stata (.dta), SAS (.sas7bdat), R (.rds, .RData) cần backend Python để đọc; *Thêm dataset mẫu* (bộ mẫu do quản trị viên quản lý trên server); *Lấy từ Archive NEU*.
- **Xem dữ liệu**, **Sơ bộ** (missing, kiểu cột, skewness, outlier IQR 1,5).
- **Mô tả:** thống kê mô tả (kèm CI 95% bootstrap), bảng tần suất, bảng chéo (crosstab), thống kê văn bản, đếm từ khóa, n-gram, Cohen's kappa, điểm ngoại lai IQR.
- **Biến đổi:** loại dòng thiếu, thay missing bằng mean / median / mode, chuẩn hóa z-score / min-max, lọc, sắp xếp, recode — kết quả là bộ dữ liệu mới.

### Tab «Phân tích thống kê» — 43 mục

| Nhóm | Mục | Số mục |
|------|-----|:------:|
| Tương quan | Pearson, Spearman, Kendall, ma trận hiệp phương sai, tương quan từng phần | 5 |
| Kiểm định | t-test độc lập / cặp / một mẫu, z-test hai trung bình, ANOVA 1 nhân tố (post-hoc Bonferroni), ANCOVA, MANOVA, MANCOVA, Mann-Whitney U, Wilcoxon cặp, Kruskal-Wallis, Friedman, Sign test, Chi-square, McNemar, Fisher exact, Binomial, Z-test hai tỉ lệ, Shapiro-Wilk, Levene, F-test hai phương sai, Power analysis (cỡ mẫu cho t-test, tỉ lệ, chi-square, ANOVA, hồi quy) | 22 |
| Độ tin cậy | Cronbach's alpha (kèm tương quan biến–tổng, alpha nếu loại biến) | 1 |
| Hồi quy | OLS (kèm VIF), Logistic, Poisson, Ridge | 4 |
| Nhân tố | EFA (PCA, varimax; KMO, Bartlett) | 1 |
| SEM | Mediation (nhiều M song song), Moderation, Path analysis, CFA, PLS-SEM | 5 |
| Học máy | K-means, phân loại đa lớp (One-vs-Rest logistic; confusion matrix, precision/recall/F1), feature importance, permutation importance | 4 |
| Bayesian | Beta-Binomial cho tỉ lệ (MCMC, Bayes Factor chưa có) | 1 |

Cộng với 9 công cụ ở nhóm **Mô tả** thì có **52** phương pháp; số «50 phương pháp» dùng trong tài liệu truyền thông là cách nói làm tròn xuống. Một số mục cần backend Python: ANCOVA / MANOVA / MANCOVA, F-test, z-test, Path analysis, CFA, PLS-SEM, hồi quy Poisson / Ridge.

### Các tab còn lại

- **Trực quan** — 13 loại biểu đồ: Cột, Đường, Phân tán, Histogram, Box plot, Heatmap tương quan, Tròn, Cột chồng, Cột ngang, Vùng, Donut, Density, Radar. Xuất: lưu PNG, sao chép biểu đồ vào clipboard, xuất CSV (ma trận tương quan).
- **AI hướng dẫn** — hỏi cách dùng Quantis, cách chọn phương pháp, cách báo cáo APA. Ngoài ra mọi màn kết quả có nút hỏi AI (*Giải thích ý nghĩa kết quả*, *Viết đoạn Kết quả theo APA*). Mô hình chạy qua vLLM nội bộ (xem mục *Trợ lý AI* bên dưới).
- **Workflows & tái lập** (menu ⋮) — lưu workflow theo các bước từ nhập dữ liệu đến báo cáo; nút *Sao chép khung script R* chỉ liệt kê các bước (chưa sinh mã R). Mục *Versioning & audit* **chưa có** chức năng (chỉ là trang thông báo).
- **Pre-reg & tái lập** (menu ⋮ → *Pre-reg & mở khoa học*) — pre-registration và checklist open science, đồng bộ `localStorage` với Writium (Đề cương nghiên cứu); *Xuất draft (HTML)*.
- **Cấu hình kết nối** (menu ⋮) — kiểm tra Backend (Node + Python) và vLLM, lưu URL; quản trị viên mới được lưu cấu hình dùng chung; cuối cửa sổ có **Đặt lại ứng dụng** (xóa dữ liệu cục bộ như mới cài, có hộp thoại xác nhận).
- **Mobile / màn hình nhỏ:** layout `100dvh`, safe-area, sidebar dạng overlay, thanh công cụ cuộn ngang.

### Chưa có

Báo cáo HTML / PDF / Word tự động (bản prototype cũ từng có, đã gỡ khi tách module), xuất bộ dữ liệu ra CSV, ANOVA hai nhân tố, hồi quy đa cấp, panel, chuỗi thời gian, MCMC / Bayes Factor, lịch sử phiên bản dữ liệu. Các hàm `analyzeAnovaTwoFactor*`, `analyzeMovingAverage`, `analyzeExponentialSmoothing`, `analyzeFourier`, `analyzeRankPercentile`, `analyzeRandomNumber`, `analyzeSampling` có trong `src/api.ts` và backend Python nhưng **chưa có giao diện**.

### Trợ lý AI (vLLM)

- Trình duyệt chỉ gọi backend Quantis: `…/api/quantis/ollama/v1/chat/completions` và `…/v1/models` (tên đường dẫn `ollama` được giữ để tương thích ngược; backend chuyển tiếp sang vLLM theo chuẩn OpenAI).
- Upstream: `ollamaUpstreamUrl` trong cấu hình dùng chung (admin) hoặc biến môi trường `OLLAMA_URL`; khóa gateway gửi qua header `x-ollama-seckey` (`OLLAMA_SECKEY` hoặc `ollamaSeckey`, không bao giờ trả lại ở GET `/settings`).
- Model mặc định: `qwen3.5-35b-a3b-int4` (tắt chế độ thinking); tên model kiểu Ollama cũ (`qwen2.5…`, `a:b`) tự đổi sang model này. **Embedding vẫn dùng Ollama** (`/ollama/api/embed`).
- Prompt hệ thống của «AI hướng dẫn» nằm ở khóa `aiAssistView.systemHintTask` trong `src/i18n.ts` (có bản đồ ứng dụng — cập nhật khi thêm/bớt mục giao diện).

### Cấu trúc mã nguồn (từ commit `767b027`)

`src/App.tsx` chỉ còn ~135 dòng; state dùng **Zustand** (`src/stores/`: data, analysis, ui, workflow, sync), chức năng theo module trong `src/features/` (`ai`, `analysis` + `tabs/`, `data`, `presentation`, `reproducibility`), khung giao diện `src/components/layouts/`, hộp thoại `src/components/modals/`, hook `src/hooks/` (`useServerSync`, `useURLSync`, `useAuthSession`), tiện ích `src/utils/` (`stats.ts`, `storage.ts`, `helpers.ts`), chuỗi giao diện song ngữ vi/en trong `src/i18n.ts`. Alias `@` → `src/`. Điều kiện đồng bộ workspace lên server là `canSyncToServer()` (`src/stores/useSyncStore.ts`): trên Portal chỉ tài khoản thật (không phải khách `@local`) mới được ghi.

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

**Build frontend:** `npm run build` — output in `public/`. Để đóng gói bản nhúng dùng `npm run build:pack` (ghi vào `dist/build`, không copy lại bundle cũ từ `public/`); bundle dùng base `./` (backend nhúng chèn `<base href>`), riêng bản nhúng ở Tuyển sinh build bằng `npm run build:basepath` (`EMBED_BASE_PATH`, xem `vite.config.ts`).

**Archive NEU:** With backend, app calls Archive via backend proxy (`/api/quantis/archive/*`).

**Gốc `npm start` (repo):** `concurrently` chạy Vite + **`npm run dev` trong `backend/`** = chế độ **JSON** (port 4001). Muốn song song **PostgreSQL**, chạy riêng `npm run dev:postgres` trong `backend/` (sau `npm run build`) và trỏ `VITE_QUANTIS_API_URL` tới 4003.
