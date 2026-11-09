import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Workflow, WorkflowStep } from "@/types";
import { useSyncStore, persistsWorkspaceLocally, shouldWriteWorkspaceCache, workspaceOwner } from "./useSyncStore";
import { readWorkspaceCache, workspaceCacheKey } from "./workspaceCache";

let switchingOwner = false;

export interface WorkflowState {
  // --- Persisted State ---
  workflows: Workflow[];
  selectedWorkflowId: string | null;
  selectedWorkflowStepId: string | null;

  // --- Ephemeral Editing State ---
  editingWorkflowNameId: string | null;
  editingWorkflowName: string;
  editingWorkflowDescriptionId: string | null;
  editingWorkflowDescription: string;

  editingStepId: string | null;
  editingStepLabel: string;
  editingStepType: WorkflowStep["type"];
  editingStepNote: string;
  newWorkflowStepType: WorkflowStep["type"];
  newWorkflowStepLabel: string;

  draggingStepId: string | null;
  dropTargetIndex: number | null;
  stepMenuOpenId: string | null;

  // --- Actions ---
  setWorkflows: (workflows: Workflow[] | ((prev: Workflow[]) => Workflow[])) => void;
  addWorkflow: (workflow: Workflow) => void;
  removeWorkflow: (id: string) => void;
  updateWorkflow: (id: string, patch: Partial<Workflow>) => void;
  setSelectedWorkflowId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setSelectedWorkflowStepId: (id: string | null | ((prev: string | null) => string | null)) => void;

  setEditingWorkflowNameId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setEditingWorkflowName: (name: string | ((prev: string) => string)) => void;
  setEditingWorkflowDescriptionId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setEditingWorkflowDescription: (desc: string | ((prev: string) => string)) => void;

  setEditingStepId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setEditingStepLabel: (label: string | ((prev: string) => string)) => void;
  setEditingStepType: (type: WorkflowStep["type"] | ((prev: WorkflowStep["type"]) => WorkflowStep["type"])) => void;
  setEditingStepNote: (note: string | ((prev: string) => string)) => void;
  setNewWorkflowStepType: (type: WorkflowStep["type"] | ((prev: WorkflowStep["type"]) => WorkflowStep["type"])) => void;
  setNewWorkflowStepLabel: (label: string | ((prev: string) => string)) => void;

  setDraggingStepId: (id: string | null | ((prev: string | null) => string | null)) => void;
  setDropTargetIndex: (index: number | null | ((prev: number | null) => number | null)) => void;
  setStepMenuOpenId: (id: string | null | ((prev: string | null) => string | null)) => void;

  hydrateFromServer: (workflows: Workflow[]) => void;
}

export const useWorkflowStore = create<WorkflowState>()(
  persist(
    (set) => ({
      workflows: [],
      selectedWorkflowId: null,
      selectedWorkflowStepId: null,

      editingWorkflowNameId: null,
      editingWorkflowName: "",
      editingWorkflowDescriptionId: null,
      editingWorkflowDescription: "",

      editingStepId: null,
      editingStepLabel: "",
      editingStepType: "import",
      editingStepNote: "",
      newWorkflowStepType: "import",
      newWorkflowStepLabel: "",

      draggingStepId: null,
      dropTargetIndex: null,
      stepMenuOpenId: null,

      setWorkflows: (workflows) =>
        set((s) => ({
          workflows: typeof workflows === "function" ? workflows(s.workflows) : workflows,
        })),
      addWorkflow: (workflow) =>
        set((s) => ({ workflows: [...s.workflows, workflow] })),
      removeWorkflow: (id) =>
        set((s) => ({
          workflows: s.workflows.filter((w) => w.id !== id),
          selectedWorkflowId: s.selectedWorkflowId === id ? null : s.selectedWorkflowId,
        })),
      updateWorkflow: (id, patch) =>
        set((s) => ({
          workflows: s.workflows.map((w) => (w.id === id ? { ...w, ...patch } : w)),
        })),
      setSelectedWorkflowId: (id) =>
        set((s) => ({
          selectedWorkflowId: typeof id === "function" ? id(s.selectedWorkflowId) : id,
        })),
      setSelectedWorkflowStepId: (id) =>
        set((s) => ({
          selectedWorkflowStepId: typeof id === "function" ? id(s.selectedWorkflowStepId) : id,
        })),

      setEditingWorkflowNameId: (id) =>
        set((s) => ({
          editingWorkflowNameId: typeof id === "function" ? id(s.editingWorkflowNameId) : id,
        })),
      setEditingWorkflowName: (name) =>
        set((s) => ({
          editingWorkflowName: typeof name === "function" ? name(s.editingWorkflowName) : name,
        })),
      setEditingWorkflowDescriptionId: (id) =>
        set((s) => ({
          editingWorkflowDescriptionId: typeof id === "function" ? id(s.editingWorkflowDescriptionId) : id,
        })),
      setEditingWorkflowDescription: (desc) =>
        set((s) => ({
          editingWorkflowDescription: typeof desc === "function" ? desc(s.editingWorkflowDescription) : desc,
        })),

      setEditingStepId: (id) =>
        set((s) => ({
          editingStepId: typeof id === "function" ? id(s.editingStepId) : id,
        })),
      setEditingStepLabel: (label) =>
        set((s) => ({
          editingStepLabel: typeof label === "function" ? label(s.editingStepLabel) : label,
        })),
      setEditingStepType: (type) =>
        set((s) => ({
          editingStepType: typeof type === "function" ? type(s.editingStepType) : type,
        })),
      setEditingStepNote: (note) =>
        set((s) => ({
          editingStepNote: typeof note === "function" ? note(s.editingStepNote) : note,
        })),
      setNewWorkflowStepType: (type) =>
        set((s) => ({
          newWorkflowStepType: typeof type === "function" ? type(s.newWorkflowStepType) : type,
        })),
      setNewWorkflowStepLabel: (label) =>
        set((s) => ({
          newWorkflowStepLabel: typeof label === "function" ? label(s.newWorkflowStepLabel) : label,
        })),

      setDraggingStepId: (id) =>
        set((s) => ({
          draggingStepId: typeof id === "function" ? id(s.draggingStepId) : id,
        })),
      setDropTargetIndex: (index) =>
        set((s) => ({
          dropTargetIndex: typeof index === "function" ? index(s.dropTargetIndex) : index,
        })),
      setStepMenuOpenId: (id) =>
        set((s) => ({
          stepMenuOpenId: typeof id === "function" ? id(s.stepMenuOpenId) : id,
        })),

      hydrateFromServer: (workflows) => set({ workflows }),
    }),
    {
      name: "quantis_workflows_data",
      partialize: (s) =>
        ({
          workflows: s.workflows,
          selectedWorkflowId: s.selectedWorkflowId,
          owner: workspaceOwner(useSyncStore.getState().authUser),
        }),
      storage: {
        getItem: (name) => {
          try {
            const owner = workspaceOwner(useSyncStore.getState().authUser);
            const cached = readWorkspaceCache(name, owner);
            if (cached) return cached;

            // Fallback: migration từ key cũ quantis_workflows
            if (owner !== "local") return null;
            const oldWorkflows = localStorage.getItem("quantis_workflows");
            if (oldWorkflows) {
              const parsed = JSON.parse(oldWorkflows);
              const workflows = Array.isArray(parsed) ? parsed : (parsed.state?.workflows ?? []);
              const migrated = {
                state: {
                  workflows,
                  selectedWorkflowId: null,
                },
                version: 0,
              };
              try {
                localStorage.setItem(workspaceCacheKey(name, owner), JSON.stringify(migrated));
                localStorage.removeItem("quantis_workflows");
              } catch {}
              return migrated;
            }
          } catch {
            return null;
          }
          return null;
        },
        setItem: (name, value) => {
          if (switchingOwner || (typeof window === "undefined" && typeof localStorage === "undefined")) return;
          const sync = useSyncStore.getState();
          const local = persistsWorkspaceLocally(sync);
          const key = workspaceCacheKey(name, value.state.owner);
          try {
            if (!local) {
              const lightweightValue = {
                ...value,
                state: {
                  ...value.state,
                  workflows: [],
                },
              };
              localStorage.setItem(key, JSON.stringify(lightweightValue));
              return;
            }
            localStorage.setItem(key, JSON.stringify(value));
            sync.setLocalSaveFailure("workflows", false);
          } catch {
            if (local) sync.setLocalSaveFailure("workflows", true);
          }
        },
        removeItem: (name) => {
          try {
            localStorage.removeItem(workspaceCacheKey(name, workspaceOwner(useSyncStore.getState().authUser)));
          } catch {}
        },
      },
    }
  )
);

// Khi chuyển từ "ghi lên server" sang "lưu cục bộ" (server từ chối, mất mạng, khách…) phải ghi lại bản đầy đủ xuống
// localStorage — nếu không chỉ còn bản lưu nhẹ (danh sách rỗng) và dữ liệu mất khi tải lại trang.
useSyncStore.subscribe((state, previous) => {
  if (state.workspaceEpoch !== previous.workspaceEpoch) {
    switchingOwner = true;
    try {
      useWorkflowStore.setState(useWorkflowStore.getInitialState());
      void useWorkflowStore.persist.rehydrate();
    } finally {
      switchingOwner = false;
    }
  } else if (shouldWriteWorkspaceCache(state, previous)) {
    useWorkflowStore.setState({});
  }
});
