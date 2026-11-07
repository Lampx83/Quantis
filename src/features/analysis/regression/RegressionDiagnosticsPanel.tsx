import { useState } from "react";
import { ChevronDown, Copy } from "lucide-react";
import type { RegressionRun } from "@/stores/useAnalysisStore";
import type {
  AssumptionRow,
  Dataset,
  DiagnosticsPayload,
  DiagnosticsPayloadOk,
  DiagnosticsThresholds,
  RegressionVerdict,
} from "@/types";
import { t } from "@/i18n";
import { InfoHint, type GlossaryTerm } from "@/components/common/InfoHint";
import { useUIStore } from "@/stores/useUIStore";
import { DiagnosticsPlots } from "./DiagnosticsPlots";

type Translate = (key: string, params?: Record<string, string | number>) => string;

const VERDICT_CLASS: Record<RegressionVerdict, string> = {
  pass: "text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-900/30 border-emerald-200 dark:border-emerald-800",
  caution: "text-amber-700 dark:text-amber-300 bg-amber-50 dark:bg-amber-900/30 border-amber-200 dark:border-amber-800",
  violation: "text-red-700 dark:text-red-300 bg-red-50 dark:bg-red-900/30 border-red-200 dark:border-red-800",
};

const NOT_APPLICABLE_CLASS =
  "text-neutral-500 dark:text-neutral-400 bg-neutral-100 dark:bg-neutral-800 border-neutral-200 dark:border-neutral-700";

const ROW_ORDER = ["linearity", "normality", "influence", "collinearity"] as const;

const BADGE_CLASS: Record<string, string> = {
  pass: "bg-emerald-50 dark:bg-emerald-900/30 text-emerald-700 dark:text-emerald-300",
  caution: "bg-amber-50 dark:bg-amber-900/30 text-amber-700 dark:text-amber-300",
  violation: "bg-red-50 dark:bg-red-900/30 text-red-700 dark:text-red-300",
  notApplicable: "bg-neutral-100 dark:bg-neutral-700/40 text-neutral-600 dark:text-neutral-400",
};

const VERDICT_RANK: Record<RegressionVerdict, number> = {
  pass: 0,
  caution: 1,
  violation: 2,
};

/**
 * Left-edge accent for the collapsed card. A collapsed section hides the statistics,
 * so the worst applicable verdict must stay visible from the summary line alone.
 * Pass gets no accent: it needs no action.
 */
const COLLAPSED_ACCENT: Record<RegressionVerdict, string> = {
  pass: "",
  caution: "border-l-4 border-l-amber-500 dark:border-l-amber-400",
  violation: "border-l-4 border-l-red-500 dark:border-l-red-400",
};

function worstApplicableVerdict(ok: DiagnosticsPayloadOk): RegressionVerdict | null {
  let worst: RegressionVerdict | null = null;
  for (const row of ok.assumptions) {
    if (!row.applicable) continue;
    if (!worst || VERDICT_RANK[row.verdict] > VERDICT_RANK[worst]) worst = row.verdict;
  }
  return worst;
}

function formatNumber(value: number | null | undefined, translate: Translate): string {
  if (value == null || !Number.isFinite(value)) return translate("regDiag.stat.unavailable");
  return value.toFixed(4);
}

function formatP(value: number | null | undefined, translate: Translate): string {
  if (value == null || !Number.isFinite(value)) return translate("regDiag.stat.unavailable");
  return value < 0.001 ? "< .001" : `= ${value.toFixed(4)}`;
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

function thresholdText(
  id: string,
  thresholds: DiagnosticsThresholds,
  translate: Translate
): string {
  switch (id) {
    case "linearity":
      return translate("regDiag.threshold.linearity", {
        pass: thresholds.linearityAlpha,
      });
    case "normality":
      return translate("regDiag.threshold.normality", {
        pass: thresholds.normalityAlpha,
        violationP: thresholds.normalityViolationAlpha,
        skew: thresholds.normalitySkewGuard,
        kurtosis: thresholds.normalityExcessKurtosisGuard,
      });
    case "influence":
      return translate("regDiag.threshold.influence", {
        relative: thresholds.cookRelativeMultiplier,
        studentized: thresholds.studentized,
        absolute: thresholds.cookAbsolute,
      });
    default:
      return translate("regDiag.threshold.collinearity", {
        caution: thresholds.vifCaution,
        violation: thresholds.vifViolation,
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

function sampleAccounting(run: RegressionRun) {
  const result = run.result;
  const nInput = result.nInput ?? run.datasetRowCount;
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
      row.applicable ? thresholdText(row.id, diagnostics.thresholds, translate) : "",
      verdictLabel(row, translate),
    ].join("\t")
  );
  return [header, ...rows].join("\n") + "\n";
}

export interface RegressionDiagnosticsPanelProps {
  run: RegressionRun;
  selectedDatasetId: string;
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
  // The grid is mounted by the Preview tab only; another tab would leave the request unconsumed.
  useUIStore.getState().setDataTab("preview");
  useUIStore.getState().setDataEditorView("data");
  useUIStore.getState().requestRowFocus(datasetId, rowIndex);
}

export function RegressionDiagnosticsPanel({
  run,
  selectedDatasetId,
  variables,
  stale = false,
  initialExpanded = true,
}: RegressionDiagnosticsPanelProps) {
  const { showToast } = useUIStore();
  const [expanded, setExpanded] = useState(initialExpanded);
  if (run.datasetId !== selectedDatasetId) return null;

  const jumpToRow = (rowIndex: number) => {
    if (stale) return;
    requestDiagnosticsRowFocus(run.datasetId, rowIndex);
  };

  const diagnostics = run.result.diagnostics;
  const ok: DiagnosticsPayloadOk | null = diagnostics?.ok ? diagnostics : null;
  const worst = ok ? worstApplicableVerdict(ok) : null;
  const collapsedAccent = !expanded && worst ? COLLAPSED_ACCENT[worst] : "";
  const counts = ok
    ? {
        pass: ok.assumptions.filter((row) => row.applicable && row.verdict === "pass").length,
        caution: ok.assumptions.filter((row) => row.applicable && row.verdict === "caution").length,
        violation: ok.assumptions.filter((row) => row.applicable && row.verdict === "violation").length,
        notApplicable: ok.assumptions.filter((row) => !row.applicable).length,
      }
    : null;
  // Every row stays represented: the inapplicable ones used to have their own chip, and a
  // summary that silently drops them reads as if the check never ran.
  const badges: { key: string; label: string; count: number }[] = counts
    ? (["pass", "caution", "violation"] as const).map((verdict) => ({
        key: verdict,
        label: t(`regDiag.verdict.${verdict}`),
        count: counts[verdict],
      }))
    : [];
  if (counts && counts.notApplicable > 0) {
    badges.push({
      key: "notApplicable",
      label: t("regDiag.notApplicable"),
      count: counts.notApplicable,
    });
  }
  const accounting = sampleAccounting(run);

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
      className={`group rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 mt-3 overflow-hidden ${collapsedAccent}`}
    >
      <summary
        data-testid="regdiag-summary"
        className="flex items-center gap-3 p-3 cursor-pointer select-none list-none [&::-webkit-details-marker]:hidden transition-colors hover:bg-neutral-50 dark:hover:bg-neutral-700/40"
      >
        <span className="min-w-0 flex-1">
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-semibold text-neutral-800 dark:text-neutral-200">{t("regDiag.title")}<InfoHint term="assumptionCheck" /></span>
            {counts && (
              <span data-testid="regdiag-chips" className="flex flex-wrap gap-1.5">
                {badges.map((badge) => (
                  <span
                    key={badge.key}
                    className={`rounded-full px-2 py-0.5 text-[11px] font-medium ${BADGE_CLASS[badge.key]}`}
                  >
                    {badge.count} {badge.label}
                  </span>
                ))}
              </span>
            )}
          </span>
          <span data-testid="regdiag-sample" className="mt-0.5 block text-xs text-neutral-500 dark:text-neutral-400">{sampleLine}</span>
        </span>
        {/* The summary is display:flex, which removes the native triangle marker — this is the
            only visible cue that the section opens, so it must render in both states. */}
        <ChevronDown data-testid="regdiag-toggle" aria-label={expanded ? t("regDiag.collapse") : t("regDiag.expand")} className={`h-4 w-4 shrink-0 text-neutral-500 transition-transform duration-200 ease-out ${expanded ? "rotate-180" : ""}`} />
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
                    if (typeof navigator === "undefined" || !navigator.clipboard) {
                      showToast(t("regDiag.copyFailed"));
                      return;
                    }
                    void navigator.clipboard
                      .writeText(buildDiagnosticsTsv(ok, t))
                      .then(() => showToast(t("regDiag.copied")))
                      .catch(() => showToast(t("regDiag.copyFailed")));
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
                      <th scope="col" className="text-left p-2">{t("regDiag.table.verdict")}</th>
                      <th scope="col" className="text-left p-2">{t("regDiag.table.assumption")}</th>
                      <th scope="col" className="text-left p-2">{t("regDiag.table.statistic")}</th>
                      <th scope="col" className="text-left p-2">{t("regDiag.table.action")}</th>
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
  const name = t(`regDiag.row.${row.id}`);
  const explanation = row.applicable
    ? t(`regDiag.explain.${row.id}.${row.verdict}`)
    : t(`regDiag.reason.${row.notApplicableReason}`);
  const vif = row.applicable && row.id === "collinearity" ? vifOffenders(diagnostics.vif, t) : "";
  const hintText = [explanation, t(`glossary.${nameHint}.text`), vif].filter(Boolean).join("\n\n");

  return (
    <tr data-testid={`regdiag-row-${row.id}`} className="border-b border-neutral-100 dark:border-neutral-700/50 align-top">
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
      <th scope="row" className="p-2 text-left font-medium">
        {name}
        <InfoHint term={nameHint} title={name} text={hintText} hoverText={explanation} />
      </th>

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
          <p className="mt-1 text-[11px] text-neutral-500 dark:text-neutral-400">
            {t("regDiag.table.thresholdNote", {
              rule: thresholdText(row.id, diagnostics.thresholds, t),
            })}
          </p>
        </td>
      ) : (
        <td className="p-2" />
      )}

      <td className="p-2 text-xs">
        {row.applicable && (
          <div data-testid={`regdiag-action-${row.id}`}>
            {row.id === "influence" ? (
              <InfluenceAction
                diagnostics={diagnostics}
                stale={stale}
                onJumpToRow={onJumpToRow}
              />
            ) : row.verdict === "pass" ? (
              <span className="text-neutral-500 dark:text-neutral-400">{t("regDiag.action.none")}</span>
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

  const flagged = diagnostics.influential.slice(0, 3).map((entry) =>
    t("regDiag.influential.row", {
      row: entry.rowIndex + 1,
      cookD: formatNumber(entry.cookD, t),
      studentized: formatNumber(entry.studentized, t),
    })
  );
  const remaining = diagnostics.influential.length - flagged.length;
  if (remaining > 0) flagged.push(t("regDiag.influential.more", { count: remaining }));

  return (
    <div className="flex items-center">
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
      <InfoHint title={t("regDiag.influential.heading")} text={flagged.join("\n")} />
    </div>
  );
}
