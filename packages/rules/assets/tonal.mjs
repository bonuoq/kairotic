// SPDX-License-Identifier: MPL-2.0
// @kairotic/rules · tonal.mjs: the tonal system the catalogue's rules read — keys, degrees and alterations, a note's
// code (3·degree + alteration + 1), the key of a unit. The same functions as @kairotic/cac's partimento.mjs, where they
// came from (tests/rules.mjs checks they stay the same until partimento.mjs reads them from here).
export const mod = (a, m) => ((a % m) + m) % m;
export const sign = (x) => (x > 0) - (x < 0);

const PAT = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10] };
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"], WHITE = [0, 2, 4, 5, 7, 9, 11];
const ACC = { "-2": "𝄫", "-1": "♭", 0: "", 1: "♯", 2: "𝄪" };

export function keyOf(k = {}) {
  const name = k.tonic || "C", mode = k.mode === "minor" ? "minor" : "major";
  const L = LETTERS.indexOf(name[0].toUpperCase());
  if (L < 0) throw new Error(`no such tonic: ${name}`);
  const acc = [...name.slice(1)].reduce((a, ch) => a + (ch === "#" || ch === "♯" ? 1 : ch === "b" || ch === "♭" ? -1 : 0), 0);
  const pc = mod(WHITE[L] + acc, 12);
  const oct = pc > 5 ? 2 : 3;
  const tonicMidi = 12 * (oct + 1) + WHITE[L] + acc;
  const pat = PAT[mode];
  /** Semitones above the tonic of a degree d, raised (r = 1) or not. */
  const semi = (d, r = 0) => 12 * Math.floor(d / 7) + pat[mod(d, 7)] + r;
  const midi = (d, r = 0) => tonicMidi + semi(d, r);
  const name_ = (d, r = 0) => {
    const la = 7 * oct + L + d, o = Math.floor(la / 7), l = mod(la, 7);
    const a = midi(d, r) - (12 * (o + 1) + WHITE[l]);
    return LETTERS[l] + (ACC[a] ?? (a > 0 ? "+" + a : String(a))) + o;
  };
  /** Whether a degree has two forms in this key (⑥ and ⑦ in minor). */
  const mutable = (d) => mode === "minor" && mod(d, 7) >= 5;
  return { tonic: name, mode, tonicMidi, letter: L, pc, oct, semi, midi, name: name_, mutable, pattern: pat,
           hz: (d, r = 0) => 440 * Math.pow(2, (midi(d, r) - 69) / 12),
           circled: (d) => "①②③④⑤⑥⑦"[mod(d, 7)] };
}

export function isDominant(d, next) {
  if (mod(d, 7) !== 4) return false;
  return next === undefined || next === null || [0, 5].includes(mod(next, 7));
}

export const FIG_CLASS = (f) => mod(f - 1, 7);                      // 8 → 0, 3 and 10 → 2, 9 → 1 …
export const CLASS_FIG = [8, 2, 3, 4, 5, 6, 7];

export function codeOf(K, name) {
  const m = /^([A-Ga-g])([#♯b♭]*)(-?\d+)$/.exec(name.trim());
  if (!m) throw new Error(`not a note: ${name}`);
  const L = LETTERS.indexOf(m[1].toUpperCase()), acc = [...m[2]].reduce((a, ch) => a + (ch === "#" || ch === "♯" ? 1 : -1), 0), o = Number(m[3]);
  const d = 7 * o + L - (7 * K.oct + K.letter), midi = 12 * (o + 1) + WHITE[L] + acc, a = midi - K.midi(d, 0);
  if (Math.abs(a) > 1) throw new Error(`${name}: too far from ${K.tonic} ${K.mode}`);
  return codeOf3(d, a);
}

export const codeOf3 = (d, a = 0) => 3 * d + a + 1;
export const codeDegree = (c) => Math.floor(c / 3);
export const codeAlter = (c) => c - 3 * Math.floor(c / 3) - 1;

export function localOf(K, k) {
  const L = k ? (k.semi ? k : keyOf(k)) : K;
  return { key: L, o: mod(L.letter - K.letter, 7), s: mod(L.pc - K.pc, 12) };
}

export function localNote(K, lo, d, a) {
  const deg = mod(d - lo.o, 7), sem = mod(K.semi(d, a) - lo.s, 12);
  return { deg, alt: mod(sem - lo.key.pattern[deg] + 6, 12) - 6 };
}
