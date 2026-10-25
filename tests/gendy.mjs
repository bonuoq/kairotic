// SPDX-License-Identifier: MPL-2.0
// gendy~ (@kairotic/synth 0.2.0): a dynamic stochastic oscillator. Writing it brings the package; its
// messages set its parameters within their ranges; it sounds, quietly, also with a signal on its inlet
// (FM) and after its breakpoints change.
// In the audio app of tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

export async function gendy(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the gendy~ tests", false); return; }
  const g = (await cljs(page, '(box "gendy~ 220" 4200 100)')).trim();
  const known = await until(page, '(boolean (comp/lookup "gendy~"))', (x) => x === "true", 20000);
  check("writing gendy~ brings @kairotic/synth into the work", known === "true", known);
  if (known !== "true") { await cljs(page, `(delete ${g})`); return; }
  check("... with one inlet and one outlet", (await cljs(page, `(io (get-in (current) [:boxes ${g}]))`)) === "[1 1]");
  check("... and its help: a help patch of four steps",
    (await cljs(page, '[(boolean (:example (hlp/of "gendy~"))) (count (hlp/patch-steps "gendy~"))]')) === "[true 4]");

  const st = `(get-in @eng/rt [:states ${g}])`;
  await cljs(page, `(send! ${g} 330)`);
  check("a number sets the frequency", (await until(page, st, (x) => /^\[330 /.test(x))).startsWith("[330 "), await cljs(page, st));
  await cljs(page, `(send! ${g} [:y-step 0.2])`);
  check("[:y-step 0.2] sets one parameter", (await until(page, st, (x) => / 0\.2 16\]$/.test(x))) === "[330 10 -0.15 0.15 0.2 16]", await cljs(page, st));
  await cljs(page, `(send! ${g} [100 200 -3 3 9 1000])`);
  check("a list of six sets all of them, each within its range", (await until(page, st, (x) => /^\[100 /.test(x))) === "[100 100 -1 1 2 128]", await cljs(page, st));
  await cljs(page, `(send! ${g} [:nothing 4])`);
  check("what it does not understand changes nothing", (await cljs(page, st)) === "[100 100 -1 1 2 128]");
  await cljs(page, `(send! ${g} [220 10 -0.15 0.15 0.05 16])`);

  // it sounds, quietly
  const lvl = (await cljs(page, '(box "snapshot~ 200 peak" 4200 160)')).trim();
  await cljs(page, `(connect ${g} 0 ${lvl} 0)`);
  await cljs(page, "(play)");
  const peak = await until(page, `(get-in @eng/rt [:states ${lvl}])`, (x) => Number(x) > 0.01, 10000);
  check("gendy~ sounds", Number(peak) > 0.01, peak);
  check("... quietly (within about ±0.3 with its default barriers)", Number(peak) < 0.35, peak);

  // its breakpoints change without rebuilding it, and it goes on sounding
  await cljs(page, `(text! ${g} "gendy~ 220 10 -0.15 0.15 0.05 4")`);
  await page.waitForTimeout(400);
  check("with fewer breakpoints it goes on sounding", Number(await until(page, `(get-in @eng/rt [:states ${lvl}])`, (x) => Number(x) > 0.01)) > 0.01);

  // a signal on its inlet: FM
  const lfo = (await cljs(page, '(box "osc~ 5" 4400 40)')).trim();
  const depth = (await cljs(page, '(box "gain~ 300" 4400 70)')).trim();
  await cljs(page, `(connect ${lfo} 0 ${depth} 0) (connect ${depth} 0 ${g} 0)`);
  await page.waitForTimeout(400);
  const fm = await until(page, `(get-in @eng/rt [:states ${lvl}])`, (x) => Number(x) > 0.01);
  const errs = await cljs(page, '(count (filter (fn [[_ v]] (re-find #"gendy" (str v))) (:prints @eng/rt)))');
  check("with a signal on its inlet (FM) it goes on sounding, without errors", Number(fm) > 0.01 && errs === "0", fm + " " + errs);

  await cljs(page, "(stop)");
  await cljs(page, `(delete ${g} ${lvl} ${lfo} ${depth})`);
}
