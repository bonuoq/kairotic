// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 59 · galant: the Galant schemata in three parts (Job IJzerman, Harmony, Counterpoint, Partimento,
// OUP 2018, chapter 5), on @kairotic/cac's partimento.mjs (its copy beside this file): its GALANT data and its rules.
//
//   the schemata   the leaping Romanesca (Pachelbel), the Quiescenza (a pedal on ①), the Prinner (④ ③ ② ① under
//                  6̂ 5̂ 4̂ 3̂) and the modulating Prinner, the Monte Romanesca, the Fenaroli (a canon with the bass
//                  over a pedal on 5̂), the Folia — in major and minor where the book has both, the book's prototypes
//                  among their realizations
//   what is new    a pedal (the bass held under chords of its own: dissonances come and go by step), a voice that
//                  holds 5̂ long, a canon with the bass, a chromatic tone read as a key of its own (the Quiescenza's
//                  ♭⑦ toward ④, the modulating Prinner in the dominant) — partimento.mjs, @kairotic/cac 0.4.0
//   phrases        schemata joined into a phrase, as the book's exercises plan them: Handel's Chaconne (a Monte
//                  Romanesca, then a Galant cadence), a leaping Romanesca answered by a Prinner

import { parts, keyOf, GALANT, galantBass, CADENCES, localOf, localNote } from "./partimento.mjs";

const keyName = (k) => `${k.tonic.replace("b", "♭").replace("#", "♯")} ${k.mode}`;

// phrases: schemata (and a cadence) one after another, each placed by the end of the one before
export const PHRASES = {
  handel: { name: "Handel: Monte Romanesca, Galant cadence", ref: "IJzerman 5.4, ex. 5.25 (HWV 484)", key: { tonic: "C" }, parts: ["monte-romanesca", "galant"], close: true, top: [7, 22],
            about: "the theme of Handel's Chaconne: a Monte Romanesca rising ①–⑤, ②–⑥, ④–①, closed by a Galant cadence" },
  "romanesca-prinner": { name: "Romanesca, then Prinner", ref: "IJzerman 5.1, 5.3", key: { tonic: "C" }, parts: ["leaping-romanesca", "prinner"], close: true, hold: { middle: 3 },
                         about: "an opening gesture and its soft answer: the leaping Romanesca's falling thirds, the Prinner's ④ ③ ② ① under 6̂ 5̂ 4̂ 3̂" },
};

/** The schema of a phrase: its parts' events, each placed in the octave nearest the end of the one before. */
function phraseSchema(ph) {
  const events = [];
  let last = null;
  for (const id of ph.parts) {
    const s = GALANT[id] || CADENCES[id];
    const evs = s.events.map((e) => (e.length >= 4 ? e : [e[0], e[1], e[2], e[3] || {}]));
    const shift = last === null ? 0 : (() => { const base = evs[0][0]; let best = 0; for (let o = -14; o <= 14; o += 7) if (Math.abs(base + o - last) < Math.abs(base + best - last)) best = o; return best; })();
    for (const [d, len, chords, o] of evs) events.push([d + shift, len, chords, { ...o, ap: o.ap }]);
    last = events[events.length - 1][0];
  }
  return { ...ph, events };
}

/**
 * A schema in three parts: spec {schema (a name of GALANT or PHRASES), key (a tonic; the mode the schema's), figured
 * (the chords asked: true), ro (chapter 4's rules: true)}.
 */
export function galant(spec = {}) {
  const id = spec.schema || "leaping-romanesca";
  const g = GALANT[id] || (PHRASES[id] && phraseSchema(PHRASES[id]));
  if (!g) throw new Error(`no such schema: ${id}`);
  const home = g.book ? g.book.key : g.key;
  const mode = g.mode || home.mode || "major";
  const key = { tonic: spec.key && spec.key.tonic ? spec.key.tonic : home.tonic, mode };
  const K = keyOf(key);
  const B = galantBass(g, K);
  // (each bass note's degree in its key, for the page)
  for (const u of B) u.deg = localNote(K, localOf(K, u.key), u.d, u.r || 0).deg;
  // (a cadence's accented passing tone where it asks for one)
  let i = 0;
  for (const [, len, , o] of g.events) { for (let j = 0; j < len; j++, i++) if (o && o.ap && o.ap.includes(j)) B[i].ap = true; }
  const P = parts({ bass: B, cadence: null, key, figured: spec.figured ?? true, ro: spec.ro ?? true, hold: g.hold, imitate: g.imitate,
                    top: g.top, middle: g.middle, end: g.close ? undefined : false, line: spec.line });
  const KL = (t) => (B[t].key ? keyOf(B[t].key) : K);
  const sameKey = !spec.key || !spec.key.tonic || spec.key.tonic === home.tonic;
  return { ...P, id, schema: g, K, units: B, keyName: (t) => keyName(KL(t)),
           book: g.book && sameKey ? { top: g.book.top.split(" ").map(P.code), middle: g.book.middle.split(" ").map(P.code) } : null };
}

export const SCHEMATA = { ...GALANT, ...PHRASES };
export { GALANT };
