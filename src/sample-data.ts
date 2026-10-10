/**
 * Dữ liệu mẫu cho Quantis — phong phú, đầy đủ, dài: nhiều dataset và workflow mẫu.
 */

import type { Dataset, Workflow, WorkflowStep } from "./types";
import { generateId } from "./store";
import { fetchSampleDatasetFull } from "./api";
import { t } from "./i18n";

const now = new Date().toISOString();

/** Tạo Dataset từ một sample dataset (admin-curated, tải từ backend) theo id. Trả về null nếu không tải được. */
async function datasetFromSampleId(sampleId: string): Promise<Dataset | null> {
  const full = await fetchSampleDatasetFull(sampleId);
  if (!full) return null;
  const id = generateId();
  const headers = full.header ?? full.data?.[0] ?? [];
  const dataRows = full.rows_data ?? (full.data ?? []).slice(1);
  const data = full.data ?? [headers, ...dataRows];
  if (!headers.length) return null;
  const preview = data.slice(0, 8);
  return {
    id,
    name: full.name,
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
    name: t("sampleData.sampleDataset1.name"),
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
    name: t("sampleData.sampleDataset2.name"),
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
    { id: generateId(), type: "import", label: t("sampleData.sampleWorkflow1.steps.import.label"), config: { datasetId }, order: 1, createdAt: now },
    { id: generateId(), type: "clean", label: t("sampleData.sampleWorkflow1.steps.clean.label"), config: { columns: ["score", "age"] }, order: 2, createdAt: now },
    { id: generateId(), type: "describe", label: t("sampleData.sampleWorkflow1.steps.describe.label"), config: { columns: ["score", "group", "gender", "region"] }, order: 3, createdAt: now },
    { id: generateId(), type: "test", label: t("sampleData.sampleWorkflow1.steps.test.label"), config: { groupBy: "group", variable: "score" }, order: 4, createdAt: now },
    { id: generateId(), type: "visualize", label: t("sampleData.sampleWorkflow1.steps.visualize.label"), config: { x: "group", y: "score" }, order: 5, createdAt: now },
    { id: generateId(), type: "report", label: t("sampleData.sampleWorkflow1.steps.report.label"), config: {}, order: 6, createdAt: now },
  ];
  return {
    id,
    name: t("sampleData.sampleWorkflow1.name"),
    description: t("sampleData.sampleWorkflow1.description"),
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
    { id: generateId(), type: "import", label: t("sampleData.sampleWorkflow2.steps.import.label"), config: { datasetId }, order: 1, createdAt: now },
    { id: generateId(), type: "describe", label: t("sampleData.sampleWorkflow2.steps.describe.label"), config: { columns: ["satisfaction", "recommend", "support", "faculty", "semester"] }, order: 2, createdAt: now },
    { id: generateId(), type: "visualize", label: t("sampleData.sampleWorkflow2.steps.visualize.label"), config: { x: "faculty", y: "satisfaction" }, order: 3, createdAt: now },
  ];
  return {
    id,
    name: t("sampleData.sampleWorkflow2.name"),
    description: t("sampleData.sampleWorkflow2.description"),
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
    { id: generateId(), type: "import", label: t("sampleData.stepLabel.import"), config: {}, order: 0, createdAt: now },
    { id: generateId(), type: "clean", label: t("sampleData.stepLabel.clean"), config: {}, order: 1, createdAt: now },
    { id: generateId(), type: "transform", label: t("sampleData.stepLabel.transform"), config: {}, order: 2, createdAt: now },
    { id: generateId(), type: "describe", label: t("sampleData.stepLabel.describe"), config: {}, order: 3, createdAt: now },
    { id: generateId(), type: "test", label: t("sampleData.stepLabel.test"), config: {}, order: 4, createdAt: now },
    { id: generateId(), type: "model", label: t("sampleData.stepLabel.model"), config: {}, order: 5, createdAt: now },
    { id: generateId(), type: "visualize", label: t("sampleData.stepLabel.visualize"), config: {}, order: 6, createdAt: now },
    { id: generateId(), type: "report", label: t("sampleData.stepLabel.report"), config: {}, order: 7, createdAt: now },
  ];
  return {
    id,
    name: t("sampleData.defaultWorkflow.name"),
    description: t("sampleData.defaultWorkflow.description"),
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
    { id: generateId(), type: "import", label: t("sampleData.stepLabel.import"), config: {}, order: 0, createdAt: now },
    { id: generateId(), type: "clean", label: t("sampleData.stepLabel.clean"), config: {}, order: 1, createdAt: now },
    { id: generateId(), type: "transform", label: t("sampleData.stepLabel.transform"), config: {}, order: 2, createdAt: now },
    { id: generateId(), type: "describe", label: t("sampleData.stepLabel.describe"), config: {}, order: 3, createdAt: now },
    { id: generateId(), type: "test", label: t("sampleData.stepLabel.test"), config: {}, order: 4, createdAt: now },
    { id: generateId(), type: "model", label: t("sampleData.stepLabel.model"), config: {}, order: 5, createdAt: now },
    { id: generateId(), type: "visualize", label: t("sampleData.stepLabel.visualize"), config: {}, order: 6, createdAt: now },
    { id: generateId(), type: "report", label: t("sampleData.stepLabel.report"), config: {}, order: 7, createdAt: now },
  ];
  return {
    id,
    name: t("sampleData.standaloneWorkflow.name"),
    description: t("sampleData.standaloneWorkflow.description"),
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
    { id: generateId(), type: "import", label: t("sampleData.demoWorkflow.steps.import.label"), config: {}, order: 0, createdAt: now },
    { id: generateId(), type: "clean", label: t("sampleData.demoWorkflow.steps.clean.label"), config: {}, order: 1, createdAt: now },
    { id: generateId(), type: "transform", label: t("sampleData.demoWorkflow.steps.transform.label"), config: {}, order: 2, createdAt: now },
    { id: generateId(), type: "describe", label: t("sampleData.demoWorkflow.steps.describe.label"), config: {}, order: 3, createdAt: now },
    { id: generateId(), type: "test", label: t("sampleData.demoWorkflow.steps.test.label"), config: {}, order: 4, createdAt: now },
    { id: generateId(), type: "model", label: t("sampleData.demoWorkflow.steps.model.label"), config: {}, order: 5, createdAt: now },
    { id: generateId(), type: "visualize", label: t("sampleData.demoWorkflow.steps.visualize.label"), config: {}, order: 6, createdAt: now },
    { id: generateId(), type: "report", label: t("sampleData.demoWorkflow.steps.report.label"), config: {}, order: 7, createdAt: now },
  ];
  return {
    id,
    name: t("sampleData.demoWorkflow.name"),
    description: t("sampleData.demoWorkflow.description"),
    steps,
    datasetId: null,
    datasetIds: [],
    createdAt: now,
    updatedAt: now,
  };
}

/** Một mẫu workflow theo lĩnh vực: chọn trong gallery, tải workflow + dữ liệu vào luôn.
 * `getWorkflowAndData` là async vì dataset nguồn giờ do admin quản lý trên backend (không còn nhúng tĩnh trong bundle);
 * trả về null nếu dataset nguồn không còn tồn tại (vd. admin vừa xóa). */
export interface DemoWorkflowTemplate {
  id: string;
  domain: string;
  name: string;
  description: string;
  getWorkflowAndData: () => Promise<{ workflow: Workflow; datasets: Dataset[] } | null>;
}

/** Danh sách mẫu workflow đa lĩnh vực — hiển thị trong cửa sổ chọn mẫu. Mỗi mẫu tham chiếu tới id
 * của một sample dataset admin-curated (xem backend quantis.sample_datasets); dữ liệu được tải qua API. */
export function getDemoWorkflowTemplates(): DemoWorkflowTemplate[] {
  function makeSteps(
    summaries: Record<number, string>,
    datasetRows: number,
    datasetCols: number
  ): WorkflowStep[] {
    const defaults: WorkflowStep[] = [
      { id: generateId(), type: "import", label: t("sampleData.demoTemplates.stepLabel.import"), config: {}, order: 0, createdAt: now, resultSummary: summaries[0] ?? `${t("sampleData.demoTemplates.stepSummary.importDefaultPrefix")} ${datasetRows} ${t("sampleData.demoTemplates.stepSummary.importDefaultRowsUnit")}, ${datasetCols} ${t("sampleData.demoTemplates.stepSummary.importDefaultColsUnit")}` },
      { id: generateId(), type: "clean", label: t("sampleData.demoTemplates.stepLabel.clean"), config: {}, order: 1, createdAt: now, resultSummary: summaries[1] ?? t("sampleData.demoTemplates.stepSummary.cleanDefault") },
      { id: generateId(), type: "transform", label: t("sampleData.demoTemplates.stepLabel.transform"), config: {}, order: 2, createdAt: now, resultSummary: summaries[2] ?? t("sampleData.demoTemplates.stepSummary.transformDefault") },
      { id: generateId(), type: "describe", label: t("sampleData.demoTemplates.stepLabel.describe"), config: {}, order: 3, createdAt: now, resultSummary: summaries[3] ?? t("sampleData.demoTemplates.stepSummary.describeDefault") },
      { id: generateId(), type: "test", label: t("sampleData.stepLabel.test"), config: {}, order: 4, createdAt: now, resultSummary: summaries[4] ?? t("sampleData.demoTemplates.stepSummary.testDefault") },
      { id: generateId(), type: "model", label: t("sampleData.demoTemplates.stepLabel.model"), config: {}, order: 5, createdAt: now, resultSummary: summaries[5] ?? t("sampleData.demoTemplates.stepSummary.modelDefault") },
      { id: generateId(), type: "visualize", label: t("sampleData.stepLabel.visualize"), config: {}, order: 6, createdAt: now, resultSummary: summaries[6] ?? t("sampleData.demoTemplates.stepSummary.visualizeDefault") },
      { id: generateId(), type: "report", label: t("sampleData.demoTemplates.stepLabel.report"), config: {}, order: 7, createdAt: now, resultSummary: summaries[7] ?? t("sampleData.demoTemplates.stepSummary.reportDefault") },
    ];
    return defaults;
  }

  return [
    {
      id: "demo-edu",
      domain: t("sampleData.demoTemplates.eduAB.domain"),
      name: t("sampleData.demoTemplates.eduAB.name"),
      description: t("sampleData.demoTemplates.eduAB.description"),
      getWorkflowAndData: async () => {
        const d = await datasetFromSampleId("edu-scores");
        if (!d) return null;
        const steps = makeSteps(
          { 0: t("sampleData.demoTemplates.eduAB.steps.import.resultSummary"), 3: t("sampleData.demoTemplates.eduAB.steps.describe.resultSummary"), 4: t("sampleData.demoTemplates.eduAB.steps.test.resultSummary") },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: t("sampleData.demoTemplates.eduAB.workflowName"), description: t("sampleData.demoTemplates.eduAB.workflowDescription"), steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
    {
      id: "demo-econ",
      domain: t("sampleData.demoTemplates.econRevenue.domain"),
      name: t("sampleData.demoTemplates.econRevenue.name"),
      description: t("sampleData.demoTemplates.econRevenue.description"),
      getWorkflowAndData: async () => {
        const d = await datasetFromSampleId("sales-branch");
        if (!d) return null;
        const steps = makeSteps(
          { 0: t("sampleData.demoTemplates.econRevenue.steps.import.resultSummary"), 3: t("sampleData.demoTemplates.econRevenue.steps.describe.resultSummary"), 4: t("sampleData.demoTemplates.econRevenue.steps.test.resultSummary") },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: t("sampleData.demoTemplates.econRevenue.workflowName"), description: t("sampleData.demoTemplates.econRevenue.workflowDescription"), steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
    {
      id: "demo-social",
      domain: t("sampleData.demoTemplates.socialSurvey.domain"),
      name: t("sampleData.demoTemplates.socialSurvey.name"),
      description: t("sampleData.demoTemplates.socialSurvey.description"),
      getWorkflowAndData: async () => {
        const d = await datasetFromSampleId("survey-likert");
        if (!d) return null;
        const steps = makeSteps(
          { 0: t("sampleData.demoTemplates.socialSurvey.steps.import.resultSummary"), 3: t("sampleData.demoTemplates.socialSurvey.steps.describe.resultSummary"), 4: t("sampleData.demoTemplates.socialSurvey.steps.test.resultSummary") },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: t("sampleData.demoTemplates.socialSurvey.workflowName"), description: t("sampleData.demoTemplates.socialSurvey.workflowDescription"), steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
    {
      id: "demo-tech",
      domain: t("sampleData.demoTemplates.techEnv.domain"),
      name: t("sampleData.demoTemplates.techEnv.name"),
      description: t("sampleData.demoTemplates.techEnv.description"),
      getWorkflowAndData: async () => {
        const d = await datasetFromSampleId("env-temp");
        if (!d) return null;
        const steps = makeSteps(
          { 0: t("sampleData.demoTemplates.techEnv.steps.import.resultSummary"), 3: t("sampleData.demoTemplates.techEnv.steps.describe.resultSummary"), 6: t("sampleData.demoTemplates.techEnv.steps.visualize.resultSummary") },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: t("sampleData.demoTemplates.techEnv.workflowName"), description: t("sampleData.demoTemplates.techEnv.workflowDescription"), steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
    {
      id: "demo-it",
      domain: t("sampleData.demoTemplates.itAbTest.domain"),
      name: t("sampleData.demoTemplates.itAbTest.name"),
      description: t("sampleData.demoTemplates.itAbTest.description"),
      getWorkflowAndData: async () => {
        const d = await datasetFromSampleId("marketing-ab");
        if (!d) return null;
        const steps = makeSteps(
          { 0: t("sampleData.demoTemplates.itAbTest.steps.import.resultSummary"), 3: t("sampleData.demoTemplates.itAbTest.steps.describe.resultSummary"), 4: t("sampleData.demoTemplates.itAbTest.steps.test.resultSummary") },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: t("sampleData.demoTemplates.itAbTest.workflowName"), description: t("sampleData.demoTemplates.itAbTest.workflowDescription"), steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
    {
      id: "demo-health",
      domain: t("sampleData.demoTemplates.healthBmi.domain"),
      name: t("sampleData.demoTemplates.healthBmi.name"),
      description: t("sampleData.demoTemplates.healthBmi.description"),
      getWorkflowAndData: async () => {
        const d = await datasetFromSampleId("health-bmi");
        if (!d) return null;
        const steps = makeSteps(
          { 0: t("sampleData.demoTemplates.healthBmi.steps.import.resultSummary"), 3: t("sampleData.demoTemplates.healthBmi.steps.describe.resultSummary"), 4: t("sampleData.demoTemplates.healthBmi.steps.test.resultSummary") },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: t("sampleData.demoTemplates.healthBmi.workflowName"), description: t("sampleData.demoTemplates.healthBmi.workflowDescription"), steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
    {
      id: "demo-crm",
      domain: t("sampleData.demoTemplates.crmSegmentation.domain"),
      name: t("sampleData.demoTemplates.crmSegmentation.name"),
      description: t("sampleData.demoTemplates.crmSegmentation.description"),
      getWorkflowAndData: async () => {
        const d = await datasetFromSampleId("customer-seg");
        if (!d) return null;
        const steps = makeSteps(
          { 0: t("sampleData.demoTemplates.crmSegmentation.steps.import.resultSummary"), 3: t("sampleData.demoTemplates.crmSegmentation.steps.describe.resultSummary"), 5: t("sampleData.demoTemplates.crmSegmentation.steps.model.resultSummary") },
          d.rows,
          d.columns
        );
        const w: Workflow = { id: generateId(), name: t("sampleData.demoTemplates.crmSegmentation.workflowName"), description: t("sampleData.demoTemplates.crmSegmentation.workflowDescription"), steps, datasetId: d.id, datasetIds: [d.id], createdAt: now, updatedAt: now };
        return { workflow: w, datasets: [d] };
      },
    },
  ];
}
