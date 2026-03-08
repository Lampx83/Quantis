#!/usr/bin/env node
/**
 * Package Quantis app (frontend-only) into zip for installation from AI Portal.
 * Run: npm run pack  → dist/quantis-app-package.zip (build từ public/)
 * Run: npm run pack:build  → build vào dist/build rồi đóng gói (tránh ghi đè public/)
 * Run: npm run pack:basepath  → dist/quantis-app-package-basepath.zip
 */
import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.join(__dirname, "..");
const publicDir = path.join(root, process.env.PACK_SOURCE || "public");
const outDir = path.join(root, "dist");
const baseName = process.env.PACK_BASEPATH ? "quantis-app-package-basepath" : "quantis-app-package";
const outZip = path.join(outDir, baseName + ".zip");

function addDirToZip(zip, localDir, zipPrefix = "") {
  if (!fs.existsSync(localDir)) return;
  const items = fs.readdirSync(localDir);
  for (const item of items) {
    const full = path.join(localDir, item);
    const rel = zipPrefix ? path.join(zipPrefix, item) : item;
    if (fs.statSync(full).isDirectory()) {
      addDirToZip(zip, full, rel);
    } else if (!rel.endsWith(".zip") && !rel.includes("quantis-app-package/") && !rel.endsWith(".DS_Store")) {
      const zipDir = path.dirname(rel);
      zip.addLocalFile(full, zipDir ? zipDir + "/" : "", path.basename(rel));
    }
  }
}

async function main() {
  const manifestPath = path.join(root, "package", "manifest.json");
  if (!fs.existsSync(manifestPath)) {
    console.error("Missing package/manifest.json");
    process.exit(1);
  }
  if (!fs.existsSync(publicDir)) {
    console.error("Missing directory:", publicDir, "- Run: npm run build (or npm run pack:build)");
    process.exit(1);
  }
  const indexPath = path.join(publicDir, "index.html");
  if (!fs.existsSync(indexPath)) {
    console.error("Missing index.html in", publicDir, "- Run: npm run build (or npm run pack:build)");
    process.exit(1);
  }

  const AdmZip = (await import("adm-zip")).default;
  const zip = new AdmZip();

  zip.addLocalFile(manifestPath, "", "manifest.json");
  addDirToZip(zip, publicDir, "public");
  const schemaDir = path.join(root, "schema");
  if (fs.existsSync(schemaDir)) addDirToZip(zip, schemaDir, "schema");

  fs.mkdirSync(outDir, { recursive: true });
  zip.writeZip(outZip);
  console.log("Created:", outZip);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
