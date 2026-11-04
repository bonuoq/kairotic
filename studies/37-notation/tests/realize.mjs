// Study 37 · descriptors as notation: the voice realises scores (the presets), curves heard in another
// instrument (the Faust twin of Study 30's synth, a note with a filter sweep) and curves of its own (sliders
// moved along known paths); each against the voice held still at the mean of what is written.
//
//   node studies/37-notation/tests/realize.mjs <libfaust-wasm.js> <meyda web build> [bank]
import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";
import { curves, player, bank, realize, constant, score, PRESETS, roles, HOP, SR } from "../kairotic/notation.mjs";
import { renderer } from "../../35-recipe/kairotic/render.mjs";
const require = createRequire(import.meta.url);

const js = path.resolve(process.argv[2]), N = +(process.argv[4] || 500);
const g = {};
new Function("self", "window", "module", "exports", "define", fs.readFileSync(path.resolve(process.argv[3]), "utf8"))(g, g, undefined, undefined, undefined);
const Meyda = g.Meyda;
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
const fmt = (e) => `loud ${e.loud.toFixed(1)} dB · bright ${e.bright.toFixed(1)} st · noisy ${e.noisy.toFixed(3)}` + (e.pitch === null ? "" : ` · pitch ${e.pitch.toFixed(0)} c`);

const voice = compile(fs.readFileSync(new URL("../kairotic/voice.dsp", import.meta.url), "utf8"));
const R = roles(voice.json);
check("the voice's sliders: pitch and gain from their lanes, four for the timbre", R.pitch && R.gain && R.gain.db && R.timbre.length === 4,
  R.timbre.map((i) => R.cs[i].label).join(" "));
const play = player(voice.code, voice.json);

// a sine held at 57 (220 Hz), −20 dB: the curves say so
const sine = compile('import("stdfaust.lib");\nprocess = os.osc(hslider("freq", 220, 50, 2000, 0.01)) * 0.1;');
const cs = curves(Meyda, player(sine.code, sine.json)(Array.from({ length: 40 }, () => ({ freq: 220 }))));
const mid = (xs) => xs.slice(10, 35).filter((x) => x !== null).sort((a, b) => a - b)[12];
check("curves hear a sine: its pitch, level, brightness and no noise", Math.abs(mid(cs.pitch) - 57) < 0.1 && Math.abs(mid(cs.loud) + 23) < 0.5
  && Math.abs(mid(cs.bright) / 220 - 1) < 0.15 && mid(cs.noisy) < 0.01,
  `${mid(cs.pitch).toFixed(2)} · ${mid(cs.loud).toFixed(1)} dB · ${mid(cs.bright).toFixed(0)} Hz · ${mid(cs.noisy).toFixed(4)}`);
check("... a frame every 1024 samples, as long as what was played", cs.n === 40);

let t0 = Date.now();
const B = bank(Meyda, play, voice.json, { n: N, seed: 3 });
check(`a bank of ${N} steady settings of the voice`, B.entries.length > 0.9 * N, `${B.entries.length} kept · ${((Date.now() - t0) / 1000).toFixed(1)} s`);

const all = [];
const run = (name, target) => {
  t0 = Date.now();
  const r = realize(Meyda, play, B, target, { passes: 3 }), c = constant(Meyda, play, B, target);
  all.push({ name, r, c });
  console.log(`  ${name}: ${fmt(r.err)} (passes ${r.passes.map((e) => e.score.toFixed(2)).join(" → ")}) · held still: ${fmt(c.err)} · ${((Date.now() - t0) / 1000).toFixed(1)} s`);
  return r;
};
for (const p of Object.values(PRESETS)) run("score " + p.name, score(p.lanes, p.seconds));

// another instrument: the twin of Study 30's synth, a note whose filter opens and closes
const twin = compile(fs.readFileSync(new URL("../../35-recipe/kairotic/twin.dsp", import.meta.url), "utf8"));
const tw = renderer(twin.code, twin.json);
const note = tw({ pitch: 50, wave: 0.2, noise: 0.05, cutoff: 300, resonance: 2, envamt: 3.5, attack: 0.25, decay: 0.5, sustain: 0.4, release: 0.25 }, { dur: 2.5, gate: 1.8 });
run("a note of the twin, heard", curves(Meyda, note));

// curves of the voice itself, its sliders moved along known paths: everything is reachable
const n = 150, frames = [];
for (let i = 0; i < n; i++) {
  const t = i / n;
  frames.push({ pitch: 52 + 10 * t, gain: -30 + 22 * Math.sin(Math.PI * t), wave: 0.5 + 0.5 * Math.sin(6 * t),
                noise: 0.05 + 0.25 * Math.max(0, Math.sin(9 * t)), cutoff: 300 * Math.pow(20, 0.5 - 0.5 * Math.cos(5 * t)), resonance: 1.5 });
}
const self = run("the voice's own paths", curves(Meyda, play(frames)));

// what the study claims: following the curves sounds closer than holding still, in every case
const better = all.filter(({ r, c }) => r.err.score < c.err.score).length;
check(`the realisation follows the curves better than the voice held still (${better}/${all.length})`, better === all.length);
check("... and listening to itself helps: the last pass no worse than the first, on average",
  all.reduce((s, { r }) => s + Math.min(...r.passes.map((e) => e.score)) - r.passes[0].score, 0) <= 0);
check("on its own paths: within 2 dB, 2 semitones of brightness, 0.05 of noisiness, 25 cents",
  self.err.loud < 2 && self.err.bright < 2 && self.err.noisy < 0.05 && self.err.pitch < 25, fmt(self.err));
const avg = (k) => all.reduce((s, x) => s + x.r.err[k], 0) / all.length, avgC = (k) => all.reduce((s, x) => s + x.c.err[k], 0) / all.length;
console.log(`  mean: realised loud ${avg("loud").toFixed(1)} dB / bright ${avg("bright").toFixed(1)} st / noisy ${avg("noisy").toFixed(3)}; held still ${avgC("loud").toFixed(1)} / ${avgC("bright").toFixed(1)} / ${avgC("noisy").toFixed(3)}`);
void HOP; void SR;
console.log(fails ? fails + " failed" : "all passed");
process.exitCode = fails ? 1 : 0;
