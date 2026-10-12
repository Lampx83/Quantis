import React, { useMemo } from "react";
import {
  Edit2,
  Trash2,
  GripVertical,
  MoreVertical,
  Upload,
  Shuffle,
  BarChart3,
  TestTube,
  TrendingUp,
  LineChart as LineChartIcon,
  FileText,
} from "lucide-react";
import { useWorkflowStore, useDataStore, useUIStore } from "@/stores";
import type { WorkflowStep } from "@/types";
import { generateId } from "@/utils/helpers";
import { t, tAllLocales } from "@/i18n";

export const STEP_TYPE_LABELS: Record<WorkflowStep["type"], string> = {
  import: t("app.stepType.import"),
  clean: t("app.stepType.clean"),
  transform: t("app.stepType.transform"),
  describe: t("app.stepType.describe"),
  test: t("app.stepType.test"),
  model: t("app.stepType.model"),
  visualize: t("app.stepType.visualize"),
  report: t("app.stepType.report"),
};

export const STEP_TYPE_ICONS: Record<WorkflowStep["type"], React.ReactNode> = {
  import: <Upload className="w-3.5 h-3.5" />,
  clean: <Shuffle className="w-3.5 h-3.5" />,
  transform: <BarChart3 className="w-3.5 h-3.5" />,
  describe: <BarChart3 className="w-3.5 h-3.5" />,
  test: <TestTube className="w-3.5 h-3.5" />,
  model: <TrendingUp className="w-3.5 h-3.5" />,
  visualize: <LineChartIcon className="w-3.5 h-3.5" />,
  report: <FileText className="w-3.5 h-3.5" />,
};

export const DEFAULT_WORKFLOW_STEPS: { type: WorkflowStep["type"]; label: string }[] = [
  { type: "import", label: t("app.stepType.import") },
  { type: "clean", label: t("app.stepType.clean") },
  { type: "transform", label: t("app.stepType.transform") },
  { type: "describe", label: t("app.stepType.describe") },
  { type: "test", label: t("app.stepType.test") },
  { type: "model", label: t("app.stepType.model") },
  { type: "visualize", label: t("app.stepType.visualize") },
  { type: "report", label: t("app.stepType.report") },
];

export function WorkflowDetailView() {
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

  const { datasets } = useDataStore();
  const { setConfirmDialog } = useUIStore();

  const selectedWorkflow = selectedWorkflowId
    ? workflows.find((w) => w.id === selectedWorkflowId)
    : null;

  const workflowDatasets = selectedWorkflow
    ? datasets.filter((d) => (selectedWorkflow.datasetIds ?? []).includes(d.id))
    : [];

  const REDUNDANT_STEP_LABELS = useMemo(() => {
    const keys = ["import", "clean", "transform", "describe", "test", "model", "visualize", "report"];
    const set = new Set<string>();
    for (const k of keys) {
      for (const v of tAllLocales(`app.stepType.${k}`)) set.add(v.trim().toLowerCase());
      for (const v of tAllLocales(`sampleData.stepLabel.${k}`)) set.add(v.trim().toLowerCase());
      for (const v of tAllLocales(`sampleData.demoTemplates.stepLabel.${k}`)) set.add(v.trim().toLowerCase());
    }
    return set;
  }, []);

  const isRedundantStepLabel = (label?: string) =>
    !label || REDUNDANT_STEP_LABELS.has(label.trim().toLowerCase());

  if (!selectedWorkflow) return null;

  return (
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
                          setWorkflows((prev) =>
                            prev.map((w) =>
                              w.id !== selectedWorkflow.id
                                ? w
                                : {
                                    ...w,
                                    name: editingWorkflowName.trim(),
                                    description: editingWorkflowDescription.trim() || undefined,
                                    updatedAt: new Date().toISOString(),
                                  }
                            )
                          );
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
                      onClick={() => {
                        setEditingWorkflowNameId(null);
                        setEditingWorkflowDescriptionId(null);
                      }}
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
                    setWorkflows((prev) =>
                      prev.map((w) =>
                        w.id !== selectedWorkflow.id
                          ? w
                          : {
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
                            }
                      )
                    );
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
                      setWorkflows((prev) =>
                        prev.map((w) =>
                          w.id !== selectedWorkflow.id
                            ? w
                            : { ...w, steps: reordered, updatedAt: new Date().toISOString() }
                        )
                      );
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
                        className={`rounded-lg border p-3 text-sm transition-colors ${
                          draggingStepId === s.id
                            ? "opacity-50 bg-neutral-100 dark:bg-neutral-800"
                            : "bg-neutral-50 dark:bg-neutral-800/50 border-neutral-200 dark:border-neutral-600"
                        } ${dropTargetIndex === i && draggingStepId !== s.id ? "ring-2 ring-brand/50 border-brand" : ""}`}
                      >
                        {editingStepId === s.id ? (
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <select
                                value={editingStepType}
                                onChange={(e) => setEditingStepType(e.target.value as WorkflowStep["type"])}
                                className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm"
                              >
                                {(Object.keys(STEP_TYPE_LABELS) as WorkflowStep["type"][]).map((typeKey) => (
                                  <option key={typeKey} value={typeKey}>
                                    {STEP_TYPE_LABELS[typeKey]}
                                  </option>
                                ))}
                              </select>
                              <input
                                type="text"
                                value={editingStepLabel}
                                onChange={(e) => setEditingStepLabel(e.target.value)}
                                placeholder={t("app.stepLabelPlaceholder")}
                                className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm flex-1 min-w-[140px]"
                              />
                            </div>
                            <textarea
                              value={editingStepNote}
                              onChange={(e) => setEditingStepNote(e.target.value)}
                              placeholder={t("app.noteOptionalPlaceholder")}
                              rows={2}
                              className="w-full rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm resize-none"
                            />
                            <div className="flex items-center gap-2">
                              <button
                                type="button"
                                onClick={() => {
                                  const next = selectedWorkflow.steps.map((st) =>
                                    st.id === s.id
                                      ? {
                                          ...st,
                                          type: editingStepType,
                                          label: editingStepLabel.trim() || st.label,
                                          note: editingStepNote.trim() || undefined,
                                          updatedAt: new Date().toISOString(),
                                        }
                                      : st
                                  );
                                  setWorkflows((prev) =>
                                    prev.map((w) =>
                                      w.id !== selectedWorkflow.id
                                        ? w
                                        : { ...w, steps: next, updatedAt: new Date().toISOString() }
                                    )
                                  );
                                  setEditingStepId(null);
                                }}
                                className="rounded-lg bg-brand text-white px-3 py-1.5 text-sm font-medium hover:opacity-90"
                              >
                                {t("app.save")}
                              </button>
                              <button
                                type="button"
                                onClick={() => {
                                  setEditingStepId(null);
                                }}
                                className="rounded-lg border border-neutral-300 dark:border-neutral-600 px-3 py-1.5 text-sm font-medium text-neutral-700 dark:text-neutral-300"
                              >
                                {t("app.cancel")}
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-start justify-between gap-2">
                            <div className="min-w-0 flex-1 flex items-center gap-2">
                              {editingStepId !== s.id && (
                                <span
                                  className="cursor-grab active:cursor-grabbing text-neutral-400 dark:text-neutral-500 shrink-0"
                                  aria-label={t("app.dragToReorder")}
                                >
                                  <GripVertical className="w-4 h-4" />
                                </span>
                              )}
                              <div className="min-w-0 flex-1">
                                <div className="flex items-center gap-2 flex-wrap">
                                  <span className="flex items-center justify-center w-6 h-6 rounded-full bg-neutral-200 dark:bg-neutral-600 text-neutral-700 dark:text-neutral-200 font-medium text-xs shrink-0">
                                    {i + 1}
                                  </span>
                                  <span
                                    className={
                                      isRedundantStepLabel(s.label)
                                        ? "text-neutral-800 dark:text-neutral-200 font-medium"
                                        : "text-neutral-600 dark:text-neutral-400 text-xs"
                                    }
                                  >
                                    {STEP_TYPE_LABELS[s.type]}
                                  </span>
                                  {!isRedundantStepLabel(s.label) && (
                                    <span className="text-neutral-800 dark:text-neutral-200 font-medium">{s.label}</span>
                                  )}
                                </div>
                                {s.note && (
                                  <p className="mt-1.5 ml-8 text-xs text-neutral-500 dark:text-neutral-400 italic">
                                    {s.note}
                                  </p>
                                )}
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
                                    <div
                                      className="fixed inset-0 z-10"
                                      onClick={() => setStepMenuOpenId(null)}
                                      aria-hidden
                                    />
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
                                              setWorkflows((prev) =>
                                                prev.map((w) =>
                                                  w.id !== selectedWorkflow.id
                                                    ? w
                                                    : {
                                                        ...w,
                                                        steps: w.steps
                                                          .filter((st) => st.id !== s.id)
                                                          .map((st, idx) => ({ ...st, order: idx })),
                                                        updatedAt: new Date().toISOString(),
                                                      }
                                                )
                                              );
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
                  <select
                    value={newWorkflowStepType}
                    onChange={(e) => setNewWorkflowStepType(e.target.value as WorkflowStep["type"])}
                    className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm"
                  >
                    {(Object.keys(STEP_TYPE_LABELS) as WorkflowStep["type"][]).map((typeKey) => (
                      <option key={typeKey} value={typeKey}>
                        {STEP_TYPE_LABELS[typeKey]}
                      </option>
                    ))}
                  </select>
                  <input
                    type="text"
                    value={newWorkflowStepLabel}
                    onChange={(e) => setNewWorkflowStepLabel(e.target.value)}
                    placeholder={t("app.stepLabelOptionalPlaceholder")}
                    className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-700 px-2 py-1.5 text-sm w-44"
                  />
                  <button
                    type="button"
                    onClick={() => {
                      const now = new Date().toISOString();
                      const label = newWorkflowStepLabel.trim() || STEP_TYPE_LABELS[newWorkflowStepType];
                      const newStep: WorkflowStep = {
                        id: generateId(),
                        type: newWorkflowStepType,
                        label,
                        config: {},
                        order: selectedWorkflow.steps.length,
                        createdAt: now,
                      };
                      setWorkflows((prev) =>
                        prev.map((w) =>
                          w.id !== selectedWorkflow.id
                            ? w
                            : { ...w, steps: [...w.steps, newStep], updatedAt: now }
                        )
                      );
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
              <h3 className="text-sm font-semibold text-neutral-700 dark:text-neutral-300 mb-2">
                {t("app.attachedDatasetsHeading")}
              </h3>
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
  );
}
