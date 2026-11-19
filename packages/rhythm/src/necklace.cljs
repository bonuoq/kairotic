;; necklace · a cyclic rhythm on the circle, and its geometry (Toussaint)
;; Part of @kairotic/rhythm. Written against the Kairotic API (api/…).
;; A rhythm that repeats is a necklace: k onsets among n pulses around a circle, time clockwise from the
;; top. Seen so, it is the same object as a pitch-class set on pcclock, and the same geometry measures it
;; (Toussaint, "The Geometry of Musical Rhythm"): its full-interval vector (how often each distance between
;; onsets occurs), its evenness (the sum of the chords between all pairs of onsets, after Block and Douthett;
;; arcs are too coarse: the six 4/4 claves would all score the same), whether it is deep (each distance a
;; different number of times, as the diatonic scale and the bembé), flat (each distance once), its axes of
;; mirror symmetry, its longest gap, rhythmic oddity (no two onsets halving the cycle), and whether it is a
;; rotation of the Euclidean rhythm E(k,n) — and its Fourier coefficients (after Amiot and Milne): |f1| near 0
;; is a balanced rhythm, a maximal |f_k| among the rhythms of k onsets a maximally even one, and the others its
;; periodicities (in 16 pulses f4 the quarter notes, f3 a three against the four).
;; It is the rhythm box: generators (euclid) make pulses, the necklace holds them, shows them, is their editor
;; (pressing a pulse adds or takes away an onset), measures them and writes them as a musical tree, its :rtm
;; map and its pulses, with the pitches of its right inlet (talea and color).
(let [TAU (* 2 js/Math.PI)
      bjorklund (fn [k n]
                  (cond (<= n 0) []
                        (<= k 0) (vec (repeat n 0))
                        (>= k n) (vec (repeat n 1))
                        :else (loop [a (vec (repeat k [1])) b (vec (repeat (- n k) [0]))]
                                (if (<= (count b) 1)
                                  (vec (apply concat (concat a b)))
                                  (let [m (min (count a) (count b))]
                                    (recur (mapv into (subvec a 0 m) (subvec b 0 m))
                                           (if (> (count a) m) (subvec a m) (subvec b m))))))))
      rotate (fn [xs r] (let [n (count xs)] (if (zero? n) xs (let [r (mod r n)] (vec (concat (subvec xs r) (subvec xs 0 r)))))))
      onsets-of (fn [ps] (vec (keep-indexed (fn [i x] (when (= 1 x) i)) ps)))
      intervals-of (fn [ps] (let [os (onsets-of ps) n (count ps)]
                              (if (empty? os) [] (mapv (fn [a b] (- b a)) os (conj (subvec os 1) (+ n (first os)))))))
      shares-of (fn [ps] (let [os (onsets-of ps) n (count ps)]
                           (cond (zero? n) []
                                 (empty? os) [(- n)]
                                 :else (vec (concat (when (pos? (first os)) [(- (first os))])
                                                    (map (fn [a b] (- b a)) os (conj (subvec os 1) n)))))))
      r3 (fn [x] (/ (js/Math.round (* 1000 x)) 1000))
      ;; ── what arrives, as pulses (ones and zeros), or nil when it is not a rhythm ──
      whole? (fn [x] (and (number? x) (== x (js/Math.round x))))
      from-shares (fn [sh] (when (and (sequential? sh) (seq sh) (every? (fn [x] (and (whole? x) (not (zero? x)))) sh))
                             (vec (mapcat (fn [x] (if (pos? x) (cons 1 (repeat (dec x) 0)) (repeat (- x) 0))) sh))))
      from-onsets (fn [os n] (when (and (whole? n) (pos? n) (sequential? os) (every? whole? os))
                               (let [on (set (map (fn [o] (mod o n)) os))] (mapv (fn [i] (if (on i) 1 0)) (range n)))))
      ;; the first :rtm of a tree (as euclid sends it)
      rtm-in (fn rtm-in [t] (when (sequential? t)
                              (if (= :rtm (first t)) (second t) (some rtm-in (filter sequential? t)))))
      ;; a list: ones and zeros are pulses; other whole numbers, the intervals between onsets (3 3 2)
      pulses-of-list (fn [v] (when (and (sequential? v) (seq v) (every? whole? v))
                               (if (every? #{0 1} v) (vec v) (when (every? pos? v) (from-shares v)))))
      pulses-of (fn [v]
                  (cond
                    ;; box notation (TUBS): "x..x..x." (x, X or 1 an onset; . - _ or 0 a pulse without one)
                    (string? v) (let [cs (remove #{" "} (seq v))]
                                  (when (and (seq cs) (every? #{"x" "X" "1" "." "-" "_" "0"} cs))
                                    (mapv (fn [c] (if (#{"x" "X" "1"} c) 1 0)) cs)))
                    (map? v) (cond (contains? v :shares) (from-shares (:shares v))
                                   (contains? v :pulses) (pulses-of-list (:pulses v))
                                   (contains? v :onsets) (from-onsets (:onsets v) (:n v)))
                    (and (sequential? v) (keyword? (first v))) (some-> (rtm-in v) :shares from-shares)
                    :else nil))
      ;; ── its geometry ──
      dist (fn [n a b] (let [d (js/Math.abs (- a b))] (min d (- n d))))
      pairs (fn [os] (for [i (range (count os)) j (range (inc i) (count os))] [(nth os i) (nth os j)]))
      ivec-of (fn [n os] (let [c (frequencies (map (fn [[a b]] (dist n a b)) (pairs os)))]
                           (mapv (fn [d] (get c d 0)) (range 1 (inc (quot n 2))))))
      evenness-of (fn [n os] (reduce + 0 (map (fn [[a b]] (* 2 (js/Math.sin (/ (* js/Math.PI (dist n a b)) n)))) (pairs os))))
      ;; the axes of mirror symmetry, in pulses: x → a − x keeps the set; the axis passes through a/2 (and a/2 + n/2)
      axes-of (fn [n os] (let [s (set os)]
                           (if (empty? s) []
                               (vec (for [a (range n) :when (= s (set (map (fn [x] (mod (- a x) n)) os)))] (/ a 2))))))
      ;; the Fourier coefficients of the onsets, f1 … f⌊n/2⌋: magnitudes 0…1 (over k) and phases in degrees
      fourier-of (fn [n os]
                   (let [k (count os)]
                     (vec (for [j (range 1 (inc (quot n 2)))]
                            (if (zero? k) [0 0]
                                [(/ (reduce + (map (fn [x] (js/Math.cos (/ (* TAU j x) n))) os)) k)
                                 (- (/ (reduce + (map (fn [x] (js/Math.sin (/ (* TAU j x) n))) os)) k))])))))
      measures (fn [ps]
                 (let [n (count ps) os (onsets-of ps) k (count os) iv (ivec-of n os) ev (evenness-of n os)
                       e (bjorklund k n) eev (evenness-of n (onsets-of e))
                       er (first (filter (fn [r] (= ps (rotate e r))) (range (max n 1))))]
                   {:n n :k k :onsets os :intervals (intervals-of ps) :ivec iv
                    :evenness (r3 ev) :even (if (pos? eev) (r3 (/ ev eev)) 1)
                    :deep (and (>= k 2) (= (count (distinct iv)) (count iv)))
                    :flat (and (seq iv) (every? #{1} iv))
                    :axes (axes-of n os)
                    :gap (if (seq os) (apply max (intervals-of ps)) n)
                    :oddity (or (odd? n) (not-any? (fn [[a b]] (= (* 2 (dist n a b)) n)) (pairs os)))
                    :euclid er
                    :fourier (mapv (fn [[a b]] (r3 (js/Math.hypot a b))) (fourier-of n os))
                    :phases (mapv (fn [[a b]] (if (< (js/Math.hypot a b) 1e-9) 0 (r3 (* (/ 180 js/Math.PI) (js/Math.atan2 b a))))) (fourier-of n os))}))
      fourier? (fn [args] (some (fn [a] (= "fourier" (if (keyword? a) (name a) (str a)))) (if (map? args) (when (:fourier args) [:fourier]) args)))
      ;; ── as euclid sends a rhythm: the meter of a bar of n pulses, the pitches, the color over bars ──
      pow2? (fn [x] (and (pos? x) (== x (js/Math.pow 2 (js/Math.round (js/Math.log2 x))))))
      meter-of (fn [n] (cond (and (>= n 4) (pow2? n)) [4 4]
                             (and (>= n 12) (zero? (mod n 3)) (pow2? (/ n 3))) [12 8]
                             (< n 4) [n 4]
                             (<= n 12) [n 8]
                             :else [n 16]))
      meter-arg (fn [v] (cond (and (sequential? v) (= 2 (count v)) (every? number? v)) (vec v)
                              (string? v) v
                              (keyword? v) (name v)
                              :else nil))
      hz->m (fn [x] (when (and (number? x) (pos? x)) (/ (js/Math.round (* 1000 (+ 69 (* 12 (js/Math.log2 (/ x 440)))))) 1000)))
      pitches-of (fn [midi? v]
                   (let [p (fn [x] (if midi? x (hz->m x)))]
                     (cond (#{:clear} v) nil
                           (map? v) (cond (or (contains? v :pitches) (contains? v :pitch)) (select-keys v [:pitches :pitch])
                                          (sequential? (:note v)) {:pitches (mapv (fn [x] (if (number? x) x "r")) (:note v))}
                                          :else :ignore)
                           (string? v) {:pitches v}
                           (number? v) (if-let [m (p v)] {:pitch m} :ignore)
                           (and (sequential? v) (keyword? (first v))) {:pitches [v]}
                           (and (sequential? v) (seq v) (every? number? v)) (let [ms (vec (keep p v))] (if (seq ms) {:pitches ms} :ignore))
                           (and (sequential? v) (seq v)) {:pitches (vec v)}
                           :else :ignore)))
      tokens (fn [ps] (cond (string? ps) (vec (remove #{""} (.split (.trim ps) (js/RegExp. "\\s+"))))
                            (sequential? ps) (vec ps)
                            :else nil))
      color-at (fn [pm skip]
                 (let [ts (tokens (:pitches pm))]
                   (if (or (empty? ts) (zero? (mod skip (count ts))))
                     pm
                     (let [r (mod skip (count ts)) ts2 (vec (concat (subvec ts r) (subvec ts 0 r)))]
                       (assoc pm :pitches (if (string? (:pitches pm)) (apply str (interpose " " ts2)) ts2))))))
      rhythm (fn [ps st]
               (let [k (count (onsets-of ps)) bars (:bars st) meter (or (:meter st) (meter-of (count ps)))
                     rtm (merge {:shares (shares-of ps)} (or (:pm st) {}))
                     bar (fn [i] (let [a (color-at rtm (* i k))]
                                   (if (zero? i) [:measure {:meter meter} [:rtm a]] [:measure [:rtm a]])))]
                 {:rtm rtm :tree (into [:voice] (map bar (range bars)))}))
      ;; what goes out (the last first, as Max does): the measures (3), the pulses (2), the :rtm map (1), the tree (0)
      outs (fn [ps st] (let [r (rhythm ps st)] [[3 (measures ps)] [2 ps] [1 (:rtm r)] [0 (:tree r)]]))
      ;; a new state: sent when the rhythm, its bars or its meter are new (the same again changes nothing); a bang anyway
      settle (fn [st st2 always?]
               (let [ps (:pulses st2) key [ps (:bars st2) (:meter st2)]
                     hand (when (:hand st2) (mod (:hand st2) (count ps)))
                     show (assoc (measures ps) :pulses ps :hand hand)
                     st2 (assoc st2 :hand hand :shown show)]
                 (cond (empty? ps) {:state st2}
                       (and (not always?) (= key (:sent st))) {:state st2 :show show}
                       :else {:state (assoc st2 :sent key) :show show :out (outs ps st2)})))
      ;; a step of the hand (the third inlet): to pulse h, and a bang out of outlet 4 when there is an onset there
      step (fn [st h]
             (let [ps (:pulses st) h (mod h (count ps))
                   show (assoc (or (:shown st) (assoc (measures ps) :pulses ps)) :hand h)]
               (cond-> {:state (assoc st :hand h :shown show) :show show}
                 (= 1 (nth ps h)) (assoc :out [[4 :bang]]))))
      polar (fn [cx cy R i n] (let [a (* TAU (/ i n))] [(+ cx (* R (js/Math.sin a))) (- cy (* R (js/Math.cos a)))]))]
  {;; ── about ──
   :class "necklace"
   :license "MPL-2.0"
   :doc "A cyclic rhythm on the circle and its geometry (Toussaint): k onsets among n pulses around a circle, time clockwise from the top — the same object as a pitch-class set on pcclock. A rhythm arrives as pulses (ones and zeros, as euclid's right outlet sends them), as intervals between onsets ([3 3 2]), as box notation (\"x..x..x.\"), as an :rtm map ({:shares [3 3 2]}, euclid's middle outlet), a tree with an :rtm, or {:onsets [0 3 6] :n 8}; it is drawn as a polygon, with its axes of mirror symmetry. Pressing a pulse (or a number, its index) adds or takes away an onset. :complement swaps onsets and silences, [:rotate 1] starts it a pulse later, [:n 12] makes the circle longer or shorter, :clear empties it, [:bars 4] and [:meter \"3/4\"] as euclid, a bang sends it again. Out, as euclid: a musical tree (left: a bar of n pulses with an :rtm whose shares are the intervals between onsets), the :rtm map alone (1), the pulses (2); and its measures (3): {:n :k :onsets :intervals :ivec — how often each distance occurs —, :evenness — the sum of the chords between all pairs (Block and Douthett) —, :even — that sum against the Euclidean rhythm's, 1 as even as it —, :deep — each distance a different number of times —, :flat — each once —, :axes — of mirror symmetry, in pulses —, :gap — the longest interval —, :oddity — no two onsets halving the cycle —, :euclid — the rotation of E(k,n) it is, or nil —, :fourier and :phases — its Fourier coefficients f1 … f⌊n/2⌋, magnitudes 0…1 and phases in degrees: |f1| near 0 balanced, |f_k| largest when maximally even —}; with the word fourier the magnitudes are drawn too, a bar each. Its middle inlet (cold) takes the pitches the notes take in turn, as euclid's. It also plays it, step by step, as a step sequencer: each bang on the right inlet (a metro, the room's pulse, an onset~…) moves the hand to the next pulse and, on an onset, sends a bang out of outlet 4 (for a player's step, a sample…); a number moves the hand to that pulse (and plays it); :reset makes the next bang play the first pulse. Editing the rhythm while it plays changes what the hand finds."
   :usage "necklace [n 16] [bars 1] [midi] [fourier]"
   :io [3 5]
   :size (fn [box] (if (fourier? (:args box)) [200 296] [200 240]))

   ;; ── arguments ──
   :args [[:n 16] [:bars 1] [:midi false] [:fourier false]]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args]}]
              (let [st (or state {:pulses (vec (repeat (max 1 (js/Math.round (or (:n args) 16))) 0))
                                  :bars (api/clamp (js/Math.round (or (:bars args) 1)) 1 64) :meter nil :pm nil})
                    ps (:pulses st) n (count ps)
                    to (fn [m] (settle st (merge st m) false))
                    toggle (fn [i] (let [i (mod (js/Math.round i) n)] (to {:pulses (update ps i (fn [x] (- 1 x)))})))]
                (cond
                  (= inlet 1)
                  (let [pm (pitches-of (:midi args) value)]
                    (if (= pm :ignore) {} {:state (assoc st :pm pm)}))
                  ;; the clock: a step of the hand
                  (= inlet 2)
                  (cond (#{:bang} value) (step st (if (:hand st) (inc (:hand st)) 0))
                        (number? value) (step st (js/Math.round value))
                        (#{:reset} value) (let [s2 (assoc st :hand nil)] {:state (assoc s2 :shown (assoc (or (:shown st) {}) :hand nil)) :show (assoc (or (:shown st) (assoc (measures ps) :pulses ps)) :hand nil)})
                        :else {})
                  :else
                  (cond
                    (#{:bang} value) (settle st st true)
                    (#{:clear} value) (to {:pulses (vec (repeat n 0))})
                    (#{:complement} value) (to {:pulses (mapv (fn [x] (- 1 x)) ps)})
                    (number? value) (toggle value)
                    (and (vector? value) (= :pressed (first value)) (number? (second value))) (toggle (second value))
                    (and (vector? value) (= :rotate (first value)) (number? (second value))) (to {:pulses (rotate ps (js/Math.round (second value)))})
                    (and (vector? value) (= :n (first value)) (number? (second value)))
                    (let [m (api/clamp (js/Math.round (second value)) 1 128)]
                      (to {:pulses (vec (take m (concat ps (repeat 0))))}))
                    (and (vector? value) (= :bars (first value)) (number? (second value))) (to {:bars (api/clamp (js/Math.round (second value)) 1 64)})
                    (and (vector? value) (= :meter (first value))) (to {:meter (meter-arg (second value))})
                    :else (if-let [p (or (pulses-of-list value) (pulses-of value))]
                            (to {:pulses p})
                            {})))))
   ;; pressing a pulse adds or takes away an onset (sent once, on release)
   :gesture (fn [{:keys [up hit]}] (when (and up (number? hit)) [:pressed hit]))

   ;; ── view ──
   :draw (fn [{:keys [shown w h args]}]
           (let [p (or shown (let [ps (vec (repeat (max 1 (js/Math.round (or (:n args) 16))) 0))] (assoc (measures ps) :pulses ps)))
                 n (:n p) ps (:pulses p) os (:onsets p)
                 fh (if (:fourier args) 60 0)
                 cx (/ w 2) cy (/ (- h 44 fh) 2) R (- (min cx cy) 16)
                 r (cond (> n 32) 2.2 (> n 16) 3 :else 4.5)
                 flags (remove nil? [(str "even " (:even p))
                                     (let [a (count (:axes p))] (case a 0 "asymmetric" 1 "1 axis" (str a " axes")))
                                     (when (:deep p) "deep") (when (:flat p) "flat")
                                     (when (and (even? n) (:oddity p) (pos? (:k p))) "oddity")
                                     (when (:euclid p) (str "E(" (:k p) "," n ")" (when (pos? (:euclid p)) (str " ↻" (:euclid p)))))])]
             (concat
              [[:circle {:cx cx :cy cy :r R :stroke :grid}]]
              (let [[x1 y1] (polar cx cy (- R 9) 0 n) [x2 y2] (polar cx cy (+ R 9) 0 n)]
                [[:line {:x1 x1 :y1 y1 :x2 x2 :y2 y2 :stroke :kairos :weight 1.5 :opacity 0.8}]])
              ;; the axes of symmetry, across the circle
              (for [a (:axes p)]
                (let [[x1 y1] (polar cx cy (+ R 7) a n) [x2 y2] (polar cx cy (+ R 7) (+ a (/ n 2)) n)]
                  [:line {:x1 x1 :y1 y1 :x2 x2 :y2 y2 :stroke :kairos :weight 1 :opacity 0.5}]))
              (when (> (count os) 1) [[:path {:points (mapv (fn [i] (polar cx cy R i n)) os) :closed true :stroke :accent :weight 2}]])
              ;; the hand, when it plays: from the centre to the pulse it is on
              (when-let [hd (:hand p)]
                (let [[x y] (polar cx cy (- R 6) hd n)]
                  [[:line {:x1 cx :y1 cy :x2 x :y2 y :stroke :kairos :weight 2}]
                   [:circle {:cx cx :cy cy :r 2.5 :fill :kairos}]]))
              (for [i (range n)]
                (let [[x y] (polar cx cy R i n) on (= 1 (nth ps i 0))]
                  [:group {:hit i}
                   [[:circle {:cx x :cy y :r (if on (+ r 1.5) r) :fill (if on :accent :bg) :stroke (if on :accent :soft)}]]]))
              ;; the Fourier magnitudes, a bar each (f1 … f⌊n/2⌋), above the texts
              (when (:fourier args)
                (let [fs (or (:fourier p) []) m (count fs) bw (if (pos? m) (/ (- w 20) m) 0) base (- h 52)]
                  (concat
                   [[:line {:x1 10 :y1 base :x2 (- w 10) :y2 base :stroke :grid}]]
                   (for [[j f] (map-indexed vector fs)]
                     [:rect {:x (+ 10 (* j bw) 1) :y (- base (* 36 f)) :w (max 1 (- bw 2)) :h (* 36 f)
                             :fill (if (= (inc j) (:k p)) :kairos :accent) :opacity 0.8}])
                   (when (<= m 16)
                     (for [j (range m)]
                       [:text {:x (+ 10 (* j bw) (/ bw 2)) :y (+ base 9) :anchor :middle :size 7 :fill :soft} (str (inc j))])))))
              [[:text {:x cx :y (- h 29) :anchor :middle :size 10 :fill :ink}
                (str (:k p) "/" n " · " (if (seq (:intervals p)) (apply str (interpose "-" (:intervals p))) "silence"))]
               [:text {:x cx :y (- h 16) :anchor :middle :size 9 :fill :soft} (str "<" (apply str (interpose " " (:ivec p))) ">")]
               [:text {:x cx :y (- h 3) :anchor :middle :size 9 :fill :soft} (apply str (interpose " · " flags))]])))})
