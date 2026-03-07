import React, { useState, useEffect, useCallback, useRef, useMemo } from "react";
import type { Dispatch, SetStateAction } from "react";
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
  LineChart as LineChartIcon,
  FileText,
  CircleHelp,
  ChevronRight,
  CheckCircle2,
  Trash2,
  PanelLeftClose,
  PanelLeftOpen,
  Download,
  Edit2,
  Copy,
  Cloud,
  X,
  MoreVertical,
  Sun,
  Moon,
  RotateCcw,
  Plus,
  FilePlus,
  Network,
  Settings,
  PieChart as PieChartIcon,
  ScatterChart as ScatterChartIcon,
  AreaChart as AreaChartIcon,
  LayoutGrid,
  LayoutDashboard,
  Layers,
  Circle,
  CircleDot,
  LayoutList,
  BoxSelect,
  BarChart2,
  Gauge,
  Grid3X3,
  LayoutTemplate,
  Table2,
  Loader2,
  ThumbsUp,
  ThumbsDown,
  GripVertical,
} from "lucide-react";
import { getPortalTheme, applyPortalTheme } from "./portal-theme";
import { loadDatasets, saveDatasets, loadWorkflows, saveWorkflows, generateId, loadSelectedDatasetId, saveSelectedDatasetId, clearWorkspaceStorage, loadAiModel, saveAiModel, saveAiFeedback, saveAppFeedback } from "./store";
import type { Dataset, Workflow, WorkflowStep } from "./types";
import * as quantisApi from "./api";
import { AI_MAX_PROMPT_CHARS } from "./api";
import ReactMarkdown from "react-markdown";
import { parseCSV, parseFileContent, computeProfile, computeProfileWithOutliers, computeDescriptive, getDataRows, getUniqueValues, getColumnMode, computeTTest, computeChiSquare, computeMcNemar, computeCorrelationMatrix, computePartialCorrelation, computeOneWayANOVA, computeKruskalWallis, computeCronbachAlpha, computeTextStats, computeOutlierIqr, computeKeywordCounts, computeNgramFreq, computeCohensKappa, getBoxStatsByGroup, getHistogramBins, MAX_ROWS_STORED, computeMannWhitneyU, computePairedTTest, computeWilcoxonSignedRank, computeFriedmanTest, computeLeveneTest, computeOLS, computeBetaPosterior, computeKMeans, getCrosstab, pairwisePostHoc, computeLogisticRegression, computeVIF, computeEFA, computeMediation, computeModeration, computeShapiroWilk, computePowerTTest, computeSampleSizeProportion, computeSampleSizeChiSquare, computeSampleSizeAnova, computeSampleSizeRegression, computeMulticlassLogisticOneVsRest, computeFeatureImportanceFromMulticlass, computePermutationImportanceMulticlass, computeBootstrapMeanCI, computeFisherExact, computeOneSampleTTest, computeBinomialTest, computeTwoProportionZTest, computeCorrelationCI, computeSignTest, computeOddsRatio } from "./utils/stats";
import * as archiveApi from "./archive-api";
import type { ArchiveSearchItem, ArchiveFileItem } from "./archive-api";
import { SAMPLE_DATASETS } from "./sampleDatasets";
import { getSampleWorkflowStandalone, getDefaultStandardWorkflow, getDemoWorkflowTemplates } from "./sample-data";
import type { DescriptiveRow, TTestResult, ChiSquareResult, ANOVAResult, BoxGroupStats, MannWhitneyResult, OLSResult, BetaPosteriorResult, KMeansResult, LogisticResult, EFAResult, MediationResult, ShapiroWilkResult, MulticlassLogisticResult, SampleSizeProportionResult, SampleSizeChiSquareResult, SampleSizeAnovaResult, SampleSizeRegressionResult, PairedTTestResult, WilcoxonSignedRankResult, FriedmanResult, LeveneResult, McNemarResult, FisherExactResult, OneSampleTTestResult, BinomialTestResult, TwoProportionZTestResult, SignTestResult } from "./utils/stats";
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell, ScatterChart, Scatter, CartesianGrid, PieChart, Pie, LineChart, Line, AreaChart, Area, RadarChart, Radar, PolarGrid, PolarAngleAxis, PolarRadiusAxis, Legend } from "recharts";

type DataTab = "import" | "profiling" | "transform" | "preview" | "descriptive";
type AnalysisTab = "descriptive" | "hypothesis" | "regression" | "sem" | "correlation" | "reliability" | "factor" | "ml" | "bayesian";
type ReproducibilityTab = "workflows" | "versioning";
type PresentationTab = "visualization";

type MainSection = "data" | "analysis" | "reproducibility" | "presentation" | "ai" | "workflow";

const WORKFLOW_STEPS = [
  { id: "import", label: "Thu thập / Import dữ liệu", icon: Upload },
  { id: "profiling", label: "Phân tích sơ bộ dữ liệu", icon: ScanSearch },
  { id: "clean", label: "Làm sạch & kiểm tra chất lượng", icon: Shuffle },
  { id: "reliability", label: "Reliability & validity", icon: CheckCircle2 },
  { id: "hypothesis", label: "Kiểm định giả thuyết", icon: TestTube },
  { id: "model", label: "Hồi quy & mô hình", icon: TrendingUp },
  { id: "visualize", label: "Trực quan hóa", icon: LineChartIcon },
  { id: "report", label: "Viết báo cáo", icon: FileText },
  { id: "save", label: "Lưu workflow tại chỗ", icon: GitBranch },
];

export default function App() {
  const [datasets, setDatasets] = useState<Dataset[]>(loadDatasets);
  const [workflows, setWorkflows] = useState<Workflow[]>(() => {
    const loaded = loadWorkflows();
    return loaded.length > 0 ? loaded : [];
  });
  const [mainSection, setMainSection] = useState<MainSection>("data");
  const [dataTab, setDataTab] = useState<DataTab>("preview");
  const [analysisTab, setAnalysisTab] = useState<AnalysisTab>("correlation");
  const [reproTab, setReproTab] = useState<ReproducibilityTab>("workflows");
  const [presentationTab, setPresentationTab] = useState<PresentationTab>("visualization");
  type PresentationChartType = "scatter" | "bar" | "line" | "pie" | "box" | "histogram" | "area" | "stackedBar" | "radar" | "heatmap" | "summary" | "donut" | "barH" | "dashboard" | "multiLine" | "crosstab";
  const [presentationChartType, setPresentationChartType] = useState<PresentationChartType>("scatter");
  const [selectedDatasetId, setSelectedDatasetId] = useState<string | null>(() => loadSelectedDatasetId());
  const [selectedWorkflowId, setSelectedWorkflowId] = useState<string | null>(null);
  const [selectedWorkflowStepId, setSelectedWorkflowStepId] = useState<string | null>(null);
  const [guideOpen, setGuideOpen] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [showAppFeedbackModal, setShowAppFeedbackModal] = useState(false);
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [confirmDialog, setConfirmDialog] = useState<{ message: string; onConfirm: () => void } | null>(null);
  const [useBackend, setUseBackend] = useState(false);
  const [analysisBackendAvailable, setAnalysisBackendAvailable] = useState(false);
  const [descriptiveBackendResult, setDescriptiveBackendResult] = useState<DescriptiveRow[] | null>(null);
  const [correlationBackendResult, setCorrelationBackendResult] = useState<{ matrix: number[][]; columnNames: string[] } | null>(null);
  const [toast, setToast] = useState<string | null>(null);
  const [lastHypothesisResult, setLastHypothesisResult] = useState<{ type: "ttest" | "chisquare" | "anova" | "mannwhitney"; payload: TTestResult | ChiSquareResult | ANOVAResult | MannWhitneyResult; meta?: { groupCol?: string; groupVal1?: string; groupVal2?: string; numCol?: string; chiCol1?: string; chiCol2?: string; factorCol?: string; valueCol?: string } } | null>(null);
  const [correlationMethod, setCorrelationMethod] = useState<"pearson" | "spearman" | "kendall">("pearson");
  const [theme, setTheme] = useState<"light" | "dark">(() => getPortalTheme());
  const [headerMenuOpen, setHeaderMenuOpen] = useState(false);
  const headerMenuRef = useRef<HTMLDivElement>(null);
  const [newWorkflowStepType, setNewWorkflowStepType] = useState<WorkflowStep["type"]>("import");
  const [newWorkflowStepLabel, setNewWorkflowStepLabel] = useState("");
  const [editingWorkflowNameId, setEditingWorkflowNameId] = useState<string | null>(null);
  const [editingWorkflowName, setEditingWorkflowName] = useState("");
  const [editingWorkflowDescriptionId, setEditingWorkflowDescriptionId] = useState<string | null>(null);
  const [editingWorkflowDescription, setEditingWorkflowDescription] = useState("");
  const [editingStepId, setEditingStepId] = useState<string | null>(null);
  const [editingStepLabel, setEditingStepLabel] = useState("");
  const [editingStepType, setEditingStepType] = useState<WorkflowStep["type"]>("import");
  const [editingStepNote, setEditingStepNote] = useState("");
  const [workflowOverviewMenuOpen, setWorkflowOverviewMenuOpen] = useState(false);
  const [stepMenuOpenId, setStepMenuOpenId] = useState<string | null>(null);
  const [draggingStepId, setDraggingStepId] = useState<string | null>(null);
  const [dropTargetIndex, setDropTargetIndex] = useState<number | null>(null);
  const [showDemoGallery, setShowDemoGallery] = useState(false);
  const [showSampleModal, setShowSampleModal] = useState(false);
  const [archiveModalOpen, setArchiveModalOpen] = useState(false);
  const [archiveSearchResult, setArchiveSearchResult] = useState<ArchiveSearchItem[]>([]);
  const [archiveSearchLoading, setArchiveSearchLoading] = useState(false);
  const [archiveSearchError, setArchiveSearchError] = useState<string | null>(null);
  const [archivePage, setArchivePage] = useState(1);
  const [selectedArchiveRequestId, setSelectedArchiveRequestId] = useState<string | null>(null);
  const [selectedArchiveTitle, setSelectedArchiveTitle] = useState("");
  const [archiveFiles, setArchiveFiles] = useState<ArchiveFileItem[]>([]);
  const [archiveFilesLoading, setArchiveFilesLoading] = useState(false);
  const [archiveDownloadingFileId, setArchiveDownloadingFileId] = useState<string | null>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const hasReadUrlRef = useRef(false);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  const selectedWorkflow = selectedWorkflowId ? workflows.find((w) => w.id === selectedWorkflowId) : null;
  const selectedStep = selectedWorkflow && selectedWorkflowStepId ? selectedWorkflow.steps.find((s) => s.id === selectedWorkflowStepId) : null;

  /** Danh sách bộ dữ liệu thuộc workflow hiện tại (để hiển thị ở panel trái) */
  const workflowDatasets = selectedWorkflow
    ? datasets.filter((d) => (selectedWorkflow.datasetIds ?? []).includes(d.id))
    : [];

  const handleSidebarCsvImport = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { rows, format } = parseFileContent(String(reader.result), file.name);
        if (rows.length < 2) return;
        const headers = rows[0];
        const kept = rows.slice(1, MAX_ROWS_STORED + 1);
        const id = generateId();
        const now = new Date().toISOString();
        const baseName = file.name.replace(/\.(csv|tsv|json|txt)$/i, "") || file.name;
        setDatasets((prev) => [...prev, { id, name: baseName, rows: kept.length, columns: headers.length, columnNames: headers, preview: rows.slice(0, 6), data: [headers, ...kept], sourceFormat: format, createdAt: now, updatedAt: now }]);
        setSelectedDatasetId(id);
        if (selectedWorkflowId) {
          setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflowId ? w : { ...w, datasetIds: [...(w.datasetIds ?? []), id].filter((x, i, a) => a.indexOf(x) === i), updatedAt: now })));
        }
      } catch (_) { /* ignore parse error */ }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }, [selectedWorkflowId]);

  const addSampleDatasetFromSidebar = useCallback((def: (typeof SAMPLE_DATASETS)[0]) => {
    const sourceKey = `sample:${def.id}`;
    const visibleList = selectedWorkflowId && selectedWorkflow
      ? datasets.filter((d) => (selectedWorkflow.datasetIds ?? []).includes(d.id))
      : datasets;
    if (visibleList.some((d) => d.sourceKey === sourceKey)) {
      showToast?.("Dataset mẫu này đã có trong danh sách hiện tại.");
      setShowSampleModal(false);
      return;
    }
    const id = generateId();
    const now = new Date().toISOString();
    const fullData = def.getData();
    const header = fullData[0];
    const dataRows = fullData.slice(1);
    const preview = fullData.slice(0, 6);
    setDatasets((prev) => [
      ...prev,
      { id, name: def.name, rows: dataRows.length, columns: header.length, columnNames: header, preview, data: fullData, sourceFormat: "csv", sourceKey, createdAt: now, updatedAt: now },
    ]);
    setSelectedDatasetId(id);
    if (selectedWorkflowId) {
      setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflowId ? w : { ...w, datasetIds: [...(w.datasetIds ?? []), id].filter((x, i, a) => a.indexOf(x) === i), updatedAt: now })));
    }
    setShowSampleModal(false);
  }, [selectedWorkflowId, selectedWorkflow, datasets]);

  /** Workflow chuẩn dùng để hiển thị bên trái khi chưa chọn workflow nào */
  const defaultWorkflowForDisplay = useMemo(() => getDefaultStandardWorkflow(), []);
  const workflowToShow = selectedWorkflow ?? defaultWorkflowForDisplay;

  const applyStepToNavigation = useCallback((step: WorkflowStep) => {
    switch (step.type) {
      case "import":
        setMainSection("data"); setDataTab("preview"); break;
      case "clean":
      case "transform":
        setMainSection("data"); setDataTab("transform"); break;
      case "describe":
        setMainSection("analysis"); setAnalysisTab("correlation"); break;
      case "test":
        setMainSection("analysis"); setAnalysisTab("correlation"); break;
      case "model":
        setMainSection("analysis"); setAnalysisTab("regression"); break;
      case "visualize":
        setMainSection("presentation"); setPresentationTab("visualization"); break;
      case "report":
        setMainSection("presentation"); setPresentationTab("visualization"); break;
      default:
        break;
    }
  }, []);

  const STEP_TYPE_LABELS: Record<WorkflowStep["type"], string> = {
    import: "Thu thập / Import dữ liệu",
    clean: "Làm sạch & kiểm tra chất lượng",
    transform: "Chuẩn bị biến & biến đổi",
    describe: "Thống kê mô tả (EDA)",
    test: "Kiểm định giả thuyết",
    model: "Hồi quy & mô hình",
    visualize: "Trực quan hóa",
    report: "Viết báo cáo",
  };
  const STEP_TYPE_ICONS: Record<WorkflowStep["type"], React.ReactNode> = {
    import: <Upload className="w-3.5 h-3.5" />,
    clean: <Shuffle className="w-3.5 h-3.5" />,
    transform: <BarChart3 className="w-3.5 h-3.5" />,
    describe: <BarChart3 className="w-3.5 h-3.5" />,
    test: <TestTube className="w-3.5 h-3.5" />,
    model: <TrendingUp className="w-3.5 h-3.5" />,
    visualize: <LineChartIcon className="w-3.5 h-3.5" />,
    report: <FileText className="w-3.5 h-3.5" />,
  };

  /** Quy trình chuẩn nghiên cứu – dùng để khởi tạo workflow mới hoặc tham chiếu */
  const DEFAULT_WORKFLOW_STEPS: { type: WorkflowStep["type"]; label: string }[] = [
    { type: "import", label: "Thu thập / Import dữ liệu" },
    { type: "clean", label: "Làm sạch & kiểm tra chất lượng" },
    { type: "transform", label: "Chuẩn bị biến & biến đổi" },
    { type: "describe", label: "Thống kê mô tả (EDA)" },
    { type: "test", label: "Kiểm định giả thuyết" },
    { type: "model", label: "Hồi quy & mô hình" },
    { type: "visualize", label: "Trực quan hóa" },
    { type: "report", label: "Viết báo cáo" },
  ];

  /** 4 nhóm tab chính trên header */
  const MAIN_TABS = [
    { id: "data" as const, label: "Khám phá & biến đổi dữ liệu", icon: Database, section: "data" as const },
    { id: "analysis" as const, label: "Phân tích thống kê", icon: BarChart3, section: "analysis" as const },
    { id: "presentation" as const, label: "Trực quan", icon: LineChartIcon, section: "presentation" as const },
    { id: "ai" as const, label: "AI hướng dẫn", icon: Sparkles, section: "ai" as const },
  ] as const;

  const getFirstStepInGroup = useCallback((group: "data" | "presentation" | "analysis") => {
    const sorted = [...workflowToShow.steps].sort((a, b) => a.order - b.order);
    if (group === "data") return sorted.find((s) => s.type === "import" || s.type === "clean" || s.type === "transform");
    if (group === "presentation") return sorted.find((s) => s.type === "visualize");
    if (group === "analysis") return sorted.find((s) => s.type === "describe" || s.type === "test" || s.type === "model");
    return undefined;
  }, [workflowToShow.steps]);

  const handleMainTabClick = useCallback((tab: typeof MAIN_TABS[number]) => {
    if (tab.section === "ai") {
      setMainSection("ai");
      return;
    }
    if (!selectedWorkflowId) {
      setWorkflows((prev) => prev.some((w) => w.id === defaultWorkflowForDisplay.id) ? prev : [...prev, defaultWorkflowForDisplay]);
      setSelectedWorkflowId(defaultWorkflowForDisplay.id);
    }
    const step = getFirstStepInGroup(tab.section);
    if (step) {
      setSelectedWorkflowStepId(step.id);
      applyStepToNavigation(step);
    } else {
      setMainSection(tab.section);
      if (tab.section === "data") setDataTab("preview");
      if (tab.section === "analysis") setAnalysisTab("correlation");
      if (tab.section === "presentation") setPresentationTab("visualization");
    }
  }, [selectedWorkflowId, getFirstStepInGroup, applyStepToNavigation]);


  useEffect(() => {
    saveDatasets(datasets);
  }, [datasets]);
  useEffect(() => {
    saveWorkflows(workflows);
  }, [workflows]);
  useEffect(() => {
    if (workflows.length > 0 && !selectedWorkflowId) setSelectedWorkflowId(workflows[0].id);
  }, [workflows, selectedWorkflowId]);
  /* Khi chọn workflow: không tự chọn bước đầu; hiển thị trang thông tin workflow. User bấm "Bắt đầu" mới vào bước đầu. */
  useEffect(() => {
    saveSelectedDatasetId(selectedDatasetId);
  }, [selectedDatasetId]);
  useEffect(() => {
    const id = loadSelectedDatasetId();
    if (id && !datasets.some((d) => d.id === id)) setSelectedDatasetId(null);
  }, [datasets]);

  // Đọc trạng thái từ URL khi mount (F5 / mở link)
  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const w = params.get("w");
    const d = params.get("d");
    const step = params.get("step");
    const s = params.get("s") as MainSection | null;
    const dt = params.get("dt") as DataTab | null;
    const at = params.get("at") as AnalysisTab | null;
    const rt = params.get("rt") as ReproducibilityTab | null;
    const pt = params.get("pt") as PresentationTab | null;
    const workflowsList = loadWorkflows();
    const datasetsList = loadDatasets();
    if (w && workflowsList.some((wf) => wf.id === w)) setSelectedWorkflowId(w);
    if (d && datasetsList.some((ds) => ds.id === d)) setSelectedDatasetId(d);
    const selWorkflow = w ? workflowsList.find((wf) => wf.id === w) : null;
    if (step && selWorkflow?.steps.some((st) => st.id === step)) {
      setSelectedWorkflowStepId(step);
    } else if (selWorkflow && s && s !== "workflow" && s !== "ai" && s !== "reproducibility") {
      // URL có section (data/analysis/presentation) nhưng không có step thì chọn bước tương ứng
      const sorted = [...selWorkflow.steps].sort((a, b) => a.order - b.order);
      const dataStep = sorted.find((st) => st.type === "import" || st.type === "clean" || st.type === "transform");
      const analysisStep = sorted.find((st) => st.type === "describe" || st.type === "test" || st.type === "model");
      const presStep = sorted.find((st) => st.type === "visualize" || st.type === "report");
      const stepForSection = s === "data" ? dataStep : s === "analysis" ? analysisStep : s === "presentation" ? presStep : null;
      if (stepForSection) setSelectedWorkflowStepId(stepForSection.id);
    }
    const mainSections: MainSection[] = ["workflow", "data", "analysis", "reproducibility", "presentation", "ai"];
    if (s && mainSections.includes(s)) setMainSection(s);
    const dataTabs: DataTab[] = ["import", "profiling", "transform", "preview", "descriptive"];
    if (dt && dataTabs.includes(dt)) setDataTab(dt === "import" ? "preview" : dt);
    const analysisTabs: AnalysisTab[] = ["descriptive", "hypothesis", "regression", "sem", "correlation", "reliability", "factor", "ml", "bayesian"];
    if (at && analysisTabs.includes(at)) setAnalysisTab(at);
    const reproTabs: ReproducibilityTab[] = ["workflows", "versioning"];
    if (rt && reproTabs.includes(rt)) setReproTab(rt);
    const presentationTabs: PresentationTab[] = ["visualization"];
    if (pt && presentationTabs.includes(pt)) setPresentationTab(pt);
    hasReadUrlRef.current = true;
  }, []);

  // Đẩy trạng thái lên URL khi thay đổi (để F5 giữ nguyên)
  useEffect(() => {
    if (!hasReadUrlRef.current) return;
    const params = new URLSearchParams();
    if (selectedWorkflowId) params.set("w", selectedWorkflowId);
    if (selectedDatasetId) params.set("d", selectedDatasetId);
    if (selectedWorkflowStepId) params.set("step", selectedWorkflowStepId);
    params.set("s", mainSection);
    params.set("dt", dataTab);
    params.set("at", analysisTab);
    params.set("rt", reproTab);
    params.set("pt", presentationTab);
    const qs = params.toString();
    const url = qs ? `${window.location.pathname}?${qs}` : window.location.pathname;
    window.history.replaceState(null, "", url);
  }, [selectedWorkflowId, selectedDatasetId, selectedWorkflowStepId, mainSection, dataTab, analysisTab, reproTab, presentationTab]);

  useEffect(() => {
    quantisApi.checkBackendAvailable().then(setUseBackend);
  }, []);
  useEffect(() => {
    quantisApi.checkAnalysisBackendAvailable().then(setAnalysisBackendAvailable);
  }, []);

  // Khi tab descriptive (ở Data hoặc Analysis) + backend Python: lấy thống kê mô tả từ server
  useEffect(() => {
    const onDescriptiveTab = mainSection === "data" && dataTab === "descriptive";
    if (!onDescriptiveTab || !analysisBackendAvailable || !selectedDataset) {
      setDescriptiveBackendResult(null);
      return;
    }
    const rows = getDataRows(selectedDataset);
    if (rows.length < 2) {
      setDescriptiveBackendResult(null);
      return;
    }
    quantisApi.analyzeDescriptive(rows).then((res) => setDescriptiveBackendResult(res ?? null));
  }, [mainSection, dataTab, analysisTab, analysisBackendAvailable, selectedDataset?.id]);

  // Khi tab correlation + backend Python: lấy ma trận tương quan từ server
  useEffect(() => {
    if (analysisTab !== "correlation" || !analysisBackendAvailable || !selectedDataset) {
      setCorrelationBackendResult(null);
      return;
    }
    const rows = getDataRows(selectedDataset);
    if (rows.length < 3) {
      setCorrelationBackendResult(null);
      return;
    }
    if (correlationMethod === "kendall") {
      setCorrelationBackendResult(null);
      return;
    }
    quantisApi.analyzeCorrelation(rows, correlationMethod).then((res) => setCorrelationBackendResult(res ?? null));
  }, [analysisTab, analysisBackendAvailable, selectedDataset?.id, correlationMethod]);

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

  // Khi có backend và state thay đổi: đồng bộ lên server (debounce 1.5s). Nếu save 404/lỗi thì tắt useBackend.
  useEffect(() => {
    if (!useBackend) return;
    const t = setTimeout(async () => {
      const ok = await quantisApi.saveData({ datasets, workflows });
      if (!ok) setUseBackend(false);
    }, 1500);
    return () => clearTimeout(t);
  }, [useBackend, datasets, workflows]);

  // Đồng bộ theme khi portal gửi theme (storage / postMessage)
  useEffect(() => {
    const sync = () => setTheme(getPortalTheme());
    window.addEventListener("storage", sync);
    window.addEventListener("message", (e: MessageEvent) => {
      const d = e.data as { type?: string } | null;
      if (d?.type === "portal-theme") sync();
    });
    return () => {
      window.removeEventListener("storage", sync);
    };
  }, []);

  // Đóng menu header khi click ra ngoài
  useEffect(() => {
    if (!headerMenuOpen) return;
    const onMouseDown = (e: MouseEvent) => {
      if (headerMenuRef.current && !headerMenuRef.current.contains(e.target as Node)) setHeaderMenuOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [headerMenuOpen]);

  const showToast = (msg: string) => {
    setToast(msg);
    setTimeout(() => setToast(null), 2000);
  };

  const toggleTheme = () => {
    const next = theme === "dark" ? "light" : "dark";
    setTheme(next);
    applyPortalTheme(next);
  };

  const handleResetWorkspace = () => {
    setHeaderMenuOpen(false);
    setConfirmDialog({
      message: "Reset toàn bộ workspace? Xóa hết dữ liệu và workflow đã lưu.",
      onConfirm: () => {
        setConfirmDialog(null);
        clearWorkspaceStorage();
        setDatasets([]);
        setWorkflows([]);
        setSelectedDatasetId(null);
        setSelectedWorkflowId(null);
        setSelectedWorkflowStepId(null);
        setDescriptiveBackendResult(null);
        setCorrelationBackendResult(null);
        setLastHypothesisResult(null);
        showToast("Đã reset workspace.");
      },
    });
  };

  const handleWorkflowStepClick = (stepId: string) => {
    switch (stepId) {
      case "import":
        setMainSection("data"); setDataTab("preview"); break;
      case "profiling":
        setMainSection("data"); setDataTab("profiling"); break;
      case "clean":
        setMainSection("data"); setDataTab("transform"); break;
      case "reliability":
        setMainSection("analysis"); setAnalysisTab("reliability"); break;
      case "hypothesis":
        setMainSection("analysis"); setAnalysisTab("correlation"); break;
      case "model":
        setMainSection("analysis"); setAnalysisTab("regression"); break;
      case "visualize":
        setMainSection("presentation"); setPresentationTab("visualization"); break;
      case "report":
        setMainSection("presentation"); setPresentationTab("visualization"); break;
      case "save":
        setMainSection("reproducibility"); setReproTab("workflows"); break;
      default:
        break;
    }
  };

  return (
    <div className="flex flex-col h-screen bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
      {/* Header */}
      <header className="flex-shrink-0 h-14 px-4 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 flex items-center">
        <button
          type="button"
          onClick={() => { setMainSection("workflow"); setSelectedWorkflowId(null); setSelectedWorkflowStepId(null); }}
          className="flex items-center gap-2 min-w-0 rounded-lg hover:opacity-90 transition-opacity text-left flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          title="Về Workflow nghiên cứu"
        >
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center flex-shrink-0">
            <Sigma className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-base truncate">Quantis</h1>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 truncate">Phân tích định lượng &amp; thống kê</p>
          </div>
        </button>
        <div className="flex-1 flex items-center justify-center min-w-0 overflow-x-auto">
          <div className="flex items-center h-full gap-0.5">
            {MAIN_TABS.map((tab) => {
              const isActive = mainSection === tab.section;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleMainTabClick(tab)}
                  className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                    isActive
                      ? "border-brand text-brand bg-brand/5 dark:bg-brand/10"
                      : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/50"
                  }`}
                  title={tab.label}
                >
                  <tab.icon className="w-4 h-4 shrink-0" />
                  <span>{tab.label}</span>
                </button>
              );
            })}
          </div>
        </div>
        <div className="flex items-center gap-1 flex-shrink-0" ref={headerMenuRef}>
          <button
            type="button"
            onClick={toggleTheme}
            className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
            title={theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
            aria-label={theme === "dark" ? "Chế độ sáng" : "Chế độ tối"}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          <div className="relative">
            <button
              type="button"
              onClick={() => setHeaderMenuOpen((v) => !v)}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              title="Menu"
              aria-label="Menu"
              aria-expanded={headerMenuOpen}
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {headerMenuOpen && (
              <div className="absolute right-0 top-full mt-1 py-1 min-w-[180px] rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg z-50">
                <button
                  type="button"
                  onClick={() => { setShowDemoGallery(true); setHeaderMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                >
                  <Download className="w-4 h-4" />
                  Tải workflow mẫu
                </button>
                {selectedWorkflow && (
                  <button
                    type="button"
                    onClick={() => {
                      setHeaderMenuOpen(false);
                      setConfirmDialog({
                        message: `Xóa workflow "${selectedWorkflow.name}"?`,
                        onConfirm: () => {
                          setWorkflows((prev) => prev.filter((x) => x.id !== selectedWorkflow.id));
                          setSelectedWorkflowId(selectedWorkflowId === selectedWorkflow.id ? null : selectedWorkflowId);
                          setSelectedWorkflowStepId(null);
                          setConfirmDialog(null);
                        },
                      });
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-red-500 focus-visible:ring-inset rounded"
                  >
                    <Trash2 className="w-4 h-4" />
                    Xóa workflow
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => { setGuideOpen(true); setHeaderMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                >
                  <CircleHelp className="w-4 h-4" />
                  Hướng dẫn
                </button>
                <button
                  type="button"
                  onClick={() => { setShowSettings(true); setHeaderMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                >
                  <Settings className="w-4 h-4" />
                  Cài đặt
                </button>
                <button
                  type="button"
                  onClick={() => { setShowAppFeedbackModal(true); setHeaderMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                >
                  <FileText className="w-4 h-4" />
                  Góp ý ứng dụng
                </button>
                <button
                  type="button"
                  onClick={handleResetWorkspace}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                >
                  <RotateCcw className="w-4 h-4" />
                  Reset workspace
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      <div className="flex flex-1 min-h-0">
      {/* Sidebar trái ở quản lý workflow + bộ dữ liệu + import */}
      <aside className={`${sidebarOpen ? "w-64" : "w-0"} flex-shrink-0 border-r border-neutral-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 flex flex-col overflow-hidden transition-[width] duration-200`}>
        {sidebarOpen && (
          <div className="flex flex-col h-full min-h-0">
            <div className="p-3 flex flex-col gap-3 flex-shrink-0">
              <div className="flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                <GitBranch className="w-4 h-4 shrink-0" />
                <span className="text-sm font-semibold">Workflow</span>
              </div>
              <div className="flex items-center gap-2">
                <select
                  value={selectedWorkflowId ?? ""}
                  onChange={(e) => {
                    const v = e.target.value || null;
                    setSelectedWorkflowId(v);
                    setSelectedWorkflowStepId(null);
                  }}
                  className="flex-1 min-w-0 text-sm rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 truncate"
                  title={selectedWorkflow?.name}
                >
                  <option value="">— Chọn workflow —</option>
                  {workflows.map((w) => (
                    <option key={w.id} value={w.id}>{w.name} ({w.steps.length})</option>
                  ))}
                </select>
                <button
                  type="button"
                  onClick={() => {
                    const w = getSampleWorkflowStandalone();
                    setWorkflows((prev) => [...prev, { ...w, name: `Workflow ${prev.length + 1}` }]);
                    setSelectedWorkflowId(w.id);
                    setSelectedWorkflowStepId(null);
                  }}
                  className="flex-shrink-0 flex items-center justify-center p-2 rounded-lg border border-brand bg-brand/10 dark:bg-brand/20 text-brand text-sm font-medium hover:bg-brand/20 dark:hover:bg-brand/30"
                  title="Tạo workflow mới"
                >
                  <FilePlus className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Bộ dữ liệu + Import (luôn hiển thị ở panel trái với mọi tab) */}
            <div className="flex flex-col flex-1 min-h-0 border-t border-neutral-200 dark:border-neutral-700">
                <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                  <Database className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-semibold">Bộ dữ liệu (Import)</span>
                </div>
                <div className="flex-shrink-0 px-3 pb-2 flex flex-col gap-1.5">
                  <input ref={csvFileInputRef} type="file" accept=".csv,.tsv,.txt,.json,application/json" className="hidden" onChange={handleSidebarCsvImport} />
                  <button
                    type="button"
                    onClick={() => csvFileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    <Upload className="w-4 h-4" /> Tải file
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSampleModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                  >
                    <Plus className="w-4 h-4" /> Thêm dataset mẫu
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setArchiveModalOpen(true);
                      setArchiveSearchError(null);
                      setArchiveSearchResult([]);
                      setSelectedArchiveRequestId(null);
                      setArchiveFiles([]);
                      setArchiveSearchLoading(true);
                      archiveApi.searchDatasets(1, 10).then((r) => {
                        setArchiveSearchResult(r.items ??[]);
                        setArchivePage(1);
                        setArchiveSearchLoading(false);
                      }).catch((e) => {
                        setArchiveSearchError(e instanceof Error ? e.message : "Không tải được danh sách");
                        setArchiveSearchLoading(false);
                      });
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-sky-300 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-200 text-sm hover:bg-sky-100 dark:hover:bg-sky-800/30"
                  >
                    <Cloud className="w-4 h-4" /> Lấy từ Archive NEU
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
                  {(selectedWorkflowId && selectedWorkflow ? workflowDatasets : datasets).length === 0 ? (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 py-2">Chưa có bộ dữ liệu. Dùng nút trên để import.</p>
                  ) : (
                    <ul className="space-y-1">
                      {(selectedWorkflowId && selectedWorkflow ? workflowDatasets : datasets).map((d) => {
                        const ext = d.sourceFormat ? (d.sourceFormat === "csv" ? ".csv" : d.sourceFormat === "tsv" ? ".tsv" : d.sourceFormat === "excel" ? ".xlsx" : `.${d.sourceFormat}`) : "";
                        const sourceLabel = d.sourceKey?.startsWith("sample:") ? "Dữ liệu mẫu" : d.sourceKey?.startsWith("archive:") ? "Archive NEU" : null;
                        return (
                          <li key={d.id} className="group flex items-stretch gap-0.5 rounded-lg overflow-hidden border border-transparent hover:border-neutral-200 dark:hover:border-neutral-600">
                            <button
                              type="button"
                              onClick={() => setSelectedDatasetId(d.id)}
                              className={`flex-1 min-w-0 text-left px-2.5 py-2 rounded-l-lg text-sm truncate border transition-colors ${
                                selectedDatasetId === d.id
                                  ? "bg-brand/15 dark:bg-brand/25 border-brand/40 text-brand dark:text-brand"
                                  : "border-transparent hover:bg-neutral-100 dark:hover:bg-neutral-700/50 text-neutral-700 dark:text-neutral-300"
                              }`}
                              title={`${d.name} (${d.rows}×${d.columns})${ext ? ` ${ext}` : ""}${sourceLabel ? ` · ${sourceLabel}` : ""}`}
                            >
                              <span className="font-medium truncate block">{d.name}</span>
                              <span className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5 flex-wrap">
                                <span>{d.rows}×{d.columns}</span>
                                {ext && <span className="opacity-80">{ext}</span>}
                                {sourceLabel && (
                                  <span className={d.sourceKey?.startsWith("archive:") ? "text-sky-600 dark:text-sky-400" : "text-amber-600 dark:text-amber-400"}>
                                    {sourceLabel}
                                  </span>
                                )}
                              </span>
                            </button>
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                setConfirmDialog({
                                  message: `Xóa bộ dữ liệu "${d.name}"?`,
                                  onConfirm: () => {
                                    setDatasets((prev) => prev.filter((x) => x.id !== d.id));
                                    if (selectedDatasetId === d.id) setSelectedDatasetId(null);
                                    const now = new Date().toISOString();
                                    setWorkflows((prev) => prev.map((w) => ({
                                      ...w,
                                      datasetIds: (w.datasetIds ??[]).filter((id) => id !== d.id),
                                      updatedAt: now,
                                    })));
                                    setConfirmDialog(null);
                                    showToast("Đã xóa bộ dữ liệu.");
                                  },
                                });
                              }}
                              className="flex-shrink-0 p-1.5 rounded-r-lg border border-transparent hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                              title="Xóa bộ dữ liệu"
                              aria-label="Xóa bộ dữ liệu"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  )}
                </div>
              </div>
          </div>
        )}
      </aside>

      {/* Main content + Thanh toolbar theo từng bước */}
      <div className="flex-1 min-h-0 min-w-0 flex flex-col w-full">
        {/* Toolbar ngang khi tab Khám phá & biến đổi — ẩn khi đang xem chi tiết workflow */}
        {mainSection === "data" && !(selectedWorkflowId && selectedWorkflow && !selectedStep) && (
          <div className="flex-shrink-0 px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-1 flex-wrap min-w-0">
            <button type="button" onClick={() => setDataTab("preview")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "preview" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Table2 className="w-4 h-4 shrink-0" /> Xem dữ liệu</button>
            <button type="button" onClick={() => setDataTab("profiling")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "profiling" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><ScanSearch className="w-4 h-4 shrink-0" /> Sơ bộ</button>
            <button type="button" onClick={() => setDataTab("descriptive")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "descriptive" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><BarChart3 className="w-4 h-4 shrink-0" /> Mô tả</button>
            <button type="button" onClick={() => setDataTab("transform")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "transform" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Shuffle className="w-4 h-4 shrink-0" /> Biến đổi</button>
          </div>
        )}
        {/* Toolbar ở Analysis: Kiểm định / Hồi quy / SEM / ... */}
        {mainSection === "analysis" && (!selectedWorkflowId || selectedStep) && (
          <div role="toolbar" aria-label="Tab phân tích" className="toolbar flex-shrink-0 px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-1 flex-nowrap overflow-x-auto min-w-0">
            <button type="button" onClick={() => setAnalysisTab("correlation")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "correlation" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><BarChart3 className="w-4 h-4 shrink-0" /> Tương quan</button>
            <button type="button" onClick={() => setAnalysisTab("hypothesis")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "hypothesis" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><TestTube className="w-4 h-4 shrink-0" /> Kiểm định</button>
            <button type="button" onClick={() => setAnalysisTab("reliability")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "reliability" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><CheckCircle2 className="w-4 h-4 shrink-0" /> Độ tin cậy</button>
            <button type="button" onClick={() => setAnalysisTab("regression")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "regression" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><TrendingUp className="w-4 h-4 shrink-0" /> Hồi quy</button>
            <button type="button" onClick={() => setAnalysisTab("factor")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "factor" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Calculator className="w-4 h-4 shrink-0" /> Nhân tố</button>
            <button type="button" onClick={() => setAnalysisTab("sem")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "sem" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Network className="w-4 h-4 shrink-0" /> SEM</button>
            <button type="button" onClick={() => setAnalysisTab("ml")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "ml" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Cpu className="w-4 h-4 shrink-0" /> Học máy</button>
            <button type="button" onClick={() => setAnalysisTab("bayesian")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "bayesian" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Sigma className="w-4 h-4 shrink-0" /> Bayesian</button>
          </div>
        )}
        {/* Trực quan: toolbar loại biểu đồ (cùng vị trí với tab Data / Analysis) */}
        {mainSection === "presentation" && (!selectedWorkflowId || selectedStep) && (
          <div role="toolbar" aria-label="Loại biểu đồ" className="toolbar flex-shrink-0 px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-1 flex-nowrap overflow-x-auto min-w-0">
            <button type="button" onClick={() => setPresentationChartType("scatter")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "scatter" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Scatter"><ScatterChartIcon className="w-4 h-4 shrink-0" /><span>Scatter</span></button>
            <button type="button" onClick={() => setPresentationChartType("bar")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "bar" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Cột"><BarChart3 className="w-4 h-4 shrink-0" /><span>Cột</span></button>
            <button type="button" onClick={() => setPresentationChartType("line")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "line" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Đường"><LineChartIcon className="w-4 h-4 shrink-0" /><span>Đường</span></button>
            <button type="button" onClick={() => setPresentationChartType("area")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "area" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Vùng"><AreaChartIcon className="w-4 h-4 shrink-0" /><span>Vùng</span></button>
            <button type="button" onClick={() => setPresentationChartType("stackedBar")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "stackedBar" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Cột chồng"><Layers className="w-4 h-4 shrink-0" /><span>Cột chồng</span></button>
            <button type="button" onClick={() => setPresentationChartType("pie")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "pie" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Tròn"><PieChartIcon className="w-4 h-4 shrink-0" /><span>Tròn</span></button>
            <button type="button" onClick={() => setPresentationChartType("box")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "box" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Box plot"><BoxSelect className="w-4 h-4 shrink-0" /><span>Box plot</span></button>
            <button type="button" onClick={() => setPresentationChartType("histogram")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "histogram" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Histogram"><BarChart2 className="w-4 h-4 shrink-0" /><span>Histogram</span></button>
            <button type="button" onClick={() => setPresentationChartType("radar")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "radar" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Radar"><Gauge className="w-4 h-4 shrink-0" /><span>Radar</span></button>
            <button type="button" onClick={() => setPresentationChartType("heatmap")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "heatmap" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Heatmap tương quan"><Grid3X3 className="w-4 h-4 shrink-0" /><span>Heatmap</span></button>
            <button type="button" onClick={() => setPresentationChartType("summary")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "summary" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Thẻ tóm tắt"><LayoutTemplate className="w-4 h-4 shrink-0" /><span>Thẻ tóm tắt</span></button>
            <button type="button" onClick={() => setPresentationChartType("donut")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "donut" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Donut"><CircleDot className="w-4 h-4 shrink-0" /><span>Donut</span></button>
            <button type="button" onClick={() => setPresentationChartType("barH")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "barH" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Cột ngang"><BarChart3 className="w-4 h-4 shrink-0 rotate-90" /><span>Cột ngang</span></button>
            <button type="button" onClick={() => setPresentationChartType("dashboard")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "dashboard" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Dashboard"><LayoutDashboard className="w-4 h-4 shrink-0" /><span>Dashboard</span></button>
            <button type="button" onClick={() => setPresentationChartType("multiLine")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "multiLine" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Đa đường"><TrendingUp className="w-4 h-4 shrink-0" /><span>Đa đường</span></button>
            <button type="button" onClick={() => setPresentationChartType("crosstab")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${presentationChartType === "crosstab" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Bảng chéo"><Table2 className="w-4 h-4 shrink-0" /><span>Bảng chéo</span></button>
          </div>
        )}
        {/* Toolbar ở theo bước workflow (khi đang xem Các bước, chọn 1 bước) — không hiện khi đang ở tab AI hướng dẫn */}
        {selectedStep && mainSection !== "data" && mainSection !== "presentation" && mainSection !== "analysis" && mainSection !== "ai" && (
          <div role="toolbar" aria-label="Tab theo bước" className="toolbar flex-shrink-0 px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-1 flex-wrap min-w-0">
            {selectedStep.type === "import" && (
              <>
                <button type="button" onClick={() => setDataTab("preview")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "preview" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Table2 className="w-4 h-4 shrink-0" /> Xem dữ liệu</button>
                <button type="button" onClick={() => setDataTab("profiling")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "profiling" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><ScanSearch className="w-4 h-4 shrink-0" /> Sơ bộ</button>
                <button type="button" onClick={() => setDataTab("transform")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "transform" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Shuffle className="w-4 h-4 shrink-0" /> Biến đổi</button>
              </>
            )}
            {(selectedStep.type === "clean" || selectedStep.type === "transform") && (
              <>
                <button type="button" onClick={() => setDataTab("transform")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "transform" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Shuffle className="w-4 h-4 shrink-0" /> Biến đổi</button>
                <button type="button" onClick={() => setDataTab("preview")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "preview" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Table2 className="w-4 h-4 shrink-0" /> Xem dữ liệu</button>
              </>
            )}
            {(selectedStep.type === "describe" || selectedStep.type === "test" || selectedStep.type === "model") && (
              <>
                <button type="button" onClick={() => setAnalysisTab("correlation")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "correlation" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><BarChart3 className="w-4 h-4 shrink-0" /> Tương quan</button>
                <button type="button" onClick={() => setAnalysisTab("hypothesis")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "hypothesis" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><TestTube className="w-4 h-4 shrink-0" /> Kiểm định</button>
                <button type="button" onClick={() => setAnalysisTab("reliability")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "reliability" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><CheckCircle2 className="w-4 h-4 shrink-0" /> Độ tin cậy</button>
                <button type="button" onClick={() => setAnalysisTab("regression")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "regression" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><TrendingUp className="w-4 h-4 shrink-0" /> Hồi quy</button>
                <button type="button" onClick={() => setAnalysisTab("factor")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "factor" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Calculator className="w-4 h-4 shrink-0" /> Nhân tố</button>
                <button type="button" onClick={() => setAnalysisTab("sem")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "sem" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Network className="w-4 h-4 shrink-0" /> SEM</button>
                <button type="button" onClick={() => setAnalysisTab("ml")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "ml" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Cpu className="w-4 h-4 shrink-0" /> Học máy</button>
                <button type="button" onClick={() => setAnalysisTab("bayesian")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "bayesian" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Sigma className="w-4 h-4 shrink-0" /> Bayesian</button>
              </>
            )}
            {selectedStep.type === "visualize" && (
              <span className="text-sm text-neutral-500 dark:text-neutral-400">Trực quan</span>
            )}
          </div>
        )}
        <main className="flex-1 overflow-y-auto p-6 min-h-0 w-full max-w-full">
        {!selectedWorkflowId && (
          <div className="w-full max-w-full py-12">
            <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Workflow phân tích</h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">Chọn workflow trong danh sách bên trái (hoặc bấm <strong>Tạo mới</strong> cạnh ở trên) để bắt đầu. Trong mỗi workflow bạn có thể import bộ dữ liệu từ panel trái ở sau đó dùng 4 tab trên header để khám phá, phân tích, trực quan hóa và AI hướng dẫn trên dữ liệu đã chọn.</p>
          </div>
        )}
        {selectedWorkflowId && selectedWorkflow && !selectedStep && (
          <div className="w-full max-w-full max-w-2xl">
            <div className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden">
              <div className="p-6 border-b border-neutral-200 dark:border-neutral-700">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0 flex-1">
                    {editingWorkflowNameId === selectedWorkflow.id ? (
                      <div className="space-y-3">
                        <p className="text-xs font-medium text-brand dark:text-brand/90">Đang sửa workflow</p>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Tên workflow</label>
                          <input
                            type="text"
                            value={editingWorkflowName}
                            onChange={(e) => setEditingWorkflowName(e.target.value)}
                            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200"
                            placeholder="Tên workflow"
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">Mô tả</label>
                          <textarea
                            value={editingWorkflowDescription}
                            onChange={(e) => setEditingWorkflowDescription(e.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 resize-none"
                            placeholder="Mô tả (tùy chọn)"
                          />
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => {
                              if (editingWorkflowName.trim()) {
                                setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflow.id ? w : { ...w, name: editingWorkflowName.trim(), description: editingWorkflowDescription.trim() || undefined, updatedAt: new Date().toISOString() })));
                                setEditingWorkflowNameId(null);
                                setEditingWorkflowDescriptionId(null);
                              }
                            }}
                            className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:opacity-90"
                          >
                            Lưu
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingWorkflowNameId(null); setEditingWorkflowDescriptionId(null); }}
                            className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                          >
                            Hủy
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-1">{selectedWorkflow.name}</h2>
                        {selectedWorkflow.description && (
                          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-2">{selectedWorkflow.description}</p>
                        )}
                        <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-2">
                          Cập nhật: {new Date(selectedWorkflow.updatedAt).toLocaleDateString("vi-VN")} · {selectedWorkflow.steps.length} bước · {(selectedWorkflow.datasetIds ?? []).length} bộ dữ liệu
                        </p>
                      </>
                    )}
                  </div>
                  {editingWorkflowNameId !== selectedWorkflow.id && (
                    <div className="relative flex items-center shrink-0">
                      <button
                        type="button"
                        onClick={() => setWorkflowOverviewMenuOpen((v) => !v)}
                        className="p-2 rounded-lg text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 hover:text-neutral-800 dark:hover:text-neutral-200"
                        title="Tùy chọn"
                        aria-expanded={workflowOverviewMenuOpen}
                      >
                        <MoreVertical className="w-4 h-4" />
                      </button>
                      {workflowOverviewMenuOpen && (
                        <>
                          <div className="fixed inset-0 z-10" onClick={() => setWorkflowOverviewMenuOpen(false)} aria-hidden />
                          <div className="absolute right-0 top-full mt-1 z-20 min-w-[140px] rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg py-1">
                            <button
                              type="button"
                              onClick={() => {
                                setEditingWorkflowNameId(selectedWorkflow.id);
                                setEditingWorkflowName(selectedWorkflow.name);
                                setEditingWorkflowDescriptionId(selectedWorkflow.id);
                                setEditingWorkflowDescription(selectedWorkflow.description ?? "");
                                setWorkflowOverviewMenuOpen(false);
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                            >
                              <Edit2 className="w-4 h-4 shrink-0" /> Sửa workflow
                            </button>
                            <button
                              type="button"
                              onClick={() => {
                                setWorkflowOverviewMenuOpen(false);
                                setConfirmDialog({
                                  message: `Xóa workflow "${selectedWorkflow.name}"?`,
                                  onConfirm: () => {
                                    setWorkflows((prev) => prev.filter((x) => x.id !== selectedWorkflow.id));
                                    setSelectedWorkflowId(selectedWorkflowId === selectedWorkflow.id ? null : selectedWorkflowId);
                                    setSelectedWorkflowStepId(null);
                                    setConfirmDialog(null);
                                  },
                                });
                              }}
                              className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                            >
                              <Trash2 className="w-4 h-4 shrink-0" /> Xóa workflow
                            </button>
                          </div>
                        </>
                      )}
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Các bước trong workflow</h3>
                  {selectedWorkflow.steps.length === 0 ? (
                    <>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">Quy trình chuẩn nghiên cứu định tính/định lượng:</p>
                      <ol className="list-decimal list-inside space-y-1.5 text-sm text-neutral-600 dark:text-neutral-400 mb-4">
                        {DEFAULT_WORKFLOW_STEPS.map((d, i) => (
                          <li key={i}>{d.label}</li>
                        ))}
                      </ol>
                      <button
                        type="button"
                        onClick={() => {
                          const now = new Date().toISOString();
                          setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflow.id ? w : {
                            ...w,
                            steps: DEFAULT_WORKFLOW_STEPS.map((d, i) => ({
                              id: generateId(),
                              type: d.type,
                              label: d.label,
                              config: {},
                              order: i,
                              createdAt: now,
                            })),
                            updatedAt: now,
                          })));
                        }}
                        className="rounded-lg bg-brand text-white px-4 py-2 text-sm font-medium hover:opacity-90"
                      >
                        Khởi tạo theo quy trình chuẩn
                      </button>
                    </>
                  ) : (
                    <>
                      <ul className="space-y-2 mb-4">
                        {(() => {
                          const sortedSteps = [...selectedWorkflow.steps].sort((a, b) => a.order - b.order);
                          const handleDragStart = (e: React.DragEvent, stepId: string) => {
                            if (editingStepId) return;
                            setDraggingStepId(stepId);
                            e.dataTransfer.setData("text/plain", stepId);
                            e.dataTransfer.effectAllowed = "move";
                            e.dataTransfer.dropEffect = "move";
                          };
                          const handleDragEnd = () => {
                            setDraggingStepId(null);
                            setDropTargetIndex(null);
                          };
                          const handleDragOver = (e: React.DragEvent, index: number) => {
                            e.preventDefault();
                            e.dataTransfer.dropEffect = "move";
                            setDropTargetIndex(index);
                          };
                          const handleDrop = (e: React.DragEvent, dropIndex: number) => {
                            e.preventDefault();
                            const stepId = e.dataTransfer.getData("text/plain");
                            if (!stepId) return;
                            const sorted = [...sortedSteps];
                            const fromIndex = sorted.findIndex((st) => st.id === stepId);
                            if (fromIndex === -1) return;
                            const toIndex = fromIndex < dropIndex ? dropIndex - 1 : dropIndex;
                            if (fromIndex === toIndex) {
                              setDraggingStepId(null);
                              setDropTargetIndex(null);
                              return;
                            }
                            const [removed] = sorted.splice(fromIndex, 1);
                            sorted.splice(toIndex, 0, removed);
                            const reordered = sorted.map((st, idx) => ({ ...st, order: idx }));
                            setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflow.id ? w : { ...w, steps: reordered, updatedAt: new Date().toISOString() })));
                            setDraggingStepId(null);
                            setDropTargetIndex(null);
                          };
                          return sortedSteps.map((s, i) => (
                            <li
                              key={s.id}
                              draggable={editingStepId !== s.id}
                              onDragStart={(e) => handleDragStart(e, s.id)}
                              onDragEnd={handleDragEnd}
                              onDragOver={(e) => handleDragOver(e, i)}
                              onDrop={(e) => handleDrop(e, i)}
                              className={`rounded-lg border p-3 text-sm transition-colors ${draggingStepId === s.id ? "opacity-50 bg-neutral-100 dark:bg-neutral-800" : "bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-600"} ${dropTargetIndex === i && draggingStepId !== s.id ? "ring-2 ring-brand/50 border-brand" : ""}`}
                            >
                            {editingStepId === s.id ? (
                              <div className="space-y-2">
                                <div className="flex flex-wrap items-center gap-2">
                                  <select value={editingStepType} onChange={(e) => setEditingStepType(e.target.value as WorkflowStep["type"])} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm">
                                    {(Object.keys(STEP_TYPE_LABELS) as WorkflowStep["type"][]).map((t) => (
                                      <option key={t} value={t}>{STEP_TYPE_LABELS[t]}</option>
                                    ))}
                                  </select>
                                  <input type="text" value={editingStepLabel} onChange={(e) => setEditingStepLabel(e.target.value)} placeholder="Nhãn bước" className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm flex-1 min-w-[140px]" />
                                </div>
                                <textarea value={editingStepNote} onChange={(e) => setEditingStepNote(e.target.value)} placeholder="Ghi chú (tùy chọn)" rows={2} className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm resize-none" />
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => {
                                    const next = selectedWorkflow.steps.map((st) => st.id === s.id ? { ...st, type: editingStepType, label: editingStepLabel.trim() || st.label, note: editingStepNote.trim() || undefined, updatedAt: new Date().toISOString() } : st);
                                    setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflow.id ? w : { ...w, steps: next, updatedAt: new Date().toISOString() })));
                                    setEditingStepId(null);
                                  }} className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm font-medium hover:opacity-90">Lưu</button>
                                  <button type="button" onClick={() => { setEditingStepId(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300">Hủy</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1 flex items-center gap-2">
                                  {editingStepId !== s.id && (
                                    <span className="cursor-grab active:cursor-grabbing text-neutral-400 dark:text-neutral-500 shrink-0" aria-label="Kéo để đổi thứ tự">
                                      <GripVertical className="w-4 h-4" />
                                    </span>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 font-medium text-xs shrink-0">{i + 1}</span>
                                      <span className="text-neutral-600 dark:text-neutral-400 text-xs">{STEP_TYPE_LABELS[s.type]}</span>
                                      <span className="text-neutral-800 dark:text-neutral-200 font-medium">{s.label}</span>
                                    </div>
                                    {s.note && <p className="mt-1.5 ml-8 text-xs text-neutral-500 dark:text-neutral-400 italic">{s.note}</p>}
                                  </div>
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                  <div className="relative">
                                    <button
                                      type="button"
                                      onClick={() => setStepMenuOpenId((id) => (id === s.id ? null : s.id))}
                                      className="p-1.5 rounded text-neutral-500 hover:bg-neutral-200 dark:hover:bg-neutral-600 hover:text-neutral-800 dark:hover:text-neutral-200"
                                      title="Tùy chọn bước"
                                      aria-expanded={stepMenuOpenId === s.id}
                                    >
                                      <MoreVertical className="w-3.5 h-3.5" />
                                    </button>
                                    {stepMenuOpenId === s.id && (
                                      <>
                                        <div className="fixed inset-0 z-10" onClick={() => setStepMenuOpenId(null)} aria-hidden />
                                        <div className="absolute right-0 top-full mt-1 z-20 min-w-[130px] rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg py-1">
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setEditingStepId(s.id);
                                              setEditingStepLabel(s.label);
                                              setEditingStepType(s.type);
                                              setEditingStepNote(s.note ?? "");
                                              setStepMenuOpenId(null);
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                                          >
                                            <Edit2 className="w-3.5 h-3.5 shrink-0" /> Sửa bước
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setStepMenuOpenId(null);
                                              setConfirmDialog({
                                                message: `Xóa bước "${s.label}"?`,
                                                onConfirm: () => {
                                                  setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflow.id ? w : { ...w, steps: w.steps.filter((st) => st.id !== s.id).map((st, idx) => ({ ...st, order: idx })), updatedAt: new Date().toISOString() })));
                                                  setConfirmDialog(null);
                                                  if (selectedWorkflowStepId === s.id) setSelectedWorkflowStepId(null);
                                                },
                                              });
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 shrink-0" /> Xóa bước
                                          </button>
                                        </div>
                                      </>
                                    )}
                                  </div>
                                </div>
                              </div>
                            )}
                          </li>
                            ));
                        })()}
                      </ul>
                      <div className="flex flex-wrap items-center gap-2">
                        <select value={newWorkflowStepType} onChange={(e) => setNewWorkflowStepType(e.target.value as WorkflowStep["type"])} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm">
                          {(Object.keys(STEP_TYPE_LABELS) as WorkflowStep["type"][]).map((t) => (
                            <option key={t} value={t}>{STEP_TYPE_LABELS[t]}</option>
                          ))}
                        </select>
                        <input type="text" value={newWorkflowStepLabel} onChange={(e) => setNewWorkflowStepLabel(e.target.value)} placeholder="Nhãn bước (tùy chọn)" className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm w-44" />
                        <button
                          type="button"
                          onClick={() => {
                            const now = new Date().toISOString();
                            const label = newWorkflowStepLabel.trim() || STEP_TYPE_LABELS[newWorkflowStepType];
                            const newStep: WorkflowStep = { id: generateId(), type: newWorkflowStepType, label, config: {}, order: selectedWorkflow.steps.length, createdAt: now };
                            setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflow.id ? w : { ...w, steps: [...w.steps, newStep], updatedAt: now })));
                            setNewWorkflowStepLabel("");
                          }}
                          className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm font-medium hover:opacity-90"
                        >
                          Thêm bước
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {workflowDatasets.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">Bộ dữ liệu đã gắn</h3>
                    <ul className="space-y-1.5">
                      {workflowDatasets.map((d) => (
                        <li key={d.id} className="text-sm text-neutral-600 dark:text-neutral-400">
                          {d.name} ({d.rows}×{d.columns})
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
            </div>
          </div>
        )}
        {mainSection === "data" && (!selectedWorkflowId || selectedStep) && (
          <DataView
            tab={dataTab}
            datasets={datasets}
            setDatasets={setDatasets}
            selectedDatasetId={selectedDatasetId}
            onSelectDataset={setSelectedDatasetId}
            showToast={showToast}
            onWorkflowDatasetAdd={selectedWorkflowId ? (id) => {
              setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflowId ? w : {
                ...w,
                datasetIds: [...(w.datasetIds ?? []), id].filter((x, i, a) => a.indexOf(x) === i),
                updatedAt: new Date().toISOString(),
              })));
            } : undefined}
            analysisBackendAvailable={analysisBackendAvailable}
            descriptiveBackendResult={descriptiveBackendResult}
          />
        )}
        {mainSection === "analysis" && (!selectedWorkflowId || selectedStep) && (
          <AnalysisView
            tab={analysisTab}
            selectedDataset={selectedDataset}
            onHypothesisResult={setLastHypothesisResult}
            correlationMethod={correlationMethod}
            setCorrelationMethod={setCorrelationMethod}
            analysisBackendAvailable={analysisBackendAvailable}
            descriptiveBackendResult={descriptiveBackendResult}
            correlationBackendResult={correlationBackendResult}
          />
        )}
        {mainSection === "presentation" && (!selectedWorkflowId || selectedStep) && (
          <PresentationView tab={presentationTab} onTabChange={setPresentationTab} selectedDataset={selectedDataset} lastHypothesisResult={lastHypothesisResult} analysisBackendAvailable={analysisBackendAvailable} chartType={presentationChartType} setChartType={setPresentationChartType} />
        )}
        {mainSection === "reproducibility" && (
          <ReproducibilityView tab={reproTab} workflows={workflows} setWorkflows={setWorkflows} selectedWorkflowId={selectedWorkflowId} onSelectWorkflow={setSelectedWorkflowId} showToast={showToast} />
        )}
        {mainSection === "ai" && (
          <div className="w-full max-w-full">
            <AIAssistView selectedDataset={selectedDataset} compact={false} />
          </div>
        )}
      </main>
      </div>
      </div>
      {/* Status Bar luôn pin dưới cùng */}
      <footer className="h-8 shrink-0 flex items-center gap-3 px-3 border-t border-neutral-200 dark:border-neutral-700 bg-neutral-100 dark:bg-neutral-800/80 text-xs text-neutral-600 dark:text-neutral-400">
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className="p-1.5 rounded-md hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
          title={sidebarOpen ? "Thu gọn sidebar" : "Mở sidebar"}
          aria-label={sidebarOpen ? "Thu gọn sidebar" : "Mở sidebar"}
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
        <span className="truncate flex-1 min-w-0" title={selectedDataset ? `${selectedDataset.name} (${selectedDataset.rows}×${selectedDataset.columns})` : "Chọn hoặc import bộ dữ liệu"}>
          {selectedDataset ? (
            <>Dataset: <strong className="font-medium text-neutral-700 dark:text-neutral-300">{selectedDataset.name}</strong> ({selectedDataset.rows}×{selectedDataset.columns}){selectedWorkflow ? <> · Workflow: {selectedWorkflow.name}{selectedStep ? ` · ${selectedStep.label}` : ""}</> : ""} · {datasets.length} bộ</>
          ) : (
            <>Chưa chọn dataset{selectedWorkflow ? ` · Workflow: ${selectedWorkflow.name}${selectedStep ? ` · ${selectedStep.label}` : ""}` : ""} · {datasets.length} bộ</>
          )}
        </span>
      </footer>

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirmDialog(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl max-w-md w-full border border-neutral-200 dark:border-neutral-700 p-4 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
            <p className="text-neutral-700 dark:text-neutral-300">{confirmDialog.message}</p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmDialog(null)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">Hủy</button>
              <button type="button" onClick={() => confirmDialog.onConfirm()} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">Xác nhận</button>
            </div>
          </div>
        </div>
      )}

      {showDemoGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowDemoGallery(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">Chọn workflow mẫu</h2>
              <button type="button" onClick={() => setShowDemoGallery(false)} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="px-4 pb-3 text-sm text-neutral-500 dark:text-neutral-400">Chọn một mẫu theo lĩnh vực — workflow và dữ liệu sẽ được tải vào workspace.</p>
            <div className="flex-1 overflow-y-auto p-4 grid grid-cols-1 sm:grid-cols-2 gap-3">
              {getDemoWorkflowTemplates().map((tpl) => (
                <button
                  key={tpl.id}
                  type="button"
                  onClick={() => {
                    const { workflow, datasets: newDatasets } = tpl.getWorkflowAndData();
                    setWorkflows((prev) => [...prev, workflow]);
                    setDatasets((prev) => [...prev, ...newDatasets]);
                    setSelectedWorkflowId(workflow.id);
                    setSelectedDatasetId(newDatasets[0]?.id ?? null);
                    setSelectedWorkflowStepId(null);
                    setShowDemoGallery(false);
                  }}
                  className="text-left p-4 rounded-xl border-2 border-neutral-200 dark:border-neutral-600 hover:border-brand/50 hover:bg-brand/5 dark:hover:bg-brand/10 transition-colors"
                >
                  <span className="text-xs font-semibold text-brand uppercase tracking-wider">{tpl.domain}</span>
                  <p className="font-semibold text-neutral-800 dark:text-neutral-200 mt-1">{tpl.name}</p>
                  <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5 line-clamp-2">{tpl.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {showSampleModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowSampleModal(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full max-h-[80vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">Chọn dataset mẫu</h2>
              <button type="button" onClick={() => setShowSampleModal(false)} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="px-4 pb-2 text-sm text-neutral-500 dark:text-neutral-400">Thêm vào workflow hiện tại.</p>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {SAMPLE_DATASETS.map((def) => (
                <button
                  key={def.id}
                  type="button"
                  onClick={() => addSampleDatasetFromSidebar(def)}
                  className="w-full text-left p-3 rounded-lg border border-neutral-200 dark:border-neutral-600 hover:border-brand/50 hover:bg-brand/5 dark:hover:bg-brand/10 transition-colors"
                >
                  <p className="font-medium text-neutral-800 dark:text-neutral-200">{def.name}</p>
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{def.description}</p>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {archiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setArchiveModalOpen(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="font-semibold flex items-center gap-2"><Cloud className="w-5 h-5 text-sky-600" /> Archive NEU — Chọn dataset</h3>
              <button type="button" onClick={() => setArchiveModalOpen(false)} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {archiveSearchError && <pre className="text-red-600 dark:text-red-400 text-sm mb-3 whitespace-pre-wrap font-sans break-all">{archiveSearchError}</pre>}
              {archiveSearchLoading && <p className="text-neutral-500 text-sm">Đang tải danh sách...</p>}
              {!selectedArchiveRequestId ? (
                <ul className="space-y-2">
                  {archiveSearchResult.map((item) => {
                    const reqId = String(item.requestId ?? item.id ?? "");
                    return (
                      <li key={reqId}>
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedArchiveRequestId(reqId);
                            setSelectedArchiveTitle(String(item.title ??"Dataset"));
                            setArchiveFiles([]);
                            setArchiveFilesLoading(true);
                            archiveApi.getFilesByRequest(reqId).then((files) => {
                              setArchiveFiles(files);
                              setArchiveFilesLoading(false);
                            }).catch((e) => {
                              setArchiveFiles([]);
                              setArchiveFilesLoading(false);
                              setArchiveSearchError(e instanceof Error ? e.message : "Không tải được file");
                            });
                          }}
                          className="w-full text-left p-3 rounded-lg border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                        >
                          <span className="font-medium block">{item.title}</span>
                          {item.description && <span className="text-sm text-neutral-500 line-clamp-2">{item.description}</span>}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              ) : (
                <div>
                  <button type="button" onClick={() => { setSelectedArchiveRequestId(null); setArchiveFiles([]); setArchiveSearchError(null); }} className="text-sm text-sky-600 dark:text-sky-400 mb-2">Quay lại danh sách</button>
                  <p className="font-medium mb-2">Dataset: {selectedArchiveTitle}</p>
                  {archiveFilesLoading && <p className="text-sm text-neutral-500">Đang tải danh sách file...</p>}
                  <ul className="space-y-2">
                    {archiveFiles.map((f) => {
                      const loading = archiveDownloadingFileId === f.id;
                      return (
                        <li key={f.id} className="flex items-center justify-between p-2 rounded-lg border border-neutral-200 dark:border-neutral-700">
                          <span className="text-sm truncate flex-1">{f.file_name}</span>
                          <button
                            type="button"
                            disabled={loading}
                            onClick={async () => {
                              if (!selectedArchiveRequestId) return;
                              setArchiveDownloadingFileId(f.id);
                              setArchiveSearchError(null);
                              try {
                                const text = await archiveApi.fetchArchiveFileAsText(f.id, selectedArchiveRequestId);
                                const { rows, format } = parseFileContent(text, f.file_name || "data.csv");
                                if (rows.length < 2) { setArchiveSearchError("File không có đủ dòng dữ liệu."); return; }
                                const archiveSourceKey = `archive:${selectedArchiveRequestId}:${f.id}`;
                                if (datasets.some((d) => d.sourceKey === archiveSourceKey)) {
                                  setArchiveSearchError("Dataset này đã được thêm.");
                                  return;
                                }
                                const headers = rows[0];
                                const kept = rows.slice(1, MAX_ROWS_STORED + 1);
                                const id = generateId();
                                const now = new Date().toISOString();
                                const newDs: Dataset = { id, name: (selectedArchiveTitle || f.file_name || "data").replace(/\.(csv|tsv|json|txt)$/i, ""), rows: kept.length, columns: headers.length, columnNames: headers, preview: rows.slice(0, 6), data: [headers, ...kept], sourceFormat: format, sourceKey: archiveSourceKey, createdAt: now, updatedAt: now };
                                setDatasets((prev) => [...prev, newDs]);
                                setSelectedDatasetId(id);
                                if (selectedWorkflowId) {
                                  setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflowId ? w : { ...w, datasetIds: [...(w.datasetIds ?? []), id].filter((x, i, a) => a.indexOf(x) === i), updatedAt: now })));
                                }
                                setArchiveModalOpen(false);
                              } catch (e) {
                                setArchiveSearchError(e instanceof Error ? e.message : "Tải file thất bại.");
                              } finally {
                                setArchiveDownloadingFileId(null);
                              }
                            }}
                            className="rounded px-3 py-1.5 text-sm bg-brand text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {loading ? "Đang tải..." : "Tải vào Quantis"}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {!archiveFilesLoading && archiveFiles.length === 0 && selectedArchiveRequestId && <p className="text-sm text-neutral-500">Không có file nào.</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {guideOpen && (
        <GuideModal onClose={() => setGuideOpen(false)} />
      )}
      {showSettings && (
        <SettingsModal onClose={() => setShowSettings(false)} />
      )}
      {showAppFeedbackModal && (
        <AppFeedbackModal onClose={() => setShowAppFeedbackModal(false)} />
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
  onStepClick,
}: {
  steps: typeof WORKFLOW_STEPS;
  datasets: Dataset[];
  selectedDatasetId: string | null;
  onSelectDataset: (id: string | null) => void;
  onStepClick?: (stepId: string) => void;
}) {
  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Workflow nghiên cứu tiêu chuẩn</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">Bấm vào từng bước để chuyển sang tính năng tương ứng.</p>
      <div className="space-y-2">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick?.(step.id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 hover:border-brand/30 transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-full bg-brand/10 dark:bg-brand/20 flex items-center justify-center text-brand font-medium">{i + 1}</span>
              <StepIcon className="w-5 h-5 text-neutral-500 flex-shrink-0" />
              <span className="font-medium">{step.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function DescriptiveStatsView({
  selectedDataset,
  analysisBackendAvailable = false,
  descriptiveBackendResult = null,
}: {
  selectedDataset: Dataset | undefined;
  analysisBackendAvailable?: boolean;
  descriptiveBackendResult?: DescriptiveRow[] | null;
}) {
  const [freqCol, setFreqCol] = useState("");
  const [crosstabCol1, setCrosstabCol1] = useState("");
  const [crosstabCol2, setCrosstabCol2] = useState("");
  const [crosstabBackendResult, setCrosstabBackendResult] = useState<{ rowLabels: string[]; colLabels: string[]; counts: number[][] } | null>(null);
  const rows = selectedDataset ? getDataRows(selectedDataset) : [];
  const cols = selectedDataset?.columnNames ?? [];
  useEffect(() => {
    if (!analysisBackendAvailable || !crosstabCol1 || !crosstabCol2 || !selectedDataset) {
      setCrosstabBackendResult(null);
      return;
    }
    const r = getDataRows(selectedDataset);
    quantisApi.analyzeCrosstab(r, crosstabCol1, crosstabCol2).then(setCrosstabBackendResult);
  }, [analysisBackendAvailable, crosstabCol1, crosstabCol2, selectedDataset?.id]);
  const [textStatsCol, setTextStatsCol] = useState("");
  const [textStatsResult, setTextStatsResult] = useState<{ column: string; nRows: number; nEmpty: number; totalWords: number; uniqueWords: number; avgWordsPerRow: number; minWordsPerRow: number; maxWordsPerRow: number; wordFreq: { word: string; count: number }[] } | null>(null);
  const [outlierCol, setOutlierCol] = useState("");
  const [outlierResult, setOutlierResult] = useState<{ outlierCount: number; q1: number | null; q3: number | null; iqr: number | null; lower: number | null; upper: number | null } | null>(null);
  const [keywordCountsCol, setKeywordCountsCol] = useState("");
  const [keywordCountsInput, setKeywordCountsInput] = useState("");
  const [keywordCountsResult, setKeywordCountsResult] = useState<{ column: string; keywords: string[]; counts: { keyword: string; rowCount: number; totalOccurrences: number }[] } | null>(null);
  const [ngramCol, setNgramCol] = useState("");
  const [ngramN, setNgramN] = useState(2);
  const [ngramResult, setNgramResult] = useState<{ column: string; n: number; totalNgrams: number; uniqueNgrams: number; ngramFreq: { ngram: string; count: number }[] } | null>(null);
  const [kappaCol1, setKappaCol1] = useState("");
  const [kappaCol2, setKappaCol2] = useState("");
  const [kappaResult, setKappaResult] = useState<{ col1: string; col2: string; n: number; kappa: number; observedAgreement: number; expectedAgreement: number; table: Record<string, Record<string, number>> } | null>(null);
  const [bootstrapCICol, setBootstrapCICol] = useState("");
  const [bootstrapCIResult, setBootstrapCIResult] = useState<{ mean: number; ciLower: number; ciUpper: number; n: number } | null>(null);

  const stats = (analysisBackendAvailable ? descriptiveBackendResult : null) ??(rows.length >= 2 ? computeDescriptive(rows) : []);
  const numericColsDesc = stats.filter((s) => s.mean != null).map((s) => s.column);
  const categorical = stats.filter((s) => s.freq && s.freq.length > 0);
  const chartCol = categorical[0];
  const chartData = chartCol?.freq?.slice(0, 15).map((f) => ({ name: f.value, count: f.count })) || [];

  const copyDescriptiveTsv = useCallback(() => {
    if (stats.length === 0) return;
    const headers = ["Cột", "Kiểu", "N", "Missing", "Mean", "Median", "Std", "Q25", "Q75", "P10", "P90", "Min", "Max", "Kurtosis"];
    const na = "\u2014";
    const tsvRows = stats.map((s) => [
      s.column,
      s.type,
      String(s.n),
      String(s.missing),
      s.mean != null ? s.mean.toFixed(4) : na,
      s.median != null ? s.median.toFixed(4) : na,
      s.std != null ? s.std.toFixed(4) : na,
      s.q25 != null ? s.q25.toFixed(4) : na,
      s.q75 != null ? s.q75.toFixed(4) : na,
      s.q10 != null ? s.q10.toFixed(4) : na,
      s.q90 != null ? s.q90.toFixed(4) : na,
      s.min != null ? s.min.toFixed(4) : na,
      s.max != null ? s.max.toFixed(4) : na,
      s.kurtosis != null ? s.kurtosis.toFixed(4) : na,
    ]);
    const tsv = [headers.join("\t"), ...tsvRows.map((r) => r.join("\t"))].join("\n");
    void navigator.clipboard.writeText(tsv);
  }, [stats]);

  const aiContextDescriptive = stats.length > 0
    ? stats.map((s) => `Cột ${s.column}: N=${s.n}, missing=${s.missing}, mean=${s.mean != null ? s.mean.toFixed(2) : "—"}, median=${s.median != null ? s.median.toFixed(2) : "—"}, std=${s.std != null ? s.std.toFixed(2) : "—"}, min=${s.min != null ? s.min.toFixed(2) : "—"}, max=${s.max != null ? s.max.toFixed(2) : "—"}`).join("\n")
    : "";

  return (
    <div className="w-full max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-xl font-semibold">Thống kê mô tả</h2>
        <div className="flex items-center gap-2">
          {stats.length > 0 && (
            <button type="button" onClick={copyDescriptiveTsv} className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700"><Copy className="w-4 h-4" /> Sao chép bảng</button>
          )}
          {aiContextDescriptive ? (
            <AIAssistPanel
              context={aiContextDescriptive}
              quickPrompts={[{ label: "Giải thích thống kê mô tả", systemHint: "Bạn là chuyên gia thống kê mô tả. Giải thích ý nghĩa từng chỉ số: N (cỡ mẫu), mean (trung bình), median (trung vị), std (độ lệch chuẩn), các phân vị. Nêu cách đọc và ý nghĩa trong nghiên cứu. Trả lời ngắn gọn bằng tiếng Việt." }]}
              title="Hỏi AI về thống kê mô tả"
            />
          ) : null}
        </div>
      </div>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">Descriptive statistics, phân bố, bảng tần suất, crosstab, thống kê văn bản, điểm ngoại lai (IQR).</p>
      {analysisBackendAvailable && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5" /> Phân tích bằng backend Python (scipy/statsmodels)
        </p>
      )}
      {!selectedDataset ? (
        <p className="text-neutral-500">Chọn một bộ dữ liệu ở panel trái.</p>
      ) : stats.length > 0 ? (
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
                  <th className="text-right p-2">P10</th>
                  <th className="text-right p-2">P90</th>
                  <th className="text-right p-2">Min</th>
                  <th className="text-right p-2">Max</th>
                  <th className="text-right p-2">Kurtosis</th>
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
                    <td className="p-2 text-right">{s.q10 != null ? s.q10.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.q90 != null ? s.q90.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.min != null ? s.min.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.max != null ? s.max.toFixed(2) : "—"}</td>
                    <td className="p-2 text-right">{s.kurtosis != null ? s.kurtosis.toFixed(2) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-4 mb-4">
            <p className="text-sm font-medium mb-2">Khoảng tin cậy 95% cho trung bình (Bootstrap)</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">Lấy mẫu có hoàn lại 2000 lần để ước lượng CI. Tương đương JASP/Jamovi.</p>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-medium mb-1">Cột số</label>
                <select value={bootstrapCICol} onChange={(e) => { setBootstrapCICol(e.target.value); setBootstrapCIResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm">
                  <option value="">— Chọn —</option>
                  {numericColsDesc.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => { if (!bootstrapCICol || rows.length < 2) return; const ci = rows[0].indexOf(bootstrapCICol); if (ci === -1) return; const vals = rows.slice(1).map((r) => Number(r[ci])).filter((v) => !Number.isNaN(v)); const res = computeBootstrapMeanCI(vals); setBootstrapCIResult(res ?? null); }} disabled={!bootstrapCICol} className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm disabled:opacity-50">Tính CI 95%</button>
            </div>
            {bootstrapCIResult && (
              <div className="mt-2">
                <AIAssistPanel
                  context={`Khoảng tin cậy bootstrap 95%: trung bình = ${bootstrapCIResult.mean.toFixed(4)}, CI = [${bootstrapCIResult.ciLower.toFixed(4)}, ${bootstrapCIResult.ciUpper.toFixed(4)}], n = ${bootstrapCIResult.n}.`}
                  quickPrompts={[{ label: "Diễn giải khoảng tin cậy 95%", systemHint: "Bạn là chuyên gia thống kê. Giải thích ý nghĩa khoảng tin cậy 95% (bootstrap): trung bình nằm trong khoảng [ciLower, ciUpper] với độ tin cậy 95%. Nêu cách đọc và dùng trong báo cáo. Trả lời ngắn gọn bằng tiếng Việt." }]}
                  title="Hỏi AI về khoảng tin cậy bootstrap"
                />
                  <p className="text-sm mt-2">Trung bình = {bootstrapCIResult.mean.toFixed(4)}, 95% CI [{bootstrapCIResult.ciLower.toFixed(4)}, {bootstrapCIResult.ciUpper.toFixed(4)}], n = {bootstrapCIResult.n}</p>
              </div>
            )}
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
                  <Bar dataKey="count" fill="#0061bb" name="Số lượng" />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-6 space-y-4">
            <div>
              <h3 className="font-medium mb-2">Bảng tần suất (1 biến)</h3>
              <select value={freqCol} onChange={(e) => setFreqCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm mb-2">
                <option value="">— Chọn cột —</option>
                {stats.filter((s) => s.freq && s.freq.length > 0).map((s) => <option key={s.column} value={s.column}>{s.column}</option>)}
              </select>
              {freqCol && (() => {
                const s = stats.find((x) => x.column === freqCol);
                if (!s?.freq?.length) return null;
                const total = s.freq.reduce((a, f) => a + f.count, 0);
                return (
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-neutral-200 dark:border-neutral-700"><th className="text-left p-2">Giá trị</th><th className="text-right p-2">Tần số</th><th className="text-right p-2">%</th></tr></thead>
                      <tbody>
                        {s.freq.map((f) => (
                          <tr key={f.value} className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-2">{f.value}</td>
                            <td className="p-2 text-right">{f.count}</td>
                            <td className="p-2 text-right">{total ? (100 * f.count / total).toFixed(1) : "0"}%</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
            <div>
              <h3 className="font-medium mb-2">Bảng chéo (Crosstab)</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">Hàng</label>
                  <select value={crosstabCol1} onChange={(e) => setCrosstabCol1(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">— Chọn —</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Cột</label>
                  <select value={crosstabCol2} onChange={(e) => setCrosstabCol2(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">— Chọn —</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              {crosstabCol1 && crosstabCol2 && (() => {
                const ct = (analysisBackendAvailable ? crosstabBackendResult : null) ?? getCrosstab(rows, crosstabCol1, crosstabCol2);
                if (!ct) return null;
                const crosstabCtx = `Bảng chéo: hàng ${crosstabCol1}, cột ${crosstabCol2}. Hàng: ${ct.rowLabels.join(", ")}. Cột: ${ct.colLabels.join(", ")}. Số ô: ${ct.rowLabels.length * ct.colLabels.length}. Tổng quan: ${ct.rowLabels.slice(0, 3).map((r, i) => `${r}: ${ct.counts[i]?.join(", ")}`).join("; ")}.`;
                return (
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto">
                    <AIAssistPanel
                      context={crosstabCtx}
                      quickPrompts={[{ label: "Diễn giải bảng chéo", systemHint: "Bạn là chuyên gia thống kê. Giải thích ý nghĩa bảng chéo (crosstab): tần số chéo của hai biến phân loại, mối liên hệ giữa hai biến. Gợi ý khi nào dùng kiểm định Chi-square. Trả lời ngắn gọn bằng tiếng Việt." }]}
                      title="Hỏi AI về bảng chéo"
                    />
                    <table className="w-full text-sm">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="text-left p-2 font-medium"></th>
                          {ct.colLabels.map((c) => <th key={c} className="p-2 text-right font-medium">{c}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {ct.rowLabels.map((r, i) => (
                          <tr key={r} className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-2 font-medium">{r}</td>
                            {ct.counts[i].map((v, j) => <td key={j} className="p-2 text-right">{v}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                );
              })()}
            </div>
            <div>
              <h3 className="font-medium mb-2">Thống kê văn bản (định tính)</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">Cột văn bản</label>
                  <select value={textStatsCol} onChange={(e) => { setTextStatsCol(e.target.value); setTextStatsResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">— Chọn —</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button type="button" onClick={async () => { if (!textStatsCol) return; if (analysisBackendAvailable) { const res = await quantisApi.analyzeTextStats(rows, textStatsCol); setTextStatsResult(res ?? null); return; } const res = computeTextStats(rows, textStatsCol); setTextStatsResult(res ?? null); }} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Phân tích</button>
              </div>
              {textStatsResult && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm space-y-2">
                  <AIAssistPanel
                    context={`Thống kê văn bản cột "${textStatsResult.column}": ${textStatsResult.totalWords} từ, ${textStatsResult.uniqueWords} từ khác nhau, TB ${textStatsResult.avgWordsPerRow.toFixed(1)} từ/dòng. Dòng: ${textStatsResult.nRows}, trống: ${textStatsResult.nEmpty}. Top từ: ${textStatsResult.wordFreq.slice(0, 10).map((w) => `${w.word}(${w.count})`).join(", ")}.`}
                    quickPrompts={[{ label: "Diễn giải thống kê văn bản", systemHint: "Bạn là chuyên gia phân tích định tính. Giải thích ý nghĩa: tổng số từ, số từ khác nhau, tần số từ — dùng trong nghiên cứu định tính/ngôn ngữ như thế nào. Trả lời ngắn gọn bằng tiếng Việt." }]}
                    title="Hỏi AI về thống kê văn bản"
                  />
                  <p><strong>Từng số từ:</strong> {textStatsResult.totalWords} | <strong>Từ khác nhau:</strong> {textStatsResult.uniqueWords} | <strong>TB từ/dòng:</strong> {textStatsResult.avgWordsPerRow.toFixed(1)} (min–max: {textStatsResult.minWordsPerRow}?{textStatsResult.maxWordsPerRow})</p>
                  <p><strong>Dòng:</strong> {textStatsResult.nRows} | <strong>Dòng trống:</strong> {textStatsResult.nEmpty}</p>
                  <p className="font-medium mt-2">Tần số từ (top 30):</p>
                  <table className="w-full text-xs"><thead><tr className="border-b border-neutral-200 dark:border-neutral-600"><th className="text-left p-1">Từ</th><th className="text-right p-1">Số lần</th></tr></thead><tbody>
                    {textStatsResult.wordFreq.slice(0, 30).map(({ word, count }) => (
                      <tr key={word} className="border-b border-neutral-100 dark:border-neutral-700/50"><td className="p-1">{word}</td><td className="p-1 text-right">{count}</td></tr>
                    ))}</tbody></table>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">Đếm từ khóa (mỗi)</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">Cột văn bản</label>
                  <select value={keywordCountsCol} onChange={(e) => { setKeywordCountsCol(e.target.value); setKeywordCountsResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">— Chọn —</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm mb-1">Từ khóa (mỗi dòng hoặc cách nhau dấu phẩy)</label>
                  <textarea value={keywordCountsInput} onChange={(e) => { setKeywordCountsInput(e.target.value); setKeywordCountsResult(null); }} placeholder="ví dụ: tích cực, tiêu cực, trung tính" className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm min-h-[80px]" rows={3} />
                </div>
                <button type="button" onClick={async () => { if (!keywordCountsCol || !keywordCountsInput.trim()) return; const raw = keywordCountsInput.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean); if (!raw.length) return; if (analysisBackendAvailable) { const res = await quantisApi.analyzeKeywordCounts(rows, keywordCountsCol, raw); setKeywordCountsResult(res ?? null); return; } const res = computeKeywordCounts(rows, keywordCountsCol, raw); setKeywordCountsResult(res ?? null); }} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Đếm</button>
              </div>
              {keywordCountsResult && keywordCountsResult.counts.length > 0 && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm">
                  <AIAssistPanel
                    context={`Đếm từ khóa cột "${keywordCountsResult.column}": ${keywordCountsResult.counts.map((c) => `${c.keyword}: ${c.rowCount} dòng, ${c.totalOccurrences} lần`).join("; ")}.`}
                    quickPrompts={[{ label: "Diễn giải Đếm từ khóa", systemHint: "Bạn là chuyên gia phân tích định tính. Giải thích ý nghĩa đếm từ khóa: số dòng chứa từ khóa, tổng lần xuất hiện — dùng để đo mức độ xuất hiện chủ đề trong dữ liệu văn bản. Trả lời ngắn gọn bằng tiếng Việt." }]}
                    title="Hỏi AI về đếm từ khóa"
                  />
                  <p className="font-medium mb-2">Cột: {keywordCountsResult.column}</p>
                  <table className="w-full text-xs"><thead><tr className="border-b border-neutral-200 dark:border-neutral-600"><th className="text-left p-1">Từ khóa</th><th className="text-right p-1">Số dòng chứa</th><th className="text-right p-1">Tổng lần xuất hiện</th></tr></thead><tbody>
                    {keywordCountsResult.counts.map(({ keyword, rowCount, totalOccurrences }) => (
                      <tr key={keyword} className="border-b border-neutral-100 dark:border-neutral-700/50"><td className="p-1">{keyword}</td><td className="p-1 text-right">{rowCount}</td><td className="p-1 text-right">{totalOccurrences}</td></tr>
                    ))}</tbody></table>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">Tần số cụm từ (n-gram)</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">Cột văn bản</label>
                  <select value={ngramCol} onChange={(e) => { setNgramCol(e.target.value); setNgramResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">— Chọn —</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">n (gram)</label>
                  <select value={ngramN} onChange={(e) => { setNgramN(Number(e.target.value)); setNgramResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value={2}>2 (bigram)</option>
                    <option value={3}>3 (trigram)</option>
                  </select>
                </div>
                <button type="button" onClick={async () => { if (!ngramCol) return; if (analysisBackendAvailable) { const res = await quantisApi.analyzeNgramFreq(rows, ngramCol, ngramN, 50); setNgramResult(res ?? null); return; } setNgramResult(computeNgramFreq(rows, ngramCol, ngramN, 50) ?? null); }} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Phân tích</button>
              </div>
              {ngramResult && ngramResult.ngramFreq.length > 0 && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm">
                  <AIAssistPanel
                    context={`N-gram (n=${ngramResult.n}) cột "${ngramResult.column}": tổng ${ngramResult.totalNgrams} cụm, ${ngramResult.uniqueNgrams} khác nhau. Top: ${ngramResult.ngramFreq.slice(0, 8).map((x) => `${x.ngram}(${x.count})`).join(", ")}.`}
                    quickPrompts={[{ label: "Diễn giải n-gram", systemHint: "Bạn là chuyên gia phân tích văn bản. Giải thích ý nghĩa n-gram (bigram/trigram): tần số cụm từ phản ánh cụm từ hay đi cùng nhau trong dữ liệu, dùng trong nghiên cứu định tính. Trả lời ngắn gọn bằng tiếng Việt." }]}
                    title="Hỏi AI về n-gram"
                  />
                  <p className="font-medium mb-2">Cột: {ngramResult.column} · n = {ngramResult.n} ? Tổng cụm: {ngramResult.totalNgrams} ? Khác nhau: {ngramResult.uniqueNgrams}</p>
                  <table className="w-full text-xs"><thead><tr className="border-b border-neutral-200 dark:border-neutral-600"><th className="text-left p-1">Cụm từ</th><th className="text-right p-1">Số lần</th></tr></thead><tbody>
                    {ngramResult.ngramFreq.slice(0, 30).map(({ ngram, count }) => (
                      <tr key={ngram} className="border-b border-neutral-100 dark:border-neutral-700/50"><td className="p-1">{ngram}</td><td className="p-1 text-right">{count}</td></tr>
                    ))}</tbody></table>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">Cohen&apos;s Kappa</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">Cột coder 1</label>
                  <select value={kappaCol1} onChange={(e) => { setKappaCol1(e.target.value); setKappaResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">— Chọn —</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">Cột coder 2</label>
                  <select value={kappaCol2} onChange={(e) => { setKappaCol2(e.target.value); setKappaResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">— Chọn —</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button type="button" onClick={async () => { if (!kappaCol1 || !kappaCol2) return; if (analysisBackendAvailable) { const res = await quantisApi.analyzeCohensKappa(rows, kappaCol1, kappaCol2); setKappaResult(res ?? null); return; } setKappaResult(computeCohensKappa(rows, kappaCol1, kappaCol2) ?? null); }} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Tính Kappa</button>
              </div>
              {kappaResult && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm space-y-2">
                  <AIAssistPanel
                    context={`Cohen's Kappa: ${kappaResult.col1} và ${kappaResult.col2}, κ = ${kappaResult.kappa.toFixed(4)}, n = ${kappaResult.n}.`}
                    quickPrompts={[{ label: "Diễn giải Kappa", systemHint: "Bạn là chuyên gia thống kê. Giải thích Cohen's Kappa: đo độ đồng nhất/đồng thuận giữa hai người mã hóa (coder). Nêu thang diễn giải (ví dụ <0 kém, 0.21–0.40 khá, 0.61–0.80 tốt, >0.81 rất tốt). Trả lời ngắn gọn bằng tiếng Việt." }]}
                    title="Hỏi AI về Kappa"
                  />
                  <p><strong>κ = {kappaResult.kappa}</strong> – đồng nhất quan sát: {kappaResult.observedAgreement}; Kỳ vọng ngẫu nhiên: {kappaResult.expectedAgreement} · n = {kappaResult.n}</p>
                  <p className="text-neutral-600 dark:text-neutral-400 text-xs">Giải thích: &lt;0 không đồng nhất, 0.01–0.20 nhỏ, 0.21–0.40 khá, 0.41–0.60 trung bình, 0.61–0.80 tốt, 0.81–1.00 rất tốt.</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">điểm ngoại lai (IQR)</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">Cột số</label>
                  <select value={outlierCol} onChange={(e) => { setOutlierCol(e.target.value); setOutlierResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">— Chọn —</option>
                    {stats.filter((s) => s.type === "numeric").map((s) => (
                      <option key={s.column} value={s.column}>{s.column}</option>
                    ))}
                  </select>
                </div>
                <button type="button" onClick={async () => { if (!outlierCol) return; const ci = cols.indexOf(outlierCol); if (ci === -1) return; const values = rows.slice(1).map((r) => Number(r[ci])).filter((v) => !Number.isNaN(v)); if (analysisBackendAvailable) { const res = await quantisApi.analyzeOutlierIqr(values); setOutlierResult(res ?? null); return; } setOutlierResult(computeOutlierIqr(values)); }} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Kiểm tra</button>
              </div>
              {outlierResult && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm">
                  <AIAssistPanel
                    context={`điểm ngoại lai IQR: cột số, số điểm = ${outlierResult.outlierCount}. Q1 = ${outlierResult.q1 ?? "?"}, Q3 = ${outlierResult.q3 ?? "?"}, IQR = ${outlierResult.iqr ?? "?"}, ngưỡng [${outlierResult.lower ?? "?"}, ${outlierResult.upper ?? "?"}].`}
                    quickPrompts={[{ label: "Diễn giải điểm ngoại lai", systemHint: "Bạn là chuyên gia thống kê. Giải thích điểm ngoại lai theo phương pháp IQR (1.5×IQR): ý nghĩa số điểm, Q1/Q3/ngưỡng. Gợi ý khi nào nên loại bỏ hay giữ lại (kiểm tra lỗi đo, ảnh hưởng phân tích). Trả lời ngắn gọn bằng tiếng Việt." }]}
                    title="Hỏi AI về điểm ngoại lai"
                  />
                  <p><strong>Số điểm ngoại lai:</strong> {outlierResult.outlierCount}</p>
                  {outlierResult.q1 != null && outlierResult.q3 != null && outlierResult.iqr != null && (
                    <p className="mt-1 text-neutral-600 dark:text-neutral-400">Q1 = {outlierResult.q1.toFixed(2)}, Q3 = {outlierResult.q3.toFixed(2)}, IQR = {outlierResult.iqr.toFixed(2)}. Ngưỡng: [{outlierResult.lower != null ? outlierResult.lower.toFixed(2) : "—"}, {outlierResult.upper != null ? outlierResult.upper.toFixed(2) : "—"}].</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-neutral-500">Dataset không có đủ dữ liệu.</p>
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
  showToast,
  onWorkflowDatasetAdd,
  analysisBackendAvailable = false,
  descriptiveBackendResult = null,
}: {
  tab: DataTab;
  datasets: Dataset[];
  setDatasets: React.Dispatch<React.SetStateAction<Dataset[]>>;
  selectedDatasetId: string | null;
  onSelectDataset: (id: string | null) => void;
  showToast?: (msg: string) => void;
  /** Gọi khi thêm dataset mới trong ngữ cảnh workflow (để gắn vào workflow). */
  onWorkflowDatasetAdd?: (datasetId: string) => void;
  analysisBackendAvailable?: boolean;
  descriptiveBackendResult?: DescriptiveRow[] | null;
}) {
  const selectedDs = selectedDatasetId ? datasets.find((d) => d.id === selectedDatasetId) ?? null : null;

  if (tab === "descriptive") {
    return <DescriptiveStatsView selectedDataset={selectedDs ?? undefined} analysisBackendAvailable={analysisBackendAvailable} descriptiveBackendResult={descriptiveBackendResult} />;
  }
  if (tab === "import") {
    // Tab import: hiển thị giống "Xem dữ liệu" để luôn có nội dung
    if (!selectedDs) return <div className="w-full max-w-full"><h2 className="text-xl font-semibold mb-2">Khám phá dữ liệu</h2><p className="text-neutral-500">Chọn một bộ dữ liệu ở panel trái (hoặc dùng Tải file / Thêm dataset mẫu) để xem và phân tích.</p><p className="text-sm text-neutral-500 mt-2">Dùng tab <strong>AI hướng dẫn</strong> để hỏi gợi ý bước tiếp theo hoặc phương pháp phù hợp.</p></div>;
    return <PreviewTable selectedDs={selectedDs} />;
  }
  if (tab === "profiling") {
    let rows: string[][] = [];
    try {
      rows = getDataRows(selectedDs ?? undefined);
    } catch {
      rows = [];
    }
    const profiles = Array.isArray(rows) && rows.length >= 2 ? computeProfileWithOutliers(rows) : [];
    const aiContextProfiling = profiles.length > 0
      ? profiles.map((p) => `Cột ${p?.column}: kiểu ${p?.type}, missing ${p?.missing} (${typeof p?.missingPct === "number" ? p.missingPct.toFixed(1) : "—"}%), unique ${p?.unique}, mean ${p?.mean != null ? Number(p.mean).toFixed(2) : "—"}, std ${p?.std != null ? Number(p.std).toFixed(2) : "—"}, skew ${p?.skew != null ? Number(p.skew).toFixed(3) : "—"}, outlier ${p?.outlierCount ??"?"}`).join("\n")
      : "";
    return (
      <div className="w-full max-w-full">
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
          <h2 className="text-xl font-semibold">Phân tích sơ bộ dữ liệu</h2>
          {aiContextProfiling ? (
            <AIAssistPanel
              context={aiContextProfiling}
              quickPrompts={[{ label: "Giải thích phân tích sơ bộ", systemHint: "Bạn là chuyên gia thống kê. Giải thích ý nghĩa bảng phân tích sơ bộ: missing (thiếu), kiểu cột, mean/std/min/max, skewness, số điểm ngoại lai — dùng để nắm nhanh chất lượng và phân bố từng biến trước khi phân tích sâu. Trả lời ngắn gọn bằng tiếng Việt." }]}
              title="Hỏi AI về phân tích sơ bộ"
            />
          ) : null}
        </div>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">Missing, kiểu cột, thống kê cơ bản, skewness, outlier (IQR 1.5). <span className="text-neutral-500 dark:text-neutral-500" title="Các chỉ số Min, Max, Mean, Std, Skew, Outlier không áp dụng cho biến phân loại (categorical).">— = không áp dụng (biến phân loại).</span></p>
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
                  <th className="text-right p-2">Skew</th>
                  <th className="text-right p-2">Outlier</th>
                </tr>
              </thead>
              <tbody>
                {profiles.map((p, idx) => (
                  <tr key={p?.column != null ? String(p.column) || `col-${idx}` : `col-${idx}`} className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="p-2 font-medium">{p?.column ?? "—"}</td>
                    <td className="p-2">{p?.type ?? "—"}</td>
                    <td className="p-2 text-right">{p?.missing ?? "—"}</td>
                    <td className="p-2 text-right">{typeof p?.missingPct === "number" ? p.missingPct.toFixed(1) : "—"}%</td>
                    <td className="p-2 text-right">{p?.unique ?? "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? "Không áp dụng cho biến phân loại" : undefined}>{p?.min != null ? Number(p.min).toFixed(2) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? "Không áp dụng cho biến phân loại" : undefined}>{p?.max != null ? Number(p.max).toFixed(2) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? "Không áp dụng cho biến phân loại" : undefined}>{p?.mean != null ? Number(p.mean).toFixed(2) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? "Không áp dụng cho biến phân loại" : undefined}>{p?.std != null ? Number(p.std).toFixed(2) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? "Không áp dụng cho biến phân loại" : undefined}>{p?.skew != null ? Number(p.skew).toFixed(3) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? "Không áp dụng cho biến phân loại" : undefined}>{p?.outlierCount != null ? p.outlierCount : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : selectedDs ? (
          <p className="text-neutral-500">Dataset không có đủ dữ liệu. Tải file hoặc dùng nút <strong>Thêm dataset mẫu</strong> để thêm.</p>
        ) : (
          <>
            <p className="text-neutral-500">Chọn dataset ở mục Import hoặc Workflow. Bấm <strong>Thêm dataset mẫu</strong> (tab Dữ liệu) để tải sẵn và thử phân tích.</p>
            <p className="text-sm text-neutral-500 mt-2">Dùng tab <strong>AI hướng dẫn</strong> (trên thanh tab) để hỏi gợi ý bước tiếp theo hoặc phương pháp phù hợp.</p>
          </>
        )}
      </div>
    );
  }
  if (tab === "transform") {
    return <TransformTab selectedDs={selectedDs} setDatasets={setDatasets} onSelectDataset={onSelectDataset} onWorkflowDatasetAdd={onWorkflowDatasetAdd} />;
  }
  if (tab === "preview") {
    if (!selectedDs) return <div className="w-full max-w-full"><h2 className="text-xl font-semibold mb-2">Xem dữ liệu</h2><p className="text-neutral-500">Chọn dataset ở mục Import.</p><p className="text-sm text-neutral-500 mt-2">Dùng tab <strong>AI hướng dẫn</strong> để hỏi gợi ý import hoặc bước tiếp theo.</p></div>;
    return <PreviewTable selectedDs={selectedDs} />;
  }
  return null;
}

const PREVIEW_PAGE_SIZE_DEFAULT = 100;
const PREVIEW_PAGE_SIZES = [20, 50, 100, 200] as const;

function PreviewTable({ selectedDs }: { selectedDs: Dataset }) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(PREVIEW_PAGE_SIZE_DEFAULT);
  const [sortColIndex, setSortColIndex] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");

  const rows = getDataRows(selectedDs);
  const headers = rows[0] || [];
  const dataRows = rows.slice(1);

  const sortedRows =
    sortColIndex == null
      ? dataRows
      : [...dataRows].sort((a, b) => {
          const av = a[sortColIndex] ??"";
          const bv = b[sortColIndex] ??"";
          const isNum =
            dataRows.length > 0 &&
            dataRows.every((r) => {
              const v = r[sortColIndex];
              return v === "" || !Number.isNaN(Number(v));
            });
          let cmp = 0;
          if (isNum) {
            const an = Number(av);
            const bn = Number(bv);
            cmp =
              (Number.isNaN(an) ? -Infinity : an) -
              (Number.isNaN(bn) ? -Infinity : bn);
          } else {
            cmp = String(av).localeCompare(String(bv));
          }
          return sortDir === "asc" ? cmp : -cmp;
        });

  const totalPages = Math.max(1, Math.ceil(sortedRows.length / pageSize));
  const start = (page - 1) * pageSize;
  const slice = sortedRows.slice(start, start + pageSize);

  const handleSort = (colIndex: number) => {
    if (sortColIndex === colIndex) setSortDir((d) => (d === "asc" ? "desc" : "asc"));
    else {
      setSortColIndex(colIndex);
      setSortDir("asc");
    }
    setPage(1);
  };

  const aiContext = useMemo(() => {
    if (!selectedDs) return "";
    const colNames = headers.length > 0 ? headers : (selectedDs.columnNames || []);
    if (colNames.length === 0 && dataRows.length === 0) return "";
    const sample = dataRows.slice(0, 5).map((r) => colNames.map((h, i) => `${h}: ${r[i] ?? ""}`).join(" | ")).join("\n");
    return `Bộ dữ liệu: ${selectedDs.name}. Số hàng: ${dataRows.length}, số cột: ${colNames.length}. Tên cột: ${colNames.join(", ")}.\nMẫu 5 hàng đầu:\n${sample}`;
  }, [selectedDs, headers, dataRows]);

  return (
    <div className="w-full max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-xl font-semibold">Xem dữ liệu</h2>
        {aiContext ? (
          <AIAssistPanel
            context={aiContext}
            quickPrompts={[{ label: "Giải thích dữ liệu", systemHint: "Bạn là chuyên gia phân tích dữ liệu. Tóm tắt bộ dữ liệu: tên, số hàng/số cột, tên các biến, và mẫu vài hàng đầu. Nêu ý nghĩa tổng quan để người dùng nắm nhanh nội dung dataset. Trả lời ngắn gọn bằng tiếng Việt." }]}
            title="Hỏi AI về bộ dữ liệu"
          />
        ) : null}
      </div>
      <p className="text-neutral-600 dark:text-neutral-400 mb-2">
        {dataRows.length} hàng × {headers.length} cột.
      </p>

      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto max-h-[28rem] overflow-y-auto">
        <table className="w-full text-sm">
          <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800 z-10">
            <tr className="border-b border-neutral-200 dark:border-neutral-700">
              {headers.map((h, ci) => (
                <th key={ci} className="text-left p-2">
                  <button
                    type="button"
                    onClick={() => handleSort(ci)}
                    className="w-full text-left font-medium whitespace-nowrap hover:bg-neutral-200 dark:hover:bg-neutral-700 rounded px-2 py-1.5 flex items-center gap-1 -mx-2 -my-1.5"
                    title="Bấm để sắp xếp"
                  >
                    {h}
                    {sortColIndex === ci && (
                      <span className="text-brand" aria-label={sortDir === "asc" ? "Tăng dần" : "Giảm dần"}>{sortDir === "asc" ? " ↑" : " ↓"}</span>
                    )}
                  </button>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {slice.map((r, ri) => (
              <tr key={start + ri} className="border-b border-neutral-100 dark:border-neutral-700/50">
                {headers.map((_, ci) => (
                  <td key={ci} className="p-2 whitespace-nowrap">{r[ci] ?? ""}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="flex items-center justify-between gap-4 px-2 py-2 border border-t-0 border-neutral-200 dark:border-neutral-700 rounded-b-lg bg-neutral-50 dark:bg-neutral-800/80 text-sm">
        <span className="text-neutral-600 dark:text-neutral-400">
          Hiển thị {sortedRows.length === 0 ? "0" : start + 1}–{Math.min(start + pageSize, sortedRows.length)} / {sortedRows.length} bản ghi
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
            Số dòng/trang:
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1 text-sm">
              {PREVIEW_PAGE_SIZES.map((n) => <option key={n} value={n}>{n} dòng</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50">‹ Trước</button>
          <span className="min-w-[5rem] text-center tabular-nums">Trang {page} / {totalPages}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50">Sau ›</button>
        </div>
        </div>
      </div>
    </div>
  );
}

function TransformTab({ selectedDs, setDatasets, onSelectDataset, onWorkflowDatasetAdd }: { selectedDs: Dataset | null; setDatasets: Dispatch<SetStateAction<Dataset[]>>; onSelectDataset: (id: string | null) => void; onWorkflowDatasetAdd?: (id: string) => void }) {
  const [transformCol, setTransformCol] = useState("");
  const [transformColsMultiple, setTransformColsMultiple] = useState<string[]>([]);
  const [transformAction, setTransformAction] = useState<"drop_missing" | "fill_mean" | "fill_median" | "fill_mode" | "z_score" | "min_max" | "filter" | "sort" | "recode">("drop_missing");
  const [filterCol, setFilterCol] = useState("");
  const [filterOp, setFilterOp] = useState<"==" | "!=" | ">" | "<" | ">=" | "<=" | "contains">("==");
  const [filterValue, setFilterValue] = useState("");
  const [sortCol, setSortCol] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [recodeCol, setRecodeCol] = useState("");
  const [recodeRules, setRecodeRules] = useState<{ from: string; to: string }[]>([{ from: "", to: "" }]);
  const [showTransformChoiceModal, setShowTransformChoiceModal] = useState(false);
  const [lastTransformResult, setLastTransformResult] = useState<{ before: string[][]; after: string[][]; actionLabel: string } | null>(null);
  if (!selectedDs) return <div className="w-full max-w-full"><h2 className="text-xl font-semibold mb-2">Biến đổi</h2><p className="text-neutral-500">Chọn dataset ở mục Import.</p><p className="text-sm text-neutral-500 mt-2">Dùng tab <strong>AI hướng dẫn</strong> để hỏi gợi ý làm sạch dữ liệu hoặc bước tiếp theo.</p></div>;
  const dataRows = getDataRows(selectedDs);
  const cols = selectedDs.columnNames || [];
  const header = dataRows[0] || [];
  const aiContextTransform = `Bộ dữ liệu: ${selectedDs.name}. Số hàng: ${dataRows.length}, số cột: ${cols.length}. Các cột: ${cols.join(", ")}. Công cụ hỗ trợ: bỏ missing, điền mean/median/mode, chuẩn hóa z-score/min-max, lọc, sắp xếp, recode.`;

  const applyTransform = (overwriteOriginal: boolean) => {
    setShowTransformChoiceModal(false);
    if (dataRows.length < 2) return;
    let newRows: string[][];
    if (transformAction === "filter") {
      if (!filterCol || header.indexOf(filterCol) === -1) return;
      const ci = header.indexOf(filterCol);
      const val = filterValue.trim();
      const op = filterOp;
      newRows = [header, ...dataRows.slice(1).filter((r) => {
        const cell = (r[ci] ?? "").toString().trim();
        const num = Number(cell);
        const vNum = Number(val);
        if (op === "==") return cell === val;
        if (op === "!=") return cell !== val;
        if (op === "contains") return cell.toLowerCase().includes(val.toLowerCase());
        if (!Number.isNaN(num) && !Number.isNaN(vNum)) {
          if (op === ">") return num > vNum;
          if (op === "<") return num < vNum;
          if (op === ">=") return num >= vNum;
          if (op === "<=") return num <= vNum;
        }
        return false;
      })];
    } else if (transformAction === "sort") {
      if (!sortCol || header.indexOf(sortCol) === -1) return;
      const ci = header.indexOf(sortCol);
      const isNum = dataRows.slice(1).every((r) => { const v = r[ci]; return v === "" || !Number.isNaN(Number(v)); });
      const sorted = [...dataRows.slice(1)].sort((a, b) => {
        const av = a[ci] ??"";
        const bv = b[ci] ??"";
        let cmp = 0;
        if (isNum) {
          const an = Number(av);
          const bn = Number(bv);
          cmp = (Number.isNaN(an) ? -Infinity : an) - (Number.isNaN(bn) ? -Infinity : bn);
        } else cmp = String(av).localeCompare(String(bv));
        return sortOrder === "asc" ? cmp : -cmp;
      });
      newRows = [header, ...sorted];
    } else if (transformAction === "recode") {
      if (!recodeCol || header.indexOf(recodeCol) === -1) return;
      const ci = header.indexOf(recodeCol);
      const map = Object.fromEntries(recodeRules.filter((r) => r.from.trim() !== "").map((r) => [r.from.trim(), r.to.trim()]));
      newRows = [header, ...dataRows.slice(1).map((r) => {
        const out = [...r];
        const v = (r[ci] ?? "").toString().trim();
        out[ci] = map[v] !== undefined ? map[v] : v;
        return out;
      })];
    } else {
      const columnsToApply = transformColsMultiple.length > 0 ? transformColsMultiple : (transformCol ? [transformCol] : []);
      if (columnsToApply.length === 0 || columnsToApply.some((c) => header.indexOf(c) === -1)) return;
      if (transformAction === "drop_missing") {
        const indices = columnsToApply.map((c) => header.indexOf(c));
        newRows = [header, ...dataRows.slice(1).filter((r) => indices.every((ci) => (r[ci] ?? "").toString().trim() !== ""))];
      } else if (transformAction === "z_score" || transformAction === "min_max") {
        const desc = computeDescriptive(dataRows);
        const numericRows = dataRows.slice(1).map((r) => r.map((v) => (v ??"").trim()));
        newRows = [header, ...numericRows.map((r) => {
          const out = [...r];
          for (const col of columnsToApply) {
            const ci = header.indexOf(col);
            const rowDesc = desc.find((d) => d.column === col);
            if (transformAction === "z_score") {
              const mean = rowDesc?.mean ?? 0;
              const std = rowDesc?.std ?? 1;
              if (std === 0) continue;
              const v = r[ci];
              const num = Number(v);
              if (v !== "" && !Number.isNaN(num)) out[ci] = ((num - mean) / std).toFixed(4);
            } else {
              const min = rowDesc?.min ?? 0;
              const max = rowDesc?.max ?? 1;
              const range = max - min || 1;
              const v = r[ci];
              const num = Number(v);
              if (v !== "" && !Number.isNaN(num)) out[ci] = ((num - min) / range).toFixed(4);
            }
          }
          return out;
        })];
      } else if (transformAction === "fill_mode") {
        newRows = [header, ...dataRows.slice(1).map((r) => {
          const out = [...r];
          for (const col of columnsToApply) {
            const ci = header.indexOf(col);
            const mode = getColumnMode(dataRows, col);
            const v = (r[ci] ?? "").toString().trim();
            if (v === "") out[ci] = mode || "";
          }
          return out;
        })];
      } else {
        const numericRows = dataRows.slice(1).map((r) => r.map((v) => (v ??"").trim()));
        newRows = [header, ...numericRows.map((r) => {
          const out = [...r];
          for (const col of columnsToApply) {
            const ci = header.indexOf(col);
            const numVals = numericRows.map((row) => Number(row[ci])).filter((v) => !Number.isNaN(v));
            const fill = transformAction === "fill_median"
              ? (numVals.length ? (() => { const s = [...numVals].sort((a, b) => a - b); const m = Math.floor(s.length / 2); return s.length % 2 ? s[m] : (s[m - 1] + s[m]) / 2; })() : 0)
              : (numVals.length ? numVals.reduce((a, b) => a + b, 0) / numVals.length : 0);
            const v = r[ci];
            out[ci] = (v === "" || Number.isNaN(Number(v))) ? String(fill.toFixed(2)) : v;
          }
          return out;
        })];
      }
    }
    const now = new Date().toISOString();
    const suffix = transformAction === "filter" ? " (để lọc)" : transformAction === "sort" ? " (để sắp xếp)" : transformAction === "recode" ? " (để recode)" : transformAction === "z_score" ? " (z-score)" : transformAction === "min_max" ? " (min-max)" : " (để biến đổi)";
    const beforeSnapshot = dataRows.map((r) => [...r]);
    setLastTransformResult({ before: beforeSnapshot, after: newRows, actionLabel: suffix });

    if (overwriteOriginal) {
      setDatasets((prev) => prev.map((d) =>
        d.id === selectedDs.id
          ? { ...d, name: `${selectedDs.name}${suffix}`, rows: newRows.length - 1, columns: header.length, columnNames: header, preview: newRows.slice(0, 6), data: newRows, updatedAt: now }
          : d
      ));
      setShowTransformChoiceModal(false);
    } else {
      const id = generateId();
      setDatasets((prev) => [...prev, { id, name: `${selectedDs.name}${suffix}`, rows: newRows.length - 1, columns: header.length, columnNames: header, preview: newRows.slice(0, 6), data: newRows, sourceFormat: selectedDs.sourceFormat, createdAt: now, updatedAt: now }]);
      onSelectDataset(id);
      onWorkflowDatasetAdd?.(id);
      setShowTransformChoiceModal(false);
    }
  };

  const addRecodeRule = () => setRecodeRules((prev) => [...prev, { from: "", to: "" }]);
  const setRecodeRule = (i: number, field: "from" | "to", value: string) => setRecodeRules((prev) => prev.map((r, j) => j === i ? { ...r, [field]: value } : r));

  return (
    <div className="w-full max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-xl font-semibold">Biến đổi &amp; pipeline</h2>
        <AIAssistPanel
          context={aiContextTransform}
          quickPrompts={[{ label: "Hướng dẫn biến đổi", systemHint: "Bạn là chuyên gia tiền xử lý dữ liệu. Dựa trên cấu trúc và mô tả bộ dữ liệu, gợi ý ngắn gọn: xử lý missing (bỏ/điền mean/median/mode), lọc theo điều kiện, chuẩn hóa (z-score, min-max), sắp xếp, recode biến. Chỉ nêu các bước phù hợp. Trả lời bằng tiếng Việt." }]}
          title="Hỏi AI về biến đổi dữ liệu"
        />
      </div>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">Làm sạch (missing), lọc, sắp xếp, recode. Tạo dataset mới.</p>
      <div>
        <label className="block text-sm font-medium mb-1">Hành động</label>
        <select value={transformAction} onChange={(e) => setTransformAction(e.target.value as typeof transformAction)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 mb-3">
          <option value="drop_missing">Loại bỏ dòng thiếu (một hoặc nhiều cột)</option>
          <option value="fill_mean">Thay missing bằng mean</option>
          <option value="fill_median">Thay missing bằng median</option>
          <option value="fill_mode">Thay missing bằng mode (giá trị xuất hiện nhiều nhất)</option>
          <option value="z_score">Chuẩn hóa z-score (mean=0, std=1)</option>
          <option value="min_max">Chuẩn hóa min-max (về [0, 1])</option>
          <option value="filter">Lọc dòng theo điều kiện</option>
          <option value="sort">Sắp xếp theo cột</option>
          <option value="recode">Recode (gán lại giá trị)</option>
        </select>
      </div>
      {(transformAction === "drop_missing" || transformAction === "fill_mean" || transformAction === "fill_median" || transformAction === "fill_mode" || transformAction === "z_score" || transformAction === "min_max") && (
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">Cột (có thể chọn nhiều)</label>
            <div className="flex flex-wrap gap-x-4 gap-y-1 max-h-32 overflow-y-auto rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-2">
              {cols.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={transformColsMultiple.includes(c)} onChange={() => setTransformColsMultiple((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])} />
                  {c}
                </label>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-1">Chọn ít nhất một cột. Với &quot;Loại bỏ dòng thiếu&quot;: xóa dòng nếu bất kỳ cột chọn nào thiếu.</p>
          </div>
        </div>
      )}
      {transformAction === "filter" && (
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">Cột</label>
            <select value={filterCol} onChange={(e) => setFilterCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">— Chọn —</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">điều kiện</label>
            <select value={filterOp} onChange={(e) => setFilterOp(e.target.value as typeof filterOp)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="==">= (bằng)</option>
              <option value="!=">≠ (khác)</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">≥ (lớn hơn hoặc bằng)</option>
              <option value="<=">≤ (nhỏ hơn hoặc bằng)</option>
              <option value="contains">Chứa (text)</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Giá trị</label>
            <input type="text" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder="Nhập giá trị" className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2" />
          </div>
        </div>
      )}
      {transformAction === "sort" && (
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">Sắp xếp theo cột</label>
            <select value={sortCol} onChange={(e) => setSortCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">— Chọn —</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Thứ tự</label>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="asc">Tăng dần</option>
              <option value="desc">Giảm dần</option>
            </select>
          </div>
        </div>
      )}
      {transformAction === "recode" && (
        <div className="mb-3">
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">Cột cần recode</label>
            <select value={recodeCol} onChange={(e) => setRecodeCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">— Chọn —</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <p className="text-sm text-neutral-500 mb-2">Giá trị cũ → Giá trị mới (để trống →Giá trị cũ = bỏ qua)</p>
          {recodeRules.map((r, i) => (
            <div key={i} className="flex gap-2 items-center mb-2">
              <input type="text" value={r.from} onChange={(e) => setRecodeRule(i, "from", e.target.value)} placeholder="Giá trị cũ" className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-32" />
              <span className="text-neutral-500" aria-hidden="true">→</span>
              <input type="text" value={r.to} onChange={(e) => setRecodeRule(i, "to", e.target.value)} placeholder="Giá trị mới" className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-32" />
            </div>
          ))}
          <button type="button" onClick={addRecodeRule} className="text-sm text-brand hover:underline">+ Thêm quy tắc</button>
        </div>
      )}
      <button type="button" onClick={() => setShowTransformChoiceModal(true)} disabled={["drop_missing","fill_mean","fill_median","fill_mode","z_score","min_max"].includes(transformAction) && transformColsMultiple.length === 0} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Áp dụng</button>
      {showTransformChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowTransformChoiceModal(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg max-w-md w-full p-5 space-y-4" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">Biến đổi dữ liệu</h3>
            <p className="text-neutral-600 dark:text-neutral-400">Bạn muốn biến đổi dữ liệu gốc hay sinh ra file (dataset) mới?</p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => applyTransform(true)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 px-4 py-2.5 text-left font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600">
                Biến đổi dữ liệu gốc
              </button>
              <button type="button" onClick={() => applyTransform(false)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 px-4 py-2.5 text-left font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600">
                Sinh file mới (dataset mới)
              </button>
              <button type="button" onClick={() => setShowTransformChoiceModal(false)} className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                Hủy
              </button>
            </div>
          </div>
        </div>
      )}
      {lastTransformResult && (
        <div className="mt-6 space-y-4 rounded-xl border border-neutral-200 dark:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/50 p-4">
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">Kết quả biến đổi {lastTransformResult.actionLabel}</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            Trước: <strong>{lastTransformResult.before.length - 1}</strong> hàng × <strong>{lastTransformResult.before[0]?.length ?? 0}</strong> cột
            {" → "}
            Sau: <strong>{lastTransformResult.after.length - 1}</strong> hàng × <strong>{lastTransformResult.after[0]?.length ?? 0}</strong> cột
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 overflow-hidden">
              <div className="px-3 py-2 border-b border-amber-200 dark:border-amber-800 bg-amber-100/80 dark:bg-amber-900/40 font-medium text-amber-900 dark:text-amber-100 text-sm">
                Dữ liệu trước biến đổi
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-amber-50 dark:bg-amber-900/30">
                    <tr className="border-b border-amber-200 dark:border-amber-700">
                      {(lastTransformResult.before[0] || []).map((h, i) => (
                        <th key={i} className="text-left p-2 whitespace-nowrap font-medium text-amber-900 dark:text-amber-200">{h || `C${i + 1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lastTransformResult.before.slice(1, 16).map((row, ri) => (
                      <tr key={ri} className="border-b border-amber-100 dark:border-amber-800/50">
                        {(row || []).map((cell, ci) => (
                          <td key={ci} className="p-2 text-neutral-700 dark:text-neutral-300">{String(cell ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lastTransformResult.before.length > 16 && (
                <p className="px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200 bg-amber-100/60 dark:bg-amber-900/30">
                  Chỉ hiển thị 15 hàng đầu. Tổng {lastTransformResult.before.length - 1} hàng.
                </p>
              )}
            </div>
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 overflow-hidden">
              <div className="px-3 py-2 border-b border-emerald-200 dark:border-emerald-800 bg-emerald-100/80 dark:bg-emerald-900/40 font-medium text-emerald-900 dark:text-emerald-100 text-sm">
                Dữ liệu sau biến đổi
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-emerald-50 dark:bg-emerald-900/30">
                    <tr className="border-b border-emerald-200 dark:border-emerald-700">
                      {(lastTransformResult.after[0] || []).map((h, i) => (
                        <th key={i} className="text-left p-2 whitespace-nowrap font-medium text-emerald-900 dark:text-emerald-200">{h || `C${i + 1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lastTransformResult.after.slice(1, 16).map((row, ri) => (
                      <tr key={ri} className="border-b border-emerald-100 dark:border-emerald-800/50">
                        {(row || []).map((cell, ci) => (
                          <td key={ci} className="p-2 text-neutral-700 dark:text-neutral-300">{String(cell ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lastTransformResult.after.length > 16 && (
                <p className="px-3 py-1.5 text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-100/60 dark:bg-emerald-900/30">
                  Chỉ hiển thị 15 hàng đầu. Tổng {lastTransformResult.after.length - 1} hàng.
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            Dataset mới đã được thêm vào danh sách (hoặc đã cập nhật dataset gốc). Bạn có thể chuyển tab <strong>Xem dữ liệu</strong> để xem toàn bộ.
          </p>
        </div>
      )}
    </div>
  );
}

function AnalysisView({
  tab,
  selectedDataset,
  onHypothesisResult,
  correlationMethod,
  setCorrelationMethod,
  analysisBackendAvailable = false,
  descriptiveBackendResult = null,
  correlationBackendResult = null,
}: {
  tab: AnalysisTab;
  selectedDataset: Dataset | undefined;
  onHypothesisResult?: (r: { type: "ttest" | "chisquare" | "anova" | "mannwhitney"; payload: TTestResult | ChiSquareResult | ANOVAResult | MannWhitneyResult; meta?: Record<string, string> } | null) => void;
  correlationMethod: "pearson" | "spearman" | "kendall";
  setCorrelationMethod: (m: "pearson" | "spearman" | "kendall") => void;
  analysisBackendAvailable?: boolean;
  descriptiveBackendResult?: DescriptiveRow[] | null;
  correlationBackendResult?: { matrix: number[][]; columnNames: string[] } | null;
}) {
  const effectiveTab = tab === "descriptive" ? "hypothesis" : tab;
  const tabs: Record<AnalysisTab, { title: string; desc: string }> = {
    descriptive: { title: "Thống kê mô tả", desc: "Thống kê mô tả, phân bố, effect size. AI diễn giải." },
    hypothesis: { title: "Kiểm định giả thuyết", desc: "t-test, ANOVA, Chi-square, Mann-Whitney, Shapiro-Wilk, phân tích lực mẫu." },
    regression: { title: "Hồi quy", desc: "OLS (Y liên tục), Logistic (Y nhị phân). VIF, kiểm tra đa cộng tuyến." },
    sem: { title: "SEM", desc: "Mediation (X→M→Y), Moderation (tương tác X×M). Mô hình cấu trúc." },
    correlation: { title: "Ma trận tương quan", desc: "Pearson hoặc Spearman giữa các cột số." },
    reliability: { title: "Độ tin cậy Cronbach", desc: "Hệ số Cronbach's alpha cho thang đo (ví dụ Likert), đánh giá độ tin cậy nội tại." },
    factor: { title: "Phân tích nhân tố (EFA)", desc: "Trích nhân tố PCA, xoay varimax. Kiểm tra cấu trúc thang đo." },
    ml: { title: "Học máy", desc: "Phân loại, hồi quy ML, độ quan trọng biến, cross-validation." },
    bayesian: { title: "Bayesian", desc: "Suy luận Bayesian, trực quan hóa posterior, so sánh mô hình." },
  };
  const { title, desc } = tabs[effectiveTab] ??{ title: effectiveTab, desc: "" };
  const [partialCol1, setPartialCol1] = useState("");
  const [partialCol2, setPartialCol2] = useState("");
  const [partialControls, setPartialControls] = useState<string[]>([]);
  const [partialResult, setPartialResult] = useState<{ r: number; n: number } | null>(null);
  const [covarianceResult, setCovarianceResult] = useState<{ matrix: number[][]; columnNames: string[]; ddof: number } | null>(null);
  const [covarianceMethod, setCovarianceMethod] = useState<"population" | "sample">("sample");

  if (effectiveTab === "correlation" && selectedDataset) {
    const rows = getDataRows(selectedDataset);
    const corr = (analysisBackendAvailable ? correlationBackendResult : null) ?? computeCorrelationMatrix(rows, correlationMethod);
    if (!corr || corr.matrix.length < 2) return (
      <div className="w-full max-w-full">
        <h2 className="text-xl font-semibold mb-2">Ma trận tương quan</h2>
        <p className="text-neutral-500">Cần ít nhất 2 cột số và đủ dữ liệu.</p>
      </div>
    );
    return (
      <div className="w-full max-w-full">
        <h2 className="text-xl font-semibold mb-2">Ma trận tương quan</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">Hệ số tương quan giữa các cột số. Pearson: quan hệ tuyến tính; Spearman: hạng (ordinal); Kendall: tau-b (ordinal, ưu tiên cặp gần).</p>
        {analysisBackendAvailable && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" /> Ma trận tương quan từ backend Python
          </p>
        )}
        {corr && corr.columnNames.length > 0 && (
          <AIAssistPanel
            context={`Ma trận tương quan (${correlationMethod}). Cột: ${corr.columnNames.join(", ")}. Mẫu hệ số: ${corr.matrix.slice(0, 4).map((row, i) => `${corr.columnNames[i]}: ${row.slice(0, 4).map((v) => v.toFixed(2)).join(", ")}`).join("; ")}.`}
            quickPrompts={[{ label: "Giải thích ma trận tương quan", systemHint: "Bạn là chuyên gia thống kê. Giải thích ma trận tương quan: ý nghĩa hệ số Pearson/Spearman/Kendall (cường độ, hướng), mối quan hệ giữa các cặp biến. Gợi ý khi nào cần kiểm định ý nghĩa (test r=0). Trả lời ngắn gọn bằng tiếng Việt." }]}
            title="Hỏi AI về ma trận tương quan"
          />
        )}
        <div className="flex gap-2 mb-3">
          <button type="button" onClick={() => setCorrelationMethod("pearson")} className={`rounded-lg px-3 py-1.5 text-sm ${correlationMethod === "pearson" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Pearson</button>
          <button type="button" onClick={() => setCorrelationMethod("spearman")} className={`rounded-lg px-3 py-1.5 text-sm ${correlationMethod === "spearman" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Spearman</button>
          <button type="button" onClick={() => setCorrelationMethod("kendall")} className={`rounded-lg px-3 py-1.5 text-sm ${correlationMethod === "kendall" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Kendall</button>
        </div>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto mb-4">
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
        <p className="text-sm font-medium mb-2">Heatmap (màu theo hệ số: -1 ? 1)</p>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto inline-block">
          <table className="text-sm border-collapse">
            <thead>
              <tr>
                <th className="p-1.5 text-left font-medium border-b border-r border-neutral-200 dark:border-neutral-600"></th>
                {corr.columnNames.map((c) => <th key={c} className="p-1.5 text-right font-medium whitespace-nowrap border-b border-r border-neutral-200 dark:border-neutral-600 text-xs max-w-[80px] truncate" title={c}>{c}</th>)}
              </tr>
            </thead>
            <tbody>
              {corr.matrix.map((row, i) => (
                <tr key={i}>
                  <td className="p-1.5 font-medium border-b border-r border-neutral-200 dark:border-neutral-600 text-xs max-w-[80px] truncate" title={corr.columnNames[i]}>{corr.columnNames[i]}</td>
                  {row.map((v, j) => {
                    const t = (v + 1) / 2;
                    const r = Math.round(255 * (1 - t));
                    const b = Math.round(255 * t);
                    const bg = `rgb(${r}, ${200 - Math.abs(v) * 100}, ${b})`;
                    return <td key={j} className="p-1.5 text-right border-b border-r border-neutral-200 dark:border-neutral-600" style={{ background: bg }} title={v.toFixed(3)}>{v.toFixed(2)}</td>;
                  })}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-sm font-semibold mb-2">Ma trận hiệp phương sai (Covariance)</p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">Hiệp phương sai giữa các cột số. Population: chia N; Sample: chia N-1.</p>
          <div className="flex flex-wrap gap-4 items-end mb-2">
            <div>
              <label className="block text-xs font-medium mb-1">Cách tính</label>
              <select value={covarianceMethod} onChange={(e) => { setCovarianceMethod(e.target.value as "population" | "sample"); setCovarianceResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm">
                <option value="sample">Sample (N-1)</option>
                <option value="population">Population (N)</option>
              </select>
            </div>
            <button type="button" onClick={async () => { if (!analysisBackendAvailable) return; const res = await quantisApi.analyzeCovariance(rows, covarianceMethod); setCovarianceResult(res ?? null); }} disabled={!analysisBackendAvailable} className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm disabled:opacity-50">Tính Covariance</button>
          </div>
          {covarianceResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto mt-2">
              <AIAssistPanel
                context={`Ma trận hiệp phương sai (${covarianceMethod}): ${covarianceResult.columnNames.join(", ")}. Mẫu: ${covarianceResult.matrix.slice(0, 3).map((row, i) => `${covarianceResult.columnNames[i]}: [${row.slice(0, 4).map((v) => v.toFixed(2)).join(", ")}${row.length > 4 ? "…" : ""}]`).join("; ")}.`}
                quickPrompts={[{ label: "Diễn giải ma trận hiệp phương sai", systemHint: "Bạn là chuyên gia thống kê. Giải thích ma trận hiệp phương sai (covariance): ý nghĩa đường chéo (phương sai từng biến), ngoài đường chéo (hiệp phương sai cặp biến). So sánh với tương quan. Trả lời ngắn gọn bằng tiếng Việt." }]}
                title="Hỏi AI về ma trận hiệp phương sai"
              />
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="p-2 text-left font-medium"></th>
                    {covarianceResult.columnNames.map((c) => (
                      <th key={c} className="p-2 text-right font-medium whitespace-nowrap">{c}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {covarianceResult.matrix.map((row, i) => (
                    <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/50">
                      <td className="p-2 font-medium whitespace-nowrap">{covarianceResult.columnNames[i]}</td>
                      {row.map((v, j) => (
                        <td key={j} className="p-2 text-right">{v.toFixed(4)}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
        <div className="mt-6 pt-4 border-t border-neutral-200 dark:border-neutral-700">
          <p className="text-sm font-semibold mb-2">Tương quan từng phần (kiểm soát biến)</p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-3">r(x, y | Z): tương quan giữa x và y khi kiểm soát Z. Chọn 2 biến và tùy chọn biến kiểm soát.</p>
          <div className="flex flex-wrap gap-4 items-end mb-2">
            <div>
              <label className="block text-xs font-medium mb-1">Biến 1</label>
              <select value={partialCol1} onChange={(e) => { setPartialCol1(e.target.value); setPartialResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm">
                <option value="">— Chọn —</option>
                {corr.columnNames.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Biến 2</label>
              <select value={partialCol2} onChange={(e) => { setPartialCol2(e.target.value); setPartialResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm">
                <option value="">— Chọn —</option>
                {corr.columnNames.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium mb-1">Kiểm soát (tùy chọn)</label>
              <div className="flex flex-wrap gap-1">
                {corr.columnNames.filter((c) => c !== partialCol1 && c !== partialCol2).map((c) => (
                  <label key={c} className="inline-flex items-center gap-1 text-sm">
                    <input type="checkbox" checked={partialControls.includes(c)} onChange={(e) => { setPartialControls((prev) => e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)); setPartialResult(null); }} />
                    {c}
                  </label>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => { const res = partialCol1 && partialCol2 ? computePartialCorrelation(rows, partialCol1, partialCol2, partialControls) : null; setPartialResult(res ?? null); }} disabled={!partialCol1 || !partialCol2} className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm disabled:opacity-50">Tính r từng phần</button>
          </div>
          {partialResult && (
            <div className="mt-2">
              <AIAssistPanel
                context={`Tương quan từng phần: r(${partialCol1}, ${partialCol2} | ${partialControls.length ? partialControls.join(", ") : "—"}) = ${partialResult.r.toFixed(4)}, n = ${partialResult.n}.`}
                quickPrompts={[{ label: "Diễn giải tương quan từng phần", systemHint: "Bạn là chuyên gia thống kê. Giải thích tương quan từng phần (partial correlation): mối liên hệ giữa hai biến khi đã kiểm soát (loại trừ ảnh hưởng) các biến khác. Nêu ý nghĩa hệ số và cách đọc. Trả lời ngắn gọn bằng tiếng Việt." }]}
                title="Hỏi AI về tương quan từng phần"
              />
              <p className="text-sm">r({partialCol1}, {partialCol2} | {partialControls.length ? partialControls.join(", ") : "—"}) = <strong>{partialResult.r.toFixed(4)}</strong>, n = {partialResult.n}</p>
              {(() => { const ci = computeCorrelationCI(partialResult.r, partialResult.n); return ci ? <p className="text-xs text-neutral-600 dark:text-neutral-400 mt-1">Khoảng tin cậy 95% cho r (Fisher z): [{ci.ciLower.toFixed(4)}, {ci.ciUpper.toFixed(4)}]</p> : null; })()}
            </div>
          )}
        </div>
      </div>
    );
  }

  if (effectiveTab === "hypothesis" && selectedDataset) {
    return <HypothesisTab selectedDataset={selectedDataset} onHypothesisResult={onHypothesisResult} analysisBackendAvailable={analysisBackendAvailable} />;
  }

  if (effectiveTab === "reliability" && selectedDataset) {
    const rows = getDataRows(selectedDataset);
    const cols = selectedDataset.columnNames || [];
    const numericCols = rows.length >= 2 ? cols.filter((c) => { const ci = rows[0].indexOf(c); const vals = rows.slice(1).map((r) => r[ci]); return vals.every((v) => v === "" || !Number.isNaN(Number(v))); }) : [];
    return <ReliabilityTab selectedDataset={selectedDataset} rows={rows} numericCols={numericCols} analysisBackendAvailable={analysisBackendAvailable} />;
  }

  if (effectiveTab === "regression") {
    return <RegressionExplainerView selectedDataset={selectedDataset} analysisBackendAvailable={analysisBackendAvailable} />;
  }

  if (effectiveTab === "sem") {
    return <SEMExplainerView selectedDataset={selectedDataset} analysisBackendAvailable={analysisBackendAvailable} />;
  }

  if (effectiveTab === "factor" && selectedDataset) {
    return <FactorTab selectedDataset={selectedDataset} analysisBackendAvailable={analysisBackendAvailable} />;
  }

  if (effectiveTab === "ml" && selectedDataset) {
    return <MLTab selectedDataset={selectedDataset} analysisBackendAvailable={analysisBackendAvailable} />;
  }

  if (effectiveTab === "bayesian" && selectedDataset) {
    return <BayesianTab selectedDataset={selectedDataset} analysisBackendAvailable={analysisBackendAvailable} />;
  }

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">{title}</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{desc}</p>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm text-neutral-500">
        Tính năng sẽ được bổ sung trong bản cập nhật tới.
      </div>
    </div>
  );
}

function FactorTab({ selectedDataset, analysisBackendAvailable = false }: { selectedDataset: Dataset; analysisBackendAvailable?: boolean }) {
  const rows = getDataRows(selectedDataset);
  const cols = selectedDataset.columnNames ?? [];
  const numericCols = rows.length >= 2 ? cols.filter((c) => { const ci = rows[0].indexOf(c); const vals = rows.slice(1).map((r) => r[ci]); return vals.every((v) => v === "" || !Number.isNaN(Number(v))); }) : [];
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [nFactors, setNFactors] = useState<number | "">("");
  const [result, setResult] = useState<EFAResult | null>(null);
  const toggleCol = (c: string) => setSelectedCols((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  const runEFA = async () => {
    if (selectedCols.length < 2) return;
    const k = typeof nFactors === "number" && nFactors >= 1 ? nFactors : undefined;
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeEFA(rows, selectedCols, k);
      setResult(res ?? null);
      return;
    }
    const res = computeEFA(rows, selectedCols, k);
    setResult(res ?? null);
  };
  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">Phân tích nhân tố khám phá (EFA)</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">Trích xuất nhân tố bằng PCA, xoay varimax. Kiểm tra cấu trúc thang đo (Likert).</p>
      {analysisBackendAvailable && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5" /> EFA từ backend Python (PCA + varimax)
        </p>
      )}
      <div className="mb-4">
        <AIAssistPanel
          metadata={selectedDataset ? `Dataset: ${selectedDataset.name}. Số cột số: ${numericCols.length}.` : undefined}
          context="Phân tích nhân tố khám phá (EFA): trích xuất nhân tố (PCA), xoay varimax. Chọn ít nhất 2 biến (item), có thể chỉ định số nhân tố hoặc để eigenvalue > 1."
          quickPrompts={[{ label: "Gợi ý số nhân tố và diễn giải EFA", systemHint: "Bạn là chuyên gia EFA. Gợi ý cách chọn số nhân tố (eigenvalue > 1, scree plot), ý nghĩa loadings và đặt tên nhân tố. Trả lời ngắn gọn bằng tiếng Việt." }]}
          title="Hỏi AI về EFA"
        />
      </div>
      {numericCols.length >= 2 ? (
        <>
          <div className="flex flex-wrap gap-2 mb-3">
            <span className="text-sm font-medium">Chọn biến (item):</span>
            {numericCols.map((c) => (
              <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                <input type="checkbox" checked={selectedCols.includes(c)} onChange={() => toggleCol(c)} className="rounded" />
                <span className="text-sm">{c}</span>
              </label>
            ))}
          </div>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Số nhân tố (để trống = eigenvalue &gt; 1)</label>
              <input type="number" min={1} max={selectedCols.length} value={nFactors} onChange={(e) => { const v = e.target.value; setNFactors(v === "" ? "" : Math.max(1, parseInt(v, 10) || 1)); setResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-28" placeholder="Auto" />
            </div>
            <button type="button" onClick={runEFA} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Chạy EFA</button>
          </div>
          {result && (
            <div className="space-y-4">
              <AIAssistPanel
                context={`EFA: ${result.nFactors} nhân tố. Eigenvalues: ${result.eigenvalues.slice(0, result.nFactors).map((e) => e.toFixed(2)).join(", ")}. Phương sai giải thích: ${result.varianceExplained?.slice(0, result.nFactors).map((v) => v?.toFixed(1) + "%").join(", ") ?? "—"}. Loadings (varimax) cho các biến: ${result.columnNames.slice(0, 6).join(", ")}${result.columnNames.length > 6 ? "..." : ""}.`}
                quickPrompts={[{ label: "Diễn giải kết quả EFA", systemHint: "Bạn là chuyên gia phân tích nhân tố (EFA). Giải thích: số nhân tố trích, eigenvalue (>1), % phương sai giải thích, loadings (trọng số từng biến trên từng nhân tố). Gợi ý cách đặt tên nhân tố dựa trên biến có loading cao. Trả lời ngắn gọn bằng tiếng Việt." }]}
                title="Hỏi AI về EFA"
              />
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
                <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">Eigenvalues &amp; phương sai giải thích</p>
                <table className="w-full">
                  <thead><tr className="border-b border-neutral-200 dark:border-neutral-600"><th className="text-left p-2">Nhân tố</th><th className="text-right p-2">Eigenvalue</th><th className="text-right p-2">% phương sai</th></tr></thead>
                  <tbody>
                    {result.eigenvalues.slice(0, result.nFactors).map((e, i) => (
                      <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/50">
                        <td className="p-2 font-medium">F{i + 1}</td>
                        <td className="p-2 text-right">{e.toFixed(3)}</td>
                        <td className="p-2 text-right">{result.varianceExplained[i]?.toFixed(1) ?? "—"}%</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
                <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">Ma trận nhân tố (loadings, varimax)</p>
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-600">
                      <th className="text-left p-2">Biến</th>
                      {Array.from({ length: result.nFactors }, (_, i) => <th key={i} className="text-right p-2">F{i + 1}</th>)}
                    </tr>
                  </thead>
                  <tbody>
                    {result.columnNames.map((name, i) => (
                      <tr key={name} className="border-b border-neutral-100 dark:border-neutral-700/50">
                        <td className="p-2 font-medium">{name}</td>
                        {result.loadings[i]?.slice(0, result.nFactors).map((v, j) => (
                          <td key={j} className="p-2 text-right">{v.toFixed(3)}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}
        </>
      ) : (
        <p className="text-neutral-500">Cần ít nhất 2 cột số.</p>
      )}
    </div>
  );
}

function RegressionExplainerView({ selectedDataset, analysisBackendAvailable = false }: { selectedDataset: Dataset | undefined; analysisBackendAvailable?: boolean }) {
  const rows = selectedDataset ? getDataRows(selectedDataset) : [];
  const cols = selectedDataset?.columnNames ?? [];
  const numericCols = rows.length >= 2 ? cols.filter((c) => { const ci = rows[0].indexOf(c); const vals = rows.slice(1).map((r) => r[ci]); return vals.every((v) => v === "" || !Number.isNaN(Number(v))); }) : [];
  const yBinaryOptions = numericCols.filter((c) => { const ci = rows[0]?.indexOf(c) ?? -1; if (ci === -1) return false; const vals = rows.slice(1).map((r) => Number(r[ci])).filter((v) => !Number.isNaN(v)); const uniq = [...new Set(vals)]; return uniq.length === 2 && uniq.every((v) => v === 0 || v === 1); });
  const [olsYCol, setOlsYCol] = useState("");
  const [olsXSelected, setOlsXSelected] = useState<string[]>([]);
  const [olsResult, setOlsResult] = useState<OLSResult | null>(null);
  const [logYCol, setLogYCol] = useState("");
  const [logXSelected, setLogXSelected] = useState<string[]>([]);
  const [logResult, setLogResult] = useState<LogisticResult | null>(null);
  const [poissonYCol, setPoissonYCol] = useState("");
  const [poissonXSelected, setPoissonXSelected] = useState<string[]>([]);
  const [poissonResult, setPoissonResult] = useState<{ coefficients: Record<string, number>; intercept: number; irr: Record<string, number>; se: Record<string, number>; zStat: Record<string, number>; pValue: Record<string, number>; logLikelihood: number; aic: number; n: number; yName: string; xNames: string[] } | null>(null);
  const [ridgeYCol, setRidgeYCol] = useState("");
  const [ridgeXSelected, setRidgeXSelected] = useState<string[]>([]);
  const [ridgeAlpha, setRidgeAlpha] = useState(1);
  const [ridgeResult, setRidgeResult] = useState<{ coefficients: Record<string, number>; intercept: number; r2: number; alpha: number; n: number; yName: string; xNames: string[] } | null>(null);

  const toggleX = (col: string) => setOlsXSelected((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
  const toggleLogX = (col: string) => setLogXSelected((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
  const togglePoissonX = (col: string) => setPoissonXSelected((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
  const toggleRidgeX = (col: string) => setRidgeXSelected((prev) => prev.includes(col) ? prev.filter((c) => c !== col) : [...prev, col]);
  const runOLS = async () => {
    if (!olsYCol || olsXSelected.length === 0 || !rows.length) return;
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeOLS(rows, olsYCol, olsXSelected);
      setOlsResult(res ?? null);
      return;
    }
    const res = computeOLS(rows, olsYCol, olsXSelected);
    setOlsResult(res ?? null);
  };
  const runLogistic = async () => {
    if (!logYCol || logXSelected.length === 0 || !rows.length) return;
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeLogistic(rows, logYCol, logXSelected);
      setLogResult(res ?? null);
      return;
    }
    const res = computeLogisticRegression(rows, logYCol, logXSelected);
    setLogResult(res ?? null);
  };
  const [vifBackendResult, setVifBackendResult] = useState<Record<string, number> | null>(null);
  useEffect(() => {
    if (!analysisBackendAvailable || !olsResult || olsXSelected.length < 2) {
      setVifBackendResult(null);
      return;
    }
    quantisApi.analyzeVIF(rows, olsXSelected).then(setVifBackendResult);
  }, [analysisBackendAvailable, olsResult, olsXSelected.join(","), rows.length]);
  const vifResult = (analysisBackendAvailable ? vifBackendResult : null) ??(olsResult && olsXSelected.length >= 2 ? computeVIF(rows, olsXSelected) : null);

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">Hồi quy</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">
        Hồi quy tuyến tính (OLS) khi Y liên tục, Hồi quy Logistic khi Y nhị phân (0/1), Hồi quy Poisson khi Y đếm (số nguyên ≥ 0), Hồi quy Ridge (L2) khi nhiều biến/đa cộng tuyến. VIF kiểm tra đa cộng tuyến.
      </p>
      {analysisBackendAvailable && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5" /> OLS &amp; Logistic chạy trên backend Python (statsmodels)
        </p>
      )}
      <div className="mb-4">
        <AIAssistPanel
          metadata={selectedDataset ? `Dataset: ${selectedDataset.name}. Số hàng: ${selectedDataset.rows}, số cột: ${selectedDataset.columns}. Cột số: ${numericCols.slice(0, 15).join(", ")}${numericCols.length > 15 ? "…" : ""}.` : undefined}
          context="Hồi quy: OLS khi Y liên tục, Logistic khi Y nhị phân (0/1). VIF kiểm tra đa cộng tuyến. Chọn Y và các biến X rồi Chạy."
          quickPrompts={[{ label: "Khi nào dùng OLS vs Logistic", systemHint: "Bạn là chuyên gia hồi quy. So sánh OLS (Y liên tục) và Logistic (Y nhị phân 0/1). Giải thích hệ số, R², VIF. Trả lời ngắn gọn bằng tiếng Việt." }]}
          title="Hỏi AI về hồi quy"
        />
      </div>

      {selectedDataset && numericCols.length >= 2 && (
        <section className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/30 dark:bg-emerald-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Hồi quy tuyến tính (OLS)</h3>
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">Biến phụ thuộc (Y)</label>
              <select value={olsYCol} onChange={(e) => { setOlsYCol(e.target.value); setOlsResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn Y —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến độc lập (X) – chọn ít nhất 1</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {numericCols.filter((c) => c !== olsYCol).map((c) => (
                  <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={olsXSelected.includes(c)} onChange={() => { toggleX(c); setOlsResult(null); }} className="rounded" />
                    <span className="text-sm">{c}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="button" onClick={runOLS} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Chạy OLS</button>
          </div>
          {olsResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm mt-3">
              <div className="flex items-center justify-end gap-2 p-2 border-b border-neutral-100">
                <button type="button" onClick={() => { const headers = ["Biến","Hệ số","SE","t","p-value"]; const rows = [["(Hàng số)", olsResult.intercept.toFixed(4), olsResult.se["(Intercept)"]?.toFixed(4) ??"", olsResult.tStat["(Intercept)"]?.toFixed(4) ??"", olsResult.pValue["(Intercept)"] != null ? (olsResult.pValue["(Intercept)"] < 0.001 ? "< .001" : olsResult.pValue["(Intercept)"].toFixed(4)) : ""], ...olsResult.xNames.map((name) => [name, olsResult.coefficients[name]?.toFixed(4) ??"", olsResult.se[name]?.toFixed(4) ??"", olsResult.tStat[name]?.toFixed(4) ??"", olsResult.pValue[name] != null ? (olsResult.pValue[name]! < 0.001 ? "< .001" : olsResult.pValue[name]!.toFixed(4)) : ""])]; const tsv = [headers.join("\t"), ...rows.map((r) => r.join("\t")), `R2 = ${olsResult.r2.toFixed(4)}, Adj R2 = ${olsResult.adjR2.toFixed(4)}, n = ${olsResult.n}`].join("\n"); void navigator.clipboard.writeText(tsv); }} className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs flex items-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"><Copy className="w-3.5 h-3.5" /> Sao chép bảng</button>
              </div>
              <AIAssistPanel
                metadata={selectedDataset ? `Dataset: ${selectedDataset.name}. Số hàng: ${selectedDataset.rows ?? rows.length}, số cột: ${selectedDataset.columns ?? (rows[0]?.length ?? 0)}. Các cột: ${(selectedDataset.columnNames || rows[0] || []).slice(0, 25).join(", ")}${(selectedDataset.columnNames?.length ?? rows[0]?.length ?? 0) > 25 ? "..." : ""}.` : undefined}
                process={`Phương pháp: Hồi quy OLS (bình phương tối thiểu). Biến phụ thuộc Y: ${olsYCol}. Biến độc lập X: ${olsResult.xNames.join(", ")}.`}
                context={`Hồi quy OLS: Y và ${olsResult.xNames.join(", ")}. R² = ${olsResult.r2.toFixed(3)}, R² điều chỉnh = ${olsResult.adjR2.toFixed(3)}, n = ${olsResult.n}. Hệ số: (Intercept) = ${olsResult.intercept.toFixed(3)}; ${olsResult.xNames.map((n) => `${n} = ${olsResult.coefficients[n]?.toFixed(3)} (p = ${olsResult.pValue[n] != null ? (olsResult.pValue[n]! < 0.001 ? "<.001" : olsResult.pValue[n]!.toFixed(3)) : "—"})`).join("; ")}.`}
                quickPrompts={[{ label: "Diễn giải hồi quy OLS", systemHint: "Bạn là chuyên gia hồi quy tuyến tính (OLS). Giải thích ý nghĩa: hệ số hồi quy (beta), sai số chuẩn, t, p-value; R² và R² hiệu chỉnh; biến nào có ảnh hưởng có ý nghĩa thống kê. Gợi ý cách trình bày trong báo cáo. Trả lời ngắn gọn bằng tiếng Việt." }]}
                title="Hỏi AI về hồi quy OLS"
              />
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">Biến</th>
                    <th className="text-right p-2">Hệ số</th>
                    <th className="text-right p-2">SE</th>
                    <th className="text-right p-2">t</th>
                    <th className="text-right p-2">p-value</th>
                    {olsResult.ciLower && (
                      <th className="text-right p-2">95% CI</th>
                    )}
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="p-2 font-medium">(Hàng số)</td>
                    <td className="p-2 text-right">{olsResult.intercept.toFixed(4)}</td>
                    <td className="p-2 text-right">{olsResult.se["(Intercept)"]?.toFixed(4) ?? "—"}</td>
                    <td className="p-2 text-right">{olsResult.tStat["(Intercept)"]?.toFixed(3) ?? "—"}</td>
                    <td className="p-2 text-right">{olsResult.pValue["(Intercept)"] != null ? (olsResult.pValue["(Intercept)"] < 0.001 ? "< .001" : olsResult.pValue["(Intercept)"].toFixed(3)) : "—"}</td>
                    {olsResult.ciLower && (
                      <td className="p-2 text-right text-xs">
                        [{olsResult.ciLower["(Intercept)"]?.toFixed(3) ?? "—"}, {olsResult.ciUpper?.["(Intercept)"]?.toFixed(3) ?? "—"}]
                      </td>
                    )}
                  </tr>
                  {olsResult.xNames.map((name) => (
                    <tr key={name} className="border-b border-neutral-100 dark:border-neutral-700/50">
                      <td className="p-2 font-medium">{name}</td>
                      <td className="p-2 text-right">{olsResult.coefficients[name]?.toFixed(4) ?? "—"}</td>
                      <td className="p-2 text-right">{olsResult.se[name]?.toFixed(4) ?? "—"}</td>
                      <td className="p-2 text-right">{olsResult.tStat[name]?.toFixed(3) ?? "—"}</td>
                      <td className="p-2 text-right">{olsResult.pValue[name] != null ? (olsResult.pValue[name] < 0.001 ? "< .001" : olsResult.pValue[name].toFixed(3)) : "—"}</td>
                      {olsResult.ciLower && (
                        <td className="p-2 text-right text-xs">
                          [{olsResult.ciLower[name]?.toFixed(3) ?? "—"}, {olsResult.ciUpper?.[name]?.toFixed(3) ?? "—"}]
                        </td>
                      )}
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 text-neutral-600 dark:text-neutral-400 border-t border-neutral-100">
                R² = {olsResult.r2.toFixed(4)}, R² điều chỉnh = {olsResult.adjR2.toFixed(4)}, n = {olsResult.n}, df = {olsResult.df}.
              </p>
              {vifResult && Object.keys(vifResult).length > 0 && (
                <div className="p-2 border-t border-neutral-100">
                  <p className="font-medium mb-1">VIF (đa cộng tuyến):</p>
                  <div className="flex flex-wrap gap-2">
                    {Object.entries(vifResult).map(([name, v]) => (
                      <span key={name} className={`text-xs px-2 py-0.5 rounded ${v > 5 ? "bg-amber-200 dark:bg-amber-800 text-amber-900 dark:text-amber-100" : "bg-neutral-100 dark:bg-neutral-700"}`} title={v > 5 ? "VIF &gt; 5: cảnh báo đa cộng tuyến" : ""}>{name}: {v.toFixed(2)}</span>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </section>
      )}

      {selectedDataset && numericCols.length >= 2 && yBinaryOptions.length > 0 && (
        <section className="rounded-lg border border-violet-200 dark:border-violet-800 bg-violet-50/30 dark:bg-violet-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Hồi quy Logistic (Y nhị phân 0/1)</h3>
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">Biến phụ thuộc (Y: 0 hoặc 1)</label>
              <select value={logYCol} onChange={(e) => { setLogYCol(e.target.value); setLogResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn Y —</option>
                {yBinaryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến độc lập (X)</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {numericCols.filter((c) => c !== logYCol).map((c) => (
                  <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={logXSelected.includes(c)} onChange={() => { toggleLogX(c); setLogResult(null); }} className="rounded" />
                    <span className="text-sm">{c}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="button" onClick={runLogistic} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Chạy Logistic</button>
          </div>
          {logResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm mt-3">
              <AIAssistPanel
                metadata={selectedDataset ? `Dataset: ${selectedDataset.name}. Số hàng: ${selectedDataset.rows ?? rows.length}, số cột: ${selectedDataset.columns ?? (rows[0]?.length ?? 0)}. Các cột: ${(selectedDataset.columnNames || rows[0] || []).slice(0, 25).join(", ")}${(selectedDataset.columnNames?.length ?? rows[0]?.length ?? 0) > 25 ? "..." : ""}.` : undefined}
                process={`Phương pháp: Hồi quy Logistic (Y nhị phân). Biến phụ thuộc Y: ${logYCol}. Biến độc lập X: ${logResult.xNames.join(", ")}.`}
                context={`Hồi quy Logistic: Y nhị phân, biến X: ${logResult.xNames.join(", ")}. AIC = ${logResult.aic.toFixed(2)}, n = ${logResult.n}. Hệ số & OR: ${logResult.xNames.map((n) => `${n} = ${logResult.coefficients[n]?.toFixed(3)} (OR=${logResult.oddsRatios[n]?.toFixed(3)}, p=${logResult.pValue[n] != null ? (logResult.pValue[n]! < 0.001 ? "<.001" : logResult.pValue[n]!.toFixed(3)) : "—"})`).join("; ")}.`}
                quickPrompts={[{ label: "Diễn giải hồi quy logistic", systemHint: "Bạn là chuyên gia hồi quy logistic. Giải thích ý nghĩa: hệ số (log-odds), odds ratio (OR), p-value; biến nào làm tăng/giảm xác suất biến phụ thuộc nhị phân. Gợi ý cách báo cáo OR và khoảng tin cậy. Trả lời ngắn gọn bằng tiếng Việt." }]}
                title="Hỏi AI về hồi quy logistic"
              />
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">Biến</th>
                    <th className="text-right p-2">Hệ số</th>
                    <th className="text-right p-2">OR</th>
                    <th className="text-right p-2">SE</th>
                    <th className="text-right p-2">z</th>
                    <th className="text-right p-2">p-value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="p-2 font-medium">(Hàng số)</td>
                    <td className="p-2 text-right">{logResult.intercept.toFixed(4)}</td>
                    <td className="p-2 text-right">—</td>
                    <td className="p-2 text-right">{logResult.se["(Intercept)"]?.toFixed(4) ?? "—"}</td>
                    <td className="p-2 text-right">{logResult.zStat["(Intercept)"]?.toFixed(3) ?? "—"}</td>
                    <td className="p-2 text-right">{logResult.pValue["(Intercept)"] != null ? (logResult.pValue["(Intercept)"] < 0.001 ? "< .001" : logResult.pValue["(Intercept)"].toFixed(3)) : "—"}</td>
                  </tr>
                  {logResult.xNames.map((name) => (
                    <tr key={name} className="border-b border-neutral-100 dark:border-neutral-700/50">
                      <td className="p-2 font-medium">{name}</td>
                      <td className="p-2 text-right">{logResult.coefficients[name]?.toFixed(4) ?? "—"}</td>
                      <td className="p-2 text-right">{logResult.oddsRatios[name]?.toFixed(4) ?? "—"}</td>
                      <td className="p-2 text-right">{logResult.se[name]?.toFixed(4) ?? "—"}</td>
                      <td className="p-2 text-right">{logResult.zStat[name]?.toFixed(3) ?? "—"}</td>
                      <td className="p-2 text-right">{logResult.pValue[name] != null ? (logResult.pValue[name] < 0.001 ? "< .001" : logResult.pValue[name].toFixed(3)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 text-neutral-600 dark:text-neutral-400 border-t border-neutral-100">
                Log-likelihood = {logResult.logLikelihood.toFixed(2)}, AIC = {logResult.aic.toFixed(2)}, n = {logResult.n}. Lớp Y: 0 = {logResult.classCounts["0"]}, 1 = {logResult.classCounts["1"]}.
              </p>
            </div>
          )}
        </section>
      )}

      {selectedDataset && numericCols.length >= 2 && analysisBackendAvailable && (
        <section className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Hồi quy Poisson (Y đếm: số nguyên ≥ 0)</h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">Dùng khi Y là biến đếm (số lần, số sự kiện...). IRR = Incidence Rate Ratio = exp(β).</p>
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">Biến phụ thuộc (Y: đếm)</label>
              <select value={poissonYCol} onChange={(e) => { setPoissonYCol(e.target.value); setPoissonResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn Y —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến độc lập (X)</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {numericCols.filter((c) => c !== poissonYCol).map((c) => (
                  <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={poissonXSelected.includes(c)} onChange={() => { togglePoissonX(c); setPoissonResult(null); }} className="rounded" />
                    <span className="text-sm">{c}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="button" onClick={async () => { if (!poissonYCol || poissonXSelected.length === 0) return; const res = await quantisApi.analyzePoisson(rows, poissonYCol, poissonXSelected); setPoissonResult(res ?? null); }} disabled={!poissonYCol || poissonXSelected.length === 0} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy Poisson</button>
          </div>
          {poissonResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm mt-3">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">Biến</th>
                    <th className="text-right p-2">Hệ số</th>
                    <th className="text-right p-2">IRR</th>
                    <th className="text-right p-2">SE</th>
                    <th className="text-right p-2">z</th>
                    <th className="text-right p-2">p-value</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="p-2 font-medium">(Hàng số)</td>
                    <td className="p-2 text-right">{poissonResult.intercept.toFixed(4)}</td>
                    <td className="p-2 text-right">—</td>
                    <td className="p-2 text-right">{poissonResult.se["(Intercept)"]?.toFixed(4) ?? "—"}</td>
                    <td className="p-2 text-right">{poissonResult.zStat["(Intercept)"]?.toFixed(3) ?? "—"}</td>
                    <td className="p-2 text-right">{poissonResult.pValue["(Intercept)"] != null ? (poissonResult.pValue["(Intercept)"] < 0.001 ? "< .001" : poissonResult.pValue["(Intercept)"].toFixed(3)) : "—"}</td>
                  </tr>
                  {poissonResult.xNames.map((name) => (
                    <tr key={name} className="border-b border-neutral-100 dark:border-neutral-700/50">
                      <td className="p-2 font-medium">{name}</td>
                      <td className="p-2 text-right">{poissonResult.coefficients[name]?.toFixed(4) ?? "—"}</td>
                      <td className="p-2 text-right">{poissonResult.irr[name]?.toFixed(4) ?? "—"}</td>
                      <td className="p-2 text-right">{poissonResult.se[name]?.toFixed(4) ?? "—"}</td>
                      <td className="p-2 text-right">{poissonResult.zStat[name]?.toFixed(3) ?? "—"}</td>
                      <td className="p-2 text-right">{poissonResult.pValue[name] != null ? (poissonResult.pValue[name] < 0.001 ? "< .001" : poissonResult.pValue[name].toFixed(3)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 text-neutral-600 dark:text-neutral-400 border-t border-neutral-100">
                Log-likelihood = {poissonResult.logLikelihood.toFixed(2)}, AIC = {poissonResult.aic.toFixed(2)}, n = {poissonResult.n}.
              </p>
            </div>
          )}
        </section>
      )}

      {selectedDataset && numericCols.length >= 2 && analysisBackendAvailable && (
        <section className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/30 dark:bg-sky-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Hồi quy Ridge (L2 regularized)</h3>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">Hồi quy Ridge với penalty L2 (alpha). Phù hợp khi nhiều biến hoặc đa cộng tuyến. Alpha càng lớn hệ số càng co về 0.</p>
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <div>
              <label className="block text-sm font-medium mb-1">Biến phụ thuộc (Y)</label>
              <select value={ridgeYCol} onChange={(e) => { setRidgeYCol(e.target.value); setRidgeResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn Y —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến độc lập (X)</label>
              <div className="flex flex-wrap gap-2 mt-1">
                {numericCols.filter((c) => c !== ridgeYCol).map((c) => (
                  <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={ridgeXSelected.includes(c)} onChange={() => { toggleRidgeX(c); setRidgeResult(null); }} className="rounded" />
                    <span className="text-sm">{c}</span>
                  </label>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Alpha (λ)</label>
              <input type="number" min={0.01} step={0.1} value={ridgeAlpha} onChange={(e) => { setRidgeAlpha(Math.max(0.01, parseFloat(e.target.value) || 1)); setRidgeResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24" />
            </div>
            <button type="button" onClick={async () => { if (!ridgeYCol || ridgeXSelected.length === 0) return; const res = await quantisApi.analyzeRidge(rows, ridgeYCol, ridgeXSelected, ridgeAlpha); setRidgeResult(res ?? null); }} disabled={!ridgeYCol || ridgeXSelected.length === 0} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy Ridge</button>
          </div>
          {ridgeResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm mt-3">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">Biến</th>
                    <th className="text-right p-2">Hệ số</th>
                  </tr>
                </thead>
                <tbody>
                  <tr className="border-b border-neutral-100 dark:border-neutral-700/50">
                    <td className="p-2 font-medium">(Hàng số)</td>
                    <td className="p-2 text-right">{ridgeResult.intercept.toFixed(4)}</td>
                  </tr>
                  {ridgeResult.xNames.map((name) => (
                    <tr key={name} className="border-b border-neutral-100 dark:border-neutral-700/50">
                      <td className="p-2 font-medium">{name}</td>
                      <td className="p-2 text-right">{ridgeResult.coefficients[name]?.toFixed(4) ?? "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 text-neutral-600 dark:text-neutral-400 border-t border-neutral-100">
                R² = {ridgeResult.r2.toFixed(4)}, alpha = {ridgeResult.alpha}, n = {ridgeResult.n}.
              </p>
            </div>
          )}
        </section>
      )}

    </div>
  );
}

function SEMExplainerView({ selectedDataset, analysisBackendAvailable = false }: { selectedDataset: Dataset | undefined; analysisBackendAvailable?: boolean }) {
  const rows = selectedDataset ? getDataRows(selectedDataset) : [];
  const numericCols = rows.length >= 2 ? (selectedDataset?.columnNames ?? []).filter((c) => { const ci = rows[0].indexOf(c); const vals = rows.slice(1).map((r) => r[ci]); return vals.every((v) => v === "" || !Number.isNaN(Number(v))); }) : [];
  const [mediationX, setMediationX] = useState("");
  const [mediationM, setMediationM] = useState("");
  const [mediationY, setMediationY] = useState("");
  const [mediationResult, setMediationResult] = useState<MediationResult | null>(null);
  const [moderationX, setModerationX] = useState("");
  const [moderationM, setModerationM] = useState("");
  const [moderationY, setModerationY] = useState("");
  const [moderationResult, setModerationResult] = useState<OLSResult | null>(null);

  const runMediation = async () => {
    if (!mediationX || !mediationM || !mediationY || !rows.length) return;
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeMediation(rows, mediationX, mediationM, mediationY);
      setMediationResult(res ?? null);
      return;
    }
    const res = computeMediation(rows, mediationX, mediationM, mediationY);
    setMediationResult(res ?? null);
  };
  const runModeration = async () => {
    if (!moderationX || !moderationM || !moderationY || !rows.length) return;
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeModeration(rows, moderationY, moderationX, moderationM);
      setModerationResult(res ?? null);
      return;
    }
    const res = computeModeration(rows, moderationY, moderationX, moderationM);
    setModerationResult(res ?? null);
  };

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">SEM — Mô hình cấu trúc</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">
        Mediation (X → M → Y), Moderation (tương tác X×M ảnh hưởng lên Y). Phân tích trung gian và điều tiết.
      </p>
      {analysisBackendAvailable && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-4 flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5" /> Mediation &amp; Moderation chạy trên backend Python (statsmodels)
        </p>
      )}
      <div className="mb-4">
        <AIAssistPanel
          metadata={selectedDataset ? `Dataset: ${selectedDataset.name}. Số cột số: ${numericCols.length}.` : undefined}
          context="SEM: Mediation (X → M → Y — M là trung gian) và Moderation (tương tác X×M ảnh hưởng lên Y). Chọn X, M, Y rồi Chạy từng phân tích."
          quickPrompts={[{ label: "Giải thích Mediation vs Moderation", systemHint: "Bạn là chuyên gia SEM. So sánh Mediation (M nằm giữa X và Y) và Moderation (M điều tiết ảnh hưởng của X lên Y). Trả lời ngắn gọn bằng tiếng Việt." }]}
          title="Hỏi AI về SEM"
        />
      </div>

      {selectedDataset && numericCols.length >= 3 && (
        <section className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/30 dark:bg-sky-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Phân tích trung gian (Mediation: X → M → Y)</h3>
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <select value={mediationX} onChange={(e) => { setMediationX(e.target.value); setMediationResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">X (độc lập)</option>
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-neutral-500" aria-hidden="true">→</span>
            <select value={mediationM} onChange={(e) => { setMediationM(e.target.value); setMediationResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">M (trung gian)</option>
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <span className="text-neutral-500" aria-hidden="true">→</span>
            <select value={mediationY} onChange={(e) => { setMediationY(e.target.value); setMediationResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">Y (phụ thuộc)</option>
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" onClick={runMediation} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Chạy Mediation</button>
          </div>
          {mediationResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm mt-3">
              <AIAssistPanel
                context={`Mediation Baron-Kenny: a=${mediationResult.a.toFixed(3)} (p ${mediationResult.aP < 0.001 ? "<.001" : mediationResult.aP.toFixed(3)}), b=${mediationResult.b.toFixed(3)} (p ${mediationResult.bP < 0.001 ? "<.001" : mediationResult.bP.toFixed(3)}), c=${mediationResult.c.toFixed(3)}, c'=${mediationResult.cPrime.toFixed(3)}, gián tiếp=${mediationResult.indirectEffect.toFixed(3)}, % trung gian=${mediationResult.pctMediated.toFixed(1)}%.`}
                quickPrompts={[{ label: "Diễn giải mediation", systemHint: "Bạn là chuyên gia phân tích trung gian (mediation). Giải thích đường a (X→M), b (M→Y), c (tổng X→Y), c' (trực tiếp); hiệu ứng gián tiếp và % trung gian. Nêu ý nghĩa M làm trung gian mối quan hệ X–Y. Trả lời ngắn gọn bằng tiếng Việt." }]}
                title="Hỏi AI về mediation"
              />
              <p className="font-medium mb-2">Baron-Kenny: a (X→M) = {mediationResult.a.toFixed(4)} (p={mediationResult.aP < 0.001 ? "<.001" : mediationResult.aP.toFixed(3)}), b (M→Y) = {mediationResult.b.toFixed(4)} (p={mediationResult.bP < 0.001 ? "<.001" : mediationResult.bP.toFixed(3)}), c (X→Y tổng) = {mediationResult.c.toFixed(4)}, c&apos; (trực tiếp) = {mediationResult.cPrime.toFixed(4)}. Hiệu ứng gián tiếp = {mediationResult.indirectEffect.toFixed(4)}, % trung gian = {mediationResult.pctMediated.toFixed(1)}%.</p>
            </div>
          )}
        </section>
      )}

      {selectedDataset && numericCols.length >= 3 && (
        <section className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10 p-4 mb-6">
          <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Phân tích điều tiết (Moderation: Y ~ X + M + X×M)</h3>
          <div className="flex flex-wrap gap-4 items-end mb-3">
            <select value={moderationX} onChange={(e) => { setModerationX(e.target.value); setModerationResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">X (độc lập)</option>
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={moderationM} onChange={(e) => { setModerationM(e.target.value); setModerationResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">M (điều tiết)</option>
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select value={moderationY} onChange={(e) => { setModerationY(e.target.value); setModerationResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">Y (phụ thuộc)</option>
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <button type="button" onClick={runModeration} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Chạy Moderation</button>
          </div>
          {moderationResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm mt-3">
              <AIAssistPanel
                context={`Moderation: R² = ${moderationResult.r2.toFixed(3)}, n = ${moderationResult.n}. Biến: ${moderationResult.xNames.join(", ")}. Hệ số tương tác p < 0.05 → có điều tiết.`}
                quickPrompts={[{ label: "Diễn giải moderation", systemHint: "Bạn là chuyên gia phân tích điều tiết (moderation). Giải thích: tương tác giữa X và M (biến điều tiết) ảnh hưởng lên Y; khi nào điều tiết có ý nghĩa (hệ số tương tác p<0.05). Nêu cách đọc và báo cáo. Trả lời ngắn gọn bằng tiếng Việt." }]}
                title="Hỏi AI về moderation"
              />
              <table className="w-full">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-700">
                    <th className="text-left p-2">Biến</th>
                    <th className="text-right p-2">Hệ số</th>
                    <th className="text-right p-2">SE</th>
                    <th className="text-right p-2">t</th>
                    <th className="text-right p-2">p-value</th>
                  </tr>
                </thead>
                <tbody>
                  {["(Intercept)", ...moderationResult.xNames].map((name) => (
                    <tr key={name} className="border-b border-neutral-100 dark:border-neutral-700/50">
                      <td className="p-2 font-medium">{name}</td>
                      <td className="p-2 text-right">{name === "(Intercept)" ? moderationResult.intercept.toFixed(4) : moderationResult.coefficients[name]?.toFixed(4) ?? "—"}</td>
                      <td className="p-2 text-right">{moderationResult.se[name]?.toFixed(4) ?? "—"}</td>
                      <td className="p-2 text-right">{moderationResult.tStat[name]?.toFixed(3) ?? "—"}</td>
                      <td className="p-2 text-right">{moderationResult.pValue[name] != null ? (moderationResult.pValue[name] < 0.001 ? "< .001" : moderationResult.pValue[name].toFixed(3)) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p className="p-2 text-neutral-600 dark:text-neutral-400 border-t border-neutral-100">R² = {moderationResult.r2.toFixed(4)}, n = {moderationResult.n}. Hệ số tương tác (X×M) p &lt; 0.05 → có điều tiết.</p>
            </div>
          )}
        </section>
      )}
      {(!selectedDataset || numericCols.length < 3) && (
        <p className="text-neutral-500">Chọn bộ dữ liệu có ít nhất 3 cột số để chạy Mediation và Moderation.</p>
      )}
    </div>
  );
}

type MLSubTab = "clustering" | "classification" | "explainability";

function MLTab({ selectedDataset, analysisBackendAvailable = false }: { selectedDataset: Dataset; analysisBackendAvailable?: boolean }) {
  const rows = getDataRows(selectedDataset);
  const cols = selectedDataset.columnNames ?? [];
  const numericCols = rows.length >= 2 ? cols.filter((c) => { const ci = rows[0].indexOf(c); const vals = rows.slice(1).map((r) => r[ci]); return vals.every((v) => v === "" || !Number.isNaN(Number(v))); }) : [];
  const categoricalCols = rows.length >= 2 ? cols.filter((c) => { const ci = rows[0].indexOf(c); const vals = rows.slice(1).map((r) => String(r[ci] ?? "").trim()).filter(Boolean); return vals.length > 0 && [...new Set(vals)].length >= 2 && [...new Set(vals)].length <= 20; }) : [];
  const [mlSubTab, setMlSubTab] = useState<MLSubTab>("classification");
  const [selectedCols, setSelectedCols] = useState<string[]>([]);
  const [K, setK] = useState(3);
  const [kmeansResult, setKmeansResult] = useState<KMeansResult | null>(null);
  const [classTargetCol, setClassTargetCol] = useState("");
  const [classFeatureCols, setClassFeatureCols] = useState<string[]>([]);
  const [multiclassResult, setMulticlassResult] = useState<MulticlassLogisticResult | null>(null);
  const [permutationN, setPermutationN] = useState(5);
  const [permutationResult, setPermutationResult] = useState<{ feature: string; importance: number; std?: number }[] | null>(null);
  const toggleCol = (c: string) => setSelectedCols((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  const toggleClassFeature = (c: string) => setClassFeatureCols((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  const runKMeans = async () => {
    if (selectedCols.length < 2 || K < 2) return;
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeKMeans(rows, selectedCols, K);
      setKmeansResult(res ?? null);
      return;
    }
    const res = computeKMeans(rows, selectedCols, K);
    setKmeansResult(res ?? null);
  };
  const runClassification = () => {
    if (!classTargetCol || classFeatureCols.length < 1) return;
    const res = computeMulticlassLogisticOneVsRest(rows, classTargetCol, classFeatureCols);
    setMulticlassResult(res ?? null);
    setPermutationResult(null);
  };
  const runPermutationImportance = () => {
    if (!multiclassResult || !classTargetCol || classFeatureCols.length < 1) return;
    const res = computePermutationImportanceMulticlass(rows, classTargetCol, classFeatureCols, Math.max(1, Math.min(20, permutationN)));
    setPermutationResult(res ?? null);
  };
  const importanceFromCoeffs = multiclassResult ? computeFeatureImportanceFromMulticlass(multiclassResult) : [];

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">Học máy</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">Phân cụm (K-means), phân loại đa lớp (One-vs-Rest logistic), đánh giá mô hình (confusion matrix, precision/recall/F1), và giải thích (feature importance, permutation importance).</p>
      {analysisBackendAvailable && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5" /> K-means chạy trên backend Python (sklearn)
        </p>
      )}
      <div className="mb-4">
        <AIAssistPanel
          metadata={selectedDataset ? `Dataset: ${selectedDataset.name}. Cột số: ${numericCols.length}, cột phân loại: ${categoricalCols.length}.` : undefined}
          context="Học máy: K-means (phân cụm), Phân loại đa lớp (One-vs-Rest logistic), Feature importance và Permutation importance (giải thích mô hình)."
          quickPrompts={[{ label: "Gợi ý chọn K (K-means) và diễn giải", systemHint: "Bạn là chuyên gia ML. Gợi ý cách chọn số cụm K (elbow, silhouette), diễn giải centroid và phân loại. Trả lời ngắn gọn bằng tiếng Việt." }]}
          title="Hỏi AI về học máy"
        />
      </div>

      <div className="flex gap-2 mb-4 border-b border-neutral-200 dark:border-neutral-700 pb-2">
        <button type="button" onClick={() => setMlSubTab("clustering")} className={`rounded-lg px-3 py-1.5 text-sm ${mlSubTab === "clustering" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>K-means (phân cụm)</button>
        <button type="button" onClick={() => setMlSubTab("classification")} className={`rounded-lg px-3 py-1.5 text-sm ${mlSubTab === "classification" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Phân loại đa lớp</button>
        <button type="button" onClick={() => setMlSubTab("explainability")} className={`rounded-lg px-3 py-1.5 text-sm ${mlSubTab === "explainability" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Feature importance / Giải thích</button>
      </div>

      {mlSubTab === "clustering" && (
        <>
          {numericCols.length >= 2 ? (
            <>
              <div className="flex flex-wrap gap-2 mb-3">
                <span className="text-sm font-medium">Cột (biến):</span>
                {numericCols.map((c) => (
                  <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={selectedCols.includes(c)} onChange={() => toggleCol(c)} className="rounded" />
                    <span className="text-sm">{c}</span>
                  </label>
                ))}
              </div>
              <div className="flex flex-wrap gap-4 items-end mb-4">
                <div>
                  <label className="block text-sm font-medium mb-1">Số cụm (K)</label>
                  <input type="number" min={2} max={20} value={K} onChange={(e) => { setK(Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 2))); setKmeansResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
                </div>
                <button type="button" onClick={runKMeans} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Chạy K-means</button>
              </div>
              {kmeansResult && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
                  <AIAssistPanel
                    context={`K-means: ${kmeansResult.centroids.length} cụm, ${kmeansResult.iterations} lần lặp, Within-SS = ${kmeansResult.withinSS.toFixed(2)}. Centroids từng cụm: ${kmeansResult.centroids.map((c, i) => `Cụm ${i + 1}: [${c.map((v) => v.toFixed(2)).join(", ")}]`).join("; ")}.`}
                    quickPrompts={[{ label: "Diễn giải K-means", systemHint: "Bạn là chuyên gia phân cụm (clustering). Giải thích kết quả K-means: số cụm, tâm (centroid) từng cụm trên từng biến, Within-SS. Gợi ý cách đặt tên/đặc trưng từng cụm dựa trên centroid. Trả lời ngắn gọn bằng tiếng Việt." }]}
                    title="Hỏi AI về K-means"
                  />
                  <p className="font-medium mb-2">Kết quả K-means (sau {kmeansResult.iterations} lần lặp, Within-SS = {kmeansResult.withinSS.toFixed(2)})</p>
                  <p className="text-neutral-600 dark:text-neutral-400 mb-2">Centroids:</p>
                  <table className="w-full">
                    <thead><tr className="border-b border-neutral-200 dark:border-neutral-700"><th className="text-left p-2">Cụm</th>{selectedCols.map((c) => <th key={c} className="text-right p-2">{c}</th>)}</tr></thead>
                    <tbody>
                      {kmeansResult.centroids.map((cent, k) => (
                        <tr key={k} className="border-b border-neutral-100 dark:border-neutral-700/50">
                          <td className="p-2 font-medium">{k + 1}</td>
                          {cent.map((v, d) => <td key={d} className="p-2 text-right">{v.toFixed(4)}</td>)}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                  <p className="mt-2 text-neutral-500">Số điểm theo cụm: {Array.from({ length: K }, (_, k) => kmeansResult.assignments.filter((a) => a === k).length).join(", ")}</p>
                </div>
              )}
            </>
          ) : (
            <p className="text-neutral-500">Cần ít nhất 2 cột số. Chọn dataset có cột số.</p>
          )}
        </>
      )}

      {mlSubTab === "classification" && (
        <>
          {categoricalCols.length >= 1 && numericCols.length >= 1 ? (
            <>
              <div className="mb-4">
                <label className="block text-sm font-medium mb-1">Biến mục tiêu (nhãn phân loại)</label>
                <select value={classTargetCol} onChange={(e) => { setClassTargetCol(e.target.value); setMulticlassResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                  <option value="">— Chọn cột nhãn —</option>
                  {categoricalCols.map((c) => (
                    <option key={c} value={c}>{c} ({getUniqueValues(rows, c).length} lớp)</option>
                  ))}
                </select>
              </div>
              <div className="flex flex-wrap gap-2 mb-4">
                <span className="text-sm font-medium w-full">Biến dự đoán (số, chọn ít nhất 1):</span>
                {numericCols.filter((c) => c !== classTargetCol).map((c) => (
                  <label key={c} className="flex items-center gap-1.5 cursor-pointer">
                    <input type="checkbox" checked={classFeatureCols.includes(c)} onChange={() => { toggleClassFeature(c); setMulticlassResult(null); }} className="rounded" />
                    <span className="text-sm">{c}</span>
                  </label>
                ))}
              </div>
              <button type="button" onClick={runClassification} disabled={!classTargetCol || classFeatureCols.length < 1} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy phân loại (One-vs-Rest logistic)</button>
              {multiclassResult && (
                <div className="mt-6 space-y-6">
                  <AIAssistPanel
                    context={`Phân loại đa lớp: Accuracy ${(multiclassResult.metrics.accuracy * 100).toFixed(2)}%, Macro F1 = ${multiclassResult.metrics.macroF1.toFixed(3)}, Weighted F1 = ${multiclassResult.metrics.weightedF1.toFixed(3)}. Theo lớp: ${multiclassResult.metrics.perClass.map((p) => `${p.label}: P=${p.precision.toFixed(2)}, R=${p.recall.toFixed(2)}, F1=${p.f1.toFixed(2)}`).join("; ")}.`}
                    quickPrompts={[{ label: "Diễn giải phân loại đa lớp", systemHint: "Bạn là chuyên gia học máy. Giải thích kết quả phân loại đa lớp: accuracy tổng thể, macro/weighted F1, precision/recall/F1 theo từng lớp; ma trận nhầm lẫn. Nêu lớp nào được dự đoán tốt/kém. Trả lời ngắn gọn bằng tiếng Việt." }]}
                    title="Hỏi AI về phân loại đa lớp"
                  />
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
                    <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">Báo cáo phân loại</p>
                    <p className="p-2 text-neutral-600 dark:text-neutral-400">Accuracy: {(multiclassResult.metrics.accuracy * 100).toFixed(2)}% ? Macro F1: {multiclassResult.metrics.macroF1.toFixed(4)} ? Weighted F1: {multiclassResult.metrics.weightedF1.toFixed(4)}</p>
                    <table className="w-full">
                      <thead><tr className="border-b border-neutral-200 dark:border-neutral-700"><th className="text-left p-2">Lớp</th><th className="text-right p-2">Precision</th><th className="text-right p-2">Recall</th><th className="text-right p-2">F1</th><th className="text-right p-2">Support</th></tr></thead>
                      <tbody>
                        {multiclassResult.metrics.perClass.map((p) => (
                          <tr key={p.label} className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-2 font-medium">{p.label}</td>
                            <td className="p-2 text-right">{p.precision.toFixed(4)}</td>
                            <td className="p-2 text-right">{p.recall.toFixed(4)}</td>
                            <td className="p-2 text-right">{p.f1.toFixed(4)}</td>
                            <td className="p-2 text-right">{p.support}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
                    <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">Ma trận nhóm lần (hàng = thực tế, cột = dự đoán)</p>
                    <table className="w-full">
                      <thead>
                        <tr className="border-b border-neutral-200 dark:border-neutral-700">
                          <th className="text-left p-2"></th>
                          {multiclassResult.confusionMatrix.labels.map((l) => <th key={l} className="text-right p-2">{l}</th>)}
                        </tr>
                      </thead>
                      <tbody>
                        {multiclassResult.confusionMatrix.matrix.map((row, i) => (
                          <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-2 font-medium">{multiclassResult.confusionMatrix.labels[i]}</td>
                            {row.map((v, j) => <td key={j} className="p-2 text-right">{v}</td>)}
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </div>
              )}
            </>
          ) : (
            <p className="text-neutral-500">Cần ít nhất 1 cột phân loại (2–20 giá trị) và 1 cột số để làm biến dự đoán.</p>
          )}
        </>
      )}

      {mlSubTab === "explainability" && (
        <>
          <p className="text-neutral-600 dark:text-neutral-400 mb-4">Độ quan trọng biến (feature importance): từ hệ số hồi quy One-vs-Rest hoặc permutation importance (shuffle từng cột, đo độ giảm accuracy). Chạy phân loại trước để có mô hình.</p>
          {multiclassResult ? (
            <div className="space-y-6">
              <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-900/10 p-4">
                <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Feature importance (từ hệ số mô hình)</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">Trung bình |hệ số| theo từng lớp One-vs-Rest ? biến có importance cao ảnh hưởng mạnh tới dự đoán.</p>
                {importanceFromCoeffs.length > 0 && (
                  <AIAssistPanel
                    context={`Feature importance từ hệ số: ${importanceFromCoeffs.map(({ feature, importance }) => `${feature}=${importance.toFixed(3)}`).join("; ")}.`}
                    quickPrompts={[{ label: "Diễn giải feature importance", systemHint: "Bạn là chuyên gia học máy. Giải thích feature importance (từ hệ số mô hình): biến nào đóng góp nhiều/ít vào dự đoán phân loại; xếp hạng biến quan trọng. Trả lời ngắn gọn bằng tiếng Việt." }]}
                    title="Hỏi AI về feature importance"
                  />
                )}
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead><tr className="border-b border-neutral-200 dark:border-neutral-700"><th className="text-left p-2">Biến</th><th className="text-right p-2">Importance</th></tr></thead>
                    <tbody>
                      {importanceFromCoeffs.map(({ feature, importance }) => (
                        <tr key={feature} className="border-b border-neutral-100 dark:border-neutral-700/50">
                          <td className="p-2 font-medium">{feature}</td>
                          <td className="p-2 text-right">{importance.toFixed(4)}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {importanceFromCoeffs.length > 0 && (
                  <div className="mt-3 h-48">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={importanceFromCoeffs.map((d) => ({ name: d.feature.length > 18 ? d.feature.slice(0, 16) + "?" : d.feature, value: d.importance }))} layout="vertical" margin={{ left: 4, right: 4 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis type="number" />
                        <YAxis type="category" dataKey="name" width={120} tick={{ fontSize: 10 }} />
                        <Tooltip />
                        <Bar dataKey="value" fill="#0061bb" name="Importance" />
                      </BarChart>
                    </ResponsiveContainer>
                  </div>
                )}
              </div>
              <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
                <h3 className="font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Permutation importance</h3>
                <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">Shuffle từng cột rồi dự đoán lại; importance = độ giảm accuracy. Số lần shuffle:</p>
                <div className="flex flex-wrap gap-4 items-end mb-3">
                  <input type="number" min={1} max={20} value={permutationN} onChange={(e) => { setPermutationN(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))); setPermutationResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
                  <button type="button" onClick={runPermutationImportance} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Từnh permutation importance</button>
                </div>
                {permutationResult && (
                  <div className="overflow-x-auto mt-2">
                    <AIAssistPanel
                      context={`Permutation importance (độ giảm accuracy khi shuffle): ${permutationResult.map(({ feature, importance }) => `${feature}=${importance.toFixed(3)}`).join("; ")}.`}
                      quickPrompts={[{ label: "Diễn giải permutation importance", systemHint: "Bạn là chuyên gia học máy. Giải thích permutation importance: độ giảm accuracy khi xáo trộn từng biến — biến nào quan trọng nhất cho dự đoán. So sánh với feature importance từ hệ số nếu có. Trả lời ngắn gọn bằng tiếng Việt." }]}
                      title="Hỏi AI về permutation importance"
                    />
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-neutral-200 dark:border-neutral-700"><th className="text-left p-2">Biến</th><th className="text-right p-2">Importance (? accuracy)</th><th className="text-right p-2">Std</th></tr></thead>
                      <tbody>
                        {permutationResult.map(({ feature, importance, std }) => (
                          <tr key={feature} className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-2 font-medium">{feature}</td>
                            <td className="p-2 text-right">{importance.toFixed(4)}</td>
                            <td className="p-2 text-right">{std != null ? std.toFixed(4) : "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </div>
            </div>
          ) : (
            <p className="text-neutral-500">Chạy phân loại đa lớp trước (tab &quot;Phân loại đa lớp&quot;) để có mô hình và xem feature importance.</p>
          )}
        </>
      )}
    </div>
  );
}

function BayesianTab({ selectedDataset, analysisBackendAvailable = false }: { selectedDataset: Dataset; analysisBackendAvailable?: boolean }) {
  const [successes, setSuccesses] = useState(10);
  const [n, setN] = useState(50);
  const [priorAlpha, setPriorAlpha] = useState(1);
  const [priorBeta, setPriorBeta] = useState(1);
  const [result, setResult] = useState<BetaPosteriorResult | null>(null);
  const runBeta = async () => {
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeBetaPosterior(successes, n, priorAlpha, priorBeta);
      setResult(res ?? null);
      return;
    }
    const res = computeBetaPosterior(successes, n, priorAlpha, priorBeta);
    setResult(res);
  };
  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">Bayesian</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">ước lượng tỉ lệ (proportion) với prior Beta: posterior Beta-Binomial, khoảng tin cậy 95%.</p>
      {analysisBackendAvailable && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5" /> Beta posterior từ backend Python
        </p>
      )}
      <div className="mb-4">
        <AIAssistPanel
          context="Bayesian: ước lượng tỉ lệ (proportion) với prior Beta, posterior Beta-Binomial. Nhập số lần thành công và tổng n, prior α và β (mặc định 1,1)."
          quickPrompts={[{ label: "Giải thích prior và posterior Beta", systemHint: "Bạn là chuyên gia thống kê Bayesian. Giải thích prior Beta, posterior sau khi quan sát dữ liệu, khoảng tin cậy 95%. Trả lời ngắn gọn bằng tiếng Việt." }]}
          title="Hỏi AI về Bayesian"
        />
      </div>
      <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-900/20 p-4 mb-4">
        <h3 className="font-medium text-sky-800 dark:text-sky-200 mb-3">Beta-Binomial: tỉ lệ (proportion)</h3>
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">Số lần thành công</label>
            <input type="number" min={0} value={successes} onChange={(e) => { setSuccesses(Math.max(0, parseInt(e.target.value, 10) || 0)); setResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Tổng số (n)</label>
            <input type="number" min={1} value={n} onChange={(e) => { setN(Math.max(1, parseInt(e.target.value, 10) || 1)); setResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prior ? (Beta)</label>
            <input type="number" min={0.01} step={0.5} value={priorAlpha} onChange={(e) => { setPriorAlpha(Math.max(0.01, parseFloat(e.target.value) || 1)); setResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">Prior ? (Beta)</label>
            <input type="number" min={0.01} step={0.5} value={priorBeta} onChange={(e) => { setPriorBeta(Math.max(0.01, parseFloat(e.target.value) || 1)); setResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
          </div>
          <button type="button" onClick={runBeta} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Từnh posterior</button>
        </div>
        {result && (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm mt-2">
            <AIAssistPanel
              context={`Posterior Beta(α=${result.postAlpha.toFixed(2)}, β=${result.postBeta.toFixed(2)}). Trung bình (tỉ lệ) = ${result.mean.toFixed(4)}, phương sai = ${result.variance.toFixed(6)}, 95% CI = [${result.ci95Lower.toFixed(4)}, ${result.ci95Upper.toFixed(4)}]. Dữ liệu: ${n} trials, ${successes} thành công.`}
              quickPrompts={[{ label: "Diễn giải posterior Beta", systemHint: "Bạn là chuyên gia thống kê Bayesian. Giải thích: posterior Beta sau khi quan sát dữ liệu, trung bình (ước lượng tỉ lệ), khoảng tin cậy 95%; so sánh với prior. Trả lời ngắn gọn bằng tiếng Việt." }]}
              title="Hỏi AI về Bayesian Beta"
            />
            <p className="font-medium mb-1">Posterior Beta(? = {result.postAlpha.toFixed(2)}, ? = {result.postBeta.toFixed(2)})</p>
            <p>Trung bình (tỉ lệ đọc lượng) = {result.mean.toFixed(4)}</p>
            <p>Pướng sai = {result.variance.toFixed(6)}</p>
            <p>Khoảng tin cậy 95%: [{result.ci95Lower.toFixed(4)}, {result.ci95Upper.toFixed(4)}]</p>
          </div>
        )}
      </div>
      <p className="text-sm text-neutral-500">Các mô hình Bayesian nâng cao (MCMC, Bayes Factor) sẽ được bổ sung trong bản cập nhật tới.</p>
    </div>
  );
}

function HypothesisTab({ selectedDataset, onHypothesisResult, analysisBackendAvailable = false }: { selectedDataset: Dataset; onHypothesisResult?: (r: { type: "ttest" | "chisquare" | "anova" | "mannwhitney"; payload: TTestResult | ChiSquareResult | ANOVAResult | MannWhitneyResult; meta?: Record<string, string> } | null) => void; analysisBackendAvailable?: boolean }) {
  const rows = getDataRows(selectedDataset);
  const [testKind, setTestKind] = useState<"ttest" | "chisquare" | "anova" | "kruskal" | "nonparametric" | "normality" | "power" | "paired" | "wilcoxon_paired" | "friedman" | "levene" | "mcnemar" | "fisher" | "onesample_ttest" | "binomial" | "twoprop" | "sign_test" | "ftest" | "ztest_means">("ttest");
  const [groupCol, setGroupCol] = useState("");
  const [groupVal1, setGroupVal1] = useState("");
  const [groupVal2, setGroupVal2] = useState("");
  const [numCol, setNumCol] = useState("");
  const [ttestEqualVar, setTtestEqualVar] = useState(false);
  const [tResult, setTResult] = useState<TTestResult | null>(null);
  const [pairedCol1, setPairedCol1] = useState("");
  const [pairedCol2, setPairedCol2] = useState("");
  const [pairedResult, setPairedResult] = useState<PairedTTestResult | null>(null);
  const [wilcoxonPairedResult, setWilcoxonPairedResult] = useState<WilcoxonSignedRankResult | null>(null);
  const [friedmanCols, setFriedmanCols] = useState<string[]>([]);
  const [friedmanResult, setFriedmanResult] = useState<FriedmanResult | null>(null);
  const [leveneGroupCol, setLeveneGroupCol] = useState("");
  const [leveneValueCol, setLeveneValueCol] = useState("");
  const [leveneResult, setLeveneResult] = useState<LeveneResult | null>(null);
  const [mcnemarCol1, setMcNemarCol1] = useState("");
  const [mcnemarCol2, setMcNemarCol2] = useState("");
  const [mcnemarResult, setMcNemarResult] = useState<McNemarResult | null>(null);
  const [fisherCol1, setFisherCol1] = useState("");
  const [fisherCol2, setFisherCol2] = useState("");
  const [fisherResult, setFisherResult] = useState<FisherExactResult | null>(null);
  const [onesampleCol, setOnesampleCol] = useState("");
  const [onesampleMu0, setOnesampleMu0] = useState("");
  const [onesampleResult, setOnesampleResult] = useState<OneSampleTTestResult | null>(null);
  const [binomialCol, setBinomialCol] = useState("");
  const [binomialP0, setBinomialP0] = useState("0.5");
  const [binomialResult, setBinomialResult] = useState<BinomialTestResult | null>(null);
  const [twopropGroupCol, setTwopropGroupCol] = useState("");
  const [twopropGroupVal1, setTwopropGroupVal1] = useState("");
  const [twopropGroupVal2, setTwopropGroupVal2] = useState("");
  const [twopropOutcomeCol, setTwopropOutcomeCol] = useState("");
  const [twopropResult, setTwopropResult] = useState<TwoProportionZTestResult | null>(null);
  const [signTestCol1, setSignTestCol1] = useState("");
  const [signTestCol2, setSignTestCol2] = useState("");
  const [signTestResult, setSignTestResult] = useState<SignTestResult | null>(null);
  const [ftestResult, setFtestResult] = useState<{ f: number; pValue: number; df1: number; df2: number; var1: number; var2: number; n1: number; n2: number } | null>(null);
  const [ztestMeansResult, setZtestMeansResult] = useState<{ z: number; pValue: number; mean1: number; mean2: number; n1: number; n2: number; knownVar1: number; knownVar2: number } | null>(null);
  const [ztestKnownVar1, setZtestKnownVar1] = useState("");
  const [ztestKnownVar2, setZtestKnownVar2] = useState("");
  const [chiCol1, setChiCol1] = useState("");
  const [chiCol2, setChiCol2] = useState("");
  const [chiResult, setChiResult] = useState<ChiSquareResult | null>(null);
  const [anovaFactorCol, setAnovaFactorCol] = useState("");
  const [anovaValueCol, setAnovaValueCol] = useState("");
  const [anovaResult, setAnovaResult] = useState<ANOVAResult | null>(null);
  const [kruskalResult, setKruskalResult] = useState<{ h: number; pValue: number; df: number; nGroups: number; groupMedians: { group: string; n: number; median: number; mean: number; std: number }[] } | null>(null);
  const [mannWhitneyResult, setMannWhitneyResult] = useState<MannWhitneyResult | null>(null);
  const [normalityCol, setNormalityCol] = useState("");
  const [shapiroResult, setShapiroResult] = useState<ShapiroWilkResult | null>(null);
  const [effectSizeD, setEffectSizeD] = useState(0.5);
  const [powerResult, setPowerResult] = useState<{ nRequired: number; power: number; effectSize: number; alpha: number } | null>(null);
  const [sampleSizeKind, setSampleSizeKind] = useState<"ttest" | "proportion" | "chisquare" | "anova" | "regression">("ttest");
  const [proportionP0, setProportionP0] = useState(0.5);
  const [proportionP1, setProportionP1] = useState(0.65);
  const [chiEffectW, setChiEffectW] = useState(0.3);
  const [chiDf, setChiDf] = useState(1);
  const [anovaK, setAnovaK] = useState(3);
  const [anovaF, setAnovaF] = useState(0.25);
  const [regressionP, setRegressionP] = useState(5);
  const [regressionRule, setRegressionRule] = useState<"10" | "20">("10");
  const [sampleSizeExtra, setSampleSizeExtra] = useState<SampleSizeProportionResult | SampleSizeChiSquareResult | SampleSizeAnovaResult | SampleSizeRegressionResult | null>(null);
  const [pairwisePosthocBackendResult, setPairwisePosthocBackendResult] = useState<Array<{ group1: string; group2: string; meanDiff: number; t: number; df: number; p: number; pBonferroni: number }> | null>(null);
  const cols = selectedDataset.columnNames || [];
  const groupValues = groupCol ? getUniqueValues(rows, groupCol) : [];
  const numericCols = rows.length >= 2 ? cols.filter((c) => { const ci = rows[0].indexOf(c); const vals = rows.slice(1).map((r) => r[ci]); return vals.every((v) => v === "" || !Number.isNaN(Number(v))); }) : [];

  const hypothesisMetadata = useMemo(() => {
    const n = rows.length;
    const colList = cols.length <= 20 ? cols.join(", ") : cols.slice(0, 18).join(", ") + ", ...";
    return `Dataset: ${selectedDataset.name}. Số hàng: ${n}, số cột: ${cols.length}. Các cột: ${colList}.`;
  }, [selectedDataset.name, selectedDataset.rows, rows.length, cols]);

  const hypothesisProcess = useMemo(() => {
    if (tResult) return `Phương pháp: t-test hai mẫu độc lập (Welch). Biến nhóm: ${groupCol}, so sánh nhóm "${groupVal1}" vs "${groupVal2}". Biến số: ${numCol}.`;
    if (chiResult) return `Phương pháp: Kiểm định Chi-square độc lập. Biến 1: ${chiCol1}, Biến 2: ${chiCol2}.`;
    if (anovaResult) return `Phương pháp: ANOVA một nhân tố. Nhân tố: ${anovaFactorCol}, biến phụ thuộc: ${anovaValueCol}.`;
    if (mannWhitneyResult) return `Phương pháp: Mann-Whitney U (non-parametric). Biến nhóm: ${groupCol}, nhóm "${groupVal1}" vs "${groupVal2}". Biến số: ${numCol}.`;
    if (pairedResult) return `Phương pháp: t-test hai mẫu phụ thuộc (cặp). Cột 1: ${pairedCol1}, Cột 2: ${pairedCol2}.`;
    if (kruskalResult) return `Phương pháp: Kruskal-Wallis H (non-parametric, nhiều nhóm). Nhân tố: ${anovaFactorCol}, biến số: ${anovaValueCol}.`;
    if (wilcoxonPairedResult) return `Phương pháp: Wilcoxon signed-rank (cặp). Cột 1: ${pairedCol1}, Cột 2: ${pairedCol2}.`;
    if (friedmanResult) return `Phương pháp: Friedman (nhiều điều kiện phụ thuộc). Các cột: ${friedmanCols.join(", ")}.`;
    if (leveneResult) return `Phương pháp: Levene (đồng phương sai). Biến nhóm: ${leveneGroupCol}, biến số: ${leveneValueCol}.`;
    if (mcnemarResult) return `Phương pháp: McNemar (cặp nhị phân). Biến 1: ${mcnemarCol1}, Biến 2: ${mcnemarCol2}.`;
    if (fisherResult) return `Phương pháp: Fisher exact (bảng 2x2). Biến 1: ${fisherCol1}, Biến 2: ${fisherCol2}.`;
    if (onesampleResult) return `Phương pháp: t-test một mẫu. Biến số: ${onesampleCol}, giá trị so sánh μ0 = ${onesampleMu0}.`;
    if (binomialResult) return `Phương pháp: Kiểm định tỉ lệ (Binomial). Biến: ${binomialCol}, p0 = ${binomialP0}.`;
    if (twopropResult) return `Phương pháp: Z-test hai tỉ lệ. Nhóm: ${twopropGroupCol} (${twopropGroupVal1} vs ${twopropGroupVal2}), biến kết quả: ${twopropOutcomeCol}.`;
    if (signTestResult) return `Phương pháp: Sign test (cặp). Cột 1: ${signTestCol1}, Cột 2: ${signTestCol2}.`;
    if (shapiroResult) return `Phương pháp: Shapiro-Wilk (kiểm định phân phối chuẩn). Biến số: ${normalityCol}.`;
    if (powerResult) return `Phương pháp: Power analysis (cỡ mẫu t-test). Effect size d = ${effectSizeD}, α = ${powerResult.alpha}, power = ${(powerResult.power * 100).toFixed(0)}%.`;
    return "";
  }, [tResult, chiResult, anovaResult, mannWhitneyResult, pairedResult, kruskalResult, wilcoxonPairedResult, friedmanResult, leveneResult, mcnemarResult, fisherResult, onesampleResult, binomialResult, twopropResult, signTestResult, shapiroResult, powerResult, groupCol, groupVal1, groupVal2, numCol, chiCol1, chiCol2, anovaFactorCol, anovaValueCol, pairedCol1, pairedCol2, friedmanCols, leveneGroupCol, leveneValueCol, mcnemarCol1, mcnemarCol2, fisherCol1, fisherCol2, onesampleCol, onesampleMu0, binomialCol, binomialP0, twopropGroupCol, twopropGroupVal1, twopropGroupVal2, twopropOutcomeCol, signTestCol1, signTestCol2, normalityCol, effectSizeD]);

  const hypothesisResultContext = useMemo(() => {
    if (tResult) return `t-test: t=${tResult.t.toFixed(2)}, df=${tResult.df.toFixed(1)}, p=${tResult.pValue < 0.001 ? "<.001" : tResult.pValue.toFixed(3)}, Cohen's d=${tResult.cohenD.toFixed(2)}. Mean nhóm 1=${tResult.mean1.toFixed(2)} (n=${tResult.n1}), nhóm 2=${tResult.mean2.toFixed(2)} (n=${tResult.n2}).`;
    if (chiResult) return `Chi-square: χ²=${chiResult.chi2.toFixed(2)}, df=${chiResult.df}, p=${chiResult.pValue < 0.001 ? "<.001" : chiResult.pValue.toFixed(3)}, Cramér's V=${chiResult.cramersV?.toFixed(3) ??"?"}.`;
    if (anovaResult) return `ANOVA 1 nhân tố: F=${anovaResult.f.toFixed(2)}, df=${anovaResult.dfBetween}/${anovaResult.dfWithin}, p=${anovaResult.pValue < 0.001 ? "<.001" : anovaResult.pValue.toFixed(3)}, χ²=${anovaResult.etaSq.toFixed(3)}.`;
    if (mannWhitneyResult) return `Mann-Whitney U: U=${mannWhitneyResult.u.toFixed(0)}, z=${mannWhitneyResult.z.toFixed(2)}, p=${mannWhitneyResult.pValue < 0.001 ? "<.001" : mannWhitneyResult.pValue.toFixed(3)}. Median nhóm 1=${mannWhitneyResult.median1.toFixed(2)}, nhóm 2=${mannWhitneyResult.median2.toFixed(2)}.`;
    if (pairedResult) return `t-test cặp: t=${pairedResult.t.toFixed(2)}, df=${pairedResult.df}, p=${pairedResult.pValue < 0.001 ? "<.001" : pairedResult.pValue.toFixed(3)}, d (Cohen) = ${pairedResult.cohenD.toFixed(2)}. Mean khác biệt = ${pairedResult.meanDiff.toFixed(2)}, n = ${pairedResult.n}.`;
    if (kruskalResult) return `Kruskal-Wallis: H = ${kruskalResult.h.toFixed(2)}, df = ${kruskalResult.df}, p = ${kruskalResult.pValue < 0.001 ? "<.001" : kruskalResult.pValue.toFixed(3)}, ${kruskalResult.nGroups} nhóm.`;
    if (wilcoxonPairedResult) return `Wilcoxon cặp: W = ${wilcoxonPairedResult.w.toFixed(0)}, z = ${wilcoxonPairedResult.z.toFixed(2)}, p = ${wilcoxonPairedResult.pValue < 0.001 ? "<.001" : wilcoxonPairedResult.pValue.toFixed(3)}, n = ${wilcoxonPairedResult.n}.`;
    if (friedmanResult) return `Friedman: χ² = ${friedmanResult.chi2.toFixed(2)}, df = ${friedmanResult.df}, p = ${friedmanResult.pValue < 0.001 ? "<.001" : friedmanResult.pValue.toFixed(3)}.`;
    if (leveneResult) return `Levene (Đồng phương sai): W = ${leveneResult.w.toFixed(4)}, p = ${leveneResult.pValue < 0.001 ? "<.001" : leveneResult.pValue.toFixed(3)}.`;
    if (mcnemarResult) return `McNemar (cặp nhị phân): χ² = ${mcnemarResult.chi2.toFixed(2)}, p = ${mcnemarResult.pValue < 0.001 ? "<.001" : mcnemarResult.pValue.toFixed(3)}.`;
    if (shapiroResult) return `Shapiro-Wilk (chuẩn): W = ${shapiroResult.w.toFixed(4)}, p = ${shapiroResult.pValue < 0.001 ? "<.001" : shapiroResult.pValue.toFixed(3)}. p < 0.05 → bác bỏ chuẩn.`;
    if (powerResult) return `Phân tích lực mẫu: cần n = ${powerResult.nRequired} để đạt power = ${(powerResult.power * 100).toFixed(0)}%, effect size d = ${powerResult.effectSize}, α = ${powerResult.alpha}.`;
    return "";
  }, [tResult, chiResult, anovaResult, mannWhitneyResult, pairedResult, kruskalResult, wilcoxonPairedResult, friedmanResult, leveneResult, mcnemarResult, shapiroResult, powerResult]);

  useEffect(() => {
    if (!analysisBackendAvailable || !anovaResult?.groupMeans?.length) {
      setPairwisePosthocBackendResult(null);
      return;
    }
    quantisApi.analyzePairwisePosthoc(anovaResult.groupMeans).then(setPairwisePosthocBackendResult);
  }, [analysisBackendAvailable, anovaResult]);

  const runTTest = async () => {
    if (!groupCol || !groupVal1 || !groupVal2 || !numCol) return;
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeTTest(rows, groupCol, groupVal1, groupVal2, numCol, ttestEqualVar);
      setTResult(res ?? null);
      setChiResult(null);
      setAnovaResult(null);
      if (res) onHypothesisResult?.({ type: "ttest", payload: res, meta: { groupCol, groupVal1, groupVal2, numCol } });
      else onHypothesisResult?.(null);
      return;
    }
    const res = computeTTest(rows, groupCol, groupVal1, groupVal2, numCol);
    setTResult(res ?? null);
    setChiResult(null);
    setAnovaResult(null);
    if (res) onHypothesisResult?.({ type: "ttest", payload: res, meta: { groupCol, groupVal1, groupVal2, numCol } });
    else onHypothesisResult?.(null);
  };
  const runChiSquare = async () => {
    if (!chiCol1 || !chiCol2) return;
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeChiSquare(rows, chiCol1, chiCol2);
      setChiResult(res ?? null);
      setTResult(null);
      setAnovaResult(null);
      if (res) onHypothesisResult?.({ type: "chisquare", payload: res, meta: { chiCol1, chiCol2 } });
      else onHypothesisResult?.(null);
      return;
    }
    const res = computeChiSquare(rows, chiCol1, chiCol2);
    setChiResult(res ?? null);
    setTResult(null);
    setAnovaResult(null);
    if (res) onHypothesisResult?.({ type: "chisquare", payload: res, meta: { chiCol1, chiCol2 } });
    else onHypothesisResult?.(null);
  };
  const runANOVA = async () => {
    if (!anovaFactorCol || !anovaValueCol) return;
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeAnova(rows, anovaFactorCol, anovaValueCol);
      setAnovaResult(res ?? null);
      setKruskalResult(null);
      setTResult(null);
      setChiResult(null);
      if (res) onHypothesisResult?.({ type: "anova", payload: res, meta: { factorCol: anovaFactorCol, valueCol: anovaValueCol } });
      else onHypothesisResult?.(null);
      return;
    }
    const res = computeOneWayANOVA(rows, anovaFactorCol, anovaValueCol);
    setAnovaResult(res ?? null);
      setKruskalResult(null);
    setTResult(null);
    setChiResult(null);
    if (res) onHypothesisResult?.({ type: "anova", payload: res, meta: { factorCol: anovaFactorCol, valueCol: anovaValueCol } });
    else onHypothesisResult?.(null);
  };
  const runKruskalWallis = async () => {
    if (!anovaFactorCol || !anovaValueCol) return;
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeKruskalWallis(rows, anovaFactorCol, anovaValueCol);
      setKruskalResult(res ?? null);
      setAnovaResult(null);
      return;
    }
    const res = computeKruskalWallis(rows, anovaFactorCol, anovaValueCol);
    setKruskalResult(res ?? null);
    setAnovaResult(null);
  };
    const runMannWhitney = async () => {
    if (!groupCol || !groupVal1 || !groupVal2 || !numCol) return;
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeMannWhitney(rows, groupCol, groupVal1, groupVal2, numCol);
      setMannWhitneyResult(res ?? null);
      if (res) onHypothesisResult?.({ type: "mannwhitney", payload: res, meta: { groupCol, groupVal1, groupVal2, numCol } });
      else onHypothesisResult?.(null);
      return;
    }
    const res = computeMannWhitneyU(rows, groupCol, groupVal1, groupVal2, numCol);
    setMannWhitneyResult(res ?? null);
    if (res) onHypothesisResult?.({ type: "mannwhitney", payload: res, meta: { groupCol, groupVal1, groupVal2, numCol } });
    else onHypothesisResult?.(null);
  };
  const clearResults = () => { setTResult(null); setChiResult(null); setAnovaResult(null); setKruskalResult(null); setMannWhitneyResult(null); setShapiroResult(null); setPowerResult(null); setSampleSizeExtra(null); setPairedResult(null); setWilcoxonPairedResult(null); setFriedmanResult(null); setLeveneResult(null); setMcNemarResult(null); setFisherResult(null); setOnesampleResult(null); setBinomialResult(null); setTwopropResult(null); setSignTestResult(null); setFtestResult(null); setZtestMeansResult(null); };
  const runShapiroWilk = async () => {
    if (!normalityCol || !numericCols.includes(normalityCol)) return;
    const ci = rows[0].indexOf(normalityCol);
    const vals = rows.slice(1).map((r) => Number(r[ci])).filter((v) => !Number.isNaN(v));
    if (analysisBackendAvailable) {
      const res = await quantisApi.analyzeShapiro(vals);
      setShapiroResult(res ?? null);
      return;
    }
    const res = computeShapiroWilk(vals);
    setShapiroResult(res ?? null);
  };
  const runPowerAnalysis = async () => {
    if (sampleSizeKind === "ttest") {
      if (analysisBackendAvailable) {
        const res = await quantisApi.analyzePowerTTest(effectSizeD);
        setPowerResult(res ?? null);
        setSampleSizeExtra(null);
        return;
      }
      const res = computePowerTTest(effectSizeD);
      setPowerResult(res);
      setSampleSizeExtra(null);
    } else if (sampleSizeKind === "proportion") {
      if (analysisBackendAvailable) {
        const res = await quantisApi.analyzeSampleSizeProportion(proportionP0, proportionP1);
        setSampleSizeExtra(res ?? null);
        setPowerResult(null);
        return;
      }
      const res = computeSampleSizeProportion(proportionP0, proportionP1);
      setSampleSizeExtra(res);
      setPowerResult(null);
    } else if (sampleSizeKind === "chisquare") {
      if (analysisBackendAvailable) {
        const res = await quantisApi.analyzeSampleSizeChisquare(chiEffectW, chiDf);
        setSampleSizeExtra(res ?? null);
        setPowerResult(null);
        return;
      }
      const res = computeSampleSizeChiSquare(chiEffectW, chiDf);
      setSampleSizeExtra(res);
      setPowerResult(null);
    } else if (sampleSizeKind === "anova") {
      if (analysisBackendAvailable) {
        const res = await quantisApi.analyzeSampleSizeAnova(anovaK, anovaF);
        setSampleSizeExtra(res ?? null);
        setPowerResult(null);
        return;
      }
      const res = computeSampleSizeAnova(anovaK, anovaF);
      setSampleSizeExtra(res);
      setPowerResult(null);
    } else {
      if (analysisBackendAvailable) {
        const res = await quantisApi.analyzeSampleSizeRegression(regressionP, regressionRule);
        setSampleSizeExtra(res ?? null);
        setPowerResult(null);
        return;
      }
      const res = computeSampleSizeRegression(regressionP, regressionRule);
      setSampleSizeExtra(res);
      setPowerResult(null);
    }
  };

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">Kiểm định giả thuyết</h2>
      {analysisBackendAvailable && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5" /> t-test, Chi-square, ANOVA chạy trên backend Python (scipy)
        </p>
      )}
      <div className="mb-4">
        <AIAssistPanel
          metadata={selectedDataset ? `Dataset: ${selectedDataset.name}. Số hàng: ${selectedDataset.rows}, số cột: ${selectedDataset.columns}. Cột: ${(selectedDataset.columnNames || []).slice(0, 20).join(", ")}${(selectedDataset.columnNames?.length || 0) > 20 ? "…" : ""}.` : undefined}
          context="Trang Kiểm định giả thuyết: t-test, ANOVA, Chi-square, Mann-Whitney, Wilcoxon, Kruskal-Wallis, Friedman, Levene, Shapiro-Wilk, Power analysis, v.v. Chọn kiểm định từ dropdown, chọn cột/nhóm, rồi bấm Chạy."
          quickPrompts={[{ label: "Gợi ý chọn kiểm định phù hợp", systemHint: "Bạn là chuyên gia thống kê. Gợi ý loại kiểm định phù hợp theo: so sánh trung bình 2 nhóm (t-test) hay nhiều nhóm (ANOVA), dữ liệu không chuẩn (Mann-Whitney, Kruskal-Wallis), hai biến phân loại (Chi-square), dữ liệu cặp (t-test cặp, Wilcoxon), kiểm tra giả định (Shapiro-Wilk, Levene). Trả lời ngắn gọn bằng tiếng Việt." }, { label: "Cách đọc p-value và effect size", systemHint: "Bạn là chuyên gia thống kê. Giải thích p-value (α = 0.05), effect size (Cohen d, η², Cramér V…), cách trình bày kết quả trong báo cáo (APA). Trả lời ngắn gọn bằng tiếng Việt." }]}
          title="Hỏi AI về kiểm định giả thuyết"
        />
      </div>
      {hypothesisResultContext && (
        <AIAssistPanel
          metadata={hypothesisMetadata}
          process={hypothesisProcess}
          context={hypothesisResultContext}
          quickPrompts={[{ label: "Giải thích kết quả kiểm định", systemHint: "Bạn là chuyên gia thống kê. Giải thích kết quả kiểm định giả thuyết: p-value (có ý nghĩa thống kê hay không), effect size (độ mạnh hiệu ứng), cỡ mẫu. Gợi ý cách trình bày trong báo cáo (ví dụ APA). Trả lời ngắn gọn bằng tiếng Việt." }]}
          title="Hỏi AI về kết quả kiểm định"
        />
      )}
      <div className="flex flex-wrap items-center gap-3 mb-4">
        <label className="flex items-center gap-2 text-sm font-medium">
          <span>Chọn kiểm định:</span>
          <select
            value={testKind}
            onChange={(e) => { setTestKind(e.target.value as typeof testKind); clearResults(); }}
            className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm min-w-[200px]"
          >
            <optgroup label="So sánh trung bình">
              <option value="ttest">t-test (hai nhóm độc lập)</option>
              <option value="anova">ANOVA 1 nhân tố</option>
              <option value="paired">t-test cặp</option>
              <option value="onesample_ttest">t-test một mẫu</option>
              <option value="ztest_means">z-Test 2 trung bình</option>
            </optgroup>
            <optgroup label="Phi tham số / Trung vị">
              <option value="nonparametric">Mann-Whitney U (hai nhóm)</option>
              <option value="wilcoxon_paired">Wilcoxon cặp</option>
              <option value="kruskal">Kruskal-Wallis (nhiều nhóm)</option>
              <option value="friedman">Friedman</option>
              <option value="sign_test">Sign test (cặp)</option>
            </optgroup>
            <optgroup label="Phân loại & tỉ lệ">
              <option value="chisquare">Chi-square (độc lập)</option>
              <option value="mcnemar">McNemar (cặp nhị phân)</option>
              <option value="fisher">Fisher exact (2×2)</option>
              <option value="binomial">Kiểm định tỉ lệ (Binomial)</option>
              <option value="twoprop">Z-test hai tỉ lệ</option>
            </optgroup>
            <optgroup label="Chuẩn & công cụ">
              <option value="normality">Shapiro-Wilk (chuẩn)</option>
              <option value="levene">Levene (đồng phương sai)</option>
              <option value="ftest">F-test 2 phương sai</option>
              <option value="power">Power analysis</option>
            </optgroup>
          </select>
        </label>
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
            <option value="">— Chọn —</option>
            {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Nhóm 2</label>
          <select value={groupVal2} onChange={(e) => { setGroupVal2(e.target.value); setTResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
            <option value="">— Chọn —</option>
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
        <label className="flex items-center gap-2 cursor-pointer">
          <input type="checkbox" checked={ttestEqualVar} onChange={(e) => { setTtestEqualVar(e.target.checked); setTResult(null); }} className="rounded border-neutral-300" />
          <span className="text-sm">Giả định phương sai bằng nhau (Equal variance)</span>
        </label>
        <button type="button" onClick={runTTest} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Chạy t-test</button>
      </div>
      {tResult && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
          <div className="flex items-center justify-between gap-2 mb-2">
            <p className="font-medium">Kết quả ({ttestEqualVar ? "Two-sample t-test (Equal variance)" : "Welch two-sample t-test"})</p>
            <button type="button" onClick={() => navigator.clipboard.writeText(`t = ${tResult.t.toFixed(4)}, df = ${tResult.df.toFixed(1)}, p = ${tResult.pValue < 0.001 ? "< .001" : tResult.pValue.toFixed(4)}, Cohen's d = ${tResult.cohenD.toFixed(4)}\nMean nhóm 1 = ${tResult.mean1.toFixed(2)} (n = ${tResult.n1}), Mean nhóm 2 = ${tResult.mean2.toFixed(2)} (n = ${tResult.n2})`)} className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs flex items-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"><Copy className="w-3.5 h-3.5" /> Sao chép</button>
          </div>
          <p>t = {tResult.t.toFixed(4)}, df = {tResult.df.toFixed(1)}, p-value = {tResult.pValue < 0.001 ? "< 0.001" : tResult.pValue.toFixed(4)}</p>
          <p>Cohen's d = {tResult.cohenD.toFixed(4)}</p>
          <p>Mean nhóm 1 = {tResult.mean1.toFixed(2)} (n = {tResult.n1}), Mean nhóm 2 = {tResult.mean2.toFixed(2)} (n = {tResult.n2})</p>
        </div>
      )}
      </>
      )}
      {testKind === "anova" && (
        <>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến nhân tố (nhóm)</label>
              <select value={anovaFactorCol} onChange={(e) => { setAnovaFactorCol(e.target.value); setAnovaResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến số (phụ thuộc)</label>
              <select value={anovaValueCol} onChange={(e) => { setAnovaValueCol(e.target.value); setAnovaResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={runANOVA} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Chạy ANOVA</button>
          </div>
          {anovaResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm space-y-3">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="font-medium">Kết quả ANOVA một nhân tố</p>
                <button type="button" onClick={() => { const lines = [`F(${anovaResult.dfBetween}, ${anovaResult.dfWithin}) = ${anovaResult.f.toFixed(4)}, p = ${anovaResult.pValue < 0.001 ? "< .001" : anovaResult.pValue.toFixed(4)}, η² = ${anovaResult.etaSq.toFixed(4)}${typeof anovaResult.omegaSq === "number" ? `, ω² = ${anovaResult.omegaSq.toFixed(4)}` : ""}`, "Nhóm\tM\tSD\tn", ...anovaResult.groupMeans.map((m) => `${m.group}\t${m.mean.toFixed(4)}\t${m.std.toFixed(4)}\t${m.n}`)]; const posthoc = analysisBackendAvailable && pairwisePosthocBackendResult ? pairwisePosthocBackendResult : pairwisePostHoc(anovaResult.groupMeans); if (posthoc.length) lines.push("", "Nhóm 1\tNhóm 2\tHiệu TB\tp (Bonferroni)", ...posthoc.map((r) => `${r.group1}\t${r.group2}\t${r.meanDiff.toFixed(4)}\t${r.pBonferroni < 0.001 ? "< .001" : r.pBonferroni.toFixed(4)}`)); navigator.clipboard.writeText(lines.join("\n")); }} className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs flex items-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"><Copy className="w-3.5 h-3.5" /> Sao chép</button>
              </div>
              <p>F({anovaResult.dfBetween}, {anovaResult.dfWithin}) = {anovaResult.f.toFixed(4)}, p-value = {anovaResult.pValue < 0.001 ? "< 0.001" : anovaResult.pValue.toFixed(4)}, η² = {anovaResult.etaSq.toFixed(4)}{typeof anovaResult.omegaSq === "number" ? `, ω² = ${anovaResult.omegaSq.toFixed(4)}` : ""}</p>
              <p className="text-neutral-600 dark:text-neutral-400">Trung bình theo nhóm:</p>
              <ul className="list-disc list-inside">
                {anovaResult.groupMeans.map((m) => (
                  <li key={m.group}>{m.group}: M = {m.mean.toFixed(2)}, SD = {m.std.toFixed(2)}, n = {m.n}</li>
                ))}
              </ul>
              {anovaResult.groupMeans.length >= 2 && (
                <>
                  <p className="font-medium mt-2">Post-hoc (so sánh từng cặp, hiệu chỉnh Bonferroni)</p>
                  <div className="overflow-x-auto">
                    <table className="w-full text-xs">
                      <thead><tr className="border-b border-neutral-200 dark:border-neutral-600"><th className="text-left p-1.5">Nhóm 1</th><th className="text-left p-1.5">Nhóm 2</th><th className="text-right p-1.5">Hiệu TB</th><th className="text-right p-1.5">t</th><th className="text-right p-1.5">p (Bonferroni)</th></tr></thead>
                      <tbody>
                        {(analysisBackendAvailable && pairwisePosthocBackendResult ? pairwisePosthocBackendResult : pairwisePostHoc(anovaResult.groupMeans)).map((row, i) => (
                          <tr key={i} className="border-b border-neutral-100 dark:border-neutral-700/50">
                            <td className="p-1.5">{row.group1}</td>
                            <td className="p-1.5">{row.group2}</td>
                            <td className="p-1.5 text-right">{row.meanDiff.toFixed(3)}</td>
                            <td className="p-1.5 text-right">{row.t.toFixed(3)}</td>
                            <td className="p-1.5 text-right">{row.pBonferroni < 0.001 ? "< .001" : row.pBonferroni.toFixed(3)}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                </>
              )}
            </div>
          )}
        </>
      )}
      
      {testKind === "kruskal" && (
        <>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến nhân tố (nhóm)</label>
              <select value={anovaFactorCol} onChange={(e) => { setAnovaFactorCol(e.target.value); setKruskalResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến số (phụ thuộc)</label>
              <select value={anovaValueCol} onChange={(e) => { setAnovaValueCol(e.target.value); setKruskalResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={runKruskalWallis} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Chạy Kruskal-Wallis</button>
          </div>
          {kruskalResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm space-y-3">
              <p className="font-medium">Kết quả Kruskal-Wallis H (non-parametric, 3+ nhóm)</p>
              <p>H = {kruskalResult.h.toFixed(4)}, df = {kruskalResult.df}, p-value = {kruskalResult.pValue < 0.001 ? "< 0.001" : kruskalResult.pValue.toFixed(4)}</p>
              <p className="text-neutral-600 dark:text-neutral-400">Trung vị theo nhóm:</p>
              <ul className="list-disc list-inside">
                {kruskalResult.groupMedians.map((m) => (
                  <li key={m.group}>{m.group}: Mdn = {m.median.toFixed(2)}, M = {m.mean.toFixed(2)}, n = {m.n}</li>
                ))}
              </ul>
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
            <button type="button" onClick={runChiSquare} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Chạy Chi-square</button>
          </div>
          {chiResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <div className="flex items-center justify-between gap-2 mb-2">
                <p className="font-medium">Kết quả Chi-square (độc lập)</p>
                <button type="button" onClick={() => { let t = `chi2 = ${chiResult.chi2.toFixed(4)}, df = ${chiResult.df}, p = ${chiResult.pValue < 0.001 ? "< .001" : chiResult.pValue.toFixed(4)}`; if (chiResult.phi != null) t += `, Phi = ${chiResult.phi.toFixed(4)}`; if (chiResult.cramersV != null) t += `, Cramer V = ${chiResult.cramersV.toFixed(4)}`; if (chiResult.rowLabels.length === 2 && chiResult.colLabels.length === 2) { const a = chiResult.table.find(x => x.row === chiResult.rowLabels[0] && x.col === chiResult.colLabels[0])?.count ?? 0; const b = chiResult.table.find(x => x.row === chiResult.rowLabels[0] && x.col === chiResult.colLabels[1])?.count ?? 0; const c = chiResult.table.find(x => x.row === chiResult.rowLabels[1] && x.col === chiResult.colLabels[0])?.count ?? 0; const d = chiResult.table.find(x => x.row === chiResult.rowLabels[1] && x.col === chiResult.colLabels[1])?.count ?? 0; const orRes = computeOddsRatio(a, b, c, d); if (orRes) t += `, OR = ${orRes.or.toFixed(4)} [${orRes.ci95Lower.toFixed(4)}, ${orRes.ci95Upper.toFixed(4)}]`; } void navigator.clipboard.writeText(t); }} className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs flex items-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"><Copy className="w-3.5 h-3.5" /> Sao chép</button>
              </div>
              <p>χ² = {chiResult.chi2.toFixed(4)}, df = {chiResult.df}, p-value = {chiResult.pValue < 0.001 ? "< 0.001" : chiResult.pValue.toFixed(4)}</p>
              {chiResult.phi != null && <p>φ (Phi) = {chiResult.phi.toFixed(4)} – effect size cho bảng 2×2</p>}
              <p>Cramér's V = {chiResult.cramersV != null ? chiResult.cramersV.toFixed(4) : "—"} – cường độ liên hệ</p>
            </div>
          )}
        </>
      )}
      {testKind === "nonparametric" && (
        <>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến nhóm</label>
              <select value={groupCol} onChange={(e) => { setGroupCol(e.target.value); setGroupVal1(""); setGroupVal2(""); setMannWhitneyResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nhóm 1</label>
              <select value={groupVal1} onChange={(e) => { setGroupVal1(e.target.value); setMannWhitneyResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nhóm 2</label>
              <select value={groupVal2} onChange={(e) => { setGroupVal2(e.target.value); setMannWhitneyResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến số</label>
              <select value={numCol} onChange={(e) => { setNumCol(e.target.value); setMannWhitneyResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={runMannWhitney} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Chạy Mann-Whitney U</button>
          </div>
          {mannWhitneyResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả Mann-Whitney U (non-parametric)</p>
              <p>U = {mannWhitneyResult.u.toFixed(0)}, z = {mannWhitneyResult.z.toFixed(4)}, p-value = {mannWhitneyResult.pValue < 0.001 ? "< 0.001" : mannWhitneyResult.pValue.toFixed(4)}</p>
              <p>Median nhóm 1 = {mannWhitneyResult.median1.toFixed(2)} (n = {mannWhitneyResult.n1}), Median nhóm 2 = {mannWhitneyResult.median2.toFixed(2)} (n = {mannWhitneyResult.n2})</p>
            </div>
          )}
        </>
      )}
      {testKind === "paired" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">t-test cặp: hai cột số tương ứng từng cặp (trước/sau, điều kiện A/B). Mỗi hàng = một đối tượng.</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cột 1 (ví dụ: trước)</label>
              <select value={pairedCol1} onChange={(e) => { setPairedCol1(e.target.value); setPairedResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cột 2 (ví dụ: sau)</label>
              <select value={pairedCol2} onChange={(e) => { setPairedCol2(e.target.value); setPairedResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={async () => {
              if (!pairedCol1 || !pairedCol2) return;
              if (analysisBackendAvailable) {
                const res = await quantisApi.analyzeTTestPaired(rows, pairedCol1, pairedCol2);
                setPairedResult(res ? { t: res.t, df: res.df, pValue: res.pValue, cohenD: res.cohenD, meanDiff: res.meanDiff, stdDiff: res.stdDiff, n: res.n, mean1: res.mean1, mean2: res.mean2 } : null);
                return;
              }
              const res = computePairedTTest(rows, pairedCol1, pairedCol2);
              setPairedResult(res ?? null);
            }} disabled={!pairedCol1 || !pairedCol2} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy t-test cặp</button>
          </div>
          {pairedResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả Paired t-test</p>
              <p>t = {pairedResult.t.toFixed(4)}, df = {pairedResult.df}, p-value = {pairedResult.pValue < 0.001 ? "< 0.001" : pairedResult.pValue.toFixed(4)}</p>
              <p>Cohen's d = {pairedResult.cohenD.toFixed(4)}, Mean hiệu = {pairedResult.meanDiff.toFixed(4)} (SD hiệu = {pairedResult.stdDiff.toFixed(4)}), n = {pairedResult.n}</p>
              <p>Mean cột 1 = {pairedResult.mean1.toFixed(2)}, Mean cột 2 = {pairedResult.mean2.toFixed(2)}</p>
            </div>
          )}
        </>
      )}
      {testKind === "wilcoxon_paired" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Wilcoxon signed-rank: phi tham số cho dữ liệu cặp (2 cột số tương ứng).</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cột 1</label>
              <select value={pairedCol1} onChange={(e) => { setPairedCol1(e.target.value); setWilcoxonPairedResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cột 2</label>
              <select value={pairedCol2} onChange={(e) => { setPairedCol2(e.target.value); setWilcoxonPairedResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { const res = computeWilcoxonSignedRank(rows, pairedCol1, pairedCol2); setWilcoxonPairedResult(res ?? null); }} disabled={!pairedCol1 || !pairedCol2} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy Wilcoxon cặp</button>
          </div>
          {wilcoxonPairedResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả Wilcoxon signed-rank</p>
              <p>W = {wilcoxonPairedResult.w.toFixed(0)}, z = {wilcoxonPairedResult.z.toFixed(4)}, p-value = {wilcoxonPairedResult.pValue < 0.001 ? "< 0.001" : wilcoxonPairedResult.pValue.toFixed(4)}</p>
              <p>Median hiệu = {wilcoxonPairedResult.medianDiff.toFixed(4)}, n (cặp khác 0) = {wilcoxonPairedResult.n}</p>
            </div>
          )}
        </>
      )}
      {testKind === "friedman" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Friedman: repeated measures (phi tham số), ≥3 điều kiện. Chọn các cột số; mỗi hàng = một đối tượng, mỗi cột = một điều kiện.</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div className="w-full">
              <label className="block text-sm font-medium mb-1">Các cột điều kiện (số, thứ tự giữ nguyên)</label>
              <div className="flex flex-wrap gap-2">
                {numericCols.map((c) => (
                  <label key={c} className="inline-flex items-center gap-1.5">
                    <input type="checkbox" checked={friedmanCols.includes(c)} onChange={(e) => { setFriedmanCols((prev) => e.target.checked ? [...prev, c] : prev.filter((x) => x !== c)); setFriedmanResult(null); }} />
                    <span>{c}</span>
                  </label>
                ))}
              </div>
            </div>
            <button type="button" onClick={() => { const res = friedmanCols.length >= 3 ? computeFriedmanTest(rows, friedmanCols) : null; setFriedmanResult(res ?? null); }} disabled={friedmanCols.length < 3} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy Friedman</button>
          </div>
          {friedmanResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm space-y-2">
              <p className="font-medium">Kết quả Friedman</p>
              <p>χ² = {friedmanResult.chi2.toFixed(4)}, df = {friedmanResult.df}, p-value = {friedmanResult.pValue < 0.001 ? "< 0.001" : friedmanResult.pValue.toFixed(4)}</p>
              <p>Khối (đối tượng) n = {friedmanResult.nBlocks}, Số điều kiện k = {friedmanResult.kConditions}</p>
              <p className="text-neutral-600 dark:text-neutral-400">Mean rank theo điều kiện:</p>
              <ul className="list-disc list-inside">
                {friedmanResult.meanRanks.map((m) => (
                  <li key={m.condition}>{m.condition}: mean rank = {m.meanRank.toFixed(2)}</li>
                ))}
              </ul>
            </div>
          )}
        </>
      )}
      {testKind === "levene" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Levene: kiểm tra Đồng phương sai (homogeneity of variance) trước khi dòng ANOVA. p &gt; 0.05 có thể dòng ANOVA.</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến nhóm</label>
              <select value={leveneGroupCol} onChange={(e) => { setLeveneGroupCol(e.target.value); setLeveneResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến số</label>
              <select value={leveneValueCol} onChange={(e) => { setLeveneValueCol(e.target.value); setLeveneResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { const res = computeLeveneTest(rows, leveneGroupCol, leveneValueCol); setLeveneResult(res ?? null); }} disabled={!leveneGroupCol || !leveneValueCol} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy Levene</button>
          </div>
          {leveneResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả Levene (Đồng phương sai)</p>
              <p>W = {leveneResult.w.toFixed(4)}, df1 = {leveneResult.df1}, df2 = {leveneResult.df2}, p-value = {leveneResult.pValue < 0.001 ? "< 0.001" : leveneResult.pValue.toFixed(4)}</p>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">p &gt; 0.05 ? không bác bỏ H0 (phương sai đồng nhất)..</p>
            </div>
          )}
        </>
      )}
      {testKind === "mcnemar" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">McNemar: hai biến nhị phân (cùng đối tượng, 2 thời điểm). Mỗi cột có 2 giá trị (VD: Có/Không, 0/1).</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cột 1 (thời điểm 1)</label>
              <select value={mcnemarCol1} onChange={(e) => { setMcNemarCol1(e.target.value); setMcNemarResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cột 2 (thời điểm 2)</label>
              <select value={mcnemarCol2} onChange={(e) => { setMcNemarCol2(e.target.value); setMcNemarResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { const res = computeMcNemar(rows, mcnemarCol1, mcnemarCol2); setMcNemarResult(res ?? null); }} disabled={!mcnemarCol1 || !mcnemarCol2} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy McNemar</button>
          </div>
          {mcnemarResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả McNemar (paired binary)</p>
              <p>χ² = {mcnemarResult.chi2.toFixed(4)}, p-value = {mcnemarResult.pValue < 0.001 ? "< 0.001" : mcnemarResult.pValue.toFixed(4)}</p>
              <p>Cặp bất đồng nhất: b = {mcnemarResult.b}, c = {mcnemarResult.c}, n_discordant = {mcnemarResult.nDiscordant}</p>
            </div>
          )}
        </>
      )}
      {testKind === "fisher" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Fisher exact: hai biến phân loại, mỗi biến có 2 nhóm (bảng 2×2).. Dùng khi ô kỳ vọng nhỏ (tương đương SPSS/R/Python).</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến hàng</label>
              <select value={fisherCol1} onChange={(e) => { setFisherCol1(e.target.value); setFisherResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến cột</label>
              <select value={fisherCol2} onChange={(e) => { setFisherCol2(e.target.value); setFisherResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { const chi = computeChiSquare(rows, fisherCol1, fisherCol2); if (chi && chi.rowLabels.length === 2 && chi.colLabels.length === 2) { const a = chi.table.find(t => t.row === chi.rowLabels[0] && t.col === chi.colLabels[0])?.count ?? 0; const b = chi.table.find(t => t.row === chi.rowLabels[0] && t.col === chi.colLabels[1])?.count ?? 0; const c = chi.table.find(t => t.row === chi.rowLabels[1] && t.col === chi.colLabels[0])?.count ?? 0; const d = chi.table.find(t => t.row === chi.rowLabels[1] && t.col === chi.colLabels[1])?.count ?? 0; setFisherResult(computeFisherExact(a, b, c, d) ?? null); } else setFisherResult(null); }} disabled={!fisherCol1 || !fisherCol2} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy Fisher exact</button>
          </div>
          {fisherResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả Fisher exact (2?2)</p>
              <p>Bảng: a={fisherResult.a}, b={fisherResult.b}, c={fisherResult.c}, d={fisherResult.d}, n={fisherResult.n}</p>
              <p>p-value (hai phía) = {fisherResult.pValueTwoTailed < 0.001 ? "< 0.001" : fisherResult.pValueTwoTailed.toFixed(4)}</p>
              {(() => { const orRes = computeOddsRatio(fisherResult.a, fisherResult.b, fisherResult.c, fisherResult.d); return orRes ? <p>Odds ratio (OR) = {orRes.or.toFixed(4)}, CI 95%: [{orRes.ci95Lower.toFixed(4)}, {orRes.ci95Upper.toFixed(4)}]</p> : null; })()}
            </div>
          )}
        </>
      )}
      {testKind === "onesample_ttest" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">So sánh trung bình mẫu với một giá trị hằng (μ₀) (R: t.test(x, mu=); Python: scipy.stats.ttest_1samp).</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến số</label>
              <select value={onesampleCol} onChange={(e) => { setOnesampleCol(e.target.value); setOnesampleResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">để (giá trị so sánh)</label>
              <input type="number" step="any" value={onesampleMu0} onChange={(e) => { setOnesampleMu0(e.target.value); setOnesampleResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-28" placeholder="0" />
            </div>
            <button type="button" onClick={() => { if (!onesampleCol || onesampleMu0 === "") return; const h = rows[0] || []; const idx = h.indexOf(onesampleCol); if (idx === -1) return; const vals = rows.slice(1).map(r => Number(r[idx])).filter(n => !Number.isNaN(n)); const res = computeOneSampleTTest(vals, parseFloat(onesampleMu0) || 0); setOnesampleResult(res ?? null); }} disabled={!onesampleCol || onesampleMu0 === ""} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy t-test một mẫu</button>
          </div>
          {onesampleResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả t-test một mẫu</p>
              <p>t = {onesampleResult.t.toFixed(4)}, df = {onesampleResult.df}, p-value = {onesampleResult.pValue < 0.001 ? "< 0.001" : onesampleResult.pValue.toFixed(4)}</p>
              <p>Trung bình mẫu = {onesampleResult.mean.toFixed(4)}, μ₀ = {onesampleResult.mu0}, n = {onesampleResult.n}, SD = {onesampleResult.std.toFixed(4)}</p>
            </div>
          )}
        </>
      )}
      {testKind === "binomial" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Kiểm định tỉ lệ một mẫu (H₀: p = p₀). Chọn biến nhị phân (2 giá trị); &quot;thành công&quot; = số lần xuất hiện giá trị thứ nhất. R: binom.test; Python: scipy.stats.binomtest.</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến nhị phân (2 giá trị)</label>
              <select value={binomialCol} onChange={(e) => { setBinomialCol(e.target.value); setBinomialResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">p₀ (tỉ lệ H₀)</label>
              <input type="number" step="0.01" min="0.01" max="0.99" value={binomialP0} onChange={(e) => { setBinomialP0(e.target.value); setBinomialResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
            </div>
            <button type="button" onClick={() => { if (!binomialCol) return; const h = rows[0] || []; const idx = h.indexOf(binomialCol); if (idx === -1) return; const raw = rows.slice(1).map(r => String(r[idx] ?? "").trim()).filter(Boolean); const uniq = [...new Set(raw)].sort(); if (uniq.length !== 2) return; const successVal = uniq[0]; const successes = raw.filter(v => v === successVal).length; const n = raw.length; const p0 = Math.max(0.01, Math.min(0.99, parseFloat(binomialP0) || 0.5)); const res = computeBinomialTest(successes, n, p0); setBinomialResult(res ?? null); }} disabled={!binomialCol} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy kiểm định tỉ lệ</button>
          </div>
          {binomialResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả kiểm định tỉ lệ (Binomial)</p>
              <p>Tỉ lệ mẫu = {binomialResult.proportion.toFixed(4)} ({binomialResult.successes}/{binomialResult.n}), p₀ = {binomialResult.p0}</p>
              <p>p-value (hai phía) = {binomialResult.pValueTwoTailed < 0.001 ? "< 0.001" : binomialResult.pValueTwoTailed.toFixed(4)}</p>
              <p>Khoảng tin cậy 95%: [{binomialResult.ci95Lower.toFixed(4)}, {binomialResult.ci95Upper.toFixed(4)}]</p>
            </div>
          )}
        </>
      )}
      {testKind === "twoprop" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">So sánh tỉ lệ giữa hai nhóm độc lập (Z-test hai tỉ lệ). Biến nhóm: 2 giá trị; Biến kết quả: nhị phân (2 giá trị, &quot;thành công&quot; = giá trị thứ nhất). R: prop.test; Python: proportions_ztest.</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến nhóm</label>
              <select value={twopropGroupCol} onChange={(e) => { setTwopropGroupCol(e.target.value); setTwopropGroupVal1(""); setTwopropGroupVal2(""); setTwopropResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nhóm 1</label>
              <select value={twopropGroupVal1} onChange={(e) => { setTwopropGroupVal1(e.target.value); setTwopropResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {(twopropGroupCol ? getUniqueValues(rows, twopropGroupCol) : []).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nhóm 2</label>
              <select value={twopropGroupVal2} onChange={(e) => { setTwopropGroupVal2(e.target.value); setTwopropResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {(twopropGroupCol ? getUniqueValues(rows, twopropGroupCol) : []).map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến kết quả (nhị phân)</label>
              <select value={twopropOutcomeCol} onChange={(e) => { setTwopropOutcomeCol(e.target.value); setTwopropResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { if (!twopropGroupCol || !twopropGroupVal1 || !twopropGroupVal2 || !twopropOutcomeCol) return; const h = rows[0] || []; const gIdx = h.indexOf(twopropGroupCol); const oIdx = h.indexOf(twopropOutcomeCol); if (gIdx === -1 || oIdx === -1) return; const outVals = [...new Set(rows.slice(1).map(r => String(r[oIdx] ?? "").trim()).filter(Boolean))].sort(); if (outVals.length !== 2) return; const successVal = outVals[0]; const data = rows.slice(1); const g1 = data.filter(r => String(r[gIdx]).trim() === twopropGroupVal1); const g2 = data.filter(r => String(r[gIdx]).trim() === twopropGroupVal2); const success1 = g1.filter(r => String(r[oIdx]).trim() === successVal).length; const success2 = g2.filter(r => String(r[oIdx]).trim() === successVal).length; const res = computeTwoProportionZTest(success1, g1.length, success2, g2.length); setTwopropResult(res ?? null); }} disabled={!twopropGroupCol || !twopropGroupVal1 || !twopropGroupVal2 || !twopropOutcomeCol} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy Z-test hai tỉ lệ</button>
          </div>
          {twopropResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả Z-test hai tỉ lệ</p>
              <p>Tỉ lệ nhóm 1 = {twopropResult.p1.toFixed(4)} ({twopropResult.success1}/{twopropResult.n1}), Tỉ lệ nhóm 2 = {twopropResult.p2.toFixed(4)} ({twopropResult.success2}/{twopropResult.n2})</p>
              <p>z = {twopropResult.z.toFixed(4)}, p-value = {twopropResult.pValue < 0.001 ? "< 0.001" : twopropResult.pValue.toFixed(4)}</p>
              <p>Hiệu (p₁ − p₂) = {twopropResult.diff.toFixed(4)}, CI 95%: [{twopropResult.ci95Lower.toFixed(4)}, {twopropResult.ci95Upper.toFixed(4)}]</p>
            </div>
          )}
        </>
      )}
      {testKind === "sign_test" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">Sign test (dữ liệu cặp): Đếm số chênh lệch dương/âm, kiểm định tỉ lệ = 0.5 (phi tham số). R: binom.test; thay thế t-test cặp khi chỉ quan tâm hướng.</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cột 1</label>
              <select value={signTestCol1} onChange={(e) => { setSignTestCol1(e.target.value); setSignTestResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Cột 2</label>
              <select value={signTestCol2} onChange={(e) => { setSignTestCol2(e.target.value); setSignTestResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={() => { const res = computeSignTest(rows, signTestCol1, signTestCol2); setSignTestResult(res ?? null); }} disabled={!signTestCol1 || !signTestCol2} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy Sign test</button>
          </div>
          {signTestResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả Sign test</p>
              <p>Số chênh lệch dương = {signTestResult.positiveCount}, âm = {signTestResult.negativeCount}, n = {signTestResult.n}</p>
              <p>Tỉ lệ dương = {signTestResult.proportionPositive.toFixed(4)}, p-value (hai phía) = {signTestResult.pValueTwoTailed < 0.001 ? "< 0.001" : signTestResult.pValueTwoTailed.toFixed(4)}</p>
            </div>
          )}
        </>
      )}
      {testKind === "ftest" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">F-test hai mẫu cho phương sai (so sánh var nhóm 1 vs nhóm 2). Dùng trước khi chọn t-test Equal variance.</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến nhóm</label>
              <select value={groupCol} onChange={(e) => { setGroupCol(e.target.value); setGroupVal1(""); setGroupVal2(""); setFtestResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nhóm 1</label>
              <select value={groupVal1} onChange={(e) => { setGroupVal1(e.target.value); setFtestResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nhóm 2</label>
              <select value={groupVal2} onChange={(e) => { setGroupVal2(e.target.value); setFtestResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến số</label>
              <select value={numCol} onChange={(e) => { setNumCol(e.target.value); setFtestResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={async () => { if (!groupCol || !groupVal1 || !groupVal2 || !numCol) return; const res = await quantisApi.analyzeFTestTwoSample(rows, groupCol, groupVal1, groupVal2, numCol); setFtestResult(res ?? null); }} disabled={!groupCol || !groupVal1 || !groupVal2 || !numCol} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy F-test</button>
          </div>
          {ftestResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả F-test hai mẫu cho phương sai</p>
              <p>F = {ftestResult.f.toFixed(4)}, df1 = {ftestResult.df1}, df2 = {ftestResult.df2}, p-value = {ftestResult.pValue < 0.001 ? "< 0.001" : ftestResult.pValue.toFixed(4)}</p>
              <p>Phương sai nhóm 1 = {ftestResult.var1.toFixed(4)} (n = {ftestResult.n1}), nhóm 2 = {ftestResult.var2.toFixed(4)} (n = {ftestResult.n2})</p>
            </div>
          )}
        </>
      )}
      {testKind === "ztest_means" && (
        <>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-2">z-Test hai mẫu cho trung bình khi đã biết phương sai tổng thể (known population variances).</p>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến nhóm</label>
              <select value={groupCol} onChange={(e) => { setGroupCol(e.target.value); setGroupVal1(""); setGroupVal2(""); setZtestMeansResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nhóm 1</label>
              <select value={groupVal1} onChange={(e) => { setGroupVal1(e.target.value); setZtestMeansResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Nhóm 2</label>
              <select value={groupVal2} onChange={(e) => { setGroupVal2(e.target.value); setZtestMeansResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {groupValues.map((v) => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến số</label>
              <select value={numCol} onChange={(e) => { setNumCol(e.target.value); setZtestMeansResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phương sai tổng thể nhóm 1 (σ²₁)</label>
              <input type="number" step="any" min="0" value={ztestKnownVar1} onChange={(e) => { setZtestKnownVar1(e.target.value); setZtestMeansResult(null); }} placeholder="VD: 4" className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24" />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Phương sai tổng thể nhóm 2 (σ²₂)</label>
              <input type="number" step="any" min="0" value={ztestKnownVar2} onChange={(e) => { setZtestKnownVar2(e.target.value); setZtestMeansResult(null); }} placeholder="VD: 9" className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24" />
            </div>
            <button type="button" onClick={async () => { if (!groupCol || !groupVal1 || !groupVal2 || !numCol || !ztestKnownVar1 || !ztestKnownVar2) return; const v1 = parseFloat(ztestKnownVar1); const v2 = parseFloat(ztestKnownVar2); if (Number.isNaN(v1) || Number.isNaN(v2) || v1 <= 0 || v2 <= 0) return; const res = await quantisApi.analyzeZTestTwoMeans(rows, groupCol, groupVal1, groupVal2, numCol, v1, v2); setZtestMeansResult(res ?? null); }} disabled={!groupCol || !groupVal1 || !groupVal2 || !numCol || !ztestKnownVar1 || !ztestKnownVar2} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">Chạy z-Test</button>
          </div>
          {ztestMeansResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả z-Test hai mẫu cho trung bình</p>
              <p>z = {ztestMeansResult.z.toFixed(4)}, p-value = {ztestMeansResult.pValue < 0.001 ? "< 0.001" : ztestMeansResult.pValue.toFixed(4)}</p>
              <p>Mean nhóm 1 = {ztestMeansResult.mean1.toFixed(2)} (n = {ztestMeansResult.n1}), Mean nhóm 2 = {ztestMeansResult.mean2.toFixed(2)} (n = {ztestMeansResult.n2})</p>
              <p className="text-neutral-600 dark:text-neutral-400 text-xs">Phương sai đã biết: σ²₁ = {ztestMeansResult.knownVar1}, σ²₂ = {ztestMeansResult.knownVar2}</p>
            </div>
          )}
        </>
      )}
      {testKind === "normality" && (
        <>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến số (kiểm tra phân phối chuẩn)</label>
              <select value={normalityCol} onChange={(e) => { setNormalityCol(e.target.value); setShapiroResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <button type="button" onClick={runShapiroWilk} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Chạy Shapiro-Wilk</button>
          </div>
          {shapiroResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Kết quả Shapiro-Wilk (kiểm tra phân phối chuẩn)</p>
              <p>W = {shapiroResult.w.toFixed(4)}, p-value = {shapiroResult.pValue < 0.001 ? "< 0.001" : shapiroResult.pValue.toFixed(4)}, n = {shapiroResult.n}</p>
              <p className="text-neutral-600 dark:text-neutral-400 mt-1">p &gt; 0.05: không đủ bằng chứng bác bỏ H0 (dữ liệu có thể chuẩn). p &lt; 0.05: dữ liệu có thể không chuẩn.</p>
            </div>
          )}
        </>
      )}
      {testKind === "power" && (
        <>
          <div className="flex flex-wrap gap-2 mb-4">
            <button type="button" onClick={() => { setSampleSizeKind("ttest"); clearResults(); }} className={`rounded-lg px-3 py-1.5 text-sm ${sampleSizeKind === "ttest" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>t-test</button>
            <button type="button" onClick={() => { setSampleSizeKind("proportion"); clearResults(); }} className={`rounded-lg px-3 py-1.5 text-sm ${sampleSizeKind === "proportion" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Tỉ lệ</button>
            <button type="button" onClick={() => { setSampleSizeKind("chisquare"); clearResults(); }} className={`rounded-lg px-3 py-1.5 text-sm ${sampleSizeKind === "chisquare" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Chi-square</button>
            <button type="button" onClick={() => { setSampleSizeKind("anova"); clearResults(); }} className={`rounded-lg px-3 py-1.5 text-sm ${sampleSizeKind === "anova" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>ANOVA</button>
            <button type="button" onClick={() => { setSampleSizeKind("regression"); clearResults(); }} className={`rounded-lg px-3 py-1.5 text-sm ${sampleSizeKind === "regression" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Hồi quy</button>
          </div>
          <div className="flex flex-wrap gap-4 items-end mb-4">
            {sampleSizeKind === "ttest" && (
              <div>
                <label className="block text-sm font-medium mb-1">Effect size (Cohen d)</label>
                <input type="number" step={0.05} min={0.1} max={2} value={effectSizeD} onChange={(e) => { setEffectSizeD(Math.max(0.1, Math.min(2, parseFloat(e.target.value) || 0.5))); setPowerResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24" />
              </div>
            )}
            {sampleSizeKind === "proportion" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">p₀ (tỉ lệ H₀)</label>
                  <input type="number" step={0.05} min={0.01} max={0.99} value={proportionP0} onChange={(e) => { setProportionP0(Math.max(0.01, Math.min(0.99, parseFloat(e.target.value) || 0.5))); setSampleSizeExtra(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">p₀ (tỉ lệ H₀)</label>
                  <input type="number" step={0.05} min={0.01} max={0.99} value={proportionP1} onChange={(e) => { setProportionP1(Math.max(0.01, Math.min(0.99, parseFloat(e.target.value) || 0.65))); setSampleSizeExtra(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
                </div>
              </>
            )}
            {sampleSizeKind === "chisquare" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Effect size (Cohen w)</label>
                  <input type="number" step={0.05} min={0.1} max={1} value={chiEffectW} onChange={(e) => { setChiEffectW(Math.max(0.1, Math.min(1, parseFloat(e.target.value) || 0.3))); setSampleSizeExtra(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">df (bằng)</label>
                  <input type="number" min={1} max={20} value={chiDf} onChange={(e) => { setChiDf(Math.max(1, Math.min(20, parseInt(e.target.value, 10) || 1))); setSampleSizeExtra(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-16" />
                </div>
              </>
            )}
            {sampleSizeKind === "anova" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Số nhóm (k)</label>
                  <input type="number" min={2} max={20} value={anovaK} onChange={(e) => { setAnovaK(Math.max(2, Math.min(20, parseInt(e.target.value, 10) || 3))); setSampleSizeExtra(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-16" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Effect size f</label>
                  <input type="number" step={0.05} min={0.1} max={1} value={anovaF} onChange={(e) => { setAnovaF(Math.max(0.1, Math.min(1, parseFloat(e.target.value) || 0.25))); setSampleSizeExtra(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
                </div>
              </>
            )}
            {sampleSizeKind === "regression" && (
              <>
                <div>
                  <label className="block text-sm font-medium mb-1">Số biến độc lập</label>
                  <input type="number" min={1} max={50} value={regressionP} onChange={(e) => { setRegressionP(Math.max(1, Math.min(50, parseInt(e.target.value, 10) || 5))); setSampleSizeExtra(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-20" />
                </div>
                <div>
                  <label className="block text-sm font-medium mb-1">Quy tắc</label>
                  <select value={regressionRule} onChange={(e) => { setRegressionRule(e.target.value as "10" | "20"); setSampleSizeExtra(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                    <option value="10">n ? 10 ? biến</option>
                    <option value="20">n ? 20 ? biến</option>
                  </select>
                </div>
              </>
            )}
            <button type="button" onClick={runPowerAnalysis} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Tính cỡ mẫu</button>
          </div>
          {powerResult && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Power analysis (t-test hai mẫu độc lập)</p>
              <p>Với d = {powerResult.effectSize.toFixed(2)}, ? = 0.05, power = 0.8: cần <strong>ít nhất {powerResult.nRequired} người</strong> (mỗi nhóm khoảng {Math.ceil(powerResult.nRequired / 2)}).</p>
            </div>
          )}
          {sampleSizeExtra && sampleSizeKind === "proportion" && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Cỡ mẫu (kiểm định tỉ lệ)</p>
              <p>Với p₀ = {(sampleSizeExtra as { p0: number }).p0.toFixed(2)}, p₁ = {(sampleSizeExtra as { p1: number }).p1.toFixed(2)}, α = 0.05, power = 0.8: cần <strong>ít nhất {(sampleSizeExtra as { nRequired: number }).nRequired} người</strong>.</p>
            </div>
          )}
          {sampleSizeExtra && sampleSizeKind === "chisquare" && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Cỡ mẫu (Chi-square)</p>
              <p>Với w = {(sampleSizeExtra as { effectSizeW: number }).effectSizeW.toFixed(2)}, df = {(sampleSizeExtra as { df: number }).df}, ? = 0.05, power = 0.8: cần <strong>ít nhất {(sampleSizeExtra as { nRequired: number }).nRequired} người</strong>.</p>
            </div>
          )}
          {sampleSizeExtra && sampleSizeKind === "anova" && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Cỡ mẫu (ANOVA một nhân tố)</p>
              <p>Với k = {(sampleSizeExtra as { k: number }).k} nhóm, f = {(sampleSizeExtra as { effectSizeF: number }).effectSizeF.toFixed(2)}, ? = 0.05, power = 0.8: cần <strong>ít nhất {(sampleSizeExtra as { nRequired: number }).nRequired} người</strong> (mỗi nhóm khoảng {(sampleSizeExtra as { nPerGroup: number }).nPerGroup}).</p>
            </div>
          )}
          {sampleSizeExtra && sampleSizeKind === "regression" && (
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm">
              <p className="font-medium mb-2">Cỡ mẫu (hồi quy tuyến tính)</p>
              <p>Với {(sampleSizeExtra as { nPredictors: number }).nPredictors} biến độc lập, quy tắc {(sampleSizeExtra as { rule: string }).rule}: cần <strong>ít nhất {(sampleSizeExtra as { nRequired: number }).nRequired} người</strong>.</p>
            </div>
          )}
        </>
      )}
    </div>
  );
}

function ReliabilityTab({ selectedDataset, rows, numericCols, analysisBackendAvailable = false }: { selectedDataset: Dataset; rows: string[][]; numericCols: string[]; analysisBackendAvailable?: boolean }) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const [cronbachBackendResult, setCronbachBackendResult] = useState<number | null>(null);
  const toggle = (c: string) => setSelectedItems((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]);
  useEffect(() => {
    if (!analysisBackendAvailable || selectedItems.length < 2) {
      setCronbachBackendResult(null);
      return;
    }
    quantisApi.analyzeCronbach(rows, selectedItems).then(setCronbachBackendResult);
  }, [analysisBackendAvailable, selectedItems.join(","), rows.length]);
  const alpha = (analysisBackendAvailable ? cronbachBackendResult : null) ??(selectedItems.length >= 2 ? computeCronbachAlpha(rows, selectedItems) : null);
  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">Độ tin cậy Cronbach&apos;s alpha</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">Chọn ít nhất 2 cột số (các item thang đo, ví dụ Likert) để ước lượng Độ tin cậy nội tại.</p>
      {analysisBackendAvailable && (
        <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
          <Cpu className="w-3.5 h-3.5" /> Alpha từ backend Python
        </p>
      )}
      <div className="mb-4">
        <AIAssistPanel
          metadata={selectedDataset ? `Dataset: ${selectedDataset.name}. Số cột số: ${numericCols.length}. Cột: ${numericCols.slice(0, 15).join(", ")}${numericCols.length > 15 ? "…" : ""}.` : undefined}
          context="Độ tin cậy Cronbach's alpha: đánh giá độ tin cậy nội tại của thang đo (các item đo cùng một khái niệm). Chọn ít nhất 2 cột số (item), alpha từ 0.7 trở lên thường được chấp nhận."
          quickPrompts={[{ label: "Giải thích Cronbach alpha", systemHint: "Bạn là chuyên gia đo lường. Giải thích Cronbach's alpha: độ tin cậy nội tại, thang diễn giải (α ≥ 0.9 rất tốt, 0.8 tốt, 0.7 chấp nhận được, <0.6 cần cải thiện). Gợi ý cách tăng alpha nếu thấp. Trả lời ngắn gọn bằng tiếng Việt." }]}
          title="Hỏi AI về độ tin cậy Cronbach"
        />
      </div>
      <div className="mb-4">
        <p className="text-sm font-medium mb-2">Chọn các item (cột):</p>
        <div className="flex flex-wrap gap-2">
          {numericCols.map((c) => (
            <button key={c} type="button" onClick={() => toggle(c)} className={`rounded-lg px-3 py-1.5 text-sm ${selectedItems.includes(c) ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>{c}</button>
          ))}
        </div>
      </div>
      {alpha != null && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
          <AIAssistPanel
            context={`Cronbach's alpha = ${alpha.toFixed(4)}. Số item: ${selectedItems.length}. Đánh giá: ${alpha >= 0.9 ? "Rất tốt" : alpha >= 0.8 ? "Tốt" : alpha >= 0.7 ? "Chấp nhận được" : alpha >= 0.6 ? "Cần cải thiện" : "Độ tin cậy thấp"}. Các item: ${selectedItems.join(", ")}.`}
            quickPrompts={[{ label: "Diễn giải Cronbach alpha", systemHint: "Bạn là chuyên gia đo lường. Giải thích Cronbach's alpha: độ tin cậy nội tại của thang đo (các item đo cùng một khái niệm). Thang diễn giải (α ≥ 0.9 rất tốt, 0.8 tốt, 0.7 chấp nhận được, <0.6 cần cải thiện). Gợi ý cách tăng alpha nếu thấp. Trả lời ngắn gọn bằng tiếng Việt." }]}
            title="Hỏi AI về Cronbach alpha"
          />
          <p className="font-medium">Cronbach&apos;s ? = {alpha.toFixed(4)}</p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {alpha >= 0.9 ? "Rất tốt." : alpha >= 0.8 ? "Tốt." : alpha >= 0.7 ? "Chấp nhận được." : alpha >= 0.6 ? "Cần cải thiện." : "Độ tin cậy thấp, cần xem xét lại thang đo."}
          </p>
        </div>
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
  const [showNewWorkflowDialog, setShowNewWorkflowDialog] = useState(false);
  const [newWorkflowName, setNewWorkflowName] = useState("");
  if (tab === "workflows") {
    const addWorkflow = (name: string) => {
      const id = generateId();
      const now = new Date().toISOString();
      const displayName = name.trim() || `Workflow ${workflows.length + 1}`;
      setWorkflows((prev) => [
        ...prev,
        { id, name: displayName, steps: [], datasetId: null, datasetIds: [], createdAt: now, updatedAt: now },
      ]);
      onSelectWorkflow(id);
      setShowNewWorkflowDialog(false);
      setNewWorkflowName("");
    };
    return (
      <div className="w-full max-w-full">
        <h2 className="text-xl font-semibold mb-2">Workflows</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">Lưu workflow phân tích, sinh script từ R, versioning dataset &amp; model.</p>
        <button type="button" onClick={() => { setShowNewWorkflowDialog(true); setNewWorkflowName(`Workflow ${workflows.length + 1}`); }} className="rounded-lg bg-brand text-white px-4 py-2 flex items-center gap-2 hover:opacity-90">
          <GitBranch className="w-4 h-4" /> Tạo workflow mới
        </button>
        {showNewWorkflowDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowNewWorkflowDialog(false); setNewWorkflowName(""); }}>
            <div className="rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl max-w-md w-full p-4" onClick={(e) => e.stopPropagation()}>
              <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200 mb-3">Tạo workflow mới</h3>
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">Tên workflow</label>
              <input
                type="text"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addWorkflow(newWorkflowName); if (e.key === "Escape") { setShowNewWorkflowDialog(false); setNewWorkflowName(""); } }}
                placeholder="VD: Phân tích khảo sát 2024"
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:ring-2 focus:ring-brand/50 focus:border-brand"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => { setShowNewWorkflowDialog(false); setNewWorkflowName(""); }} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600">Hủy</button>
                <button type="button" onClick={() => addWorkflow(newWorkflowName)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:opacity-90">Tạo</button>
              </div>
            </div>
          </div>
        )}
        {workflows.length > 0 && (
          <ul className="mt-4 space-y-2">
            {workflows.map((w) => (
              <li key={w.id} className="flex items-center justify-between p-3 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700">
                <button type="button" onClick={() => onSelectWorkflow(w.id)} className="text-left flex-1">
                  <p className="font-medium">{w.name}</p>
                  <span className="text-sm text-neutral-500">{w.steps.length} bước</span>
                </button>
                <button type="button" onClick={() => onSelectWorkflow(w.id)} className="text-brand text-sm">Mở</button>
              </li>
            ))}
          </ul>
        )}
        {selectedWorkflowId && (() => {
          const w = workflows.find((x) => x.id === selectedWorkflowId);
          if (!w) return null;
          const stepLabels: Record<WorkflowStep["type"], string> = { import: "Thu thập / Import dữ liệu", clean: "Làm sạch & kiểm tra chất lượng", transform: "Chuẩn bị biến & biến đổi", describe: "Thống kê mô tả (EDA)", test: "Kiểm định giả thuyết", model: "Hồi quy & mô hình", visualize: "Trực quan hóa", report: "Viết báo cáo" };
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
              {w.steps.length > 0 && (
                <AIAssistPanel
                  context={`Workflow: ${w.name}. Các bước: ${w.steps.map((s, i) => `${i + 1}. ${s.label} (${s.type})`).join("; ")}.`}
                  quickPrompts={[{ label: "Giải thích workflow", systemHint: "Bạn là chuyên gia phương pháp nghiên cứu. Giải thích ý nghĩa từng bước trong workflow (thu thập dữ liệu, làm sạch, biến đổi, mô tả, kiểm định, mô hình, trực quan, báo cáo). Gợi ý thứ tự thực hiện hợp lý và cách đảm bảo reproducibility. Trả lời ngắn gọn bằng tiếng Việt." }]}
                  title="Hỏi AI về workflow"
                />
              )}
              <div className="flex flex-wrap items-end gap-2 mb-3">
                <select value={newStepType} onChange={(e) => setNewStepType(e.target.value as WorkflowStep["type"])} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm">
                  {(["import", "clean", "transform", "describe", "test", "model", "visualize", "report"] as const).map((t) => (
                    <option key={t} value={t}>{stepLabels[t]}</option>
                  ))}
                </select>
                <input type="text" value={newStepLabel} onChange={(e) => setNewStepLabel(e.target.value)} placeholder="Nhãn (tùy chọn)" className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-40" />
                <button type="button" onClick={addStep} className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm">Thêm bước</button>
                <button type="button" onClick={() => { navigator.clipboard.writeText(rScript); showToast("Đã sao chép script R"); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm">Sao chép script R</button>
              </div>
              {w.steps.length === 0 ? <p className="text-sm text-neutral-500">Chưa có bước. Nhấn Thêm bước.</p> : (
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  {w.steps.map((s) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span>{s.label} ({s.type}){s.note ? ` — ${s.note}` : ""}</span>
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
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">Versioning &amp; audit</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">Version dataset và model, audit trail cho nghiên cứu.</p>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm text-neutral-500">
        Lịch sử phiên bản và nhật ký thay đổi hiển thị khi kết nối backend. Khi có backend, mỗi lần lưu dữ liệu sẽ tạo bản snapshot để so sánh và khôi phục.
      </div>
    </div>
  );
}

function formatAPA(result: { type: "ttest" | "chisquare" | "anova" | "mannwhitney"; payload: TTestResult | ChiSquareResult | ANOVAResult | MannWhitneyResult; meta?: Record<string, string> }): string {
  if (result.type === "ttest") {
    const r = result.payload as TTestResult;
    const p = r.pValue < 0.001 ? "p < .001" : `p = ${r.pValue.toFixed(3).replace(/^0/, "")}`;
    return `Kiểm định t hai mẫu độc lập cho thấy sự khác biệt có ý nghĩa giữa hai nhóm, t(${r.df.toFixed(0)}) = ${r.t.toFixed(2)}, ${p}, Cohen's d = ${r.cohenD.toFixed(2)}. Nhóm 1: M = ${r.mean1.toFixed(2)}, SD = ${r.std1.toFixed(2)}, n = ${r.n1}; Nhóm 2: M = ${r.mean2.toFixed(2)}, SD = ${r.std2.toFixed(2)}, n = ${r.n2}.`;
  }
  if (result.type === "chisquare") {
    const r = result.payload as ChiSquareResult;
    const p = r.pValue < 0.001 ? "p < .001" : `p = ${r.pValue.toFixed(3).replace(/^0/, "")}`;
    return `Kiểm định Chi-square độc lập cho thấy mối liên hệ có ý nghĩa giữa hai biến, χ²(${r.df}) = ${r.chi2.toFixed(2)}, ${p}.`;
  }
  if (result.type === "anova") {
    const r = result.payload as ANOVAResult;
    const p = r.pValue < 0.001 ? "p < .001" : `p = ${r.pValue.toFixed(3).replace(/^0/, "")}`;
    return `ANOVA một nhân tố cho thấy hiệu ứng có ý nghĩa, F(${r.dfBetween}, ${r.dfWithin}) = ${r.f.toFixed(2)}, ${p}, η² = ${r.etaSq.toFixed(3)}.`;
  }
  if (result.type === "mannwhitney") {
    const r = result.payload as MannWhitneyResult;
    const p = r.pValue < 0.001 ? "p < .001" : `p = ${r.pValue.toFixed(3).replace(/^0/, "")}`;
    return `Kiểm định Mann-Whitney U (phi tham số) cho thấy sự khác biệt có ý nghĩa giữa hai nhóm, U = ${r.u.toFixed(0)}, z = ${r.z.toFixed(2)}, ${p}. Nhóm 1: Mdn = ${r.median1.toFixed(2)}, n = ${r.n1}; Nhóm 2: Mdn = ${r.median2.toFixed(2)}, n = ${r.n2}.`;
  }
  return "";
}

function PresentationView({ tab, onTabChange, selectedDataset, lastHypothesisResult, analysisBackendAvailable = false, chartType }: { tab: PresentationTab; onTabChange?: (t: PresentationTab) => void; selectedDataset: Dataset | undefined; lastHypothesisResult?: { type: "ttest" | "chisquare" | "anova" | "mannwhitney"; payload: TTestResult | ChiSquareResult | ANOVAResult | MannWhitneyResult; meta?: Record<string, string> } | null; analysisBackendAvailable?: boolean; chartType: "scatter" | "bar" | "line" | "pie" | "box" | "histogram" | "area" | "stackedBar" | "radar" | "heatmap" | "summary" | "donut" | "barH" | "dashboard" | "multiLine" | "crosstab"; setChartType: (t: "scatter" | "bar" | "line" | "pie" | "box" | "histogram" | "area" | "stackedBar" | "radar" | "heatmap" | "summary" | "donut" | "barH" | "dashboard" | "multiLine" | "crosstab") => void }) {
  const [chartXCol, setChartXCol] = useState("");
  const [chartYCol, setChartYCol] = useState("");
  const [histogramCol, setHistogramCol] = useState("");
  const [stackByCol, setStackByCol] = useState("");
  const [heatmapCorrMethod, setHeatmapCorrMethod] = useState<"pearson" | "spearman" | "kendall">("pearson");
  const [radarGroupCol, setRadarGroupCol] = useState("");
  const [radarNumericCols, setRadarNumericCols] = useState<string[]>([]);
  const [multiLineYCols, setMultiLineYCols] = useState<string[]>([]);
  const [crosstabCol1, setCrosstabCol1] = useState("");
  const [crosstabCol2, setCrosstabCol2] = useState("");
  const chartContainerRef = useRef<HTMLDivElement>(null);
  const [boxStatsBackendResult, setBoxStatsBackendResult] = useState<Array<{ group: string; min: number; q1: number; median: number; q3: number; max: number; n: number }> | null>(null);
  const [histBinsBackendResult, setHistBinsBackendResult] = useState<Array<{ binStart: number; binEnd: number; count: number }> | null>(null);
  const PIE_COLORS = ["#0061bb", "#3b82f6", "#f59e0b", "#ef4444", "#8b5cf6", "#ec4899", "#06b6d4"];

  useEffect(() => {
    if (tab !== "visualization" || !selectedDataset || chartType !== "box" || !chartXCol || !chartYCol || !analysisBackendAvailable) {
      setBoxStatsBackendResult(null);
      return;
    }
    const rows = getDataRows(selectedDataset);
    quantisApi.analyzeBoxStats(rows, chartXCol, chartYCol).then(setBoxStatsBackendResult);
  }, [tab, selectedDataset?.id, chartType, chartXCol, chartYCol, analysisBackendAvailable]);

  useEffect(() => {
    if (tab !== "visualization" || !selectedDataset || chartType !== "histogram" || !histogramCol || !analysisBackendAvailable) {
      setHistBinsBackendResult(null);
      return;
    }
    const rows = getDataRows(selectedDataset);
    const cols = selectedDataset.columnNames || [];
    const histColIdx = cols.indexOf(histogramCol);
    const histValues = histColIdx >= 0 ? rows.slice(1).map((r) => Number(r[histColIdx])).filter((v) => !Number.isNaN(v)) : [];
    if (histValues.length === 0) { setHistBinsBackendResult(null); return; }
    quantisApi.analyzeHistogramBins(histValues).then(setHistBinsBackendResult);
  }, [tab, selectedDataset?.id, chartType, histogramCol, analysisBackendAvailable]);

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
    const barData = !isScatter && xCol && xIdx >= 0 ? (() => { const counts: Record<string, number> = {}; rows.slice(1).forEach((r) => { const v = r[xIdx] ??""; counts[v] = (counts[v] || 0) + 1; }); return Object.entries(counts).map(([name, count]) => ({ name, count })).slice(0, 20); })() : [];
    const boxStats = (chartType === "box" && xCol && yCol && numericCols.includes(yCol))
      ? (analysisBackendAvailable && boxStatsBackendResult ? boxStatsBackendResult : getBoxStatsByGroup(rows, xCol, yCol))
      : [];
    const boxChartData = boxStats.map((b) => ({ name: b.group, median: b.median, min: b.min, max: b.max, q1: b.q1, q3: b.q3, n: b.n }));
    const histColIdx = cols.indexOf(histogramCol);
    const histValues = histogramCol && histColIdx >= 0 ? rows.slice(1).map((r) => Number(r[histColIdx])).filter((v) => !Number.isNaN(v)) : [];
    const histBins = histValues.length > 0 ? (analysisBackendAvailable && histBinsBackendResult ? histBinsBackendResult : getHistogramBins(histValues)) : [];
    const histChartData = histBins.map((b) => ({ name: b.binStart.toFixed(1) + "?" + b.binEnd.toFixed(1), count: b.count }));
    const pieData = barData.length > 0 ? barData.map((d) => ({ name: d.name, value: d.count })) : [];
    const lineData = rows.length >= 2 && xIdx >= 0 && yIdx >= 0
      ? rows.slice(1).map((r) => ({ x: r[xIdx] ??"", y: Number(r[yIdx]) })).filter((d) => !Number.isNaN(d.y))
      : [];
    const areaData = lineData;
    const stackByIdx = stackByCol ? cols.indexOf(stackByCol) : -1;
    const stackedBarData = (chartType === "stackedBar" && xCol && stackByCol && yCol && xIdx >= 0 && yIdx >= 0 && stackByIdx >= 0 && rows.length >= 2) ? (() => {
      const xVals = Array.from(new Set(rows.slice(1).map((r) => r[xIdx] ??"")));
      const stackVals = Array.from(new Set(rows.slice(1).map((r) => r[stackByIdx] ??"")));
      const map: Record<string, Record<string, number>> = {};
      xVals.forEach((x) => { map[x] = {}; stackVals.forEach((s) => { map[x][s] = 0; }); });
      rows.slice(1).forEach((r) => {
        const x = r[xIdx] ??"";
        const s = r[stackByIdx] ??"";
        const y = Number(r[yIdx]);
        if (!Number.isNaN(y) && map[x] && map[x][s] !== undefined) map[x][s] += y;
      });
      return xVals.slice(0, 25).map((name) => ({ name, ...map[name] }));
    })() : [];
    const radarGroups = (radarGroupCol && rows.length >= 2) ? Array.from(new Set(rows.slice(1).map((r) => r[cols.indexOf(radarGroupCol)] ?? ""))) : ["Toàn bộ"];
    const radarData = (chartType === "radar" && radarNumericCols.length >= 2) ? (() => {
      const groupIdx = radarGroupCol ? cols.indexOf(radarGroupCol) : -1;
      const fullMark = 100;
      return radarNumericCols.map((col) => {
        const colIdx = cols.indexOf(col);
        const entry: Record<string, number | string> = { subject: col.length > 14 ? col.slice(0, 12) + "?" : col, fullMark };
        radarGroups.forEach((g) => {
          const subset = rows.slice(1).filter((r) => groupIdx < 0 || (r[groupIdx] ??"") === g);
          const vals = subset.map((r) => Number(r[colIdx])).filter((v) => !Number.isNaN(v));
          entry[g] = vals.length ? vals.reduce((a, b) => a + b, 0) / vals.length : 0;
        });
        return entry;
      });
    })() : [];
    const corrResult = (chartType === "heatmap" && rows.length >= 2) ? computeCorrelationMatrix(rows, heatmapCorrMethod) : null;
    const summaryStats = (chartType === "summary" && rows.length >= 2) ? computeDescriptive(rows) : [];
    const dashboardCorrResult = (chartType === "dashboard" && rows.length >= 2) ? computeCorrelationMatrix(rows, "pearson") : null;
    const dashboardStats = (chartType === "dashboard" && rows.length >= 2) ? computeDescriptive(rows) : [];
    const multiLineXIdx = chartType === "multiLine" && chartXCol ? cols.indexOf(chartXCol) : -1;
    const multiLineData = (chartType === "multiLine" && multiLineXIdx >= 0 && multiLineYCols.length > 0 && rows.length >= 2) ? (() => {
      const yIndices = multiLineYCols.map((c) => cols.indexOf(c)).filter((i) => i >= 0);
      if (yIndices.length === 0) return [];
      return rows.slice(1).map((r) => {
        const point: Record<string, string | number> = { x: r[multiLineXIdx] ??"" };
        multiLineYCols.forEach((col) => {
          const idx = cols.indexOf(col);
          if (idx >= 0) { const v = Number(r[idx]); point[col] = Number.isNaN(v) ? "" : v; }
        });
        return point;
      }).filter((d) => multiLineYCols.some((c) => d[c] !== "" && d[c] !== undefined));
    })() : [];
    const crosstabResult: { rowLabels: string[]; colLabels: string[]; counts: number[][] } | null = (chartType === "crosstab" && crosstabCol1 && crosstabCol2 && rows.length >= 2) ? getCrosstab(rows, crosstabCol1, crosstabCol2) : null;

    const visualizationContext = [
      selectedDataset ? `Bộ dữ liệu: ${selectedDataset.name}, ${rows.length} hàng, ${cols.length} cột.` : "",
      `Loại biểu đồ: ${chartType}.`,
      (chartType === "scatter" || chartType === "line" || chartType === "area") && xCol && yCol
        ? `Trục X: ${xCol}, Trục Y: ${yCol}. Số điểm: ${chartData.length}.`
        : "",
      (chartType === "bar" || chartType === "barH" || chartType === "pie" || chartType === "donut") && xCol
        ? `Biến: ${xCol}. Số nhóm: ${barData.length}.`
        : "",
      chartType === "box" && xCol && yCol
        ? `Nhóm: ${xCol}, Giá trị: ${yCol}. Số nhóm: ${boxChartData.length}.`
        : "",
      chartType === "histogram" && histogramCol
        ? `Biến: ${histogramCol}. Số bins: ${histChartData.length}.`
        : "",
      chartType === "heatmap" ? "Heatmap ma trận tương quan." : "",
      chartType === "radar" && radarNumericCols.length > 0
        ? `Các trục: ${radarNumericCols.slice(0, 6).join(", ")}${radarNumericCols.length > 6 ? "..." : ""}.`
        : "",
      chartType === "multiLine" && chartXCol ? `Trục X: ${chartXCol}, nhiều biến Y.` : "",
      chartType === "crosstab" && crosstabCol1 && crosstabCol2
        ? `Bảng chéo: ${crosstabCol1} × ${crosstabCol2}.`
        : "",
    ].filter(Boolean).join(" ");

    const visualizationQuickPrompts: AIQuickPrompt[] = [
      { label: "Diễn giải biểu đồ / insight chính", systemHint: "Bạn là chuyên gia phân tích dữ liệu và trực quan hóa. Dựa trên mô tả biểu đồ và dữ liệu, nêu ý nghĩa, xu hướng hoặc insight chính; gợi ý cách đọc biểu đồ. Trả lời ngắn gọn bằng tiếng Việt.", userMessage: "Diễn giải biểu đồ này và nêu insight chính từ dữ liệu." },
      { label: "Gợi ý loại biểu đồ phù hợp hơn", systemHint: "Bạn là chuyên gia trực quan hóa. Gợi ý loại biểu đồ (scatter, bar, line, box, histogram, heatmap...) phù hợp hơn với dữ liệu và mục tiêu trình bày. Giải thích ngắn gọn. Trả lời bằng tiếng Việt.", userMessage: "Gợi ý loại biểu đồ nào phù hợp hơn với dữ liệu này?" },
      { label: "Viết chú thích (caption) cho biểu đồ", systemHint: "Bạn là chuyên gia báo cáo khoa học. Viết một câu chú thích (figure caption) ngắn gọn cho biểu đồ, mô tả nội dung và nguồn dữ liệu. Trả lời bằng tiếng Việt.", userMessage: "Viết chú thích (caption) cho biểu đồ này." },
      { label: "Giải thích cách đọc biểu đồ", systemHint: "Bạn là chuyên gia thống kê. Giải thích cách đọc biểu đồ hiện tại: trục, đơn vị, ý nghĩa màu/size nếu có, cách rút ra kết luận. Trả lời ngắn gọn bằng tiếng Việt.", userMessage: "Giải thích cách đọc biểu đồ này." },
    ];

    return (
      <div ref={chartContainerRef} className="w-full max-w-full">
        <h2 className="text-xl font-semibold mb-2">Biểu đồ</h2>
        {(chartType === "box" || chartType === "histogram") && analysisBackendAvailable && (
          <p className="text-xs text-emerald-600 dark:text-emerald-400 mb-2 flex items-center gap-1">
            <Cpu className="w-3.5 h-3.5" /> Box plot / Histogram từ backend Python (numpy/scipy)
          </p>
        )}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <span className="text-sm font-medium text-neutral-700 dark:text-neutral-300">AI hỗ trợ trực quan:</span>
          <AIAssistPanel
            context={visualizationContext}
            quickPrompts={visualizationQuickPrompts}
            defaultSystemHint="Bạn là chuyên gia trực quan hóa dữ liệu và phân tích. Diễn giải biểu đồ, gợi ý loại biểu đồ, viết caption hoặc nêu insight. Trả lời ngắn gọn bằng tiếng Việt."
            title="Hỏi AI về biểu đồ"
            includeStandardResultPrompts={false}
          />
        </div>
        {(() => {
          const hasExportableChart = (chartType === "scatter" && chartData.length > 0) || (chartType === "bar" && !isScatter && barData.length > 0) || (chartType === "barH" && barData.length > 0) || (chartType === "line" && lineData.length > 0) || (chartType === "pie" && pieData.length > 0) || (chartType === "donut" && pieData.length > 0) || (chartType === "area" && areaData.length > 0) || (chartType === "stackedBar" && stackedBarData.length > 0) || (chartType === "box" && boxChartData.length > 0) || (chartType === "histogram" && histChartData.length > 0) || (chartType === "radar" && radarData.length > 0) || (chartType === "multiLine" && multiLineData.length > 0);
          const handleExportSvg = () => {
            const el = chartContainerRef.current?.querySelector("svg");
            if (!el) return;
            const svg = new XMLSerializer().serializeToString(el);
            const blob = new Blob([svg], { type: "image/svg+xml" });
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.download = `quantis-${chartType}.svg`;
            a.click();
            URL.revokeObjectURL(a.href);
          };
          const handleExportPng = () => {
            const el = chartContainerRef.current?.querySelector("svg");
            if (!el) return;
            const svg = new XMLSerializer().serializeToString(el);
            const svgBlob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" });
            const url = URL.createObjectURL(svgBlob);
            const img = new Image();
            img.onload = () => {
              const canvas = document.createElement("canvas");
              canvas.width = img.width;
              canvas.height = img.height;
              const ctx = canvas.getContext("2d");
              if (ctx) {
                ctx.fillStyle = "white";
                ctx.fillRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0);
                canvas.toBlob((blob) => {
                  if (blob) {
                    const a = document.createElement("a");
                    a.href = URL.createObjectURL(blob);
                    a.download = `quantis-${chartType}.png`;
                    a.click();
                    URL.revokeObjectURL(a.href);
                  }
                }, "image/png");
              }
              URL.revokeObjectURL(url);
            };
            img.onerror = () => URL.revokeObjectURL(url);
            img.src = url;
          };
          return hasExportableChart ? (
            <div className="mb-3 flex items-center gap-2">
              <button type="button" onClick={handleExportSvg} className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                <Download className="w-4 h-4" /> Xuất SVG
              </button>
              <button type="button" onClick={handleExportPng} className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                <Download className="w-4 h-4" /> Xuất PNG
              </button>
            </div>
          ) : null;
        })()}
        {(chartType === "scatter" || chartType === "bar" || chartType === "line" || chartType === "pie" || chartType === "area") && (
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
        )}
        {chartType === "stackedBar" && (
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Trục X (danh mục)</label>
              <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Chồng theo (danh mục)</label>
              <select value={stackByCol} onChange={(e) => setStackByCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.filter((c) => c !== xCol).map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Giá trị (số)</label>
              <select value={yCol} onChange={(e) => setYCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
        {chartType === "radar" && (
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Cột nhóm (tùy chọn)</label>
              <select value={radarGroupCol} onChange={(e) => setRadarGroupCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Không nhóm —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div className="w-full">
              <label className="block text-sm font-medium mb-1">Các trục số (chọn tối đa 8)</label>
              <div className="flex flex-wrap gap-2">
                {numericCols.slice(0, 16).map((c) => {
                  const checked = radarNumericCols.includes(c);
                  const canAdd = checked || radarNumericCols.length < 8;
                  return (
                    <label key={c} className={`flex items-center gap-1.5 text-sm ${!canAdd ? "opacity-50" : ""}`}>
                      <input type="checkbox" checked={checked} disabled={!canAdd} onChange={() => setRadarNumericCols((prev) => checked ? prev.filter((x) => x !== c) : prev.length < 8 ? [...prev, c] : prev)} className="rounded border-neutral-400" />
                      {c.length > 18 ? c.slice(0, 16) + "…" : c}
                    </label>
                  );
                })}
              </div>
            </div>
          </div>
        )}
        {chartType === "heatmap" && (
          <div className="flex flex-wrap gap-4 mb-4">
            <span className="text-sm font-medium">Hệ số:</span>
            <button type="button" onClick={() => setHeatmapCorrMethod("pearson")} className={`rounded-lg px-3 py-1.5 text-sm ${heatmapCorrMethod === "pearson" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Pearson</button>
            <button type="button" onClick={() => setHeatmapCorrMethod("spearman")} className={`rounded-lg px-3 py-1.5 text-sm ${heatmapCorrMethod === "spearman" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Spearman</button>
            <button type="button" onClick={() => setHeatmapCorrMethod("kendall")} className={`rounded-lg px-3 py-1.5 text-sm ${heatmapCorrMethod === "kendall" ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}>Kendall</button>
            {corrResult && corrResult.columnNames.length >= 2 && (
              <button
                type="button"
                onClick={() => {
                  const headers = ["", ...corrResult!.columnNames];
                  const rows = corrResult!.matrix.map((row, i) => [corrResult!.columnNames[i], ...row.map((v) => v.toFixed(4))]);
                  const csv = [headers.join(","), ...rows.map((r) => r.join(","))].join("\n");
                  const blob = new Blob(["\uFEFF" + csv], { type: "text/csv;charset=utf-8" });
                  const a = document.createElement("a");
                  a.href = URL.createObjectURL(blob);
                  a.download = `quantis-correlation-${heatmapCorrMethod}.csv`;
                  a.click();
                  URL.revokeObjectURL(a.href);
                }}
                className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700"
              >
                <Download className="w-4 h-4" /> Xuất CSV
              </button>
            )}
          </div>
        )}
        {chartType === "donut" && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Cột phân loại</label>
            <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">— Chọn —</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        {chartType === "barH" && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Trục (danh mục)</label>
            <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">— Chọn —</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        {chartType === "box" && (
          <div className="flex flex-wrap gap-4 mb-4">
            <div>
              <label className="block text-sm font-medium mb-1">Biến nhóm (trục X)</label>
              <select value={xCol} onChange={(e) => setXCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {cols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Biến số (trục Y)</label>
              <select value={yCol} onChange={(e) => setYCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
                <option value="">— Chọn —</option>
                {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
              </select>
            </div>
          </div>
        )}
        {chartType === "histogram" && (
          <div className="mb-4">
            <label className="block text-sm font-medium mb-1">Cột số (phân bố)</label>
            <select value={histogramCol} onChange={(e) => setHistogramCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">— Chọn —</option>
              {numericCols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        )}
        {chartType === "scatter" && isScatter && chartData.length > 0 && (
          <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <ScatterChart margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid />
                <XAxis dataKey="x" name={xCol} />
                <YAxis dataKey="y" name={yCol} />
                <Tooltip cursor={{ strokeDasharray: "3 3" }} />
                <Scatter data={chartData} fill="#0061bb" name="điểm" />
              </ScatterChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartType === "scatter" && (() => {
          if (!xCol || !yCol) return <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">Chưa chọn trục: cần chọn <strong>Trục X</strong> và <strong>Trục Y</strong> (cả hai đều phải là cột số) để vẽ scatter.</p>;
          if (!numericCols.includes(xCol)) return <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">Không vẽ được scatter: cột trục X <strong>"{xCol}"</strong> không phải cột số (chứa chữ hoặc rỗng). Scatter cần hai cột toàn giá trị số — hãy chọn cột số khác cho trục X.</p>;
          if (!numericCols.includes(yCol)) return <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">Không vẽ được scatter: cột trục Y <strong>"{yCol}"</strong> không phải cột số. Hủy chọn cột số cho trục Y.</p>;
          if (chartData.length === 0) return <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">Không vẽ được: không có dữ liệu cặp (X, Y) hợp lệ. Hai cột <strong>"{xCol}"</strong> và <strong>"{yCol}"</strong> có thể toàn ô trống hoặc giá trị không phải số. Kiểm tra lại dữ liệu.</p>;
          return null;
        })()}
        {chartType === "bar" && !isScatter && barData.length > 0 && (
          <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" />
                <YAxis />
                <Tooltip />
                <Bar dataKey="count" fill="#0061bb" name="Số lượng" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartType === "barH" && xCol && barData.length > 0 && (
          <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={barData} layout="vertical" margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis type="number" />
                <YAxis type="category" dataKey="name" width={100} />
                <Tooltip />
                <Bar dataKey="count" fill="#0061bb" name="Số lượng" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartType === "line" && lineData.length > 0 && (
          <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={lineData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" name={xCol} tick={{ fontSize: 11 }} />
                <YAxis dataKey="y" name={yCol} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Line type="monotone" dataKey="y" stroke="#0061bb" strokeWidth={2} dot={{ r: 4 }} name={yCol || "Giá trị"} />
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartType === "pie" && pieData.length > 0 && (
          <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label={({ name, percent }) => `${name} ${(percent != null ? percent * 100 : 0).toFixed(0)}%`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Số lượng"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartType === "donut" && pieData.length > 0 && (
          <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <PieChart>
                <Pie data={pieData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} innerRadius={60} label={({ name, percent }) => `${name} ${(percent != null ? percent * 100 : 0).toFixed(0)}%`}>
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                  ))}
                </Pie>
                <Tooltip formatter={(v: number) => [v, "Số lượng"]} />
              </PieChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartType === "box" && boxChartData.length > 0 && (
          <>
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 mb-2">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={boxChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip formatter={(val: number, name: string) => [val.toFixed(2), name]} />
                  <Bar dataKey="median" fill="#0061bb" name="Trung vị" />
                </BarChart>
              </ResponsiveContainer>
            </div>
            <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm">
              <table className="w-full">
                <thead><tr className="border-b border-neutral-200 dark:border-neutral-700"><th className="p-2 text-left">Nhóm</th><th className="p-2 text-right">n</th><th className="p-2 text-right">Min</th><th className="p-2 text-right">Q1</th><th className="p-2 text-right">Median</th><th className="p-2 text-right">Q3</th><th className="p-2 text-right">Max</th></tr></thead>
                <tbody>
                  {boxStats.map((b) => (
                    <tr key={b.group} className="border-b border-neutral-100 dark:border-neutral-700/50">
                      <td className="p-2 font-medium">{b.group}</td><td className="p-2 text-right">{b.n}</td>
                      <td className="p-2 text-right">{b.min.toFixed(2)}</td><td className="p-2 text-right">{b.q1.toFixed(2)}</td><td className="p-2 text-right">{b.median.toFixed(2)}</td><td className="p-2 text-right">{b.q3.toFixed(2)}</td><td className="p-2 text-right">{b.max.toFixed(2)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        {chartType === "histogram" && histChartData.length > 0 && (
          <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={histChartData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="name" label={{ value: histogramCol, position: "insideBottom", offset: -5 }} />
                <YAxis label={{ value: "Tần số", angle: -90, position: "insideLeft" }} />
                <Tooltip />
                <Bar dataKey="count" fill="#0061bb" name="Tần số" />
              </BarChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartType === "area" && areaData.length > 0 && (
          <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <AreaChart data={areaData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" name={xCol} tick={{ fontSize: 11 }} />
                <YAxis dataKey="y" name={yCol} tick={{ fontSize: 11 }} />
                <Tooltip />
                <Area type="monotone" dataKey="y" stroke="#0061bb" fill="#0061bb" fillOpacity={0.4} name={yCol || "Giá trị"} />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartType === "stackedBar" && stackedBarData.length > 0 && (() => {
          const stackKeys = Object.keys(stackedBarData[0] || {}).filter((k) => k !== "name");
          return (
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={stackedBarData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" />
                  <YAxis />
                  <Tooltip />
                  <Legend />
                  {stackKeys.map((key, i) => (
                    <Bar key={key} dataKey={key} stackId="stack" fill={PIE_COLORS[i % PIE_COLORS.length]} name={key.length > 16 ? key.slice(0, 14) + "?" : key} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
        {chartType === "radar" && radarData.length > 0 && (() => {
          const radarKeys = Object.keys(radarData[0] || {}).filter((k) => k !== "subject" && k !== "fullMark");
          return (
            <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="subject" />
                  <PolarRadiusAxis angle={90} domain={[0, "auto"]} />
                  {radarKeys.map((key, i) => (
                    <Radar key={key} name={key} dataKey={key} stroke={PIE_COLORS[i % PIE_COLORS.length]} fill={PIE_COLORS[i % PIE_COLORS.length]} fillOpacity={0.3} strokeWidth={2} />
                  ))}
                  <Legend />
                </RadarChart>
              </ResponsiveContainer>
            </div>
          );
        })()}
        {chartType === "multiLine" && multiLineData.length > 0 && multiLineYCols.length > 0 && (
          <div className="h-80 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
            <ResponsiveContainer width="100%" height="100%">
              <LineChart data={multiLineData} margin={{ top: 20, right: 20, bottom: 20, left: 20 }}>
                <CartesianGrid strokeDasharray="3 3" />
                <XAxis dataKey="x" tick={{ fontSize: 11 }} />
                <YAxis tick={{ fontSize: 11 }} />
                <Tooltip />
                <Legend />
                {multiLineYCols.map((col, i) => (
                  <Line key={col} type="monotone" dataKey={col} stroke={PIE_COLORS[i % PIE_COLORS.length]} strokeWidth={2} dot={{ r: 3 }} name={col.length > 14 ? col.slice(0, 12) + "?" : col} />
                ))}
              </LineChart>
            </ResponsiveContainer>
          </div>
        )}
        {chartType === "crosstab" && crosstabResult && (
          <div className="space-y-3">
            <AIAssistPanel
              context={`Bảng chéo trực quan: hàng ${crosstabCol1}, cột ${crosstabCol2}. Hàng: ${crosstabResult.rowLabels.join(", ")}. Cột: ${crosstabResult.colLabels.join(", ")}. Tổng: ${crosstabResult.counts.reduce((a, row) => a + row.reduce((b, c) => b + c, 0), 0)}.`}
              quickPrompts={[{ label: "Diễn giải bảng chéo", systemHint: "Bạn là chuyên gia thống kê. Giải thích bảng chéo (tần số chéo hai biến phân loại) và cách đọc biểu đồ cột chồng: so sánh tỉ lệ giữa các nhóm. Trả lời ngắn gọn bằng tiếng Việt." }]}
              title="Hỏi AI về bảng chéo"
            />
            <div className="overflow-x-auto rounded-lg border border-neutral-200 dark:border-neutral-700">
              <table className="w-full text-sm border-collapse">
                <thead>
                  <tr>
                    <th className="p-2 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-left font-medium">{crosstabCol1} \\ {crosstabCol2}</th>
                    {crosstabResult.colLabels.map((l) => (
                      <th key={l} className="p-2 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-left font-medium">{l}</th>
                    ))}
                    <th className="p-2 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-right font-medium">Từng</th>
                  </tr>
                </thead>
                <tbody>
                  {crosstabResult.rowLabels.map((rowLabel, i) => {
                    const rowCounts = crosstabResult.counts[i];
                    const rowSum = rowCounts.reduce((a, b) => a + b, 0);
                    return (
                      <tr key={rowLabel}>
                        <td className="p-2 border border-neutral-200 dark:border-neutral-600 font-medium">{rowLabel}</td>
                        {rowCounts.map((v, j) => (
                          <td key={j} className="p-2 border border-neutral-200 dark:border-neutral-600 text-right">{v}</td>
                        ))}
                        <td className="p-2 border border-neutral-200 dark:border-neutral-600 text-right font-medium">{rowSum}</td>
                      </tr>
                    );
                  })}
                  <tr className="bg-neutral-50 dark:bg-neutral-800/50">
                    <td className="p-2 border border-neutral-200 dark:border-neutral-600 font-medium">Từng</td>
                    {crosstabResult.colLabels.map((_, j) => {
                      const colSum = crosstabResult.counts.reduce((acc, row) => acc + row[j], 0);
                      return <td key={j} className="p-2 border border-neutral-200 dark:border-neutral-600 text-right font-medium">{colSum}</td>;
                    })}
                    <td className="p-2 border border-neutral-200 dark:border-neutral-600 text-right font-medium">{crosstabResult.counts.reduce((a, row) => a + row.reduce((b, c) => b + c, 0), 0)}</td>
                  </tr>
                </tbody>
              </table>
            </div>
            <div className="h-64 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={crosstabResult.rowLabels.map((name, i) => ({ name: name.length > 10 ? name.slice(0, 8) + "?" : name, ...Object.fromEntries(crosstabResult.colLabels.map((col, j) => [col, crosstabResult.counts[i][j]])), total: crosstabResult.counts[i].reduce((a, b) => a + b, 0) }))} margin={{ top: 10, right: 10, bottom: 10, left: 10 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 10 }} />
                  <YAxis tick={{ fontSize: 10 }} />
                  <Tooltip />
                  <Legend />
                  {crosstabResult.colLabels.slice(0, 8).map((col, i) => (
                    <Bar key={col} dataKey={col} stackId="ct" fill={PIE_COLORS[i % PIE_COLORS.length]} name={col.length > 12 ? col.slice(0, 10) + "?" : col} />
                  ))}
                </BarChart>
              </ResponsiveContainer>
            </div>
          </div>
        )}
        {chartType === "heatmap" && corrResult && (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto overflow-y-auto max-h-96 space-y-2">
            <div className="p-2">
              <AIAssistPanel
                context={`Ma trận tương quan (trực quan): ${corrResult.columnNames.join(", ")}. Mẫu hệ số: ${corrResult.matrix.slice(0, 3).map((row, i) => `${corrResult.columnNames[i]}: ${row.slice(0, 4).map((v) => v.toFixed(2)).join(", ")}`).join("; ")}.`}
                quickPrompts={[{ label: "Giải thích ma trận tương quan", systemHint: "Bạn là chuyên gia thống kê. Giải thích ma trận tương quan và heatmap: màu sắc thể hiện cường độ tương quan (dương/âm), cách đọc nhanh biến nào tương quan mạnh với biến nào. Trả lời ngắn gọn bằng tiếng Việt." }]}
                title="Hỏi AI về ma trận tương quan"
              />
            </div>
            <table className="border-collapse text-sm">
              <thead>
                <tr>
                  <th className="p-1.5 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 font-medium" />
                  {corrResult.columnNames.map((c) => (
                    <th key={c} className="p-1.5 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 font-medium text-left whitespace-nowrap max-w-[120px] truncate" title={c}>{c.length > 12 ? c.slice(0, 10) + "?" : c}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {corrResult.matrix.map((row, i) => (
                  <tr key={i}>
                    <td className="p-1.5 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 font-medium whitespace-nowrap max-w-[120px] truncate" title={corrResult.columnNames[i]}>{corrResult.columnNames[i].length > 12 ? corrResult.columnNames[i].slice(0, 10) + "?" : corrResult.columnNames[i]}</td>
                    {row.map((v, j) => {
                      const r = v >= 0 ? 255 : Math.round(255 * (1 + v));
                      const g = Math.round(255 * (1 - Math.abs(v)));
                      const b = v <= 0 ? 255 : Math.round(255 * (1 - v));
                      const bg = `rgb(${r},${g},${b})`;
                      return (
                        <td key={j} className="p-1.5 border border-neutral-200 dark:border-neutral-600 text-center" style={{ backgroundColor: bg }} title={`${corrResult.columnNames[i]} vs ${corrResult.columnNames[j]}: ${v.toFixed(3)}`}>
                          {v.toFixed(2)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {chartType === "summary" && summaryStats.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {summaryStats.slice(0, 24).map((s) => (
              <div key={s.column} className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-3">
                <p className="font-medium text-sm truncate" title={s.column}>{s.column}</p>
                <p className="text-xs text-neutral-500 mt-0.5">n = {s.n} | Thiếu: {s.missing}</p>
                {s.mean != null && <p className="text-sm mt-1">Trung bình: {s.mean.toFixed(2)}{s.std != null ? ` (ĐLC): ${s.std.toFixed(2)}` : ""}</p>}
                {s.median != null && <p className="text-xs text-neutral-600 dark:text-neutral-400">Trung vị: {s.median.toFixed(2)}</p>}
                {s.min != null && s.max != null && <p className="text-xs text-neutral-500">Min–Max: {s.min.toFixed(2)} – {s.max.toFixed(2)}</p>}
              </div>
            ))}
          </div>
        )}
        {chartType === "dashboard" && (dashboardStats.length > 0 || (dashboardCorrResult && dashboardCorrResult.columnNames.length >= 2)) && (
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Tóm tắt nhanh</h3>
            <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2">
              {dashboardStats.slice(0, 6).map((s) => (
                <div key={s.column} className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50 p-2">
                  <p className="text-xs font-medium truncate" title={s.column}>{s.column.length > 10 ? s.column.slice(0, 8) + "?" : s.column}</p>
                  <p className="text-xs text-neutral-500">n={s.n}</p>
                  {s.mean != null && <p className="text-xs">{s.mean.toFixed(1)}</p>}
                </div>
              ))}
            </div>
            {dashboardCorrResult && dashboardCorrResult.columnNames.length >= 2 && (
              <>
                <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300">Ma trận tương quan (Pearson)</h3>
                <div className="overflow-x-auto overflow-y-auto max-h-64 rounded-lg border border-neutral-200 dark:border-neutral-700">
                  <table className="border-collapse text-xs">
                    <thead>
                      <tr>
                        <th className="p-1 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700" />
                        {dashboardCorrResult.columnNames.map((c) => (
                          <th key={c} className="p-1 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 truncate max-w-[80px]" title={c}>{c.length > 8 ? c.slice(0, 6) + "?" : c}</th>
                        ))}
                      </tr>
                    </thead>
                    <tbody>
                      {dashboardCorrResult.matrix.map((row, i) => (
                        <tr key={i}>
                          <td className="p-1 border border-neutral-200 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 truncate max-w-[80px]" title={dashboardCorrResult.columnNames[i]}>{dashboardCorrResult.columnNames[i].length > 8 ? dashboardCorrResult.columnNames[i].slice(0, 6) + "?" : dashboardCorrResult.columnNames[i]}</td>
                          {row.map((v, j) => {
                            const r = v >= 0 ? 255 : Math.round(255 * (1 + v));
                            const g = Math.round(255 * (1 - Math.abs(v)));
                            const b = v <= 0 ? 255 : Math.round(255 * (1 - v));
                            return (
                              <td key={j} className="p-1 border border-neutral-200 dark:border-neutral-600 text-center" style={{ backgroundColor: `rgb(${r},${g},${b})` }} title={v.toFixed(3)}>{v.toFixed(2)}</td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              </>
            )}
          </div>
        )}
        {chartType === "bar" && xCol && barData.length === 0 && <p className="text-amber-700 dark:text-amber-300 text-sm bg-amber-50 dark:bg-amber-900/20 border border-amber-200 dark:border-amber-800 rounded-lg px-3 py-2">Không vẽ được biểu đồ cột: không có dữ liệu cho cột "{xCol}". Kiểm tra cột đã chọn có giá trị không.</p>}
        {chartType === "line" && (!xCol || !yCol || lineData.length === 0) && <p className="text-neutral-500 text-sm">Chọn trục X (danh mục/thứ tự) và trục Y (số) cho biểu đồ đường.</p>}
        {chartType === "area" && (!xCol || !yCol || areaData.length === 0) && <p className="text-neutral-500 text-sm">Chọn trục X và trục Y (số) cho biểu đồ vùng.</p>}
        {chartType === "stackedBar" && (!xCol || !stackByCol || !yCol || stackedBarData.length === 0) && <p className="text-neutral-500 text-sm">Chọn trục X (danh mục), cột chồng (danh mục) và giá trị (số) cho biểu đồ cột chồng.</p>}
        {chartType === "pie" && (!xCol || pieData.length === 0) && <p className="text-neutral-500 text-sm">Chọn một cột phân loại cho biểu đồ tròn (tỉ lệ thành phần).</p>}
        {chartType === "box" && (!xCol || !yCol || boxChartData.length === 0) && <p className="text-neutral-500 text-sm">Chọn biến nhóm và biến số cho box plot.</p>}
        {chartType === "histogram" && !histogramCol && <p className="text-neutral-500 text-sm">Chọn một cột số cho histogram.</p>}
        {chartType === "radar" && radarNumericCols.length < 2 && <p className="text-neutral-500 text-sm">Chọn ít nhất 2 cột số cho biểu đồ radar.</p>}
        {chartType === "heatmap" && (!corrResult || corrResult.columnNames.length < 2) && <p className="text-neutral-500 text-sm">Cần ít nhất 2 cột số trong dataset để vẽ ma trận tương quan.</p>}
        {chartType === "summary" && summaryStats.length === 0 && <p className="text-neutral-500 text-sm">Không có thống kê mô tả (cần ít nhất 2 dòng dữ liệu).</p>}
        {chartType === "donut" && (!xCol || pieData.length === 0) && <p className="text-neutral-500 text-sm">Chọn một cột phân loại cho biểu đồ donut.</p>}
        {chartType === "barH" && (!xCol || barData.length === 0) && <p className="text-neutral-500 text-sm">Chọn một cột danh mục cho biểu đồ cột ngang.</p>}
        {chartType === "dashboard" && dashboardStats.length === 0 && !(dashboardCorrResult && dashboardCorrResult.columnNames.length >= 2) && <p className="text-neutral-500 text-sm">Cần ít nhất 2 dòng dữ liệu; dashboard hiển thị tóm tắt và ma trận tương quan nếu có đủ cột số.</p>}
      </div>
    );
  }
  if (tab === "visualization") return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">Biểu đồ</h2>
      <p className="text-neutral-500">Chọn dataset ở Workflow hoặc Data.</p>
      <p className="text-sm text-neutral-500 mt-2">Dùng tab <strong>AI hướng dẫn</strong> để hỏi gợi ý loại biểu đồ hoặc cách trực quan hóa.</p>
    </div>
  );

  return null;
}


/** Một nút icon AI; bấm vào mở panel: prompt gợi ý + ô nhập prompt tùy chỉnh. */
type AIQuickPrompt = { label: string; systemHint: string; userMessage?: string };

/** Prompt chuẩn cho mọi kết quả phân tích: viết APA + giải thích ý nghĩa (hỗ trợ AI toàn diện). Ngôn ngữ thống nhất: tiếng Việt. */
const STANDARD_AI_RESULT_PROMPTS: AIQuickPrompt[] = [
  { label: "Viết đoạn Kết quả theo APA", systemHint: "Bạn là chuyên gia thống kê. Viết đoạn Kết quả (Results) ngắn theo chuẩn APA từ số liệu cung cấp: phương pháp, thống kê, p-value, effect size. Trả lời bằng tiếng Việt.", userMessage: "Viết đoạn Kết quả theo APA dựa trên kết quả trên." },
  { label: "Giải thích ý nghĩa kết quả", systemHint: "Bạn là chuyên gia thống kê. Giải thích ý nghĩa từng chỉ số (p-value, effect size, CI) và kết luận thực hành. Trả lời ngắn gọn bằng tiếng Việt.", userMessage: "Giải thích ý nghĩa kết quả và kết luận thực hành." },
];

const DISLIKE_REASONS = [
  { id: "incorrect", label: "Sai nội dung" },
  { id: "not_asked", label: "Không đúng câu hỏi" },
  { id: "slow_buggy", label: "Chậm hoặc lỗi" },
  { id: "style_tone", label: "Giọng văn / phong cách" },
  { id: "other", label: "Khác" },
] as const;

function AIAssistPanel({
  context,
  metadata,
  process,
  quickPrompts,
  defaultSystemHint = "Bạn là chuyên gia thống kê và nghiên cứu định lượng. Viết đoạn diễn giải phù hợp với ngữ cảnh. Trả lời ngắn gọn bằng tiếng Việt.",
  disabled = false,
  title = "Hỏi AI về nội dung này",
  includeStandardResultPrompts = true,
}: {
  context: string;
  metadata?: string;
  process?: string;
  quickPrompts: AIQuickPrompt[];
  defaultSystemHint?: string;
  disabled?: boolean;
  title?: string;
  includeStandardResultPrompts?: boolean;
}) {
  const quickPromptsToShow = includeStandardResultPrompts ? [...STANDARD_AI_RESULT_PROMPTS, ...quickPrompts] : quickPrompts;
  const [open, setOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [lastQuickPrompt, setLastQuickPrompt] = useState<AIQuickPrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  const [showDislikeForm, setShowDislikeForm] = useState(false);
  const [dislikeReason, setDislikeReason] = useState<string | null>(null);
  const [dislikeComment, setDislikeComment] = useState("");
  const [dislikeSubmitting, setDislikeSubmitting] = useState(false);
  const resultBoxRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dialogPosition, setDialogPosition] = useState<{ left: number; top: number; maxHeight?: number } | null>(null);
  const userHasDraggedRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const api = (import.meta as { env?: { VITE_QUANTIS_AI_API?: string } }).env?.VITE_QUANTIS_AI_API || "http://localhost:11434/v1";
  const defaultModel = (import.meta as { env?: { VITE_QUANTIS_AI_MODEL?: string } }).env?.VITE_QUANTIS_AI_MODEL;
  const modelToUse = loadAiModel() ?? defaultModel ?? undefined;

  const fullContext = [metadata?.trim(), process?.trim(), context?.trim()].filter(Boolean).length
    ? [
        metadata?.trim() ? `[DỮ LIỆU / METADATA]\n${metadata.trim()}` : "",
        process?.trim() ? `[QUÁ TRÌNH PHÂN TÍCH]\n${process.trim()}` : "",
        context?.trim() ? `[KẾT QUẢ]\n${context.trim()}` : "",
      ].filter(Boolean).join("\n\n")
    : context.trim();

  useEffect(() => {
    if (result !== null && resultBoxRef.current) {
      resultBoxRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [result]);

  useEffect(() => {
    if (result !== null) {
      setFeedback(null);
      setShowDislikeForm(false);
      setDislikeReason(null);
      setDislikeComment("");
    }
  }, [result]);

  const DIALOG_MAX_HEIGHT_PX = 420;
  const DIALOG_MARGIN = 16;

  useEffect(() => {
    if (!open) {
      setDialogPosition(null);
      userHasDraggedRef.current = false;
      return;
    }
    const updatePosition = (onScroll = false) => {
      if (onScroll && userHasDraggedRef.current) return;
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const margin = DIALOG_MARGIN;
      const maxW = Math.min(480, window.innerWidth - 2 * margin);
      let left = rect.left;
      if (left + maxW > window.innerWidth - margin) left = window.innerWidth - margin - maxW;
      if (left < margin) left = margin;
      const maxH = Math.min(DIALOG_MAX_HEIGHT_PX, window.innerHeight - 2 * margin);
      let top = rect.bottom + 8;
      // Nếu không đủ chỗ phía dưới thì mở dialog phía trên nút
      if (top + maxH > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - maxH - 8);
      }
      setDialogPosition({ left, top, maxHeight: maxH });
    };
    updatePosition();
    const onResize = () => updatePosition(false);
    const onScroll = () => updatePosition(true);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const runAI = useCallback(async (systemHint: string, userMessage: string) => {
    if (!fullContext && !userMessage.trim()) return;
    const promptText = userMessage.trim()
      ? `Dữ liệu/ngữ cảnh:\n${fullContext}\n\nCâu hỏi của người dùng: ${userMessage.trim()}`
      : `Dựa trên nội dung sau, viết đoạn diễn giải phù hợp:\n\n${fullContext}`;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await quantisApi.aiComplete(api, promptText, systemHint, modelToUse, { maxTokens: 1024 });
      setResult(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lỗi kết nối AI";
      const hint = /fetch|network|failed|refused|404|500/i.test(msg)
        ? " Kiểm tra Ollama đã chạy hoặc Cài đặt → chọn model."
        : /abort|timeout/i.test(msg)
          ? " Yêu cầu quá lâu (timeout). Thử lại hoặc chọn model nhỏ hơn."
          : "";
      setError(msg + hint);
    } finally {
      setLoading(false);
    }
  }, [fullContext, api, modelToUse]);

  const handleQuickPrompt = useCallback((p: AIQuickPrompt) => {
    const text = p.userMessage ?? p.label;
    setCustomPrompt(text);
    setLastQuickPrompt(p);
  }, []);

  const handleCustomSubmit = useCallback(() => {
    if (!customPrompt.trim()) return;
    const systemHint = lastQuickPrompt?.systemHint ?? defaultSystemHint;
    runAI(systemHint, customPrompt);
  }, [customPrompt, lastQuickPrompt, defaultSystemHint, runAI]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!dialogPosition) return;
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, y: e.clientY, left: dialogPosition.left, top: dialogPosition.top };
    const maxH = dialogPosition.maxHeight ?? DIALOG_MAX_HEIGHT_PX;
    const margin = DIALOG_MARGIN;
    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      let left = dragStartRef.current.left + (e.clientX - dragStartRef.current.x);
      let top = dragStartRef.current.top + (e.clientY - dragStartRef.current.y);
      left = Math.max(margin, Math.min(window.innerWidth - margin - 320, left));
      top = Math.max(margin, Math.min(window.innerHeight - margin - 200, top));
      setDialogPosition({ left, top, maxHeight: maxH });
    };
    const onUp = () => {
      dragStartRef.current = null;
      userHasDraggedRef.current = true;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [dialogPosition]);

  const hasContext = fullContext.length > 0;
  const isDisabled = disabled || loading;

  return (
    <div className="mb-3 relative flex justify-end" ref={panelRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isDisabled}
        title={title}
        className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-amber-500/90 hover:bg-amber-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="w-5 h-5 shrink-0" />
        )}
      </button>
      {open && dialogPosition && (
        <div
          className="fixed z-20 flex flex-col min-w-[320px] max-w-[min(480px,calc(100vw-2rem))] rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg overflow-hidden"
          style={{
            left: dialogPosition.left,
            top: dialogPosition.top,
            maxHeight: dialogPosition.maxHeight ?? DIALOG_MAX_HEIGHT_PX,
          }}
          role="dialog"
          aria-label={title}
        >
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/80 text-neutral-500 dark:text-neutral-400 shrink-0">
            <div
              role="button"
              tabIndex={0}
              onMouseDown={handleDragStart}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.preventDefault(); }}
              className="py-1.5 pl-2 cursor-grab active:cursor-grabbing hover:bg-neutral-100 dark:hover:bg-neutral-700/80 rounded-l"
              title="Kéo để di chuyển"
            >
              <GripVertical className="w-4 h-4" aria-hidden />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1.5 rounded-r hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
              title="Đóng"
              aria-label="Đóng"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col min-h-0 flex-1 overflow-y-auto p-3">
          {!modelToUse && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-2 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30">Chọn model trong <strong>Cài đặt</strong> để dùng AI. Hiện đang dùng model mặc định của máy chủ.</p>
          )}
          {fullContext.length > AI_MAX_PROMPT_CHARS && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Ngữ cảnh dài sẽ được rút gọn tự động khi gửi.</p>
          )}
          {!hasContext && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Chưa có dữ liệu/kết quả để AI diễn giải. Chọn dữ liệu hoặc chạy phân tích trước.</p>
          )}
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">Câu hỏi gợi ý:</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {quickPromptsToShow.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleQuickPrompt(p)}
                disabled={loading || (!hasContext && !(p.userMessage ?? "").trim())}
                className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-800/60 disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1.5">Hoặc nhập câu hỏi của bạn:</p>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleCustomSubmit(); } }}
            placeholder="VD: Giải thích ý nghĩa các chỉ số này... (Ctrl+Enter gửi)"
            rows={3}
            className="w-full min-h-[5rem] rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm mb-2 resize-y"
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            disabled={!customPrompt.trim() || loading}
            className="w-full py-1.5 rounded-lg text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            Gửi
          </button>
          {error && (
            <div className="mt-2 p-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-0.5">Lỗi kết nối AI</p>
              <p className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap">{error}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">Gợi ý: Mở <strong>Cài đặt</strong> → chọn model; kiểm tra Ollama đã chạy (ollama serve) và đã kéo model (ollama pull tên).</p>
            </div>
          )}
          {result !== null && (
            <>
              <div ref={resultBoxRef} className="mt-2 p-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">Kết quả:</p>
                <div className="text-sm text-neutral-700 dark:text-neutral-300 [&_ul]:list-disc [&_ul]:ml-4 [&_ul]:my-1.5 [&_ol]:list-decimal [&_ol]:ml-4 [&_ol]:my-1.5 [&_li]:my-0.5 [&_strong]:font-semibold [&_code]:bg-neutral-200 dark:[&_code]:bg-neutral-600 [&_code]:px-1 [&_code]:rounded [&_code]:text-xs max-h-80 overflow-y-auto overflow-x-hidden">
                  <ReactMarkdown
                    components={{
                      p: ({ children }) => <p className="mb-1.5 last:mb-0">{children}</p>,
                      ul: ({ children }) => <ul className="list-disc ml-4 my-1.5">{children}</ul>,
                      ol: ({ children }) => <ol className="list-decimal ml-4 my-1.5">{children}</ol>,
                      li: ({ children }) => <li className="my-0.5">{children}</li>,
                      strong: ({ children }) => <strong className="font-semibold">{children}</strong>,
                      code: ({ children }) => <code className="bg-neutral-200 dark:bg-neutral-600 px-1 rounded text-xs">{children}</code>,
                    }}
                  >
                    {result || "Máy chủ trả về rỗng."}
                  </ReactMarkdown>
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <button type="button" onClick={() => { navigator.clipboard.writeText(result || ""); }} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-amber-300 dark:border-amber-600 bg-amber-100/80 dark:bg-amber-800/30 text-amber-800 dark:text-amber-200"><Copy className="w-3 h-3" /> Sao chép</button>
                  <button type="button" onClick={() => { setResult(null); setError(null); setFeedback(null); setShowDislikeForm(false); }} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600">Làm mới</button>
                  <span className="text-neutral-400 dark:text-neutral-500 mx-0.5">|</span>
                  <button
                    type="button"
                    title={feedback === "like" ? "Bỏ thích" : "Hữu ích"}
                    onClick={() => {
                      if (feedback === "like") {
                        setFeedback(null);
                      } else {
                        setFeedback("like");
                        saveAiFeedback({ feedback: "like", resultPreview: (result || "").slice(0, 200) });
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border ${feedback === "like" ? "border-green-500 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600"}`}
                  >
                    <ThumbsUp className="w-3 h-3" /> Thích
                  </button>
                  <button
                    type="button"
                    title={feedback === "dislike" ? "Bỏ không thích" : "Không hữu ích"}
                    onClick={() => {
                      if (feedback === "dislike") {
                        setFeedback(null);
                      } else {
                        setShowDislikeForm(true);
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border ${feedback === "dislike" ? "border-red-500 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600"}`}
                  >
                    <ThumbsDown className="w-3 h-3" /> Không thích
                  </button>
                </div>
                {showDislikeForm && (
                  <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">Góp ý cho câu trả lời (tùy chọn):</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {DISLIKE_REASONS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setDislikeReason(dislikeReason === r.id ? null : r.id)}
                          className={`px-2 py-1 rounded text-xs border ${dislikeReason === r.id ? "border-amber-500 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100" : "border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"}`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={dislikeComment}
                      onChange={(e) => setDislikeComment(e.target.value)}
                      placeholder="Nhập góp ý chi tiết (tùy chọn)..."
                      rows={2}
                      maxLength={2000}
                      className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-xs mb-2 resize-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={dislikeSubmitting}
                        onClick={async () => {
                          setDislikeSubmitting(true);
                          const reasonLabel = dislikeReason ? DISLIKE_REASONS.find((r) => r.id === dislikeReason)?.label : undefined;
                          const comment = [reasonLabel, dislikeComment.trim()].filter(Boolean).join("\n\n");
                          saveAiFeedback({
                            feedback: "dislike",
                            resultPreview: (result || "").slice(0, 200),
                            reason: reasonLabel,
                            comment: comment || undefined,
                          });
                          setFeedback("dislike");
                          setShowDislikeForm(false);
                          setDislikeReason(null);
                          setDislikeComment("");
                          setDislikeSubmitting(false);
                        }}
                        className="px-2.5 py-1.5 rounded-lg text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        {dislikeSubmitting ? "Đang gửi..." : "Gửi góp ý"}
                      </button>
                      <button
                        type="button"
                        disabled={dislikeSubmitting}
                        onClick={() => { setShowDislikeForm(false); setDislikeReason(null); setDislikeComment(""); }}
                        className="px-2.5 py-1.5 rounded-lg text-xs border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      >
                        Hủy
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-3 pt-2 border-t border-red-200 dark:border-red-800 text-[11px] text-red-600 dark:text-red-400">
                ⚠️ AI có thể sai; cần kiểm tra lại kỹ câu trả lời trước khi sử dụng.
              </p>
            </>
          )}
          </div>
        </div>
      )}
    </div>
  );
}

function AIAssistView({ selectedDataset, compact = false }: { selectedDataset?: Dataset; compact?: boolean }) {
  const api = (import.meta as { env?: { VITE_QUANTIS_AI_API?: string } }).env?.VITE_QUANTIS_AI_API || "http://localhost:11434/v1";
  const defaultModel = (import.meta as { env?: { VITE_QUANTIS_AI_MODEL?: string } }).env?.VITE_QUANTIS_AI_MODEL;
  const modelToUse = loadAiModel() ?? defaultModel ?? undefined;
  const systemHint = "Bạn là trợ lý chuyên về ứng dụng Quantis và phân tích định lượng. Nhiệm vụ: (1) Hướng dẫn cách sử dụng ứng dụng Quantis (import dữ liệu, các tab Khám phá, Phân tích thống kê, Trực quan, kiểm định, hồi quy, SEM, v.v.). (2) Gợi ý phương pháp phân tích định lượng phù hợp, cách chọn kiểm định, diễn giải kết quả, báo cáo APA. Trả lời ngắn gọn, rõ ràng, bằng tiếng Việt.";
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const dsCtx = selectedDataset
    ? `Bộ dữ liệu hiện tại: ${selectedDataset.name}, ${selectedDataset.rows} hàng, ${selectedDataset.columns} cột. Cột: ${(selectedDataset.columnNames || []).slice(0, 10).join(", ")}${(selectedDataset.columnNames?.length || 0) > 10 ? "…" : ""}.`
    : "Chưa chọn bộ dữ liệu.";

  const suggestedPrompts: { label: string; userMessage: string }[] = [
    { label: "Quantis dùng để làm gì? Các bước sử dụng cơ bản?", userMessage: "Quantis dùng để làm gì? Các bước sử dụng cơ bản từ import dữ liệu đến phân tích và báo cáo?" },
    { label: "Làm thế nào để import và xem dữ liệu?", userMessage: "Làm thế nào để import dữ liệu (file CSV/Excel) và xem dữ liệu trong Quantis?" },
    { label: "Tab Khám phá & Biến đổi dùng để làm gì?", userMessage: "Tab Khám phá & biến đổi dữ liệu gồm những gì? Làm sạch dữ liệu, xử lý missing, chuẩn hóa thế nào?" },
    { label: "Tab Phân tích thống kê có những công cụ nào?", userMessage: "Tab Phân tích thống kê có những công cụ nào? Kiểm định, hồi quy, tương quan, EFA, SEM dùng khi nào?" },
    { label: "So sánh hai nhóm: nên dùng t-test hay Mann-Whitney?", userMessage: "So sánh trung bình hai nhóm độc lập: khi nào dùng t-test, khi nào dùng Mann-Whitney? Giả định của từng loại?" },
    { label: "Nhiều nhóm: ANOVA hay Kruskal-Wallis?", userMessage: "So sánh nhiều nhóm (3 nhóm trở lên): khi nào dùng ANOVA một nhân tố, khi nào dùng Kruskal-Wallis?" },
    { label: "Hai biến phân loại: kiểm định gì?", userMessage: "Muốn xem mối liên hệ giữa hai biến phân loại (bảng tần số chéo): nên dùng kiểm định Chi-square hay Fisher exact?" },
    { label: "Hồi quy OLS và Logistic khác nhau thế nào?", userMessage: "Hồi quy OLS và hồi quy Logistic trong Quantis khác nhau thế nào? Khi nào dùng từng loại?" },
    { label: "Mediation và Moderation khác nhau ra sao?", userMessage: "Phân tích Mediation (trung gian) và Moderation (điều tiết) trong SEM khác nhau thế nào? Cho ví dụ ngắn." },
    { label: "Cách báo cáo kết quả theo chuẩn APA?", userMessage: "Cách báo cáo kết quả kiểm định thống kê (t-test, ANOVA, Chi-square, hồi quy) theo chuẩn APA? Cho mẫu câu." },
    { label: "Cỡ mẫu bao nhiêu là đủ? Phân tích lực mẫu?", userMessage: "Cỡ mẫu bao nhiêu là đủ cho t-test, ANOVA, hồi quy? Phân tích lực mẫu (power analysis) và tính cỡ mẫu trong Quantis thế nào?" },
    { label: "Cronbach alpha và EFA dùng khi nào?", userMessage: "Độ tin cậy Cronbach alpha và phân tích nhân tố EFA trong Quantis dùng khi nào? Cách đọc kết quả?" },
  ];

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (userContent: string) => {
    const text = userContent.trim();
    if (!text || loading) return;
    const contextForAI = selectedDataset ? `${dsCtx}\n\n` : "";
    const promptText = `${contextForAI}Câu hỏi của người dùng: ${text}`;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const res = await quantisApi.aiComplete(api, promptText, systemHint, modelToUse, { maxTokens: 1024 });
      setMessages((prev) => [...prev, { role: "assistant", content: res }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : "Lỗi kết nối AI";
      const hint = /fetch|network|failed|refused|404|500/i.test(msg)
        ? " Kiểm tra Ollama đã chạy hoặc Cài đặt → chọn model."
        : "";
      setError(msg + hint);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}${hint}` }]);
    } finally {
      setLoading(false);
    }
  }, [loading, api, systemHint, modelToUse, dsCtx, selectedDataset]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (compact) {
    return (
      <div className="w-full max-w-full">
        <p className="text-xs text-neutral-500 mb-2">{dsCtx}</p>
        <AIAssistPanel
          context={dsCtx}
          quickPrompts={suggestedPrompts.map((p) => ({ label: p.label, systemHint, userMessage: p.userMessage }))}
          defaultSystemHint={systemHint}
          title="AI hướng dẫn"
          includeStandardResultPrompts={false}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-full flex flex-col h-[calc(100vh-8rem)] min-h-[420px]">
      <div className="shrink-0 mb-3">
        <h2 className="text-xl font-semibold mb-1 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500" /> AI hướng dẫn
        </h2>
        <p className="text-sm text-neutral-600 dark:text-neutral-400">
          Hướng dẫn sử dụng ứng dụng Quantis và gợi ý phân tích định lượng. Chọn câu hỏi gợi ý bên dưới hoặc nhập câu hỏi của bạn.
        </p>
        {selectedDataset && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate" title={dsCtx}>Bộ dữ liệu: {selectedDataset.name}</p>
        )}
      </div>

      <div className="mb-3">
        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-500 dark:text-neutral-400 mb-2">Gợi ý câu hỏi — bấm để hỏi:</p>
        <div className="flex flex-wrap gap-2">
          {suggestedPrompts.map((p) => (
            <button
              key={p.label}
              type="button"
              onClick={() => sendMessage(p.userMessage)}
              disabled={loading}
              className="rounded-lg px-3 py-1.5 text-sm border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-400 dark:hover:border-amber-600 text-neutral-700 dark:text-neutral-300 disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8">
              Chưa có tin nhắn. Hãy bấm một câu hỏi gợi ý ở trên hoặc nhập câu hỏi bên dưới.
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-xl px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-brand text-white"
                    : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 text-neutral-800 dark:text-neutral-200"
                }`}
              >
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div className="prose prose-sm dark:prose-invert max-w-none">
                    <ReactMarkdown>{m.content}</ReactMarkdown>
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-xl px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin inline-block" />
                <span className="ml-2 text-sm">Đang trả lời…</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 px-4 py-2 border-t border-neutral-200 dark:border-neutral-700 bg-red-50/50 dark:bg-red-900/20">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="shrink-0 p-3 border-t border-neutral-200 dark:border-neutral-700 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(input); } }}
            placeholder="Nhập câu hỏi về Quantis hoặc phân tích định lượng..."
            className="flex-1 h-11 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-lg bg-brand text-white px-4 py-2 h-11 font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            Gửi
          </button>
        </form>
      </div>
    </div>
  );
}

function AppFeedbackModal({ onClose }: { onClose: () => void }) {
  const [content, setContent] = useState("");
  const [sent, setSent] = useState(false);
  const [sending, setSending] = useState(false);

  const handleSubmit = () => {
    const trimmed = content.trim();
    if (trimmed.length < 5) return;
    setSending(true);
    saveAppFeedback(trimmed);
    setSending(false);
    setSent(true);
    setContent("");
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <FileText className="w-5 h-5" /> Góp ý ứng dụng
        </h3>
        {sent ? (
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-4">Đã gửi. Cảm ơn bạn đã góp ý!</p>
        ) : (
          <>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Góp ý, báo lỗi hoặc đề xuất cải thiện (tối thiểu 5 ký tự). Nội dung được lưu local và có thể gửi lên server sau.</p>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="Nhập nội dung góp ý..."
              rows={4}
              maxLength={4000}
              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm resize-none mb-3"
            />
            <p className="text-xs text-neutral-500 mb-3">{content.length}/4000</p>
            <div className="flex gap-2">
              <button type="button" onClick={handleSubmit} disabled={content.trim().length < 5 || sending} className="rounded-lg bg-amber-500 text-white px-4 py-2 hover:bg-amber-600 disabled:opacity-50">Gửi</button>
              <button type="button" onClick={onClose} className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-4 py-2 hover:bg-neutral-100 dark:hover:bg-neutral-700">Đóng</button>
            </div>
          </>
        )}
        {sent && <button type="button" onClick={onClose} className="mt-2 rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Đóng</button>}
      </div>
    </div>
  );
}

function SettingsModal({ onClose }: { onClose: () => void }) {
  const api = (import.meta as { env?: { VITE_QUANTIS_AI_API?: string } }).env?.VITE_QUANTIS_AI_API || "http://localhost:11434/v1";
  const envModel = (import.meta as { env?: { VITE_QUANTIS_AI_MODEL?: string } }).env?.VITE_QUANTIS_AI_MODEL;
  const [models, setModels] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedModel, setSelectedModel] = useState<string>(() => loadAiModel() || envModel || "llama3.2:8b");

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    quantisApi.getOllamaModels(api).then((list) => {
      if (cancelled) return;
      const filtered = quantisApi.filterModelsMinSize(list, 8);
      setModels(filtered);
      setLoading(false);
      const stored = loadAiModel();
      if (stored && filtered.includes(stored)) setSelectedModel(stored);
      else if (envModel && filtered.includes(envModel)) setSelectedModel(envModel);
      else if (filtered.length > 0 && !loadAiModel()) setSelectedModel(filtered[0]);
    }).catch(() => { if (!cancelled) setLoading(false); });
    return () => { cancelled = true; };
  }, [api]);

  const handleChange = (value: string) => {
    setSelectedModel(value);
    saveAiModel(value || null);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-md w-full mx-4 p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Settings className="w-5 h-5" /> Cài đặt
        </h3>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-2">Mô hình AI</label>
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">Dùng cho các nút Giải thích / Diễn giải kết quả và tab AI hướng dẫn. Chỉ hiển thị mô hình &gt;= 8B.</p>
            {loading ? (
              <p className="text-sm text-neutral-500">Đang tải danh sách mô hình...</p>
            ) : models.length > 0 ? (
              <select
                value={selectedModel}
                onChange={(e) => handleChange(e.target.value)}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
                title="Chọn mô hình Ollama"
              >
                {models.map((m) => (
                  <option key={m} value={m}>{m}</option>
                ))}
              </select>
            ) : (
              <p className="text-sm text-amber-600 dark:text-amber-400">Không lấy được danh sách từ API. Kiểm tra VITE_QUANTIS_AI_API trong .env.</p>
            )}
            {selectedModel && <p className="text-xs text-neutral-500 mt-1">Đang dùng: <strong>{selectedModel}</strong></p>}
          </div>
        </div>
        <button type="button" onClick={onClose} className="mt-6 rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90">Đóng</button>
      </div>
    </div>
  );
}

function GuideModal({ onClose }: { onClose: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50" onClick={onClose}>
      <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-lg w-full mx-4 max-h-[80vh] overflow-y-auto p-6" onClick={(e) => e.stopPropagation()}>
        <h3 className="text-lg font-semibold mb-4">Quantis ? Hướng dẫn nhanh</h3>
        <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3"><strong>Quantis</strong> là nền tảng phân tích dữ liệu nghiên cứu: import, chuyển đổi, thống kê, ML, xuất báo cáo. Hỗ trợ reproducibility với lưu workflow và audit trail.</p>
        <ul className="space-y-2 text-sm text-neutral-600 dark:text-neutral-400 mb-4">
          <li><strong>Workflow nghiên cứu:</strong> Quy trình chuẩn từ import đến lưu workflow.</li>
          <li><strong>Data Layer:</strong> Import (panel trái), xem dữ liệu, phân tích sơ bộ, biến đổi (missing: mean/median/mode; chuẩn hóa z-score, min-max; lọc, sắp xếp, recode).</li>
          <li><strong>Analysis Engine:</strong> Thống kê mô tả, kiểm định giả thuyết (t-test độc lập & cặp, ANOVA, Kruskal-Wallis, Chi-square, Mann-Whitney, Wilcoxon cặp, Friedman, Levene), hồi quy, SEM, tương quan (Pearson, Spearman, từng phần), Cronbach, EFA, ML, Bayesian.</li>
          <li><strong>Reproducibility:</strong> Lưu workflow, versioning, audit trail.</li>
          <li><strong>Presentation:</strong> Biểu đồ (xuất SVG/PNG), heatmap tương quan, báo cáo học thuật.</li>
          <li><strong>AI:</strong> Gợi ý phương pháp, diễn giải kết quả, cảnh báo.</li>
        </ul>
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/50 p-3 mb-4">
          <p className="text-sm font-semibold text-neutral-800 dark:text-neutral-200 mb-2">Phân tích đểnh lượng</p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-1"><strong>Cơ bản:</strong> Thống kê mô tả (P10, P90, Kurtosis) ? Kiểm định (t-test, t-test cặp, ANOVA, Chi-square, Mann-Whitney, Wilcoxon cặp, Friedman, Levene) ? Tương quan (Pearson, Spearman, từng phần) ? Cronbach. Shapiro-Wilk, Power analysis, Cỡ mẫu trong tab Kiểm định.</p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400"><strong>Nâng cao:</strong> Hồi quy OLS/Logistic, VIF (đa cộng tuyến), SEM (Mediation, Moderation), EFA, K-means, Bayesian (tỉ lệ). Xuất biểu đồ SVG/PNG, heatmap tương quan (xuất CSV). Tương đương nhiều tính năng SPSS, R, Python.</p>
        </div>
        <button type="button" onClick={onClose} className="mt-4 rounded-lg bg-neutral-200 dark:bg-neutral-700 px-4 py-2">Đóng</button>
      </div>
    </div>
  );
}
