// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: how Bach diminishes a quarter (#353, #342) — the tables kairotic/diminish.mjs draws by, counted
// on the chorales' `lines` (studies/_shared/chorales/phrases.json), every chorale but those numbered a multiple of 5:
//   node studies/63-bridges/tools/diminution-tables.mjs [phrases.json] [out .mjs]
// For each voice, each quarter struck on its beat and not the phrase's last: its figure — the onsets inside the
// quarter, their lengths and their pitches over the quarter's own note (semitones) — given the voice, whether the
// quarter is strong, and how far the next quarter's note is (semitones). "-" a quarter kept whole. And a note the frame
// repeats into the next quarter: how often it is tied over rather than struck again, by voice and beat.
import { readFileSync, writeFileSync } from "node:fs";

const src = process.argv[2] || "studies/_shared/chorales/phrases.json", out = process.argv[3] || "studies/63-bridges/kairotic/diminution-tables.mjs";
const P = JSON.parse(readFileSync(src, "utf8")).phrases;
const VOICES = ["soprano", "alto", "tenor", "bass"];
const T = {}, inc = (k, f) => { (T[k] ??= {})[f] = (T[k][f] || 0) + 1; };
// (a note the frame repeats into the next quarter: tied over or struck again, by voice and beat)
const ties = {}, tie = (k, f) => { (ties[k] ??= { tied: 0, struck: 0 })[f]++; };
let quarters = 0, phrases = 0;
for (const p of P) {
  if (Number(p.chorale) % 5 === 0) continue;
  phrases++;
  const n = p.satb.length;
  VOICES.forEach((v, vi) => {
    const L = p.lines[v];
    for (let q = 1; q < n; q++) if (p.satb[q][vi] === p.satb[q - 1][vi]) tie(`${v}|${p.strong[q] ? "strong" : "weak"}`, L.some(([on]) => Math.abs(on - q) < 1e-9) ? "struck" : "tied");
    for (let q = 0; q < n - 1; q++) {
      const starts = L.filter(([on]) => on >= q - 1e-9 && on < q + 1 - 1e-9);
      if (!starts.length || Math.abs(starts[0][0] - q) > 1e-9) continue;          // held into the quarter: not its own
      const frame = p.satb[q][vi], ctx = `${v}|${p.strong[q] ? "strong" : "weak"}|${p.satb[q + 1][vi] - frame}`;
      quarters++;
      if (starts.length === 1) { inc(ctx, "-"); continue; }
      const rh = starts.map(([on, , d]) => +Math.min(d, q + 1 - on).toFixed(3)).join(" ");
      inc(ctx, `${rh}|${starts.map(([, m]) => m - frame).join(",")}`);
    }
  });
}
writeFileSync(out, `// SPDX-License-Identifier: CC-BY-NC-SA-4.0
// Written by tools/diminution-tables.mjs from studies/_shared/chorales/phrases.json (Sapp's edition of Bach's
// chorales, CC BY-NC-SA 4.0): "voice|beat|to the next quarter (semitones)" → {figure: count}, a figure "lengths|pitches
// over the quarter's note", "-" kept whole; the chorales numbered a multiple of 5 left out. Do not edit by hand.
export const DIMINUTION_TABLES = ${JSON.stringify({ source: "Bach's chorales, lines (phrases.json), chorales whose number is not a multiple of 5", phrases, quarters, tables: T, ties })};
`);
console.log(`${phrases} phrases, ${quarters} quarters, ${Object.keys(T).length} contexts → ${out}`);
