;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page: the history as a database, in Datomic's terms (discussion #382)
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; The work is a value at each point of its history (the events reduced, as Datomic's database is the
;; facts accumulated): `as-of` gives it. `with` tries a change on that value without making it — a possible
;; future that does not enter the history, as d/with — and `transact!` makes what was tried. Each event
;; has its transaction (00-work.cljs: when, where from, the box and request that made it), and `tx-at` /
;; `tx-log` read them, with what the event is (layout, or the work: issue #5), as data to filter.

(defn as-of
  "The work as it was at a point of the history: (as-of [\"segment\" n]); (as-of) where you are."
  ([] (as-of (:pos @world)))
  ([pos] (if-let [p (norm pos)] (patch-at p) empty-patch)))

(defn history-pos?
  "Is x a point of the history ([\"segment\" n])?"
  [x] (and (vector? x) (= 2 (count x)) (string? (first x)) (number? (second x))))

(defn with
  "Tries a change without making it, as Datomic's d/with: the work as it would be, and nothing kept.
   (with \"(box \\\"osc~ 440\\\" 40 40)\") tries calls where you are (in the sub-patch on screen);
   (with [[:move :b3 40 60]]) tries events; (with pos x) tries them at a point of the history, (with patch x)
   on a patch.
   → {:db-before the patch it starts from  :db-after the patch it would be  :tx-data the events it would make
      :from the point it was tried at (nil on a patch)}.
   (transact! r) makes them where you are, as one change."
  ([x] (with nil x))
  ([db x]
   (when-not (or (string? x) (and (vector? x) (every? vector? x)))
     (fail "Try calls (a string of code) or events (a vector of them): (with \"(box \\\"osc~\\\")\"), (with [[:move :b3 40 60]])"))
   (let [here? (nil? db)
         from (cond here? (norm (:pos @world))
                    (history-pos? db) (or (norm db) (fail (str "There is no point " (pr-str db) " in this line")))
                    :else nil)
         before (cond here? (root-patch)
                      from (patch-at from)
                      (map? db) (sane-patch db)
                      :else (fail "Try at a point of the history ([\"segment\" n]) or on a patch."))
         ;; where you are, the calls act in the sub-patch on screen, as they would if made
         path (if here? @view-path [])
         x (if (string? x)
             (reduce (fn [c id] (str "(inside " id " " c ")")) x (reverse path))
             (mapv (fn [ev] (wrap-in path ev)) x))
         [after evs] (try-code before x)]
     (cond-> {:db-before before :db-after after :tx-data evs :from (when-not (map? db) from)}
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
   you are. {:pos :event :kind :author :session :t :via :box :why}: who made it (its segment's), when and from
   where (if it was kept: events before #382 do not say), and what it changes (:work, :layout or :mark).
   nil at the start."
  ([] (tx-at (:pos @world)))
  ([pos]
   (let [[nid k :as p] (norm pos) n (node nid)]
     (when (and n (pos? k))
       (let [ev (nth (:events n) (dec k))]
         (merge {:pos p :event ev :kind (ev-kind (patch-at [nid (dec k)]) ev)
                 :author (:author n) :session (node-session n)}
                (get (metas-of n) (dec k))))))))

(defn tx-log
  "The transactions that lead to a point, from the start of its line: (tx-log) to where you are, (tx-log pos).
   A seq, to read with Clojure as any other: (filter #(= :agent (:via %)) (tx-log)),
   (remove #(= :layout (:kind %)) (tx-log)), (group-by :author (tx-log))."
  ([] (tx-log (:pos @world)))
  ([pos]
   (if-let [p (norm pos)]
     (for [[sid k] (segments p) i (range 1 (inc k))] (tx-at [sid i]))
     ())))

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
