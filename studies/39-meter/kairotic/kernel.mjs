// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 39 · meter: the kernel of the canon, in plain JavaScript.
//
// The hard rules and the exact count of the futures. In Study 38 they were ClojureScript run by Scittle, which
// interprets: with a meter the canon has twice the notes and the count looks further back (a 5th on the strong
// beat before, a dissonance left by step), and counting took seconds. Here the same rules count in milliseconds;
// the rule set stays data (which rules are on, the canon's parameters), and the soft rules, the history and the
// page stay in ClojureScript (kairotic/canon.cljs).
//
//   pitch   a diatonic step on the white keys, 0 = C4
//   spec    {tonic, k, d, b, n, lo, hi, spacing, invert: [8, 12], on: {"leap-recovery": false, …}}
//           k: the comes is k steps from the dux · d: it enters d beats later · b: beats in a bar (1 = first
//           species, 2 = 2/2, 3 = 3/2) · n: notes of the dux (a note per beat; its last bar holds the final)
//   dux     an array of pitches, the notes chosen so far
//
// A beat is strong when it starts a bar (t % b === 0). On a strong beat every vertical is a consonance; on a weak
// one a dissonance may pass, if both voices come to it by step and leave it by step (a passing note, going on the
// same way, or a neighbour, turning back), and never two in a row. A delay of an odd number of beats puts the
// comes on the other beats: what is strong in the dux is weak in the comes, and the rules hold in both voices.

const SCALE = [0, 2, 4, 5, 7, 9, 11];
export const MODES = { ionian: 0, dorian: 1, mixolydian: 4, aeolian: 5 };

const mod = (a, m) => ((a % m) + m) % m;
const sign = (x) => (x > 0) - (x < 0);
export const octaveOf = (s) => Math.floor(s / 7);
export const semis = (s) => 12 * octaveOf(s) + SCALE[mod(s, 7)];

const NAMES = ["unison", "2nd", "3rd", "4th", "5th", "6th", "7th", "octave"];
export function intervalName(s) {
  if (s <= 7) return NAMES[s];
  const n = s + 1, last = n % 10;
  return n + (n >= 11 && n <= 13 ? "th" : last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th");
}

/** "perfect" (unison, octave, 5th), "imperfect" (3rd, 6th) or "dissonant", on the real semitones. */
export function quality(a, b) {
  const c = Math.abs(b - a) % 7, st = Math.abs(semis(b) - semis(a)) % 12;
  if (c === 0) return "perfect";
  if (c === 4) return st === 7 ? "perfect" : "dissonant";
  if (c === 2 || c === 5) return "imperfect";
  return "dissonant";
}

/** Why a → b is not a melodic interval of strict counterpoint, or null. */
export function melodicError(a, b) {
  const s = b - a, n = Math.abs(s), st = Math.abs(semis(b) - semis(a));
  if (n <= 2) return null;
  if (n === 3) return st === 5 ? null : "an augmented 4th (tritone)";
  if (n === 4) return st === 7 ? null : "a diminished 5th (tritone)";
  if (n === 5) return s > 0 && st === 8 ? null : "a 6th (only the minor 6th up)";
  if (n === 7) return null;
  if (n === 6) return "a 7th";
  return "a leap wider than the octave";
}

/** The hard rules, with their defaults (strict-direct is off unless asked for). */
export const HARD = ["range", "start", "melodic", "leap-recovery", "consonance", "weak-dissonance", "parallels",
  "strong-parallels", "direct-octaves", "strict-direct", "entry-unison", "no-crossing", "spacing", "final", "approach"];
const OFF_BY_DEFAULT = new Set(["strict-direct"]);

/** A canon: its hard rules and its counter, for one spec. */
export function canon(spec) {
  const { tonic, k, d, b = 1, n, lo, hi, spacing = 11 } = spec;
  const invert = [...(spec.invert || [])].sort((x, y) => x - y);
  const on = (id) => (spec.on && id in spec.on ? !!spec.on[id] : !OFF_BY_DEFAULT.has(id));
  const finals = [];
  for (let i = -2; i <= 2; i++) { const f = tonic + 7 * i; if (f >= lo && f <= hi) finals.push(f); }
  const isFinal = (x) => finals.includes(x);
  const strong = (t) => t % b === 0;
  const comesAt = (dux, t) => { const i = t - d; return i >= 0 && i < dux.length ? dux[i] + k : null; };
  // a vertical as [lower, upper] by voice (the comes is the lower one unless shifted up)
  const lowerFirst = (x, c) => (k > 0 ? [x, c] : [c, x]);
  const transforms = [[null, (lo2, hi2) => [lo2, hi2]],
    ...invert.map((N) => [N, (lo2, hi2) => [hi2, lo2 + N - 1]])];
  const label = (N) => (N ? `under inversion at the ${intervalName(N - 1)}: ` : "");

  /** Is the vertical [x c] dissonant, as it is or under an inversion asked for? */
  function dissonant(x, c) {
    const [l0, h0] = lowerFirst(x, c);
    for (const [, f] of transforms) { const [l, h] = f(l0, h0); if (h >= l && quality(l, h) === "dissonant") return true; }
    return false;
  }

  /** Why x cannot come next after the dux, or null. The dux array is not changed. */
  function check(dux, x) {
    const t = dux.length;
    if (t >= n) return "the dux is finished";
    if (on("range") && (x < lo || x > hi)) return "out of range";
    if (on("start") && t === 0 && x !== tonic && x !== tonic + 4 && x !== tonic + 7)
      return "the dux starts on the final, its 5th or its octave";
    const prev = t > 0 ? dux[t - 1] : null;
    if (on("melodic") && prev !== null) {
      const e = melodicError(prev, x); if (e) return e;
      const e2 = melodicError(prev + k, x + k); if (e2) return "in the comes: " + e2;
    }
    if (on("leap-recovery") && t >= 2) {
      const m = dux[t - 1] - dux[t - 2], s = x - prev;
      if (Math.abs(m) >= 5 && s !== -sign(m)) return `after a leap of a ${intervalName(Math.abs(m))}, a step ${m > 0 ? "down" : "up"}`;
      if (Math.abs(m) >= 3 && Math.abs(m) <= 4 && sign(s) !== -sign(m))
        return `after the leap of a ${intervalName(Math.abs(m))} the line turns ${m > 0 ? "down" : "up"}`;
    }
    if (on("final") && t === n - 1 && !isFinal(x)) return "the dux ends on the final";
    if (on("approach") && t === n - 2 && !finals.some((f) => Math.abs(x - f) === 1)) return "the final is approached by step";
    const i = t - d, c = i >= 0 ? (i < t ? dux[i] : x) + k : null;      // the comes now (d ≥ 1: an earlier note)
    // a dissonance just before is left by step, in both voices
    if (on("weak-dissonance") && t >= 1) {
      const pc = comesAt(dux, t - 1);
      if (pc !== null && dissonant(prev, pc)) {
        if (Math.abs(x - prev) !== 1) return "the dissonance before is left by step (the dux)";
        if (c !== null && Math.abs(c - pc) !== 1) return "the dissonance before is left by step (the comes)";
      }
    }
    if (c === null) return null;
    const pc = t >= 1 ? comesAt(dux, t - 1) : null;
    if (on("no-crossing") && k !== 0) { const [l, h] = lowerFirst(x, c); if (l > h) return "the voices cross"; }
    if (on("spacing") && Math.abs(x - c) > spacing) return `more than a ${intervalName(spacing)} apart`;
    const [l0, h0] = lowerFirst(x, c);
    const [pl0, ph0] = pc !== null ? lowerFirst(prev, pc) : [0, 0];
    const sb = b > 1 && strong(t) && t - b >= 0 ? comesAt(dux, t - b) : null;      // the strong beat before
    const [sl0, sh0] = sb !== null ? lowerFirst(dux[t - b], sb) : [0, 0];
    let diss = false;
    for (const [N, f] of transforms) {
      const [l, h] = f(l0, h0);
      if (N && h < l) return `${label(N)}the voices would cross (wider than the ${intervalName(N - 1)})`;
      const q = quality(l, h), cls = mod(h - l, 7);
      if (q === "dissonant") {
        diss = true;
        if (on("consonance") && (b === 1 || strong(t)))
          return `${label(N)}a ${intervalName(cls)} (dissonant)${b > 1 ? " on a strong beat" : ""}`;
      }
      if (pc !== null) {
        const [pl, ph] = f(pl0, ph0);
        if (on("parallels") && q === "perfect" && quality(pl, ph) === "perfect" && mod(ph - pl, 7) === cls && (pl !== l || ph !== h))
          return label(N) + (cls === 0 ? "parallel octaves" : "parallel 5ths");
        const dl = l - pl, dh = h - ph;
        if (on("direct-octaves") && cls === 0 && dl !== 0 && sign(dl) === sign(dh) && (on("strict-direct") || Math.abs(dh) !== 1))
          return `${label(N)}${l === h ? "a unison" : intervalName(h - l)} by direct motion`;
      }
      if (sb !== null && on("strong-parallels") && q === "perfect") {
        const [sl, sh] = f(sl0, sh0);
        if (quality(sl, sh) === "perfect" && mod(sh - sl, 7) === cls && (sl !== l || sh !== h))
          return label(N) + (cls === 0 ? "octaves" : "5ths") + " on consecutive strong beats";
      }
    }
    if (diss && b > 1 && on("weak-dissonance")) {
      if (Math.abs(x - prev) !== 1) return "a dissonance on a weak beat: the dux comes to it by step";
      if (pc === null) return "the comes cannot enter on a dissonance";
      if (Math.abs(c - pc) !== 1) return "a dissonance on a weak beat: the comes comes to it by step";
      if (dissonant(prev, pc)) return "two dissonances in a row";
      if (t === n - 1) return "the canon does not end on a dissonance";
    }
    if (on("entry-unison") && t === d && x === c) return "the comes does not enter on the unison";
    if (on("final") && t === n - 1 && quality(x, c) !== "perfect") return "the last vertical is a perfect consonance";
    return null;
  }

  // ─── the count: exact, memoized on what the hard rules look back at ───
  const L = Math.max(2, d + 1, b + d);          // dux[t-1], dux[t-2], dux[t-d], dux[t-1-d], dux[t-b], dux[t-b-d]
  const memo = new Map();
  const work = [];
  function key(t) {
    let code = 0;
    for (let j = Math.max(0, t - L); j < t; j++) code = code * 32 + (work[j] - lo + 1);
    return code * 64 + t;
  }
  function countWork() {
    const t = work.length;
    if (t >= n) return 1;
    const kk = key(t);
    const got = memo.get(kk);
    if (got !== undefined) return got;
    let v = 0;
    for (let x = lo; x <= hi; x++) {
      if (check(work, x) === null) { work.push(x); v += countWork(); work.pop(); }
    }
    memo.set(kk, v);
    return v;
  }
  /** The ways to finish the canon from the dux (exact). */
  function count(dux) {
    work.length = 0;
    for (const x of dux) work.push(x);
    if (dux.length > n) return 0;
    return countWork();
  }
  /** Every candidate after the dux: [{note, reason}] (reason null when legal) with futures for the legal ones. */
  function fan(dux) {
    const out = [];
    for (let x = lo; x <= hi; x++) {
      const r = check(dux, x);
      out.push(r ? { note: x, reason: r } : { note: x, reason: null, futures: count([...dux, x]) });
    }
    return out;
  }
  /** What a dissonance at t is in each voice: "passing", "neighbour", or null (not dissonant, or not yet left). */
  function roles(dux) {
    const len = dux.length + d, out = [];
    const du = (t) => (t < dux.length ? dux[t] : null), co = (t) => comesAt(dux, t);
    for (let t = 0; t < len; t++) {
      const x = du(t), c = co(t);
      if (x === null || c === null || !dissonant(x, c)) { out.push(null); continue; }
      const role = (a, m, z) => (a === null || z === null ? "dissonant" : sign(m - a) === sign(z - m) ? "passing" : "neighbour");
      out.push({ dux: role(du(t - 1), x, du(t + 1)), comes: role(co(t - 1), c, co(t + 1)) });
    }
    return out;
  }
  return { spec, check, count, fan, roles, dissonant, strong, comesAt, finals, lowerFirst, window: L, memo };
}
