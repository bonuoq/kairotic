// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 52 · continuum (discussion #217): one line of events, drawn at a resolution that changes per axis
// and over time — from a free stroke in Hz and seconds to a note on a staff in a bar — and the synchronisation of
// live electronics with it, drawn as wires from its notes.
//
// The kernel is plain data in, plain data out (no DOM): the page draws what `project` returns and plays what
// `Follower` decides. Tested in Node and in the browser (tests/kernel.mjs).
//
// Units. Time in seconds. Height in diatonic steps above E4 (the bottom line of a treble staff): a free pitch is
// placed at its semitones × 7/12, a tempered one at its rounded semitones × 7/12, a written one at its step on the
// staff, so the three agree on average and a resolution can glide between them.

export const A4 = 440;
export const E4 = 64;                   // midi of the bottom line of the treble staff
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const PC = [0, 2, 4, 5, 7, 9, 11];
const SHARPS = [3, 0, 4, 1, 5, 2, 6];   // F C G D A E B (letter indices), the order of sharps in a key signature
const FLATS = [6, 2, 5, 1, 4, 0, 3];    // B E A D G C F

export const clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x));
export const lerp = (a, b, r) => a + (b - a) * r;

export function midiOf(hz, a4 = A4) { return 69 + 12 * Math.log2(hz / a4); }
export function hzOf(midi, a4 = A4) { return a4 * Math.pow(2, (midi - 69) / 12); }

/** The alteration a key signature (fifths: + sharps, − flats) gives each letter (0 C … 6 B). */
export function signature(key = 0) {
  const alt = [0, 0, 0, 0, 0, 0, 0];
  for (let i = 0; i < Math.min(7, Math.abs(key)); i++) alt[key > 0 ? SHARPS[i] : FLATS[i]] = key > 0 ? 1 : -1;
  return alt;
}

/**
 * Spells a (rounded) midi note in a key: the letter the key already alters to it if there is one, else the natural,
 * else a sharp in a sharp key (or C) and a flat in a flat key. Returns {letter, alter, octave, step, acc}: step is
 * the diatonic number (octave × 7 + letter) and acc the accidental to write (null when the signature already says it).
 */
export function spell(midi, key = 0) {
  const m = Math.round(midi), pc = ((m % 12) + 12) % 12, sig = signature(key);
  const cands = [];
  for (let l = 0; l < 7; l++) for (const a of [-1, 0, 1]) if ((PC[l] + a + 12) % 12 === pc) cands.push({ letter: l, alter: a });
  const pick = cands.find((c) => c.alter !== 0 && sig[c.letter] === c.alter)
    || cands.find((c) => c.alter === 0)
    || cands.find((c) => c.alter === (key < 0 ? -1 : 1))
    || cands[0];
  const octave = Math.floor((m - pick.alter) / 12) - 1;
  const acc = pick.alter === sig[pick.letter] ? null : ["♭", "♮", "♯"][pick.alter + 1];
  return { letter: pick.letter, alter: pick.alter, octave, step: octave * 7 + pick.letter, acc, name: LETTERS[pick.letter] + (["b", "", "#"][pick.alter + 1]) + octave };
}

/**
 * A written name ("f#4", "bb3", "cn5", as Kairotic's trees and MEI write them) read in a key, as spell returns it:
 * the name decides the letter and the alteration, the key only whether an accidental is written. Null if it is not one.
 * (Study 55: the staff takes the name the MEI has, so the continuum and the engraving agree.)
 */
export function spellName(name, key = 0) {
  const m = /^\s*([a-g])(##|#|x|s|bb|b|n)?(-?\d+)\s*$/i.exec(String(name || ""));
  if (!m) return null;
  const letter = "cdefgab".indexOf(m[1].toLowerCase());
  const alter = { "##": 2, x: 2, "#": 1, s: 1, bb: -2, b: -1, n: 0 }[(m[2] || "n").toLowerCase()];
  const octave = parseInt(m[3], 10), sig = signature(key);
  const acc = alter === sig[letter] ? null : (["𝄫", "♭", "♮", "♯", "𝄪"][alter + 2]);
  return { letter, alter, octave, step: octave * 7 + letter, acc, name: LETTERS[letter] + (["bb", "b", "", "#", "##"][alter + 2]) + octave };
}

const E4_STEP = 4 * 7 + 2;

/** Heights of one pitch at the three marks of the pitch axis: free (Hz), tempered (a semitone grid), written (staff);
 *  with a written name the staff is the name's (else the pitch is spelled in the key). */
export function heights(hz, key = 0, a4 = A4, name = null) {
  const m = midiOf(hz, a4);
  const w = (name && spellName(name, key)) || spell(m, key);
  return { free: (m - E4) * 7 / 12, grid: (Math.round(m) - E4) * 7 / 12, staff: w.step - E4_STEP, midi: m };
}

/** The height of a pitch at a pitch resolution r: 0 free → ½ tempered → 1 written. */
export function heightAt(h, r) {
  r = clamp(r);
  return r <= 0.5 ? lerp(h.free, h.grid, r * 2) : lerp(h.grid, h.staff, (r - 0.5) * 2);
}

/** A resolution curve: breakpoints [[t, r], …] (sorted by t), linear between them, held beyond them. */
export function curveAt(curve, t) {
  if (typeof curve === "number") return clamp(curve);
  if (!curve || !curve.length) return 0;
  if (t <= curve[0][0]) return clamp(curve[0][1]);
  for (let i = 1; i < curve.length; i++) {
    const [t1, r1] = curve[i], [t0, r0] = curve[i - 1];
    if (t <= t1) return clamp(t1 === t0 ? r1 : lerp(r0, r1, (t - t0) / (t1 - t0)));
  }
  return clamp(curve[curve.length - 1][1]);
}

/** The three resolutions at a time: {time, pitch, glyph}. */
export function resAt(res, t) {
  return { time: curveAt(res.time, t), pitch: curveAt(res.pitch, t), glyph: curveAt(res.glyph, t) };
}

/** A written duration in beats → its note value: base (4 whole … 0.125 thirty-second), dots, filled head, flags. */
export function noteValue(beats) {
  const bases = [4, 2, 1, 0.5, 0.25, 0.125];
  for (const b of bases) {
    if (Math.abs(beats - b * 1.5) < 1e-9) return { base: b, dots: 1, filled: b < 2, flags: flagsOf(b), stem: b < 4, exact: true };
    if (Math.abs(beats - b) < 1e-9) return { base: b, dots: 0, filled: b < 2, flags: flagsOf(b), stem: b < 4, exact: true };
  }
  const b = bases.find((x) => x <= beats) || 0.125;
  return { base: b, dots: 0, filled: b < 2, flags: flagsOf(b), stem: b < 4, exact: false };
}
function flagsOf(b) { return b >= 1 ? 0 : Math.round(Math.log2(1 / b)); }

/** Onset and duration on a grid of `div` parts of a beat at `bpm` (a duration is at least one part). */
export function quantize(ev, { bpm = 60, div = 4 } = {}) {
  const beat = 60 / bpm, unit = beat / div;
  const t = Math.round(ev.t / unit) * unit;
  const end = Math.max(t + unit, Math.round((ev.t + ev.dur) / unit) * unit);
  return { t, dur: end - t, beats: (end - t) / beat };
}

/**
 * Projects a line of events at the resolutions `res` ({time, pitch, glyph}: numbers or curves over time).
 * events: [{t, dur, hz, hz2?, amp?, name?}] (seconds, Hz; hz2 the end of a glissando; name the written one, if known).
 * Returns, for each event, where its parts are and how much of each is drawn (0…1), plus the bar lines and how much
 * of the staff and of the semitone grid shows at a time:
 *   notes: [{i, r, x, x1, y, y1, gliss, stroke, thick, head, filled, durLine, stem, flags, dots, acc, accAlpha, name}]
 *   bars: [{x, alpha}] · staffAlpha(t) · gridAlpha(t) · timeAlpha(t)
 * Each axis: time 0 proportional (where it sounds) → 1 metric (where it is written in a bar); pitch 0 free Hz → ½ a
 * semitone grid → 1 a step on the staff (spelled in `key`); glyph 0 a stroke (its thickness the amp, its course the
 * glissando) → ½ a head with a line as long as it lasts (proportional notation) → 1 a note value (head, stem, flags).
 * The value's parts need the metric time as well: a written quarter is a quarter of a beat in a bar.
 */
export function project(events, res, { bpm = 60, div = 4, meter = 4, key = 0, a4 = A4 } = {}) {
  const beat = 60 / bpm;
  const notes = events.map((ev, i) => {
    const r = resAt(res, ev.t);
    const q = quantize(ev, { bpm, div });
    const h0 = heights(ev.hz, key, a4, ev.name), h1 = ev.hz2 ? heights(ev.hz2, key, a4) : h0;
    const staffness = clamp((r.pitch - 0.5) * 2);
    const v = noteValue(q.beats), sp = (ev.name && spellName(ev.name, key)) || spell(h0.midi, key);
    return {
      i, r,
      x: lerp(ev.t, q.t, r.time), x1: lerp(ev.t + ev.dur, q.t + q.dur, r.time),
      y: heightAt(h0, r.pitch), y1: heightAt(h1, r.pitch), gliss: !!ev.hz2,
      stroke: 1 - r.glyph, thick: ev.amp == null ? 0.6 : clamp(ev.amp),
      head: r.glyph,
      durLine: r.glyph * (1 - r.time),
      stem: v.stem ? r.glyph * r.time : 0, filled: v.filled, flags: v.flags, dots: v.dots, exact: v.exact,
      acc: sp.acc, accAlpha: sp.acc ? r.glyph * staffness : 0,
      name: sp.name, midi: h0.midi, cents: Math.round((h0.midi - Math.round(h0.midi)) * 100),
    };
  });
  const end = events.reduce((m, e) => Math.max(m, e.t + e.dur), 0);
  const bars = [];
  for (let b = 0, x = 0; x <= end + 1e-9; b++, x = b * meter * beat) bars.push({ x, alpha: curveAt(res.time, x) });
  return {
    notes, bars, end,
    staffAlpha: (t) => clamp((curveAt(res.pitch, t) - 0.5) * 2),
    gridAlpha: (t) => 1 - Math.abs(curveAt(res.pitch, t) - 0.5) * 2,
    timeAlpha: (t) => curveAt(res.time, t),
  };
}

// ───────── synchronisation ─────────
//
// A wire binds a note of the line (by its index) to an event of the electronics. Its kind says who waits for whom:
//   rigid    — the electronics start on the note itself, however late it comes; a note never played is caught up at
//              the next note that is (the electronics follow the score, not a clock).
//   elastic  — the electronics expect the note where the performer's tempo puts it; with leader "performer" they
//              wait for it up to `tol` seconds and then go on without it; with leader "electronics" they do not
//              wait: they start at that expected time and the performer follows (how early or late they were is
//              written down).
// The expected time of note i is its written time plus the offset of the last note before it that was played: what
// a follower that hears every note knows of where the performer is.

export const KINDS = ["rigid", "elastic"];

export class Follower {
  constructor(events, wires) {
    this.t = events.map((e) => e.t);
    this.played = new Array(events.length).fill(null);
    this.wires = wires.slice().sort((a, b) => this.t[a.note] - this.t[b.note] || a.note - b.note);
    this.pending = new Set(this.wires.map((w) => w.id));
    this.out = new Map();
  }
  /** The offset (played − written) of the last note before i that was played; 0 before any. */
  offBefore(i) {
    for (let j = i - 1; j >= 0; j--) if (this.played[j] != null) return this.played[j] - this.t[j];
    return 0;
  }
  expected(w) { return this.t[w.note] + this.offBefore(w.note); }
  /** When a pending elastic wire would start without its note (Infinity for a rigid one). */
  due(w) {
    if (w.kind !== "elastic") return Infinity;
    return this.expected(w) + (w.leader === "electronics" ? 0 : (w.tol || 0));
  }
  fire(w, at, status, extra = {}) {
    this.pending.delete(w.id);
    const r = Object.assign({ id: w.id, note: w.note, kind: w.kind, leader: w.leader || "performer", at, status, expected: this.expected(w) }, extra);
    this.out.set(w.id, r);
    return r;
  }
  /** Time passes until `now`: the elastic wires due before it start (at their exact time). */
  tick(now) {
    const fired = [];
    for (const w of this.wires) {
      if (!this.pending.has(w.id)) continue;
      const d = this.due(w);
      if (d < now) fired.push(this.fire(w, d, w.leader === "electronics" ? "led" : "went on"));
    }
    return fired;
  }
  /** The performer plays note j at `time`. */
  note(j, time) {
    const fired = this.tick(time);
    this.played[j] = time;
    for (const w of this.wires) {
      if (w.note > j) continue;
      if (!this.pending.has(w.id)) {
        // a wire the electronics led: how far the performer was from it
        const r = this.out.get(w.id);
        if (r && w.note === j && r.status === "led") r.gap = time - r.at;
        if (r && w.note === j && r.status === "went on") r.late = time - r.at;
        continue;
      }
      if (w.note === j) {
        if (w.kind === "elastic" && w.leader === "electronics") {
          // the performer came before the electronics' time: they still start on their own clock
          continue;
        }
        fired.push(this.fire(w, time, "on the note"));
      } else if (w.kind === "rigid") {
        // its note was not played: caught up at this one
        fired.push(this.fire(w, time, "caught up", { at_note: j }));
      }
    }
    return fired;
  }
  /** The end: what is still pending starts if it is elastic, and never if it is rigid. */
  finish() {
    const fired = this.tick(Infinity);
    for (const w of this.wires) if (this.pending.has(w.id)) fired.push(this.fire(w, null, "never"));
    return fired;
  }
  results() { return this.wires.map((w) => this.out.get(w.id)).filter(Boolean); }
}

/**
 * Offline: a performance (the time each note was played, null for a note left out) and what the electronics did,
 * wire by wire: [{id, note, kind, leader, at, status, expected, gap?, late?, at_note?}].
 */
export function sync(events, wires, perf) {
  const f = new Follower(events, wires);
  const order = perf.map((t, j) => [t, j]).filter(([t]) => t != null).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  for (const [t, j] of order) f.note(j, t);
  f.finish();
  // an "electronics led" wire whose note came before it: the gap is negative (the performer was early)
  for (const r of f.results()) if (r.status === "led" && r.gap == null && perf[r.note] != null) r.gap = perf[r.note] - r.at;
  return f.results();
}

// ───────── a performer, for listening without playing ─────────

/** A seeded random (mulberry32), so a performance can be heard again. */
export function rng(seed = 1) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * The times a performer plays the notes: rubato (a drift that wanders by up to `rubato` × the duration of each note),
 * `hold` {note: seconds} a breath before a note, `skip` [notes] left out.
 */
export function perform(events, { rubato = 0, seed = 1, hold = {}, skip = [] } = {}) {
  const rand = rng(seed);
  let drift = 0;
  return events.map((e, i) => {
    drift += (rand() * 2 - 1) * rubato * e.dur;
    drift += hold[i] || 0;
    return skip.includes(i) ? null : Math.max(0, e.t + drift);
  });
}
