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
  check("save-sound names a WAV file", /kairotic-[0-9a-f]{8}\.wav/.test(await cljs(page, `(save-sound ${s})`)));

  await cljs(page, `(send! ${short} :clear)`);
  const cleared = await until(page, secs(short), (g) => g === "0");
  check("clear empties it", cleared === "0", cleared);

  await cljs(page, "(stop)");
  await cljs(page, `(delete ${osc} ${s} ${short} ${ph} ${rd} ${lv})`);
}
