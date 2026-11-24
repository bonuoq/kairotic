// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 63 · bridges: the most natural legal way from A to B (discussion #341).
//
// A Schrödinger bridge is the most likely random process from a given start to a given end, relative to a reference
// process that says which moves are natural. On a layered graph — a state a unit — it is a product of two messages:
// one forwards from the start, one backwards from the end. The futuribles (Study 38) already count the ways to the
// end exactly: that is the backward message with every way weighing one. Here each way weighs exp(−cost / T), the
// cost being the soft rules of every engine (soft.mjs, through the kernel's costParts) and GTTM's metrical weight;
// the hard rules weigh 0 (refused), so whatever a bridge draws is legal; and the ends are pinned states (the notes
// a passage fixes), not only the start of the work.
//
//   bridgeVoice   a voice over a kernel (partimento.mjs's schemata, through figuring.mjs): the backward message in
//                 the log domain, memoized on the kernel's window (the last three units, as its own count is), the
//                 forward draw by the product (the cost of a candidate on the whole line so far, its future's weight)
//   pins          units whose note is given (a waypoint): the start of a passage, its end, the notes a reduction
//                 keeps (Study 61's vary from depth k, now drawn exactly instead of by backtracking)
//   economy       a bar's figure is a word (@kairotic/rules' bits.mjs: its shape, in degrees from its first note):
//                 in the forward draw a figure heard before in the line is discounted, so a bridge prefers to
//                 say its way with the figures it has already said — a sequence (discussions #342, #399). The
//                 backward message does not see it (the line's memory, as the soft rules' climax and memory)
//   functions     the tonal functions (@kairotic/rules' functions.mjs) above the economy: the chord each unit's two
//                 voices imply, and a succession the grammar of a tonal phrase refuses (D → S, an applied dominant
//                 unresolved) weighing `functional` more — a unit's cost, read on the window, so the bridge stays exact
//   rhythms       a bridge between two rhythms of n pulses, a swap a step (an onset to the silence beside it, as
//                 @kairotic/rhythm's morph moves) or a stay, each rhythm weighing its onsets' metrical weight
//
// The window: the hard rules look three units back, so the backward message is exact for them; the soft cost of a
// future is read with the line as it stands at the window (memory, climax… are the line's), so the message is the
// future's weight as the window sees it — the forward draw then weighs each candidate on the whole line.
// Pure data and functions.

import { total } from "./soft.mjs";
import { figuring } from "./figuring.mjs";
import { keyOf, codeOf, codeDegree, codeAlter } from "./partimento.mjs";
import { rangeOf, endingOf, PER, LINE } from "./incipit.mjs";
import { survivors } from "./reduction.mjs";
import { word, lexicon, lengthOf, economyOf } from "./bits.mjs";
import { functionOf, impliedChord, grammarErrors } from "./functions.mjs";

const split = (s) => (Array.isArray(s) ? s : String(s || "").trim().split(/\s+/).filter(Boolean));
const LOG0 = -Infinity;
const lse = (a, b) => (a === LOG0 ? b : b === LOG0 ? a : Math.max(a, b) + Math.log1p(Math.exp(-Math.abs(a - b))));

// ─── a line's figures, as words ───
/** The word of the bar ending at unit t of a line of codes (per units a bar): its notes' steps in degrees from its
 *  first (as Study 64's cells, a shape relative to the bar's note), so a figure in sequence, at any pitch and however
 *  reached, is one word. */
export function figureAt(U, t, per = PER) {
  const t0 = t - (t % per), shape = [];
  for (let u = t0 + 1; u <= t; u++) shape.push(codeDegree(U[u]) - codeDegree(U[t0]));
  return word("bar", shape);
}
/** A line's figures (codes, per units a bar; the last bar may be short): its words, bar by bar. */
export const figuresOf = (U, per = PER) => U.map((_, t) => ((t + 1) % per === 0 || t === U.length - 1 ? figureAt(U, t, per) : null)).filter(Boolean);
/** A line's length as figures (bits.mjs): {bits, perWord, words}. */
export const figureLength = (U, per = PER, o = {}) => lengthOf(figuresOf(U, per), { kinds: 30, ...o });

/**
 * A bridge over a kernel's voice V ({n, codes, check(U, t, c), costParts(U, c)}): {logZ (the log weight of every
 * legal line through the pins), draw(r) → a line (codes) or null, map() → the likeliest line step by step}.
 * pins: Map unit → code. temp: the temperature (the lower, the more the cheapest ways weigh). extra(t, c, U): a cost
 * added to the rules' (a variation's novelty: the surface's own note dearer; a measured interval's, from U's last note).
 * economy (0: none): a bar's figure heard before in the line discounted in the forward draw (figureAt, bits.mjs).
 */
export function bridgeVoice(V, { pins = new Map(), temp = 0.6, window = 3, extra = null, economy = 0, per = PER } = {}) {
  const T = Math.max(1e-3, temp), n = V.n;
  const memo = new Map();
  // (extra(t, c, U): a cost of the bridge's own beside the rules', as a variation's novelty; U the line before t, read
  // no further back than the window)
  const cost = (U, c) => total(V.costParts(U, c)) + (extra ? extra(U.length, c, U) : 0);
  const cands = (t) => (pins.has(t) ? [pins.get(t)] : V.codes);
  /** log of the weight of every legal way from U (length t) to the end, through the pins. */
  function back(U) {
    const t = U.length;
    if (t >= n) return 0;
    const key = t + ":" + U.slice(Math.max(0, t - window)).join(",");
    const got = memo.get(key);
    if (got !== undefined) return got;
    let z = LOG0;
    for (const c of cands(t)) {
      if (V.check(U, t, c) !== null) continue;
      U.push(c);
      const rest = back(U);
      if (rest !== LOG0) z = lse(z, -cost(U.slice(0, t), c) / T + rest);
      U.pop();
    }
    memo.set(key, z);
    return z;
  }
  // (the economy: the figures of the line so far, heard; a candidate that ends a bar weighed by its figure)
  const ends = (t) => (t + 1) % per === 0 || t === n - 1;
  const heard = (U) => { const lex = lexicon({ kinds: 30 }); for (const f of figuresOf(U.slice(0, U.length - (U.length % per)), per)) lex.add(f); return lex; };
  /** The candidates at U's next unit with their log weight: the candidate's cost on the whole line, its future's. */
  function step(U, lex = economy ? heard(U) : null) {
    const t = U.length, out = [];
    for (const c of cands(t)) {
      if (V.check(U, t, c) !== null) continue;
      U.push(c);
      const rest = back(U);
      const e = economy && ends(t) ? economyOf(lex, figureAt(U, t, per), economy) : 0;
      U.pop();
      if (rest !== LOG0) out.push({ c, lw: -(cost(U, c) + e) / T + rest });
    }
    return out;
  }
  function walk(pick) {
    const U = [], lex = economy ? lexicon({ kinds: 30 }) : null;
    while (U.length < n) {
      const cs = step(U, lex);
      if (!cs.length) return null;
      U.push(pick(cs));
      if (economy && ends(U.length - 1)) lex.add(figureAt(U, U.length - 1, per));
    }
    return U;
  }
  const logZ = back([]);
  return {
    logZ, n, possible: logZ !== LOG0,
    /** A line drawn from the bridge (r: random numbers in [0, 1)). */
    draw: (r = Math.random) => walk((cs) => {
      const m = Math.max(...cs.map((x) => x.lw)), ws = cs.map((x) => Math.exp(x.lw - m));
      let x = r() * ws.reduce((a, b) => a + b, 0);
      for (let j = 0; j < cs.length; j++) { x -= ws[j]; if (x < 0) return cs[j].c; }
      return cs[cs.length - 1].c;
    }),
    /** The likeliest next note at each step (with its future): the bridge at temperature 0, step by step. */
    map: () => walk((cs) => cs.reduce((a, b) => (b.lw > a.lw ? b : a)).c),
    /** The candidates at a point, each with its probability given the line so far. */
    fan: (U) => { const cs = step([...U]); const m = Math.max(...cs.map((x) => x.lw)); const s = cs.reduce((a, x) => a + Math.exp(x.lw - m), 0); return cs.map((x) => ({ note: x.c, p: Math.exp(x.lw - m) / s })); },
  };
}

/** The melody's voice over a phrase's bass (figuring.mjs, the rules of every phrase), with the phrase's range. */
export function voiceOver(phrase, key, { per = PER, range = null, line = LINE } = {}) {
  const K = keyOf(key), rg = range || rangeOf(phrase, key);
  const bass = split(phrase.bass).map((nm) => { const c = codeOf(K, nm); return { d: codeDegree(c), r: codeAlter(c) }; });
  // (line: how strictly the melody moves, partimento.mjs's "free", "moderate" — the incipits' — or "strict")
  const F = figuring({ bass, key: K, per, ending: endingOf(phrase.cadence), line, lo: rg.lo, hi: rg.hi, ro: true });
  const name = (c) => F.name(c).replace("♯", "#").replace("♭", "b");
  return { F, V: F.voice, K, n: F.n, code: (nm) => codeOf(K, nm), name };
}

// ─── the tonal functions, as a cost of the bridge's ───
/**
 * A unit's functional cost over a voice (voiceOver's): weight for each succession the grammar of a tonal phrase
 * refuses between the unit before and this one (functions.mjs; each unit's chord its bass and the melody's note
 * imply). → extra(t, c, U), as bridgeVoice reads it.
 */
export function functionalCost(vo, key, weight = 6) {
  const K = vo.F.key, bassMidi = (t) => K.midi(vo.F.units[t].d, vo.F.units[t].r), memo = new Map();
  const fnAt = (t, c) => { const k = t + ":" + c; let f = memo.get(k); if (f === undefined) { f = functionOf(impliedChord([bassMidi(t), vo.F.midiOf(c)], key), key); memo.set(k, f); } return f; };
  return (t, c, U) => (t === 0 || !weight ? 0 : weight * grammarErrors([fnAt(t - 1, U[t - 1]), fnAt(t, c)], { key, end: false }).length);
}
/** A line's functions over its phrase (each unit's implied chord's), and the successions the grammar refuses. */
export function lineFunctions(phrase, key, melody, o = {}) {
  const vo = voiceOver(phrase, key, o), K = vo.F.key, mel = split(melody).map(vo.code);
  const fs = mel.map((c, t) => functionOf(impliedChord([K.midi(vo.F.units[t].d, vo.F.units[t].r), vo.F.midiOf(c)], key), key));
  return { fs, errors: grammarErrors(fs, { key, end: false }) };
}

// ─── vary from depth k, by a bridge (Study 61's, exactly) ───
/** Study 61's vary from level k as a bridge: the melody's notes that survive at k pinned on their units (held as
 *  long), the rest drawn from the bridge between them. {melody, kept, changed, logZ} or null. */
export function varyBridge(an, k, { temp = 0.6, r = Math.random, novelty = 1.5, economy = 0, functional = 0 } = {}) {
  const { V, code, name, n } = voiceOver(an.phrase, an.key, { per: an.per });
  const mel = split(an.phrase.melody), alive = survivors(an, k), pins = new Map();
  for (const x of an.notes) if (x.voice === "m" && alive.has(x.id)) for (let t = x.on; t < x.on + x.dur; t++) pins.set(t, code(x.pitch));
  if (n !== mel.length) throw new Error(`the melody has ${mel.length} units, its bass ${n}`);
  const orig = mel.map(code);
  // (as Study 61's vary: a note other than the surface's preferred where the bridge is free)
  const fc = functional ? functionalCost({ F: voiceOver(an.phrase, an.key, { per: an.per }).F }, an.key, functional) : null;
  const B = bridgeVoice(V, { pins, temp, economy, per: an.per, extra: (t, c, U) => (!pins.has(t) && c === orig[t] ? novelty : 0) + (fc ? fc(t, c, U) : 0) });
  if (!B.possible) return null;
  const U = B.draw(r);
  if (!U) return null;
  const names = U.map(name);
  return { melody: names.join(" "), kept: [...pins.keys()].sort((a, b) => a - b), changed: names.map((x, t) => (x !== mel[t] ? t : -1)).filter((t) => t >= 0), logZ: B.logZ };
}

// ─── a morph between two phrases: A's beginning, B's end, the bridge between ───
/**
 * From phrase A to phrase B (both in the key, each a bass and a melody of Study 58's), over A's bass then B's: the
 * first `head` units of A's melody and the last `tail` units of B's pinned, the middle drawn from the bridge — the
 * most natural legal way from the one to the other. {bass, melody, pinned: [units], logZ} or null.
 */
export function morphPhrases(A, B, key, { head = null, tail = null, temp = 0.6, r = Math.random, per = PER, economy = 0, functional = 0 } = {}) {
  const ma = split(A.melody), mb = split(B.melody), ba = split(A.bass), bb = split(B.bass);
  const bass = [...ba, ...bb], n = (bass.length - 1) * per + 1;
  // A's melody runs over its bass and its last note is held over A's last bar (as the join of two phrases is)
  const hA = head ?? Math.ceil(ma.length / 2), tB = tail ?? Math.ceil(mb.length / 2);
  const phrase = { bass: bass.join(" "), melody: Array(n).fill("C5").join(" "), cadence: B.cadence };
  const lo = Math.min(rangeOf(A, key).lo, rangeOf(B, key).lo), range = { lo, hi: lo + 12 };
  const vo = voiceOver(phrase, key, { per, range }), { V, code, name } = vo;
  const pins = new Map();
  for (let t = 0; t < hA; t++) pins.set(t, code(ma[t]));
  for (let j = 0; j < tB; j++) pins.set(n - tB + j, code(mb[mb.length - tB + j]));
  const Bd = bridgeVoice(V, { pins, temp, economy, per, extra: functional ? functionalCost(vo, key, functional) : null });
  if (!Bd.possible) return null;
  const U = Bd.draw(r);
  return U ? { bass: phrase.bass, melody: U.map(name).join(" "), pinned: [...pins.keys()].sort((a, b) => a - b), cadence: B.cadence, logZ: Bd.logZ } : null;
}

// ─── rhythms: a bridge in the space of swaps ───
/** The metrical level of each of n pulses (n's factors, twos first, as @kairotic/rhythm's vary reads the bar): 0 the
 *  downbeat, then the half bar… */
export function levels(n) {
  const fs = []; let m = n;
  for (let f = 2; m > 1; ) { if (m % f === 0) { fs.push(f); m /= f; } else f++; }
  fs.sort((a, b) => a - b);
  const spans = [n]; for (const f of fs) spans.push(spans[spans.length - 1] / f);
  return Array.from({ length: n }, (_, i) => spans.findIndex((s) => i % s === 0));
}
/** GTTM's metrical weight of pulse i of n: the downbeat the heaviest, each level below lighter. */
export const pulseWeight = (n) => { const L = levels(n), deep = Math.max(...L); return L.map((l) => deep - l); };

const key2 = (ps) => ps.join("");
/** The rhythms one swap away (an onset moved to the silence beside it, within the bar, as the swap distance counts)
 *  and the rhythm itself (a stay). */
export function neighbours(ps) {
  const n = ps.length, out = [ps];
  for (let i = 0; i < n; i++) {
    if (!ps[i]) continue;
    for (const d of [-1, 1]) {
      const j = i + d;
      if (j < 0 || j >= n || ps[j]) continue;
      const q = ps.slice(); q[i] = 0; q[j] = 1; out.push(q);
    }
  }
  return out;
}
/** Toussaint's swap distance between two rhythms with as many onsets (onsets paired in order, cyclically best). */
export function swapDistance(A, B) {
  const a = A.flatMap((x, i) => (x ? [i] : [])), b = B.flatMap((x, i) => (x ? [i] : []));
  if (a.length !== b.length) return Infinity;
  return a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0);
}

/**
 * A bridge between rhythms A and B (pulses, as many onsets) in `steps` steps, each a swap or a stay: every rhythm on
 * the way weighs exp(beat · its onsets' metrical weight / T), so the way passes through rhythms that sit well in the
 * bar. → {draw(r) → [rhythms A … B], map() → the likeliest way, possible, states}.
 */
export function bridgeRhythms(A, B, { steps = null, temp = 1, beat = 0.5, stay = 1 } = {}) {
  const n = A.length, W = pulseWeight(n), T = Math.max(1e-3, temp);
  const d = swapDistance(A, B), L = steps ?? d;
  // (a swap keeps the number of onsets: rhythms with as many, of as many pulses, and enough steps)
  if (B.length !== n || !Number.isFinite(d) || L < d) return { possible: false, steps: L, states: 0, draw: () => null, map: () => null, distance: d };
  const energy = (ps) => ps.reduce((s, x, i) => s + (x ? W[i] : 0), 0);
  const kB = key2(B);
  // the backward messages, step by step from the end: logb[s][rhythm] = log weight of the ways from it to B in s steps
  const back = [new Map([[kB, 0]])];
  const nb = new Map(), get = (ps) => { const k = key2(ps); let v = nb.get(k); if (!v) { v = neighbours(ps); nb.set(k, v); } return v; };
  const states = new Map([[key2(A), A]]);
  // the states reachable from A in s steps (forward), to bound the backward sums
  const reach = [new Map([[key2(A), A]])];
  for (let s = 1; s <= L; s++) {
    const m = new Map();
    for (const ps of reach[s - 1].values()) for (const q of get(ps)) { const k = key2(q); if (!m.has(k)) { m.set(k, q); states.set(k, q); } }
    reach.push(m);
  }
  const lw = (from, to) => (key2(from) === key2(to) ? Math.log(stay) : 0) + beat * energy(to) / T;
  for (let s = 1; s <= L; s++) {
    const prev = back[s - 1], m = new Map();
    for (const [k, ps] of reach[L - s]) {
      let z = LOG0;
      for (const q of get(ps)) { const b = prev.get(key2(q)); if (b !== undefined && b !== LOG0) z = lse(z, lw(ps, q) + b); }
      if (z !== LOG0) m.set(k, z);
    }
    back.push(m);
  }
  const possible = back[L].has(key2(A));
  function walk(pick) {
    if (!possible) return null;
    const way = [A];
    let cur = A;
    for (let s = L; s >= 1; s--) {
      const cs = get(cur).map((q) => ({ q, w: back[s - 1].get(key2(q)) })).filter((x) => x.w !== undefined && x.w !== LOG0).map((x) => ({ q: x.q, lw: lw(cur, x.q) + x.w }));
      cur = pick(cs); way.push(cur);
    }
    return way;
  }
  return {
    possible, steps: L, states: states.size, distance: d,
    draw: (r = Math.random) => walk((cs) => { const m = Math.max(...cs.map((x) => x.lw)), ws = cs.map((x) => Math.exp(x.lw - m)); let x = r() * ws.reduce((a, b) => a + b, 0); for (let j = 0; j < cs.length; j++) { x -= ws[j]; if (x < 0) return cs[j].q; } return cs[cs.length - 1].q; }),
    map: () => walk((cs) => cs.reduce((a, b) => (b.lw > a.lw ? b : a)).q),
  };
}
/** A rhythm read: "x..x..x." or [1,0,0,…]. */
export const rhythmOf = (s) => (Array.isArray(s) ? s : [...String(s)].filter((ch) => ch !== " " && ch !== "|").map((ch) => (ch === "x" || ch === "1" ? 1 : 0)));
export const showRhythm = (ps) => ps.map((x) => (x ? "x" : ".")).join("");
