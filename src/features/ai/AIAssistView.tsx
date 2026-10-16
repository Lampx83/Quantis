import React, { useState, useRef, useEffect, useCallback, useMemo } from "react";
import { Sparkles, Loader2 } from "lucide-react";
import type { Dataset } from "@/types";
import { pickRandomN } from "@/utils/helpers";
import { loadAiModel } from "@/utils/storage";
import * as quantisApi from "@/api";
import { t, aiAnswerLangHint } from "@/i18n";
import { AiMarkdown } from "@/ai-markdown";
import { AIAssistPanel } from "./AIAssistPanel";

export const AI_TAB_SUGGESTED_PROMPTS: { label: string; userMessage: string }[] = [
  { label: t("aiAssistView.prompt1Label"), userMessage: t("aiAssistView.prompt1UserMessage") },
  { label: t("aiAssistView.prompt2Label"), userMessage: t("aiAssistView.prompt2UserMessage") },
  { label: t("aiAssistView.prompt3Label"), userMessage: t("aiAssistView.prompt3UserMessage") },
  { label: t("aiAssistView.prompt4Label"), userMessage: t("aiAssistView.prompt4UserMessage") },
  { label: t("aiAssistView.prompt5Label"), userMessage: t("aiAssistView.prompt5UserMessage") },
  { label: t("aiAssistView.prompt6Label"), userMessage: t("aiAssistView.prompt6UserMessage") },
  { label: t("aiAssistView.prompt7Label"), userMessage: t("aiAssistView.prompt7UserMessage") },
  { label: t("aiAssistView.prompt8Label"), userMessage: t("aiAssistView.prompt8UserMessage") },
  { label: t("aiAssistView.prompt9Label"), userMessage: t("aiAssistView.prompt9UserMessage") },
  { label: t("aiAssistView.prompt10Label"), userMessage: t("aiAssistView.prompt10UserMessage") },
  { label: t("aiAssistView.prompt11Label"), userMessage: t("aiAssistView.prompt11UserMessage") },
  { label: t("aiAssistView.prompt12Label"), userMessage: t("aiAssistView.prompt12UserMessage") },
];

export const AI_TAB_QUICK_PROMPTS_COUNT = 3;

export interface AIAssistViewProps {
  selectedDataset?: Dataset;
  compact?: boolean;
}

export function AIAssistView({ selectedDataset, compact = false }: AIAssistViewProps) {
  const api = quantisApi.getAiApiBase();
  const defaultModel = (import.meta as { env?: { VITE_QUANTIS_AI_MODEL?: string } }).env?.VITE_QUANTIS_AI_MODEL;
  const modelToUse = loadAiModel() ?? defaultModel ?? quantisApi.getDefaultAiModel();
  const systemHint = `${t("aiAssistView.systemHintTask")} ${aiAnswerLangHint("Trả lời ngắn gọn, rõ ràng, bằng tiếng Việt.", "Answer concisely and clearly in English.")}`;
  const [messages, setMessages] = useState<{ role: "user" | "assistant"; content: string }[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [suggestionRound, setSuggestionRound] = useState(0);
  const chatEndRef = useRef<HTMLDivElement>(null);
  const dsCtx = selectedDataset
    ? `${t("aiAssistView.datasetContextPrefix")} ${selectedDataset.name}, ${selectedDataset.rows} ${t("transformTab.rowsUnit")}, ${selectedDataset.columns} ${t("transformTab.columnsUnit")}. ${t("aiAssistView.datasetContextColumnsPrefix")} ${(selectedDataset.columnNames || []).slice(0, 10).join(", ")}${(selectedDataset.columnNames?.length || 0) > 10 ? "…" : ""}.`
    : t("aiAssistView.noDatasetSelected");

  const suggestedPromptsPick = useMemo(
    () => pickRandomN(AI_TAB_SUGGESTED_PROMPTS, AI_TAB_QUICK_PROMPTS_COUNT),
    [suggestionRound],
  );

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = useCallback(async (userContent: string) => {
    const text = userContent.trim();
    if (!text || loading) return;
    const contextForAI = selectedDataset ? `${dsCtx}\n\n` : "";
    const promptText = `${contextForAI}Câu hỏi của người dùng: ${text}`;
    setMessages((prev) => [...prev, { role: "user", content: text }]);
    setInput("");
    setError(null);
    setLoading(true);
    try {
      const res = await quantisApi.aiComplete(api, promptText, systemHint, modelToUse, { maxTokens: 1024 });
      setMessages((prev) => [...prev, { role: "assistant", content: res }]);
    } catch (e) {
      const msg = e instanceof Error ? e.message : t("api.aiConnectionError");
      const hint = /fetch|network|failed|refused|404|500/i.test(msg)
        ? t("aiAssistPanel.hintCheckOllama")
        : "";
      setError(msg + hint);
      setMessages((prev) => [...prev, { role: "assistant", content: `⚠️ ${msg}${hint}` }]);
    } finally {
      setLoading(false);
    }
  }, [loading, api, systemHint, modelToUse, dsCtx, selectedDataset]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    sendMessage(input);
  };

  if (compact) {
    return (
      <div className="w-full max-w-full">
        <p className="text-xs text-neutral-500 mb-2">{dsCtx}</p>
        <AIAssistPanel
          context={dsCtx}
          quickPrompts={suggestedPromptsPick.map((p) => ({ label: p.label, systemHint, userMessage: p.userMessage }))}
          defaultSystemHint={systemHint}
          title={t("aiAssistView.title")}
          includeStandardResultPrompts={false}
        />
      </div>
    );
  }

  return (
    <div className="w-full max-w-2xl flex flex-col min-h-[min(520px,calc(100dvh-10rem))] h-[min(640px,calc(100dvh-10rem))] sm:min-h-[420px] sm:h-[calc(100vh-8rem)]">
      <div className="rounded-lg border border-neutral-200 dark:border-neutral-700 bg-white dark:bg-neutral-800 overflow-hidden shadow-sm flex flex-col flex-1 min-h-0">
      <div className="shrink-0 p-4 sm:p-6 border-b border-neutral-200 dark:border-neutral-700">
        <h2 className="text-lg sm:text-xl font-semibold mb-1 flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-amber-500 shrink-0" /> {t("aiAssistView.title")}
        </h2>
        <p className="text-xs sm:text-sm text-neutral-600 dark:text-neutral-400">
          {t("aiAssistView.subtitle")}
        </p>
        {selectedDataset && (
          <p className="text-xs text-neutral-500 dark:text-neutral-400 mt-1 truncate" title={dsCtx}>{t("aiAssistView.datasetLabelPrefix")} {selectedDataset.name}</p>
        )}
      </div>

      <div className="shrink-0 p-4 sm:px-6 sm:pb-4 border-b border-neutral-200 dark:border-neutral-700 bg-neutral-50/80 dark:bg-neutral-800/40">
        <p className="text-xs font-medium text-neutral-600 dark:text-neutral-400 mb-2 text-center">
          {t("aiAssistView.suggestedQuestionsHeadingPrefix")} {AI_TAB_QUICK_PROMPTS_COUNT} {t("aiAssistView.suggestedQuestionsHeadingSuffix")}
        </p>
        <div className="flex flex-col items-stretch gap-2 w-full max-w-lg mx-auto">
          {suggestedPromptsPick.map((p, i) => (
            <button
              key={`${suggestionRound}-${i}-${p.label}`}
              type="button"
              onClick={() => sendMessage(p.userMessage)}
              disabled={loading}
              className="rounded-md px-3 py-2.5 min-h-[44px] text-center text-xs sm:text-sm leading-snug border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 hover:bg-amber-50 dark:hover:bg-amber-900/20 hover:border-amber-400 dark:hover:border-amber-600 text-neutral-700 dark:text-neutral-300 disabled:opacity-50"
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="text-center">
          <button
            type="button"
            onClick={() => setSuggestionRound((r) => r + 1)}
            disabled={loading}
            className="mt-2 text-xs text-amber-700 dark:text-amber-400 hover:underline disabled:opacity-50"
          >
            {t("aiAssistView.getOtherSuggestionsPrefix")} {AI_TAB_QUICK_PROMPTS_COUNT} {t("aiAssistView.getOtherSuggestionsSuffix")}
          </button>
        </div>
      </div>

      <div className="flex-1 flex flex-col min-h-0 bg-neutral-50 dark:bg-neutral-800/50">
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {messages.length === 0 && (
            <p className="text-sm text-neutral-500 dark:text-neutral-400 text-center py-8">
              {t("aiAssistView.noMessagesYet")}
            </p>
          )}
          {messages.map((m, i) => (
            <div
              key={i}
              className={`flex ${m.role === "user" ? "justify-end" : "justify-start"}`}
            >
              <div
                className={`max-w-[85%] rounded-lg px-4 py-2.5 text-sm ${
                  m.role === "user"
                    ? "bg-brand text-white"
                    : "bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 text-neutral-800 dark:text-neutral-200"
                }`}
              >
                {m.role === "user" ? (
                  <p className="whitespace-pre-wrap">{m.content}</p>
                ) : (
                  <div className="text-sm max-w-full break-words overflow-x-auto">
                    <AiMarkdown content={m.content} />
                  </div>
                )}
              </div>
            </div>
          ))}
          {loading && (
            <div className="flex justify-start">
              <div className="rounded-lg px-4 py-2.5 bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-600 text-neutral-500">
                <Loader2 className="w-5 h-5 animate-spin inline-block" />
                <span className="ml-2 text-sm">{t("aiAssistView.answeringLabel")}</span>
              </div>
            </div>
          )}
          <div ref={chatEndRef} />
        </div>

        {error && (
          <p className="text-xs text-red-600 dark:text-red-400 px-4 py-2 border-t border-neutral-200 dark:border-neutral-700 bg-red-50/50 dark:bg-red-900/20">{error}</p>
        )}

        <form onSubmit={handleSubmit} className="shrink-0 p-3 border-t border-neutral-200 dark:border-neutral-700 flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); sendMessage(input); } }}
            placeholder={t("aiAssistView.inputPlaceholder")}
            className="flex-1 h-11 rounded-md border border-neutral-300 dark:border-neutral-600 bg-white dark:bg-neutral-800 px-3 py-2 text-sm"
            disabled={loading}
          />
          <button
            type="submit"
            disabled={loading || !input.trim()}
            className="shrink-0 rounded-md bg-brand text-white px-4 py-2 h-11 font-medium text-sm hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {t("aiAssistPanel.sendButton")}
          </button>
        </form>
      </div>
      </div>
    </div>
  );
}
