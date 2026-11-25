// SPDX-License-Identifier: MPL-2.0
// Study 71 · blind: the deck, drawn once and kept, so every listener hears the same trials.
//   node studies/71-blind/tools/deck.mjs [per variant] [seed] [out]
// reads studies/_shared/chorales/phrases.json and bridges.json; writes studies/_shared/chorales/deck.json (adapted
// from them: CC BY-NC-SA 4.0, as they are).
import { readFileSync, writeFileSync } from "node:fs";
import { deckOf } from "../kairotic/blind.mjs";

const per = +(process.argv[2] || 40), seed = +(process.argv[3] || 71), out = process.argv[4] || "studies/_shared/chorales/deck.json";
const dir = "studies/_shared/chorales/";
const P = JSON.parse(readFileSync(dir + "phrases.json", "utf8")), B = JSON.parse(readFileSync(dir + "bridges.json", "utf8"));
const t0 = Date.now();
const D = deckOf(P.phrases, B.bridges, { perVariant: per, seed, log: (s) => process.stderr.write(`\r${s}`.padEnd(70)) });
process.stderr.write("\n");
const deck = {
  source: "Kairotic Study 71 · blind: Bach's phrases (phrases.json) and their bridges (bridges.json, Study 63), the inner voices by @kairotic/rules' fromOuter (bach-4)",
  license: P.license, seed, perVariant: per, ...D,
};
writeFileSync(out, JSON.stringify(deck));
console.log(`${D.trials.length} trials in ${((Date.now() - t0) / 1000).toFixed(0)} s → ${out}`);
for (const v of D.variants) console.log(`  ${v}: ${D.tried[v].filled} of ${D.tried[v].tried} phrases filled`);
console.log(Object.entries(D.failures).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([w, n]) => `  ${n} ${w}`).join("\n"));
