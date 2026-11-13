// SPDX-License-Identifier: MPL-2.0
// Study 40 · imitation: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/40-imitation/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { canon, band } from "../kairotic/kernel.mjs";
import { canon as canon39 } from "../../39-meter/kairotic/kernel.mjs";

const base = { tonic: 1, k: -7, lo: 0, hi: 9, spacing: 11, starts: [1, 5, 8] };     // dorian, the dux D4–E5

/** Up to `max` whole works, depth first: [D, C]. */
function some(c, max) {
  const out = [], D = [], C = [];
  (function go() {
    if (out.length >= max) return;
    if (D.length >= c.spec.n) { out.push([[...D], [...C]]); return; }
    for (let x = c.spec.lo; x <= c.spec.hi && out.length < max; x++) {
      if (c.checkDux(D, C, x)) continue;
      for (const e of c.fanComes(D, C, x)) {
        if (e.reason || !e.futures || out.length >= max) continue;
        D.push(x); C.push(e.note); go(); D.pop(); C.pop();
      }
    }
  })();
  return out;
}

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  is("the bands of the degree", band(1) === "canon" && band(0.9) === "near" && band(0.5) === "near" &&
    band(0.4) === "motion" && band(0.2) === "motion" && band(0.1) === "free");

  // at 1 the work is a canon: the same count as Study 39's, where the comes is not chosen
  for (const [b, d, bars] of [[1, 2, 10], [2, 3, 6], [2, 2, 8]]) {
    const n = (bars - 1) * b + 1;
    const a = canon({ ...base, b, d, n, imitation: 1 }).count([], []), z = canon39({ ...base, b, d, n }).count([]);
    is(`a degree of 1 is Study 39's canon (b ${b}, d ${d}, ${bars} bars: ${a})`, a === z && a > 0);
  }

  const n = 11, near = canon({ ...base, b: 2, d: 3, n, imitation: 0.7 });
  let t0 = performance.now();
  const cn = near.count([], []);
  notes.push(`2/2, 6 bars, comes 3 beats later — 1: ${canon({ ...base, b: 2, d: 3, n, imitation: 1 }).count([], [])} · 0.7: ${cn} (${Math.round(performance.now() - t0)} ms) · 0.3: ${canon({ ...base, b: 2, d: 3, n, imitation: 0.3 }).count([], [])} works`);
  is("near notes open many more works than a canon", cn > canon({ ...base, b: 2, d: 3, n, imitation: 1 }).count([], []));
  is("the comes keeps within a 3rd of the dux's note", some(near, 300).every(([D, C]) =>
    C.every((c, t) => c === null || Math.abs(c - near.model(D, t)) <= 2)));
  is("and some works do change notes", some(near, 300).some(([D, C]) => C.some((c, t) => c !== null && c !== near.model(D, t))));
  const motion = canon({ ...base, b: 2, d: 3, n, imitation: 0.3 }), free = canon({ ...base, b: 2, d: 3, n, imitation: 0 });
  is("imitating the motion is a soft matter: the same works as free counterpoint", motion.count([], []) === free.count([], []));
  is("free counterpoint: more works still", free.count([], []) > cn);

  // the cadence: not from a 7th to a 5th, in free voices too
  {
    const open = canon({ ...base, b: 2, d: 3, n, imitation: 0, on: { cadence: false } });
    const shut = canon({ ...base, b: 2, d: 3, n, imitation: 0 });
    const cls = (x, c) => (((x - c) % 7) + 7) % 7;
    const D = [], C = [];
    // a work that ends from a 7th to a 5th, if the rules without it allow one
    let hit = null;
    (function go() {
      if (hit) return;
      const t = D.length;
      if (t === n - 1) {
        for (let x = base.lo; x <= base.hi && !hit; x++) {
          if (open.checkDux(D, C, x)) continue;
          for (let c = base.lo - 7; c <= base.hi - 7 && !hit; c++)
            if (!open.checkPair(D, C, x, c) && cls(x, c) === 4 && C[t - 1] !== null && cls(D[t - 1], C[t - 1]) === 6) hit = [[...D], [...C], x, c];
        }
        return;
      }
      for (let x = base.lo; x <= base.hi && !hit; x++) {
        if (open.checkDux(D, C, x)) continue;
        for (const e of open.fanComes(D, C, x)) {
          if (hit || e.reason || !e.futures) continue;
          D.push(x); C.push(e.note); go(); D.pop(); C.pop();
        }
      }
    })();
    if (hit) is("free voices: the cadence rule refuses a 7th to a 5th", /7th to a 5th/.test(shut.checkPair(hit[0], hit[1], hit[2], hit[3]) || ""));
    is("free voices: fewer works with the cadence rule, or as many", shut.count([], []) <= open.count([], []));
  }
  // an upbeat
  {
    const up = canon({ ...base, b: 2, d: 3, n: n - 1, phase: 1, imitation: 0.7 });
    is("an upbeat of a rest: works, beginning on a weak beat and ending on a strong one", up.count([], []) > 0 && !up.strong(0) && up.strong(n - 2));
  }
  // the fans add up
  const f = near.fanDux([], []);
  is("the dux's futuribles add up to the point's", f.reduce((a, e) => a + (e.futures || 0), 0) === cn);
  const D1 = [1], C1 = [null];
  const fd = near.fanDux(D1, C1).find((e) => e.futures > 0);
  is("a dux's note: its futures are the comes's, added", fd && near.fanComes(D1, C1, fd.note).reduce((a, e) => a + (e.futures || 0), 0) === fd.futures);
  is("before its entry the comes is silent", near.fanComes([], [], 1).length === 1 && near.fanComes([], [], 1)[0].note === null);

  // the count without blocking
  const fresh = canon({ ...base, b: 2, d: 3, n, imitation: 0.7 });
  const seen = [];
  const v = await fresh.countAsync([], [], { budget: 2, onProgress: (fr) => seen.push(fr) });
  is("counted without blocking: the same number", v === cn);
  is("with progress on the way", seen.length > 0 && seen.every((x) => x >= 0 && x <= 1));
  is("a count can be cancelled", (await canon({ ...base, b: 2, d: 3, n, imitation: 0.7 }).countAsync([], [], { cancelled: () => true })) === null);

  // the hard rules between free voices still hold
  const all = some(free, 300);
  is("free voices: every strong beat a consonance", all.every(([D, C]) => D.every((x, t) => t % 2 || C[t] === null || !free.dissonant(x, C[t]))));
  is("and both voices end together, on a perfect consonance", all.every(([D, C]) => C[n - 1] !== null && [0, 4].includes(Math.abs(D[n - 1] - C[n - 1]) % 7)));
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  for (const [w, ok] of results) if (!ok) console.log("  FAIL " + w);
  for (const s of notes) console.log("  · " + s);
  return bad.length;
}
