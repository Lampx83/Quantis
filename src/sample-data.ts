/**
 * Dữ liệu mẫu cho Quantis — phong phú, đầy đủ, dài: nhiều dataset và workflow mẫu.
 */

import type { Dataset, Workflow, WorkflowStep } from "./types";
import { generateId } from "./store";
import { SAMPLE_DATASETS, type SampleDatasetDef } from "./sampleDatasets";

const now = new Date().toISOString();

/** Tạo Dataset từ định nghĩa mẫu (SAMPLE_DATASETS) */
function datasetFromSampleDef(def: SampleDatasetDef): Dataset {
  const id = generateId();
  const raw = def.getData();
  const headers = raw[0];
  const dataRows = raw.slice(1);
  const data = raw;
  const preview = data.slice(0, 8);
  return {
    id,
    name: def.name,
    rows: dataRows.length,
    columns: headers.length,
    columnNames: headers,
    preview,
    data,
    sourceFormat: "csv",
    createdAt: now,
    updatedAt: now,
  };
}

/** Dataset 1: Điểm khảo sát (nhóm đối chứng vs can thiệp) — mở rộng 40 dòng */
const SAMPLE_CSV_ROWS: string[][] = [
  ["group", "score", "gender", "age", "region"],
  ["control", "62", "M", "20", "urban"],
  ["control", "58", "F", "22", "rural"],
  ["control", "65", "M", "19", "urban"],
  ["control", "71", "F", "21", "urban"],
  ["control", "59", "M", "23", "rural"],
  ["control", "64", "F", "20", "urban"],
  ["control", "68", "M", "22", "urban"],
  ["control", "61", "F", "21", "rural"],
  ["control", "70", "M", "19", "urban"],
  ["control", "63", "F", "23", "urban"],
  ["control", "66", "M", "20", "rural"],
  ["control", "57", "F", "24", "rural"],
  ["control", "69", "M", "21", "urban"],
  ["control", "60", "F", "22", "urban"],
  ["control", "72", "M", "18", "urban"],
  ["treatment", "72", "M", "20", "urban"],
  ["treatment", "78", "F", "22", "urban"],
  ["treatment", "75", "M", "19", "rural"],
  ["treatment", "80", "F", "21", "urban"],
  ["treatment", "74", "M", "23", "urban"],
  ["treatment", "79", "F", "20", "rural"],
  ["treatment", "76", "M", "22", "urban"],
  ["treatment", "81", "F", "21", "urban"],
  ["treatment", "73", "M", "19", "urban"],
  ["treatment", "77", "F", "23", "rural"],
  ["treatment", "82", "M", "20", "urban"],
  ["treatment", "74", "F", "24", "urban"],
  ["treatment", "79", "M", "21", "rural"],
  ["treatment", "83", "F", "22", "urban"],
  ["treatment", "76", "M", "20", "urban"],
  ["treatment", "78", "F", "19", "urban"],
  ["treatment", "80", "M", "23", "rural"],
  ["treatment", "75", "F", "21", "urban"],
  ["treatment", "81", "M", "22", "urban"],
  ["treatment", "77", "F", "20", "urban"],
  ["treatment", "84", "M", "19", "urban"],
  ["treatment", "79", "F", "23", "rural"],
  ["treatment", "82", "M", "21", "urban"],
  ["treatment", "76", "F", "24", "urban"],
  ["treatment", "80", "M", "20", "urban"],
];

/** Dataset 2: Khảo sát mức độ hài lòng (Likert 1–5) theo khoa và học kỳ */
const SAMPLE_LIKERT_ROWS: string[][] = [
  ["faculty", "semester", "satisfaction", "recommend", "support"],
  ["CNTT", "HK1", "4", "5", "4"],
  ["CNTT", "HK1", "5", "5", "4"],
  ["CNTT", "HK1", "4", "4", "3"],
  ["CNTT", "HK2", "4", "5", "5"],
  ["CNTT", "HK2", "5", "5", "4"],
  ["KT", "HK1", "3", "4", "3"],
  ["KT", "HK1", "4", "4", "4"],
  ["KT", "HK2", "4", "5", "4"],
  ["KT", "HK2", "3", "3", "3"],
  ["NN", "HK1", "5", "5", "5"],
  ["NN", "HK1", "4", "4", "4"],
  ["NN", "HK2", "4", "5", "4"],
  ["NN", "HK2", "5", "5", "5"],
  ["SP", "HK1", "3", "3", "3"],
  ["SP", "HK1", "4", "4", "4"],
  ["SP", "HK2", "4", "4", "4"],
  ["SP", "HK2", "3", "4", "3"],
  ["GD", "HK1", "5", "5", "4"],
  ["GD", "HK1", "4", "5", "5"],
  ["GD", "HK2", "4", "4", "4"],
  ["GD", "HK2", "5", "5", "5"],
  ["Y", "HK1", "4", "4", "4"],
  ["Y", "HK1", "5", "5", "5"],
  ["Y", "HK2", "4", "5", "4"],
  ["Y", "HK2", "4", "4", "4"],
];

export function getSampleDataset(): Dataset {
  const id = generateId();
  const headers = SAMPLE_CSV_ROWS[0];
  const dataRows = SAMPLE_CSV_ROWS.slice(1);
  const data: string[][] = [headers, ...dataRows];
  const preview = data.slice(0, 8);
  return {
    id,
    name: "Khảo sát mẫu — Điểm nhóm đối chứng vs can thiệp (mở rộng)",
    rows: dataRows.length,
    columns: headers.length,
    columnNames: headers,
    preview,
    data,
    sourceFormat: "csv",
    createdAt: now,
    updatedAt: now,
  };
}

export function getSampleDataset2(): Dataset {
  const id = generateId();
  const headers = SAMPLE_LIKERT_ROWS[0];
  const dataRows = SAMPLE_LIKERT_ROWS.slice(1);
  const data: string[][] = [headers, ...dataRows];
  const preview = data.slice(0, 8);
  return {
    id,
    name: "Khảo sát hài lòng — Likert theo khoa và học kỳ",
    rows: dataRows.length,
    columns: headers.length,
    columnNames: headers,
    preview,
    data,
    sourceFormat: "csv",
    createdAt: now,
    updatedAt: now,
  };
}

export function getSampleWorkflow(datasetId: string): Workflow {
  const id = generateId();
  const steps: WorkflowStep[] = [
    { id: generateId(), type: "import", label: "Import dữ liệu CSV", config: { datasetId }, order: 1, createdAt: now },
    { id: generateId(), type: "clean", label: "Làm sạch: kiểm tra missing, outlier", config: { columns: ["score", "age"] }, order: 2, createdAt: now },
    { id: generateId(), type: "describe", label: "Thống kê mô tả theo nhóm", config: { columns: ["score", "group", "gender", "region"] }, order: 3, createdAt: now },
    { id: generateId(), type: "test", label: "Kiểm định t (điểm theo nhóm control/treatment)", config: { groupBy: "group", variable: "score" }, order: 4, createdAt: now },
    { id: generateId(), type: "visualize", label: "Biểu đồ so sánh điểm (boxplot, cột)", config: { x: "group", y: "score" }, order: 5, createdAt: now },
    { id: generateId(), type: "report", label: "Sinh báo cáo tóm tắt", config: {}, order: 6, createdAt: now },
  ];
  return {
    id,
    name: "Workflow mẫu — So sánh hai nhóm (đầy đủ bước)",
    description: "Import → Làm sạch → Thống kê mô tả → Kiểm định t → Trực quan → Báo cáo. Áp dụng cho dataset điểm khảo sát.",
    steps,
    datasetId,
    datasetIds: [datasetId],
    createdAt: now,
    updatedAt: now,
  };
}

export function getSampleWorkflow2(datasetId: string): Workflow {
  const id = generateId();
  const steps: WorkflowStep[] = [
    { id: generateId(), type: "import", label: "Import dữ liệu Likert", config: { datasetId }, order: 1, createdAt: now },
    { id: generateId(), type: "describe", label: "Thống kê mô tả theo khoa và học kỳ", config: { columns: ["satisfaction", "recommend", "support", "faculty", "semester"] }, order: 2, createdAt: now },
    { id: generateId(), type: "visualize", label: "Biểu đồ cột trung bình hài lòng theo khoa", config: { x: "faculty", y: "satisfaction" }, order: 3, createdAt: now },
  ];
  return {
    id,
    name: "Workflow mẫu — Phân tích hài lòng theo khoa",
    description: "Import → Mô tả → Trực quan. Dùng với dataset khảo sát hài lòng (Likert).",
    steps,
    datasetId,
    datasetIds: [datasetId],
    createdAt: now,
    updatedAt: now,
  };
}

/** Workflow phân tích dữ liệu tiêu chuẩn — hiển thị mặc định bên trái khi chưa có workflow nào.
 * Thứ tự theo quy trình nghiên cứu định lượng: Thu thập → Làm sạch → Chuẩn bị biến → Mô tả → Kiểm định → Mô hình → Trực quan → Báo cáo. */
export function getDefaultStandardWorkflow(): Workflow {
  const id = generateId();
  const steps: WorkflowStep[] = [
    { id: generateId(), type: "import", label: "Thu thập / Import dữ liệu", config: {}, order: 0, createdAt: now },
    { id: generateId(), type: "clean", label: "Làm sạch & kiểm tra chất lượng", config: {}, order: 1, createdAt: now },
    { id: generateId(), type: "transform", label: "Chuẩn bị biến & biến đổi", config: {}, order: 2, createdAt: now },
    { id: generateId(), type: "describe", label: "Thống kê mô tả (EDA)", config: {}, order: 3, createdAt: now },
    { id: generateId(), type: "test", label: "Kiểm định giả thuyết", config: {}, order: 4, createdAt: now },
    { id: generateId(), type: "model", label: "Hồi quy & mô hình", config: {}, order: 5, createdAt: now },
    { id: generateId(), type: "visualize", label: "Trực quan hóa", config: {}, order: 6, createdAt: now },
    { id: generateId(), type: "report", label: "Viết báo cáo", config: {}, order: 7, createdAt: now },
  ];
  return {
    id,
    name: "Workflow phân tích dữ liệu tiêu chuẩn",
    description: "Quy trình nghiên cứu định lượng: Thu thập dữ liệu → Làm sạch & chất lượng → Chuẩn bị biến → Thống kê mô tả → Kiểm định giả thuyết → Hồi quy & mô hình → Trực quan → Báo cáo.",
    steps,
    datasetId: null,
    datasetIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Workflow mẫu độc lập (không gắn dataset) — dùng khi tạo workflow mới "Mới". */
export function getSampleWorkflowStandalone(): Workflow {
  const id = generateId();
  const steps: WorkflowStep[] = [
    { id: generateId(), type: "import", label: "Thu thập / Import dữ liệu", config: {}, order: 0, createdAt: now },
    { id: generateId(), type: "clean", label: "Làm sạch & kiểm tra chất lượng", config: {}, order: 1, createdAt: now },
    { id: generateId(), type: "transform", label: "Chuẩn bị biến & biến đổi", config: {}, order: 2, createdAt: now },
    { id: generateId(), type: "describe", label: "Thống kê mô tả (EDA)", config: {}, order: 3, createdAt: now },
    { id: generateId(), type: "test", label: "Kiểm định giả thuyết", config: {}, order: 4, createdAt: now },
    { id: generateId(), type: "model", label: "Hồi quy & mô hình", config: {}, order: 5, createdAt: now },
    { id: generateId(), type: "visualize", label: "Trực quan hóa", config: {}, order: 6, createdAt: now },
    { id: generateId(), type: "report", label: "Viết báo cáo", config: {}, order: 7, createdAt: now },
  ];
  return {
    id,
    name: "Workflow mẫu — Quy trình nghiên cứu đầy đủ",
    description: "Quy trình nghiên cứu định lượng: Thu thập → Làm sạch → Chuẩn bị biến → Thống kê mô tả → Kiểm định → Hồi quy & mô hình → Trực quan → Báo cáo.",
    steps,
    datasetId: null,
    datasetIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

/**
 * Workflow demo — đầy đủ mọi loại bước, dùng để tải vào và demo hệ thống.
 * Giúp người dùng hiểu cách làm việc: từ import dữ liệu → làm sạch → biến đổi → thống kê mô tả
 * → kiểm định giả thuyết → mô hình hóa → trực quan → báo cáo.
 */
export function getDemoWorkflow(): Workflow {
  const id = generateId();
  const steps: WorkflowStep[] = [
    { id: generateId(), type: "import", label: "1. Import dữ liệu (CSV, Excel) — đưa dữ liệu vào hệ thống", config: {}, order: 0, createdAt: now },
    { id: generateId(), type: "clean", label: "2. Làm sạch dữ liệu — xử lý missing, outlier, chuẩn hóa", config: {}, order: 1, createdAt: now },
    { id: generateId(), type: "transform", label: "3. Biến đổi & pipeline — tạo biến mới, lọc, ghép bảng", config: {}, order: 2, createdAt: now },
    { id: generateId(), type: "describe", label: "4. Thống kê mô tả — mean, median, phân bố, tần suất", config: {}, order: 3, createdAt: now },
    { id: generateId(), type: "test", label: "5. Kiểm định giả thuyết — t-test, ANOVA, Chi-square, Mann-Whitney", config: {}, order: 4, createdAt: now },
    { id: generateId(), type: "model", label: "6. Mô hình hóa — hồi quy tuyến tính, logistic, SEM", config: {}, order: 5, createdAt: now },
    { id: generateId(), type: "visualize", label: "7. Trực quan hóa — biểu đồ cột, scatter, boxplot, bản đồ", config: {}, order: 6, createdAt: now },
    { id: generateId(), type: "report", label: "8. Sinh báo cáo — tóm tắt kết quả, trích dẫn APA", config: {}, order: 7, createdAt: now },
  ];
  return {
    id,
    name: "Workflow mẫu — Demo hệ thống",
    description: "Quy trình nghiên cứu đầy đủ: Import → Làm sạch → Biến đổi → Thống kê mô tả → Kiểm định → Mô hình → Trực quan → Báo cáo. Bấm từng bước để xem tính năng tương ứng.",
    steps,
    datasetId: null,
    datasetIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Một mẫu workflow theo lĩnh vực: chọn trong gallery, tải workflow + dữ liệu vào luôn */
export interface DemoWorkflowTemplate {
  id: string;
  domain: string;
  name: string;
  description: string;
  getWorkflowAndData: () => { workflow: Workflow; datasets: Dataset[] };
}

/** Danh sách mẫu workflow đa lĩnh vực — hiển thị trong cửa sổ chọn mẫu */
export function getDemoWorkflowTemplates(): DemoWorkflowTemplate[] {
  const def = (key: string) => SAMPLE_DATASETS.find((d) => d.id === key)!;

  function makeSteps(
    summaries: Record<number, string>,
    datasetRows: number,
    datasetCols: number
  ): WorkflowStep[] {
    const defaults: WorkflowStep[] = [
      { id: generateId(), type: "import", label: "Import dữ liệu", config: {}, order: 0, createdAt: now, resultSummary: summaries[0] ?? `Đã import ${datasetRows} dòng, ${datasetCols} cột` },
      { id: generateId(), type: "clean", label: "Làm sạch dữ liệu", config: {}, order: 1, createdAt: now, resultSummary: summaries[1] ?? "Đã kiểm tra missing, outlier; chuẩn hóa biến số" },
      { id: generateId(), type: "transform", label: "Biến đổi & pipeline", config: {}, order: 2, createdAt: now, resultSummary: summaries[2] ?? "Đã tạo biến mới, lọc theo điều kiện" },
      { id: generateId(), type: "describe", label: "Thống kê mô tả", config: {}, order: 3, createdAt: now, resultSummary: summaries[3] ?? "Đã chạy mean, median, độ lệch chuẩn theo nhóm" },
      { id: generateId(), type: "test", label: "Kiểm định giả thuyết", config: {}, order: 4, createdAt: now, resultSummary: summaries[4] ?? "Đã chạy t-test / ANOVA / Chi-square tùy biến" },
      { id: generateId(), type: "model", label: "Mô hình hóa", config: {}, order: 5, createdAt: now, resultSummary: summaries[5] ?? "Đã ước lượng hồi quy / phân loại" },
      { id: generateId(), type: "visualize", label: "Trực quan hóa", config: {}, order: 6, createdAt: now, resultSummary: summaries[6] ?? "Đã vẽ biểu đồ cột, boxplot, scatter" },
      { id: generateId(), type: "report", label: "Sinh báo cáo", config: {}, order: 7, createdAt: now, resultSummary: summaries[7] ?? "Đã xuất báo cáo tóm tắt và trích dẫn APA" },
    ];
    return defaults;
  }

  return [
    {
      id: "demo-edu",
      domain: "Giáo dục",
      name: "So sánh điểm hai nhóm (A/B)",
      description: "Điểm kiểm tra theo nhóm phương pháp dạy. Thống kê mô tả, t-test, so sánh trung bình.",
      getWorkflowAndData: () => {
        const d = datasetFromSampleDef(def("edu-scores"));
        const steps = makeSteps(
          { 0: "Đã import 80 dòng, 5 cột (id, nhóm, điểm, giới_tính, lớp)", 3: "Đã mô tả điểm theo nhóm A/B và lớp", 4: "Đã kiểm định t-test so sánh điểm nhóm A vs B" },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: "Workflow mẫu — Giáo dục (điểm A/B)", description: "Import → Làm sạch → Thống kê mô tả → Kiểm định t → Trực quan → Báo cáo.", steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
    {
      id: "demo-econ",
      domain: "Kinh tế",
      name: "Doanh thu theo chi nhánh",
      description: "Doanh thu và chi phí quảng cáo theo tháng/chi nhánh. Crosstab, tương quan, hồi quy.",
      getWorkflowAndData: () => {
        const d = datasetFromSampleDef(def("sales-branch"));
        const steps = makeSteps(
          { 0: "Đã import 60 dòng, 5 cột (tháng, chi_nhánh, doanh_thu, chi_quang_cao, lợi_nhuận)", 3: "Đã mô tả doanh thu theo chi nhánh và tháng", 4: "Đã so sánh lợi nhuận trung bình theo chi nhánh" },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: "Workflow mẫu — Kinh tế (doanh thu)", description: "Phân tích doanh thu theo chi nhánh và tháng.", steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
    {
      id: "demo-social",
      domain: "Xã hội",
      name: "Khảo sát mức độ hài lòng",
      description: "Thang Likert 5 mức. Cronbach alpha, thống kê mô tả, phân tích nhân tố.",
      getWorkflowAndData: () => {
        const d = datasetFromSampleDef(def("survey-likert"));
        const steps = makeSteps(
          { 0: "Đã import 50 dòng, 6 cột (câu_1–câu_5, nhóm_tuổi)", 3: "Đã mô tả điểm trung bình từng câu theo nhóm tuổi", 4: "Đã kiểm định so sánh điểm giữa các nhóm tuổi" },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: "Workflow mẫu — Xã hội (khảo sát Likert)", description: "Phân tích độ tin cậy và mô tả khảo sát.", steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
    {
      id: "demo-tech",
      domain: "Kỹ thuật",
      name: "Nhiệt độ – Độ ẩm",
      description: "Số đo nhiệt độ và độ ẩm theo ngày/mùa. Tương quan, biểu đồ đường, mô tả theo mùa.",
      getWorkflowAndData: () => {
        const d = datasetFromSampleDef(def("env-temp"));
        const steps = makeSteps(
          { 0: "Đã import 60 dòng, 4 cột (ngày, nhiệt_độ_C, độ_ẩm_%, mùa)", 3: "Đã mô tả nhiệt độ và độ ẩm theo mùa", 6: "Đã vẽ biểu đồ đường nhiệt độ theo ngày" },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: "Workflow mẫu — Kỹ thuật (nhiệt độ – độ ẩm)", description: "Phân tích số đo môi trường theo mùa.", steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
    {
      id: "demo-it",
      domain: "CNTT",
      name: "Tỷ lệ chuyển đổi A/B",
      description: "Phiên bản giao diện A/B và trạng thái chuyển đổi. Bảng chéo, Chi-square, so sánh tỷ lệ.",
      getWorkflowAndData: () => {
        const d = datasetFromSampleDef(def("marketing-ab"));
        const steps = makeSteps(
          { 0: "Đã import 100 dòng, 4 cột (phiên_bản, chuyển_đổi, thời_gian_xem_s, nguồn)", 3: "Đã mô tả tỷ lệ chuyển đổi theo phiên bản và nguồn", 4: "Đã kiểm định Chi-square phiên bản × chuyển đổi" },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: "Workflow mẫu — CNTT (A/B test)", description: "Phân tích thử nghiệm A/B và chuyển đổi.", steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
    {
      id: "demo-health",
      domain: "Y tế",
      name: "Chiều cao – Cân nặng",
      description: "Số đo theo nhóm tuổi. Tương quan Pearson, hồi quy tuyến tính, ANOVA.",
      getWorkflowAndData: () => {
        const d = datasetFromSampleDef(def("health-bmi"));
        const steps = makeSteps(
          { 0: "Đã import 70 dòng, 4 cột (tuổi_nhóm, chiều_cao_cm, cân_nặng_kg, giới_tính)", 3: "Đã mô tả chiều cao, cân nặng theo tuổi và giới", 4: "Đã tương quan Pearson và hồi quy chiều cao ~ cân nặng" },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: "Workflow mẫu — Y tế (chiều cao – cân nặng)", description: "Phân tích số đo nhân trắc và tương quan.", steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
  ];
}
