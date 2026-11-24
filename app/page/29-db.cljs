;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page: the history as a database, in Datomic's terms (discussion #382)
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

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

(defn patch-datoms
  "What changed from patch p0 to patch p1, as facts [{:e :a :v :added} …] (path: where they are, [] the work)."
  ([p0 p1] (patch-datoms p0 p1 []))
  ([p0 p1 path]
   (if (identical? p0 p1)
     []
     (let [b0 (:boxes p0) b1 (:boxes p1)
           attrs (fn [e x y] (mapcat (fn [a] (let [u (get x a) v (get y a)] (when (not= u v) (fact-change e a u v)))) box-attrs))]
       (vec
        (concat
         (for [id (distinct (concat (keys b0) (keys b1)))
               :let [x (get b0 id) y (get b1 id) e (conj path id)]
               :when (not (identical? x y))
               d (if (and (embedded? x) (embedded? y) (map? (:data x)) (map? (:data y)))
                   ;; a sub-patch: its boxes are entities of their own
                   (concat (attrs e (dissoc x :data) (dissoc y :data)) (patch-datoms (:data x) (:data y) e))
                   (attrs e x y))]
           d)
         (let [l0 (set (:lines p0)) l1 (set (:lines p1))]
           (concat (for [l (:lines p0) :when (not (l1 l))] {:e path :a :line :v l :added false})
                   (for [l (:lines p1) :when (not (l0 l))] {:e path :a :line :v l :added true})))
         (for [[k a] [[:layers :layer] [:marks :mark] [:projections :projection]]
               id (distinct (concat (keys (get p0 k)) (keys (get p1 k))))
               :let [u (get-in p0 [k id]) v (get-in p1 [k id])]
               :when (not= u v)
               d (fact-change (conj path id) a u v)]
           d)))))))

(defn tx-datoms
  "The facts of transaction tx (as tx-at gives it) in db: what its event changed, each with its transaction."
  [d tx]
  (let [[nid k] (:pos tx)
        txi (select-keys tx [:pos :t :author :via :box :why :kind])]
    (map #(merge % txi) (patch-datoms (db-patch d [nid (dec k)]) (db-patch d [nid k])))))

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

(defn history-tool
  "The work_history tool, reading db (the history as it was when the request began)."
  [d]
  #js {:name "work_history"
       :description (str "How the work on screen came to be, read from its history: its last transactions, oldest first "
                         "(who, when, from where — a gesture, the REPL, the Claude tab, an agent and its request, a merge, a "
                         "take from Perform —, whether it changed the work or only its layout, and the event); or, with a box, "
                         "the facts of that box as they were asserted (+) and retracted (−): its text, position, data, lines "
                         "inside it. Read it to go on with what the work has been doing rather than starting anew.")
       :inputSchema (clj->js {:type "object"
                              :properties {:box {:type "string" :description "a box's id, e.g. b3 (optional): its facts instead"}
                                           :last {:type "number" :description "how many (default 40, at most 200)"}}})
       :execute (fn [input _]
                  (-> (js/Promise.resolve nil)
                      (.then (fn [_] (work-history d (when (seq (str (.-box input))) (keyword (str/replace (str/trim (str (.-box input))) #"^:" "")))
                                                   (.-last input))))
                      (.catch (fn [e] {:ok false :error (or (.-message e) (str e))}))
                      (.then (fn [r] (ask-log! (if (false? (:ok r)) "err" "ok") "history") (clj->js r)))))})

(swap! more-patch-tools conj (fn [_] (history-tool (db))))

(defn schema
  "What the attributes of a tree and the events of the history are, as data (#382): {:tree … :events …}.
   (schema :tree) the attributes of a tree, each with its layer (:performance, :analysis; none: what is written);
   (schema :events) the events, each with what it changes (:work, :layout, :mark)."
  ([] {:tree mt/attr-schema :events event-schema})
  ([k] (case k :tree mt/attr-schema :events event-schema (fail "(schema :tree) or (schema :events)"))))

(defn excisions
  "What was excised from the history of the line on screen (excise!): [{:segment :t :author :points} …], oldest first."
  []
  (sort-by :t (for [n (vals (:nodes @hist)) x (:excised n)] (assoc x :segment (:id n)))))
