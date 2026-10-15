// Kiểm thử các hàm chuẩn bị dữ liệu: node scripts/test-dataprep.mjs
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const out = join(mkdtempSync(join(tmpdir(), "dp-")), "dataPrep.mjs");
await build({ entryPoints: ["src/utils/dataPrep.ts"], bundle: true, format: "esm", outfile: out, logLevel: "silent" });
const m = await import(pathToFileURL(out).href);
const close = (a, b, e = 1e-9) => assert.ok(Math.abs(a - b) < e, `${a} != ${b}`);

const rows = [
  ["Mã", "Điểm 1", "Điểm 2", "Nhóm"],
  ["a", "6", "8", "x"],
  ["b", "7", "", "y"],
  ["c", "8", "9", "x"],
  ["d", "100", "10", "y"],
  ["e", "5", "7", "x"],
  ["f", "6", "8", "x"],
];
// đổi tên
assert.equal(m.renameColumn(rows, "Điểm 1", "D1").rows[0][1], "D1");
assert.ok(m.renameColumn(rows, "Điểm 1", "Mã").error);
// công thức
let r = m.computeVariable(rows, "TB", "([Điểm 1] + [Điểm 2]) / 2");
assert.equal(r.rows[1][4], "7");
assert.equal(r.rows[2][4], "", "thiếu lan truyền");
assert.equal(r.stats.missing, 1);
r = m.computeVariable(rows, "TB2", "mean([Điểm 1], [Điểm 2])");
assert.equal(r.rows[2][4], "7", "mean bỏ qua ô thiếu");
r = m.computeVariable(rows, "L", "ln([Điểm 1]) + 2^3^0 - -1");
close(Number(r.rows[1][4]), Math.log(6) + 2 + 1);
r = m.computeVariable(rows, "Z", "round(sqrt([Điểm 1])*10, 1)");
close(Number(r.rows[1][4]), Math.round(Math.sqrt(6) * 100) / 10);
assert.ok(m.computeVariable(rows, "X", "[Không có] + 1").error);
assert.ok(m.computeVariable(rows, "X", "foo(1)").error);
assert.ok(m.computeVariable(rows, "Mã", "1+1").error);
assert.equal(m.computeVariable(rows, "Y", "[Điểm 1] / 0").rows[1][4], "");
// ép kiểu
const c = m.coerceColumns([["v"], ["1,5"], ["1.234,5"], ["12%"], ["abc"], [""], [" 7 "]], ["v"], "numeric");
assert.deepEqual(c.rows.slice(1).map((x) => x[0]), ["1.5", "1234.5", "0.12", "", "", "7"]);
assert.equal(c.stats.invalid, 1);
// log
const lg = m.logTransform([["x"], ["1"], ["0"], ["-3"], ["e"], ["10"]], ["x"], "log10");
assert.equal(lg.rows[0][1], "log10(x)");
assert.equal(lg.rows[1][1], "0"); assert.equal(lg.rows[2][1], ""); assert.equal(lg.stats.invalid, 2);
assert.equal(lg.rows[5][1], "1");
// IQR: numpy: np.percentile([5,6,6,7,8,100],[25,75]) = 6.0, 7.75 -> fence [3.375, 9.375]
const o = m.removeOutliersIQR(rows, ["Điểm 1"]);
assert.equal(o.stats.removed, 1); assert.equal(o.rows.length, 6);
assert.ok(!o.rows.some((x) => x[0] === "d"));
close(m.quantileSorted([5, 6, 6, 7, 8, 100], 0.25), 6.0); close(m.quantileSorted([5, 6, 6, 7, 8, 100], 0.75), 7.75);
// trùng
const dd = m.removeDuplicates([["a", "b"], ["1", "2"], ["1", "2"], ["1", "3"], [" 1", "2 "]], []);
assert.equal(dd.stats.removed, 2); assert.equal(dd.rows.length, 3);
const dd2 = m.removeDuplicates([["a", "b"], ["1", "2"], ["1", "3"]], ["a"]);
assert.equal(dd2.stats.removed, 1);
console.log("dataPrep OK");
