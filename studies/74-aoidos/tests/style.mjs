// SPDX-License-Identifier: MPL-2.0
// Study 74 · aoidos: the Greek style learned from Mesomedes and Athenaios read in the Greek system (corpus.mjs,
// greek.mjs, style.mjs), and tried on Seikilos, which it has not seen. In the browser (tests/style.html) and in Node:
//   node -e 'import("./studies/74-aoidos/tests/style.mjs").then(async m => process.exit(m.report(await m.run())))'
import { MESOMEDES, DELPHIC, readPiece, runsOf } from "../kairotic/corpus.mjs";
import { asEngine, choicesOf, fit, score, codesInSystem } from "../kairotic/style.mjs";
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
  const w0 = { ...defaultWeights(), ...prosodyWeights() };
  // the corpus read in the Greek system: each piece in its tonos (diatonic and chromatic, the conjunct tetrachord too),
  // its final the mese; the choices each beat, and the notes the hard rules refuse
  const read = (pieces, system, ambitus) => {
    const choices = [], refused = [];
    for (const Q of pieces) for (const r of runsOf(Q)) {
      const E = asEngine({ piece: r, system, final: 0, ambitus, maxRepeat: 8, turnAfterSmallLeap: false, weights: ones });
      const c = choicesOf(E);
      choices.push(...c.choices); refused.push(...c.refused.map((x) => ({ ...x, piece: Q.id, name: x.code === null ? "?" : E.A.name(x.code) })));
    }
    return { choices, refused };
  };
  const M = read(MESOMEDES, { tonos: "lydian", genera: ["diatonic", "chromatic"] }, [-4, 7]);
  is("Mesomedes in the Lydian tonos: 5 of his 488 notes refused (the enharmonic c♯' a tritone away, a leap within a melisma, a 6th not turned, Nemesis's lost end)",
     M.refused.length === 5 && M.refused.filter((x) => x.why === "a tritone").length === 2);
  notes.push("Mesomedes refused: " + M.refused.map((x) => `${x.piece} beat ${x.t} (${x.name}): ${x.why}`).join("; "));
  // Athenaios's Delphic paean, 250 years older than Mesomedes
  const R = runsOf(DELPHIC[0]), N = R.flatMap((Q) => Q.syllables.flatMap((y) => y.notes));
  is("Athenaios's paean as read: 16 fragments, 246 syllables (27 with a melisma), 273 notes in 353 chronoi, 8 supplied, from e♭ to a♮'",
     R.length === 16 && R.reduce((a, Q) => a + Q.syllables.length, 0) === 246 && R.flatMap((Q) => Q.syllables).filter((y) => y.notes.length > 1).length === 27
     && N.length === 273 && R.reduce((a, Q) => a + Q.length, 0) === 353 && N.filter((x) => x.supplied).length === 8
     && Math.min(...N.map((x) => x.midi)) === 63 && Math.max(...N.map((x) => x.midi)) === 81);
  is("... its long fragments in bars of five chronoi (the paean's cretics): the one from line 3 eleven bars, the one from line 10 eighteen after its first three chronoi",
     R.find((Q) => Q.lines[0].n === 3).length === 55 && R.find((Q) => Q.lines[0].n === 10).length === 93);
  // in a church mode (12-TET, C phrygian with its altered notes) Fux's intervals refuse the chromatic genus
  let church = [];
  for (const Q of R) church.push(...choicesOf(asEngine({ piece: Q, key: { tonic: "C", mode: "phrygian" }, shift: -24, chromatic: [[1, 1], [6, 1], [3, 1], [5, 1]], ambitus: [-5, 5], maxRepeat: 8, turnAfterSmallLeap: false, weights: ones })).refused);
  const D = read(DELPHIC, { tonos: "hyperdorian", genera: ["diatonic", "chromatic"] }, [-5, 7]);
  is("... in a church mode the hard rules refuse 28 of its notes, 22 the chromatic genus (16 chromatic steps, 6 augmented 2nds); in the Hyperdorian tonos, diatonic and chromatic, 6 — no chromatic step among them (the genus's own moves), the a♮' of Γαλατᾶν outside it",
     church.length === 28 && church.filter((x) => x.why === "a chromatic step" || x.why === "an augmented 2nd").length === 22
     && D.refused.length === 6 && !D.refused.some((x) => /chromatic|augmented 2nd/.test(x.why)) && D.refused.filter((x) => x.code === null).length === 1);
  notes.push("Athenaios refused: " + D.refused.map((x) => `${x.piece} beat ${x.t} (${x.name}): ${x.why}`).join("; "));
  // the Greek style: fitted to both
  const F = fit([...M.choices, ...D.choices]);
  is("the fit: 530 choices (Mesomedes 192, Athenaios 338); the note written the cheapest 221 times with the engine's weights, 345 with the Greek ones",
     M.choices.length === 192 && D.choices.length === 338 && F.before.first === 221 && F.after.first === 345 && F.after.ll > F.before.ll + 200);
  is("... and GREEK keeps those weights (within 0.02): leaps dear (3.6), a note struck again free, a melisma dear (3.1), the accent's rules as strong as the engine's or stronger, except the fall after it (0.7)",
     Object.entries(GREEK.weights).every(([id, v]) => Math.abs(F.w[id] - v) < 0.02) && GREEK.weights["leap-size"] > 3.5 && GREEK.weights.repeat === 0 && GREEK.weights["after-accent"] < 1);
  const FM = fit(M.choices);
  is("... learned from Mesomedes alone, the style already fits Athenaios: his note the cheapest 141 → 199 of 338 times (216 fitted to both)",
     score(D.choices, w0).first === 141 && score(D.choices, FM.w).first === 199 && score(D.choices, F.w).first === 216);
  notes.push(`log-likelihood a choice: engine ${F.before.perChoice.toFixed(3)}, Greek ${F.after.perChoice.toFixed(3)}`);
  // Seikilos, which the fit has not seen: in the Iastian tonos, his final e the lichanos meson
  const T = TEXTS.seikilos;
  const A = aoidos({ text: T.text, metre: T.metre, system: T.system, final: T.final });
  const mid = []; for (const l of SONG) for (const [, signs] of l) for (const [g, c] of signs) for (let j = 0; j < c; j++) mid.push(MIDI[g]);
  const U = codesInSystem(A, mid);
  const ch = []; for (let t = 0; t < U.length; t++) { const before = U.slice(0, t), cands = A.codes.filter((c) => A.check(before, t, c) === null).map((c) => ({ c, f: A.costParts(before, c) })); ch.push({ cands, obs: cands.findIndex((x) => x.c === U[t]) }); }
  const e = score(ch, w0), g = score(ch, GREEK.weights);
  is("Seikilos, not in the fit: his stele's melody keeps every hard rule in the Iastian tonos; his note the cheapest at 22 of 48 beats with the engine's weights, 29 with the Greek ones, and more likely",
     A.judge(U) === null && U.every((c) => c !== undefined) && e.first === 22 && g.first === 29 && g.perChoice > e.perChoice + 0.15);
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
