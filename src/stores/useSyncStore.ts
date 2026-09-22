import { create } from "zustand";
import type { AuthConfig, AuthUser } from "@/api";
import type { ArchiveSearchItem, ArchiveFileItem } from "@/archive-api";

export interface SyncState {
  // Connection
  isOnline: boolean;
  useBackend: boolean;
  analysisBackendAvailable: boolean;

  // Auth
  authConfig: AuthConfig | null;
  authUser: AuthUser | null;
  authLoading: boolean;

  // Sync status
  workspacePullLoading: boolean;
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
  setWorkspacePullLoading: (loading: boolean) => void;
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

export const useSyncStore = create<SyncState>((set) => ({
  isOnline: typeof navigator !== "undefined" ? navigator.onLine : true,
  useBackend: false,
  analysisBackendAvailable: false,

  authConfig: null,
  authUser: null,
  authLoading: true,

  workspacePullLoading: false,
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
  setUseBackend: (useBackend) => set({ useBackend }),
  setAnalysisBackendAvailable: (analysisBackendAvailable) => set({ analysisBackendAvailable }),
  setAuthConfig: (authConfig) => set({ authConfig }),
  setAuthUser: (authUser) => set({ authUser }),
  setAuthLoading: (authLoading) => set({ authLoading }),
  setWorkspacePullLoading: (workspacePullLoading) => set({ workspacePullLoading }),
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
