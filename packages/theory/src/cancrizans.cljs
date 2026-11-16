;; cancrizans · a crab canon written from both ends to the middle (discussions #172 and #192, Study 43)
;; Part of @kairotic/theory. Written against the Kairotic API (api/…).
;; The comes is the dux backwards, both voices at once (a crab); with table, backwards and upside down — the one
;; score read by a second player from across the table, a musical ambigram. Such a canon cannot be written from
;; the beginning: the comes at the start is the dux at the end. It is written from both ends to the middle, by
;; turns: each step a note at the start, then one at the end, and the futuribles are the ways to close the work in
;; the middle, counted exactly (mirror.mjs beside this component: Study 43's kernel, on counterpoint.mjs). A note
;; that breaks a rule, or from which the work could not be closed, is corrected to the nearest one that can. When
;; the work is closed, both voices go out as patterns, for a pbind and a player.
(let [origins-cp ["npm:@kairotic/theory@0.4.0/dist/counterpoint.mjs" "kairotic/packages/theory/counterpoint.mjs"]
      origins-mi ["npm:@kairotic/theory@0.4.0/dist/mirror.mjs" "kairotic/packages/theory/mirror.mjs"]
      semis-of-hz (fn [f] (* 12 (/ (js/Math.log (/ f 261.6255653005986)) (js/Math.log 2))))
      log2 (fn [x] (/ (js/Math.log x) (js/Math.log 2)))
      params #{:mode :k :beats :bars :table :axis}
      opts-of (fn [st args]
                (merge {:mode (some-> (:mode args) name) :k (:k args) :beats (:beats args) :bars (:bars args)
                        :table (boolean (:table args)) :axis nil}
                       (update (:over st) :mode #(some-> % name))))
      fresh (fn [args] {:sig args :M [] :s 0 :pending nil :hist [] :k 0})
      load (fn [st o]
             (let [k (inc (:k st 0))]
               {:state (assoc st :k k :loading true :mi nil)
                :show {:main "cancrizans" :sub "counting the futures…"}
                :effects [[:kernel {:k k :opts o}]]}))
      ;; the dux as the kernel reads it: an array with holes where nothing is written yet
      js-M (fn [st n] (let [a (js/Array. n)] (doseq [[i v] (map-indexed vector (:M st))] (when (some? v) (aset a i v))) a))
      pos-of (fn [mi s] (when (< s (.-steps mi)) (vec (aget (.-order mi) s))))
      ;; the candidates for the next note: at the start of the step, or at its end once the start is chosen
      cands (fn [mi st]
              (let [s (:s st) M (js-M st (.-n mi))]
                (if (some? (:pending st)) (.fanSecond mi M s (:pending st)) (.fan mi M s))))
      futs (fn [cp mi st]
             (vec (for [c (cands mi st) :when (pos? (or (.-futures c) 0))]
                    {:midi (.midiOf cp (.-note c)) :name (.pitchName cp (.-note c)) :futures (.-futures c)})))
      ;; a voice as a pattern: the notes held over the beat joined
      pattern (fn [cp xs]
                (let [runs (partition-by identity xs)]
                  {:note (mapv (fn [r] (.midiOf cp (first r))) runs) :dur (mapv count runs)}))
      report (fn [cp mi st extra]
               (let [n (.-n mi) lns (.lines mi (js-M st n)) s (:s st) steps (.-steps mi) pos (pos-of mi s)
                     mid (fn [v] (when (and (some? v) (not (undefined? v))) (.midiOf cp v)))]
                 (merge {:step s :steps steps :closed (>= s steps)
                         :writing (cond (>= s steps) :closed (some? (:pending st)) :end :else :start)
                         :beat (when pos (inc (if (some? (:pending st)) (peek pos) (first pos))))
                         :futures (.count mi (js-M st n) s)
                         :dux (mapv mid (array-seq (.-D lns))) :comes (mapv mid (array-seq (.-C lns)))}
                        extra)))
      shown (fn [cp mi st]
              (let [steps (.-steps mi) s (:s st)]
                {:main (str (if (.-inverted mi) "table · " "crab · ") (count (remove nil? (:M st))) "/" (.-n mi) " notes")
                 :sub (cond (>= s steps) "closed: the work is written"
                            (some? (:pending st)) (str "now the note at the end · " (.count mi (js-M st (.-n mi)) s) " ways")
                            :else (str "step " (inc s) "/" steps ": the note at the start"))}))
      at-point (fn [cp mi st extra]
                 (let [closed (>= (:s st) (.-steps mi)) n (.-n mi) lns (.lines mi (js-M st n))]
                   {:state st :show (shown cp mi st)
                    :out (cond-> [[3 (report cp mi st extra)] [2 (futs cp mi st)]]
                           closed (conj [1 (pattern cp (array-seq (.-C lns)))] [0 (pattern cp (array-seq (.-D lns)))]))}))
      ;; a pitch asked for (semitones above C4): the nearest candidate with a future; between two as near, the
      ;; one with more futures
      nearest (fn [cp cs asked]
                (let [ok (filter #(pos? (or (.-futures %) 0)) cs)]
                  (when (seq ok)
                    (first (sort-by (juxt #(js/Math.abs (- (.semis cp (.-note %)) asked)) #(- (.-futures %))) ok)))))
      write (fn [mi st vals]
              (let [pos (pos-of mi (:s st)) n (.-n mi)
                    M (vec (concat (:M st) (repeat (max 0 (- n (count (:M st)))) nil)))]
                (assoc st :M (reduce (fn [M [p v]] (assoc M p v)) M (map vector pos vals))
                       :s (inc (:s st)) :pending nil :hist (conj (:hist st) (select-keys st [:M :s :pending])))))
      choose (fn [cp mi st asked]
               (let [pos (pos-of mi (:s st))]
                 (if-not pos
                   {:state st}
                   (let [c (nearest cp (cands mi st) asked)
                         r (js/Math.round asked)
                         extra (when c {:asked (+ 60 r) :played (.midiOf cp (.-note c)) :corrected (not= r (.semis cp (.-note c)))})]
                     (cond
                       (nil? c) {:state st}
                       (and (= 2 (count pos)) (nil? (:pending st))) (at-point cp mi (assoc st :pending (.-note c)) extra)
                       (= 2 (count pos)) (at-point cp mi (write mi st [(:pending st) (.-note c)]) extra)
                       :else (at-point cp mi (write mi st [(.-note c)]) extra))))))
      ;; the engine: the candidate nearest the note beside it (a step), more futures between two as near
      engine (fn [cp mi st]
               (let [pos (pos-of mi (:s st)) M (:M st)]
                 (when pos
                   (let [second? (some? (:pending st))
                         nb (if second? (get M (inc (peek pos))) (get M (dec (first pos))))
                         cs (filter #(pos? (or (.-futures %) 0)) (cands mi st))]
                     (when (seq cs)
                       (let [c (first (sort-by (juxt #(if nb (js/Math.abs (- (js/Math.abs (- (.-note %) nb)) 1)) 0) #(- (.-futures %))) cs))]
                         (.semis cp (.-note c))))))))
      asked-of (fn [value args]
                 (cond
                   (number? value) (if (:midi args) (- value 60) (when (pos? value) (semis-of-hz value)))
                   (and (vector? value) (= :midi (first value)) (number? (second value))) (- (second value) 60)
                   (and (map? value) (number? (:freq value)) (pos? (or (:gate value) 1))) (semis-of-hz (:freq value))
                   (and (sequential? value) (seq value) (every? number? value))
                   (if (:midi args) (- (first value) 60) (semis-of-hz (first value)))
                   :else nil))]
  {;; ── about ──
   :class "cancrizans"
   :license "MPL-2.0"
   :doc "A crab canon written from both ends to the middle (Study 43): the comes is the dux backwards, both voices at once; with table, backwards and upside down about an axis ([:axis 62], a MIDI note; the final by default) — the one score read by a second player from across the table, a musical ambigram. It cannot be written from the beginning (the comes at the start is the dux at the end), so it is written by turns from both ends: each step a note at the start, then one at the end. A note that breaks a rule of the style (as comes's), or from which the work could not be closed, is corrected to the nearest one that can. On the right, the futuribles — the notes that can come next and the ways each leaves to close the work in the middle, counted exactly — and where the work is. When it closes, the dux and the comes go out (left) as patterns, {:note [...] :dur [...]} with the notes held joined, for a pbind and a player. Notes as comes takes them: Hz, a list of keys held, [:midi 62], or MIDI numbers with midi. engine writes the next note itself; back takes one back; reset starts again; [:k -4], [:mode :hypodorian], [:bars 5], [:table true], [:axis 62] change the canon (and start again)."
   :usage "cancrizans [mode] [k -7] [beats 2] [bars 6] [table] [midi]"
   :io [1 4]
   :size [170 46]
   :args [[:mode nil] [:k -7] [:beats 2] [:bars 6] [:table false] [:midi false]]

   ;; ── tasks: the kernel and its count, outside the pure logic ──
   :tasks {:kernel (fn [{:keys [opts]} _box]
                     (-> (js/Promise.all #js [(api/import-module origins-cp) (api/import-module origins-mi)])
                         (.then (fn [[cp mm]]
                                  (let [L (.live cp (clj->js {:mode (:mode opts) :beats (:beats opts) :bars (:bars opts) :axis (:axis opts)}))
                                        sp (.-spec L)
                                        mi (.mirror mm #js {:tonic (.-tonic sp) :lo (.-lo sp) :hi (.-hi sp) :n (.-n sp) :b (.-b sp)
                                                            :spacing (.-spacing sp) :starts (.-starts sp) :maxHold (.-b sp)
                                                            :transform #js {:kind (if (:table opts) "table" "crab") :k (:k opts) :axis (.-axis L)}})]
                                    (.then (.countAsync mi #js {}) (fn [_] {:cp cp :mi mi})))))))}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args]}]
              (let [st (if (and state (= args (:sig state))) state (assoc (fresh args) :k (:k state 0)))
                    o (opts-of st args)
                    {:keys [cp mi]} st]
                (cond
                  (= inlet :task)
                  (cond (not= (:k (:arg value)) (:k st)) {}
                        (:error value) {:state (assoc st :loading false) :show {:main "cancrizans" :sub (str "✗ " (:error value))}}
                        :else (let [{:keys [cp mi]} (:value value)
                                    st (assoc st :cp cp :mi mi :loading false :M [] :s 0 :pending nil :hist [])]
                                (if-let [a (:waiting st)]
                                  (choose cp mi (dissoc st :waiting) a)
                                  (at-point cp mi st nil))))

                  ;; a parameter changed: a new work
                  (and (vector? value) (contains? params (first value)))
                  (let [st (assoc-in st [:over (first value)] (second value))] (load st (opts-of st args)))

                  (nil? mi)
                  (let [a (asked-of value args) st (cond-> st (some? a) (assoc :waiting a))]
                    (if (:loading st) {:state st} (load st o)))

                  (#{:reset "reset"} value) (at-point cp mi (assoc st :M [] :s 0 :pending nil :hist []) nil)
                  (#{:back "back"} value)
                  (cond (some? (:pending st)) (at-point cp mi (assoc st :pending nil) nil)
                        (seq (:hist st)) (at-point cp mi (merge st (peek (:hist st)) {:hist (pop (:hist st))}) nil)
                        :else {:state st})
                  (#{:engine "engine" :bang} value)
                  (if-let [a (engine cp mi st)] (choose cp mi st a) {:state st})

                  :else
                  (if-let [a (asked-of value args)] (choose cp mi st a) {:state st}))))

   ;; ── view ──
   :derive (fn [{:keys [shown]}] {:main (or (:main shown) "cancrizans") :sub (or (:sub shown) "write the dux from both ends")})
   :view [[:rect {:x 2 :y 2 :w 166 :h 42 :r 3 :stroke :grid :fill :bg}]
          [:text {:x 10 :y 20 :size 13} :$main]
          [:text {:x 10 :y 36 :size 9 :fill :soft} :$sub]]})
