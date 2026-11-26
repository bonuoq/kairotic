// SPDX-License-Identifier: MPL-2.0
// Study 75 · voice: the kernel's tests, without Faust. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/75-voice/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as P from "../kairotic/phonemes.mjs";
import * as T from "../kairotic/tract.mjs";
import { readMei } from "../kairotic/mei.mjs";
import { exportMei } from "../../74-aoidos/kairotic/export.mjs";
import * as S from "../../74-aoidos/kairotic/seikilos.mjs";

const J = (x) => JSON.stringify(x);
const ph = (t, pron) => { const s = P.syllablePhonemes(t, pron); return [...s.onset, "|", ...s.nucleus, "|", ...s.coda].join(" "); };

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // ── the sounds of a syllable ──
  is("Attic: the rough breathing an h, ζ as zd, η an open e, a final σ", ph("Ὅ") === "h | o |" && ph("ζῇς") === "z d | ɛ | s");
  is("Attic: φ θ χ aspirated stops, αι a diphthong, ει a close e", ph("φαί") === "pʰ | a i |" && ph("θεῖ") === "tʰ | e |" && ph("χρό") === "kʰ r | o |");
  is("Koine (Seikilos's time): no h, ζ a z, αι an open e, ει an i, οι a y",
     ph("Ὅ", "koine") === "| o |" && ph("ζῇς", "koine") === "z | ɛ | s" && ph("φαί", "koine") === "pʰ | ɛ |" && ph("τεῖ", "koine") === "t | i |" && ph("τοί", "koine") === "t | y |");
  is("ξ and ψ are two consonants each; ου a long u", ph("ξέ") === "k s | e |" && ph("ψυ") === "p s | y |" && ph("νου") === "n | u |");
  const gg = P.linePhonemes(["ἄγ", "γε", "λος"]);
  is("γ before a velar is ŋ, across syllables (ἄγ-γε-λος)", gg[0].coda[0] === "ŋ" && gg[1].onset[0] === "g");
  is("every phoneme the readings give is in the table", ["attic", "koine"].every((pr) => S.SONG.flat().every(([t]) => {
    const s = P.syllablePhonemes(t, pr); return [...s.onset, ...s.nucleus, ...s.coda].every((p) => P.TABLE[p]); })));
  const big = P.scaled(P.TABLE, 1.1);
  is("a smaller voice: formants and frication × size, the unknown kept unknown", big.a.F[1] === 1430 && big.s.FC === 6050 && big.k.F[1] === null);

  // ── the timeline ──
  const line = [{ t: 0, dur: 0.6, midi: 60, syl: "φαί" }, { t: 0.6, dur: 0.6, midi: 62, syl: "νου" }];
  const G = T.segments(line);
  notes.push("φαί-νου: " + G.segments.map((s) => `${s.p}${s.kind === "closure" ? "(cl)" : s.kind === "burst" ? "(b)" : s.kind === "aspiration" ? "(h)" : ""} ${s.from.toFixed(3)}`).join(", "));
  const firstVowel = G.segments.find((s) => s.kind === "vowel");
  is("the onset consonants come before the note: its vowel starts on the beat", Math.abs(firstVowel.from - (0 + G.offset)) < 1e-9 && G.offset > 0.1);
  const kinds = G.segments.filter((s) => s.p === "pʰ").map((s) => s.kind).join();
  is("an aspirated stop: closure, burst, then a long aspiration", kinds === "closure,burst,aspiration" &&
     G.segments.find((s) => s.p === "pʰ" && s.kind === "aspiration").AH >= 0.5);
  is("a diphthong is two vowel targets, the first longer", G.segments.filter((s) => s.syl === 0 && s.kind === "vowel").map((s) => s.p).join() === "a,i");
  const nu = G.segments.find((s) => s.p === "n"), vEnd = G.segments.filter((s) => s.syl === 0 && s.kind === "vowel").pop().to;
  is("the next syllable's onset takes time from the end of this one", Math.abs(nu.to - (0.6 + G.offset)) < 1e-9 && Math.abs(vEnd - nu.from) < 1e-9);
  const tight = T.segments([{ t: 0, dur: 0.2, midi: 60, syl: "ἐχθ" }, { t: 0.2, dur: 0.2, midi: 60, syl: "ρός" }]);
  const cons = tight.segments.filter((s) => s.kind !== "vowel" && s.from >= tight.segments.find((x) => x.kind === "vowel").from);
  const consTime = cons.reduce((a, s) => a + s.to - s.from, 0) - (tight.segments.filter((s) => s.syl === 1 && s.p === "s").reduce((a, s) => a + s.to - s.from, 0));
  is("consonants squeezed into at most 45% of a short syllable", consTime <= 0.45 * 0.2 + 1e-9);
  const gap = T.segments([{ t: 0, dur: 0.5, midi: 60, syl: "ὁ" }, { t: 0.9, dur: 0.5, midi: 60, syl: "σὺ" }]);
  const sAt = gap.segments.find((s) => s.p === "s");
  is("after a rest, the onset sits in the rest, just before its note", sAt.from > 0.5 + gap.offset && Math.abs(sAt.to - (0.9 + gap.offset)) < 1e-9);

  // ── the curves ──
  const C = T.curves([{ t: 0, dur: 0.5, midi: 48, syl: "πα" }, { t: 0.5, dur: 0.5, midi: 55, syl: "σι" }]);
  const at = (t) => C.frames[Math.round((t + C.offset) / C.hop)];
  notes.push(`πα-σι: ${C.frames.length} frames; in α ${J(at(0.25))}; in ι ${J(at(0.8))}`);
  is("a frame every 5 ms, from the first consonant to a tail after the last", C.hop === 0.005 && C.frames.length === Math.ceil((C.segments.at(-1).to + 0.3) / 0.005));
  is("the formants of α in the middle of its note, of ι in the middle of its", Math.abs(at(0.2).F2 - 1300) < 20 && Math.abs(at(0.8).F2 - 2300) < 20 && at(0.2).AV === 1);
  const sMid = C.segments.find((s) => s.p === "s"), sFrame = C.frames[Math.round(((sMid.from + sMid.to) / 2) / C.hop)];
  is("σ: frication at its centre, no voice", sFrame.AF > 0.9 && sFrame.AV < 0.05 && sFrame.FC === 5500);
  const burst = C.segments.find((s) => s.kind === "burst");
  is("a burst shorter than nothing is still heard: its frame has AB", C.frames[Math.floor(burst.from / C.hop)].AB > 0 || C.frames[Math.floor(burst.from / C.hop) + 1].AB > 0);
  is("the pitch follows the notes, glided", at(0.2).pitch === 48 && at(0.8).pitch === 55 && at(0.5).pitch > 48 && at(0.5).pitch < 55);
  is("the formants move between α and the σ's locus over tens of ms (a transition, not a jump)",
     (() => { const v = C.segments.find((s) => s.p === "a"); const f = Math.round(v.to / C.hop); return C.frames[f].F2 > 1300 && C.frames[f].F2 < 1700; })());

  const hi = T.curves([{ t: 0, dur: 0.6, midi: 76, syl: "ἰ" }]), hiF = hi.frames[Math.round((0.3 + hi.offset) / hi.hop)];
  const lo = T.curves([{ t: 0, dur: 0.6, midi: 76, syl: "ἰ" }], { tuneF1: false }), loF = lo.frames[Math.round((0.3 + lo.offset) / lo.hop)];
  is("an ι sung on a high e: its first formant raised just above the pitch (659 Hz), unless asked not to",
     Math.abs(hiF.F1 - 659.26 * 1.05) < 1 && loF.F1 === 300 && Math.abs(at(0.8).F1 - 300) < 1);

  // ── from aoidos's MEI ──
  const sk = S.notes().map((n) => ({ midi: n.midi, units: n.chronoi, syl: n.first ? n.text : null }));
  const { mei } = exportMei({ title: "Seikilos", voices: [{ notes: sk }], unitDen: 8, unitsPerBar: 6, meter: [6, 8] });
  const R = readMei(mei, { bpm: 60 });
  is("Seikilos's song read back from MEI: 37 notes, each with its pitch and time", R.notes.length === 37 && R.notes.every((n, i) => n.midi === sk[i].midi && Math.abs(n.dur - sk[i].units * 0.5) < 1e-6));
  is("… the syllables on the first note of each, a melisma's other notes none", R.notes[3].syl === "φαί" && R.notes[4].syl === "" && R.notes[5].syl === "" && R.notes[6].syl === "νου");
  is("… 28 syllables, as the song has", T.syllables(R.notes).length === S.SONG.flat().length);
  const tie = readMei(exportMei({ voices: [{ notes: [{ midi: 64, units: 3, syl: "ὦ" }, { midi: 62, units: 1, syl: "δε" }] }], unitDen: 2, unitsPerBar: 2 }).mei, { bpm: 60 });
  is("a note tied over the bar line is one note (three half notes: 6 s at 60)", tie.notes.length === 2 && Math.abs(tie.notes[0].dur - 6) < 1e-9 && tie.notes[1].syl === "δε");

  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(results.map(([w, ok]) => (ok ? "  ok   " : "  FAIL ") + w).join("\n"));
  console.log(notes.map((s) => "  · " + s).join("\n"));
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
