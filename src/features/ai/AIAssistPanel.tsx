import React, { useState, useRef, useEffect, useCallback } from "react";
import {
  Sparkles,
  Loader2,
  GripVertical,
  X,
  Copy,
  ThumbsUp,
  ThumbsDown,
} from "lucide-react";
import * as quantisApi from "@/api";
import { AI_MAX_PROMPT_CHARS } from "@/api";
import { loadAiModel, saveAiFeedback } from "@/utils/storage";
import { t, aiAnswerLangHint } from "@/i18n";
import { AiMarkdown } from "@/ai-markdown";

/** Một nút icon AI; bấm vào mở panel: prompt gợi ý + ô nhập prompt tùy chỉnh. */
export type AIQuickPrompt = { label: string; systemHint: string; userMessage?: string };

/** Prompt chuẩn cho mọi kết quả phân tích: viết APA + giải thích ý nghĩa (hỗ trợ AI toàn diện). Ngôn ngữ thống nhất: tiếng Việt. */
export const STANDARD_AI_RESULT_PROMPTS: AIQuickPrompt[] = [
  { label: t("aiAssistPanel.standardPromptApaResultsLabel"), systemHint: `${t("aiAssistPanel.standardPromptApaResultsHint")} ${aiAnswerLangHint("Trả lời bằng tiếng Việt.", "Answer in English.")}`, userMessage: t("aiAssistPanel.standardPromptApaResultsUserMessage") },
  { label: t("aiAssistPanel.standardPromptExplainResultLabel"), systemHint: `${t("aiAssistPanel.standardPromptExplainResultHint")} ${aiAnswerLangHint()}`, userMessage: t("aiAssistPanel.standardPromptExplainResultUserMessage") },
];

export const DISLIKE_REASONS = [
  { id: "incorrect", label: t("aiAssistPanel.dislikeReasonIncorrect") },
  { id: "not_asked", label: t("aiAssistPanel.dislikeReasonNotAsked") },
  { id: "slow_buggy", label: t("aiAssistPanel.dislikeReasonSlowBuggy") },
  { id: "style_tone", label: t("aiAssistPanel.dislikeReasonStyleTone") },
  { id: "other", label: t("aiAssistPanel.dislikeReasonOther") },
] as const;

export interface AIAssistPanelProps {
  context: string;
  metadata?: string;
  process?: string;
  quickPrompts: AIQuickPrompt[];
  defaultSystemHint?: string;
  disabled?: boolean;
  title?: string;
  includeStandardResultPrompts?: boolean;
}

export function AIAssistPanel({
  context,
  metadata,
  process,
  quickPrompts,
  defaultSystemHint = `${t("aiAssistPanel.defaultSystemHint")} ${aiAnswerLangHint()} ${t("aiAssistPanel.defaultSystemHintMarkdownNote")}`,
  disabled = false,
  title = t("aiAssistPanel.defaultTitle"),
  includeStandardResultPrompts = true,
}: AIAssistPanelProps) {
  const quickPromptsToShow = includeStandardResultPrompts ? [...STANDARD_AI_RESULT_PROMPTS, ...quickPrompts] : quickPrompts;
  const [open, setOpen] = useState(false);
  const [customPrompt, setCustomPrompt] = useState("");
  const [lastQuickPrompt, setLastQuickPrompt] = useState<AIQuickPrompt | null>(null);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<"like" | "dislike" | null>(null);
  const [showDislikeForm, setShowDislikeForm] = useState(false);
  const [dislikeReason, setDislikeReason] = useState<string | null>(null);
  const [dislikeComment, setDislikeComment] = useState("");
  const [dislikeSubmitting, setDislikeSubmitting] = useState(false);
  const resultBoxRef = useRef<HTMLDivElement>(null);
  const panelRef = useRef<HTMLDivElement>(null);
  const buttonRef = useRef<HTMLButtonElement>(null);
  const [dialogPosition, setDialogPosition] = useState<{ left: number; top: number; maxHeight?: number } | null>(null);
  const userHasDraggedRef = useRef(false);
  const dragStartRef = useRef<{ x: number; y: number; left: number; top: number } | null>(null);
  const api = quantisApi.getAiApiBase();
  const defaultModel = (import.meta as { env?: { VITE_QUANTIS_AI_MODEL?: string } }).env?.VITE_QUANTIS_AI_MODEL;
  const modelToUse = loadAiModel() ?? defaultModel ?? quantisApi.getDefaultAiModel();

  const fullContext = [metadata?.trim(), process?.trim(), context?.trim()].filter(Boolean).length
    ? [
        metadata?.trim() ? `[DỮ LIỆU / METADATA]\n${metadata.trim()}` : "",
        process?.trim() ? `[QUÁ TRÌNH PHÂN TÍCH]\n${process.trim()}` : "",
        context?.trim() ? `[KẾT QUẢ]\n${context.trim()}` : "",
      ].filter(Boolean).join("\n\n")
    : context.trim();

  useEffect(() => {
    if (result !== null && resultBoxRef.current) {
      resultBoxRef.current.scrollIntoView({ behavior: "smooth", block: "nearest" });
    }
  }, [result]);

  useEffect(() => {
    if (result !== null) {
      setFeedback(null);
      setShowDislikeForm(false);
      setDislikeReason(null);
      setDislikeComment("");
    }
  }, [result]);

  const DIALOG_MAX_HEIGHT_PX = 420;
  const DIALOG_MARGIN = 16;

  useEffect(() => {
    if (!open) {
      setDialogPosition(null);
      userHasDraggedRef.current = false;
      return;
    }
    const updatePosition = (onScroll = false) => {
      if (onScroll && userHasDraggedRef.current) return;
      const btn = buttonRef.current;
      if (!btn) return;
      const rect = btn.getBoundingClientRect();
      const margin = DIALOG_MARGIN;
      const maxW = Math.min(480, window.innerWidth - 2 * margin);
      let left = rect.left;
      if (left + maxW > window.innerWidth - margin) left = window.innerWidth - margin - maxW;
      if (left < margin) left = margin;
      const maxH = Math.min(DIALOG_MAX_HEIGHT_PX, window.innerHeight - 2 * margin);
      let top = rect.bottom + 8;
      // Nếu không đủ chỗ phía dưới thì mở dialog phía trên nút
      if (top + maxH > window.innerHeight - margin) {
        top = Math.max(margin, rect.top - maxH - 8);
      }
      setDialogPosition({ left, top, maxHeight: maxH });
    };
    updatePosition();
    const onResize = () => updatePosition(false);
    const onScroll = () => updatePosition(true);
    window.addEventListener("resize", onResize);
    window.addEventListener("scroll", onScroll, true);
    return () => {
      window.removeEventListener("resize", onResize);
      window.removeEventListener("scroll", onScroll, true);
    };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onMouseDown = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onMouseDown);
    return () => document.removeEventListener("mousedown", onMouseDown);
  }, [open]);

  useEffect(() => {
    if (!open) return;
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [open]);

  const runAI = useCallback(async (systemHint: string, userMessage: string) => {
    if (!fullContext && !userMessage.trim()) return;
    const promptText = userMessage.trim()
      ? `Dữ liệu/ngữ cảnh:\n${fullContext}\n\nCâu hỏi của người dùng: ${userMessage.trim()}`
      : `Dựa trên nội dung sau, viết đoạn diễn giải phù hợp:\n\n${fullContext}`;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await quantisApi.aiComplete(api, promptText, systemHint, modelToUse, { maxTokens: 1024 });
      setResult(res);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("api.aiConnectionError");
      const hint = /fetch|network|failed|refused|404|500/i.test(msg)
        ? t("aiAssistPanel.hintCheckOllama")
        : /abort|timeout/i.test(msg)
          ? t("aiAssistPanel.hintTimeout")
          : "";
      setError(msg + hint);
    } finally {
      setLoading(false);
    }
  }, [fullContext, api, modelToUse]);

  const handleQuickPrompt = useCallback((p: AIQuickPrompt) => {
    const text = p.userMessage ?? p.label;
    setCustomPrompt(text);
    setLastQuickPrompt(p);
  }, []);

  const handleCustomSubmit = useCallback(() => {
    if (!customPrompt.trim()) return;
    const systemHint = lastQuickPrompt?.systemHint ?? defaultSystemHint;
    runAI(systemHint, customPrompt);
  }, [customPrompt, lastQuickPrompt, defaultSystemHint, runAI]);

  const handleDragStart = useCallback((e: React.MouseEvent) => {
    if (!dialogPosition) return;
    e.preventDefault();
    dragStartRef.current = { x: e.clientX, y: e.clientY, left: dialogPosition.left, top: dialogPosition.top };
    const maxH = dialogPosition.maxHeight ?? DIALOG_MAX_HEIGHT_PX;
    const margin = DIALOG_MARGIN;
    const onMove = (e: MouseEvent) => {
      if (!dragStartRef.current) return;
      let left = dragStartRef.current.left + (e.clientX - dragStartRef.current.x);
      let top = dragStartRef.current.top + (e.clientY - dragStartRef.current.y);
      left = Math.max(margin, Math.min(window.innerWidth - margin - 320, left));
      top = Math.max(margin, Math.min(window.innerHeight - margin - 200, top));
      setDialogPosition({ left, top, maxHeight: maxH });
    };
    const onUp = () => {
      dragStartRef.current = null;
      userHasDraggedRef.current = true;
      document.removeEventListener("mousemove", onMove);
      document.removeEventListener("mouseup", onUp);
    };
    document.addEventListener("mousemove", onMove);
    document.addEventListener("mouseup", onUp);
  }, [dialogPosition]);

  const hasContext = fullContext.length > 0;
  const isDisabled = disabled || loading;

  return (
    <div className="mb-3 relative flex justify-end" ref={panelRef}>
      <button
        ref={buttonRef}
        type="button"
        onClick={() => setOpen((o) => !o)}
        disabled={isDisabled}
        title={title}
        className="inline-flex items-center justify-center w-9 h-9 rounded-md bg-amber-500/90 hover:bg-amber-500 text-white disabled:opacity-50 disabled:cursor-not-allowed"
      >
        {loading ? (
          <Loader2 className="w-5 h-5 shrink-0 animate-spin" aria-hidden />
        ) : (
          <Sparkles className="w-5 h-5 shrink-0" />
        )}
      </button>
      {open && dialogPosition && (
        <div
          className="fixed z-20 flex flex-col min-w-[320px] max-w-[min(480px,calc(100vw-2rem))] rounded-lg border border-neutral-200 dark:border-neutral-600 bg-white dark:bg-neutral-800 shadow-lg overflow-hidden"
          style={{
            left: dialogPosition.left,
            top: dialogPosition.top,
            maxHeight: dialogPosition.maxHeight ?? DIALOG_MAX_HEIGHT_PX,
          }}
          role="dialog"
          aria-label={title}
        >
          <div className="flex items-center justify-between border-b border-neutral-200 dark:border-neutral-600 bg-neutral-50 dark:bg-neutral-800/80 text-neutral-500 dark:text-neutral-400 shrink-0">
            <div
              role="button"
              tabIndex={0}
              onMouseDown={handleDragStart}
              onKeyDown={(e) => { if (e.key === "Enter" || e.key === " ") e.preventDefault(); }}
              className="py-1.5 pl-2 cursor-grab active:cursor-grabbing hover:bg-neutral-100 dark:hover:bg-neutral-700/80 rounded-l"
              title={t("aiAssistPanel.dragToMoveTitle")}
            >
              <GripVertical className="w-4 h-4" aria-hidden />
            </div>
            <button
              type="button"
              onClick={() => setOpen(false)}
              onMouseDown={(e) => e.stopPropagation()}
              className="p-1.5 rounded-r hover:bg-neutral-200 dark:hover:bg-neutral-700 text-neutral-500 hover:text-neutral-700 dark:text-neutral-400 dark:hover:text-neutral-200 focus:outline-none focus-visible:ring-2 focus-visible:ring-brand focus-visible:ring-inset"
              title={t("app.close")}
              aria-label={t("app.close")}
            >
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="flex flex-col min-h-0 flex-1 overflow-y-auto p-3">
          {!modelToUse && (
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-2 px-2 py-1.5 rounded-lg bg-amber-50 dark:bg-amber-900/30">{t("aiAssistPanel.selectModelHintPrefix")} <strong>{t("app.connectionSettings")}</strong> {t("aiAssistPanel.selectModelHintSuffix")}</p>
          )}
          {fullContext.length > AI_MAX_PROMPT_CHARS && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">{t("aiAssistPanel.longContextTruncateNote")}</p>
          )}
          {!hasContext && (
            <p className="text-xs text-neutral-500 dark:text-neutral-400 mb-2">{t("aiAssistPanel.noContextNote")}</p>
          )}
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">{t("aiAssistPanel.suggestedQuestionsLabel")}</p>
          <div className="flex flex-wrap gap-1.5 mb-3">
            {quickPromptsToShow.map((p, i) => (
              <button
                key={i}
                type="button"
                onClick={() => handleQuickPrompt(p)}
                disabled={loading || (!hasContext && !(p.userMessage ?? "").trim())}
                className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100 hover:bg-amber-200 dark:hover:bg-amber-800/60 disabled:opacity-50"
              >
                {p.label}
              </button>
            ))}
          </div>
          <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1.5">{t("aiAssistPanel.customQuestionLabel")}</p>
          <textarea
            value={customPrompt}
            onChange={(e) => setCustomPrompt(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && (e.ctrlKey || e.metaKey)) { e.preventDefault(); handleCustomSubmit(); } }}
            placeholder={t("aiAssistPanel.customQuestionPlaceholder")}
            rows={3}
            className="w-full min-h-[5rem] rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-sm mb-2 resize-y"
          />
          <button
            type="button"
            onClick={handleCustomSubmit}
            disabled={!customPrompt.trim() || loading}
            className="w-full py-1.5 rounded-md text-sm font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
          >
            {t("aiAssistPanel.sendButton")}
          </button>
          {error && (
            <div className="mt-2 p-2 rounded-lg border border-red-200 dark:border-red-800 bg-red-50 dark:bg-red-900/20">
              <p className="text-xs font-medium text-red-800 dark:text-red-200 mb-0.5">{t("api.aiConnectionError")}</p>
              <p className="text-xs text-red-700 dark:text-red-300 whitespace-pre-wrap">{error}</p>
              <p className="text-xs text-red-600 dark:text-red-400 mt-1">{t("aiAssistPanel.errorHintPrefix")} <strong>{t("app.connectionSettings")}</strong> {t("aiAssistPanel.errorHintMid1")} <strong>{t("aiAssistPanel.errorHintOllamaUpstream")}</strong> {t("aiAssistPanel.errorHintMid2")} <code className="text-[10px]">OLLAMA_URL</code>{t("aiAssistPanel.errorHintMid3")} <strong>{t("aiAssistPanel.errorHintCheckOllama")}</strong>{t("aiAssistPanel.errorHintMid4")} <code className="text-[10px]">ollama serve</code> {t("aiAssistPanel.errorHintSuffix")}</p>
            </div>
          )}
          {result !== null && (
            <>
              <div ref={resultBoxRef} className="mt-2 p-2 rounded-lg border border-amber-200 dark:border-amber-800 bg-amber-50/80 dark:bg-amber-900/20">
                <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-1">{t("aiAssistPanel.resultLabel")}</p>
                <div className="text-sm text-neutral-700 dark:text-neutral-300 max-h-80 overflow-y-auto overflow-x-auto">
                  <AiMarkdown content={result || t("aiAssistPanel.emptyServerResponse")} />
                </div>
                <div className="flex flex-wrap items-center gap-2 mt-1.5">
                  <button type="button" onClick={() => { navigator.clipboard.writeText(result || ""); }} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-amber-300 dark:border-amber-600 bg-amber-100/80 dark:bg-amber-800/30 text-amber-800 dark:text-amber-200"><Copy className="w-3 h-3" /> {t("aiAssistPanel.copyButton")}</button>
                  <button type="button" onClick={() => { setResult(null); setError(null); setFeedback(null); setShowDislikeForm(false); }} className="inline-flex items-center gap-1 px-2 py-1 text-xs rounded border border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-200 dark:hover:bg-neutral-600">{t("aiAssistPanel.refreshButton")}</button>
                  <span className="text-neutral-400 dark:text-neutral-500 mx-0.5">|</span>
                  <button
                    type="button"
                    title={feedback === "like" ? t("aiAssistPanel.likeButtonTitleActive") : t("aiAssistPanel.likeButtonTitleInactive")}
                    onClick={() => {
                      if (feedback === "like") {
                        setFeedback(null);
                      } else {
                        setFeedback("like");
                        saveAiFeedback({ feedback: "like", resultPreview: (result || "").slice(0, 200) });
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border ${feedback === "like" ? "border-green-500 bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300" : "border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600"}`}
                  >
                    <ThumbsUp className="w-3 h-3" /> {t("aiAssistPanel.likeButton")}
                  </button>
                  <button
                    type="button"
                    title={feedback === "dislike" ? t("aiAssistPanel.dislikeButtonTitleActive") : t("aiAssistPanel.dislikeButtonTitleInactive")}
                    onClick={() => {
                      if (feedback === "dislike") {
                        setFeedback(null);
                      } else {
                        setShowDislikeForm(true);
                      }
                    }}
                    className={`inline-flex items-center gap-1 px-2 py-1 text-xs rounded border ${feedback === "dislike" ? "border-red-500 bg-red-100 dark:bg-red-900/30 text-red-700 dark:text-red-300" : "border-neutral-300 dark:border-neutral-600 bg-neutral-100 dark:bg-neutral-700 text-neutral-600 dark:text-neutral-400 hover:bg-neutral-200 dark:hover:bg-neutral-600"}`}
                  >
                    <ThumbsDown className="w-3 h-3" /> {t("aiAssistPanel.dislikeButton")}
                  </button>
                </div>
                {showDislikeForm && (
                  <div className="mt-3 pt-3 border-t border-amber-200 dark:border-amber-800">
                    <p className="text-xs font-medium text-amber-800 dark:text-amber-200 mb-2">{t("aiAssistPanel.dislikeFormLabel")}</p>
                    <div className="flex flex-wrap gap-1.5 mb-2">
                      {DISLIKE_REASONS.map((r) => (
                        <button
                          key={r.id}
                          type="button"
                          onClick={() => setDislikeReason(dislikeReason === r.id ? null : r.id)}
                          className={`px-2 py-1 rounded text-xs border ${dislikeReason === r.id ? "border-amber-500 bg-amber-100 dark:bg-amber-900/40 text-amber-900 dark:text-amber-100" : "border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 text-neutral-700 dark:text-neutral-300"}`}
                        >
                          {r.label}
                        </button>
                      ))}
                    </div>
                    <textarea
                      value={dislikeComment}
                      onChange={(e) => setDislikeComment(e.target.value)}
                      placeholder={t("aiAssistPanel.dislikeCommentPlaceholder")}
                      rows={2}
                      maxLength={2000}
                      className="w-full rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-2.5 py-2 text-xs mb-2 resize-none"
                    />
                    <div className="flex flex-wrap gap-2">
                      <button
                        type="button"
                        disabled={dislikeSubmitting}
                        onClick={async () => {
                          setDislikeSubmitting(true);
                          const reasonLabel = dislikeReason ? DISLIKE_REASONS.find((r) => r.id === dislikeReason)?.label : undefined;
                          const comment = [reasonLabel, dislikeComment.trim()].filter(Boolean).join("\n\n");
                          saveAiFeedback({
                            feedback: "dislike",
                            resultPreview: (result || "").slice(0, 200),
                            reason: reasonLabel,
                            comment: comment || undefined,
                          });
                          setFeedback("dislike");
                          setShowDislikeForm(false);
                          setDislikeReason(null);
                          setDislikeComment("");
                          setDislikeSubmitting(false);
                        }}
                        className="px-2.5 py-1.5 rounded-md text-xs font-medium bg-amber-500 text-white hover:bg-amber-600 disabled:opacity-50"
                      >
                        {dislikeSubmitting ? t("aiAssistPanel.submittingDislike") : t("aiAssistPanel.submitDislikeButton")}
                      </button>
                      <button
                        type="button"
                        disabled={dislikeSubmitting}
                        onClick={() => { setShowDislikeForm(false); setDislikeReason(null); setDislikeComment(""); }}
                        className="px-2.5 py-1.5 rounded-md text-xs border border-neutral-300 dark:border-neutral-600 text-neutral-700 dark:text-neutral-300 hover:bg-neutral-100 dark:hover:bg-neutral-700"
                      >
                        {t("aiAssistPanel.cancelDislikeButton")}
                      </button>
                    </div>
                  </div>
                )}
              </div>
              <p className="mt-3 pt-2 border-t border-red-200 dark:border-red-800 text-[11px] text-red-600 dark:text-red-400">
                {t("aiAssistPanel.aiDisclaimerNote")}
              </p>
            </>
          )}
          </div>
        </div>
      )}
    </div>
  );
}
