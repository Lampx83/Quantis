# Đối chiếu tính năng Quantis với 10 nhóm chức năng

Tài liệu đối chiếu danh sách 10 nhóm tính năng của một ứng dụng phân tích định lượng với **trạng thái thật** của Quantis. Cập nhật 25/10/2026, đối chiếu với mã nguồn và kiểm thử trên nhánh `main` (commit `a646810`, gồm lớp dữ liệu Variable View, chuẩn bị dữ liệu thứ cấp, tab Dữ liệu bảng, CI); cấu trúc module từ commit `767b027`. Các nhóm không đổi từ đợt kiểm chứng trên bản chạy thật (research.neu.edu.vn/embed/quantis) ngày 12/10/2026 được giữ nguyên. Tên nút/tab là tên trên giao diện tiếng Việt.

Ký hiệu: ✅ có trên giao diện · ⚙️ có nhưng cần backend Python · ❌ chưa có.

---

## 1. Quản lý và xử lý dữ liệu

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Nhập CSV, TSV, JSON, TXT | ✅ | Đọc trực tiếp trong trình duyệt (nút *Tải file*). Tự dò dấu phân cách `,` / `;` / tab theo mẫu dữ liệu (`.tsv` luôn là tab) và đổi số thập phân dấu phẩy («3,5» → 3.5) ở cột thuần số; có thông báo để kiểm tra lại. Tối đa 50.000 dòng/bộ dữ liệu |
| Nhập Excel, ODS, SPSS, Stata, SAS, R | ⚙️ | `.xlsx .xls .ods .sav .dta .sas7bdat .rds .RData`; máy chủ Python đọc file (Excel/ODS: sheet đầu tiên) |
| Metadata biến từ file SPSS/Stata/SAS | ⚙️ | Nhãn biến, nhãn giá trị, mã khuyết rời rạc và khoảng (kiểu SPSS), thang đo, căn lề, độ rộng. SPSS có test; mã khuyết dạng `.a`–`.z` của Stata/SAS **chưa kiểm bằng file thật** (issue #10) |
| Nhập từ kho Archive NEU | ✅ | Nút *Lấy từ Archive NEU* |
| Dataset mẫu | ✅ | Nút *Thêm dataset mẫu*; bộ mẫu do quản trị viên quản lý trên server |
| Lưới dữ liệu có thể sửa («Xem Dữ liệu») | ✅ | Sửa ô trực tiếp, dán nhiều ô từ Excel, thêm/chèn/xóa dòng và biến, đổi tên biến, sắp xếp, lọc nhanh, phân trang, bật/tắt *Nhãn Giá trị* |
| Variable View («Xem Biến số») | ✅ | Tên biến (cho phép chữ có dấu tiếng Việt), Kiểu (Numeric/String/Date), Độ rộng, Thập phân, Nhãn biến số, Nhãn giá trị, Giá trị khuyết, Căn lề, Thang đo; tìm theo tên/nhãn, thêm/xóa biến |
| Nhãn giá trị (value labels) | ✅ | Hộp thoại có mẫu nhanh (Likert 5, giới tính, nhị phân). Hiện **chỉ hiển thị ở lưới dữ liệu**, chưa áp vào bảng kết quả/biểu đồ |
| Thang đo (Scale / Ordinal / Nominal) | ✅ | Tự đoán lúc nạp; biến String không được là Scale. Hiện chỉ chi phối cách điền khuyết (mean/median chỉ cho Scale, còn lại dùng mốt); chưa dùng để gợi ý kiểm định/biểu đồ |
| Suy kiểu cột tự động | ✅ | Numeric nếu ≥ 90% ô là số; Date chỉ khi ≥ 90% ô khớp định dạng ngày thật (mã như «S-01», «2024-A» không bị nhận là ngày) |
| Mã khuyết người dùng khai báo | ✅ | Tối đa 3 mã rời rạc, hoặc một khoảng số (gồm hai đầu, vd 98–99) + 1 mã rời rạc. Bị loại khỏi **mọi** phân tích, biểu đồ, bảng Sơ bộ/Mô tả và dữ liệu gửi Python; dữ liệu gốc vẫn giữ mã |
| Ô sai kiểu trong cột số | ✅ | Ô tô vàng ⚠ ở lưới (cảnh báo, không chặn nhập); bị bỏ qua khi tính; cột **Không phải số** ở tab *Sơ bộ* và *Mô tả* (không tính vào Missing) |
| Làm sạch missing | ✅ | Loại dòng thiếu (listwise); thay bằng mean / median / mode (cột không phải Scale tự dùng mốt, có báo trước); tab *Biến đổi* |
| Hot-deck (láng giềng gần nhất) | ✅ | Chạy trên trình duyệt; trần 1.000 người cho/ô để giữ tốc độ; chưa dùng Web Worker (issue #12) |
| MICE | ⚙️ | Python (`IterativeImputer` + BayesianRidge), 1–50 vòng lặp. **Điền MỘT bộ dữ liệu tất định, chưa phải đa nhập liệu** (issue #8) |
| Phát hiện outlier | ✅ | IQR 1,5 ở tab *Sơ bộ* và *Mô tả* |
| Biến đổi | ✅ | Chuẩn hóa z-score, min-max; recode; biến đổi log (thêm cột mới); sau mỗi thao tác hỏi ghi đè bộ dữ liệu gốc hay tạo bộ mới |
| Lọc, sắp xếp | ✅ | Tab *Biến đổi* |
| Đổi tên biến, đổi kiểu văn bản ↔ số | ✅ | Đọc được «6,84», «1.234,5», «12%» |
| Tính biến mới từ công thức | ✅ | `[Tên cột]`, `+ − * / ^`, `ln log10 sqrt abs exp round mean sum min max` (mean/sum/min/max bỏ qua ô thiếu). Chưa có hàm điều kiện; biến giả (dummy) làm bằng *Recode* |
| Loại dòng ngoại lai theo IQR, xóa dòng trùng | ✅ | Hệ số k tùy chọn; xóa trùng giữ dòng đầu |
| Gộp / nối bảng | ❌ | |
| Panel (phân tích) | ⚙️ | Xem mục 4 (tab *Dữ liệu bảng*) |
| Chuỗi thời gian | ❌ | |
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
| So sánh trung bình | t-test độc lập (Welch / equal variance), t-test cặp, t-test một mẫu, z-test hai trung bình | ✅ (z-test cần Python). t-test hai mẫu nhận hai cột và trình bày bảng kiểu Excel |
| ANOVA | ANOVA 1 nhân tố (η², ω², post-hoc từng cặp hiệu chỉnh Bonferroni; nhận nhiều cột = nhiều nhóm, bảng SUMMARY + ANOVA kiểu Excel), ANCOVA, MANOVA, MANCOVA | ✅ (ANCOVA/MANOVA/MANCOVA cần Python) |
| Phi tham số | Mann-Whitney U, Wilcoxon cặp, Kruskal-Wallis, Friedman, Sign test | ✅ |
| Biến phân loại / tỉ lệ | Chi-square độc lập (Phi, Cramér's V, OR + CI khi 2×2), McNemar, Fisher exact, Binomial, Z-test hai tỉ lệ | ✅ |
| Giả định | Shapiro-Wilk, Levene, F-test hai phương sai | ✅ |
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
| Dữ liệu bảng (panel): OLS gộp, Fixed Effects, Random Effects, kiểm định Hausman | ⚙️ | Tab *Dữ liệu bảng*: chọn biến đơn vị, thời gian, Y, X; tùy chọn hiệu ứng thời gian. Kèm mô tả tổng thể / giữa / trong đơn vị. RE theo Swamy-Arora; sai số chuẩn cổ điển (chưa cluster/robust); từ chối cặp (đơn vị, thời gian) trùng. Đối chiếu `linearmodels` 7.1 và `statsmodels`: sai khác < 1e-11 |
| Time series, survival | ❌ | |
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
| Trợ lý AI | ✅ | vLLM qua backend (`/api/quantis/ollama/v1`), model `qwen3.5-35b-a3b-int4`; AI chỉ giải thích, cần kiểm chứng. Địa chỉ upstream nội bộ chỉ quản trị viên thấy; khóa gateway chỉ ghi, không trả lại |
| Kiểm thử và CI | ✅ | GitHub Actions cho mỗi PR/push `main`: tsc (không vượt ngưỡng lỗi tồn đọng, hiện 45), vitest (173 test), pytest (26 test), build + build:pack, build backend Node; đẩy image `lampx83/quantis-backend`, `lampx83/quantis-python` lên Docker Hub khi push `main` |
| Kết nối database ngoài | ❌ | |
| Plugin / package | ❌ | |

---

## 10. Báo cáo và xuất bản

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Sao chép bảng kết quả | ✅ | Thống kê mô tả, t-test, ANOVA, Chi-square, OLS (dán vào Excel/Word) |
| Lưu biểu đồ | ✅ | PNG; sao chép vào clipboard |
| Viết đoạn Kết quả theo APA | ✅ | Nút AI ở màn kết quả (*Viết đoạn Kết quả theo APA*, *Giải thích ý nghĩa kết quả*) — cần kiểm chứng |
| Chú giải thuật ngữ (i) | ✅ | 23 thuật ngữ vi/en (p-value, VIF, Cohen's d, Hausman, «Không phải số»…): dải thuật ngữ đầu các tab Tương quan, Kiểm định, Độ tin cậy, Hồi quy, Nhân tố, Dữ liệu bảng và biểu tượng (i) cạnh số liệu |
| Báo cáo HTML / PDF / Word tự động | ❌ | Bản prototype cũ từng có, đã gỡ khi tách module |
| Markdown / LaTeX | ❌ | |

---

## Tổng số phương pháp

Tab *Phân tích thống kê* có **44** mục: Tương quan 5 (Pearson, Spearman, Kendall, hiệp phương sai, tương quan từng phần), Kiểm định 22, Độ tin cậy 1, Hồi quy 4, Nhân tố 1, SEM 5, Học máy 4, Bayesian 1, Dữ liệu bảng 1 (một lần chạy cho ra mô tả within/between, OLS gộp, FE, RE và Hausman). Thêm 9 công cụ ở tab *Mô tả* (thống kê mô tả, CI bootstrap, bảng tần suất, bảng chéo, thống kê văn bản, đếm từ khóa, n-gram, Cohen's kappa, ngoại lai IQR) thành **53**. Con số «50 phương pháp» là cách nói làm tròn xuống của số này; khi viết cụ thể nên ghi «hơn 50 phương pháp».

## Giới hạn còn lại (xem thêm README)

- MICE điền một bộ dữ liệu tất định, chưa phải đa nhập liệu (m bộ + gộp Rubin) — [issue #8](https://github.com/Lampx83/Quantis/issues/8).
- Mã khuyết dạng `.a`–`.z` của Stata/SAS chưa kiểm bằng file thật — [issue #10](https://github.com/Lampx83/Quantis/issues/10).
- Hot-deck/MICE trên dữ liệu rất lớn chưa dùng Web Worker; còn nhiều chỗ `Math.min(...mảng)` — [issue #12](https://github.com/Lampx83/Quantis/issues/12).
- Panel chưa có sai số chuẩn cluster/robust; phần đối chiếu `linearmodels` chưa chạy trong CI vì thư viện này chưa nằm trong `requirements-dev.txt`.
- Nhãn giá trị và thang đo chưa được dùng ngoài lưới dữ liệu / bước điền khuyết.
