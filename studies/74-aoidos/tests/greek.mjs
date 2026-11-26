// SPDX-License-Identifier: MPL-2.0
// Study 74 · aoidos: the Greek pitch system (greek.mjs) — its genera in Aristoxenus's and Archytas's shades, the
// concords, the moves, and the signs of Mesomedes and Seikilos as notes of their tonoi. In the browser
// (tests/greek.html) and in Node:
//   node -e 'import("./studies/74-aoidos/tests/greek.mjs").then(async m => process.exit(m.report(await m.run())))'
import { greekSystem, TONOI } from "../kairotic/greek.mjs";
import { LYDIAN } from "../kairotic/corpus.mjs";
import { MIDI as SEIKILOS } from "../kairotic/seikilos.mjs";

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const near = (a, b, e = 0.01) => Math.abs(a - b) < e;
  const rels = (S, from, to) => S.notes.filter((c) => S.deg(c) >= from && S.deg(c) <= to).map((c) => Math.round(S.noteOf(c).cents * 100) / 100);

  // the genera of the meson tetrachord, e to a in the Lydian
  const ax = (g) => greekSystem({ tonos: "lydian", genera: [g], synemmenon: false });
  is("Aristoxenus's tetrachords, hypate meson to mese: diatonic 100 + 200 + 200, chromatic 100 + 100 + 300, enharmonic 50 + 50 + 400",
     rels(ax("diatonic"), -3, 0).join() === "-500,-400,-200,0" && rels(ax("chromatic"), -3, 0).join() === "-500,-400,-300,0" && rels(ax("enharmonic"), -3, 0).join() === "-500,-450,-400,0");
  const ar = (g) => greekSystem({ tonos: "lydian", genera: [g], synemmenon: false, shade: "archytas" });
  const A = ar("enharmonic"), lich = A.notes.find((c) => A.noteOf(c).name === "lichanos meson");
  const pm = A.notes.find((c) => A.noteOf(c).name === "paramese"), nd = A.notes.find((c) => A.noteOf(c).name === "nete diezeugmenon");
  is("Archytas's: the enharmonic lichanos a major third 5:4 below the mese (386.31 cents), the fixed notes Pythagorean (paramese 203.91, nete diezeugmenon 701.96)",
     near(A.noteOf(lich).cents, -386.31) && near(A.noteOf(pm).cents, 203.91) && near(A.noteOf(nd).cents, 701.96)
     && near(A.noteOf(A.notes[0]).cents, -1200) && A.noteOf(A.notes[0]).name === "proslambanomenos");
  is("... his chromatic and diatonic lichanos: 32:27 and 9:8 below the mese",
     near(ar("chromatic").noteOf(ar("chromatic").at(-1)).cents, -294.13) && near(ar("diatonic").noteOf(ar("diatonic").at(-1)).cents, -203.91));
  is("the system spans two octaves, proslambanomenos (−7) to nete hyperbolaion (7); a pitch shared by two genera is one note (Aristoxenus's chromatic and diatonic parhypate)",
     ax("diatonic").notes.length === 15 && greekSystem({ tonos: "lydian", genera: ["diatonic", "chromatic"], synemmenon: false }).notes.length === 19
     && greekSystem({ tonos: "lydian", genera: ["diatonic", "chromatic", "enharmonic"], synemmenon: false }).notes.length === 27);

  // what sounds together, and what moves
  const L = greekSystem({ tonos: "lydian", genera: ["diatonic", "chromatic"] });
  const by = (name, g) => L.notes.find((c) => L.noteOf(c).name === name && (g === undefined || L.noteOf(c).genus === g));
  const mese = by("mese"), hm = by("hypate meson"), ndz = by("nete diezeugmenon"), pros = by("proslambanomenos"), para = by("paramese");
  const lmd = by("lichanos meson", "diatonic"), lmc = by("lichanos meson", "chromatic"), pmd = by("parhypate meson", "diatonic");
  is("the concords are the unison, the 4th, the 5th and the octave: mese–hypate meson a 4th, mese–nete diezeugmenon a 5th, proslambanomenos–mese an octave",
     L.concord(mese, hm) === "4th" && L.concord(mese, ndz) === "5th" && L.concord(pros, mese) === "octave" && L.concord(mese, mese) === "unison" && L.quality(hm, ndz) === "perfect");
  is("... every other interval a discord: the tone mese–paramese, the third e–g, the sixth e–c♯'",
     L.quality(mese, para) === "dissonant" && L.quality(hm, lmd) === "dissonant" && L.quality(hm, by("paranete diezeugmenon", "chromatic")) === "dissonant");
  is("the chromatic lichanos is a step below the mese, a minor third away — a move of the genus, not Fux's augmented second; the parhypate to it, a semitone",
     L.deg(mese) - L.deg(lmc) === 1 && near(L.noteOf(mese).cents - L.noteOf(lmc).cents, 300) && L.melodicError(lmc, mese) === null && L.melodicError(pmd, lmc) === null);
  is("... the lichanos changed in place (chromatic to diatonic, the paeans' d♭'–d') a modulation, allowed; the tritone f–b, a 7th, more than an octave refused",
     L.deg(lmc) === L.deg(lmd) && L.melodicError(lmc, lmd) === null && L.melodicError(pmd, para) === "a tritone"
     && L.melodicError(hm, by("paranete diezeugmenon", "diatonic")) === "a 7th" && L.melodicError(pros, ndz) === "a leap wider than the octave");

  // the tonoi, and the signs of the corpus as their notes
  const t = Object.values(TONOI);
  is("fifteen tonoi a semitone apart, Hypodorian to Hyperlydian; the mese of the Lydian on a, the Iastian's on f♯, the Phrygian's on g",
     t.length === 15 && t.every((x, i) => i === 0 || x - t[i - 1] === 1) && greekSystem({ tonos: "lydian" }).mese === 69
     && greekSystem({ tonos: "iastian" }).mese === 66 && greekSystem({ tonos: "phrygian" }).mese === 67);
  const sign = (S, m) => S.nearest(m, 1).map((c) => S.greekName(c));
  const mes = Object.entries(LYDIAN).map(([g, m]) => [g, sign(L, m)]);
  is("Mesomedes's signs are notes of the Lydian tonos, diatonic and chromatic: P b♭ the trite synemmenon, N c♯' the chromatic paranete diezeugmenon, ⌐ e the hypate meson",
     mes.every(([, x]) => x.length >= 1) && sign(L, LYDIAN.P).includes("trite synemmenon (diatonic)")
     && sign(L, LYDIAN.N).includes("paranete diezeugmenon (chromatic)") && sign(L, LYDIAN["⌐"]).includes("hypate meson"));
  notes.push("Mesomedes: " + mes.map(([g, x]) => `${g} ${x.join(" / ")}`).join("; "));
  const I = greekSystem({ tonos: "iastian", genera: ["diatonic"] });
  const sei = Object.entries(SEIKILOS).map(([g, m]) => [g, sign(I, m)]);
  is("Seikilos's signs are notes of the Iastian tonos, diatonic, with the conjunct tetrachord: Φ g its trite synemmenon, the final e the lichanos meson, K c♯' the nete diezeugmenon",
     sei.every(([, x]) => x.length >= 1) && sign(I, SEIKILOS.Φ).includes("trite synemmenon (diatonic)") && sign(I, SEIKILOS.E).includes("lichanos meson (diatonic)")
     && sign(I, SEIKILOS.K).includes("nete diezeugmenon"));
  notes.push("Seikilos: " + sei.map(([g, x]) => `${g} ${x.join(" / ")}`).join("; "));
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
