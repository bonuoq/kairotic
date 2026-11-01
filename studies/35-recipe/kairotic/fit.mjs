// Study 35 · a sound → the values of a faust~'s sliders that sound closest to it → a recipe.
//
// Nothing in it is about one synth: the code's own sliders are the parameters (their range, and a log
// scale when the code says [scale:log]); a small bank of random settings, rendered, standardises the
// distance and gives the first guess (the nearest one); the pitch, when a slider is called pitch (MIDI) or
// freq (Hz), is heard by YIN and held, at the octave that sounds closest; and CMA-ES looks for
// the rest by rendering the real code and listening (Meyda, as features~). Levels are compared apart from
// loudness: every render is brought to the target's loudest frame first, so a recording at any level can
// be matched.

import { analyse, matcher } from "../../30-inverse/kairotic/dataset.mjs";
import { cmaes } from "../../32-learn/kairotic/cmaes.mjs";
import { pitchOf, octaveOf } from "../../32-learn/kairotic/pitch.mjs";
import { controls } from "./render.mjs";

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

const peakRms = (y) => { let p = 0; for (let at = 0; at + 2048 <= y.length; at += 1024) { let e = 0; for (let i = 0; i < 2048; i++) e += y[at + i] * y[at + i]; p = Math.max(p, Math.sqrt(e / 2048)); } return p; };
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

// fit(Meyda, render, json, target, opts) → { values, u, fx, f0, start, pitch, history, bank }
//   render(values, {dur, gate}) → samples; target: samples (at 44.1 kHz, dur seconds)
//   opts: bank (random settings rendered first), budget (renders for the search), seed, dur, gate,
//         start (a guess in [0, 1] to begin from instead of the nearest), onProgress(phase, done, total, best)
export function fit(Meyda, render, json, target, { bank = 64, budget = 300, seed = 1, dur = 1.0, gate = 0.65, start = null, holdPitch = true, onProgress = () => {} } = {}) {
  const cs = sliders(json);
  if (!cs.length) throw new Error("this code has no sliders to look for");
  const ref = peakRms(target);
  if (!(ref > 1e-4)) throw new Error("the target is silent");
  const ft = analyse(Meyda, target);
  const play = (u) => heard(Meyda, render(valuesOf(cs, u), { dur, gate }), ref);
  // 1. a bank of random settings: the distance's statistics, and the nearest as a first guess
  const r = rng(seed), B = [];
  for (let k = 0; k < bank; k++) {
    const u = cs.map(() => r());
    B.push({ u, f: play(u) });
    onProgress("bank", k + 1, bank);
  }
  const m = matcher(B);
  const tq = m.vec(ft), dist = (u) => m.dist(m.vec(play(u)), tq);
  let s0 = start ? start.slice() : m.nearest(ft).example.u.slice();
  // 2. the pitch, heard apart and held
  const ps = holdPitch ? pitchSlider(cs) : null;
  let pitch = null, fixed = null;
  if (ps) {
    const yp = pitchOf(target);
    if (yp.midi !== null) {
      const c = cs[ps.index], guess = toValue(c, s0[ps.index]);
      const guessMidi = ps.kind === "midi" ? guess : 69 + 12 * Math.log2(Math.max(1, guess) / 440);
      const lo = ps.kind === "midi" ? c.min : 69 + 12 * Math.log2(Math.max(1, c.min) / 440);
      const hi = ps.kind === "midi" ? c.max : 69 + 12 * Math.log2(Math.max(1, c.max) / 440);
      // YIN's note, at the octave that sounds closest (the guess's, and one below and above: three renders)
      const at = (mid) => fromValue(c, ps.kind === "midi" ? mid : 440 * Math.pow(2, (mid - 69) / 12));
      const base = octaveOf(yp.midi, guessMidi, lo, hi);
      let best = null;
      for (const mid of [base - 12, base, base + 12]) {
        if (mid < lo - 0.5 || mid > hi + 0.5) continue;
        const u = s0.slice(); u[ps.index] = at(mid);
        const d = dist(u);
        if (!best || d < best.d) best = { mid, d };
      }
      pitch = best.mid;
      fixed = at(pitch);
      s0[ps.index] = fixed;
    }
  }
  // 3. the search that listens, over every slider but the one holding the pitch
  const free = cs.map((_, i) => i).filter((i) => !(fixed !== null && i === ps.index));
  const full = (v) => { const u = s0.slice(); free.forEach((i, k) => { u[i] = v[k]; }); return u; };
  let evals = 0;
  const res = cmaes((v) => { const d = dist(full(v)); evals++; return d; }, free.map((i) => s0[i]), { budget, seed: seed + 2,
    onStep: (best, n) => onProgress("search", n, budget, best.fx) });
  let u = full(res.x), fx = res.fx;
  // the octave again, now that the rest is found (two renders): a filtered note can sound closest an
  // octave away with the first guess's timbre, not with its own
  if (fixed !== null) {
    const c = cs[ps.index], at = (mid) => fromValue(c, ps.kind === "midi" ? mid : 440 * Math.pow(2, (mid - 69) / 12));
    const lo = ps.kind === "midi" ? c.min : 69 + 12 * Math.log2(Math.max(1, c.min) / 440);
    const hi = ps.kind === "midi" ? c.max : 69 + 12 * Math.log2(Math.max(1, c.max) / 440);
    for (const mid of [pitch - 12, pitch + 12]) {
      if (mid < lo - 0.5 || mid > hi + 0.5) continue;
      const v = u.slice(); v[ps.index] = at(mid);
      const d = dist(v);
      if (d < fx) { u = v; fx = d; pitch = mid; }
    }
  }
  return { values: valuesOf(cs, u), u, fx, f0: res.history[0][1], start: s0, pitch, history: res.history, bank: B.length,
    sliders: cs, nearestFx: dist(m.nearest(ft).example.u) };
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
