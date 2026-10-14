import { useState, useMemo, useRef, useEffect } from "react";
import {
  Search,
  Tags,
  Plus,
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Eye,
  EyeOff,
  ArrowUpDown,
  X,
} from "lucide-react";
import type { Dataset, VariableMetadata } from "@/types";
import { getDataRows } from "@/utils/stats";
import {
  ensureDatasetMetadata,
  formatCellValueWithLabels,
  isMissingValue,
  validateVariableName,
} from "@/utils/metadata";
import { useDataStore } from "@/stores/useDataStore";
import { useUIStore } from "@/stores/useUIStore";
import { MeasureIcon } from "./VariableViewGrid";
import { GridContextMenu, type GridContextMenuTarget } from "./GridContextMenu";

export const DATA_GRID_PAGE_SIZE_DEFAULT = 100;
export const DATA_GRID_PAGE_SIZES = [20, 50, 100, 200] as const;

export interface IndexedDataRow {
  originalRowIndex: number;
  cells: string[];
}

export function filterAndSortDataRows(
  dataRows: string[][],
  options: {
    query?: string;
    sortColIndex?: number | null;
    sortDir?: "asc" | "desc";
  }
): IndexedDataRow[] {
  const { query = "", sortColIndex = null, sortDir = "asc" } = options;
  const trimmedQuery = query.trim().toLowerCase();

  let indexed: IndexedDataRow[] = dataRows.map((cells, idx) => ({
    originalRowIndex: idx,
    cells,
  }));

  if (trimmedQuery) {
    indexed = indexed.filter((row) =>
      row.cells.some((c) => String(c ?? "").toLowerCase().includes(trimmedQuery))
    );
  }

  if (sortColIndex != null) {
    const isNumericColumn =
      indexed.length > 0 &&
      indexed.every((r) => {
        const v = (r.cells[sortColIndex] ?? "").trim();
        return v === "" || !Number.isNaN(Number(v));
      });

    indexed = [...indexed].sort((a, b) => {
      const av = (a.cells[sortColIndex] ?? "").trim();
      const bv = (b.cells[sortColIndex] ?? "").trim();
      let cmp = 0;
      if (isNumericColumn) {
        const an = av === "" ? -Infinity : Number(av);
        const bn = bv === "" ? -Infinity : Number(bv);
        cmp = (Number.isNaN(an) ? -Infinity : an) - (Number.isNaN(bn) ? -Infinity : bn);
      } else {
        cmp = av.localeCompare(bv);
      }
      return sortDir === "asc" ? cmp : -cmp;
    });
  }

  return indexed;
}

export function paginateIndexedRows(
  rows: IndexedDataRow[],
  page: number,
  pageSize: number
): {
  pageRows: IndexedDataRow[];
  totalPages: number;
  safePage: number;
  startIdx: number;
  endIdx: number;
} {
  const safeSize = Math.max(1, pageSize);
  const totalPages = Math.max(1, Math.ceil(rows.length / safeSize));
  const safePage = Math.max(1, Math.min(page, totalPages));
  const startIdx = (safePage - 1) * safeSize;
  const endIdx = Math.min(startIdx + safeSize, rows.length);
  const pageRows = rows.slice(startIdx, endIdx);

  return {
    pageRows,
    totalPages,
    safePage,
    startIdx,
    endIdx,
  };
}

export function formatDisplayCellValue(
  rawValue: string,
  meta?: VariableMetadata,
  showValueLabels?: boolean
): {
  text: string;
  isLabel: boolean;
  isMissingCode: boolean;
} {
  const raw = rawValue ?? "";
  const trimmed = raw.trim();
  const isMissingCode = Boolean(
    trimmed !== "" &&
      meta?.missingValues &&
      meta.missingValues.includes(trimmed)
  );

  if (showValueLabels && meta?.valueLabels) {
    const mapped = formatCellValueWithLabels(trimmed, meta);
    if (mapped !== trimmed) {
      return {
        text: mapped,
        isLabel: true,
        isMissingCode,
      };
    }
  }

  // Format decimals if variable is numeric and value is non-empty
  if (
    meta?.type === "numeric" &&
    typeof meta?.decimals === "number" &&
    meta.decimals >= 0 &&
    trimmed !== ""
  ) {
    const normalizedStr =
      trimmed.includes(",") && !trimmed.includes(".")
        ? trimmed.replace(",", ".")
        : trimmed;
    const num = Number(normalizedStr);
    if (!Number.isNaN(num) && Number.isFinite(num)) {
      const clampedDecimals = Math.max(0, Math.min(20, Math.floor(meta.decimals)));
      return {
        text: num.toFixed(clampedDecimals),
        isLabel: false,
        isMissingCode,
      };
    }
  }

  return {
    text: raw,
    isLabel: false,
    isMissingCode,
  };
}

export function parseClipboardPasteMatrix(
  clipboardText: string,
  startRowIndex: number,
  startColIndex: number,
  maxRows: number,
  maxCols: number
): Array<{ rowIndex: number; colIndex: number; value: string }> {
  if (!clipboardText) return [];
  const rawLines = clipboardText.replace(/\r\n/g, "\n").split("\n");
  if (rawLines.length > 1 && rawLines[rawLines.length - 1] === "") {
    rawLines.pop();
  }

  const updates: Array<{ rowIndex: number; colIndex: number; value: string }> = [];
  rawLines.forEach((line, rOffset) => {
    const targetRow = startRowIndex + rOffset;
    if (targetRow < 0 || targetRow >= maxRows) return;
    const cols = line.split("\t");
    cols.forEach((cellVal, cOffset) => {
      const targetCol = startColIndex + cOffset;
      if (targetCol < 0 || targetCol >= maxCols) return;
      updates.push({
        rowIndex: targetRow,
        colIndex: targetCol,
        value: cellVal.trim(),
      });
    });
  });

  return updates;
}

export interface DataGridProps {
  dataset?: Dataset | null;
  showValueLabels?: boolean;
  hideToolbar?: boolean;
  searchQuery?: string;
  onSearchQueryChange?: (q: string) => void;
  showToast?: (msg: string) => void;
}

export function DataGrid({
  dataset: propDataset,
  showValueLabels: propShowValueLabels,
  hideToolbar = false,
  searchQuery: propSearchQuery,
  onSearchQueryChange,
  showToast,
}: DataGridProps) {
  const {
    datasets,
    selectedDatasetId,
    updateCell,
    batchUpdateCells,
    renameVariable,
    addVariable,
    removeVariable,
    addRow,
    removeRow,
  } = useDataStore();

  const {
    showValueLabels: storeShowValueLabels,
    toggleShowValueLabels,
  } = useUIStore();

  const effectiveShowValueLabels =
    propShowValueLabels !== undefined ? propShowValueLabels : storeShowValueLabels;

  const activeDataset = useMemo(() => {
    if (propDataset !== undefined) return propDataset;
    if (!selectedDatasetId) return null;
    return datasets.find((d) => d.id === selectedDatasetId) ?? null;
  }, [propDataset, datasets, selectedDatasetId]);

  const enrichedDataset = useMemo(() => {
    if (!activeDataset) return null;
    return ensureDatasetMetadata(activeDataset);
  }, [activeDataset]);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(DATA_GRID_PAGE_SIZE_DEFAULT);
  const [sortColIndex, setSortColIndex] = useState<number | null>(null);
  const [sortDir, setSortDir] = useState<"asc" | "desc">("asc");
  const [internalSearch, setInternalSearch] = useState("");

  const effectiveQuery =
    propSearchQuery !== undefined ? propSearchQuery : internalSearch;

  // Active & Editing Cell state (tracked by visible row idx in pageRows + colIdx)
  const [activeCell, setActiveCell] = useState<{
    originalRowIndex: number;
    colIndex: number;
  } | null>(null);
  const [editingCell, setEditingCell] = useState<{
    originalRowIndex: number;
    colIndex: number;
  } | null>(null);
  const [editDraft, setEditDraft] = useState<string>("");

  // Inline Column Header Rename state
  const [renamingCol, setRenamingCol] = useState<{
    colIndex: number;
    oldName: string;
    draft: string;
  } | null>(null);

  // Right-click Context Menu state
  const [contextMenu, setContextMenu] = useState<GridContextMenuTarget | null>(
    null
  );

  const editInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (editingCell && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingCell]);

  const { headers, dataRows } = useMemo(() => {
    if (!enrichedDataset) return { headers: [] as string[], dataRows: [] as string[][] };
    const rows = getDataRows(enrichedDataset);
    if (rows.length === 0) {
      return { headers: enrichedDataset.columnNames ?? [], dataRows: [] };
    }
    const firstRowMatchesHeader =
      enrichedDataset.columnNames.length > 0 &&
      rows[0]?.[0] === enrichedDataset.columnNames[0];
    if (firstRowMatchesHeader) {
      return {
        headers: enrichedDataset.columnNames.length > 0 ? enrichedDataset.columnNames : rows[0],
        dataRows: rows.slice(1),
      };
    }
    return {
      headers: enrichedDataset.columnNames.length > 0 ? enrichedDataset.columnNames : rows[0],
      dataRows: rows,
    };
  }, [enrichedDataset]);

  const filteredAndSorted = useMemo(
    () =>
      filterAndSortDataRows(dataRows, {
        query: effectiveQuery,
        sortColIndex,
        sortDir,
      }),
    [dataRows, effectiveQuery, sortColIndex, sortDir]
  );

  const { pageRows, totalPages, safePage, startIdx, endIdx } = useMemo(
    () => paginateIndexedRows(filteredAndSorted, page, pageSize),
    [filteredAndSorted, page, pageSize]
  );

  if (!enrichedDataset) {
    return (
      <div className="p-6 text-center text-sm text-neutral-500 dark:text-neutral-400">
        Chưa chọn bộ dữ liệu nào để hiển thị Data View.
      </div>
    );
  }

  const variablesMap = enrichedDataset.variables ?? {};

  const handleSortToggle = (colIndex: number) => {
    if (sortColIndex === colIndex) {
      setSortDir((prev) => (prev === "asc" ? "desc" : "asc"));
    } else {
      setSortColIndex(colIndex);
      setSortDir("asc");
    }
    setPage(1);
  };

  const startEditing = (originalRowIndex: number, colIndex: number, initialVal?: string) => {
    const currentVal =
      initialVal !== undefined
        ? initialVal
        : dataRows[originalRowIndex]?.[colIndex] ?? "";
    setActiveCell({ originalRowIndex, colIndex });
    setEditingCell({ originalRowIndex, colIndex });
    setEditDraft(currentVal);
  };

  const commitCellEdit = (
    moveDirection?: "down" | "right" | "left"
  ) => {
    if (!editingCell) return;
    const { originalRowIndex, colIndex } = editingCell;
    const previousValue = dataRows[originalRowIndex]?.[colIndex] ?? "";

    if (editDraft !== previousValue) {
      updateCell(originalRowIndex, colIndex, editDraft, enrichedDataset.id);
    }

    setEditingCell(null);

    if (moveDirection) {
      const currentVisibleIdx = pageRows.findIndex(
        (r) => r.originalRowIndex === originalRowIndex
      );
      if (moveDirection === "down" && currentVisibleIdx >= 0) {
        const nextRow = pageRows[currentVisibleIdx + 1];
        if (nextRow) {
          setActiveCell({
            originalRowIndex: nextRow.originalRowIndex,
            colIndex,
          });
        }
      } else if (moveDirection === "right") {
        if (colIndex + 1 < headers.length) {
          setActiveCell({ originalRowIndex, colIndex: colIndex + 1 });
        }
      } else if (moveDirection === "left") {
        if (colIndex - 1 >= 0) {
          setActiveCell({ originalRowIndex, colIndex: colIndex - 1 });
        }
      }
    }
  };

  const cancelCellEdit = () => {
    setEditingCell(null);
  };

  const handleCommitColumnRename = () => {
    if (!renamingCol) return;
    const trimmed = renamingCol.draft.trim();
    if (trimmed && trimmed !== renamingCol.oldName) {
      const check = validateVariableName(
        trimmed,
        headers,
        renamingCol.oldName
      );
      if (!check.valid) {
        if (showToast) showToast(check.error ?? "Tên biến không hợp lệ.");
      } else {
        renameVariable(renamingCol.oldName, trimmed, enrichedDataset.id);
        if (showToast) {
          showToast(`Đã đổi tên biến "${renamingCol.oldName}" → "${trimmed}"`);
        }
      }
    }
    setRenamingCol(null);
  };

  const handleInsertVariable = () => {
    const existing = new Set(headers.map((h) => h.toUpperCase()));
    let idx = headers.length + 1;
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
      enrichedDataset.id
    );
    if (showToast) showToast(`Đã thêm biến "${newName}"`);
  };

  return (
    <div
      className="flex flex-col h-full bg-white dark:bg-neutral-900 border border-neutral-200 dark:border-neutral-800 rounded-lg overflow-hidden shadow-xs focus:outline-hidden select-none"
      onKeyDown={(e) => {
        if (editingCell || renamingCol) return;
        if (!activeCell) return;

        if (e.key === "Enter" || e.key === "F2") {
          e.preventDefault();
          startEditing(activeCell.originalRowIndex, activeCell.colIndex);
        } else if (e.key === "ArrowDown") {
          e.preventDefault();
          const vIdx = pageRows.findIndex(
            (r) => r.originalRowIndex === activeCell.originalRowIndex
          );
          if (vIdx >= 0 && vIdx + 1 < pageRows.length) {
            setActiveCell({
              originalRowIndex: pageRows[vIdx + 1].originalRowIndex,
              colIndex: activeCell.colIndex,
            });
          }
        } else if (e.key === "ArrowUp") {
          e.preventDefault();
          const vIdx = pageRows.findIndex(
            (r) => r.originalRowIndex === activeCell.originalRowIndex
          );
          if (vIdx > 0) {
            setActiveCell({
              originalRowIndex: pageRows[vIdx - 1].originalRowIndex,
              colIndex: activeCell.colIndex,
            });
          }
        } else if (e.key === "ArrowRight") {
          e.preventDefault();
          if (activeCell.colIndex + 1 < headers.length) {
            setActiveCell({
              originalRowIndex: activeCell.originalRowIndex,
              colIndex: activeCell.colIndex + 1,
            });
          }
        } else if (e.key === "ArrowLeft") {
          e.preventDefault();
          if (activeCell.colIndex > 0) {
            setActiveCell({
              originalRowIndex: activeCell.originalRowIndex,
              colIndex: activeCell.colIndex - 1,
            });
          }
        }
      }}
      onPaste={(e) => {
        if (editingCell || !activeCell) return;
        const text = e.clipboardData?.getData("text/plain");
        if (!text) return;
        const updates = parseClipboardPasteMatrix(
          text,
          activeCell.originalRowIndex,
          activeCell.colIndex,
          dataRows.length,
          headers.length
        );
        if (updates.length > 0) {
          e.preventDefault();
          batchUpdateCells(updates, enrichedDataset.id);
          if (showToast) {
            showToast(`Đã dán ${updates.length} ô dữ liệu từ Clipboard.`);
          }
        }
      }}
      tabIndex={0}
    >
      {/* Top Toolbar */}
      {!hideToolbar && (
        <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40">
          <div className="flex items-center gap-3">
            <span
              className="text-xs font-semibold text-neutral-800 dark:text-neutral-200 truncate max-w-[200px]"
              title={enrichedDataset.name}
            >
              {enrichedDataset.name}
            </span>
            <span className="text-xs text-neutral-400 dark:text-neutral-500 font-mono">
              {dataRows.length} dòng × {headers.length} cột
            </span>

            {/* Toggle Value Labels Button */}
            <button
              type="button"
              onClick={toggleShowValueLabels}
              className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs rounded-md border transition ${
                effectiveShowValueLabels
                  ? "bg-brand/10 border-brand/40 text-brand font-medium dark:bg-brand/20"
                  : "border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-600 dark:text-neutral-300"
              }`}
              title="Bật/Tắt hiển thị nhãn giá trị (Value Labels) thay cho mã số thô"
            >
              {effectiveShowValueLabels ? (
                <Eye className="w-3.5 h-3.5" />
              ) : (
                <EyeOff className="w-3.5 h-3.5" />
              )}
              <span>Value Labels</span>
            </button>
          </div>

          <div className="flex items-center gap-2">
            {/* Quick Search */}
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2 top-1/2 -translate-y-1/2 text-neutral-400 pointer-events-none" />
              <input
                type="text"
                value={effectiveQuery}
                onChange={(e) => {
                  const val = e.target.value;
                  if (onSearchQueryChange) onSearchQueryChange(val);
                  else setInternalSearch(val);
                  setPage(1);
                }}
                placeholder="Lọc dòng nhanh..."
                className="pl-7 pr-6 py-1 text-xs border border-neutral-200 dark:border-neutral-700 rounded-md bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 focus:outline-hidden focus:ring-1 focus:ring-brand w-36 sm:w-48"
              />
              {effectiveQuery && (
                <button
                  type="button"
                  onClick={() => {
                    if (onSearchQueryChange) onSearchQueryChange("");
                    else setInternalSearch("");
                    setPage(1);
                  }}
                  className="absolute right-1.5 top-1/2 -translate-y-1/2 text-neutral-400 hover:text-neutral-600"
                  aria-label="Xóa lọc"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>

            {/* Add Row Button */}
            <button
              type="button"
              onClick={() => {
                addRow(undefined, undefined, enrichedDataset.id);
                if (showToast) showToast("Đã thêm một dòng quan sát mới");
              }}
              className="flex items-center gap-1 px-2.5 py-1 text-xs font-medium border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 text-neutral-700 dark:text-neutral-300 rounded-md shadow-2xs transition"
              title="Thêm một dòng quan sát mới vào cuối bảng"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Dòng</span>
            </button>
          </div>
        </div>
      )}

      {/* Spreadsheet Grid Table */}
      <div className="flex-1 overflow-auto bg-neutral-100/30 dark:bg-neutral-950/20">
        <table className="w-full text-xs border-collapse">
          <thead className="sticky top-0 z-20 bg-neutral-100 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 font-medium border-b border-neutral-300 dark:border-neutral-700 shadow-xs">
            <tr>
              {/* Sticky Row Number Column Header */}
              <th className="sticky left-0 z-30 w-14 min-w-[56px] py-1.5 px-2 text-center font-mono font-semibold text-neutral-500 dark:text-neutral-400 bg-neutral-200/80 dark:bg-neutral-800 border-r border-neutral-300 dark:border-neutral-700 select-none">
                #
              </th>

              {headers.map((colName, ci) => {
                const meta = variablesMap[colName];
                const measure = meta?.measure ?? "nominal";
                const isRenaming = renamingCol?.colIndex === ci;
                const colWidth = meta?.width ?? 110;

                return (
                  <th
                    key={`${colName}-${ci}`}
                    style={{ minWidth: `${colWidth}px`, width: `${colWidth}px` }}
                    onContextMenu={(e) => {
                      e.preventDefault();
                      setContextMenu({
                        type: "column",
                        x: e.clientX,
                        y: e.clientY,
                        colIndex: ci,
                        colName,
                      });
                    }}
                    className="py-1.5 px-2.5 border-r border-neutral-300 dark:border-neutral-700 group hover:bg-neutral-200/60 dark:hover:bg-neutral-700/60 cursor-pointer transition select-none"
                  >
                    {isRenaming ? (
                      <div className="p-0.5">
                        <input
                          type="text"
                          value={renamingCol.draft}
                          onChange={(e) =>
                            setRenamingCol({
                              ...renamingCol,
                              draft: e.target.value,
                            })
                          }
                          onBlur={handleCommitColumnRename}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") handleCommitColumnRename();
                            if (e.key === "Escape") setRenamingCol(null);
                          }}
                          autoFocus
                          className="w-full px-1.5 py-0.5 text-xs font-mono rounded border border-brand bg-white dark:bg-neutral-900 text-neutral-900 dark:text-neutral-100 focus:outline-none"
                        />
                      </div>
                    ) : (
                      <div className="flex items-center justify-between gap-1">
                        <div
                          onClick={() => handleSortToggle(ci)}
                          className="flex items-center gap-1.5 truncate flex-1"
                          title={
                            meta?.label
                              ? `${colName} — ${meta.label} (Click để sắp xếp)`
                              : `${colName} (Click để sắp xếp)`
                          }
                        >
                          <MeasureIcon measure={measure} />
                          <span className="font-semibold truncate text-neutral-800 dark:text-neutral-200 font-mono">
                            {colName}
                          </span>
                        </div>
                        <button
                          type="button"
                          onClick={() => handleSortToggle(ci)}
                          className="opacity-0 group-hover:opacity-100 p-0.5 text-neutral-400 hover:text-neutral-600 transition"
                          title="Sắp xếp"
                        >
                          <ArrowUpDown className="w-3 h-3" />
                        </button>
                        {sortColIndex === ci && (
                          <span
                            className="text-[11px] font-bold text-brand"
                            aria-label={
                              sortDir === "asc" ? "Tăng dần" : "Giảm dần"
                            }
                          >
                            {sortDir === "asc" ? "↑" : "↓"}
                          </span>
                        )}
                      </div>
                    )}
                  </th>
                );
              })}
            </tr>
          </thead>

          <tbody className="divide-y divide-neutral-200 dark:divide-neutral-800 bg-white dark:bg-neutral-900">
            {pageRows.length === 0 ? (
              <tr>
                <td
                  colSpan={headers.length + 1}
                  className="py-12 text-center text-xs text-neutral-400 dark:text-neutral-500"
                >
                  Không có dòng dữ liệu nào khớp với tìm kiếm.
                </td>
              </tr>
            ) : (
              pageRows.map((row) => {
                const { originalRowIndex, cells } = row;
                const isRowActive =
                  activeCell?.originalRowIndex === originalRowIndex;

                return (
                  <tr
                    key={originalRowIndex}
                    className={`${
                      isRowActive
                        ? "bg-brand/5 dark:bg-brand/10"
                        : "hover:bg-neutral-50/70 dark:hover:bg-neutral-800/30"
                    } transition-colors`}
                  >
                    {/* Sticky Row Index Cell */}
                    <td
                      onClick={() =>
                        setActiveCell({ originalRowIndex, colIndex: 0 })
                      }
                      onContextMenu={(e) => {
                        e.preventDefault();
                        setActiveCell({ originalRowIndex, colIndex: 0 });
                        setContextMenu({
                          type: "row",
                          x: e.clientX,
                          y: e.clientY,
                          rowIndex: originalRowIndex,
                        });
                      }}
                      title="Click để chọn dòng, chuột phải để chèn/xóa dòng"
                      className="sticky left-0 z-10 py-1 px-2 text-center font-mono text-[11px] text-neutral-400 dark:text-neutral-500 bg-neutral-50 dark:bg-neutral-900/90 border-r border-neutral-300 dark:border-neutral-700 hover:bg-neutral-200/50 dark:hover:bg-neutral-800 cursor-pointer select-none"
                    >
                      {originalRowIndex + 1}
                    </td>

                    {/* Data Cells */}
                    {headers.map((colName, ci) => {
                      const meta = variablesMap[colName];
                      const rawValue = cells[ci] ?? "";
                      const isCellActive =
                        activeCell?.originalRowIndex === originalRowIndex &&
                        activeCell?.colIndex === ci;
                      const isCellEditing =
                        editingCell?.originalRowIndex === originalRowIndex &&
                        editingCell?.colIndex === ci;

                      const formatted = formatDisplayCellValue(
                        rawValue,
                        meta,
                        effectiveShowValueLabels
                      );

                      const alignClass =
                        meta?.align === "right"
                          ? "text-right"
                          : meta?.align === "center"
                          ? "text-center"
                          : "text-left";

                      const isMissing = isMissingValue(rawValue, meta);

                      return (
                        <td
                          key={ci}
                          onClick={() =>
                            setActiveCell({ originalRowIndex, colIndex: ci })
                          }
                          onDoubleClick={() =>
                            startEditing(originalRowIndex, ci, rawValue)
                          }
                          onContextMenu={(e) => {
                            e.preventDefault();
                            setActiveCell({ originalRowIndex, colIndex: ci });
                            setContextMenu({
                              type: "row",
                              x: e.clientX,
                              y: e.clientY,
                              rowIndex: originalRowIndex,
                            });
                          }}
                          className={`p-0 border-r border-neutral-200 dark:border-neutral-800 whitespace-nowrap cursor-cell text-xs relative ${
                            isCellActive
                              ? "ring-2 ring-inset ring-brand bg-brand/5 dark:bg-brand/15 z-1"
                              : ""
                          } ${isMissing ? "bg-rose-50/40 dark:bg-rose-950/20" : ""}`}
                        >
                          {isCellEditing ? (
                            <input
                              ref={editInputRef}
                              type="text"
                              value={editDraft}
                              onChange={(e) => setEditDraft(e.target.value)}
                              onBlur={() => commitCellEdit()}
                              onKeyDown={(e) => {
                                if (e.key === "Enter") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  commitCellEdit("down");
                                } else if (e.key === "Tab") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  commitCellEdit(e.shiftKey ? "left" : "right");
                                } else if (e.key === "Escape") {
                                  e.preventDefault();
                                  e.stopPropagation();
                                  cancelCellEdit();
                                }
                              }}
                              className={`w-full px-2 py-1.5 text-xs font-mono border-2 border-brand focus:outline-none bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 rounded ${alignClass}`}
                            />
                          ) : (
                            <div
                              className={`px-2 py-1 min-h-[26px] truncate ${alignClass} ${
                                formatted.isLabel
                                  ? "text-brand font-medium"
                                  : isMissing && rawValue.trim() === ""
                                  ? "text-neutral-400 dark:text-neutral-500 italic text-[11px]"
                                  : isMissing
                                  ? "text-rose-600 dark:text-rose-400 font-mono"
                                  : "text-neutral-900 dark:text-neutral-100 font-mono"
                              }`}
                              title={
                                formatted.isLabel
                                  ? `Giá trị mã hóa gốc: ${rawValue}`
                                  : formatted.isMissingCode
                                  ? `Mã khuyết thiếu (${rawValue})`
                                  : isMissing && rawValue.trim() === ""
                                  ? "Dữ liệu khuyết thiếu"
                                  : undefined
                              }
                            >
                              {rawValue.trim() === "" && isMissing
                                ? "(khuyết)"
                                : formatted.text}
                            </div>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>

      {/* Pagination & Status Footer Bar */}
      <div className="flex flex-wrap items-center justify-between gap-2 px-3 py-2 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/40 text-xs text-neutral-600 dark:text-neutral-400">
        <div className="flex items-center gap-2">
          <span>
            Hiển thị{" "}
            <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
              {filteredAndSorted.length === 0 ? 0 : startIdx + 1}
            </span>{" "}
            -{" "}
            <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
              {endIdx}
            </span>{" "}
            /{" "}
            <span className="font-semibold text-neutral-800 dark:text-neutral-200 font-mono">
              {filteredAndSorted.length}
            </span>{" "}
            dòng
          </span>

          <span className="text-neutral-300 dark:text-neutral-700">|</span>

          <label className="flex items-center gap-1.5">
            <span>Dòng/trang:</span>
            <select
              value={pageSize}
              onChange={(e) => {
                setPageSize(Number(e.target.value));
                setPage(1);
              }}
              aria-label="Kích thước trang"
              className="px-1.5 py-0.5 border border-neutral-200 dark:border-neutral-700 rounded bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-200 font-mono text-xs focus:outline-none focus:ring-1 focus:ring-brand"
            >
              {DATA_GRID_PAGE_SIZES.map((sz) => (
                <option key={sz} value={sz}>
                  {sz}
                </option>
              ))}
            </select>
          </label>
        </div>

        <div className="flex items-center gap-1">
          <button
            type="button"
            onClick={() => setPage(1)}
            disabled={safePage <= 1}
            className="p-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition"
            title="Trang đầu"
          >
            <ChevronsLeft className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            disabled={safePage <= 1}
            className="p-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition"
            title="Trang trước"
          >
            <ChevronLeft className="w-3.5 h-3.5" />
          </button>
          <span className="px-2 font-mono font-semibold text-neutral-800 dark:text-neutral-200">
            Trang {safePage} / {totalPages}
          </span>
          <button
            type="button"
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            disabled={safePage >= totalPages}
            className="p-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition"
            title="Trang kế"
          >
            <ChevronRight className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            onClick={() => setPage(totalPages)}
            disabled={safePage >= totalPages}
            className="p-1 rounded border border-neutral-200 dark:border-neutral-700 hover:bg-neutral-100 dark:hover:bg-neutral-800 disabled:opacity-30 transition"
            title="Trang cuối"
          >
            <ChevronsRight className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Right-click Context Menu */}
      <GridContextMenu
        menu={contextMenu}
        canDeleteColumn={headers.length > 1}
        canDeleteRow={dataRows.length > 1}
        onClose={() => setContextMenu(null)}
        onSortAsc={(colIdx) => {
          setSortColIndex(colIdx);
          setSortDir("asc");
          setPage(1);
        }}
        onSortDesc={(colIdx) => {
          setSortColIndex(colIdx);
          setSortDir("desc");
          setPage(1);
        }}
        onRenameColumn={(colIdx, colName) =>
          setRenamingCol({ colIndex: colIdx, oldName: colName, draft: colName })
        }
        onInsertColumn={() => handleInsertVariable()}
        onDeleteColumn={(colName) => {
          removeVariable(colName, enrichedDataset.id);
          if (showToast) showToast(`Đã xóa biến "${colName}"`);
        }}
        onInsertRowAbove={(rIdx) => {
          addRow(undefined, rIdx, enrichedDataset.id);
          if (showToast) showToast(`Đã chèn dòng mới tại vị trí #${rIdx + 1}`);
        }}
        onInsertRowBelow={(rIdx) => {
          addRow(undefined, rIdx + 1, enrichedDataset.id);
          if (showToast) showToast(`Đã chèn dòng mới tại vị trí #${rIdx + 2}`);
        }}
        onDeleteRow={(rIdx) => {
          removeRow(rIdx, enrichedDataset.id);
          if (showToast) showToast(`Đã xóa dòng quan sát #${rIdx + 1}`);
        }}
      />
    </div>
  );
}
