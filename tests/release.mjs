// SPDX-License-Identifier: MPL-2.0
// Issue #45: presets kept in their box (part of the patch), points of the history forgotten (the moments after
// them unchanged), and a release: a new work with a compact history, one point per keyframe.
// In the app already loaded by tests/browser.mjs with a local work open. It opens other works: it runs near
// the end, and opens a local work again when it is done. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, expected, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (got === expected) return got; await page.waitForTimeout(60); }
  return got;
};
const visible = (page, id) => page.evaluate((id) => { const el = document.getElementById(id); return !!el && !el.hidden; }, id);

export async function release(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the release tests", false); return; }
  await until(page, '(some? (comp/lookup "knob"))', "true", 20000);

  // the changes from one patch to another, through the step of the history: from the start of this work to now
  check("the changes from the start to now, applied, give the work as it is",
    (await cljs(page, "(let [a (patch-at (first (segments (norm (:pos @world))))) b (work-patch)] (= (sane-patch (reduce step a (rel/patch-diff a b))) (sane-patch b)))")) === "true");
  check("... and from nothing", (await cljs(page, "(let [b (work-patch)] (= (sane-patch (reduce step empty-patch (rel/patch-diff empty-patch b))) (sane-patch b)))")) === "true");

  // a work of its own for these tests
  await cljs(page, "(apply delete (keys (:boxes (current))))");
  const k = (await cljs(page, '(box "knob 0 1 0.25" 40 40)')).trim();
  const m = (await cljs(page, '(box "metro 250" 160 40)')).trim();
  const pb = (await cljs(page, '(box "presets" 40 160)')).trim();
  const text = (id) => `(:text (get-in (current) [:boxes ${id}]))`;

  // presets kept in the box: no history needed
  await cljs(page, `(presets! ${pb} [{:label "low" :texts {${k} "knob 0 1 0.1" ${m} "metro 100"}} {:label "high" :texts {${k} "knob 0 1 0.9" ${m} "metro 900"}}])`);
  await cljs(page, `(send! ${pb} 2)`);
  check("a presets box recalls the presets it keeps", (await until(page, text(m), '"metro 900"')) === '"metro 900"', await cljs(page, text(m)));
  check("... the REPL shows it as (recall box n)", (await cljs(page, `(recall ${pb} "low")`)).includes("low") && (await cljs(page, text(k))) === '"knob 0 1 0.1"');
  check("its presets are part of the work's code", (await cljs(page, `(str/includes? (patch->code (current)) "(presets! ${pb} [")`)) === "true");
  check("... and links may carry them", (await cljs(page, "(contains? links/calls 'presets!)")) === "true");
  check("... and they come back from the code", (await cljs(page, `(:presets (:data (get-in (build (patch->code (current))) [:boxes ${pb}])))`)).includes('"high"'));
  await cljs(page, `(presets! ${pb} nil)`);
  check("(presets! box nil) forgets them", (await cljs(page, `(:presets (:data (get-in (current) [:boxes ${pb}])))`)) === "[]");

  // keeping the keyframes of the history in the box
  await cljs(page, '(snapshot "r-a")');
  await cljs(page, `(text! ${k} "knob 0 1 0.6") (text! ${m} "metro 600")`);
  await cljs(page, '(snapshot "r-b")');
  await cljs(page, `(box "presets r-a r-b" 40 260)`);
  const pb2 = (await cljs(page, `(last (sort-by box-num (keys (:boxes (current)))))`)).trim();
  check("(store-presets! box) keeps the keyframes it uses, only what changes",
    (await cljs(page, `(store-presets! ${pb2})`)) === "2" &&
    (await cljs(page, `(mapv (comp keys :texts) (:presets (:data (get-in (current) [:boxes ${pb2}]))))`)) === `[(${k} ${m}) (${k} ${m})]`,
    await cljs(page, `(:presets (:data (get-in (current) [:boxes ${pb2}])))`));

  // forgetting points: ⇧+click in the history, Forget…, the moments after them unchanged
  for (const v of ["0.3", "0.35", "0.4", "0.45"]) await cljs(page, `(text! ${k} "knob 0 1 ${v}")`);
  const here = await cljs(page, "(norm (:pos @world))");
  // the points of the last edits: two in a row, in one segment, that can be forgotten
  const pts = await cljs(page, `(let [pts (vec (mapcat (fn [[nid n]] (for [i (range 1 (inc n))] [nid i])) (segments (norm (:pos @world)))))
                                      cand (filter (fn [[[a i] [b j]]] (and (= a b) (= j (inc i)) (nil? (forget-blocker [a i])) (nil? (forget-blocker [b j]))))
                                                   (partition 2 1 (take-last 4 pts)))]
                                  (last cand))`);
  const pm = pts.match(/\["([^"]+)" (\d+)\] \["[^"]+" (\d+)\]/);
  if (!pm) { check("two points of the last edits can be chosen", false, pts); return; }
  const nid = pm[1], n = Number(pm[3]) + 1;
  const at = (i) => `(:text (get-in (patch-at [${JSON.stringify(nid)} ${i}]) [:boxes ${k}]))`;
  const tBefore = await cljs(page, at(n - 3)), tAfter = await cljs(page, at(n));
  const size0 = Number(await cljs(page, "(history-size)"));
  const now0 = await cljs(page, "(sane-patch (work-patch))");
  for (const i of [n - 2, n - 1]) {
    await page.evaluate((sel) => { const el = document.querySelector(sel); el.scrollIntoView({ block: "nearest", inline: "center" }); }, `#tree [data-goto="${nid}|${i}"]`);
    await page.click(`#tree [data-goto="${nid}|${i}"]`, { modifiers: ["Shift"] });
  }
  check("⇧+click chooses points to forget", (await cljs(page, "(count @picked)")) === "2");
  check("... marked in the history", (await page.evaluate(() => document.querySelectorAll("#tree .picked").length)) === 2);
  check("... and Forget… offers it", await visible(page, "forget-btn"));
  check("... without travelling there", (await cljs(page, "(norm (:pos @world))")) === here);
  await page.click("#forget-btn");
  check("Forget… warns that the work at those moments will be lost", await visible(page, "release-pop") &&
    /will be lost/.test(await page.evaluate(() => document.getElementById("release-pop").textContent)));
  await page.click('#release-pop [data-rel="forget"]');
  check("forgetting makes the history shorter", Number(await until(page, "(history-size)", String(size0 - 2))) === size0 - 2, await cljs(page, "(history-size)"));
  check("... and the work as it is stays the same", (await cljs(page, "(sane-patch (work-patch))")) === now0);
  check("... the point before them too", (await cljs(page, at(n - 3))) === tBefore, await cljs(page, at(n - 3)) + " vs " + tBefore);
  check("... the one after, as one change", (await cljs(page, at(n - 2))) === tAfter, await cljs(page, at(n - 2)) + " vs " + tAfter);
  check("nothing is chosen any more", (await cljs(page, "(count @picked)")) === "0" && !(await visible(page, "forget-btn")));
  const tip = await cljs(page, "(let [[nid i] (norm (:pos @world))] (forget-blocker [nid i]))");
  check("the tip of a branch cannot be forgotten", tip.includes("tip"), tip);
  await cljs(page, "(rewind 2)");
  await cljs(page, `(text! ${m} "metro 700")`);
  const bp = await cljs(page, `(let [n (node (first (norm (:pos @world))))] (forget-blocker [(:parent n) (:at n)]))`);
  check("... nor a point where a branch starts", bp.includes("branch"), bp);
  check("a room's history cannot be forgotten", (await cljs(page, "(let [w @work] (swap! work assoc :kind :room) (let [r (forget-allowed?)] (reset! work w) r))")) === "false");

  // a release: a new work, one point per keyframe, then the work as it is
  const kfs0 = await cljs(page, "(mapv :label (keyframes))");
  const before = await cljs(page, `(sane-patch (update (work-patch) :boxes (fn [bs] (into (sorted-map) (map (fn [[id b]] [id (dissoc b :data)])) bs))))`);
  const big = Number(await cljs(page, "(history-size)"));
  await page.click("#release-btn");
  check("Release… says what it makes", await visible(page, "release-pop") && /compact history/.test(await page.evaluate(() => document.getElementById("release-pop").textContent)));
  await page.click('#release-pop [data-rel="release"]');
  const opened = await until(page, '(str/ends-with? (str (:name @work)) "· release")', "true", 15000);
  check("a release opens as a new work", opened === "true", await cljs(page, "@work"));
  await until(page, "(pos? (history-size))", "true", 15000);
  check("... with the same keyframes, in order", (await until(page, "(mapv :label (keyframes))", kfs0)) === kfs0, await cljs(page, "(mapv :label (keyframes))"));
  const relSize = Number(await cljs(page, "(history-size)")), nk = Number(await cljs(page, "(count (keyframes))"));
  check("... a much shorter history: at most a change and a mark per keyframe, and the work as it is",
    relSize <= 2 * nk + 1 && relSize < big, `${big} → ${relSize} (${nk} keyframes)`);
  check("... the work as it was",
    (await cljs(page, `(sane-patch (update (work-patch) :boxes (fn [bs] (into (sorted-map) (map (fn [[id b]] [id (dissoc b :data)])) bs))))`)) === before);
  check("... and its presets boxes keep their presets", (await cljs(page, `(count (:presets (:data (get-in (work-patch) [:boxes ${pb}]))))`)) !== "0");

  // back to a local work for what comes next
  await cljs(page, '(open-work! :local "local" "Local")');
  await until(page, "(:mode @hist)", ":local");
}
