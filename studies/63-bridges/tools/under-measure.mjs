// SPDX-License-Identifier: MPL-2.0
// Study 63 · bridges: the bass under Bach's soprano (kairotic/under.mjs) measured against Bach, on the phrases the
// tables left out (chorales whose number is a multiple of 5):
//   node studies/63-bridges/tools/under-measure.mjs [variant] [how many phrases] [seed]
//   (UNDER_COSTS=continuo: with the chorale thread's tables, @kairotic/rules' continuo.mjs)
// For each phrase one bass drawn under his soprano: how many of its notes are his (the pitch, the pitch class), how
// many of its figures, how surprised the model is by his bass (bits a note: his line's probability, every chord and
// key under it summed), and the shapes Bach's tables count (figures, motion with the soprano, leaps and steps, the
// cadence's bass).
import { readFileSync } from "node:fs";
import { underBridge, isHeldOut, figureOf } from "../kairotic/under.mjs";
import { chordOf } from "../kairotic/functions.mjs";
import * as CONTINUO from "../../../packages/rules/assets/continuo.mjs";

const variant = process.argv[2] || "all", N = Number(process.argv[3] || 1e9), seed = Number(process.argv[4] || 1);
let x = seed * 7919 + 13;
const r = () => ((x = (x * 16807) % 2147483647) - 1) / 2147483646;
// (UNDER_SET=tune: chorales numbered 1 more than a multiple of 5 instead — among those the tables count — to set the
// weights on without looking at the held-out ones; UNDER_WEIGHTS: weights as JSON)
// UNDER_COSTS=continuo: the chorale thread's tables (@kairotic/rules' continuo.mjs) in place of under-tables.mjs's)
const tune = process.env.UNDER_SET === "tune", weights = JSON.parse(process.env.UNDER_WEIGHTS || "{}"), continuo = process.env.UNDER_COSTS === "continuo" ? CONTINUO : null;
const P = JSON.parse(readFileSync("studies/_shared/chorales/phrases.json", "utf8")).phrases.filter((p) => (tune ? Number(p.chorale) % 5 === 1 : isHeldOut(p)) && p.satb.length >= 3).slice(0, N);
const stat = () => ({ fig: {}, motion: {}, steps: 0, leaps: 0, held: 0, moves: 0, end51: 0, ends: 0 });
const add = (st, S, B, figs, key) => {
  const tp = { C: 0, "C#": 1, Db: 1, D: 2, "D#": 3, Eb: 3, E: 4, F: 5, "F#": 6, Gb: 6, G: 7, "G#": 8, Ab: 8, A: 9, "A#": 10, Bb: 10, B: 11 }[key.tonic] ?? 0;
  figs.forEach((f) => { st.fig[f || "other"] = (st.fig[f || "other"] || 0) + 1; });
  for (let t = 1; t < S.length; t++) {
    const ds = Math.sign(S[t] - S[t - 1]), db = Math.sign(B[t] - B[t - 1]), d = Math.abs(B[t] - B[t - 1]);
    const m = !ds && !db ? "static" : !ds || !db ? "oblique" : ds === db ? "similar" : "contrary";
    st.motion[m] = (st.motion[m] || 0) + 1; st.moves++;
    if (d === 0) st.held++; else if (d <= 2) st.steps++; else st.leaps++;
  }
  st.ends++;
  const b0 = ((B.at(-2) - tp) % 12 + 12) % 12, b1 = ((B.at(-1) - tp) % 12 + 12) % 12;
  if (b1 === 0 && b0 === 7) st.end51++;
};
const ours = stat(), bach = stat();
let same = 0, samePc = 0, sameFig = 0, notes = 0, bits = 0, bitsN = 0, none = 0, inf = 0, dis = 0, disBach = 0;
const t0 = Date.now();
for (const p of P) {
  const S = p.satb.map((c) => c[0]), Bb = p.satb.map((c) => c[3]), n = S.length;
  const bachFigs = p.satb.map((c) => { const ch = chordOf(c); return ch && ch.extra === null ? figureOf(ch) : null; });
  add(bach, S, Bb, bachFigs, p.cadence || p.key);
  const U = underBridge({ soprano: S, key: p.key, strong: p.strong, variant, weights, continuo });
  const y = U.possible ? U.draw(r) : null;
  if (!y) { none++; continue; }
  add(ours, S, y.bass, y.chords.map((c) => c.figure), p.cadence || p.key);
  dis += y.chords.filter((c) => c.dissonance).length;
  if (continuo) disBach += p.satb.filter((_, t) => { const d = continuo.dissonanceOf(p, t); return d && d.voice === "soprano"; }).length;
  for (let t = 0; t < n; t++) { notes++; if (y.bass[t] === Bb[t]) same++; if ((y.bass[t] - Bb[t]) % 12 === 0) samePc++; if (bachFigs[t] && y.chords[t].figure === bachFigs[t] && (y.bass[t] - Bb[t]) % 12 === 0) sameFig++; }
  const lp = U.logProb(Bb);
  if (lp === -Infinity) inf++; else { bits += -lp / Math.LN2; bitsN += n; }
}
const pc = (a, b) => (100 * a / Math.max(1, b)).toFixed(1) + "%";
const dist = (o) => { const s = Object.values(o).reduce((a, b) => a + b, 0); return Object.entries(o).sort((a, b) => b[1] - a[1]).slice(0, 8).map(([k, v]) => `${k} ${(100 * v / s).toFixed(1)}`).join(", "); };
console.log(`${variant}: ${P.length} phrases held out, ${none} without a bass, ${((Date.now() - t0) / 1000).toFixed(0)} s`);
console.log(`  Bach's bass note for note ${pc(same, notes)}, its pitch class ${pc(samePc, notes)}, its pitch class and figure ${pc(sameFig, notes)}`);
console.log(`  Bach's bass under the model: ${(bits / Math.max(1, bitsN)).toFixed(2)} bits a note (${inf} phrases outside it)`);
console.log(`  the soprano a dissonance: ${dis} quarters of ${notes}${continuo ? ` (Bach ${disBach})` : ""}`);
for (const [k, st] of [["ours", ours], ["Bach", bach]]) {
  console.log(`  ${k}: figures ${dist(st.fig)}`);
  console.log(`        motion ${dist(st.motion)} · held ${pc(st.held, st.moves)}, steps ${pc(st.steps, st.moves)}, leaps ${pc(st.leaps, st.moves)} · ⑤–① ends ${pc(st.end51, st.ends)}`);
}
