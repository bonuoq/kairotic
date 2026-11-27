// SPDX-License-Identifier: MPL-2.0
// The continuo tables of @kairotic/rules' continuo.mjs, counted from Bach's chorales (Study 76 · continuo):
//   node studies/_shared/chorales/tools/continuo.mjs [phrases file] [continuo.mjs to write them into]
// Every quarter of every phrase of every chorale but every fifth (number % 5 === 0, kept out to measure against):
// the soprano over the bass, the two voices' moves together, the chord over each degree of the bass in the key the
// quarter is in (phrases.json's `keys`), and the phrases' cadences. Each table is −log of a frequency (a conditional
// one for the chords over a degree), 0.5 added to every cell (a plain −log, so that costs summed are a probability's: Study 63's logProb); written between the
// `@tables-begin` and `@tables-end` lines of continuo.mjs (default packages/rules/assets/continuo.mjs).
import { readFileSync, writeFileSync } from "node:fs";
import { chordOf, CHORDS, dissonanceOf } from "../../../../packages/rules/assets/continuo.mjs";

const PC = { C: 0, D: 2, E: 4, F: 5, G: 7, A: 9, B: 11 };
const tonicOf = (k) => { const t = k.split(" ")[0]; return (PC[t[0]] + (t.match(/[#♯]/g) || []).length - (t.match(/[b♭]/g) || []).length + 12) % 12; };
const modeOf = (k) => (/minor/.test(k) ? "minor" : "major");
const COLS = [...CHORDS, "x"];
const cls = (names) => { const c = chordOf(names); return c.startsWith("x:") ? "x" : c; };
const move = (d) => (d === 0 ? 2 : d < 0 ? (d >= -2 ? 1 : 0) : d <= 2 ? 3 : 4);
const cost = (counts, alpha = 0.5) => {
  const tot = counts.reduce((a, b) => a + b, 0) + alpha * counts.length;
  return counts.map((x) => +(-Math.log((x + alpha) / tot)).toFixed(3));
};

export function count(phrases, keep = (p) => p.chorale % 5 !== 0) {
  const vertical = Array(12).fill(0), pair = Array.from({ length: 5 }, () => Array(5).fill(0));
  const deg = { major: Array.from({ length: 12 }, () => Array(COLS.length).fill(0)), minor: Array.from({ length: 12 }, () => Array(COLS.length).fill(0)) };
  const cad = { major: {}, minor: {} }, diss = {};
  let quarters = 0, used = 0;
  for (const p of phrases) {
    if (!keep(p)) continue;
    used++;
    const n = p.satb.length;
    for (let q = 0; q < n; q++) {
      const [S, , , B] = p.satb[q];
      quarters++;
      vertical[(((S - B) % 12) + 12) % 12]++;
      if (q) pair[move(S - p.satb[q - 1][0])][move(B - p.satb[q - 1][3])]++;
      const k = p.keys[q], d = (((B - tonicOf(k)) % 12) + 12) % 12;
      deg[modeOf(k)][d][COLS.indexOf(cls(p.names[q]))]++;
      const x = dissonanceOf(p, q);
      if (x) { const w = `${x.voice}|${x.motion}|${x.interval ?? "-"}|${p.strong[q] ? "strong" : "weak"}`; diss[w] = (diss[w] || 0) + 1; }
    }
    if (n >= 2) {
      const k = p.keys[n - 1], t = tonicOf(k);
      const w = [n - 2, n - 1].map((q) => ((((p.satb[q][3] - t) % 12) + 12) % 12) + ":" + cls(p.names[q])).join(" ");
      cad[modeOf(k)][w] = (cad[modeOf(k)][w] || 0) + 1;
    }
  }
  const tables = {
    BACH_OUTER_VERTICAL: cost(vertical),
    BACH_OUTER_PAIR: cost(pair.flat()),
    BACH_DEGREE_CHORD: Object.fromEntries(["major", "minor"].map((m) => [m, {
      chords: COLS,
      degree: cost(deg[m].map((r) => r.reduce((a, b) => a + b, 0))),
      chord: deg[m].map((r) => cost(r)),
    }])),
    BACH_DISSONANCES: Object.fromEntries(Object.entries(diss).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))),
    BACH_CADENCES: Object.fromEntries(["major", "minor"].map((m) => {
      const tot = Object.values(cad[m]).reduce((a, b) => a + b, 0);
      return [m, Object.entries(cad[m]).sort((a, b) => b[1] - a[1]).slice(0, 16).map(([w, c]) => [w, +(c / tot).toFixed(3)])];
    })),
  };
  return { tables, quarters, phrases: used };
}

const main = () => {
  const [phrasesFile = "studies/_shared/chorales/phrases.json", target = "packages/rules/assets/continuo.mjs"] = process.argv.slice(2);
  const { phrases } = JSON.parse(readFileSync(phrasesFile, "utf8"));
  const { tables, quarters, phrases: used } = count(phrases);
  const js = (v) => JSON.stringify(v).replace(/"([A-Za-z_]\w*)":/g, "$1: ").replace(/,(?=\S)/g, ", ");
  const body = [`// ${used} phrases, ${quarters} quarters (the chorales but every fifth)`,
    ...Object.entries(tables).map(([k, v]) => `export const ${k} = ${js(v)};`)].join("\n");
  const src = readFileSync(target, "utf8").replace(/(\/\/ @tables-begin\n)[\s\S]*?(\/\/ @tables-end)/, `$1${body}\n$2`);
  writeFileSync(target, src);
  console.log(`${used} phrases, ${quarters} quarters → ${target}`);
};
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) main();
