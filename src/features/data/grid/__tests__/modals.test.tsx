import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, it, expect, vi, beforeEach } from "vitest";
import { setLocale } from "../../../../i18n";
import {
  ValueLabelsModal,
  QUICK_VALUE_LABEL_TEMPLATES,
  getQuickValueLabelTemplates,
  upsertValueLabel,
  removeValueLabel,
  formatValueLabelsSummary,
} from "../ValueLabelsModal";
import {
  MissingValuesModal,
  parseAndValidateDiscreteMissing,
  formatMissingValuesSummary,
  parseAndValidateRangeMissing,
} from "../MissingValuesModal";

describe("Task 4: ValueLabelsModal & MissingValuesModal", () => {
  beforeEach(() => {
    setLocale("vi");
  });

  describe("ValueLabelsModal logic & rendering", () => {
    it("provides standard academic quick templates (Likert 5, Gender, Binary) for both locales", () => {
      setLocale("vi");
      expect(QUICK_VALUE_LABEL_TEMPLATES.likert5["1"]).toBe("Hoàn toàn không đồng ý");
      expect(QUICK_VALUE_LABEL_TEMPLATES.likert5["5"]).toBe("Hoàn toàn đồng ý");
      expect(QUICK_VALUE_LABEL_TEMPLATES.gender).toEqual({
        "1": "Nam",
        "2": "Nữ",
        "3": "Khác",
      });
      expect(QUICK_VALUE_LABEL_TEMPLATES.binary).toEqual({
        "0": "Không",
        "1": "Có",
      });

      setLocale("en");
      expect(QUICK_VALUE_LABEL_TEMPLATES.likert5["1"]).toBe("Strongly disagree");
      expect(QUICK_VALUE_LABEL_TEMPLATES.likert5["5"]).toBe("Strongly agree");
      expect(QUICK_VALUE_LABEL_TEMPLATES.gender).toEqual({
        "1": "Male",
        "2": "Female",
        "3": "Other",
      });
      expect(QUICK_VALUE_LABEL_TEMPLATES.binary).toEqual({
        "0": "No",
        "1": "Yes",
      });
    });

    it("adds and updates value-label pairs immutably with validation", () => {
      setLocale("vi");
      const initial = { "1": "Nam" };
      const added = upsertValueLabel(initial, " 2 ", " Nữ ");
      expect(added.error).toBeUndefined();
      expect(added.next).toEqual({ "1": "Nam", "2": "Nữ" });
      expect(initial).toEqual({ "1": "Nam" }); // immutable

      const updated = upsertValueLabel(added.next, "1", "Nam giới");
      expect(updated.next["1"]).toBe("Nam giới");

      const emptyVal = upsertValueLabel(initial, "   ", "Nhãn");
      expect(emptyVal.error).toBeDefined();

      const emptyLabel = upsertValueLabel(initial, "3", "   ");
      expect(emptyLabel.error).toBeDefined();
    });

    it("removes a value-label pair immutably", () => {
      const initial = { "1": "Nam", "2": "Nữ" };
      const next = removeValueLabel(initial, "1");
      expect(next).toEqual({ "2": "Nữ" });
      expect(initial).toEqual({ "1": "Nam", "2": "Nữ" });
    });

    it("formats value labels summary for grid display in active locale", () => {
      setLocale("en");
      expect(formatValueLabelsSummary(undefined)).toBe("None");
      expect(formatValueLabelsSummary({})).toBe("None");
      expect(formatValueLabelsSummary({ "1": "Male", "2": "Female" })).toContain('1="Male"');

      setLocale("vi");
      expect(formatValueLabelsSummary(undefined)).toBe("Không");
      expect(formatValueLabelsSummary({})).toBe("Không");
      expect(formatValueLabelsSummary({ "1": "Nam", "2": "Nữ" })).toContain('1="Nam"');
    });

    it("renders nothing when isOpen is false and renders 2-column modal when open", () => {
      setLocale("vi");
      const closedHtml = renderToStaticMarkup(
        <ValueLabelsModal
          isOpen={false}
          variableName="Q1_SAT"
          initialValueLabels={{ "1": "Kém" }}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(closedHtml).toBe("");

      const openHtml = renderToStaticMarkup(
        <ValueLabelsModal
          isOpen={true}
          variableName="Q1_SAT"
          initialValueLabels={{ "1": "Hoàn toàn không đồng ý", "5": "Hoàn toàn đồng ý" }}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(openHtml).toContain("Q1_SAT");
      expect(openHtml).toContain("Hoàn toàn không đồng ý");
      expect(openHtml).toContain("Likert 5");
    });
  });

  describe("MissingValuesModal logic & rendering", () => {
    it("parses and validates up to 3 discrete missing values", () => {
      const valid = parseAndValidateDiscreteMissing([" 99 ", "-1", ""]);
      expect(valid.valid).toBe(true);
      expect(valid.values).toEqual(["99", "-1"]);

      const empty = parseAndValidateDiscreteMissing(["", "  ", ""]);
      expect(empty.valid).toBe(true);
      expect(empty.values).toEqual([]);

      const duplicate = parseAndValidateDiscreteMissing(["99", "99", ""]);
      expect(duplicate.valid).toBe(false);
      expect(duplicate.error).toBeDefined();

      const tooMany = parseAndValidateDiscreteMissing(["99", "999", "-1", "-9"]);
      expect(tooMany.valid).toBe(false);
      expect(tooMany.error).toBeDefined();
    });

    it("validates a missing range (+ at most 1 discrete code) and shows it in the summary", () => {
      const ok = parseAndValidateRangeMissing("98", "99", ["-1"]);
      expect(ok).toMatchObject({ valid: true, range: { min: 98, max: 99 }, values: ["-1"] });
      expect(parseAndValidateRangeMissing("0,5", "2", []).range).toEqual({ min: 0.5, max: 2 });
      expect(parseAndValidateRangeMissing("99", "98", []).valid).toBe(false); // từ > đến
      expect(parseAndValidateRangeMissing("", "98", []).valid).toBe(false);
      expect(parseAndValidateRangeMissing("a", "98", []).valid).toBe(false);
      expect(parseAndValidateRangeMissing("1", "2", ["7", "8"]).valid).toBe(false); // chỉ 1 mã đi kèm

      setLocale("en");
      expect(formatMissingValuesSummary([], { min: 98, max: 99 })).toBe("98 – 99");
      expect(formatMissingValuesSummary(["-1"], { min: 98, max: 99 })).toBe("98 – 99, -1");
      expect(formatMissingValuesSummary(undefined, undefined)).toBe("None");
    });

    it("opens in range mode with the existing range prefilled", () => {
      setLocale("en");
      const html = renderToStaticMarkup(
        <MissingValuesModal
          isOpen={true}
          variableName="q1"
          initialMissingValues={["97"]}
          initialMissingRange={{ min: 98, max: 99 }}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(html).toContain("Range of missing values");
      expect(html).toContain('value="98"');
      expect(html).toContain('value="99"');
      expect(html).toContain('value="97"');
    });

    it("formats missing values summary for grid display in active locale", () => {
      setLocale("en");
      expect(formatMissingValuesSummary(undefined)).toBe("None");
      expect(formatMissingValuesSummary([])).toBe("None");
      expect(formatMissingValuesSummary(["99", "999"])).toBe("99, 999");

      setLocale("vi");
      expect(formatMissingValuesSummary(undefined)).toBe("Không");
      expect(formatMissingValuesSummary([])).toBe("Không");
      expect(formatMissingValuesSummary(["99", "999"])).toBe("99, 999");
    });

    it("renders nothing when isOpen is false and renders mode options when open", () => {
      setLocale("en");
      const closedHtml = renderToStaticMarkup(
        <MissingValuesModal
          isOpen={false}
          variableName="INCOME"
          initialMissingValues={["99"]}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(closedHtml).toBe("");

      const openHtml = renderToStaticMarkup(
        <MissingValuesModal
          isOpen={true}
          variableName="INCOME"
          initialMissingValues={["99", "999"]}
          onSave={vi.fn()}
          onClose={vi.fn()}
        />
      );
      expect(openHtml).toContain("INCOME");
      expect(openHtml).toContain("No missing values");
      expect(openHtml).toContain("Discrete missing values");
      expect(openHtml).toContain('value="99"');
      expect(openHtml).toContain('value="999"');
    });
  });
});
