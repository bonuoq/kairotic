// SPDX-License-Identifier: MPL-2.0
// Writes docs/reference.md from the help of the built app: node tests/reference.mjs [url]
// (the app evaluates (reference-md); see .github/workflows/reference.yml)
import { chromium } from "playwright";
import { writeFileSync } from "node:fs";

const url = process.argv[2] || "http://localhost:8000/?embed";
const browser = await chromium.launch();
const page = await browser.newPage();
await page.goto(url);
await page.waitForFunction(() => {
  try { return typeof scittle !== "undefined" && scittle.core.eval_string("(in-ns 'user) (fn? reference-md)") === true; }
  catch (_) { return false; }
}, null, { timeout: 90000 });
const md = await page.evaluate(() => String(scittle.core.eval_string("(in-ns 'user) (reference-md)")));
await browser.close();
writeFileSync("docs/reference.md", md);
console.log("docs/reference.md:", md.length, "characters");
