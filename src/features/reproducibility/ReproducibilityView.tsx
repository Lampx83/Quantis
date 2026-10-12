import { useState, type Dispatch, type SetStateAction } from "react";
import { GitBranch, X } from "lucide-react";
import type { Workflow, WorkflowStep } from "@/types";
import type { ReproducibilityTab } from "@/stores";
import { generateId } from "@/utils/helpers";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";
import { OpenScienceProtocolPanel } from "@/OpenScienceProtocolPanel";

export interface ReproducibilityViewProps {
  tab: ReproducibilityTab;
  onTabChange: (t: ReproducibilityTab) => void;
  workflows: Workflow[];
  setWorkflows: Dispatch<SetStateAction<Workflow[]>>;
  selectedWorkflowId: string | null;
  onSelectWorkflow: (id: string | null) => void;
  showToast: (msg: string) => void;
}

export function ReproducibilityView({
  tab,
  onTabChange,
  workflows,
  setWorkflows,
  selectedWorkflowId,
  onSelectWorkflow,
  showToast,
}: ReproducibilityViewProps) {
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
