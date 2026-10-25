// SPDX-License-Identifier: MPL-2.0
// A polyphonic faust~: a source with declare options "[nvoices:8]" is compiled as voices (and an
// effect, if it has one), takes Hz on the left and voice ids on the right as synth~, one note per id,
// with the velocity of [:gain v], in any tuning (MIDI pitches with decimals); without nvoices it is mono.
// In the audio app of tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

const voice = `import("stdfaust.lib");
declare options "[nvoices:8]";
freq = hslider("freq", 440, 40, 4000, 0.01);
gain = hslider("gain", 0.8, 0, 1, 0.01);
gate = button("gate");
cutoff = hslider("cutoff", 2400, 200, 8000, 1);
process = os.sawtooth(freq) * gain * en.adsr(0.01, 0.1, 0.8, 0.2, gate) * 0.15 : fi.lowpass(2, cutoff);`;
const withEffect = voice + "\neffect = ef.echo(1, 0.25, 0.3);";
const mono = `import("stdfaust.lib");
freq = hslider("freq", 220, 40, 4000, 0.01);
process = os.osc(freq) * 0.1;`;

export async function faustpoly(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the polyphonic faust~ tests", false); return; }
  const f = (await cljs(page, '(box "faust~" 5600 100)')).trim();
  await cljs(page, `(code ${f} ${JSON.stringify(voice)})`);
  const st = await until(page, `(:status (cbox/compiled "faust" (source ${f})))`, (x) => x === ":ok" || x === ":error", 60000);
  check("a source with nvoices compiles as voices", st === ":ok", st + " " + await cljs(page, `(:error (cbox/compiled "faust" (source ${f})))`));
  if (st !== ":ok") { await cljs(page, `(delete ${f})`); return; }
  const inf = `(kairotic.faust/info (get-in (current) [:boxes ${f}]))`;
  check("... eight of them, without an effect", (await cljs(page, `((juxt :poly :effect) ${inf})`)) === "[8 false]", await cljs(page, inf));
  check("... freq, gain and gate are the voices', not sliders of the box", (await cljs(page, `(mapv :label (:params ${inf}))`)) === '["cutoff"]', await cljs(page, `(:params ${inf})`));
  check("... and it has a second inlet, for the voice ids", (await cljs(page, `(io (get-in (current) [:boxes ${f}]))`)) === "[2 1]");

  const lvl = (await cljs(page, '(box "snapshot~ 100 peak" 5600 300)')).trim();
  const pitch = (await cljs(page, '(box "pitch~" 5800 300)')).trim();
  await cljs(page, `(connect ${f} 0 ${lvl} 0) (connect ${f} 0 ${pitch} 0)`);
  await until(page, '(boolean (comp/lookup "pitch~"))', (x) => x === "true", 20000);
  await cljs(page, "(play)");
  await until(page, `(boolean @(:faust (get-in @eng/rt [:nodes ${f}])))`, (x) => x === "true", 20000);
  const voices = `(set (keys @(:voices (get-in @eng/rt [:nodes ${f}]))))`;
  const peak = `(or (get-in @eng/rt [:states ${lvl}]) 0)`;

  // a chord: a list of Hz, one voice each
  await cljs(page, `(send! ${f} [220 277.18 329.63])`);
  check("a list of Hz plays a voice for each", (await until(page, `(count ${voices})`, (x) => x === "3")) === "3", await cljs(page, voices));
  const p1 = await until(page, peak, (x) => Number(x) > 0.05, 5000);
  check("... and the chord sounds", Number(p1) > 0.05, p1);

  // voice ids on the right inlet, as a keyboard or mt play sends them
  await cljs(page, `(inject-local! (fid ${f}) 1 [:a :b]) (send! ${f} [261.63 392])`);
  check("ids on the right inlet name the voices", (await until(page, voices, (x) => x === "#{:a :b}")) === "#{:a :b}", await cljs(page, voices));
  await cljs(page, `(inject-local! (fid ${f}) 1 [:a]) (send! ${f} [261.63])`);
  check("... an id that is gone releases its note", (await until(page, voices, (x) => x === "#{:a}")) === "#{:a}", await cljs(page, voices));

  // :stop releases everything; then it falls silent
  await cljs(page, `(send! ${f} :stop)`);
  check(":stop releases every voice", (await until(page, `(count ${voices})`, (x) => x === "0")) === "0");
  const quiet = await until(page, peak, (x) => Number(x) < 0.005, 5000);
  check("... and after their release it is silent", Number(quiet) < 0.005, quiet);

  // any tuning: 275 Hz is a MIDI pitch of 60.86, played as written
  await cljs(page, `(send! ${f} [:gain 1]) (send! ${f} 275)`);
  const hz = await until(page, `(:hz (get-in @eng/rt [:states ${pitch}]))`, (x) => Math.abs(Number(x) - 275) < 2, 8000);
  check("a frequency between the keys (275 Hz) sounds at 275 Hz", Math.abs(Number(hz) - 275) < 2, hz);
  await page.waitForTimeout(600);
  const loud = Number(await cljs(page, peak));
  await cljs(page, `(send! ${f} :stop)`);
  await until(page, peak, (x) => Number(x) < 0.005, 5000);
  await cljs(page, `(send! ${f} [:gain 0.25]) (send! ${f} 275)`);
  await page.waitForTimeout(800);
  const soft = Number(await cljs(page, peak));
  check("[:gain 0.25] plays the next notes softer", soft > 0 && soft < loud * 0.6, soft + " vs " + loud);
  await cljs(page, `(send! ${f} :stop)`);

  // an effect in the same source, for all the voices
  await cljs(page, `(code ${f} ${JSON.stringify(withEffect)})`);
  const st2 = await until(page, `(:status (cbox/compiled "faust" (source ${f})))`, (x) => x === ":ok" || x === ":error", 60000);
  check("effect = …; compiles with the voices", st2 === ":ok" && (await cljs(page, `(:effect ${inf})`)) === "true", st2 + " " + await cljs(page, inf));
  await until(page, `(boolean (some-> (get-in @eng/rt [:nodes ${f}]) :faust deref))`, (x) => x === "true", 20000);
  await cljs(page, `(send! ${f} [:gain 1]) (send! ${f} 330)`);
  const p2 = await until(page, peak, (x) => Number(x) > 0.03, 5000);
  check("... and sounds", Number(p2) > 0.03, p2);
  await cljs(page, `(send! ${f} :stop)`);

  // without nvoices: mono, as before
  await cljs(page, `(code ${f} ${JSON.stringify(mono)})`);
  const st3 = await until(page, `(:status (cbox/compiled "faust" (source ${f})))`, (x) => x === ":ok" || x === ":error", 60000);
  check("a source without nvoices is mono, as before", st3 === ":ok" && (await cljs(page, `(:poly ${inf})`)) === "nil" &&
    (await cljs(page, `(io (get-in (current) [:boxes ${f}]))`)) === "[1 1]", st3 + " " + await cljs(page, inf));

  await cljs(page, "(stop)");
  await cljs(page, `(delete ${f} ${lvl} ${pitch})`);
}
