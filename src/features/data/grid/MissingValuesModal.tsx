import React, { useState, useEffect } from "react";
import { X, AlertCircle, Check } from "lucide-react";

export type MissingValuesMode = "none" | "discrete";

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
      error: "Chỉ cho phép tối đa 3 mã khuyết thiếu rời rạc (Discrete missing values).",
    };
  }

  const unique = new Set(cleaned);
  if (unique.size !== cleaned.length) {
    return {
      valid: false,
      values: cleaned,
      error: "Các mã khuyết thiếu rời rạc không được trùng lặp nhau.",
    };
  }

  return {
    valid: true,
    values: cleaned,
  };
}

export function formatMissingValuesSummary(missingValues?: string[]): string {
  if (!missingValues || missingValues.length === 0) return "None";
  return missingValues.join(", ");
}

export interface MissingValuesModalProps {
  isOpen: boolean;
  variableName: string;
  initialMissingValues?: string[];
  onSave: (missingValues: string[]) => void;
  onClose: () => void;
}

export function MissingValuesModal({
  isOpen,
  variableName,
  initialMissingValues,
  onSave,
  onClose,
}: MissingValuesModalProps) {
  const hasInitial = Boolean(initialMissingValues && initialMissingValues.length > 0);
  const [mode, setMode] = useState<MissingValuesMode>(
    hasInitial ? "discrete" : "none"
  );
  const [slots, setSlots] = useState<[string, string, string]>(() => [
    initialMissingValues?.[0] ?? "",
    initialMissingValues?.[1] ?? "",
    initialMissingValues?.[2] ?? "",
  ]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (isOpen) {
      const hasVals = Boolean(
        initialMissingValues && initialMissingValues.length > 0
      );
      setMode(hasVals ? "discrete" : "none");
      setSlots([
        initialMissingValues?.[0] ?? "",
        initialMissingValues?.[1] ?? "",
        initialMissingValues?.[2] ?? "",
      ]);
      setError(null);
    }
  }, [isOpen, initialMissingValues, variableName]);

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
      onSave([]);
      onClose();
      return;
    }

    const validation = parseAndValidateDiscreteMissing(slots);
    if (!validation.valid) {
      setError(validation.error ?? "Giá trị không hợp lệ.");
      return;
    }

    onSave(validation.values);
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-xs"
      onClick={onClose}
    >
      <div
        className="bg-white dark:bg-neutral-900 rounded-xl shadow-2xl max-w-md w-full border border-neutral-200 dark:border-neutral-700 flex flex-col overflow-hidden"
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="missing-values-modal-title"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-3.5 border-b border-neutral-200 dark:border-neutral-800 bg-neutral-50/70 dark:bg-neutral-800/50">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 rounded-lg bg-amber-500/10 text-amber-600 dark:text-amber-400">
              <AlertCircle className="w-4 h-4" />
            </div>
            <div>
              <h3
                id="missing-values-modal-title"
                className="text-sm font-semibold text-neutral-900 dark:text-neutral-100"
              >
                Giá trị khuyết thiếu (Missing Values) —{" "}
                <span className="font-mono text-brand">{variableName}</span>
              </h3>
              <p className="text-xs text-neutral-500 dark:text-neutral-400">
                Định nghĩa mã số quy ước khuyết dữ liệu (tự động loại trừ khi phân tích)
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-lg text-neutral-500 hover:bg-neutral-200/70 dark:hover:bg-neutral-700 transition-colors"
            aria-label="Đóng"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body */}
        <form onSubmit={handleSave} className="p-5 flex flex-col gap-4">
          {/* Option 1: No missing values */}
          <label
            className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
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
                No missing values (Không có mã khuyết thiếu)
              </div>
              <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                Chỉ xem các ô trống (rỗng) là dữ liệu khuyết thiếu.
              </div>
            </div>
          </label>

          {/* Option 2: Discrete missing values */}
          <div
            className={`p-3 rounded-lg border transition-colors ${
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
                  Discrete missing values (Mã khuyết thiếu rời rạc)
                </div>
                <div className="text-[11px] text-neutral-500 dark:text-neutral-400 mt-0.5">
                  Nhập tối đa 3 mã quy ước (VD: <code className="font-mono">99</code>,{" "}
                  <code className="font-mono">999</code>,{" "}
                  <code className="font-mono">-1</code>).
                </div>
              </div>
            </label>

            <div className="mt-3 pl-6 flex flex-col gap-2.5">
              <div className="grid grid-cols-3 gap-2">
                {([0, 1, 2] as const).map((idx) => (
                  <div key={idx}>
                    <label className="block text-[11px] text-neutral-500 dark:text-neutral-400 mb-1">
                      Mã {idx + 1}
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
                <span className="text-[11px] text-neutral-500">Gợi ý nhanh:</span>
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
              className="px-3.5 py-1.5 rounded-lg text-xs font-medium bg-neutral-200/80 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-200 hover:bg-neutral-300 dark:hover:bg-neutral-600 transition-colors"
            >
              Hủy (Cancel)
            </button>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 px-4 py-1.5 rounded-lg text-xs font-medium bg-brand text-white hover:opacity-90 transition-opacity"
            >
              <Check className="w-3.5 h-3.5" />
              Lưu thay đổi (Save)
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
