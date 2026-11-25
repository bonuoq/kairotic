// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 71 · blind: the chorale test (discussions #353, #399, #301). A phrase of Bach's and a bridge — the
// same phrase's first and last chords joined by Study 63's outer voices (outer.mjs: functions, tension, economy, each
// layer on or off), the alto and the tenor written by @kairotic/rules' fromOuter (bach-4) — heard one after the other
// in either order: which is Bach? Where listeners cannot tell, the bridge sounds as his; where they can, the variant
// says which layer they heard missing.
//
//   fill(bridge)      the inner voices of a bridge (bach-4), from Bach's first chord to his last (the alto and the tenor
//                     given there, as the soprano and the bass are), or why none: the bridges no rule can fill are a
//                     result too
//   bachOf(phrase)    Bach's four voices, as the corpus has them (a chord a quarter, a note held where he holds it)
//   deckOf(…)         the trials, drawn once and kept (deck.json): for each variant, phrases not used before, a bridge
//                     of that variant filled — the bridges tried and not filled counted
//   sessionOf(…)      a listening: some trials of each variant, shuffled, Bach first or second at random
//   score(answers)    for each variant: how often Bach was found, its 95% interval (Wilson) and an exact binomial p
//                     against chance (0.5); lower is better for the bridges
//   soundOf(item)     the notes to play: a quarter a unit, a note held tied, the last chord a fermata
//
// Pure data and functions.

import { fromOuter } from "./rules.mjs";

export const VARIANTS = ["all", "no-functions", "no-tension", "no-economy", "arch"];
export const VOICES = ["soprano", "alto", "tenor", "bass"];

export const rng = (seed) => { let s = seed % 2147483647 || 1; return () => ((s = (s * 16807) % 2147483647) - 1) / 2147483646; };

/** A voice given unit by unit (MIDI) as notes for fromOuter: a note repeated onto a weak unit is held, onto a strong
 *  one struck again. */
export function notesOf(xs, strong, keys = null) {
  const out = [], kOf = (t) => (keys && keys[t] ? (typeof keys[t] === "string" ? keys[t] : keyName(keys[t])) : null);
  xs.forEach((m, t) => {
    if (t && out[out.length - 1].midi === m && !strong[t] && kOf(t) === kOf(t - 1)) { const o = out[out.length - 1]; o.units++; o.strong.push(!!strong[t]); }
    else out.push({ midi: m, units: 1, strong: [!!strong[t]], ...(kOf(t) ? { key: kOf(t) } : {}) });
  });
  return out;
}
/** The units where a voice given as notes is held (its note begun before). */
const heldOf = (notes) => notes.flatMap((n) => Array.from({ length: n.units }, (_, k) => k > 0));
const keyName = (k) => `${String(k.tonic).replace("♯", "#").replace("♭", "b")} ${k.mode || "major"}`;

/** The inner voices of a bridge by bach-4: {satb: [[s, a, t, b]…] (MIDI), held: [[…4]…]}, or {fail: why}. phrase:
 *  Bach's, whose first and last chords the bridge keeps whole (its alto and tenor given there). temp: the engine's
 *  (its soft rules weighed — Bach's own moves, bach-motion, and the functions in local keys among them —; 0 the
 *  likeliest; 1, as the style was measured, moves as often as Bach's inner voices do). A note an inner voice keeps is
 *  struck again, as Bach mostly does, but where it is held into a dissonance with the bass (a suspension). */
export function fill(bridge, { phrase = null, r = Math.random, temp = 1, style = "bach-4" } = {}) {
  // (the bass's units in their keys where the bridge gives them — a tonicization: the inner voices may then take its
  // leading tone, as Bach's do)
  const S = notesOf(bridge.soprano, bridge.strong), B = notesOf(bridge.bass, bridge.strong, bridge.keys || null), n = bridge.soprano.length;
  const ends = (i) => Array.from({ length: n }, (_, t) => (t === 0 || t === n - 1 ? { midi: phrase.satb[t][i], ...(phrase.names ? { name: phrase.names[t][i] } : {}) } : null));
  const inner = phrase ? { alto: ends(1), tenor: ends(2) } : undefined;
  let ob;
  try { ob = fromOuter({ bass: B, soprano: S, key: keyName(bridge.key), style, inner }); } catch (e) { return { fail: e.message || String(e) }; }
  if (ob.count() === 0n) {
    const d = ob.deadEnd ? ob.deadEnd() : null;
    const top = d && d.reasons ? d.reasons.filter(([w]) => w !== "the soprano is given")[0] : null;
    return { fail: d ? `no inner voices: unit ${d.unit + 1}${top ? `, ${top[0]}` : ""}` : "no inner voices" };
  }
  const W = ob.engine({ temp, r });
  if (!W) return { fail: "no inner voices" };
  const hS = heldOf(S), hB = heldOf(B);
  const satb = Array.from({ length: n }, (_, t) => [bridge.soprano[t], ob.midi(W.alto[t]), ob.midi(W.tenor[t]), bridge.bass[t]]);
  const into = (m, t) => [1, 2, 5, 6, 10, 11].includes((((m - bridge.bass[t]) % 12) + 12) % 12);
  const keep = (V, i, t) => t > 0 && V[t] === V[t - 1] && into(satb[t][i], t);
  const held = Array.from({ length: n }, (_, t) => [hS[t], keep(W.alto, 1, t), keep(W.tenor, 2, t), hB[t]]);
  return { satb, held };
}

/** Bach's phrase as the corpus has it: {satb, held}. */
export const bachOf = (p) => ({ satb: p.satb.map((c) => c.slice()), held: p.held.map((h) => h.slice()) });

/**
 * The deck: perVariant trials of each variant, each on a phrase of its own (no phrase twice in the deck), its bridge
 * one of that phrase's draws of the variant that bach-4 can fill. phrases: the corpus's; bridges: bridges.json's.
 * {trials: [{id, phrase, variant, draw, key, strong, bach, bridge}], tried: {variant: {tried, filled}}, failures: {why: n}}
 */
export function deckOf(phrases, bridges, { perVariant = 40, seed = 71, temp = 1, maxLen = 16, log = null } = {}) {
  const r = rng(seed), P = new Map(phrases.map((p) => [p.id, p]));
  const of = new Map();
  for (const b of bridges) { const k = `${b.phrase}|${b.variant}`; if (!of.has(k)) of.set(k, []); of.get(k).push(b); }
  // (the phrases with a bridge of every variant, no longer than maxLen units, in an order drawn once)
  const ids = [...P.keys()].filter((id) => P.get(id).satb.length <= maxLen && VARIANTS.every((v) => of.has(`${id}|${v}`)));
  for (let i = ids.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [ids[i], ids[j]] = [ids[j], ids[i]]; }
  const trials = [], tried = Object.fromEntries(VARIANTS.map((v) => [v, { tried: 0, filled: 0 }])), failures = {};
  let next = 0;
  for (let k = 0; k < perVariant; k++) for (const v of VARIANTS) {
    let done = false;
    while (!done && next < ids.length) {
      const id = ids[next++], p = P.get(id);
      tried[v].tried++;
      for (const [draw, b] of of.get(`${id}|${v}`).entries()) {
        const f = fill(b, { phrase: p, r, temp });
        if (f.fail) { const w = f.fail.replace(/unit \d+/, "unit #").replace(/\d+/g, "#"); failures[w] = (failures[w] || 0) + 1; continue; }
        tried[v].filled++;
        trials.push({ id: `${id}/${v}/${draw}`, phrase: id, variant: v, draw, title: p.title, bwv: p.bwv, key: p.key, strong: p.strong, bach: bachOf(p), bridge: f });
        done = true;
        break;
      }
      if (log) log(`${trials.length} trials · ${id} ${v} ${done ? "filled" : "not filled"}`);
    }
  }
  return { trials, tried, failures };
}

/** A listening: perVariant trials of each variant, shuffled; Bach first or second at random. [{trial, bachFirst}] */
export function sessionOf(deck, { perVariant = 4, seed = Date.now(), done = new Set() } = {}) {
  const r = rng(seed), out = [];
  for (const v of VARIANTS) {
    const pool = deck.trials.filter((t) => t.variant === v && !done.has(t.id));
    for (let i = pool.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [pool[i], pool[j]] = [pool[j], pool[i]]; }
    out.push(...pool.slice(0, perVariant));
  }
  for (let i = out.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [out[i], out[j]] = [out[j], out[i]]; }
  return out.map((trial) => ({ trial, bachFirst: r() < 0.5 }));
}

// ─── the statistics ───
const lnFact = (() => { const c = [0]; return (n) => { for (let i = c.length; i <= n; i++) c[i] = c[i - 1] + Math.log(i); return c[n]; }; })();
const binom = (n, k) => Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k) - n * Math.LN2);
/** The exact two-sided binomial p of k of n against 0.5. */
export function binomialP(k, n) {
  if (!n) return 1;
  const pk = binom(n, k);
  let p = 0;
  for (let i = 0; i <= n; i++) { const pi = binom(n, i); if (pi <= pk * (1 + 1e-9)) p += pi; }
  return Math.min(1, p);
}
/** Wilson's 95% interval of k of n. */
export function wilson(k, n, z = 1.96) {
  if (!n) return [0, 1];
  const ph = k / n, d = 1 + (z * z) / n, c = (ph + (z * z) / (2 * n)) / d, h = (z * Math.sqrt((ph * (1 - ph)) / n + (z * z) / (4 * n * n))) / d;
  return [Math.max(0, c - h), Math.min(1, c + h)];
}
/** answers: [{id, variant, correct, sure}] → {variant: {n, found, rate, ci, p, sure: {n, found}}, overall: …} */
export function score(answers) {
  const of = (as) => {
    const n = as.length, found = as.filter((a) => a.correct).length, s = as.filter((a) => a.sure);
    return { n, found, rate: n ? found / n : null, ci: wilson(found, n), p: binomialP(found, n), sure: { n: s.length, found: s.filter((a) => a.correct).length } };
  };
  return { ...Object.fromEntries(VARIANTS.map((v) => [v, of(answers.filter((a) => a.variant === v))])), overall: of(answers) };
}

/** The notes to play of {satb, held}: a quarter a unit (unit seconds), a note held tied to the one before, the last
 *  chord held fermata times longer. [{midi, on, dur, voice}] */
export function soundOf({ satb, held }, { unit = 0.62, fermata = 2.2 } = {}) {
  const n = satb.length, notes = [], len = (t) => (t === n - 1 ? unit * fermata : unit);
  const on = []; let at = 0;
  for (let t = 0; t < n; t++) { on.push(at); at += len(t); }
  for (let v = 0; v < 4; v++) for (let t = 0; t < n; t++) {
    if (t && held[t][v] && satb[t][v] === satb[t - 1][v]) { notes[notes.length - 1].dur += len(t); continue; }
    notes.push({ midi: satb[t][v], on: on[t], dur: len(t), voice: VOICES[v] });
  }
  return notes.sort((a, b) => a.on - b.on || b.midi - a.midi);
}
/** How long a phrase lasts, in seconds. */
export const lengthOf = (item, o = {}) => Math.max(...soundOf(item, o).map((x) => x.on + x.dur));
