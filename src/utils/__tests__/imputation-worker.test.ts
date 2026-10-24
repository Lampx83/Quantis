import { describe, it, expect, afterEach, vi } from "vitest";
import { mergeColumnPatches, runHotDeckImputation } from "../imputation-worker-client";
import { imputeHotDeck } from "../missing-imputation";

type Listener = (event: any) => void;

class FakeWorker {
  static instances: FakeWorker[] = [];
  listeners = new Map<string, Set<Listener>>();
  posted: any[] = [];
  terminated = false;

  constructor(_url: URL, _options?: WorkerOptions) {
    FakeWorker.instances.push(this);
  }

  addEventListener(type: string, listener: Listener) {
    if (!this.listeners.has(type)) this.listeners.set(type, new Set());
    this.listeners.get(type)!.add(listener);
  }

  removeEventListener(type: string, listener: Listener) {
    this.listeners.get(type)?.delete(listener);
  }

  postMessage(message: any) {
    this.posted.push(message);
  }

  terminate() {
    this.terminated = true;
  }

  emit(type: string, payload: any) {
    for (const listener of [...(this.listeners.get(type) ?? [])]) {
      listener(type === "error" ? { message: payload } : { data: payload });
    }
  }
}

const data = [
  ["id", "score"],
  ["1", ""],
  ["2", "5"],
];

function enableWorker() {
  vi.stubGlobal("Worker", FakeWorker);
  vi.stubGlobal("window", {});
}

afterEach(() => {
  vi.unstubAllGlobals();
  FakeWorker.instances = [];
});

describe("mergeColumnPatches", () => {
  it("replaces only the patched columns and leaves the input untouched", () => {
    const patches = { 1: ["9", "5"] };
    const merged = mergeColumnPatches(data, patches);

    expect(merged).toEqual([
      ["id", "score"],
      ["1", "9"],
      ["2", "5"],
    ]);
    expect(data[1][1]).toBe("");
  });

  it("applies several column patches at once", () => {
    const table = [
      ["a", "b"],
      ["", ""],
    ];
    expect(mergeColumnPatches(table, { 0: ["1"], 1: ["2"] })).toEqual([
      ["a", "b"],
      ["1", "2"],
    ]);
  });
});

describe("runHotDeckImputation", () => {
  it("falls back to synchronous imputation when Worker is unavailable", async () => {
    const result = await runHotDeckImputation(data, ["score"]);
    expect(result).toEqual(imputeHotDeck(data, ["score"]));
  });

  it("rejects immediately when the signal is already aborted", async () => {
    const controller = new AbortController();
    controller.abort();

    await expect(
      runHotDeckImputation(data, ["score"], undefined, { signal: controller.signal })
    ).rejects.toMatchObject({ name: "AbortError" });
    expect(FakeWorker.instances).toHaveLength(0);
  });

  it("sends only the selected columns to the worker and merges its patches", async () => {
    enableWorker();
    const promise = runHotDeckImputation(data, ["score"]);

    const worker = FakeWorker.instances[0];
    expect(worker.posted).toHaveLength(1);
    expect(worker.posted[0]).toMatchObject({
      type: "hot_deck",
      payload: { selectedColumns: ["score"] },
    });

    worker.emit("message", {
      id: worker.posted[0].id,
      type: "success",
      columnPatches: { 1: ["9", "5"] },
    });

    await expect(promise).resolves.toEqual([
      ["id", "score"],
      ["1", "9"],
      ["2", "5"],
    ]);
    expect(worker.terminated).toBe(true);
  });

  it("terminates the worker and rejects with AbortError without falling back", async () => {
    enableWorker();
    const controller = new AbortController();
    const promise = runHotDeckImputation(data, ["score"], undefined, {
      signal: controller.signal,
    });
    const worker = FakeWorker.instances[0];

    controller.abort();

    await expect(promise).rejects.toMatchObject({ name: "AbortError" });
    expect(worker.terminated).toBe(true);
  });

  it("falls back to synchronous imputation when the worker reports an error", async () => {
    enableWorker();
    const promise = runHotDeckImputation(data, ["score"]);
    const worker = FakeWorker.instances[0];

    worker.emit("message", {
      id: worker.posted[0].id,
      type: "error",
      error: "boom",
    });

    await expect(promise).resolves.toEqual(imputeHotDeck(data, ["score"]));
    expect(worker.terminated).toBe(true);
  });
});
