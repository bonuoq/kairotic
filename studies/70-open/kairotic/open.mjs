// SPDX-License-Identifier: MPL-2.0
// Study 70 · open form (discussion #212): a work of fragments and rules of succession, the performer choosing the
// path — Stockhausen's Klavierstück XI, Earle Brown, Pousseur. Every performance is a path, and the paths a work
// has been played along are a tree of branches: the score accumulates its versions.
//
//   the work      {name, start, end, frags: [{id, notes [[onset dur midi] …] (16ths), next, not, near, then, final}]}
//                 start: "any" or [ids]; end: {repeat n} (a fragment come a n-th time ends it, as in Klavierstück XI),
//                 {after n} (n fragments), or a fragment's final: true
//                 next: "any" or [ids]; not: [ids]; near: n (the next at most n swaps away, its rhythm as a necklace
//                 of 16 pulses — discussion #212, from @kairotic/rhythm); then: {tempo, dyn, touch} how the next
//                 fragment is played (the indications at the end of each group of Klavierstück XI)
//   choices       which fragments can come next, given the path so far: the futuribles of the form
//   realize       a path → the notes it plays, each fragment with the indications the one before left it
//   recognize     which of the fragments that can come next the performer is playing, from the pitches heard
//                 (an alignment of their openings, wrong and missed notes allowed): the follower decides the form
//   branches      the performances as a tree of their paths (a common beginning is one branch)
//   in a tree     toEdn: the work as kairotic.mt EDN, [:open {…} [:frag {…} …notes…] …]
//
// Pure data and functions.

export const DYNS = ["ppp", "pp", "p", "mp", "mf", "f", "ff", "fff"];
const VEL = { ppp: 0.12, pp: 0.2, p: 0.32, mp: 0.45, mf: 0.58, f: 0.72, ff: 0.86, fff: 1 };

// ─── rhythm as geometry: a fragment's onsets on a cycle of 16 pulses ───

/** The onsets of a fragment as pulses of a 16-pulse bar (distinct, sorted). */
export const pulsesOf = (frag, n = 16) => [...new Set(frag.notes.map((x) => ((Math.round(x[0]) % n) + n) % n))].sort((a, b) => a - b);

/** The swap distance between two rhythms of as many onsets (moving onsets to neighbouring pulses, one swap a step;
 *  the least over the rotations of the second, a necklace); null when their onsets are not as many. */
export function swapDistance(a, b, n = 16) {
  if (a.length !== b.length) return null;
  let best = Infinity;
  for (let r = 0; r < n; r++) {
    const rb = b.map((x) => (x + r) % n).sort((x, y) => x - y);
    best = Math.min(best, a.reduce((s, x, i) => s + Math.abs(x - rb[i]), 0));
  }
  return best;
}

/** A distance between two fragments' rhythms: their swap distance, or (not as many onsets) the pulses where one
 *  strikes and the other not, the least over rotations. */
export function rhythmDistance(fa, fb, n = 16) {
  const a = pulsesOf(fa, n), b = pulsesOf(fb, n), s = swapDistance(a, b, n);
  if (s !== null) return s;
  let best = Infinity;
  for (let r = 0; r < n; r++) {
    const B = new Set(b.map((x) => (x + r) % n));
    best = Math.min(best, a.filter((x) => !B.has(x)).length + [...B].filter((x) => !a.includes(x)).length);
  }
  return best;
}

// ─── the form ───

export const fragOf = (work, id) => work.frags.find((f) => f.id === id);
const counts = (path) => path.reduce((m, id) => m.set(id, (m.get(id) || 0) + 1), new Map());

/** Has the performance ended? */
export function done(work, path) {
  if (!path.length) return false;
  const e = work.end || {};
  if (e.repeat && Math.max(...counts(path).values()) >= e.repeat) return true;
  if (e.after && path.length >= e.after) return true;
  return !!fragOf(work, path[path.length - 1]).final;
}

/** The fragments that can come next (ids, in the work's order); [] when the performance has ended. */
export function choices(work, path) {
  if (done(work, path)) return [];
  const ids = work.frags.map((f) => f.id);
  if (!path.length) return !work.start || work.start === "any" ? ids : ids.filter((id) => work.start.includes(id));
  const last = fragOf(work, path[path.length - 1]);
  let out = !last.next || last.next === "any" ? ids : ids.filter((id) => last.next.includes(id));
  if (last.not) out = out.filter((id) => !last.not.includes(id));
  if (last.near !== undefined) out = out.filter((id) => rhythmDistance(last, fragOf(work, id)) <= last.near);
  return out;
}

/** Is a path one the work allows (each step a choice, and ended only at its end)? */
export function legal(work, path) {
  for (let i = 0; i < path.length; i++) if (!choices(work, path.slice(0, i)).includes(path[i])) return false;
  return true;
}

/** A performance drawn at random (r: a random number in [0, 1)), at most max fragments. */
export function draw(work, r = Math.random, max = 64) {
  const path = [];
  while (path.length < max) {
    const cs = choices(work, path);
    if (!cs.length) break;
    path.push(cs[Math.floor(r() * cs.length)]);
  }
  return path;
}

/** How many performances of at most max fragments the work allows that have ended (the futuribles of its form,
 *  counted by the state that matters: the last fragment and how often each came). */
export function countPerformances(work, max = 12) {
  const memo = new Map();
  const go = (path, left) => {
    if (done(work, path)) return 1;
    if (!left) return 0;
    const key = (path[path.length - 1] || "") + "|" + [...counts(path).entries()].sort().join(";") + "|" + left;
    if (memo.has(key)) return memo.get(key);
    let n = 0;
    for (const id of choices(work, path)) n += go([...path, id], left - 1);
    memo.set(key, n);
    return n;
  };
  return go([], max);
}

// ─── playing a path ───

/**
 * The notes a path plays: [{on, dur (seconds), midi, vel, frag, i (its place in the path), touch}], and its
 * segments [{frag, i, on, end, tempo, dyn, touch}]. Each fragment is played with the indications the one before
 * left (then: tempo a factor of the base tempo, dyn, touch "staccato" | "legato"); the first one with the work's.
 */
export function realize(work, path, { bpm = 72 } = {}) {
  const notes = [], segments = [];
  let t = 0, ind = { tempo: 1, dyn: "mf", touch: "normal", ...(work.first || {}) };
  path.forEach((id, i) => {
    const f = fragOf(work, id);
    const s16 = 60 / (bpm * (ind.tempo || 1)) / 4;
    const len = Math.max(...f.notes.map((x) => x[0] + x[1]));
    for (const [on, d, p] of f.notes) {
      const dur = d * s16 * (ind.touch === "staccato" ? 0.4 : ind.touch === "legato" ? 1.05 : 0.9);
      notes.push({ on: t + on * s16, dur, midi: p, vel: VEL[ind.dyn] ?? 0.58, frag: id, i, touch: ind.touch });
    }
    segments.push({ frag: id, i, on: t, end: t + len * s16, tempo: ind.tempo, dyn: ind.dyn, touch: ind.touch });
    t += len * s16;
    ind = { ...ind, ...(f.then || {}) };
  });
  return { notes, segments, end: t };
}

// ─── following: which fragment is being played ───

// (an alignment of the pitches heard with a fragment's opening: a wrong note costs by how far it is, a note missed
// or added 1; the cost of the best alignment of everything heard with some opening of the fragment)
const sub = (a, b) => { const d = Math.abs(a - b); return d === 0 ? 0 : d % 12 === 0 ? 0.6 : Math.min(1.2, 0.5 + d / 12); };

/** How many of the notes heard a fragment's notes took (an alignment of all of them with a beginning of what is
 *  heard, the cheapest; on a tie, the nearest to as many as it has). */
export function consumed(heard, ref) {
  const n = heard.length, m = ref.length;
  // D[i][j]: heard[0..i) against ref[0..j)
  let col = Array.from({ length: n + 1 }, (_, i) => i);   // j = 0
  for (let j = 1; j <= m; j++) {
    const nx = [j];
    for (let i = 1; i <= n; i++) nx[i] = Math.min(col[i - 1] + sub(heard[i - 1], ref[j - 1]), col[i] + 1, nx[i - 1] + 1);
    col = nx;
  }
  let best = 0;
  for (let i = 0; i <= n; i++) if (col[i] < col[best] - 1e-9 || (Math.abs(col[i] - col[best]) < 1e-9 && Math.abs(i - m) < Math.abs(best - m))) best = i;
  return best;
}

// (heard beyond a fragment's end is the next fragment's, which is not known yet: each such note costs `beyond`, about
// what a note of the right fragment costs with a little noise — so a short fragment and a long one are judged on the
// same notes)
function align(heard, ref, beyond = 0.4) {
  const n = heard.length, m = ref.length;
  let prev = Array.from({ length: m + 1 }, (_, j) => j), atEnd = prev[m] + beyond * n;
  for (let i = 1; i <= n; i++) {
    const cur = [i];
    for (let j = 1; j <= m; j++) cur[j] = Math.min(prev[j - 1] + sub(heard[i - 1], ref[j - 1]), prev[j] + 1, cur[j - 1] + 1);
    prev = cur;
    atEnd = Math.min(atEnd, cur[m] + beyond * (n - i));
  }
  return Math.min(atEnd, ...prev.slice(0, m));
}

/**
 * Which of the fragments that can come next is being played, from the pitches heard since the last one ended
 * (in order, MIDI): [{id, cost, p}] best first — p a probability (softmax of the costs at temperature temp).
 * Every candidate is a hypothesis; the more is heard, the surer.
 */
export function recognize(work, path, heard, { temp = 0.35 } = {}) {
  const cs = choices(work, path);
  if (!cs.length || !heard.length) return cs.map((id) => ({ id, cost: 0, p: 1 / Math.max(1, cs.length) }));
  const scored = cs.map((id) => {
    const ps = fragOf(work, id).notes.slice().sort((a, b) => a[0] - b[0] || a[2] - b[2]).map((x) => x[2]);
    return { id, cost: align(heard, ps) };
  });
  const lo = Math.min(...scored.map((x) => x.cost));
  const w = scored.map((x) => Math.exp(-(x.cost - lo) / temp));
  const z = w.reduce((a, b) => a + b, 0);
  return scored.map((x, i) => ({ ...x, p: w[i] / z })).sort((a, b) => a.cost - b.cost);
}

/**
 * A performance followed: the notes heard ([{midi}], in order, each knowing nothing of its fragment) read as a path,
 * fragment by fragment — for each, the candidates' openings against what is heard until one is sure (p ≥ sure) or
 * as many notes as its fragment has are heard; then the path moves on. → {path, decisions [{i, id, after (notes
 * heard), p}]}.
 */
export function follow(work, heard, { sure = 0.9 } = {}) {
  const path = [], decisions = [];
  let k = 0;
  while (k < heard.length && !done(work, path)) {
    const cs = choices(work, path);
    if (!cs.length) break;
    // (heard note by note until a candidate is sure; at most as many notes as the longest has, then the best)
    const most = Math.max(...cs.map((id) => fragOf(work, id).notes.length)) + 1;
    let got = null, n = 1;
    for (; n <= most && k + n <= heard.length; n++) {
      const r = recognize(work, path, heard.slice(k, k + n).map((x) => x.midi));
      if (r[0].p >= sure || cs.length === 1) { got = r[0]; break; }
    }
    if (!got) { n = Math.min(most, heard.length - k); got = recognize(work, path, heard.slice(k, k + n).map((x) => x.midi))[0]; }
    const ps = fragOf(work, got.id).notes.slice().sort((a, b) => a[0] - b[0] || a[2] - b[2]).map((x) => x[2]);
    decisions.push({ i: path.length, id: got.id, after: n, p: got.p });
    path.push(got.id);
    // (where it ended: its notes aligned with what was heard — a note missed or added does not shift the next)
    k += Math.max(1, consumed(heard.slice(k, k + 2 * ps.length + 2).map((x) => x.midi), ps));
  }
  return { path, decisions };
}

/** The costs of a fragment's notes aligned with every beginning of what is heard: [cost for i notes heard]. */
function endCosts(heard, ref) {
  let col = Array.from({ length: heard.length + 1 }, (_, i) => i);
  for (let j = 1; j <= ref.length; j++) {
    const nx = [j];
    for (let i = 1; i <= heard.length; i++) nx[i] = Math.min(col[i - 1] + sub(heard[i - 1], ref[j - 1]), col[i] + 1, nx[i - 1] + 1);
    col = nx;
  }
  return col;
}

/**
 * A whole performance read again once it is over (the notes heard, [{midi}]): the path the work allows whose
 * fragments, one after another, best account for every note — a beam of the `beam` best readings so far, each
 * fragment trying its likeliest ends. What following decided note by note, with only the beginning of each fragment
 * heard, is corrected with all of it. → {path, cost}.
 */
export function decode(work, heard, { beam = 16, ends = 3 } = {}) {
  const H = heard.map((x) => x.midi), N = H.length;
  // (the readings by how much they have heard: those that have heard as much compared by their cost — a beam at each
  // point of the performance, taken in order)
  const at = Array.from({ length: N + 1 }, () => []);
  at[0].push({ path: [], cost: 0 });
  let best = null;
  for (let k = 0; k <= N; k++) {
    const here = at[k].sort((a, b) => a.cost - b.cost).slice(0, beam);
    for (const h of here) {
      const c = h.cost + (N - k) + (done(work, h.path) ? 0 : 1.5);
      if (!best || c < best.cost) best = { path: h.path, cost: c };
      if (k === N) continue;
      for (const id of choices(work, h.path)) {
        const ps = fragOf(work, id).notes.slice().sort((a, b) => a[0] - b[0] || a[2] - b[2]).map((x) => x[2]);
        const cs = endCosts(H.slice(k, k + 2 * ps.length + 2), ps);
        const top = cs.map((c, i) => [c, i]).filter(([, i]) => i > 0).sort((a, b) => a[0] - b[0] || Math.abs(a[1] - ps.length) - Math.abs(b[1] - ps.length)).slice(0, ends);
        for (const [c, i] of top) at[k + i].push({ path: [...h.path, id], cost: h.cost + c });
      }
    }
    at[k] = null;
  }
  return best;
}

// ─── the performances as branches ───

/** The performances (paths) as a tree of branches: {id, n (how many passed), children}; a common beginning one branch. */
export function branches(paths) {
  const root = { id: null, n: paths.length, children: [] };
  for (const p of paths) {
    let node = root;
    for (const id of p) {
      let c = node.children.find((x) => x.id === id);
      if (!c) { c = { id, n: 0, children: [] }; node.children.push(c); }
      c.n++;
      node = c;
    }
  }
  return root;
}

/** The distance between two performances: the fragments to change, add or leave out to make one the other. */
export function pathDistance(a, b) {
  let prev = Array.from({ length: b.length + 1 }, (_, j) => j);
  for (let i = 1; i <= a.length; i++) {
    const cur = [i];
    for (let j = 1; j <= b.length; j++) cur[j] = Math.min(prev[j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1), prev[j] + 1, cur[j - 1] + 1);
    prev = cur;
  }
  return prev[b.length];
}

/** How far each step of a performance travelled: the rhythmic distance from a fragment to the next. */
export const curve = (work, path) => path.slice(1).map((id, i) => rhythmDistance(fragOf(work, path[i]), fragOf(work, id)));

// ─── in a tree (kairotic.mt) ───

const NAMES = ["c", "c#", "d", "eb", "e", "f", "f#", "g", "ab", "a", "bb", "b"];
const nameOf = (p) => NAMES[((p % 12) + 12) % 12] + (Math.floor(p / 12) - 1);
const num = (x) => String(Math.round(x * 10000) / 10000);
const kw = (x) => ":" + x;
const ednVal = (v) => Array.isArray(v) ? "#{" + v.map(kw).join(" ") + "}" : typeof v === "string" ? (v === "any" ? ":any" : JSON.stringify(v)) : String(v);
const ednMap = (o) => "{" + Object.entries(o).map(([k, v]) => `:${k} ${v && typeof v === "object" && !Array.isArray(v) ? ednMap(v) : ednVal(v)}`).join(" ") + "}";

/** The work as kairotic.mt EDN: [:open {:name … :start … :end {…}} [:frag {:id :A :next … :then {…}} …notes…] …]. */
export function toEdn(work) {
  const head = { name: work.name, start: work.start || "any", ...(work.end ? { end: work.end } : {}) };
  const frags = work.frags.map((f) => {
    const a = { id: null, ...(f.next ? { next: f.next } : {}), ...(f.not ? { not: f.not } : {}), ...(f.near !== undefined ? { near: f.near } : {}), ...(f.then ? { then: f.then } : {}), ...(f.final ? { final: true } : {}) };
    const attrs = ednMap(a).replace(":id null", ":id " + kw(f.id));
    const notes = f.notes.slice().sort((x, y) => x[0] - y[0] || x[2] - y[2]).map(([on, d, p]) => `[:note {:pitch "${nameOf(p)}" :dur ${num(d / 4)} :at ${num(on / 4)}}]`);
    return `[:frag ${attrs}\n   ${notes.join(" ")}]`;
  });
  return `[:open ${ednMap(head)}\n ${frags.join("\n ")}]`;
}
