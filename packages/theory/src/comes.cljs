;; comes · counterpoint live: you play the dux, note by note, and it answers with the comes (discussion #172)
;; Part of @kairotic/theory. Written against the Kairotic API (api/…).
;; Study 40 as a box: the hard rules of a canon in the modes (meter, dissonance, the ambitus, the voices between
;; them, the degree of imitation) and the futures of every point counted exactly, in counterpoint.mjs beside this
;; component (the same version of the package, on npm, or the page's own copy). One note in is one beat: a note
;; that breaks a rule, or from which the canon could not be finished, is corrected to the nearest one that can
;; (between two as near, the more plausible by the soft rules), and the box says why.
(let [origins ["npm:@kairotic/theory@0.2.0/dist/counterpoint.mjs" "kairotic/packages/theory/counterpoint.mjs"]
      hz (fn [m] (* 440 (js/Math.pow 2 (/ (- m 69) 12))))
      semis-of-hz (fn [f] (* 12 (/ (js/Math.log (/ f 261.6255653005986)) (js/Math.log 2))))
      log2 (fn [x] (/ (js/Math.log x) (js/Math.log 2)))
      round2 (fn [x] (/ (js/Math.round (* 100 x)) 100))
      opts-of (fn [args] {:mode (some-> (:mode args) name) :k (:k args) :d (:d args) :beats (:beats args)
                          :imitation (:imitation args) :bars (:bars args) :upbeat (:upbeat args)})
      ;; (a new text starts over; the number of the last request is kept, so an answer to it is dropped)
      fresh (fn [args old] {:sig args :k (:k old 0) :D [] :C [] :pending [] :held []})
      ;; the canon from the start: the kernel is loaded and its futures counted, outside the pure logic
      load (fn [st args]
             (let [k (inc (:k st 0))]
               {:state (assoc st :k k :loading true :error nil)
                :show {:status "counting the futures…"}
                :effects [[:kernel {:k k :opts (opts-of args)}]]}))
      ;; what a pitch asked for is (semitones above C4), from a number, a MIDI note or an event
      futs (fn [cp D C]
             (mapv (fn [f] (let [x (.-note f)]
                             {:midi (.midi cp x) :name (.name cp x) :futures (.-futures f)
                              :bits (round2 (log2 (.-futures f))) :score (round2 (.-score f))
                              :comes (when (some? (.-comes f)) (.midi cp (.-comes f)))}))
                   (.futuribles cp (clj->js D) (clj->js C))))
      report (fn [cp st r]
               (let [D (:D st) C (:C st) t (count D) n (.-n cp) b (.. cp -spec -b) ph (.. cp -spec -phase)
                     pos (+ (dec t) ph) cnt (.count cp (clj->js D) (clj->js C))]
                 (cond-> {:t t :n n :finished (>= t n)
                          :futures cnt :bits (round2 (if (pos? cnt) (log2 cnt) -1))
                          :dux (mapv (fn [x] (.midi cp x)) D)
                          :comes-line (mapv (fn [c] (when (some? c) (.midi cp c))) C)
                          :obligations (vec (.obligations cp (clj->js D) (clj->js C)))}
                   (pos? t) (assoc :bar (inc (quot pos b)) :beat (inc (mod pos b)))
                   r (assoc :asked (+ 60 (.-asked r)) :played (.midi cp (.-note r)) :corrected (.-corrected r)
                            :reason (.-reason r) :comes (when (some? (.-comes r)) (.midi cp (.-comes r)))))))
      shown (fn [cp st r]
              (let [D (:D st) C (:C st) x (peek D) c (peek C)]
                {:status (str (count D) "/" (.-n cp) " · " (round2 (log2 (max 1 (.count cp (clj->js D) (clj->js C))))) " bits")
                 :dux (if x (.name cp x) "–") :comes (if (some? c) (.name cp c) "–")
                 :corrected (boolean (and r (.-corrected r)))}))
      ;; one pair placed: the dux as played (or corrected) and the comes with it
      placed (fn [cp st r]
               (let [st (-> st (update :D conj (.-note r)) (update :C conj (.-comes r)))
                     c (.-comes r)]
                 {:state st :show (shown cp st r)
                  :out [[3 (report cp st r)] [2 (futs cp (:D st) (:C st))]
                        [1 [(hz (.midi cp (.-note r)))]] [0 (if (some? c) [(hz (.midi cp c))] [])]]}))
      ;; a pitch asked for: a new canon after the last one
      play (fn [cp st asked]
             (let [st (if (>= (count (:D st)) (.-n cp)) (assoc st :D [] :C []) st)]
               (if-let [r (.play cp (clj->js (:D st)) (clj->js (:C st)) asked)]
                 (placed cp st r)
                 {:state st})))
      ;; several results in a row (notes that arrived while the futures were counted)
      chain (fn [cp st askeds]
              (reduce (fn [acc a] (let [res (play cp (:state acc) a)]
                                    {:state (:state res) :show (or (:show res) (:show acc)) :out (into (:out acc) (:out res))}))
                      {:state st :out []} askeds))
      at-point (fn [cp st]
                 {:state st :show (shown cp st nil)
                  :out [[3 (report cp st nil)] [2 (futs cp (:D st) (:C st))] [1 []] [0 []]]})
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
                     :else nil)))]
  {;; ── about ──
   :class "comes"
   :license "MPL-2.0"
   :doc "Counterpoint live: you play the dux, one note a beat, and the comes answers, as a canon in a mode (Study 40). Each note is checked against the rules of the style — the mode's range, its melodic intervals, consonance on the strong beats, a dissonance only passing on a weak one, no parallel 5ths or octaves… — and against the future: a note from which the canon could not be finished is not allowed either. A note that breaks a rule is corrected to the nearest one that can be played (a black key too; between two as near, the more plausible), and the box says why. The comes is the dux's note d beats before, k steps away, in a strict canon (imitation 1); with less imitation it is chosen by the soft rules, near the dux's note (0.5–0.9), only following its motion (0.2–0.4) or free. On the right, the futuribles: the notes that can come next, the most plausible first, with their futures counted exactly. After the last bar a new canon begins. Numbers are Hz, as a keyboard or midiin sends them (MIDI with midi); a list is the notes held (the first new one is played); an event from midiin's right outlet too. engine (or bang) lets it choose the next pair; back takes the last one back; reset starts again."
   :usage "comes [mode] [k -7] [d 3] [beats 2] [imitation 1] [bars 8] [upbeat 0] [midi]"
   :io [1 4]
   :size [150 46]
   :args [[:mode nil] [:k -7] [:d 3] [:beats 2] [:imitation 1] [:bars 8] [:upbeat 0] [:midi false]]

   ;; ── tasks: the kernel and the count, outside the pure logic ──
   :tasks {:kernel (fn [{:keys [opts]} _box]
                     (-> (api/import-module origins)
                         (.then (fn [m]
                                  (let [cp (.live m (clj->js opts))]
                                    (.then (.warm cp) (fn [_] {:cp cp})))))))}

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args]}]
              (let [st (if (and state (= args (:sig state))) state (fresh args state))
                    cp (:cp st)]
                (cond
                  ;; the kernel, its futures counted: the notes that waited are played
                  (= inlet :task)
                  (cond (not= (:k (:arg value)) (:k st)) {}
                        (:error value) {:state (assoc st :loading false :error (:error value))
                                        :show {:status (str "✗ " (:error value))}}
                        :else (let [cp (:cp (:value value))
                                    waiting (:pending st)
                                    st (assoc st :cp cp :loading false :pending [])]
                                (if (seq waiting) (chain cp st waiting) (at-point cp st))))

                  ;; nothing to play with yet: load (and keep what arrives)
                  (nil? cp)
                  (let [a (asked-of value args st)
                        st (cond-> st
                             (= :note (first a)) (update :pending conj (second a))
                             (and (sequential? value) (every? number? value)) (assoc :held (vec value)))]
                    (if (:loading st) {:state st} (load st args)))

                  (#{:reset "reset"} value) (at-point cp (assoc st :D [] :C [] :held []))
                  (#{:back "back"} value) (at-point cp (-> st (update :D (fn [v] (if (seq v) (pop v) v)))
                                                            (update :C (fn [v] (if (seq v) (pop v) v)))))
                  (#{:engine "engine" :bang} value)
                  (let [st (if (>= (count (:D st)) (.-n cp)) (assoc st :D [] :C []) st)]
                    (if-let [r (.engine cp (clj->js (:D st)) (clj->js (:C st)))] (placed cp st r) {:state st}))

                  :else
                  (let [[kind x] (asked-of value args st)
                        st (if (and (sequential? value) (every? number? value)) (assoc st :held (vec value)) st)]
                    (case kind
                      :note (play cp st x)
                      :release {:state st :out [[1 []] [0 []]]}
                      {:state st})))))

   ;; ── view ──
   :derive (fn [{:keys [shown]}]
             {:main (if (:dux shown) (str (:dux shown) "  →  " (:comes shown)) "comes")
              :sub (or (:status shown) "play the dux")
              :mark (if (:corrected shown) 4 0)})
   :view [[:rect {:x 2 :y 2 :w 146 :h 42 :r 3 :stroke :grid :fill :bg}]
          [:rect {:x 4 :y 4 :w :$mark :h 38 :r 1 :stroke nil :fill :kairos}]
          [:text {:x 12 :y 20 :size 13} :$main]
          [:text {:x 12 :y 36 :size 9 :fill :soft} :$sub]]})
