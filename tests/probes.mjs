// SPDX-License-Identifier: MPL-2.0
// Discussion #183: probes on wires. ⌥/Alt+click on a wire (or (probe …)) shows on it the last value that went along
// it; probes are this tab's, never part of the work, its history or its code.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 5000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(60); }
  return got;
};

// the labels of the probes on screen
const labels = (page) => page.evaluate(() => [...document.querySelectorAll("#canvas .probe text")].map((t) => t.textContent));

// the middle of the wire idx on screen, scrolled into view, where a click lands on it
const wireMiddle = (page, idx) => page.evaluate(async (idx) => {
  const el = document.querySelector(`#canvas .wire-hit[data-line="${idx}"]`);
  if (!el) return null;
  for (let k = 0; k < 10; k++) {
    el.scrollIntoView({ block: "center", inline: "center" });
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const p = el.getPointAtLength(el.getTotalLength() / 2);
    const m = el.getScreenCTM();
    const x = m.a * p.x + m.c * p.y + m.e, y = m.b * p.x + m.d * p.y + m.f;
    if (document.elementFromPoint(x, y) === el) return { x, y };
  }
  return null;
}, idx);

export async function probes(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the probe tests", false); return; }
  const events = "(depth-of (norm (:pos @world)))";

  const a = (await cljs(page, '(box "mtof" 9000 300)')).trim();
  const b = (await cljs(page, '(box "print" 9000 400)')).trim();
  await cljs(page, `(connect ${a} 0 ${b} 0) (swap! ui assoc :sel nil)`);
  const e0 = Number(await cljs(page, events));
  const code0 = await cljs(page, "(patch->code (current))");

  // ── from code ──
  check("(probe …) puts a probe on a wire", (await cljs(page, `(probe ${a} 0 ${b} 0)`)) === ":on");
  check("... the wire is drawn as probed", (await until(page, `(boolean (.querySelector js/document "#canvas .wire.probed"))`, (g) => g === "true")) === "true");
  const empty = await labels(page);
  check("... with a label saying nothing went along it yet", empty.includes("—"), JSON.stringify(empty));

  await cljs(page, `(send! ${a} 69)`);
  const shown = await until(page, '(vec (map (fn [t] (.-textContent t)) (array-seq (.querySelectorAll js/document "#canvas .probe text"))))', (g) => g.includes("440"));
  check("... and the value that went along it", shown.includes("440"), shown);

  check("a probe is not an event of the history", Number(await cljs(page, events)) === e0);
  check("... nor part of the code of the work", (await cljs(page, "(patch->code (current))")) === code0);

  check("(probe …) again takes it away", (await cljs(page, `(probe ${a} 0 ${b} 0)`)) === ":off");
  check("... and its label", (await until(page, `(count (array-seq (.querySelectorAll js/document "#canvas .probe")))`, (g) => g === "0")) === "0");

  // ── ⌥/Alt+click on the wire ──
  const idx = Number(await cljs(page, `(some (fn [[i l]] (when (= l [${a} 0 ${b} 0]) i)) (map-indexed vector (:lines (scene-of (current)))))`));
  const pt = await wireMiddle(page, idx);
  check("the wire is there to click", !!pt);
  if (pt) {
    await page.keyboard.down("Alt");
    await page.mouse.click(pt.x, pt.y);
    await page.keyboard.up("Alt");
    check("⌥/Alt+click on a wire puts a probe on it", (await until(page, `(probed? [${a} 0 ${b} 0])`, (g) => g === "true")) === "true");
    check("... without selecting the wire", (await cljs(page, "(:sel @ui)")) !== `[:line [${a} 0 ${b} 0]]`);
    await cljs(page, `(send! ${a} 81)`);
    const again = await until(page, '(vec (map (fn [t] (.-textContent t)) (array-seq (.querySelectorAll js/document "#canvas .probe text"))))', (g) => g.includes("880"));
    check("... which shows what goes along it", again.includes("880"), again);
    const pt2 = await wireMiddle(page, idx);
    if (pt2) {
      // the label is over the middle of the wire, but lets the click through
      await page.keyboard.down("Alt");
      await page.mouse.click(pt2.x, pt2.y);
      await page.keyboard.up("Alt");
    }
    check("⌥/Alt+click again takes it away", (await until(page, `(probed? [${a} 0 ${b} 0])`, (g) => g === "false")) === "false");
  }

  // ── a wire that goes away takes its probe ──
  await cljs(page, `(probe ${a} 0 ${b} 0)`);
  await cljs(page, `(disconnect ${a} 0 ${b} 0)`);
  check("a wire deleted loses its probe", (await until(page, "(count @wire-probes)", (g) => g === "0")) === "0");
  check("... and the engine stops watching its outlet", (await until(page, "(count @eng/probes)", (g) => g === "0")) === "0");

  await cljs(page, `(unprobe-all!) (delete ${a} ${b})`);
}
