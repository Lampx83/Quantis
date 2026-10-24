import type { VariableMetadata } from "../types";
import { imputeHotDeck } from "./missing-imputation";

export interface HotDeckWorkerRequest {
  id: number;
  type: "hot_deck";
  payload: {
    data: string[][];
    selectedColumns?: string[];
    variables?: Record<string, VariableMetadata>;
  };
}

export type HotDeckWorkerResponse =
  | { id: number; type: "success"; columnPatches: Record<number, string[]> }
  | { id: number; type: "error"; error: string };

let nextRequestId = 0;

function abortError(): DOMException {
  return new DOMException("The operation was aborted", "AbortError");
}

/**
 * Copy only the patched cells into new rows. The worker sends one array per
 * imputed column, not a copy of the whole table, so this is the only place a
 * large dataset is duplicated on return.
 */
export function mergeColumnPatches(
  data: string[][],
  columnPatches: Record<number, string[]>
): string[][] {
  if (data.length === 0) return [];
  const patches = Object.entries(columnPatches).map(
    ([ci, values]) => [Number(ci), values] as const
  );
  const merged: string[][] = new Array(data.length);
  merged[0] = data[0];
  for (let ri = 1; ri < data.length; ri++) {
    const row = data[ri];
    const next = [...row];
    for (let p = 0; p < patches.length; p++) {
      const [ci, values] = patches[p];
      const value = values[ri - 1];
      if (value !== undefined) next[ci] = value;
    }
    merged[ri] = next;
  }
  return merged;
}

function createWorker(): Worker | null {
  if (typeof window === "undefined" || typeof Worker === "undefined") return null;
  try {
    return new Worker(new URL("../workers/imputation.worker.ts", import.meta.url), {
      type: "module",
    });
  } catch {
    return null;
  }
}

/**
 * Run hot-deck imputation off the main thread. Cancellation terminates the
 * worker and never falls back to a synchronous run on the UI thread. The
 * synchronous path exists only for environments without Worker (SSR, tests).
 */
export async function runHotDeckImputation(
  data: string[][],
  selectedColumns?: string[],
  variables?: Record<string, VariableMetadata>,
  options?: { signal?: AbortSignal }
): Promise<string[][]> {
  if (options?.signal?.aborted) throw abortError();

  const worker = createWorker();
  if (!worker) return imputeHotDeck(data, selectedColumns, variables);

  try {
    const columnPatches = await new Promise<Record<number, string[]>>((resolve, reject) => {
      const id = ++nextRequestId;

      const cleanup = () => {
        worker.removeEventListener("message", onMessage);
        worker.removeEventListener("error", onError);
        options?.signal?.removeEventListener("abort", onAbort);
      };

      const onMessage = (event: MessageEvent<HotDeckWorkerResponse>) => {
        const response = event.data;
        if (!response || response.id !== id) return;
        cleanup();
        worker.terminate();
        if (response.type === "success") resolve(response.columnPatches);
        else reject(new Error(response.error));
      };

      const onError = (event: ErrorEvent) => {
        cleanup();
        worker.terminate();
        reject(new Error(event.message || "Worker error"));
      };

      const onAbort = () => {
        cleanup();
        worker.terminate();
        reject(abortError());
      };

      worker.addEventListener("message", onMessage);
      worker.addEventListener("error", onError);
      options?.signal?.addEventListener("abort", onAbort, { once: true });
      if (options?.signal?.aborted) {
        onAbort();
        return;
      }

      worker.postMessage({
        id,
        type: "hot_deck",
        payload: { data, selectedColumns, variables },
      } satisfies HotDeckWorkerRequest);
    });

    return mergeColumnPatches(data, columnPatches);
  } catch (err: unknown) {
    // A cancelled job must never restart on the main thread.
    if ((err as Error)?.name === "AbortError" || options?.signal?.aborted) throw err;
    return imputeHotDeck(data, selectedColumns, variables);
  }
}
