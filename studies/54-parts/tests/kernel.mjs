// SPDX-License-Identifier: MPL-2.0
// Study 54 · parts: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/54-parts/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { parts, SCHEMATA, CADENCES, CHORDS } from "../kairotic/parts.mjs";
import { shape } from "../kairotic/soft.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const twice = (s) => s.split(" ").flatMap((x) => [x, x]);

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // a Fauxbourdon written by hand after the book (ex. 2.7): the upper voices a 4th apart, in 6ths and 3rds over
  // the bass, then a simple cadence
  const F = parts({ schema: "fauxbourdon", cadence: "simple", key: { tonic: "C" } });
  const fw = { top: [...twice("E5 G5 F5 E5 D5 C5 B4 C5 B4"), "C5"], middle: [...twice("C5 D5 C5 B4 A4 G4 F4 E4 D4"), "E4"] };
  const fwhy = F.judge({ top: fw.top.map(F.code), middle: fw.middle.map(F.code) });
  is(`a Fauxbourdon after the book, closed by a simple cadence, is a realization${fwhy ? " — " + fwhy : ""}`, !fwhy);
  const fch = F.chords({ top: fw.top.map(F.code), middle: fw.middle.map(F.code) });
  is("... its chords are the ones asked: (5)/3 on ①, 6/3 down the scale, 5/3 on ⑤, (5)/3 on ①", fch.join(" ") === ["(5)/3", "(5)/3", ...Array(12).fill("6/3"), "(5)/3", "(5)/3", "5/3", "5/3", "(5)/3"].join(" "));
  // the parallel 6/3 chords with the 4th inverted into a 5th: parallel 5ths between the upper voices (ex. 2.6b)
  const bad = F.check(["E5", "E5", "D5", "D5"].map(F.code), ["G4", "G4", "G4", "G4"].map(F.code), 4, F.code("C5"), F.code("F4"));
  is("the 6/3 chords with the 5th between the upper voices: parallel 5ths (ex. 2.6b)", /parallel 5ths between the upper voices/.test(bad || ""));

  // every phrase: a schema and a cadence — its realizations counted, a drawn one sound
  const known = { "fauxbourdon simple": 4176698n, "fauxbourdon-76 compound-64": 18n, "fifths-73 simple": 95n, "romanesca galant": 299n, "tied-bass deceptive": 4523n, "monte compound-54": 946n };
  const draw = rng(53);
  for (const s of Object.keys(SCHEMATA)) for (const c of Object.keys(CADENCES)) {
    const P = parts({ schema: s, cadence: c, key: { tonic: "C" } }), n = P.count();
    const k = `${s} ${c}`;
    if (k in known) is(`${P.schema.name} + ${P.cadence.name} cadence: ${known[k]} realizations`, n === known[k]);
    if (s === "fifths-73") { if (c !== "simple") is(`${P.schema.name} + ${P.cadence.name}: none — the 7th of ② must resolve, it cannot prepare the cadence`, n === 0n); continue; }
    is(`${P.schema.name} + ${P.cadence.name}: some (${n})`, n > 0n);
    const W = P.engine({ temp: 0.5, r: draw });
    is(`... the engine's realization is sound and one of them`, W && !P.judge(W) && P.count(W.top, W.middle) === 1n);
    notes.push(`${P.schema.name} + ${P.cadence.name}: ${n}; the engine's: ${W.top.map(P.name).join(" ")} / ${W.middle.map(P.name).join(" ")} — ${P.chords(W).join(" ")}`);
  }

  // the chains of the book, as the engine finds them
  const S76 = parts({ schema: "fauxbourdon-76", cadence: "compound-64", key: { tonic: "C" } }), w76 = S76.engine({ temp: 0, r: rng(1) });
  is("7–6 Fauxbourdon: 7/3 and 6/3 by turns, the 7th held (prepared) and resolved down to the 6th",
     S76.chords(w76).slice(2, 12).join(" ") === "7/3 6/3 7/3 6/3 7/3 6/3 7/3 6/3 7/3 6/3" && [2, 4, 6, 8, 10].every((t) => w76.top[t] === w76.top[t - 1] && S76.degree(w76.top[t + 1]) === S76.degree(w76.top[t]) - 1));
  const S73 = parts({ schema: "fifths-73", cadence: "simple", key: { tonic: "C" } }), w73 = S73.engine({ temp: 0, r: rng(1) });
  const held = [1, 2, 3, 4, 5].map((t) => (w73.top[t] === w73.top[t - 1] ? "top" : w73.middle[t] === w73.middle[t - 1] ? "middle" : "none"));
  is("Fifth Down Fourth Up: a 7/3 a beat, the 7th held by one upper voice and then the other (the 3rd held into the next 7th)",
     S73.chords(w73).slice(1, 6).every((c) => c === "7/3") && held.every((h, i) => h !== "none" && (i === 0 || h !== held[i - 1])));
  const STB = parts({ schema: "tied-bass", cadence: "simple", key: { tonic: "C" } }), wtb = STB.engine({ temp: 0, r: rng(1) });
  is("Tied Bass: a 4/2 on each tied bass note, the bass resolving down to a 6/3", STB.chords(wtb).slice(2, 10).join(" ") === "4/2 6/3 4/2 6/3 4/2 6/3 4/2 6/3");
  const SG = parts({ schema: "romanesca", cadence: "galant", key: { tonic: "C" } }), wg = SG.engine({ temp: 0, r: rng(1) });
  const g5 = SG.bass.findIndex((b) => b.ap);
  const apv = wg.top[g5] !== wg.top[g5 - 1] && wg.middle[g5] !== wg.middle[g5 - 1];
  is("Galant cadence: on ⑤ a 6/4 of accented passing tones — both upper voices struck there, nothing held — then 5/3", SG.chords(wg)[g5] === "6/4" && ["5/3", "(5)/3"].includes(SG.chords(wg)[g5 + 1]) && apv);
  const SC = parts({ schema: "romanesca", cadence: "compound-64", key: { tonic: "C" } }), c5 = SC.bass.findIndex((b) => b.part === "cadence");
  is("... while elsewhere an unprepared 4th is refused (a compound cadence's 6/4 must hold its 4th)", SC.pairs(...(() => { const W = SC.engine({ temp: 0, r: rng(2) }); return [W.top.slice(0, c5), W.middle.slice(0, c5)]; })()).every(([a, b]) => {
    const W2 = SC.engine({ temp: 0, r: rng(2) }); const vt = SC.top.vertical(c5, a), vm = SC.middle.vertical(c5, b);
    return !(vt.cls === 3 && a !== W2.top[c5 - 1]) && !(vm.cls === 3 && b !== W2.middle[c5 - 1]);
  }));

  // minor: the same phrases, ⑥ and ⑦ raised going up
  for (const [s, c] of [["fauxbourdon", "compound-54"], ["romanesca", "galant"], ["tied-bass", "simple"]]) {
    const P = parts({ schema: s, cadence: c, key: { tonic: "A", mode: "minor" } }), W = P.engine({ temp: 0.5, r: draw });
    is(`${P.schema.name} + ${P.cadence.name} in A minor: ${P.count()} realizations, the engine's sound${W ? ", the leading tone " + (W.top.concat(W.middle).some((x) => P.name(x).startsWith("G♯")) ? "raised" : "not used") : ""}`, P.count() > 0n && W && !P.judge(W));
  }

  // the engine against the uniform draw
  const U = parts({ schema: "fauxbourdon", cadence: "galant", key: { tonic: "C" } }), r2 = rng(9), su = [], se = [];
  for (let i = 0; i < 12; i++) { const a = U.sample(r2), b = U.engine({ temp: 0.5, r: r2 }); su.push(a.top.map(U.degree)); se.push(b.top.map(U.degree)); }
  const pu = shape(su), pe = shape(se);
  is(`the upper voice, drawn uniformly ${Math.round(100 * pu.steps)}% steps, by the engine ${Math.round(100 * pe.steps)}%`, pe.steps > pu.steps);
  is("the chords known: 5/3, 6/3, 7/3, 4/2, 6/4, 5/4", Object.keys(CHORDS).join(" ") === "5/3 6/3 7/3 4/2 6/4 5/4");
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  for (const [w, ok] of results) if (!ok) console.log("  FAIL " + w);
  for (const s of notes) console.log("  · " + s);
  return bad.length;
}
