// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 73 · following by the 88 keys (discussions #137 and #308): the frame-by-frame follower of
// kairotic.follow (its :dtw model, an online DTW after Dixon's MATCH) fed with what Basic Pitch hears, every 50 ms,
// as 88 keys — or folded into a chroma, as the followers hear today — and measured against when each chord was
// really played.
//
// dtwFollow is kairotic.follow's dtw-step as it is (core/kairotic/follow.cljs): the same band (30 frames back, 60
// ahead), the same three moves (the performer stays, both go on at double cost, the score goes on alone), the same
// normalised minimum, the same distance (obs-dist for one vector descriptor: 3 × (1 − cosine), at most 3; a frame of
// silence in the score: 1). Only the observation changes, so what is measured here is what the app would gain.

import { NOTES, MIDI_OFFSET } from "./basicpitch.mjs";
import { frameAt, fold } from "./listen.mjs";

export const HOP = 0.05;
export const BAND_BACK = 30, BAND_AHEAD = 60;

const cos = (a, b) => {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
};
/** kairotic.follow's distance for a vector descriptor: 3 × (1 − cosine), at most 3 (1 for a silent frame). */
export const dist = (prof, obs) => (prof ? Math.min(3, 3 * (1 - cos(prof, obs))) : 1);

const keysOf = (midis) => { const v = new Float32Array(NOTES); for (const m of midis) if (m >= MIDI_OFFSET && m < MIDI_OFFSET + NOTES) v[m - MIDI_OFFSET] = 1; return v; };

/** What a score should sound like every HOP: [{j (its event), keys (88), chroma (12)}], each event for as long as it
 *  is written. events: [{t, dur, midis}] in written seconds. */
export function reference(events, hop = HOP) {
  const out = [];
  events.forEach((e, j) => {
    const k = keysOf(e.midis), c = fold(k);
    for (let i = 0; i < Math.max(1, Math.round(e.dur / hop)); i++) out.push({ j, keys: k, chroma: c });
  });
  return out;
}

/** What is heard every HOP, from Basic Pitch's frame posteriorgram (n × 88): the mean of each key over the hop, and
 *  its chroma. */
export function observations(frames, n, seconds, hop = HOP) {
  const out = [];
  for (let t = 0; t + hop <= seconds + 1e-9; t += hop) {
    const a = frameAt(t, n), b = Math.max(a + 1, frameAt(t + hop, n)), k = new Float32Array(NOTES);
    for (let i = a; i < b && i < n; i++) for (let f = 0; f < NOTES; f++) k[f] += frames[i * NOTES + f];
    for (let f = 0; f < NOTES; f++) k[f] /= (b - a);
    out.push({ t, keys: k, chroma: fold(k) });
  }
  return out;
}

/** Follows obs ([{t, keys, chroma}]) through ref by `by` ("keys" or "chroma"), frame by frame as kairotic.follow's
 *  dtw-step. → {arrived: [time each event was entered, or null], path: [position in ref after each frame]}. */
export function dtwFollow(ref, obs, by = "keys") {
  const n = ref.length, arrived = new Array(ref.length ? ref[ref.length - 1].j + 1 : 0).fill(null), path = [];
  let D = null, pos = 0, cur = -1;
  obs.forEach((o, i) => {
    const lo = Math.max(0, pos - BAND_BACK), hi = Math.min(n - 1, pos + BAND_AHEAD);
    const D2 = new Map(), d = (j) => dist(ref[j][by], o[by]);
    for (let j = D === null ? 0 : lo; j <= hi; j++) {
      const dj = d(j);
      let v;
      if (D === null) v = j === 0 ? dj : (D2.get(j - 1) ?? Infinity) + dj;
      else v = Math.min((D.get(j) ?? Infinity) + dj, (D.get(j - 1) ?? Infinity) + 2 * dj, (D2.get(j - 1) ?? Infinity) + dj);
      D2.set(j, v);
    }
    let best = null, bv = Infinity;
    for (const [j, v] of D2) { const x = v / (i + j + 2); if (x < bv) { bv = x; best = j; } }
    D = D2;
    pos = Math.max(pos, best);
    path.push(pos);
    const j = ref[pos].j;
    if (j > cur) { for (let k = cur + 1; k <= j; k++) if (arrived[k] === null) arrived[k] = k === j ? o.t : null; cur = j; }
  });
  return { arrived, path };
}

/** How well the follower knew where the performer was: for each event after the first (the follower starts on the
 *  first), the time it was entered against when it was played. → {errors (ms, null where it was skipped), median,
 *  mean (ms of the absolute errors), within (share within `tol` s), skipped}. */
export function judge(arrived, played, tol = 0.1) {
  const errors = played.slice(1).map((p, k) => { const a = arrived[k + 1]; return a === null || a === undefined ? null : Math.round((a - p) * 1000); });
  const ok = errors.filter((e) => e !== null).map(Math.abs).sort((a, b) => a - b);
  const median = ok.length ? ok[Math.floor(ok.length / 2)] : null;
  const mean = ok.length ? Math.round(ok.reduce((a, b) => a + b, 0) / ok.length) : null;
  return { errors, median, mean, within: Math.round((100 * ok.filter((e) => e <= tol * 1000).length) / errors.length) / 100, skipped: errors.filter((e) => e === null).length };
}

// ───── a piece the chroma cannot follow ─────
// Sixteen chords of C and G in every register: a chroma hears long runs of the same chord, the keys hear where each
// one is. Each written half a second.
export const REGISTERS = [
  [48, 52, 55], [60, 64, 67], [72, 76, 79], [60, 64, 67], [55, 59, 62], [67, 71, 74], [79, 83, 86], [67, 71, 74],
  [48, 52, 55], [60, 64, 67], [72, 76, 79], [84, 88, 91], [72, 76, 79], [60, 64, 67], [55, 59, 62], [48, 52, 55],
];
export const written = (chords = REGISTERS, dur = 0.5) => chords.map((midis, j) => ({ t: j * dur, dur, midis }));

function rng(seed) {
  let a = seed >>> 0;
  return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
}
/** The piece played with rubato: each chord's length × a factor between 1 − r and 1 + r (seeded), after a lead.
 *  → {notes: [{t, dur, midi}] to render, onsets: [when each chord was played]}. */
export function perform(events, { rubato = 0.4, seed = 7, lead = 0.3 } = {}) {
  const r = rng(seed), onsets = [], notes = [];
  let t = lead;
  for (const e of events) {
    const d = e.dur * (1 - rubato + 2 * rubato * r());
    onsets.push(Math.round(t * 1000) / 1000);
    for (const m of e.midis) notes.push({ t, dur: d * 0.95, midi: m });
    t += d;
  }
  return { notes, onsets };
}

/** An ideal posteriorgram of a performance (each played key 0.9 while it sounds), for testing without the model. */
export function idealFrames(notes, seconds, fps = 86) {
  const n = Math.floor(seconds * fps), f = new Float32Array(n * NOTES);
  for (const { t, dur, midi } of notes) {
    const a = frameAt(t, n), b = frameAt(t + dur, n);
    for (let i = a; i < b; i++) f[i * NOTES + midi - MIDI_OFFSET] = 0.9;
  }
  return { frames: f, n };
}
