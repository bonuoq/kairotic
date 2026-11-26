// SPDX-License-Identifier: MPL-2.0
// Bach's own figures for the chorales' phrases: the Bach Chorales Figured Bass dataset (BCFB; Ju, McKay, Fujinaga et al.,
// ISMIR 2020; https://github.com/juyaolongpaul/Bach_chorale_FB, CC BY 4.0): 139 chorales from the cantatas with the
// figures of their continuo parts, after the Neue Bach-Ausgabe.
//   node studies/_shared/chorales/tools/bcfb.mjs <the dataset's FB_source/musicXML_master dir> <its reference_table.csv>
//        [phrases file] [out file]
// → out file (default studies/_shared/chorales/figures.json): {source, license, matched, phrases: {id: phrase}}, a phrase
//   {file, transpose, differs?, figures: [[figure] a quarter]}, a figure {at: offset in the quarter (0, 0.5…), f: ["6", "♯4", "2"]}
//   — the figures Bach wrote that begin in that quarter, as he wrote them: an empty quarter has none (his bass struck
//   unfigured, a 5/3, or a figure held on); a number with its accidental before it ("♯6", "♮7", "♭3"), an accidental
//   alone for the 3rd ("♯"), "6\\" a raised 6 written with a stroke (as "♯6"), "_" a line holding the figure before.
// A phrase of phrases.json is matched to a BCFB chorale by its Breitkopf number, then found in it by its soprano and its
// bass a quarter at a time (the soprano's same notes, transposed alike: `transpose` the semitones from the dataset to
// the edition; the bass's same pitch classes, an octave apart now and then, but for one quarter in eight at most, in
// `differs`: a quarter where the editions' basses are other notes, its figures not to be trusted).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const STEP = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const ACC = { sharp: "♯", flat: "♭", natural: "♮", "double-sharp": "𝄪", "flat-flat": "𝄫", backslash: "\\", slash: "/", cross: "+" };
const all = (re, s) => [...s.matchAll(re)];
const tag = (name, s) => { const m = new RegExp(`<${name}[^>]*>([^<]*)</${name}>`).exec(s); return m ? m[1].trim() : null; };

/** A part of a MusicXML score: its notes [{on, dur, midi}] (quarters, the first voice) and its figures [{on, f}]. */
export function partOf(xml) {
  let divisions = 1, t = 0;
  const notes = [], figures = [];
  for (const [, measure] of all(/<measure\b[^>]*>([\s\S]*?)<\/measure>/g, xml)) {
    let fbAt = 0; // figures before a note: the first at its onset, each later one after the one before's duration
    for (const [el] of all(/<(attributes|figured-bass|note|backup|forward)\b[\s\S]*?<\/\1>/g, measure)) {
      if (el.startsWith("<attributes")) { const d = tag("divisions", el); if (d) divisions = Number(d); continue; }
      if (el.startsWith("<backup")) { t -= Number(tag("duration", el)) / divisions; continue; }
      if (el.startsWith("<forward")) { t += Number(tag("duration", el)) / divisions; continue; }
      if (el.startsWith("<figured-bass")) {
        const f = all(/<figure>([\s\S]*?)<\/figure>/g, el).map(([, g]) => {
          const pre = tag("prefix", g), num = tag("figure-number", g), suf = tag("suffix", g);
          if (/<extend/.test(g) && !num && !pre) return "_";
          return (pre ? ACC[pre] || pre : "") + (num || "") + (suf ? ACC[suf] || suf : "");
        }).filter(Boolean);
        figures.push({ on: t + fbAt, f });
        const d = tag("duration", el); if (d) fbAt += Number(d) / divisions;
        continue;
      }
      // a note
      if (/<chord\s*\/>/.test(el) || /<grace\b/.test(el)) continue;
      const v = tag("voice", el); if (v && v !== "1") continue;
      const dur = Number(tag("duration", el) || 0) / divisions;
      const step = tag("step", el);
      const midi = step ? STEP[step] + Number(tag("alter", el) || 0) + 12 * (Number(tag("octave", el)) + 1) : null;
      const tiedOn = /<tie type="stop"/.test(el);
      if (tiedOn && notes.length && notes[notes.length - 1].midi === midi) notes[notes.length - 1].dur += dur;
      else notes.push({ on: t, dur, midi });
      t += dur; fbAt = 0;
    }
  }
  return { notes, figures };
}

/** The parts of a score, in order. */
export const partsOf = (xml) => all(/<part id="[^"]*">([\s\S]*?)<\/part>/g, xml).map(([, p]) => partOf(p));

/** The note sounding at each whole quarter, MIDI (null a rest). */
export function grid(notes) {
  const end = notes.length ? notes[notes.length - 1].on + notes[notes.length - 1].dur : 0, out = [];
  let i = 0;
  for (let q = 0; q < end - 1e-9; q++) {
    while (i + 1 < notes.length && notes[i + 1].on <= q + 1e-9) i++;
    out.push(notes[i].on <= q + 1e-9 ? notes[i].midi : null);
  }
  return out;
}

/** Where a phrase's soprano and bass are in a chorale's: {at, transpose, differs} or null — the soprano the same notes
 *  (transposed alike), the bass the same pitch classes (the editions put a bass note in another octave now and then)
 *  but for one quarter in eight at most, those quarters listed in `differs`. */
export function find(S, B, s, b) {
  const n = s.length, mod = (x) => ((x % 12) + 12) % 12, most = Math.max(1, Math.floor(n / 8));
  for (let at = 0; at + n <= S.length; at++) {
    if (S[at] == null) continue;
    const k = s[0] - S[at];
    let ok = true;
    const differs = [];
    for (let i = 0; ok && i < n; i++) {
      ok = S[at + i] != null && s[i] - S[at + i] === k;
      if (ok && (B[at + i] == null || mod(b[i] - B[at + i] - k) !== 0)) { differs.push(i); ok = differs.length <= most; }
    }
    if (ok) return { at, transpose: k, differs };
  }
  return null;
}

/** The figures that begin in each quarter of [at, at + n). */
export function figuresIn(figures, at, n) {
  const out = Array.from({ length: n }, () => []);
  for (const { on, f } of figures) {
    const q = Math.floor(on + 1e-9) - at;
    if (q >= 0 && q < n && f.length) out[q].push({ at: Math.round((on - Math.floor(on + 1e-9)) * 1000) / 1000, f });
  }
  return out;
}

/** The Breitkopf numbers of each dataset chorale ("33.06" → [ … ]), from its reference table. */
export function breitkopf(csv) {
  const out = {};
  for (const line of csv.split(/\r?\n/)) {
    const cells = line.match(/("([^"]|"")*"|[^,]*)(,|$)/g)?.map((c) => c.replace(/,$/, "").replace(/^"|"$/g, ""));
    if (!cells || !/^\*?\d/.test(cells[0] || "")) continue;
    out[cells[0].replace(/^\*/, "")] = (cells[1] || "").split("/").map(Number).filter(Boolean);
  }
  return out;
}

const main = () => {
  const [dir, table, phrasesFile = "studies/_shared/chorales/phrases.json", outFile = "studies/_shared/chorales/figures.json"] = process.argv.slice(2);
  const { phrases } = JSON.parse(readFileSync(phrasesFile, "utf8"));
  const numbers = breitkopf(readFileSync(table, "utf8"));
  const byChorale = {};
  for (const p of phrases) (byChorale[p.chorale] ||= []).push(p);
  const out = {}, files = readdirSync(dir).filter((f) => /\.(musicxml|xml)$/.test(f)).sort();
  let chorales = 0;
  for (const file of files) {
    const m = /BWV_(\d+\.\d+)/.exec(file); if (!m) continue;
    const nums = numbers[m[1]] || numbers[m[1].replace(/\.0(\d)$/, ".$1")] || [];
    const parts = partsOf(readFileSync(join(dir, file), "utf8"));
    if (parts.length < 2) continue;
    // the bass: the continuo, the part with the figures (or the last); the soprano: whichever part sings the phrase's
    // (a score may begin with the instruments that double it)
    const fig = parts.find((p) => p.figures.length) || parts[parts.length - 1];
    const B = grid(fig.notes), sopranos = parts.filter((p) => p !== fig).map((p) => grid(p.notes));
    let any = false;
    for (const n of nums) for (const p of byChorale[n] || []) {
      if (out[p.id]) continue;
      const s = p.satb.map((c) => c[0]), b = p.satb.map((c) => c[3]);
      let hit = null;
      for (const S of sopranos) if ((hit = find(S, B, s, b))) break;
      if (!hit) continue;
      out[p.id] = { file, transpose: hit.transpose, ...(hit.differs.length ? { differs: hit.differs } : {}), figures: figuresIn(fig.figures, hit.at, p.satb.length) };
      any = true;
    }
    if (any) chorales++;
  }
  const sorted = Object.fromEntries(Object.keys(out).sort().map((k) => [k, out[k]]));
  writeFileSync(outFile, JSON.stringify({
    source: "Yaolong Ju, Sylvain Margot, Cory McKay, Luke Dahn, Ichiro Fujinaga, The Bach Chorales Figured Bass dataset (BCFB, 2020), https://github.com/juyaolongpaul/Bach_chorale_FB, after the Neue Bach-Ausgabe; matched to phrases.json",
    license: "CC BY 4.0 (https://creativecommons.org/licenses/by/4.0/): the figures are the dataset's",
    matched: { chorales, phrases: Object.keys(sorted).length },
    phrases: sorted,
  }));
  console.log(`${chorales} chorales, ${Object.keys(sorted).length} phrases → ${outFile}`);
};
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) main();
