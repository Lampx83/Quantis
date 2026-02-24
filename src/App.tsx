import React, { useState, useEffect } from "react";
import {
  Database,
  FileSpreadsheet,
  BarChart3,
  FlaskConical,
  GitBranch,
  Presentation,
  Sparkles,
  ListOrdered,
  Upload,
  ScanSearch,
  Shuffle,
  Calculator,
  TestTube,
  TrendingUp,
  Cpu,
  Sigma,
  LineChart,
  FileText,
  CircleHelp,
  ChevronRight,
  CheckCircle2,
  Scale,
  Trash2,
  Download,
  Table2,
  Edit2,
  Copy,
} from "lucide-react";
import { loadDatasets, saveDatasets, loadWorkflows, saveWorkflows, generateId, loadSelectedDatasetId, saveSelectedDatasetId } from "./store";
import type { Dataset, Workflow, WorkflowStep } from "./types";
import { getSampleDataset, getSampleDataset2, getSampleWorkflow, getSampleWorkflow2 } from "./sample-data";
import * as quantisApi from "./api";
import { parseCSV, computeProfile, computeDescriptive, getDataRows, getUniqueValues, computeTTest, computeChiSquare, computeCorrelationMatrix, MAX_ROWS_STORED } from "./utils/stats";
import type { DescriptiveRow, TTestResult, ChiSquareResult } from "./utils/stats";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, CartesianGrid } from "recharts";

type DataTab = "import" | "profiling" | "transform" | "preview";
type AnalysisTab = "descriptive" | "hypothesis" | "regression" | "correlation" | "ml" | "bayesian";
type ReproducibilityTab = "workflows" | "versioning";
type PresentationTab = "visualization" | "reports";

type MainSection = "data" | "analysis" | "reproducibility" | "presentation" | "ai" | "workflow" | "compare";

const WORKFLOW_STEPS = [
  { id: "import", label: "Import dữ liệu", icon: Upload },
  { id: "profiling", label: "Data profiling", icon: ScanSearch },
  { id: "clean", label: "Làm sạch", icon: Shuffle },
  { id: "reliability", label: "Reliability & validity", icon: CheckCircle2 },
  { id: "hypothesis", label: "Kiểm định giả thuyết", icon: TestTube },
  { id: "model", label: "Mô hình hóa", icon: TrendingUp },
  { id: "visualize", label: "Visualization", icon: LineChart },
  { id: "report", label: "Sinh báo cáo", icon: FileText },
  { id: "save", label: "Lưu workflow tái lập", icon: GitBranch },
];

export default function App() {
  const [datasets, setDatasets] = useState<Dataset[]>(loadDatasets);
  const [workflows, setWorkflows] = useState<Workflow[]>(loadWorkflows);
  const [mainSection, setMainSection] = useState<MainSection>("workflow");
  const [dataTab, setDataTab] = useState<DataTab>("import");
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("descriptive");
  const [reproTab, setReproTab] = useState<ReproducibilityTab>("workflows");
  const [presentationTab, setPresentationTab] = useState<PresentationTab>("visualization");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(() => loadSelectedDatasetId());
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [aiPanelOpen, setAiPanelOpen] = useState(false);
  const [guideOpen, setGuideOpen] = useState(false);
  const [useBackend, setUseBackend] = useState(false);
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    saveDatasets(datasets);
  }, [datasets]);
  useEffect(() => {
    saveWorkflows(workflows);
  }, [workflows]);
  useEffect(() => {
    saveSelectedDatasetId(selectedDatasetId);
  }, [selectedDatasetId]);
  useEffect(() => {
    const id = loadSelectedDatasetId();
    if (id && !datasets.some((d) => d.id === id)) setSelectedDatasetId(null);
  }, [datasets]);

  useEffect(() => {
    quantisApi.checkBackendAvailable().then(setUseBackend);
  }, []);

  // Khi có backend: tải datasets + workflows từ server (nếu đã đăng nhập)
  useEffect(() => {
    if (!useBackend) return;
    quantisApi.getData().then((data) => {
      if (data) {
        setDatasets(data.datasets);
        setWorkflows(data.workflows);
      }
    });
  }, [useBackend]);

  // Khi có backend và state thay đổi: đồng bộ lên server (debounce 1.5s)
  useEffect(() => {
    if (!useBackend) return;
    const t = setTimeout(() => {
      quantisApi.saveData({ datasets, workflows });
    }, 1500);
    return () => clearTimeout(t);
  }, [useBackend, datasets, workflows]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  const loadSampleData = () => {
    if (!window.confirm("Thêm dữ liệu mẫu (2 dataset + 2 workflow) vào danh sách. Bạn có muốn tiếp tục?")) return;
    const sampleDs1 = getSampleDataset();
    const sampleDs2 = getSampleDataset2();
    const sampleWf1 = getSampleWorkflow(sampleDs1.id);
    const sampleWf2 = getSampleWorkflow2(sampleDs2.id);
    setDatasets((prev) => [...prev, sampleDs1, sampleDs2]);
    setWorkflows((prev) => [...prev, sampleWf1, sampleWf2]);
    setSelectedDatasetId(sampleDs1.id);
    setSelectedWorkflowId(sampleWf1.id);
    setMainSection("data");
    setDataTab("profiling");
  };

  return (
    <div className="flex h-screen bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
      {/* Sidebar */}
      <aside className="w-64 flex-shrink-0 border-r border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 flex flex-col">
        <div className="p-4 border-b border-neutral-200 dark:border-neutral-700">
          <div className="flex items-center gap-2">
            <div className="w-9 h-9 rounded-lg bg-emerald-600 flex items-center justify-center">
              <Sigma className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="font-semibold text-lg">Quantis</h1>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">Phân tích định lượng &amp; thống kê</p>
            </div>
          </div>
        </div>
        <nav className="flex-1 overflow-y-auto p-2">
          <button
            type="button"
            onClick={() => setMainSection("workflow")}
            className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left transition-colors ${mainSection === "workflow" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}
          >
            <ListOrdered className="w-4 h-4 flex-shrink-0" />
            <span>Workflow nghiên cứu</span>
          </button>

          <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <p className="px-3 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Data Layer</p>
            <button
              type="button"
              onClick={() => setMainSection("data")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${mainSection === "data" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}
            >
              <Database className="w-4 h-4 flex-shrink-0" />
              <span>Quản lý dữ liệu</span>
              <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${mainSection === "data" ? "rotate-90" : ""}`} />
            </button>
          </div>

          <div className="mt-1">
            <p className="px-3 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Analysis Engine</p>
            <button
              type="button"
              onClick={() => setMainSection("analysis")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${mainSection === "analysis" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}
            >
              <FlaskConical className="w-4 h-4 flex-shrink-0" />
              <span>Phân tích thống kê</span>
              <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${mainSection === "analysis" ? "rotate-90" : ""}`} />
            </button>
          </div>

          <div className="mt-1">
            <p className="px-3 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Reproducibility</p>
            <button
              type="button"
              onClick={() => setMainSection("reproducibility")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${mainSection === "reproducibility" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}
            >
              <GitBranch className="w-4 h-4 flex-shrink-0" />
              <span>Workflow &amp; phiên bản</span>
              <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${mainSection === "reproducibility" ? "rotate-90" : ""}`} />
            </button>
          </div>

          <div className="mt-1">
            <p className="px-3 py-1 text-xs font-medium text-neutral-500 dark:text-neutral-400 uppercase tracking-wider">Presentation</p>
            <button
              type="button"
              onClick={() => setMainSection("presentation")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${mainSection === "presentation" ? "bg-emerald-100 dark:bg-emerald-900/40 text-emerald-800 dark:text-emerald-200" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}
            >
              <Presentation className="w-4 h-4 flex-shrink-0" />
              <span>Trực quan &amp; báo cáo</span>
              <ChevronRight className={`w-4 h-4 ml-auto transition-transform ${mainSection === "presentation" ? "rotate-90" : ""}`} />
            </button>
          </div>

          <div className="mt-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
            <button
              type="button"
              onClick={() => { setMainSection("ai"); setAiPanelOpen(true); }}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left ${mainSection === "ai" ? "bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}
            >
              <Sparkles className="w-4 h-4 flex-shrink-0" />
              <span>AI hỗ trợ phương pháp</span>
            </button>
            <button
              type="button"
              onClick={() => setMainSection("compare")}
              className={`w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left mt-1 ${mainSection === "compare" ? "bg-sky-100 dark:bg-sky-900/40 text-sky-800 dark:text-sky-200" : "hover:bg-neutral-100 dark:hover:bg-neutral-700"}`}
            >
              <Scale className="w-4 h-4 flex-shrink-0" />
              <span>So sánh với SPSS, R, Stata, JASP</span>
            </button>
          </div>
        </nav>

        <div className="p-2 border-t border-neutral-200 dark:border-neutral-700 space-y-1">
          <button
            type="button"
            onClick={loadSampleData}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left bg-amber-100 dark:bg-amber-900/40 text-amber-800 dark:text-amber-200 hover:bg-amber-200 dark:hover:bg-amber-800/50 border border-amber-300 dark:border-amber-700"
            title="Thêm dataset và workflow mẫu"
          >
            <FileSpreadsheet className="w-4 h-4" />
            <span>Ví dụ mẫu</span>
          </button>
          <button
            type="button"
            onClick={() => setGuideOpen(true)}
            className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-left hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400"
          >
            <CircleHelp className="w-4 h-4" />
            <span>Hướng dẫn</span>
          </button>
          {useBackend && (
            <p className="px-3 py-1 text-xs text-emerald-600 dark:text-emerald-400">Đã kết nối backend</p>
          )}
        </div>
      </aside>

      {/* Sub-nav when Data / Analysis / etc. selected */}
      {(mainSection === "data" || mainSection === "analysis" || mainSection === "reproducibility" || mainSection === "presentation") && (
        <div className="w-52 flex-shrink-0 border-r border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800/80 overflow-y-auto">
          {mainSection === "data" && (
            <>
              <button type="button" onClick={() => setDataTab("import")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${dataTab === "import" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <Upload className="w-4 h-4" /> Import (CSV, Excel, SPSS…)
              </button>
              <button type="button" onClick={() => setDataTab("profiling")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${dataTab === "profiling" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <ScanSearch className="w-4 h-4" /> Data profiling
              </button>
              <button type="button" onClick={() => setDataTab("transform")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${dataTab === "transform" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <Shuffle className="w-4 h-4" /> Biến đổi &amp; pipeline
              </button>
              <button type="button" onClick={() => setDataTab("preview")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${dataTab === "preview" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <Table2 className="w-4 h-4" /> Xem dữ liệu
              </button>
            </>
          )}
          {mainSection === "analysis" && (
            <>
              <button type="button" onClick={() => setAnalysisTab("descriptive")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${analysisTab === "descriptive" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <BarChart3 className="w-4 h-4" /> Thống kê mô tả
              </button>
              <button type="button" onClick={() => setAnalysisTab("hypothesis")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${analysisTab === "hypothesis" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <TestTube className="w-4 h-4" /> Kiểm định giả thuyết
              </button>
              <button type="button" onClick={() => setAnalysisTab("regression")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${analysisTab === "regression" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <TrendingUp className="w-4 h-4" /> Hồi quy &amp; SEM
              </button>
              <button type="button" onClick={() => setAnalysisTab("correlation")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${analysisTab === "correlation" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <BarChart3 className="w-4 h-4" /> Ma trận tương quan
              </button>
              <button type="button" onClick={() => setAnalysisTab("ml")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${analysisTab === "ml" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <Cpu className="w-4 h-4" /> Machine learning
              </button>
              <button type="button" onClick={() => setAnalysisTab("bayesian")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${analysisTab === "bayesian" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <Sigma className="w-4 h-4" /> Bayesian
              </button>
            </>
          )}
          {mainSection === "reproducibility" && (
            <>
              <button type="button" onClick={() => setReproTab("workflows")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${reproTab === "workflows" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <GitBranch className="w-4 h-4" /> Workflows
              </button>
              <button type="button" onClick={() => setReproTab("versioning")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${reproTab === "versioning" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <FileSpreadsheet className="w-4 h-4" /> Versioning &amp; audit
              </button>
            </>
          )}
          {mainSection === "presentation" && (
            <>
              <button type="button" onClick={() => setPresentationTab("visualization")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${presentationTab === "visualization" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <LineChart className="w-4 h-4" /> Biểu đồ &amp; dashboard
              </button>
              <button type="button" onClick={() => setPresentationTab("reports")} className={`w-full flex items-center gap-2 px-3 py-2 text-left rounded-lg ${presentationTab === "reports" ? "bg-neutral-100 dark:bg-neutral-700" : "hover:bg-neutral-50 dark:hover:bg-neutral-700/50"}`}>
                <FileText className="w-4 h-4" /> Báo cáo học thuật
              </button>
            </>
          )}
        </div>
      )}

      {/* Main content */}
      <main className="flex-1 overflow-y-auto p-6">
        {mainSection === "workflow" && (
          <WorkflowView
            steps={WORKFLOW_STEPS}
            datasets={datasets}
            selectedDatasetId={selectedDatasetId}
            onSelectDataset={setSelectedDatasetId}
          />
        )}
        {mainSection === "data" && (
          <DataView
            tab={dataTab}
            datasets={datasets}
            setDatasets={setDatasets}
            selectedDatasetId={selectedDatasetId}
            onSelectDataset={setSelectedDatasetId}
          />
        )}
        {mainSection === "analysis" && (
          <AnalysisView tab={analysisTab} selectedDataset={selectedDataset} />
        )}
        {mainSection === "reproducibility" && (
          <ReproducibilityView tab={reproTab} workflows={workflows} setWorkflows={setWorkflows} selectedWorkflowId={selectedWorkflowId} onSelectWorkflow={setSelectedWorkflowId} showToast={showToast} />
        )}
        {mainSection === "presentation" && (
          <PresentationView tab={presentationTab} selectedDataset={selectedDataset} />
        )}
        {mainSection === "ai" && (
          <AIAssistView />
        )}
        {mainSection === "compare" && (
          <CompareToolsView />
        )}
      </main>

      {guideOpen && (
        <GuideModal onClose={() => setGuideOpen(false)} />
      )}
      {toast && (
        <div className="fixed bottom-4 right-4 z-50 rounded-lg bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 px-4 py-2 shadow-lg text-sm flex items-center gap-2">
          <Copy className="w-4 h-4" />
          {toast}
        </div>
      )}
    </div>
  );
}

function WorkflowView({
  steps,
  datasets,
  selectedDatasetId,
  onSelectDataset,
}: {
  steps: typeof WORKFLOW_STEPS;
  datasets: Dataset[];
  selectedDatasetId: string | null;
  onSelectDataset: (id: string | null) => void;
}) {
  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Workflow nghiên cứu tiêu chuẩn</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6">
        Quy trình: Import → Profiling → Làm sạch → Reliability &amp; validity → Kiểm định giả thuyết → Mô hình hóa → Visualization → Báo cáo → Lưu workflow tái lập.
      </p>
      <div className="space-y-2">
        {steps.map((step, i) => (
          <div key={step.id} className="flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
            <span className="w-8 h-8 rounded-full bg-emerald-100 dark:bg-emerald-900/40 flex items-center justify-center text-emerald-700 dark:text-emerald-300 font-medium">{i + 1}</span>
            <step.icon className="w-5 h-5 text-neutral-500" />
            <span className="font-medium">{step.label}</span>
          </div>
        ))}
      </div>
      {datasets.length > 0 && (
        <div className="mt-6">
          <p className="text-sm font-medium text-neutral-600 dark:text-neutral-400 mb-2">Dataset đang dùng</p>
          <select
            value={selectedDatasetId ?? ""}
            onChange={(e) => onSelectDataset(e.target.value || null)}
            className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2"
          >
            <option value="">— Chọn dataset —</option>
            {datasets.map((d) => (
              <option key={d.id} value={d.id}>{d.name}</option>
            ))}
          </select>
        </div>
      )}
    </div>
  );
}

function DataView({
  tab,
  datasets,
  setDatasets,
  selectedDatasetId,
  onSelectDataset,
}: {
  tab: DataTab;
  datasets: Dataset[];
  setDatasets: React.Dispatch<React.SetStateAction<Dataset[]>>;
  selectedDatasetId: string | null;
  onSelectDataset: (id: string | null) => void;
}) {
  const selectedDs = selectedDatasetId ? datasets.find((d) => d.id === selectedDatasetId) : null;
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState("");

  if (tab === "import") {
    const fileInputRef = React.useRef<HTMLInputElement>(null);
    const addSample = () => {
      const id = generateId();
      const now = new Date().toISOString();
      const header = ["id", "nhóm", "điểm", "giới_tính", "thời_gian"];
      const dataRows = Array.from({ length: 100 }, (_, i) => [String(i + 1), i % 2 ? "B" : "A", String(70 + Math.floor(Math.random() * 25)), i % 2 ? "Nữ" : "Nam", "2023"]);
      const preview = [header, ...dataRows.slice(0, 5)];
      setDatasets((prev) => [
        ...prev,
        { id, name: `Dataset mẫu ${prev.length + 1}`, rows: 100, columns: 5, columnNames: header, preview, data: [header, ...dataRows], sourceFormat: "csv", createdAt: now, updatedAt: now },
      ]);
      onSelectDataset(id);
    };
    const onFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      const reader = new FileReader();
      reader.onload = () => {
        const rows = parseCSV(String(reader.result));
        if (rows.length < 2) return;
        const headers = rows[0];
        const kept = rows.slice(1, MAX_ROWS_STORED + 1);
        const id = generateId();
        const now = new Date().toISOString();
        setDatasets((prev) => [...prev, { id, name: file.name.replace(/\.csv$/i, "") || "CSV", rows: kept.length, columns: headers.length, columnNames: headers, preview: rows.slice(0, 6), data: [headers, ...kept], sourceFormat: "csv", createdAt: now, updatedAt: now }]);
        onSelectDataset(id);
      };
      reader.readAsText(file, "UTF-8");
      e.target.value = "";
    };
    const removeDataset = (id: string) => { setDatasets((prev) => prev.filter((d) => d.id !== id)); if (selectedDatasetId === id) onSelectDataset(null); };
    const exportDataset = (d: Dataset) => {
      const rows = getDataRows(d);
      if (rows.length === 0) return;
      const csv = rows.map((r) => r.map((c) => (c.includes(",") || c.includes('"') ? '"' + c.replace(/"/g, '""') + '"' : c)).join(",")).join("\n");
      const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
      const a = document.createElement("a");
      a.href = URL.createObjectURL(blob);
      a.download = (d.name || "data") + ".csv";
      a.click();
      URL.revokeObjectURL(a.href);
    };
    const saveRename = (id: string) => {
      if (editingName.trim()) setDatasets((prev) => prev.map((x) => (x.id === id ? { ...x, name: editingName.trim(), updatedAt: new Date().toISOString() } : x)));
      setEditingId(null);
    };
    return (
      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold mb-2">Import dữ liệu</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">
          Tải file CSV hoặc thêm dataset mẫu. Tối đa {MAX_ROWS_STORED.toLocaleString()} dòng.
        </p>
        <div className="flex flex-wrap gap-2">
          <input ref={fileInputRef} type="file" accept=".csv" className="hidden" onChange={onFileChange} />
          <button type="button" onClick={() => fileInputRef.current?.click()} className="rounded-lg bg-emerald-600 text-white px-4 py-2 flex items-center gap-2 hover:bg-emerald-700">
            <Upload className="w-4 h-4" /> Tải file CSV
          </button>
          <button type="button" onClick={addSample} className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700">Thêm dataset mẫu</button>
        </div>
        {datasets.length > 0 && (
          <ul className="mt-4 space-y-2">
            {datasets.map((d) => (
              <li key={d.id} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <div className="min-w-0 flex-1">
                  {editingId === d.id ? (
                    <input type="text" value={editingName} onChange={(e) => setEditingName(e.target.value)} onBlur={() => saveRename(d.id)} onKeyDown={(e) => e.key === "Enter" && saveRename(d.id)} className="w-full rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1 text-sm" autoFocus />
                  ) : (
                    <p className="font-medium truncate">{d.name}</p>
                  )}
                  <p className="text-sm text-neutral-500">{d.rows} hàng × {d.columns} cột</p>
                </div>
                <div className="flex items-center gap-1">
                  <button type="button" onClick={() => onSelectDataset(d.id)} className="text-emerald-600 dark:text-emerald-400 text-sm">Chọn</button>
                  <button type="button" onClick={() => { setEditingId(d.id); setEditingName(d.name); }} className="p-1 text-neutral-400 hover:text-neutral-600" title="Đổi tên"><Edit2 className="w-4 h-4" /></button>
                  <button type="button" onClick={() => exportDataset(d)} className="p-1 text-neutral-400 hover:text-neutral-600" title="Xuất CSV"><Download className="w-4 h-4" /></button>
                  <button type="button" onClick={() => removeDataset(d.id)} className="p-1 text-neutral-400 hover:text-red-600" title="Xóa"><Trash2 className="w-4 h-4" /></button>
                </div>
              </li>
            ))}
          </ul>
        )}
      </div>
    );
  }
  if (tab === "profiling") {
    const rows = selectedDs ? getDataRows(selectedDs) : [];
    const profiles = rows.length >= 2 ? computeProfile(rows) : [];
    return (
      <div className="max-w-4xl">
        <h2 className="text-xl font-semibold mb-2">Data profiling</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">Missing values, kiểu cột, thống kê cơ bản.</p>
        {selectedDs && profiles.length > 0 ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left p-2">Cột</th>
                  <th className="text-left p-2">Kiểu</th>
                  <th className="text-right p-2">Missing</th>
                  <th className="text-right p-2">%</th>
                  <th className="text-right p-2">Unique</th>
                  <th className="text-right p-2">Min</th>
                  <th className="text-right p-2">Max</th>
                  <th className="text-right p-2">Mean</th>
                  <th className="text-right p-2">Std</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p) => (
                  <tr key={p.column} className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="p-2 font-medium">{p.column}</td>
                    <td className="p-2">{p.type}</td>
                    <td className="p-2 text-right">{p.missing}</td>
                    <td className="p-2 text-right">{p.missingPct.toFixed(1)}%</td>
                    <td className="p-2 text-right">{p.unique}</td>
                    <td className="p-2 text-right">{p.min != null ? p.min.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{p.max != null ? p.max.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{p.mean != null ? p.mean.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{p.std != null ? p.std.toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : selectedDs ? (
          <p className="text-neutral-500">Dataset không có đủ dữ liệu. Import CSV hoặc dùng dataset mẫu.</p>
        ) : (
          <p className="text-neutral-500">Chọn một dataset ở mục Import hoặc Workflow.</p>
        )}
      </div>
    );
  }
  if (tab === "transform") {
    return <TransformTab selectedDs={selectedDs} setDatasets={setDatasets} onSelectDataset={onSelectDataset} />;
  }
  if (tab === "preview") {
    if (!selectedDs) return <div className="max-w-4xl"><h2 className="text-xl font-semibold mb-2">Xem dữ liệu</h2><p className="text-neutral-500">Chọn dataset ở mục Import.</p></div>;
    const rows = getDataRows(selectedDs);
    const previewRows = rows.slice(0, 21);
    const headers = rows[0] || [];
    return (
      <div className="max-w-4xl">
        <h2 className="text-xl font-semibold mb-2">Xem dữ liệu</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-2">Dataset: <strong>{selectedDs.name}</strong> — {selectedDs.rows} hàng × {selectedDs.columns} cột. Hiển thị 20 dòng đầu.</p>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto max-h-96 overflow-y-auto">
          <table className="w-full text-sm">
            <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800">
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                {headers.map((h) => (
                  <th key={h} className="text-left p-2 font-medium whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {previewRows.slice(1).map((r, ri) => (
                <tr key={ri} className="border-b border-neutral-100 dark:border-neutral-700/50">
                  {headers.map((_, ci) => (
                    <td key={ci} className="p-2 whitespace-nowrap">{r[ci] ?? ""}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }
  return null;
}

function TransformTab({ selectedDs, setDatasets, onSelectDataset }: { selectedDs: Dataset | null; setDatasets: React.Dispatch<React.SetStateAction<Dataset[]>>; onSelectDataset: (id: string | null) => void }) {
  const [transformCol, setTransformCol] = useState("");
  const [transformAction, setTransformAction] = useState<"drop_missing" | "fill_mean">("drop_missing");
  if (!selectedDs) return <div className="max-w-3xl"><h2 className="text-xl font-semibold mb-2">Biến đổi</h2><p className="text-neutral-500">Chọn dataset ở mục Import.</p></div>;
  const dataRows = getDataRows(selectedDs);
  const cols = selectedDs.columnNames || [];
  const applyTransform = () => {
    if (!transformCol || dataRows.length < 2) return;
    const ci = dataRows[0].indexOf(transformCol);
    if (ci === -1) return;
    const header = dataRows[0];
    let newRows: string[][];
    if (transformAction === "drop_missing") {
      newRows = [header, ...dataRows.slice(1).filter((r) => (r[ci] ?? "").toString().trim() !== "")];
    } else {
      const numericRows = dataRows.slice(1).map((r) => r.map((v) => (v ?? "").trim()));
      const numVals = numericRows.map((r) => Number(r[ci])).filter((v) => !Number.isNaN(v));
      const mean = numVals.length ? numVals.reduce((a, b) => a + b, 0) / numVals.length : 0;
      newRows = [header, ...numericRows.map((r) => { const out = [...r]; const v = r[ci]; out[ci] = (v === "" || Number.isNaN(Number(v))) ? String(mean.toFixed(2)) : v; return out; })];
    }
    const id = generateId();
    const now = new Date().toISOString();
    setDatasets((prev) => [...prev, { id, name: `${selectedDs.name} (đã biến đổi)`, rows: newRows.length - 1, columns: header.length, columnNames: header, preview: newRows.slice(0, 6), data: newRows, sourceFormat: selectedDs.sourceFormat, createdAt: now, updatedAt: now }]);
    onSelectDataset(id);
  };
  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-2">Biến đổi &amp; pipeline</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">Loại bỏ dòng thiếu hoặc thay missing bằng mean. Tạo dataset mới.</p>
      <p className="text-sm text-neutral-500 mb-2">Dataset: <strong>{selectedDs.name}</strong></p>
      <div className="flex flex-wrap gap-4 items-end">
        <div>
          <label className="block text-sm font-medium mb-1">Cột</label>
          <select value={transformCol} onChange={(e) => setTransformCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
            <option value="">— Chọn cột —</option>
            {cols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Hành động</label>
          <select value={transformAction} onChange={(e) => setTransformAction(e.target.value as "drop_missing" | "fill_mean")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
            <option value="drop_missing">Loại bỏ dòng thiếu</option>
            <option value="fill_mean">Thay missing bằng mean</option>
          </select>
        </div>
        <button type="button" onClick={applyTransform} className="rounded-lg bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700">Áp dụng</button>
      </div>
    </div>
  );
}

function AnalysisView({ tab, selectedDataset }: { tab: AnalysisTab; selectedDataset: Dataset | undefined }) {
  const tabs: Record<AnalysisTab, { title: string; desc: string }> = {
    descriptive: { title: "Thống kê mô tả", desc: "Descriptive statistics, distribution, effect size. AI diễn giải." },
    hypothesis: { title: "Kiểm định giả thuyết", desc: "t-test, ANOVA, Chi-square, non-parametric. Gợi ý test theo loại biến & giả định." },
    regression: { title: "Hồi quy & SEM", desc: "Linear/logistic regression, multilevel, panel, SEM. Diagnostic plots, kiểm tra giả định." },
    correlation: { title: "Ma trận tương quan", desc: "Pearson correlation giữa các cột số." },
    ml: { title: "Machine learning", desc: "Classification, regression ML, feature importance, cross-validation." },
    bayesian: { title: "Bayesian", desc: "Bayesian inference, posterior visualization, model comparison." },
  };
  const { title, desc } = tabs[tab] ?? { title: tab, desc: "" };

  if (tab === "descriptive" && selectedDataset) {
    const rows = getDataRows(selectedDataset);
    const stats = rows.length >= 2 ? computeDescriptive(rows) : [];
    const categorical = stats.filter((s) => s.freq && s.freq.length > 0);
    const chartCol = categorical[0];
    const chartData = chartCol?.freq?.slice(0, 15).map((f) => ({ name: f.value, count: f.count })) || [];
    return (
      <div className="max-w-4xl">
        <h2 className="text-xl font-semibold mb-2">{title}</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">{desc}</p>
        <p className="text-sm text-neutral-500 mb-2">Dataset: <strong>{selectedDataset.name}</strong></p>
        {stats.length > 0 ? (
          <>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto mb-4">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">Cột</th>
                    <th className="text-left p-2">Kiểu</th>
                    <th className="text-right p-2">N</th>
                    <th className="text-right p-2">Missing</th>
                    <th className="text-right p-2">Mean</th>
                    <th className="text-right p-2">Median</th>
                    <th className="text-right p-2">Std</th>
                    <th className="text-right p-2">Q25</th>
                    <th className="text-right p-2">Q75</th>
                    <th className="text-right p-2">Min</th>
                    <th className="text-right p-2">Max</th>
                  </tr>
                </thead>
                <tbody>
                  {stats.map((s) => (
                    <tr key={s.column} className="border-b border-neutral-100 dark:border-neutral-700/50">
                      <td className="p-2 font-medium">{s.column}</td>
                      <td className="p-2">{s.type}</td>
                      <td className="p-2 text-right">{s.n}</td>
                      <td className="p-2 text-right">{s.missing}</td>
                      <td className="p-2 text-right">{s.mean != null ? s.mean.toFixed(2) : "—"}</td>
                      <td className="p-2 text-right">{s.median != null ? s.median.toFixed(2) : "—"}</td>
                      <td className="p-2 text-right">{s.std != null ? s.std.toFixed(2) : "—"}</td>
                      <td className="p-2 text-right">{s.q25 != null ? s.q25.toFixed(2) : "—"}</td>
                      <td className="p-2 text-right">{s.q75 != null ? s.q75.toFixed(2) : "—"}</td>
                      <td className="p-2 text-right">{s.min != null ? s.min.toFixed(2) : "—"}</td>
                      <td className="p-2 text-right">{s.max != null ? s.max.toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
            {chartData.length > 0 && (
              <div className="h-64 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
                <p className="text-sm font-medium mb-2">Phân bố: {chartCol?.column}</p>
                <ResponsiveContainer width="100%" height="90%">
                  <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                    <CartesianGrid strokeDasharray="3 3" />
                    <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                    <YAxis />
                    <Tooltip />
                    <Bar dataKey="count" fill="#059669" name="Số lượng" />
                  </BarChart>
                </ResponsiveContainer>
              </div>
            )}
          </>
        ) : (
          <p className="text-neutral-500">Dataset không có đủ dữ liệu.</p>
        )}
      </div>
    );
  }

  if (tab === "correlation" && selectedDataset) {
    const rows = getDataRows(selectedDataset);
    const corr = computeCorrelationMatrix(rows);
    if (!corr || corr.matrix.length < 2) return (
      <div className="max-w-4xl">
        <h2 className="text-xl font-semibold mb-2">Ma trận tương quan</h2>
        <p className="text-neutral-500">Cần ít nhất 2 cột số và đủ dữ liệu. Dataset: <strong>{selectedDataset.name}</strong></p>
      </div>
    );
    return (
      <div className="max-w-4xl">
        <h2 className="text-xl font-semibold mb-2">Ma trận tương quan (Pearson)</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">Hệ số tương quan giữa các cột số. Giá trị từ -1 đến 1.</p>
        <p className="text-sm text-neutral-500 mb-2">Dataset: <strong>{selectedDataset.name}</strong></p>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-700">
                <th className="p-2 text-left font-medium"></th>
                {corr.columnNames.map((c) => (
                  <th key={c} className="p-2 text-right font-medium whitespace-nowrap">{c}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {corr.matrix.map((row, i) => (
                <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/50">
                  <td className="p-2 font-medium whitespace-nowrap">{corr.columnNames[i]}</td>
                  {row.map((v, j) => (
                    <td key={j} className="p-2 text-right">{v.toFixed(3)}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    );
  }

  if (tab === "hypothesis" && selectedDataset) {
    return <HypothesisTab selectedDataset={selectedDataset} />;
  }

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{desc}</p>
      {selectedDataset && <p className="text-sm text-neutral-500 mb-2">Dataset: <strong>{selectedDataset.name}</strong></p>}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm text-neutral-500">
        Phân tích {tab} sẽ được tích hợp với engine R/Python.
      </div>
    </div>
  );
}

function HypothesisTab({ selectedDataset }: { selectedDataset: Dataset }) {
  const rows = getDataRows(selectedDataset);
  const [testKind, setTestKind] = useState<"ttest" | "chisquare">("ttest");
  const [groupCol, setGroupCol] = useState("");
  const [groupVal1, setGroupVal1] = useState("");
  const [groupVal2, setGroupVal2] = useState("");
  const [numCol, setNumCol] = useState("");
  const [tResult, setTResult] = useState<TTestResult | null>(null);
  const [chiCol1, setChiCol1] = useState("");
  const [chiCol2, setChiCol2] = useState("");
  const [chiResult, setChiResult] = useState<ChiSquareResult | null>(null);
  const cols = selectedDataset.columnNames || [];
  const groupValues = groupCol ? getUniqueValues(rows, groupCol) : [];
  const numericCols = rows.length >= 2 ? cols.filter((c) => { const ci = rows[0].indexOf(c); const vals = rows.slice(1).map((r) => r[ci]); return vals.every((v) => v === "" || !Number.isNaN(Number(v))); }) : [];

  const runTTest = () => {
    if (!groupCol || !groupVal1 || !groupVal2 || !numCol) return;
    const res = computeTTest(rows, groupCol, groupVal1, groupVal2, numCol);
    setTResult(res ?? null);
    setChiResult(null);
  };
  const runChiSquare = () => {
    if (!chiCol1 || !chiCol2) return;
    const res = computeChiSquare(rows, chiCol1, chiCol2);
    setChiResult(res ?? null);
    setTResult(null);
  };

  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-2">Kiểm định giả thuyết</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">t-test (hai nhóm) hoặc Chi-square (hai biến phân loại).</p>
      <p className="text-sm text-neutral-500 mb-2">Dataset: <strong>{selectedDataset.name}</strong></p>
      <div className="flex gap-2 mb-4">
        <button type="button" onClick={() => { setTestKind("ttest"); setTResult(null); setChiResult(null); }} className={`rounded-lg px-3 py-1.5 text-sm ${testKind === "ttest" ? "bg-emerald-600 text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>t-test</button>
        <button type="button" onClick={() => { setTestKind("chisquare"); setTResult(null); setChiResult(null); }} className={`rounded-lg px-3 py-1.5 text-sm ${testKind === "chisquare" ? "bg-emerald-600 text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Chi-square</button>
      </div>
      {testKind === "ttest" && (
      <>
      <div className="flex flex-wrap gap-4 items-end mb-4">
        <div>
          <label className="block text-sm font-medium mb-1">Biến nhóm</label>
          <select value={groupCol} onChange={(e) => { setGroupCol(e.target.value); setGroupVal1(""); setGroupVal2(""); setTResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
            <option value="">— Chọn —</option>
            {cols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nhóm 1</label>
          <select value={groupVal1} onChange={(e) => { setGroupVal1(e.target.value); setTResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
            <option value="">—</option>
            {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nhóm 2</label>
          <select value={groupVal2} onChange={(e) => { setGroupVal2(e.target.value); setTResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
            <option value="">—</option>
            {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Biến số</label>
          <select value={numCol} onChange={(e) => { setNumCol(e.target.value); setTResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
            <option value="">— Chọn —</option>
            {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
          </select>
        </div>
        <button type="button" onClick={runTTest} className="rounded-lg bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700">Chạy t-test</button>
      </div>
      {tResult && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
          <p className="font-medium mb-2">Kết quả (Welch two-sample t-test)</p>
          <p>t = {tResult.t.toFixed(4)}, df ≈ {tResult.df.toFixed(1)}, p-value = {tResult.pValue < 0.001 ? "< 0.001" : tResult.pValue.toFixed(4)}</p>
          <p>Cohen’s d = {tResult.cohenD.toFixed(4)}</p>
          <p>Mean nhóm 1 = {tResult.mean1.toFixed(2)} (n = {tResult.n1}), Mean nhóm 2 = {tResult.mean2.toFixed(2)} (n = {tResult.n2})</p>
        </div>
      )}
      </>
      )}
      {testKind === "chisquare" && (
        <>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến 1 (hàng)</label>
              <select value={chiCol1} onChange={(e) => { setChiCol1(e.target.value); setChiResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến 2 (cột)</label>
              <select value={chiCol2} onChange={(e) => { setChiCol2(e.target.value); setChiResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={runChiSquare} className="rounded-lg bg-emerald-600 text-white px-4 py-2 hover:bg-emerald-700">Chạy Chi-square</button>
          </div>
          {chiResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả Chi-square (độc lập)</p>
              <p>χ² = {chiResult.chi2.toFixed(4)}, df = {chiResult.df}, p-value = {chiResult.pValue < 0.001 ? "< 0.001" : chiResult.pValue.toFixed(4)}</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReproducibilityView({
  tab,
  workflows,
  setWorkflows,
  selectedWorkflowId,
  onSelectWorkflow,
  showToast,
}: {
  tab: ReproducibilityTab;
  workflows: Workflow[];
  setWorkflows: React.Dispatch<React.SetStateAction<Workflow[]>>;
  selectedWorkflowId: string | null;
  onSelectWorkflow: (id: string | null) => void;
  showToast: (msg: string) => void;
}) {
  const [editingWfNameId, setEditingWfNameId] = useState<string | null>(null);
  const [editingWfName, setEditingWfName] = useState("");
  const [newStepType, setNewStepType] = useState<WorkflowStep["type"]>("describe");
  const [newStepLabel, setNewStepLabel] = useState("");
  if (tab === "workflows") {
    const addWorkflow = () => {
      const id = generateId();
      const now = new Date().toISOString();
      setWorkflows((prev) => [
        ...prev,
        { id, name: `Workflow ${prev.length + 1}`, steps: [], datasetId: null, createdAt: now, updatedAt: now },
      ]);
      onSelectWorkflow(id);
    };
    return (
      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold mb-2">Workflows</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">Lưu workflow phân tích, sinh script tự động, versioning dataset &amp; model.</p>
        <button type="button" onClick={addWorkflow} className="rounded-lg bg-emerald-600 text-white px-4 py-2 flex items-center gap-2 hover:bg-emerald-700">
          <GitBranch className="w-4 h-4" /> Tạo workflow mới
        </button>
        {workflows.length > 0 && (
          <ul className="mt-4 space-y-2">
            {workflows.map((w) => (
              <li key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <button type="button" onClick={() => onSelectWorkflow(w.id)} className="text-left flex-1">
                  <p className="font-medium">{w.name}</p>
                  <span className="text-sm text-neutral-500">{w.steps.length} bước</span>
                </button>
                <button type="button" onClick={() => onSelectWorkflow(w.id)} className="text-emerald-600 dark:text-emerald-400 text-sm">Mở</button>
              </li>
            ))}
          </ul>
        )}
        {selectedWorkflowId && (() => {
          const w = workflows.find((x) => x.id === selectedWorkflowId);
          if (!w) return null;
          const stepLabels: Record<WorkflowStep["type"], string> = { import: "Import dữ liệu", clean: "Làm sạch", transform: "Biến đổi", describe: "Thống kê mô tả", test: "Kiểm định giả thuyết", model: "Mô hình hóa", visualize: "Visualization", report: "Báo cáo" };
          const addStep = () => {
            const now = new Date().toISOString();
            const label = newStepLabel.trim() || stepLabels[newStepType];
            const step: WorkflowStep = { id: generateId(), type: newStepType, label, config: {}, order: w.steps.length, createdAt: now };
            setWorkflows((prev) => prev.map((x) => x.id !== w.id ? x : { ...x, steps: [...x.steps, step], updatedAt: now }));
            setNewStepLabel("");
          };
          const removeStep = (stepId: string) => setWorkflows((prev) => prev.map((x) => x.id !== w.id ? x : { ...x, steps: x.steps.filter((s) => s.id !== stepId), updatedAt: new Date().toISOString() }));
          const rScript = "# R script sinh từ Quantis workflow\n# " + w.name + "\n\n" + w.steps.map((s, i) => `# Bước ${i + 1}: ${s.label}\n# (type: ${s.type})\n# TODO: thêm code R tương ứng\n`).join("");
          const saveWfName = () => {
            if (editingWfName.trim()) setWorkflows((prev) => prev.map((x) => (x.id === w.id ? { ...x, name: editingWfName.trim(), updatedAt: new Date().toISOString() } : x)));
            setEditingWfNameId(null);
          };
          return (
            <div className="mt-6 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <h3 className="font-semibold mb-2">
                Chi tiết: {editingWfNameId === w.id ? (
                  <input type="text" value={editingWfName} onChange={(e) => setEditingWfName(e.target.value)} onBlur={saveWfName} onKeyDown={(e) => e.key === "Enter" && saveWfName()} className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1 text-sm w-64" autoFocus />
                ) : (
                  <button type="button" onClick={() => { setEditingWfNameId(w.id); setEditingWfName(w.name); }} className="text-left hover:underline">{w.name}</button>
                )}
              </h3>
              <div className="flex flex-wrap items-end gap-2 mb-3">
                <select value={newStepType} onChange={(e) => setNewStepType(e.target.value as WorkflowStep["type"])} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm">
                  {(["import", "clean", "transform", "describe", "test", "model", "visualize", "report"] as const).map((t) => (
                    <option key={t} value={t}>{stepLabels[t]}</option>
                  ))}
                </select>
                <input type="text" value={newStepLabel} onChange={(e) => setNewStepLabel(e.target.value)} placeholder="Nhãn (tùy chọn)" className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-40" />
                <button type="button" onClick={addStep} className="rounded-lg bg-emerald-600 text-white px-3 py-1.5 text-sm">Thêm bước</button>
                <button type="button" onClick={() => { navigator.clipboard.writeText(rScript); showToast("Đã sao chép script R"); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm">Sao chép script R</button>
              </div>
              {w.steps.length === 0 ? <p className="text-sm text-neutral-500">Chưa có bước. Nhấn Thêm bước.</p> : (
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  {w.steps.map((s) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span>{s.label} ({s.type})</span>
                      <button type="button" onClick={() => removeStep(s.id)} className="text-red-600 hover:underline">Xóa</button>
                    </li>
                  ))}
                </ol>
              )}
              <pre className="mt-3 p-2 bg-neutral-100 dark:bg-neutral-900 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto">{rScript}</pre>
            </div>
          );
        })()}
      </div>
    );
  }
  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-2">Versioning &amp; audit</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">Version dataset và model, audit trail cho nghiên cứu.</p>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm text-neutral-500">
        Phiên bản và nhật ký thay đổi sẽ hiển thị tại đây. (Tích hợp backend sẽ lưu lịch sử.)
      </div>
    </div>
  );
}

function PresentationView({ tab, selectedDataset }: { tab: PresentationTab; selectedDataset: Dataset | undefined }) {
  const [chartXCol, setChartXCol] = useState("");
  const [chartYCol, setChartYCol] = useState("");
  if (tab === "visualization" && selectedDataset) {
    const rows = getDataRows(selectedDataset);
    const cols = selectedDataset.columnNames || [];
    const xCol = chartXCol;
    const setXCol = setChartXCol;
    const yCol = chartYCol;
    const setYCol = setChartYCol;
    const numericCols = rows.length >= 2 ? cols.filter((c) => { const ci = rows[0].indexOf(c); const vals = rows.slice(1).map((r) => r[ci]); return vals.every((v) => v === "" || !Number.isNaN(Number(v))); }) : [];
    const xIdx = cols.indexOf(xCol);
    const yIdx = cols.indexOf(yCol);
    const isScatter = xCol && yCol && numericCols.includes(xCol) && numericCols.includes(yCol);
    const chartData = rows.length >= 2 && xIdx >= 0 && yIdx >= 0
      ? rows.slice(1).map((r) => ({ x: isScatter ? Number(r[xIdx]) : r[xIdx], y: Number(r[yIdx]) })).filter((d) => !Number.isNaN(d.y) && (!isScatter || !Number.isNaN(Number(d.x))))
      : [];
    const barData = !isScatter && xCol && xIdx >= 0 ? (() => { const counts: Record<string, number> = {}; rows.slice(1).forEach((r) => { const v = r[xIdx] ?? ""; counts[v] = (counts[v] || 0) + 1; }); return Object.entries(counts).map(([name, count]) => ({ name, count })).slice(0, 20); })() : [];
    return (
      <div className="max-w-4xl">
        <h2 className="text-xl font-semibold mb-2">Biểu đồ</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">Chọn cột trục X, Y. Số–số: scatter; phân loại: cột.</p>
        <p className="text-sm text-neutral-500 mb-2">Dataset: <strong>{selectedDataset.name}</strong></p>
        <div className="flex flex-wrap gap-4 mb-4">
          <div>
            <label className="block text-sm font-medium mb-1">Trục X</label>
            <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">— Chọn —</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Trục Y (số)</label>
            <select value={yCol} onChange={(e) => setYCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">— Chọn —</option>
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        {isScatter && chartData.length > 0 && (
          <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid />
                <XAxis dataKey="x" name={xCol} />
                <YAxis dataKey="y" name={yCol} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={chartData} fill="#059669" name="Điểm" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
        {!isScatter && barData.length > 0 && (
          <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#059669" name="Số lượng" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {xCol && !isScatter && barData.length === 0 && <p className="text-neutral-500 text-sm">Không đủ dữ liệu cho biểu đồ cột.</p>}
        {xCol && yCol && !isScatter && <p className="text-neutral-500 text-sm">Hai cột đều số → biểu đồ scatter phía trên.</p>}
      </div>
    );
  }
  if (tab === "visualization") return <div className="max-w-3xl"><h2 className="text-xl font-semibold mb-2">Biểu đồ</h2><p className="text-neutral-500">Chọn dataset ở Workflow hoặc Data.</p></div>;

  if (tab === "reports" && selectedDataset) {
    const rows = getDataRows(selectedDataset);
    const stats = rows.length >= 2 ? computeDescriptive(rows) : [];
    const reportHtml = "<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Báo cáo Quantis</title></head><body><h1>Báo cáo phân tích</h1><p><strong>Dataset:</strong> " + selectedDataset.name + "</p><p>Số dòng: " + selectedDataset.rows + ", Số cột: " + selectedDataset.columns + "</p><h2>Thống kê mô tả</h2><pre>" + (stats.length ? stats.map((s) => s.column + ": n=" + s.n + ", missing=" + s.missing + (s.mean != null ? ", mean=" + s.mean.toFixed(2) : "")).join("\n") : "Không có") + "</pre><p><em>Được tạo bởi Quantis.</em></p></body></html>";
    return (
      <div className="max-w-3xl">
        <h2 className="text-xl font-semibold mb-2">Báo cáo học thuật</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">Xuất báo cáo HTML từ dataset và thống kê mô tả.</p>
        <p className="text-sm text-neutral-500 mb-2">Dataset: <strong>{selectedDataset.name}</strong></p>
        <button type="button" onClick={() => { const blob = new Blob([reportHtml], { type: "text/html" }); const a = document.createElement("a"); a.href = URL.createObjectURL(blob); a.download = "quantis-report.html"; a.click(); }} className="rounded-lg bg-emerald-600 text-white px-4 py-2 flex items-center gap-2 hover:bg-emerald-700">
          <Download className="w-4 h-4" /> Xuất HTML
        </button>
        <p className="mt-2 text-sm text-neutral-500">Hoặc sao chép nội dung bên dưới.</p>
        <pre className="mt-2 p-3 bg-neutral-100 dark:bg-neutral-900 rounded text-xs overflow-x-auto max-h-40 overflow-y-auto">{reportHtml.slice(0, 500)}...</pre>
      </div>
    );
  }
  if (tab === "reports") return <div className="max-w-3xl"><h2 className="text-xl font-semibold mb-2">Báo cáo</h2><p className="text-neutral-500">Chọn dataset để tạo báo cáo.</p></div>;
  return null;
}

function AIAssistView() {
  return (
    <div className="max-w-3xl">
      <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
        <Sparkles className="w-5 h-5 text-amber-500" /> AI hỗ trợ phương pháp
      </h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">
        Gợi ý phương pháp thống kê, kiểm tra thiết kế nghiên cứu, tóm tắt kết quả theo chuẩn bài báo, viết Results sơ bộ, cảnh báo overfitting / misuse.
      </p>
      <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 p-4 space-y-2">
        <p className="text-sm font-medium text-amber-800 dark:text-amber-200">Ví dụ gợi ý:</p>
        <p className="text-sm text-neutral-700 dark:text-neutral-300">“Bạn đang dùng regression với biến phụ thuộc nhị phân → nên dùng logistic.”</p>
        <p className="text-sm text-neutral-500">Tích hợp AI sẽ được kết nối với backend / LLM khi triển khai.</p>
      </div>
      <div className="mt-4 space-y-2">
        <p className="text-sm font-medium text-neutral-700 dark:text-neutral-300">Gợi ý thường dùng:</p>
        <ul className="list-disc list-inside text-sm text-neutral-600 dark:text-neutral-400 space-y-1">
          <li>Biến phụ thuộc nhị phân → dùng logistic regression.</li>
          <li>So sánh hai nhóm độc lập → t-test (Welch).</li>
          <li>Luôn báo cáo effect size (Cohen d) cùng p-value.</li>
          <li>Nhiều kiểm định → hiệu chỉnh đa so sánh (Bonferroni, FDR).</li>
          <li>Cảnh báo overfitting khi mô hình quá phức tạp so với cỡ mẫu.</li>
        </ul>
      </div>
    </div>
  );
}

const COMPARE_TOOLS = [
  { name: "IBM SPSS Statistics", tag: "Thân thiện, phổ biến", area: "Khoa học xã hội, giáo dục", points: ["Giao diện trực quan, 150+ thủ tục", "Quản lý dữ liệu, missing data", "Hồi quy, GLM, survival, decision trees", "Tích hợp R/Python"], quantis: "GUI trực quan + quy trình chuẩn; AI gợi ý thay cho chỉ menu thủ công." },
  { name: "R (programming language)", tag: "Mã nguồn mở, cực mạnh", area: "Nghiên cứu học thuật, data science", points: ["Ecosystem gói (tidyverse…)", "R Markdown/knitr, reproducible", "Literate programming"], quantis: "Reproducibility tích hợp (workflow, versioning); engine có thể gọi R phía sau, trừu tượng hóa qua UI." },
  { name: "Stata", tag: "Kinh tế lượng, panel data", area: "Kinh tế, y sinh, chính sách", points: ["Panel/longitudinal (xt: fixed/random, Arellano-Bond, GEE, DiD)", "Survival, count data"], quantis: "Panel data & hồi quy nâng cao trong Analysis Engine; workflow chuẩn từ dữ liệu đến báo cáo." },
  { name: "JASP", tag: "Thống kê hiện đại, Bayesian", area: "Giảng dạy, tâm lý/xã hội", points: ["Miễn phí, mã nguồn mở", "Bayesian + frequentist, không cần code", "Meta-analysis, Bayes Factor, ML"], quantis: "Bayesian ngang hàng; AI diễn giải kết quả; report học thuật tự động." },
];

function CompareToolsView() {
  return (
    <div className="max-w-4xl">
      <h2 className="text-xl font-semibold mb-2 flex items-center gap-2">
        <Scale className="w-5 h-5 text-sky-500" /> So sánh Quantis với công cụ khác
      </h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-6">
        Quantis không thay thế trực tiếp SPSS, R, Stata hay JASP mà bổ sung và định vị giữa GUI dễ dùng và engine mạnh, với AI và reproducible research tích hợp.
      </p>
      <div className="space-y-4">
        {COMPARE_TOOLS.map((tool) => (
          <div key={tool.name} className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
            <div className="px-4 py-3 border-b border-neutral-200 dark:border-neutral-700 flex flex-wrap items-center gap-2">
              <span className="font-semibold text-neutral-800 dark:text-neutral-200">{tool.name}</span>
              <span className="text-xs px-2 py-0.5 rounded-full bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-300">{tool.tag}</span>
              <span className="text-sm text-neutral-500 dark:text-neutral-400">{tool.area}</span>
            </div>
            <div className="px-4 py-3 grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
              <div>
                <p className="font-medium text-neutral-600 dark:text-neutral-400 mb-1">Đặc điểm chính</p>
                <ul className="list-disc list-inside space-y-0.5 text-neutral-600 dark:text-neutral-400">
                  {tool.points.map((p, i) => (
                    <li key={i}>{p}</li>
                  ))}
                </ul>
              </div>
              <div className="rounded-lg bg-emerald-50 dark:bg-emerald-900/20 border border-emerald-200 dark:border-emerald-800 p-3">
                <p className="font-medium text-emerald-800 dark:text-emerald-200 mb-1">Quantis kế thừa / bổ sung</p>
                <p className="text-neutral-700 dark:text-neutral-300">{tool.quantis}</p>
              </div>
            </div>
          </div>
        ))}
      </div>
      <div className="mt-6 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50 dark:bg-sky-900/20 p-4 text-sm">
        <p className="font-medium text-sky-800 dark:text-sky-200 mb-2">Tóm tắt định vị</p>
        <ul className="space-y-1 text-neutral-700 dark:text-neutral-300">
          <li><strong>SPSS:</strong> Cùng thân thiện; Quantis thêm workflow tái lập và AI gợi ý.</li>
          <li><strong>R:</strong> Ít code hơn nhưng vẫn reproducible; có thể sinh script R từ workflow.</li>
          <li><strong>Stata:</strong> Hỗ trợ panel, kinh tế lượng trong nền tảng tổng thể.</li>
          <li><strong>JASP:</strong> Cùng Bayesian + classical; Quantis thêm AI và reproducibility end-to-end.</li>
        </ul>
      </div>
    </div>
  );
}

function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Quantis – Hướng dẫn nhanh</h3>
        <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400">
          <li><strong>Workflow nghiên cứu:</strong> Quy trình chuẩn từ import đến lưu workflow.</li>
          <li><strong>Data Layer:</strong> Import (CSV, Excel, SPSS…), profiling, biến đổi dữ liệu.</li>
          <li><strong>Analysis Engine:</strong> Thống kê mô tả, kiểm định giả thuyết, hồi quy, ML, Bayesian.</li>
          <li><strong>Reproducibility:</strong> Lưu workflow, versioning, audit trail.</li>
          <li><strong>Presentation:</strong> Biểu đồ, dashboard, báo cáo học thuật.</li>
          <li><strong>AI:</strong> Gợi ý phương pháp, diễn giải kết quả, cảnh báo.</li>
          <li><strong>So sánh công cụ:</strong> Định vị Quantis so với SPSS, R, Stata, JASP (sidebar).</li>
        </ul>
        <button type="button" onClick={onClose} className="mt-4 rounded-lg bg-neutral-200 dark:bg-neutral-700 px-4 py-2">Đóng</button>
      </div>
    </div>
  );
}
