// SPDX-License-Identifier: MPL-2.0
// @kairotic/faust-units · a sound → the values of a faust~'s sliders that sound closest to it → its code
// with the sliders starting there: a recipe (discussion #114, Study 35).
//
// Nothing in it is about one synth: the code's own sliders are the parameters (their range, and a log
// scale when the code says [scale:log]); a small bank of random settings, rendered, standardises the
// distance and gives the first guess (the nearest one); the pitch, when a slider is called pitch, key,
// note or midi (MIDI) or freq, frequency, f0 or hz (Hz), is heard by YIN and held, at the octave that
// sounds closest; and CMA-ES looks for the rest by rendering the real code and listening (Meyda, as
// features~). Every render is brought to the target's loudest frame first, so a recording at any level
// can be matched. It runs in the page, a moment at a time (the browser keeps drawing and playing), and
// stops when its signal is aborted.
//
//   const r = await find({ faust, code, Meyda, sound: { sr, chans }, budget, signal, onProgress });
//   r.code  // the code, its sliders starting at the values found;  r.values, r.fx, r.nearestFx, r.pitch

import { renderer, controls } from "./render.mjs";
import { analyse, matcher, peakRms, pitchOf, octaveOf, SR } from "./listen.mjs";
import { cmaes } from "./cmaes.mjs";

export { renderer, controls };

export function sliders(json) {
  return controls(json).filter((c) => c.type === "hslider" || c.type === "vslider" || c.type === "nentry");
}
const logOk = (c) => c.scale === "log" && c.min > 0 && c.max > c.min;
export function toValue(c, u) {
  u = Math.min(1, Math.max(0, u));
  return logOk(c) ? c.min * Math.pow(c.max / c.min, u) : c.min + (c.max - c.min) * u;
}
export function fromValue(c, v) {
  if (c.max === c.min) return 0;
  const u = logOk(c) ? Math.log(v / c.min) / Math.log(c.max / c.min) : (v - c.min) / (c.max - c.min);
  return Math.min(1, Math.max(0, u));
}
export const valuesOf = (cs, u) => Object.fromEntries(cs.map((c, i) => [c.label, toValue(c, u[i])]));

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}

// a render brought to a loudness (its loudest frame at `ref`), then analysed as features~ does
function heard(Meyda, y, ref) {
  const p = peakRms(y);
  if (p > 1e-6 && ref > 0) { const g = ref / p, z = new Float32Array(y.length); for (let i = 0; i < y.length; i++) z[i] = y[i] * g; y = z; }
  return analyse(Meyda, y);
}

// the slider a pitch is held on: {index, kind: "midi"|"hz"} or null
export function pitchSlider(cs) {
  const i = cs.findIndex((c) => /^(pitch|key|note|midi)$/i.test(c.label));
  if (i >= 0) return { index: i, kind: "midi" };
  const j = cs.findIndex((c) => /^(freq|frequency|f0|hz)$/i.test(c.label));
  return j >= 0 ? { index: j, kind: "hz" } : null;
}

const stopped = () => Object.assign(new Error("stopped"), { name: "AbortError" });
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());
// a moment given back to the page: a message to itself (a timer in a page that is not in front waits a second
// or more; a message does not)
const breath = () => new Promise((ok) => {
  if (typeof MessageChannel === "undefined") return setTimeout(ok, 0);
  const c = new MessageChannel();
  c.port1.onmessage = () => { c.port1.close(); ok(); };
  c.port2.postMessage(0);
});

// fit(Meyda, render, json, target, opts) → Promise of { values, u, fx, f0, start, pitch, history, bank, sliders, nearestFx }
//   render(values, {dur, gate}) → samples; target: samples (at 44.1 kHz, dur seconds)
//   opts: bank (random settings rendered first), budget (renders for the search), seed, dur, gate,
//         start (a guess in [0, 1] to begin from instead of the nearest), signal (an AbortSignal),
//         slice (ms of work between two moments given back to the browser), onProgress(phase, done, total, best)
export async function fit(Meyda, render, json, target, { bank = 64, budget = 300, seed = 1, dur = 1.0, gate = 0.65, start = null,
  holdPitch = true, signal = null, slice = 30, onProgress = () => {} } = {}) {
  const cs = sliders(json);
  if (!cs.length) throw new Error("this code has no sliders to look for");
  const ref = peakRms(target);
  if (!(ref > 1e-4)) throw new Error("the sound is silent");
  const ft = analyse(Meyda, target);
  let t0 = now();
  const breathe = async () => {
    if (signal && signal.aborted) throw stopped();
    if (now() - t0 > slice) { await breath(); t0 = now(); if (signal && signal.aborted) throw stopped(); }
  };
  const play = async (u) => { const f = heard(Meyda, render(valuesOf(cs, u), { dur, gate }), ref); await breathe(); return f; };
  // 1. a bank of random settings: the distance's statistics, and the nearest as a first guess
  const r = rng(seed), B = [];
  for (let k = 0; k < bank; k++) {
    const u = cs.map(() => r());
    B.push({ u, f: await play(u) });
    onProgress("bank", k + 1, bank);
  }
  const m = matcher(B);
  const tq = m.vec(ft), dist = async (u) => m.dist(m.vec(await play(u)), tq);
  const nearest = m.nearest(ft).example.u;
  const s0 = start ? start.slice() : nearest.slice();
  // 2. the pitch, heard apart and held
  const ps = holdPitch ? pitchSlider(cs) : null;
  let pitch = null, fixed = null;
  const midiRange = (c, kind) => kind === "midi" ? [c.min, c.max]
    : [69 + 12 * Math.log2(Math.max(1, c.min) / 440), 69 + 12 * Math.log2(Math.max(1, c.max) / 440)];
  const atMidi = (c, kind, mid) => fromValue(c, kind === "midi" ? mid : 440 * Math.pow(2, (mid - 69) / 12));
  if (ps) {
    const yp = pitchOf(target);
    if (yp.midi !== null) {
      const c = cs[ps.index], guess = toValue(c, s0[ps.index]);
      const guessMidi = ps.kind === "midi" ? guess : 69 + 12 * Math.log2(Math.max(1, guess) / 440);
      const [lo, hi] = midiRange(c, ps.kind);
      // YIN's note, at the octave that sounds closest (the guess's, and one below and above: three renders)
      const base = octaveOf(yp.midi, guessMidi, lo, hi);
      let best = null;
      for (const mid of [base - 12, base, base + 12]) {
        if (mid < lo - 0.5 || mid > hi + 0.5) continue;
        const u = s0.slice(); u[ps.index] = atMidi(c, ps.kind, mid);
        const d = await dist(u);
        if (!best || d < best.d) best = { mid, d };
      }
      if (best) { pitch = best.mid; fixed = atMidi(c, ps.kind, pitch); s0[ps.index] = fixed; }
    }
  }
  // 3. the search that listens, over every slider but the one holding the pitch
  const free = cs.map((_, i) => i).filter((i) => !(fixed !== null && i === ps.index));
  const full = (v) => { const u = s0.slice(); free.forEach((i, k) => { u[i] = v[k]; }); return u; };
  let u = s0.slice(), fx, history = [], f0;
  if (free.length) {
    const res = await cmaes((v) => dist(full(v)), free.map((i) => s0[i]), { budget, seed: seed + 2,
      onStep: (best, n) => onProgress("search", n, budget, best.fx) });
    u = full(res.x); fx = res.fx; history = res.history; f0 = res.history[0][1];
  } else { fx = f0 = await dist(u); }
  // the octave again, now that the rest is found (two renders): a filtered note can sound closest an
  // octave away with the first guess's timbre, not with its own
  if (fixed !== null) {
    const c = cs[ps.index], [lo, hi] = midiRange(c, ps.kind);
    for (const mid of [pitch - 12, pitch + 12]) {
      if (mid < lo - 0.5 || mid > hi + 0.5) continue;
      const v = u.slice(); v[ps.index] = atMidi(c, ps.kind, mid);
      const d = await dist(v);
      if (d < fx) { u = v; fx = d; pitch = mid; }
    }
  }
  return { values: valuesOf(cs, u), u, fx, f0, start: s0, pitch, history, bank: B.length, sliders: cs, nearestFx: await dist(nearest) };
}

// the recipe: the same code with each slider starting at the value found
export function recipe(code, values, cs) {
  const byLabel = new Map(cs.map((c) => [c.label, c]));
  return code.replace(/\b(hslider|vslider|nentry)\s*\(\s*"([^"]*)"\s*,\s*([^,()]+?)\s*,/g, (all, kind, label, init) => {
    const name = label.replace(/\[[^\]]*\]/g, "").trim(), c = byLabel.get(name);
    if (!c || !(name in values)) return all;
    const digits = c.step > 0 ? Math.max(0, Math.min(6, Math.ceil(-Math.log10(c.step)))) : 4;
    return `${kind}("${label}", ${(+values[name].toFixed(digits)).toString()},`;
  });
}

// a sound as the search hears it: its channels mixed, at 44.1 kHz, from where it starts (its silence
// before left out), `dur` seconds long (silence after, if it is shorter)
export function targetOf({ sr, chans }, { dur = 1.0 } = {}) {
  const n0 = chans[0].length, mono = new Float32Array(n0);
  for (const ch of chans) for (let i = 0; i < n0; i++) mono[i] += ch[i] / chans.length;
  let peak = 0;
  for (const v of mono) peak = Math.max(peak, Math.abs(v));
  let at = 0;
  while (at < n0 && Math.abs(mono[at]) < 0.05 * peak) at++;
  at = Math.max(0, at - Math.round(0.005 * sr));
  const n = Math.round(dur * SR), y = new Float32Array(n), k = sr / SR;
  for (let i = 0; i < n; i++) {
    const p = at + i * k, j = Math.floor(p), f = p - j;
    if (j + 1 >= n0) break;
    y[i] = mono[j] * (1 - f) + mono[j + 1] * f;
  }
  return y;
}

// compiles code with faustwasm ({F, compiler}, as the page loads it) and plays it offline
export async function compileOffline(faust, code) {
  const gen = new faust.F.FaustMonoDspGenerator();
  const ok = await gen.compile(faust.compiler, "recipe" + Math.random().toString(36).slice(2, 7), code, "-ftz 2");
  if (!ok) throw new Error("Faust could not compile this code");
  const json = JSON.parse(gen.factory.json);
  return { json, render: renderer(gen.factory.module || gen.factory.code, json) };
}

// the whole of it: the code of a faust~ and a sound → its recipe
export async function find({ faust, code, Meyda, sound, bank = 48, budget = 240, seed = 1, dur = 1.0, gate = 0.65, signal = null,
  onProgress = () => {} }) {
  const { json, render } = await compileOffline(faust, code);
  if (!sliders(json).length) throw new Error("this code has no sliders to look for (hslider, vslider or nentry)");
  const target = targetOf(sound, { dur });
  const r = await fit(Meyda, render, json, target, { bank, budget, seed, dur, gate, signal, onProgress });
  return Object.assign(r, { code: recipe(code, r.values, r.sliders), target, y: render(r.values, { dur, gate }) });
}

// what api/import-module gives the page (it takes a module's default export)
export default { find, fit, recipe, targetOf, compileOffline, sliders, valuesOf, toValue, fromValue, pitchSlider, renderer, controls };
