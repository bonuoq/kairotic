;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · what comes back, and how it is related (kairotic.motif; Study 60's motif tests, in the core)
(ns kairotic.test.motif
  (:require [kairotic.motif :as m]
            [kairotic.test :as t]))

(t/run! "motives (kairotic.motif)"
  (fn []
    (let [N m/notes-of mo (N "C5 D5 E5 C5")]
      (t/eq "a melody read as notes: a note held is one note, longer" [(mapv :dur (N "G4 C5 C5 B4")) (:on (nth (N "G4 C5 C5 B4") 2))] [[1 2 1] 3])
      (t/eq "its viewpoints: steps, semitones, contour, rhythm" (select-keys (m/views (N "C5 E5 E5 D5")) [:dia :chro :contour :rhythm])
            {:dia [2 -1] :chro [4 -2] :contour [1 -1] :rhythm [1 2 1]})
      (t/eq "a sequence (diatonic): the steps kept, not the semitones" (:name (m/relate mo (N "D5 E5 F5 D5"))) "in sequence, a step higher")
      (t/eq "a transposition (real): the semitones kept too" (:name (m/relate mo (N "G4 A4 B4 G4"))) "transposed, a 4th lower")
      (t/eq "an inversion, a retrograde, a retrograde inversion" (mapv (comp :kind (partial m/relate mo) N) ["C5 B4 A4 C5" "C5 E5 D5 C5" "C5 A4 B4 C5"])
            [:inversion :retrograde :retrograde-inversion])
      (t/eq "an augmentation: the rhythm doubled" (:name (m/relate mo (N "D5 D5 E5 E5 F5 F5 D5 D5"))) "in sequence, a step higher, augmented")
      (let [r (m/relate mo (N "C5 E5 G5 C5"))]
        (t/is (str "no exact transformation: a kinship by edit distance, and what is kept: " r)
              (and (not (:exact r)) (< 0.6 (:kinship r) 0.9) (some #{:contour} (:kept r)))))
      (t/eq "kinship: the motive itself 1, a sequence 0.85, an inversion 0.75"
            (mapv (comp :kinship (partial m/relate mo)) [mo (N "D5 E5 F5 D5") (N "C5 B4 A4 C5")]) [1 0.85 0.75])
      (t/is "… far apart, low" (< (:kinship (m/relate mo (N "C5 G4 G5 F4"))) 0.5))
      (let [r (m/find-in mo (N "G4 G4 F4 G4 A4 F4 E4"))]
        (t/eq "found in a melody: where and how" [(:from r) (:to r) (:kind r)] [2 6 :transposition]))
      (let [r (m/find-in mo (N "A4 A4 E5 F5 G5 G5"))]
        (t/is (str "… a fragment found: its head, in sequence: " (:name r)) (and (= :head (:part r)) (re-find #"its head, in sequence" (:name r)))))
      (let [x (m/discover "C5 D5 E5 C5 D5 E5 F5 D5 E5 F5 G5 E5 C5")]
        (t/is (str "the motive discovered: the span that recurs most: " x) (and (= (:notes x) ["C5" "D5" "E5" "C5"]) (re-find #"2 more times" (:why x)))))
      (let [x (m/discover "G4 C5 C5 B4 A4 A4 B4 D5 C5")]
        (t/is "… none recurring: the head of the phrase" (and (= (:notes x) ["G4" "C5" "B4" "A4"]) (re-find #"head" (:why x)))))
      (t/eq "the memory of the work: the share of figures heard before" [(m/memory ["C5 D5 E5 C5"] "G4 A4 B4 G4 E4") (m/memory [] "C5 D5 E5")] [0.67 0])
      (t/eq "the sweet spot: a literal repetition half as welcome, far apart little" [(m/sweet 1) (m/sweet 0.8) (< (m/sweet 0.3) 0.5)] [0.5 1 true]))
    ;; in played time
    (let [played [[0 0.48 60] [0.5 0.26 62] [0.77 0.22 64] [1.0 0.5 60]]
          again [[2 0.5 67] [2.52 0.2 69] [2.78 0.24 71] [3.03 0.4 67]]]
      (t/eq "notes as played (seconds, MIDI), spelled" (mapv :name (m/notes-of played)) ["C4" "D4" "E4" "C4"])
      (t/eq "played, the rhythm differs a little: in another rhythm" (:rhythm (m/exact (m/notes-of played) (m/notes-of again))) :another)
      (t/eq "… within a tolerance, by its onsets, a transposition a 5th higher" (:name (m/exact (m/notes-of played) (m/notes-of again) 0.15)) "transposed, a 5th higher"))
    (let [g (m/returns [{:L 1 :rel [0 0.55]} {:L 1 :rel [0 0.62]} {:L 1 :rel [0 0.25 0.5]} {:L 1 :rel [0 0.64]} {:L 1 :rel [0 0.5]}] 0.08)]
      (t/eq "returns: a rhythm played several times is one, each compared with the mean so far" (mapv count g) [3 1 1])
      (t/is "… and its mean" (< (js/Math.abs (- (second (m/mean-rel (first g))) 0.6033)) 0.001)))))
