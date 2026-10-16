import { useState, type Dispatch, type SetStateAction } from "react";
import { X, Loader2 } from "lucide-react";
import type { Dataset } from "@/types";
import { getDataRows, computeDescriptive } from "@/utils/stats";
import { generateId } from "@/utils/helpers";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";
import {
  imputeListwise,
  imputeMeanMedianMode,
  imputeHotDeck,
} from "@/utils/missing-imputation";
import { analyzeMiceImputation, type MiceImputationResponse } from "@/api";

export interface TransformTabProps {
  selectedDs: Dataset | null;
  setDatasets: Dispatch<SetStateAction<Dataset[]>>;
  onSelectDataset: (id: string | null) => void;
  onWorkflowDatasetAdd?: (id: string) => void;
  initialShowChoiceModal?: boolean;
  initialColsMultiple?: string[];
}

export function TransformTab({
  selectedDs,
  setDatasets,
  onSelectDataset,
  onWorkflowDatasetAdd,
  initialShowChoiceModal = false,
  initialColsMultiple = [],
}: TransformTabProps) {
  const [transformCol] = useState("");
  const [transformColsMultiple, setTransformColsMultiple] = useState<string[]>(initialColsMultiple);
  const [transformAction, setTransformAction] = useState<
    | "drop_missing"
    | "fill_mean"
    | "fill_median"
    | "fill_mode"
    | "fill_hot_deck"
    | "fill_mice"
    | "z_score"
    | "min_max"
    | "filter"
    | "sort"
    | "recode"
  >("drop_missing");
  const [filterCol, setFilterCol] = useState("");
  const [filterOp, setFilterOp] = useState<"==" | "!=" | ">" | "<" | ">=" | "<=" | "contains">("==");
  const [filterValue, setFilterValue] = useState("");
  const [sortCol, setSortCol] = useState("");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("asc");
  const [recodeCol, setRecodeCol] = useState("");
  const [recodeRules, setRecodeRules] = useState<{ from: string; to: string }[]>([{ from: "", to: "" }]);
  const [miceMaxIter, setMiceMaxIter] = useState<number>(10);
  const [isMiceLoading, setIsMiceLoading] = useState<boolean>(false);
  const [miceError, setMiceError] = useState<string | null>(null);
  const [showTransformChoiceModal, setShowTransformChoiceModal] = useState(initialShowChoiceModal);
  const [lastTransformResult, setLastTransformResult] = useState<{
    before: string[][];
    after: string[][];
    actionLabel: string;
    stats?: MiceImputationResponse["statistics"];
  } | null>(null);

  if (!selectedDs) {
    return (
      <div className="w-full max-w-full">
        <h2 className="text-xl font-semibold mb-2">{t("transformTab.noDatasetTitle")}</h2>
        <p className="text-neutral-500">{t("transformTab.selectDatasetHint")}</p>
        <p className="text-sm text-neutral-500 mt-2">{t("transformTab.useAiGuidePrefix")} <strong>{t("transformTab.aiGuideTabName")}</strong> {t("transformTab.useAiGuideSuffix")}</p>
      </div>
    );
  }

  const dataRows = getDataRows(selectedDs);
  const cols = selectedDs.columnNames || [];
  const header = dataRows[0] || [];
  const aiContextTransform = `Bộ dữ liệu: ${selectedDs.name}. Số hàng: ${dataRows.length}, số cột: ${cols.length}. Các cột: ${cols.join(", ")}. Công cụ hỗ trợ: bỏ missing, điền mean/median/mode/hot-deck/MICE, chuẩn hóa z-score/min-max, lọc, sắp xếp, recode.`;

  const applyTransform = async (overwriteOriginal: boolean) => {
    setShowTransformChoiceModal(false);
    if (dataRows.length < 2) return;
    let newRows: string[][];
    let statsForMice: MiceImputationResponse["statistics"] | undefined = undefined;

    if (transformAction === "filter") {
      if (!filterCol || header.indexOf(filterCol) === -1) return;
      const ci = header.indexOf(filterCol);
      const val = filterValue.trim();
      const op = filterOp;
      newRows = [header, ...dataRows.slice(1).filter((r) => {
        const cell = (r[ci] ?? "").toString().trim();
        const num = Number(cell);
        const vNum = Number(val);
        if (op === "==") return cell === val;
        if (op === "!=") return cell !== val;
        if (op === "contains") return cell.toLowerCase().includes(val.toLowerCase());
        if (!Number.isNaN(num) && !Number.isNaN(vNum)) {
          if (op === ">") return num > vNum;
          if (op === "<") return num < vNum;
          if (op === ">=") return num >= vNum;
          if (op === "<=") return num <= vNum;
        }
        return false;
      })];
    } else if (transformAction === "sort") {
      if (!sortCol || header.indexOf(sortCol) === -1) return;
      const ci = header.indexOf(sortCol);
      const isNum = dataRows.slice(1).every((r) => { const v = r[ci]; return v === "" || !Number.isNaN(Number(v)); });
      const sorted = [...dataRows.slice(1)].sort((a, b) => {
        const av = a[ci] ?? "";
        const bv = b[ci] ?? "";
        let cmp = 0;
        if (isNum) {
          const an = Number(av);
          const bn = Number(bv);
          cmp = (Number.isNaN(an) ? -Infinity : an) - (Number.isNaN(bn) ? -Infinity : bn);
        } else cmp = String(av).localeCompare(String(bv));
        return sortOrder === "asc" ? cmp : -cmp;
      });
      newRows = [header, ...sorted];
    } else if (transformAction === "recode") {
      if (!recodeCol || header.indexOf(recodeCol) === -1) return;
      const ci = header.indexOf(recodeCol);
      const map = Object.fromEntries(recodeRules.filter((r) => r.from.trim() !== "").map((r) => [r.from.trim(), r.to.trim()]));
      newRows = [header, ...dataRows.slice(1).map((r) => {
        const out = [...r];
        const v = (r[ci] ?? "").toString().trim();
        out[ci] = map[v] !== undefined ? map[v] : v;
        return out;
      })];
    } else {
      const columnsToApply = transformColsMultiple.length > 0 ? transformColsMultiple : (transformCol ? [transformCol] : []);
      if (columnsToApply.length === 0 || columnsToApply.some((c) => header.indexOf(c) === -1)) return;

      if (transformAction === "drop_missing") {
        newRows = imputeListwise(dataRows, columnsToApply, selectedDs.variables);
      } else if (transformAction === "fill_mean") {
        newRows = imputeMeanMedianMode(dataRows, columnsToApply, selectedDs.variables, "mean");
      } else if (transformAction === "fill_median") {
        newRows = imputeMeanMedianMode(dataRows, columnsToApply, selectedDs.variables, "median");
      } else if (transformAction === "fill_mode") {
        newRows = imputeMeanMedianMode(dataRows, columnsToApply, selectedDs.variables, "mode");
      } else if (transformAction === "fill_hot_deck") {
        newRows = imputeHotDeck(dataRows, columnsToApply, selectedDs.variables);
      } else if (transformAction === "fill_mice") {
        setIsMiceLoading(true);
        setMiceError(null);
        try {
          const res = await analyzeMiceImputation(
            dataRows,
            columnsToApply,
            selectedDs.variables,
            miceMaxIter
          );
          if (!res || !res.rows) {
            throw new Error(t("transformTab.mice.errEmptyResponse"));
          }
          newRows = res.rows;
          if (res.statistics) {
            statsForMice = res.statistics;
          }
        } catch (err: unknown) {
          const msg = err instanceof Error ? err.message : String(err);
          setMiceError(msg || t("transformTab.mice.errFailed"));
          setIsMiceLoading(false);
          return;
        } finally {
          setIsMiceLoading(false);
        }
      } else if (transformAction === "z_score" || transformAction === "min_max") {
        const desc = computeDescriptive(dataRows);
        const numericRows = dataRows.slice(1).map((r) => r.map((v) => (v ?? "").trim()));
        newRows = [header, ...numericRows.map((r) => {
          const out = [...r];
          for (const col of columnsToApply) {
            const ci = header.indexOf(col);
            const rowDesc = desc.find((d) => d.column === col);
            if (transformAction === "z_score") {
              const mean = rowDesc?.mean ?? 0;
              const std = rowDesc?.std ?? 1;
              if (std === 0) continue;
              const v = r[ci];
              const num = Number(v);
              if (v !== "" && !Number.isNaN(num)) out[ci] = ((num - mean) / std).toFixed(4);
            } else {
              const min = rowDesc?.min ?? 0;
              const max = rowDesc?.max ?? 1;
              const range = max - min || 1;
              const v = r[ci];
              const num = Number(v);
              if (v !== "" && !Number.isNaN(num)) out[ci] = ((num - min) / range).toFixed(4);
            }
          }
          return out;
        })];
      } else {
        return;
      }
    }

    const now = new Date().toISOString();
    const suffix =
      transformAction === "filter"
        ? t("transformTab.suffixFilter")
        : transformAction === "sort"
        ? t("transformTab.suffixSort")
        : transformAction === "recode"
        ? t("transformTab.suffixRecode")
        : transformAction === "z_score"
        ? " (z-score)"
        : transformAction === "min_max"
        ? " (min-max)"
        : transformAction === "fill_hot_deck"
        ? " (hot-deck)"
        : transformAction === "fill_mice"
        ? " (MICE)"
        : t("transformTab.suffixDefault");

    const beforeSnapshot = dataRows.map((r) => [...r]);
    setLastTransformResult({
      before: beforeSnapshot,
      after: newRows,
      actionLabel: suffix,
      stats: statsForMice,
    });

    if (overwriteOriginal) {
      const updatedDs: Dataset = {
        ...selectedDs,
        name: `${selectedDs.name}${suffix}`,
        rows: newRows.length - 1,
        columns: header.length,
        columnNames: header,
        preview: newRows.slice(0, 6),
        data: newRows,
        variables: selectedDs.variables ? { ...selectedDs.variables } : undefined,
        updatedAt: now,
      };
      setDatasets((prev) => prev.map((d) => (d.id === selectedDs.id ? updatedDs : d)));
      setShowTransformChoiceModal(false);
    } else {
      const id = generateId();
      const newDs: Dataset = {
        id,
        name: `${selectedDs.name}${suffix}`,
        rows: newRows.length - 1,
        columns: header.length,
        columnNames: header,
        preview: newRows.slice(0, 6),
        data: newRows,
        variables: selectedDs.variables ? { ...selectedDs.variables } : undefined,
        sourceFormat: selectedDs.sourceFormat,
        createdAt: now,
        updatedAt: now,
      };
      setDatasets((prev) => [...prev, newDs]);
      onSelectDataset(id);
      onWorkflowDatasetAdd?.(id);
      setShowTransformChoiceModal(false);
    }
  };

  const addRecodeRule = () => setRecodeRules((prev) => [...prev, { from: "", to: "" }]);
  const setRecodeRule = (i: number, field: "from" | "to", value: string) => setRecodeRules((prev) => prev.map((r, j) => j === i ? { ...r, [field]: value } : r));

  return (
    <div className="w-full max-w-full">
      <div className="flex flex-wrap items-center justify-between gap-2 mb-2">
        <h2 className="text-xl font-semibold">{t("transformTab.pipelineTitle")}</h2>
        <AIAssistPanel
          context={aiContextTransform}
          quickPrompts={[{ label: t("transformTab.aiPromptGuideLabel"), systemHint: `Bạn là chuyên gia tiền xử lý dữ liệu. Dựa trên cấu trúc và mô tả bộ dữ liệu, gợi ý ngắn gọn: xử lý missing (bỏ/điền mean/median/mode), lọc theo điều kiện, chuẩn hóa (z-score, min-max), sắp xếp, recode biến. Chỉ nêu các bước phù hợp. ${aiAnswerLangHint("Trả lời bằng tiếng Việt.", "Answer in English.")}` }]}
          title={t("transformTab.aiAssistTitle")}
        />
      </div>
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("transformTab.description")}</p>
      <div>
        <label className="block text-sm font-medium mb-1">{t("transformTab.actionLabel")}</label>
        <select value={transformAction} onChange={(e) => setTransformAction(e.target.value as typeof transformAction)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 mb-3">
          <option value="drop_missing">{t("transformTab.actionDropMissing")}</option>
          <option value="fill_mean">{t("transformTab.actionFillMean")}</option>
          <option value="fill_median">{t("transformTab.actionFillMedian")}</option>
          <option value="fill_mode">{t("transformTab.actionFillMode")}</option>
          <option value="fill_hot_deck">{t("transformTab.actionFillHotDeck")}</option>
          <option value="fill_mice">{t("transformTab.actionFillMice")}</option>
          <option value="z_score">{t("transformTab.actionZScore")}</option>
          <option value="min_max">{t("transformTab.actionMinMax")}</option>
          <option value="filter">{t("transformTab.actionFilter")}</option>
          <option value="sort">{t("transformTab.actionSort")}</option>
          <option value="recode">{t("transformTab.actionRecode")}</option>
        </select>
      </div>
      {(["drop_missing", "fill_mean", "fill_median", "fill_mode", "fill_hot_deck", "fill_mice", "z_score", "min_max"].includes(transformAction)) && (
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.columnsMultiLabel")}</label>
            <div className="flex flex-wrap gap-x-4 gap-y-1 max-h-32 overflow-y-auto rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 p-2">
              {cols.map((c) => (
                <label key={c} className="flex items-center gap-1.5 text-sm cursor-pointer">
                  <input type="checkbox" checked={transformColsMultiple.includes(c)} onChange={() => setTransformColsMultiple((prev) => prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c])} />
                  {c}
                </label>
              ))}
            </div>
            <p className="text-xs text-neutral-500 mt-1">{t("transformTab.columnsMultiHint")}</p>
          </div>
        </div>
      )}
      {transformAction === "fill_mice" && (
        <div className="flex flex-wrap gap-4 items-center mb-4 p-3 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sky-900 dark:text-sky-200 mb-1">
              {t("transformTab.mice.maxIterLabel")}
            </label>
            <input
              type="number"
              min={1}
              max={100}
              value={miceMaxIter}
              onChange={(e) => setMiceMaxIter(Math.max(1, parseInt(e.target.value) || 10))}
              className="rounded-lg border border-sky-300 dark:border-sky-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-sm w-28 font-mono"
            />
          </div>
          <div className="text-xs text-sky-700 dark:text-sky-300 max-w-lg">
            {t("transformTab.mice.description")}
          </div>
        </div>
      )}
      {isMiceLoading && (
        <div className="flex items-center gap-2 text-sm text-sky-600 dark:text-sky-400 mb-3 animate-pulse">
          <Loader2 className="w-4 h-4 animate-spin shrink-0" />
          <span>{t("transformTab.mice.loading")}</span>
        </div>
      )}
      {miceError && (
        <div className="p-3 mb-3 text-sm text-red-700 bg-red-100 dark:bg-red-900/30 dark:text-red-300 rounded-lg border border-red-200 dark:border-red-800">
          {miceError}
        </div>
      )}
      {transformAction === "filter" && (
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.columnLabel")}</label>
            <select value={filterCol} onChange={(e) => setFilterCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.conditionLabel")}</label>
            <select value={filterOp} onChange={(e) => setFilterOp(e.target.value as typeof filterOp)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="==">{t("transformTab.opEquals")}</option>
              <option value="!=">{t("transformTab.opNotEquals")}</option>
              <option value=">">&gt;</option>
              <option value="<">&lt;</option>
              <option value=">=">{t("transformTab.opGte")}</option>
              <option value="<=">{t("transformTab.opLte")}</option>
              <option value="contains">{t("transformTab.opContains")}</option>
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.valueLabel")}</label>
            <input type="text" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder={t("transformTab.valuePlaceholder")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2" />
          </div>
        </div>
      )}
      {transformAction === "sort" && (
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.sortByColumnLabel")}</label>
            <select value={sortCol} onChange={(e) => setSortCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.orderLabel")}</label>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="asc">{t("transformTab.orderAsc")}</option>
              <option value="desc">{t("transformTab.orderDesc")}</option>
            </select>
          </div>
        </div>
      )}
      {transformAction === "recode" && (
        <div className="mb-3">
          <div className="mb-2">
            <label className="block text-sm font-medium mb-1">{t("transformTab.recodeColumnLabel")}</label>
            <select value={recodeCol} onChange={(e) => setRecodeCol(e.target.value)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <p className="text-sm text-neutral-500 mb-2">{t("transformTab.recodeRuleHint")}</p>
          {recodeRules.map((r, i) => (
            <div key={i} className="flex gap-2 items-center mb-2">
              <input type="text" value={r.from} onChange={(e) => setRecodeRule(i, "from", e.target.value)} placeholder={t("transformTab.oldValuePlaceholder")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-32" />
              <span className="text-neutral-500" aria-hidden="true">→</span>
              <input type="text" value={r.to} onChange={(e) => setRecodeRule(i, "to", e.target.value)} placeholder={t("transformTab.newValuePlaceholder")} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-32" />
            </div>
          ))}
          <button type="button" onClick={addRecodeRule} className="text-sm text-brand hover:underline">{t("transformTab.addRuleButton")}</button>
        </div>
      )}
      <button
        type="button"
        onClick={() => setShowTransformChoiceModal(true)}
        disabled={
          isMiceLoading ||
          (["drop_missing", "fill_mean", "fill_median", "fill_mode", "fill_hot_deck", "fill_mice", "z_score", "min_max"].includes(transformAction) &&
            transformColsMultiple.length === 0)
        }
        className="rounded-lg bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50"
      >
        {isMiceLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("transformTab.processing")}
          </span>
        ) : (
          t("transformTab.applyButton")
        )}
      </button>
      {showTransformChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowTransformChoiceModal(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-xl shadow-lg max-w-md w-full flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t("transformTab.modalTitle")}</h3>
              <button type="button" onClick={() => setShowTransformChoiceModal(false)} className="p-2 rounded-lg text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700" aria-label={t("transformTab.closeAriaLabel")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-neutral-600 dark:text-neutral-400">{t("transformTab.modalQuestion")}</p>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => applyTransform(true)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 px-4 py-2.5 text-left font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600">
                  {t("transformTab.overwriteOriginalButton")}
                </button>
                <button type="button" onClick={() => applyTransform(false)} className="rounded-lg border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 px-4 py-2.5 text-left font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600">
                  {t("transformTab.createNewButton")}
                </button>
                <button type="button" onClick={() => setShowTransformChoiceModal(false)} className="rounded-lg px-4 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                  {t("transformTab.cancelButton")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {lastTransformResult && (
        <div className="mt-6 space-y-4 rounded-xl border border-neutral-200 dark:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/50 p-4">
          <h3 className="text-lg font-semibold text-neutral-800 dark:text-neutral-200">{t("transformTab.transformResultTitle")} {lastTransformResult.actionLabel}</h3>
          <p className="text-sm text-neutral-600 dark:text-neutral-400">
            {t("transformTab.beforeLabel")} <strong>{lastTransformResult.before.length - 1}</strong> {t("transformTab.rowsUnit")} × <strong>{lastTransformResult.before[0]?.length ?? 0}</strong> {t("transformTab.columnsUnit")}
            {" → "}
            {t("transformTab.afterLabel")} <strong>{lastTransformResult.after.length - 1}</strong> {t("transformTab.rowsUnit")} × <strong>{lastTransformResult.after[0]?.length ?? 0}</strong> {t("transformTab.columnsUnit")}
          </p>
          {lastTransformResult.stats && lastTransformResult.stats.length > 0 && (
            <div className="rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20 p-3 overflow-x-auto">
              <h4 className="text-xs font-semibold text-sky-900 dark:text-sky-200 uppercase tracking-wider mb-2">
                {t("transformTab.mice.reportTitle")}
              </h4>
              <table className="w-full text-xs">
                <thead>
                  <tr className="border-b border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300">
                    <th className="text-left py-1 px-2 font-medium">{t("transformTab.mice.colVariable")}</th>
                    <th className="text-right py-1 px-2 font-medium">{t("transformTab.mice.colMissingCount")}</th>
                    <th className="text-right py-1 px-2 font-medium">{t("transformTab.mice.colOriginalMean")}</th>
                    <th className="text-right py-1 px-2 font-medium">{t("transformTab.mice.colImputedMean")}</th>
                    <th className="text-right py-1 px-2 font-medium">{t("transformTab.mice.colImputedStd")}</th>
                    <th className="text-right py-1 px-2 font-medium">{t("transformTab.mice.colMin")}</th>
                    <th className="text-right py-1 px-2 font-medium">{t("transformTab.mice.colMax")}</th>
                  </tr>
                </thead>
                <tbody>
                  {lastTransformResult.stats.map((st) => (
                    <tr key={st.column} className="border-b border-sky-100 dark:border-sky-900/40">
                      <td className="py-1 px-2 font-medium text-neutral-800 dark:text-neutral-200">{st.column}</td>
                      <td className="py-1 px-2 text-right text-red-600 dark:text-red-400 font-medium">{st.missingCount}</td>
                      <td className="py-1 px-2 text-right">{st.originalMean != null ? st.originalMean.toFixed(2) : "—"}</td>
                      <td className="py-1 px-2 text-right font-semibold text-sky-700 dark:text-sky-300">{st.imputedMean != null ? st.imputedMean.toFixed(2) : "—"}</td>
                      <td className="py-1 px-2 text-right">{st.imputedStd != null ? st.imputedStd.toFixed(2) : "—"}</td>
                      <td className="py-1 px-2 text-right">{st.min != null ? st.min.toFixed(2) : "—"}</td>
                      <td className="py-1 px-2 text-right">{st.max != null ? st.max.toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <div className="rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-900/20 overflow-hidden">
              <div className="px-3 py-2 border-b border-amber-200 dark:border-amber-800 bg-amber-100/80 dark:bg-amber-900/40 font-medium text-amber-900 dark:text-amber-100 text-sm">
                {t("transformTab.beforeDataHeader")}
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-amber-50 dark:bg-amber-900/30">
                    <tr className="border-b border-amber-200 dark:border-amber-700">
                      {(lastTransformResult.before[0] || []).map((h, i) => (
                        <th key={i} className="text-left p-2 whitespace-nowrap font-medium text-amber-900 dark:text-amber-200">{h || `C${i + 1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lastTransformResult.before.slice(1, 16).map((row, ri) => (
                      <tr key={ri} className="border-b border-amber-100 dark:border-amber-800/50">
                        {(row || []).map((cell, ci) => (
                          <td key={ci} className="p-2 text-neutral-700 dark:text-neutral-300">{String(cell ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lastTransformResult.before.length > 16 && (
                <p className="px-3 py-1.5 text-xs text-amber-800 dark:text-amber-200 bg-amber-100/60 dark:bg-amber-900/30">
                  {t("transformTab.rowsTruncatedPrefix")} {lastTransformResult.before.length - 1} {t("transformTab.rowsTruncatedSuffix")}
                </p>
              )}
            </div>
            <div className="rounded-lg border border-emerald-200 dark:border-emerald-800 bg-emerald-50/50 dark:bg-emerald-900/20 overflow-hidden">
              <div className="px-3 py-2 border-b border-emerald-200 dark:border-emerald-800 bg-emerald-100/80 dark:bg-emerald-900/40 font-medium text-emerald-900 dark:text-emerald-100 text-sm">
                {t("transformTab.afterDataHeader")}
              </div>
              <div className="overflow-x-auto max-h-64 overflow-y-auto">
                <table className="w-full text-sm">
                  <thead className="sticky top-0 bg-emerald-50 dark:bg-emerald-900/30">
                    <tr className="border-b border-emerald-200 dark:border-emerald-700">
                      {(lastTransformResult.after[0] || []).map((h, i) => (
                        <th key={i} className="text-left p-2 whitespace-nowrap font-medium text-emerald-900 dark:text-emerald-200">{h || `C${i + 1}`}</th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {lastTransformResult.after.slice(1, 16).map((row, ri) => (
                      <tr key={ri} className="border-b border-emerald-100 dark:border-emerald-800/50">
                        {(row || []).map((cell, ci) => (
                          <td key={ci} className="p-2 text-neutral-700 dark:text-neutral-300">{String(cell ?? "")}</td>
                        ))}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              {lastTransformResult.after.length > 16 && (
                <p className="px-3 py-1.5 text-xs text-emerald-800 dark:text-emerald-200 bg-emerald-100/60 dark:bg-emerald-900/30">
                  {t("transformTab.rowsTruncatedPrefix")} {lastTransformResult.after.length - 1} {t("transformTab.rowsTruncatedSuffix")}
                </p>
              )}
            </div>
          </div>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("transformTab.newDatasetAddedPrefix")} <strong>{t("transformTab.viewDataTabName")}</strong> {t("transformTab.newDatasetAddedSuffix")}
          </p>
        </div>
      )}
    </div>
  );
}
