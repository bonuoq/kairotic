// SPDX-License-Identifier: MPL-2.0
// @kairotic/faust-units · listening as features~ and pitch~ do (discussion #114, Studies 30 and 32).
//
// analyse: Meyda (passed in, so the same code runs in the page, a worker or Node) on frames of 2048
// samples hopping 1024: rms, centroid (Hz), flatness, rolloff, zcr and 13 MFCCs. matcher: a distance
// between two such analyses, each number shaped (levels and Hz on a log scale) and standardised by a bank.
// pitchOf: YIN as pitch~ (window 1024, threshold 0.15, 60–1500 Hz), the median of up to 12 windows.

export const SR = 44100, SIZE = 2048, HOP = 1024;
const FEATURES = ["rms", "spectralCentroid", "spectralFlatness", "spectralRolloff", "zcr", "mfcc"];
const D = 18;   // rms centroid flatness rolloff zcr + 13 MFCCs

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

// descriptors as the distance sees them: Hz and level on a log scale, then every column standardised
const shape = (row) => row.map((x, j) =>
  j === 0 ? Math.log10(x + 1e-4) : j === 1 || j === 3 ? Math.log2(1 + x) : x);

export function matcher(train) {
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

// the loudest frame's rms
export const peakRms = (y) => { let p = 0; for (let at = 0; at + SIZE <= y.length; at += HOP) { let e = 0; for (let i = 0; i < SIZE; i++) e += y[at + i] * y[at + i]; p = Math.max(p, Math.sqrt(e / SIZE)); } return p; };

// YIN's window and hop
const YW = 1024, YHOP = 512;

// YIN on one window starting at `at`: [hz, clarity] (hz 0 when no dip falls under the threshold)
function yin(x, at, sr, lo, hi, th, d) {
  const T = Math.min(d.length - 2, Math.ceil(sr / lo) + 1), tmin = Math.max(2, Math.floor(sr / hi));
  d[0] = 1;
  let run = 0, best = -1;
  for (let tau = 1; tau <= T; tau++) {
    let s = 0;
    for (let i = 0; i < YW; i++) { const v = x[at + i] - x[at + i + tau]; s += v * v; }
    run += s;
    d[tau] = run > 0 ? (s * tau) / run : 1;
    if (tau - 1 >= tmin && d[tau - 1] < th && d[tau] >= d[tau - 1]) { best = tau - 1; break; }
  }
  if (best < 0) return [0, 0];
  const a = d[best - 1], b = d[best], c = d[best + 1] ?? b, den = a - 2 * b + c;
  const t = den ? best + (0.5 * (a - c)) / den : best;
  return [sr / t, Math.max(0, 1 - b)];
}

// the pitch of a note: the median MIDI pitch of its sounding, clearly periodic windows, and how sure it is
// (the share of sounding windows that had a pitch). { midi, hz, sure } or { midi: null } (noise, silence)
export function pitchOf(x, sr = 44100, { lo = 60, hi = 1500, th = 0.15, most = 12 } = {}) {
  const T = Math.ceil(sr / lo) + 2, d = new Float32Array(T + 2), wins = [];
  let peak = 0;
  for (let at = 0; at + YW + T < x.length; at += YHOP) {
    let e = 0;
    for (let i = 0; i < YW; i++) e += x[at + i] * x[at + i];
    wins.push([at, Math.sqrt(e / YW)]);
    peak = Math.max(peak, Math.sqrt(e / YW));
  }
  const all = wins.filter(([, r]) => r > 0.1 * peak && r > 1e-3);
  // at most `most` of them, spread over the note: enough for a median, and quick
  const step = Math.max(1, all.length / most), sounding = [];
  for (let k = 0; k < all.length && sounding.length < most; k += step) sounding.push(all[Math.floor(k)]);
  const ms = [];
  for (const [at] of sounding) {
    const [hz] = yin(x, at, sr, lo, hi, th, d);
    if (hz > 0) ms.push(69 + 12 * Math.log2(hz / 440));
  }
  if (!sounding.length || ms.length < Math.max(2, 0.3 * sounding.length)) return { midi: null, hz: 0, sure: sounding.length ? ms.length / sounding.length : 0 };
  ms.sort((a, b) => a - b);
  const midi = ms[ms.length >> 1];
  return { midi, hz: 440 * Math.pow(2, (midi - 69) / 12), sure: ms.length / sounding.length };
}

// the octave: YIN's pitch class, at the register a rough guess (the network's) points to
export function octaveOf(yinMidi, guessMidi, lo = 36, hi = 84) {
  let m = yinMidi + 12 * Math.round((guessMidi - yinMidi) / 12);
  while (m < lo - 0.5) m += 12;
  while (m > hi + 0.5) m -= 12;
  return m;
}
