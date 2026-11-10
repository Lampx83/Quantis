import { useEffect } from "react";
import {
  useDataStore,
  useWorkflowStore,
  useAnalysisStore,
  useSyncStore,
  useUIStore,
  canSyncWorkspace,
  type SyncState,
} from "@/stores";
import * as quantisApi from "@/api";
import { clearWorkspaceLocalData, setServerSettings } from "@/utils/storage";
import { getAnalysisRows } from "@/utils/stats";
import { numericColumnNames } from "@/utils/metadata";
import {
  DATA_CACHE,
  WORKFLOW_CACHE,
  readWorkspaceChanges,
  reconcileWorkspaceItems,
  recordWorkspaceChanges,
  type WorkspaceChangeScope,
  type WorkspaceChanges,
} from "@/stores/workspaceCache";

/** Owns one sync session and invalidates work synchronously when the workspace changes. */
export function startWorkspaceSync(): () => void {
  let epoch = useSyncStore.getState().workspaceEpoch;
  let pullVersion = 0;
  let pulling = false;
  let didPull = false;
  let applyingPull = false;
  let stopped = false;
  let saving = false;
  let dirty = false;
  let timer: ReturnType<typeof setTimeout> | undefined;

  function cancelSave() {
    clearTimeout(timer);
    timer = undefined;
  }

  function current(ownerEpoch: number) {
    return !stopped && useSyncStore.getState().workspaceEpoch === ownerEpoch;
  }

  function hasChanges(changes: WorkspaceChanges) {
    return Object.keys(changes.datasets).length > 0 || Object.keys(changes.workflows).length > 0;
  }

  function restoreChanges(owner: string) {
    const workspaceChanges = {
      datasets: readWorkspaceChanges(DATA_CACHE, owner, "datasets"),
      workflows: readWorkspaceChanges(WORKFLOW_CACHE, owner, "workflows"),
    };
    dirty = hasChanges(workspaceChanges);
    useSyncStore.setState({ workspaceChanges });
    if (dirty) useSyncStore.getState().setWorkspaceSaveStatus("pending");
  }

  function armSave() {
    const state = useSyncStore.getState();
    if (!dirty || !didPull || timer || saving || !current(epoch) || !canSyncWorkspace(state)) return;
    const ownerEpoch = epoch;
    timer = setTimeout(async () => {
      timer = undefined;
      const connection = useSyncStore.getState();
      if (!current(ownerEpoch) || !canSyncWorkspace(connection)) return;
      saving = true;
      dirty = false;
      const datasets = useDataStore.getState().datasets;
      const workflows = useWorkflowStore.getState().workflows;
      const owner = quantisApi.isPortalEmbed() ? undefined : connection.workspaceOwner;
      const ok = await quantisApi.saveData({ datasets, workflows }, owner).catch(() => false);
      if (!current(ownerEpoch)) return;
      saving = false;
      const sync = useSyncStore.getState();
      if (!ok) {
        sync.setWorkspaceSaveStatus("failed");
      } else if (datasets === useDataStore.getState().datasets && workflows === useWorkflowStore.getState().workflows) {
        useSyncStore.setState({ workspaceChanges: { datasets: {}, workflows: {} } });
        sync.setWorkspaceSaveStatus("saved");
      }
      armSave();
    }, 1500);
  }

  function scheduleSave<T extends { id: string; updatedAt: string }>(scope: WorkspaceChangeScope, before: T[], after: T[]) {
    if (applyingPull || !current(epoch) || before === after) return;
    const state = useSyncStore.getState();
    const pending = state.workspaceChanges[scope];
    const changes = recordWorkspaceChanges(pending, before, after);
    if (!Object.keys(changes).length) return;
    useSyncStore.setState({ workspaceChanges: { ...state.workspaceChanges, [scope]: changes } });
    dirty = true;
    if (state.workspaceSaveStatus !== "failed") state.setWorkspaceSaveStatus("pending");
    cancelSave();
    if (didPull) armSave();
    else if (canSyncWorkspace(state)) pullWorkspace(state);
  }

  function updateConnection(state: SyncState, previous?: SyncState) {
    const canSync = canSyncWorkspace(state);
    const ownerChanged = epoch !== state.workspaceEpoch;
    if (previous && !ownerChanged && canSync === canSyncWorkspace(previous)) return;

    if (ownerChanged || !canSync) {
      cancelSave();
      pullVersion++;
      pulling = false;
      if (ownerChanged) {
        didPull = false;
        saving = false;
        epoch = state.workspaceEpoch;
        restoreChanges(state.workspaceOwner);
      }
      state.setWorkspacePullLoading(false);
    }
    if (!canSync) return;
    if (state.workspaceSaveStatus === "failed") dirty = true;
    if (didPull) {
      armSave();
      return;
    }
    pullWorkspace(state);
  }

  function pullWorkspace(state: SyncState) {
    if (pulling) return;
    const ownerEpoch = epoch;
    const request = ++pullVersion;
    const valid = () => current(ownerEpoch) && pullVersion === request;
    pulling = true;
    state.setWorkspacePullLoading(true);
    const owner = quantisApi.isPortalEmbed() ? undefined : state.workspaceOwner;
    void quantisApi.getData(owner)
      .then((data) => {
        if (!valid() || !data) return;
        const { workspaceChanges } = useSyncStore.getState();
        const datasets = useDataStore.getState();
        const workflows = useWorkflowStore.getState();
        const mergedDatasets = reconcileWorkspaceItems(data.datasets, datasets.datasets, workspaceChanges.datasets);
        const mergedWorkflows = reconcileWorkspaceItems(data.workflows, workflows.workflows, workspaceChanges.workflows);
        const changes = { datasets: mergedDatasets.pending, workflows: mergedWorkflows.pending };
        dirty = hasChanges(changes);
        useSyncStore.setState({ workspaceChanges: changes, workspaceSaveStatus: dirty ? "pending" : "idle" });
        applyingPull = true;
        try {
          datasets.hydrateFromServer(mergedDatasets.items);
          workflows.hydrateFromServer(mergedWorkflows.items);
          clearWorkspaceLocalData();
          didPull = true;
        } finally {
          applyingPull = false;
        }
      })
      .catch(() => {})
      .finally(() => {
        if (!valid()) return;
        pulling = false;
        const sync = useSyncStore.getState();
        sync.setWorkspacePullLoading(false);
        if (!didPull && dirty) sync.setWorkspaceSaveStatus("failed");
        armSave();
      });
  }

  const unsubscribe = [
    useDataStore.subscribe((state, previous) => {
      scheduleSave("datasets", previous.datasets, state.datasets);
    }),
    useWorkflowStore.subscribe((state, previous) => {
      scheduleSave("workflows", previous.workflows, state.workflows);
    }),
    useSyncStore.subscribe(updateConnection),
  ];
  restoreChanges(useSyncStore.getState().workspaceOwner);
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
    isOnline,
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
    if (!isOnline) {
      setUseBackend(false);
      return;
    }
    if (useSyncStore.getState().useBackend) return;
    let cancelled = false;
    void quantisApi.checkBackendAvailable().then((available) => {
      if (!cancelled) setUseBackend(available);
    });
    return () => { cancelled = true; };
  }, [isOnline, setUseBackend]);

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
