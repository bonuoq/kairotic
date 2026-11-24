// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 69 · chromatic: chromaticism (Job IJzerman, Harmony, Counterpoint, Partimento, OUP 2018, chapter 8),
// on @kairotic/rules (its copy beside this file): fourOverBass() and the style chorale-4 — partsOverBass() and
// partimento-2 for a phrase in three parts.
//
//   tonicization          a degree raised to a tonic for a moment, after its secondary dominant: a unit in a key of
//                         its own (the dominant's 7th free to enter there, its leading tone raised)
//   the Fonte             a sequence a step down, ii then I: ①♯–② and ⑦–① under 6–5–4 / 5–4–3 (or with diminished
//                         7ths on the strong units, the upper voice falling chromatically)
//   the chromatic Monte   the Monte's bass rising by semitones: each leading tone a secondary dominant's, ii, IV, V and
//                         vi tonicized (in minor III, iv and V)
//   Descending Thirds     the bass falling by step through ①–⑥–④–②, a 4/2 of a secondary dominant on each step between
//   the Lamento           the chromatic tetrachord ①–⑤ in minor, 6/3s and 7–6s; in four parts the tenor leaps
//   the Morte             the same bass, the upper voice rising against it: IV tonicized, then an augmented 6th on ⑥
//                         (in major the molldur ⑥) to the dominant
//   the Chain of Dominants Fifth Down Fourth Up with a dominant on every bass note: each 7th down a half step, each
//                         leading tone down a chromatic half step
// The book's prototypes (ex. 8.8, 8.17, 8.22, 8.27, 8.33, 8.42) are checked for what makes them what they are among
// the realizations counted.

import { fourOverBass, partsOverBass } from "./rules.mjs";
import { keyOf, isDominant, localOf, localNote, codeOf3, codeDegree, codeAlter } from "./tonal.mjs";

const mod = (a, m) => ((a % m) + m) % m;
// chromatic tones a unit's chord takes, in its own key ([degree alteration], true: must): the leading tone of a minor
// key raised (a secondary dominant not on ⑤), the molldur ⑥, the Neapolitan ②♭, the augmented 6th's raised ④
const LT = [[6, 1, true]], MOLL = [[5, -1, true]], NAP = [[1, -1]], AUG4 = [[3, 1, true]];
// (and the natural ⑥ of a minor key — not the melodic minor's raised one — where its diminished 7th is asked)
const NAT6 = [[5, 0, true]];
const Dm = { tonic: "D", mode: "minor" }, F = { tonic: "F" }, G = { tonic: "G" }, Am = { tonic: "A", mode: "minor" };

// a phrase: units [degree (of the phrase's key; its octave the bass's register), chord, {r (raised, lowered), held
// (the bass not struck), key (a key of its own: a tonicization), chroma, family, ap (a strong unit's dissonance an
// appoggiatura, by step: the cadential 6/4 unprepared)}]; strong: "all", alternating from the first, or one flag a unit;
// parts: 3 (partsOverBass) or 4; end: false (the phrase stops on a half cadence)
export const PHRASES = {
  fonte: { name: "Fonte", ref: "IJzerman 8.1, ex. 8.8(a)", key: { tonic: "C" },
    units: [[0, "6/5", { r: 1, key: Dm }], [1, "5/3", { key: Dm }], [-1, "6/5"], [0, "5/3"]],
    about: "a sequence a step down that leaves the key and comes back: ii tonicized by its secondary dominant (C♯, a 6/5), then I by its own (B) — the bass ①♯–② and ⑦–①, the upper voice 6–5–4 and 5–4–3" },
  "fonte-inverted": { name: "Fonte (inverted)", ref: "IJzerman 8.1, ex. 8.8(b)", key: { tonic: "C" },
    units: [[5, "5/3", { key: Dm, chroma: LT }], [4, "4/2", { key: Dm, chroma: LT }], [3, "6/3", { key: Dm }], [4, "5/3"], [3, "4/2"], [2, "6/3"]],
    about: "the same in invertible counterpoint: the upper voice's line in the bass, A–G–F, G–F–E, the secondary tonic a 6/3" },
  "fonte-diminished": { name: "Fonte (diminished 7ths)", ref: "IJzerman 8.1, ex. 8.8(c)", key: { tonic: "C" },
    units: [[0, "7", { r: 1, key: Dm, chroma: NAT6 }], [1, "5/3", { key: Dm }], [-1, "7", { chroma: MOLL }], [0, "5/3"]],
    about: "diminished 7ths in place of the dominant's on each strong unit (B♭ in D minor, the molldur A♭ in C): the upper voice falls chromatically, B♭–A–A♭–G" },
  monte: { name: "Chromatic Monte", ref: "IJzerman 8.2, ex. 8.17(a)", key: { tonic: "C" },
    units: [[0, "5/3"], [-1, "6/5"], [0, "5/3"], [0, "6/5", { r: 1, key: Dm }], [1, "5/3", { key: Dm }], [2, "6/5", { key: F }], [3, "5/3", { key: F }],
            [3, "6/5", { r: 1, key: G }], [4, "5/3", { key: G }], [4, "6/5", { r: 1, key: Am }], [5, "5/3", { key: Am }], [6, "6/5"], [7, "5/3"]],
    about: "the Monte's bass rising by semitones, each a leading tone with its secondary dominant (a 6/5) and the 5/3 of its secondary tonic: ii, IV, V and vi; ②–③ and ⑥–⑦ whole tones, ③ and ⑦ not tonicized" },
  "monte-minor": { name: "Chromatic Monte (minor)", ref: "IJzerman 8.2, ex. 8.17(b)", key: { tonic: "A", mode: "minor" },
    units: [[0, "5/3"], [-1, "6/5", { r: 1 }], [0, "5/3"], [1, "6/5", { key: { tonic: "C" } }], [2, "5/3", { key: { tonic: "C" } }], [2, "6/5", { r: 1, key: Dm }],
            [3, "5/3", { key: Dm }], [3, "6/5", { r: 1, key: { tonic: "E" } }], [4, "5/3", { key: { tonic: "E" } }], [6, "6/5", { r: 1 }], [7, "5/3"]],
    about: "in minor III, iv and V tonicized — ②–③ to the relative major — and no further than ⑤, a pillar of the RO's ①–③–⑤" },
  "descending-thirds": { name: "Tonicizations in Descending Thirds", ref: "IJzerman 8.3, ex. 8.22(a)", key: { tonic: "C" },
    units: [[2, "6/3"], [1, "4/2", { key: Am, chroma: LT }], [0, "6/3", { key: Am }], [-1, "4/2", { r: -1, key: F }], [-2, "6/3", { key: F }],
            [-3, "4/2", { key: Dm, chroma: LT }], [-4, "6/3", { key: Dm }], [-6, "5/3"], [-3, "6/4", { ap: true }], [-3, "7", { held: true }], [-7, "5/3"]],
    about: "the bass falling by step, 6/3s on ③, ①, ⑥ and ④ — the Descending Thirds — and on each step between a secondary dominant's 4/2: vi, IV and ii tonicized; a Galant cadence" },
  lamento: { name: "Lamento", ref: "IJzerman 8.4, ex. 8.27(a)", key: { tonic: "A", mode: "minor" }, parts: 3, top: [12, 22], middle: [7, 17], hold: { middle: 3 },
    units: [[0, "5/3"], [7, "6/3"], [6, "7/3", { r: 1 }], [6, "6/3"], [5, "7/3", { r: 1 }], [5, "6/3"], [4, "5/4"], [4, "5/3", { held: true }], [0, "5/3"]],
    about: "the chromatic tetrachord ①–⑤ in minor in three parts, 7–6 suspensions over each chromatic step — the chromatic tones standing for their diatonic neighbours, not another key —, a compound cadence (5/4) on ⑤" },
  "lamento-4": { name: "Lamento (four parts)", ref: "IJzerman 8.4, ex. 8.27(c)", key: { tonic: "A", mode: "minor" },
    units: [[0, "5/3"], [7, "6/3"], [6, "7/3", { r: 1 }], [6, "6/3"], [5, "7/3", { r: 1 }], [5, "6/3"], [4, "5/4"], [4, "5/3", { held: true }], [0, "5/3"]],
    about: "the same in four parts: the fourth voice (the tenor) has to leap, or it would move in octaves with another" },
  morte: { name: "Morte", ref: "IJzerman 8.5, ex. 8.33(b)", key: { tonic: "C" }, end: false,
    units: [[0, "5/3"], [-1, "6/3"], [-1, "4/2", { r: -1, key: F }], [-2, "6/3", { key: F }], [-2, "+6", { r: -1, chroma: AUG4 }], [-3, "5/3"]],
    about: "the chromatic tetrachord ①–⑤ in major, the upper voice rising against it: IV tonicized by the 4/2 on ⑦♭, then the augmented 6th on the molldur ⑥ (A♭–F♯) up and down to the dominant" },
  "morte-minor": { name: "Morte (minor)", ref: "IJzerman 8.5, ex. 8.33(a)", key: { tonic: "A", mode: "minor" }, end: false,
    units: [[0, "5/3"], [-1, "6/3", { r: 1 }], [-1, "4/2", { key: { tonic: "D" } }], [-2, "6/3", { r: 1, key: { tonic: "D" } }], [-2, "+6", { chroma: AUG4 }], [-3, "5/3"]],
    about: "in minor: the natural ⑦ with the secondary dominant of IV (D major), the raised ⑥ its secondary tonic, the augmented 6th on ⑥ to the dominant" },
  chain: { name: "Chain of Dominants", ref: "IJzerman 8.6, ex. 8.42(a)", key: { tonic: "C" },
    units: [[0, "5/3"], [2, "7", { key: Am }], [-2, "7", { key: Dm }], [1, "7", { key: G }], [-3, "7"], [0, "7", { key: F }],
            [-4, "5/3"], [-4, "6/5"], [-3, "6/4"], [-3, "7", { held: true }], [0, "5/3"]],
    about: "Fifth Down Fourth Up with a dominant 7th on every bass note — of A minor, D minor, G, C, F —: each 7th down a half step, each leading tone down a chromatic half step to the next 7th; complete and incomplete by turns; a Galant cadence" },
  "chain-minor": { name: "Chain of Dominants (minor)", ref: "IJzerman 8.6, ex. 8.42(b)", key: { tonic: "A", mode: "minor" },
    units: [[0, "5/3"], [7, "7", { key: Dm }], [3, "5/3", { key: G }], [6, "7", { key: { tonic: "C" } }], [2, "5/3", { key: { tonic: "C" } }],
            [5, "7", { key: { tonic: "Bb" } }], [1, "5/3", { r: -1, chroma: NAP }], [3, "6/3", { chroma: NAP }], [4, "6/4", { ap: true }], [4, "7", { held: true }], [0, "5/3"]],
    about: "in minor the dominants alternate with 5/3s, to the Neapolitan ②♭ (B♭) and the Neapolitan cadence" },
};

/** The units of the bass: {d, r, struck, strong, chord, key, chroma, dominant, family, deg, ap}. */
export function unitsOf(ph, K) {
  const raw = ph.units, out = [];
  raw.forEach(([d, chord, o = {}], t) => {
    const key = o.key || null, lo = localOf(K, key);
    const deg = localNote(K, lo, d, o.r || 0).deg;
    const next = raw.slice(t + 1).find((u) => !(u[2] && u[2].held));
    const ndeg = next ? localNote(K, lo, next[0], (next[2] && next[2].r) || 0).deg : null;
    const strong = Array.isArray(ph.strong) ? !!ph.strong[t] : ph.strong === "all" ? true : t % 2 === 0;
    out.push({ d, r: o.r || 0, struck: !o.held, strong, chord, key, chroma: o.chroma || null, sequence: false, natural: false,
               family: o.family, dominant: deg === 4 && (ndeg === null || isDominant(4, ndeg)), deg, ap: !!o.ap });
  });
  return out;
}

/** A phrase in four (or three) parts: spec {phrase, key (a tonic; the mode the phrase's), figured, ro, line, style}. */
export function chromatic(spec = {}) {
  const id = spec.phrase || "fonte", ph = PHRASES[id];
  if (!ph) throw new Error(`no such phrase: ${id}`);
  const key = { tonic: spec.key && spec.key.tonic ? spec.key.tonic : ph.key.tonic, mode: ph.key.mode || "major" };
  const K = keyOf(key);
  // (a unit's own key moves with the phrase's: the same degree of the key moved)
  const shift = (k) => {
    if (!k || !spec.key || !spec.key.tonic || spec.key.tonic === ph.key.tonic) return k;
    const K0 = keyOf(ph.key), lo = localOf(K0, k), a0 = mod(lo.s - K0.semi(lo.o, 0) + 6, 12) - 6;
    return { tonic: K.name(lo.o, a0).replace(/-?\d+$/, "").replace("♯", "#").replace("♭", "b"), mode: k.mode || "major" };
  };
  const B = unitsOf({ ...ph, units: ph.units.map(([d, c, o = {}]) => [d, c, o.key ? { ...o, key: shift(o.key) } : o]) }, K);
  const three = ph.parts === 3;
  const end = spec.end ?? ph.end;
  const P = three
    ? partsOverBass({ key, bass: B, figured: spec.figured ?? true, ro: spec.ro ?? true, line: spec.line, weights: spec.weights, style: spec.style, end, top: ph.top, middle: ph.middle, hold: ph.hold })
    : fourOverBass({ key, bass: B, figured: spec.figured ?? true, ro: spec.ro ?? true, line: spec.line, weights: spec.weights, style: spec.style, end });
  const V0 = three ? P.top : P.soprano, w = V0.world;
  return { ...P, phrase: id, parts: three ? 3 : 4, names: three ? ["top", "middle"] : ["soprano", "alto", "tenor"],
           voices: three ? [P.top, P.middle] : P.voices, spec: { ...spec, key }, units: B, K, n: B.length, keys: w.LOC,
           keyName: (t) => { const k = w.LOC[t].key; return `${k.tonic.replace("b", "♭").replace("#", "♯")} ${k.mode}`; },
           code: (name) => { const m = /^([A-G])([#♯b♭]*)(-?\d+)$/.exec(name); if (!m) return null;
                             for (const a of [0, 1, -1]) for (let d = -21; d < 35; d++) if (K.name(d, a).replace("♯", "#").replace("♭", "b") === name.replace("♯", "#").replace("♭", "b")) return codeOf3(d, a);
                             return null; },
           name: (c) => K.name(codeDegree(c), codeAlter(c)), degree: codeDegree, alter: codeAlter, hz: (c) => K.hz(codeDegree(c), codeAlter(c)) };
}
