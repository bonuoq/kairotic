// SPDX-License-Identifier: MPL-2.0
// Discussion #117, phase 1: a work as a project of lines, independent histories shown as tabs above the patch.
// In the app already loaded by tests/browser.mjs with a local work open. It opens a solo work and a room of its
// own (in this browser's GUN, without a relay), deletes them, and opens a local work again. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, expected, ms = 10000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (got === expected) return got; await page.waitForTimeout(80); }
  return got;
};
const fails = async (page, src) => (await cljs(page, src)).startsWith("ERR ");

export async function lines(page, check) {
  await cljs(page, '(open-work! :local "local" "Local")');
  await until(page, "(:loaded @hist)", "true");
  // the example's packages come into the work a moment later (a box each): until it is still
  for (let last = "", same = 0, t0 = Date.now(); same < 8 && Date.now() - t0 < 20000; ) {
    const now = await cljs(page, "(count (:boxes (current)))");
    same = now === last ? same + 1 : 0; last = now; await page.waitForTimeout(150);
  }
  const mainBoxes = await cljs(page, "(count (:boxes (current)))");

  // a local work starts with its main line only, and shows the tabs
  check("a work starts with its main line", (await cljs(page, "(work-lines)")) === '{:on "main", :lines ["main"], :archived []}', await cljs(page, "(work-lines)"));
  check("... shown as a tab above the patch", await page.evaluate(() => !document.getElementById("line-tabs").hidden &&
    document.querySelectorAll("#line-tabs .ltab").length === 1));

  // a new line: empty, on screen, its segments marked with it
  await cljs(page, '(new-line "sketch")');
  check("(new-line name) puts a new, empty line on screen", (await cljs(page, "[(go-line) (count (:boxes (current))) (count (:nodes @hist))]")) === '["sketch" 0 0]');
  await cljs(page, '(box "msg 3" 40 40)');
  await cljs(page, '(box "number" 40 120)');
  await cljs(page, "(connect :b1 0 :b2 0)");
  const sketch = await cljs(page, "(active-line)");
  check("its segments carry the line", (await cljs(page, "(set (map :line (vals (:nodes @hist))))")) === `#{${sketch}}`);
  check("... and keep the main line's apart", (await cljs(page, `(contains? (:other @hist) "main")`)) === "true");

  // switching: each line its own patch and history, each tab back where it was
  await cljs(page, '(go-line "main")');
  check("the main line is as it was", (await cljs(page, "(count (:boxes (current)))")) === mainBoxes);
  check("... with none of the sketch's segments", (await cljs(page, `(some (fn [n] (= ${sketch} (:line n))) (vals (:nodes @hist)))`)) === "nil");
  await cljs(page, '(go-line "sketch")');
  check("back on the sketch: its patch", (await cljs(page, "[(count (:boxes (current))) (count (:lines (current)))]")) === "[2 1]");
  await cljs(page, "(swap! world assoc :pos [(first (norm (:pos @world))) 1] :auto false)");
  await cljs(page, '(go-line "main")');
  await cljs(page, '(go-line "sketch")');
  check("a tab comes back at the point it was left", (await cljs(page, "(count (:boxes (current)))")) === "1");
  await cljs(page, "(swap! world assoc :pos (newest-tip) :auto true)");

  // names
  check("two lines cannot have the same name", await fails(page, '(new-line "sketch")'));
  check("the main line cannot be archived", await fails(page, '(archive-line "main")'));
  check("there is no line called so", await fails(page, '(go-line "nowhere")'));
  check("(rename-line new) renames the line on screen", (await cljs(page, '(rename-line "étude")')) === '"étude"' &&
    (await cljs(page, "(go-line)")) === '"étude"');
  check("(archive-line) hides it and goes to the main line", (await cljs(page, "(do (archive-line) (work-lines))")) === '{:on "main", :lines ["main"], :archived ["étude"]}', await cljs(page, "(work-lines)"));
  check("(restore-line name) brings it back, on screen", (await cljs(page, '(do (restore-line "étude") [(go-line) (count (:boxes (current)))])')) === '["étude" 2]');

  // classes: each line brings the official packages its boxes use, even if another line is on screen when
  // the package arrives
  await cljs(page, '(new-line "pkgs")');
  await cljs(page, '(box "knob 0 1 0.5" 40 40)');
  await cljs(page, '(go-line "main")');
  await page.waitForTimeout(1500);
  check("a package asked for by another line does not land on the one on screen", (await cljs(page, "(count (:boxes (current)))")) === mainBoxes);
  await cljs(page, '(go-line "pkgs")');
  check("... it comes into its line when that one is back", (await until(page, '(boolean (work-package? "@kairotic/controls"))', "true", 15000)) === "true");
  check("... and its box works", (await until(page, '(some? (comp/lookup "knob"))', "true")) === "true");
  await cljs(page, '(archive-line "pkgs")');

  // the tabs write the commands
  await page.click('#line-tabs .ltab[data-line="main"]');
  check("clicking a tab puts its line on screen", (await until(page, "(go-line)", '"main"')) === '"main"');
  await page.click("#line-add");
  await page.fill("#line-name-in", "bass");
  await page.press("#line-name-in", "Enter");
  check("+ makes a new line", (await until(page, "(go-line)", '"bass"')) === '"bass"');
  await page.dblclick('#line-tabs .ltab[aria-selected="true"]');
  await page.fill("#line-name-in", "bass line");
  await page.press("#line-name-in", "Enter");
  check("double-clicking the tab on screen renames it", (await until(page, "(go-line)", '"bass line"')) === '"bass line"');
  check("... and the REPL shows what the tabs did", await page.evaluate(() => /\(rename-line "bass" "bass line"\)/.test(document.getElementById("repl-out").textContent)));

  // not while performing
  await cljs(page, '(go-line "étude")');
  await cljs(page, "(perform)");
  check("lines do not change in Perform", await fails(page, '(go-line "main")'));
  check("... and the other tabs wait", await page.evaluate(() => [...document.querySelectorAll("#line-tabs .ltab:not([aria-selected=true])")].every((b) => b.disabled)));
  await cljs(page, "(compose :discard)");

  // segments that arrive: each one to its line
  check("segments that arrive go to their lines", (await cljs(page, `(do (go-line "main")
    (on-history #js {:docs #js [#js {:id "t-main" :exists true :data (fn [] #js {:parent nil :at 0 :author "x" :t 1 :events #js []})}
                                #js {:id "t-other" :exists true :data (fn [] #js {:parent nil :at 0 :author "x" :t 1 :line "t-line" :events #js []})}]})
    [(contains? (:nodes @hist) "t-main") (contains? (get-in @hist [:other "t-line"]) "t-other") (contains? (:nodes @hist) "t-other")])`)) === "[true true false]");
  await cljs(page, '(swap! hist (fn [h] (-> h (update :nodes dissoc "t-main") (update :other dissoc "t-line"))))');

  // a solo work keeps its lines: their names and their segments, read again when it opens
  if (await cljs(page, "(some? (uid))") === "true") {
    await cljs(page, '(create-work! :solo "lines test" false)');
    await until(page, '(= "lines test" (:name @work))', "true");
    const id = await cljs(page, "(:id @work)");
    await until(page, "(:loaded @hist)", "true");
    await cljs(page, '(box "msg main" 40 40)');
    await cljs(page, '(new-line "part")');
    await cljs(page, '(box "msg part" 40 40)');
    await cljs(page, '(box "number" 40 120)');
    await page.waitForTimeout(2500);   // GUN writes
    await cljs(page, `(open-work! :solo ${id} "lines test")`);
    check("a solo work opened again has its lines", (await until(page, "(:lines (work-lines))", '["main" "part"]')) === '["main" "part"]', await cljs(page, "(work-lines)"));
    check("... the main line on screen, as it was", (await until(page, "(mapv :text (vals (:boxes (current))))", '["msg main"]')) === '["msg main"]');
    await cljs(page, '(go-line "part")');
    check("... and each line's own history", (await cljs(page, "(mapv :text (vals (:boxes (current))))")) === '["msg part" "number"]');

    // copied to a room, with its lines
    await cljs(page, `(copy-work! :solo ${id} :room "lines room")`);
    await until(page, '(= :room (:kind @work))', "true", 15000);
    const rid = await cljs(page, "(:id @work)");
    check("a work copied to a room keeps its lines", (await until(page, "(:lines (work-lines))", '["main" "part"]', 15000)) === '["main" "part"]', await cljs(page, "(work-lines)"));
    await cljs(page, '(go-line "part")');
    check("... and their histories", (await until(page, "(mapv :text (vals (:boxes (current))))", '["msg part" "number"]')) === '["msg part" "number"]');
    await cljs(page, `(delete-work! :room ${rid})`);
    await cljs(page, `(delete-work! :solo ${id})`);
    await page.waitForTimeout(1500);
  } else {
    check("a user for the solo work", false, "(uid) is nil");
  }

  await cljs(page, '(open-work! :local "local" "Local")');
  await until(page, "(:loaded @hist)", "true");
  check("another work opens on its main line, without the lines of the last one", (await cljs(page, "(work-lines)")) === '{:on "main", :lines ["main"], :archived []}');
}
