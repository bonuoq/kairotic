// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 64 · florid: florid counterpoint over a cantus firmus, every note justified by a derivation (#342).
//
// A note is legal if a legal derivation makes it. The derivation has three levels, each on its own metrical grid:
//
//   the frame     a note a half bar over the cantus firmus (the bass, a whole note a bar): second and fourth species,
//                 drawn by a bridge (Study 63) over the kernel every phrase answers to (partimento.mjs through
//                 figuring.mjs: consonance on the strong half, passing on the weak one, suspensions prepared and
//                 resolved, structural parallels refused…)
//   the figures   each half bar of the frame, from its note a to the next one b, elaborated into four eighths by a
//                 figure of the catalogue (FIGURES): a figure has a rhythm, a shape relative to a and b, and the
//                 places where it may be dissonant — the dissonance it brings is justified by the frame it ornaments
//                 (a passing tone between a and b, a neighbour of a, an escape tone leaving a, a cambiata…); and a
//                 suspension of the frame may be held, or resolved later, ornamented
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

// ─── the figures ───
/**
 * The catalogue. Each figure: its eighths as offsets in steps from a (the note it starts on), given s (the steps from
 * a to b); when it fits (s, and whether a is a suspension or the note before one); which of its notes may be
 * dissonant (free), the others consonant with the bass; its cost (how plain or how rare); and its name in the
 * Baroque figures where it has one (Bernhard, Walther).
 */
export const FIGURES = [
  { id: "held", name: "a half note", shape: () => [0, 0, 0, 0], fits: () => true, free: [], cost: 1.2 },
  { id: "passing", name: "a passing quarter (transitus)", shape: (s) => [0, 0, Math.sign(s), Math.sign(s)], fits: (s, x) => Math.abs(s) === 2 && !x.sus, free: [2, 3], cost: 0.2 },
  { id: "dotted-passing", name: "a passing eighth, dotted", shape: (s) => [0, 0, 0, Math.sign(s)], fits: (s, x) => Math.abs(s) === 2 && !x.sus, free: [3], cost: 0.6 },
  { id: "run", name: "a run of eighths (tirata)", shape: (s) => [0, Math.sign(s), 2 * Math.sign(s), 3 * Math.sign(s)], fits: (s, x) => Math.abs(s) === 4 && !x.sus, free: [1, 3], cost: 0.5 },
  { id: "neighbor", name: "a neighbour quarter", shape: (s, x) => [0, 0, x.up ? 1 : -1, x.up ? 1 : -1], fits: (s, x) => s === 0 && !x.sus && !x.tie, free: [2, 3], cost: 0.4, variants: [{ up: true }, { up: false }] },
  { id: "turn", name: "a turn (circulatio)", shape: (s) => [0, 1, 0, -1], fits: (s, x) => (s === 0 || s === -2) && !x.sus && !x.tie, free: [1, 3], cost: 0.7 },
  { id: "anticipation", name: "an anticipation (anticipatio)", shape: (s) => [0, 0, s, s], fits: (s, x) => Math.abs(s) === 1 && !x.sus && !x.tie, free: [2, 3], cost: 0.8 },
  { id: "escape", name: "an escape tone (échappée)", shape: (s) => [0, 0, -Math.sign(s), -Math.sign(s)], fits: (s, x) => Math.abs(s) === 1 && !x.sus && !x.tie, free: [2, 3], cost: 1.0 },
  { id: "skip", name: "a skip to a note of the chord", shape: (s, x) => [0, 0, x.to, x.to], fits: (s, x) => !x.sus && !x.tie, free: [], cost: 0.9, variants: [{ to: 2 }, { to: -2 }, { to: 4 }, { to: -3 }] },
  { id: "cambiata", name: "a cambiata (nota cambiata)", shape: () => [0, -1, -3, -3], fits: (s, x) => s === -2 && !x.sus && !x.tie, free: [1], cost: 0.9 },
  { id: "tie-neighbor", name: "a neighbour, then the note held over the bar (a suspension prepared)", shape: () => [0, -1, 0, 0], fits: (s, x) => x.tie, free: [1], cost: 0.5 },
  { id: "anticipated-resolution", name: "a suspension resolved early, in an eighth (anticipatio)", shape: () => [0, 0, 0, -1], fits: (s, x) => x.sus, free: [3], cost: 0.5 },
  { id: "ornamented-resolution", name: "a suspension resolved through a third below it (an ornamented resolution)", shape: () => [0, 0, -2, -2], fits: (s, x) => x.sus && s === -1, free: [], cost: 0.6 },
];

/**
 * A frame drawn by a bridge over the cantus firmus: a note a half bar (units), legal under the rules of every phrase.
 * {voice, units (codes), names} or null.
 */
export function frameOf(cf, key, { temp = 0.6, r = Math.random } = {}) {
  const bars = split(cf).length, n = (bars - 1) * 2 + 1;
  const phrase = { bass: split(cf).join(" "), melody: Array(n).fill("C5").join(" "), cadence: "perfect" };
  const vo = voiceOver(phrase, key);
  const B = bridgeVoice(vo.V, { temp });
  if (!B.possible) return null;
  const U = B.draw(r);
  return U ? { voice: vo, phrase, units: U, names: U.map(vo.name) } : null;
}

/**
 * The frame elaborated: each half bar a figure, chosen by a softmax of −cost / temp among those that fit and keep
 * the rules (density: how busy, 0 … 1; the same figure twice in a row costs `again` more). → {eighths (names),
 * spans: [{unit, figure, name, notes}], frame (names)} or null.
 */
export function elaborate(frame, cf, key, { temp = 0.5, r = Math.random, density = 0.6, again = 0.4 } = {}) {
  const K = keyOf(key), V = frame.voice.V, U = frame.units, n = U.length, bass = split(cf);
  const deg = (c) => codeDegree(c), nameAt = (d) => K.name(d, 0).replace("♯", "#").replace("♭", "b");
  const bassAt = (t) => bass[Math.floor(t / 2)];
  const dis = (t, c) => V.vertical(t, c).q === "dissonant";
  const eighths = [], spans = [];
  let prevFig = null;
  for (let t = 0; t < n; t++) {
    const a = U[t];
    if (t === n - 1) { for (let j = 0; j < SUB; j++) eighths.push(frame.names[t]); spans.push({ unit: t, figure: "held", name: "the final note", notes: [frame.names[t]] }); break; }
    const b = U[t + 1], s = deg(b) - deg(a);
    // a suspension: a held into the strong unit t+1 and dissonant there (this half bar prepares it, holding a); or
    // a itself a suspension (struck before, held, dissonant on its strong unit): this half bar resolves it
    const x = { sus: t > 0 && U[t - 1] === a && t % 2 === 0 && dis(t, a), tie: b === a && (t + 1) % 2 === 0 && dis(t + 1, b) };
    const opts = [];
    for (const f of FIGURES) for (const v of f.variants || [{}]) {
      const xv = { ...x, ...v };
      if (!f.fits(s, xv)) continue;
      const shape = f.shape(s, xv), ds = shape.map((o) => deg(a) + o);
      // in range; no tritone and no 7th between two notes (a leap of the frame itself, up to the octave, is the
      // frame's)
      const names = ds.map(nameAt);
      if (ds.some((d) => d < frame.voice.F.voice.lo || d > frame.voice.F.voice.hi)) continue;
      const seq = [...names, frame.names[t + 1]];
      let ok = true;
      for (let j = 1; j < seq.length && ok; j++) {
        const semi = Math.abs(midiOf(seq[j]) - midiOf(seq[j - 1]));
        if (semi === 6 || semi === 10 || semi === 11 || semi > 12) ok = false;
      }
      // the new notes not free consonant with the bass (a note of the frame is the frame's: a passing tone of it may be
      // held); a free one is approached and left as its figure says
      for (let j = 1; j < SUB && ok; j++) if (shape[j] !== 0 && !f.free.includes(j) && !cons(bassAt(t), names[j])) ok = false;
      // the last eighth to b over a new bass: no parallel 5ths or octaves on the surface either
      if (ok && (t + 1) % 2 === 0) {
        const last = names[SUB - 1], nb = bassAt(t + 1), ob = bassAt(t);
        const pi = (lo, hi) => { const d = ((midiOf(hi) - midiOf(lo)) % 12 + 12) % 12; return d === 0 ? 0 : d === 7 ? 7 : -1; };
        const i1 = pi(ob, last), i2 = pi(nb, frame.names[t + 1]);
        if (i1 >= 0 && i1 === i2 && Math.sign(midiOf(frame.names[t + 1]) - midiOf(last)) === Math.sign(midiOf(nb) - midiOf(ob)) && last !== frame.names[t + 1]) ok = false;
      }
      if (!ok) continue;
      const activity = new Set(shape.map((o, j) => (j && o === shape[j - 1] ? null : j)).filter((j) => j !== null)).size / SUB;
      const cost = f.cost + Math.abs(activity - density) + (prevFig === f.id ? again : 0);
      opts.push({ f, v, names, cost });
    }
    if (!opts.length) return null;
    const pick = choose(opts, temp, r);
    for (const nm of pick.names) eighths.push(nm);
    spans.push({ unit: t, figure: pick.f.id, name: pick.f.name, notes: pick.names });
    prevFig = pick.f.id;
  }
  return { eighths, spans, frame: frame.names };
}

function choose(opts, temp, r) {
  if (temp <= 0.001) return opts.reduce((a, b) => (b.cost < a.cost ? b : a));
  const m = Math.min(...opts.map((o) => o.cost)), ws = opts.map((o) => Math.exp((m - o.cost) / temp));
  let x = r() * ws.reduce((a, b) => a + b, 0);
  for (let j = 0; j < opts.length; j++) { x -= ws[j]; if (x < 0) return opts[j]; }
  return opts[opts.length - 1];
}

/** Florid counterpoint over a cantus firmus: the frame drawn, then elaborated. {frame, eighths, spans} or null. */
export function florid(cf, key, { temp = 0.4, ftemp = 0.5, density = 0.6, r = Math.random, tries = 6 } = {}) {
  for (let i = 0; i < tries; i++) {
    const F = frameOf(cf, key, { temp, r });
    if (!F) return null;
    const E = elaborate(F, cf, key, { temp: ftemp, r, density });
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
  const bars = split(cf).length, n = (bars - 1) * 2 + 1;
  const vo = voiceOver({ bass: split(cf).join(" "), melody: Array(n).fill("C5").join(" "), cadence: "perfect" }, key);
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
