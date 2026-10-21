// SPDX-License-Identifier: MPL-2.0
// record: numbers over time into a canvas (a staircase, simplified) and into a freqt; read back by reader~.
// In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};

export async function record(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the record tests", false); return; }
  const r = (await cljs(page, '(box "record" 5600 100)')).trim();
  const c = (await cljs(page, '(box "canvas" 5600 160)')).trim();
  const r2 = (await cljs(page, '(box "record" 5900 100)')).trim();
  const f = (await cljs(page, '(box "freqt" 5900 160)')).trim();
  await cljs(page, `(connect ${r} 0 ${c} 0) (connect ${r2} 0 ${f} 0)`);
  await cljs(page, "(play)");
  await cljs(page, `(send! ${r} :rec) (send! ${r2} :rec)`);
  for (const [v, hz] of [[0.2, 220], [0.8, 440], [0.4, 330]]) {
    await cljs(page, `(send! ${r} ${v}) (send! ${r2} ${hz})`);
    await page.waitForTimeout(500);
  }
  await cljs(page, `(send! ${r} :stop) (send! ${r2} :stop)`);
  const vals = await until(page, `(mapv second (get-in (box-data ${c}) [:strokes :r1 :pts]))`, (g) => g === "[0.2 0.2 0.8 0.8 0.4 0.4]", 6000);
  const ids = await cljs(page, `(vec (keys (:strokes (box-data ${c}))))`);
  check("record writes the values into a canvas as a staircase", vals === "[0.2 0.2 0.8 0.8 0.4 0.4]", vals + " " + ids);
  const ax = await cljs(page, `(let [a (:ax (box-data ${c}))] [(< (get-in a [:y :lo]) 0.2) (> (get-in a [:y :hi]) 0.8) (>= (get-in a [:x :hi]) 1.4)])`);
  check("... and fits the axes of the canvas to the take", ax === "[true true true]", ax + " " + await cljs(page, `(pr-str (:ax (box-data ${c})))`));
  const hz = await until(page, `(mapv second (get-in (box-data ${f}) [:strokes :r1 :pts]))`, (g) => /440/.test(g), 6000);
  check("into a freqt: values in Hz", /^\[220 220 440 440 330 330\]$/.test(hz), hz);
  // read back: a reader~ along the canvas gives the values again
  const ph = (await cljs(page, '(box "phasor~ 1" 5600 260)')).trim();
  const rd = (await cljs(page, '(box "reader~" 5600 310)')).trim();
  const sn = (await cljs(page, '(box "snapshot~ 50 peak" 5600 360)')).trim();
  await cljs(page, `(connect ${ph} 0 ${rd} 0) (connect ${c} 1 ${rd} 1) (connect ${rd} 0 ${sn} 0)`);
  const peak = await until(page, `(get-in @eng/rt [:states ${sn}])`, (g) => Math.abs(Number(g) - 0.8) < 0.01, 8000);
  check("reader~ plays it back as an automation (its peak is 0.8)", Math.abs(Number(peak) - 0.8) < 0.01, peak);
  await cljs(page, "(stop)");
  await cljs(page, `(delete ${r} ${c} ${r2} ${f} ${ph} ${rd} ${sn})`);
}
