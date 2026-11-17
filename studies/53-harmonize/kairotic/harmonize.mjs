// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 53 · harmonize: a given melody harmonized, as Study 51's partimento turned upside down.
//
// Study 51 wrote the upper voice over a given bass. Here the upper voice is given — a melody — and the bass is written
// under it by the same rules of two-part writing (Study 51's keys, verticals, lines, suspensions, parallels, the soft
// rules of Studies 38–42 and its engine: futures counted exactly, each note a softmax of −cost / temperature among
// those with a future). Then the figures the two voices make are realized as chords, as a partimento is played: the
// inner voices fill the triad over the bass (5/3, or 6/3 where the rule of the octave asks for it), led by the
// shortest way and without parallels. The result is a chorale in four parts; how it is played (a texture, an Alberti
// bass) is left to the boxes after it.
//
// What is new against Study 51, all of it in the bass's rules:
//   start       the bass begins on ① (on ① or ⑤ after an upbeat)
//   cadences    a perfect cadence is ⑤–① in the bass, the ① struck; a half cadence rests on ⑤; the last unit is a
//               perfect cadence unless the melody is given another (spec.cadences)
//   lines       the bass may leap an octave, and does not have to turn after it
//   held        a bass note lasts up to a bar (spec.maxHold units)
//   dissonance  the melody brings it: a passing tone of the melody over a held bass, a suspension of the melody (held
//               into a strong unit and resolving down by step), or of the bass (held, a 2nd, resolving down)
//   the style   three soft rules more, for a basic classical harmony: the degrees of the bass (① ④ ⑤ first), the
//               melody a tone of the chord over that bass, and the harmonic rhythm (the bass changes on strong units)

import { melodicParts, verticalParts, total, choose, temperature, defaultWeights } from "./soft.mjs";
import { keyOf, codeOf } from "./schemata.mjs";

export { keyOf, codeOf };

const mod = (a, m) => ((a % m) + m) % m;
const sign = (x) => (x > 0) - (x < 0);
const D = (c) => c >> 1, R = (c) => c & 1;
const CLASS_FIG = [8, 2, 3, 4, 5, 6, 7];

// ─── the melody: a note a unit, "-" holding the one before ───
/** Units from a melody string ("C5 C5 G5 - A5 A5 G5 -") in a key: codes, a held note written again. */
export function melodyUnits(text, K) {
  const out = [];
  for (const tok of String(text).trim().split(/\s+/)) {
    if (tok === "-" || tok === "_") { if (!out.length) throw new Error("the melody begins with a hold"); out.push(out[out.length - 1]); }
    else out.push(codeOf(K, tok));
  }
  return out;
}

/** The soft rules of the style, beside Studies 38–42's (their weights can be changed by spec.weights). */
export const STYLE = [
  { id: "degree", weight: 1.5, doc: "The degrees of the bass: ①, ④ and ⑤ cost nothing, ② and ⑥ a little, ③ and ⑦ more (a basic classical harmony)." },
  { id: "chord-tone", weight: 1.5, doc: "The melody a tone of the chord over the bass: of its triad (5/3) nothing, of its 6/3 a little; a dissonance more." },
  { id: "rhythm", weight: 1, doc: "The harmonic rhythm: the bass struck on a weak unit, or held over a strong one, costs a little." },
];
const DEGREE_COST = [0, 0.4, 0.6, 0, 0, 0.3, 0.7];

/**
 * spec: {melody (a string, or codes), key: {tonic, mode}, phase (1: an upbeat), strongEvery (units from strong to
 *        strong: 2), lo, hi (the bass's range in degrees: −7 the tonic an octave below the bass's, 7 above it),
 *        maxHold (units a bass note lasts at most: 4), cadences ([{at: unit, kind: "perfect" | "half"}]; by default a
 *        perfect one at the end), weights}
 */
export function harmonize(spec = {}) {
  const K = keyOf(spec.key || { tonic: "C" });
  const M = typeof spec.melody === "string" ? melodyUnits(spec.melody, K) : [...(spec.melody || [])];
  const n = M.length;
  if (!n) throw new Error("no melody");
  const phase = spec.phase ?? 0, every = spec.strongEvery ?? 2;
  const lo = spec.lo ?? -7, hi = spec.hi ?? 7, maxHold = spec.maxHold ?? 4, spacing = spec.spacing ?? 22;
  const strong = (t) => (t + phase) % every === 0;
  const cadences = new Map((spec.cadences ?? [{ at: n - 1, kind: "perfect" }]).map((c) => [c.at < 0 ? n + c.at : c.at, c.kind]));
  if (!cadences.has(n - 1)) cadences.set(n - 1, "perfect");

  const MD = (t) => D(M[t]);
  const mStruck = (t) => t === 0 || M[t] !== M[t - 1];
  const semi = (c) => K.semi(D(c), R(c));
  const codes = [];
  for (let d = lo; d <= hi; d++) { codes.push(2 * d); if (K.mutable(d)) codes.push(2 * d + 1); }

  /** The vertical at unit t with the bass b under the melody. */
  function vertical(t, b) {
    const steps = MD(t) - D(b), cls = mod(steps, 7), s = mod(semi(M[t]) - semi(b), 12);
    const q = cls === 0 ? (s === 0 ? "perfect" : "dissonant") : cls === 4 ? (s === 7 ? "perfect" : "dissonant")
            : cls === 2 ? (s === 3 || s === 4 ? "imperfect" : "dissonant") : cls === 5 ? (s === 8 || s === 9 ? "imperfect" : "dissonant") : "dissonant";
    return { steps, cls, q };
  }
  const consonant = (v) => v.q !== "dissonant";

  function melodicError(a, b) {
    const k = Math.abs(D(b) - D(a)), s = Math.abs(semi(b) - semi(a));
    if (k === 0) return "a chromatic step";
    if (k === 1) return s <= 2 ? null : "an augmented 2nd";
    if (k === 2) return s === 3 || s === 4 ? null : "this 3rd";
    if (k === 3) return s === 5 ? null : "an augmented 4th";
    if (k === 4) return s === 6 || s === 7 ? null : "an augmented 5th";
    if (k === 5) return s === 8 || s === 9 ? null : "this 6th";
    if (k === 7) return s === 12 ? null : "this octave";
    return k === 6 ? "a 7th" : "a leap wider than the octave";
  }
  const onsetOf = (U, j) => { let i = j; while (i > 0 && U[i - 1] === U[j]) i--; return i; };

  /** Why the bass b at unit t (after B[0..t-1]) is refused, or null. */
  function check(B, t, b) {
    if (t >= n) return "the melody is finished";
    if (D(b) < lo || D(b) > hi) return "out of range";
    const v = vertical(t, b);
    if (v.steps <= 0) return v.steps === 0 ? "the unison with the melody" : "above the melody";
    if (v.steps > spacing) return "too far from the melody";
    const prev = t >= 1 ? B[t - 1] : null;
    const held = prev !== null && b === prev, struck = !held;
    // the line
    if (held) {
      if (t - onsetOf(B, t - 1) >= maxHold) return `a bass note is held ${maxHold} units at most`;
    } else if (prev !== null) {
      const e = melodicError(prev, b); if (e) return e;
      const on = onsetOf(B, t - 1), a1 = on >= 1 ? B[on - 1] : null, step = D(b) - D(prev), before = a1 === null ? 0 : D(prev) - D(a1);
      if (a1 !== null && Math.abs(before) >= 3 && Math.abs(before) !== 7 && sign(step) === sign(before)) return "after a leap of a 4th or more the bass turns";
      if (K.mutable(D(prev)) && Math.abs(step) === 1) {
        if (step > 0 && !R(prev)) return `${K.name(D(prev), 0)} goes up raised (melodic minor)`;
        if (step < 0 && R(prev)) return `${K.name(D(prev), 1)} goes down natural (melodic minor)`;
      }
    }
    // what the unit before asks
    if (t >= 1) {
      const pv = vertical(t - 1, prev);
      if (!consonant(pv)) {
        if (strong(t - 1)) {
          const bassHeld = t >= 2 && B[t - 2] === prev;
          if (bassHeld) { if (!(struck && D(b) === D(prev) - 1)) return "the suspension resolves down by step (the bass)"; }
          if (!consonant(v)) return "the suspension resolves to a consonance";
        } else {
          const bassPassed = t >= 2 && B[t - 2] !== prev;
          if (bassPassed) {
            const a = B[onsetOf(B, t - 1) - 1];
            if (!(struck && D(b) - D(prev) === D(prev) - D(a))) return "the passing tone goes on by step, the same way";
          }
          if (!consonant(v)) return "two dissonances in a row";
        }
      }
    }
    if (!consonant(v)) {
      if (t === n - 1) return "the work does not end on a dissonance";
      if (t >= 1 && !consonant(vertical(t - 1, prev))) return "two dissonances in a row";
      if (t === 0) return "the work does not begin on a dissonance";
      const melHeld = !mStruck(t);
      if (strong(t)) {
        if (held === melHeld) return held ? "a dissonance with both voices held" : `a ${CLASS_FIG[v.cls]} (dissonant) on a strong unit must be prepared, one voice holding its note`;
        if (melHeld) {
          if (!(v.cls === 6 || v.cls === 3 || (v.cls === 1 && v.steps >= 8))) return "a suspension of the melody: a 7th, a 4th or a 9th";
          if (!(t + 1 < n && MD(t + 1) === MD(t) - 1)) return "the melody's suspension does not resolve down by step";
        } else if (v.cls !== 1) return "held in the bass: a 2nd (or 9th)";
      } else {
        if (!held) return "a dissonance on a weak unit: over a held bass";
        if (!(mStruck(t) && Math.abs(MD(t) - MD(t - 1)) === 1 && t + 1 < n && MD(t + 1) - MD(t) === MD(t) - MD(t - 1)))
          return "a dissonance on a weak unit: the melody passing by step";
      }
    }
    // parallels and direct motion into a perfect consonance
    if (t >= 1 && v.q === "perfect" && struck && mStruck(t)) {
      const pv = vertical(t - 1, prev);
      const bm = D(b) - D(prev), um = MD(t) - MD(t - 1);
      if (pv.q === "perfect" && pv.cls === v.cls && (bm !== 0 || um !== 0)) return `parallel ${v.cls === 0 ? "octaves" : "5ths"}`;
      if (sign(bm) === sign(um) && bm !== 0 && Math.abs(um) > 1) return `${v.cls === 0 ? "an octave" : "a 5th"} by direct motion, the melody leaping`;
    }
    // the start, the cadences, the end
    if (t === 0 && !(mod(D(b), 7) === 0 || (phase && mod(D(b), 7) === 4))) return phase ? "the bass begins on ① or ⑤" : "the bass begins on ①";
    const cad = cadences.get(t);
    if (cad === "perfect") {
      if (mod(D(b), 7) !== 0) return "a perfect cadence arrives on ①";
      if (!struck) return "the ① of a cadence is struck";
      if (prev !== null && mod(D(prev), 7) !== 4) return "a perfect cadence: ⑤–① in the bass";
      if (t === n - 1 && ![0, 2].includes(v.cls)) return "it ends on an octave or a 3rd";
    } else if (cad === "half") {
      if (mod(D(b), 7) !== 4) return "a half cadence rests on ⑤";
      if (!struck && !(prev !== null && t - onsetOf(B, t - 1) < 2)) return "the ⑤ of a half cadence is reached";
    }
    // the unit before a perfect cadence: the bass on ⑤ by then
    if (cadences.get(t + 1) === "perfect" && mod(D(b), 7) !== 4) return "before a perfect cadence the bass is on ⑤";
    return null;
  }

  // ─── the count, exact, memoized on the bass's last units (the rules look no further back) ───
  const memo = new Map(), back = Math.max(3, maxHold + 1);
  const keyOfB = (B, t) => t + ":" + B.slice(Math.max(0, t - back), t).join(",");
  function countFrom(B) {
    const t = B.length;
    if (t >= n) return 1n;
    const k = keyOfB(B, t), got = memo.get(k);
    if (got !== undefined) return got;
    let v = 0n;
    for (const c of codes) if (check(B, t, c) === null) { B.push(c); v += countFrom(B); B.pop(); }
    memo.set(k, v);
    return v;
  }
  const count = (B = []) => (B.length > n ? 0n : countFrom([...B]));
  const fan = (B = []) => codes.map((c) => {
    const r = check(B, B.length, c);
    return r ? { note: c, name: K.name(D(c), R(c)), reason: r } : { note: c, name: K.name(D(c), R(c)), reason: null, futures: count([...B, c]) };
  });
  function sample(r = Math.random, B0 = []) {
    const B = [...B0];
    while (B.length < n) {
      const cs = fan(B).filter((x) => !x.reason && x.futures > 0n);
      if (!cs.length) return null;
      const tot = cs.reduce((a, x) => a + x.futures, 0n);
      let x = (tot * BigInt(Math.floor(r() * 2 ** 52))) / 2n ** 52n;
      B.push((cs.find((c) => (x -= c.futures) < 0n) || cs[cs.length - 1]).note);
    }
    return B;
  }

  // ─── the soft rules and the engine ───
  // a bass is not a line of species counterpoint: it holds its notes (a tie costs nothing), goes back to ① and ⑤
  // (returning and hovering cost little) and leaps by 4ths and 5ths (leaps cost half)
  const W = { ...defaultWeights(), alternation: 0, tie: 0, return: 0.3, hover: 0.2, "leap-size": 0.5,
              ...Object.fromEntries(STYLE.map((r) => [r.id, r.weight])), ...(spec.weights || {}) };
  const melodyLine = M.map(D);
  const softCtx = (t, b) => ({
    N: 7, strong,
    lowerFirst: (x, c) => [x, c],                                // the bass is the voice written, and the lower
    quality: (l, h) => { const cl = mod(h - l, 7); return cl === 0 || cl === 4 ? "perfect" : cl === 2 || cl === 5 ? "imperfect" : "dissonant"; },
    dissonant: () => vertical(t, b).q === "dissonant",
    suspension: vertical(t, b).q === "dissonant" && strong(t),
  });
  function styleParts(B, b) {
    const t = B.length, parts = {}, deg = mod(D(b), 7), v = vertical(t, b);
    if (DEGREE_COST[deg]) parts.degree = W.degree * DEGREE_COST[deg];
    const ct = [0, 2, 4].includes(v.cls) ? 0 : v.cls === 5 ? 0.3 : 1;
    if (ct && consonant(v) === false) parts["chord-tone"] = W["chord-tone"] * ct; else if (ct) parts["chord-tone"] = W["chord-tone"] * ct;
    const prev = t ? B[t - 1] : null;
    if (prev !== null && b !== prev && !strong(t)) parts.rhythm = 0.5 * W.rhythm;
    if (prev !== null && b === prev && strong(t)) parts.rhythm = W.rhythm;
    for (const k of Object.keys(parts)) if (!parts[k]) delete parts[k];
    return parts;
  }
  function costParts(B, b) {
    const t = B.length, bl = B.map(D);
    return { ...melodicParts(bl, D(b), W), ...verticalParts(bl, melodyLine.slice(0, t), D(b), MD(t), softCtx(t, b), W), ...styleParts(B, b) };
  }
  function engine({ temp = 1, follow = true, r = Math.random } = {}, B0 = []) {
    const B = [...B0];
    while (B.length < n) {
      const cs = fan(B).filter((x) => !x.reason && x.futures > 0n).map((x) => ({ ...x, parts: costParts(B, x.note) }));
      cs.forEach((x) => { x.cost = total(x.parts); });
      const pick = choose(cs, temperature(temp, follow, count(B)), r);
      if (!pick) return null;
      B.push(pick.note);
    }
    return B;
  }
  const cost = (B) => B.reduce((a, c, t) => a + total(costParts(B.slice(0, t), c)), 0);
  function judge(B) {
    if (B.length !== n) return `${B.length} units, the melody has ${n}`;
    for (let t = 0; t < n; t++) { const r = check(B.slice(0, t), t, B[t]); if (r) return `unit ${t + 1}: ${r}`; }
    return null;
  }
  /** The figures over the bass: {fig, q} a unit. */
  const figures = (B) => B.map((b, t) => { const v = vertical(t, b); return { fig: v.cls === 0 ? 8 : CLASS_FIG[v.cls], q: v.q }; });

  return { spec, key: K, melody: M, n, phase, strong, cadences, lo, hi, codes, vertical, check, count, fan, sample, engine, cost, costParts, weights: W, judge, figures,
           code: (name) => codeOf(K, name), name: (c) => K.name(D(c), R(c)), hz: (c) => K.hz(D(c), R(c)), memo };
}

// ─── the chords: the figures realized in four parts ───
// Over each bass note the chord is its triad (5/3) or its first inversion (6/3), as the rule of the octave has it
// (①, ④, ⑤, ⑥ a 5/3; ②, ③, ⑦ a 6/3), unless the melody is a tone of the other one and not of this one; on a ⑤ that
// lasts from a strong unit, with the melody on ① or ③, the cadential 6/4 first. A melody note
// that is a tone of neither (a passing tone, a suspension) keeps the chord before. In minor the leading tone is
// raised in the chords of ⑤ and ⑦. The two inner voices are chosen for the whole piece at once (dynamic programming):
// each under the voice above it within an octave, the tenor over the bass, the leading tone not doubled, the third
// present; no parallel 5ths or 8ves between any two voices wherever a way without them exists (where none does, they
// are kept and named); and of what is left, the shortest way.
const ROOT_FIRST = [true, false, false, true, true, true, false];
const PARALLEL = 50;   // what parallels between the inner voices cost: avoided wherever a way without them exists

/** The chord over each unit: {root (a degree class), tones (degree classes), fig: "5/3" | "6/3" | "6/4"}. */
export function chordsOf(H, B) {
  const out = [];
  for (let t = 0; t < H.n; t++) {
    const bd = mod(D(B[t]), 7), md = mod(D(H.melody[t]), 7);
    if (t && B[t] === B[t - 1] && H.melody[t] === H.melody[t - 1]) { out.push(out[t - 1]); continue; }   // nothing moves
    const root53 = { root: bd, tones: [bd, mod(bd + 2, 7), mod(bd + 4, 7)], fig: "5/3" };
    const root63 = { root: mod(bd + 5, 7), tones: [bd, mod(bd + 2, 7), mod(bd + 5, 7)], fig: "6/3" };
    const [first, second] = ROOT_FIRST[bd] ? [root53, root63] : [root63, root53];
    // the cadential 6/4: ⑤ struck on a strong unit and held into the next, the melody a 6th or a 4th over it — the
    // tonic over the dominant's bass, before the dominant itself
    const cad64 = bd === 4 && H.strong(t) && t + 1 < H.n && B[t + 1] === B[t] && (t === 0 || B[t - 1] !== B[t]) && [0, 2].includes(md) && md !== mod(D(B[t + 1]), 7);
    let ch = cad64 ? { root: 0, tones: [4, 0, 2], fig: "6/4" } : first.tones.includes(md) ? first : second.tones.includes(md) ? second : null;
    if (!ch) ch = t && B[t] === B[t - 1] ? out[t - 1] : { ...first, passing: true };
    out.push(ch);
  }
  return out;
}

/**
 * The inner voices (alto, tenor) for the melody and the bass, as codes a unit. opts: {alto: [lo, hi], tenor: [lo,
 * hi]} in degrees (by default the alto from G3 to C5, the tenor from B2 to E4, in C).
 */
export function innerVoices(H, B, opts = {}) {
  const K = H.key, n = H.n, chords = chordsOf(H, B);
  const [aLo, aHi] = opts.alto ?? [4, 14], [tLo, tHi] = opts.tenor ?? [-1, 10];
  const minor = K.mode === "minor";
  const toneCode = (d, ch) => 2 * d + (minor && mod(d, 7) === 6 && (ch.root === 4 || ch.root === 6) ? 1 : 0);
  const sem = (c) => K.semi(D(c), R(c));
  const perfectSemis = (a, b) => { const s = mod(sem(a) - sem(b), 12); return s === 0 ? "8" : s === 7 ? "5" : null; };
  // the states of a unit: every (alto, tenor) that makes its chord
  const states = chords.map((ch, t) => {
    const s = D(H.melody[t]), b = D(B[t]), list = [];
    for (let a = aLo; a <= aHi; a++) for (let te = tLo; te <= tHi; te++) {
      if (!(s > a && a > te && te > b)) continue;
      if (s - a > 7 || a - te > 7) continue;
      if (!ch.tones.includes(mod(a, 7)) || !ch.tones.includes(mod(te, 7))) continue;
      const voices = [H.melody[t], toneCode(a, ch), toneCode(te, ch), B[t]];
      const cls = voices.map((c) => mod(D(c), 7));
      const third = mod(ch.root + 2, 7);
      if (!cls.includes(third)) continue;                                        // the third present
      const lead = minor || K.mode === "major" ? 6 : null;
      if (cls.filter((c) => c === lead).length > 1 && (ch.root === 4 || ch.root === 6)) continue;  // the leading tone not doubled
      let pen = 0;
      if (!cls.includes(mod(ch.root + 4, 7)) && ch.fig === "5/3") pen += 0.5;     // the fifth left out
      if (ch.fig === "6/3" && cls.filter((c) => c === mod(D(B[t]), 7)).length > 1) pen += 0.3; // the bass of a 6/3 doubled
      list.push({ a: voices[1], te: voices[2], pen });
    }
    return list;
  });
  // the shortest way through, without parallels
  const voicesAt = (t, st) => [H.melody[t], st.a, st.te, B[t]];
  function parallel(t, p, q) {
    const V0 = voicesAt(t - 1, p), V1 = voicesAt(t, q);
    for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) {
      const k0 = perfectSemis(V0[i], V0[j]), k1 = perfectSemis(V1[i], V1[j]);
      if (k0 && k0 === k1 && (V0[i] !== V1[i] || V0[j] !== V1[j]) && D(V1[i]) - D(V0[i]) !== 0 && sign(D(V1[i]) - D(V0[i])) === sign(D(V1[j]) - D(V0[j]))) return true;
    }
    return false;
  }
  let prevCost = states[0].map((s) => s.pen), back = [];
  if (!states[0].length) return { error: "unit 1: no chord in four parts fits" };
  for (let t = 1; t < n; t++) {
    if (!states[t].length) return { error: `unit ${t + 1}: no chord in four parts fits` };
    const cur = [], bk = [];
    for (const q of states[t]) {
      let best = Infinity, arg = -1;
      states[t - 1].forEach((p, i) => {
        if (prevCost[i] === Infinity) return;
        const c = prevCost[i] + q.pen + Math.abs(D(q.a) - D(p.a)) + Math.abs(D(q.te) - D(p.te)) + (parallel(t, p, q) ? PARALLEL : 0);
        if (c < best) { best = c; arg = i; }
      });
      cur.push(best); bk.push(arg);
    }
    back.push(bk); prevCost = cur;
  }
  let i = prevCost.indexOf(Math.min(...prevCost));
  if (prevCost[i] === Infinity) return { error: "no way through" };
  const path = [i];
  for (let t = n - 1; t >= 1; t--) { i = back[t - 1][i]; path.unshift(i); }
  const alto = path.map((k, t) => states[t][k].a), tenor = path.map((k, t) => states[t][k].te);
  // where no way avoids them, the parallels are kept and named
  const parallels = [];
  for (let t = 1; t < n; t++) if (parallel(t, states[t - 1][path[t - 1]], states[t][path[t]])) parallels.push(t);
  return { alto, tenor, chords, cost: Math.min(...prevCost), parallels };
}

// ─── as a musical tree (kairotic.mt) ───
const pitchName = (K, c) => K.name(D(c), R(c)).replace("♯", "#").replace("♭", "b").replace("𝄪", "##").replace("𝄫", "bb").toLowerCase();

/** The four parts as a tree: two staves, the upper (soprano + alto) and the lower (tenor + bass), a held note joined. */
export function treeOf(H, parts, { beatsPerUnit = 1, meter = [2, 4], tempo = 96 } = {}) {
  const K = H.key, n = H.n;
  const staff = (hiV, loV) => {
    const notes = [];
    for (let t = 0; t < n;) {
      let u = t + 1;
      while (u < n && hiV[u] === hiV[t] && loV[u] === loV[t]) u++;
      notes.push(`${pitchName(K, loV[t])}+${pitchName(K, hiV[t])}/${(u - t) * beatsPerUnit}`);
      t = u;
    }
    return notes.join(" ");
  };
  const upper = staff(parts.soprano, parts.alto), lower = staff(parts.tenor, parts.bass);
  return `[:piece {:tempo ${tempo} :key "${K.tonic} ${K.mode}"} [:voice {:name "upper"} [:measure {:meter [${meter.join(" ")}]} [:seq "${upper}"]]] [:voice {:name "lower" :clef "bass"} [:measure {:meter [${meter.join(" ")}]} [:seq "${lower}"]]]]`;
}

/** Everything at once: melody (string), key, … → {bass, alto, tenor, soprano, figures, chords, tree} or {error}. */
export function harmonizeAll(spec = {}, opts = {}) {
  const H = harmonize(spec);
  const B = opts.bass || (opts.sample ? H.sample(opts.r) : H.engine({ temp: opts.temp ?? 0.6, r: opts.r }));
  if (!B) return { error: "no bass fits this melody under the rules" };
  const why = H.judge(B);
  if (why) return { error: why };
  const inner = innerVoices(H, B, opts);
  if (inner.error) return inner;
  const parts = { soprano: H.melody, alto: inner.alto, tenor: inner.tenor, bass: B };
  const names = Object.fromEntries(Object.entries(parts).map(([k, v]) => [k, v.map(H.name)]));
  return { H, parts, names, figures: H.figures(B), chords: inner.chords, futures: H.count(), tree: treeOf(H, parts, opts) };
}

// ─── melodies to try ───
export const MELODIES = {
  "ah-vous-dirai-je": {
    name: "Ah, vous dirai-je, maman", ref: "the French song Mozart varied in K. 265: bars 1–8", key: { tonic: "C" }, meter: [2, 4],
    melody: "C5 C5 G5 G5 A5 A5 G5 - F5 F5 E5 E5 D5 D5 C5",
  },
  "ah-vous-dirai-je-b": {
    name: "Ah, vous dirai-je, maman (the middle)", ref: "K. 265, bars 9–16: a half cadence each time", key: { tonic: "C" }, meter: [2, 4],
    melody: "G5 G5 F5 F5 E5 E5 D5 - G5 G5 F5 F5 E5 E5 D5", cadences: [{ at: 6, kind: "half" }, { at: 14, kind: "half" }],
  },
  "minor-period": {
    name: "A period in A minor", ref: "written for this study: a question to ⑤, an answer to ①", key: { tonic: "A", mode: "minor" }, meter: [2, 4],
    melody: "E5 - C5 D5 E5 F5 E5 - D5 C5 B4 C5 B4 - E5 - C5 D5 E5 F5 E5 D5 C5 B4 A4",
    cadences: [{ at: 12, kind: "half" }],
  },
};

// ─── as MEI, for Verovio: the score the page shows ───
const SIG = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
const SHARPS = "FCGDAEB", FLATS = "BEADGCF";
const RELATIVE = { A: "C", E: "G", B: "D", "F#": "A", "C#": "E", "G#": "B", "D#": "F#", D: "F", G: "Bb", C: "Eb", F: "Ab", Bb: "Db", Eb: "Gb" };

/** The voices of four parts (codes a unit), a held note joined: [[{code, dur}…] ×4], and their staves. */
export function voicesOf(parts) {
  const order = ["soprano", "alto", "tenor", "bass"];
  const voices = order.map((k) => {
    const v = parts[k], out = [];
    v.forEach((c, t) => { if (t && c === v[t - 1]) out[out.length - 1].dur++; else out.push({ code: c, dur: 1 }); });
    return out;
  });
  return { voices, staves: [[0, 1], [2, 3]] };
}

/** MEI for Verovio: input {H, parts} or {H, voices, staves}; opts {meter: [2, 4], beatsPerUnit: 1}. */
export function meiOf(input, opts = {}) {
  const H = input.H, K = H.key;
  const { voices, staves } = input.voices ? { voices: input.voices, staves: input.staves || input.voices.map((_, i) => [i]) } : voicesOf(input.parts);
  const meter = opts.meter || input.spec?.meter || [2, 4], bpu = opts.beatsPerUnit ?? 1;
  const barBeats = meter[0] * (4 / meter[1]);
  const tonic = K.tonic.replace("♯", "#").replace("♭", "b");
  const fifths = SIG[K.mode === "minor" ? RELATIVE[tonic] ?? "C" : tonic] ?? 0;
  const sigLetters = fifths >= 0 ? SHARPS.slice(0, fifths) : FLATS.slice(0, -fifths);
  const sigAcc = fifths >= 0 ? "s" : "f";
  const DURS = [[4, "1", 0], [3, "2", 1], [2, "2", 0], [1.5, "4", 1], [1, "4", 0], [0.75, "8", 1], [0.5, "8", 0], [0.25, "16", 0]];
  const pieces = (beats) => { const out = []; let x = beats; while (x > 1e-6) { const d = DURS.find(([b]) => b <= x + 1e-6); if (!d) break; out.push(d); x -= d[0]; } return out; };
  const noteXml = (c, d, tie) => {
    const nm = H.name(c), m = /^([A-G])([♯♭𝄪𝄫]*)(-?\d+)$/.exec(nm);
    const letter = m[1], acc = { "": "n", "♯": "s", "♭": "f", "𝄪": "x", "𝄫": "ff" }[m[2]] || "n";
    const inSig = sigLetters.includes(letter) ? sigAcc : "n";
    const accAttr = acc === inSig ? (acc === "n" ? "" : ` accid.ges="${acc}"`) : ` accid="${acc}"`;
    return `<note pname="${letter.toLowerCase()}" oct="${m[3]}" dur="${d[1]}"${d[2] ? ` dots="${d[2]}"` : ""}${accAttr}${tie ? ` tie="${tie}"` : ""}/>`;
  };
  // each voice cut at the barlines: per measure, its notes
  const total = Math.max(...voices.map((v) => v.reduce((a, x) => a + x.dur, 0))) * bpu;
  const nBars = Math.ceil(total / barBeats - 1e-6);
  const byBar = voices.map((v) => {
    const bars = Array.from({ length: nBars }, () => []);
    let at = 0;
    for (const x of v) {
      let left = x.dur * bpu, start = at, first = true;
      while (left > 1e-6) {
        const bar = Math.floor(start / barBeats + 1e-6), room = (bar + 1) * barBeats - start, take = Math.min(left, room);
        const ps = pieces(take);
        ps.forEach((d, k) => {
          const last = left - take < 1e-6 && k === ps.length - 1;
          const tie = first && last ? null : first ? "i" : last ? "t" : "m";
          bars[bar]?.push(noteXml(x.code, d, tie)); first = false;
        });
        left -= take; start += take;
      }
      at += x.dur * bpu;
    }
    return bars;
  });
  const staffDefs = staves.map((sv, i) => {
    const ms = sv.flatMap((vi) => voices[vi].map((x) => K.midi(x.code >> 1, x.code & 1)));
    const low = ms.reduce((a, b) => a + b, 0) / ms.length < 60;
    return `<staffDef n="${i + 1}" lines="5" clef.shape="${low ? "F" : "G"}" clef.line="${low ? 4 : 2}"/>`;
  }).join("");
  const measures = Array.from({ length: nBars }, (_, b) => `<measure n="${b + 1}"${b === nBars - 1 ? ' right="end"' : ""}>` +
    staves.map((sv, i) => `<staff n="${i + 1}">` + sv.map((vi, l) => `<layer n="${l + 1}">${byBar[vi][b].join("") || `<mRest/>`}</layer>`).join("") + `</staff>`).join("") + `</measure>`).join("");
  return `<?xml version="1.0" encoding="UTF-8"?><mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0"><music><body><mdiv><score>` +
    `<scoreDef keysig="${fifths === 0 ? "0" : Math.abs(fifths) + sigAcc}" meter.count="${meter[0]}" meter.unit="${meter[1]}"><staffGrp symbol="brace" bar.thru="true">${staffDefs}</staffGrp></scoreDef>` +
    `<section>${measures}</section></score></mdiv></body></music></mei>`;
}
