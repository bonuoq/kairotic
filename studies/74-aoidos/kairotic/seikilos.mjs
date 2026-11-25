// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 74 · aoidos: Seikilos's song as the stele has it (E. Pöhlmann and M. L. West, Documents of Ancient
// Greek Music, Oxford 2001, no. 23), and how it keeps the accent rules aoidos sings by.
//
// Each syllable with its signs (the vocal notation of the Iastian tonos: C a, K c♯', I d', Z e', O b, Φ g, X f♯, and
// the low e — the final — that ends the song) and their time in chronoi (a sign alone 1; a diseme ‾ 2; a triseme 3); a
// syllable may take two or three signs (a melisma). Every line is twelve chronoi: two bars of 6/8 in the transcription.

const P = { C: 69, K: 73, I: 74, Z: 76, O: 71, Φ: 67, X: 66, E: 64 };   // MIDI: a4, c♯5, d5, e5, b4, g4, f♯4, e4
// [syllable, [[sign, chronoi]…]]
export const SONG = [
  [["Ὅ", [["C", 1]]], ["σον", [["Z", 2]]], ["ζῇς", [["Z", 3]]], ["φαί", [["K", 1], ["I", 1], ["Z", 1]]], ["νου", [["I", 3]]]],
  [["μη", [["K", 2]]], ["δὲν", [["I", 1]]], ["ὅ", [["Z", 1]]], ["λως", [["I", 1], ["K", 1]]], ["σὺ", [["O", 1]]], ["λυ", [["C", 2]]], ["ποῦ", [["O", 1], ["Φ", 2]]]],
  [["πρὸς", [["C", 1]]], ["ὀ", [["K", 1]]], ["λί", [["Z", 1]]], ["γον", [["I", 1]]], ["ἐσ", [["K", 1], ["I", 1]]], ["τὶ", [["K", 1]]], ["τὸ", [["C", 2]]], ["ζῆν", [["O", 1], ["Φ", 2]]]],
  [["τὸ", [["C", 1]]], ["τέ", [["K", 1]]], ["λος", [["O", 1]]], ["ὁ", [["I", 1]]], ["χρό", [["Z", 1]]], ["νος", [["K", 1]]], ["ἀ", [["C", 1]]], ["παι", [["C", 2]]], ["τεῖ", [["C", 1], ["X", 1], ["E", 1]]]],
];
export const TEXT = "Ὅσον ζῇς φαίνου\nμηδὲν ὅλως σὺ λυποῦ·\nπρὸς ὀλίγον ἐστὶ τὸ ζῆν,\nτὸ τέλος ὁ χρόνος ἀπαιτεῖ.";

/** The song as notes: [{line, syl (in the poem), text, midi, chronoi, first (of its syllable)}]. */
export function notes() {
  const out = [];
  let s = 0;
  SONG.forEach((line, li) => line.forEach(([text, signs]) => { signs.forEach(([g, c], j) => out.push({ line: li, syl: s, text: j ? "" : text, sign: g, midi: P[g], chronoi: c, first: j === 0 })); s++; }));
  return out;
}

/**
 * How a sung text keeps the accent rules, judged syllable by syllable: syllables [{accent, word}] (prosody.mjs's,
 * of the whole poem) and the pitches of each ([[midi…]…], a melisma several) → {rule: [kept, where it applies,
 * [the syllables where it is not kept]]}:
 *   acute-rise       an acute's first note higher than the note before
 *   peak             the accented syllable (acute, circumflex) holds the word's highest note
 *   circumflex-fall  a circumflex's syllable ends lower than it begins (sung on one note: not kept)
 *   after-accent     after an acute or a circumflex (not before the next word's accent) the next note is lower
 *   grave            after a grave the next note is not lower
 * (the last two within a line). syllables carry their line.
 */
export function judgeAccent(syllables, pitches) {
  const r = { "acute-rise": [0, 0, []], peak: [0, 0, []], "circumflex-fall": [0, 0, []], "after-accent": [0, 0, []], grave: [0, 0, []] };
  const count = (id, ok, i) => { r[id][1]++; if (ok) r[id][0]++; else r[id][2].push(i); };
  const last = (i) => pitches[i][pitches[i].length - 1], first = (i) => pitches[i][0];
  syllables.forEach((s, i) => {
    if (s.accent === "acute" && i >= 1) count("acute-rise", first(i) > last(i - 1), i);
    if (s.accent === "acute" || s.accent === "circumflex") {
      const top = Math.max(...pitches[i]);
      const word = syllables.map((t, j) => j).filter((j) => syllables[j].word === s.word);
      count("peak", word.every((j) => j === i || Math.max(...pitches[j]) <= top), i);
    }
    if (s.accent === "circumflex") count("circumflex-fall", last(i) < first(i), i);
    const next = syllables[i + 1];
    // (within a line: a new line begins again)
    if (next && next.line === s.line && (s.accent === "acute" || s.accent === "circumflex") && next.accent !== "acute" && next.accent !== "circumflex")
      count("after-accent", first(i + 1) < last(i), i);
    if (next && next.line === s.line && s.accent === "grave") count("grave", first(i + 1) >= last(i), i);
  });
  return r;
}

export default { SONG, TEXT, notes, judgeAccent };
