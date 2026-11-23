// SPDX-License-Identifier: MPL-2.0
// @kairotic/rules · canon.mjs: the comes on the one engine (discussion #353, step 4). Two free voices on a system —
// the dux and the comes, a canon, an imitation or free counterpoint, species and suspensions, the comes inverted or
// augmented, the counterpoint asked to stand inversion — as @kairotic/cac's counterpoint.mjs (Studies 38–46, 50) has
// them, its rules now entries of the catalogue, each a context and a condition:
//
//   a voice (CANON_VOICE)  range, start, final, approach (the dux's edges), entry (the comes's: silent until it
//                          enters, on the final, its 5th, its octave or the 4th below), hold, melodic (the system's
//                          melodic intervals), leap-recovery (from a small leap the line turns, from a large one a step
//                          turns it), syncopation (fourth species: the cantus firmus a note a bar, the comes syncopated),
//                          ficta (in a key: tonal.mjs's musica ficta, the partimento's — the same tonal layer)
//   between (CANON_BETWEEN) resolution (a suspension resolves down by step, a dissonance is left by step), imitation
//                          (a canon: the comes is the dux's note, transformed; near: within a 3rd), crossing, spacing,
//                          vertical (under every inversion the counterpoint must stand: parallels, direct octaves,
//                          perfect intervals on consecutive strong beats, a dissonance on a strong beat a suspension
//                          of the kinds the system allows, prepared, on a weak one passing by step, never two in a
//                          row), entry-unison, final (the last vertical perfect), cadence (the system's forbidden ones)
//
// The system is one of systems.mjs's (steps of a tuning) or a key of tonal.mjs's — major, minor, a church mode with its
// ficta: spec.key {tonic, mode} (degree 0 its tonic), spec.ficta false for the scale alone —, the partimento's tonal
// layer: a pitch then a code (a degree and an alteration), the rules counting degrees and judging intervals by their
// real size. In a key without ficta, a church mode counts as on the white keys (tests/rules.mjs).
//
// canonVoices(spec) takes counterpoint.canon's spec and counts the same (tests/rules.mjs: to the number); a style
// names its rules, `canon-2` all of them in the order counterpoint.mjs reads them, and a spec's `on` turns one off.

import { solveVoices } from "./rules.mjs";
import { makeSystem, keySystem, DIATONIC } from "./systems.mjs";

const mod = (a, m) => ((a % m) + m) % m;
const sign = (x) => (x > 0) - (x < 0);

/** The band of a degree of imitation: "canon", "near", "motion" or "free". */
export const band = (s) => (s >= 0.999 ? "canon" : s >= 0.5 ? "near" : s >= 0.2 ? "motion" : "free");
const OFF_BY_DEFAULT = new Set(["strict-direct", "syncopation"]);

/** The world the canon's rules read: the system, the spec's numbers, the transformation, what a vertical is. */
export function canonWorld(spec) {
  const { tonic, k, d, b = 1, n, lo, hi, spacing = 11 } = spec;
  const phase = spec.phase || 0, maxHold = Math.max(1, spec.maxHold ?? 2);
  // the system: one of systems.mjs's, or a key of tonal.mjs's (its modes, its ficta) — the partimento's tonal layer
  const S = spec.key ? keySystem(spec.key, { ficta: spec.ficta ?? true }) : makeSystem(spec.system || DIATONIC), N7 = S.N;
  // a pitch's degree (the steps every rule counts), a pitch moved by steps, the pitches from one degree to another
  const deg = S.deg || ((x) => x), shift = S.shift || ((x, s) => x + s);
  const codesIn = S.codesIn || ((a, z) => { const out = []; for (let x = a; x <= z; x++) out.push(x); return out; });
  const tf = spec.transform || {};
  const inv = tf.kind === "inversion", aug = tf.kind === "augmentation" ? Math.max(2, Math.round(tf.m || 2)) : 1;
  const axisT = tf.axis ?? tonic;
  const Tx = (x) => (inv ? 2 * axisT - x : x) + k;
  const [tlo, thi] = [Tx(lo), Tx(hi)].sort((a, z) => a - z);
  const clo = spec.clo ?? tlo, chi = spec.chi ?? thi;
  const bnd = band(spec.imitation ?? 1);
  const invert = [...(spec.invert || [])].sort((x, y) => x - y);
  const on = (id) => (spec.on && id in spec.on ? !!spec.on[id] : id === "syncopation" ? spec.species === 4 : !OFF_BY_DEFAULT.has(id));
  const starts = spec.starts ? [...spec.starts] : [tonic, tonic + 4, tonic + 7];
  const cstarts = spec.cstarts ? [...spec.cstarts] : starts.map(Tx);
  const finals = [];
  for (let i = -2; i <= 2; i++) { const f = tonic + N7 * i; if (f >= lo && f <= hi) finals.push(f); }
  const strong = (t) => (t + phase) % b === 0;
  const lowerFirst = (x, c) => (k > 0 ? [x, c] : [c, x]);
  // the counterpoint as it is, and under every inversion it must stand (the lower voice taken up N − 1 steps)
  const transforms = [[null, (a, z) => [a, z]], ...invert.map((N) => [N, (a, z) => [z, shift(a, N - 1)]])];
  const label = (N) => (N ? `under inversion at the ${S.intervalName(N - 1)}: ` : "");
  const source = (t) => (t - d >= 0 ? Math.floor((t - d) / aug) : null);
  // (the comes's note in a strict canon: the dux's degree, transformed; its alteration its own)
  const model = (D, t) => { const i = source(t); return i !== null && i < D.length ? Tx(deg(D[i])) : null; };
  function dissonant(x, c) {
    const [l0, h0] = lowerFirst(x, c);
    for (const [, f] of transforms) { const [l, h] = f(l0, h0); if (deg(h) >= deg(l) && S.quality(l, h) === "dissonant") return true; }
    return false;
  }
  const holder = (D, C, t) => {
    if (t < 1 || C[t] === null || C[t - 1] === null) return null;
    const hd = D[t] === D[t - 1], hc = C[t] === C[t - 1];
    return hd && !hc ? "dux" : hc && !hd ? "comes" : null;
  };
  const suspensionAt = (D, C, t) => b > 1 && t >= 1 && strong(t) && C[t] !== null && dissonant(D[t], C[t]) && holder(D, C, t) !== null;
  return { spec, S, N7, deg, shift, codesIn, tonic, k, d, b, n, lo, hi, clo, chi, spacing, phase, maxHold, aug, Tx, bnd, invert, on, starts, cstarts,
           finals, strong, lowerFirst, transforms, label, source, model, dissonant, holder, suspensionAt };
}

/** A line's melodic rules at t (the same pitch again: the note held, hold beats at most; the moves struck): a reason
 *  or null. who: "" (the dux), "the comes: ". */
function melodicOf(w, line, t, x, who, hold) {
  const { S, on, deg } = w, prev = t >= 1 ? line[t - 1] : null;
  if (prev === null || prev === undefined) return null;
  let j = t - 1;
  while (j >= 1 && line[j - 1] === prev) j--;
  if (x === prev) return t - j >= hold ? `${who}a note is held for ${hold === 2 ? "two" : hold} beats at most` : null;
  if (on("melodic")) { const e = S.melodicError(prev, x); if (e) return who + e; }
  const a1 = j >= 1 ? line[j - 1] : null;
  if (on("leap-recovery") && a1 !== null && a1 !== undefined) {
    const m = deg(prev) - deg(a1), s = deg(x) - deg(prev);
    if (Math.abs(m) >= S.leaps.large && s !== -sign(m)) return `${who}after a leap of a ${S.intervalName(Math.abs(m))}, a step ${m > 0 ? "down" : "up"}`;
    if (Math.abs(m) >= S.leaps.small && Math.abs(m) < S.leaps.large && sign(s) !== -sign(m))
      return `${who}after the leap of a ${S.intervalName(Math.abs(m))} the line turns ${m > 0 ? "down" : "up"}`;
  }
  return null;
}

// ─── the catalogue: a voice's rules (context: note, line, edge), for the dux and for the comes ───
// (U the voice's line before t, x its note at t; role "dux" or "comes")
export const CANON_VOICE = {
  /** note · within its range (the comes's: the dux's, transformed). */
  range: (w, role) => (U, t, x) => (role === "comes" && x === null ? null : w.on("range") && (role === "dux" ? w.deg(x) < w.lo || w.deg(x) > w.hi : w.deg(x) < w.clo || w.deg(x) > w.chi) ? (role === "dux" ? "out of range" : "the comes: out of range") : null),
  /** edge · the comes silent until it enters (d beats after the dux), sounding from then on; it enters on the final,
   *  its 5th, its octave or the 4th below, shifted as the canon shifts it. The dux starts so too. */
  entry: (w, role) => (U, t, x) => {
    if (role === "dux") return w.on("start") && t === 0 && !w.starts.includes(w.deg(x)) ? "the dux starts on the final, its 5th, its octave or the 4th below" : null;
    if (t < w.d) return x === null ? null : "the comes has not entered yet";
    if (x === null) return "the comes sounds from its entry on";
    return null;
  },
  /** edge · the dux ends on the final, approached by step. */
  final: (w, role) => (U, t, x) => (role === "dux" && w.on("final") && t === w.n - 1 && !w.finals.includes(w.deg(x)) ? "the dux ends on the final" : null),
  approach: (w, role) => (U, t, x) => (role === "dux" && w.on("approach") && t === w.n - 2 && !w.finals.some((f) => Math.abs(w.deg(x) - f) === 1) ? "the final is approached by step" : null),
  /** line · fourth species: the dux (the cantus firmus) a note a bar; the comes syncopated, holding over the strong
   *  beat, striking on the weak one and the final. */
  syncopation: (w, role) => (U, t, x) => {
    if (!(w.on("syncopation") && w.b === 2)) return null;
    if (role === "dux") {
      if (t < 1) return null;
      if (w.strong(t) && x === U[t - 1]) return "fourth species: the cantus firmus moves on every strong beat";
      if (!w.strong(t) && x !== U[t - 1]) return "fourth species: the cantus firmus holds its note for the whole bar";
      return null;
    }
    if (t <= w.d || x === null) return null;
    if (w.strong(t) && t < w.n - 1 && x !== U[t - 1]) return "fourth species: the comes holds its note over the strong beat";
    if ((!w.strong(t) || t === w.n - 1) && x === U[t - 1]) return "fourth species: the comes strikes a new note on the weak beat";
    return null;
  },
  /** line · a key's musica ficta (the partimento's, tonal.mjs's): a raised note leads up by step (the aeolian's F♯ on to
   *  G♯); at the last beat a line rising to the final through the leading tone raises it where the mode does; the
   *  final's raised 3rd only at the end. (A system of steps has no ficta: nothing to check.) */
  ficta: (w, role) => (U, t, x) => {
    const K = w.S.key;
    if (!K || !w.S.ficta || x === null || !w.on("ficta")) return null;
    const { deg, alt } = w.S, d = deg(x);
    if (alt(x) !== 0 && t < w.n - 1 && K.fictaAtEnd(d)) return `${role === "comes" ? "the comes: " : ""}${w.S.pitchName(x)} only at the end (the final's 3rd raised)`;
    const prev = t >= 1 ? U[t - 1] : null;
    if (prev === null || prev === undefined || prev === x) return null;
    const step = d - deg(prev), fp = K.ficta(deg(prev));
    if (fp > 0 && alt(prev) === fp && !K.fictaAtEnd(deg(prev)) && step !== 1) return `${role === "comes" ? "the comes: " : ""}${w.S.pitchName(prev)} goes up by step (musica ficta)`;
    if (fp > 0 && alt(prev) === fp && step === 1 && K.ficta(d) > 0 && !K.fictaAtEnd(d) && alt(x) === 0) return `${role === "comes" ? "the comes: " : ""}${w.S.pitchName(prev)} goes on up to the raised ${w.S.pitchName(w.S.shift(x, 0) + 1)} (musica ficta)`;
    if (t === w.n - 1 && step === 1 && mod(d, 7) === 0 && mod(deg(prev), 7) === 6 && alt(prev) === 0 && K.ficta(6) > 0)
      return `${role === "comes" ? "the comes: " : ""}at the cadence the leading tone raised (musica ficta)`;
    return null;
  },
  /** line · a note held some beats at most; the system's melodic intervals; after a leap the line turns. */
  melodic: (w, role) => (U, t, x) => (role === "comes" && (t < w.d || x === null) ? null : melodicOf(w, U, t, x, role === "dux" ? "" : "the comes: ", role === "dux" ? w.maxHold : w.maxHold * w.aug)),
};

// ─── the catalogue: between the two voices (context: pair, given, vertical, edge) ───
// (X: {W: [D, C] before t, t, x: [the dux's note, the comes's]})
export const CANON_BETWEEN = {
  /** pair · a suspension resolves down by step (by the voice that held it); a dissonance is left by step. */
  resolution: (w, role) => ({ id: "resolution-" + role, check: ({ W, t, x: [x, c] }) => {
    const [D, C] = W;
    const i = role === "dux" ? 0 : 1, L = W[i], y = role === "dux" ? x : c;
    if (role === "comes" && (t < w.d || c === null)) return null;
    const DD = [...D, x], CC = [...C, c];
    if (t >= 2 && w.suspensionAt(DD, CC, t - 1)) {
      return w.holder(DD, CC, t - 1) === role && w.deg(y) !== w.deg(L[t - 1]) - 1 ? `the suspension resolves down by step (the ${role})` : null;
    }
    if (w.on("weak-dissonance") && t >= 1 && C[t - 1] !== null && C[t - 1] !== undefined && w.dissonant(D[t - 1], C[t - 1]) && Math.abs(w.deg(y) - w.deg(L[t - 1])) !== 1)
      return `the dissonance before is left by step (the ${role})`;
    return null;
  } }),
  /** given · a canon: the comes is the dux's note (d beats later, k steps away, transformed); near: within a 3rd. */
  imitation: (w) => ({ id: "imitation", check: ({ W: [D], t, x: [, c] }) => {
    if (t < w.d || c === null) return null;
    const m = w.model(D, t), cadence = w.on("syncopation") && w.b === 2 && t === w.n - 1;
    if (w.bnd === "canon" && w.deg(c) !== m && !cadence) return "a canon: the comes is the dux's note";
    if (w.bnd === "near" && Math.abs(w.deg(c) - m) > 2) return "the comes keeps within a 3rd of the dux's note";
    if (w.on("start") && t === w.d && !w.cstarts.includes(w.deg(c))) return "the comes enters on the final, its 5th, its octave or the 4th below (shifted)";
    return null;
  } }),
  /** pair · the voices do not cross; not further apart than the spacing. */
  crossing: (w) => ({ id: "crossing", check: ({ t, x: [x, c] }) => {
    if (t < w.d || c === null) return null;
    if (w.on("no-crossing") && w.k !== 0) { const [l, h] = w.lowerFirst(x, c); if (w.deg(l) > w.deg(h)) return "the voices cross"; }
    if (w.on("spacing") && Math.abs(w.deg(x) - w.deg(c)) > w.spacing) return `more than a ${w.S.intervalName(w.spacing)} apart`;
    return null;
  } }),
  /** vertical, pair · as it is and under every inversion asked: no parallel perfect intervals, no direct octaves,
   *  none on consecutive strong beats; a dissonance on a strong beat a suspension (prepared by a consonance, held, of
   *  the kinds the system allows, with a beat to resolve), resolved to a consonance; on a weak beat passing, both
   *  voices by step, never two in a row; the comes enters on no unison; the last vertical perfect, by no forbidden
   *  cadence. */
  vertical: (w) => ({ id: "vertical", check: ({ W: [D, C], t, x: [x, c] }) => {
    if (t < w.d || c === null) return null;
    const { S, N7, b, n, on, lowerFirst, transforms, label, strong, deg } = w;
    const quality = S.quality, intervalName = S.intervalName;
    const prev = t >= 1 ? D[t - 1] : null, pc = t >= 1 ? C[t - 1] : null;
    const resolving = t >= 2 && w.suspensionAt([...D, x], [...C, c], t - 1);
    const [l0, h0] = lowerFirst(x, c);
    const hasPrev = pc !== null && pc !== undefined;
    const [pl0, ph0] = hasPrev ? lowerFirst(prev, pc) : [0, 0];
    const sb = b > 1 && strong(t) && t - b >= 0 && C[t - b] !== null ? lowerFirst(D[t - b], C[t - b]) : null;
    const hd = hasPrev && x === prev, hc = hasPrev && c === pc;
    const held = hd !== hc ? (hd ? "dux" : "comes") : null;
    const heldLower0 = held && (w.k > 0 ? held === "dux" : held === "comes");
    const suspensionError = (N, l, h, f) => {
      if (!on("suspension") || b === 1) return true;
      if (!hasPrev || !held) return "not held from the beat before";
      const [pl, ph] = f(pl0, ph0);
      if (deg(ph) < deg(pl) || quality(pl, ph) === "dissonant") return "a suspension is prepared by a consonance";
      if (t >= n - 1) return "a suspension needs a beat to resolve";
      if (on("suspension-kinds")) {
        const lower = N ? !heldLower0 : heldLower0, cls = mod(deg(h) - deg(l), N7), K = S.suspensions;
        const list = (cs) => cs.map((cc) => intervalName(cc + (K.compound.includes(cc) ? N7 : 0))).join(", ") || "none";
        if (lower && !K.lower.includes(cls)) return N7 === 7 && cls === 3 ? "a 4th in the lower voice would resolve to a 5th (4-5)" : `held in the lower voice, only: ${list(K.lower)}`;
        if (!lower && K.compound.includes(cls) && deg(h) - deg(l) < N7) return `a ${intervalName(cls)} in the upper voice would resolve to the unison`;
        if (!lower && !K.upper.includes(cls)) return `held in the upper voice, only: ${list(K.upper)}`;
      }
      return null;
    };
    let diss = false, unsuspended = null;
    for (const [N, f] of transforms) {
      const [l, h] = f(l0, h0);
      if (N && deg(h) < deg(l)) return `${label(N)}the voices would cross (wider than the ${intervalName(N - 1)})`;
      const q = quality(l, h), cls = mod(deg(h) - deg(l), N7);
      if (q === "dissonant") {
        diss = true;
        if (on("consonance") && strong(t)) {
          const why = suspensionError(N, l, h, f);
          if (why) unsuspended = unsuspended || `${label(N)}a ${intervalName(cls)} (dissonant)${b > 1 ? " on a strong beat" : ""}${why === true ? "" : ": " + why}`;
        }
      }
      if (hasPrev) {
        const [pl, ph] = f(pl0, ph0);
        if (on("parallels") && q === "perfect" && quality(pl, ph) === "perfect" && mod(deg(ph) - deg(pl), N7) === cls && (pl !== l || ph !== h))
          return label(N) + "parallel " + (cls === 0 ? S.periodName : intervalName(cls)) + "s";
        const dl = deg(l) - deg(pl), dh = deg(h) - deg(ph);
        if (on("direct-octaves") && cls === 0 && dl !== 0 && sign(dl) === sign(dh) && (on("strict-direct") || Math.abs(dh) !== 1))
          return `${label(N)}${l === h ? "a unison" : intervalName(deg(h) - deg(l))} by direct motion`;
      }
      if (sb && on("strong-parallels") && q === "perfect") {
        const [sl, sh] = f(sb[0], sb[1]);
        if (quality(sl, sh) === "perfect" && mod(deg(sh) - deg(sl), N7) === cls && (sl !== l || sh !== h))
          return label(N) + (cls === 0 ? S.periodName : intervalName(cls)) + "s on consecutive strong beats";
      }
    }
    if (unsuspended) return unsuspended;
    if (resolving && diss) return "the suspension resolves to a consonance";
    if (diss && b > 1 && strong(t) && on("consonance")) {
      if (t === n - 1) return "the work does not end on a dissonance";
    } else if (diss && b > 1 && on("weak-dissonance")) {
      if (Math.abs(deg(x) - deg(prev)) !== 1) return "a dissonance on a weak beat: the dux comes to it by step";
      if (!hasPrev) return "the comes cannot enter on a dissonance";
      if (Math.abs(deg(c) - deg(pc)) !== 1) return "a dissonance on a weak beat: the comes comes to it by step";
      if (w.dissonant(prev, pc)) return "two dissonances in a row";
      if (t === n - 1) return "the work does not end on a dissonance";
    }
    if (on("entry-unison") && t === w.d && x === c) return "the comes does not enter on the unison";
    if (on("final") && t === n - 1 && quality(x, c) !== "perfect") return "the last vertical is a perfect consonance";
    if (on("cadence") && t === n - 1 && hasPrev) {
      const to = mod(deg(h0) - deg(l0), N7), from = mod(deg(ph0) - deg(pl0), N7);
      if (S.forbidCadence.some(([a, z]) => a === from && z === to)) return `the cadence does not go from a ${intervalName(from)} to a ${intervalName(to)}`;
    }
    return null;
  } }),
};

/** The canon's style: its voices' rules and those between them, in counterpoint.mjs's order. */
export const CANON_STYLES = {
  "canon-2": { style: "canon-2", version: "1.0.0",
    dux: ["range", "entry", "melodic", "final", "approach", "syncopation", "ficta"],
    comes: ["entry", "range", "syncopation", "melodic", "ficta"],
    between: [["resolution", "dux"], ["imitation"], ["resolution", "comes"], ["crossing"], ["vertical"]] },
};

/**
 * The comes on the one engine: counterpoint.canon's spec ({tonic, k, d, b, n, lo, hi, spacing, phase, maxHold,
 * system, transform, imitation, invert, species, starts, cstarts, clo, chi, on}), its style (canon-2). → solveVoices's
 * count, fan, sample, engine, judge (over [D, C]), and the world.
 */
export function canonVoices(spec, style = CANON_STYLES["canon-2"]) {
  const w = canonWorld(spec), { n, d, lo, hi, clo, chi, maxHold, b, aug, bnd } = w;
  const solver = (role, ids, codes) => {
    const fs = ids.map((id) => CANON_VOICE[id](w, role));
    return { codes, check: (U, t, x) => { if (t >= n) return "the work is finished"; for (const f of fs) { const e = f(U, t, x); if (e) return e; } return null; }, costParts: () => ({}) };
  };
  const dcodes = w.codesIn(lo, hi), ccodes = [null, ...w.codesIn(clo, chi)];
  const between = style.between.map(([id, p]) => CANON_BETWEEN[id](w, p));
  // the memo: the notes the rules look back at — a note held (maxHold beats) and the note struck before it, the
  // strong beat before, and (a canon) the dux's note the comes repeats, further back in an augmentation
  const LD = Math.max(maxHold + 1, b, bnd === "canon" || bnd === "near" ? d : 0), LC = Math.max(maxHold * aug + 1, b);
  const fromD = (t) => Math.max(0, aug > 1 && (bnd === "canon" || bnd === "near") ? Math.min(t - LD, Math.floor((t - d) / aug)) : t - LD);
  const key = (W, t) => t + ":" + W[0].slice(fromD(t), t).join(",") + ":" + W[1].slice(Math.max(0, t - LC), t).join(",");
  const SV = solveVoices({ n, voices: [{ name: "dux", solver: solver("dux", style.dux, dcodes) }, { name: "comes", solver: solver("comes", style.comes, ccodes) }],
                           between, key, result: (W) => ({ dux: W[0], comes: W[1] }) });
  return { ...SV, world: w, style, count: (D = [], C = []) => SV.count([D, C]),
           judge: (D, C) => SV.judgeW([D, C], `the voices are not ${n} beats long`) };
}

export default { canonVoices, canonWorld, CANON_VOICE, CANON_BETWEEN, CANON_STYLES, band };
