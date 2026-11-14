// SPDX-License-Identifier: MPL-2.0
// Study 41 · suspensions: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/41-suspensions/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { canon, quality } from "../kairotic/kernel.mjs";

const base = { tonic: 1, k: -7, lo: 0, hi: 9, spacing: 11, starts: [1, 5, 8] };     // dorian, the dux D4–E5
const notesFor = (b, bars, ph = 0) => (bars - 1) * b + 1 - ph;
const mod = (a, m) => ((a % m) + m) % m;

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

/** Every suspension of a work: [t, the voice that holds it]. */
const suspensions = (c, D, C) => D.map((_, t) => t).filter((t) => c.suspensionAt(D, C, t)).map((t) => [t, c.holder(D, C, t)]);

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // ties: the same pitch again is the note held, two beats at most; a leap is recovered by the next note struck
  {
    const c = canon({ ...base, d: 6, b: 2, n: notesFor(2, 8), imitation: 1 });
    is("a note held over the beat", c.checkDux([1], [null], 1) === null);
    is("held for two beats at most", /two beats at most/.test(c.checkDux([1, 1], [null, null], 1) || ""));
    const c3 = canon({ ...base, d: 6, b: 3, n: 13, imitation: 1, maxHold: 3 });
    is("with maxHold 3, three beats", c3.checkDux([1, 1], [null, null], 1) === null && /3 beats at most/.test(c3.checkDux([1, 1, 1], [null, null, null], 1) || ""));
    is("after a leap, the note may be held", c.checkDux([1, 5], [null, null], 5) === null);
    is("and the next note struck recovers the leap", /after the leap of a 5th the line turns down/.test(c.checkDux([1, 5, 5], [null, null, null], 6) || "") &&
      c.checkDux([1, 5, 5], [null, null, null], 4) === null);
  }

  // second species with ties: suspensions appear, and every one is prepared, held and resolved
  const free = canon({ ...base, d: 3, b: 2, n: notesFor(2, 8), imitation: 1 });
  let t0 = performance.now();
  const nf = free.count([], []);
  notes.push(`a canon in 2/2, 8 bars, the comes 3 beats later, with ties: ${nf} canons (${Math.round(performance.now() - t0)} ms; Study 40 counts 442780 without them)`);
  is("ties open more canons than Study 40's 442780", nf > 442780);
  const nearSync = canon({ ...base, d: 1, b: 2, n: notesFor(2, 8), imitation: 0.8, species: 4 });
  const works = [...some(free, 400), ...some(nearSync, 400)];
  const found = works.flatMap(([D, C]) => suspensions(free, D, C).map((s) => [D, C, ...s]));
  notes.push(`${found.length} suspensions in the first 800 works`);
  is("some works have suspensions", found.length > 0);
  is("each prepared by a consonance", found.every(([D, C, t]) => !free.dissonant(D[t - 1], C[t - 1])));
  is("held by one voice while the other moves", found.every(([D, C, t, h]) => h === "dux" ? D[t] === D[t - 1] && C[t] !== C[t - 1] : C[t] === C[t - 1] && D[t] !== D[t - 1]));
  is("resolved down a step by the voice that held it", found.every(([D, C, t, h]) => (h === "dux" ? D[t + 1] === D[t] - 1 : C[t + 1] === C[t] - 1)));
  is("to a consonance", found.every(([D, C, t]) => !free.dissonant(D[t + 1], C[t + 1])));
  const kinds = new Set(found.map(([D, C, t, h]) => {
    const [l, hh] = free.lowerFirst(D[t], C[t]), cls = mod(hh - l, 7);
    const heldLower = (h === "dux") === (base.k > 0);
    return (heldLower ? "lower " : "upper ") + ["", "9/2", "", "4", "", "", "7"][cls];
  }));
  notes.push("kinds: " + [...kinds].join(", "));
  is("only the kinds Fux allows: the 7-6, 4-3, 9-8 above, the 2-3 below", [...kinds].every((k) => ["upper 7", "upper 4", "upper 9/2", "lower 9/2"].includes(k)));
  is("no dissonance on a strong beat but a suspension", [[free, some(free, 400)], [nearSync, some(nearSync, 400)]].every(([c, ws]) =>
    ws.every(([D, C]) => D.every((x, t) => C[t] === null || !c.strong(t) || !c.dissonant(x, C[t]) || c.suspensionAt(D, C, t)))));

  // without the suspension rule, no dissonance on a strong beat at all
  {
    const off = canon({ ...base, d: 3, b: 2, n: notesFor(2, 8), imitation: 1, on: { suspension: false } });
    is("without suspensions, fewer canons", off.count([], []) < nf);
    is("and no dissonance on a strong beat", some(off, 300).every(([D, C]) => D.every((x, t) => C[t] === null || !off.strong(t) || !off.dissonant(x, C[t]))));
  }

  // fourth species: the dux is the cantus firmus, a note a bar; the comes is syncopated
  {
    const strict = canon({ ...base, d: 1, b: 2, n: notesFor(2, 8), imitation: 1, species: 4 });
    const n4 = strict.count([], []), nn = nearSync.count([], []);
    notes.push(`fourth species, the comes an octave below half a bar later: ${n4} strict canons, ${nn} works at 0.8`);
    is("strict canons in fourth species: the comes is the cantus firmus half a bar later", n4 > 0 && n4 < 1000);
    is("a little less imitation opens it up", nn > 10 * n4);
    const n = nearSync.spec.n;
    for (const [label, c] of [["at 0.8", nearSync], ["in a canon", strict]]) {
      const ws = some(c, 300);
      is(`${label}: the cantus firmus strikes on every strong beat and holds over the weak one`,
        ws.length > 0 && ws.every(([D]) => D.every((x, t) => t === 0 || (c.strong(t) ? x !== D[t - 1] : x === D[t - 1]))));
      is(`${label}: the comes holds over every strong beat and strikes on the weak ones, and the final`,
        ws.every(([, C]) => C.every((y, t) => t <= c.spec.d || ((c.strong(t) && t < n - 1) ? y === C[t - 1] : y !== C[t - 1]))));
      is(`${label}: the suspensions are the comes's`, ws.every(([D, C]) => suspensions(c, D, C).every(([, h]) => h === "comes")));
    }
    is("a canon until its cadence: the comes is the dux's note, but for the final", some(strict, 100).every(([D, C]) =>
      C.every((y, t) => t < 1 || t === n - 1 || y === strict.model(D, t))));
    notes.push("a strict canon: dux " + some(strict, 1)[0][0].join(" ") + " · comes " + some(strict, 1)[0][1].map((y) => (y === null ? "–" : y)).join(" "));
    is("the syncopation is only for 2/2", canon({ ...base, d: 2, b: 1, n: 10, imitation: 1, species: 4 }).count([], []) === canon({ ...base, d: 2, b: 1, n: 10, imitation: 1 }).count([], []));
    const grid = [];
    for (const k of [-7, -4, -3, 3, 4, 7]) grid.push(`${k}: ` + [1, 3, 5].map((d) => canon({ ...base, k, d, b: 2, n: notesFor(2, 8), imitation: 1, species: 4, cstarts: [1, 5, 8].map((x) => x + k) }).count([], [])).join("/"));
    notes.push("strict canons in fourth species, by interval (k) and delay 1/3/5 beats: " + grid.join(" · "));
  }

  // the count without blocking
  {
    const fresh = canon({ ...base, d: 3, b: 2, n: notesFor(2, 8), imitation: 1 });
    const v = await fresh.countAsync([], [], { budget: 2 });
    is("counted without blocking: the same number", v === nf);
  }
  // the fans add up
  is("the dux's futuribles add up to the point's", free.fanDux([], []).reduce((a, e) => a + (e.futures || 0), 0) === nf);
  is("roles: a suspension is S in the voice that holds it", found.length === 0 || (() => {
    const [D, C, t, h] = found[0], r = free.roles(D, C)[t];
    return r && r[h] === "suspension" && r[h === "dux" ? "comes" : "dux"] === "moving";
  })());
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  for (const [w, ok] of results) if (!ok) console.log("  FAIL " + w);
  for (const s of notes) console.log("  · " + s);
  return bad.length;
}
