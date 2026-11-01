# Rà soát hoàn thiện Quantis — Ứng dụng phân tích định lượng đầy đủ

> **Cập nhật 25/10/2026** (nhánh `main`, commit `a646810`). Lần rà 12/10/2026 đã đối chiếu từng dòng với bản chạy thật (research.neu.edu.vn/embed/quantis) và mã nguồn sau khi tách module (commit `767b027`); bản này bổ sung những gì đã làm từ 13/10 đến 24/10: lớp dữ liệu kiểu SPSS (Variable View, nhãn giá trị, mã khuyết, MICE/hot-deck), chuẩn bị dữ liệu thứ cấp, tab **Dữ liệu bảng** (panel), chú giải thuật ngữ, sửa các lỗi số liệu phát hiện khi kiểm thử độc lập, và CI. Những chỗ ghi ✅ nhưng **không có trên giao diện** vẫn là ❌ (xuất bộ dữ liệu ra CSV, xuất SVG, các công cụ kiểu Excel chỉ có hàm API). AI chạy qua **vLLM** (model `qwen3.5-35b-a3b-int4`), không còn Ollama cho chat. Danh sách tính năng đầy đủ và số phương pháp: xem [FEATURES.md](./FEATURES.md); mục [6. Đối chiếu lỗi và giới hạn cũ](#6-đối-chiếu-lỗi-và-giới-hạn-cũ) ở cuối tài liệu này nói rõ cái nào đã sửa, cái nào còn.

Tài liệu này liệt kê **đã có**, **thiếu / chưa đủ**, và **checklist mục tiêu** để Quantis trở thành ứng dụng phân tích định lượng cực kỳ đầy đủ.

---

## 1. Tổng quan cấu trúc hiện tại

| Khu vực | Tab / Mục | Trạng thái |
|---------|-----------|------------|
| **Data Layer** | Xem dữ liệu (lưới sửa được + Xem Biến số), Sơ bộ (profiling), Mô tả, Biến đổi | Có đủ 4 tab; nhập CSV/TSV/JSON/TXT trong trình duyệt (dò `;`/tab, số thập phân dấu phẩy), Excel/SPSS/Stata/SAS/R qua backend Python; metadata biến, mã khuyết, điền khuyết (mean/median/mode, hot-deck, MICE), chuẩn bị dữ liệu thứ cấp |
| **Analysis Engine** | 9 nhóm: Tương quan, Kiểm định (22 mục), Độ tin cậy, Hồi quy (OLS, Logistic, Poisson, Ridge), Nhân tố (EFA), SEM (Mediation, Moderation, Path, CFA, PLS-SEM), Học máy, Bayesian, Dữ liệu bảng | 44 mục; chưa có đa cấp / chuỗi thời gian, MCMC |
| **Reproducibility** | Workflows, Versioning & audit, Pre-reg & tái lập | Workflows có (khung script R chỉ liệt kê bước); Versioning chỉ là trang thông báo; Pre-reg có |
| **Presentation** | Trực quan (13 loại biểu đồ) | Báo cáo HTML/PDF/Word chưa có trên UI |
| **Khác** | AI hướng dẫn, Hướng dẫn & trợ giúp, Cấu hình kết nối, Góp ý ứng dụng | ✅ AI qua vLLM; nút «Viết đoạn Kết quả theo APA» + «Giải thích ý nghĩa kết quả» ở mọi màn kết quả |

---

## 2. Chi tiết theo từng khối

### 2.1. Quản lý dữ liệu (Data Layer)

| Tính năng | Có/Chưa | Ghi chú |
|-----------|---------|--------|
| Import CSV | ✅ | Chọn file (nút *Tải file*), parse, giới hạn 50.000 dòng/bộ dữ liệu. Dò dấu phân cách `,` / `;` / tab; số thập phân dấu phẩy («3,5») được đổi thành 3.5 ở cột thuần số kèm thông báo |
| Import Excel / ODS / SPSS / Stata / SAS / R | ⚙️ | Qua backend Python (Excel/ODS: sheet đầu). SPSS/Stata/SAS mang theo nhãn biến, nhãn giá trị, mã khuyết, thang đo; mã khuyết dạng `.a`–`.z` của Stata/SAS chưa kiểm bằng file thật (issue #10) |
| Import từ Archive NEU | ✅ | Modal tìm dataset, chọn file, tải vào Quantis |
| Dataset mẫu | ✅ | Nhiều bộ mẫu do quản trị viên quản lý trên server (nút *Thêm dataset mẫu*) + workflow mẫu (menu ⋮ → *Tải workflow mẫu*) |
| Data profiling | ✅ | Missing, %, unique, min/max/mean/std/skew, outlier (IQR) |
| Transform: bỏ dòng thiếu / thay bằng mean | ✅ | Một hoặc nhiều cột; sau khi chạy hỏi ghi đè bộ dữ liệu gốc hay tạo bộ mới |
| Transform: **nhiều cột cùng lúc** | ✅ | Loại bỏ dòng thiếu (bất kỳ cột chọn nào thiếu), fill mean/median/mode, z-score, min-max áp dụng cho nhiều cột |
| Transform: fill median / mode / z-score / min-max | ✅ | fill_median, fill_mode, chuẩn hóa z-score, min-max [0,1] |
| Transform: chuẩn hóa (z-score, min-max) | ✅ | Trong Biến đổi |
| Lưới dữ liệu (Xem Dữ liệu) | ✅ | Sửa ô trực tiếp, dán từ Excel, thêm/chèn/xóa dòng và biến, đổi tên biến, sắp xếp, lọc nhanh; phân trang 20, 50, 100, 200 dòng/trang |
| Variable View (Xem Biến số) | ✅ | Tên, Kiểu, Độ rộng, Thập phân, Nhãn biến, Nhãn giá trị, Giá trị khuyết, Căn lề, Thang đo; tự đoán kiểu (Date chỉ khi ≥ 90% ô là ngày thật) |
| Mã khuyết kiểu SPSS (rời rạc + khoảng) | ✅ | Loại khỏi mọi phân tích qua `getAnalysisRows()`; dữ liệu gốc giữ nguyên mã |
| Ô sai kiểu trong cột số | ✅ | Tô vàng ⚠ ở lưới; cột *Không phải số* ở Sơ bộ/Mô tả; bỏ qua khi tính, không tính vào Missing |
| Điền khuyết hot-deck | ✅ | Trình duyệt, láng giềng gần nhất, trần 1.000 người cho/ô; chưa Web Worker (issue #12) |
| Điền khuyết MICE | ⚙️ | Python, một bộ dữ liệu tất định — **chưa phải đa nhập liệu** (issue #8) |
| Chuẩn bị dữ liệu thứ cấp | ✅ | Đổi tên biến, đổi kiểu văn bản ↔ số, tính biến mới từ công thức, biến đổi log, loại ngoại lai IQR, xóa dòng trùng |
| Xuất dataset ra CSV | ❌ | Chưa có trên giao diện hiện tại (chỉ xuất CSV ma trận tương quan ở tab Trực quan) |
| Làm sạch (clean) trong workflow | ⚠️ | Có bước "clean" nhưng chưa gắn với Transform thực tế |

**Bổ sung đề xuất:** Khôi phục nút xuất bộ dữ liệu ra CSV; gộp/nối bảng; hàm điều kiện (IF) trong công thức biến mới; hiển thị nhãn giá trị trong bảng kết quả/biểu đồ; MICE đa nhập liệu; chuyển hot-deck/MICE sang Web Worker.

---

### 2.2. Phân tích thống kê (Analysis Engine)

| Tính năng | Có/Chưa | Ghi chú |
|-----------|---------|--------|
| Thống kê mô tả | ✅ | Bảng n/mean/median/std/q25/q75/q10/q90/min/max/kurtosis; CI 95% Bootstrap cho trung bình; biểu đồ phân bố cột categorical |
| t-test (Welch / Student, hai mẫu độc lập) | ✅ | Có Cohen's d, p-value; **tùy chọn Equal variance** (giống SPSS); nhận hai cột và hiện bảng kiểu Excel |
| t-test cặp (paired) | ✅ | Hai cột số tương ứng từng cặp; **backend Python khi có API** |
| **F-test hai mẫu cho phương sai** | ✅ | Tab Kiểm định: hai cột hoặc hai nhóm, bảng kiểu Excel; tính ngay trong trình duyệt, không cần Python |
| **z-Test hai mẫu cho trung bình** | ✅ | Khi đã biết phương sai tổng thể (σ²₁, σ²₂); Tab Kiểm định |
| Ma trận tương quan | ✅ | Pearson, Spearman, Kendall (tau-b) |
| **Ma trận hiệp phương sai (Covariance)** | ✅ | Tab Tương quan: population / sample (N hoặc N-1) |
| Wilcoxon signed-rank (cặp) | ✅ | Phi tham số thay t-test cặp |
| Friedman (repeated measures) | ✅ | ≥3 điều kiện phụ thuộc |
| Levene (đồng phương sai) | ✅ | Kiểm tra trước ANOVA |
| ANOVA một nhân tố | ✅ | F, η², ω², post-hoc Bonferroni; nhận nhiều cột = nhiều nhóm, bảng SUMMARY + ANOVA kiểu Excel |
| Chi-square độc lập | ✅ | Phi, Cramér's V, OR+CI 95% (2×2) |
| McNemar, Fisher exact | ✅ | Cặp nhị phân; 2×2 exact |
| t-test một mẫu, Binomial, Z-test hai tỉ lệ, Sign test | ✅ | Đủ bộ kiểm định 1 mẫu / 2 tỉ lệ / cặp |
| Mann-Whitney U | ✅ | Non-parametric 2 nhóm |
| Gợi ý chọn test | ✅ | Nút AI «Gợi ý loại kiểm định phù hợp» trong tab Kiểm định (do AI trả lời, cần kiểm chứng) |
| Tương quan từng phần (partial) | ✅ | r(x, y \| Z), CI 95% Fisher z |
| Heatmap tương quan | ✅ | Màu theo hệ số, xuất CSV |
| Độ tin cậy Cronbach | ✅ | Chọn nhiều cột, alpha |
| **Hồi quy tuyến tính OLS** | ✅ | Tab Hồi quy: Y, X (nhiều), hệ số, R², SE, t, p-value |
| Hồi quy logistic | ✅ | Tab Hồi quy: Y nhị phân, X (nhiều) |
| Hồi quy Poisson, Ridge | ✅ | Cần backend Python |
| SEM: Mediation, Moderation | ✅ | Chạy được trên trình duyệt; Mediation nhiều M song song |
| SEM: Path analysis, CFA, PLS-SEM | ✅ | Qua backend Python (semopy) |
| Dữ liệu bảng (panel) | ⚙️ | Tab *Dữ liệu bảng*: OLS gộp, Fixed Effects, Random Effects (Swamy-Arora), Hausman; mô tả within/between; cần Python. Sai số chuẩn cổ điển, chưa cluster/robust |
| Hồi quy đa cấp / chuỗi thời gian | ❌ | Chưa có |
| EFA | ✅ | PCA + varimax, KMO, Bartlett |
| ANCOVA, MANOVA, MANCOVA | ✅ | Qua backend Python |
| Kruskal-Wallis, Shapiro-Wilk, Power analysis | ✅ | Power: t-test, tỉ lệ, chi-square, ANOVA, hồi quy |
| **Machine learning** | ✅ | Tab Học máy: K-means (centroids, số điểm theo cụm); phân loại đa lớp One-vs-Rest logistic (confusion matrix, precision/recall/F1); feature importance; permutation importance |
| **Bayesian (Beta-Binomial tỉ lệ)** | ✅ | Tab Bayesian: nhập success/n, prior α/β; posterior mean và CI 95% |

**Đã thực hiện từ đề xuất cũ:** OLS trong tab Hồi quy; K-means trong tab ML; Beta-Binomial trong tab Bayesian. **Còn để ngỏ:** Normal-Normal (Bayesian), random forest / cross-validation (ML), sai số chuẩn cluster/robust cho panel, hồi quy đa cấp, chuỗi thời gian.

---

### 2.3. Trực quan hóa & báo cáo (Presentation)

| Tính năng | Có/Chưa | Ghi chú |
|-----------|---------|--------|
| Scatter plot (Phân tán) | ✅ | X, Y số |
| Bar chart | ✅ | Cột categorical |
| Line chart | ✅ | X (có thể categorical), Y số |
| Pie chart | ✅ | Tỷ lệ thành phần |
| Box plot (theo nhóm) | ✅ | Bảng min/q1/median/q3/max kèm bar median |
| Histogram | ✅ | Cột số, bins tự động |
| Lưu biểu đồ | ✅ | Nút *Lưu PNG* và *Sao chép vào clipboard*; Heatmap tương quan xuất CSV. Không có xuất SVG riêng |
| Báo cáo HTML | ❌ | Chưa có trên UI (từng có ở bản prototype, đã gỡ khi refactor; còn lưu trữ SavedReportChart trong storage.ts) |
| **Sao chép bảng / kết quả** | ✅ | Nút "Sao chép bảng" (thống kê mô tả TSV); "Sao chép" cho t-test, ANOVA, **Chi-square** (χ², df, p, Phi, Cramer V, OR+CI khi 2×2), **OLS** (bảng hệ số TSV + R², n) — dán vào Excel/Word |
| Báo cáo PDF | ❌ | Chưa |
| Correlation heatmap (màu) | ✅ | Có, kèm xuất CSV |
| Các loại biểu đồ khác | ✅ | Tổng 13 loại: Cột, Đường, Phân tán, Histogram, Box plot, Heatmap tương quan, Tròn, Cột chồng, Cột ngang, Vùng, Donut, Density, Radar. Box plot vẽ bằng cột chồng + thanh sai số; biểu đồ phân tán dùng trục số và có nhãn trục (sửa 13/10) |

---

### 2.4. Workflow & Reproducibility

| Tính năng | Có/Chưa | Ghi chú |
|-----------|---------|--------|
| Tạo/sửa workflow, gắn dataset | ✅ | Có bước import/clean/transform/describe/test/… |
| Thêm/xóa bước, nhãn | ✅ | |
| Sao chép khung script R | ✅ (khung) | Chỉ liệt kê các bước kèm dòng `TODO`, chưa sinh mã R thật |
| Pre-registration + checklist open science | ✅ | Menu ⋮ → *Pre-reg & mở khoa học*; *Xuất draft (HTML)*; dùng chung đề cương với Writium |
| Versioning / lịch sử phiên bản | ❌ | Chỉ là trang thông báo (backend chưa lưu snapshot) |
| Audit trail | ❌ | Chưa có |

---

### 2.5. Tích hợp & Hạ tầng

| Tính năng | Có/Chưa | Ghi chú |
|-----------|---------|--------|
| Backend API (data, health) | ✅ | getData, saveData, checkBackendAvailable |
| Archive NEU (frontend) | ✅ | search, files, download |
| AI gợi ý (LLM) | ✅ | vLLM qua proxy backend (`/api/quantis/ollama/v1`; upstream `ollamaUpstreamUrl` hoặc `OLLAMA_URL`, dev không backend: `VITE_OLLAMA_URL`). Mọi kết quả có nút AI **Viết đoạn Kết quả theo APA** và **Giải thích ý nghĩa kết quả**. Tab *AI hướng dẫn* có prompt hệ thống kèm bản đồ ứng dụng. AI chỉ hỗ trợ, cần kiểm chứng. |
| Lưu trữ local (localStorage) | ✅ | Khi không backend, và với khách Portal (`guest@…` không được ghi lên server) |
| Chú giải thuật ngữ (i) | ✅ | 23 thuật ngữ vi/en; dải thuật ngữ đầu 6 tab phân tích + biểu tượng (i) cạnh số liệu |
| Bảo mật cấu hình | ✅ | `GET /settings` chỉ trả địa chỉ upstream nội bộ cho quản trị viên; khóa gateway chỉ ghi; kho `/data` chung mặc định tắt (403) |
| Lọc ký tự `\u0000` khi lưu workspace | ✅ | Frontend (`cleanRows`, `cleanJsonReplacer`) và backend (`sanitizeJson`) — tránh lỗi PostgreSQL `jsonb` khi file nhập có byte lạ |
| Kiểm thử + CI | ✅ | `.github/workflows/ci.yml`: tsc ratchet (≤ 45 lỗi tồn đọng), vitest (173 test), pytest (26 test), build + build:pack, build backend Node. Image Docker Hub build ở `push-dockerhub.yml` |

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
- [ ] Báo cáo HTML + APA (chưa có trên UI; có nút AI «Viết đoạn Kết quả theo APA»)
- [x] **Hồi quy tuyến tính OLS** (bảng hệ số, R², p-value)
- [x] **ML cơ bản** (ít nhất K-means hoặc OLS trong tab ML)
- [x] **Bayesian cơ bản** (ít nhất Beta-Binomial tỉ lệ)
- [ ] Versioning: chưa có chức năng; trang *Versioning & audit* ghi rõ là chưa có (không hứa tính năng)

### Mức đầy đủ hơn (đã bổ sung / đề xuất)

- [x] Hồi quy logistic (client)
- [x] Transform: fill median, fill mode, chuẩn hóa z-score, min-max
- [x] Correlation heatmap (màu) + xuất CSV
- [x] Xuất biểu đồ PNG (và sao chép vào clipboard); chưa có xuất SVG riêng
- [x] t-test cặp, Wilcoxon cặp, Friedman, Levene
- [x] Tương quan từng phần (partial)
- [x] Thống kê mô tả: P10, P90, Kurtosis
- [x] McNemar (cặp nhị phân), Phi & Cramér's V (Chi-square), Kendall's tau, CI 95% Bootstrap (trung bình)
- [x] Fisher exact (2×2), t-test một mẫu, kiểm định tỉ lệ (Binomial) + CI 95% Wilson
- [x] Z-test hai tỉ lệ, Sign test (cặp), CI 95% cho hệ số tương quan r (Fisher z)
- [x] Odds ratio (OR) + CI 95% cho bảng 2×2 (Chi-square, Fisher); Omega-squared (ω²) cho ANOVA
- [ ] API versioning (backend) + hiển thị lịch sử
- [x] AI endpoint + UI gợi ý (vLLM, prompt APA + Giải thích toàn diện)
- [x] Dữ liệu bảng: OLS gộp, FE, RE, Hausman (Python)
- [ ] Hồi quy đa cấp / chuỗi thời gian
- [ ] MICE đa nhập liệu (m bộ dữ liệu + gộp Rubin)

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
| Hồi quy | Linear, Logistic | lm(), glm() | statsmodels OLS, Logit | OLS, Logistic, Poisson, Ridge, VIF |
| Dữ liệu bảng | — (cần add-on) | plm, lfe | linearmodels | Pooled OLS, FE, RE, Hausman (đối chiếu `linearmodels`) |
| Metadata biến | Variable View, Value Labels, Missing Values | haven, labelled | pyreadstat | Variable View, nhãn giá trị, mã khuyết rời rạc + khoảng; nạp từ .sav/.dta/.sas7bdat |
| SEM / Mediation | Process macro, AMOS | mediation, lavaan | statsmodels, semopy | Mediation, Moderation, Path analysis, CFA, PLS-SEM (tab SEM) |
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
7. **Excel Data Analysis tương đương:** Có **API + giao diện** cho Covariance, F-test 2 phương sai, z-Test 2 trung bình, t-test Equal variance, t-test cặp. Các công cụ Exponential smoothing, Moving average, ANOVA 2 nhân tố (có/không lặp), Fourier, Rank & Percentile, Random number, Sampling **mới chỉ có hàm API** (`src/api.ts`, backend Python), **chưa có giao diện**.
8. **AI hỗ trợ:** Mọi màn kết quả có nút AI với prompt chuẩn **Viết đoạn Kết quả theo APA** và **Giải thích ý nghĩa kết quả**; Cấu hình kết nối chọn upstream vLLM và model (quản trị viên lưu). AI chỉ phụ trợ, người dùng phải kiểm chứng.

---

## 5. Quantis so với SPSS — Đầy đủ, đúng, tốt hơn, có AI

| Tiêu chí | SPSS | Quantis |
|----------|------|---------|
| **Tính năng** | Đầy đủ thống kê kinh điển | Phần lớn thống kê kinh điển (44 mục phân tích + 9 công cụ mô tả); chưa có ANOVA 2 nhân tố, đa cấp, chuỗi thời gian trên giao diện |
| **Effect size** | Một số bảng có | Cohen d, η², ω², Phi, Cramér's V, OR+CI 95%, CI Bootstrap, CI Fisher r |
| **Tùy chọn** | t-test Equal/Unequal variance | ✅ Equal variance checkbox; F-test 2 phương sai riêng |
| **AI** | Không có | ✅ Mọi kết quả: «Viết đoạn Kết quả theo APA» + «Giải thích ý nghĩa»; gợi ý chọn kiểm định, cỡ mẫu (vLLM; cần kiểm chứng) |
| **Reproducibility** | Syntax log | Workflow (khung script R chỉ liệt kê bước); versioning chưa có |
| **Giao diện** | Desktop, cố định | Web, responsive, tích hợp biểu đồ và trợ lý AI |

## 6. Đối chiếu lỗi và giới hạn cũ

**Đã sửa** (kể từ lần rà 12/10/2026):

| Vấn đề cũ | Trạng thái |
|-----------|-----------|
| Shapiro-Wilk, Kendall tau-b, Levene (df2), hồi quy logistic IRLS, varimax, p-value t (df ≥ 100), Cohen's d mẫu cặp, N hợp lệ ở bảng Mô tả, box plot / scatter | **Đã sửa 13/10** theo đợt kiểm thử độc lập đối chiếu scipy/R (Shapiro-Wilk theo Royston AS R94 khớp `scipy.stats.shapiro`; Kendall khớp `scipy.stats.kendalltau`) |
| t-test chỉ có Welch ở phía trình duyệt | Có thêm Student (equal variance) |
| ANOVA / F-test / t-test chỉ nhập theo cột nhóm | Có chế độ nhiều cột = nhiều nhóm, bảng kiểu Excel |
| Khách Portal mất dataset khi chuyển giữa lưu cục bộ và đồng bộ | Đã sửa (khách lưu cục bộ, không ghi lên server) |
| Lưu workspace lỗi khi dữ liệu có `\u0000` | Đã lọc ở frontend và backend |
| CSV phân tách `;` bị tách «3,5» thành hai cột; chỉ nhìn dòng tiêu đề để đoán dấu phân cách | Đã dò theo mẫu dữ liệu (`,` / `;` / tab) và đổi số dấu phẩy ở cột thuần số |
| Mã khuyết SPSS (99, 98–99…) lọt vào mọi phân tích (`user_missing=True`) | Đã sửa: một điểm tạo dữ liệu phân tích (`getAnalysisRows`) cho mọi tab, kèm test canh giữ; hỗ trợ cả khoảng kiểu SPSS |
| MICE trả 500 khi có ô trống ở cột không chọn; `maxIter` không giới hạn | Đã sửa; kẹp 1–50 vòng, giá trị điền nằm trong khoảng quan sát |
| Hot-deck quá chậm (20.000 dòng ~11 giây) | ~0,08 giây sau tối ưu (trần 1.000 người cho/ô) |
| Cột số nguyên hiển thị «1.00» | Đã sửa: 0 chữ số thập phân nếu cả cột là số nguyên |
| Cột chuỗi mã («S-01», «2024-A») bị đoán là Date | Đã sửa: chỉ đoán Date khi khớp định dạng ngày thật |
| Ô chữ / «3,5» trong cột số làm cả cột thành chữ hoặc bị đếm nhầm | Cột số khai báo giữ kiểu số; ô sai kiểu bị bỏ qua và đếm ở cột *Không phải số*; lưới tô vàng ⚠ |
| Địa chỉ gateway/upstream nội bộ lộ ở `GET /settings` công khai | Chỉ quản trị viên thấy |
| Image `quantis-python` thiếu `panel_impl.py` (lỗi khi khởi động) | Dockerfile đã `COPY panel_impl.py` |
| Không có kiểm thử/CI tự động | Có CI (tsc ratchet, vitest, pytest, build) |
| Panel / dữ liệu bảng ghi «chưa có» | Đã có tab *Dữ liệu bảng* |
| Tính biến mới (compute) ghi «chưa có» | Đã có (công thức, biến đổi log, loại ngoại lai IQR, xóa dòng trùng) |

**Còn lại** (không hứa tính năng chưa có):

| Giới hạn | Ghi chú |
|----------|--------|
| MICE chưa phải đa nhập liệu | Issue #8: `sample_posterior` + m bộ dữ liệu + gộp Rubin |
| Mã khuyết `.a`–`.z` của Stata/SAS chưa kiểm bằng file thật | Issue #10 |
| Hot-deck/MICE chưa dùng Web Worker; ~19 chỗ `Math.min(...mảng)` có từ trước | Issue #12 |
| Xuất bộ dữ liệu ra CSV, báo cáo HTML/PDF/Word, xuất SVG | Chưa có trên giao diện |
| Versioning & audit; khung script R chưa sinh mã thật | Trang thông báo / khung `TODO` |
| ANOVA hai nhân tố và các công cụ kiểu Excel (moving average, smoothing, Fourier, rank, random, sampling) | Chỉ có hàm API + backend, chưa có giao diện |
| Hồi quy đa cấp, chuỗi thời gian, MCMC / Bayes Factor, post-hoc Tukey, multinomial logistic | Chưa có |
| Nhãn giá trị và thang đo chưa dùng ngoài lưới dữ liệu / bước điền khuyết | Bảng kết quả, biểu đồ chưa hiện nhãn |
| Đối chiếu panel với `linearmodels` không chạy trong CI | `linearmodels` chưa có trong `requirements-dev.txt`; đã chạy tay 25/10/2026: sai khác < 1e-11 |
| Prompt «AI hướng dẫn» (`aiAssistView.systemHintTask`) lỗi thời | Còn ghi «panel chưa có», chưa biết Variable View / chuẩn bị dữ liệu thứ cấp |
| Tên bước CI «tsc <= 46» trong `ci.yml` | Ngưỡng thật nằm ở `scripts/check-tsc.mjs` (45) |

File này sẽ được cập nhật khi từng mục được triển khai.
