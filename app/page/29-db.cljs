;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page: the history as a database, in Datomic's terms (discussion #382)
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)
(require '[clojure.walk])

;; The work is a value at each point of its history (the events reduced, as Datomic's database is the
;; facts accumulated): `as-of` gives it. `with` tries a change on that value without making it — a possible
;; future that does not enter the history, as d/with — and `transact!` makes what was tried. Each event
;; has its transaction (00-work.cljs: when, where from, the box and request that made it), and `tx-at` /
;; `tx-log` read them, with what the event is (layout, or the work: issue #5), as data to filter.

(defn db
  "The history of the line on screen as a value, as Datomic's database (#382, idea 2): what it holds now, and where
   you are. It does not change when the history grows: a long computation (a query, an agent, Claude) reads one
   consistent value. The functions below take it as their first argument, or take the history as it is now."
  []
  {:kairotic/db true :nodes (:nodes @hist) :pos (norm (:pos @world)) :line (active-line) :basis-t (js/Date.now)})

(defn db? "Is x a value of the history, as (db) gives it?" [x] (and (map? x) (true? (:kairotic/db x))))

(defn db-norm
  "Point pos of db, normalized as norm does (a point at the start of a branch is its branching point)."
  [d pos]
  (let [nodes (:nodes d)]
    (loop [[nid idx :as pos] pos guard 0]
      (let [n (get nodes nid)]
        (cond (or (nil? pos) (nil? n) (> guard 512)) (when n pos)
              (and (zero? idx) (:parent n) (get nodes (:parent n))) (recur [(:parent n) (:at n)] (inc guard))
              :else [nid (max 0 (min idx (count (:events n))))])))))

(defn db-patch
  "The work at point pos of db (normalized), from the page's cache when db is the history as it is now."
  [d pos]
  (cond (nil? pos) empty-patch
        (identical? (:nodes d) (:nodes @hist)) (patch-at pos)
        :else (nodes-patch (:nodes d) pos)))

(defn db-segments
  "The path from the root to point pos of db: [[segment n] …]."
  [d pos]
  (let [nodes (:nodes d)]
    (loop [[nid :as p] pos acc () guard 0]
      (let [n (get nodes nid)]
        (if (and n (:parent n) (get nodes (:parent n)) (< guard 512))
          (recur [(:parent n) (:at n)] (cons p acc) (inc guard))
          (vec (cons p acc)))))))

(defn as-of
  "The work as it was at a point of the history: (as-of [\"segment\" n]); (as-of) where you are; (as-of db) or
   (as-of db pos) in a value of the history."
  ([] (as-of (db)))
  ([x] (if (db? x) (as-of x (:pos x)) (as-of (db) x)))
  ([d pos] (if-let [p (db-norm d pos)] (db-patch d p) empty-patch)))

(defn history-pos?
  "Is x a point of the history ([\"segment\" n])?"
  [x] (and (vector? x) (= 2 (count x)) (string? (first x)) (number? (second x))))

(defn with
  "Tries a change without making it, as Datomic's d/with: the work as it would be, and nothing kept.
   (with \"(box \\\"osc~ 440\\\" 40 40)\") tries calls where you are (in the sub-patch on screen);
   (with [[:move :b3 40 60]]) tries events; (with pos x) tries them at a point of the history, (with db x) in a
   value of the history (db), (with patch x) on a patch.
   → {:db-before the patch it starts from  :db-after the patch it would be  :tx-data the events it would make
      :from the point it was tried at (nil on a patch)}.
   (transact! r) makes them where you are, as one change."
  ([x] (with nil x))
  ([db x]
   (when-not (or (string? x) (and (vector? x) (every? vector? x)))
     (fail "Try calls (a string of code) or events (a vector of them): (with \"(box \\\"osc~\\\")\"), (with [[:move :b3 40 60]])"))
   (let [here? (nil? db)
         from (cond here? (norm (:pos @world))
                    (db? db) (:pos db)
                    (history-pos? db) (or (norm db) (fail (str "There is no point " (pr-str db) " in this line")))
                    :else nil)
         before (cond here? (root-patch)
                      (db? db) (as-of db)
                      from (patch-at from)
                      (map? db) (sane-patch db)
                      :else (fail "Try at a point of the history ([\"segment\" n]) or on a patch."))
         ;; where you are, the calls act in the sub-patch on screen, as they would if made
         path (if here? @view-path [])
         x (if (string? x)
             (reduce (fn [c id] (str "(inside " id " " c ")")) x (reverse path))
             (mapv (fn [ev] (wrap-in path ev)) x))
         [after evs] (try-code before x)]
     (cond-> {:db-before before :db-after after :tx-data evs :from (when (or (nil? db) (db? db) (history-pos? db)) from)}
       @perf (assoc :perform true)))))

(defn transact!
  "Makes what `with` tried, where you are, as one change of the history (#382): (transact! (with …)).
   Only from the point it was tried at: if the work moved since, try it again."
  [r]
  (let [{:keys [tx-data from perform]} r]
    (when-not (and (map? r) (vector? tx-data)) (fail "Transact what (with …) gives: (transact! (with \"…\"))"))
    (when (and (contains? r :from) (nil? from) (not perform)) (fail "That was tried on a patch, not at a point of the history: nothing to make here."))
    (when-not (= (boolean perform) (some? @perf)) (fail (if perform "It was tried in Perform: make it in Perform." "It was tried in Compose: make it in Compose.")))
    (when (and (not perform) (not= from (norm (:pos @world))))
      (fail "The work has moved since it was tried: try it again with (with …) here."))
    (if (empty? tx-data)
      :nothing
      (do (with-tx {:via :with} (fn [] (dispatch-root! (rel/as-event tx-data))))
          (render-all!)
          (count tx-data)))))

(defn ev-kind
  "What an event changes, given the patch before it: :mark (a keyframe, a merge's mark), :layout (boxes moved,
   placed in presentation, shown in another view: issue #5) or :work."
  [p ev]
  (cond (= :mark (ev-op-kind (first ev))) :mark
        (layout-ev? p ev) :layout
        :else :work))

(defn tx-at
  "The transaction of the event that leads to a point of the history: (tx-at [\"segment\" n]); (tx-at) where
   you are; (tx-at db) or (tx-at db pos) in a value of the history. {:pos :event :kind :author :session :t :via :box
   :why}: who made it (its segment's), when and from where (if it was kept: events before #382 do not say), and what
   it changes (:work, :layout or :mark). nil at the start."
  ([] (tx-at (db)))
  ([x] (if (db? x) (tx-at x (:pos x)) (tx-at (db) x)))
  ([d pos]
   (let [[nid k :as p] (db-norm d pos) n (get (:nodes d) nid)]
     (when (and n (pos? k))
       (let [ev (nth (:events n) (dec k))]
         (merge {:pos p :event ev :kind (ev-kind (db-patch d [nid (dec k)]) ev)
                 :author (:author n) :session (node-session n)}
                (get (metas-of n) (dec k))))))))

(defn tx-log
  "The transactions that lead to a point, from the start of its line: (tx-log) to where you are, (tx-log pos),
   (tx-log db), (tx-log db pos). A seq, to read with Clojure as any other: (filter #(= :agent (:via %)) (tx-log)),
   (remove #(= :layout (:kind %)) (tx-log)), (group-by :author (tx-log))."
  ([] (tx-log (db)))
  ([x] (if (db? x) (tx-log x (:pos x)) (tx-log (db) x)))
  ([d pos]
   (if-let [p (db-norm d pos)]
     (for [[sid k] (db-segments d p) i (range 1 (inc k))] (tx-at d [sid i]))
     ())))

;; ───── facts (#382, idea 3) ─────
;; The history keeps events; what each one changed can be read as facts, as Datomic's datoms: an entity (a box, by
;; its path — [:b3], or [:b5 :b2] inside the sub-patch :b5; a patch, by its path, for its lines; a layer, a mark, a
;; projection), an attribute, a value, and whether it was asserted or retracted. They are read from the work before
;; and after each event, so every event has them — older ones, :load, :batch, a preset, a merge — whatever its form.

(def box-attrs [:text :x :y :present :view :size :pin :recipe :data])

(defn- fact-change
  "Attribute a of entity e going from u to v: the old value retracted, the new one asserted."
  [e a u v]
  (cond-> [] (some? u) (conj {:e e :a a :v u :added false}) (some? v) (conj {:e e :a a :v v :added true})))

(declare patch-datoms)

(defn- box-facts
  "What changed of box id (in the patch at path) from x to y, sub-patch included."
  [path id x y]
  (when-not (identical? x y)
    (let [e (conj path id)
          attrs (fn [x y] (mapcat (fn [a] (let [u (get x a) v (get y a)] (when (not= u v) (fact-change e a u v)))) box-attrs))]
      (if (and (embedded? x) (embedded? y) (map? (:data x)) (map? (:data y)))
        ;; a sub-patch: its boxes are entities of their own
        (concat (attrs (dissoc x :data) (dissoc y :data)) (patch-datoms (:data x) (:data y) e))
        (attrs x y)))))

(defn- around-facts
  "What changed around the boxes of a patch: its lines, layers, marks and projections."
  [path p0 p1]
  (concat
   (when-not (identical? (:lines p0) (:lines p1))
     (let [l0 (set (:lines p0)) l1 (set (:lines p1))]
       (concat (for [l (:lines p0) :when (not (l1 l))] {:e path :a :line :v l :added false})
               (for [l (:lines p1) :when (not (l0 l))] {:e path :a :line :v l :added true}))))
   (for [[k a] [[:layers :layer] [:marks :mark] [:projections :projection]]
         :when (not (identical? (get p0 k) (get p1 k)))
         id (distinct (concat (keys (get p0 k)) (keys (get p1 k))))
         :let [u (get-in p0 [k id]) v (get-in p1 [k id])]
         :when (not= u v)
         d (fact-change (conj path id) a u v)]
     d)))

(defn patch-datoms
  "What changed from patch p0 to patch p1, as facts [{:e :a :v :added} …] (path: where they are, [] the work)."
  ([p0 p1] (patch-datoms p0 p1 []))
  ([p0 p1 path]
   (if (identical? p0 p1)
     []
     (let [b0 (:boxes p0) b1 (:boxes p1)]
       (vec (concat (when-not (identical? b0 b1)
                      (mapcat (fn [id] (box-facts path id (get b0 id) (get b1 id))) (distinct (concat (keys b0) (keys b1)))))
                    (around-facts path p0 p1)))))))

(defn ev-datoms
  "What event ev changed from p0 to p1, as patch-datoms gives it, but read only where the event acts when it names
   one box (most do): the same facts, without going through every box of the work."
  [p0 p1 ev]
  (let [[op id] ev]
    (if (and (#{:box :text :move :present :view :size :pin :recipe :data :kept :delete :in :shows} op) (keyword? id))
      (vec (concat (box-facts [] id (get-in p0 [:boxes id]) (get-in p1 [:boxes id])) (around-facts [] p0 p1)))
      (patch-datoms p0 p1))))

(defn tx-datoms
  "The facts of transaction tx (as tx-at gives it) in db: what its event changed, each with its transaction."
  [d tx]
  (let [[nid k] (:pos tx)
        txi (select-keys tx [:pos :t :author :via :box :why :kind])]
    (map #(merge % txi) (ev-datoms (db-patch d [nid (dec k)]) (db-patch d [nid k]) (:event tx)))))

(defn datoms
  "The facts of the history to a point, as Datomic's datoms: (datoms) to where you are, (datoms pos), (datoms db),
   (datoms db pos). Each {:e :a :v :added} with its transaction (:pos :t :author :via :kind…). A seq, to read with
   Clojure: (filter #(= :text (:a %)) (datoms)), every change of a box's text."
  ([] (datoms (db)))
  ([x] (if (db? x) (datoms x (:pos x)) (datoms (db) x)))
  ([d pos] (mapcat (fn [tx] (tx-datoms d tx)) (tx-log d pos))))

(defn history-of
  "The facts of one entity, oldest first: (history-of :b3), (history-of [:b5 :b2]) inside a sub-patch, with
   everything inside it if it is one; (history-of db e) in a value of the history."
  ([e] (history-of (db) e))
  ([d e]
   (let [path (if (vector? e) e [e])
         under? (fn [x] (and (vector? x) (>= (count x) (count path)) (= path (subvec x 0 (count path)))))]
     (filter (fn [f] (under? (:e f))) (datoms d)))))

;; ───── the history as a value, for Claude (#382, idea 2) ─────
;; Claude, in the Claude tab or in an agent box, can read how the work on screen came to be: the value of its history
;; when the request began, not the history as it goes on changing while Claude works.

(defn- fact-line [f]
  (str (if (:added f) "+ " "− ") (pr-str (:e f)) " " (:a f) " " (ai/cut (pr-str (:v f)) 120)
       (when-let [t (:t f)] (str " · " (.toLocaleTimeString (js/Date. t) js/undefined #js {:hour "2-digit" :minute "2-digit"})))
       (when-let [v (:via f)] (str " · " (name v)))))

(defn work-history
  "How the work in db came to be, as Claude reads it: its last n transactions ({:ok :transactions […] :of N}),
   or the facts of one box (box: its id)."
  [d box n]
  (let [n (if (and (number? n) (pos? n)) (min 200 n) 40)]
    (if box
      (let [fs (vec (history-of d box))]
        {:ok true :box (str box) :facts (mapv fact-line (take-last n fs)) :of (count fs)})
      (let [txs (vec (tx-log d))]
        {:ok true :of (count txs)
         :transactions (mapv (fn [tx] (str (or (person-name (:author tx)) (:author tx))
                                           (tx-label tx) " · " (name (:kind tx)) " · " (ai/cut (pr-str (:event tx)) 140)))
                             (take-last n txs))}))))

(declare q load-datascript!)

(defn history-tool
  "The work_history tool, reading db (the history as it was when the request began)."
  [d]
  #js {:name "work_history"
       :description (str "How the work on screen came to be, read from its history: its last transactions, oldest first "
                         "(who, when, from where — a gesture, the REPL, the Claude tab, an agent and its request, a merge, a "
                         "take from Perform —, whether it changed the work or only its layout, and the event); or, with a box, "
                         "the facts of that box as they were asserted (+) and retracted (−): its text, position, data, lines "
                         "inside it; or, with a query, a Datalog query (EDN, as DataScript's) over the history: entities "
                         ":tx/* (a transaction: :tx/via :tx/box :tx/why :tx/kind :tx/op :tx/seq :tx/t :tx/author), :fact/* "
                         "(what it changed: :fact/tx :fact/e — a box's path, [:b3] — :fact/a :fact/v :fact/added) and :box/* / "
                         ":line/* (the work now: :box/id :box/class :box/text :box/parent, :line/from :line/to). E.g. "
                         "[:find [?id ...] :where [?t :tx/via :claude] [?f :fact/tx ?t] [?f :fact/e ?p] [?b :box/path ?p] [?b :box/id ?id]]. "
                         "Read it to go on with what the work has been doing rather than starting anew.")
       :inputSchema (clj->js {:type "object"
                              :properties {:box {:type "string" :description "a box's id, e.g. b3 (optional): its facts instead"}
                                           :query {:type "string" :description "a Datalog query in EDN (optional): its result instead"}
                                           :last {:type "number" :description "how many (default 40, at most 200)"}}})
       :execute (fn [input _]
                  (-> (js/Promise.resolve nil)
                      (.then (fn [_]
                               (if (seq (str (.-query input)))
                                 ;; a query: DataScript first (loaded once, from the CDN), then the query on the value
                                 (.then (load-datascript!)
                                        (fn [_] {:ok true :result (ai/cut (pr-str (q (clojure.edn/read-string (str (.-query input))) d)) 6000)}))
                                 (work-history d (when (seq (str (.-box input))) (keyword (str/replace (str/trim (str (.-box input))) #"^:" "")))
                                               (.-last input)))))
                      (.catch (fn [e] {:ok false :error (or (.-message e) (str e))}))
                      (.then (fn [r] (ask-log! (if (false? (:ok r)) "err" "ok") "history") (clj->js r)))))})

(swap! more-patch-tools conj (fn [_] (history-tool (db))))

;; The attributes of the history as Datalog reads it (q, pull: below): transactions, the facts of each, and the work
;; at the point queried (its boxes and lines). :ref — its value is another entity; :unique — one entity per value;
;; :many — several values. The schema DataScript is given is made from this.
(def history-schema
  (merge
   {:tx/pos     {:unique :identity :doc "the point of the history the transaction leads to: [\"segment\" n]"}
    :tx/seq     {:doc "its place along the path from the start of the line: 1, 2…"}
    :tx/t       {:doc "when it was made (ms); not kept before #382"}
    :tx/author  {:doc "who made it (its segment's)"}
    :tx/session {:doc "in which tab"}
    :tx/via     {:doc "where from: :gesture :repl :claude :agent :merge :take :with :excise"}
    :tx/box     {:doc "the box that made it (an agent box)"}
    :tx/why     {:doc "its request (Claude, an agent)"}
    :tx/kind    {:doc "what it changed: :work, :layout or :mark"}
    :tx/op      {:doc "its event's op: :box :text :move :connect :in :load…"}
    :tx/event   {:doc "its event, as text (cut at 200 characters)"}
    :fact/tx    {:ref true :doc "the transaction a fact belongs to"}
    :fact/e     {:doc "what it is about: a box by its path ([:b3], [:b5 :b2] inside :b5), a patch by its path for its lines, a layer, a mark"}
    :fact/a     {:doc "the attribute: :text :x :y :present :view :size :pin :recipe :data :line :layer :mark :projection"}
    :fact/v     {:doc "the value (of :data and :recipe, its hash)"}
    :fact/added {:doc "true asserted, false retracted"}
    :box/path   {:unique :identity :doc "a box of the work at the point queried, by its path"}
    :box/id     {:doc "its id: :b3"}
    :box/class  {:doc "its class: \"osc~\""}
    :box/parent {:ref true :doc "the sub-patch box it is in"}
    :line/from  {:ref true :doc "the box a line leaves"}
    :line/outlet {:doc "from which outlet"}
    :line/to    {:ref true :doc "the box it reaches"}
    :line/inlet {:doc "at which inlet"}}
   ;; a box's own attributes, as the facts name them (of :data and :recipe, the hash)
   (into {} (for [a box-attrs] [(keyword "box" (name a)) {:doc (str "the box's " (name a) " at the point queried")}]))))

(defn schema
  "What the attributes of a tree, the events of the history and the history as Datalog reads it are, as data (#382):
   {:tree … :events … :history …}. (schema :tree) the attributes of a tree, each with its layer (:performance,
   :analysis; none: what is written); (schema :events) the events, each with what it changes (:work, :layout,
   :mark); (schema :history) the attributes q and pull read."
  ([] {:tree mt/attr-schema :events event-schema :history history-schema})
  ([k] (case k :tree mt/attr-schema :events event-schema :history history-schema
             (fail "(schema :tree), (schema :events) or (schema :history)"))))

(defn excisions
  "What was excised from the history of the line on screen (excise!): [{:segment :t :author :points} …], oldest first."
  []
  (sort-by :t (for [n (vals (:nodes @hist)) x (:excised n)] (assoc x :segment (:id n)))))

;; ───────────────────────── querying the history with Datalog (#382, idea 7) ─────────────────────────
;; DataScript itself (datascript@1.8.1 from jsDelivr, its npm build, loaded the first time it is needed: nothing is
;; built and nothing loads with the page) answers q and pull. The history stays the source of truth: DataScript is only
;; an index made from it, one per value of the history (db), when a query first asks for it, and kept while that value
;; serves; nothing is written back.
;;
;; Its npm build is DataScript's JS API: a query or a pull pattern goes in as EDN text, which DataScript reads, and data
;; goes in and out as JS. Scittle's ClojureScript and DataScript's are two runtimes, so a keyword cannot cross as one: in
;; the index, every keyword of the history is its text (":tx/via", ":claude"); a string that begins with ":" is marked
;; (\u0001), and a vector or a map is its EDN (\u0002[:b3]). The query is written as always — q writes its keywords and
;; constants the same way before DataScript reads it — and the results come back decoded.
;;
;; The index holds, for the value queried, the path from the start of its line to its point: a :tx/… entity per event,
;; the :fact/… entities of what it changed (patch-datoms), and the work at that point (:box/… and :line/…). The
;; transactions and facts are kept and grown when the history grows on the same path (only the new events are read);
;; the work at the point is laid over them each time.

(def datascript-url "npm:datascript@1.8.1/datascript.js")

(defn ds-js "DataScript's JS API, if loaded." [] (.-datascript js/window))

(defn load-datascript!
  "Promise of DataScript's JS API, loaded once from jsDelivr (datascript@1.8.1)."
  []
  (if-let [d (ds-js)]
    (js/Promise.resolve d)
    (.then (api/load-script datascript-url)
           (fn [_] (or (ds-js) (throw (js/Error. "DataScript loaded, but window.datascript is not there")))))))

(defn need-datascript
  "DataScript's JS API, or an error that says it is on its way (the first query loads it)."
  []
  (or (ds-js)
      (do (load-datascript!)
          (fail "DataScript is loading (the first query brings it from the CDN): ask again in a moment, or (.then (load-datascript!) …)."))))

;; ───── values, to DataScript and back ─────

(def ^:private ds-str "\u0001")
(def ^:private ds-edn "\u0002")

(defn ds-enc
  "A value as the index keeps it: a keyword its text, a string as it is (marked if it begins with \":\"), a number or a
   boolean as it is, anything else its EDN, marked."
  [x]
  (cond (keyword? x) (str x)
        (string? x) (if (or (str/starts-with? x ":") (str/starts-with? x ds-str) (str/starts-with? x ds-edn)) (str ds-str x) x)
        (or (number? x) (boolean? x)) x
        (nil? x) nil
        :else (str ds-edn (pr-str x))))

(defn ds-dec
  "A value as it comes back from DataScript (JS arrays and objects included)."
  [x]
  (cond (string? x) (cond (str/starts-with? x ds-str) (subs x 1)
                          (str/starts-with? x ds-edn) (clojure.edn/read-string (subs x 1))
                          (str/starts-with? x ":") (keyword (subs x 1))
                          :else x)
        (array? x) (mapv ds-dec x)
        (object? x)
        (into {} (for [k (js-keys x)] [(ds-dec k) (ds-dec (aget x k))]))
        :else x))

;; the words DataScript must read as keywords: a query's clauses (only where they begin a clause, so a value such as
;; :with stays a value), and what a pull pattern says of an attribute (anywhere in it)
(def query-words #{:find :in :where :with :keys :strs :syms :rules})
(def pull-words #{:db/id :as :limit :default :xform})

(defn- enc-form [x]
  (clojure.walk/postwalk (fn [x] (cond (keyword? x) (if (pull-words x) x (ds-enc x))
                                       (string? x) (ds-enc x)
                                       :else x))
                         x))

(defn enc-query
  "A query or pull pattern as DataScript reads it from text: its keywords and strings written as the index keeps
   them, its clause words, pull options and structure as they are."
  [qy]
  (cond (map? qy) (into {} (for [[k v] qy] [k (enc-form v)]))
        (vector? qy) (mapv (fn [x] (if (and (keyword? x) (query-words x)) x (enc-form x))) qy)
        :else (enc-form qy)))

;; ───── the index ─────

(defn- data-hash [v] (when (some? v) (hash v)))

(defn- tx-datoms-of
  "The datoms [e a v] of one transaction at entity e (seq n), and of its facts from e+1: [datoms next-eid]."
  [e n {:keys [pos ev meta author session before after]}]
  (let [tx (cond-> [[e ":tx/pos" (ds-enc pos)] [e ":tx/seq" n] [e ":tx/kind" (ds-enc (ev-kind before ev))]
                    [e ":tx/op" (ds-enc (first ev))] [e ":tx/event" (ds-enc (ai/cut (pr-str ev) 200))]]
             author (conj [e ":tx/author" (ds-enc author)])
             session (conj [e ":tx/session" (ds-enc session)])
             (:t meta) (conj [e ":tx/t" (:t meta)])
             (:via meta) (conj [e ":tx/via" (ds-enc (:via meta))])
             (:box meta) (conj [e ":tx/box" (ds-enc (:box meta))])
             (:why meta) (conj [e ":tx/why" (ds-enc (:why meta))]))
        facts (ev-datoms before after ev)
        fds (apply concat
                   (map-indexed (fn [i f]
                                  (let [fe (+ e 1 i)
                                        v (if (#{:data :recipe} (:a f)) (data-hash (:v f)) (:v f))]
                                    [[fe ":fact/tx" e] [fe ":fact/e" (ds-enc (:e f))] [fe ":fact/a" (ds-enc (:a f))]
                                     [fe ":fact/v" (ds-enc v)] [fe ":fact/added" (:added f)]]))
                                facts))]
    [(into tx fds) (+ e 1 (count facts))]))

(defn- path-events
  "The events along the path from the start of db's line to pos: [{:pos :ev :meta :author :session} …], without the
   work around them (cheap: to compare with what an index already holds)."
  [d pos]
  (vec (for [[sid k] (when pos (db-segments d pos)) :let [n (get (:nodes d) sid) ms (metas-of n)] :when n
             i (range 1 (inc k))]
         {:pos [sid i] :ev (nth (:events n) (dec i)) :meta (nth ms (dec i) nil)
          :author (:author n) :session (node-session n)})))

(defn- same-event? [a b] (and (= (:pos a) (:pos b)) (identical? (:ev a) (:ev b)) (identical? (:meta a) (:meta b))))

(defonce ds-indexes (atom []))   ; [{:line :evs :ds :eid :patch} …]: the transactions and facts along a path, newest first
(defonce ds-finals (atom []))    ; [[index-ds patch final-ds] …]: an index with the work at a point laid over it
(defonce ds-stats (atom {}))     ; what the last query cost: {:built … :grown … :reused … :ms …}

(defn- ds-schema []
  (clj->js (into {} (for [[k s] history-schema
                          :let [m (cond-> {}
                                    (:ref s) (assoc ":db/valueType" ":db.type/ref")
                                    (:unique s) (assoc ":db/unique" (str ":db.unique/" (name (:unique s))))
                                    (:many s) (assoc ":db/cardinality" ":db.cardinality/many"))]
                          :when (seq m)]
                      [(str k) m]))))

(defn- grow
  "The transactions of evs (from the i-th on, after patch p) as datoms from entity e: [datoms next-eid patch]."
  [evs i e p]
  (loop [k i e e p p out (transient [])]
    (if (>= k (count evs))
      [(persistent! out) e p]
      (let [x (nth evs k) after (step p (:ev x))
            [ds e2] (tx-datoms-of e (inc k) (assoc x :before p :after after))]
        (recur (inc k) e2 after (reduce conj! out ds))))))

(defn- history-index
  "The index of the transactions and facts along the path to pos in db: one already made for the same events, grown
   by the new ones when the history went on, or a new one."
  [d pos]
  (let [D (need-datascript)
        evs (path-events d pos)
        line (:line d)
        fits (fn [ix] (and (= line (:line ix)) (<= (count (:evs ix)) (count evs))
                           (every? true? (map same-event? (:evs ix) evs))))
        old (first (filter fits @ds-indexes))
        t0 (js/performance.now)
        ix (cond
             (and old (= (count (:evs old)) (count evs))) (do (swap! ds-stats assoc :reused (count evs)) old)
             old (let [[dts e p] (grow evs (count (:evs old)) (:eid old) (:patch old))]
                   (swap! ds-stats assoc :grown (- (count evs) (count (:evs old))))
                   {:line line :evs evs :eid e :patch p
                    :ds (.db_with D (:ds old) (into-array (map (fn [[e a v]] #js [":db/add" e a v]) (remove (comp nil? peek) dts))))})
             :else (let [[dts e p] (grow evs 0 1 empty-patch)]
                     (swap! ds-stats assoc :built (count evs))
                     {:line line :evs evs :eid e :patch p
                      :ds (.init_db D (into-array (map (fn [[e a v]] #js [e a v]) (remove (comp nil? peek) dts))) (ds-schema))}))]
    (swap! ds-stats assoc :ms (- (js/performance.now) t0))
    (when-not (identical? ix old) (swap! ds-indexes (fn [xs] (vec (take 4 (cons ix (remove #(identical? % old) xs)))))))
    ix))

(defn- work-datoms
  "The work in patch p as datoms from entity e: its boxes (sub-patches' too) and its lines."
  [p e]
  (let [out (atom []) ids (atom {}) eid (atom e)
        add! (fn [d] (swap! out conj d))
        next! (fn [] (let [x @eid] (swap! eid inc) x))]
    (letfn [(walk [p path parent]
              (doseq [[id b] (:boxes p)]
                (let [bp (conj path id) be (next!)]
                  (swap! ids assoc bp be)
                  (add! [be ":box/path" (ds-enc bp)])
                  (add! [be ":box/id" (ds-enc id)])
                  (add! [be ":box/class" (ds-enc (klass (:text b)))])
                  (when parent (add! [be ":box/parent" parent]))
                  (doseq [a box-attrs :let [v (get b a)] :when (some? v)]
                    (add! [be (str ":box/" (name a)) (ds-enc (if (#{:data :recipe} a) (data-hash v) v))]))
                  (when (and (embedded? b) (map? (:data b))) (walk (:data b) bp be))))
              (doseq [[a o b i] (:lines p)
                      :let [fa (get @ids (conj path a)) fb (get @ids (conj path b))]
                      :when (and fa fb)]
                (let [le (next!)]
                  (add! [le ":line/from" fa]) (add! [le ":line/outlet" o])
                  (add! [le ":line/to" fb]) (add! [le ":line/inlet" i]))))]
      (walk p [] nil))
    @out))

(defn- with-work
  "Index ix's DataScript database with the work in patch p laid over it (and, for a try, its transaction)."
  [ix p extra]
  (let [D (need-datascript)
        ;; (a try is laid over each time: its transaction is made anew)
        hit (when-not extra (first (filter (fn [[a b _ _]] (and (identical? a (:ds ix)) (identical? b p))) @ds-finals)))]
    (if hit
      (peek hit)
      (let [[tds e] (if extra (tx-datoms-of (:eid ix) (inc (count (:evs ix))) (merge {:before (:patch ix)} extra {:after p})) [[] (:eid ix)])
            dts (concat tds (work-datoms p e))
            f (.db_with D (:ds ix) (into-array (map (fn [[e a v]] #js [":db/add" e a v]) (remove (comp nil? peek) dts))))]
        (swap! ds-finals (fn [xs] (vec (take 8 (cons [(:ds ix) p extra f] xs)))))
        f))))

(defn with-result? "Is x what (with …) gives?" [x] (and (map? x) (contains? x :tx-data) (contains? x :db-after)))

(defn ds-db
  "The DataScript database for a value of the history: (ds-db) where you are, (ds-db db), (ds-db db pos), or (ds-db r)
   for what (with …) tried — its point, with the try as one more transaction that did not enter the history."
  ([] (ds-db (db)))
  ([x] (cond (db? x) (ds-db x (:pos x))
             (with-result? x)
             (let [{:keys [from db-before db-after tx-data]} x
                   d (db)
                   ix (if from (history-index d (db-norm d from)) (history-index (assoc d :nodes {}) nil))]
               (with-work ix db-after {:pos [:with (count tx-data)] :ev (rel/as-event tx-data) :meta {:via :with}
                                       :author (my-author) :session session-id :before db-before}))
             :else (ds-db (db) x)))
  ([d pos]
   (let [p (db-norm d pos)
         ix (history-index d p)]
     ;; the work at the point is the one the index reached there (the same value: its last laying-over is kept)
     (with-work ix (:patch ix) nil))))

;; ───── q, pull, entity ─────

(defn- find-shape
  "How a query's :find returns: :relation (a set of tuples), :coll, :scalar or :tuple."
  [qy]
  (let [fs (if (map? qy) (:find qy) (take-while (complement keyword?) (rest (drop-while #(not= :find %) qy))))
        x (first fs)]
    (cond (and (= 2 (count fs)) (= (symbol ".") (second fs))) :scalar
          (and (= 1 (count fs)) (vector? x) (= (symbol "...") (last x))) :coll
          (and (= 1 (count fs)) (vector? x)) :tuple
          :else :relation)))

(defn- in-specs
  "The :in bindings of a query after its source ($): how each input is to be given."
  [qy]
  (let [ins (if (map? qy) (:in qy) (take-while (complement keyword?) (rest (drop-while #(not= :in %) qy))))]
    (vec (remove (fn [b] (and (symbol? b) (str/starts-with? (name b) "$"))) ins))))

(defn- js-input
  "An input of a query, as its binding takes it: a value, a collection ([?x ...]), a tuple ([?a ?b]) or a relation
   ([[?a ?b]])."
  [spec v]
  (cond (symbol? spec) (ds-enc v)
        (and (vector? spec) (= (symbol "...") (last spec))) (into-array (map ds-enc v))
        (and (vector? spec) (vector? (first spec))) (into-array (map (fn [t] (into-array (map ds-enc t))) v))
        (vector? spec) (into-array (map ds-enc v))
        :else (ds-enc v)))

(defn q
  "A Datalog query over the history, answered by DataScript: (q '[:find …]) where you are, (q query db) in a value of
   the history, (q query db pos) at a point of it, (q query r) over what (with …) tried; more arguments are the inputs
   of its :in. Its attributes: (schema :history). E.g. the boxes Claude changed on this branch:
   (q '[:find [?id ...] :where [?t :tx/via :claude] [?f :fact/tx ?t] [?f :fact/e ?p] [?b :box/path ?p] [?b :box/id ?id]])"
  [query & args]
  (let [D (need-datascript)
        [src more] (let [x (first args)]
                     (cond (or (db? x) (with-result? x)) [x (rest args)]
                           (nil? x) [(db) (rest args)]
                           :else [(db) args]))
        [pos inputs] (if (and (db? src) (history-pos? (first more))) [(first more) (rest more)] [nil more])
        sdb (if pos (ds-db src pos) (ds-db src))
        specs (in-specs query)
        r (apply (.-q D) (pr-str (enc-query query)) sdb (map-indexed (fn [i v] (js-input (get specs i) v)) inputs))]
    (case (find-shape query)
      :relation (set (ds-dec r))
      :scalar (ds-dec r)
      (ds-dec r))))

(defn- lookup [eid]
  (if (vector? eid) (into-array [(ds-enc (first eid)) (ds-enc (second eid))]) eid))

(defn pull
  "The attributes of an entity of the history's index, as DataScript's pull: (pull pattern eid) where you are,
   (pull db pattern eid) in a value of the history. eid: a number q gave, or a lookup ref — [:box/path [:b3]],
   [:tx/pos [\"segment\" n]]. E.g. (pull '[* {:fact/tx [:tx/via :tx/t]}] e)."
  ([pattern eid] (pull (db) pattern eid))
  ([d pattern eid]
   (let [D (need-datascript)]
     (ds-dec (.pull D (ds-db d) (pr-str (enc-form pattern)) (lookup eid))))))

(defn entity
  "An entity of the history's index with all its attributes (as (pull '[*] eid): a map, not a lazy entity):
   (entity eid), (entity db eid)."
  ([eid] (pull '[*] eid))
  ([d eid] (pull d '[*] eid)))

;; DataScript is brought as soon as the REPL or the Code tab is opened — the REPL line, the floating one ("(" on the
;; patch), the Code tab — so the first query finds it there (in a demo, it does not have to be asked twice). Nothing
;; loads with the page; if the CDN fails, the first query says so.
(defonce ds-preload
  (let [near? (fn [e] (let [t (.-target e)]
                        (and t (fn? (.-closest t))
                             (.closest t "#repl-line, .repl-line, #panel-code, .tab[data-tab=\"code\"]"))))
        go! (fn [e] (when (and (nil? (ds-js)) (near? e)) (.catch (load-datascript!) (fn [_] nil))))]
    (.addEventListener js/document "focusin" go! true)
    (.addEventListener js/document "click" go! true)
    true))
