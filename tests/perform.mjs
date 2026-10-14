// SPDX-License-Identifier: MPL-2.0
// Compose and Perform, and snapshots (issue #5), in the app already loaded by tests/browser.mjs, with a
// local work open (tests/gestures.mjs opens it). check(label, ok, detail) records one result.
import { cljs } from "./gestures.mjs";

const visible = (page, id) => page.evaluate((id) => { const el = document.getElementById(id); return !!el && !el.hidden; }, id);

export async function perform(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for Perform", false); return; }
  const lastEv = "(last (:events (node (first (:pos @world)))))";

  // a snapshot in Compose: a keyframe event where you are
  await cljs(page, '(snapshot "intro")');
  const snap = await cljs(page, lastEv);
  check("a snapshot in Compose writes a keyframe", snap === '[:mark {:kind :snapshot, :label "intro"}]', snap);

  // Perform from here: changes go to the take, not to the history
  const from = await cljs(page, "(norm (:pos @world))");
  await page.click("#perform-toggle");
  check("the Perform button starts Perform", (await cljs(page, "(some? @perf)")) === "true");
  check("the page shows it is performing", await page.evaluate(() => document.body.classList.contains("performing")));
  const c = (await cljs(page, '(box "mtof" 1400 300)')).trim();
  check("a box made in Perform is in the take", (await cljs(page, `(contains? (:boxes (current)) ${c})`)) === "true");
  check("... and not in the history", (await cljs(page, `(contains? (:boxes (patch-at (:pos @world))) ${c})`)) === "false");
  check("... and you stay where you were", (await cljs(page, "(norm (:pos @world))")) === from);

  // undo and redo inside the take, also with Ctrl+Z
  await cljs(page, "(rewind)");
  check("(rewind) takes it back in the take", (await cljs(page, `(contains? (:boxes (current)) ${c})`)) === "false");
  await cljs(page, "(forward)");
  check("(forward) brings it again", (await cljs(page, `(contains? (:boxes (current)) ${c})`)) === "true");
  await page.keyboard.press("Control+z");
  check("Ctrl+Z works in the take", (await cljs(page, `(contains? (:boxes (current)) ${c})`)) === "false");
  await cljs(page, "(forward)");

  // moving boxes is counted as layout
  await cljs(page, `(move-by [${c}] 10 0)`);
  const sum = await cljs(page, "(take-summary @perf)");
  check("a take counts changes to the work and layout apart", sum === "{:changes 2, :layout 1, :work 1}", sum);

  // travelling in the history asks first
  const g = await cljs(page, `(try (goto ${JSON.stringify(from.match(/"([^"]+)"/)?.[1] || "")} 0) :moved (catch :default e :refused))`);
  check("travelling in the history is refused in Perform", g === ":refused", g);
  check("... and the leave dialog appears", await visible(page, "perform-pop"));

  // back to Compose: discard
  await page.click('#perform-pop [data-perf=":discard"]');
  check("Discard leaves Perform", (await cljs(page, "(nil? @perf)")) === "true");
  check("... the take is gone", (await cljs(page, `(contains? (:boxes (current)) ${c})`)) === "false");
  check("... back where it started", (await cljs(page, "(norm (:pos @world))")) === from);
  check("... and the dialog closes", !(await visible(page, "perform-pop")));

  // keep: a new point, a branch from where the take started, closed by a :take keyframe
  await cljs(page, "(perform)");
  const d = (await cljs(page, '(box "mtof" 1400 360)')).trim();
  const kept = await cljs(page, "(compose :keep)");
  check("(compose :keep) writes the take", (await cljs(page, `(contains? (:boxes (current)) ${d})`)) === "true", kept);
  check("... closed by a take keyframe", (await cljs(page, lastEv)) === "[:mark {:kind :take}]");
  const parent = await cljs(page, "(let [n (node (first (:pos @world)))] [(:parent n) (:at n)])");
  check("... as a branch from where it started", parent === from, parent + " vs " + from);

  // a snapshot in Perform writes the take so far and the take goes on from there
  const here = await cljs(page, "(norm (:pos @world))");
  await cljs(page, "(perform)");
  const e = (await cljs(page, '(box "mtof" 1400 420)')).trim();
  await cljs(page, '(snapshot "in a take")');
  check("a snapshot in Perform writes the take into the history", (await cljs(page, `(contains? (:boxes (patch-at (:pos @world))) ${e})`)) === "true");
  check("... and Perform goes on", (await cljs(page, "(some? @perf)")) === "true");
  check("... with an empty take from the snapshot", (await cljs(page, "(:changes (take-summary @perf))")) === "0");
  await cljs(page, "(compose)");
  check("(compose) with nothing new just leaves", (await cljs(page, "(nil? @perf)")) === "true");
  check("... back to where Perform started", (await cljs(page, "(norm (:pos @world))")) === here);
  check("the Perform button is off again", !(await page.evaluate(() => document.getElementById("perform-toggle").classList.contains("on"))));
}
