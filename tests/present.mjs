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

  await locked(page, check);
}

// Issue #57: in presentation the paper is for playing: no new boxes and no selection with the mouse
const settled = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const centre = async (page, id) => {
  await page.waitForFunction((id) => !!document.querySelector('#scene .box[data-box="' + id + '"] rect.body'), id, { timeout: 8000 }).catch(() => {});
  await page.evaluate((id) => { const el = document.querySelector('#scene .box[data-box="' + id + '"] rect.body');
                                if (el) el.scrollIntoView({ block: "center", inline: "center" }); }, id);
  await settled(page);
  return page.evaluate((id) => { const el = document.querySelector('#scene .box[data-box="' + id + '"] rect.body');
                                 if (!el) return null; const r = el.getBoundingClientRect(); return [r.x + r.width / 2, r.y + r.height / 2]; }, id);
};

async function locked(page, check) {
  const p = (await cljs(page, '(box "print" 3300 700)')).trim();
  await cljs(page, `(present ${p} 3300 700)`);
  const n = Number(await cljs(page, "(count (:boxes (current)))"));
  await cljs(page, `(swap! ui assoc :sel [:box ${p}])`);
  await cljs(page, "(presentation true)");
  check("switching to presentation clears the selection", (await cljs(page, "(:sel @ui)")) === "nil");
  const at = await centre(page, p);
  if (!at) { check("the presented box is on screen", false, await cljs(page, `[${p} @pres-mode (:present (get-in (current) [:boxes ${p}])) (count (:boxes (scene-of (current))))]`) + " " + await page.evaluate(() => [...document.querySelectorAll("#scene .box")].map((e) => e.getAttribute("data-box")).join(","))); await cljs(page, `(presentation false) (delete ${p})`); return; }
  const empty = [at[0], at[1] + 140];

  await page.mouse.dblclick(empty[0], empty[1]); await settled(page);
  check("in presentation a double-click on the paper opens no box editor",
    !(await page.evaluate(() => !!document.getElementById("box-edit"))));
  await page.mouse.move(empty[0], empty[1]); await page.mouse.down();
  await page.mouse.move(at[0] - 60, at[1] - 30, { steps: 6 }); await page.mouse.up(); await settled(page);
  check("... a frame drawn with the mouse selects nothing", (await cljs(page, "(:sel @ui)")) === "nil" && !(await page.evaluate(() => !!document.getElementById("marquee"))));
  await page.mouse.click(at[0], at[1]); await settled(page);
  check("... a click on a box does not select it", (await cljs(page, "(:sel @ui)")) === "nil");
  await page.keyboard.press("Delete");
  check("... so Delete removes nothing", Number(await cljs(page, "(count (:boxes (current)))")) === n);
  await page.keyboard.down("Shift"); await page.mouse.click(at[0], at[1]); await page.keyboard.up("Shift"); await settled(page);
  check("... nor does ⇧+click", (await cljs(page, "(:sel @ui)")) === "nil");
  await page.keyboard.down("Control"); await page.mouse.click(at[0], at[1]); await page.keyboard.press("a"); await page.keyboard.up("Control"); await settled(page);
  check("... nor ⌘/Ctrl+click and ⌘/Ctrl+A", (await cljs(page, "[(:sel @ui) (:insp @ui)]")) === "[nil nil]");
  await page.mouse.move(at[0], at[1]); await page.mouse.down();
  await page.mouse.move(at[0] + 40, at[1] + 20, { steps: 6 }); await page.mouse.up(); await settled(page);
  check("... but in the editor a presented box can still be dragged to a new place",
    (await cljs(page, `(:present (get-in (current) [:boxes ${p}]))`)) !== "[3300 700]" && (await cljs(page, "(:sel @ui)")) === "nil",
    await cljs(page, `(:present (get-in (current) [:boxes ${p}]))`));
  check("... and no box was created", Number(await cljs(page, "(count (:boxes (current)))")) === n);
  await cljs(page, "(presentation false)");
  await cljs(page, `(delete ${p})`);
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
