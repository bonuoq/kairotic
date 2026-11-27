// SPDX-License-Identifier: MPL-2.0
// Study 76 · continuo: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/76-continuo/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import * as C from "../kairotic/realize.mjs";

const json = async (rel) => {
  if (typeof window !== "undefined") return (await fetch(new URL(rel, import.meta.url))).json();
  const { readFileSync } = await import("node:fs");
  return JSON.parse(readFileSync(new URL(rel, import.meta.url), "utf8"));
};
const text = async (rel) => {
  if (typeof window !== "undefined") return (await fetch(new URL(rel, import.meta.url))).text();
  const { readFileSync } = await import("node:fs");
  return readFileSync(new URL(rel, import.meta.url), "utf8");
};

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // the copies beside the kernel: @kairotic/rules' and Study 63's, as they are
  const pkg = ["rules", "tonal", "soft", "functions", "tension", "bits", "continuo"], s63 = ["under", "under-tables", "outer"];
  const off = [];
  for (const f of pkg) if ((await text(`../kairotic/${f}.mjs`)) !== (await text(`../../../packages/rules/assets/${f}.mjs`))) off.push(f);
  for (const f of s63) if ((await text(`../kairotic/${f}.mjs`)) !== (await text(`../../63-bridges/kairotic/${f}.mjs`))) off.push(f);
  is(`the copies: ${pkg.join(", ")} as @kairotic/rules has them, ${s63.join(", ")} as Study 63 has them`, off.length === 0);

  // the figures as Bach writes them
  is("abbreviate: a 5/3 nothing, its raised 3rd an accidental alone; a 4/3 6/4/3 with its raised 6; a 4/2 6/4/2; a 6/5 as it is",
     C.abbreviate("5/3", "5/3") === "" && C.abbreviate("5/♯3", "5/3") === "♯" && C.abbreviate("♯6/4/3", "4/3") === "♯6/4/3" &&
     C.abbreviate("4/2", "4/2") === "6/4/2" && C.abbreviate("6/5", "6/5") === "6/5" && C.abbreviate("6/♮3", "6/3") === "6/♮");

  const { phrases } = await json("../../_shared/chorales/phrases.json");
  const { phrases: figures } = await json("../../_shared/chorales/figures.json");
  const held = phrases.filter(C.isHeldOut);
  is(`the phrases kept out of the tables: ${held.length}, every fifth chorale's`, held.length > 400 && held.every((p) => p.chorale % 5 === 0));
  const p = phrases.find((x) => x.id === "chor005-1");
  is("Bach's figures read from his voices, one a quarter", C.bachFigures(p).length === p.satb.length);
  const w = C.writtenFigures(phrases.find((x) => x.id === "chor003-1"), figures);
  is("... and as his continuo part has them (BCFB): Ach Gott, wie manches Herzeleid's first phrase", w && w.join(" ") === "♯  ♯6  ♯6/4/3 6/5  ♯");

  // a realization: the bass and its figures under his soprano, the voices over it
  const R = C.realize(p, { r: C.rng(76) });
  is(`realize: under ${p.title}'s first phrase a bass, its figures and its keys, and four voices — the soprano his`,
     !R.fail && R.bass.length === p.satb.length && R.figures.length === p.satb.length && R.keys.length === p.satb.length &&
     R.satb.length === p.satb.length && R.satb.every((c, t) => c[0] === p.satb[t][0] && c[3] === R.bass[t] && c[1] <= c[0] && c[2] <= c[1] + 0 && c[3] <= c[2]));
  const R2 = C.realize(p, { r: C.rng(76) });
  is("... drawn again with the same seed, the same", JSON.stringify(R2.satb) === JSON.stringify(R.satb) && JSON.stringify(R2.figures) === JSON.stringify(R.figures));
  const c = C.compare(p, R);
  is("compare: shares between 0 and 1; Bach against himself 1", [c.bass, c.bassPc, c.chords, c.inner].every((x) => x >= 0 && x <= 1) &&
     Object.values(C.compare(p, { bass: p.satb.map((x) => x[3]), satb: p.satb })).every((x) => x === 1));
  notes.push(`${p.id}: bass ${R.bass.join(" ")} · figures ${R.figures.map((f) => f || "·").join(" ")} · Bach's ${C.bachFigures(p).map((f) => f || "·").join(" ")}`);

  // a few phrases: how many realized, how near
  const r = C.rng(7), few = held.filter((x) => x.satb.length <= 10).slice(0, 8);
  const reals = few.map((x) => [x, C.realize(x, { r })]), done = reals.filter(([, x]) => x.satb);
  is(`of ${few.length} short phrases kept out, ${done.length} realized in four parts`, done.length >= few.length - 2);
  const mean = (k) => done.reduce((a, [x, y]) => a + C.compare(x, y)[k], 0) / done.length;
  notes.push(`against Bach: bass notes ${(100 * mean("bass")).toFixed(0)}%, pitch classes ${(100 * mean("bassPc")).toFixed(0)}%, chords ${(100 * mean("chords")).toFixed(0)}%, inner notes ${(100 * mean("inner")).toFixed(0)}%`);
  // a figure's accidental played: no voice a semitone off a tone the chord asks (the ♯ of a raised 3rd not taken)
  let accs = 0, offs = 0;
  for (const [, y] of done) y.chords.forEach((ch, t) => {
    const want = C.pcsOf(ch); if (!want || !/[♯♭♮]/.test(y.figures[t])) return; accs++;
    const have = y.satb[t].map((m) => ((m % 12) + 12) % 12);
    if (have.some((c) => !want.includes(c) && want.some((w) => ((w - c + 12) % 12) === 1 || ((c - w + 12) % 12) === 1))) offs++;
  });
  is(`the figures' accidentals played: of ${accs} quarters figured with one, ${offs} with a voice a semitone off the chord asked`, accs > 0 && offs <= 1);
  is("pcsOf: A major's pitch classes, E7's", String(C.pcsOf({ root: "A", kind: "" })) === "9,1,4" && String(C.pcsOf({ root: "E", kind: "7" })) === "4,8,11,2");
  const snd = C.soundOf({ satb: [[67, 62, 59, 43], [67, 64, 60, 48]], held: [[false, false, false, false], [true, false, false, false]] }, { unit: 1, fermata: 2 });
  is("soundOf: the soprano held over two quarters, the last a fermata", snd.filter((x) => x.voice === "soprano").length === 1 && snd.find((x) => x.voice === "soprano").dur === 3);
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  for (const [w, ok] of results) if (!ok) console.log("  FAIL " + w);
  for (const s of notes) console.log("  · " + s);
  return bad.length;
}
