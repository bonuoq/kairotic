;; fourier · the six Fourier coefficients of a pitch-class distribution
;; Part of @kairotic/theory. Written against the Kairotic API (api/…).
;; The DFT of the weights of the twelve pitch classes (Lewin, Quinn, Amiot, Yust): coefficient k measures
;; how close what sounds is to the even division of the octave in k parts — f1 chromatic, f2 dyadic
;; (tritones), f3 triadic (augmented), f4 octatonic (diminished), f5 diatonic, f6 whole-tone. Each is a
;; point inside its circle (magnitude, 0…1, and phase), with its trail over the last changes.
(let [TAU (* 2 js/Math.PI)
      labels ["chromatic" "dyadic" "triadic" "octatonic" "diatonic" "whole-tone"]
      trail-max 48
      notes-of (fn [args] (api/clamp (or (first (filter number? args)) 4) 1 24))
      weights (fn [xs]
                (let [w (vec (repeat 12 0))]
                  (if (and (= 12 (count xs)) (every? (fn [x] (and (number? x) (<= 0 x 1))) xs))
                    (vec xs)
                    (reduce (fn [w x] (if (number? x) (update w (mod (js/Math.round x) 12) + 1) w)) w xs))))
      ;; [re im] of each coefficient 1…6, divided by the total weight (so a single class has magnitude 1)
      dft (fn [w]
            (let [tot (reduce + w)]
              (vec (for [k (range 1 7)]
                     (if (pos? tot)
                       [(/ (reduce + (map-indexed (fn [p x] (* x (js/Math.cos (/ (* TAU k p) 12)))) w)) tot)
                        (- (/ (reduce + (map-indexed (fn [p x] (* x (js/Math.sin (/ (* TAU k p) 12)))) w)) tot))]
                       [0 0])))))
      mag (fn [[a b]] (js/Math.hypot a b))
      r3 (fn [x] (/ (js/Math.round (* 1000 x)) 1000))]
  {;; ── about ──
   :class "fourier"
   :license "MPL-2.0"
   :doc "The six Fourier coefficients of what sounds, from its pitch classes: f1 chromatic, f2 dyadic, f3 triadic, f4 octatonic, f5 diatonic, f6 whole-tone — how close it is to dividing the octave evenly in 1…6 parts. A list of pitches (MIDI or 0…11) or of 12 weights (a chroma, from chroma~), or a number as a note (the last n notes count: 4); clear empties it. Each coefficient is drawn as a point in its circle with its trail; their magnitudes (0…1) go out on the left, their phases (degrees) on the right."
   :usage "fourier [notes]"
   :io [1 2]
   :size [300 214]

   ;; ── logic ──
   :receive (fn [{:keys [value state args]}]
              (let [st (or state {:notes [] :f (vec (repeat 6 [0 0])) :trail (vec (repeat 6 []))})
                    send (fn [st w]
                           (let [f (dft w)
                                 st (assoc st :f f :trail (mapv (fn [t p] (vec (take-last trail-max (conj t p)))) (:trail st) f))]
                             {:state st :show st
                              :out [[1 (mapv (fn [[a b]] (r3 (* (/ 180 js/Math.PI) (js/Math.atan2 (- b) a)))) f)]
                                    [0 (mapv (fn [p] (r3 (mag p))) f)]]}))]
                (cond
                  (#{:clear "clear"} value) {:state nil :show nil}
                  (number? value) (let [ns (vec (take-last (notes-of args) (conj (:notes st) value)))]
                                    (send (assoc st :notes ns) (weights ns)))
                  (and (sequential? value) (seq value) (every? number? value)) (send (assoc st :notes []) (weights value))
                  :else {})))

   ;; ── view ──
   :draw (fn [{:keys [shown w h]}]
           (let [cw (/ w 3) R (- (min (/ cw 2) (/ (- h 10) 4)) 12)]
             (apply concat
                    (for [k (range 6)]
                      (let [cx (+ (/ cw 2) (* cw (mod k 3))) cy (+ 14 R (* (quot k 3) (/ (- h 6) 2)))
                            f (get-in shown [:f k] [0 0])
                            pt (fn [[a b]] [(+ cx (* R a)) (+ cy (* R b))])
                            [x y] (pt f)]
                        [[:circle {:cx cx :cy cy :r R :stroke :grid}]
                         [:line {:x1 (- cx R) :y1 cy :x2 (+ cx R) :y2 cy :stroke :grid :weight 0.6}]
                         [:curve {:points (mapv pt (get-in shown [:trail k] [])) :stroke :accent :weight 1.2 :opacity 0.45}]
                         [:line {:x1 cx :y1 cy :x2 x :y2 y :stroke :accent :weight 1.6}]
                         [:circle {:cx x :cy y :r 3.4 :fill :accent :stroke nil}]
                         [:text {:x (- cx R) :y (- cy R 3) :size 9 :fill :ink} (str "f" (inc k))]
                         [:text {:x (+ cx R) :y (- cy R 3) :anchor :end :size 8 :fill :soft} (.toFixed (mag f) 2)]
                         [:text {:x cx :y (+ cy R 11) :anchor :middle :size 8 :fill :soft} (nth labels k)]])))))})
