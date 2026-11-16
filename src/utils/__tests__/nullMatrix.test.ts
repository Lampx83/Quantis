import { describe, it, expect } from "vitest";
import { nullToNaNMatrix } from "@/api";

describe("nullToNaNMatrix", () => {
  it("đổi null (hệ số không xác định từ JSON) thành NaN, giữ nguyên số", () => {
    const r = nullToNaNMatrix({ columnNames: ["a", "b"], matrix: [[1, null], [null, 1]] });
    expect(r?.columnNames).toEqual(["a", "b"]);
    expect(Number.isNaN(r!.matrix[0][1])).toBe(true);
    expect(r!.matrix[0][0]).toBe(1);
    expect(r!.matrix.flat().every((v) => typeof v === "number")).toBe(true);
  });
  it("kết quả rỗng/null trả null", () => {
    expect(nullToNaNMatrix(null)).toBeNull();
  });
});
