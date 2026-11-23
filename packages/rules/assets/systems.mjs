// SPDX-License-Identifier: MPL-2.0
// @kairotic/rules · systems.mjs: a system as data — a tuning, the steps of a scale in it, what its intervals are
// (vertical qualities, melodic intervals, leaps, suspensions, cadences, canons) — as @kairotic/cac's counterpoint.mjs
// (the comes) has them, where they came from: the diatonic one of Studies 38–41, meantone, a septimal scale in 31-TET,
// the pentatonic. tests/rules.mjs checks they stay the same as counterpoint.mjs's until it reads them from here.

import { keyOf, codeOf3, codeDegree, codeAlter } from "./tonal.mjs";

const mod = (a, m) => ((a % m) + m) % m;

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

// ─── one tonal layer for both worlds: a key (tonal.mjs's, the partimento's) as a system (the comes's) ───

/**
 * A key ({tonic, mode}: major, minor or a church mode) as a system the comes can sing in: a pitch is a code of the
 * key (3·degree + alteration + 1, degree 0 its tonic), the notes of its scale and, where the mode allows, its musica
 * ficta (ficta: false, the scale alone); what an interval is, by the degrees it spans and its real size in semitones,
 * as the diatonic system has it (the 5th perfect only when it is one, an altered unison or octave a false relation);
 * the melodic intervals as Fux's (no augmented 2nd, no tritone, the minor 6th up only, no 7th, a chromatic step
 * never). A system made so answers deg (a pitch's degree, the steps the rules count), alt, shift (a pitch moved by
 * steps, its alteration kept), codesIn (the pitches from one degree to another) and key.
 */
export function keySystem(key, { ficta = true } = {}) {
  const K = keyOf(key), N = 7;
  const deg = codeDegree, alt = codeAlter, semi = (c) => K.semi(deg(c), alt(c));
  const base = makeSystem(DIATONIC);
  const quality = (a, b) => {
    const [l, h] = deg(a) <= deg(b) ? [a, b] : [b, a];
    const cls = mod(deg(h) - deg(l), N), s = mod(semi(h) - semi(l), 12);
    if (cls === 0) return s === 0 ? "perfect" : "dissonant";
    if (cls === 4) return s === 7 ? "perfect" : "dissonant";
    if (cls === 2) return s === 3 || s === 4 ? "imperfect" : "dissonant";
    if (cls === 5) return s === 8 || s === 9 ? "imperfect" : "dissonant";
    return "dissonant";
  };
  const ordinalName = base.intervalName;
  function melodicError(a, b) {
    const n = Math.abs(deg(b) - deg(a)), up = deg(b) > deg(a), s = Math.abs(semi(b) - semi(a));
    if (n === 0) return a === b ? null : "a chromatic step";
    if (n === 1) return s <= 2 ? null : "an augmented 2nd";
    if (n === 2) return s === 3 || s === 4 ? null : "this 3rd";
    if (n === 3) return s === 5 ? null : "an augmented 4th (tritone)";
    if (n === 4) return s === 7 ? null : "a diminished 5th (tritone)";
    if (n === 5) return up && s === 8 ? null : "a 6th (only the minor 6th up)";
    if (n === 6) return "a 7th";
    if (n === 7) return s === 12 ? null : "this octave";
    return "a leap wider than the octave";
  }
  const alters = (d) => { const f = ficta ? K.ficta(d) : 0; return f ? [0, f] : [0]; };
  const codesIn = (lo, hi) => { const out = []; for (let d = lo; d <= hi; d++) for (const a of alters(d)) out.push(codeOf3(d, a)); return out; };
  return {
    def: { name: `${K.tonic} ${K.mode}`, key }, name: `${K.tonic} ${K.mode}`, N, period: 1200, key: K, ficta,
    deg, alt, shift: (c, steps) => codeOf3(deg(c) + steps, alt(c)), codesIn, at: (d) => codeOf3(d, 0),
    cents: (c) => 100 * semi(c), quality, melodicError, intervalName: ordinalName, periodName: "octave",
    leaps: base.leaps, suspensions: base.suspensions, forbidCadence: base.forbidCadence,
    pitchName: (c) => K.name(deg(c), alt(c)), midi: (c) => K.midi(deg(c), alt(c)), hz: (c) => K.hz(deg(c), alt(c)),
  };
}
