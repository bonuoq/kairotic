;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · canvas
;; A graphic buffer: frequency over time. It neither sounds nor advances by itself; it is only a
;; representation that other components read (kairotic.engine, box `reader`).
;;
;; data: {:strokes {:t1 {:pts [[t hz] ...]}}
;;        :gx {:step 0.25 :cycles [4]}                         ; X grid (optional)
;;        :gy {:name "12-tet" :cents [100 ... 1200] :ref 261.63}}  ; Y grid = tuning (optional)
;; Time is in abstract units: its meaning is given by whoever reads it.
;; Between two points of a stroke the frequency is interpolated on a logarithmic scale (pitch).

(ns kairotic.canvas
  (:refer-clojure :exclude [empty cycle])
  (:require [clojure.string :as str]))

(def empty {:strokes {} :gx nil :gy nil})

(defn num? [x] (and (number? x) (not (js/isNaN x)) (js/isFinite x)))
(defn round-to [x d] (let [k (js/Math.pow 10 d)] (/ (js/Math.round (* x k)) k)))
(defn log2 [x] (/ (js/Math.log x) (js/Math.log 2)))

(defn hz->cents [hz ref] (* 1200 (log2 (/ hz ref))))
(defn cents->hz [c ref] (* ref (js/Math.pow 2 (/ c 1200))))
(defn midi->hz [m] (* 440 (js/Math.pow 2 (/ (- m 69) 12))))
(defn hz->midi [hz] (+ 69 (* 12 (log2 (/ hz 440)))))

(def note-names ["C" "C#" "D" "D#" "E" "F" "F#" "G" "G#" "A" "A#" "B"])
(defn midi-name [m] (str (nth note-names (mod m 12)) (dec (js/Math.floor (/ m 12)))))

(defn fmt
  "A short number for code: no trailing zeros."
  [x] (let [r (round-to x 3)] (if (= r (js/Math.round r)) (str (js/Math.round r)) (str r))))

;; ───────── tunings (Y grid) ─────────
;; As in Scala: the degrees in cents above the reference, without the 1/1; the last one is the period.

(defn ratio->cents [s]
  (let [[a b] (str/split (str/trim s) #"/")
        a (js/parseFloat a) b (if b (js/parseFloat b) 1)]
    (* 1200 (log2 (/ a b)))))

(defn edo [n period] (vec (for [k (range 1 (inc n))] (round-to (* k (/ period n)) 4))))

(def tunings
  {"12-tet" {:name "12-tet" :cents (edo 12 1200)}
   "24-tet" {:name "24-tet" :cents (edo 24 1200)}
   "19-tet" {:name "19-tet" :cents (edo 19 1200)}
   "31-tet" {:name "31-tet" :cents (edo 31 1200)}
   "just-5" {:name "just-5"
             :cents (mapv (fn [r] (round-to (ratio->cents r) 4))
                          ["16/15" "9/8" "6/5" "5/4" "4/3" "45/32" "3/2" "8/5" "5/3" "9/5" "15/8" "2/1"])}
   "pythagorean" {:name "pythagorean"
                  :cents (mapv (fn [r] (round-to (ratio->cents r) 4))
                               ["256/243" "9/8" "32/27" "81/64" "4/3" "729/512" "3/2" "128/81" "27/16" "16/9" "243/128" "2/1"])}
   "bohlen-pierce" {:name "bohlen-pierce" :cents (edo 13 1901.955)}})

(def default-ref 261.6256)

(defn parse-scl
  "Text of a Scala .scl file → {:name :cents}. Lines starting with ! are comments;
   the first useful line is the description, the second the number of degrees; a value with a dot
   is in cents and one without a dot is a ratio (3/2) or an integer (2)."
  [txt]
  (let [ls (remove (fn [l] (str/starts-with? (str/trim l) "!")) (str/split-lines (str txt)))
        [desc nl & more] ls
        n (js/parseInt (str/trim (str nl)) 10)
        vals (take n (keep (fn [l] (let [w (first (str/split (str/trim l) #"\s+"))] (when (seq w) w))) more))
        cents (mapv (fn [v] (if (str/includes? v ".") (js/parseFloat v) (ratio->cents v))) vals)]
    (when (or (js/isNaN n) (zero? n) (not= n (count cents)) (some (fn [c] (not (num? c))) cents) (not (pos? (peek cents))))
      (throw (js/Error. "Not a valid .scl: it needs a description, the number of degrees and the degrees (the last one is the period).")))
    {:name (if (str/blank? desc) "scala" (str/trim desc)) :cents (mapv (fn [c] (round-to c 4)) cents)}))

(defn degrees [gy] (vec (cons 0 (butlast (:cents gy)))))
(defn period [gy] (peek (:cents gy)))

(defn hz->degree
  "Index of the nearest degree (0 = the reference; it may be negative or go beyond the period)."
  [gy hz]
  (let [gs (degrees gy) m (count gs) P (period gy)
        c (hz->cents hz (:ref gy))
        k (js/Math.floor (/ c P))
        r (- c (* k P))
        cands (conj gs P)
        i (apply min-key (fn [i] (js/Math.abs (- (nth cands i) r))) (range (count cands)))]
    (+ (* k m) i)))

(defn degree->hz [gy n]
  (let [gs (degrees gy) m (count gs)
        k (js/Math.floor (/ n m))
        i (- n (* k m))]
    (cents->hz (+ (* k (period gy)) (nth gs i)) (:ref gy))))

(defn quantize-f [gy hz] (if gy (degree->hz gy (hz->degree gy hz)) hz))

;; ───────── X grid ─────────

(defn cycle [gx] (reduce + (or (seq (:cycles gx)) [4])))
(defn step-x [gx] (or (:step gx) 0.25))
(defn quantize-t [gx t] (if gx (let [p (:step gx)] (round-to (* p (js/Math.round (/ t p))) 6)) t))

(defn parse-cycles
  "[4], 4, \"3+3+2\" or [3 3 2] → vector of group durations (in time units)."
  [x]
  (cond (num? x) [x]
        (string? x) (vec (keep (fn [s] (let [n (js/parseFloat s)] (when (num? n) n))) (str/split x #"\+")))
        (sequential? x) (vec (filter num? x))
        :else []))

;; ───────── model ─────────

(defn sane-pts [pts]
  (when (sequential? pts)
    (let [ps (->> pts
                  (filter (fn [p] (and (sequential? p) (= 2 (count p)) (num? (first p)) (num? (second p))
                                       (>= (first p) 0) (< 1 (second p) 30000))))
                  (map (fn [[t f]] [(round-to t 4) (round-to f 3)]))
                  (sort-by first)
                  vec)]
      (when (and (>= (count ps) 2) (> (first (peek ps)) (first (first ps)))) ps))))

(defn sane-gx [gx]
  (when (map? gx)
    (let [p (:step gx) cs (filter (fn [c] (and (num? c) (pos? c))) (parse-cycles (:cycles gx)))]
      (when (and (num? p) (> p 0.001))
        {:step p :cycles (vec cs)}))))

(defn sane-gy [gy]
  (when (map? gy)
    (let [cs (:cents gy) ref (:ref gy)]
      (when (and (sequential? cs) (seq cs) (every? num? cs) (pos? (peek (vec cs))) (< (count cs) 400))
        {:name (str (or (:name gy) "scale")) :cents (vec cs) :ref (if (and (num? ref) (< 1 ref 20000)) ref default-ref)}))))

(defn transform [pts f] (sane-pts (mapv f pts)))

(defn step
  "Data + event → data. Every change to a canvas goes through here."
  [d [op & args]]
  (let [d (or d empty)]
    (case op
      :stroke  (let [[id pts] args ps (sane-pts pts)]
                 (if (and (keyword? id) ps) (assoc-in d [:strokes id] {:pts ps}) d))
      :move    (let [[id dt dc] args pts (get-in d [:strokes id :pts])]
                 (if (and pts (num? dt) (num? dc))
                   (let [dt (max dt (- (ffirst pts))) k (js/Math.pow 2 (/ dc 1200))]
                     (if-let [ps (transform pts (fn [[t f]] [(+ t dt) (* f k)]))] (assoc-in d [:strokes id :pts] ps) d))
                   d))
      :stretch (let [[id k] args pts (get-in d [:strokes id :pts])]
                 (if (and pts (num? k) (pos? k))
                   (let [t0 (ffirst pts)]
                     (if-let [ps (transform pts (fn [[t f]] [(+ t0 (* k (- t t0))) f]))] (assoc-in d [:strokes id :pts] ps) d))
                   d))
      :erase   (update d :strokes dissoc (first args))
      :clear   (assoc d :strokes {})
      :grid-x  (assoc d :gx (sane-gx (first args)))
      :tuning  (assoc d :gy (sane-gy (first args)))
      :load    (let [[x] args]
                 (if (map? x)
                   {:strokes (into {} (for [[k s] (:strokes x) :let [ps (and (keyword? k) (map? s) (sane-pts (:pts s)))] :when ps] [k {:pts ps}]))
                    :gx (sane-gx (:gx x))
                    :gy (sane-gy (:gy x))}
                   d))
      d)))

(defn id-num [k] (let [m (re-matches #"t(\d+)" (name k))] (if m (js/parseInt (second m) 10) 1e9)))

(defn next-id [d]
  (let [ns-ids (keep (fn [k] (let [n (id-num k)] (when (< n 1e9) n))) (keys (:strokes d)))]
    (keyword (str "t" (inc (if (seq ns-ids) (apply max ns-ids) 0))))))

(defn sorted-strokes [d] (sort-by (fn [[id s]] [(ffirst (:pts s)) (id-num id)]) (:strokes d)))

(defn end-t [d] (reduce max 0 (map (fn [s] (first (peek (:pts s)))) (vals (:strokes d)))))

;; ───────── reading ─────────

(defn value-at
  "Frequency of a stroke at time t, or nil if the stroke does not pass there (the end is open)."
  [pts t]
  (let [t0 (ffirst pts) t1 (first (peek pts))]
    (when (and (>= t t0) (< t t1))
      (loop [[[ta fa] & more] pts]
        (let [[tb fb] (first more)]
          (cond (nil? tb) fa
                (< t tb) (if (= tb ta) fb (* fa (js/Math.pow (/ fb fa) (/ (- t ta) (- tb ta)))))
                :else (recur more)))))))

(defn read-at
  "Everything that sounds at time t: [[id hz] ...] in stroke order."
  [d t]
  (vec (keep (fn [[id s]] (when-let [f (value-at (:pts s) t)] [id f])) (sorted-strokes d))))

;; ───────── geometry and drawing ─────────

(def W 420)
(def H 200)
(def x0 40)

(defn f-range [d]
  (let [ps (mapcat :pts (vals (:strokes d)))
        L (cycle (:gx d))
        T0 (if (seq ps) (apply max (map first ps)) 0)
        T (* L (max 2 (inc (js/Math.ceil (/ T0 L)))))
        fs (map second ps)
        [lo hi] (if (seq fs) [(apply min fs) (apply max fs)] [220 880])
        clo (- (log2 lo) 0.3) chi (+ (log2 hi) 0.3)
        span (max 1.6 (- chi clo)) mid (/ (+ clo chi) 2)]
    {:T T :lf0 (- mid (/ span 2)) :lf1 (+ mid (/ span 2))}))

(defn geom [d hdr]
  (let [y0 (+ hdr 3)]
    (merge (f-range d) {:x0 x0 :y0 y0 :w (- W x0 6) :h (- H y0 6)})))

(defn t->x [g t] (+ (:x0 g) (* (/ t (:T g)) (:w g))))
(defn x->t [g x] (* (:T g) (/ (- x (:x0 g)) (:w g))))
(defn f->y [g f] (+ (:y0 g) (* (/ (- (:lf1 g) (log2 f)) (- (:lf1 g) (:lf0 g))) (:h g))))
(defn y->f [g y] (js/Math.pow 2 (- (:lf1 g) (* (/ (- y (:y0 g)) (:h g)) (- (:lf1 g) (:lf0 g))))))

(defn lines-x
  "[[t level label]]: level 0 = step, 1 = group, 2 = start of cycle."
  [gx g]
  (let [T (:T g) px-per-unit (/ (:w g) T)]
    (if-not gx
      (for [t (range 0 (inc T))] [t (if (zero? (mod t 4)) 1 0) nil])
      (let [p (:step gx) cs (or (seq (:cycles gx)) [4]) L (reduce + cs)
            bounds (butlast (reductions + 0 cs))
            steps (when (>= (* p px-per-unit) 5)
                    (for [k (range 0 (inc (js/Math.floor (/ T p))))] [(* k p) 0 nil]))]
        (concat steps
                (for [c (range 0 (inc (js/Math.floor (/ T L)))) b bounds :let [t (+ (* c L) b)] :when (<= t T)]
                  [t (if (zero? b) 2 1) (when (zero? b) (inc c))]))))))

(defn lines-y
  "[[hz level label]] within the visible range."
  [gy g]
  (let [f0 (js/Math.pow 2 (:lf0 g)) f1 (js/Math.pow 2 (:lf1 g))]
    (if-not gy
      (for [k (range (js/Math.ceil (log2 (/ f0 55))) (inc (js/Math.floor (log2 (/ f1 55)))))
            :let [f (* 55 (js/Math.pow 2 k))]]
        [f 1 (str (round-to f 1))])
      (let [m (count (degrees gy)) a (hz->degree gy f0) b (hz->degree gy f1)
            dense? (> (/ (- b a) (max 1 (/ (:h g) 3.5))) 1)
            tet12? (= (:cents gy) (:cents (get tunings "12-tet")))]
        (for [n (range (dec a) (+ b 2))
              :let [f (degree->hz gy n) start? (zero? (mod n m))]
              :when (and (<= f0 f f1) (or start? (not dense?)))]
          [f (if start? 1 0)
           (when start?
             (if (and tet12? (< (js/Math.abs (- (:ref gy) default-ref)) 0.01))
               (midi-name (js/Math.round (hz->midi f)))
               (str (round-to f 1))))])))))

(defn path-d [g pts]
  (str/join " " (map-indexed (fn [i [t f]] (str (if (zero? i) "M" "L") (round-to (t->x g t) 2) " " (round-to (f->y g f) 2))) pts)))

(defn svg
  "SVG of the contents of a canvas box. `idn` is the box id (text), `sel` the selected stroke,
   `previews` {id pts} to draw a drag in progress and `new-pts` the points of a stroke being drawn."
  [idn d g sel previews new-pts]
  (let [{:keys [x0 y0 w h]} g]
    (str "<rect class=\"lbg mus-body\" data-box=\"" idn "\" x=\"" x0 "\" y=\"" y0 "\" width=\"" w "\" height=\"" h "\"></rect>"
         "<svg x=\"0\" y=\"" y0 "\" width=\"" (+ x0 w) "\" height=\"" h "\" overflow=\"hidden\" pointer-events=\"none\">"
         "<g transform=\"translate(0," (- y0) ")\">"
         (apply str (for [[f level label] (lines-y (:gy d) g) :let [y (round-to (f->y g f) 2)]]
                      (str "<line class=\"lgy" level "\" x1=\"" x0 "\" x2=\"" (+ x0 w) "\" y1=\"" y "\" y2=\"" y "\"></line>"
                           (when label (str "<text class=\"rlabel\" x=\"4\" y=\"" (+ y 3) "\">" label "</text>")))))
         (apply str (for [[t level label] (lines-x (:gx d) g) :let [x (round-to (t->x g t) 2)]]
                      (str "<line class=\"lgx" level "\" x1=\"" x "\" x2=\"" x "\" y1=\"" y0 "\" y2=\"" (+ y0 h) "\"></line>"
                           (when label (str "<text class=\"rlabel\" x=\"" (+ x 3) "\" y=\"" (+ y0 9) "\">" label "</text>")))))
         "</g></svg>"
         (apply str (for [[id s] (:strokes d)
                          :let [pts (or (get previews id) (:pts s)) dd (path-d g pts) ids (name id)]]
                      (str "<path class=\"stroke" (when (= sel id) " sel") "\" d=\"" dd "\"></path>"
                           "<path class=\"stroke-hit\" data-box=\"" idn "\" data-stroke=\"" ids "\" d=\"" dd "\"><title>"
                           ids " · " (fmt (ffirst pts)) "→" (fmt (first (peek pts))) " · " (fmt (second (first pts))) " Hz</title></path>")))
         (when (and new-pts (>= (count new-pts) 2))
           (str "<path class=\"stroke new\" d=\"" (path-d g new-pts) "\"></path>")))))

(defn summary [d]
  (str (if-let [gy (:gy d)] (:name gy) "continuous Hz")
       " · " (if-let [gx (:gx d)] (str "step " (fmt (:step gx)) " · cycle " (str/join "+" (map fmt (or (seq (:cycles gx)) [4])))) "free time")
       " · " (count (:strokes d)) " strokes"))

;; ───────── projections ─────────

(defn ->code
  "Lines of code that rebuild the canvas of box `id`."
  [id d]
  (concat
   (when-let [gy (:gy d)]
     (let [preset (some (fn [[k v]] (when (= (:cents v) (:cents gy)) k)) tunings)]
       [(str "(tuning " id " " (if preset (pr-str preset) (pr-str {:name (:name gy) :cents (:cents gy)})) " " (fmt (:ref gy)) ")")]))
   (when-let [gx (:gx d)]
     [(str "(grid-x " id " " (fmt (:step gx)) " " (pr-str (mapv (fn [c] (js/parseFloat (fmt c))) (:cycles gx))) ")")])
   (for [[sid s] (sorted-strokes d)]
     (str "(stroke " id " " sid " [" (str/join " " (map (fn [[t f]] (str "[" (fmt t) " " (fmt f) "]")) (:pts s))) "])"))))

(defn ->voice
  "Approximation of the canvas as a kairotic.score voice: each stroke is a note on the
   semitone nearest to its first point; the deviation in cents and glissandi are annotated."
  [d]
  (let [L (cycle (:gx d))
        snap (fn [x] (/ (js/Math.round (* x 4)) 4))]
    {:tempo 90 :meter [(max 1 (js/Math.round L)) 4]
     :events (into {} (for [[id s] (:strokes d)
                            :let [pts (:pts s) [t0 f0] (first pts) [t1 f1] (peek pts)
                                  m (hz->midi f0) mr (js/Math.round m) dv (js/Math.round (* 100 (- m mr)))
                                  gl (let [c (* 1200 (log2 (/ f1 f0)))] (cond (> c 30) "↗" (< c -30) "↘" :else nil))
                                  txt (str (when (>= (js/Math.abs dv) 5) (str (when (pos? dv) "+") dv)) gl)]]
                        [id (cond-> {:t (snap t0) :pitch (max 0 (min 127 mr)) :dur (max 0.25 (snap (- t1 t0)))}
                              (seq txt) (assoc :txt txt))]))}))

(defn simplify
  "Ramer–Douglas–Peucker over [x y] points (in pixels): keeps those that deviate more than `eps`."
  [ps eps]
  (if (< (count ps) 3)
    (vec ps)
    (let [[ax ay] (first ps) [bx by] (peek ps)
          dx (- bx ax) dy (- by ay) L (max 1e-9 (js/Math.hypot dx dy))
          dist (fn [[x y]] (/ (js/Math.abs (- (* dy (- x ax)) (* dx (- y ay)))) L))
          [i dmax] (reduce (fn [[bi bd] i] (let [dd (dist (nth ps i))] (if (> dd bd) [i dd] [bi bd]))) [0 0] (range 1 (dec (count ps))))]
      (if (> dmax eps)
        (vec (concat (butlast (simplify (subvec ps 0 (inc i)) eps)) (simplify (subvec ps i) eps)))
        [(first ps) (peek ps)]))))
