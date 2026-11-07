// SPDX-License-Identifier: MPL-2.0
// Issue #166, 3: which box is drawn over which. Boxes are stacked in the order of their ids (as numbers, not
// as text), and moving one brings it to the front, in the same event; the order is part of the work.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 6000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(60); }
  return got;
};

// the ids of the boxes in the scene, in the order they are drawn (the last one is on top)
const drawn = (page, ids) => page.evaluate((ids) =>
  [...document.querySelectorAll("#scene > g.box")].map((g) => g.dataset.box).filter((b) => ids.includes(b)), ids);

export async function zorder(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the z-order tests", false); return; }
  const events = "(depth-of (norm (:pos @world)))";

  // ── the default order: the number of the id, not its text ──
  check("boxes stack by the number of their id (:b10 over :b9 and :b2)",
    (await cljs(page, "(mapv first (by-z {:b10 {} :b2 {} :b9 {}}))")) === "[:b2 :b9 :b10]");
  check("... a :z puts a box elsewhere in the stack",
    (await cljs(page, "(mapv first (by-z {:b10 {} :b2 {:z 11} :b9 {}}))")) === "[:b9 :b10 :b2]");

  // three boxes on top of each other, far from the rest
  const a = (await cljs(page, '(box "print a" 7000 300)')).trim();
  const b = (await cljs(page, '(box "print b" 7010 305)')).trim();
  const c = (await cljs(page, '(box "print c" 7020 310)')).trim();
  const ids = [a, b, c].map((x) => x.slice(1));
  check("new boxes are drawn in the order they were made", JSON.stringify(await drawn(page, ids)) === JSON.stringify(ids));
  // (the work these tests share has boxes other suites moved: a patch of its own here)
  check("... and the code of a patch in that order needs no (stack …)",
    (await cljs(page, '(str/includes? (patch->code {:boxes (sorted-map :b2 {:text "x" :x 0 :y 0} :b10 {:text "y" :x 0 :y 0}) :lines []}) "(stack ")')) === "false");
  check("... while one in another order does",
    (await cljs(page, '(str/includes? (patch->code {:boxes (sorted-map :b2 {:text "x" :x 0 :y 0 :z 11} :b10 {:text "y" :x 0 :y 0}) :lines []}) "(stack :b10 :b2)")')) === "true");

  // ── moving a box brings it to the front, in the same event ──
  const e0 = Number(await cljs(page, events));
  await cljs(page, `(move ${a} 7000 320)`);
  check("(move …) brings the box to the front", JSON.stringify(await drawn(page, ids)) === JSON.stringify([ids[1], ids[2], ids[0]]));
  check("... in one event of the history", Number(await cljs(page, events)) === e0 + 1, await cljs(page, events));
  check("... a layout change for Perform", (await cljs(page, `(layout-ev? (current) [:batch [[:move ${a} 0 0] [:z ${a} 9]]])`)) === "true");
  const z1 = await cljs(page, `(:z (get-in (current) [:boxes ${a}]))`);
  await cljs(page, `(move ${a} 7000 330)`);
  check("moving the box on top again does not change its place in the stack", (await cljs(page, `(:z (get-in (current) [:boxes ${a}]))`)) === z1);

  // the work's code keeps the order, and builds the same stack
  const code = await cljs(page, "(patch->code (current))");
  check("the work's code writes the order", code.includes(`(stack `) && /\(stack [^)]*:b\d+[^)]*\)/.test(code));
  const rebuilt = await cljs(page, `(let [q (build (patch->code (current)))] (= (mapv first (by-z (:boxes q))) (mapv first (by-z (:boxes (current))))))`);
  check("... and the code, run again, stacks the boxes the same way", rebuilt === "true", rebuilt);

  // a new box goes on top of the ones brought to the front
  const d = (await cljs(page, '(box "print d" 7030 315)')).trim();
  ids.push(d.slice(1));
  check("a box made after one was brought to the front goes on top", (await drawn(page, ids)).at(-1) === ids[3]);

  // ── several boxes moved together: one event, their order kept ──
  const e1 = Number(await cljs(page, events));
  await cljs(page, `(move-by [${c} ${b}] 5 0)`);
  check("(move-by …) is one event", Number(await cljs(page, events)) === e1 + 1, await cljs(page, events));
  check("... and brings them to the front in the order they had", JSON.stringify((await drawn(page, ids)).slice(-2)) === JSON.stringify([ids[1], ids[2]]));

  // ── to-front, to-back, stack ──
  await cljs(page, `(to-back ${c})`);
  check("(to-back …) sends a box under the others", (await drawn(page, ids))[0] === ids[2]);
  await cljs(page, `(to-front ${a})`);
  check("(to-front …) brings it over them", (await drawn(page, ids)).at(-1) === ids[0]);
  await cljs(page, `(stack ${d} ${c} ${b} ${a})`);
  check("(stack …) sets the order, from the bottom to the top", JSON.stringify(await drawn(page, ids)) === JSON.stringify([ids[3], ids[2], ids[1], ids[0]]));
  check("an unknown box is refused", /ERR/.test(await cljs(page, "(to-front :b99999)")));

  // ── back in the history, the order it had ──
  await cljs(page, "(rewind)");
  check("back in the history, the order it had before", (await drawn(page, ids))[0] === ids[2]);
  await cljs(page, "(tip)");
  check("... and at the newest point the newest", JSON.stringify(await drawn(page, ids)) === JSON.stringify([ids[3], ids[2], ids[1], ids[0]]));

  // ── dragging a box with the pointer brings it to the front ──
  // d alone, away from the others, at the bottom of the stack
  await cljs(page, `(move ${d} 7300 420) (to-back ${d})`);
  const centre = await page.evaluate((id) => {
    const el = document.querySelector(`#scene > g.box[data-box="${id}"] rect.body`);
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  }, ids[3]);
  if (centre) {
    const e2 = Number(await cljs(page, events));
    await page.mouse.move(centre[0], centre[1]);
    await page.mouse.down();
    await page.mouse.move(centre[0] + 20, centre[1] + 30, { steps: 4 });
    await page.mouse.up();
    const top = await until(page, `(last (mapv first (by-z (select-keys (:boxes (current)) [${a} ${b} ${c} ${d}]))))`, (g) => g === d);
    check("dragging a box brings it to the front", top === d, top);
    check("... in the same event as the move", Number(await cljs(page, events)) === e2 + 1, await cljs(page, events));
  } else check("the box to drag is on screen", false);

  // ── merges and releases carry the order ──
  check("a merge renames the box of a :z as it renames the others", (await cljs(page, "(remap-ev {:b1 :b9} [:z :b1 3])")) === "[:z :b9 3]");
  check("a release writes the order of a box that changed it",
    (await cljs(page, "(rel/patch-diff {:boxes {:b1 {:text \"x\" :x 0 :y 0}}} {:boxes {:b1 {:text \"x\" :x 0 :y 0 :z 4}}})")) === "[[:z :b1 4]]");
  check("an order from elsewhere is kept only if it is a number",
    (await cljs(page, "(mapv (fn [z] (:z (get-in (sane-patch {:boxes {:b1 {:text \"x\" :z z}}}) [:boxes :b1]))) [3 \"x\" nil])")) === "[3 nil nil]");

  // ── what a box draws over itself stays in it: a box on top covers it ──
  const n = (await cljs(page, '(box "number 7" 7100 300)')).trim();
  await until(page, "true", () => true, 120);
  check("a number's value is drawn inside its own box", await page.evaluate((id) =>
    !!document.querySelector(`#scene > g.box[data-box="${id}"] g.live text.value`), n.slice(1)));

  await cljs(page, `(delete ${a} ${b} ${c} ${d} ${n})`);
}
