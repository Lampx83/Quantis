import type React from "react";
import {
  Upload,
  ScanSearch,
  Shuffle,
  CheckCircle2,
  TestTube,
  TrendingUp,
  LineChart as LineChartIcon,
  FileText,
  GitBranch,
} from "lucide-react";
import type { Dataset } from "@/types";
import { t } from "@/i18n";

export interface WorkflowStepItem {
  id: string;
  label: string;
  icon: React.ComponentType<{ className?: string }>;
}

export const WORKFLOW_STEPS: WorkflowStepItem[] = [
  { id: "import", label: t("app.stepType.import"), icon: Upload },
  { id: "profiling", label: t("app.stepType.profiling"), icon: ScanSearch },
  { id: "clean", label: t("app.stepType.clean"), icon: Shuffle },
  { id: "reliability", label: "Reliability & validity", icon: CheckCircle2 },
  { id: "hypothesis", label: t("app.stepType.test"), icon: TestTube },
  { id: "model", label: t("app.stepType.model"), icon: TrendingUp },
  { id: "visualize", label: t("app.stepType.visualize"), icon: LineChartIcon },
  { id: "report", label: t("app.stepType.report"), icon: FileText },
  { id: "save", label: t("app.stepType.save"), icon: GitBranch },
];

export interface WorkflowViewProps {
  steps: WorkflowStepItem[];
  datasets?: Dataset[];
  selectedDatasetId?: string | null;
  onSelectDataset?: (id: string | null) => void;
  onStepClick?: (stepId: string) => void;
}

export function WorkflowView({
  steps,
  datasets: _datasets,
  selectedDatasetId: _selectedDatasetId,
  onSelectDataset: _onSelectDataset,
  onStepClick,
}: WorkflowViewProps) {
  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">{t("workflowView.title")}</h2>
      <p className="text-sm text-neutral-500 dark:text-neutral-400 mb-4">{t("workflowView.subtitle")}</p>
      <div className="space-y-2">
        {steps.map((step, i) => {
          const StepIcon = step.icon;
          return (
            <button
              key={step.id}
              type="button"
              onClick={() => onStepClick?.(step.id)}
              className="w-full flex items-center gap-3 p-3 rounded-lg bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-700/50 hover:border-brand/30 transition-colors text-left"
            >
              <span className="w-8 h-8 rounded-full bg-brand/10 dark:bg-brand/20 flex items-center justify-center text-brand font-medium">{i + 1}</span>
              <StepIcon className="w-5 h-5 text-neutral-500 flex-shrink-0" />
              <span className="font-medium">{step.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
