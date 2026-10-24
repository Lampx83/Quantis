# Đối chiếu tính năng Quantis với 10 nhóm chức năng

Tài liệu đối chiếu danh sách 10 nhóm tính năng của một ứng dụng phân tích định lượng với **trạng thái thật** của Quantis. Cập nhật 12/10/2026 sau khi kiểm chứng trên bản chạy thật (research.neu.edu.vn/embed/quantis) và đọc mã nguồn (cấu trúc module từ commit `767b027`). Tên nút/tab là tên trên giao diện tiếng Việt.

Ký hiệu: ✅ có trên giao diện · ⚙️ có nhưng cần backend Python · ❌ chưa có.

---

## 1. Quản lý và xử lý dữ liệu

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Nhập CSV, TSV, JSON, TXT | ✅ | Đọc trực tiếp trong trình duyệt (nút *Tải file*) |
| Nhập Excel, ODS, SPSS, Stata, SAS, R | ⚙️ | `.xlsx .xls .ods .sav .dta .sas7bdat .rds .RData`; máy chủ Python đọc file |
| Nhập từ kho Archive NEU | ✅ | Nút *Lấy từ Archive NEU* |
| Dataset mẫu | ✅ | Nút *Thêm dataset mẫu*; bộ mẫu do quản trị viên quản lý trên server |
| Làm sạch missing | ✅ | Loại dòng thiếu; thay bằng mean / median / mode (tab *Biến đổi*) |
| Phát hiện outlier | ✅ | IQR 1,5 ở tab *Sơ bộ* và *Mô tả* |
| Biến đổi | ✅ | Chuẩn hóa z-score, min-max; recode; kết quả là bộ dữ liệu mới |
| Lọc, sắp xếp | ✅ | Tab *Biến đổi* |
| Tính biến mới (compute), biến giả | ❌ | |
| Gộp / nối bảng | ❌ | |
| Panel, chuỗi thời gian | ❌ | |
| Xuất bộ dữ liệu ra CSV | ❌ | Bản prototype cũ có, bị mất khi tách module |

---

## 2. Thống kê mô tả

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Trung bình, trung vị, độ lệch chuẩn, Q25/Q75, P10/P90, min/max, kurtosis | ✅ | Tab *Mô tả*; nút *Sao chép bảng* |
| CI 95% bootstrap cho trung bình | ✅ | Lấy mẫu có hoàn lại 2000 lần |
| Bảng tần suất | ✅ | 1 biến |
| Bảng chéo (crosstab) | ✅ | 2 biến phân loại |
| Phân bố, skewness, missing | ✅ | Tab *Sơ bộ*; histogram, box plot ở tab *Trực quan* |
| Thống kê văn bản, đếm từ khóa, n-gram (bigram / trigram) | ✅ | Công cụ định tính cơ bản |
| Cohen's kappa (độ đồng thuận giữa hai coder) | ✅ | |
| Điểm ngoại lai IQR | ✅ | |

---

## 3. Thống kê suy luận — tab *Phân tích thống kê* → *Kiểm định* (22 mục)

| Nhóm | Mục | Trạng thái |
|------|-----|-----------|
| So sánh trung bình | t-test độc lập (Welch / equal variance), t-test cặp, t-test một mẫu, z-test hai trung bình | ✅ (z-test cần Python) |
| ANOVA | ANOVA 1 nhân tố (η², ω², post-hoc từng cặp hiệu chỉnh Bonferroni), ANCOVA, MANOVA, MANCOVA | ✅ (ANCOVA/MANOVA/MANCOVA cần Python) |
| Phi tham số | Mann-Whitney U, Wilcoxon cặp, Kruskal-Wallis, Friedman, Sign test | ✅ |
| Biến phân loại / tỉ lệ | Chi-square độc lập (Phi, Cramér's V, OR + CI khi 2×2), McNemar, Fisher exact, Binomial, Z-test hai tỉ lệ | ✅ |
| Giả định | Shapiro-Wilk, Levene, F-test hai phương sai | ✅ (F-test cần Python) |
| Cỡ mẫu / power | Power analysis cho t-test, tỉ lệ, chi-square, ANOVA, hồi quy | ✅ |
| Post-hoc Tukey | ❌ | Post-hoc sau ANOVA chỉ có Bonferroni |
| ANOVA hai nhân tố | ❌ | Hàm API có (`analyzeAnovaTwoFactor*`) nhưng chưa có giao diện |
| Thống kê Bayes | ✅ | Beta-Binomial cho tỉ lệ (tab *Bayesian*); MCMC, Bayes Factor chưa có |

---

## 4. Hồi quy và kinh tế lượng

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Hồi quy tuyến tính OLS | ✅ | Hệ số, SE, t, p-value, R², VIF |
| Hồi quy logistic nhị phân | ✅ | Odds ratio |
| Hồi quy Poisson | ⚙️ | Y là biến đếm; IRR = exp(β) |
| Hồi quy Ridge (L2) | ⚙️ | Tham số alpha |
| Logistic đa lớp (multinomial) | ❌ | Phân loại đa lớp có ở tab *Học máy* (One-vs-Rest) |
| Panel, time series, survival | ❌ | |
| Đa cấp (multilevel / mixed) | ❌ | |

---

## 5. Phân tích đa biến

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| EFA | ✅ | PCA + xoay varimax, KMO, Bartlett (tab *Nhân tố*) |
| Cronbach's alpha | ✅ | Kèm tương quan biến–tổng hiệu chỉnh, alpha nếu loại biến (tab *Độ tin cậy*) |
| CFA, Path analysis, PLS-SEM | ⚙️ | Tab *SEM*; CFA qua semopy |
| Mediation, Moderation | ✅ | Mediation nhiều M song song; chuỗi M₁→M₂ dùng Path analysis |
| Cluster analysis | ✅ | K-means (tab *Học máy*) |
| Discriminant analysis | ❌ | |

---

## 6. Trực quan hóa dữ liệu — 13 loại biểu đồ

Cột, Đường, Phân tán, Histogram, Box plot, Heatmap tương quan, Tròn, Cột chồng, Cột ngang, Vùng, Donut, Density, Radar. Tính năng kèm theo: lưu PNG, sao chép biểu đồ vào clipboard, xuất CSV ma trận tương quan, hỏi AI về biểu đồ (caption, insight). Dashboard nhiều biểu đồ: ❌.

---

## 7. Phân tích nâng cao

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Machine learning | ✅ | K-means; phân loại đa lớp One-vs-Rest logistic (confusion matrix, precision / recall / F1); feature importance; permutation importance |
| Text mining | Cơ bản | Thống kê văn bản, đếm từ khóa, n-gram |
| Mô phỏng, big data | ❌ | |

---

## 8. Tái lập và tự động hóa

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Workflow phân tích | ✅ | Menu ⋮ → *Workflows & tái lập*; các bước import → báo cáo, thêm / xóa bước |
| Script R | Khung | Nút *Sao chép khung script R* chỉ liệt kê các bước kèm dòng `TODO` (chưa sinh mã R thật) |
| Pre-registration, checklist open science | ✅ | Menu ⋮ → *Pre-reg & mở khoa học*; *Xuất draft (HTML)*; dùng chung đề cương với Writium |
| Versioning, audit trail | ❌ | Mục *Versioning & audit* chỉ là trang thông báo |
| Pipeline xử lý dữ liệu | Cơ bản | Mỗi phép biến đổi tạo bộ dữ liệu mới |

---

## 9. Mở rộng và tích hợp

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Lưu workspace lên server theo tài khoản | ✅ | Chỉ khi đăng nhập (khách chỉ lưu trong trình duyệt) |
| Archive NEU | ✅ | Proxy tìm kiếm và tải file |
| Trợ lý AI | ✅ | vLLM qua backend (`/api/quantis/ollama/v1`), model `qwen3.5-35b-a3b-int4`; AI chỉ giải thích, cần kiểm chứng |
| Kết nối database ngoài | ❌ | |
| Plugin / package | ❌ | |

---

## 10. Báo cáo và xuất bản

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Sao chép bảng kết quả | ✅ | Thống kê mô tả, t-test, ANOVA, Chi-square, OLS (dán vào Excel/Word) |
| Lưu biểu đồ | ✅ | PNG; sao chép vào clipboard |
| Viết đoạn Kết quả theo APA | ✅ | Nút AI ở màn kết quả (*Viết đoạn Kết quả theo APA*, *Giải thích ý nghĩa kết quả*) — cần kiểm chứng |
| Báo cáo HTML / PDF / Word tự động | ❌ | Bản prototype cũ từng có, đã gỡ khi tách module |
| Markdown / LaTeX | ❌ | |

---

## Tổng số phương pháp

Tab *Phân tích thống kê* có **43** mục: Tương quan 5 (Pearson, Spearman, Kendall, hiệp phương sai, tương quan từng phần), Kiểm định 22, Độ tin cậy 1, Hồi quy 4, Nhân tố 1, SEM 5, Học máy 4, Bayesian 1. Thêm 9 công cụ ở tab *Mô tả* (thống kê mô tả, CI bootstrap, bảng tần suất, bảng chéo, thống kê văn bản, đếm từ khóa, n-gram, Cohen's kappa, ngoại lai IQR) thành **52**. Con số «50 phương pháp» là cách nói làm tròn xuống của số này; khi viết cụ thể nên ghi «hơn 50 phương pháp».
