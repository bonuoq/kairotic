// SPDX-License-Identifier: MPL-2.0
// Study 58 · incipit: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/58-incipit/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as I from "../kairotic/incipit.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// continuations of the C major incipit (① ③ ④ ⑤ ①), as a scripted Claude writes them
export const GOOD = [
  { plan: "parallel 3rds up the scale, a perfect cadence", cadence: "perfect", bass: "C3 D3 E3 F3 G3 C3", melody: "E4 E4 F4 A4 G4 C5 A4 A4 G4 B4 C5", about: "the incipit's step up made a scale" },
  { plan: "falling fifths to a cadence", cadence: "perfect", bass: "E3 A2 D3 G2 C3", melody: "G4 G4 A4 A4 F4 F4 G4 B4 C5", about: "a sequence of fifths" },
];
export const BAD = { plan: "a half cadence", cadence: "half", bass: "C3 B2 A2 G2", melody: "C5 F4 G4 B4 B4 A4 B4", about: "open, on ⑤" };
export const REPAIRED = { ...BAD, melody: "E4 F4 G4 B4 B4 A4 B4" };
export const OTHER = { plan: "a 6th chord on ④, a perfect cadence", cadence: "perfect", bass: "A2 F2 G2 C3", melody: "F4 G4 A4 C5 B4 B4 C5", about: "⑥ ④ ⑤ ①" };
export const answer = (text, list) => `${text}\n\`\`\`json\n${JSON.stringify(list)}\n\`\`\``;

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const C = I.INCIPITS["short-c"];

  // the incipits pass the rules
  for (const [id, x] of Object.entries(I.INCIPITS)) {
    const T = I.treeOf(x.phrase, { key: x.key });
    is(`the incipit ${id} passes the rules`, T.nodes[T.root].check.ok);
  }
  const T0 = I.treeOf(C.phrase, { key: C.key });
  is("the melody's range from the incipit's bass: D4 to B5 over ① ③ ④ ⑤ ①", T0.range.lo === 8 && T0.range.hi === 20);
  is("the incipit's schemata: a perfect cadence on ⑤–①", T0.nodes.p0.check.schemata.some((s) => /perfect cadence/.test(s.name)));
  is("the cadence's name read: compound and authentic are perfect or imperfect, interrupted deceptive", I.endingOf("compound") === "authentic" && I.endingOf("perfect authentic") === "perfect" && I.endingOf("interrupted") === "deceptive" && I.endingOf("Half cadence") === "half");

  // a phrase after the incipit: checked with the join
  const opts = { key: C.key, range: T0.range };
  const ok = I.check(C.phrase, GOOD[0], opts);
  is("a continuation passes: its figures, its schemata, its soft cost", ok.ok && ok.figures.length === 11 && ok.schemata.some((s) => /parallel 3rds/.test(s.name)) && ok.cost > 0 && ok.cost < 5);
  is("… the join judged: the note held over the bar may not be struck again (held three units)", (() => { const r = I.check(C.phrase, BAD, opts); return !r.ok && r.errors[0].unit === 1 && /held 2 units at most/.test(r.errors[0].reason); })());
  is("… the same phrase repaired passes", I.check(C.phrase, REPAIRED, opts).ok);
  is("a step is a phrase: fewer than 4 bass notes refused", /4 bass notes or more/.test(I.check(C.phrase, { bass: "F3 G3 C3", melody: "A4 A4 B4 B4 C5", cadence: "perfect" }, opts).errors[0].reason));
  is("the melody counted: (bass notes − 1) × 2 + 1", /the melody has 10 notes, the bass 6 notes make 11 units/.test(I.check(C.phrase, { ...GOOD[0], melody: GOOD[0].melody.split(" ").slice(1).join(" ") }, opts).errors[0].reason));
  is("the cadence named must be the bass's: a half cadence needs ⑤ at the end", /does not close with a half cadence/.test(I.check(C.phrase, { ...GOOD[0], cadence: "half" }, opts).errors[0].reason));
  is("a note out of the key refused, with its place", (() => { const r = I.check(C.phrase, { ...GOOD[0], melody: GOOD[0].melody.replace("F4", "F#4") }, opts); return !r.ok && r.errors[0].unit === 3; })());
  is("a rule broken inside the phrase: where, which notes, why", (() => { const r = I.check(C.phrase, { ...GOOD[0], melody: "E4 E4 F4 A4 G4 C5 A4 A4 G4 G4 C5" }, opts); return !r.ok && r.errors.some((e) => e.unit >= 9 && e.bass && e.reason); })());

  // the tree
  let [T1, a] = I.addPhrase(T0, "p0", GOOD[0]);
  let [T2, b] = I.addPhrase(T1, "p0", GOOD[1]);
  is("two continuations offered under the incipit", I.childrenOf(T2, "p0").length === 2 && a.state === "offered" && a.by === "Claude");
  T2 = I.choose(T2, a.id);
  is("one chosen to go on, the other left offered", T2.nodes[a.id].state === "chosen" && T2.nodes[b.id].state === "offered");
  const piece = I.pieceAt(T2, a.id);
  is("the piece up to it: 9 + 1 held + 11 units, the phrases starting at 0 and 10", piece.units === 21 && piece.starts.join() === "0,10" && piece.melody[9] === "C5" && piece.bass[9] === "C3" && piece.path.length === 2);
  const mei = I.meiOf(piece, T2.key);
  is("its score: 11 measures, a double bar where the phrase starts, a rest to fill the last", (mei.match(/<measure /g) || []).length === 11 && /right="dbl"/.test(mei) && /<rest dur="2"\/>/.test(mei) && /meter.sym="cut"/.test(mei));
  is("a note held over the bar line tied", /tie="i"/.test(I.meiOf(I.pieceAt(I.treeOf(I.INCIPITS["scale-76"].phrase, { key: { tonic: "C" } }), "p0"), { tonic: "C" })));
  is("the score of a minor key: its signature, its raised ⑦ written", (() => { const x = I.INCIPITS["short-am"], T = I.treeOf(x.phrase, { key: x.key }), m = I.meiOf(I.pieceAt(T, "p0"), x.key); return /keysig="0"/.test(m) && /pname="g" oct="4" dur="2" accid="s"/.test(m); })());
  is("a frequency from a name: A4 is 440 Hz", Math.abs(I.hzOf({ tonic: "C" }, "A4") - 440) < 1e-6);

  // the engine writes a melody for a bass given, from the point
  const m1 = I.engineMelody(T2, a.id, "E3 F3 D3 G3 C3", { cadence: "authentic", r: rng(7) });
  is("the engine's melody for a bass (no Claude): it passes, deterministic with a seed", m1 && I.check(T2.nodes[a.id].phrase, { bass: "E3 F3 D3 G3 C3", melody: m1, cadence: "authentic" }, opts).ok && m1 === I.engineMelody(T2, a.id, "E3 F3 D3 G3 C3", { cadence: "authentic", r: rng(7) }));
  notes.push(`the engine after phrase 2, over E3 F3 D3 G3 C3: ${m1}`);

  // Claude's answer read
  is("the continuations read from a ```json block", I.proposalsOf(answer("Three.", GOOD)).proposals.length === 2);
  is("… or from {continuations: […]}, or a bare array", I.proposalsOf("```json\n{\"continuations\": " + JSON.stringify(GOOD) + "}\n```").proposals.length === 2 && I.proposalsOf("here: " + JSON.stringify([OTHER])).proposals.length === 1);
  is("… none: why", /no JSON block/.test(I.proposalsOf("I would rather not.").error));

  // the prompt
  const p = I.promptFor({ tree: T2, at: a.id, k: 3, request: "an answer in the dominant", offered: [GOOD[1]] });
  is("the prompt: the rules, the vocabulary, the piece so far, the request, what was already offered", /parallel or direct 5ths/.test(p) && /Monte/.test(p) && /Galant/.test(p) && /phrase 2/.test(p) && p.includes(GOOD[0].melody) && /answer in the dominant/.test(p) && /Already offered/.test(p) && /D4 to B5/.test(p));

  // asking a scripted Claude: one fails and is repaired
  const asked = [];
  const answers = [answer("Three ways on.", [GOOD[0], BAD, GOOD[1]]), answer("Repaired.", [REPAIRED])];
  const sample = async (input) => { asked.push(input); return { text: answers[Math.min(asked.length - 1, answers.length - 1)] }; };
  const r = await I.continueWith(sample, T0, "p0", { k: 3 });
  is("Claude asked for 3: two pass, one goes back with its errors and is repaired", r.added.length === 3 && r.failed.length === 0 && r.tries === 2 && asked.length === 2);
  is("… the second prompt asks to repair it, with its error and the ones already offered", /failed the rules/.test(asked[1]) && /held 2 units at most/.test(asked[1]) && /Already offered/.test(asked[1]) && /Write 1 continuation/.test(asked[1]));
  is("… the repaired one marked by its try", r.added.some((x) => x.by === "Claude (try 2)"));
  const asked2 = [];
  const r2 = await I.continueWith(async (input) => { asked2.push(input); return { text: answer("Still.", [BAD]) }; }, T0, "p0", { k: 1 });
  is("one that keeps failing: three tries, then left out with its errors", r2.added.length === 0 && r2.failed.length === 1 && asked2.length === 3);
  const r3 = await I.continueWith(async () => ({ text: "no block" }), T0, "p0", { k: 2, tries: 2 });
  is("an answer with no block: tried again, nothing added", r3.added.length === 0 && r3.tries === 2);
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
