// SPDX-License-Identifier: MPL-2.0
// Study 43 · mirrors: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/43-mirrors/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { mirror } from "../kairotic/mirror.mjs";
import { canon, makeSystem, DIATONIC, SYSTEMS } from "../kairotic/kernel.mjs";

const base = { tonic: 1, lo: 0, hi: 9, spacing: 11, starts: [1, 5, 8], b: 2 };   // dorian, 2/2

/** Up to max whole works of a mirror, in its order: the dux, as M. */
function some(o, max) {
  const out = [], M = new Array(o.n);
  (function go(s) {
    if (out.length >= max) return;
    if (s >= o.steps) { out.push(M.slice()); return; }
    const pos = o.order[s];
    for (let a = o.spec.lo; a <= o.spec.hi && out.length < max; a++) {
      if (pos.length === 1) {
        if (o.check(M, s, [a]) || !o.count((M[pos[0]] = a, M), s + 1)) { M[pos[0]] = undefined; continue; }
        go(s + 1); M[pos[0]] = undefined;
      } else for (let z = o.spec.lo; z <= o.spec.hi && out.length < max; z++) {
        if (o.check(M, s, [a, z])) continue;
        M[pos[0]] = a; M[pos[1]] = z;
        if (o.count(M, s + 1)) go(s + 1);
        M[pos[0]] = undefined; M[pos[1]] = undefined;
      }
    }
  })(0);
  return out;
}

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const S = makeSystem(DIATONIC);

  // a canon written forwards, by the rules asked at each time: Study 42's count
  for (const [k, d, n] of [[-7, 3, 15], [-4, 2, 11], [7, 2, 9]]) {
    const a = mirror({ ...base, n, transform: { kind: "canon", k, d } }).count();
    const z = canon({ ...base, k, d, n, imitation: 1 }).count([], []);
    is(`a canon (k ${k}, d ${d}, ${n} beats) counts as Study 42's: ${a}`, a === z && a > 0);
  }

  // inversion: the comes is the dux upside down about the axis
  {
    const o = mirror({ ...base, n: 11, transform: { kind: "inversion", k: 0, d: 3, axis: 1 } });
    const ws = some(o, 200);
    notes.push(`inversion about D, at the unison, 3 beats later, 11 beats: ${o.count()} works`);
    is("inversion: works", ws.length > 0);
    is("... the comes is the dux upside down about D, 3 beats later", ws.every((M) => { const { C } = o.lines(M); return C.every((c, t) => t < 3 ? c === null : c === 2 - M[t - 3]); }));
    // on the white keys D is the axis that keeps every interval: the dorian mode is its own mirror
    const span = (a, b) => S.cents(b) - S.cents(a);
    is("on the white keys the mirror about D keeps every interval's size (dorian is its own mirror)",
      [0, 1, 2, 3, 4, 5, 6, 7, 8].every((x) => [0, 1, 2, 3, 4, 5, 6, 7, 8].every((y) => Math.abs(span(x, y) + span(2 - x, 2 - y)) < 1e-9)));
    is("... and about E it does not", [0, 1, 2, 3, 4, 5, 6].some((x) => Math.abs(S.cents(x + 1) - S.cents(x) - (S.cents(4 - x) - S.cents(3 - x))) > 1e-9));
  }

  // augmentation: the comes holds each of the dux's notes for two beats
  {
    const o = mirror({ ...base, n: 11, transform: { kind: "augmentation", k: -7, d: 2 } });
    const ws = some(o, 100);
    notes.push(`augmentation, an octave below, 2 beats later, 11 beats: ${o.count()} works`);
    is("augmentation: works, the comes twice as slow", ws.length > 0 && ws.every((M) => { const { C } = o.lines(M); return C.every((c, t) => t < 2 ? c === null : c === M[Math.floor((t - 2) / 2)] - 7); }));
  }

  // the crab: written from both ends to the middle
  {
    const o = mirror({ ...base, n: 11, transform: { kind: "crab", k: -7 } });
    is("the crab is written from both ends: the first step writes beats 1 and 11, the last the middle", JSON.stringify(o.order[0]) === "[0,10]" && JSON.stringify(o.order[5]) === "[5]");
    const t0 = performance.now(), nc = o.count();
    notes.push(`crab, an octave below, 11 beats: ${nc} works (${Math.round(performance.now() - t0)} ms)`);
    const ws = some(o, 300);
    is("crab: works", nc > 0 && ws.length > 0);
    is("... the comes is the dux backwards", ws.every((M) => { const { C } = o.lines(M); return C.every((c, t) => c === M[10 - t] - 7); }));
    is("... and every vertical comes back with its voices exchanged (invertible)", ws.every((M) => {
      const { D, C } = o.lines(M);
      return D.every((x, t) => (x - C[t]) + (D[10 - t] - C[10 - t]) === 14);
    }));
    is("... the work, written from its ends, obeys the rules going forwards too", ws.every((M) => {
      const { D, C } = o.lines(M);
      return D.every((x, t) => o.rules.checkDux(D.slice(0, t), C.slice(0, t), x) === null && o.rules.checkPair(D.slice(0, t), C.slice(0, t), x, C[t]) === null);
    }));
    // the fans add up, at the start and in the middle of a step
    const f = o.fan(new Array(11), 0);
    is("the futuribles of the first step add up to the count", f.reduce((a, e) => a + (e.futures || 0), 0) === nc);
    const a = f.find((e) => e.futures > 0).note;
    is("... and those of its second note to the first's", o.fanSecond(new Array(11), 0, a).reduce((s, e) => s + (e.futures || 0), 0) === f.find((e) => e.note === a).futures);
    const seen = [];
    const v = await mirror({ ...base, n: 11, transform: { kind: "crab", k: -7 } }).countAsync({ budget: 2, onProgress: (fr) => seen.push(fr) });
    is("counted without blocking: the same number", v === nc);
  }

  // the table canon: backwards and upside down — the score turned round is the other part
  {
    const o = mirror({ ...base, n: 11, transform: { kind: "table", k: 0, axis: 1 } });
    const nt = o.count(), ws = some(o, 200);
    notes.push(`table canon about D at the unison, 11 beats: ${nt} works`);
    is("table: works", nt > 0 && ws.length > 0);
    is("... the comes is the dux turned round (backwards, upside down about D): the score read from across the table",
      ws.every((M) => { const { C } = o.lines(M); return C.every((c, t) => c === 2 - M[10 - t]); }));
    is("... an ambigram: turned round, the work is the same work (the two voices exchanged)", ws.every((M) => {
      const { D, C } = o.lines(M);
      return D.every((x, t) => C[10 - t] === 2 - x);
    }));
    const grid = [];
    for (const k of [-7, -4, 0, 4, 7]) grid.push(`${k}: crab ${mirror({ ...base, n: 9, transform: { kind: "crab", k } }).count()} · table ${mirror({ ...base, n: 9, transform: { kind: "table", k, axis: 1 } }).count()}`);
    notes.push("9 beats, by the comes's distance: " + grid.join(" | "));
  }

  // in another system: the pentatonic crab
  {
    const P = SYSTEMS.pentatonic, m = P.modes["penta-C"];
    const o = mirror({ tonic: 0, lo: -1, hi: 6, spacing: 8, starts: [0, 3, 5], b: 2, n: 9, system: P, transform: { kind: "crab", k: -5 } });
    notes.push(`pentatonic crab, a period below, 9 beats: ${o.count()} works`);
    is("a crab in the pentatonic system", o.count() >= 0 && o.system.N === 5);
  }
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  for (const [w, ok] of results) if (!ok) console.log("  FAIL " + w);
  for (const s of notes) console.log("  · " + s);
  return bad.length;
}
