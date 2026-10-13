;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · canvas
;; A graphic buffer: strokes in a plane. It neither sounds nor advances by itself; it is only a
;; representation that other components read (kairotic.engine, box `reader`), along X or along Y.
;;
;; Two kinds of box share this model:
;;  · canvas — generic: any numeric data. Its axes have a range and a scale (linear or log), strokes
;;    go in any direction, and reading at x (or y) gives every crossing of every stroke.
;;      {:strokes {:t1 {:pts [[x y] ...]}}
;;       :ax {:x {:lo 0 :hi 8 :log false} :y {:lo 0 :hi 1 :log false}}
;;       :gx {:step 0.5 :cycles [4]}  :gy {:step 0.1}}          ; grids (optional)
;;  · freqt — frequency over time: no :ax; time goes from 0, frequency is on a log scale, strokes go
;;    forward in time, and :gy can be a tuning {:name "12-tet" :cents [100 ... 1200] :ref 261.63}.
;; Between two points the value is interpolated on the scale of its axis (log → geometric, as pitch).

(ns kairotic.canvas
  (:refer-clojure :exclude [empty cycle])
  (:require [clojure.string :as str]))

(def empty {:strokes {} :gx nil :gy nil})

(def default-ax {:x {:lo 0 :hi 8 :log false} :y {:lo 0 :hi 1 :log false}})
(def generic-empty (assoc empty :ax default-ax))

(defn generic? "A generic canvas (with axes), not a freqt." [d] (map? (:ax d)))

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

(defn quantize-f
  "A value on the Y grid: the nearest degree of a tuning, or the nearest multiple of a regular step."
  [gy v]
  (cond (nil? gy) v
        (:cents gy) (degree->hz gy (hz->degree gy v))
        (:step gy) (round-to (* (:step gy) (js/Math.round (/ v (:step gy)))) 6)
        :else v))

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
    (if (and (nil? (:cents gy)) (num? (:step gy)) (pos? (:step gy)))
      {:step (:step gy)}
    (let [cs (:cents gy) ref (:ref gy)]
      (when (and (sequential? cs) (seq cs) (every? num? cs) (pos? (peek (vec cs))) (< (count cs) 400))
        {:name (str (or (:name gy) "scale")) :cents (vec cs) :ref (if (and (num? ref) (< 1 ref 20000)) ref default-ref)})))))

(defn sane-axis [a dflt]
  (let [a (if (map? a) a {}) lo (:lo a) hi (:hi a) log? (boolean (:log a))]
    (if (and (num? lo) (num? hi) (< lo hi) (or (not log?) (pos? lo)))
      {:lo lo :hi hi :log log?}
      dflt)))

(defn sane-ax [ax]
  (when (map? ax)
    {:x (sane-axis (:x ax) (:x default-ax)) :y (sane-axis (:y ax) (:y default-ax))}))

(defn x-log? [d] (and (generic? d) (boolean (get-in d [:ax :x :log]))))
(defn y-log? [d] (if (generic? d) (boolean (get-in d [:ax :y :log])) true))

(defn sane-free-pts
  "Points of a stroke of a generic canvas: any direction, at least two different points."
  [d pts]
  (when (sequential? pts)
    (let [ps (->> pts
                  (filter (fn [p] (and (sequential? p) (= 2 (count p)) (num? (first p)) (num? (second p))
                                       (or (not (x-log? d)) (pos? (first p)))
                                       (or (not (y-log? d)) (pos? (second p))))))
                  (map (fn [[x y]] [(round-to x 4) (round-to y 4)]))
                  dedupe
                  vec)]
      (when (>= (count ps) 2) ps))))

(defn sane-pts-for "The right points check for this canvas." [d pts]
  (if (generic? d) (sane-free-pts d pts) (sane-pts pts)))

(defn shift-y
  "A value moved by dy: in cents on a log axis, added on a linear one."
  [d v dy] (if (y-log? d) (* v (js/Math.pow 2 (/ dy 1200))) (+ v dy)))

(defn delta-y
  "How far b is from a, in the units of shift-y."
  [d b a] (if (y-log? d) (hz->cents b a) (- b a)))

(defn transform [d pts f] (sane-pts-for d (mapv f pts)))

(defn step
  "Data + event → data. Every change to a canvas goes through here."
  [d [op & args]]
  (let [d (or d empty)]
    (case op
      :stroke  (let [[id pts] args ps (sane-pts-for d pts)]
                 (if (and (keyword? id) ps) (assoc-in d [:strokes id] {:pts ps}) d))
      ;; [:move id dx dy]: dy in cents on a log axis (freqt), in units on a linear one
      :move    (let [[id dt dc] args pts (get-in d [:strokes id :pts])]
                 (if (and pts (num? dt) (num? dc))
                   (let [dt (if (generic? d) dt (max dt (- (ffirst pts))))]
                     (if-let [ps (transform d pts (fn [[t f]] [(+ t dt) (shift-y d f dc)]))] (assoc-in d [:strokes id :pts] ps) d))
                   d))
      :stretch (let [[id k] args pts (get-in d [:strokes id :pts])]
                 (if (and pts (num? k) (pos? k))
                   (let [t0 (ffirst pts)]
                     (if-let [ps (transform d pts (fn [[t f]] [(+ t0 (* k (- t t0))) f]))] (assoc-in d [:strokes id :pts] ps) d))
                   d))
      :erase   (update d :strokes dissoc (first args))
      :clear   (assoc d :strokes {})
      :grid-x  (assoc d :gx (sane-gx (first args)))
      :tuning  (assoc d :gy (sane-gy (first args)))
      :grid-y  (assoc d :gy (sane-gy (first args)))
      :axis    (if (generic? d) (assoc d :ax (sane-ax (first args))) d)
      :load    (let [[x] args]
                 (if (map? x)
                   (let [base (cond-> {:gx (sane-gx (:gx x)) :gy (sane-gy (:gy x))}
                                (or (generic? d) (map? (:ax x))) (assoc :ax (or (sane-ax (:ax x)) default-ax)))]
                     (assoc base :strokes (into {} (for [[k s] (:strokes x)
                                                         :let [ps (and (keyword? k) (map? s) (sane-pts-for base (:pts s)))] :when ps]
                                                     [k {:pts ps}]))))
                   d))
      d)))

(defn id-num [k] (let [m (re-matches #"t(\d+)" (name k))] (if m (js/parseInt (second m) 10) 1e9)))

(defn next-id [d]
  (let [ns-ids (keep (fn [k] (let [n (id-num k)] (when (< n 1e9) n))) (keys (:strokes d)))]
    (keyword (str "t" (inc (if (seq ns-ids) (apply max ns-ids) 0))))))

(defn sorted-strokes [d] (sort-by (fn [[id s]] [(ffirst (:pts s)) (id-num id)]) (:strokes d)))

(defn end-t [d] (reduce max 0 (map (fn [s] (apply max (map first (:pts s)))) (vals (:strokes d)))))

;; ───────── reading ─────────
;; Reading at x = v (or y = v) gives, for each stroke, the other coordinate wherever the stroke
;; crosses that line. A segment counts from its start up to, not including, its end, so a stroke
;; going forward has an open end (as before) and a turning point is counted once.

(defn axis-u [log? v] (if log? (log2 v) v))
(defn axis-v [log? u] (if log? (js/Math.pow 2 u) u))

(defn crossings
  "Values of the other coordinate where the polyline pts crosses coordinate k (0 = x, 1 = y) = v."
  [pts k v logs]
  (let [o (- 1 k) lk (nth logs k) lo (nth logs o)
        uv (axis-u lk v)]
    (vec (keep (fn [[a b]]
                 (let [ca (axis-u lk (nth a k)) cb (axis-u lk (nth b k))]
                   (when (or (and (< ca cb) (<= ca uv) (< uv cb))
                             (and (> ca cb) (< cb uv) (<= uv ca)))
                     (let [r (/ (- uv ca) (- cb ca))
                           oa (axis-u lo (nth a o)) ob (axis-u lo (nth b o))]
                       (axis-v lo (+ oa (* r (- ob oa))))))))
               (partition 2 1 pts)))))

(defn read-along
  "Everything a canvas holds at x = v (axis :x) or y = v (axis :y): [[id value] ...] in stroke order.
   A stroke that crosses more than once gives :t1, :t1-2, :t1-3 …"
  [d axis v]
  (let [logs [(x-log? d) (y-log? d)] k (if (= axis :y) 1 0)]
    (vec (mapcat (fn [[id s]]
                   (map-indexed (fn [i val] [(if (zero? i) id (keyword (str (name id) "-" (inc i)))) val])
                                (crossings (:pts s) k v logs)))
                 (sorted-strokes d)))))

(defn read-at "Everything that sounds at time t (reading along X)." [d t] (read-along d :x t))

;; ───────── trajectories ─────────
;; A stroke can also be read as a path: position u from 0 to 1 along it, in the order it was drawn,
;; proportionally to its length as it is seen (each axis on its own scale, both of the same size).

(declare ranges)

(defn stroke-for
  "The points of stroke `sid` (a keyword), or of the first stroke if sid is nil or not there."
  [d sid]
  (or (when sid (get-in d [:strokes sid :pts]))
      (:pts (second (first (sorted-strokes d))))))

(defn point-along
  "The point [x y] at fraction u (0…1) of the length of a path."
  [d pts u]
  (when (>= (count pts) 2)
    (let [{:keys [xa xb ya yb xlog ylog]} (ranges d)
          nx (fn [x] (/ (- (axis-u xlog x) (axis-u xlog xa)) (- (axis-u xlog xb) (axis-u xlog xa))))
          ny (fn [y] (/ (- (axis-u ylog y) (axis-u ylog ya)) (- (axis-u ylog yb) (axis-u ylog ya))))
          segs (map (fn [[a b]] [a b (js/Math.hypot (- (nx (first b)) (nx (first a))) (- (ny (second b)) (ny (second a))))])
                    (partition 2 1 pts))
          total (reduce + (map #(nth % 2) segs))
          target (* (max 0 (min 1 u)) total)]
      (if (zero? total)
        (first pts)
        (loop [[[a b len] & more] segs acc 0]
          (if (or (empty? more) (<= target (+ acc len)))
            (let [r (if (pos? len) (max 0 (min 1 (/ (- target acc) len))) 0)
                  lerp (fn [log? p q] (axis-v log? (+ (axis-u log? p) (* r (- (axis-u log? q) (axis-u log? p))))))]
              [(lerp xlog (first a) (first b)) (lerp ylog (second a) (second b))])
            (recur more (+ acc len))))))))

(defn x-range
  "The span read along X by a position from 0 to 1: the X axis of a canvas, or 0 … end of a freqt."
  [d]
  (if (generic? d)
    (let [{:keys [lo hi log]} (get-in d [:ax :x])] [lo hi (boolean log)])
    [0 (max 1e-6 (end-t d)) false]))

(defn y-range
  "The span read along Y: the Y axis of a canvas, or the lowest … highest frequency of a freqt."
  [d]
  (if (generic? d)
    (let [{:keys [lo hi log]} (get-in d [:ax :y])] [lo hi (boolean log)])
    (let [fs (map second (mapcat :pts (vals (:strokes d))))]
      (if (seq fs) [(apply min fs) (max (+ (apply min fs) 1e-6) (apply max fs)) true] [100 1000 true]))))

(defn at-unit
  "The value at fraction u of a span [lo hi log?]."
  [[lo hi log?] u] (axis-v log? (+ (axis-u log? lo) (* u (- (axis-u log? hi) (axis-u log? lo))))))

(defn value-at
  "Value of a stroke at x = t, or nil if it does not pass there (the end is open)."
  [pts t] (first (crossings pts 0 t [false true])))

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

(defn ranges
  "What the box shows: x from xa to xb and y from ya to yb, each on its scale."
  [d]
  (if (generic? d)
    (let [{:keys [x y]} (:ax d)]
      {:xa (:lo x) :xb (:hi x) :xlog (:log x) :ya (:lo y) :yb (:hi y) :ylog (:log y) :T (:hi x)})
    (let [{:keys [T lf0 lf1]} (f-range d)]
      {:xa 0 :xb T :xlog false :ya (js/Math.pow 2 lf0) :yb (js/Math.pow 2 lf1) :ylog true :T T :lf0 lf0 :lf1 lf1})))

(defn geom [d hdr]
  (let [y0 (+ hdr 3)]
    (merge (ranges d) {:x0 x0 :y0 y0 :w (- W x0 6) :h (- H y0 6)})))

(defn t->x [g t]
  (let [a (axis-u (:xlog g) (:xa g)) b (axis-u (:xlog g) (:xb g))]
    (+ (:x0 g) (* (/ (- (axis-u (:xlog g) t) a) (- b a)) (:w g)))))
(defn x->t [g x]
  (let [a (axis-u (:xlog g) (:xa g)) b (axis-u (:xlog g) (:xb g))]
    (axis-v (:xlog g) (+ a (* (/ (- x (:x0 g)) (:w g)) (- b a))))))
(defn f->y [g f]
  (let [a (axis-u (:ylog g) (:ya g)) b (axis-u (:ylog g) (:yb g))]
    (+ (:y0 g) (* (/ (- b (axis-u (:ylog g) f)) (- b a)) (:h g)))))
(defn y->f [g y]
  (let [a (axis-u (:ylog g) (:ya g)) b (axis-u (:ylog g) (:yb g))]
    (axis-v (:ylog g) (- b (* (/ (- y (:y0 g)) (:h g)) (- b a))))))

(defn nice-step
  "A round step (1, 2 or 5 × 10^k) that cuts span into about n parts."
  [span n]
  (let [raw (/ span (max 1 n)) k (js/Math.pow 10 (js/Math.floor (/ (js/Math.log raw) (js/Math.log 10))))
        m (/ raw k)]
    (* k (cond (< m 1.5) 1 (< m 3.5) 2 (< m 7.5) 5 :else 10))))

(defn ticks
  "[[v level label]] every nice step between a and b."
  [a b n]
  (let [p (nice-step (- b a) n)]
    (for [k (range (js/Math.ceil (/ a p)) (inc (js/Math.floor (/ b p))))
          :let [v (round-to (* k p) 6)]]
      [v (if (zero? v) 1 0) (fmt v)])))

(defn lines-x
  "[[t level label]]: level 0 = step, 1 = group, 2 = start of cycle."
  [gx g]
  (let [a (:xa g) T (:xb g) px-per-unit (/ (:w g) (- T a))]
    (cond
      (and (not gx) (or (:xlog g) (not= a 0) (not (:lf0 g))))
      (if (:xlog g)
        (for [k (range (js/Math.ceil (log2 a)) (inc (js/Math.floor (log2 T)))) :let [v (js/Math.pow 2 k)]] [v 1 (fmt v)])
        (ticks a T 8))
      (not gx)
      (for [t (range 0 (inc T))] [t (if (zero? (mod t 4)) 1 0) nil])
      :else
      (let [p (:step gx) cs (or (seq (:cycles gx)) [4]) L (reduce + cs)
            bounds (butlast (reductions + 0 cs))
            steps (when (>= (* p px-per-unit) 5)
                    (for [k (range (js/Math.ceil (/ a p)) (inc (js/Math.floor (/ T p))))] [(* k p) 0 nil]))]
        (concat steps
                (for [c (range (js/Math.floor (/ a L)) (inc (js/Math.floor (/ T L)))) b bounds
                      :let [t (+ (* c L) b)] :when (<= a t T)]
                  [t (if (zero? b) 2 1) (when (zero? b) (inc c))]))))))

(defn lines-y
  "[[hz level label]] within the visible range."
  [gy g]
  (let [f0 (:ya g) f1 (:yb g)]
    (cond
      (and (:step gy) (not (:cents gy)))
      (let [p (:step gy) n (/ (- f1 f0) p) every (max 1 (js/Math.ceil (/ n (/ (:h g) 14))))]
        (for [k (range (js/Math.ceil (/ f0 p)) (inc (js/Math.floor (/ f1 p))))
              :let [v (round-to (* k p) 6)]]
          [v (if (zero? (mod k every)) 1 0) (when (zero? (mod k every)) (fmt v))]))
      (and (not gy) (not (:ylog g)))
      (ticks f0 f1 6)
      (not gy)
      (for [k (range (js/Math.ceil (log2 (/ f0 55))) (inc (js/Math.floor (log2 (/ f1 55)))))
            :let [f (* 55 (js/Math.pow 2 k))]]
        [f 1 (str (round-to f 1))])
      :else
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
                           ids " · " (fmt (ffirst pts)) "→" (fmt (first (peek pts))) " · " (fmt (second (first pts)))
                           (when-not (generic? d) " Hz") "</title></path>")))
         (when (and new-pts (>= (count new-pts) 2))
           (str "<path class=\"stroke new\" d=\"" (path-d g new-pts) "\"></path>")))))

(defn summary [d]
  (if (generic? d)
    (let [{:keys [x y]} (:ax d) rng (fn [a] (str (fmt (:lo a)) "…" (fmt (:hi a)) (when (:log a) " log")))]
      (str "x " (rng x) " · y " (rng y) " · " (count (:strokes d)) " strokes"))
  (str (if-let [gy (:gy d)] (:name gy) "continuous Hz")
       " · " (if-let [gx (:gx d)] (str "step " (fmt (:step gx)) " · cycle " (str/join "+" (map fmt (or (seq (:cycles gx)) [4])))) "free time")
       " · " (count (:strokes d)) " strokes")))

;; ───────── projections ─────────

(defn ->code
  "Lines of code that rebuild the canvas of box `id`."
  [id d]
  (concat
   (when (and (generic? d) (not= (:ax d) default-ax))
     (for [k [:x :y] :let [a (get-in d [:ax k])] :when (not= a (get default-ax k))]
       (str "(axis " id " " k " " (fmt (:lo a)) " " (fmt (:hi a)) (when (:log a) " :log") ")")))
   (when-let [gy (and (:step (:gy d)) (not (:cents (:gy d))) (:gy d))]
     [(str "(grid-y " id " " (fmt (:step gy)) ")")])
   (when-let [gy (and (:cents (:gy d)) (:gy d))]
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
