import { useState, useEffect, useRef, useMemo, type Dispatch, type SetStateAction } from "react";
import {
  X,
  Loader2,
  Trash2,
  Calculator,
  SlidersHorizontal,
  Hash,
  Sparkles,
  Layers,
  Maximize2,
  Sigma,
  Filter,
  ArrowUpDown,
  AlertTriangle,
  Copy,
  FileSpreadsheet,
  Shuffle,
  Type,
  Binary,
  Edit3,
  Search,
  CheckSquare,
  Square,
  Plus,
  ArrowRight,
  CheckCircle2,
  Info,
} from "lucide-react";
import type { Dataset, RubinColumnStatistic, ImputationSparseCell, ImputationMeta, VariableMetadata } from "@/types";
import { numCell, getDataRows, getAnalysisRows, computeDescriptive } from "@/utils/stats";
import { generateId } from "@/utils/helpers";
import { t, aiAnswerLangHint } from "@/i18n";
import { useUIStore } from "@/stores";
import { AIAssistPanel } from "@/features/ai";
import { InfoHint } from "@/components/common/InfoHint";
import {
  imputeListwise,
  imputeMeanMedianMode,
  getModeFallbackColumns,
} from "@/utils/missing-imputation";
import {
  analyzeMiceImputation,
  clampMiceIterations,
  clampMiceM,
  MICE_MIN_ITER,
  MICE_MAX_ITER,
  MICE_MIN_M,
  MICE_MAX_M,
  type MiceImputationResponse,
} from "@/api";
import { ensureDatasetMetadata, isMissingValue } from "@/utils/metadata";
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
export type TransformAction =
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

export type TransformCategory = "missing" | "scale" | "clean" | "variables";

interface ActionDefinition {
  id: TransformAction;
  category: TransformCategory;
  titleKey: string;
  shortTitleKey: string;
  descKey: string;
  badge: string;
  icon: React.ComponentType<{ className?: string }>;
  needsColumns: boolean;
  keywords: string[];
}

const ACTION_DEFINITIONS: ActionDefinition[] = [
  // 1. Missing Data
  {
    id: "drop_missing",
    category: "missing",
    titleKey: "transformTab.actionDropMissing",
    shortTitleKey: "transformTab.shortActionDropMissing",
    descKey: "transformTab.actionDropMissingDesc",
    badge: "Listwise",
    icon: Trash2,
    needsColumns: true,
    keywords: ["drop", "remove", "missing", "xóa", "khuyết", "null", "empty", "listwise"],
  },
  {
    id: "fill_mean",
    category: "missing",
    titleKey: "transformTab.actionFillMean",
    shortTitleKey: "transformTab.shortActionFillMean",
    descKey: "transformTab.actionFillMeanDesc",
    badge: "Mean",
    icon: Calculator,
    needsColumns: true,
    keywords: ["mean", "average", "trung bình", "missing", "điền"],
  },
  {
    id: "fill_median",
    category: "missing",
    titleKey: "transformTab.actionFillMedian",
    shortTitleKey: "transformTab.shortActionFillMedian",
    descKey: "transformTab.actionFillMedianDesc",
    badge: "Median",
    icon: SlidersHorizontal,
    needsColumns: true,
    keywords: ["median", "trung vị", "missing", "điền", "robust"],
  },
  {
    id: "fill_mode",
    category: "missing",
    titleKey: "transformTab.actionFillMode",
    shortTitleKey: "transformTab.shortActionFillMode",
    descKey: "transformTab.actionFillModeDesc",
    badge: "Mode",
    icon: Hash,
    needsColumns: true,
    keywords: ["mode", "yếu vị", "phổ biến", "missing", "categorical"],
  },
  {
    id: "fill_hot_deck",
    category: "missing",
    titleKey: "transformTab.actionFillHotDeck",
    shortTitleKey: "transformTab.shortActionFillHotDeck",
    descKey: "transformTab.actionFillHotDeckDesc",
    badge: "KNN",
    icon: Sparkles,
    needsColumns: true,
    keywords: ["hot deck", "knn", "lân cận", "donor", "tương đồng", "worker"],
  },
  {
    id: "fill_mice",
    category: "missing",
    titleKey: "transformTab.actionFillMice",
    shortTitleKey: "transformTab.shortActionFillMice",
    descKey: "transformTab.actionFillMiceDesc",
    badge: "MICE",
    icon: Layers,
    needsColumns: true,
    keywords: ["mice", "multiple imputation", "rubin", "đa biến", "nội suy", "python"],
  },

  // 2. Scale & Normalize
  {
    id: "z_score",
    category: "scale",
    titleKey: "transformTab.actionZScore",
    shortTitleKey: "transformTab.shortActionZScore",
    descKey: "transformTab.actionZScoreDesc",
    badge: "Z-Score",
    icon: SlidersHorizontal,
    needsColumns: true,
    keywords: ["z-score", "standardize", "chuẩn hóa", "mean=0", "std=1"],
  },
  {
    id: "min_max",
    category: "scale",
    titleKey: "transformTab.actionMinMax",
    shortTitleKey: "transformTab.shortActionMinMax",
    descKey: "transformTab.actionMinMaxDesc",
    badge: "Min-Max",
    icon: Maximize2,
    needsColumns: true,
    keywords: ["min-max", "scaling", "tỷ lệ", "0-1", "normalize"],
  },
  {
    id: "log",
    category: "scale",
    titleKey: "transformTab.actionLog",
    shortTitleKey: "transformTab.shortActionLog",
    descKey: "transformTab.actionLogDesc",
    badge: "Log",
    icon: Sigma,
    needsColumns: true,
    keywords: ["log", "ln", "log10", "log1p", "biến đổi", "skew"],
  },

  // 3. Filter & Clean
  {
    id: "filter",
    category: "clean",
    titleKey: "transformTab.actionFilter",
    shortTitleKey: "transformTab.shortActionFilter",
    descKey: "transformTab.actionFilterDesc",
    badge: "Filter",
    icon: Filter,
    needsColumns: false,
    keywords: ["filter", "lọc", "điều kiện", "subset", "rows"],
  },
  {
    id: "outlier_iqr",
    category: "clean",
    titleKey: "transformTab.actionOutlierIqr",
    shortTitleKey: "transformTab.shortActionOutlierIqr",
    descKey: "transformTab.actionOutlierIqrDesc",
    badge: "IQR",
    icon: AlertTriangle,
    needsColumns: true,
    keywords: ["outlier", "iqr", "ngoại lai", "tukey", "fence"],
  },
  {
    id: "dedupe",
    category: "clean",
    titleKey: "transformTab.actionDedupe",
    shortTitleKey: "transformTab.shortActionDedupe",
    descKey: "transformTab.actionDedupeDesc",
    badge: "Dedupe",
    icon: Copy,
    needsColumns: true,
    keywords: ["dedupe", "duplicate", "trùng lặp", "xóa trùng", "unique"],
  },
  {
    id: "sort",
    category: "clean",
    titleKey: "transformTab.actionSort",
    shortTitleKey: "transformTab.shortActionSort",
    descKey: "transformTab.actionSortDesc",
    badge: "Sort",
    icon: ArrowUpDown,
    needsColumns: false,
    keywords: ["sort", "sắp xếp", "order", "asc", "desc"],
  },

  // 4. Variables & Recode
  {
    id: "compute",
    category: "variables",
    titleKey: "transformTab.actionCompute",
    shortTitleKey: "transformTab.shortActionCompute",
    descKey: "transformTab.actionComputeDesc",
    badge: "Formula",
    icon: FileSpreadsheet,
    needsColumns: false,
    keywords: ["compute", "tính", "công thức", "formula", "biến mới", "math"],
  },
  {
    id: "recode",
    category: "variables",
    titleKey: "transformTab.actionRecode",
    shortTitleKey: "transformTab.shortActionRecode",
    descKey: "transformTab.actionRecodeDesc",
    badge: "Recode",
    icon: Shuffle,
    needsColumns: false,
    keywords: ["recode", "gán lại", "mapping", "thay thế", "mã"],
  },
  {
    id: "rename",
    category: "variables",
    titleKey: "transformTab.actionRename",
    shortTitleKey: "transformTab.shortActionRename",
    descKey: "transformTab.actionRenameDesc",
    badge: "Rename",
    icon: Edit3,
    needsColumns: false,
    keywords: ["rename", "đổi tên", "cột", "column", "variable"],
  },
  {
    id: "coerce_numeric",
    category: "variables",
    titleKey: "transformTab.actionCoerceNumeric",
    shortTitleKey: "transformTab.shortActionCoerceNumeric",
    descKey: "transformTab.actionCoerceNumericDesc",
    badge: "Numeric",
    icon: Binary,
    needsColumns: true,
    keywords: ["coerce", "number", "số", "chuyển kiểu", "numeric"],
  },
  {
    id: "coerce_text",
    category: "variables",
    titleKey: "transformTab.actionCoerceText",
    shortTitleKey: "transformTab.shortActionCoerceText",
    descKey: "transformTab.actionCoerceTextDesc",
    badge: "Text",
    icon: Type,
    needsColumns: true,
    keywords: ["coerce", "text", "chữ", "chuỗi", "trim", "string"],
  },
];

const CATEGORIES: {
  id: TransformCategory;
  titleKey: string;
  tabKey: string;
  icon: React.ComponentType<{ className?: string }>;
}[] = [
  { id: "missing", titleKey: "transformTab.categoryMissing", tabKey: "transformTab.tabMissing", icon: Trash2 },
  { id: "scale", titleKey: "transformTab.categoryScale", tabKey: "transformTab.tabScale", icon: SlidersHorizontal },
  { id: "clean", titleKey: "transformTab.categoryClean", tabKey: "transformTab.tabClean", icon: Filter },
  { id: "variables", titleKey: "transformTab.categoryVariables", tabKey: "transformTab.tabVariables", icon: FileSpreadsheet },
];

const getCategoryForAction = (act: TransformAction): TransformCategory => {
  if (["drop_missing", "fill_mean", "fill_median", "fill_mode", "fill_hot_deck", "fill_mice"].includes(act)) {
    return "missing";
  }
  if (["z_score", "min_max", "log"].includes(act)) {
    return "scale";
  }
  if (["filter", "sort", "outlier_iqr", "dedupe"].includes(act)) {
    return "clean";
  }
  return "variables";
};

const tpl = (s: string, vars: Record<string, string | number>) =>
  Object.entries(vars).reduce((acc, [k, v]) => acc.split(`{${k}}`).join(String(v)), s);

/** Spinner and cancel control shown while hot-deck runs off the main thread. */
export function HotDeckLoadingBanner({ onCancel }: { onCancel: () => void }) {
  return (
    <div
      role="status"
      className="flex items-center gap-2.5 rounded-md border border-sky-200 bg-sky-50 px-3 py-2 text-xs sm:text-sm text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-200"
    >
      <Loader2 className="h-4 w-4 animate-spin shrink-0 motion-reduce:animate-none" aria-hidden="true" />
      <span className="flex-1">{t("transformTab.hotDeck.loading")}</span>
      <button
        type="button"
        onClick={onCancel}
        className="rounded-md border border-sky-300 dark:border-sky-700 px-2 py-0.5 text-xs font-medium hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors"
      >
        {t("transformTab.cancelButton")}
      </button>
    </div>
  );
}

/**
 * Chuyển đổi m bảng dữ liệu đã điền (imputedDatasets) thành cấu trúc Sparse Delta sparsePatches.
 * Chỉ lưu các ô ban đầu bị khuyết (hoặc khớp mã khuyết người dùng khai báo).
 */
export function convertSparsePatches(
  originalRows: string[][],
  imputedDatasets: string[][][],
  imputedColumns: string[],
  variables?: Record<string, VariableMetadata>
): Record<string, ImputationSparseCell[]> {
  const sparsePatches: Record<string, ImputationSparseCell[]> = {};
  if (!originalRows || originalRows.length <= 1 || !imputedDatasets || imputedDatasets.length === 0) {
    return sparsePatches;
  }
  const header = originalRows[0];
  const m = imputedDatasets.length;

  for (const colName of imputedColumns) {
    const colIdx = header.indexOf(colName);
    if (colIdx === -1) continue;
    const meta = variables?.[colName];
    const patches: ImputationSparseCell[] = [];

    for (let r = 1; r < originalRows.length; r++) {
      const origVal = originalRows[r][colIdx];
      if (isMissingValue(origVal, meta)) {
        const values: string[] = [];
        for (let i = 0; i < m; i++) {
          values.push(imputedDatasets[i]?.[r]?.[colIdx] ?? "");
        }
        patches.push({
          rowIndex: r - 1,
          values,
        });
      }
    }
    sparsePatches[colName] = patches;
  }

  return sparsePatches;
}

export interface TransformTabProps {
  selectedDs: Dataset | null;
  setDatasets: Dispatch<SetStateAction<Dataset[]>>;
  onSelectDataset: (id: string | null) => void;
  onWorkflowDatasetAdd?: (id: string) => void;
  initialShowChoiceModal?: boolean;
  initialColsMultiple?: string[];
  initialAction?: TransformAction;
  initialMiceM?: number;
  initialMiceMaxIter?: number;
  initialIsMiceLoading?: boolean;
  initialReplaceConfirm?: boolean;
  initialInvalidateConfirm?: boolean;
  initialLastTransformResult?: {
    before: string[][];
    after: string[][];
    actionLabel: string;
    stats?: MiceImputationResponse["statistics"];
    rubinStats?: RubinColumnStatistic[];
  } | null;
}

export function TransformTab({
  selectedDs,
  setDatasets,
  onSelectDataset,
  onWorkflowDatasetAdd,
  initialShowChoiceModal = false,
  initialColsMultiple = [],
  initialAction,
  initialMiceM,
  initialMiceMaxIter,
  initialIsMiceLoading = false,
  initialReplaceConfirm = false,
  initialInvalidateConfirm = false,
  initialLastTransformResult,
}: TransformTabProps) {
  const [transformCol] = useState("");
  const [transformColsMultiple, setTransformColsMultiple] = useState<string[]>(initialColsMultiple);
  const [transformAction, setTransformAction] = useState<TransformAction>(initialAction ?? "drop_missing");
  const [activeCategory, setActiveCategory] = useState<TransformCategory>(() =>
    getCategoryForAction(initialAction ?? "drop_missing")
  );

  const tabRefs = useRef<(HTMLButtonElement | null)[]>([]);

  useEffect(() => {
    const cat = getCategoryForAction(transformAction);
    setActiveCategory(cat);
  }, [transformAction]);

  const handleCategoryClick = (catId: TransformCategory) => {
    setActiveCategory(catId);
    const catActions = ACTION_DEFINITIONS.filter((a) => a.category === catId);
    if (!catActions.some((a) => a.id === transformAction) && catActions.length > 0) {
      setTransformAction(catActions[0].id);
    }
  };

  const handleTabKeyDown = (e: React.KeyboardEvent<HTMLDivElement>) => {
    const currentIndex = CATEGORIES.findIndex((c) => c.id === activeCategory);
    if (currentIndex === -1) return;

    let nextIndex = -1;
    if (e.key === "ArrowRight" || e.key === "ArrowDown") {
      e.preventDefault();
      nextIndex = (currentIndex + 1) % CATEGORIES.length;
    } else if (e.key === "ArrowLeft" || e.key === "ArrowUp") {
      e.preventDefault();
      nextIndex = (currentIndex - 1 + CATEGORIES.length) % CATEGORIES.length;
    } else if (e.key === "Home") {
      e.preventDefault();
      nextIndex = 0;
    } else if (e.key === "End") {
      e.preventDefault();
      nextIndex = CATEGORIES.length - 1;
    }

    if (nextIndex !== -1) {
      const nextCat = CATEGORIES[nextIndex];
      handleCategoryClick(nextCat.id);
      tabRefs.current[nextIndex]?.focus();
    }
  };

  const visibleActions = useMemo(
    () => ACTION_DEFINITIONS.filter((a) => a.category === activeCategory),
    [activeCategory]
  );
  const [colSearchQuery, setColSearchQuery] = useState("");

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
  const [miceM, setMiceM] = useState<number>(clampMiceM(initialMiceM, 5));
  const [miceMaxIter, setMiceMaxIter] = useState<number>(clampMiceIterations(initialMiceMaxIter, 10));
  const [isMiceLoading, setIsMiceLoading] = useState<boolean>(initialIsMiceLoading);
  const [miceError, setMiceError] = useState<string | null>(null);
  const [replaceConfirm, setReplaceConfirm] = useState<null | (() => void)>(
    initialReplaceConfirm ? () => () => {} : null
  );
  const [invalidateConfirm, setInvalidateConfirm] = useState<null | (() => void)>(
    initialInvalidateConfirm ? () => () => {} : null
  );
  const [showTransformChoiceModal, setShowTransformChoiceModal] = useState(initialShowChoiceModal);
  const [lastTransformResult, setLastTransformResult] = useState<{
    before: string[][];
    after: string[][];
    actionLabel: string;
    stats?: MiceImputationResponse["statistics"];
    rubinStats?: RubinColumnStatistic[];
  } | null>(initialLastTransformResult ?? null);
  const [isHotDeckLoading, setIsHotDeckLoading] = useState(false);
  const [previewTab, setPreviewTab] = useState<"sideBySide" | "before" | "after">("sideBySide");

  const selectedDsRef = useRef(selectedDs);
  selectedDsRef.current = selectedDs;
  const currentOpIdRef = useRef(0);
  const abortControllerRef = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => {
      abortControllerRef.current?.abort();
    };
  }, [selectedDs?.id]);

  useEffect(() => {
    if (!showTransformChoiceModal && !replaceConfirm && !invalidateConfirm) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        if (invalidateConfirm) {
          setInvalidateConfirm(null);
        } else if (replaceConfirm) {
          setReplaceConfirm(null);
        } else if (showTransformChoiceModal) {
          setShowTransformChoiceModal(false);
        }
      }
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [showTransformChoiceModal, replaceConfirm, invalidateConfirm]);

  if (!selectedDs) {
    return (
      <div className="w-full max-w-full p-6 text-center">
        <h2 className="text-lg font-semibold mb-2 text-neutral-800 dark:text-neutral-200">
          {t("transformTab.noDatasetTitle")}
        </h2>
        <p className="text-sm text-neutral-500 dark:text-neutral-400">
          {t("transformTab.selectDatasetHint")}
        </p>
        <p className="text-xs text-neutral-400 mt-2">
          {t("transformTab.useAiGuidePrefix")}{" "}
          <strong className="text-neutral-600 dark:text-neutral-300">{t("transformTab.aiGuideTabName")}</strong>{" "}
          {t("transformTab.useAiGuideSuffix")}
        </p>
      </div>
    );
  }

  const dataRows = getDataRows(selectedDs);
  const analysisRows = getAnalysisRows(selectedDs);
  const cols = selectedDs.columnNames || [];
  const header = dataRows[0] || [];
  const hasFullData =
    Array.isArray(selectedDs.data) &&
    selectedDs.data.length > 0 &&
    selectedDs.data[0]?.[0] === selectedDs.columnNames?.[0] &&
    selectedDs.data.length >= (selectedDs.rows ?? 0);
  const aiContextTransform = `Bộ dữ liệu: ${selectedDs.name}. Số hàng: ${dataRows.length}, số cột: ${cols.length}. Các cột: ${cols.join(", ")}. Công cụ hỗ trợ: bỏ missing, điền mean/median/mode/hot-deck/MICE, chuẩn hóa z-score/min-max, lọc, sắp xếp, recode.`;

  // Numeric column check
  const numericCols = useMemo(() => {
    return cols.filter((c) => {
      const meta = selectedDs.variables?.[c];
      return meta ? meta.type === "numeric" : true;
    });
  }, [cols, selectedDs.variables]);

  // Missing values count per column
  const missingCountsPerCol = useMemo(() => {
    const counts: Record<string, number> = {};
    for (const c of cols) {
      const ci = header.indexOf(c);
      if (ci === -1) continue;
      let cnt = 0;
      const meta = selectedDs.variables?.[c];
      for (let r = 1; r < dataRows.length; r++) {
        const val = dataRows[r][ci];
        if (isMissingValue(val, meta)) cnt++;
      }
      counts[c] = cnt;
    }
    return counts;
  }, [cols, header, dataRows, selectedDs.variables]);

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

  const requestApply = () => {
    if ((PREP_ACTIONS as string[]).includes(transformAction)) {
      const r = runPrep(transformAction as PrepAction);
      if (r.error) {
        setPrepNote({ ok: false, text: r.error });
        return;
      }
    }
    if (transformAction === "fill_mice") {
      const columnsToApply = transformColsMultiple.length > 0 ? transformColsMultiple : (transformCol ? [transformCol] : []);
      let missingCount = 0;
      for (let ri = 1; ri < dataRows.length; ri++) {
        const r = dataRows[ri];
        for (const c of columnsToApply) {
          const ci = header.indexOf(c);
          if (ci !== -1) {
            const val = r[ci];
            if (val === "" || val === null || val === undefined || isMissingValue(val, selectedDs.variables?.[c])) {
              missingCount++;
            }
          }
        }
      }
      if (missingCount === 0) {
        useUIStore.getState().showToast(t("transformTab.mice.noMissing"));
        return;
      }
    }
    setPrepNote(null);
    setShowTransformChoiceModal(true);
  };

  const applyTransform = async (overwriteOriginal: boolean, invalidateBundle = false) => {
    setShowTransformChoiceModal(false);
    if (dataRows.length < 2) return;
    let newRows: string[][];
    let statsForMice: MiceImputationResponse["statistics"] | undefined = undefined;
    let rubinStatsForMice: RubinColumnStatistic[] | undefined = undefined;
    let imputationMetaForMice: ImputationMeta | undefined = undefined;
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
        const abortCtrl = new AbortController();
        abortControllerRef.current = abortCtrl;
        const opId = ++currentOpIdRef.current;
        const dsId = selectedDs.id;
        setIsMiceLoading(true);
        setMiceError(null);
        try {
          const res = await analyzeMiceImputation(
            dataRows,
            columnsToApply,
            selectedDs.variables,
            clampMiceIterations(miceMaxIter),
            clampMiceM(miceM),
            abortCtrl.signal
          );
          if (abortCtrl.signal.aborted || currentOpIdRef.current !== opId || selectedDsRef.current?.id !== dsId) {
            return;
          }
          if (!res || !res.rows) {
            throw new Error(t("transformTab.mice.errEmptyResponse"));
          }
          newRows = res.rows;
          if (res.statistics) {
            statsForMice = res.statistics;
          }
          if (res.rubinStatistics) {
            rubinStatsForMice = res.rubinStatistics;
          }
          if (res.imputedDatasets && res.imputedDatasets.length > 0) {
            const mCount = res.m ?? res.imputedDatasets.length;
            const patches = convertSparsePatches(
              dataRows,
              res.imputedDatasets,
              res.imputedColumns || columnsToApply,
              selectedDs.variables
            );
            const bundleId =
              typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
                ? crypto.randomUUID()
                : generateId();
            imputationMetaForMice = {
              bundleId,
              m: mCount,
              activeImputationIndex: 1,
              imputedColumns: res.imputedColumns || columnsToApply,
              rubinStatistics: res.rubinStatistics,
              sparsePatches: patches,
              originalRows: dataRows,
            };
          }
        } catch (err: unknown) {
          if (abortCtrl.signal.aborted || (err as any)?.name === "AbortError") {
            return;
          }
          const msg = err instanceof Error ? err.message : String(err);
          setMiceError(msg || t("transformTab.mice.errFailed"));
          return;
        } finally {
          if (abortControllerRef.current === abortCtrl) {
            abortControllerRef.current = null;
            setIsMiceLoading(false);
          }
        }
      } else if (transformAction === "z_score" || transformAction === "min_max") {
        const desc = computeDescriptive(analysisRows);
        const numericRows = analysisRows.slice(1).map((r, ri) =>
          r.map((v, ci) => {
            const cell = (v ?? "").trim();
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
        ? ` (MICE m=${clampMiceM(miceM)})`
        : t("transformTab.suffixDefault"));

    const beforeSnapshot = dataRows.map((r) => [...r]);
    setLastTransformResult({
      before: beforeSnapshot,
      after: newRows,
      actionLabel: suffix,
      stats: statsForMice,
      rubinStats: rubinStatsForMice,
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
        readOnly: transformAction === "fill_mice" ? true : (invalidateBundle ? false : selectedDs.readOnly),
        imputationMeta:
          transformAction === "fill_mice" && imputationMetaForMice
            ? imputationMetaForMice
            : (invalidateBundle ? undefined : selectedDs.imputationMeta),
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
        readOnly: transformAction === "fill_mice" ? true : undefined,
        imputationMeta: transformAction === "fill_mice" ? imputationMetaForMice : undefined,
      });
      setDatasets((prev) => [...prev, newDs]);
      onSelectDataset(id);
      onWorkflowDatasetAdd?.(id);
      setShowTransformChoiceModal(false);
    }
  };

  const addRecodeRule = () => setRecodeRules((prev) => [...prev, { from: "", to: "" }]);
  const setRecodeRule = (i: number, field: "from" | "to", value: string) =>
    setRecodeRules((prev) => prev.map((r, j) => (j === i ? { ...r, [field]: value } : r)));
  const removeRecodeRule = (i: number) =>
    setRecodeRules((prev) => (prev.length > 1 ? prev.filter((_, j) => j !== i) : [{ from: "", to: "" }]));

  const currentActionMeta = ACTION_DEFINITIONS.find((a) => a.id === transformAction) ?? ACTION_DEFINITIONS[0];
  const CurrentIcon = currentActionMeta.icon;

  const filteredCols = useMemo(() => {
    if (!colSearchQuery.trim()) return cols;
    const q = colSearchQuery.toLowerCase().trim();
    return cols.filter((c) => c.toLowerCase().includes(q));
  }, [cols, colSearchQuery]);

  const usesMultiColumns = [
    "drop_missing",
    "fill_mean",
    "fill_median",
    "fill_mode",
    "fill_hot_deck",
    "fill_mice",
    "z_score",
    "min_max",
    "coerce_numeric",
    "coerce_text",
    "log",
    "outlier_iqr",
    "dedupe",
  ].includes(transformAction);

  const isApplyDisabled =
    isMiceLoading ||
    isHotDeckLoading ||
    (transformAction === "fill_mice" && !hasFullData) ||
    ([
      "drop_missing",
      "fill_mean",
      "fill_median",
      "fill_mode",
      "fill_hot_deck",
      "fill_mice",
      "z_score",
      "min_max",
      "coerce_numeric",
      "coerce_text",
      "log",
      "outlier_iqr",
    ].includes(transformAction) &&
      transformColsMultiple.length === 0) ||
    (transformAction === "rename" && (!renameFrom || !renameTo.trim())) ||
    (transformAction === "compute" && (!computeName.trim() || !computeFormula.trim()));

  const renderActionRow = (act: ActionDefinition) => {
    const isSelected = transformAction === act.id;
    const Icon = act.icon;
    const shortTitle = t(act.shortTitleKey || act.titleKey);
    const fullTitle = t(act.titleKey);

    return (
      <button
        key={act.id}
        type="button"
        value={act.id}
        onClick={() => {
          setTransformAction(act.id);
        }}
        title={fullTitle}
        className={`group w-full text-left px-2.5 py-2 rounded-md flex items-center justify-between gap-2 transition-all cursor-pointer select-none text-xs focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-1 dark:focus-visible:ring-offset-neutral-900 ${
          isSelected
            ? "bg-brand/10 text-brand font-semibold ring-1 ring-brand/30 dark:bg-brand/20 dark:text-brand-300 dark:ring-brand/40 shadow-2xs"
            : "text-neutral-700 dark:text-neutral-300 hover:text-neutral-900 dark:hover:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-800/60"
        }`}
      >
        <div className="flex items-center gap-2 min-w-0">
          <Icon
            aria-hidden="true"
            className={`w-4 h-4 shrink-0 transition-colors ${
              isSelected
                ? "text-brand dark:text-brand-400"
                : "text-neutral-400 dark:text-neutral-500 group-hover:text-neutral-600 dark:group-hover:text-neutral-300"
            }`}
          />
          <span className="truncate text-xs font-medium">{shortTitle}</span>
        </div>
        <span
          className={`font-mono text-[10px] px-1.5 py-0.5 rounded shrink-0 transition-colors ${
            isSelected
              ? "bg-brand/15 text-brand font-semibold dark:bg-brand/25 dark:text-brand-200"
              : "bg-neutral-100 text-neutral-500 dark:bg-neutral-800 dark:text-neutral-400 group-hover:bg-neutral-200/70 dark:group-hover:bg-neutral-700/60"
          }`}
        >
          {act.badge}
        </span>
      </button>
    );
  };

  return (
    <div className="w-full max-w-full space-y-4">
      {/* Top Header bar with clean typography & AI guide button */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
        <div>
          <h2 className="text-lg font-semibold text-neutral-900 dark:text-neutral-100 mb-1">
            {t("transformTab.pipelineTitle")}
          </h2>
          <p className="text-xs text-neutral-500 dark:text-neutral-400">
            {t("transformTab.description")}
          </p>
        </div>
        <div className="shrink-0">
          <AIAssistPanel
            context={aiContextTransform}
            quickPrompts={[
              {
                label: t("transformTab.aiPromptGuideLabel"),
                systemHint: `Bạn là chuyên gia tiền xử lý dữ liệu. Dựa trên cấu trúc và mô tả bộ dữ liệu, gợi ý ngắn gọn: xử lý missing (bỏ/điền mean/median/mode), lọc theo điều kiện, chuẩn hóa (z-score, min-max), sắp xếp, recode biến. Chỉ nêu các bước phù hợp. ${aiAnswerLangHint("Trả lời bằng tiếng Việt.", "Answer in English.")}`,
              },
            ]}
            title={t("transformTab.aiAssistTitle")}
          />
        </div>
      </div>

      {/* Accessible native select (preserves test suite queries like getByRole('combobox') or value="drop_missing") */}
      <div className="sr-only">
        <label htmlFor="action-selector-dropdown">{t("transformTab.actionLabel")}</label>
        <select
          id="action-selector-dropdown"
          value={transformAction}
          onChange={(e) => {
            const val = e.target.value as TransformAction;
            setTransformAction(val);
          }}
        >
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
      </div>

      {/* UNIFIED WORKBENCH: Two-column Studio Layout (No boxes inside boxes) */}
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs overflow-hidden flex flex-col md:flex-row min-h-[580px]">
        {/* LEFT PANE: Operations Navigator Rail (~280px to ~320px) */}
        <aside className="w-full md:w-72 lg:w-80 shrink-0 border-b md:border-b-0 md:border-r border-neutral-200/90 dark:border-neutral-800 bg-white dark:bg-neutral-900 flex flex-col">
          {/* Top Segmented Category Switcher */}
          <div className="p-2.5 border-b border-neutral-200/80 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-900/80">
            <div
              role="tablist"
              aria-label={t("transformTab.categorySwitcherAria")}
              className="grid grid-cols-4 p-1 bg-neutral-200/70 dark:bg-neutral-800/80 rounded-lg gap-1 border border-neutral-200/60 dark:border-neutral-700/60"
              onKeyDown={handleTabKeyDown}
            >
              {CATEGORIES.map((cat, index) => {
                const isCatActive = activeCategory === cat.id;
                const CatIcon = cat.icon;
                return (
                  <button
                    key={cat.id}
                    ref={(el) => {
                      tabRefs.current[index] = el;
                    }}
                    type="button"
                    role="tab"
                    id={`tab-${cat.id}`}
                    aria-selected={isCatActive}
                    aria-controls={`tabpanel-${cat.id}`}
                    tabIndex={isCatActive ? 0 : -1}
                    onClick={() => handleCategoryClick(cat.id)}
                    className={`flex flex-col items-center justify-center py-1.5 px-1 rounded-md text-[11px] transition-all cursor-pointer select-none focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${
                      isCatActive
                        ? "bg-white dark:bg-neutral-800 text-brand shadow-2xs font-semibold"
                        : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900 dark:hover:text-neutral-200 hover:bg-neutral-200/50 dark:hover:bg-neutral-700/50 font-medium"
                    }`}
                  >
                    <CatIcon
                      aria-hidden="true"
                      className={`w-3.5 h-3.5 mb-0.5 shrink-0 transition-colors ${
                        isCatActive ? "text-brand" : "text-neutral-400 dark:text-neutral-500"
                      }`}
                    />
                    <span className="truncate w-full text-center tracking-tight leading-tight">
                      {t(cat.tabKey)}
                    </span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Compact Scannable Action List (3-6 actions for selected category) */}
          <div
            id={`tabpanel-${activeCategory}`}
            role="tabpanel"
            aria-labelledby={`tab-${activeCategory}`}
            className="p-2 space-y-1 flex-1 overflow-y-auto [scrollbar-width:thin] [scrollbar-color:rgba(156,163,175,0.4)_transparent] [&::-webkit-scrollbar]:w-1.5 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-neutral-300 dark:[&::-webkit-scrollbar-thumb]:bg-neutral-700 hover:[&::-webkit-scrollbar-thumb]:bg-neutral-400 dark:hover:[&::-webkit-scrollbar-thumb]:bg-neutral-600 [&::-webkit-scrollbar-track]:bg-transparent"
          >
            {visibleActions.map((act) => renderActionRow(act))}
          </div>
        </aside>

        {/* RIGHT PANE: Active Operation Workspace */}
        <section className="flex-1 min-w-0 flex flex-col bg-white dark:bg-neutral-900">
          {/* Operation Header Bar with Primary CTA */}
          <div className="p-4 sm:p-5 border-b border-neutral-200 dark:border-neutral-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-neutral-50/30 dark:bg-neutral-800/20">
            <div className="min-w-0">
              <div className="flex items-center gap-2.5 flex-wrap">
                <div className="p-1.5 rounded-md bg-brand/10 text-brand dark:bg-brand/20">
                  <CurrentIcon aria-hidden="true" className="w-4 h-4" />
                </div>
                <h3 className="font-semibold text-base text-neutral-900 dark:text-neutral-100">
                  {t(currentActionMeta.titleKey)}
                </h3>
                {transformAction === "fill_mice" && <InfoHint term="mice" />}
                {transformAction === "z_score" && <InfoHint term="zScore" />}
                {transformAction === "outlier_iqr" && <InfoHint term="iqr" />}
              </div>
              <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-2xl leading-relaxed">
                {t(currentActionMeta.descKey)}
              </p>
            </div>

            {/* Primary Apply CTA Button */}
            <div className="shrink-0 flex items-center gap-2">
              <button
                type="button"
                onClick={requestApply}
                disabled={isApplyDisabled}
                title={
                  usesMultiColumns && transformColsMultiple.length === 0
                    ? t("transformTab.selectColToProceed")
                    : undefined
                }
                className="inline-flex items-center gap-2 px-4 py-2 rounded-md bg-brand text-white text-xs sm:text-sm font-semibold hover:bg-brand-hover shadow-xs transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-offset-2"
              >
                {isMiceLoading || isHotDeckLoading ? (
                  <span className="inline-flex items-center gap-1.5">
                    <Loader2 aria-hidden="true" className="w-3.5 h-3.5 animate-spin motion-reduce:animate-none" />
                    {t("transformTab.processing")}
                  </span>
                ) : (
                  t("transformTab.applyButton")
                )}
              </button>
            </div>
          </div>

          {/* Main Config Canvas */}
          <div className="p-4 sm:p-6 space-y-5 flex-1 overflow-y-auto">
            {/* 1. Column Selection Matrix (Used by 13 of 18 actions) */}
            {usesMultiColumns && (
              <div className="space-y-2.5">
                <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                      {t("transformTab.columnsMultiLabel")}
                    </span>
                  </div>

                  {/* Quick Select Actions */}
                  <div className="flex items-center gap-2 text-xs">
                    <button
                      type="button"
                      onClick={() => setTransformColsMultiple([...cols])}
                      className="inline-flex items-center gap-1 text-brand hover:underline font-medium"
                    >
                      <CheckSquare aria-hidden="true" className="w-3 h-3" />
                      <span>{t("transformTab.selectAllCols")}</span>
                    </button>
                    {numericCols.length > 0 && numericCols.length !== cols.length && (
                      <>
                        <span className="text-neutral-300 dark:text-neutral-700">·</span>
                        <button
                          type="button"
                          onClick={() => setTransformColsMultiple([...numericCols])}
                          className="inline-flex items-center gap-1 text-blue-600 dark:text-blue-400 hover:underline font-medium"
                        >
                          <Hash aria-hidden="true" className="w-3 h-3" />
                          <span>{t("transformTab.selectNumericOnly")}</span>
                        </button>
                      </>
                    )}
                    {transformColsMultiple.length > 0 && (
                      <>
                        <span className="text-neutral-300 dark:text-neutral-700">·</span>
                        <button
                          type="button"
                          onClick={() => setTransformColsMultiple([])}
                          className="inline-flex items-center gap-1 text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200"
                        >
                          <Square aria-hidden="true" className="w-3 h-3" />
                          <span>{t("transformTab.deselectAllCols")}</span>
                        </button>
                      </>
                    )}
                  </div>
                </div>

                {/* Column Search Filter if > 6 columns */}
                {cols.length > 6 && (
                  <div className="relative max-w-xs">
                    <label htmlFor="transform-col-search" className="sr-only">
                      {t("transformTab.filterColsPlaceholder")}
                    </label>
                    <Search aria-hidden="true" className="w-3 h-3 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
                    <input
                      id="transform-col-search"
                      name="transformColSearch"
                      type="text"
                      aria-label={t("transformTab.filterColsPlaceholder")}
                      value={colSearchQuery}
                      onChange={(e) => setColSearchQuery(e.target.value)}
                      placeholder={t("transformTab.filterColsPlaceholder")}
                      autoComplete="off"
                      spellCheck={false}
                      className="w-full pl-7 pr-3 py-1 text-xs rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 placeholder:text-neutral-400 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                    />
                  </div>
                )}

                {/* Dense Variable Matrix: Clean 1px border cards with missing indicators */}
                <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-2 max-h-52 overflow-y-auto p-1">
                  {filteredCols.map((c) => {
                    const isChecked = transformColsMultiple.includes(c);
                    const meta = selectedDs.variables?.[c];
                    const isNum = meta?.type === "numeric";
                    const missCount = missingCountsPerCol[c] ?? 0;
                    return (
                      <label
                        key={c}
                        className={`flex items-center gap-2 p-2 rounded-md border text-xs cursor-pointer select-none transition-colors ${
                          isChecked
                            ? "border-brand bg-brand/5 dark:bg-brand/10 text-neutral-900 dark:text-neutral-100 font-semibold ring-1 ring-brand/30"
                            : "border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/40 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300 dark:hover:border-neutral-700"
                        }`}
                      >
                        <input
                          type="checkbox"
                          checked={isChecked}
                          onChange={() =>
                            setTransformColsMultiple((prev) =>
                              prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
                            )
                          }
                          className="rounded text-brand focus:ring-brand w-3.5 h-3.5 shrink-0"
                        />
                        <span
                          className={`text-xs font-mono px-1 py-0.2 rounded shrink-0 ${
                            isNum
                              ? "bg-blue-100 text-blue-700 dark:bg-blue-900/50 dark:text-blue-300"
                              : "bg-neutral-200 text-neutral-700 dark:bg-neutral-700 dark:text-neutral-300"
                          }`}
                          title={meta?.type ?? "variable"}
                        >
                          {isNum ? "#" : "A"}
                        </span>
                        <span className="truncate flex-1" title={c}>
                          {c}
                        </span>
                        {missCount > 0 && (
                          <span
                            className="text-xs font-mono font-medium px-1.5 py-0.2 rounded bg-rose-50 border border-rose-200 text-rose-700 dark:bg-rose-950/40 dark:border-rose-900/40 dark:text-rose-300 shrink-0"
                            title={`${missCount} missing cells`}
                          >
                            {missCount}
                          </span>
                        )}
                      </label>
                    );
                  })}
                </div>
              </div>
            )}

            {/* Mode fallback hint when mean/median is selected for categorical columns */}
            {modeFallbackCols.length > 0 && (
              <div
                role="status"
                className="p-3 rounded-md border border-amber-200 bg-amber-50 dark:border-amber-900/60 dark:bg-amber-950/30 text-xs text-amber-800 dark:text-amber-300 flex items-start gap-2.5"
              >
                <AlertTriangle aria-hidden="true" className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                <div className="leading-relaxed">
                  {t("transformTab.modeFallbackHint", { cols: modeFallbackCols.join(", "), strategy: strategyLabel })}
                </div>
              </div>
            )}

            {/* 2. Action Specific Configuration Parameters */}
            {/* MICE Parameters */}
            {transformAction === "fill_mice" && (
              <div className="space-y-3 pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-700 dark:text-neutral-300">
                  MICE Configuration (Chained Equations)
                </h4>
                <div className="flex flex-wrap gap-5 items-center">
                  <div>
                    <label htmlFor="transform-mice-m" className="flex items-center gap-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      <span>{t("transformTab.mice.mLabel")}</span>
                      <InfoHint term="miceM" />
                    </label>
                    <input
                      id="transform-mice-m"
                      name="miceM"
                      type="number"
                      min={MICE_MIN_M}
                      max={MICE_MAX_M}
                      value={miceM}
                      onChange={(e) => setMiceM(clampMiceM(parseInt(e.target.value, 10), 5))}
                      className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs sm:text-sm w-32 font-mono text-neutral-900 dark:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                    />
                  </div>
                  <div>
                    <label htmlFor="transform-mice-max-iter" className="flex items-center gap-1 text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                      <span>{t("transformTab.mice.maxIterLabel")}</span>
                      <InfoHint term="miceMaxIter" />
                    </label>
                    <input
                      id="transform-mice-max-iter"
                      name="miceMaxIter"
                      type="number"
                      min={MICE_MIN_ITER}
                      max={MICE_MAX_ITER}
                      value={miceMaxIter}
                      onChange={(e) => setMiceMaxIter(clampMiceIterations(parseInt(e.target.value, 10), 10))}
                      className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 px-3 py-1.5 text-xs sm:text-sm w-32 font-mono text-neutral-900 dark:text-neutral-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                    />
                  </div>
                </div>

                {!hasFullData && (
                  <p role="status" className="text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <AlertTriangle aria-hidden="true" className="w-3.5 h-3.5 shrink-0" />
                    <span>{t("transformTab.mice.needFullData")}</span>
                  </p>
                )}

                {isMiceLoading && (
                  <div role="status" className="flex items-center gap-3 text-xs sm:text-sm text-sky-700 dark:text-sky-300 p-2.5 rounded-md bg-sky-50 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800">
                    <Loader2 aria-hidden="true" className="w-4 h-4 animate-spin shrink-0 text-sky-600 motion-reduce:animate-none" />
                    <span className="flex-1">{t("transformTab.mice.loading")}</span>
                    <button
                      type="button"
                      data-testid="mice-cancel-btn"
                      onClick={() => abortControllerRef.current?.abort()}
                      className="rounded-md border border-sky-300 dark:border-sky-700 px-2 py-0.5 text-xs font-medium hover:bg-sky-100 dark:hover:bg-sky-900 transition-colors"
                    >
                      {t("transformTab.cancelButton")}
                    </button>
                  </div>
                )}

                {miceError && (
                  <div className="p-3 text-xs sm:text-sm text-red-700 bg-red-50 dark:bg-red-950/40 dark:text-red-300 rounded-md border border-red-200 dark:border-red-800">
                    {miceError}
                  </div>
                )}
              </div>
            )}

            {/* Rename Column */}
            {transformAction === "rename" && (
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="transform-rename-from" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t("transformTab.renameFrom")}
                  </label>
                  <select
                    id="transform-rename-from"
                    name="renameFrom"
                    value={renameFrom}
                    onChange={(e) => setRenameFrom(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-3 py-1.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                  >
                    <option value="">{t("transformTab.selectPlaceholder")}</option>
                    {cols.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="transform-rename-to" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t("transformTab.renameTo")}
                  </label>
                  <input
                    id="transform-rename-to"
                    name="renameTo"
                    type="text"
                    value={renameTo}
                    onChange={(e) => setRenameTo(e.target.value)}
                    placeholder="NEW_COLUMN_NAME"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-3 py-1.5 text-xs sm:text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                  />
                </div>
              </div>
            )}

            {/* Compute Formula */}
            {transformAction === "compute" && (
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="max-w-md">
                  <label htmlFor="transform-compute-name" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t("transformTab.computeName")}
                  </label>
                  <input
                    id="transform-compute-name"
                    name="computeName"
                    type="text"
                    value={computeName}
                    onChange={(e) => setComputeName(e.target.value)}
                    placeholder="TOTAL_SCORE"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-3 py-1.5 text-xs sm:text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                  />
                </div>
                <div>
                  <label htmlFor="transform-compute-formula" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t("transformTab.computeFormula")}
                  </label>
                  <input
                    id="transform-compute-formula"
                    name="computeFormula"
                    type="text"
                    value={computeFormula}
                    onChange={(e) => setComputeFormula(e.target.value)}
                    placeholder="([x1] + [x2]) / 2"
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full max-w-xl rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-3 py-1.5 text-xs sm:text-sm font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                  />
                  <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 max-w-xl">
                    {t("transformTab.computeHint")}
                  </p>
                  <div className="flex flex-wrap gap-1 mt-2">
                    <span className="text-xs text-neutral-500 self-center mr-1">Insert variable:</span>
                    {cols.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() =>
                          setComputeFormula((f) => `${f}${f && !/[\s(]$/.test(f) ? " " : ""}[${c}]`)
                        }
                        className="rounded border border-neutral-300 dark:border-neutral-700 px-1.5 py-0.5 text-xs font-mono bg-neutral-50 dark:bg-neutral-800 hover:bg-neutral-200 dark:hover:bg-neutral-700 transition"
                      >
                        [{c}]
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* Log Transform */}
            {transformAction === "log" && (
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <span className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  {t("transformTab.logKind")}
                </span>
                <div className="flex flex-wrap gap-2.5">
                  {[
                    { id: "ln" as const, label: t("transformTab.logLn"), desc: "ln(x)" },
                    { id: "log10" as const, label: t("transformTab.logLog10"), desc: "log₁₀(x)" },
                    { id: "log1p" as const, label: t("transformTab.logLog1p"), desc: "ln(1 + x)" },
                  ].map((k) => (
                    <label
                      key={k.id}
                      className={`flex items-center gap-2 px-3 py-2 rounded-md border text-xs cursor-pointer select-none transition-colors ${
                        logKind === k.id
                          ? "border-brand bg-brand/5 dark:bg-brand/10 font-semibold text-brand ring-1 ring-brand/30"
                          : "border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:border-neutral-300"
                      }`}
                    >
                      <input
                        type="radio"
                        name="logKind"
                        value={k.id}
                        checked={logKind === k.id}
                        onChange={() => setLogKind(k.id)}
                        className="text-brand focus:ring-brand w-3.5 h-3.5"
                      />
                      <span>{k.label}</span>
                      <span className="text-xs text-neutral-400 font-mono">({k.desc})</span>
                    </label>
                  ))}
                </div>
              </div>
            )}

            {/* Outlier IQR Controls */}
            {transformAction === "outlier_iqr" && (
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-2">
                <label htmlFor="transform-iqr-k" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1">
                  {t("transformTab.iqrK")}
                </label>
                <div className="flex items-center gap-3">
                  <input
                    id="transform-iqr-k"
                    name="iqrK"
                    type="text"
                    inputMode="decimal"
                    value={iqrK}
                    onChange={(e) => setIqrK(e.target.value)}
                    autoComplete="off"
                    className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-3 py-1.5 text-xs sm:text-sm w-24 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                  />
                  <div className="flex items-center gap-1.5">
                    <span className="text-xs text-neutral-500">{t("transformTab.iqrPresetLabel")}</span>
                    <button
                      type="button"
                      onClick={() => setIqrK("1.5")}
                      className={`px-2 py-1 rounded text-xs border transition ${
                        iqrK === "1.5"
                          ? "border-brand bg-brand/10 text-brand font-semibold"
                          : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {t("transformTab.iqrMildPreset")}
                    </button>
                    <button
                      type="button"
                      onClick={() => setIqrK("3.0")}
                      className={`px-2 py-1 rounded text-xs border transition ${
                        iqrK === "3.0"
                          ? "border-brand bg-brand/10 text-brand font-semibold"
                          : "border-neutral-300 dark:border-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-800"
                      }`}
                    >
                      {t("transformTab.iqrExtremePreset")}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Dedupe hint */}
            {transformAction === "dedupe" && (
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800">
                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("transformTab.dedupeHint")}
                </p>
              </div>
            )}

            {/* Filter Rows */}
            {transformAction === "filter" && (
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div>
                  <label htmlFor="transform-filter-col" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t("transformTab.columnLabel")}
                  </label>
                  <select
                    id="transform-filter-col"
                    name="filterCol"
                    value={filterCol}
                    onChange={(e) => setFilterCol(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-3 py-1.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                  >
                    <option value="">{t("transformTab.selectPlaceholder")}</option>
                    {cols.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="transform-filter-op" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t("transformTab.conditionLabel")}
                  </label>
                  <select
                    id="transform-filter-op"
                    name="filterOp"
                    value={filterOp}
                    onChange={(e) => setFilterOp(e.target.value as typeof filterOp)}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-3 py-1.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand font-mono"
                  >
                    <option value="==">{t("transformTab.opEquals")}</option>
                    <option value="!=">{t("transformTab.opNotEquals")}</option>
                    <option value=">">&gt; (greater than)</option>
                    <option value="<">&lt; (less than)</option>
                    <option value=">=">{t("transformTab.opGte")}</option>
                    <option value="<=">{t("transformTab.opLte")}</option>
                    <option value="contains">{t("transformTab.opContains")}</option>
                  </select>
                </div>
                <div>
                  <label htmlFor="transform-filter-val" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t("transformTab.valueLabel")}
                  </label>
                  <input
                    id="transform-filter-val"
                    name="filterValue"
                    type="text"
                    value={filterValue}
                    onChange={(e) => setFilterValue(e.target.value)}
                    placeholder={t("transformTab.valuePlaceholder")}
                    autoComplete="off"
                    spellCheck={false}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-3 py-1.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                  />
                </div>
              </div>
            )}

            {/* Sort Rows */}
            {transformAction === "sort" && (
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label htmlFor="transform-sort-col" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t("transformTab.sortByColumnLabel")}
                  </label>
                  <select
                    id="transform-sort-col"
                    name="sortCol"
                    value={sortCol}
                    onChange={(e) => setSortCol(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-3 py-1.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                  >
                    <option value="">{t("transformTab.selectPlaceholder")}</option>
                    {cols.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label htmlFor="transform-sort-order" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t("transformTab.orderLabel")}
                  </label>
                  <select
                    id="transform-sort-order"
                    name="sortOrder"
                    value={sortOrder}
                    onChange={(e) => setSortOrder(e.target.value as "asc" | "desc")}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-3 py-1.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                  >
                    <option value="asc">{t("transformTab.orderAsc")}</option>
                    <option value="desc">{t("transformTab.orderDesc")}</option>
                  </select>
                </div>
              </div>
            )}

            {/* Recode Values */}
            {transformAction === "recode" && (
              <div className="pt-3 border-t border-neutral-200 dark:border-neutral-800 space-y-3">
                <div className="max-w-xs">
                  <label htmlFor="transform-recode-col" className="block text-xs font-semibold text-neutral-700 dark:text-neutral-300 mb-1.5">
                    {t("transformTab.recodeColumnLabel")}
                  </label>
                  <select
                    id="transform-recode-col"
                    name="recodeCol"
                    value={recodeCol}
                    onChange={(e) => setRecodeCol(e.target.value)}
                    className="w-full rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-3 py-1.5 text-xs sm:text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                  >
                    <option value="">{t("transformTab.selectPlaceholder")}</option>
                    {cols.map((c) => (
                      <option key={c} value={c}>
                        {c}
                      </option>
                    ))}
                  </select>
                </div>

                <p className="text-xs text-neutral-500 dark:text-neutral-400">
                  {t("transformTab.recodeRuleHint")}
                </p>

                <div className="space-y-2">
                  {recodeRules.map((r, i) => (
                    <div key={i} className="flex gap-2 items-center">
                      <input
                        type="text"
                        value={r.from}
                        onChange={(e) => setRecodeRule(i, "from", e.target.value)}
                        placeholder={t("transformTab.oldValuePlaceholder")}
                        aria-label={`${t("transformTab.oldValuePlaceholder")} ${i + 1}`}
                        autoComplete="off"
                        spellCheck={false}
                        className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-2.5 py-1 text-xs w-36 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                      />
                      <ArrowRight aria-hidden="true" className="w-3.5 h-3.5 text-neutral-400 shrink-0" />
                      <input
                        type="text"
                        value={r.to}
                        onChange={(e) => setRecodeRule(i, "to", e.target.value)}
                        placeholder={t("transformTab.newValuePlaceholder")}
                        aria-label={`${t("transformTab.newValuePlaceholder")} ${i + 1}`}
                        autoComplete="off"
                        spellCheck={false}
                        className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 px-2.5 py-1 text-xs w-36 font-mono focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:border-brand"
                      />
                      {recodeRules.length > 1 && (
                        <button
                          type="button"
                          onClick={() => removeRecodeRule(i)}
                          className="p-1 text-neutral-400 hover:text-red-500 transition-colors"
                          aria-label="Delete rule"
                        >
                          <Trash2 aria-hidden="true" className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>

                <button
                  type="button"
                  onClick={addRecodeRule}
                  className="inline-flex items-center gap-1 text-xs text-brand font-medium hover:underline"
                >
                  <Plus aria-hidden="true" className="w-3 h-3" />
                  <span>{t("transformTab.addRuleButton")}</span>
                </button>
              </div>
            )}

            {/* Hot-deck loading banner */}
            {isHotDeckLoading && (
              <HotDeckLoadingBanner onCancel={() => abortControllerRef.current?.abort()} />
            )}

            {/* Feedback / Prep note */}
            {prepNote && (
              <p
                role="status"
                className={`text-xs sm:text-sm font-medium ${
                  prepNote.ok
                    ? "text-emerald-700 dark:text-emerald-400"
                    : "text-red-600 dark:text-red-400"
                }`}
              >
                {prepNote.text}
              </p>
            )}
          </div>


        </section>
      </div>

      {/* Choice Modal: Overwrite Original vs Create New Dataset */}
      {showTransformChoiceModal && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setShowTransformChoiceModal(false)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setShowTransformChoiceModal(false);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transform-choice-modal-title"
            className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full flex flex-col overflow-hidden overscroll-contain border border-neutral-200 dark:border-neutral-700"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between p-4 border-b border-neutral-200 dark:border-neutral-700 shrink-0">
              <h3
                id="transform-choice-modal-title"
                className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-neutral-100"
              >
                {t("transformTab.modalTitle")}
              </h3>
              <button
                type="button"
                onClick={() => setShowTransformChoiceModal(false)}
                className="p-1 rounded-md text-neutral-500 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none transition"
                aria-label={t("transformTab.closeAriaLabel")}
              >
                <X className="w-4 h-4" aria-hidden="true" />
              </button>
            </div>
            <div className="p-4 sm:p-5 space-y-4">
              <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-300">
                {t("transformTab.modalQuestion")}
              </p>
              <div className="flex flex-col gap-2">
                <button
                  type="button"
                  onClick={() => {
                    setShowTransformChoiceModal(false);
                    if (selectedDs.imputationMeta) {
                      if (transformAction === "fill_mice") {
                        setReplaceConfirm(() => () => applyTransform(true, false));
                      } else {
                        setInvalidateConfirm(() => () => applyTransform(true, true));
                      }
                    } else {
                      applyTransform(true, false);
                    }
                  }}
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none transition"
                >
                  {t("transformTab.overwriteOriginalButton")}
                </button>
                <button
                  type="button"
                  onClick={() => applyTransform(false, false)}
                  className="rounded-md border border-neutral-300 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 px-3.5 py-2.5 text-left text-xs sm:text-sm font-medium text-neutral-800 dark:text-neutral-200 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none transition"
                >
                  {t("transformTab.createNewButton")}
                </button>
                <button
                  type="button"
                  onClick={() => setShowTransformChoiceModal(false)}
                  className="rounded-md px-3 py-1.5 text-xs text-neutral-500 hover:text-neutral-800 dark:hover:text-neutral-200 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none text-center transition"
                >
                  {t("transformTab.cancelButton")}
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Replace Confirm Modal (MICE overwriting existing bundle) */}
      {replaceConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setReplaceConfirm(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setReplaceConfirm(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transform-replace-modal-title"
            className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full p-5 border border-neutral-200 dark:border-neutral-700 overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="transform-replace-modal-title"
              className="text-sm sm:text-base font-semibold mb-2 text-neutral-900 dark:text-neutral-100"
            >
              {t("transformTab.mice.replaceConfirmTitle")}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              {t("transformTab.mice.replaceConfirmBody")}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setReplaceConfirm(null)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none transition"
              >
                {t("transformTab.cancelButton")}
              </button>
              <button
                type="button"
                data-testid="replace-confirm-ok-btn"
                onClick={() => {
                  const run = replaceConfirm;
                  setReplaceConfirm(null);
                  run();
                }}
                className="rounded-md bg-brand text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-brand-hover shadow-xs focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none transition"
              >
                {t("transformTab.mice.replaceConfirmOk")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Invalidate Confirm Modal */}
      {invalidateConfirm && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
          onClick={() => setInvalidateConfirm(null)}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              setInvalidateConfirm(null);
            }
          }}
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby="transform-invalidate-modal-title"
            className="bg-white dark:bg-neutral-800 rounded-lg shadow-xl max-w-md w-full p-5 border border-neutral-200 dark:border-neutral-700 overscroll-contain"
            onClick={(e) => e.stopPropagation()}
          >
            <h3
              id="transform-invalidate-modal-title"
              className="text-sm sm:text-base font-semibold mb-2 text-neutral-900 dark:text-neutral-100"
            >
              {t("mi.invalidateTitle")}
            </h3>
            <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400 mb-4">
              {t("mi.invalidateBody", { m: selectedDs.imputationMeta?.m ?? 0 })}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setInvalidateConfirm(null)}
                className="rounded-md px-3 py-1.5 text-xs font-medium text-neutral-600 dark:text-neutral-400 hover:bg-neutral-100 dark:hover:bg-neutral-700 focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none transition"
              >
                {t("mi.invalidateCancel")}
              </button>
              <button
                type="button"
                data-testid="invalidate-confirm-ok-btn"
                onClick={() => {
                  const run = invalidateConfirm;
                  setInvalidateConfirm(null);
                  run();
                }}
                className="rounded-md bg-red-600 text-white px-3.5 py-1.5 text-xs font-semibold hover:bg-red-700 shadow-xs focus-visible:ring-2 focus-visible:ring-brand focus-visible:outline-none transition"
              >
                {t("mi.invalidateConfirm")}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* RESULTS & AUDIT TRAIL SECTION (Only visible when transformation executed) */}
      {lastTransformResult && (
        <div className="rounded-lg border border-neutral-200 dark:border-neutral-800 bg-white dark:bg-neutral-900 shadow-xs p-5 space-y-4">
          {/* Result Header & Dimension transition */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-neutral-200 dark:border-neutral-800">
            <div className="flex items-center gap-2">
              <div className="p-1 rounded-full bg-emerald-100 text-emerald-700 dark:bg-emerald-950/60 dark:text-emerald-400">
                <CheckCircle2 className="w-4 h-4" />
              </div>
              <div>
                <h3 className="text-sm sm:text-base font-semibold text-neutral-900 dark:text-neutral-100">
                  {t("transformTab.transformResultTitle")} {lastTransformResult.actionLabel}
                </h3>
                <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t("transformTab.beforeLabel")}{" "}
                  <strong className="font-mono text-neutral-700 dark:text-neutral-300">{lastTransformResult.before.length - 1}</strong>{" "}
                  {t("transformTab.rowsUnit")} × <strong className="font-mono text-neutral-700 dark:text-neutral-300">{lastTransformResult.before[0]?.length ?? 0}</strong>{" "}
                  {t("transformTab.columnsUnit")}
                  {" → "}
                  {t("transformTab.afterLabel")}{" "}
                  <strong className="font-mono text-neutral-700 dark:text-neutral-300">{lastTransformResult.after.length - 1}</strong>{" "}
                  {t("transformTab.rowsUnit")} × <strong className="font-mono text-neutral-700 dark:text-neutral-300">{lastTransformResult.after[0]?.length ?? 0}</strong>{" "}
                  {t("transformTab.columnsUnit")}
                </p>
              </div>
            </div>

            {/* View switcher buttons for Before / After */}
            <div className="flex items-center gap-1 p-0.5 rounded-md border border-neutral-200 dark:border-neutral-700 bg-neutral-50 dark:bg-neutral-800 text-xs">
              <button
                type="button"
                onClick={() => setPreviewTab("sideBySide")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  previewTab === "sideBySide"
                    ? "bg-white dark:bg-neutral-700 font-semibold shadow-2xs text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                }`}
              >
                Side-by-side
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("before")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  previewTab === "before"
                    ? "bg-white dark:bg-neutral-700 font-semibold shadow-2xs text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                }`}
              >
                {t("transformTab.beforeLabel")}
              </button>
              <button
                type="button"
                onClick={() => setPreviewTab("after")}
                className={`px-2.5 py-1 rounded transition-colors ${
                  previewTab === "after"
                    ? "bg-white dark:bg-neutral-700 font-semibold shadow-2xs text-neutral-900 dark:text-neutral-100"
                    : "text-neutral-600 dark:text-neutral-400 hover:text-neutral-900"
                }`}
              >
                {t("transformTab.afterLabel")}
              </button>
            </div>
          </div>

          {/* Rubin Pooling Table (Scholarly Academic Format) */}
          {lastTransformResult.rubinStats && lastTransformResult.rubinStats.length > 0 ? (
            <div className="rounded-md border border-sky-200 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20 p-3 overflow-x-auto">
              <h4 className="text-xs font-semibold text-sky-900 dark:text-sky-200 uppercase tracking-wider mb-2">
                {t("transformTab.mice.rubinReportTitle")}
              </h4>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-300 font-semibold text-xs">
                    <th className="text-left py-1.5 px-2 font-semibold">{t("transformTab.mice.colVariable")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colMissingCount")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colOriginalMeanRubin")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colPooledMean")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colRubinSe")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colWithinVar")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colBetweenVar")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colDf")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colFmi")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colCi95")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100 dark:divide-sky-900/40 tabular-nums font-mono text-xs">
                  {lastTransformResult.rubinStats.map((st) => (
                    <tr key={st.column} className="hover:bg-sky-100/40 dark:hover:bg-sky-900/20">
                      <td className="py-1.5 px-2 font-sans font-medium text-neutral-800 dark:text-neutral-200">{st.column}</td>
                      <td className="py-1.5 px-2 text-right text-rose-600 dark:text-rose-400 font-semibold">{st.missingCount}</td>
                      <td className="py-1.5 px-2 text-right text-neutral-600 dark:text-neutral-400">{st.originalMean != null ? st.originalMean.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-sky-700 dark:text-sky-300">{st.pooledMean != null ? st.pooledMean.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right">{st.rubinSe != null ? st.rubinSe.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-neutral-500">{st.withinVariance != null ? st.withinVariance.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-neutral-500">{st.betweenVariance != null ? st.betweenVariance.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right">{st.df != null ? st.df.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right">{st.fmi != null ? `${(st.fmi * 100).toFixed(1)}%` : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-neutral-700 dark:text-neutral-300">{st.ciLower != null && st.ciUpper != null ? `[${st.ciLower.toFixed(2)}, ${st.ciUpper.toFixed(2)}]` : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : lastTransformResult.stats && lastTransformResult.stats.length > 0 ? (
            <div className="rounded-md border border-sky-200 dark:border-sky-800 bg-sky-50/40 dark:bg-sky-950/20 p-3 overflow-x-auto">
              <h4 className="text-xs font-semibold text-sky-900 dark:text-sky-200 uppercase tracking-wider mb-2">
                {t("transformTab.mice.reportTitle")}
              </h4>
              <table className="w-full text-xs border-collapse">
                <thead>
                  <tr className="border-b border-sky-200 dark:border-sky-800 text-sky-900 dark:text-sky-300 font-semibold text-xs">
                    <th className="text-left py-1.5 px-2 font-semibold">{t("transformTab.mice.colVariable")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colMissingCount")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colOriginalMean")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colImputedMean")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colImputedStd")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colMin")}</th>
                    <th className="text-right py-1.5 px-2 font-semibold">{t("transformTab.mice.colMax")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-sky-100 dark:divide-sky-900/40 tabular-nums font-mono text-xs">
                  {lastTransformResult.stats.map((st) => (
                    <tr key={st.column} className="hover:bg-sky-100/40 dark:hover:bg-sky-900/20">
                      <td className="py-1.5 px-2 font-sans font-medium text-neutral-800 dark:text-neutral-200">{st.column}</td>
                      <td className="py-1.5 px-2 text-right text-rose-600 dark:text-rose-400 font-semibold">{st.missingCount}</td>
                      <td className="py-1.5 px-2 text-right text-neutral-600 dark:text-neutral-400">{st.originalMean != null ? st.originalMean.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right font-bold text-sky-700 dark:text-sky-300">{st.imputedMean != null ? st.imputedMean.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right">{st.imputedStd != null ? st.imputedStd.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-neutral-500">{st.min != null ? st.min.toFixed(2) : "—"}</td>
                      <td className="py-1.5 px-2 text-right text-neutral-500">{st.max != null ? st.max.toFixed(2) : "—"}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : null}

          {/* Clean Data Comparison Table (Side-by-side or Tabbed) */}
          <div
            className={`grid gap-4 ${
              previewTab === "sideBySide" ? "grid-cols-1 lg:grid-cols-2" : "grid-cols-1"
            }`}
          >
            {/* Before Table */}
            {(previewTab === "sideBySide" || previewTab === "before") && (
              <div className="rounded-md border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-50/30 dark:bg-neutral-900">
                <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-100/60 dark:bg-neutral-800/60 flex items-center justify-between text-xs font-semibold text-neutral-700 dark:text-neutral-300">
                  <span>{t("transformTab.beforeDataHeader")}</span>
                  <span className="font-mono text-xs text-neutral-500">
                    {lastTransformResult.before.length - 1} rows
                  </span>
                </div>
                <div className="overflow-x-auto max-h-56 overflow-y-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                      <tr>
                        {(lastTransformResult.before[0] || []).map((h, i) => (
                          <th key={i} className="text-left py-1.5 px-2.5 font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                            {h || `C${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 tabular-nums font-mono text-xs">
                      {lastTransformResult.before.slice(1, 16).map((row, ri) => (
                        <tr key={ri} className="hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40">
                          {(row || []).map((cell, ci) => {
                            const isMiss = cell === "" || cell === null || cell === undefined;
                            return (
                              <td
                                key={ci}
                                className={`py-1 px-2.5 whitespace-nowrap ${
                                  isMiss
                                    ? "bg-rose-50 dark:bg-rose-950/30 text-rose-600 dark:text-rose-400 font-semibold"
                                    : "text-neutral-700 dark:text-neutral-300"
                                }`}
                              >
                                {isMiss ? "•" : String(cell)}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {lastTransformResult.before.length > 16 && (
                  <p className="px-3 py-1 text-xs text-neutral-500 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800">
                    {t("transformTab.rowsTruncatedPrefix")} {lastTransformResult.before.length - 1}{" "}
                    {t("transformTab.rowsTruncatedSuffix")}
                  </p>
                )}
              </div>
            )}

            {/* After Table */}
            {(previewTab === "sideBySide" || previewTab === "after") && (
              <div className="rounded-md border border-neutral-200 dark:border-neutral-800 overflow-hidden bg-neutral-50/30 dark:bg-neutral-900">
                <div className="px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-emerald-50/60 dark:bg-emerald-950/30 flex items-center justify-between text-xs font-semibold text-emerald-800 dark:text-emerald-300">
                  <span>{t("transformTab.afterDataHeader")}</span>
                  <span className="font-mono text-xs text-emerald-700 dark:text-emerald-400">
                    {lastTransformResult.after.length - 1} rows
                  </span>
                </div>
                <div className="overflow-x-auto max-h-56 overflow-y-auto">
                  <table className="w-full text-xs border-collapse">
                    <thead className="sticky top-0 bg-neutral-100 dark:bg-neutral-800 border-b border-neutral-200 dark:border-neutral-700">
                      <tr>
                        {(lastTransformResult.after[0] || []).map((h, i) => (
                          <th key={i} className="text-left py-1.5 px-2.5 font-semibold text-neutral-700 dark:text-neutral-300 whitespace-nowrap">
                            {h || `C${i + 1}`}
                          </th>
                        ))}
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-neutral-100 dark:divide-neutral-800 tabular-nums font-mono text-xs">
                      {lastTransformResult.after.slice(1, 16).map((row, ri) => (
                        <tr key={ri} className="hover:bg-neutral-100/50 dark:hover:bg-neutral-800/40">
                          {(row || []).map((cell, ci) => (
                            <td key={ci} className="py-1 px-2.5 whitespace-nowrap text-neutral-700 dark:text-neutral-300">
                              {String(cell ?? "")}
                            </td>
                          ))}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {lastTransformResult.after.length > 16 && (
                  <p className="px-3 py-1 text-xs text-neutral-500 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50 dark:bg-neutral-800">
                    {t("transformTab.rowsTruncatedPrefix")} {lastTransformResult.after.length - 1}{" "}
                    {t("transformTab.rowsTruncatedSuffix")}
                  </p>
                )}
              </div>
            )}
          </div>

          <p className="text-xs text-neutral-500 dark:text-neutral-400 flex items-center gap-1.5">
            <Info className="w-3.5 h-3.5 shrink-0 text-brand" />
            <span>
              {t("transformTab.newDatasetAddedPrefix")} <strong>{t("transformTab.viewDataTabName")}</strong>{" "}
              {t("transformTab.newDatasetAddedSuffix")}
            </span>
          </p>
        </div>
      )}
    </div>
  );
}
