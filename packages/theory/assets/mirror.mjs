// SPDX-License-Identifier: MPL-2.0
// @kairotic/theory · mirror.mjs, what the comes box writes a crab with (speed −1): Study 43's mirror kernel as it is (its kernel
// is counterpoint.mjs). Kairotic · Study 43 · mirrors: canons by transformation, and the order in which a work is written.
//
// The comes is the dux transformed (a strict canon), and the transformation is data:
//
//   canon         the dux d beats later, k steps away                         C[t] = M[t-d] + k
//   inversion     the dux upside down about an axis (contrary motion)         C[t] = 2·axis − M[t-d] + k
//   augmentation  the dux at half speed (each note m beats)                    C[t] = M[⌊(t-d)/m⌋] + k
//   crab          the dux backwards, both voices at once (retrograde)         C[t] = M[n-1-t] + k
//   table         backwards and upside down: the score read by a second       C[t] = 2·axis − M[n-1-t] + k
//                 player from across the table (a musical ambigram)
//
// The first three can be written from the beginning, a note a beat. A crab or a table canon cannot: the comes at
// the start is the dux at the end. They are written from both ends towards the middle — each step fixes a note at
// the start and one at the end — and the futuribles of a point are the ways to close the work in the middle.
//
// The rules are Study 42's (kernel.mjs, a system as data): at every time whose window of notes is known, the dux's
// rules and the pair's are asked, as the kernel asks them going forwards. The futures are counted exactly, memoized
// on the notes that still bear on a time not yet asked.
//
//   M      the dux, an array of n pitches, undefined where not written yet
//   step   how many steps of the order are done; order[step] the positions the next step writes (one or two)

import { canon, makeSystem, DIATONIC } from "./counterpoint.mjs";   // (Study 43: "./kernel.mjs")

export const KINDS = ["canon", "inversion", "augmentation", "crab", "table"];

/**
 * spec: {tonic, lo, hi, n, b, phase, spacing, starts, system, on, maxHold, species,
 *        transform: {kind, k, d, axis, m}}
 */
export function mirror(spec) {
  const tr = { kind: "canon", k: -7, d: 3, m: 2, ...(spec.transform || {}) };
  const { n, lo, hi } = spec;
  const S = makeSystem(spec.system || DIATONIC);
  const kind = KINDS.includes(tr.kind) ? tr.kind : "canon";
  const k = tr.k, m = Math.max(1, Math.round(tr.m || 2));
  const retro = kind === "crab" || kind === "table";
  const inverted = kind === "inversion" || kind === "table";
  const d = retro ? 0 : Math.max(0, tr.d);
  const axis = tr.axis ?? spec.tonic;
  /** The comes's note for a note x of the dux. */
  const T = (x) => (inverted ? 2 * axis - x : x) + k;
  /** Where the comes at time t comes from in the dux (a position), or null before it enters. */
  const source = (t) => {
    if (retro) return n - 1 - t;
    if (t < d) return null;
    return kind === "augmentation" ? Math.floor((t - d) / m) : t - d;
  };
  // the comes's range and starts, the dux's transformed
  const [clo, chi] = [T(lo), T(hi)].sort((a, b) => a - b);
  const starts = spec.starts || [spec.tonic];
  // the rules: Study 42's kernel, with the comes as given (no degree of imitation: it is the transformation)
  const R = canon({ ...spec, k, d, imitation: 0, clo, chi, cstarts: starts.map(T),
                    maxHold: spec.maxHold ?? 2 });
  const b = spec.b || 1;
  const L = Math.max((spec.maxHold ?? 2) + 1, b, 2);                 // how far back the rules look

  // the order: forwards, or from both ends to the middle
  const order = [];
  if (retro) for (let i = 0; i <= n - 1 - i; i++) order.push(i === n - 1 - i ? [i] : [i, n - 1 - i]);
  else for (let i = 0; i < n; i++) order.push([i]);
  const steps = order.length;
  // after s steps: which positions are written, which times can be asked (their window known), and the
  // positions whose notes still bear on a time not asked yet (the memo's key)
  const known = [new Set()];
  for (let s = 0; s < steps; s++) known.push(new Set([...known[s], ...order[s]]));
  const deps = (t) => {
    const out = [];
    for (let j = Math.max(0, t - L); j <= t; j++) { out.push(j); const q = source(j); if (q !== null) out.push(q); }
    return out;
  };
  const askable = known.map((K) => {
    const out = new Set();
    for (let t = 0; t < n; t++) if (deps(t).every((p) => K.has(p))) out.add(t);
    return out;
  });
  /** The times a step makes askable: their rules are asked when it is written. */
  const newTimes = order.map((_, s) => [...askable[s + 1]].filter((t) => !askable[s].has(t)).sort((x, y) => x - y));
  const bearing = known.map((K, s) => {
    const out = new Set();
    for (let t = 0; t < n; t++) if (!askable[s].has(t)) for (const p of deps(t)) if (K.has(p)) out.add(p);
    return [...out].sort((x, y) => x - y);
  });

  /** The two voices of a dux (partly written): D = M, C where its source is written. */
  function lines(M) {
    const D = [], C = [];
    for (let t = 0; t < n; t++) {
      D.push(M[t]);
      const q = source(t);
      C.push(q === null ? null : M[q] === undefined ? undefined : T(M[q]));
    }
    return { D, C };
  }

  /** Why the rules at a time t refuse the work (null when they do not): the dux's, then the pair's. */
  function askAt(D, C, t) {
    const Dp = D.slice(0, t), Cp = C.slice(0, t);
    return R.checkDux(Dp, Cp, D[t]) || R.checkPair(Dp, Cp, D[t], C[t]);
  }

  /** Why writing vals at step s is refused (null when it is not): the range, then the rules at the new times. */
  function check(M, s, vals) {
    if (s >= steps) return "the work is finished";
    const pos = order[s];
    for (const x of vals) if (x < lo || x > hi) return "out of range";
    if (pos.length === 2 && vals.length === 1) return null;            // the first of two: asked with the second
    const M2 = M.slice(); pos.forEach((p, i) => { M2[p] = vals[i]; });
    const { D, C } = lines(M2);
    for (const t of newTimes[s]) { const r = askAt(D, C, t); if (r) return (retro ? `at beat ${t + 1}: ` : "") + r; }
    return null;
  }

  // ─── the count ───
  const memo = new Map();
  const W = hi - lo + 2;
  const key = (M, s) => { let c = s; for (const p of bearing[s]) c = c * W + (M[p] - lo + 1); return c; };
  function countFrom(M, s) {
    if (s >= steps) return 1;
    const kk = key(M, s), got = memo.get(kk);
    if (got !== undefined) return got;
    let v = 0;
    const pos = order[s];
    if (pos.length === 1) {
      for (let x = lo; x <= hi; x++) if (check(M, s, [x]) === null) { M[pos[0]] = x; v += countFrom(M, s + 1); M[pos[0]] = undefined; }
    } else {
      for (let a = lo; a <= hi; a++) for (let z = lo; z <= hi; z++)
        if (check(M, s, [a, z]) === null) { M[pos[0]] = a; M[pos[1]] = z; v += countFrom(M, s + 1); M[pos[0]] = undefined; M[pos[1]] = undefined; }
    }
    memo.set(kk, v);
    return v;
  }
  const blank = () => new Array(n).fill(undefined);
  /** The ways to finish the work after s steps (M as written so far), exact. */
  const count = (M = blank(), s = 0) => countFrom(M.slice(), s);
  /** The count from the start a few milliseconds at a time (the browser stays free); resolves to it. */
  function countAsync({ budget = 12, onProgress, cancelled } = {}) {
    return new Promise((resolve) => {
      // warm the memo bottom-up from the deepest steps: each pass counts what it can within its budget
      const M = blank();
      const stack = [{ s: 0, opts: null, i: 0, sum: 0 }];
      const optsAt = (s) => {
        const pos = order[s], out = [];
        if (pos.length === 1) { for (let x = lo; x <= hi; x++) if (check(M, s, [x]) === null) out.push([x]); }
        else for (let a = lo; a <= hi; a++) for (let z = lo; z <= hi; z++) if (check(M, s, [a, z]) === null) out.push([a, z]);
        return out;
      };
      stack[0].opts = optsAt(0); stack[0].kk = key(M, 0);
      let ticks = 0;
      function step() {
        if (cancelled && cancelled()) return resolve(null);
        const end = performance.now() + budget;
        while (stack.length) {
          if ((++ticks & 63) === 0 && performance.now() > end) {
            if (onProgress) { let fr = 0, w = 1; for (const f of stack) { w /= Math.max(1, f.opts.length); fr += Math.max(0, f.i - 1) * w; } onProgress(Math.min(1, fr), memo.size); }
            setTimeout(step, 0); return;
          }
          const f = stack[stack.length - 1];
          if (f.i >= f.opts.length) {
            memo.set(f.kk, f.sum); stack.pop();
            if (!stack.length) return resolve(f.sum);
            for (const p of order[f.s - 1]) M[p] = undefined;
            stack[stack.length - 1].sum += f.sum; continue;
          }
          const vals = f.opts[f.i++];
          order[f.s].forEach((p, i) => { M[p] = vals[i]; });
          const s2 = f.s + 1;
          if (s2 >= steps) { f.sum += 1; for (const p of order[f.s]) M[p] = undefined; continue; }
          const kk = key(M, s2), got = memo.get(kk);
          if (got !== undefined) { f.sum += got; for (const p of order[f.s]) M[p] = undefined; continue; }
          stack.push({ s: s2, opts: optsAt(s2), i: 0, sum: 0, kk });
        }
      }
      if (steps === 0) return resolve(1);
      step();
    });
  }

  /** The candidates for the first note of step s: {note, reason} or {note, futures} (over the second, if two). */
  function fan(M, s) {
    const out = [], pos = order[s];
    if (!pos) return out;
    for (let x = lo; x <= hi; x++) {
      if (pos.length === 1) {
        const r = check(M, s, [x]);
        if (r) { out.push({ note: x, reason: r }); continue; }
        const M2 = M.slice(); M2[pos[0]] = x;
        out.push({ note: x, reason: null, futures: count(M2, s + 1) });
      } else {
        let fut = 0, why = null, fits = 0;
        for (let z = lo; z <= hi; z++) {
          const r = check(M, s, [x, z]);
          if (r) { why = why || r; continue; }
          fits++;
          const M2 = M.slice(); M2[pos[0]] = x; M2[pos[1]] = z; fut += count(M2, s + 1);
        }
        out.push(fits ? { note: x, reason: null, futures: fut } : { note: x, reason: `no note at beat ${pos[1] + 1} fits: ${why}` });
      }
    }
    return out;
  }
  /** The candidates for the second note of step s (at the end), the first being a. */
  function fanSecond(M, s, a) {
    const pos = order[s], out = [];
    for (let z = lo; z <= hi; z++) {
      const r = check(M, s, [a, z]);
      if (r) { out.push({ note: z, reason: r }); continue; }
      const M2 = M.slice(); M2[pos[0]] = a; M2[pos[1]] = z;
      out.push({ note: z, reason: null, futures: count(M2, s + 1) });
    }
    return out;
  }

  return { spec, kind, n, k, d, m, axis, retro, inverted, order, steps, source, T, lines, check, count, countAsync, fan,
           fanSecond, rules: R, system: S, newTimes, bearing, memo, roles: (D, C) => R.roles(D, C) };
}

// api/import-module hands a component the default export
export default { mirror, KINDS };
