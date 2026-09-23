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
  BookOpen,
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
  Save,
  ImagePlus,
  User,
  LogOut,
  Server,
} from "lucide-react";
import { getPortalTheme, applyPortalTheme } from "./portal-theme";
import { QUANTIS_EMBED_CONFIG_EVENT } from "./embed-config";
import { generateId } from "@/utils/helpers";
import { SettingsModal, GuideModal, AppFeedbackModal } from "@/components/modals";
import { AIAssistPanel, AIAssistView, type AIQuickPrompt } from "@/features/ai";
import { PresentationView } from "@/features/presentation";
import { AnalysisView } from "@/features/analysis";
import {
  clearWorkspaceLocalData,
  clearQuantisLocalAppData,
  loadAiModel,
  saveAiModel,
  loadBackendApiUrl,
  saveBackendApiUrl,
  loadArchiveUrl,
  saveArchiveUrl,
  loadArchiveFileUrl,
  saveArchiveFileUrl,
  loadOllamaUpstreamFromServer,
  saveAppFeedback,
  setServerSettings,
  getServerSettings,
} from "@/utils/storage";
import {
  useDataStore,
  useWorkflowStore,
  useUIStore,
  useAnalysisStore,
  useSyncStore,
  type MainSection,
  type DataTab,
  type AnalysisTab,
  type ReproducibilityTab,
  type PresentationTab,
  type PresentationChartType,
} from "@/stores";
import type { Dataset, Workflow, WorkflowStep } from "./types";
import * as quantisApi from "./api";
import type { AuthConfig, AuthUser } from "./api";
import { QuantAuthGate, QuantLoginModal } from "./auth-ui";
import { AI_MAX_PROMPT_CHARS } from "./api";
import { AiMarkdown } from "./ai-markdown";
import {
  parseFileContent,
  getFormatFromFilename,
  isBackendParseFormat,
  computeProfileWithOutliers,
  computeDescriptive,
  getDataRows,
  getColumnMode,
  computeTextStats,
  computeOutlierIqr,
  computeKeywordCounts,
  computeNgramFreq,
  computeCohensKappa,
  MAX_ROWS_STORED,
  getCrosstab,
  computeBootstrapMeanCI,
} from "./utils/stats";
import * as archiveApi from "./archive-api";
import type { ArchiveSearchItem, ArchiveFileItem } from "./archive-api";
import { SAMPLE_DATASETS } from "./sampleDatasets";
import { getSampleWorkflowStandalone, getDefaultStandardWorkflow, getDemoWorkflowTemplates } from "./sample-data";
import { OpenScienceProtocolPanel } from "./OpenScienceProtocolPanel";
import type {
  DescriptiveRow,
  TTestResult,
  ChiSquareResult,
  ANOVAResult,
  MannWhitneyResult,
} from "./utils/stats";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  Cell,
  ScatterChart,
  Scatter,
  CartesianGrid,
  PieChart,
  Pie,
  LineChart,
  Line,
  AreaChart,
  Area,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
  ComposedChart,
  ReferenceArea,
  ReferenceLine,
} from "recharts";
import { t, aiAnswerLangHint, tAllLocales } from "./i18n";

const BACKEND_PYTHON_REQUIRED_MSG = t("app.backendPythonRequiredMsg");

const WORKFLOW_STEPS = [
  { id: "import", label: t("app.stepType.import"), icon: Upload },
  { id: "profiling", label: t("app.stepType.profiling"), icon: ScanSearch },
  { id: "clean", label: t("app.stepType.clean"), icon: Shuffle },
  { id: "reliability", label: "Reliability & validity", icon: CheckCircle2 },
  { id: "hypothesis", label: t("app.stepType.test"), icon: TestTube },
  { id: "model", label: t("app.stepType.model"), icon: TrendingUp },
  { id: "visualize", label: t("app.stepType.visualize"), icon: LineChartIcon },
  { id: "report", label: t("app.stepType.report"), icon: FileText },
  { id: "save", label: t("app.stepType.save"), icon: GitBranch },
];

export default function App() {
  const { datasets, setDatasets, selectedDatasetId, setSelectedDatasetId } = useDataStore();
  const {
    workflows,
    setWorkflows,
    selectedWorkflowId,
    setSelectedWorkflowId,
    selectedWorkflowStepId,
    setSelectedWorkflowStepId,
    newWorkflowStepType,
    setNewWorkflowStepType,
    newWorkflowStepLabel,
    setNewWorkflowStepLabel,
    editingWorkflowNameId,
    setEditingWorkflowNameId,
    editingWorkflowName,
    setEditingWorkflowName,
    editingWorkflowDescriptionId,
    setEditingWorkflowDescriptionId,
    editingWorkflowDescription,
    setEditingWorkflowDescription,
    editingStepId,
    setEditingStepId,
    editingStepLabel,
    setEditingStepLabel,
    editingStepType,
    setEditingStepType,
    editingStepNote,
    setEditingStepNote,
    stepMenuOpenId,
    setStepMenuOpenId,
    draggingStepId,
    setDraggingStepId,
    dropTargetIndex,
    setDropTargetIndex,
  } = useWorkflowStore();
  const {
    mainSection,
    setMainSection,
    dataTab,
    setDataTab,
    analysisTab,
    setAnalysisTab,
    reproTab,
    setReproTab,
    presentationTab,
    setPresentationTab,
    presentationChartType,
    setPresentationChartType,
    guideOpen,
    setGuideOpen,
    showSettings,
    setShowSettings,
    showAppFeedbackModal,
    setShowAppFeedbackModal,
    isMobileLayout,
    setIsMobileLayout,
    sidebarOpen,
    setSidebarOpen,
    confirmDialog,
    setConfirmDialog,
    toast,
    setToast,
    showToast,
    theme,
    setTheme,
    toggleTheme,
    headerMenuOpen,
    setHeaderMenuOpen,
    showDemoGallery,
    setShowDemoGallery,
    showSampleModal,
    setShowSampleModal,
    sampleDatasetSearch,
    setSampleDatasetSearch,
    showLoginModal,
    setShowLoginModal,
    loginModalInitialTab,
    setLoginModalInitialTab,
    showAccountDialog,
    setShowAccountDialog,
    archiveModalOpen,
    setArchiveModalOpen,
  } = useUIStore();
  const {
    correlationMethod,
    setCorrelationMethod,
    correlationBackendResult,
    setCorrelationBackendResult,
    correlationLoading,
    setCorrelationLoading,
    lastHypothesisResult,
    setLastHypothesisResult,
    descriptiveBackendResult,
    setDescriptiveBackendResult,
  } = useAnalysisStore();
  const {
    useBackend,
    setUseBackend,
    authConfig,
    setAuthConfig,
    authUser,
    setAuthUser,
    authLoading,
    setAuthLoading,
    analysisBackendAvailable,
    setAnalysisBackendAvailable,
    isOnline,
    setIsOnline,
    embedConfigGeneration,
    setEmbedConfigGeneration,
    workspacePullLoading,
    setWorkspacePullLoading,
    sidebarImportBusy,
    setSidebarImportBusy,
    archiveSearchResult,
    setArchiveSearchResult,
    archiveSearchLoading,
    setArchiveSearchLoading,
    archiveSearchError,
    setArchiveSearchError,
    archivePage,
    setArchivePage,
    selectedArchiveRequestId,
    setSelectedArchiveRequestId,
    selectedArchiveTitle,
    setSelectedArchiveTitle,
    archiveFiles,
    setArchiveFiles,
    archiveFilesLoading,
    setArchiveFilesLoading,
    archiveDownloadingFileId,
    setArchiveDownloadingFileId,
  } = useSyncStore();

  const headerMenuRef = useRef<HTMLDivElement>(null);
  const csvFileInputRef = useRef<HTMLInputElement>(null);
  const hasReadUrlRef = useRef(false);
  /** Đã kéo workspace từ server ít nhất một lần trong phiên canSync hiện tại (tránh GET lại khi vừa mất mạng rồi có — giữ chỉnh sửa offline). */
  const didPullServerWorkspaceRef = useRef(false);
  const prevCanSyncRef = useRef(false);

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
    const format = getFormatFromFilename(file.name);

    const applyRows = (rows: string[][], fmt: string) => {
      if (!rows || rows.length < 2) return;
      const headers = rows[0];
      const kept = rows.slice(1, MAX_ROWS_STORED + 1);
      const id = generateId();
      const now = new Date().toISOString();
      const baseName = file.name.replace(/\.(csv|tsv|json|txt|xlsx|xls|ods|sav|dta|sas7bdat|rds|rdata)$/i, "") || file.name;
      setDatasets((prev) => [...prev, { id, name: baseName, rows: kept.length, columns: headers.length, columnNames: headers, preview: rows.slice(0, 6), data: [headers, ...kept], sourceFormat: fmt, createdAt: now, updatedAt: now }]);
      setSelectedDatasetId(id);
      if (selectedWorkflowId) {
        setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflowId ? w : { ...w, datasetIds: [...(w.datasetIds ?? []), id].filter((x, i, a) => a.indexOf(x) === i), updatedAt: now })));
      }
    };

    if (isBackendParseFormat(format)) {
      setSidebarImportBusy(true);
      quantisApi.parseFileViaBackend(file)
        .then(({ rows, format: fmt }) => applyRows(rows, fmt))
        .catch((err) => {
          showToast?.(err?.message ?? t("app.errCannotReadFileNeedBackend"));
        })
        .finally(() => setSidebarImportBusy(false));
      e.target.value = "";
      return;
    }

    const reader = new FileReader();
    reader.onload = () => {
      try {
        const { rows, format: fmt } = parseFileContent(String(reader.result), file.name);
        applyRows(rows, fmt);
      } catch (_) { /* ignore */ }
    };
    reader.readAsText(file, "UTF-8");
    e.target.value = "";
  }, [selectedWorkflowId]);

  const addSampleDatasetFromSidebar = useCallback((def: (typeof SAMPLE_DATASETS)[0]) => {
    /** Mỗi lần thêm = một dataset mới (cho phép thêm lại cùng mẫu). */
    const sourceKey = `sample:${def.id}:${generateId()}`;
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
  }, [selectedWorkflowId, selectedWorkflow]);

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
    import: t("app.stepType.import"),
    clean: t("app.stepType.clean"),
    transform: t("app.stepType.transform"),
    describe: t("app.stepType.describe"),
    test: t("app.stepType.test"),
    model: t("app.stepType.model"),
    visualize: t("app.stepType.visualize"),
    report: t("app.stepType.report"),
  };
  /**
   * Labels that merely repeat the step-type name the UI already shows.
   * Seeded sample workflows stored their label in whatever language was active
   * at seed time, so a Vietnamese label would keep showing next to an English
   * type name (and vice versa). Collect every locale's wording for both the
   * step type and the seeded sample label, and skip rendering those.
   */
  const REDUNDANT_STEP_LABELS = useMemo(() => {
    const keys = ["import", "clean", "transform", "describe", "test", "model", "visualize", "report"]
    const set = new Set<string>()
    for (const k of keys) {
      for (const v of tAllLocales(`app.stepType.${k}`)) set.add(v.trim().toLowerCase())
      for (const v of tAllLocales(`sampleData.stepLabel.${k}`)) set.add(v.trim().toLowerCase())
      for (const v of tAllLocales(`sampleData.demoTemplates.stepLabel.${k}`)) set.add(v.trim().toLowerCase())
    }
    return set
  }, [])
  const isRedundantStepLabel = (label?: string) =>
    !label || REDUNDANT_STEP_LABELS.has(label.trim().toLowerCase())

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
    { type: "import", label: t("app.stepType.import") },
    { type: "clean", label: t("app.stepType.clean") },
    { type: "transform", label: t("app.stepType.transform") },
    { type: "describe", label: t("app.stepType.describe") },
    { type: "test", label: t("app.stepType.test") },
    { type: "model", label: t("app.stepType.model") },
    { type: "visualize", label: t("app.stepType.visualize") },
    { type: "report", label: t("app.stepType.report") },
  ];

  /** 4 nhóm tab chính trên header */
  const MAIN_TABS = [
    { id: "data" as const, label: t("app.mainTab.data.label"), shortLabel: t("app.mainTab.data.shortLabel"), icon: Database, section: "data" as const },
    { id: "analysis" as const, label: t("app.mainTab.analysis.label"), shortLabel: t("app.mainTab.analysis.shortLabel"), icon: BarChart3, section: "analysis" as const },
    { id: "presentation" as const, label: t("app.mainTab.presentation.label"), shortLabel: t("app.mainTab.presentation.label"), icon: LineChartIcon, section: "presentation" as const },
    { id: "ai" as const, label: t("app.mainTab.ai.label"), shortLabel: "AI", icon: Sparkles, section: "ai" as const },
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
    const on = () => setIsOnline(true);
    const off = () => setIsOnline(false);
    window.addEventListener("online", on);
    window.addEventListener("offline", off);
    return () => {
      window.removeEventListener("online", on);
      window.removeEventListener("offline", off);
    };
  }, []);

  useEffect(() => {
    const mq = window.matchMedia("(max-width: 767px)");
    const onViewport = () => {
      const narrow = mq.matches;
      setIsMobileLayout(narrow);
      if (narrow) setSidebarOpen(false);
    };
    mq.addEventListener("change", onViewport);
    return () => mq.removeEventListener("change", onViewport);
  }, []);

  useEffect(() => {
    if (workflows.length > 0 && !selectedWorkflowId) setSelectedWorkflowId(workflows[0].id);
  }, [workflows, selectedWorkflowId]);
  /* Khi chọn workflow: không tự chọn bước đầu; hiển thị trang thông tin workflow. User bấm "Bắt đầu" mới vào bước đầu. */
  useEffect(() => {
    if (selectedDatasetId && !datasets.some((d) => d.id === selectedDatasetId)) {
      setSelectedDatasetId(null);
    }
  }, [datasets, selectedDatasetId, setSelectedDatasetId]);

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
    const workflowsList = useWorkflowStore.getState().workflows;
    const datasetsList = useDataStore.getState().datasets;
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
    const reproTabs: ReproducibilityTab[] = ["workflows", "versioning", "openscience"];
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

  // Khi tab correlation + backend Python: lấy ma trận tương quan từ server (chỉ khi đang ở section Phân tích)
  useEffect(() => {
    if (mainSection !== "analysis" || analysisTab !== "correlation" || !analysisBackendAvailable || !selectedDataset) {
      setCorrelationBackendResult(null);
      setCorrelationLoading(false);
      return;
    }
    const rows = getDataRows(selectedDataset);
    if (rows.length < 3) {
      setCorrelationBackendResult(null);
      setCorrelationLoading(false);
      return;
    }
    if (correlationMethod === "kendall") {
      setCorrelationBackendResult(null);
      setCorrelationLoading(false);
      return;
    }
    setCorrelationLoading(true);
    quantisApi.analyzeCorrelation(rows, correlationMethod).then((res) => {
      setCorrelationBackendResult(res ?? null);
      setCorrelationLoading(false);
    }).catch(() => setCorrelationLoading(false));
  }, [mainSection, analysisTab, analysisBackendAvailable, selectedDataset?.id, correlationMethod]);

  /**
   * Standalone + bật auth Quantis: cần phiên đăng nhập.
   * Embed + backend PostgreSQL: `/auth/config` trả authEnabled=false — luôn sync khi có backend.
   * Embed + JSON backend bật auth: vẫn cần authUser (Portal inject / postMessage).
   */
  const canSyncToServer = useMemo(
    () => useBackend && (!authConfig?.authEnabled || !!authUser),
    [useBackend, authConfig?.authEnabled, authUser]
  );



  // Auth: cấu hình + phiên khi có backend; Portal embed: __PORTAL_USER__ hoặc postMessage
  useEffect(() => {
    if (!useBackend) {
      setAuthLoading(false);
      return;
    }
    const portalUser = quantisApi.isPortalEmbed() ? quantisApi.getPortalUserFromWindow() : null;
    if (portalUser) {
      setAuthUser(portalUser);
      quantisApi.getAuthConfig().then((c) => setAuthConfig(c ?? null)).finally(() => setAuthLoading(false));
      return;
    }
    let cancelled = false;
    Promise.all([quantisApi.getAuthConfig(), quantisApi.getAuthMe()])
      .then(([config, user]) => {
        if (cancelled) return;
        setAuthConfig(config ?? null);
        if (quantisApi.isPortalEmbed()) {
          const fromWindow = quantisApi.getPortalUserFromWindow();
          const realUser = user && (user.email !== "guest@local" || user.name !== "Guest") ? user : null;
          const u = fromWindow ?? realUser;
          if (u) setAuthUser(u);
        } else {
          setAuthUser(user ?? null);
        }
      })
      .finally(() => {
        if (!cancelled) setAuthLoading(false);
      });
    return () => {
      cancelled = true;
    };
  }, [useBackend, embedConfigGeneration]);

  /** Iframe (AI Portal): xin user và nhận PORTAL_USER — không phụ thuộc isPortalEmbed() lúc mount (global có thể set muộn). */
  useEffect(() => {
    if (typeof window === "undefined") return;
    const win = window;
    if (win.parent === win) return;
    const requestUser = () => {
      win.parent.postMessage({ type: "QUANTIS_NEED_PORTAL_USER" }, "*");
      win.parent.postMessage({ type: "SURVEYLAB_NEED_PORTAL_USER" }, "*");
    };
    requestUser();
    const t0 = setTimeout(requestUser, 400);
    const t1 = setTimeout(requestUser, 1000);
    const t2 = setTimeout(requestUser, 2500);
    const onMessage = (e: MessageEvent) => {
      const d = e.data as { type?: string; user?: { id?: string; email?: string; name?: string } } | null;
      if (d?.type !== "PORTAL_USER" || !d?.user || typeof d.user.id !== "string") return;
      setAuthUser({
        id: d.user.id.trim(),
        email: typeof d.user.email === "string" ? d.user.email : "",
        name: typeof d.user.name === "string" ? d.user.name : (d.user.email ?? ""),
      });
    };
    win.addEventListener("message", onMessage);
    return () => {
      clearTimeout(t0);
      clearTimeout(t1);
      clearTimeout(t2);
      win.removeEventListener("message", onMessage);
    };
  }, []);

  useEffect(() => {
    if (quantisApi.isPortalEmbed() || !authConfig?.authEnabled || !authUser) return;
    const onVis = () => {
      if (document.visibilityState === "visible") {
        quantisApi.getAuthMe().then((user) => {
          if (!user) setAuthUser(null);
        });
      }
    };
    document.addEventListener("visibilitychange", onVis);
    return () => document.removeEventListener("visibilitychange", onVis);
  }, [authConfig?.authEnabled, authUser]);

  /**
   * Kéo workspace từ server: lần đầu khi vừa có thể đồng bộ, hoặc vừa đăng nhập / vừa có mạng sau khi chưa pull.
   * Không GET lại mỗi lần online/offline để không ghi đè chỉnh sửa offline đang giữ trong state.
   */
  useEffect(() => {
    if (!canSyncToServer) {
      didPullServerWorkspaceRef.current = false;
      prevCanSyncRef.current = false;
      setWorkspacePullLoading(false);
      return;
    }
    if (!isOnline) return;

    const becameSyncable = !prevCanSyncRef.current && canSyncToServer;
    prevCanSyncRef.current = canSyncToServer;
    const shouldPull = becameSyncable || !didPullServerWorkspaceRef.current;
    if (!shouldPull) return;

    let cancelled = false;
    setWorkspacePullLoading(true);
    quantisApi
      .getData()
      .then((data) => {
        if (cancelled) return;
        didPullServerWorkspaceRef.current = true;
        if (!data) return;
        setDatasets(data.datasets);
        setWorkflows(data.workflows);
        clearWorkspaceLocalData();
      })
      .catch(() => {
        /* im lặng — offline/proxy lỗi; user vẫn dùng local */
      })
      .finally(() => {
        if (!cancelled) setWorkspacePullLoading(false);
      });
    return () => {
      cancelled = true;
      setWorkspacePullLoading(false);
    };
  }, [canSyncToServer, isOnline]);

  /** Ghi lên server khi online qua store subscriptions */
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const triggerSync = () => {
      const { isOnline: online, useBackend: backend, authConfig: ac, authUser: au } = useSyncStore.getState();
      const canSync = backend && (!ac?.authEnabled || !!au);
      if (!canSync || !online) return;
      if (timer) clearTimeout(timer);
      timer = setTimeout(async () => {
        const d = useDataStore.getState().datasets;
        const w = useWorkflowStore.getState().workflows;
        const ok = await quantisApi.saveData({ datasets: d, workflows: w });
        if (!ok) useSyncStore.getState().setUseBackend(false);
      }, 1500);
    };

    const unsubData = useDataStore.subscribe(triggerSync);
    const unsubWorkflow = useWorkflowStore.subscribe(triggerSync);

    return () => {
      if (timer) clearTimeout(timer);
      unsubData();
      unsubWorkflow();
    };
  }, []);

  // Tải cấu hình dùng chung từ server (áp dụng cho mọi tài khoản)
  useEffect(() => {
    const base = quantisApi.getApiBase();
    if (!base) return;
    quantisApi.getQuantisSettings(base).then((s) => {
      if (s && Object.keys(s).length > 0) setServerSettings(s);
    });
  }, []);

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

  /** Mở xác nhận đặt lại toàn bộ (từ Cài đặt): local + cố gắng ghi rỗng lên server nếu đang đồng bộ. */
  const handleRequestFactoryReset = () => {
    setShowSettings(false);
    setConfirmDialog({
      message:
        t("app.confirmFactoryReset"),
      onConfirm: () => {
        setConfirmDialog(null);
        clearQuantisLocalAppData();
        setServerSettings(null);
        setDatasets([]);
        setWorkflows([]);
        setSelectedDatasetId(null);
        setSelectedWorkflowId(null);
        setSelectedWorkflowStepId(null);
        setDescriptiveBackendResult(null);
        setCorrelationBackendResult(null);
        setLastHypothesisResult(null);
        didPullServerWorkspaceRef.current = true;
        void (async () => {
          const hasBackend = Boolean(quantisApi.getApiBase()?.trim());
          const online = typeof navigator !== "undefined" && navigator.onLine;
          if (hasBackend && online) {
            const ok = await quantisApi.saveData({ datasets: [], workflows: [] });
            if (!ok) showToast(t("app.toastResetLocalOnlyServerFailed"));
            else showToast(t("app.toastResetAppLocalAndServer"));
          } else {
            showToast(t("app.toastResetAppLocalOnly"));
          }
          quantisApi.checkBackendAvailable().then(setUseBackend);
          quantisApi.checkAnalysisBackendAvailable().then(setAnalysisBackendAvailable);
        })();
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

  if (useBackend && authLoading) {
    return (
      <div className="min-h-dvh bg-neutral-100 dark:bg-neutral-900 flex flex-col items-center justify-center gap-3 text-neutral-600 dark:text-neutral-400 px-4">
        <Loader2 className="w-10 h-10 animate-spin text-brand" />
        <p className="text-sm">{t("app.connecting")}</p>
      </div>
    );
  }

  /** Chặn toàn màn hình khi bật auth và không gửi authRequired: false. Mặc định coi như bắt buộc nếu backend không gửi trường. */
  if (!quantisApi.isPortalEmbed() && authConfig && authConfig.authEnabled && authConfig.authRequired !== false && authUser === null && !authLoading) {
    return (
      <QuantAuthGate
        config={authConfig}
        onSuccess={setAuthUser}
        ssoUrl={quantisApi.getSsoLoginUrl()}
      />
    );
  }

  return (
    <div className="flex flex-col h-dvh min-h-0 max-h-dvh overflow-hidden bg-neutral-100 dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100">
      {/* Header */}
      <header className="flex-shrink-0 min-h-14 pt-[env(safe-area-inset-top,0px)] px-2 sm:px-4 border-b border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 flex items-center gap-1">
        <button
          type="button"
          onClick={() => { setMainSection("workflow"); setSelectedWorkflowId(null); setSelectedWorkflowStepId(null); }}
          className="flex items-center gap-1.5 sm:gap-2 min-w-0 rounded-lg hover:opacity-90 transition-opacity text-left flex-shrink-0 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
          title={t("app.backToResearchWorkflow")}
        >
          <div className="w-8 h-8 rounded-lg bg-brand flex items-center justify-center flex-shrink-0">
            <Sigma className="w-4 h-4 text-white" />
          </div>
          <div className="min-w-0">
            <h1 className="font-semibold text-sm sm:text-base truncate leading-tight">Quantis</h1>
            <p className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 truncate hidden sm:block">{t("app.tagline")}</p>
          </div>
        </button>
        <div className="flex-1 flex items-center justify-center min-w-0 overflow-x-auto overscroll-x-contain [scrollbar-width:thin] snap-x snap-mandatory">
          <div className="flex items-center h-full gap-0.5 px-0.5">
            {MAIN_TABS.map((tab) => {
              const isActive = mainSection === tab.section;
              return (
                <button
                  key={tab.id}
                  type="button"
                  onClick={() => handleMainTabClick(tab)}
                  className={`flex items-center gap-1 sm:gap-2 px-2 sm:px-3 md:px-4 py-2.5 min-h-[44px] text-xs sm:text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors shrink-0 snap-start focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2 ${
                    isActive
                      ? "border-brand text-brand bg-brand/5 dark:bg-brand/10"
                      : "border-transparent text-neutral-600 dark:text-neutral-400 hover:text-neutral-800 dark:hover:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700/50"
                  }`}
                  title={tab.label}
                >
                  <tab.icon className="w-4 h-4 shrink-0" />
                  <span className="max-md:inline md:hidden">{tab.shortLabel}</span>
                  <span className="hidden md:inline">{tab.label}</span>
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
            title={theme === "dark" ? t("app.lightMode") : t("app.darkMode")}
            aria-label={theme === "dark" ? t("app.lightMode") : t("app.darkMode")}
          >
            {theme === "dark" ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>
          {authConfig?.authEnabled && !quantisApi.isPortalEmbed() && !authUser && (
            <div className="flex items-center gap-0.5 sm:gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setLoginModalInitialTab("login");
                  setShowLoginModal(true);
                }}
                className="flex min-h-[40px] items-center justify-center gap-1 rounded-lg px-2 sm:px-2.5 py-2 text-xs sm:text-sm font-medium text-neutral-600 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                title={t("app.login")}
                aria-label={t("app.login")}
              >
                <User className="w-4 h-4 shrink-0" />
                <span className="hidden sm:inline">{t("app.login")}</span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setLoginModalInitialTab("register");
                  setShowLoginModal(true);
                }}
                className="flex min-h-[40px] items-center justify-center rounded-lg px-2 sm:px-2.5 py-2 text-xs sm:text-sm font-semibold text-brand hover:bg-brand/10 dark:hover:bg-brand/20 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                title={t("app.registerAccount")}
                aria-label={t("app.register")}
              >
                {t("app.register")}
              </button>
            </div>
          )}
          <div className="relative">
            <button
              type="button"
              onClick={() => setHeaderMenuOpen((v) => !v)}
              className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700 text-neutral-600 dark:text-neutral-400 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              title={t("app.menuHelpConfigSampleWorkflow")}
              aria-label={t("app.openMenuHelpConfigMore")}
              aria-expanded={headerMenuOpen}
              aria-haspopup="menu"
            >
              <MoreVertical className="w-5 h-5" />
            </button>
            {headerMenuOpen && (
              <div
                role="menu"
                aria-label={t("app.appMenu")}
                className="absolute right-0 top-full mt-1 py-1 min-w-[min(100vw-2rem,16rem)] max-w-[calc(100vw-1rem)] max-h-[min(75vh,28rem)] overflow-y-auto overscroll-contain rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg z-50"
              >
                {authUser && (
                  <button
                    type="button"
                    role="menuitem"
                    onClick={() => {
                      setShowAccountDialog(true);
                      setHeaderMenuOpen(false);
                    }}
                    className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                  >
                    <User className="w-4 h-4 shrink-0" />
                    <span className="flex-1 min-w-0 truncate" title={authUser.name || authUser.email || t("app.account")}>
                      {authUser.name || authUser.email || t("app.account")}
                    </span>
                  </button>
                )}
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setGuideOpen(true); setHeaderMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                >
                  <BookOpen className="w-4 h-4 shrink-0 text-brand" />
                  <span className="flex flex-col min-w-0">
                    <span className="font-semibold text-neutral-800 dark:text-neutral-100">{t("app.guideAndHelp")}</span>
                    <span className="text-xs text-neutral-500 dark:text-neutral-400 font-normal leading-snug">{t("app.guideAndHelpDesc")}</span>
                  </span>
                </button>
                <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-600 mx-2" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowDemoGallery(true); setHeaderMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                >
                  <Download className="w-4 h-4 shrink-0" />
                  {t("app.downloadSampleWorkflow")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMainSection("reproducibility");
                    setReproTab("workflows");
                    setHeaderMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                >
                  <GitBranch className="w-4 h-4 shrink-0" />
                  {t("app.workflowsAndReproducibility")}
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => {
                    setMainSection("reproducibility");
                    setReproTab("openscience");
                    setHeaderMenuOpen(false);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                >
                  <FileText className="w-4 h-4 shrink-0" />
                  {t("app.preRegAndOpenScience")}
                </button>
                <div className="my-1 h-px bg-neutral-200 dark:bg-neutral-600 mx-2" role="separator" />
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowSettings(true); setHeaderMenuOpen(false); }}
                  className="w-full flex items-start gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                >
                  <Server className="w-4 h-4 shrink-0 mt-0.5 text-brand" />
                  <span className="min-w-0">
                    <span className="block font-medium">{t("app.connectionSettings")}</span>
                    <span className="block text-xs text-neutral-500 dark:text-neutral-400 font-normal">{t("app.connectionSettingsDesc")}</span>
                  </span>
                </button>
                <button
                  type="button"
                  role="menuitem"
                  onClick={() => { setShowAppFeedbackModal(true); setHeaderMenuOpen(false); }}
                  className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset rounded"
                >
                  <ThumbsUp className="w-4 h-4 shrink-0" />
                  {t("app.appFeedback")}
                </button>
              </div>
            )}
          </div>
        </div>
      </header>

      {workspacePullLoading && (
        <div
          className="flex-shrink-0 flex items-center gap-2 px-3 py-2 text-xs sm:text-sm border-b border-brand/25 bg-brand/10 text-brand dark:bg-brand/15 dark:text-brand-200"
          role="status"
          aria-live="polite"
        >
          <Loader2 className="w-4 h-4 shrink-0 animate-spin" aria-hidden />
          <span>{t("app.loadingWorkspaceFromServer")}</span>
        </div>
      )}

      {sidebarImportBusy && (
        <div
          className="fixed inset-0 z-[260] flex items-center justify-center bg-black/35 backdrop-blur-[2px] p-4"
          role="status"
          aria-live="polite"
          aria-busy="true"
        >
          <div className="flex items-center gap-3 rounded-xl border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-5 py-4 shadow-xl max-w-sm">
            <Loader2 className="w-8 h-8 shrink-0 animate-spin text-brand" aria-hidden />
            <div>
              <p className="font-medium text-neutral-900 dark:text-neutral-100">{t("app.readingFileOnServer")}</p>
              <p className="text-sm text-neutral-500 dark:text-neutral-400 mt-0.5">{t("app.readingFileOnServerDesc")}</p>
            </div>
          </div>
        </div>
      )}

      {isMobileLayout && sidebarOpen && (
        <button
          type="button"
          aria-label={t("app.closeLeftPanel")}
          className="fixed inset-x-0 top-14 bottom-8 z-30 bg-black/45 md:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      {showLoginModal && authConfig && !quantisApi.isPortalEmbed() && (
        <QuantLoginModal
          config={authConfig}
          ssoUrl={quantisApi.getSsoLoginUrl()}
          initialTab={loginModalInitialTab}
          onSuccess={setAuthUser}
          onClose={() => setShowLoginModal(false)}
        />
      )}

      {showAccountDialog && authUser && (
        <div
          className="fixed inset-0 z-[200] flex items-center justify-center p-4 bg-black/40 backdrop-blur-sm"
          onClick={() => setShowAccountDialog(false)}
        >
          <div
            className="rounded-xl border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 w-full max-w-md shadow-xl overflow-hidden"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 flex items-center gap-2">
                <span className="flex h-8 w-8 items-center justify-center rounded-lg bg-brand/15 text-brand">
                  <User className="h-5 w-5" />
                </span>
                {t("app.account")}
              </h2>
              <button
                type="button"
                onClick={() => setShowAccountDialog(false)}
                className="flex h-8 w-8 items-center justify-center rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                aria-label={t("app.close")}
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="p-4 space-y-4">
              <div className="space-y-1">
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">{t("app.fullName")}</p>
                <p className="text-sm text-neutral-800 dark:text-neutral-100">{authUser.name || "—"}</p>
              </div>
              <div className="space-y-1">
                <p className="text-xs font-medium text-neutral-500 dark:text-neutral-400">Email</p>
                <p className="text-sm text-neutral-800 dark:text-neutral-100 break-all">{authUser.email}</p>
              </div>
              <div className="flex flex-col gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-700">
                <button
                  type="button"
                  onClick={() => {
                    setShowAccountDialog(false);
                    setShowSettings(true);
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700 rounded-lg"
                >
                  <Settings className="h-4 w-4 shrink-0" />
                  {t("app.connectionSettingsBackendOllama")}
                </button>
                <button
                  type="button"
                  onClick={async () => {
                    await quantisApi.authLogout();
                    setAuthUser(null);
                    setShowAccountDialog(false);
                    void useDataStore.persist.rehydrate();
                    void useWorkflowStore.persist.rehydrate();
                    showToast(t("app.toastLoggedOut"));
                  }}
                  className="w-full flex items-center gap-2 px-3 py-2.5 text-left text-sm font-medium text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-950/30 rounded-lg"
                >
                  <LogOut className="h-4 w-4" />
                  {t("app.logout")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      <div className="flex flex-1 min-h-0 min-w-0">
      {/* Sidebar: desktop chỉnh width; mobile fixed overlay + trượt */}
      <aside
        className={`flex flex-col overflow-hidden border-neutral-200/80 dark:border-neutral-700/80 bg-white dark:bg-neutral-800 transition-[transform,width] duration-200 ease-out
          max-md:fixed max-md:top-14 max-md:bottom-8 max-md:left-0 max-md:z-40 max-md:w-[min(18rem,calc(100vw-0.75rem))] max-md:shadow-2xl max-md:border-r
          ${sidebarOpen ? "max-md:translate-x-0 max-md:border-r" : "max-md:-translate-x-full max-md:pointer-events-none max-md:border-transparent max-md:shadow-none"}
          md:relative md:translate-x-0 md:pointer-events-auto md:flex-shrink-0
          ${sidebarOpen ? "md:w-64 md:border-r" : "md:w-0 md:border-transparent md:overflow-hidden"}`}
      >
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
                  <option value="">{t("app.selectWorkflowPlaceholder")}</option>
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
                  title={t("app.createNewWorkflow")}
                >
                  <FilePlus className="w-4 h-4" />
                </button>
              </div>
            </div>
            {/* Bộ dữ liệu + Import (luôn hiển thị ở panel trái với mọi tab) */}
            <div className="flex flex-col flex-1 min-h-0 border-t border-neutral-200 dark:border-neutral-700">
                <div className="flex-shrink-0 px-3 py-2 flex items-center gap-2 text-neutral-700 dark:text-neutral-200">
                  <Database className="w-4 h-4 shrink-0" />
                  <span className="text-sm font-semibold">{t("app.datasetsImportSection")}</span>
                </div>
                <div className="flex-shrink-0 px-3 pb-2 flex flex-col gap-1.5">
                  <input ref={csvFileInputRef} type="file" accept=".csv,.tsv,.txt,.json,.xlsx,.xls,.ods,.sav,.dta,.sas7bdat,.rds,.RData,application/json,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" className="hidden" onChange={handleSidebarCsvImport} />
                  <button
                    type="button"
                    onClick={() => csvFileInputRef.current?.click()}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg bg-brand text-white text-sm font-medium hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
                  >
                    <Upload className="w-4 h-4" /> {t("app.uploadFile")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowSampleModal(true)}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 text-sm hover:bg-neutral-50 dark:hover:bg-neutral-700/50"
                  >
                    <Plus className="w-4 h-4" /> {t("app.addSampleDataset")}
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
                        setArchiveSearchError(e instanceof Error ? e.message : t("app.errCannotLoadList"));
                        setArchiveSearchLoading(false);
                      });
                    }}
                    className="w-full flex items-center justify-center gap-2 py-2 rounded-lg border border-sky-300 dark:border-sky-600 bg-sky-50 dark:bg-sky-900/20 text-sky-800 dark:text-sky-200 text-sm hover:bg-sky-100 dark:hover:bg-sky-800/30"
                  >
                    <Cloud className="w-4 h-4" /> {t("app.getFromArchiveNeu")}
                  </button>
                </div>
                <div className="flex-1 min-h-0 overflow-y-auto px-3 pb-3">
                  {(selectedWorkflowId && selectedWorkflow ? workflowDatasets : datasets).length === 0 ? (
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 py-2">{t("app.noDatasetsYet")}</p>
                  ) : (
                    <ul className="space-y-1">
                      {(selectedWorkflowId && selectedWorkflow ? workflowDatasets : datasets).map((d) => {
                        const ext = d.sourceFormat ? (d.sourceFormat === "csv" ? ".csv" : d.sourceFormat === "tsv" ? ".tsv" : d.sourceFormat === "excel" ? ".xlsx" : `.${d.sourceFormat}`) : "";
                        const sourceLabel = d.sourceKey?.startsWith("sample:") ? t("app.sourceLabelSampleData") : d.sourceKey?.startsWith("archive:") ? "Archive NEU" : null;
                        return (
                          <li key={d.id} className="group flex items-stretch gap-0.5 rounded-lg overflow-hidden border border-transparent hover:border-neutral-200 dark:hover:border-neutral-600">
                            <button
                              type="button"
                              onClick={() => {
                                setSelectedDatasetId(d.id);
                                if (isMobileLayout) setSidebarOpen(false);
                              }}
                              className={`flex-1 min-w-0 text-left px-2.5 py-2 min-h-[44px] rounded-l-lg text-sm truncate border transition-colors ${
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
                                  message: `${t("app.confirmDeleteDatasetPrefix")} "${d.name}"?`,
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
                                    showToast(t("app.toastDatasetDeleted"));
                                  },
                                });
                              }}
                              className="flex-shrink-0 p-1.5 rounded-r-lg border border-transparent hover:bg-red-50 dark:hover:bg-red-900/20 text-neutral-400 hover:text-red-600 dark:hover:text-red-400"
                              title={t("app.deleteDataset")}
                              aria-label={t("app.deleteDataset")}
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
          <div className="flex-shrink-0 px-2 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-1 flex-wrap min-w-0">
            <button type="button" onClick={() => setDataTab("preview")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "preview" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Table2 className="w-4 h-4 shrink-0" /> {t("app.dataTab.preview")}</button>
            <button type="button" onClick={() => setDataTab("profiling")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "profiling" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><ScanSearch className="w-4 h-4 shrink-0" /> {t("app.dataTab.profiling")}</button>
            <button type="button" onClick={() => setDataTab("descriptive")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "descriptive" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><BarChart3 className="w-4 h-4 shrink-0" /> {t("app.dataTab.descriptive")}</button>
            <button type="button" onClick={() => setDataTab("transform")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "transform" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Shuffle className="w-4 h-4 shrink-0" /> {t("app.dataTab.transform")}</button>
          </div>
        )}
        {/* Toolbar ở Analysis: Kiểm định / Hồi quy / SEM / ... */}
        {mainSection === "analysis" && (!selectedWorkflowId || selectedStep) && (
          <div role="toolbar" aria-label={t("app.analysisTabsAriaLabel")} className="toolbar flex-shrink-0 px-2 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-1 flex-nowrap overflow-x-auto min-w-0">
            <button type="button" onClick={() => setAnalysisTab("correlation")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "correlation" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><BarChart3 className="w-4 h-4 shrink-0" /> {t("app.analysisTab.correlation")}</button>
            <button type="button" onClick={() => setAnalysisTab("hypothesis")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "hypothesis" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><TestTube className="w-4 h-4 shrink-0" /> {t("app.analysisTab.hypothesis")}</button>
            <button type="button" onClick={() => setAnalysisTab("reliability")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "reliability" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><CheckCircle2 className="w-4 h-4 shrink-0" /> {t("app.analysisTab.reliability")}</button>
            <button type="button" onClick={() => setAnalysisTab("regression")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "regression" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><TrendingUp className="w-4 h-4 shrink-0" /> {t("app.analysisTab.regression")}</button>
            <button type="button" onClick={() => setAnalysisTab("factor")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "factor" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Calculator className="w-4 h-4 shrink-0" /> {t("app.analysisTab.factor")}</button>
            <button type="button" onClick={() => setAnalysisTab("sem")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "sem" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Network className="w-4 h-4 shrink-0" /> SEM</button>
            <button type="button" onClick={() => setAnalysisTab("ml")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "ml" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Cpu className="w-4 h-4 shrink-0" /> {t("app.analysisTab.ml")}</button>
            <button type="button" onClick={() => setAnalysisTab("bayesian")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap shrink-0 ${analysisTab === "bayesian" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Sigma className="w-4 h-4 shrink-0" /> Bayesian</button>
          </div>
        )}
        {/* Trực quan: toolbar loại biểu đồ (cùng vị trí với tab Data / Analysis) */}
        {mainSection === "presentation" && (!selectedWorkflowId || selectedStep) && (
          <div role="toolbar" aria-label={t("app.chartTypeAriaLabel")} className="toolbar flex-shrink-0 px-2 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-1 flex-nowrap overflow-x-auto min-w-0">
            {/* Thứ tự: hay dùng trong báo cáo nghiên cứu lên trước */}
            <button type="button" onClick={() => setPresentationChartType("bar")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "bar" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title={t("app.chartType.bar")}><BarChart3 className="w-4 h-4 shrink-0" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">{t("app.chartType.bar")}</span></button>
            <button type="button" onClick={() => setPresentationChartType("line")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "line" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title={t("app.chartType.line")}><LineChartIcon className="w-4 h-4 shrink-0" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">{t("app.chartType.line")}</span></button>
            <button type="button" onClick={() => setPresentationChartType("scatter")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "scatter" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title={t("app.chartType.scatter")}><ScatterChartIcon className="w-4 h-4 shrink-0" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">{t("app.chartType.scatter")}</span></button>
            <button type="button" onClick={() => setPresentationChartType("histogram")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "histogram" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Histogram"><BarChart2 className="w-4 h-4 shrink-0" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">Histogram</span></button>
            <button type="button" onClick={() => setPresentationChartType("box")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "box" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Box plot"><BoxSelect className="w-4 h-4 shrink-0" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">Box plot</span></button>
            <button type="button" onClick={() => setPresentationChartType("heatmap")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "heatmap" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title={t("app.chartType.heatmap")}><Grid3X3 className="w-4 h-4 shrink-0" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">Heatmap</span></button>
            <button type="button" onClick={() => setPresentationChartType("pie")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "pie" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title={t("app.chartType.pie")}><PieChartIcon className="w-4 h-4 shrink-0" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">{t("app.chartType.pie")}</span></button>
            <button type="button" onClick={() => setPresentationChartType("stackedBar")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "stackedBar" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title={t("app.chartType.stackedBar")}><Layers className="w-4 h-4 shrink-0" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">{t("app.chartType.stackedBar")}</span></button>
            <button type="button" onClick={() => setPresentationChartType("barH")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "barH" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title={t("app.chartType.barH")}><BarChart3 className="w-4 h-4 shrink-0 rotate-90" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">{t("app.chartType.barH")}</span></button>
            <button type="button" onClick={() => setPresentationChartType("area")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "area" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title={t("app.chartType.area")}><AreaChartIcon className="w-4 h-4 shrink-0" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">{t("app.chartType.area")}</span></button>
            <button type="button" onClick={() => setPresentationChartType("donut")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "donut" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Donut"><CircleDot className="w-4 h-4 shrink-0" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">Donut</span></button>
            <button type="button" onClick={() => setPresentationChartType("density")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "density" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title={t("app.chartType.densityCompareTwoGroups")}><TrendingUp className="w-4 h-4 shrink-0" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">Density</span></button>
            <button type="button" onClick={() => setPresentationChartType("radar")} className={`relative group flex items-center justify-center p-2 rounded-lg text-sm shrink-0 ${presentationChartType === "radar" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`} title="Radar"><Gauge className="w-4 h-4 shrink-0" /><span className="absolute left-1/2 -translate-x-1/2 top-full mt-1 px-2 py-0.5 text-xs font-medium bg-neutral-800 dark:bg-neutral-700 text-white rounded opacity-0 pointer-events-none whitespace-nowrap z-50 group-hover:opacity-100 transition-opacity">Radar</span></button>
          </div>
        )}
        {/* Toolbar ở theo bước workflow (khi đang xem Các bước, chọn 1 bước) — không hiện khi đang ở tab AI hướng dẫn */}
        {selectedStep && mainSection !== "data" && mainSection !== "presentation" && mainSection !== "analysis" && mainSection !== "ai" && (
          <div role="toolbar" aria-label={t("app.stepTabsAriaLabel")} className="toolbar flex-shrink-0 px-2 sm:px-4 py-2 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800/80 flex items-center gap-1 flex-wrap min-w-0">
            {selectedStep.type === "import" && (
              <>
                <button type="button" onClick={() => setDataTab("preview")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "preview" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Table2 className="w-4 h-4 shrink-0" /> {t("app.dataTab.preview")}</button>
                <button type="button" onClick={() => setDataTab("profiling")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "profiling" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><ScanSearch className="w-4 h-4 shrink-0" /> {t("app.dataTab.profiling")}</button>
                <button type="button" onClick={() => setDataTab("transform")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "transform" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Shuffle className="w-4 h-4 shrink-0" /> {t("app.dataTab.transform")}</button>
              </>
            )}
            {(selectedStep.type === "clean" || selectedStep.type === "transform") && (
              <>
                <button type="button" onClick={() => setDataTab("transform")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "transform" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Shuffle className="w-4 h-4 shrink-0" /> {t("app.dataTab.transform")}</button>
                <button type="button" onClick={() => setDataTab("preview")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${dataTab === "preview" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Table2 className="w-4 h-4 shrink-0" /> {t("app.dataTab.preview")}</button>
              </>
            )}
            {(selectedStep.type === "describe" || selectedStep.type === "test" || selectedStep.type === "model") && (
              <>
                <button type="button" onClick={() => setAnalysisTab("correlation")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "correlation" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><BarChart3 className="w-4 h-4 shrink-0" /> {t("app.analysisTab.correlation")}</button>
                <button type="button" onClick={() => setAnalysisTab("hypothesis")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "hypothesis" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><TestTube className="w-4 h-4 shrink-0" /> {t("app.analysisTab.hypothesis")}</button>
                <button type="button" onClick={() => setAnalysisTab("reliability")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "reliability" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><CheckCircle2 className="w-4 h-4 shrink-0" /> {t("app.analysisTab.reliability")}</button>
                <button type="button" onClick={() => setAnalysisTab("regression")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "regression" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><TrendingUp className="w-4 h-4 shrink-0" /> {t("app.analysisTab.regression")}</button>
                <button type="button" onClick={() => setAnalysisTab("factor")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "factor" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Calculator className="w-4 h-4 shrink-0" /> {t("app.analysisTab.factor")}</button>
                <button type="button" onClick={() => setAnalysisTab("sem")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "sem" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Network className="w-4 h-4 shrink-0" /> SEM</button>
                <button type="button" onClick={() => setAnalysisTab("ml")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "ml" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Cpu className="w-4 h-4 shrink-0" /> {t("app.analysisTab.ml")}</button>
                <button type="button" onClick={() => setAnalysisTab("bayesian")} className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm whitespace-nowrap ${analysisTab === "bayesian" ? "bg-brand text-white" : "hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-700 dark:text-neutral-300"}`}><Sigma className="w-4 h-4 shrink-0" /> Bayesian</button>
              </>
            )}
            {selectedStep.type === "visualize" && (
              <span className="text-sm text-neutral-500 dark:text-neutral-400">{t("app.mainTab.presentation.label")}</span>
            )}
          </div>
        )}
        <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 min-h-0 w-full max-w-full">
        {!selectedWorkflowId && (
          <div className="w-full max-w-full py-12">
            <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("app.researchWorkflowHeading")}</h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("app.emptyWorkflowIntroPart1")}<strong>{t("app.createNew")}</strong>{t("app.emptyWorkflowIntroPart2")}</p>
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
                        <p className="text-xs font-medium text-brand dark:text-brand/90">{t("app.editingWorkflow")}</p>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">{t("app.workflowNameLabel")}</label>
                          <input
                            type="text"
                            value={editingWorkflowName}
                            onChange={(e) => setEditingWorkflowName(e.target.value)}
                            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200"
                            placeholder={t("app.workflowNameLabel")}
                            autoFocus
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-1">{t("app.descriptionLabel")}</label>
                          <textarea
                            value={editingWorkflowDescription}
                            onChange={(e) => setEditingWorkflowDescription(e.target.value)}
                            rows={2}
                            className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-3 py-2 text-sm text-neutral-800 dark:text-neutral-200 resize-none"
                            placeholder={t("app.descriptionOptionalPlaceholder")}
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
                            {t("app.save")}
                          </button>
                          <button
                            type="button"
                            onClick={() => { setEditingWorkflowNameId(null); setEditingWorkflowDescriptionId(null); }}
                            className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-4 py-2 text-sm font-medium text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                          >
                            {t("app.cancel")}
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
                          {t("app.updatedAtPrefix")} {new Date(selectedWorkflow.updatedAt).toLocaleDateString("vi-VN")} · {selectedWorkflow.steps.length} {t("app.stepsCountSuffix")} · {(selectedWorkflow.datasetIds ?? []).length} {t("app.workflowDatasetsSuffix")}
                        </p>
                      </>
                    )}
                  </div>
                  {editingWorkflowNameId !== selectedWorkflow.id && (
                    <div className="flex items-center gap-2 shrink-0">
                      <button
                        type="button"
                        onClick={() => {
                          setEditingWorkflowNameId(selectedWorkflow.id);
                          setEditingWorkflowName(selectedWorkflow.name);
                          setEditingWorkflowDescriptionId(selectedWorkflow.id);
                          setEditingWorkflowDescription(selectedWorkflow.description ?? "");
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-neutral-700 dark:text-neutral-300 border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      >
                        <Edit2 className="w-4 h-4 shrink-0" /> {t("app.edit")}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setConfirmDialog({
                            message: `${t("app.confirmDeleteWorkflowPrefix")} "${selectedWorkflow.name}"?`,
                            onConfirm: () => {
                              setWorkflows((prev) => prev.filter((x) => x.id !== selectedWorkflow.id));
                              setSelectedWorkflowId(selectedWorkflowId === selectedWorkflow.id ? null : selectedWorkflowId);
                              setSelectedWorkflowStepId(null);
                              setConfirmDialog(null);
                            },
                          });
                        }}
                        className="flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-medium text-red-600 dark:text-red-400 border border-red-300 dark:border-red-600 hover:bg-red-50 dark:hover:bg-red-900/20"
                      >
                        <Trash2 className="w-4 h-4 shrink-0" /> {t("app.deleteWorkflow")}
                      </button>
                    </div>
                  )}
                </div>
              </div>
              <div className="p-6 space-y-6">
                <div>
                  <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">{t("app.stepsInWorkflowHeading")}</h3>
                  {selectedWorkflow.steps.length === 0 ? (
                    <>
                      <p className="text-sm text-neutral-600 dark:text-neutral-400 mb-3">{t("app.standardQualQuantProcess")}</p>
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
                        {t("app.initFromStandardProcess")}
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
                                  <input type="text" value={editingStepLabel} onChange={(e) => setEditingStepLabel(e.target.value)} placeholder={t("app.stepLabelPlaceholder")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm flex-1 min-w-[140px]" />
                                </div>
                                <textarea value={editingStepNote} onChange={(e) => setEditingStepNote(e.target.value)} placeholder={t("app.noteOptionalPlaceholder")} rows={2} className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm resize-none" />
                                <div className="flex items-center gap-2">
                                  <button type="button" onClick={() => {
                                    const next = selectedWorkflow.steps.map((st) => st.id === s.id ? { ...st, type: editingStepType, label: editingStepLabel.trim() || st.label, note: editingStepNote.trim() || undefined, updatedAt: new Date().toISOString() } : st);
                                    setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflow.id ? w : { ...w, steps: next, updatedAt: new Date().toISOString() })));
                                    setEditingStepId(null);
                                  }} className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm font-medium hover:opacity-90">{t("app.save")}</button>
                                  <button type="button" onClick={() => { setEditingStepId(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300">{t("app.cancel")}</button>
                                </div>
                              </div>
                            ) : (
                              <div className="flex items-start justify-between gap-2">
                                <div className="min-w-0 flex-1 flex items-center gap-2">
                                  {editingStepId !== s.id && (
                                    <span className="cursor-grab active:cursor-grabbing text-neutral-400 dark:text-neutral-500 shrink-0" aria-label={t("app.dragToReorder")}>
                                      <GripVertical className="w-4 h-4" />
                                    </span>
                                  )}
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-center gap-2 flex-wrap">
                                      <span className="flex items-center justify-center w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 font-medium text-xs shrink-0">{i + 1}</span>
                                      <span className={isRedundantStepLabel(s.label) ? "text-neutral-800 dark:text-neutral-200 font-medium" : "text-neutral-600 dark:text-neutral-400 text-xs"}>{STEP_TYPE_LABELS[s.type]}</span>
                                      {!isRedundantStepLabel(s.label) && (
                                        <span className="text-neutral-800 dark:text-neutral-200 font-medium">{s.label}</span>
                                      )}
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
                                      title={t("app.stepOptions")}
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
                                            <Edit2 className="w-3.5 h-3.5 shrink-0" /> {t("app.editStep")}
                                          </button>
                                          <button
                                            type="button"
                                            onClick={() => {
                                              setStepMenuOpenId(null);
                                              setConfirmDialog({
                                                message: `${t("app.confirmDeleteStepPrefix")} "${s.label}"?`,
                                                onConfirm: () => {
                                                  setWorkflows((prev) => prev.map((w) => (w.id !== selectedWorkflow.id ? w : { ...w, steps: w.steps.filter((st) => st.id !== s.id).map((st, idx) => ({ ...st, order: idx })), updatedAt: new Date().toISOString() })));
                                                  setConfirmDialog(null);
                                                  if (selectedWorkflowStepId === s.id) setSelectedWorkflowStepId(null);
                                                },
                                              });
                                            }}
                                            className="w-full flex items-center gap-2 px-3 py-2 text-left text-sm text-red-600 dark:text-red-400 hover:bg-red-50 dark:hover:bg-red-900/20"
                                          >
                                            <Trash2 className="w-3.5 h-3.5 shrink-0" /> {t("app.deleteStep")}
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
                        <input type="text" value={newWorkflowStepLabel} onChange={(e) => setNewWorkflowStepLabel(e.target.value)} placeholder={t("app.stepLabelOptionalPlaceholder")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm w-44" />
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
                          {t("app.addStep")}
                        </button>
                      </div>
                    </>
                  )}
                </div>
                {workflowDatasets.length > 0 && (
                  <div>
                    <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">{t("app.attachedDatasetsHeading")}</h3>
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
            correlationLoading={correlationLoading}
            showToast={showToast}
          />
        )}
        {mainSection === "presentation" && (!selectedWorkflowId || selectedStep) && (
          <PresentationView tab={presentationTab} onTabChange={setPresentationTab} selectedDataset={selectedDataset} lastHypothesisResult={lastHypothesisResult} analysisBackendAvailable={analysisBackendAvailable} chartType={presentationChartType} setChartType={setPresentationChartType} showToast={showToast} />
        )}
        {mainSection === "reproducibility" && (
          <ReproducibilityView tab={reproTab} onTabChange={setReproTab} workflows={workflows} setWorkflows={setWorkflows} selectedWorkflowId={selectedWorkflowId} onSelectWorkflow={setSelectedWorkflowId} showToast={showToast} />
        )}
        {mainSection === "ai" && (
          <div className="w-full max-w-full min-h-0 flex justify-center">
            <AIAssistView selectedDataset={selectedDataset} compact={isMobileLayout} />
          </div>
        )}
      </main>
      </div>
      </div>
      {/* Status bar: trái = sidebar + dataset; phải = tài khoản (Portal/đã đăng nhập) hoặc Đăng nhập/Đăng ký (standalone, auth tùy chọn) */}
      <footer className="sticky bottom-0 z-40 mt-3 flex flex-wrap items-center gap-x-3 gap-y-1 border-t border-neutral-200 bg-neutral-100 px-2 py-1 text-[11px] text-neutral-600 dark:border-neutral-700 dark:bg-neutral-800/90 dark:text-neutral-300 sm:px-3 sm:text-xs pb-[max(0.375rem,env(safe-area-inset-bottom,0px))]">
        <button
          type="button"
          onClick={() => setSidebarOpen((o) => !o)}
          className="flex min-h-9 min-w-9 shrink-0 items-center justify-center rounded-md p-1.5 text-neutral-600 hover:bg-neutral-200 dark:text-neutral-300 dark:hover:bg-neutral-700 touch-manipulation sm:min-h-0 sm:min-w-0 sm:p-1 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
          title={sidebarOpen ? t("app.collapseSidebar") : t("app.openSidebar")}
          aria-label={sidebarOpen ? t("app.collapseSidebar") : t("app.openSidebar")}
        >
          {sidebarOpen ? <PanelLeftClose className="h-4 w-4" /> : <PanelLeftOpen className="h-4 w-4" />}
        </button>
        <span className="min-w-0 flex-1 truncate text-left" title={selectedDataset ? `${selectedDataset.name} (${selectedDataset.rows}×${selectedDataset.columns})` : t("app.selectOrImportDataset")}>
          {selectedDataset ? (
            <>Dataset: <strong className="font-medium text-neutral-700 dark:text-neutral-300">{selectedDataset.name}</strong> ({selectedDataset.rows}×{selectedDataset.columns}){selectedWorkflow ? <> · Workflow: {selectedWorkflow.name}{selectedStep ? ` · ${selectedStep.label}` : ""}</> : ""} · {datasets.length} {t("app.datasetsCountSuffix")}</>
          ) : (
            <>{t("app.noDatasetSelected")}{selectedWorkflow ? ` · Workflow: ${selectedWorkflow.name}${selectedStep ? ` · ${selectedStep.label}` : ""}` : ""} · {datasets.length} {t("app.datasetsCountSuffix")}</>
          )}
        </span>
        <div className="ml-auto flex min-w-0 shrink-0 items-center justify-end gap-1.5 border-l border-neutral-200 pl-2 dark:border-neutral-600 sm:gap-2">
          {quantisApi.isPortalEmbed() && authLoading && !authUser && (
            <span className="text-[10px] sm:text-xs text-neutral-500 dark:text-neutral-400 whitespace-nowrap truncate">{t("app.loadingEllipsis")}</span>
          )}
          {authUser && (
            <button
              type="button"
              onClick={() => setShowAccountDialog(true)}
              className="flex items-center gap-1.5 min-h-[36px] max-w-full rounded-md px-2 py-1 text-left text-neutral-700 dark:text-neutral-200 hover:bg-neutral-200/80 dark:hover:bg-neutral-700/80 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1"
              title={authUser.name || authUser.email || t("app.account")}
              aria-label={`${t("app.account")}: ${authUser.name || authUser.email || ""}`}
            >
              <User className="h-3.5 w-3.5 sm:h-4 sm:w-4 shrink-0 text-brand" />
              <span className="truncate font-medium text-[10px] sm:text-xs">
                {authUser.name || authUser.email || t("app.account")}
              </span>
            </button>
          )}
          {!quantisApi.isPortalEmbed() && authConfig?.authEnabled && authConfig.authRequired === false && !authUser && useBackend && (
            <div className="flex items-center gap-1 shrink-0 whitespace-nowrap">
              <button
                type="button"
                onClick={() => {
                  setLoginModalInitialTab("login");
                  setShowLoginModal(true);
                }}
                className="rounded px-1.5 py-1 text-[10px] sm:text-xs font-medium text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {t("app.login")}
              </button>
              <span className="text-neutral-400" aria-hidden>
                ·
              </span>
              <button
                type="button"
                onClick={() => {
                  setLoginModalInitialTab("register");
                  setShowLoginModal(true);
                }}
                className="rounded px-1.5 py-1 text-[10px] sm:text-xs font-medium text-brand hover:underline focus:outline-none focus-visible:ring-2 focus-visible:ring-brand"
              >
                {t("app.register")}
              </button>
            </div>
          )}
        </div>
      </footer>

      {confirmDialog && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setConfirmDialog(null)}>
          <div className="bg-white dark:bg-neutral-900 rounded-xl shadow-xl max-w-md w-full border border-neutral-200 dark:border-neutral-700 flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-end p-2 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
              <button type="button" onClick={() => setConfirmDialog(null)} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700" aria-label={t("app.close")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-4 flex flex-col gap-4">
              <p className="text-neutral-700 dark:text-neutral-300">{confirmDialog.message}</p>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setConfirmDialog(null)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">{t("app.cancel")}</button>
                <button type="button" onClick={() => confirmDialog.onConfirm()} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:opacity-90 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2">{t("app.confirm")}</button>
              </div>
            </div>
          </div>
        </div>
      )}

      {showDemoGallery && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowDemoGallery(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-2xl shadow-xl max-w-3xl w-full max-h-[85vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">{t("app.chooseSampleWorkflow")}</h2>
              <button type="button" onClick={() => setShowDemoGallery(false)} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <p className="px-4 pb-3 text-sm text-neutral-500 dark:text-neutral-400">{t("app.chooseSampleWorkflowDesc")}</p>
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
              <h2 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">{t("app.chooseSampleDataset")}</h2>
              <button type="button" onClick={() => setShowSampleModal(false)} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="px-4 pb-2">
              <input
                type="text"
                value={sampleDatasetSearch}
                onChange={(e) => setSampleDatasetSearch(e.target.value)}
                placeholder={t("app.searchByNameDomainDesc")}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm placeholder-neutral-400 focus:ring-2 focus:ring-brand/50 focus:border-brand"
              />
            </div>
            <div className="flex-1 overflow-y-auto p-4 space-y-2">
              {(() => {
                const q = sampleDatasetSearch.trim().toLowerCase();
                const list = !q
                  ? SAMPLE_DATASETS
                  : SAMPLE_DATASETS.filter((def) => {
                      const name = def.name.toLowerCase();
                      const domain = def.domain.toLowerCase();
                      const desc = def.description.toLowerCase();
                      const tagsStr = (def.tags || []).join(" ").toLowerCase();
                      return name.includes(q) || domain.includes(q) || desc.includes(q) || tagsStr.includes(q);
                    });
                if (list.length === 0) {
                  return <p className="text-sm text-neutral-500 dark:text-neutral-400 py-4">{t("app.noSampleDatasetMatch")}</p>;
                }
                return list.map((def) => (
                  <button
                    key={def.id}
                    type="button"
                    onClick={() => addSampleDatasetFromSidebar(def)}
                    className="w-full text-left p-3 rounded-lg border border-neutral-200 dark:border-neutral-600 hover:border-brand/50 hover:bg-brand/5 dark:hover:bg-brand/10 transition-colors"
                  >
                    <p className="font-medium text-neutral-800 dark:text-neutral-200">{def.name}</p>
                    <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">{def.description}</p>
                  </button>
                ));
              })()}
            </div>
          </div>
        </div>
      )}

      {archiveModalOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setArchiveModalOpen(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700">
              <h3 className="font-semibold flex items-center gap-2"><Cloud className="w-5 h-5 text-sky-600" /> {t("app.archiveNeuChooseDataset")}</h3>
              <button type="button" onClick={() => setArchiveModalOpen(false)} className="p-2 rounded-lg hover:bg-neutral-100 dark:hover:bg-neutral-700"><X className="w-5 h-5" /></button>
            </div>
            <div className="flex-1 overflow-auto p-4">
              {archiveSearchError && <pre className="text-red-600 dark:text-red-400 text-sm mb-3 whitespace-pre-wrap font-sans break-all">{archiveSearchError}</pre>}
              {archiveSearchLoading && <p className="text-neutral-500 text-sm">{t("app.loadingList")}</p>}
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
                              setArchiveSearchError(e instanceof Error ? e.message : t("app.errCannotLoadFile"));
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
                  <button type="button" onClick={() => { setSelectedArchiveRequestId(null); setArchiveFiles([]); setArchiveSearchError(null); }} className="text-sm text-sky-600 dark:text-sky-400 mb-2">{t("app.backToList")}</button>
                  <p className="font-medium mb-2">Dataset: {selectedArchiveTitle}</p>
                  {archiveFilesLoading && <p className="text-sm text-neutral-500">{t("app.loadingFileList")}</p>}
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
                                if (rows.length < 2) { setArchiveSearchError(t("app.errFileNotEnoughRows")); return; }
                                /** Cho phép tải lại cùng file — mỗi lần một dataset mới. */
                                const archiveSourceKey = `archive:${selectedArchiveRequestId}:${f.id}:${generateId()}`;
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
                                setArchiveSearchError(e instanceof Error ? e.message : t("app.errFileDownloadFailed"));
                              } finally {
                                setArchiveDownloadingFileId(null);
                              }
                            }}
                            className="rounded px-3 py-1.5 text-sm bg-brand text-white hover:opacity-90 disabled:opacity-50"
                          >
                            {loading ? t("app.loadingEllipsis2") : t("app.loadIntoQuantis")}
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                  {!archiveFilesLoading && archiveFiles.length === 0 && selectedArchiveRequestId && <p className="text-sm text-neutral-500">{t("app.noFiles")}</p>}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {guideOpen && (
        <GuideModal
          onClose={() => setGuideOpen(false)}
          onOpenSettings={() => {
            setGuideOpen(false);
            setShowSettings(true);
          }}
          onGoRepro={(sub) => {
            setGuideOpen(false);
            setMainSection("reproducibility");
            setReproTab(sub ?? "workflows");
          }}
        />
      )}
      {showSettings && (
        <SettingsModal
          ollamaUpstreamServer={getServerSettings()?.ollamaUpstreamUrl}
          onFactoryResetRequest={handleRequestFactoryReset}
          accountAuthHint={
            useBackend && authLoading
              ? { state: "loading" }
              : quantisApi.isPortalEmbed()
                ? { state: "portal" }
                : !useBackend
                  ? { state: "no-backend" }
                  : !authConfig
                    ? { state: "config-unavailable" }
                    : !authConfig.authEnabled
                      ? { state: "disabled" }
                      : authConfig.authRequired === false
                        ? { state: "optional" }
                        : { state: "required" }
          }
          authUser={authUser}
          onRequestLogin={() => {
            setShowSettings(false);
            setLoginModalInitialTab("login");
            setShowLoginModal(true);
          }}
          onClose={() => {
            setShowSettings(false);
            quantisApi.checkBackendAvailable().then(setUseBackend);
            quantisApi.checkAnalysisBackendAvailable().then(setAnalysisBackendAvailable);
          }}
        />
      )}
      {showAppFeedbackModal && (
        <AppFeedbackModal onClose={() => setShowAppFeedbackModal(false)} />
      )}
      {toast && (
        <div className="fixed z-50 rounded-lg bg-neutral-800 dark:bg-neutral-200 text-white dark:text-neutral-900 px-3 sm:px-4 py-2 shadow-lg text-sm flex items-center gap-2 max-w-[calc(100vw-1.5rem)] left-3 right-3 sm:left-auto sm:right-4 bottom-[max(1rem,env(safe-area-inset-bottom,0px))] sm:bottom-4 sm:max-w-md">
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
      <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("workflowView.title")}</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{t("workflowView.subtitle")}</p>
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
  const [exploreLoading, setExploreLoading] = useState<string | null>(null);
  const [bootstrapCICol, setBootstrapCICol] = useState("");
  const [bootstrapCIResult, setBootstrapCIResult] = useState<{ mean: number; ciLower: number; ciUpper: number; n: number } | null>(null);

  const stats = (analysisBackendAvailable ? descriptiveBackendResult : null) ??(rows.length >= 2 ? computeDescriptive(rows) : []);
  const numericColsDesc = stats.filter((s) => s.mean != null).map((s) => s.column);
  const categorical = stats.filter((s) => s.freq && s.freq.length > 0);
  const chartCol = categorical[0];
  const chartData = chartCol?.freq?.slice(0, 15).map((f) => ({ name: f.value, count: f.count })) || [];

  const copyDescriptiveTsv = useCallback(() => {
    if (stats.length === 0) return;
    const headers = [t("descriptiveStats.table.column"), t("descriptiveStats.table.type"), "N", "Missing", "Mean", "Median", "Std", "Q25", "Q75", "P10", "P90", "Min", "Max", "Kurtosis"];
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
        <h2 className="text-xl font-semibold">{t("descriptiveStats.title")}</h2>
        <div className="flex items-center gap-2">
          {stats.length > 0 && (
            <button type="button" onClick={copyDescriptiveTsv} className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm flex items-center gap-1.5 hover:bg-neutral-100 dark:hover:bg-neutral-700"><Copy className="w-4 h-4" /> {t("descriptiveStats.copyTable")}</button>
          )}
          {aiContextDescriptive ? (
            <AIAssistPanel
              context={aiContextDescriptive}
              quickPrompts={[{ label: t("descriptiveStats.aiExplainLabel"), systemHint: `Bạn là chuyên gia thống kê mô tả. Giải thích ý nghĩa từng chỉ số: N (cỡ mẫu), mean (trung bình), median (trung vị), std (độ lệch chuẩn), các phân vị. Nêu cách đọc và ý nghĩa trong nghiên cứu. ${aiAnswerLangHint()}` }]}
              title={t("descriptiveStats.aiAskTitle")}
            />
          ) : null}
        </div>
      </div>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("descriptiveStats.subtitle")}</p>
      {!selectedDataset ? (
        <p className="text-neutral-500">{t("descriptiveStats.selectDatasetPrompt")}</p>
      ) : stats.length > 0 ? (
        <>
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto mb-4">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left p-2">{t("descriptiveStats.table.column")}</th>
                  <th className="text-left p-2">{t("descriptiveStats.table.type")}</th>
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
            <p className="text-sm font-medium mb-2">{t("descriptiveStats.bootstrapTitle")}</p>
            <p className="text-xs text-neutral-600 dark:text-neutral-400 mb-2">{t("descriptiveStats.bootstrapDesc")}</p>
            <div className="flex flex-wrap gap-4 items-end">
              <div>
                <label className="block text-xs font-medium mb-1">{t("descriptiveStats.numericColumnLabel")}</label>
                <select value={bootstrapCICol} onChange={(e) => { setBootstrapCICol(e.target.value); setBootstrapCIResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm">
                  <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                  {numericColsDesc.map((c) => <option key={c} value={c}>{c}</option>)}
                </select>
              </div>
              <button type="button" onClick={() => { if (!bootstrapCICol || rows.length < 2) return; const ci = rows[0].indexOf(bootstrapCICol); if (ci === -1) return; const vals = rows.slice(1).map((r) => Number(r[ci])).filter((v) => !Number.isNaN(v)); const res = computeBootstrapMeanCI(vals); setBootstrapCIResult(res ?? null); }} disabled={!bootstrapCICol} className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm disabled:opacity-50">{t("descriptiveStats.calculateCIButton")}</button>
            </div>
            {bootstrapCIResult && (
              <div className="mt-2">
                <AIAssistPanel
                  context={`Khoảng tin cậy bootstrap 95%: trung bình = ${bootstrapCIResult.mean.toFixed(4)}, CI = [${bootstrapCIResult.ciLower.toFixed(4)}, ${bootstrapCIResult.ciUpper.toFixed(4)}], n = ${bootstrapCIResult.n}.`}
                  quickPrompts={[{ label: t("descriptiveStats.aiInterpretCILabel"), systemHint: `Bạn là chuyên gia thống kê. Giải thích ý nghĩa khoảng tin cậy 95% (bootstrap): trung bình nằm trong khoảng [ciLower, ciUpper] với độ tin cậy 95%. Nêu cách đọc và dùng trong báo cáo. ${aiAnswerLangHint()}` }]}
                  title={t("descriptiveStats.aiInterpretCITitle")}
                />
                  <p className="text-sm mt-2">{t("descriptiveStats.bootstrapResultMean")} {bootstrapCIResult.mean.toFixed(4)}, 95% CI [{bootstrapCIResult.ciLower.toFixed(4)}, {bootstrapCIResult.ciUpper.toFixed(4)}], n = {bootstrapCIResult.n}</p>
              </div>
            )}
          </div>
          {chartData.length > 0 && (
            <div className="h-64 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4">
              <p className="text-sm font-medium mb-2">{t("descriptiveStats.distributionLabel")} {chartCol?.column}</p>
              <ResponsiveContainer width="100%" height="90%">
                <BarChart data={chartData} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} />
                  <YAxis />
                  <Tooltip />
                  <Bar dataKey="count" fill="#0061bb" name={t("descriptiveStats.chartCountName")} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          <div className="mt-6 space-y-4">
            <div>
              <h3 className="font-medium mb-2">{t("descriptiveStats.freqTableTitle")}</h3>
              <select value={freqCol} onChange={(e) => setFreqCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm mb-2">
                <option value="">{t("descriptiveStats.selectColumnPlaceholder")}</option>
                {stats.filter((s) => s.freq && s.freq.length > 0).map((s) => <option key={s.column} value={s.column}>{s.column}</option>)}
              </select>
              {freqCol && (() => {
                const s = stats.find((x) => x.column === freqCol);
                if (!s?.freq?.length) return null;
                const total = s.freq.reduce((a, f) => a + f.count, 0);
                return (
                  <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead><tr className="border-b border-neutral-200 dark:border-neutral-700"><th className="text-left p-2">{t("descriptiveStats.freqTable.value")}</th><th className="text-right p-2">{t("descriptiveStats.freqTable.freq")}</th><th className="text-right p-2">%</th></tr></thead>
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
              <h3 className="font-medium mb-2">{t("descriptiveStats.crosstabTitle")}</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.rowLabel")}</label>
                  <select value={crosstabCol1} onChange={(e) => setCrosstabCol1(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.columnLabel")}</label>
                  <select value={crosstabCol2} onChange={(e) => setCrosstabCol2(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
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
                      quickPrompts={[{ label: t("descriptiveStats.aiInterpretCrosstabLabel"), systemHint: `Bạn là chuyên gia thống kê. Giải thích ý nghĩa bảng chéo (crosstab): tần số chéo của hai biến phân loại, mối liên hệ giữa hai biến. Gợi ý khi nào dùng kiểm định Chi-square. ${aiAnswerLangHint()}` }]}
                      title={t("descriptiveStats.aiInterpretCrosstabTitle")}
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
              <h3 className="font-medium mb-2">{t("descriptiveStats.textStatsTitle")}</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.textColumnLabel")}</label>
                  <select value={textStatsCol} onChange={(e) => { setTextStatsCol(e.target.value); setTextStatsResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={exploreLoading !== null}
                  onClick={async () => {
                    if (!textStatsCol) return;
                    if (analysisBackendAvailable) {
                      setExploreLoading("textstats");
                      try {
                        const res = await quantisApi.analyzeTextStats(rows, textStatsCol);
                        setTextStatsResult(res ?? null);
                      } finally {
                        setExploreLoading(null);
                      }
                      return;
                    }
                    const res = computeTextStats(rows, textStatsCol);
                    setTextStatsResult(res ?? null);
                  }}
                  className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {exploreLoading === "textstats" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("descriptiveStats.processingLabel")}</> : t("descriptiveStats.analyzeButton")}
                </button>
              </div>
              {textStatsResult && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm space-y-2">
                  <AIAssistPanel
                    context={`Thống kê văn bản cột "${textStatsResult.column}": ${textStatsResult.totalWords} từ, ${textStatsResult.uniqueWords} từ khác nhau, TB ${textStatsResult.avgWordsPerRow.toFixed(1)} từ/dòng. Dòng: ${textStatsResult.nRows}, trống: ${textStatsResult.nEmpty}. Top từ: ${textStatsResult.wordFreq.slice(0, 10).map((w) => `${w.word}(${w.count})`).join(", ")}.`}
                    quickPrompts={[{ label: t("descriptiveStats.aiInterpretTextStatsLabel"), systemHint: `Bạn là chuyên gia phân tích định tính. Giải thích ý nghĩa: tổng số từ, số từ khác nhau, tần số từ — dùng trong nghiên cứu định tính/ngôn ngữ như thế nào. ${aiAnswerLangHint()}` }]}
                    title={t("descriptiveStats.aiInterpretTextStatsTitle")}
                  />
                  <p><strong>{t("descriptiveStats.textStats.totalWordsLabel")}</strong> {textStatsResult.totalWords} | <strong>{t("descriptiveStats.textStats.uniqueWordsLabel")}</strong> {textStatsResult.uniqueWords} | <strong>{t("descriptiveStats.textStats.avgWordsLabel")}</strong> {textStatsResult.avgWordsPerRow.toFixed(1)} (min–max: {textStatsResult.minWordsPerRow}?{textStatsResult.maxWordsPerRow})</p>
                  <p><strong>{t("descriptiveStats.textStats.rowsLabel")}</strong> {textStatsResult.nRows} | <strong>{t("descriptiveStats.textStats.emptyRowsLabel")}</strong> {textStatsResult.nEmpty}</p>
                  <p className="font-medium mt-2">{t("descriptiveStats.textStats.topWordsTitle")}</p>
                  <table className="w-full text-xs"><thead><tr className="border-b border-neutral-200 dark:border-neutral-600"><th className="text-left p-1">{t("descriptiveStats.textStats.wordHeader")}</th><th className="text-right p-1">{t("descriptiveStats.textStats.countHeader")}</th></tr></thead><tbody>
                    {textStatsResult.wordFreq.slice(0, 30).map(({ word, count }) => (
                      <tr key={word} className="border-b border-neutral-100 dark:border-neutral-700/50"><td className="p-1">{word}</td><td className="p-1 text-right">{count}</td></tr>
                    ))}</tbody></table>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">{t("descriptiveStats.keywordCountTitle")}</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.textColumnLabel")}</label>
                  <select value={keywordCountsCol} onChange={(e) => { setKeywordCountsCol(e.target.value); setKeywordCountsResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div className="flex-1 min-w-[200px]">
                  <label className="block text-sm mb-1">{t("descriptiveStats.keywordInputLabel")}</label>
                  <textarea value={keywordCountsInput} onChange={(e) => { setKeywordCountsInput(e.target.value); setKeywordCountsResult(null); }} placeholder={t("descriptiveStats.keywordInputPlaceholder")} className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm min-h-[80px]" rows={3} />
                </div>
                <button
                  type="button"
                  disabled={exploreLoading !== null}
                  onClick={async () => {
                    if (!keywordCountsCol || !keywordCountsInput.trim()) return;
                    const raw = keywordCountsInput.split(/[\n,]+/).map((s) => s.trim()).filter(Boolean);
                    if (!raw.length) return;
                    if (analysisBackendAvailable) {
                      setExploreLoading("keyword");
                      try {
                        const res = await quantisApi.analyzeKeywordCounts(rows, keywordCountsCol, raw);
                        setKeywordCountsResult(res ?? null);
                      } finally {
                        setExploreLoading(null);
                      }
                      return;
                    }
                    const res = computeKeywordCounts(rows, keywordCountsCol, raw);
                    setKeywordCountsResult(res ?? null);
                  }}
                  className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {exploreLoading === "keyword" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("descriptiveStats.processingLabel")}</> : t("descriptiveStats.countButton")}
                </button>
              </div>
              {keywordCountsResult && keywordCountsResult.counts.length > 0 && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm">
                  <AIAssistPanel
                    context={`Đếm từ khóa cột "${keywordCountsResult.column}": ${keywordCountsResult.counts.map((c) => `${c.keyword}: ${c.rowCount} dòng, ${c.totalOccurrences} lần`).join("; ")}.`}
                    quickPrompts={[{ label: t("descriptiveStats.aiInterpretKeywordLabel"), systemHint: `Bạn là chuyên gia phân tích định tính. Giải thích ý nghĩa đếm từ khóa: số dòng chứa từ khóa, tổng lần xuất hiện — dùng để đo mức độ xuất hiện chủ đề trong dữ liệu văn bản. ${aiAnswerLangHint()}` }]}
                    title={t("descriptiveStats.aiInterpretKeywordTitle")}
                  />
                  <p className="font-medium mb-2">{t("descriptiveStats.keywordResult.columnLabel")} {keywordCountsResult.column}</p>
                  <table className="w-full text-xs"><thead><tr className="border-b border-neutral-200 dark:border-neutral-600"><th className="text-left p-1">{t("descriptiveStats.keywordResult.keywordHeader")}</th><th className="text-right p-1">{t("descriptiveStats.keywordResult.rowCountHeader")}</th><th className="text-right p-1">{t("descriptiveStats.keywordResult.totalOccurHeader")}</th></tr></thead><tbody>
                    {keywordCountsResult.counts.map(({ keyword, rowCount, totalOccurrences }) => (
                      <tr key={keyword} className="border-b border-neutral-100 dark:border-neutral-700/50"><td className="p-1">{keyword}</td><td className="p-1 text-right">{rowCount}</td><td className="p-1 text-right">{totalOccurrences}</td></tr>
                    ))}</tbody></table>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">{t("descriptiveStats.ngramTitle")}</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.textColumnLabel")}</label>
                  <select value={ngramCol} onChange={(e) => { setNgramCol(e.target.value); setNgramResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.ngramNLabel")}</label>
                  <select value={ngramN} onChange={(e) => { setNgramN(Number(e.target.value)); setNgramResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value={2}>{t("descriptiveStats.ngramBigramOption")}</option>
                    <option value={3}>{t("descriptiveStats.ngramTrigramOption")}</option>
                  </select>
                </div>
                <button
                  type="button"
                  disabled={exploreLoading !== null}
                  onClick={async () => {
                    if (!ngramCol) return;
                    if (analysisBackendAvailable) {
                      setExploreLoading("ngram");
                      try {
                        const res = await quantisApi.analyzeNgramFreq(rows, ngramCol, ngramN, 50);
                        setNgramResult(res ?? null);
                      } finally {
                        setExploreLoading(null);
                      }
                      return;
                    }
                    setNgramResult(computeNgramFreq(rows, ngramCol, ngramN, 50) ?? null);
                  }}
                  className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {exploreLoading === "ngram" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("descriptiveStats.processingLabel")}</> : t("descriptiveStats.analyzeButton")}
                </button>
              </div>
              {ngramResult && ngramResult.ngramFreq.length > 0 && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm">
                  <AIAssistPanel
                    context={`N-gram (n=${ngramResult.n}) cột "${ngramResult.column}": tổng ${ngramResult.totalNgrams} cụm, ${ngramResult.uniqueNgrams} khác nhau. Top: ${ngramResult.ngramFreq.slice(0, 8).map((x) => `${x.ngram}(${x.count})`).join(", ")}.`}
                    quickPrompts={[{ label: t("descriptiveStats.aiInterpretNgramLabel"), systemHint: `Bạn là chuyên gia phân tích văn bản. Giải thích ý nghĩa n-gram (bigram/trigram): tần số cụm từ phản ánh cụm từ hay đi cùng nhau trong dữ liệu, dùng trong nghiên cứu định tính. ${aiAnswerLangHint()}` }]}
                    title={t("descriptiveStats.aiInterpretNgramTitle")}
                  />
                  <p className="font-medium mb-2">{`${t("descriptiveStats.ngramResult.columnPrefix")} ${ngramResult.column} ${t("descriptiveStats.ngramResult.nPrefix")} ${ngramResult.n} ${t("descriptiveStats.ngramResult.totalPrefix")} ${ngramResult.totalNgrams} ${t("descriptiveStats.ngramResult.uniquePrefix")} ${ngramResult.uniqueNgrams}`}</p>
                  <table className="w-full text-xs"><thead><tr className="border-b border-neutral-200 dark:border-neutral-600"><th className="text-left p-1">{t("descriptiveStats.ngramResult.phraseHeader")}</th><th className="text-right p-1">{t("descriptiveStats.textStats.countHeader")}</th></tr></thead><tbody>
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
                  <label className="block text-sm mb-1">{t("descriptiveStats.coder1Label")}</label>
                  <select value={kappaCol1} onChange={(e) => { setKappaCol1(e.target.value); setKappaResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.coder2Label")}</label>
                  <select value={kappaCol2} onChange={(e) => { setKappaCol2(e.target.value); setKappaResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {cols.map((c) => <option key={c} value={c}>{c}</option>)}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={exploreLoading !== null}
                  onClick={async () => {
                    if (!kappaCol1 || !kappaCol2) return;
                    if (analysisBackendAvailable) {
                      setExploreLoading("kappa");
                      try {
                        const res = await quantisApi.analyzeCohensKappa(rows, kappaCol1, kappaCol2);
                        setKappaResult(res ?? null);
                      } finally {
                        setExploreLoading(null);
                      }
                      return;
                    }
                    setKappaResult(computeCohensKappa(rows, kappaCol1, kappaCol2) ?? null);
                  }}
                  className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {exploreLoading === "kappa" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("descriptiveStats.processingLabel")}</> : t("descriptiveStats.calculateKappaButton")}
                </button>
              </div>
              {kappaResult && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm space-y-2">
                  <AIAssistPanel
                    context={`Cohen's Kappa: ${kappaResult.col1} và ${kappaResult.col2}, κ = ${kappaResult.kappa.toFixed(4)}, n = ${kappaResult.n}.`}
                    quickPrompts={[{ label: t("descriptiveStats.aiInterpretKappaLabel"), systemHint: `Bạn là chuyên gia thống kê. Giải thích Cohen's Kappa: đo độ đồng nhất/đồng thuận giữa hai người mã hóa (coder). Nêu thang diễn giải (ví dụ <0 kém, 0.21–0.40 khá, 0.61–0.80 tốt, >0.81 rất tốt). ${aiAnswerLangHint()}` }]}
                    title={t("descriptiveStats.aiInterpretKappaTitle")}
                  />
                  <p><strong>κ = {kappaResult.kappa}</strong>{` ${t("descriptiveStats.kappaResult.observedAgreementPrefix")} ${kappaResult.observedAgreement}${t("descriptiveStats.kappaResult.expectedAgreementPrefix")} ${kappaResult.expectedAgreement} · n = ${kappaResult.n}`}</p>
                  <p className="text-neutral-600 dark:text-neutral-400 text-xs">{t("descriptiveStats.kappaResult.legend")}</p>
                </div>
              )}
            </div>
            <div>
              <h3 className="font-medium mb-2">{t("descriptiveStats.outlierTitle")}</h3>
              <div className="flex flex-wrap gap-4 items-end mb-2">
                <div>
                  <label className="block text-sm mb-1">{t("descriptiveStats.numericColumnLabel")}</label>
                  <select value={outlierCol} onChange={(e) => { setOutlierCol(e.target.value); setOutlierResult(null); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm">
                    <option value="">{t("descriptiveStats.selectPlaceholder")}</option>
                    {stats.filter((s) => s.type === "numeric").map((s) => (
                      <option key={s.column} value={s.column}>{s.column}</option>
                    ))}
                  </select>
                </div>
                <button
                  type="button"
                  disabled={exploreLoading !== null}
                  onClick={async () => {
                    if (!outlierCol) return;
                    const ci = cols.indexOf(outlierCol);
                    if (ci === -1) return;
                    const values = rows.slice(1).map((r) => Number(r[ci])).filter((v) => !Number.isNaN(v));
                    if (analysisBackendAvailable) {
                      setExploreLoading("outlier");
                      try {
                        const res = await quantisApi.analyzeOutlierIqr(values);
                        setOutlierResult(res ?? null);
                      } finally {
                        setExploreLoading(null);
                      }
                      return;
                    }
                    setOutlierResult(computeOutlierIqr(values));
                  }}
                  className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
                >
                  {exploreLoading === "outlier" ? <><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("descriptiveStats.processingLabel")}</> : t("descriptiveStats.checkButton")}
                </button>
              </div>
              {outlierResult && (
                <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-3 text-sm">
                  <AIAssistPanel
                    context={`điểm ngoại lai IQR: cột số, số điểm = ${outlierResult.outlierCount}. Q1 = ${outlierResult.q1 ?? "?"}, Q3 = ${outlierResult.q3 ?? "?"}, IQR = ${outlierResult.iqr ?? "?"}, ngưỡng [${outlierResult.lower ?? "?"}, ${outlierResult.upper ?? "?"}].`}
                    quickPrompts={[{ label: t("descriptiveStats.aiInterpretOutlierLabel"), systemHint: `Bạn là chuyên gia thống kê. Giải thích điểm ngoại lai theo phương pháp IQR (1.5×IQR): ý nghĩa số điểm, Q1/Q3/ngưỡng. Gợi ý khi nào nên loại bỏ hay giữ lại (kiểm tra lỗi đo, ảnh hưởng phân tích). ${aiAnswerLangHint()}` }]}
                    title={t("descriptiveStats.aiInterpretOutlierTitle")}
                  />
                  <p><strong>{t("descriptiveStats.outlierResult.countLabel")}</strong> {outlierResult.outlierCount}</p>
                  {outlierResult.q1 != null && outlierResult.q3 != null && outlierResult.iqr != null && (
                    <p className="mt-1 text-neutral-600 dark:text-neutral-400">Q1 = {outlierResult.q1.toFixed(2)}, Q3 = {outlierResult.q3.toFixed(2)}, IQR = {outlierResult.iqr.toFixed(2)}. {t("descriptiveStats.outlierResult.thresholdLabel")} [{outlierResult.lower != null ? outlierResult.lower.toFixed(2) : "—"}, {outlierResult.upper != null ? outlierResult.upper.toFixed(2) : "—"}].</p>
                  )}
                </div>
              )}
            </div>
          </div>
        </>
      ) : (
        <p className="text-neutral-500">{t("descriptiveStats.notEnoughData")}</p>
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
    if (!selectedDs) return <div className="w-full max-w-full"><h2 className="text-xl font-semibold mb-2">{t("dataView.exploreDataTitle")}</h2><p className="text-neutral-500">{t("dataView.selectDatasetImportPrompt")}</p><p className="text-sm text-neutral-500 mt-2">{t("dataView.aiGuideHintPrefix")} <strong>{t("dataView.aiGuideHintLabel")}</strong> {t("dataView.importAiGuideHintSuffix")}</p></div>;
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
          <h2 className="text-xl font-semibold">{t("dataView.profiling.title")}</h2>
          {aiContextProfiling ? (
            <AIAssistPanel
              context={aiContextProfiling}
              quickPrompts={[{ label: t("dataView.profiling.aiExplainLabel"), systemHint: `Bạn là chuyên gia thống kê. Giải thích ý nghĩa bảng phân tích sơ bộ: missing (thiếu), kiểu cột, mean/std/min/max, skewness, số điểm ngoại lai — dùng để nắm nhanh chất lượng và phân bố từng biến trước khi phân tích sâu. ${aiAnswerLangHint()}` }]}
              title={t("dataView.profiling.aiAskTitle")}
            />
          ) : null}
        </div>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("dataView.profiling.subtitle")} <span className="text-neutral-500 dark:text-neutral-500" title={t("dataView.profiling.naTooltip")}>{t("dataView.profiling.naLabel")}</span></p>
        {selectedDs && profiles.length > 0 ? (
          <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-neutral-200 dark:border-neutral-700">
                  <th className="text-left p-2">{t("dataView.profiling.table.column")}</th>
                  <th className="text-left p-2">{t("dataView.profiling.table.type")}</th>
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
                    <td className="p-2 text-right" title={p?.type === "categorical" ? t("dataView.profiling.naCellTooltip") : undefined}>{p?.min != null ? Number(p.min).toFixed(2) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? t("dataView.profiling.naCellTooltip") : undefined}>{p?.max != null ? Number(p.max).toFixed(2) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? t("dataView.profiling.naCellTooltip") : undefined}>{p?.mean != null ? Number(p.mean).toFixed(2) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? t("dataView.profiling.naCellTooltip") : undefined}>{p?.std != null ? Number(p.std).toFixed(2) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? t("dataView.profiling.naCellTooltip") : undefined}>{p?.skew != null ? Number(p.skew).toFixed(3) : "—"}</td>
                    <td className="p-2 text-right" title={p?.type === "categorical" ? t("dataView.profiling.naCellTooltip") : undefined}>{p?.outlierCount != null ? p.outlierCount : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : selectedDs ? (
          <p className="text-neutral-500">{t("dataView.profiling.notEnoughDataPrefix")} <strong>{t("dataView.profiling.addSampleDatasetLabel")}</strong> {t("dataView.profiling.notEnoughDataSuffix")}</p>
        ) : (
          <>
            <p className="text-neutral-500">{t("dataView.profiling.noDatasetPrefix")} <strong>{t("dataView.profiling.addSampleDatasetLabel")}</strong> {t("dataView.profiling.noDatasetSuffix")}</p>
            <p className="text-sm text-neutral-500 mt-2">{t("dataView.aiGuideHintPrefix")} <strong>{t("dataView.aiGuideHintLabel")}</strong> {t("dataView.profiling.aiGuideHintSuffix")}</p>
          </>
        )}
      </div>
    );
  }
  if (tab === "transform") {
    return <TransformTab selectedDs={selectedDs} setDatasets={setDatasets} onSelectDataset={onSelectDataset} onWorkflowDatasetAdd={onWorkflowDatasetAdd} />;
  }
  if (tab === "preview") {
    if (!selectedDs) return <div className="w-full max-w-full"><h2 className="text-xl font-semibold mb-2">{t("dataView.preview.title")}</h2><p className="text-neutral-500">{t("dataView.preview.selectDatasetPrompt")}</p><p className="text-sm text-neutral-500 mt-2">{t("dataView.aiGuideHintPrefix")} <strong>{t("dataView.aiGuideHintLabel")}</strong> {t("dataView.previewAiGuideHintSuffix")}</p></div>;
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
        <h2 className="text-xl font-semibold">{t("previewTable.title")}</h2>
        {aiContext ? (
          <AIAssistPanel
            context={aiContext}
            quickPrompts={[{ label: t("previewTable.aiExplainLabel"), systemHint: `Bạn là chuyên gia phân tích dữ liệu. Tóm tắt bộ dữ liệu: tên, số hàng/số cột, tên các biến, và mẫu vài hàng đầu. Nêu ý nghĩa tổng quan để người dùng nắm nhanh nội dung dataset. ${aiAnswerLangHint()}` }]}
            title={t("previewTable.aiAskTitle")}
          />
        ) : null}
      </div>
      <p className="text-neutral-600 dark:text-neutral-400 mb-2">
        {`${dataRows.length} ${t("previewTable.rowsUnit")} × ${headers.length} ${t("previewTable.colsUnit")}.`}
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
                    title={t("previewTable.sortTooltip")}
                  >
                    {h}
                    {sortColIndex === ci && (
                      <span className="text-brand" aria-label={sortDir === "asc" ? t("previewTable.sortAscLabel") : t("previewTable.sortDescLabel")}>{sortDir === "asc" ? " ↑" : " ↓"}</span>
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
          {`${t("previewTable.showingPrefix")} ${sortedRows.length === 0 ? "0" : start + 1}–${Math.min(start + pageSize, sortedRows.length)} / ${sortedRows.length} ${t("previewTable.recordsUnit")}`}
        </span>
        <div className="flex items-center gap-3">
          <label className="flex items-center gap-1.5 text-neutral-600 dark:text-neutral-400">
            {t("previewTable.rowsPerPageLabel")}
            <select value={pageSize} onChange={(e) => { setPageSize(Number(e.target.value)); setPage(1); }} className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1 text-sm">
              {PREVIEW_PAGE_SIZES.map((n) => <option key={n} value={n}>{n} {t("previewTable.rowsOptionSuffix")}</option>)}
            </select>
          </label>
          <div className="flex items-center gap-2">
          <button type="button" disabled={page <= 1} onClick={() => setPage((p) => Math.max(1, p - 1))} className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50">‹ {t("previewTable.prevButton")}</button>
          <span className="min-w-[5rem] text-center tabular-nums">{`${t("previewTable.pagePrefix")} ${page} / ${totalPages}`}</span>
          <button type="button" disabled={page >= totalPages} onClick={() => setPage((p) => Math.min(totalPages, p + 1))} className="px-2 py-1 rounded border border-neutral-300 dark:border-neutral-600 hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50">{t("previewTable.nextButton")} ›</button>
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
  if (!selectedDs) return <div className="w-full max-w-full"><h2 className="text-xl font-semibold mb-2">{t("transformTab.noDatasetTitle")}</h2><p className="text-neutral-500">{t("transformTab.selectDatasetHint")}</p><p className="text-sm text-neutral-500 mt-2">{t("transformTab.useAiGuidePrefix")} <strong>{t("transformTab.aiGuideTabName")}</strong> {t("transformTab.useAiGuideSuffix")}</p></div>;
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
    const suffix = transformAction === "filter" ? t("transformTab.suffixFilter") : transformAction === "sort" ? t("transformTab.suffixSort") : transformAction === "recode" ? t("transformTab.suffixRecode") : transformAction === "z_score" ? " (z-score)" : transformAction === "min_max" ? " (min-max)" : t("transformTab.suffixDefault");
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
        <h2 className="text-xl font-semibold">{t("transformTab.pipelineTitle")}</h2>
        <AIAssistPanel
          context={aiContextTransform}
          quickPrompts={[{ label: t("transformTab.aiPromptGuideLabel"), systemHint: `Bạn là chuyên gia tiền xử lý dữ liệu. Dựa trên cấu trúc và mô tả bộ dữ liệu, gợi ý ngắn gọn: xử lý missing (bỏ/điền mean/median/mode), lọc theo điều kiện, chuẩn hóa (z-score, min-max), sắp xếp, recode biến. Chỉ nêu các bước phù hợp. ${aiAnswerLangHint("Trả lời bằng tiếng Việt.", "Answer in English.")}` }]}
          title={t("transformTab.aiAssistTitle")}
        />
      </div>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("transformTab.description")}</p>
      <div>
        <label className="block text-sm font-medium mb-1">{t("transformTab.actionLabel")}</label>
        <select value={transformAction} onChange={(e) => setTransformAction(e.target.value as typeof transformAction)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 mb-3">
          <option value="drop_missing">{t("transformTab.actionDropMissing")}</option>
          <option value="fill_mean">{t("transformTab.actionFillMean")}</option>
          <option value="fill_median">{t("transformTab.actionFillMedian")}</option>
          <option value="fill_mode">{t("transformTab.actionFillMode")}</option>
          <option value="z_score">{t("transformTab.actionZScore")}</option>
          <option value="min_max">{t("transformTab.actionMinMax")}</option>
          <option value="filter">{t("transformTab.actionFilter")}</option>
          <option value="sort">{t("transformTab.actionSort")}</option>
          <option value="recode">{t("transformTab.actionRecode")}</option>
        </select>
      </div>
      {(transformAction === "drop_missing" || transformAction === "fill_mean" || transformAction === "fill_median" || transformAction === "fill_mode" || transformAction === "z_score" || transformAction === "min_max") && (
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.columnsMultiLabel")}</label>
            <div className="flex flex-wrap gap-x-4 gap-y-1 max-h-32 overflow-y-auto rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-2">
              {cols.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={transformColsMultiple.includes(c)} onChange={() => setTransformColsMultiple((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])} />
                  {c}
                </label>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-1">{t("transformTab.columnsMultiHint")}</p>
          </div>
        </div>
      )}
      {transformAction === "filter" && (
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.columnLabel")}</label>
            <select value={filterCol} onChange={(e) => setFilterCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.conditionLabel")}</label>
            <select value={filterOp} onChange={(e) => setFilterOp(e.target.value as typeof filterOp)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="==">{t("transformTab.opEquals")}</option>
              <option value="!=">{t("transformTab.opNotEquals")}</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">{t("transformTab.opGte")}</option>
              <option value="<=">{t("transformTab.opLte")}</option>
              <option value="contains">{t("transformTab.opContains")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.valueLabel")}</label>
            <input type="text" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder={t("transformTab.valuePlaceholder")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2" />
          </div>
        </div>
      )}
      {transformAction === "sort" && (
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.sortByColumnLabel")}</label>
            <select value={sortCol} onChange={(e) => setSortCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.orderLabel")}</label>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="asc">{t("transformTab.orderAsc")}</option>
              <option value="desc">{t("transformTab.orderDesc")}</option>
            </select>
          </div>
        </div>
      )}
      {transformAction === "recode" && (
        <div className="mb-3">
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">{t("transformTab.recodeColumnLabel")}</label>
            <select value={recodeCol} onChange={(e) => setRecodeCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <p className="text-sm text-neutral-500 mb-2">{t("transformTab.recodeRuleHint")}</p>
          {recodeRules.map((r, i) => (
            <div key={i} className="flex gap-2 items-center mb-2">
              <input type="text" value={r.from} onChange={(e) => setRecodeRule(i, "from", e.target.value)} placeholder={t("transformTab.oldValuePlaceholder")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-32" />
              <span className="text-neutral-500" aria-hidden="true">→</span>
              <input type="text" value={r.to} onChange={(e) => setRecodeRule(i, "to", e.target.value)} placeholder={t("transformTab.newValuePlaceholder")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-32" />
            </div>
          ))}
          <button type="button" onClick={addRecodeRule} className="text-sm text-brand hover:underline">{t("transformTab.addRuleButton")}</button>
        </div>
      )}
      <button type="button" onClick={() => setShowTransformChoiceModal(true)} disabled={["drop_missing","fill_mean","fill_median","fill_mode","z_score","min_max"].includes(transformAction) && transformColsMultiple.length === 0} className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50">{t("transformTab.applyButton")}</button>
      {showTransformChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowTransformChoiceModal(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg max-w-md w-full flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t("transformTab.modalTitle")}</h3>
              <button type="button" onClick={() => setShowTransformChoiceModal(false)} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700" aria-label={t("transformTab.closeAriaLabel")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
            <p className="text-neutral-600 dark:text-neutral-400">{t("transformTab.modalQuestion")}</p>
            <div className="flex flex-col gap-2">
              <button type="button" onClick={() => applyTransform(true)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 px-4 py-2.5 text-left font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600">
                {t("transformTab.overwriteOriginalButton")}
              </button>
              <button type="button" onClick={() => applyTransform(false)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 px-4 py-2.5 text-left font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600">
                {t("transformTab.createNewButton")}
              </button>
              <button type="button" onClick={() => setShowTransformChoiceModal(false)} className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                {t("transformTab.cancelButton")}
              </button>
            </div>
            </div>
          </div>
        </div>
      )}
      {lastTransformResult && (
        <div className="mt-6 space-y-4 rounded-xl border border-neutral-200 dark:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/50 p-4">
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">{t("transformTab.transformResultTitle")} {lastTransformResult.actionLabel}</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {t("transformTab.beforeLabel")} <strong>{lastTransformResult.before.length - 1}</strong> {t("transformTab.rowsUnit")} × <strong>{lastTransformResult.before[0]?.length ?? 0}</strong> {t("transformTab.columnsUnit")}
            {" → "}
            {t("transformTab.afterLabel")} <strong>{lastTransformResult.after.length - 1}</strong> {t("transformTab.rowsUnit")} × <strong>{lastTransformResult.after[0]?.length ?? 0}</strong> {t("transformTab.columnsUnit")}
          </p>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 overflow-hidden">
              <div className="px-3 py-2 border-b border-amber-200 dark:border-amber-800 bg-amber-100/80 dark:bg-amber-900/40 font-medium text-amber-900 dark:text-amber-100 text-sm">
                {t("transformTab.beforeDataHeader")}
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
                  {t("transformTab.rowsTruncatedPrefix")} {lastTransformResult.before.length - 1} {t("transformTab.rowsTruncatedSuffix")}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 overflow-hidden">
              <div className="px-3 py-2 border-b border-emerald-200 dark:border-emerald-800 bg-emerald-100/80 dark:bg-emerald-900/40 font-medium text-emerald-900 dark:text-emerald-100 text-sm">
                {t("transformTab.afterDataHeader")}
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
                  {t("transformTab.rowsTruncatedPrefix")} {lastTransformResult.after.length - 1} {t("transformTab.rowsTruncatedSuffix")}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("transformTab.newDatasetAddedPrefix")} <strong>{t("transformTab.viewDataTabName")}</strong> {t("transformTab.newDatasetAddedSuffix")}
          </p>
        </div>
      )}
    </div>
  );
}

function ReproducibilityView({
  tab,
  onTabChange,
  workflows,
  setWorkflows,
  selectedWorkflowId,
  onSelectWorkflow,
  showToast,
}: {
  tab: ReproducibilityTab;
  onTabChange: (t: ReproducibilityTab) => void;
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

  const reproSubTabs = (
    <div className="flex flex-wrap gap-2 mb-4">
      {([
        { id: "workflows" as const, label: t("reproducibilityView.tabWorkflows") },
        { id: "versioning" as const, label: t("reproducibilityView.tabVersioning") },
        { id: "openscience" as const, label: t("openScience.title") },
      ]).map((x) => (
        <button
          key={x.id}
          type="button"
          onClick={() => onTabChange(x.id)}
          className={`rounded-lg px-3 py-1.5 text-sm font-medium ${
            tab === x.id ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
          }`}
        >
          {x.label}
        </button>
      ))}
    </div>
  );

  if (tab === "openscience") {
    return (
      <div className="w-full max-w-full">
        {reproSubTabs}
        <OpenScienceProtocolPanel showToast={showToast} />
      </div>
    );
  }

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
        {reproSubTabs}
        <h2 className="text-xl font-semibold mb-2">{t("reproducibilityView.tabWorkflows")}</h2>
        <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("reproducibilityView.workflowsDesc")}</p>
        <button type="button" onClick={() => { setShowNewWorkflowDialog(true); setNewWorkflowName(`Workflow ${workflows.length + 1}`); }} className="rounded-lg bg-brand text-white px-4 py-2 flex items-center gap-2 hover:opacity-90">
          <GitBranch className="w-4 h-4" /> {t("app.createNewWorkflow")}
        </button>
        {showNewWorkflowDialog && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => { setShowNewWorkflowDialog(false); setNewWorkflowName(""); }}>
            <div className="rounded-xl bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-xl max-w-md w-full flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
                <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">{t("app.createNewWorkflow")}</h3>
                <button type="button" onClick={() => { setShowNewWorkflowDialog(false); setNewWorkflowName(""); }} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700" aria-label={t("app.close")}>
                  <X className="w-5 h-5" />
                </button>
              </div>
              <div className="p-4">
              <label className="block text-sm font-medium text-neutral-700 dark:text-neutral-300 mb-1.5">{t("app.workflowNameLabel")}</label>
              <input
                type="text"
                value={newWorkflowName}
                onChange={(e) => setNewWorkflowName(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter") addWorkflow(newWorkflowName); if (e.key === "Escape") { setShowNewWorkflowDialog(false); setNewWorkflowName(""); } }}
                placeholder={t("reproducibilityView.workflowNamePlaceholder")}
                className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-neutral-800 dark:text-neutral-200 placeholder-neutral-400 focus:ring-2 focus:ring-brand/50 focus:border-brand"
                autoFocus
              />
              <div className="flex justify-end gap-2 mt-4">
                <button type="button" onClick={() => { setShowNewWorkflowDialog(false); setNewWorkflowName(""); }} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-neutral-200 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-300 dark:hover:bg-neutral-600">{t("reproducibilityView.cancelButton")}</button>
                <button type="button" onClick={() => addWorkflow(newWorkflowName)} className="px-3 py-1.5 rounded-lg text-sm font-medium bg-brand text-white hover:opacity-90">{t("reproducibilityView.createButton")}</button>
              </div>
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
                  <span className="text-sm text-neutral-500">{w.steps.length} {t("app.stepsCountSuffix")}</span>
                </button>
                <button type="button" onClick={() => onSelectWorkflow(w.id)} className="text-brand text-sm">{t("reproducibilityView.openButton")}</button>
              </li>
            ))}
          </ul>
        )}
        {selectedWorkflowId && (() => {
          const w = workflows.find((x) => x.id === selectedWorkflowId);
          if (!w) return null;
          const stepLabels: Record<WorkflowStep["type"], string> = { import: t("app.stepType.import"), clean: t("app.stepType.clean"), transform: t("app.stepType.transform"), describe: t("app.stepType.describe"), test: t("app.stepType.test"), model: t("app.stepType.model"), visualize: t("app.stepType.visualize"), report: t("app.stepType.report") };
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
                {t("reproducibilityView.detailsPrefix")} {editingWfNameId === w.id ? (
                  <input type="text" value={editingWfName} onChange={(e) => setEditingWfName(e.target.value)} onBlur={saveWfName} onKeyDown={(e) => e.key === "Enter" && saveWfName()} className="rounded border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1 text-sm w-64" autoFocus />
                ) : (
                  <button type="button" onClick={() => { setEditingWfNameId(w.id); setEditingWfName(w.name); }} className="text-left hover:underline">{w.name}</button>
                )}
              </h3>
              {w.steps.length > 0 && (
                <AIAssistPanel
                  context={`Workflow: ${w.name}. Các bước: ${w.steps.map((s, i) => `${i + 1}. ${s.label} (${s.type})`).join("; ")}.`}
                  quickPrompts={[{ label: t("reproducibilityView.askAiWorkflowLabel"), systemHint: `${t("reproducibilityView.askAiWorkflowHint")} ${aiAnswerLangHint()}` }]}
                  title={t("reproducibilityView.askAiWorkflowTitle")}
                />
              )}
              <div className="flex flex-wrap items-end gap-2 mb-3">
                <select value={newStepType} onChange={(e) => setNewStepType(e.target.value as WorkflowStep["type"])} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm">
                  {(["import", "clean", "transform", "describe", "test", "model", "visualize", "report"] as const).map((st) => (
                    <option key={st} value={st}>{stepLabels[st]}</option>
                  ))}
                </select>
                <input type="text" value={newStepLabel} onChange={(e) => setNewStepLabel(e.target.value)} placeholder={t("reproducibilityView.newStepLabelPlaceholder")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-40" />
                <button type="button" onClick={addStep} className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm">{t("reproducibilityView.addStepButton")}</button>
                <button type="button" onClick={() => { navigator.clipboard.writeText(rScript); showToast(t("reproducibilityView.copiedRScriptToast")); }} className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm">{t("reproducibilityView.copyRScriptButton")}</button>
              </div>
              {w.steps.length === 0 ? <p className="text-sm text-neutral-500">{t("reproducibilityView.noStepsHint")}</p> : (
                <ol className="list-decimal list-inside space-y-1 text-sm">
                  {w.steps.map((s) => (
                    <li key={s.id} className="flex items-center justify-between">
                      <span>{s.label} ({s.type}){s.note ? ` — ${s.note}` : ""}</span>
                      <button type="button" onClick={() => removeStep(s.id)} className="text-red-600 hover:underline">{t("reproducibilityView.deleteButton")}</button>
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
      {reproSubTabs}
      <h2 className="text-xl font-semibold mb-2">{t("reproducibilityView.tabVersioning")}</h2>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("reproducibilityView.versioningDesc")}</p>
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 text-sm text-neutral-500">
        {t("reproducibilityView.versioningPlaceholder")}
      </div>
    </div>
  );
}
