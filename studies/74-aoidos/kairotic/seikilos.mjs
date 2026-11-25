// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 74 · aoidos: Seikilos's song as the stele has it (E. Pöhlmann and M. L. West, Documents of Ancient
// Greek Music, Oxford 2001, no. 23), and how it keeps the accent rules aoidos sings by (judgeAccent, aoidos.mjs's).
//
// Each syllable with its signs (the vocal notation of the Iastian tonos: C a, K c♯', I d', Z e', O b, Φ g, X f♯, and
// the low e — the final — that ends the song) and their time in chronoi (a sign alone 1; a diseme ‾ 2; a triseme 3); a
// syllable may take two or three signs (a melisma). Every line is twelve chronoi: two bars of 6/8 in the transcription.

import { judgeAccent } from "./aoidos.mjs";

export const MIDI = { C: 69, K: 73, I: 74, Z: 76, O: 71, Φ: 67, X: 66, E: 64 };   // MIDI: a4, c♯5, d5, e5, b4, g4, f♯4, e4
// [syllable, [[sign, chronoi]…]]
export const SONG = [
  [["Ὅ", [["C", 1]]], ["σον", [["Z", 2]]], ["ζῇς", [["Z", 3]]], ["φαί", [["K", 1], ["I", 1], ["Z", 1]]], ["νου", [["I", 3]]]],
  [["μη", [["K", 2]]], ["δὲν", [["I", 1]]], ["ὅ", [["Z", 1]]], ["λως", [["I", 1], ["K", 1]]], ["σὺ", [["O", 1]]], ["λῡ", [["C", 2]]], ["ποῦ", [["O", 1], ["Φ", 2]]]],
  [["πρὸς", [["C", 1]]], ["ὀ", [["K", 1]]], ["λί", [["Z", 1]]], ["γον", [["I", 1]]], ["ἐσ", [["K", 1], ["I", 1]]], ["τὶ", [["K", 1]]], ["τὸ", [["C", 2]]], ["ζῆν", [["O", 1], ["Φ", 2]]]],
  [["τὸ", [["C", 1]]], ["τέ", [["K", 1]]], ["λος", [["O", 1]]], ["ὁ", [["I", 1]]], ["χρό", [["Z", 1]]], ["νος", [["K", 1]]], ["ἀ", [["C", 1]]], ["παι", [["C", 2]]], ["τεῖ", [["C", 1], ["X", 1], ["E", 1]]]],
];
export const TEXT = "Ὅσον ζῇς φαίνου\nμηδὲν ὅλως σὺ λῡποῦ·\nπρὸς ὀλίγον ἐστὶ τὸ ζῆν,\nτὸ τέλος ὁ χρόνος ἀπαιτεῖ.";

/** The song as notes: [{line, syl (in the poem), text, midi, chronoi, first (of its syllable)}]. */
export function notes() {
  const out = [];
  let s = 0;
  SONG.forEach((line, li) => line.forEach(([text, signs]) => { signs.forEach(([g, c], j) => out.push({ line: li, syl: s, text: j ? "" : text, sign: g, midi: MIDI[g], chronoi: c, first: j === 0 })); s++; }));
  return out;
}

export { judgeAccent };

export default { SONG, TEXT, notes, judgeAccent };
