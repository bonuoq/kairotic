// SPDX-License-Identifier: MPL-2.0
// Study 64 · florid: Fux's examples measured, and the engine's costs fitted to them (FUX_COSTS in measure.mjs).
//   node studies/64-florid/corpus/fit.mjs
import * as F from "../kairotic/florid.mjs";
import * as M from "../kairotic/measure.mjs";

const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const lines = (await M.loadFux()).filter((x) => x.cfPart === "Lower").map(M.lineOfKern);
const T = M.measure(lines);
console.log(M.describe(T).join("\n"));
const fux = Object.values(F.CANTI).filter((c) => c.fux);
const gen = (costs, s0) => {
  const out = [];
  for (const c of fux) for (let s = s0; s < s0 + Number(process.env.SEEDS || 8); s++) { const x = F.florid(c.cf, c.key, { r: rng(s), costs }); if (x) out.push({ cf: c.cf, key: c.key, eighths: x.eighths, frame: x.frame }); }
  return out;
};
console.log("the catalogue's costs:", M.distance(M.measure(gen(null, 1)), T, 0.5, { parts: true }));
const fit = M.fitCosts(T, (c) => gen(c, 1), { rounds: Number(process.env.ROUNDS || 12), eta: Number(process.env.ETA || 0.35) });
console.log("rounds:", fit.rounds.map((r) => r.distance.toFixed(3)).join(" → "));
console.log("fitted, other seeds:", M.distance(M.measure(gen(fit.costs, 301)), T, 0.5, { parts: true }));
const round = (o) => Object.fromEntries(Object.entries(o).map(([k, v]) => [k, Math.round(100 * v) / 100]));
console.log("export const FUX_COSTS = " + JSON.stringify({ figures: round(fit.costs.figures), cells: round(fit.costs.cells), bars: round(fit.costs.bars), frame: round(fit.costs.frame) }) + ";");
