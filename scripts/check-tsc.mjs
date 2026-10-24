#!/usr/bin/env node
/**
 * Quality Ratchet for TypeScript Error Budget
 * Enforces that tsc error count does not exceed the legacy baseline (46 errors).
 */
import { execSync } from "node:child_process";

const MAX_ERRORS = Number.parseInt(process.env.TSC_MAX_ERRORS ?? "45", 10);

console.log(`Running TypeScript compiler check (threshold: <= ${MAX_ERRORS} errors)...`);

let stdout = "";
try {
  stdout = execSync("npx tsc --noEmit", {
    encoding: "utf8",
    stdio: ["pipe", "pipe", "pipe"],
    maxBuffer: 10 * 1024 * 1024,
  });
  console.log("✅ TypeScript check passed: 0 errors found!");
  process.exit(0);
} catch (error) {
  stdout = (error.stdout || "") + "\n" + (error.stderr || "");
}

const errorMatches = stdout.match(/: error TS\d+:/g) || [];
const count = errorMatches.length;

if (count > MAX_ERRORS) {
  console.error(stdout);
  console.error(`\n❌ TypeScript check FAILED!`);
  console.error(`Found ${count} TypeScript errors, exceeding maximum allowed threshold of ${MAX_ERRORS}.`);
  console.error(`Please fix newly introduced type errors before merging.`);
  process.exit(1);
} else {
  console.log(`⚠️ TypeScript check PASSED under ratchet budget: ${count}/${MAX_ERRORS} legacy errors.`);
  if (count < MAX_ERRORS) {
    console.log(`🎉 Errors decreased from ${MAX_ERRORS} to ${count}! Please consider lowering MAX_ERRORS in scripts/check-tsc.mjs.`);
  }
  process.exit(0);
}
