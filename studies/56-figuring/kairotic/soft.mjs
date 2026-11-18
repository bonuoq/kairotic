// SPDX-License-Identifier: MPL-2.0
// @kairotic/cac · soft.mjs: how every engine of Kairotic weighs its decisions.
//
// The hard rules (a kernel's check) decide what may be; these soft rules decide what is likely. A candidate costs
// something by the shape of its own line (melodicParts) and by the vertical it makes with another voice
// (verticalParts), each rule by its id and weight; an engine chooses among the candidates with a future by a softmax
// of −cost / temperature (choose, pick), colder where few futures are left (temperature). The comes box
// (counterpoint.mjs), the studies' engines (Studies 38–53) and the agents Claude builds weigh with this one module,
// so the same weights mean the same music everywhere, and changing a weight changes it for all of them.
//
// A pitch is a step of a scale (a degree, or a step of a system of N steps), as the kernels count them; a line is one
// pitch a unit, a note held being the same pitch again.

/** The soft rules, as Study 42 lists them (the melodic contour after Bach, #181; the vertical ones). */
export const SOFT = [
  { id: "leap-size", scope: "melodic", weight: 1, doc: "Leaps cost little, only by their size (a 3rd 0.2, a 4th 0.4, a 5th 0.5, a 6th or an octave 0.8)." },
  { id: "tie", scope: "melodic", weight: 1.5, doc: "A note held over the beat (a tie): the same pitch again is held, not struck again." },
  { id: "contrary-after-leap", scope: "melodic", weight: 1.2, doc: "After a leap, going on the same way (twice as much leaping again): a leap is compensated by contrary motion." },
  { id: "step-back", scope: "melodic", weight: 1.2, doc: "After a 4th or more, turning back by leap rather than by step (filling the gap)." },
  { id: "leap-after-leap", scope: "melodic", weight: 0.6, doc: "Two leaps in a row." },
  { id: "return", scope: "melodic", weight: 1, doc: "Going straight back to the note before (A B A)." },
  { id: "hover", scope: "melodic", weight: 0.6, doc: "A note heard among the last ones, each time: the line moves on." },
  { id: "run", scope: "melodic", weight: 1.5, doc: "More than four moves the same way." },
  { id: "open", scope: "melodic", weight: 1, doc: "Still inside less than a 5th after six notes: the line opens up." },
  { id: "climax", scope: "melodic", weight: 1.5, doc: "Reaching the highest note again (one climax)." },
  { id: "sequence", scope: "melodic", weight: 1.5, doc: "The last two moves again (two thirds of it for the last three): a mechanical sequence." },
  { id: "memory", scope: "memory", weight: 1, doc: "Memory of the work: a figure of two moves it used earlier (not just before) costs less." },
  { id: "novelty", scope: "memory", weight: 0.3, doc: "Novelty: the same move as the last one costs a little more." },
  { id: "motion", scope: "vertical", weight: 2.5, doc: "Contrary motion preferred: oblique costs half, similar 0.8 of the weight." },
  { id: "direct-perfect", scope: "vertical", weight: 3, doc: "Similar motion into a 5th (into an octave or a unison it is not allowed)." },
  { id: "imperfect-run", scope: "vertical", weight: 2, doc: "More than three parallel 3rds or 6ths in a row." },
  { id: "passing", scope: "vertical", weight: 1, doc: "A dissonance passing on a weak beat: the life of second species (it costs less)." },
  { id: "suspension-life", scope: "vertical", weight: 1.5, doc: "A suspension: the life of fourth species (it costs less)." },
  { id: "alternation", scope: "vertical", weight: 1.5, doc: "The same vertical as two notes before but not as the last (3 6 3 6 …)." },
  { id: "modal", scope: "mode", weight: 1, doc: "The mode's final and tenor cost less (more on a strong beat): the dux of the comes box keeps to its mode." },
  { id: "imitation", scope: "imitation", weight: 1, doc: "How far the comes strays from imitating the dux, by the degree of imitation asked (the comes box)." },
];
export const defaultWeights = () => Object.fromEntries(SOFT.map((r) => [r.id, r.weight]));

const LEAP_COST = { 0: 0, 1: 0, 2: 0.2, 3: 0.4, 4: 0.5, 5: 0.8, 7: 0.8 };
const sign = (x) => (x > 0) - (x < 0);
const dedupe = (line) => line.filter((x, i) => i === 0 || x !== line[i - 1]);
const lastMove = (l) => (l.length >= 2 ? l[l.length - 1] - l[l.length - 2] : null);
/** A candidate's whole cost: the sum of its parts. */
export const total = (parts) => Object.values(parts).reduce((a, b) => a + b, 0);

/** The soft cost of x after a line, by rule (the line's own shape), as canon.cljs's melodic-parts. */
export function melodicParts(line, x, W = defaultWeights()) {
  const parts = {}, w = (id) => W[id] ?? 0;
  const prev = line.length ? line[line.length - 1] : null;
  if (prev === null || prev === undefined) return parts;
  if (x === prev) { parts.tie = w("tie"); return clean(parts); }
  // the rest on the notes struck: a note held is one note
  const L = dedupe(line), m = lastMove(L), s = x - prev, n = Math.abs(s), all = [...L, x], tl = L.length;
  const mv = []; for (let i = 1; i < L.length; i++) mv.push(L[i] - L[i - 1]); mv.push(s);
  const M = mv.length;
  if (n > 0) parts["leap-size"] = w("leap-size") * (LEAP_COST[n] ?? 1.5);
  if (tl >= 2 && n > 0 && x === L[tl - 2]) parts.return = w("return");
  const k = L.slice(0, -1).slice(-3).filter((y) => y === x).length;
  if (k > 0) parts.hover = k * w("hover");
  if (m !== null && Math.abs(m) >= 2 && n > 0 && sign(m) === sign(s)) parts["contrary-after-leap"] = w("contrary-after-leap") * (n >= 2 ? 2 : 1);
  if (m !== null && Math.abs(m) >= 3 && n > 1) parts["step-back"] = w("step-back");
  if (m !== null && Math.abs(m) >= 2 && n >= 2) parts["leap-after-leap"] = w("leap-after-leap");
  if (n > 0) { let run = 0; for (let i = M - 1; i >= 0 && mv[i] !== 0 && sign(mv[i]) === sign(s); i--) run++; if (run > 4) parts.run = w("run"); }
  if (tl >= 5 && Math.max(...all) - Math.min(...all) < 4) parts.open = w("open");
  if (tl > 1 && s > 0 && x === Math.max(...L)) parts.climax = w("climax");
  const eq = (a, b) => a.length === b.length && a.every((v, i) => v === b[i]);
  if (M >= 4 && mv[M - 1] === mv[M - 3] && mv[M - 2] === mv[M - 4] && mv[M - 1] !== mv[M - 2]) parts.sequence = w("sequence");
  else if (M >= 6 && eq(mv.slice(M - 3), mv.slice(M - 6, M - 3))) parts.sequence = (2 / 3) * w("sequence");
  else if (m !== null && n > 0) { for (let i = 0; i < M - 3; i++) if (mv[i] === m && mv[i + 1] === s) { parts.memory = -w("memory"); break; } }
  if (m !== null && m === s && n > 0) parts.novelty = w("novelty");
  return clean(parts);
}

/**
 * The soft cost of the vertical (x, c) at the next time, as canon.cljs's vertical-parts. D and C are the two lines
 * so far (pitches a unit, null before a voice enters). ctx: {quality(lo, hi), N (steps a period), lowerFirst(x, c),
 * strong(t), dissonant(x, c), suspension (whether the vertical at t is a suspension), fifth (optional: the class of the
 * system's fifth, for a system whose perfect intervals are more than the octave and the fifth)}.
 */
export function verticalParts(D, C, x, c, ctx, W = defaultWeights()) {
  const parts = {}, w = (id) => W[id] ?? 0, t = D.length, N = ctx.N;
  const prev = t ? D[t - 1] : null, pc = t ? C[t - 1] : null;
  const mod = (a) => ((a % N) + N) % N;
  if (c === null || c === undefined || pc === null || pc === undefined || prev === null || prev === undefined) return parts;
  const dx = x - prev, dc = c - pc, [lo, hi] = ctx.lowerFirst(x, c);
  const motion = dx === 0 && dc === 0 ? "none" : dx === 0 || dc === 0 ? "oblique" : sign(dx) === sign(dc) ? "similar" : "contrary";
  if (motion === "oblique") parts.motion = 0.5 * w("motion");
  if (motion === "similar") parts.motion = 0.8 * w("motion");
  if (motion === "similar" && ctx.quality(lo, hi) === "perfect" && mod(hi - lo) !== 0 && (ctx.fifth === undefined || mod(hi - lo) === ctx.fifth)) parts["direct-perfect"] = w("direct-perfect");
  if (motion === "similar" && ctx.quality(lo, hi) === "imperfect") {
    const cls = mod(hi - lo);
    let run = 1;
    for (let i = t - 1; i >= 1; i--) {
      const a = D[i], b = C[i], a0 = D[i - 1], b0 = C[i - 1];
      if ([a, b, a0, b0].some((v) => v === null || v === undefined)) break;
      const [l, h] = ctx.lowerFirst(a, b);
      if (ctx.quality(l, h) === "imperfect" && mod(h - l) === cls && sign(a - a0) === sign(b - b0) && a !== a0) run++; else break;
    }
    if (run > 3) parts["imperfect-run"] = w("imperfect-run");
  }
  if (!ctx.strong(t) && ctx.dissonant(x, c)) parts.passing = -w("passing");
  if (ctx.suspension) parts["suspension-life"] = -w("suspension-life");
  if (t >= 2) {
    const cl = (a, b) => (a === null || a === undefined || b === null || b === undefined ? null : mod(Math.abs(a - b)));
    const iv = cl(x, c), i1 = cl(D[t - 1], C[t - 1]), i2 = cl(D[t - 2], C[t - 2]);
    if (i1 !== null && i2 !== null && iv === i2 && iv !== i1) parts.alternation = w("alternation");
  }
  return clean(parts);
}

function clean(parts) { for (const k of Object.keys(parts)) if (parts[k] === 0) delete parts[k]; return parts; }

/** The temperature, colder where few futures are left when it follows the divergence (as canon.cljs). */
export function temperature(temp, follow, futures) {
  const f = typeof futures === "bigint" ? Number(futures) : futures;
  const bits = f > 0 ? Math.log2(f) : -1;
  return follow ? temp * Math.min(1, Math.max(0, bits) / 8) : temp;
}

/** The engine's choice among candidates {futures, cost}: a softmax of −cost / temperature (r in [0, 1)); at
 *  temperature 0 the cheapest. Only candidates with a future are chosen. */
export function choose(cands, temp, r = Math.random) {
  const ok = cands.filter((c) => c.futures > 0);
  if (!ok.length) return null;
  if (temp <= 0.001) return ok.slice().sort((a, b) => a.cost - b.cost || a.note - b.note)[0];
  const m = Math.min(...ok.map((c) => c.cost)), ws = ok.map((c) => Math.exp((m - c.cost) / temp));
  let x = r() * ws.reduce((a, b) => a + b, 0);
  for (let j = 0; j < ok.length; j++) { x -= ws[j]; if (x < 0) return ok[j]; }
  return ok[ok.length - 1];
}

/** A choice among candidates by a cost function (the comes box's): at temperature 0, or without a random number r in
 *  [0, 1), the cheapest; above it a softmax of −cost / temperature drawn with r. Unlike choose, it does not ask for
 *  futures (the candidates are already those with one). */
export function pick(cands, cost, temp, r) {
  const cs = cands.slice().sort((p, q) => cost(p) - cost(q) || (p.note ?? -100) - (q.note ?? -100));
  if (!cs.length || !(temp > 0.001) || r === undefined || r === null) return cs[0] || null;
  const m = cost(cs[0]), ws = cs.map((c) => Math.exp((m - cost(c)) / temp)), x = r * ws.reduce((a, v) => a + v, 0);
  let acc = 0;
  for (let j = 0; j < cs.length; j++) { acc += ws[j]; if (x < acc) return cs[j]; }
  return cs[cs.length - 1];
}

/** How a line moves, for the pages and the tests: the share of steps, 3rds and larger leaps among its moves. */
export function shape(lines) {
  let st = 0, th = 0, lp = 0, tot = 0;
  for (const l of lines) { const L = dedupe(l); for (let i = 1; i < L.length; i++) { const n = Math.abs(L[i] - L[i - 1]); tot++; if (n === 1) st++; else if (n === 2) th++; else lp++; } }
  return tot ? { steps: st / tot, thirds: th / tot, leaps: lp / tot, moves: tot } : { steps: 0, thirds: 0, leaps: 0, moves: 0 };
}
