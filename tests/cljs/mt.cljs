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

(t/run! "grouped meters and metric weight"
  (fn []
    (let [eighths (fn [m n] (mapv (fn [i] (mt/meter-level m (* i 0.5))) (range n)))
          mei (fn [tree] (:mei (mt/->mei tree "g")))
          beams (fn [x] (count (re-seq #"<beam>" x)))]
      (t/eq "a meter written as text" (mt/parse-meter "5/8[2+3]") {:meter [5 8] :groups [2 3]})
      (t/eq "metric levels of 4/4 in eighths" (eighths [4 4] 8) [0 3 2 3 1 3 2 3])
      (t/eq "metric levels of 6/8" (eighths [6 8] 6) [0 2 2 1 2 2])
      (t/eq "metric levels of 3/4" (eighths [3 4] 6) [0 2 1 2 1 2])
      (t/eq "the second group of 5/8[2+3] starts a group" (mt/meter-level "5/8[2+3]" 1) 1)
      (t/eq "…and the same place in 5/8[3+2] is inside one" (mt/meter-level "5/8[3+2]" 1) 2)
      (t/eq "Barlow: 3/4 in eighths" (mt/indispensability [3 4] 0.5) [5 0 3 1 4 2])
      (t/eq "Barlow: 6/8 ranks the same eighths differently" (mt/indispensability [6 8]) [5 0 2 4 1 3])
      (t/eq "Barlow: 5/8 and 7/8" [(mt/indispensability [5 8]) (mt/indispensability [7 8])] [[4 0 3 1 2] [6 0 4 2 5 1 3]])
      (t/eq "Barlow: 4/4 in sixteenths" (mt/indispensability [4 4] 0.25) [15 0 8 4 12 2 10 6 14 1 9 5 13 3 11 7])
      (t/eq "a grouped meter ranks by level, then inside its groups" (mt/indispensability "5/8[2+3]") [4 1 3 0 2])
      (t/eq "indispensability at a position" [(mt/indispensability-at [3 4] 0) (mt/indispensability-at [3 4] 2) (mt/indispensability-at [3 4] 0.5)] [2 1 nil])
      (t/eq "pulses" (mt/pulses [3 4] 0.5) [0 0.5 1 1.5 2 2.5])
      (t/eq "a measure inherits meter and groups"
            (mt/attrs (second (mt/kids (mt/with-meters [:voice [:measure {:meter "5/8[2+3]"} "c4/2.5"] [:measure "c4/2.5"]]))))
            {:meter [5 8] :groups [2 3]})
      (t/eq "a written meter is read on expansion" (mt/attrs (mt/expand [:measure {:meter "7/8[2+2+3]"} "c4/3.5"])) {:meter [7 8] :groups [2 2 3]})
      (t/is "groups that do not add up are an error" (seq (mt/errors [:voice [:measure {:meter [5 8] :groups [2 2]} "c4/2.5"]])))
      (t/is "a grouped measure that adds up has no problems" (empty? (mt/problems [:voice [:measure {:meter "5/8[2+3]"} "c4/1 d4/1.5"]])))
      (t/eq "an :rtm fills a measure with a written meter" (mt/duration [:measure {:meter "6/8"} [:rtm {:shares [1 1]}]]) 3)
      (let [x (mei [:voice [:measure {:meter "5/8[2+3]"} "c4/.5 d4 e4 f4 g4"]])]
        (t/is "a grouped meter is written 2+3" (re-find #"meter.count=\"2\+3\" meter.unit=\"8\"" x))
        (t/eq "eighths beamed by group: 2+3" (beams x) 2))
      (t/eq "4/4: eighths beamed by beat" (beams (mei [:voice [:measure {:meter [4 4]} "c4/.5 d4 e4 f4 g4/2"]])) 2)
      (t/eq "6/8: eighths beamed in threes" (beams (mei [:voice [:measure {:meter [6 8]} "c4/.5 d4 e4 f4 g4 a4"]])) 2)
      (t/is "a triplet of eighths is beamed inside its bracket"
            (re-find #"<tuplet[^>]*><beam>" (mei [:voice [:measure {:meter [2 4]} [:tuplet {:ratio [3 2]} "c4/.5 d4 e4"] "f4/1"]])))
      (t/eq "thin keeps the strongest beats" (mt/pitches (mt/thin 2 [:measure {:meter [4 4]} "c4/1 d4 e4 f4"])) ["c4" "e4"])
      (t/eq "thinning keeps the duration" (mt/duration (mt/thin 0.5 [:measure {:meter [4 4]} "c4/1 d4 e4 f4"])) 4)
      (let [six "c4/.5 d4 e4 f4 g4 a4"]
        (t/eq "thin in 3/4 and in 6/8 keeps different eighths"
              [(mt/pitches (mt/thin 2 [:measure {:meter [3 4]} six])) (mt/pitches (mt/thin 2 [:measure {:meter [6 8]} six]))]
              [["c4" "g4"] ["c4" "f4"]])))))
