// SPDX-License-Identifier: MPL-2.0
// Gestures on the patch, with a real pointer and keyboard, in the app already loaded by tests/browser.mjs:
// selecting several boxes (a frame, ⇧+click), moving them together, deleting them, ⌘/Ctrl+click.
// check(label, ok, detail) records one result.

// evaluates ClojureScript in the page (namespace user) and returns its value as a string (pr-str)
export const cljs = (page, src) => page.evaluate((s) => {
  try { return String(scittle.core.eval_string("(in-ns 'user) (pr-str (do " + s + "))")); }
  catch (e) { return "ERR " + (e.message || e); }
}, src);

// the centre of a box on screen, scrolled into view first
const boxCentre = (page, id) => page.evaluate((id) => {
  const el = document.querySelector('#scene .box[data-box="' + id + '"] rect.body');
  if (!el) return null;
  el.scrollIntoView({ block: "center", inline: "center" });
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
}, id);

// a point of the patch (its own coordinates) on screen
const onScreen = (page, x, y) => page.evaluate(([x, y]) => {
  const s = document.getElementById("canvas"), p = s.createSVGPoint();
  p.x = x; p.y = y;
  const q = p.matrixTransform(s.getScreenCTM());
  return [q.x, q.y];
}, [x, y]);

const drag = async (page, [x0, y0], [x1, y1], modifier) => {
  if (modifier) await page.keyboard.down(modifier);
  await page.mouse.move(x0, y0);
  await page.mouse.down();
  await page.mouse.move((x0 + x1) / 2, (y0 + y1) / 2, { steps: 4 });
  await page.mouse.move(x1, y1, { steps: 4 });
  await page.mouse.up();
  if (modifier) await page.keyboard.up(modifier);
};

const click = async (page, [x, y], modifier) => {
  if (modifier) await page.keyboard.down(modifier);
  await page.mouse.click(x, y);
  if (modifier) await page.keyboard.up(modifier);
};

export async function gestures(page, check) {
  // a local work, the session manager closed
  await cljs(page, "(open-work! :local \"local\" \"Local\")");
  await page.waitForFunction(() => document.getElementById("manager").hidden, null, { timeout: 10000 }).catch(() => {});
  const mode = await cljs(page, "(:mode @hist)");
  check("a local work opens", mode === ":local", mode);
  if (mode !== ":local") return;

  // two plain boxes far from the example, side by side
  const ids = await cljs(page, "[(box \"mtof\" 1400 60) (box \"mtof\" 1500 60)]");
  const [a, b] = (ids.match(/:b\d+/g) || []);
  check("two boxes are created", Boolean(a && b), ids);
  if (!(a && b)) return;
  const na = a.slice(1), nb = b.slice(1);
  await page.waitForTimeout(100);

  // a frame from an empty place touches both: both are selected
  await boxCentre(page, na);
  await drag(page, await onScreen(page, 1385, 45), await onScreen(page, 1520, 75));
  const sel = await cljs(page, `(= (sel-ids) #{${a} ${b}})`);
  check("a frame selects the boxes it touches", sel === "true", await cljs(page, "(:sel @ui)"));

  // dragging one of them moves both, by the same offset
  const ca = await boxCentre(page, na);
  if (ca) await drag(page, ca, [ca[0] + 40, ca[1] + 30]);
  const pos = await cljs(page, `(mapv (fn [id] ((juxt :x :y) (get-in (current) [:boxes id]))) [${a} ${b}])`);
  check("dragging a selected box moves the whole selection", pos === "[[1440 90] [1540 90]]", pos);
  check("the selection stays after the move", (await cljs(page, "(count (sel-ids))")) === "2");

  // ⇧+click takes one out, and puts it back
  await click(page, await boxCentre(page, nb), "Shift");
  const one = await cljs(page, "(:sel @ui)");
  check("⇧+click takes a box out of the selection", one === `[:box ${a}]`, one);
  await click(page, await boxCentre(page, nb), "Shift");
  check("⇧+click adds it again", (await cljs(page, "(count (sel-ids))")) === "2");

  // a plain click without moving, on one of the group, selects only that one; no inspector
  await click(page, await boxCentre(page, na));
  const single = await cljs(page, "(:sel @ui)");
  check("a click on one box of the group selects it alone", single === `[:box ${a}]`, single);
  check("a plain click opens no inspector", !(await page.evaluate(() => !!document.getElementById("inspector"))));

  // Ctrl+click opens the inspector; Esc closes it
  await click(page, await boxCentre(page, na), "Control");
  check("Ctrl+click opens the inspector", await page.evaluate(() => !!document.getElementById("inspector")));
  await page.keyboard.press("Escape");
  check("Esc closes the inspector", !(await page.evaluate(() => !!document.getElementById("inspector"))));

  // Delete removes the whole selection
  await click(page, await boxCentre(page, na));
  await click(page, await boxCentre(page, nb), "Shift");
  check("both selected again", (await cljs(page, "(count (sel-ids))")) === "2");
  await page.keyboard.press("Delete");
  const gone = await cljs(page, `(mapv (fn [id] (contains? (:boxes (current)) id)) [${a} ${b}])`);
  check("Delete removes every selected box", gone === "[false false]", gone);

  // the REPL commands behind the gestures
  const cmd = await cljs(page, "(let [x (box \"mtof\" 1400 200) y (box \"mtof\" 1500 200)] (move-by [x y] -10 5) (let [r (mapv (fn [id] ((juxt :x :y) (get-in (current) [:boxes id]))) [x y])] (delete x y) [r (some (fn [id] (contains? (:boxes (current)) id)) [x y])]))");
  check("move-by and a delete of several boxes", cmd === "[[[1390 205] [1490 205]] nil]", cmd);
}
