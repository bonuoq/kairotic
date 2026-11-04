// Study 37 · descriptors as notation (discussion #114): a few curves over time — pitch, loudness, brightness,
// noisiness — written as a score, and a faust~ that realises them.
//
// The curves are what features~ and pitch~ hear, frame by frame (Meyda on 2048 samples hopping 1024, YIN on
// 1024): so a recording can be read into the same lanes and written again by another voice. The realiser
// does the inverse frame by frame, for any faust~ whose sliders it can name: `pitch` (MIDI) or `freq` (Hz)
// takes the pitch lane directly, `gain` (dB) the loudness, and the other sliders are the timbre, chosen so
// the brightness and the noisiness come out as written. How: a bank of steady settings of the code, rendered
// and heard (each with its pitch); for each frame the nearest settings in (pitch, brightness, noisiness),
// blended; the gain made up from the level that blend had in the bank. Then it listens to what it played and
// corrects what it asks for, frame by frame, where it missed (iterative learning control), a few times.

import { analyse } from "../../30-inverse/kairotic/dataset.mjs";
import { controls } from "../../35-recipe/kairotic/render.mjs";
import { sliders, toValue, pitchSlider } from "../../35-recipe/kairotic/fit.mjs";

export const SR = 44100, SIZE = 2048, HOP = 1024, FPS = SR / HOP;

// the lanes of the score: what each means, its range and its scale
export const LANES = [
  { key: "pitch", name: "pitch", unit: "MIDI", lo: 36, hi: 84, doc: "the note YIN hears (pitch~)" },
  { key: "loud", name: "loudness", unit: "dB", lo: -60, hi: 0, doc: "the level of each frame (rms)" },
  { key: "bright", name: "brightness", unit: "Hz", lo: 100, hi: 8000, log: true, doc: "the spectral centroid" },
  { key: "noisy", name: "noisiness", unit: "", lo: 0, hi: 1, doc: "the spectral flatness: 0 a tone, 1 noise" }
];
const SILENT = -50;   // dB: below it a frame has no pitch, brightness nor noisiness worth writing

// ───────── listening: a sound → its curves ─────────

// YIN on one window (as pitch~: threshold 0.15, 60–1500 Hz, the dip refined by a parabola): Hz or 0
function yin(x, at, W, sr, d) {
  const lo = 60, hi = 1500, th = 0.15, T = Math.min(d.length - 2, Math.ceil(sr / lo) + 1), tmin = Math.max(2, Math.floor(sr / hi));
  if (at + W + T >= x.length) return 0;
  d[0] = 1;
  let run = 0, best = -1;
  for (let tau = 1; tau <= T; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const v = x[at + i] - x[at + i + tau]; s += v * v; }
    run += s;
    d[tau] = run > 0 ? (s * tau) / run : 1;
    if (tau - 1 >= tmin && d[tau - 1] < th && d[tau] >= d[tau - 1]) { best = tau - 1; break; }
  }
  if (best < 0) return 0;
  const a = d[best - 1], b = d[best], c = d[best + 1] ?? b, den = a - 2 * b + c;
  return sr / (den ? best + (0.5 * (a - c)) / den : best);
}

// curves(Meyda, y) → { n, pitch, loud, bright, noisy }: one value a frame, null where there is nothing to
// write (no pitch heard; brightness and noisiness of a silent frame)
export function curves(Meyda, y, sr = SR) {
  const f = analyse(Meyda, y, sr), n = f.length, d = new Float32Array(Math.ceil(sr / 60) + 4);
  const out = { n, pitch: [], loud: [], bright: [], noisy: [] };
  for (let i = 0; i < n; i++) {
    const [, centroid, flatness] = f[i];
    // the level of the frame as it is (Meyda's rms is of the frame through its window, about 4 dB less)
    let e = 0;
    for (let k = i * HOP; k < i * HOP + SIZE; k++) e += y[k] * y[k];
    const loud = 10 * Math.log10(Math.max(e / SIZE, 1e-10)), on = loud > SILENT;
    const hz = on ? yin(y, i * HOP + 512, 1024, sr, d) : 0;
    out.loud.push(Math.max(-80, loud));
    out.bright.push(on && centroid > 0 ? centroid : null);
    out.noisy.push(on ? flatness : null);
    out.pitch.push(hz > 0 ? 69 + 12 * Math.log2(hz / 440) : null);
  }
  // a pitch heard in one frame alone, between frames without, is a slip of YIN: left out
  for (let i = 0; i < n; i++)
    if (out.pitch[i] !== null && out.pitch[i - 1] == null && out.pitch[i + 1] == null) out.pitch[i] = null;
  return out;
}

// ───────── playing: a faust~ whose sliders move frame by frame ─────────

const MATH = {
  fmod: (a, b) => a % b, remainder: (a, b) => a - Math.round(a / b) * b, rint: Math.round, round: Math.round,
  isnan: (x) => (Number.isNaN(x) ? 1 : 0), isinf: (x) => (Number.isFinite(x) || Number.isNaN(x) ? 0 : 1),
  copysign: (a, b) => Math.sign(b || 1) * Math.abs(a), exp10: (x) => Math.pow(10, x), log10: Math.log10
};
function imports(module) {
  const env = {};
  for (const imp of WebAssembly.Module.imports(module)) {
    if (imp.kind === "function") {
      const nm = imp.name.replace(/^_+/, "").replace(/f$/, "");
      env[imp.name] = MATH[nm] || Math[nm] || Math[imp.name.replace(/^_+/, "")] || (() => 0);
    } else if (imp.kind === "global") env[imp.name] = new WebAssembly.Global({ value: "i32", mutable: false }, 0);
    else if (imp.kind === "memory") env[imp.name] = new WebAssembly.Memory({ initial: 16 });
    else if (imp.kind === "table") env[imp.name] = new WebAssembly.Table({ initial: 0, element: "anyfunc" });
  }
  return { env };
}

// player(code, json) → play(frames) → Float32Array: frames is a list of {label: value}, one a frame of the
// analysis; each frame's values hold at its centre and are drawn in between (the code smooths them too).
// The sound is long enough for the analysis to give back as many frames.
export function player(code, json, { sr = SR, block = 256 } = {}) {
  const module = code instanceof WebAssembly.Module ? code : new WebAssembly.Module(code);
  const ctl = controls(json).filter((c) => c.type !== "button" && c.type !== "checkbox");
  return function play(frames) {
    const ex = new WebAssembly.Instance(module, imports(module)).exports, mem = ex.memory;
    const ni = json.inputs, no = Math.max(1, json.outputs), n = frames.length * HOP + (SIZE - HOP);
    let p = (json.size + 64 + 15) & ~15;
    const ptrIns = p; p += 4 * Math.max(1, ni);
    const ptrOuts = p; p += 4 * no; p = (p + 15) & ~15;
    const need = p + (ni + no) * block * 4 + 1024;
    if (mem.buffer.byteLength < need) mem.grow(Math.ceil((need - mem.buffer.byteLength) / 65536));
    const view = () => new DataView(mem.buffer), bufs = [];
    for (let i = 0; i < ni; i++) { view().setInt32(ptrIns + 4 * i, p, true); p += block * 4; }
    for (let i = 0; i < no; i++) { view().setInt32(ptrOuts + 4 * i, p, true); bufs.push(p); p += block * 4; }
    ex.init(0, sr);
    const y = new Float32Array(n);
    for (let at = 0; at < n; at += block) {
      // the frame whose centre (i·HOP + SIZE/2) this block is at, and how far towards the next
      const pos = Math.max(0, (at + block / 2 - SIZE / 2) / HOP), i = Math.min(frames.length - 1, Math.floor(pos));
      const j = Math.min(frames.length - 1, i + 1), t = Math.min(1, pos - i), a = frames[i], b = frames[j];
      for (const c of ctl) if (c.label in a) ex.setParamValue(0, c.index, a[c.label] + ((b[c.label] ?? a[c.label]) - a[c.label]) * t);
      const k = Math.min(block, n - at);
      ex.compute(0, k, ptrIns, ptrOuts);
      y.set(new Float32Array(mem.buffer, bufs[0], k), at);
    }
    for (let i = 0; i < n; i++) if (!Number.isFinite(y[i])) y[i] = 0;
    return y;
  };
}

// ───────── the realiser ─────────

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
const mean = (xs) => xs.reduce((s, x) => s + x, 0) / (xs.length || 1);

// which slider does what: { cs, pitch: {index, kind} | null, gain: {index, db} | null, timbre: [index…] }
export function roles(json) {
  const cs = sliders(json), ps = pitchSlider(cs);
  const gi = cs.findIndex((c) => /^(gain|level|volume|amp)$/i.test(c.label));
  const gain = gi >= 0 ? { index: gi, db: cs[gi].unit === "dB" || cs[gi].min < 0 } : null;
  const timbre = cs.map((_, i) => i).filter((i) => !(ps && i === ps.index) && i !== gi);
  return { cs, pitch: ps, gain, timbre };
}
const pitchValue = (R, midi) => (R.pitch.kind === "midi" ? midi : 440 * Math.pow(2, (midi - 69) / 12));
const gainValue = (R, dB) => {
  const c = R.cs[R.gain.index], v = R.gain.db ? dB : Math.pow(10, dB / 20);
  return Math.min(c.max, Math.max(c.min, v));
};
// the values of every slider for a timbre (u in [0, 1] for each timbre slider), a pitch and a gain
function valuesFor(R, u, midi, dB) {
  const v = {};
  R.timbre.forEach((i, k) => { v[R.cs[i].label] = toValue(R.cs[i], u[k]); });
  if (R.pitch) v[R.cs[R.pitch.index].label] = pitchValue(R, midi);
  if (R.gain) v[R.cs[R.gain.index].label] = gainValue(R, dB);
  return v;
}

// bank(Meyda, play, json, { n, seed, lo, hi }) → the steady settings of the code, heard: for each, its
// timbre (u), its pitch (drawn between lo and hi), and what it sounds like held at 0 dB: level, brightness
// (as log2 Hz) and noisiness
export function bank(Meyda, play, json, { n = 600, seed = 1, lo = 40, hi = 80, frames = 16, onProgress = () => {} } = {}) {
  const R = roles(json), r = rng(seed), entries = [];
  if (!R.timbre.length) throw new Error("this code has no slider for the timbre (besides pitch and gain)");
  for (let k = 0; k < n; k++) {
    const u = R.timbre.map(() => r()), p = R.pitch ? lo + (hi - lo) * r() : 60;
    const v = valuesFor(R, u, p, 0);
    const c = curves(Meyda, play(Array.from({ length: frames }, () => v)));
    const from = Math.floor(frames * 0.4), rms = [], lb = [], nz = [];
    let voiced = 0;
    for (let i = from; i < c.n; i++) {
      rms.push(Math.pow(10, c.loud[i] / 20));
      if (c.bright[i] !== null) { lb.push(Math.log2(c.bright[i])); nz.push(c.noisy[i]); }
      if (c.pitch[i] !== null && Math.abs(c.pitch[i] - p) < 0.5) voiced++;
    }
    const loud0 = 20 * Math.log10(Math.max(mean(rms), 1e-5));
    // voiced: how much of it YIN hears at its own pitch (a noisy or resonant setting can lose it)
    if (lb.length && loud0 > -70) entries.push({ u, p, loud0, lb: mean(lb), nz: mean(nz), voiced: voiced / (c.n - from) });
    onProgress(k + 1, n);
  }
  const sd = (xs) => { const m = mean(xs); return Math.sqrt(mean(xs.map((x) => (x - m) ** 2))) || 1; };
  return { R, entries, sd: { lb: sd(entries.map((e) => e.lb)), nz: sd(entries.map((e) => e.nz)) },
           range: { lb: [Math.min(...entries.map((e) => e.lb)), Math.max(...entries.map((e) => e.lb))] } };
}

// the nearest settings of the bank to (pitch, log2 brightness, noisiness), blended: { u, loud0, d }; where a
// pitch is written the settings in which YIN would not hear it are farther (voiced: a fourth lane, implied)
function nearest(B, p, lb, nz, voiced, k = 6) {
  const best = [];
  for (const e of B.entries) {
    const d = Math.sqrt((p === null ? 0 : ((p - e.p) / 6) ** 2) + ((lb - e.lb) / B.sd.lb) ** 2 + ((nz - e.nz) / B.sd.nz) ** 2
                        + (voiced ? (2 * (1 - e.voiced)) ** 2 : 0));
    if (best.length < k || d < best[best.length - 1].d) {
      best.push({ e, d }); best.sort((a, b) => a.d - b.d); if (best.length > k) best.pop();
    }
  }
  let W = 0;
  const u = best[0].e.u.map(() => 0);
  let loud0 = 0;
  for (const { e, d } of best) { const w = 1 / (d + 0.05); W += w; e.u.forEach((x, i) => { u[i] += w * x; }); loud0 += w * e.loud0; }
  return { u: u.map((x) => x / W), loud0: loud0 / W, d: best[0].d };
}

// a lane with its gaps filled: each null takes the last value before it (or the first after, at the start)
function held(xs, dflt) {
  const first = xs.find((x) => x !== null && x !== undefined);
  let last = first ?? dflt;
  return xs.map((x) => (x === null || x === undefined ? last : (last = x)));
}

// how far what sounds is from what is written, over the frames written as sounding: loudness in dB,
// brightness in semitones, noisiness in its own units, pitch in cents (where both have one)
export function errors(target, got) {
  const L = [], B = [], N = [], P = [];
  for (let i = 0; i < target.n; i++) {
    if (target.loud[i] === null || target.loud[i] <= SILENT + 5 || i >= got.n) continue;
    L.push(Math.abs(target.loud[i] - got.loud[i]));
    if (target.bright[i] && got.bright[i]) B.push(12 * Math.abs(Math.log2(target.bright[i] / got.bright[i])));
    if (target.noisy[i] !== null && got.noisy[i] !== null) N.push(Math.abs(target.noisy[i] - got.noisy[i]));
    if (target.pitch[i] !== null && got.pitch[i] !== null) P.push(100 * Math.abs(target.pitch[i] - got.pitch[i]));
  }
  const e = { loud: mean(L), bright: mean(B), noisy: mean(N), pitch: P.length ? mean(P) : null, frames: L.length };
  // one number to compare two realisations: each error over what is just noticeable-ish
  e.score = e.loud / 3 + e.bright / 2 + e.noisy / 0.05 + (e.pitch === null ? 0 : e.pitch / 50);
  return e;
}

// the values of every slider, frame by frame, that ask the voice for (pitch, loud, lb, nz) a frame
function controlsFor(B, q) {
  const R = B.R, n = q.loud.length, us = [], gains = [], reach = [];
  for (let i = 0; i < n; i++) {
    const { u, loud0, d } = nearest(B, R.pitch ? q.pitch[i] : null, q.lb[i], q.nz[i], q.voiced[i]);
    us.push(u);
    reach.push(d);
    gains.push(q.loud[i] <= SILENT ? -80 : q.loud[i] - loud0);
  }
  // the timbre moved smoothly: a moving average over 5 frames (≈ 0.1 s), so the nearest settings of two
  // frames side by side do not make it jump
  const sm = us.map((_, i) => {
    const w = us.slice(Math.max(0, i - 2), i + 3);
    return w[0].map((_, k) => mean(w.map((x) => x[k])));
  });
  const frames = sm.map((u, i) => valuesFor(R, u, q.pitch[i], gains[i]));
  frames.reach = reach;
  return frames;
}

// realize(Meyda, play, B, target, { passes }) → { frames (slider values), y, got, err, passes: [err…] }
//   target: curves (as curves() gives, or drawn): pitch in MIDI, loud in dB, bright in Hz, noisy 0…1
export function realize(Meyda, play, B, target, { passes = 3, onPass = () => {} } = {}) {
  const n = target.n, [lbLo, lbHi] = B.range.lb;
  const want = {
    pitch: held(target.pitch, 60),
    loud: target.loud.map((x) => (x === null ? -80 : x)),
    lb: held(target.bright.map((x) => (x ? Math.log2(x) : null)), 10),
    nz: held(target.noisy, 0.05),
    voiced: target.pitch.map((x) => x !== null)
  };
  const q = { pitch: want.pitch.slice(), loud: want.loud.slice(), lb: want.lb.slice(), nz: want.nz.slice(), voiced: want.voiced };
  let best = null, reach = null;
  const history = [];
  for (let pass = 0; pass < passes; pass++) {
    const frames = controlsFor(B, q), y = play(frames), got = curves(Meyda, y), err = errors(target, got);
    history.push(err);
    onPass(pass + 1, passes, err);
    // reach: how far, in the bank's spread, the nearest setting is from what was asked first (above ~1.5
    // the voice cannot make that combination: noise that is also dark, say)
    if (pass === 0) reach = frames.reach;
    if (!best || err.score < best.err.score) best = { frames, y, got, err };
    // what to ask next: where it came out too dark, ask for brighter by as much (and so on), within what
    // the bank can give
    for (let i = 0; i < n && i < got.n; i++) {
      if (want.loud[i] <= SILENT) continue;
      q.loud[i] = Math.min(want.loud[i] + 24, Math.max(want.loud[i] - 24, q.loud[i] + (want.loud[i] - got.loud[i])));
      if (got.bright[i]) q.lb[i] = Math.min(lbHi, Math.max(lbLo, q.lb[i] + 0.8 * (want.lb[i] - Math.log2(got.bright[i]))));
      if (got.noisy[i] !== null) q.nz[i] = Math.min(1, Math.max(0, q.nz[i] + 0.8 * (want.nz[i] - got.noisy[i])));
    }
  }
  return Object.assign(best, { passes: history, reach });
}

// the same voice held still at the mean of what is written: what following the curves is worth against
export function constant(Meyda, play, B, target) {
  const sounding = (xs) => xs.filter((x, i) => x !== null && target.loud[i] > SILENT);
  const m = (xs, d) => (xs.length ? mean(xs) : d);
  const pitch = m(sounding(target.pitch), 60), loud = m(sounding(target.loud), -20);
  const lb = m(sounding(target.bright).map(Math.log2), 10), nz = m(sounding(target.noisy), 0.05);
  const n = target.n, all = (v) => Array.from({ length: n }, () => v);
  const q = { pitch: all(pitch), loud: target.loud.map((x) => (x > SILENT ? loud : -80)), lb: all(lb), nz: all(nz),
              voiced: all(sounding(target.pitch).length > 0) };
  const y = play(controlsFor(B, q)), got = curves(Meyda, y);
  return { y, got, err: errors(target, got) };
}

// ───────── writing: curves drawn as breakpoints → one value a frame ─────────

// lane points [[seconds, value] …] (sorted; a null value is a rest) → one value a frame, straight lines
// between points, a log scale for brightness; nothing before the first point nor after the last
export function sample(points, n, log = false) {
  const out = new Array(n).fill(null);
  if (!points || !points.length) return out;
  for (let i = 0; i < n; i++) {
    const t = (i * HOP + SIZE / 2) / SR;
    if (t < points[0][0] || t > points[points.length - 1][0]) continue;
    let k = 0;
    while (k < points.length - 2 && points[k + 1][0] < t) k++;
    const [t0, v0] = points[k], [t1, v1] = points[Math.min(k + 1, points.length - 1)];
    if (v0 === null || v1 === null) { out[i] = t - t0 < t1 - t ? v0 : v1; continue; }
    const a = t1 > t0 ? (t - t0) / (t1 - t0) : 0;
    out[i] = log ? Math.exp(Math.log(v0) + a * (Math.log(v1) - Math.log(v0))) : v0 + a * (v1 - v0);
  }
  return out;
}

// a score (one list of points per lane, seconds long) → curves, as realize takes them
export function score(lanes, seconds) {
  const n = Math.max(1, Math.floor((seconds * SR - SIZE) / HOP) + 1);
  const loud = sample(lanes.loud, n).map((x) => (x === null ? -80 : x));
  const on = (xs) => xs.map((x, i) => (loud[i] > SILENT ? x : null));
  return { n, pitch: on(sample(lanes.pitch, n)), loud, bright: on(sample(lanes.bright, n, true)), noisy: on(sample(lanes.noisy, n)) };
}

// a few scores to begin with
export const PRESETS = {
  swell: { name: "swell", seconds: 4, lanes: {
    pitch: [[0, 55], [4, 55]], loud: [[0, -60], [1.8, -8], [3.4, -14], [4, -60]],
    bright: [[0, 300], [1.8, 3500], [4, 400]], noisy: [[0, 0.02], [4, 0.02]] } },
  breath: { name: "breath", seconds: 4, lanes: {
    pitch: [[0, 62], [4, 62]], loud: [[0, -50], [0.3, -18], [3.6, -18], [4, -60]],
    bright: [[0, 1500], [4, 1500]], noisy: [[0, 0.01], [1, 0.01], [2.2, 0.35], [3, 0.01], [4, 0.01]] } },
  glide: { name: "glide", seconds: 4, lanes: {
    pitch: [[0, 48], [1, 48], [2.6, 67], [4, 64]], loud: [[0, -55], [0.2, -12], [3.7, -16], [4, -60]],
    bright: [[0, 800], [2.6, 2500], [4, 1200]], noisy: [[0, 0.02], [4, 0.02]] } },
  phrase: { name: "phrase", seconds: 5, lanes: {
    pitch: [[0, 60], [0.9, 60], [1, 64], [1.9, 64], [2, 67], [3.4, 67], [3.5, 72], [5, 72]],
    loud: [[0, -60], [0.08, -10], [0.9, -20], [1, -10], [1.9, -20], [2, -8], [3.4, -22], [3.5, -6], [4.6, -30], [5, -60]],
    bright: [[0, 2500], [0.9, 900], [1, 2500], [1.9, 900], [2, 3000], [3.4, 800], [3.5, 3500], [5, 600]],
    noisy: [[0, 0.05], [5, 0.01]] } }
};
