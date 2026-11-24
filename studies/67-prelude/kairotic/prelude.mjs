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

import { compress, pitchName, chordOf, notesOf, expand, coder, sayRows, harmonySpans } from "./compress.mjs";
import { reduceNotes, derivationLength, eventsOf } from "./reduction.mjs";
import { exportMei, fromUnits, fileName } from "./export.mjs";
import { midiOf } from "./protovoices.mjs";
import { lexicon } from "./bits.mjs";
import { functionsOf, grammarErrors, label } from "./functions.mjs";
import { placed, distance, hierarchical, tensions, surface, tonicOf } from "./tension.mjs";

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
  if (b) return b.js.map((j) => to[j]);
  // (more pitches than voices: the bass keeps the lowest, every other voice the nearest pitch above the voice below
  // it, the cheapest such choice by motion — a doubling left out)
  const memo2 = new Map();
  const pick = (i, j) => {
    if (i === k) return { c: 0, js: [] };
    const key = i + ":" + j;
    if (memo2.has(key)) return memo2.get(key);
    let best = null;
    for (let jj = i === 0 ? 0 : j + 1; jj <= m - (k - i) && (i > 0 || jj === 0); jj++) {
      const rest = pick(i + 1, jj);
      const c = Math.abs(to[jj] - from[i]) + rest.c;
      if (!best || c < best.c) best = { c, js: [jj, ...rest.js] };
    }
    memo2.set(key, best);
    return best;
  };
  return m > k ? pick(0, 0).js.map((j) => to[j]) : to.slice(0, k);
}

/**
 * A prelude's harmony as notes for a reduction: {notes: [{id, pitch, voice, on (a chord a unit), dur}], chords
 * ([{on, pitches}] by unit), units, voices, final}. raw: the piece's notes ([[onset dur midi] …]); with final, the
 * sonority at its last onset (its bass the lowest note of the last figure's length before it) closes the harmony.
 */
export function harmonyOf(c, raw, { final = true } = {}) {
  const fig = chordsOf(c);
  if (!fig.length) throw new Error("no figure: nothing to read as chords");
  const k = Math.max(...fig.map((x) => x.pitches.length));
  // Study 66's harmony, a chord a bar: the figure's chords, and the bars it does not cover (BWV 846's F/C and G7 over
  // the tonic pedal, written out; the final chord) read as sonorities — the harmony does not stop where the pattern
  // does. Without final, the last bar is left out when it is read.
  let cs = harmonySpans(c);
  if (!final && cs.length && cs[cs.length - 1].read) cs = cs.slice(0, -1);
  const rows = cs.map((x) => (x.pitches.length === k ? x.pitches : null));
  // (a chord of more or fewer notes than the voices: its voices met from the chord before)
  for (let i = 0; i < rows.length; i++) if (!rows[i]) rows[i] = meet(rows[i - 1] || cs[i].pitches.slice(0, k), cs[i].pitches);
  const end = final && cs.length && cs[cs.length - 1].read ? cs[cs.length - 1].pitches : null;
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
export function analyse(H, { economy = 3, temp = 0, r = Math.random, functional = true, tension = 1, key = { tonic: "C" } } = {}) {
  const judge = functional ? functionalJudge(key) : null;
  const extra = tension ? tensionCost(key, tension) : null;
  return { ...reduceNotes(H.notes, { per: 1, economy, temp, r, judge, strict: functional, maxSpread: H.voices.length + 1, keep: keepCadence, extra }), harmony: H, functional, tension, key };
}

/**
 * The tension a step takes away, as a cost of the reduction's (Lerdahl's prolongational reduction: a chord close to
 * the one it prolongs — a weak prolongation — is taken away first; one far from both around it is a progression, and
 * stays longer): weight · δ / 5, δ the distance (tension.mjs) from the closer of the chords around it to the chord taken
 * away (for a spread, between the two slices heard as one). A suspension's resolution brought onto its beat costs none.
 */
export function tensionCost(key = { tonic: "C" }, weight = 1) {
  const chordAt = (s) => placed(s.notes.map((n) => midiOf(n.pitch)), key), memo = new Map();
  const pl = (s) => { const k = s.notes.map((n) => n.pitch).join(); let v = memo.get(k); if (!v) { v = chordAt(s); memo.set(k, v); } return v; };
  const d = (a, b) => { const x = pl(a), y = pl(b); return x && y ? distance(x, y).d : 0; };
  return (step, path) => {
    if (step.op === "unsplit") return weight * Math.min(d(path[step.at - 1], path[step.at]), d(path[step.at + 1], path[step.at])) / 5;
    if (step.op === "unspread") return weight * d(path[step.at], path[step.at + 1]) / 5;
    return 0;
  };
}

// ─── the tonal functions a level must keep (functions.mjs, @kairotic/rules) ───
/** A level's chords (each slice's pitches) and their functions in the key. */
export const levelFunctions = (path, key = { tonic: "C" }) => functionsOf(path.map((s) => s.notes.map((n) => midiOf(n.pitch))), key);
/**
 * The judge a reduction reads (reduceNotes' judge): a level whose functions break the grammar of a tonal phrase — a
 * dominant taken back by a subdominant, an applied dominant left without its target — is refused around the step
 * that made it, so the economy can never take away the chord that makes the harmony go where it goes (GTTM's
 * prolongational reduction: a chord taken away as the prolongation of another, never so that what is left goes back).
 * Its errors on the units' grid (a chord a unit, 1-based), as checkPath's.
 */
export function functionalJudge(key = { tonic: "C" }) {
  return (path) => {
    const errs = grammarErrors(levelFunctions(path, key), { key });
    return { ok: !errs.length, errors: errs.map((e) => ({ unit: path[e.i].on + 1, at: `chord ${path[e.i].on + 1}`, reason: e.reason })) };
  };
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

// ─── tension (tension.mjs, @kairotic/rules: Lerdahl's Tonal Pitch Space) ───
/**
 * The harmony's tension, chord by chord, from its analysis: each surface chord's prolongational parent is the chord
 * of the level above it was taken into — of the two around it there, the closer (Lerdahl's δ), the one before where
 * they tie — and its tension its δ from the parent plus the parent's (the frame's chords from the tonic), with what
 * it adds itself (an inversion, a 7th, a foreign note). → [{on, name, parent (onset, or −1), global, sequential,
 * hierarchical, level (the deepest it reaches)}].
 */
export function tensionOf(an, key = an.key || { tonic: "C" }) {
  const L = an.levels, ons = L[0].map((s) => s.on), idx = new Map(ons.map((o, i) => [o, i]));
  const chordAt = (s) => s.notes.map((n) => midiOf(n.pitch));
  // (each onset's chord where it stands deepest, and the deepest level it reaches)
  const deepest = new Map(), level = new Map();
  L.forEach((path, k) => path.forEach((s) => { deepest.set(s.on, chordAt(s)); level.set(s.on, k); }));
  const parent = new Map();
  for (let k = 0; k + 1 < L.length; k++) {
    const up = L[k + 1], upOn = new Set(up.map((s) => s.on));
    for (const s of L[k]) {
      if (upOn.has(s.on) || parent.has(s.on)) continue;
      const before = up.filter((x) => x.on < s.on).pop(), after = up.find((x) => x.on > s.on);
      const me = placed(chordAt(s), key);
      const d = (x) => (x ? distance(placed(chordAt(x), key), me).d : Infinity);
      parent.set(s.on, (d(after) < d(before) ? after : before || after).on);
    }
  }
  const chords = ons.map((o) => deepest.get(o)), parents = ons.map((o) => (parent.has(o) ? idx.get(parent.get(o)) : -1));
  const H = hierarchical(chords, parents, key), S = tensions(L[0].map(chordAt), key);
  return ons.map((o, i) => ({ on: o, name: (chordOf(L[0][i].notes.map((n) => midiOf(n.pitch))) || { name: "?" }).name, parent: parents[i] < 0 ? -1 : ons[parents[i]], global: S[i].global + S[i].surface, sequential: S[i].sequential, hierarchical: H[i], level: level.get(o) }));
}

// ─── the way back: a new harmony from a level's frame, the figure on it ───
const CANDIDATE_STEPS = [0, 1, -1, 2, -2];
/**
 * A new harmony from level k: its slices kept on their units; every unit between two of them written again, voice by
 * voice, by the grammar read forwards (a voice holds, or moves a step or a third to a consonant sonority), the words
 * said before preferred (economy, bits.mjs), each chord's tension near the original's at its unit (shape: Lerdahl's
 * global tension, tension.mjs), drawn at temperature temp. → rows (MIDI, a chord a unit) or null.
 */
export function rewrite(an, k, { temp = 0.7, r = Math.random, economy = 3, functional = an.functional ?? true, shape = 3, smooth = 1, beam = 80 } = {}) {
  const H = an.harmony, U = H.units, V = H.voices.length, key = an.key || { tonic: "C" };
  // (the tension's shape: each new chord's global tension near the original's at its unit — a variation keeps where
  // the harmony tightens and where it releases)
  const target = shape ? tensions(H.rows, key).map((t) => t.global + t.surface) : null;
  const tensionAt = (row) => { const p = placed(row, key); return p ? distance(tonicOf(key), p).d + surface(p) : 0; };
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
  // (the tonal functions, as the reduction keeps them: a chord may follow another only as the grammar allows)
  const fnOf = new Map();
  const fn = (row) => { const kk = row.join(); let f = fnOf.get(kk); if (f === undefined) { f = functionsOf([row], key)[0]; fnOf.set(kk, f); } return f; };
  const follows = (a, b) => !functional || !grammarErrors([fn(a), fn(b)], { key, end: false }).length;
  // ─── the voice leading every new chord keeps (with the chord before it and the one after) ───
  // the chord: a major or minor triad, or a seventh (dominant, minor, major: its 7th prepared or approached by step,
  // and going down by step), in any position; the voices in order, none on another's pitch (no voice lost), the upper
  // ones within an octave of each other
  const okMemo = new Map();
  const chordOk = (row) => { const kk = row.join(); let v = okMemo.get(kk); if (v === undefined) { v = chordOk0(row); okMemo.set(kk, v); } return v; };
  const chordOk0 = (row) => {
    const ch = chordOf(row);
    if (!ch || !["", "m", "7", "m7", "maj7"].includes(ch.kind) || ch.extra !== undefined) return false;
    for (let i = 1; i < V; i++) if (row[i] <= row[i - 1]) return false;
    for (let i = 2; i < V; i++) if (row[i] - row[i - 1] > 12) return false;
    return true;
  };
  const sevenths = (row) => { const ch = chordOf(row); if (!ch || !/7/.test(ch.kind)) return []; const iv = ch.kind === "maj7" ? 11 : 10, pc = (ch.root + iv) % 12; return row.map((p, i) => (((p % 12) + 12) % 12 === pc ? i : -1)).filter((i) => i >= 0); };
  const perfect = (x, y) => { const d = ((y - x) % 12 + 12) % 12; return d === 0 || d === 7; };
  /** Whether a can go to b: no voice leaps more than a 4th (a 5th in the bass, an octave where the chord kept next
   *  doubles one), no parallel 5ths or octaves between any two voices, a 7th going down by step. → its cost, or
   *  Infinity. */
  const link = (a, b, into = false) => {
    let c = 0;
    for (let i = 0; i < V; i++) {
      const d = Math.abs(b[i] - a[i]);
      if (d > (i === 0 ? 7 : 5) && !(into && d === 12)) return Infinity;
      c += d <= 2 ? d * 0.1 : d <= 4 ? 0.5 : 1.2;
    }
    // (a new chord each bar, as the prelude's harmony moves: the same chord again a little dearer)
    if (a.join() === b.join()) c += 0.8;
    for (let i = 0; i < V; i++) for (let j = i + 1; j < V; j++)
      if (a[i] !== b[i] && perfect(a[i], a[j]) && perfect(b[i], b[j]) && (((a[j] - a[i]) % 12) + 12) % 12 === (((b[j] - b[i]) % 12) + 12) % 12) return Infinity;
    for (const i of sevenths(a)) if (b[i] !== a[i] && !(a[i] - b[i] >= 1 && a[i] - b[i] <= 2)) return Infinity;
    return smooth * c;
  };
  const stateCost = (u, row) => (target ? shape * Math.abs(tensionAt(row) - target[u]) / 5 : 0);
  const lex = lexicon({ kinds: 40 });
  const gumbel = () => -Math.log(-Math.log(Math.min(0.999999, Math.max(1e-6, r()))));
  const rows = new Array(U).fill(null);
  for (const [u, row] of pinned) rows[u] = row;
  const pins = [...pinned.keys()].sort((x, y) => x - y), kept = [];
  const T = Math.max(0.05, temp);
  // span by span, an exact bridge: the chords each unit may take (reached from the chord before by every voice's step,
  // a third at most, and still able to reach the chord kept next), the backward weights from that chord, a draw forwards
  for (let j = 0; j + 1 < pins.length; j++) {
    const a = pins[j], b = pins[j + 1], A = pinned.get(a), G = pinned.get(b);
    if (b - a < 2) continue;
    // (forwards, a beam: the chords reached, each with the cheapest way to it, the `beam` cheapest kept a unit)
    const layer = [new Map([[A.join(), { row: A, f: 0 }]])];
    let dead = false;
    for (let u = a + 1; u < b && !dead; u++) {
      const next = new Map(), left = b - u;
      for (const { row: prev, f } of layer[layer.length - 1].values()) {
        const rec = (i, row) => {
          if (i === V) {
            const kk = row.join(), old = next.get(kk);
            if (old && old.f <= f) return;
            if (!chordOk(row) || !follows(prev, row)) return;
            const c = link(prev, row);
            if (c === Infinity) return;
            const g = f + c + stateCost(u, row);
            if (!old || g < old.f) next.set(kk, { row: row.slice(), f: g });
            return;
          }
          for (const d of CANDIDATE_STEPS) {
            const p = moveBy(prev[i], d);
            if (i > 0 && p <= row[i - 1]) continue;
            const gap = Math.abs(G[i] - p), oct = Math.min(gap, Math.abs(gap - 12));
            if ((left === 1 ? (G[i] !== p && gap > 5 && gap !== 12) : oct > 4 * left)) continue;
            row.push(p); rec(i + 1, row); row.pop();
          }
        };
        rec(0, []);
      }
      if (!next.size) { dead = true; break; }
      layer.push(new Map([...next.entries()].sort((x, y) => x[1].f - y[1].f).slice(0, beam)));
    }
    // (from here on each layer's chords only: the backward weights are exact over the chords the beam kept)
    for (let L = 1; L < layer.length; L++) layer[L] = new Map([...layer[L].entries()].map(([kk, v]) => [kk, v.row]));
    // (no new way through this span under the rules: Bach's chords kept there)
    if (dead || ![...layer[layer.length - 1].values()].some((row) => follows(row, G) && link(row, G, true) !== Infinity)) {
      for (let u = a + 1; u < b; u++) rows[u] = H.rows[u];
      kept.push([a + 1, b - 1]);
      continue;
    }
    layer[0] = new Map([[A.join(), A]]);
    // backward: log weight of every way from a chord of unit u to the chord kept at b
    const lse = (x, y) => (x === -Infinity ? y : y === -Infinity ? x : Math.max(x, y) + Math.log1p(Math.exp(-Math.abs(x - y))));
    const back = new Array(layer.length).fill(null);
    const last = layer.length - 1;
    back[last] = new Map([...layer[last].entries()].map(([kk, row]) => { const c = follows(row, G) ? link(row, G, true) : Infinity; return [kk, c === Infinity ? -Infinity : -(c + stateCost(b - 1, row)) / T]; }));
    for (let L = last - 1; L >= 1; L--) {
      const m = new Map();
      for (const [kk, row] of layer[L]) {
        let z = -Infinity;
        for (const [k2, row2] of layer[L + 1]) {
          const w = back[L + 1].get(k2);
          if (w === -Infinity || !follows(row, row2)) continue;
          const c = link(row, row2);
          if (c !== Infinity) z = lse(z, -c / T + w);
        }
        m.set(kk, z === -Infinity ? -Infinity : z - stateCost(a + L - 1, row) / T);
      }
      back[L] = m;
    }
    // forwards: each chord drawn by its weight, the words already said cheaper (economy, forward only)
    let prev = A;
    for (let L = 1; L <= last; L++) {
      const cs = [];
      for (const [kk, row] of layer[L]) {
        const w = back[L].get(kk);
        if (w === -Infinity || !follows(prev, row)) continue;
        const c = link(prev, row);
        if (c === Infinity) continue;
        let e = 0;
        for (let v = 0; v < V; v++) e += economy * (lex.bits("v|" + stepIn(prev[v], row[v])) - lex.bits("")) / 4;
        cs.push({ row, lw: -(c + e) / T + w });
      }
      if (!cs.length) return null;
      const m = Math.max(...cs.map((x) => x.lw));
      let x = r() * cs.reduce((s2, y) => s2 + Math.exp(y.lw - m), 0), pick = cs[cs.length - 1];
      for (const y of cs) { x -= Math.exp(y.lw - m); if (x < 0) { pick = y; break; } }
      for (let v = 0; v < V; v++) lex.add("v|" + stepIn(prev[v], pick.row[v]));
      rows[a + L] = pick.row;
      prev = pick.row;
    }
  }
  void gumbel;
  if (rows.some((x) => x === null)) return null;
  // (the spans no new way could go through, Bach's chords kept there)
  rows.kept = kept;
  return rows;
}
/** The scale steps (C major's) from one pitch to another, signed: the word a voice's move is. */
function stepIn(p, q) {
  const sc = [0, 2, 4, 5, 7, 9, 11], deg = (x) => 7 * Math.floor(x / 12) + sc.filter((v) => v <= ((x % 12) + 12) % 12).length - 1;
  return deg(q) - deg(p);
}

/** A harmony's tension from the tonic, chord by chord (global δ and surface, tension.mjs). */
export const tensionsOf = (rows, key = { tonic: "C" }) => tensions(rows, key).map((t) => t.global + t.surface);

/** How alike two harmonies' tension curves are (each chord's global tension, tension.mjs): their correlation. */
export function tensionCorrelation(rowsA, rowsB, key = { tonic: "C" }) {
  const a = tensionsOf(rowsA, key), b = tensionsOf(rowsB, key);
  const m = (x) => x.reduce((s2, v) => s2 + v, 0) / x.length, ma = m(a), mb = m(b);
  let sab = 0, saa = 0, sbb = 0;
  for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; }
  return sab / Math.sqrt(saa * sbb || 1);
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

// ─── as MEI, for the app (discussion #319) ───
/** Chords (rows of MIDI pitches, a chord a bar) as MEI: a staff a voice, top first, each chord a whole note (a note
 *  held where the voice keeps its pitch). → {mei, name}. */
export function meiOfChords(rows, { title = "A harmony", key = { tonic: "C", mode: "major" } } = {}) {
  const V = rows[0].length, labels = voicesOf(V).slice().reverse();
  const voices = labels.map((label, j) => {
    const i = V - 1 - j, names = rows.map((r) => spell(r[i]));
    return { label, clef: i < V / 2 ? "F" : "G", notes: fromUnits(names) };
  });
  const x = exportMei({ title, source: "Kairotic Study 67 · prelude", key, voices, unitDen: 1, unitsPerBar: 1, root: { study: "67 · prelude", chords: rows.map((r) => (chordOf(r) || { name: "?" }).name) } });
  return { mei: x.mei, name: fileName(title) };
}
/** A prelude (a figure over chords, realize's) as MEI: a staff for each of the figure's voices, top first, in 16ths
 *  (a note held as long as it lasts, the rest silent). → {mei, name}. */
export function meiOfPrelude(figure, rows, { title = "A prelude", key = { tonic: "C", mode: "major" } } = {}) {
  const k = Math.max(...figure.idx) + 1, bar = figure.rhythm.reduce((a, x) => a + x.g, 0), n = rows.length * bar;
  const grid = Array.from({ length: k }, () => Array(n).fill(null)), struck = Array.from({ length: k }, () => Array(n).fill(false));
  rows.forEach((row, b) => {
    let t = b * bar;
    figure.idx.forEach((i, j) => {
      const p = row[Math.min(i, row.length - 1)], d = figure.rhythm[j].d;
      for (let u = t; u < Math.min(n, t + d); u++) grid[i][u] = spell(p);
      struck[i][t] = true;
      t += figure.rhythm[j].g;
    });
  });
  const voices = grid.map((names, i) => ({ label: "voice " + (i + 1), clef: i < 2 ? "F" : "G", notes: fromUnits(names, struck[i]) })).reverse();
  const x = exportMei({ title, source: "Kairotic Study 67 · prelude", key, voices, unitDen: 16, unitsPerBar: bar, root: { study: "67 · prelude", chords: rows.map((r) => (chordOf(r) || { name: "?" }).name) } });
  return { mei: x.mei, name: fileName(title) };
}

/** The whole reading of a piece: Study 66's compression, its harmony, the harmony analysed. */
export function read(raw, o = {}) {
  const c = compress(raw);
  const H = harmonyOf(c, raw, o);
  return { c, H, an: analyse(H, o), figure: mainFigure(c) };
}

export { label, grammarErrors, notesOf, derivationLength, eventsOf, midiOf };
