// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 74 · aoidos: a Greek style learned from the melodies that survive (corpus.mjs, seikilos.mjs).
//
// The engine chooses each beat among the notes its hard rules allow by a softmax of −cost: p(c) ∝ exp(−Σ w·f(c)),
// f the costs of every soft rule with weight 1 (soft.mjs's melodic ones and the accent's). A style is a set of
// weights w; the one the corpus speaks for is the one under which what Mesomedes wrote is most likely — the
// conditional logit, fitted by gradient ascent on the log-likelihood with a pull towards the engine's own weights
// (the corpus is small): ∂L/∂w = Σ (E_p[f] − f(observed)) − λ (w − w0). A note the hard rules refuse is said, not
// learned from (the rules are not the style's to change), and so is a note the editors supplied.

import { aoidos } from "./aoidos.mjs";
import { degreeOf, codeOf3, keyOf } from "./tonal.mjs";
import { defaultWeights } from "./soft.mjs";
import { prosodyWeights } from "./aoidos.mjs";

/** A melody a code a beat in a key, from MIDI numbers (moved by octaves to the key's register: shift). */
export function codesOfMidi(key, midis, shift = 0) {
  const K = keyOf(key);
  return midis.map((m) => { const dr = degreeOf(K, m + shift); return dr ? codeOf3(dr.d, dr.r) : undefined; });
}

/**
 * A piece of the corpus as the engine sees it: spec {piece (corpus.mjs's readPiece), key, shift (semitones to the
 * key's register), chromatic, ambitus, maxRepeat, weights} → {A (aoidos on the piece's own time), U (its melody, a
 * code a beat), skip (beats not to learn from: supplied notes, unreliable lines)}.
 */
export function asEngine({ piece, key, shift = 0, chromatic = [], ambitus, maxRepeat = 8, turnAfterSmallLeap = true, weights }) {
  const A = aoidos({ time: piece.syllables, key, chromatic, ambitus, maxRepeat, turnAfterSmallLeap, weights });
  const U = codesOfMidi(key, piece.beats, shift);
  const skip = [];
  piece.syllables.forEach((y) => { let t = y.at; for (const x of y.notes) { for (let j = 0; j < x.chronoi; j++) skip[t + j] = !y.reliable || x.supplied; t += x.chronoi; } });
  return { A, U, skip, piece };
}

/**
 * Each beat's choice: the notes allowed there and their costs (every rule at weight 1), and which was written.
 * → {choices [{t, cands [{c, f {id: value}}], obs (its index)}], refused [{t, code, why}]}.
 */
export function choicesOf({ A, U, skip }) {
  const choices = [], refused = [];
  for (let t = 0; t < U.length; t++) {
    if (U[t] === undefined) { refused.push({ t, code: null, why: "a note out of the mode" }); continue; }
    const before = U.slice(0, t), why = A.why(before, t, U[t]);
    if (why) { refused.push({ t, code: U[t], why: why.reason, rule: why.id }); continue; }
    if (skip[t]) continue;
    const cands = A.codes.filter((c) => A.check(before, t, c) === null).map((c) => ({ c, f: A.costParts(before, c) }));
    choices.push({ t, cands, obs: cands.findIndex((x) => x.c === U[t]) });
  }
  return { choices, refused };
}

const dot = (w, f) => { let s = 0; for (const id in f) s += (w[id] ?? 0) * f[id]; return s; };

/** The log-likelihood of the choices under weights w (natural log), and how often the written note is the cheapest. */
export function score(choices, w) {
  let ll = 0, first = 0;
  for (const { cands, obs } of choices) {
    const e = cands.map((x) => -dot(w, x.f)), m = Math.max(...e);
    const z = e.reduce((a, v) => a + Math.exp(v - m), 0);
    ll += e[obs] - m - Math.log(z);
    if (e[obs] >= m - 1e-9) first++;
  }
  return { ll, perChoice: ll / Math.max(1, choices.length), first, n: choices.length };
}

/**
 * The weights under which the choices are most likely: gradient ascent from w0 (the engine's), pulled towards it by
 * lambda, weights kept ≥ 0. → {w, before, after (score), ids}.
 */
export function fit(choices, { w0 = { ...defaultWeights(), ...prosodyWeights() }, lambda = 0.5, rate = 0.02, iters = 600 } = {}) {
  const ids = [...new Set(choices.flatMap((x) => x.cands.flatMap((c) => Object.keys(c.f))))].sort();
  const w = Object.fromEntries(ids.map((id) => [id, w0[id] ?? 1]));
  const before = score(choices, w);
  for (let it = 0; it < iters; it++) {
    const g = Object.fromEntries(ids.map((id) => [id, -lambda * (w[id] - (w0[id] ?? 1))]));
    for (const { cands, obs } of choices) {
      const e = cands.map((x) => -dot(w, x.f)), m = Math.max(...e), p = e.map((v) => Math.exp(v - m)), z = p.reduce((a, v) => a + v, 0);
      for (let k = 0; k < cands.length; k++) for (const id in cands[k].f) g[id] += (p[k] / z) * cands[k].f[id];
      for (const id in cands[obs].f) g[id] -= cands[obs].f[id];
    }
    for (const id of ids) w[id] = Math.max(0, w[id] + rate * g[id] / Math.max(1, choices.length) * 10);
  }
  return { w, before, after: score(choices, w), ids };
}

export default { asEngine, choicesOf, score, fit, codesOfMidi };
