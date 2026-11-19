// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 57 · octave: the Rule of the Octave, and modulation by its pentachords and tetrachords (Job
// IJzerman, Harmony, Counterpoint, Partimento, OUP 2018, chapter 4) — in three parts, on @kairotic/cac's
// partimento.mjs (its copy beside this file), now with a key for each bass note.
//
//   the RO         a chord for each degree of a scale in the bass: ① and ⑤ stable (5/3), the degrees between them
//                  mobile (6/3); going down ④ passes under the chord of ⑤ (4/2) and, in major, ⑥ takes a raised
//                  6th, a leading tone to ⑤ (read in the key of ⑤)
//   its parts      the ascending and descending pentachords (①–⑤) and tetrachords (⑤–①), the complete RO up and
//                  down; the book's prototypes (ex. 4.22) realizations of their chords
//   modulation     segments of the RO in keys of their own, as the book boxes them: Bach's ascending tetrachords
//                  (BWV 541, D → G → C, the ① of one the ⑤ of the next, a 7–6 on ⑥) and Beethoven's descending
//                  pentachords (op. 10/1, A♭ major → F minor → D♭ major, a third lower each)
//   chapter 4      the augmented 4th and the diminished 5th as semi-consonances (unprepared, resolved), the upper
//                  voices over a passing bass (the 4/2): spec.ro of partimento.mjs, on here, off to compare

import { parts, keyOf, codeOf, codeDegree, codeAlter, isDominant, octaveChord, RULE_OF_THE_OCTAVE, CHORDS } from "./partimento.mjs";

const mod = (a, m) => ((a % m) + m) % m;
const keyName = (k) => `${k.tonic.replace("b", "♭").replace("#", "♯")} ${k.mode}`;

/**
 * The bass's units from notes: [{name ("C3", "F#3"), len (units), chords ([one a unit], or null: by the RO), key
 * ({tonic, mode}, or null: the key of the whole; or one a unit — a pivot: the ① of one key held into the ⑤ of the
 * next)}], in the key of the whole K. Strong and weak alternate (phase 1: an upbeat first); a dominant is a ⑤ going to
 * ① or ⑥ (or closing), read in the note's key.
 */
export function unitsOf(K, notes, phase = 0) {
  const ns = notes.map((x) => { const c = codeOf(K, x.name); return { ...x, d: codeDegree(c), r: codeAlter(c) }; });
  const keyOfUnit = (x, j) => (Array.isArray(x.key) ? x.key[Math.min(j, x.key.length - 1)] : x.key) || null;
  const keyAt = (x, j = 0) => (keyOfUnit(x, j) ? keyOf(keyOfUnit(x, j)) : K);
  const degIn = (x, k) => mod(x.d - mod(k.letter - K.letter, 7), 7);
  const out = [];
  ns.forEach((x, i) => {
    const nx = ns[i + 1];
    const dir = nx ? (nx.d > x.d ? "up" : nx.d < x.d ? "down" : "same") : ns[i - 1] && ns[i - 1].d > x.d ? "down" : "up";
    for (let j = 0; j < x.len; j++) {
      const k = keyAt(x, j), dg = degIn(x, k);
      const ro = octaveChord(dg, dir === "same" ? "up" : dir, k.mode);
      out.push({ d: x.d, r: x.r, struck: j === 0, strong: (out.length + phase) % 2 === 0, note: i,
                 chord: x.chords ? x.chords[Math.min(j, x.chords.length - 1)] : ro.chord,
                 key: keyOfUnit(x, j), deg: dg, dominant: dg === 4 && (!nx || [0, 5].includes(degIn(nx, k))) });
    }
  });
  return out;
}

/** A scale run in the bass by the Rule of the Octave: from degree a to degree b of key k (a bass note a unit), its
 *  descending ⑥ in major read in the key of ⑤. Notes as unitsOf takes them. */
export function octaveRun(k, a, b) {
  const K = keyOf(k), out = [];
  const step = b >= a ? 1 : -1;
  for (let d = a; step > 0 ? d <= b : d >= b; d += step) {
    // in minor ⑥ and ⑦ go up raised, down natural (melodic minor in the bass, as the book's ex. 4.22b)
    const r = K.mutable(d) && step > 0 && d !== b ? 1 : 0;
    const dir = d === b ? (step > 0 ? "up" : "down") : step > 0 ? "up" : "down";
    const ro = octaveChord(mod(d, 7), dir, K.mode);
    const fifth = { tonic: K.name(4, 0).replace(/-?\d+$/, "").replace("♯", "#").replace("♭", "b"), mode: "major" };
    out.push({ name: K.name(d, r).replace("♯", "#").replace("♭", "b"), len: 1, chords: [ro.chord], key: ro.tonicize !== null && d !== b ? fifth : null });
  }
  return out;
}

const n1 = (name, chord, key) => ({ name, len: 1, chords: [chord], key: key || null });

// The book's prototypes of the complete RO (ex. 4.22): the upper and middle voices unit by unit; a bass note a half
// bar, ⑤ and the high ① two (the upper voices changing position over them).
const RO22 = {
  major: { key: { tonic: "C" },
           bass: [n1("C3", "5/3"), n1("D3", "6/3"), n1("E3", "6/3"), n1("F3", "6/3"), { name: "G3", len: 2, chords: ["5/3", "5/3"] }, n1("A3", "6/3"), n1("B3", "6/3"),
                  { name: "C4", len: 2, chords: ["5/3", "5/3"] }, n1("B3", "6/3"), n1("A3", "6/3", { tonic: "G" }), n1("G3", "5/3"), n1("F3", "4/2"), n1("E3", "6/3"), n1("D3", "6/3"), n1("C3", "5/3")],
           top: "C5 B4 C5 D5 B4 G5 F5 G5 E5 G5 G5 F#5 G5 B4 C5 B4 C5", middle: "E4 F4 G4 A4 G4 B4 C5 D5 C5 E5 D5 C5 B4 G4 G4 F4 E4" },
  minor: { key: { tonic: "A", mode: "minor" },
           bass: [n1("A2", "5/3"), n1("B2", "6/3"), n1("C3", "6/3"), n1("D3", "6/3"), { name: "E3", len: 2, chords: ["5/3", "5/3"] }, n1("F#3", "6/3"), n1("G#3", "6/3"),
                  { name: "A3", len: 2, chords: ["5/3", "5/3"] }, n1("G3", "6/3"), n1("F3", "6/3"), n1("E3", "5/3"), n1("D3", "4/2"), n1("C3", "6/3"), n1("B2", "6/3"), n1("A2", "5/3")],
           top: "A4 G#4 A4 B4 G#4 E5 D5 E5 C5 E5 E5 D5 E5 G#4 A4 G#4 A4", middle: "C4 D4 E4 F4 E4 G#4 A4 B4 A4 C5 B4 A4 G#4 E4 E4 D4 C4" },
};

// The phrases of the study: what the bass is, in which keys, and what the book says of it.
export const PHRASES = {
  "ro-major": { name: "the RO, major", ref: "IJzerman 4.4, ex. 4.22(a)", key: RO22.major.key, bass: RO22.major.bass, book: RO22.major,
                about: "up the scale and down again: 5/3 on ① and ⑤, 6/3 between them; going down a 4/2 on ④ (the bass passing under the chord of ⑤) and a raised 6th on ⑥, a leading tone to ⑤" },
  "ro-minor": { name: "the RO, minor", ref: "IJzerman 4.4, ex. 4.22(b)", key: RO22.minor.key, bass: RO22.minor.bass, book: RO22.minor,
                about: "the bass up the melodic scale (F♯, G♯) and down the natural one; the 6/3 on ② with the raised ⑦, the chord on ⑤ major" },
  "pentachord-up": { name: "ascending pentachord", ref: "IJzerman 4.1, ex. 4.4", key: { tonic: "C" }, bass: octaveRun({ tonic: "C" }, 0, 4),
                     about: "①–⑤: from the tonic to the dominant, 6/3 on ②, ③ and ④" },
  "pentachord-down": { name: "descending pentachord", ref: "IJzerman 4.2, ex. 4.11", key: { tonic: "C" }, bass: octaveRun({ tonic: "C" }, 4, 0),
                       about: "⑤–①: ④ a passing tone under the chord of ⑤, a 4/2 whose augmented 4th resolves up to the 6th of ③" },
  "tetrachord-up": { name: "ascending tetrachord", ref: "IJzerman 4.3, ex. 4.13", key: { tonic: "C" }, bass: octaveRun({ tonic: "C" }, 4, 7),
                     about: "⑤–①: 6/3 on ⑥ and ⑦" },
  "tetrachord-down": { name: "descending tetrachord", ref: "IJzerman 4.4, ex. 4.21", key: { tonic: "C" }, bass: octaveRun({ tonic: "C" }, 7, 4),
                       about: "①–⑤: 6/3 on ⑦ and ⑥, in major the 6th on ⑥ raised, a leading tone to ⑤" },
  "bach-541": { name: "Bach: tetrachords, D → G → C", ref: "IJzerman 4.3, ex. 4.16–4.17 (BWV 541)", key: { tonic: "D" }, phase: 1,
                bass: [n1("A2", "5/3"), n1("B2", "7/3"), n1("C#3", "5/3"), { name: "D3", len: 2, chords: ["5/3", "5/3"], key: [null, { tonic: "G" }] },
                       n1("E3", "7/3", { tonic: "G" }), n1("F#3", "5/3", { tonic: "G" }), { name: "G3", len: 2, chords: ["5/3", "5/3"], key: [{ tonic: "G" }, { tonic: "C" }] },
                       n1("A3", "7/3", { tonic: "C" }), n1("B3", "5/3", { tonic: "C" }), n1("C4", "5/3", { tonic: "C" })],
                about: "three ascending tetrachords, each a 4th higher: the ① of one is the ⑤ of the next; a 7–6 on each ⑥ whose 6/3 goes straight to the diminished 5/3 on ⑦ (all voices moving at once)" },
  "beethoven-10-1": { name: "Beethoven: pentachords, A♭ → f → D♭", ref: "IJzerman 4.2, ex. 4.7–4.8 (op. 10/1)", key: { tonic: "Ab" },
                      bass: [...["Eb3", "Db3", "C3", "Bb2", "Ab2"].map((x, i) => n1(x, ["5/3", "4/2", "6/3", "6/3", "5/3"][i])),
                             ...["C3", "Bb2", "Ab2", "G2", "F2"].map((x, i) => n1(x, ["5/3", "4/2", "6/3", "6/3", "5/3"][i], { tonic: "F", mode: "minor" })),
                             ...["Ab2", "Gb2", "F2", "Eb2", "Db2"].map((x, i) => n1(x, ["5/3", "4/2", "6/3", "6/3", "5/3"][i], { tonic: "Db" }))],
                      about: "a modulating sequence of descending pentachords, each a third lower, in A♭ major, F minor and D♭ major: ⑤ (5)/3, ④ 4/2, ③ 6/3, ② 6/3, ① (5)/3 in each key" },
};

/** A phrase in three parts: spec {phrase (a name of PHRASES or {key, bass}), key (to transpose: a tonic and mode for
 *  the whole; the keys of the segments follow), figured (the chords asked: true), ro (chapter 4's rules: true)}. */
export function octave(spec = {}) {
  const ph = typeof spec.phrase === "string" ? PHRASES[spec.phrase] : spec.phrase || PHRASES["ro-major"];
  if (!ph) throw new Error(`no such phrase: ${spec.phrase}`);
  let key = ph.key, bass = ph.bass;
  if (spec.key && (spec.key.tonic !== ph.key.tonic || (spec.key.mode || "major") !== (ph.key.mode || "major"))) ({ key, bass } = transpose(ph, spec.key));
  const K = keyOf(key);
  const B = unitsOf(K, bass, ph.phase || 0);
  const P = parts({ bass: B, cadence: null, key, figured: spec.figured ?? true, ro: spec.ro ?? true, top: spec.top, middle: spec.middle, line: spec.line });
  const keyAt = (t) => (B[t].key ? keyOf(B[t].key) : K);
  return { ...P, phrase: ph, K, keyAt, keyName: (t) => keyName(keyAt(t)), units: B,
           book: ph.book && (!spec.key || spec.key.tonic === ph.key.tonic) ? { top: ph.book.top.split(" ").map(P.code), middle: ph.book.middle.split(" ").map(P.code) } : null };
}

/** A phrase moved to another tonic (the same mode): every note and every key moved by the same interval. */
export function transpose(ph, to) {
  const A = keyOf(ph.key), Bk = keyOf({ tonic: to.tonic, mode: ph.key.mode || "major" });
  const steps = mod(Bk.letter - A.letter, 7), semis = mod(Bk.pc - A.pc, 12);
  const LET = ["C", "D", "E", "F", "G", "A", "B"], WHITE = [0, 2, 4, 5, 7, 9, 11];
  const move = (name) => {
    const m = /^([A-G])([#b]*)(-?\d+)$/.exec(name);
    const L = LET.indexOf(m[1]), acc = [...m[2]].reduce((a, ch) => a + (ch === "#" ? 1 : -1), 0), o = Number(m[3]);
    const midi = 12 * (o + 1) + WHITE[L] + acc + semis - (semis > 6 ? 12 : 0);
    const L2 = L + steps - (semis > 6 ? 7 : 0), o2 = o + Math.floor(L2 / 7), l2 = mod(L2, 7);
    const a2 = midi - (12 * (o2 + 1) + WHITE[l2]);
    return LET[l2] + (a2 > 0 ? "#".repeat(a2) : "b".repeat(-a2)) + o2;
  };
  const moveKey = (k) => { if (Array.isArray(k)) return k.map((x) => (x ? moveKey(x) : null)); const nm = move(k.tonic.replace("♯", "#").replace("♭", "b") + "4").replace(/-?\d+$/, ""); return { tonic: nm, mode: k.mode || "major" }; };
  return { key: { tonic: to.tonic, mode: ph.key.mode || "major" }, bass: ph.bass.map((x) => ({ ...x, name: move(x.name), key: x.key ? moveKey(x.key) : null })) };
}

export { RULE_OF_THE_OCTAVE, CHORDS };
