// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 61 · reduction: a phrase analysed into levels, and varied from any of them (discussion #321).
//
//   the analysis   the phrase's surface (salami slices, protovoices.mjs) reduced a step at a time, each step an
//                  unsplit (a slice of ornaments taken away), an unsuspend (a suspension's resolution brought onto
//                  the beat it was delayed from) or an unspread (two slices heard as one sonority), the
//                  cheapest by the policy, until none is left: the levels L0 (the surface) … Ln (the frame); read
//                  backwards, the steps are the derivation (split, spread) that composes the phrase from its frame
//   the policy     one cost for every step, so the same weights mean the same reading everywhere:
//                    · the ornaments' own cost (a note held the cheapest, an incomplete neighbour the dearest), more
//                      where an ornament leans on another voice (protovoices.mjs)
//                    · GTTM's metrical weight: taking away a slice on a strong unit costs more (the head of a
//                      time-span is its strongest event)
//                    · the dissonance: a dissonant slice is an ornament before a consonant one
//                    · the soft rules (soft.mjs, those of every engine): how the melody of the level left moves
//                    · GTTM's cadential retention: the frame keeps the first slice and the cadence (the last two bass
//                      notes)
//   a level        checked by the same hard rules as every phrase (incipit.mjs's check, @kairotic/cac's
//                  partimento.mjs), drawn on the units' grid: its notes held over the time of what they prolong
//   vary from k    the melody's notes that survive at level k kept where they are, the rest written again by the
//                  engine of Studies 56–60 (the same hard and soft rules), a note different from the surface's
//                  preferred: the deeper k, the less is kept
//
// Pure data and functions.

import { notesOfPhrase, slicesOf, unsplit, unspread, unsuspend, sonorous, phraseOfPath, pitchOf, ORNAMENTS } from "./protovoices.mjs";
import { melodicParts, total, pick, choose, temperature } from "./soft.mjs";
import { check, rangeOf, endingOf, PER, LINE, MIN_NOTES } from "./incipit.mjs";
import { figuring } from "./figuring.mjs";
import { keyOf, codeOf, codeDegree, codeAlter } from "./partimento.mjs";
import { exportMei, fromUnits, fileName } from "./export.mjs";

/** The policy's weights. */
export const WEIGHTS = { meter: 1, dissonance: 1, line: 0.3, voice: 0.5, spread: 0.8, crowd: 0.3, illegal: 6 };

const split = (s) => (Array.isArray(s) ? s : String(s || "").trim().split(/\s+/).filter(Boolean));
const top = (s) => s.notes[s.notes.length - 1].pitch;

/** GTTM's metrical weight of a unit (a bar is per units; bars in twos and fours). */
export function meter(u, per = PER) {
  if (u % per) return 0;
  const bar = u / per;
  return bar % 4 === 0 ? 3 : bar % 2 === 0 ? 2 : 1;
}

/** The soft cost of a level's melody (its highest notes, a slice each, a note held once). */
export function lineCost(path) {
  const line = [];
  for (const s of path) { const d = pitchOf(top(s)).d; if (line[line.length - 1] !== d) line.push(d); }
  let c = 0;
  for (let t = 1; t < line.length; t++) c += total(melodicParts(line.slice(0, t), line[t]));
  return c;
}

/** The slices the frame keeps (GTTM's cadential retention): the first, and from the last bass note but one. */
function kept(path, notes) {
  const bass = notes.filter((n) => n.voice === "b"), pen = bass.length >= 2 ? bass[bass.length - 2].on : Infinity;
  return (i) => i === 0 || path[i].on >= pen;
}

/** The candidate steps from a path, each with its cost: [{op, at, on, cost, parts, path, explained | notes}]. */
export function candidates(path, notes, { per = PER, weights = {}, judge = null } = {}) {
  const W = { ...WEIGHTS, ...weights }, out = [], keep = kept(path, notes), base = lineCost(path);
  // (the hard rules: a step that makes a level they refuse around it costs `illegal` more — taken only where no other
  // is left; a level halfway through a sequence may be irregular elsewhere, which is not this step's doing)
  const legal = (p, i) => {
    if (!judge) return {};
    const c = judge(p);
    if (c.ok || c.short) return {};
    // (around the step: from the slice before it to the end of the one after, on the units' grid)
    const lo = path[Math.max(0, i - 1)].on, hi = path[Math.min(path.length - 1, i + 1)].end;
    const near = c.errors.filter((e) => e.unit === null || (e.unit - 1 >= lo - 1 && e.unit - 1 <= hi));
    return near.length ? { illegal: W.illegal, why: near.map((e) => e.reason) } : {};
  };
  for (let i = 1; i < path.length; i++) {
    if (!keep(i) && i < path.length - 1) {
      const u = unsplit(path, i, { voice: W.voice, ornaments: weights.ornaments });
      if (u.ok) {
        const parts = {
          ornaments: u.explained.reduce((a, e) => a + e.cost, 0),
          meter: W.meter * meter(path[i].on, per),
          dissonance: sonorous(path[i].notes.map((n) => n.pitch)) ? 0 : -W.dissonance,
          line: W.line * (lineCost(u.path) - base),
        };
        const lg = legal(u.path, i);
        if (lg.illegal) parts.illegal = lg.illegal;
        out.push({ op: "unsplit", at: i, on: path[i].on, touches: [i - 1, i, i + 1], parts, cost: total(parts), path: u.path, explained: u.explained });
      }
    }
    if (!keep(i) && i < path.length - 1 && !keep(i + 1)) {
      // a suspension: its resolution brought onto the beat (the onset taken away is the resolution's)
      const u = unsuspend(path, i);
      if (u.ok) {
        const parts = {
          ornaments: u.explained.reduce((a, e) => a + e.cost, 0),
          meter: W.meter * meter(path[i + 1].on, per),
          dissonance: -W.dissonance,
          line: W.line * (lineCost(u.path) - base),
        };
        const lg = legal(u.path, i);
        if (lg.illegal) parts.illegal = lg.illegal;
        out.push({ op: "unsuspend", at: i, on: path[i].on, touches: [i - 1, i, i + 1], parts, cost: total(parts), path: u.path, explained: u.explained });
      }
    }
    if (!keep(i)) {
      const s = unspread(path, i - 1);
      if (s.ok) {
        const parts = {
          spread: W.spread, meter: W.meter * meter(path[i].on, per), crowd: W.crowd * Math.max(0, s.notes.length - 2),
          line: W.line * (lineCost(s.path) - base),
        };
        const lg = legal(s.path, i);
        if (lg.illegal) parts.illegal = lg.illegal;
        out.push({ op: "unspread", at: i - 1, on: path[i].on, touches: [i - 1, i], parts, cost: total(parts), path: s.path, notes: s.notes.map((n) => n.id) });
      }
    }
  }
  return out;
}

/**
 * A phrase analysed: {notes, units, levels: [path L0 … Ln], steps: [{op, at, on, level, cost, parts, explained | notes,
 * among (how many steps were possible)}]}.
 *
 * A level is a pass over the whole phrase, as GTTM's time-span reduction goes down the metrical grid: in one pass
 * every step that can be taken is, cheapest first, judged against the level below: a slice kept as a parent of an
 * ornament is not taken away in the same pass, a sonority a spread has made waits for the next, and no step may make a
 * level the hard rules refuse around it. A pass takes what stands on the
 * metrical stratum reached (stratum 0: the weak units; 1, 2, 3: the bars by their weight) or below it, and a dissonant
 * slice wherever it stands (an appoggiatura on a strong unit is an ornament too); when a pass finds nothing the
 * stratum goes up. Only where nothing legal is left does a pass take one step the rules refuse, the cheapest.
 * temp (0: always the cheapest) and r (a random number in [0, 1), drawn anew at each step) give other readings: an
 * analysis is an interpretation.
 */
export function reduce(phrase, { key = { tonic: "C" }, per = PER, weights = {}, temp = 0, r = Math.random } = {}) {
  const notes = notesOfPhrase(phrase, per), units = split(phrase.melody).length;
  const judge = (p) => checkPath(p, phrase, key, per);
  let path = slicesOf(notes);
  const levels = [path], steps = [], top = 3;
  const choose1 = (cs) => pick(cs, (x) => x.cost, temp, temp > 0 ? r() : undefined);
  let stratum = 0;
  for (;;) {
    // (slices by their onset: a slice a step has kept as a parent stays this pass's, not to be taken away now; a slice
    // a spread has made is new, neither taken away nor a parent until the next pass)
    const kept = new Set(), fresh = new Set();
    let taken = 0;
    for (;;) {
      const all = candidates(path, notes, { per, weights, judge });
      const no = (j) => !kept.has(path[j].on) && !fresh.has(path[j].on);
      const free = (c) => (c.op === "unsplit" ? no(c.at) && !fresh.has(path[c.at - 1].on) && !fresh.has(path[c.at + 1].on)
        : c.op === "unsuspend" ? no(c.at) && !fresh.has(path[c.at + 1].on) && !fresh.has(path[c.at - 1].on)
        : c.touches.every(no));
      const cs = all.filter((c) => !c.parts.illegal && free(c) && (meter(c.on, per) <= stratum || c.parts.dissonance < 0));
      if (!cs.length) break;
      const { path: next, touches, ...step } = choose1(cs);
      steps.push({ ...step, level: levels.length, among: cs.length });
      if (step.op === "unsplit") { kept.add(path[step.at - 1].on); kept.add(path[step.at + 1].on); }
      // (a suspension undone: its preparation and the resolution on the beat may be parents in this pass — in a
      // chain the resolution is the next one's preparation, so the one before may still bring it onto its own beat,
      // the note kept — but not taken away)
      else if (step.op === "unsuspend") { kept.add(path[step.at - 1].on); kept.add(path[step.at].on); }
      else fresh.add(path[step.at].on);
      path = next;
      taken++;
    }
    if (taken) { levels.push(path); continue; }
    if (stratum < top) { stratum++; continue; }
    // nothing legal left: the cheapest step the rules refuse, alone, if any
    const all = candidates(path, notes, { per, weights, judge });
    if (!all.length) break;
    const { path: next, touches, ...step } = choose1(all);
    steps.push({ ...step, level: levels.length, among: all.length });
    levels.push((path = next));
  }
  return { phrase, key, per, notes, units, levels, steps };
}

/** The steps that lead from level k − 1 to level k. */
export const stepsInto = (an, k) => an.steps.filter((s) => s.level === k);

/** A level as note against note (a slice a unit, its lowest note the bass, its highest the melody): for a reading at the level's own pace. */
export const unitPhrase = (path, cadence) => ({ bass: path.map((s) => s.notes[0].pitch).join(" "), melody: path.map(top).join(" "), cadence });

/** The rules about how long a note may be held are the surface's: a level prolongs its notes by definition. */
const HOLD = /held \d+ units? at most/;

/**
 * A level checked by the hard rules of every phrase on the phrase's own metrical grid (figuring.mjs's voice, as
 * incipit.mjs's check asks it): its notes held over the time of what they prolong, so a strong unit stays strong —
 * every rule but how long a note may be held. {ok, errors: [{unit (1-based), at, note, reason}]}, every error found.
 */
export function checkPath(path, phrase, key, per = PER) {
  const K = keyOf(key), units = split(phrase.melody).length, range = rangeOf(phrase, key);
  const g = phraseOfPath(path, units, per), U = split(g.melody).map((nm) => codeOf(K, nm));
  const bass = split(g.bass).map((nm) => { const c = codeOf(K, nm); return { d: codeDegree(c), r: codeAlter(c) }; });
  let F;
  try { F = figuring({ bass, key: K, per, ending: endingOf(phrase.cadence), line: LINE, lo: range.lo, hi: range.hi, ro: true }); }
  catch (e) { return { ok: false, errors: [{ unit: null, at: "the bass", reason: e.message }] }; }
  const errors = [];
  for (let t = 0; t < Math.min(F.n, U.length); t++) {
    const r = F.voice.check(U.slice(0, t), t, U[t]);
    if (r && !HOLD.test(r)) errors.push({ unit: t + 1, at: `unit ${t + 1}`, note: F.name(U[t]), reason: r });
  }
  return { ok: !errors.length, errors };
}

/** Level k drawn on the units' grid, as a phrase (its cadence the phrase's): its notes held over what they prolong. */
export const phraseAt = (an, k) => ({ ...phraseOfPath(an.levels[k], an.units, an.per), cadence: an.phrase.cadence });

/** Level k checked by the hard rules: the surface as every phrase is, a level below it on the same grid (checkPath). */
export function checkLevel(an, k) {
  if (k === 0) return check(null, an.phrase, { key: an.key, range: rangeOf(an.phrase, an.key), per: an.per });
  return checkPath(an.levels[k], an.phrase, an.key, an.per);
}

/** What a level sounds: each note from the first slice it is in to the end of the last (a note held across slices one
 *  note; the notes of a sonority spread sounding together from its onset), as [{id, pitch, voice, on, dur}] in time. */
export function eventsOf(path) {
  const at = new Map();
  for (const s of path) for (const n of s.notes) {
    const e = at.get(n.id);
    if (e && e.end === s.on) e.end = s.end;
    else if (!e) at.set(n.id, { id: n.id, pitch: n.pitch, voice: n.voice, on: s.on, end: s.end });
  }
  return [...at.values()].map(({ end, ...e }) => ({ ...e, dur: end - e.on })).sort((a, b) => a.on - b.on || a.voice.localeCompare(b.voice));
}
/** What level k sounds (eventsOf). */
export const soundAt = (an, k) => eventsOf(an.levels[k]);
/** What a phrase of the incipit's sounds: its notes, the bass a bar each, the melody a unit each (held as written). */
export const soundOf = (phrase, per = PER) => notesOfPhrase(phrase, per).map(({ id, pitch, voice, on, dur }) => ({ id, pitch, voice, on, dur }));

/** The notes left at level k (their ids). */
export const survivors = (an, k) => new Set(an.levels[k].flatMap((s) => s.notes.map((n) => n.id)));

/** The derivation: the steps read forwards, from the frame to the surface — what composes the phrase. */
export function derivation(an) {
  return an.steps.slice().reverse().map((s) => (s.op === "unsplit" || s.op === "unsuspend"
    ? { op: s.op === "unsplit" ? "split" : "suspend", on: s.on, notes: s.explained.map((e) => ({ id: e.id, pitch: e.pitch, ornament: e.orn, pv: ORNAMENTS[e.orn].pv, parents: e.parents, ...(e.resolution ? { resolution: e.resolution } : {}) })) }
    : { op: "spread", on: s.on, notes: s.notes }));
}

/** How a step reads, in words. */
export function describe(step) {
  if (step.op === "unspread") return `bar ${Math.floor(step.on / 2) + 1}: two slices heard as one sonority (a spread)`;
  if (step.op === "unsuspend") return `bar ${Math.floor(step.on / 2) + 1}${step.on % 2 ? ", weak" : ""}: ${step.explained.map((e) => `${e.pitch} held over the beat, a suspension: its resolution brought onto the beat`).join("; ")}`;
  const ex = step.explained.filter((e) => e.orn !== "tie").map((e) => `${e.pitch} ${ORNAMENTS[e.orn].doc}`);
  return `bar ${Math.floor(step.on / 2) + 1}${step.on % 2 ? ", weak" : ""}: ${ex.length ? ex.join("; ") : "only notes held"}`;
}

/**
 * Vary the melody from level k: the melody's notes that survive at k kept on their units (held as long), the others written again by
 * the engine (the hard rules of figuring.mjs's voice, its soft costs, a note other than the surface's costing `novelty`
 * more). Returns {melody (names, a unit each), kept (units), changed (units)} or null where nothing can be written.
 */
export function vary(an, k, { temp = 0.6, r = Math.random, novelty = 1.5, budget = 40000 } = {}) {
  const key = an.key, K = keyOf(key), phrase = an.phrase, per = an.per;
  const range = rangeOf(phrase, key);
  const bass = split(phrase.bass).map((nm) => { const c = codeOf(K, nm); return { d: codeDegree(c), r: codeAlter(c) }; });
  const F = figuring({ bass, key: K, per, ending: endingOf(phrase.cadence), line: LINE, lo: range.lo, hi: range.hi, ro: true });
  const V = F.voice, n = F.n, mel = split(phrase.melody);
  if (n !== mel.length) throw new Error(`the melody has ${mel.length} units, its bass ${n}`);
  const orig = mel.map((nm) => codeOf(K, nm));
  const alive = survivors(an, k), pins = new Map();
  // (a note that survives keeps its time on the surface: its onset and the units it is held)
  for (const x of an.notes) if (x.voice === "m" && alive.has(x.id)) for (let t = x.on; t < x.on + x.dur; t++) pins.set(t, codeOf(K, x.pitch));
  const gumbel = () => -Math.log(-Math.log(Math.min(0.999999, Math.max(1e-6, r()))));
  let nodes = 0;
  const U = [];
  function go(t) {
    if (t === n) return true;
    if (++nodes > budget) return false;
    const fixed = pins.get(t);
    const cs = (fixed !== undefined ? [fixed] : V.codes)
      .filter((c) => V.check(U, t, c) === null)
      .map((c) => ({ c, cost: total(V.costParts(U, c)) + (fixed === undefined && c === orig[t] && (t === 0 || U[t - 1] !== c) ? novelty : 0) }))
      .map((x) => ({ ...x, key: x.cost - temp * gumbel() }))
      .sort((a, b) => a.key - b.key);
    for (const x of cs) {
      U.push(x.c);
      if (V.count(U) > 0n && go(t + 1)) return true;
      U.pop();
    }
    return false;
  }
  if (!go(0)) return null;
  const names = U.map((c) => F.name(c).replace("♯", "#").replace("♭", "b"));
  return { melody: names.join(" "), kept: [...pins.keys()].sort((a, b) => a - b), changed: names.map((x, t) => (x !== mel[t] ? t : -1)).filter((t) => t >= 0) };
}

// ─── as MEI, for the app (discussion #319) ───
/** A level's two outer lines on the units' grid: at each unit the lowest and the highest note of the slice sounding,
 *  and whether it is struck there (a note held across slices — the same note — is not: one note, as long as it lasts). */
export function linesAt(an, k) {
  const path = an.levels[k], top = [], bass = [], topStruck = [], bassStruck = [];
  let pt = null, pb = null;
  for (let u = 0; u < an.units; u++) {
    const s = path.filter((x) => x.on <= u).pop(), lo = s.notes[0], hi = s.notes[s.notes.length - 1];
    bass.push(lo.pitch); bassStruck.push(!pb || pb.id !== lo.id);
    top.push(hi.pitch); topStruck.push(!pt || pt.id !== hi.id);
    pb = lo; pt = hi;
  }
  return { top, bass, topStruck, bassStruck };
}

/**
 * Level k (or, with melody, a variation over the phrase's bass) as MEI for the app: two voices, each note written as
 * long as it lasts — a note held is one note, tied only over the bar line — and in the extMeta what the study knows
 * (the level, its steps, the derivation). → {mei, name}.
 */
export function meiOf(an, k, { melody = null, title = null } = {}) {
  let top, bass, topStruck, bassStruck;
  if (melody) {
    // a variation: the surface's bass, the melody given (a name repeated is the note held, as every engine reads it)
    ({ bass, bassStruck } = linesAt(an, 0));
    top = split(melody); topStruck = null;
  } else ({ top, bass, topStruck, bassStruck } = linesAt(an, k));
  const name = title || (melody ? `A variation from level ${k}` : k === 0 ? "The phrase, its surface" : `The phrase at level ${k}`);
  const x = exportMei({
    title: name, source: "Kairotic Study 61 · reduction", key: an.key,
    voices: [{ label: "melody", clef: "G", notes: fromUnits(top, topStruck) }, { label: "bass", clef: "F", notes: fromUnits(bass, bassStruck) }],
    root: { study: "61 · reduction", level: k, levels: an.levels.length, variation: !!melody,
            steps: stepsInto(an, k).map((st) => describe(st)), phrase: { bass: an.phrase.bass, melody: an.phrase.melody, cadence: an.phrase.cadence } },
  });
  return { mei: x.mei, name: fileName(name) };
}
