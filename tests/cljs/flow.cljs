;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · data that flows: the same value twice changes nothing (Study 23)
(ns kairotic.test.flow
  (:require [kairotic.mt :as mt]
            [kairotic.mtboxes :as mtb]
            [kairotic.engine :as eng]
            [kairotic.canvas :as cv]
            [kairotic.signal :as sig]
            [kairotic.test :as t]))

(def tree (mt/expand [:voice "c4/1 e4 g4"]))
(def other (mt/expand [:voice "d4/1 f4 a4"]))

(defn play [state value at] (mtb/play {:state state :args [:play] :inlet 0 :value value :at at}))

(t/run! "flow"
  (fn []
    (let [r1 (play nil tree 0)
          r2 (play (:state r1) :bang 1)
          st (:state r2)]
      (t/is "a bang plays the tree it has" (and (:playing st) (seq (:later r2))))
      (let [r3 (play st tree 1.5)]
        (t/eq "the same tree again changes nothing (it keeps playing)" (:state r3) st)
        (t/is "and schedules nothing new" (empty? (:later r3))))
      (let [r4 (play st other 2)]
        (t/is "another tree while playing goes on with it" (and (:playing (:state r4)) (seq (:later r4))))
        (t/is "from its beginning" (= 2 (:t0 (:state r4)))))
      (t/is ":stop stops" (not (:playing (:state (play st :stop 3))))))
    (let [b (eng/tree-buffer :test tree)]
      (t/eq "a shown tree is a buffer: one stroke per note" (count (:strokes b)) 3)
      (t/is "turned into a buffer once (same tree, same buffer)" (identical? b (eng/tree-buffer :test tree))))))

(t/run! "reader~ tables"
  (fn []
    (let [d (-> cv/empty (assoc :ax {:x {:lo 0 :hi 1 :log false} :y {:lo 40 :hi 1800 :log true}})
                (assoc :strokes {:t1 {:pts [[0 110] [0.2 110]]} :t2 {:pts [[0.1 220] [0.3 330]]}
                                 :t3 {:pts [[0.5 440] [0.7 660] [0.6 550]]} :t4 {:pts [[0.9 98] [1 98]]}}))
          span (cv/x-range d) n 64
          old (vec (for [i (range n)] (cv/read-along d :x (cv/at-unit span (/ i (dec n))))))]
      (t/eq "sampling only the strokes that can pass reads the same" (sig/readings d :x span n) old)
      (t/is "the same buffer, rebuilt, gives the same table without sampling it again"
            (identical? (sig/table d :x 2 nil) (sig/table (into {} d) :x 2 nil))))))
