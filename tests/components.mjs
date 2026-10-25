// SPDX-License-Identifier: MPL-2.0
// Issue #8: the boxes that define components have no inlets nor outlets, so they are not drawn in the
// patch: the Components tab lists them (whether each compiles), creates, opens, chooses and deletes them.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(80); }
  return got;
};
const settled = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const inScene = (page, id) => page.evaluate((id) => !!document.querySelector('#scene .box[data-box="' + id + '"]'), id);
const row = (page, id) => page.evaluate((id) => {
  const li = document.querySelector('#comp-list li.def[data-id="' + id + '"]');
  return li ? { text: li.textContent, path: li.getAttribute("data-path"), chosen: li.classList.contains("chosen") } : null;
}, id);
const press = (page, id, what) => page.evaluate(([id, what]) => {
  const b = document.querySelector('#comp-list li.def[data-id="' + id + '"] [data-def="' + what + '"]');
  if (b) b.click(); return !!b;
}, [id, what]);

const src = (cls) => `{:class \\"${cls}\\" :doc \\"Adds one.\\" :io [1 1] :receive (fn [{:keys [value]}] {:out [[0 (inc value)]]})}`;

export async function components(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the component tests", false); return; }
  await cljs(page, '(select-tab! "comp")');

  // a definition made from code: in the work, not in the patch
  const d = (await cljs(page, `(new-definition! "${src("plus-one")}")`)).trim();
  const did = d.slice(1);
  await settled(page);
  check("a component box is a box of the work", (await cljs(page, `(definition? (get-in (current) [:boxes ${d}]))`)) === "true");
  check("... and part of its code", (await cljs(page, `(str/includes? (patch->code (current)) "(box ${d} \\"component\\"")`)) === "true");
  check("... but it is not drawn in the patch", !(await inScene(page, did)));
  check("... nor among the boxes on screen (selection, frames, anchors)", (await cljs(page, `(contains? (scene-boxes) ${d})`)) === "false");
  await cljs(page, "(swap! ui assoc :sel nil)");
  await page.keyboard.press(process.platform === "darwin" ? "Meta+a" : "Control+a");
  check("... nor selected with ⌘/Ctrl+A", (await cljs(page, `(contains? (sel-ids) ${d})`)) === "false");
  await cljs(page, "(swap! ui assoc :sel nil)");

  const r = await until(page, `(:status (cbox/compiled "component" (source ${d})))`, (g) => g === ":ok");
  check("its definition compiles", r === ":ok", r);
  const li = await until(page, `(boolean (.querySelector js/document "#comp-list li.def[data-id='${did}']"))`, (g) => g === "true");
  check("the Components tab lists it", li === "true");
  const shown = await row(page, did);
  check("... with the class it defines and where it is", !!shown && /plus-one/.test(shown.text) && /box/.test(shown.text), shown && shown.text);
  const used = (await cljs(page, '(box "plus-one" 2200 1400)')).trim();
  check("its class can be used in a box, drawn in the patch", await page.waitForFunction((id) => !!document.querySelector('#scene .box[data-box="' + id + '"]'), used.slice(1), { timeout: 5000 }).then(() => true).catch(() => false));

  // a definition that does not compile says why, in the tab
  const bad = (await cljs(page, '(new-definition! "{:doc \\"no class\\"}")')).trim();
  const badRow = await until(page, `(some-> (.querySelector js/document "#comp-list li.def[data-id='${bad.slice(1)}']") .-className)`, (g) => /err/.test(g));
  check("a definition that does not compile is listed, marked, with its error", /err/.test(badRow), badRow);

  // Edit opens it in the code window; choosing a row makes it the one Claude changes
  check("Edit is a button of its row", await press(page, did, "edit"));
  const win = await until(page, "(some-> @code-win :id)", (g) => g === d);
  check("... that opens its code in the code window", win === d, win);
  check("... titled with the class it defines", await page.evaluate(() => /plus-one/.test((document.querySelector("#code-win .cw-title") || {}).textContent || "")));
  check("an edited definition is the one chosen", (await row(page, did) || {}).chosen === true);
  check("... and the selected component for Claude", (await cljs(page, "(first (selected-component))")) === d);
  await cljs(page, "(close-code-win!)");
  await cljs(page, "(choose-definition! nil nil)");
  check("with none chosen and the window closed, there is no selected component", (await cljs(page, "(selected-component)")) === "nil");
  await page.evaluate((id) => document.querySelector('#comp-list li.def[data-id="' + id + '"] span').click(), did);
  check("a click on the row chooses it", (await row(page, did) || {}).chosen === true && (await cljs(page, "(first (selected-component))")) === d);
  await page.evaluate((id) => document.querySelector('#comp-list li.def[data-id="' + id + '"] span').click(), did);
  check("... and a second click lets it go", (await cljs(page, "(selected-component)")) === "nil");

  // New component: a template, open in the code window
  const before = Number(await cljs(page, "(count (definitions))"));
  await page.evaluate(() => document.querySelector('#comp-list [data-def="new"]').click());
  const nid = await until(page, "(some-> @code-win :id)", (g) => /^:b\d+$/.test(g));
  check("New component makes a definition and opens it", Number(await cljs(page, "(count (definitions))")) === before + 1 && /^:b\d+$/.test(nid), nid);
  check("... from the template", (await cljs(page, `(str/includes? (source ${nid}) "echo-msg")`)) === "true");
  await cljs(page, "(close-code-win!)");

  // writing "component" in a new box of the patch makes a definition too, not a box on the paper
  const n0 = Number(await cljs(page, "(count (definitions))"));
  await cljs(page, "(open-editor! {:x 2200 :y 1500})");
  await page.fill("#box-edit", "component");
  await page.press("#box-edit", "Enter");
  const typed = await until(page, "(count (definitions))", (g) => Number(g) === n0 + 1);
  check("a box written «component» becomes a definition in the Components tab", Number(typed) === n0 + 1, typed);
  const tid = await until(page, "(some-> @code-win :id)", (g) => /^:b\d+$/.test(g));
  check("... opened in the code window", /^:b\d+$/.test(tid), tid);
  check("... and not drawn in the patch", !(await inScene(page, String(tid).slice(1))));
  await cljs(page, "(close-code-win!)");

  // a definition inside a sub-patch: listed with its place, opened from the top
  const sp = (await cljs(page, '(box "patch" 2400 1400)')).trim();
  await cljs(page, `(inside ${sp} (box :b1 "component" 0 0) (code :b1 "${src("plus-two")}"))`);
  const nested = await until(page, `(boolean (.querySelector js/document "#comp-list li.def[data-path='[${sp}]']"))`, (g) => g === "true");
  check("a definition inside a sub-patch is listed, with the sub-patch it is in", nested === "true");
  await cljs(page, `(edit-definition! [${sp}] :b1)`);
  check("... and opens in the code window from the top of the work", (await until(page, "(some-> @code-win :path)", (g) => g === `[${sp}]`)) === `[${sp}]`);
  await cljs(page, "(close-code-win!)");

  // × deletes, as one event
  const e0 = Number(await cljs(page, "(depth-of (norm (:pos @world)))"));
  check("× is a button of its row", await press(page, did, "delete"));
  const gone = await until(page, `(nil? (get-in (current) [:boxes ${d}]))`, (g) => g === "true");
  check("... that removes the definition from the work, as one event", gone === "true" && Number(await cljs(page, "(depth-of (norm (:pos @world)))")) === e0 + 1);
  check("... and from the tab", !(await row(page, did)));

  await cljs(page, `(delete ${used} ${bad} ${nid} ${tid} ${sp})`);
  await cljs(page, '(select-tab! "code")');
}
