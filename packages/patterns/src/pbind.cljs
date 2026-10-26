;; pbind · a pattern as data: an EDN map of sequences and #pat/… generators
;; Part of @kairotic/patterns. Written against the Kairotic API (api/…).
;; Its source is EDN, read without evaluating anything: safe in a shared room, like a tree box. What it
;; sends is a pattern value (a factory of streams), never the sequence, so a player makes the events in
;; each tab from the same source and seed and everyone hears the same.
(let [;; the seed, the passes and loop, from the box text: pbind 7 · pbind 7 4 · pbind 7 loop
      opts-of (fn [args] {:seed (or (:seed args) 0)
                          :repeat (if (:loop args) :inf (max 1 (js/Math.round (or (:repeat args) 1))))})
      spec-of (fn [data] (let [r (api/compiled "pbind" (:source data))] (when (= :ok (:status r)) (:value r))))
      ;; a new map for the box: written in its source, one gesture of the history
      rewrite (fn [m now]
                (let [ps (api/pbind-problems m)]
                  (cond (seq ps) {:effects [[:print (str "pbind: " (first ps))]]}
                        (= m now) {}                            ; the same again: nothing changes
                        :else {:effects [[:keep {:source (api/pbind-source m)}]]})))]
  {;; ── about ──
   :class "pbind"
   :license "MPL-2.0"
   :doc "A pattern as data: an EDN map whose values are sequences (vectors, the shorter ones starting again until the longest ends), constants and generators (#pat/choose [0.25 0.5], #pat/white [0 7], #pat/shuffle, #pat/walk, #pat/series, #pat/hold [4 [:c :g]] one value per 4 beats, #pat/chord [0 4 7]). It sends its pattern whenever it changes, for a player: the seed (pbind 7) makes its randomness the same for everyone, each key with its own. pbind 7 4 repeats it four times, pbind 7 loop for ever. A map on its inlet replaces it, [:set :dur [1 0.5]] one key, [:unset :amp] removes one."
   :usage "pbind [seed] [repeat] [loop]"
   :io [1 1]

   ;; ── arguments ──
   :args [[:seed 0] [:repeat 1] [:loop false]]

   ;; ── data: its source, with its own history ──
   :display :code
   :language "pbind"
   :model api/code-model
   :template "{:degree [0 2 4 7 4 2]\n :dur    [0.5 0.5 0.5 0.5 1 1]\n :amp    #pat/white [0.2 0.4]}"

   ;; ── what it sends when it changes ──
   :sends (fn [{:keys [data args]}]
            (when-let [m (spec-of data)] (api/pbind-pattern m (opts-of args))))

   ;; ── logic ──
   :receive (fn [{:keys [value data args]}]
              (let [r (api/compiled "pbind" (:source data))
                    m (when (= :ok (:status r)) (:value r))]
                (cond
                  (and (map? value) (not (api/pattern? value))) (rewrite value m)
                  (and (vector? value) (= :set (first value)) (keyword? (second value)) (= 3 (count value)))
                  (if m (rewrite (assoc m (second value) (nth value 2)) m) {:effects [[:print "pbind: its source does not read yet"]]})
                  (and (vector? value) (= :unset (first value)) (keyword? (second value)))
                  (if m (rewrite (dissoc m (second value)) m) {})
                  m {:out [[0 (api/pbind-pattern m (opts-of args))]] :show :bang}
                  (= :compiling (:status r)) {}
                  :else {:effects [[:print (str "pbind: " (or (:error r) "empty"))]]})))})
