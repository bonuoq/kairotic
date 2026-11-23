// SPDX-License-Identifier: MPL-2.0
// Study 64 · florid: measured. A florid line over a cantus firmus read back into what the engine draws — its frame
// (by Study 61's grammar, or given), each half bar's rhythm cell and figure, its ties — counted over a corpus, and the
// counts turned into the engine's costs. The same catalogue both ways: what florid.mjs draws, measure.mjs reads, so
// that the frequencies of Fux's own florid examples (Gradus ad Parnassum, fifth species) can weigh what the engine
// draws (discussion #342, step 3 of the florid road).
//
//   a line      {cf, key, eighths, frame?, skip?}: the cantus firmus a note a bar, the florid line on the eighths' grid
//               (a note held across eighths names them again), the frame's names (a note a half bar) if known,
//               the half bars to leave out of the counts (a rest it starts with)
//   read        readLine(line) → {frame, spans: [{t, notes, durs, cell, figure, loose, shape, tiedIn}]}: the frame as
//               the engine writes it (each half bar's downbeat; or Study 61's reduction), each half
//               bar's struck notes and their lengths, its cell (CELLS, or "other:…"), its figure (FIGURES: the one
//               whose shape it has, and whose context fits — or, loose, the shape alone; or "other:…")
//   measure     measure(lines) → the counts: figures, cells, bars' rhythms, ties (to an equal or shorter value or
//               not), a bar like the one before, notes a bar along the phrase, the frame's moves, its coherence (the
//               derivation's length: bits a half bar, distinct cells a line)
//   costs       costsOf(stats) → {figures, cells, bars, frame}: a cost each (frame: the frame's moves by interval), −log of its share against the commonest (smoothed),
//               for florid({costs}) — a first guess: how often a figure is heard is not how much it is preferred,
//               where the frame leaves room for it or not
//   Fux         loadFux() his twelve two-part florid examples (corpus/fux, **kern, CC0); FUX_COSTS the costs fitted
//               to them (corpus/fit.mjs)
//   fit         fitCosts(stats, generate) → the costs with which the engine's own lines are heard as often as the
//               corpus's: rounds of drawing, measuring, and moving each cost by the log of the two shares' ratio (a
//               maximum-entropy fit, its moments the figures' and the cells' shares)
import { SUB, CELLS, FIGURES, frameFrom, contextOf, reduceFlorid, intervalKey, derivationLength } from "./florid.mjs";
import { keyOf, codeOf, codeDegree } from "./partimento.mjs";

const split = (s) => (Array.isArray(s) ? s : String(s || "").trim().split(/\s+/).filter(Boolean));
const cellKey = (durs) => Object.keys(CELLS).find((c) => CELLS[c].join() === durs.join()) || "other:" + durs.join("+");

/** A line given as notes with lengths in eighths ([{name, dur}], a tie as the same name again) on the eighths' grid. */
export const eighthsOf = (notes) => notes.flatMap(({ name, dur }) => Array(dur).fill(name));

/** The struck notes of half bar t of a line on the eighths' grid: their names, lengths (cut at the half bar's end),
 *  and whether the first is held into it from the half bar before (a tie). struck: where a note is struck, if known
 *  (else a name again is held). */
export function struckAt(eighths, t, struck = null) {
  const p = t * SUB, names = [], durs = [];
  const on = (i) => (struck ? struck[i] : i === 0 || eighths[i] !== eighths[i - 1]);
  for (let i = p; i < p + SUB && i < eighths.length; i++) {
    if (i === p || on(i)) { names.push(eighths[i]); durs.push(1); } else durs[durs.length - 1]++;
  }
  return { names, durs, tiedIn: p > 0 && !on(p) };
}

/** The frame of a line: given; or as the engine writes it, the note on each half bar's downbeat (a suspension the
 *  dissonance, held over); or (by: "reduce") the level of Study 61's reduction as long as the frame, which reads a
 *  suspension by its resolution, brought onto the strong beat. */
export function frameOfLine({ cf, key, eighths, frame = null }, by = "downbeats") {
  if (frame) return frame;
  const n = (split(cf).length - 1) * 2 + 1;
  if (by === "downbeats") return Array.from({ length: n }, (_, t) => eighths[t * SUB]);
  const R = reduceFlorid(cf, key, eighths);
  const k = R.an.levels.findIndex((l) => l.length <= n);
  return R.levels[k < 0 ? R.levels.length - 1 : k];
}

/** A line read back: its frame, and each half bar's notes, cell and figure (as florid.mjs's catalogue names them). */
export function readLine(line, { frame: by = "downbeats" } = {}) {
  const { cf, key, eighths } = line, K = keyOf(key);
  const names = frameOfLine(line, by), n = names.length;
  let fr;
  try { fr = frameFrom(cf, key, names); } catch (e) { return null; }
  const ctx = contextOf(fr), deg = (nm) => codeDegree(codeOf(K, nm));
  const spans = [];
  for (let t = 0; t < n - 1; t++) {
    const { names: ns, durs, tiedIn } = struckAt(eighths, t, line.struck), cell = cellKey(durs);
    const shape = ns.map((nm) => deg(nm) - deg(names[t])), { s, x } = ctx[t];
    let figure = null, loose = false;
    if (ns[0] === names[t]) {
      const same = (f, xv) => f.shape(s, xv).join() === shape.join() && (f.cells.includes(cell) || cell.startsWith("other"));
      for (const f of FIGURES) for (const v of f.variants || [{}]) if (!figure && f.fits(s, { ...x, ...v }) && same(f, { ...x, ...v })) figure = f.id;
      // the shape alone, its context not the one the engine asks (a figure Fux writes where the engine would not)
      if (!figure) for (const f of FIGURES) for (const v of f.variants || [{}]) if (!figure && shape.length > 1 && same(f, { ...x, ...v, sus: false, tie: false, within: true })) { figure = f.id; loose = true; }
    }
    spans.push({ t, notes: ns, durs, cell, figure: figure || "other:" + shape.join(","), loose, shape, tiedIn });
  }
  return { frame: names, spans };
}

/** The counts over a corpus of lines. */
export function measure(lines) {
  const inc = (m, k) => m.set(k, (m.get(k) || 0) + 1);
  const st = { lines: 0, unread: 0, figures: new Map(), cells: new Map(), bars: new Map(), frame: new Map(), bits: 0, halves2: 0, kinds: 0, loose: 0, halves: 0, ties: 0, tiesOk: 0, again: 0, barsN: 0, arc: [0, 0, 0, 0, 0], arcN: [0, 0, 0, 0, 0] };
  for (const line of lines) {
    const R = readLine(line);
    if (!R) { st.unread++; continue; }
    st.lines++;
    const S = R.spans, K = keyOf(line.key), deg = (nm) => codeDegree(codeOf(K, nm));
    // its coherence: the derivation's length, cell by cell (florid.mjs's derivationLength)
    { const dl = derivationLength(S.slice(line.skip || 0)); st.bits += dl.bits; st.halves2 += S.length - (line.skip || 0); st.kinds += dl.cells; }
    // the frame's moves, from the first half bar counted on
    for (let t = Math.max(1, (line.skip || 0) + 1); t < R.frame.length; t++) inc(st.frame, intervalKey(deg(R.frame[t]) - deg(R.frame[t - 1])));
    S.forEach((sp, t) => {
      if (t < (line.skip || 0)) return;
      st.halves++; inc(st.figures, sp.figure); inc(st.cells, sp.cell); if (sp.loose) st.loose++;
      if (sp.tiedIn && t > 0) { st.ties++; const d1 = S[t - 1].durs[S[t - 1].durs.length - 1]; if (d1 >= 2 && d1 >= sp.durs[0]) st.tiesOk++; }
    });
    const bars = [];
    for (let i = 0; i + 1 < S.length; i += 2) bars.push(S[i].cell + "+" + S[i + 1].cell);
    bars.forEach((b, i) => {
      inc(st.bars, b); st.barsN++;
      if (i && bars[i - 1] === b) st.again++;
      const k = Math.min(4, Math.floor(5 * i / bars.length)), notes = S[2 * i].durs.length + S[2 * i + 1].durs.length;
      st.arc[k] += notes; st.arcN[k]++;
    });
  }
  return st;
}

/**
 * The counts as costs: each figure of the catalogue and each cell, −log of its share against the commonest one's,
 * smoothed (alpha, added to every count) and scaled (scale), so the commonest costs 0 and one never seen costs most.
 */
export function costsOf(st, { alpha = 0.5, scale = 0.5 } = {}) {
  const table = (ids, counts) => {
    const c = ids.map((id) => (counts.get(id) || 0) + alpha), max = Math.max(...c);
    return Object.fromEntries(ids.map((id, i) => [id, +(scale * Math.log(max / c[i])).toFixed(3)]));
  };
  return { figures: table(FIGURE_IDS, st.figures), cells: table(CELL_IDS, st.cells), bars: table(BAR_IDS, st.bars), frame: table(FRAME_IDS, st.frame) };
}
const FIGURE_IDS = FIGURES.map((f) => f.id), CELL_IDS = Object.keys(CELLS), BAR_IDS = CELL_IDS.flatMap((a) => CELL_IDS.map((b) => a + "+" + b));
const FRAME_IDS = ["0", ...[1, 2, 3, 4, 5, 6, 7, 8].flatMap((k) => ["+" + k, "-" + k])];

/** The counts in a few lines of text. */
export function describe(st) {
  const top = (m, k = 12) => [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, k).map(([id, c]) => `${id} ${c}`).join(", ");
  const arc = st.arc.map((x, i) => (st.arcN[i] ? (x / st.arcN[i]).toFixed(1) : "–")).join(" ");
  return [
    `${st.lines} lines (${st.unread} not read), ${st.halves} half bars`,
    `figures: ${top(st.figures)} (${st.loose} by their shape alone)`,
    `cells: ${top(st.cells)}`,
    `bars: ${top(st.bars, 8)}; a bar like the one before ${Math.round(100 * st.again / Math.max(1, st.barsN))}%`,
    `ties: ${st.ties}, to an equal or shorter value ${st.tiesOk}`,
    `notes a bar along the phrase: ${arc}`,
    `the frame's moves: ${top(st.frame, 10)}`,
    `coherence: ${(st.bits / Math.max(1, st.halves2)).toFixed(2)} bits a half bar, ${(st.kinds / Math.max(1, st.lines)).toFixed(1)} distinct cells a line`,
  ];
}

const shares = (m, ids, alpha) => { const c = ids.map((id) => (m.get(id) || 0) + alpha), z = c.reduce((a, b) => a + b, 0); return Object.fromEntries(ids.map((id, i) => [id, c[i] / z])); };

/** How far two counts are apart: the total variation (0 … 1) of their figures' shares, of their bars' rhythms' and of
 *  their frames' moves, the mean of the three ({figures, bars, frame} each apart with parts: true). */
export function distance(a, b, alpha = 0.5, { parts = false } = {}) {
  const tv = (ids, m) => { const p = shares(a[m], ids, alpha), q = shares(b[m], ids, alpha); return ids.reduce((s, id) => s + Math.abs(p[id] - q[id]), 0) / 2; };
  const figures = tv(FIGURE_IDS, "figures"), bars = tv(BAR_IDS, "bars"), frame = tv(FRAME_IDS, "frame");
  return parts ? { figures, bars, frame } : (figures + bars + frame) / 3;
}

/**
 * The costs fitted to a corpus's counts: from costsOf, rounds of generate(costs) → lines, measured, each figure's and
 * cell's and bar rhythm's cost moved by eta × log(its share in the engine's lines / its share in the corpus); the round nearest the
 * corpus kept. → {costs, distance, rounds: [{distance}]}.
 */
export function fitCosts(target, generate, { rounds = 5, eta = 0.5, alpha = 0.5 } = {}) {
  let costs = costsOf(target, { alpha }), best = null;
  const fids = FIGURE_IDS, cids = CELL_IDS, bids = BAR_IDS, rids = FRAME_IDS, log = [];
  const pt = shares(target.figures, fids, alpha), ct = shares(target.cells, cids, alpha), bt = shares(target.bars, bids, alpha), rt = shares(target.frame, rids, alpha);
  for (let k = 0; k <= rounds; k++) {
    const st = measure(generate(costs)), d = distance(st, target, alpha);
    log.push({ distance: d });
    if (!best || d < best.d) best = { d, costs };
    if (k === rounds) break;
    const pm = shares(st.figures, fids, alpha), cm = shares(st.cells, cids, alpha), bm = shares(st.bars, bids, alpha), rm = shares(st.frame, rids, alpha);
    const step = (tab, ids, m, t) => { const out = {}; for (const id of ids) out[id] = Math.max(0, tab[id] + eta * Math.log(m[id] / t[id])); const lo = Math.min(...Object.values(out)); for (const id of ids) out[id] = +(out[id] - lo).toFixed(3); return out; };
    costs = { figures: step(costs.figures, fids, pm, pt), cells: step(costs.cells, cids, cm, ct), bars: step(costs.bars, bids, bm, bt), frame: step(costs.frame, rids, rm, rt) };
  }
  // the round nearest the corpus (a round may overshoot: the frames leave each figure more or less room)
  return { costs: best.costs, distance: best.d, rounds: log };
}

// ─── a corpus in Humdrum **kern (Fux's examples, as Mark Gotham's species corpus has them) ───
const MODE_OF = { c: "ionian", d: "dorian", e: "phrygian", f: "lydian", g: "mixolydian", a: "aeolian" };
const DUR8 = { 1: 8, 2: 4, 4: 2, 8: 1 };

/** A **kern token's note: {name ("D4", "Bb3", "C#5"; null a rest), dur (eighths), tied (the second of a tie: held,
 *  not struck)}. */
export function kernNote(tok) {
  const m = /^[[(]*(\d+)(\.?)([a-gA-Gr]+)([#-]*)/.exec(tok.trim());
  if (!m) return null;
  const d = DUR8[m[1]];
  if (!d) throw new Error(`a duration not on the eighths' grid: ${tok}`);
  const dur = m[2] ? d + d / 2 : d, p = m[3];
  if (p[0] === "r") return { name: null, dur };
  const letter = p[0].toUpperCase(), oct = p[0] === p[0].toLowerCase() ? 3 + p.length : 4 - p.length;
  return { name: letter + m[4].replace(/-/g, "b") + oct, dur, tied: /[\]_]/.test(tok) };
}

/**
 * Fux's example from its **kern: {id, figure, mode, key, cf (a note a bar), cfPart ("Lower" | "Upper"), notes ([{name,
 * dur}] of the added part), rest (the eighths of rest it starts with)}. octave: added to the cantus firmus's octaves (−1,
 * the bass an octave down, where the engine has it; the counterpoint stays, its intervals compound).
 */
export function fromKern(text, { octave = -1 } = {}) {
  const lines = text.split(/\r?\n/);
  const opr = lines.find((l) => l.startsWith("!!!OPR")) || "";
  const fig = (/Fig\. (\w+)/.exec(opr) || [])[1], final = ((/Modal final: (\w)/.exec(opr) || [])[1] || "c").toLowerCase();
  const cfPart = (/Cantus firmus: (\w+)/.exec(opr) || [])[1];
  const data = lines.filter((l) => l && !/^[!*=]/.test(l)).map((l) => l.split("\t"));
  const voices = [0, 1].map((i) => data.map((r) => r[i]).filter((x) => x && x !== ".").map(kernNote).filter(Boolean));
  const ci = voices.findIndex((v) => v.every((x) => x.name === null || x.dur === 8));
  const shift = (nm) => nm.replace(/-?\d+$/, (o) => String(Number(o) + octave));
  const cf = voices[ci].filter((x) => x.name).map((x) => shift(x.name));
  const notes = [];
  let rest = 0;
  for (const x of voices[1 - ci]) {
    if (x.name === null) { if (!notes.length) rest += x.dur; continue; }
    notes.push(x);
  }
  return { id: "gap_" + fig, figure: fig, mode: MODE_OF[final], key: { tonic: final.toUpperCase(), mode: MODE_OF[final] }, cf, cfPart, notes, rest };
}

/** Fux's example as a line to read: the rest it starts with held as its first note (the engine's half bars start on
 *  the downbeat), the half bars it covers left out of the counts (skip). */
export function lineOfKern(ex) {
  const eighths = [...Array(ex.rest).fill(ex.notes[0].name), ...eighthsOf(ex.notes)];
  // where a note is struck (a note again, not tied, is struck again: Fux's anticipation in quarters)
  const struck = [...Array(ex.rest).fill(false), ...ex.notes.flatMap((x) => [!x.tied, ...Array(x.dur - 1).fill(false)])];
  struck[0] = true;
  return { cf: ex.cf.join(" "), key: ex.key, eighths, struck, skip: Math.ceil(ex.rest / SUB), id: ex.id, mode: ex.mode };
}

const FUX_FILES = ["082", "083", "084a", "084b", "085a", "085b", "086a", "086b", "087a", "087b", "088a", "088b"].map((x) => `gap_${x}.krn`);
/** Fux's twelve two-part florid examples (corpus/fux, Mark Gotham's encoding, CC0), read (fromKern): in Node from
 *  the files, in the browser fetched beside this module. */
export async function loadFux() {
  const base = new URL("../corpus/fux/", import.meta.url);
  const isNode = typeof process !== "undefined" && process.versions && process.versions.node && base.protocol === "file:";
  const read = isNode ? async (f) => (await import("node:fs")).readFileSync(new URL(f, base), "utf8") : async (f) => (await fetch(new URL(f, base))).text();
  return Promise.all(FUX_FILES.map(async (f) => fromKern(await read(f))));
}

/** The engine's costs fitted to Fux's examples (corpus/fit.mjs: the five with the cantus firmus below, 97 half bars;
 *  drawn over his six canti firmi in their modes with his economy, on seeds the fit did not see: figures 0.53 → 0.15,
 *  bars' rhythms 0.61 → 0.13, the frame's moves 0.40 → 0.16 from his, total variation — his syncopations and thirds in
 *  the frame, the room his passing notes need). florid({costs: FUX_COSTS, economy: FUX_ECONOMY}). */
export const FUX_COSTS = {"figures":{"held":0.64,"passing":0,"neighbor":3.23,"anticipation":5.9,"escape":6.75,"skip":2.26,"tirata":0,"turn":1.95,"double-neighbor":2.23,"passing-eighths":0,"cambiata":0,"anticipated-resolution":0,"ornamented-resolution":0},"cells":{"H":0.49,"Q":0,"DQ":2.55,"QE":0.48},"bars":{"H+H":0.95,"H+Q":1.58,"H+DQ":0.44,"H+QE":2.74,"Q+H":0,"Q+Q":0.19,"Q+DQ":0,"Q+QE":0.78,"DQ+H":0,"DQ+Q":0,"DQ+DQ":0,"DQ+QE":0,"QE+H":0.65,"QE+Q":0,"QE+DQ":0,"QE+QE":0.09},"frame":{"0":0.14,"+1":2.35,"-1":1.2,"+2":0.95,"-2":0,"+3":1.18,"-3":0.09,"+4":2.77,"-4":0,"+5":0,"-5":0,"+6":0,"-6":0,"+7":3,"-7":0,"+8":0,"-8":0}};
/** How much Fux's lines save in what they take to say (the derivation's length as a cost, florid({economy})): fitted with
 *  FUX_COSTS, his examples at 2.85 bits a half bar and 5.2 distinct cells a line, the engine's then at 2.8 and 5.3 (at 3.7
 *  and 7.5 without it). */
export const FUX_ECONOMY = 3;
