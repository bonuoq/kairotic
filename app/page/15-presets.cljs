;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · the page, part 16 of 16: presets
;; The page's ClojureScript, in the order it is evaluated (app/index.html lists the files).

(in-ns 'user)

;; ───────────────────────── presets from the keyframes of the history (issue #35) ─────────────────────────
;; Every keyframe (◆ snapshot, or take kept from Perform) is a preset of the work: what it holds is the text
;; of every box (kairotic.presets/configuration). A preset is recalled as one event that gives each box the
;; text it had there; a morph moves the controls (boxes that keep their value in their text, a knob) between
;; two presets as messages, as a drag does, until (morph :keep) writes them; a generated preset keeps what is
;; the same in all of them and varies what changes, within its range. Everything acts on the whole work,
;; wherever the view is, and in Perform it goes to the take, as any change does.

(defn keyframes
  "The keyframes of the history, in order of moment (the same order in every tab of a room):
   [{:n 1 :label \"intro\" :kind :snapshot :moment 4} …]."
  []
  (->> (for [n (vals (:nodes @hist))
             [k ev] (map-indexed vector (:events n))
             :when (and (vector? ev) (= :mark (first ev)))
             :let [m (when (map? (second ev)) (second ev)) pos [(:id n) (inc k)]]]
         (cond-> {:kind (or (:kind m) :snapshot) :pos pos :moment (depth-of pos)}
           (seq (str (:label m))) (assoc :label (str (:label m)))))
       (sort-by (juxt :moment (fn [k] (str (first (:pos k))))))
       (map-indexed (fn [i k] (assoc k :n (inc i))))
       vec))

(defn find-keyframe
  "Keyframe `ref` among `kfs`: a number is its place in that list (1 = the first), a label the last one
   written with it."
  [kfs ref]
  (cond
    (number? ref) (or (when (integer? ref) (get kfs (dec ref)))
                      (fail (str "There is no keyframe " ref ": there " (if (= 1 (count kfs)) "is 1" (str "are " (count kfs))) ".")))
    (or (string? ref) (keyword? ref))
    (or (last (filter (fn [k] (= (:label k) (name ref))) kfs))
        (fail (str "No snapshot is called " (pr-str (name ref)) ".")))
    :else (fail "A keyframe is a number (1 = the first) or the label of a snapshot.")))

(defn- need-history! []
  (when @scratch (fail "Presets come from the history of a work."))
  (when (#{:connecting :none} (:mode @hist)) (fail "Open a work first.")))

(defn- need-keyframes [kfs n]
  (when (< (count kfs) n)
    (fail (if (empty? kfs)
            "There are no keyframes yet: ◆ Snapshot (or (snapshot \"name\")) keeps the work as it is now."
            (str "That needs " n " keyframes, and there " (if (= 1 (count kfs)) "is 1" (str "are " (count kfs))) ".")))))

(defn keyframe-config
  "What a keyframe holds: the texts it keeps (a preset stored in a box: issue #45), or the work at its point."
  [k] (if (:texts k) (:texts k) (pst/configuration (patch-at (:pos k)))))
(defn now-config [] (pst/configuration (work-patch)))

(defn moment-label [k] (str "keyframe " (:n k) (when (:label k) (str " (" (:label k) ")"))))

(defn write-texts!
  "Gives boxes of the work new texts ({engine-id text}), as one event of the history."
  [changes]
  (when (seq changes)
    (let [evs (vec (for [[f t] changes :let [path (pst/path-of f)]] (wrap-in (pop path) [:text (peek path) t])))]
      (dispatch-root! (if (= 1 (count evs)) (first evs) [:batch evs]))
      (doseq [t (vals changes)] (ensure-class! t))))
  changes)

(defn control-values
  "The values the controls among `texts` ({engine-id text}) keep: {engine-id value}."
  [texts]
  (into (sorted-map) (keep (fn [[f t]] (when-let [c (pst/control t)] [f (:v c)])) texts)))

(declare presets-list)

(defn presets-box
  "A presets box of the work by its engine id (:b18, or :b5.b2 inside a sub-patch)."
  [f] (or (get-in (eng/flat (work-patch)) [:boxes f]) (fail (str "There is no presets box " f))))

(defn recall
  "Recalls a keyframe as a preset: every box of the work that is also there takes the text it had there (its
   arguments, and the values its controls keep), as one event. Boxes added or removed since, lines and
   buffers stay as they are. (recall 2) · (recall \"intro\") · (recall :b18 2), among the presets of that box."
  ([ref]
   (need-history!)
   (let [kfs (keyframes) _ (need-keyframes kfs 1)
         k (find-keyframe kfs ref)
         changes (pst/recall-changes (now-config) (keyframe-config k))]
     (write-texts! changes)
     {:recalled (moment-label k) :changed (count changes)}))
  ([f ref]
   (let [kfs (presets-list (presets-box f)) _ (need-keyframes kfs 1)
         k (find-keyframe kfs ref)
         changes (pst/recall-changes (now-config) (keyframe-config k))]
     (write-texts! changes)
     {:recalled (moment-label k) :changed (count changes)})))

(defonce last-morph (atom {}))   ; the values the last morph gave the controls: {engine-id value}

(defn morph-with!
  "Moves the controls between keyframes a and b at t, as messages (nothing is written): {engine-id value}."
  ([a b t] (morph-with! a b t #{}))
  ([a b t exclude]
   (let [vals (pst/morph-values (now-config) (keyframe-config a) (keyframe-config b) (max 0 (min 1 t)) exclude)]
     (doseq [[f v] vals]
       (try (inject-local! f 0 v) (catch :default e (js/console.error "morph" e))))
     (reset! last-morph vals)
     (when (seq vals) (render-overlay!))
     vals)))

(defn morph
  "Moves the controls (boxes that keep their value in their text, such as knobs) between two keyframes, as a
   drag does: (morph 1 2 0.5) is halfway. Nothing is written until (morph :keep), which keeps the values of
   the last morph in their texts, as one event."
  ([how]
   (when-not (= how :keep) (fail "Use (morph a b t), or (morph :keep) to keep the last morph."))
   (need-history!)
   (let [changes (pst/keep-changes (now-config) @last-morph)]
     (write-texts! changes)
     (reset! last-morph {})
     {:kept (count changes)}))
  ([a b t]
   (need-history!)
   (when-not (number? t) (fail "t is a number between 0 and 1: (morph 1 2 0.5)."))
   (let [kfs (keyframes)]
     (need-keyframes kfs 1)
     (morph-with! (find-keyframe kfs a) (find-keyframe kfs b) t))))

(defn generate
  "A new preset from the keyframes: what is the same in all of them stays; a number that changes takes a value
   within its range (geometric in a box written with log, whole if it always was); a word that changes is one
   of theirs. Written as one event. (generate) · (generate 42), a seed: the same seed, the same preset ·
   (generate 42 [1 3]) from some keyframes only · (generate :b18 42) among the presets of that box."
  ([] (generate (js/Math.floor (* (js/Math.random) 1e9))))
  ([seed] (generate seed nil))
  ([x y]
   (let [box (when (keyword? x) x)
         seed (if box y x)
         refs (when-not box y)]
     (when-not box (need-history!))
     (when-not (number? seed) (fail "The seed is a number: (generate 42)."))
     (let [all (if box (presets-list (presets-box box)) (keyframes))
           kfs (if (seq refs) (mapv (fn [r] (find-keyframe all r)) refs) all)
           _ (need-keyframes kfs 2)
           changes (pst/generate-changes (now-config) (mapv keyframe-config kfs) (pst/rng seed))]
       (write-texts! changes)
       {:generated (count changes) :seed seed :from (mapv :n kfs)}))))

;; ───── the presets box: what it asks for, done here ─────

(defn stored-keyframes
  "The presets a box keeps in its data, as keyframes: [{:n :label :kind :texts}]."
  [b] (vec (map-indexed (fn [i p] (assoc p :n (inc i))) (get-in b [:data :presets]))))

(defn presets-list
  "The keyframes a presets box uses: the presets it keeps, if any (issue #45: they were chosen when they were
   kept), or, of the keyframes of the history, those its arguments name (numbers, labels), in that order, or all."
  [b]
  (let [stored (stored-keyframes b)]
    (if (seq stored)
      stored
      (let [_ (need-history!)
            all (keyframes)
            refs (map (fn [x] (if (keyword? x) (name x) x)) (comp/args-of (:text b)))]
        (if (seq refs) (mapv (fn [r] (find-keyframe all r)) refs) all)))))

(defn presets!
  "Keeps presets in a presets box: (presets! :b18 [{:label \"calm\" :texts {:b13 \"knob 0.5 50 2 log strobe\"}} …]).
   They are part of the patch: its code, links and embeds carry them. (presets! :b18 nil) forgets them."
  [id v]
  (let [b (need-box id)]
    (when-not (= "presets" (klass (:text b))) (fail (str id " is not a presets box")))
    (dispatch! [:in id (if (seq v) [:store v] [:clear])])
    (count (rel/sane-presets v))))

(defn store-presets!
  "Keeps in a presets box the keyframes it uses from the history (only what changes between them), so they
   travel with the patch: (store-presets! :b18)."
  [id]
  (let [b (need-box id)]
    (when-not (= "presets" (klass (:text b))) (fail (str id " is not a presets box")))
    (need-history!)
    (let [kfs (presets-list (assoc b :data nil)) _ (need-keyframes kfs 1)
          v (rel/stored-presets (mapv (fn [k] (assoc k :config (keyframe-config k))) kfs))]
      (presets! id v))))

(defn- emit-values! [f vals]
  (when (seq vals)
    (try (eng/emit! (fn [] (work-patch)) f 0 vals) (catch :default e (js/console.error "presets" e)))))

(defn presets-effect!
  "What a presets box (engine id f) asked for: a recall and a generation are gestures of the work (written in
   the REPL, as any gesture); a morph moves the controls as messages."
  [f [_ [op & xs]] _]
  (js/setTimeout
   (fn []
     (try
       (let [b (or (get-in (eng/flat (work-patch)) [:boxes f]) (fail "the box is not in the work"))
             kfs (presets-list b)
             own? (seq (stored-keyframes b))]
         (case op
           :recall (let [_ (need-keyframes kfs 1)
                         k (find-keyframe kfs (first xs))
                         changes (pst/recall-changes (now-config) (keyframe-config k))]
                     (gesture! (if own? (str "(recall " f " " (:n k) ")") (str "(recall " (:n k) ")")))
                     (emit-values! f (control-values changes)))
           :generate (let [_ (need-keyframes kfs 2)
                           seed (or (first xs) (js/Math.floor (* (js/Math.random) 1e9)))
                           now (now-config)
                           changes (pst/generate-changes now (mapv keyframe-config kfs) (pst/rng seed))]
                       (gesture! (if own?
                                   (str "(generate " f " " seed ")")
                                   (str "(generate " seed (when (not= kfs (keyframes)) (str " " (pr-str (mapv :n kfs)))) ")")))
                       (emit-values! f (control-values changes)))
           :keep (gesture! "(morph :keep)")
           ;; a position on the right inlet: 1.5 is halfway from the first keyframe of the box to the second.
           ;; The controls upstream of the box (a knob that drives it) are left where they are.
           :morph-at (do (need-keyframes kfs 2)
                         (let [[a b t] (pst/between (first xs) (count kfs))
                               exclude (reaching (:lines (eng/flat (work-patch))) #{f})]
                           (emit-values! f (morph-with! (nth kfs (dec a)) (nth kfs (dec b)) t exclude))))
           :morph (let [[a b t] xs
                        exclude (reaching (:lines (eng/flat (work-patch))) #{f})]
                    (emit-values! f (morph-with! (find-keyframe kfs a) (find-keyframe kfs b) t exclude)))
           nil))
       (catch :default e
         (repl-print! "err" (esc (str "; presets " (name f) ": " (or (.-message e) e)))))))
   0))

;; the page receives the effects of boxes: presets here, the rest as before (03-history-view.cljs)
(swap! eng/rt assoc :effect-hook
       (fn [f [k _ :as e] at] (if (= k :presets) (presets-effect! f e at) (tree-effect! f e at))))
