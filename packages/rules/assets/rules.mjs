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

import { mod, sign, keyOf, codeOf3, codeDegree, codeAlter, localOf, localNote, FIG_CLASS, CLASS_FIG } from "./tonal.mjs";
import { melodicParts, verticalParts, total, choose, temperature, defaultWeights } from "./soft.mjs";

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
  return { n, codes, window, rules, soft, check, why, count, fan, sample, engine, judge, costParts, memo };
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
