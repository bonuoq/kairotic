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
// the app itself loads, every part of the page, without an error (e.g. a symbol used before it is defined)
const app = await browser.newPage();
const appErrors = [];
app.on("pageerror", (e) => appErrors.push(e.message));
await app.goto(url.replace(/tests\.html.*$/, ""));
await app.waitForFunction(() => {
  try { return /local|Error|work/.test(document.getElementById("status").textContent) &&
               scittle.core.eval_string("(in-ns 'user) (fn? feedback)") === true; }
  catch (_) { return /Error/.test((document.getElementById("status") || {}).textContent || ""); }
}, null, { timeout: 90000 }).catch(() => {});
const status = await app.evaluate(() => document.getElementById("status").textContent);
const loaded = await app.evaluate(() => { try { return scittle.core.eval_string("(in-ns 'user) (fn? feedback)") === true; } catch (_) { return false; } });
if (!loaded || /Error/.test(status)) r.failed.push({ suite: "app", label: "the app loads", detail: status + " " + appErrors.join("; ") });
r.total += 1;
await browser.close();
for (const f of r.failed) console.log("✗", f.suite ? f.suite + " · " : "", f.label, f.detail ? "— " + f.detail : "");
console.log(r.failed.length ? `${r.failed.length} of ${r.total} failed` : `all ${r.total} passed`);
process.exit(r.failed.length || !r.total ? 1 : 0);
