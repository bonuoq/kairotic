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
;; Without a clock (nothing on the right) it finds the pulse itself: the longest one that the intervals
;; between onsets fill as whole numbers of it (the simplest grid that fits them, after Sethares' periodicity),
;; each interval rounded on its own from the last onset back, so that a tempo that moves does not shift the old
;; onsets; the phase is then said at each onset, of the pulse that onset is on — and between them it keeps
;; time: from the last onset judged, a beat each pulse (the box sends itself [:beat …] a pulse later, with ▶),
;; the phase walking on, until an onset comes (it takes over, early or late, and says nothing twice) or a whole
;; cycle passes without one (the performer stopped: it waits).
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
                 :window w :n n :pulse pulse}))
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
      onset (fn [st t] {:state (assoc st :onsets (conj (vec (take-last 256 (:onsets st))) t))})
      ;; ── without a clock ──
      ;; the pulse: of the last intervals (a pause of 2 s or more is not one), the longest T that fills them as
      ;; whole numbers of T — the fit (the mean square of what is left over) plus a small price for each T in
      ;; them, so that the simplest grid wins over a finer one that fits as well —, then T by least squares
      pulse-of (fn [os]
                 (let [ds (vec (take-last 8 (filter (fn [d] (< 0.05 d 2)) (map - (rest os) os))))
                       nd (count ds)]
                   (when (>= nd 2)
                     (:T (reduce (fn [best [d k]]
                                   (let [T (/ d k)]
                                     (if (< T 0.06) best
                                         (let [ks (mapv (fn [x] (max 1 (js/Math.round (/ x T)))) ds)
                                               err (/ (reduce + (map (fn [x q] (let [e (- (/ x T) q)] (* e e))) ds ks)) nd)
                                               c (+ err (* 0.004 (/ (reduce + ks) nd)))]
                                           (if (or (nil? best) (< c (- (:c best) 1e-9)))
                                             {:c c :T (/ (reduce + (map * ds ks)) (reduce + (map * ks ks)))}
                                             best)))))
                                 nil (for [d ds k (range 1 7)] [d k]))))))
      ;; where each onset falls, in pulses before the last one (0): each interval rounded on its own, back to a
      ;; pause or to a cycle ago
      offsets (fn [os T n]
                (loop [i (dec (count os)) q 0 qs [0]]
                  (if (pos? i)
                    (let [d (- (nth os i) (nth os (dec i)))]
                      (if (>= d 2) qs
                          (let [q (- q (max 1 (js/Math.round (/ d T))))]
                            (if (<= q (- n)) qs (recur (dec i) q (conj qs q))))))
                    qs)))
      free (fn [st t]
             (let [os (conj (vec (take-last 31 (:onsets st))) t)
                   st (assoc st :onsets os)
                   ref (:ref st) n (count ref)
                   T (pulse-of os)]
               (cond
                 (not ref) {:state st :show "no reference yet (middle)"}
                 (nil? T) {:state st :show "listening · finding the pulse"}
                 :else
                 (let [qs (offsets os T n) m (inc (- (apply min qs)))
                       w (reduce (fn [w q] (assoc w (+ (dec m) q) 1)) (vec (repeat m 0)) qs)
                       prev (:free st)
                       ;; the walk: the phase before, moved on by the pulses since
                       expected (when prev (mod (+ (:phase prev) (js/Math.round (/ (- t (:t prev)) T))) n))
                       raw (vec (for [ph (range n)] (cost ref w ph)))
                       cs (vec (map-indexed (fn [ph c] (+ c (if (and expected (not= ph expected)) 0.75 0))) raw))
                       best (apply min cs)
                       ph (first (keep-indexed (fn [i c] (when (= c best) i)) cs))
                       second-best (apply min (or (seq (keep-indexed (fn [i c] (when (not= i ph) c)) raw)) [(nth raw ph)]))
                       srt (sort raw) gap (- (or (second srt) (first srt)) (first srt))
                       ;; the first phase only from five onsets (four intervals: with fewer, a slower grid can fit
                       ;; them as well when the hands are loose) and when one rotation is nearer than every other
                       ;; (a swap at least); after it, three onsets in the cycle and the walk
                       ready (and (>= m (:min st))
                                  (if prev (>= (count (onsets-of w)) 3) (and (>= (count (onsets-of w)) 5) (>= gap 1))))
                       j {:phase ph :distance (nth raw ph) :margin (- second-best (nth raw ph)) :heard m :window w :n n :pulse T}]
                   (if-not ready
                     {:state st :show (str "listening · " m "/" (:min st))}
                     (let [gen (inc (or (:gen st) 0))
                           ;; a beat already said this pulse a moment ago (the onset came late): not said again
                           said (:beat st)
                           again (and said (= (:phase said) ph) (< (js/Math.abs (- t (:at said))) (/ T 2)))]
                       {:state (assoc st :free {:phase ph :t t} :gen gen :T T :beat {:phase ph :at t})
                        :show (str "pulse " ph " of " n " · " (js/Math.round (* 1000 T)) " ms · distance " (nth raw ph))
                        :out (if again [[1 j]] [[1 j] [0 ph]])
                        ;; the next pulse, kept by the box until an onset comes (a new generation forgets this one)
                        :later [[(+ t T) 0 [:beat gen (mod (inc ph) n)]]]}))))))
      ;; a beat kept between onsets: the phase walks on, a pulse at a time, for a cycle after the last onset
      beat (fn [st t [_ g p]]
             (let [n (count (:ref st)) T (:T st) last-on (:t (:free st))]
               (cond
                 (or (not= g (:gen st)) (seq (:ticks st)) (nil? T) (zero? n) (nil? last-on)) {}
                 (> (- t last-on) (+ (* n T) (/ T 2)))
                 {:state (assoc st :gen (inc g) :beat nil) :show "waiting · a cycle without onsets"}
                 :else
                 {:state (assoc st :beat {:phase p :at t})
                  :show (str "pulse " p " of " n " · " (js/Math.round (* 1000 T)) " ms · keeping time")
                  :out [[1 {:phase p :n n :pulse T :kept true}] [0 p]]
                  :later [[(+ t T) 0 [:beat g (mod (inc p) n)]]]})))]
  {;; ── about ──
   :class "phase"
   :license "MPL-2.0"
   :doc "Where a performer is in a cycle, from the onsets heard (discussion #204): a timeline follower, onsets only. The right inlet is the pulse clock (a metro or the room's pulse, a bang a pulse), the left one the onsets (onset~'s bangs, or taps), each falling on its nearest pulse; the middle one the reference, as pulses (cold: a clave, a bell pattern, euclid's or a necklace's). At each pulse the last pulses heard are compared with every rotation of the reference (Toussaint's swap distance, two more for each onset one has and the other has not): the nearest says which pulse of the reference this is — the phase, sent on the left once enough is heard (min pulses, half the cycle by default, and two onsets). The pulse that just began is not judged (its onset may come a moment late, as onset~ hears it): the last whole pulse is found and this one is the next. Ties and near ties (less than a swap and a half) go to the phase the walk expects, so a few missing or extra onsets do not throw it. Into a necklace's clock inlet the phase moves its hand there and plays it. Without a clock (nothing has come on the right) it finds the pulse from the onsets themselves — the longest pulse that the intervals between them fill as whole numbers of it, each interval rounded on its own so that a tempo that moves is followed — and says the phase at each onset, of the pulse that onset is on (the first from five onsets, and only when one rotation is nearer than every other); between onsets it keeps time (with ▶): a beat each pulse, the phase walking on, until the next onset takes over (early or late, nothing said twice) or a whole cycle passes without one. Out on the right: {:phase :distance (0: exactly the reference) :margin (how much nearer than the next guess: 0 is ambiguous) :heard :window :n :pulse (in seconds)}, or for a kept beat {:phase :n :pulse :kept true}. :reset forgets what was heard (and the clock)."
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
                  1 (if (pulses? value) {:state (assoc st :ref (vec value) :min (min-of value) :phase nil :free nil :gen (inc (or (:gen st) 0)) :beat nil)} {})
                  2 (if (#{:bang} value) (tick st t) {})
                  (cond (#{:reset} value) {:state (assoc st :ticks [] :onsets [] :phase nil :free nil :gen (inc (or (:gen st) 0)) :beat nil :T nil) :show "listening"}
                        (and (vector? value) (= :beat (first value))) (beat st t value)
                        ;; with a clock the onsets wait for its pulses; without one, each is judged as it comes
                        (or (#{:bang} value) (number? value)) (if (seq (:ticks st)) (onset st t) (free st t))
                        :else {}))))})
