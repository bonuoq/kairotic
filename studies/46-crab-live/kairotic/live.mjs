// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 46 · crab live: the game, pure (no sound, no page), on Study 43's mirror kernel.
//
// In a crab canon the other voice is your line backwards: at beat t it plays your note n−1−t. Study 43 writes it
// from both ends to the middle; here that order is played, live:
//
//   the first half   you choose your note at beat t among the ones that can still close the work; the engine
//                    answers at the same beat with its note — which is your note n−1−t, the end of your own line,
//                    chosen among the ones with a future (the futuribles, counted exactly)
//   the middle       the whole work is written: the rest of your line (the engine's answers, read backwards) is
//                    the score you must read, sent out once, as an outlet would
//   the second half  you read it; the engine plays your first half backwards
//
// A note you play that cannot close the work is taken as the nearest that can (between two as near, the one with
// more futures), and it says so, as the comes box does. With a table canon the other voice is also upside down.
//
//   const g = createLive(o, {rng})   o: mirror(spec) with transform crab or table
//   phase(g) "choose" | "read" | "done" · options(g) · choose(g, x) · auto(g) · read(g) · rest(g) · voices(g)

/** Study 43's taste: steps and small leaps, a repeated note or a large leap costs more. */
export function leapCost(a, b) {
  if (a == null || b == null) return 0;
  const s = Math.abs(b - a);
  return ({ 0: 1.5, 1: 0, 2: 0.3, 3: 0.6, 4: 0.7, 5: 1, 7: 1 })[s] ?? 2;
}

/** The candidate with a future of least cost, a little at random (rng in [0, 1)). */
export function pick(cands, cost, rng = Math.random) {
  let best = null, bv = Infinity;
  for (const c of cands) {
    if (c.reason || !(c.futures > 0)) continue;
    const v = cost(c.note) + 0.9 * rng();
    if (v < bv) { bv = v; best = c; }
  }
  return best;
}

export function createLive(o, { rng = Math.random } = {}) {
  return { o, rng, M: new Array(o.n), t: 0, log: [], score: null };
}

export const phase = (g) => (g.t < g.o.steps ? "choose" : g.t < g.o.n ? "read" : "done");

/** What you may play now: in the first half the notes with a future (and why the others cannot); then the one
 *  written. Each {note, reason, futures} as the kernel's fan gives them. */
export function options(g) {
  if (phase(g) === "choose") return g.o.fan(g.M, g.t);
  if (phase(g) === "read") return [{ note: g.M[g.t], reason: null, futures: 1 }];
  return [];
}

const valid = (cs) => cs.filter((c) => !c.reason && c.futures > 0);

/** The note that will be played for x: x if it can close the work, else the nearest that can. */
export function nearest(g, x) {
  const vs = valid(options(g));
  if (!vs.length) return null;
  if (vs.some((c) => c.note === x)) return x;
  return vs.reduce((b, c) => {
    const d = Math.abs(c.note - x), db = Math.abs(b.note - x);
    return d < db || (d === db && c.futures > b.futures) ? c : b;
  }).note;
}

/** What sounds at beat t once it is written: yours and the engine's (the other voice). */
function beat(g, t) {
  const src = g.o.source(t);
  return { t, you: g.M[t], engine: g.M[src] === undefined ? undefined : g.o.T(g.M[src]) };
}

/** The rest of your line from the middle: the score you must read, as [beat, note] pairs. */
export function rest(g) {
  const out = [];
  for (let t = g.o.steps; t < g.o.n; t++) out.push([t, g.M[t]]);
  return out;
}

/** You play x at this beat of the first half: your note (or the nearest that can close the work) and the
 *  engine's answer, written at both ends. At the middle the rest of your line comes out as the score. */
export function choose(g, x) {
  if (phase(g) !== "choose") return null;
  const a = nearest(g, x);
  if (a == null) return { t: g.t, stuck: true };
  const o = g.o, t = g.t, pos = o.order[t];
  g.M[pos[0]] = a;
  if (pos.length === 2) {
    const q = pos[1];
    // the engine's note: the end of your line, chosen among those with a future, joining the note after it
    const M0 = g.M.slice(); M0[q] = undefined;
    const c = pick(o.fanSecond(M0, t, a), (z) => leapCost(z, g.M[q + 1]), g.rng);
    g.M[q] = c.note;
  }
  g.t++;
  const b = { ...beat(g, t), played: x, corrected: a !== x };
  if (phase(g) !== "choose") { g.score = rest(g); b.score = g.score; }
  g.log.push(b);
  return b;
}

/** The engine plays your note for you (on a pulse, when you did not): the most plausible. */
export function auto(g) {
  if (phase(g) !== "choose") return null;
  const c = pick(options(g), (x) => leapCost(g.M[g.t - 1], x), g.rng);
  if (!c) return { t: g.t, stuck: true };
  const b = choose(g, c.note);
  b.auto = true;
  return b;
}

/** A beat of the second half: your note as written (you read it) and the engine's, your first half backwards. */
export function read(g) {
  if (phase(g) !== "read") return null;
  const b = beat(g, g.t);
  g.t++;
  g.log.push(b);
  return b;
}

/** The two voices as written so far (undefined where not yet): yours, and the other one. */
export function voices(g) {
  const { D, C } = g.o.lines(g.M);
  return { you: D, engine: C };
}
