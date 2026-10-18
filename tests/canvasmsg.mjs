// SPDX-License-Identifier: MPL-2.0
// Issue #26: messages that edit a canvas become one event of the history; questions are answered on the left.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, expected, ms = 5000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (got === expected) return got; await page.waitForTimeout(50); }
  return got;
};

export async function canvasmsg(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the canvas messages", false); return; }
  const c = (await cljs(page, '(box "canvas" 1400 1100)')).trim();
  const events = "(depth-of (norm (:pos @world)))";
  const before = Number(await cljs(page, events));
  await cljs(page, `(send! ${c} [:batch [[:stroke [[0 0] [4 1]]] [:stroke [[2 0.5] [6 0.2]]]]])`);
  const n = await until(page, `(count (:strokes (box-data ${c})))`, "2");
  check("a batch of strokes by message draws them", n === "2", n);
  check("... as one event of the history", Number(await cljs(page, events)) === before + 1, await cljs(page, events));
  const q = (await cljs(page, '(box "count" 1400 1300)')).trim();
  const num = (await cljs(page, '(box "number" 1400 1350)')).trim();
  await cljs(page, `(connect ${c} 0 ${q} 0) (connect ${q} 0 ${num} 0)`);
  await cljs(page, `(send! ${c} [:read 3])`);
  check("a question is answered on the left (two strokes at x = 3)", (await cljs(page, `(get-in @eng/rt [:states ${num}])`)) === "2");
  await cljs(page, `(send! ${c} [:erase :t1])`);
  const left = await until(page, `(count (:strokes (box-data ${c})))`, "1");
  check("an erase by message", left === "1", left);
  await cljs(page, `(delete ${c} ${q} ${num})`);
}
