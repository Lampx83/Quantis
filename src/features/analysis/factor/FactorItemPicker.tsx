import { useState } from "react";
import { t } from "@/i18n";
import type { VariableMetadata } from "@/types";
import { itemLabel } from "../reliability/ItemPicker";
import { ColumnSelectionButton } from "../ColumnSelectionButton";

interface FactorItemPickerProps {
  columns: string[];
  variables?: Record<string, VariableMetadata>;
  selected: string[];
  onToggle: (name: string) => void;
}

export function filterFactorItems(columns: string[], variables: FactorItemPickerProps["variables"], query: string) {
  const needle = query.trim().toLowerCase();
  return columns.map((name) => ({ name, label: itemLabel(name, variables) }))
    .filter(({ name, label }) => name.toLowerCase().includes(needle) || label?.toLowerCase().includes(needle));
}

export function FactorItemPicker({ columns, variables, selected, onToggle }: FactorItemPickerProps) {
  const [query, setQuery] = useState("");
  const items = filterFactorItems(columns, variables, query);
  const nominal = selected.filter((name) => variables?.[name]?.measure === "nominal");
  const searchLabel = t("factorTab.itemSearch");

  return (
    <fieldset className="mb-4 min-w-0 space-y-2 text-sm">
      <legend className="font-medium">{t("factorTab.selectItemsLabel")}</legend>
      <p className="text-neutral-600 dark:text-neutral-400">{t("factorTab.itemHelp")}</p>
      <div className="flex flex-wrap items-center gap-2">
        <input
          type="search" aria-label={searchLabel} placeholder={searchLabel} value={query}
          onChange={(event) => setQuery(event.target.value)}
          className="w-full max-w-sm rounded-md border border-neutral-300 bg-white px-2 py-1.5 dark:border-neutral-600 dark:bg-neutral-800"
        />
        <span className="text-neutral-600 dark:text-neutral-400">{t("factorTab.itemsSelected", { count: selected.length })}</span>
      </div>
      <div className="flex flex-wrap gap-2">
        {items.map(({ name, label }) => (
          <ColumnSelectionButton key={name} name={name} label={label} selected={selected.includes(name)} onToggle={onToggle} />
        ))}
        {items.length === 0 && <p className="text-neutral-600 dark:text-neutral-400">{t("factorTab.noItemsMatch")}</p>}
      </div>
      {nominal.length > 0 && (
        <p role="status" className="text-amber-700 dark:text-amber-400">
          {t("factorTab.nominalItems", { items: nominal.join(", ") })}
        </p>
      )}
    </fieldset>
  );
}
