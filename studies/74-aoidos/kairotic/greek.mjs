// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 74 · aoidos: the Greek pitch system as data — the Immutable System (the Greater Perfect System of
// two octaves and its conjunct synemmenon tetrachord), its fifteen tonoi, the three genera and their shades — answering
// what keySystem (systems.mjs) answers for a church mode, so that a melody, a comes or an aulos can be written in it.
//
// The system is built of tetrachords: two fixed notes a fourth apart and two movable ones between them, whose places
// make the genus — diatonic, chromatic, enharmonic — in the shade of a theorist: Aristoxenus (Elementa harmonica II,
// in his units: a tone 200 cents, a fourth 500; the tonic chromatic and the syntonic diatonic) or Archytas (as Ptolemy
// reports his ratios: Harmonics I.13). A note is named by its place (lichanos meson, trite synemmenon…) and counted by
// its degree: the steps of the system by place, from the mese (0) down to the proslambanomenos (−7) and up to the nete
// hyperbolaion (7) — so a chromatic lichanos is a step below the mese however far it lies (a minor third, an
// "augmented second" in Fux's eyes), and the synemmenon tetrachord's notes share degrees with the diezeugmenon's (its
// trite a semitone below the paramese, at degree 1 as it is). A code is 16·degree + the note's variant at its degree.
//
// What sounds together is judged as the Greeks heard it: concords (symphoniai) are the unison, the fourth, the fifth
// and the octave; every other interval — thirds and sixths included — is a discord. A move is judged by its size: any
// within a fourth, the fifth, the sixths and the octave; never a tritone, a seventh or more than an octave. A note
// changed in place (a genus or the conjunct tetrachord taken instead: the Delphic paeans' d♭'–d') is a modulation,
// allowed.
//
// The tonoi a semitone apart, as Alypius lists them; in the transcription's register (DAGM's: Lydian with its mese on
// a, MIDI 69 — Mesomedes's hymns; Iastian on f♯ — Seikilos's song; Phrygian on g).

const mod = (a, m) => ((a % m) + m) % m;
const ratio = (r) => 1200 * Math.log2(r);

/** The tonoi: the mese's distance in semitones from the Lydian's (a). */
export const TONOI = {
  hypodorian: -9, hypoiastian: -8, hypophrygian: -7, hypoaiolian: -6, hypolydian: -5,
  dorian: -4, iastian: -3, phrygian: -2, aiolian: -1, lydian: 0,
  hyperdorian: 1, hyperiastian: 2, hyperphrygian: 3, hyperaiolian: 4, hyperlydian: 5,
};

/** The genera in each theorist's shade: a tetrachord's three intervals, low to high, in cents. */
export const SHADES = {
  aristoxenus: { tone: 200, fourth: 500,
    divisions: { enharmonic: [50, 50, 400], chromatic: [100, 100, 300], diatonic: [100, 200, 200] },
    // (his other shades, to ask for by name: the soft and hemiolic chromatic, the soft diatonic)
    others: { "soft chromatic": [200 / 3, 200 / 3, 1100 / 3], "hemiolic chromatic": [75, 75, 350], "soft diatonic": [100, 150, 250] } },
  archytas: { tone: ratio(9 / 8), fourth: ratio(4 / 3),
    divisions: { enharmonic: [28 / 27, 36 / 35, 5 / 4].map(ratio), chromatic: [28 / 27, 243 / 224, 32 / 27].map(ratio), diatonic: [28 / 27, 8 / 7, 9 / 8].map(ratio) } },
};

export const GENERA = ["enharmonic", "chromatic", "diatonic"];

// the tetrachords of the Immutable System: their lower fixed note's degree, and the names of their four notes
const TETRACHORDS = [
  { id: "hypaton", low: -6, names: ["hypate hypaton", "parhypate hypaton", "lichanos hypaton", "hypate meson"] },
  { id: "meson", low: -3, names: ["hypate meson", "parhypate meson", "lichanos meson", "mese"] },
  { id: "synemmenon", low: 0, names: ["mese", "trite synemmenon", "paranete synemmenon", "nete synemmenon"] },
  { id: "diezeugmenon", low: 1, names: ["paramese", "trite diezeugmenon", "paranete diezeugmenon", "nete diezeugmenon"] },
  { id: "hyperbolaion", low: 4, names: ["nete diezeugmenon", "trite hyperbolaion", "paranete hyperbolaion", "nete hyperbolaion"] },
];
// the lower fixed note of each tetrachord, from the mese, in tones (t) and fourths (f)
const LOWS = { hypaton: [0, -2], meson: [0, -1], synemmenon: [0, 0], diezeugmenon: [1, 0], hyperbolaion: [1, 1] };

/** Every note of the Immutable System, its variants at each degree in a fixed order (codes stay the same). */
function catalogue() {
  const byDeg = new Map(), add = (d, e) => { if (!byDeg.has(d)) byDeg.set(d, []); const L = byDeg.get(d); if (!L.some((x) => x.name === e.name && x.genus === e.genus)) L.push(e); };
  add(-7, { name: "proslambanomenos", tetrachord: null, role: "fixed", genus: null });
  for (const T of TETRACHORDS) {
    add(T.low, { name: T.names[0], tetrachord: T.id, role: "fixed", genus: null });
    for (const g of GENERA) {
      add(T.low + 1, { name: T.names[1], tetrachord: T.id, role: "lower", genus: g });
      add(T.low + 2, { name: T.names[2], tetrachord: T.id, role: "upper", genus: g });
    }
    add(T.low + 3, { name: T.names[3], tetrachord: T.id, role: "fixed", genus: null });
  }
  return byDeg;
}
const CATALOGUE = catalogue();

const NOTE_NAMES = ["c", "c♯", "d", "e♭", "e", "f", "f♯", "g", "a♭", "a", "b♭", "b"];
/** A MIDI number (fractional) as the transcriptions name it: c' = 72, a = 69; and its deviation in cents. */
export function midiName(m) {
  const k = Math.round(m), dev = Math.round((m - k) * 100), oct = Math.floor(k / 12) - 5;
  const name = NOTE_NAMES[mod(k, 12)] + (oct > 0 ? "'".repeat(oct) : oct < 0 ? "," .repeat(-oct) : "");
  return dev ? `${name} ${dev > 0 ? "+" : "−"}${Math.abs(dev)}¢` : name;
}

/**
 * The system of a tonos: spec {tonos ("lydian"…), genera (the genera its movable notes may take, in order of
 * preference: ["diatonic"]), synemmenon (the conjunct tetrachord's notes too: true), shade ("aristoxenus", "archytas"),
 * divisions ({genus: [three cents]}: a shade of one's own)} → keySystem's answers (deg, alt, codesIn, at, shift,
 * cents, midi, hz, quality, melodicError, intervalName, pitchName, leaps…) and the Greek ones: noteOf (a code's
 * name, tetrachord, genus), concord, nearest (the codes of a pitch).
 */
export function greekSystem(spec = {}) {
  const tonos = spec.tonos || "lydian";
  if (!(tonos in TONOI)) throw new Error(`no such tonos: ${tonos}`);
  const genera = spec.genera || ["diatonic"];
  for (const g of genera) if (!GENERA.includes(g)) throw new Error(`no such genus: ${g}`);
  const synemmenon = spec.synemmenon ?? true;
  const shadeName = spec.shade || "aristoxenus", SH = SHADES[shadeName];
  if (!SH) throw new Error(`no such shade: ${shadeName}`);
  const divisions = { ...SH.divisions, ...(spec.divisions || {}) };
  const mese = 69 + TONOI[tonos];                       // the mese's MIDI number
  const lowOf = (t) => LOWS[t][0] * SH.tone + LOWS[t][1] * SH.fourth;
  const relOf = (d, e) => {
    if (e.name === "proslambanomenos") return -2 * SH.fourth - SH.tone;
    if (e.role === "fixed") {
      const T = TETRACHORDS.find((x) => x.id === e.tetrachord);
      return lowOf(T.id) + (d === T.low ? 0 : SH.fourth);
    }
    const div = divisions[e.genus];
    return lowOf(e.tetrachord) + div[0] + (e.role === "upper" ? div[1] : 0);
  };
  // the notes this system has: at each degree, its variants of the chosen genera (the first genus a pitch is reached
  // by keeps it: a parhypate the same in two genera is one note), the synemmenon's if asked
  const notes = new Map();
  for (const [d, L] of CATALOGUE) {
    L.forEach((e, v) => {
      if (e.genus && !genera.includes(e.genus)) return;
      if (!synemmenon && e.tetrachord === "synemmenon" && e.role !== "fixed") return;
      if (!synemmenon && e.name === "nete synemmenon") return;
      const rel = relOf(d, e);
      notes.set(16 * d + v, { code: 16 * d + v, deg: d, variant: v, ...e, rel, rank: e.genus ? genera.indexOf(e.genus) : -1 });
    });
  }
  // (a pitch reached twice at one degree is one note, named as the disjunct tetrachords name it — the trite
  // diezeugmenon before the paranete synemmenon —, else as its fixed note or its first genus)
  const pref = (x) => [x.tetrachord === "synemmenon" && x.name !== "mese" ? 1 : 0, x.rank, x.code];
  const before = (y, x) => { const p = pref(y), q = pref(x); for (let i = 0; i < 3; i++) if (p[i] !== q[i]) return p[i] < q[i]; return false; };
  for (const [c, x] of [...notes]) {
    for (const [c2, y] of notes) if (c2 !== c && y.deg === x.deg && Math.abs(y.rel - x.rel) < 1e-6 && before(y, x)) { notes.delete(c); break; }
  }
  const sorted = [...notes.values()].sort((a, b) => a.deg - b.deg || a.rel - b.rel);
  const deg = (c) => Math.floor(c / 16), alt = (c) => mod(c, 16);
  const note = (c) => { const x = notes.get(c); if (!x) throw new Error(`no such note in this system: ${c}`); return x; };
  const cents = (c) => (mese - 60) * 100 + note(c).rel;             // from middle c
  const midi = (c) => mese + note(c).rel / 100;
  const hz = (c) => 440 * Math.pow(2, (midi(c) - 69) / 12);
  const codesIn = (lo, hi) => sorted.filter((x) => x.deg >= lo && x.deg <= hi).map((x) => x.code);
  // the note a degree has by default: its fixed one, else the first genus's of the disjunct tetrachords
  const at = (d) => {
    const L = sorted.filter((x) => x.deg === d);
    if (!L.length) throw new Error(`no degree ${d} in the system`);
    return (L.find((x) => x.role === "fixed" && x.tetrachord !== "synemmenon") || L.find((x) => x.tetrachord !== "synemmenon") || L[0]).code;
  };
  const shift = (c, steps) => {
    const x = note(c), L = sorted.filter((y) => y.deg === x.deg + steps);
    if (!L.length) return null;
    return (L.find((y) => y.genus === x.genus && (y.tetrachord === "synemmenon") === (x.tetrachord === "synemmenon")) || L.find((y) => y.code === at(x.deg + steps)) || L[0]).code;
  };
  const TOL = 15;                                                     // a concord's tolerance, in cents
  /** The concord two notes make (unison, 4th, 5th, octave, by size), or null. */
  const concord = (a, b) => {
    const ct = Math.abs(note(b).rel - note(a).rel), m = mod(ct, 1200), oct = Math.round(ct / 1200);
    if (m < TOL || m > 1200 - TOL) return oct === 0 ? "unison" : "octave";
    if (Math.abs(m - SH.fourth) < TOL || Math.abs(m - 500) < TOL) return "4th";
    if (Math.abs(m - (SH.tone + SH.fourth)) < TOL || Math.abs(m - 700) < TOL) return "5th";
    return null;
  };
  const quality = (a, b) => (concord(a, b) ? "perfect" : "dissonant");
  function melodicError(a, b) {
    if (a === b) return null;
    const s = Math.abs(note(b).rel - note(a).rel);
    if (s <= 520) return null;                                           // a step, a third, a fourth (or a change in place)
    if (s < 680) return "a tritone";
    if (s <= 720) return null;                                           // the fifth
    if (s < 760) return "an augmented 5th";
    if (s <= 960) return null;                                           // a sixth
    if (s < 1180) return "a 7th";
    if (s <= 1220) return null;                                          // the octave
    return "a leap wider than the octave";
  }
  const NAMES = ["unison", "2nd", "3rd", "4th", "5th", "6th", "7th", "octave"];
  const intervalName = (n) => NAMES[Math.abs(n)] || `${Math.abs(n) + 1}th`;
  const noteOf = (c) => { const x = note(c); return { name: x.name, tetrachord: x.tetrachord, genus: x.genus, degree: x.deg, cents: x.rel }; };
  /** The codes whose pitch is within tol cents of a MIDI number (fractional). */
  const nearest = (m, tol = 30) => sorted.filter((x) => Math.abs(mese + x.rel / 100 - m) * 100 <= tol).map((x) => x.code);
  const name = `${tonos} ${genera.join("+")}${synemmenon ? "" : " (disjunct only)"} · ${shadeName}`;
  return {
    def: { name, tonos, genera, synemmenon, shade: shadeName }, name, greek: true, N: 7, period: 1200, key: null, ficta: false,
    tonos, genera, shade: shadeName, mese, notes: sorted.map((x) => x.code),
    deg, alt, shift, codesIn, at, cents, midi, hz, quality, concord, melodicError, intervalName, periodName: "octave",
    leaps: { small: 3, large: 5 }, suspensions: { upper: [], lower: [], compound: [] }, forbidCadence: [],
    noteOf, nearest, pitchName: (c) => midiName(midi(c)), greekName: (c) => note(c).name + (note(c).genus ? ` (${note(c).genus})` : ""),
  };
}

export default { greekSystem, TONOI, SHADES, GENERA, midiName };
