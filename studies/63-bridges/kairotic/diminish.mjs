// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: the eighths over a frame of quarters (#353, the florid idea of #342 for the chorales) — each
// voice's quarters diminished as Bach diminishes them: two eighths through a passing note, a neighbour, a leap filled,
// a sixteenth turn… drawn from how often he does each in that voice, on that beat, toward that next note
// (diminution-tables.mjs, counted on the chorales' `lines`), never one that makes parallel 5ths or octaves with
// another voice, nor a note out of the quarter's key (its scale; in minor ⑥ and ⑦ both ways). One quarter at a time, every candidate weighed by its count: the
// draw is exact for the costs it has (each quarter's own), the voices one after another, each against the lines
// already written.
//
// Pure data and functions.

import { keyOfName } from "./outer.mjs";
import { DIMINUTION_TABLES } from "./diminution-tables.mjs";

export const VOICES = ["soprano", "alto", "tenor", "bass"];
export const DIM_RANGES = { soprano: [59, 81], alto: [53, 74], tenor: [47, 69], bass: [34, 64] };
const mod = (a, m) => ((a % m) + m) % m;
const EPS = 1e-9;
const TON = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
/** The pitch classes a note a voice adds may take in a key: its scale (in minor, ⑥ and ⑦ both ways). */
export function scaleOf(key) {
  const t = TON[String(key.tonic || "C").replace("♯", "#").replace("♭", "b")] ?? 0, minor = key.mode === "minor";
  return new Set((minor ? [0, 2, 3, 5, 7, 8, 9, 10, 11] : [0, 2, 4, 5, 7, 9, 11]).map((x) => mod(t + x, 12)));
}

/** A voice of quarters as a line: [[onset, MIDI, length]], a note a quarter. */
export const quartersOf = (notes) => notes.map((m, t) => [t, m, 1]);
/** The note a line sounds at a time (or null). */
export const soundingAt = (line, t) => { for (const [on, m, d] of line) if (on <= t + EPS && t < on + d - EPS) return m; return null; };

/** The figures a quarter may take ({figure: count}), by voice, beat and the next quarter's note (semitones). */
export function figuresFor(voice, strong, toNext, tables = DIMINUTION_TABLES) {
  return (tables.tables || tables)[`${voice}|${strong ? "strong" : "weak"}|${toNext}`] || null;
}
/** A figure ("0.5 0.5|0,2") over a quarter at `q` whose note is `frame`: its notes [[onset, MIDI, length]]. */
export function notesOf(figure, q, frame) {
  if (figure === "-") return [[q, frame, 1]];
  const [rh, ps] = figure.split("|"), lens = rh.split(" ").map(Number), offs = ps.split(",").map(Number);
  let on = q;
  return lens.map((d, i) => { const n = [on, frame + offs[i], d]; on += d; return n; });
}

/** Parallel 5ths or octaves between two lines in the time from `t0` to `t1` (the moment before included). */
export function parallels(a, b, t0, t1) {
  const times = [...new Set([...a, ...b].map(([on]) => on).filter((x) => x > t0 - 1 - EPS && x < t1 + EPS))].sort((x, y) => x - y);
  for (let i = 1; i < times.length; i++) {
    if (times[i] < t0 - EPS) continue;
    const a0 = soundingAt(a, times[i - 1]), a1 = soundingAt(a, times[i]), b0 = soundingAt(b, times[i - 1]), b1 = soundingAt(b, times[i]);
    if ([a0, a1, b0, b1].includes(null) || a0 === a1 || b0 === b1) continue;
    const i0 = mod(a0 - b0, 12), i1 = mod(a1 - b1, 12);
    if ((i1 === 0 || i1 === 7) && i0 === i1 && Math.sign(a1 - a0) === Math.sign(b1 - b0)) return times[i];
  }
  return null;
}

/**
 * The eighths over a four-voice frame of quarters: {satb: [[S, A, T, B] a quarter] (MIDI), strong, keys (one a
 * quarter, "G major", or `key` for all), voices (those to diminish, in order — default the bass, the tenor, the
 * alto), lines (voices already written, e.g. Bach's soprano, kept as they are), temp (1: as often as Bach; lower,
 * his likeliest figures more), min (a figure's fewest counts to be offered), r}. → {lines: {soprano, alto, tenor,
 * bass} as [[onset, MIDI, length]], figures: {voice: [figure a quarter]}}.
 */
export function diminish({ satb, strong = [], keys = null, key = null, voices = ["bass", "tenor", "alto"], lines = {}, temp = 1, min = 2, r = Math.random, tables = DIMINUTION_TABLES }) {
  const n = satb.length, T = Math.max(1e-3, temp);
  const keyAt = (q) => (keys && keys[q] ? (typeof keys[q] === "string" ? keyOfName(keys[q]) : keys[q]) : key || { tonic: "C" });
  const out = Object.fromEntries(VOICES.map((v, vi) => [v, lines[v] ? lines[v].map((x) => x.slice(0, 3)) : quartersOf(satb.map((c) => c[vi]))]));
  const figs = {};
  for (const v of voices) {
    const vi = VOICES.indexOf(v), others = VOICES.filter((w) => w !== v), line = [];
    figs[v] = [];
    for (let q = 0; q < n; q++) {
      const frame = satb[q][vi];
      // (the last quarter, the fermata's, kept whole; and a quarter whose note the frame holds from the one before)
      const F = q < n - 1 ? figuresFor(v, strong[q], satb[q + 1][vi] - frame, tables) : null;
      const cands = [];
      for (const [f, c] of Object.entries(F || { "-": 1 })) {
        if (c < min && f !== "-") continue;
        const notes = notesOf(f, q, frame), pcs = scaleOf(keyAt(q));
        if (notes.some(([, m], i) => i > 0 && (!pcs.has(mod(m, 12)) || m < DIM_RANGES[v][0] || m > DIM_RANGES[v][1]))) continue;
        const trial = [...line, ...notes, ...(q < n - 1 ? [[q + 1, satb[q + 1][vi], 1]] : [])];
        if (others.some((w) => parallels(trial, out[w], q, q + 1) !== null)) continue;
        cands.push({ f, notes, w: Math.pow(c, 1 / T) });
      }
      // (nothing allowed: the quarter whole, as the frame has it)
      const pick = cands.length ? (() => { let u = r() * cands.reduce((a, x) => a + x.w, 0); for (const x of cands) { u -= x.w; if (u <= 0) return x; } return cands[cands.length - 1]; })()
                                : { f: "-", notes: [[q, frame, 1]] };
      line.push(...pick.notes);
      figs[v].push(pick.f);
    }
    out[v] = line;
  }
  return { lines: out, figures: figs };
}
