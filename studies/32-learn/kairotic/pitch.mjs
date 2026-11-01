// Study 32 · the pitch of a sound, by YIN, apart from its timbre (discussion #114).
//
// A descriptor distance such as Meyda's gives a search almost no sense of which way the pitch lies (an
// octave or a harmonic away can look close; Engel et al. 2020, "Self-supervised pitch detection by inverse
// audio synthesis", found the same for spectral losses), and the network guessed it worst of all. So the
// pitch is heard apart, as pitch~ hears it (packages/analysis/src/pitch.cljs: the same YIN, window 1024,
// threshold 0.15, 60–1500 Hz, the dip refined by a parabola), and then given to the network as an input and
// held fixed while the search looks for the timbre.

const W = 1024, HOP = 512;

// YIN on one window starting at `at`: [hz, clarity] (hz 0 when no dip falls under the threshold)
function yin(x, at, sr, lo, hi, th, d) {
  const T = Math.min(d.length - 2, Math.ceil(sr / lo) + 1), tmin = Math.max(2, Math.floor(sr / hi));
  d[0] = 1;
  let run = 0, best = -1;
  for (let tau = 1; tau <= T; tau++) {
    let s = 0;
    for (let i = 0; i < W; i++) { const v = x[at + i] - x[at + i + tau]; s += v * v; }
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
  for (let at = 0; at + W + T < x.length; at += HOP) {
    let e = 0;
    for (let i = 0; i < W; i++) e += x[at + i] * x[at + i];
    wins.push([at, Math.sqrt(e / W)]);
    peak = Math.max(peak, Math.sqrt(e / W));
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
