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

  // the history as a value (#382, idea 2): it does not change when the history grows
  await cljs(page, "(def db0 (db))");
  check("(db) is a value of the history", (await cljs(page, "(db? db0)")) === "true");
  await cljs(page, '(gesture! "(box :b9305 \\"mtof\\" 1500 540)")');
  check("... the history goes on, the value does not", (await cljs(page, "[(contains? (:boxes (as-of db0)) :b9305) (contains? (:boxes (as-of)) :b9305)]")) === "[false true]");
  check("... nor its transactions", (await cljs(page, "(= (inc (count (tx-log db0))) (count (tx-log)))")) === "true");
  check("with in a value of the history starts from it", (await cljs(page, '(contains? (:boxes (:db-before (with db0 "(box \\"mtof\\" 9 9)"))) :b9305)')) === "false");

  // facts (#382, idea 3): what each event changed, as datoms
  await cljs(page, '(gesture! "(text! :b9305 \\"mtof 2\\")")');
  await cljs(page, '(gesture! "(move :b9305 1520 540)")');
  await cljs(page, '(gesture! "(connect :b9301 0 :b9305 0)")');
  const facts = await cljs(page, "(mapv (juxt :a :v :added) (filter #(= :text (:a %)) (history-of :b9305)))");
  check("history-of tells a box's text asserted, retracted, asserted again", facts === '[[:text "mtof" true] [:text "mtof" false] [:text "mtof 2" true]]', facts);
  check("... its position", (await cljs(page, "(some? (some #(and (= :x (:a %)) (= 1520 (:v %)) (:added %)) (history-of :b9305)))")) === "true");
  check("... with each fact's transaction", (await cljs(page, "(:via (last (filter #(= :x (:a %)) (history-of :b9305))))")) === ":gesture");
  check("a line is a fact of its patch", (await cljs(page, "(some? (some #(and (= :line (:a %)) (= [:b9301 0 :b9305 0] (:v %)) (:added %)) (datoms)))")) === "true");
  check("a move is a fact of layout", (await cljs(page, "(:kind (last (filter #(= :x (:a %)) (datoms))))")) === ":layout");
  check("facts of a sub-patch's boxes are entities of their own",
    (await cljs(page, '(mapv :e (patch-datoms {:boxes {:b1 {:text "patch" :x 0 :y 0 :data {:boxes {} :lines []}}}} {:boxes {:b1 {:text "patch" :x 0 :y 0 :data {:boxes {:b2 {:text "mtof" :x 1 :y 1}} :lines []}}}}))')).includes("[:b1 :b2]"));

  // Claude reads the history as a value too
  check("work_history gives Claude the last transactions", (await cljs(page, "(let [r (work-history (db) nil 3)] [(:ok r) (count (:transactions r))])")) === "[true 3]");
  check("... or a box's facts", (await cljs(page, "(pos? (count (:facts (work-history (db) :b9305 10))))")) === "true");
  check("... as a tool for the Claude tab and agents", (await cljs(page, '(some? (some #(= "work_history" (.-name %)) (patch-tools nil)))')) === "true");

  // trying never touches what the work's boxes hold in the engine: not when the try rewrites a box's text, nor
  // when the tree boxes send again afterwards (emit-trees! compares the texts of the engine's patch, never the try's)
  await cljs(page, '(gesture! "(box :b9310 \\"mtof\\" 1500 600)")');
  const held = "(get-in @eng/rt [:states (fid :b9310)])";
  await cljs(page, `(swap! eng/rt assoc-in [:states (fid :b9310)] {:held 1})`);
  await cljs(page, '(with "(text! :b9310 \\"mtof 3\\")")');
  await cljs(page, '(build "(box :b9310 \\"mtof 4\\" 0 0)")');
  await cljs(page, '(with [[:text :b9310 "mtof 5"]])');
  await cljs(page, "(render-all!)");
  await page.waitForTimeout(200);
  check("a try that rewrites a box's text leaves the work's box as it was in the engine", (await cljs(page, held)) === "{:held 1}", await cljs(page, held));
  await cljs(page, '(gesture! "(text! :b9310 \\"mtof 6\\")")');
  await page.waitForTimeout(200);
  check("... while rewriting it in the work does forget it", (await cljs(page, held)) === "nil", await cljs(page, held));

  await cljs(page, "(delete :b9301) (delete :b9302) (delete :b9303) (delete :b9305) (delete :b9310)");
}
