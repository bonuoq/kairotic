// SPDX-License-Identifier: MPL-2.0
// Study 50 · lines: the engine. The hard rules say which works may be; the soft rules of Studies 38–42 (soft.mjs:
// the melodic contour after Bach, the motion between the voices) say which are likely. A work of two timed lines is
// not written forwards (a crab is written from both ends), so the engine weighs whole works: all of them when they
// are few, else a pool drawn uniformly; and it chooses one by a softmax of −cost / temperature.

import { melodicParts, verticalParts, total, shape } from "./soft.mjs";

/** The soft cost of a whole work M (the dux written, and the coda), unit by unit on the lattice: the dux's line,
 *  the comes's line, and the vertical. {cost, parts: {id: sum}}. */
export function workCost(L, M, W) {
  const { D, C } = L.lines(M), R = L.rules, S = L.system;
  const ctx = (t) => ({
    N: S.N, strong: (u) => L.strong(u),
    lowerFirst: (x, c) => (L.k > 0 ? [x, c] : [c, x]),
    quality: (lo, hi) => S.quality(lo, hi),
    dissonant: (x, c) => R.dissonant(x, c),
    suspension: C[t] !== null && R.suspensionAt(D.slice(0, t + 1), C.slice(0, t + 1), t),
  });
  const parts = {};
  const add = (p) => { for (const [k, v] of Object.entries(p)) parts[k] = (parts[k] || 0) + v; };
  const comesLine = [];
  for (let t = 0; t < L.n; t++) {
    add(melodicParts(D.slice(0, t), D[t], W));
    if (C[t] !== null && C[t] !== undefined) {
      add(Object.fromEntries(Object.entries(melodicParts(comesLine, C[t], W)).map(([k, v]) => ["comes/" + k, v])));
      add(verticalParts(D.slice(0, t), C.slice(0, t), D[t], C[t], ctx(t), W));
      comesLine.push(C[t]);
    }
  }
  return { cost: total(parts), parts };
}

/** Every work of L (when there are at most `max` of them), else null. */
export function allWorks(L, max = 20000) {
  if (L.count() > max) return null;
  const out = [];
  const rec = (M, s) => {
    if (s === L.steps) { out.push(M); return; }
    for (let x = L.spec.lo; x <= L.spec.hi; x++) {
      if (L.check(M, s, x)) continue;
      const M2 = M.slice(); M2[L.order[s]] = x;
      if (L.count(M2, s + 1) > 0) rec(M2, s + 1);
    }
  };
  rec(new Array(L.positions).fill(undefined), 0);
  return out;
}

/** The engine's work: a softmax of −cost / temperature over every work (or a pool of `pool` drawn uniformly);
 *  at temperature 0 the cheapest. {M, cost, parts, of: how many were weighed, all: whether they were all}. */
export function engineWork(L, { temp = 1, r = Math.random, pool = 400, max = 20000, weights } = {}) {
  // (every work, scored, is kept on L: the next draw only chooses again)
  const cache = (L._engine = L._engine || new Map()), ck = JSON.stringify([max, weights || null]);
  let scored = cache.get(ck), all = true;
  if (!scored) {
    const works = allWorks(L, max);
    if (works) { scored = works.map((M) => ({ M, ...workCost(L, M, weights) })); cache.set(ck, scored); }
  }
  if (!scored) {
    all = false; scored = [];
    for (let i = 0; i < pool; i++) { const M = L.sample(r); if (M) scored.push({ M, ...workCost(L, M, weights) }); }
  }
  if (!scored.length) return null;
  let pick;
  if (temp <= 0.001) pick = scored.reduce((a, b) => (b.cost < a.cost ? b : a));
  else {
    const m = Math.min(...scored.map((s) => s.cost)), ws = scored.map((s) => Math.exp((m - s.cost) / temp));
    let x = r() * ws.reduce((a, b) => a + b, 0);
    pick = scored.find((s, i) => (x -= ws[i]) < 0) || scored[scored.length - 1];
  }
  return { ...pick, of: scored.length, all };
}

export { shape };
