// SPDX-License-Identifier: MPL-2.0
// The continuo tables of @kairotic/rules' continuo.mjs, counted from Bach's chorales (Study 76 · continuo):
//   node studies/_shared/chorales/tools/continuo.mjs [phrases file] [continuo.mjs to write them into]
// Every quarter of every phrase of every chorale but every fifth (number % 5 === 0, kept out to measure against):
// the soprano over the bass, the two voices' moves together, the chord over each degree of the bass in the key the
// quarter is in (phrases.json's `keys`), and the phrases' cadences. Each table is −log of a frequency (a conditional
// one for the chords over a degree), 0.5 added to every cell (a plain −log, so that costs summed are a probability's: Study 63's logProb); written between the
// `@tables-begin` and `@tables-end` lines of continuo.mjs (default packages/rules/assets/continuo.mjs).
import { readFileSync, writeFileSync } from "node:fs";
import { chordOf, CHORDS, dissonanceOf, spelled, bassMoveOf, moveClassOf, appliedOf, normalFigure, kindOf } from "../../../../packages/rules/assets/continuo.mjs";

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

export function count(phrases, keep = (p) => p.chorale % 5 !== 0, figures = null) {
  const vertical = Array(12).fill(0), pair = Array.from({ length: 5 }, () => Array(5).fill(0));
  const deg = { major: Array.from({ length: 12 }, () => Array(COLS.length).fill(0)), minor: Array.from({ length: 12 }, () => Array(COLS.length).fill(0)) };
  const pos = { major: Array.from({ length: 10 }, () => Array.from({ length: 12 }, () => Array(COLS.length).fill(0))), minor: Array.from({ length: 10 }, () => Array.from({ length: 12 }, () => Array(COLS.length).fill(0))) };
  const pairs = { major: { 3: {}, 2: {}, 1: {} }, minor: { 3: {}, 2: {}, 1: {} } };
  const applied = { major: {}, minor: {} }, written = { major: {}, minor: {} };
  const dkind = { major: Array.from({ length: 12 }, () => Array.from({ length: COLS.length }, () => ({}))), minor: Array.from({ length: 12 }, () => Array.from({ length: COLS.length }, () => ({}))) };
  const cad = { major: {}, minor: {} }, cad4 = { major: {}, minor: {} }, diss = {}, fine = {}, coarse = {}, tri = {}, bi = {};
  const dmap = { strong: Array.from({ length: 10 }, () => [0, 0]), weak: Array.from({ length: 10 }, () => [0, 0]) }, DISS = new Set([1, 2, 5, 6, 10, 11]);
  const role = (nm, v) => ((((spelled(nm[v]).step - spelled(nm[3]).step) % 7) + 7) % 7);
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
      { const kd = kindOf(p.satb[q]) ?? "x", cell = dkind[modeOf(k)][d][COLS.indexOf(cls(p.names[q]))]; cell[kd] = (cell[kd] || 0) + 1; }
      pos[modeOf(k)][Math.min(9, Math.floor((10 * q) / Math.max(1, n - 1)))][d][COLS.indexOf(cls(p.names[q]))]++;
      if (q) for (const v of [1, 2]) {
        const was = role(p.names[q - 1], v), now = role(p.names[q], v), c0 = cls(p.names[q - 1]), c1 = cls(p.names[q]);
        const bm = bassMoveOf(spelled(p.names[q][3]).step - spelled(p.names[q - 1][3]).step);
        (fine[`${c0}>${c1}|${bm}|${was}`] ||= Array(7).fill(0))[now]++;
        (coarse[`${c1}|${was}`] ||= Array(7).fill(0))[now]++;
      }
      { const c = p.satb[q], dis = [1, 2].some((v) => DISS.has((((c[v] - c[3]) % 12) + 12) % 12)); dmap[p.strong[q] ? "strong" : "weak"][Math.min(9, Math.floor((10 * q) / n))][dis ? 1 : 0]++; }
      if (q >= 2) for (const v of [1, 2]) {
        const m = (u) => moveClassOf(p.satb[u][v] - p.satb[u - 1][v]), b = p.strong[q] ? "S" : "w";
        (bi[`${m(q - 1)}|${b}`] ||= Array(9).fill(0))[m(q)]++;
        if (q >= 3) (tri[`${m(q - 2)},${m(q - 1)}|${b}`] ||= Array(9).fill(0))[m(q)]++;
      }
      { const a = appliedOf(p.satb[q], p.key);
        if (a) { const m = p.key.mode === "minor" ? "minor" : "major", w = `${a.target}|${a.kind}|${a.inversion}`; applied[m][w] = (applied[m][w] || 0) + 1;
          const f = figures && figures[p.id];
          if (f && !p.held[q][3] && !(f.differs || []).includes(q)) { const at0 = f.figures[q].find((x) => x.at === 0), fig = normalFigure(at0 ? at0.f : []).join("/") || "·";
            (written[m][w] ||= {})[fig] = (written[m][w][fig] || 0) + 1; } } }
      const x = dissonanceOf(p, q);
      if (x) { const w = `${x.voice}|${x.motion}|${x.interval ?? "-"}|${p.strong[q] ? "strong" : "weak"}`; diss[w] = (diss[w] || 0) + 1; }
    }
    { const k = p.keys[n - 1], t = tonicOf(k), at = (q) => ((((p.satb[q][3] - t) % 12) + 12) % 12) + ":" + cls(p.names[q]);
      for (const j of [3, 2, 1]) if (n - j - 1 >= 0) { const w = `${at(n - j - 1)} ${at(n - j)}`, T = pairs[modeOf(k)][j]; T[w] = (T[w] || 0) + 1; } }
    if (n >= 4) {
      const k = p.keys[n - 1], t = tonicOf(k);
      const w = [n - 4, n - 3, n - 2, n - 1].map((q) => ((((p.satb[q][3] - t) % 12) + 12) % 12) + ":" + cls(p.names[q])).join(" ");
      cad4[modeOf(k)][w] = (cad4[modeOf(k)][w] || 0) + 1;
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
    BACH_INNER_ROLES: { fine: Object.fromEntries(Object.keys(fine).sort().map((k) => [k, fine[k]])), coarse: Object.fromEntries(Object.keys(coarse).sort().map((k) => [k, coarse[k]])) },
    BACH_INNER_TURNS: { tri: Object.fromEntries(Object.keys(tri).sort().map((k) => [k, tri[k]])), bi: Object.fromEntries(Object.keys(bi).sort().map((k) => [k, bi[k]])) },
    BACH_DISSONANCE_MAP: dmap,
    BACH_DEGREE_CHORD_KIND: Object.fromEntries(["major", "minor"].map((m) => [m, dkind[m].map((row) => row.map((c) => Object.fromEntries(Object.keys(c).sort().map((k) => [k, c[k]])))) ])),
    BACH_DEGREE_BY_POSITION: pos,
    BACH_CADENCE_STEPS: Object.fromEntries(["major", "minor"].map((m) => [m, Object.fromEntries([3, 2, 1].map((j) => [j, Object.fromEntries(Object.keys(pairs[m][j]).sort().map((w) => [w, pairs[m][j][w]]))]))])),
    BACH_APPLIED: Object.fromEntries(["major", "minor"].map((m) => [m, ((o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])))(applied[m])])),
    BACH_APPLIED_WRITTEN: Object.fromEntries(["major", "minor"].map((m) => [m, Object.fromEntries(Object.keys(written[m]).sort().map((k) => [k, ((o) => Object.fromEntries(Object.keys(o).sort().map((k) => [k, o[k]])))(written[m][k])]))])),
    BACH_CADENCES_4: Object.fromEntries(["major", "minor"].map((m) => {
      const tot = Object.values(cad4[m]).reduce((a, b) => a + b, 0);
      return [m, Object.entries(cad4[m]).sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1)).slice(0, 24).map(([w, c]) => [w, +(c / tot).toFixed(4)])];
    })),
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
  const figs = JSON.parse(readFileSync(phrasesFile.replace(/phrases\.json$/, "figures.json"), "utf8")).phrases;
  const { tables, quarters, phrases: used } = count(phrases, undefined, figs);
  // (keys that are identifiers unquoted, a space after each comma — outside the strings, whose commas are theirs)
  const js = (v) => JSON.stringify(v).replace(/"((?:[^"\\]|\\.)*)"(:?)|,(?=\S)/g, (m, str, colon) => (str === undefined ? ", " : colon && /^[A-Za-z_]\w*$/.test(str) ? `${str}: ` : `"${str}"${colon ? ": " : ""}`));
  const body = [`// ${used} phrases, ${quarters} quarters (the chorales but every fifth)`,
    ...Object.entries(tables).map(([k, v]) => `export const ${k} = ${js(v)};`)].join("\n");
  const src = readFileSync(target, "utf8").replace(/(\/\/ @tables-begin\n)[\s\S]*?(\/\/ @tables-end)/, `$1${body}\n$2`);
  writeFileSync(target, src);
  console.log(`${used} phrases, ${quarters} quarters → ${target}`);
};
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].split("/").pop())) main();
