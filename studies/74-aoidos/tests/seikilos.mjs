// SPDX-License-Identifier: MPL-2.0
// Study 74 · aoidos: Seikilos's song as the stele has it (Pöhlmann and West, DAGM no. 23) against aoidos's prosody and
// accent rules. In the browser (tests/seikilos.html) and in Node:
//   node -e 'import("./studies/74-aoidos/tests/seikilos.mjs").then(async m => process.exit(m.report(await m.run())))'
import { SONG, TEXT, notes, judgeAccent } from "../kairotic/seikilos.mjs";
import { readText } from "../kairotic/prosody.mjs";
import { aoidos, TEXTS } from "../kairotic/aoidos.mjs";

const MIDI = { C: 69, K: 73, I: 74, Z: 76, O: 71, Φ: 67, X: 66, E: 64 };

export async function run() {
  const results = [], notes_ = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const L = readText(TEXT); let w0 = 0; const syl = [];
  L.forEach((l, li) => { l.syllables.forEach((s) => syl.push({ ...s, word: s.word + w0, line: li })); w0 += l.words.length; });
  const flat = SONG.flat(), chronoi = flat.map(([, g]) => g.reduce((a, [, c]) => a + c, 0));
  is("the stele's 29 syllables are prosody.mjs's, one for one", syl.length === 29 && flat.every(([t], i) => t === syl[i].text));
  is("every line twelve chronoi (two bars of 6/8)", SONG.every((l) => l.reduce((a, [, g]) => a + g.reduce((b, [, c]) => b + c, 0), 0) === 12));
  const N = notes();
  is("37 notes (eight in melismas), an octave from E to e', ending on the low E (the final)", N.length === 37 && Math.min(...N.map((x) => x.midi)) === 64 && Math.max(...N.map((x) => x.midi)) === 76 && N[N.length - 1].midi === 64);
  // the rhythm is the quantity: a long syllable two chronoi or more, a short one one
  const longs = syl.map((s, i) => [s, chronoi[i]]).filter(([s]) => s.quantity === "long"), shorts = syl.map((s, i) => [s, chronoi[i]]).filter(([s]) => s.quantity === "short");
  is("the rhythm keeps the quantities: every long syllable 2 or 3 chronoi, every short one 1 (λῡποῦ marked long; ὁ χρόνος: a stop and a liquid across words, common)",
     longs.every(([, c]) => c >= 2) && shorts.every(([, c]) => c === 1) && longs.length === 13 && shorts.length === 12);
  const doubt = syl.map((s, i) => [s, chronoi[i]]).filter(([s]) => s.quantity === "doubtful");
  notes_.push(`doubtful, as the song settles them: ${doubt.map(([s, c]) => `${s.text} ${c}`).join(", ")}`);
  const R = judgeAccent(syl, flat.map(([, g]) => g.map(([s]) => MIDI[s])));
  const k = (id) => `${R[id][0]}/${R[id][1]}`;
  is("the accent rules, as the song keeps them: rise to the acute 4/5, the accent the word's highest 9/10, the circumflex falls 3/4, a fall after the accent 5/6, no fall after a grave 4/6",
     k("acute-rise") === "4/5" && k("peak") === "9/10" && k("circumflex-fall") === "3/4" && k("after-accent") === "5/6" && k("grave") === "4/6");
  is("... where it does not: φαί rises within its melisma (c♯'–d'–e') from below, Ὅσον climbs to its second syllable, ζῇς is one long e', and after σὺ and στὶ the voice falls to λυποῦ's and τὸ ζῆν's a",
     R["acute-rise"][2].map((i) => syl[i].text).join() === "φαί" && R.peak[2].map((i) => syl[i].text).join() === "Ὅ" && R["circumflex-fall"][2].map((i) => syl[i].text).join() === "ζῇς" && R.grave[2].map((i) => syl[i].text).join() === "σὺ,τὶ");
  notes_.push(Object.entries(R).map(([id, [a, n]]) => `${id} ${a}/${n}`).join(" · "));
  // the stele's rhythm is the metre's, and its melody one the engine may sing
  const T = TEXTS.seikilos, A = aoidos({ text: T.text, metre: T.metre, key: T.key });
  is("the metre «seikilos» (twelve chronoi a line, the last syllable then the longs from the end lengthened) is the stele's rhythm, syllable by syllable",
     A.syllables.length === 29 && A.syllables.every((y, i) => y.beats === chronoi[i]));
  const U = [];
  for (const line of SONG) for (const [, signs] of line) for (const [g, c] of signs) for (let j = 0; j < c; j++) U.push(A.codes.find((x) => A.midi(x) === MIDI[g] - 12));
  is("Seikilos's melody keeps every hard rule of the engine (an octave lower, E3–E4): it is one of the melodies aoidos may sing", U.length === 48 && U.every((c) => c !== undefined) && A.judge(U) === null);
  is("... but not strict: Ὅσον climbs above its accent", aoidos({ text: T.text, metre: T.metre, key: T.key, strict: true }).judge(U) !== null);
  is("... its six melismas are the engine's to choose (three notes a syllable at most)", A.melismas(U) === 6);
  // how the engine weighs it: its first choice at how many beats, and how likely it is to sing it at temperature 2
  let first = 0, lp = 0;
  for (let t = 0; t < U.length; t++) {
    const F = A.fan(U.slice(0, t)).filter((f) => f.futures > 0n), m = Math.min(...F.map((f) => f.cost));
    if ([...F].sort((a, b) => a.cost - b.cost)[0].note === U[t]) first++;
    lp += Math.log2(Math.exp((m - F.find((f) => f.note === U[t]).cost) / 2) / F.reduce((a, f) => a + Math.exp((m - f.cost) / 2), 0));
  }
  const uniform = -Math.log2(Number(A.count()));
  is("the engine's first choice at 21 of its 48 beats; at temperature 2 more likely than a melody drawn at random", first === 21 && lp > uniform);
  notes_.push(`Seikilos for the engine: first choice at ${first}/48 beats; log2 of its chance at temperature 2 ${lp.toFixed(1)}, of a melody at random ${uniform.toFixed(1)}`);
  return { results, notes: notes_ };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
