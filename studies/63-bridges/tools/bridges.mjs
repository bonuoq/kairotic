// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: the outer voices for the chorale test (#399, #353). For every phrase of the corpus
// (studies/_shared/chorales/: one phrase a .json, or arrays of them), the soprano and the bass from its first chord
// to its last, drawn with all the layers and with each off, as the engine's fromOuter reads them:
//   node studies/63-bridges/tools/bridges.mjs [corpus dir] [out file] [draws a variant] [seed]
// → out file (default studies/_shared/chorales/bridges.json): [{phrase, soprano, bass, key, strong, layers, variant}].
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { bridgesFor } from "../kairotic/outer.mjs";

const dir = process.argv[2] || "studies/_shared/chorales", out = process.argv[3] || join(dir, "bridges.json");
const count = Number(process.argv[4] || 2), seed = Number(process.argv[5] || 1);
let x = seed * 7919 + 13;
const r = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
for (let i = 0; i < 5; i++) r();

const phrases = [];
const read = (f) => { const v = JSON.parse(readFileSync(f, "utf8")); (Array.isArray(v) ? v : v.phrases || [v]).forEach((p) => p && p.satb && phrases.push(p)); };
if (!existsSync(dir)) { console.error(`no corpus at ${dir}`); process.exit(1); }
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith(".json") && f !== "bridges.json") read(p); });
walk(dir);
const all = [];
let none = 0;
for (const p of phrases) { const bs = bridgesFor(p, { count, r }); if (!bs.length) none++; all.push(...bs); }
writeFileSync(out, JSON.stringify(all));
console.log(`${phrases.length} phrases, ${all.length} bridges (${count} a variant), ${none} phrases without one → ${out}`);
