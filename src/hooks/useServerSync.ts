import { useEffect } from "react";
import {
  useDataStore,
  useWorkflowStore,
  useAnalysisStore,
  useSyncStore,
  useUIStore,
  canSyncToServer,
  type SyncState,
} from "@/stores";
import * as quantisApi from "@/api";
import { clearWorkspaceLocalData, setServerSettings } from "@/utils/storage";
import { getAnalysisRows } from "@/utils/stats";
import { numericColumnNames } from "@/utils/metadata";

/** Owns one sync session and invalidates work synchronously when the workspace changes. */
export function startWorkspaceSync(): () => void {
  let epoch = useSyncStore.getState().workspaceEpoch;
  let pullVersion = 0;
  let pulling = false;
  let didPull = false;
  let applyingPull = false;
  let stopped = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancelSave() {
    clearTimeout(timer);
    timer = undefined;
  }

  function current(ownerEpoch: number) {
    return !stopped && useSyncStore.getState().workspaceEpoch === ownerEpoch;
  }

  function scheduleSave() {
    const state = useSyncStore.getState();
    if (applyingPull || !current(epoch) || !state.isOnline || !canSyncToServer(state)) return;
    cancelSave();
    const ownerEpoch = epoch;
    timer = setTimeout(async () => {
      timer = undefined;
      const connection = useSyncStore.getState();
      if (!current(ownerEpoch) || !connection.isOnline || !canSyncToServer(connection)) return;
      const datasets = useDataStore.getState().datasets;
      const workflows = useWorkflowStore.getState().workflows;
      const ok = await quantisApi.saveData({ datasets, workflows }).catch(() => false);
      if (!ok && current(ownerEpoch)) useSyncStore.getState().setUseBackend(false);
    }, 1500);
  }

  function updateConnection(state: SyncState, previous?: SyncState) {
    const canSync = canSyncToServer(state);
    const ownerChanged = epoch !== state.workspaceEpoch;
    if (previous && !ownerChanged && state.isOnline === previous.isOnline &&
      canSync === canSyncToServer(previous)) return;

    if (ownerChanged || !canSync || !state.isOnline) {
      cancelSave();
      pullVersion++;
      pulling = false;
      if (ownerChanged || !canSync) didPull = false;
      epoch = state.workspaceEpoch;
      state.setWorkspacePullLoading(false);
    }
    if (!state.isOnline || !canSync || didPull || pulling) return;

    const ownerEpoch = epoch;
    const request = ++pullVersion;
    const valid = () => current(ownerEpoch) && pullVersion === request;
    pulling = true;
    state.setWorkspacePullLoading(true);
    void quantisApi.getData()
      .then((data) => {
        if (!valid() || !data) return;
        cancelSave();
        applyingPull = true;
        try {
          useDataStore.getState().hydrateFromServer(data.datasets);
          useWorkflowStore.getState().hydrateFromServer(data.workflows);
          clearWorkspaceLocalData();
        } finally {
          applyingPull = false;
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!valid()) return;
        pulling = false;
        didPull = true;
        useSyncStore.getState().setWorkspacePullLoading(false);
      });
  }

  const unsubscribe = [
    useDataStore.subscribe((state, previous) => {
      if (state.datasets !== previous.datasets) scheduleSave();
    }),
    useWorkflowStore.subscribe((state, previous) => {
      if (state.workflows !== previous.workflows) scheduleSave();
    }),
    useSyncStore.subscribe(updateConnection),
  ];
  updateConnection(useSyncStore.getState());
  return () => {
    stopped = true;
    cancelSave();
    unsubscribe.forEach((stop) => stop());
    if (pulling) useSyncStore.getState().setWorkspacePullLoading(false);
  };
}

export function useServerSync() {
  const { selectedDatasetId, datasets } = useDataStore();
  const {
    setUseBackend,
    analysisBackendAvailable,
    setAnalysisBackendAvailable,
  } = useSyncStore();
  const { mainSection, dataTab, analysisTab } = useUIStore();
  const {
    correlationMethod,
    setCorrelationBackendResult,
    setCorrelationLoading,
    setDescriptiveBackendResult,
  } = useAnalysisStore();

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

  useEffect(startWorkspaceSync, []);

  // Khi tab descriptive: lấy thống kê mô tả từ server nếu có backend
  useEffect(() => {
    const onDescriptiveTab = mainSection === "data" && dataTab === "descriptive";
    if (!onDescriptiveTab || !analysisBackendAvailable || !selectedDataset) {
      setDescriptiveBackendResult(null);
      return;
    }
    const rows = getAnalysisRows(selectedDataset);
    if (rows.length < 2) {
      setDescriptiveBackendResult(null);
      return;
    }
    quantisApi
      .analyzeDescriptive(rows, numericColumnNames(selectedDataset.variables))
      .then((res) => setDescriptiveBackendResult(res ?? null));
  }, [mainSection, dataTab, analysisBackendAvailable, selectedDataset?.id, setDescriptiveBackendResult]);

  // Khi tab correlation + backend Python: lấy ma trận tương quan từ server
  useEffect(() => {
    if (mainSection !== "analysis" || analysisTab !== "correlation" || !analysisBackendAvailable || !selectedDataset) {
      setCorrelationBackendResult(null);
      setCorrelationLoading(false);
      return;
    }
    const rows = getAnalysisRows(selectedDataset);
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
