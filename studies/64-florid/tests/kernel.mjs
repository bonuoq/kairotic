// SPDX-License-Identifier: MPL-2.0
// Study 64 · florid: the kernel's tests (florid.mjs). In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/64-florid/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as F from "../kairotic/florid.mjs";
import { consonant, midiOf } from "../kairotic/protovoices.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const split = (s) => s.trim().split(/\s+/);

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  const c = F.CANTI["c-major"], bars = split(c.cf).length, n = (bars - 1) * 2 + 1;
  const fr = F.frameOf(c.cf, c.key, { r: rng(3) });
  is("the frame: a note a half bar over the cantus firmus (19 for ten bars), every one legal under the rules of every phrase", fr && fr.names.length === n && fr.units.every((u, t) => fr.voice.V.check(fr.units.slice(0, t), t, u) === null));

  // many florid lines, every figure checked
  const runs = [];
  for (const [id, cc] of Object.entries(F.CANTI)) for (let s = 1; s <= 6; s++) { const x = F.florid(cc.cf, cc.key, { r: rng(s) }); if (x) runs.push({ id, cc, x }); }
  is("florid lines drawn over the three canti firmi, six seeds each: every one made", runs.length === 18);
  let shapes = true, frameKept = true, diss = true, count = true;
  const used = new Map();
  for (const { cc, x } of runs) {
    const bs = split(cc.cf), m = x.frame.length;
    if (x.eighths.length !== m * F.SUB) count = false;
    for (const sp of x.spans) {
      used.set(sp.figure, (used.get(sp.figure) || 0) + 1);
      const f = F.FIGURES.find((g) => g.id === sp.figure);
      if (sp.unit < m - 1 && !f) shapes = false;
      if (x.eighths[sp.unit * F.SUB] !== x.frame[sp.unit]) frameKept = false;
      // a dissonance against the bass only where the figure frees it, or the frame's own note
      if (f) sp.notes.forEach((nm, j) => { if (nm !== x.frame[sp.unit] && !f.free.includes(j) && !consonant(bs[Math.floor(sp.unit / 2)], nm)) diss = false; });
    }
  }
  is("… four eighths a half bar, the last half bar its final note", count);
  is("… every half bar begins on the frame's note (the figures ornament it)", frameKept);
  is("… every figure from the catalogue, and a dissonance only where its figure allows it", shapes && diss);
  is("… the catalogue at work: at least eight different figures used", used.size >= 8);
  notes.push("figures used: " + [...used.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
  const melodic = runs.every(({ x }) => x.eighths.every((nm, i) => i === 0 || ![6, 10, 11].includes(Math.abs(midiOf(nm) - midiOf(x.eighths[i - 1]))) && Math.abs(midiOf(nm) - midiOf(x.eighths[i - 1])) <= 12));
  is("… no tritone, 7th or leap beyond the octave between two notes of the surface", melodic);

  // suspensions: held, prepared with a neighbour, or resolved later (ornamented)
  const susFigs = ["tie-neighbor", "anticipated-resolution", "ornamented-resolution"];
  is("suspensions of the frame elaborated too: prepared with a neighbour, or resolved early or through a third below", susFigs.some((f) => used.has(f)));

  // the other way: reduced, the frame's downbeats come back
  let tot = 0, perfect = 0;
  for (const { cc, x } of runs) {
    const R = F.reduceFlorid(cc.cf, cc.key, x.eighths, x.frame);
    const down = (L) => L.filter((_, i) => i % 2 === 0);
    const lvl = R.levels.findIndex((L, k) => R.an.levels[k].length <= x.frame.length);
    const a = F.agreement(down(R.levels[lvl < 0 ? R.levels.length - 1 : lvl]), down(x.frame));
    tot += a; if (a === 1) perfect++;
  }
  const mean = tot / runs.length;
  is("reduced by Study 61's grammar on the eighths' grid: at the level as long as the frame, its downbeats come back (mean ≥ 90%)", mean >= 0.9);
  notes.push(`the frame's downbeats recovered: ${Math.round(100 * mean)}% on average, all of them in ${perfect} of ${runs.length} lines`);
  const x0 = runs[0].x;
  notes.push(`over ${runs[0].cc.cf}: frame ${x0.frame.join(" ")} · surface ${x0.eighths.join(" ")}`);
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
