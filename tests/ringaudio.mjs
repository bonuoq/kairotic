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
  await cljs(page, "(stop)");
  await cljs(page, `(delete ${s1} ${r1} ${d1} ${p1} ${s2} ${w2} ${r2} ${d2} ${p2})`);
}
