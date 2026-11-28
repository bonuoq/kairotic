// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: the eighths over Bach's own quarters (kairotic/diminish.mjs) measured against his `lines`, on the
// phrases the tables left out (chorales numbered a multiple of 5): his soprano kept as he wrote it, the bass, the
// tenor and the alto diminished —
//   node studies/63-bridges/tools/diminution-measure.mjs [how many phrases] [temp] [seed]
// How many of each voice's quarters are diminished, the figures most drawn, parallel 5ths and octaves between any two
// voices, and the bass's moves note to note (steps, leaps).
import { readFileSync } from "node:fs";
import { diminish, VOICES, parallels } from "../kairotic/diminish.mjs";

const N = Number(process.argv[2] || 1e9), temp = Number(process.argv[3] || 1), seed = Number(process.argv[4] || 1);
let x = seed * 7919 + 13;
const r = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
const P = JSON.parse(readFileSync("studies/_shared/chorales/phrases.json", "utf8")).phrases.filter((p) => Number(p.chorale) % 5 === 0 && p.satb.length >= 3).slice(0, N);
const st = () => ({ dim: Object.fromEntries(VOICES.map((v) => [v, [0, 0]])), par: 0, steps: 0, leaps: 0, held: 0, figs: {} });
const ours = st(), bach = st();
const count = (s, lines, n) => {
  for (const v of VOICES) for (let q = 0; q < n - 1; q++) { const k = lines[v].filter(([on]) => on >= q - 1e-9 && on < q + 1 - 1e-9).length; s.dim[v][1]++; if (k > 1) s.dim[v][0]++; }
  for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) for (let q = 1; q < n; q++) if (parallels(lines[VOICES[i]], lines[VOICES[j]], q - 1, q) !== null) s.par++;
  const B = lines.bass;
  for (let i = 1; i < B.length; i++) { const d = Math.abs(B[i][1] - B[i - 1][1]); if (!d) s.held++; else if (d <= 2) s.steps++; else s.leaps++; }
};
const t0 = Date.now();
for (const p of P) {
  const n = p.satb.length, L = Object.fromEntries(VOICES.map((v) => [v, p.lines[v].map((e) => e.slice(0, 3))]));
  count(bach, L, n);
  const d = diminish({ satb: p.satb, strong: p.strong, keys: p.keys, lines: { soprano: L.soprano }, temp, r });
  count(ours, d.lines, n);
  for (const v of ["bass", "tenor", "alto"]) d.figures[v].forEach((f) => { if (f !== "-") ours.figs[f] = (ours.figs[f] || 0) + 1; });
}
const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + "%";
console.log(`${P.length} phrases held out, temp ${temp}, ${((Date.now() - t0) / 1000).toFixed(1)} s`);
for (const [k, s] of [["ours", ours], ["Bach", bach]]) {
  console.log(`  ${k}: diminished ${VOICES.map((v) => `${v} ${pc(...s.dim[v])}`).join(", ")} · parallel 5ths/8ves ${s.par} · bass note to note: held ${pc(s.held, s.held + s.steps + s.leaps)}, steps ${pc(s.steps, s.held + s.steps + s.leaps)}, leaps ${pc(s.leaps, s.held + s.steps + s.leaps)}`);
}
console.log("  our figures: " + Object.entries(ours.figs).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([f, c]) => `${f} ${c}`).join(" · "));
