// SPDX-License-Identifier: MPL-2.0
// @kairotic/rules · tension.mjs: how far a chord is from another, and how tense a chord is where it stands
// (discussions #399, #321) — after Lerdahl's Tonal Pitch Space (2001) and Lerdahl & Krumhansl's tension model (2007).
//
// The tonal functions (functions.mjs) say where the harmony may go; tension says how far it has gone, and how much a
// resolution releases. Together with the economy (bits.mjs) they order a bridge's or a reduction's choices: the
// functions first (a hard rule), the shape of the tension next, the briefest derivation last.
//
//   the basic space   a chord in a region (a key) as five levels of pitch classes: its root (a), its root and
//                     5th (b), its chord tones, the 7th with them (c), the region's scale (d; minor's harmonic, its
//                     leading tone raised), all twelve (e)
//   δ(x → y)          the distance from chord x to chord y: i + j + k — i the regions' distance on the circle of
//                     fifths (their key signatures), j the roots' on the region's circle of fifths (its seven
//                     degrees, F–B a fifth; a root out of the scale on the chromatic circle), k the pitch classes of
//                     y's basic space not in x's, level by level (a to d). I → V 5, I → IV 5, I → vi 7, I → iii 7,
//                     I → ii 8, as Lerdahl's tables give them
//   a chord's region  the home key's, but an applied dominant's is its target's key (V/G in G major): the region
//                     moves with the tonicization, as i counts
//   surface tension   what the chord itself adds where it stands (Lerdahl & Krumhansl): an inversion 2, a 7th 1, a
//                     note foreign to the chord 3
//   tension           sequential (δ from the chord before), global (δ from the tonic) or hierarchical: δ from its
//                     prolongational parent plus the parent's tension — the parent given by a reduction (the chord it
//                     is an ornament of, the closer of the two around it), the frame's chords from the tonic
//
// Pure data and functions.

import { chordOf, functionOf, keyPc } from "./functions.mjs";

const mod = (a, m) => ((a % m) + m) % m;
const MAJOR = [0, 2, 4, 5, 7, 9, 11], HARMONIC = [0, 2, 3, 5, 7, 8, 11];

/** A region: {tonic (pitch class), minor}. Its scale's pitch classes (minor's harmonic), and its key signature as
 *  fifths from C (a minor key the relative major's). */
export const scaleOf = (R) => (R.minor ? HARMONIC : MAJOR).map((x) => mod(R.tonic + x, 12));
const signature = (R) => { const maj = R.minor ? mod(R.tonic + 3, 12) : R.tonic; return mod(maj * 7, 12); };
/** The regions' distance: the steps between their key signatures on the circle of fifths. */
export function regionDistance(A, B) { const d = mod(signature(B) - signature(A), 12); return Math.min(d, 12 - d); }

/** A chord's basic space in a region: {a, b, c, d} (sets of pitch classes). chord: functions.mjs' chordOf's. */
export function basicSpace(chord, R) {
  const iv = { "": [0, 4, 7], m: [0, 3, 7], "°": [0, 3, 6], "+": [0, 4, 8], 7: [0, 4, 7, 10], m7: [0, 3, 7, 10], maj7: [0, 4, 7, 11], "°7": [0, 3, 6, 9], "ø7": [0, 3, 6, 10] }[chord.kind] || [0, 4, 7];
  const tones = iv.map((x) => mod(chord.root + x, 12));
  return { a: new Set([chord.root]), b: new Set([chord.root, tones[2]]), c: new Set(tones), d: new Set(scaleOf(R)) };
}

/** The roots' distance on the region's circle of fifths (its degrees: F C G D A E B in C, F–B a fifth), or on the
 *  chromatic circle where a root is out of the scale. */
export function rootDistance(r1, r2, R) {
  // (a minor region's circle its natural scale's, the relative major's degrees from its own tonic)
  const nat = R.minor ? [0, 2, 3, 5, 7, 8, 10] : MAJOR, sc = nat.map((x) => mod(R.tonic + x, 12)), deg = (r) => sc.indexOf(r);
  // (the diatonic circle: each degree a 5th — four steps up the scale — from the one before: degree d sits at 2d)
  const pos = (r) => { const d = deg(r); return d < 0 ? -1 : mod(d * 2, 7); };
  const p1 = pos(r1), p2 = pos(r2);
  if (p1 >= 0 && p2 >= 0) { const d = mod(p2 - p1, 7); return Math.min(d, 7 - d); }
  const d = mod((r2 - r1) * 7, 12);
  return Math.min(d, 12 - d);
}

/** δ(x → y): Lerdahl's chord distance, i + j + k. x, y: {chord (chordOf's), region}. → {i, j, k, d}. */
export function distance(x, y) {
  const i = regionDistance(x.region, y.region);
  const j = rootDistance(x.chord.root, y.chord.root, y.region);
  const X = basicSpace(x.chord, x.region), Y = basicSpace(y.chord, y.region);
  let k = 0;
  for (const lv of ["a", "b", "c", "d"]) for (const pc of Y[lv]) if (!X[lv].has(pc)) k++;
  return { i, j, k, d: i + j + k };
}

/** A chord (pitches, MIDI) read in a key for tension: {chord, region, fn}. An applied dominant's region is its target's
 *  key, major where the target's chord in the home key is major (its ①, ④, ⑤ in major; ③, ⑥, ⑦ in minor). */
export function placed(pitches, key = { tonic: "C" }) {
  const K = keyPc(key), f = functionOf(pitches, key);
  if (!f) return null;
  let region = K;
  if (f.fn === "A" && f.target !== null) {
    const deg = mod(f.target - K.tonic, 12), major = K.minor ? [3, 8, 10].includes(deg) : [0, 5, 7].includes(deg);
    region = { tonic: f.target, minor: !major };
  }
  return { chord: f.chord, region, fn: f.fn, pitches };
}

/** The tonic chord of a key, placed. */
export const tonicOf = (key = { tonic: "C" }) => { const K = keyPc(key); return { chord: { root: K.tonic, kind: K.minor ? "m" : "", bass: K.tonic, extra: null }, region: K, fn: "T" }; };

/** What a chord adds where it stands: an inversion 2, a 7th 1, a note foreign to it 3. */
export function surface(p) {
  const c = p.chord;
  return (c.bass !== c.root ? 2 : 0) + (["7", "m7", "maj7", "°7", "ø7"].includes(c.kind) ? 1 : 0) + (c.extra !== null && c.extra !== undefined ? 3 : 0);
}

/** A succession of chords' tension: for each, {sequential (δ from the one before), global (δ from the tonic), surface}. */
export function tensions(chords, key = { tonic: "C" }) {
  const T = tonicOf(key), ps = chords.map((c) => placed(c, key));
  return ps.map((p, t) => (p ? { sequential: t ? (ps[t - 1] ? distance(ps[t - 1], p).d : 0) : distance(T, p).d, global: distance(T, p).d, surface: surface(p) } : null));
}

/**
 * Hierarchical tension (Lerdahl): each chord's δ from its prolongational parent plus the parent's tension, and its
 * surface tension. parents: for each chord the index of its parent, or -1 for a chord of the frame (its parent the
 * tonic). → [tension].
 */
export function hierarchical(chords, parents, key = { tonic: "C" }) {
  const T = tonicOf(key), ps = chords.map((c) => placed(c, key)), memo = new Map();
  const at = (i, seen = new Set()) => {
    if (memo.has(i)) return memo.get(i);
    if (seen.has(i)) return 0;
    seen.add(i);
    const p = parents[i];
    const v = p < 0 ? distance(T, ps[i]).d : distance(ps[p], ps[i]).d + at(p, seen);
    memo.set(i, v);
    return v;
  };
  return chords.map((_, i) => at(i) + surface(ps[i]));
}
