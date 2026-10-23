;; pcclock · a pitch-class set on the clock face
;; Part of @kairotic/theory. Written against the Kairotic API (api/…).
;; The twelve pitch classes around a circle (C at the top, clockwise by semitones). What arrives is drawn
;; as a polygon, with the sets before it fading behind, and the axes about which it is symmetric by
;; inversion. Its prime form and interval vector go out; pressing a pitch class sends it.
(let [names ["C" "C♯" "D" "E♭" "E" "F" "F♯" "G" "A♭" "A" "B♭" "B"]
      TAU (* 2 js/Math.PI)
      notes-of (fn [args] (api/clamp (or (first (filter number? args)) 4) 1 24))
      ;; what arrives, as a weight for each pitch class: a list of 12 values between 0 and 1 is a chroma
      ;; (from chroma~), any other list are pitches (MIDI or 0…11)
      weights (fn [xs]
                (let [w (vec (repeat 12 0))]
                  (if (and (= 12 (count xs)) (every? (fn [x] (and (number? x) (<= 0 x 1))) xs))
                    (mapv (fn [x] (if (> x 0.5) x 0)) xs)
                    (reduce (fn [w x] (if (number? x) (update w (mod (js/Math.round x) 12) + 1) w)) w xs))))
      pcset (fn [w] (vec (keep-indexed (fn [i x] (when (pos? x) i)) w)))
      ivec (fn [s] (let [c (frequencies (for [a s b s :when (< a b)] (let [d (mod (- b a) 12)] (min d (- 12 d)))))]
                     (mapv (fn [k] (get c k 0)) (range 1 7))))
      rotations (fn [s] (let [s (vec (sort s)) n (count s)]
                          (for [i (range n)] (vec (concat (subvec s i) (map (fn [x] (+ x 12)) (subvec s 0 i)))))))
      zeroed (fn [r] (mapv (fn [x] (- x (first r))) r))
      ;; the most packed rotation, of the set or of its inversion (Rahn): smallest span, then from the right
      prime (fn [s] (when (seq s)
                      (reduce (fn [a b] (if (neg? (compare [(peek b) (vec (rseq b))] [(peek a) (vec (rseq a))])) b a))
                              (map zeroed (concat (rotations s) (rotations (map (fn [x] (mod (- 12 x) 12)) s)))))))
      axes (fn [s] (let [ss (set s)] (vec (for [n (range 12) :when (and (seq s) (= ss (set (map (fn [x] (mod (- n x) 12)) s))))] n))))
      polar (fn [cx cy r p] (let [a (* p (/ TAU 12))] [(+ cx (* r (js/Math.sin a))) (- cy (* r (js/Math.cos a)))]))
      ;; the state: the last notes (numbers), the weights shown, and the sets before (for the trail)
      show-of (fn [st w] (let [s (pcset w)
                               trail (vec (take-last 4 (if (and (seq (:set st)) (not= s (:set st))) (conj (:trail st []) (:set st)) (:trail st []))))]
                           (assoc st :w w :set s :trail trail)))]
  {;; ── about ──
   :class "pcclock"
   :license "MPL-2.0"
   :doc "A pitch-class set on the clock face: the twelve classes around a circle, C at the top. A list of pitches (MIDI, or 0…11) is the set; a list of 12 values between 0 and 1 is a chroma (from chroma~), and its classes above 0.5 are the set; a number is a note, and the last n notes (4) are the set; clear empties it. It draws the set as a polygon (the sets before it fading behind) and its axes of symmetry by inversion, and sends its prime form (left) and its interval vector (middle) when it changes. Pressing a pitch class sends it (right)."
   :usage "pcclock [notes]"
   :io [1 3]
   :size [200 222]

   ;; ── logic ──
   :receive (fn [{:keys [value state args]}]
              (let [st (or state {:notes [] :w (vec (repeat 12 0)) :set [] :trail []})
                    send (fn [st2] (let [s (:set st2)]
                                     {:state st2 :show st2
                                      :out (if (= s (:set st)) [] [[1 (ivec s)] [0 (or (prime s) [])]])}))]
                (cond
                  (and (vector? value) (= :pressed (first value)) (number? (second value))) {:out [[2 (second value)]]}
                  (#{:clear "clear"} value) (send (show-of (assoc st :notes []) (vec (repeat 12 0))))
                  (number? value) (let [ns (vec (take-last (notes-of args) (conj (:notes st) value)))]
                                    (send (show-of (assoc st :notes ns) (weights ns))))
                  (and (sequential? value) (every? number? value)) (send (show-of (assoc st :notes []) (weights value)))
                  :else {})))

   ;; ── view ──
   :draw (fn [{:keys [shown w h]}]
           (let [cx (/ w 2) cy (/ (- h 26) 2) R (- (min cx cy) 22)
                 wt (or (:w shown) (repeat 12 0)) s (or (:set shown) []) mx (reduce max 1e-9 wt)
                 pf (prime s)]
             (concat
              [[:circle {:cx cx :cy cy :r R :stroke :grid}]]
              (for [[i t] (map-indexed vector (:trail shown)) :when (> (count t) 1)]
                [:path {:points (mapv (fn [p] (polar cx cy R p)) t) :closed true :stroke :accent :weight 1 :opacity (* 0.14 (inc i))}])
              (for [n (axes s)]
                (let [[x1 y1] (polar cx cy (+ R 14) (/ n 2)) [x2 y2] (polar cx cy (+ R 14) (+ 6 (/ n 2)))]
                  [:line {:x1 x1 :y1 y1 :x2 x2 :y2 y2 :stroke :kairos :weight 1 :opacity 0.8}]))
              (when (> (count s) 1) [[:path {:points (mapv (fn [p] (polar cx cy R p)) s) :closed true :stroke :accent :weight 2}]])
              (for [p (range 12)]
                (let [[x y] (polar cx cy R p) [lx ly] (polar cx cy (+ R 13) p) v (nth wt p 0) on (pos? v)]
                  [:group {:hit p}
                   [[:circle {:cx x :cy y :r (if on (+ 3.5 (* 3.5 (/ v mx))) 3.5) :fill (if on :accent :bg) :stroke (if on :accent :soft)}]
                    [:text {:x lx :y (+ ly 3.5) :anchor :middle :size 9 :fill (if on :ink :soft)} (nth names p)]]]))
              [[:text {:x cx :y (- h 14) :anchor :middle :size 9 :fill :ink}
                (if (seq s) (str "(" (apply str (map (fn [x] (case x 10 "t" 11 "e" (str x))) pf)) ") <" (apply str (ivec s)) ">") "—")]
               [:text {:x cx :y (- h 3) :anchor :middle :size 8 :fill :soft}
                (let [n (count (axes s))] (cond (empty? s) "no set" (zero? n) "asymmetric" (= 1 n) "1 axis" :else (str n " axes")))]])))
   ;; pressing a pitch class: sent once, on release
   :gesture (fn [{:keys [up hit]}] (when (and up (number? hit)) [:pressed hit]))})
