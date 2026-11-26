// SPDX-License-Identifier: MPL-2.0
// Kairotic · Study 75 · a voice's notes and syllables read from MEI, as Study 74 (aoidos) writes it: each note's
// pitch, its time and, on the first note of a syllable, <verse n="1"><syl>…</syl></verse> (a melisma's other notes
// carry none). Tied notes are one note; rests are kept as silences; a tuplet's notes take its proportion. Read with
// regular expressions, so the same code runs in the page and in Node.

const STEP = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const ACC = { s: 1, f: -1, ss: 2, x: 2, ff: -2, n: 0 };
const attr = (tag, name) => { const m = tag.match(new RegExp(`\\s${name.replace(".", "\\.")}="([^"]*)"`)); return m ? m[1] : null; };
const unxml = (s) => s.replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&quot;/g, '"').replace(/&amp;/g, "&");

/** MEI → {title, notes: [{t, dur (seconds), midi, syl}], rests: [{t, dur}]} for one staff (1 by default), at
 *  `bpm` quarter notes a minute. */
export function readMei(text, { staff = 1, bpm = 72 } = {}) {
  const title = (text.match(/<title[^>]*>([^<]*)<\/title>/) || [])[1] || "";
  const whole = 240 / bpm;               // a whole note in seconds
  const staves = [...text.matchAll(new RegExp(`<staff\\s[^>]*n="${staff}"[^>]*>([\\s\\S]*?)</staff>`, "g"))].map((m) => m[1]);
  const notes = [], rests = [];
  let t = 0, tied = null;
  for (const body of staves) {
    let scale = 1;
    const tokens = body.matchAll(/<(tuplet)\b[^>]*>|<\/(tuplet)>|<(note|rest|mRest)\b[^>]*?(?:\/>|>([\s\S]*?)<\/\3>)/g);
    for (const m of tokens) {
      if (m[1]) { const num = +attr(m[0], "num") || 1, nb = +attr(m[0], "numbase") || 1; scale = nb / num; continue; }
      if (m[2]) { scale = 1; continue; }
      const tag = m[0], kind = m[3];
      const dur = +attr(tag, "dur") || 4, dots = +attr(tag, "dots") || 0;
      const secs = kind === "mRest" ? 0 : (whole / dur) * (2 - 1 / 2 ** dots) * scale;
      if (kind !== "note") { if (secs) rests.push({ t, dur: secs }); t += secs; tied = null; continue; }
      const pname = attr(tag, "pname"), oct = +attr(tag, "oct");
      const acc = attr(tag, "accid") ?? attr(tag, "accid.ges");
      const midi = 12 * (oct + 1) + STEP[pname] + (acc ? ACC[acc] || 0 : 0);
      const tie = attr(tag, "tie");
      const sylM = (m[4] || "").match(/<verse\b[^>]*n="1"[^>]*>[\s\S]*?<syl\b[^>]*>([\s\S]*?)<\/syl>/) || (m[4] || "").match(/<verse\b(?![^>]*type="cents")[^>]*>[\s\S]*?<syl\b[^>]*>([\s\S]*?)<\/syl>/);
      const syl = sylM ? unxml(sylM[1]).trim() : "";
      if (tied && (tie === "m" || tie === "t") && tied.midi === midi) tied.dur += secs;
      else notes.push((tied = { t, dur: secs, midi, syl }));
      if (!(tie === "i" || tie === "m")) tied = null;
      t += secs;
    }
  }
  notes.forEach((n) => { n.t = Math.round(n.t * 1e4) / 1e4; n.dur = Math.round(n.dur * 1e4) / 1e4; });
  return { title, notes, rests };
}
