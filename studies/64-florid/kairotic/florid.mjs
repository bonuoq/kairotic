// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 64 · florid: florid counterpoint over a cantus firmus, every note justified by a derivation (#342).
//
// A note is legal if a legal derivation makes it. The derivation has three levels, each on its own metrical grid:
//
//   the frame     a note a half bar over the cantus firmus (the bass, a whole note a bar): second and fourth species,
//                 drawn by a bridge (Study 63) over the kernel every phrase answers to (partimento.mjs through
//                 figuring.mjs: consonance on the strong half, passing on the weak one, suspensions prepared and
//                 resolved, structural parallels refused…)
//   the rhythm    each bar's rhythm chosen first, a cell a half bar (CELLS: a half note, two quarters, a dotted quarter
//                 and an eighth, a quarter and two eighths — eighths only in pairs, on the weak quarter, as Fux
//                 writes them), the whole line's rhythm drawn by a bridge over the bars with GTTM's preferences:
//                 longer notes on stronger beats (MPR 5), a bar like the one before it once but not a third time
//                 (parallelism, MPR 1, with Study 60's sweet spot: coherence without monotony), the bar's second half
//                 the busier, and an arc of activity over the phrase (calm, busier towards its middle, calmer to the
//                 cadence)
//   the figures   each half bar of the frame, from its note a to the next one b, given its cell, a figure of the
//                 catalogue (FIGURES): a shape relative to a and b, and the notes where it may be dissonant — the
//                 dissonance it brings is justified by the frame it ornaments (a passing tone between a and b, a
//                 neighbour of a, an escape tone leaving a, a cambiata…); a suspension of the frame prepared by a
//                 half note held over the bar, resolved then or later; chosen with the melody's coherence on the
//                 surface (the soft rules of every engine on the florid line itself, a direction that goes on, a
//                 figure in sequence)
//   the ties      a note held into the next half bar (a suspension, an anticipation, a figure ending on the frame's
//                 next note) is never tied to a longer one, nor is an eighth tied (Fux's fifth species, Jeppesen: a
//                 half note tied to a half or a shorter value, never a quarter to a half): a hard rule of the rhythm's
//                 bridge, which draws no rhythm that would force it
//   the surface   the eighths, a note held across them one note (as every engine reads a name again)
//
// And the other way: the surface reduced by Study 61's grammar (protovoices.mjs, reduction.mjs) on the eighths' grid
// (GTTM's weights inside the bar: the half bar, the quarters, the eighths), each level checked on the frame's grid by
// the same kernel, until the frame comes back.
// Major keys for now (the figures move on the key's degrees). Pure data and functions.

import { keyOf, codeOf, codeDegree, codeAlter } from "./partimento.mjs";
import { consonant as cons, midiOf, notesOfPhrase } from "./protovoices.mjs";
import { bridgeVoice, voiceOver } from "./bridge.mjs";
import { reduce, survivors } from "./reduction.mjs";
import { exportMei, fromUnits, fileName } from "./export.mjs";
import { melodicParts, total } from "./soft.mjs";

const split = (s) => (Array.isArray(s) ? s : String(s || "").trim().split(/\s+/).filter(Boolean));
const HOLD = /held \d+ units? at most/;
/** Eighths a half bar (a unit of the frame), and a bar. */
export const SUB = 4, BAR = 8;

/** Cantus firmi (a whole note a bar, ending ②–①), as the bass. */
export const CANTI = {
  "c-major": { name: "C major, ten bars", key: { tonic: "C" }, cf: "C3 D3 F3 E3 A3 G3 F3 E3 D3 C3" },
  "c-short": { name: "C major, six bars", key: { tonic: "C" }, cf: "C3 E3 F3 G3 D3 C3" },
  "g-major": { name: "G major, eight bars", key: { tonic: "G" }, cf: "G2 A2 C3 B2 E3 D3 A2 G2" },
};

// ─── the rhythm: a cell a half bar (four eighths) ───
/** The cells of a half bar, in eighths: Fux's florid rhythms (eighths only in pairs, on the weak quarter). */
export const CELLS = { H: [4], Q: [2, 2], DQ: [3, 1], QE: [2, 1, 1] };

// ─── the figures ───
/**
 * The catalogue. Each figure: the cells it may take (its number of notes), its notes as offsets in steps from a (the
 * note it starts on) given s (the steps from a to b) and x ({sus: a is a suspension, tie: a is held into a suspension
 * on b, within: a and b in one bar}), when it fits, which of its notes may be dissonant (free; the others consonant
 * with the bass), its cost, and its name in the Baroque figures where it has one (Bernhard, Walther).
 */
export const FIGURES = [
  { id: "held", name: "the note held", cells: ["H"], shape: () => [0], fits: () => true, free: [], cost: 0.9 },
  { id: "passing", name: "a passing note (transitus)", cells: ["Q", "DQ"], shape: (s) => [0, Math.sign(s)], fits: (s, x) => Math.abs(s) === 2 && !x.sus, free: [1], cost: 0.2 },
  { id: "neighbor", name: "a neighbour", cells: ["Q", "DQ"], shape: (s, x) => [0, x.up ? 1 : -1], fits: (s, x) => s === 0 && !x.sus && !x.tie, free: [1], cost: 0.5, variants: [{ up: true }, { up: false }] },
  { id: "anticipation", name: "an anticipation (anticipatio)", cells: ["Q"], shape: (s) => [0, s], fits: (s, x) => Math.abs(s) === 1 && !x.sus && !x.tie, free: [1], cost: 1.3 },
  { id: "escape", name: "an escape tone (échappée)", cells: ["DQ", "Q"], shape: (s) => [0, -Math.sign(s)], fits: (s, x) => Math.abs(s) === 1 && !x.sus && !x.tie, free: [1], cost: 1.3 },
  { id: "skip", name: "a skip to a note of the chord", cells: ["Q", "DQ"], shape: (s, x) => [0, x.to], fits: (s, x) => !x.sus && !x.tie, free: [], cost: 0.8, variants: [{ to: 2 }, { to: -2 }, { to: 4 }, { to: -3 }] },
  { id: "tirata", name: "a run (tirata)", cells: ["QE"], shape: (s) => [0, Math.sign(s), 2 * Math.sign(s)], fits: (s, x) => Math.abs(s) === 3 && !x.sus && !x.tie, free: [1, 2], cost: 0.4 },
  { id: "turn", name: "a turn (circulatio)", cells: ["QE"], shape: (s) => [0, -Math.sign(s), 0], fits: (s, x) => Math.abs(s) === 1 && !x.sus && !x.tie, free: [1], cost: 0.5 },
  { id: "double-neighbor", name: "a double neighbour in eighths (groppo)", cells: ["QE"], shape: (s, x) => [0, x.up ? 1 : -1, x.up ? -1 : 1], fits: (s, x) => s === 0 && !x.sus && !x.tie, free: [1, 2], cost: 0.7, variants: [{ up: true }, { up: false }] },
  { id: "passing-eighths", name: "a skip filled in eighths", cells: ["QE"], shape: (s) => [0, 2 * Math.sign(s), Math.sign(s)], fits: (s, x) => Math.abs(s) === 2 && !x.sus && !x.tie, free: [2], cost: 0.7 },
  { id: "cambiata", name: "a cambiata (nota cambiata)", cells: ["QE"], shape: () => [0, -1, -3], fits: (s, x) => s === -2 && !x.sus && !x.tie, free: [1], cost: 0.8 },
  { id: "anticipated-resolution", name: "a suspension resolved early, in an eighth (anticipatio)", cells: ["DQ"], shape: () => [0, -1], fits: (s, x) => x.sus && s === -1, free: [], cost: 0.4 },
  { id: "ornamented-resolution", name: "a suspension resolved through a third below it (an ornamented resolution)", cells: ["Q"], shape: () => [0, -2], fits: (s, x) => x.sus && s === -1, free: [], cost: 0.5 },
];

/**
 * The frame's voice: the kernel of every phrase with its strictest line (partimento.mjs's "strict": leaps up to a 5th
 * or the octave, turned back by step from a 4th, never two the same way), and the species' own on top of it — no
 * leap of a tritone (augmented 4th, diminished 5th), no 6th but the minor one going up (Fux). {voice, V (its check
 * strict), phrase}.
 */
export function frameVoice(cf, key) {
  const bars = split(cf).length, n = (bars - 1) * 2 + 1;
  const phrase = { bass: split(cf).join(" "), melody: Array(n).fill("C5").join(" "), cadence: "perfect" };
  const vo = voiceOver(phrase, key, { line: "strict" });
  const V0 = vo.V;
  const species = (U, t, c) => {
    if (t < 1 || U[t - 1] === c) return null;
    const a = midiOf(vo.name(U[t - 1])), b = midiOf(vo.name(c)), s = b - a, m = Math.abs(s);
    if (m === 6) return "a leap of a tritone";
    if (m === 9) return "a leap of a major 6th";
    if (m === 8 && s < 0) return "a minor 6th going down";
    return null;
  };
  const V = { ...V0, check: (U, t, c) => V0.check(U, t, c) || species(U, t, c) };
  return { voice: { ...vo, V }, V, phrase, n };
}

/**
 * A frame drawn by a bridge over the cantus firmus: a note a half bar (units), legal under the rules of every phrase
 * with the strict line and the species' leaps (frameVoice). {voice, units (codes), names} or null.
 */
export function frameOf(cf, key, { temp = 0.6, r = Math.random } = {}) {
  const { voice, V, phrase } = frameVoice(cf, key);
  const B = bridgeVoice(V, { temp });
  if (!B.possible) return null;
  const U = B.draw(r);
  return U ? { voice, phrase, units: U, names: U.map(voice.name) } : null;
}

/** GTTM's metrical weight of an eighth of the bar: the downbeat, the half bar, the quarters, the eighths. */
const W8 = [1, 0, 0.3, 0, 0.6, 0, 0.3, 0];
/** The onsets and durations of a bar's rhythm (two cells). */
const notesOfBar = (r) => { const out = []; let p = 0; for (const c of r) for (const d of CELLS[c]) { out.push([p, d]); p += d; } return out; };
/** How busy a bar is: 0 (two half notes) … 1 (a quarter and two eighths twice). */
const activity = (r) => (notesOfBar(r).length - 2) / 4;

/**
 * A tie's rule (Fux, fifth species; Jeppesen): a note is never tied to a longer one — the first of a tied pair as long
 * as the second or longer (a half note to a half, a dotted quarter or a quarter; never a quarter to a half) — and
 * never an eighth (the first of a tie a beat at least). An option of a half bar keeps it with the next half bar's
 * cell: its last note, if held into the next half bar's first, as long as that one and a quarter at least.
 */
export const tieOk = (o, next) => !o.ties || (o.last >= 2 && o.last >= CELLS[next][0]);

/** A frame from its notes' names (one a half bar), as frameOf gives it: {voice, phrase, units, names}. */
export function frameFrom(cf, key, names) {
  const { voice, phrase } = frameVoice(cf, key);
  return { voice, phrase, units: names.map((nm) => voice.code(nm)), names: [...names] };
}

/**
 * Each half bar of a frame in its context, as the figures read it: s, the steps from its note a to the next one b; and
 * x: {sus: a is a suspension (held from the half bar before, dissonant on its strong half: this half bar resolves it),
 * tie: a is held into the next strong half, dissonant there (this half bar prepares it), within: a and b in one bar}.
 */
export function contextOf(frame) {
  const V = frame.voice.V, U = frame.units, n = U.length;
  const dis = (t, c) => V.vertical(t, c).q === "dissonant";
  const out = [];
  for (let t = 0; t < n - 1; t++) {
    const a = U[t], b = U[t + 1];
    out.push({ t, s: codeDegree(b) - codeDegree(a), x: { sus: t > 0 && U[t - 1] === a && t % 2 === 0 && dis(t, a), tie: b === a && (t + 1) % 2 === 0 && dis(t + 1, b), within: t % 2 === 0 } });
  }
  return out;
}

/** The options of each half bar of the frame: for each cell, the figures that fit it and keep the rules. costs: a
 *  figure's cost by its id, in place of the catalogue's (measured, see measure.mjs). */
function optionsOf(frame, cf, key, costs = {}) {
  const K = keyOf(key), U = frame.units, n = U.length, bass = split(cf);
  const deg = (c) => codeDegree(c), nameAt = (d) => K.name(d, 0).replace("♯", "#").replace("♭", "b");
  const bassAt = (t) => bass[Math.floor(t / 2)];
  const lo = frame.voice.F.voice.lo, hi = frame.voice.F.voice.hi;
  const ctx = contextOf(frame);
  const out = [];
  for (let t = 0; t < n - 1; t++) {
    const a = U[t], { s, x } = ctx[t];
    const byCell = {};
    for (const f of FIGURES) for (const v of f.variants || [{}]) {
      const xv = { ...x, ...v };
      if (!f.fits(s, xv)) continue;
      const shape = f.shape(s, xv), ds = shape.map((o) => deg(a) + o);
      if (ds.some((d) => d < lo || d > hi)) continue;
      const names = ds.map(nameAt), seq = [...names, frame.names[t + 1]];
      let ok = true;
      // no tritone, no 7th, nothing beyond the octave between two notes (a leap of the frame itself is the frame's)
      for (let j = 1; j < seq.length && ok; j++) { const m = Math.abs(midiOf(seq[j]) - midiOf(seq[j - 1])); if (m === 6 || m === 10 || m === 11 || m > 12) ok = false; }
      // the new notes not free consonant with the bass
      for (let j = 1; j < names.length && ok; j++) if (shape[j] !== 0 && !f.free.includes(j) && !cons(bassAt(t), names[j])) ok = false;
      // the last note to b over a new bass: no parallel 5ths or octaves on the surface either
      if (ok && (t + 1) % 2 === 0) {
        const last = names[names.length - 1], nb = bassAt(t + 1), ob = bassAt(t);
        const pi = (l, h) => { const d = ((midiOf(h) - midiOf(l)) % 12 + 12) % 12; return d === 0 ? 0 : d === 7 ? 7 : -1; };
        const i1 = pi(ob, last), i2 = pi(nb, frame.names[t + 1]);
        if (i1 >= 0 && i1 === i2 && Math.sign(midiOf(frame.names[t + 1]) - midiOf(last)) === Math.sign(midiOf(nb) - midiOf(ob)) && last !== frame.names[t + 1]) ok = false;
      }
      if (!ok) continue;
      // its last note the next half bar's first (the frame's b): held into it, a tie
      const ties = names[names.length - 1] === frame.names[t + 1];
      for (const c of f.cells) (byCell[c] = byCell[c] || []).push({ f, v, names, shape, cost: costs[f.id] ?? f.cost, ties, last: CELLS[c][CELLS[c].length - 1] });
    }
    out.push({ t, s, x, byCell });
  }
  return out;
}

/** The rhythm's weights (GTTM): MPR 5 (longer notes on stronger beats), parallelism (MPR 1), the bar's second half the
 *  busier, the arc of activity over the phrase. */
export const RHYTHM = { mpr5: 0.6, again: -0.6, third: 1.2, aba: -0.3, inner: 0.3, arc: 1.5 };

/**
 * The frame elaborated: first the rhythm, a cell a half bar, drawn by a bridge over the bars (RHYTHM's preferences, at
 * temperature rtemp), then each half bar's figure for its cell, chosen with the melody's coherence on the surface (the
 * soft rules on the florid line so far, a direction that goes on, a figure in sequence with the half bar before the
 * last), by a softmax at temperature temp. density: the arc's height (0 … 1). → {eighths (names), spans: [{unit,
 * cell, figure, name, notes}], rhythm: [cells a half bar], frame (names)} or null.
 */
export function elaborate(frame, cf, key, { temp = 0.5, rtemp = 0.5, r = Math.random, density = 0.6, weights = {}, costs = null } = {}) {
  const Wt = { ...RHYTHM, ...weights };
  const K = keyOf(key), U = frame.units, n = U.length;
  const opts = optionsOf(frame, cf, key, (costs && costs.figures) || {});
  const cellCost = (c) => (costs && costs.cells && costs.cells[c]) || 0;
  // the bars: half bars 2i and 2i+1 (the last half bar, the final note, apart)
  const bars = Math.floor((n - 1) / 2), nb = bars;
  const cellsOk = (t) => Object.keys(CELLS).filter((c) => opts[t].byCell[c] && opts[t].byCell[c].length);
  // the cheapest figure of half bar t on cell c that keeps the tie's rule with the next half bar's cell
  const minCost = (t, c, next) => Math.min(...opts[t].byCell[c].filter((o) => tieOk(o, next)).map((o) => o.cost));
  const barRhythms = Array.from({ length: nb }, (_, i) => {
    const out = [];
    for (const c1 of cellsOk(2 * i)) for (const c2 of cellsOk(2 * i + 1)) out.push([c1, c2]);
    return out;
  });
  if (barRhythms.some((l) => !l.length)) return null;
  const target = (i) => density * Math.sin(Math.PI * (i + 0.5) / nb);
  const key2 = (r_) => r_.join("-");
  /** The cost of bar i's rhythm rr after p (the bar before) and q (the one before it). */
  function cost(i, rr, p, q) {
    // the figures: this bar's first half (its next, the second); the bar before's second half (its next, this bar's
    // first); the last bar's second half too (its next, the final note, held)
    let c = minCost(2 * i, rr[0], rr[1]);
    if (p) c += minCost(2 * i - 1, p[1], rr[0]);
    if (i === nb - 1) c += minCost(2 * i + 1, rr[1], "H");
    if (c === Infinity) return Infinity;
    // the cells' own costs, where measured
    c += cellCost(rr[0]) + cellCost(rr[1]);
    const ns = notesOfBar(rr);
    // MPR 5: the downbeat's note the longest of the bar; a longer one on a weaker beat after it weighs against the
    // metre (a half note after a quarter on the downbeat), and more so off the half bar
    for (let j = 1; j < ns.length; j++) if (ns[j][1] > ns[0][1]) c += Wt.mpr5 * (1 - W8[ns[j][0]] / 2);
    // the bar's first half calmer than its second (the downbeat steady, the motion after it)
    if (CELLS[rr[0]].length > CELLS[rr[1]].length) c += Wt.inner;
    // parallelism: like the bar before once (a cell heard again), not a third time; like the one before that (A B A)
    if (p && key2(p) === key2(rr)) c += q && key2(q) === key2(rr) ? Wt.third : Wt.again;
    else if (q && key2(q) === key2(rr)) c += Wt.aba;
    // the arc
    c += Wt.arc * Math.abs(activity(rr) - target(i));
    return c;
  }
  // the bridge over the bars: backward messages on the state (the bar before, this bar)
  const T = Math.max(1e-3, rtemp), LOG0 = -Infinity;
  const lse = (x, y) => (x === LOG0 ? y : y === LOG0 ? x : Math.max(x, y) + Math.log1p(Math.exp(-Math.abs(x - y))));
  const beta = Array.from({ length: nb + 1 }, () => new Map());
  const sk = (p, cur) => (p ? key2(p) : "_") + "|" + key2(cur);
  for (let i = nb - 1; i >= 0; i--) {
    const prevs = i > 0 ? barRhythms[i - 1] : [null];
    for (const p of prevs) for (const cur of barRhythms[i]) {
      if (i === nb - 1) { beta[i].set(sk(p, cur), 0); continue; }
      let z = LOG0;
      for (const nx of barRhythms[i + 1]) z = lse(z, -cost(i + 1, nx, cur, p) / T + beta[i + 1].get(sk(cur, nx)));
      beta[i].set(sk(p, cur), z);
    }
  }
  const pick = (cs) => { cs = cs.filter((c) => c.lw > -Infinity); if (!cs.length) return null; const m = Math.max(...cs.map((c) => c.lw)), ws = cs.map((c) => Math.exp(c.lw - m)); let y = r() * ws.reduce((a, b2) => a + b2, 0); for (let j = 0; j < cs.length; j++) { y -= ws[j]; if (y < 0) return cs[j]; } return cs[cs.length - 1]; };
  const rhythm = [];
  let p = null, q = null;
  for (let i = 0; i < nb; i++) {
    const cs = barRhythms[i].map((rr) => ({ rr, lw: -cost(i, rr, p, q) / T + beta[i].get(sk(p, rr)) }));
    const pc = pick(cs);
    if (!pc) return null;
    const ch = pc.rr;
    rhythm.push(...ch); q = p; p = ch;
  }
  // the figures, a half bar at a time, the melody's coherence on the surface
  const eighths = [], spans = [], line = [];
  const deg = (nm) => codeDegree(codeOf(K, nm));
  for (let t = 0; t < n - 1; t++) {
    const cell = rhythm[t], next = t + 1 < n - 1 ? rhythm[t + 1] : "H", cands = opts[t].byCell[cell].filter((o) => tieOk(o, next));
    const prev = spans[t - 1], prev2 = spans[t - 2];
    const scored = cands.map((o) => {
      let c = o.cost;
      // the soft rules of every engine on the florid line itself (its notes struck, as degrees)
      const L = line.slice();
      for (const nm of o.names) { const d = deg(nm); if (L[L.length - 1] !== d) { c += 0.3 * total(melodicParts(L, d)); L.push(d); } }
      // a direction that goes on: a passing motion after one the same way
      const dir = (sh) => Math.sign(sh[sh.length - 1] - sh[0]);
      if (prev && prev.shape && dir(prev.shape) !== 0 && dir(prev.shape) === dir(o.shape)) c -= 0.2;
      // a figure in sequence: the same shape and cell as two half bars before (the same place in the bar before)
      if (prev2 && prev2.figure === o.f.id && prev2.cell === cell && prev2.shape.join() === o.shape.join()) c -= 0.4;
      return { ...o, cost: c };
    });
    const ch = choose(scored, temp, r);
    CELLS[cell].forEach((d, j) => { for (let k = 0; k < d; k++) eighths.push(ch.names[j]); });
    for (const nm of ch.names) { const d = deg(nm); if (line[line.length - 1] !== d) line.push(d); }
    spans.push({ unit: t, cell, figure: ch.f.id, name: ch.f.name, notes: ch.names, shape: ch.shape });
  }
  for (let j = 0; j < SUB; j++) eighths.push(frame.names[n - 1]);
  spans.push({ unit: n - 1, cell: "H", figure: "held", name: "the final note", notes: [frame.names[n - 1]], shape: [0] });
  return { eighths, spans, rhythm: [...rhythm, "H"], frame: frame.names };
}

function choose(opts, temp, r) {
  if (temp <= 0.001) return opts.reduce((a, b) => (b.cost < a.cost ? b : a));
  const m = Math.min(...opts.map((o) => o.cost)), ws = opts.map((o) => Math.exp((m - o.cost) / temp));
  let x = r() * ws.reduce((a, b) => a + b, 0);
  for (let j = 0; j < opts.length; j++) { x -= ws[j]; if (x < 0) return opts[j]; }
  return opts[opts.length - 1];
}

/** Florid counterpoint over a cantus firmus: the frame drawn, then elaborated. costs: {figures, cells} measured
 *  (measure.mjs). {frame, eighths, spans, rhythm} or null. */
export function florid(cf, key, { temp = 0.4, ftemp = 0.5, rtemp = 0.5, density = 0.6, r = Math.random, tries = 6, costs = null } = {}) {
  for (let i = 0; i < tries; i++) {
    const F = frameOf(cf, key, { temp, r });
    if (!F) return null;
    const E = elaborate(F, cf, key, { temp: ftemp, rtemp, r, density, costs });
    if (E) return { ...E, frameUnits: F.units };
  }
  return null;
}

// ─── the other way: the surface reduced ───
/** The surface as a phrase on the eighths' grid (a bass note a bar of eight eighths). */
export const surfacePhrase = (cf, eighths) => ({ bass: split(cf).join(" "), melody: eighths.join(" "), cadence: "perfect" });

/** A level's notes on the frame's grid: at each half bar, of the slice sounding there, the melody's note that sounds
 *  at that moment on the surface (a sonority spread keeps its notes, each at its own time), else its highest. */
export function frameAt(path, units, notes = null) {
  const at = new Map((notes || []).map((x) => [x.id, x])), out = [];
  for (let t = 0; t < units; t++) {
    const u = t * SUB, s = path.filter((x) => x.on <= u).pop();
    const mel = s.notes.filter((x) => x.voice === "m"), here = mel.find((x) => { const o = at.get(x.id); return o && o.on <= u && u < o.on + o.dur; });
    out.push((here || mel[mel.length - 1] || s.notes[s.notes.length - 1]).pitch);
  }
  return out;
}

/** A level judged on the frame's grid by the kernel of every phrase (every rule but how long a note is held), its
 *  errors' units on the eighths. */
export function judgeOn(cf, key) {
  const { voice: vo, n } = frameVoice(cf, key);
  let notes = null;
  const judge = (path) => {
    const names = frameAt(path, n, notes), U = [];
    const errors = [];
    for (let t = 0; t < n; t++) {
      let c;
      try { c = vo.code(names[t]); } catch (e) { errors.push({ unit: t * SUB + 1, reason: e.message }); break; }
      const why = vo.V.check(U, t, c);
      if (why && !HOLD.test(why)) errors.push({ unit: t * SUB + 1, at: `half bar ${t + 1}`, reason: why });
      U.push(c);
    }
    return { ok: !errors.length, errors };
  };
  // (the surface's notes, once known, so a level is read at each note's own time)
  judge.notes = (ns) => { notes = ns; return judge; };
  return judge;
}

/** The surface reduced (Study 61's grammar on the eighths' grid, judged on the frame's), and the level whose notes
 *  on the frame's grid are the frame: {an, levels: [names a half bar, a level each], found (the level, or −1)}. */
export function reduceFlorid(cf, key, eighths, frame = null) {
  const bars = split(cf).length, n = (bars - 1) * 2 + 1;
  const ph = surfacePhrase(cf, eighths);
  const an = reduce(ph, { key, per: BAR, judge: judgeOn(cf, key).notes(notesOfPhrase(ph, BAR)) });
  const levels = an.levels.map((p) => frameAt(p, n, an.notes));
  const found = frame ? levels.findIndex((L) => L.join(" ") === frame.join(" ")) : -1;
  return { an, levels, found };
}

/** How far a level's notes on the frame's grid are from the frame: the share of half bars where they agree. */
export const agreement = (a, b) => a.filter((x, i) => x === b[i]).length / a.length;
export { survivors };

// ─── as MEI, for the app (discussion #319) ───
/** The florid line over its cantus firmus as MEI: an eighth a unit, a bar of eight, a note held (the same name again)
 *  written as long as it lasts, tied over the bar line; the frame and the figures in the extMeta. → {mei, name}. */
export function meiOf(cf, key, line, { title = "Florid counterpoint over a cantus firmus" } = {}) {
  const bs = split(cf), total = line.eighths.length, bass = [], struck = [];
  for (let u = 0; u < total; u++) { bass.push(bs[Math.min(bs.length - 1, Math.floor(u / BAR))]); struck.push(u % BAR === 0); }
  const x = exportMei({
    title, source: "Kairotic Study 64 · florid", key, unitDen: 8, unitsPerBar: BAR, meter: [4, 4],
    voices: [{ label: "florid", clef: "G", notes: fromUnits(line.eighths) }, { label: "cantus firmus", clef: "F", notes: fromUnits(bass, struck) }],
    root: { study: "64 · florid", cf: bs.join(" "), frame: line.frame, figures: line.spans.map((sp) => sp.figure) },
  });
  return { mei: x.mei, name: fileName(title) };
}
