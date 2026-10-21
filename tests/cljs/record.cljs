;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · record: any stream of numbers into a canvas
(ns kairotic.test.record
  (:require [kairotic.components :as comp]
            [kairotic.record :as rec]
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
    (t/eq "before rec it does nothing" (recv nil {:value 0.5 :at 1}) {})))
