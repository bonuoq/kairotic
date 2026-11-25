// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 63 · bridges: the outer voices of a chorale phrase, from its first chord to its last (discussions
// #399, #353, the chorale test).
//
// A chorale phrase's soprano and bass drawn together, unit by unit, from chord A to chord B: a bridge (as this study's
// bridgeVoice) whose states are pairs (soprano, bass), exact for every cost that looks one unit back. The engine
// (@kairotic/rules' fromOuter, chorale-4) then writes the alto and the tenor. Its layers, each on or off, for the
// blind test (#399):
//
//   the rules      always: the two voices consonant on every unit (3rds, 6ths, 5ths, octaves — a 4th only as a
//                  6/4 on a strong unit before the cadence's dominant), no parallel or direct 5ths and octaves, no
//                  melodic tritone or 7th, the soprano's leaps a 6th at most (an octave too), the bass's an octave;
//                  the soprano above the bass by a 3rd to two octaves and a 5th; each voice in its range; the ends A
//                  and B pinned; the scale of the key, minor's 6th and 7th both ways, a raised ④ and a lowered ⑦
//                  for the applied dominants
//   the line       always: each voice's move as often as Bach's (BACH_OUTER_MOTION: the soprano keeping its note a
//                  fifth of the time, the bass leaping a 3rd or more nearly half), similar and contrary motion alike; the cadence's
//                  bass ⑤–① or ⑦–① (a half cadence ending on ⑤), as the chorale's B asks
//   functions      the chord the two voices imply (functions.mjs' impliedChord), and a succession the grammar of a
//                  tonal phrase refuses (D → S, an applied dominant unresolved) weighing `functions` more
//   tension        each unit's chord as far from the tonic (tension.mjs, Lerdahl's global tension) as the
//                  corpus's profile asks (PROFILE: Bach's mean tension by tenth of a phrase, read in the cadence's key
//                  — a plateau released at the cadence): the shape the chorales have, not each phrase's own curve, so
//                  nothing of the phrase leaks into its bridge; `target: "arch"` follows a generic arch instead (rising
//                  to a peak two thirds of the way, released into B), the variant the blind test compares
//   economy        the voices' motion together as a word (bits.mjs: "m|s,b", their steps in degrees), one said before cheaper
//                  — in the forward draw only (the line's memory), as this study's figure economy
//
// Pure data and functions.

import { impliedChord, functionOf, grammarErrors, relatedKeys, localFunctions } from "./functions.mjs";
import { placed, distance, tonicOf, surface } from "./tension.mjs";
import { lexicon, economyOf } from "./bits.mjs";

const mod = (a, m) => ((a % m) + m) % m;
const LOG0 = -Infinity;
const lse = (a, b) => (a === LOG0 ? b : b === LOG0 ? a : Math.max(a, b) + Math.log1p(Math.exp(-Math.abs(a - b))));
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const TONICS = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const tonicPc = (key) => TONICS[String(key.tonic || "C").replace("♯", "#").replace("♭", "b")] ?? 0;
const isMinor = (key) => key.mode === "minor" || key.mode === "aeolian";

/** The pitch classes a voice may take in the key: its scale, minor's raised 6th and 7th, a raised ④ (V/V) and a
 *  lowered ⑦ (V/IV) for the applied dominants. */
export function pitchesOf(key) {
  const t = tonicPc(key), sc = isMinor(key) ? MINOR : MAJOR, extra = isMinor(key) ? [9, 11, 6] : [6, 10];
  return new Set([...sc, ...extra].map((x) => mod(t + x, 12)));
}
/** A pitch's degree in the key (0 … 6, by letter as the scale has it; an altered note the degree it alters). */
function degreeOf(p, key) {
  const t = tonicPc(key), sc = isMinor(key) ? MINOR : MAJOR, x = mod(p - t, 12);
  let i = 6;
  while (i > 0 && sc[i] > x) i--;
  // (a raised note belongs to the degree below: F♯ to ④ in C; a lowered ⑦ in major is still ⑦)
  return 7 * Math.floor((p - t) / 12) + i;
}

const NAMES = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
/** A key as the corpus writes it ("E minor"), and back. */
export const keyName = (k) => `${String(k.tonic).replace("♯", "#").replace("♭", "b")} ${isMinor(k) ? "minor" : "major"}`;
export const keyOfName = (s) => { const [tonic, mode] = String(s).split(" "); return { tonic, mode: mode || "major" }; };
const sameKey = (x, y) => tonicPc(x) === tonicPc(y) && isMinor(x) === isMinor(y);
const scaleOf = (key) => new Set((isMinor(key) ? MINOR : MAJOR).map((x) => mod(tonicPc(key) + x, 12)));

/** How Bach's phrases move between keys, quarter by quarter (phrases.json's keys, each read against the chorale's key:
 *  "7M" the major key a 5th above, "9m" the relative minor…): the keys a phrase is in more than 1% of the time, and the
 *  counts of each step from one to the next (staying included). In major he tonicizes ii (2m), vi (9m), IV and V; in
 *  minor iv (5m), III, VII and v. */
export const KEY_MOVES = {
  major: { "0M": { "0M": 5489, "7M": 20, "2m": 62, "9m": 71, "5M": 16, "7m": 9 }, "7M": { "0M": 3, "7M": 1126, "2m": 1, "9m": 2, "5M": 2, "7m": 1 },
           "2m": { "0M": 10, "7M": 2, "2m": 350, "9m": 8, "5M": 1, "7m": 4 }, "9m": { "0M": 13, "7M": 2, "2m": 3, "9m": 285, "7m": 2 },
           "5M": { "0M": 5, "7M": 3, "2m": 4, "9m": 1, "5M": 298, "7m": 5 }, "7m": { "0M": 21, "2m": 2, "9m": 3, "7m": 76 } },
  minor: { "0m": { "0m": 3273, "3M": 63, "10M": 21, "5m": 165, "7m": 22, "8M": 5, "10m": 8 }, "3M": { "0m": 129, "3M": 1887, "10M": 4, "5m": 18, "7m": 2, "10m": 5 },
           "10M": { "0m": 32, "3M": 9, "10M": 595, "5m": 5, "7m": 6, "8M": 2, "10m": 1 }, "5m": { "0m": 40, "3M": 5, "5m": 364, "7m": 6, "8M": 1, "10m": 3 },
           "7m": { "0m": 33, "3M": 5, "10M": 4, "5m": 3, "7m": 317, "8M": 1 }, "8M": { "0m": 14, "5m": 14, "8M": 300, "10m": 2 },
           "10m": { "0m": 22, "3M": 3, "5m": 2, "8M": 2, "10m": 77 } },
};
const relOf = (k, home) => mod(tonicPc(k) - tonicPc(home), 12) + (isMinor(k) ? "m" : "M");
const keyOfRel = (rel, home) => ({ tonic: NAMES[mod(tonicPc(home) + parseInt(rel, 10), 12)], mode: rel.endsWith("m") ? "minor" : "major" });

/**
 * The keys a bridge goes through, one a unit: a walk on Bach's own moves between keys (KEY_MOVES), from the key his
 * phrase begins in to the one it ends in (phrases.json's keys at A and B — the ends the bridge is given; nothing of
 * the phrase between), drawn exactly (backward messages). → [key, …] (n of them).
 */
export function keyPathFor(phrase, r = Math.random, { rate = 1 } = {}) {
  const n = phrase.satb.length, home = phrase.key, M = KEY_MOVES[isMinor(home) ? "minor" : "major"];
  const first = phrase.keys ? keyOfName(phrase.keys[0]) : home, last = phrase.keys ? keyOfName(phrase.keys[n - 1]) : home;
  const s0 = relOf(first, home), e = relOf(last, home), h = isMinor(home) ? "0m" : "0M";
  const R = [...new Set([...Object.keys(M), s0, e])];
  // (a key Bach's table lacks: as rare a guest, reached from the chorale's key and back)
  const P = Object.fromEntries(R.map((x) => {
    const row = M[x] ? { ...M[x] } : { [x]: 30, [h]: 5 };
    if (x === h) R.forEach((y) => { if (!M[y]) row[y] = 2; });
    // (each move to another key `rate` times as likely: his quick tonicizations — a chord or two — the corpus's keys,
    // read by scales over whole spans, mostly do not show)
    for (const y of Object.keys(row)) if (y !== x) row[y] *= rate;
    const z = Object.values(row).reduce((a, b) => a + b, 0);
    return [x, Object.fromEntries(Object.entries(row).map(([y, c]) => [y, c / z]))];
  }));
  const beta = Array.from({ length: n }, () => ({}));
  R.forEach((x) => { beta[n - 1][x] = x === e ? 1 : 0; });
  for (let t = n - 2; t >= 0; t--) R.forEach((x) => { let z = 0; for (const [y, p] of Object.entries(P[x])) z += p * (beta[t + 1][y] || 0); beta[t][x] = z; });
  if (!(beta[0][s0] > 0)) return Array.from({ length: n }, (_, t) => (t === n - 1 ? last : first));
  const path = [s0];
  for (let t = 1; t < n; t++) {
    const opts = Object.entries(P[path[t - 1]]).map(([y, p]) => [y, p * (beta[t][y] || 0)]).filter(([, w]) => w > 0);
    let u = r() * opts.reduce((a, [, w]) => a + w, 0), pick = opts[opts.length - 1][0];
    for (const [y, w] of opts) { u -= w; if (u <= 0) { pick = y; break; } }
    path.push(pick);
  }
  // (spelt as the phrase spells its ends where it is one of them)
  return path.map((x, t) => (t === 0 ? first : t === n - 1 ? last : x === s0 ? first : x === e ? last : keyOfRel(x, home)));
}

/** How much likelier than in the corpus's keys a bridge moves to another key: 4, so that its soprano and bass carry a
 *  tonicization's leading tone about as often as Bach's do (in major, per 100 chords: soprano 1.4, Bach 1.1; bass 2.3,
 *  Bach 3.7 — before, 1.2 toward V alone) — the corpus's keys, read by scales over spans, miss his quick ones. */
export const KEY_RATE = 4;
export const RANGES = { soprano: [60, 81], bass: [40, 62] };
const INFO = new Map();
const CONS = new Set([0, 3, 4, 7, 8, 9]);

/** How Bach's soprano and bass move from one quarter to the next in the corpus (phrases.json, 2,272 phrases): −log of the
 *  frequency of a move of 0…12 semitones (13: wider), less the likeliest's — 0 the move he makes most. The soprano
 *  keeps its note 22% of the time, steps 59%, leaps a 3rd 13%; the bass keeps 11%, steps 36%, leaps a 3rd 26%, a 4th
 *  or 5th 22%, an octave 3%. */
export const BACH_OUTER_MOTION = (() => {
  const nl = (a) => { const m = Math.min(...a); return a.map((x) => +(x - m).toFixed(2)); };
  return {
    soprano: nl([1.49, 1.62, 0.93, 2.42, 3.12, 3.24, 8.27, 4.51, 6.83, 8.27, 8.56, 9.66, 8.27, 9.66]),
    bass: nl([2.22, 1.75, 1.7, 1.82, 2.34, 2.14, 4.68, 2.24, 5.29, 5.67, 6.02, 6.48, 3.51, 7.09]),
  };
})();

/** Whether two simultaneous pitches are consonant for the outer voices (a 4th never; a tritone never). */
export const consonant = (s, b) => CONS.has(mod(s - b, 12));

/**
 * The outer voices' bridge for a phrase: {n, key, strong, A: [S, A, T, B], B, layers: {functions, tension, economy}}.
 * → {logZ, possible, draw(r) → {soprano, bass}, best() → {soprano, bass}}.
 */
export function outerBridge(phrase, { layers = {}, temp = 0.4, weights = {}, target = "profile" } = {}) {
  const L = { functions: 6, tension: 2, economy: 1, ...layers };
  const W = { motion: 1, sameChord: 0.2, back: 0.4, similar: 0, inverted: 0.3, chromatic: 0.6, outOfScale: 0.8, tessitura: 0.08, tonicize: 2, natural7: 1.2, ...weights };
  const key = phrase.key, n = phrase.n || (phrase.satb ? phrase.satb.length : 0), strong = phrase.strong || [];
  const T = Math.max(1e-3, temp);
  // (the key of each unit: `unitKeys` where given — a bridge that tonicizes —, the phrase's key otherwise)
  const UK = phrase.unitKeys && phrase.unitKeys.length === n ? phrase.unitKeys : null;
  const Kt = (t) => (UK ? UK[t] : key);
  // (each unit's key, its number, its scale: worked out once)
  const kids = new Map(), KID = Array.from({ length: n }, (_, t) => { const s = keyName(Kt(t)); if (!kids.has(s)) kids.set(s, kids.size); return kids.get(s); });
  const SCALE = Array.from({ length: n }, (_, t) => scaleOf(Kt(t))), KNAME = Array.from({ length: n }, (_, t) => keyName(Kt(t))), homeName = keyName(key);
  const range = (r, pcs) => { const out = []; for (let p = r[0]; p <= r[1]; p++) if (pcs.has(mod(p, 12))) out.push(p); return out; };
  const rangesAt = (t) => { const pcs = pitchesOf(Kt(t)); return [range(RANGES.soprano, pcs), range(RANGES.bass, pcs)]; };
  const a = phrase.A, b = phrase.B;
  // the states of a unit: pairs (s, b) consonant, the soprano above by a 3rd to two octaves and a 5th; the ends pinned
  const statesAt = (t) => {
    if (t === 0) return [[a[0], a[3]]];
    if (t === n - 1) return [[b[0], b[3]]];
    const out = [], [S, Bs] = rangesAt(t);
    for (const s of S) for (const bb of Bs) { const d = s - bb; if (d >= 3 && d <= 31 && consonant(s, bb)) out.push([s, bb]); }
    return out;
  };
  const states = Array.from({ length: n }, (_, t) => statesAt(t));
  // the chord each state implies, its function and its tension (memoized by pitches)
  const memo = new Map();
  // (the keys the functions may be read in: a phrase tonicizes, so a succession is grammatical where it is so in one of
  // the keys close to the chorale's or in the one it closes in — `keys`, by default the phrase's own)
  const fkeys = phrase.keys || [key];
  const pairMemo = new Map();
  // (with unit keys a succession is read in the keys of its two units — the one it leaves and the one it enters —,
  // without them in any of `keys`)
  const fnErrors = (t, s0, b0, s, bb) => {
    const k0 = UK ? KID[t - 1] : 0, k1 = UK ? KID[t] : 0;
    const k = ((((s0 * 128 + b0) * 128 + s) * 128 + bb) * 64 + k0) * 64 + k1;
    let v = pairMemo.get(k);
    if (v === undefined) {
      const I0 = info(s0, b0, t - 1), I = info(s, bb, t);
      if (UK) {
        // (each chord's function in its own unit's key is known; in the other's, read once)
        const g = (k2, f0, f1) => grammarErrors([f0, f1], { key: k2, end: false, passing: true }).length;
        v = g(Kt(t), k0 === k1 ? I0.local : fnIn(I0, Kt(t)), I.local);
        if (k0 !== k1) v = Math.min(v, g(Kt(t - 1), I0.local, fnIn(I, Kt(t - 1))));
      } else v = Math.min(...fkeys.map((k2, i) => grammarErrors([I0.fs[i], I.fs[i]], { key: k2, end: false, passing: true }).length));
      pairMemo.set(k, v);
    }
    return v;
  };
  const fnIn = (I, k2) => { const nm = keyName(k2); I.in ??= {}; return nm in I.in ? I.in[nm] : (I.in[nm] = functionOf(I.ch, k2)); };
  const info = (s, bb, t = 0) => {
    const kt = Kt(t), k = (s * 128 + bb) * 64 + (UK ? KID[t] : 0);
    let v = memo.get(k);
    if (!v && UK) { v = INFO.get(`${s},${bb},${KNAME[t]},${homeName}`); if (v) memo.set(k, v); }
    if (!v) {
      const ch = impliedChord([bb, s], kt), f = functionOf(ch, key), p = placed(ch, key), fs = UK ? [] : fkeys.map((k2) => functionOf(ch, k2));
      v = { ch, f, fs, local: functionOf(ch, kt), tension: p ? distance(tonicOf(key), p).d + surface(p) : 0, inverted: p ? p.chord.bass !== p.chord.root : false };
      memo.set(k, v);
      // (the same pitches in the same keys mean the same chord in every bridge: kept across them, a while)
      if (UK) { if (INFO.size > 400000) INFO.clear(); INFO.set(`${s},${bb},${KNAME[t]},${homeName}`, v); }
    }
    return v;
  };
  // the curve the tension follows: the corpus's profile (a plateau released at the cadence), or the generic arch
  const curve = target === "arch" ? archOf(n, weights.peak ?? 6) : profileOf(n);
  // (a melodic interval by its degrees and its semitones: augmented and diminished ones refused — the augmented 2nd of
  // minor's 6th and raised 7th, the tritone, the 7th —, a chromatic semitone allowed, dearer)
  const ALLOWED = { 0: [0, 1], 1: [1, 2], 2: [3, 4], 3: [5], 4: [7], 5: [8, 9], 7: [12] };
  // (each voice near its register: the middle of where the phrase begins and ends, the soprano a little above)
  const center = { s: weights.sopranoCenter ?? (phrase.A[0] + phrase.B[0]) / 2 + 1, b: weights.bassCenter ?? (phrase.A[3] + phrase.B[3]) / 2 + 2 };
  const melodic = (x, y, bass, kk = key) => {
    const d = Math.abs(y - x), k = Math.abs(degreeOf(y, kk) - degreeOf(x, kk));
    if (!(ALLOWED[k] || []).includes(d)) return Infinity;
    if (!bass && d > 9) return Infinity;
    // (how often Bach's voice moves so: −log of its frequency, times the temperature, so that the draw, on this cost
    // alone, moves each voice as often as he does — a note kept, a step, a leap — and not only by the likeliest step)
    return W.motion * T * BACH_OUTER_MOTION[bass ? "bass" : "soprano"][Math.min(13, d)] + (k === 0 && d ? W.chromatic : 0);
  };
  // (a note out of the scale, raised or lowered for an applied dominant or minor's ascent, goes on by step the way it
  // was bent: up after a raised one, down after a lowered one — read in the key of the unit it is in)
  const bentOk = (x, y, k, sc) => {
    if (sc.has(mod(x, 12))) return true;
    const up = isMinor(k) ? [9, 11, 6].map((v) => mod(tonicPc(k) + v, 12)).includes(mod(x, 12)) && mod(x - tonicPc(k), 12) !== 10 : mod(x - tonicPc(k), 12) === 6;
    return up ? y - x === 1 || y - x === 2 : x - y === 1 || x - y === 2;
  };
  // (minor's turns as Bach writes them in his outer voices: ⑥–⑦ going up raised both, ⑦–⑥ coming down natural both;
  // the natural ⑦ to ① or ① to it allowed, dearer — he raises it eight times in nine, and a ⑦ below ① twenty in twenty-one)
  const minorTurn = (x, y, k) => {
    if (!isMinor(k)) return 0;
    const t0 = tonicPc(k), rx = mod(x - t0, 12), ry = mod(y - t0, 12), d = y - x;
    if (d > 0 && d <= 2 && (rx === 8 || rx === 9) && (ry === 10 || ry === 11)) return rx === 9 && ry === 11 ? 0 : Infinity;
    if (d < 0 && d >= -2 && (rx === 10 || rx === 11) && (ry === 8 || ry === 9)) return rx === 10 && ry === 8 ? 0 : Infinity;
    if (d > 0 && d <= 2 && rx === 10 && ry === 0) return W.natural7;
    if (d < 0 && d >= -2 && rx === 0 && ry === 10) return W.natural7;
    return 0;
  };
  const perfect = (s, bb) => { const i = mod(s - bb, 12); return i === 0 || i === 7; };
  /** The cost of going from state (s0, b0) at t − 1 to (s, bb) at t: the rules (Infinity), the line, the layers. */
  const step = (t, s0, b0, s, bb) => {
    const k0 = Kt(t - 1), k1 = Kt(t);
    const ms = melodic(s0, s, false, k1), mb = melodic(b0, bb, true, k1);
    if (ms === Infinity || mb === Infinity || !bentOk(s0, s, k0, SCALE[t - 1]) || !bentOk(b0, bb, k0, SCALE[t - 1])) return Infinity;
    const mt = minorTurn(s0, s, k1) + minorTurn(b0, bb, k1);
    if (mt === Infinity) return Infinity;
    const ds = Math.sign(s - s0), db = Math.sign(bb - b0);
    // parallel and direct 5ths and octaves (the soprano leaping into a perfect interval in similar motion)
    if (perfect(s, bb) && ds === db && ds !== 0 && (perfect(s0, b0) && mod(s - bb, 12) === mod(s0 - b0, 12) || Math.abs(s - s0) > 2)) return Infinity;
    let c = ms + mb + mt + (ds === db && ds !== 0 ? W.similar : 0);
    // (out of the scale a little dearer; each voice near the middle of its range)
    // (in minor its raised ⑥ and ⑦ are its own: no dearer)
    const sc = SCALE[t], own = (x) => sc.has(mod(x, 12)) || (isMinor(k1) && [9, 11].includes(mod(x - tonicPc(k1), 12)));
    c += (own(s) ? 0 : W.outOfScale) + (own(bb) ? 0 : W.outOfScale);
    c += W.tessitura * (Math.abs(s - center.s) + Math.abs(bb - center.b)) / 2;
    const I = info(s, bb, t);
    if (strong[t] && I.inverted && t !== n - 1) c += W.inverted;
    // (the harmonic rhythm of a chorale: a new chord each unit, the same one again dearer)
    const I0x = info(s0, b0, t - 1);
    if (I0x.f && I.f && I0x.f.chord.root === I.f.chord.root && I0x.f.chord.kind === I.f.chord.kind) c += W.sameChord;
    if (L.functions) c += L.functions * fnErrors(t, s0, b0, s, bb);
    // (a key entered is tonicized: its first unit its dominant with the leading tone in the soprano or the bass, the
    // way Bach's quick tonicizations are heard — the minor dominant, without it, is not one)
    if (UK && t < n - 1 && KID[t - 1] !== KID[t]) {
      const lt = mod(tonicPc(k1) - 1, 12);
      if (!(I.local && I.local.fn === "D" && (mod(s, 12) === lt || mod(bb, 12) === lt))) c += W.tonicize;
    }
    if (L.tension && t > 0 && t < n - 1) c += L.tension * Math.abs(I.tension - curve[t]) / 5;
    return c;
  };
  // the cadence: the bass into B by ⑤–① (or ⑦–①), as B's bass asks — the unit before B a dominant's bass
  const cadenceOk = (t, bb, s) => {
    if (t !== n - 2) return true;
    const kc = Kt(n - 1), end = degreeOf(b[3], kc), d = mod(degreeOf(bb, kc) - end, 7);
    // (and the soprano into B's by step, or held)
    return (d === 4 || d === 6 || d === 3 || d === 1) && Math.abs(b[0] - s) <= 2;
  };
  // the backward messages: back[t][i] = log weight of every way from state i at t to B
  const back = Array.from({ length: n }, () => null);
  back[n - 1] = states[n - 1].map(() => 0);
  for (let t = n - 2; t >= 0; t--) {
    back[t] = states[t].map(([s0, b0]) => {
      let z = LOG0;
      states[t + 1].forEach(([s, bb], j) => {
        if (back[t + 1][j] === LOG0 || !cadenceOk(t + 1, bb, s)) return;
        const c = step(t + 1, s0, b0, s, bb);
        if (c !== Infinity) z = lse(z, -c / T + back[t + 1][j]);
      });
      return z;
    });
  }
  const logZ = back[0][0];
  function walk(pick) {
    if (logZ === LOG0) return null;
    const sop = [a[0]], bass = [a[3]];
    const lex = L.economy ? lexicon({ kinds: 30 }) : null;
    let i = 0;
    for (let t = 1; t < n; t++) {
      const [s0, b0] = states[t - 1][i], cs = [];
      states[t].forEach(([s, bb], j) => {
        if (back[t][j] === LOG0 || !cadenceOk(t, bb, s)) return;
        let c = step(t, s0, b0, s, bb);
        if (c === Infinity) return;
        // (the economy, forward only: the motions as words heard before; and a leap of a 4th or more turned back by
        // step, the soprano's line)
        if (lex) c += economyOf(lex, "m|" + (degreeOf(s, key) - degreeOf(s0, key)) + "," + (degreeOf(bb, key) - degreeOf(b0, key)), L.economy);
        if (sop.length >= 2) {
          const prevLeap = s0 - sop[sop.length - 2];
          if (Math.abs(prevLeap) >= 5 && (Math.sign(s - s0) === Math.sign(prevLeap) || Math.abs(s - s0) > 2)) c += 1;
          // (a note struck a third time in a row, dearer still; a step and back at once, a turn that goes nowhere)
          if (s === s0 && s0 === sop[sop.length - 2]) c += 1.5;
          if (s !== s0 && s === sop[sop.length - 2]) c += W.back;
          if (bb !== b0 && bb === bass[bass.length - 2]) c += W.back;
        }
        cs.push({ j, lw: -c / T + back[t][j] });
      });
      if (!cs.length) return null;
      i = pick(cs);
      const [s, bb] = states[t][i];
      if (lex) lex.add("m|" + (degreeOf(s, key) - degreeOf(s0, key)) + "," + (degreeOf(bb, key) - degreeOf(b0, key)));
      sop.push(s); bass.push(bb);
    }
    return { soprano: sop, bass };
  }
  return {
    logZ, possible: logZ !== LOG0, n,
    draw: (r = Math.random) => walk((cs) => {
      const m = Math.max(...cs.map((x) => x.lw)), ws = cs.map((x) => Math.exp(x.lw - m));
      let x = r() * ws.reduce((p, q) => p + q, 0);
      for (let k = 0; k < cs.length; k++) { x -= ws[k]; if (x < 0) return cs[k].j; }
      return cs[cs.length - 1].j;
    }),
    best: () => walk((cs) => cs.reduce((p, q) => (q.lw > p.lw ? q : p)).j),
    /** The first unit's candidates and their probabilities (for the page and the tests). */
    fanAt: (t, i = 0) => { const out = []; walk((cs) => { if (out.length === 0 && cs) { const m = Math.max(...cs.map((x) => x.lw)), z = cs.reduce((p2, x) => p2 + Math.exp(x.lw - m), 0); cs.forEach((x) => out.push({ state: states[1][x.j], p: Math.exp(x.lw - m) / z })); } return cs[0].j; }); return out; },
  };
}

/** The layers' names, and every combination the blind test asks: all on, each one off, and all on with the tension
 *  following the generic arch instead of the corpus's profile. */
export const LAYERS = ["functions", "tension", "economy"];
export const VARIANTS = [{ name: "all", off: [] }, ...LAYERS.map((l) => ({ name: "no-" + l, off: [l] })), { name: "arch", off: [], target: "arch" }];

/**
 * Bridges for a phrase of the corpus, as the engine reads them: [{phrase, soprano, bass, key (the chorale's),
 * readIn (the key the layers read it in: the cadence's, or the chorale's), strong, layers, variant}] — for each variant
 * (all layers, each off, and `arch`) `count` draws. accept(bridge): whether to keep a draw (the tool asks whether
 * bach-4 can fill its inner voices), else drawn again, `tries` times at most.
 */
export function bridgesFor(phrase, { count = 2, r = Math.random, temp = 0.4, only = null, accept = null, tries = 10, tonicize = true, keyRate = KEY_RATE } = {}) {
  const n = phrase.satb.length, out = [];
  // (the key the tension is read in: the cadence's, where the phrase closes on a triad — a phrase of a chorale
  // tonicizes where it ends —, the chorale's where it does not, or where no bridge goes in the cadence's)
  const keys = [phrase.cadence ? { tonic: phrase.cadence.tonic, mode: phrase.cadence.mode } : null, phrase.key].filter(Boolean);
  const end = phrase.cadence ? { tonic: phrase.cadence.tonic, mode: phrase.cadence.mode } : null;
  for (const v of VARIANTS) {
    if (only && v.name !== only) continue;
    const layers = Object.fromEntries(LAYERS.map((l) => [l, v.off.includes(l) ? 0 : undefined]).filter(([, x]) => x !== undefined));
    // (without a path of keys — where none drawn leads anywhere —: the functions read in any key close to the
    // chorale's, as before; built once, when first needed)
    let flat;
    const fallback = () => {
      if (flat !== undefined) return flat;
      flat = null;
      const fk = [...relatedKeys(phrase.key), ...(end ? [end] : [])];
      for (const k of keys) { const b = outerBridge({ ...phrase, key: k, keys: fk, n }, { layers, temp, target: v.target }); if (b.possible) { flat = { B: b, key: k }; break; } }
      return flat;
    };
    // a draw: a path of keys (Bach's moves between keys, from A's to B's), the outer voices through it
    const drawOne = () => {
      if (tonicize && phrase.keys) {
        const path = keyPathFor(phrase, r, { rate: keyRate });
        for (const k of keys) {
          const B = outerBridge({ ...phrase, key: k, unitKeys: path, n }, { layers, temp, target: v.target });
          if (!B.possible) continue;
          const x = B.draw(r);
          if (x) return { x, readIn: k, keys: path.map(keyName) };
        }
      }
      const f = fallback();
      if (!f) return null;
      const x = f.B.draw(r);
      if (!x) return null;
      const chords = x.soprano.map((s, t) => impliedChord([x.bass[t], s], f.key));
      return { x, readIn: f.key, keys: localFunctions(chords, phrase.key, { end }).keys.map(keyName) };
    };
    for (let i = 0; i < count; i++) {
      // (with `accept`, drawn again until it says yes — fromOuter can fill the inner voices —, `tries` times at most:
      // the last kept, marked `fillable: false`, where none is)
      let b = null;
      for (let k = 0; k < (accept ? tries : 1); k++) {
        const d = drawOne();
        if (!d) continue;
        b = { phrase: phrase.id, soprano: d.x.soprano, bass: d.x.bass, key: phrase.key, keys: d.keys, readIn: d.readIn, strong: phrase.strong, layers: LAYERS.filter((l) => !v.off.includes(l)), variant: v.name };
        if (accept) { b.fillable = !!accept(b); if (b.fillable) break; }
      }
      if (b) out.push(b);
    }
  }
  return out;
}

/** Bach's mean tension (tension.mjs: distance from the tonic + surface, of the chord the soprano and bass imply) by
 *  tenth of a phrase, read in the cadence's key, over the 2,272 phrases of the corpus: a plateau, released at the
 *  cadence. The tension layer's target — the same for every phrase, so no phrase's own curve leaks into its bridge. */
export const PROFILE = [5.94, 6.71, 6.6, 6.86, 6.54, 6.73, 6.89, 6.61, 5.98, 0.57];
/** The profile over a phrase of `n` units: unit t in the tenth min(9, ⌊10t/(n−1)⌋). */
export function profileOf(n) { return Array.from({ length: n }, (_, t) => PROFILE[Math.min(9, Math.floor(10 * t / Math.max(1, n - 1)))]); }
/** The generic arch (the `arch` variant): 0 at its ends, `peak` two thirds of the way. */
export function archOf(n, peak = 6) { const at = Math.max(1, Math.round((n - 1) * 2 / 3)); return Array.from({ length: n }, (_, t) => (t <= at ? peak * t / at : peak * (n - 1 - t) / Math.max(1, n - 1 - at))); }
/** How many different motions (the voices' steps together, as the economy says them) a pair of lines has. */
export const motionWords = (x, key) => new Set(x.soprano.slice(1).map((s, t) => "m|" + (degreeOf(s, key) - degreeOf(x.soprano[t], key)) + "," + (degreeOf(x.bass[t + 1], key) - degreeOf(x.bass[t], key)))).size;
/** Whether a pair of lines keeps the rules every bridge keeps: consonant, no parallel 5ths or octaves, in range, the
 *  soprano above. → the reasons it does not (empty: it does). */
export function rulesBroken(x) {
  const out = [], S = x.soprano, B = x.bass;
  for (let t = 0; t < S.length; t++) {
    if (!consonant(S[t], B[t])) out.push(`unit ${t + 1}: dissonant`);
    if (S[t] - B[t] < 3) out.push(`unit ${t + 1}: the voices too close`);
    if (t && mod(S[t] - B[t], 12) % 7 === 0 && mod(S[t] - B[t], 12) === mod(S[t - 1] - B[t - 1], 12) && S[t] !== S[t - 1] && Math.sign(S[t] - S[t - 1]) === Math.sign(B[t] - B[t - 1])) out.push(`unit ${t + 1}: parallel ${mod(S[t] - B[t], 12) ? "5ths" : "octaves"}`);
  }
  return out;
}

/** A line's functions and its grammar's errors, its tension: what the layers did (for the tests and
 *  the page). */
export function measure(phrase, x) {
  const key = phrase.key, n = x.soprano.length;
  const fs = x.soprano.map((s, t) => functionOf(impliedChord([x.bass[t], s], key), key));
  const chords = x.soprano.map((s, t) => impliedChord([x.bass[t], s], key));
  const local = phrase.keys ? localFunctions(chords, phrase.home || key, { end: phrase.cadence ? { tonic: phrase.cadence.tonic, mode: phrase.cadence.mode } : null }).errors.length : null;
  const ten = x.soprano.map((s, t) => { const p = placed(impliedChord([x.bass[t], s], key), key); return p ? distance(tonicOf(key), p).d + surface(p) : 0; });
  return { functions: fs, errors: grammarErrors(fs, { key, end: false, passing: true }).length, local, tension: ten,
           leaps: x.soprano.slice(1).filter((s, t) => Math.abs(s - x.soprano[t]) > 4).length, n };
}
