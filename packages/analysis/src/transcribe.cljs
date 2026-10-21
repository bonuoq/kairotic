;; transcribe · what pitch~ hears, written as strokes of a freqt
;; Part of @kairotic/analysis. Written against the Kairotic API (api/…). Pure logic: no audio of its own.
(let [;; ── what it understands ──
      flush-every 2          ; seconds between two writes into the freqt (each write is one event of the history)
      max-points 64          ; points of a stroke in glide mode
      cents (fn [a b] (* 1200 (/ (js/Math.log (/ b a)) js/Math.LN2)))
      ;; the pitch a note holds longest: pitch~ only sends what changed, so a steady note is one point and
      ;; its attack many; each pitch weighs the time until the next one
      held (fn [pts t1]
             (let [ws (map (fn [[t f] [t2 _]] [f (max 0 (- t2 t))]) pts (concat (rest pts) [[t1 nil]]))
                   total (reduce + (map second ws))
                   sorted (sort-by first ws)]
               (if (pos? total)
                 (loop [[[f w] & more] sorted acc 0]
                   (let [acc (+ acc w)] (if (or (>= acc (/ total 2)) (empty? more)) f (recur more acc))))
                 (second (last pts)))))
      mode-of (fn [args] (if (= :glide (:mode args)) :glide :notes))
      beats (fn [state at] (* (- at (:t0 state)) (/ (:bpm state) 60)))
      r3 (fn [x] (/ (js/Math.round (* x 1000)) 1000))
      ;; ── a note that ends: a stroke, if it lasted long enough ──
      stroke-of (fn [{:keys [pts]} t1 mode]
                  (let [t0 (ffirst pts) hz (held pts t1)]
                    (if (= mode :glide)
                      (let [kept (reduce (fn [acc [t f]]
                                           (if (> (js/Math.abs (cents (second (peek acc)) f)) 10) (conj acc [t f]) acc))
                                         [(first pts)] (rest pts))
                            kept (if (> (count kept) max-points)
                                   (vec (take-nth (js/Math.ceil (/ (count kept) max-points)) kept))
                                   kept)]
                        (mapv (fn [[t f]] [(r3 t) (r3 f)]) (conj kept [t1 (second (peek pts))])))
                      [[(r3 t0) (r3 hz)] [(r3 t1) (r3 hz)]])))
      end-note (fn [state t]
                 (if-let [cur (:cur state)]
                   (let [t0 (ffirst (:pts cur))
                         long-enough (>= (/ (- t t0) (/ (:bpm state) 60)) (/ (:min-ms state) 1000))]
                     (cond-> (dissoc state :cur)
                       long-enough (update :done conj (stroke-of cur t (:mode state)))
                       long-enough (update :count inc)))
                   state))
      start-note (fn [state t hz] (assoc state :cur {:pts [[t hz]] :midi (api/hz->midi hz)}))
      ;; ── writing: the strokes that ended, as one [:batch …], at most every flush-every seconds ──
      flush (fn [state at force]
              (cond
                (empty? (:done state)) [state nil nil]
                (or force (nil? (:sent state)) (>= (- at (:sent state)) flush-every))
                ;; the first write of a take clears the freqt (as part of the same event)
                [(assoc state :done [] :sent at :pending false :fresh false)
                 [:batch (into (if (:fresh state) [[:clear]] []) (mapv (fn [pts] [:stroke pts]) (:done state)))] nil]
                (:pending state) [state nil nil]
                :else [(assoc state :pending true) nil [(+ (:sent state) flush-every) 0 [:flush]]]))
      result (fn [state [st edit later]]
               (cond-> {:state st :show (select-keys st [:on :count])}
                 edit (assoc :out [[0 edit]])
                 later (assoc :later [later])))
      ;; ── one value of pitch~ (Hz, 0 when it hears none) ──
      hear (fn [state hz at]
             (let [t (beats state at)
                   cur (:cur state)
                   state (cond
                           (not (pos? hz)) (end-note state t)
                           (nil? cur) (start-note state t hz)
                           ;; notes: another note when the pitch moves more than 0.6 of a semitone away
                           (and (= :notes (:mode state)) (> (js/Math.abs (- (api/hz->midi hz) (:midi cur))) 0.6))
                           (-> state (end-note t) (start-note t hz))
                           :else (update-in state [:cur :pts] conj [t hz]))]
               (flush state at false)))]
  {;; ── about ──
   :class "transcribe"
   :license "MPL-2.0"
   :doc "Writes what pitch~ hears into a freqt, as strokes. Hz on the left (from pitch~: 0 when it hears none), rec to start from 0 (its first write clears the freqt) and stop to end; a bang on the right (from onset~) begins a new note even on the same pitch. In notes mode each note is a flat stroke at the pitch it holds longest (the freqt's tuning, or its score view, rounds it); in glide mode a stroke follows the pitch as it moves. Times are beats at bpm (60: one beat a second). Notes shorter than ms (60) are left out. It writes into the freqt at most every 2 seconds, each time one event of the history. Connect its outlet to the freqt's inlet."
   :usage "transcribe [bpm] [notes|glide] [ms]"
   :io [2 1]
   :size [124 30]
   :args [[:bpm 60] [:mode nil] [:min-ms 60]]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (let [state (or state {})]
                (cond
                  (= value :rec)
                  {:state {:on true :t0 at :bpm (api/clamp (:bpm args) 10 400) :mode (mode-of args)
                           :min-ms (api/clamp (:min-ms args) 0 2000) :done [] :count 0 :fresh true}
                   :show {:on true :count 0}}
                  (not (:on state)) {}
                  (= value :stop)
                  (let [st (end-note state (beats state at))
                        [st edit _] (flush st at true)]
                    (cond-> {:state (assoc st :on false) :show {:on false :count (:count st)}}
                      edit (assoc :out [[0 edit]])))
                  (= value [:flush]) (result state (flush (assoc state :pending false) at false))
                  ;; an onset: the note that sounds ends here and a new one begins at its pitch
                  (and (= inlet 1) (:cur state))
                  (let [t (beats state at) hz (second (peek (get-in state [:cur :pts])))]
                    (result state (flush (-> state (end-note t) (start-note t hz)) at false)))
                  (and (= inlet 0) (number? value)) (result state (hear state value at))
                  :else {})))

   ;; ── view ──
   :derive (fn [{:keys [shown]}]
             {:label (if (:on shown) (str "● transcribing · " (or (:count shown) 0)) (str "transcribe · " (or (:count shown) 0) " notes"))})
   :view [[:rect {:x 2 :y 2 :w 120 :h 26 :r 3 :stroke :grid :fill :bg}]
          [:text {:x 8 :y 19 :size 10 :fill :soft} :$label]]})
