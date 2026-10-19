// SPDX-License-Identifier: MPL-2.0
// Issue #42: Present with boxes selected asks whether to present them, and puts them where they are in the
// patch, as one event. Then the presets tutorial (the patch of #42) is built as a lesson.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, expected, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (got === expected) return got; await page.waitForTimeout(60); }
  return got;
};
const visible = (page, id) => page.evaluate((id) => { const el = document.getElementById(id); return !!el && !el.hidden; }, id);

export async function present(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the present tests", false); return; }
  const events = "(depth-of (norm (:pos @world)))";
  const a = (await cljs(page, '(box "number 1" 2800 500)')).trim();
  const b = (await cljs(page, '(box "bang" 2900 540)')).trim();
  const c = (await cljs(page, '(box "msg 3" 3000 580)')).trim();
  const placed = (id) => `(:present (get-in (current) [:boxes ${id}]))`;

  // the command: one event, each box where it is
  let before = Number(await cljs(page, events));
  await cljs(page, `(present-in-place ${a} ${b})`);
  check("present-in-place presents boxes where they are in the patch",
    (await cljs(page, `[${placed(a)} ${placed(b)}]`)) === "[[2800 500] [2900 540]]", await cljs(page, `[${placed(a)} ${placed(b)}]`));
  check("... as one event", Number(await cljs(page, events)) === before + 1, await cljs(page, events));
  await cljs(page, `(unpresent ${a}) (unpresent ${b})`);

  // the button with boxes selected: it asks first
  await cljs(page, `(swap! ui assoc :sel [:boxes #{${a} ${b}}])`);
  await page.click("#pres-toggle");
  check("Present with boxes selected asks whether to present them", await visible(page, "pres-ask"));
  check("... saying how many", /the 2 selected boxes/.test(await page.evaluate(() => document.getElementById("pres-ask").textContent)));
  check("... and does not switch yet", (await cljs(page, "@pres-mode")) === "false");
  before = Number(await cljs(page, events));
  await page.click('#pres-ask button.primary');
  check("presenting the selection switches to presentation", (await until(page, "@pres-mode", "true")) === "true");
  check("... with the selected boxes where they were in the patch",
    (await cljs(page, `[${placed(a)} ${placed(b)} ${placed(c)}]`)) === "[[2800 500] [2900 540] nil]", await cljs(page, `[${placed(a)} ${placed(b)} ${placed(c)}]`));
  check("... as one event", Number(await cljs(page, events)) === before + 1, await cljs(page, events));
  check("... and the question is gone", !(await visible(page, "pres-ask")));
  await page.click("#pres-toggle");
  check("Edit goes back without asking", (await cljs(page, "@pres-mode")) === "false" && !(await visible(page, "pres-ask")));

  // boxes already presented: no question
  await cljs(page, `(swap! ui assoc :sel [:boxes #{${a} ${b}}])`);
  await page.click("#pres-toggle");
  check("selected boxes already presented: it presents at once", (await cljs(page, "@pres-mode")) === "true" && !(await visible(page, "pres-ask")));
  await page.click("#pres-toggle");

  // without them
  await cljs(page, `(swap! ui assoc :sel [:box ${c}])`);
  await page.click("#pres-toggle");
  check("... one box not presented: it asks", await visible(page, "pres-ask"));
  await page.click('#pres-ask button[data-pres="all"]');
  check("Present without it leaves it out", (await cljs(page, "@pres-mode")) === "true" && (await cljs(page, placed(c))) === "nil");
  await page.click("#pres-toggle");
  await cljs(page, `(swap! ui assoc :sel [:box ${c}])`);
  await page.click("#pres-toggle");
  await page.click('#pres-ask button[data-pres="cancel"]');
  check("Cancel stays in the patch", (await cljs(page, "@pres-mode")) === "false" && !(await visible(page, "pres-ask")));
  await cljs(page, `(delete ${a} ${b} ${c})`);
}

// the tutorial that demonstrates presets: it opens a lesson, so it runs last
export async function presetsTutorial(page, check) {
  const loaded = await until(page, '(do (when-not (sequential? @tutorials) (load-tutorials!)) (boolean (some #(= "presets" (:id %)) (when (sequential? @tutorials) @tutorials))))', "true", 20000);
  check("the presets tutorial is in the catalog", loaded === "true", loaded);
  if (loaded !== "true") return;
  await cljs(page, '(tutorial "presets")');
  const steps = await until(page, "(count (:steps @lesson))", "6", 30000);
  check("the presets tutorial opens as a lesson of six steps", steps === "6", steps);
  if (steps !== "6") return;
  await cljs(page, "(lesson-go! 5)");
  check("... with the three keyframes, numbered in order",
    (await cljs(page, "(mapv (juxt :n :label) (keyframes))")) === '[[1 "calm"] [2 "pulse"] [3 "storm"]]', await cljs(page, "(keyframes)"));
  check("... its controls presented where they are",
    (await cljs(page, "(count (filter :present (vals (:boxes (current)))))")) === "10");
  // recalling from its presets box
  await cljs(page, "(send! :b18 1)");
  check("... and its presets box recalls calm", (await until(page, "(:text (get-in (current) [:boxes :b13]))", '"knob 0.5 50 2 log strobe"')) === '"knob 0.5 50 2 log strobe"',
    await cljs(page, "(:text (get-in (current) [:boxes :b13]))"));
  await cljs(page, "(close-lesson!)");
  check("the lesson closes", (await until(page, "(nil? @lesson)", "true")) === "true");
}
