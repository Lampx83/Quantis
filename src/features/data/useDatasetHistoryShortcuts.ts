import { useEffect } from "react";
import { useDataStore } from "@/stores/useDataStore";

type HistoryKeyEvent = Pick<KeyboardEvent,
  "key" | "ctrlKey" | "metaKey" | "shiftKey" | "altKey" | "isComposing" | "defaultPrevented" | "preventDefault"
>;

export function handleDatasetHistoryShortcut(
  event: HistoryKeyEvent,
  mac: boolean,
  blocked: boolean,
  run: (direction: "undo" | "redo") => boolean,
): void {
  if (blocked || event.defaultPrevented || event.altKey || event.isComposing) return;
  if (mac ? !event.metaKey || event.ctrlKey : !event.ctrlKey || event.metaKey) return;
  const key = event.key.toLowerCase();
  const redo = (key === "z" && event.shiftKey) || (!mac && key === "y" && !event.shiftKey);
  if ((key === "z" || redo) && run(redo ? "redo" : "undo")) event.preventDefault();
}

export function useDatasetHistoryShortcuts(datasetId: string | null): void {
  useEffect(() => {
    if (!datasetId) return;
    const mac = /Mac|iPhone|iPad/.test(navigator.platform);
    const onKey = (event: KeyboardEvent) => {
      const target = event.target;
      const editor = target instanceof Element &&
        (target.closest("input, textarea, select, [role=textbox]") ||
          (target instanceof HTMLElement && target.isContentEditable));
      const modal = document.querySelector('dialog[open], [role="dialog"][aria-modal="true"]');
      handleDatasetHistoryShortcut(event, mac, Boolean(editor || modal), (direction) => {
        const state = useDataStore.getState();
        if (state.selectedDatasetId !== datasetId) return false;
        return direction === "undo" ? state.undoDataset(datasetId) : state.redoDataset(datasetId);
      });
    };
    document.addEventListener("keydown", onKey);
    return () => document.removeEventListener("keydown", onKey);
  }, [datasetId]);
}
