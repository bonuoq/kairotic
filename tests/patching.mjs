// SPDX-License-Identifier: MPL-2.0
// Patching, the same in every patcher of Kairotic: wires are curves; an outlet within reach of the pointer
// lights up (and the pointer is a cross), and pressing there starts a wire; the inlet a wire would land on
// lights up too, and a wire dropped just above an inlet (not on the box) lands on it. In the app already
// loaded by tests/browser.mjs with a local work open. check(label, ok, detail) records one result.
import { cljs } from "./gestures.mjs";

// a port of a box on screen (scrolled into view first): its centre and its edges
const port = (page, id, kind, k) => page.evaluate(({ id, kind, k }) => {
  const el = document.querySelector('#scene .port.' + kind + '[data-box="' + id + '"][data-' + kind + '="' + k + '"]');
  if (!el) return null;
  el.scrollIntoView({ block: "center", inline: "center" });
  const r = el.getBoundingClientRect();
  return { x: r.x + r.width / 2, y: r.y + r.height / 2, top: r.top, bottom: r.bottom };
}, { id, kind, k });

export async function patching(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the patching tests", false); return; }
  const a = (await cljs(page, '(box "+ 1" 3000 1700)')).trim();
  const b = (await cljs(page, '(box "* 2" 3060 1820)')).trim();
  const ai = a.slice(1), bi = b.slice(1);
  await page.waitForFunction(({ ai, bi }) => document.querySelector('#scene .box[data-box="' + ai + '"]') && document.querySelector('#scene .box[data-box="' + bi + '"]'), { ai, bi }, { timeout: 10000 });

  // an outlet within reach: 7 px below it, a little to its side
  const o = await port(page, ai, "out", 0);
  await page.mouse.move(o.x + 6, o.bottom + 7);
  const lit = await page.evaluate((ai) => !!document.querySelector('#scene .port.out.hot[data-box="' + ai + '"]'), ai);
  check("an outlet within reach of the pointer lights up", lit);
  const cursor = await page.evaluate(() => getComputedStyle(document.getElementById("canvas")).cursor);
  check("... and the pointer is a cross", cursor === "crosshair", cursor);

  // pressing there starts a wire; the inlet it would land on lights up; the wire being drawn is a curve
  await page.mouse.down();
  const i = await port(page, bi, "in", 1);
  // (the outlet may have moved with the scroll that brought the inlet into view: drag from where it is)
  await page.mouse.move(i.x + 3, i.top - 6, { steps: 6 });
  const lit2 = await page.evaluate((bi) => !!document.querySelector('#scene .port.in.target[data-box="' + bi + '"][data-in="1"]'), bi);
  check("pressing near it starts a wire, and the inlet it would land on lights up", lit2);
  const temp = await page.evaluate(() => document.querySelector("#scene path.wire.temp")?.getAttribute("d") || "");
  check("... the wire being drawn is a curve", / C/.test(temp), temp);
  // dropped 6 px above the inlet, not on the box: it lands there
  await page.mouse.up();
  const lines = await cljs(page, `(vec (filter (fn [[x _ y]] (and (= x ${a}) (= y ${b}))) (:lines (current))))`);
  check("a wire dropped just above an inlet lands on it", lines === `[[${a} 0 ${b} 1]]`, lines);

  // wires are drawn as curves
  const d = await page.evaluate(() => [...document.querySelectorAll("#scene path.wire:not(.temp)")].map((p) => p.getAttribute("d")));
  check("wires are curves", d.length > 0 && d.every((x) => / C/.test(x)), JSON.stringify(d.slice(0, 2)));
  check("... with no straight lines left", await page.evaluate(() => document.querySelectorAll("#scene line.wire").length === 0));

  // far from every outlet, nothing lights up and the pointer is not a cross
  const far = await port(page, ai, "out", 0);
  await page.mouse.move(far.x + 80, far.bottom + 60);
  check("far from outlets nothing lights up", await page.evaluate(() => !document.querySelector("#scene .port.out.hot")));
  await cljs(page, `(delete ${a}) (delete ${b})`);
}
