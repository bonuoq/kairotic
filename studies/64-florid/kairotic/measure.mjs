// SPDX-License-Identifier: MPL-2.0
// Study 64 · florid: measured. A florid line over a cantus firmus read back into what the engine draws — its frame
// (by Study 61's grammar, or given), each half bar's rhythm cell and figure, its ties — counted over a corpus, and the
// counts turned into the engine's costs. The same catalogue both ways: what florid.mjs draws, measure.mjs reads, so
// that the frequencies of Fux's own florid examples (Gradus ad Parnassum, fifth species) can weigh what the engine
// draws (discussion #342, step 3 of the florid road).
//
//   a line      {cf, key, eighths, frame?}: the cantus firmus a note a bar, the florid line on the eighths' grid
//               (a note held across eighths names them again), the frame's names (a note a half bar) if known
//   read        readLine(line) → {frame, spans: [{t, notes, durs, cell, figure, loose, shape, tiedIn}]}: each half
//               bar's struck notes and their lengths, its cell (CELLS, or "other:…"), its figure (FIGURES: the one
//               whose shape it has, and whose context fits — or, loose, the shape alone; or "other:…")
//   measure     measure(lines) → the counts: figures, cells, bars' rhythms, ties (to an equal or shorter value or
//               not), a bar like the one before, notes a bar along the phrase
//   costs       costsOf(stats) → {figures, cells}: a cost each, −log of its share against the commonest (smoothed),
//               for florid({costs}) — a first guess: how often a figure is heard is not how much it is preferred,
//               where the frame leaves room for it or not
//   fit         fitCosts(stats, generate) → the costs with which the engine's own lines are heard as often as the
//               corpus's: rounds of drawing, measuring, and moving each cost by the log of the two shares' ratio (a
//               maximum-entropy fit, its moments the figures' and the cells' shares)
import { SUB, CELLS, FIGURES, frameFrom, contextOf, reduceFlorid } from "./florid.mjs";
import { keyOf, codeOf, codeDegree } from "./partimento.mjs";

const split = (s) => (Array.isArray(s) ? s : String(s || "").trim().split(/\s+/).filter(Boolean));
const cellKey = (durs) => Object.keys(CELLS).find((c) => CELLS[c].join() === durs.join()) || "other:" + durs.join("+");

/** A line given as notes with lengths in eighths ([{name, dur}], a tie as the same name again) on the eighths' grid. */
export const eighthsOf = (notes) => notes.flatMap(({ name, dur }) => Array(dur).fill(name));

/** The struck notes of half bar t of a line on the eighths' grid: their names, lengths (cut at the half bar's end),
 *  and whether the first is held into it from the half bar before (a tie). */
export function struckAt(eighths, t) {
  const p = t * SUB, names = [], durs = [];
  for (let i = p; i < p + SUB && i < eighths.length; i++) {
    if (i === p || eighths[i] !== eighths[i - 1]) { names.push(eighths[i]); durs.push(1); } else durs[durs.length - 1]++;
  }
  return { names, durs, tiedIn: p > 0 && eighths[p] === eighths[p - 1] };
}

/** The frame of a line: given, or the level of Study 61's reduction as long as the frame (a note a half bar). */
export function frameOfLine({ cf, key, eighths, frame = null }) {
  if (frame) return frame;
  const n = (split(cf).length - 1) * 2 + 1, R = reduceFlorid(cf, key, eighths);
  const k = R.an.levels.findIndex((l) => l.length <= n);
  return R.levels[k < 0 ? R.levels.length - 1 : k];
}

/** A line read back: its frame, and each half bar's notes, cell and figure (as florid.mjs's catalogue names them). */
export function readLine(line) {
  const { cf, key, eighths } = line, K = keyOf(key);
  const names = frameOfLine(line), n = names.length;
  let fr;
  try { fr = frameFrom(cf, key, names); } catch (e) { return null; }
  const ctx = contextOf(fr), deg = (nm) => codeDegree(codeOf(K, nm));
  const spans = [];
  for (let t = 0; t < n - 1; t++) {
    const { names: ns, durs, tiedIn } = struckAt(eighths, t), cell = cellKey(durs);
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
  const st = { lines: 0, unread: 0, figures: new Map(), cells: new Map(), bars: new Map(), loose: 0, halves: 0, ties: 0, tiesOk: 0, again: 0, barsN: 0, arc: [0, 0, 0, 0, 0], arcN: [0, 0, 0, 0, 0] };
  for (const line of lines) {
    const R = readLine(line);
    if (!R) { st.unread++; continue; }
    st.lines++;
    const S = R.spans;
    S.forEach((sp, t) => {
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
  return { figures: table(FIGURES.map((f) => f.id), st.figures), cells: table(Object.keys(CELLS), st.cells) };
}

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
  ];
}

const shares = (m, ids, alpha) => { const c = ids.map((id) => (m.get(id) || 0) + alpha), z = c.reduce((a, b) => a + b, 0); return Object.fromEntries(ids.map((id, i) => [id, c[i] / z])); };

/** How far two counts' figure shares are apart: total variation, 0 … 1. */
export function distance(a, b, alpha = 0.5) {
  const ids = FIGURES.map((f) => f.id), p = shares(a.figures, ids, alpha), q = shares(b.figures, ids, alpha);
  return ids.reduce((s, id) => s + Math.abs(p[id] - q[id]), 0) / 2;
}

/**
 * The costs fitted to a corpus's counts: from costsOf, rounds of generate(costs) → lines, measured, each figure's and
 * cell's cost moved by eta × log(its share in the engine's lines / its share in the corpus); the round nearest the
 * corpus kept. → {costs, distance, rounds: [{distance}]}.
 */
export function fitCosts(target, generate, { rounds = 5, eta = 0.5, alpha = 0.5 } = {}) {
  let costs = costsOf(target, { alpha }), best = null;
  const fids = FIGURES.map((f) => f.id), cids = Object.keys(CELLS), log = [];
  const pt = shares(target.figures, fids, alpha), ct = shares(target.cells, cids, alpha);
  for (let k = 0; k <= rounds; k++) {
    const st = measure(generate(costs)), d = distance(st, target, alpha);
    log.push({ distance: d });
    if (!best || d < best.d) best = { d, costs };
    if (k === rounds) break;
    const pm = shares(st.figures, fids, alpha), cm = shares(st.cells, cids, alpha);
    const step = (tab, ids, m, t) => { const out = {}; for (const id of ids) out[id] = Math.max(0, tab[id] + eta * Math.log(m[id] / t[id])); const lo = Math.min(...Object.values(out)); for (const id of ids) out[id] = +(out[id] - lo).toFixed(3); return out; };
    costs = { figures: step(costs.figures, fids, pm, pt), cells: step(costs.cells, cids, cm, ct) };
  }
  // the round nearest the corpus (a round may overshoot: the frames leave each figure more or less room)
  return { costs: best.costs, distance: best.d, rounds: log };
}
