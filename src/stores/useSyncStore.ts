import { create } from "zustand";
import type { AuthConfig, AuthUser, SampleDatasetListItem } from "@/api";
import type { ArchiveSearchItem, ArchiveFileItem } from "@/archive-api";
import * as quantisApi from "@/api";

type LocalSaveScope = "datasets" | "workflows";
type WorkspaceSaveStatus = "idle" | "pending" | "saved" | "failed";
const LAST_STANDALONE_OWNER = "quantis_last_standalone_workspace_owner";

function readStandaloneOwner(): string | null {
  try {
    const owner = localStorage.getItem(LAST_STANDALONE_OWNER);
    return owner?.startsWith("user:") && owner.length > 5 ? owner : null;
  } catch {
    return null;
  }
}

function rememberStandaloneOwner(owner: string) {
  try {
    if (owner === "local") localStorage.removeItem(LAST_STANDALONE_OWNER);
    else localStorage.setItem(LAST_STANDALONE_OWNER, owner);
  } catch {
    // Workspace storage can be unavailable.
  }
}

export interface SyncState {
  // Connection
  isOnline: boolean;
  useBackend: boolean;
  analysisBackendAvailable: boolean;

  // Auth & Admin
  authConfig: AuthConfig | null;
  authUser: AuthUser | null;
  authLoading: boolean;
  isPortalAdmin: boolean;

  // Sample datasets
  sampleDatasetsList: SampleDatasetListItem[];
  sampleDatasetsLoading: boolean;

  // Sync status
  workspacePullLoading: boolean;
  workspaceOwner: string;
  workspaceEpoch: number;
  localSaveFailures: Record<LocalSaveScope, boolean>;
  workspaceSaveStatus: WorkspaceSaveStatus;
  sidebarImportBusy: boolean;
  embedConfigGeneration: number;

  // Archive browsing state
  archiveSearchResult: ArchiveSearchItem[];
  archiveSearchLoading: boolean;
  archiveSearchError: string | null;
  archivePage: number;
  selectedArchiveRequestId: string | null;
  selectedArchiveTitle: string;
  archiveFiles: ArchiveFileItem[];
  archiveFilesLoading: boolean;
  archiveDownloadingFileId: string | null;

  // Actions
  setIsOnline: (online: boolean) => void;
  setUseBackend: (use: boolean) => void;
  setAnalysisBackendAvailable: (available: boolean) => void;
  setAuthConfig: (config: AuthConfig | null) => void;
  setAuthUser: (user: AuthUser | null) => void;
  setAuthLoading: (loading: boolean) => void;
  setIsPortalAdmin: (isAdmin: boolean) => void;
  setSampleDatasetsList: (list: SampleDatasetListItem[]) => void;
  setSampleDatasetsLoading: (loading: boolean) => void;
  refreshSampleDatasets: () => Promise<void>;
  setWorkspacePullLoading: (loading: boolean) => void;
  setLocalSaveFailure: (scope: LocalSaveScope, failed: boolean) => void;
  setWorkspaceSaveStatus: (status: WorkspaceSaveStatus) => void;
  setSidebarImportBusy: (busy: boolean) => void;
  setEmbedConfigGeneration: (gen: number | ((prev: number) => number)) => void;

  setArchiveSearchResult: (results: ArchiveSearchItem[] | ((prev: ArchiveSearchItem[]) => ArchiveSearchItem[])) => void;
  setArchiveSearchLoading: (loading: boolean) => void;
  setArchiveSearchError: (error: string | null) => void;
  setArchivePage: (page: number | ((prev: number) => number)) => void;
  setSelectedArchiveRequestId: (id: string | null) => void;
  setSelectedArchiveTitle: (title: string) => void;
  setArchiveFiles: (files: ArchiveFileItem[] | ((prev: ArchiveFileItem[]) => ArchiveFileItem[])) => void;
  setArchiveFilesLoading: (loading: boolean) => void;
  setArchiveDownloadingFileId: (id: string | null) => void;
}

function switchWorkspaceOwner(state: SyncState, workspaceOwner: string): Partial<SyncState> {
  if (workspaceOwner === state.workspaceOwner) return {};
  return {
    workspaceOwner,
    workspaceEpoch: state.workspaceEpoch + 1,
    localSaveFailures: { datasets: false, workflows: false },
    workspaceSaveStatus: "idle",
  };
}

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  useBackend: false,
  analysisBackendAvailable: false,

  authConfig: null,
  authUser: null,
  authLoading: true,
  isPortalAdmin: false,

  sampleDatasetsList: [],
  sampleDatasetsLoading: false,

  workspacePullLoading: false,
  workspaceOwner: "local",
  workspaceEpoch: 0,
  localSaveFailures: { datasets: false, workflows: false },
  workspaceSaveStatus: "idle",
  sidebarImportBusy: false,
  embedConfigGeneration: 0,

  archiveSearchResult: [],
  archiveSearchLoading: false,
  archiveSearchError: null,
  archivePage: 1,
  selectedArchiveRequestId: null,
  selectedArchiveTitle: "",
  archiveFiles: [],
  archiveFilesLoading: false,
  archiveDownloadingFileId: null,

  setIsOnline: (isOnline) => set({ isOnline }),
  setUseBackend: (useBackend) => set((state) => {
    const owner = !useBackend && state.workspaceEpoch === 0 && !state.authUser && !quantisApi.isPortalEmbed()
      ? readStandaloneOwner()
      : null;
    return { useBackend, ...switchWorkspaceOwner(state, owner ?? state.workspaceOwner) };
  }),
  setAnalysisBackendAvailable: (analysisBackendAvailable) => set({ analysisBackendAvailable }),
  setAuthConfig: (authConfig) => set({ authConfig }),
  setAuthUser: (authUser) => {
    const portal = quantisApi.isPortalEmbed();
    const owner = authUser?.id && !(portal && isPortalGuestUser(authUser)) ? `user:${authUser.id}` : "local";
    if (!portal) rememberStandaloneOwner(owner);
    set((state) => ({ authUser, ...switchWorkspaceOwner(state, owner) }));
  },
  setAuthLoading: (authLoading) => set({ authLoading }),
  setIsPortalAdmin: (isPortalAdmin) => set({ isPortalAdmin }),
  setSampleDatasetsList: (sampleDatasetsList) => set({ sampleDatasetsList }),
  setSampleDatasetsLoading: (sampleDatasetsLoading) => set({ sampleDatasetsLoading }),
  refreshSampleDatasets: async () => {
    set({ sampleDatasetsLoading: true });
    try {
      // Danh sách mẫu do admin quản lý trên server; rỗng nghĩa là admin chưa có/đã xoá mẫu — không rơi về bundle tĩnh.
      const list = await quantisApi.fetchSampleDatasetsList();
      set({ sampleDatasetsList: list });
    } finally {
      set({ sampleDatasetsLoading: false });
    }
  },
  setWorkspacePullLoading: (workspacePullLoading) => set({ workspacePullLoading }),
  setLocalSaveFailure: (scope, failed) => set((state) =>
    state.localSaveFailures[scope] === failed ? state : { localSaveFailures: { ...state.localSaveFailures, [scope]: failed } }),
  setWorkspaceSaveStatus: (workspaceSaveStatus) => set((state) =>
    state.workspaceSaveStatus === workspaceSaveStatus ? state : { workspaceSaveStatus }),
  setSidebarImportBusy: (sidebarImportBusy) => set({ sidebarImportBusy }),
  setEmbedConfigGeneration: (embedConfigGeneration) =>
    set((s) => ({
      embedConfigGeneration:
        typeof embedConfigGeneration === "function"
          ? embedConfigGeneration(s.embedConfigGeneration)
          : embedConfigGeneration,
    })),

  setArchiveSearchResult: (archiveSearchResult) =>
    set((s) => ({
      archiveSearchResult:
        typeof archiveSearchResult === "function"
          ? archiveSearchResult(s.archiveSearchResult)
          : archiveSearchResult,
    })),
  setArchiveSearchLoading: (archiveSearchLoading) => set({ archiveSearchLoading }),
  setArchiveSearchError: (archiveSearchError) => set({ archiveSearchError }),
  setArchivePage: (archivePage) =>
    set((s) => ({
      archivePage:
        typeof archivePage === "function" ? archivePage(s.archivePage) : archivePage,
    })),
  setSelectedArchiveRequestId: (selectedArchiveRequestId) => set({ selectedArchiveRequestId }),
  setSelectedArchiveTitle: (selectedArchiveTitle) => set({ selectedArchiveTitle }),
  setArchiveFiles: (archiveFiles) =>
    set((s) => ({
      archiveFiles:
        typeof archiveFiles === "function" ? archiveFiles(s.archiveFiles) : archiveFiles,
    })),
  setArchiveFilesLoading: (archiveFilesLoading) => set({ archiveFilesLoading }),
  setArchiveDownloadingFileId: (archiveDownloadingFileId) => set({ archiveDownloadingFileId }),
}));

/** Id cố định Portal gán cho khách chưa đăng nhập (email "guest@portal.local", tên "Khách"). */
const PORTAL_GUEST_ID = "11111111-1111-1111-1111-111111111111";

/**
 * Khách Portal: không có workspace trên server → dữ liệu chỉ được giữ ở trình duyệt.
 * Nhận diện theo id cố định, email "guest@…" hoặc đuôi "@local" (trước đây chỉ kiểm tra "@local" nên
 * "guest@portal.local" bị coi là tài khoản thật: không lưu cục bộ, tải lại là mất dataset).
 */
export function isPortalGuestUser(u: { id?: string; email?: string } | null | undefined): boolean {
  if (!u) return false;
  const email = (u.email ?? "").trim().toLowerCase();
  return u.id === PORTAL_GUEST_ID || email.startsWith("guest@") || email.endsWith("@local");
}

/**
 * Kiểm tra xem client có đủ điều kiện đồng bộ workspace lên server không.
 * - Embed + backend PostgreSQL: `/auth/config` trả authEnabled=false — luôn sync khi có backend.
 * - Embed + JSON backend bật auth: cần authUser.
 * - Portal embed: chỉ tài khoản thật được sync (email khác rỗng và không kết thúc bằng @local).
 */
export function canSyncToServer(syncState: {
  useBackend: boolean;
  authConfig: AuthConfig | null;
  authUser: AuthUser | null;
  workspaceOwner?: string;
}): boolean {
  if (!syncState.useBackend) return false;
  if (quantisApi.isPortalEmbed()) {
    const email = (syncState.authUser?.email ?? "").trim().toLowerCase();
    return !!syncState.authUser && !!email && !isPortalGuestUser(syncState.authUser);
  }
  if (syncState.workspaceOwner?.startsWith("user:") && !syncState.authUser) return false;
  return !syncState.authConfig?.authEnabled || !!syncState.authUser;
}

/** true khi workspace phải được lưu đầy đủ ở localStorage (không đồng bộ server hoặc đang offline). */
export function persistsWorkspaceLocally(s: {
  useBackend: boolean;
  authConfig: AuthConfig | null;
  authUser: AuthUser | null;
  workspaceOwner?: string;
  isOnline: boolean;
  workspaceSaveStatus?: WorkspaceSaveStatus;
}): boolean {
  return !canSyncToServer(s) || !s.isOnline || s.workspaceSaveStatus === "pending" || s.workspaceSaveStatus === "failed";
}

export function shouldWriteWorkspaceCache(state: SyncState, previous: SyncState): boolean {
  const local = persistsWorkspaceLocally(state);
  const wasLocal = persistsWorkspaceLocally(previous);
  return local !== wasLocal && (local || state.workspaceSaveStatus === "saved");
}
