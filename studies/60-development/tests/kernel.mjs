// SPDX-License-Identifier: MPL-2.0
// Study 60 · development: the kernel's tests (motif.mjs, development.mjs). In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/60-development/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as M from "../kairotic/motif.mjs";
import * as D from "../kairotic/development.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

// continuations of the C major incipit (its motive G4 C5 B4 A4, its head), as a scripted Claude writes them
export const HEAD = { plan: "the antecedent's head again, falling fifths to a perfect cadence", cadence: "perfect", bass: "E3 A2 D3 G2 C3", melody: "G4 C5 C5 B4 A4 F4 G4 B4 C5", derivation: "motive a's head, at the same pitch, then a cadence", about: "the consequent begins as the antecedent did" };
export const INVERTED = { plan: "the motive inverted over the scale up", cadence: "perfect", bass: "C3 D3 E3 F3 G3 C3", melody: "A4 E4 E4 F4 G4 G4 D4 A4 G4 B4 C5", derivation: "motive a, inverted, a step higher", about: "the motive upside down" };
export const WRONG = { ...INVERTED, derivation: "motive a in sequence a 3rd higher" };
export const HALF = { plan: "an open close on the dominant", cadence: "half", bass: "C3 B2 A2 G2", melody: "E4 F4 G4 B4 B4 A4 B4", derivation: "free", about: "a half cadence" };
export const answer = (text, list) => `${text}\n\`\`\`json\n${JSON.stringify(list)}\n\`\`\``;

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // ─── motif.mjs ───
  const m = M.notesOf("C5 D5 E5 C5"), N = (s) => M.notesOf(s);
  is("a melody read as notes: a note held is one note, longer", M.notesOf("G4 C5 C5 B4").map((x) => x.dur).join() === "1,2,1" && M.notesOf("G4 C5 C5 B4")[2].on === 3);
  is("its viewpoints: steps, semitones, contour, rhythm", JSON.stringify(M.views(N("C5 E5 E5 D5"))) === JSON.stringify({ dia: [2, -1], chro: [4, -2], contour: [1, -1], rhythm: [1, 2, 1] }));
  is("a sequence (diatonic): the steps kept, not the semitones", M.relate(m, N("D5 E5 F5 D5")).name === "in sequence, a step higher");
  is("a transposition (real): the semitones kept too", M.relate(m, N("G4 A4 B4 G4")).name === "transposed, a 4th lower");
  is("an inversion, a retrograde, a retrograde inversion", M.relate(m, N("C5 B4 A4 C5")).kind === "inversion" && M.relate(m, N("C5 E5 D5 C5")).kind === "retrograde" && M.relate(m, N("C5 A4 B4 C5")).kind === "retrograde inversion");
  is("an augmentation: the rhythm doubled", M.relate(m, N("D5 D5 E5 E5 F5 F5 D5 D5")).name === "in sequence, a step higher, augmented");
  is("no exact transformation: a kinship by edit distance, and what is kept", (() => { const r = M.relate(m, N("C5 E5 G5 C5")); return !r.exact && r.kinship > 0.6 && r.kinship < 0.9 && r.kept.includes("contour"); })());
  is("kinship: the motive itself 1, a sequence 0.85, an inversion 0.75, far apart low", M.relate(m, m).kinship === 1 && M.relate(m, N("D5 E5 F5 D5")).kinship === 0.85 && M.relate(m, N("C5 B4 A4 C5")).kinship === 0.75 && M.relate(m, N("C5 G4 G5 F4")).kinship < 0.5);
  is("found in a melody: where and how", (() => { const r = M.findIn(m, N("G4 G4 F4 G4 A4 F4 E4")); return r.from === 2 && r.to === 5 && r.kind === "transposition"; })());
  is("… a fragment found: its head, in sequence", (() => { const r = M.findIn(m, N("A4 A4 E5 F5 G5 G5")); return r.part === "head" && /its head, in sequence/.test(r.name); })());
  is("the motive discovered: the span that recurs most", (() => { const x = M.discover("C5 D5 E5 C5 D5 E5 F5 D5 E5 F5 G5 E5 C5"); return x.notes.join(" ") === "C5 D5 E5 C5" && /2 more times/.test(x.why); })());
  is("… none recurring: the head of the phrase", M.discover("G4 C5 C5 B4 A4 A4 B4 D5 C5").notes.join(" ") === "G4 C5 B4 A4" && /head/.test(M.discover("G4 C5 C5 B4 A4 A4 B4 D5 C5").why));
  is("the memory of the work: the share of figures heard before", M.memory(["C5 D5 E5 C5"], "G4 A4 B4 G4 E4") === 0.67 && M.memory([], "C5 D5 E5") === 0);
  is("the sweet spot: a literal repetition half as welcome, far apart little", M.sweet(1) === 0.5 && M.sweet(0.8) === 1 && M.sweet(0.3) < 0.5);
  is("shifts named", M.shiftName(-2) === "a 3rd lower" && M.shiftName(1) === "a step higher" && M.shiftName(7) === "an octave higher" && M.shiftName(0) === "at the same pitch");

  // ─── development.mjs ───
  const x = D.INCIPITS["short-c"];
  const T0 = D.treeOf(x.phrase, { key: x.key, plan: "period" });
  is("a tree with its motive found (the head, G4 C5 B4 A4) and its form", T0.motives[0].notes.join(" ") === "G4 C5 B4 A4" && T0.plan === "period" && T0.nodes.p0.dev.matches[0].name === "the motive itself");
  const Tm = D.treeOf(x.phrase, { key: x.key, motive: { from: 4, to: 8 } });
  is("… or marked by hand (units 5–9: A4 B4 D5 C5)", Tm.motives[0].notes.join(" ") === "A4 B4 D5 C5" && /by hand/.test(Tm.motives[0].why));
  let [T1, h] = D.addPhrase(T0, "p0", HEAD);
  is("a consequent that begins with the motive's head: found, its derivation confirmed, the form's asks met", h.check.ok && h.dev.matches[0].part === "head" && h.dev.confirmed === "confirmed" && h.dev.role.role === "consequent" && h.dev.fits.every((f) => f.ok));
  const [, inv] = D.addPhrase(T0, "p0", INVERTED);
  is("an inversion declared and measured: confirmed", inv.dev.matches[0].kind === "inversion" && inv.dev.confirmed === "confirmed");
  const [, wr] = D.addPhrase(T0, "p0", WRONG);
  is("a derivation declared wrongly: measured otherwise, and said what it is", /measured otherwise: inverted/.test(wr.dev.confirmed));
  const [, hf] = D.addPhrase(T0, "p0", HALF);
  is("a phrase that misses the form (a half cadence where the consequent asks a perfect one): scored worse", hf.dev.fits.some((f) => !f.ok && /perfect cadence/.test(f.what)) && hf.dev.score > h.dev.score);
  is("ranked: the best developed first", (() => { let t = T0; for (const p of [HALF, HEAD, INVERTED]) t = D.addPhrase(t, "p0", p)[0]; return D.ranked(t, "p0")[0].phrase.melody === HEAD.melody && D.ranked(t, "p0").slice(-1)[0].phrase.melody === HALF.melody; })());
  is("a motive marked on a later phrase: every phrase measured again with it", (() => { const t = D.addMotive(T1, h.id, 4, 6); return t.motives.length === 2 && t.motives[1].id === "b" && t.nodes[h.id].dev.matches.some((y) => y.motive === "b" && y.name === "the motive itself"); })());
  is("the form's roles: a sentence's continuation asks a fragment, a ternary's B a contrast", D.roleAt({ plan: "sentence" }, 2).fragment && D.roleAt({ plan: "ternary" }, 1).contrast && D.roleAt({ plan: "free" }, 1) === null);

  // the prompt: the material, the operations, the form, the derivation asked
  const p = D.promptFor({ tree: T0, at: "p0", k: 3 });
  is("the prompt: the motive (its notes, steps, durations), the operations, the form and the next role, derivation in the JSON", /motive a: G4 C5 B4 A4/.test(p) && /steps \+3 -1 -1/.test(p) && /durations in units 1 2 1 2/.test(p) && /fragmentation/.test(p) && /phrase 2 consequent/.test(p) && /"derivation":/.test(p) && /parallel or direct 5ths/.test(p));

  // the engine develops: it begins with the motive transformed
  const e = D.engineDevelop(T0, "p0", "E3 A2 D3 G2 C3", { cadence: "perfect", r: rng(3) });
  is("the engine develops the motive: a phrase that begins with it transformed, passing, related", e && e.derivation && e.dev.kinship >= 0.65 && D.check(x.phrase, { bass: "E3 A2 D3 G2 C3", melody: e.melody, cadence: "perfect" }, { key: x.key, range: T0.range }).ok);
  notes.push(`the engine over E3 A2 D3 G2 C3: ${e && e.melody} (${e && e.derivation}; measured: ${e && e.dev.matches[0].name}, ${e && e.dev.kinship})`);
  is("… its transformations: sequences, inversions, the head, even notes", (() => { const ts = D.transformsOf(T0, T0.motives[0]); return ts.length >= 30 && ts.some((t) => /inverted/.test(t.what)) && ts.some((t) => /head/.test(t.what)) && ts[0].start.join(" ") === "G4 C5 C5 B4 A4 A4"; })());

  // Claude, scripted: the continuations measured as they come
  const asked = [];
  const r = await D.continueWith(async (input) => { asked.push(input); return { text: answer("Two.", [HEAD, INVERTED]) }; }, T0, "p0", { k: 2 });
  is("asked with the material and the form; the continuations measured, the motives kept", asked.length === 1 && /The material of the piece/.test(asked[0]) && r.added.length === 2 && r.added.every((n) => n.dev && n.dev.matches.length) && r.tree.motives.length === 1 && r.tree.plan === "period");
  is("… the derivation kept from Claude's answer", r.added.some((n) => n.phrase.derivation === HEAD.derivation));
  is("… choosing keeps the material", D.choose(r.tree, r.added[0].id).motives.length === 1);
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
