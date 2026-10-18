// SPDX-License-Identifier: MPL-2.0
// Discussion #17: (keep! :bN) keeps, beside the buffer, the recipe that made it (the tree and the boxes
// upstream); it is marked stale when the buffer changes, and (remake! :bN) writes its tree back.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(80); }
  return got;
};

export async function recipe(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the recipe tests", false); return; }
  const events = "(depth-of (norm (:pos @world)))";
  const tb = (await cljs(page, '(box "tree" 2100 760)')).trim();
  const tr = (await cljs(page, '(box "mt transpose 7" 2100 830)')).trim();
  const sc = (await cljs(page, '(box "freqt" 2100 900)')).trim();
  await cljs(page, `(view ${sc} :score)`);
  await cljs(page, `(code ${tb} "[:voice [:measure {:meter [3 4]} [:tuplet {:ratio [3 2]} \\"c4/.5 d4 e4\\"] \\"f4/2\\"]]")`);
  await cljs(page, `(connect ${tb} 0 ${tr} 0) (connect ${tr} 0 ${sc} 0)`);
  await cljs(page, `(send! ${tb} :bang)`);
  const live = await until(page, `(do (sync-live-trees!) (boolean (live-tree ${sc})))`, (g) => g === "true");
  check("the freqt (shown as a score) receives the transposed tree", live === "true", live);
  if (live !== "true") { await cljs(page, `(delete ${tb} ${tr} ${sc})`); return; }

  const before = Number(await cljs(page, events));
  await cljs(page, `(keep! ${sc})`);
  check("keep! with its recipe is one event", Number(await cljs(page, events)) === before + 1, await cljs(page, events));
  check("the recipe keeps the tree as it arrived",
        (await cljs(page, `(mt/pitches (:tree (recipe ${sc})))`)) === '["g4" "a4" "b4" "c5"]', await cljs(page, `(recipe ${sc})`));
  check("... the boxes upstream as code",
        (await cljs(page, `(let [c (:calls (recipe ${sc}))] (and (str/includes? c "mt transpose 7") (str/includes? c "(box ${tb} \\"tree\\"")))`)) === "true",
        await cljs(page, `(:calls (recipe ${sc}))`));
  check("... and the box it came from", (await cljs(page, `(:from (recipe ${sc}))`)) === tr);
  check("the recipe is beside the buffer, not in it", (await cljs(page, `(contains? (box-data ${sc}) :recipe)`)) === "false");
  await cljs(page, "(sync-live-trees!)");
  check("a kept tree is not shown live again", (await cljs(page, `(boolean (live-tree ${sc}))`)) === "false");
  check("while unchanged, as-tree gives the tree itself (measured)", (await cljs(page, `(mt/measured? (as-tree ${sc}))`)) === "true");
  check("the work's code writes the recipe", (await cljs(page, `(str/includes? (patch->code (current)) "(recipe ${sc} ")`)) === "true");
  check("... and builds it back", (await cljs(page, `(boolean (get-in (build (patch->code (current))) [:boxes ${sc} :recipe :tree]))`)) === "true");

  const n = await cljs(page, `(count (:strokes (box-data ${sc})))`);
  await cljs(page, `(send! ${sc} [:stroke [[5 440] [6 440]]])`);
  const stale = await until(page, `(boolean (:stale (recipe ${sc})))`, (g) => g === "true");
  check("a change to the buffer marks the recipe stale", stale === "true", stale);
  check("... and as-tree reads the strokes again", (await cljs(page, `(mt/measured? (as-tree ${sc}))`)) === "false");
  await cljs(page, `(remake! ${sc})`);
  check("remake! writes the recipe's tree back", (await cljs(page, `(count (:strokes (box-data ${sc})))`)) === n);
  check("... and the recipe is fresh again", (await cljs(page, `(boolean (:stale (recipe ${sc})))`)) === "false");
  check("a box without a recipe refuses remake!", /ERR/.test(await cljs(page, `(remake! ${tr})`)));
  await cljs(page, `(delete ${tb} ${tr} ${sc})`);
}
