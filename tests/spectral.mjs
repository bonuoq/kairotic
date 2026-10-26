// SPDX-License-Identifier: MPL-2.0
// shift~ (@kairotic/spectral 0.1.0): pitch shifting in real time. Writing it brings the package; its
// messages (factors as ratios, semitones and cents, a transposition, the formants, the dry mix) set what
// it keeps; it loads its WebAssembly and sounds; pitch~ hears an osc~ 220 through shift~ 3/2 at 330 Hz,
// and through [:transpose 12] at 660 Hz.
// In the audio app of tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

export async function spectral(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the shift~ tests", false); return; }
  const sh = (await cljs(page, '(box "shift~ 3/2" 6200 100)')).trim();
  const known = await until(page, '(boolean (comp/lookup "shift~"))', (x) => x === "true", 20000);
  check("writing shift~ brings @kairotic/spectral into the work", known === "true", known);
  if (known !== "true") { await cljs(page, `(delete ${sh})`); return; }
  check("... with one inlet and one outlet", (await cljs(page, `(io (get-in (current) [:boxes ${sh}]))`)) === "[1 1]");
  check("... and its help patch", (await cljs(page, '(boolean (:example (hlp/of "shift~")))')) === "true");

  // what it keeps: {:factors … :transpose … :formants [q t rms] :dry …}
  const st = (k) => `(get-in @eng/rt [:states ${sh} ${k}])`;
  const near = (got, want) => {
    try { const g = JSON.parse(got.replace(/ /g, ",")); return g.length === want.length && g.every((x, i) => Math.abs(x - want[i]) < 1e-6); }
    catch (_) { return false; }
  };
  await cljs(page, `(send! ${sh} [1 (keyword "5/4") (keyword "3/2")])`);
  let f = await until(page, st(":factors"), (x) => near(x, [1, 1.25, 1.5]));
  check("a list of ratios is the chord (words such as 5/4 too)", near(f, [1, 1.25, 1.5]), f);
  await cljs(page, `(send! ${sh} [(keyword "+12") (keyword "386c")])`);
  f = await until(page, st(":factors"), (x) => near(x, [2, Math.pow(2, 386 / 1200)]));
  check("+12 is semitones and 386c cents", near(f, [2, Math.pow(2, 386 / 1200)]), f);
  await cljs(page, `(send! ${sh} [:semitones 0 4 7])`);
  f = await until(page, st(":factors"), (x) => near(x, [1, Math.pow(2, 4 / 12), Math.pow(2, 7 / 12)]));
  check("[:semitones 0 4 7] writes it in semitones", near(f, [1, Math.pow(2, 4 / 12), Math.pow(2, 7 / 12)]), f);
  await cljs(page, `(send! ${sh} [1 :nonsense])`);
  f = await cljs(page, st(":factors"));
  check("a list with something that is not a factor changes nothing", near(f, [1, Math.pow(2, 4 / 12), Math.pow(2, 7 / 12)]), f);
  await cljs(page, `(send! ${sh} [:formants 1 1.2]) (send! ${sh} [:rms 1]) (send! ${sh} [:dry 3])`);
  const fm = await until(page, `[${st(":formants")} ${st(":dry")}]`, (x) => x === "[[1 1.2 true] 1]");
  check("[:formants q t], [:rms 1] and [:dry x] (within 0…1)", fm === "[[1 1.2 true] 1]", fm);
  await cljs(page, `(send! ${sh} [:formants 0]) (send! ${sh} [:rms 0]) (send! ${sh} [:dry 0]) (send! ${sh} 1.5)`);

  // it sounds: an osc~ 220 through shift~ 3/2 is heard by pitch~ at 330 Hz
  const osc = (await cljs(page, '(box "osc~ 220" 6200 40)')).trim();
  const pitch = (await cljs(page, '(box "pitch~ 80 1500" 6200 160)')).trim();
  const lvl = (await cljs(page, '(box "snapshot~ 200 peak" 6400 160)')).trim();
  await cljs(page, `(connect ${osc} 0 ${sh} 0) (connect ${sh} 0 ${pitch} 0) (connect ${sh} 0 ${lvl} 0)`);
  await cljs(page, "(play)");
  const peak = await until(page, `(get-in @eng/rt [:states ${lvl}])`, (x) => Number(x) > 0.02, 15000);
  check("shift~ loads its WebAssembly and sounds", Number(peak) > 0.02, peak);
  const hz = await until(page, `(:hz (get-in @eng/rt [:states ${pitch}]))`, (x) => Math.abs(Number(x) - 330) < 3, 10000);
  check("pitch~ hears an osc~ 220 through shift~ 1.5 at 330 Hz", Math.abs(Number(hz) - 330) < 3, hz);
  await cljs(page, `(send! ${sh} [:transpose 12])`);
  const up = await until(page, `(:hz (get-in @eng/rt [:states ${pitch}]))`, (x) => Math.abs(Number(x) - 660) < 6, 10000);
  check("[:transpose 12] moves it an octave, to 660 Hz, while it sounds", Math.abs(Number(up) - 660) < 6, up);
  const errs = await cljs(page, '(count (filter (fn [[_ v]] (re-find #"shift" (str v))) (:prints @eng/rt)))');
  check("... without errors", errs === "0", errs);

  await cljs(page, "(stop)");
  await cljs(page, `(delete ${sh} ${osc} ${pitch} ${lvl})`);
}
