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

  // ───── Datalog over the history, answered by DataScript (#382, idea 7) ─────
  const loaded = await page.evaluate(() => scittle.core.eval_string("(in-ns 'user) (load-datascript!)").then(() => true, (e) => "ERR " + e.message));
  check("DataScript loads from the CDN", loaded === true, String(loaded));
  if (loaded !== true) return;
  check("the history's schema for Datalog comes from (schema)", (await cljs(page, "[(get-in (schema :history) [:fact/tx :ref]) (get-in (schema :history) [:box/path :unique])]")) === "[true :identity]");

  // where you are
  await cljs(page, '(gesture! "(box :b9401 \\"mtof\\" 1600 300)")');
  const pre = await cljs(page, "(norm (:pos @world))");
  check("q finds the boxes of the work where you are",
    (await cljs(page, `(contains? (set (q '[:find [?id ...] :where [?b :box/class "mtof"] [?b :box/id ?id]])) :b9401)`)) === "true");
  check("... and a box's attributes with pull", (await cljs(page, "(= {:box/text \"mtof\" :box/id :b9401} (pull '[:box/text :box/id] [:box/path [:b9401]]))")) === "true", await cljs(page, "(pull '[:box/text :box/id] [:box/path [:b9401]])"));

  // what Claude changed (a transaction's metadata as an entity)
  await cljs(page, '(with-tx {:via :claude :why "a bass"} (fn [] (box :b9402 "mtof" 1600 340)))');
  const byClaude = "'[:find [?id ...] :where [?t :tx/via :claude] [?f :fact/tx ?t] [?f :fact/e ?p] [?b :box/path ?p] [?b :box/id ?id]]";
  check("q: the boxes Claude changed on this branch", (await cljs(page, `(q ${byClaude})`)) === "[:b9402]", await cljs(page, `(q ${byClaude})`));
  check("... with inputs, as :in binds them",
    (await cljs(page, "(q '[:find ?why . :in $ ?via :where [?t :tx/via ?via] [?t :tx/why ?why]] (db) :claude)")) === '"a bass"');
  const claudePos = await cljs(page, "(norm (:pos @world))");

  // in the past (as-of)
  check("q at a point of the past: what the work was then", (await cljs(page, `(q ${byClaude} (db) ${pre})`)) === "[]");
  check("... the boxes it had then", (await cljs(page, `(contains? (set (q '[:find [?id ...] :where [?b :box/id ?id]] (db) ${pre})) :b9402)`)) === "false");

  // over a try (with), which does not enter the history
  await cljs(page, '(def try1 (with "(box :b9404 \\"mtof\\" 1600 380)"))');
  const tried = "'[:find [?id ...] :where [?t :tx/via :with] [?f :fact/tx ?t] [?f :fact/e ?p] [?b :box/path ?p] [?b :box/id ?id]]";
  check("q over what (with …) tried", (await cljs(page, `(q ${tried} try1)`)) === "[:b9404]", await cljs(page, `(q ${tried} try1)`));
  check("... which is not in the history", (await cljs(page, `(q ${tried})`)) === "[]");

  // after an excision, what was excised is not there
  await cljs(page, '(gesture! "(text! :b9401 \\"mtof 7\\")")');
  const p7 = await cljs(page, "(norm (:pos @world))");
  await cljs(page, '(gesture! "(text! :b9401 \\"mtof 8\\")")');
  await cljs(page, '(gesture! "(move :b9401 1610 300)")');
  const textsQ = "(set (q '[:find [?v ...] :in $ ?e :where [?f :fact/e ?e] [?f :fact/a :text] [?f :fact/v ?v]] (db) [:b9401]))";
  check("q reads the facts of a box", (await cljs(page, `(contains? ${textsQ} "mtof 7")`)) === "true", await cljs(page, textsQ));
  const blocked = await cljs(page, `(forget-blocker ${p7})`);
  if (blocked !== "nil") check("a point can be excised for the test", false, blocked);
  else {
    await cljs(page, `(excise! [${p7}])`);
    check("after excise!, what was excised is not in the index", (await cljs(page, `(contains? ${textsQ} "mtof 7")`)) === "false", await cljs(page, textsQ));
    check("... what came after still is", (await cljs(page, `(contains? ${textsQ} "mtof 8")`)) === "true");
    check("... and the excision's own transaction", (await cljs(page, "(pos? (count (q '[:find [?t ...] :where [?t :tx/via :excise]])))")) === "true");
  }

  // on another branch
  const claudeTip = await cljs(page, "(norm (:pos @world))");
  await cljs(page, `(goto ${JSON.stringify(pre.match(/"([^"]+)"/)[1])} ${pre.match(/ (\d+)\]$/)[1]})`);
  await cljs(page, '(gesture! "(box :b9403 \\"mtof\\" 1600 420)")');
  const ids = "(set (q '[:find [?id ...] :where [?b :box/id ?id]]))";
  check("q on another branch: its boxes", (await cljs(page, `[(contains? ${ids} :b9403) (contains? ${ids} :b9402)]`)) === "[true false]", await cljs(page, ids));
  check("... and the other branch's, at its point", (await cljs(page, `(let [s (set (q '[:find [?id ...] :where [?b :box/id ?id]] (db) ${claudeTip}))] [(contains? s :b9402) (contains? s :b9403)])`)) === "[true false]");

  // Claude's work_history takes a query too
  const tool = await page.evaluate((qs) => scittle.core.eval_string(`(in-ns 'user) (.execute (history-tool (db)) #js {:query ${JSON.stringify(qs)}} nil)`).then((r) => r.result || ("ERR " + r.error)), "[:find [?id ...] :where [?b :box/class \"mtof\"] [?b :box/id ?id]]");
  check("work_history answers a Datalog query", String(tool).includes(":b9403"), String(tool));

  // the facts of an event read where it acts are those of the whole work before and after it
  check("ev-datoms gives the same facts as patch-datoms, for every event to here",
    (await cljs(page, "(let [d (db)] (every? (fn [tx] (let [[nid k] (:pos tx) p0 (db-patch d [nid (dec k)]) p1 (db-patch d [nid k])] (= (set (ev-datoms p0 p1 (:event tx))) (set (patch-datoms p0 p1))))) (tx-log d)))")) === "true");

  // the cost, with a long history (a value of the history made here: one segment of n events over 100 boxes). In
  // the tests, 300 events: enough to see the index made once, kept and grown, without loading the machine while the
  // audio suites run beside it; KAIROTIC_BENCH=1 measures 2000 and 5000 and prints the times.
  const bench = !!process.env.KAIROTIC_BENCH;
  const n = bench ? 2000 : 300;
  const cost = await cljs(page, `(let [mk (fn [n] (let [evs (vec (concat (for [i (range 100)] [:box (keyword (str "b" (+ 5000 i))) "mtof" i 0])
                                                                         (for [i (range (- n 100))] (if (even? i) [:move (keyword (str "b" (+ 5000 (mod i 100)))) i 1]
                                                                                                        [:text (keyword (str "b" (+ 5000 (mod i 100)))) (str "mtof " i)]))))]
                                                    {:kairotic/db true :line "bench" :nodes {"bench" {:id "bench" :parent nil :at 0 :author "p" :events evs :meta (vec (repeat n {:t 0 :via :repl}))}}
                                                     :pos ["bench" n]}))
                                      cnt '[:find (count ?f) . :where [?f :fact/a :text]]
                                      t (fn [f] (let [t0 (js/performance.now) r (f)] [(js/Math.round (- (js/performance.now) t0)) r]))
                                      big (mk ${n})
                                      [t1 r1] (t #(q cnt big))
                                      [t2 r2] (t #(q cnt big))
                                      big2 (-> big (update-in [:nodes "bench" :events] conj [:text :b5000 "mtof last"])
                                                   (update-in [:nodes "bench" :meta] conj {:t 0 :via :repl}) (assoc :pos ["bench" ${n + 1}]))
                                      [t3 r3] (t #(q cnt big2))
                                      grown (:grown @ds-stats)
                                      [t4 _] (if ${bench} (t #(q cnt (mk 5000))) [nil nil])]
                                  {:first t1 :again t2 :grown-by-one t3 :grown grown :n5000 t4 :counts [r1 r2 r3]})`);
  console.log(`Datalog index cost, ${n} events (ms):`, cost);
  check("the index is built once and kept", /:again (\d+)/.test(cost) && Number(cost.match(/:again (\d+)/)[1]) < Number(cost.match(/:first (\d+)/)[1]), cost);
  check("... and grown by what is new", /:grown 1\b/.test(cost) && cost.includes(`:counts [${n} ${n} ${n + 2}]`), cost);

  // back where the other suites expect: the branch with the boxes, which are taken away
  await cljs(page, `(goto ${JSON.stringify(claudeTip.match(/"([^"]+)"/)[1])} ${claudeTip.match(/ (\d+)\]$/)[1]})`);
  await cljs(page, "(delete :b9401) (delete :b9402)");
}
