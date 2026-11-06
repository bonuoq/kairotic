// SPDX-License-Identifier: MPL-2.0
// realize~ (discussion #114, Study 37, @kairotic/analysis): descriptors in — loudness, brightness, noisiness,
// pitch — and the sliders of the faust~ it plays out. It learns that faust~ first (what its outlet reaches,
// played offline and heard); then a brightness written comes out as the brightness heard. In the audio app
// of tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};
const text = (s) => { try { return JSON.parse(s); } catch (_) { return String(s); } };

const voice = `import("stdfaust.lib");
pitch = hslider("pitch", 60, 36, 84, 0.01) : si.smoo;
gain = hslider("gain [unit:dB]", -12, -80, 6, 0.1) : ba.db2linear : si.smoo;
wave = hslider("wave", 0.5, 0, 1, 0.001) : si.smoo;
noise = hslider("noise", 0.1, 0, 1, 0.001) : si.smoo;
cutoff = hslider("cutoff [scale:log]", 1000, 60, 14000, 1) : si.smoo;
resonance = hslider("resonance [scale:log]", 1, 0.5, 8, 0.01) : si.smoo;
f0 = ba.midikey2hz(pitch);
osc = os.sawtooth(f0) * (1 - wave) + os.square(f0) * wave;
process = osc * (1 - noise) + no.noise * noise : fi.svf.lp(min(cutoff, 0.45 * ma.SR), resonance) * gain;`;

export async function realize(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the realize~ tests", false); return; }
  const f = (await cljs(page, '(box "faust~" 9000 100)')).trim();
  const r = (await cljs(page, '(box "realize~ 120" 9000 20)')).trim();
  const lone = (await cljs(page, '(box "realize~" 9300 20)')).trim();
  const fe = (await cljs(page, '(box "features~ 20" 9000 220)')).trim();
  const pi = (await cljs(page, '(box "pitch~" 9200 220)')).trim();
  const cen = (await cljs(page, '(box "number" 9000 300)')).trim();
  const lvl = (await cljs(page, '(box "number" 9100 300)')).trim();
  const reach = (await cljs(page, '(box "number" 9300 100)')).trim();
  const all = [f, r, lone, fe, pi, cen, lvl, reach];
  await cljs(page, `(code ${f} ${JSON.stringify(voice)})`);
  await cljs(page, `(connect ${r} 0 ${f} 0) (connect ${r} 1 ${reach} 0) (connect ${f} 0 ${fe} 0) (connect ${f} 0 ${pi} 0) (connect ${fe} 1 ${cen} 0) (connect ${fe} 0 ${lvl} 0)`);
  const st = await until(page, `(:status (cbox/compiled "faust" (source ${f})))`, (x) => x === ":ok" || x === ":error", 60000);
  check("the faust~ it plays compiles", st === ":ok", st);
  const loaded = await until(page, '(boolean (comp/lookup "realize~"))', (x) => x === "true", 20000);
  check("realize~ comes with @kairotic/analysis", loaded === "true");
  check("... four inlets (loudness, brightness, noisiness, pitch) and two outlets", (await cljs(page, `(io (get-in (current) [:boxes ${r}]))`)) === "[4 2]");

  await cljs(page, "(play)");
  await until(page, `(boolean @(:faust (get-in @eng/rt [:nodes ${f}])))`, (x) => x === "true", 20000);
  const state = (id, k) => `(get-in @eng/rt [:states ${id} ${k}])`;

  // a realize~ that plays nothing says so
  await cljs(page, `(send! ${lone} 0 -12)`);
  const err = text(await until(page, state(lone, ":error"), (x) => x !== "nil", 10000));
  check("without a faust~ on its outlet it says what to do", /connect its left outlet to a faust~/.test(err), err);

  // the first frame: it learns the faust~ first, then plays it
  const frame = (loud, bright, noisy, hz) => cljs(page, `(send! ${r} 0 ${loud}) (send! ${r} 1 ${bright}) (send! ${r} 2 ${noisy}) (send! ${r} 3 ${hz})`);
  await frame(-14, 600, 0.02, 220);
  check("the first frame starts learning the faust~", (await until(page, state(r, ":learning"), (x) => x === "true", 3000)) === "true");
  const n = await until(page, `(count (get-in @eng/rt [:states ${r} :bank :entries]))`, (x) => Number(x) > 0, 60000);
  check("... it hears steady settings of it", Number(n) > 80, n);
  check("... and names what its sliders do", (await cljs(page, `(mapv :label (get-in @eng/rt [:states ${r} :bank :timbre]))`)) === '["cutoff" "noise" "resonance" "wave"]'
    && text(await cljs(page, state(r, "[:bank :faust]"))).endsWith(f.slice(1)), await cljs(page, `(select-keys (get-in @eng/rt [:states ${r} :bank]) [:pitch :gain :timbre :faust])`));

  const values = `@(:values (get-in @eng/rt [:nodes ${f}]))`;
  const centroid = async () => { await page.waitForTimeout(900); const xs = []; for (let i = 0; i < 5; i++) { xs.push(Number(await cljs(page, `(get-in @eng/rt [:states ${cen}])`))); await page.waitForTimeout(120); } return xs.sort((a, b) => a - b)[2]; };
  await frame(-14, 600, 0.02, 220);
  const pitch = Number(await until(page, `(get ${values} "pitch")`, (x) => Math.abs(Number(x) - 57) < 0.05, 3000));
  check("the pitch goes to its pitch slider, in MIDI (220 Hz → 57)", Math.abs(pitch - 57) < 0.05, await cljs(page, values));
  const dark = await centroid();
  await frame(-14, 3000, 0.02, 220);
  const bright = await centroid();
  check("a brightness written is the brightness heard (600 → 3000 Hz written)", dark < 1200 && bright > 1800 && bright > 2 * dark, `${dark} → ${bright} Hz heard`);
  check("... its level follows the loudness written (−14 dB)", Math.abs(20 * Math.log10(Number(await cljs(page, `(get-in @eng/rt [:states ${lvl}])`))) + 14) < 6,
    await cljs(page, `(get-in @eng/rt [:states ${lvl}])`));
  check("... and on the right, how far the faust~ is from it", Number(await cljs(page, `(get-in @eng/rt [:states ${reach}])`)) >= 0);

  // silence: the gain goes down, the timbre stays
  const cut = await cljs(page, `(get ${values} "cutoff")`);
  await cljs(page, `(send! ${r} 0 -90)`);
  const g = await until(page, `(get ${values} "gain")`, (x) => Number(x) <= -79, 3000);
  check("a silence written closes its gain and leaves its timbre", Number(g) <= -79 && (await cljs(page, `(get ${values} "cutoff")`)) === cut, g);

  // learn: again, after the code changes
  await cljs(page, `(send! ${r} :learn)`);
  check("learn learns it again", (await until(page, state(r, ":learning"), (x) => x === "true", 3000)) === "true");
  await until(page, state(r, ":learning"), (x) => x === "false", 60000);

  await cljs(page, "(stop)");
  await cljs(page, `(delete ${all.join(" ")})`);
}
