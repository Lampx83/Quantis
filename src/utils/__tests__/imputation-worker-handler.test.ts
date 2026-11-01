import { describe, it, expect, afterEach, vi } from "vitest";

type WorkerListener = (event: { data: any }) => void;

describe("imputation.worker", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.resetModules();
  });

  it("posts only the imputed columns as patches", async () => {
    let listener: WorkerListener | undefined;
    const posted: any[] = [];

    vi.stubGlobal("self", {
      addEventListener: (_type: string, fn: WorkerListener) => {
        listener = fn;
      },
      postMessage: (message: any) => {
        posted.push(message);
      },
    });

    await import("../../workers/imputation.worker");
    expect(listener).toBeDefined();

    listener!({
      data: {
        id: 3,
        type: "hot_deck",
        payload: {
          data: [
            ["id", "score"],
            ["1", ""],
            ["2", "5"],
          ],
          selectedColumns: ["score"],
        },
      },
    });

    expect(posted).toEqual([
      { id: 3, type: "success", columnPatches: { 1: ["5", "5"] } },
    ]);
  });

  it("posts an error instead of throwing when imputation fails", async () => {
    let listener: WorkerListener | undefined;
    const posted: any[] = [];

    vi.stubGlobal("self", {
      addEventListener: (_type: string, fn: WorkerListener) => {
        listener = fn;
      },
      postMessage: (message: any) => {
        posted.push(message);
      },
    });

    await import("../../workers/imputation.worker");
    listener!({
      data: {
        id: 4,
        type: "hot_deck",
        // Missing array methods make imputeHotDeck throw.
        payload: { data: { length: 2 } },
      },
    });

    expect(posted).toHaveLength(1);
    expect(posted[0]).toMatchObject({ id: 4, type: "error" });
    expect(typeof posted[0].error).toBe("string");
  });
});
