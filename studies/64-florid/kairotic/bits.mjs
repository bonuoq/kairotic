// SPDX-License-Identifier: MPL-2.0
// @kairotic/rules · bits.mjs: the length of a description (discussions #342, #399).
//
// One measure for the engines that compose and the studies that analyse ("one grammar, both ways", #321): a piece,
// a line or an analysis said as a sequence of words — a cell of a florid line (Study 64), a step of a reduction
// (Study 61), a bar's figure in a bridge (Study 63) — costs the bits a listener learning it as it goes would need to
// hear each word:
//
//   bits(word) = −log2( (count(word) + inverse · count(invert(word)) + alpha / kinds) / (N + alpha) )
//
// a word heard before cheap (the more, the cheaper), its inversion `inverse` as good (half, by default), a new one
// dear (alpha shared among `kinds` possible words), N the words heard. Counted so (an additive estimator), the
// length of a sequence hardly depends on the order its words are said in: it is a description length (MDL), the
// shorter the more coherent — a sequence read the same at every link, a figure and its inversion.
//
//   a word     "head:field,field…", each field a token or a signed whole number (an interval: a step, a shape);
//              its inversion negates every number field (and every number after a "|": "passing-mid.m|-1")
//   lexicon    what has been heard: bits(word), add(word), size (how many different words)
//   lengthOf   a sequence's length: {bits, perWord, words}
//   economy    an engine's soft preference for it: economy · (bits(word) − bits(a new word)) / 4, a discount for a
//              word heard before (Study 64's elaborate, Study 61's reduce, Study 63's bridges)
//
// Pure data and functions.

/** A word: its head and its fields ("Q", [0, 1, -1] → "Q:0,1,-1"). */
export const word = (head, fields) => head + ":" + fields.join(",");

/** A word's inversion: every number field negated (after ":", "," or "|"), 0 staying 0. */
export const invert = (w) => w.replace(/(^|[:,|])(-?\d+)(?=$|[,|])/g, (_, s, n) => s + String(-Number(n) || 0));

/** What has been heard, word by word: {bits(word), add(word), count(word), size, heard}. */
export function lexicon({ alpha = 1, kinds = 40, inverse = 0.5 } = {}) {
  const n = new Map();
  let N = 0;
  const count = (k) => n.get(k) || 0;
  return {
    bits: (w) => { const i = invert(w); return -Math.log2((count(w) + (i === w ? 0 : inverse * count(i)) + alpha / kinds) / (N + alpha)); },
    add: (w) => { n.set(w, count(w) + 1); N++; },
    count,
    get size() { return n.size; },
    get heard() { return N; },
  };
}

/** A sequence of words' length: {bits (in all), perWord, words (how many different)}. */
export function lengthOf(words, o = {}) {
  const lex = lexicon(o);
  let bits = 0;
  for (const w of words) { bits += lex.bits(w); lex.add(w); }
  return { bits, perWord: words.length ? bits / words.length : 0, words: lex.size };
}

/** An engine's economy for a word given the lexicon: a discount (≤ 0 once a word is heard) for a word heard before,
 *  economy · (bits(word) − bits(a word never heard)) / 4. 0 where economy is 0. */
export const economyOf = (lex, w, economy) => (economy ? economy * (lex.bits(w) - lex.bits("")) / 4 : 0);
