import { describe, expect, it } from "vitest";
import { HISTORY_BYTE_LIMIT, retainHistoryStep, type HistoryStep } from "../datasetHistory";

function step(datasetId: string, sequence: number): HistoryStep {
  return {
    change: { id: String(sequence), datasetId, timestamp: "", action: "cell", kind: "commit" },
    before: {}, after: {}, bytes: HISTORY_BYTE_LIMIT / 2, sequence,
  };
}

describe("workspace undo budget", () => {
  it("keeps a newer dataset's undo by evicting the oldest step globally", () => {
    const oldest = step("first", 1);
    const recent = step("first", 2);
    const newest = step("second", 3);
    const histories = new Map([["first", { undo: [oldest, recent], redo: [] }]]);

    const retained = retainHistoryStep(histories, newest);

    expect(retained.get("first")?.undo).toEqual([recent]);
    expect(retained.get("second")?.undo).toEqual([newest]);
    expect(histories.get("first")?.undo).toEqual([oldest, recent]);
  });

  it("evicts by age even when Map insertion order differs", () => {
    const recent = step("first", 2);
    const oldest = step("second", 1);
    const newest = step("third", 3);
    const retained = retainHistoryStep(new Map([
      ["first", { undo: [recent], redo: [] }],
      ["second", { undo: [oldest], redo: [] }],
    ]), newest);

    expect(retained.has("second")).toBe(false);
    expect(retained.get("first")?.undo).toEqual([recent]);
    expect(retained.get("third")?.undo).toEqual([newest]);
  });
});
