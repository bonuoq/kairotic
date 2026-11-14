// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 42 · systems: Study 41's kernel, with the system as data (spec.system: a tuning, the steps of a
// scale in it, what its intervals are as verticals and as melodic moves, its suspensions and cadences). The
// diatonic system of Studies 38–41 is one of them (DIATONIC), and gives the same counts.
//
// Study 41: ties, suspensions and fourth species.
//
// A note may be held over the next beat (a tie): in a voice, the same pitch on the next beat is that note held, not
// struck again, and a note is held for two beats at most (spec.maxHold). A dissonance may then fall on a strong beat as a
// suspension: the voice that makes it holds its note from the beat before, where it was a consonance (the
// preparation), while the other voice moves; on the next beat it goes down a step to a consonance (the
// resolution). Of the dissonances, the upper voice may hold a 7th (7-6), a 4th (4-3) or a 9th (9-8), the lower one a
// 2nd (2-3), as Fux allows. The melodic rules look at the notes struck (a leap is recovered by the next note
// struck, not by the next beat). With species 4 (spec.species, the rule syncopation), after Fux's fourth species, the
// dux is the cantus firmus — a note a bar — and the comes is syncopated: it strikes its notes on the weak beats and
// holds them over the strong ones, where the suspensions fall.
//
// Study 40's kernel, from here on:
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

const mod = (a, m) => ((a % m) + m) % m;
const sign = (x) => (x > 0) - (x < 0);

// ─── systems: a tuning, the steps of a scale in it, and what its intervals are ───
//
// A system is data (the page writes it in EDN):
//   tuning      {cents: [the degrees above the reference, the last one the period], ref: Hz of degree 0} — the
//               format of Scala (.scl) as the app's canvas keeps it
//   steps       which degrees of the tuning make the scale (all of them if left out); a pitch is a step of it,
//               0 the reference, and N steps make a period
//   vertical    for each class of interval (steps apart, modulo N): "perfect", "imperfect" or "dissonant", or a
//               list of [{cents: [lo, hi], quality}…, {else: quality}] when the class depends on its real size
//   melodic     the melodic intervals allowed, by steps: [{steps, cents?: [lo, hi], up?: true, else?: reason,
//               forbid?: reason}…]; wider: the reason for a leap wider than any listed
//   leaps       {small, large}: from small steps a leap turns back, from large one a step turns it back
//   suspensions {upper: [classes], lower: [classes], compound: [classes held above only when compound]}
//   cadence     {forbid: [[from-class, to-class]…]}
//   names       a name for each step (for the pitches), intervals: a name for each span (default: ordinals)

const NAMES = ["unison", "2nd", "3rd", "4th", "5th", "6th", "7th", "octave"];
const ordinal = (s) => {
  if (s <= 7) return NAMES[s];
  const n = s + 1, last = n % 10;
  return n + (n >= 11 && n <= 13 ? "th" : last === 1 ? "st" : last === 2 ? "nd" : last === 3 ? "rd" : "th");
};
// (to a thousandth of a cent, as the EDN shows them)
const edo = (n, period = 1200) => Array.from({ length: n }, (_, i) => Math.round((1000 * period * (i + 1)) / n) / 1000);

/** The diatonic system of Studies 38–41: the white keys of 12-TET, Fux's consonances and melodic intervals. */
export const DIATONIC = {
  name: "diatonic, 12-TET",
  tuning: { cents: edo(12), ref: 261.6255653005986 },
  steps: [0, 2, 4, 5, 7, 9, 11],
  names: ["C", "D", "E", "F", "G", "A", "B"],
  vertical: { 0: "perfect", 2: "imperfect", 5: "imperfect", 4: [{ cents: [680, 720], quality: "perfect" }, { else: "dissonant" }] },
  melodic: [{ steps: 1 }, { steps: 2 }, { steps: 3, cents: [490, 510], else: "an augmented 4th (tritone)" },
            { steps: 4, cents: [690, 710], else: "a diminished 5th (tritone)" },
            { steps: 5, up: true, cents: [790, 810], else: "a 6th (only the minor 6th up)" }, { steps: 6, forbid: "a 7th" }, { steps: 7 }],
  wider: "a leap wider than the octave",
  leaps: { small: 3, large: 5 },
  suspensions: { upper: [6, 3, 1], lower: [1], compound: [1] },
  cadence: { forbid: [[6, 4]] },
};

// the modes of the white keys (Studies 39–41): the final, the tenor (steps above it), the ambitus and the starts
// (steps from the final); and how far apart the voices may be (spacing, in steps: a 12th)
DIATONIC.modes = {
  dorian: { final: 1, tenor: 4, ambitus: [-1, 8], starts: [0, 4, 7] }, hypodorian: { final: 1, tenor: 2, ambitus: [-4, 5], starts: [0, 4, 7, -3] },
  ionian: { final: 0, tenor: 4, ambitus: [-1, 8], starts: [0, 4, 7] }, hypoionian: { final: 0, tenor: 2, ambitus: [-4, 5], starts: [0, 4, 7, -3] },
  mixolydian: { final: 4, tenor: 4, ambitus: [-1, 8], starts: [0, 4, 7] }, hypomixolydian: { final: 4, tenor: 3, ambitus: [-4, 5], starts: [0, 4, 7, -3] },
  aeolian: { final: 5, tenor: 4, ambitus: [-1, 8], starts: [0, 4, 7] }, hypoaeolian: { final: 5, tenor: 2, ambitus: [-4, 5], starts: [0, 4, 7, -3] },
};
DIATONIC.spacing = 11;

/** Quarter-comma meantone (12 notes, E♭ to G♯): the same scale and rules, the thirds pure. */
export const MEANTONE = {
  ...DIATONIC, name: "diatonic, quarter-comma meantone",
  tuning: { cents: [76.049, 193.157, 310.265, 386.314, 503.422, 579.471, 696.578, 772.627, 889.735, 1006.843, 1082.892, 1200], ref: 261.6255653005986 },
  melodic: DIATONIC.melodic.map((r) => (r.steps === 5 ? { ...r, cents: [790, 830] } : r)),
};

/** A septimal scale in 31-TET: the white keys with B♭ a harmonic seventh above C (7:4, 25 steps of 31), which
 *  sounds as a consonance; and the 7:6 and 7:5 it makes with G and E. */
export const SEPTIMAL31 = {
  ...DIATONIC, name: "septimal, 31-TET",
  tuning: { cents: edo(31), ref: 261.6255653005986 },
  steps: [0, 5, 10, 13, 18, 23, 25],
  names: ["C", "D", "E", "F", "G", "A", "B♭⁷"],
  vertical: { 0: "perfect", 2: "imperfect", 5: "imperfect",
              4: [{ cents: [680, 720], quality: "perfect" }, { else: "dissonant" }],
              6: [{ cents: [950, 985], quality: "imperfect" }, { else: "dissonant" }] },
  melodic: DIATONIC.melodic.map((r) => (r.steps === 5 ? { ...r, cents: [790, 830] } : r)),
  modes: { septimal: { final: 0, tenor: 4, ambitus: [-1, 8], starts: [0, 4, 7] },
           "hypo-septimal": { final: 0, tenor: 2, ambitus: [-4, 5], starts: [0, 4, 7, -3] } },
};

/** The anhemitonic pentatonic (C D E G A of 12-TET): five steps, a step being a 2nd or a minor 3rd. */
export const PENTATONIC = {
  name: "pentatonic, 12-TET",
  tuning: { cents: edo(12), ref: 261.6255653005986 },
  steps: [0, 2, 4, 7, 9],
  names: ["C", "D", "E", "G", "A"],
  intervals: ["unison", "step", "two steps", "three steps", "four steps", "octave"],
  vertical: { 0: "perfect",
              1: [{ cents: [290, 310], quality: "imperfect" }, { else: "dissonant" }],
              2: [{ cents: [390, 410], quality: "imperfect" }, { else: "dissonant" }],
              3: [{ cents: [690, 710], quality: "perfect" }, { cents: [790, 810], quality: "imperfect" }, { else: "dissonant" }],
              4: [{ cents: [890, 910], quality: "imperfect" }, { else: "dissonant" }] },
  melodic: [{ steps: 1 }, { steps: 2 }, { steps: 3, cents: [690, 710], else: "a minor 6th" }, { steps: 5 }],
  wider: "a leap wider than the octave",
  leaps: { small: 2, large: 3 },
  suspensions: { upper: [2, 4], lower: [1], compound: [] },
  cadence: { forbid: [[4, 3]] },
  modes: { "penta-C": { final: 0, tenor: 3, ambitus: [-1, 6], starts: [0, 3, 5] },
           "penta-A": { final: 4, tenor: 3, ambitus: [-1, 6], starts: [0, 3, 5] },
           "penta-D": { final: 1, tenor: 3, ambitus: [-1, 6], starts: [0, 3, 5] } },
  spacing: 8,
};

export const SYSTEMS = { diatonic: DIATONIC, meantone: MEANTONE, septimal31: SEPTIMAL31, pentatonic: PENTATONIC };

/** A system, ready to be asked: its pitches in cents and Hz, the quality of a vertical, the error of a move. */
export function makeSystem(def = DIATONIC) {
  if (def && def.cents && def.quality) return def;          // already made
  const tc = (def.tuning && def.tuning.cents) || DIATONIC.tuning.cents;
  const period = tc[tc.length - 1], all = [0, ...tc.slice(0, -1)];
  const idx = def.steps || all.map((_, i) => i);
  const degs = idx.map((i) => all[i]), N = degs.length;
  const ref = (def.tuning && def.tuning.ref) || 261.6255653005986;
  const octaveOf = (s) => Math.floor(s / N);
  const cents = (s) => octaveOf(s) * period + degs[mod(s, N)];
  const names = def.names || (N === 7 ? DIATONIC.names : degs.map((_, i) => String(i + 1)));
  const inames = def.intervals;
  const intervalName = (s) => (inames && inames[s]) || (N === 7 ? ordinal(s) : `${s}-step`);
  const periodName = def.periodName || (Math.abs(period - 1200) < 1 ? "octave" : "period");
  // the vertical classes: a quality, or one by real size
  const vq = Array.from({ length: N }, (_, c) => {
    const v = def.vertical ? def.vertical[c] : undefined;
    return v === undefined ? (c === 0 ? "perfect" : "dissonant") : v;
  });
  function quality(a, b) {
    const v = vq[mod(Math.abs(b - a), N)];
    if (typeof v === "string") return v;
    const ct = mod(Math.abs(cents(b) - cents(a)), period);
    for (const r of v) if (r.cents && ct >= r.cents[0] - 1e-6 && ct <= r.cents[1] + 1e-6) return r.quality;
    const e = v.find((r) => r.else);
    return e ? e.else : "dissonant";
  }
  const mel = new Map((def.melodic || [{ steps: 1 }, { steps: 2 }]).map((r) => [r.steps, r]));
  const widest = Math.max(...mel.keys());
  function melodicError(a, b) {
    const s = b - a, n = Math.abs(s);
    if (n === 0) return null;
    const r = mel.get(n);
    if (!r) return n > widest && def.wider ? def.wider : `a ${intervalName(n)} is not a melodic interval of the style`;
    if (r.forbid) return r.forbid;
    if (r.up && s < 0) return r.else || `a ${intervalName(n)} only up`;
    if (r.cents) { const c = Math.abs(cents(b) - cents(a)); if (c < r.cents[0] - 1e-6 || c > r.cents[1] + 1e-6) return r.else || `this ${intervalName(n)} is not a melodic interval of the style`; }
    return null;
  }
  const leaps = def.leaps || { small: 3, large: 5 };
  const sus = def.suspensions || { upper: [], lower: [], compound: [] };
  const forbidCadence = ((def.cadence && def.cadence.forbid) || []).map(([x, y]) => [x, y]);
  return {
    def, name: def.name || "system", N, period, ref, degs, octaveOf, cents, quality, melodicError, intervalName, periodName,
    leaps, suspensions: { upper: sus.upper || [], lower: sus.lower || [], compound: sus.compound || [] }, forbidCadence,
    pitchName: (s) => names[mod(s, N)] + (4 + octaveOf(s)),
    hz: (s) => ref * Math.pow(2, cents(s) / 1200),
    midi: (s) => 69 + 12 * Math.log2((ref * Math.pow(2, cents(s) / 1200)) / 440),
  };
}

const D7 = makeSystem(DIATONIC);
// (the diatonic system's functions, as Studies 38–41 exported them)
export const octaveOf = D7.octaveOf;
export const semis = (s) => D7.cents(s) / 100;
export const intervalName = D7.intervalName;
export const quality = D7.quality;
export const melodicError = D7.melodicError;

/** The band of a degree of imitation: "canon", "near", "motion" or "free". */
export function band(s) { return s >= 0.999 ? "canon" : s >= 0.5 ? "near" : s >= 0.2 ? "motion" : "free"; }

const OFF_BY_DEFAULT = new Set(["strict-direct", "syncopation"]);

export function canon(spec) {
  const { tonic, k, d, b = 1, n, lo, hi, spacing = 11 } = spec;
  const phase = spec.phase || 0;      // rests before the dux's first note: an upbeat (anacrusis)
  const maxHold = Math.max(1, spec.maxHold ?? 2);   // the beats a note may last, held
  // the system: its quality, melodic rules, names (the diatonic one unless the spec brings another)
  const S = makeSystem(spec.system || DIATONIC), N7 = S.N;
  const { quality, melodicError, intervalName } = S;
  const clo = spec.clo ?? lo + k, chi = spec.chi ?? hi + k;
  const imitation = spec.imitation ?? 1, bnd = band(imitation);
  const invert = [...(spec.invert || [])].sort((x, y) => x - y);
  const on = (id) => (spec.on && id in spec.on ? !!spec.on[id] : id === "syncopation" ? spec.species === 4 : !OFF_BY_DEFAULT.has(id));
  const starts = spec.starts ? [...spec.starts] : [tonic, tonic + 4, tonic + 7];
  const cstarts = spec.cstarts ? [...spec.cstarts] : starts.map((x) => x + k);
  const finals = [];
  for (let i = -2; i <= 2; i++) { const f = tonic + N7 * i; if (f >= lo && f <= hi) finals.push(f); }
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

  /** The melodic rules of one line: a reason, or null. who: "" for the dux, "the comes: " for the comes. The same
   *  pitch again is the note held (a tie), maxHold beats at most; the other rules look at the notes struck. */
  function melodic(line, t, x, who) {
    const prev = t >= 1 ? line[t - 1] : null;
    if (prev === null || prev === undefined) return null;
    let j = t - 1;                                                    // where the note before began
    while (j >= 1 && line[j - 1] === prev) j--;
    if (x === prev) return t - j >= maxHold ? `${who}a note is held for ${maxHold === 2 ? "two" : maxHold} beats at most` : null;
    if (on("melodic")) { const e = melodicError(prev, x); if (e) return who + e; }
    const a1 = j >= 1 ? line[j - 1] : null;                           // the note struck before it
    if (on("leap-recovery") && a1 !== null && a1 !== undefined) {
      const m = prev - a1, s = x - prev;
      if (Math.abs(m) >= S.leaps.large && s !== -sign(m)) return `${who}after a leap of a ${intervalName(Math.abs(m))}, a step ${m > 0 ? "down" : "up"}`;
      if (Math.abs(m) >= S.leaps.small && Math.abs(m) < S.leaps.large && sign(s) !== -sign(m))
        return `${who}after the leap of a ${intervalName(Math.abs(m))} the line turns ${m > 0 ? "down" : "up"}`;
    }
    return null;
  }

  /** Which voice holds its note at t (from t-1): "dux", "comes", or null (none, or both). */
  const holder = (D, C, t) => {
    if (t < 1 || C[t] === null || C[t - 1] === null) return null;
    const hd = D[t] === D[t - 1], hc = C[t] === C[t - 1];
    return hd && !hc ? "dux" : hc && !hd ? "comes" : null;
  };
  /** Whether the vertical at t (already in D, C) is a suspension: a dissonance on a strong beat, held by one voice. */
  const suspensionAt = (D, C, t) => b > 1 && t >= 1 && strong(t) && C[t] !== null && dissonant(D[t], C[t]) && holder(D, C, t) !== null;

  /** The rules of the dux alone for its note x at time t = D.length: a reason, or null. */
  function checkDux(D, C, x) {
    const t = D.length;
    if (t >= n) return "the work is finished";
    if (on("range") && (x < lo || x > hi)) return "out of range";
    if (on("start") && t === 0 && !starts.includes(x)) return "the dux starts on the final, its 5th, its octave or the 4th below";
    const e = melodic(D, t, x, ""); if (e) return e;
    if (on("final") && t === n - 1 && !finals.includes(x)) return "the dux ends on the final";
    if (on("approach") && t === n - 2 && !finals.some((f) => Math.abs(x - f) === 1)) return "the final is approached by step";
    // fourth species: the dux is the cantus firmus, a note a bar (struck on the strong beat, held on the weak one)
    if (on("syncopation") && b === 2 && t >= 1) {
      if (strong(t) && x === D[t - 1]) return "fourth species: the cantus firmus moves on every strong beat";
      if (!strong(t) && x !== D[t - 1]) return "fourth species: the cantus firmus holds its note for the whole bar";
    }
    // a suspension just before resolves: the voice that held it goes down a step
    if (t >= 2 && suspensionAt(D, C, t - 1)) {
      if (holder(D, C, t - 1) === "dux" && x !== D[t - 1] - 1) return "the suspension resolves down by step (the dux)";
    } else if (on("weak-dissonance") && t >= 1 && C[t - 1] !== null && dissonant(D[t - 1], C[t - 1]) && Math.abs(x - D[t - 1]) !== 1)
      // a dissonance just before is left by step (the dux's part of it)
      return "the dissonance before is left by step (the dux)";
    return null;
  }

  /** Why a dissonance on a strong beat is not a suspension that may stand (null when it may): true when the rules
   *  of suspensions are off or there is nothing held; otherwise the reason, in words. */
  function suspensionError(N, l, h, f, pl0, ph0, hasPrev, held, heldLower0, t) {
    if (!on("suspension") || b === 1) return true;
    if (!hasPrev || !held) return "not held from the beat before";
    const [pl, ph] = f(pl0, ph0);
    if (ph < pl || quality(pl, ph) === "dissonant") return "a suspension is prepared by a consonance";
    if (t >= n - 1) return "a suspension needs a beat to resolve";
    if (on("suspension-kinds")) {
      const lower = N ? !heldLower0 : heldLower0, cls = mod(h - l, N7), K = S.suspensions;
      const list = (cs) => cs.map((c) => intervalName(c + (K.compound.includes(c) ? N7 : 0))).join(", ") || "none";
      if (lower && !K.lower.includes(cls)) return N7 === 7 && cls === 3 ? "a 4th in the lower voice would resolve to a 5th (4-5)" : `held in the lower voice, only: ${list(K.lower)}`;
      if (!lower && K.compound.includes(cls) && h - l < N7) return `a ${intervalName(cls)} in the upper voice would resolve to the unison`;
      if (!lower && !K.upper.includes(cls)) return `held in the upper voice, only: ${list(K.upper)}`;
    }
    return null;
  }

  /** The rules of the comes, and between the voices, for the pair (x, c) at t (x already passed checkDux). */
  function checkPair(D, C, x, c) {
    const t = D.length;
    if (t < d) return c === null ? null : "the comes has not entered yet";
    if (c === null) return "the comes sounds from its entry on";
    if (on("range") && (c < clo || c > chi)) return "the comes: out of range";
    const m = model(D, t);
    // (in fourth species the comes strikes its last note, the final: there the canon breaks off into its cadence)
    const cadence = on("syncopation") && b === 2 && t === n - 1;
    if (bnd === "canon" && c !== m && !cadence) return "a canon: the comes is the dux's note";
    if (bnd === "near" && Math.abs(c - m) > 2) return "the comes keeps within a 3rd of the dux's note";
    if (on("start") && t === d && !cstarts.includes(c)) return "the comes enters on the final, its 5th, its octave or the 4th below (shifted)";
    // fourth species: the comes is syncopated, holding its note over the strong beats (and striking the final)
    if (on("syncopation") && b === 2 && t > d) {
      if (strong(t) && t < n - 1 && c !== C[t - 1]) return "fourth species: the comes holds its note over the strong beat";
      if ((!strong(t) || t === n - 1) && c === C[t - 1]) return "fourth species: the comes strikes a new note on the weak beat";
    }
    const e = melodic(C, t, c, "the comes: "); if (e) return e;
    const prev = t >= 1 ? D[t - 1] : null, pc = t >= 1 ? C[t - 1] : null;
    const resolving = t >= 2 && suspensionAt(D, C, t - 1);
    if (resolving) {
      if (holder(D, C, t - 1) === "comes" && c !== pc - 1) return "the suspension resolves down by step (the comes)";
    } else if (on("weak-dissonance") && pc !== null && dissonant(prev, pc) && Math.abs(c - pc) !== 1)
      return "the dissonance before is left by step (the comes)";
    // between the voices
    if (on("no-crossing") && k !== 0) { const [l, h] = lowerFirst(x, c); if (l > h) return "the voices cross"; }
    if (on("spacing") && Math.abs(x - c) > spacing) return `more than a ${intervalName(spacing)} apart`;
    const [l0, h0] = lowerFirst(x, c);
    const hasPrev = pc !== null;
    const [pl0, ph0] = hasPrev ? lowerFirst(prev, pc) : [0, 0];
    const sb = b > 1 && strong(t) && t - b >= 0 && C[t - b] !== null ? lowerFirst(D[t - b], C[t - b]) : null;
    // a suspension here: one voice holds its note (from a consonance before), the other moves
    const hd = hasPrev && x === prev, hc = hasPrev && c === pc;
    const held = hd !== hc ? (hd ? "dux" : "comes") : null;
    const heldLower0 = held && (k > 0 ? held === "dux" : held === "comes");
    let diss = false, unsuspended = null;
    for (const [N, f] of transforms) {
      const [l, h] = f(l0, h0);
      if (N && h < l) return `${label(N)}the voices would cross (wider than the ${intervalName(N - 1)})`;
      const q = quality(l, h), cls = mod(h - l, N7);
      if (q === "dissonant") {
        diss = true;
        if (on("consonance") && strong(t)) {
          const why = suspensionError(N, l, h, f, pl0, ph0, hasPrev, held, heldLower0, t);
          if (why) unsuspended = unsuspended || `${label(N)}a ${intervalName(cls)} (dissonant)${b > 1 ? " on a strong beat" : ""}${why === true ? "" : ": " + why}`;
        }
      }
      if (hasPrev) {
        const [pl, ph] = f(pl0, ph0);
        if (on("parallels") && q === "perfect" && quality(pl, ph) === "perfect" && mod(ph - pl, N7) === cls && (pl !== l || ph !== h))
          return label(N) + "parallel " + (cls === 0 ? S.periodName : intervalName(cls)) + "s";
        const dl = l - pl, dh = h - ph;
        if (on("direct-octaves") && cls === 0 && dl !== 0 && sign(dl) === sign(dh) && (on("strict-direct") || Math.abs(dh) !== 1))
          return `${label(N)}${l === h ? "a unison" : intervalName(h - l)} by direct motion`;
      }
      if (sb && on("strong-parallels") && q === "perfect") {
        const [sl, sh] = f(sb[0], sb[1]);
        if (quality(sl, sh) === "perfect" && mod(sh - sl, N7) === cls && (sl !== l || sh !== h))
          return label(N) + (cls === 0 ? S.periodName : intervalName(cls)) + "s on consecutive strong beats";
      }
    }
    if (unsuspended) return unsuspended;
    if (resolving && diss) return "the suspension resolves to a consonance";
    if (diss && b > 1 && strong(t) && on("consonance")) {
      if (t === n - 1) return "the work does not end on a dissonance";
    } else if (diss && b > 1 && on("weak-dissonance")) {
      if (Math.abs(x - prev) !== 1) return "a dissonance on a weak beat: the dux comes to it by step";
      if (!hasPrev) return "the comes cannot enter on a dissonance";
      if (Math.abs(c - pc) !== 1) return "a dissonance on a weak beat: the comes comes to it by step";
      if (dissonant(prev, pc)) return "two dissonances in a row";
      if (t === n - 1) return "the work does not end on a dissonance";
    }
    if (on("entry-unison") && t === d && x === c) return "the comes does not enter on the unison";
    if (on("final") && t === n - 1 && quality(x, c) !== "perfect") return "the last vertical is a perfect consonance";
    if (on("cadence") && t === n - 1 && hasPrev) {
      const to = mod(h0 - l0, N7), from = mod(ph0 - pl0, N7);
      if (S.forbidCadence.some(([x, y]) => x === from && y === to)) return `the cadence does not go from a ${intervalName(from)} to a ${intervalName(to)}`;
    }
    return null;
  }

  const comesChoices = (t) => {
    if (t < d) return [null];
    const out = [];
    for (let c = clo; c <= chi; c++) out.push(c);
    return out;
  };

  // ─── the count over pairs ───
  // the notes the rules look back at: a note held (maxHold beats at most) and the note struck before it
  const LD = Math.max(maxHold + 1, b, bnd === "canon" || bnd === "near" ? d : 0);
  const LC = Math.max(maxHold + 1, b);
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
  /** What each dissonance is, by time: null or {dux, comes} as "passing", "neighbour", "dissonant", or, for a
   *  suspension, "suspension" (the voice that holds it) and "moving" (the other). */
  function roles(D, C) {
    const out = [];
    for (let t = 0; t < D.length; t++) {
      const x = D[t], c = C[t];
      if (c === null || !dissonant(x, c)) { out.push(null); continue; }
      if (suspensionAt(D, C, t)) { const h = holder(D, C, t); out.push({ dux: h === "dux" ? "suspension" : "moving", comes: h === "comes" ? "suspension" : "moving" }); continue; }
      const role = (a, m, z) => (a === null || a === undefined || z === null || z === undefined ? "dissonant" : sign(m - a) === sign(z - m) ? "passing" : "neighbour");
      out.push({ dux: role(D[t - 1], x, D[t + 1]), comes: role(C[t - 1], c, C[t + 1]) });
    }
    return out;
  }
  return { spec, band: bnd, checkDux, checkPair, count, countAsync, fanDux, fanComes, roles, dissonant, strong, model,
           finals, lowerFirst, memo, window: [LD, LC], suspensionAt, holder, system: S };
}
