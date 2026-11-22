// SPDX-License-Identifier: MPL-2.0
// @kairotic/rules · tonal.mjs: the tonal system the catalogue's rules read — keys, degrees and alterations, a note's
// code (3·degree + alteration + 1), the key of a unit. The same functions as @kairotic/cac's partimento.mjs, where they
// came from (tests/rules.mjs checks they stay the same until partimento.mjs reads them from here).
export const mod = (a, m) => ((a % m) + m) % m;
export const sign = (x) => (x > 0) - (x < 0);

const PAT = { major: [0, 2, 4, 5, 7, 9, 11], minor: [0, 2, 3, 5, 7, 8, 10],
              ionian: [0, 2, 4, 5, 7, 9, 11], dorian: [0, 2, 3, 5, 7, 9, 10], phrygian: [0, 1, 3, 5, 7, 8, 10],
              lydian: [0, 2, 4, 6, 7, 9, 11], mixolydian: [0, 2, 4, 5, 7, 9, 10], aeolian: [0, 2, 3, 5, 7, 8, 10] };
// the modes' musica ficta, as Fux writes it (Gradus ad Parnassum, the examples in two and three parts): which degrees
// may be altered (degree: alteration) — the leading tone raised at a cadence, the 3rd of the final raised in the last
// chord, ⑥ or ④ lowered against the tritone with ②… (dorian: C♯ B♭ F♯; phrygian: G♯; lydian: B♭; mixolydian: F♯;
// aeolian: G♯ F♯). "end": the final's raised 3rd, only in a chord on the final.
const FICTA = { ionian: {}, dorian: { 6: 1, 5: -1, 2: "end" }, phrygian: { 2: "end" }, lydian: { 3: -1 }, mixolydian: { 6: 1 }, aeolian: { 6: 1, 5: 1 } };
const LETTERS = ["C", "D", "E", "F", "G", "A", "B"], WHITE = [0, 2, 4, 5, 7, 9, 11];
const ACC = { "-2": "𝄫", "-1": "♭", 0: "", 1: "♯", 2: "𝄪" };

export function keyOf(k = {}) {
  const name = k.tonic || "C", mode = PAT[k.mode] && k.mode !== "major" ? k.mode : "major";
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
  /** A mode's musica ficta: the alteration a degree may take (+1, −1), or 0 (none; major and minor have none). */
  const fx = (d) => (FICTA[mode] && FICTA[mode][mod(d, 7)]) || 0;
  const ficta = (d) => (fx(d) === "end" ? 1 : fx(d));
  /** Whether a degree's ficta is the final's raised 3rd, only in a chord on the final. */
  const fictaAtEnd = (d) => fx(d) === "end";
  return { tonic: name, mode, tonicMidi, letter: L, pc, oct, semi, midi, name: name_, mutable, ficta, fictaAtEnd, modal: !!FICTA[mode], pattern: pat,
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

// ─── a bass given as notes (the cac box) ───
/** The degree and alteration of a MIDI note in the key K (its scale first, then raised, then lowered), or null. */
export function degreeOf(K, midi) {
  const m = Math.round(midi);
  for (const r of [0, 1, -1]) for (let d = -28; d <= 35; d++) if (K.midi(d, r) === m) return { d, r };
  return null;
}
/** A key from its name ("G", "e" minor, "a minor", "d dorian") or {tonic, mode}, or null. */
export const parseKey = (k) => {
  if (!k) return null;
  if (typeof k === "object") return k;
  const s = String(k).trim(), m = s.match(/^([A-Ga-g])([#♯b♭]?)\s*(major|minor|maj|min|m|ionian|dorian|phrygian|lydian|mixolydian|aeolian)?$/i);
  if (!m) return null;
  // a church mode by its name ("d dorian", "E phrygian")
  if (m[3] && /ian$/i.test(m[3])) return { tonic: m[1].toUpperCase() + m[2].replace("♯", "#").replace("♭", "b"), mode: m[3].toLowerCase() };
  const minor = m[3] ? /^m(in(or)?)?$/.test(m[3]) && m[3] !== "maj" : m[1] === m[1].toLowerCase();
  return { tonic: m[1].toUpperCase() + m[2].replace("♯", "#").replace("♭", "b"), mode: minor ? "minor" : "major" };
};
/** A key for a bass that has none: its last note's the tonic, minor where its minor 3rd sounds more than its major. */
export function guessKey(midis) {
  const last = midis[midis.length - 1], pc = (m) => ((Math.round(m) % 12) + 12) % 12, t = pc(last);
  const n = (i) => midis.filter((m) => pc(m) === (t + i) % 12).length;
  const names = ["C", "C#", "D", "Eb", "E", "F", "F#", "G", "Ab", "A", "Bb", "B"];
  return { tonic: names[t], mode: n(3) > n(4) ? "minor" : "major" };
}
