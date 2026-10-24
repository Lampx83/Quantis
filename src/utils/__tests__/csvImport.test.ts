import { describe, it, expect } from "vitest";
import { detectDelimiter, parseFileContent, describeParseAssumptions } from "../stats";
import { setLocale } from "../../i18n";

describe("detectDelimiter: dò mẫu, không chỉ nhìn dòng tiêu đề", () => {
  it("CSV chuẩn dùng dấu phẩy giữ nguyên", () => {
    expect(detectDelimiter("ten,tuoi,diem\nA,20,3.5\nB,21,4.25\n")).toBe(",");
    expect(detectDelimiter('ten,ghi_chu\nA,"x; y"\nB,"z, w"\n')).toBe(",");
    expect(detectDelimiter("ten,ghi_chu\nA,x;y\nB,z;w\n")).toBe(",");
  });

  it("tệp ; với số thập phân dấu phẩy không bị chọn nhầm dấu phẩy", () => {
    expect(detectDelimiter("ten;diem;tuoi\nA;3,5;20\nB;4,25;21\n")).toBe(";");
    // tiêu đề có dấu phẩy: dòng đầu có 1 dấu , và 1 dấu ; → cách đoán cũ chọn nhầm ","
    expect(detectDelimiter("Điểm, TB;Tuổi\n3,5;20\n4,25;21\n")).toBe(";");
  });

  it("tệp tab (.csv/.txt xuất từ Excel) nhận ra tab", () => {
    expect(detectDelimiter("ten\tdiem\nA\t3,5\nB\t4,25\n")).toBe("\t");
    expect(detectDelimiter("ten\tghi chu, dai\nA\tx, y\nB\tz, w\n")).toBe("\t");
  });

  it("một cột, rỗng → mặc định dấu phẩy", () => {
    expect(detectDelimiter("diem\n1\n2\n")).toBe(",");
    expect(detectDelimiter("")).toBe(",");
  });

  it("bỏ qua BOM và dấu nằm trong ngoặc kép", () => {
    expect(detectDelimiter('﻿a;b\n"1,5";2\n')).toBe(";");
  });
});

describe("parseFileContent: số thập phân dấu phẩy không bọc ngoặc kép", () => {
  const csvSemi = "ten;diem;tuoi\nA;3,5;20\nB;4,25;21\nC;5;22\n";

  it(".csv phân tách ; : «3,5» thành 3.5, không tách thành hai cột", () => {
    const r = parseFileContent(csvSemi, "a.csv");
    expect(r.rows).toEqual([["ten", "diem", "tuoi"], ["A", "3.5", "20"], ["B", "4.25", "21"], ["C", "5", "22"]]);
    expect(r.delimiter).toBe(";");
    expect(r.delimiterGuessed).toBe(true);
    expect(r.decimalCommaColumns).toEqual(["diem"]);
  });

  it("tiêu đề có dấu phẩy nhưng dữ liệu ; vẫn đúng 2 cột", () => {
    const r = parseFileContent("Điểm, TB;Tuổi\n3,5;20\n4,25;21\n", "a.csv");
    expect(r.rows).toEqual([["Điểm, TB", "Tuổi"], ["3.5", "20"], ["4.25", "21"]]);
  });

  it(".csv hoặc .tsv phân tách tab: «3,5» thành 3.5", () => {
    const tab = "ten\tdiem\nA\t3,5\nB\t4,25\n";
    expect(parseFileContent(tab, "a.csv").rows).toEqual([["ten", "diem"], ["A", "3.5"], ["B", "4.25"]]);
    expect(parseFileContent(tab, "a.csv").format).toBe("tsv");
    const tsv = parseFileContent(tab, "a.tsv");
    expect(tsv.rows).toEqual([["ten", "diem"], ["A", "3.5"], ["B", "4.25"]]);
    expect(tsv.delimiterGuessed).toBe(false); // .tsv: dấu phân cách đã rõ, chỉ báo chuyện đổi thập phân
    expect(parseFileContent(tab, "a.txt").rows).toEqual([["ten", "diem"], ["A", "3.5"], ["B", "4.25"]]);
  });

  it("chỉ đổi cột thuần số; cột chữ có dấu phẩy giữ nguyên", () => {
    const r = parseFileContent("ten;ghi chu;diem\nA;tốt, khá;3,5\nB;ổn;4\n", "a.csv");
    expect(r.rows[1]).toEqual(["A", "tốt, khá", "3.5"]);
    expect(r.decimalCommaColumns).toEqual(["diem"]);
  });

  it("không phá CSV chuẩn dùng , (kể cả ô bọc ngoặc kép chứa dấu phẩy và số hàng nghìn)", () => {
    const std = 'ten,diem,ghi_chu,luong\nA,3.5,"khá, tốt","1,234"\nB,4.25,ổn,"5,678"\n';
    const r = parseFileContent(std, "a.csv");
    expect(r.rows).toEqual([["ten", "diem", "ghi_chu", "luong"], ["A", "3.5", "khá, tốt", "1,234"], ["B", "4.25", "ổn", "5,678"]]);
    expect(r.delimiter).toBe(",");
    expect(r.delimiterGuessed).toBe(false);
    expect(r.decimalCommaColumns).toEqual([]);
    expect(describeParseAssumptions(r)).toBeNull();
  });

  it("CSV dùng , có cả cột số-phẩy-số bọc ngoặc kép ('3,5') thì đổi cột đó", () => {
    const r = parseFileContent('ten,diem\nA,"3,5"\nB,"4,25"\nC,5\n', "a.csv");
    expect(r.rows).toEqual([["ten", "diem"], ["A", "3.5"], ["B", "4.25"], ["C", "5"]]);
    expect(r.decimalCommaColumns).toEqual(["diem"]);
  });

  it("BOM đầu tệp không dính vào tên cột đầu", () => {
    expect(parseFileContent("﻿ten;diem\nA;3,5\n", "a.csv").rows[0]).toEqual(["ten", "diem"]);
  });

  it("JSON không bị đụng tới", () => {
    expect(parseFileContent('[{"a":"1,5","b":"x"}]', "a.json").rows).toEqual([["a", "b"], ["1,5", "x"]]);
  });
});

describe("describeParseAssumptions: thông báo ngắn song ngữ", () => {
  it("báo dấu phân cách đoán và cột đã đổi thập phân", () => {
    const r = parseFileContent("ten;diem;tuoi\nA;3,5;20\nB;4,25;21\n", "a.csv");
    setLocale("vi");
    const vi = describeParseAssumptions(r)!;
    expect(vi).toContain("chấm phẩy");
    expect(vi).toContain("diem");
    expect(vi).toContain("kiểm tra");
    setLocale("en");
    const en = describeParseAssumptions(r)!;
    expect(en).toContain("semicolon");
    expect(en).toContain("diem");
    expect(en).toContain("check");
    setLocale("vi");
  });

  it("CSV ; không có số thập phân vẫn báo đã tự nhận dấu phân cách; tệp , chuẩn không báo gì", () => {
    expect(describeParseAssumptions(parseFileContent("a;b\nx;y\n", "a.csv"))).not.toBeNull();
    expect(describeParseAssumptions(parseFileContent("a,b\nx,y\n", "a.csv"))).toBeNull();
  });
});
