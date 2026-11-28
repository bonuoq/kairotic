// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: the tables the bass under a soprano (kairotic/under.mjs) costs its choices by, counted on Bach's
// chorales (studies/_shared/chorales/phrases.json), quarter by quarter, in each quarter's own key (phrases.json's
// keys) — the chorales whose number is a multiple of 5 left out, to measure on (tools/under-measure.mjs):
//   node studies/63-bridges/tools/under-tables.mjs [phrases.json] [out .mjs]
// A first calibration, so the engine runs; the chorale thread's tables (rules.mjs, with Bach's own figures from BCFB)
// replace it through bassUnder's `costs`.
import { readFileSync, writeFileSync } from "node:fs";
import { chordOf, functionOf } from "../kairotic/functions.mjs";
import { figureOf, keyOfName, isHeldOut } from "../kairotic/under.mjs";

const src = process.argv[2] || "studies/_shared/chorales/phrases.json", out = process.argv[3] || "studies/63-bridges/kairotic/under-tables.mjs";
const P = JSON.parse(readFileSync(src, "utf8")).phrases;
const TON = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 };
const mod = (a, m) => ((a % m) + m) % m, tp = (k) => TON[String(k.tonic).replace("♯", "#").replace("♭", "b")] ?? 0;
const T = { major: newTables(), minor: newTables() };
function newTables() { return { vertical: {}, motion: {}, move: {}, chord: {}, end: {}, endChord: {}, held: { strong: {}, weak: {} }, start: {}, position: Array.from({ length: 10 }, () => ({})) }; }
// (the secondary dominants: a chord whose function in the chorale's key is an applied dominant, by its figure; and
// every chord's figure, to weigh them against)
const applied = { figure: {}, all: {}, resolved: 0, n: 0 };
// (the soprano's motion at each quarter, by beat, as under.mjs reads it: how often a dissonance of that motion is
// one — BACH_DISSONANCES's counts over these)
const STEP = (d) => Math.abs(d) >= 1 && Math.abs(d) <= 2;
const smotion = (S, t) => {
  const n = S.length, into = t ? S[t] - S[t - 1] : null, out = t < n - 1 ? S[t + 1] - S[t] : null, held = t > 0 && into === 0;
  if (held && out !== null && out < 0 && STEP(out)) return "suspension";
  if (held && out !== null && out > 0 && STEP(out)) return "suspension-up";
  if (held && out === 0) return "held";
  if (into !== null && out !== null && STEP(into) && STEP(out)) return Math.sign(into) === Math.sign(out) ? "passing" : "neighbour";
  if (held) return "held";
  return null;
};
const sopMotion = {};
const inc = (o, k, v = 1) => { o[k] = (o[k] || 0) + v; };
let used = 0, skipped = 0, phrases = 0;
for (const p of P) {
  if (isHeldOut(p)) continue;
  phrases++;
  const n = p.satb.length, keys = p.keys.map(keyOfName), home = p.key;
  const homeMode = home.mode === "minor" ? "minor" : "major";
  inc(T[homeMode].start, mod(tp(keys[0]) - tp(home), 12) + (keys[0].mode === "minor" ? "m" : "M"));
  for (let t = 0; t < n; t++) {
    const k = keys[t], m = k.mode === "minor" ? "minor" : "major", tb = T[m], c = p.satb[t], s = c[0], b = c[3];
    const sm = smotion(p.satb.map((x) => x[0]), t);
    if (sm) inc(sopMotion, `${sm}|${p.strong[t] ? "strong" : "weak"}`);
    inc(tb.vertical, mod(s - b, 12));
    const ch = chordOf(c);
    const f = ch && ch.extra === null ? figureOf(ch) : null;
    if (f) {
      inc(tb.chord, `${mod(b - tp(k), 12)}|${f}|${ch.kind}`); used++;
      // (the harmonic map: the chord over its degree by tenth of the phrase, as PROFILE's tenths)
      inc(tb.position[Math.min(9, Math.floor(10 * t / Math.max(1, n - 1)))], `${mod(b - tp(k), 12)}|${f}`);
      inc(applied.all, f);
      const fn = functionOf(c, home);
      if (fn && fn.fn === "A") {
        inc(applied.figure, f); applied.n++;
        const nx = t < n - 1 ? chordOf(p.satb[t + 1]) : null;
        if (nx && (fn.targets || [fn.target]).includes(nx.root)) applied.resolved++;
      }
    } else skipped++;
    if (t > 0) {
      const s0 = p.satb[t - 1][0], b0 = p.satb[t - 1][3], ds = Math.sign(s - s0), db = Math.sign(b - b0);
      inc(tb.motion, !ds && !db ? "static" : !ds || !db ? "oblique" : ds === db ? "similar" : "contrary");
      inc(tb.move, Math.min(13, Math.abs(b - b0)));
      inc(tb.held[p.strong[t] ? "strong" : "weak"], b === b0 ? "held" : "moved");
    }
    if (t === n - 1 && n > 1) {
      inc(tb.end, `${mod(p.satb[t - 1][3] - tp(k), 12)}>${mod(b - tp(k), 12)}`);
      if (f) inc(tb.endChord, `${mod(b - tp(k), 12)}|${f}|${ch.kind}`);
    }
  }
}
const data = { source: "Bach's chorales, phrases.json (Sapp's edition), chorales whose number is not a multiple of 5", phrases, quarters: used + skipped, chords: used, sopMotion, applied, ...T };
writeFileSync(out, `// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Written by tools/under-tables.mjs from studies/_shared/chorales/phrases.json (Sapp's edition of Bach's chorales,
// CC BY-NC-SA 4.0): counts, quarter by quarter, each in its own key, the chorales whose number is a multiple of 5 left
// out. Do not edit by hand.
export const UNDER_TABLES = ${JSON.stringify(data)};
`);
console.log(`${phrases} phrases, ${used} quarters with a chord, ${skipped} without (a dissonance on the quarter) → ${out}`);
