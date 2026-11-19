// SPDX-License-Identifier: MPL-2.0
// @kairotic/cac · partimento.mjs: a given bass realized in two or three parts, as a partimento is — the hard rules of
// tonal counterpoint over a bass, shared by every engine that realizes one (Studies 51 and 54, after Job IJzerman,
// Harmony, Counterpoint, Partimento, OUP 2018, chapters 1–4). Beside soft.mjs, which weighs what these allow.
//
//   keyOf, codeOf          a key (a tonic, major or minor): a pitch is a degree, 0 the tonic of the bass's octave,
//                          and in minor ⑥ and ⑦ raised or not
//   schemata(spec)         one voice over a bass (the two-part rules of chapter 1): its futures counted exactly,
//                          drawn uniformly, by the engine, or written by hand with each next note's futures; its
//                          figurings (the essentially different realizations)
//   parts(spec)            two upper voices over a bass (chapters 2–3): each held to the two-part rules against the
//                          bass, the two between them to the rules of upper voices, three voices to the notes of a
//                          chord (its 3rd not doubled, nor the leading tone)
//   SCHEMATA, PROTOTYPES   the two-part schemata of chapter 1, and the book's prototypes
//   SCHEMATA3, CADENCES    the three-part schemata of chapter 2 and the cadences of chapter 3, a phrase being a
//                          schema then a cadence (phraseBass)
//   CHORDS                 the figures of a chord as the intervals that must sound and may sound above the bass
//   RULE_OF_THE_OCTAVE     chapter 4: the chord for each degree of a scale in the bass, going up and going down
//
// Keys (chapter 4): a bass note may carry a key of its own, as the book boxes the keys of a modulating sequence. A
// note is then a degree in the letters of the key of the whole and an alteration (−1, 0, +1) from its scale; whether
// it belongs, and what it is (the leading tone, a raised ⑥ in minor, the chord on a dominant), is read in the key of
// its unit. One key for the whole is the case of chapters 1–3, unchanged.
//
// The rules of one voice over the bass:
//   a unit is half a bar: the first strong, the second weak (an upbeat, phase 1, begins on a weak one)
//   verticals   3rds and 6ths imperfect, 8ves and 5ths perfect; 2nds, 4ths and 7ths dissonant
//   strong      a consonance, or a suspension: one voice holds its note from a consonance (the preparation) — the
//               upper a 7th, a 4th or a 9th (7–6, 4–3, 9–8), the bass a 2nd (2–3) — and on the next unit the voice
//               that holds it goes down a step to a consonance (the resolution); the other voice may move with it
//               (7–3, 2–6: Fifth Down Fourth Up, the Tied Bass)
//   weak        a consonance, or a passing tone: over a held bass, by step and on by step the same way
//   lines       steps, 3rds, 4ths, 5ths (the diminished one too), 6ths, the octave, and in minor the diminished
//               7th; after a leap of a 4th or more the line turns; in minor ⑥ and ⑦ go up raised and down natural
//   the voices  no parallel 5ths or 8ves, none by direct motion with a leap in the upper voice; the upper starts
//               on an 8ve, a 5th or a 3rd over ① (a sixth there "would be unsatisfactory"), ends on an 8ve or a 3rd
//               over the last bass note, reached by step (a middle voice starts and ends on any consonance)
//   minor       ⑥ and ⑦ go up raised, down natural, and a raised ⑥ goes on up to the raised ⑦; over a dominant
//               (⑤ going to ① or ⑥, or closing a half cadence; not a ⑤ passed in a sequence) ⑦ is raised: the
//               chord on the dominant is major
//   chapter 4   (spec.ro) the augmented 4th and the diminished 5th over the bass are semi-consonances: unprepared,
//               resolved (the 4th up to a 6th, the 5th down to a 3rd); over a passing bass (the descending ④'s 4/2)
//               an upper voice may sound a note of the chord before, consonant again when the bass moves on
//   more        a unit may say whether it is strong (a schema in a meter of its own) and allow an accented
//               passing tone (the 6/4 of a Galant cadence); the bass may hold a 2nd or a 4th (2–3, 4/2); a 7th may
//               put off its resolution by one chord, held into the 4th over the next bass (ii7 → V6/4: delayed)
//
// The figures of the schema (the numbers under the bass) may be asked too: then the upper voice realizes them, and
// what is left to choose is little (the octave, a passing tone); without them the rules alone choose. The futures
// are counted exactly (BigInt), a realization is drawn uniformly from them, and a voice written by hand is shown the
// futures of each of its next notes — the partimento as improvisation.
//
// What the hard rules allow, the soft rules of Studies 38–42 weigh (soft.mjs: the melodic contour after Bach, the
// motion between the voices): the engine chooses each note among those with a future by a softmax of −cost /
// temperature, as Study 38's does. Drawn uniformly, a realization is one of the many — and most of them leap; the
// engine draws the lines the style prefers.

// Three parts:
// Each of the two upper voices is held to the rules above against the bass.
// Between the upper voices the rules of upper voices: a 4th is a consonance there (the Fauxbourdon is parallel 4ths
// above the parallel 6ths), no parallel 5ths or octaves, no crossing, within an octave; a 2nd or a 7th only where
// one of the two is itself the dissonance against the bass (the 5/4 of a compound cadence). Three voices sound
// three notes of a chord: its 3rd is not doubled, nor the leading tone; in minor the chord on the dominant is
// major, its ⑦ raised (melodically, ⑥ and ⑦ go up raised toward the tonic, down natural). The figures of a chord
// (5/3, 6/3, 7/3, 4/2, 6/4, 5/4) say which intervals there are above the bass, not which voice has them: a 5/3 may
// leave out its 5th and double the bass (the book's (5)/3), never its 3rd; a 6/3 and a 7/3 sound complete.
//
// The realizations are counted exactly, drawn uniformly, or drawn by the engine with the soft rules of Studies
// 38–42 (soft.mjs).

import { melodicParts, verticalParts, total, choose, temperature, defaultWeights } from "./soft.mjs";

const mod = (a, m) => ((a % m) + m) % m;
const sign = (x) => (x > 0) - (x < 0);

// ─── keys: a pitch is a degree (0 = the tonic of the bass's octave, 7 its octave) and, in minor, raised or not ───
const PAT = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"], WHITE = [0, 2, 4, 5, 7, 9, 11];
const ACC = { "-2": "𝄫", "-1": "♭", 0: "", 1: "♯", 2: "𝄪" };

/** A key: {tonic: "C" | "A" | "Bb" | "F#"…, mode: "major" | "minor"}. Degree 0 is the tonic in the bass's octave
 *  (C3 to F3, F♯2 to B2). */
export function keyOf(k = {}) {
  const name = k.tonic || "C", mode = k.mode === "minor" ? "minor" : "major";
  const L = LETTERS.indexOf(name[0].toUpperCase());
  if (L < 0) throw new Error(`no such tonic: ${name}`);
  const acc = [...name.slice(1)].reduce((a, ch) => a + (ch === "#" || ch === "♯" ? 1 : ch === "b" || ch === "♭" ? -1 : 0), 0);
  const pc = mod(WHITE[L] + acc, 12);
  const oct = pc > 5 ? 2 : 3;
  const tonicMidi = 12 * (oct + 1) + WHITE[L] + acc;
  const pat = PAT[mode];
  /** Semitones above the tonic of a degree d, raised (r = 1) or not. */
  const semi = (d, r = 0) => 12 * Math.floor(d / 7) + pat[mod(d, 7)] + r;
  const midi = (d, r = 0) => tonicMidi + semi(d, r);
  const name_ = (d, r = 0) => {
    const la = 7 * oct + L + d, o = Math.floor(la / 7), l = mod(la, 7);
    const a = midi(d, r) - (12 * (o + 1) + WHITE[l]);
    return LETTERS[l] + (ACC[a] ?? (a > 0 ? "+" + a : String(a))) + o;
  };
  /** Whether a degree has two forms in this key (⑥ and ⑦ in minor). */
  const mutable = (d) => mode === "minor" && mod(d, 7) >= 5;
  return { tonic: name, mode, tonicMidi, letter: L, pc, oct, semi, midi, name: name_, mutable, pattern: pat,
           hz: (d, r = 0) => 440 * Math.pow(2, (midi(d, r) - 69) / 12),
           circled: (d) => "①②③④⑤⑥⑦"[mod(d, 7)] };
}

// ─── the schemata of chapter 1, as data ───
// A schema: its events, each [degree of the bass, units it lasts, the figures over each of its units]. A unit is
// half a bar; phase 1 begins on a weak unit (an upbeat). The bass's ⑥ and ⑦ in minor are raised when the next note
// is a step up, and natural otherwise.
const run = (from, to, len, figs) => { const out = []; for (let d = from; from > to ? d >= to : d <= to; d += from > to ? -1 : 1) out.push([d, len, figs]); return out; };
export const SCHEMATA = {
  thirds: { name: "parallel thirds", ref: "IJzerman 1.1, ex. 1.4(a), 1.6(a)", about: "the scale up and down, the upper voice a third above it; an imperfect cadence, 3–3 on ②–①",
            events: [...run(0, 7, 2, [3, 3]), ...run(6, 1, 2, [3, 3]), [0, 1, [3]]] },
  sixths: { name: "parallel sixths", ref: "IJzerman 1.1, ex. 1.4(b), 1.6(c)", about: "the same scale in sixths: it starts and ends on the octave, and the high ① takes a third; a perfect cadence, 6–8",
            events: [[0, 2, [8, 8]], ...run(1, 6, 2, [6, 6]), [7, 2, [3, 3]], ...run(6, 1, 2, [6, 6]), [0, 1, [8]]] },
  "3-6": { name: "3–6 progression", ref: "IJzerman 1.2, ex. 1.10–1.12", about: "a third and a sixth on each bass note of a descending scale: the upper voice falls by fifths and rises by fourths",
           events: [...run(7, 2, 2, [3, 6]), [1, 2, [6, 6]], [0, 1, [8]]] },
  "third-down": { name: "Third Down Second Up", ref: "IJzerman 1.2, ex. 1.14–1.17", about: "the bass falls a third and rises a step, 3 and 6 by turns: underneath, a stepwise descent",
                  events: [[7, 2, [3, 3]], [5, 2, [6, 6]], [6, 2, [3, 3]], [4, 2, [6, 6]], [5, 2, [3, 3]], [3, 2, [6, 6]], [4, 2, [3, 3]], [2, 2, [6, 6]], [3, 2, [3, 3]], [1, 2, [6, 6]], [0, 1, [8]]] },
  "7-6": { name: "7–6 suspensions", ref: "IJzerman 1.3, ex. 1.19–1.20, 1.24(a)", about: "parallel sixths with a seventh inserted: tied in the upper voice, prepared, struck on the strong unit and resolved; a compound cadence 7–6–8",
           phase: 1, events: [[7, 1, [8]], [8, 2, [7, 6]], ...run(7, 1, 2, [7, 6]), [0, 1, [8]]] },
  "2-3": { name: "2–3 suspensions", ref: "IJzerman 1.3, ex. 1.22–1.24(b)", about: "the 7–6 inverted: the ties in the bass, which holds its note under a second and resolves down to a third; a compound cadence 2–3–1",
           events: [[7, 3, [3, 3, 2]], ...run(6, 0, 2, [3, 2]), [-1, 1, [3]], [0, 1, [8]]] },
  "7-3": { name: "Fifth Down Fourth Up (7–3)", ref: "IJzerman 1.4, ex. 1.27–1.28, 1.31(a)", about: "a 7–6 whose bass moves with the resolution, up a fourth: the circle of fifths seen from the bass; it closes with the leaping compound cadence 7–3–8 on ②–⑤–①",
           phase: 1, events: [[5, 1, [6]], [4, 1, [7]], [7, 1, [3]], [3, 1, [7]], [6, 1, [3]], [2, 1, [7]], [5, 1, [3]], [1, 1, [7]], [4, 1, [3]], [0, 1, [8]]] },
  "tied-bass": { name: "Tied Bass (2–6)", ref: "IJzerman 1.4, ex. 1.29–1.31(b)", about: "a 2–3 whose upper voice moves with the resolution, to a sixth: rising fourths and falling fifths over a syncopated bass; a compound cadence 7–6–8",
                 events: [[7, 3, [3, 3, 2]], ...run(6, 3, 2, [6, 2]), [2, 1, [6]], [1, 2, [7, 6]], [0, 1, [8]]] },
};

// The prototypes of chapter 1 as the book writes them (C major, A minor): the upper voice unit by unit (a note held
// is written again), and the cadence the book names. Each is a realization of its schema (the tests judge them).
const twice = (s) => s.split(" ").flatMap((x) => [x, x]);
export const PROTOTYPES = {
  thirds: { key: { tonic: "C" }, upper: [...twice("E4 F4 G4 A4 B4 C5 D5 E5 D5 C5 B4 A4 G4 F4"), "E4"], cadence: "imperfect" },
  "thirds-minor": { schema: "thirds", key: { tonic: "A", mode: "minor" }, upper: [...twice("C4 D4 E4 F#4 G#4 A4 B4 C5 B4 A4 G4 F4 E4 D4"), "C4"], cadence: "imperfect" },
  sixths: { key: { tonic: "C" }, upper: [...twice("C5 B4 C5 D5 E5 F5 G5 E5 G5 F5 E5 D5 C5 B4"), "C5"], cadence: "perfect" },
  "3-6": { key: { tonic: "C" }, upper: ["E5", "A5", "D5", "G5", "C5", "F5", "B4", "E5", "A4", "D5", "G4", "C5", "B4", "B4", "C5"], cadence: "perfect" },
  "third-down": { key: { tonic: "C" }, upper: [...twice("E5 F5 D5 E5 C5 D5 B4 C5 A4 B4"), "C5"], cadence: "perfect" },
  "7-6": { key: { tonic: "C" }, upper: ["C6", "C6", "B5", "B5", "A5", "A5", "G5", "G5", "F5", "F5", "E5", "E5", "D5", "D5", "C5", "C5", "B4", "C5"], cadence: "compound" },
  "2-3": { key: { tonic: "A", mode: "minor" }, upper: [...twice("C5 B4 A4 G4 F4 E4 D4 C4 B3"), "A3"], cadence: "compound" },
  "7-3": { key: { tonic: "A", mode: "minor" }, upper: ["D5", "D5", "C5", "C5", "B4", "B4", "A4", "A4", "G#4", "A4"], cadence: "compound (leaping)" },
  "tied-bass": { key: { tonic: "C" }, upper: ["E5", "E5", "D5", "G5", "C5", "F5", "B4", "E5", "A4", "D5", "G4", "C5", "C5", "B4", "C5"], cadence: "compound" },
};


/** The bass of a schema in a key, unit by unit: {d, r, struck, fig: [figures] | null}. */
export function bassOf(schema, key) {
  const K = key.semi ? key : keyOf(key);
  const ev = schema.events, units = [];
  ev.forEach(([d, len, figs], i) => {
    const next = ev[i + 1];
    const r = K.mutable(d) && next && next[0] === d + 1 ? 1 : 0;
    const dominant = isDominant(d, next && next[0]);
    for (let j = 0; j < len; j++) units.push({ d, r, struck: j === 0, fig: figs ? [].concat(figs[Math.min(j, figs.length - 1)]) : null, dominant });
  });
  return units;
}
/** Whether a bass note on degree d is a dominant: ⑤ going to ① (or ⑥, deceptive), or closing the phrase (half) —
 *  not a ⑤ passed in a sequence. */
export function isDominant(d, next) {
  if (mod(d, 7) !== 4) return false;
  return next === undefined || next === null || [0, 5].includes(mod(next, 7));
}

// ─── the figures: a class of interval (degrees apart, modulo 7) and its number ───
const FIG_CLASS = (f) => mod(f - 1, 7);                      // 8 → 0, 3 and 10 → 2, 9 → 1 …
const CLASS_FIG = [8, 2, 3, 4, 5, 6, 7];

/**
 * spec: {schema (a name or {events, phase}), key: {tonic, mode}, figured (true: the upper voice realizes the
 *        figures), lo, hi (the upper voice's range, in degrees: 7 the tonic above the bass's, 21 two octaves
 *        higher), spacing (degrees between the voices at most), maxHold (units a note may last, held: 2), line
 *        (how strictly the line moves: "free", "moderate", "strict")}
 */
export function schemata(spec = {}) {
  const schema = typeof spec.schema === "string" ? SCHEMATA[spec.schema] : spec.schema || SCHEMATA.thirds;
  if (!schema) throw new Error(`no such schema: ${spec.schema}`);
  const K = keyOf(spec.key || { tonic: schema.tonic || "C", mode: schema.mode || "major" });
  const B = spec.bass || bassOf(schema, K);
  const n = B.length, n_ = n, phase = schema.phase ?? spec.phase ?? 0;
  const lo = spec.lo ?? 7, hi = spec.hi ?? 21, spacing = spec.spacing ?? 16, maxHold = spec.maxHold ?? 2;
  const figured = spec.figured ?? true;
  // how strictly the line moves, beyond the rules below (spec.line, as the counterpoint of Studies 38–42 asks of a
  // melody): "free", those rules alone; "moderate", a leap of a 5th or more turns back by step; "strict", leaps up to
  // a 5th (or the octave), a leap of a 4th or more turns back by step, and no two leaps in a row the same way. (It
  // looks at the move before the note's only, as the rules do: the count's memo stays sound.)
  const line = spec.line || "free";
  const lineError = (before, step) => {
    if (line === "free") return null;
    const a = Math.abs(step), b = before === null ? 0 : Math.abs(before);
    if (line === "strict" && a > 4 && a !== 7) return "a leap wider than a 5th (but the octave)";
    if (b >= (line === "strict" ? 3 : 4) && !(a === 1 && sign(step) !== sign(before))) return `after a leap of a ${line === "strict" ? "4th" : "5th"} or more the line turns back by step`;
    if (line === "strict" && b >= 2 && a >= 2 && sign(step) === sign(before)) return "two leaps in a row the same way";
    return null;
  };
  // the rules of the Rule of the Octave (chapter 4, spec.ro): the augmented 4th and the diminished 5th over the bass
  // are semi-consonances — they need no preparation, but resolve, the 4th up to a 6th and the 5th down to a 3rd —;
  // and over a passing bass (struck a step from the note before, going on a step the same way: the descending ④'s
  // 4/2) an upper voice may sound a note of the chord before (held, or taken from the other upper voice), a
  // dissonance now, consonant again when the bass moves on — the note held, or moving by step
  const ro = !!spec.ro;
  const strong = (t) => (B[t] && B[t].strong !== undefined ? B[t].strong : (t + phase) % 2 === 0);
  const middle = spec.voice === "middle";

  // a note of the upper voice is a code: 3·degree + its alteration + 1, the degree in the key's letters (0 its tonic
  // in the bass's octave) and the alteration in semitones from the key's own scale (−1, 0, +1: in minor ⑥ and ⑦
  // raised are +1)
  const D = codeDegree, A = codeAlter;
  const semiU = (c) => K.semi(D(c), A(c));
  const semiB = (t) => K.semi(B[t].d, B[t].r || 0);
  // the key of each unit (chapter 4: a bass note may carry its own, as the book boxes the keys of a modulating
  // sequence; else the key of the whole): a note's degree and alteration read in it
  const LOC = B.map((b) => localOf(K, b.key));
  /** The degree (0 its tonic … 6) and the alteration of the note c in the key of unit t. */
  const loc = (t, c) => localNote(K, LOC[t], D(c), A(c));
  /** The degree of the bass at unit t in its key. */
  const locB = (t) => localNote(K, LOC[t], B[t].d, B[t].r || 0).deg;
  /** Whether c is a note of the key of unit t: its scale, and in minor ⑥ and ⑦ raised too. */
  const inKey = (t, c) => { const l = loc(t, c); return l.alt === 0 || (l.alt === 1 && LOC[t].key.mode === "minor" && l.deg >= 5); };
  const codes = [];
  for (let d = lo; d <= hi; d++) for (const a of [-1, 0, 1]) { const c = codeOf3(d, a); if (B.some((b, t) => inKey(t, c))) codes.push(c); }

  /** The vertical at unit t with the upper note c: {steps, cls, q: "perfect" | "imperfect" | "dissonant"}. */
  function vertical(t, c) {
    const steps = D(c) - B[t].d, cls = mod(steps, 7), s = mod(semiU(c) - semiB(t), 12);
    const q = cls === 0 ? (s === 0 ? "perfect" : "dissonant") : cls === 4 ? (s === 7 ? "perfect" : "dissonant")
            : cls === 2 ? (s === 3 || s === 4 ? "imperfect" : "dissonant") : cls === 5 ? (s === 8 || s === 9 ? "imperfect" : "dissonant") : "dissonant";
    // the augmented 4th and the diminished 5th over the bass: chapter 4's semi-consonances
    const tri = s === 6 ? (cls === 3 ? "A4" : cls === 4 ? "d5" : null) : null;
    return { steps, cls, q, tri };
  }
  const consonant = (v) => v.q !== "dissonant";
  /** Whether the bass at unit t passes: struck a step from the note before, the next note a step on the same way. */
  function bassPassing(t) {
    if (t < 1 || !B[t].struck) return false;
    let j = t + 1; while (j < n && !B[j].struck) j++;
    if (j >= n) return false;
    const a = B[t].d - B[t - 1].d, b = B[j].d - B[t].d;
    return Math.abs(a) === 1 && a === b;
  }

  /** Why a move of the upper voice from a to b (struck) is not melodic, or null. */
  function melodicError(a, b, t = 0) {
    const n = Math.abs(D(b) - D(a)), s = Math.abs(semiU(b) - semiU(a));
    if (n === 0) return "a chromatic step";
    if (n === 1) return s <= 2 ? null : "an augmented 2nd";
    if (n === 2) return s === 3 || s === 4 ? null : "this 3rd";
    if (n === 3) return s === 5 ? null : "an augmented 4th";
    if (n === 4) return s === 6 || s === 7 ? null : "an augmented 5th";
    if (n === 5) return s === 8 || s === 9 ? null : "this 6th";
    if (n === 6) return LOC[Math.min(t, n_ - 1)].key.mode === "minor" && s === 9 ? null : "a 7th (only the diminished one, in minor)";
    if (n === 7) return s === 12 ? null : "this octave";
    return "a leap wider than the octave";
  }

  /** The note struck before the one sounding at unit j in U (its index), or −1. */
  const onsetOf = (U, j) => { let i = j; while (i > 0 && U[i - 1] === U[j]) i--; return i; };

  /** Why the dissonance c at unit t, after prev, is refused by the rules of chapters 1–3 (a suspension prepared, a
   *  passing tone by step), or null. (It looks at prev only: the count's memo stays sound.) */
  function dissonance(t, c, prev, delayed) {
    const v = vertical(t, c), held = prev !== null && c === prev, struck = !held;
    if (strong(t)) {
      const bassHeld = !B[t].struck;
      // an accented passing tone, where the schema asks for one: struck by step from a consonance (it resolves
      // down by step on the next unit)
      const ap = B[t].ap && !held && !bassHeld && t >= 1 && Math.abs(D(c) - D(prev)) === 1 && consonant(vertical(t - 1, prev));
      if (!ap && held === bassHeld) return held ? "a dissonance with both voices held" : `a ${CLASS_FIG[v.cls]} (dissonant) on a strong unit must be prepared, one voice holding its note`;
      if (!delayed && !consonant(vertical(t - 1, prev))) return "a suspension is prepared by a consonance";
      if (held && !(v.cls === 6 || v.cls === 3 || (v.cls === 1 && v.steps >= 8))) return "held in the upper voice: a 7th, a 4th or a 9th";
      if (bassHeld && v.cls !== 1 && v.cls !== 3) return "held in the bass: a 2nd or a 4th (2–3, 4/2)";
    } else {
      if (B[t].struck) return "a dissonance on a weak unit: over a held bass";
      if (!struck || t === 0 || Math.abs(D(c) - D(prev)) !== 1) return "a dissonance on a weak unit passes by step";
      if (!consonant(vertical(t - 1, prev))) return "two dissonances in a row";
    }
    return null;
  }
  /** Why the upper note c at unit t (after U[0..t-1]) is refused, or null. */
  function check(U, t, c) {
    if (t >= n) return "the work is finished";
    if (D(c) < lo || D(c) > hi) return "out of range";
    if (!inKey(t, c)) return `not a note of ${LOC[t].key.tonic} ${LOC[t].key.mode}`;
    const v = vertical(t, c);
    // the voices
    if (v.steps < 0) return "below the bass";
    if (v.steps === 0 && t < n - 1) return "the unison with the bass (only at the end)";
    if (v.steps > spacing) return "too far from the bass";
    if (figured && B[t].fig && !B[t].fig.some((f) => FIG_CLASS(f) === v.cls)) return `the figures ask for ${B[t].fig.join(" or ")}`;
    // in minor the chord on a dominant ⑤ is major: its ⑦ raised (not over a ⑤ passed in a sequence, nor in a 6/3
    // on ⑤, a chord on ③)
    { const l = loc(t, c);
      if (LOC[t].key.mode === "minor" && B[t].dominant && B[t].chord !== "6/3" && l.deg === 6 && l.alt !== 1)
        return `the chord on the dominant is major: ${K.name(D(c), A(c) + 1)}, not ${K.name(D(c), A(c))}`;
      // chapter 4: in minor the 6/3 on ② going to ① takes the leading tone (the RO's 6♯ on ②)
      if (ro && LOC[t].key.mode === "minor" && l.deg === 6 && l.alt !== 1 && locB(t) === 1 && t + 1 < n) {
        let j = t + 1; while (j < n && !B[j].struck) j++;
        if (j < n && locB(j) === 0 && Math.abs(B[j].d - B[t].d) === 1) return `over ② going to ① the leading tone: ${K.name(D(c), A(c) + 1)}, not ${K.name(D(c), A(c))}`;
      } }
    const prev = t >= 1 ? U[t - 1] : null;
    const held = prev !== null && c === prev, struck = !held;
    // a 7th held into the 4th over the next bass (the 7th of ② held into the 6/4 or 5/4 over ⑤, ii7 → V): its
    // resolution put off by one chord, the 4th then resolving down by step; held a unit longer than a note may be
    // (Study 54: spec.delayed, on by default)
    const delayed = (spec.delayed ?? true) && held && t >= 1 && B[t].struck && strong(t) && strong(t - 1) &&
                    vertical(t - 1, prev).q === "dissonant" && vertical(t - 1, prev).cls === 6 && v.q === "dissonant" && v.cls === 3;
    // the line: a note held two units at most; the moves struck
    if (held) {
      const on = onsetOf(U, t - 1);
      if (t - on >= maxHold + (delayed ? 1 : 0)) return `a note is held ${maxHold} units at most`;
    } else if (prev !== null) {
      const e = melodicError(prev, c, t); if (e) return e;
      const on = onsetOf(U, t - 1), a1 = on >= 1 ? U[on - 1] : null;
      const step = D(c) - D(prev);
      if (a1 !== null && Math.abs(D(prev) - D(a1)) >= 3 && sign(step) === sign(D(prev) - D(a1))) return "after a leap of a 4th or more the line turns";
      { const e = lineError(a1 === null ? null : D(prev) - D(a1), step); if (e) return e; }
      // in minor: ⑥ and ⑦ go up raised and down natural (read in the key of the unit before, where the note was)
      const lp = loc(t - 1, prev), lc = loc(t, c), minorP = LOC[t - 1].key.mode === "minor" && lp.deg >= 5;
      if (minorP && Math.abs(step) === 1) {
        if (step > 0 && lp.alt !== 1) return `${K.name(D(prev), A(prev))} goes up raised (melodic minor)`;
        if (step < 0 && lp.alt === 1) return `${K.name(D(prev), A(prev))} goes down natural (melodic minor)`;
      }
      // the raised ⑥ is only on the way up to the tonic: it goes on up to the raised ⑦
      if (minorP && lp.deg === 5 && lp.alt === 1 && !(step === 1 && lc.alt === 1))
        { const up = [-1, 0, 1].map((x) => codeOf3(D(prev) + 1, x)).find((x) => { const l = loc(t - 1, x); return l.deg === 6 && l.alt === 1; });
          return `${K.name(D(prev), A(prev))} goes on up to ${up === undefined ? "the raised ⑦" : K.name(D(up), A(up))} (melodic minor, toward the tonic)`; }
    }
    // what the unit before asks
    if (t >= 1 && !delayed) {
      const pv = vertical(t - 1, prev);
      // chapter 4: a semi-consonance resolves, the augmented 4th up to a 6th, the diminished 5th down to a 3rd; a note
      // held over a passing bass is held on, or moves by step, into a consonance — and where only these rules let the
      // dissonance in, only they let it out
      let special = false, ok4 = false;
      if (ro && !consonant(pv)) {
        const pp = t >= 2 ? U[t - 2] : null;
        const pdel = (spec.delayed ?? true) && pp !== null && prev === pp && B[t - 1].struck && strong(t - 1) && t >= 2 && strong(t - 2) &&
                     vertical(t - 2, pp).q === "dissonant" && vertical(t - 2, pp).cls === 6 && pv.cls === 3;
        special = dissonance(t - 1, prev, pp, pdel) !== null;
        const semiOk = pv.tri && struck && ((pv.tri === "A4" && D(c) === D(prev) + 1 && v.cls === 5) || (pv.tri === "d5" && D(c) === D(prev) - 1 && v.cls === 2));
        // (a semi-consonance resolves as one, wherever it came from)
        const passOk = !pv.tri && bassPassing(t - 1) && consonant(vertical(t - 2 >= 0 ? t - 2 : 0, prev)) && consonant(v) && (held || Math.abs(D(c) - D(prev)) === 1);
        ok4 = semiOk || passOk;
        if (special && !ok4) return pv.tri ? (pv.tri === "A4" ? "the augmented 4th resolves up to a 6th" : "the diminished 5th resolves down to a 3rd") : "over the passing bass the held note goes on into a consonance";
      }
      if (!consonant(pv) && !special && !ok4) {
        if (strong(t - 1)) {
          // the suspension before resolves: the voice that held it goes down a step, to a consonance
          const upperHeld = t >= 2 && U[t - 2] === prev, bassHeldBefore = !B[t - 1].struck;
          if (upperHeld || !bassHeldBefore) { if (!(struck && D(c) === D(prev) - 1)) return upperHeld ? "the suspension resolves down by step (the upper voice)" : "the accented passing tone resolves down by step"; }
          else if (!(B[t].struck && B[t].d === B[t - 1].d - 1)) return "the suspension resolves down by step (the bass)";
          // (chapter 4: or to a semi-consonance — the 7th over ⑥ resolving to the diminished 5th over ⑦, Bach's
          // ascending tetrachords — which resolves in its turn)
          if (!consonant(v) && !(ro && v.tri)) return "the suspension resolves to a consonance";
        } else {
          // a passing tone goes on by step, the same way
          const a = U[onsetOf(U, t - 1) - 1];
          if (!(struck && D(c) - D(prev) === D(prev) - D(a))) return "the passing tone goes on by step, the same way";
        }
      }
    }
    if (!consonant(v)) {
      if (t === n - 1) return "the work does not end on a dissonance";
      const e = dissonance(t, c, prev, delayed);
      // chapter 4: a semi-consonance enters freely; over a passing bass a note of the chord before may sound (one
      // consonant over the bass before: held, or the upper voices exchanging their notes)
      if (e && !(ro && (v.tri || (bassPassing(t) && consonant(vertical(t - 1, c)) && (held || spec.exchange))))) return e;
    }
    // parallels and direct motion into a perfect consonance
    if (t >= 1 && v.q === "perfect" && struck && B[t].struck) {
      const pv = vertical(t - 1, prev);
      const bm = B[t].d - B[t - 1].d, um = D(c) - D(prev);
      if (pv.q === "perfect" && pv.cls === v.cls && (bm !== 0 || um !== 0)) return `parallel ${v.cls === 0 ? "octaves" : "5ths"}`;
      if (sign(bm) === sign(um) && bm !== 0 && Math.abs(um) > 1) return `${v.cls === 0 ? "an octave" : "a 5th"} by direct motion, the upper voice leaping`;
    }
    // the start and the end
    if (t === 0 && !middle && !(figured && B[0].fig) && locB(0) === 0 && ![0, 2, 4].includes(v.cls)) return "over ① the upper voice starts on an octave, a 5th or a 3rd";
    if (t === n - 1 && !middle) {
      if (![0, 2].includes(v.cls)) return "it ends on an octave or a 3rd";
      if (prev !== null && Math.abs(D(c) - D(prev)) !== 1) return "the last note is reached by step";
    }
    return null;
  }

  // ─── the count, exact, memoized on the last three units (the rules look no further back) ───
  const memo = new Map();
  const keyOfU = (U, t) => t + ":" + U.slice(Math.max(0, t - 3), t).join(",");
  function countFrom(U) {
    const t = U.length;
    if (t >= n) return 1n;
    const k = keyOfU(U, t), got = memo.get(k);
    if (got !== undefined) return got;
    let v = 0n;
    for (const c of codes) if (check(U, t, c) === null) { U.push(c); v += countFrom(U); U.pop(); }
    memo.set(k, v);
    return v;
  }
  const count = (U = []) => (U.length > n ? 0n : countFrom([...U]));
  /** The candidates for the next unit: {note, name, reason} or {note, name, futures}. */
  const fan = (U = []) => codes.map((c) => {
    const r = check(U, U.length, c);
    return r ? { note: c, name: K.name(D(c), A(c)), reason: r } : { note: c, name: K.name(D(c), A(c)), reason: null, futures: count([...U, c]) };
  });
  /** A whole realization, drawn uniformly from the futures (r in [0, 1)). */
  function sample(r = Math.random, U0 = []) {
    const U = [...U0];
    while (U.length < n) {
      const cs = fan(U).filter((x) => !x.reason && x.futures > 0n);
      if (!cs.length) return null;
      const tot = cs.reduce((a, x) => a + x.futures, 0n);
      // a BigInt below tot, uniform enough: 52 random bits scaled
      let x = (tot * BigInt(Math.floor(r() * 2 ** 52))) / 2n ** 52n;
      const pick = cs.find((c) => (x -= c.futures) < 0n) || cs[cs.length - 1];
      U.push(pick.note);
    }
    return U;
  }
  // ─── the soft rules: what a candidate costs, and the engine ───
  // (the 3–6 alternation is a schema here, not a habit to avoid: its weight is 0 unless asked)
  const W = { ...defaultWeights(), alternation: 0, ...(spec.weights || {}) };
  const bassLine = B.map((b) => b.d);
  const softCtx = (t, c) => ({
    N: 7, strong: (u) => strong(u),
    lowerFirst: (x, y) => [x, y],                                // the bass is the lower voice
    quality: (lo_, hi_) => { const st = hi_ - lo_, cl = mod(st, 7); return cl === 0 || cl === 4 ? "perfect" : cl === 2 || cl === 5 ? "imperfect" : "dissonant"; },
    dissonant: () => vertical(t, c).q === "dissonant",
    suspension: vertical(t, c).q === "dissonant" && strong(t),
  });
  /** The soft cost of the upper note c after U, by rule: {id: cost}. */
  function costParts(U, c) {
    const t = U.length, up = U.map(D);
    return { ...melodicParts(up, D(c), W), ...verticalParts(bassLine.slice(0, t), up, bassLine[t], D(c), softCtx(t, c), W) };
  }
  /** The engine: the voice continued from U to the end, each note a softmax of −cost / temperature among those
   *  with a future ({temp: 1, follow: true (colder where few futures are left), r}). */
  function engine({ temp = 1, follow = true, r = Math.random } = {}, U0 = []) {
    const U = [...U0];
    while (U.length < n) {
      const cs = fan(U).filter((x) => !x.reason && x.futures > 0n).map((x) => ({ ...x, parts: costParts(U, x.note) }));
      cs.forEach((x) => { x.cost = total(x.parts); });
      const pick = choose(cs, temperature(temp, follow, count(U)), r);
      if (!pick) return null;
      U.push(pick.note);
    }
    return U;
  }
  // ─── what is essentially new: the figures, not the octave nor how a bar is divided ───
  // Two realizations are the same figuring when they make the same vertical (its figure and its size in semitones)
  // on every unit: a note taken up an octave, or struck again an octave away on the weak unit, is the same music.
  // The figurings are counted exactly by sets: from the set of the voices' last notes that a figuring leaves possible,
  // each next figure leads to one set.
  // (structural: only the strong units and the last are figured — what the weak ones do is how the bar is divided)
  const structural = spec.structural ?? true;
  const sigOf = (t, c) => { if (structural && !strong(t) && t < n - 1) return -1; const v = vertical(t, c); return v.cls * 12 + mod(semiU(c) - semiB(t), 12); };
  const windowOf = (U, t) => U.slice(Math.max(0, t - 3), t);
  const asU = (w, t) => { const U = new Array(t); w.forEach((c, i) => { U[t - w.length + i] = c; }); return U; };
  const fmemo = new Map();
  /** The next sets from a set of windows at unit t, by figure: Map(sig → windows). */
  function nextSets(S, t) {
    const by = new Map();
    for (const w of S) {
      const U = asU(w, t);
      for (const c of codes) {
        if (check(U, t, c) !== null) continue;
        const U2 = [...U, c];
        if (countFrom(U2) === 0n) continue;
        const k = sigOf(t, c);
        if (!by.has(k)) by.set(k, new Map());
        const w2 = windowOf(U2, t + 1), wk = w2.join(",");
        by.get(k).set(wk, w2);
      }
    }
    return by;
  }
  function figuringsFrom(S, t) {
    if (t >= n) return 1n;
    const key = t + "|" + [...S.keys()].sort().join(";");
    const got = fmemo.get(key);
    if (got !== undefined) return got;
    let v = 0n;
    for (const S2 of nextSets([...S.values()], t).values()) v += figuringsFrom(S2, t + 1);
    fmemo.set(key, v);
    return v;
  }
  /** The essentially different realizations: how many figurings the rules allow over the bass. */
  const figurings = () => figuringsFrom(new Map([["", []]]), 0);
  /** The figuring of a voice: a figure a unit (with its accidental when it is not the key's). */
  const figuringOf = (U) => U.map((c, t) => sigOf(t, c));
  /** A figuring drawn uniformly among them (then realized by the engine): an array of signatures. */
  function sampleFiguring(r = Math.random) {
    let S = new Map([["", []]]); const out = [];
    for (let t = 0; t < n; t++) {
      const opts = [...nextSets([...S.values()], t).entries()].map(([k, S2]) => [k, S2, figuringsFrom(S2, t + 1)]);
      const tot = opts.reduce((a, o) => a + o[2], 0n);
      if (!tot) return null;
      let x = (tot * BigInt(Math.floor(r() * 2 ** 52))) / 2n ** 52n;
      const o = opts.find((o) => (x -= o[2]) < 0n) || opts[opts.length - 1];
      out.push(o[0]); S = o[1];
    }
    return out;
  }
  /** The engine's voice for a given figuring: each note among those that make its figure. */
  function realize(sig, opts = {}) {
    const U = [];
    while (U.length < n) {
      const t = U.length;
      const cs = fan(U).filter((x) => !x.reason && x.futures > 0n && sigOf(t, x.note) === sig[t]).map((x) => ({ ...x, parts: costParts(U, x.note) }));
      // (a note must also leave the rest of the figuring possible)
      const ok = cs.filter((x) => figuringPossible(sig, [...U, x.note]));
      ok.forEach((x) => { x.cost = total(x.parts); });
      const pick = choose(ok, opts.temp ?? 0.5, opts.r || Math.random);
      if (!pick) return null;
      U.push(pick.note);
    }
    return U;
  }
  function figuringPossible(sig, U) {
    let S = [windowOf(U, U.length)];
    for (let t = U.length; t < n; t++) { const by = nextSets(S, t), S2 = by.get(sig[t]); if (!S2) return false; S = [...S2.values()]; }
    return true;
  }

  /** What a whole voice costs, note by note. */
  const cost = (U) => U.reduce((a, c, t) => a + total(costParts(U.slice(0, t), c)), 0);

  /** Why a whole voice is refused (the first unit that refuses it), or null. */
  function judge(U) {
    if (U.length !== n) return `${U.length} units, the bass has ${n}`;
    for (let t = 0; t < n; t++) { const r = check(U.slice(0, t), t, U[t]); if (r) return `unit ${t + 1}: ${r}`; }
    return null;
  }

  // ─── analysis: the figures a voice realizes, what each dissonance is, the cadence ───
  function figures(U) {
    return U.map((c, t) => {
      if (c === undefined || c === null) return null;
      const v = vertical(t, c);
      const f = v.cls === 0 ? (v.steps === 0 ? 1 : 8) : v.cls === 1 && v.steps >= 8 && t >= 1 && U[t - 1] === c ? 9 : CLASS_FIG[v.cls];
      let role = null;
      if (!consonant(v)) role = strong(t) ? (U[t - 1] === c ? "s (upper)" : "s (bass)") : "pt";
      else if (t >= 1 && !consonant(vertical(t - 1, U[t - 1])) && strong(t - 1)) role = "r";
      if (t + 1 < U.length && U[t + 1] !== undefined && !consonant(vertical(t + 1, U[t + 1])) && strong(t + 1)) role = role === "r" ? "r/p" : "p";
      return { fig: f, q: v.q, role };
    });
  }
  function cadence(U) {
    if (U.length !== n || n < 3) return null;
    const F = figures(U), last = F[n - 1].fig, a = F[n - 2].fig, z = F[n - 3].fig;
    const bassLeap = Math.abs(B[n - 1].d - B[n - 2].d) > 1;
    if (F[n - 3].role === "s (upper)" || F[n - 3].role === "s (bass)") return { kind: "compound" + (bassLeap ? " (leaping)" : ""), figs: [z, a, last] };
    if (F[n - 2].role === "r" || F[n - 2].role === "r/p") return { kind: "compound" + (bassLeap ? " (leaping)" : ""), figs: [z, a, last] };
    return { kind: last === 8 || last === 1 ? "perfect" : "imperfect", figs: [a, last] };
  }

  return { spec, schema, key: K, bass: B, n, phase, strong, lo, hi, figured, codes, vertical, check, count, fan, sample, engine, cost, costParts, weights: W, figurings, figuringOf, sampleFiguring, realize, judge, figures, cadence,
           code: (name) => codeOf(K, name), name: (c) => K.name(D(c), A(c)), degree: D, raised: A, alter: A, hz: (c) => K.hz(D(c), A(c)), loc, locB, inKey, keys: LOC, bassPassing, memo };
}

/** The code of a note name in a key ("E5", "G#4", "Bb3"): 3·degree + alteration + 1, the degree in the key's letters
 *  (0 its tonic in the bass's octave) and the alteration in semitones from the key's scale (−1, 0, +1). */
export function codeOf(K, name) {
  const m = /^([A-Ga-g])([#♯b♭]*)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`not a note: ${name}`);
  const L = LETTERS.indexOf(m[1].toUpperCase()), acc = [...m[2]].reduce((a, ch) => a + (ch === "#" || ch === "♯" ? 1 : -1), 0), o = Number(m[3]);
  const d = 7 * o + L - (7 * K.oct + K.letter), midi = 12 * (o + 1) + WHITE[L] + acc, a = midi - K.midi(d, 0);
  if (Math.abs(a) > 1) throw new Error(`${name}: too far from ${K.tonic} ${K.mode}`);
  return codeOf3(d, a);
}
/** A code from a degree and an alteration; and back. */
export const codeOf3 = (d, a = 0) => 3 * d + a + 1;
export const codeDegree = (c) => Math.floor(c / 3);
export const codeAlter = (c) => c - 3 * Math.floor(c / 3) - 1;
/** The key k (or the home key K) as seen from K: its tonic's letters and semitones above K's, and k itself. */
export function localOf(K, k) {
  const L = k ? (k.semi ? k : keyOf(k)) : K;
  return { key: L, o: mod(L.letter - K.letter, 7), s: mod(L.pc - K.pc, 12) };
}
/** A note of K (its degree d and alteration a) read in a local key: its degree there (0 … 6) and its alteration from
 *  that key's scale. */
export function localNote(K, lo, d, a) {
  const deg = mod(d - lo.o, 7), sem = mod(K.semi(d, a) - lo.s, 12);
  return { deg, alt: mod(sem - lo.key.pattern[deg] + 6, 12) - 6 };
}

// ─── chords: the classes of interval above the bass (0 the octave, 2 the 3rd, 4 the 5th, 5 the 6th…) ───
// need: every one of them sounds; ok: nothing else does
export const CHORDS = {
  "5/3": { need: [2], ok: [2, 4, 0] },
  "6/3": { need: [5, 2], ok: [5, 2] },
  // a sixth chord whose 3rd may be left out for the bass doubled — the book's 6/(3) on ④ in a Galant cadence
  "6": { need: [5], ok: [5, 2, 0] },
  "7/3": { need: [6, 2], ok: [6, 2] },
  "4/2": { need: [1, 3], ok: [1, 3, 5] },
  "6/4": { need: [5, 3], ok: [5, 3, 0] },
  "5/4": { need: [3], ok: [3, 4, 0] },
};
// (chapter 4: the 6/5 that may stand on the ascending ④, a sixth chord with its 5th, the 3rd left out in three parts)
CHORDS["6/5"] = { need: [5, 4], ok: [5, 4, 2] };

// ─── the Rule of the Octave (chapter 4): a chord for each degree of a scale in the bass, going up and going down ───
// ① and ⑤ stable (5/3), the degrees between them mobile (6/3); going down ④ passes under the chord of ⑤ (4/2), and
// in major ⑥ takes a raised 6th, a leading tone to ⑤ (read here as the key of ⑤: tonicize). The variants the book
// names: on the ascending ④ a 5/3 or a 6/5; a 7–6 on ⑥ (7/3); on the ascending ⑦ a diminished 5/3; on the
// descending ④ a 6/4 (after a complete 5/3 on ⑤).
export const RULE_OF_THE_OCTAVE = {
  up: ["5/3", "6/3", "6/3", "6/3", "5/3", "6/3", "6/3"],
  down: ["5/3", "6/3", "6/3", "4/2", "5/3", "6/3", "6/3"],
  variants: { up: { 3: ["5/3", "6/5"], 5: ["7/3"], 6: ["5/3"] }, down: { 3: ["6/4"], 5: ["7/3"] } },
  tonicize: { down: { 5: "the key of ⑤ (major): its raised 6th a leading tone to ⑤" } },
};
/** The Rule of the Octave's chord for a bass on degree deg (0 … 6) of a key in mode, going up or down (to the next
 *  bass note): {chord, key (a key to read it in, where it tonicizes: the descending ⑥ in major)}. */
export function octaveChord(deg, dir, mode = "major") {
  const chord = RULE_OF_THE_OCTAVE[dir === "down" ? "down" : "up"][mod(deg, 7)];
  return { chord, tonicize: dir === "down" && mod(deg, 7) === 5 && mode === "major" ? 4 : null };
}

const FIG = [8, 2, 3, 4, 5, 6, 7];
// where the chord's 3rd is, by its figures (a class above the bass; 0: the bass itself, as in a 6/3)
const THIRD = { "5/3": 2, "7/3": 2, "5/4": 2, "6/3": 0, "6": null, "6/4": 5, "4/2": 3, "6/5": 0 };

// ─── the phrase: a schema (chapter 2), then a cadence (chapter 3) ───
// An event: [degree of the bass, units, the chord over each unit]; a unit is half a bar. A schema may have its own
// meter (meter 1: every unit strong, a chord a beat, as the 7/3 chain moves). ap: a unit that allows an accented
// passing tone.
export const SCHEMATA3 = {
  fauxbourdon: { name: "Fauxbourdon", ref: "IJzerman 2.1, ex. 2.7", about: "parallel 6/3 chords on the scale, down from the high ①: the upper voices in 4ths, over the bass in 6ths and 3rds",
                 events: [[7, 2, ["5/3", "5/3"]], ...run(6, 1, 2, ["6/3", "6/3"]), [0, 2, ["5/3", "5/3"]]] },
  monte: { name: "Monte (5–6)", ref: "IJzerman 2.2, ex. 2.8–2.12", about: "a 5/3 and a 6/3 on each step of a rising bass: the middle voice in 10ths with it, the upper syncopated, 5–6",
           events: [...run(0, 2, 2, ["5/3", "6/3"])] },
  "fauxbourdon-76": { name: "7–6 Fauxbourdon", ref: "IJzerman 2.2, ex. 2.13–2.15", about: "the Monte's mirror: a 7/3 and a 6/3 on each step of a falling bass, the 7th prepared by the 6th before it",
                      events: [[7, 2, ["5/3", "6/3"]], ...run(6, 2, 2, ["7/3", "6/3"])] },
  romanesca: { name: "stepwise Romanesca", ref: "IJzerman 2.3, ex. 2.16–2.21", about: "a falling scale from ① to ③: a 5/3 on the strong units, a 6/3 on the weak, the middle voice in 3rds with the bass",
               events: [[7, 1, ["5/3"]], [6, 1, ["6/3"]], [5, 1, ["5/3"]], [4, 1, ["6/3"]], [3, 1, ["5/3"]], [2, 1, ["6/3"]]] },
  "fifths-73": { name: "Fifth Down Fourth Up (7/3)", ref: "IJzerman 2.4, ex. 2.22–2.25", about: "7/3 chords on falling 5ths and rising 4ths, a chord a beat: the 3rd of each chord held into the 7th of the next, the 7th resolving to the 3rd of the next",
                 meter: 1, events: [[7, 1, ["5/3"]], [3, 1, ["7/3"]], [6, 1, ["7/3"]], [2, 1, ["7/3"]], [5, 1, ["7/3"]], [1, 1, ["7/3"]]] },
  "tied-bass": { name: "Tied Bass (4/2–6/3)", ref: "IJzerman 2.5, ex. 2.26–2.30", about: "the 2–3 in three parts: each bass note tied over the bar, a 4/2 on the strong unit and the 6/3 of its resolution on the weak",
                 events: [[7, 3, ["5/3", "5/3", "4/2"]], ...run(6, 3, 2, ["6/3", "4/2"]), [2, 1, ["6/3"]]] },
};
// the cadences: ⑤ placed by the bass of the schema before it (the nearest), the rest after it
export const CADENCES = {
  simple: { name: "simple", ref: "IJzerman 3.1, ex. 3.5", about: "⑤–① with 5/3 chords only: perfect when the upper voice closes on 1̂, imperfect on 3̂",
            events: [[4, 2, ["5/3", "5/3"]], [0, 1, ["5/3"]]] },
  "compound-64": { name: "compound (6/4)", ref: "IJzerman 3.2, ex. 3.8", about: "⑤ parted into a 6/4 and a 5/3: the 4th held over from the chord before (a suspension), resolving to the 3rd",
                   events: [[4, 2, ["6/4", "5/3"]], [0, 1, ["5/3"]]] },
  "compound-54": { name: "compound (5/4)", ref: "IJzerman 3.2, ex. 3.8–3.10", about: "⑤ parted into a 5/4 and a 5/3: a 4–3 suspension in one of the upper voices",
                   events: [[4, 2, ["5/4", "5/3"]], [0, 1, ["5/3"]]] },
  galant: { name: "Galant", ref: "IJzerman 3.4, ex. 3.19–3.21", about: "④–⑤–①: a 6 on ④ (a 6/3, or the book's 6/(3), the bass doubled), then on ⑤ a 6/4–5/3 of accented passing tones (no preparation), each upper voice down a step to the 5/3, the upper voices in parallel 6ths or 3rds",
            events: [[3, 2, ["6", "6"]], [4, 2, ["6/4", "5/3"], { ap: [0] }], [0, 1, ["5/3"]]] },
  deceptive: { name: "deceptive", ref: "IJzerman 3.2, ex. 3.11–3.12", about: "a compound cadence whose bass goes up to ⑥ instead of ①: the middle voice goes down by step, the phrase asks to go on",
               events: [[4, 2, ["5/4", "5/3"]], [5, 1, ["5/3"]]] },
  half: { name: "half", ref: "IJzerman 3.1, ex. 3.1–3.2", about: "a close on the penultimate ⑤, on a strong unit: open, waiting for the answer",
          events: [[3, 2, ["5/3", "6/3"]], [4, 1, ["5/3"]]] },
};

/** The bass of a phrase, unit by unit: {d, r, struck, strong, chord, ap}. The cadence's degrees are placed in the
 *  octave nearest the end of the schema; in minor ⑥ and ⑦ are raised going up a step (and ⑦ before ①). */
export function phraseBass(schema, cadence, K) {
  const evs = [];
  schema.events.forEach(([d, len, figs]) => evs.push({ d, len, figs, meter: schema.meter || 2, part: "schema" }));
  if (cadence) {
    let last = evs.length ? evs[evs.length - 1].d : 0;
    const near = (deg) => { const base = deg % 7; let best = base; for (let o = -14; o <= 14; o += 7) if (Math.abs(base + o - last) < Math.abs(best - last)) best = base + o; return best; };
    for (const [deg, len, figs, extra] of cadence.events) { const d = near(deg); evs.push({ d, len, figs, meter: 2, part: "cadence", ap: extra && extra.ap }); last = d; }
  }
  // a dominant: ⑤ going to ① (or to ⑥, deceptive), or closing the phrase (half) — not a ⑤ passed in a sequence
  const dominantAt = (i) => isDominant(evs[i].d, evs[i + 1] && evs[i + 1].d);
  const units = [];
  let partStart = 0, part = null;
  evs.forEach((e, i) => {
    if (e.part !== part) { part = e.part; partStart = units.length; }
    const next = evs[i + 1];
    const r = K.mutable(e.d) && next && next.d === e.d + 1 ? 1 : 0;
    for (let j = 0; j < e.len; j++) {
      const k = units.length - partStart;
      units.push({ d: e.d, r, struck: j === 0, strong: e.meter === 1 ? true : k % 2 === 0, chord: e.figs[Math.min(j, e.figs.length - 1)], ap: !!(e.ap && e.ap.includes(j)), part: e.part, dominant: dominantAt(i) });
    }
  });
  return units;
}

/**
 * spec: {schema, cadence (a name, or null), key: {tonic, mode}, figured (the chords asked: true), top: [lo, hi],
 *        middle: [lo, hi] (degrees, 7 the tonic above the bass's), apart (degrees between the upper voices at most),
 *        line (how strictly the upper voices move: one for both, or {top, middle})}
 */
export function parts(spec = {}) {
  const schema = typeof spec.schema === "string" ? SCHEMATA3[spec.schema] : spec.schema || SCHEMATA3.fauxbourdon;
  const cadence = spec.cadence === null ? null : typeof spec.cadence === "string" ? CADENCES[spec.cadence] : spec.cadence || CADENCES.simple;
  if (!schema) throw new Error(`no such schema: ${spec.schema}`);
  const K = keyOf(spec.key || { tonic: "C" });
  // (spec.bass: the bass's units as they are, each with its chord and, chapter 4, its key — else the phrase's)
  const B = spec.bass || phraseBass(schema, cadence, K), n = B.length;
  const figured = spec.figured ?? true;
  const [tlo, thi] = spec.top || [9, 22], [mlo, mhi] = spec.middle || [4, 17];
  const apart = spec.apart ?? 7;
  const S = { schema: { events: [] }, key: K, bass: B, figured: false, ro: spec.ro, exchange: true };
  // (the upper voice may be two octaves and a 4th above the bass: a bass that leaps down to ⑤ at a cadence)
  // (spec.line: how strictly each upper voice moves, one for both or {top, middle})
  const lineOf = (who) => (spec.line && typeof spec.line === "object" ? spec.line[who] : spec.line);
  const T = schemata({ ...S, lo: tlo, hi: thi, voice: "top", spacing: spec.spacing ?? 18, weights: spec.weights, delayed: spec.delayed, line: lineOf("top") });
  const M = schemata({ ...S, lo: mlo, hi: mhi, voice: "middle", weights: spec.weights, delayed: spec.delayed, line: lineOf("middle") });
  const D = T.degree, A = T.alter;
  const semi = (c) => K.semi(D(c), A(c));

  /** Why the pair (a over b) at unit t is refused by the voices between them and the chord, or null. */
  function between(TT, MM, t, a, b) {
    if (D(b) >= D(a)) return "the middle voice under the upper";
    // chapter 4: over a passing bass a note of the chord before, not held, is the other voice's (the voices exchange)
    if (spec.ro && t >= 1 && T.bassPassing(t))
      for (const [x, own, other, V] of [[a, TT[t - 1], MM[t - 1], T], [b, MM[t - 1], TT[t - 1], M]])
        if (x !== own && V.vertical(t, x).q === "dissonant" && !V.vertical(t, x).tri && mod(semi(x) - semi(other), 12) !== 0) return "over the passing bass a dissonance is a note held, or taken from the other voice";
    if (D(a) - D(b) > apart) return "the upper voices within an octave";
    const cls = mod(D(a) - D(b), 7), s = mod(semi(a) - semi(b), 12);
    const perfect = (cls === 0 && s === 0) || (cls === 4 && s === 7);
    const vt = T.vertical(t, a), vm = M.vertical(t, b);
    if ((cls === 1 || cls === 6) && vt.q !== "dissonant" && vm.q !== "dissonant") return "a 2nd or a 7th between the upper voices, neither of them the dissonance";
    if (vt.q === "dissonant" && vm.q === "dissonant" && vt.cls === vm.cls) return "the dissonance doubled";
    // a 6/4 over a bass that holds its note resolves to the 5/3 as a double appoggiatura: each voice down a step, the
    // 6th to the 5th and the 4th to the 3rd, in the same voice (no exchange between the voices)
    if (t >= 1 && !B[t].struck) {
      const pa = TT[t - 1], pb = MM[t - 1], ca = T.vertical(t - 1, pa).cls, cb = M.vertical(t - 1, pb).cls;
      if (new Set([ca, cb]).size === 2 && [ca, cb].every((c) => c === 5 || c === 3)) {
        const down = (x, px, pc) => D(x) === D(px) - 1 && (pc === 5 ? 4 : 2) === (x === a ? vt : vm).cls;
        if (!down(a, pa, ca) || !down(b, pb, cb)) return "the 6/4 resolves to the 5/3, each voice down a step (6 to 5, 4 to 3)";
      }
    }
    if (t >= 1) {
      const pa = TT[t - 1], pb = MM[t - 1];
      const pcls = mod(D(pa) - D(pb), 7), ps = mod(semi(pa) - semi(pb), 12);
      const pperfect = (pcls === 0 && ps === 0) || (pcls === 4 && ps === 7);
      if (perfect && pperfect && pcls === cls && a !== pa && b !== pb) return `parallel ${cls === 0 ? "octaves" : "5ths"} between the upper voices`;
    }
    // the same note a semitone apart in the upper voices (F and F♯): an augmented unison or octave
    if (cls === 0 && s !== 0) return "a false relation between the upper voices (an augmented octave)";
    const have = new Set([vt.cls, vm.cls]);
    if (figured && B[t].chord) {
      const ch = CHORDS[B[t].chord];
      if (!ch.need.every((c) => have.has(c)) || ![...have].every((c) => ch.ok.includes(c))) return `the chord asked is ${B[t].chord}`;
    }
    // three voices, three notes of a chord: its 3rd is not doubled, nor the leading tone
    const chord = figured && B[t].chord ? B[t].chord : have.has(5) && have.has(2) ? "6/3" : have.has(5) && have.has(3) ? "6/4" : have.has(1) && have.has(3) ? "4/2" : "5/3";
    // (a 6/(3) may double its bass, as the book's Galant cadence does on ④)
    const third = THIRD[chord];
    if (third !== null && (third === 0 ? 1 : 0) + [vt.cls, vm.cls].filter((c) => c === third).length >= 2) return "the 3rd of the chord doubled";
    // (the leading tone of the key of the unit: ⑦, raised in minor)
    const kt = T.keys[t].key, lt = (l) => l.deg === 6 && (kt.mode === "major" ? l.alt === 0 : l.alt === 1);
    if ([lt(T.loc(t, codeOf3(B[t].d, B[t].r || 0))), lt(T.loc(t, a)), lt(T.loc(t, b))].filter(Boolean).length >= 2) return "the leading tone doubled";
    // in minor the chord on the dominant is major: ⑦ over ⑤ raised, where ⑤ is a dominant (going to ① or ⑥, or
    // closing the phrase; not a ⑤ passed in a sequence, nor a 6/3 on ⑤, a chord on ③)
    if (kt.mode === "minor" && B[t].dominant && chord !== "6/3")
      for (const x of [a, b]) { const l = T.loc(t, x); if (l.deg === 6 && l.alt !== 1) return `the chord on the dominant is major: ${K.name(D(x), A(x) + 1)}, not ${K.name(D(x), A(x))}`; }
    return null;
  }
  /** Why the pair at unit t is refused, or null: each voice against the bass, then between them. */
  function check(TT, MM, t, a, b) {
    return T.check(TT.slice(0, t), t, a) || M.check(MM.slice(0, t), t, b) || between(TT, MM, t, a, b);
  }
  /** The pairs that may come at unit t (before the futures). */
  function pairs(TT, MM) {
    const t = TT.length, out = [];
    const ta = T.codes.filter((a) => T.check(TT, t, a) === null), mb = M.codes.filter((b) => M.check(MM, t, b) === null);
    for (const a of ta) for (const b of mb) if (between(TT, MM, t, a, b) === null) out.push([a, b]);
    return out;
  }

  // ─── the count, exact, memoized on the last three units of both voices ───
  const memo = new Map();
  function countFrom(TT, MM) {
    const t = TT.length;
    if (t >= n) return 1n;
    const k = t + ":" + TT.slice(Math.max(0, t - 3)).join(",") + "|" + MM.slice(Math.max(0, t - 3)).join(",");
    const got = memo.get(k);
    if (got !== undefined) return got;
    let v = 0n;
    for (const [a, b] of pairs(TT, MM)) { TT.push(a); MM.push(b); v += countFrom(TT, MM); TT.pop(); MM.pop(); }
    memo.set(k, v);
    return v;
  }
  const count = (TT = [], MM = []) => countFrom([...TT], [...MM]);
  /** The pairs at the next unit with their futures and their soft cost. */
  function fan(TT = [], MM = []) {
    return pairs(TT, MM).map(([a, b]) => {
      const parts_ = { ...T.costParts(TT, a), ...Object.fromEntries(Object.entries(M.costParts(MM, b)).map(([k, v]) => ["middle/" + k, v])) };
      return { top: a, middle: b, futures: count([...TT, a], [...MM, b]), parts: parts_, cost: total(parts_) };
    });
  }
  function sample(r = Math.random) {
    const TT = [], MM = [];
    while (TT.length < n) {
      const cs = fan(TT, MM).filter((c) => c.futures > 0n);
      if (!cs.length) return null;
      const tot = cs.reduce((s, c) => s + c.futures, 0n);
      let x = (tot * BigInt(Math.floor(r() * 2 ** 52))) / 2n ** 52n;
      const c = cs.find((c) => (x -= c.futures) < 0n) || cs[cs.length - 1];
      TT.push(c.top); MM.push(c.middle);
    }
    return { top: TT, middle: MM };
  }
  /** The engine: each pair a softmax of −cost / temperature among those with a future. */
  function engine({ temp = 1, follow = true, r = Math.random } = {}) {
    const TT = [], MM = [];
    while (TT.length < n) {
      const cs = fan(TT, MM).filter((c) => c.futures > 0n).map((c, i) => ({ ...c, note: i }));
      const pick = choose(cs, temperature(temp, follow, count(TT, MM)), r);
      if (!pick) return null;
      TT.push(pick.top); MM.push(pick.middle);
    }
    return { top: TT, middle: MM };
  }
  function judge(W) {
    if (W.top.length !== n || W.middle.length !== n) return `${W.top.length} units, the bass has ${n}`;
    for (let t = 0; t < n; t++) { const r = check(W.top, W.middle, t, W.top[t], W.middle[t]); if (r) return `unit ${t + 1}: ${r}`; }
    return null;
  }
  /** The chords a realization makes, unit by unit: "6/3", "(5)/3" (a 5/3 without its 5th), "7/3", "4/2"… */
  function chords(W) {
    return W.top.map((a, t) => {
      const b = W.middle[t], fs = [...new Set([T.vertical(t, a).cls, M.vertical(t, b).cls])].map((c) => FIG[c]).sort((x, y) => y - x);
      if (fs.length === 2 && fs[0] === 8 && fs[1] === 3) return "(5)/3";
      if (fs.length === 1) return fs[0] === 3 ? "(5)/3" : String(fs[0]);
      return fs.filter((f) => f !== 8).join("/") || "8";
    });
  }
  return { spec, schema, cadence, key: K, bass: B, n, strong: (t) => B[t].strong, top: T, middle: M, check, pairs, count, fan, sample, engine, judge, chords,
           code: (name) => codeOf(K, name), name: (c) => K.name(D(c), A(c)), degree: D, alter: A, hz: (c) => K.hz(D(c), A(c)), memo };
}
