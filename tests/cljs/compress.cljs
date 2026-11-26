;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · the shortest description of a piece (kairotic.compress; Study 66's tests, in the core)
(ns kairotic.test.compress
  (:require [kairotic.compress :as cz]
            [kairotic.bits :as bits]
            [kairotic.motif :as m]
            [kairotic.mt :as mt]
            [kairotic.test :as t]))

(t/run! "the shortest description of a piece (kairotic.compress)"
  (fn []
    ;; four chords, each broken twice as C E G E: one figure over three notes
    (let [small (vec (for [[i ch] (map-indexed vector [[60 64 67] [60 65 69] [59 62 67] [60 64 67]]) k (range 2) [j p] (map-indexed vector [(ch 0) (ch 1) (ch 2) (ch 1)])]
                       [(+ (* i 8) (* k 4) j) 1 p]))
          s (cz/compress small {:max-l 8})]
      (t/eq "a stream and back: the same notes" (cz/notes-of-stream (cz/stream small)) small)
      (t/eq "a small piece: one figure over three notes (both halves of a chord in it), four uses"
            [(count (:rules s)) (:k (first (:rules s))) (apply str (:idx (first (:rules s)))) (count (:items s))] [1 3 "01210121" 4])
      (t/is "… written out again, the same notes (lossless)" (cz/lossless? s))
      (t/is (str "… and its description is shorter: " (:bits s) " < " (:raw s)) (< (:bits s) (:raw s)))
      (t/eq "a figure in words" (cz/describe-rule (first (:rules s))) "broken chord over 3 notes: 0 1 2 1 0 1 2 1")
      (t/eq "a motif in words" (cz/describe-rule {:kind :motif :steps [0 2 4 5 7]}) "motif of 5 notes (0 2 4 5 7), rising")
      (t/is "coded as heard (the uses' pitches as each voice's step), shorter still" (< (:bits (cz/code-length s)) (:bits s))))
    (t/eq "bits: a word heard before costs less, its inversion half as much as itself"
          (let [lx (bits/lexicon ["S:1,2" "S:1,2"])] [(< (bits/bits lx "S:1,2") (bits/bits lx "S:-1,-2") (bits/bits lx "S:3")) (bits/invert "S:1,-2|0")])
          [true "S:-1,2|0"])
    ;; described: the motives on the notes, and the description on the root
    (let [mel (m/notes-of "C5 D5 E5 C5 D5 E5 F5 D5 C5 B4 A4 C5 G4 G4")
          tree (into [:voice] (map (fn [n] [:note {:pitch (.toLowerCase (:name n)) :dur (:dur n)}]) mel))
          d (:compression (mt/attrs (m/annotate tree)))]
      (t/is (str "annotate writes on the root how much its formulas say: " d) (and (number? (:bits d)) (< (:ratio d) 1) (seq (:rules d))))
      (t/is "… in the analysis layer" (mt/analysis-keys :compression)))))
