// SPDX-License-Identifier: MPL-2.0
// Runs tests/run.html (built as _site/tests.html) in a headless Chromium: node tests/browser.mjs [url]
import { chromium } from "playwright";
import { gestures, cljs } from "./gestures.mjs";
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
import { relays } from "./relays.mjs";
import { layers } from "./layers.mjs";
import { theory } from "./theory.mjs";
import { claude } from "./claude.mjs";
import { help } from "./help.mjs";

const url = process.argv[2] || "http://localhost:8000/tests.html";
const base = url.replace(/tests\.html.*$/, "");
// sound without a click, and a fake microphone (a beep) that is allowed without asking: for adc~
const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required",
                                               "--use-fake-ui-for-media-stream", "--use-fake-device-for-media-stream"] });
const r = { total: 0, failed: [] };
const checker = (suite) => (label, ok, detail) => { r.total += 1; if (!ok) r.failed.push({ suite, label, detail: detail || "" }); };
const message = (e) => String(e && e.message || e);
// how long each part takes, printed at the end (and in the run's summary on GitHub Actions)
const timings = [];
const timed = async (name, fn) => {
  const t0 = Date.now();
  try { return await fn(); } finally { timings.push({ name, ms: Date.now() - t0 }); }
};

// The blocks below run at the same time: each has a browser context of its own (browser.newPage makes
// one, browser.newContext too), so they share no page, localStorage or IndexedDB. Inside each app block
// the suites run one after another, in their order, on the same page.

// 1. tests/run.html: the ClojureScript tests, in the page
async function unit() {
  const check = checker("tests.html");
  try {
    const page = await browser.newPage();
    page.on("pageerror", (e) => console.error("page error:", e.message));
    await page.goto(url);
    await page.waitForFunction(() => window.kairoticTests, null, { timeout: 90000 });
    const t = await page.evaluate(() => window.kairoticTests);
    r.total += t.total;
    r.failed.push(...t.failed);
  } catch (e) { check("tests.html ran", false, message(e)); }
}

// 2. the app itself loads, every part of the page, without an error (e.g. a symbol used before it is
// defined); then the gestures and the rest, one suite after another, in the app just loaded
const appSuites = [
  ["gestures", gestures, "the gestures ran"],
  ["perform", perform, "the Perform tests ran"],
  ["editor", editor, "the editor tests ran"],
  ["jam", jam, "the jam tests ran"],
  ["corefns", corefns, "the function box tests ran"],
  ["feedback", feedback, "the feedback tests ran"],
  ["canvasmsg", canvasmsg, "the canvas message tests ran"],
  ["views", views, "the view tests ran"],
  ["recipe", recipe, "the recipe tests ran"],
  ["numinput", numinput, "the number input tests ran"],
  ["presets", presets, "the presets tests ran"],
  ["present", present, "the present tests ran"],
  ["layout", layout, "the layout tests ran"],
  ["relays", relays, "the relay tests ran"],
  ["layers", layers, "the layer tests ran"],
  ["theory", theory, "the theory tests ran"],
  ["claude", claude, "the Claude tab tests ran"],
  // opens other works, then a local one again
  ["release", release, "the release tests ran"],
  // opens a lesson (another local work): last
  ["presetsTutorial", presetsTutorial, "the presets tutorial tests ran"],
  // help patches with several steps (lessons too)
  ["help", help, "the help patch tests ran"],
];
// 3. the suites that play sound, about half the time of the app's suites, in a second app of their
// own: each only needs a local work open (opened here as gestures opens it in the first app), makes its boxes in a place of the patch of its own, and
// deletes them at the end
const audioSuites = [
  ["audioin", audioin, "the audio input tests ran"],
  ["sounds", sounds, "the sound tests ran"],
  ["record", record, "the record tests ran"],
  // last: its transcriptions depend on timing, and by then the other blocks have (nearly) finished
  // (alongside them, a take could start late and an overwrite check fail)
  ["analysis", analysis, "the analysis tests ran"],
];

// loads the app in a page of its own and runs suites in it; before(app, check) first and after(app,
// check) at the end, if given
async function inApp(name, suites, suite, { before, after } = {}) {
  const app = await browser.newPage();
  const appErrors = [];
  app.on("pageerror", (e) => appErrors.push(e.message));
  const loaded = await timed(name + " · load", async () => {
    // without a relay (?peer=off): the tests do not write to the site's relay, and do not depend on it
    await app.goto(base + "?peer=off");
    await app.waitForFunction(() => {
      try { return /local|Error|work/.test(document.getElementById("status").textContent) &&
                   scittle.core.eval_string("(in-ns 'user) (fn? feedback)") === true; }
      catch (_) { return /Error/.test((document.getElementById("status") || {}).textContent || ""); }
    }, null, { timeout: 90000 }).catch(() => {});
    const status = await app.evaluate(() => document.getElementById("status").textContent);
    const loaded = await app.evaluate(() => { try { return scittle.core.eval_string("(in-ns 'user) (fn? feedback)") === true; } catch (_) { return false; } });
    if (!loaded || /Error/.test(status)) r.failed.push({ suite: name, label: "the app loads", detail: status + " " + appErrors.join("; ") });
    r.total += 1;
    return loaded;
  });
  if (!loaded) return;
  const check = checker(suite);
  if (before) await before(app, check);
  for (const [n, fn, ran] of suites)
    await timed(name + " · " + n, async () => {
      try { await fn(app, check); } catch (e) { check(ran, false, message(e)); }
    });
  if (after) await after(app, check);
  if (appErrors.length) check("no page errors during the " + suite, false, appErrors.join("; "));
}

const app = () => inApp("app", appSuites, "gestures", { after: async (app, check) => {
  // GUN keeps its copy of the graph in IndexedDB (RAD), not in localStorage, where 5 MB filled up
  // ("localStorage max!") and every save failed
  const store = await app.evaluate(() => ({ rad: !!window.RindexedDB, peers: (window.kairoticPeers || []).length,
                                            ls: (localStorage.getItem("gun/") || "").length }));
  check("GUN keeps its copy in IndexedDB, not in localStorage", store.rad && store.ls === 0, JSON.stringify(store));
  check("... and the tests ran without a relay", store.peers === 0, JSON.stringify(store));
} });
// a local work, as tests/gestures.mjs opens it in the first app
const audio = () => inApp("audio", audioSuites, "audio", { before: async (app, check) => {
  await cljs(app, "(open-work! :local \"local\" \"Local\")");
  await app.waitForFunction(() => document.getElementById("manager").hidden, null, { timeout: 10000 }).catch(() => {});
  const mode = await cljs(app, "(:mode @hist)");
  check("a local work opens for the audio tests", mode === ":local", mode);
} });

// 4. a Release/Perform embed (issue #50), in a page of its own
async function embedded() {
  const check = checker("embed");
  try { await embed(browser, base, check); } catch (e) { check("the embed tests ran", false, message(e)); }
}

// 5. what an earlier version kept in localStorage ("gun/") reaches IndexedDB, in a browser context of its own
async function storage() {
  const check = checker("storage");
  try {
    const ctx = await browser.newContext();
    const page = await ctx.newPage();
    await page.goto(base + "?peer=off");
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
  } catch (e) { check("the storage tests ran", false, message(e)); }
}

// KAIROTIC_TESTS_SERIAL=1 runs the blocks one after another, as before: to compare the times, or to
// rule out that a failure comes from running them together
const blocks = [["tests.html", unit], ["app", app], ["audio", audio], ["embed", embedded], ["storage", storage]];
const t0 = Date.now();
if (process.env.KAIROTIC_TESTS_SERIAL) for (const [name, fn] of blocks) await timed(name, fn);
else await Promise.all(blocks.map(([name, fn]) => timed(name, fn)));
const wall = Date.now() - t0;
await browser.close();
const secs = (ms) => (ms / 1000).toFixed(1) + " s";
console.log("time:", timings.map((t) => `${t.name} ${secs(t.ms)}`).join(" · "), process.env.KAIROTIC_TESTS_SERIAL ? "· all, one after another:" : "· all, at the same time:", secs(wall));
// on GitHub Actions, also a notice on the run's page, readable without opening the log
if (process.env.GITHUB_ACTIONS)
  console.log("::notice title=Browser tests: time::" + timings.map((t) => `${t.name} ${secs(t.ms)}`).join(" · ") + " · all " + secs(wall));
if (process.env.GITHUB_STEP_SUMMARY) {
  const { appendFileSync } = await import("node:fs");
  appendFileSync(process.env.GITHUB_STEP_SUMMARY, "### Browser tests: time\n\n| part | time |\n|---|---:|\n" +
    timings.map((t) => `| ${t.name} | ${secs(t.ms)} |`).join("\n") + `\n| **all${process.env.KAIROTIC_TESTS_SERIAL ? ", one after another" : ", at the same time"}** | **${secs(wall)}** |\n`);
}
for (const f of r.failed) console.log("✗", f.suite ? f.suite + " · " : "", f.label, f.detail ? "— " + f.detail : "");
// on GitHub Actions, each failure is also an annotation of the run (readable without the log)
if (process.env.GITHUB_ACTIONS)
  for (const f of r.failed) console.log(`::error title=${(f.suite || "test").replace(/[:,\n]/g, " ")}::${(f.label + (f.detail ? " — " + f.detail : "")).replace(/\n/g, " ").slice(0, 900)}`);
console.log(r.failed.length ? `${r.failed.length} of ${r.total} failed` : `all ${r.total} passed`);
process.exit(r.failed.length || !r.total ? 1 : 0);
