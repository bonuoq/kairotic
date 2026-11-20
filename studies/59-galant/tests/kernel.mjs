// SPDX-License-Identifier: MPL-2.0
// Study 59 · galant: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/59-galant/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { galant, SCHEMATA, GALANT } from "../kairotic/galant.mjs";
import { CHORDS, schemata } from "../kairotic/partimento.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const mod = (a, m) => ((a % m) + m) % m;

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // the book's prototypes: realizations of their schemata, in their keys
  const counts = {};
  for (const id of Object.keys(GALANT)) {
    const P = galant({ schema: id }), why = P.judge(P.book), c = P.count();
    counts[id] = c;
    is(`${GALANT[id].name} (${GALANT[id].ref}): the book's prototype is one of the ${c} realizations`, !why && c > 0n);
  }
  notes.push(Object.entries(counts).map(([k, v]) => `${k} ${v}`).join(" · "));
  is("... the counts, pinned", ["leaping-romanesca 468", "quiescenza 3", "prinner 11", "prinner-modulating 8", "monte-romanesca 213", "fenaroli 3", "folia 568"].every((x) => { const [k, v] = x.split(" "); return counts[k] === BigInt(v); }));

  // the pedal: the Quiescenza over its held ①
  const Q = galant({ schema: "quiescenza" });
  is("the Quiescenza: one bass note held five units, 7/3, 6/4 and 7/4 over it (the 7/4 among the chords)", Q.units.filter((u) => u.struck).length === 1 && Q.units.filter((u) => u.pedal).length === 4 && CHORDS["7/4"] && Q.chords(Q.book).join(" ") === "(5)/3 7/3 6/4 7/4 (5)/3");
  is("... its B♭ read in F major (toward ④), its B♮ back in C", Q.keyName(1) === "F major" && Q.keyName(3) === "C major" && Q.name(Q.book.top[1]) === "B♭4" && Q.name(Q.book.top[3]) === "B4");
  is("... over the pedal a dissonance comes and goes by step: a leap into the 7th refused", (() => {
    const T = Q.top, c = (n) => T.codes.find((x) => Q.name(x) === n);
    return T.check([c("C5")], 1, c("B♭4")) === null && T.check([c("E5")], 1, c("B♭4")) !== null;
  })());
  const Qm = galant({ schema: "quiescenza-minor" });
  is("the Quiescenza in minor: the raised ③ (C♯), a chromatic step where the key changes (A minor → D minor)", Qm.name(Qm.book.middle[1]) === "C♯4" && Qm.keyName(1) === "D minor" && !Qm.judge(Qm.book));

  // the canon: the Fenaroli
  const Fe = galant({ schema: "fenaroli" });
  is("the Fenaroli: the middle voice sings the bass two units later an octave higher, the upper holds 5̂ nine units", (() => {
    const W = Fe.book;
    return W.middle.slice(2).every((c, i) => Fe.degree(c) === Fe.units[i].d + 7) && new Set(W.top).size === 1;
  })());
  is("... every realization keeps the canon (3 of them)", (() => { const r = rng(1); for (let i = 0; i < 6; i++) { const W = Fe.sample(r); if (!W.middle.slice(2).every((c, i) => Fe.degree(c) === Fe.units[i].d + 7)) return false; } return true; })());
  is("... in minor the canon in the upper voice, the pedal in the middle", (() => { const F = galant({ schema: "fenaroli-minor" }), W = F.book; return W.top.slice(2).every((c, i) => F.degree(c) === F.units[i].d + 14) && new Set(W.middle).size === 1; })());
  is("... without chapter 4's rules none: the 6/4 on ② over the passing bass", galant({ schema: "fenaroli", ro: false }).count() === 0n);

  // the Prinner, the modulating Prinner
  const Pr = galant({ schema: "prinner" });
  is("the Prinner: 6̂ 5̂ 4̂ 3̂ in 10ths over ④ ③ ② ①, a 5/3 on ④, a 7–6 on ②", Pr.chords(Pr.book).join(" ") === "5/3 6/3 7/3 6/3 (5)/3" && Pr.book.top.every((c, t) => mod(Pr.degree(c) - Pr.units[t].d, 7) === 2 || t === 3));
  const Pm = galant({ schema: "prinner-modulating" });
  is("the modulating Prinner: ① ⑦ ⑥ ⑤ of C read as ④ ③ ② ① of G, its F♯", Pm.keyName(0) === "G major" && Pm.units.map((u) => u.deg).join("") === "32110" && Pm.name(Pm.book.middle[3]) === "F♯4");

  // the Romanescas, the Folia
  is("the leaping Romanesca in minor keeps ⑦ natural over ⑤ (passed in the sequence): G, not G♯", (() => { const R = galant({ schema: "leaping-romanesca-minor" }); return R.name(R.book.top[3]) === "G4" && !R.units[1].dominant; })());
  is("the Monte Romanesca in minor: the diminished 4th G♯–C (the raised ⑦ to ③) allowed in minor", (() => { const R = galant({ schema: "monte-romanesca-minor" }); return R.name(R.book.middle[1]) === "G♯3" && R.name(R.book.middle[2]) === "C4" && !R.judge(R.book); })());
  is("the Folia: minor only, its ⑤ a dominant (C♯), its ⑦ natural (C)", (() => { const F = galant({ schema: "folia" }); return F.K.mode === "minor" && F.name(F.book.top[1]) === "C♯5" && F.K.name(F.units[3].d, F.units[3].r) === "C3"; })());

  // phrases: schemata joined
  for (const [id, min] of [["handel", 100n], ["romanesca-prinner", 100n]]) {
    const P = galant({ schema: id }), c = P.count();
    let ok = c >= min;
    const r = rng(7);
    for (let i = 0; i < 3 && ok; i++) { const W = P.engine({ temp: 0.5, r }); ok = W && !P.judge(W); }
    is(`${SCHEMATA[id].name}: ${c} realizations, the engine's sound`, ok);
  }
  is("Handel's: the Galant cadence's accented 6/4 on ⑤ (unprepared)", (() => { const P = galant({ schema: "handel" }); return P.units.some((u) => u.ap) && P.units.slice(-5, -3).every((u) => u.deg === 3); })());

  // transposed: the same counts in other keys
  for (const [id, t] of [["leaping-romanesca", "G"], ["quiescenza", "F"], ["fenaroli", "D"], ["prinner-modulating", "Eb"], ["folia", "E"], ["monte-romanesca-minor", "D"]]) {
    is(`${GALANT[id].name} in ${t.replace("b", "♭")}: the same count (${counts[id]})`, galant({ schema: id, key: { tonic: t } }).count() === counts[id]);
  }

  // the engine: sound realizations
  const r = rng(59);
  for (const id of Object.keys(GALANT)) {
    const P = galant({ schema: id });
    let ok = true;
    for (let i = 0; i < 2 && ok; i++) { const W = P.engine({ temp: 0.5, r }); ok = W && !P.judge(W); }
    is(`${GALANT[id].name}: the engine's realizations sound`, ok);
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
