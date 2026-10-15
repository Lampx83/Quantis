# Đối chiếu tính năng Quantis với 10 nhóm chức năng

Tài liệu đối chiếu danh sách 10 nhóm tính năng ứng dụng phân tích định lượng với trạng thái hiện tại của Quantis.

> \* *10/2026*: đã chạy trên hệ thống từ 15/10/2026; mã nguồn ở nhánh `feat/dataprep-panel-glossary-20261015`, chưa gộp vào `main`. Xem mục «Có gì mới (10/2026)» trong [README](../README.md).

---

## 1. Quản lý và xử lý dữ liệu

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Nhập từ Excel, CSV, SQL, khảo sát | CSV ✅, Archive NEU ✅ | Excel/SQL/khảo sát: sẽ bổ sung |
| Làm sạch (missing, outliers) | ✅ | Drop missing, fill mean/median/mode; profiling có outlier (IQR); loại dòng ngoại lai theo IQR, xoá dòng trùng (10/2026*) |
| Biến đổi (compute, recode, biến giả) | Recode ✅, Compute ✅ (10/2026*) | Đổi tên cột, đổi loại biến, tính biến mới bằng công thức `[Cột]`, biến đổi log (10/2026*); tạo biến giả: sẽ bổ sung |
| Lọc, sắp xếp, gộp, nối bảng | Lọc ✅, Sắp xếp ✅ | Gộp/nối bảng: sẽ bổ sung |
| Panel và chuỗi thời gian | Panel ✅ (10/2026*) | Tab Phân tích → Dữ liệu bảng; chuỗi thời gian: sẽ bổ sung |

---

## 2. Thống kê mô tả

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Trung bình, trung vị, phương sai, độ lệch chuẩn | ✅ | Bảng thống kê mô tả |
| Bảng tần suất | ✅ | 1 biến: giá trị, tần số, % |
| Crosstab | ✅ | Bảng chéo 2 biến (hàng × cột) |
| Kiểm tra phân phối | ✅ | Skew, min/max/q25/q75 trong profiling |
| Histogram, boxplot | ✅ | Trong Trực quan hóa |

---

## 3. Thống kê suy luận

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| t-test | ✅ | Welch hai mẫu độc lập |
| Chi-square | ✅ | Độc lập 2 biến phân loại |
| ANOVA, MANOVA | ANOVA 1 nhân tố ✅ | MANOVA: sẽ bổ sung |
| Kiểm định phi tham số | ✅ | Mann-Whitney U |
| Post-hoc analysis | ✅ | So sánh từng cặp (Bonferroni) sau ANOVA |
| Power analysis | ❌ | Sẽ bổ sung |
| Thống kê Bayes | ✅ | Beta-Binomial (tỉ lệ) |

---

## 4. Hồi quy và kinh tế lượng

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Linear regression | ✅ | OLS, bảng hệ số, R², SE, t, p-value |
| Logistic, multinomial | ❌ | Sẽ bổ sung |
| Panel, time series, survival | Panel ✅ (10/2026*) | Pooled OLS, FE, RE (Swamy-Arora), Hausman, hiệu ứng thời gian; chỉ sai số chuẩn cổ điển (chưa robust/cluster). Time series, survival: sẽ bổ sung |
| Multilevel / mixed | ❌ | Sẽ bổ sung (engine) |

---

## 5. Phân tích đa biến

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| EFA, CFA, PCA | ❌ | Sẽ bổ sung (PCA client-side có thể) |
| Cluster analysis | ✅ | K-means (tab ML) |
| Discriminant analysis | ❌ | Sẽ bổ sung |
| SEM | ❌ | Sẽ bổ sung (engine) |

---

## 6. Trực quan hóa dữ liệu

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Bar, line, scatter | ✅ | |
| Histogram, boxplot | ✅ | |
| Heatmap | ✅ | Ma trận tương quan (màu) |
| Dashboard | ❌ | Sẽ bổ sung |
| Interactive visualization | Mức cơ bản | Recharts, chọn trục |

---

## 7. Phân tích nâng cao

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Machine learning | ✅ | K-means |
| Text mining | ❌ | Sẽ bổ sung |
| Bayesian modeling | ✅ | Beta-Binomial |
| Simulation, big data | ❌ | Sẽ bổ sung |

---

## 8. Tái lập và tự động hóa

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Script phân tích | Placeholder | Sao chép script R (TODO) |
| Notebook workflow | ✅ | Workflow nghiên cứu (các bước) |
| Pipeline xử lý dữ liệu | Mức cơ bản | Transform → dataset mới |
| Versioning | Mô tả | Hiển thị khi có backend |

---

## 9. Mở rộng và tích hợp

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Plugin / package | ❌ | Sẽ bổ sung |
| API | ✅ | Backend getData/saveData; Archive NEU |
| Kết nối database | ❌ | Sẽ bổ sung |
| Cloud | ❌ | Sẽ bổ sung |

---

## 10. Báo cáo và xuất bản

| Tính năng | Quantis | Ghi chú |
|-----------|---------|--------|
| Xuất bảng thống kê | CSV dataset ✅ | Bảng kết quả: copy/sẽ bổ sung |
| Report tự động | ✅ | HTML (mô tả + kiểm định APA) |
| Markdown / LaTeX | ❌ | Sẽ bổ sung |
| Dashboard báo cáo | ❌ | Sẽ bổ sung |
| Xuất Word, PDF, Excel | HTML ✅ | In trình duyệt → PDF; Word/Excel sẽ bổ sung |

---

*Cập nhật theo các tính năng đã bổ sung: Transform (lọc, sắp xếp, recode, fill median), Bảng tần suất, Crosstab, Heatmap tương quan, Post-hoc ANOVA (Bonferroni).*
