// SPDX-License-Identifier: MPL-2.0
// Runs the test pages of the studies (studies/*/tests/*.html: the ones that leave window.kairoticResults)
// in a headless Chromium: node tests/studies.mjs [base-url] [study…]
// With OSC_RELAY=ws://localhost:8765/osc the pages that need a relay's OSC bridge run too (see studies.yml).
// The repository must be served at base-url (http://localhost:8000/ by default).
import { chromium } from "playwright";
import { readdirSync, existsSync } from "node:fs";

const base = (process.argv[2] || "http://localhost:8000/").replace(/\/?$/, "/");
const only = process.argv.slice(3);
const pages = readdirSync("studies").filter((s) => !only.length || only.some((o) => s.includes(o))).sort()
  .flatMap((s) => existsSync(`studies/${s}/tests`)
    ? readdirSync(`studies/${s}/tests`).filter((f) => f.endsWith(".html")).map((f) => `studies/${s}/tests/${f}`)
    : []);

const browser = await chromium.launch();
let total = 0, failed = 0;
for (const path of pages) {
  const page = await browser.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(String(e.message || e)));
  // OSC_RELAY: a relay with the OSC bridge running, for the pages that need one (they skip without it)
  await page.goto(base + path + (process.env.OSC_RELAY ? "?relay=" + encodeURIComponent(process.env.OSC_RELAY) : ""));
  const r = await page.waitForFunction(() => window.kairoticResults, null, { timeout: 60000 })
    .then((h) => h.jsonValue()).catch(() => ({ total: 0, failed: ["no results within 60 s"] }));
  total += r.total; failed += r.failed.length;
  console.log(`${r.failed.length ? "✗" : "✓"} ${path}: ${r.skipped ? "skipped" : `${r.total - r.failed.length} / ${r.total}`}`);
  for (const f of r.failed) console.log(`    ✗ ${f}`);
  for (const e of errors) console.log(`    error: ${e}`);
  await page.close();
}
await browser.close();
console.log(`\n${total - failed} / ${total} pass`);
process.exit(failed || !total ? 1 : 0);
