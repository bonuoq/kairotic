// SPDX-License-Identifier: MPL-2.0
// Runs tests/run.html (built as _site/tests.html) in a headless Chromium: node tests/browser.mjs [url]
import { chromium } from "playwright";

const url = process.argv[2] || "http://localhost:8000/tests.html";
const browser = await chromium.launch();
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(url);
await page.waitForFunction(() => window.kairoticTests, null, { timeout: 90000 });
const r = await page.evaluate(() => window.kairoticTests);
await browser.close();
for (const f of r.failed) console.log("✗", f.suite ? f.suite + " · " : "", f.label, f.detail ? "— " + f.detail : "");
console.log(r.failed.length ? `${r.failed.length} of ${r.total} failed` : `all ${r.total} passed`);
process.exit(r.failed.length || !r.total ? 1 : 0);
