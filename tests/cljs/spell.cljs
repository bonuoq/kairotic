;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · how pitches are written (kairotic.spell, issue #88)
(ns kairotic.test.spell
  (:require [clojure.string :as str]
            [kairotic.spell :as sp]
            [kairotic.mt :as mt]
            [kairotic.score :as sc]
            [kairotic.test :as t]))

(defn- names [m] (into {} (map (fn [[k v]] [k (sp/->name v)]) m)))

(t/run! "spelling"
  (fn []
    (t/eq "names with one or two alterations" (mapv (comp sp/->name sp/parse) ["bb4" "f#3" "fs3" "f##3" "fx3" "ebb2" "cn4" "C4"])
          ["bb4" "f#3" "f#3" "f##3" "f##3" "ebb2" "c4" "c4"])
    (t/eq "... and what they sound" (mapv (comp sp/->midi sp/parse) ["bb4" "b#3" "cb4" "fx4" "ebb4"]) [70 60 59 67 62])
    (t/eq "sc/pitch reads them too" (mapv sc/pitch ["f##3" "fx3" "ebb2" "cn4"]) [55 55 38 60])
    (t/eq "the line of fifths: C 0, G 1, F -1, F# 6, Bb -2" (mapv (comp sp/fifths sp/parse) ["c4" "g4" "f4" "f#4" "bb4"]) [0 1 -1 6 -2])
    (t/eq "a sound's spellings, fewest alterations first" (mapv sp/->name (take 2 (sp/spellings 61))) ["c#4" "db4"])
    (t/eq "back from the line of fifths" (sp/->name (sp/from-fifths -2 70)) "bb4")
    (t/eq "intervals" (mapv sp/interval ["M3" "-P5" "A4" "d5" "m9" "P8" "x"]) [[2 4] [-4 -7] [3 6] [4 6] [8 13] [7 12] nil])
    (t/eq "transposing a spelling by an interval" (mapv (fn [[a i]] (sp/->name (sp/transpose-spelling (sp/parse a) (sp/interval i))))
                                                        [["c4" "M3"] ["c4" "A4"] ["c4" "d5"] ["c4" "-m2"] ["f#4" "m3"] ["eb4" "M7"]])
          ["e4" "f#4" "gb4" "b3" "a4" "d5"])
    (t/eq "inverting around a pivot, on the line of fifths" (sp/->name (sp/invert-spelling (sp/parse "c4") (sp/parse "e4"))) "g#4")
    (t/eq "keys and their signatures" (mapv (comp :sig sp/parse-key) ["c" "g" "eb" "c#m" "d dorian" "f lydian" "bbm" 3])
          [0 1 -3 4 0 0 -5 3])
    (t/is ":none is no key" (:none (sp/parse-key :none)))
    (t/eq "a signature in MEI" (mapv sp/mei-key-sig [3 -2 0]) ["3s" "2f" "0"])
    (t/eq "what a signature does to each step (D major: F and C sharp)" (mapv (fn [s] (sp/key-alter 2 s)) (range 7)) [1 0 0 1 0 0 0])
    (t/eq "... and B flat in F" (sp/key-alter -1 6) -1)
    (t/eq "a tonic with the fewest alterations: Db major, C# minor" [(sp/tonic-fifths 1 :major) (sp/tonic-fifths 1 :minor)] [-5 7])
    (let [w (fn [pcs] (reduce (fn [v p] (update v p inc)) (vec (repeat 12 0)) pcs))]
      (t/eq "the key of a C major scale" (select-keys (sp/estimate-key (w [0 2 4 5 7 9 11 0 7 4 0])) [:sig :mode]) {:sig 0 :mode :major})
      (t/eq "... of Eb major notes" (:sig (sp/estimate-key (w [3 5 7 8 10 0 2 3 10 7 3]))) -3)
      (t/eq "... and of A B C G# with E G# B: A minor, not E major" (select-keys (sp/estimate-key (w [9 11 0 8 4 8 11 9])) [:sig :mode]) {:sig 0 :mode :minor}))
    ;; choosing names
    (let [line (fn [sig ms] (mapv (fn [i m] {:sig sig :notes [{:id i :midi m :voice 1}]}) (range) ms))
          spell (fn [sig ms] (mapv (names (sp/spell-steps (line sig ms))) (range (count ms))))]
      (t/eq "in C, a chromatic line rises in sharps" (spell 0 [60 61 62 63 64]) ["c4" "c#4" "d4" "d#4" "e4"])
      (t/eq "... and falls in flats" (spell 0 [64 63 62 61 60]) ["e4" "eb4" "d4" "db4" "c4"])
      (t/eq "in Eb, Bb and Ab" (spell -3 [63 65 67 68 70]) ["eb4" "f4" "g4" "ab4" "bb4"])
      (t/eq "in A minor, the leading tone is G#" (spell 0 [69 71 72 71 68 69]) ["a4" "b4" "c5" "b4" "g#4" "a4"])
      (t/eq "a written name stays as it is" ((names (sp/spell-steps [{:sig 0 :notes [{:id 0 :midi 61 :fixed (sp/parse "db4")}]}])) 0) "db4"))
    (let [chord (fn [sig ms] (set (vals (names (sp/spell-steps [{:sig sig :notes (mapv (fn [i m] {:id i :midi m :voice i}) (range) ms)}])))))]
      (t/eq "a chord is stacked in thirds: Ab C Eb in Eb, not G# C D#" (chord -3 [68 72 75]) #{"ab4" "c5" "eb5"})
      (t/eq "... and E G# B in A minor" (chord 0 [64 68 71]) #{"e4" "g#4" "b4"}))

    ;; in trees (kairotic.mt)
    (t/eq ":cents is a deviation in cents" (mt/midi-of {:pitch "c4" :cents 50}) 60.5)
    (t/eq "pitches as they are written" (mt/pitches "bb4 c#5 ebb4 fx4") ["bb4" "c#5" "ebb4" "f##4"])
    (t/eq "transpose by an interval keeps the spelling" (mt/pitches (mt/transpose "m3" "c4 e4 g4")) ["eb4" "g4" "bb4"])
    (t/eq "... by semitones too (1 is a minor second)" (mt/pitches (mt/transpose 1 "c4 e4 g4")) ["db4" "f4" "ab4"])
    (t/eq "... and down" (mt/pitches (mt/transpose "-M2" "eb4 g4 bb4")) ["db4" "f4" "ab4"])
    (t/eq "invert around a written pivot, on the line of fifths" (mt/pitches (mt/invert "e4" "c4 e4 g4")) ["g#4" "e4" "c#4"])
    (t/eq "a name moved by a semitone stays flat or sharp" (mapv (fn [[p m]] (:pitch (mt/set-midi {:pitch p} m))) [["bb4" 71] ["eb4" 62] ["eb4" 66] ["c#4" 63]])
          ["b4" "d4" "gb4" "d#4"])
    (t/eq "numbers spelled by the key they suggest (Eb)" (mt/pitches (mt/spell [:seq [:note {:pitch 63}] [:note {:pitch 65}] [:note {:pitch 67}] [:note {:pitch 68}] [:note {:pitch 70}] [:note {:pitch 63}]]))
          ["eb4" "f4" "g4" "ab4" "bb4" "eb4"])
    (t/eq "... and a chromatic line, which suggests none, up in sharps and down in flats (not B# in C# minor)"
          (mt/pitches (mt/spell (into [:seq] (map (fn [m] [:note {:pitch m :dur 0.5}]) [60 61 62 63 64 65 64 63 62 61 60]))))
          ["c4" "c#4" "d4" "d#4" "e4" "f4" "e4" "eb4" "d4" "db4" "c4"])
    (t/eq "keys as text" (mapv sp/key-name [{:tonic -3 :mode :major} {:tonic 7 :mode :minor} {:tonic 2 :mode :dorian} {:tonic 0}]) ["eb" "c#m" "d dorian" "c"])
    (t/eq "keys transposed: Eb + M3, C#m - m2, D dorian + P5, 3 sharps + M2, E major + A1 (not E# but F), :none"
          [(sp/transpose-key "eb" (sp/interval "M3")) (sp/transpose-key "c#m" (sp/interval "-m2")) (sp/transpose-key "d dorian" (sp/interval "P5"))
           (sp/transpose-key 3 (sp/interval "M2")) (sp/transpose-key "c#" (sp/interval "M3")) (sp/transpose-key :none (sp/interval "M3"))]
          ["g" "cm" "a dorian" "b" "f" :none])
    (t/eq "transposing a tree moves its keys with its notes"
          (let [t (mt/transpose "M3" [:voice {:key "eb"} [:measure {:meter [4 4] :key "cm"} "eb4/4"]])]
            [(:key (mt/attrs t)) (:key (mt/attrs (nth t 2))) (mt/pitches t)])
          ["g" "em" ["g4"]])
    (t/eq "a key only when the notes fit one clearly" [(sp/estimate-sig [1 0 1 0 1 1 0 1 0 1 0 1]) (sp/estimate-sig [1 0 1 0 1 0 1 0 1 0 1 0])] [0 nil])
    (t/eq "... a quarter tone keeps its cents" (select-keys (mt/attrs (nth (mt/spell [:seq [:note {:pitch 60}] [:note {:pitch 60.5}]]) 2)) [:pitch :cents]) {:pitch "c4" :cents 50})
    (let [mei (:mei (mt/->mei [:voice {:key "eb"} [:measure {:meter [4 4]} "eb4/1 a4 a4 bb4"] [:measure "a4/1 ab4 g4/2"]] "k-"))
          accs (re-seq #"accid=\"(\w+)\"" mei)]
      (t/is "a key writes its signature" (str/includes? mei "key.sig=\"3f\""))
      (t/eq "an accidental lasts its bar; the next bar needs it again, and the key's flat comes back"
            (mapv second accs) ["n" "n" "f"])
      (t/is "... the key's notes carry their sounding accidental" (str/includes? mei "accid.ges=\"f\"")))
    (let [mei (:mei (mt/->mei [:voice [:measure {:meter [4 4] :key "d"} "d4/2 f#4"] [:measure {:key "bb"} "bb4/4"]] "c-"))]
      (t/is "a change of key is written before its bar" (str/includes? mei "<scoreDef key.sig=\"2f\"")))
    (t/eq ":key :none writes every accidental" (count (re-seq #"accid=\"s\"" (:mei (mt/->mei [:voice {:key :none} [:measure {:meter [4 4]} "c#4/1 c#4 c#4 c#4"]] "n-")))) 4)))
