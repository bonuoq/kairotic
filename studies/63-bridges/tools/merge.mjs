// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: joins the shards tools/bridges.mjs wrote (out.0 … out.n-1) into out, in the corpus's order.
//   node studies/63-bridges/tools/merge.mjs [out file] [n]
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";

const out = process.argv[2] || "studies/_shared/chorales/bridges.json", n = Number(process.argv[3] || 2);
const parts = Array.from({ length: n }, (_, i) => JSON.parse(readFileSync(`${out}.${i}`, "utf8")));
const order = new Map(JSON.parse(readFileSync(out.replace(/bridges\.json$/, "phrases.json"), "utf8")).phrases.map((p, i) => [p.id, i]));
const bridges = parts.flatMap((p) => p.bridges).sort((a, b) => (order.get(a.phrase) ?? 0) - (order.get(b.phrase) ?? 0));
writeFileSync(out, JSON.stringify({ ...parts[0], seed: parts.map((p) => p.seed), shards: n, bridges }));
for (let i = 0; i < n; i++) unlinkSync(`${out}.${i}`);
console.log(`${bridges.length} bridges, ${bridges.filter((b) => b.fillable).length} fillable → ${out}`);
