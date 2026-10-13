import { useEffect } from "react";
import {
  ArrowUpAZ,
  ArrowDownZA,
  Pencil,
  Plus,
  Trash2,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

export type GridContextMenuTarget =
  | {
      type: "column";
      x: number;
      y: number;
      colIndex: number;
      colName: string;
    }
  | {
      type: "row";
      x: number;
      y: number;
      rowIndex: number;
    };

export interface GridContextMenuProps {
  menu: GridContextMenuTarget | null;
  canDeleteColumn?: boolean;
  canDeleteRow?: boolean;
  onClose: () => void;
  onSortAsc: (colIndex: number) => void;
  onSortDesc: (colIndex: number) => void;
  onRenameColumn: (colIndex: number, colName: string) => void;
  onInsertColumn: (afterColIndex: number) => void;
  onDeleteColumn: (colName: string) => void;
  onInsertRowAbove: (rowIndex: number) => void;
  onInsertRowBelow: (rowIndex: number) => void;
  onDeleteRow: (rowIndex: number) => void;
}

export function GridContextMenu({
  menu,
  canDeleteColumn = true,
  canDeleteRow = true,
  onClose,
  onSortAsc,
  onSortDesc,
  onRenameColumn,
  onInsertColumn,
  onDeleteColumn,
  onInsertRowAbove,
  onInsertRowBelow,
  onDeleteRow,
}: GridContextMenuProps) {
  useEffect(() => {
    if (!menu) return;
    const handleKey = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    const handleScrollOrClick = () => onClose();
    window.addEventListener("keydown", handleKey);
    window.addEventListener("click", handleScrollOrClick);
    return () => {
      window.removeEventListener("keydown", handleKey);
      window.removeEventListener("click", handleScrollOrClick);
    };
  }, [menu, onClose]);

  if (!menu) return null;

  return (
    <div
      style={{
        position: "fixed",
        top: Math.min(menu.y, typeof window !== "undefined" ? window.innerHeight - 240 : menu.y),
        left: Math.min(menu.x, typeof window !== "undefined" ? window.innerWidth - 220 : menu.x),
      }}
      onClick={(e) => e.stopPropagation()}
      role="menu"
      className="z-50 w-52 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-900 shadow-xl py-1 text-xs text-neutral-800 dark:text-neutral-200"
    >
      {menu.type === "column" ? (
        <>
          <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 font-mono font-semibold text-brand truncate">
            Biến: {menu.colName}
          </div>
          <button
            type="button"
            onClick={() => {
              onSortAsc(menu.colIndex);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ArrowUpAZ className="w-3.5 h-3.5 text-neutral-500" />
            <span>Sắp xếp tăng dần (Asc)</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onSortDesc(menu.colIndex);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ArrowDownZA className="w-3.5 h-3.5 text-neutral-500" />
            <span>Sắp xếp giảm dần (Desc)</span>
          </button>
          <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
          <button
            type="button"
            onClick={() => {
              onRenameColumn(menu.colIndex, menu.colName);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Pencil className="w-3.5 h-3.5 text-neutral-500" />
            <span>Đổi tên biến...</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertColumn(menu.colIndex);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <Plus className="w-3.5 h-3.5 text-neutral-500" />
            <span>Thêm biến mới</span>
          </button>
          {canDeleteColumn && (
            <button
              type="button"
              onClick={() => {
                onDeleteColumn(menu.colName);
                onClose();
              }}
              className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
            >
              <Trash2 className="w-3.5 h-3.5" />
              <span>Xóa biến &ldquo;{menu.colName}&rdquo;</span>
            </button>
          )}
        </>
      ) : (
        <>
          <div className="px-3 py-1.5 border-b border-neutral-200 dark:border-neutral-800 font-mono font-semibold text-neutral-600 dark:text-neutral-300">
            Quan sát #{menu.rowIndex + 1}
          </div>
          <button
            type="button"
            onClick={() => {
              onInsertRowAbove(menu.rowIndex);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ArrowUp className="w-3.5 h-3.5 text-neutral-500" />
            <span>Chèn dòng phía trên</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onInsertRowBelow(menu.rowIndex);
              onClose();
            }}
            className="w-full px-3 py-1.5 text-left flex items-center gap-2 hover:bg-neutral-100 dark:hover:bg-neutral-800"
          >
            <ArrowDown className="w-3.5 h-3.5 text-neutral-500" />
            <span>Chèn dòng phía dưới</span>
          </button>
          {canDeleteRow && (
            <>
              <div className="my-1 border-t border-neutral-200 dark:border-neutral-800" />
              <button
                type="button"
                onClick={() => {
                  onDeleteRow(menu.rowIndex);
                  onClose();
                }}
                className="w-full px-3 py-1.5 text-left flex items-center gap-2 text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Xóa dòng #{menu.rowIndex + 1}</span>
              </button>
            </>
          )}
        </>
      )}
    </div>
  );
}
