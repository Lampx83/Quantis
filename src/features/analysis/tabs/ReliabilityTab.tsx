import { useMemo, useState } from "react";
import type { Dataset } from "@/types";
import { computeReliability } from "@/utils/reliability";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";
import { InfoHint, GlossaryBar } from "@/components/common/InfoHint";
import { ItemPicker, numericItemColumns } from "../reliability/ItemPicker";

export interface ReliabilityTabProps {
  selectedDataset: Dataset;
  rows: string[][];
}

/** Số có 3 chữ số thập phân; ô không tính được in "—" thay vì 0 hay NaN. */
function fmt(x: number | null | undefined, digits = 3): string {
  return x == null || Number.isNaN(x) ? "—" : x.toFixed(digits);
}

export function ReliabilityTab({ selectedDataset, rows }: ReliabilityTabProps) {
  const [selectedItems, setSelectedItems] = useState<string[]>([]);
  const itemKey = selectedItems.join("\u0001");
  const columns = selectedDataset.columnNames ?? [];
  // Cùng một bộ lọc với picker: cột toàn ô trống không còn được coi là item.
  const itemColumns = useMemo(() => numericItemColumns(rows, columns), [rows, columns]);

  // Mọi số liệu đến từ MỘT Scale sample listwise (computeReliability): headline α và bảng item
  // không thể lệch mẫu nhau, và không còn đường tính thứ hai ở Python (ADR-0002).
  const result = useMemo(
    () => (selectedItems.length >= 2 ? computeReliability(rows, selectedItems) : null),
    [rows, itemKey]
  );

  const toggle = (c: string) =>
    setSelectedItems((prev) =>
      prev.includes(c) ? prev.filter((x) => x !== c) : [...prev, c]
    );

  const stats = result?.statistics;
  const items = result?.itemStatistics ?? [];
  const ci = stats?.ci;

  return (
    <div className="w-full max-w-full">
      <h2 className="text-xl font-semibold mb-2">{t("reliabilityTab.title")}<InfoHint term="cronbachAlpha" /></h2>
      <GlossaryBar terms={["cronbachAlpha", "correctedItemTotal", "alphaIfDeleted"]} />
      <p className="text-neutral-600 dark:text-neutral-400 mb-4">{t("reliabilityTab.description")}</p>
      <div className="mb-4">
        <AIAssistPanel
          metadata={
            selectedDataset
              ? `Dataset: ${selectedDataset.name}. Số cột số: ${itemColumns.length}. Cột: ${itemColumns.slice(0, 15).join(", ")}${itemColumns.length > 15 ? "…" : ""}.`
              : undefined
          }
          context={t("reliabilityTab.contextDesc")}
          quickPrompts={[
            {
              label: t("reliabilityTab.explainAlphaLabel"),
              systemHint: `${t("reliabilityTab.explainAlphaHint")} ${aiAnswerLangHint()}`,
            },
          ]}
          title={t("reliabilityTab.askAiTitle")}
        />
      </div>
      <ItemPicker
        rows={rows}
        columns={columns}
        variables={selectedDataset.variables}
        selected={selectedItems}
        onToggle={toggle}
      />
      {stats && (
        <div
          className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 p-4"
          data-testid="reliability-summary"
        >
          <AIAssistPanel
            context={`Cronbach's alpha = ${fmt(stats.alpha, 4)}. Số item: ${stats.k}. n(Scale sample) = ${stats.nScaleSample}/${stats.nInput}. α chuẩn hóa = ${fmt(stats.alphaStandardized, 4)}. KTC 95% = ${ci ? `[${fmt(ci.lower, 4)}, ${fmt(ci.upper, 4)}]` : "—"}. Các item: ${selectedItems.join(", ")}.${items.length ? ` Bảng biến–tổng: ${items.map((it) => `${it.name} (corrected item-total=${fmt(it.correctedItemTotal)}, α nếu loại=${fmt(it.alphaIfDeleted)})`).join("; ")}.` : ""}`}
            quickPrompts={[
              {
                label: t("reliabilityTab.interpretAlphaLabel"),
                systemHint: `${t("reliabilityTab.interpretAlphaHint")} ${aiAnswerLangHint()}`,
              },
            ]}
            title={t("reliabilityTab.askAiAlphaTitle")}
          />
          <p className="font-medium">
            {t("reliabilityTab.alphaLabel")} = {fmt(stats.alpha)}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {t("reliabilityTab.alphaStandardizedLabel")}: {fmt(stats.alphaStandardized)} ·{" "}
            {t("reliabilityTab.ciLabel")}{" "}
            {ci ? `[${fmt(ci.lower)}, ${fmt(ci.upper)}]` : "—"}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {t("reliabilityTab.kLabel")}: {stats.k} · {t("reliabilityTab.nCasesLabel")}:{" "}
            {stats.nScaleSample} · {t("reliabilityTab.nInputLabel")}: {stats.nInput}
          </p>
        </div>
      )}
      {result && (
        <div
          className="mt-4 rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-x-auto text-sm"
          data-testid="item-total-table"
        >
          <p className="font-medium p-2 border-b border-neutral-200 dark:border-neutral-700">
            {t("reliabilityTab.itemTotalTitle")}
            <span className="ml-2 font-normal text-neutral-500">
              ({t("reliabilityTab.nCasesLabel")}: {result.statistics.nScaleSample})
            </span>
          </p>
          <table className="w-full">
            <thead>
              <tr className="border-b border-neutral-200 dark:border-neutral-600">
                <th className="text-left p-2">{t("reliabilityTab.colItem")}</th>
                <th className="text-right p-2">
                  {t("reliabilityTab.colCitc")}
                  <InfoHint term="correctedItemTotal" />
                </th>
                <th className="text-right p-2">
                  {t("reliabilityTab.colAlphaDel")}
                  <InfoHint term="alphaIfDeleted" />
                </th>
              </tr>
            </thead>
            <tbody>
              {items.map((it) => (
                <tr key={it.name} className="border-b border-neutral-100 dark:border-neutral-700/50">
                  <td className="p-2 font-medium">{it.name}</td>
                  <td className="p-2 text-right">{fmt(it.correctedItemTotal)}</td>
                  <td className="p-2 text-right">{fmt(it.alphaIfDeleted)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="p-2 text-xs text-neutral-600 dark:text-neutral-400 space-y-1">
            {result.statistics.k < 3 && <p>{t("reliabilityTab.needThreeItems")}</p>}
          </div>
        </div>
      )}
    </div>
  );
}
