// SPDX-License-Identifier: MPL-2.0
// Study 74 · aoidos: the Greek style learned from Mesomedes (corpus.mjs, style.mjs), and tried on Seikilos, which it has
// not seen. In the browser (tests/style.html) and in Node:
//   node -e 'import("./studies/74-aoidos/tests/style.mjs").then(async m => process.exit(m.report(await m.run())))'
import { MESOMEDES, DELPHIC, readPiece, runsOf } from "../kairotic/corpus.mjs";
import { asEngine, choicesOf, fit, score } from "../kairotic/style.mjs";
import { aoidos, TEXTS, GREEK, PROSODY, prosodyWeights } from "../kairotic/aoidos.mjs";
import { SONG, MIDI } from "../kairotic/seikilos.mjs";
import { SOFT, defaultWeights } from "../kairotic/soft.mjs";

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const P = Object.fromEntries(MESOMEDES.map((p) => [p.id, readPiece(p)]));
  const perLine = (Q) => Q.lines.map((l, li) => Q.syllables.filter((y) => y.line === li).reduce((a, y) => a + y.beats, 0));
  is("the corpus as read: every line of the hymns to the Sun and to Nemesis fifteen chronoi (Nemesis 13 and 14 end on a rest)",
     perLine(P.sun).every((x) => x === 15) && perLine(P.nemesis).filter((x) => x !== 15).join() === "13,14");
  is("... 34 + 42 + 204 + 208 notes, 26 supplied by the editors; the Sun from line 13 and Nemesis marked as N's alone",
     [P.muse, P.calliope, P.sun, P.nemesis].map((Q) => Q.syllables.reduce((a, y) => a + y.notes.length, 0)).join() === "34,42,204,208"
     && Object.values(P).flatMap((Q) => Q.syllables.flatMap((y) => y.notes)).filter((x) => x.supplied).length === 26
     && P.sun.syllables.filter((y) => !y.reliable).length === P.sun.syllables.filter((y) => y.lineNo >= 13).length && P.nemesis.syllables.every((y) => !y.reliable));
  const ones = Object.fromEntries([...SOFT.map((r) => r.id), ...PROSODY.map((r) => r.id)].map((id) => [id, 1]));
  const key = { tonic: "A", mode: "phrygian" };
  let choices = [], refused = [];
  for (const Q of Object.values(P)) {
    const E = asEngine({ piece: Q, key, shift: -24, chromatic: [[2, 1]], ambitus: [-4, 8], maxRepeat: 8, turnAfterSmallLeap: false, weights: ones });
    const c = choicesOf(E);
    choices.push(...c.choices); refused.push(...c.refused.map((x) => ({ ...x, piece: Q.id })));
  }
  is("the corpus against the hard rules: 7 of its 488 notes refused (the enharmonic c♯' a tritone from g or b♭, a major 6th up, a leap within a melisma, Nemesis's lost end)",
     refused.length === 7 && refused.filter((x) => x.rule === "melodic").length === 4);
  notes.push("refused: " + refused.map((x) => `${x.piece} beat ${x.t}: ${x.why}`).join("; "));
  const F = fit(choices);
  is("the fit: 191 choices of the reliable lines; the note written the cheapest 86 times with the engine's weights, 119 with the Greek ones",
     choices.length === 191 && F.before.first === 86 && F.after.first === 119 && F.after.ll > F.before.ll + 90);
  is("... and GREEK keeps those weights (within 0.02): leaps dear (4), a note struck again free, a melisma dear (2.9), the accent's rules as strong as the engine's or stronger, except the fall after it (0.5)",
     Object.entries(GREEK.weights).every(([id, v]) => Math.abs(F.w[id] - v) < 0.02) && GREEK.weights["leap-size"] > 3.5 && GREEK.weights.repeat === 0 && GREEK.weights["after-accent"] < 1);
  notes.push(`log-likelihood a choice: engine ${F.before.perChoice.toFixed(3)}, Greek ${F.after.perChoice.toFixed(3)}`);
  // Athenaios's Delphic paean, 250 years older than Mesomedes, and not in the fit either
  const R = runsOf(DELPHIC[0]), N = R.flatMap((Q) => Q.syllables.flatMap((y) => y.notes));
  is("Athenaios's paean as read: 16 fragments, 246 syllables (27 with a melisma), 273 notes in 353 chronoi, 8 supplied, from e♭ to a♮'",
     R.length === 16 && R.reduce((a, Q) => a + Q.syllables.length, 0) === 246 && R.flatMap((Q) => Q.syllables).filter((y) => y.notes.length > 1).length === 27
     && N.length === 273 && R.reduce((a, Q) => a + Q.length, 0) === 353 && N.filter((x) => x.supplied).length === 8
     && Math.min(...N.map((x) => x.midi)) === 63 && Math.max(...N.map((x) => x.midi)) === 81);
  is("... its long fragments in bars of five chronoi (the paean's cretics): the one from line 3 eleven bars, the one from line 10 eighteen after its first three chronoi",
     R.find((Q) => Q.lines[0].n === 3).length === 55 && R.find((Q) => Q.lines[0].n === 10).length === 93);
  const dkey = { tonic: "C", mode: "phrygian" }, dchrom = [[1, 1], [6, 1], [3, 1], [5, 1]];
  let dch = [], dref = [];
  for (const Q of R) {
    const c = choicesOf(asEngine({ piece: Q, key: dkey, shift: -24, chromatic: dchrom, ambitus: [-5, 5], maxRepeat: 8, turnAfterSmallLeap: false, weights: ones }));
    dch.push(...c.choices); dref.push(...c.refused);
  }
  is("... against the hard rules: 28 of its notes refused, 22 of them the chromatic genus (16 chromatic steps, 6 augmented 2nds) that Fux's melodic intervals do not have",
     dref.length === 28 && dref.filter((x) => x.why === "a chromatic step").length === 16 && dref.filter((x) => x.why === "an augmented 2nd").length === 6);
  const dE = score(dch, { ...defaultWeights(), ...prosodyWeights() }), dG = score(dch, GREEK.weights), dF = fit(dch);
  is("... and the Greek style, learned from Mesomedes alone, fits it: the note written the cheapest 144 → 187 of 317 times, a choice's log-likelihood −1.87 → −1.49, near what a fit on the paean itself reaches (−1.45)",
     dch.length === 317 && dE.first === 144 && dG.first === 187 && Math.abs(dE.perChoice + 1.871) < 0.005 && Math.abs(dG.perChoice + 1.487) < 0.005 && Math.abs(dF.after.perChoice + 1.454) < 0.005);
  notes.push(`Athenaios: log-likelihood a choice: engine ${dE.perChoice.toFixed(3)}, Greek ${dG.perChoice.toFixed(3)}, fitted to it ${dF.after.perChoice.toFixed(3)}`);
  // Seikilos, which the fit has not seen
  const T = TEXTS.seikilos;
  const seik = (style) => {
    const A = aoidos({ text: T.text, metre: T.metre, key: T.key, style });
    const U = []; for (const l of SONG) for (const [, signs] of l) for (const [g, c] of signs) for (let j = 0; j < c; j++) U.push(A.codes.find((x) => A.midi(x) === MIDI[g] - 12));
    const ch = []; for (let t = 0; t < U.length; t++) { const before = U.slice(0, t), cands = A.codes.filter((c) => A.check(before, t, c) === null).map((c) => ({ c, f: A.costParts(before, c) })); ch.push({ cands, obs: cands.findIndex((x) => x.c === U[t]) }); }
    return { judge: A.judge(U), ...score(ch, Object.fromEntries([...SOFT.map((r) => r.id), ...PROSODY.map((r) => r.id)].map((id) => [id, 1]))) };
  };
  const e = seik(undefined), g = seik("greek");
  is("Seikilos, not in the fit: a melody of both styles; its note the cheapest at 22 of 48 beats with the engine's weights, 25 with the Greek ones, and more likely",
     e.judge === null && g.judge === null && e.first === 22 && g.first === 25 && g.perChoice > e.perChoice + 0.15);
  notes.push(`Seikilos: log-likelihood a beat ${e.perChoice.toFixed(3)} → ${g.perChoice.toFixed(3)}`);
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
