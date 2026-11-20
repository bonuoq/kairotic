// SPDX-License-Identifier: MPL-2.0
// Kairotic · the studies' export (discussion #319): what a study made, as MEI the app opens as a tree box
// (kairotic.mei, Study 55). Every study that makes music keeps a copy of this file beside its kernel (the copies are
// checked equal in tests/counterpoint.mjs); this one, in studies/_shared, is the original.
//
//   voices      each a list of notes {name ("F#4", "Bb3", or null: a rest), units} — or made from a list of names a
//               unit each (fromUnits: a name repeated is a note held, unless the unit is struck again)
//   time        a unit is 1/unitDen of a whole note (2: a half note, 4: a quarter); unitsPerBar a bar; pickup
//               units before the first bar line (an upbeat); notes are cut at the bar lines and tied
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
const ACC = { "-2": "ff", "-1": "f", 0: "n", 1: "s", 2: "x" };

/** A name normalized: "F♯4" → "F#4", "B♭3" → "Bb3". */
export const plain = (s) => String(s).replace(/♯/g, "#").replace(/♭/g, "b").replace(/𝄪/g, "##").replace(/𝄫/g, "bb");
/** The key signature of a key ({tonic, mode}): fifths (−7 … 7). */
export function fifthsOf(key = { tonic: "C" }) {
  const t = plain(key.tonic || "C");
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

/** Notes from names a unit each: a name repeated is held (struck[t], where given, says whether unit t is struck
 *  again); null a rest. */
export function fromUnits(names, struck = null) {
  const out = [];
  names.forEach((nm, t) => {
    const n = nm === null || nm === undefined ? null : plain(nm), last = out[out.length - 1];
    const again = struck ? !!struck[t] : !(last && last.name === n);
    if (last && !again && last.name === n) last.units++;
    else out.push({ name: n, units: 1 });
  });
  return out;
}

// written durations, in whole notes, longest first: [value, @dur, @dots]
const DURS = [[1, "1", 0], [3 / 4, "2", 1], [1 / 2, "2", 0], [3 / 8, "4", 1], [1 / 4, "4", 0], [3 / 16, "8", 1], [1 / 8, "8", 0], [1 / 16, "16", 0], [1 / 32, "32", 0]];
const pieces = (w) => { const out = []; let x = w; while (x > 1e-9) { const d = DURS.find(([v]) => v <= x + 1e-9); if (!d) break; out.push(d); x -= d[0]; } return out; };

/** EDN of a JS value: objects as maps with keyword keys, arrays as vectors, {kw: "par"} a keyword. */
export function edn(v) {
  if (v === null || v === undefined) return "nil";
  if (typeof v === "string") return JSON.stringify(v);
  if (typeof v === "number") return Number.isFinite(v) ? String(v) : "nil";
  if (typeof v === "bigint") return String(v);
  if (typeof v === "boolean") return String(v);
  if (Array.isArray(v)) return "[" + v.map(edn).join(" ") + "]";
  if (typeof v === "object" && Object.keys(v).length === 1 && typeof v.kw === "string") return ":" + v.kw;
  return "{" + Object.entries(v).filter(([, x]) => x !== undefined).map(([k, x]) => ":" + k.replace(/[^A-Za-z0-9*+!_?<>=.-]/g, "-") + " " + edn(x)).join(", ") + "}";
}
const xml = (x) => String(x).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");
/** A file name from a title: "A period in C" → "a-period-in-c.mei". */
export const fileName = (title, ext = ".mei") => (String(title).normalize("NFD").replace(/[̀-ͯ]/g, "").replace(/[^A-Za-z0-9]+/g, "-").replace(/^-|-$/g, "").toLowerCase() || "kairotic") + ext;

/**
 * The MEI of what a study made. spec:
 *   title, source (the study), key {tonic, mode}
 *   voices [{label, clef ("G" | "F", or by its notes), notes [{name | null, units}]}], top first
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
  const staffXml = voices.map((v, vi) => {
    const layer = bars.map(() => []);
    const carried = bars.map(() => ({})); // what the bar has said for each letter and octave
    let nid = 0, at = 0;
    for (const n of v.notes) {
      let left = n.units, s = at, first = true;
      const m = n.name && /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/.exec(plain(n.name));
      while (left > 0) {
        const bi = barOf(s), end = Math.min(s + left, bars[bi][1]), len = end - s, last = end === at + n.units;
        const ps = pieces(len / unitDen);
        ps.forEach(([, dur, dots], k) => {
          const tie = !n.name ? "" : first && last && ps.length === 1 ? "" : first && k === 0 ? "i" : last && k === ps.length - 1 ? "t" : "m";
          const id = `v${vi + 1}${n.name ? "n" : "r"}${++nid}`;
          if (!m) { layer[bi].push(`<rest xml:id="${id}" dur="${dur}"${dots ? ` dots="${dots}"` : ""}/>`); return; }
          const L = m[1], oct = m[3], alt = !m[2] ? 0 : m[2][0] === "#" ? m[2].length : -m[2].length;
          const said = carried[bi][L + oct] ?? (sig[L] || 0);
          // an accidental where the bar or the signature says another; else only as sounding (accid.ges)
          const acc = alt === said ? (alt ? ` accid.ges="${ACC[alt]}"` : "") : ` accid="${ACC[alt]}"`;
          carried[bi][L + oct] = alt;
          layer[bi].push(`<note xml:id="${id}" pname="${L.toLowerCase()}" oct="${oct}" dur="${dur}"${dots ? ` dots="${dots}"` : ""}${acc}${tie ? ` tie="${tie}"` : ""}/>`);
        });
        left -= len; s = end; first = false;
      }
      at += n.units;
    }
    return layer;
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
    const ms = v.notes.filter((n) => n.name).map((n) => { const m = /^([A-G])(#{1,2}|b{1,2})?(-?\d+)$/.exec(plain(n.name)); return 12 * (Number(m[3]) + 1) + WHITE[LETTERS.indexOf(m[1])]; });
    return ms.length && ms.reduce((a, b) => a + b, 0) / ms.length < 57 ? "F" : "G";
  };
  const staffDefs = voices.map((v, vi) => { const c = clefOf(v); return `<staffDef n="${vi + 1}"${v.label ? ` label="${xml(v.label)}"` : ""} lines="5" clef.shape="${c}" clef.line="${c === "F" ? 4 : 2}"/>`; }).join("");
  const ext = edn({ kairotic: 1, "root-tag": { kw: "par" }, root: { name: title, source, key: `${key.tonic} ${key.mode || "major"}`, made: new Date().toISOString().slice(0, 10), ...root } });
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
