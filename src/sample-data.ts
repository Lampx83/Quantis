/**
 * Dữ liệu mẫu cho Quantis — phong phú, đầy đủ, dài: nhiều dataset và workflow mẫu.
 */

import type { Dataset, Workflow, WorkflowStep } from "./types";
import { generateId } from "./store";

const now = new Date().toISOString();

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
    createdAt: now,
    updatedAt: now,
  };
}
