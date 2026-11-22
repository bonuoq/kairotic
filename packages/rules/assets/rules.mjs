// SPDX-License-Identifier: MPL-2.0
// @kairotic/rules · rules.mjs: one constraint engine for every style (discussion #353; docs/rules.md).
//
//   the core       voices advancing unit by unit, candidates from a system, hard rules that refuse with a reason
//                  and soft rules that cost, an exact count memoized on a window as wide as the rules look back, the
//                  engine (a softmax of −cost / temperature among the candidates with a future), a uniform draw, a
//                  judgement — solve()
//   the catalogue  general rules with parameters, each a context and a condition and how far back it looks: the
//                  first ones, those of a voice over a given bass (Study 51's) — RULES
//   styles         a style chooses and parametrizes rules (named, versioned, inheriting: :extends) — overBass() builds
//                  the style of partimento.mjs's schemata, and reproduces its counts to the number (tests/rules.mjs)
//
// Step 2 of #353: one voice over a bass. Two and three upper voices, styles in EDN and comes come next.

import { mod, sign, keyOf, codeOf3, codeDegree, codeAlter, localOf, localNote, FIG_CLASS, CLASS_FIG, isDominant, degreeOf, parseKey, guessKey } from "./tonal.mjs";
import { melodicParts, verticalParts, total, choose, temperature, defaultWeights } from "./soft.mjs";

// ─── a time limit for the count ───
// The exact count runs where it is asked — in a page, on its only thread —, and a long bass without figures in four
// parts takes minutes (16 bars of half notes: about a minute; of whole notes, more than eight): the page would freeze.
// within(ms, f) runs f with a deadline every count checks as it goes; past it the count gives up (TooLong). What it
// counted stays in its memo (an entry is written only when complete), so asking again goes on from there. A solver's
// search finds a realization without counting, for what is too long to count.
let STOP = Infinity, TICKS = 0;
export class TooLong extends Error { constructor() { super("too long to count here"); this.tooLong = true; } }
const tick = () => { if ((++TICKS & 1023) === 0 && Date.now() > STOP) throw new TooLong(); };
export function within(ms, f) {
  const before = STOP;
  STOP = Math.min(before, Date.now() + ms);
  try { return f(); } finally { STOP = before; }
}
/**
 * Depth first, unit by unit, the candidates (from cands(), each {x, cost}) in the engine's order — a softmax of
 * −cost / temp, drawn (Gumbel) —, back from dead ends, the states found dead remembered by key(t) (the memo's window:
 * the rules look no further back). push/pop place a candidate. True when complete; false if there is none; TooLong
 * past ms milliseconds.
 */
function depthFirst({ n, at, cands, push, pop, key, temp = 0.5, r = Math.random, ms = 2000 }) {
  const deadline = Date.now() + ms, dead = new Set();
  let nodes = 0;
  const g = () => -Math.log(-Math.log(Math.min(1 - 1e-12, Math.max(1e-12, r()))));
  function go() {
    const t = at();
    if (t >= n) return true;
    const k = key(t);
    if (dead.has(k)) return false;
    if ((++nodes & 63) === 0 && Date.now() > deadline) throw new TooLong();
    const cs = cands().map((c) => ({ c, o: -c.cost / Math.max(temp, 1e-3) + g() })).sort((a, b) => b.o - a.o);
    for (const { c } of cs) { push(c); if (go()) return true; pop(); }
    dead.add(k);
    return false;
  }
  return go();
}

// ─────────────────────────────── the core ───────────────────────────────
/**
 * A voice to write over n units. spec: {n, codes (the candidates), at (U, t, c) → x (what every rule reads of the
 * candidate c at unit t after the voice U: computed once), rules [{id, lookback, check (x) → reason | null}], soft
 * [{id, cost (x) → {id: cost}}], window (the memo's: the largest lookback), name (c) → text}.
 */
export function solve(spec) {
  const { n, codes, at, rules, soft = [] } = spec;
  const window = spec.window ?? Math.max(1, ...rules.map((r) => r.lookback ?? 1));
  /** Why c at unit t after U is refused (the first rule that refuses it, in order), or null. */
  function check(U, t, c) {
    if (t >= n) return "the work is finished";
    const x = at(U, t, c);
    for (const r of rules) { const e = r.check(x); if (e) return e; }
    return null;
  }
  /** Which rule refuses it: {id, reason} or null. */
  function why(U, t, c) {
    if (t >= n) return { id: "edges", reason: "the work is finished" };
    const x = at(U, t, c);
    for (const r of rules) { const e = r.check(x); if (e) return { id: r.id, reason: e }; }
    return null;
  }
  const memo = new Map();
  const keyOfU = (U, t) => t + ":" + U.slice(Math.max(0, t - window), t).join(",");
  function countFrom(U) {
    const t = U.length;
    if (t >= n) return 1n;
    tick();
    const k = keyOfU(U, t), got = memo.get(k);
    if (got !== undefined) return got;
    let v = 0n;
    for (const c of codes) if (check(U, t, c) === null) { U.push(c); v += countFrom(U); U.pop(); }
    memo.set(k, v);
    return v;
  }
  const count = (U = []) => (U.length > n ? 0n : countFrom([...U]));
  const fan = (U = []) => codes.map((c) => {
    const r = check(U, U.length, c), name = spec.name ? spec.name(c) : String(c);
    return r ? { note: c, name, reason: r } : { note: c, name, reason: null, futures: count([...U, c]) };
  });
  /** The soft cost of c after U, by rule: {id: cost}. */
  const costParts = (U, c) => { const x = at(U, U.length, c); return Object.assign({}, ...soft.map((s) => s.cost(x))); };
  function sample(r = Math.random, U0 = []) {
    const U = [...U0];
    while (U.length < n) {
      const cs = fan(U).filter((x) => !x.reason && x.futures > 0n);
      if (!cs.length) return null;
      const tot = cs.reduce((a, x) => a + x.futures, 0n);
      let x = (tot * BigInt(Math.floor(r() * 2 ** 52))) / 2n ** 52n;
      const pick = cs.find((c) => (x -= c.futures) < 0n) || cs[cs.length - 1];
      U.push(pick.note);
    }
    return U;
  }
  function engine({ temp = 1, follow = true, r = Math.random } = {}, U0 = []) {
    const U = [...U0];
    while (U.length < n) {
      const cs = fan(U).filter((x) => !x.reason && x.futures > 0n).map((x) => ({ ...x, parts: costParts(U, x.note) }));
      cs.forEach((x) => { x.cost = total(x.parts); });
      const pick = choose(cs, temperature(temp, follow, count(U)), r);
      if (!pick) return null;
      U.push(pick.note);
    }
    return U;
  }
  function judge(U) {
    if (U.length !== n) return `${U.length} units, the bass has ${n}`;
    for (let t = 0; t < n; t++) { const r = check(U.slice(0, t), t, U[t]); if (r) return `unit ${t + 1}: ${r}`; }
    return null;
  }
  /** A realization without counting (too long to count): depthFirst, null if none, TooLong past ms. */
  function search({ temp = 0.5, r = Math.random, ms = 2000 } = {}) {
    const U = [];
    const cands = () => codes.filter((c) => check(U, U.length, c) === null).map((c) => ({ x: c, cost: total(costParts(U, c)) }));
    return depthFirst({ n, at: () => U.length, cands, push: (c) => U.push(c.x), pop: () => U.pop(), key: (t) => keyOfU(U, t), temp, r, ms }) ? U : null;
  }
  return { n, codes, window, rules, soft, check, why, count, search, fan, sample, engine, judge, costParts, memo };
}

// ─────────────────────────────── a voice over a given bass: what its rules read ───────────────────────────────
/** The world of one upper voice over a given bass B in the key K: the verticals, the keys of the units, the moves. */
export function overBassWorld(K, B, o = {}) {
  const n = B.length, phase = o.phase ?? 0;
  const D = codeDegree, A = codeAlter;
  const semiU = (c) => K.semi(D(c), A(c));
  const semiB = (t) => K.semi(B[t].d, B[t].r || 0);
  const LOC = B.map((b) => localOf(K, b.key));
  const loc = (t, c) => localNote(K, LOC[t], D(c), A(c));
  const locB = (t) => localNote(K, LOC[t], B[t].d, B[t].r || 0).deg;
  const inKey = (t, c) => { const l = loc(t, c); return l.alt === 0 || (l.alt === 1 && LOC[t].key.mode === "minor" && l.deg >= 5) || (l.alt !== 0 && l.alt === LOC[t].key.ficta(l.deg)) || !!(B[t].chroma && B[t].chroma.some(([d, a]) => l.deg === d && l.alt === a)); };
  const strong = (t) => (B[t] && B[t].strong !== undefined ? B[t].strong : (t + phase) % 2 === 0);
  function vertical(t, c) {
    const steps = D(c) - B[t].d, cls = mod(steps, 7), s = mod(semiU(c) - semiB(t), 12);
    const q = cls === 0 ? (s === 0 ? "perfect" : "dissonant") : cls === 4 ? (s === 7 ? "perfect" : "dissonant")
            : cls === 2 ? (s === 3 || s === 4 ? "imperfect" : "dissonant") : cls === 5 ? (s === 8 || s === 9 ? "imperfect" : "dissonant") : "dissonant";
    const tri = s === 6 ? (cls === 3 ? "A4" : cls === 4 ? "d5" : null) : null;
    return { steps, cls, q, tri };
  }
  const consonant = (v) => v.q !== "dissonant";
  function bassPassing(t) {
    if (t < 1 || !B[t].struck) return false;
    let j = t + 1; while (j < n && !B[j].struck) j++;
    if (j >= n) return false;
    const a = B[t].d - B[t - 1].d, b = B[j].d - B[t].d;
    return Math.abs(a) === 1 && a === b;
  }
  const onsetOf = (U, j) => { let i = j; while (i > 0 && U[i - 1] === U[j]) i--; return i; };
  const delayedOn = o.delayed ?? true;
  /** What every rule reads of the candidate c at unit t after U. */
  function at(U, t, c) {
    const v = vertical(t, c), prev = t >= 1 ? U[t - 1] : null;
    const held = prev !== null && c === prev, struck = !held;
    const delayed = delayedOn && held && t >= 1 && B[t].struck && strong(t) && strong(t - 1) &&
                    vertical(t - 1, prev).q === "dissonant" && vertical(t - 1, prev).cls === 6 && v.q === "dissonant" && v.cls === 3;
    return { U, t, c, v, prev, held, struck, delayed };
  }
  return { K, B, n, D, A, semiU, semiB, LOC, loc, locB, inKey, strong, vertical, consonant, bassPassing, onsetOf, at, delayedOn };
}

// ─────────────────────────────── the catalogue ───────────────────────────────
// A rule: (world, params) → {id, lookback, check (x) → reason | null}. Its context is what it reads of x (the note,
// the line, the vertical, the move…); its lookback how many units before t it reads (the memo's window).
export const RULES = {
  /** note · the voice's range. */
  range: (w, { lo = 7, hi = 21 } = {}) => ({ id: "range", lookback: 0,
    check: ({ c }) => (w.D(c) < lo || w.D(c) > hi ? "out of range" : null) }),

  /** note · the notes of the unit's key (its scale; in minor ⑥ and ⑦ raised; a church mode's musica ficta, the final's
   *  raised 3rd only in the last chord; a unit's chromatic tones). */
  scale: (w) => ({ id: "scale", lookback: 0,
    check: ({ t, c }) => {
      if (!w.inKey(t, c)) return `not a note of ${w.LOC[t].key.tonic} ${w.LOC[t].key.mode}`;
      const l = w.loc(t, c);
      return l.alt !== 0 && t < w.n - 1 && w.LOC[t].key.fictaAtEnd(l.deg) ? `${w.K.name(w.D(c), w.A(c))} only in the last chord (musica ficta: the final's 3rd raised)` : null;
    } }),

  /** vertical · above the bass, not on its note but at the end, not too far from it. */
  "from-bass": (w, { spacing = 16 } = {}) => ({ id: "from-bass", lookback: 0,
    check: ({ t, v }) => (v.steps < 0 ? "below the bass" : v.steps === 0 && t < w.n - 1 ? "the unison with the bass (only at the end)" : v.steps > spacing ? "too far from the bass" : null) }),

  /** vertical · the figures asked over the bass (one of them). */
  figures: (w, { figured = true } = {}) => ({ id: "figures", lookback: 0,
    check: ({ t, v }) => (figured && w.B[t].fig && !w.B[t].fig.some((f) => FIG_CLASS(f) === v.cls) ? `the figures ask for ${w.B[t].fig.join(" or ")}` : null) }),

  /** note · in minor the dominant's chord major (its ⑦ raised); with ro, ②'s 6/3 going to ① too (the RO's 6♯). */
  "leading-tone-raised": (w, { ro = false } = {}) => ({ id: "leading-tone-raised", lookback: 0,
    check: ({ t, c }) => {
      const { K, B, n, LOC, D, A } = w, l = w.loc(t, c);
      if (LOC[t].key.mode === "minor" && B[t].dominant && B[t].chord !== "6/3" && l.deg === 6 && l.alt !== 1)
        return `the chord on the dominant is major: ${K.name(D(c), A(c) + 1)}, not ${K.name(D(c), A(c))}`;
      if (ro && LOC[t].key.mode === "minor" && l.deg === 6 && l.alt !== 1 && w.locB(t) === 1 && t + 1 < n) {
        let j = t + 1; while (j < n && !B[j].struck) j++;
        if (j < n && w.locB(j) === 0 && Math.abs(B[j].d - B[t].d) === 1) return `over ② going to ① the leading tone: ${K.name(D(c), A(c) + 1)}, not ${K.name(D(c), A(c))}`;
      }
      return null;
    } }),

  /** line · a note held n units at most (a unit more where a 7th is held into the next bass's 4th). */
  hold: (w, { max = 2 } = {}) => ({ id: "hold", lookback: max + 1,
    check: ({ U, t, held, delayed }) => (held && t - w.onsetOf(U, t - 1) >= max + (delayed ? 1 : 0) ? `a note is held ${max} units at most` : null) }),

  /** line · the melodic intervals: no augmented ones (the diminished 4th in minor and 7th allowed), within an octave. */
  intervals: (w) => ({ id: "intervals", lookback: 1,
    check: ({ t, c, prev, struck }) => {
      if (!struck || prev === null) return null;
      const { D, semiU, LOC, loc } = w, nn = w.n, a = prev, b = c;
      const d = Math.abs(D(b) - D(a)), s = Math.abs(semiU(b) - semiU(a));
      if (d === 0) return t >= 1 && LOC[t].key !== LOC[t - 1].key && LOC[t].key.tonic !== LOC[t - 1].key.tonic ? null : "a chromatic step";
      if (d === 1) return s <= 2 ? null : "an augmented 2nd";
      if (d === 2) return s === 3 || s === 4 ? null : "this 3rd";
      if (d === 3) return s === 5 || (s === 4 && LOC[Math.min(t, nn - 1)].key.mode === "minor" && [a, b].some((x) => { const l = loc(Math.min(t, nn - 1), x); return l.deg === 6 && l.alt === 1; })) ? null : "an augmented 4th";
      if (d === 4) return s === 6 || s === 7 ? null : "an augmented 5th";
      if (d === 5) return s === 8 || s === 9 ? null : "this 6th";
      if (d === 6) return LOC[Math.min(t, nn - 1)].key.mode === "minor" && s === 9 ? null : "a 7th (only the diminished one, in minor)";
      if (d === 7) return s === 12 ? null : "this octave";
      return "a leap wider than the octave";
    } }),

  /** line · after a leap the line turns (turn: from a 4th); line: free, moderate, strict. */
  leaps: (w, { turn = true, line = "free" } = {}) => ({ id: "leaps", lookback: 3,
    check: ({ U, t, c, prev, struck }) => {
      if (!struck || prev === null) return null;
      const { D } = w, on = w.onsetOf(U, t - 1), a1 = on >= 1 ? U[on - 1] : null, step = D(c) - D(prev);
      if (turn && a1 !== null && Math.abs(D(prev) - D(a1)) >= 3 && sign(step) === sign(D(prev) - D(a1))) return "after a leap of a 4th or more the line turns";
      if (line === "free") return null;
      const before = a1 === null ? null : D(prev) - D(a1), aa = Math.abs(step), bb = before === null ? 0 : Math.abs(before);
      if (line === "strict" && aa > 4 && aa !== 7) return "a leap wider than a 5th (but the octave)";
      if (bb >= (line === "strict" ? 3 : 4) && !(aa === 1 && sign(step) !== sign(before))) return `after a leap of a ${line === "strict" ? "4th" : "5th"} or more the line turns back by step`;
      if (line === "strict" && bb >= 2 && aa >= 2 && sign(step) === sign(before)) return "two leaps in a row the same way";
      return null;
    } }),

  /** line · a church mode's musica ficta: a raised note leads up by step (C♯ to D), a lowered one goes down (B♭); at
   *  the last cadence the leading tone raised where the mode raises it. */
  ficta: (w) => ({ id: "ficta", lookback: 1,
    check: ({ t, c, prev, struck }) => {
      if (!struck || prev === null) return null;
      const { K, D, A, LOC } = w, step = D(c) - D(prev), lp = w.loc(t - 1, prev), lc = w.loc(t, c), f = LOC[t - 1].key.ficta(lp.deg);
      if (f && lp.alt === f && (f > 0 ? step !== 1 : step >= 0)) return `${K.name(D(prev), A(prev))} ${f > 0 ? "goes up by step" : "goes down"} (musica ficta)`;
      if (t === w.n - 1 && step === 1 && lc.deg === 0 && lp.deg === 6 && lp.alt === 0 && LOC[t - 1].key.ficta(6) > 0)
        return `at the cadence the leading tone raised: ${K.name(D(prev), A(prev) + 1)}, not ${K.name(D(prev), A(prev))} (musica ficta)`;
      return null;
    } }),

  /** line · in minor ⑥ and ⑦ go up raised and down natural; the raised ⑥ goes on up to the raised ⑦ (not over a bass rising through them). */
  "melodic-minor": (w) => ({ id: "melodic-minor", lookback: 1,
    check: ({ t, c, prev, struck }) => {
      if (!struck || prev === null) return null;
      const { K, B, D, A, LOC } = w, step = D(c) - D(prev);
      const lp = w.loc(t - 1, prev), lc = w.loc(t, c), minorP = LOC[t - 1].key.mode === "minor" && lp.deg >= 5;
      if (minorP && Math.abs(step) === 1) {
        if (step > 0 && lp.alt !== 1) return `${K.name(D(prev), A(prev))} goes up raised (melodic minor)`;
        if (step < 0 && lp.alt === 1 && lc.alt !== 1 && !(B[t].r === 1 || B[t - 1].r === 1)) return `${K.name(D(prev), A(prev))} goes down natural (melodic minor)`;
      }
      if (minorP && lp.deg === 5 && lp.alt === 1 && !(step === 1 && lc.alt === 1) && !(B[t].r === 1 || B[t - 1].r === 1)) {
        const up = [-1, 0, 1].map((x) => codeOf3(D(prev) + 1, x)).find((x) => { const l = w.loc(t - 1, x); return l.deg === 6 && l.alt === 1; });
        return `${K.name(D(prev), A(prev))} goes on up to ${up === undefined ? "the raised ⑦" : K.name(D(up), A(up))} (melodic minor, toward the tonic)`;
      }
      return null;
    } }),

  /**
   * vertical, line · dissonance: on a strong unit prepared (a suspension, the upper voice or the bass held), on a weak
   * one passing by step, never two in a row; resolved down by step to a consonance; over a pedal by step; the
   * accented passing tone where asked. ro (chapter 4): the augmented 4th and diminished 5th as semi-consonances
   * (unprepared, resolved up to a 6th, down to a 3rd), over a passing bass a note of the chord before (exchange).
   * free (t) (chapter 6): the dissonances a chord of four tones lets in, its 7th down by step, an augmented 6th up.
   */
  dissonance: (w, { ro = false, exchange = false, free = () => null } = {}) => {
    const { B, n, D, strong, vertical, consonant, bassPassing } = w;
    function entry(t, c, prev, delayed) {
      const v = vertical(t, c), held = prev !== null && c === prev, struck = !held;
      if (B[t].pedal && (held || (prev !== null && Math.abs(D(c) - D(prev)) === 1))) return null;
      if (strong(t)) {
        const bassHeld = !B[t].struck;
        const ap = B[t].ap && !held && !bassHeld && t >= 1 && Math.abs(D(c) - D(prev)) === 1 && consonant(vertical(t - 1, prev));
        if (!ap && held === bassHeld) return held ? "a dissonance with both voices held" : `a ${CLASS_FIG[v.cls]} (dissonant) on a strong unit must be prepared, one voice holding its note`;
        if (!delayed && !consonant(vertical(t - 1, prev))) return "a suspension is prepared by a consonance";
        if (held && !(v.cls === 6 || v.cls === 3 || (v.cls === 1 && v.steps >= 8))) return "held in the upper voice: a 7th, a 4th or a 9th";
        if (bassHeld && v.cls !== 1 && v.cls !== 3) return "held in the bass: a 2nd or a 4th (2–3, 4/2)";
      } else {
        if (B[t].struck) return "a dissonance on a weak unit: over a held bass";
        if (!struck || t === 0 || Math.abs(D(c) - D(prev)) !== 1) return "a dissonance on a weak unit passes by step";
        if (!consonant(vertical(t - 1, prev))) return "two dissonances in a row";
      }
      return null;
    }
    return { id: "dissonance", lookback: 2, check: ({ U, t, c, v, prev, held, struck, delayed }) => {
      // what the unit before asks
      const fp = t >= 1 ? free(t - 1) : null, pv0 = t >= 1 ? vertical(t - 1, prev) : null;
      if (fp && fp.seventh === pv0.cls && !(held && !B[t].struck) && !(struck && D(c) === D(prev) - 1) && !(held && v.cls === 3 && v.q === "dissonant"))
        return "the 7th of the chord goes down by step";
      if (fp && fp.up === pv0.cls && pv0.q === "dissonant" && !(held && !B[t].struck) && !(struck && D(c) === D(prev) + 1))
        return "the augmented 6th goes up by step";
      const freeBefore = !!(fp && !consonant(pv0) && fp.cls.includes(pv0.cls) && (!pv0.tri || fp.tri));
      if (t >= 1 && !delayed && !freeBefore) {
        const pv = pv0;
        let special = false, ok4 = false;
        if (ro && !consonant(pv)) {
          const pp = t >= 2 ? U[t - 2] : null;
          const pdel = w.delayedOn && pp !== null && prev === pp && B[t - 1].struck && strong(t - 1) && t >= 2 && strong(t - 2) &&
                       vertical(t - 2, pp).q === "dissonant" && vertical(t - 2, pp).cls === 6 && pv.cls === 3;
          special = entry(t - 1, prev, pp, pdel) !== null;
          const semiOk = pv.tri && struck && ((pv.tri === "A4" && D(c) === D(prev) + 1 && v.cls === 5) || (pv.tri === "d5" && D(c) === D(prev) - 1 && v.cls === 2));
          const passOk = !pv.tri && bassPassing(t - 1) && consonant(vertical(t - 2 >= 0 ? t - 2 : 0, prev)) && consonant(v) && (held || Math.abs(D(c) - D(prev)) === 1);
          ok4 = semiOk || passOk;
          if (special && !ok4) return pv.tri ? (pv.tri === "A4" ? "the augmented 4th resolves up to a 6th" : "the diminished 5th resolves down to a 3rd") : "over the passing bass the held note goes on into a consonance";
        }
        if (!consonant(pv) && B[t - 1].pedal && !special && !ok4) {
          if (!(held || Math.abs(D(c) - D(prev)) === 1)) return "over the pedal a dissonance moves on by step";
        } else if (!consonant(pv) && !special && !ok4) {
          if (strong(t - 1)) {
            const upperHeld = t >= 2 && U[t - 2] === prev, bassHeldBefore = !B[t - 1].struck;
            if (upperHeld || !bassHeldBefore) { if (!(struck && D(c) === D(prev) - 1)) return upperHeld ? "the suspension resolves down by step (the upper voice)" : "the accented passing tone resolves down by step"; }
            else if (!(B[t].struck && B[t].d === B[t - 1].d - 1)) return "the suspension resolves down by step (the bass)";
            if (!consonant(v) && !(ro && v.tri)) return "the suspension resolves to a consonance";
          } else {
            const a = U[w.onsetOf(U, t - 1) - 1];
            if (!(struck && D(c) - D(prev) === D(prev) - D(a))) return "the passing tone goes on by step, the same way";
          }
        }
      }
      // the dissonance of this unit
      if (!consonant(v)) {
        if (t === n - 1) return "the work does not end on a dissonance";
        const ft = free(t);
        const e = ft && ft.cls.includes(v.cls) ? null : entry(t, c, prev, delayed);
        if (e && !(ro && (v.tri || (bassPassing(t) && consonant(vertical(t - 1, c)) && (held || exchange))))) return e;
      }
      return null;
    } };
  },

  /** pair · no parallel 5ths or octaves with the bass, no direct ones with the upper voice leaping; structural: not
   *  from the strong unit before either, under a diminution. */
  parallels: (w, { structural = true } = {}) => ({ id: "parallels", lookback: 3,
    check: ({ U, t, c, v, prev, struck }) => {
      const { B, D } = w;
      if (t >= 1 && v.q === "perfect" && struck && B[t].struck) {
        const pv = w.vertical(t - 1, prev), bm = B[t].d - B[t - 1].d, um = D(c) - D(prev);
        if (pv.q === "perfect" && pv.cls === v.cls && (bm !== 0 || um !== 0)) return `parallel ${v.cls === 0 ? "octaves" : "5ths"}`;
        if (sign(bm) === sign(um) && bm !== 0 && Math.abs(um) > 1) return `${v.cls === 0 ? "an octave" : "a 5th"} by direct motion, the upper voice leaping`;
      }
      if (structural && structuralParallels(w, U, t, c)) return `parallel ${v.cls === 0 ? "octaves" : "5ths"} from the strong unit before, under the diminution`;
      return null;
    } }),

  /** edge · over ① the upper voice starts on an octave, 5th or 3rd; it ends on an octave or a 3rd (or the 6th over ③),
   *  reached by step. middle: an inner voice, free; end false: the phrase goes on. */
  edges: (w, { middle = false, end = true, figured = true } = {}) => ({ id: "edges", lookback: 1,
    check: ({ t, c, v, prev }) => {
      if (middle) return null;
      if (t === 0 && !(figured && w.B[0].fig) && w.locB(0) === 0 && ![0, 2, 4].includes(v.cls)) return "over ① the upper voice starts on an octave, a 5th or a 3rd";
      if (t === w.n - 1 && end !== false) {
        if (![0, 2].includes(v.cls) && !(v.cls === 5 && w.locB(t) === 2)) return "it ends on an octave or a 3rd";
        if (prev !== null && Math.abs(w.D(c) - w.D(prev)) !== 1) return "the last note is reached by step";
      }
      return null;
    } }),
};

// parallels at the level of the structure (Study 61, #321): a perfect 5th or octave on a strong unit after the same one
// on the strong unit before, both voices moved the same way, only ornaments between them (by step, or dissonant)
function structuralParallels(w, U, t, c) {
  const { B, D, strong, vertical, consonant } = w;
  if (!strong(t) || (t >= 1 && U[t - 1] === c)) return 0;
  let s = t - 1;
  while (s >= 0 && !strong(s)) s--;
  if (s < 0 || s === t - 1) return 0;
  const a = vertical(s, U[s]), b = vertical(t, c);
  if (a.q !== "perfect" || b.q !== "perfect" || a.cls !== b.cls) return 0;
  const du = D(c) - D(U[s]), db = B[t].d - B[s].d;
  if (!(du !== 0 && db !== 0 && Math.sign(du) === Math.sign(db))) return 0;
  for (let j = s + 1; j < t; j++) {
    const x = U[j], y = U[j - 1];
    if (B[j].struck && Math.abs(B[j].d - B[j - 1].d) > 1) return 0;
    if (x === y) continue;
    if (Math.abs(D(x) - D(y)) > 1 && consonant(vertical(j, x))) return 0;
  }
  return 1;
}

// ─── soft rules: what a candidate costs (soft.mjs's, with those of a voice over a bass) ───
export const SOFT_RULES = {
  /** soft.mjs: the shape of the line and the vertical it makes, by its ids and weights. */
  "soft.mjs": (w, { W }) => {
    const bassLine = w.B.map((b) => b.d);
    const ctx = (t, c) => ({
      N: 7, strong: (u) => w.strong(u), lowerFirst: (x, y) => [x, y],
      quality: (lo_, hi_) => { const st = hi_ - lo_, cl = mod(st, 7); return cl === 0 || cl === 4 ? "perfect" : cl === 2 || cl === 5 ? "imperfect" : "dissonant"; },
      dissonant: () => w.vertical(t, c).q === "dissonant", suspension: w.vertical(t, c).q === "dissonant" && w.strong(t),
    });
    return { id: "soft.mjs", cost: ({ U, t, c }) => {
      const up = U.map(w.D), mel = melodicParts(up, w.D(c), W);
      const ck = chordSkip(w, W, U, t, c, mel), sp = structuralParallels(w, U, t, c) ? W["structural-parallels"] ?? 0 : 0;
      return { ...mel, ...verticalParts(bassLine.slice(0, t), up, bassLine[t], w.D(c), ctx(t, c), W), ...(ck ? { "chord-skip": ck } : {}), ...(sp ? { "structural-parallels": sp } : {}) };
    } };
  },
  /** the leading tone goes up to the tonic, everywhere — but where it has a reason not to (see partimento.mjs). */
  "leading-tone": (w, { W, middle = false }) => ({ id: "leading-tone", cost: ({ U, t, c }) => {
    const v = leadingTone(w, W, middle, U, t, c);
    return v ? { "leading-tone": v } : {};
  } }),
};
function chordSkip(w, W, U, t, c, mel) {
  const wt = W["chord-skip"] ?? 0;
  if (!wt || t < 1 || w.B[t].struck) return 0;
  const prev = U[t - 1];
  if (prev === undefined || Math.abs(w.D(c) - w.D(prev)) < 2) return 0;
  if (!w.consonant(w.vertical(t - 1, prev)) || !w.consonant(w.vertical(t, c))) return 0;
  const leap = ["leap-size", "contrary-after-leap", "step-back", "leap-after-leap"].reduce((a, k) => a + (mel[k] || 0), 0);
  return leap > 0 ? -Math.min(1, wt) * leap : 0;
}
function leadingTone(w, W, middle, U, t, c) {
  const wt = W["leading-tone"] ?? 0;
  if (!wt || t < 1) return 0;
  const { D, LOC, B } = w, prev = U[t - 1];
  if (prev === undefined || c === prev) return 0;
  const lp = w.loc(t - 1, prev), kp = LOC[t - 1].key;
  if (!(lp.deg === 6 && (kp.mode === "major" ? lp.alt === 0 : lp.alt === 1))) return 0;
  if (LOC[t].key.tonic !== kp.tonic || LOC[t].key.mode !== kp.mode) return 0;
  const step = D(c) - D(prev), lc = w.loc(t, c);
  if (step === 1 && lc.deg === 0) return 0;
  if (middle && lc.deg === 4 && step === -2 && w.locB(t) === 0) return 0;
  const a1 = t >= 2 ? U[t - 2] : null;
  if (step === -1 && a1 !== null && D(prev) - D(a1) === -1) return 0;
  if (step === -1 && w.vertical(t - 1, prev).q === "dissonant") return 0;
  if (w.locB(t) === 4 && w.locB(t - 1) === 4) return 0;
  const functional = B[t - 1].dominant || w.locB(t) === 0;
  return functional ? wt : wt / 2;
}

// ─────────────────────────────── styles ───────────────────────────────
// A style: {style, version, extends, rules: [[id params]…], soft: [[id params]…], weights}. A rule named again in a
// style that extends another replaces it (its parameters merged); [id false] removes it.
export function resolveStyle(style, library = STYLES) {
  if (!style.extends) return { ...style, rules: [...(style.rules || [])], soft: [...(style.soft || [])], weights: { ...(style.weights || {}) } };
  const parent = resolveStyle(library[style.extends] || (() => { throw new Error(`no such style: ${style.extends}`); })(), library);
  const merge = (base, own = []) => {
    const out = base.map(([id, p]) => [id, p]);
    for (const [id, p] of own) {
      const i = out.findIndex(([x]) => x === id);
      if (p === false) { if (i >= 0) out.splice(i, 1); }
      else if (i >= 0) out[i] = [id, { ...(out[i][1] || {}), ...(p || {}) }];
      else out.push([id, p]);
    }
    return out;
  };
  return { ...parent, ...style, rules: merge(parent.rules, style.rules), soft: merge(parent.soft, style.soft), weights: { ...parent.weights, ...(style.weights || {}) } };
}
export const STYLES = {
  // partimento.mjs's schemata: one voice over a given bass (Studies 51–59), in the order its check reads them
  "partimento-1": { style: "partimento-1", version: "1.0.0",
    rules: [["range"], ["scale"], ["from-bass"], ["figures"], ["leading-tone-raised"], ["hold"], ["intervals"], ["leaps"], ["melodic-minor"], ["ficta"], ["dissonance"], ["parallels"], ["edges"]],
    soft: [["soft.mjs"], ["leading-tone"]],
    weights: { alternation: 0, "leading-tone": 1.5 } },
};

/**
 * One voice over a given bass, in a style: spec {bass (units {d r struck strong fig chord key dominant pedal ap chroma}),
 * key, style (a name or a style), and the parameters of partimento.mjs's schemata — lo, hi, spacing, maxHold, figured,
 * line, ro, exchange, free, delayed, turn, voice ("middle"), end, structural, weights}.
 */
export function overBass(spec = {}) {
  const K = keyOf(spec.key || { tonic: "C" }), B = spec.bass;
  const w = overBassWorld(K, B, { phase: spec.phase, delayed: spec.delayed });
  const st = resolveStyle(typeof spec.style === "object" ? spec.style : STYLES[spec.style || "partimento-1"]);
  const lo = spec.lo ?? 7, hi = spec.hi ?? 21, figured = spec.figured ?? true, ro = !!spec.ro, middle = spec.voice === "middle";
  const free = typeof spec.free === "function" ? spec.free : () => null;
  // what each rule takes from the spec (a style's own parameters first)
  const fromSpec = {
    range: { lo, hi }, "from-bass": { spacing: spec.spacing ?? 16 }, figures: { figured }, "leading-tone-raised": { ro },
    hold: { max: spec.maxHold ?? 2 }, leaps: { turn: spec.turn ?? true, line: spec.line || "free" },
    dissonance: { ro, exchange: !!spec.exchange, free }, parallels: { structural: spec.structural !== false },
    edges: { middle, end: spec.end, figured },
  };
  const rules = st.rules.map(([id, p]) => RULES[id](w, { ...(fromSpec[id] || {}), ...(p || {}) }));
  const W = { ...defaultWeights(), ...st.weights, ...(spec.weights || {}) };
  const soft = st.soft.map(([id, p]) => SOFT_RULES[id](w, { W, middle, ...(p || {}) }));
  const codes = [];
  for (let d = lo; d <= hi; d++) for (const a of [-1, 0, 1]) { const c = codeOf3(d, a); if (B.some((b, t) => w.inKey(t, c))) codes.push(c); }
  // (the memo's window: three units, as partimento.mjs's — the structural parallels read back to the strong unit
  // before, which the bass's meter keeps within it)
  const S = solve({ n: B.length, codes, at: w.at, rules, soft, window: spec.window ?? 3, name: (c) => K.name(w.D(c), w.A(c)) });
  return { ...S, style: st, world: w, key: K, bass: B, vertical: w.vertical, degree: w.D, alter: w.A, name: (c) => K.name(w.D(c), w.A(c)) };
}

// ─────────────────────────────── several voices over the bass (step 3) ───────────────────────────────
// The chords, as figures over the bass: the classes of interval above it (0 the octave, 2 the 3rd, 4 the 5th, 5 the
// 6th…) every one of them sounds (need) and nothing else does (ok). In three parts (CHORDS) and in four (CHORDS4: the
// dominant's family free to enter, its 7th's class, an augmented 6th going up) — as @kairotic/cac's partimento.mjs.
export const CHORDS = {
  "5/3": { need: [2], ok: [2, 4, 0] }, "6/3": { need: [5, 2], ok: [5, 2] }, "6": { need: [5], ok: [5, 2, 0] },
  "7/3": { need: [6, 2], ok: [6, 2] }, "4/2": { need: [1, 3], ok: [1, 3, 5] }, "6/4": { need: [5, 3], ok: [5, 3, 0] },
  "5/4": { need: [3], ok: [3, 4, 0] }, "6/5": { need: [5, 4], ok: [5, 4, 2] }, "7/4": { need: [6, 3], ok: [6, 3] },
};
export const CHORDS4 = {
  "5/3": { need: [2], ok: [2, 4, 0] }, "6/3": { need: [5, 2], ok: [5, 2, 0] }, "6": { need: [5], ok: [5, 2, 0] },
  "6/4": { need: [5, 3], ok: [5, 3, 0] }, "5/4": { need: [3], ok: [3, 4, 0] }, "7/3": { need: [6, 2], ok: [6, 2, 4, 0] },
  "7/4": { need: [6, 3], ok: [6, 3, 4, 0] }, "5/2": { need: [1, 4], ok: [1, 4, 0] },
  "7": { need: [6, 2], ok: [6, 2, 4, 0], free: [6], seventh: 6 }, "6/5": { need: [5, 4, 2], ok: [5, 4, 2], free: [4], seventh: 4 },
  "6/4/3": { need: [5, 3, 2], ok: [5, 3, 2], free: [3], seventh: 2 }, "4/2": { need: [5, 3, 1], ok: [5, 3, 1], free: [1, 3], seventh: 0 },
  "+6": { need: [5, 2], ok: [5, 2, 0], free: [5], up: 5 }, "+6/4/3": { need: [5, 3, 2], ok: [5, 3, 2], free: [5, 3], up: 5, tri: true },
  "+6/5/3": { need: [5, 4, 2], ok: [5, 4, 2], free: [5], up: 5 },
};
// where a chord's 3rd is, by its figures (a class above the bass; 0 the bass itself, as in a 6/3)
const THIRD = { "5/3": 2, "7/3": 2, "5/4": 2, "6/3": 0, "6": null, "6/4": 5, "4/2": 3, "6/5": 0, "7/4": 6 };
const FIG = [8, 2, 3, 4, 5, 6, 7];
// the root of a 7th chord above its bass (in degrees), by its figures
const ROOT = { "7": 0, "6/5": -2, "6/4/3": 3, "4/2": 1 };

/**
 * Several voices to write over n units. spec: {n, voices [{name, solver (solve()'s: its codes, check, costParts),
 * prefix (its costs' names), weight (of its costs)}], between [{id, check (X) → reason | null}] (X: {W the voices so
 * far, t, x the notes at t, p those at t − 1}), quick (W, t, x) → false (a tuple refused at once: the order of the
 * voices), soft [{id, cost (X)}], window, result (W) → a realization}.
 */
export function solveVoices(spec) {
  const { n, voices, between, soft = [] } = spec;
  const k = voices.length, window = spec.window ?? 3;
  const quick = spec.quick || (() => true);
  const X = (W, t, x) => ({ W, t, x, p: t >= 1 ? W.map((U) => U[t - 1]) : null });
  const betweenCheck = (W, t, x) => { const xx = X(W, t, x); for (const r of between) { const e = r.check(xx); if (e) return e; } return null; };
  const check = (W, t, x) => voices.reduce((r, v, i) => r || v.solver.check(W[i].slice(0, t), t, x[i]), null) || betweenCheck(W, t, x);
  function tuples(W) {
    const t = W[0].length, ok = voices.map((v, i) => v.solver.codes.filter((c) => v.solver.check(W[i], t, c) === null)), out = [];
    const go = (i, x) => {
      if (i === k) { if (betweenCheck(W, t, x) === null) out.push([...x]); return; }
      for (const c of ok[i]) { x.push(c); if (quick(W, t, x)) go(i + 1, x); x.pop(); }
    };
    go(0, []);
    return out;
  }
  const memo = new Map();
  function countFrom(W) {
    const t = W[0].length;
    if (t >= n) return 1n;
    tick();
    const key = t + ":" + W.map((U) => U.slice(Math.max(0, t - window)).join(",")).join("|");
    const got = memo.get(key);
    if (got !== undefined) return got;
    let v = 0n;
    for (const x of tuples(W)) { W.forEach((U, i) => U.push(x[i])); v += countFrom(W); W.forEach((U) => U.pop()); }
    memo.set(key, v);
    return v;
  }
  const empty = () => voices.map(() => []);
  const count = (W = empty()) => countFrom(W.map((U) => [...U]));
  /** The tuples at the next unit with their futures and soft cost (futures false: not counted, null). */
  function fan(W = empty(), futures = true) {
    return tuples(W).map((x) => {
      const t = W[0].length, parts = {};
      voices.forEach((v, i) => { for (const [id, c] of Object.entries(v.solver.costParts(W[i], x[i]))) parts[(v.prefix || "") + id] = c * (v.weight ?? 1); });
      const xx = X(W, t, x);
      for (const s of soft) Object.assign(parts, s.cost(xx));
      return { x, futures: futures ? count(W.map((U, i) => [...U, x[i]])) : null, parts, cost: total(parts) };
    });
  }
  const result = spec.result || ((W) => W);
  function sample(r = Math.random) {
    const W = empty();
    while (W[0].length < n) {
      const cs = fan(W).filter((c) => c.futures > 0n);
      if (!cs.length) return null;
      const tot = cs.reduce((s, c) => s + c.futures, 0n);
      let y = (tot * BigInt(Math.floor(r() * 2 ** 52))) / 2n ** 52n;
      const c = cs.find((c) => (y -= c.futures) < 0n) || cs[cs.length - 1];
      W.forEach((U, i) => U.push(c.x[i]));
    }
    return result(W);
  }
  function engine({ temp = 1, follow = true, r = Math.random } = {}) {
    const W = empty();
    while (W[0].length < n) {
      const cs = fan(W).filter((c) => c.futures > 0n).map((c, i) => ({ ...c, note: i }));
      const pick = choose(cs, temperature(temp, follow, count(W)), r);
      if (!pick) return null;
      W.forEach((U, i) => U.push(pick.x[i]));
    }
    return result(W);
  }
  function judgeW(W, long) {
    if (W.some((U) => U.length !== n)) return long;
    for (let t = 0; t < n; t++) { const r = check(W, t, W.map((U) => U[t])); if (r) return `unit ${t + 1}: ${r}`; }
    return null;
  }
  /** A realization without counting (too long to count): depthFirst, null if none, TooLong past ms. */
  function search({ temp = 0.5, r = Math.random, ms = 2000 } = {}) {
    const W = empty();
    const ok = depthFirst({ n, at: () => W[0].length, cands: () => fan(W, false), push: (c) => W.forEach((U, i) => U.push(c.x[i])),
                            pop: () => W.forEach((U) => U.pop()),
                            key: (t) => t + ":" + W.map((U) => U.slice(Math.max(0, t - window)).join(",")).join("|"), temp, r, ms });
    return ok ? result(W) : null;
  }
  return { n, voices, between, check, tuples, count, search, fan, sample, engine, judgeW, memo };
}

// ─── the catalogue: rules between the voices (context: pair, chord, progression, given) ───
// A rule between voices: (world N, params) → {id, check (X)}. N: {K, B, D, A, semi, V (each voice's world), names,
// asked (t) (the chord asked at t), sevenths (t), figured, ro, ltOf (t, c), loc (t, c), keys}.
export const BETWEEN = {
  /** pair · no voice under the one above it; within (four parts): neighbours within an octave, pair by pair. */
  order: (N, { within = null, form = "four" } = {}) => ({ id: "order", check: ({ x }) => {
    for (let i = 0; i + 1 < x.length; i++) {
      if (N.D(x[i + 1]) >= N.D(x[i])) return form === "three" ? "the middle voice under the upper" : `the ${N.names[i + 1]} under the ${N.names[i]}`;
      if (within !== null && N.D(x[i]) - N.D(x[i + 1]) > within) return `the ${N.names[i]} and the ${N.names[i + 1]} within an octave`;
    }
    return null;
  } }),
  /** given · a voice sings the bass again, later and higher (the Fenaroli's canon). */
  imitation: (N, { voice = null, delay = 2, steps = 7 } = {}) => ({ id: "imitation", check: ({ t, x }) => {
    if (voice === null || t < delay) return null;
    const i = N.names.indexOf(voice);
    return N.D(x[i]) !== N.B[t - delay].d + steps ? `the canon: the ${voice === "top" ? "upper" : voice} voice sings the bass ${delay} units later` : null;
  } }),
  /** pair · chapter 4: over a passing bass a dissonance that is not held is the other voice's note before (exchanged). */
  exchange: (N) => ({ id: "exchange", check: ({ t, x, p }) => {
    if (!N.ro || t < 1 || !N.V[0].bassPassing(t)) return null;
    for (let i = 0; i < x.length; i++) {
      const v = N.V[i].vertical(t, x[i]), other = p[1 - i];
      if (x[i] !== p[i] && v.q === "dissonant" && !v.tri && mod(N.semi(x[i]) - N.semi(other), 12) !== 0) return "over the passing bass a dissonance is a note held, or taken from the other voice";
    }
    return null;
  } }),
  /** pair · the upper voices at most apart (degrees). */
  apart: (N, { max = 7 } = {}) => ({ id: "apart", check: ({ x }) => (N.D(x[0]) - N.D(x[1]) > max ? "the upper voices within an octave" : null) }),
  /** pair · a 2nd or a 7th between two upper voices: one of them the dissonance (four parts: or a chord of four tones). */
  seconds: (N, { form = "three" } = {}) => ({ id: "seconds", check: ({ t, x }) => {
    const v = x.map((c, i) => N.V[i].vertical(t, c));
    if (form === "three") {
      const cls = mod(N.D(x[0]) - N.D(x[1]), 7);
      if ((cls === 1 || cls === 6) && v[0].q !== "dissonant" && v[1].q !== "dissonant") return "a 2nd or a 7th between the upper voices, neither of them the dissonance";
      if (v[0].q === "dissonant" && v[1].q === "dissonant" && v[0].cls === v[1].cls) return "the dissonance doubled";
      return null;
    }
    const ch = N.asked(t), seventh = ch && ch.seventh !== undefined ? ch.seventh : null, four_ = ch && ch.need.length === 3;
    for (let i = 0; i < x.length; i++) for (let j = i + 1; j < x.length; j++) {
      const cls = mod(N.D(x[i]) - N.D(x[j]), 7);
      if ((cls === 1 || cls === 6) && v[i].q !== "dissonant" && v[j].q !== "dissonant" && !four_ && seventh === null) return `a 2nd or a 7th between the ${N.names[i]} and the ${N.names[j]}`;
    }
    return null;
  } }),
  /** progression · a 6/4 over a held bass resolves to the 5/3: the 6th down to the 5th, the 4th down to the 3rd. */
  "six-four": (N, { form = "three" } = {}) => ({ id: "six-four", check: ({ t, x, p }) => {
    const { B, D } = N;
    if (t < 1 || B[t].struck || B[t].pedal) return null;
    const pv = p.map((c, i) => N.V[i].vertical(t - 1, c).cls), v = x.map((c, i) => N.V[i].vertical(t, c));
    if (form === "three") {
      if (new Set(pv).size === 2 && pv.every((c) => c === 5 || c === 3)) {
        const down = (i) => D(x[i]) === D(p[i]) - 1 && (pv[i] === 5 ? 4 : 2) === v[i].cls;
        if (!down(0) || !down(1)) return "the 6/4 resolves to the 5/3, each voice down a step (6 to 5, 4 to 3)";
      }
      return null;
    }
    const pc = new Set(pv);
    if (pc.has(5) && pc.has(3) && !pc.has(2) && !pc.has(1))
      for (let i = 0; i < x.length; i++) if ((pv[i] === 5 || pv[i] === 3) && !(D(x[i]) === D(p[i]) - 1 && v[i].cls === pv[i] - 1)) return "the 6/4 resolves to the 5/3 (6 to 5, 4 to 3)";
    return null;
  } }),
  /** pair · no parallel 5ths or octaves between two upper voices. */
  "parallels-upper": (N, { form = "three" } = {}) => ({ id: "parallels-upper", check: ({ t, x, p }) => {
    if (t < 1) return null;
    const { D } = N, perfectOf = (a, b) => { const cls = mod(D(a) - D(b), 7), s = mod(N.semi(a) - N.semi(b), 12); return (cls === 0 && s === 0) || (cls === 4 && s === 7) ? cls : null; };
    for (let i = 0; i < x.length; i++) for (let j = i + 1; j < x.length; j++) {
      const a = perfectOf(x[i], x[j]), b = perfectOf(p[i], p[j]);
      if (form === "three") { if (a !== null && a === b && x[i] !== p[i] && x[j] !== p[j]) return `parallel ${a === 0 ? "octaves" : "5ths"} between the upper voices`; }
      else if (a !== null && a === b && (x[i] !== p[i] || x[j] !== p[j]) && D(x[i]) - D(p[i]) !== 0) return `parallel ${a === 0 ? "octaves" : "5ths"} between the ${N.names[i]} and the ${N.names[j]}`;
    }
    return null;
  } }),
  /** chord · the same note a semitone apart in two upper voices (an augmented unison or octave). */
  "false-relation": (N) => ({ id: "false-relation", check: ({ x }) => {
    const cls = mod(N.D(x[0]) - N.D(x[1]), 7), s = mod(N.semi(x[0]) - N.semi(x[1]), 12);
    return cls === 0 && s !== 0 ? "a false relation between the upper voices (an augmented octave)" : null;
  } }),
  /** chord · the chord asked (its figures): what it needs, what it allows (four: the bass's octave counted). */
  chord: (N, { form = "three" } = {}) => ({ id: "chord", check: ({ t, x }) => {
    const have = new Set(x.map((c, i) => N.V[i].vertical(t, c).cls));
    if (form === "three") {
      if (!(N.figured && N.B[t].chord)) return null;
      const ch = CHORDS[N.B[t].chord];
      return !ch.need.every((c) => have.has(c)) || ![...have].every((c) => ch.ok.includes(c)) ? `the chord asked is ${N.B[t].chord}` : null;
    }
    const ch = N.asked(t);
    if (!ch) return null;
    const all = new Set([0, ...have]);
    return !ch.need.every((c) => all.has(c)) || ![...have].every((c) => ch.ok.includes(c)) ? `the chord asked is ${N.B[t].chord}` : null;
  } }),
  /** chord · doublings: three parts, not the 3rd nor the leading tone; four, never a dissonance, the 7th or the leading
   *  tone (and a false relation between any two voices). */
  doubling: (N, { form = "three" } = {}) => ({ id: "doubling", check: ({ t, x }) => {
    const { B, D } = N, v = x.map((c, i) => N.V[i].vertical(t, c));
    const ltCount = () => [codeOf3(B[t].d, B[t].r || 0), ...x].filter((c) => N.ltOf(t, c)).length;
    if (form === "three") {
      const have = new Set(v.map((u) => u.cls));
      const chord = N.figured && B[t].chord ? B[t].chord : have.has(5) && have.has(2) ? "6/3" : have.has(5) && have.has(3) ? "6/4" : have.has(1) && have.has(3) ? "4/2" : "5/3";
      const third = THIRD[chord];
      if (third !== null && (third === 0 ? 1 : 0) + v.filter((u) => u.cls === third).length >= 2) return "the 3rd of the chord doubled";
      return ltCount() >= 2 ? "the leading tone doubled" : null;
    }
    const ch = N.asked(t), seventh = ch && ch.seventh !== undefined ? ch.seventh : null, have = new Set(v.map((u) => u.cls));
    for (let i = 0; i < x.length; i++) for (let j = i + 1; j < x.length; j++) {
      if (v[i].cls === v[j].cls && ((v[i].q === "dissonant" && !(v[i].cls === 1 && !B[t].struck)) || v[i].cls === seventh)) return `the ${v[i].cls === seventh ? "7th of the chord" : "dissonance"} doubled`;
      if (v[i].cls === v[j].cls && mod(N.semi(x[i]) - N.semi(x[j]), 12) !== 0) return `a false relation between the ${N.names[i]} and the ${N.names[j]}`;
    }
    if (seventh === 0 && have.has(0)) return "the 7th of the chord doubled (in the bass)";
    return null;
  } }),
  /** chord · the leading tone doubled (four parts: after the 7ths). */
  "leading-tone-doubled": (N) => ({ id: "leading-tone-doubled", check: ({ t, x }) =>
    ([codeOf3(N.B[t].d, N.B[t].r || 0), ...x].filter((c) => N.ltOf(t, c)).length >= 2 ? "the leading tone doubled" : null) }),
  /** chord, line · a 7th chord's 7th: prepared where the chord is not the dominant's; the dominant's held or by step. */
  seventh: (N, { free = false } = {}) => ({ id: "seventh", check: ({ W, t, x }) => {
    const sv = N.sevenths(t);
    if (!sv || sv.cls === 0) return null;
    const v = x.map((c, i) => N.V[i].vertical(t, c));
    if (!sv.dominant)
      for (let i = 0; i < x.length; i++) if (v[i].cls === sv.cls && (t === 0 || W[i][t - 1] !== x[i])) return `the 7th of a chord on ${"①②③④⑤⑥⑦"[mod(N.V[0].locB(t) + ROOT[N.B[t].chord], 7)]} is prepared (the ${N.names[i]})`;
    if (sv.dominant && t >= 1 && !free)
      for (let i = 0; i < x.length; i++) if (v[i].cls === sv.cls && W[i][t - 1] !== x[i] && Math.abs(N.D(x[i]) - N.D(W[i][t - 1])) !== 1) return `the dominant's 7th is held or comes by step (the ${N.names[i]})`;
    return null;
  } }),
  /** progression · the dominant resolved: its leading tone up (an inner voice may fall to ⑤ over ①); the deceptive ⑥
   *  doubles its 3rd. */
  resolution: (N) => ({ id: "resolution", check: ({ t, x, p }) => {
    if (t < 1) return null;
    const { B, D } = N, V0 = N.V[0];
    if (B[t - 1].dominant && B[t].struck && V0.locB(t - 1) === 4 && (V0.locB(t) === 0 || (V0.locB(t) === 5 && B[t - 1].chord === "7")) && N.keys[t].key.tonic === N.keys[t - 1].key.tonic)
      for (let i = 0; i < x.length; i++) if (N.ltOf(t - 1, p[i]) && D(x[i]) !== D(p[i]) + 1 && !(i > 0 && V0.locB(t) === 0 && D(x[i]) === D(p[i]) - 2))
        return `the leading tone goes up to the tonic (the ${N.names[i]}${i > 0 ? "; an inner voice may fall to ⑤ over ①" : ""})`;
    const v = x.map((c, i) => N.V[i].vertical(t, c));
    if (B[t - 1].dominant && B[t].struck && V0.locB(t - 1) === 4 && V0.locB(t) === 5 && (!N.figured || ["5/3", undefined].includes(B[t].chord)) && v.filter((u) => u.cls === 2).length < 2)
      return "the deceptive ⑥ doubles its 3rd";
    return null;
  } }),
  /** chord · in minor the dominant's chord major (its ⑦ raised); four: in the dominant's family too. */
  "dominant-major": (N, { form = "three" } = {}) => ({ id: "dominant-major", check: ({ t, x }) => {
    const { B, K, D, A } = N, kt = N.keys[t].key;
    let on;
    if (form === "three") {
      const have = new Set(x.map((c, i) => N.V[i].vertical(t, c).cls));
      const chord = N.figured && B[t].chord ? B[t].chord : have.has(5) && have.has(2) ? "6/3" : have.has(5) && have.has(3) ? "6/4" : have.has(1) && have.has(3) ? "4/2" : "5/3";
      on = kt.mode === "minor" && B[t].dominant && chord !== "6/3";
    } else {
      const ch = N.asked(t);
      on = kt.mode === "minor" && ((B[t].dominant && B[t].chord !== "6/3") || (ch && ch.seventh !== undefined));
    }
    if (on) for (const c of x) { const l = N.loc(t, c); if (l.deg === 6 && l.alt !== 1) return `the chord on the dominant is major: ${K.name(D(c), A(c) + 1)}, not ${K.name(D(c), A(c))}`; }
    return null;
  } }),
};
// soft rules between the voices: four parts, the bass doubled in a 5/3, a 6/4, a 5/4, a 7/3
export const SOFT_BETWEEN = {
  doubling: (N, { weight = 0.6 } = {}) => ({ id: "doubling", cost: ({ t, x }) => {
    const ch = N.B[t].chord;
    if (!["5/3", "6/4", "5/4", "7/3"].includes(ch) && N.figured) return {};
    const v = x.map((c, i) => N.V[i].vertical(t, c).cls), cnt = {};
    for (const c of [0, ...v]) cnt[c] = (cnt[c] || 0) + 1;
    return Object.entries(cnt).some(([c, k]) => +c !== 0 && k >= 2) ? { doubling: weight } : {};
  } }),
};

// the styles of several voices: partimento.mjs's parts (two upper voices) and four (three), their rules between the
// voices in the order they read them; each voice a style of one voice over the bass
Object.assign(STYLES, {
  "partimento-2": { style: "partimento-2", version: "1.0.0", voice: "partimento-1",
    between: [["order", { form: "three" }], ["imitation"], ["exchange"], ["apart"], ["seconds"], ["six-four"], ["parallels-upper"], ["false-relation"], ["chord"], ["doubling"], ["dominant-major"]],
    softBetween: [] },
  "chorale-4": { style: "chorale-4", version: "1.0.0", voice: "partimento-1",
    between: [["order", { within: 7 }], ["chord", { form: "four" }], ["doubling", { form: "four" }], ["seventh"], ["leading-tone-doubled"], ["seconds", { form: "four" }],
              ["parallels-upper", { form: "four" }], ["resolution"], ["six-four", { form: "four" }], ["dominant-major", { form: "four" }]],
    softBetween: [["doubling"]] },
});

/** The world the rules between the voices read. */
function voicesWorld(K, B, V, names, o) {
  const D = codeDegree, A = codeAlter, semi = (c) => K.semi(D(c), A(c));
  const ltOf = (t, c) => { const kt = V[0].LOC[t].key, l = V[0].loc(t, c); return l.deg === 6 && (kt.mode === "major" ? l.alt === 0 : l.alt === 1); };
  return { K, B, D, A, semi, V, names, ltOf, loc: V[0].loc, keys: V[0].LOC, figured: o.figured, ro: o.ro, asked: o.asked || (() => null), sevenths: o.sevenths || (() => null) };
}

/**
 * Two upper voices over a given bass (partimento.mjs's parts): spec {bass, key, figured, ro, top, middle ([lo, hi]),
 * apart, spacing, line ({top, middle} or one), hold ({top, middle}), imitate ({voice, delay, steps}), end, delayed,
 * weights, style}.
 */
export function partsOverBass(spec = {}) {
  const K = keyOf(spec.key || { tonic: "C" }), B = spec.bass, n = B.length, figured = spec.figured ?? true;
  const st = resolveStyle(typeof spec.style === "object" ? spec.style : STYLES[spec.style || "partimento-2"]);
  const [tlo, thi] = spec.top || [9, 22], [mlo, mhi] = spec.middle || [4, 17];
  const lineOf = (who) => (spec.line && typeof spec.line === "object" ? spec.line[who] : spec.line);
  const holdOf = (who) => (spec.hold && spec.hold[who]) || undefined;
  const S = { bass: B, key: K, figured: false, ro: spec.ro, exchange: true, end: spec.end, weights: spec.weights, delayed: spec.delayed, style: st.voice };
  const T = overBass({ ...S, lo: tlo, hi: thi, voice: "top", spacing: spec.spacing ?? 18, line: lineOf("top"), maxHold: holdOf("top") });
  const M = overBass({ ...S, lo: mlo, hi: mhi, voice: "middle", line: lineOf("middle"), maxHold: holdOf("middle") });
  const N = voicesWorld(K, B, [T.world, M.world], ["top", "middle"], { figured, ro: !!spec.ro });
  const im = spec.imitate || {};
  const params = { imitation: { voice: im.voice ?? null, delay: im.delay, steps: im.steps }, apart: { max: spec.apart ?? 7 } };
  const between = st.between.map(([id, p]) => BETWEEN[id](N, { ...(params[id] || {}), ...(p || {}) }));
  const soft = (st.softBetween || []).map(([id, p]) => SOFT_BETWEEN[id](N, p || {}));
  const SV = solveVoices({ n, voices: [{ name: "top", solver: T }, { name: "middle", solver: M, prefix: "middle/" }], between, soft,
                           result: (W) => ({ top: W[0], middle: W[1] }) });
  /** The chords a realization makes, unit by unit: "6/3", "(5)/3" (a 5/3 without its 5th), "7/3", "4/2"… */
  const chords = (R) => R.top.map((a, t) => {
    const fs = [...new Set([T.vertical(t, a).cls, M.vertical(t, R.middle[t]).cls])].map((c) => FIG[c]).sort((x, y) => y - x);
    if (fs.length === 2 && fs[0] === 8 && fs[1] === 3) return "(5)/3";
    if (fs.length === 1) return fs[0] === 3 ? "(5)/3" : String(fs[0]);
    return fs.filter((f) => f !== 8).join("/") || "8";
  });
  return { ...SV, style: st, key: K, bass: B, top: T, middle: M, chords,
           judge: (R) => (R.top.length !== n || R.middle.length !== n ? `${R.top.length} units, the bass has ${n}` : SV.judgeW([R.top, R.middle], null)),
           count: (TT = [], MM = []) => SV.count([TT, MM]), name: T.name, degree: T.degree };
}

/**
 * Three upper voices over a given bass (partimento.mjs's four): spec {bass, key, figured, ro, soprano / alto / tenor
 * ([lo, hi]), line, end, delayed, weights, freeSevenths, style}.
 */
export function fourOverBass(spec = {}) {
  const K = keyOf(spec.key || { tonic: "C" }), B = spec.bass, n = B.length, figured = spec.figured ?? true;
  const st = resolveStyle(typeof spec.style === "object" ? spec.style : STYLES[spec.style || "chorale-4"]);
  const asked = (t) => (figured && B[t].chord ? CHORDS4[B[t].chord] : null);
  let locB0 = null;
  const sevenths = (t) => {
    const ch = asked(t);
    if (!ch || ch.seventh === undefined || ROOT[B[t].chord] === undefined) return null;
    return { cls: ch.seventh, dominant: mod(locB0(t) + ROOT[B[t].chord], 7) === 4 };
  };
  const free = (t) => {
    const ch = asked(t);
    if (!ch || !(ch.free || ch.seventh !== undefined)) return null;
    const sv = sevenths(t), cls = sv && !sv.dominant ? (ch.free || []).filter((c) => c !== ch.seventh) : ch.free || [];
    return { cls, seventh: ch.seventh, up: ch.up, tri: !!ch.tri };
  };
  const S0 = { bass: B, key: K, figured: false, ro: spec.ro ?? true, exchange: true, end: spec.end, free, weights: spec.weights, delayed: spec.delayed, style: st.voice };
  const lineOf = (who) => (spec.line && typeof spec.line === "object" ? spec.line[who] : spec.line);
  const [slo, shi] = spec.soprano || [9, 20], [alo, ahi] = spec.alto || [6, 17], [tlo, thi] = spec.tenor || [3, 14];
  const Sv = overBass({ ...S0, lo: slo, hi: shi, voice: "top", spacing: 22, line: lineOf("soprano"), maxHold: 3 });
  const Av = overBass({ ...S0, lo: alo, hi: ahi, voice: "middle", spacing: 22, line: lineOf("alto"), turn: false, maxHold: n });
  const Tv = overBass({ ...S0, lo: tlo, hi: thi, voice: "middle", spacing: 22, line: lineOf("tenor"), turn: false, maxHold: n });
  locB0 = Sv.world.locB;
  const NAMES = ["soprano", "alto", "tenor"];
  const N = voicesWorld(K, B, [Sv.world, Av.world, Tv.world], NAMES, { figured, ro: spec.ro ?? true, asked, sevenths });
  const params = { seventh: { free: !!spec.freeSevenths } };
  const between = st.between.map(([id, p]) => BETWEEN[id](N, { ...(params[id] || {}), ...(p || {}) }));
  const W = { doubling: 0.6, ...(spec.weights || {}) };
  const soft = (st.softBetween || []).map(([id, p]) => SOFT_BETWEEN[id](N, { weight: W.doubling, ...(p || {}) }));
  const D = codeDegree;
  // (the order of the voices and their octave, at once: as partimento.mjs's triples)
  const quick = (_W, _t, x) => x.length < 2 || !(D(x[x.length - 1]) >= D(x[x.length - 2]) || D(x[x.length - 2]) - D(x[x.length - 1]) > 7);
  const SV = solveVoices({ n, voices: [{ name: "soprano", solver: Sv }, { name: "alto", solver: Av, prefix: "alto/", weight: 0.6 }, { name: "tenor", solver: Tv, prefix: "tenor/", weight: 0.6 }],
                           between, soft, quick, result: (W_) => ({ soprano: W_[0], alto: W_[1], tenor: W_[2] }) });
  /** The chords a realization makes, unit by unit, as figures ("6/4/3", "(5)/3"…). */
  const chords = (R) => {
    const W_ = [R.soprano, R.alto, R.tenor], V = [Sv, Av, Tv];
    return W_[0].map((_, t) => {
      const fs = [...new Set(W_.map((U, i) => V[i].vertical(t, U[t]).cls))].map((c) => FIG[c]).filter((f) => f !== 8).sort((a, b) => b - a);
      if (!fs.length) return "8";
      if (fs.length === 1 && fs[0] === 3) return "(5)/3";
      if (fs[0] === 7 && fs.includes(3) && fs.every((f) => [7, 5, 3].includes(f))) return "7";
      return fs.join("/");
    });
  };
  return { ...SV, style: st, key: K, bass: B, voices: [Sv, Av, Tv], soprano: Sv, alto: Av, tenor: Tv, chords,
           judge: (R) => SV.judgeW([R.soprano, R.alto, R.tenor], `the voices are not ${n} units long`), name: Sv.name, degree: Sv.degree };
}

// ─────────────────────────────── from a tree: a bass given as notes (the cac box, discussion #323) ───────────────────────────────
/** The bass's units from notes [{midi, units, fig (a figuring: "6/5"), key, strong: [one a unit]}] in K. */
export function bassFromNotes(notes, K, voices = 4, fill = false) {
  const table = voices >= 4 ? CHORDS4 : CHORDS, units = [], unknown = [];
  const drs = notes.map((nt) => degreeOf(K, nt.midi));
  notes.forEach((nt, i) => {
    const dr = drs[i];
    if (!dr) throw new Error(`note ${i + 1}: not a pitch of ${K.tonic} ${K.mode}`);
    const next = notes[i + 1] && drs[i + 1];
    // (fill: a note without figures takes the chord a partimento player would — the Rule of the Octave's)
    const filled = !nt.fig && fill && drs.every(Boolean) ? octaveDefault(K, notes, drs, i, voices) : null;
    // (fewer than four parts: a chord of four tones as three can sound it — the RO's 6/3 for its 6/5 and 6/4/3, 7/3 for 7)
    const fig0 = nt.fig ? String(nt.fig).replace(/\s+/g, "") : filled;
    const fig = fig0 && voices < 4 ? ({ "6/5": "6/3", "6/5/3": "6/3", "6/4/3": "6/3", "7": "7/3", "7/5/3": "7/3", "6/4/2": "4/2" }[fig0] || fig0) : fig0;
    const chord = fig && table[fig] ? fig : fig && table[fig + "/3"] ? fig + "/3" : null;
    if (fig && !chord) unknown.push(`note ${i + 1}: ${fig}`);
    const key = parseKey(nt.key);
    for (let j = 0; j < Math.max(1, nt.units || 1); j++)
      units.push({ d: dr.d, r: dr.r, struck: j === 0, strong: nt.strong ? !!nt.strong[j] : units.length % 2 === 0, chord, key,
                   fig: voices === 2 && chord ? CHORDS[chord] && chord.split("/").map(Number) : undefined, note: i,
                   dominant: mod(dr.d, 7) === 4 && (!next || isDominant(dr.d, next.d)) });
  });
  return { units, unknown };
}

// the Rule of the Octave (chapters 4 and 6): a chord for each degree of the scale in the bass, going up and going down
// (the plain one: the descending ⑥ as a 6/3, without the key of ⑤ it would tonicize)
export const RULE_OF_THE_OCTAVE = {
  3: { up: ["5/3", "6/3", "6/3", "6/3", "5/3", "6/3", "6/3"], down: ["5/3", "6/3", "6/3", "4/2", "5/3", "6/3", "6/3"] },
  4: { up: ["5/3", "6/4/3", "6/3", "6/5", "5/3", "6/3", "6/5"], down: ["5/3", "6/4/3", "6/3", "4/2", "5/3", "6/3", "6/3"] },
};
/** The chord a partimento player takes over a note without figures: the Rule of the Octave's where the bass moves by
 *  step through it (its direction: to the next note, else from the one before), a 5/3 where it leaps (a 6/3 on ⑦), and
 *  a 5/3 at the start and the end. */
export function octaveDefault(K, notes, drs, i, voices = 4) {
  const n = notes.length, lo = (j) => localOf(K, parseKey(notes[j].key));
  const deg = localNote(K, lo(i), drs[i].d, drs[i].r).deg;
  if (i === 0 || i === n - 1) return "5/3";
  const step = (a, b) => Math.abs(drs[b].d - drs[a].d) === 1 ? Math.sign(drs[b].d - drs[a].d) : 0;
  const dir = step(i, i + 1) || step(i - 1, i);
  if (!dir) return deg === 6 ? "6/3" : "5/3";
  const RO = RULE_OF_THE_OCTAVE[voices >= 4 ? 4 : 3][dir > 0 ? "up" : "down"][deg];
  // (the 4/2 on the descending ④ passes from ⑤: only where the bass comes down to it from ⑤)
  return RO === "4/2" && !(i >= 1 && step(i - 1, i) === -1) ? "6/3" : RO;
}

/**
 * The voices over a bass given as notes: spec {notes (bassFromNotes's), key (a name, "a minor", or {tonic, mode}; else
 * guessed), voices (2, 3 or 4: the bass and the upper voices), ro (chapter 4's rules: true), style}. Its count, sample,
 * engine, judge, chords; midi, code and spell (a code as a tree writes it).
 */
export function fromNotes(spec = {}) {
  const key = parseKey(spec.key) || guessKey(spec.notes.map((n) => n.midi));
  const K = keyOf(key), voices = spec.voices || 4;
  // (fill: the notes without figures take the Rule of the Octave's chords — as cac partimento writes; a judgement reads
  // the chords the voices make instead)
  const { units, unknown } = bassFromNotes(spec.notes, K, voices, !!spec.fill);
  const figured = units.some((u) => u.chord);
  const ro = spec.ro ?? true;
  const make = (bass, fig) => (voices >= 4 ? fourOverBass({ key, bass, figured: fig, ro, style: spec.style })
    : voices === 3 ? partsOverBass({ key, bass, figured: fig, ro, style: spec.style })
    : overBass({ key, bass, figured: fig, ro, voice: "top", lo: 7, hi: 21, style: spec.style }));
  const P = make(units, figured);
  const names = voices >= 4 ? ["soprano", "alto", "tenor"] : voices === 3 ? ["top", "middle"] : ["top"];
  const asVoices = (R) => (R === null || R === undefined ? null : voices === 2 ? { top: R } : R);
  const midi = (c) => K.midi(codeDegree(c), codeAlter(c));
  const code = (m) => { const dr = degreeOf(K, m); return dr ? codeOf3(dr.d, dr.r) : null; };
  const V0 = voices >= 4 ? P.soprano : voices === 3 ? P.top : P;
  // (a code's name as a tree writes it: "bb4", "f#3")
  const spell = (c) => K.name(codeDegree(c), codeAlter(c)).replace("𝄫", "bb").replace("𝄪", "##").replace("♭", "b").replace("♯", "#").replace(/^[A-G]/, (x) => x.toLowerCase());
  // judged without figures, voices are read with the chords they make: those of four tones (the dominant's family,
  // the 6/5) asked of them — so their dissonances are the semi-consonances they are
  function judgeOf(R) {
    if (figured || voices < 4) return voices === 2 ? P.judge(R.top) : P.judge(R);
    const NAME = { "6/5/3": "6/5", "6/4/3": "6/4/3", "6/4/2": "4/2", "7": "7" };
    const made = P.chords(R);
    return make(units.map((u, t) => ({ ...u, chord: NAME[made[t]] || null })), true).judge(R);
  }
  // the count within ms milliseconds, or null when it would take longer (what it counted is kept: ask again to go on)
  const countWithin = (ms) => { try { return within(ms, () => P.count()); } catch (e) { if (e.tooLong) return null; throw e; } };
  return { key, K, units, unknown, figured, voices, names, P, midi, code, spell, degAt: (t) => V0.world.locB(t),
           count: () => P.count(), countWithin, search: (o) => asVoices(P.search(o)),
           engine: (o) => asVoices(P.engine(o)), sample: (r) => asVoices(P.sample(r)),
           judge: judgeOf, chords: (R) => (P.chords ? P.chords(R) : null) };
}

// (a box loads the module's default export: api/import-module)
export default { within, TooLong, solve, solveVoices, overBass, partsOverBass, fourOverBass, fromNotes, bassFromNotes, degreeOf, parseKey, guessKey, keyOf,
                 RULES, SOFT_RULES, BETWEEN, SOFT_BETWEEN, STYLES, resolveStyle, CHORDS, CHORDS4, RULE_OF_THE_OCTAVE, octaveDefault };
