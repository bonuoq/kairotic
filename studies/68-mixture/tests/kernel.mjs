// SPDX-License-Identifier: MPL-2.0
// Study 68 · mixture: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/68-mixture/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as M from "../kairotic/mixture.mjs";

const load = async (id) => {
  const url = new URL(`../data/${id}.json`, import.meta.url);
  if (typeof window !== "undefined") return (await fetch(url)).json();
  const { readFileSync } = await import("node:fs");
  return JSON.parse(readFileSync(url, "utf8"));
};
export const PIECES = [["bwv846-prelude", 16], ["bwv999-prelude", 12], ["bwv1007-prelude", 16], ["bwv1009-prelude", 12]];

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const D = {};
  for (const [id, bar] of PIECES) {
    const n = await load(id);
    D[id] = { n, bar, f: M.describe(n, { bar, way: "figure" }), g: M.describe(n, { bar, way: "genetic" }), m: M.describe(n, { bar, way: "mixture" }) };
  }
  notes.push(PIECES.map(([id]) => `${id.replace("-prelude", "")}: figure ${D[id].f.bits.toFixed(0)}, genetic ${D[id].g.bits.toFixed(0)}, mixture ${D[id].m.bits.toFixed(0)} bits (${(D[id].m.share * 100).toFixed(0)} % of bars genetic)`).join(" · "));

  // ─── a bar, read both ways ───
  const b0 = M.barsOf(D["bwv846-prelude"].n, 16)[0];
  const g0 = M.readBar(b0.notes), f0 = M.figureOf(b0.notes);
  is("BWV 846's first bar: its chord C major, its sonority C4 E4 G4 C5 E5, every note a chord tone", g0.chord.set.slice().sort((a, b) => a - b).join() === "0,4,7" && g0.sonority.join() === "60,64,67,72,76" && g0.tones.every((j) => j !== null));
  is("… as a figure: the pattern of Study 66 (0 1 2 3 4 2 3 4, twice) over its five pitches", f0.pattern === "pat|0,1,2,3,4,2,3,4,0,1,2,3,4,2,3,4" && f0.pitches.join() === "60,64,67,72,76");
  is("… as genetic words: the first tone by its place, the others by their move in the sonority (a broken chord rising: +1)", M.noteWords(b0.notes, g0).slice(0, 5).join(" ") === "c0|0 ct|1 ct|1 ct|1 ct|1");
  const orn = M.barsOf(D["bwv1007-prelude"].n, 16).map((b) => M.readBar(b.notes)).find((g) => g.tones.some((j) => j === null));
  is("a cello bar with notes out of its chord: each an ornament, a step of two semitones at most from the note before", orn && orn.tones.some((j) => j === null));
  is("every bar of the four preludes said back both ways: the same pitches (lossless)", PIECES.every(([id, bar]) => M.lossless(D[id].n, bar)));

  // ─── the mixture ───
  is("the mixture says each piece in no more bits than its better way alone, give or take the word saying which (1 %)", PIECES.every(([id]) => D[id].m.bits <= Math.min(D[id].f.bits, D[id].g.bits) * 1.01));
  is("… and in fewer than either where the piece mixes them: the cello suites", ["bwv1007-prelude", "bwv1009-prelude"].every((id) => D[id].m.bits < Math.min(D[id].f.bits, D[id].g.bits)));
  is("its signature: the keyboard preludes almost all figure (under 15 % of bars genetic), the cello's a line that unfolds a harmony (over 20 %)",
     ["bwv846-prelude", "bwv999-prelude"].every((id) => D[id].m.share < 0.15) && ["bwv1007-prelude", "bwv1009-prelude"].every((id) => D[id].m.share > 0.2));
  is("BWV 1009, the most melodic: the mixture under the figure alone by more than 5 %", D["bwv1009-prelude"].m.bits < 0.95 * D["bwv1009-prelude"].f.bits);
  notes.push("BWV 1007, bar by bar: " + D["bwv1007-prelude"].m.bars.map((b) => b.way[0]).join(""));
  return { results, notes };
}

export function report({ results, notes }) {
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const s of notes) console.log("  · " + s);
  const bad = results.filter((r) => !r[1]).length;
  console.log(`${results.length - bad} / ${results.length}`);
  return bad ? 1 : 0;
}
