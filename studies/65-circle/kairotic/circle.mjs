// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 65 · circle: beyond the Rule of the Octave (Job IJzerman, Harmony, Counterpoint, Partimento, OUP
// 2018, chapter 7), on @kairotic/rules (its copy beside this file): fourOverBass() and the style chorale-4.
//
//   the diminished 7th   the leading tone's 7th chord in minor (and in major with the lowered ⑥, molldur): 7 on ⑦♯,
//                        6/5 on ②, 6/4/3 on ④, 4/2 on ⑥♭ — a family, as the dominant's, of semi-consonances: free to
//                        enter, its diminished 7th down a half step (to the dominant's chord, or to the tonic's 5th)
//   the circle of fifths Fifth Down Fourth Up (7ths complete and incomplete, prepared; or 5/3s), Third Down Second Up
//                        (6/5–5/3; in minor 6/3–5/3), the Tied Bass in four parts (6/4/2 over the tied note, 6/3)
//   descending thirds    a 5/3 on every bass note, each sharing two tones with the one before; in minor the Neapolitan
//                        ②♭ in place of the diminished triad on ②, then the diminished 7th on ⑦♯
//   the Folia            modulating: ⑥–⑤–① in keys a third apart, minor and major by turns
// The book's prototypes (ex. 7.9, 7.12, 7.16, 7.20, 7.26, 7.31) are checked for what makes them what they are —
// which chords, which doublings, which suspensions — among the realizations counted.

import { fourOverBass } from "./rules.mjs";
import { keyOf, isDominant, localOf, localNote, codeOf3, codeDegree, codeAlter } from "./tonal.mjs";

const mod = (a, m) => ((a % m) + m) % m;
const NAP = [[1, -1]], MOLL = [[5, -1, true]];

// a phrase: units [degree (of the phrase's key), chord, {r (raised, lowered), held (the bass not struck), key (a key
// of its own), chroma (chromatic tones its chord may take: [degree alteration] in its key), family}]; strong: "all"
// (a chord a bar, every unit strong), alternating from the first, or one flag a unit (the book's bars: ① | ④ ⑦ | ③ ⑥…); sequence [first last]: the units of a sequence,
// where a diminished triad is taken for the pattern's sake; natural [first last]: in minor the natural scale there
export const PHRASES = {
  "vii-minor": { name: "vii° in minor", ref: "IJzerman 7.1, ex. 7.5, 7.9(a–e)", key: { tonic: "A", mode: "minor" },
    units: [[0, "5/3"], [-1, "7", { r: 1 }], [0, "5/3"], [1, "6/5"], [0, "5/3"], [1, "6/5"], [2, "6/3"], [3, "6/4/3"], [2, "6/3"], [-2, "4/2"], [-3, "7"], [0, "5/3"]],
    about: "the diminished 7th family on ⑦♯, ②, ④ and ⑥: the 7/5/3 on ⑦♯ to ①, the 6/5/3 on ② to ① and to ③, the 6/4/3 on ④ to ③, the 6/4/2 on ⑥ to the dominant's 7 — unprepared, the diminished 7th down a half step" },
  "vii-major": { name: "vii° in major", ref: "IJzerman 7.1, ex. 7.6–7.7, 7.9 (C major)", key: { tonic: "C" },
    units: [[0, "5/3"], [-1, "7", { chroma: MOLL }], [0, "5/3"], [1, "6/5", { chroma: MOLL }], [2, "6/3"], [-2, "4/2", { r: -1, chroma: MOLL }], [-3, "7"], [0, "5/3"]],
    about: "the same family in major with the lowered ⑥ (molldur, A♭ in C): it bridges ⑤ and ⑥ chromatically — Cherubini's discant cadence" },
  meyer: { name: "Meyer", ref: "IJzerman 7.1, ex. 7.3–7.4(b)", key: { tonic: "D", mode: "minor" }, strong: "all",
    units: [[0, "5/3"], [1, "6/5"], [-1, "6/5", { r: 1 }], [0, "5/3"]],
    about: "a question and its answer, ①–② / ⑦–①, the soprano 1̂–7̂ / 4̂–3̂: the diminished 6/5 on ② and the dominant's 6/5 on ⑦♯ — exchangeable, sharing three tones (Haydn, The Seven Last Words)" },
  fifths: { name: "Fifth Down Fourth Up", ref: "IJzerman 7.2, ex. 7.12(a)", key: { tonic: "C" }, sequence: [1, 6], strong: [1, 1, 0, 1, 0, 1, 0, 1],
    units: [[0, "5/3"], [3, "7"], [-1, "7"], [2, "7"], [-2, "7"], [1, "7"], [-3, "7"], [0, "5/3"]],
    about: "the circle of fifths in four parts: a 7th chord on every bass note, complete and incomplete by turns (its 5th left out, the bass doubled), each 7th prepared in the chord before and resolved down in the next" },
  "fifths-53": { name: "Fifth Down Fourth Up (5/3)", ref: "IJzerman 7.2, ex. 7.12(b)", key: { tonic: "C" }, sequence: [1, 6], strong: [1, 1, 0, 1, 0, 1, 0, 1],
    units: [[0, "5/3"], [3, "5/3"], [-1, "5/3"], [2, "5/3"], [-2, "5/3"], [1, "5/3"], [-3, "5/3"], [0, "5/3"]],
    about: "the same with 5/3s in place of the 7ths: every chord complete, its bass doubled" },
  "fifths-minor": { name: "Fifth Down Fourth Up (minor)", ref: "IJzerman 7.2, ex. 7.12(c)", key: { tonic: "A", mode: "minor" }, sequence: [1, 6], natural: [1, 5], strong: [1, 1, 0, 1, 0, 1, 0, 1],
    units: [[0, "5/3"], [3, "7"], [-1, "7"], [2, "7"], [-2, "7"], [1, "7"], [-3, "7"], [0, "5/3"]],
    about: "in minor from the natural scale, the natural ⑦ (G) in the sequence; the raised ⑦ (G♯) only in the cadence, to close on the tonic" },
  "thirds-seconds": { name: "Third Down Second Up", ref: "IJzerman 7.2, ex. 7.16(a)", key: { tonic: "C" }, sequence: [1, 6],
    units: [[7, "5/3"], [5, "6/5"], [6, "5/3"], [4, "6/5"], [5, "5/3"], [3, "6/5"], [4, "5/3"], [0, "5/3"]],
    about: "each third down a 6/5/3 and each second up a 5/3: the 5th of the 6/5 (the chord's 7th) a suspension, prepared and resolved; every chord complete, the 5/3s doubling their bass" },
  "thirds-seconds-minor": { name: "Third Down Second Up (minor)", ref: "IJzerman 7.2, ex. 7.16(b)", key: { tonic: "A", mode: "minor" }, sequence: [1, 6], natural: [1, 5],
    units: [[7, "5/3"], [5, "6/3"], [6, "5/3"], [4, "6/3"], [5, "5/3"], [3, "6/3"], [4, "5/3"], [0, "5/3"]],
    about: "in minor 6/3s in place of the 6/5/3s, their 6th doubled as a rule; the leading tone only in the cadence" },
  "tied-bass": { name: "Tied Bass", ref: "IJzerman 7.3, ex. 7.20(a)", key: { tonic: "C" }, sequence: [1, 9],
    units: [[7, "5/3"], [6, "6/3"], [6, "4/2", { held: true }], [5, "6/3"], [5, "4/2", { held: true }], [4, "6/3"], [4, "4/2", { held: true }], [3, "6/3"], [3, "4/2", { held: true }], [2, "6/3"], [3, "6/5"], [4, "5/3"], [0, "5/3"]],
    about: "each bass note tied over the bar: a 6/4/2 on the strong unit — the bass the 7th, prepared by the tie and resolved down — and the 6/3 of its resolution on the weak one; a compound cadence from the 6/3 on ③" },
  "tied-bass-minor": { name: "Tied Bass (minor)", ref: "IJzerman 7.3, ex. 7.20(b)", key: { tonic: "A", mode: "minor" }, sequence: [1, 9], natural: [1, 7],
    units: [[7, "5/3"], [6, "6/3"], [6, "4/2", { held: true }], [5, "6/3"], [5, "4/2", { held: true }], [4, "6/3"], [4, "4/2", { held: true }], [3, "6/3"], [3, "4/2", { held: true }], [2, "6/3"], [3, "6/5"], [4, "5/3"], [0, "5/3"]],
    about: "in minor from the natural scale, until the 6/4/2 on ④ — the dominant's, its G♯ — leaves the sequence" },
  "descending-thirds": { name: "Descending Thirds", ref: "IJzerman 7.4, ex. 7.26(a)", key: { tonic: "C" }, sequence: [1, 4],
    units: [[7, "5/3"], [5, "5/3"], [3, "5/3"], [1, "5/3"], [-1, "6/5"], [0, "5/3"], [3, "6/5"], [4, "5/3"], [0, "5/3"]],
    about: "a 5/3 on every bass note falling by thirds, ①–⑥–④–②, each sharing two tones with the chord before; ⑦ (a 6/5) goes up to ①, and a compound cadence closes it" },
  "descending-thirds-minor": { name: "Descending Thirds (minor)", ref: "IJzerman 7.4, ex. 7.26(b)", key: { tonic: "A", mode: "minor" }, sequence: [1, 4], natural: [1, 3],
    units: [[7, "5/3"], [5, "5/3"], [3, "5/3"], [1, "5/3", { r: -1, chroma: NAP }], [-1, "7", { r: 1 }], [0, "5/3"], [3, "6/3"], [4, "7"], [0, "5/3"]],
    about: "in minor the Neapolitan ②♭ (B♭) in place of the diminished triad on ②, a fourth stage: the Neapolitan turn ②♭–⑦♯–①, the diminished 7th on ⑦♯ easing the voice leading; a Galant cadence closes it" },
  folia: { name: "Folia, modulating", ref: "IJzerman 7.5, ex. 7.31", key: { tonic: "A", mode: "minor" },
    units: [[0, "5/3"], [-3, "5/3"], [0, "5/3", { key: { tonic: "C" } }], [-1, "5/3", { key: { tonic: "C" } }], [2, "5/3", { key: { tonic: "C" } }], [1, "5/3", { key: { tonic: "E", mode: "minor" } }], [4, "5/3", { key: { tonic: "E", mode: "minor" } }]],
    about: "⑥–⑤–① in keys a third apart, minor and major by turns — A minor, C major, E minor —: in a major key ⑥–⑤ a whole tone, in a minor one a half tone; the Romanesca's leaps, backwards" },
};

/** The units of the bass: {d, r, struck, strong, chord, key, chroma, dominant, family, deg}. */
export function unitsOf(ph, K) {
  const raw = ph.units, out = [];
  raw.forEach(([d, chord, o = {}], t) => {
    const key = o.key || null, lo = localOf(K, key);
    const deg = localNote(K, lo, d, o.r || 0).deg;
    const next = raw.slice(t + 1).find((u) => !(u[2] && u[2].held));
    const ndeg = next ? localNote(K, lo, next[0], (next[2] && next[2].r) || 0).deg : null;
    const seq = ph.sequence && t >= ph.sequence[0] && t <= ph.sequence[1], nat = ph.natural && t >= ph.natural[0] && t <= ph.natural[1];
    out.push({ d, r: o.r || 0, struck: !o.held, strong: Array.isArray(ph.strong) ? !!ph.strong[t] : ph.strong === "all" ? true : t % 2 === 0, chord, key, chroma: o.chroma || null, sequence: !!seq, natural: !!nat,
               family: o.family, dominant: deg === 4 && (ndeg === null || isDominant(4, ndeg)), deg });
  });
  return out;
}

/** A phrase in four parts: spec {phrase, key (a tonic; the mode the phrase's), figured, ro, line, style}. */
export function circle(spec = {}) {
  const id = spec.phrase || "fifths", ph = PHRASES[id];
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
  const F = fourOverBass({ key, bass: B, figured: spec.figured ?? true, ro: spec.ro ?? true, line: spec.line, weights: spec.weights, style: spec.style, end: spec.end });
  const S = F.soprano, w = S.world;
  return { ...F, phrase: id, spec: { ...spec, key }, units: B, K, n: B.length, keys: w.LOC,
           keyName: (t) => { const k = w.LOC[t].key; return `${k.tonic.replace("b", "♭").replace("#", "♯")} ${k.mode}`; },
           code: (name) => { const m = /^([A-G])([#♯b♭]*)(-?\d+)$/.exec(name); if (!m) return null;
                             for (const a of [0, 1, -1]) for (let d = -21; d < 35; d++) if (K.name(d, a).replace("♯", "#").replace("♭", "b") === name.replace("♯", "#").replace("♭", "b")) return codeOf3(d, a);
                             return null; },
           name: (c) => K.name(codeDegree(c), codeAlter(c)), degree: codeDegree, alter: codeAlter, hz: (c) => K.hz(codeDegree(c), codeAlter(c)) };
}
