import React, { useState, useEffect } from "react";
import { X, AlertCircle, Check } from "lucide-react";
import { t } from "../../../i18n";

export type MissingValuesMode = "none" | "discrete" | "range";

export type MissingRange = { min: number; max: number };

export function parseAndValidateDiscreteMissing(inputs: string[]): {
  valid: boolean;
  values: string[];
  error?: string;
} {
  const cleaned = inputs.map((v) => v.trim()).filter((v) => v !== "");

  if (cleaned.length > 3) {
    return {
      valid: false,
      values: cleaned.slice(0, 3),
      error: t("missingValuesModal.errorMaxCodes"),
    };
  }

  const unique = new Set(cleaned);
  if (unique.size !== cleaned.length) {
    return {
      valid: false,
      values: cleaned,
      error: t("missingValuesModal.errorDuplicateCodes"),
    };
  }

  return {
    valid: true,
    values: cleaned,
  };
}

/**
 * Kiểm tra khoảng khuyết (kiểu SPSS): hai biên là số hữu hạn và min <= max;
 * kèm tối đa 1 mã rời rạc (SPSS: «khoảng + 1 mã rời rạc»).
 */
export function parseAndValidateRangeMissing(
  minInput: string,
  maxInput: string,
  extraCodes: string[]
): { valid: boolean; range?: MissingRange; values: string[]; error?: string } {
  const toNum = (v: string) => (v.trim() === "" ? NaN : Number(v.trim().replace(",", ".")));
  const min = toNum(minInput);
  const max = toNum(maxInput);
  const values = extraCodes.map((v) => v.trim()).filter((v) => v !== "");
  if (!Number.isFinite(min) || !Number.isFinite(max) || min > max) {
    return { valid: false, values, error: t("missingValuesModal.errorRangeInvalid") };
  }
  if (values.length > 1) {
    return { valid: false, values: values.slice(0, 1), error: t("missingValuesModal.errorRangeOneCode") };
  }
  return { valid: true, range: { min, max }, values };
}

export function formatMissingValuesSummary(
  missingValues?: string[],
  missingRange?: MissingRange
): string {
  const parts: string[] = [];
  if (missingRange) parts.push(`${missingRange.min} – ${missingRange.max}`);
  if (missingValues && missingValues.length > 0) parts.push(...missingValues);
  if (parts.length === 0) return t("variableView.noneValue");
  return parts.join(", ");
}

export interface MissingValuesModalProps {
  isOpen: boolean;
  variableName: string;
  initialMissingValues?: string[];
  /** Khoảng khuyết hiện có (SPSS: tối đa 1 khoảng + 1 mã rời rạc). */
  initialMissingRange?: MissingRange;
  /** `missingRange` là undefined khi người dùng không dùng khoảng (xóa khoảng cũ nếu có). */
  onSave: (missingValues: string[], missingRange?: MissingRange) => void;
  onClose: () => void;
}

export function MissingValuesModal({
  isOpen,
  variableName,
  initialMissingValues,
  initialMissingRange,
  onSave,
  onClose,
}: MissingValuesModalProps) {
  const initialMode = (
    vals?: string[],
    range?: MissingRange
  ): MissingValuesMode => (range ? "range" : vals && vals.length > 0 ? "discrete" : "none");
  const [mode, setMode] = useState<MissingValuesMode>(
    initialMode(initialMissingValues, initialMissingRange)
  );
  const [rangeMin, setRangeMin] = useState(initialMissingRange ? String(initialMissingRange.min) : "");
  const [rangeMax, setRangeMax] = useState(initialMissingRange ? String(initialMissingRange.max) : "");
  // Mã rời rạc đi kèm khoảng (SPSS: tối đa 1) — tách riêng khỏi 3 ô của chế độ «rời rạc».
  const [rangeExtra, setRangeExtra] = useState(
    initialMissingRange ? (initialMissingValues?.[0] ?? "") : ""
  );
  const [slots, setSlots] = useState<[string, string, string]>(() => [
    initialMissingValues?.[0] ?? "",
    initialMissingValues?.[1] ?? "",
    initialMissingValues?.[2] ?? "",
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      setMode(initialMode(initialMissingValues, initialMissingRange));
      setRangeMin(initialMissingRange ? String(initialMissingRange.min) : "");
      setRangeMax(initialMissingRange ? String(initialMissingRange.max) : "");
      setRangeExtra(initialMissingRange ? (initialMissingValues?.[0] ?? "") : "");
      const discreteInit = initialMissingRange ? [] : (initialMissingValues ?? []);
      setSlots([discreteInit[0] ?? "", discreteInit[1] ?? "", discreteInit[2] ?? ""]);
      setError(null);
    }
  }, [isOpen, initialMissingValues, initialMissingRange, variableName]);

  useEffect(() => {
    if (!isOpen) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") onClose();
    };
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  const handleSlotChange = (index: 0 | 1 | 2, value: string) => {
    setSlots((prev) => {
      const next: [string, string, string] = [...prev] as [string, string, string];
      next[index] = value;
      return next;
    });
    if (mode !== "discrete") {
      setMode("discrete");
    }
    if (error) setError(null);
  };

  const applyPreset = (preset: [string, string, string]) => {
    setMode("discrete");
    setSlots(preset);
    setError(null);
  };

  const handleSave = (e?: React.FormEvent) => {
    if (e) e.preventDefault();
    if (mode === "none") {
      onSave([], undefined);
      onClose();
      return;
    }

    if (mode === "range") {
      const rv = parseAndValidateRangeMissing(rangeMin, rangeMax, [rangeExtra]);
      if (!rv.valid) {
        setError(rv.error ?? t("missingValuesModal.errorInvalidValue"));
        return;
      }
      onSave(rv.values, rv.range);
      onClose();
      return;
    }

    const validation = parseAndValidateDiscreteMissing(slots);
    if (!validation.valid) {
      setError(validation.error ?? t("missingValuesModal.errorInvalidValue"));
      return;
    }

    onSave(validation.values, undefined);
    onClose();
  };

  const titlePrefix = t("missingValuesModal.title", { name: "" }).split("—")[0].trim();

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-md shadow-2xl max-w-md w-full border border-neutral-200 dark:border-neutral-700 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="missing-values-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-md bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="missing-values-modal-title"
                className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
              >
                {titlePrefix} —{" "}
                <span className="font-mono text-brand">{variableName}</span>
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                {t("missingValuesModal.subtitle")}
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

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
          {/* Option 1: No missing values */}
          <label
            className={`flex items-start gap-3 p-3 rounded-md border cursor-pointer transition-colors ${
              mode === "none"
                ? "border-brand bg-brand/5 dark:bg-brand/10"
                : "border-neutral-200 dark:border-neutral-700 hover:bg-neutral-50 dark:hover:bg-neutral-800/50"
            }`}
          >
            <input
              type="radio"
              name="missingMode"
              checked={mode === "none"}
              onChange={() => {
                setMode("none");
                setError(null);
              }}
              className="mt-0.5 accent-brand"
            />
            <div>
              <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                {t("missingValuesModal.optionNoneTitle")}
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                {t("missingValuesModal.optionNoneDesc")}
              </div>
            </div>
          </label>

          {/* Option 2: Discrete missing values */}
          <div
            className={`p-3 rounded-md border transition-colors ${
              mode === "discrete"
                ? "border-brand bg-brand/5 dark:bg-brand/10"
                : "border-neutral-200 dark:border-neutral-700"
            }`}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="missingMode"
                checked={mode === "discrete"}
                onChange={() => setMode("discrete")}
                className="mt-0.5 accent-brand"
              />
              <div>
                <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  {t("missingValuesModal.optionDiscreteTitle")}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t("missingValuesModal.optionDiscreteDesc")}
                </div>
              </div>
            </label>

            <div className="mt-3 pl-6 flex flex-col gap-2.5">
              <div className="grid grid-cols-3 gap-2">
                {([0, 1, 2] as const).map((idx) => (
                  <div key={idx}>
                    <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                      {t("missingValuesModal.codeSlot", { index: idx + 1 })}
                    </label>
                    <input
                      type="text"
                      value={slots[idx]}
                      onChange={(e) => handleSlotChange(idx, e.target.value)}
                      placeholder={idx === 0 ? "99" : idx === 1 ? "999" : "-1"}
                      className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand"
                    />
                  </div>
                ))}
              </div>

              <div className="flex items-center gap-1.5 flex-wrap">
                <span className="text-[11px] text-neutral-500">{t("missingValuesModal.quickPresets")}</span>
                <button
                  type="button"
                  onClick={() => applyPreset(["99", "", ""])}
                  className="px-2 py-0.5 text-[11px] font-mono rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:text-brand"
                >
                  99
                </button>
                <button
                  type="button"
                  onClick={() => applyPreset(["99", "999", "-1"])}
                  className="px-2 py-0.5 text-[11px] font-mono rounded bg-neutral-200/70 dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300 hover:text-brand"
                >
                  99, 999, -1
                </button>
              </div>
            </div>
          </div>

          {/* Option 3: Range (+ 1 discrete) */}
          <div
            className={`p-3 rounded-md border transition-colors ${
              mode === "range"
                ? "border-brand bg-brand/5 dark:bg-brand/10"
                : "border-neutral-200 dark:border-neutral-700"
            }`}
          >
            <label className="flex items-start gap-3 cursor-pointer">
              <input
                type="radio"
                name="missingMode"
                checked={mode === "range"}
                onChange={() => {
                  setMode("range");
                  setError(null);
                }}
                className="mt-0.5 accent-brand"
              />
              <div>
                <div className="text-xs font-semibold text-neutral-900 dark:text-neutral-100">
                  {t("missingValuesModal.optionRangeTitle")}
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  {t("missingValuesModal.optionRangeDesc")}
                </div>
              </div>
            </label>
            <div className="mt-3 pl-6 grid grid-cols-3 gap-2">
              <div>
                <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                  {t("missingValuesModal.rangeMin")}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rangeMin}
                  onChange={(e) => {
                    setRangeMin(e.target.value);
                    setMode("range");
                    if (error) setError(null);
                  }}
                  placeholder="98"
                  aria-label={t("missingValuesModal.rangeMin")}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                  {t("missingValuesModal.rangeMax")}
                </label>
                <input
                  type="text"
                  inputMode="decimal"
                  value={rangeMax}
                  onChange={(e) => {
                    setRangeMax(e.target.value);
                    setMode("range");
                    if (error) setError(null);
                  }}
                  placeholder="99"
                  aria-label={t("missingValuesModal.rangeMax")}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
              <div>
                <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                  {t("missingValuesModal.rangeExtraCode")}
                </label>
                <input
                  type="text"
                  value={rangeExtra}
                  onChange={(e) => {
                    setRangeExtra(e.target.value);
                    setMode("range");
                    if (error) setError(null);
                  }}
                  placeholder="-1"
                  aria-label={t("missingValuesModal.rangeExtraCode")}
                  className="w-full px-2.5 py-1.5 text-xs font-mono rounded-md border border-neutral-300 dark:border-neutral-700 bg-white dark:bg-neutral-800 text-neutral-900 dark:text-neutral-100 focus:outline-none focus:ring-2 focus:ring-brand"
                />
              </div>
            </div>
          </div>

          {error && (
            <p className="text-xs text-rose-600 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/40 px-2.5 py-1.5 rounded-md">
              {error}
            </p>
          )}

          {/* Footer */}
          <div className="flex items-center justify-end gap-2 pt-2 border-t border-neutral-200 dark:border-neutral-800">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-1.5 rounded-md text-xs font-medium bg-neutral-200/80 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
            >
              {t("missingValuesModal.cancelButton")}
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-md text-xs font-medium bg-brand text-white hover:opacity-90 transition-opacity"
            >
              <Check className="w-3.5 h-3.5" />
              {t("missingValuesModal.saveButton")}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
