;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tempo
;; Played time as beats (issue #106). Notes played live are in seconds (or in beats at a tempo nobody chose:
;; transcribe writes them at 60 bpm), at an unknown tempo that moves. Before they can be quantized, their
;; time has to be mapped onto the beats of the music:
;;  1. the tempo: the period between beats that explains most intervals between onsets (each onset weighs
;;     as much as the note it starts lasts), with a mild preference for moderate tempos;
;;  2. the beats: a dynamic programme over a grid of time (after Ellis 2007, "Beat tracking by dynamic
;;     programming"): each beat sits where onsets are, and the gap to the one before stays close to the
;;     period, so the beat can follow a tempo that speeds up or slows down;
;;  3. the bar: which beat is the first of the bar, by where the weight of the notes falls (a pickup when
;;     the first beat is not a downbeat);
;;  4. the time map: [[time beat] …] (beats as kairotic.mt counts them, a quarter = 1), linear between its
;;     points and beyond them. quantize uses it with the option :time (:track, or the map itself, kept).
;; Pure functions on numbers: no audio, no state.

(ns kairotic.tempo
  (:require [kairotic.mt :as mt]))

(defn- sq [x] (* x x))
(defn- log2 [x] (/ (js/Math.log x) js/Math.LN2))

(def defaults
  "The settings of the tracker: :prior the most likely beat period (units of the input: seconds at 60) and
   how wide its preference is (octaves); :tight how much the beat resists changing its period; :chord how
   close two onsets are to be one."
  {:prior 0.6 :width 1.2 :tight 25 :chord 0.05 :weigh :note :last 0})

(defn onsets
  "Notes ({:on :off}) as weighted onsets [{:t :w}], in order: onsets closer than :chord are one; each weighs
   the notes it starts, longer notes more (a note of 1 unit about 1, one of a tenth about 0.4)."
  [notes {:keys [chord]}]
  (let [ns (sort-by :on (filter (fn [n] (and (number? (:on n)) (number? (:off n)))) notes))
        w (fn [n] (max 0.3 (min 2 (log2 (+ 1 (* 2 (max 0 (- (:off n) (:on n)))))))))]
    (reduce (fn [acc n]
              (let [lst (peek acc)]
                (if (and lst (< (- (:on n) (:t lst)) chord))
                  (conj (pop acc) (update lst :w + (* 0.5 (w n))))
                  (conj acc {:t (:on n) :w (w n)}))))
            [] ns)))

(defn period-score
  "How well a beat period P explains the intervals between the onsets: each pair of onsets up to 4 periods
   apart adds the product of their weights when their distance is a whole number of periods (a Gaussian of
   the deviation, 6 % of the period wide)."
  [os P]
  (let [v (vec os) n (count v)]
    (loop [i 0 acc 0]
      (if (>= i n)
        acc
        (let [{ti :t wi :w} (v i)
              acc (loop [j (inc i) acc acc]
                    (if (>= j n)
                      acc
                      (let [{tj :t wj :w} (v j) x (/ (- tj ti) P)]
                        (if (> x 4.5)
                          acc
                          (let [k (js/Math.round x)]
                            (recur (inc j) (if (>= k 1) (+ acc (* wi wj (js/Math.exp (/ (- (sq (- x k))) (* 2 (sq 0.06)))))) acc)))))))]
          (recur (inc i) acc))))))

(defn period
  "The beat period of weighted onsets: the best of the periods from 0.2 to 2.5 units (1 % apart), by
   period-score times a preference for periods near :prior (a Gaussian in octaves, :width wide). nil with
   fewer than 3 onsets."
  [os {:keys [prior width]}]
  (when (>= (count os) 3)
    (let [ps (take-while (fn [p] (<= p 2.5)) (iterate (fn [p] (* p 1.01)) 0.2))
          sc (fn [p] (* (period-score os p) (js/Math.exp (/ (- (sq (log2 (/ p prior)))) (* 2 (sq width))))))]
      (apply max-key sc ps))))

(defn track
  "The beats of weighted onsets with period P: their times, in order (after Ellis 2007). Time is a grid of
   P/40; each point of it scores the onsets near it (a Gaussian 4 % of P wide), and a beat there adds its
   score to the best beat before it, 0.66 to 1.5 periods back, less :tight × (log of the gap over P)². The
   first beat is within 1.5 periods of the first onset; the last near the last onset."
  [os P {:keys [tight]}]
  (when (and P (seq os))
    (let [dt (/ P 40) t0 (- (:t (first os)) (* 0.25 P)) t1 (+ (:t (peek (vec os))) (* 0.25 P))
          n (inc (js/Math.ceil (/ (- t1 t0) dt)))
          sig (* 0.04 P) reach (js/Math.ceil (/ (* 4 sig) dt))
          env (let [a (make-array n)]
                (dotimes [k n] (aset a k 0))
                (doseq [{:keys [t w]} os
                        :let [c (js/Math.round (/ (- t t0) dt))]
                        k (range (max 0 (- c reach)) (min n (+ c reach 1)))]
                  (aset a k (+ (aget a k) (* w (js/Math.exp (/ (- (sq (- (+ t0 (* k dt)) t))) (* 2 (sq sig))))))))
                a)
          lo (js/Math.round (/ (* 0.66 P) dt)) hi (js/Math.round (/ (* 1.5 P) dt))
          start (js/Math.round (/ (* 1.5 P) dt))
          C (make-array n) prev (make-array n)]
      (dotimes [k n]
        (let [[bj bc] (loop [j (- k lo) bj -1 bc (- js/Infinity)]
                        (if (or (< j 0) (< j (- k hi)))
                          [bj bc]
                          (let [c (- (aget C j) (* tight (sq (js/Math.log (/ (* (- k j) dt) P)))))]
                            (if (> c bc) (recur (dec j) j c) (recur (dec j) bj bc)))))
              fresh (when (< k start) 0)
              [bj bc] (if (and fresh (or (< bj 0) (> fresh bc))) [-1 fresh] [bj bc])]
          (aset C k (+ (aget env k) (if (< bj 0) (or fresh (- js/Infinity)) bc)))
          (aset prev k bj)))
      ;; the last beat: the best point near the last onset
      (let [kend (dec n) from (max 0 (- kend (js/Math.round (/ (* 0.75 P) dt))))
            k* (apply max-key (fn [k] (aget C k)) (range from (inc kend)))]
        (loop [k k* out ()]
          (if (< k 0) (vec out) (recur (aget prev k) (cons (+ t0 (* k dt)) out))))))))

(defn phase-weights
  "For each of the m phases (which of the first m beats is a downbeat), the share of the notes' weight that
   falls on its downbeats (0 … 1): see bar-phase."
  [os beats m]
  (if (or (< m 2) (< (count beats) m))
    (vec (repeat (max 1 m) (/ 1 (max 1 m))))
    (let [v (vec os) bv (vec beats)
          P (/ (- (peek bv) (first bv)) (max 1 (dec (count bv))))
          s (mapv (fn [b] (reduce + (keep (fn [o] (when (< (js/Math.abs (- (:t o) b)) (* 0.15 P)) (:w o))) v))) bv)
          total (max 1e-9 (reduce + s))]
      (mapv (fn [k] (/ (reduce + (map-indexed (fn [i x] (if (= k (mod i m)) x 0)) s)) total)) (range m)))))

(defn bar-phase
  "Which of the first m beats is a downbeat (0 … m-1): the one whose beats every m weigh most. A beat weighs
   the onsets near it: by the time to the next onset (:weigh :ioi, long notes fall on strong beats) or by the
   note's own weight (:weigh :note); with :last, the beat the last note starts on weighs that share of the
   total more (a piece ends on a downbeat more often than not)."
  ([os beats m] (bar-phase os beats m {}))
  ([os beats m {:keys [weigh last] :or {weigh :ioi last 0}}]
   (if (or (< m 2) (< (count beats) m))
     0
     (let [v (vec os) bv (vec beats)
           P (/ (- (peek bv) (first bv)) (max 1 (dec (count bv))))
           wt (if (= weigh :note)
                (mapv :w v)
                (mapv (fn [i] (min (* 2 P) (if (< (inc i) (count v)) (- (:t (v (inc i))) (:t (v i))) (* 2 P)))) (range (count v))))
           s (mapv (fn [b] (reduce + (keep-indexed (fn [i o] (when (< (js/Math.abs (- (:t o) b)) (* 0.15 P)) (wt i))) v))) bv)
           lastb (apply min-key (fn [i] (js/Math.abs (- (bv i) (:t (peek v))))) (range (count bv)))
           total (reduce + s)]
       (apply max-key (fn [k] (+ (reduce + (map-indexed (fn [i x] (if (= k (mod i m)) x 0)) s))
                                 (if (= k (mod lastb m)) (* last total) 0)
                                 (if (zero? k) 0.01 0)))
              (range m))))))

(defn tactus
  "The beat a meter is felt in, in quarters, and how many of them make a bar: 4/4 → [1 4], 3/4 → [1 3],
   6/8 → [1.5 2], 9/8 → [1.5 3], 2/2 → [2 2], 5/8 [2+3] and other meters in eighths → [0.5 5]."
  [meter]
  (let [{[p q] :meter} (mt/meter-of meter) u (/ 4 q) bl (* p u)]
    (cond (and (= q 8) (zero? (mod p 3)) (> p 3)) [1.5 (/ p 3)]
          (>= q 8) [u p]
          :else [u p])))

(defn beats-of
  "The beats found in notes played freely ({:on :off}): {:os the weighted onsets :period :beats [times]}, or
   nil when there are too few onsets."
  [notes opts]
  (let [o (merge defaults opts)
        os (onsets notes o)
        P (period os o)
        beats (track os P o)]
    (when (>= (count beats) 2) {:os os :period P :beats beats})))

(defn map-of
  "A time map from beats found: each worth u quarters, m of them to a bar, the k-th the first downbeat (the
   ones before it a pickup, at the end of a first bar)."
  [beats u m k]
  (mapv (fn [i t] [(/ (js/Math.round (* t 1e4)) 1e4) (+ (* (- i k) u) (if (pos? k) (* u m) 0))]) (range) beats))

(defn time-map
  "The time map of notes played freely ({:on :off}, in units: seconds at 60): [[time beat] …], one point
   per beat found, beats counted as kairotic.mt does (a quarter = 1) in the meter given, with a pickup bar
   when the first beat found is not a downbeat. nil when there is too little to find a beat in.
   opts: those of `defaults`, and :meter."
  ([notes] (time-map notes {}))
  ([notes opts]
   (let [o (merge defaults opts)
         os (onsets notes o)
         P (period os o)
         beats (track os P o)]
     (when (>= (count beats) 2)
       (let [[u m] (tactus (or (:meter o) [4 4]))
             k (bar-phase os beats m (select-keys o [:weigh :last]))
             bl (* u m)]
         (mapv (fn [i t] [(/ (js/Math.round (* t 1e4)) 1e4) (+ (* (- i k) u) (if (pos? k) bl 0))]) (range) beats))))))

(defn sane-map
  "A time map as kept in options: at least two points [time beat], both increasing; else nil."
  [m]
  (when (and (sequential? m) (>= (count m) 2)
             (every? (fn [p] (and (sequential? p) (= 2 (count p)) (every? number? p))) m))
    (let [m (vec (sort-by first (map vec m)))]
      (when (every? (fn [[[a x] [b y]]] (and (< a b) (< x y))) (partition 2 1 m)) m))))

(defn ->beat
  "A time as a beat, through a time map: linear between its points, and beyond them at the period of the
   nearest two."
  [m t]
  (let [v (vec m) n (count v)
        i (loop [i 0] (if (and (< i (- n 2)) (>= t (first (v (inc i))))) (recur (inc i)) i))
        [[a x] [b y]] [(v i) (v (inc i))]]
    (+ x (* (- t a) (/ (- y x) (- b a))))))

(defn tempo-of-map
  "The tempo a time map stands for, in beats per minute of its units (60 units a minute): the median of the
   tempos between its points."
  [m]
  (let [ts (sort (map (fn [[[a x] [b y]]] (* 60 (/ (- y x) (- b a)))) (partition 2 1 m)))]
    (when (seq ts) (nth ts (quot (count ts) 2)))))

(defn map-notes
  "Notes ({:on :off …}) with their times mapped through a time map, onto beats."
  [notes m]
  (mapv (fn [n] (assoc n :on (->beat m (:on n)) :off (->beat m (:off n)))) notes))
