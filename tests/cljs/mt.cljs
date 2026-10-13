;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · musical trees (kairotic.mt)
(ns kairotic.test.mt
  (:require [kairotic.mt :as mt]
            [kairotic.test :as t]))

(def motif [:voice {:name "m"} [:measure {:meter [4 4]} "c4/1 e4 g4/2"]])

(t/run! "musical trees"
  (fn []
    (t/eq "a melody string becomes notes" (mt/pitches motif) ["c4" "e4" "g4"])
    (t/eq "its duration in beats" (mt/duration motif) 4)
    (t/eq "transpose 7" (mt/pitches (mt/transpose 7 motif)) ["g4" "b4" "d5"])
    (t/eq "retrograde" (mt/pitches (mt/retrograde motif)) ["g4" "e4" "c4"])
    (t/eq "augment 2 doubles the duration" (mt/duration (mt/augment 2 motif)) 8)
    (t/eq "a read tree is the same tree" (mt/read-tree (mt/pp motif)) motif)
    (let [b (mt/transpose 2 motif)]
      (t/eq "diff then apply gives the other tree" (reduce mt/apply-op motif (mt/diff motif b)) b))
    (t/is "a measure that does not add up is a warning, not an error"
          (let [t [:voice [:measure {:meter [4 4]} "c4/1 e4"]]] (and (empty? (mt/errors t)) (seq (mt/warnings t)))))
    (t/eq "a schedule plays every note" (count (filter (fn [[_ outs]] (some (fn [[o _]] (= o 0)) outs)) (mt/schedule motif))) 4)))
