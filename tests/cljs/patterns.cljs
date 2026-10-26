;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · patterns (kairotic.patterns): the #pat/… readers, seeded streams, pbind, pitches
(ns kairotic.test.patterns
  (:require [kairotic.patterns :as pat]
            [kairotic.test :as t]))

(defn evs [m opts n] (vec (take n (pat/pbind-events m opts))))

(t/run! "patterns: seeded randomness"
  (fn []
    (let [a (pat/rng 7) b (pat/rng 7) c (pat/rng 8)
          xs (vec (repeatedly 5 a)) ys (vec (repeatedly 5 b)) zs (vec (repeatedly 5 c))]
      (t/eq "the same seed gives the same numbers" xs ys)
      (t/is "another seed, other numbers" (not= xs zs))
      (t/is "numbers in [0, 1)" (every? (fn [x] (and (>= x 0) (< x 1))) (concat xs zs))))
    (let [r (pat/rng :x)]
      (t/is "whole ends give whole numbers, both ends included"
            (let [vs (repeatedly 400 (fn [] (pat/rand-in r 0 3)))] (and (every? pat/whole? vs) (= #{0 1 2 3} (set vs))))))
    (t/eq "a shuffle keeps the elements" (sort (pat/shuffled (pat/rng 1) [1 2 3 4 5])) [1 2 3 4 5])))

(t/run! "patterns: reading a pbind"
  (fn []
    (let [m (pat/read-spec "{:degree #pat/seq [0 2 4] :dur #pat/choose [0.25 0.5] :root #pat/hold [4 [:c :g]] :c #pat/chord [0 4 7]}")]
      (t/eq "#pat/… become generators" (:degree m) (pat/gen :seq [0 2 4]))
      (t/eq "... with their arguments" (:pat/args (:root m)) [4 [:c :g]])
      (t/is "a good map has no problems" (empty? (pat/problems m)))
      (t/eq "written back as the same text it reads from" (pat/read-spec (pat/spec->source m)) m))
    (t/eq "ratios read as numbers" (:dur (pat/read-spec "{:dur [1/4 1/2]}")) [0.25 0.5])
    (t/throws "an unknown tag does not read" (fn [] (pat/read-spec "{:a #pat/nope [1]}")))
    (t/is "a generator with bad arguments is a problem" (seq (pat/problems (pat/read-spec "{:a #pat/white [0]}"))))
    (t/is "keys must be keywords" (seq (pat/problems {"a" 1})))
    (t/is "a vector is not a pbind" (seq (pat/problems [1 2])))))

(t/run! "patterns: pbind"
  (fn []
    (let [e (evs {:degree [0 2 4] :dur [1 0.5]} {:seed 0 :repeat 1} 10)]
      (t/eq "a pass lasts as long as its longest sequence; the shorter one starts again" (mapv :dur e) [1 0.5 1])
      (t/eq "... with the values of the longest in order" (mapv :degree e) [0 2 4]))
    (t/eq "repeat: passes" (mapv :degree (evs {:degree [0 1]} {:seed 0 :repeat 3} 10)) [0 1 0 1 0 1])
    (t/eq "loop (:inf): for ever" (count (evs {:degree [0 1]} {:seed 0 :repeat :inf} 50)) 50)
    (t/eq "a constant stays in every event" (mapv :amp (evs {:degree [0 1] :amp 0.3} {:seed 0 :repeat 1} 5)) [0.3 0.3])
    (t/eq "only constants: one event" (evs {:degree 2} {:seed 0 :repeat 1} 5) [{:degree 2}])
    (t/eq "nested vectors are flattened" (mapv :d (evs {:d [[0 1] 2]} {:seed 0 :repeat 1} 5)) [0 1 2])
    (t/eq "an endless key makes it endless" (count (evs {:degree (pat/gen :white [0 7]) :dur [1 2]} {:seed 0 :repeat 1} 30)) 30)
    (let [m {:degree (pat/gen :choose [0 2 4 7]) :amp (pat/gen :white [0.1 0.9])}
          a (evs m {:seed 5 :repeat 1} 12)]
      (t/eq "the same seed, the same events" a (evs m {:seed 5 :repeat 1} 12))
      (t/is "another seed, other events" (not= a (evs m {:seed 6 :repeat 1} 12)))
      (t/eq "each key has its own seed: changing one key leaves the others as they were"
            (mapv :amp a) (mapv :amp (evs (assoc m :degree (pat/gen :choose [9 10])) {:seed 5 :repeat 1} 12))))
    (t/eq "a generator inside a vector gives a new value each time it comes round"
          (mapv :d (filter (fn [e] (not= 0 (:d e))) (evs {:d [0 (pat/gen :series [1 1])] :x (vec (range 8))} {:seed 0 :repeat 1} 8))) [1 2 3 4])
    (t/eq "#pat/shuffle: every pass has every element"
          (mapv sort (partition 4 (map :d (evs {:d (pat/gen :shuffle [1 2 3 4])} {:seed 3 :repeat 3} 12)))) [[1 2 3 4] [1 2 3 4] [1 2 3 4]])
    (t/eq "#pat/series with n: a pass of n" (mapv :d (evs {:d (pat/gen :series [0 2 4])} {:seed 0 :repeat 1} 9)) [0 2 4 6])
    (t/is "#pat/walk stays between its bounds"
          (every? (fn [e] (<= -2 (:d e) 2)) (evs {:d (pat/gen :walk [0 1 -2 2])} {:seed 1 :repeat 1} 200)))
    (t/eq "#pat/chord is one value" (mapv :d (evs {:d (pat/gen :chord [0 4 7]) :x [1 2]} {:seed 0 :repeat 1} 5)) [[0 4 7] [0 4 7]])
    (t/eq "#pat/hold follows the beats, not the events"
          (mapv :root (evs {:dur [1 1 2] :root (pat/gen :hold [2 [:c :g]])} {:seed 0 :repeat 2} 6)) [:c :c :g :c :c :g])
    (t/eq "a lazy seq (from code) cycles when it is finite" (mapv :d (evs {:d (map inc (range 3)) :x [0 0 0 0 0]} {:seed 0 :repeat 1} 9)) [1 2 3 1 2])
    (let [p (pat/pbind-pattern {:degree [0 1]} {:seed 2})]
      (t/is "a pattern value" (pat/pattern? p))
      (t/eq "each stream starts again" (vec (pat/events p)) (vec (pat/events p)))
      (t/eq "the same source and seed: the same key" (:key p) (:key (pat/pbind-pattern {:degree [0 1]} {:seed 2})))
      (t/is "another seed: another key" (not= (:key p) (:key (pat/pbind-pattern {:degree [0 1]} {:seed 3})))))
    (t/eq "a summary" (pat/summary {:degree [0 2 4] :dur 0.5}) "2 keys · 3 events a pass")))

(t/run! "patterns: code"
  (fn []
    (let [env (pat/code-env (pat/rng 1) 1 1)]
      (t/eq "pbind in code takes lazy sequences" (count (take 7 ((:pbind env) {:d ((:pwhite env) 0 9) :dur 0.25}))) 7)
      (t/eq "pseq with repeats" (vec ((:pseq env) [1 2] 2)) [1 2 1 2])
      (t/eq "pseries" (vec ((:pseries env) 0 3 4)) [0 3 6 9]))
    (t/eq "what code returns: phrases are flattened" (vec (pat/flat-events [[{:a 1} {:a 2}] {:a 3}] 0 1)) [{:a 1} {:a 2} {:a 3}])
    (t/eq "... and a map is a pbind" (mapv :a (pat/flat-events {:a [1 2]} 0 1)) [1 2])
    (let [f (fn [{:keys [rand-int]}] (repeatedly 6 (fn [] {:d (rand-int 100)})))
          p (pat/code-pattern f {:seed 4 :source "x"})]
      (t/eq "seeded: every stream of a code pattern is the same" (vec (pat/events p)) (vec (pat/events p)))
      (t/is "another seed, another stream" (not= (vec (pat/events p)) (vec (pat/events (pat/code-pattern f {:seed 5 :source "x"}))))))))

(t/run! "patterns: pitch"
  (fn []
    (t/eq "degree 0 at octave 5 is c4" (pat/midis {:degree 0}) [60])
    (t/eq "degrees of the major scale, and the next octave" (pat/midis {:degree [0 2 4 7]}) [60 64 67 72])
    (t/eq "negative degrees go down" (pat/midis {:degree -1}) [59])
    (t/eq "a scale by name, a root, an octave" (pat/midis {:degree 2 :scale :minor :root :d :octave 4}) [53])
    (t/eq "a scale as semitones" (pat/midis {:degree 1 :scale [0 3.5 7]}) [63.5])
    (t/eq "a fractional degree glides between steps" (pat/midis {:degree 0.5}) [61])
    (t/eq "notes as MIDI, names and keywords" (pat/midis {:note [69 "c4" :e4]}) [69 60 64])
    (t/eq "a name without octave takes :octave" (pat/midis {:note :g :octave 3}) [43])
    (t/eq ":transpose" (pat/midis {:note 60 :transpose 7}) [67])
    (t/eq "Hz" (pat/hz {:note 69}) [440])
    (t/eq ":freq is in Hz" (pat/hz {:freq [220 330]}) [220 330])
    (t/eq "a rest plays nothing" (pat/hz {:degree :rest}) [])
    (t/is "{:type :rest} is a rest" (pat/rest? {:type :rest :dur 1}))
    (t/eq "no pitch: nil" (pat/hz {:amp 0.2}) nil)
    (t/eq "sustain: dur × legato (0.8)" (pat/sustain {:dur 2}) 1.6)
    (t/eq "... or :sustain" (pat/sustain {:dur 2 :sustain 0.5}) 0.5)
    (t/eq "dur defaults to 1" (pat/dur-of {}) 1)))
