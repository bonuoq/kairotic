// SPDX-License-Identifier: MPL-2.0
// @kairotic/faust-units · what a faust~ can sound like, heard, so descriptors can be written to it
// (discussion #114, Study 37): the bank realize~ (in @kairotic/analysis) learns.
//
// Its sliders: `pitch` (MIDI) or `freq` (Hz) follows a pitch, `gain` (dB, or a linear level) a loudness, and
// the others are its timbre. learn() plays steady settings of it offline — the timbre drawn at random, a
// pitch in its range, the gain at 0 dB — and listens to each as features~ and pitch~ do: its level, its
// brightness (spectral centroid, as log2 Hz), its noisiness (spectral flatness) and how much of it YIN hears
// at its own pitch. A frame of a score is then played by the settings nearest to it (realize~ does that).
// It runs in the page a moment at a time and stops when its signal is aborted.
//
//   const bank = await learn({ module, json, Meyda, n: 300 });
//   bank → { pitch: {label, kind} | null, gain: {label, db, min, max} | null, timbre: [{label, min, max, log}],
//            entries: [[pitch, lb, nz, voiced, loud0, u0, u1, …] …], sd: [lb, nz], n }

import { renderer } from "./render.mjs";
import { analyse, pitchOf, SIZE, HOP } from "./listen.mjs";
import { sliders, pitchSlider, toValue } from "./recipe.mjs";

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);
const stopped = () => Object.assign(new Error("stopped"), { name: "AbortError" });
const now = () => (typeof performance !== "undefined" ? performance.now() : Date.now());

// which slider does what
export function roles(json) {
  const cs = sliders(json), ps = pitchSlider(cs);
  const gi = cs.findIndex((c) => /^(gain|level|volume|amp)$/i.test(c.label));
  const timbre = cs.map((_, i) => i).filter((i) => !(ps && i === ps.index) && i !== gi);
  return { cs, ps, gi, timbre };
}

// what one steady setting sounds like: [level dB, log2 brightness, noisiness, voiced] or null if silent
function heard(Meyda, y, midi) {
  const f = analyse(Meyda, y), from = Math.floor(f.length * 0.4), lb = [], nz = [];
  let e = 0, k = 0;
  for (let i = from; i < f.length; i++) {
    for (let j = i * HOP; j < i * HOP + SIZE; j++) e += y[j] * y[j];
    k += SIZE;
    if (f[i][1] > 0) { lb.push(Math.log2(f[i][1])); nz.push(f[i][2]); }
  }
  const loud = 10 * Math.log10(Math.max(e / (k || 1), 1e-10));
  if (!lb.length || loud < -70) return null;
  const p = pitchOf(y.subarray(Math.floor(y.length * 0.4)));
  const voiced = p.midi !== null && (midi === null || Math.abs(p.midi - midi) < 0.5) ? p.sure : 0;
  return [loud, mean(lb), mean(nz), voiced];
}

export async function learn({ module, json, Meyda, n = 300, seed = 3, dur = 0.4, signal = null, slice = 25, onProgress = () => {} }) {
  const R = roles(json);
  if (!R.timbre.length) throw new Error("the faust~ has no slider for the timbre (besides pitch and gain)");
  const render = renderer(module, json), r = rng(seed), entries = [];
  const pc = R.ps ? R.cs[R.ps.index] : null;
  const toMidi = (v) => (R.ps.kind === "midi" ? v : 69 + 12 * Math.log2(Math.max(1, v) / 440));
  const fromMidi = (m) => (R.ps.kind === "midi" ? m : 440 * Math.pow(2, (m - 69) / 12));
  const lo = pc ? Math.max(24, toMidi(pc.min)) : 60, hi = pc ? Math.min(96, toMidi(pc.max)) : 60;
  const gc = R.gi >= 0 ? R.cs[R.gi] : null, gdb = gc ? gc.unit === "dB" || gc.min < 0 : false;
  let t0 = now();
  for (let k = 0; k < n; k++) {
    if (signal && signal.aborted) throw stopped();
    const u = R.timbre.map(() => r()), midi = pc ? lo + (hi - lo) * r() : null, v = {};
    R.timbre.forEach((i, j) => { v[R.cs[i].label] = toValue(R.cs[i], u[j]); });
    if (pc) v[pc.label] = fromMidi(midi);
    if (gc) v[gc.label] = gdb ? Math.min(gc.max, Math.max(gc.min, 0)) : Math.min(gc.max, Math.max(gc.min, 1));
    const h = heard(Meyda, render(v, { dur, gate: dur + 1 }), midi);
    if (h) entries.push([pc ? midi : 60, h[1], h[2], h[3], h[0], ...u]);
    onProgress(k + 1, n);
    if (now() - t0 > slice) { await new Promise((ok) => setTimeout(ok, 0)); t0 = now(); }
  }
  if (entries.length < 8) throw new Error("the faust~ hardly sounds: " + entries.length + " of " + n + " settings were heard");
  const sd = (j) => { const xs = entries.map((e) => e[j]), m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) || 1; };
  const slim = (c) => ({ label: c.label, min: c.min, max: c.max, log: c.scale === "log" && c.min > 0 && c.max > c.min, step: c.step });
  return {
    pitch: pc ? { label: pc.label, kind: R.ps.kind, min: pc.min, max: pc.max } : null,
    gain: gc ? { label: gc.label, db: gdb, min: gc.min, max: gc.max } : null,
    timbre: R.timbre.map((i) => slim(R.cs[i])),
    entries: entries.map((e) => e.map((x) => +x.toPrecision(5))),
    sd: [sd(1), sd(2)],
    n
  };
}

// what api/import-module gives the page (it takes a module's default export)
export default { learn, roles };
