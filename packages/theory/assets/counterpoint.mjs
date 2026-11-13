// SPDX-License-Identifier: MPL-2.0
// @kairotic/theory · counterpoint.mjs: the canon box's counterpoint, two voices note by note (discussion #172).
//
// The kernel is Study 40's (studies/40-imitation/kairotic/kernel.mjs, copied as it is: the hard rules of meter,
// dissonance and the mode for each voice and between them, the degree of imitation, the futures counted exactly
// over pairs). After it, what the box adds for playing live (`live`): the soft rules of Study 40 as costs, the
// mode as a spec, and a note asked for (a pitch, any key) corrected to the nearest legal note with a future.
//
// A pitch is a diatonic step on the white keys, 0 = C4; the box speaks MIDI and Hz.
//
// ─────────────────────────────── the kernel (Study 40) ───────────────────────────────

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

// ─────────────────────────────── live: the canon box ───────────────────────────────

/** The modes on the white keys (Study 39): the final, the tenor in steps above it, authentic or plagal. */
export const MODES = {
  dorian: { final: 1, tenor: 4, plagal: false }, hypodorian: { final: 1, tenor: 2, plagal: true },
  ionian: { final: 0, tenor: 4, plagal: false }, hypoionian: { final: 0, tenor: 2, plagal: true },
  mixolydian: { final: 4, tenor: 4, plagal: false }, hypomixolydian: { final: 4, tenor: 3, plagal: true },
  aeolian: { final: 5, tenor: 4, plagal: false }, hypoaeolian: { final: 5, tenor: 2, plagal: true },
};

/** The soft rules of Study 40 and their weights (kairotic/canon.cljs there). */
export const WEIGHTS = {
  "leap-size": 1, repeat: 6, "contrary-after-leap": 1.2, "step-back": 1.2, "leap-after-leap": 0.6, return: 1,
  hover: 0.6, run: 1.5, open: 1, climax: 1.5, sequence: 1.5, motion: 2.5, modal: 1, "direct-perfect": 3,
  "imperfect-run": 2, passing: 1, alternation: 1.5, imitation: 1, memory: 1, novelty: 0.3,
};

const LETTERS = ["C", "D", "E", "F", "G", "A", "B"];
const CHROMA = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "G♯", "A", "B♭", "B"];
export const pitchName = (s) => LETTERS[mod(s, 7)] + (4 + octaveOf(s));
export const midiOf = (s) => 60 + semis(s);
/** The name of a MIDI note, black keys included. */
export const midiName = (m) => CHROMA[mod(Math.round(m), 12)] + (Math.floor(Math.round(m) / 12) - 1);
/** Semitones above C4 for a frequency. */
export const semisOfHz = (hz) => 12 * Math.log2(hz / 261.6255653005986);
const LEAP = { 0: 0, 1: 0, 2: 0.2, 3: 0.4, 4: 0.5, 5: 0.8, 7: 0.8 };
const bitsOf = (c) => (c > 0 ? Math.log2(c) : -1);
const clean = (parts) => { for (const key of Object.keys(parts)) if (!parts[key]) delete parts[key]; return parts; };
const total = (parts) => Object.values(parts).reduce((a, v) => a + v, 0);

/**
 * A canon to play live, note by note. o: {mode, k, d, beats, bars, upbeat, imitation, spacing, invert, on, weights}
 * (the defaults: dorian, the comes an octave below, 3 beats later, 2/2, 8 bars, no upbeat, a strict canon).
 * D, C as in the kernel: the dux and the comes so far.
 */
export function live(o = {}) {
  const mode = MODES[o.mode] ? o.mode : "dorian", M = MODES[mode];
  const tonic = M.final, tenor = tonic + M.tenor;
  const [a0, z0] = M.plagal ? [-4, 5] : [-1, 8];
  const lo = tonic + a0, hi = tonic + z0;
  const b = Math.max(1, Math.round(o.beats ?? 2));
  const phase = Math.max(0, Math.min(b - 1, Math.round(o.upbeat ?? 0)));
  const bars = Math.max(2, Math.round(o.bars ?? 8));
  const n = b * (bars - 1) + 1 - phase;
  const k = Math.round(o.k ?? -7), d = Math.max(1, Math.round(o.d ?? 3));
  const imitation = Math.max(0, Math.min(1, o.imitation ?? 1));
  const starts = [tonic, tonic + 4, tonic + 7, tonic - 3].filter((x) => x >= lo && x <= hi);
  const spec = { tonic, k, d, b, phase, n, lo, hi, spacing: o.spacing ?? 11, invert: o.invert || [], starts, imitation, on: o.on || {} };
  const K = canon(spec);
  const w = { ...WEIGHTS, ...(o.weights || {}) };
  const strong = (t) => (t + phase) % b === 0;

  /** The soft cost of x after a line (its own shape), by rule; modal: whether the mode's notes count (the dux). */
  function melodicParts(line, x, t, modal) {
    const parts = {}, tl = line.length, prev = tl ? line[tl - 1] : null, m = tl >= 2 ? prev - line[tl - 2] : null;
    if (modal && (mod(x, 7) === mod(tonic, 7) || mod(x, 7) === mod(tenor, 7))) parts.modal = -(w.modal * (b > 1 && strong(t) ? 1.5 : 1));
    if (prev === null) return clean(parts);
    const s = x - prev, nn = Math.abs(s), all = [...line, x];
    const mv = []; for (let i = 1; i < tl; i++) mv.push(line[i] - line[i - 1]); mv.push(s);
    const L = mv.length;
    if (nn > 0) parts["leap-size"] = w["leap-size"] * (LEAP[nn] ?? 1.5);
    if (nn === 0) parts.repeat = w.repeat;
    if (tl >= 2 && nn > 0 && x === line[tl - 2]) parts.return = w.return;
    const hov = line.slice(0, -1).slice(-3).filter((y) => y === x).length;
    if (hov) parts.hover = hov * w.hover;
    if (m !== null && Math.abs(m) >= 2 && nn > 0 && sign(m) === sign(s)) parts["contrary-after-leap"] = w["contrary-after-leap"] * (nn >= 2 ? 2 : 1);
    if (m !== null && Math.abs(m) >= 3 && nn > 1) parts["step-back"] = w["step-back"];
    if (m !== null && Math.abs(m) >= 2 && nn >= 2) parts["leap-after-leap"] = w["leap-after-leap"];
    if (nn > 0) { let run = 0; for (let i = L - 1; i >= 0 && mv[i] !== 0 && sign(mv[i]) === sign(s); i--) run++; if (run > 4) parts.run = w.run; }
    if (tl >= 5 && Math.max(...all) - Math.min(...all) < 4) parts.open = w.open;
    if (tl > 1 && s > 0 && x === Math.max(...line)) parts.climax = w.climax;
    const same = (i, j, len) => { for (let q = 0; q < len; q++) if (mv[i + q] !== mv[j + q]) return false; return true; };
    if (L >= 4 && mv[L - 1] === mv[L - 3] && mv[L - 2] === mv[L - 4] && mv[L - 1] !== mv[L - 2]) parts.sequence = w.sequence;
    else if (L >= 6 && same(L - 3, L - 6, 3)) parts.sequence = (2 / 3) * w.sequence;
    else if (m !== null && nn > 0) { for (let i = 0; i < L - 3; i++) if (mv[i] === m && mv[i + 1] === s) { parts.memory = -w.memory; break; } }
    if (m !== null && m === s && nn > 0) parts.novelty = w.novelty;
    return clean(parts);
  }

  /** The soft cost of the vertical [x c] at the next time, by rule. */
  function verticalParts(D, C, x, c) {
    const parts = {}, t = D.length, prev = t ? D[t - 1] : null, pc = t ? C[t - 1] : null;
    if (c === null || pc === null || prev === null) return parts;
    const dx = x - prev, dc = c - pc, [l, h] = K.lowerFirst(x, c);
    const motion = dx === 0 && dc === 0 ? "none" : dx === 0 || dc === 0 ? "oblique" : sign(dx) === sign(dc) ? "similar" : "contrary";
    if (motion === "oblique") parts.motion = 0.5 * w.motion;
    if (motion === "similar") {
      parts.motion = 0.8 * w.motion;
      const cls = mod(h - l, 7);
      if (quality(l, h) === "perfect" && cls === 4) parts["direct-perfect"] = w["direct-perfect"];
      let run = 1;
      for (let i = t - 1; i >= 1; i--) {
        const p = D[i], q = C[i], p0 = D[i - 1], q0 = C[i - 1];
        if (q === null || q0 === null) break;
        const [ll, hh] = K.lowerFirst(p, q);
        if (quality(ll, hh) === "imperfect" && mod(hh - ll, 7) === cls && sign(p - p0) === sign(q - q0) && p !== p0) run++; else break;
      }
      if (quality(l, h) === "imperfect" && run > 3) parts["imperfect-run"] = w["imperfect-run"];
    }
    if (b > 1 && !strong(t) && K.dissonant(x, c)) parts.passing = -w.passing;
    if (t >= 2) {
      const vc = (i) => (C[i] === null ? null : mod(Math.abs(D[i] - C[i]), 7));
      const iv = mod(Math.abs(x - c), 7), i1 = vc(t - 1), i2 = vc(t - 2);
      if (i1 !== null && i2 !== null && iv === i2 && iv !== i1) parts.alternation = w.alternation;
    }
    return clean(parts);
  }

  /** What the comes's c costs for how it imitates the dux, by the degree. */
  function imitationCost(D, C, c) {
    const t = D.length, m = K.model(D, t), s = imitation, ww = w.imitation;
    if (K.band === "near") return m === null ? 0 : ww * Math.abs(c - m) * (1 + (6 * (s - 0.5)) / 0.4);
    if (K.band === "motion") {
      const i = t - d, md = i >= 1 ? D[i] - D[i - 1] : null, pc = t ? C[t - 1] : null, cm = pc === null ? null : c - pc;
      if (md === null || cm === null) return 0;
      return (sign(md) !== sign(cm) ? ww * (1 + (4 * (s - 0.2)) / 0.3) : 0) + ww * 0.3 * s * Math.abs(cm - md);
    }
    return 0;
  }

  /** The soft cost of the comes's c with the dux's x next: the vertical, the comes's own line, the imitation. */
  function pairParts(D, C, x, c) {
    if (c === null) return {};
    const own = melodicParts(C.filter((y) => y !== null), c, D.length, false), parts = verticalParts(D, C, x, c);
    for (const [key, v] of Object.entries(own)) parts["comes/" + key] = v;
    const im = imitationCost(D, C, c);
    if (im > 0) parts.imitation = im;
    return parts;
  }

  /** The comes's best note with the dux's x next: {note, futures, cost, parts}, or null when none has a future. */
  function bestComes(D, C, x) {
    let best = null;
    for (const e of K.fanComes(D, C, x)) {
      if (e.reason || !(e.futures > 0)) continue;
      const parts = pairParts(D, C, x, e.note), cost = total(parts);
      if (!best || cost < best.cost || (cost === best.cost && (e.note ?? -100) < (best.note ?? -100)))
        best = { note: e.note, futures: e.futures, cost, parts };
    }
    return best;
  }

  /** The dux's candidates next: {note, reason} or {note, futures, cost, comes, score} (score: its cost and the
   *  best comes's), in the order of the notes. */
  function fan(D, C) {
    const t = D.length;
    return K.fanDux(D, C).map((e) => {
      if (e.reason) return { note: e.note, reason: e.reason };
      if (!(e.futures > 0)) return { note: e.note, reason: null, futures: 0 };
      const parts = melodicParts(D, e.note, t, true), own = total(parts), bc = bestComes(D, C, e.note);
      return { note: e.note, reason: null, futures: e.futures, cost: own, parts, comes: bc.note, comesParts: bc.parts, score: own + bc.cost };
    });
  }

  /** The futuribles next, the most plausible first (by score, then by more futures). */
  const futuribles = (D, C) => fan(D, C).filter((e) => e.futures > 0).sort((p, q) => p.score - q.score || q.futures - p.futures || p.note - q.note);

  /**
   * The pitch asked for (semitones above C4, any key, a fraction for a bend) as the dux's next note: itself when it
   * is legal and has a future, otherwise the nearest one that is (an asked pitch outside the range is first
   * taken by octaves into it; between two as near, the more plausible). With the comes's best note with it.
   * {note, comes, asked, corrected, reason, futures, fan} or null when nothing can follow (the work is finished).
   */
  function play(D, C, asked) {
    if (D.length >= n) return null;
    const F = fan(D, C), ok = F.filter((e) => e.futures > 0);
    if (!ok.length) return null;
    const r = Math.round(asked);
    let a = r;
    const sl = semis(lo), sh = semis(hi);
    while (a < sl - 6) a += 12;
    while (a > sh + 6) a -= 12;
    const best = ok.slice().sort((p, q) => Math.abs(semis(p.note) - a) - Math.abs(semis(q.note) - a) || p.score - q.score || p.note - q.note)[0];
    let reason = null;
    if (semis(best.note) !== r) {
      const step = [...Array(hi - lo + 15).keys()].map((i) => lo - 7 + i).find((s) => semis(s) === r);
      const e = step === undefined ? null : F.find((f) => f.note === step);
      reason = step === undefined ? `${midiName(60 + r)} is not a note of the mode`
        : !e ? `${pitchName(step)} is out of the range (${pitchName(lo)}–${pitchName(hi)}): taken by octaves`
        : e.reason ? e.reason
        : "no way to finish the canon from it";
    }
    return { note: best.note, comes: best.comes, asked: r, corrected: reason !== null, reason, futures: best.futures, score: best.score, fan: F };
  }

  /** The engine's own next pair (the most plausible), as play gives it, or null. */
  function engine(D, C) {
    const f = futuribles(D, C)[0];
    return f ? play(D, C, semis(f.note)) : null;
  }

  /** The debts pending at this point, in words. */
  function obligations(D, C) {
    const t = D.length, out = [], prev = t ? D[t - 1] : null, pc = t ? C[t - 1] : null;
    if (t >= n) return out;
    if (prev !== null && pc !== null && K.dissonant(prev, pc)) out.push("leave the dissonance by step, in both voices");
    const m = t >= 2 ? prev - D[t - 2] : null;
    if (m !== null && Math.abs(m) >= 3) out.push(`after the leap of a ${intervalName(Math.abs(m))}: ${Math.abs(m) >= 5 ? "a step" : "turn"} ${m > 0 ? "down" : "up"}`);
    const mn = K.model(D, t);
    if (mn !== null && K.band === "canon") out.push(`a canon: the comes sounds ${pitchName(mn)}`);
    if (mn !== null && K.band === "near") out.push(`the comes near ${pitchName(mn)} (within a 3rd)`);
    if (mn !== null && K.band === "motion") out.push("the comes moves as the dux moved");
    if (b > 1 && t >= d) out.push(strong(t) ? "a strong beat: a consonance" : "a weak beat: a consonance, or a dissonance passing by step");
    if (t === n - 2) out.push("approach the final by step");
    if (t === n - 1) out.push(`end on the final (${K.finals.map(pitchName).join(" or ")}), on a perfect consonance`);
    if (t < n - 2) out.push(`end on the final in ${n - t} notes`);
    return out;
  }

  return {
    spec, mode, n, bars, kernel: K, lo, hi, tonic, tenor, strong, fan, futuribles, play, engine, obligations,
    pairParts, melodicParts, midi: midiOf, name: pitchName,
    count: (D, C) => K.count(D, C),
    bits: (D, C) => bitsOf(K.count(D, C)),
    /** The count from the start, a few milliseconds at a time: after it every legal point is counted. */
    warm: (opts) => K.countAsync([], [], opts || {}),
  };
}

// api/import-module hands a component the default export
export default { live, canon, band, MODES, WEIGHTS, semis, pitchName, midiOf, midiName, semisOfHz, quality, intervalName };
