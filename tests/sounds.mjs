// SPDX-License-Identifier: MPL-2.0
// Recording buffers: a sample box records what reaches it (rec … stop, or its length), keeps the sound in
// this browser and its description in the history; a reader~ plays it at the position of a phasor~; a
// sound file comes in decoded. In the app already loaded by tests/browser.mjs. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

export async function sounds(page, check) {
  const logs = [];
  // a 404 is the URL that must fail, below
  const onLog = (m) => { if ((m.type() === "error" || m.type() === "warning") && !/Failed to load resource/.test(m.text())) logs.push(m.text()); };
  const onErr = (e) => logs.push("pageerror: " + (e.stack || e.message));
  page.on("console", onLog); page.on("pageerror", onErr);
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the sound tests", false); return; }
  const osc = (await cljs(page, '(box "osc~ 220" 3600 100)')).trim();
  const s = (await cljs(page, '(box "sample 5" 3600 160)')).trim();
  const short = (await cljs(page, '(box "sample 0.3" 3900 160)')).trim();
  await cljs(page, `(connect ${osc} 0 ${s} 0) (connect ${osc} 0 ${short} 0)`);
  await cljs(page, "(play)");
  await until(page, '(= "running" (.-state (eng/ctx)))', (g) => g === "true", 5000);
  await page.waitForTimeout(300);
  const secs = (id) => `(snd/seconds (:data (get-in (current) [:boxes ${id}])))`;
  const events = "(depth-of (norm (:pos @world)))";

  // rec … stop
  const before = Number(await cljs(page, events));
  await cljs(page, `(send! ${s} :rec) (send! ${short} :rec)`);
  const shown = await until(page, `(boolean (:rec (second (last-shown ${s}))))`, (g) => g === "true", 3000);
  check("a sample shows that it records", shown === "true", shown);
  await page.waitForTimeout(700);
  await cljs(page, `(send! ${s} :stop)`);
  const took = await until(page, secs(s), (g) => Number(g) > 0);
  check("rec … stop keeps what was heard", Number(took) > 0.4 && Number(took) < 2, took);
  check("... as an event of the history", Number(await cljs(page, events)) > before, await cljs(page, events));
  check("... described with its peaks", (await cljs(page, `(count (:peaks (:data (get-in (current) [:boxes ${s}]))))`)) === "120");
  check("... and its sound is in this browser",
    (await until(page, `(get @snd/status (:audio (:data (get-in (current) [:boxes ${s}]))))`, (g) => g === ":here", 3000)) === ":here");
  const cut = await until(page, secs(short), (g) => Number(g) > 0);
  check("a sample stops by itself at its length", Math.abs(Number(cut) - 0.3) < 0.01, cut);
  check("the work's code writes it as (sample! …)",
    /\(sample! /.test(await cljs(page, "(patch->code (current))")), "");

  // punch-in: rec 0.3 keeps the first 0.3 s and records from there (here at half the level)
  const gp = (await cljs(page, '(box "gain~ 1" 3300 100)')).trim();
  const sp = (await cljs(page, '(box "sample 5" 3300 160)')).trim();
  const gl = (await cljs(page, '(box "snapshot~ 50 peak" 3300 220)')).trim();
  await cljs(page, `(connect ${osc} 0 ${gp} 0) (connect ${gp} 0 ${sp} 0) (connect ${gp} 0 ${gl} 0)`);
  await page.waitForTimeout(200);
  await cljs(page, `(send! ${sp} :rec)`); await page.waitForTimeout(600); await cljs(page, `(send! ${sp} :stop)`);
  await until(page, secs(sp), (g) => Number(g) > 0.4);
  await cljs(page, `(send! ${gp} 1 0.5)`); await page.waitForTimeout(200);
  const sent = await cljs(page, `(send! ${sp} [:rec 0.3])`); await page.waitForTimeout(150);
  const during = await cljs(page, `(let [n (eng/node ${sp})] [(some? n) (when n (pr-str (dissoc @(:rec n) :blocks :base))) (pr-str (last (get-in @eng/rt [:shows ${sp}])))])`);
  await page.waitForTimeout(250); await cljs(page, `(send! ${sp} :stop)`);
  const plen = await until(page, secs(sp), (g) => Math.abs(Number(g) - 0.7) < 0.1, 8000);
  check("rec t keeps the sound until t and records from there", Math.abs(Number(plen) - 0.7) < 0.1, plen);
  const levels = await cljs(page, `(let [p (:peaks (:data (get-in (current) [:boxes ${sp}]))) n (count p)
                                        top (fn [xs] (apply max (map second xs)))]
                                    [(/ (js/Math.round (* 1000 (top (take (quot n 3) p)))) 1000)
                                     (/ (js/Math.round (* 1000 (top (take-last (quot n 3) p)))) 1000)])`);
  check("... the first part at its level, the take after it at the new one", /^\[0\.1[45]\d? 0\.0[78]\d?\]$/.test(levels),
        levels + " sent: " + sent + " during: " + during + " repl: " + await page.evaluate(() => [...document.querySelectorAll("#repl-out div")].slice(-6).map((d) => d.textContent).join(" | ")) + " gain out: " + await cljs(page, `(get-in @eng/rt [:states ${gl}])`) + " " + await cljs(page, `(pr-str (:data (get-in (current) [:boxes ${sp}])))`).then((x) => x.slice(0, 300)));
  await cljs(page, `(delete ${gp} ${sp} ${gl})`);

  // a reader~ plays it
  const ph = (await cljs(page, '(box "phasor~ 2" 3600 260)')).trim();
  const rd = (await cljs(page, '(box "reader~" 3600 310)')).trim();
  const lv = (await cljs(page, '(box "snapshot~ 100 peak" 3600 360)')).trim();
  await cljs(page, `(connect ${ph} 0 ${rd} 0) (connect ${s} 1 ${rd} 1) (connect ${rd} 0 ${lv} 0)`);
  const played = await until(page, `(get-in @eng/rt [:states ${lv}])`, (g) => Math.abs(Number(g) - 0.15) < 0.01);
  check("reader~ plays the recorded sound (an osc~ at 0.15)", Math.abs(Number(played) - 0.15) < 0.01, played);

  // a sound file comes in
  await cljs(page, `(-> (snd/lib) (.then (fn [L] (decode-sound! ${short} (.wav L #js [(js/Float32Array. 4800)] 48000)))))`);
  const loaded = await until(page, secs(short), (g) => Math.abs(Number(g) - 0.1) < 0.002);
  check("a sound file is decoded into a sample", Math.abs(Number(loaded) - 0.1) < 0.002, loaded);
  const saved = await cljs(page, `(save-sound ${s})`);
  await page.waitForTimeout(500);
  check("save-sound names a WAV file", /kairotic-[0-9a-f]{8}\.wav/.test(saved), saved + " " + logs.join(" | "));

  // sounds from URLs: a description that is only a URL is fetched by itself; load-sound! with a URL writes
  // it whole; a string on the left loads it; a URL that does not answer says so
  const u1 = (await cljs(page, '(box "sample" 3600 460)')).trim();
  const u2 = (await cljs(page, '(box "sample" 3900 460)')).trim();
  const u3 = (await cljs(page, '(box "sample" 3600 560)')).trim();
  const u4 = (await cljs(page, '(box "sample" 3900 560)')).trim();
  const url = '"tests/assets/a440.wav"';
  await cljs(page, `(sample! ${u1} {:url ${url}})`);
  const st = (id) => `(get @snd/status (:audio (:data (get-in (current) [:boxes ${id}]))))`;
  const got = await until(page, st(u1), (g) => g === ":here", 10000);
  check("a sample that is only a URL fetches its sound", got === ":here", got + " " + await cljs(page, "(pr-str @snd/failures)"));
  const len = await until(page, secs(u1), (g) => Math.abs(Number(g) - 1) < 0.01);
  check("... and learns its length (one second)", Math.abs(Number(len) - 1) < 0.01, len);
  await cljs(page, `(connect ${ph} 0 ${rd} 0) (disconnect ${s} 1 ${rd} 1) (connect ${u1} 1 ${rd} 1)`);
  const lvl = await until(page, `(get-in @eng/rt [:states ${lv}])`, (g) => Math.abs(Number(g) - 0.5) < 0.02);
  check("reader~ plays a sound from a URL (a sine at 0.5)", Math.abs(Number(lvl) - 0.5) < 0.02, lvl);
  await cljs(page, `(load-sound! ${u2} ${url})`);
  const whole = await until(page, `(let [d (:data (get-in (current) [:boxes ${u2}]))] [(:url d) (count (:peaks d))])`,
                            (g) => g === `[${url} 120]`, 10000);
  check("load-sound! with a URL writes the URL with the picture", whole === `[${url} 120]`, whole);
  await cljs(page, `(send! ${u3} ${url})`);
  const bystr = await until(page, `(:url (:data (get-in (current) [:boxes ${u3}])))`, (g) => g === url, 10000);
  check("a URL on the left of a sample loads it", bystr === url, bystr);
  // what a msg box sends: its words as keywords, with or without quotes, or after url
  const m1 = (await cljs(page, '(box "msg \\"tests/assets/a440.wav\\"" 3600 640)')).trim();
  const m2 = (await cljs(page, '(box "msg url tests/assets/a440.wav" 3900 640)')).trim();
  const s1 = (await cljs(page, '(box "sample" 3600 690)')).trim();
  const s2 = (await cljs(page, '(box "sample" 3900 690)')).trim();
  await cljs(page, `(connect ${m1} 0 ${s1} 0) (connect ${m2} 0 ${s2} 0)`);
  await cljs(page, `(send! ${m1} :bang) (send! ${m2} :bang)`);
  const viaMsg = await until(page, `[(:url (:data (get-in (current) [:boxes ${s1}]))) (:url (:data (get-in (current) [:boxes ${s2}])))]`,
                             (g) => g === `[${url} ${url}]`, 10000);
  check('msg "url" and msg url … load a sample', viaMsg === `[${url} ${url}]`, viaMsg);
  await cljs(page, `(delete ${m1} ${m2} ${s1} ${s2})`);
  // a sound kept in an earlier session (in IndexedDB, not in memory) is described again when loaded
  await cljs(page, "(reset! snd/cache {}) (reset! snd/local {}) (reset! snd/status {}) (reset! snd/fetching {})");
  const again = (await cljs(page, '(box "sample" 4200 690)')).trim();
  await cljs(page, `(load-sound! ${again} ${url})`);
  // decoded at the rate of the engine: one second is as many frames as its rate
  const desc = await until(page, `(let [d (:data (get-in (current) [:boxes ${again}]))] [(= (:sr d) (:frames d)) (count (:peaks d))])`,
                           (g) => g === "[true 120]", 10000);
  check("a sound loaded in an earlier session keeps its length and picture", desc === "[true 120]",
        desc + " " + await cljs(page, `(pr-str (:data (get-in (current) [:boxes ${again}])))`));
  await cljs(page, `(delete ${again})`);
  await cljs(page, `(sample! ${u4} {:url "tests/assets/nothing-here.wav"})`);
  const failed = await until(page, st(u4), (g) => g === ":failed", 10000);
  check("a URL that does not answer says so", failed === ":failed", failed);

  // sources: github: through jsDelivr (this repository, at the commit that added the test sound), and
  // freesound: without a key, which says so
  const g1 = (await cljs(page, '(box "sample" 4200 460)')).trim();
  const g2 = (await cljs(page, '(box "sample" 4200 560)')).trim();
  await cljs(page, `(freesound-key! nil)`);
  await cljs(page, `(sample! ${g1} {:url "github:bonuoq/kairotic@fbcfa5fcb2208973eea6a71f49d8ac14bc308a9e/tests/assets/a440.wav"})`);
  const glen = await until(page, secs(g1), (g) => Math.abs(Number(g) - 1) < 0.01, 20000);
  check("github: loads a sound of a repository through jsDelivr", Math.abs(Number(glen) - 1) < 0.01, glen + " " + await cljs(page, st(g1)));
  // without @ref jsDelivr serves the latest semver tag (v0.1.0-alpha here, which has no tests/assets/): main first
  const g3 = (await cljs(page, '(box "sample" 4500 460)')).trim();
  const g4 = (await cljs(page, '(box "sample" 4500 560)')).trim();
  await cljs(page, `(sample! ${g3} {:url "github:bonuoq/kairotic/tests/assets/a440.wav"})`);
  const g3len = await until(page, secs(g3), (g) => Math.abs(Number(g) - 1) < 0.01, 40000);
  check("github: without @ref looks at main", Math.abs(Number(g3len) - 1) < 0.01, g3len + " " + await cljs(page, st(g3)));
  await cljs(page, `(sample! ${g4} {:url "github:bonuoq/kairotic@main/tests/assets/nothing-here.wav"})`);
  await until(page, st(g4), (g) => g === ":failed", 40000);
  const g4why = await cljs(page, `(get @snd/failures (:audio (:data (get-in (current) [:boxes ${g4}]))))`);
  check("a github: file that is not there says where it looked", /not in @main of bonuoq\/kairotic/.test(g4why) && !/CORS/.test(g4why), g4why);
  await cljs(page, `(delete ${g3} ${g4})`);
  await cljs(page, `(sample! ${g2} {:url "freesound:12345"})`);
  const nokey = await until(page, st(g2), (g) => g === ":failed", 5000);
  const why = await cljs(page, `(get @snd/failures (:audio (:data (get-in (current) [:boxes ${g2}]))))`);
  check("freesound: without an API key says it needs one", nokey === ":failed" && /API key/.test(why), nokey + " " + why);

  await cljs(page, `(send! ${short} :clear)`);
  const cleared = await until(page, secs(short), (g) => g === "0");
  check("clear empties it", cleared === "0", cleared);

  await cljs(page, "(stop)");
  await cljs(page, `(delete ${osc} ${s} ${short} ${ph} ${rd} ${lv} ${u1} ${u2} ${u3} ${u4} ${g1} ${g2})`);
  page.off("console", onLog); page.off("pageerror", onErr);
  check("no errors in the console during the sound tests", logs.length === 0, logs.join(" | ").slice(0, 800));
}
