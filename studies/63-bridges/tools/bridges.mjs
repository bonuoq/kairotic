// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: the outer voices for the chorale test (#399, #353). For every phrase of the corpus
// (studies/_shared/chorales/: one phrase a .json, or arrays of them), the soprano and the bass from its first chord
// to its last, drawn with all the layers, with each off and with the arch, as the engine's fromOuter reads them — each
// drawn again (10 times at most) until bach-4 can fill its inner voices (Study 71's fill):
//   node studies/63-bridges/tools/bridges.mjs [corpus dir] [out file] [draws a variant] [seed] [shard i/n]
// (a shard i/n draws every n-th phrase from the i-th, its own seed, into out file + ".i"; tools/merge.mjs joins them)
// → out file (default studies/_shared/chorales/bridges.json): [{phrase, soprano, bass, key, keys, readIn, strong,
//   layers, variant, fillable}].
import { readFileSync, writeFileSync, readdirSync, statSync, existsSync } from "node:fs";
import { join } from "node:path";
import { bridgesFor } from "../kairotic/outer.mjs";
import { notesOf } from "../../71-blind/kairotic/blind.mjs";
import { fromOuter } from "../../71-blind/kairotic/rules.mjs";

// (whether bach-4 can fill a bridge's inner voices, as Study 71's fill asks: fromOuter's count above 0)
const keyName = (k) => `${String(k.tonic).replace("♯", "#").replace("♭", "b")} ${k.mode || "major"}`;
// — the bass's units in the bridge's keys, the alto and the tenor of Bach's first and last chords given, as fill does
const fillable = (p) => (b) => {
  const n = b.soprano.length, ends = (i) => Array.from({ length: n }, (_, t) => (t === 0 || t === n - 1 ? { midi: p.satb[t][i], ...(p.names ? { name: p.names[t][i] } : {}) } : null));
  try { return fromOuter({ bass: notesOf(b.bass, b.strong, b.keys || null), soprano: notesOf(b.soprano, b.strong), key: keyName(b.key), style: "bach-4", inner: { alto: ends(1), tenor: ends(2) } }).count() > 0n; } catch { return false; }
};

const dir = process.argv[2] || "studies/_shared/chorales", out = process.argv[3] || join(dir, "bridges.json");
const count = Number(process.argv[4] || 2), [si, sn] = (process.argv[6] || "0/1").split("/").map(Number), seed = Number(process.argv[5] || 1) + si * 1000;
let x = seed * 7919 + 13;
const r = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
for (let i = 0; i < 5; i++) r();

const phrases = [];
const read = (f) => { const v = JSON.parse(readFileSync(f, "utf8")); (Array.isArray(v) ? v : v.phrases || [v]).forEach((p) => p && p.satb && phrases.push(p)); };
const t0 = Date.now();
if (!existsSync(dir)) { console.error(`no corpus at ${dir}`); process.exit(1); }
const walk = (d) => readdirSync(d).forEach((f) => { const p = join(d, f); if (statSync(p).isDirectory()) walk(p); else if (f.endsWith(".json") && f !== "bridges.json") read(p); });
walk(dir);
const all = [];
let none = 0;
const filled = () => all.filter((b) => b.fillable).length;
phrases.forEach((p, i) => {
  if (i % sn !== si) return;
  const bs = bridgesFor(p, { count, r, accept: fillable(p) });
  if (!bs.length) none++;
  all.push(...bs);
  if (i % 200 === 199) console.log(`${i + 1} phrases, ${((Date.now() - t0) / 1000).toFixed(0)} s, ${filled()} of ${all.length} fillable`);
});
writeFileSync(sn > 1 ? `${out}.${si}` : out, JSON.stringify({ source: "Kairotic Study 63 · bridges, outer.mjs (tools/bridges.mjs)", license: "CC BY-NC-SA 4.0 (adapted from phrases.json: its A and B; see LICENSE.md)", count, seed, bridges: all }));
console.log(`${phrases.length} phrases, ${all.length} bridges (${count} a variant), ${none} phrases without one, ${filled()} fillable → ${out}`);
