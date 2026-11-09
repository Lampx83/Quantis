import { describe, expect, it, vi } from "vitest";
import { handleDatasetHistoryShortcut } from "../useDatasetHistoryShortcuts";

describe("dataset history shortcuts", () => {
  it.each([
    [false, { key: "z", ctrlKey: true }, "undo"],
    [false, { key: "y", ctrlKey: true }, "redo"],
    [false, { key: "Z", ctrlKey: true, shiftKey: true }, "redo"],
    [true, { key: "z", metaKey: true }, "undo"],
    [true, { key: "Z", metaKey: true, shiftKey: true }, "redo"],
  ] as const)("dispatches the platform shortcut and consumes it after success", (mac, keys, direction) => {
    const event = { ...new KeyboardEventStub(), ...keys };
    const run = vi.fn(() => true);
    handleDatasetHistoryShortcut(event, mac, false, run);
    expect(run).toHaveBeenCalledWith(direction);
    expect(event.preventDefault).toHaveBeenCalledOnce();
  });

  it("leaves events available inside editors, in modals, or when the stack is empty", () => {
    const event = { ...new KeyboardEventStub(), ctrlKey: true, key: "z" };
    const run = vi.fn(() => false);
    handleDatasetHistoryShortcut(event, false, true, run);
    expect(run).not.toHaveBeenCalled();
    handleDatasetHistoryShortcut(event, false, false, run);
    expect(run).toHaveBeenCalledWith("undo");
    expect(event.preventDefault).not.toHaveBeenCalled();
  });
});

class KeyboardEventStub {
  key = "";
  ctrlKey = false;
  metaKey = false;
  shiftKey = false;
  altKey = false;
  isComposing = false;
  defaultPrevented = false;
  preventDefault = vi.fn();
}
