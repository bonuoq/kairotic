// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 40 · imitation: the kernel of two voices that imitate each other more or less.
//
// In Studies 38 and 39 the comes is not chosen: it is the dux, d beats later, k steps away. Here it is a voice of
// its own, chosen note by note, and how much it imitates the dux is a degree, from 1 to 0:
//
//   1          a canon: the comes is the dux's note (a hard rule)
//   0.5 – 0.9  some notes changed for near ones: the comes keeps within a 3rd of the dux's note (hard), and every
//              step away costs, the more the nearer the degree is to 1 (soft, in the model)
//   0.2 – 0.4  only the motion is imitated: any note, but going the other way than the dux went costs (soft)
//   below 0.2  free counterpoint: no imitation
//
// So the hard rules here are those of Study 39 (meter, dissonance, the mode's ambitus) for each voice and between
// them, plus the band of the degree; the soft rules (in kairotic/canon.cljs) price the rest. Both voices end
// together, as a canon breaks off into its cadence: the dux on the final, the comes on a perfect consonance with it.
//
//   pitch   a diatonic step on the white keys, 0 = C4
//   spec    {tonic, k, d, b, n, lo, hi, clo, chi, spacing, invert, starts, cstarts, imitation, on}
//           lo..hi the dux's range, clo..chi the comes's (by default the dux's shifted by k); starts / cstarts
//           where each may begin; imitation the degree (0–1)
//   D, C    the dux and the comes so far, two arrays of the same length t (C[i] is null before the comes enters)
//
// A point of the work is a time t; a step chooses the pair (dux note, comes note) for it. The futures of a point
// are counted exactly over pairs, memoized on the notes of both voices the rules look back at.

const SCALE = [0, 2, 4, 5, 7, 9, 11];
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

export function quality(a, b) {
  const c = Math.abs(b - a) % 7, st = Math.abs(semis(b) - semis(a)) % 12;
  if (c === 0) return "perfect";
  if (c === 4) return st === 7 ? "perfect" : "dissonant";
  if (c === 2 || c === 5) return "imperfect";
  return "dissonant";
}

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

/** The band of a degree of imitation: "canon", "near", "motion" or "free". */
export function band(s) { return s >= 0.999 ? "canon" : s >= 0.5 ? "near" : s >= 0.2 ? "motion" : "free"; }

const OFF_BY_DEFAULT = new Set(["strict-direct"]);

export function canon(spec) {
  const { tonic, k, d, b = 1, n, lo, hi, spacing = 11 } = spec;
  const phase = spec.phase || 0;      // rests before the dux's first note: an upbeat (anacrusis)
  const clo = spec.clo ?? lo + k, chi = spec.chi ?? hi + k;
  const imitation = spec.imitation ?? 1, bnd = band(imitation);
  const invert = [...(spec.invert || [])].sort((x, y) => x - y);
  const on = (id) => (spec.on && id in spec.on ? !!spec.on[id] : !OFF_BY_DEFAULT.has(id));
  const starts = spec.starts ? [...spec.starts] : [tonic, tonic + 4, tonic + 7];
  const cstarts = spec.cstarts ? [...spec.cstarts] : starts.map((x) => x + k);
  const finals = [];
  for (let i = -2; i <= 2; i++) { const f = tonic + 7 * i; if (f >= lo && f <= hi) finals.push(f); }
  const strong = (t) => (t + phase) % b === 0;
  const lowerFirst = (x, c) => (k > 0 ? [x, c] : [c, x]);
  const transforms = [[null, (a, z) => [a, z]], ...invert.map((N) => [N, (a, z) => [z, a + N - 1]])];
  const label = (N) => (N ? `under inversion at the ${intervalName(N - 1)}: ` : "");
  /** The comes's note in a strict canon at time t (the dux's, d beats before, k steps away), or null. */
  const model = (D, t) => (t - d >= 0 && t - d < D.length ? D[t - d] + k : null);

  function dissonant(x, c) {
    const [l0, h0] = lowerFirst(x, c);
    for (const [, f] of transforms) { const [l, h] = f(l0, h0); if (h >= l && quality(l, h) === "dissonant") return true; }
    return false;
  }

  /** The melodic rules of one line: a reason, or null. who: "" for the dux, "the comes: " for the comes. */
  function melodic(line, t, x, who) {
    const prev = t >= 1 ? line[t - 1] : null;
    if (prev === null || prev === undefined) return null;
    if (on("melodic")) { const e = melodicError(prev, x); if (e) return who + e; }
    if (on("leap-recovery") && t >= 2 && line[t - 2] !== null && line[t - 2] !== undefined) {
      const m = prev - line[t - 2], s = x - prev;
      if (Math.abs(m) >= 5 && s !== -sign(m)) return `${who}after a leap of a ${intervalName(Math.abs(m))}, a step ${m > 0 ? "down" : "up"}`;
      if (Math.abs(m) >= 3 && Math.abs(m) <= 4 && sign(s) !== -sign(m))
        return `${who}after the leap of a ${intervalName(Math.abs(m))} the line turns ${m > 0 ? "down" : "up"}`;
    }
    return null;
  }

  /** The rules of the dux alone for its note x at time t = D.length: a reason, or null. */
  function checkDux(D, C, x) {
    const t = D.length;
    if (t >= n) return "the work is finished";
    if (on("range") && (x < lo || x > hi)) return "out of range";
    if (on("start") && t === 0 && !starts.includes(x)) return "the dux starts on the final, its 5th, its octave or the 4th below";
    const e = melodic(D, t, x, ""); if (e) return e;
    if (on("final") && t === n - 1 && !finals.includes(x)) return "the dux ends on the final";
    if (on("approach") && t === n - 2 && !finals.some((f) => Math.abs(x - f) === 1)) return "the final is approached by step";
    // a dissonance just before is left by step (the dux's part of it)
    if (on("weak-dissonance") && t >= 1 && C[t - 1] !== null && dissonant(D[t - 1], C[t - 1]) && Math.abs(x - D[t - 1]) !== 1)
      return "the dissonance before is left by step (the dux)";
    return null;
  }

  /** The rules of the comes, and between the voices, for the pair (x, c) at t (x already passed checkDux). */
  function checkPair(D, C, x, c) {
    const t = D.length;
    if (t < d) return c === null ? null : "the comes has not entered yet";
    if (c === null) return "the comes sounds from its entry on";
    if (on("range") && (c < clo || c > chi)) return "the comes: out of range";
    const m = model(D, t);
    if (bnd === "canon" && c !== m) return "a canon: the comes is the dux's note";
    if (bnd === "near" && Math.abs(c - m) > 2) return "the comes keeps within a 3rd of the dux's note";
    if (on("start") && t === d && !cstarts.includes(c)) return "the comes enters on the final, its 5th, its octave or the 4th below (shifted)";
    const e = melodic(C, t, c, "the comes: "); if (e) return e;
    const prev = t >= 1 ? D[t - 1] : null, pc = t >= 1 ? C[t - 1] : null;
    if (on("weak-dissonance") && pc !== null && dissonant(prev, pc) && Math.abs(c - pc) !== 1)
      return "the dissonance before is left by step (the comes)";
    // between the voices
    if (on("no-crossing") && k !== 0) { const [l, h] = lowerFirst(x, c); if (l > h) return "the voices cross"; }
    if (on("spacing") && Math.abs(x - c) > spacing) return `more than a ${intervalName(spacing)} apart`;
    const [l0, h0] = lowerFirst(x, c);
    const hasPrev = pc !== null;
    const [pl0, ph0] = hasPrev ? lowerFirst(prev, pc) : [0, 0];
    const sb = b > 1 && strong(t) && t - b >= 0 && C[t - b] !== null ? lowerFirst(D[t - b], C[t - b]) : null;
    let diss = false;
    for (const [N, f] of transforms) {
      const [l, h] = f(l0, h0);
      if (N && h < l) return `${label(N)}the voices would cross (wider than the ${intervalName(N - 1)})`;
      const q = quality(l, h), cls = mod(h - l, 7);
      if (q === "dissonant") {
        diss = true;
        if (on("consonance") && strong(t)) return `${label(N)}a ${intervalName(cls)} (dissonant)${b > 1 ? " on a strong beat" : ""}`;
      }
      if (hasPrev) {
        const [pl, ph] = f(pl0, ph0);
        if (on("parallels") && q === "perfect" && quality(pl, ph) === "perfect" && mod(ph - pl, 7) === cls && (pl !== l || ph !== h))
          return label(N) + (cls === 0 ? "parallel octaves" : "parallel 5ths");
        const dl = l - pl, dh = h - ph;
        if (on("direct-octaves") && cls === 0 && dl !== 0 && sign(dl) === sign(dh) && (on("strict-direct") || Math.abs(dh) !== 1))
          return `${label(N)}${l === h ? "a unison" : intervalName(h - l)} by direct motion`;
      }
      if (sb && on("strong-parallels") && q === "perfect") {
        const [sl, sh] = f(sb[0], sb[1]);
        if (quality(sl, sh) === "perfect" && mod(sh - sl, 7) === cls && (sl !== l || sh !== h))
          return label(N) + (cls === 0 ? "octaves" : "5ths") + " on consecutive strong beats";
      }
    }
    if (diss && b > 1 && on("weak-dissonance")) {
      if (Math.abs(x - prev) !== 1) return "a dissonance on a weak beat: the dux comes to it by step";
      if (!hasPrev) return "the comes cannot enter on a dissonance";
      if (Math.abs(c - pc) !== 1) return "a dissonance on a weak beat: the comes comes to it by step";
      if (dissonant(prev, pc)) return "two dissonances in a row";
      if (t === n - 1) return "the work does not end on a dissonance";
    }
    if (on("entry-unison") && t === d && x === c) return "the comes does not enter on the unison";
    if (on("final") && t === n - 1 && quality(x, c) !== "perfect") return "the last vertical is a perfect consonance";
    if (on("cadence") && t === n - 1 && hasPrev && mod(h0 - l0, 7) === 4 && mod(ph0 - pl0, 7) === 6)
      return "the cadence does not go from a 7th to a 5th";
    return null;
  }

  const comesChoices = (t) => {
    if (t < d) return [null];
    const out = [];
    for (let c = clo; c <= chi; c++) out.push(c);
    return out;
  };

  // ─── the count over pairs ───
  const LD = Math.max(2, b, bnd === "canon" || bnd === "near" ? d : 0);   // the dux notes the rules look back at
  const LC = Math.max(2, b);
  const memo = new Map();
  const W = Math.max(hi, chi) - Math.min(lo, clo) + 2, base = Math.min(lo, clo) - 1;
  function key(D, C, t) {
    let code = t;
    for (let j = Math.max(0, t - LD); j < t; j++) code = code * W + (D[j] - base);
    for (let j = Math.max(0, t - LC); j < t; j++) code = code * W + (C[j] === null ? 0 : C[j] - base);
    return code;
  }
  function countFrom(D, C) {
    const t = D.length;
    if (t >= n) return 1;
    const kk = key(D, C, t), got = memo.get(kk);
    if (got !== undefined) return got;
    let v = 0;
    for (let x = lo; x <= hi; x++) {
      if (checkDux(D, C, x) !== null) continue;
      for (const c of comesChoices(t)) {
        if (checkPair(D, C, x, c) !== null) continue;
        D.push(x); C.push(c); v += countFrom(D, C); D.pop(); C.pop();
      }
    }
    memo.set(kk, v);
    return v;
  }
  /** The ways to finish the work from (D, C), exact. */
  const count = (D, C) => (D.length > n ? 0 : countFrom([...D], [...C]));

  /** The same count a few milliseconds at a time (see Study 39), resolving to the count or to null if cancelled. */
  function countAsync(D0, C0, { budget = 12, onProgress, cancelled } = {}) {
    return new Promise((resolve) => {
      const D = [...D0], C = [...C0];
      if (D.length >= n) return resolve(D.length === n ? 1 : 0);
      const root = key(D, C, D.length), got = memo.get(root);
      if (got !== undefined) return resolve(got);
      // a frame: the pairs to try at its time, the next one, the sum so far
      const pairsAt = () => {
        const t = D.length, out = [];
        for (let x = lo; x <= hi; x++) {
          if (checkDux(D, C, x) !== null) continue;
          for (const c of comesChoices(t)) if (checkPair(D, C, x, c) === null) out.push([x, c]);
        }
        return out;
      };
      const stack = [{ pairs: pairsAt(), i: 0, sum: 0, kk: root }];
      const fraction = () => { let fr = 0, w = 1; for (const f of stack) { const m = Math.max(1, f.pairs.length); w /= m; fr += Math.max(0, f.i - 1) * w; } return Math.min(1, fr); };
      function step() {
        if (cancelled && cancelled()) return resolve(null);
        const end = performance.now() + budget;
        let it = 0;
        while (stack.length) {
          if ((++it & 63) === 0 && performance.now() > end) {
            if (onProgress) onProgress(fraction(), memo.size);
            setTimeout(step, 0);
            return;
          }
          const f = stack[stack.length - 1];
          if (f.i >= f.pairs.length) {
            memo.set(f.kk, f.sum);
            stack.pop();
            if (!stack.length) return resolve(f.sum);
            D.pop(); C.pop();
            stack[stack.length - 1].sum += f.sum;
            continue;
          }
          const [x, c] = f.pairs[f.i++];
          D.push(x); C.push(c);
          if (D.length >= n) { f.sum += 1; D.pop(); C.pop(); continue; }
          const kk = key(D, C, D.length), v = memo.get(kk);
          if (v !== undefined) { f.sum += v; D.pop(); C.pop(); continue; }
          stack.push({ pairs: pairsAt(), i: 0, sum: 0, kk });
        }
      }
      step();
    });
  }

  /** The dux's candidates at the point: {note, reason} or {note, futures} (the futures summed over the comes's
   *  notes that fit). A note whose own rules pass but that no comes fits says why, from the first comes tried. */
  function fanDux(D, C) {
    const t = D.length, out = [];
    for (let x = lo; x <= hi; x++) {
      const r = checkDux(D, C, x);
      if (r) { out.push({ note: x, reason: r }); continue; }
      let fut = 0, fits = 0, why = null;
      for (const c of comesChoices(t)) {
        const rc = checkPair(D, C, x, c);
        if (rc) { if (!why || (c !== null && model(D, t) === c)) why = rc; continue; }
        fits++;
        fut += count([...D, x], [...C, c]);
      }
      out.push(fits ? { note: x, reason: null, futures: fut } : { note: x, reason: "no note of the comes fits: " + why });
    }
    return out;
  }
  /** The comes's candidates for the dux's note x at the point: {note, reason} or {note, futures}. */
  function fanComes(D, C, x) {
    return comesChoices(D.length).map((c) => {
      const r = checkPair(D, C, x, c);
      return r ? { note: c, reason: r } : { note: c, reason: null, futures: count([...D, x], [...C, c]) };
    });
  }
  /** What each dissonance is, by time: null or {dux, comes} as "passing", "neighbour" or "dissonant". */
  function roles(D, C) {
    const out = [];
    for (let t = 0; t < D.length; t++) {
      const x = D[t], c = C[t];
      if (c === null || !dissonant(x, c)) { out.push(null); continue; }
      const role = (a, m, z) => (a === null || a === undefined || z === null || z === undefined ? "dissonant" : sign(m - a) === sign(z - m) ? "passing" : "neighbour");
      out.push({ dux: role(D[t - 1], x, D[t + 1]), comes: role(C[t - 1], c, C[t + 1]) });
    }
    return out;
  }
  return { spec, band: bnd, checkDux, checkPair, count, countAsync, fanDux, fanComes, roles, dissonant, strong, model,
           finals, lowerFirst, memo, window: [LD, LC] };
}
