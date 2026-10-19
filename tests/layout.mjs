// SPDX-License-Identifier: MPL-2.0
// Issue #40: the panel on the right can be hidden, shown again (by its handle, or when a tab is asked for) and
// dragged to another width; canvas, freqt and score boxes can be resized by their corner, as one event.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, expected, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (got === expected) return got; await page.waitForTimeout(60); }
  return got;
};
const settled = (page) => page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
const width = (page, sel) => page.evaluate((s) => document.querySelector(s).getBoundingClientRect().width, sel);
const hiddenEl = (page, sel) => page.evaluate((s) => getComputedStyle(document.querySelector(s)).display === "none", sel);

export async function layout(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the layout tests", false); return; }

  // ── the panel on the right ──
  await cljs(page, "(side-panel :auto)");
  await settled(page);
  const patch0 = await width(page, "#canvas-wrap");
  await page.click("#side-hide");
  await settled(page);
  check("» hides the panel on the right", await hiddenEl(page, "#side-pane"));
  check("... and the patch takes the room", (await width(page, "#canvas-wrap")) > patch0 + 200, `${patch0} → ${await width(page, "#canvas-wrap")}`);
  check("... the handle offers it back", (await page.textContent("#side-toggle")) === "‹");
  check("... and it is remembered in this browser", (await page.evaluate(() => localStorage.getItem("kairotic.side"))).includes(":open false"));
  await page.click("#side-toggle");
  await settled(page);
  check("the handle shows it again", !(await hiddenEl(page, "#side-pane")) && (await page.textContent("#side-toggle")) === "›");
  await cljs(page, "(side-panel false)");
  await cljs(page, '(docs "guide")');
  await settled(page);
  check("asking for help shows the panel again", !(await hiddenEl(page, "#side-pane")) && (await cljs(page, "(:open (side-panel))")) === "true");
  await cljs(page, "(side-panel false)");
  await cljs(page, '(select-tab! "code")');
  check("... and so does asking for the Code tab", (await cljs(page, "(:open (side-panel))")) === "true");

  // dragging the splitter
  await settled(page);
  const sp = await page.evaluate(() => { const r = document.getElementById("side-split").getBoundingClientRect(); return [r.x + r.width / 2, r.y + Math.min(120, r.height - 10)]; });
  const before = await width(page, "#side-pane");
  await page.mouse.move(sp[0], sp[1]);
  await page.mouse.down();
  await page.mouse.move(sp[0] - 120, sp[1], { steps: 6 });
  await page.mouse.up();
  await settled(page);
  const after = await width(page, "#side-pane");
  check("dragging the splitter widens the panel", after > before + 80, `${before} → ${after}`);
  check("... and its width is kept", Number(await cljs(page, "(:w (side-panel))")) > 0);
  await cljs(page, "(side-panel 100)");
  await settled(page);
  check("the panel is never narrower than its minimum", (await width(page, "#side-pane")) >= 258, String(await width(page, "#side-pane")));
  await cljs(page, "(side-panel :auto)");
  check("(side-panel :auto) gives it back its proportion", (await cljs(page, "(side-panel)")) === "{:open true, :w nil}");

  // ── resizing a canvas, a freqt, a score ──
  const events = "(depth-of (norm (:pos @world)))";
  const fq = (await cljs(page, '(box "freqt" 2800 900)')).trim();
  const dims = `(box-dims ${fq} (get-in (current) [:boxes ${fq}]))`;
  check("a freqt starts at its default size", (await cljs(page, dims)) === "[420 200]");
  let n0 = Number(await cljs(page, events));
  await cljs(page, `(resize ${fq} 640 300)`);
  check("(resize …) gives it a size of its own", (await cljs(page, dims)) === "[640 300]");
  check("... as one event", Number(await cljs(page, events)) === n0 + 1);
  check("... its data is drawn in the whole box", (await cljs(page, `(let [b (get-in (current) [:boxes ${fq}]) g (canvas-geom nil ${fq} b)] (= [(:w g) (:h g)] [(- 640 40 6) (- 300 hdr 3 6)]))`)) === "true");
  check("... the work's code keeps it", (await cljs(page, `(str/includes? (patch->code (current)) "(resize ${fq} 640 300)")`)) === "true");
  check("a size too small is kept at the minimum", (await cljs(page, `(resize ${fq} 10 10)`)) === "[220 110]");
  const tb = (await cljs(page, '(box "metro 100" 2800 1300)')).trim();
  check("a box that is not drawn with a size refuses one", (await cljs(page, `(resize ${tb} 300 300)`)).startsWith("ERR"));
  check("a size is a change of layout (Perform counts it so)", (await cljs(page, `(layout-ev? (current) [:size ${fq} 300 200])`)) === "true");
  check("... and a merge sees it", (await cljs(page, `(contains? (:mod (summarize [[:size ${fq} 300 200]])) ${fq})`)) === "true");

  // dragging its corner
  await cljs(page, `(resize ${fq} 420 200)`);
  const corner = async () => {
    await page.waitForFunction((n) => document.querySelector('#scene .box[data-box="' + n + '"] .resize-corner'), fq.slice(1), { timeout: 8000 });
    await page.evaluate((n) => document.querySelector('#scene .box[data-box="' + n + '"] .resize-corner').scrollIntoView({ block: "center", inline: "center" }), fq.slice(1));
    await settled(page);
    return page.evaluate((n) => { const r = document.querySelector('#scene .box[data-box="' + n + '"] .resize-corner').getBoundingClientRect(); return [r.x + r.width * 0.75, r.y + r.height * 0.75]; }, fq.slice(1));
  };
  let [cx, cy] = await corner();
  n0 = Number(await cljs(page, events));
  await page.mouse.move(cx, cy);
  await page.mouse.down();
  await page.mouse.move(cx + 100, cy + 50, { steps: 8 });
  await page.mouse.up();
  const got = await until(page, `(:size (get-in (current) [:boxes ${fq}]))`, "[520 250]");
  check("dragging the corner resizes the box", got === "[520 250]", got);
  check("... as one event on release", Number(await cljs(page, events)) === n0 + 1, await cljs(page, events));
  [cx, cy] = await corner();
  await page.mouse.dblclick(cx, cy);
  check("a double-click on the corner brings back the default size", (await until(page, dims, "[420 200]")) === "[420 200]", await cljs(page, dims));

  // a score: its width reflows the notation, its height follows it
  await cljs(page, `(view ${fq} :score) (resize ${fq} 700 120)`);
  check("a score takes the width it is given", (await cljs(page, `(first ${dims})`)) === "700");
  check("... and keeps the height of its notation", (await cljs(page, `(= (second ${dims}) (max 90 (+ hdr 8 (or (get-in @score-cache [${fq} :h]) 70))))`)) === "true");
  await cljs(page, `(delete ${fq} ${tb})`);
}
