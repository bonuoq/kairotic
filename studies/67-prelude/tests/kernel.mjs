// SPDX-License-Identifier: MPL-2.0
// Study 67 · prelude: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/67-prelude/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as P from "../kairotic/prelude.mjs";
import { chordOf } from "../kairotic/compress.mjs";
import { grammarErrors } from "../kairotic/functions.mjs";

const load = async (id) => {
  const url = new URL(`../data/${id}.json`, import.meta.url);
  if (typeof window !== "undefined") return (await fetch(url)).json();
  const { readFileSync } = await import("node:fs");
  return JSON.parse(readFileSync(url, "utf8"));
};
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;
const names = (rows) => rows.map((r) => (chordOf(r) || { name: "?" }).name);

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const raw = await load("bwv846-prelude");
  const { c, H, an, figure } = P.read(raw);

  // ─── the harmony: Study 66's figure, its chords as voices ───
  is("BWV 846's figure (Study 66): a broken chord over five notes, used in 32 bars", figure && figure.k === 5 && P.chordsOf(c).length === 32);
  is("its harmony: 32 chords of the figure, the two bars written out before the end, the final one; five voices (b v1 v2 v3 m)", H.units === 35 && H.voices.join(" ") === "b v1 v2 v3 m" && H.rows.every((r) => r.length === 5));
  is("… from C, Dm7/C, G7/B, C, Am/C, D7/C… to the final C (its bass the last bar's C2)", names(H.rows).slice(0, 6).join(" ") === "C Dm7/C G7/B C Am/C D7/C" && names(H.rows)[34] === "C" && H.rows[34][0] === 36);
  is("… the cadence the figure does not cover read too, over the tonic pedal: C7 – F/C – G7 (B over C) – C", names(H.rows).slice(31).join(" ") === "C7 F/C G7/B(+C) C");
  const held = H.notes.filter((n) => n.dur > 1);
  is("a voice keeping its pitch holds its note: the common tones (the G2 pedal of bars 24–31 one note)", held.length > 10 && H.notes.some((n) => n.voice === "b" && n.pitch === "G2" && n.dur >= 8));
  is("a voice meeting another at the end: the four notes of the final chord reached by the five voices, none crossing",
     new Set(H.rows[34]).size === 4 && H.rows[34].every((p, i) => i === 0 || p >= H.rows[34][i - 1]));

  // ─── its tonal functions (functions.mjs, @kairotic/rules) ───
  const F = P.levelFunctions(an.levels[0]);
  is("the surface's functions: T S D T, T V/G D T…, and the grammar of a tonal phrase kept throughout (no dominant taken back, every applied dominant resolved)",
     F.slice(0, 7).map(P.label).join(" ") === "T S D T T V/G D" && grammarErrors(F).length === 0);
  const free = P.analyse(H, { functional: false });
  is("reduced without them, the economy takes away what the harmony needs: some level goes D → S (G7 → F/C) or leaves an applied dominant unresolved",
     free.levels.some((L) => grammarErrors(P.levelFunctions(L)).length > 0));
  is("reduced with them, every level a tonal phrase: no step may break the grammar (strict: where none is left, the frame)",
     an.functional && an.levels.every((L) => grammarErrors(P.levelFunctions(L)).length === 0));

  // ─── its levels (Study 61's reduction, a chord a unit, the functions as its judge) ───
  const last = an.levels[an.levels.length - 1];
  is("reduced level by level to a frame of 14 chords, the first and the last kept", an.levels.length >= 5 && last.length === 14 && last[0].on === 0 && last[last.length - 1].on === 34);
  const fr = P.frameChords(an);
  is("… the frame: C – Am/C – D7 – C♯°7 (written G°7, over G) – Dm/F – G7 – C – Fmaj7 – F♯°7 – G7 – C/G – C7 – F/C – C: the applied dominants kept with what they lead to — C7, V of ④, with its F — and the plagal cadence over the tonic pedal (not the retrogression G7 → F/C)",
     fr.join(" ") === "C Am/C D7 G°7 Dm/F G7 C Fmaj7 F♯°7 G7 C/G C7 F/C C");
  notes.push("the frame: " + fr.join(" – ") + " · without the functions: " + P.frameChords(free).join(" – "));
  is("… every step an ornament of the grammar (unsplit: notes held, passing, neighbours)", an.steps.length >= 20 && an.steps.every((s) => s.op === "unsplit" || s.op === "unspread" || s.op === "unsuspend"));

  // ─── the bits of each level (bits.mjs) ───
  const B = P.bitsByLevel(an);
  notes.push("bits by level: " + B.map((b) => `L${b.k} ${b.slices} chords ${b.level.toFixed(0)}+${b.derivation.toFixed(0)}`).join(" · "));
  is("a level says less than the surface: the frame's voices in about two thirds of the surface's bits", B[B.length - 1].level < 0.7 * B[0].level && B.every((b, k) => k === 0 || b.level <= B[k - 1].level + 1));
  is("… but saying how the surface comes from it costs more than it saves: the reduction explains the harmony, it does not compress it (the voice-leading is already cheap)", B[B.length - 1].total > B[0].total && B[0].derivation === 0);

  // ─── both ways: a new harmony from a level's frame, the figure on it ───
  const k = an.levels.length - 1, rows = P.rewrite(an, k, { r: rng(3) });
  is("a new harmony from the frame: 35 chords, every frame chord where it was", rows && rows.length === 35 && last.every((s) => rows[s.on].join() === H.rows[s.on].join()));
  const fresh = rows.filter((r, u) => !last.some((s) => s.on === u));
  is("… every chord written anew a major or minor triad, the voices not crossing, no voice leaping more than a fourth", fresh.every((r) => ["", "m"].includes(chordOf(r).kind)) && rows.every((r) => r.every((p, i) => i === 0 || p >= r[i - 1])) &&
     rows.every((r, u) => u === 0 || r.every((p, i) => Math.abs(p - rows[u - 1][i]) <= 5 || last.some((s) => s.on === u))));
  is("… and different from Bach's", rows.filter((r, u) => r.join() !== H.rows[u].join()).length >= 15);
  is("… a tonal phrase too: the functions' grammar kept in every bar written anew", grammarErrors(P.levelFunctions(rows.map((r) => ({ notes: r.map((p) => ({ pitch: P.spell(p) })) })))).length === 0);
  notes.push("a new harmony from the frame: " + names(rows).join(" "));
  const shallow = P.rewrite(an, 1, { r: rng(3) });
  is("from a shallower level, more of Bach's kept", shallow && shallow.filter((r, u) => r.join() === H.rows[u].join()).length > rows.filter((r, u) => r.join() === H.rows[u].join()).length);
  // ─── tension (tension.mjs: Lerdahl's Tonal Pitch Space) ───
  const T = P.tensionOf(an), at = (u) => T.find((t) => t.on === u);
  is("tension, chord by chord (its δ from its prolongational parent, the parent's from the frame, the frame's from the tonic): C at 0 where it begins and ends", at(0).hierarchical === 0 && at(34).hierarchical === 0);
  is("… tighter in the tonicization of G (bars 5–11) than in the first bars, and the dominant pedal (bars 24–31) tighter than the tonic it resolves into",
     Math.max(...T.filter((t) => t.on >= 4 && t.on <= 10).map((t) => t.hierarchical)) > Math.max(...T.filter((t) => t.on <= 3).map((t) => t.hierarchical)) &&
     T.filter((t) => t.on >= 23 && t.on <= 30).every((t) => t.hierarchical > 0) && at(34).hierarchical < at(30).hierarchical);
  notes.push("hierarchical tension: " + T.map((t) => `${t.name} ${t.hierarchical}`).join(" · "));
  const corr = (shape) => [1, 2, 3, 4].map((sd) => P.tensionCorrelation(P.rewrite(an, k, { r: rng(sd), shape }), H.rows)).reduce((a, b) => a + b, 0) / 4;
  const c0 = corr(0), c3 = corr(3);
  is("a new harmony that keeps Bach's tension shape (each chord as far from the tonic as his at that bar): its tension curve closer to his than without (correlation, 4 draws)", c3 > c0 + 0.1);
  notes.push(`tension curve against Bach's: ${c0.toFixed(2)} without the shape, ${c3.toFixed(2)} with it`);
  const prelude = P.realize(figure, rows);
  is("the figure on it: a new prelude of 35 bars, 16 notes a bar, its first bar Bach's", prelude.length === 35 * 16 && prelude.slice(0, 16).map((x) => x[2]).join() === raw.slice().sort((a, b) => a[0] - b[0] || a[2] - b[2]).slice(0, 16).map((x) => x[2]).join());
  is("… drawn again, another prelude", P.rewrite(an, k, { r: rng(11) }).some((r, u) => r.join() !== rows[u].join()));
  return { results, notes };
}

export function report({ results, notes }) {
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const s of notes) console.log("  · " + s);
  const bad = results.filter((r) => !r[1]).length;
  console.log(`${results.length - bad} / ${results.length}`);
  return bad ? 1 : 0;
}
