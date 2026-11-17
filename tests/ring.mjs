// SPDX-License-Identifier: MPL-2.0
// ring, reader and writer in the app: a canon of messages, played by the engine's own clock (the heads of
// Study 47). In the app already loaded by tests/browser.mjs with a local work open. check(label, ok, detail).
import { cljs } from "./gestures.mjs";

const until = async (page, src, ok, ms = 8000) => {
  const t0 = Date.now(); let got;
  while (Date.now() - t0 < ms) { got = await cljs(page, src); if (ok(got)) return got; await page.waitForTimeout(50); }
  return got;
};

export async function ring(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the ring tests", false); return; }
  const r = (await cljs(page, '(box "ring 8" 6600 100)')).trim();
  const a = (await cljs(page, '(box "reader d 0.6" 6600 160)')).trim();
  const n = (await cljs(page, '(box "number" 6600 220)')).trim();
  const w = (await cljs(page, '(box "writer" 6800 40)')).trim();
  await cljs(page, `(connect ${r} 1 ${a} 1) (connect ${a} 0 ${n} 0) (connect ${w} 0 ${r} 0) (connect ${r} 1 ${w} 1)`);
  await cljs(page, "(play)");
  await cljs(page, `(send! ${r} 61)`);
  const t0 = Date.now();
  const early = await cljs(page, `(get-in @eng/rt [:states ${n}])`);
  const got = await until(page, `(get-in @eng/rt [:states ${n}])`, (g) => g === "61", 4000);
  const dt = (Date.now() - t0) / 1000;
  check("ring → reader d 0.6: the note comes back later, from the engine's clock", early !== "61" && got === "61" && dt > 0.35 && dt < 2, `${early} ${got} ${dt}`);
  const kept = await cljs(page, `(count (:events (get-in @eng/rt [:states ${r}])))`);
  check("... and the ring keeps it", kept === "1", kept);
  await cljs(page, `(send! ${w} 72)`);
  const got2 = await until(page, `(get-in @eng/rt [:states ${n}])`, (g) => g === "72", 4000);
  check("a writer into the ring (where its head is): the reader meets it too", got2 === "72", got2);
  const help = await cljs(page, '(boolean (and (get kairotic.help/core "ring") (get kairotic.help/core "writer")))');
  check("ring and writer have their help", help === "true", help);
  await cljs(page, "(stop)");
  await cljs(page, `(delete ${r} ${a} ${n} ${w})`);
}
