// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 73 · what a follower could hear in Basic Pitch's posteriorgram (discussions #137 and #308).
// Pure functions over flat Float32Arrays of frames × 88 (A0 = MIDI 21 … C8 = 108): the notes as events in seconds,
// the salience of each key between two times, the chroma it folds into, how well a written chord matches what was
// heard, a note-level score against what was written, and a small piece rendered here, in plain JS, to try it all.
import { SR, NOTES, MIDI_OFFSET, frameTime } from "./basicpitch.mjs";

const r3 = (x) => Math.round(x * 1000) / 1000;

/** The notes found (in frames) as events in seconds, the shape of a pattern's event: {:t :dur :midi :amp}. */
export function events(found) {
  return found.map((n) => {
    const t = frameTime(n.start);
    return { t: r3(t), dur: r3(frameTime(n.end) - t), midi: n.midi, amp: r3(n.amp) };
  });
}

/** The frames between two times, in seconds (the frame whose time is the nearest). */
export function frameAt(t, n) {
  let lo = 0, hi = n - 1;
  while (lo < hi) { const m = (lo + hi) >> 1; if (frameTime(m) < t) lo = m + 1; else hi = m; }
  return lo;
}

/** The salience of each of the 88 keys between t0 and t1: the mean of its frame posterior there. */
export function salience(frames, n, t0, t1) {
  const a = frameAt(t0, n), b = Math.max(a + 1, frameAt(t1, n));
  const v = new Float32Array(NOTES);
  for (let t = a; t < b; t++) for (let f = 0; f < NOTES; f++) v[f] += frames[t * NOTES + f];
  for (let f = 0; f < NOTES; f++) v[f] /= (b - a);
  return v;
}

/** 88 keys folded into 12 pitch classes (C = 0), as a chroma hears them. */
export function fold(v) {
  const c = new Float32Array(12);
  for (let f = 0; f < v.length; f++) c[(f + MIDI_OFFSET) % 12] += v[f];
  return c;
}

/** What a written chord should sound like on the same 88 (or 12) bins: 1 on each of its notes. */
export function written(midis, bins = NOTES) {
  const v = new Float32Array(bins);
  for (const m of midis) {
    const i = bins === 12 ? ((m % 12) + 12) % 12 : m - MIDI_OFFSET;
    if (i >= 0 && i < bins) v[i] = 1;
  }
  return v;
}

export function cosine(a, b) {
  let ab = 0, aa = 0, bb = 0;
  for (let i = 0; i < a.length; i++) { ab += a[i] * b[i]; aa += a[i] * a[i]; bb += b[i] * b[i]; }
  return aa && bb ? ab / Math.sqrt(aa * bb) : 0;
}

/** For each written chord ({t0, t1, midis}): does what was heard match it better than the same chord with one note an
 *  octave off (each note, up and down)? On 88 keys it can; on a chroma the two are the same pitch classes, a tie.
 *  Returns {keys: [won, of], chroma: [won, of], chords: [{written, keys, chroma, worst}]} — worst is the closest
 *  octave-off rival on the keys. */
export function octaves(frames, n, chords) {
  let kw = 0, cw = 0, of = 0;
  const per = chords.map(({ t0, t1, midis }) => {
    const heard = salience(frames, n, t0, t1), h12 = fold(heard);
    const w88 = cosine(heard, written(midis)), w12 = cosine(h12, written(midis, 12));
    let worst = -1, kOk = true, cOk = true;
    midis.forEach((m, i) => {
      for (const d of [-12, 12]) {
        const alt = midis.map((x, j) => (j === i ? x + d : x));
        if (alt.some((x) => x < MIDI_OFFSET || x >= MIDI_OFFSET + NOTES) || new Set(alt).size < alt.length) continue;
        const a88 = cosine(heard, written(alt)), a12 = cosine(h12, written(alt, 12));
        worst = Math.max(worst, a88);
        of++;
        if (w88 > a88) kw++; else kOk = false;
        if (w12 > a12 + 1e-9) cw++; else cOk = false;
      }
    });
    return { midis, keys: r3(w88), chroma: r3(w12), worst: r3(worst), keysOk: kOk, chromaOk: cOk };
  });
  return { keys: [kw, of], chroma: [cw, of], chords: per };
}

/** Note-level score of what was found against what was written (mir_eval's onset-only matching, greedy): a found
 *  note matches a written one of the same pitch whose start is within tol seconds, each used once.
 *  Returns {precision, recall, f, matched, found, written}. */
export function score(found, truth, tol = 0.05) {
  const used = new Set();
  let m = 0;
  for (const e of [...found].sort((a, b) => a.t - b.t)) {
    let best = -1, bd = Infinity;
    truth.forEach((w, i) => {
      const d = Math.abs(w.t - e.t);
      if (!used.has(i) && w.midi === e.midi && d <= tol && d < bd) { bd = d; best = i; }
    });
    if (best >= 0) { used.add(best); m++; }
  }
  const p = found.length ? m / found.length : 0, r = truth.length ? m / truth.length : 0;
  return { precision: r3(p), recall: r3(r), f: r3(p + r ? 2 * p * r / (p + r) : 0), matched: m, found: found.length, written: truth.length };
}

// ───── a piece to try it on ─────
// Eight chords of a cadence in C, a bass doubled at the octave and the upper voices spread (so an octave off would be
// another chord to a chroma, never to the keys): what is written, and its sound rendered here.
export const PIECE = [
  [0.0, 0.75, [36, 48, 64, 67, 72]],   // C
  [0.75, 0.75, [41, 53, 65, 69, 72]],  // F
  [1.5, 0.75, [43, 55, 62, 67, 71]],   // G
  [2.25, 0.75, [45, 57, 64, 69, 72]],  // a
  [3.0, 0.75, [38, 50, 65, 69, 74]],   // d
  [3.75, 0.75, [43, 55, 65, 71, 74]],  // G7
  [4.5, 1.5, [36, 48, 64, 67, 72]],    // C
];
export const pieceNotes = (piece = PIECE) =>
  piece.flatMap(([t, dur, ms]) => ms.map((midi) => ({ t, dur, midi })));
export const pieceChords = (piece = PIECE, trim = 0.15) =>
  piece.map(([t, dur, midis]) => ({ t0: t + trim, t1: t + dur - trim / 2, midis }));

/** A struck string, roughly: harmonics 1–10 a little stretched, each fainter and dying sooner than the one below,
 *  a 4 ms attack, a 60 ms release; at SR. Deterministic (no noise), so Node and the page render the same samples. */
export function render(notes, { sr = SR, tail = 0.5, gain = 0.06 } = {}) {
  const end = Math.max(...notes.map((x) => x.t + x.dur)) + tail;
  const out = new Float32Array(Math.ceil(end * sr));
  for (const { t, dur, midi, amp = 1 } of notes) {
    const f0 = 440 * 2 ** ((midi - 69) / 12), B = 0.0004;
    const s0 = Math.round(t * sr), len = Math.round((dur + 0.06) * sr);
    for (let h = 1; h <= 10; h++) {
      const fh = h * f0 * Math.sqrt(1 + B * h * h);
      if (fh > sr / 2 * 0.9) break;
      const a = amp * gain / h ** 1.2, decay = 1.2 + 0.5 * h * (f0 / 261.6) ** 0.5;
      const w = 2 * Math.PI * fh / sr;
      for (let i = 0; i < len && s0 + i < out.length; i++) {
        const tt = i / sr;
        const env = Math.min(1, tt / 0.004) * Math.exp(-decay * tt) * (tt > dur ? Math.max(0, 1 - (tt - dur) / 0.06) : 1);
        out[s0 + i] += a * env * Math.sin(w * i);
      }
    }
  }
  return out;
}

/** The written notes as EDN events, as the page shows and a pattern or a tree would take them. */
export function edn(evs) {
  return "[" + evs.map((e) => `{:t ${e.t} :dur ${e.dur} :midi ${e.midi}${e.amp != null ? ` :amp ${e.amp}` : ""}}`).join("\n ") + "]";
}
