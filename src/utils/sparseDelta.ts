import type { ImputationSparseCell } from "../types";

/**
 * Tái tạo bảng dữ liệu string[][] cho bộ dữ liệu thứ imputationIndex
 * (0 = dữ liệu gốc, 1..m = bộ dữ liệu đã được điền theo MICE)
 * từ bảng gốc ban đầu và cấu trúc Sparse Delta patches.
 */
export function reconstructImputedRows(
  originalRows: string[][],
  columnNames: string[],
  sparsePatches: Record<string, ImputationSparseCell[]>,
  imputationIndex: number,
  dataRowCount?: number
): string[][] {
  if (!originalRows || originalRows.length === 0) {
    return [];
  }

  const newRows = originalRows.map((row) => [...row]);

  // Index 0 biểu thị bộ dữ liệu gốc ban đầu (chưa điền)
  if (imputationIndex <= 0 || !sparsePatches) {
    return newRows;
  }

  const colNames = columnNames || (originalRows[0] ?? []);
  const hasHeader =
    (dataRowCount !== undefined && originalRows.length === dataRowCount + 1) ||
    (colNames.length > 0 && originalRows.length > 0 && originalRows[0]?.[0] === colNames[0]);

  for (const [colName, patches] of Object.entries(sparsePatches)) {
    let colIdx = colNames.indexOf(colName);
    if (colIdx === -1 && originalRows[0]) {
      colIdx = originalRows[0].indexOf(colName);
    }
    if (colIdx === -1 || !Array.isArray(patches)) continue;

    for (const patch of patches) {
      const rowIdx = hasHeader ? patch.rowIndex + 1 : patch.rowIndex;
      if (
        rowIdx >= 0 &&
        rowIdx < newRows.length &&
        patch.values &&
        patch.values[imputationIndex - 1] !== undefined
      ) {
        newRows[rowIdx][colIdx] = patch.values[imputationIndex - 1];
      }
    }
  }

  return newRows;
}
