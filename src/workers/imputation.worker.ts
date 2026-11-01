import { imputeHotDeck } from "../utils/missing-imputation";
import type {
  HotDeckWorkerRequest,
  HotDeckWorkerResponse,
} from "../utils/imputation-worker-client";

// tsconfig targets DOM, not WebWorker; this narrow cast avoids the two-argument
// Window.postMessage signature without adding a conflicting lib.
interface WorkerScope {
  postMessage(message: HotDeckWorkerResponse): void;
  addEventListener(
    type: "message",
    listener: (event: MessageEvent<HotDeckWorkerRequest>) => void
  ): void;
}

const ctx = self as unknown as WorkerScope;

ctx.addEventListener("message", (event) => {
  const request = event.data;
  if (!request || request.type !== "hot_deck") return;

  const { id, payload } = request;
  try {
    const output = imputeHotDeck(payload.data, payload.selectedColumns, payload.variables);
    const header = payload.data[0] ?? [];
    const targetColumns =
      payload.selectedColumns && payload.selectedColumns.length > 0
        ? payload.selectedColumns
        : header;
    const columnPatches: Record<number, string[]> = {};

    for (const column of targetColumns) {
      const ci = header.indexOf(column);
      if (ci === -1) continue;
      const values = new Array<string>(Math.max(0, output.length - 1));
      for (let row = 1; row < output.length; row++) {
        values[row - 1] = output[row][ci];
      }
      columnPatches[ci] = values;
    }

    ctx.postMessage({ id, type: "success", columnPatches });
  } catch (err: unknown) {
    const error = err instanceof Error ? err.message : String(err);
    ctx.postMessage({ id, type: "error", error });
  }
});
