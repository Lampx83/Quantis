import { useMemo, useState } from "react";
import type { VariableMetadata } from "@/types";
import { numCell } from "@/utils/stats";
import { t } from "@/i18n";
import { ColumnSelectionButton } from "../ColumnSelectionButton";

/** Một item khả dĩ của thang đo: cột số, kèm nhãn người dùng khai và tiền tố nhóm suy ra. */
export interface ItemCandidate {
  name: string;
  /** Nhãn từ Variable View; null khi trống hoặc trùng tên biến. */
  label: string | null;
  /** Tiền tố nhóm suy từ tên (Q1_1 → "Q1"); null khi tên không có số thứ tự. */
  prefix: string | null;
  measure: VariableMetadata["measure"] | null;
}

export interface SelectionWarning {
  key: string;
  params: Record<string, string | number>;
}

export interface ItemPickerProps {
  rows: string[][];
  columns: string[];
  variables?: Record<string, VariableMetadata>;
  selected: string[];
  onToggle: (column: string) => void;
}

const trimmed = (raw: unknown): string => (raw === null || raw === undefined ? "" : String(raw).trim());

/**
 * Cột nào được phép chọn làm item.
 *
 * Luật cũ coi cột toàn ô trống là "numeric" vì `Number("") === 0`; ở đây một cột chỉ hợp lệ khi
 * có ÍT NHẤT một giá trị số và mọi ô không trống đều là số. Mã khuyết người dùng khai đã được
 * `getAnalysisRows()` thay bằng "" trước khi tới đây, nên cột chỉ có mã khuyết vẫn được giữ.
 */
export function numericItemColumns(rows: string[][], columns: string[]): string[] {
  const header = rows[0] ?? [];
  const dataRows = rows.slice(1);
  return columns.filter((name) => {
    const ci = header.indexOf(name);
    if (ci < 0) return false;
    let hasNumber = false;
    for (const row of dataRows) {
      const value = trimmed(row[ci]);
      if (value === "") continue;
      if (Number.isNaN(numCell(value))) return false;
      hasNumber = true;
    }
    return hasNumber;
  });
}

/** Nhãn hiển thị cạnh tên item; tránh lặp lại đúng tên biến. */
export function itemLabel(
  column: string,
  variables?: Record<string, VariableMetadata>
): string | null {
  const label = variables?.[column]?.label?.trim();
  return label && label !== column ? label : null;
}

/** Tiền tố nhóm: bỏ phần số thứ tự cuối tên (Q1_1 → Q1, câu_1 → câu, Q1 → null). */
export function prefixOf(name: string): string | null {
  const match = name.match(/^(.*?)[\s_-]*\d+$/);
  if (!match) return null;
  const prefix = match[1].replace(/[\s_-]+$/, "");
  return prefix === "" ? null : prefix;
}

/** Danh sách item đang hiển thị, đã lọc theo tên hoặc nhãn (không phân biệt hoa thường). */
export function visibleItems(
  rows: string[][],
  columns: string[],
  variables?: Record<string, VariableMetadata>,
  query = ""
): ItemCandidate[] {
  const needle = query.trim().toLowerCase();
  return numericItemColumns(rows, columns)
    .filter((name) => {
      if (needle === "") return true;
      const label = itemLabel(name, variables) ?? "";
      return name.toLowerCase().includes(needle) || label.toLowerCase().includes(needle);
    })
    .map((name) => ({
      name,
      label: itemLabel(name, variables),
      prefix: prefixOf(name),
      measure: variables?.[name]?.measure ?? null,
    }));
}

/** Gom item theo tiền tố, giữ thứ tự xuất hiện; item không có tiền tố nằm ở nhóm `prefix: null`. */
export function groupItems(items: ItemCandidate[]): Array<{ prefix: string | null; items: ItemCandidate[] }> {
  const groups: Array<{ prefix: string | null; items: ItemCandidate[] }> = [];
  const byPrefix = new Map<string, number>();
  for (const item of items) {
    const key = item.prefix ?? "";
    let at = byPrefix.get(key);
    if (at === undefined) {
      at = groups.length;
      byPrefix.set(key, at);
      groups.push({ prefix: item.prefix, items: [] });
    }
    groups[at].items.push(item);
  }
  return groups;
}

/** Khoảng giá trị quan sát của một cột (bỏ ô trống); null khi không có số nào. */
function observedRange(rows: string[][], column: string): { min: number; max: number } | null {
  const header = rows[0] ?? [];
  const ci = header.indexOf(column);
  if (ci < 0) return null;
  let min = Infinity;
  let max = -Infinity;
  for (const row of rows.slice(1)) {
    const value = trimmed(row[ci]);
    if (value === "") continue;
    const n = numCell(value);
    if (Number.isNaN(n)) continue;
    if (n < min) min = n;
    if (n > max) max = n;
  }
  return min === Infinity ? null : { min, max };
}

/**
 * Cảnh báo KHÔNG chặn trước khi tính: item khai nominal, hoặc các item trộn thang trả lời.
 *
 * Thang trộn được suy từ khoảng giá trị quan sát (1–5 so với 1–7): α thô phụ thuộc phương sai
 * từng item nên trộn thang làm nó sai lệch; α chuẩn hóa mới là số nên đọc.
 */
export function selectionWarnings(
  rows: string[][],
  selected: string[],
  variables?: Record<string, VariableMetadata>
): SelectionWarning[] {
  const warnings: SelectionWarning[] = [];
  const nominal = selected.filter((name) => variables?.[name]?.measure === "nominal");
  if (nominal.length > 0) {
    warnings.push({
      key: "reliabilityTab.warnNominalItems",
      params: { items: nominal.join(", ") },
    });
  }

  const ranges = selected
    .map((name) => ({ name, range: observedRange(rows, name) }))
    .filter((entry): entry is { name: string; range: { min: number; max: number } } => entry.range !== null);
  const distinctRanges = new Set(ranges.map((entry) => `${entry.range.min}|${entry.range.max}`));
  if (ranges.length >= 2 && distinctRanges.size > 1) {
    warnings.push({
      key: "reliabilityTab.warnMixedValueSets",
      params: {
        details: ranges.map((entry) => `${entry.name} ${entry.range.min}–${entry.range.max}`).join("; "),
      },
    });
  }
  return warnings;
}

export function ItemPicker({ rows, columns, variables, selected, onToggle }: ItemPickerProps) {
  const [query, setQuery] = useState("");
  const groups = useMemo(
    () => groupItems(visibleItems(rows, columns, variables, query)),
    [rows, columns, variables, query]
  );
  const warnings = selectionWarnings(rows, selected, variables);

  return (
    <div className="mb-4" data-testid="item-picker">
      <div className="flex flex-wrap items-baseline gap-2 mb-2">
        <p className="text-sm font-medium">{t("reliabilityTab.selectItemsLabel")}</p>
        <span className="text-xs text-neutral-500 dark:text-neutral-400">
          {t("reliabilityTab.selectedCount", { count: selected.length })}
        </span>
      </div>
      <input
        type="search"
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder={t("reliabilityTab.filterPlaceholder")}
        aria-label={t("reliabilityTab.filterPlaceholder")}
        className="w-full max-w-sm rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2 py-1.5 text-sm mb-2"
      />
      {groups.length === 0 && (
        <p className="text-sm text-neutral-500 dark:text-neutral-400">{t("reliabilityTab.noItemsMatch")}</p>
      )}
      {groups.map((group) => (
        <div key={group.prefix ?? "\u0000"} className="mt-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-500 dark:text-neutral-400">
            {group.prefix ?? t("reliabilityTab.ungrouped")}
          </p>
          <div className="flex flex-wrap gap-2 mt-1">
            {group.items.map(({ name, label }) => (
              <ColumnSelectionButton key={name} name={name} label={label} selected={selected.includes(name)} onToggle={onToggle} />
            ))}
          </div>
        </div>
      ))}
      {warnings.map((warning) => (
        <p
          key={warning.key}
          className="mt-2 text-xs text-amber-700 dark:text-amber-400"
          data-testid={`item-picker-warning-${warning.key.split(".").pop()}`}
        >
          {t(warning.key, warning.params)}
        </p>
      ))}
    </div>
  );
}
