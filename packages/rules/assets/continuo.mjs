// SPDX-License-Identifier: MPL-2.0
// @kairotic/rules · continuo.mjs: Bach's chorales read as a figured bass (Study 76 · continuo, plan in #353).
//
// A chorale's quarter is a bass and the three notes over it; read as a continuo player reads it, it is a chord over the
// bass (5/3, 6/3, 6/4, 7, 6/5, 4/3, 4/2) or a dissonance held into it (a 4–3, a 9–8, a 2 in the bass), and Bach
// writes it with his abbreviations: nothing over a 5/3, "6" for a 6/3, "6/4/2" for a 4/2 (as he wrote it three times
// in four), an accidental before the number of a note the key signature does not give, an accidental alone for the
// 3rd. This module reads a quarter so (`intervalsOver`, `chordOf`, `figureOf`) and keeps what Bach's quarters say
// about the outer voices and the chords — the tables a bass written under his soprano is weighed by:
//
//   BACH_OUTER_VERTICAL   the soprano over the bass, in semitones (the octaves folded): −log of its frequency (a
//                         plain −log, natural, every table: costs summed are a probability's, −log P)
//   BACH_OUTER_PAIR       the soprano's move and the bass's together, each a class (−leap, −step, held, +step, +leap;
//                         a step 1–2 semitones): −log of the pair's frequency
//   BACH_DEGREE_CHORD     in major and in minor (the key the quarter is in, phrases.json's `keys`), the bass's degree
//                         in semitones over the tonic × the chord over it: −log P(chord | degree) — the rule of the
//                         octave as Bach played it; and `degree`, −log P(degree)
//   BACH_DISSONANCES      the quarters that are no chord (dissonanceOf): "voice|motion|interval|strong or weak" → how
//                         many, the soprano's the states a bass under it must allow (a 4–3 in the soprano, a passing
//                         quarter)
//   BACH_CADENCES         the phrase's last two quarters (the fermata's), the bass's degrees in the key the phrase
//                         ends in and their chords: the formulas, the most frequent first, with their share
//
// The tables are counted by `studies/_shared/chorales/tools/continuo.mjs` from phrases.json's quarters (Craig Sapp's
// edition of the 370 chorales), every chorale but every fifth (number % 5 === 0, kept out to measure against); the
// abbreviations, from the Bach Chorales Figured Bass dataset (Ju et al., ISMIR 2020: his own figures in 139 cantata
// chorales, after the Neue Bach-Ausgabe), matched to the same phrases (figures.json).
//
// Pure data and functions.

const LETTERS = "CDEFGAB";
/** A spelled note ("F#4", "Bb3", "C##5"): {step (diatonic, C0 = 0), letter (0–6), acc (−2…2), midi}. */
export function spelled(name) {
  const m = /^([A-G])(#{1,2}|b{1,2}|♯|♭)?(-?\d+)$/.exec(String(name).trim());
  if (!m) throw new Error(`not a spelled note: ${name}`);
  const letter = LETTERS.indexOf(m[1]), oct = Number(m[3]);
  const acc = !m[2] ? 0 : /#|♯/.test(m[2]) ? m[2].replace("♯", "#").length : -m[2].replace("♭", "b").length;
  return { step: letter + 7 * oct, letter, acc, midi: [0, 2, 4, 5, 7, 9, 11][letter] + acc + 12 * (oct + 1) };
}

/** The intervals over the bass (the last of `names`), as figures 2–7, the octave and the unison left out, sorted. */
export function intervalsOver(names) {
  const b = spelled(names[names.length - 1]).step;
  return [...new Set(names.slice(0, -1).map((n) => ((((spelled(n).step - b) % 7) + 7) % 7) + 1))].filter((x) => x !== 1).sort((a, c) => a - c);
}

/** The chords a quarter can be, and how their intervals over the bass read (a 5th or a 3rd left out). */
export const CHORDS = ["5/3", "6/3", "6/4", "7", "6/5", "4/3", "4/2"];
const CHORD_OF = { "": "5/3", 3: "5/3", 5: "5/3", 35: "5/3", 6: "6/3", 36: "6/3", 46: "6/4", 7: "7", 37: "7", 57: "7", 357: "7",
  56: "6/5", 356: "6/5", 34: "4/3", 346: "4/3", 2: "4/2", 24: "4/2", 26: "4/2", 246: "4/2" };
/** A quarter's chord over the bass ("6/3"), or "x:" and its intervals where it is a dissonance ("x:45", a 4–3). */
export const chordOf = (names) => { const k = intervalsOver(names).join(""); return CHORD_OF[k] || "x:" + k; };

/** How Bach writes a chord over the bass, most often (BCFB): the numbers, from the top. */
export const BACH_WRITES = { "5/3": [], "6/3": ["6"], "6/4": ["6", "4"], "7": ["7"], "6/5": ["6", "5"], "4/3": ["6", "4", "3"],
  "4/2": ["6", "4", "2"], "x:45": ["4"], "x:235": ["9"], "x:257": ["7", "5", "2"], "x:247": ["7", "4", "2"],
  "x:245": ["5", "4", "2"], "x:25": ["5", "2"], "x:457": ["5", "4"] };

const FIFTHS = { F: -1, C: 0, G: 1, D: 2, A: 3, E: 4, B: 5 };
const MODE_SHIFT = { major: 0, ionian: 0, minor: -3, aeolian: -3, dorian: -2, phrygian: -4, lydian: 1, mixolydian: -1, locrian: -5 };
/** The key signature of a key ({tonic: "B♭", mode, church?}): the accidental of each letter (0–6). */
export function signature(key) {
  const t = String(key.tonic), acc = (t.match(/[#♯]/g) || []).length - (t.match(/[b♭]/g) || []).length;
  const k = FIFTHS[t[0]] + 7 * acc + (MODE_SHIFT[key.church || key.mode || "major"] ?? 0);
  const out = [0, 0, 0, 0, 0, 0, 0];
  const sharps = "FCGDAEB", flats = "BEADGCF";
  for (let i = 0; i < Math.abs(k); i++) {
    const L = (k > 0 ? sharps : flats)[i % 7];
    out[LETTERS.indexOf(L)] += k > 0 ? 1 : -1;
  }
  return out;
}

const SIGN = (note, sig) => {
  if (note.acc === sig[note.letter]) return "";
  if (note.acc === 0) return "♮";
  return note.acc > sig[note.letter] ? (note.acc === 2 ? "𝄪" : "♯") : (note.acc === -2 ? "𝄫" : "♭");
};

/**
 * A quarter's figures as Bach would write them over its bass, in the key signature of `key` (the chorale's): the
 * numbers of its chord (BACH_WRITES), an accidental before a number whose note the signature does not give, and an
 * accidental alone for a 3rd it does not give that no number names. ["♯6"], ["6", "5"], ["♯"], [] (a plain 5/3).
 * `before`, the quarter before: over the same bass struck again, a plain chord is written by what changed (["5"]
 * after a 6, ["3"] after a 4, ["8"] after a 9).
 */
export function figureOf(names, key, before = null) {
  const sig = signature(key), bass = spelled(names[names.length - 1]);
  const over = names.slice(0, -1).map(spelled);
  const at = (n) => over.find((x) => ((((x.step - bass.step) % 7) + 7) % 7) + 1 === ((n - 1) % 7) + 1);
  const chord = chordOf(names);
  let nums = BACH_WRITES[chord] || intervalsOver(names).reverse().map(String);
  // over the same bass struck again, what changes is written: the 5 after a 6, the 3 after a 4, the 8 after a 9
  if (before && spelled(before[before.length - 1]).midi === bass.midi && chordOf(before) !== chord) {
    const was = intervalsOver(before), now = intervalsOver(names);
    const moved = now.filter((x) => !was.includes(x)).sort((a, c) => c - a).map(String);
    if (chordOf(before) === "x:235" && !now.includes(2)) moved.unshift("8");
    if (moved.length && !BACH_WRITES[chord]?.length) nums = moved;
  }
  const out = nums.map((n) => { const x = at(Number(n)); return (x ? SIGN(x, sig) : "") + n; });
  const third = at(3);
  if (third && !nums.some((n) => ((Number(n) - 1) % 7) + 1 === 3)) { const s = SIGN(third, sig); if (s) out.push(s); }
  return out;
}

/** Bach's figure as the dataset writes it, in figureOf's terms ("6\\", "6+" a raised 6: "♯6"; "6♮": "♮6"; "_" left out). */
export function normalFigure(f) {
  return f.filter((x) => x !== "_").map((x) => {
    const m = /^([♯♭♮𝄪𝄫]?)(\d*)([♯♭♮𝄪𝄫\\/+]?)$/.exec(x);
    if (!m) return x;
    const suf = m[3] === "\\" || m[3] === "+" ? "♯" : m[3] === "/" ? "♭" : m[3];
    return (m[1] || suf) + m[2];
  });
}

// ─── the dissonances: a quarter that is no chord, read as a chord and a voice that is not of it ───
const VOICES = ["soprano", "alto", "tenor", "bass"];
const RANK = { suspension: 0, passing: 0, neighbour: 1, "suspension-up": 2, held: 2, appoggiatura: 3, escape: 3, anticipation: 4, other: 5 };
const isChord = (names) => !chordOf(names).startsWith("x:");

/**
 * How a voice's note at quarter t of a phrase ({names, satb, held}) moves into it and out of it: "suspension" (held
 * from before, down by step after), "suspension-up" (held, up by step), "held" (held from before and kept after: the
 * bass moves under it), "passing" (by step in, on by step the same way), "neighbour" (by step in, back by step),
 * "appoggiatura" (leapt into, left by step), "escape" (by step in, leapt from), "anticipation" (struck, kept after),
 * "other".
 */
export function motionOf(phrase, t, v) {
  const n = phrase.satb.length, st = (u) => spelled(phrase.names[u][v]).step;
  const into = t ? st(t) - st(t - 1) : null, out = t < n - 1 ? st(t + 1) - st(t) : null;
  const held = phrase.held[t][v] || (t > 0 && phrase.satb[t - 1][v] === phrase.satb[t][v]);
  if (held && out === -1) return "suspension";
  if (held && out === 1) return "suspension-up";
  if (held && out === 0) return "held";
  if (into !== null && out !== null && Math.abs(into) === 1 && Math.abs(out) === 1) return into === out ? "passing" : "neighbour";
  if (into !== null && Math.abs(into) > 1 && out !== null && Math.abs(out) === 1) return "appoggiatura";
  if (into !== null && Math.abs(into) === 1 && out !== null && Math.abs(out) > 1) return "escape";
  if (out === 0) return "anticipation";
  return "other";
}

/**
 * A quarter that is no chord over its bass (chordOf's "x:"), read as a chord and the one voice that is not of it:
 * {voice, motion, interval (the voice's over the bass, 2–7; null for the bass), chord (the chord the others make)} —
 * the voice whose note left out leaves a chord (the bass: the three over it a chord over the bass before or after),
 * the likeliest by how it moves (a suspension or a passing note before a neighbour, before a leap). null where the
 * quarter is a chord; {voice: null} where no one voice explains it.
 */
export function dissonanceOf(phrase, t) {
  const names = phrase.names[t];
  if (isChord(names)) return null;
  const cands = [0, 1, 2].filter((v) => isChord(names.filter((_, i) => i !== v))).map((v) => [v, motionOf(phrase, t, v)]);
  const n = phrase.satb.length, over = (u) => isChord([...names.slice(0, 3), phrase.names[u][3]]);
  if (!phrase.held[t][3] && ((t > 0 && over(t - 1)) || (t < n - 1 && over(t + 1)))) cands.push([3, motionOf(phrase, t, 3)]);
  if (!cands.length) return { voice: null, motion: null, interval: null, chord: null };
  cands.sort((a, c) => RANK[a[1]] - RANK[c[1]]);
  const [v, motion] = cands[0];
  if (v === 3) return { voice: "bass", motion, interval: null, chord: chordOf([...names.slice(0, 3), phrase.names[t > 0 && over(t - 1) ? t - 1 : t + 1][3]]) };
  const interval = ((((spelled(names[v]).step - spelled(names[3]).step) % 7) + 7) % 7) + 1;
  return { voice: VOICES[v], motion, interval, chord: chordOf(names.filter((_, i) => i !== v)) };
}

// ─── the tables (counted by studies/_shared/chorales/tools/continuo.mjs) ───
// @tables-begin
// 1833 phrases, 14518 quarters (the chorales but every fifth)
export const BACH_OUTER_VERTICAL = [1.753, 6.427, 4.044, 1.757, 1.756, 3.961, 3.768, 1.559, 2.286, 2.438, 4.148, 5.286];
export const BACH_OUTER_PAIR = [4, 5.125, 4.649, 3.252, 3.551, 2.126, 3.35, 3.573, 2.55, 2.426, 2.796, 3.975, 3.056, 2.981, 3.072, 2.441, 2.961, 4.104, 2.843, 3.474, 3.484, 4.005, 4.772, 5.073, 4.044];
export const BACH_DEGREE_CHORD = {major: {chords: ["5/3", "6/3", "6/4", "7", "6/5", "4/3", "4/2", "x"], degree: [1.342, 6.037, 2.538, 7.898, 2.118, 2.048, 5, 1.64, 5.117, 2.062, 6.289, 2.632], chord: [[0.189, 3.486, 5.559, 4.742, 4.612, 6.106, 4.134, 2.295], [2.853, 1.118, 3.951, 2.853, 0.816, 2.853, 3.951, 3.951], [0.876, 1.651, 4.602, 1.842, 4.015, 4.175, 5.113, 1.694], [2.639, 1.54, 2.639, 2.639, 2.639, 1.54, 1.54, 2.639], [1.725, 0.379, 4.118, 3.36, 4.594, 5.783, 4.016, 2.901], [0.788, 2.314, 4.663, 3.356, 1.543, 5.234, 2.258, 2.547], [4.898, 1.137, 4.898, 2.333, 0.607, 4.898, 4.898, 4.898], [0.418, 3.552, 2.933, 2.485, 5.641, 6.009, 4.274, 1.855], [4.787, 0.47, 4.787, 1.652, 2.079, 3.689, 4.787, 4.787], [0.648, 1.244, 5.22, 2.865, 3.58, 5.077, 4.351, 2.533], [3.738, 2.639, 2.639, 3.738, 2.639, 3.738, 0.37, 3.738], [3.72, 0.454, 4.819, 2.728, 1.578, 3.72, 3.783, 4.272]]}, minor: {chords: ["5/3", "6/3", "6/4", "7", "6/5", "4/3", "4/2", "x"], degree: [1.305, 8.133, 2.87, 2.368, 6.013, 2.201, 4.487, 1.383, 2.444, 3.565, 5.47, 2.48], chord: [[0.24, 3.611, 5.221, 5.732, 4.561, 5.096, 3.375, 2.062], [1.204, 2.303, 2.303, 2.303, 2.303, 2.303, 2.303, 2.303], [1.719, 0.993, 4.176, 1.7, 2.441, 3.077, 3.975, 2.296], [2.075, 0.356, 4.925, 3.316, 6.871, 4.925, 2.554, 3.11], [3.466, 0.247, 3.466, 3.466, 3.466, 3.466, 3.466, 3.466], [1.132, 2.007, 5.938, 2.693, 1.205, 3.541, 2.442, 2.863], [4.804, 2.239, 4.804, 0.514, 1.437, 4.804, 3.705, 4.804], [0.359, 3.533, 2.834, 2.834, 5.905, 7.851, 4.484, 1.962], [1.018, 1.109, 3.751, 1.984, 3.577, 2.621, 3.66, 3.851], [4.081, 0.928, 4.592, 2.027, 0.895, 4.081, 5.69, 4.081], [1.204, 1.347, 2.813, 1.966, 3.912, 3.912, 1.966, 2.813], [3.148, 0.567, 5.661, 1.915, 1.507, 4.361, 6.759, 5.661]]}};
export const BACH_DISSONANCES = {"alto|suspension|2|strong":129, "alto|suspension|4|strong":108, "alto|other|4|strong":63, "tenor|suspension|2|strong":54, "alto|suspension|2|weak":52, "tenor|suspension|4|strong":47, "bass|escape|-|weak":42, "alto|held|4|weak":37, "alto|other|4|weak":36, "alto|held|5|weak":33, "tenor|other|4|strong":33, "alto|escape|4|weak":28, "alto|neighbour|2|weak":28, "bass|passing|-|weak":27, "alto|suspension|4|weak":25, "alto|anticipation|4|weak":24, "soprano|suspension|4|strong":22, "tenor|held|5|weak":22, "alto|passing|2|weak":20, "tenor|other|4|weak":20, "tenor|escape|4|weak":18, "alto|appoggiatura|2|weak":17, "tenor|held|4|weak":17, "tenor|suspension|2|weak":17, "alto|suspension-up|2|weak":16, "alto|held|4|strong":15, "alto|passing|4|strong":14, "tenor|appoggiatura|2|weak":14, "bass|escape|-|strong":13, "soprano|escape|4|weak":12, "alto|passing|2|strong":11, "bass|passing|-|strong":11, "alto|escape|2|weak":10, "alto|neighbour|2|strong":10, "soprano|held|5|weak":10, "alto|anticipation|4|strong":9, "alto|anticipation|7|weak":9, "soprano|passing|2|weak":9, "tenor|passing|2|weak":9, "tenor|suspension-up|2|weak":9, "bass|anticipation|-|weak":8, "soprano|passing|5|weak":8, "tenor|held|5|strong":8, "alto|other|2|strong":7, "soprano|held|4|weak":7, "tenor|anticipation|4|weak":7, "tenor|suspension|4|weak":6, "alto|appoggiatura|2|strong":5, "alto|appoggiatura|4|strong":5, "alto|escape|2|strong":5, "alto|suspension-up|5|weak":5, "soprano|anticipation|4|weak":5, "soprano|passing|7|weak":5, "tenor|anticipation|7|weak":5, "tenor|appoggiatura|4|strong":5, "tenor|neighbour|7|weak":5, "tenor|passing|4|strong":5, "alto|anticipation|2|weak":4, "alto|anticipation|5|weak":4, "alto|held|7|weak":4, "alto|other|2|weak":4, "alto|passing|7|weak":4, "alto|suspension-up|2|strong":4, "bass|suspension|-|strong":4, "soprano|escape|4|strong":4, "soprano|other|4|weak":4, "soprano|other|7|weak":4, "soprano|suspension-up|5|weak":4, "soprano|suspension|4|weak":4, "soprano|suspension|7|weak":4, "tenor|neighbour|2|weak":4, "alto|appoggiatura|7|weak":3, "alto|held|2|weak":3, "alto|held|5|strong":3, "alto|other|5|strong":3, "alto|suspension-up|4|weak":3, "alto|suspension|7|weak":3, "bass|neighbour|-|strong":3, "soprano|anticipation|2|weak":3, "soprano|appoggiatura|2|weak":3, "soprano|suspension|5|weak":3, "tenor|appoggiatura|2|strong":3, "tenor|escape|2|weak":3, "tenor|held|2|weak":3, "tenor|held|4|strong":3, "tenor|passing|2|strong":3, "bass|anticipation|-|strong":2, "bass|appoggiatura|-|weak":2, "bass|neighbour|-|weak":2, "null|null|-|weak":2, "soprano|anticipation|5|strong":2, "soprano|anticipation|5|weak":2, "soprano|anticipation|7|weak":2, "soprano|appoggiatura|7|weak":2, "soprano|escape|2|weak":2, "soprano|held|2|weak":2, "soprano|held|4|strong":2, "soprano|neighbour|2|weak":2, "soprano|neighbour|7|strong":2, "soprano|passing|5|strong":2, "soprano|suspension-up|7|weak":2, "soprano|suspension|2|weak":2, "tenor|anticipation|2|weak":2, "tenor|anticipation|5|strong":2, "tenor|anticipation|5|weak":2, "tenor|held|7|weak":2, "tenor|other|2|strong":2, "tenor|passing|3|weak":2, "tenor|passing|4|weak":2, "tenor|suspension-up|5|weak":2, "alto|anticipation|2|strong":1, "alto|anticipation|5|strong":1, "alto|appoggiatura|3|strong":1, "alto|escape|4|strong":1, "alto|escape|7|weak":1, "alto|held|2|strong":1, "alto|neighbour|4|weak":1, "alto|neighbour|7|weak":1, "alto|other|5|weak":1, "alto|passing|4|weak":1, "bass|appoggiatura|-|strong":1, "bass|other|-|weak":1, "bass|suspension-up|-|weak":1, "soprano|anticipation|4|strong":1, "soprano|appoggiatura|4|weak":1, "soprano|escape|5|weak":1, "soprano|escape|7|weak":1, "soprano|held|2|strong":1, "soprano|held|7|weak":1, "soprano|other|5|weak":1, "soprano|passing|2|strong":1, "soprano|passing|4|weak":1, "soprano|passing|6|weak":1, "tenor|anticipation|2|strong":1, "tenor|anticipation|4|strong":1, "tenor|appoggiatura|4|weak":1, "tenor|appoggiatura|5|weak":1, "tenor|escape|2|strong":1, "tenor|held|2|strong":1, "tenor|other|5|strong":1, "tenor|other|5|weak":1, "tenor|passing|7|weak":1, "tenor|suspension-up|6|weak":1};
export const BACH_CADENCES = {major: [["7:5/3 0:5/3", 0.374], ["7:7 0:5/3", 0.098], ["7:x 0:5/3", 0.064], ["0:5/3 7:5/3", 0.033], ["2:x 7:5/3", 0.032], ["4:6/3 7:5/3", 0.024], ["0:5/3 0:5/3", 0.024], ["11:6/5 0:5/3", 0.024], ["2:6/3 0:5/3", 0.019], ["11:6/3 0:5/3", 0.018], ["5:6/5 0:5/3", 0.015], ["2:5/3 7:5/3", 0.014], ["7:5/3 7:5/3", 0.014], ["0:6/5 7:5/3", 0.011], ["9:6/3 0:5/3", 0.01], ["7:6/3 0:5/3", 0.009]], minor: [["7:5/3 0:5/3", 0.198], ["2:5/3 7:5/3", 0.127], ["0:5/3 7:5/3", 0.085], ["7:x 0:5/3", 0.041], ["7:7 0:5/3", 0.029], ["8:6/3 7:5/3", 0.029], ["2:x 7:5/3", 0.028], ["11:6/3 0:5/3", 0.028], ["3:6/3 7:5/3", 0.028], ["8:4/3 7:5/3", 0.025], ["7:5/3 7:5/3", 0.023], ["2:7 7:5/3", 0.021], ["8:7 7:5/3", 0.019], ["11:7 0:5/3", 0.019], ["6:7 7:5/3", 0.016], ["0:x 7:5/3", 0.016]]};
// @tables-end
