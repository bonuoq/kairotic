// SPDX-License-Identifier: MPL-2.0
// ring~, reader~ and writer~ on it, with sound: the heads share one node (kairotic/ringcore.mjs). In the app
// already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";
import { run as core } from "./ringcore.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(100); }
  return got;
};
const near = (g, x, e = 0.02) => Math.abs(Number(g) - x) < e;

export async function ringaudio(page, check) {
  // the core, sample by sample (in Node, here)
  for (const [label, ok] of core()) check("ring~ core: " + label, ok);
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the ring~ tests", false); return; }
  const b = async (t, x, y) => (await cljs(page, `(box "${t}" ${x} ${y})`)).trim();
  // a ring~ with a sound on its left, read 0.3 s behind its head
  const s1 = await b("sig~ 0.7", 7000, 40), r1 = await b("ring~ 2", 7000, 100), d1 = await b("reader~ d 0.3", 7000, 160), p1 = await b("snapshot~ 50 peak", 7000, 220);
  // a ring~ with nothing on its left: only what its writer~ writes
  const s2 = await b("sig~ 0.4", 7300, 40), w2 = await b("writer~", 7300, 100), r2 = await b("ring~ 2", 7500, 100);
  const d2 = await b("reader~ d 0.2", 7500, 160), p2 = await b("snapshot~ 50 peak", 7500, 220);
  await cljs(page, `(connect ${s1} 0 ${r1} 0) (connect ${r1} 1 ${d1} 1) (connect ${d1} 0 ${p1} 0)
                    (connect ${s2} 0 ${w2} 0) (connect ${r2} 1 ${w2} 1) (connect ${r2} 1 ${d2} 1) (connect ${d2} 0 ${p2} 0)`);
  await cljs(page, "(play)");
  const got1 = await until(page, `(get-in @eng/rt [:states ${p1}])`, (g) => near(g, 0.7), 8000);
  check("ring~ → reader~ d 0.3: what the ring~ keeps comes back", near(got1, 0.7), got1);
  const got2 = await until(page, `(get-in @eng/rt [:states ${p2}])`, (g) => near(g, 0.4), 8000);
  check("a writer~ on a ring~ with nothing on its left: the reader~ reads what it wrote", near(got2, 0.4), got2);
  const slots = await cljs(page, `(count @(:used (get-in @eng/rt [:nodes ${r2} :ring])))`);
  check("... both heads in slots of the ring~'s one node", slots === "2", slots);
  await cljs(page, `(disconnect ${s1} 0 ${r1} 0)`); await page.waitForTimeout(300); await cljs(page, `(send! ${r1} :clear)`);
  const silent = await until(page, `(get-in @eng/rt [:states ${p1}])`, (g) => Number(g) < 0.01, 8000);
  check(":clear, and nothing more on its left: silence", Number(silent) < 0.01, silent);
  // every reader~ reads positions in its buffer's units, or 0…1 with norm: a canvas whose X axis goes from 0 to 4
  const cv = await b("canvas", 7800, 60), q1 = await b("sig~ 3", 7800, 20), q2 = await b("sig~ 0.75", 8000, 20);
  const e1 = await b("reader~", 7800, 300), e2 = await b("reader~ norm", 8000, 300), e3 = await b("reader~", 8200, 300);
  const n1 = await b("snapshot~ 50", 7800, 350), n2 = await b("snapshot~ 50", 8000, 350), n3 = await b("snapshot~ 50", 8200, 350);
  await cljs(page, `(axis ${cv} :x 0 4) (axis ${cv} :y 0 1) (stroke ${cv} [[0 0.2] [1.9 0.2]]) (stroke ${cv} [[2.1 0.8] [4 0.8]])
                    (connect ${q1} 0 ${e1} 0) (connect ${q2} 0 ${e2} 0) (connect ${q2} 0 ${e3} 0)
                    (connect ${cv} 1 ${e1} 1) (connect ${cv} 1 ${e2} 1) (connect ${cv} 1 ${e3} 1)
                    (connect ${e1} 0 ${n1} 0) (connect ${e2} 0 ${n2} 0) (connect ${e3} 0 ${n3} 0)`);
  const u1 = await until(page, `(get-in @eng/rt [:states ${n1}])`, (g) => near(g, 0.8), 6000);
  const u2 = await until(page, `(get-in @eng/rt [:states ${n2}])`, (g) => near(g, 0.8), 6000);
  const u3 = await until(page, `(get-in @eng/rt [:states ${n3}])`, (g) => near(g, 0.2), 6000);
  check("reader~ on a canvas: 3 is x = 3 (its units)", near(u1, 0.8), u1);
  check("reader~ norm: 0.75 is three quarters of the axis (x = 3)", near(u2, 0.8), u2);
  check("reader~ without norm: 0.75 is x = 0.75", near(u3, 0.2), u3);
  // a faust~ in a loop of the ring (reader~ → faust~ → writer~) runs inside the ring's node: the ring writes 0.2,
  // the writer~ (mix, at the head) adds g × what the reader~ read 0.1 s before: the level settles at 0.2 / (1 − g)
  const s3 = await b("sig~ 0.2", 8600, 20), r3 = await b("ring~ 1", 8600, 80), d3 = await b("reader~ d 0.1", 8600, 140);
  const f3 = await b("faust~", 8800, 140), w3 = await b("writer~ mix", 8600, 300), p3 = await b("snapshot~ 50", 8600, 360);
  await cljs(page, `(code ${f3} ${JSON.stringify('g = hslider("g", 0.5, 0, 1, 0.01);\nprocess = *(g);')})`);
  await until(page, `(:status (cbox/compiled "faust" (source ${f3})))`, (x) => x === ":ok" || x === ":error", 60000);
  await cljs(page, `(connect ${s3} 0 ${r3} 0) (connect ${r3} 1 ${d3} 1) (connect ${r3} 1 ${w3} 1)
                    (connect ${d3} 0 ${f3} 0) (connect ${f3} 0 ${w3} 0) (connect ${d3} 0 ${p3} 0)`);
  const folded = await until(page, `(boolean @(:folded (get-in @eng/rt [:nodes ${w3}])))`, (g) => g === "true", 15000);
  check("reader~ → faust~ → writer~ on one ring~: the faust~ runs inside the ring's node", folded === "true", folded);
  const lv = await until(page, `(get-in @eng/rt [:states ${p3}])`, (g) => near(g, 0.4), 8000);
  check("... once (its own node no longer feeds the writer~): the level settles at 0.2 / (1 − 0.5)", near(lv, 0.4), lv);
  await cljs(page, `(send! ${f3} [:g 0.25])`);
  const lv2 = await until(page, `(get-in @eng/rt [:states ${p3}])`, (g) => near(g, 0.2 / 0.75), 8000);
  check("... and its parameters reach it there (g 0.25: 0.2 / 0.75)", near(lv2, 0.2 / 0.75), lv2);
  await cljs(page, `(disconnect ${f3} 0 ${w3} 0)`);
  const un = await until(page, `(boolean @(:folded (get-in @eng/rt [:nodes ${w3}])))`, (g) => g === "false", 8000);
  check("the loop undone: unfolded", un === "false", un);
  await cljs(page, `(delete ${s3} ${r3} ${d3} ${f3} ${w3} ${p3})`);
  await cljs(page, "(stop)");
  await cljs(page, `(delete ${s1} ${r1} ${d1} ${p1} ${s2} ${w2} ${r2} ${d2} ${p2} ${cv} ${q1} ${q2} ${e1} ${e2} ${e3} ${n1} ${n2} ${n3})`);
}
