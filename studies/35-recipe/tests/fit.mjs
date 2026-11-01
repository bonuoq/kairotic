// Study 35 · a faust~ found from its sound: random settings of the Faust twin of Study 30's synth are
// rendered, then fitted back from their sound alone; and a sine, to check the renderer and the pitch.
//
//   node studies/35-recipe/tests/fit.mjs <libfaust-wasm.js> <meyda (node)> [targets] [budget]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { renderer, controls } from "../kairotic/render.mjs";
import { fit, sliders, valuesOf, recipe } from "../kairotic/fit.mjs";
import { pitchOf } from "../../32-learn/kairotic/pitch.mjs";
const require = createRequire(import.meta.url);

const js = path.resolve(process.argv[2]), Meyda = (() => { const M = require(path.resolve(process.argv[3])); return M.default || M; })();
const N = +(process.argv[4] || 6), budget = +(process.argv[5] || 300);
async function libfaust() {
  const m = { exports: {} };
  new Function("module", "exports", "require", "__dirname", "__filename", fs.readFileSync(js, "utf8"))(m, m.exports, require, path.dirname(js), js);
  const FM = m.exports.default || m.exports;
  const data = fs.readFileSync(js.replace(/js$/, "data")), wasm = fs.readFileSync(js.replace(/js$/, "wasm"));
  const mod = await FM({ wasmBinary: wasm, getPreloadedPackage: () => data.buffer.slice(data.byteOffset, data.byteOffset + data.byteLength) });
  return new mod.libFaustWasm();
}
const lib = await libfaust();
const compile = (code) => { const f = lib.createDSPFactory("t", code, "-ftz 2", true); const r = { code: new Uint8Array(f.data), json: JSON.parse(f.json) }; lib.deleteDSPFactory(f.cfactory); return r; };

let fails = 0;
const check = (label, ok, detail = "") => { console.log((ok ? "✓ " : "✗ ") + label + (detail ? " · " + detail : "")); if (!ok) fails++; };

// the renderer: a sine at the frequency of its slider, as YIN hears it
const sine = compile('import("stdfaust.lib");\nprocess = os.osc(hslider("freq", 440, 50, 2000, 0.01)) * 0.3;');
const ys = renderer(sine.code, sine.json)({ freq: 330 }, { dur: 0.5 });
const pm = pitchOf(ys).midi;
check("a faust~ renders offline at its slider's value", Math.abs(440 * Math.pow(2, (pm - 69) / 12) - 330) < 1, (440 * Math.pow(2, (pm - 69) / 12)).toFixed(2) + " Hz");
check("... and reads its controls", controls(sine.json).map((c) => c.label).join() === "freq");

// the twin: random settings, fitted back from their sound alone
const code = fs.readFileSync(new URL("../kairotic/twin.dsp", import.meta.url), "utf8");
const twin = compile(code), render = renderer(twin.code, twin.json), cs = sliders(twin.json);
check("the twin has the synth's ten sliders, with their log scales", cs.length === 10 && cs.filter((c) => c.scale === "log").length === 5, cs.map((c) => c.label + (c.scale === "log" ? "·log" : "")).join(" "));
let s = 11;
const rnd = () => { s = (s * 16807) % 2147483647; return s / 2147483647; };
let sumFx = 0, sumNear = 0, sumPd = 0, pitchOk = 0, pitched = 0, n = 0;
const t0 = Date.now();
while (n < N) {
  const truth = cs.map(() => rnd());
  truth[cs.findIndex((c) => c.label === "noise")] *= 0.3;   // mostly pitched targets
  const y = render(valuesOf(cs, truth));
  let peak = 0; for (const v of y) peak = Math.max(peak, Math.abs(v));
  if (peak < 0.02) continue;   // a silence: not a target anyone would choose
  const r = fit(Meyda, render, twin.json, y, { bank: 48, budget, seed: n + 1 });
  n++;
  sumFx += r.fx; sumNear += r.nearestFx;
  sumPd += r.u.reduce((a, v, i) => a + Math.abs(v - truth[i]), 0) / truth.length;
  const tp = valuesOf(cs, truth).pitch;
  if (r.pitch !== null) { pitched++; if (Math.abs(r.values.pitch - tp) < 0.5) pitchOk++; }
}
check(`${N} settings of the twin fitted back from their sound (${budget} renders each)`, sumFx / N < 0.6 * (sumNear / N),
  `descriptor distance ${(sumFx / N).toFixed(3)} against ${(sumNear / N).toFixed(3)} for the nearest of the bank · patch ${(sumPd / N).toFixed(3)} · ${((Date.now() - t0) / 1000 / N).toFixed(1)} s each`);
// (a heavily filtered note can sound closest an octave away: YIN and the distance can both be fooled)
check("... with the pitch held where YIN heard it, nearly always", pitched === 0 || pitchOk >= 0.8 * pitched, `${pitchOk}/${pitched} within half a semitone`);

// the recipe: the same code with the values found as its sliders' starting values
const rec = recipe(code, { cutoff: 1234.5678, pitch: 61.237, attack: 0.0123456 }, cs);
check("the recipe writes the values found into the code", /hslider\("cutoff \[scale:log\] \[unit:Hz\]", 1235,/.test(rec) && /hslider\("pitch", 61.24,/.test(rec) && /hslider\("attack \[scale:log\] \[unit:s\]", 0.0123,/.test(rec), rec.split("\n").filter((l) => /cutoff|pitch =|attack/.test(l)).join(" | "));
const again = compile(rec);
check("... and it still compiles", controls(again.json).find((c) => c.label === "cutoff").init === 1235);

console.log(fails ? fails + " failed" : "all passed");
process.exitCode = fails ? 1 : 0;
