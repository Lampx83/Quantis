# Rà soát & phương án thực hiện các tính năng “sẽ được bổ sung / tích hợp”

Tài liệu này liệt kê mọi vị trí trong Quantis đang dùng câu kiểu “sẽ được bổ sung” hoặc “tích hợp … sẽ”, và đề xuất phương án thực hiện cụ thể (client-side, backend R/Python, hoặc kết hợp).

---

## 1. Rà soát vị trí

| # | Vị trí (file: dòng) | Nội dung hiện tại | Tab / tính năng |
|---|----------------------|-------------------|------------------|
| 1 | `App.tsx:964` | “Tính năng sẽ được bổ sung trong bản cập nhật tới.” | **Phân tích** → tab **ML** và **Bayesian** (fallback khi không có view riêng) |
| 2 | `App.tsx:975` | “Tính năng sẽ được bổ sung trong bản cập nhật tới; …” | **Phân tích** → **Hồi quy & SEM** (phần mô tả đầu) |
| 3 | `App.tsx:1013` | “Module Hồi quy & SEM sẽ được bổ sung trong bản cập nhật tới …” | **Phân tích** → **Hồi quy & SEM** (khung “Tình trạng tích hợp”) |
| 4 | `App.tsx:1384` | “Phiên bản và nhật ký thay đổi sẽ hiển thị tại đây. (Tích hợp backend sẽ lưu lịch sử.)” | **Workflow** → **Versioning & audit** |
| 5 | `App.tsx:1650` | “Tích hợp AI sẽ được kết nối với backend / LLM khi triển khai.” | **Cài đặt** (hoặc mục tương đương) → **AI hỗ trợ phương pháp** |

**Tóm tắt:** Có **5** chỗ cần “thực hiện”: 2 tab phân tích (ML, Bayesian), 1 module Hồi quy & SEM, 1 tính năng Versioning & audit, 1 tính năng AI hỗ trợ.

---

## 2. Phương án thực hiện từng nhóm

### 2.1. Hồi quy & SEM (App.tsx:975, 1013)

**Mục tiêu:** Cho phép chạy hồi quy tuyến tính, logistic, (sau này) đa cấp/panel/SEM, xuất bảng hệ số, p-value, R², biểu đồ chẩn đoán.

**Phương án đề xuất (theo giai đoạn):**

| Giai đoạn | Nội dung | Cách làm | Ghi chú |
|-----------|----------|----------|--------|
| **1 – Client-side đơn giản** | Hồi quy tuyến tính OLS (một biến phụ thuộc, nhiều biến độc lập) | Implement trong `src/utils/stats.ts`: công thức OLS (matrix hoặc từng bước), R², SE, t, p-value, bảng hệ số. UI trong `RegressionExplainerView` hoặc component mới: chọn cột Y, chọn cột X, nút “Chạy OLS”, bảng kết quả + (tùy chọn) residual đơn giản. | Không cần R/Python. Có thể dùng thư viện JS (vd. `simple-statistics`, `ml-matrix`) nếu muốn. |
| **2 – Mở rộng client** | Hồi quy logistic (nhị phân) | Implement Newton-Raphson / IRLS trong `stats.ts` hoặc dùng thư viện JS (vd. `ml-logistic-regression`). UI: chọn biến Y nhị phân, chọn X, bảng hệ số, odds ratio, (tùy chọn) ROC/AUC đơn giản. | Vẫn 100% frontend. |
| **3 – Backend R/Python** | Đa cấp, panel, SEM, biểu đồ chẩn đoán đầy đủ | Backend (Node) nhận dataset + cấu hình (vd. dạng JSON), gọi **R** (script hoặc Rserve/OpenCPU) hoặc **Python** (subprocess với `statsmodels`/`sem`). Trả về JSON (hệ số, p-value, R², residuals, v.v.). Frontend gọi API `/api/quantis/regression` (hoặc tương tự), hiển thị bảng và đồ thị. | Cần cài R hoặc Python trên server; định nghĩa API request/response rõ ràng. |

**Kỹ thuật backend R/Python gợi ý:**

- **R:** Script R đọc CSV/JSON từ stdin hoặc file, chạy `lm()`, `glm()`, `lme4::lmer()`, `lavaan::sem()`, xuất kết quả JSON (vd. qua `jsonlite`).
- **Python:** Script dùng `pandas` + `statsmodels` (OLS, logistic), sau này thêm `sem` hoặc thư viện SEM. Xuất JSON.
- **Node backend:** `child_process.spawn('Rscript', ['run_regression.R', pathToCSV])` hoặc tương tự Python; đọc stdout/JSON file.

---

### 2.2. Machine learning (tab ML – App.tsx:964)

**Mục tiêu:** Classification, regression ML, feature importance, cross-validation (mức đơn giản).

**Phương án đề xuất:**

| Giai đoạn | Nội dung | Cách làm | Ghi chú |
|-----------|----------|----------|--------|
| **1 – Client-side** | Hồi quy tuyến tính (đã nói ở 2.1), K-means, có thể thêm Linear Regression / Logistic từ thư viện | Dùng **ml.js** (hoặc thư viện tương tự): `ML.Matrix`, K-means, regression. UI: chọn loại mô hình (OLS, K-means), chọn cột, nút “Chạy”, hiển thị kết quả (hệ số / centroids, RSS, v.v.). | Không cần backend. |
| **2 – Client nâng cao** | Feature importance (đơn giản: hệ số chuẩn hóa, hoặc permutation), train/test split, RMSE/accuracy đơn giản | Implement trong TS hoặc dùng ml.js. Hiển thị bảng “importance” và 1–2 chỉ số đánh giá. | Vẫn chỉ frontend. |
| **3 – Backend (tùy chọn)** | Random forest, XGBoost, cross-validation phức tạp, pipeline chuẩn | API backend gọi Python (sklearn) hoặc R (caret/randomForest). Frontend gửi dataset + cấu hình, nhận JSON kết quả. | Giống kiến trúc 2.1 giai đoạn 3. |

---

### 2.3. Bayesian (tab Bayesian – App.tsx:964)

**Mục tiêu:** Suy luận Bayesian đơn giản, posterior, so sánh mô hình (mức cơ bản).

**Phương án đề xuất:**

| Giai đoạn | Nội dung | Cách làm | Ghi chú |
|-----------|----------|----------|--------|
| **1 – Client-side đơn giản** | Ước lượng tỉ lệ (proportion) với prior Beta: posterior Beta, khoảng tin cậy (credible interval). Có thể thêm: so sánh hai tỉ lệ (Beta-Binomial). | Implement trong `stats.ts`: Beta posterior, quantile. UI: nhập (hoặc chọn từ dữ liệu) số “thành công” và n, chọn prior (Beta), hiển thị posterior và khoảng. | Không cần R/Python. |
| **2 – Client mở rộng** | Normal mean với prior chuẩn (conjugate): posterior mean/variance, credible interval | Công thức conjugate chuẩn trong TS. UI tương tự. | Vẫn 100% frontend. |
| **3 – Backend R/Python** | MCMC (JAGS/Stan qua R, hoặc PyMC), Bayes Factor, mô hình phức tạp | Backend gọi R (vd. `rstan`, `runjags`) hoặc Python (`pymc`). API nhận dữ liệu + mô hình (hoặc preset), trả về samples hoặc thống kê tóm tắt (JSON). Frontend vẽ posterior (histogram/density). | Giống kiến trúc 2.1 giai đoạn 3. |

---

### 2.4. Versioning & audit (App.tsx:1384)

**Mục tiêu:** Phiên bản dataset/workflow và nhật ký thay đổi; backend lưu lịch sử.

**Phương án đề xuất:**

| Thành phần | Cách làm | Ghi chú |
|------------|----------|--------|
| **Frontend** | Trong màn Versioning & audit: gọi API `GET /api/quantis/versions` (hoặc `/api/quantis/audit`) nếu backend có. Hiển thị danh sách phiên bản / log (dataset id, workflow id, thời gian, mô tả thay đổi). Khi backend không có: hiển thị “Chưa có lịch sử. Kết nối backend để lưu version.” (hoặc tương tự, không dùng “sẽ được tích hợp R/Python”). | Đồng bộ với `api.ts`: đã có `getData`/`saveData`; có thể mở rộng payload hoặc endpoint. |
| **Backend** | Mỗi lần `saveData` (hoặc endpoint riêng “save version”): lưu bản snapshot (datasets/workflows) kèm timestamp, user id (nếu có), optional message. Bảng DB: `quantis_versions` (id, user_id, created_at, payload JSON hoặc ref, message). Endpoint `GET /api/quantis/versions?datasetId=...` trả về lịch sử. | Có thể dùng PostgreSQL/MySQL hoặc file-based (JSON theo thư mục) tùy hạ tầng hiện tại. |

**Lưu ý:** Đoạn “Tích hợp backend sẽ lưu lịch sử” nên đổi thành mô tả rõ: “Lịch sử phiên bản được lưu khi kết nối backend.” và triển khai API như trên, không cần R/Python.

---

### 2.5. AI hỗ trợ phương pháp (App.tsx:1650)

**Mục tiêu:** Gợi ý phương pháp thống kê, kiểm tra thiết kế nghiên cứu, tóm tắt kết quả, viết Results sơ bộ; kết nối backend/LLM.

**Phương án đề xuất:**

| Thành phần | Cách làm | Ghi chú |
|------------|----------|--------|
| **Frontend** | Nút “Gợi ý” / ô nhập ngữ cảnh (dataset đang chọn, loại biến, câu hỏi nghiên cứu). Gọi `POST /api/quantis/ai/suggest` (hoặc proxy tới service LLM) với payload { datasetSummary, question, currentAnalysis }. Hiển thị câu trả lời (markdown hoặc text). | Khi chưa có backend: ẩn nút hoặc hiển thị “Kết nối backend để bật gợi ý AI.” (tránh câu “sẽ được kết nối … khi triển khai” nếu muốn nhất quán). |
| **Backend** | Endpoint nhận request, gọi LLM (OpenAI API, local LLM, hoặc gateway nội bộ). Có thể thêm role/system prompt chuẩn cho “phương pháp thống kê / nghiên cứu”. Trả về nội dung gợi ý. | Không dùng R/Python cho phần “AI”; chỉ cần HTTP đến LLM. |

---

## 3. Thứ tự ưu tiên gợi ý

1. **Hồi quy OLS (client)** – Dùng nhiều, dễ triển khai trong `stats.ts` + UI, không phụ thuộc backend.
2. **Versioning & audit (backend + frontend)** – Mở rộng API hiện có (`/data` hoặc endpoint mới), lưu snapshot, frontend gọi và hiển thị; không liên quan R/Python.
3. **ML đơn giản (client)** – K-means + OLS/Logistic từ ml.js (hoặc tương đương), gắn vào tab ML.
4. **Bayesian cơ bản (client)** – Beta-Binomial, Normal-Normal trong `stats.ts`, gắn vào tab Bayesian.
5. **Hồi quy logistic (client)** – Sau OLS, bổ sung logistic trong `stats.ts` hoặc thư viện.
6. **Hồi quy & SEM nâng cao (backend R/Python)** – Khi cần đa cấp, panel, SEM; định nghĩa API và script R/Python.
7. **AI (backend LLM)** – Khi đã có backend và quyết định LLM; chỉ cần endpoint + gọi API LLM.

---

## 4. Tóm tắt thay đổi văn bản UI (sau khi làm)

- **App.tsx:964** (tab ML/Bayesian): Thay bằng nội dung thực tế (vd. form chọn mô hình + kết quả) hoặc giữ “Tính năng sẽ được bổ sung trong bản cập nhật tới.” cho đến khi triển khai xong.
- **App.tsx:975, 1013**: Khi đã có OLS (và sau này logistic) trong UI: đổi “sẽ được bổ sung” thành mô tả “Hiện có: OLS, Logistic. Đa cấp, panel, SEM sẽ được bổ sung trong bản cập nhật tới.” (hoặc tương tự).
- **App.tsx:1384**: Đổi thành “Lịch sử phiên bản hiển thị khi kết nối backend.” và khi có API versions thì hiển thị danh sách thật.
- **App.tsx:1650**: Đổi thành “Gợi ý AI có khi bật backend và cấu hình LLM.” (hoặc ẩn dòng khi chưa có backend).

Sau khi triển khai từng bước, có thể xóa hoặc cập nhật các câu “sẽ được bổ sung” / “sẽ được tích hợp” cho đúng với tính năng đã làm.
