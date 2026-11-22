// SPDX-License-Identifier: MPL-2.0
// Study 64 · florid: the kernel's tests (florid.mjs). In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/64-florid/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as F from "../kairotic/florid.mjs";
import * as M from "../kairotic/measure.mjs";
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
  for (const [, cc] of Object.entries(F.CANTI).filter(([, cc]) => !cc.fux)) for (let s = 1; s <= 8; s++) {
    const f = F.frameOf(cc.cf, cc.key, { r: rng(s) });
    if (!f) { leapsOk = false; continue; }
    const ns = f.names.filter((x, i) => i === 0 || x !== f.names[i - 1]);
    for (let i = 1; i < ns.length; i++) { const d = midiOf(ns[i]) - midiOf(ns[i - 1]), m = Math.abs(d); if (m === 6 || m === 9 || m === 10 || m === 11 || m > 12 || (m === 8 && d < 0)) leapsOk = false; }
  }
  is("… strict species leaps in every frame (24 drawn): no tritone, no 7th, no 6th but the minor one going up, nothing beyond the octave", leapsOk);
  is("… the strict line refuses what the incipits' moderate one allows: F4 to D5 (a 6th) after E4 G4", F.frameVoice(c.cf, c.key).V.check(["E4", "G4", "F4"].map((x) => fr.voice.code(x)), 3, fr.voice.code("D5")) !== null);

  // many florid lines, every figure checked
  const runs = [];
  for (const [id, cc] of Object.entries(F.CANTI).filter(([, cc]) => !cc.fux)) for (let s = 1; s <= 6; s++) { const x = F.florid(cc.cf, cc.key, { r: rng(s) }); if (x) runs.push({ id, cc, x }); }
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
    // the ties: a note held into the next half bar never tied to a longer one, nor an eighth tied
    let ties = 0, tiesOk = true;
    for (const { x } of runs) x.spans.forEach((sp, t) => {
      const nx = x.spans[t + 1];
      if (!nx || sp.notes[sp.notes.length - 1] !== nx.notes[0]) return;
      ties++;
      const d1 = F.CELLS[x.rhythm[t]].at(-1), d2 = F.CELLS[x.rhythm[t + 1]][0];
      if (d1 < d2 || d1 < 2) tiesOk = false;
    });
    is("the ties: a note never tied to a longer one (a quarter to a half), nor an eighth tied (Fux, fifth species)", tiesOk && ties > 0);
    notes.push(`the ties: ${ties} in ${runs.length} lines, every one to an equal or shorter value`);
    is("the rhythm: every half bar a cell (a half note, two quarters, a dotted quarter and an eighth, a quarter and two eighths), its figure's notes on it", cellsOk);
    is("… eighths only on the half bar's weak quarter, in pairs (Fux)", pairs);
    is("… parallelism: a bar's rhythm heard again in the next one now and then (≥ 8% of the bars), never a third time running", !third && again / bars >= 0.08);
    is("… the arc: the phrase's middle bars busier than its first and last", mid / nm > ends / ne);
    notes.push(`the rhythm: a bar like the one before in ${Math.round(100 * again / bars)}% of ${bars} bars; notes a bar ${(mid / nm).toFixed(1)} in the middle, ${(ends / ne).toFixed(1)} at the ends`);
  }

  // suspensions: prepared by a half note held over the bar, resolved then or later (ornamented)
  {
    const g = F.CANTI["g-major"], fs = F.frameOf(g.cf, g.key, { r: rng(21), temp: 0.6 }), U = fs.units;
    const t = U.findIndex((u, i) => i >= 2 && i % 2 === 0 && U[i - 1] === u && fs.voice.V.vertical(i, u).q === "dissonant");
    const E = t > 0 && F.elaborate(fs, g.cf, g.key, { r: rng(21) });
    const before = E && E.spans[t - 1].figure, after = E && E.spans[t].figure;
    is("a frame with a suspension (G major): the half bar before prepares it, a half note held over the bar; the one after resolves it, held or later", E && before === "held" && ["held", "anticipated-resolution", "ornamented-resolution"].includes(after) && E.eighths[t * F.SUB - 1] === fs.names[t]);
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
  // measured: the lines read back into the catalogue, counted, and the counts turned into costs, fitted
  {
    const lines = runs.map(({ cc, x }) => ({ cf: cc.cf, key: cc.key, eighths: x.eighths, frame: x.frame }));
    let exact = 0, near = 0, tot = 0;
    runs.forEach(({ x }, i) => {
      const R = M.readLine(lines[i]), Rd = M.readLine({ ...lines[i], frame: null }), Rr = M.readLine({ ...lines[i], frame: null }, { frame: "reduce" });
      x.spans.slice(0, -1).forEach((sp, t) => {
        tot++;
        if (R.spans[t].figure === sp.figure && R.spans[t].cell === x.rhythm[t] && Rd.spans[t].figure === sp.figure) exact++;
        if (Rr && Rr.spans[t].figure === sp.figure) near++;
      });
    });
    is("measured: every half bar read back as drawn, its cell and its figure, given the frame or read on the downbeats", exact === tot);
    is("… with the frame found by Study 61's reduction instead, most of the figures (≥ 85%)", near / tot >= 0.85);
    notes.push(`read back with the reduced frame: ${Math.round(100 * near / tot)}% of ${tot} figures`);
    const st = M.measure(lines), C = M.costsOf(st);
    is("… counted: every tie to an equal or shorter value; the commonest figure costs 0, one never heard the most", st.ties > 0 && st.tiesOk === st.ties && Math.min(...Object.values(C.figures)) === 0 && C.figures["ornamented-resolution"] === Math.max(...Object.values(C.figures)));
    // a corpus drawn with other costs (turns, runs, passing notes; few skips and held notes): fitted, the engine comes near
    const gen = (costs, s0) => {
      const out = [];
      for (const [, cc] of Object.entries(F.CANTI).filter(([, cc]) => !cc.fux)) for (let s = s0; s < s0 + 3; s++) { const x = F.florid(cc.cf, cc.key, { r: rng(s), costs }); if (x) out.push({ cf: cc.cf, key: cc.key, eighths: x.eighths, frame: x.frame }); }
      return out;
    };
    const other = { figures: { held: 2, skip: 2, escape: 2, anticipation: 2, passing: 0, tirata: 0, turn: 0.2, neighbor: 0.3, cambiata: 0.3, "double-neighbor": 0.5, "passing-eighths": 0.3 }, cells: { H: 1.5, Q: 0, DQ: 0.8, QE: 0 } };
    const T = M.measure(gen(other, 101)), d0 = M.distance(M.measure(gen(null, 1)), T);
    const fit = M.fitCosts(T, (c) => gen(c, 1), { rounds: 3 });
    is("fitted to a corpus drawn with other costs: the engine's figures come at least twice as near it (total variation)", fit.distance <= d0 / 2);
    notes.push(`fitted: ${d0.toFixed(2)} → ${fit.rounds.map((r) => r.distance.toFixed(2)).join(" → ")}`);
  }

  // Fux's own: his twelve florid examples read in their modes, their ficta the modes'; the engine over his canti
  // firmi, his cadences; drawn with the costs fitted to him, nearer him
  {
    const { keyOf, codeOf, codeDegree, codeAlter } = await import("../kairotic/partimento.mjs");
    const ex = await M.loadFux();
    let fictaOk = true;
    for (const e of ex) { const K = keyOf(e.key); for (const x of e.notes) { const c = codeOf(K, x.name), a = codeAlter(c); if (a !== 0 && a !== K.ficta(codeDegree(c))) fictaOk = false; } }
    is("Fux's twelve florid examples read (figures 82–88, in six modes), every altered note a ficta of its mode", ex.length === 12 && new Set(ex.map((e) => e.mode)).size === 6 && fictaOk);
    const lines = ex.filter((e) => e.cfPart === "Lower").map(M.lineOfKern), st = M.measure(lines);
    const known = [...st.figures.entries()].filter(([k]) => !k.startsWith("other")).reduce((a, [, v]) => a + v, 0);
    is("… the five with the cantus firmus below: every half bar's figure one of the catalogue's; every tie to an equal or shorter value", st.lines === 5 && known === st.halves && st.ties > 0 && st.tiesOk === st.ties);
    notes.push("Fux, measured: " + M.describe(st).slice(1, 5).join(" · "));
    const fux = Object.values(F.CANTI).filter((cc) => cc.fux);
    const gen = (costs, s0) => {
      const out = [];
      for (const cc of fux) for (let s = s0; s < s0 + 3; s++) { const x = F.florid(cc.cf, cc.key, { r: rng(s), costs }); if (x) out.push({ cc, x, line: { cf: cc.cf, key: cc.key, eighths: x.eighths, frame: x.frame } }); }
      return out;
    };
    const plain = gen(null, 11), dorian = plain.filter(({ cc }) => cc.key.mode === "dorian");
    is("florid over Fux's six canti firmi in their modes: every one drawn, the dorian cadence through C♯", plain.length === 18 && dorian.every(({ x }) => x.frame[x.frame.length - 2] === "C#5" || x.frame[x.frame.length - 2] === "C#4" || !/^C/.test(x.frame[x.frame.length - 2])));
    const d0 = M.distance(M.measure(plain.map((g) => g.line)), st), d1 = M.distance(M.measure(gen(M.FUX_COSTS, 11).map((g) => g.line)), st);
    is("… drawn with the costs fitted to Fux (FUX_COSTS), at most half as far from his figures and bars' rhythms", d1 <= d0 / 2);
    notes.push(`Fux's costs: ${d0.toFixed(2)} → ${d1.toFixed(2)} from his figures and rhythms`);
  }

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
