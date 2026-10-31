// Study 30 · from patches to descriptors (the dataset) and back (a first, naive inverse).
//
// Meyda is passed in rather than imported, so the same code runs in the page (Meyda from jsDelivr), in a
// worker and in Node (Meyda from npm). The analysis is the one features~ does in @kairotic/analysis:
// frames of 2048 samples, the same descriptors, centroid in Hz: what a model learns here is what it will
// be given in a patch.

import { PARAMS, SR, render, rng } from "./synth.mjs";

export const MEYDA = "5.6.3";
export const SIZE = 2048;  // as features~
export const HOP = 1024;   // ≈ 23 ms at 44.1 kHz (features~ hops 20 ms by default)
export const FEATURES = ["rms", "spectralCentroid", "spectralFlatness", "spectralRolloff", "zcr", "mfcc"];
// one column per number: the 13 MFCCs unrolled
export const DIMS = ["rms", "centroid", "flatness", "rolloff", "zcr"].concat(
  Array.from({ length: 13 }, (_, i) => "mfcc" + i));

// ── sampling: where in the parameter space the patches are drawn ──
// uniform: every corner equally likely (mostly noise and clicks); plausible: leaned toward what a person
// would set (little noise, gentle resonance, short attacks), still covering the whole space.
const LEAN = { noise: 3, resonance: 2, attack: 2, envamt: 1.5 };
export function draw(rnd, mode) {
  return PARAMS.map((p) => {
    const u = rnd();
    return mode === "plausible" && LEAN[p.key] ? Math.pow(u, LEAN[p.key]) : u;
  });
}

// ── analysis ──
const fin = (x) => (typeof x === "number" && isFinite(x) ? x : 0);
export function analyse(Meyda, y, sr = SR) {
  Meyda.bufferSize = SIZE;
  Meyda.sampleRate = sr;
  Meyda.numberOfMFCCCoefficients = 13;
  const frames = [];
  for (let i = 0; i + SIZE <= y.length; i += HOP) {
    const r = Meyda.extract(FEATURES, y.subarray(i, i + SIZE));
    const silent = !(r.rms > 1e-5);
    // a silent frame has no centroid or flatness, and Meyda puts its rolloff at the top: all three 0
    frames.push([
      fin(r.rms),
      silent ? 0 : fin(r.spectralCentroid) * sr / SIZE,
      silent ? 0 : fin(r.spectralFlatness),
      silent ? 0 : fin(r.spectralRolloff),
      fin(r.zcr)
    ].concat(Array.from(r.mfcc || [], fin)));
  }
  return frames;
}

const round = (x) => +x.toPrecision(5);

// one example: a patch drawn at random, rendered, analysed
export function example(Meyda, seed, mode) {
  const rnd = rng(seed);
  const u = draw(rnd, mode);
  const f = analyse(Meyda, render(u, seed));
  return { seed, u: u.map(round), f: f.map((row) => row.map(round)) };
}

export function header(mode, seed, n) {
  return {
    kairotic: "study-30-inverse",
    synth: { sr: SR, params: PARAMS, render: "synth.mjs" },
    analysis: { meyda: MEYDA, size: SIZE, hop: HOP, features: FEATURES, dims: DIMS },
    sampling: { mode, seed, n }
  };
}

// ── a first inverse: the nearest neighbour ──
// No learning yet: the patch of the training example whose descriptors are closest. It is the baseline
// any model has to beat, and it already shows the problem: close descriptors, sometimes distant patches.

// descriptors as the distance sees them: Hz and level on a log scale, then every column standardised
const shape = (row) => row.map((x, j) =>
  j === 0 ? Math.log10(x + 1e-4) : j === 1 || j === 3 ? Math.log2(1 + x) : x);

export function matcher(train) {
  const D = DIMS.length;
  const mu = new Float64Array(D), sd = new Float64Array(D);
  let count = 0;
  for (const e of train) for (const row of e.f) { const s = shape(row); for (let j = 0; j < D; j++) mu[j] += s[j]; count++; }
  for (let j = 0; j < D; j++) mu[j] /= count || 1;
  for (const e of train) for (const row of e.f) { const s = shape(row); for (let j = 0; j < D; j++) sd[j] += (s[j] - mu[j]) ** 2; }
  for (let j = 0; j < D; j++) sd[j] = Math.sqrt(sd[j] / (count || 1)) || 1;
  const vec = (f) => {
    const out = new Float32Array(f.length * D);
    f.forEach((row, t) => shape(row).forEach((x, j) => { out[t * D + j] = (x - mu[j]) / sd[j]; }));
    return out;
  };
  const bank = train.map((e) => vec(e.f));
  // distance per number, so it reads the same whatever the number of frames
  const dist = (a, b) => {
    let s = 0;
    const m = Math.min(a.length, b.length);
    for (let i = 0; i < m; i++) s += (a[i] - b[i]) ** 2;
    return Math.sqrt(s / m);
  };
  return {
    vec, dist,
    nearest(f, skip) {
      const q = vec(f);
      let best = -1, bd = Infinity;
      bank.forEach((b, i) => { if (i === skip) return; const d = dist(q, b); if (d < bd) { bd = d; best = i; } });
      return { index: best, distance: bd, example: train[best] };
    }
  };
}

// how far two patches are, as the mean distance of their parameters in [0, 1]
export function paramError(a, b) {
  return a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / a.length;
}

// the whole test set against the bank: the nearest neighbour, and a random pick for comparison
export function evaluate(train, test, seed = 7) {
  const m = matcher(train), rnd = rng(seed);
  let pe = 0, fe = 0, rpe = 0, rfe = 0;
  const perParam = new Float64Array(PARAMS.length);
  for (const e of test) {
    const hit = m.nearest(e.f);
    pe += paramError(e.u, hit.example.u);
    fe += hit.distance;
    hit.example.u.forEach((x, i) => { perParam[i] += Math.abs(x - e.u[i]); });
    const r = train[Math.floor(rnd() * train.length)];
    rpe += paramError(e.u, r.u);
    rfe += m.dist(m.vec(e.f), m.vec(r.f));
  }
  const n = test.length || 1;
  return {
    nearest: { param: pe / n, features: fe / n },
    random: { param: rpe / n, features: rfe / n },
    perParam: PARAMS.map((p, i) => ({ key: p.key, error: perParam[i] / n }))
  };
}
