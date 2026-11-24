// SPDX-License-Identifier: MPL-2.0
// Study 66 · compression (discussion #399): the shortest description of a piece.
//
// A piece is a stream of notes in the order they begin (simultaneous ones from low to high), each its pitch (MIDI),
// how long it lasts and how long until the next begins (in 16ths). Its description is a set of rules and the piece
// written with them; its length is counted in bits (minimum description length, MDL): a note written out costs its
// pitch and its rhythm; a rule costs once what it says, and each use only what changes. The best description is
// the shortest. Three kinds of rule, the formulas a Baroque prelude is made of:
//   figure  a pattern of a few pitches with its rhythm, used over other pitches: [0 1 2 3 4 2 3 4] over C E G C E —
//           a broken chord (Bach's C major prelude), the cello's string-crossing figures
//   motif   the same intervals and rhythm from another pitch: a transposed repetition, a sequence
//   repeat  the same, n times in a row
// Rules are found greedily, the one that saves most bits first; figures and motifs over notes, repeats over notes and
// over uses of rules (two halves of a bar). What it finds can always be written out again (expand), the same notes:
// the compression is lossless, and checked.

import { lexicon } from "./bits.mjs";

export const PITCH_BITS = 7;

/** A piece from [[onset dur midi] …] (16ths): its notes in order, each with the gap to the next onset. */
export function stream(notes) {
  const ns = notes.slice().sort((a, b) => a[0] - b[0] || a[2] - b[2]);
  return ns.map(([t, d, p], i) => ({ p, d, g: i + 1 < ns.length ? ns[i + 1][0] - t : d }));
}

/** Notes [[onset dur midi] …] back from a stream. */
export function notesOf(tokens) {
  let t = 0; const out = [];
  for (const x of tokens) { out.push([t, x.d, x.p]); t += x.g; }
  return out;
}

const log2 = (x) => Math.log2(Math.max(1, x));
const rkey = (x) => x.d + "/" + x.g;

/** The cost model of a piece: bits of a note's pitch and of its rhythm (as many rhythms as the piece has). */
export function model(tokens) {
  const rhythms = new Set(tokens.map(rkey));
  return { pitch: PITCH_BITS, rhythm: Math.max(1, log2(rhythms.size)), interval: 5 };
}

const isNote = (x) => x.p !== undefined && !x.rule;

/** Bits of an item: a note written out, or a use of a rule (which rule, and what it is given). */
function cost(x, M, nRules) {
  if (isNote(x)) return M.pitch + M.rhythm;
  const which = log2(nRules + 1) + 1;
  if (x.rule.kind === "figure") return which + x.pitches.length * M.pitch;
  if (x.rule.kind === "motif") return which + M.pitch;
  if (x.rule.kind === "repeat") return 1 + log2(x.n) + x.body.reduce((s, y) => s + cost(y, M, nRules), 0);
  return which;
}

/** What a rule costs to write once. */
function ruleCost(rule, M) {
  const L = rule.rhythm.length;
  if (rule.kind === "figure") return 2 + log2(L) + log2(rule.k) + L * (log2(rule.k) + M.rhythm);
  return 2 + log2(L) + (L - 1) * M.interval + L * M.rhythm;   // motif
}

// keys of a span of notes: as a figure (which of its distinct pitches, in order of appearance, and the rhythm) and as
// a motif (its intervals from the first, and the rhythm)
function figureOf(span) {
  const order = [];
  const idx = span.map((x) => { let i = order.indexOf(x.p); if (i < 0) { order.push(x.p); i = order.length - 1; } return i; });
  return { key: "F" + idx.join(",") + "|" + span.map(rkey).join(","), idx, pitches: order };
}
function motifOf(span) {
  return { key: "M" + span.map((x) => x.p - span[0].p).join(",") + "|" + span.map(rkey).join(","), start: span[0].p };
}

/** Writes a use of a rule out again: its notes. */
export function expand(items) {
  const out = [];
  for (const x of items) {
    if (isNote(x)) out.push({ p: x.p, d: x.d, g: x.g });
    else if (x.rule.kind === "repeat") for (let i = 0; i < x.n; i++) out.push(...expand(x.body));
    else if (x.rule.kind === "figure") x.rule.idx.forEach((i, j) => out.push({ p: x.pitches[i], d: x.rule.rhythm[j].d, g: x.rule.rhythm[j].g }));
    else if (x.rule.kind === "motif") x.rule.steps.forEach((s, j) => out.push({ p: x.start + s, d: x.rule.rhythm[j].d, g: x.rule.rhythm[j].g }));
  }
  return out;
}

// the best figure or motif: over spans of notes written out, of 3 … maxL notes, the one whose uses save most bits
function bestRule(items, M, nRules, maxL, by = "gain") {
  const groups = new Map();
  for (let L = 3; L <= maxL; L++) {
    for (let i = 0; i + L <= items.length; i++) {
      const span = items.slice(i, i + L);
      if (!span.every(isNote)) continue;
      for (const k of [figureOf(span), motifOf(span)]) {
        let g = groups.get(k.key);
        if (!g) groups.set(k.key, (g = { key: k.key, L, kind: k.key[0] === "F" ? "figure" : "motif", at: [], info: k, span }));
        g.at.push(i);
      }
    }
  }
  let best = null;
  const lit = M.pitch + M.rhythm;
  for (const g of groups.values()) {
    // non-overlapping occurrences, from the left
    const at = []; let end = -1;
    for (const i of g.at) if (i > end) { at.push(i); end = i + g.L - 1; }
    if (at.length < 2) continue;
    const rhythm = g.span.map((x) => ({ d: x.d, g: x.g }));
    const rule = g.kind === "figure"
      ? { kind: "figure", idx: g.info.idx, k: g.info.pitches.length, rhythm }
      : { kind: "motif", steps: g.span.map((x) => x.p - g.span[0].p), rhythm };
    const use = g.kind === "figure" ? log2(nRules + 2) + 1 + rule.k * M.pitch : log2(nRules + 2) + 1 + M.pitch;
    const gain = at.length * (g.L * lit - use) - ruleCost(rule, M);
    // the order rules are taken in: most bits saved at once, or most saved by each use (longer rules first, so a
    // small figure everywhere does not break a larger one into pieces)
    const score = by === "gain" ? gain : by === "each" ? gain / at.length : g.L * 1e6 + gain;
    if (gain > 0 && (!best || score > best.score)) best = { gain, score, rule, at, L: g.L };
  }
  return best;
}

function applyRule(items, b) {
  const out = []; let i = 0; const starts = new Set(b.at);
  while (i < items.length) {
    if (starts.has(i)) {
      const span = items.slice(i, i + b.L);
      out.push(b.rule.kind === "figure" ? { rule: b.rule, pitches: figureOf(span).pitches } : { rule: b.rule, start: span[0].p });
      i += b.L;
    } else out.push(items[i++]);
  }
  return out;
}

const same = (a, b) => JSON.stringify(strip(a)) === JSON.stringify(strip(b));
function strip(x) {
  if (Array.isArray(x)) return x.map(strip);
  if (isNote(x)) return [x.p, x.d, x.g];
  if (x.rule.kind === "repeat") return ["R", x.n, strip(x.body)];
  return [x.rule.id, x.pitches || x.start];
}

// the best run: a span of items said again at once, n times
function bestRepeat(items, M, nRules, maxL) {
  let best = null;
  for (let L = 1; L <= maxL; L++) {
    for (let i = 0; i + 2 * L <= items.length; i++) {
      const body = items.slice(i, i + L);
      let n = 1;
      while (i + (n + 1) * L <= items.length && same(items.slice(i + n * L, i + (n + 1) * L), body)) n++;
      if (n < 2) continue;
      const c = body.reduce((s, y) => s + cost(y, M, nRules), 0);
      const gain = (n - 1) * c - (1 + log2(n));
      if (gain > 0 && (!best || gain > best.gain)) best = { gain, i, L, n, body };
    }
  }
  return best;
}

/**
 * The shortest description found of a piece (notes [[onset dur midi] …]): {rules, items, bits, raw, ratio}. Each rule
 * {id kind …}; items the piece written with them (notes, uses {rule pitches|start}, repeats {n body}).
 */
export function compress(notes, { maxL = 16, by = null } = {}) {
  // three orders of taking rules; the shortest description wins
  if (!by) {
    const all = ["gain", "each", "long"].map((b) => compress(notes, { maxL, by: b }));
    return all.reduce((a, b) => (b.bits < a.bits ? b : a));
  }
  const tokens = stream(notes);
  const M = model(tokens);
  const rules = [];
  let items = tokens.map((x) => ({ ...x }));
  for (;;) {
    const b = bestRule(items, M, rules.length, maxL, by);
    if (!b) break;
    b.rule.id = (b.rule.kind === "figure" ? "F" : "M") + (rules.length + 1);
    rules.push(b.rule);
    items = applyRule(items, b);
  }
  for (;;) {
    const r = bestRepeat(items, M, rules.length, maxL);
    if (!r) break;
    items = [...items.slice(0, r.i), { rule: { kind: "repeat" }, n: r.n, body: r.body }, ...items.slice(r.i + r.n * r.L)];
  }
  const raw = tokens.length * (M.pitch + M.rhythm);
  const bits = rules.reduce((s, r) => s + ruleCost(r, M), 0) + items.reduce((s, x) => s + cost(x, M, rules.length), 0);
  return { rules, items, bits: Math.round(bits), raw: Math.round(raw), ratio: bits / raw, tokens, model: M, by };
}

/** Is the description the piece? (expand gives back every note, its rhythm and its pitch) */
export function lossless(c) {
  const e = expand(c.items);
  return e.length === c.tokens.length && e.every((x, i) => x.p === c.tokens[i].p && x.d === c.tokens[i].d && x.g === c.tokens[i].g);
}

// ───────── reading what it found: names ─────────

const NAMES = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];
export const pitchName = (p) => NAMES[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1);

const CHORDS = [["", [0, 4, 7]], ["m", [0, 3, 7]], ["°", [0, 3, 6]], ["7", [0, 4, 7, 10]], ["m7", [0, 3, 7, 10]],
                ["maj7", [0, 4, 7, 11]], ["°7", [0, 3, 6, 9]], ["ø7", [0, 3, 6, 10]], ["+", [0, 4, 8]]];

/** The chord a set of pitches spells (its root, its kind, the bass if it is not the root), or null; a note that is not
    of it (a neighbour, a passing note) is named after it: "G(+A)". */
export function chordOf(pitches) {
  const exact = chordOf1(pitches);
  if (exact || pitches.length < 4) return exact;
  let best = null;
  for (const p of new Set(pitches)) {
    const rest = pitches.filter((q) => q !== p);
    const c = chordOf1(rest);
    if (c && (!best || c.score < best.c.score)) best = { c, p };
  }
  return best ? { ...best.c, name: best.c.name + "(+" + NAMES[((best.p % 12) + 12) % 12] + ")", extra: best.p } : null;
}

function chordOf1(pitches) {
  const pcs = [...new Set(pitches.map((p) => ((p % 12) + 12) % 12))];
  const bass = ((Math.min(...pitches) % 12) + 12) % 12;
  let best = null;
  for (let r = 0; r < 12; r++)
    for (const [name, iv] of CHORDS) {
      const set = iv.map((x) => (x + r) % 12);
      if (!pcs.every((x) => set.includes(x))) continue;
      const missing = set.length - pcs.length;
      const score = missing * 2 + set.length + (r === bass ? 0 : 0.5);
      if (missing <= 1 && (!best || score < best.score)) best = { score, root: r, name };
    }
  if (!best) return null;
  const root = NAMES[best.root];
  return { root: best.root, kind: best.name, score: best.score, name: root + best.name + (best.root === bass ? "" : "/" + NAMES[bass]) };
}

/** What a figure is, in words: a broken chord (its notes go up, then some again), or a figure over k notes. */
export function describeRule(r) {
  if (r.kind === "motif") {
    const up = r.steps[r.steps.length - 1] - r.steps[0];
    return `motif of ${r.steps.length} notes (${r.steps.join(" ")}), ${up > 0 ? "rising" : up < 0 ? "falling" : "returning"}`;
  }
  const rising = r.idx.slice(0, r.k).every((x, i) => x === i);
  return `${rising ? "broken chord" : "figure"} over ${r.k} notes: ${r.idx.join(" ")}`;
}

/** The piece written with its rules, in short: each use with its pitches (and the chord they spell). */
export function written(c, { limit = Infinity } = {}) {
  const line = (x) => {
    if (isNote(x)) return pitchName(x.p);
    if (x.rule.kind === "repeat") return `${x.n}×(${x.body.map(line).join(" ")})`;
    if (x.rule.kind === "figure") { const ch = chordOf(x.pitches); return `${x.rule.id}(${x.pitches.map(pitchName).join(" ")})${ch ? " " + ch.name : ""}`; }
    return `${x.rule.id}@${pitchName(x.start)}`;
  };
  return c.items.slice(0, limit).map(line);
}

/** The chords the figures spell, in order (a harmonic reduction): what a compression of a prelude leaves. */
export function harmony(c) {
  const out = [];
  const walk = (x, n = 1) => {
    if (isNote(x)) return;
    if (x.rule.kind === "repeat") { for (const y of x.body) walk(y, x.n); return; }
    if (x.rule.kind === "figure") { const ch = chordOf(x.pitches); if (ch) out.push(ch.name); }
  };
  c.items.forEach((x) => walk(x));
  return out;
}

// ───────── the uses coded as a listener hears them (bits.mjs, @kairotic/rules; discussion #399) ─────────
// The rules stay; only how their uses are said changes. Which rule: the first time, an escape and its number (as
// fixed prices said it), after that a word of the lexicon — a rule used again and again costs almost nothing. A
// figure's pitches: the first time 7 bits each; after that each voice as its step from the same voice of the figure's
// last use ("iv:n", a word: holding or moving by step, the cheap and frequent words of voice leading); a step beyond
// an octave said again as an escape and 7 bits. A motif's start as its step from its last start. Notes written out,
// repeats and the rules themselves as before.

const ESC = "esc";

/** The length of a description with its uses coded as heard: {bits, ratio, parts {rules, which, pitches, notes, repeats}}. */
export function codeLength(c, { voices = true } = {}) {
  const M = c.model, R = c.rules.length;
  const which = lexicon({ kinds: R + 1 }), steps = lexicon({ kinds: 25 });
  const parts = { rules: c.rules.reduce((s, r) => s + ruleCost(r, M), 0), which: 0, pitches: 0, notes: 0, repeats: 0 };
  const last = new Map();
  const say = (lex, w) => { const b = lex.bits(w); lex.add(w); return b; };
  const step = (d) => {
    if (Math.abs(d) <= 12) return say(steps, "iv:" + d);
    return say(steps, ESC) + M.pitch;
  };
  const walk = (x) => {
    if (isNote(x)) { parts.notes += M.pitch + M.rhythm; return; }
    if (x.rule.kind === "repeat") { parts.repeats += 1 + log2(x.n); x.body.forEach(walk); return; }
    const id = x.rule.id, w = "use:" + id;
    parts.which += which.count(w) ? say(which, w) : say(which, ESC) + log2(R) + (which.add(w), 0);
    const prev = last.get(id);
    if (x.rule.kind === "figure") {
      if (voices && prev) x.pitches.forEach((p, i) => { parts.pitches += step(p - prev[i]); });
      else parts.pitches += x.pitches.length * M.pitch;
      last.set(id, x.pitches);
    } else {
      parts.pitches += voices && prev ? step(x.start - prev) : M.pitch;
      last.set(id, x.start);
    }
  };
  c.items.forEach(walk);
  const bits = Object.values(parts).reduce((a, b) => a + b, 0);
  for (const k of Object.keys(parts)) parts[k] = Math.round(parts[k]);
  return { bits: Math.round(bits), ratio: bits / c.raw, parts };
}

// ───────── in a tree (kairotic.mt): :defs and :use ─────────
// A figure is a fragment written with the pitches of its first use; a use re-pitches it ([:use {:ref :F1 :pitches
// ["c4" …]}]: the fragment's distinct pitches, in the order they first sound, become those). A motif is used
// transposed ({:transpose n}); a repeat is a fragment used n times. Every note and use stands where it begins (:at, in
// beats), so voices that overlap (a bass held under the figure) stay as they are.

const NAMES_EDN = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"];
const nameOf = (p) => NAMES_EDN[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1);
const num = (x) => String(Math.round(x * 10000) / 10000);
const noteEdn = (p, d, at) => `[:note {:pitch "${nameOf(p)}" :dur ${num(d / 4)} :at ${num(at / 4)}}]`;

/** The description as a tree (EDN text): [:voice {:defs {…}} …uses and notes…]. Its notes are the piece's. */
export function treeOf(c, { name = "piece", tempo = 60 } = {}) {
  const defs = new Map();
  let reps = 0;
  const span = (x) => isNote(x) ? x.g
    : x.rule.kind === "repeat" ? x.n * x.body.reduce((s, y) => s + span(y), 0)
    : x.rule.rhythm.reduce((s, r) => s + r.g, 0);
  const fragment = (tokens) => { let t = 0; return "[:seq " + tokens.map((x) => { const e = noteEdn(x.p, x.d, t); t += x.g; return e; }).join(" ") + "]"; };
  const item = (x, at) => {
    if (isNote(x)) return noteEdn(x.p, x.d, at);
    if (x.rule.kind === "repeat") {
      const id = "R" + (++reps); let t = 0;
      defs.set(id, "[:seq " + x.body.map((y) => { const e = item(y, t); t += span(y); return e; }).join(" ") + "]");
      const len = span(x) / x.n;
      return Array.from({ length: x.n }, (_, i) => `[:use {:ref :${id} :at ${num((at + i * len) / 4)}}]`).join(" ");
    }
    const notes = expand([x]);
    if (!defs.has(x.rule.id)) defs.set(x.rule.id, { first: x, edn: fragment(notes) });
    const first = defs.get(x.rule.id).first;
    if (x.rule.kind === "figure") return `[:use {:ref :${x.rule.id} :pitches [${x.pitches.map((p) => '"' + nameOf(p) + '"').join(" ")}] :at ${num(at / 4)}}]`;
    return `[:use {:ref :${x.rule.id} :transpose ${x.start - first.start} :at ${num(at / 4)}}]`;
  };
  let t = 0;
  const body = c.items.map((x) => { const e = item(x, t); t += span(x); return e; });
  const ds = [...defs.entries()].map(([k, v]) => `:${k} ${typeof v === "string" ? v : v.edn}`).join("\n   ");
  return `[:voice {:name "${name}" :tempo ${tempo}\n  :defs {${ds}}}\n ${body.join("\n ")}]`;
}
