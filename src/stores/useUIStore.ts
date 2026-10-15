import { create } from "zustand";
import { persist } from "zustand/middleware";
import { getPortalTheme, applyPortalTheme } from "@/portal-theme";

export type MainSection = "data" | "analysis" | "reproducibility" | "presentation" | "ai" | "workflow";
export type DataTab = "import" | "profiling" | "transform" | "preview" | "descriptive";
export type AnalysisTab = "descriptive" | "hypothesis" | "regression" | "sem" | "correlation" | "reliability" | "factor" | "ml" | "bayesian" | "panel";
export type ReproducibilityTab = "workflows" | "versioning" | "openscience";
export type PresentationTab = "visualization";
export type PresentationChartType =
  | "scatter"
  | "bar"
  | "line"
  | "pie"
  | "box"
  | "histogram"
  | "area"
  | "stackedBar"
  | "radar"
  | "heatmap"
  | "summary"
  | "donut"
  | "barH"
  | "dashboard"
  | "multiLine"
  | "crosstab"
  | "density";

export interface UIState {
  // Navigation
  mainSection: MainSection;
  dataTab: DataTab;
  analysisTab: AnalysisTab;
  reproTab: ReproducibilityTab;
  presentationTab: PresentationTab;
  presentationChartType: PresentationChartType;

  // Layout
  theme: "light" | "dark";
  sidebarOpen: boolean;
  isMobileLayout: boolean;
  headerMenuOpen: boolean;

  // Modals & Popups
  showSettings: boolean;
  guideOpen: boolean;
  showAppFeedbackModal: boolean;
  showDemoGallery: boolean;
  showSampleModal: boolean;
  showSampleAdminModal: boolean;
  showLoginModal: boolean;
  loginModalInitialTab: "login" | "register";
  showAccountDialog: boolean;
  confirmDialog: { message: string; onConfirm: () => void } | null;
  toast: string | null;

  // Archive modal
  archiveModalOpen: boolean;
  sampleDatasetSearch: string;

  // Actions
  setMainSection: (section: MainSection) => void;
  setDataTab: (tab: DataTab) => void;
  setAnalysisTab: (tab: AnalysisTab) => void;
  setReproTab: (tab: ReproducibilityTab) => void;
  setPresentationTab: (tab: PresentationTab) => void;
  setPresentationChartType: (chartType: PresentationChartType) => void;

  setTheme: (theme: "light" | "dark") => void;
  toggleTheme: () => void;
  setSidebarOpen: (open: boolean | ((prev: boolean) => boolean)) => void;
  setIsMobileLayout: (isMobile: boolean) => void;
  setHeaderMenuOpen: (open: boolean | ((prev: boolean) => boolean)) => void;

  setShowSettings: (show: boolean) => void;
  setGuideOpen: (open: boolean) => void;
  setShowAppFeedbackModal: (show: boolean) => void;
  setShowDemoGallery: (show: boolean) => void;
  setShowSampleModal: (show: boolean) => void;
  setShowSampleAdminModal: (show: boolean) => void;
  setShowLoginModal: (show: boolean) => void;
  setLoginModalInitialTab: (tab: "login" | "register") => void;
  setShowAccountDialog: (show: boolean) => void;
  setConfirmDialog: (dialog: { message: string; onConfirm: () => void } | null) => void;
  setToast: (toast: string | null) => void;
  showToast: (msg: string) => void;
  openLoginModal: (tab?: "login" | "register") => void;

  setArchiveModalOpen: (open: boolean) => void;
  setSampleDatasetSearch: (search: string) => void;
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

export const useUIStore = create<UIState>()(
  persist(
    (set, get) => ({
      mainSection: "data",
      dataTab: "preview",
      analysisTab: "correlation",
      reproTab: "workflows",
      presentationTab: "visualization",
      presentationChartType: "bar",

      theme: getPortalTheme(),
      sidebarOpen: typeof window === "undefined" || !window.matchMedia("(max-width: 767px)").matches,
      isMobileLayout: typeof window !== "undefined" && window.matchMedia("(max-width: 767px)").matches,
      headerMenuOpen: false,

      showSettings: false,
      guideOpen: false,
      showAppFeedbackModal: false,
      showDemoGallery: false,
      showSampleModal: false,
      showSampleAdminModal: false,
      showLoginModal: false,
      loginModalInitialTab: "login",
      showAccountDialog: false,
      confirmDialog: null,
      toast: null,

      archiveModalOpen: false,
      sampleDatasetSearch: "",

      setMainSection: (mainSection) => set({ mainSection }),
      setDataTab: (dataTab) => set({ dataTab }),
      setAnalysisTab: (analysisTab) => set({ analysisTab }),
      setReproTab: (reproTab) => set({ reproTab }),
      setPresentationTab: (presentationTab) => set({ presentationTab }),
      setPresentationChartType: (presentationChartType) => set({ presentationChartType }),

      setTheme: (theme) => {
        applyPortalTheme(theme);
        set({ theme });
      },
      toggleTheme: () => {
        const next = get().theme === "dark" ? "light" : "dark";
        applyPortalTheme(next);
        set({ theme: next });
      },
      setSidebarOpen: (sidebarOpen) =>
        set((s) => ({
          sidebarOpen: typeof sidebarOpen === "function" ? sidebarOpen(s.sidebarOpen) : sidebarOpen,
        })),
      setIsMobileLayout: (isMobileLayout) => set({ isMobileLayout }),
      setHeaderMenuOpen: (headerMenuOpen) =>
        set((s) => ({
          headerMenuOpen: typeof headerMenuOpen === "function" ? headerMenuOpen(s.headerMenuOpen) : headerMenuOpen,
        })),

      setShowSettings: (showSettings) => set({ showSettings }),
      setGuideOpen: (guideOpen) => set({ guideOpen }),
      setShowAppFeedbackModal: (showAppFeedbackModal) => set({ showAppFeedbackModal }),
      setShowDemoGallery: (showDemoGallery) => set({ showDemoGallery }),
      setShowSampleModal: (showSampleModal) => set({ showSampleModal }),
      setShowSampleAdminModal: (showSampleAdminModal) => set({ showSampleAdminModal }),
      setShowLoginModal: (showLoginModal) => set({ showLoginModal }),
      setLoginModalInitialTab: (loginModalInitialTab) => set({ loginModalInitialTab }),
      setShowAccountDialog: (showAccountDialog) => set({ showAccountDialog }),
      setConfirmDialog: (confirmDialog) => set({ confirmDialog }),
      setToast: (toast) => set({ toast }),
      showToast: (msg) => {
        if (toastTimer) clearTimeout(toastTimer);
        set({ toast: msg });
        toastTimer = setTimeout(() => {
          set({ toast: null });
        }, 2000);
      },
      openLoginModal: (tab = "login") =>
        set({ showLoginModal: true, loginModalInitialTab: tab }),

      setArchiveModalOpen: (archiveModalOpen) => set({ archiveModalOpen }),
      setSampleDatasetSearch: (sampleDatasetSearch) => set({ sampleDatasetSearch }),
    }),
    {
      name: "quantis_ui",
      partialize: (s) => ({ theme: s.theme } as UIState),
    }
  )
);
