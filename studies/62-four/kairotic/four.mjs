// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 62 · four: harmony in four parts (Job IJzerman, Harmony, Counterpoint, Partimento, OUP 2018,
// chapter 6), on @kairotic/cac's partimento.mjs (its copy beside this file): four() and its rules.
//
//   the voices     soprano, alto and tenor over the given bass: the outer voices in counterpoint, the inner ones
//                  filling the chords (they may hold a common tone long, and need not turn after a leap)
//   the chords     complete or not, the bass doubled as a rule, never the leading tone nor a dissonance; the
//                  dominant's 7th chord and its family (7, 6/5, 6/4/3, 4/2) as semi-consonances — free to enter,
//                  their 7th held or by step, and going down by step —, any other 7th chord's
//                  7th prepared (ii6/5), the augmented 6th going up to the octave
//   the phrases    the Rule of the Octave in four parts (ex. 6.37, 6.39, 6.42), the cadences of the early 1700s
//                  (ex. 6.16: perfect, tenor, alto, discant), the four-part Galant cadence (ex. 6.13), the dominant
//                  7th resolved (ex. 6.24) — the book's realizations among the ones counted

import { four, keyOf, octaveChord4, isDominant } from "./partimento.mjs";

const keyName = (k) => `${k.tonic.replace("b", "♭").replace("#", "♯")} ${k.mode}`;
const tonicOf = (K, deg) => K.name(deg, 0).replace(/-?\d+$/, "").replace("♯", "#").replace("♭", "b");

// a phrase: units [degree, chord, {held (the bass not struck), r (raised), on (a key on a degree of this one),
// chroma, dominant}]; start 1: an upbeat (the first unit weak)
const ro = (dir) => (K) => {
  const ds = dir === "up" ? [0, 1, 2, 3, 4, 5, 6, 7] : [7, 6, 5, 4, 3, 2, 1, 0];
  return ds.map((d, t) => {
    const oc = octaveChord4(d, dir, K.mode), last = t === 0 || t === 7;
    return [d, last ? "5/3" : oc.chord, { r: K.mode === "minor" && dir === "up" && (d === 5 || d === 6) ? 1 : 0, on: oc.tonicize, chroma: oc.chroma, dominant: t === 6 && dir === "up" ? true : undefined }];
  });
};
export const PHRASES = {
  "ro-up": { name: "RO up", ref: "IJzerman 6.6, ex. 6.37(a)", key: { tonic: "C" }, units: ro("up"),
             about: "the ascending Rule of the Octave in four parts: 5/3 on ① and ⑤, the dominant's 6/4/3 on ②, 6/5 on ④ and on ⑦ — semi-consonances, unprepared, their 7th going down a step",
             book: { soprano: "G5 G5 G5 A5 G5 F5 F5 E5", alto: "E5 F5 E5 D5 D5 C5 D5 C5", tenor: "C5 B4 C5 C5 B4 A4 G4 G4" } },
  "ro-up-minor": { name: "RO up (minor)", ref: "IJzerman 6.6, ex. 6.37(b)", key: { tonic: "A", mode: "minor" }, units: ro("up"),
                   about: "the same in minor: the 6♯ on ② (the leading tone), ⑥ and ⑦ raised in the bass and the voices",
                   book: { soprano: "E5 E5 E5 F5 E5 D5 D5 C5", alto: "C5 D5 C5 B4 B4 A4 B4 A4", tenor: "A4 G#4 A4 A4 G#4 F#4 E4 E4" } },
  "ro-down": { name: "RO down", ref: "IJzerman 6.6, ex. 6.39(b)", key: { tonic: "C" }, units: ro("down"),
               about: "the descending RO: the ♯6/4/3 on ⑥ (the dominant's 4/3 in G major), the 6/4/2 on ④, the 6/4/3 on ② — ⑦–⑥–⑤ leading to the dominant as ③–②–① to the tonic",
               book: { soprano: "E5 D5 C5 B4 B4 C5 B4 C5", alto: "C5 G4 F#4 G4 G4 G4 G4 G4", tenor: "G4 D4 D4 D4 D4 E4 F4 E4" } },
  "ro-down-minor": { name: "RO down (minor)", ref: "IJzerman 6.6, ex. 6.42", key: { tonic: "A", mode: "minor" }, units: ro("down"),
                     about: "the descending RO in minor: on ⑥ the augmented 6/4/3 (the French 6th, its raised ④ going up to ⑤, its augmented 4th held), the 6/4♯/2 on ④, the 6♯/4/3 on ②",
                     book: { soprano: "C5 B4 A4 G#4 G#4 A4 G#4 A4", alto: "A4 E4 D#4 E4 E4 E4 E4 E4", tenor: "E4 B3 B3 B3 B3 C4 D4 C4" } },
  perfect: { name: "perfect cadence", ref: "IJzerman 6.3, ex. 6.16(a)", key: { tonic: "C" }, start: 1,
             units: () => [[0, "5/3"], [4, "5/4"], [4, "5/3", { held: true }], [0, "5/3"]],
             about: "the compound cadence at its most conclusive: ⑤–① in the bass, the soprano's suspension 1̂–7̂–1̂, the alto's 5̂–4̂–3̂, the tenor 2̂–1̂ — the four clausulae of the Renaissance",
             book: { soprano: "C5 C5 B4 C5", alto: "G4 G4 G4 E4", tenor: "E4 D4 D4 C4" } },
  tenor: { name: "tenor cadence", ref: "IJzerman 6.3, ex. 6.16(b)", key: { tonic: "C" }, start: 1,
           units: () => [[2, "6/3"], [1, "7/3"], [1, "6/3", { held: true }], [0, "5/3"]],
           about: "the bass sings the tenor's clausula, ②–①: a soft landing on the tonic, a 7–6 over ②",
           book: { soprano: "C5 C5 B4 C5", alto: "G4 F4 F4 G4", tenor: "C4 D4 D4 E4" } },
  alto: { name: "alto cadence", ref: "IJzerman 6.3, ex. 6.16(c)", key: { tonic: "C" }, start: 1,
          units: () => [[0, "5/3"], [4, "5/4"], [4, "5/3", { held: true }], [2, "6/3"]],
          about: "the bass sings the alto's clausula, ⑤ (④) ③: a weak close on a 6/3, often answered by a stronger cadence",
          book: { soprano: "C5 C5 B4 C5", alto: "G4 G4 G4 G4", tenor: "E4 D4 D4 C4" } },
  discant: { name: "discant cadence", ref: "IJzerman 6.3, ex. 6.16(d)", key: { tonic: "C" }, start: 1,
             units: () => [[0, "5/3"], [0, "5/2", { held: true }], [-1, "6/3"], [0, "5/3"]],
             about: "the bass sings the discant's clausula, ① (tied) ⑦ ①: the tied ① a suspension (5/2 or 4/2), resolved down to ⑦ — weak as a close, it opens a piece and establishes its key",
             book: { soprano: "E5 D5 D5 C5", alto: "G4 G4 G4 G4", tenor: "C4 D4 D4 E4" } },
  galant: { name: "Galant cadence", ref: "IJzerman 6.2, ex. 6.13(a)", key: { tonic: "C" },
            units: () => [[0, "5/3"], [3, "6/3"], [4, "6/4", { ap: true }], [-3, "5/3"], [0, "5/3"]],
            about: "the four-part Galant cadence, complete and compound: a 6/3 on ④, the accented 6/4 on ⑤ (its 4th struck by step, falling to the 3rd), the soprano and the tenor in parallel 6ths — inverting the inner voices makes their 4ths 5ths, parallel (ex. 6.13(c), wrong!)",
            book: { soprano: "C5 D5 C5 B4 C5", alto: "G4 A4 G4 G4 G4", tenor: "E4 F4 E4 D4 E4" },
            wrong: { soprano: "E5 F5 E5 D5 E5", alto: "G4 A4 G4 G4 G4", tenor: "C4 D4 C4 B3 C4" } },
  "galant-7": { name: "Galant cadence (6/5, 7)", ref: "IJzerman 6.2, ex. 6.7–6.10", key: { tonic: "C" },
                units: () => [[0, "5/3"], [3, "6/5"], [4, "6/4", { ap: true }], [4, "7", { held: true }], [0, "5/3"]],
                about: "with the 6/5 on ④ and the 6/4 falling to the dominant's 7th: the 5th of ④'s chord — its 7th, ii6/5, prepared by the tonic before it — held into the 6/4's 4th, then down to the 3rd" },
  "dominant-seventh": { name: "V7 → I", ref: "IJzerman 6.4, ex. 6.24(a, b)", key: { tonic: "C" }, start: 1,
                        units: () => [[0, "5/3"], [4, "7"], [0, "5/3"]],
                        about: "the dominant's 7th chord resolved: its augmented 4th to a 6th, its diminished 5th to a 3rd; complete, it goes to an incomplete tonic (the bass tripled), incomplete to a complete one" },
  deceptive: { name: "V7 → ⑥", ref: "IJzerman 6.4, ex. 6.24(c)", key: { tonic: "C" }, start: 1,
               units: () => [[0, "5/3"], [4, "7"], [5, "5/3"]],
               about: "the deceptive resolution: ⑤–⑥ in the bass, the leading tone up, the 7th down — the chord on ⑥ doubles its 3rd" },
  bach: { name: "discant, RO, cadence", ref: "IJzerman 6.6, ex. 6.38–6.39 (BWV 846)", key: { tonic: "C" },
          units: () => [[0, "5/3"], [0, "4/2", { held: true }], [-1, "6/5"], [0, "5/3"], [-1, "6/3"], [-2, "+6/4/3".replace("+", "") , { on: 4 }], [-3, "5/3"], [-4, "4/2"], [-5, "6/3"], [-6, "6/4/3"], [-7, "5/3"]],
          about: "after Bach's Prelude in C: the discant cadence that opens it, then the descending RO from ① to ① an octave lower" },
};

/** The units of the bass: {d, r, struck, strong, chord, key, chroma, dominant, ap, deg}. */
export function unitsOf(ph, K) {
  const raw = ph.units(K), out = [];
  raw.forEach(([d, chord, o = {}], t) => {
    const next = raw.slice(t + 1).find((u) => !(u[2] && u[2].held));
    const key = o.on !== undefined && o.on !== null ? { tonic: tonicOf(K, o.on), mode: "major" } : null;
    out.push({ d, r: o.r || 0, struck: !o.held, strong: (t + (ph.start || 0)) % 2 === 0, chord, key, chroma: o.chroma || null, ap: !!o.ap,
               dominant: o.dominant ?? (mod(d, 7) === 4 && (!next || isDominant(d, next[0]) || mod(next[0], 7) === 5)) });
  });
  return out;
}
const mod = (a, m) => ((a % m) + m) % m;

/** A phrase in four parts: spec {phrase, key (a tonic; the mode the phrase's), figured, ro, line}. */
export function fourParts(spec = {}) {
  const id = spec.phrase || "ro-up", ph = PHRASES[id];
  if (!ph) throw new Error(`no such phrase: ${id}`);
  const key = { tonic: spec.key && spec.key.tonic ? spec.key.tonic : ph.key.tonic, mode: ph.key.mode || "major" };
  const K = keyOf(key), B = unitsOf(ph, K);
  const F = four({ key, bass: B, figured: spec.figured ?? true, ro: spec.ro ?? true, line: spec.line, weights: spec.weights });
  for (let t = 0; t < B.length; t++) B[t].deg = F.soprano.locB(t);
  const KL = (t) => (B[t].key ? keyOf(B[t].key) : K);
  const sameKey = !spec.key || !spec.key.tonic || spec.key.tonic === ph.key.tonic;
  const read = (o) => (o && sameKey ? Object.fromEntries(Object.entries(o).map(([v, s]) => [v, s.split(" ").map(F.code)])) : null);
  return { ...F, id, phrase: ph, K, units: B, keyName: (t) => keyName(KL(t)), book: read(ph.book), wrong: read(ph.wrong) };
}
