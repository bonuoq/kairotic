// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 67 · prelude: the second level of a prelude's description (discussions #399, #321).
//
// Study 66 describes a prelude by its figure and the pitches each use of it is given: BWV 846 is one figure over 32
// chords. What is left is a progression of voices — five, holding or moving by step from bar to bar — and a
// progression of voices is what Study 61 reduces. So the description goes on, level by level:
//
//   the harmony    each use of the prelude's figure a chord (its pitches, low to high, a voice each), a chord a unit;
//                  a voice that keeps its pitch from one chord to the next holds its note (the common tone, as a
//                  reduction hears it); the final sonority after the figures, its voices met by the nearest
//   its levels     Study 61's reduction on those notes (reduceNotes: unsplit, unspread, unsuspend, GTTM's metre, the
//                  economy of the derivation), the first and the last chord kept, and the chord where the bass
//                  arrives for the cadence
//   their bits     Study 66's coder (compress.mjs: bits.mjs, a lexicon for each context, an escape and a literal
//                  for a word never heard): a level said as rows, each chord its length ("dt|n") and every voice its
//                  step from its pitch before ("v|n", semitones, 0 when it holds) — level 0 is then said as Study
//                  66's heard figure pitches are —; what was taken away to reach it as the derivation's words (Study
//                  61's), a step never heard said by its parts
//   a new prelude  the way back (both ways, #321): the frame of level k kept, every voice between two of its chords
//                  written again by the grammar read forwards — held, a passing note, a neighbour — the sonorities
//                  consonant, the words already said preferred (economy); the figure applied to every chord again
//
// Pure data and functions.

import { compress, pitchName, chordOf, notesOf, expand, coder, sayRows } from "./compress.mjs";
import { reduceNotes, derivationLength, eventsOf } from "./reduction.mjs";
import { midiOf } from "./protovoices.mjs";
import { lexicon } from "./bits.mjs";

/** A MIDI pitch spelled as protovoices.mjs reads it (Study 66's names: C♯, E♭, F♯, A♭, B♭). */
export const spell = (p) => pitchName(p).replace("♯", "#").replace("♭", "b");
/** The voices of k-note chords: the bass "b", the inner ones "v1"…, the top "m". */
export const voicesOf = (k) => ["b", ...Array.from({ length: Math.max(0, k - 2) }, (_, i) => "v" + (i + 1)), "m"];

/** The figure of a compression used most often (Study 66's rules), or null. */
export function mainFigure(c) {
  const uses = new Map();
  const walk = (x) => { if (!x.rule) return; if (x.rule.kind === "repeat") { for (let i = 0; i < x.n; i++) x.body.forEach(walk); return; } uses.set(x.rule, (uses.get(x.rule) || 0) + 1); };
  c.items.forEach(walk);
  let best = null;
  for (const [r, n] of uses) if (r.kind === "figure" && (!best || n > best.n)) best = { rule: r, n };
  return best ? best.rule : null;
}

/** The chords a compression's figure is given, in time: [{on (16ths), pitches (MIDI, low to high)}], and the end of
 *  the last figure. */
export function chordsOf(c, figure = mainFigure(c)) {
  const out = [];
  let t = 0;
  const walk = (x) => {
    if (x.rule && x.rule.kind === "repeat") { for (let i = 0; i < x.n; i++) x.body.forEach(walk); return; }
    const len = expand([x]).reduce((s, y) => s + y.g, 0);
    if (x.rule === figure) out.push({ on: t, pitches: x.pitches.slice().sort((a, b) => a - b), len });
    t += len;
  };
  c.items.forEach(walk);
  return out;
}

/** Each voice of `from` (pitches, low to high) to the nearest pitch of `to`, every pitch of `to` reached: [pitch of
 *  to for each voice]. A voice may meet another (a unison: one proto-voice note), never cross it. */
export function meet(from, to) {
  const k = from.length, m = to.length;
  if (m === k) return to.slice();
  // (in order: voice i to pitch j(i), j non-decreasing, each pitch reached — the cheapest such map by motion)
  const memo = new Map();
  const go = (i, j) => {
    if (i === k) return j === m - 1 ? { c: 0, js: [] } : null;
    const key = i + ":" + j;
    if (memo.has(key)) return memo.get(key);
    let best = null;
    for (const jj of [j, j + 1]) {
      if (jj >= m || (i === 0 && jj !== 0)) continue;
      const rest = go(i + 1, jj);
      if (!rest) continue;
      const c = Math.abs(to[jj] - from[i]) + rest.c;
      if (!best || c < best.c) best = { c, js: [jj, ...rest.js] };
    }
    memo.set(key, best);
    return best;
  };
  const b = go(0, 0);
  return b ? b.js.map((j) => to[j]) : to.slice(0, k);
}

/**
 * A prelude's harmony as notes for a reduction: {notes: [{id, pitch, voice, on (a chord a unit), dur}], chords
 * ([{on, pitches}] by unit), units, voices, final}. raw: the piece's notes ([[onset dur midi] …]); with final, the
 * sonority at its last onset (its bass the lowest note of the last figure's length before it) closes the harmony.
 */
export function harmonyOf(c, raw, { final = true } = {}) {
  const cs = chordsOf(c);
  if (!cs.length) throw new Error("no figure: nothing to read as chords");
  const k = Math.max(...cs.map((x) => x.pitches.length));
  const rows = cs.map((x) => (x.pitches.length === k ? x.pitches : null));
  // (a chord of fewer notes than the voices: its voices met from the chord before)
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = meet(rows[i - 1] || cs[i].pitches, cs[i].pitches);
  let end = null;
  if (final && raw && raw.length) {
    const last = Math.max(...raw.map((x) => x[0])), len = cs[cs.length - 1].len;
    const top = raw.filter((x) => x[0] === last).map((x) => x[2]);
    const bass = Math.min(...raw.filter((x) => x[0] >= last - len).map((x) => x[2]));
    end = [...new Set([bass, ...top])].sort((a, b) => a - b);
    rows.push(meet(rows[rows.length - 1], end));
  }
  const V = voicesOf(k), notes = [];
  V.forEach((v, i) => {
    let cur = null, n = 0;
    rows.forEach((row, u) => {
      if (cur && cur.p === row[i]) { cur.note.dur++; return; }
      cur = { p: row[i], note: { id: `${v}${n++}`, pitch: spell(row[i]), voice: v, on: u, dur: 1 } };
      notes.push(cur.note);
    });
  });
  notes.sort((a, b) => a.on - b.on || midiOf(a.pitch) - midiOf(b.pitch));
  return { notes, rows, units: rows.length, voices: V, final: end, chords: rows.map((r) => chordOf(r)) };
}

/** The frame keeps the first chord, the last, and the chord where the bass arrives for the cadence (its last note but
 *  one begins): the harmony's cadential retention. */
export function keepCadence(path, notes) {
  const bass = notes.filter((n) => n.voice === "b"), pen = bass.length >= 2 ? bass[bass.length - 2].on : -1;
  return (i) => i === 0 || i === path.length - 1 || path[i].on === pen;
}

/** A prelude's harmony analysed: reduceNotes with a chord a unit (a bar's weight by GTTM's metre), no hard rules but
 *  the ornaments' and the sonorities', a sonority as many notes as the voices, the economy of the derivation. */
export function analyse(H, { economy = 3, temp = 0, r = Math.random } = {}) {
  return { ...reduceNotes(H.notes, { per: 1, economy, temp, r, judge: null, maxSpread: H.voices.length + 1, keep: keepCadence }), harmony: H };
}

/** A level as rows: each slice its length and the pitch of every voice (held or struck), voice by voice. */
export function levelRows(path, voices) {
  return path.map((sl) => ({ dt: sl.end - sl.on, row: voices.map((v) => { const n = sl.notes.find((x) => x.voice === v); return n ? midiOf(n.pitch) : null; }) }));
}

/** A step of a reduction never heard, said by its parts (Study 61's key, "unsplit:passing-mid.v2|1,tie-right.v1|0"):
 *  the operation, how many notes, and each note's ornament, voice and step — each part a word of its own context. */
export function sayStepParts(say, key, nVoices) {
  const [op, rest = ""] = key.split(":"), parts = rest ? rest.split(",") : [];
  let b = say("op", op, 3) + Math.log2(nVoices + 1);
  for (const x of parts) {
    const m = /^(.*)\.(\w+)\|(-?\d+)$/.exec(x);
    if (!m) { b += say("part", x, 8); continue; }
    b += say("orn", m[1], 4) + Math.log2(nVoices) + say("dstep", m[3], Math.log2(9));
  }
  return b;
}

/**
 * The bits of describing the harmony from level k: the level itself and what was taken away to reach it (the
 * derivation's words of the steps into levels 1 … k), with Study 66's coder (compress.mjs; discussion #399): a lexicon
 * for each context, a word never heard an escape and its literal. The level said as rows, Study 66's figure pitches'
 * way: each slice its length (context "dt"), then each voice its step from its pitch before (0 when it holds) — so
 * level 0 and Study 66's heard figure pitches measure the same thing. A step of the derivation is one word, Study 61's
 * (context "step"); never heard, said by its parts (sayStepParts). {level, derivation, total, slices}.
 */
export function bitsAt(an, k) {
  const { say } = coder({ kinds: 40 });
  const voices = an.harmony.voices, last = [];
  let level = 0, derivation = 0;
  for (const { dt, row } of levelRows(an.levels[k], voices)) {
    level += say("dt", "dt|" + dt, Math.log2(64));
    level += sayRows(say, [row.map((p, i) => (p === null ? last[i] : p))], last);
  }
  for (const s of an.steps.filter((x) => x.level <= k)) derivation += say("step", s.key, () => sayStepParts(say, s.key, voices.length));
  return { level, derivation, total: level + derivation, slices: an.levels[k].length };
}

/** The chords of level k (the frame by default), named (Study 66's chordOf). */
export const levelChords = (an, k = an.levels.length - 1) => an.levels[k].map((s) => (chordOf(s.notes.map((n) => midiOf(n.pitch))) || { name: "?" }).name);
export const frameChords = (an) => levelChords(an);

/** The bits of every level, from the surface (k 0) to the frame. */
export const bitsByLevel = (an) => an.levels.map((_, k) => ({ k, ...bitsAt(an, k) }));

// ─── the way back: a new harmony from a level's frame, the figure on it ───
const CANDIDATE_STEPS = [0, 1, -1, 2, -2];
/**
 * A new harmony from level k: its slices kept on their units; every unit between two of them written again, voice by
 * voice, by the grammar read forwards (a voice holds, or moves a step or a third to a consonant sonority), the words
 * said before preferred (economy, bits.mjs), drawn at temperature temp. → rows (MIDI, a chord a unit) or null.
 */
export function rewrite(an, k, { temp = 0.7, r = Math.random, economy = 3, budget = 20000 } = {}) {
  const H = an.harmony, U = H.units, V = H.voices.length;
  const pinned = new Map();
  for (const s of an.levels[k]) {
    const row = H.voices.map((v) => { const n = s.notes.find((x) => x.voice === v); return n ? midiOf(n.pitch) : null; });
    if (row.every((x) => x !== null)) pinned.set(s.on, row);
  }
  const scale = [0, 2, 4, 5, 7, 9, 11];
  // (a step in the key's scale, C major's, or chromatic where the frame's note is not in it)
  const moveBy = (p, d) => {
    if (!d) return p;
    let q = p;
    for (let i = 0; i < Math.abs(d); i++) { do q += Math.sign(d); while (!scale.includes(((q % 12) + 12) % 12)); }
    return q;
  };
  const lex = lexicon({ kinds: 40 });
  const gumbel = () => -Math.log(-Math.log(Math.min(0.999999, Math.max(1e-6, r()))));
  const rows = [];
  let nodes = 0;
  const nextPin = (u) => { for (let w = u; w < U; w++) if (pinned.has(w)) return w; return null; };
  function go(u) {
    if (u === U) return true;
    if (++nodes > budget) return false;
    if (pinned.has(u)) { rows.push(pinned.get(u)); if (go(u + 1)) return true; rows.pop(); return false; }
    const prev = rows[u - 1], w = nextPin(u), goal = w === null ? null : pinned.get(w);
    // every voice a candidate step; the chord consonant, the voices not crossing, each still able to reach the goal
    const opts = [];
    const rec = (i, row, words) => {
      if (i === V) {
        // (a consonant sonority: a major or minor triad in any position, as chordOf names it — by pitch classes, so
        // no spelling can pass an augmented triad off as a 6th)
        const ch = chordOf(row);
        if (!ch || (ch.kind !== "" && ch.kind !== "m") || ch.extra !== undefined) return;
        let c = 0;
        for (const wd of words) c += economy * (lex.bits(wd) - lex.bits("")) / 4;
        // (motion costs: a voice moving costs a little, a leap more — the smoothest preferred)
        c += row.reduce((s, p, j) => s + Math.abs(p - prev[j]) * 0.05, 0);
        opts.push({ row: row.slice(), words: words.slice(), key: c - temp * gumbel() });
        return;
      }
      for (const d of CANDIDATE_STEPS) {
        const p = moveBy(prev[i], d);
        if (i > 0 && p < row[i - 1]) continue;
        if (goal && Math.abs(goal[i] - p) > 2 * (w - u) + 2) continue;
        row.push(p); words.push("v|" + d);
        rec(i + 1, row, words);
        row.pop(); words.pop();
      }
    };
    rec(0, [], []);
    opts.sort((a, b) => a.key - b.key);
    for (const o of opts.slice(0, 6)) {
      rows.push(o.row); o.words.forEach((x) => lex.add(x));
      if (go(u + 1)) return true;
      rows.pop();
    }
    return false;
  }
  return go(0) ? rows : null;
}

/** A figure (Study 66's rule) over chords (rows of MIDI pitches, a chord a figure): the notes [[onset dur midi] …]. */
export function realize(figure, rows) {
  const out = [];
  let t = 0;
  for (const row of rows) {
    figure.idx.forEach((i, j) => { out.push([t, figure.rhythm[j].d, row[Math.min(i, row.length - 1)]]); t += figure.rhythm[j].g; });
  }
  return out;
}

/** The whole reading of a piece: Study 66's compression, its harmony, the harmony analysed. */
export function read(raw, o = {}) {
  const c = compress(raw);
  const H = harmonyOf(c, raw, o);
  return { c, H, an: analyse(H, o), figure: mainFigure(c) };
}

export { notesOf, derivationLength, eventsOf, midiOf };
