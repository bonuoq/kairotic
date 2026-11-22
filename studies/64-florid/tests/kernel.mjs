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
  is("the frame: a note a half bar over the cantus firmus (19 for ten bars), every one legal under the rules of every phrase with the strict line", fr && fr.names.length === n && fr.units.every((u, t) => fr.voice.V.check(fr.units.slice(0, t), t, u) === null));
  // the species' leaps, over many frames: up to a 5th or the octave, no tritone, no 6th but the minor one going up
  let leapsOk = true;
  for (const [, cc] of Object.entries(F.CANTI)) for (let s = 1; s <= 8; s++) {
    const f = F.frameOf(cc.cf, cc.key, { r: rng(s) });
    if (!f) { leapsOk = false; continue; }
    const ns = f.names.filter((x, i) => i === 0 || x !== f.names[i - 1]);
    for (let i = 1; i < ns.length; i++) { const d = midiOf(ns[i]) - midiOf(ns[i - 1]), m = Math.abs(d); if (m === 6 || m === 9 || m === 10 || m === 11 || m > 12 || (m === 8 && d < 0)) leapsOk = false; }
  }
  is("… strict species leaps in every frame (24 drawn): no tritone, no 7th, no 6th but the minor one going up, nothing beyond the octave", leapsOk);
  is("… the strict line refuses what the incipits' moderate one allows: F4 to D5 (a 6th) after E4 G4", F.frameVoice(c.cf, c.key).V.check(["E4", "G4", "F4"].map((x) => fr.voice.code(x)), 3, fr.voice.code("D5")) !== null);

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
  is("… eight eighths a bar, the last half bar its final note", count);
  is("… every half bar begins on the frame's note (the figures ornament it)", frameKept);
  is("… every figure from the catalogue, and a dissonance only where its figure allows it", shapes && diss);
  is("… the catalogue at work: at least eight different figures used", used.size >= 8);
  notes.push("figures used: " + [...used.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ${v}`).join(", "));
  const melodic = runs.every(({ x }) => x.eighths.every((nm, i) => i === 0 || ![6, 10, 11].includes(Math.abs(midiOf(nm) - midiOf(x.eighths[i - 1]))) && Math.abs(midiOf(nm) - midiOf(x.eighths[i - 1])) <= 12));
  is("… no tritone, 7th or leap beyond the octave between two notes of the surface", melodic);

  // the rhythm: a cell a half bar, eighths in pairs on the weak quarter, parallelism, the arc
  {
    let cellsOk = true, pairs = true, third = false, again = 0, bars = 0, mid = 0, nm = 0, ends = 0, ne = 0;
    for (const { x } of runs) {
      const m = x.frame.length;
      x.spans.forEach((sp) => {
        const d = F.CELLS[x.rhythm[sp.unit]];
        if (!d || d.length !== sp.notes.length) { cellsOk = false; return; }
        let p = sp.unit * F.SUB;
        d.forEach((len, j) => { for (let k = 0; k < len; k++) if (x.eighths[p + k] !== sp.notes[j]) cellsOk = false; if (len === 1 && p % F.SUB < 2) pairs = false; p += len; });
      });
      const R = [];
      for (let i = 0; i + 1 < m - 1; i += 2) R.push(x.rhythm[i] + "+" + x.rhythm[i + 1]);
      R.forEach((r, i) => {
        bars++;
        if (i && R[i - 1] === r) again++;
        if (i > 1 && R[i - 1] === r && R[i - 2] === r) third = true;
        const a = r.split("+").reduce((s2, c2) => s2 + F.CELLS[c2].length, 0);
        if (i === 0 || i === R.length - 1) { ends += a; ne++; } else if (Math.abs(i - (R.length - 1) / 2) < 1.5) { mid += a; nm++; }
      });
    }
    is("the rhythm: every half bar a cell (a half note, two quarters, a dotted quarter and an eighth, a quarter and two eighths), its figure's notes on it", cellsOk);
    is("… eighths only on the half bar's weak quarter, in pairs (Fux)", pairs);
    is("… parallelism: a bar's rhythm heard again in the next one now and then (≥ 8% of the bars), never a third time running", !third && again / bars >= 0.08);
    is("… the arc: the phrase's middle bars busier than its first and last", mid / nm > ends / ne);
    notes.push(`the rhythm: a bar like the one before in ${Math.round(100 * again / bars)}% of ${bars} bars; notes a bar ${(mid / nm).toFixed(1)} in the middle, ${(ends / ne).toFixed(1)} at the ends`);
  }

  // suspensions: held, prepared with a neighbour, or resolved later (ornamented)
  {
    const g = F.CANTI["g-major"], fs = F.frameOf(g.cf, g.key, { r: rng(21), temp: 0.6 }), U = fs.units;
    const t = U.findIndex((u, i) => i >= 2 && i % 2 === 0 && U[i - 1] === u && fs.voice.V.vertical(i, u).q === "dissonant");
    const E = t > 0 && F.elaborate(fs, g.cf, g.key, { r: rng(21) });
    const before = E && E.spans[t - 1].figure, after = E && E.spans[t].figure;
    is("a frame with a suspension (G major): the half bar before prepares it, held over the bar; the one after resolves it, held or later", E && ["held", "tie-neighbor"].includes(before) && ["held", "anticipated-resolution", "ornamented-resolution"].includes(after) && E.eighths[t * F.SUB - 1] === fs.names[t]);
    notes.push(`the suspension at half bar ${t + 1} of ${fs.names.join(" ")}: ${before}, then ${after}`);
  }

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
