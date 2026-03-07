# Rà soát hoàn thiện Quantis — Ứng dụng phân tích định lượng đầy đủ

Tài liệu này liệt kê **đã có**, **thiếu / chưa đủ**, và **checklist mục tiêu** để Quantis trở thành ứng dụng phân tích định lượng cực kỳ đầy đủ.

---

## 1. Tổng quan cấu trúc hiện tại

| Khu vực | Tab / Mục | Trạng thái |
|---------|-----------|------------|
| **Data Layer** | Import, Profiling, Transform, Preview | Có đủ 4 tab, chức năng cơ bản ổn |
| **Analysis Engine** | Thống kê mô tả, Kiểm định giả thuyết, Hồi quy & SEM, Tương quan, Cronbach, ML, Bayesian | Mô tả + Hồi quy + ML + Bayesian chưa đủ |
| **Reproducibility** | Workflows, Versioning | Workflows có; Versioning chỉ text |
| **Presentation** | Visualization, Reports | Có scatter/bar/line/pie/box/histogram; Report HTML có |
| **Khác** | AI hỗ trợ, So sánh công cụ, Hướng dẫn | ✅ AI tích hợp Ollama/OpenAI; prompt chuẩn APA + Giải thích ở mọi kết quả |

---

## 2. Chi tiết theo từng khối

### 2.1. Quản lý dữ liệu (Data Layer)

| Tính năng | Có/Chưa | Ghi chú |
|-----------|---------|--------|
| Import CSV | ✅ | Kéo thả / chọn file, parse, giới hạn dòng |
| Import từ Archive NEU | ✅ | Modal tìm dataset, chọn file, tải vào Quantis |
| Dataset mẫu | ✅ | 2 dataset + 2 workflow mẫu |
| Data profiling | ✅ | Missing, %, unique, min/max/mean/std/skew, outlier (IQR) |
| Transform: bỏ dòng thiếu / thay bằng mean | ✅ | Một cột, tạo dataset mới |
| Transform: **nhiều cột cùng lúc** | ✅ | Loại bỏ dòng thiếu (bất kỳ cột chọn nào thiếu), fill mean/median/mode, z-score, min-max áp dụng cho nhiều cột |
| Transform: fill median / mode / z-score / min-max | ✅ | fill_median, fill_mode, chuẩn hóa z-score, min-max [0,1] |
| Transform: chuẩn hóa (z-score, min-max) | ✅ | Trong Biến đổi |
| Preview bảng phân trang | ✅ | Tùy chọn số dòng/trang: 20, 50, 100, 200 |
| Xuất dataset ra CSV | ✅ | Nút Xuất CSV từ danh sách dataset (exportDataset) |
| Làm sạch (clean) trong workflow | ⚠️ | Có bước "clean" nhưng chưa gắn với Transform thực tế |

**Bổ sung đề xuất:** Thêm fill median, chuẩn hóa 1 cột (z-score), xuất CSV từ header (nhanh).

---

### 2.2. Phân tích thống kê (Analysis Engine)

| Tính năng | Có/Chưa | Ghi chú |
|-----------|---------|--------|
| Thống kê mô tả | ✅ | Bảng n/mean/median/std/q25/q75/q10/q90/min/max/kurtosis; CI 95% Bootstrap cho trung bình; biểu đồ phân bố cột categorical |
| t-test (Welch, hai mẫu độc lập) | ✅ | Có Cohen's d, p-value; **tùy chọn Equal variance** (giống SPSS) |
| t-test cặp (paired) | ✅ | Hai cột số tương ứng từng cặp; **backend Python khi có API** |
| **F-test hai mẫu cho phương sai** | ✅ | Tab Kiểm định: so sánh var nhóm 1 vs nhóm 2 (trước khi chọn Equal variance) |
| **z-Test hai mẫu cho trung bình** | ✅ | Khi đã biết phương sai tổng thể (σ²₁, σ²₂); Tab Kiểm định |
| Ma trận tương quan | ✅ | Pearson, Spearman, Kendall (tau-b) |
| **Ma trận hiệp phương sai (Covariance)** | ✅ | Tab Tương quan: population / sample (N hoặc N-1) |
| Wilcoxon signed-rank (cặp) | ✅ | Phi tham số thay t-test cặp |
| Friedman (repeated measures) | ✅ | ≥3 điều kiện phụ thuộc |
| Levene (đồng phương sai) | ✅ | Kiểm tra trước ANOVA |
| ANOVA một nhân tố | ✅ | F, η², ω², post-hoc Bonferroni |
| Chi-square độc lập | ✅ | Phi, Cramér's V, OR+CI 95% (2×2) |
| McNemar, Fisher exact | ✅ | Cặp nhị phân; 2×2 exact |
| t-test một mẫu, Binomial, Z-test hai tỉ lệ, Sign test | ✅ | Đủ bộ kiểm định 1 mẫu / 2 tỉ lệ / cặp |
| Mann-Whitney U | ✅ | Non-parametric 2 nhóm |
| Gợi ý chọn test | ✅ | Khung trong tab Kiểm định |
| Tương quan từng phần (partial) | ✅ | r(x, y | Z), CI 95% Fisher z |
| Heatmap tương quan | ✅ | Màu theo hệ số, xuất CSV |
| Độ tin cậy Cronbach | ✅ | Chọn nhiều cột, alpha |
| **Hồi quy tuyến tính OLS** | ✅ | Tab Hồi quy: Y, X (nhiều), hệ số, R², SE, t, p-value |
| Hồi quy logistic | ✅ | Tab Hồi quy: Y nhị phân, X (nhiều) |
| Hồi quy đa cấp / SEM | ⚠️ | Mediation, Moderation (tab SEM) |
| **Machine learning (K-means)** | ✅ | Tab ML: chọn cột số, K, chạy K-means; hiển thị centroids và số điểm theo cụm |
| **Bayesian (Beta-Binomial tỉ lệ)** | ✅ | Tab Bayesian: nhập success/n, prior α/β; posterior mean và CI 95% |

**Bổ sung đề xuất:** OLS trong tab Hồi quy; K-means + (tùy chọn) OLS trong tab ML; Beta-Binomial (và sau đó Normal-Normal) trong tab Bayesian.

---

### 2.3. Trực quan hóa & báo cáo (Presentation)

| Tính năng | Có/Chưa | Ghi chú |
|-----------|---------|--------|
| Scatter plot | ✅ | X, Y số |
| Bar chart | ✅ | Cột categorical |
| Line chart | ✅ | X (có thể categorical), Y số |
| Pie chart | ✅ | Tỷ lệ thành phần |
| Box plot (theo nhóm) | ✅ | Bảng min/q1/median/q3/max kèm bar median |
| Histogram | ✅ | Cột số, bins tự động |
| Xuất biểu đồ (PNG/SVG) | ✅ | Nút Xuất SVG, Xuất PNG; Heatmap xuất CSV |
| Báo cáo HTML | ✅ | Thống kê mô tả + kết quả kiểm định APA |
| **Sao chép bảng / kết quả** | ✅ | Nút "Sao chép bảng" (thống kê mô tả TSV); "Sao chép" cho t-test, ANOVA, **Chi-square** (χ², df, p, Phi, Cramer V, OR+CI khi 2×2), **OLS** (bảng hệ số TSV + R², n) — dán vào Excel/Word |
| Báo cáo PDF | ❌ | Chưa (có thể in từ HTML) |
| Correlation heatmap (màu) | ✅ | Có, kèm xuất CSV |

---

### 2.4. Workflow & Reproducibility

| Tính năng | Có/Chưa | Ghi chú |
|-----------|---------|--------|
| Tạo/sửa workflow, gắn dataset | ✅ | Có bước import/clean/transform/describe/test/… |
| Thêm/xóa bước, nhãn | ✅ | |
| Sao chép script R (placeholder) | ✅ | Nội dung TODO |
| Versioning / lịch sử phiên bản | ❌ | Chỉ text "sẽ hiển thị khi backend" |
| Audit trail | ❌ | Chưa có |

---

### 2.5. Tích hợp & Hạ tầng

| Tính năng | Có/Chưa | Ghi chú |
|-----------|---------|--------|
| Backend API (data, health) | ✅ | getData, saveData, checkBackendAvailable |
| Archive NEU (frontend) | ✅ | search, files, download |
| AI gợi ý (LLM) | ✅ | Ollama/OpenAI (VITE_QUANTIS_AI_API). Mọi kết quả có nút AI với prompt **Viết đoạn Results theo APA** và **Giải thích ý nghĩa kết quả**. Cài đặt chọn model. |
| Lưu trữ local (localStorage) | ✅ | Khi không backend |

---

## 3. Checklist “Ứng dụng phân tích định lượng cực kỳ đầy đủ”

### Mức tối thiểu (đã đạt phần lớn)

- [x] Import CSV + nguồn ngoài (Archive)
- [x] Profiling (missing, outlier, skew)
- [x] Transform cơ bản (drop missing, fill mean)
- [x] Thống kê mô tả
- [x] t-test, ANOVA, Chi-square, Mann-Whitney
- [x] Ma trận tương quan (Pearson, Spearman)
- [x] Cronbach alpha
- [x] Nhiều loại biểu đồ
- [x] Báo cáo HTML + APA
- [x] **Hồi quy tuyến tính OLS** (bảng hệ số, R², p-value)
- [x] **ML cơ bản** (ít nhất K-means hoặc OLS trong tab ML)
- [x] **Bayesian cơ bản** (ít nhất Beta-Binomial tỉ lệ)
- [x] Versioning: mô tả rõ “khi có backend” (không còn “sẽ tích hợp”)

### Mức đầy đủ hơn (đã bổ sung / đề xuất)

- [x] Hồi quy logistic (client)
- [x] Transform: fill median, fill mode, chuẩn hóa z-score, min-max
- [x] Correlation heatmap (màu) + xuất CSV
- [x] Xuất biểu đồ PNG/SVG
- [x] t-test cặp, Wilcoxon cặp, Friedman, Levene
- [x] Tương quan từng phần (partial)
- [x] Thống kê mô tả: P10, P90, Kurtosis
- [x] McNemar (cặp nhị phân), Phi & Cramér's V (Chi-square), Kendall's tau, CI 95% Bootstrap (trung bình)
- [x] Fisher exact (2×2), t-test một mẫu, kiểm định tỉ lệ (Binomial) + CI 95% Wilson
- [x] Z-test hai tỉ lệ, Sign test (cặp), CI 95% cho hệ số tương quan r (Fisher z)
- [x] Odds ratio (OR) + CI 95% cho bảng 2×2 (Chi-square, Fisher); Omega-squared (ω²) cho ANOVA
- [ ] API versioning (backend) + hiển thị lịch sử
- [x] AI endpoint + UI gợi ý (Ollama/OpenAI, prompt APA + Giải thích toàn diện)
- [ ] Hồi quy đa cấp / SEM đầy đủ (backend R/Python)

---

## 4. So sánh với SPSS, R, Python (định hướng tính năng)

Quantis bổ sung các tính năng tương đương phần mềm nghiên cứu phổ biến:

| Nhóm | SPSS | R (rstatix, jmv, car) | Python (scipy, statsmodels) | Quantis |
|------|------|------------------------|-----------------------------|---------|
| Mô tả | Frequencies, Descriptives, Explore | summary, describe | describe, scipy.stats | Bảng mô tả + P10/P90/Kurtosis |
| t-test | Independent / Paired | t.test(paired=) | scipy.stats.ttest_rel | t-test (Welch), t-test cặp |
| Non-parametric 2 nhóm | — | wilcox.test(paired=) | scipy.stats.wilcoxon | Mann-Whitney, Wilcoxon cặp |
| ANOVA / repeated | GLM, Repeated Measures | aov, friedman.test | scipy.stats.f_oneway, friedmanchisquare | ANOVA 1 nhân tố, Friedman |
| Đồng phương sai | Levene | car::leveneTest | scipy.stats.levene | Levene |
| Chi-square / effect size | Crosstabs, Phi, Cramér's V | chisq.test, DescTools | scipy.stats.chi2_contingency | Chi-square, Phi, Cramér's V, **OR + CI 95% (2×2)** |
| Paired binary | McNemar | mcnemar.test | scipy.stats.mcnemar | McNemar |
| 2×2 exact | Fisher exact | fisher.test | scipy.stats.fisher_exact | **Fisher exact (2×2)** + **OR + CI** |
| One-sample mean | Compare Means → One-Sample T | t.test(x, mu=) | scipy.stats.ttest_1samp | **t-test một mẫu** |
| One-sample proportion | — | binom.test | scipy.stats.binomtest | **Kiểm định tỉ lệ (Binomial)** |
| Two proportions (independent) | Compare Proportions | prop.test | statsmodels proportions_ztest | **Z-test hai tỉ lệ** |
| Sign test (paired) | Nonparametric → 2 Related | binom.test on signs | scipy (manual) | **Sign test (cặp)** |
| **Tương quan** | Bivariate, Partial | cor(), ppcor | scipy, pingouin | Pearson, Spearman, **Kendall**, Partial, **CI 95% r** |
| ANOVA effect size | GLM (η²) | etaSquared, omegaSquared | pingouin, etc. | **η² + ω² (omega-squared)** |
| Hồi quy | Linear, Logistic | lm(), glm() | statsmodels OLS, Logit | OLS, Logistic, VIF |
| SEM / Mediation | Process macro | mediation, lavaan | statsmodels, sem | Mediation, Moderation (tab SEM) |
| EFA / Cronbach | Factor, Reliability | psych::fa, alpha | factor_analyzer, pingouin | EFA (PCA+varimax), Cronbach |
| ML / Clustering | — | kmeans, caret | sklearn | K-means, đa lớp logistic |

---

## 4. Thứ tự triển khai đã thực hiện / đề xuất

1. **OLS (Hồi quy tuyến tính)** — `stats.ts` + UI tab Hồi quy: chọn Y, chọn X (nhiều cột), bảng hệ số, SE, t, p-value, R², R² điều chỉnh.
2. **Bayesian Beta-Binomial** — `stats.ts` + UI tab Bayesian: nhập (hoặc chọn từ dữ liệu) số success + n, prior Beta, posterior + credible interval.
3. **ML: K-means** — `stats.ts` (hoặc thuật toán đơn giản) + UI tab ML: chọn cột số, số cụm, hiển thị centroids / gán nhãn.
4. **Versioning & AI** — Chỉnh lại copy (không dùng “sẽ tích hợp R/Python”), chuẩn bị API version khi có backend.
5. (Tùy chọn) Hồi quy logistic, heatmap tương quan, xuất biểu đồ — **đã thực hiện**.
6. **Bổ sung theo SPSS/R/Python:** t-test cặp, Wilcoxon signed-rank cặp, Friedman, Levene, McNemar (cặp nhị phân), tương quan từng phần, P10/P90/Kurtosis, Phi & Cramér's V (Chi-square), Kendall's tau, CI 95% Bootstrap cho trung bình (UI trong Thống kê mô tả).
7. **Excel Data Analysis tương đương:** Covariance, F-test 2 phương sai, Exponential smoothing, Moving average, ANOVA 2 nhân tố (có/không lặp), Fourier, Rank & Percentile, Random number, Sampling, t-test cặp (backend), z-Test 2 trung bình — API + UI (F-test, z-test, Covariance, t-test Equal variance, Paired backend).
8. **AI hỗ trợ toàn diện:** Mọi màn kết quả có nút AI với prompt chuẩn **Viết đoạn Results theo APA** và **Giải thích ý nghĩa kết quả**; Cài đặt chọn model (Ollama/OpenAI). Tốt hơn SPSS: không có AI tích hợp sẵn.

---

## 5. Quantis so với SPSS — Đầy đủ, đúng, tốt hơn, có AI

| Tiêu chí | SPSS | Quantis |
|----------|------|---------|
| **Tính năng** | Đầy đủ thống kê kinh điển | Tương đương + Excel-style (Covariance, F-test, z-test 2 means, ANOVA 2 nhân tố, Moving average, Exponential smoothing, Fourier, Rank & Percentile, Sampling, Random number) |
| **Effect size** | Một số bảng có | Cohen d, η², ω², Phi, Cramér's V, OR+CI 95%, CI Bootstrap, CI Fisher r |
| **Tùy chọn** | t-test Equal/Unequal variance | ✅ Equal variance checkbox; F-test 2 phương sai riêng |
| **AI** | Không có | ✅ Mọi kết quả: "Viết đoạn Results theo APA" + "Giải thích ý nghĩa"; gợi ý test, power, overfitting (Ollama/OpenAI) |
| **Reproducibility** | Syntax log | Workflow + (khi có backend) versioning |
| **Giao diện** | Desktop, cố định | Web, responsive, tích hợp báo cáo & biểu đồ |

File này sẽ được cập nhật khi từng mục được triển khai.
