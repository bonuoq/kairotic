// SPDX-License-Identifier: MPL-2.0
// Issue #166, 3: which box is drawn over which. Boxes are stacked in the order of the number of their ids
// (not as text, which put :b10 under :b2); a box dragged comes to the front so that what is moved is never
// hidden. That order belongs to this tab, as the selection does: not to the work, its history or its code.
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

// drags box id by (dx, dy) with the pointer, from the middle of its body
async function drag(page, id, dx, dy) {
  const at = await page.evaluate((id) => {
    const el = document.querySelector(`#scene > g.box[data-box="${id}"] rect.body`);
    if (!el) return null;
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  }, id);
  if (!at) return false;
  await page.mouse.move(at[0], at[1]);
  await page.mouse.down();
  await page.mouse.move(at[0] + dx, at[1] + dy, { steps: 4 });
  await page.mouse.up();
  return true;
}

export async function zorder(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the z-order tests", false); return; }
  const events = "(depth-of (norm (:pos @world)))";

  // ── the default order: the number of the id, not its text ──
  check("boxes stack by the number of their id (:b10 over :b9 and :b2)",
    (await cljs(page, "(mapv first (by-z {:b10 {} :b2 {} :b9 {}}))")) === "[:b2 :b9 :b10]");

  // three boxes, each one away from the others (a pointer drag needs its middle free)
  const a = (await cljs(page, '(box "print a" 7000 300)')).trim();
  const b = (await cljs(page, '(box "print b" 7200 300)')).trim();
  const c = (await cljs(page, '(box "print c" 7400 300)')).trim();
  const ids = [a, b, c].map((x) => x.slice(1));
  check("new boxes are drawn in the order they were made", JSON.stringify(await drawn(page, ids)) === JSON.stringify(ids));

  // ── dragging a box brings it to the front, here only ──
  const code0 = await cljs(page, "(patch->code (current))");
  const e0 = Number(await cljs(page, events));
  check("the box to drag is on screen", await drag(page, ids[0], 25, 30));
  const top = await until(page, `(last (mapv first (by-z (select-keys (:boxes (current)) [${a} ${b} ${c}]))))`, (g) => g === a);
  check("dragging a box brings it to the front", top === a, top);
  check("... and it is drawn last, over the others", (await drawn(page, ids)).at(-1) === ids[0]);
  check("... the move is one event of the history, as before", Number(await cljs(page, events)) === e0 + 1, await cljs(page, events));
  check("... and nothing about the order is kept in the box", (await cljs(page, `(contains? (get-in (current) [:boxes ${a}]) :z)`)) === "false");
  const code1 = await cljs(page, "(patch->code (current))");
  check("... nor in the work's code (only the new place changes)",
    code1.replace(/\(box :b\d+ \\"print a\\" \d+ \d+\)/, "") === code0.replace(/\(box :b\d+ \\"print a\\" \d+ \d+\)/, ""));

  // a move from the REPL is a change of the work, not a drag: the order stays as it is
  await cljs(page, `(move ${b} 7200 320)`);
  check("(move …) from code does not change the order", (await drawn(page, ids)).at(-1) === ids[0]);

  // the last one dragged goes on top
  await drag(page, ids[2], 0, 20);
  check("the last box dragged is on top", (await drawn(page, ids)).at(-1) === ids[2]);
  const e1 = Number(await cljs(page, events));
  await cljs(page, `(move-by [${a} ${b}] 5 0)`);
  check("(move-by …) moves several boxes in one event", Number(await cljs(page, events)) === e1 + 1, await cljs(page, events));

  // back in the history the places change, and the order of this tab stays
  await cljs(page, "(rewind)");
  check("going back in the history does not change the order here", (await drawn(page, ids)).at(-1) === ids[2]);
  await cljs(page, "(tip)");

  // ── what a box draws over itself stays in it: a box on top covers it ──
  const n = (await cljs(page, '(box "number 7" 7600 300)')).trim();
  check("a number's value is drawn inside its own box", (await until(page,
    `(boolean (.querySelector ($ "scene") "g.box[data-box=\\"${n.slice(1)}\\"] g.live text.value"))`, (g) => g === "true")) === "true");

  await cljs(page, `(delete ${a} ${b} ${c} ${n})`);
}
