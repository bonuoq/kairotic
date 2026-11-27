// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 75 · Seikilos's song sung in the Greek system of Study 74 (greek.mjs): the Iastian tonos, the
// diatonic genus, in Aristoxenus's shade or in Archytas's. The edition writes the song in modern notes (a tone 200
// cents); here each of them becomes the note of the system that sounds nearest — in Aristoxenus's shade the same
// pitches, in Archytas's the ratios of his tetrachord (28/27 · 8/7 · 9/8), so that, with the mese on f♯, the
// trite synemmenon g and the trite hyperbolaion d' come out a third of a semitone low, and the paranete synemmenon a a
// little.

import { greekSystem } from "../../74-aoidos/kairotic/greek.mjs";
import * as SK from "../../74-aoidos/kairotic/seikilos.mjs";

export const SHADES = ["aristoxenus", "archytas"];

/** Each MIDI number (the transcription's) → the system's note that sounds nearest, within tol cents (else the
 *  transcription's own pitch, noted): [{midi, code, name, dev (cents from the transcription)}]. Where two notes are
 *  as near, the one whose degree is nearest the note before (the line read as it moves). */
export function tuneTo(midis, S, tol = 50) {
  const out = [];
  midis.forEach((m) => {
    const cands = S.notes.map((c) => ({ c, d: Math.abs(S.midi(c) - m) * 100 })).filter((x) => x.d <= tol);
    if (!cands.length) { out.push({ midi: m, code: null, name: "(not in the system)", dev: 0 }); return; }
    const prev = [...out].reverse().find((x) => x.code !== null);
    cands.sort((a, b) => a.d - b.d || (prev ? Math.abs(S.deg(a.c) - S.deg(prev.code)) - Math.abs(S.deg(b.c) - S.deg(prev.code)) : 0));
    const c = cands[0].c;
    out.push({ midi: S.midi(c), code: c, name: S.greekName(c), dev: Math.round((S.midi(c) - m) * 100) });
  });
  return out;
}

/** Seikilos's song as notes for the voice (tract.mjs's shape), in the Iastian diatonic of a shade, a chronos `chronos`
 *  seconds; each note also says its sign, its name in the system and how far it is from the transcription. */
export function seikilos({ shade = "aristoxenus", chronos = 0.42 } = {}) {
  const S = greekSystem({ tonos: "iastian", genera: ["diatonic"], shade });
  const ns = SK.notes(), tuned = tuneTo(ns.map((n) => n.midi), S);
  let t = 0;
  return {
    system: S.name,
    notes: ns.map((n, i) => {
      const x = { t, dur: n.chronoi * chronos, midi: tuned[i].midi, syl: n.first ? n.text : "", sign: n.sign, name: tuned[i].name, dev: tuned[i].dev };
      t += n.chronoi * chronos;
      return x;
    }),
  };
}
