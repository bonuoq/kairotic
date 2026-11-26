// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 75 · voice: what each sound of sung Greek is, as data (discussion #467). A syllable as written →
// its phonemes (onset, nucleus, coda), in a pronunciation chosen among reconstructions; each phoneme → the targets
// a formant voice aims at while it sounds (tract.mjs turns them into curves, voice.dsp and noise.dsp sound them).
//
// Nothing here is learnt: every number can be read and changed — the page shows the table as EDN and sings with
// what is edited. The values are the usual ones of formant synthesis (after Klatt 1980 and the vowel charts of
// Peterson & Barney), rounded, for a voice of middle size; `size` scales them for a smaller or larger voice.
//
// A phoneme: {kind: "vowel" | "stop" | "fricative" | "nasal" | "liquid" | "h",
//             F: [F1 F2 F3 F4] Hz and B: [B1 B2 B3 B4] Hz — where the tract is (a consonant's are its locus: where
//                the formants of the vowels next to it start from or go to; null: the neighbour's),
//             AV voicing 0–1, AH aspiration 0–1, AF frication 0–1, FC FB the frication's centre and bandwidth Hz,
//             ms its own duration (a consonant's; a vowel takes what the note leaves it),
//             a stop also: closure ms, burst (0–1), vot ms (the aspiration after the burst; long: φ θ χ)}

import { wordSyllables } from "../../74-aoidos/kairotic/prosody.mjs";

const V = (F, B = [80, 100, 150, 200]) => ({ kind: "vowel", F, B, AV: 1, AH: 0.04, AF: 0 });
export const VOWELS = {
  i: V([300, 2300, 3000, 3700]),
  y: V([300, 1850, 2300, 3600]),
  e: V([430, 2050, 2650, 3600]),
  "ɛ": V([580, 1850, 2550, 3600]),
  a: V([750, 1300, 2600, 3600], [90, 110, 150, 200]),
  "ɔ": V([570, 900, 2500, 3600]),
  o: V([450, 800, 2600, 3600]),
  u: V([320, 750, 2500, 3600]),
};
// a stop: its closure, its burst (filtered at FC), then its voice onset time (vot) as aspiration
const stop = (F, voiced, FC, FB, burst, vot) => ({ kind: "stop", F, B: [90, 120, 180, 250], AV: voiced ? 0.25 : 0, AH: 0, AF: 0,
                                                  FC, FB, burst, closure: voiced ? 55 : 70, vot, ms: (voiced ? 55 : 70) + 8 + vot });
export const CONSONANTS = {
  p: stop([250, 900, 2200, 3500], false, 1200, 1500, 0.35, 15),
  b: stop([250, 900, 2200, 3500], true, 1200, 1500, 0.3, 0),
  "pʰ": stop([250, 900, 2200, 3500], false, 1200, 1500, 0.35, 70),
  t: stop([300, 1800, 2700, 3600], false, 4000, 2000, 0.6, 15),
  d: stop([300, 1800, 2700, 3600], true, 4000, 2000, 0.5, 0),
  "tʰ": stop([300, 1800, 2700, 3600], false, 4000, 2000, 0.6, 70),
  k: stop([300, null, 2400, 3500], false, 2200, 1000, 0.7, 20),       // velar: its F2 follows the vowel (null)
  g: stop([300, null, 2400, 3500], true, 2200, 1000, 0.6, 0),
  "kʰ": stop([300, null, 2400, 3500], false, 2200, 1000, 0.7, 75),
  s: { kind: "fricative", F: [400, 1700, 2600, 3600], B: [200, 200, 250, 300], AV: 0, AH: 0, AF: 1, FC: 5500, FB: 2500, ms: 110 },
  z: { kind: "fricative", F: [300, 1700, 2600, 3600], B: [200, 200, 250, 300], AV: 0.35, AH: 0, AF: 0.6, FC: 5000, FB: 2500, ms: 80 },
  h: { kind: "h", F: [null, null, null, null], B: [300, 300, 300, 300], AV: 0, AH: 0.7, AF: 0, ms: 60 },
  // nasals and liquids are voiced and sound through the tract; nasals still without their antiformant (later)
  m: { kind: "nasal", F: [250, 1000, 2200, 3300], B: [100, 300, 300, 300], AV: 0.45, AH: 0, AF: 0, ms: 70 },
  n: { kind: "nasal", F: [250, 1500, 2600, 3400], B: [100, 300, 300, 300], AV: 0.45, AH: 0, AF: 0, ms: 65 },
  "ŋ": { kind: "nasal", F: [250, 2000, 2700, 3400], B: [100, 300, 300, 300], AV: 0.45, AH: 0, AF: 0, ms: 65 },
  l: { kind: "liquid", F: [350, 1100, 2700, 3500], B: [100, 150, 200, 250], AV: 0.75, AH: 0, AF: 0, ms: 60 },
  r: { kind: "liquid", F: [400, 1400, 2000, 3300], B: [120, 150, 200, 250], AV: 0.5, AH: 0, AF: 0.05, FC: 3000, FB: 2000, ms: 35 },
};
export const TABLE = { ...VOWELS, ...CONSONANTS };

// ───── pronunciations ─────
// attic: the restored pronunciation of the 5th–4th c. BC (after W. S. Allen, Vox Graeca): η an open long e, ει a close
//        long e, ου a long u, υ a front y, φ θ χ aspirated stops, ζ zd, the rough breathing an h.
// koine: about the 1st c. AD, when Seikilos's stele was cut: αι an open e, ει an i, οι a y, ζ a z, no h; φ θ χ still
//        aspirated stops (they became fricatives later).
const NUCLEI = {
  attic: { α: ["a"], ε: ["e"], η: ["ɛ"], ι: ["i"], ο: ["o"], υ: ["y"], ω: ["ɔ"],
           αι: ["a", "i"], ει: ["e"], οι: ["o", "i"], υι: ["y", "i"], ου: ["u"], αυ: ["a", "u"], ευ: ["e", "u"], ηυ: ["ɛ", "u"], ωυ: ["ɔ", "u"] },
  koine: { α: ["a"], ε: ["e"], η: ["ɛ"], ι: ["i"], ο: ["o"], υ: ["y"], ω: ["ɔ"],
           αι: ["ɛ"], ει: ["i"], οι: ["y"], υι: ["y", "i"], ου: ["u"], αυ: ["a", "u"], ευ: ["e", "u"], ηυ: ["ɛ", "u"], ωυ: ["ɔ", "u"] },
};
const LETTERS = {
  attic: { π: ["p"], β: ["b"], φ: ["pʰ"], τ: ["t"], δ: ["d"], θ: ["tʰ"], κ: ["k"], γ: ["g"], χ: ["kʰ"], σ: ["s"], ζ: ["z", "d"],
           ξ: ["k", "s"], ψ: ["p", "s"], μ: ["m"], ν: ["n"], λ: ["l"], ρ: ["r"] },
  koine: { π: ["p"], β: ["b"], φ: ["pʰ"], τ: ["t"], δ: ["d"], θ: ["tʰ"], κ: ["k"], γ: ["g"], χ: ["kʰ"], σ: ["s"], ζ: ["z"],
           ξ: ["k", "s"], ψ: ["p", "s"], μ: ["m"], ν: ["n"], λ: ["l"], ρ: ["r"] },
};
export const PRONUNCIATIONS = { attic: { nuclei: NUCLEI.attic, letters: LETTERS.attic, h: true },
                                koine: { nuclei: NUCLEI.koine, letters: LETTERS.koine, h: false } };

const VELARS = new Set(["k", "g", "kʰ"]);

/** A syllable as written (a word's syllable, from aoidos's MEI or prosody.mjs) → {onset, nucleus, coda: [phoneme…]}.
 *  Text that is not Greek (or has no vowel) gives an empty syllable. */
export function syllablePhonemes(text, pron = "attic") {
  const P = PRONUNCIATIONS[pron] || PRONUNCIATIONS.attic;
  const clean = String(text || "").replace(/[^\p{L}\p{M}]/gu, "");
  const s = clean ? wordSyllables(clean)[0] : null;
  if (!s) return { onset: [], nucleus: [], coda: [] };
  const conv = (cs) => [...cs].flatMap((c) => P.letters[c] || []);
  const onset = conv(s.onset);
  if (s.rough && P.h && !onset.length) onset.push("h");
  return { onset, nucleus: (P.nuclei[s.vowel] || [...s.vowel].flatMap((v) => P.nuclei[v] || [])).slice(), coda: conv(s.coda) };
}

/** A line's syllables (texts) → their phonemes, with what depends on the next: γ before a velar is ŋ (ἄγγελος). */
export function linePhonemes(texts, pron = "attic") {
  const syls = texts.map((t) => syllablePhonemes(t, pron));
  const flat = syls.flatMap((s, i) => ["onset", "nucleus", "coda"].flatMap((part) => s[part].map((p, j) => ({ i, part, j, p }))));
  flat.forEach((x, k) => { const nx = flat[k + 1]; if (x.p === "g" && nx && VELARS.has(nx.p)) syls[x.i][x.part][x.j] = "ŋ"; });
  return syls;
}

/** The table scaled for a voice of another size: every formant and frication centre × size (1 a middle voice). */
export function scaled(table, size = 1) {
  const out = {};
  for (const [k, ph] of Object.entries(table)) out[k] = { ...ph, F: ph.F.map((f) => (f == null ? null : Math.round(f * size))), FC: ph.FC ? Math.round(ph.FC * size) : ph.FC };
  return out;
}

/** The table as EDN, as the page shows it to be read and edited: a map from each phoneme (a string) to its targets
 *  (kind a keyword, nil a value left to the neighbours). */
export function tableEdn(table = TABLE) {
  const v = (x) => (x === null || x === undefined ? "nil" : Array.isArray(x) ? "[" + x.map(v).join(" ") + "]" : typeof x === "string" ? ":" + x : String(x));
  const order = ["kind", "F", "B", "AV", "AH", "AF", "FC", "FB", "ms", "closure", "burst", "vot"];
  return "{" + Object.entries(table).map(([k, ph]) =>
    JSON.stringify(k) + " {" + order.filter((f) => ph[f] !== undefined).map((f) => `:${f} ${v(ph[f])}`).join(" ") + "}").join("\n ") + "}";
}
