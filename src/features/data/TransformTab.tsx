import { useState, useEffect, useRef, type Dispatch, type SetStateAction } from "react";
import { X, Loader2 } from "lucide-react";
import type { Dataset } from "@/types";
import { numCell, getDataRows, getAnalysisRows, computeDescriptive } from "@/utils/stats";
import { generateId } from "@/utils/helpers";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";
import { InfoHint } from "@/components/common/InfoHint";
import {
  imputeListwise,
  imputeMeanMedianMode,
  getModeFallbackColumns,
} from "@/utils/missing-imputation";
import { analyzeMiceImputation, clampMiceIterations, MICE_MIN_ITER, MICE_MAX_ITER, type MiceImputationResponse } from "@/api";
import { ensureDatasetMetadata } from "@/utils/metadata";
import { runHotDeckImputation } from "@/utils/imputation-worker-client";
import {
  renameColumn,
  coerceColumns,
  computeVariable,
  logTransform,
  removeOutliersIQR,
  removeDuplicates,
  type LogKind,
  type PrepResult,
} from "@/utils/dataPrep";

type PrepAction = "rename" | "coerce_numeric" | "coerce_text" | "compute" | "log" | "outlier_iqr" | "dedupe";
const PREP_ACTIONS: PrepAction[] = ["rename", "coerce_numeric", "coerce_text", "compute", "log", "outlier_iqr", "dedupe"];
type TransformAction =
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
  | PrepAction;
const tpl = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);

/** Spinner and cancel control shown while hot-deck runs off the main thread. */
export function HotDeckLoadingBanner({ onCancel }: { onCancel: () => void }) {
  return (
    <div
      role="status"
      className="mt-3 flex flex-wrap items-center gap-3 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/30 dark:text-sky-200"
    >
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
      <span>{t("transformTab.hotDeck.loading")}</span>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-sky-300 px-2 py-1 font-medium hover:bg-sky-100 dark:border-sky-700 dark:hover:bg-sky-900"
      >
        {t("transformTab.cancelButton")}
      </button>
    </div>
  );
}

export interface TransformTabProps {
  selectedDs: Dataset | null;
  setDatasets: Dispatch<SetStateAction<Dataset[]>>;
  onSelectDataset: (id: string | null) => void;
  onWorkflowDatasetAdd?: (id: string) => void;
  initialShowChoiceModal?: boolean;
  initialColsMultiple?: string[];
  initialAction?: TransformAction;
}

export function TransformTab({
  selectedDs,
  setDatasets,
  onSelectDataset,
  onWorkflowDatasetAdd,
  initialShowChoiceModal = false,
  initialColsMultiple = [],
  initialAction,
}: TransformTabProps) {
  const [transformCol] = useState("");
  const [transformColsMultiple, setTransformColsMultiple] = useState<string[]>(initialColsMultiple);
  const [transformAction, setTransformAction] = useState<TransformAction>(initialAction ?? "drop_missing");
  const [renameFrom, setRenameFrom] = useState("");
  const [renameTo, setRenameTo] = useState("");
  const [computeName, setComputeName] = useState("");
  const [computeFormula, setComputeFormula] = useState("");
  const [logKind, setLogKind] = useState<LogKind>("ln");
  const [iqrK, setIqrK] = useState("1.5");
  const [prepNote, setPrepNote] = useState<{ ok: boolean; text: string } | null>(null);
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
  const [isHotDeckLoading, setIsHotDeckLoading] = useState(false);
  const selectedDsRef = useRef(selectedDs);
  selectedDsRef.current = selectedDs;
  const currentOpIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [selectedDs?.id]);

  if (!selectedDs) {
    return (
      <div className="w-full max-w-full">
        <h2 className="text-xl font-semibold mb-2">{t("transformTab.noDatasetTitle")}</h2>
        <p className="text-neutral-500">{t("transformTab.selectDatasetHint")}</p>
        <p className="text-sm text-neutral-500 mt-2">{t("transformTab.useAiGuidePrefix")} <strong>{t("transformTab.aiGuideTabName")}</strong> {t("transformTab.useAiGuideSuffix")}</p>
      </div>
    );
  }

  // dataRows: dữ liệu gốc (giữ nguyên mã khuyết như 99 để lọc/sắp xếp/recode/đổi tên còn thấy mã).
  // analysisRows: cùng dữ liệu nhưng mã khuyết người dùng khai báo đã thành ô trống — dùng cho mọi phép
  // tính số (log, biến tính toán, z-score/min-max, loại ngoại lai) để mã như 99 không lọt vào trung bình/độ lệch chuẩn.
  const dataRows = getDataRows(selectedDs);
  const analysisRows = getAnalysisRows(selectedDs);
  const cols = selectedDs.columnNames || [];
  const header = dataRows[0] || [];
  const aiContextTransform = `Bộ dữ liệu: ${selectedDs.name}. Số hàng: ${dataRows.length}, số cột: ${cols.length}. Các cột: ${cols.join(", ")}. Công cụ hỗ trợ: bỏ missing, điền mean/median/mode/hot-deck/MICE, chuẩn hóa z-score/min-max, lọc, sắp xếp, recode.`;

  // Điền trung bình/trung vị lên cột không phải scale (thứ bậc/danh định) sẽ tự đổi sang MỐT: báo trước cho người dùng.
  const fillStrategy = transformAction === "fill_mean" ? "mean" : transformAction === "fill_median" ? "median" : null;
  const modeFallbackCols = fillStrategy
    ? getModeFallbackColumns(
        dataRows,
        transformColsMultiple.length > 0 ? transformColsMultiple : transformCol ? [transformCol] : [],
        selectedDs.variables,
        fillStrategy
      )
    : [];
  const strategyLabel = fillStrategy === "median" ? t("transformTab.strategyMedian") : t("transformTab.strategyMean");

  const runPrep = (act: PrepAction): PrepResult => {
    const cols2 = transformColsMultiple;
    if (act === "rename") return renameColumn(dataRows, renameFrom, renameTo);
    if (act === "coerce_numeric") return coerceColumns(dataRows, cols2, "numeric");
    if (act === "coerce_text") return coerceColumns(dataRows, cols2, "text");
    if (act === "compute") return computeVariable(analysisRows, computeName, computeFormula);
    if (act === "log") return logTransform(analysisRows, cols2, logKind);
    if (act === "outlier_iqr") {
      const k = Number(iqrK.replace(",", "."));
      return Number.isFinite(k) && k > 0 ? removeOutliersIQR(analysisRows, cols2, k) : { rows: dataRows, error: "k phải là số dương." };
    }
    return removeDuplicates(dataRows, cols2);
  };

  /** Kiểm tra trước khi hỏi «ghi đè / tạo mới»: lỗi công thức, tên trùng… hiện ngay thay vì sau khi chọn. */
  const requestApply = () => {
    if ((PREP_ACTIONS as string[]).includes(transformAction)) {
      const r = runPrep(transformAction as PrepAction);
      if (r.error) {
        setPrepNote({ ok: false, text: r.error });
        return;
      }
    }
    setPrepNote(null);
    setShowTransformChoiceModal(true);
  };

  const applyTransform = async (overwriteOriginal: boolean) => {
    setShowTransformChoiceModal(false);
    if (dataRows.length < 2) return;
    let newRows: string[][];
    let statsForMice: MiceImputationResponse["statistics"] | undefined = undefined;
    let prepSuffix: string | null = null;
    if ((PREP_ACTIONS as string[]).includes(transformAction)) {
      const act = transformAction as PrepAction;
      const r = runPrep(act);
      if (r.error) {
        setPrepNote({ ok: false, text: r.error });
        return;
      }
      const st = r.stats ?? {};
      const msgKey = { rename: "resultRename", coerce_numeric: "resultCoerce", coerce_text: "resultCoerce", compute: "resultCompute", log: "resultLog", outlier_iqr: "resultOutlier", dedupe: "resultDedupe" }[act];
      setPrepNote({ ok: true, text: tpl(t(`transformTab.${msgKey}`), st) });
      newRows = r.rows;
      prepSuffix = t(`transformTab.${{ rename: "suffixRename", coerce_numeric: "suffixCoerce", coerce_text: "suffixCoerce", compute: "suffixCompute", log: "suffixLog", outlier_iqr: "suffixOutlier", dedupe: "suffixDedupe" }[act]}`);
    } else if (transformAction === "filter") {
      if (!filterCol || header.indexOf(filterCol) === -1) return;
      const ci = header.indexOf(filterCol);
      const val = filterValue.trim();
      const op = filterOp;
      newRows = [header, ...dataRows.slice(1).filter((r) => {
        const cell = (r[ci] ?? "").toString().trim();
        const num = numCell(cell);
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
      } else if (transformAction === "fill_mean" || transformAction === "fill_median") {
        newRows = imputeMeanMedianMode(
          dataRows,
          columnsToApply,
          selectedDs.variables,
          transformAction === "fill_mean" ? "mean" : "median"
        );
        const switched = getModeFallbackColumns(
          dataRows,
          columnsToApply,
          selectedDs.variables,
          transformAction === "fill_mean" ? "mean" : "median"
        );
        setPrepNote(
          switched.length > 0
            ? { ok: true, text: t("transformTab.modeFallbackDone", { cols: switched.join(", "), strategy: strategyLabel }) }
            : null
        );
      } else if (transformAction === "fill_mode") {
        newRows = imputeMeanMedianMode(dataRows, columnsToApply, selectedDs.variables, "mode");
      } else if (transformAction === "fill_hot_deck") {
        const abortCtrl = new AbortController();
        abortControllerRef.current = abortCtrl;
        const opId = ++currentOpIdRef.current;
        const dsId = selectedDs.id;
        setIsHotDeckLoading(true);
        try {
          newRows = await runHotDeckImputation(
            dataRows,
            columnsToApply,
            selectedDs.variables,
            { signal: abortCtrl.signal }
          );
        } catch (err: unknown) {
          if (abortCtrl.signal.aborted) return;
          const msg = err instanceof Error ? err.message : String(err);
          setPrepNote({ ok: false, text: msg });
          return;
        } finally {
          if (abortControllerRef.current === abortCtrl) {
            abortControllerRef.current = null;
            setIsHotDeckLoading(false);
          }
        }
        if (currentOpIdRef.current !== opId || selectedDsRef.current?.id !== dsId) return;
      } else if (transformAction === "fill_mice") {
        setIsMiceLoading(true);
        setMiceError(null);
        try {
          const res = await analyzeMiceImputation(
            dataRows,
            columnsToApply,
            selectedDs.variables,
            clampMiceIterations(miceMaxIter)
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
        const desc = computeDescriptive(analysisRows);
        const numericRows = analysisRows.slice(1).map((r, ri) =>
          r.map((v, ci) => {
            const cell = (v ?? "").trim();
            // Cột không được chuẩn hóa: giữ nguyên giá trị gốc (kể cả mã khuyết) thay vì làm trống.
            return columnsToApply.includes(header[ci]) ? cell : (dataRows[ri + 1]?.[ci] ?? "").trim();
          })
        );
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
      prepSuffix ??
      (transformAction === "filter"
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
        : t("transformTab.suffixDefault"));

    const beforeSnapshot = dataRows.map((r) => [...r]);
    setLastTransformResult({
      before: beforeSnapshot,
      after: newRows,
      actionLabel: suffix,
      stats: statsForMice,
    });

    const newHeader = newRows[0];
    let baseVariables = selectedDs.variables ? { ...selectedDs.variables } : undefined;
    if (baseVariables) {
      if (transformAction === "rename" && renameFrom && renameTo && baseVariables[renameFrom]) {
        baseVariables[renameTo] = {
          ...baseVariables[renameFrom],
          name: renameTo,
        };
        delete baseVariables[renameFrom];
      } else if (transformAction === "coerce_numeric") {
        transformColsMultiple.forEach((col) => {
          if (baseVariables && baseVariables[col]) {
            baseVariables[col] = {
              ...baseVariables[col],
              type: "numeric",
              measure: baseVariables[col].measure === "nominal" ? "scale" : baseVariables[col].measure,
            };
          }
        });
      } else if (transformAction === "coerce_text") {
        transformColsMultiple.forEach((col) => {
          if (baseVariables && baseVariables[col]) {
            baseVariables[col] = {
              ...baseVariables[col],
              type: "string",
              measure: "nominal",
            };
          }
        });
      } else if (transformAction === "compute" && computeName) {
        baseVariables[computeName] = {
          name: computeName,
          type: "numeric",
          measure: "scale",
          label: computeFormula,
          decimals: 2,
          align: "right",
        };
      }
    }

    if (overwriteOriginal) {
      const updatedDs: Dataset = ensureDatasetMetadata({
        ...selectedDs,
        name: `${selectedDs.name}${suffix}`,
        rows: newRows.length - 1,
        columns: newHeader.length,
        columnNames: newHeader,
        preview: newRows.slice(0, 6),
        data: newRows,
        variables: baseVariables,
        updatedAt: now,
      });
      setDatasets((prev) => prev.map((d) => (d.id === selectedDs.id ? updatedDs : d)));
      setShowTransformChoiceModal(false);
    } else {
      const id = generateId();
      const newDs: Dataset = ensureDatasetMetadata({
        id,
        name: `${selectedDs.name}${suffix}`,
        rows: newRows.length - 1,
        columns: newHeader.length,
        columnNames: newHeader,
        preview: newRows.slice(0, 6),
        data: newRows,
        variables: baseVariables,
        sourceFormat: selectedDs.sourceFormat,
        createdAt: now,
        updatedAt: now,
      });
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
        <select value={transformAction} onChange={(e) => setTransformAction(e.target.value as typeof transformAction)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 mb-3">
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
          <option value="rename">{t("transformTab.actionRename")}</option>
          <option value="coerce_numeric">{t("transformTab.actionCoerceNumeric")}</option>
          <option value="coerce_text">{t("transformTab.actionCoerceText")}</option>
          <option value="compute">{t("transformTab.actionCompute")}</option>
          <option value="log">{t("transformTab.actionLog")}</option>
          <option value="outlier_iqr">{t("transformTab.actionOutlierIqr")}</option>
          <option value="dedupe">{t("transformTab.actionDedupe")}</option>
        </select>
        {transformAction === "z_score" && <InfoHint term="zScore" className="mb-3" />}
        {transformAction === "outlier_iqr" && <InfoHint term="iqr" className="mb-3" />}
      </div>
      {transformAction === "rename" && (
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.renameFrom")}</label>
            <select value={renameFrom} onChange={(e) => setRenameFrom(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.renameTo")}</label>
            <input type="text" value={renameTo} onChange={(e) => setRenameTo(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2" />
          </div>
        </div>
      )}
      {transformAction === "compute" && (
        <div className="mb-3 space-y-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.computeName")}</label>
            <input type="text" value={computeName} onChange={(e) => setComputeName(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-full max-w-md" />
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.computeFormula")}</label>
            <input type="text" value={computeFormula} onChange={(e) => setComputeFormula(e.target.value)} placeholder="([x1] + [x2]) / 2" className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-full max-w-xl font-mono text-sm" />
            <p className="text-xs text-neutral-500 mt-1 max-w-xl">{t("transformTab.computeHint")}</p>
            <div className="flex flex-wrap gap-1 mt-2">
              {cols.map((c) => (
                <button key={c} type="button" onClick={() => setComputeFormula((f) => `${f}${f && !/[\s(]$/.test(f) ? " " : ""}[${c}]`)} className="rounded border border-neutral-300 dark:border-neutral-600 px-2 py-0.5 text-xs hover:bg-neutral-100 dark:hover:bg-neutral-700">{c}</button>
              ))}
            </div>
          </div>
        </div>
      )}
      {transformAction === "log" && (
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">{t("transformTab.logKind")}</label>
          <select value={logKind} onChange={(e) => setLogKind(e.target.value as LogKind)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
            <option value="ln">{t("transformTab.logLn")}</option>
            <option value="log10">{t("transformTab.logLog10")}</option>
            <option value="log1p">{t("transformTab.logLog1p")}</option>
          </select>
        </div>
      )}
      {transformAction === "outlier_iqr" && (
        <div className="mb-3">
          <label className="block text-sm font-medium mb-1">{t("transformTab.iqrK")}</label>
          <input type="text" inputMode="decimal" value={iqrK} onChange={(e) => setIqrK(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 w-24" />
        </div>
      )}
      {transformAction === "dedupe" && <p className="text-sm text-neutral-500 mb-2">{t("transformTab.dedupeHint")}</p>}
      {(["drop_missing", "fill_mean", "fill_median", "fill_mode", "fill_hot_deck", "fill_mice", "z_score", "min_max", "coerce_numeric", "coerce_text", "log", "outlier_iqr", "dedupe"].includes(transformAction)) && (
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
      {modeFallbackCols.length > 0 && (
        <p role="status" className="mb-3 text-sm text-amber-700 dark:text-amber-400 max-w-2xl">
          {t("transformTab.modeFallbackHint", { cols: modeFallbackCols.join(", "), strategy: strategyLabel })}
        </p>
      )}
      {transformAction === "fill_mice" && (
        <div className="flex flex-wrap gap-4 items-center mb-4 p-3 rounded-lg border border-sky-200 dark:border-sky-800 bg-sky-50/50 dark:bg-sky-950/20">
          <div>
            <label className="block text-xs font-semibold uppercase tracking-wider text-sky-900 dark:text-sky-200 mb-1">
              {t("transformTab.mice.maxIterLabel")}
            </label>
            <input
              type="number"
              min={MICE_MIN_ITER}
              max={MICE_MAX_ITER}
              value={miceMaxIter}
              onChange={(e) => setMiceMaxIter(clampMiceIterations(parseInt(e.target.value, 10), 10))}
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
            <select value={filterCol} onChange={(e) => setFilterCol(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.conditionLabel")}</label>
            <select value={filterOp} onChange={(e) => setFilterOp(e.target.value as typeof filterOp)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
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
            <input type="text" value={filterValue} onChange={(e) => setFilterValue(e.target.value)} placeholder={t("transformTab.valuePlaceholder")} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2" />
          </div>
        </div>
      )}
      {transformAction === "sort" && (
        <div className="flex flex-wrap gap-4 items-end mb-3">
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.sortByColumnLabel")}</label>
            <select value={sortCol} onChange={(e) => setSortCol(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <div>
            <label className="block text-sm font-medium mb-1">{t("transformTab.orderLabel")}</label>
            <select value={sortOrder} onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
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
            <select value={recodeCol} onChange={(e) => setRecodeCol(e.target.value)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2">
              <option value="">{t("transformTab.selectPlaceholder")}</option>
              {cols.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          <p className="text-sm text-neutral-500 mb-2">{t("transformTab.recodeRuleHint")}</p>
          {recodeRules.map((r, i) => (
            <div key={i} className="flex gap-2 items-center mb-2">
              <input type="text" value={r.from} onChange={(e) => setRecodeRule(i, "from", e.target.value)} placeholder={t("transformTab.oldValuePlaceholder")} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-32" />
              <span className="text-neutral-500" aria-hidden="true">→</span>
              <input type="text" value={r.to} onChange={(e) => setRecodeRule(i, "to", e.target.value)} placeholder={t("transformTab.newValuePlaceholder")} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm w-32" />
            </div>
          ))}
          <button type="button" onClick={addRecodeRule} className="text-sm text-brand hover:underline">{t("transformTab.addRuleButton")}</button>
        </div>
      )}
      <button
        type="button"
        onClick={requestApply}
        disabled={
          isMiceLoading ||
          isHotDeckLoading ||
          (["drop_missing", "fill_mean", "fill_median", "fill_mode", "fill_hot_deck", "fill_mice", "z_score", "min_max", "coerce_numeric", "coerce_text", "log", "outlier_iqr"].includes(transformAction) &&
            transformColsMultiple.length === 0) ||
          (transformAction === "rename" && (!renameFrom || !renameTo.trim())) ||
          (transformAction === "compute" && (!computeName.trim() || !computeFormula.trim()))
        }
        className="rounded-md bg-brand text-white px-4 py-2 hover:opacity-90 disabled:opacity-50"
      >
        {isMiceLoading || isHotDeckLoading ? (
          <span className="flex items-center gap-2">
            <Loader2 className="w-4 h-4 animate-spin" />
            {t("transformTab.processing")}
          </span>
        ) : (
          t("transformTab.applyButton")
        )}
      </button>
      {isHotDeckLoading && (
        <HotDeckLoadingBanner onCancel={() => abortControllerRef.current?.abort()} />
      )}
      {prepNote && (
        <p role="status" className={`mt-3 text-sm ${prepNote.ok ? "text-emerald-700 dark:text-emerald-400" : "text-red-600 dark:text-red-400"}`}>{prepNote.text}</p>
      )}
      {showTransformChoiceModal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50" onClick={() => setShowTransformChoiceModal(false)}>
          <div className="bg-white dark:bg-neutral-800 rounded-lg shadow-lg max-w-md w-full flex flex-col overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
              <h3 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100">{t("transformTab.modalTitle")}</h3>
              <button type="button" onClick={() => setShowTransformChoiceModal(false)} className="p-2 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700" aria-label={t("transformTab.closeAriaLabel")}>
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="p-5 space-y-4">
              <p className="text-neutral-600 dark:text-neutral-400">{t("transformTab.modalQuestion")}</p>
              <div className="flex flex-col gap-2">
                <button type="button" onClick={() => applyTransform(true)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 px-4 py-2.5 text-left font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600">
                  {t("transformTab.overwriteOriginalButton")}
                </button>
                <button type="button" onClick={() => applyTransform(false)} className="rounded-md border border-neutral-300 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-700 px-4 py-2.5 text-left font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-600">
                  {t("transformTab.createNewButton")}
                </button>
                <button type="button" onClick={() => setShowTransformChoiceModal(false)} className="rounded-md px-4 py-2.5 text-sm font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700">
                  {t("transformTab.cancelButton")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
      {lastTransformResult && (
        <div className="mt-6 space-y-4 rounded-lg border border-neutral-200 dark:border-neutral-600 bg-neutral-50/50 dark:bg-neutral-800/50 p-4">
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
