import { describe, it, expect } from "vitest";
import { computeVariable } from "../dataPrep";

const rows = [
  ["a", "b"],
  ["0", "5"],
  ["1", "5"],
  ["3", ""],
  ["", "2"],
];
const col = (r: { rows: string[][] }, name = "x") => {
  const i = r.rows[0].indexOf(name);
  return r.rows.slice(1).map((x) => x[i]);
};

describe("công thức: so sánh và if()", () => {
  it("so sánh trả 1/0 và để trống khi thiếu giá trị", () => {
    expect(col(computeVariable(rows, "x", "a > 0"))).toEqual(["0", "1", "1", ""]);
    expect(col(computeVariable(rows, "x", "a >= 1"))).toEqual(["0", "1", "1", ""]);
    expect(col(computeVariable(rows, "x", "a <= 1"))).toEqual(["1", "1", "0", ""]);
    expect(col(computeVariable(rows, "x", "a = 1"))).toEqual(["0", "1", "0", ""]);
    expect(col(computeVariable(rows, "x", "a != 1"))).toEqual(["1", "0", "1", ""]);
    expect(col(computeVariable(rows, "x", "a <> 1"))).toEqual(["1", "0", "1", ""]);
  });
  it("if(điều_kiện, đúng, sai)", () => {
    expect(col(computeVariable(rows, "x", "if(a > 0, 1, 0)"))).toEqual(["0", "1", "1", ""]);
    expect(col(computeVariable(rows, "x", "if(a > 0, b, -1)"))).toEqual(["-1", "5", "", ""]);
  });
  it("and / or / not / sign", () => {
    expect(col(computeVariable(rows, "x", "and(a > 0, b > 0)"))).toEqual(["0", "1", "", ""]);
    expect(col(computeVariable(rows, "x", "or(a > 2, b > 4)"))).toEqual(["1", "1", "", ""]);
    expect(col(computeVariable(rows, "x", "not(a > 0)"))).toEqual(["1", "0", "0", ""]);
    expect(col(computeVariable(rows, "x", "sign(a)"))).toEqual(["0", "1", "1", ""]);
  });
  it("so sánh ưu tiên thấp hơn cộng trừ; công thức số học cũ không đổi", () => {
    expect(col(computeVariable(rows, "x", "a + 1 > 2"))).toEqual(["0", "0", "1", ""]);
    expect(col(computeVariable(rows, "x", "a + b"))).toEqual(["5", "6", "", ""]);
  });
  it("báo lỗi rõ khi sai cú pháp", () => {
    expect(computeVariable(rows, "x", "if(a > 0, 1)").stats).toBeUndefined();
    expect(computeVariable(rows, "x", "a ! 1").rows[0]).toEqual(["a", "b"]);
  });
});
