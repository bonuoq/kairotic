// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: a bass under Bach's soprano as a score (the page's, and the tests'): MEI for Verovio, three
// staves — Bach's soprano; our bass with its figures in Bach's abbreviations; Bach's bass with the figures his four
// voices make (continuo.mjs's figureOf) — the notes spelt in the chorale's key signature.
//
// Pure data and functions.

import * as C from "./continuo.mjs";
import { letterPcs, keyOfName } from "./under.mjs";

// ─── spelling, for the score: a pitch by the letter the quarter's local key gives it (its leading tone raised in
// minor), else its natural letter, else raised in a sharp key, lowered in a flat one; its accidental against the
// chorale's key signature ───
const LETTERS = "cdefgab", NAT = [0, 2, 4, 5, 7, 9, 11];
const mod = (a, m) => ((a % m) + m) % m;
export function speller(key) {
  const home = letterPcs(key), fifths = C.signature(key).reduce((a, b) => a + b, 0);
  return {
    sig: fifths === 0 ? "0" : fifths > 0 ? `${fifths}s` : `${-fifths}f`,
    note(midi, local = key) {
      const pc = mod(midi, 12), loc = letterPcs(local);
      if (/minor/.test(local.mode || "")) { const lt = (LETTERS.indexOf(String(local.tonic)[0].toLowerCase()) + 6) % 7; loc[lt] = mod(loc[lt] + 1, 12); }
      let i = loc.indexOf(pc);
      if (i < 0) i = home.indexOf(pc);
      if (i < 0) i = NAT.indexOf(pc);
      if (i < 0) i = fifths >= 0 ? NAT.findIndex((x) => mod(x + 1, 12) === pc) : NAT.findIndex((x) => mod(x - 1, 12) === pc);
      const a = mod(pc - NAT[i] + 6, 12) - 6, oct = Math.floor((midi - NAT[i] - a) / 12) - 1;
      const name = { "-2": "ff", "-1": "f", 0: "n", 1: "s", 2: "x" }[a];
      return `pname="${LETTERS[i]}" oct="${oct}"` + (pc === home[i] ? (a ? ` accid.ges="${name}"` : "") : ` accid="${name}"`);
    },
  };
}

// ─── our figures in Bach's abbreviations (continuo.mjs's BACH_WRITES), the accidentals figureText marked kept ───
export function abbreviate(full, figure) {
  if (/^\d$/.test(full)) return [full];                          // a suspension and its resolution: 4, 3
  const marks = {};
  for (const x of full.split("/")) { const m = /^([♯♭♮]?)(\d+)$/.exec(x); if (m && m[1]) marks[m[2]] = m[1]; }
  const nums = (C.BACH_WRITES[figure] || []).map((n) => (marks[n] || "") + n);
  if (marks[3] && !(C.BACH_WRITES[figure] || []).includes("3")) nums.push(marks[3]);
  return nums;
}
/** A figure under a staff (MEI's harm/fb), at a quarter's beat (`t` + 1 in its measure). */
export const fb = (staff, t, nums) => (nums.length ? `<harm staff="${staff}" tstamp="${t + 1}"><fb>${nums.map((x) => `<f>${x}</f>`).join("")}</fb></harm>` : "");

/**
 * The phrase and our bass as MEI: a measure a quarter, its barline unseen (so each accidental is written where it
 * sounds), the figures under the two basses, the fermata on the last quarter. p: a corpus phrase ({id, key, satb,
 * names}); ours: bassUnder's ({bass, figures, chords}).
 */
export function meiOf(p, ours) {
  const sp = speller(p.key), n = p.satb.length;
  const bach = p.satb.map((c, t) => C.figureOf(p.names[t], p.key, t ? p.names[t - 1] : null));
  const note = (m, k) => `<note dur="4" ${sp.note(m, k ? keyOfName(k) : p.key)}/>`;
  const measures = p.satb.map((c, t) => `<measure n="${t + 1}" right="${t === n - 1 ? "end" : "invis"}">` +
    `<staff n="1"><layer n="1">${note(c[0], p.keys && p.keys[t])}</layer></staff><staff n="2"><layer n="1">${note(ours.bass[t], ours.keys[t])}</layer></staff><staff n="3"><layer n="1">${note(c[3], p.keys && p.keys[t])}</layer></staff>` +
    fb(2, 0, abbreviate(ours.figures[t], ours.chords[t].figure)) + fb(3, 0, bach[t]) + (t === n - 1 ? `<fermata staff="1" tstamp="1"/>` : "") + `</measure>`).join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?><mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0"><meiHead><fileDesc><titleStmt><title>${p.id}</title></titleStmt><pubStmt/></fileDesc></meiHead><music><body><mdiv><score>
<scoreDef key.sig="${sp.sig}" meter.count="1" meter.unit="4" meter.form="invis"><staffGrp symbol="bracket">
<staffDef n="1" lines="5" clef.shape="G" clef.line="2" label="Bach's soprano"/>
<staffDef n="2" lines="5" clef.shape="F" clef.line="4" label="our bass"/>
<staffDef n="3" lines="5" clef.shape="F" clef.line="4" label="Bach's bass"/></staffGrp></scoreDef>
<section>
${measures}
</section></score></mdiv></body></music></mei>`;
}
