/**
 * Danh sách bộ dữ liệu mẫu đa lĩnh vực để thử nghiệm phân tích trên Quantis.
 * Mỗi bộ có name, domain, description, tags (từ khóa tìm kiếm / loại phân tích) và getData() trả về [header, ...rows].
 */

import { t } from "./i18n";

export interface SampleDatasetDef {
  id: string;
  name: string;
  domain: string;
  description: string;
  /** Từ khóa tìm kiếm và loại phân tích có thể chạy (t-test, ANOVA, Chi-square, tương quan, hồi quy, Cronbach, EFA, K-means, ...) */
  tags?: string[];
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
    name: t("sampleDatasets.eduScores.name"),
    domain: t("sampleDatasets.eduScores.domain"),
    description: t("sampleDatasets.eduScores.description"),
    tags: [
      t("sampleDatasets.eduScores.tags.0"),
      t("sampleDatasets.eduScores.tags.1"),
      t("sampleDatasets.eduScores.tags.2"),
      t("sampleDatasets.eduScores.tags.3"),
      t("sampleDatasets.eduScores.tags.4"),
      t("sampleDatasets.eduScores.tags.5"),
      t("sampleDatasets.eduScores.tags.6"),
      t("sampleDatasets.eduScores.tags.7"),
      t("sampleDatasets.eduScores.tags.8"),
    ],
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
    name: t("sampleDatasets.salesBranch.name"),
    domain: t("sampleDatasets.salesBranch.domain"),
    description: t("sampleDatasets.salesBranch.description"),
    tags: [
      t("sampleDatasets.salesBranch.tags.0"),
      t("sampleDatasets.salesBranch.tags.1"),
      t("sampleDatasets.salesBranch.tags.2"),
      t("sampleDatasets.salesBranch.tags.3"),
      t("sampleDatasets.salesBranch.tags.4"),
      t("sampleDatasets.salesBranch.tags.5"),
      t("sampleDatasets.salesBranch.tags.6"),
    ],
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
    name: t("sampleDatasets.healthBmi.name"),
    domain: t("sampleDatasets.healthBmi.domain"),
    description: t("sampleDatasets.healthBmi.description"),
    tags: [
      t("sampleDatasets.healthBmi.tags.0"),
      t("sampleDatasets.healthBmi.tags.1"),
      t("sampleDatasets.healthBmi.tags.2"),
      t("sampleDatasets.healthBmi.tags.3"),
      t("sampleDatasets.healthBmi.tags.4"),
      t("sampleDatasets.healthBmi.tags.5"),
      t("sampleDatasets.healthBmi.tags.6"),
      t("sampleDatasets.healthBmi.tags.7"),
    ],
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
    name: t("sampleDatasets.marketingAb.name"),
    domain: t("sampleDatasets.marketingAb.domain"),
    description: t("sampleDatasets.marketingAb.description"),
    tags: [
      t("sampleDatasets.marketingAb.tags.0"),
      t("sampleDatasets.marketingAb.tags.1"),
      t("sampleDatasets.marketingAb.tags.2"),
      t("sampleDatasets.marketingAb.tags.3"),
      t("sampleDatasets.marketingAb.tags.4"),
      t("sampleDatasets.marketingAb.tags.5"),
      t("sampleDatasets.marketingAb.tags.6"),
    ],
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
    name: t("sampleDatasets.hrSalary.name"),
    domain: t("sampleDatasets.hrSalary.domain"),
    description: t("sampleDatasets.hrSalary.description"),
    tags: [
      t("sampleDatasets.hrSalary.tags.0"),
      t("sampleDatasets.hrSalary.tags.1"),
      t("sampleDatasets.hrSalary.tags.2"),
      t("sampleDatasets.hrSalary.tags.3"),
      t("sampleDatasets.hrSalary.tags.4"),
      t("sampleDatasets.hrSalary.tags.5"),
    ],
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
    name: t("sampleDatasets.retailProducts.name"),
    domain: t("sampleDatasets.retailProducts.domain"),
    description: t("sampleDatasets.retailProducts.description"),
    tags: [
      t("sampleDatasets.retailProducts.tags.0"),
      t("sampleDatasets.retailProducts.tags.1"),
      t("sampleDatasets.retailProducts.tags.2"),
      t("sampleDatasets.retailProducts.tags.3"),
    ],
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
    name: t("sampleDatasets.surveyLikert.name"),
    domain: t("sampleDatasets.surveyLikert.domain"),
    description: t("sampleDatasets.surveyLikert.description"),
    tags: [
      t("sampleDatasets.surveyLikert.tags.0"),
      t("sampleDatasets.surveyLikert.tags.1"),
      t("sampleDatasets.surveyLikert.tags.2"),
      t("sampleDatasets.surveyLikert.tags.3"),
      t("sampleDatasets.surveyLikert.tags.4"),
      t("sampleDatasets.surveyLikert.tags.5"),
      t("sampleDatasets.surveyLikert.tags.6"),
    ],
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
    name: t("sampleDatasets.sportPerformance.name"),
    domain: t("sampleDatasets.sportPerformance.domain"),
    description: t("sampleDatasets.sportPerformance.description"),
    tags: [
      t("sampleDatasets.sportPerformance.tags.0"),
      t("sampleDatasets.sportPerformance.tags.1"),
      t("sampleDatasets.sportPerformance.tags.2"),
      t("sampleDatasets.sportPerformance.tags.3"),
      t("sampleDatasets.sportPerformance.tags.4"),
      t("sampleDatasets.sportPerformance.tags.5"),
    ],
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
    name: t("sampleDatasets.envTemp.name"),
    domain: t("sampleDatasets.envTemp.domain"),
    description: t("sampleDatasets.envTemp.description"),
    tags: [
      t("sampleDatasets.envTemp.tags.0"),
      t("sampleDatasets.envTemp.tags.1"),
      t("sampleDatasets.envTemp.tags.2"),
      t("sampleDatasets.envTemp.tags.3"),
    ],
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
    name: t("sampleDatasets.financeQuarterly.name"),
    domain: t("sampleDatasets.financeQuarterly.domain"),
    description: t("sampleDatasets.financeQuarterly.description"),
    tags: [
      t("sampleDatasets.financeQuarterly.tags.0"),
      t("sampleDatasets.financeQuarterly.tags.1"),
      t("sampleDatasets.financeQuarterly.tags.2"),
      t("sampleDatasets.financeQuarterly.tags.3"),
    ],
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
    name: t("sampleDatasets.customerSeg.name"),
    domain: t("sampleDatasets.customerSeg.domain"),
    description: t("sampleDatasets.customerSeg.description"),
    tags: [
      t("sampleDatasets.customerSeg.tags.0"),
      t("sampleDatasets.customerSeg.tags.1"),
      t("sampleDatasets.customerSeg.tags.2"),
      t("sampleDatasets.customerSeg.tags.3"),
      t("sampleDatasets.customerSeg.tags.4"),
      t("sampleDatasets.customerSeg.tags.5"),
    ],
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
  {
    id: "prepost-intervention",
    name: t("sampleDatasets.prepostIntervention.name"),
    domain: t("sampleDatasets.prepostIntervention.domain"),
    description: t("sampleDatasets.prepostIntervention.description"),
    tags: [
      t("sampleDatasets.prepostIntervention.tags.0"),
      t("sampleDatasets.prepostIntervention.tags.1"),
      t("sampleDatasets.prepostIntervention.tags.2"),
      t("sampleDatasets.prepostIntervention.tags.3"),
      t("sampleDatasets.prepostIntervention.tags.4"),
      t("sampleDatasets.prepostIntervention.tags.5"),
      t("sampleDatasets.prepostIntervention.tags.6"),
    ],
    rows: 48,
    columns: 5,
    getData: () => {
      const header = ["id", "nhóm", "điểm_trước", "điểm_sau", "chênh_lệch"];
      const rows: string[][] = [];
      for (let i = 0; i < 48; i++) {
        const nhom = i % 2 ? "can_thiệp" : "đối_chứng";
        const truoc = 50 + Math.floor(Math.random() * 20);
        const sau = nhom === "can_thiệp" ? truoc + 5 + Math.floor(Math.random() * 12) : truoc + Math.floor(Math.random() * 5);
        const chenh = sau - truoc;
        rows.push([String(i + 1), nhom, String(truoc), String(sau), String(chenh)]);
      }
      return [header, ...rows];
    },
  },
];
