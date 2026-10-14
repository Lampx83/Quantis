import { useState, useEffect, useMemo } from "react";
import {
  Ruler,
  BarChart3,
  Tags,
  Plus,
  Trash2,
  AlertCircle,
  Search,
  SlidersHorizontal,
  X,
} from "lucide-react";
import type {
  Dataset,
  VariableMetadata,
  VariableType,
  VariableMeasure,
  VariableAlign,
} from "@/types";
import {
  ensureDatasetMetadata,
  validateVariableName,
} from "@/utils/metadata";
import { useDataStore } from "@/stores/useDataStore";
import { useUIStore } from "@/stores/useUIStore";
import {
  ValueLabelsModal,
  formatValueLabelsSummary,
} from "./ValueLabelsModal";
import {
  MissingValuesModal,
  formatMissingValuesSummary,
} from "./MissingValuesModal";

export function getOrderedVariableMetadataList(
  dataset: Dataset | null | undefined
): VariableMetadata[] {
  if (!dataset) return [];
  const hasHeaderInData =
    dataset.data &&
    dataset.data.length > 0 &&
    dataset.columnNames.length > 0 &&
    dataset.data[0][0] === dataset.columnNames[0];
  const hasHeaderInPreview =
    dataset.preview &&
    dataset.preview.length > 0 &&
    dataset.columnNames.length > 0 &&
    dataset.preview[0][0] === dataset.columnNames[0];

  const normalized = ensureDatasetMetadata({
    ...dataset,
    data: hasHeaderInData ? dataset.data!.slice(1) : dataset.data,
    preview: hasHeaderInPreview ? dataset.preview.slice(1) : dataset.preview,
  });
  const vars = normalized.variables ?? {};
  return normalized.columnNames.map(
    (colName) =>
      vars[colName] ?? {
        name: colName,
        type: "string",
        label: "",
        valueLabels: {},
        measure: "nominal",
        missingValues: [],
        decimals: 0,
        align: "left",
        width: 100,
      }
  );
}

export function buildTypeChangePatch(
  current: VariableMetadata,
  newType: VariableType
): Partial<VariableMetadata> {
  if (newType === "string") {
    return {
      type: "string",
      decimals: 0,
      align: "left",
      measure: "nominal",
    };
  }
  if (newType === "date") {
    return {
      type: "date",
      decimals: 0,
      align: "center",
      measure: current.measure === "scale" ? "scale" : "ordinal",
    };
  }
  return {
    type: "numeric",
    decimals: current.type === "numeric" ? current.decimals : 0,
    align: "right",
  };
}

export function MeasureIcon({
  measure,
  className = "w-3.5 h-3.5",
}: {
  measure: VariableMeasure;
  className?: string;
}) {
  if (measure === "scale") {
    return (
      <span title="Scale (Thang đo định lượng)" className="inline-flex shrink-0">
        <Ruler className={`${className} text-blue-600 dark:text-blue-400`} />
      </span>
    );
  }
  if (measure === "ordinal") {
    return (
      <span title="Ordinal (Thang đo thứ bậc)" className="inline-flex shrink-0">
        <BarChart3 className={`${className} text-amber-600 dark:text-amber-400`} />
      </span>
    );
  }
  return (
    <span title="Nominal (Thang đo định danh)" className="inline-flex shrink-0">
      <Tags className={`${className} text-emerald-600 dark:text-emerald-400`} />
    </span>
  );
}

export interface VariableViewGridProps {
  dataset?: Dataset | null;
  showToast?: (msg: string) => void;
}

export function VariableViewGrid({
  dataset: propDataset,
  showToast,
}: VariableViewGridProps) {
  const {
    datasets,
    selectedDatasetId,
    updateVariableMetadata,
    renameVariable,
    addVariable,
    removeVariable,
  } = useDataStore();
  const { setConfirmDialog } = useUIStore();

  const activeDataset = useMemo(() => {
    if (propDataset !== undefined) return propDataset;
    if (!selectedDatasetId) return null;
    return datasets.find((d) => d.id === selectedDatasetId) ?? null;
  }, [propDataset, datasets, selectedDatasetId]);

  const variablesList = useMemo(
    () => getOrderedVariableMetadataList(activeDataset),
    [activeDataset]
  );

  // Search filter
  const [search, setSearch] = useState("");
  const filteredVariablesList = useMemo(() => {
    if (!search.trim()) return variablesList;
    const q = search.trim().toLowerCase();
    return variablesList.filter((v) => {
      const matchName = v.name.toLowerCase().includes(q);
      const matchLabel = v.label ? v.label.toLowerCase().includes(q) : false;
      return matchName || matchLabel;
    });
  }, [variablesList, search]);

  // Track inline Name drafts, Decimals drafts, and Label drafts per variable
  const [nameDrafts, setNameDrafts] = useState<Record<string, string>>({});
  const [decimalsDrafts, setDecimalsDrafts] = useState<Record<string, string>>({});
  const [widthDrafts, setWidthDrafts] = useState<Record<string, string>>({});
  const [nameError, setNameError] = useState<{
    varName: string;
    message: string;
  } | null>(null);

  // Track active modal state
  const [valueLabelsTarget, setValueLabelsTarget] = useState<string | null>(
    null
  );
  const [missingValuesTarget, setMissingValuesTarget] = useState<string | null>(
    null
  );

  useEffect(() => {
    const nextDrafts: Record<string, string> = {};
    for (const v of variablesList) {
      nextDrafts[v.name] = v.name;
    }
    setNameDrafts(nextDrafts);
    setNameError(null);
    setWidthDrafts({});
  }, [activeDataset?.id, activeDataset?.columnNames.join("|")]);

  if (!activeDataset) {
    return (
      <div className="flex flex-col items-center justify-center p-12 text-neutral-400">
        <AlertCircle className="w-8 h-8 mb-2 opacity-50" />
        <p className="text-sm">Vui lòng chọn một bộ dữ liệu để xem Variable View.</p>
      </div>
    );
  }

  const commitNameChange = (originalName: string) => {
    const rawDraft = nameDrafts[originalName] ?? originalName;
    const trimmed = rawDraft.trim();

    if (trimmed === originalName) {
      if (nameError?.varName === originalName) setNameError(null);
      return;
    }

    const validation = validateVariableName(
      trimmed,
      activeDataset.columnNames,
      originalName
    );
    if (!validation.valid) {
      const msg = validation.error ?? "Tên biến không hợp lệ.";
      setNameError({ varName: originalName, message: msg });
      if (showToast) showToast(msg);
      // Revert draft back to originalName
      setNameDrafts((prev) => ({ ...prev, [originalName]: originalName }));
      return;
    }

    setNameError(null);
    renameVariable(originalName, trimmed, activeDataset.id);
    if (showToast) {
      showToast(`Đã đổi tên biến "${originalName}" → "${trimmed}"`);
    }
  };

  const commitWidthChange = (
    varName: string,
    currentWidth?: number,
    valueOverride?: string
  ) => {
    const draft = valueOverride !== undefined ? valueOverride : widthDrafts[varName];
    if (draft !== undefined) {
      const parsed = parseInt(draft, 10);
      const fallback = currentWidth ?? 100;
      const clamped = Number.isNaN(parsed)
        ? fallback
        : Math.max(40, Math.min(400, parsed));
      updateVariableMetadata(
        varName,
        { width: clamped },
        activeDataset.id
      );
      setWidthDrafts((prev) => {
        const next = { ...prev };
        delete next[varName];
        return next;
      });
    }
  };

  const handleAddVariable = () => {
    const existing = new Set(
      activeDataset.columnNames.map((c) => c.toUpperCase())
    );
    let idx = activeDataset.columnNames.length + 1;
    let newName = `VAR_${idx}`;
    while (existing.has(newName.toUpperCase())) {
      idx += 1;
      newName = `VAR_${idx}`;
    }

    addVariable(
      {
        name: newName,
        type: "numeric",
        width: 100,
        decimals: 0,
        label: "",
        valueLabels: {},
        missingValues: [],
        align: "right",
        measure: "scale",
      },
      undefined,
      activeDataset.id
    );
    if (showToast) {
      showToast(`Đã thêm biến mới "${newName}"`);
    }
  };

  const handleDeleteVariable = (varName: string) => {
    if (setConfirmDialog) {
      setConfirmDialog({
        message: `Bạn có chắc chắn muốn xóa biến "${varName}" khỏi bộ dữ liệu không?`,
        onConfirm: () => {
          removeVariable(varName, activeDataset.id);
          if (showToast) {
            showToast(`Đã xóa biến "${varName}"`);
          }
          setConfirmDialog(null);
        },
      });
    } else {
      removeVariable(varName, activeDataset.id);
      if (showToast) {
        showToast(`Đã xóa biến "${varName}"`);
      }
    }
  };

  const activeValueLabelsMeta = valueLabelsTarget
    ? variablesList.find((v) => v.name === valueLabelsTarget)
    : undefined;

  const activeMissingValuesMeta = missingValuesTarget
    ? variablesList.find((v) => v.name === missingValuesTarget)
    : undefined;

  return (
    <div className="flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden shadow-xs">
      {/* Validation Error Banner */}
      {nameError && (
        <div className="px-3.5 py-2 bg-rose-50 dark:bg-rose-950/50 border-b border-rose-200 dark:border-rose-800 flex items-center justify-between text-xs text-rose-700 dark:text-rose-300 shrink-0">
          <div className="flex items-center gap-2">
            <AlertCircle className="w-4 h-4 shrink-0" />
            <span>{nameError.message}</span>
          </div>
          <button
            type="button"
            onClick={() => setNameError(null)}
            className="text-rose-500 hover:underline ml-4"
          >
            Đóng
          </button>
        </div>
      )}

      {/* Toolbar top */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 shrink-0">
        <div className="flex items-center gap-2">
          <SlidersHorizontal className="w-4 h-4 text-brand shrink-0" />
          <span className="text-xs sm:text-sm font-semibold text-neutral-800 dark:text-neutral-200">
            Variable View — Quản trị Thuộc tính Biến số ({variablesList.length} biến)
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-neutral-400" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Tìm theo tên hoặc nhãn..."
              className="pl-8 pr-7 py-1 text-xs border border-neutral-200 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-none focus:ring-1 focus:ring-brand w-48 sm:w-56"
            />
            {search && (
              <button
                type="button"
                onClick={() => setSearch("")}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600 dark:hover:text-neutral-200"
                title="Xóa tìm kiếm"
              >
                <X className="w-3 h-3" />
              </button>
            )}
          </div>
          <button
            type="button"
            onClick={handleAddVariable}
            className="flex items-center gap-1.5 px-3 py-1 text-xs font-medium text-white bg-brand hover:bg-brand/90 rounded-md shadow-xs transition-colors shrink-0"
          >
            <Plus className="w-3.5 h-3.5" />
            <span>Thêm biến</span>
          </button>
        </div>
      </div>

      {/* SPSS-style Variable View Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-10 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-semibold border-b border-neutral-200 dark:border-neutral-700 select-none shadow-xs">
            <tr>
              <th className="w-10 py-2.5 px-2 text-center border-r border-neutral-200 dark:border-neutral-700">
                #
              </th>
              <th className="min-w-[130px] py-2.5 px-2.5 text-left border-r border-neutral-200 dark:border-neutral-700">
                Name
              </th>
              <th className="w-28 py-2.5 px-2 text-left border-r border-neutral-200 dark:border-neutral-700">
                Type
              </th>
              <th className="w-20 py-2.5 px-2 text-right border-r border-neutral-200 dark:border-neutral-700">
                Width
              </th>
              <th className="w-20 py-2.5 px-2 text-right border-r border-neutral-200 dark:border-neutral-700">
                Decimals
              </th>
              <th className="min-w-[220px] py-2.5 px-2.5 text-left border-r border-neutral-200 dark:border-neutral-700">
                Label
              </th>
              <th className="min-w-[160px] py-2.5 px-2.5 text-left border-r border-neutral-200 dark:border-neutral-700">
                Values
              </th>
              <th className="min-w-[130px] py-2.5 px-2.5 text-left border-r border-neutral-200 dark:border-neutral-700">
                Missing
              </th>
              <th className="w-24 py-2.5 px-2 text-left border-r border-neutral-200 dark:border-neutral-700">
                Align
              </th>
              <th className="w-36 py-2.5 px-2 text-left border-r border-neutral-200 dark:border-neutral-700">
                Measure
              </th>
              <th className="w-10 py-2.5 px-1.5 text-center" title="Thao tác">
                <span className="sr-only">Actions</span>
              </th>
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800">
            {filteredVariablesList.map((meta, idx) => {
              const originalIdx = variablesList.findIndex((v) => v.name === meta.name);
              const rowNumber = originalIdx >= 0 ? originalIdx + 1 : idx + 1;
              const isDecimalsLocked = meta.type !== "numeric";
              const valueLabelsSummary = formatValueLabelsSummary(
                meta.valueLabels
              );
              const missingSummary = formatMissingValuesSummary(
                meta.missingValues
              );
              const effectiveMeasure: VariableMeasure =
                meta.type === "string" && meta.measure === "scale"
                  ? "nominal"
                  : meta.measure;

              return (
                <tr
                  key={meta.name}
                  className="hover:bg-neutral-50/80 dark:hover:bg-neutral-800/40 transition-colors"
                >
                  {/* 1. # */}
                  <td className="py-1.5 px-2 text-center font-mono text-neutral-500 dark:text-neutral-400 bg-neutral-50/60 dark:bg-neutral-800/30 border-r border-neutral-200 dark:border-neutral-800 select-none">
                    {rowNumber}
                  </td>

                  {/* 2. Name */}
                  <td className="p-1 border-r border-neutral-200 dark:border-neutral-800">
                    <input
                      type="text"
                      value={nameDrafts[meta.name] ?? meta.name}
                      onChange={(e) =>
                        setNameDrafts((prev) => ({
                          ...prev,
                          [meta.name]: e.target.value,
                        }))
                      }
                      onBlur={() => commitNameChange(meta.name)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                          setNameDrafts((prev) => ({
                            ...prev,
                            [meta.name]: meta.name,
                          }));
                          setNameError(null);
                        }
                      }}
                      aria-label={`Name for ${meta.name}`}
                      className="w-full px-2 py-1 font-mono font-medium rounded border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-brand focus:bg-white dark:focus:bg-neutral-800 focus:outline-none text-neutral-900 dark:text-neutral-100"
                    />
                  </td>

                  {/* 3. Type */}
                  <td className="p-1 border-r border-neutral-200 dark:border-neutral-800">
                    <select
                      value={meta.type}
                      onChange={(e) => {
                        const newType = e.target.value as VariableType;
                        const patch = buildTypeChangePatch(meta, newType);
                        updateVariableMetadata(
                          meta.name,
                          patch,
                          activeDataset.id
                        );
                      }}
                      aria-label={`Type for ${meta.name}`}
                      className="w-full px-1.5 py-1 rounded border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-brand bg-transparent dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                    >
                      <option value="numeric">Numeric</option>
                      <option value="string">String</option>
                      <option value="date">Date</option>
                    </select>
                  </td>

                  {/* 4. Width */}
                  <td className="p-1 border-r border-neutral-200 dark:border-neutral-800">
                    <input
                      type="number"
                      min={40}
                      max={400}
                      step={10}
                      value={
                        widthDrafts[meta.name] !== undefined
                          ? widthDrafts[meta.name]
                          : meta.width ?? 100
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setWidthDrafts((prev) => ({
                          ...prev,
                          [meta.name]: val,
                        }));
                      }}
                      onBlur={(e) => commitWidthChange(meta.name, meta.width, e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") {
                          e.currentTarget.blur();
                        } else if (e.key === "Escape") {
                          setWidthDrafts((prev) => {
                            const next = { ...prev };
                            delete next[meta.name];
                            return next;
                          });
                        }
                      }}
                      aria-label={`Width for ${meta.name}`}
                      className="w-full px-2 py-1 text-right font-mono rounded border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-brand focus:bg-white dark:focus:bg-neutral-800 focus:outline-none text-neutral-800 dark:text-neutral-200"
                    />
                  </td>

                  {/* 5. Decimals */}
                  <td className="p-1 border-r border-neutral-200 dark:border-neutral-800">
                    <input
                      type="number"
                      min={0}
                      max={6}
                      disabled={isDecimalsLocked}
                      value={
                        isDecimalsLocked
                          ? 0
                          : decimalsDrafts[meta.name] !== undefined
                          ? decimalsDrafts[meta.name]
                          : meta.decimals ?? 0
                      }
                      onChange={(e) => {
                        const val = e.target.value;
                        setDecimalsDrafts((prev) => ({
                          ...prev,
                          [meta.name]: val,
                        }));
                        const parsed = parseInt(val, 10);
                        if (!Number.isNaN(parsed)) {
                          const clamped = Math.max(0, Math.min(6, parsed));
                          updateVariableMetadata(
                            meta.name,
                            { decimals: clamped },
                            activeDataset.id
                          );
                        }
                      }}
                      onBlur={() => {
                        setDecimalsDrafts((prev) => {
                          const next = { ...prev };
                          delete next[meta.name];
                          return next;
                        });
                      }}
                      aria-label={`Decimals for ${meta.name}`}
                      className={`w-full px-2 py-1 text-right font-mono rounded border border-transparent focus:outline-none ${
                        isDecimalsLocked
                          ? "text-neutral-400 dark:text-neutral-600 bg-neutral-100/50 dark:bg-neutral-800/30 cursor-not-allowed"
                          : "hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-brand focus:bg-white dark:focus:bg-neutral-800 text-neutral-800 dark:text-neutral-200"
                      }`}
                    />
                  </td>

                  {/* 6. Label */}
                  <td className="p-1 border-r border-neutral-200 dark:border-neutral-800">
                    <input
                      type="text"
                      value={meta.label}
                      placeholder="Nhập nhãn mô tả câu hỏi / biến số..."
                      onChange={(e) =>
                        updateVariableMetadata(
                          meta.name,
                          { label: e.target.value },
                          activeDataset.id
                        )
                      }
                      aria-label={`Label for ${meta.name}`}
                      className="w-full px-2 py-1 rounded border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-brand focus:bg-white dark:focus:bg-neutral-800 focus:outline-none text-neutral-800 dark:text-neutral-200 placeholder:text-neutral-400"
                    />
                  </td>

                  {/* 7. Values */}
                  <td className="p-1 border-r border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center justify-between gap-1.5 px-1.5 py-0.5">
                      <span
                        className={`truncate max-w-[130px] ${
                          valueLabelsSummary === "None"
                            ? "text-neutral-400 dark:text-neutral-500"
                            : "text-neutral-800 dark:text-neutral-200 font-medium"
                        }`}
                        title={valueLabelsSummary}
                      >
                        {valueLabelsSummary}
                      </span>
                      <button
                        type="button"
                        onClick={() => setValueLabelsTarget(meta.name)}
                        aria-label={`Configure value labels for ${meta.name}`}
                        title="Cấu hình Value Labels"
                        className="px-2 py-0.5 rounded bg-neutral-200/80 dark:bg-neutral-700 hover:bg-brand hover:text-white text-neutral-700 dark:text-neutral-200 font-mono text-[11px] font-semibold shrink-0 transition-colors"
                      >
                        ...
                      </button>
                    </div>
                  </td>

                  {/* 8. Missing */}
                  <td className="p-1 border-r border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center justify-between gap-1.5 px-1.5 py-0.5">
                      <span
                        className={`truncate max-w-[95px] font-mono ${
                          missingSummary === "None"
                            ? "text-neutral-400 dark:text-neutral-500 font-sans"
                            : "text-amber-700 dark:text-amber-400 font-medium"
                        }`}
                        title={missingSummary}
                      >
                        {missingSummary}
                      </span>
                      <button
                        type="button"
                        onClick={() => setMissingValuesTarget(meta.name)}
                        aria-label={`Configure missing values for ${meta.name}`}
                        title="Cấu hình Missing Values"
                        className="px-2 py-0.5 rounded bg-neutral-200/80 dark:bg-neutral-700 hover:bg-brand hover:text-white text-neutral-700 dark:text-neutral-200 font-mono text-[11px] font-semibold shrink-0 transition-colors"
                      >
                        ...
                      </button>
                    </div>
                  </td>

                  {/* 9. Align */}
                  <td className="p-1 border-r border-neutral-200 dark:border-neutral-800">
                    <select
                      value={meta.align}
                      onChange={(e) =>
                        updateVariableMetadata(
                          meta.name,
                          { align: e.target.value as VariableAlign },
                          activeDataset.id
                        )
                      }
                      aria-label={`Align for ${meta.name}`}
                      className="w-full px-1.5 py-1 rounded border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-brand bg-transparent dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none"
                    >
                      <option value="left">Left</option>
                      <option value="right">Right</option>
                      <option value="center">Center</option>
                    </select>
                  </td>

                  {/* 10. Measure */}
                  <td className="p-1 border-r border-neutral-200 dark:border-neutral-800">
                    <div className="flex items-center gap-1.5 px-1">
                      <MeasureIcon measure={effectiveMeasure} />
                      <select
                        value={effectiveMeasure}
                        onChange={(e) =>
                          updateVariableMetadata(
                            meta.name,
                            { measure: e.target.value as VariableMeasure },
                            activeDataset.id
                          )
                        }
                        aria-label={`Measure for ${meta.name}`}
                        className="w-full py-1 rounded border border-transparent hover:border-neutral-300 dark:hover:border-neutral-700 focus:border-brand bg-transparent dark:bg-neutral-900 text-neutral-800 dark:text-neutral-200 focus:outline-none font-medium"
                      >
                        {meta.type !== "string" && <option value="scale">Scale</option>}
                        <option value="ordinal">Ordinal</option>
                        <option value="nominal">Nominal</option>
                      </select>
                    </div>
                  </td>

                  {/* Actions */}
                  <td className="p-1 text-center">
                    {variablesList.length > 1 && (
                      <button
                        type="button"
                        onClick={() => handleDeleteVariable(meta.name)}
                        title={`Xóa biến ${meta.name}`}
                        className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </td>
                </tr>
              );
            })}

            {filteredVariablesList.length === 0 && (
              <tr>
                <td
                  colSpan={11}
                  className="py-10 text-center text-neutral-400 dark:text-neutral-500 italic"
                >
                  Không tìm thấy biến số nào phù hợp với từ khóa &ldquo;{search}&rdquo;.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Filter status footer if search is active */}
      {search && (
        <div className="px-3.5 py-1.5 bg-neutral-50/70 dark:bg-neutral-800/40 border-t border-neutral-200 dark:border-neutral-700 text-xs text-neutral-500 dark:text-neutral-400 flex items-center justify-between shrink-0">
          <span>
            Đang hiển thị {filteredVariablesList.length} / {variablesList.length} biến
          </span>
          <button
            type="button"
            onClick={() => setSearch("")}
            className="text-brand hover:underline font-medium"
          >
            Xóa bộ lọc
          </button>
        </div>
      )}

      {/* Modals for Values & Missing */}
      <ValueLabelsModal
        isOpen={Boolean(valueLabelsTarget && activeValueLabelsMeta)}
        variableName={valueLabelsTarget ?? ""}
        initialValueLabels={activeValueLabelsMeta?.valueLabels}
        onSave={(newLabels) => {
          if (valueLabelsTarget) {
            updateVariableMetadata(
              valueLabelsTarget,
              { valueLabels: newLabels },
              activeDataset.id
            );
          }
        }}
        onClose={() => setValueLabelsTarget(null)}
      />

      <MissingValuesModal
        isOpen={Boolean(missingValuesTarget && activeMissingValuesMeta)}
        variableName={missingValuesTarget ?? ""}
        initialMissingValues={activeMissingValuesMeta?.missingValues}
        onSave={(newMissing) => {
          if (missingValuesTarget) {
            updateVariableMetadata(
              missingValuesTarget,
              { missingValues: newMissing },
              activeDataset.id
            );
          }
        }}
        onClose={() => setMissingValuesTarget(null)}
      />
    </div>
  );
}
