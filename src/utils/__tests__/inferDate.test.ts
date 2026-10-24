import { describe, it, expect } from "vitest";
import { inferVariableMetadata, isDateString } from "../metadata";

const type = (values: string[]) => inferVariableMetadata("x", values).type;

describe("suy kiểu Date: chỉ ngày thật mới là Date", () => {
  it("source_name kiểu «phong-van-01» là chuỗi, không phải ngày", () => {
    const names = ["phong-van-01", "phong-van-02", "phong-van-03", "phong-van-04", "phong-van-05", "phong-van-06"];
    const meta = inferVariableMetadata("source_name", names);
    expect(meta.type).toBe("string");
    expect(meta.measure).toBe("nominal");
    expect(meta.align).toBe("left");
  });

  it.each([
    ["2024-A"], ["S-01"], ["01-02"], ["SV-2024-001"], ["0912-345-678"], ["084-123-4567"], ["PV-2024-12-01"],
    ["ABC-2024-12-31"], ["A1-B2-C3-D4"], ["2024-001"], ["10-2024"], ["12/2024"], ["1-2-3-4-5"],
  ])("mã %s lặp cả cột không là Date", (code) => {
    expect(type([code, code, code, code, code])).toBe("string");
  });

  it("mã sinh viên / số điện thoại thuần số vẫn là numeric (không bị ép thành Date)", () => {
    expect(type(["11201234", "11205678", "11209012"])).toBe("numeric");
    expect(type(["0912345678", "0987654321", "0345678901"])).toBe("numeric");
  });

  it.each([
    ["2024-03-15"], ["2024/03/15"], ["15/03/2024"], ["15-03-2024"], ["15.03.2024"], ["3/15/2024"],
    ["2024-03-15T10:30:00"], ["2024-03-15 10:30"], ["2024-03-15T10:30:00Z"], ["15 Mar 2024"], ["Mar 15, 2024"], ["29/02/2024"],
  ])("nhận %s là ngày", (d) => {
    expect(isDateString(d)).toBe(true);
    expect(type([d, d, d, d])).toBe("date");
  });

  it.each([
    ["31/02/2024"], ["29/02/2023"], ["2024-13-01"], ["2024-00-10"], ["32/01/2024"], ["13/13/2024"], ["2024-02-30"], ["15 Foo 2024"],
  ])("từ chối ngày không hợp lệ %s", (d) => {
    expect(isDateString(d)).toBe(false);
  });

  it("cột ngày thật vẫn là Date (thang scale, căn giữa)", () => {
    const meta = inferVariableMetadata("ngay", ["2024-01-05", "2024-02-17", "2024-03-30", "2024-04-01"]);
    expect(meta.type).toBe("date");
    expect(meta.measure).toBe("scale");
    expect(meta.align).toBe("center");
  });

  it("chỉ là Date khi đa số ô (≥ 90%) khớp định dạng ngày", () => {
    const ds = Array.from({ length: 9 }, (_, i) => `2024-01-${String(i + 1).padStart(2, "0")}`);
    expect(type([...ds, "2024-01-10"])).toBe("date"); // 10/10
    expect(type([...ds, "không rõ"])).toBe("date"); // 9/10 = 90%
    expect(type([...ds.slice(0, 5), "pv-01", "pv-02", "pv-03", "pv-04"])).toBe("string"); // 5/9
    expect(type(["2024-01-05", "S-01", "S-02", "S-03"])).toBe("string");
  });
});
