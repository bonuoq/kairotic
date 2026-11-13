// SPDX-License-Identifier: MPL-2.0
// Issue #166, 2: in no step of any help patch do boxes cover one another, once every box has the size it is
// drawn at (a faust~ with the sliders its code compiles to, a score with its notation). Positions in help
// patches are written by hand; this is what tells when one needs moving.
// In an app of its own (tests/browser.mjs): each help patch opens as a lesson, step by step.
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

export async function helplayout(page, check) {
  check("(tidy) moves boxes so that none covers another",
    (await cljs(page, "(tidy-moves {:b1 [0 0 100 40] :b2 [10 20 100 40] :b3 [300 0 50 20]})")) === "{:b2 [10 54]}");
  check("... boxes that only touch are left as they are",
    (await cljs(page, "(overlaps {:b1 [0 0 100 40] :b2 [0 40 100 40] :b3 [98 0 50 20]})")) === "[]");

  const classes = JSON.parse(await cljs(page, "(js/JSON.stringify (clj->js (vec (filter (fn [c] (seq (hlp/patch-steps c))) (hlp/known)))))").then((s) => JSON.parse(s)));
  check("there are help patches to look at", classes.length > 20, String(classes.length));
  const bad = [];
  for (const cls of classes) {
    const n = (await cljs(page, `(count (hlp/patch-steps ${JSON.stringify(cls)}))`)) | 0;
    await cljs(page, `(open-help-patch! ${JSON.stringify(cls)})`);
    const steps = await until(page, "(count (:steps @lesson))", (g) => g === String(n), 40000);
    if (steps !== String(n)) { bad.push(`${cls}: did not open (${steps})`); await cljs(page, "(when @lesson (close-lesson!))"); continue; }
    for (let i = 0; i < n; i++) {
      await cljs(page, `(lesson-go! ${i})`);
      const settled = await until(page, "(layout-settled?)", (g) => g === "true", 20000);
      await page.waitForTimeout(150);
      const ov = await cljs(page, "(overlaps)");
      if (ov !== "[]") {
        bad.push(`${cls} step ${i + 1}: ${ov}${settled === "true" ? "" : " (not settled)"}`);
        // each box as it is drawn, to move the ones that need it in the help
        console.log(`  ${cls} step ${i + 1}: ` + await cljs(page, "(into (sorted-map-by (fn [a b] (compare (id-z a) (id-z b)))) (for [[id r] (box-rects)] [id [(:text (get-in (current) [:boxes id])) (mapv js/Math.round r)]]))"));
      }
    }
    await cljs(page, "(close-lesson!)");
    await until(page, "(nil? @lesson)", (g) => g === "true", 8000);
  }
  if (bad.length) console.log("help patches with boxes over one another:\n  " + bad.join("\n  "));
  check(`in no help patch do boxes cover one another (${classes.length} help patches)`, bad.length === 0, bad.join(" · "));
}
