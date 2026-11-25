// SPDX-License-Identifier: MPL-2.0
// Study 71 · reveal: the kernel's tests. In the browser (tests/kernel.html) and in Node:
//   node -e 'import("./studies/71-reveal/tests/kernel.mjs").then(async m => process.exit(m.report(await m.run())))'
import { layout, crossings } from "../kairotic/layout.mjs";

const P = (boxes, lines) => ({ boxes: Object.fromEntries(boxes.map(([id, text]) => [id, { text }])), lines });

export async function run() {
  const results = [], notes = [];
  const is = (what, ok) => results.push([what, !!ok]);

  // a chain: one under another, in the order the signal goes
  const chain = P([[":b1", "osc~ 220"], [":b2", "gain~ 0.2"], [":b3", "dac~ 1 2"]], [[":b1", 0, ":b2", 0], [":b2", 0, ":b3", 0], [":b2", 0, ":b3", 1]]);
  const L = layout(chain);
  is("a chain: a row each, from the source down", L.ranks[":b1"] === 0 && L.ranks[":b2"] === 1 && L.ranks[":b3"] === 2);
  is("... each box under the one that feeds it", L.places[":b1"][1] < L.places[":b2"][1] && L.places[":b2"][1] < L.places[":b3"][1]
     && Math.abs((L.places[":b2"][0] + 40) - (L.places[":b1"][0] + 40)) < 40);

  // the boxes created in another order than the signal: still drawn as the signal goes
  const mixed = P([[":b1", "dac~ 1 2"], [":b2", "osc~ 220"], [":b3", "lop~ 800"]], [[":b2", 0, ":b3", 0], [":b3", 0, ":b1", 0]]);
  const M = layout(mixed);
  is("created in any order, a box is drawn after what feeds it", M.ranks[":b2"] === 0 && M.ranks[":b3"] === 1 && M.ranks[":b1"] === 2);

  // two sources crossing to two sinks: the order inside the rows uncrosses them
  const cross = P([[":b1", "a"], [":b2", "b"], [":b3", "x"], [":b4", "y"]], [[":b1", 0, ":b4", 0], [":b2", 0, ":b3", 0]]);
  const C = layout(cross);
  is("wires that would cross are uncrossed", C.crossings === 0);
  is("... and no two boxes of a row overlap", Object.values(C.rows).every((row) => {
    const xs = row.filter((id) => !id.startsWith("·")).map((id) => C.places[id][0]);
    return xs.every((x, i) => !i || x > xs[i - 1]);
  }));

  // a wire over several rows passes through points, so it takes part in the order; a loop leaves no row undecided
  const long = P([[":b1", "metro 250"], [":b2", "counter"], [":b3", "mtof"], [":b4", "osc~"], [":b5", "dac~"]],
    [[":b1", 0, ":b2", 0], [":b2", 0, ":b3", 0], [":b3", 0, ":b4", 0], [":b4", 0, ":b5", 0], [":b1", 0, ":b5", 1]]);
  const G = layout(long);
  is("a long wire: points on the rows between", G.rows.flat().filter((id) => id.startsWith("·")).length === 3 && G.ranks[":b5"] === 4);
  const loop = P([[":b1", "+ 1"], [":b2", "f"], [":b3", "print"]], [[":b1", 0, ":b2", 0], [":b2", 0, ":b1", 1], [":b2", 0, ":b3", 0]]);
  const O = layout(loop);
  is("a loop: the wire back is left out of the rows", O.ranks[":b1"] === 0 && O.ranks[":b2"] === 1 && O.ranks[":b3"] === 2);

  // boxes with no wire: a row of their own, below
  const alone = P([[":b1", "osc~"], [":b2", "dac~"], [":b3", "loadbang"], [":b4", "comment"]], [[":b1", 0, ":b2", 0]]);
  const A = layout(alone);
  is("boxes with no wire: in a row below the rest", A.places[":b3"][1] > A.places[":b2"][1] && A.places[":b3"][1] === A.places[":b4"][1] && A.places[":b4"][0] > A.places[":b3"][0]);
  is("the same patch, the same drawing", JSON.stringify(layout(long)) === JSON.stringify(G));

  // a bigger patch: the example work of the app (its boxes and lines)
  const ex = P([[":b1", "canvas"], [":b2", "loadbang"], [":b3", "ramp 0 1 10 loop"], [":b4", "reader path"], [":b5", "freqt"], [":b6", "phasor~ 0.25"],
    [":b7", "reader~ norm 2 gate"], [":b8", "osc~"], [":b9", "osc~"], [":b10", "gain~ 0.4"], [":b13", "gain~"], [":b14", "gain~"],
    [":b15", "adsr~ 30 200 0.6 400"], [":b16", "adsr~ 5 120 0.4 900"], [":b11", "space~ 0 1"], [":b12", "dac~ 1 2"]],
    [[":b2", 0, ":b3", 0], [":b3", 0, ":b4", 0], [":b1", 1, ":b4", 1], [":b6", 0, ":b7", 0], [":b5", 1, ":b7", 1], [":b7", 0, ":b8", 0], [":b7", 1, ":b9", 0],
     [":b8", 0, ":b13", 0], [":b9", 0, ":b14", 0], [":b7", 2, ":b15", 0], [":b7", 3, ":b16", 0], [":b15", 0, ":b13", 1], [":b16", 0, ":b14", 1],
     [":b13", 0, ":b10", 0], [":b14", 0, ":b10", 0], [":b10", 0, ":b11", 0], [":b4", 0, ":b11", 0], [":b11", 0, ":b12", 0], [":b11", 1, ":b12", 1]]);
  const E = layout(ex);
  is("the app's example work: from its sources to the dac~ in six rows", E.ranks[":b12"] === 6 && E.ranks[":b6"] === 0);
  notes.push(`the example work: ${E.rows.length} rows, ${E.crossings} crossings, ${E.size[0]}×${E.size[1]} px`);
  is("... with few crossings", E.crossings <= 2);
  return { results, notes };
}

export function report({ results, notes }) {
  const bad = results.filter((r) => !r[1]);
  for (const [w, ok] of results) console.log((ok ? "  ok   " : "  FAIL ") + w);
  for (const n of notes) console.log("  · " + n);
  console.log(`${results.length - bad.length} / ${results.length} passed`);
  return bad.length ? 1 : 0;
}
