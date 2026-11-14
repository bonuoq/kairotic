;; comes · counterpoint live: you play the dux and it answers with the comes (discussions #172 and #192)
;; Part of @kairotic/theory. Written against the Kairotic API (api/…).
;; Study 41 as a box: the hard rules of a canon in the modes (meter, dissonance, ties and suspensions, fourth
;; species, the ambitus, the voices between them, the degree of imitation) and the futures of every point counted
;; exactly, in counterpoint.mjs beside this component (the same version of the package, on npm, or the page's own
;; copy). A note that breaks a rule, or from which the canon could not be finished, is corrected to the nearest one
;; that can (between two as near, the more plausible by the soft rules), and the box says why. Two ways to play:
;;   by turns (the default)  one note in is one beat; the same note again is the note held (a tie)
;;   live (the word live)    a pulse on the right inlet is a beat; a note lasts until the next one is struck. A
;;                           note of three pulses in 2/2 turns the canon to 3/2; one longer than a bar ends the
;;                           section, and the next note begins a new canon with the parameters as they are then.
(let [origins ["npm:@kairotic/theory@0.3.0/dist/counterpoint.mjs" "kairotic/packages/theory/counterpoint.mjs"]
      hz (fn [m] (* 440 (js/Math.pow 2 (/ (- m 69) 12))))
      semis-of-hz (fn [f] (* 12 (/ (js/Math.log (/ f 261.6255653005986)) (js/Math.log 2))))
      log2 (fn [x] (/ (js/Math.log x) (js/Math.log 2)))
      round2 (fn [x] (/ (js/Math.round (* 100 x)) 100))
      ;; the parameters that can change on the way (a message [:k -4], [:imitation 0.5], [:mode :hypodorian]…)
      params #{:mode :k :d :beats :imitation :bars :upbeat :species}
      ;; the canon as the kernel is asked for it: the box's text, what was changed since, the meter now
      opts-of (fn [st args]
                (let [o (merge {:mode (:mode args) :k (:k args) :d (:d args) :beats (:beats args)
                                :imitation (:imitation args) :bars (:bars args) :upbeat (:upbeat args)
                                :species (if (:fourth args) 4 2)}
                               (:over st))
                      b (or (:meter st) (:beats o))]
                  (-> o (assoc :beats b :maxHold b) (update :mode #(some-> % name)))))
      ;; (a new text starts over)
      fresh (fn [args] {:sig args :D [] :C [] :pending [] :held [] :cps {} :wanted #{} :section 1})
      ;; a kernel for the canon o: counted already, being counted, or asked for now (a task, outside the pure logic)
      ensure (fn [st o]
               (if (or (contains? (:cps st) o) (contains? (:wanted st) o))
                 [st []]
                 [(update st :wanted conj o) [[:kernel {:opts o}]]]))
      ;; live: the canon as it is, and the same in 3/2 (a note of three pulses may turn it)
      ensure-live (fn [st args]
                    (let [[st fx] (ensure st (opts-of st args))
                          [st fx2] (ensure st (opts-of (assoc st :meter 3) args))]
                      [st (into fx fx2)]))
      futs (fn [cp D C]
             (mapv (fn [f] (let [x (.-note f)]
                             {:midi (.midi cp x) :name (.name cp x) :futures (.-futures f)
                              :bits (round2 (log2 (.-futures f))) :score (round2 (.-score f))
                              :comes (when (some? (.-comes f)) (.midi cp (.-comes f)))}))
                   (.futuribles cp (clj->js D) (clj->js C))))
      report (fn [cp st r]
               (let [D (:D st) C (:C st) t (count D) n (.-n cp) b (.-beats cp) ph (.. cp -spec -phase)
                     pos (+ (dec t) ph) cnt (.count cp (clj->js D) (clj->js C))]
                 (cond-> {:t t :n n :finished (>= t n) :section (:section st) :meter b
                          :futures cnt :bits (round2 (if (pos? cnt) (log2 cnt) -1))
                          :dux (mapv (fn [x] (.midi cp x)) D)
                          :comes-line (mapv (fn [c] (when (some? c) (.midi cp c))) C)
                          :obligations (vec (.obligations cp (clj->js D) (clj->js C)))}
                   (pos? t) (assoc :bar (inc (quot pos b)) :beat (inc (mod pos b))
                                   :held (and (> t 1) (= (peek D) (nth D (- t 2)))))
                   r (assoc :asked (+ 60 (.-asked r)) :played (.midi cp (.-note r)) :corrected (.-corrected r)
                            :reason (.-reason r) :comes (when (some? (.-comes r)) (.midi cp (.-comes r)))))))
      shown (fn [cp st r]
              (let [D (:D st) C (:C st) x (peek D) c (peek C)]
                {:status (str (when (:live st) (str "§" (:section st) " · ")) (count D) "/" (.-n cp) " · "
                              (round2 (log2 (max 1 (.count cp (clj->js D) (clj->js C))))) " bits"
                              (when (:live st) (str " · " (.-beats cp) "/2")))
                 :dux (if x (.name cp x) "–") :comes (if (some? c) (.name cp c) "–")
                 :corrected (boolean (and r (.-corrected r))) :reason (when r (.-reason r))}))
      ;; one pair placed: the dux as played (or corrected) and the comes with it. What sounds goes out only when
      ;; it changes: a note held is not struck again.
      placed (fn [cp st r]
               (let [D0 (:D st) C0 (:C st)
                     st (-> st (update :D conj (.-note r)) (update :C conj (.-comes r)))
                     x (.-note r) c (.-comes r)
                     done (>= (count (:D st)) (.-n cp))]
                 {:state (cond-> st done (assoc :idle true :section (inc (:section st 1))))
                  :show (shown cp st r)
                  :out (cond-> [[3 (report cp st r)] [2 (futs cp (:D st) (:C st))]]
                         (not= x (peek D0)) (conj [1 [(hz (.midi cp x))]])
                         (or (empty? C0) (not= c (peek C0))) (conj [0 (if (some? c) [(hz (.midi cp c))] [])]))}))
      ;; a pitch asked for: after the last canon, a new one
      play (fn [cp st asked]
             (let [st (if (or (:idle st) (>= (count (:D st)) (.-n cp))) (assoc st :D [] :C [] :idle false) st)]
               (if-let [r (.play cp (clj->js (:D st)) (clj->js (:C st)) asked)]
                 (placed cp st r)
                 {:state st})))
      merge-res (fn [a b] {:state (:state b) :show (or (:show b) (:show a)) :out (into (vec (:out a)) (:out b))
                           :effects (into (vec (:effects a)) (:effects b))})
      chain (fn [cp st askeds] (reduce (fn [acc a] (merge-res acc (play cp (:state acc) a))) {:state st :out []} askeds))
      at-point (fn [cp st]
                 {:state st :show (shown cp st nil)
                  :out [[3 (report cp st nil)] [2 (futs cp (:D st) (:C st))] [1 []] [0 []]]})
      ;; what a pitch asked for is (semitones above C4), from a number, a MIDI note, an event or the keys held
      asked-of (fn [value args st]
                 (let [num (fn [v] (if (:midi args) (- v 60) (when (pos? v) (semis-of-hz v))))]
                   (cond
                     (number? value) (if (or (:midi args) (pos? value)) [:note (num value)] [:release])
                     (and (vector? value) (= :midi (first value)) (number? (second value))) [:note (- (second value) 60)]
                     (and (map? value) (number? (:freq value)))
                     (if (pos? (or (:gate value) 1)) [:note (semis-of-hz (:freq value))] [:release])
                     (and (sequential? value) (every? number? value))
                     (cond (empty? value) [:release]
                           (some #{(first value)} (:held st)) [:same]
                           :else [:note (num (first value))])
                     :else nil)))
      ;; ── live: the section ends, and the next note begins a new canon ──
      cue (fn [st kind]
            (let [st (cond-> (assoc st :idle true :cur nil :dur 0 :section (inc (:section st 1)))
                       (= kind :ternary) (assoc :meter 3))]
              {:state st
               :show {:status (str "§" (:section st) " · " (if (= kind :ternary) "3/2 next" "a new canon next"))}
               :out [[3 {:cue kind :section (:section st) :meter (or (:meter st) (:beats (:over st)))}] [1 []] [0 []]]}))
      ;; a pulse: the note struck since the last one, or the one sounding held over the beat
      pulse (fn [st args at late]
              (let [period (when (and (:lastp st) (not late)) (- at (:lastp st)))
                    st (cond-> st (not late) (assoc :lastp at) (and period (pos? period)) (assoc :period period))
                    o (opts-of st args)
                    cp (if (or (:idle st) (nil? (:cp st))) (get (:cps st) o) (:cp st))
                    b (when cp (.-beats cp))]
                (cond
                  ;; a new note: the canon goes on, or a new one begins (once its kernel is counted)
                  (:struck st)
                  (if cp
                    (let [res (play cp (assoc st :cp cp) (:struck st))]
                      (update res :state assoc :struck nil :cur (:struck st) :dur 1 :last :struck))
                    (let [[st fx] (ensure-live st args)] {:state st :effects fx}))
                  ;; nothing sounding: the comes rests (what still sounded is let go)
                  (or (:idle st) (nil? (:cur st)) (nil? cp))
                  {:state (assoc st :last :idle) :out (when (#{:hold :struck} (:last st)) [[1 []] [0 []]])}
                  ;; held three pulses in 2/2: the canon turns to 3/2
                  (and (= 2 b) (>= (inc (:dur st)) 3))
                  (let [res (cue st :ternary) [s2 fx] (ensure (:state res) (opts-of (:state res) args))]
                    (assoc res :state (assoc s2 :last :cue) :effects fx))
                  ;; held longer than a bar: the end of the section
                  (> (inc (:dur st)) b)
                  (let [res (cue st :end)] (assoc-in res [:state :last] :cue))
                  ;; held over the beat (a tie)
                  :else
                  (if-let [r (.hold cp (clj->js (:D st)) (clj->js (:C st)))]
                    (-> (placed cp st r) (update :state assoc :dur (inc (:dur st)) :last :hold))
                    {:state st}))))
      ;; a note struck in live: for the next pulse, or for the last one if it came just after it (late)
      strike (fn [st args at s]
               (let [late (and (:lastp st) (:period st) (< (- at (:lastp st)) (* 0.3 (:period st))))]
                 (cond
                   (and late (= :hold (:last st)) (seq (:D st)))
                   (let [st (-> st (update :D pop) (update :C pop))
                         res (play (:cp st) st s)]
                     (update res :state assoc :cur s :dur 1 :last :struck :struck nil))
                   (and late (#{:idle :cue} (:last st)))
                   (pulse (assoc st :struck s) args at true)
                   :else {:state (assoc st :struck s)})))]
  {;; ── about ──
   :class "comes"
   :license "MPL-2.0"
   :doc "Counterpoint live: you play the dux and the comes answers, as a canon in a mode (Study 41). Each note is checked against the rules of the style — the mode's range, its melodic intervals, consonance on the strong beats, a dissonance only passing on a weak one or held as a suspension, no parallel 5ths or octaves… — and against the future: a note from which the canon could not be finished is not allowed either. A note that breaks a rule is corrected to the nearest one that can be played (a black key too; between two as near, the more plausible), and the box says why. The comes is the dux's note d beats before, k steps away, in a strict canon (imitation 1); with less imitation it is chosen by the soft rules, near the dux's note (0.5–0.9), only following its motion (0.2–0.4) or free. With fourth, the dux is a cantus firmus (a note a bar) and the comes is syncopated. By turns (the default), one note in is one beat, and the same note again is held over the beat (a tie), as is hold. With live, a pulse on the right inlet (a metro, a pulse) is a beat: a note lasts until the next one is struck; a note of three pulses in 2/2 turns the canon to 3/2, one longer than a bar ends the section, and the next note begins a new canon. [:k -4], [:d 2], [:imitation 0.5], [:mode :hypodorian], [:beats 2], [:species 4] change the canon: at once by turns, at the next section live. On the right, the futuribles: the notes that can come next, the most plausible first, with their futures counted exactly; and where the canon is. Numbers are Hz, as a keyboard or midiin sends them (MIDI with midi); a list is the notes held (the first new one is played); an event from midiin's right outlet too. engine lets it choose the next pair; back takes the last one back; reset starts again."
   :usage "comes [mode] [k -7] [d 3] [beats 2] [imitation 1] [bars 8] [upbeat 0] [fourth] [live] [midi]"
   :io [2 4]
   :size [150 46]
   :args [[:mode nil] [:k -7] [:d 3] [:beats 2] [:imitation 1] [:bars 8] [:upbeat 0] [:fourth false] [:live false] [:midi false]]

   ;; ── tasks: a kernel and its count, outside the pure logic ──
   :tasks {:kernel (fn [{:keys [opts]} _box]
                     (-> (api/import-module origins)
                         (.then (fn [m]
                                  (let [cp (.live m (clj->js opts))]
                                    (.then (.warm cp) (fn [_] {:cp cp})))))))}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (let [st (if (and state (= args (:sig state))) state (assoc (fresh args) :live (:live args)))
                    at (or at 0)
                    o (opts-of st args)
                    cp (:cp st)]
                (cond
                  ;; a kernel counted: kept; the one the canon waits for is the canon's, and what waited is played
                  (= inlet :task)
                  (let [o2 (:opts (:arg value))]
                    (cond
                      (not (contains? (:wanted st) o2)) {}
                      (:error value) {:state (update st :wanted disj o2) :show {:status (str "✗ " (:error value))}}
                      :else
                      (let [k (:cp (:value value))
                            st (-> st (update :wanted disj o2) (update :cps assoc o2 k))]
                        (cond
                          (or (not= o2 o) (and cp (not (:idle st)))) {:state st}
                          (:live st) {:state (assoc st :cp k) :show (shown k st nil)}
                          :else (let [waiting (:pending st) st (assoc st :cp k :pending [])]
                                  (if (seq waiting) (chain k st waiting) (at-point k st)))))))

                  ;; a parameter changed: by turns at once (a new canon), live at the next section
                  (and (vector? value) (contains? params (first value)) (some? (second value)))
                  (let [[kk v] value
                        st (cond-> (assoc-in st [:over kk] v) (= kk :beats) (assoc :meter v))
                        o (opts-of st args)
                        [st fx] (ensure st o)]
                    (if (:live st)
                      {:state st :effects fx}
                      (let [k (get (:cps st) o)
                            st (assoc st :cp k :D [] :C [] :idle false)]
                        (if k (assoc (at-point k st) :effects fx) {:state st :effects fx}))))

                  ;; the pulse (live)
                  (= inlet 1)
                  (if (and (:live st) (or cp (get (:cps st) o)))
                    (pulse st args at false)
                    (let [[st fx] (if (:live st) (ensure-live st args) (ensure st o))] {:state st :effects fx}))

                  ;; nothing to play with yet: the kernel is asked for (and what arrives is kept)
                  (and (nil? cp) (not (:live st)))
                  (let [a (asked-of value args st)
                        st (cond-> st
                             (= :note (first a)) (update :pending conj (second a))
                             (and (sequential? value) (every? number? value)) (assoc :held (vec value)))
                        [st fx] (ensure st o)]
                    {:state st :effects fx :show {:status "counting the futures…"}})

                  (#{:reset "reset"} value)
                  (if cp (at-point cp (assoc st :D [] :C [] :held [] :idle false :cur nil :struck nil)) {:state st})
                  (#{:back "back"} value)
                  (if cp (at-point cp (-> st (update :D (fn [v] (if (seq v) (pop v) v))) (update :C (fn [v] (if (seq v) (pop v) v))))) {:state st})
                  (#{:engine "engine"} value)
                  (if cp
                    (let [st (if (or (:idle st) (>= (count (:D st)) (.-n cp))) (assoc st :D [] :C [] :idle false) st)]
                      (if-let [r (.engine cp (clj->js (:D st)) (clj->js (:C st)))] (placed cp st r) {:state st}))
                    {:state st})
                  (and (not (:live st)) (#{:hold "hold"} value))
                  (if (and cp (seq (:D st)) (not (:idle st)))
                    (if-let [r (.hold cp (clj->js (:D st)) (clj->js (:C st)))] (placed cp st r) {:state st})
                    {:state st})

                  :else
                  (let [[kind x] (asked-of value args st)
                        st (if (and (sequential? value) (every? number? value)) (assoc st :held (vec value)) st)]
                    (cond
                      (and (= kind :note) (:live st)) (let [[st fx] (ensure-live st args) res (strike st args at x)]
                                                         (update res :effects #(into (vec %) fx)))
                      (= kind :note) (play cp st x)
                      (and (= kind :release) (not (:live st))) {:state st :out [[1 []] [0 []]]}
                      :else {:state st})))))

   ;; ── view ──
   :derive (fn [{:keys [shown]}]
             {:main (if (:dux shown) (str (:dux shown) "  →  " (:comes shown)) "comes")
              :sub (or (:status shown) "play the dux")
              :mark (if (:corrected shown) 4 0)})
   :view [[:rect {:x 2 :y 2 :w 146 :h 42 :r 3 :stroke :grid :fill :bg}]
          [:rect {:x 4 :y 4 :w :$mark :h 38 :r 1 :stroke nil :fill :kairos}]
          [:text {:x 12 :y 20 :size 13} :$main]
          [:text {:x 12 :y 36 :size 9 :fill :soft} :$sub]]})
