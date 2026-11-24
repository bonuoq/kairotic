// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 61 · reduction: the proto-voice grammar, read both ways (discussion #321).
//
// After Finkensiep & Rohrmeier's proto-voice model ("Modeling and Inferring Proto-Voice Structure in Free Polyphony",
// ISMIR 2021) and its reference implementation, DCMLab/protovoices-haskell (BSD-3-Clause, © Christoph Finkensiep):
// the names of the ornaments and operations are theirs; the code is a port of the idea, not of the Haskell.
//
//   a note        {id, pitch (a spelled name: "F#4"), voice ("b" the bass, "m" the melody), on, dur (units)}
//   a slice       what sounds from one onset to the next: {on, end, notes: [{id, pitch, voice, start}]}, start false
//                 where the note was struck before and is held into the slice (a tie)
//   a path        the slices of a level, in time
//   split         (generative) a new slice between two, each of its notes an ornament of the notes around it: a
//                 repetition (held or struck again), a neighbour, a passing tone, an incomplete neighbour
//   spread        (generative) one slice spread into two, each note into the left, the right or both: a sonority
//                 prolonged, an arpeggio (one voice of the surface unfolding several proto-voices)
//   unsplit,      their inverses, which reduce a path a level; this module says which are possible and how each note
//   unspread      is explained — which one to take is a policy's (reduction.mjs: the soft rules and GTTM's)
//
// The same two operations elaborate (vary: reduction.mjs) and reduce (analyse): one grammar, both ways.
// Pure data and functions.

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"], WHITE = [0, 2, 4, 5, 7, 9, 11];
const mod = (a, n) => ((a % n) + n) % n;

/** A spelled name read: {d (diatonic: 7·octave + letter), midi}. */
export function pitchOf(name) {
  const m = /^([A-Ga-g])([#♯b♭x𝄪𝄫]*)(-?\d+)$/.exec(String(name).trim());
  if (!m) throw new Error(`not a note: ${name}`);
  const L = LETTERS.indexOf(m[1].toUpperCase()), o = +m[3];
  const acc = [...m[2]].reduce((a, ch) => a + (ch === "#" || ch === "♯" ? 1 : ch === "x" || ch === "𝄪" ? 2 : ch === "𝄫" ? -2 : -1), 0);
  return { d: 7 * o + L, midi: 12 * (o + 1) + WHITE[L] + acc };
}
const P = new Map();
const pit = (name) => { let p = P.get(name); if (!p) { p = pitchOf(name); P.set(name, p); } return p; };
/** Diatonic steps from a to b (signed). */
export const steps = (a, b) => pit(b).d - pit(a).d;
/** Semitones from a to b (signed). */
export const semis = (a, b) => pit(b).midi - pit(a).midi;
export const midiOf = (name) => pit(name).midi;

/** The interval between two notes as a class: {cls (0 unison … 6 a 7th), s (semitones mod 12)}. */
const ivl = (lo, hi) => ({ cls: mod(steps(lo, hi), 7), s: mod(semis(lo, hi), 12) });
/** Whether two notes sound consonant (a 4th above the lowest is not; above another upper voice it is). */
export function consonant(lo, hi, overBass = true) {
  const { cls, s } = ivl(lo, hi);
  if (cls === 0) return s === 0;
  if (cls === 4) return s === 7;
  if (cls === 2) return s === 3 || s === 4;
  if (cls === 5) return s === 8 || s === 9;
  if (cls === 3) return !overBass && s === 5;
  return false;
}
/** Whether a sonority (names) is consonant: every note with the lowest, and the upper ones among themselves. */
export function sonorous(names) {
  if (names.length < 2) return true;
  const ns = names.slice().sort((a, b) => midiOf(a) - midiOf(b)), lo = ns[0];
  for (let i = 1; i < ns.length; i++) if (!consonant(lo, ns[i], true)) return false;
  for (let i = 1; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++) if (!consonant(ns[i], ns[j], false)) return false;
  return true;
}

// ─── the surface ───
const split = (s) => (Array.isArray(s) ? s : String(s || "").trim().split(/\s+/).filter(Boolean));

/** A phrase of the incipit's ({bass: a note a bar of per units, the last one unit; melody: a note a unit, a note held
 *  written again}) as notes. */
export function notesOfPhrase(phrase, per = 2) {
  const bass = split(phrase.bass), mel = split(phrase.melody), notes = [];
  bass.forEach((p, i) => notes.push({ id: `b${i}`, pitch: p, voice: "b", on: i * per, dur: i === bass.length - 1 ? 1 : per }));
  let k = 0;
  for (let u = 0; u < mel.length; u++) {
    if (u > 0 && mel[u] === mel[u - 1]) { notes[notes.length - 1].dur++; continue; }
    notes.push({ id: `m${k++}`, pitch: mel[u], voice: "m", on: u, dur: 1 });
  }
  return notes;
}

/** The salami slices of notes: a slice at every onset, with every note sounding in it. */
export function slicesOf(notes) {
  const ons = [...new Set(notes.map((n) => n.on))].sort((a, b) => a - b);
  const end = Math.max(...notes.map((n) => n.on + n.dur));
  return ons.map((on, j) => ({
    on, end: j + 1 < ons.length ? ons[j + 1] : end,
    notes: notes.filter((n) => n.on <= on && on < n.on + n.dur)
      .map((n) => ({ id: n.id, pitch: n.pitch, voice: n.voice, start: n.on === on }))
      .sort((a, b) => midiOf(a.pitch) - midiOf(b.pitch)),
  }));
}

// ─── the ornaments: how a note of a slice is explained by the notes around it ───
/** The ornaments, after protovoices-haskell's DoubleOrnament, PassingOrnament, LeftOrnament and RightOrnament, with what
 *  each asks (a parent on the left, the right or both) and a base cost (a policy may weigh them otherwise). */
export const ORNAMENTS = {
  "tie":                  { pv: "RightRepeatOfLeft", parents: "left",  cost: 0,   doc: "the note before, held (a repetition, tied)" },
  "tie-right":            { pv: "LeftRepeatOfRight", parents: "right", cost: 0.6, doc: "the note after, struck early and held into it (an anticipation)" },
  "full-repeat":          { pv: "FullRepeat",        parents: "both",  cost: 0.1, doc: "the same note before and after, struck again between" },
  "right-repeat-of-left": { pv: "RightRepeatOfLeft", parents: "left",  cost: 0.2, doc: "the note before, struck again" },
  "left-repeat-of-right": { pv: "LeftRepeatOfRight", parents: "right", cost: 0.4, doc: "the note after, struck early" },
  "full-neighbor":        { pv: "FullNeighbor",      parents: "both",  cost: 0.4, doc: "a step away from a note and back to it" },
  "passing-mid":          { pv: "PassingMid",        parents: "both",  cost: 0.2, doc: "a step between two notes a 3rd apart" },
  "right-neighbor":       { pv: "RightNeighbor",     parents: "left",  cost: 0.9, doc: "a step away from the note before, not coming back (an incomplete neighbour)" },
  "left-neighbor":        { pv: "LeftNeighbor",      parents: "right", cost: 0.9, doc: "a step into the note after (an appoggiatura, an incomplete neighbour)" },
  "suspension":           { pv: "RightRepeatOfLeft", parents: "left",  cost: 0.1, doc: "held over the beat from the note before, delaying the step down to its resolution (a suspension): the resolution heard on the beat" },
};

/** The ways a note x of a slice is explained by the slices left (L) and right (R) of it: [{orn, parents: [ids], same
 *  (whether the parents are in x's own voice)}]. */
export function explain(x, L, R) {
  const out = [], put = (orn, ps) => out.push({ orn, parents: ps.map((p) => p.id), same: ps.every((p) => p.voice === x.voice) });
  const inL = L ? L.notes : [], inR = R ? R.notes : [];
  const held = inL.find((l) => l.id === x.id);
  if (held) { put("tie", [held]); return out; }
  const into = inR.find((r) => r.id === x.id);
  if (into) put("tie-right", [into]);
  for (const l of inL) for (const r of inR) {
    const a = steps(l.pitch, x.pitch), b = steps(x.pitch, r.pitch);
    if (l.pitch === x.pitch && r.pitch === x.pitch) put("full-repeat", [l, r]);
    else if (l.pitch === r.pitch && Math.abs(a) === 1) put("full-neighbor", [l, r]);
    else if (Math.abs(a) === 1 && Math.abs(b) === 1 && Math.sign(a) === Math.sign(b)) put("passing-mid", [l, r]);
  }
  for (const l of inL) {
    if (l.pitch === x.pitch) put("right-repeat-of-left", [l]);
    else if (Math.abs(steps(l.pitch, x.pitch)) === 1) put("right-neighbor", [l]);
  }
  for (const r of inR) {
    if (r.pitch === x.pitch && r.id !== x.id) put("left-repeat-of-right", [r]);
    else if (Math.abs(steps(x.pitch, r.pitch)) === 1) put("left-neighbor", [r]);
  }
  return out;
}

/** The cheapest way to explain x (by the ornaments' base cost, a parent in another voice costing w.voice more). */
export function bestExplanation(x, L, R, w = {}) {
  const cv = w.voice ?? 0.5, oc = (o) => (w.ornaments && w.ornaments[o]) ?? ORNAMENTS[o].cost;
  const ex = explain(x, L, R).map((e) => ({ ...e, cost: oc(e.orn) + (e.same ? 0 : cv) }));
  return ex.sort((a, b) => a.cost - b.cost)[0] || null;
}

// ─── the inverse operations, on a path ───
/** Unsplit slice i (0 < i < last): {ok, why, explained: [{id, pitch, voice, orn, parents, cost}], path}. Every note of
 *  the slice must be an ornament of the notes around it, each explained the cheapest way; the notes it held on into
 *  the next slice are struck there. */
export function unsplit(path, i, w = {}) {
  const all = unsplits(path, i, w, 1);
  return all.ok === false ? all : all[0];
}

/** Every way to unsplit slice i, as unsplit's, cheapest first (the first is unsplit's): each note of the slice
 *  explained by any of its ornaments, at most `max` ways (an analysis that weighs more than the ornaments' own cost —
 *  the economy of a reading — may prefer another). {ok: false, why} where there is none. */
export function unsplits(path, i, w = {}, max = 8) {
  if (i <= 0 || i >= path.length - 1) return { ok: false, why: "the first and the last slice stay (the phrase's frame)" };
  const L = path[i - 1], S = path[i], R = path[i + 1];
  const cv = w.voice ?? 0.5, oc = (o) => (w.ornaments && w.ornaments[o]) ?? ORNAMENTS[o].cost;
  const per = [];
  for (const x of S.notes) {
    const ex = explain(x, L, R).map((e) => ({ id: x.id, pitch: x.pitch, voice: x.voice, ...e, cost: oc(e.orn) + (e.same ? 0 : cv) }))
      .sort((a, b) => a.cost - b.cost);
    if (!ex.length) return { ok: false, why: `${x.pitch} (${x.id}) is no ornament of the notes around it` };
    per.push(ex);
  }
  // (the combinations, cheapest first: a note's explanations in their order, the first ones of every note first)
  let combos = [[]];
  for (const ex of per) {
    const next = [];
    for (const c of combos) for (const e of ex) next.push([...c, e]);
    combos = next.sort((a, b) => sum(a) - sum(b)).slice(0, max);
  }
  const gone = new Set(S.notes.filter((x) => !L.notes.some((l) => l.id === x.id)).map((x) => x.id));
  const L2 = { ...L, end: S.end };
  // (a note struck in the slice and held into the next one now starts there — unless it is an anticipation of it)
  const R2 = { ...R, notes: R.notes.map((r) => (gone.has(r.id) ? { ...r, start: true } : r)) };
  // L's notes held through S into R stay held; L is prolonged over S's time
  const reduced = [...path.slice(0, i - 1), L2, R2, ...path.slice(i + 2)];
  return combos.map((explained) => ({ ok: true, explained, path: reduced }));
}
const sum = (es) => es.reduce((a, e) => a + e.cost, 0);

/**
 * Unsuspend slice i: a suspension's displacement undone. In slice i a note held from the slice before (its
 * preparation) is dissonant, and in slice i + 1 it goes down a step in its voice (its resolution) while every other
 * note of slice i is held on. What the dissonance delayed is the consonance: reduced, the resolution sounds on the
 * beat, with the notes it was delayed against — slices i and i + 1 become one, at slice i's onset, with the
 * resolution in place of the held note (which stays where it was prepared). {ok, why, explained, path}.
 */
export function unsuspend(path, i) {
  if (i <= 0 || i >= path.length - 1) return { ok: false, why: "no slice before or after it" };
  const L = path[i - 1], S = path[i], R = path[i + 1];
  if (sonorous(S.notes.map((n) => n.pitch))) return { ok: false, why: "a consonance: nothing is suspended" };
  const held = S.notes.filter((x) => !x.start && L.notes.some((l) => l.id === x.id) && !R.notes.some((r) => r.id === x.id));
  if (!held.length) return { ok: false, why: "no note held into it and left after it" };
  const pairs = [];
  for (const x of held) {
    const r = R.notes.find((y) => y.start && y.voice === x.voice && steps(x.pitch, y.pitch) === -1);
    if (!r) return { ok: false, why: `${x.pitch} does not resolve down a step` };
    pairs.push({ x, r });
  }
  const others = S.notes.filter((n) => !held.includes(n));
  if (!others.every((n) => R.notes.some((r) => r.id === n.id))) return { ok: false, why: "the other notes move with the resolution" };
  if (!R.notes.every((r) => pairs.some((p) => p.r.id === r.id) || others.some((n) => n.id === r.id))) return { ok: false, why: "another note is struck with the resolution" };
  const M = { on: S.on, end: R.end, suspended: true,
              notes: R.notes.map((r) => (pairs.some((p) => p.r.id === r.id) ? { ...r, start: true } : { ...r, start: others.find((n) => n.id === r.id).start })) };
  if (!sonorous(M.notes.map((n) => n.pitch))) return { ok: false, why: "the resolution is no consonance" };
  const explained = pairs.map(({ x, r }) => ({ id: x.id, pitch: x.pitch, voice: x.voice, orn: "suspension", parents: [x.id], resolution: r.id, cost: ORNAMENTS.suspension.cost, same: true }));
  return { ok: true, explained, path: [...path.slice(0, i), M, ...path.slice(i + 2)] };
}

/** Unspread slices i and i+1 into one: {ok, why, notes, path}. Their notes, a note held across them or struck again on
 *  the same pitch in the same voice counted once, must make one consonant sonority. */
export function unspread(path, i, { max = 4 } = {}) {
  if (i < 0 || i >= path.length - 1) return { ok: false, why: "no slice after it" };
  const A = path[i], B = path[i + 1], notes = [...A.notes];
  for (const y of B.notes) {
    if (notes.some((x) => x.id === y.id)) continue;
    const same = notes.find((x) => x.pitch === y.pitch && x.voice === y.voice);
    if (same) continue; // struck again: one note of the sonority (SpreadBothChildren)
    notes.push({ ...y, start: true });
  }
  if (notes.length > max) return { ok: false, why: `more than ${max} notes in one sonority` };
  if (!sonorous(notes.map((n) => n.pitch))) return { ok: false, why: "its notes make no consonant sonority" };
  // (a sonority: one note of each pitch — two voices meeting on one pitch are one proto-voice note)
  const S = { on: A.on, end: B.end, notes: notes.sort((a, b) => midiOf(a.pitch) - midiOf(b.pitch)), spread: true };
  return { ok: true, notes: S.notes, path: [...path.slice(0, i), S, ...path.slice(i + 2)] };
}

// ─── the generative operations (the derivation read forwards) ───
/** Split: a slice inserted between path[i-1] and path[i] (its notes given with their ornaments). The inverse of
 *  unsplit: split(unsplit(p, i).path, i, S) is p again. */
export function splitAt(path, i, S) {
  const L = path[i - 1], R = path[i];
  const held = new Set(S.notes.filter((x) => R.notes.some((r) => r.id === x.id && x.start)).map((x) => x.id));
  const R2 = { ...R, notes: R.notes.map((r) => (held.has(r.id) ? { ...r, start: false } : r)) };
  return [...path.slice(0, i - 1), { ...L, end: S.on }, S, R2, ...path.slice(i + 1)];
}
/** Spread: path[i] spread into two slices A and B (as they were). */
export const spreadAt = (path, i, A, B) => [...path.slice(0, i), A, B, ...path.slice(i + 1)];

/** A path drawn on the units' grid as a phrase of the incipit's: the lowest note of the slice at each bar's start is the
 *  bass, the highest at each unit the melody (a level heard: its notes held over the time of what they prolong). */
export function phraseOfPath(path, units, per = 2) {
  const at = (u) => path.filter((s) => s.on <= u).pop();
  const bass = [], mel = [];
  for (let u = 0; u < units; u++) {
    const ns = at(u).notes.map((n) => n.pitch).sort((a, b) => midiOf(a) - midiOf(b));
    if (u % per === 0) bass.push(ns[0]);
    mel.push(ns[ns.length - 1]);
  }
  return { bass: bass.join(" "), melody: mel.join(" ") };
}
