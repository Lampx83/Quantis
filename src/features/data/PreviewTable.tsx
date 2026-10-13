import type { Dataset } from "@/types";
import { DataGrid, DATA_GRID_PAGE_SIZE_DEFAULT, DATA_GRID_PAGE_SIZES } from "./grid/DataGrid";

export const PREVIEW_PAGE_SIZE_DEFAULT = DATA_GRID_PAGE_SIZE_DEFAULT;
export const PREVIEW_PAGE_SIZES = DATA_GRID_PAGE_SIZES;

export interface PreviewTableProps {
  selectedDs: Dataset;
}

/**
 * @deprecated Thay thế bởi DataGrid & Dual-View Workspace trong DataView.tsx (Task 6 & Task 7).
 */
export function PreviewTable({ selectedDs }: PreviewTableProps) {
  return <DataGrid dataset={selectedDs} />;
}
