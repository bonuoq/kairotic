// SPDX-License-Identifier: MPL-2.0
// @kairotic/theory · counterpoint.mjs: the canon box's counterpoint, two voices note by note (discussion #172).
//
// The kernel is Study 43's (studies/43-mirrors/kairotic/kernel.mjs, copied as it is: the hard rules of meter,
// dissonance and the mode for each voice and between them, ties and suspensions, fourth species, the system as
// data, the degree of imitation, the comes inverted or augmented, the futures counted exactly over pairs). After it, what the box adds for playing (`live`): the soft
// rules of Study 41 as costs, the mode as a spec, and a note asked for (a pitch, any key) corrected to the nearest
// legal note with a future.
//
// A pitch is a diatonic step on the white keys, 0 = C4; the box speaks MIDI and Hz.
//
// ─────────────────────────────── the kernel (Study 43) ───────────────────────────────

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
//   canon       {at: [the distances in steps at which the comes may imitate], invertible: [n…]: the inversions
//               the counterpoint may be asked to stand (the lower voice taken up n-1 steps)}

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
// the canon: at which distances (steps) the comes may imitate, and at which intervals the counterpoint may be
// asked to be invertible (n: the lower voice taken up n-1 steps, as at the octave 8, the 10th 10, the 12th 12)
DIATONIC.canon = { at: [-7, 7, 0, -4, 4, -3, 3], invertible: [8, 10, 12] };

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
  // (the comes may also imitate at the harmonic seventh, here a consonance)
  canon: { at: [-7, 7, 0, -4, 4, -3, 3, -6, 6], invertible: [8, 10, 12] },
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
  canon: { at: [-5, 5, 0, -3, 3, -2, 2], invertible: [6, 8] },
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
  // the transformation of the canon (Study 43): the comes is the dux's note, upside down about an axis
  // (inversion), or held twice as long (augmentation: each note of the dux m beats of the comes)
  const tf = spec.transform || {};
  const inv = tf.kind === "inversion", aug = tf.kind === "augmentation" ? Math.max(2, Math.round(tf.m || 2)) : 1;
  const axisT = tf.axis ?? tonic;
  const Tx = (x) => (inv ? 2 * axisT - x : x) + k;
  const [tlo, thi] = [Tx(lo), Tx(hi)].sort((a, z) => a - z);
  const clo = spec.clo ?? tlo, chi = spec.chi ?? thi;
  const imitation = spec.imitation ?? 1, bnd = band(imitation);
  const invert = [...(spec.invert || [])].sort((x, y) => x - y);
  const on = (id) => (spec.on && id in spec.on ? !!spec.on[id] : id === "syncopation" ? spec.species === 4 : !OFF_BY_DEFAULT.has(id));
  const starts = spec.starts ? [...spec.starts] : [tonic, tonic + 4, tonic + 7];
  const cstarts = spec.cstarts ? [...spec.cstarts] : starts.map(Tx);
  const finals = [];
  for (let i = -2; i <= 2; i++) { const f = tonic + N7 * i; if (f >= lo && f <= hi) finals.push(f); }
  const strong = (t) => (t + phase) % b === 0;
  const lowerFirst = (x, c) => (k > 0 ? [x, c] : [c, x]);
  const transforms = [[null, (a, z) => [a, z]], ...invert.map((N) => [N, (a, z) => [z, a + N - 1]])];
  const label = (N) => (N ? `under inversion at the ${intervalName(N - 1)}: ` : "");
  /** The comes's note in a strict canon at time t (the dux's, d beats before, k steps away, transformed), or null. */
  const source = (t) => (t - d >= 0 ? Math.floor((t - d) / aug) : null);
  const model = (D, t) => { const i = source(t); return i !== null && i < D.length ? Tx(D[i]) : null; };

  function dissonant(x, c) {
    const [l0, h0] = lowerFirst(x, c);
    for (const [, f] of transforms) { const [l, h] = f(l0, h0); if (h >= l && quality(l, h) === "dissonant") return true; }
    return false;
  }

  /** The melodic rules of one line: a reason, or null. who: "" for the dux, "the comes: " for the comes. The same
   *  pitch again is the note held (a tie), maxHold beats at most; the other rules look at the notes struck. */
  function melodic(line, t, x, who, hold = maxHold) {
    const prev = t >= 1 ? line[t - 1] : null;
    if (prev === null || prev === undefined) return null;
    let j = t - 1;                                                    // where the note before began
    while (j >= 1 && line[j - 1] === prev) j--;
    if (x === prev) return t - j >= hold ? `${who}a note is held for ${hold === 2 ? "two" : hold} beats at most` : null;
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
    const e = melodic(C, t, c, "the comes: ", maxHold * aug); if (e) return e;
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
  const LC = Math.max(maxHold * aug + 1, b);
  // (in an augmentation the comes reaches further back into the dux, the further the work goes)
  const fromD = (t) => Math.max(0, aug > 1 && (bnd === "canon" || bnd === "near") ? Math.min(t - LD, Math.floor((t - d) / aug)) : t - LD);
  const memo = new Map();
  const W = Math.max(hi, chi) - Math.min(lo, clo) + 2, base = Math.min(lo, clo) - 1;
  function key(D, C, t) {
    const f = fromD(t), g = Math.max(0, t - LC);
    // a number while it fits in a double exactly; else a string (a long augmentation)
    if ((t - f + t - g) * Math.log2(W) < 46) {
      let code = t;
      for (let j = f; j < t; j++) code = code * W + (D[j] - base);
      for (let j = g; j < t; j++) code = code * W + (C[j] === null ? 0 : C[j] - base);
      return code;
    }
    return t + ":" + D.slice(f, t).join(",") + ":" + C.slice(g, t).join(",");
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

// ─────────────────────────────── live: the canon box ───────────────────────────────

/** The modes on the white keys (Study 39): the final, the tenor in steps above it, authentic or plagal. */
export const MODES = {
  dorian: { final: 1, tenor: 4, plagal: false }, hypodorian: { final: 1, tenor: 2, plagal: true },
  ionian: { final: 0, tenor: 4, plagal: false }, hypoionian: { final: 0, tenor: 2, plagal: true },
  mixolydian: { final: 4, tenor: 4, plagal: false }, hypomixolydian: { final: 4, tenor: 3, plagal: true },
  aeolian: { final: 5, tenor: 4, plagal: false }, hypoaeolian: { final: 5, tenor: 2, plagal: true },
};

/** The soft rules of Study 41 and their weights (kairotic/canon.cljs there). */
export const WEIGHTS = {
  "leap-size": 1, tie: 1.5, "suspension-life": 1.5, "contrary-after-leap": 1.2, "step-back": 1.2, "leap-after-leap": 0.6, return: 1,
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
 * A canon to play live, note by note. o: {mode, k, d, beats, bars, upbeat, imitation, species, maxHold, spacing,
 * invert, on, weights} (the defaults: dorian, the comes an octave below, 3 beats later, 2/2, 8 bars, no upbeat, a
 * strict canon, second species with ties; species 4: the dux a cantus firmus, the comes syncopated; maxHold: the
 * beats a note may be held, 2).
 * D, C as in the kernel: the dux and the comes so far.
 */
export function live(o = {}) {
  // the system (Study 42) and a mode of it. A box's words name them in any order ("pentatonic penta-A", "dorian"):
  // a word that is a key of SYSTEMS is the system, the other the mode; a system may also come as data (EDN)
  const given = o.system && typeof o.system === "object" ? o.system : null;
  const words = [o.mode, o.system].filter((w) => typeof w === "string" && w);
  const sysWord = given ? null : words.find((w) => SYSTEMS[w]);
  const modeWord = words.find((w) => !SYSTEMS[w]);
  const sysdef = given || (sysWord ? SYSTEMS[sysWord] : DIATONIC);
  const systemName = given ? given.name || "a system given as data" : sysWord || "diatonic";
  const S = makeSystem(sysdef), N = S.N;
  const { quality, intervalName, pitchName } = S;
  const semis = (s) => S.cents(s) / 100, P = S.period / 100;
  const midiOf = (s) => 60 + semis(s) + 12 * Math.log2(S.ref / 261.6255653005986);
  // its modes: the final, the tenor (steps above it), the ambitus and the starts (steps from the final)
  const MS = sysdef.modes || { [sysdef.name || "system"]: { final: 0, tenor: Math.round((4 * N) / 7), ambitus: [-1, N + 1], starts: [0] } };
  const mode = MS[modeWord] ? modeWord : Object.keys(MS)[0], M = MS[mode];
  // a mode asked for that the system does not have: its first mode, and why
  const modeNote = modeWord && !MS[modeWord] ? `${modeWord} is not a mode of ${systemName} (${Object.keys(MS).join(", ")}): ${mode}` : null;
  const tonic = M.final, tenor = tonic + M.tenor;
  const [a0, z0] = M.ambitus || [-1, N + 1];
  const lo = tonic + a0, hi = tonic + z0;
  const b = Math.max(1, Math.round(o.beats ?? 2));
  const phase = Math.max(0, Math.min(b - 1, Math.round(o.upbeat ?? 0)));
  const bars = Math.min(o.transform === "augmentation" ? 6 : 99, Math.max(2, Math.round(o.bars ?? 8)));
  const n = b * (bars - 1) + 1 - phase;
  // the distance of the imitation: one the system allows (an octave asked of a system of other than 7 steps is its period)
  const at = (sysdef.canon && sysdef.canon.at) || [-N, N, 0];
  let k = Math.round(o.k ?? -N);
  if (!at.includes(k) && N !== 7 && k % 7 === 0) k = (k / 7) * N;
  const d = Math.max(1, Math.round(o.d ?? 3));
  const imitation = o.transform === "augmentation" ? 1 : Math.max(0, Math.min(1, o.imitation ?? 1));
  const starts = (M.starts || [0]).map((x) => tonic + x).filter((x) => x >= lo && x <= hi);
  const species = o.species === 4 && b === 2 ? 4 : 2;
  const maxHold = Math.max(1, Math.round(o.maxHold ?? 2));
  // the transformation: inversion about an axis (a MIDI note, the final by default), or augmentation (twice as
  // slow: a strict canon, and not longer than 6 bars, so that its futures can still be counted)
  const kind = ["inversion", "augmentation"].includes(o.transform) ? o.transform : "canon";
  const axisStep = (() => {
    if (o.axis === undefined || o.axis === null) return tonic;
    let best = tonic;
    for (let s = lo - N; s <= hi + N; s++) if (Math.abs(midiOf(s) - o.axis) < Math.abs(midiOf(best) - o.axis)) best = s;
    return best;
  })();
  // the fifth of the system (for direct fifths): the class nearest 702 cents
  const fifth = S.degs.reduce((bi, c, i) => (Math.abs(c - 702) < Math.abs(S.degs[bi] - 702) ? i : bi), 0);
  const spec = { tonic, k, d, b, phase, n, lo, hi, spacing: o.spacing ?? sysdef.spacing ?? 11, invert: o.invert || [], starts, imitation, species, maxHold,
                 on: o.on || {}, system: sysdef, transform: { kind, axis: axisStep, m: 2 } };
  const K = canon(spec);
  const w = { ...WEIGHTS, ...(o.weights || {}) };
  const strong = (t) => (t + phase) % b === 0;

  /** The soft cost of x after a line (its own shape), by rule; modal: whether the mode's notes count (the dux). */
  function melodicParts(line, x, t, modal) {
    const parts = {}, prev = line.length ? line[line.length - 1] : null;
    if (modal && (mod(x, N) === mod(tonic, N) || mod(x, N) === mod(tenor, N))) parts.modal = -(w.modal * (b > 1 && strong(t) ? 1.5 : 1));
    if (prev === null) return clean(parts);
    if (x === prev) { parts.tie = w.tie; return clean(parts); }
    // the rest on the notes struck: a note held is one note
    line = line.filter((y, i) => i === 0 || y !== line[i - 1]);
    const tl2 = line.length, m2 = tl2 >= 2 ? prev - line[tl2 - 2] : null;
    return struck(line, x, m2, parts);
  }
  function struck(line, x, m, parts) {
    const tl = line.length, prev = line[tl - 1];
    const s = x - prev, nn = Math.abs(s), all = [...line, x];
    const mv = []; for (let i = 1; i < tl; i++) mv.push(line[i] - line[i - 1]); mv.push(s);
    const L = mv.length;
    if (nn > 0) parts["leap-size"] = w["leap-size"] * (LEAP[nn] ?? 1.5);
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
      const cls = mod(h - l, N);
      if (quality(l, h) === "perfect" && cls === fifth && cls !== 0) parts["direct-perfect"] = w["direct-perfect"];
      let run = 1;
      for (let i = t - 1; i >= 1; i--) {
        const p = D[i], q = C[i], p0 = D[i - 1], q0 = C[i - 1];
        if (q === null || q0 === null) break;
        const [ll, hh] = K.lowerFirst(p, q);
        if (quality(ll, hh) === "imperfect" && mod(hh - ll, N) === cls && sign(p - p0) === sign(q - q0) && p !== p0) run++; else break;
      }
      if (quality(l, h) === "imperfect" && run > 3) parts["imperfect-run"] = w["imperfect-run"];
    }
    if (b > 1 && !strong(t) && K.dissonant(x, c)) parts.passing = -w.passing;
    if (K.suspensionAt([...D, x], [...C, c], t)) parts["suspension-life"] = -w["suspension-life"];
    if (t >= 2) {
      const vc = (i) => (C[i] === null ? null : mod(Math.abs(D[i] - C[i]), N));
      const iv = mod(Math.abs(x - c), N), i1 = vc(t - 1), i2 = vc(t - 2);
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
  /** A choice among candidates by cost: at temperature 0 (or without a random number r in [0, 1)) the cheapest;
   *  above it a softmax of -cost/temperature, drawn with r. */
  function softPick(cands, cost, temp, r) {
    const cs = cands.slice().sort((p, q) => cost(p) - cost(q) || (p.note ?? -100) - (q.note ?? -100));
    if (!cs.length || !(temp > 0.001) || r === undefined || r === null) return cs[0] || null;
    const m = cost(cs[0]), ws = cs.map((c) => Math.exp((m - cost(c)) / temp)), x = r * ws.reduce((a, v) => a + v, 0);
    let acc = 0;
    for (let j = 0; j < cs.length; j++) { acc += ws[j]; if (x < acc) return cs[j]; }
    return cs[cs.length - 1];
  }

  /** The comes's note with the dux's x next: the cheapest (at temperature 0), or one drawn by temp with r. */
  function bestComes(D, C, x, temp = 0, r = null) {
    const cands = [];
    for (const e of K.fanComes(D, C, x)) {
      if (e.reason || !(e.futures > 0)) continue;
      const parts = pairParts(D, C, x, e.note);
      cands.push({ note: e.note, futures: e.futures, cost: total(parts), parts });
    }
    return softPick(cands, (c) => c.cost, temp, r);
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
  function play(D, C, asked, opt = {}) {
    if (D.length >= n) return null;
    const F = fan(D, C), ok = F.filter((e) => e.futures > 0);
    if (!ok.length) return null;
    const r = Math.round(asked);
    let a = asked;
    const sl = semis(lo), sh = semis(hi);
    while (a < sl - P / 2) a += P;
    while (a > sh + P / 2) a -= P;
    const best = ok.slice().sort((p, q) => Math.abs(semis(p.note) - a) - Math.abs(semis(q.note) - a) || p.score - q.score || p.note - q.note)[0];
    // the step the key asked for: a note of the system within a quarter of a tone or so (a key of 12 for a tuning of another)
    const near = (x) => { let s0 = null; for (let s = lo - 2 * N; s <= hi + 2 * N; s++) if (Math.abs(semis(s) - x) < 0.45 && (s0 === null || Math.abs(semis(s) - x) < Math.abs(semis(s0) - x))) s0 = s; return s0; };
    const step = near(asked);
    let reason = null;
    if (best.note !== step) {
      const e = step === null ? null : F.find((f) => f.note === step);
      reason = step === null ? `${midiName(60 + r)} is not a note of the system (${systemName})`
        : !e ? `${pitchName(step)} is out of the range (${pitchName(lo)}–${pitchName(hi)}): taken by octaves`
        : e.reason ? e.reason
        : "no way to finish the canon from it";
    }
    // the comes: the cheapest (as the futuribles say, :comes), or with a temperature one drawn among those with a future
    const comes = opt.temp > 0.001 && opt.r !== undefined ? bestComes(D, C, best.note, opt.temp, opt.r).note : best.comes;
    return { note: best.note, comes, asked: r, corrected: reason !== null, reason, futures: best.futures, score: best.score, fan: F };
  }

  /** The note before held over the beat (a tie), as play gives it: when it may not be held, the nearest that can. */
  function hold(D, C, opt = {}) {
    if (!D.length) return null;
    const r = play(D, C, semis(D[D.length - 1]), opt);
    if (r && r.corrected) r.reason = `${pitchName(D[D.length - 1])} cannot be held: ${r.reason}`;
    return r;
  }

  /** The engine's own next pair, as play gives it, or null: the most plausible, or with opt {temp, r, r2} the
   *  dux's note drawn by temp with r among the futuribles (by their score), the comes's with r2. */
  function engine(D, C, opt = {}) {
    const f = softPick(futuribles(D, C), (c) => c.score, opt.temp, opt.r);
    return f ? play(D, C, semis(f.note), { temp: opt.temp, r: opt.r2 }) : null;
  }

  /** The debts pending at this point, in words. */
  function obligations(D, C) {
    const t = D.length, out = [], prev = t ? D[t - 1] : null, pc = t ? C[t - 1] : null;
    if (t >= n) return out;
    if (t >= 2 && K.suspensionAt(D, C, t - 1)) out.push(`resolve the suspension: ${K.holder(D, C, t - 1) === "dux" ? "the dux" : "the comes"} a step down`);
    else if (prev !== null && pc !== null && K.dissonant(prev, pc)) out.push("leave the dissonance by step, in both voices");
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
    spec, mode, n, bars, beats: b, species, transform: kind, axis: axisStep, kernel: K, lo, hi, tonic, tenor, strong, fan, futuribles, play, hold, engine, obligations,
    pairParts, melodicParts, midi: midiOf, name: pitchName, semis, hz: S.hz, system: S, systemName, modes: Object.keys(MS), modeNote, N, k,
    count: (D, C) => K.count(D, C),
    bits: (D, C) => bitsOf(K.count(D, C)),
    /** The count from the start, a few milliseconds at a time: after it every legal point is counted. */
    warm: (opts) => K.countAsync([], [], opts || {}),
  };
}

// api/import-module hands a component the default export
export default { live, canon, band, MODES, WEIGHTS, semis, pitchName, midiOf, midiName, semisOfHz, quality, intervalName };
