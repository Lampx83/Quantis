import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { setLocale } from "@/i18n";
import { getDefaultStandardWorkflow } from "@/sample-data";
import * as stores from "@/stores";
import { AppHeader } from "../AppHeader";
import { AppToolbar } from "../AppToolbar";

describe("dataset history controls", () => {
  afterEach(() => vi.restoreAllMocks());

  it.each(["data", "workflow"] as const)("keeps Undo and Redo in the %s toolbar and lists History in the app menu", (mainSection) => {
    setLocale("en");
    vi.spyOn(stores, "useUIStore").mockReturnValue({
      ...stores.useUIStore.getInitialState(),
      mainSection,
      headerMenuOpen: true,
    });
    const workflow = getDefaultStandardWorkflow();
    vi.spyOn(stores, "useWorkflowStore").mockReturnValue({
      ...stores.useWorkflowStore.getInitialState(),
      workflows: [workflow],
      selectedWorkflowId: workflow.id,
      selectedWorkflowStepId: workflow.steps.find((step) => step.type === "import")!.id,
    });

    const toolbar = renderToStaticMarkup(<AppToolbar />);
    const header = renderToStaticMarkup(<AppHeader />);
    const menu = header.match(/<div role="menu"[^>]*>(.*?)<\/div><\/div>/)?.[1];

    expect(toolbar).toContain(" Undo</button>");
    expect(toolbar).toContain(" Redo</button>");
    expect(toolbar).not.toContain(" History</button>");
    expect(menu).toMatch(/role="menuitem"[^>]*disabled=""[^>]*>.*?History<\/button>/);
    expect(menu).toContain("Download sample workflow");
    expect(menu).toContain("Workflows &amp; reproducibility");
  });
});
