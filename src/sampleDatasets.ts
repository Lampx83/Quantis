/**
 * Danh sách bộ dữ liệu mẫu đa lĩnh vực để thử nghiệm phân tích trên Quantis.
 * Mỗi bộ có name, domain, description và getData() trả về [header, ...rows].
 */

export interface SampleDatasetDef {
  id: string;
  name: string;
  domain: string;
  description: string;
  /** Số dòng (không tính header), số cột - để hiển thị */
  rows: number;
  columns: number;
  /** Trả về [header, ...dataRows] */
  getData: () => string[][];
}

function makeRows<T>(n: number, fn: (i: number) => T[]): T[][] {
  return Array.from({ length: n }, (_, i) => fn(i));
}

export const SAMPLE_DATASETS: SampleDatasetDef[] = [
  {
    id: "edu-scores",
    name: "Điểm học sinh (A/B)",
    domain: "Giáo dục",
    description: "Điểm kiểm tra hai nhóm phương pháp dạy. Có một số ô thiếu để demo Biến đổi (làm sạch, lọc, sắp xếp, recode). Thử: Thống kê mô tả, t-test, tab Biến đổi.",
    rows: 80,
    columns: 5,
    getData: () => {
      const header = ["id", "nhóm", "điểm", "giới_tính", "lớp"];
      // Dữ liệu cố định, có vài ô thiếu (missing) để demo: Loại bỏ dòng thiếu, Thay missing bằng mean/median/mode
      const rows: string[][] = [];
      for (let i = 0; i < 80; i++) {
        const nhom = i % 2 ? "B" : "A";
        const diem = 65 + (i % 30);
        const gioiTinh = i % 2 ? "Nữ" : "Nam";
        const lop = String(10 + (i % 3));
        rows.push([String(i + 1), nhom, String(diem), gioiTinh, lop]);
      }
      // Gây thiếu: vài ô "điểm" trống (dòng 6, 15, 24, 33, 42, 51, 60, 69)
      [5, 14, 23, 32, 41, 50, 59, 68].forEach((idx) => { rows[idx][2] = ""; });
      // Gây thiếu: vài ô "giới_tính" trống (để demo fill_mode)
      [7, 18, 29].forEach((idx) => { rows[idx][3] = ""; });
      return [header, ...rows];
    },
  },
  {
    id: "sales-branch",
    name: "Doanh thu theo chi nhánh",
    domain: "Kinh doanh",
    description: "Doanh thu và chi phí quảng cáo theo tháng/chi nhánh. Thử: Crosstab, tương quan, hồi quy đơn.",
    rows: 60,
    columns: 5,
    getData: () => {
      const header = ["tháng", "chi_nhánh", "doanh_thu", "chi_quang_cao", "lợi_nhuận"];
      const branches = ["HN", "HCM", "ĐN"];
      const rows = makeRows(60, (i) => {
        const branch = branches[i % 3];
        const rev = 800 + Math.floor(Math.random() * 400);
        const ad = 50 + Math.floor(Math.random() * 80);
        return [String((i % 12) + 1), branch, String(rev), String(ad), String(rev - ad - 200)];
      });
      return [header, ...rows];
    },
  },
  {
    id: "health-bmi",
    name: "Chiều cao – Cân nặng",
    domain: "Y tế",
    description: "Số đo theo nhóm tuổi. Thử: Tương quan Pearson, hồi quy tuyến tính, phân nhóm (ANOVA).",
    rows: 70,
    columns: 4,
    getData: () => {
      const header = ["tuổi_nhóm", "chiều_cao_cm", "cân_nặng_kg", "giới_tính"];
      const rows = makeRows(70, (i) => {
        const male = i % 2 === 0;
        const h = (male ? 165 : 155) + Math.floor(Math.random() * 15);
        const w = (male ? 62 : 52) + Math.floor(Math.random() * 14);
        return [String(18 + (i % 25)), String(h), String(w), male ? "Nam" : "Nữ"];
      });
      return [header, ...rows];
    },
  },
  {
    id: "marketing-ab",
    name: "Tỷ lệ chuyển đổi A/B",
    domain: "Marketing",
    description: "Phiên bản giao diện (A/B) và trạng thái chuyển đổi. Thử: Bảng chéo, Chi-square, so sánh tỷ lệ.",
    rows: 100,
    columns: 4,
    getData: () => {
      const header = ["phiên_bản", "chuyển_đổi", "thời_gian_xem_s", "nguồn"];
      const rows = makeRows(100, (i) => [
        i % 2 ? "B" : "A",
        Math.random() > 0.6 ? "Có" : "Không",
        String(30 + Math.floor(Math.random() * 120)),
        ["Google", "Facebook", "Direct"][i % 3],
      ]);
      return [header, ...rows];
    },
  },
  {
    id: "hr-salary",
    name: "Lương theo phòng ban",
    domain: "Nhân sự",
    description: "Lương và thâm niên theo phòng. Thử: ANOVA một nhân tố, mô tả theo nhóm, hồi quy.",
    rows: 65,
    columns: 5,
    getData: () => {
      const header = ["phòng", "lương_triệu", "thâm_niên_năm", "bằng_cấp", "hiệu_suất"];
      const depts = ["Kỹ thuật", "Kinh doanh", "Hành chính"];
      const rows = makeRows(65, (i) => {
        const dept = depts[i % 3];
        const base = dept === "Kỹ thuật" ? 22 : dept === "Kinh doanh" ? 18 : 15;
        return [
          dept,
          String(base + Math.floor(Math.random() * 10)),
          String(1 + (i % 10)),
          ["ĐH", "ThS", "CĐ"][i % 3],
          String(70 + Math.floor(Math.random() * 30)),
        ];
      });
      return [header, ...rows];
    },
  },
  {
    id: "retail-products",
    name: "Doanh số theo sản phẩm",
    domain: "Bán lẻ",
    description: "Số lượng bán và doanh thu theo danh mục. Thử: Thống kê mô tả, crosstab, biểu đồ cột.",
    rows: 90,
    columns: 5,
    getData: () => {
      const header = ["mã_sp", "danh_mục", "số_lượng", "đơn_giá", "doanh_thu"];
      const cats = ["Điện tử", "Gia dụng", "Văn phòng phẩm"];
      const rows = makeRows(90, (i) => {
        const qty = 10 + Math.floor(Math.random() * 50);
        const price = 50 + Math.floor(Math.random() * 200);
        return [`SP${1000 + i}`, cats[i % 3], String(qty), String(price), String(qty * price)];
      });
      return [header, ...rows];
    },
  },
  {
    id: "survey-likert",
    name: "Khảo sát mức độ hài lòng",
    domain: "Khảo sát",
    description: "Thang Likert 5 mức cho các câu hỏi. Thử: Độ tin cậy Cronbach alpha, thống kê mô tả, phân tích nhân tố.",
    rows: 50,
    columns: 6,
    getData: () => {
      const header = ["câu_1", "câu_2", "câu_3", "câu_4", "câu_5", "nhóm_tuổi"];
      const rows = makeRows(50, (i) => [
        String(1 + Math.floor(Math.random() * 5)),
        String(1 + Math.floor(Math.random() * 5)),
        String(1 + Math.floor(Math.random() * 5)),
        String(1 + Math.floor(Math.random() * 5)),
        String(1 + Math.floor(Math.random() * 5)),
        ["18-25", "26-35", "36-45", "46+"][i % 4],
      ]);
      return [header, ...rows];
    },
  },
  {
    id: "sport-performance",
    name: "Thành tích chạy theo độ tuổi",
    domain: "Thể thao",
    description: "Thời gian chạy 5km và chỉ số sức bền. Thử: Tương quan, hồi quy, so sánh nhóm tuổi.",
    rows: 55,
    columns: 4,
    getData: () => {
      const header = ["độ_tuổi", "thời_gian_phút", "nhịp_tim_trung_bình", "giới_tính"];
      const rows = makeRows(55, (i) => {
        const age = 20 + (i % 25);
        const time = 22 + age / 5 + (Math.random() * 4);
        return [String(age), time.toFixed(1), String(140 + Math.floor(Math.random() * 25)), i % 2 ? "Nữ" : "Nam"];
      });
      return [header, ...rows];
    },
  },
  {
    id: "env-temp",
    name: "Nhiệt độ – Độ ẩm",
    domain: "Môi trường",
    description: "Số đo nhiệt độ và độ ẩm theo ngày. Thử: Tương quan, biểu đồ đường, mô tả theo mùa.",
    rows: 60,
    columns: 4,
    getData: () => {
      const header = ["ngày", "nhiệt_độ_C", "độ_ẩm_%", "mùa"];
      const seasons = ["Xuân", "Hạ", "Thu", "Đông"];
      const rows = makeRows(60, (i) => [
        String(i + 1),
        String(25 + (i % 15) + Math.random() * 3),
        String(60 + Math.floor(Math.random() * 35)),
        seasons[Math.floor(i / 15) % 4],
      ]);
      return [header, ...rows];
    },
  },
  {
    id: "finance-quarterly",
    name: "Lợi nhuận theo quý",
    domain: "Tài chính",
    description: "Doanh thu, chi phí, lợi nhuận theo quý và khu vực. Thử: Mô tả, ANOVA, xu hướng.",
    rows: 48,
    columns: 5,
    getData: () => {
      const header = ["năm", "quý", "doanh_thu", "chi_phí", "lợi_nhuận"];
      const rows = makeRows(48, (i) => {
        const rev = 1000 + Math.floor(Math.random() * 500);
        const cost = 600 + Math.floor(Math.random() * 300);
        return [String(2020 + Math.floor(i / 4)), String((i % 4) + 1), String(rev), String(cost), String(rev - cost)];
      });
      return [header, ...rows];
    },
  },
  {
    id: "customer-seg",
    name: "Phân khúc khách hàng",
    domain: "CRM",
    description: "Đặc điểm khách hàng để phân cụm. Thử: K-means, mô tả theo nhóm, tương quan.",
    rows: 75,
    columns: 5,
    getData: () => {
      const header = ["tuổi", "thu_nhập_tr", "số_giao_dịch", "giá_trị_đơn_tr", "khu_vực"];
      const rows = makeRows(75, (i) => [
        String(22 + (i % 30)),
        String(15 + Math.floor(Math.random() * 40)),
        String(2 + Math.floor(Math.random() * 20)),
        String(200 + Math.floor(Math.random() * 800)),
        ["Bắc", "Trung", "Nam"][i % 3],
      ]);
      return [header, ...rows];
    },
  },
];
