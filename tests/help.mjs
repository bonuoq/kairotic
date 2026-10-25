// SPDX-License-Identifier: MPL-2.0
// Help patches with several steps (one use each): the help of freqt, canvas and mt opens as a lesson
// whose steps build on each other, and the Help tab lists them.
// In the app already loaded by tests/browser.mjs. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 20000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (got === ok) return got; await page.waitForTimeout(100); }
  return got;
};

const cases = [
  ["freqt", 4, [["(display-of (get-in (current) [:boxes :b9]))", ":score"],
                ["(:gy (box-data :b1))", "nil"],
                ["(count (:strokes (box-data :b1)))", "4"]]],
  ["canvas", 3, [["(:text (get-in (current) [:boxes :b4]))", '"reader path"'],
                 ["(count (:strokes (box-data :b1)))", "1"],
                 ["(:text (get-in (current) [:boxes :b9]))", '"gain~ 0"']]],
  ["mt", 3, [["(:text (get-in (current) [:boxes :b3]))", '"mt canon 2 7"'],
             ["(nil? (get-in (current) [:boxes :b4]))", "true"],
             ["(:text (get-in (current) [:boxes :b9]))", '"synth~"']]],
  ["gendy~", 4, [["(:text (get-in (current) [:boxes :b9]))", '"gain~ 300"'],
                 ["(:text (get-in (current) [:boxes :b4]))", '"knob 0 100 10 x-step"'],
                 ["(count (filter (fn [[_ b]] (definition? b)) (:boxes (current))))", "2"]]],
];

export async function help(page, check) {
  check("the Help tab lists the steps of a help patch",
    (await cljs(page, '(str/includes? (help-page "freqt") "help-steps")')) === "true");
  check("a class with one use has no list of steps",
    (await cljs(page, '[(count (hlp/patch-steps "metro")) (str/includes? (help-page "metro") "help-steps")]')) === "[1 false]");
  for (const [cls, n, expect] of cases) {
    await cljs(page, `(open-help-patch! "${cls}")`);
    const steps = await until(page, "(count (:steps @lesson))", String(n), 30000);
    check(`the help patch of ${cls} opens as a lesson of ${n} steps`, steps === String(n), steps);
    if (steps !== String(n)) { await cljs(page, "(when @lesson (close-lesson!))"); continue; }
    await cljs(page, `(lesson-go! ${n - 1})`);
    for (const [src, ok] of expect) {
      const got = await until(page, src, ok, 8000);
      check(`... its last step: ${src} → ${ok}`, got === ok, got);
    }
    await cljs(page, "(lesson-go! 0)");
    check(`... ◀ back to its first step`, (await cljs(page, "(:at @lesson)")) === "0");
    await cljs(page, "(close-lesson!)");
    await until(page, "(nil? @lesson)", "true", 8000);
  }
  // opened at a step: the link of the list opens the lesson there
  await cljs(page, '(open-help-patch! "freqt" 2)');
  const at = await until(page, "(:at @lesson)", "2", 30000);
  check("a step of the list opens the help patch at that step", at === "2", at);
  await cljs(page, "(when @lesson (close-lesson!))");
  await until(page, "(nil? @lesson)", "true", 8000);
}
