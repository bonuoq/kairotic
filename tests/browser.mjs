// SPDX-License-Identifier: MPL-2.0
// Runs tests/run.html (built as _site/tests.html) in a headless Chromium: node tests/browser.mjs [url]
import { chromium } from "playwright";
import { gestures } from "./gestures.mjs";
import { perform } from "./perform.mjs";
import { editor } from "./editor.mjs";
import { jam } from "./jam.mjs";
import { corefns } from "./corefns.mjs";
import { feedback } from "./feedback.mjs";
import { canvasmsg } from "./canvasmsg.mjs";
import { views } from "./views.mjs";
import { recipe } from "./recipe.mjs";
import { numinput } from "./numinput.mjs";
import { presets } from "./presets.mjs";
import { present, presetsTutorial } from "./present.mjs";
import { audioin } from "./audioin.mjs";
import { sounds } from "./sounds.mjs";
import { analysis } from "./analysis.mjs";
import { record } from "./record.mjs";
import { layout } from "./layout.mjs";
import { release } from "./release.mjs";
import { embed } from "./embed.mjs";

const url = process.argv[2] || "http://localhost:8000/tests.html";
// sound without a click, and a fake microphone (a beep) that is allowed without asking: for adc~
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required",
                                               "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("page error:", e.message));
await page.goto(url);
await page.waitForFunction(() => window.kairoticTests, null, { timeout: 90000 });
const r = await page.evaluate(() => window.kairoticTests);
// the app itself loads, every part of the page, without an error (e.g. a symbol used before it is defined)
const app = await browser.newPage();
const appErrors = [];
app.on("pageerror", (e) => appErrors.push(e.message));
// without a relay (?peer=off): the tests do not write to the site's relay, and do not depend on it
await app.goto(url.replace(/tests\.html.*$/, "") + "?peer=off");
await app.waitForFunction(() => {
  try { return /local|Error|work/.test(document.getElementById("status").textContent) &&
               scittle.core.eval_string("(in-ns 'user) (fn? feedback)") === true; }
  catch (_) { return /Error/.test((document.getElementById("status") || {}).textContent || ""); }
}, null, { timeout: 90000 }).catch(() => {});
const status = await app.evaluate(() => document.getElementById("status").textContent);
const loaded = await app.evaluate(() => { try { return scittle.core.eval_string("(in-ns 'user) (fn? feedback)") === true; } catch (_) { return false; } });
if (!loaded || /Error/.test(status)) r.failed.push({ suite: "app", label: "the app loads", detail: status + " " + appErrors.join("; ") });
r.total += 1;
// gestures on the patch (tests/gestures.mjs), in the app just loaded
if (loaded) {
  const check = (label, ok, detail) => { r.total += 1; if (!ok) r.failed.push({ suite: "gestures", label, detail: detail || "" }); };
  try { await gestures(app, check); } catch (e) { check("the gestures ran", false, String(e && e.message || e)); }
  try { await perform(app, check); } catch (e) { check("the Perform tests ran", false, String(e && e.message || e)); }
  try { await editor(app, check); } catch (e) { check("the editor tests ran", false, String(e && e.message || e)); }
  try { await jam(app, check); } catch (e) { check("the jam tests ran", false, String(e && e.message || e)); }
  try { await corefns(app, check); } catch (e) { check("the function box tests ran", false, String(e && e.message || e)); }
  try { await feedback(app, check); } catch (e) { check("the feedback tests ran", false, String(e && e.message || e)); }
  try { await canvasmsg(app, check); } catch (e) { check("the canvas message tests ran", false, String(e && e.message || e)); }
  try { await views(app, check); } catch (e) { check("the view tests ran", false, String(e && e.message || e)); }
  try { await recipe(app, check); } catch (e) { check("the recipe tests ran", false, String(e && e.message || e)); }
  try { await numinput(app, check); } catch (e) { check("the number input tests ran", false, String(e && e.message || e)); }
  try { await presets(app, check); } catch (e) { check("the presets tests ran", false, String(e && e.message || e)); }
  try { await present(app, check); } catch (e) { check("the present tests ran", false, String(e && e.message || e)); }
  try { await audioin(app, check); } catch (e) { check("the audio input tests ran", false, String(e && e.message || e)); }
  try { await sounds(app, check); } catch (e) { check("the sound tests ran", false, String(e && e.message || e)); }
  try { await analysis(app, check); } catch (e) { check("the analysis tests ran", false, String(e && e.message || e)); }
  try { await record(app, check); } catch (e) { check("the record tests ran", false, String(e && e.message || e)); }
  try { await layout(app, check); } catch (e) { check("the layout tests ran", false, String(e && e.message || e)); }
  // opens other works, then a local one again
  try { await release(app, check); } catch (e) { check("the release tests ran", false, String(e && e.message || e)); }
  // opens a lesson (another local work): last
  try { await presetsTutorial(app, check); } catch (e) { check("the presets tutorial tests ran", false, String(e && e.message || e)); }
  // GUN keeps its copy of the graph in IndexedDB (RAD), not in localStorage, where 5 MB filled up
  // ("localStorage max!") and every save failed
  const store = await app.evaluate(() => ({ rad: !!window.RindexedDB, peers: (window.kairoticPeers || []).length,
                                            ls: (localStorage.getItem("gun/") || "").length }));
  check("GUN keeps its copy in IndexedDB, not in localStorage", store.rad && store.ls === 0, JSON.stringify(store));
  check("... and the tests ran without a relay", store.peers === 0, JSON.stringify(store));
  if (appErrors.length) check("no page errors during the gestures", false, appErrors.join("; "));
}
// a Release/Perform embed (issue #50), in a page of its own
{
  const check = (label, ok, detail) => { r.total += 1; if (!ok) r.failed.push({ suite: "embed", label, detail: detail || "" }); };
  try { await embed(browser, url.replace(/tests\.html.*$/, ""), check); } catch (e) { check("the embed tests ran", false, String(e && e.message || e)); }
}
// what an earlier version kept in localStorage ("gun/") reaches IndexedDB, in a browser of its own
{
  const check = (label, ok, detail) => { r.total += 1; if (!ok) r.failed.push({ suite: "storage", label, detail: detail || "" }); };
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    const base = url.replace(/tests\.html.*$/, "") + "?peer=off";
    await page.goto(base);
    const soul = "kairotic-v1/data/migtest/doc1";
    await page.evaluate((soul) => {
      // the graph as GUN's localStorage adapter kept it: every node with its states, linked from the root
      const link = (s, k, to) => ({ _: { "#": s, ">": { [k]: 1 } }, [k]: { "#": to } });
      const graph = {
        "kairotic-v1": link("kairotic-v1", "data", "kairotic-v1/data"),
        "kairotic-v1/data": link("kairotic-v1/data", "migtest", "kairotic-v1/data/migtest"),
        "kairotic-v1/data/migtest": link("kairotic-v1/data/migtest", "doc1", soul),
        [soul]: { _: { "#": soul, ">": { json: 1, del: 1, t: 1 } }, json: JSON.stringify({ hello: "localStorage" }), del: false, t: 1 },
        "another-app": { _: { "#": "another-app", ">": { x: 1 } }, x: 1 },
      };
      localStorage.setItem("gun/", JSON.stringify(graph));
      localStorage.removeItem("kairotic.gun-migrated");
    }, soul);
    await page.reload();
    await page.waitForFunction(() => window.kairoticBackend && window.kairoticBackend.db, null, { timeout: 60000 });
    const got = await page.evaluate(async () => {
      const s = await window.kairoticBackend.db.doc("data/migtest/doc1").get();
      return s.exists ? s.data() : null;
    });
    check("data kept in localStorage by an earlier version is read after moving to IndexedDB", got && got.hello === "localStorage", JSON.stringify(got));
    // a minute later, our nodes leave localStorage and the other app's stay
    await page.evaluate(() => localStorage.setItem("kairotic.gun-migrated", String(Date.now() - 120000)));
    await page.waitForTimeout(1500);   // RAD writes in batches
    await page.reload();
    await page.waitForFunction(() => window.kairoticBackend && window.kairoticBackend.db, null, { timeout: 60000 });
    const left = await page.evaluate(() => Object.keys(JSON.parse(localStorage.getItem("gun/") || "{}")));
    check("... then it leaves localStorage, and what other apps keep there stays", JSON.stringify(left) === '["another-app"]', JSON.stringify(left));
    const again = await page.evaluate(async () => {
      const s = await window.kairoticBackend.db.doc("data/migtest/doc1").get();
      return s.exists ? s.data() : null;
    });
    check("... and it is still there, from IndexedDB", again && again.hello === "localStorage", JSON.stringify(again));
    await ctx.close();
  } catch (e) { check("the storage tests ran", false, String(e && e.message || e)); }
}
await browser.close();
for (const f of r.failed) console.log("✗", f.suite ? f.suite + " · " : "", f.label, f.detail ? "— " + f.detail : "");
// on GitHub Actions, each failure is also an annotation of the run (readable without the log)
if (process.env.GITHUB_ACTIONS)
  for (const f of r.failed) console.log(`::error title=${(f.suite || "test").replace(/[:,\n]/g, " ")}::${(f.label + (f.detail ? " — " + f.detail : "")).replace(/\n/g, " ").slice(0, 900)}`);
console.log(r.failed.length ? `${r.failed.length} of ${r.total} failed` : `all ${r.total} passed`);
process.exit(r.failed.length || !r.total ? 1 : 0);
