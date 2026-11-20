// SPDX-License-Identifier: MPL-2.0
// Study 57 · octave: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/57-octave/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { octave, octaveRun, PHRASES, RULE_OF_THE_OCTAVE, transpose } from "../kairotic/octave.mjs";
import { keyOf, codeOf, codeDegree, codeAlter, localOf, localNote, octaveChord, schemata } from "../kairotic/partimento.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const mod = (a, m) => ((a % m) + m) % m;

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // keys: a note is a degree in the letters of the key of the whole and an alteration; read in a key of its unit
  const C = keyOf({ tonic: "C" });
  const bb = codeOf(C, "Bb3"), fs = codeOf(C, "F#4");
  is("a note of another key: B♭3 in C is ⑦ lowered, F♯4 ④ raised (an alteration of −1, +1)", codeDegree(bb) === 6 && codeAlter(bb) === -1 && codeDegree(fs) === 10 && codeAlter(fs) === 1 && C.name(codeDegree(bb), codeAlter(bb)) === "B♭3");
  const G = localOf(C, { tonic: "G" }), F = localOf(C, { tonic: "F" });
  is("... read in G major F♯ is ⑦, in F major B♭ is ④ — notes of those keys", (() => { const a = localNote(C, G, codeDegree(fs), codeAlter(fs)), b = localNote(C, F, codeDegree(bb), codeAlter(bb)); return a.deg === 6 && a.alt === 0 && b.deg === 3 && b.alt === 0; })());

  // the Rule of the Octave, as data
  is("the RO up: 5/3 on ① and ⑤, 6/3 between; down: a 4/2 on ④", RULE_OF_THE_OCTAVE.up.join(" ") === "5/3 6/3 6/3 6/3 5/3 6/3 6/3" && RULE_OF_THE_OCTAVE.down[3] === "4/2" && RULE_OF_THE_OCTAVE.down[4] === "5/3");
  is("... going down in major ⑥ is read in the key of ⑤ (its raised 6th, a leading tone to ⑤); not in minor, nor going up", octaveChord(5, "down", "major").tonicize === 4 && octaveChord(5, "down", "minor").tonicize === null && octaveChord(5, "up", "major").tonicize === null);
  is("a run by the RO: the descending tetrachord of C, ⑥ in G major", (() => { const r = octaveRun({ tonic: "C" }, 7, 4); return r.map((x) => x.name).join(" ") === "C4 B3 A3 G3" && r[2].key && r[2].key.tonic === "G" && r.map((x) => x.chords[0]).join(" ") === "5/3 6/3 6/3 5/3"; })());

  // the book's prototypes (ex. 4.22): realizations of their chords — with chapter 4's rules, and only with them
  for (const [id, count] of [["ro-major", 14342n], ["ro-minor", 37172n]]) {
    const P = octave({ phrase: id }), P0 = octave({ phrase: id, ro: false });
    const why = P.judge(P.book), why0 = P0.judge(P0.book);
    is(`${PHRASES[id].name} (${PHRASES[id].ref}): the book's realization is one of the ${count} the RO's chords allow`, !why && P.count() === count);
    is(`... without chapter 4's rules none: the 4/2 on the descending ④ refused (${why0})`, P0.count() === 0n && /unit 14/.test(why0 || ""));
  }
  const PM = octave({ phrase: "ro-major" });
  is("... in major the descending ⑥ takes F♯ (the 6th raised, in G major), the 4/2 on ④ G and B over F", (() => { const ch = PM.chords(PM.book); return PM.name(PM.book.top[11]) === "F♯5" && PM.keyName(11) === "G major" && ch[13] === "4/2"; })());

  // the pentachords and tetrachords
  const runs = {};
  for (const id of ["pentachord-up", "pentachord-down", "tetrachord-up", "tetrachord-down"]) runs[id] = [octave({ phrase: id }).count(), octave({ phrase: id, ro: false }).count()];
  notes.push(Object.entries(runs).map(([id, [a, b]]) => `${id}: ${a} (${b} without chapter 4)`).join(" · "));
  is("the descending pentachord only with chapter 4's rules (its 4/2); the others the same with or without", runs["pentachord-down"][0] > 0n && runs["pentachord-down"][1] === 0n && runs["pentachord-up"][0] === runs["pentachord-up"][1] && runs["tetrachord-up"][0] === runs["tetrachord-up"][1]);

  // the semi-consonances: unprepared, resolved — the augmented 4th up to a 6th, the diminished 5th down to a 3rd
  const resolved = (P, W) => {
    for (const V of [[W.top, P.top], [W.middle, P.middle]]) for (let t = 0; t + 1 < P.n; t++) {
      const v = V[1].vertical(t, V[0][t]);
      if (!v.tri) continue;
      const w = V[1].vertical(t + 1, V[0][t + 1]), step = P.degree(V[0][t + 1]) - P.degree(V[0][t]);
      // (held on over a bass that holds, it resolves later)
      if (step === 0 && !P.bass[t + 1].struck) continue;
      if (v.tri === "A4" && !(step === 1 && w.cls === 5) && !(step === 0 && w.q !== "dissonant")) return `unit ${t + 1}: ${P.name(V[0][t])} → ${P.name(V[0][t + 1])}`;
      if (v.tri === "d5" && !(step === -1 && w.cls === 2) && !(step === 0 && w.q !== "dissonant")) return `unit ${t + 1}: ${P.name(V[0][t])} → ${P.name(V[0][t + 1])}`;
    }
    return null;
  };
  is("the augmented 4th of the 4/2 resolves up to a 6th, the diminished 5th down to a 3rd (every realization of the descending pentachord, and 20 of the RO)", (() => {
    const P = octave({ phrase: "pentachord-down" }), r = rng(4);
    for (let i = 0; i < 16; i++) { const W = P.sample(r); const e = W && resolved(P, W); if (e) { notes.push("unresolved: " + e); return false; } }
    for (let i = 0; i < 20; i++) { const W = PM.sample(r); const e = resolved(PM, W); if (e) { notes.push("unresolved: " + e); return false; } }
    return true;
  })());
  is("... the 4/2 a note of the chord before over the passing bass, consonant again when the bass moves on", (() => {
    const P = octave({ phrase: "pentachord-down" }), r = rng(5);
    for (let i = 0; i < 12; i++) {
      const W = P.sample(r), t = 1;
      for (const [V, X] of [[W.top, P.top], [W.middle, P.middle]]) if (X.vertical(t - 1, V[t]).q === "dissonant" || X.vertical(t + 1, V[t + 1]).q === "dissonant") return false;
    }
    return true;
  })());
  // two parts too: the upper voice over the descending pentachord, a semi-consonance free to enter
  is("two parts (schemata with ro): an augmented 4th struck on a strong unit, unprepared, then up to the 6th; refused without", (() => {
    const bass = [3, 2].map((d, t) => ({ d, r: 0, struck: true, strong: t % 2 === 0 }));
    const S = schemata({ schema: { events: [] }, bass, key: { tonic: "C" }, figured: false, ro: true, lo: 7, hi: 21, voice: "middle" }), S0 = schemata({ schema: { events: [] }, bass, key: { tonic: "C" }, figured: false, lo: 7, hi: 21, voice: "middle" });
    return S.check([], 0, S.code("B4")) === null && S.check([S.code("B4")], 1, S.code("C5")) === null && /resolves up to a 6th/.test(S.check([S.code("B4")], 1, S.code("A4")) || "") && S0.check([], 0, S0.code("B4")) !== null;
  })());

  // modulation: segments of the RO in keys of their own
  const B5 = octave({ phrase: "bach-541" }), B50 = octave({ phrase: "bach-541", ro: false });
  is(`Bach's ascending tetrachords, D → G → C: ${B5.count()} realizations, none without chapter 4 (the 7th of ⑥ resolves to the diminished 5th of ⑦)`, B5.count() === 12n && B50.count() === 0n);
  is("... the keys boxed: D major, G major from the D held as ⑤, C major from the G", B5.keyName(0) === "D major" && B5.keyName(3) === "D major" && B5.keyName(4) === "G major" && B5.keyName(7) === "G major" && B5.keyName(8) === "C major");
  is("... in every realization: C♯ only in D, F♯ not in C, F♮ in C; the 7/3 on ⑥ then the diminished 5/3 on ⑦ (12 drawn)", (() => {
    const r = rng(6);
    for (let i = 0; i < 12; i++) {
      const W = B5.sample(r), ch = B5.chords(W);
      for (let t = 0; t < B5.n; t++) for (const c of [W.top[t], W.middle[t]]) {
        const nm = B5.name(c), k = B5.keyName(t);
        if ((/C♯/.test(nm) && k !== "D major") || (/F♯/.test(nm) && k === "C major") || (/^F\d/.test(nm) && k !== "C major")) { notes.push(`unit ${t + 1}: ${nm} in ${k}`); return false; }
      }
      if (![1, 5, 9].every((t) => ch[t] === "7/3") || resolved(B5, W)) return false;
    }
    return true;
  })());
  const BE = octave({ phrase: "beethoven-10-1" });
  is(`Beethoven's descending pentachords, A♭ → F minor → D♭: ${BE.count()} realizations, none without chapter 4`, BE.count() === 149n && octave({ phrase: "beethoven-10-1", ro: false }).count() === 0n);
  is("... the F minor segment's leading tone E♮ (its ② a 6/3 with the raised ⑦), the D♭ segment's G♭", (() => {
    const r = rng(7);
    for (let i = 0; i < 8; i++) {
      const W = BE.sample(r), at = (t) => [W.top[t], W.middle[t]].map(BE.name);
      if (!at(8).some((x) => /^E\d/.test(x)) || !BE.units[11].r === -1) return false;
    }
    return BE.keyName(5) === "F minor" && BE.keyName(10) === "D♭ major" && BE.K.name(BE.units[11].d, BE.units[11].r) === "G♭2";
  })());

  // transposed: the same counts in every key (the keys of the segments moved with it)
  for (const [id, k] of [["ro-major", { tonic: "Eb" }], ["ro-minor", { tonic: "D", mode: "minor" }], ["bach-541", { tonic: "C" }], ["beethoven-10-1", { tonic: "G" }]]) {
    const a = octave({ phrase: id }).count(), b = octave({ phrase: id, key: k }).count();
    const keys = [...new Set(octave({ phrase: id, key: k }).units.map((u, t, arr) => t))].length;
    is(`${PHRASES[id].name} in ${k.tonic.replace("b", "♭")} ${k.mode || "major"}: the same count (${a})`, a === b && keys > 0);
  }
  is("Bach's tetrachords moved to C: C → F → B♭", (() => { const T = transpose(PHRASES["bach-541"], { tonic: "C" }); return T.bass[3].key[1].tonic === "F" && T.bass[6].key[1].tonic === "Bb"; })());

  // the engine: sound realizations, and its soft rules
  const r = rng(57);
  for (const id of Object.keys(PHRASES)) {
    const P = octave({ phrase: id });
    let ok = true;
    for (let i = 0; i < 3 && ok; i++) { const W = P.engine({ temp: 0.5, r }); ok = W && !P.judge(W); }
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
