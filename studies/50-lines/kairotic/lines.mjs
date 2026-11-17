// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 50 · lines: counterpoint between two timed lines, whatever the relation in time between them
// (discussion #248).
//
// The dux is a line of m notes, each a units of a lattice long (a unit is the finest time both lines fall on). The
// comes is a reader of the dux — a head, as in Study 47 — at a signed speed p/q, d units late, k steps away, upright
// or upside down about an axis:
//
//   speed  1      a canon                   speed −1     a crab (the dux backwards)
//   speed  1/2    an augmentation           speed −1/2   a crab in augmentation (half the dux, backwards)
//   speed  2/3    a hemiola (three comes notes in the time of two of the dux)
//   speed  3/2, 2 a diminution: the comes enters later and reads the whole dux by the end
//
// The species of Studies 38–41 are relations of time too: the rules are Study 42's (kernel.mjs, a system as data),
// asked unit by unit on the two lines as the lattice spells them — a note longer than a unit is a note held (a tie),
// a strong unit is the first of a bar, and a dissonance on a strong unit must be prepared (held from a consonance)
// and resolve down by step, on a weak one pass by step. So a note of the dux held while the comes moves twice is
// second species, and a comes a unit late against a dux of two-unit notes is fourth.
//
// The futures are counted exactly. The order in which the dux is written is not given: it follows from the
// relation. Each step writes the position that leaves the fewest written notes still bearing on a time not judged
// yet (the memo's key); for a speed ≥ 0 that is forwards, for a crab it is from both ends to the middle, and for
// a crab in augmentation it is somewhere else — the same code finds where.

import { canon, makeSystem, DIATONIC } from "./kernel.mjs";

const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));

/** A speed as [p, q] (p signed, q > 0, in lowest terms), from [p, q], a number, or "2/3". */
export function speedOf(s) {
  let p, q;
  if (Array.isArray(s)) [p, q] = s;
  else if (typeof s === "string" && s.includes("/")) [p, q] = s.split("/").map(Number);
  else { const x = Number(s ?? 1); q = 1; while (Math.abs(x * q - Math.round(x * q)) > 1e-9 && q < 64) q++; p = Math.round(x * q); }
  if (!q || !Number.isFinite(p) || p === 0) throw new Error("a speed is p/q, not 0");
  if (q < 0) { p = -p; q = -q; }
  const g = gcd(Math.abs(p), q);
  return [p / g, q / g];
}

/** The lattice a relation needs: units per dux note (a), so that a comes note (a·q/|p| units) is whole too. */
export function latticeFor(speed, beatUnits = 1) {
  const [p, q] = speedOf(speed);
  let a = beatUnits;
  while ((a * q) % Math.abs(p)) a += beatUnits;   // the least a (a multiple of beatUnits) with a·q/|p| whole
  return a;
}

/**
 * spec: {tonic, lo, hi, spacing, starts, system, on, species,
 *        m (dux notes), a (units a dux note lasts), bar (units in a bar: its first is strong),
 *        speed (p/q, signed), d (units the comes is late), k (steps), inverted, axis, maxHold (a line's own notes: 2)}
 */
export function lines(spec) {
  const [p, q] = speedOf(spec.speed ?? 1);
  const a = Math.max(1, Math.round(spec.a ?? 1));
  // the work ends on the attack of the dux's last note (the final): its other notes last a units, the final one
  const m = spec.m, n = (m - 1) * a + 1;
  const ap = Math.abs(p);
  if ((a * q) % ap !== 0) throw new Error(`a comes note would last ${(a * q) / ap} units: a dux note must last a multiple of ${ap / gcd(ap, q)} units`);
  const cl = (a * q) / ap;                                   // units a comes note lasts
  const retro = p < 0;
  // the delay: given, or for a faster comes the one that makes it end with the dux (a diminution canon)
  const d = Math.max(0, Math.round(spec.d ?? (!retro && p > q ? (m - 1) * (a - cl) : 0)));
  const { lo, hi } = spec;
  const k = spec.k ?? -7, inverted = !!spec.inverted, axis = spec.axis ?? spec.tonic;
  const T = (x) => (inverted ? 2 * axis - x : x) + k;
  /** The note the comes sounds at unit t: an index of the dux (or m, the coda), or null (not in yet, or past the dux). */
  function source(t) {
    const s = rawSource(t);
    return coda && s !== null && t >= lastOnset ? m : s;
  }
  /** The note of the dux the comes reads at unit t (an index), or null. */
  function rawSource(t) {
    if (t < d) return null;
    if (retro) {
      // backwards: at unit t the comes reads the dux at n − 1 − (t − d)·|s|, rounded down to its unit
      const pos = Math.floor((q * (n - 1) - (t - d) * ap) / q);
      return pos < 0 ? null : Math.floor(pos / a);
    }
    // forwards: at unit t the comes reads the dux at (t − d)·s
    const pos = Math.floor(((t - d) * p) / q);
    return pos >= n ? null : Math.floor(pos / a);
  }
  const idx = (t) => Math.floor(t / a);                      // the dux note at unit t
  // a coda: the comes's last note free (a note of its own, not read from the dux). A comes faster than the dux
  // needs one: ending with it, its last two notes would be the dux's last two, a parallel perfect interval
  const coda = spec.coda ?? (!retro && p > q);
  const lastOnset = (() => { let t = n - 1; while (t > 0 && rawSource(t - 1) === rawSource(n - 1)) t--; return t; })();
  const P = m + (coda ? 1 : 0);                              // the positions written: the dux's notes, and the coda
  // the comes's range and starts, the dux's transformed
  const [clo, chi] = [T(lo), T(hi)].sort((x, y) => x - y);
  const starts = spec.starts || [spec.tonic];
  let entry = 0; while (entry < n && source(entry) === null) entry++;
  // how long a note may sound: held over the beat once (two notes' worth) by default, as Study 41 lets it — in each
  // line's own notes: 2a units for the dux, 2·(a·q/|p|) for the comes. The kernel has one length for the dux and a
  // whole multiple of it for the comes (an augmentation); a comes faster, or slower by a ratio not whole, shares the
  // longer of the two
  const H = spec.maxHold ?? 2;
  const r = cl / a, whole = Number.isInteger(r) && r >= 2;
  const maxHold = whole ? H * a : H * Math.max(a, cl);
  const R = canon({ ...spec, n, b: spec.bar ?? 2 * a, k, d: entry, imitation: 0, clo, chi, cstarts: starts.map(T), maxHold,
                    phase: spec.phase || 0, transform: whole ? { kind: "augmentation", m: r } : {} });
  const L = Math.max(maxHold * (whole ? r : 1) + 1, spec.bar ?? 2 * a, 2);     // how far back the rules look, in units

  // which dux notes the rules at unit t need: the window of both lines, back to t − L
  const deps = (t) => {
    const out = new Set();
    for (let j = Math.max(0, t - L); j <= t; j++) { out.add(idx(j)); const s = source(j); if (s !== null) out.add(s); }
    return [...out];
  };
  const depsOf = Array.from({ length: n }, (_, t) => deps(t));

  // ─── the order of writing, from the relation: each step the position that leaves the fewest notes bearing ───
  const order = [], known = new Set(), asked = new Set(), newTimes = [], bearing = [[]];
  const askableNow = () => { const out = []; for (let t = 0; t < n; t++) if (!asked.has(t) && depsOf[t].every((x) => known.has(x))) out.push(t); return out; };
  const bearingOf = (K, A) => {
    const out = new Set();
    for (let t = 0; t < n; t++) if (!A.has(t)) for (const x of depsOf[t]) if (K.has(x)) out.add(x);
    return [...out].sort((x, y) => x - y);
  };
  while (order.length < P) {
    let best = null;
    for (let x = 0; x < P; x++) {
      if (known.has(x)) continue;
      const K = new Set([...known, x]);
      const A = new Set(asked); for (let t = 0; t < n; t++) if (!A.has(t) && depsOf[t].every((y) => K.has(y))) A.add(t);
      const size = bearingOf(K, A).length, gain = A.size - asked.size;
      // fewer bearing, then more times judged now, then the earliest position (forwards when all is equal)
      if (!best || size < best.size || (size === best.size && (gain > best.gain || (gain === best.gain && x < best.x)))) best = { x, size, gain };
    }
    known.add(best.x); order.push(best.x);
    const now = askableNow(); now.forEach((t) => asked.add(t)); newTimes.push(now.sort((x, y) => x - y));
    bearing.push(bearingOf(known, asked));
  }
  const steps = P;

  /** The two lines, unit by unit, of a dux written in part (undefined where not yet). */
  function linesOf(M) {
    const D = [], C = [];
    for (let t = 0; t < n; t++) {
      D.push(M[idx(t)]);
      const s = source(t);
      C.push(s === null ? null : M[s] === undefined ? undefined : T(M[s]));
    }
    return { D, C };
  }
  /** Why the rules at unit t refuse the lines (null when they do not): the dux's, then the pair's. */
  function askAt(D, C, t) {
    const Dp = D.slice(0, t), Cp = C.slice(0, t);
    return R.checkDux(Dp, Cp, D[t]) || R.checkPair(Dp, Cp, D[t], C[t]);
  }
  /** Why writing x at step s is refused (null when it is not). */
  function check(M, s, x) {
    if (s >= steps) return "the work is finished";
    if (x < lo || x > hi) return "out of range";
    const M2 = M.slice(); M2[order[s]] = x;
    const { D, C } = linesOf(M2);
    for (const t of newTimes[s]) { const r = askAt(D, C, t); if (r) return `at unit ${t}: ${r}`; }
    return null;
  }

  // ─── the count, exact, memoized on the notes that still bear on a time not judged ───
  const memo = new Map();
  const W = hi - lo + 2;
  const key = (M, s) => {
    const b = bearing[s];
    if (b.length <= 12) { let c = s; for (const x of b) c = c * W + (M[x] - lo + 1); return c; }
    return s + ":" + b.map((x) => M[x]).join(",");
  };
  function countFrom(M, s) {
    if (s >= steps) return 1;
    const kk = key(M, s), got = memo.get(kk);
    if (got !== undefined) return got;
    let v = 0;
    const x0 = order[s];
    for (let x = lo; x <= hi; x++) if (check(M, s, x) === null) { M[x0] = x; v += countFrom(M, s + 1); M[x0] = undefined; }
    memo.set(kk, v);
    return v;
  }
  const blank = () => new Array(P).fill(undefined);
  const count = (M = blank(), s = 0) => countFrom(M.slice(), s);

  /** The candidates at step s: {note, reason} or {note, futures}. */
  function fan(M, s) {
    const out = [];
    for (let x = lo; x <= hi; x++) {
      const r = check(M, s, x);
      if (r) { out.push({ note: x, reason: r }); continue; }
      const M2 = M.slice(); M2[order[s]] = x;
      out.push({ note: x, reason: null, futures: count(M2, s + 1) });
    }
    return out;
  }
  /** A whole work, drawn with r() in [0, 1): each step a candidate in proportion to its futures (uniform over works). */
  function sample(r = Math.random) {
    const M = blank();
    for (let s = 0; s < steps; s++) {
      const cs = fan(M, s).filter((c) => c.futures > 0);
      if (!cs.length) return null;
      let x = r() * cs.reduce((t, c) => t + c.futures, 0);
      const c = cs.find((c) => (x -= c.futures) < 0) || cs[cs.length - 1];
      M[order[s]] = c.note;
    }
    return M;
  }

  return { spec, speed: [p, q], a, m, n, d, coda, positions: P, k, inverted, axis, retro, comesUnits: cl, entry, maxHold, order, newTimes, bearing,
           steps, source, T, lines: linesOf, check, count, fan, sample, rules: R, system: makeSystem(spec.system || DIATONIC), memo,
           strong: (t) => R.strong(t) };
}
