// SPDX-License-Identifier: MPL-2.0
// Where the patch of discussion #22 spends the main thread (a profiling run, not a test):
//   node tests/profile/d22.mjs http://localhost:8000/ out.json
// It opens the patch in a local work, waits for its five faust~ to compile, plays it, then measures
// single operations (median ms) and three phases (idle, a knob dragged at 60 Hz, knob releases).
import { chromium } from "playwright";
import { readFileSync, writeFileSync } from "node:fs";

const url = process.argv[2] || "http://localhost:8000/";
const out = process.argv[3] || "profile-d22.json";
const code = readFileSync(new URL("./d22.cljs", import.meta.url), "utf8");

const browser = await chromium.launch({ args: ["--autoplay-policy=no-user-gesture-required"] });
const page = await browser.newPage({ viewport: { width: 1400, height: 1000 } });
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push(m.text().slice(0, 300)); });
await page.goto(url);
await page.waitForFunction(() => { try { return scittle.core.eval_string("(in-ns 'user) (fn? feedback)") === true; } catch (_) { return false; } }, null, { timeout: 120000 });

const cljs = (src) => page.evaluate((s) => {
  try { return String(scittle.core.eval_string("(in-ns 'user) (pr-str (do " + s + "))")); }
  catch (e) { return "ERR " + (e.message || e); }
}, src);
const R = { errors };

// long tasks and frames, from the start
await page.evaluate(() => {
  window.__lt = [];
  new PerformanceObserver((l) => { for (const e of l.getEntries()) window.__lt.push([e.startTime, e.duration]); }).observe({ type: "longtask", buffered: true });
  window.__frames = [];
  const f = (t) => { window.__frames.push(t); requestAnimationFrame(f); };
  requestAnimationFrame(f);
});
const phase = async (name, ms, during) => {
  const t0 = await page.evaluate(() => performance.now());
  if (during) await during(); else await page.waitForTimeout(ms);
  const r = await page.evaluate((t0) => {
    const t1 = performance.now();
    const lt = window.__lt.filter(([s]) => s >= t0 && s <= t1);
    const fr = window.__frames.filter((t) => t >= t0 && t <= t1);
    let worst = 0; for (let i = 1; i < fr.length; i++) worst = Math.max(worst, fr[i] - fr[i - 1]);
    return { ms: Math.round(t1 - t0), longTasks: lt.length, longTaskMs: Math.round(lt.reduce((a, [, d]) => a + d, 0)),
             worstLongTask: Math.round(Math.max(0, ...lt.map(([, d]) => d))), fps: +(fr.length / ((t1 - t0) / 1000)).toFixed(1),
             worstFrameGap: Math.round(worst) };
  }, t0);
  R[name] = r;
};

// 1 · load the patch and wait for the compilations
await cljs('(open-work! :local "local" "Local")');
await page.waitForTimeout(500);
const tLoad0 = Date.now();
R.load = await cljs(`(run-code! ${JSON.stringify(code)})`);
let compiled = "";
for (let i = 0; i < 240; i++) {
  compiled = await cljs("(mapv (fn [b] (:status (compilation b))) [:b3 :b9 :b10 :b11 :b12])");
  if (!/compiling|nil/.test(compiled)) break;
  await page.waitForTimeout(500);
}
R.compileSeconds = (Date.now() - tLoad0) / 1000;
R.compiled = compiled;
R.boxes = await cljs("(count (:boxes (current)))");

// counters: how often the reader~ tables are computed, how often the engine syncs
await cljs(`(do (defonce prof (atom {:tables 0 :table-ms 0 :syncs 0 :sync-ms 0}))
  (alter-var-root (var kairotic.signal/table)
    (fn [f] (fn [& a] (let [t (js/performance.now) r (apply f a)]
                        (swap! prof (fn [p] (-> p (update :tables inc) (update :table-ms + (- (js/performance.now) t))))) r))))
  (when-let [v (resolve 'kairotic.signal/compute-table)]
    (alter-var-root v
      (fn [f] (fn [& a] (let [t (js/performance.now) r (apply f a)]
                          (swap! prof (fn [p] (-> p (update :computed (fnil inc 0)) (update :compute-ms (fnil + 0) (- (js/performance.now) t))))) r)))))
  (alter-var-root (var kairotic.engine/sync!)
    (fn [f] (fn [& a] (let [t (js/performance.now) r (apply f a)]
                        (swap! prof (fn [p] (-> p (update :syncs inc) (update :sync-ms + (- (js/performance.now) t))))) r))))
  :ok)`);
const counters = async () => cljs("(let [p @prof] (reset! prof {:tables 0 :table-ms 0 :syncs 0 :sync-ms 0}) (-> p (update :table-ms js/Math.round) (update :sync-ms js/Math.round) (update :compute-ms #(when % (js/Math.round %)))))");

await cljs("(play)");
await page.waitForTimeout(3000);
R.audio = await page.evaluate(() => { try { const ac = scittle.core.eval_string("(in-ns 'user) (kairotic.engine/ctx)"); return { state: ac.state, rate: ac.sampleRate, baseLatency: ac.baseLatency }; } catch (e) { return String(e); } });
R.countersAtStart = await counters();

// 2 · single operations, median of n runs (ms)
const median = async (label, src, n = 9) => {
  const ms = await page.evaluate(([s, n]) => {
    const f = () => scittle.core.eval_string("(in-ns 'user) " + s);
    const ts = [];
    for (let i = 0; i < n; i++) { const t = performance.now(); try { f(); } catch (e) { return "ERR " + e.message; } ts.push(performance.now() - t); }
    ts.sort((a, b) => a - b);
    return +ts[Math.floor(n / 2)].toFixed(2);
  }, [src, n]);
  (R.ops ||= {})[label] = ms;
};
await median("signature (every 25 ms tick)", "(kairotic.engine/signature (work-patch))");
await median("sync! with nothing changed (every tick)", "(kairotic.engine/sync!)");
await median("feed! with nothing changed (every tick)", "(kairotic.engine/feed!)");
await median("one tick of the engine", "(kairotic.engine/tick!)");
await median("reader~ table of the canvas (one reader)", "(kairotic.signal/table (get-in (work-patch) [:boxes :b4 :data]) :x 3 nil)", 3);
await median("reader~ table computed (no cache)", "((or (resolve 'kairotic.signal/compute-table) kairotic.signal/table) (get-in (work-patch) [:boxes :b4 :data]) :x 3 nil)", 3);
R.sameReadingsAsBefore = await cljs(`(let [d (get-in (work-patch) [:boxes :b4 :data]) span (kairotic.canvas/x-range d) n 1024
  old (vec (for [i (range n)] (kairotic.canvas/read-along d :x (kairotic.canvas/at-unit span (/ i (dec n))))))]
  (if-let [f (resolve 'kairotic.signal/readings)] (= old (f d :x span n)) :no-new-readings))`);
await median("render-overlay! (every frame while playing)", "(render-overlay!)");
await median("render-scene (the whole patch SVG)", "(render-scene (current))", 5);
await median("render-code (Code tab)", "(render-code (current))", 5);
await median("patch->code", "(patch->code (current))", 5);
await median("work-patch from an empty cache", "(do (reset! cache {}) (work-patch))", 5);
await median("send-flat-quiet! to the knob (one drag step)", "(send-flat-quiet! :b1 0.5)");
await median("render-all! (after every history change)", "(render-all!)", 3);
R.countersAfterOps = await counters();

// 3 · phases
await phase("idlePlaying5s", 5000);
R.countersIdle = await counters();
await phase("knobDrag3s", 0, async () => {
  await page.evaluate(() => new Promise((res) => {
    let i = 0;
    const h = setInterval(() => {
      const v = 0.1 + 0.9 * Math.abs(Math.sin(i / 20));
      try { scittle.core.eval_string("(in-ns 'user) (send-flat-quiet! :b1 " + v.toFixed(3) + ")"); } catch (_) {}
      if (++i >= 180) { clearInterval(h); res(); }
    }, 16);
  }));
});
R.countersDrag = await counters();
await phase("fiveKnobReleases", 0, async () => {
  for (let i = 0; i < 5; i++) {
    await cljs(`(text! :b1 "knob 0.02 2 ${(0.2 + i * 0.1).toFixed(2)} log rate")`);
    await page.waitForTimeout(700);
  }
});
R.countersReleases = await counters();
R.timeOfOneRelease = await page.evaluate(() => {
  const t = performance.now();
  scittle.core.eval_string('(in-ns \'user) (text! :b1 "knob 0.02 2 0.33 log rate")');
  return +(performance.now() - t).toFixed(1);
});
await page.waitForTimeout(300);
R.countersAfterOneRelease = await counters();
R.oneFeedAfterRelease = await page.evaluate(() => {
  scittle.core.eval_string('(in-ns \'user) (text! :b1 "knob 0.02 2 0.34 log rate")');
  const t = performance.now();
  scittle.core.eval_string("(in-ns 'user) (kairotic.engine/feed!)");
  return +(performance.now() - t).toFixed(1);
});

await browser.close();
writeFileSync(out, JSON.stringify(R, null, 2));
console.log(JSON.stringify(R, null, 2));
