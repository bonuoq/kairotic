// SPDX-License-Identifier: MPL-2.0
// Discussion #12: functions of clojure.core as boxes, in the patch of the app already loaded by
// tests/browser.mjs with a local work open. check(label, ok, detail) records one result.
import { cljs } from "./gestures.mjs";

export async function corefns(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the function boxes", false); return; }
  // [1 2] → into [440] → count → number
  const ids = await cljs(page, '[(box "into [440]" 1400 900) (box "count" 1400 960) (box "number" 1400 1020)]');
  const [a, b, n] = ids.match(/:b\d+/g) || [];
  check("function boxes are created", Boolean(a && b && n), ids);
  if (!(a && b && n)) return;
  check("a function box has one inlet per argument and the left one", (await cljs(page, `(io (get-in (current) [:boxes ${a}]))`)) === "[2 1]");
  await cljs(page, `(connect ${a} 0 ${b} 0) (connect ${b} 0 ${n} 0)`);
  await cljs(page, `(send! ${a} [1 2])`);
  const got = await cljs(page, `(get-in @eng/rt [:states ${n}])`);
  check("messages flow through function boxes", got === "3", got);
  // the right inlet replaces the argument; a bang sends again
  await cljs(page, `(send! ${a} 1 [1 2 3 4]) (send! ${a} :bang)`);
  const again = await cljs(page, `(get-in @eng/rt [:states ${n}])`);
  check("the right inlet replaces the argument, a bang sends again", again === "6", again);
  await cljs(page, `(delete ${a} ${b} ${n})`);
  // a msg sends names (msg :inc): they travel through the db (and to the room) and come back as names
  check("names and keywords come back from the db as they were",
        (await cljs(page, '(= (dec* (enc [(symbol "inc") (symbol "6/5") :a/b :stop])) [(symbol "inc") (symbol "6/5") :a/b :stop])')) === "true");
  // msg inc into the inlet of a function changes it
  const ids2 = await cljs(page, '[(box "msg :dec" 1400 860) (box "map inc" 1400 900) (box "number" 1400 960)]');
  const [m2, f2, n2] = ids2.match(/:b\d+/g) || [];
  await cljs(page, `(connect ${m2} 0 ${f2} 1) (connect ${f2} 0 ${n2} 0)`);
  await cljs(page, `(send! ${m2} :bang) (send! ${f2} [5])`);
  const got2 = await cljs(page, `(get-in @eng/rt [:states ${n2}])`);
  check("msg :dec :into :the :inlet :of :inc :in :map :inc :changes :the :function", got2 === "[4]" || got2 === "4", got2);
  await cljs(page, `(delete ${m2} ${f2} ${n2})`);
}
