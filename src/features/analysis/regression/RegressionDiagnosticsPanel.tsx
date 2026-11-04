import { useState } from "react";
import { Copy } from "lucide-react";
import type { RegressionRun } from "@/stores/useAnalysisStore";
import type {
  AssumptionRow,
  Dataset,
  DiagnosticsPayload,
  DiagnosticsPayloadOk,
  RegressionVerdict,
} from "@/types";
import { t } from "@/i18n";
import { InfoHint, type GlossaryTerm } from "@/components/common/InfoHint";
import { useUIStore } from "@/stores/useUIStore";
import { DiagnosticsPlots } from "./DiagnosticsPlots";

type Translate = (key: string, params?: Record<string, string | number>) => string;

/**
 * Thresholds mirrored from backend-python/regression_diagnostics.py (spec R3.2).
 * The Verdict is decided server-side; these numbers only format its sentence (R3.6).
 */
export const DIAGNOSTIC_THRESHOLDS = {
  pass: 0.05,
  caution: 5,
  violation: 10,
  violationP: 0.001,
  skew: 1,
  kurtosis: 2,
  relative: 4,
  studentized: 3,
  absolute: 1,
} as const;

const VERDICT_CLASS: Record<RegressionVerdict, string> = {
  pass: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
  caution: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
  violation: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800",
};

const NOT_APPLICABLE_CLASS =
  "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700";

const ROW_ORDER = ["linearity", "normality", "influence", "collinearity"] as const;

function formatNumber(value: number | null | undefined, translate: Translate): string {
  if (value == null || !Number.isFinite(value)) return translate("regDiag.stat.unavailable");
  return value.toFixed(4);
}

function formatP(value: number | null | undefined, translate: Translate): string {
  if (value == null || !Number.isFinite(value)) return translate("regDiag.stat.unavailable");
  return value < 0.001 ? "< .001" : value.toFixed(4);
}

function statLines(
  row: Extract<AssumptionRow, { applicable: true }>,
  translate: Translate
): string[] {
  switch (row.id) {
    case "linearity":
      return [
        translate("regDiag.stat.bp", {
          df: row.stats.bp.df,
          value: formatNumber(row.stats.bp.chi2, translate),
          p: formatP(row.stats.bp.p, translate),
        }),
        translate("regDiag.stat.reset", {
          df1: row.stats.reset.df1,
          df2: row.stats.reset.df2,
          value: formatNumber(row.stats.reset.f, translate),
          p: formatP(row.stats.reset.p, translate),
        }),
      ];
    case "normality":
      return [
        translate(
          row.stats.test === "shapiro" ? "regDiag.stat.shapiro" : "regDiag.stat.jarqueBera",
          {
            value: formatNumber(row.stats.stat, translate),
            p: formatP(row.stats.p, translate),
          }
        ),
        translate("regDiag.stat.skewness", {
          value: formatNumber(row.stats.skewness, translate),
          kurtosis: formatNumber(row.stats.excessKurtosis, translate),
        }),
      ];
    case "influence":
      return [
        translate("regDiag.stat.influence", {
          maxCookD: formatNumber(row.stats.maxCookD, translate),
          nAbove4n: row.stats.nAbove4n,
          maxLeverage: formatNumber(row.stats.maxLeverage, translate),
          leverageCut: formatNumber(row.stats.leverageCut, translate),
          maxStudentized: formatNumber(row.stats.maxStudentized, translate),
        }),
      ];
    case "collinearity":
      return [
        translate("regDiag.stat.collinearity", {
          maxVif: formatNumber(row.stats.maxVif, translate),
        }),
      ];
  }
}

function thresholdText(id: string, translate: Translate): string {
  switch (id) {
    case "linearity":
      return translate("regDiag.threshold.linearity", {
        pass: DIAGNOSTIC_THRESHOLDS.pass,
      });
    case "normality":
      return translate("regDiag.threshold.normality", {
        pass: DIAGNOSTIC_THRESHOLDS.pass,
        violationP: DIAGNOSTIC_THRESHOLDS.violationP,
        skew: DIAGNOSTIC_THRESHOLDS.skew,
        kurtosis: DIAGNOSTIC_THRESHOLDS.kurtosis,
      });
    case "influence":
      return translate("regDiag.threshold.influence", {
        relative: DIAGNOSTIC_THRESHOLDS.relative,
        studentized: DIAGNOSTIC_THRESHOLDS.studentized,
        absolute: DIAGNOSTIC_THRESHOLDS.absolute,
      });
    default:
      return translate("regDiag.threshold.collinearity", {
        caution: DIAGNOSTIC_THRESHOLDS.caution,
        violation: DIAGNOSTIC_THRESHOLDS.violation,
      });
  }
}

function verdictLabel(row: AssumptionRow, translate: Translate): string {
  return row.applicable
    ? translate(`regDiag.verdict.${row.verdict}`)
    : translate("regDiag.notApplicable");
}

function vifOffenders(vif: Record<string, { vif: number | null }>, translate: Translate): string {
  return Object.entries(vif)
    .sort((a, b) => (b[1].vif ?? Infinity) - (a[1].vif ?? Infinity))
    .map(([name, entry]) =>
      translate("regDiag.vifEntry", {
        name,
        vif: entry.vif == null ? translate("regDiag.stat.unavailable") : entry.vif.toFixed(2),
      })
    )
    .join(", ");
}

function sampleAccounting(run: RegressionRun, submittedRows: number) {
  const result = run.result;
  const nInput = typeof result.nInput === "number" ? result.nInput : submittedRows;
  const nUsed = result.n;
  return {
    nInput,
    nUsed,
    nDropped:
      typeof result.nDropped === "number" ? result.nDropped : Math.max(0, nInput - nUsed),
    method: result.missingMethod ?? "listwise",
  };
}

/**
 * The Assumption Check as a tab-separated table (R2.8): header plus four rows,
 * one trailing newline, pasting into Excel/Word as columns.
 */
export function buildDiagnosticsTsv(
  diagnostics: DiagnosticsPayload,
  translate: Translate
): string {
  const header = ["assumption", "statistic", "threshold", "verdict"]
    .map((key) => translate(`regDiag.copy.${key}`))
    .join("\t");
  if (!diagnostics.ok) return `${header}\n`;

  const rows = diagnostics.assumptions.map((row) =>
    [
      translate(`regDiag.row.${row.id}`),
      row.applicable ? statLines(row, translate).join("; ") : "",
      row.applicable ? thresholdText(row.id, translate) : "",
      verdictLabel(row, translate),
    ].join("\t")
  );
  return [header, ...rows].join("\n") + "\n";
}

export interface RegressionDiagnosticsPanelProps {
  run: RegressionRun;
  selectedDatasetId: string;
  /** Rows submitted to the fit, header excluded — the fallback when the payload has no nInput. */
  submittedRows: number;
  /** Variable metadata for the plot axis titles (R5.2). */
  variables?: Dataset["variables"];
  /** R9.2: the dataset changed since the fit; numbers stay, navigation is disabled. */
  stale?: boolean;
  /** Test seam for the collapsed state; a run starts expanded (R2.6). */
  initialExpanded?: boolean;
}

/**
 * Ask the grid to show one Analysis row (R6.2): switch to the data view first,
 * then post the request the grid consumes. Nothing here mutates the model (R6.4).
 */
export function requestDiagnosticsRowFocus(datasetId: string, rowIndex: number): void {
  useUIStore.getState().setMainSection("data");
  useUIStore.getState().setDataEditorView("data");
  useUIStore.getState().requestRowFocus(datasetId, rowIndex);
}

export function RegressionDiagnosticsPanel({
  run,
  selectedDatasetId,
  submittedRows,
  variables,
  stale = false,
  initialExpanded = true,
}: RegressionDiagnosticsPanelProps) {
  const [expanded, setExpanded] = useState(initialExpanded);
  if (run.datasetId !== selectedDatasetId) return null;

  const jumpToRow = (rowIndex: number) => {
    if (stale) return;
    requestDiagnosticsRowFocus(run.datasetId, rowIndex);
  };

  const diagnostics = run.result.diagnostics;
  const ok: DiagnosticsPayloadOk | null = diagnostics?.ok ? diagnostics : null;
  const accounting = sampleAccounting(run, submittedRows);

  const sampleLine = t("regDiag.sampleLine", {
    used: accounting.nUsed,
    submitted: accounting.nInput,
    dropped: accounting.nDropped,
    method: t(
      accounting.method === "mice-active"
        ? "regDiag.method.miceActive"
        : "regDiag.method.listwise"
    ),
  });

  const judgedDiffers = Boolean(
    ok &&
      (ok.sample.nInput !== accounting.nInput || ok.sample.nUsed !== accounting.nUsed)
  );

  let miceLine: string | null = null;
  if (ok && accounting.method === "mice-active") {
    if (ok.sample.activeImputation === 0) {
      miceLine = t("regDiag.miceOriginalLine");
    } else if (ok.sample.activeImputation != null && ok.sample.m != null) {
      miceLine = t("regDiag.miceLine", {
        index: ok.sample.activeImputation,
        m: ok.sample.m,
      });
    }
  }

  return (
    <details
      data-testid="regdiag-section"
      open={expanded}
      onToggle={(event) => setExpanded(event.currentTarget.open)}
      className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 mt-3"
    >
      <summary
        data-testid="regdiag-summary"
        className="flex flex-wrap items-center gap-x-3 gap-y-1 p-3 cursor-pointer select-none"
      >
        <span className="font-semibold text-neutral-800 dark:text-neutral-200">
          {t("regDiag.title")}
          <InfoHint term="assumptionCheck" />
        </span>
        <span
          data-testid="regdiag-sample"
          className="text-xs text-neutral-600 dark:text-neutral-400"
        >
          {sampleLine}
        </span>
        {ok && (
          <span data-testid="regdiag-chips" className="flex flex-wrap gap-1.5">
            {ROW_ORDER.map((id) => {
              const row = ok.assumptions.find((entry) => entry.id === id);
              if (!row) return null;
              return (
                <span
                  key={id}
                  className={`text-[11px] px-2 py-0.5 rounded border ${
                    row.applicable ? VERDICT_CLASS[row.verdict] : NOT_APPLICABLE_CLASS
                  }`}
                >
                  {t(`regDiag.row.${id}`)}: {verdictLabel(row, t)}
                </span>
              );
            })}
          </span>
        )}
      </summary>

      {expanded && (
        <div className="border-t border-neutral-100 dark:border-neutral-700 p-3 space-y-2 text-sm">
          <p data-testid="regdiag-model" className="text-xs text-neutral-600 dark:text-neutral-400">
            {t("regDiag.modelLine", { y: run.yCol, x: run.xCols.join(", ") })}
          </p>

          {stale && (
            <p
              data-testid="regdiag-stale"
              className="rounded border border-amber-200 dark:border-amber-800 bg-amber-50 dark:bg-amber-900/20 px-2.5 py-1.5 text-xs text-amber-800 dark:text-amber-200"
            >
              {t("regDiag.stale")}
            </p>
          )}

          {judgedDiffers && ok && (
            <>
              <p
                data-testid="regdiag-judged-sample"
                className="text-xs text-neutral-700 dark:text-neutral-300"
              >
                {t("regDiag.judgedSampleLine", {
                  used: ok.sample.nUsed,
                  submitted: ok.sample.nInput,
                  dropped: ok.sample.nDropped,
                })}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t("regDiag.judgedSampleDiffers")}
              </p>
            </>
          )}

          {miceLine && (
            <p data-testid="regdiag-mice" className="text-xs text-neutral-600 dark:text-neutral-400">
              {miceLine}
            </p>
          )}

          {!diagnostics && (
            <p data-testid="regdiag-needs-backend" className="text-neutral-600 dark:text-neutral-400">
              {t("regDiag.needsBackend")}
            </p>
          )}

          {diagnostics && !diagnostics.ok && (
            <div data-testid={`regdiag-error-${diagnostics.errorCode}`} className="space-y-1">
              <p className="text-neutral-800 dark:text-neutral-200">
                {t(`regDiag.error.${diagnostics.errorCode}`)}
              </p>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t("regDiag.failureConsequence")}
              </p>
              {diagnostics.errorDetail && (
                <p className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
                  {diagnostics.errorDetail}
                </p>
              )}
            </div>
          )}

          {ok && (
            <>
              <div className="flex items-center justify-end">
                <button
                  type="button"
                  data-testid="regdiag-copy"
                  onClick={() => {
                    void navigator.clipboard?.writeText(buildDiagnosticsTsv(ok, t));
                  }}
                  className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs flex items-center gap-1 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                >
                  <Copy className="w-3.5 h-3.5" /> {t("regDiag.copy")}
                </button>
              </div>

              <div className="overflow-x-auto">
                <table data-testid="regdiag-table" className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-700">
                      <th className="text-left p-2">{t("regDiag.table.assumption")}</th>
                      <th className="text-left p-2">{t("regDiag.table.statistic")}</th>
                      <th className="text-left p-2">{t("regDiag.table.threshold")}</th>
                      <th className="text-left p-2">{t("regDiag.table.verdict")}</th>
                      <th className="text-left p-2">{t("regDiag.table.action")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {ROW_ORDER.map((id) => {
                      const row = ok.assumptions.find((entry) => entry.id === id);
                      return row ? (
                        <AssumptionTableRow
                          key={id}
                          row={row}
                          diagnostics={ok}
                          stale={stale}
                          onJumpToRow={jumpToRow}
                        />
                      ) : null;
                    })}
                  </tbody>
                </table>
              </div>

              <DiagnosticsPlots
                diagnostics={ok}
                yCol={run.yCol}
                xCols={run.xCols}
                variables={variables}
              />
            </>
          )}
        </div>
      )}
    </details>
  );
}

function AssumptionTableRow({
  row,
  diagnostics,
  stale,
  onJumpToRow,
}: {
  row: AssumptionRow;
  diagnostics: DiagnosticsPayloadOk;
  stale: boolean;
  onJumpToRow?: (rowIndex: number) => void;
}) {
  const nameHint: GlossaryTerm =
    row.id === "linearity"
      ? "bpTest"
      : row.id === "normality"
      ? "qqPlot"
      : row.id === "influence"
      ? "cooksDistance"
      : "vif";

  return (
    <tr data-testid={`regdiag-row-${row.id}`} className="border-b border-neutral-100 dark:border-neutral-700/50 align-top">
      <td className="p-2">
        <div className="font-medium">
          {t(`regDiag.row.${row.id}`)}
          <InfoHint term={nameHint} />
        </div>
        <p className="text-xs text-neutral-500 dark:text-neutral-400">
          {row.applicable
            ? t(`regDiag.explain.${row.id}.${row.verdict}`)
            : t(`regDiag.reason.${row.notApplicableReason}`)}
        </p>
      </td>

      {row.applicable ? (
        <td data-testid={`regdiag-stat-${row.id}`} className="p-2 text-xs">
          {row.id === "linearity" ? (
            <ul className="space-y-0.5">
              <li>{statLines(row, t)[0]}</li>
              <li>
                {statLines(row, t)[1]}
                <InfoHint term="resetTest" />
              </li>
            </ul>
          ) : row.id === "influence" ? (
            <ul className="space-y-0.5">
              <li>
                {statLines(row, t)[0]}
                <InfoHint term="leverage" />
                <InfoHint term="studentizedResidual" />
              </li>
            </ul>
          ) : (
            statLines(row, t).map((line) => <div key={line}>{line}</div>)
          )}
        </td>
      ) : (
        <td className="p-2" />
      )}

      <td className="p-2 text-xs">
        {row.applicable ? thresholdText(row.id, t) : null}
      </td>

      <td className="p-2">
        <span
          data-testid={`regdiag-verdict-${row.id}`}
          className={`inline-block text-xs px-2 py-0.5 rounded border ${
            row.applicable ? VERDICT_CLASS[row.verdict] : NOT_APPLICABLE_CLASS
          }`}
        >
          {verdictLabel(row, t)}
        </span>
      </td>

      <td className="p-2 text-xs">
        {row.applicable && (
          <div data-testid={`regdiag-action-${row.id}`}>
            {row.id === "influence" ? (
              <InfluenceAction
                diagnostics={diagnostics}
                stale={stale}
                onJumpToRow={onJumpToRow}
              />
            ) : row.id === "collinearity" ? (
              t("regDiag.action.collinearity", {
                list: vifOffenders(diagnostics.vif, t),
              })
            ) : (
              t(`regDiag.action.${row.id}`)
            )}
          </div>
        )}
      </td>
    </tr>
  );
}

export function InfluenceAction({
  diagnostics,
  stale,
  onJumpToRow,
}: {
  diagnostics: DiagnosticsPayloadOk;
  stale: boolean;
  onJumpToRow?: (rowIndex: number) => void;
}) {
  const top = diagnostics.influential[0];
  if (!top) {
    return <span className="text-neutral-500 dark:text-neutral-400">{t("regDiag.action.influenceNone")}</span>;
  }

  const rest = diagnostics.influential.slice(1, 3);
  return (
    <div className="space-y-1">
      <button
        type="button"
        data-testid="regdiag-jump-influence"
        disabled={stale || !onJumpToRow}
        title={stale ? t("regDiag.staleJump") : undefined}
        onClick={() => onJumpToRow?.(top.rowIndex)}
        className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-1 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700 disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {t("regDiag.action.influence")}
      </button>
      <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
        {t("regDiag.influential.row", {
          row: top.rowIndex + 1,
          cookD: formatNumber(top.cookD, t),
          studentized: formatNumber(top.studentized, t),
        })}
      </p>
      {rest.map((entry) => (
        <p key={entry.rowIndex} className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {t("regDiag.influential.row", {
            row: entry.rowIndex + 1,
            cookD: formatNumber(entry.cookD, t),
            studentized: formatNumber(entry.studentized, t),
          })}
        </p>
      ))}
      {diagnostics.influential.length > 3 && (
        <p className="text-[11px] text-neutral-500 dark:text-neutral-400">
          {t("regDiag.influential.more", { count: diagnostics.influential.length - 3 })}
        </p>
      )}
    </div>
  );
}
