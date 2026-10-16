import { useEffect, useRef } from "react";
import {
  useUIStore,
  useWorkflowStore,
  useDataStore,
  type MainSection,
  type DataTab,
  type AnalysisTab,
  type ReproducibilityTab,
  type PresentationTab,
} from "@/stores";

export function useURLSync() {
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
  } = useUIStore();

  const {
    selectedWorkflowId,
    setSelectedWorkflowId,
    selectedWorkflowStepId,
    setSelectedWorkflowStepId,
  } = useWorkflowStore();

  const { selectedDatasetId, setSelectedDatasetId } = useDataStore();

  const hasReadUrlRef = useRef(false);

  // 1. Đọc trạng thái từ URL khi mount (F5 / mở link)
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
    const analysisTabs: AnalysisTab[] = [
      "descriptive",
      "hypothesis",
      "regression",
      "sem",
      "correlation",
      "reliability",
      "factor",
      "ml",
      "bayesian",
      "panel",
    ];
    if (at && analysisTabs.includes(at)) setAnalysisTab(at);
    const reproTabs: ReproducibilityTab[] = ["workflows", "versioning", "openscience"];
    if (rt && reproTabs.includes(rt)) setReproTab(rt);
    const presentationTabs: PresentationTab[] = ["visualization"];
    if (pt && presentationTabs.includes(pt)) setPresentationTab(pt);
    hasReadUrlRef.current = true;
  }, [
    setSelectedWorkflowId,
    setSelectedDatasetId,
    setSelectedWorkflowStepId,
    setMainSection,
    setDataTab,
    setAnalysisTab,
    setReproTab,
    setPresentationTab,
  ]);

  // 2. Đẩy trạng thái lên URL khi thay đổi
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
  }, [
    selectedWorkflowId,
    selectedDatasetId,
    selectedWorkflowStepId,
    mainSection,
    dataTab,
    analysisTab,
    reproTab,
    presentationTab,
  ]);
}
