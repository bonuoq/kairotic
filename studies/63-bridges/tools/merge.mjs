// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: joins the shards tools/bridges.mjs wrote (out.0 … out.n-1) into out, in the corpus's order.
//   node studies/63-bridges/tools/merge.mjs [out file] [n]
// (shards of one variant — bridges.mjs's last argument — go in place of that variant's bridges, the rest kept)
import { readFileSync, writeFileSync, unlinkSync } from "node:fs";
import { VARIANTS } from "../kairotic/outer.mjs";

const out = process.argv[2] || "studies/_shared/chorales/bridges.json", n = Number(process.argv[3] || 2);
const parts = Array.from({ length: n }, (_, i) => JSON.parse(readFileSync(`${out}.${i}`, "utf8")));
const order = new Map(JSON.parse(readFileSync(out.replace(/bridges\.json$/, "phrases.json"), "utf8")).phrases.map((p, i) => [p.id, i]));
// (shards of one variant: in place of that variant's bridges in out file, the others kept)
const only = parts[0].only, before = only ? JSON.parse(readFileSync(out, "utf8")) : null;
const kept = before ? before.bridges.filter((b) => b.variant !== only) : [];
const vorder = (b) => VARIANTS.findIndex((v) => v.name === b.variant);
const bridges = [...kept, ...parts.flatMap((p) => p.bridges)].sort((a, b) => (order.get(a.phrase) ?? 0) - (order.get(b.phrase) ?? 0) || vorder(a) - vorder(b));
const { only: _, ...head } = parts[0];
writeFileSync(out, JSON.stringify(before ? { ...before, seeds: { ...(before.seeds || {}), [only]: parts.map((p) => p.seed) }, bridges } : { ...head, seed: parts.map((p) => p.seed), shards: n, bridges }));
for (let i = 0; i < n; i++) unlinkSync(`${out}.${i}`);
console.log(`${bridges.length} bridges, ${bridges.filter((b) => b.fillable).length} fillable → ${out}`);
