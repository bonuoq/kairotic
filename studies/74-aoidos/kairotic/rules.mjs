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

import { mod, sign, keyOf, codeOf3, codeDegree, codeAlter, localOf, localNote, FIG_CLASS, CLASS_FIG, isDominant, degreeOf, degreeIn, codeOf, parseKey, guessKey } from "./tonal.mjs";
import { melodicParts, verticalParts, total, choose, temperature, defaultWeights } from "./soft.mjs";
import { functionOf, grammarErrors } from "./functions.mjs";

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
  // (a unit's chroma: [degree alteration] its chord may take — [degree alteration true]: must take, the degree's own
  // note out; natural: in minor the natural scale, ⑥ and ⑦ not raised — a sequence's, chapter 7)
  const inKey = (t, c) => {
    const l = loc(t, c), ch = B[t].chroma;
    if (ch && ch.some(([d, a, only]) => only && l.deg === d && l.alt !== a)) return false;
    return l.alt === 0 || (l.alt === 1 && LOC[t].key.mode === "minor" && l.deg >= 5 && !B[t].natural) || (l.alt !== 0 && l.alt === LOC[t].key.ficta(l.deg)) || !!(ch && ch.some(([d, a]) => l.deg === d && l.alt === a));
  };
  const strong = (t) => (B[t] && B[t].strong !== undefined ? B[t].strong : (t + phase) % 2 === 0);
  function vertical(t, c) {
    const steps = D(c) - B[t].d, cls = mod(steps, 7), s = mod(semiU(c) - semiB(t), 12);
    const q = cls === 0 ? (s === 0 ? "perfect" : "dissonant") : cls === 4 ? (s === 7 ? "perfect" : "dissonant")
            : cls === 2 ? (s === 3 || s === 4 ? "imperfect" : "dissonant") : cls === 5 ? (s === 8 || s === 9 ? "imperfect" : "dissonant") : "dissonant";
    const tri = s === 6 ? (cls === 3 ? "A4" : cls === 4 ? "d5" : null) : null;
    return { steps, cls, q, tri, semis: s };
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
   *  raised 3rd only in a chord on the final; a unit's chromatic tones). */
  scale: (w) => ({ id: "scale", lookback: 0,
    check: ({ t, c }) => {
      if (!w.inKey(t, c)) return `not a note of ${w.LOC[t].key.tonic} ${w.LOC[t].key.mode}`;
      const l = w.loc(t, c);
      return l.alt !== 0 && t < w.n - 1 && w.locB(t) !== 0 && w.LOC[t].key.fictaAtEnd(l.deg) ? `${w.K.name(w.D(c), w.A(c))} only in a chord on the final (musica ficta: the final's 3rd raised)` : null;
    } }),

  /** vertical · above the bass, not on its note but at the end (unison: "any", anywhere: Fux's), not too far from it. */
  "from-bass": (w, { spacing = 16, unison = "end" } = {}) => ({ id: "from-bass", lookback: 0,
    // (a unison a semitone under the bass — the bass's letter, lowered — is under it: D over D♯)
    check: ({ t, v }) => (v.steps < 0 || (v.steps === 0 && v.semis > 6) ? "below the bass" : v.steps === 0 && t < w.n - 1 && unison !== "any" ? "the unison with the bass (only at the end)" : v.steps > spacing ? "too far from the bass" : null) }),

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
  intervals: (w, { chromatic = false } = {}) => ({ id: "intervals", lookback: 1,
    check: ({ t, c, prev, struck }) => {
      if (!struck || prev === null) return null;
      const { D, semiU, LOC, loc } = w, nn = w.n, a = prev, b = c;
      const d = Math.abs(D(b) - D(a)), s = Math.abs(semiU(b) - semiU(a));
      if (d === 0) return chromatic || (t >= 1 && LOC[t].key !== LOC[t - 1].key && LOC[t].key.tonic !== LOC[t - 1].key.tonic) ? null : "a chromatic step";
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

  /** line · a church mode's musica ficta: a raised note leads up by step (C♯ to D; a lowered one, B♭, goes either way,
   *  as Fux's do); at the last cadence the leading tone raised where the mode raises it. */
  ficta: (w) => ({ id: "ficta", lookback: 1,
    check: ({ t, c, prev, struck }) => {
      if (!struck || prev === null) return null;
      const { K, D, A, LOC } = w, step = D(c) - D(prev), lp = w.loc(t - 1, prev), lc = w.loc(t, c), f = LOC[t - 1].key.ficta(lp.deg);
      if (f > 0 && lp.alt === f && step !== 1) return `${K.name(D(prev), A(prev))} goes up by step (musica ficta)`;
      // (to a degree the mode raises too, raised: the aeolian's F♯ to G♯)
      if (f > 0 && lp.alt === f && step === 1 && LOC[t].key.ficta(lc.deg) > 0 && !LOC[t].key.fictaAtEnd(lc.deg) && lc.alt === 0)
        return `${K.name(D(prev), A(prev))} goes on up to ${K.name(D(c), A(c) + 1)} (musica ficta)`;
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
  dissonance: (w, { ro = false, exchange = false, free = () => null, overStruck = false, neighbour = false, weakHeld = false, bachSevenths = false } = {}) => {
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
        // (a 7th chord's 7th held over from the chord before into a weak unit — the alto's suspensions in Fifth Down
        // Fourth Up, ex. 7.12a: "inevitably on the weak beat" —; it goes down by step after, as every 7th)
        const f = free(t);
        if (B[t].struck && held && f && f.seventh === v.cls && t >= 1 && consonant(vertical(t - 1, prev))) return null;
        // (weakHeld: Bach's — any note held from a consonance becomes a dissonance as the bass moves under it on a weak
        // unit; it goes down by step after)
        if (weakHeld && B[t].struck && held && t >= 1 && consonant(vertical(t - 1, prev))) return null;
        // (overStruck: Bach's — a passing tone against a bass that moves too, by step from a consonance and on by step)
        if (B[t].struck && !overStruck) return "a dissonance on a weak unit: over a held bass";
        if (!struck || t === 0 || Math.abs(D(c) - D(prev)) !== 1) return "a dissonance on a weak unit passes by step";
        if (!consonant(vertical(t - 1, prev))) return "two dissonances in a row";
      }
      return null;
    }
    return { id: "dissonance", lookback: 2, check: ({ U, t, c, v, prev, held, struck, delayed }) => {
      // what the unit before asks
      const fp = t >= 1 ? free(t - 1) : null, pv0 = t >= 1 ? vertical(t - 1, prev) : null;
      // (bachSevenths: Bach's — the 7th held while the bass moves under it into a consonance, to its note or up a step;
      // or up by step where the bass takes the note it would have gone down to, V4/3 → I6; or anywhere, the bass taking
      // the 7th itself — the 7th passed into the bass)
      const bach7 = bachSevenths && ((held && consonant(v)) || (B[t].struck && ((struck && D(c) === D(prev) + 1 && mod(B[t].d - (D(prev) - 1), 7) === 0) || mod(B[t].d - D(prev), 7) === 0)));
      if (fp && fp.seventh === pv0.cls && !(held && !B[t].struck) && !(struck && D(c) === D(prev) - 1) && !(held && v.cls === 3 && v.q === "dissonant") && !bach7)
        return "the 7th of the chord goes down by step";
      if (fp && fp.up === pv0.cls && pv0.q === "dissonant" && !(held && !B[t].struck) && !(struck && D(c) === D(prev) + 1))
        return "the augmented 6th goes up by step";
      // (chapter 7: in the diminished 7th's family a tritone is free too where it is the chord's 7th — which goes down
      // by step, whatever it meets over the next bass, ex. 7.9b — or where it is held and the bass moves on, ex. 7.9e)
      const dimFree = !!(fp && fp.family === "diminished" && pv0 && (pv0.cls === fp.seventh || (held && B[t].struck)));
      const freeBefore = !!(fp && !consonant(pv0) && fp.cls.includes(pv0.cls) && (!pv0.tri || fp.tri || dimFree));
      // (a 7th held into a weak unit — a suspension there, ex. 7.12a — goes down by step, as above; not a passing tone)
      const heldSeventh = !!(fp && pv0 && fp.seventh === pv0.cls && t >= 2 && !strong(t - 1) && B[t - 1].struck && U[t - 2] === prev);
      if (t >= 1 && !delayed && !freeBefore && !heldSeventh) {
        const pv = pv0;
        let special = false, ok4 = false;
        if (ro && !consonant(pv)) {
          const pp = t >= 2 ? U[t - 2] : null;
          const pdel = w.delayedOn && pp !== null && prev === pp && B[t - 1].struck && strong(t - 1) && t >= 2 && strong(t - 2) &&
                       vertical(t - 2, pp).q === "dissonant" && vertical(t - 2, pp).cls === 6 && pv.cls === 3;
          special = entry(t - 1, prev, pp, pdel) !== null;
          // (in a sequence — a unit's sequence: chapter 7 — the diminished triad on ⑦ or ② is taken for the pattern's
          // sake: its tritone goes on by step the way it leans, into whatever consonance the next bass makes)
          const seqOk = !!(B[t - 1].sequence && pv.tri && struck && consonant(v) && D(c) === D(prev) + (pv.tri === "A4" ? 1 : -1));
          const semiOk = seqOk || (pv.tri && struck && ((pv.tri === "A4" && D(c) === D(prev) + 1 && v.cls === 5) || (pv.tri === "d5" && D(c) === D(prev) - 1 && v.cls === 2)));
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
            // (neighbour: Bach's — the tone back where it came from, a neighbour note)
            const a = U[w.onsetOf(U, t - 1) - 1];
            if (weakHeld && t >= 2 && U[t - 2] === prev && B[t - 1].struck) { if (!(struck && D(c) === D(prev) - 1)) return "the note held into a dissonance goes down by step"; }
            else if (!(struck && (D(c) - D(prev) === D(prev) - D(a) || (neighbour && c === a)))) return neighbour ? "the passing tone goes on by step (the same way, or back: a neighbour)" : "the passing tone goes on by step, the same way";
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

  /** vertical, pair · the comes's invertible counterpoint, over a bass: the voice and the bass must stand inversion at
   *  the octave, the 10th or the 12th (at: 8, 10, 12; the bass taken up at − 1 steps, above the voice; compound: a
   *  compound interval read as its simple one, the octaves free, as double counterpoint has it — false: never wider
   *  apart than the inversion, as the comes asks) — no consonance turned into a dissonance (at the octave a 5th becomes a 4th), no parallel perfect
   *  intervals once inverted. Not in the styles until one names it. */
  invertible: (w, { at = 8, compound = true } = {}) => {
    const name = at === 8 ? "octave" : at + "th";
    const inverted = (t, c) => {
      const steps = (at - 1) - (w.D(c) - w.B[t].d), cls = mod(steps, 7), s = mod(w.K.semi(w.B[t].d + at - 1, w.B[t].r || 0) - w.semiU(c), 12);
      const q = cls === 0 ? (s === 0 ? "perfect" : "dissonant") : cls === 4 ? (s === 7 ? "perfect" : "dissonant")
              : cls === 2 ? (s === 3 || s === 4 ? "imperfect" : "dissonant") : cls === 5 ? (s === 8 || s === 9 ? "imperfect" : "dissonant") : "dissonant";
      return { steps, cls, q };
    };
    return { id: "invertible", lookback: 1, check: ({ t, c, v, prev, struck }) => {
      if (!compound && v.steps > at - 1) return `under inversion at the ${name}: wider than the ${name}`;
      const iv = inverted(t, c);
      if (iv.q === "dissonant" && v.q !== "dissonant") return `under inversion at the ${name}: a consonance turned dissonant`;
      if (t >= 1 && prev !== null && iv.q === "perfect" && (struck || w.B[t].struck)) {
        const pv = inverted(t - 1, prev);
        if (pv.q === "perfect" && pv.cls === iv.cls && (prev !== c || w.B[t].d !== w.B[t - 1].d)) return `under inversion at the ${name}: parallel ${iv.cls === 0 ? "octaves" : "5ths"}`;
      }
      return null;
    } };
  },

  /** pair · no parallel 5ths or octaves with the bass, no direct ones with the upper voice leaping (direct: "outer",
   *  only between the outer voices; "none", as Fux in three and four parts); structural: not from the strong unit before
   *  either, under a diminution. */
  parallels: (w, { structural = true, direct = "all", middle = false } = {}) => ({ id: "parallels", lookback: 3,
    check: ({ U, t, c, v, prev, struck }) => {
      const { B, D } = w;
      if (t >= 1 && v.q === "perfect" && struck && B[t].struck) {
        const pv = w.vertical(t - 1, prev), bm = B[t].d - B[t - 1].d, um = D(c) - D(prev);
        if (pv.q === "perfect" && pv.cls === v.cls && (bm !== 0 || um !== 0)) return `parallel ${v.cls === 0 ? "octaves" : "5ths"}`;
        if (direct !== "none" && !(direct === "outer" && middle) && sign(bm) === sign(um) && bm !== 0 && Math.abs(um) > 1) return `${v.cls === 0 ? "an octave" : "a 5th"} by direct motion, the upper voice leaping`;
      }
      if (structural && structuralParallels(w, U, t, c)) return `parallel ${v.cls === 0 ? "octaves" : "5ths"} from the strong unit before, under the diminution`;
      return null;
    } }),

  /** edge · over ① the upper voice starts on an octave, 5th or 3rd; it ends on an octave or a 3rd (or the 6th over ③),
   *  reached by step (ends: [0, 2, 4], the 5th too, as Fux's top voice in four parts, reached by leap if need be). middle: an inner voice, free; end false: the phrase goes on. */
  edges: (w, { middle = false, end = true, figured = true, ends = [0, 2] } = {}) => ({ id: "edges", lookback: 1,
    check: ({ t, c, v, prev }) => {
      if (middle) return null;
      if (t === 0 && !(figured && w.B[0].fig) && w.locB(0) === 0 && ![0, 2, 4].includes(v.cls)) return "over ① the upper voice starts on an octave, a 5th or a 3rd";
      if (t === w.n - 1 && end !== false) {
        if (!ends.includes(v.cls) && !(v.cls === 5 && w.locB(t) === 2)) return ends.includes(4) ? "it ends on an octave, a 5th or a 3rd" : "it ends on an octave or a 3rd";
        if (prev !== null && Math.abs(w.D(c) - w.D(prev)) !== 1 && !(v.cls === 4 && ends.includes(4))) return "the last note is reached by step";
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

// (Bach's alto and tenor in the chorales: how much a move of 0, 1 … 12, 13+ semitones costs, −log of its frequency
// against the note kept — 31.3%, 16.0%, 23.2%, 10.0%, 8.6%, 7.0%, 0.4%, 2.6%, 0.3%, 0.2%, 0.1%, 0.0%, 0.2%, 0.0%)
export const BACH_INNER_MOTION = [0, 0.67, 0.3, 1.14, 1.29, 1.5, 4.36, 2.48, 4.65, 5.02, 5.97, 9.19, 5.15, 8.5];
// (and what they sound against the bass: an interval of 0 … 11 semitones above it, −log of its frequency against the
// commonest, the 5th — 21.5%, 0.4%, 2.9%, 17.0%, 17.3%, 3.4%, 1.9%, 22.3%, 6.7%, 4.2%, 2.1%, 0.3%: a semitone's clash
// with the bass, the ♭9 or the major 7th, is the rarest)
export const BACH_INNER_VERTICAL = [0.04, 4.13, 2.05, 0.27, 0.25, 1.89, 2.45, 0, 1.2, 1.68, 2.37, 4.17];
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
  /** a move as often as Bach makes it: an inner voice's move from the note before, by its size in semitones (0 the
   *  note kept, 13 more than an octave), costs −log of how often his alto and tenor make it in the chorales against
   *  the commonest (the note kept) — 31,338 moves of the 2,272 phrases (tests/chorales.mjs reads them again). table:
   *  another voice's, or another corpus's. bach-4 1.4.0. */
  "bach-motion": (w, { W, table = BACH_INNER_MOTION }) => ({ id: "bach-motion", cost: ({ U, t, c }) => {
    if (t < 1) return {};
    const d = Math.min(table.length - 1, Math.abs(w.semiU(c) - w.semiU(U[t - 1])));
    return { "bach-motion": table[d] * (W["bach-motion"] ?? 1) };
  } }),
  /** a vertical as often as Bach sounds it: an inner voice's interval above the bass, in semitones (its class), costs
   *  −log of how often his alto and tenor sound it in the chorales against the commonest (the 5th) — 35,882 notes:
   *  the dissonances as rare as his, a semitone's clash rarest. bach-4 1.6.0. */
  "bach-vertical": (w, { W, table = BACH_INNER_VERTICAL }) => ({ id: "bach-vertical", cost: ({ t, c }) => ({ "bach-vertical": table[w.vertical(t, c).semis] * (W["bach-vertical"] ?? 1) }) }),
  /** minor's raised ⑥ (the melodic minor's) as seldom as Bach writes it in an inner voice: it costs weight, more where
   *  it does not go on up by step (read on the note after it). bach-4 1.6.0. */
  "raised-sixth": (w, { W }) => ({ id: "raised-sixth", lookback: 1, cost: ({ U, t, c }) => {
    const wt = W["raised-sixth"] ?? 1, minor = (u) => w.LOC[u].key.mode === "minor";
    let cost = 0;
    if (minor(t)) { const l = w.loc(t, c); if (l.deg === 5 && l.alt === 1) cost += wt; }
    if (t >= 1 && minor(t - 1)) { const p = U[t - 1], l = w.loc(t - 1, p); if (l.deg === 5 && l.alt === 1 && !(w.D(c) === w.D(p) + 1)) cost += wt; }
    return cost ? { "raised-sixth": cost } : {};
  } }),
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
// A style: {style, version, parts (the bass and the upper voices it writes), extends (a name, or [name version]),
// rules: [[id params]…], soft: [[id params]…], weights, and for several voices voice (the style of each: a name or a
// style), between: [[id params]…], softBetween}. A style that extends another takes its rules in their order; a rule
// named again replaces it (its parameters merged), [id false] removes it, a new one goes at the end; its weights are
// merged; its voice, if it has one, extends the parent's (a style without its own extends). Written in EDN
// ({:style :my-chorale :extends [:chorale-4 "1.0.0"] :between [[:seventh {:free true}]]}), it comes here as the data
// clj->js makes of it: keywords as strings.
const semver = (v) => String(v || "0.0.0").split(".").map((x) => parseInt(x, 10) || 0);
export function resolveStyle(style, library = STYLES) {
  if (typeof style === "string") {
    if (!library[style]) throw new Error(`no such style: ${style} (there are ${Object.keys(library).join(", ")})`);
    return resolveStyle(library[style], library);
  }
  // (the canon's voices, dux and comes, have rule lists of their own; a rule taken twice — the canon's resolution, of
  // the dux and of the comes — is told apart by what it is of)
  const lists = ["rules", "soft", "between", "softBetween", "dux", "comes"];
  const own = Object.fromEntries(lists.map((k) => [k, (style[k] || []).map((r) => (Array.isArray(r) ? [r[0], r[1] ?? undefined] : [r, undefined]))]));
  if (!style.extends) return { ...style, ...own, weights: { ...(style.weights || {}) } };
  // (the parent: a name, [name version], or a style itself — a voice that extends its parent's voice)
  const inline = typeof style.extends === "object" && !Array.isArray(style.extends);
  const [pname, pver] = inline ? [style.extends.style, null] : Array.isArray(style.extends) ? style.extends : [style.extends, null];
  if (!inline && !library[pname]) throw new Error(`no such style: ${pname} (there are ${Object.keys(library).join(", ")})`);
  const parent = resolveStyle(inline ? style.extends : library[pname], library);
  // (a version asked of the parent: the same major, its minor at least — a change that counts otherwise raises it)
  if (pver) {
    const [a, b] = semver(parent.version), [x, y] = semver(pver);
    if (a !== x || b < y) throw new Error(`${style.style || "a style"} extends ${pname} ${pver}, but ${pname} is ${parent.version}`);
  }
  const ident = (id, p) => id + (p && typeof p === "object" && p.of ? ":" + p.of : "");
  const merge = (base = [], mine = []) => {
    const out = base.map(([id, p]) => [id, p]);
    for (const [id, p] of mine) {
      const i = out.findIndex(([x, q]) => ident(x, q) === ident(id, p));
      if (p === false) { if (i >= 0) out.splice(i, 1); }
      else if (i >= 0) out[i] = [id, { ...(out[i][1] || {}), ...(p || {}) }];
      else out.push([id, p]);
    }
    return out;
  };
  const voice = style.voice === undefined ? parent.voice
    : typeof style.voice === "object" && !style.voice.extends && parent.voice ? { ...style.voice, extends: parent.voice } : style.voice;
  const out = { ...parent, ...style, voice, extends: pname, weights: { ...parent.weights, ...(style.weights || {}) } };
  for (const k of lists) out[k] = merge(parent[k], own[k]);
  return out;
}

/** A style written as data (EDN, through clj->js) checked: its rules exist where it names them, its voice is a style.
 *  Returns the style resolved, or throws saying what is wrong. */
export function checkStyle(style, library = STYLES) {
  const st = resolveStyle(style, library);
  // (the catalogues a style's engine reads: over a bass, the partimento's; the canon's its own, canon.mjs registering
  // them when it is loaded)
  const known = CATALOGUES[st.engine || "bass"];
  if (!known) throw new Error(`${st.style || "the style"}: its engine, ${st.engine}, is not loaded (${st.engine}.mjs)`);
  for (const [k, cat] of Object.entries(known))
    for (const [id] of st[k] || []) if (!cat[id]) throw new Error(`${st.style || "the style"}: no rule ${id} in ${k} (there are ${Object.keys(cat).join(", ")})`);
  if (st.voice) checkStyle(st.voice, library);
  if (!st.voice && !st.engine && (st.between || []).length) throw new Error(`${st.style || "the style"}: rules between voices, but no voice style`);
  return st;
}
/** The catalogues of rules each engine reads, by the name a style gives it (:engine; over a bass by default). */
export const CATALOGUES = {};

/** Defines a style by its name (from then on it may be named, and extended), checked; returns it resolved. */
export function defineStyle(style, library = STYLES) {
  if (!style || !style.style) throw new Error("a style needs a name: {:style :my-style …}");
  const st = checkStyle(style, library);
  library[style.style] = { version: "0.1.0", ...style };
  return st;
}

/** How many parts a style writes: its own parts, the parent's, else by its kind (a voice over a bass: 2). */
export function partsOf(style, library = STYLES) {
  const st = resolveStyle(style, library);
  return st.parts || (st.voice ? null : 2);
}

export const STYLES = {
  // partimento.mjs's schemata: one voice over a given bass (Studies 51–59), in the order its check reads them
  "partimento-1": { style: "partimento-1", version: "1.0.0", parts: 2,
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
    dissonance: { ro, exchange: !!spec.exchange, free }, parallels: { structural: spec.structural !== false, middle },
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
 * voices), soft [{id, cost (X)}], window, key (W, t) → the memo's key (a window of its own for each voice: the canon's),
 * result (W) → a realization}.
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
  // the memo's key: the last units the rules look back at — window of them, and further back to where a note held at
  // the end began, and the note before it (the hold's length, a passing tone's way, which the rules read): two states
  // the same there have the same futures
  const keyOf = (W, t) => t + ":" + W.map((U) => {
    let j = t - 1;
    while (j > 0 && U[j - 1] === U[t - 1]) j--;
    return U.slice(Math.max(0, Math.min(t - window, j - 1))).join(",");
  }).join("|");
  const memo = new Map();
  function countFrom(W) {
    const t = W[0].length;
    if (t >= n) return 1n;
    tick();
    const key = spec.key ? spec.key(W, t) : keyOf(W, t);
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
                            key: (t) => (spec.key ? spec.key(W, t) : keyOf(W, t)), temp, r, ms });
    return ok ? result(W) : null;
  }
  return { n, voices, between, check, tuples, count, search, fan, sample, engine, judgeW, memo };
}

// ─── the catalogue: rules between the voices (context: pair, chord, progression, given) ───
// A rule between voices: (world N, params) → {id, check (X)}. N: {K, B, D, A, semi, V (each voice's world), names,
// asked (t) (the chord asked at t), sevenths (t), figured, ro, ltOf (t, c), loc (t, c), keys}.
export const BETWEEN = {
  /** chord · a church mode's chords (Fux; the 17th century's rule for the tones): a consonant chord over every bass
   *  note, a 5/3 or a 6/3 (its 5th or 6th may be left out, never both: no 6/5, no 6/4); a 5/3 only where its 5th is
   *  perfect; the bass falling by step to the last note under a 6/3 (the cadence's 6th going to the octave); the last
   *  chord without a 6th. */
  modal: (N) => ({ id: "modal", check: ({ t, x }) => {
    const v = x.map((c, i) => N.V[i].vertical(t, c)), have = new Set(v.map((u) => u.cls)), n = N.B.length;
    if (v.some((u) => u.q === "dissonant")) return "a dissonance in the chord (note against note, every chord consonant)";
    if (have.has(4) && have.has(5)) return "a 6/5: a 5th and a 6th together";
    if (have.has(3)) return "a 4th above the bass";
    if (t === n - 1 && have.has(5)) return "the last chord without a 6th";
    if (t === n - 2 && N.B[n - 1].d === N.B[t].d - 1 && !have.has(5)) return "the bass falls by step to the last note: a 6/3 over it (the cadence's 6th to the octave)";
    return null;
  } }),
  /** pair · no voice under the one above it (cross: they may cross, as Fux's do); within (four parts): neighbours within
   *  an octave, pair by pair. */
  order: (N, { within = null, form = "four", cross = false, unison = false } = {}) => ({ id: "order", check: ({ x }) => {
    for (let i = 0; i + 1 < x.length; i++) {
      // (unison: two neighbours may meet on one note — a doubling, bound as one)
      if (!cross && N.D(x[i + 1]) >= N.D(x[i]) && !(unison && x[i + 1] === x[i])) return form === "three" ? "the middle voice under the upper" : `the ${N.names[i + 1]} under the ${N.names[i]}`;
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
    // (or in two steps, a 5/4 asked between: the 6 down to the 5, the 4 held, then down — the Lamento's double cadence,
    // chapter 8)
    const fourHeld = (i) => B[t].chord === "5/4" && pv[i] === 3 && x[i] === p[i];
    if (form === "three") {
      if (new Set(pv).size === 2 && pv.every((c) => c === 5 || c === 3)) {
        const down = (i) => (D(x[i]) === D(p[i]) - 1 && (pv[i] === 5 ? 4 : 2) === v[i].cls) || fourHeld(i);
        if (!down(0) || !down(1)) return "the 6/4 resolves to the 5/3, each voice down a step (6 to 5, 4 to 3)";
      }
      return null;
    }
    const pc = new Set(pv);
    if (pc.has(5) && pc.has(3) && !pc.has(2) && !pc.has(1))
      for (let i = 0; i < x.length; i++) if ((pv[i] === 5 || pv[i] === 3) && !(D(x[i]) === D(p[i]) - 1 && v[i].cls === pv[i] - 1) && !fourHeld(i)) return "the 6/4 resolves to the 5/3 (6 to 5, 4 to 3)";
    return null;
  } }),
  /** pair · no parallel 5ths or octaves between two upper voices; structural (as each voice's with the bass): not from
   *  the strong unit before either, only ornaments between (each voice by step or held, the bass not leaping) — chorale-4
   *  from 1.2.0; partimento-2 as partimento.mjs, without it. */
  "parallels-upper": (N, { form = "three", structural = false } = {}) => ({ id: "parallels-upper", lookback: 3, check: ({ W, t, x, p }) => {
    if (t < 1) return null;
    const { D, B } = N, perfectOf = (a, b) => { const cls = mod(D(a) - D(b), 7), s = mod(N.semi(a) - N.semi(b), 12); return (cls === 0 && s === 0) || (cls === 4 && s === 7) ? cls : null; };
    for (let i = 0; i < x.length; i++) for (let j = i + 1; j < x.length; j++) {
      const a = perfectOf(x[i], x[j]), b = perfectOf(p[i], p[j]);
      if (form === "three") { if (a !== null && a === b && x[i] !== p[i] && x[j] !== p[j]) return `parallel ${a === 0 ? "octaves" : "5ths"} between the upper voices`; }
      else if (a !== null && a === b && (x[i] !== p[i] || x[j] !== p[j]) && D(x[i]) - D(p[i]) !== 0) return `parallel ${a === 0 ? "octaves" : "5ths"} between the ${N.names[i]} and the ${N.names[j]}`;
    }
    // (at the level of the structure, the weak units between ornaments: the same perfect interval on two strong units in
    // a row, both voices moved the same way — the sequence's, with a chord of its own between and the bass leaping, are
    // not this: Bach writes them, ex. 7.12)
    const strong = N.V[0].strong;
    if (!structural || !W || !strong(t)) return null;
    let s = t - 1;
    while (s >= 0 && !strong(s)) s--;
    if (s < 0 || s === t - 1) return null;
    for (let k = s + 1; k <= t; k++) if (B[k].struck && Math.abs(B[k].d - B[k - 1].d) > 1) return null;
    const at = (i, k) => (k === t ? x[i] : W[i][k]);
    for (let i = 0; i < x.length; i++) for (let j = i + 1; j < x.length; j++) {
      const a = perfectOf(W[i][s], W[j][s]), b = perfectOf(x[i], x[j]);
      if (a === null || a !== b) continue;
      const di = D(x[i]) - D(W[i][s]), dj = D(x[j]) - D(W[j][s]);
      if (!di || !dj || Math.sign(di) !== Math.sign(dj)) continue;
      let orn = true;
      for (let k = s + 1; k <= t && orn; k++) for (const v of [i, j]) if (Math.abs(D(at(v, k)) - D(at(v, k - 1))) > 1) orn = false;
      if (orn) return `parallel ${a === 0 ? "octaves" : "5ths"} from the strong unit before, under the diminution (${form === "three" ? "the upper voices" : `the ${N.names[i]} and the ${N.names[j]}`})`;
    }
    return null;
  } }),
  /** pair · the outer voices: no octave on two strong units in a row, the soprano held between them and moving the
   *  bass's way — not even in a sequence, a chord of its own between and the bass leaping: the soprano would double the
   *  bass's line at the level of the structure (Fifth Down Fourth Up, the soprano F–E–D over F–B–E–A–D). Bach's chorales:
   *  in 1 of their 24 circle-of-fifths stretches (5ths between soprano and bass in 8). chorale-4 1.3.0. */
  "outer-octaves": (N) => ({ id: "outer-octaves", lookback: 3, check: ({ W, t, x }) => {
    const V0 = N.V[0], strong = V0.strong, B = N.B;
    if (!W || t < 2 || !strong(t)) return null;
    let s = t - 1;
    while (s >= 0 && !strong(s)) s--;
    if (s < 0) return null;
    const a = V0.vertical(s, W[0][s]), b = V0.vertical(t, x[0]);
    if (!(a.q === "perfect" && a.cls === 0 && b.q === "perfect" && b.cls === 0)) return null;
    for (let k = s + 1; k < t; k++) if (W[0][k] !== W[0][s]) return null;
    const du = N.D(x[0]) - N.D(W[0][s]), db = B[t].d - B[s].d;
    return du !== 0 && db !== 0 && Math.sign(du) === Math.sign(db) ? `octaves between the ${N.names[0]} and the bass on strong units in a row` : null;
  } }),
  /** progression · tonal functions (functions.mjs, discussions #399, #321): the chord on each strong unit read in the
   *  key — T, S, D, or an applied dominant — and the succession the grammar allows into it, from the unit before or
   *  from the strong unit before:
   *  never D → S (the dominant taken back before it is resolved), an applied dominant into its target (or another
   *  applied one); a chain of 6/3s over a bass by step is a line. The weak units between are the prolongation's (a
   *  passing chord, the RO's 6/3 on ⑥ going up): not read, as GTTM's prolongational reduction would not. Where the
   *  chords are given (a figured bass) it checks them; where they are free (a bass not figured, a melody given) it
   *  chooses with them. chorale-4 1.4.0.
   *  local: each unit read in its own key (the bass note's, Bach's phrases tonicizing as they go, discussion #353),
   *  two units in different keys kept where either key reads them well (the pivot); passing: an inverted chord over a
   *  bass going on by step is a passing chord (V – IV6 over ⑤–⑥), never a retrogression. bach-4 1.3.0. */
  functions: (N, { local = false, passing = false } = {}) => ({ id: "functions", lookback: 3, check: ({ W, t, x }) => {
    const { K, B } = N, strong = N.V[0].strong, kt = { tonic: K.tonic, mode: K.mode };
    const keyAt = (u) => (local && B[u].key ? { tonic: B[u].key.tonic, mode: B[u].key.mode } : kt);
    if (!W || t < 1) return null;
    // (a unit's chord: the bass and the voices; where its figures ask for a tone no voice has — a diminished 7th
    // without its 5th — that tone added as the unit's key has it, so the chord is read as what it is)
    const chordAt = (u, xs) => {
      const ps = [K.midi(B[u].d, B[u].r || 0), ...xs.map((c) => K.midi(N.D(c), N.A(c)))];
      const ch = N.figured && B[u].chord ? CHORDS4[B[u].chord] : null;
      if (ch) {
        const have = new Set(xs.map((c) => N.V[0].vertical(u, c).cls)), lo = localOf(K, B[u].key);
        // (a 7th chord whole: its four tones — a diminished 7th without its 5th is still a diminished 7th)
        for (const cls of ROOT[B[u].chord] !== undefined ? ch.ok.filter((c) => c !== 0) : ch.need) if (!have.has(cls)) {
          const d = B[u].d + cls, a = [0, 1, -1].find((r) => localNote(K, lo, d, r).alt === 0) ?? 0;
          ps.push(K.midi(d, a));
        }
      }
      return ps;
    };
    // (an augmented 6th is the dominant's preparation: S; a chain of 6/3s and 7–6s over a bass by step, a Lamento's
    // too, is a line, not a succession of functions)
    const fnAt = (u, xs, k = kt) => (B[u].chord && B[u].chord[0] === "+" ? { fn: "S", target: null, targets: [], degree: null, chord: { root: null, kind: "+6", bass: mod(K.midi(B[u].d, B[u].r || 0), 12), extra: null } } : functionOf(chordAt(u, xs), k));
    const LINE = new Set(["6/3", "6", "7/3", "7/4"]);
    const line = (u, v) => B[u].chord && B[v].chord && LINE.has(B[u].chord) && LINE.has(B[v].chord) && Math.abs(K.midi(B[v].d, B[v].r || 0) - K.midi(B[u].d, B[u].r || 0)) <= 2;
    // (the two chords read in one key: the later unit's, then the earlier's where it is another — null where either
    // reads them as the grammar allows, or where a chord is none)
    const keysOf = (u) => { const a = keyAt(t), b = keyAt(u); return a.tonic === b.tonic && a.mode === b.mode ? [a] : [a, b]; };
    const errOf = (u, xs, xt) => {
      if (line(u, t)) return null;
      let why = null;
      for (const k of keysOf(u)) {
        const a = fnAt(u, xs, k), b = fnAt(t, xt, k);
        if (!a || !b) return null;
        const e = grammarErrors([a, b], { end: false, key: k, passing });
        if (!e.length) return null;
        why = why || e[0].reason;
      }
      return why;
    };
    // (on a weak unit only an applied dominant's resolution is read: it goes to its target, weak or strong)
    if (!strong(t)) {
      const xs = W.map((U) => U[t - 1]);
      if (!B[t].struck && x.every((c, i) => c === W[i][t - 1])) return null;
      if (!keysOf(t - 1).some((k) => { const a = fnAt(t - 1, xs, k); return a && a.fn === "A"; })) return null;
      return errOf(t - 1, xs, x);
    }
    let s = t - 1;
    while (s >= 0 && !strong(s)) s--;
    if (s < 0) return null;
    // (the strong unit reached from the one before — a weak unit's chord resolved there, an applied dominant on the
    // weak unit into its target — or from the strong one before: either way the grammar is kept)
    let why = null;
    for (const u of s === t - 1 ? [s] : [t - 1, s]) {
      const e = errOf(u, W.map((U) => U[u]), x);
      if (!e) return null;
      why = why || e;
    }
    return why;
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
    // (in a sequence ⑦ is a degree as the others, its chord not the dominant's: its bass doubled where the 7th chord
    // is incomplete, ex. 7.12a)
    const ltCount = () => (B[t].sequence && N.V[0].locB(t) === 6 ? 0 : [codeOf3(B[t].d, B[t].r || 0), ...x].filter((c) => N.ltOf(t, c)).length);
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
    (N.B[t].sequence && N.V[0].locB(t) === 6 ? null : [codeOf3(N.B[t].d, N.B[t].r || 0), ...x].filter((c) => N.ltOf(t, c)).length >= 2 ? "the leading tone doubled" : null) }),
  /** chord, line · a 7th chord's 7th: prepared where the chord is not the dominant's; the dominant's held or by step. */
  seventh: (N, { free = false } = {}) => ({ id: "seventh", check: ({ W, t, x }) => {
    const sv = N.sevenths(t);
    if (!sv || sv.cls === 0) return null;
    const v = x.map((c, i) => N.V[i].vertical(t, c));
    if (!sv.dominant)
      for (let i = 0; i < x.length; i++) if (v[i].cls === sv.cls && (t === 0 || W[i][t - 1] !== x[i])) return `the 7th of a chord on ${"①②③④⑤⑥⑦"[mod(N.V[0].locB(t) + ROOT[N.B[t].chord], 7)]} is prepared (the ${N.names[i]})`;
    if (sv.dominant && t >= 1 && !free)
      // (by step, diatonic or chromatic — chapter 8: the leading tone of one dominant down a chromatic half step to the
      // 7th of the next, A to A♭ into the molldur's diminished 7th)
      for (let i = 0; i < x.length; i++) if (v[i].cls === sv.cls && W[i][t - 1] !== x[i] && Math.abs(N.D(x[i]) - N.D(W[i][t - 1])) > 1) return `the dominant's 7th is held or comes by step (the ${N.names[i]})`;
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
      // (and in the dominant's family and the diminished 7th's — not a 7th of a sequence, on the natural ⑦)
      const sv = N.sevenths(t);
      on = kt.mode === "minor" && ((B[t].dominant && B[t].chord !== "6/3") || (ch && ch.seventh !== undefined && (!sv || sv.dominant)));
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
  /** a voice exchange (Stimmtausch): an inner voice and another voice trade their notes' classes in contrary motion —
   *  over one unit (a 3rd or a 6th each way: the alto C→E, the bass E→C) or two (a passing note between, each voice by
   *  step) —, the chord kept and each line moving where one voice alone would leap: it costs less (−weight), as Bach
   *  writes it in about one chord in eleven. bach-4 1.5.0. */
  "voice-exchange": (N, { weight = 1 } = {}) => ({ id: "voice-exchange", cost: ({ W, t, x }) => {
    const pitch = (u, i, xs) => (i === 3 ? N.K.semi(N.B[u].d, N.B[u].r || 0) : N.semi(xs ? xs[i] : W[i][u]));
    const pc = (m) => mod(m, 12);
    for (const k of [1, 2]) {
      const s = t - k;
      if (s < 0) continue;
      for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
        if (i !== 1 && i !== 2 && j !== 1 && j !== 2) continue;
        const a0 = pitch(s, i), b0 = pitch(s, j), a1 = pitch(t, i, x), b1 = pitch(t, j, x);
        if (pc(a0) === pc(b0) || pc(a1) !== pc(b0) || pc(b1) !== pc(a0) || a1 === a0 || Math.sign(a1 - a0) !== -Math.sign(b1 - b0)) continue;
        if (k === 2) { const am = pitch(t - 1, i), bm = pitch(t - 1, j); if (Math.abs(am - a0) > 2 || Math.abs(a1 - am) > 2 || Math.abs(bm - b0) > 2 || Math.abs(b1 - bm) > 2) continue; }
        return { "voice-exchange": -weight };
      }
    }
    return {};
  } }),
  /** the tonal functions (BETWEEN's functions, its parameters) as a cost: a unit whose chord the grammar does not let
   *  follow the one before pays weight — Bach breaks it, read in his local keys, in 78 of his 2,272 phrases
   *  (discussion #353: soft until the keys are the engine's own). */
  functions: (N, { weight = 2, ...p } = {}) => { const r = BETWEEN.functions(N, p); return { id: "functions", cost: (xx) => (r.check(xx) ? { functions: weight } : {}) }; },
};

// a church mode's style, as Fux writes (Gradus ad Parnassum; tests/rules.mjs reads his examples in three and four parts
// with it): a voice may meet the bass in a unison, hold its note longer, and reach a 5th or an octave by direct motion
// where it is an inner voice; the minor's own rules out
STYLES["modal-1"] = { style: "modal-1", version: "0.1.0", extends: "partimento-1",
  rules: [["from-bass", { unison: "any" }], ["hold", { max: 4 }], ["parallels", { direct: "outer" }], ["leading-tone-raised", false], ["melodic-minor", false]] };
// (a voice among three or four, as his: no direct 5ths or octaves asked of it, a leap not always turned, a chromatic
// step over a held bass, the last chord with its 5th on top)
STYLES["modal-voice"] = { style: "modal-voice", version: "0.1.0", extends: "modal-1",
  rules: [["parallels", { direct: "none" }], ["leaps", { turn: false }], ["intervals", { chromatic: true }], ["edges", { ends: [0, 2, 4] }]] };

// the styles of several voices: partimento.mjs's parts (two upper voices) and four (three), their rules between the
// voices in the order they read them; each voice a style of one voice over the bass
CATALOGUES.bass = { rules: RULES, soft: SOFT_RULES, between: BETWEEN, softBetween: SOFT_BETWEEN };
Object.assign(STYLES, {
  // the comes's (canon.mjs: its own engine and catalogue): two free voices, the dux and the comes, their rules and those
  // between them in counterpoint.mjs's order
  "canon-2": { style: "canon-2", version: "1.0.0", parts: 2, engine: "canon",
    dux: [["range"], ["entry"], ["melodic"], ["final"], ["approach"], ["syncopation"], ["ficta"]],
    comes: [["entry"], ["range"], ["syncopation"], ["melodic"], ["ficta"]],
    between: [["resolution", { of: "dux" }], ["imitation"], ["resolution", { of: "comes" }], ["crossing"], ["vertical"]] },
  // (a dux given — cac imitation: a tree's voice —, the comes found against it: the dux's own rules off, it is given)
  "imitation-2": { style: "imitation-2", version: "1.0.0", parts: 2, engine: "canon", extends: "canon-2",
    dux: [["range", false], ["entry", false], ["melodic", false], ["final", false], ["approach", false], ["syncopation", false], ["ficta", false], ["given"]] },
  "partimento-2": { style: "partimento-2", version: "1.0.0", parts: 3, voice: "partimento-1",
    between: [["order", { form: "three" }], ["imitation"], ["exchange"], ["apart"], ["seconds"], ["six-four"], ["parallels-upper"], ["false-relation"], ["chord"], ["doubling"], ["dominant-major"]],
    softBetween: [] },
  // (a church mode in three and four parts, note against note: the voices may cross; every chord a consonant 5/3 or 6/3)
  "modal-2": { style: "modal-2", version: "0.1.0", parts: 3, voice: "modal-voice",
    between: [["order", { form: "three", cross: true }], ["seconds"], ["parallels-upper"], ["false-relation"], ["modal"]], softBetween: [] },
  "modal-4": { style: "modal-4", version: "0.1.0", parts: 4, voice: "modal-voice",
    between: [["order", { cross: true }], ["modal"], ["doubling", { form: "four" }], ["seconds", { form: "four" }], ["parallels-upper", { form: "four" }]], softBetween: [] },
  "chorale-4": { style: "chorale-4", version: "1.4.0", parts: 4, voice: "partimento-1",
    between: [["order", { within: 7 }], ["chord", { form: "four" }], ["doubling", { form: "four" }], ["seventh"], ["leading-tone-doubled"], ["seconds", { form: "four" }],
              ["parallels-upper", { form: "four", structural: true }], ["outer-octaves"], ["resolution"], ["six-four", { form: "four" }], ["dominant-major", { form: "four" }], ["functions"]],
    softBetween: [["doubling"]] },
  // Bach's chorales (the corpus, the bridges filled from A to B): chorale-4, and two neighbouring voices may meet on one
  // note — the tenor and the bass, the alto and the tenor… —, a doubling: what binds a doubled note binds it, the
  // parallels and the doublings (BWV 269's first phrase: the tenor on the bass's G)
  // (the functions read in each unit's key, the passing chords let pass, and as a cost, not a refusal: 1.3.0)
  // (each voice's moves weighed as often as Bach's alto and tenor make them — bach-motion, weight 2: with the engine at
  // temperature 1 they keep a note, step, leap a 4th or more nearly as often as his: 1.4.0)
  // (and an inner voice trading its note with another's in contrary motion — a voice exchange — costing less, weight
  // 2: as often as Bach, about one chord in eleven: 1.5.0)
  // (and the dissonances as rare as his: what an inner voice sounds against the bass weighed by his own frequencies —
  // bach-vertical, 1.5 —, the species' rewards for a passing note and a suspension off, the moves weighed more — 4 —
  // so a voice does not leap to keep consonant; minor's raised ⑥ as seldom as his in the inner voices — raised-sixth, 2:
  // 1.6.0)
  "bach-4": { style: "bach-4", version: "1.6.0", parts: 4, extends: ["chorale-4", "1.4.0"], voice: { extends: "partimento-1", rules: [["from-bass", { unison: "any" }], ["dissonance", { overStruck: true, neighbour: true, weakHeld: true, bachSevenths: true }], ["parallels", { direct: "outer" }]],
                                                                                          soft: [["bach-motion"], ["bach-vertical"], ["raised-sixth"]], weights: { "bach-motion": 4, "bach-vertical": 1.5, "raised-sixth": 2, passing: 0, "suspension-life": 0 } },
    between: [["order", { within: 7, unison: true }], ["functions", false]],
    softBetween: [["functions", { local: true, passing: true }], ["voice-exchange"]], weights: { functions: 2, "voice-exchange": 4 },
    // (the voices' ranges as Bach's in the chorales, MIDI: the same in every key)
    ranges: { soprano: [57, 81], alto: [52, 74], tenor: [48, 69] } },
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
  const S = { bass: B, key: K, figured: false, ro: spec.ro, exchange: true, end: spec.end, weights: { ...(st.weights || {}), ...(spec.weights || {}) }, delayed: spec.delayed, style: st.voice };
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
 * ([lo, hi]), line, end, delayed, weights, freeSevenths, style, given ({soprano: [a code a unit, or null]}: the
 * soprano given — a melody harmonized, a bridge's outer voices —, its own line's rules off: it is given)}.
 */
export function fourOverBass(spec = {}) {
  const K = keyOf(spec.key || { tonic: "C" }), B = spec.bass, n = B.length, figured = spec.figured ?? true;
  const st = resolveStyle(typeof spec.style === "object" ? spec.style : STYLES[spec.style || "chorale-4"]);
  const asked = (t) => (figured && B[t].chord ? CHORDS4[B[t].chord] : null);
  let locB0 = null;
  // (a 7th chord's family: the dominant's, on ⑤, and — chapter 7 — the diminished 7th's, on the leading tone: in
  // minor its ⑦ raised (in root position, the bass raised), in major with the lowered ⑥ (molldur, the unit's chroma);
  // both semi-consonances, free to enter. Any other 7th chord prepares its 7th; a unit's family says it outright)
  const sevenths = (t) => {
    const ch = asked(t);
    if (!ch || ch.seventh === undefined || ROOT[B[t].chord] === undefined) return null;
    const root = mod(locB0(t) + ROOT[B[t].chord], 7), u = B[t];
    const minor = Sv.world.LOC[t].key.mode === "minor";
    // (in minor a natural ⑦ — the bass's, or a unit of the natural scale, a sequence's — makes it a diatonic 7th)
    const dim = root === 6 && (minor ? !u.natural && (B[t].chord !== "7" || (u.r || 0) === 1) : !!(u.chroma && u.chroma.some(([d, a]) => mod(d, 7) === 5 && a === -1)));
    const family = u.family || (root === 4 ? "dominant" : dim ? "diminished" : null);
    return { cls: ch.seventh, dominant: family === "dominant" || family === "diminished", family, root };
  };
  const free = (t) => {
    const ch = asked(t);
    if (!ch || !(ch.free || ch.seventh !== undefined)) return null;
    const sv = sevenths(t), cls = sv && !sv.dominant ? (ch.free || []).filter((c) => c !== ch.seventh) : ch.free || [];
    return { cls, seventh: ch.seventh, up: ch.up, tri: !!ch.tri, family: sv ? sv.family : null };
  };
  const S0 = { bass: B, key: K, figured: false, ro: spec.ro ?? true, exchange: true, end: spec.end, free, weights: { ...(st.weights || {}), ...(spec.weights || {}) }, delayed: spec.delayed, style: st.voice };
  const lineOf = (who) => (spec.line && typeof spec.line === "object" ? spec.line[who] : spec.line);
  // (a voice's range: the spec's, in degrees; or the style's, in MIDI — Bach's, the same in every key —; or the book's)
  const fromMidi = ([lo, hi]) => { let a = -40; while (K.midi(a, 0) < lo) a++; let b = 50; while (K.midi(b, 0) > hi) b--; return [a, b]; };
  const rangeOf = (who, dflt) => spec[who] || (st.ranges && st.ranges[who] ? fromMidi(st.ranges[who]) : dflt);
  const [slo, shi] = rangeOf("soprano", [9, 20]), [alo, ahi] = rangeOf("alto", [6, 17]), [tlo, thi] = rangeOf("tenor", [3, 14]);
  const Sv = overBass({ ...S0, lo: slo, hi: shi, voice: "top", spacing: 22, line: lineOf("soprano"), maxHold: 3 });
  const Av = overBass({ ...S0, lo: alo, hi: ahi, voice: "middle", spacing: 22, line: lineOf("alto"), turn: false, maxHold: n });
  const Tv = overBass({ ...S0, lo: tlo, hi: thi, voice: "middle", spacing: 22, line: lineOf("tenor"), turn: false, maxHold: n });
  locB0 = Sv.world.locB;
  const NAMES = ["soprano", "alto", "tenor"];
  const N = voicesWorld(K, B, [Sv.world, Av.world, Tv.world], NAMES, { figured, ro: spec.ro ?? true, asked, sevenths });
  const params = { seventh: { free: !!spec.freeSevenths } };
  const between = st.between.map(([id, p]) => BETWEEN[id](N, { ...(params[id] || {}), ...(p || {}) }));
  // (a style's weights, then the spec's: the voices' soft rules and the doubling between them)
  const W = { doubling: 0.6, ...(st.weights || {}), ...(spec.weights || {}) };
  const soft = (st.softBetween || []).map(([id, p]) => SOFT_BETWEEN[id](N, { ...(W[id] !== undefined ? { weight: W[id] } : {}), ...(p || {}) }));
  const D = codeDegree;
  // (the order of the voices and their octave, at once: as partimento.mjs's triples)
  // (the voices in order as they are chosen — neighbours on one note where the style lets them meet)
  const meet = st.between.some(([id, p]) => id === "order" && p && p.unison);
  const quick = (_W, _t, x) => { if (x.length < 2) return true; const a = x[x.length - 2], b = x[x.length - 1]; return !((D(b) >= D(a) && !(meet && a === b)) || D(a) - D(b) > 7); };
  // (a soprano given: its note at each unit, and nothing else; what it makes with the others the rules between them read)
  // (and the alto or the tenor given where a unit has a note for it — a bridge's ends, Bach's chords —: there its note
  // and nothing else, its own rules off there; elsewhere free)
  const pin = (V, g, who) => (g ? { ...V, check: (U, t, c) => (t >= n ? "the work is finished" : g[t] === null || g[t] === undefined ? V.check(U, t, c) : c === g[t] ? null : `the ${who} is given`), costParts: (U, c) => (g[U.length] === null || g[U.length] === undefined ? V.costParts(U, c) : {}) } : V);
  const Sgiven = pin(Sv, spec.given && spec.given.soprano, "soprano");
  const SV = solveVoices({ n, voices: [{ name: "soprano", solver: Sgiven }, { name: "alto", solver: pin(Av, spec.given && spec.given.alto, "alto"), prefix: "alto/", weight: 0.6 }, { name: "tenor", solver: pin(Tv, spec.given && spec.given.tenor, "tenor"), prefix: "tenor/", weight: 0.6 }],
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

// a note's name ("F#4", "Bb3", "C##5") as degree and alteration in K, or null (no name, or too far from K to write)
const spelt = (K, name) => { if (!name) return null; try { const c = codeOf(K, name); return { d: codeDegree(c), r: codeAlter(c) }; } catch (e) { return null; } };

// ─────────────────────────────── from a tree: a bass given as notes (the cac box, discussion #323) ───────────────────────────────
/** The bass's units from notes [{midi, name (as spelt: "F#4"), units, fig (a figuring: "6/5"), key, strong: [one a unit]}] in K. */
export function bassFromNotes(notes, K, voices = 4, fill = false) {
  const table = voices >= 4 ? CHORDS4 : CHORDS, units = [], unknown = [];
  // (each note as it is spelt — its name, "F#4", where it has one: an edition's —, else in its own key, where it has
  // one: F in A minor, not E♯ as G major would)
  const drs = notes.map((nt) => spelt(K, nt.name) || degreeIn(K, nt.midi, parseKey(nt.key)));
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
 * guessed), voices (2, 3 or 4: the bass and the upper voices), ro (chapter 4's rules: true), style, soprano (four
 * parts: the soprano given as notes in the bass's units — the alto and the tenor written between)}. Its count, sample,
 * engine, judge, chords; midi, code and spell (a code as a tree writes it).
 */
export function fromNotes(spec = {}) {
  const key = parseKey(spec.key) || guessKey(spec.notes.map((n) => n.midi));
  // (a style, a name or written as data, says how many parts it writes, unless voices asks for them)
  const style = spec.style || null;
  if (style) checkStyle(style);
  if (style && resolveStyle(style).engine) throw new Error(`${resolveStyle(style).style}: a style of the ${resolveStyle(style).engine}, not of a bass's upper voices`);
  const sp = style ? partsOf(style) : null;
  const K = keyOf(key), voices = spec.voices || sp || 4;
  if (sp && spec.voices && sp !== spec.voices) throw new Error(`the style ${style.style || style} writes ${sp} parts, not ${spec.voices}`);
  // (a church mode: its own style by default, Fux's, note against note — modal-1, modal-2, modal-4 —, which chooses
  // between a 5/3 and a 6/3 itself: no Rule of the Octave filled in, a tonal table)
  if (!spec.style && K.modal) spec = { ...spec, style: voices >= 4 ? "modal-4" : voices === 3 ? "modal-2" : "modal-1" };
  // (fill: the notes without figures take the Rule of the Octave's chords — as cac partimento writes; a judgement reads
  // the chords the voices make instead)
  const { units, unknown } = bassFromNotes(spec.notes, K, voices, !!spec.fill && !K.modal);
  const figured = units.some((u) => u.chord);
  const ro = spec.ro ?? true;
  // (a soprano given — notes [{midi, units}] in the bass's units, a rest {midi: null} —: its code a unit; the alto and
  // the tenor written between it and the bass, the chords chosen by the rules — the functions among them)
  // (a note spelt in its unit's key, where the bass gives one)
  // (or as it is spelt, where it has a name)
  const codeOfMidi = (m, t) => { const dr = degreeIn(K, m, units[t] && units[t].key); return dr ? codeOf3(dr.d, dr.r) : null; };
  const given = spec.soprano && voices >= 4 ? { soprano: spec.soprano.flatMap((x) => Array(Math.max(1, x.units || 1)).fill(x.midi === null || x.midi === undefined ? null : x)).map((x, t) => { if (x === null) return null; const dr = spelt(K, x.name); return dr ? codeOf3(dr.d, dr.r) : codeOfMidi(x.midi, t); }) } : null;
  if (given && given.soprano.length !== units.length) throw new Error(`the soprano is ${given.soprano.length} units long, the bass ${units.length}`);
  // (the alto and the tenor given where a unit has a note for them — inner: {alto: [a note a unit, or null]…}, a note
  // {midi, name} or a MIDI number —: a bridge's ends as Bach's chords)
  if (given && spec.inner) for (const v of ["alto", "tenor"]) if (spec.inner[v]) {
    if (spec.inner[v].length !== units.length) throw new Error(`the ${v} is ${spec.inner[v].length} units long, the bass ${units.length}`);
    given[v] = spec.inner[v].map((x, t) => { if (x === null || x === undefined) return null; const o = typeof x === "number" ? { midi: x } : x; const dr = spelt(K, o.name); return dr ? codeOf3(dr.d, dr.r) : codeOfMidi(o.midi, t); });
  }
  const make = (bass, fig) => (voices >= 4 ? fourOverBass({ key, bass, figured: fig, ro, style: spec.style, given })
    : voices === 3 ? partsOverBass({ key, bass, figured: fig, ro, style: spec.style })
    : overBass({ key, bass, figured: fig, ro, voice: "top", lo: 7, hi: 21, style: spec.style }));
  const P = make(units, figured);
  const names = voices >= 4 ? ["soprano", "alto", "tenor"] : voices === 3 ? ["top", "middle"] : ["top"];
  const asVoices = (R) => (R === null || R === undefined ? null : voices === 2 ? { top: R } : R);
  const midi = (c) => K.midi(codeDegree(c), codeAlter(c));
  // (a MIDI note's code; given a unit, spelt in its key; a name's — "F#4" — as it is spelt)
  const code = (m, t) => { if (typeof m === "string") { const dr = spelt(K, m); return dr ? codeOf3(dr.d, dr.r) : null; } const dr = t === undefined ? degreeOf(K, m) : degreeIn(K, m, units[t] && units[t].key); return dr ? codeOf3(dr.d, dr.r) : null; };
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
  /**
   * Where a bass with no realization dies: going forward unit by unit through the states the rules allow (at most cap
   * of them a unit, by the memo's window), the first unit nothing can reach — {unit, note (its index), states, reasons
   * [[reason, how many candidates it refused] …], the most first} —, or null if every unit is reached (the dead end is
   * then further on than cap states see, or there is none). For saying why a bass cannot be realized.
   */
  function deadEnd({ cap = 1500, ms = 1500 } = {}) {
    const deadline = Date.now() + ms, n = units.length, k = voices >= 4 ? 3 : voices === 3 ? 2 : 1;
    const own = voices === 2 ? [P] : (P.voices || []).map((v) => v.solver || v);
    const next = (W) => (voices === 2 ? P.codes.filter((c) => P.check(W[0], W[0].length, c) === null).map((c) => [c]) : P.tuples(W));
    let states = [Array.from({ length: k }, () => [])];
    for (let t = 0; t < n; t++) {
      const seen = new Map();
      for (const W of states) {
        for (const x of next(W)) {
          const W2 = W.map((U, i) => [...U, x[i]]), key = W2.map((U) => U.slice(-3).join(",")).join("|");
          if (!seen.has(key)) seen.set(key, W2);
          if (seen.size >= cap) break;
        }
        if (seen.size >= cap || Date.now() > deadline) break;
      }
      if (!seen.size) {
        const why = {}, W = states[0], add = (r) => { if (r) why[r] = (why[r] || 0) + 1; };
        own.forEach((v, i) => v.codes.forEach((c) => add(v.check(W[i], t, c))));
        if (voices > 2 && P.check) {
          const ok = own.map((v, i) => v.codes.filter((c) => v.check(W[i], t, c) === null));
          let tried = 0;
          const go = (i, x) => { if (tried > 800) return; if (i === ok.length) { tried++; add(P.check(W, t, x)); return; } for (const c of ok[i]) { x.push(c); go(i + 1, x); x.pop(); } };
          if (ok.every((o) => o.length)) go(0, []);
        }
        return { unit: t, note: units[t].note, states: states.length, reasons: Object.entries(why).sort((a, b) => b[1] - a[1]).slice(0, 4) };
      }
      if (Date.now() > deadline) return null;
      states = [...seen.values()];
    }
    return null;
  }
  return { key, K, units, unknown, figured, voices, names, P, style: P.style, midi, code, spell, degAt: (t) => V0.world.locB(t),
           count: () => P.count(), countWithin, deadEnd, search: (o) => asVoices(P.search(o)),
           engine: (o) => asVoices(P.engine(o)), sample: (r) => asVoices(P.sample(r)),
           judge: judgeOf, chords: (R) => (P.chords ? P.chords(R) : null) };
}

// (a box loads the module's default export: api/import-module)
/**
 * The inner voices between a soprano and a bass given (a chorale's outer voices, a bridge's): spec {soprano, bass
 * (notes [{midi, units}], the same units), key, style (bach-4: chorale-4 — its functions — with neighbours meeting
 * on the unison, as in Bach's chorales)}. fromNotes, the
 * chords free (no figures), the soprano given.
 */
export const fromOuter = (spec = {}) => fromNotes({ ...spec, style: spec.style || "bach-4", notes: spec.bass, soprano: spec.soprano, inner: spec.inner, voices: 4, fill: false });

export default { within, TooLong, solve, solveVoices, overBass, partsOverBass, fourOverBass, fromNotes, fromOuter, bassFromNotes, degreeOf, parseKey, guessKey, keyOf,
                 RULES, SOFT_RULES, BETWEEN, SOFT_BETWEEN, STYLES, CATALOGUES, resolveStyle, checkStyle, defineStyle, partsOf, CHORDS, CHORDS4, RULE_OF_THE_OCTAVE, octaveDefault };
