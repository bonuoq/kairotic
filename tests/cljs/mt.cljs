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

(t/run! "proportional rhythm (:rtm)"
  (fn []
    (t/eq "three shares of a 3/4 bar are quarters"
          (mt/expand [:measure {:meter [3 4]} [:rtm {:shares [1 1 1] :pitches "c4 d4 e4"}]])
          [:measure {:meter [3 4]} [:note {:pitch "c4" :dur 1}] [:note {:pitch "d4" :dur 1}] [:note {:pitch "e4" :dur 1}]])
    (t/eq "three shares of a 4/4 bar are a 3:2 of halves"
          (mt/expand [:measure {:meter [4 4]} [:rtm {:shares [1 1 1]}]])
          [:measure {:meter [4 4]} [:tuplet {:ratio [3 2]} [:note {:pitch "c4" :dur 2}] [:note {:pitch "c4" :dur 2}] [:note {:pitch "c4" :dur 2}]]])
    (t/eq "a common factor changes nothing"
          (mt/expand [:measure {:meter [4 4]} [:rtm {:shares [2 2 2]}]])
          (mt/expand [:measure {:meter [4 4]} [:rtm {:shares [1 1 1]}]]))
    (t/eq "five in a beat: a 5:4 of sixteenths"
          (mt/expand [:rtm {:dur 1 :shares [1 1 1 1 1] :pitch "g4"}])
          [:tuplet {:ratio [5 4]} [:note {:pitch "g4" :dur 0.25}] [:note {:pitch "g4" :dur 0.25}] [:note {:pitch "g4" :dur 0.25}]
           [:note {:pitch "g4" :dur 0.25}] [:note {:pitch "g4" :dur 0.25}]])
    (t/eq "a grouped 5/8 in eighths"
          (mt/expand [:measure {:meter [5 8]} [:rtm {:shares [2 -3]}]])
          [:measure {:meter [5 8]} [:note {:pitch "c4" :dur 1}] [:rest {:dur 1.5}]])
    (let [cell [:measure {:meter [4 4]} [:rtm {:shares [1 [1 [1 1 1]] -1 2] :pitches "c4 d4 e4 f4 g4"}]]
          mei (:mei (mt/->mei [:voice cell] "t"))]
      (t/eq "a nested cell fills its bar" (mt/duration cell) 4)
      (t/eq "its pitches go to its notes, in order" (mt/pitches cell) ["c4" "d4" "e4" "f4" "g4"])
      (t/is "a measure filled by an :rtm is not a warning" (empty? (mt/warnings [:voice cell])))
      (t/is "its score has the 5:4 and the triplet inside it"
            (and (re-find #"num=\"5\" numbase=\"4\"" mei) (re-find #"num=\"3\" numbase=\"2\"" mei))))
    (t/eq "pitches start again when they run out"
          (mt/pitches [:rtm {:dur 4 :shares [1 1 1 1] :pitches "c4 e4"}]) ["c4" "e4" "c4" "e4"])
    (t/eq "an :rtm in a measure without a meter takes the previous one"
          (mt/duration [:voice [:measure {:meter [3 4]} "c4/3"] [:measure [:rtm {:shares [1 1]}]]]) 6)
    (t/eq "shares can be written as RTM text" (mt/pitches [:rtm {:shares "(1 (1 (1 1)) -1)" :pitches "c4 d4 e4"}]) ["c4" "d4" "e4"])
    (t/is "a share that is not a number is an error" (seq (mt/errors [:voice [:rtm {:shares [1 :x]}]])))
    (t/is "its notes know they come from the :rtm"
          (:rtm (meta (second (mt/kids (mt/expand-source [:measure {:meter [3 4]} [:rtm {:shares [1 1 1]}]] :b1))))))
    (t/eq "cell-retrograde reverses every level" (mt/cell-retrograde [1 [2 [1 3]]]) [[2 [3 1]] 1])
    (t/eq "cell-rotate" (mt/cell-rotate 1 [1 2 3]) [2 3 1])
    (t/eq "cell-at" (mt/cell-at [2 [2 [1 1 1]] 3] [1 0]) 1)
    (t/eq "cell-replace-at grows a cell inside itself"
          (mt/cell-replace-at [2 [2 [1 1 1]] 3] [1] [2 [2 [1 1 1]] 3])
          [2 [2 [2 [2 [1 1 1]] 3]] 3])))
