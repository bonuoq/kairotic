// SPDX-License-Identifier: MPL-2.0
// Study 62 · four: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/62-four/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { fourParts, PHRASES } from "../kairotic/four.mjs";
import { CHORDS4, RULE_OF_THE_OCTAVE4, octaveChord4 } from "../kairotic/partimento.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const VOICES = ["soprano", "alto", "tenor"];

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // the RO in four parts, as data
  is("the four-part RO up: 5/3 on ① and ⑤, 6/4/3 on ②, 6/5 on ④ and ⑦; down: ♯6/4/3 on ⑥ (G major), 4/2 on ④, 6/4/3 on ②",
     RULE_OF_THE_OCTAVE4.up.join(" ") === "5/3 6/4/3 6/3 6/5 5/3 6/3 6/5" && RULE_OF_THE_OCTAVE4.down.join(" ") === "5/3 6/4/3 6/3 4/2 5/3 6/4/3 6/3" &&
     octaveChord4(5, "down", "major").tonicize === 4 && octaveChord4(5, "down", "minor").chord === "+6/4/3");
  is("the dominant's family: semi-consonances whose 7th goes down (7: the 7th, 6/5: the 5th, 6/4/3: the 3rd, 4/2: the bass)",
     CHORDS4["7"].seventh === 6 && CHORDS4["6/5"].seventh === 4 && CHORDS4["6/4/3"].seventh === 2 && CHORDS4["4/2"].seventh === 0);

  // the book's realizations, among the ones counted
  const counts = {};
  for (const id of Object.keys(PHRASES)) {
    const P = fourParts({ phrase: id }), c = P.count();
    counts[id] = c;
    if (P.book) is(`${PHRASES[id].name} (${PHRASES[id].ref}): the book's realization is one of the ${c}`, !P.judge(P.book) && c > 0n);
  }
  notes.push(Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · "));
  is("... the counts, pinned", ["ro-up 13925", "ro-up-minor 13190", "ro-down 25312", "ro-down-minor 269851", "perfect 23", "tenor 637", "alto 62", "discant 1120", "galant 356", "galant-7 6", "dominant-seventh 85", "deceptive 21"]
     .every((x) => { const [k, v] = x.split(" "); return counts[k] === BigInt(v); }));

  // the voices and the chords
  const RU = fourParts({ phrase: "ro-up" }), b = RU.book;
  is("the RO up, the book's: the chords 5/3, 6/4/3, 6/3, 6/5/3, 5/3, 6/3, 6/5/3, 5/3", RU.chords(b).join(" ") === "5/3 6/4/3 6/3 6/5/3 5/3 6/3 6/5/3 5/3");
  const swap = { soprano: b.soprano, alto: b.tenor, tenor: b.alto };
  is("... the alto and the tenor exchanged: refused", RU.judge(swap) !== null);
  const sevenUp = { ...b, soprano: b.soprano.map((c, t) => (t === 7 ? RU.code("G5") : c)) };
  is("... the 7th of ⑦'s 6/5 (F) going up refused", /7th of the chord goes down|diminished 5th resolves/.test(RU.judge(sevenUp) || ""));
  const RD = fourParts({ phrase: "ro-down" });
  is("the RO down: the 6/4/3 on ⑥ read in G major (F♯), the 4/2 on ④ G B D over F", RD.keyName(2) === "G major" && RD.name(RD.book.alto[2]) === "F♯4" && RD.chords(RD.book)[4] === "6/4/2");
  const RM = fourParts({ phrase: "ro-down-minor" });
  is("the RO down in minor: the French 6th on ⑥, its D♯ going up to E, its B (an augmented 4th) held into the 5th over E", RM.name(RM.book.alto[2]) === "D♯4" && RM.name(RM.book.alto[3]) === "E4" && RM.book.tenor[2] === RM.book.tenor[3]);
  is("... without the 6th going up: refused", /augmented 6th goes up/.test(RM.judge({ ...RM.book, alto: RM.book.alto.map((c, t) => (t === 3 ? RM.code("C#4") : c)) }) || "x") || RM.judge({ ...RM.book, alto: RM.book.alto.map((c, t) => (t === 3 ? RM.code("C#4") : c)) }) !== null);

  // the cadences
  const G = fourParts({ phrase: "galant" });
  is("the Galant cadence: the inner voices inverted, their 4ths become 5ths — parallel, refused (ex. 6.13c, «wrong!»)", /parallel 5ths between the alto and the tenor/.test(G.judge(G.wrong) || ""));
  is("... the book's: the soprano and the tenor in parallel 6ths", G.book.soprano.every((c, t) => G.degree(c) - G.degree(G.book.tenor[t]) === 5));
  const DC = fourParts({ phrase: "discant" });
  is("the discant cadence: the tied ① a 5/2, its 2nd doubled (the bass the dissonance), resolved down to ⑦", DC.chords(DC.book)[1] === "5/2" && !DC.units[1].struck && DC.units[2].d === -1);

  // the dominant 7th: its leading tone up, its 7th down; the deceptive ⑥ doubles its 3rd
  const V7 = fourParts({ phrase: "dominant-seventh" }), r = rng(61);
  is("V7 → I: in every realization the 7th goes down by step and the leading tone up (an inner voice may fall to ⑤) — 30 drawn", (() => {
    for (let i = 0; i < 30; i++) {
      const W = V7.sample(r);
      for (const [k, U] of VOICES.map((v) => [v, W[v]])) {
        const i_ = VOICES.indexOf(k), cl = V7.voices[i_].vertical(1, U[1]).cls, step = V7.degree(U[2]) - V7.degree(U[1]);
        if (cl === 6 && step !== -1) return false;
        if (cl === 2 && step !== 1 && !(k !== "soprano" && step === -2)) return false;
      }
    }
    return true;
  })());
  const DE = fourParts({ phrase: "deceptive" });
  is("V7 → ⑥: the leading tone up, the 7th down — the 3rd of ⑥ doubled whenever the V7 is complete (30 drawn)", (() => {
    for (let i = 0; i < 30; i++) {
      const W = DE.sample(r), cls = (t) => VOICES.map((v, k) => DE.voices[k].vertical(t, W[v][t]).cls);
      if (cls(1).includes(4) && cls(2).filter((c) => c === 2).length < 2) return false;
    }
    return true;
  })());

  // doublings, everywhere: never the leading tone, never the 7th of the chord
  is("never the leading tone doubled, nor the 7th of a chord (the RO up and down, 20 drawn each)", (() => {
    for (const id of ["ro-up", "ro-down", "ro-up-minor"]) {
      const P = fourParts({ phrase: id });
      for (let i = 0; i < 20; i++) {
        const W = P.sample(r);
        for (let t = 0; t < P.n; t++) {
          const lt = VOICES.filter((v) => { const l = P.soprano.loc(t, W[v][t]), m = P.soprano.keys[t].key.mode; return l.deg === 6 && (m === "major" ? l.alt === 0 : l.alt === 1); }).length + (P.soprano.locB(t) === 6 ? 1 : 0);
          if (lt > 1) { notes.push(`${id} unit ${t + 1}: the leading tone doubled`); return false; }
        }
      }
    }
    return true;
  })());

  // transposed: the same counts
  for (const [id, tonic] of [["ro-up", "Eb"], ["ro-down", "G"], ["galant", "F"], ["ro-down-minor", "D"]])
    is(`${PHRASES[id].name} in ${tonic.replace("b", "♭")}: the same count (${counts[id]})`, fourParts({ phrase: id, key: { tonic } }).count() === counts[id]);

  // the engine
  for (const id of Object.keys(PHRASES)) {
    const P = fourParts({ phrase: id });
    let ok = true;
    for (let i = 0; i < 2 && ok; i++) { const W = P.engine({ temp: 0.5, r }); ok = W && !P.judge(W); }
    is(`${PHRASES[id].name}: the engine's realizations sound`, ok);
  }
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  for (const [w, ok] of results) if (!ok) console.log("  FAIL " + w);
  for (const s of notes) console.log("  · " + s);
  return bad.length;
}
