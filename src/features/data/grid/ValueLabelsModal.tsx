import React, { useState, useEffect, useMemo } from "react";
import { X, Plus, Trash2, Sparkles, Check, Tag } from "lucide-react";
import { t, getLocale } from "../../../i18n";

export function getQuickValueLabelTemplates(): Record<
  "likert5" | "gender" | "binary",
  Record<string, string>
> {
  const locale = getLocale();
  if (locale === "vi") {
    return {
      likert5: {
        "1": "Hoàn toàn không đồng ý",
        "2": "Không đồng ý",
        "3": "Trung lập",
        "4": "Đồng ý",
        "5": "Hoàn toàn đồng ý",
      },
      gender: {
        "1": "Nam",
        "2": "Nữ",
        "3": "Khác",
      },
      binary: {
        "0": "Không",
        "1": "Có",
      },
    };
  }
  return {
    likert5: {
      "1": "Strongly disagree",
      "2": "Disagree",
      "3": "Neutral",
      "4": "Agree",
      "5": "Strongly agree",
    },
    gender: {
      "1": "Male",
      "2": "Female",
      "3": "Other",
    },
    binary: {
      "0": "No",
      "1": "Yes",
    },
  };
}

export const QUICK_VALUE_LABEL_TEMPLATES = new Proxy(
  {} as Record<"likert5" | "gender" | "binary", Record<string, string>>,
  {
    get(_target, prop: "likert5" | "gender" | "binary") {
      return getQuickValueLabelTemplates()[prop];
    },
  }
);

export function upsertValueLabel(
  current: Record<string, string>,
  rawValue: string,
  rawLabel: string
): { next: Record<string, string>; error?: string } {
  const val = rawValue.trim();
  const lbl = rawLabel.trim();

  if (!val) {
    return { next: current, error: t("valueLabelsModal.errorEmptyValue") };
  }
  if (!lbl) {
    return { next: current, error: t("valueLabelsModal.errorEmptyLabel") };
  }

  return {
    next: {
      ...current,
      [val]: lbl,
    },
  };
}

export function removeValueLabel(
  current: Record<string, string>,
  key: string
): Record<string, string> {
  const next = { ...current };
  delete next[key];
  return next;
}

export function formatValueLabelsSummary(
  valueLabels?: Record<string, string>
): string {
  const noneText = t("variableView.noneValue");
  if (!valueLabels) return noneText;
  const entries = Object.entries(valueLabels);
  if (entries.length === 0) return noneText;
  const sorted = [...entries].sort(([a], [b]) => {
    const na = Number(a);
    const nb = Number(b);
    if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
    return a.localeCompare(b);
  });
  const preview = sorted
    .slice(0, 2)
    .map(([k, v]) => `${k}="${v}"`)
    .join(", ");
  return sorted.length > 2 ? `{${preview}, …}` : `{${preview}}`;
}

export interface ValueLabelsModalProps {
  isOpen: boolean;
  variableName: string;
  initialValueLabels?: Record<string, string>;
  onSave: (valueLabels: Record<string, string>) => void;
  onClose: () => void;
}

export function ValueLabelsModal({
  isOpen,
  variableName,
  initialValueLabels,
  onSave,
  onClose,
}: ValueLabelsModalProps) {
  const [labels, setLabels] = useState<Record<string, string>>(
    () => ({ ...(initialValueLabels ?? {}) })
  );
  const [inputValue, setInputValue] = useState("");
  const [inputLabel, setInputLabel] = useState("");
  const [selectedKey, setSelectedKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setLabels({ ...(initialValueLabels ?? {}) });
      setInputValue("");
      setInputLabel("");
      setSelectedKey(null);
      setError(null);
    }
  }, [isOpen, initialValueLabels, variableName]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  const sortedEntries = useMemo(() => {
    return Object.entries(labels).sort(([a], [b]) => {
      const na = Number(a);
      const nb = Number(b);
      if (!Number.isNaN(na) && !Number.isNaN(nb)) return na - nb;
      return a.localeCompare(b);
    });
  }, [labels]);

  if (!isOpen) return null;

  const handleUpsert = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    const res = upsertValueLabel(labels, inputValue, inputLabel);
    if (res.error) {
      setError(res.error);
      return;
    }
    setLabels(res.next);
    setSelectedKey(inputValue.trim());
    setInputValue("");
    setInputLabel("");
    setError(null);
  };

  const handleSelectEntry = (k: string, v: string) => {
    setSelectedKey(k);
    setInputValue(k);
    setInputLabel(v);
    setError(null);
  };

  const handleRemoveKey = (k: string) => {
    setLabels((prev) => removeValueLabel(prev, k));
    if (selectedKey === k) {
      setSelectedKey(null);
      setInputValue("");
      setInputLabel("");
    }
  };

  const applyTemplate = (templateKey: "likert5" | "gender" | "binary") => {
    const templates = getQuickValueLabelTemplates();
    setLabels({ ...templates[templateKey] });
    setSelectedKey(null);
    setInputValue("");
    setInputLabel("");
    setError(null);
  };

  const handleSave = () => {
    onSave(labels);
    onClose();
  };

  const titlePrefix = t("valueLabelsModal.title", { name: "" }).split("—")[0].trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-md shadow-2xl max-w-2xl w-full border border-neutral-200 dark:border-neutral-700 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="value-labels-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-brand/10 text-brand">
              <Tag className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="value-labels-modal-title"
                className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
              >
                {titlePrefix} —{" "}
                <span className="font-mono text-brand">{variableName}</span>
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t("valueLabelsModal.subtitle")}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-md text-neutral-500 hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors"
            aria-label={t("variableView.closeBanner")}
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Quick Templates Bar */}
        <div className="px-5 py-2.5 bg-neutral-100/70 dark:bg-neutral-800/30 border-b border-neutral-200 dark:border-neutral-800 flex flex-wrap items-center gap-2">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-neutral-600 dark:text-neutral-400 mr-1">
            <Sparkles className="w-3.5 h-3.5 text-amber-500" />
            {t("valueLabelsModal.quickTemplates")}
          </span>
          <button
            type="button"
            onClick={() => applyTemplate("likert5")}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-brand hover:text-brand transition-colors"
          >
            {t("valueLabelsModal.templateLikert5")}
          </button>
          <button
            type="button"
            onClick={() => applyTemplate("gender")}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-brand hover:text-brand transition-colors"
          >
            {t("valueLabelsModal.templateGender")}
          </button>
          <button
            type="button"
            onClick={() => applyTemplate("binary")}
            className="px-2.5 py-1 rounded-md text-xs font-medium bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 text-neutral-700 dark:text-neutral-200 hover:border-brand hover:text-brand transition-colors"
          >
            {t("valueLabelsModal.templateBinary")}
          </button>
          {sortedEntries.length > 0 && (
            <button
              type="button"
              onClick={() => {
                setLabels({});
                setSelectedKey(null);
              }}
              className="ml-auto px-2 py-1 rounded-md text-xs text-rose-600 dark:text-rose-400 hover:bg-rose-50 dark:hover:bg-rose-950/40 transition-colors"
            >
              {t("valueLabelsModal.clearAll")}
            </button>
          )}
        </div>

        {/* Two-column Body */}
        <div className="p-5 grid grid-cols-1 md:grid-cols-12 gap-5">
          {/* Left Column: Input Form */}
          <form onSubmit={handleUpsert} className="md:col-span-5 flex flex-col gap-3">
            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t("valueLabelsModal.valueFieldLabel")}
              </label>
              <input
                type="text"
                value={inputValue}
                onChange={(e) => {
                  setInputValue(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t("valueLabelsModal.valuePlaceholder")}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            <div>
              <label className="block text-xs font-medium text-neutral-700 dark:text-neutral-300 mb-1">
                {t("valueLabelsModal.labelFieldLabel")}
              </label>
              <input
                type="text"
                value={inputLabel}
                onChange={(e) => {
                  setInputLabel(e.target.value);
                  if (error) setError(null);
                }}
                placeholder={t("valueLabelsModal.labelPlaceholder")}
                className="w-full px-3 py-1.5 text-sm rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand"
              />
            </div>

            {error && (
              <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5 rounded-md">
                {error}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="submit"
                className="flex-1 inline-flex items-center justify-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium bg-brand text-white hover:opacity-90 transition-opacity"
              >
                <Plus className="w-3.5 h-3.5" />
                {inputValue.trim() && labels[inputValue.trim()] !== undefined
                  ? t("valueLabelsModal.updateButton")
                  : t("valueLabelsModal.addButton")}
              </button>
              {selectedKey && labels[selectedKey] !== undefined && (
                <button
                  type="button"
                  onClick={() => handleRemoveKey(selectedKey)}
                  className="inline-flex items-center justify-center gap-1 px-2.5 py-1.5 rounded-md text-xs font-medium bg-rose-50 dark:bg-rose-950/40 text-rose-600 dark:text-rose-400 hover:bg-rose-100 dark:hover:bg-rose-900/50 transition-colors"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  {t("valueLabelsModal.removeButton")}
                </button>
              )}
            </div>
          </form>

          {/* Right Column: Value-Label List */}
          <div className="md:col-span-7 flex flex-col">
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-medium text-neutral-700 dark:text-neutral-300">
                {t("valueLabelsModal.mappingListTitle", { count: sortedEntries.length })}
              </span>
              <span className="text-[11px] text-neutral-400">
                {t("valueLabelsModal.mappingListHint")}
              </span>
            </div>

            <div className="border border-neutral-200 dark:border-neutral-700 rounded-md bg-neutral-50/50 dark:bg-neutral-950/40 h-56 overflow-y-auto divide-y divide-neutral-200/70 dark:divide-neutral-800">
              {sortedEntries.length === 0 ? (
                <div className="h-full flex items-center justify-center text-xs text-neutral-400 p-4 text-center">
                  {t("valueLabelsModal.emptyList")}
                </div>
              ) : (
                sortedEntries.map(([k, v]) => {
                  const isSelected = selectedKey === k;
                  return (
                    <div
                      key={k}
                      onClick={() => handleSelectEntry(k, v)}
                      className={`flex items-center justify-between px-3 py-2 text-xs cursor-pointer transition-colors ${
                        isSelected
                          ? "bg-brand/10 dark:bg-brand/20 text-brand font-medium"
                          : "hover:bg-neutral-100 dark:hover:bg-neutral-800/60 text-neutral-800 dark:text-neutral-200"
                      }`}
                    >
                      <div className="truncate pr-2">
                        <span className="font-mono font-semibold px-1.5 py-0.5 rounded bg-neutral-200/70 dark:bg-neutral-800 mr-2">
                          {k}
                        </span>
                        <span className="text-neutral-400 mr-1.5">=</span>
                        <span>&ldquo;{v}&rdquo;</span>
                      </div>
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleRemoveKey(k);
                        }}
                        className="p-1 rounded text-neutral-400 hover:text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/40"
                        title={t("valueLabelsModal.removeLabelTitle")}
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  );
                })
              )}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-3 border-t border-neutral-200 dark:border-neutral-800 bg-neutral-50/50 dark:bg-neutral-800/30">
          <button
            type="button"
            onClick={onClose}
            className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-neutral-200/80 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
          >
            {t("valueLabelsModal.cancelButton")}
          </button>
          <button
            type="button"
            onClick={handleSave}
            className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium bg-brand text-white hover:opacity-90 transition-opacity"
          >
            <Check className="w-3.5 h-3.5" />
            {t("valueLabelsModal.saveButton")}
          </button>
        </div>
      </div>
    </div>
  );
}
