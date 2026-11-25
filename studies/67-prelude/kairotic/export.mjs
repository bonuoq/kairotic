// SPDX-License-Identifier: MPL-2.0
// Kairotic · the studies' export (discussion #319): what a study made, as MEI the app opens as a tree box
// (kairotic.mei, Study 55). Every study that makes music keeps a copy of this file beside its kernel (the copies are
// checked equal in tests/export.mjs); this one, in studies/_shared, is the original.
//
//   voices      each a list of notes {name ("F#4", "Bb3", or null: a rest), units} — or made from a list of names a
//               unit each (fromUnits: a name repeated is a note held, unless the unit is struck again)
//   lyrics      a note may carry the syllable it begins, {syl, wordpos ("i" | "m" | "t"; none: a word of one
//               syllable), con}, and the syllables of the verses after the first, verses [{syl, wordpos, con} …]
//               (verse 2, 3 …: a strophe and its antistrophe); written as MEI's <verse n><syl> on the note, on its
//               first piece when it is cut at a bar line. The notes after it with no syllable (of that verse) sing
//               it on: a melisma. con, when not given: "d" (a hyphen) after a word's first or middle syllable, "u"
//               (an extender) after its last one, or a word of one, when a melisma follows
//   microtones  a note may say its exact pitch, midi (a fraction: 60.5 a quarter tone above C4): it is written as
//               the app writes one (kairotic.mt) — its name (or the nearest, spelled for the key), a quarter-tone
//               accidental where it is half-way (± 8 cents) — and its exact Hz kept for it in the extMeta, by the
//               xml:id of its first written note, as kairotic.mei reads it: the app plays it at that pitch
//   time        a unit is 1/unitDen of a whole note (2: a half note, 4: a quarter; 6: a third of a half note, in
//               tuplets); unitsPerBar a bar; pickup units before the first bar line (an upbeat); notes are cut at
//               the bar lines and tied
//   spelling    the key's signature; an accidental written where the bar has not already said it, a natural where
//               the bar or the signature said otherwise (the app reads accidentals for their bar)
//   marks       text over a staff (a key reached, a phrase's plan), and figures under the bass (<harm><fb>)
//   the extMeta <extMeta type="kairotic">, EDN as kairotic.mei reads it: {:kairotic 1 :root-tag :par :root {…}} — the
//               root's attributes are what the study knows that MEI has no place for (its schema, figures, rules,
//               counts, the phrases and their derivations…); the app keeps them on the tree's root

const LETTERS = "CDEFGAB", WHITE = [0, 2, 4, 5, 7, 9, 11];
const SIG = { C: 0, G: 1, D: 2, A: 3, E: 4, B: 5, "F#": 6, "C#": 7, F: -1, Bb: -2, Eb: -3, Ab: -4, Db: -5, Gb: -6, Cb: -7 };
const RELATIVE = { A: "C", E: "G", B: "D", "F#": "A", "C#": "E", "G#": "B", "D#": "F#", D: "F", G: "Bb", C: "Eb", F: "Ab", Bb: "Db", Eb: "Gb" };
const SHARPS = "FCGDAEB", FLATS = "BEADGCF";
const ACC = { "-2": "ff", "-1.5": "3qf", "-1": "f", "-0.5": "1qf", 0: "n", 0.5: "1qs", 1: "s", 1.5: "3qs", 2: "x" };
const SHARP_NAMES = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"], FLAT_NAMES = ["C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B"];
const NAME = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/;
/** The 12-TET MIDI number of a written name. */
const midiOfName = (nm) => { const m = NAME.exec(plain(nm)); if (!m) return null; const alt = !m[2] ? 0 : m[2][0] === "#" ? m[2].length : -m[2].length; return 12 * (Number(m[3]) + 1) + WHITE[LETTERS.indexOf(m[1])] + alt; };
/**
 * How a note is written: {L (letter), oct, alt (−2 … 2 by halves: ±0.5 a quarter tone), hz (its exact pitch, when it
 * is not the written one)}, from its name, its midi (a fraction), or both (the name as written, the midi as it sounds).
 */
export function writtenOf(n, fifths = 0) {
  let L, oct, alt, base;
  const m = n.name && NAME.exec(plain(n.name));
  if (m) { L = m[1]; oct = Number(m[3]); alt = !m[2] ? 0 : m[2][0] === "#" ? m[2].length : -m[2].length; base = midiOfName(n.name); }
  else if (typeof n.midi === "number") {
    const r = Math.round(n.midi), nm = (fifths < 0 ? FLAT_NAMES : SHARP_NAMES)[((r % 12) + 12) % 12];
    L = nm[0]; alt = nm.length > 1 ? (nm[1] === "#" ? 1 : -1) : 0; base = r;
    oct = Math.floor((r - WHITE[LETTERS.indexOf(L)] - alt) / 12) - 1;
  } else return null;
  if (typeof n.midi !== "number") return { L, oct, alt, hz: null };
  let dev = (n.midi - base) * 100;
  // half-way between two semitones (± 8 cents): a quarter-tone accidental
  if (Math.abs(dev - 50) < 8 && alt <= 1.5) { alt += 0.5; dev -= 50; }
  else if (Math.abs(dev + 50) < 8 && alt >= -1.5) { alt -= 0.5; dev += 50; }
  const hz = Math.abs(dev) < 0.5 && Number.isInteger(alt) ? null : Math.round(440 * Math.pow(2, (n.midi - 69) / 12) * 1000) / 1000;
  return { L, oct, alt, hz };
}

/** A name normalized: "F♯4" → "F#4", "B♭3" → "Bb3". */
export const plain = (s) => String(s).replace(/♯/g, "#").replace(/♭/g, "b").replace(/𝄪/g, "##").replace(/𝄫/g, "bb");
/** The key signature of a key ({tonic, mode}): fifths (−7 … 7). A church mode's is its scale's on that tonic (D
 *  dorian none, G dorian one flat, A phrygian one sharp…). */
const MODE_FIFTHS = { ionian: 0, dorian: -2, phrygian: -4, lydian: 1, mixolydian: -1, aeolian: -3 };
export function fifthsOf(key = { tonic: "C" }) {
  const t = plain(key.tonic || "C");
  if (key.mode in MODE_FIFTHS) { const f = (SIG[t] ?? 0) + MODE_FIFTHS[key.mode]; return f >= -7 && f <= 7 ? f : 0; }
  return SIG[key.mode === "minor" ? RELATIVE[t] ?? "C" : t] ?? 0;
}
/** The alteration of each letter in a signature: {F: 1, C: 1…}. */
function sigMap(fifths) {
  const m = {};
  if (fifths > 0) for (const L of SHARPS.slice(0, fifths)) m[L] = 1;
  if (fifths < 0) for (const L of FLATS.slice(0, -fifths)) m[L] = -1;
  return m;
}

/** The bars of units that say which are strong (a bar begins on each): {pickup (units before the first strong one),
 *  unitsPerBar (between the first two strong ones; 2 when there is one)}. */
export function barsOf(strong) {
  const s = strong.map((x, t) => (x ? t : -1)).filter((t) => t >= 0);
  return { pickup: s.length ? s[0] : 0, unitsPerBar: s.length > 1 ? s[1] - s[0] : 2 };
}

/** Notes from names a unit each — or {name, midi} (a pitch off 12-TET), or {midi} — : a pitch repeated is held
 *  (struck[t], where given, says whether unit t is struck again); null a rest. */
export function fromUnits(names, struck = null) {
  const out = [];
  const keyOf = (x) => (x ? `${x.name ?? ""}|${x.midi ?? ""}` : "rest");
  names.forEach((nm, t) => {
    const x = nm === null || nm === undefined ? null : typeof nm === "string" ? { name: plain(nm) } : { ...(nm.name ? { name: plain(nm.name) } : {}), ...(typeof nm.midi === "number" ? { midi: nm.midi } : {}) };
    const last = out[out.length - 1];
    const same = last && keyOf(last.x) === keyOf(x);
    const again = struck ? !!struck[t] : !same;
    if (last && !again && same) last.units++;
    else out.push({ name: x ? x.name ?? null : null, ...(x && "midi" in x ? { midi: x.midi } : {}), units: 1, x });
  });
  return out.map(({ x, ...n }) => (x === null ? { ...n, name: null } : n));
}

// written durations, in whole notes, longest first: [value, @dur, @dots]
const DURS = [[1, "1", 0], [3 / 4, "2", 1], [1 / 2, "2", 0], [3 / 8, "4", 1], [1 / 4, "4", 0], [3 / 16, "8", 1], [1 / 8, "8", 0], [1 / 16, "16", 0], [1 / 32, "32", 0]];
const pieces = (w) => { const out = []; let x = w; while (x > 1e-9) { const d = DURS.find(([v]) => v <= x + 1e-9); if (!d) break; out.push(d); x -= d[0]; } return out; };

/** EDN of a JS value: objects as maps with keyword keys, arrays as vectors, {kw: "par"} a keyword, {strkeys: {…}} a
 *  map with string keys. */
export function edn(v) {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "nil";
  if (typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return "[" + v.map(edn).join(" ") + "]";
  if (typeof v === "object" && Object.keys(v).length === 1 && typeof v.kw === "string") return ":" + v.kw;
  // ({strkeys: {…}}: a map whose keys stay strings, as xml:ids do)
  if (typeof v === "object" && Object.keys(v).length === 1 && v.strkeys && typeof v.strkeys === "object") return "{" + Object.entries(v.strkeys).map(([k, x]) => JSON.stringify(k) + " " + edn(x)).join(", ") + "}";
  return "{" + Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => ":" + k.replace(/[^A-Za-z0-9*+!_?<>=.-]/g, "-") + " " + edn(x)).join(", ") + "}";
}
const xml = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

/** The syllables a note begins, a verse each (verse 1 first; null where that verse has none here). */
const versesOf = (n) => {
  const v1 = n.syl !== undefined && n.syl !== null && n.syl !== "" ? { syl: n.syl, wordpos: n.wordpos, con: n.con } : null;
  const vs = [v1, ...(Array.isArray(n.verses) ? n.verses.map((x) => (x && x.syl !== undefined && x.syl !== null && x.syl !== "" ? x : null)) : [])];
  while (vs.length && vs[vs.length - 1] === null) vs.pop();
  return vs;
};
/**
 * The <verse>s of the i-th note of a voice's notes: each syllable with its wordpos and its con (given, or: "d" after
 * a word's first or middle syllable; "u" after its last, or a word of one, when the next note sings it on — a note
 * with no syllable of that verse, not a rest).
 */
export function versesXml(notes, i) {
  const n = notes[i];
  if (!n || !(n.name || typeof n.midi === "number")) return "";
  const next = notes[i + 1];
  return versesOf(n).map((v, k) => {
    if (!v) return "";
    const wp = v.wordpos || null;
    const melisma = !!next && !!(next.name || typeof next.midi === "number") && !versesOf(next)[k];
    const con = v.con || (wp === "i" || wp === "m" ? "d" : melisma ? "u" : null);
    return `<verse n="${k + 1}"><syl${wp ? ` wordpos="${wp}"` : ""}${con ? ` con="${con}"` : ""}>${xml(v.syl)}</syl></verse>`;
  }).join("");
}
/** A file name from a title: "A period in C" → "a-period-in-c.mei". */
export const fileName = (title, ext = ".mei") => (String(title).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "kairotic") + ext;

/**
 * The MEI of what a study made. spec:
 *   title, source (the study), key {tonic, mode}
 *   voices [{label, clef ("G" | "F", or by its notes), notes [{name | null, units, syl?, wordpos?, con?, verses?}]}],
 *   top first
 *   unitDen (2: a unit is a half note), unitsPerBar (2), meter [count, unit] (default from them), pickup (units)
 *   marks [{unit, text, staff (1)}], figures [{unit, figs ["6", "3"]}] (under the lowest staff), doubleBars [units
 *   where a section begins: the bar line before it double]
 *   root {…} — the study's own attributes, written in the extMeta for the app
 * → {mei, name}
 */
export function exportMei(spec) {
  const { title = "Kairotic", source = "Kairotic", key = { tonic: "C", mode: "major" }, voices, unitDen = 2, unitsPerBar = 2, pickup = 0, marks = [], figures = [], doubleBars = [], root = {} } = spec;
  const meter = spec.meter || [unitsPerBar, unitDen];
  const fifths = fifthsOf(key), sig = sigMap(fifths), sigA = fifths === 0 ? "0" : Math.abs(fifths) + (fifths > 0 ? "s" : "f");
  const total = Math.max(...voices.map((v) => v.notes.reduce((a, n) => a + n.units, 0)));
  // the measures: [start, end) in units, the first a pickup when there is one
  const bars = [];
  for (let s = 0, first = true; s < total; first = false) { const len = first && pickup ? pickup : unitsPerBar; bars.push([s, Math.min(total, s + len), first && pickup > 0]); s += len; }
  const barOf = (u) => bars.findIndex(([a, b]) => u >= a && u < b);
  const noteExt = {};
  // a unit that is not a binary fraction of a whole note (unitDen 6: a third of a half note) is written in tuplets:
  // f (the odd part of unitDen) in the time of nb (the power of two below it), a bar's notes in one tuplet — unless
  // all of that bar's notes in a voice fall on whole groups of f units, which are binary, and written plainly
  const odd = (() => { let x = unitDen; while (x % 2 === 0) x /= 2; return x; })();
  const nb = (() => { let x = 1; while (x * 2 < odd) x *= 2; return x; })();
  const staffXml = voices.map((v, vi) => {
    const segs = bars.map(() => []);
    // the notes cut at the bar lines: {w (written pitch, or null: a rest), len (units), first, last (of its note)}
    let at = 0;
    for (const [i, n] of v.notes.entries()) {
      let left = n.units, s = at, first = true;
      const w = n.name || typeof n.midi === "number" ? writtenOf(n, fifths) : null;
      const verses = w ? versesXml(v.notes, i) : "";
      while (left > 0) {
        const bi = barOf(s), end = Math.min(s + left, bars[bi][1]), len = end - s;
        segs[bi].push({ w, len, first, last: end === at + n.units, verses });
        left -= len; s = end; first = false;
      }
      at += n.units;
    }
    let nid = 0;
    return segs.map((list, bi) => {
      const carried = {}; // what the bar has said for each letter and octave
      const tuplet = odd > 1 && list.some((x) => x.len % odd !== 0);
      const scale = tuplet ? odd / (nb * unitDen) : 1 / unitDen;
      const out = [];
      for (const { w, len, first, last, verses } of list) {
        const ps = pieces(len * scale);
        ps.forEach(([, dur, dots], k) => {
          const tie = !w ? "" : first && last && ps.length === 1 ? "" : first && k === 0 ? "i" : last && k === ps.length - 1 ? "t" : "m";
          const id = `v${vi + 1}${w ? "n" : "r"}${++nid}`;
          if (!w) { out.push(`<rest xml:id="${id}" dur="${dur}"${dots ? ` dots="${dots}"` : ""}/>`); return; }
          const { L, oct, alt } = w;
          // (a pitch off the written one: its Hz for the app, by the id of its first written note)
          if (w.hz && first && k === 0) noteExt[id] = { hz: w.hz };
          const said = carried[L + oct] ?? (sig[L] || 0);
          // an accidental where the bar or the signature says another; else only as sounding (accid.ges)
          const acc = alt === said ? (alt ? ` accid.ges="${ACC[alt]}"` : "") : ` accid="${ACC[alt]}"`;
          carried[L + oct] = alt;
          // (its syllables on its first written piece only: the pieces a tie goes on into sing it on)
          const sung = first && k === 0 ? verses : "";
          out.push(`<note xml:id="${id}" pname="${L.toLowerCase()}" oct="${oct}" dur="${dur}"${dots ? ` dots="${dots}"` : ""}${acc}${tie ? ` tie="${tie}"` : ""}${sung ? `>${sung}</note>` : "/>"}`);
        });
      }
      return tuplet && out.length ? [`<tuplet xml:id="v${vi + 1}t${bi}" num="${odd}" numbase="${nb}" bracket.visible="true" num.visible="true">`, ...out, `</tuplet>`] : out;
    });
  });
  const lowest = voices.length;
  const tstamp = (u, bi) => 1 + ((u - bars[bi][0]) / unitDen) * meter[1] * (bars[bi][2] ? 1 : 1);
  const measures = bars.map(([a, b, pk], bi) => {
    const ctl = [
      ...marks.filter((x) => barOf(x.unit) === bi).map((x) => `<dir place="above" staff="${x.staff || 1}" tstamp="${tstamp(x.unit, bi)}"><rend fontstyle="italic">${xml(x.text)}</rend></dir>`),
      ...figures.filter((x) => barOf(x.unit) === bi && x.figs && x.figs.length).map((x) => `<harm place="below" staff="${lowest}" tstamp="${tstamp(x.unit, bi)}"><fb>${x.figs.map((f) => `<f>${xml(f)}</f>`).join("")}</fb></harm>`),
    ].join("");
    const dbl = bi < bars.length - 1 && doubleBars.some((u) => u > a && u <= b);
    return `<measure n="${pk ? 0 : bi + (pickup ? 0 : 1)}"${pk ? ' metcon="false"' : ""}${bi === bars.length - 1 ? ' right="end"' : dbl ? ' right="dbl"' : ""}>` +
      voices.map((_, vi) => `<staff n="${vi + 1}"><layer n="1">${staffXml[vi][bi].join("") || `<mRest xml:id="v${vi + 1}m${bi}"/>`}</layer></staff>`).join("") + ctl + `</measure>`;
  }).join("");
  const clefOf = (v) => {
    if (v.clef) return v.clef;
    const ms = v.notes.map((n) => (typeof n.midi === "number" ? n.midi : n.name ? midiOfName(n.name) : null)).filter((x) => x !== null);
    return ms.length && ms.reduce((a, b) => a + b, 0) / ms.length < 57 ? "F" : "G";
  };
  const staffDefs = voices.map((v, vi) => { const c = clefOf(v); return `<staffDef n="${vi + 1}"${v.label ? ` label="${xml(v.label)}"` : ""} lines="5" clef.shape="${c}" clef.line="${c === "F" ? 4 : 2}"/>`; }).join("");
  const ext = edn({ kairotic: 1, "root-tag": { kw: "par" }, root: { name: title, source, key: `${key.tonic} ${key.mode || "major"}`, made: new Date().toISOString().slice(0, 10), ...root },
                    ...(Object.keys(noteExt).length ? { notes: { strkeys: noteExt } } : {}) });
  const mei = `<?xml version="1.0" encoding="UTF-8"?><mei xmlns="http://www.music-encoding.org/ns/mei" meiversion="5.0">` +
    `<meiHead><fileDesc><titleStmt><title>${xml(title)}</title></titleStmt><pubStmt/></fileDesc>` +
    `<extMeta type="kairotic"><![CDATA[${ext.replace(/]]>/g, "]]]]><![CDATA[>")}]]></extMeta></meiHead><music><body><mdiv><score>` +
    `<scoreDef key.sig="${sigA}" meter.count="${meter[0]}" meter.unit="${meter[1]}"${meter[0] === 2 && meter[1] === 2 ? ' meter.sym="cut"' : ""}><staffGrp symbol="brace" bar.thru="true">${staffDefs}</staffGrp></scoreDef>` +
    `<section>${measures}</section></score></mdiv></body></music></mei>`;
  return { mei, name: fileName(title) };
}

/** Offers a MEI for the app: on claude.ai through the downloads capability as .mei.txt (it does not offer .mei);
 *  elsewhere as a link, .mei. Resolves to what was said (saved, declined, not possible here). */
export async function offer({ mei, name }) {
  const blob = new Blob([mei], { type: "application/mei+xml" });
  const cl = typeof window !== "undefined" && window.claude;
  if (cl && cl.use) {
    const dl = await cl.use("downloads").catch(() => null);
    if (!dl) return "This view cannot save files.";
    try { await dl.save({ filename: name + ".txt", data: blob }); return `Saved ${name}.txt: open it in the app (drop it on the patch)`; }
    catch (e) { return e && e.code === "declined" ? "Not saved." : `Not saved: ${(e && (e.message || e.code)) || e}`; }
  }
  const a = document.createElement("a"), url = URL.createObjectURL(blob);
  a.href = url; a.download = name; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
  return `Saved ${name}`;
}
