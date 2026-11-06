import { renderToStaticMarkup } from "react-dom/server";
import { afterEach, describe, expect, it } from "vitest";
import { getLocale, setLocale } from "@/i18n";
import type { VariableMetadata } from "@/types";
import { FactorItemPicker, filterFactorItems } from "../FactorItemPicker";

const columns = ["Q1", "Q2", "student_id"];
const variables: Record<string, VariableMetadata> = {
  Q1: { name: "Q1", label: "Campus satisfaction", type: "numeric", measure: "ordinal", decimals: 0, align: "right" },
  student_id: { name: "student_id", label: "Student number", type: "numeric", measure: "nominal", decimals: 0, align: "right" },
};

describe("factor item picker", () => {
  const locale = getLocale();
  afterEach(() => setLocale(locale));

  it("matches a trimmed query against names and labels without changing column order", () => {
    expect(filterFactorItems(columns, variables, "  SATISFACTION ")).toEqual([{ name: "Q1", label: "Campus satisfaction" }]);
    expect(filterFactorItems(columns, variables, "q")).toEqual([{ name: "Q1", label: "Campus satisfaction" }, { name: "Q2", label: null }]);
    expect(filterFactorItems(columns, variables, "unknown")).toEqual([]);
  });

  it("renders toggle buttons with selection state and explains numeric Likert treatment", () => {
    setLocale("en");
    const html = renderToStaticMarkup(
      <FactorItemPicker columns={columns} variables={variables} selected={["Q1"]} onToggle={() => {}} />,
    );
    expect(html).toMatch(/<legend[^>]*>Select variables \(items\)<\/legend>/);
    expect(html).toMatch(/<input[^>]*type="search"[^>]*aria-label="Search by name or label"/);
    expect(html).toMatch(/<button[^>]*type="button"[^>]*aria-pressed="true"[^>]*><span[^>]*>Q1<\/span><span[^>]*>— Campus satisfaction<\/span><\/button>/);
    expect(html).toMatch(/<button[^>]*aria-pressed="false"[^>]*><span[^>]*>Q2<\/span><\/button>/);
    expect(html).toContain("1 selected");
    expect(html).toContain("Likert scores are treated as numbers");
    expect(html).not.toContain("Nominal items selected");
  });

  it("warns about a selected nominal item in Vietnamese without blocking selection", () => {
    setLocale("vi");
    const html = renderToStaticMarkup(
      <FactorItemPicker columns={columns} variables={variables} selected={["student_id"]} onToggle={() => {}} />,
    );
    expect(html).toMatch(/<button[^>]*aria-pressed="true"[^>]*><span[^>]*>student_id<\/span>.*?Student number/);
    expect(html).toContain("Đã chọn biến định danh");
    expect(html).toContain("student_id");
    expect(html).toContain("Điểm Likert được xử lý như số");
  });
});
