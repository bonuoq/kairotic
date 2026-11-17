// SPDX-License-Identifier: MPL-2.0
// Study 50 · lines: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/50-lines/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { lines, speedOf, latticeFor } from "../kairotic/lines.mjs";
import { mirror } from "../kairotic/mirror.mjs";
import { engineWork, allWorks, shape } from "../kairotic/engine.mjs";

const base = { tonic: 1, lo: 0, hi: 9, spacing: 11, starts: [1, 5, 8] };   // D dorian, its range and its starts

/** A relation on its lattice: a dux note a units (the least the speed allows), bars of two dux notes. */
function rel(speed, m, extra = {}) {
  const a = latticeFor(speed);
  return lines({ ...base, m, a, bar: 2 * a, speed, k: -7, ...extra });
}

/** Every unit of a whole work judged again, from the start: the rules refuse nothing. */
function sound(L, M) {
  const { D, C } = L.lines(M);
  for (let t = 0; t < L.n; t++) {
    const r = L.rules.checkDux(D.slice(0, t), C.slice(0, t), D[t]) || L.rules.checkPair(D.slice(0, t), C.slice(0, t), D[t], C[t]);
    if (r) return `unit ${t}: ${r}`;
  }
  return null;
}

/** A random number of the test's own (Park–Miller): the same works every run. */
const rng = (seed) => () => ((seed = (seed * 16807) % 2147483647) - 1) / 2147483646;

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);
  const time = (f) => { const t0 = performance.now(); const v = f(); return [v, Math.round(performance.now() - t0)]; };

  // speeds and lattices
  is("speeds in lowest terms, signed: 2/3, −1/2, 4/2 → 2/1, 0.5 → 1/2", JSON.stringify([speedOf("2/3"), speedOf("-1/2"), speedOf([4, 2]), speedOf(0.5)]) === "[[2,3],[-1,2],[2,1],[1,2]]");
  is("the lattice a speed needs: 1 unit a note at 1, 1/2, −1; 2 at 2/3 and 2; 3 at 3/2", [1, "1/2", -1, "2/3", 2, "3/2"].map((s) => latticeFor(s)).join(" ") === "1 1 1 2 2 3");

  // regression: the relations of Studies 41–43 are cases of this one, and count as they did there
  const mspec = (n, transform) => ({ ...base, n, b: 2, transform });
  for (const [name, ls, ms, known] of [
    ["a canon an octave below, 3 beats late, 15 beats (Study 41)", { m: 15, speed: 1, d: 3 }, mspec(15, { kind: "canon", k: -7, d: 3 }), 707134],
    ["an inversion at the unison, 3 beats late, 11 beats", { m: 11, speed: 1, d: 3, k: 0, inverted: true }, mspec(11, { kind: "inversion", k: 0, d: 3 }), 5360],
    ["an augmentation (speed 1/2), 2 beats late, 11 beats", { m: 11, speed: "1/2", d: 2 }, mspec(11, { kind: "augmentation", k: -7, d: 2, m: 2 }), 8119],
    ["a crab (speed −1), an octave below, 11 beats", { m: 11, speed: -1 }, mspec(11, { kind: "crab", k: -7 }), 6959],
    ["a table canon (speed −1, inverted), 11 beats", { m: 11, speed: -1, k: 0, inverted: true }, mspec(11, { kind: "table", k: 0 }), 13212],
  ]) {
    const [c, ms1] = time(() => lines({ ...base, a: 1, bar: 2, k: -7, ...ls }).count());
    const mc = mirror(ms).count();
    is(`${name}: ${known}, as Study 43's mirror counts it`, c === known && mc === known);
    notes.push(`${name}: ${c} (${ms1} ms)`);
  }

  // the order of writing follows from the relation
  is("speed 1: written forwards", lines({ ...base, m: 9, a: 1, bar: 2, speed: 1, d: 3 }).order.join(" ") === "0 1 2 3 4 5 6 7 8");
  is("speed −1: from both ends to the middle, as Study 43 writes a crab", lines({ ...base, m: 11, a: 1, bar: 2, speed: -1 }).order.join(" ") === "0 10 1 9 2 8 3 7 4 6 5");
  const ca = rel("-1/2", 9);
  notes.push(`speed −1/2 (a crab in augmentation, 9 notes): written in the order ${ca.order.join(" ")}`);
  is("speed −1/2: from both ends, but meeting off the middle (the comes reads only the dux's second half)", ca.order[0] === 0 && ca.order[1] === 8 && ca.order[ca.order.length - 1] !== 4);

  // new relations: their futures counted, and a work drawn from them sound unit by unit
  const draw = rng(7);
  for (const [name, L, known] of [
    ["a hemiola (speed 2/3): three comes notes in the time of two of the dux, 10 notes", rel("2/3", 10), 578],
    ["... with a free last note of the comes (a coda)", rel("2/3", 10, { coda: true }), 7794],
    ["a sesquialtera (speed 3/2): the comes enters late and reads the whole dux by the end, 9 notes", rel("3/2", 9), 873],
    ["a diminution (speed 2), 9 notes", rel(2, 9), 1236],
    ["a crab in augmentation (speed −1/2), 9 notes", rel("-1/2", 9), null],
    ["a crab in hemiola (speed −2/3) at the unison, 10 notes", rel("-2/3", 10, { k: 0 }), 151],
  ]) {
    const [c, ms1] = time(() => L.count());
    notes.push(`${name}: ${c} (a dux note ${L.a} unit${L.a > 1 ? "s" : ""}, a comes note ${L.comesUnits}; ${ms1} ms)`);
    is(`${name}: ${known ?? "some"} works`, known === null ? c > 0 : c === known);
    const M = L.sample(draw);
    const why = M && sound(L, M);
    is(`... a work drawn from them is sound, unit by unit, and is one of them`, M && !why && L.count(M, L.steps) === 1);
    if (M) notes.push(`    dux ${M.slice(0, L.m).map(L.system.pitchName).join(" ")}${L.coda ? " · the comes's coda " + L.system.pitchName(L.T(M[L.m])) : ""}`);
  }

  // what the relations say about counterpoint
  const dim = rel(2, 9, { coda: false });
  is("a diminution that ends with the dux has no works: its last two notes are the dux's last two, a parallel perfect interval (hence the coda)", dim.count() === 0);
  const back = rel("-2/3", 10);
  is("a crab in hemiola an octave below has none either (at the unison it has)", back.count() === 0);

  // the melodic weight: drawn uniformly a dux leaps, because most works do; the engine (the soft rules of Studies
  // 38–42) weighs them; a hemiola leaps by its nature
  const hem = rel("2/3", 10, { coda: true }), all = allWorks(hem);
  const most = Math.max(...all.map((M) => { let k = 0; for (let i = 1; i < hem.m; i++) if (Math.abs(M[i] - M[i - 1]) === 1) k++; return k; }));
  is(`a hemiola's dux has at most 4 steps in its 9 moves (of ${all.length} works): it must sound with itself a note and a half later`, all.length === 7794 && most === 4);
  const cr = lines({ ...base, m: 11, a: 1, bar: 2, speed: -1, k: -7 }), r2 = rng(11);
  const u = [], e = [];
  for (let i = 0; i < 20; i++) { u.push(cr.sample(r2).slice(0, cr.m)); const E = engineWork(cr, { temp: 1, r: r2 }); e.push(E.M.slice(0, cr.m)); }
  const su = shape(u), se = shape(e), best = engineWork(cr, { temp: 0 });
  is(`a crab: drawn uniformly ${Math.round(100 * su.steps)}% steps, by the engine ${Math.round(100 * se.steps)}%; its cheapest work is one of the works`, se.steps > su.steps + 0.05 && best.all && cr.count(best.M, cr.steps) === 1);
  notes.push(`crab (11): uniform steps ${Math.round(100 * su.steps)}% / 4th+ ${Math.round(100 * su.leaps)}%, engine ${Math.round(100 * se.steps)}% / ${Math.round(100 * se.leaps)}%; the cheapest: ${best.M.map(cr.system.pitchName).join(" ")}`);
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  for (const [w, ok] of results) if (!ok) console.log("  FAIL " + w);
  for (const s of notes) console.log("  · " + s);
  return bad.length;
}
