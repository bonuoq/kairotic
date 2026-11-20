;; phase · where a performer is in a cycle, from the onsets heard (discussion #204)
;; Part of @kairotic/rhythm. Written against the Kairotic API (api/…).
;; Before following a score, follow a timeline: a clave, a bell pattern, any rhythm that repeats. A pulse
;; clock (a metro or the room's pulse, one bang a pulse) gives the grid; onsets (onset~'s bangs, or taps)
;; fall on its nearest pulse. At each pulse the last pulses heard are compared with the reference
;; (Toussaint's swap distance, on every rotation of the reference): the rotation that brings them nearest
;; says which pulse of the reference this one is — the phase. Into a necklace's clock inlet, the phase moves
;; its hand there (and plays it); times a pulse's beats, it is a player's position. Ties (a symmetric rhythm,
;; few onsets yet) go to the pulse after the last phase, so the phase walks on unless what is heard says
;; otherwise. Only onsets, no pitch: "time by occasion" at its smallest.
(let [onsets-of (fn [ps] (vec (keep-indexed (fn [i x] (when (= 1 x) i)) ps)))
      pulses? (fn [v] (and (sequential? v) (seq v) (every? #{0 1} v)))
      ;; the directed swap distance between two lists of onsets of one segment (each onset of the shorter
      ;; list to its own of the other, in order, the least moving in all)
      assign (fn [us vs]
               (let [[a b] (if (<= (count us) (count vs)) [us vs] [vs us]) p (count a) q (count b)]
                 (if (zero? p) 0
                     (loop [i 0 row (vec (repeat (inc q) 0))]
                       (if (= i p) (peek row)
                           (recur (inc i)
                                  (reduce (fn [nr j] (conj nr (min (if (> j (inc i)) (peek nr) js/Infinity)
                                                                   (+ (nth row (dec j)) (js/Math.abs (- (nth a i) (nth b (dec j))))))))
                                          [js/Infinity] (range 1 (inc q)))))))))
      ;; how far the window w (the last m pulses heard, the last one now) is from the reference read so that
      ;; now is its pulse ph: the swaps between them, and two for each onset one has and the other has not
      continuity 1.5
      cost (fn [ref w ph]
             (let [n (count ref) m (count w)
                   seg (mapv (fn [i] (nth ref (mod (+ (- ph (dec m)) i) n))) (range m))
                   a (onsets-of w) b (onsets-of seg)]
               (+ (assign a b) (* 2 (js/Math.abs (- (count a) (count b)))))))
      ;; at each pulse: what the pulses before it say. The pulse that just began is not judged — its onset may
      ;; come a moment late (onset~ hears the attack after it) —: the phase of the last whole pulse is found,
      ;; and this one is the next. Ties, and near ties (less than a swap and a half), go to the phase the walk
      ;; expects, so a few missing or extra onsets do not throw it
      judge (fn [st]
              (let [ref (:ref st) n (count ref)
                    ts (vec (take-last n (butlast (:ticks st)))) pulse (:pulse st)
                    ;; a pulse is an onset when one was heard within half a pulse of it
                    w (mapv (fn [t] (if (some (fn [o] (and (> o (- t (/ pulse 2))) (<= o (+ t (/ pulse 2))))) (:onsets st)) 1 0)) ts)
                    m (count w)
                    expected (:phase st)
                    raw (vec (for [ph (range n)] (cost ref w ph)))
                    cs (vec (map-indexed (fn [ph c] (+ c (if (and expected (not= ph expected)) continuity 0))) raw))
                    best (apply min cs)
                    ph (first (keep-indexed (fn [i c] (when (= c best) i)) cs))
                    second-best (apply min (or (seq (keep-indexed (fn [i c] (when (not= i ph) c)) raw)) [(nth raw ph)]))
                    ready (and pulse (>= m (:min st)) (>= (count (onsets-of w)) 2))]
                {:phase (mod (inc ph) n) :distance (nth raw ph) :margin (- second-best (nth raw ph)) :heard m :ready ready
                 :window w :n n}))
      tick (fn [st t]
             (let [ticks (vec (take-last 257 (conj (:ticks st) t)))
                   ;; the pulse: the median of the last intervals between bangs of the clock
                   ivs (sort (map - (rest (take-last 9 ticks)) (butlast (take-last 9 ticks))))
                   pulse (when (seq ivs) (nth ivs (quot (count ivs) 2)))
                   st (assoc st :ticks ticks :pulse pulse
                             :onsets (vec (filter (fn [o] (> o (- (first ticks) 1))) (:onsets st))))]
               (cond
                 (not (:ref st)) {:state st :show "no reference yet (middle)"}
                 (< (count ticks) 2) {:state st :show "listening"}
                 :else (let [j (judge st)]
                         (if-not (:ready j)
                           {:state st :show (str "listening · " (:heard j) "/" (:min st))}
                           {:state (assoc st :phase (:phase j))
                            :show (str "pulse " (:phase j) " of " (:n j) " · distance " (:distance j))
                            :out [[1 (dissoc j :ready)] [0 (:phase j)]]})))))
      onset (fn [st t] {:state (assoc st :onsets (conj (vec (take-last 256 (:onsets st))) t))})]
  {;; ── about ──
   :class "phase"
   :license "MPL-2.0"
   :doc "Where a performer is in a cycle, from the onsets heard (discussion #204): a timeline follower, onsets only. The right inlet is the pulse clock (a metro or the room's pulse, a bang a pulse), the left one the onsets (onset~'s bangs, or taps), each falling on its nearest pulse; the middle one the reference, as pulses (cold: a clave, a bell pattern, euclid's or a necklace's). At each pulse the last pulses heard are compared with every rotation of the reference (Toussaint's swap distance, two more for each onset one has and the other has not): the nearest says which pulse of the reference this is — the phase, sent on the left once enough is heard (min pulses, half the cycle by default, and two onsets). The pulse that just began is not judged (its onset may come a moment late, as onset~ hears it): the last whole pulse is found and this one is the next. Ties and near ties (less than a swap and a half) go to the phase the walk expects, so a few missing or extra onsets do not throw it. Into a necklace's clock inlet the phase moves its hand there and plays it. Out on the right: {:phase :distance (0: exactly the reference) :margin (how much nearer than the next guess: 0 is ambiguous) :heard :window :n}. :reset forgets what was heard."
   :usage "phase [min 0]"
   :io [3 2]

   ;; ── arguments ──
   :args [[:min 0]]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (let [t (or at (/ (js/Date.now) 1000))
                    st (or state {:ticks [] :onsets []})
                    min-of (fn [ref] (let [m (js/Math.round (or (:min args) 0))] (if (pos? m) m (max 2 (quot (count ref) 2)))))]
                (case inlet
                  1 (if (pulses? value) {:state (assoc st :ref (vec value) :min (min-of value) :phase nil)} {})
                  2 (if (#{:bang} value) (tick st t) {})
                  (cond (#{:reset} value) {:state (assoc st :ticks [] :onsets [] :phase nil) :show "listening"}
                        (or (#{:bang} value) (number? value)) (onset st t)
                        :else {}))))})
