# Quantis

**Quantis** là nền tảng phần mềm phân tích định lượng và thống kê được thiết kế cho môi trường nghiên cứu học thuật, giáo dục và phân tích dữ liệu ứng dụng. Ứng dụng kết hợp thống kê truyền thống, phân tích dữ liệu hiện đại và quy trình nghiên cứu có khả năng tái lập (reproducible research) trong một hệ sinh thái thống nhất. Có thể chạy độc lập (dữ liệu lưu localStorage) hoặc nhúng trong Research Portal (research.neu.edu.vn) với **backend** — khi đó datasets và workflows được lưu PostgreSQL và đồng bộ theo tài khoản đăng nhập.

## Mục tiêu và định vị

- Hỗ trợ nhà nghiên cứu xử lý dữ liệu định lượng từ cơ bản đến nâng cao.
- Giảm phụ thuộc vào nhiều công cụ rời rạc (SPSS, R, Excel…).
- Chuẩn hóa quy trình: **dữ liệu → mô hình → báo cáo → tái lập**.
- Tích hợp AI để gợi ý phương pháp thống kê và diễn giải kết quả.

**Định vị:** Statistical research platform thế hệ mới (AI-augmented statistical workspace).

## So sánh với công cụ khác

Quantis không thay thế trực tiếp SPSS, R, Stata hay JASP mà **bổ sung và định vị giữa** GUI dễ dùng và engine mạnh, với AI hỗ trợ phương pháp và reproducible research tích hợp sẵn.

| Công cụ | Đặc điểm chính | Đối tượng / lĩnh vực | Quantis kế thừa / bổ sung |
|--------|----------------|----------------------|---------------------------|
| **IBM SPSS Statistics** | Giao diện thân thiện, hơn 150 thủ tục thống kê; quản lý dữ liệu, missing data, mẫu phức tạp; hồi quy, GLM, survival, decision trees; tích hợp R/Python. | Khoa học xã hội, giáo dục, thị trường. | **GUI trực quan** + quy trình chuẩn (profiling → làm sạch → phân tích); **AI gợi ý** thay cho chỉ menu thủ công. |
| **R (programming language)** | Mã nguồn mở, ecosystem gói (tidyverse, v.v.), R Markdown/knitr cho reproducible research, literate programming. | Nghiên cứu học thuật, data science, sinh học. | **Reproducibility tích hợp** (workflow, versioning, audit); engine có thể **gọi R** phía sau nhưng **trừu tượng hóa qua UI**. |
| **Stata** | Mạnh về kinh tế lượng, panel/longitudinal (xt suite: fixed/random effects, Arellano-Bond, GEE, DiD), y sinh, survival. | Kinh tế, y tế công cộng, chính sách. | **Panel data & hồi quy nâng cao** trong Analysis Engine (multilevel, panel, SEM); workflow **chuẩn hóa** từ dữ liệu đến báo cáo. |
| **JASP** | Miễn phí, mã nguồn mở; **Bayesian + frequentist** không cần lập trình; meta-analysis, Bayes Factor, ML; giao diện hiện đại. | Giảng dạy, nghiên cứu tâm lý/xã hội. | **Bayesian** là lớp phân tích ngang hàng (như JASP); **AI diễn giải** kết quả và gợi ý phương pháp; **report học thuật** tự động. |

### Tóm tắt định vị Quantis

- **So với SPSS:** Cùng hướng thân thiện, dễ dùng; Quantis thêm workflow tái lập, AI gợi ý, và có thể tích hợp engine R/Python.
- **So với R:** Quantis hướng tới người muốn ít code hơn nhưng vẫn reproducible; có thể sinh script R từ workflow.
- **So với Stata:** Quantis hỗ trợ panel data, kinh tế lượng trong một nền tảng tổng thể (data → model → report); không thay thế Stata cho chuyên sâu econometrics.
- **So với JASP:** Cùng hướng Bayesian + classical, giao diện hiện đại; Quantis thêm AI, reproducibility end-to-end và tích hợp vào Research Portal.

## Kiến trúc bốn lớp

### 1. Data Layer – Quản lý dữ liệu

- Import từ CSV, Excel, SPSS, Stata, database, survey platforms.
- Data profiling tự động (missing values, outliers, distributions).
- Data transformation pipeline (lọc, chuẩn hóa, tạo biến).

### 2. Analysis Engine – Lõi thống kê

- Thống kê mô tả nâng cao, kiểm định giả thuyết (t-test, ANOVA, Chi-square, non-parametric…).
- Mô hình hồi quy và mô hình hóa (linear/logistic, multilevel, SEM, mediation/moderation).
- Machine learning cho nghiên cứu (classification, regression, feature importance, cross-validation).
- Bayesian analysis, simulation & resampling.

Engine có thể dựa trên R/Python nhưng được trừu tượng hóa qua giao diện trực quan.

### 3. Reproducibility Layer

- Lưu workflow phân tích.
- Sinh script tự động.
- Versioning dataset và model.
- Audit trail cho nghiên cứu.

### 4. Presentation Layer

- Visualization tương tác, publication-ready charts.
- Dashboard nghiên cứu.
- Report học thuật tự động (LaTeX, Word, PowerPoint).

## Workflow nghiên cứu tiêu chuẩn

1. Import dữ liệu  
2. Data profiling  
3. Làm sạch (missing, outlier, reliability & validity)  
4. Kiểm định giả thuyết  
5. Mô hình hóa  
6. Visualization  
7. Sinh báo cáo  
8. Lưu workflow tái lập  

## AI tích hợp

- Gợi ý phương pháp thống kê (vd. biến phụ thuộc nhị phân → logistic).
- Kiểm tra lỗi thiết kế nghiên cứu.
- Tóm tắt kết quả theo chuẩn bài báo, viết phần Results sơ bộ.
- Cảnh báo overfitting / misuse.

## Tính năng đã triển khai (frontend)

- **Data Layer:** Import CSV (parse client-side, tối đa 50k dòng), dataset mẫu; Data profiling (bảng missing, kiểu, min/max/mean/std); Biến đổi: loại bỏ dòng thiếu hoặc thay missing bằng mean (tạo dataset mới).
- **Analysis:** Thống kê mô tả (bảng N, mean, median, std, min, max; biểu đồ cột phân bố); t-test hai mẫu độc lập (Welch, Cohen d, form chọn biến nhóm + biến số).
- **Reproducibility:** Workflow: tạo workflow, thêm/xóa bước, xuất script R (sao chép); Versioning: placeholder cho audit trail.
- **Presentation:** Biểu đồ: chọn cột X, Y → scatter (hai cột số) hoặc cột (phân loại); Báo cáo: xuất HTML (dataset + thống kê mô tả).
- **AI:** Danh sách gợi ý cố định (logistic khi biến nhị phân, t-test, effect size, đa so sánh, overfitting). Mở rộng LLM khi có backend.

## Chạy và phát triển

### Chạy chỉ frontend (dev hoặc nhúng Portal)

```bash
cd AI-Apps/Quantis
npm install
npm run dev
```

Mở http://localhost:5173.

### Backend (khi nhúng trong Research Portal)

Backend Quantis nằm trong **AI-Portal**: schema PostgreSQL `quantis` và API `/api/quantis`. Khi mở Quantis từ Portal (cùng origin), frontend tự phát hiện backend và đồng bộ datasets/workflows theo tài khoản đăng nhập.

- **Migration:** Chạy `backend/migrations/quantis-tables.sql` trên database của Portal (sau khi đã có `ai_portal.users`).
- **Biến môi trường frontend (tùy chọn):** Nếu chạy frontend riêng nhưng gọi API Portal: `VITE_QUANTIS_API_URL=https://research.example.org`.

### Build và đóng gói cho Portal

- **Build:** `npm run build` (base `./`) hoặc `npm run build:basepath` (nhúng tại `/embed/quantis`).
- **Đóng gói zip:** `npm run pack` hoặc `npm run pack:basepath` → `dist/quantis-app-package.zip`. Upload trong Research Portal (Admin → Ứng dụng → Cài từ file .zip).

## Cấu trúc dự án

- **Frontend:** `src/App.tsx` (giao diện chính, 4 lớp + workflow + AI), `src/types.ts`, `src/store.ts`, `src/api.ts`, `src/embed-config.ts`, `src/portal-theme.ts`. `package/manifest.json` khai báo app cho Portal.
- **Backend:** Nằm trong AI-Portal: `AI-Portal/backend/migrations/quantis-tables.sql`, `src/routes/quantis.ts`. API `/api/quantis/health`, `/api/quantis/data` (GET/POST), CRUD `/api/quantis/datasets`, `/api/quantis/workflows`. Cần đăng nhập Portal để đồng bộ.

**Công nghệ:** React 18, TypeScript, Vite, Tailwind CSS 4, Lucide React, Recharts (frontend).

## Đối tượng người dùng

- Giảng viên, nghiên cứu sinh.
- Nhóm nghiên cứu liên ngành.
- Trung tâm khảo thí / khảo sát.
- Data analyst trong giáo dục, kinh tế, xã hội.
- Tổ chức làm evidence-based policy.
