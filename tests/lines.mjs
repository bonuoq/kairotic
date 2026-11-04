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

  // decision 6: the engine plays the line where ▶ was pressed, and changing tabs does not stop it
  await cljs(page, '(go-line "étude")');
  await cljs(page, '(box "osc~ 440" 200 40)');
  const osc = await cljs(page, "(last (sort-by box-num (keys (:boxes (current)))))");
  await cljs(page, '(go-line "main")');
  await cljs(page, "(play)");
  check("▶ makes the line on screen the one that plays", (await cljs(page, "(playing-line)")) === '"main"');
  check("... marked ▶ on its tab", await page.evaluate(() => !!document.querySelector('#line-tabs .ltab[data-line="main"] .plays')));
  await cljs(page, '(go-line "étude")');
  check("changing tabs does not stop the engine", (await cljs(page, "[(eng/running?) (playing-line)]")) === '[true "main"]');
  check("... the transport says which line plays", (await page.textContent("#transport-info")) === "playing main");
  const pre = await cljs(page, "(name (first (view-prefix)))");
  check("the boxes on screen are known to the engine under their line's prefix", (await cljs(page, "(fid :b2)")) === `:${pre.slice(1, -1)}.b2`);
  check("... beside the line that plays, whose boxes keep their ids",
    (await cljs(page, `(let [f (eng/flat (engine-patch))] [(contains? (:boxes f) (fid :b2)) (every? (fn [id] (contains? (:boxes f) id)) (keys (:boxes (off-screen-patch "main"))))])`)) === "[true true]");
  check("... without its audio boxes: only the line that plays sounds", (await cljs(page, `(contains? (:boxes (eng/flat (engine-patch))) (fid ${osc}))`)) === "false");
  await cljs(page, "(send! :b1 :bang)");
  check("messages on the tab on screen still travel (without ▶ of their own)", (await until(page, "(second (last-shown :b2))", "3")) === "3", await cljs(page, "(last-shown :b2)"));
  check("... and the engine still plays the other line", (await cljs(page, "(playing-line)")) === '"main"');
  await cljs(page, "(play)");
  const now = await cljs(page, "[(line-name (playing-line)) (playing-elsewhere?) (fid :b2)]");
  check("▶ on another tab plays that line", now === '["étude" false :b2]', now);
  await cljs(page, "(stop)");
  check("■ stops it", (await cljs(page, "[(eng/running?) (playing-line)]")) === "[false nil]");
  await cljs(page, `(delete ${osc})`);

  // phase 2: a line used as a sub-patch, patch @name
  const settle = () => page.waitForTimeout(120);
  const send = async (id, out) => { await cljs(page, `(send! ${id} :bang)`); await page.waitForTimeout(250); return cljs(page, `(second (last-shown ${out}))`); };
  await cljs(page, '(new-line "ref gain")');
  for (const c of ['(box :b1 "inlet" 40 30)', '(box :b2 "* 2" 40 90)', '(box :b3 "outlet" 40 150)', "(connect :b1 0 :b2 0)", "(connect :b2 0 :b3 0)"]) await cljs(page, c);
  const gid = await cljs(page, "(active-line)");
  await cljs(page, '(new-line "ref piece")');
  for (const c of ['(box :b1 "msg 5" 40 30)', '(box :b2 "patch @ref-gain" 40 90)', '(box :b3 "number" 40 150)', "(connect :b1 0 :b2 0)", "(connect :b2 0 :b3 0)"]) await cljs(page, c);
  check("patch @name uses a line (spaces as -), its inlet and outlet boxes as ports", (await cljs(page, "(io (get-in (current) [:boxes :b2]))")) === "[1 1]");
  check("... following it", (await cljs(page, "(ref-badge (get-in (current) [:boxes :b2]))")) === '"↻"');
  await settle();
  check("... and messages go through it", (await send(":b1", ":b3")) === "10");
  check("a line cannot contain itself", await fails(page, '(do (go-line "ref gain") (box "patch @ref-gain" 200 30))'));
  check("... nor a line that uses it (a cycle)", await fails(page, '(box "patch @ref-piece" 200 30)'));
  check("... nor a line that does not exist", await fails(page, '(box "patch @nowhere" 200 30)'));
  check("a plain word after patch is still an embedded patch", (await cljs(page, '(let [b {:text "patch label"}] [(line-ref? b) (embedded? b)])')) === "[false true]");
  await cljs(page, '(text! :b2 "* 10")');
  await cljs(page, '(go-line "ref piece")'); await settle();
  check("a line that changes changes the boxes that follow it", (await send(":b1", ":b3")) === "50");
  const pinned = await cljs(page, "(pin-ref :b2)");
  await cljs(page, '(go-line "ref gain")'); await cljs(page, '(text! :b2 "* 100")'); await cljs(page, '(go-line "ref piece")'); await settle();
  check("(pin-ref box) keeps it at the point it read", (await send(":b1", ":b3")) === "50");
  check("... marked ⌖ and the moment", (await cljs(page, "(ref-badge (get-in (current) [:boxes :b2]))")) === '"⌖6"');
  check("... and the code of the patch keeps the pin", (await cljs(page, "(str/includes? (patch->code (current)) (str \"(pin-ref :b2 \" (pr-str " + pinned + ")))")) === "true" &&
    (await cljs(page, "(:pin (get-in (build (patch->code (current))) [:boxes :b2]))")) === pinned);
  await cljs(page, "(follow-ref :b2)"); await settle();
  check("(follow-ref box) follows the line again", (await send(":b1", ":b3")) === "500");

  // decision 7: adc~ and dac~ of a line play only when it plays alone
  await cljs(page, '(go-line "ref gain")'); await cljs(page, '(box :b9 "dac~" 200 150)'); await cljs(page, '(go-line "ref piece")');
  check("a line's dac~ stays out when it is used as a sub-patch", (await cljs(page, '(some (fn [[_ b]] (= "dac~" (:text b))) (:boxes (eng/flat (engine-patch))))')) === "nil");
  check("... and the box warns that nothing comes out", (await cljs(page, "(boolean (re-find #\"no outlet~\" (str (ref-warning (get-in (current) [:boxes :b2])))))")) === "true");
  await cljs(page, '(go-line "ref gain")'); await cljs(page, "(delete :b9)"); await cljs(page, '(go-line "ref piece")');

  // double-click opens the line in its tab
  await cljs(page, "(swap! ui assoc :last-box-click nil)");
  await page.dblclick('#scene .box[data-box="b2"]');
  check("double-clicking a patch @name opens its line", (await until(page, "(go-line)", '"ref gain"')) === '"ref gain"');
  await cljs(page, '(go-line "ref piece")');

  // decision 4: in Perform, the lines followed stay where they were
  await cljs(page, "(perform)");
  const front = await cljs(page, `(nodes-front (line-nodes ${gid}))`);
  check("Perform keeps where the lines followed are", (await cljs(page, `(get-in @perf [:pins ${gid}])`)) === front);
  await cljs(page, `(let [[nid _] (nodes-front (line-nodes ${gid}))] (swap! hist update-in [:other ${gid} nid :events] conj [:text :b2 "* 3"]))`);
  check("... so a change arriving to one of them meanwhile does not reach the take", (await cljs(page, "(:pos (resolve-ref (get-in (current) [:boxes :b2])))")) === front);
  await cljs(page, "(compose :discard)");
  check("... and back in Compose it follows again", (await cljs(page, "(:pos (resolve-ref (get-in (current) [:boxes :b2])))")) !== front);

  // decision 5: a snapshot keeps where the lines followed are, and its point plays them so
  await cljs(page, '(snapshot "with x3")');
  const snap = await cljs(page, "(norm (:pos @world))");
  check("a snapshot keeps the fronts of the lines followed", (await cljs(page, `(some? (get (:fronts (second (last (:events (node (first (norm (:pos @world)))))))) ${gid}))`)) === "true");
  await cljs(page, '(go-line "ref gain")'); await cljs(page, '(text! :b2 "* 7")'); await cljs(page, '(go-line "ref piece")');
  await cljs(page, "(move :b3 40 170)"); await settle();
  check("at the newest point, it follows the line", (await send(":b1", ":b3")) === "35");
  await cljs(page, `(swap! world assoc :pos ${snap} :auto false)`); await settle();
  check("... at the snapshot's point, the line as it was then", (await send(":b1", ":b3")) === "15");
  await cljs(page, "(swap! world assoc :pos (newest-tip) :auto true)");

  // renaming: the boxes on screen say the new name, the old one still finds it
  check("renaming a line rewrites the boxes on screen that use it", (await cljs(page, '(do (rename-line "ref gain" "ref level") (:text (get-in (current) [:boxes :b2])))')) === '"patch @ref-level"');
  check("... and the old name still finds it", (await cljs(page, '(line-by-ref "ref-gain")')) === gid);
  // the tab of a line the line that plays uses twice: it shows the first instance, what you play goes to both
  await cljs(page, '(box :b4 "msg 7" 200 30)');
  await cljs(page, '(box :b5 "patch @ref-level" 200 90)');
  await cljs(page, '(box :b6 "number" 200 150)');
  await cljs(page, "(connect :b4 0 :b5 0)"); await cljs(page, "(connect :b5 0 :b6 0)");
  await cljs(page, '(go-line "ref level")');
  for (const c of ['(box :b4 "number" 200 30)', "(connect :b1 0 :b4 0)"]) await cljs(page, c);
  await cljs(page, '(go-line "ref piece")'); await cljs(page, "(play)"); await cljs(page, '(go-line "ref level")'); await settle();
  check("a line used twice by the line that plays: the tab knows both instances", (await cljs(page, "(view-instances)")) === "[[:b2] [:b5]]");
  check("... shows the first", (await cljs(page, "(fid :b4)")) === ":b2.b4");
  check("... and says so", /×2/.test(await page.textContent("#transport-info")));
  await cljs(page, "(send! :b1 9)"); await settle();
  check("what you play on its tab goes to every instance", (await cljs(page, "[(second (get-in @eng/rt [:shows :b2.b4 0])) (second (get-in @eng/rt [:shows :b5.b4 0]))]")) === "[9 9]",
    await cljs(page, "[(get-in @eng/rt [:shows :b2.b4]) (get-in @eng/rt [:shows :b5.b4])]"));
  await cljs(page, "(stop)");
  await cljs(page, '(go-line "ref level")'); await cljs(page, "(delete :b4)"); await cljs(page, '(go-line "ref piece")');
  await cljs(page, "(delete :b4 :b5 :b6)");

  // links and releases carry one line: every patch @name inside, as it plays (decision 8)
  check("a link carries the line inside the box, not a reference to it",
    (await cljs(page, '(let [c (patch->code (inline-lines (work-patch)))] [(str/includes? c "@") (:text (get-in (build c) [:boxes :b2])) (count (:boxes (:data (get-in (build c) [:boxes :b2]))))])')) === '[false "patch ref-level" 3]');
  check("... the code of a Release/Perform link too", (await cljs(page, '(str/includes? (release-code) "patch @")')) === "false");
  await cljs(page, '(snapshot "for the release")');
  check("a release has no references left, and its marks no fronts",
    (await cljs(page, '(let [evs (release-events) code (pr-str evs)] [(str/includes? code "patch @") (str/includes? code ":fronts")])')) === "[false false]");

  // from a box to a line and back
  await cljs(page, "(inline-ref :b2)");
  check("(inline-ref box) copies its line inside the box, detached", (await cljs(page, "(let [b (get-in (current) [:boxes :b2])] [(embedded? b) (count (:boxes (:data b)))])")) === "[true 3]");
  await settle();
  check("... and it plays the same", (await send(":b1", ":b3")) === (await cljs(page, '(do (go-line "ref level") (let [m (re-find #"\\d+" (:text (get-in (current) [:boxes :b2])))] (go-line "ref piece") (str (* 5 (js/parseInt m)))))')).replace(/"/g, ""));
  await cljs(page, '(inside :b2 (text! :b2 "+ 1"))');
  const extracted = await cljs(page, '(extract-line :b2 "ref extracted")');
  check("(extract-line box name) makes a line of an embedded patch", extracted === '"ref extracted"' && (await cljs(page, "(:text (get-in (current) [:boxes :b2]))")) === '"patch @ref-extracted"');
  check("... with the history it had inside the box", (await cljs(page, '(let [lid (line-by-ref "ref-extracted") ns (line-nodes lid)] [(count (mapcat :events (vals ns))) (map :text (vals (:boxes (line-patch-at lid (nodes-front ns)))))])')) === '[2 ("inlet" "+ 1" "outlet")]',
    await cljs(page, '(let [lid (line-by-ref "ref-extracted")] (mapcat :events (vals (line-nodes lid))))'));
  await settle();
  check("... and the box uses it", (await send(":b1", ":b3")) === "6");
  check("the inspector of a patch box offers what it can do with lines",
    (await cljs(page, '(do (swap! ui assoc :sel [:box :b2] :insp :b2) (render-inspector!) true)')) === "true" &&
    await page.evaluate(() => [...document.querySelectorAll("#inspector [data-insp-act]")].map((b) => b.dataset.inspAct).join(",") === "pin-ref,inline-ref,open-ref"));
  await cljs(page, "(swap! ui assoc :sel nil :insp nil)");

  await cljs(page, '(archive-line "ref piece")'); await cljs(page, '(archive-line "ref level")'); await cljs(page, '(archive-line "ref extracted")');

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
