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
  is("... each bridge as long as Bach's phrase, from his first chord's soprano and bass to his last's",
     D.trials.every((t) => { const B = t.bridge.satb, A = t.bach.satb, n = A.length; return B.length === n && same([B[0][0], B[0][3]], [A[0][0], A[0][3]]) && same([B[n - 1][0], B[n - 1][3]], [A[n - 1][0], A[n - 1][3]]); }));
  is("... the inner voices between the soprano and the bass, the voices in order (a unison allowed)",
     D.trials.every((t) => t.bridge.satb.every(([s, a, tn, b]) => s >= a && a >= tn && tn >= b)));
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
