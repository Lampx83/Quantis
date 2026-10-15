import { useMemo, useState } from "react";
import { Loader2 } from "lucide-react";
import type { Dataset } from "@/types";
import { getDataRows } from "@/utils/stats";
import * as quantisApi from "@/api";
import type { PanelResult, PanelCoefRow } from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";
import { InfoHint, GlossaryBar } from "@/components/common/InfoHint";

export interface PanelTabProps {
  selectedDataset: Dataset;
  analysisBackendAvailable?: boolean;
  showToast?: (msg: string) => void;
}

const num = (x: number | null | undefined, d = 4) => (x == null || Number.isNaN(x) ? "—" : x.toFixed(d));
const pfmt = (p: number | null | undefined) => (p == null ? "—" : p < 0.0001 ? "< 0.0001" : p.toFixed(4));
/** Dạng dùng trong câu «p = 0.0123» / «p < 0.0001». */
const peq = (p: number | null | undefined) => (p == null ? "= —" : p < 0.0001 ? "< 0.0001" : `= ${p.toFixed(4)}`);
const tpl = (s: string, vars: Record<string, string>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(v), s);

function CoefTable({ rows }: { rows: PanelCoefRow[] }) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-neutral-200 dark:border-neutral-600">
            <th className="text-left p-2">{t("panelTab.colVariable")}</th>
            <th className="text-right p-2">{t("panelTab.colCoef")}<InfoHint term="coefficient" /></th>
            <th className="text-right p-2">{t("panelTab.colSe")}</th>
            <th className="text-right p-2">{t("panelTab.colT")}</th>
            <th className="text-right p-2">{t("panelTab.colP")}<InfoHint term="pValue" /></th>
            <th className="text-right p-2">{t("panelTab.colCi")}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((c) => (
            <tr key={c.name} className="border-b border-neutral-100 dark:border-neutral-700/50">
              <td className="p-2 font-medium">{c.name === "(Hằng số)" ? t("panelTab.constant") : c.name}</td>
              <td className="p-2 text-right">{num(c.coef)}</td>
              <td className="p-2 text-right">{num(c.se)}</td>
              <td className="p-2 text-right">{num(c.t, 3)}</td>
              <td className={`p-2 text-right ${c.p != null && c.p < 0.05 ? "font-semibold" : ""}`}>{pfmt(c.p)}</td>
              <td className="p-2 text-right whitespace-nowrap">[{num(c.ciLower)}; {num(c.ciUpper)}]</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export function PanelTab({ selectedDataset, analysisBackendAvailable = false, showToast }: PanelTabProps) {
  const rows = useMemo(() => getDataRows(selectedDataset), [selectedDataset]);
  const cols = selectedDataset.columnNames || [];
  const numericCols = useMemo(
    () =>
      rows.length >= 2
        ? cols.filter((c) => {
            const ci = rows[0].indexOf(c);
            if (ci < 0) return false;
            let any = false;
            for (let r = 1; r < rows.length; r++) {
              const v = (rows[r][ci] ?? "").toString().trim();
              if (v === "") continue;
              if (Number.isNaN(Number(v))) return false;
              any = true;
            }
            return any;
          })
        : [],
    [rows, cols.join("\u0001")]
  );
  const [entityCol, setEntityCol] = useState("");
  const [timeCol, setTimeCol] = useState("");
  const [yCol, setYCol] = useState("");
  const [xCols, setXCols] = useState<string[]>([]);
  const [timeEffects, setTimeEffects] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [res, setRes] = useState<PanelResult | null>(null);

  const toggleX = (c: string) => {
    setXCols((p) => (p.includes(c) ? p.filter((x) => x !== c) : [...p, c]));
    setRes(null);
  };

  const run = async () => {
    setError(null);
    if (!entityCol || !timeCol || !yCol || xCols.length === 0) {
      setError(t("panelTab.needSelect"));
      return;
    }
    if (!analysisBackendAvailable) {
      showToast?.(t("panelTab.needBackend"));
      setError(t("panelTab.needBackend"));
      return;
    }
    setLoading(true);
    try {
      const out = await quantisApi.analyzePanel(rows, yCol, xCols, entityCol, timeCol, timeEffects);
      if (out.error) {
        setRes(null);
        setError(out.error);
      } else {
        setRes(out.result ?? null);
      }
    } finally {
      setLoading(false);
    }
  };

  const sel = "rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm";
  const card = "rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4 mb-4 text-sm";

  const aiContext = res
    ? `Phân tích dữ liệu bảng: Y = ${res.yName}; X = ${res.xNames.join(", ")}; ${res.nGroups} đơn vị, ${res.nObs} quan sát. ` +
      `OLS gộp: ${res.pooled.coefficients.map((c) => `${c.name}=${num(c.coef, 3)} (p=${pfmt(c.p)})`).join("; ")}, R²=${num(res.pooled.r2, 3)}. ` +
      (res.fixed ? `FE: ${res.fixed.coefficients.map((c) => `${c.name}=${num(c.coef, 3)} (p=${pfmt(c.p)})`).join("; ")}, R² within=${num(res.fixed.r2Within, 3)}. ` : "") +
      (res.random ? `RE: ${res.random.coefficients.map((c) => `${c.name}=${num(c.coef, 3)} (p=${pfmt(c.p)})`).join("; ")}. ` : "") +
      (res.hausman ? `Hausman χ²(${res.hausman.df})=${num(res.hausman.chi2, 3)}, p=${pfmt(res.hausman.p)} → ${res.hausman.preferred}.` : "")
    : t("panelTab.description");

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">
        {t("panelTab.title")}
        <InfoHint term="panelData" />
      </h2>
      <GlossaryBar terms={["panelData", "pooledOls", "fixedEffects", "randomEffects", "hausman", "withinBetween"]} />
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("panelTab.description")}</p>
      <div className="mb-4">
        <AIAssistPanel
          context={aiContext}
          quickPrompts={[
            {
              label: t("panelTab.askAiTitle"),
              systemHint: `Bạn là chuyên gia kinh tế lượng. Giải thích kết quả dữ liệu bảng: so sánh OLS gộp, Fixed Effects, Random Effects; ý nghĩa kiểm định Hausman và nên chọn mô hình nào; cách đọc R² within/between/overall. Không bịa số ngoài kết quả đã cho. ${aiAnswerLangHint()}`,
            },
          ]}
          title={t("panelTab.askAiTitle")}
        />
      </div>

      <div className={card}>
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("panelTab.entityLabel")}</label>
            <select value={entityCol} onChange={(e) => { setEntityCol(e.target.value); setRes(null); }} className={sel} data-testid="panel-entity">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("panelTab.timeLabel")}</label>
            <select value={timeCol} onChange={(e) => { setTimeCol(e.target.value); setRes(null); }} className={sel} data-testid="panel-time">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("panelTab.yLabel")}</label>
            <select value={yCol} onChange={(e) => { setYCol(e.target.value); setXCols((p) => p.filter((x) => x !== e.target.value)); setRes(null); }} className={sel} data-testid="panel-y">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {numericCols.filter((c) => c !== entityCol && c !== timeCol).map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
        </div>
        <div className="mb-3">
          <p className="text-sm font-medium mb-1">{t("panelTab.xLabel")}</p>
          <div className="flex flex-wrap gap-2">
            {numericCols.filter((c) => c !== yCol && c !== entityCol && c !== timeCol).map((c) => (
              <button
                key={c}
                type="button"
                onClick={() => toggleX(c)}
                className={`rounded-md px-3 py-1.5 text-sm ${xCols.includes(c) ? "bg-brand text-white" : "border border-neutral-300 dark:border-neutral-600"}`}
              >
                {c}
              </button>
            ))}
          </div>
        </div>
        <label className="flex items-center gap-2 text-sm mb-3 cursor-pointer">
          <input type="checkbox" checked={timeEffects} onChange={(e) => { setTimeEffects(e.target.checked); setRes(null); }} />
          {t("panelTab.timeEffectsLabel")}
        </label>
        <button
          type="button"
          onClick={run}
          disabled={loading}
          data-testid="panel-run"
          className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50 inline-flex items-center gap-2"
        >
          {loading ? (<><Loader2 className="w-4 h-4 animate-spin shrink-0" aria-hidden /> {t("panelTab.running")}</>) : t("panelTab.runButton")}
        </button>
        {error && <p role="alert" className="mt-3 text-red-600 dark:text-red-400">{t("panelTab.errorPrefix")} {error}</p>}
      </div>

      {res && (
        <div data-testid="panel-result">
          <div className={card}>
            <p className="font-medium mb-2">{t("panelTab.summaryTitle")}</p>
            <ul className="space-y-0.5">
              <li>{t("panelTab.nObs")}: <strong>{res.nObs}</strong></li>
              <li>{t("panelTab.nGroups")}: <strong>{res.nGroups}</strong></li>
              <li>{t("panelTab.tRange")}: <strong>{res.tMin} / {num(res.tAvg, 2)} / {res.tMax}</strong> — {res.balanced ? t("panelTab.balanced") : t("panelTab.unbalanced")}</li>
              {res.droppedRows > 0 && <li>{t("panelTab.droppedRows")}: <strong>{res.droppedRows}</strong></li>}
            </ul>
          </div>

          <div className={card}>
            <p className="font-medium mb-2">{t("panelTab.descTitle")}<InfoHint term="withinBetween" /></p>
            <div className="overflow-x-auto">
              <table className="w-full text-sm" data-testid="panel-desc">
                <thead>
                  <tr className="border-b border-neutral-200 dark:border-neutral-600">
                    <th className="text-left p-2">{t("panelTab.colVariable")}</th>
                    <th className="text-right p-2">{t("panelTab.colMean")}</th>
                    <th className="text-right p-2">{t("panelTab.colSdOverall")}</th>
                    <th className="text-right p-2">{t("panelTab.colSdBetween")}</th>
                    <th className="text-right p-2">{t("panelTab.colSdWithin")}</th>
                    <th className="text-right p-2">{t("panelTab.colMin")}</th>
                    <th className="text-right p-2">{t("panelTab.colMax")}</th>
                  </tr>
                </thead>
                <tbody>
                  {res.descriptive.map((d) => (
                    <tr key={d.variable} className="border-b border-neutral-100 dark:border-neutral-700/50">
                      <td className="p-2 font-medium">{d.variable}</td>
                      <td className="p-2 text-right">{num(d.mean)}</td>
                      <td className="p-2 text-right">{num(d.sdOverall)}</td>
                      <td className="p-2 text-right">{num(d.sdBetween)}</td>
                      <td className="p-2 text-right">{num(d.sdWithin)}</td>
                      <td className="p-2 text-right">{num(d.min)}</td>
                      <td className="p-2 text-right">{num(d.max)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>

          <div className={card} data-testid="panel-pooled">
            <p className="font-medium mb-2">{t("panelTab.pooledTitle")}<InfoHint term="pooledOls" /></p>
            <CoefTable rows={res.pooled.coefficients} />
            <p className="mt-2 text-neutral-600 dark:text-neutral-400">
              {tpl(t("panelTab.fitPooled"), {
                r2: num(res.pooled.r2), adj: num(res.pooled.adjR2), df1: String(res.pooled.dfModel), df2: String(res.pooled.dfResid),
                f: num(res.pooled.fStat, 3), fp: peq(res.pooled.fP), n: String(res.pooled.nObs),
              })}
              <InfoHint term="r2" />
            </p>
          </div>

          {res.fixed && (
            <div className={card} data-testid="panel-fixed">
              <p className="font-medium mb-2">{t("panelTab.fixedTitle")}<InfoHint term="fixedEffects" /></p>
              <CoefTable rows={res.fixed.coefficients} />
              <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                {tpl(t("panelTab.fitFixed"), {
                  w: num(res.fixed.r2Within), b: num(res.fixed.r2Between), o: num(res.fixed.r2Overall),
                  df1: String(res.fixed.coefficients.length), df2: String(res.fixed.dfResid),
                  f: num(res.fixed.fStat, 3), fp: peq(res.fixed.fP), n: String(res.fixed.nObs), g: String(res.fixed.nGroups),
                })}
              </p>
              <p className="mt-1 text-neutral-600 dark:text-neutral-400">
                {tpl(t("panelTab.fitEntityF"), {
                  df1: String(res.fixed.fEntityDf1), df2: String(res.fixed.fEntityDf2), f: num(res.fixed.fEntity, 3), p: peq(res.fixed.fEntityP),
                })}
              </p>
            </div>
          )}

          {res.random && (
            <div className={card} data-testid="panel-random">
              <p className="font-medium mb-2">{t("panelTab.randomTitle")}<InfoHint term="randomEffects" /></p>
              <CoefTable rows={res.random.coefficients} />
              <p className="mt-2 text-neutral-600 dark:text-neutral-400">
                {tpl(t("panelTab.fitRandom"), {
                  w: num(res.random.r2Within), b: num(res.random.r2Between), o: num(res.random.r2Overall),
                  su: num(res.random.sigmaU), se: num(res.random.sigmaE), rho: num(res.random.rho),
                  df: String(res.random.waldDf), chi: num(res.random.waldChi2, 3), p: peq(res.random.waldP),
                  n: String(res.random.nObs), g: String(res.random.nGroups),
                })}
              </p>
            </div>
          )}

          {res.hausman && (
            <div className={card} data-testid="panel-hausman">
              <p className="font-medium mb-2">{t("panelTab.hausmanTitle")}<InfoHint term="hausman" /></p>
              <p>
                {tpl(t("panelTab.hausmanResult"), { df: String(res.hausman.df), chi: num(res.hausman.chi2, 3), p: peq(res.hausman.p) })}
              </p>
              <p className="mt-1 font-medium">{res.hausman.preferred === "FE" ? t("panelTab.hausmanReject") : t("panelTab.hausmanKeep")}</p>
              <p className="mt-3 text-sm font-medium">{t("panelTab.hausmanCompareTitle")}</p>
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-neutral-200 dark:border-neutral-600">
                      <th className="text-left p-2">{t("panelTab.colVariable")}</th>
                      <th className="text-right p-2">{t("panelTab.colFe")}</th>
                      <th className="text-right p-2">{t("panelTab.colRe")}</th>
                      <th className="text-right p-2">{t("panelTab.colDiff")}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {res.hausman.comparison.map((c) => (
                      <tr key={c.name} className="border-b border-neutral-100 dark:border-neutral-700/50">
                        <td className="p-2 font-medium">{c.name}</td>
                        <td className="p-2 text-right">{num(c.fe)}</td>
                        <td className="p-2 text-right">{num(c.re)}</td>
                        <td className="p-2 text-right">{num(c.diff)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          <div className="text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
            <p className="font-medium">{t("panelTab.notesTitle")}</p>
            <p>{t("panelTab.seNote")}</p>
            {res.notes.map((n, i) => <p key={i}>{n}</p>)}
          </div>
        </div>
      )}
    </div>
  );
}
