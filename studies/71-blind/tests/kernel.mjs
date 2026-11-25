// SPDX-License-Identifier: MPL-2.0
// Study 71 · blind: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/71-blind/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as Bl from "../kairotic/blind.mjs";

const json = async (rel) => {
  if (typeof window !== "undefined") return (await fetch(new URL(rel, import.meta.url))).json();
  const { readFileSync } = await import("node:fs");
  return JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
};

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // a voice given unit by unit: held onto a weak unit, struck again onto a strong one
  const N = Bl.notesOf([60, 60, 60, 62], [true, false, true, false]);
  is("notesOf: a note repeated onto a weak unit is held, onto a strong one struck again", N.length === 3 && N[0].units === 2 && N[1].units === 1 && N[2].midi === 62);
  // the sound: a quarter a unit, held notes tied, the last chord a fermata
  const item = { satb: [[67, 62, 59, 43], [67, 64, 60, 48], [66, 62, 57, 50]], held: [[false, false, false, false], [true, false, false, false], [false, false, false, false]] };
  const snd = Bl.soundOf(item, { unit: 1, fermata: 2 });
  const sop = snd.filter((x) => x.voice === "soprano");
  is("soundOf: the soprano's G held over two units (one note of 2), its F♯ a fermata (2)", sop.length === 2 && sop[0].dur === 2 && sop[1].on === 2 && sop[1].dur === 2 && snd.length === 11);
  is("... the phrase lasts 4 units", Bl.lengthOf(item, { unit: 1, fermata: 2 }) === 4);
  // the statistics
  is("binomialP: 10 of 10 against chance 2/1024, 5 of 10 1, 8 of 10 0.109", Math.abs(Bl.binomialP(10, 10) - 2 / 1024) < 1e-9 && Math.abs(Bl.binomialP(5, 10) - 1) < 1e-9 && Math.abs(Bl.binomialP(8, 10) - 0.109375) < 1e-6);
  const [lo, hi] = Bl.wilson(10, 20);
  is("wilson: 10 of 20 between 0.299 and 0.701", Math.abs(lo - 0.2993) < 1e-3 && Math.abs(hi - 0.7007) < 1e-3);
  const sc = Bl.score([{ variant: "all", correct: true, sure: true }, { variant: "all", correct: false }, { variant: "arch", correct: true }]);
  is("score: by variant and overall, the sure ones apart", sc.all.n === 2 && sc.all.found === 1 && sc.all.sure.found === 1 && sc.arch.rate === 1 && sc.overall.n === 3 && sc["no-tension"].n === 0);

  // the deck, as it is kept
  const D = await json("../../_shared/chorales/deck.json");
  const by = Object.fromEntries(Bl.VARIANTS.map((v) => [v, D.trials.filter((t) => t.variant === v)]));
  is(`the deck: ${D.trials.length} trials, ${D.perVariant} of each variant, every phrase once`,
     Bl.VARIANTS.every((v) => by[v].length === D.perVariant) && new Set(D.trials.map((t) => t.phrase)).size === D.trials.length);
  const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i]);
  is("... each bridge as long as Bach's phrase, from his first chord to his last, whole (the four voices as his)",
     D.trials.every((t) => { const B = t.bridge.satb, A = t.bach.satb, n = A.length; return B.length === n && same(B[0], A[0]) && same(B[n - 1], A[n - 1]); }));
  // (the inner voices' moves, as often as Bach's: a note kept, a step, a 3rd, a 4th, wider)
  const motion = (key) => { const c = [0, 0, 0, 0, 0]; let n = 0; for (const t of D.trials) { const X = t[key].satb; for (const v of [1, 2]) for (let u = 1; u < X.length; u++) { const d = Math.abs(X[u][v] - X[u - 1][v]); c[d === 0 ? 0 : d <= 2 ? 1 : d <= 4 ? 2 : d === 5 ? 3 : 4]++; n++; } } return c.map((x) => (100 * x) / n); };
  const mb = motion("bach"), mr = motion("bridge"), fmt = (m) => m.map((x) => x.toFixed(1)).join(" / ");
  is(`... their inner voices move nearly as Bach's: kept / step / 3rd / 4th / wider — ${fmt(mr)}% (Bach ${fmt(mb)}%), a 4th or wider within 4 points of his`, Math.abs(mr[3] + mr[4] - mb[3] - mb[4]) < 4);
  notes.push(`the inner voices' moves, kept / step / 3rd / 4th / wider: bridges ${fmt(mr)}%, Bach ${fmt(mb)}%`);
  // (voice exchanges with an inner voice: two voices trading their notes' classes in contrary motion, over one unit or
  // two by step — as often in the bridges as in Bach's phrases)
  const pc = (m) => ((m % 12) + 12) % 12;
  const exchanges = (X) => { let e = 0; for (let t = 1; t < X.length; t++) for (const k of [1, 2]) { const s = t - k; if (s < 0) continue; for (let i = 0; i < 4; i++) for (let j = i + 1; j < 4; j++) { if (![i, j].some((v) => v === 1 || v === 2)) continue; const a0 = X[s][i], b0 = X[s][j], a1 = X[t][i], b1 = X[t][j]; if (pc(a0) === pc(b0) || pc(a1) !== pc(b0) || pc(b1) !== pc(a0) || a1 === a0 || Math.sign(a1 - a0) !== -Math.sign(b1 - b0)) continue; if (k === 2 && [[a0, X[t - 1][i], a1], [b0, X[t - 1][j], b1]].some(([x, y, z]) => Math.abs(y - x) > 2 || Math.abs(z - y) > 2)) continue; e++; } } return e; };
  const rate = (key) => { let e = 0, u = 0; for (const t of D.trials) { e += exchanges(t[key].satb); u += t[key].satb.length; } return (100 * e) / u; };
  const xb = rate("bach"), xr = rate("bridge");
  is(`... and trade their notes with another voice (a voice exchange) about as often as Bach's: ${xr.toFixed(1)} per 100 chords (Bach ${xb.toFixed(1)})`, Math.abs(xr - xb) < 2.5);
  notes.push(`voice exchanges with an inner voice, per 100 chords: bridges ${xr.toFixed(1)}, Bach ${xb.toFixed(1)}`);
  // (the dissonances against the bass as rare as Bach's: the chords with one, the semitone's clashes — a ♭9, a major 7th)
  const DISS = new Set([1, 2, 5, 6, 10, 11]);
  const dis = (key) => { let ch = 0, cl = 0, u = 0; for (const t of D.trials) for (const c of t[key].satb) { u++; const iv = [0, 1, 2].map((v) => pc(c[v] - c[3])); if (iv.some((x) => DISS.has(x))) ch++; cl += iv.filter((x) => x === 1 || x === 11).length; } return [(100 * ch) / u, (100 * cl) / u]; };
  const [db, cb] = dis("bach"), [dr, cr] = dis("bridge");
  is(`... and dissonate against the bass about as often as Bach's: ${dr.toFixed(1)}% of the chords (Bach ${db.toFixed(1)}%), a semitone's clash in ${cr.toFixed(1)} per 100 (Bach ${cb.toFixed(1)})`, Math.abs(dr - db) < 5 && cr < 2 * cb + 1);
  notes.push(`chords with a dissonance against the bass: bridges ${dr.toFixed(1)}%, Bach ${db.toFixed(1)}%; semitone clashes per 100 chords: ${cr.toFixed(1)}, Bach ${cb.toFixed(1)}`);
  is("... between the ends (Bach's, his voices crossing where they do) the inner voices between the soprano and the bass, in order (a unison allowed)",
     D.trials.every((t) => t.bridge.satb.slice(1, -1).every(([s, a, tn, b]) => s >= a && a >= tn && tn >= b)));
  const filled = Bl.VARIANTS.map((v) => `${v} ${D.tried[v].filled}/${D.tried[v].tried}`).join(", ");
  is(`... the phrases tried and filled by bach-4, counted (${filled})`, Bl.VARIANTS.every((v) => D.tried[v].filled === D.perVariant && D.tried[v].tried >= D.perVariant));
  notes.push(`the deck: phrases tried and filled by variant — ${filled}`);
  // a listening
  const S = Bl.sessionOf(D, { perVariant: 4, seed: 7 });
  is("sessionOf: 20 trials, 4 of each variant, Bach first in some and second in others",
     S.length === 20 && Bl.VARIANTS.every((v) => S.filter((x) => x.trial.variant === v).length === 4) && S.some((x) => x.bachFirst) && S.some((x) => !x.bachFirst));
  const S2 = Bl.sessionOf(D, { perVariant: 4, seed: 7, done: new Set(S.map((x) => x.trial.id)) });
  is("... the next one without the trials already heard", S2.length === 20 && S2.every((x) => !S.some((y) => y.trial.id === x.trial.id)));
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  for (const [w, ok] of results) if (!ok) console.log("  FAIL " + w);
  for (const s of notes) console.log("  · " + s);
  return bad.length;
}
