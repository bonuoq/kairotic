// SPDX-License-Identifier: MPL-2.0
// Study 39 · meter: the kernel's tests. They run in the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/39-meter/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { canon, quality, melodicError, semis, intervalName } from "../kairotic/kernel.mjs";

const base = { tonic: 1, k: -7, lo: -1, hi: 9, spacing: 11 };          // dorian, D4, range B3–E5
const notes = (b, bars) => (bars - 1) * b + 1;

/** Up to `max` whole canons, depth first (lowest notes first). */
function some(c, max) {
  const out = [], work = [];
  (function go() {
    if (out.length >= max) return;
    if (work.length >= c.spec.n) { out.push([...work]); return; }
    for (let x = c.spec.lo; x <= c.spec.hi && out.length < max; x++)
      if (c.check(work, x) === null && c.count([...work, x]) > 0) { work.push(x); go(); work.pop(); }
  })();
  return out;
}

export async function run() {
  const results = [], notesOut = [];
  const is = (what, ok) => results.push([what, !!ok]);

  is("C4 G4 is a perfect 5th", quality(0, 4) === "perfect");
  is("B3 F4 is a diminished 5th", quality(-1, 3) === "dissonant");
  is("F4 up to B4 is a tritone", melodicError(3, 6) !== null);
  is("E4 up to C5, a minor 6th", melodicError(2, 7) === null);
  is("C5 is 12 semitones above C4", semis(7) === 12);
  is("compound intervals", intervalName(9) === "10th" && intervalName(11) === "12th" && intervalName(14) === "15th");

  // first species is the case of one beat per bar: Study 38's canon, counted again
  const s1 = canon({ ...base, d: 2, b: 1, n: 12 });
  let t0 = performance.now();
  const n1 = s1.count([]);
  notesOut.push(`first species, dorian at the octave below, 2 notes later, 12 notes: ${n1} canons (${Math.round(performance.now() - t0)} ms)`);
  is("first species: 17977 canons, as the Python port counts", n1 === 17977);
  is("first species: no dissonance at all", some(s1, 200).every((dux) => s1.roles(dux).every((r) => r === null)));

  // second species in 2/2, the comes 3 beats later: on the other beats
  const s2 = canon({ ...base, d: 3, b: 2, n: notes(2, 8) });
  t0 = performance.now();
  const n2 = s2.count([]);
  const ms2 = performance.now() - t0;
  notesOut.push(`second species 2/2, 8 bars, the comes 3 beats later: ${n2} canons (${Math.round(ms2)} ms)`);
  is("second species: 496320 canons without the cadence rule, as the Python port counts",
    canon({ ...base, d: 3, b: 2, n: notes(2, 8), on: { cadence: false } }).count([]) === 496320);
  is("and 493630 with it: no cadence from a 7th to a 5th", n2 === 493630);
  is("counted in less than 2 s", ms2 < 2000);
  is("a futurible's futures add up to the point's", s2.fan([]).reduce((a, f) => a + (f.futures || 0), 0) === n2);

  const all = some(s2, 400);
  const verts = (dux) => {
    const out = [];
    for (let t = 0; t < dux.length; t++) { const c = s2.comesAt(dux, t); if (c !== null) out.push([t, dux[t], c]); }
    return out;
  };
  is("every strong beat is a consonance", all.every((dux) => verts(dux).every(([t, x, c]) => t % 2 || !s2.dissonant(x, c))));
  is("every dissonance is on a weak beat, reached and left by step in both voices", all.every((dux) =>
    verts(dux).every(([t, x, c]) => {
      if (!s2.dissonant(x, c)) return true;
      const pc = s2.comesAt(dux, t - 1), nc = s2.comesAt(dux, t + 1);
      return t % 2 === 1 && Math.abs(x - dux[t - 1]) === 1 && Math.abs(dux[t + 1] - x) === 1 &&
        pc !== null && Math.abs(c - pc) === 1 && (nc === null || Math.abs(nc - c) === 1);
    })));
  is("never two dissonances in a row", all.every((dux) => verts(dux).every(([t, x, c], i, vs) =>
    i === 0 || !(s2.dissonant(x, c) && s2.dissonant(vs[i - 1][1], vs[i - 1][2])))));
  is("no 5ths or octaves on consecutive strong beats", all.every((dux) => verts(dux).every(([t, x, c]) => {
    if (t % 2 || t < 2) return true;
    const pc = s2.comesAt(dux, t - 2);
    if (pc === null) return true;
    const cls = (a, b) => ((Math.abs(a - b) % 7) + 7) % 7;
    return !(quality(c, x) === "perfect" && quality(pc, dux[t - 2]) === "perfect" && cls(x, c) === cls(dux[t - 2], pc) &&
      !(x === dux[t - 2] && c === pc));
  })));
  const withDiss = all.filter((dux) => s2.roles(dux).some((r) => r));
  notesOut.push(`${withDiss.length} of the first ${all.length} canons have a dissonance`);
  is("some canons pass through a dissonance", withDiss.length > 0);
  is("and it is a passing note or a neighbour in each voice", withDiss.every((dux) => s2.roles(dux).every((r) =>
    r === null || (["passing", "neighbour"].includes(r.dux) && ["passing", "neighbour", "dissonant"].includes(r.comes)))));

  // the comes a beat later, at the octave: no second-species canon (each step makes a 7th or a 9th on a strong beat)
  is("2/2 at the octave, one beat later: no canon", canon({ ...base, d: 1, b: 2, n: notes(2, 6) }).count([]) === 0);
  // 3/2: two weak beats
  const s3 = canon({ ...base, d: 2, b: 3, n: notes(3, 5) });
  is("3/2 has canons too", s3.count([]) > 0);
  is("a dissonance on a strong beat is not allowed", (() => {
    // find a point on a strong beat and a dissonant candidate: its reason says so
    for (const dux of some(s2, 50)) for (let t = 4; t < dux.length; t += 2) {
      const pre = dux.slice(0, t), c = s2.comesAt([...pre, 0], t);
      for (let x = base.lo; x <= base.hi; x++)
        if (c !== null && s2.dissonant(x, c)) return /strong beat/.test(s2.check(pre, x) || "") || /tritone|7th|leap|turn|step|cross|apart/.test(s2.check(pre, x) || "");
    }
    return false;
  })());

  // the rules can be turned off: without weak-dissonance, a dissonance may be reached by leap
  const loose = canon({ ...base, d: 3, b: 2, n: notes(2, 8), on: { "weak-dissonance": false } });
  is("without weak-dissonance, more canons", loose.count([]) > n2);
  is("strict-direct is off unless asked for", canon({ ...base, d: 3, b: 2, n: notes(2, 8), on: { "strict-direct": true } }).count([]) < n2);
  // an upbeat: one rest (2/2 or 3/2) or two (3/2) before the dux's first note
  for (const [b, phase, bars] of [[2, 1, 7], [3, 1, 5], [3, 2, 5]]) {
    const nn = notes(b, bars) - phase, c = canon({ ...base, d: 3, b, n: nn, phase });
    const works = some(c, 200);
    is(`an upbeat of ${phase} in ${b}/2: canons (${c.count([])}), the dux beginning on a weak beat`, works.length > 0 && !c.strong(0));
    is(`  and ending on a strong one`, c.strong(nn - 1));
    is(`  every strong beat a consonance`, works.every((dux) => dux.every((x, t) => {
      const cc = c.comesAt(dux, t); return cc === null || !c.strong(t) || !c.dissonant(x, cc);
    })));
  }
  // the cadence: not from a 7th to a 5th
  {
    const open = canon({ ...base, d: 3, b: 2, n: notes(2, 6), on: { cadence: false } });
    const shut = canon({ ...base, d: 3, b: 2, n: notes(2, 6) });
    const cls = (x, c) => (((x - c) % 7) + 7) % 7;
    let found = null;
    for (const dux of some(open, 3000)) {
      const t = dux.length - 1, c = open.comesAt(dux, t), pc = open.comesAt(dux, t - 1);
      if (pc !== null && cls(dux[t], c) === 4 && cls(dux[t - 1], pc) === 6) { found = dux; break; }
    }
    notesOut.push(found ? "a cadence from a 7th to a 5th, without the rule: " + found.join(" ") : "no cadence from a 7th to a 5th found");
    if (found) is("the cadence rule refuses it", /7th to a 5th/.test(shut.check(found.slice(0, -1), found[found.length - 1]) || ""));
    is("with the rule, never from a 7th to a 5th", some(shut, 1000).every((dux) => {
      const t = dux.length - 1, c = shut.comesAt(dux, t), pc = shut.comesAt(dux, t - 1);
      return pc === null || !(cls(dux[t], c) === 4 && cls(dux[t - 1], pc) === 6);
    }));
    is("and fewer canons, or as many", shut.count([]) <= open.count([]));
  }
  // the count without blocking: the same number, with progress on the way
  {
    const fresh = canon({ ...base, d: 3, b: 2, n: notes(2, 8) });
    const seen = [];
    const v = await fresh.countAsync([], { budget: 2, onProgress: (f, st) => seen.push([f, st]) });
    is("counted without blocking: the same number", v === n2);
    is("with progress on the way, growing", seen.length > 0 && seen.every(([f], i) => f >= 0 && f <= 1 && (i === 0 || f >= seen[i - 1][0] - 1e-9)));
    is("and the counts after it are in the memo", fresh.count([1]) === s2.count([1]));
    const gone = await canon({ ...base, d: 3, b: 2, n: notes(2, 8) }).countAsync([], { budget: 1, cancelled: () => true });
    is("a count can be cancelled", gone === null);
  }
  // the rules between the voices for one vertical (as in first species)
  {
    const v = canon({ ...base, d: 2, b: 1, n: 12 });
    const v12 = canon({ ...base, d: 2, b: 1, n: 12, invert: [12] });
    is("a vertical: parallel 5ths", v.verticalError(5, 1, [4, 0]) === "parallel 5ths");
    is("a 6th becomes a 7th at the 12th", /12th.*7th/.test(v12.verticalError(5, 0, null)));
    is("a unison by direct motion; by step in the upper voice it is fine",
      v.verticalError(4, 4, [2, 0]) === "a unison by direct motion" && v.verticalError(3, 3, [2, 0]) === null);
  }
  return { results, notes: notesOut };
}

export function report({ results, notes: ns }) {
  const bad = results.filter((r) => !r[1]);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  for (const [w, ok] of results) if (!ok) console.log("  FAIL " + w);
  for (const s of ns) console.log("  · " + s);
  return bad.length;
}
