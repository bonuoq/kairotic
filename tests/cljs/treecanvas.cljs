;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · a tree seen and drawn as a canvas (kairotic.treecanvas, discussion #92)
(ns kairotic.test.treecanvas
  (:require [kairotic.mt :as mt]
            [kairotic.canvas :as cv]
            [kairotic.treecanvas :as tc]
            [kairotic.test :as t]))

(defn- hz [m] (cv/midi->hz m))
(defn- edit [tree ev & [opts]] (reduce mt/apply-op tree (tc/edit-ops tree ev (or opts {}))))
(defn- rhythm [tree] (mapv (fn [e] [(:t e) (:dur e) (mt/pitch-name (js/Math.round (:pitch e)))]) (mt/notes tree)))
(defn- nodes [tree tg] (filter (fn [x] (and (mt/node? x) (= tg (mt/tag x)))) (tree-seq mt/node? mt/kids tree)))

(t/run! "tree as a canvas"
  (fn []
    (let [v (tc/view-data "c4/1 e4/2")]
      (t/eq "each note is a stroke" (keys (:strokes v)) [:n1 :n2])
      (t/eq "... from where it starts to where it ends, at its frequency" (get-in v [:strokes :n2 :pts]) [[1 (cv/round-to (hz 64) 3)] [3 (cv/round-to (hz 64) 3)]])
      (t/eq "... and knows where it is written" (select-keys (get-in v [:ids :n2]) [:src :sub]) {:src [] :sub [1]}))
    (t/eq "a measured tree shows its bars" (:gx (tc/view-data [:voice [:measure {:meter [3 4]} "c4/3"]])) {:step 0.25 :cycles [3]})
    (t/eq "... or the grid of its root" (:gx (tc/view-data [:voice {:grid {:step 0.5 :cycles [2]}} "c4/1"])) {:step 0.5 :cycles [2]})

    ;; free time
    (let [free [:voice [:par [:note {:at 0 :dur 1 :pitch "c4"}]]]
          t1 (edit free [:stroke :t9 [[2 (hz 67)] [3 (hz 67)]]])]
      (t/eq "drawing on a free tree adds a note where it is drawn" (rhythm t1) [[0 1 "c4"] [2 1 "g4"]])
      (t/eq "... dragging moves it" (rhythm (edit t1 [:move :n2 0.5 -200])) [[0 1 "c4"] [2.5 1 "f4"]])
      (t/eq "... stretching lengthens it" (rhythm (edit t1 [:stretch :n2 2])) [[0 1 "c4"] [2 2 "g4"]])
      (t/eq "... erasing removes it" (rhythm (edit t1 [:erase :n1])) [[2 1 "g4"]])
      (t/eq "... a written name stays when the pitch still fits" (mt/pitches (edit [:voice [:par [:note {:at 0 :dur 1 :pitch "bb4"}]]] [:move :n1 1 0])) ["bb4"]))
    (let [t2 (edit [:seq "c4/1 d4/1"] [:move :n2 0.5 0])]
      (t/eq "a tree written as a sequence takes free form when a note's time changes" (rhythm t2) [[0 1 "c4"] [1.5 1 "d4"]])
      (t/is "... ([:voice [:par notes with :at]])" (every? (fn [n] (some? (:at (mt/attrs n)))) (nodes t2 :note))))

    ;; measures
    (let [m [:voice [:measure {:meter [4 4]} "c4/1 d4 e4 f4"]]]
      (t/eq "in measures, a change of pitch alone is written in the note (here, in its melody string)"
            (mt/pitches (edit m [:move :n2 0 200])) ["c4" "e4" "e4" "f4"])
      (t/is "... and the tree stays measured" (mt/measured? (edit m [:move :n2 0 200])))
      (t/eq "erasing a note leaves a rest as long" (rhythm (edit m [:erase :n2])) [[0 1 "c4"] [2 1 "e4"] [3 1 "f4"]]))
    (let [m [:voice [:measure {:meter [4 4]} "c4/2 e4/2"] [:measure "g4/4"]]]
      (t/eq "moving a note in time re-quantizes its bar" (rhythm (edit m [:move :n1 1 0])) [[1 1 "c4"] [2 2 "e4"] [4 4 "g4"]])
      (t/is "... which stays a bar of 4/4" (= 4 (mt/duration (first (nodes (edit m [:move :n1 1 0]) :measure)))))
      (t/eq "drawing in a measured tree writes the note in its bar" (rhythm (edit m [:stroke :t9 [[6 (hz 72)] [7 (hz 72)]]]))
            [[0 2 "c4"] [2 2 "e4"] [4 2 "g4"] [6 1 "c5"]])
      (t/eq "... (a note drawn on one held in the same voice joins it as a chord)" (count (nodes (edit m [:stroke :t9 [[4 (hz 72)] [5 (hz 72)]]]) :chord)) 1)
      (let [f (edit m [:move :n1 0.3 0] {:free true})]
        (t/is "with ⌥, a note leaves the measures for a free voice" (some (fn [v] (= "free" (:name (mt/attrs v)))) (nodes f :voice)))
        (t/is "... and the rest stays measured" (mt/measured? f))
        (t/eq "... it sounds where it was dropped" (some (fn [e] (when (= "c4" (mt/pitch-name (:pitch e))) (:t e))) (mt/notes f)) 0.3)))

    (t/eq "a tree is drawn in semitones unless it has a tuning" (:name (:gy (tc/view-data [:voice "c4/1"]))) "12-tet")
    (t/eq "... :tuning false is continuous" (:gy (tc/view-data [:voice {:tuning false} "c4/1"])) nil)
    (t/eq "a new pitch drops the old one's cents" (mt/pitches (edit [:voice [:measure {:meter [4 4]} [:note {:pitch "c4" :cents 30 :dur 4}]]] [:move :n1 0 170]))
          ["d4"])
    (t/eq "the grid is an attribute of the tree's root" (:grid (mt/attrs (edit [:voice "c4/1"] [:grid-x {:step 0.5 :cycles [3]}])))
          {:step 0.5 :cycles [3]})
    (t/eq "... and so is the tuning" (:name (:tuning (mt/attrs (edit [:voice "c4/1"] [:tuning (get cv/tunings "19-tet")])))) "19-tet")
    (t/throws "a note of a proportional rhythm is edited in its :pitches, not here"
              (fn [] (tc/edit-ops [:voice [:measure {:meter [4 4]} [:rtm {:shares [1 1] :pitches "c4 d4"}]]] [:move :n1 0 100])))))
