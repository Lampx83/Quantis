import { useMemo, useState } from "react";
import type { Dataset } from "@/types";
import { computeReliability } from "@/utils/reliability";
import { t, aiAnswerLangHint } from "@/i18n";
import { AIAssistPanel } from "@/features/ai";
import { InfoHint, GlossaryBar } from "@/components/common/InfoHint";
import { ItemPicker, numericItemColumns } from "../reliability/ItemPicker";
import { ItemTable } from "../reliability/ItemTable";
import { ItemCorrelationMatrix } from "../reliability/ItemCorrelationMatrix";
import { formatStat } from "../reliability/format";

export interface ReliabilityTabProps {
  selectedDataset: Dataset;
  rows: string[][];
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
  const items = result?.items ?? [];
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
            context={`Cronbach's alpha = ${formatStat(stats.alpha, 4)}. Số item: ${stats.k}. n(Scale sample) = ${stats.nScaleSample}/${stats.nInput}. α chuẩn hóa = ${formatStat(stats.alphaStandardized, 4)}. KTC 95% = ${ci ? `[${formatStat(ci.lower, 4)}, ${formatStat(ci.upper, 4)}]` : "—"}. Các item: ${selectedItems.join(", ")}.${items.length ? ` Bảng biến–tổng: ${items.map((it) => `${it.name} (corrected item-total=${formatStat(it.correctedItemTotal)}, α nếu loại=${formatStat(it.alphaIfDeleted)})`).join("; ")}.` : ""}`}
            quickPrompts={[
              {
                label: t("reliabilityTab.interpretAlphaLabel"),
                systemHint: `${t("reliabilityTab.interpretAlphaHint")} ${aiAnswerLangHint()}`,
              },
            ]}
            title={t("reliabilityTab.askAiAlphaTitle")}
          />
          <p className="font-medium">
            {t("reliabilityTab.alphaLabel")} = {formatStat(stats.alpha)}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {t("reliabilityTab.alphaStandardizedLabel")}: {formatStat(stats.alphaStandardized)} ·{" "}
            {t("reliabilityTab.ciLabel")}{" "}
            {ci ? `[${formatStat(ci.lower)}, ${formatStat(ci.upper)}]` : "—"}
          </p>
          <p className="text-sm text-neutral-600 dark:text-neutral-400 mt-1">
            {t("reliabilityTab.kLabel")}: {stats.k} · {t("reliabilityTab.nCasesLabel")}:{" "}
            {stats.nScaleSample} · {t("reliabilityTab.nInputLabel")}: {stats.nInput}
          </p>
        </div>
      )}
      {result && (
        <>
          <ItemTable items={result.items} />
          <ItemCorrelationMatrix
            data={result.sample.data}
            names={selectedItems}
            meanInterItemR={result.statistics.meanInterItemR}
          />
        </>
      )}
    </div>
  );
}
