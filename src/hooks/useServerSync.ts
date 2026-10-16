import { useEffect, useRef, useMemo } from "react";
import {
  useDataStore,
  useWorkflowStore,
  useAnalysisStore,
  useSyncStore,
  useUIStore,
  canSyncToServer as checkCanSyncToServer,
} from "@/stores";
import * as quantisApi from "@/api";
import { clearWorkspaceLocalData, setServerSettings } from "@/utils/storage";
import { getDataRows } from "@/utils/stats";

export function useServerSync() {
  const { setDatasets, selectedDatasetId, datasets } = useDataStore();
  const { setWorkflows } = useWorkflowStore();
  const {
    useBackend,
    setUseBackend,
    authConfig,
    authUser,
    analysisBackendAvailable,
    setAnalysisBackendAvailable,
    isOnline,
    setWorkspacePullLoading,
  } = useSyncStore();
  const { mainSection, dataTab, analysisTab } = useUIStore();
  const {
    correlationMethod,
    setCorrelationBackendResult,
    setCorrelationLoading,
    setDescriptiveBackendResult,
  } = useAnalysisStore();

  const didPullServerWorkspaceRef = useRef(false);
  const prevCanSyncRef = useRef(false);

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);

  useEffect(() => {
    quantisApi.checkBackendAvailable().then(setUseBackend);
  }, [setUseBackend]);

  useEffect(() => {
    quantisApi.checkAnalysisBackendAvailable().then(setAnalysisBackendAvailable);
  }, [setAnalysisBackendAvailable]);

  // Load server settings
  useEffect(() => {
    const base = quantisApi.getApiBase();
    if (!base) return;
    quantisApi.getQuantisSettings(base).then((s) => {
      if (s && Object.keys(s).length > 0) setServerSettings(s);
    });
  }, []);

  const canSyncToServer = useMemo(
    () => checkCanSyncToServer({ useBackend, authConfig, authUser }),
    [useBackend, authConfig, authUser]
  );

  // Kéo workspace từ server
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
      .catch(() => {})
      .finally(() => {
        if (!cancelled) setWorkspacePullLoading(false);
      });
    return () => {
      cancelled = true;
      setWorkspacePullLoading(false);
    };
  }, [canSyncToServer, isOnline, setDatasets, setWorkflows, setWorkspacePullLoading]);

  // Ghi lên server khi online qua store subscriptions
  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | null = null;
    const triggerSync = () => {
      const { isOnline: online, useBackend: backend, authConfig: ac, authUser: au } = useSyncStore.getState();
      // Cùng điều kiện với nhánh kéo/lưu cục bộ: khách Portal (@local) không được ghi workspace lên server.
      const canSync = checkCanSyncToServer({ useBackend: backend, authConfig: ac, authUser: au });
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

  // Khi tab descriptive: lấy thống kê mô tả từ server nếu có backend
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
  }, [mainSection, dataTab, analysisBackendAvailable, selectedDataset?.id, setDescriptiveBackendResult]);

  // Khi tab correlation + backend Python: lấy ma trận tương quan từ server
  useEffect(() => {
    if (mainSection !== "analysis" || analysisTab !== "correlation" || !analysisBackendAvailable || !selectedDataset) {
      setCorrelationBackendResult(null);
      setCorrelationLoading(false);
      return;
    }
    const rows = getDataRows(selectedDataset);
    if (rows.length < 3 || correlationMethod === "kendall") {
      setCorrelationBackendResult(null);
      setCorrelationLoading(false);
      return;
    }
    setCorrelationLoading(true);
    quantisApi
      .analyzeCorrelation(rows, correlationMethod)
      .then((res) => {
        setCorrelationBackendResult(res ?? null);
        setCorrelationLoading(false);
      })
      .catch(() => setCorrelationLoading(false));
  }, [
    mainSection,
    analysisTab,
    analysisBackendAvailable,
    selectedDataset?.id,
    correlationMethod,
    setCorrelationBackendResult,
    setCorrelationLoading,
  ]);
}
