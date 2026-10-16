import { useEffect, useLayoutEffect, useRef, useState } from "react";
import { createPortal } from "react-dom";
import { Info } from "lucide-react";
import { t } from "@/i18n";

/**
 * Biểu tượng (i) cạnh một thuật ngữ / nút chức năng: bấm (hoặc Enter) để hiện giải thích ngắn, bấm ra ngoài / Esc để đóng.
 * Nội dung lấy từ khoá i18n `glossary.<term>.title` và `glossary.<term>.text` (xem src/i18n-extra.ts).
 */
export type GlossaryTerm =
  | "cronbachAlpha" | "correctedItemTotal" | "alphaIfDeleted" | "kmo" | "bartlett" | "efa"
  | "pValue" | "coefficient" | "r2" | "vif" | "ttest" | "anova" | "cohensD" | "correlationMatrix"
  | "panelData" | "pooledOls" | "fixedEffects" | "randomEffects" | "hausman" | "withinBetween"
  | "zScore" | "iqr";

/** Dải thuật ngữ: «Giải thích thuật ngữ: p-value (i) · t-test (i) …» — đặt ngay dưới tiêu đề của một chức năng. */
export function GlossaryBar({ terms }: { terms: GlossaryTerm[] }) {
  return (
    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-neutral-500 dark:text-neutral-400 mb-3" data-testid="glossary-bar">
      <span>{t("glossary.hintBarLabel")}</span>
      {terms.map((term) => (
        <span key={term} className="inline-flex items-center whitespace-nowrap">
          {t(`glossary.${term}.title`).split(" (")[0]}
          <InfoHint term={term} />
        </span>
      ))}
    </div>
  );
}

export function InfoHint({ term, className = "" }: { term: GlossaryTerm; className?: string }) {
  const [open, setOpen] = useState(false);
  const [pos, setPos] = useState<{ top: number; left: number } | null>(null);
  const btnRef = useRef<HTMLButtonElement>(null);
  const popRef = useRef<HTMLDivElement>(null);
  const title = t(`glossary.${term}.title`);
  const text = t(`glossary.${term}.text`);

  useLayoutEffect(() => {
    if (!open || !btnRef.current) return;
    const r = btnRef.current.getBoundingClientRect();
    const width = Math.min(320, window.innerWidth - 16);
    let left = r.left + r.width / 2 - width / 2;
    left = Math.max(8, Math.min(left, window.innerWidth - width - 8));
    setPos({ top: r.bottom + 6, left });
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      const el = e.target as Node;
      if (popRef.current?.contains(el) || btnRef.current?.contains(el)) return;
      setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && setOpen(false);
    const onScroll = () => setOpen(false);
    document.addEventListener("mousedown", onDown);
    document.addEventListener("keydown", onKey);
    window.addEventListener("scroll", onScroll, true);
    window.addEventListener("resize", onScroll);
    return () => {
      document.removeEventListener("mousedown", onDown);
      document.removeEventListener("keydown", onKey);
      window.removeEventListener("scroll", onScroll, true);
      window.removeEventListener("resize", onScroll);
    };
  }, [open]);

  return (
    <>
      <button
        ref={btnRef}
        type="button"
        data-testid={`info-hint-${term}`}
        aria-label={`${t("glossary.ariaPrefix")}: ${title}`}
        aria-expanded={open}
        title={title}
        onClick={(e) => {
          e.stopPropagation();
          setOpen((o) => !o);
        }}
        className={`inline-flex items-center justify-center align-middle ml-1 rounded-full text-neutral-400 hover:text-brand focus:outline-none focus-visible:ring-2 focus-visible:ring-brand ${className}`}
      >
        <Info className="w-3.5 h-3.5" aria-hidden="true" />
      </button>
      {open && pos &&
        createPortal(
          <div
            ref={popRef}
            role="dialog"
            aria-label={title}
            style={{ position: "fixed", top: pos.top, left: pos.left, width: Math.min(320, window.innerWidth - 16), zIndex: 1000 }}
            className="rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-800 dark:text-neutral-100 shadow-lg p-3 text-sm leading-relaxed"
          >
            <p className="font-semibold mb-1">{title}</p>
            <p className="text-neutral-700 dark:text-neutral-300">{text}</p>
          </div>,
          document.body
        )}
    </>
  );
}
