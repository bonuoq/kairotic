// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 63 · bridges: the outer voices of a chorale phrase, from its first chord to its last (discussions
// #399, #353, the chorale test).
//
// A chorale phrase's soprano and bass drawn together, unit by unit, from chord A to chord B: a bridge (as this study's
// bridgeVoice) whose states are pairs (soprano, bass), exact for every cost that looks one unit back. The engine
// (@kairotic/rules' fromOuter, chorale-4) then writes the alto and the tenor. Its layers, each on or off, for the
// blind test (#399):
//
//   the rules      always: the two voices consonant on every unit (3rds, 6ths, 5ths, octaves — a 4th only as a
//                  6/4 on a strong unit before the cadence's dominant), no parallel or direct 5ths and octaves, no
//                  melodic tritone or 7th, the soprano's leaps a 6th at most (an octave too), the bass's an octave;
//                  the soprano above the bass by a 3rd to two octaves and a 5th; each voice in its range; the ends A
//                  and B pinned; the scale of the key, minor's 6th and 7th both ways, a raised ④ and a lowered ⑦
//                  for the applied dominants
//   the line       always: a step cheap, a leap dearer (the bass's cheaper than the soprano's), a repeated note in
//                  the soprano dear, the voices in similar motion a little dearer than in contrary; the cadence's
//                  bass ⑤–① or ⑦–① (a half cadence ending on ⑤), as the chorale's B asks
//   functions      the chord the two voices imply (functions.mjs' impliedChord), and a succession the grammar of a
//                  tonal phrase refuses (D → S, an applied dominant unresolved) weighing `functions` more
//   tension        each unit's chord as far from the tonic (tension.mjs, Lerdahl's global tension) as an arch
//                  asks: rising from A to its peak two thirds of the way, released into B — not Bach's own curve:
//                  the shape any phrase has
//   economy        the voices' motion together as a word (bits.mjs: "m|s,b", their steps in degrees), one said before cheaper
//                  — in the forward draw only (the line's memory), as this study's figure economy
//
// Pure data and functions.

import { impliedChord, functionOf, grammarErrors } from "./functions.mjs";
import { placed, distance, tonicOf, surface } from "./tension.mjs";
import { lexicon, economyOf } from "./bits.mjs";

const mod = (a, m) => ((a % m) + m) % m;
const LOG0 = -Infinity;
const lse = (a, b) => (a === LOG0 ? b : b === LOG0 ? a : Math.max(a, b) + Math.log1p(Math.exp(-Math.abs(a - b))));
const MAJOR = [0, 2, 4, 5, 7, 9, 11], MINOR = [0, 2, 3, 5, 7, 8, 10];
const TONICS = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const tonicPc = (key) => TONICS[String(key.tonic || "C").replace("♯", "#").replace("♭", "b")] ?? 0;
const isMinor = (key) => key.mode === "minor" || key.mode === "aeolian";

/** The pitch classes a voice may take in the key: its scale, minor's raised 6th and 7th, a raised ④ (V/V) and a
 *  lowered ⑦ (V/IV) for the applied dominants. */
export function pitchesOf(key) {
  const t = tonicPc(key), sc = isMinor(key) ? MINOR : MAJOR, extra = isMinor(key) ? [9, 11, 6] : [6, 10];
  return new Set([...sc, ...extra].map((x) => mod(t + x, 12)));
}
/** A pitch's degree in the key (0 … 6, by letter as the scale has it; an altered note the degree it alters). */
function degreeOf(p, key) {
  const t = tonicPc(key), sc = isMinor(key) ? MINOR : MAJOR, x = mod(p - t, 12);
  let i = 6;
  while (i > 0 && sc[i] > x) i--;
  // (a raised note belongs to the degree below: F♯ to ④ in C; a lowered ⑦ in major is still ⑦)
  return 7 * Math.floor((p - t) / 12) + i;
}

export const RANGES = { soprano: [60, 81], bass: [40, 62] };
const CONS = new Set([0, 3, 4, 7, 8, 9]);

/** Whether two simultaneous pitches are consonant for the outer voices (a 4th never; a tritone never). */
export const consonant = (s, b) => CONS.has(mod(s - b, 12));

/**
 * The outer voices' bridge for a phrase: {n, key, strong, A: [S, A, T, B], B, layers: {functions, tension, economy}}.
 * → {logZ, possible, draw(r) → {soprano, bass}, best() → {soprano, bass}}.
 */
export function outerBridge(phrase, { layers = {}, temp = 0.4, weights = {} } = {}) {
  const L = { functions: 6, tension: 2, economy: 1, ...layers };
  const W = { step: 0, third: 0.5, leap: 1.6, sixth: 3, octave: 2.5, bassLeap: 0.3, repeat: 1.2, bassRepeat: 1.2, sameChord: 0.8, back: 0.8, similar: 0.3, inverted: 0.3, chromatic: 0.6, outOfScale: 0.8, tessitura: 0.25, ...weights };
  const key = phrase.key, n = phrase.n || (phrase.satb ? phrase.satb.length : 0), strong = phrase.strong || [];
  const T = Math.max(1e-3, temp);
  const pcs = pitchesOf(key);
  const range = (r) => { const out = []; for (let p = r[0]; p <= r[1]; p++) if (pcs.has(mod(p, 12))) out.push(p); return out; };
  const S = range(RANGES.soprano), Bs = range(RANGES.bass);
  const a = phrase.A, b = phrase.B;
  // the states of a unit: pairs (s, b) consonant, the soprano above by a 3rd to two octaves and a 5th; the ends pinned
  const statesAt = (t) => {
    if (t === 0) return [[a[0], a[3]]];
    if (t === n - 1) return [[b[0], b[3]]];
    const out = [];
    for (const s of S) for (const bb of Bs) { const d = s - bb; if (d >= 3 && d <= 31 && consonant(s, bb)) out.push([s, bb]); }
    return out;
  };
  const states = Array.from({ length: n }, (_, t) => statesAt(t));
  // the chord each state implies, its function and its tension (memoized by pitches)
  const memo = new Map();
  const info = (s, bb) => {
    const k = s * 128 + bb;
    let v = memo.get(k);
    if (!v) {
      const ch = impliedChord([bb, s], key), f = functionOf(ch, key), p = placed(ch, key);
      v = { f, tension: p ? distance(tonicOf(key), p).d + surface(p) : 0, inverted: p ? p.chord.bass !== p.chord.root : false };
      memo.set(k, v);
    }
    return v;
  };
  // the arch the tension follows: 0 at A (its own tension), a peak two thirds of the way, 0 at B
  const peak = weights.peak ?? 6, at = Math.max(1, Math.round((n - 1) * 2 / 3));
  const arch = (t) => (t <= at ? peak * t / at : peak * (n - 1 - t) / Math.max(1, n - 1 - at));
  // (a melodic interval by its degrees and its semitones: augmented and diminished ones refused — the augmented 2nd of
  // minor's 6th and raised 7th, the tritone, the 7th —, a chromatic semitone allowed, dearer)
  const ALLOWED = { 0: [0, 1], 1: [1, 2], 2: [3, 4], 3: [5], 4: [7], 5: [8, 9], 7: [12] };
  // (each voice near its register: the middle of where the phrase begins and ends, the soprano a little above)
  const center = { s: weights.sopranoCenter ?? (phrase.A[0] + phrase.B[0]) / 2 + 1, b: weights.bassCenter ?? (phrase.A[3] + phrase.B[3]) / 2 + 2 };
  const melodic = (x, y, bass) => {
    const d = Math.abs(y - x), k = Math.abs(degreeOf(y, key) - degreeOf(x, key));
    if (!(ALLOWED[k] || []).includes(d)) return Infinity;
    if (!bass && d > 9) return Infinity;
    if (d === 0) return bass ? W.bassRepeat : W.repeat;
    if (k === 0) return W.chromatic;
    if (d <= 2) return W.step;
    if (d <= 4) return W.third;
    if (d === 12) return W.octave;
    return bass ? W.bassLeap + 0.1 * d : d >= 8 ? W.sixth : W.leap;
  };
  // (a note out of the scale, raised or lowered for an applied dominant or minor's ascent, goes on by step the way it
  // was bent: up after a raised one, down after a lowered one)
  const sc = new Set((isMinor(key) ? MINOR : MAJOR).map((x) => mod(tonicPc(key) + x, 12)));
  const bentOk = (x, y) => {
    if (sc.has(mod(x, 12))) return true;
    const up = isMinor(key) ? [9, 11, 6].map((v) => mod(tonicPc(key) + v, 12)).includes(mod(x, 12)) && mod(x - tonicPc(key), 12) !== 10 : mod(x - tonicPc(key), 12) === 6;
    return up ? y - x === 1 || y - x === 2 : x - y === 1 || x - y === 2;
  };
  const perfect = (s, bb) => { const i = mod(s - bb, 12); return i === 0 || i === 7; };
  /** The cost of going from state (s0, b0) at t − 1 to (s, bb) at t: the rules (Infinity), the line, the layers. */
  const step = (t, s0, b0, s, bb) => {
    const ms = melodic(s0, s, false), mb = melodic(b0, bb, true);
    if (ms === Infinity || mb === Infinity || !bentOk(s0, s) || !bentOk(b0, bb)) return Infinity;
    const ds = Math.sign(s - s0), db = Math.sign(bb - b0);
    // parallel and direct 5ths and octaves (the soprano leaping into a perfect interval in similar motion)
    if (perfect(s, bb) && ds === db && ds !== 0 && (perfect(s0, b0) && mod(s - bb, 12) === mod(s0 - b0, 12) || Math.abs(s - s0) > 2)) return Infinity;
    let c = ms + mb + (ds === db && ds !== 0 ? W.similar : 0);
    // (out of the scale a little dearer; each voice near the middle of its range)
    c += (sc.has(mod(s, 12)) ? 0 : W.outOfScale) + (sc.has(mod(bb, 12)) ? 0 : W.outOfScale);
    c += W.tessitura * (Math.abs(s - center.s) + Math.abs(bb - center.b)) / 2;
    const I = info(s, bb);
    if (strong[t] && I.inverted && t !== n - 1) c += W.inverted;
    // (the harmonic rhythm of a chorale: a new chord each unit, the same one again dearer)
    const I0x = info(s0, b0);
    if (I0x.f && I.f && I0x.f.chord.root === I.f.chord.root && I0x.f.chord.kind === I.f.chord.kind) c += W.sameChord;
    if (L.functions) { const I0 = info(s0, b0); c += L.functions * grammarErrors([I0.f, I.f], { key, end: false }).length; }
    if (L.tension && t > 0 && t < n - 1) c += L.tension * Math.abs(I.tension - arch(t)) / 5;
    return c;
  };
  // the cadence: the bass into B by ⑤–① (or ⑦–①), as B's bass asks — the unit before B a dominant's bass
  const cadenceOk = (t, bb, s) => {
    if (t !== n - 2) return true;
    const end = degreeOf(b[3], key), d = mod(degreeOf(bb, key) - end, 7);
    // (and the soprano into B's by step, or held)
    return (d === 4 || d === 6 || d === 3 || d === 1) && Math.abs(b[0] - s) <= 2;
  };
  // the backward messages: back[t][i] = log weight of every way from state i at t to B
  const back = Array.from({ length: n }, () => null);
  back[n - 1] = states[n - 1].map(() => 0);
  for (let t = n - 2; t >= 0; t--) {
    back[t] = states[t].map(([s0, b0]) => {
      let z = LOG0;
      states[t + 1].forEach(([s, bb], j) => {
        if (back[t + 1][j] === LOG0 || !cadenceOk(t + 1, bb, s)) return;
        const c = step(t + 1, s0, b0, s, bb);
        if (c !== Infinity) z = lse(z, -c / T + back[t + 1][j]);
      });
      return z;
    });
  }
  const logZ = back[0][0];
  function walk(pick) {
    if (logZ === LOG0) return null;
    const sop = [a[0]], bass = [a[3]];
    const lex = L.economy ? lexicon({ kinds: 30 }) : null;
    let i = 0;
    for (let t = 1; t < n; t++) {
      const [s0, b0] = states[t - 1][i], cs = [];
      states[t].forEach(([s, bb], j) => {
        if (back[t][j] === LOG0 || !cadenceOk(t, bb, s)) return;
        let c = step(t, s0, b0, s, bb);
        if (c === Infinity) return;
        // (the economy, forward only: the motions as words heard before; and a leap of a 4th or more turned back by
        // step, the soprano's line)
        if (lex) c += economyOf(lex, "m|" + (degreeOf(s, key) - degreeOf(s0, key)) + "," + (degreeOf(bb, key) - degreeOf(b0, key)), L.economy);
        if (sop.length >= 2) {
          const prevLeap = s0 - sop[sop.length - 2];
          if (Math.abs(prevLeap) >= 5 && (Math.sign(s - s0) === Math.sign(prevLeap) || Math.abs(s - s0) > 2)) c += 1;
          // (a note struck a third time in a row, dearer still; a step and back at once, a turn that goes nowhere)
          if (s === s0 && s0 === sop[sop.length - 2]) c += 1.5;
          if (s !== s0 && s === sop[sop.length - 2]) c += W.back;
          if (bb !== b0 && bb === bass[bass.length - 2]) c += W.back;
        }
        cs.push({ j, lw: -c / T + back[t][j] });
      });
      if (!cs.length) return null;
      i = pick(cs);
      const [s, bb] = states[t][i];
      if (lex) lex.add("m|" + (degreeOf(s, key) - degreeOf(s0, key)) + "," + (degreeOf(bb, key) - degreeOf(b0, key)));
      sop.push(s); bass.push(bb);
    }
    return { soprano: sop, bass };
  }
  return {
    logZ, possible: logZ !== LOG0, n,
    draw: (r = Math.random) => walk((cs) => {
      const m = Math.max(...cs.map((x) => x.lw)), ws = cs.map((x) => Math.exp(x.lw - m));
      let x = r() * ws.reduce((p, q) => p + q, 0);
      for (let k = 0; k < cs.length; k++) { x -= ws[k]; if (x < 0) return cs[k].j; }
      return cs[cs.length - 1].j;
    }),
    best: () => walk((cs) => cs.reduce((p, q) => (q.lw > p.lw ? q : p)).j),
    /** The first unit's candidates and their probabilities (for the page and the tests). */
    fanAt: (t, i = 0) => { const out = []; walk((cs) => { if (out.length === 0 && cs) { const m = Math.max(...cs.map((x) => x.lw)), z = cs.reduce((p2, x) => p2 + Math.exp(x.lw - m), 0); cs.forEach((x) => out.push({ state: states[1][x.j], p: Math.exp(x.lw - m) / z })); } return cs[0].j; }); return out; },
  };
}

/** The layers' names, and every combination the blind test asks: all on, and each one off. */
export const LAYERS = ["functions", "tension", "economy"];
export const VARIANTS = [{ name: "all", off: [] }, ...LAYERS.map((l) => ({ name: "no-" + l, off: [l] }))];

/**
 * Bridges for a phrase of the corpus, as the engine reads them: [{phrase, soprano, bass, key, strong, layers,
 * variant}] — for each variant (all layers, and each off) `count` draws.
 */
export function bridgesFor(phrase, { count = 2, r = Math.random, temp = 0.4 } = {}) {
  const n = phrase.satb.length, out = [];
  for (const v of VARIANTS) {
    const layers = Object.fromEntries(LAYERS.map((l) => [l, v.off.includes(l) ? 0 : undefined]).filter(([, x]) => x !== undefined));
    const B = outerBridge({ ...phrase, n }, { layers, temp });
    if (!B.possible) continue;
    for (let k = 0; k < count; k++) {
      const x = B.draw(r);
      if (x) out.push({ phrase: phrase.id, soprano: x.soprano, bass: x.bass, key: phrase.key, strong: phrase.strong, layers: LAYERS.filter((l) => !v.off.includes(l)), variant: v.name });
    }
  }
  return out;
}

/** The arch a phrase's tension follows (outerBridge's tension layer): 0 at its ends, `peak` two thirds of the way. */
export function archOf(n, peak = 6) { const at = Math.max(1, Math.round((n - 1) * 2 / 3)); return Array.from({ length: n }, (_, t) => (t <= at ? peak * t / at : peak * (n - 1 - t) / Math.max(1, n - 1 - at))); }
/** How many different motions (the voices' steps together, as the economy says them) a pair of lines has. */
export const motionWords = (x, key) => new Set(x.soprano.slice(1).map((s, t) => "m|" + (degreeOf(s, key) - degreeOf(x.soprano[t], key)) + "," + (degreeOf(x.bass[t + 1], key) - degreeOf(x.bass[t], key)))).size;
/** Whether a pair of lines keeps the rules every bridge keeps: consonant, no parallel 5ths or octaves, in range, the
 *  soprano above. → the reasons it does not (empty: it does). */
export function rulesBroken(x) {
  const out = [], S = x.soprano, B = x.bass;
  for (let t = 0; t < S.length; t++) {
    if (!consonant(S[t], B[t])) out.push(`unit ${t + 1}: dissonant`);
    if (S[t] - B[t] < 3) out.push(`unit ${t + 1}: the voices too close`);
    if (t && mod(S[t] - B[t], 12) % 7 === 0 && mod(S[t] - B[t], 12) === mod(S[t - 1] - B[t - 1], 12) && S[t] !== S[t - 1] && Math.sign(S[t] - S[t - 1]) === Math.sign(B[t] - B[t - 1])) out.push(`unit ${t + 1}: parallel ${mod(S[t] - B[t], 12) ? "5ths" : "octaves"}`);
  }
  return out;
}

/** A line's functions and its grammar's errors, its tension against the arch: what the layers did (for the tests and
 *  the page). */
export function measure(phrase, x) {
  const key = phrase.key, n = x.soprano.length;
  const fs = x.soprano.map((s, t) => functionOf(impliedChord([x.bass[t], s], key), key));
  const ten = x.soprano.map((s, t) => { const p = placed(impliedChord([x.bass[t], s], key), key); return p ? distance(tonicOf(key), p).d + surface(p) : 0; });
  return { functions: fs, errors: grammarErrors(fs, { key, end: false }).length, tension: ten,
           leaps: x.soprano.slice(1).filter((s, t) => Math.abs(s - x.soprano[t]) > 4).length, n };
}
