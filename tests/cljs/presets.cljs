;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · presets from the keyframes of the history (issue #35): configurations, recall, morph,
;; what changes and what remains, and the presets box
(ns kairotic.test.presets
  (:require [kairotic.components :as comp]
            [kairotic.presets :as pst]
            [kairotic.test :as t]))

;; a control as a knob is (the knob itself comes from @kairotic/controls, not loaded here)
(comp/define! "tknob"
  {:io [1 1]
   :args [[:min 0] [:max 1] [:initial :min] [:log false] [:name nil]]
   :persist (fn [v] {:initial (comp/nice v)})
   :receive (fn [{:keys [value]}] {:state value :out [[0 value]]})})

;; and one that keeps several numbers, as an envelope (adsr~) or a pad (space~) do
(comp/define! "tenv"
  {:io [1 1]
   :args [[:a 10] [:d 100] [:s 0.5] [:r 300]]
   :persist (fn [[a d s r]] {:a a :d d :s s :r r})
   :receive (fn [{:keys [value]}] {:state value})})

(def sub {:boxes (sorted-map :b1 {:text "inlet"} :b2 {:text "tknob 0 10 2"}) :lines []})
(def p {:boxes (sorted-map :b1 {:text "tknob 0 1 0.25"} :b2 {:text "metro 250"} :b3 {:text "osc~ 440"}
                           :b4 {:text "patch" :data sub})
        :lines []})

(def a {:b1 "tknob 0 1 0.25" :b2 "metro 250" :b3 "osc~ 440" :b5 "tknob 20 20000 100 log" :b6 "msg c4"})
(def b {:b1 "tknob 0 1 0.75" :b2 "metro 500" :b3 "osc~ 440" :b5 "tknob 20 20000 10000 log" :b6 "msg e4"})
(def c {:b1 "tknob 0 1 0.5"  :b2 "metro 375" :b3 "osc~ 440" :b5 "tknob 20 20000 1000 log" :b6 "msg g4"})

(defn close? [x y] (< (js/Math.abs (- x y)) 1e-9))

(t/run! "presets"
  (fn []
    ;; configurations: the text of every box, sub-patches included, by engine id
    (t/eq "a configuration has the text of every box, inside sub-patches too"
          (pst/configuration p)
          {:b1 "tknob 0 1 0.25" :b2 "metro 250" :b3 "osc~ 440" :b4 "patch" :b4.b1 "inlet" :b4.b2 "tknob 0 10 2"})
    (t/eq "an engine id leads back to its box" (pst/path-of :b4.b2) [:b4 :b2])
    (t/eq "... and the box to its engine id" (pst/fid [:b4] :b2) :b4.b2)

    ;; controls: the value a box keeps in its text
    (t/eq "a knob keeps its value in its text" (select-keys (pst/control "tknob 0 1 0.25") [:ks :v :log]) {:ks [:initial] :v 0.25 :log false})
    (t/is "... a log knob says so" (:log (pst/control "tknob 20 20000 100 log")))
    (t/is "a box that keeps nothing is no control" (nil? (pst/control "metro 250")))
    (t/eq "a control keeps a new value in its text" (pst/control-text "tknob 0 1 0.25" 0.5) "tknob 0 1 0.5")
    (t/eq "a control can keep several numbers (an envelope)" (select-keys (pst/control "tenv 10 100 0.5 300") [:ks :v])
          {:ks [:a :d :s :r] :v [10 100 0.5 300]})
    (t/eq "... and a new vector in its text" (pst/control-text "tenv 10 100 0.5 300" [20 200 0.25 600]) "tenv 20 200 0.25 600")
    (t/eq "... which a morph moves element by element"
          (pst/morph-values {:b1 "tenv 10 100 0.5 300"} {:b1 "tenv 10 100 0.5 300"} {:b1 "tenv 30 300 1 900"} 0.5)
          {:b1 [20 200 0.75 600]})

    ;; recall: the boxes that are both now and in the keyframe, with another text there
    (t/eq "recall gives the boxes their text of the keyframe" (pst/recall-changes a b)
          {:b1 "tknob 0 1 0.75" :b2 "metro 500" :b5 "tknob 20 20000 10000 log" :b6 "msg e4"})
    (t/eq "... boxes that are not there now are not made" (pst/recall-changes {:b1 "tknob 0 1 0.25"} b) {:b1 "tknob 0 1 0.75"})
    (t/eq "... boxes that are not in the keyframe are left alone" (pst/recall-changes (assoc a :b9 "print") a) {})
    (t/eq "... spaces alone are no change" (pst/recall-changes {:b2 "metro  250"} {:b2 "metro 250"}) {})

    ;; morph: a position among keyframes, and the values in between
    (t/eq "1.5 is halfway from the first keyframe to the second" (pst/between 1.5 3) [1 2 0.5])
    (t/eq "the last keyframe is the end of the last pair" (pst/between 3 3) [2 3 1])
    (t/eq "a position out of range stays in it" (pst/between 9 3) [2 3 1])
    (t/eq "... below too" (pst/between -2 3) [1 2 0])
    (let [m (pst/morph-values a a b 0.5)]
      (t/eq "only controls move in a morph" (set (keys m)) #{:b1 :b5})
      (t/is "... linearly" (close? (:b1 m) 0.5))
      (t/is "... geometrically for a log knob (frequencies)" (close? (:b5 m) 1000)))
    (t/eq "a control that drives the morph stays where it is" (keys (pst/morph-values a a b 0.5 #{:b1})) [:b5])
    (t/eq "a control that is the same in both and now does not move" (pst/morph-values a a (assoc b :b5 (:b5 a)) 0.5 #{:b1}) {})
    (t/eq "... but one that was moved since goes back between them"
          (pst/morph-values (assoc a :b1 "tknob 0 1 0.9") a (assoc b :b1 (:b1 a)) 0.5 #{:b5}) {:b1 0.25})
    (t/eq "a box of another class now is not moved" (pst/morph-values (assoc a :b1 "osc~ 3") a b 0.5 #{:b5}) {})
    (t/eq "the values of a morph are kept in the texts" (pst/keep-changes a {:b1 0.5 :b5 1000})
          {:b1 "tknob 0 1 0.5" :b5 "tknob 20 20000 1000 log"})
    (t/eq "... a value the text already has is no change" (pst/keep-changes a {:b1 0.25}) {})

    ;; what changes and what remains
    (let [v (pst/variation [a b c])]
      (t/eq "what is the same in all keyframes remains" (get v :b3) [{:same "osc~"} {:same "440"}])
      (t/eq "a number that changes has its range" (select-keys (get-in v [:b2 1]) [:lo :hi :int]) {:lo 250 :hi 500 :int true})
      (t/eq "... with the decimals it is written with" (select-keys (get-in v [:b1 3]) [:lo :hi :int :places]) {:lo 0.25 :hi 0.75 :int false :places 2})
      (t/eq "a word that changes is one of its words" (get-in v [:b6 1]) {:words ["c4" "e4" "g4"]}))
    (t/is "a box of another class in one keyframe is left out" (nil? (get (pst/variation [a (assoc b :b2 "delay 3")]) :b2)))
    (t/is "... and so is one with another number of words" (nil? (get (pst/variation [a (assoc b :b2 "metro 250 x")]) :b2)))

    ;; generate: seeded, within the ranges, what remains stays
    (let [r (pst/rng 7) xs (repeatedly 200 r)]
      (t/is "the generator gives numbers in [0, 1)" (every? (fn [x] (and (>= x 0) (< x 1))) xs))
      (t/eq "... the same ones from the same seed" (take 5 (repeatedly (pst/rng 7))) (take 5 xs))
      (t/is "... other ones from another seed" (not= (take 5 (repeatedly (pst/rng 8))) (take 5 xs))))
    (let [g (pst/generate-changes a [a b c] (pst/rng 42))
          g2 (pst/generate-changes a [a b c] (pst/rng 42))
          gens (map (fn [s] (merge a (pst/generate-changes a [a b c] (pst/rng s)))) (range 1 60))
          num-at (fn [cfg id i] (pst/num (nth (pst/words (get cfg id)) i)))]
      (t/eq "the same seed makes the same preset" g g2)
      (t/is "what remains is not touched" (not (contains? g :b3)))
      (t/is "numbers stay within their range"
            (every? (fn [cfg] (and (<= 250 (num-at cfg :b2 1) 500) (<= 0.25 (num-at cfg :b1 3) 0.75)
                                   (<= 100 (num-at cfg :b5 3) 10000)))
                    gens))
      (t/is "whole numbers stay whole" (every? (fn [cfg] (integer? (num-at cfg :b2 1))) gens))
      (t/is "words are among theirs" (every? (fn [cfg] (#{"msg c4" "msg e4" "msg g4"} (get cfg :b6))) gens))
      (t/is "... the class and the constant words stay" (every? (fn [cfg] (= ["tknob" "20" "20000"] (take 3 (pst/words (get cfg :b5))))) gens))
      (t/is "a log knob is varied geometrically: about half its presets below the geometric middle"
            (< 15 (count (filter (fn [cfg] (< (num-at cfg :b5 3) 1000)) gens)) 45))
      (t/is "presets differ from one seed to another" (< 10 (count (distinct gens)))))
    (t/eq "a box that is not there now is not made" (keys (pst/generate-changes {:b2 "metro 300"} [a b] (pst/rng 1))) [:b2])

    ;; the presets box: it asks the page, and a position again changes nothing
    (let [rcv (:receive (comp/lookup "presets"))
          m (fn [inlet value state] (rcv {:inlet inlet :value value :state state :args []}))]
      (t/eq "presets has two inlets and an outlet" (comp/io {:text "presets"}) [2 1])
      (t/eq "a number recalls" (:effects (m 0 2 nil)) [[:presets [:recall 2]]])
      (t/eq "a label recalls" (:effects (m 0 :intro nil)) [[:presets [:recall "intro"]]])
      (t/eq "a bang generates" (:effects (m 0 :bang nil)) [[:presets [:generate nil]]])
      (t/eq "[:generate seed] generates from a seed" (:effects (m 0 [:generate 42] nil)) [[:presets [:generate 42]]])
      (t/eq "keep keeps the morph" (:effects (m 0 :keep nil)) [[:presets [:keep]]])
      (t/eq "[:morph a b t] morphs" (:effects (m 0 [:morph 1 "chorus" 0.25] nil)) [[:presets [:morph 1 "chorus" 0.25]]])
      (t/is "a fractional number on the left says where it goes" (= :print (ffirst (:effects (m 0 1.5 nil)))))
      (t/eq "a position on the right morphs" (m 1 1.5 nil) {:state {:x 1.5} :effects [[:presets [:morph-at 1.5]]]})
      (t/eq "... the same position again changes nothing" (m 1 1.5 {:x 1.5}) {}))))
