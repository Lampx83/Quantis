import React from "react";
import { AppToolbar } from "./AppToolbar";
import { WorkflowDetailView } from "@/features/reproducibility";
import { DataView } from "@/features/data";
import { AnalysisView } from "@/features/analysis";
import { PresentationView } from "@/features/presentation";
import { ReproducibilityView } from "@/features/reproducibility";
import { AIAssistView } from "@/features/ai";
import {
  useUIStore,
  useDataStore,
  useWorkflowStore,
  useAnalysisStore,
  useSyncStore,
} from "@/stores";
import { t } from "@/i18n";

export function MainContent() {
  const {
    mainSection,
    dataTab,
    analysisTab,
    reproTab,
    setReproTab,
    presentationTab,
    setPresentationTab,
    presentationChartType,
    setPresentationChartType,
    isMobileLayout,
    showToast,
  } = useUIStore();

  const { datasets, setDatasets, selectedDatasetId, setSelectedDatasetId } = useDataStore();

  const {
    workflows,
    setWorkflows,
    selectedWorkflowId,
    setSelectedWorkflowId,
    selectedWorkflowStepId,
  } = useWorkflowStore();

  const {
    correlationMethod,
    setCorrelationMethod,
    correlationBackendResult,
    correlationLoading,
    lastHypothesisResult,
    setLastHypothesisResult,
    descriptiveBackendResult,
  } = useAnalysisStore();

  const { analysisBackendAvailable } = useSyncStore();

  const selectedDataset = datasets.find((d) => d.id === selectedDatasetId);
  const selectedWorkflow = selectedWorkflowId ? workflows.find((w) => w.id === selectedWorkflowId) : null;
  const selectedStep =
    selectedWorkflow && selectedWorkflowStepId
      ? selectedWorkflow.steps.find((s) => s.id === selectedWorkflowStepId)
      : null;

  return (
    <div className="flex-1 min-h-0 min-w-0 flex flex-col w-full">
      <AppToolbar />

      <main className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-6 min-h-0 w-full max-w-full">
        {!selectedWorkflowId && (
          <div className="w-full max-w-full py-12">
            <h2 className="text-xl font-semibold text-neutral-800 dark:text-neutral-200 mb-2">
              {t("app.researchWorkflowHeading")}
            </h2>
            <p className="text-neutral-600 dark:text-neutral-400 mb-4">
              {t("app.emptyWorkflowIntroPart1")}
              <strong>{t("app.createNew")}</strong>
              {t("app.emptyWorkflowIntroPart2")}
            </p>
          </div>
        )}

        {selectedWorkflowId && selectedWorkflow && !selectedStep && <WorkflowDetailView />}

        {mainSection === "data" && (!selectedWorkflowId || selectedStep) && (
          <DataView
            tab={dataTab}
            datasets={datasets}
            setDatasets={setDatasets}
            selectedDatasetId={selectedDatasetId}
            onSelectDataset={setSelectedDatasetId}
            showToast={showToast}
            onWorkflowDatasetAdd={
              selectedWorkflowId
                ? (id) => {
                    setWorkflows((prev) =>
                      prev.map((w) =>
                        w.id !== selectedWorkflowId
                          ? w
                          : {
                              ...w,
                              datasetIds: [...(w.datasetIds ?? []), id].filter((x, i, a) => a.indexOf(x) === i),
                              updatedAt: new Date().toISOString(),
                            }
                      )
                    );
                  }
                : undefined
            }
            analysisBackendAvailable={analysisBackendAvailable}
            descriptiveBackendResult={descriptiveBackendResult}
          />
        )}

        {mainSection === "analysis" && (!selectedWorkflowId || selectedStep) && (
          <AnalysisView
            tab={analysisTab}
            selectedDataset={selectedDataset}
            onHypothesisResult={setLastHypothesisResult}
            correlationMethod={correlationMethod}
            setCorrelationMethod={setCorrelationMethod}
            analysisBackendAvailable={analysisBackendAvailable}
            descriptiveBackendResult={descriptiveBackendResult}
            correlationBackendResult={correlationBackendResult}
            correlationLoading={correlationLoading}
            showToast={showToast}
          />
        )}

        {mainSection === "presentation" && (!selectedWorkflowId || selectedStep) && (
          <PresentationView
            tab={presentationTab}
            onTabChange={setPresentationTab}
            selectedDataset={selectedDataset}
            lastHypothesisResult={lastHypothesisResult}
            analysisBackendAvailable={analysisBackendAvailable}
            chartType={presentationChartType}
            setChartType={setPresentationChartType}
            showToast={showToast}
          />
        )}

        {mainSection === "reproducibility" && (
          <ReproducibilityView
            tab={reproTab}
            onTabChange={setReproTab}
            workflows={workflows}
            setWorkflows={setWorkflows}
            selectedWorkflowId={selectedWorkflowId}
            onSelectWorkflow={setSelectedWorkflowId}
            showToast={showToast}
          />
        )}

        {mainSection === "ai" && (
          <div className="w-full max-w-full min-h-0 flex justify-center">
            <AIAssistView selectedDataset={selectedDataset} compact={isMobileLayout} />
          </div>
        )}
      </main>
    </div>
  );
}
