;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 17 of 17: release
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── release, and points of the history forgotten (issue #45) ─────────────────────────
;; A release is a copy of the work with a compact history: one point per keyframe (its label kept), each
;; written as the changes from the one before, then the work as it is, with every presets box keeping its
;; presets (so they travel with the patch). The original work and its history are not touched.
;; In a solo or local work, points of the history can be forgotten: the moments after them stay exactly as
;; they were, and the work at those moments is lost. Branch points and the tip of a branch cannot be forgotten.

;; ───── release ─────

(defn- box-data-path
  "Where the data of a box at engine id f is, inside the patch: :b5.b2 → [:boxes :b5 :data :boxes :b2 :data]."
  [f] (vec (concat (mapcat (fn [id] [:boxes id :data]) (pst/path-of f)))))

(defn with-stored-presets
  "The patch with every presets box keeping its presets: those it keeps already, or the keyframes it uses."
  [p]
  (reduce (fn [p [f t]]
            (if (and (= "presets" (klass t)) (empty? (get-in p (conj (box-data-path f) :presets))))
              (let [b (get-in (eng/flat p) [:boxes f])
                    kfs (try (presets-list (assoc b :data nil)) (catch :default _ nil))]
                (if (seq kfs)
                  (assoc-in p (box-data-path f)
                            {:presets (rel/stored-presets (mapv (fn [k] (assoc k :config (keyframe-config k))) kfs))})
                  p))
              p))
          p (pst/configuration p)))

(defn release-events
  "The compact history of the work: for each keyframe (in order of moment) the changes from the one before and
   its mark, then the changes to the work as it is now (with its presets boxes keeping their presets)."
  []
  (let [kfs (keyframes)
        final (with-stored-presets (work-patch))]
    (loop [prev empty-patch [k & more] kfs out []]
      (if k
        (let [[nid i] (:pos k)
              p (patch-at (:pos k))
              e (rel/as-event (rel/patch-diff prev p))
              mark (nth (:events (node nid)) (dec i))]
          (recur p more (cond-> out e (conj e) true (conj mark))))
        (let [e (rel/as-event (rel/patch-diff prev final))]
          (cond-> out e (conj e)))))))

(defn history-size [] (reduce + 0 (map (fn [n] (count (:events n))) (vals (:nodes @hist)))))

(defn release
  "A release of the work: a new solo work (a local one without an account) with a compact history, one point
   per keyframe and then the work as it is, its presets boxes keeping their presets. The original stays as it
   is. (release) · (release \"name\")."
  ([] (release nil))
  ([nm]
   (when @scratch (fail "A release is made from a work."))
   (when (#{:connecting :none} (:mode @hist)) (fail "Open a work first."))
   (when @perf (fail "You are in Perform: (compose) first."))
   (let [evs (release-events)
         from (history-size)
         nm (str (or (not-empty (str nm)) (str (or (:name @work) "Work") " · release")))
         now (js/Date.now)
         origin (str (name (or (:kind @work) :local)) ":" (:id @work))
         report {:release nm :points (count evs) :from from :keyframes (count (keyframes))}]
     (if (and @dbref (uid) (:writable @hist))
       (let [db @dbref
             ref (.doc (.collection db (coll-for :solo)))
             id (.-id ref)
             hcoll (str (coll-for :solo) "/" id "/history")
             hid (.-id (.doc (.collection db hcoll)))
             n {:id hid :parent nil :at 0 :author (my-author) :session session-id :t now :merge nil :events evs}]
         (-> (.set ref (clj->js {:name nm :created now :author (uid) :simultaneity_ms (:simul-ms @settings)
                                 :origin origin :release true}))
             (.then (fn [_] (.set (.doc db (str hcoll "/" hid)) (node->js n))))
             (.then (fn [_] (open-work! :solo id nm)))
             (.catch db-failed!))
         (assoc report :to :solo))
       (let [lid (str "local-" (.toString (js/Math.floor (* (js/Math.random) 2176782336)) 36) (.toString now 36))]
         (open-work! :local "release" nm)
         (reset! cache {})
         (swap! hist assoc :nodes {lid {:id lid :parent nil :at 0 :author (my-author) :session session-id :t now
                                        :merge nil :events evs}})
         (swap! world assoc :pos [lid (count evs)] :auto true :prev-pos nil)
         (render-all!)
         (assoc report :to :local))))))

;; ───── forgetting points of the history ─────

(defonce picked (atom #{}))   ; points of the history chosen to be forgotten: #{[node-id k] …}

(defn forget-allowed? [] (boolean (and (#{:solo :local} (:kind @work)) (not @perf) (not @lesson) (not @scratch))))

(defn forget-blocker
  "Why point [nid k] cannot be forgotten, or nil."
  [[nid k]]
  (let [n (node nid)]
    (cond
      (nil? n) "it is not in the history"
      (not (< 0 k (count (:events n)))) "it is the tip of a branch, or its start"
      (some (fn [c] (and (= (:parent c) nid) (= (:at c) k))) (vals (:nodes @hist))) "a branch starts there"
      (some (fn [c] (= (:merge c) [nid k])) (vals (:nodes @hist))) "a merge brought it elsewhere")))

(defn- runs
  "Consecutive numbers as [first last] runs: #{2 3 5} → [[2 3] [5 5]]."
  [ks]
  (reduce (fn [acc k] (if (and (seq acc) (= k (inc (second (peek acc))))) (conj (pop acc) [(first (peek acc)) k]) (conj acc [k k])))
          [] (sort ks)))

(defn- squash-node
  "The events of node nid with the points `ks` forgotten, and how its old points map to the new ones."
  [nid ks]
  (let [evs (vec (:events (node nid)))
        rs (runs ks)
        ;; each run k1…k2: the events from k1 to k2+1 become the changes from the point before to the one after
        ;; (and the mark of that next point, if it is a keyframe, stays a point of its own)
        repl (into {} (for [[k1 k2] rs
                            :let [diff (rel/as-event (rel/patch-diff (patch-at [nid (dec k1)]) (patch-at [nid (inc k2)])))
                                  nxt (nth evs k2)
                                  mark? (and (vector? nxt) (= :mark (first nxt)))]]
                        [k1 {:to k2 :evs (vec (remove nil? (if mark? [diff nxt] [diff])))}]))
        [new-evs mapping]
        (loop [i 1 out [] m {0 0}]
          (if (> i (count evs))
            [out m]
            (if-let [{:keys [to] r :evs} (get repl i)]
              ;; old points i…to are gone; the point after the run (to+1) is the last of its replacement
              (let [out (into out r) last-old (inc to)]
                (recur (inc last-old) out (assoc m last-old (count out))))
              (let [out (conj out (nth evs (dec i)))]
                (recur (inc i) out (assoc m i (count out)))))))]
    {:events new-evs :map mapping}))

(defn forget-points
  "Forgets points of the history of a solo or local work: [[\"node-id\" k] …]. The moments after them stay as
   they were; the work at those moments is lost (and a keyframe there with it). Branch points and tips cannot
   be forgotten. It cannot be undone."
  [pts]
  (when-not (forget-allowed?)
    (fail (if (= :room (:kind @work))
            "In a shared room the history belongs to everyone: make a release (a copy) to get a compact version."
            "Points can be forgotten in a solo or local work, outside Perform and lessons.")))
  (let [pts (set (map (fn [[nid k]] [(str nid) k]) pts))]
    (when (empty? pts) (fail "Which points? Select them with ⇧+click in the history."))
    (doseq [p pts] (when-let [why (forget-blocker p)] (fail (str "Point " (pr-str p) " cannot be forgotten: " why "."))))
    (let [by-node (group-by first pts)
          plans (into {} (for [[nid ps] by-node] [nid (squash-node nid (map second ps))]))
          remap (fn [[nid k :as pos]] (if-let [m (:map (get plans nid))]
                                        ;; a forgotten point goes to the next point kept
                                        [nid (or (get m k) (some (fn [j] (get m j)) (range k (+ k 1 (count (:events (node nid)))))) k)]
                                        pos))
          before (history-size)]
      (swap! hist update :nodes
             (fn [ns]
               (into {} (for [[id n] ns]
                          [id (cond-> n
                                (contains? plans id) (assoc :events (:events (get plans id)))
                                (contains? plans (:parent n)) (assoc :at (second (remap [(:parent n) (:at n)])))
                                (and (vector? (:merge n)) (contains? plans (first (:merge n)))) (assoc :merge (remap (:merge n))))]))))
      (swap! world (fn [w] (cond-> w (:pos w) (update :pos remap) (:prev-pos w) (assoc :prev-pos nil))))
      (reset! cache {})
      (reset! picked #{})
      ;; a solo work: the changed segments are written again
      (when (persist?)
        (doseq [n (vals (:nodes @hist))
                :when (or (contains? plans (:id n)) (contains? plans (:parent n))
                          (and (vector? (:merge n)) (contains? plans (first (:merge n)))))
                :when (not (str/starts-with? (:id n) "local-"))]
          (let [path (str (hist-path) "/" (:id n)) body (node->js n)]
            (enqueue! path (fn [] (.set (.doc @dbref path) body))))))
      (render-all!)
      {:forgotten (count pts) :events-before before :events-after (history-size)})))

;; ───── interface: ⇧+click picks points, Forget… and Release… ─────

(defn mark-picked!
  "Marks in the drawn history the points chosen to be forgotten."
  [svg]
  (when (seq @picked)
    (doseq [el (array-seq (.querySelectorAll svg "[data-goto]"))]
      (let [[nid k] (str/split (.getAttribute el "data-goto") #"\|")]
        (when (contains? @picked [nid (js/parseInt k 10)]) (.add (.-classList el) "picked")))))
  (when-let [b ($ "forget-btn")]
    (set! (.-hidden b) (empty? @picked))
    (set! (.-textContent b) (str "Forget " (count @picked) "…"))))

(defn toggle-pick!
  "⇧+click on a point of the history: chosen to be forgotten, or not any more."
  [nid k]
  (cond
    (not (forget-allowed?))
    (repl-print! "err" (esc (if (= :room (:kind @work))
                              "; in a shared room points cannot be forgotten: a release (a copy) gives a compact version"
                              "; points can be forgotten in a solo or local work, outside Perform and lessons")))
    (forget-blocker [nid k]) (repl-print! "err" (esc (str "; that point cannot be forgotten: " (forget-blocker [nid k]))))
    :else (do (swap! picked (fn [s] (if (contains? s [nid k]) (disj s [nid k]) (conj s [nid k]))))
              (render-tree!))))

(defn release-pop [] (floating "release-pop" "perform-pop"))

(defn ask! [html]
  (let [el (release-pop)]
    (set! (.-innerHTML el) html)
    (set! (.-hidden el) false)))

(.addEventListener (release-pop) "click"
  (fn [e]
    (when-let [a (.. e -target -dataset -rel)]
      (set! (.-hidden (release-pop)) true)
      (case a
        "forget" (gesture! (str "(forget-points " (pr-str (vec (sort @picked))) ")"))
        "release" (gesture! "(release)")
        nil))))

(when-let [b ($ "forget-btn")]
  (.addEventListener b "click"
    (fn [_]
      (let [n (count @picked)]
        (ask! (str "<p><b>Forget " n (if (= 1 n) " point" " points") " of the history?</b> The work at "
                   (if (= 1 n) "that moment" "those moments") " will be lost (and any snapshot there); the moments after "
                   (if (= 1 n) "it" "them") " stay exactly as they are. This cannot be undone.</p>"
                   "<div class=\"pp-actions\"><button class=\"act primary\" data-rel=\"forget\">Forget "
                   (if (= 1 n) "it" "them") "</button><button class=\"act\" data-rel=\"cancel\">Cancel</button></div>"))))))

(when-let [b ($ "release-btn")]
  (.addEventListener b "click"
    (fn [_]
      (let [k (count (keyframes))]
        (ask! (str "<p><b>Release</b> · a new work with a compact history: " k (if (= 1 k) " keyframe" " keyframes")
                   " (out of " (history-size) " events) and then the work as it is; presets boxes keep their presets, so "
                   "they travel with the patch. This work stays as it is.</p>"
                   "<div class=\"pp-actions\"><button class=\"act primary\" data-rel=\"release\">Make the release</button>"
                   "<button class=\"act\" data-rel=\"cancel\">Cancel</button></div>"))))))

;; another work opened: nothing is picked
(add-watch work ::release (fn [_ _ o n] (when (not= (select-keys o [:kind :id]) (select-keys n [:kind :id])) (reset! picked #{}))))
