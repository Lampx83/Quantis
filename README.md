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

Đối chiếu với mã nguồn và kiểm thử trên nhánh `main` (commit `a646810`, 25/10/2026); tên nút/tab dưới đây là tên trên giao diện tiếng Việt. Danh sách đầy đủ theo 10 nhóm chức năng: [`docs/FEATURES.md`](docs/FEATURES.md).

### Tab «Khám phá & biến đổi dữ liệu» (rút gọn: Dữ liệu)

- **Tải dữ liệu:** *Tải file* — CSV, TSV, JSON, TXT đọc ngay trong trình duyệt; Excel (.xlsx, .xls; chỉ sheet đầu), ODS, SPSS (.sav), Stata (.dta), SAS (.sas7bdat), R (.rds, .RData) cần backend Python để đọc; *Thêm dataset mẫu* (bộ mẫu do quản trị viên quản lý trên server); *Lấy từ Archive NEU*. Mỗi bộ dữ liệu giữ tối đa 50.000 dòng; phân tích qua Python tối đa 100.000 dòng (đổi bằng `QUANTIS_ANALYSIS_MAX_ROWS`).
  - File văn bản: Quantis dò dấu phân cách (`,` / `;` / tab) theo mẫu dữ liệu và đổi số thập phân dấu phẩy («3,5») thành 3.5 ở cột thuần số, rồi báo ngắn ở thông báo nổi để người dùng kiểm tra lại bảng.
  - File SPSS/Stata/SAS: lấy cả nhãn biến, nhãn giá trị, mã khuyết (rời rạc và khoảng kiểu SPSS), thang đo, căn lề từ metadata của file. Excel/ODS/R không có metadata nên Quantis tự suy ra.
- **Xem dữ liệu** có hai chế độ, chuyển bằng thanh dưới cùng (kiểu SPSS):
  - *Xem Dữ liệu* (Data View): lưới sửa trực tiếp (Enter/F2 hoặc nhấp đúp để sửa, phím mũi tên, dán nhiều ô từ Excel), thêm/chèn/xóa dòng và biến, đổi tên biến, sắp xếp, lọc nhanh, phân trang 20/50/100/200 dòng, nút *Nhãn Giá trị* bật/tắt hiển thị nhãn thay cho mã. Ô khuyết được tô hồng nhạt; ô trong **cột kiểu số** mà không phải số hợp lệ được tô vàng kèm biểu tượng ⚠ (cảnh báo, không chặn nhập).
  - *Xem Biến số* (Variable View): bảng thuộc tính từng biến — Tên biến, Kiểu (Numeric/String/Date), Độ rộng, Thập phân, Nhãn biến số, **Nhãn giá trị**, **Giá trị khuyết**, Căn lề, **Thang đo** (Scale/Ordinal/Nominal; biến String không được là Scale). Có tìm theo tên/nhãn, thêm/xóa biến. Hộp thoại Nhãn giá trị có mẫu nhanh (Likert 5 mức, giới tính, nhị phân). Hộp thoại Giá trị khuyết cho khai báo tối đa 3 mã rời rạc, hoặc một khoảng số (gồm hai đầu, vd 98–99) kèm tối đa 1 mã rời rạc; biến chuỗi chỉ dùng mã rời rạc.
  - Kiểu và thang đo được tự đoán lúc nạp: cột có ≥ 90% ô là số → Numeric (≤ 7 giá trị khác nhau → Ordinal, còn lại Scale); chỉ đoán *Date* khi ≥ 90% ô khớp định dạng ngày thật (`yyyy-mm-dd`, `dd/mm/yyyy`, `12 Jan 2024`…), mã dạng «S-01», «2024-A» không bị nhận nhầm là ngày. Sửa lại được ở Variable View.
  - **Mã khuyết đã khai báo được loại khỏi mọi phép tính** (mọi tab phân tích, biểu đồ, bảng Sơ bộ/Mô tả, dữ liệu gửi sang Python) nhưng dữ liệu gốc vẫn giữ mã (vd 99) để xem và sửa. *Nhãn giá trị* hiện chỉ dùng để hiển thị ở lưới dữ liệu, chưa áp vào bảng kết quả hay biểu đồ; *Thang đo* hiện chỉ chi phối cách điền khuyết (chưa dùng để gợi ý kiểm định/biểu đồ).
- **Sơ bộ** (missing, kiểu cột, skewness, outlier IQR 1,5) và **Mô tả** có thêm cột **Không phải số**: đếm riêng ô sai kiểu trong cột số (chữ «bốn», «N/A», số dấu phẩy «3,5»). Các ô này bị bỏ qua khi tính, **không** tính vào Missing và không vào N hợp lệ.
- **Mô tả:** thống kê mô tả (kèm CI 95% bootstrap), bảng tần suất, bảng chéo (crosstab), thống kê văn bản, đếm từ khóa, n-gram, Cohen's kappa, điểm ngoại lai IQR.
- **Biến đổi** (sau mỗi thao tác Quantis hỏi *Biến đổi dữ liệu gốc* hay tạo bộ dữ liệu mới):
  - Xử lý khuyết: loại dòng thiếu; thay bằng mean / median / mode (biến không phải Scale sẽ tự dùng mốt và có báo trước); **hot-deck** (láng giềng gần nhất, chạy trên trình duyệt); **MICE** (cần backend Python, xem *Giới hạn* bên dưới).
  - Chuẩn hóa z-score / min-max, lọc, sắp xếp, recode.
  - Chuẩn bị dữ liệu thứ cấp: đổi tên biến; đổi kiểu văn bản ↔ số (đọc được «6,84», «1.234,5», «12%»); **tính biến mới từ công thức** (`[Tên cột]`, `+ − * / ^`, `ln log10 sqrt abs exp round mean sum min max`; chưa có hàm điều kiện IF); biến đổi log (thêm cột mới); loại dòng ngoại lai theo IQR; xóa dòng trùng (giữ dòng đầu).

### Tab «Phân tích thống kê» — 44 mục

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
| Dữ liệu bảng | Mô tả tổng thể / giữa các đơn vị / trong từng đơn vị; OLS gộp, Fixed Effects, Random Effects (Swamy-Arora), kiểm định Hausman; tùy chọn hiệu ứng thời gian | 1 |

Cộng với 9 công cụ ở nhóm **Mô tả** thì có **53** phương pháp; số «50 phương pháp» dùng trong tài liệu truyền thông là cách nói làm tròn xuống. Một số mục cần backend Python: ANCOVA / MANOVA / MANCOVA, z-test hai trung bình, Path analysis, CFA, PLS-SEM, hồi quy Poisson / Ridge, Dữ liệu bảng, MICE. F-test hai phương sai chạy ngay trong trình duyệt. ANOVA 1 nhân tố, F-test và t-test hai mẫu nhận **nhiều cột** (mỗi cột là một nhóm) và trình bày bảng kiểu Excel.

**Dữ liệu bảng (panel):** chọn biến đơn vị, biến thời gian, biến phụ thuộc và các biến độc lập; chạy trên backend Python. Sai số chuẩn dạng cổ điển (chưa có cluster/robust), từ chối dữ liệu có cặp (đơn vị, thời gian) trùng. Kết quả đã đối chiếu với `linearmodels` 7.1 và `statsmodels` (sai khác < 1e-11, panel cân bằng và không cân bằng) — xem *Kiểm thử & CI*.

### Các tab còn lại

- **Trực quan** — 13 loại biểu đồ: Cột, Đường, Phân tán, Histogram, Box plot, Heatmap tương quan, Tròn, Cột chồng, Cột ngang, Vùng, Donut, Density, Radar. Xuất: lưu PNG, sao chép biểu đồ vào clipboard, xuất CSV (ma trận tương quan).
- **AI hướng dẫn** — hỏi cách dùng Quantis, cách chọn phương pháp, cách báo cáo APA. Ngoài ra mọi màn kết quả có nút hỏi AI (*Giải thích ý nghĩa kết quả*, *Viết đoạn Kết quả theo APA*). Mô hình chạy qua vLLM nội bộ (xem mục *Trợ lý AI* bên dưới).
- **Chú giải thuật ngữ (i)** — dải «Giải thích thuật ngữ» ở các tab Tương quan, Kiểm định, Độ tin cậy, Hồi quy, Nhân tố, Dữ liệu bảng, và biểu tượng (i) cạnh p-value, VIF, Cohen's d, z-score, IQR, «Không phải số»…: bấm để xem giải thích ngắn (23 thuật ngữ, song ngữ vi/en, trong `src/i18n-extra.ts`).
- **Workflows & tái lập** (menu ⋮) — lưu workflow theo các bước từ nhập dữ liệu đến báo cáo; nút *Sao chép khung script R* chỉ liệt kê các bước (chưa sinh mã R). Mục *Versioning & audit* **chưa có** chức năng (chỉ là trang thông báo).
- **Pre-reg & tái lập** (menu ⋮ → *Pre-reg & mở khoa học*) — pre-registration và checklist open science, đồng bộ `localStorage` với Writium (Đề cương nghiên cứu); *Xuất draft (HTML)*.
- **Cấu hình kết nối** (menu ⋮) — kiểm tra Backend (Node + Python) và vLLM, lưu URL; quản trị viên mới được lưu cấu hình dùng chung; cuối cửa sổ có **Đặt lại ứng dụng** (xóa dữ liệu cục bộ như mới cài, có hộp thoại xác nhận).
- **Mobile / màn hình nhỏ:** layout `100dvh`, safe-area, sidebar dạng overlay, thanh công cụ cuộn ngang.

### Giới hạn hiện tại

- **MICE chưa phải đa nhập liệu (multiple imputation):** `IterativeImputer` + BayesianRidge điền **một** bộ dữ liệu tất định (số vòng lặp 1–50, mặc định 10; giá trị điền kẹp trong khoảng min–max quan sát), nên sai số chuẩn tính sau đó có thể hơi nhỏ. Chưa chạy m lần và gộp theo luật Rubin ([issue #8](https://github.com/Lampx83/Quantis/issues/8)).
- **Mã khuyết `.a`–`.z` của Stata/SAS chưa kiểm bằng file thật:** `parse_file.py` bật `user_missing=True` cho `.dta`/`.sas7bdat`; mã khuyết SPSS (rời rạc và khoảng) đã có test, còn dạng tagged-missing thì chưa ([issue #10](https://github.com/Lampx83/Quantis/issues/10)).
- **Hot-deck/MICE trên dữ liệu rất lớn:** hot-deck chạy trên luồng chính của trình duyệt (20.000 dòng xong trong vài giây theo test hiệu năng; trần 1.000 người cho/ô); với hơn ~100.000 dòng nên chuyển sang Web Worker, và còn một số chỗ `Math.min(...mảng)` có thể tràn ngăn xếp khi mảng ~100.000 phần tử ([issue #12](https://github.com/Lampx83/Quantis/issues/12)).
- Bảng kết quả và biểu đồ chưa hiển thị nhãn giá trị; thang đo chưa được dùng để gợi ý kiểm định.

### Chưa có

Báo cáo HTML / PDF / Word tự động (bản prototype cũ từng có, đã gỡ khi tách module), xuất bộ dữ liệu ra CSV, gộp/nối bảng, hàm điều kiện trong công thức biến mới, ANOVA hai nhân tố, hồi quy đa cấp, chuỗi thời gian, sai số chuẩn cluster/robust cho panel, MCMC / Bayes Factor, lịch sử phiên bản dữ liệu. Các hàm `analyzeAnovaTwoFactor*`, `analyzeMovingAverage`, `analyzeExponentialSmoothing`, `analyzeFourier`, `analyzeRankPercentile`, `analyzeRandomNumber`, `analyzeSampling` có trong `src/api.ts` và backend Python nhưng **chưa có giao diện**.

### Trợ lý AI (vLLM)

- Trình duyệt chỉ gọi backend Quantis: `…/api/quantis/ollama/v1/chat/completions` và `…/v1/models` (tên đường dẫn `ollama` được giữ để tương thích ngược; backend chuyển tiếp sang vLLM theo chuẩn OpenAI).
- Upstream: `ollamaUpstreamUrl` trong cấu hình dùng chung (admin) hoặc biến môi trường `OLLAMA_URL`; khóa gateway gửi qua header `x-ollama-seckey` (`OLLAMA_SECKEY` hoặc `ollamaSeckey`, không bao giờ trả lại ở GET `/settings`). Các địa chỉ nội bộ (`aiApiUrl`, `ollamaUpstreamUrl`) cũng chỉ trả cho quản trị viên (Portal gắn `X-User-Is-Admin`); người dùng thường chỉ thấy cờ `ollamaUpstreamSet` / `ollamaSeckeySet`.
- Model mặc định: `qwen3.5-35b-a3b-int4` (tắt chế độ thinking); tên model kiểu Ollama cũ (`qwen2.5…`, `a:b`) tự đổi sang model này. **Embedding vẫn dùng Ollama** (`/ollama/api/embed`).
- Prompt hệ thống của «AI hướng dẫn» nằm ở khóa `aiAssistView.systemHintTask` trong `src/i18n.ts` (có bản đồ ứng dụng — cần cập nhật khi thêm/bớt mục giao diện; hiện bản đồ này **chưa** nhắc tới Variable View, tab Dữ liệu bảng và các thao tác chuẩn bị dữ liệu thứ cấp).

### Cấu trúc mã nguồn (sau refactor Zustand, PR #1)

`src/App.tsx` chỉ còn ~135 dòng; state dùng **Zustand** (`src/stores/`: data, analysis, ui, workflow, sync), chức năng theo module trong `src/features/` (`ai`, `analysis` + `tabs/`, `data` + `grid/` cho Data View/Variable View, `presentation`, `reproducibility`), khung giao diện `src/components/layouts/`, hộp thoại `src/components/modals/`, hook `src/hooks/` (`useServerSync`, `useURLSync`, `useAuthSession`), tiện ích `src/utils/` (`stats.ts`, `metadata.ts` — metadata biến và mã khuyết, `missing-imputation.ts`, `dataPrep.ts`, `sanitize.ts`, `storage.ts`, `helpers.ts`), chuỗi giao diện song ngữ vi/en trong `src/i18n.ts` và `src/i18n-extra.ts`. Alias `@` → `src/`. Điều kiện đồng bộ workspace lên server là `canSyncToServer()` (`src/stores/useSyncStore.ts`): trên Portal chỉ tài khoản thật (không phải khách `@local`) mới được ghi. Mọi phép tính phải lấy dữ liệu qua `getAnalysisRows()` (`src/utils/stats.ts`) để mã khuyết đã khai báo bị loại; `getDataRows()` chỉ dành cho lưới dữ liệu và các thao tác sửa giá trị (có test canh giữ).

### Kiểm thử & CI

```bash
npm test               # vitest: 173 test / 14 tệp (25/10/2026)
npm run typecheck      # tsc "ratchet": không cho vượt số lỗi tồn đọng, hiện ngưỡng 45 (scripts/check-tsc.mjs)
cd backend-python && pip install -r requirements.txt -r requirements-dev.txt && pytest   # 26 test
```

- Workflow `.github/workflows/ci.yml` chạy khi mở PR vào `main` và khi push `main`: **frontend** (`npm ci`, `typecheck`, `vitest`, `build`, `build:pack`), **backend-python** (`pytest`, Python 3.11), **backend-node** (`npm ci` + `tsc` trong `backend/`).
- Workflow `.github/workflows/push-dockerhub.yml` (push `main` hoặc chạy tay) build và đẩy hai image lên Docker Hub: `lampx83/quantis-backend` và `lampx83/quantis-python` (tag `latest`; cần secrets `DOCKERHUB_USER`, `DOCKERHUB_TOKEN`). Xem [`docs/DEPLOY-PORTAINER.md`](docs/DEPLOY-PORTAINER.md).
- Lưu ý: hai test đối chiếu panel với `linearmodels` (`backend-python/tests/test_panel.py`) tự bỏ qua khi chưa cài `linearmodels`, mà thư viện này **chưa nằm trong** `requirements-dev.txt` nên CI **không** chạy phần đối chiếu đó (chỉ chạy ví dụ tính tay và kiểm tra trùng cặp). Muốn chạy: `pip install linearmodels` rồi `pytest tests/test_panel.py`.

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

**Build frontend:** `npm run build` — output in `public/`. Để đóng gói bản nhúng dùng `npm run build:pack` (ghi vào `dist/build`, không copy lại bundle cũ từ `public/`) hoặc `npm run pack:build` (build rồi nén thành `dist/quantis-app-package.zip` để cài từ Admin của AI Portal); bundle dùng base `./` (backend nhúng chèn `<base href>`), riêng bản nhúng ở Tuyển sinh build bằng `npm run build:basepath` (`EMBED_BASE_PATH`, xem `vite.config.ts`; đóng gói bằng `npm run pack:basepath`).

**Archive NEU:** With backend, app calls Archive via backend proxy (`/api/quantis/archive/*`).

**Gốc `npm start` (repo):** `concurrently` chạy Vite + **`npm run dev` trong `backend/`** = chế độ **JSON** (port 4001). Muốn song song **PostgreSQL**, chạy riêng `npm run dev:postgres` trong `backend/` (sau `npm run build`) và trỏ `VITE_QUANTIS_API_URL` tới 4003.
