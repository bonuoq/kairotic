// SPDX-License-Identifier: MPL-2.0
// Issue #163: box ids seen on the patch, a line of the REPL opened with ( on the patch, and a click on a box
// that writes its id where a line of code waits for one.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 5000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(60); }
  return got;
};

// the middle of a box's body on screen (scrolled into view first)
const middle = (page, id) => page.evaluate((id) => {
  const el = document.querySelector(`#scene > g.box[data-box="${id}"] rect.body`);
  if (!el) return null;
  el.scrollIntoView({ block: "center", inline: "center" });
  const r = el.getBoundingClientRect();
  return [r.x + r.width / 2, r.y + r.height / 2];
}, id);

const tagShown = (page, id) => page.evaluate((id) => {
  const t = document.querySelector(`#scene > g.box[data-box="${id}"] .idtag`);
  return t ? getComputedStyle(t).display !== "none" : null;
}, id);

export async function ids(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the id tests", false); return; }

  // two boxes with an inlet and an outlet, to be connected by clicking them
  const a = (await cljs(page, '(box "mtof" 8000 600)')).trim();
  const b = (await cljs(page, '(box "mtof" 8200 600)')).trim();
  const [ia, ib] = [a.slice(1), b.slice(1)];
  // nothing selected, no note nor stroke of another suite (I is left to them then)
  await cljs(page, "(swap! ui assoc :sel nil :tsel nil :nsel nil) (show-ids! false) (render-scene (current))");

  // ── the id of each box ──
  check("each box carries its id", (await page.evaluate((id) =>
    document.querySelector(`#scene > g.box[data-box="${id}"] .idtag`)?.textContent, ia)) === ia);
  check("... hidden while the box is not hovered nor selected", (await tagShown(page, ia)) === false);
  await cljs(page, `(swap! ui assoc :sel [:box ${a}]) (render-scene (current))`);
  check("... shown when it is selected", (await tagShown(page, ia)) === true);
  await cljs(page, "(swap! ui assoc :sel nil) (render-scene (current))");
  await cljs(page, "(show-ids! true)");
  check("(show-ids! true) shows every id", (await tagShown(page, ia)) === true && (await tagShown(page, ib)) === true);
  await cljs(page, "(show-ids! false)");
  check("... and false hides them again", (await tagShown(page, ia)) === false);

  // I switches them, with nothing being typed
  const pa = await middle(page, ia);
  if (!pa) { check("the boxes are on screen", false); return; }
  await page.mouse.move(pa[0], pa[1] - 160);   // over the paper, away from the boxes
  await page.evaluate(() => document.activeElement && document.activeElement.blur());
  await page.keyboard.press("i");
  check("I shows every id", (await tagShown(page, ib)) === true);
  await page.keyboard.press("i");
  check("... and I again hides them", (await tagShown(page, ib)) === false);

  // ── ( on the patch: a line of the REPL ──
  await page.keyboard.type("(");
  const opened = await page.evaluate(() => {
    const f = document.getElementById("box-edit");
    return f && { repl: f.classList.contains("as-repl"), value: f.value, focused: document.activeElement === f };
  });
  check("( on the patch opens a line of the REPL there", opened && opened.repl && opened.value === "(" && opened.focused, JSON.stringify(opened));
  await page.keyboard.type("+ 1 2)");
  await page.keyboard.press("Enter");
  const out = await page.evaluate(() => document.getElementById("box-edit-out")?.textContent);
  check("Enter runs it and shows what it gave under the field", out === "3", out);
  check("... the field stays open and empty for the next one", (await page.evaluate(() => document.getElementById("box-edit")?.value)) === "");
  check("... and the line is in the REPL's history", (await cljs(page, "(last (:hist @ui))")) === '"(+ 1 2)"');
  await page.keyboard.press("ArrowUp");
  check("↑ brings it back", (await page.evaluate(() => document.getElementById("box-edit")?.value)) === "(+ 1 2)");
  await page.keyboard.press("Escape");
  check("Esc closes it", (await page.evaluate(() => !document.getElementById("box-edit"))) === true);

  // a new box whose text starts with ( is a line of the REPL too
  await cljs(page, "(open-editor! {:x 8000 :y 400})");
  await page.waitForSelector("#box-edit", { timeout: 2000 }).catch(() => {});
  check("a new box's field is not a REPL line until it starts with (",
    (await page.evaluate(() => document.getElementById("box-edit")?.classList.contains("as-repl"))) === false);
  await page.fill("#box-edit", "(str 1 2)");
  check("... and is one once it does", (await page.evaluate(() => document.getElementById("box-edit")?.classList.contains("as-repl"))) === true);
  const before = await cljs(page, "(count (:boxes (current)))");
  await page.press("#box-edit", "Enter");
  check("... Enter runs it instead of making a box", (await page.evaluate(() => document.getElementById("box-edit-out")?.textContent)) === '"12"'
        && (await cljs(page, "(count (:boxes (current)))")) === before);

  // ── a click on a box writes its id where the line waits for one ──
  await page.fill("#box-edit", "(connect ");
  await page.evaluate(() => { const f = document.getElementById("box-edit"); f.setSelectionRange(f.value.length, f.value.length); });
  await page.evaluate(() => document.dispatchEvent(new Event("selectionchange")));
  check("while the line waits for a box, the patch says so", (await page.evaluate(() => document.getElementById("canvas").classList.contains("picking"))) === true);
  let p = await middle(page, ia);
  await page.mouse.click(p[0], p[1]);
  p = await middle(page, ib);
  await page.keyboard.type("0 ");
  await page.mouse.click(p[0], p[1]);
  const written = await page.evaluate(() => document.getElementById("box-edit")?.value);
  check("clicking two boxes writes their ids in the line", written === `(connect :${ia} 0 :${ib} `, written);
  check("... the line keeps the focus", (await page.evaluate(() => document.activeElement?.id)) === "box-edit");
  check("... and the boxes were not selected nor moved", (await cljs(page, "(:sel @ui)")) === "nil"
        && (await cljs(page, `((juxt :x :y) (get-in (current) [:boxes ${a}]))`)) === "[8000 600]");
  await page.keyboard.type("0)");
  await page.keyboard.press("Enter");
  check("... and running it connects them", (await until(page, `(boolean (some #{[${a} 0 ${b} 0]} (:lines (current))))`, (g) => g === "true")) === "true");

  // not waiting for a box: a click is a click
  await page.fill("#box-edit", "(+ 1");
  await page.evaluate(() => document.dispatchEvent(new Event("selectionchange")));
  check("after a word, the line does not wait for a box", (await page.evaluate(() => document.getElementById("canvas").classList.contains("picking"))) === false);
  await page.keyboard.press("Escape");

  // the REPL at the bottom too (its editor closes the bracket typed), and a : already typed is not written twice
  await cljs(page, '(set-repl-text! "") (focus-repl!)');
  await page.keyboard.type("(send! :");
  p = await middle(page, ib);
  await page.mouse.click(p[0], p[1]);
  // (the REPL's Clojure editor lays out the spaces before the bracket as it likes)
  const repl = await cljs(page, "(str/replace (repl-text) #\"[\\s)]+$\" \"\")");
  check("in the REPL, after a :, a click writes the rest of the id", repl === `"(send! :${ib}"`, repl);
  check("... and the REPL keeps the focus", (await cljs(page, "(some? (cm-of @repl-ed))")) === "true");
  await cljs(page, '(set-repl-text! "")');

  await cljs(page, `(delete ${a} ${b})`);
}
