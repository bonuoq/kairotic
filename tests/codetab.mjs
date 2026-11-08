// SPDX-License-Identifier: MPL-2.0
// Issue #165: in the Code tab, long lines are folded (saying how much they hide), the lines of the boxes selected
// in the patch are marked, and the cursor on a line of a box selects it.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 6000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(60); }
  return got;
};

// the number of the first line of the Code tab that starts with `start`
const lineOf = (page, start) => cljs(page, `(some (fn [[i l]] (when (str/starts-with? l ${JSON.stringify(start)}) (inc i))) (map-indexed vector (str/split-lines (.getValue @code-ed))))`);

export async function codetab(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the Code tab tests", false); return; }
  await cljs(page, '(side-panel true) (select-tab! "code") (show-code-view! :calls) (swap! ui assoc :dirty false)');
  const ready = await until(page, "(boolean (and @code-ed (.-foldLong @code-ed)))", (g) => g === "true", 20000);
  check("the Code tab's editor can fold long lines and mark lines", ready === "true", ready);
  if (ready !== "true") return;

  // a script box with a long source, and two boxes connected
  const s = (await cljs(page, '(box "script" 9800 300)')).trim();
  const long = "(fn [m] {:out [[0 (str " + Array.from({ length: 300 }, (_, i) => `"w${i}"`).join(" ") + ")]]})";
  await cljs(page, `(code ${s} ${JSON.stringify(long)})`);
  const a = (await cljs(page, '(box "mtof" 9800 400)')).trim();
  const b = (await cljs(page, '(box "mtof" 9900 400)')).trim();
  await cljs(page, `(connect ${a} 0 ${b} 0) (swap! ui assoc :sel nil)`);

  // ── long lines folded ──
  // the editor draws only the lines in view: the tab is scrolled to the line of this box first (the work these
  // tests share has long lines of other suites too)
  const ownFold = (id) => page.evaluate((id) => {
    const f = [...document.querySelectorAll("#panel-code .cm-fold-long")].find((e) => (e.closest(".cm-line")?.textContent || "").startsWith(`(code ${id} `));
    return f ? f.textContent : null;
  }, id);
  const showOwn = async () => cljs(page, `(.showLine @code-ed ${await lineOf(page, `(code ${s} `)})`);
  await until(page, `(boolean (some (fn [l] (str/starts-with? l "(code ${s} ")) (str/split-lines (.getValue @code-ed))))`, (g) => g === "true");
  await showOwn();
  let label = null;
  for (let i = 0; i < 40 && !label; i++) { label = await ownFold(s); if (!label) { await page.waitForTimeout(80); await showOwn(); } }
  check("a long source is folded in the Code tab", !!label, String(label));
  check("... saying how many characters it hides", /⋯ [\d ]+ characters/.test(label || ""), String(label));
  check("... and its beginning is still there", (await cljs(page, `(str/includes? (.-textContent (.-contentDOM (.-view @code-ed))) "(code ${s} \\"(fn [m]")`)) === "true");

  // ── the selected box, marked ──
  await cljs(page, `(swap! ui assoc :sel [:box ${a}])`);
  const marked = await page.evaluate(() => [...document.querySelectorAll("#panel-code .cm-mark-line")].map((e) => e.textContent));
  check("selecting a box marks its lines in the code", marked.length >= 2 && marked.every((t) => new RegExp(`${a.slice(1)}(?![0-9])`).test(t)), JSON.stringify(marked));
  check("... its box and its line", marked.some((t) => t.startsWith(`(box ${a} `)) && marked.some((t) => t.startsWith(`(connect ${a} 0 ${b} 0)`)));
  await cljs(page, "(swap! ui assoc :sel nil)");
  check("nothing selected, nothing marked", (await page.evaluate(() => document.querySelectorAll("#panel-code .cm-mark-line").length)) === 0);

  // ── the cursor on a line selects its box ──
  const n = await lineOf(page, `(box ${b} `);
  await cljs(page, `(let [v (.-view @code-ed) l (.line (.. v -state -doc) ${n})] (.dispatch v #js {:selection #js {:anchor (.-from l)} :userEvent "select.pointer"}))`);
  check("the cursor on a line of a box selects it in the patch", (await until(page, "(:sel @ui)", (g) => g === `[:box ${b}]`)) === `[:box ${b}]`);
  const c = await lineOf(page, `(connect ${a} 0 ${b} 0)`);
  await cljs(page, `(let [v (.-view @code-ed) l (.line (.. v -state -doc) ${c})] (.dispatch v #js {:selection #js {:anchor (.-from l)} :userEvent "select.pointer"}))`);
  check("... on a connect, the two boxes", (await until(page, "(sel-ids)", (g) => g === `#{${a} ${b}}` || g === `#{${b} ${a}}`)).replace(/[#{}]/g, "").split(" ").sort().join(" ") === [a, b].sort().join(" "));

  // ── a line unfolded stays so ──
  // (the work these tests share has long lines of other suites: the one of this box)
  await showOwn();
  await page.waitForTimeout(80);
  const clicked = await page.evaluate((id) => {
    const f = [...document.querySelectorAll("#panel-code .cm-fold-long")].find((e) => (e.closest(".cm-line")?.textContent || "").startsWith(`(code ${id} `));
    if (f) f.click();
    return !!f;
  }, s);
  check("the folded part of this box's line is there to click", clicked);
  const shown = await until(page, `(str/includes? (.-textContent (.-contentDOM (.-view @code-ed))) "w299")`, (g) => g === "true");
  check("a click shows the folded part", shown === "true");
  await cljs(page, `(move ${a} 9800 420)`);
  await until(page, `(str/includes? (.getValue @code-ed) "9800 420")`, (g) => g === "true");
  await showOwn();
  await page.waitForTimeout(80);
  check("... and it stays shown when the code is written again", (await ownFold(s)) === null
        && (await cljs(page, `(str/includes? (.-textContent (.-contentDOM (.-view @code-ed))) "w299")`)) === "true");

  await cljs(page, `(swap! ui assoc :sel nil) (reset! code-unfolded #{}) (delete ${s} ${a} ${b})`);
}
