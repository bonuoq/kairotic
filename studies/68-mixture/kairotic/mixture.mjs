// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 68 · mixture: a piece described bar by bar, each bar the cheaper of two ways (discussion #399).
//
// Two kinds of reduction describe a piece (#399): the surface one (Study 66: a figure — which of a bar's pitches
// comes when — said again over other pitches) and the genetic one (Studies 61 and 67: which notes are the bar's
// sonority and which are ornaments of them). One measure says both (@kairotic/rules' bits.mjs, a lexicon for each
// context, an escape for a word never heard), so each bar can be said the cheaper way, and which way each bar took is
// a signature of the piece: figuration over harmony, or a line that unfolds a harmony with its ornaments.
//
//   a bar          its notes (in order of onset, low to high), in 16ths; its rhythm said once, the same in both ways
//   its sonority   the bar's chord tones: the triad or seventh covering most of its time (by pitch class), every
//                  pitch of the bar in it, low to high — said as each voice's step from the sonority before (as
//                  Study 66 says a figure's pitches), or anew where the number of voices changes
//   figure         (the surface way) the bar's pattern — which of its distinct pitches comes when, as Study 66's
//                  figure — one word, then its distinct pitches as steps from the last figure's
//   genetic        (the genetic way) note by note: a chord tone said by its place in the sonority ("ct|j"), an
//                  ornament by its step from the note before ("st|s", a step of two semitones at most: a passing
//                  note, a neighbour, a chromatic one) — the proto-voices of a line: a broken chord is the sonority
//                  spread, its steps the ornaments between its notes
//   mixture        each bar said the cheaper way, a word saying which ("by|figure", "by|genetic")
//
// Pure data and functions.

import { lexicon } from "./bits.mjs";

const LIT = 7;                                   // a pitch said outright (as Study 66 says it)
const pc = (p) => ((p % 12) + 12) % 12;

// ─── the coder: a lexicon for each context, an escape for a word never heard ───
/** A coder: bits(ctx, word, literal) — the word's bits in its context's lexicon, or an escape and the literal's bits
 *  where it was never heard there; add(ctx, word). (Study 66's codeLength's mixture: bits.mjs with an escape.) */
export function coder({ kinds = 40 } = {}) {
  const lex = new Map();
  const get = (ctx) => { let l = lex.get(ctx); if (!l) { l = lexicon({ kinds, alpha: 1 }); lex.set(ctx, l); } return l; };
  return {
    bits(ctx, w, literal) {
      const L = get(ctx), seen = L.count(w) > 0;
      // (an escape: the chance of a new word, alpha over all heard; then the word spelled out)
      return seen ? -Math.log2(L.count(w) / (L.heard + 1)) : -Math.log2(1 / (L.heard + 1)) + literal;
    },
    add(ctx, w) { get(ctx).add(w); },
    heardIn: (ctx) => get(ctx).heard,
    say(ctx, w, literal) { const b = this.bits(ctx, w, literal); this.add(ctx, w); return b; },
  };
}

/** A note's word in the genetic way, said in the context of the word before it (an arpeggio's next tone is
 *  predictable from its last), backing off to no context where it was never heard after that one. */
function noteBits(C, prev, w) {
  const hi = C.bits("note|" + prev, w, Infinity);
  return Number.isFinite(hi) ? hi : -Math.log2(1 / (C.heardIn("note|" + prev) + 1)) + C.bits("note", w, 4);
}
function sayNote(C, prev, w) { const b = noteBits(C, prev, w); C.add("note|" + prev, w); C.add("note", w); return b; }

// ─── bars ───
/** A piece's notes [[onset dur midi] …] (16ths) cut into bars of `bar` 16ths: [{on, notes: [{t, d, p}] (t from the
 *  bar's start, in onset order, low to high)}]. */
export function barsOf(notes, bar) {
  const ns = notes.slice().sort((a, b) => a[0] - b[0] || a[2] - b[2]), out = [];
  for (const [t, d, p] of ns) {
    const b = Math.floor(t / bar);
    while (out.length <= b) out.push({ on: out.length * bar, notes: [] });
    out[b].notes.push({ t: t - b * bar, d, p });
  }
  return out.filter((b) => b.notes.length);
}

const CHORDS = [[0, 4, 7], [0, 3, 7], [0, 3, 6], [0, 4, 7, 10], [0, 3, 7, 10], [0, 4, 7, 11], [0, 3, 6, 9], [0, 3, 6, 10]];
/** The bar's chord: the triad or seventh (pitch classes) covering most of its time, the fewer tones the better. */
export function chordOfBar(notes) {
  let best = null;
  for (let r = 0; r < 12; r++) for (const iv of CHORDS) {
    const set = iv.map((x) => (x + r) % 12);
    const cover = notes.reduce((s, n) => s + (set.includes(pc(n.p)) ? Math.max(1, n.d) : 0), 0);
    const score = cover - 0.01 * set.length;
    if (!best || score > best.score) best = { score, set, root: r };
  }
  return best;
}

/** The bar's sonority and its ornaments: {sonority (pitches, low to high), tones (for each note: its index in the
 *  sonority, or null for an ornament)}. A note out of the chord is an ornament where it is a step (two semitones at
 *  most) from the note before; otherwise it joins the sonority. */
export function readBar(notes) {
  const ch = chordOfBar(notes), son = new Set();
  const orn = notes.map((n, i) => !ch.set.includes(pc(n.p)) && i > 0 && Math.abs(n.p - notes[i - 1].p) <= 2);
  notes.forEach((n, i) => { if (!orn[i]) son.add(n.p); });
  const sonority = [...son].sort((a, b) => a - b);
  return { sonority, tones: notes.map((n, i) => (orn[i] ? null : sonority.indexOf(n.p))), chord: ch };
}

// ─── the two ways of saying a bar ───
const rhythmWord = (notes) => "rh|" + notes.map((n) => n.t + "/" + n.d).join(",");
export const TONES = { mode: "move" };
/** A bar's notes as words of the genetic way: a chord tone by its move in the sonority from the chord tone before
 *  ("ct|+1": the next one up — a broken chord rising is the same word over any chord), the bar's first by its place
 *  ("c0|j"); an ornament by its step from the note before ("st|s"). */
export function noteWords(notes, g, tones = TONES.mode) {
  let last = null;
  return g.tones.map((j, i) => {
    if (j === null) return "st|" + (notes[i].p - notes[i - 1].p);
    const w = tones === "place" ? "ct|" + j : last === null ? "c0|" + j : "ct|" + (j - last);
    last = j;
    return w;
  });
}
/** Pitches said as each voice's step from the voices before: with as many voices, voice by voice; otherwise how many,
 *  then each as its step from the nearest pitch before (a voice added or left out), or outright. */
function sayVoices(C, ctx, ps, before, dry = false) {
  const say = dry ? (c, w, l) => C.bits(c, w, l) : (c, w, l) => C.say(c, w, l);
  if (before && before.length === ps.length) return ps.reduce((s, p, i) => s + say(ctx + "-iv", "iv|" + (p - before[i]), 1 + LIT), 0);
  if (!before) return say(ctx + "-k", "k|" + ps.length, 4) + ps.length * LIT;
  return say(ctx + "-k", "k|" + ps.length, 4) + ps.reduce((s, p) => {
    const near = before.reduce((a, q) => (Math.abs(q - p) < Math.abs(a - p) ? q : a));
    return s + say(ctx + "-nv", "nv|" + (p - near), 1 + LIT);
  }, 0);
}
/** The surface way: the bar's pattern (which distinct pitch, in order of first appearance, comes when) and those
 *  pitches. */
export function figureOf(notes) {
  const order = [];
  const idx = notes.map((n) => { let i = order.indexOf(n.p); if (i < 0) { order.push(n.p); i = order.length - 1; } return i; });
  return { pattern: "pat|" + idx.join(","), pitches: order };
}
/** A pattern spelled out: for each note, which of the k pitches (log2 k bits), and how many notes. */
const patternBits = (f) => 4 + (f.pattern.split(",").length) * Math.log2(Math.max(2, f.pitches.length));

/** The bits of a bar said each way, given the coder's state (a dry run: nothing is added). */
function costs(C, st, bar) {
  const dry = { say: (ctx, w, lit) => C.bits(ctx, w, lit) };
  const f = figureOf(bar.notes), g = readBar(bar.notes);
  const fig = dry.say("pat", f.pattern, patternBits(f)) + sayVoicesDry(C, "fig", f.pitches, st.fig);
  let gen = sayVoicesDry(C, "son", g.sonority, st.son);
  let prev = st.word;
  noteWords(bar.notes, g).forEach((w) => { gen += noteBits(C, prev, w); prev = w; });
  return { fig, gen, f, g };
}
const sayVoicesDry = (C, ctx, ps, before) => sayVoices(C, ctx, ps, before, true);
/** Say a bar the chosen way (the coder learns it). */
function say(C, st, bar, way, f, g) {
  let b = C.say("rhythm", rhythmWord(bar.notes), bar.notes.length * 6);
  // (the bar said either way is known once said: both ways learn it — the other's words are heard without being
  // paid for, as a listener who has heard the bar can say it to itself either way)
  const fb = C.say("pat", f.pattern, patternBits(f)) + sayVoices(C, "fig", f.pitches, st.fig);
  let gb = sayVoices(C, "son", g.sonority, st.son);
  for (const w of noteWords(bar.notes, g)) { gb += sayNote(C, st.word, w); st.word = w; }
  b += way === "figure" ? fb : gb;
  st.fig = f.pitches; st.son = g.sonority;
  return b;
}

/**
 * A piece described bar by bar: way "figure" (every bar the surface way), "genetic" (every bar the genetic way) or
 * "mixture" (each the cheaper, a word saying which). → {bits, raw (7 + 4 bits a note written out), bars: [{on, way,
 * bits, fig, gen}], share (of bars said genetically)}.
 */
export function describe(notes, { bar = 16, way = "mixture" } = {}) {
  const C = coder(), st = { fig: null, son: null, word: "^" }, out = [];
  let bits = 0;
  for (const b of barsOf(notes, bar)) {
    const c = costs(C, st, b);
    const w = way === "mixture" ? (c.gen < c.fig ? "genetic" : "figure") : way;
    let x = way === "mixture" ? C.say("by", "by|" + w, 1) : 0;
    x += say(C, st, b, w, c.f, c.g);
    bits += x;
    out.push({ on: b.on, way: w, bits: x, fig: c.fig, gen: c.gen, notes: b.notes.length, sonority: c.g.sonority });
  }
  const raw = notes.length * (LIT + 4);
  return { bits, raw, ratio: bits / raw, bars: out, share: out.filter((b) => b.way === "genetic").length / out.length };
}

/** A bar's pitches back from its genetic words (noteWords) and its sonority: what the genetic way says is the bar. */
export function decodeGenetic(sonority, words) {
  const out = [];
  let last = null;
  for (const w of words) {
    const [k, v] = w.split("|"), n = Number(v);
    if (k === "st") out.push(out[out.length - 1] + n);
    else { last = k === "ct" && TONES.mode === "move" ? last + n : n; out.push(sonority[last]); }
  }
  return out;
}
/** A bar's pitches back from its figure: its pattern and its distinct pitches. */
export const decodeFigure = (pattern, pitches) => pattern.slice(4).split(",").map((i) => pitches[Number(i)]);

/** Every bar read both ways and said back: whether each gives its pitches again. */
export function lossless(notes, bar = 16) {
  return barsOf(notes, bar).every((b) => {
    const f = figureOf(b.notes), g = readBar(b.notes), ps = b.notes.map((n) => n.p).join();
    return decodeFigure(f.pattern, f.pitches).join() === ps && decodeGenetic(g.sonority, noteWords(b.notes, g)).join() === ps;
  });
}
