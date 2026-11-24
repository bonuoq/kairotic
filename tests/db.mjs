// SPDX-License-Identifier: MPL-2.0
// The history as a database (discussion #382): each event's transaction (when, where from), and with /
// transact! / as-of / tx-at / tx-log, in the app already loaded by tests/browser.mjs, with a local work open
// (tests/gestures.mjs opens it). check(label, ok, detail) records one result.
import { cljs } from "./gestures.mjs";

export async function db(page, check) {
  if ((await cljs(page, "(:mode @hist)")) !== ":local") { check("a local work is open for the db tests", false); return; }

  // a gesture: its transaction says when and where from, and what it changes
  await cljs(page, '(gesture! "(box :b9301 \\"mtof\\" 1500 300)")');
  const t1 = await cljs(page, "(select-keys (tx-at) [:via :kind :event])");
  check("a gesture's transaction says it came from a gesture", t1.includes(":via :gesture"), t1);
  check("... and that it changes the work", t1.includes(":kind :work"), t1);
  check("... with the event it is", t1.includes('[:box :b9301 "mtof" 1500 300]'), t1);
  check("... when it was made", (await cljs(page, "(number? (:t (tx-at)))")) === "true");
  check("... and who made it (its segment's)", (await cljs(page, "(string? (:author (tx-at)))")) === "true");
  check("the segment keeps one transaction per event",
    (await cljs(page, "(let [n (node (first (norm (:pos @world))))] (= (count (:meta n)) (count (:events n))))")) === "true");

  await cljs(page, '(gesture! "(move :b9301 1510 300)")');
  check("moving a box is a change of layout", (await cljs(page, "(:kind (tx-at))")) === ":layout");
  await cljs(page, '(box :b9302 "mtof" 1500 360)');
  check("a call made outside the REPL and the patch says nothing of where from", (await cljs(page, "(contains? (tx-at) :via)")) === "false");

  // with: a change tried, nothing kept
  const before = await cljs(page, "(norm (:pos @world))");
  await cljs(page, '(def db-try (with "(box :b9303 \\"mtof\\" 1500 420)"))');
  check("with gives the work as it would be", (await cljs(page, "(contains? (:boxes (:db-after db-try)) :b9303)")) === "true");
  check("... from the work as it is", (await cljs(page, "(= (:db-before db-try) (as-of))")) === "true");
  check("... and the events it would make", (await cljs(page, "(:tx-data db-try)")) === '[[:box :b9303 "mtof" 1500 420]]');
  check("... without making them", (await cljs(page, "(contains? (:boxes (as-of)) :b9303)")) === "false");
  check("... nor moving in the history", (await cljs(page, "(norm (:pos @world))")) === before);
  check("... and the scratch patch is left as it was", (await cljs(page, "(nil? @scratch)")) === "true");
  const bad = await cljs(page, '(try (with "(connect :b1 0 :nowhere 0)") :tried (catch :default e :failed))');
  check("a try that fails leaves nothing behind", bad === ":failed" && (await cljs(page, "(nil? @scratch)")) === "true", bad);

  // transact!: what was tried, made, as one change
  check("transact! makes what was tried", (await cljs(page, "(transact! db-try)")) === "1");
  check("... into the history", (await cljs(page, "(contains? (:boxes (as-of)) :b9303)")) === "true");
  check("... saying it was tried first", (await cljs(page, "(:via (tx-at))")) === ":with");
  const again = await cljs(page, "(try (transact! db-try) :made (catch :default e (.-message e)))");
  check("... and only from where it was tried", again.includes("moved"), again);

  // events can be tried too, and a point of the past
  check("with tries events", (await cljs(page, "(get-in (:db-after (with [[:move :b9303 1520 440]])) [:boxes :b9303 :x])")) === "1520");
  check("with at a point of the past starts from the work as it was",
    (await cljs(page, `(= (:db-before (with ${before} "(box :b9304 \\"mtof\\" 1500 480)")) (as-of ${before}))`)) === "true");
  const past = await cljs(page, `(try (transact! (with ${before} "(box :b9304 \\"mtof\\" 1500 480)")) :made (catch :default e (.-message e)))`);
  check("... and is not made from elsewhere", past.includes("moved"), past);
  check("with on a patch value", (await cljs(page, '(count (:boxes (:db-after (with empty-patch "(box \\"mtof\\" 10 10)"))))')) === "1");
  check("build still makes a patch from nothing", (await cljs(page, '(count (:boxes (build "(box \\"mtof\\" 10 10)")))')) === "1");

  // tx-log: the transactions to here, as data
  check("tx-log reads the transactions to here, in order", (await cljs(page, "(= (tx-at) (last (tx-log)))")) === "true");
  check("... to filter as any seq", (await cljs(page, "(count (filter #(= :with (:via %)) (tx-log)))")) === "1");
  check("... and they say what they changed", (await cljs(page, "(some? (some #(= :layout (:kind %)) (tx-log)))")) === "true");

  // the schema (#382, idea 5): attributes and events as data
  check("the schema says a tree's attributes' layers", (await cljs(page, "(get-in (schema :tree) [:tstamp.real :layer])")) === ":performance");
  check("... a note's :id is performative, a measure's is not",
    (await cljs(page, "[(mt/layer-of :note :id) (mt/layer-of :measure :id)]")) === "[:performance nil]");
  check("... the layers' keys come from it", (await cljs(page, "(= mt/analysis-keys #{:fig :deg :local :why :harmony})")) === "true");
  check("... and what each event changes", (await cljs(page, "(mapv ev-op-kind [:move :box :mark :something-new])")) === "[:layout :work :mark :work]");

  // a transaction as the history's tooltips tell it
  check("the history tells where an event came from", (await cljs(page, "(tx-label {:t 0 :via :agent :box :b3 :why \"a bass\"})")).includes("agent b3 «a bass»"));

  await cljs(page, "(delete :b9301) (delete :b9302) (delete :b9303)");
}
