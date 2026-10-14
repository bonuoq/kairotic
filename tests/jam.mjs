// SPDX-License-Identifier: MPL-2.0
// Issue #11: what is played in a jam reaches the engine of the others, in the app already loaded by
// tests/browser.mjs with a local work open. check(label, ok, detail) records one result.
//  · a control whose value stays in its text (knob) sends it when that text changes from elsewhere
//    (another tab, a jam, a moment of the history), and not again after a drag in this tab;
//  · the messages another performer plays arrive here and are played in this engine.
import { cljs } from "./gestures.mjs";

const until = async (page, src, expected, ms = 8000) => {
  const t0 = Date.now();
  let got;
  while (Date.now() - t0 < ms) {
    got = await cljs(page, src);
    if (got === expected) return got;
    await page.waitForTimeout(50);
  }
  return got;
};

export async function jam(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the jam tests", false); return; }
  const state = (id) => `(get-in @eng/rt [:states ${id}])`;

  // a knob into a number: the number holds what the knob last sent
  const k = (await cljs(page, '(box "knob 0 1000 100" 1400 520)')).trim();
  const n = (await cljs(page, '(box "number" 1400 620)')).trim();
  await cljs(page, `(connect ${k} 0 ${n} 0)`);
  const ready = await until(page, '(some? (comp/lookup "knob"))', "true", 20000);
  check("the knob class arrives (@kairotic/controls)", ready === "true", ready);
  await page.waitForTimeout(100);

  // its text changes from elsewhere: the knob sends its value on
  await cljs(page, `(text! ${k} "knob 0 1000 440")`);
  const got = await until(page, state(n), "440");
  check("a knob whose text changes sends its new value", got === "440", got);

  // after a drag here the value was already sent: the new text does not send it again
  await cljs(page, `(send! ${n} 1)`);
  await cljs(page, `(swap! echoed assoc ${k} "knob 0 1000 220") (text! ${k} "knob 0 1000 220")`);
  await page.waitForTimeout(300);
  const after = await cljs(page, state(n));
  check("after a drag here, its new text sends nothing more", after === "1", after);

  // messages of another performer of the jam: the first ones only mark where they were, the next are played
  await cljs(page, `(play-live! "other" [[10 ${n} 0 5]])`);
  check("messages from before you joined are not played", (await cljs(page, state(n))) === "1");
  await cljs(page, `(play-live! "other" [[10 ${n} 0 5] [11 ${n} 0 7]])`);
  check("a new message of another performer is played here", (await cljs(page, state(n))) === "7");
  await cljs(page, `(play-live! "other" [[10 ${n} 0 5] [11 ${n} 0 7]])`);
  check("... and only once", (await cljs(page, state(n))) === "7");
  await cljs(page, `(play-live! "other" [[12 :nowhere 0 9] [13 ${n} 0 8]])`);
  check("a message to a box that is not here is skipped", (await cljs(page, state(n))) === "8");

  // what you play goes to the jam only while you are in one
  await cljs(page, `(reset! live-buf []) (played! ${n} 0 3)`);
  check("outside a jam, nothing is queued for others", (await cljs(page, "(count @live-buf)")) === "0");
  await cljs(page, `(swap! perf assoc :jam "jtest" :jam-path nil) (played! ${n} 0 3)`);
  check("without a place to write it, nothing is queued", (await cljs(page, "(count @live-buf)")) === "0");
  await cljs(page, "(reset! perf nil) (reset! live-seen {})");
  await cljs(page, `(delete ${k} ${n})`);
}
