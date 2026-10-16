// Kiểm thử lọc \u0000 / ký tự điều khiển: node scripts/test-sanitize.mjs
import { build } from "esbuild";
import { pathToFileURL } from "node:url";
import { mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import assert from "node:assert/strict";

const dir = mkdtempSync(join(tmpdir(), "sz-"));
const load = async (entry, name) => {
  const out = join(dir, name + ".mjs");
  await build({ entryPoints: [entry], bundle: true, format: "esm", outfile: out, logLevel: "silent" });
  return import(pathToFileURL(out).href);
};
const be = await load("backend/src/lib/sanitize.ts", "be");
const fe = await load("src/utils/sanitize.ts", "fe");

const dirty = {
  datasets: [{ id: "a\u0000b", name: "Bảng\u0000 1", data: [["x\u0000", "y\u0001z", "tab\there", "line\nbreak"], ["\ud83d", "ok😀", "\u007f", "9"]] }],
  workflows: [{ "k\u0000ey": "v\u0000" }],
};
const clean = be.sanitizeJson(dirty);
const txt = JSON.stringify(clean);
assert.ok(!txt.includes("\\u0000") && !/\\u00(0[0-8b-cB-C]|1[0-9a-fA-F]|7f)/.test(txt), txt);
assert.equal(clean.datasets[0].name, "Bảng 1");
assert.deepEqual(clean.datasets[0].data[0], ["x", "yz", "tab\there", "line\nbreak"]);
assert.deepEqual(clean.datasets[0].data[1], ["", "ok😀", "", "9"]);
assert.equal(clean.workflows[0].key, "v");
// không đụng tới chuỗi hợp lệ, dữ liệu gốc không bị sửa
assert.equal(dirty.datasets[0].name, "Bảng\u0000 1");
// client
assert.deepEqual(fe.cleanRows([["a\u0000", "b"]]), [["a", "b"]]);
assert.ok(!JSON.stringify({ s: "a\u0000b" }, fe.cleanJsonReplacer).includes("\\u0000"));
assert.equal(JSON.stringify({ s: "a\u0000b" }, fe.cleanJsonReplacer), '{"s":"ab"}');
console.log("sanitize OK");
