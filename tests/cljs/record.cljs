;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · record: any stream of numbers into a canvas
(ns kairotic.test.record
  (:require [kairotic.components :as comp]
            [kairotic.record :as rec]
            [kairotic.canvas :as cv]
            [kairotic.test :as t]))

(defn recv [state m] ((:receive (comp/lookup "record")) (merge {:state state :args [] :inlet 0} m)))

(defn run
  "Messages [inlet value at] through a record box: [final state, every edit it sent]."
  [args msgs]
  (reduce (fn [[st outs] [inlet v at]]
            (let [r (recv st {:args args :inlet inlet :value v :at at})]
              [(if (contains? r :state) (:state r) st) (into outs (map second (:out r)))]))
          [nil []] msgs))

(t/run! "record"
  (fn []
    (t/eq "simplify keeps the corners of a time series"
          (rec/simplify [[0 0] [1 0] [2 0] [3 5] [4 5] [5 5]] 0.1) [[0 0] [2 0] [3 5] [5 5]])
    (t/eq "... and drops what is within eps" (rec/simplify [[0 0] [1 0.05] [2 0]] 0.1) [[0 0] [2 0]])
    (t/eq "lo hi tolerance and log, from the box" (rec/args-of [0 1 0.01 :log]) {:lo 0 :hi 1 :tol 0.01 :log true})
    (let [[st outs] (run [] [[0 :rec 10] [0 0.2 10.5] [0 0.8 11] [0 0.4 11.5] [0 :stop 12]])
          first-edits (second (first outs))
          last-edits (second (last outs))
          axis (fn [k edits] (first (filter (fn [e] (= [:axis k] (take 2 e))) edits)))]
      (t/eq "it writes when a stroke has two points, then at stop" (count outs) 2)
      (t/is "... each time one batch" (every? (fn [o] (= :batch (first o))) outs))
      (t/eq "the first write clears the canvas first" (first first-edits) [:clear])
      (t/is "... and only the first" (not= [:clear] (first last-edits)))
      (t/eq "X follows the take (at least 1 s)" (axis :x last-edits) [:axis :x 0 2])
      (t/is "Y follows the values" (let [[_ _ lo hi] (axis :y last-edits)] (and (< lo 0.2) (> hi 0.8))))
      (t/eq "a staircase: each value holds until the next, the last until stop"
            (last last-edits) [:stroke :r1 [[0.5 0.2] [1 0.2] [1 0.8] [1.5 0.8] [1.5 0.4] [2 0.4]]])
      (t/is "it stops" (not (:on st))))
    (let [[_ outs] (run [0 1 :log] [[0 :rec 0] [0 0.5 0.1] [1 :bang 0.4] [0 0.7 0.6] [0 :stop 1]])
          edits (mapcat second outs)]
      (t/eq "with lo hi, Y is set to them (linear: log needs lo above 0)"
            (first (filter (fn [e] (= [:axis :y] (take 2 e))) edits)) [:axis :y 0 1])
      (t/eq "a bang on the right ends a stroke: the next value begins another"
            (distinct (map second (filter (fn [e] (= :stroke (first e))) edits))) [:r1 :r2]))
    (let [[_ outs] (run [] (concat [[0 :rec 0]] (for [i (range 40)] [0 (mod i 2) (* i 0.1)])))]
      (t/is "while recording it writes at most every 2 seconds"
            (<= (count outs) 3)))
    ;; rec t: from t on (punch-in)
    (let [[st outs] (run [] [[0 [:rec 3] 10] [0 0.2 10.5] [0 0.8 11] [0 :stop 12]])
          edits (second (first outs))
          strokes (filter (fn [e] (= :stroke (first e))) (mapcat second outs))]
      (t/eq "rec t: the first write cuts from t instead of clearing" (first edits) [:cut 3])
      (t/is "... keeps the Y axis of the canvas" (not-any? (fn [e] (= [:axis :y] (take 2 e))) edits))
      (t/eq "... and its times go on from t" (ffirst (nth (last strokes) 2)) 3.5)
      (t/is "... with ids of its own" (re-matches #"r\d+-1" (name (second (last strokes))))))
    (let [d {:strokes {:t1 {:pts [[0 1] [2 3]]} :t2 {:pts [[3 1] [4 1]]} :t3 {:pts [[0 5] [0.5 5]]}}
             :ax {:x {:lo 0 :hi 4 :log false} :y {:lo 0 :hi 6 :log false}}}]
      (t/eq "cut: a stroke that crosses t ends at t, one after t is erased, one before stays"
            (set (cv/cut-events d 1)) #{[:stroke :t1 [[0 1] [1 2]]] [:erase :t2]}))
    (let [f {:strokes {:t1 {:pts [[0 100] [2 400]]}}}]
      (t/eq "... on a freqt the point at t is geometric (pitch)" (cv/cut-events f 1) [[:stroke :t1 [[0 100] [1 200]]]]))
    ;; a window: [:cut t1 t2] (what ovr writes)
    (let [d {:strokes {:t1 {:pts [[0 0] [4 4]]} :t2 {:pts [[1.5 1] [2.5 1]]} :t3 {:pts [[5 2] [6 2]]}}
             :ax {:x {:lo 0 :hi 6 :log false} :y {:lo 0 :hi 6 :log false}}}]
      (t/eq "cut t1 t2: a stroke that spans it is split, one inside is erased, one after stays"
            (cv/cut-events d 1 3) [[:stroke :t1 [[0 0] [1 1]]] [:stroke :t4 [[3 3] [4 4]]] [:erase :t2]]))
    (t/eq "clip-out: the pieces outside a window" (cv/clip-out [[0 0] [2 2] [2 5] [4 5]] 1 3 false)
          [[[0 0] [1 1]] [[3 5] [4 5]]])
    (let [[_ outs] (run [] [[0 [:ovr 1] 10] [0 0.5 10.5] [0 0.9 11] [0 :stop 11.5]])
          edits (mapcat second outs)
          cuts (filter (fn [e] (= :cut (first e))) edits)]
      (t/eq "ovr t: each write cuts what the take covered since the last one" cuts [[:cut 1 2] [:cut 2 2.5]])
      (t/is "... and leaves X as it was (what comes after the take stays)" (not-any? (fn [e] (= [:axis :x] (take 2 e))) edits)))
    (t/eq "ovr alone: over the take from 0" (ffirst (filter (fn [e] (= :cut (first e))) (mapcat second (second (run [] [[0 :ovr 0] [0 1 0.2] [0 2 0.4] [0 :stop 1]]))))) :cut)
    (t/eq "before rec it does nothing" (recv nil {:value 0.5 :at 1}) {})))
