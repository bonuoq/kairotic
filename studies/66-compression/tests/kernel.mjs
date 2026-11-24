// SPDX-License-Identifier: MPL-2.0
// Study 66 · compression: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/66-compression/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { compress, lossless, expand, stream, notesOf, chordOf, harmony, describeRule, written } from "../kairotic/compress.mjs";

const load = async (id) => {
  const url = new URL(`../data/${id}.json`, import.meta.url);
  if (typeof window !== "undefined") return (await fetch(url)).json();
  const { readFileSync } = await import("node:fs");
  return JSON.parse(readFileSync(url, "utf8"));
};

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const P = {};
  for (const id of ["bwv846-prelude", "bwv999-prelude", "bwv1007-prelude", "bwv1009-prelude"]) P[id] = compress(await load(id));
  notes.push(Object.entries(P).map(([k, c]) => `${k} ${c.raw} → ${c.bits} bits (${(c.ratio * 100).toFixed(1)} %, ${c.rules.length} rules)`).join(" · "));

  // the description is the piece
  is("every description is written out again, the same notes (lossless)", Object.values(P).every(lossless));
  const n = await load("bwv846-prelude");
  is("a stream and back: the same notes", JSON.stringify(notesOf(stream(n))) === JSON.stringify(n.slice().sort((a, b) => a[0] - b[0] || a[2] - b[2])));

  // the C major prelude: one figure over its chords
  const c = P["bwv846-prelude"];
  const F = c.rules[0];
  is("BWV 846: its first rule is the bar's figure — a broken chord over five notes, 16 notes, both halves alike",
     F.kind === "figure" && F.k === 5 && F.idx.join(" ") === "0 1 2 3 4 2 3 4 0 1 2 3 4 2 3 4");
  is("… used in 32 bars", c.items.filter((x) => x.rule === F).length === 32);
  is("… a third of the notes written out (under 32 %)", c.ratio < 0.32);
  is("… and what is left is its harmony: C, Dm7/C, G7/B, C, Am/C, D7/C, G/B, Cmaj7/B",
     harmony(c).slice(0, 8).join(" ") === "C Dm7/C G7/B C Am/C D7/C G/B Cmaj7/B");
  is("… the dominant pedal of its end named over its bass", harmony(c).slice(23).some((h) => h === "G7(+C)"));

  // the others
  const r999 = P["bwv999-prelude"], c1007 = P["bwv1007-prelude"], c1009 = P["bwv1009-prelude"];
  is("BWV 999: a figure over six notes, repeated in pairs of bars (under 45 %)",
     r999.rules[0].kind === "figure" && r999.rules[0].k === 6 && r999.items.some((x) => x.rule && x.rule.kind === "repeat") && r999.ratio < 0.45);
  is("BWV 1007: the string-crossing figure over four notes, its first bars (under 60 %)",
     c1007.rules[0].kind === "figure" && c1007.rules[0].k === 4 && written(c1007)[0].startsWith("F1(G3 D4 B4 A4)") && c1007.ratio < 0.6);
  is("BWV 1009: scales and arpeggios as motifs (under 60 %)", c1009.rules.some((r) => r.kind === "motif") && c1009.ratio < 0.6);
  is("figuration over harmony compresses more than a line: the keyboard preludes before the cello's",
     c.ratio < r999.ratio && r999.ratio < c1007.ratio && r999.ratio < c1009.ratio);

  // the rules, in words
  is("a figure in words", describeRule(F) === "broken chord over 5 notes: 0 1 2 3 4 2 3 4 0 1 2 3 4 2 3 4");
  is("a motif in words", describeRule({ kind: "motif", steps: [0, 2, 4, 5, 7], rhythm: [] }) === "motif of 5 notes (0 2 4 5 7), rising");

  // chords
  is("chords: a triad, a seventh, an inversion", chordOf([48, 52, 55]).name === "C" && chordOf([43, 47, 50, 53]).name === "G7" && chordOf([52, 55, 60]).name === "C/E");
  is("… a note that is not of it named after it (a neighbour): G(+A)", chordOf([55, 62, 71, 69]).name === "G(+A)");

  // a small piece: a figure found, a repeat, and the way back
  const small = [];
  let t = 0;
  for (const ch of [[60, 64, 67], [60, 65, 69], [59, 62, 67], [60, 64, 67]])
    for (let k = 0; k < 2; k++) for (const p of [ch[0], ch[1], ch[2], ch[1]]) { small.push([t, 1, p]); t++; }
  const s = compress(small, { maxL: 8 });
  is("a small piece: one figure over three notes (both halves of a chord in it), four uses, the chords named",
     s.rules.length === 1 && s.rules[0].k === 3 && s.rules[0].idx.join("") === "01210121" && s.items.length === 4 &&
     written(s).join(" · ") === "F1(C4 E4 G4) C · F1(C4 F4 A4) F/C · F1(B3 D4 G4) G/B · F1(C4 E4 G4) C" && lossless(s));
  is("… and its description is shorter", s.bits < s.raw);
  return { results, notes };
}

export function report({ results, notes }) {
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const s of notes) console.log("  · " + s);
  const bad = results.filter((r) => !r[1]).length;
  console.log(`${results.length - bad} / ${results.length}`);
  return bad ? 1 : 0;
}
