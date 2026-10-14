// SPDX-License-Identifier: MPL-2.0
// Issue #8: code boxes are compact in the patch, and their code opens in a movable editor window
// (CodeMirror 6), in the app already loaded by tests/browser.mjs with a local work open.
// check(label, ok, detail) records one result.
import { cljs } from "./gestures.mjs";

const rowCentre = async (page, id) => {
  await page.waitForFunction((id) => document.querySelector('#scene .code-area[data-box="' + id + '"]'), id, { timeout: 10000 });
  return page.evaluate((id) => {
    const el = document.querySelector('#scene .code-area[data-box="' + id + '"]');
    el.scrollIntoView({ block: "center", inline: "center" });
    const r = el.getBoundingClientRect();
    return [r.x + r.width / 2, r.y + r.height / 2];
  }, id);
};

export async function editor(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the editor tests", false); return; }
  const s = (await cljs(page, '(box "script" 1400 760)')).trim();
  const sid = s.slice(1);
  await cljs(page, `(code ${s} "(fn [{:keys [value]}]\\n  {:out [[0 value]]})")`);

  // compact in the patch: one code row, not the whole code
  const h = await cljs(page, `(second (box-dims ${s} (get-in (current) [:boxes ${s}])))`);
  check("a code box is compact in the patch", Number(h) < 90, h);
  const rowText = await page.evaluate((id) => document.querySelector('#scene .box[data-box="' + id + '"] text.code')?.textContent, sid);
  check("its row shows the first line of its code", rowText === "(fn [{:keys [value]}]", rowText);

  // a double-click on the row opens the editor window, with CodeMirror
  const [x, y] = await rowCentre(page, sid);
  await page.mouse.click(x, y);
  await page.mouse.click(x, y);
  const open = await page.waitForSelector("#code-win", { timeout: 5000 }).then(() => true).catch(() => false);
  check("a double-click on the code row opens the editor window", open);
  if (!open) return;
  const cm = await page.waitForSelector("#code-win .cm-editor", { timeout: 15000 }).then(() => true).catch(() => false);
  check("the editor is CodeMirror (the bundle loads)", cm);
  if (cm) {
    check("it has line numbers", await page.evaluate(() => document.querySelectorAll("#code-win .cm-lineNumbers .cm-gutterElement").length >= 2));
    // typing: a bracket closes itself, keys stay in the editor (space does not start the engine)
    await page.click("#code-win .cm-content");
    await page.keyboard.press("Control+End");
    await page.keyboard.press("Enter");
    await page.keyboard.type("(");
    await page.keyboard.type("inc");
    const text = await cljs(page, "(cw-text)");
    check("an open bracket closes itself", /\(inc\)"$/.test(text), text);
    check("keys typed in the editor do not reach the patch", (await cljs(page, "(eng/running?)")) === "false");
    check("the window knows its code is edited", (await cljs(page, "(:dirty @code-win)")) === "true");
    // Ctrl+Enter applies: one event, and the window stays open
    await page.keyboard.press("Control+Enter");
    const applied = await cljs(page, `(str/includes? (source ${s}) "(inc)")`);
    check("Ctrl+Enter applies the code to the box", applied === "true", await cljs(page, `(source ${s})`));
    check("... and the window stays open", await page.evaluate(() => !!document.getElementById("code-win")));
    check("... with nothing left to apply", (await cljs(page, "(:dirty @code-win)")) === "false");
    // an edit not applied asks before closing
    await page.keyboard.type("1");
    await page.keyboard.press("Escape");
    await page.keyboard.press("Escape");
    check("Esc asks before losing an edit", await page.evaluate(() => !document.querySelector("#code-win .cw-confirm").hidden));
    await page.click('#code-win [data-cw="discard"]');
    check("Discard closes the window", !(await page.evaluate(() => !!document.getElementById("code-win"))));
    check("... without applying the edit", (await cljs(page, `(str/includes? (source ${s}) "inc1")`)) === "false");
  }
  // the window moves with its bar
  await page.mouse.click(...(await rowCentre(page, sid)));
  await page.mouse.click(...(await rowCentre(page, sid)));
  await page.waitForSelector("#code-win", { timeout: 5000 });
  const before = await page.evaluate(() => { const r = document.getElementById("code-win").getBoundingClientRect(); return [r.x, r.y]; });
  const bar = await page.evaluate(() => { const r = document.querySelector("#code-win .cw-title").getBoundingClientRect(); return [r.x + 20, r.y + r.height / 2]; });
  await page.mouse.move(bar[0], bar[1]);
  await page.mouse.down();
  await page.mouse.move(bar[0] - 60, bar[1] + 40, { steps: 5 });
  await page.mouse.up();
  const after = await page.evaluate(() => { const r = document.getElementById("code-win").getBoundingClientRect(); return [r.x, r.y]; });
  check("the window moves with its bar", Math.round(after[0] - before[0]) === -60 && Math.round(after[1] - before[1]) === 40, JSON.stringify([before, after]));
  await cljs(page, "(close-code-win!)");
  await cljs(page, `(delete ${s})`);

  // the same editor in the REPL line: Enter evaluates when the brackets are closed, ↑ brings it back
  const repl = await page.waitForSelector(".repl-host .cm-editor", { timeout: 15000 }).then(() => true).catch(() => false);
  check("the REPL line is the code editor", repl);
  if (repl) {
    await page.click(".repl-host .cm-content");
    await page.keyboard.type("(+ 40 2");
    check("in the REPL, a bracket closes itself", (await cljs(page, "(repl-text)")) === '"(+ 40 2)"', await cljs(page, "(repl-text)"));
    check("spaces typed in the REPL do not reach the patch", (await cljs(page, "(eng/running?)")) === "false");
    await page.keyboard.press("Enter");
    const out = await page.evaluate(() => { const o = document.querySelectorAll("#repl-out .out"); return o.length ? o[o.length - 1].textContent : ""; });
    check("Enter evaluates it", out === "42", out);
    check("... and empties the line", (await cljs(page, "(repl-text)")) === '""');
    await page.keyboard.press("ArrowUp");
    check("↑ brings back what was written", (await cljs(page, "(repl-text)")) === '"(+ 40 2)"', await cljs(page, "(repl-text)"));
    await cljs(page, '(set-repl-text! "(let [a 1]")');
    await page.keyboard.press("Enter");
    check("with a bracket open, Enter starts a new line", (await cljs(page, "(.lineCount @repl-ed)")) === "2", await cljs(page, "(repl-text)"));
    await cljs(page, '(set-repl-text! "")');
  }

  // and in the Code tab: an edit marks it, Discard brings the patch's code back
  const tab = await page.waitForSelector("#panel-code .code-host .cm-editor", { timeout: 15000 }).then(() => true).catch(() => false);
  check("the Code tab is the code editor", tab);
  if (tab) {
    const before = await cljs(page, "(code-text)");
    check("it shows the code of the patch", before === (await cljs(page, "(patch->code (current))")));
    await page.click("#panel-code .cm-content");
    await page.keyboard.press("Control+End");
    await page.keyboard.type("\n;; a note");
    check("an edit in the Code tab marks it as edited", (await page.textContent("#code-state")).startsWith("edited"));
    await page.click("#code-revert");
    check("Discard brings back the code of the patch", (await cljs(page, "(code-text)")) === before);
  }
}
