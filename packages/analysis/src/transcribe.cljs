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
                       long-enough (update :done conj {:pts (stroke-of cur t (:mode state)) :acc (:acc cur)})
                       long-enough (update :count inc)))
                   state))
      ;; a note takes the strength of the onset that began it (a number on the right inlet, from onset~), if it
      ;; came at most 0.15 s before: onset~ often hears the attack before pitch~ hears the pitch
      start-note (fn [state t hz]
                   (let [[at s] (:acc state) acc (when (and at (<= (- t at) (* 0.15 (/ (:bpm state) 60)))) s)]
                     (cond-> (assoc state :cur (cond-> {:pts [[t hz]] :midi (api/hz->midi hz)} acc (assoc :acc acc)))
                       acc (dissoc :acc))))
      ;; how a note with the strength of its attack is written: the weight of its stroke, as an event's :amp is
      ;; (0 … 1 → 0.4 … 2.8 times the usual); the quantizer reads it back as the note's :vel (issue #106)
      edit-of (fn [{:keys [pts acc]}] (if (number? acc) [:stroke pts {:w (/ (js/Math.round (* 100 (+ 0.4 (* 2.4 acc)))) 100)}] [:stroke pts]))
      ;; ── writing: the strokes that ended, as one [:batch …], at most every flush-every seconds ──
      flush (fn [state at force]
              (let [now (r3 (beats state at))]
                (cond
                  ;; ovr at stop: what the take covered since the last write is overwritten, even by silence
                  (and (empty? (:done state)) (not (and force (:ovr state) (> now (:cut-from state))))) [state nil nil]
                  (or force (nil? (:sent state)) (>= (- at (:sent state)) flush-every))
                  ;; the first write of a take clears the freqt (as part of the same event); a take over (ovr)
                  ;; cuts what it covered since the last write, and keeps what comes after
                  [(cond-> (assoc state :done [] :sent at :pending false :fresh false)
                     (:ovr state) (assoc :cut-from now))
                   [:batch (into (cond (:ovr state) [[:cut (:cut-from state) now]]
                                       (:fresh state) [(if (:from state) [:cut (:from state)] [:clear])]
                                       :else [])
                                 (mapv edit-of (:done state)))] nil]
                  (:pending state) [state nil nil]
                  :else [(assoc state :pending true) nil [(+ (:sent state) flush-every) 0 [:flush]]])))
      result (fn [state [st edit later]]
               (cond-> {:state st :show (select-keys st [:on :count])}
                 edit (assoc :out [[0 edit]])
                 later (assoc :later [later])))
      ;; ── notes mode: the contour of each voiced stretch, segmented (issue #106, measured on cante2midi) ──
      ;; What pitch~ sends while a voice sounds is kept as a run of points; when the voice stops (or the run is long)
      ;; the run is read as a contour every 10 ms, smoothed by a median of 100 ms (vibrato and jitter), and cut into
      ;; notes with hysteresis: a note goes on while the contour stays within a semitone of its pitch; a new one
      ;; begins only where the contour, away from it, has held still (within 1.1 semitones) for 70 ms, so a slide
      ;; or an ornament that passes does not start notes. An onset (inlet 1) cuts there too. Each note is written
      ;; at the median pitch of its frames. Silences of 30 ms at most are bridged.
      median (fn [xs] (let [v (vec (sort xs))] (nth v (quot (count v) 2))))
      segment (fn [run marks t-end k minlen]
                (let [dt (* 0.01 k) w 5 band 1 stab 1.1 hold-n 7
                      ts (vec (range (ffirst run) t-end dt))
                      ;; the contour on the grid: each frame, the last point at or before it (as MIDI)
                      raw (loop [i 0 [p & more :as ps] run cur nil out (transient [])]
                            (if (>= i (count ts))
                              (persistent! out)
                              (let [t (ts i)]
                                (if (and p (<= (first p) (+ t 1e-9)))
                                  (recur i more (api/hz->midi (second p)) out)
                                  (recur (inc i) ps cur (conj! out cur))))))
                      n (count raw)
                      sm (mapv (fn [i] (median (subvec raw (max 0 (- i w)) (min n (+ i w 1))))) (range n))
                      cut? (fn [i] (let [a (if (pos? i) (ts (dec i)) (- (ts 0) dt)) b (ts i)] (some (fn [[mt]] (and (> mt a) (<= mt b))) marks)))
                      note (fn [s e ms] {:s s :e e :ms ms})
                      notes (loop [i 0 cur nil pend [] out []]
                              (if (>= i n)
                                (if cur (conj out (assoc cur :e t-end)) out)
                                (let [t (ts i) m (sm i)]
                                  (cond
                                    (nil? cur) (recur (inc i) (note t (+ t dt) [m]) [] out)
                                    (and (cut? i) (> t (:s cur))) (recur (inc i) (note t (+ t dt) [m]) [] (conj out (assoc cur :e t)))
                                    (<= (js/Math.abs (- m (median (take-last 24 (:ms cur))))) band)
                                    (recur (inc i) (assoc cur :e (+ t dt) :ms (into (conj (:ms cur) m) (map second pend))) [] out)
                                    :else
                                    (let [pend (conj pend [t m]) tail (take-last hold-n pend) tm (map second tail)]
                                      (if (and (>= (count pend) hold-n) (< (- (apply max tm) (apply min tm)) stab))
                                        ;; the new note begins where the contour left the old one; its pitch is that of where it settled
                                        (recur (inc i) (note (ffirst pend) (+ t dt) (vec tm)) [] (conj out (assoc cur :e (ffirst pend))))
                                        (recur (inc i) cur pend out)))))))]
                  (->> notes
                       (filter (fn [{:keys [s e]}] (>= (- e s) minlen)))
                       (mapv (fn [{:keys [s e ms]}]
                               (let [hz (api/midi->hz (median ms))
                                     ;; the strength of an onset heard at most 0.15 s before the note (or just after its start)
                                     acc (some (fn [[mt x]] (when (and (number? x) (<= (- s (* 0.15 k)) mt (+ s (* 0.05 k)))) x)) marks)]
                                 (cond-> {:pts [[(r3 s) (r3 hz)] [(r3 e) (r3 hz)]]} acc (assoc :acc acc))))))))
      ;; the run segmented into :done: all of it (the voice stopped at t-end), or all but its last note (a long run
      ;; still sounding: that note goes on in the run)
      settle (fn [state t-end all?]
               (let [run (:run state) k (/ (:bpm state) 60) minlen (* k (/ (:min-ms state) 1000))]
                 (if (or (empty? run) (<= t-end (ffirst run)))
                   (dissoc state :run :silent)
                   (let [ns (segment run (:marks state) t-end k minlen)
                         [keep-ns rest-from] (if (or all? (< (count ns) 2)) [ns nil] [(pop ns) (ffirst (:pts (peek ns)))])
                         state (-> state (update :done into keep-ns) (update :count + (count keep-ns)))]
                     (if rest-from
                       (let [before (last (filter (fn [[t]] (<= t rest-from)) run))]
                         (assoc state :run (into [[rest-from (second before)]] (filter (fn [[t]] (> t rest-from)) run))
                                      :marks (filterv (fn [[t]] (>= t (- rest-from (* 0.15 k)))) (:marks state))))
                       (-> state (dissoc :run :silent) (assoc :marks (filterv (fn [[t]] (> t t-end)) (:marks state)))))))))
      ;; a silence that lasted more than 30 ms: the run ends where it began
      settled (fn [state t]
                (if (and (:silent state) (> (- t (:silent state)) (* 0.03 (/ (:bpm state) 60))))
                  (settle state (:silent state) true)
                  state))
      hear-notes (fn [state hz t]
                   (let [k (/ (:bpm state) 60)
                         state (settled state t)]
                     (cond
                       (not (pos? hz)) (if (and (seq (:run state)) (nil? (:silent state))) (assoc state :silent t) state)
                       :else (let [state (-> state (dissoc :silent) (update :run (fnil conj []) [t hz]))]
                               ;; a run of 8 s and more: what is settled is written, the last note goes on
                               (if (> (- t (ffirst (:run state))) (* 8 k)) (settle state t false) state)))))
      ;; ── one value of pitch~ (Hz, 0 when it hears none) ──
      hear (fn [state hz at]
             (let [t (beats state at)
                   cur (:cur state)
                   state (cond
                           (= :notes (:mode state)) (hear-notes state hz t)
                           (not (pos? hz)) (end-note state t)
                           (nil? cur) (start-note state t hz)
                           :else (update-in state [:cur :pts] conj [t hz]))
                   [st edit later] (flush state at false)]
               ;; the voice stopped: a look again in a little while, to write its notes even if nothing else arrives
               [st edit (or later (when (and (:silent st) (not (:pending st))) [(+ at 0.05) 0 [:flush]]))]))]
  {;; ── about ──
   :class "transcribe"
   :license "MPL-2.0"
   :doc "Writes what pitch~ hears into a freqt, as strokes. Hz on the left (from pitch~: 0 when it hears none), rec to start from 0 (its first write clears the freqt) or rec t (msg rec 8) to start from beat t, keeping what is before it, or ovr t (msg ovr 8) to write over only what the take covers, keeping what comes after and stop to end; a bang on the right (from onset~) begins a new note even on the same pitch, and a number there (onset~'s strength, 0…1) does too and gives the note that weight: its stroke is written heavier (as an event's :amp), and the quantizer reads it as the note's :vel, which helps find the beat and the bar (issue #106). In notes mode the contour of each voiced stretch is cut into notes where it settles on another pitch (a slide, a vibrato or an ornament that passes does not start notes; an onset on the right does), each a flat stroke at its median pitch (the freqt's tuning, or its score view, rounds it), written when the voice stops; in glide mode a stroke follows the pitch as it moves. Times are beats at bpm (60: one beat a second). Notes shorter than ms (80) are left out. It writes into the freqt at most every 2 seconds, each time one event of the history. Connect its outlet to the freqt's inlet."
   :usage "transcribe [bpm] [notes|glide] [ms]"
   :io [2 1]
   :size [124 30]
   :args [[:bpm 60] [:mode nil] [:min-ms 80]]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (let [state (or state {})]
                (cond
                  ;; rec: a take from 0 (its first write clears the freqt); [:rec t] (msg rec 8): from beat t on,
                  ;; keeping what is before t (punch-in)
                  ;; ovr t (msg ovr 8): over what is there from beat t to where the take stops, keeping what comes after
                  (or (#{:rec :ovr} value) (and (vector? value) (#{:rec :ovr} (first value))))
                  (let [bpm (api/clamp (:bpm args) 10 400)
                        ovr (or (= value :ovr) (and (vector? value) (= :ovr (first value))))
                        from (or (when (vector? value) (let [x (second value)] (when (and (number? x) (>= x 0)) x)))
                                 (when ovr 0))]
                    {:state (cond-> {:on true :t0 (- at (* (or from 0) (/ 60 bpm))) :bpm bpm :mode (mode-of args)
                                     :min-ms (api/clamp (:min-ms args) 0 2000) :done [] :count 0 :fresh true}
                              from (assoc :from from)
                              ovr (assoc :ovr true :cut-from from))
                     :show {:on true :count 0}})
                  (not (:on state)) {}
                  (= value :stop)
                  (let [t (beats state at)
                        st (if (seq (:run state)) (settle state (or (:silent state) t) true) state)
                        st (end-note st t)
                        [st edit _] (flush st at true)]
                    (cond-> {:state (assoc st :on false) :show {:on false :count (:count st)}}
                      edit (assoc :out [[0 edit]])))
                  (= value [:flush]) (result state (flush (settled (assoc state :pending false) (beats state at)) at false))
                  ;; an onset (a bang, or its strength 0…1 from onset~'s second outlet): the note that sounds ends
                  ;; here and a new one begins at its pitch, with that strength; in silence, the strength waits for
                  ;; the next note to begin
                  (and (= inlet 1) (= :notes (:mode state)))
                  {:state (update state :marks (fnil conj []) [(beats state at) (when (number? value) (api/clamp value 0 1))])}
                  (= inlet 1)
                  (let [t (beats state at)
                        state (if (number? value) (assoc state :acc [t (api/clamp value 0 1)]) state)]
                    (if (:cur state)
                      (let [hz (second (peek (get-in state [:cur :pts])))]
                        (result state (flush (-> state (end-note t) (start-note t hz)) at false)))
                      {:state state}))
                  (and (= inlet 0) (number? value)) (result state (hear state value at))
                  :else {})))

   ;; ── view ──
   :derive (fn [{:keys [shown]}]
             {:label (if (:on shown) (str "● transcribing · " (or (:count shown) 0)) (str "transcribe · " (or (:count shown) 0) " notes"))})
   :view [[:rect {:x 2 :y 2 :w 120 :h 26 :r 3 :stroke :grid :fill :bg}]
          [:text {:x 8 :y 19 :size 10 :fill :soft} :$label]]})
