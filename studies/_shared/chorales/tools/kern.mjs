// SPDX-License-Identifier: MPL-2.0
// The chorales' phrases: Bach's four-part chorales, cut at the fermatas, from Craig Sapp's Humdrum edition
// (https://github.com/craigsapp/bach-370-chorales, CC BY-NC-SA 4.0, after Breitkopf & Härtel's 371, c. 1875):
//   node studies/_shared/chorales/tools/kern.mjs <the edition's kern/ dir> [out file]
// → out file (default studies/_shared/chorales/phrases.json): {source, license, phrases: [phrase]}, a phrase
//   {id, chorale, bwv, title, meter, key: {tonic, mode}, cadence: {tonic, mode} | null, satb: [[S, A, T, B] a quarter],
//    (key.church: the edition's church mode, dorian, mixolydian…),
//    held: [[s, a, t, b] a quarter: the note began before it], strong: [bool a quarter], A, B: the first and last chord,
//    lines: {soprano, alto, tenor, bass: [[onset in quarters, MIDI, quarters]]}} — the engine's format (Study 63's
//   bridgesFor, fromOuter): a unit a quarter, the note sounding on it (the passing eighths are in the lines).
import { readFileSync, readdirSync, writeFileSync } from "node:fs";
import { join, basename } from "node:path";

const PC = { c: 0, d: 2, e: 4, f: 5, g: 7, a: 9, b: 11 };
const NAME = { c: "C", d: "D", e: "E", f: "F", g: "G", a: "A", b: "B" };
// a **kern token's duration in quarters, pitch (MIDI) and whether it goes on a tied note
const token = (tok) => {
  const m = /(\d+)(\.*)/.exec(tok);
  if (!m) return null;
  let d = m[1] === "0" ? 8 : 4 / Number(m[1]), dd = d;
  for (let i = 0; i < m[2].length; i++) { dd /= 2; d += dd; }
  if (tok.includes("r")) return { d, p: null };
  const s = /([a-gA-G])\1*/.exec(tok)[0], L = s[0].toLowerCase();
  const oct = s[0] === L ? 3 + s.length : 4 - s.length;
  const acc = (tok.match(/#/g) || []).length - (tok.match(/-/g) || []).length;
  return { d, p: PC[L] + acc + 12 * (oct + 1), tied: tok.includes("]") || tok.includes("_"), fermata: tok.includes(";") };
};
// (a church mode, *a:dor, *G:mix, is the edition's reading: the key keeps its tonic and its major or minor 3rd)
const CHURCH = { dor: "dorian", phr: "phrygian", lyd: "lydian", mix: "mixolydian", aeo: "aeolian", ion: "ionian", loc: "locrian" };
const keyOf = (k, m = "") => { const L = k[0], acc = k.slice(1).replace(/#/g, "♯").replace(/-/g, "♭");
  return { tonic: NAME[L.toLowerCase()] + acc, mode: L === L.toLowerCase() ? "minor" : "major", ...(CHURCH[m] ? { church: CHURCH[m] } : {}) }; };
const SHARP = ["C", "C♯", "D", "E♭", "E", "F", "F♯", "G", "A♭", "A", "B♭", "B"];

export function parse(text, file = "") {
  const lines = text.split(/\r?\n/), meta = {};
  let spines = null, meter = null, key = null;
  const t = [0, 0, 0, 0], ev = [[], [], [], []], bars = [], meters = [];
  for (const l of lines) {
    const mm = /^!!!([A-Z@#]+[^:]*):\s*(.*)$/.exec(l);
    if (mm) { meta[mm[1]] = mm[2]; continue; }
    if (l.startsWith("!")) continue;
    const f = l.split("\t");
    if (l.startsWith("**")) { spines = f.map((x, i) => (x === "**kern" ? i : -1)).filter((i) => i >= 0); if (spines.length !== 4) return null; continue; }
    if (!spines) continue;
    if (f.includes("*-")) break;
    if (f.some((x) => x === "*^" || x === "*v")) return null;
    if (l.startsWith("*")) {
      for (const x of f) {
        const m = /^\*M(\d+)\/(\d+)$/.exec(x);
        if (m) { meter = [Number(m[1]), Number(m[2])]; meters.push([t[0], meter]); }
        const k = /^\*([A-Ga-g][#-]*):([a-z]*)$/.exec(x);
        if (k && !key) key = keyOf(k[1], k[2]);
      }
      continue;
    }
    if (l.startsWith("=")) { bars.push(t[0]); continue; }
    spines.forEach((i, k) => {
      const tok = (f[i] || ".").split(" ")[0];
      if (tok === "." || tok.includes("q")) return;
      const n = token(tok);
      if (!n) return;
      ev[k].push({ s: t[k], ...n }); t[k] += n.d;
    });
  }
  // the spines go bass, tenor, alto, soprano
  return { meta, key, meters, bars, voices: [ev[3], ev[2], ev[1], ev[0]], end: t[0], file };
}

// the chord's triad, read from its bass: {tonic, mode} when a 5/3 major or minor stands on it, else null
const triadOn = (ch) => {
  const b = ch[3] % 12, rel = new Set(ch.map((p) => (((p - b) % 12) + 12) % 12));
  if (rel.has(4) && !rel.has(3) && [...rel].every((x) => [0, 4, 7].includes(x))) return { tonic: SHARP[b], mode: "major" };
  if (rel.has(3) && !rel.has(4) && [...rel].every((x) => [0, 3, 7].includes(x))) return { tonic: SHARP[b], mode: "minor" };
  return null;
};

export function phrasesOf(score, id = "") {
  const { voices, meters, bars, key, meta } = score;
  const at = (V, x) => V.find((e) => e.s <= x && x < e.s + e.d);
  const meterAt = (x) => { let m = meters[0]?.[1] || [4, 4]; for (const [s, mm] of meters) if (s <= x) m = mm; return m; };
  const barStart = (x) => { let b = null; for (const s of bars) if (s <= x) b = s; return b; };
  const strongAt = (x) => {
    const [n, d] = meterAt(x), len = (n * 4) / d;
    const b = barStart(x), off = b === null ? ((len - ((bars[0] ?? len) - x)) % len + len) % len : x - b;
    return n % 3 === 0 && d === 4 ? Math.abs(off) < 1e-9 : Math.abs(off / 2 - Math.round(off / 2)) < 1e-9;
  };
  // the fermatas: where a soprano note bears one, the phrase ends on its onset; the next begins as it ends
  const cuts = voices[0].filter((e) => e.fermata && e.p !== null);
  const out = [];
  let from = 0;
  cuts.forEach((c, i) => {
    let units = [];
    for (let x = from; x <= c.s + 1e-9; x += 1) units.push(x);
    from = c.s + c.d;
    // (a voice that enters late, after a rest, begins the phrase where all four sound)
    const sounds = (x) => voices.every((V) => { const e = at(V, x); return e && e.p !== null; });
    while (units.length && !sounds(units[0])) units.shift();
    if (units.length < 2) return;
    const satb = [], held = [];
    for (const x of units) {
      const es = voices.map((V) => at(V, x));
      if (es.some((e) => !e || e.p === null)) return;
      satb.push(es.map((e) => e.p));
      held.push(es.map((e) => e.s < x - 1e-9));
    }
    const lo = units[0], hi = c.s + c.d;
    const names = ["soprano", "alto", "tenor", "bass"];
    out.push({
      id: `${id}-${i + 1}`, chorale: Number(meta["PC#"]) || null, bwv: meta.SCT || null, title: meta["OTL@@DE"] || meta.OTL || null,
      meter: meterAt(lo).join("/"), key, cadence: triadOn(satb[satb.length - 1]),
      satb, held, strong: units.map(strongAt), A: satb[0], B: satb[satb.length - 1],
      lines: Object.fromEntries(voices.map((V, k) => [names[k], V.filter((e) => e.s + e.d > lo + 1e-9 && e.s < hi - 1e-9 && e.p !== null).map((e) => [e.s - lo, e.p, e.d])])),
    });
  });
  return out;
}

if (import.meta.url === `file://${process.argv[1]}`) {
  const dir = process.argv[2], outFile = process.argv[3] || "studies/_shared/chorales/phrases.json";
  if (!dir) { console.error("usage: kern.mjs <kern dir> [out file]"); process.exit(1); }
  const phrases = [], skipped = [];
  for (const f of readdirSync(dir).filter((f) => f.endsWith(".krn")).sort()) {
    const s = parse(readFileSync(join(dir, f), "latin1"), f);
    if (!s) { skipped.push(f); continue; }
    phrases.push(...phrasesOf(s, basename(f, ".krn")));
  }
  writeFileSync(outFile, JSON.stringify({ source: "Craig Stuart Sapp, A digital edition of 370 J.S. Bach Chorales (2009), https://github.com/craigsapp/bach-370-chorales, after Breitkopf & Härtel's 371 vierstimmige Choralgesänge, 4th ed. (Dörffel, c. 1875)",
    license: "CC BY-NC-SA 4.0 (https://creativecommons.org/licenses/by-nc-sa/4.0/): the phrases are cut from Sapp's edition", phrases }));
  console.log(`${phrases.length} phrases from ${new Set(phrases.map((p) => p.chorale)).size} chorales${skipped.length ? `, skipped ${skipped.join(" ")}` : ""} → ${outFile}`);
}
