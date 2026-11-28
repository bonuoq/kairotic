;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · optics and lenses (kairotic.optics, kairotic.lens; discussion #380): paths into a tree that read
;; and change a part of it, and the open and closed scores of one tree
(ns kairotic.test.lens
  (:require [kairotic.optics :as o]
            [kairotic.lens :as lens]
            [kairotic.mt :as mt]
            [kairotic.test :as t]))

(def chorale
  [:par {}
   [:voice {:name "bass"} [:measure {:meter [4 4]} [:note {:pitch "c3" :dur 2}] [:note {:pitch "g2" :dur 2}]]]
   [:voice {:name "soprano"} [:measure {:meter [4 4]} [:note {:pitch "e5" :dur 2 :id :s1}] [:note {:pitch "d5" :dur 2}]]]
   [:voice {:name "tenor"} [:measure {:meter [4 4]} [:note {:pitch "g3" :dur 2}] [:note {:pitch "b3" :dur 2}]]]
   [:voice {:name "alto"} [:measure {:meter [4 4]} [:note {:pitch "c5" :dur 2}] [:note {:pitch "b4" :dur 2}]]]])

(def two-bars
  [:voice {:name "v"}
   [:measure {:meter [2 4]} [:note {:pitch "c4"}] [:note {:pitch "d4"}]]
   [:measure {:meter [2 4]} [:note {:pitch "e4"}] [:note {:pitch "f4"}]]
   [:measure {:meter [2 4]} [:note {:pitch "g4"}] [:note {:pitch "a4"}]]])

(defn pitches [t path] (mapv (fn [n] (:pitch (mt/attrs n))) (o/view t path)))

(t/run! "optics: paths into a tree"
  (fn []
    (t/eq "the voices, by name and by index" [(mt/attrs (o/view1 chorale [[:voice "alto"]])) (mt/attrs (o/view1 chorale [[:voice 1]]))]
          [{:name "alto"} {:name "soprano"}])
    (t/eq "the notes of a voice" (pitches chorale [[:voice "tenor"] :notes]) ["g3" "b3"])
    (t/eq "measures 2 to 3, their notes" (pitches two-bars [[:measures 2 3] :notes]) ["e4" "f4" "g4" "a4"])
    (t/eq "a node by its :id" (pitches chorale [[:id :s1]]) ["e5"])
    (t/eq "a predicate as a step: the notes held two beats in the bass"
          (count (o/view chorale [[:voice "bass"] :notes (fn [n] (= 2 (:dur (mt/attrs n))))])) 2)
    (let [t2 (o/over two-bars [[:measures 2 2]] (fn [m] (mt/transpose 2 m)))]
      (t/eq "over: an operation of mt on measure 2 only" (pitches t2 [:notes]) ["c4" "d4" "f#4" "g4" "g4" "a4"]))
    (t/eq "over-attrs: an attribute on every voice"
          (mapv (comp :clef mt/attrs) (o/view (o/over-attrs chorale [:voices] assoc :clef "G") [:voices])) ["G" "G" "G" "G"])
    (let [x [:note {:pitch "f5" :dur 2}] p [[:voice "soprano"] [:measures 1] [:nth 1]]]
      (t/eq "the laws: what is put is what is read" (o/view (o/put chorale p x) p) [x])
      (t/eq "... and putting back what is read changes nothing" (o/put chorale p (o/view1 chorale p)) chorale))
    (t/eq "a tree without voices is one voice, itself" (o/paths [:seq [:note {:pitch "c4"}]] [:voices]) [[]])))

(t/run! "lenses: open and closed scores"
  (fn []
    (let [{:keys [voices staves]} (lens/layout chorale)]
      (t/eq "open score (the default): the voices from the highest to the lowest" (mapv :voice voices) ["soprano" "alto" "tenor" "bass"])
      (t/eq "... each on its staff, its clef by its range (the tenor in the treble clef an octave down)"
            (mapv (juxt :name :clef) staves) [["soprano" "G"] ["alto" "G"] ["tenor" "G8"] ["bass" "F"]]))
    (t/eq "{:order :tree} keeps the tree's order" (mapv :voice (:voices (lens/layout chorale [:open {:order :tree}]))) ["bass" "soprano" "tenor" "alto"])
    (t/eq "closed score: SA on a treble staff, TB on a bass staff"
          (mapv (juxt :name :clef :voices) (:staves (lens/layout chorale :closed))) [["S A" "G" ["soprano" "alto"]] ["T B" "F" ["tenor" "bass"]]])
    (t/eq "... {:upper 1}: only the soprano above" (mapv :voices (:staves (lens/layout chorale [:closed {:upper 1}]))) [["soprano"] ["alto" "tenor" "bass"]])
    (let [w (lens/through chorale :closed)]
      (t/eq "through: the tree as the lens writes it, voices in order with their staff and clef"
            (mapv (fn [v] (select-keys (mt/attrs v) [:name :staff :clef])) (o/view w [:voices]))
            [{:name "soprano" :staff "S A" :clef "G"} {:name "alto" :staff "S A" :clef "G"} {:name "tenor" :staff "T B" :clef "F"} {:name "bass" :staff "T B" :clef "F"}])
      (t/eq "... the music unchanged" (set (map (fn [v] (pitches v [:notes])) (o/view w [:voices]))) (set (map (fn [v] (pitches v [:notes])) (o/view chorale [:voices]))))
      (t/is "... and its MEI two staves" (= 2 (count (re-seq #"<staffDef " (:mei (mt/->mei w "l-")))))))
    (let [hinted (o/over-attrs chorale [[:voice "tenor"]] assoc :clef "F")]
      (t/eq "an older layout on a voice (cac partimento's :clef) is a hint the open lens keeps"
            (:clef (first (filter #(= "tenor" (:voice %)) (:voices (lens/layout hinted))))) "F"))
    (t/eq "a melody without voices is left as it is" (lens/through "c4 e4 g4" :closed) "c4 e4 g4")
    (t/eq "clefs by range: a soprano, a tenor, a bass" (mapv lens/clef-by-range [[72 74 76] [55 57 59 62] [40 43 48]]) ["G" "G8" "F"])
    (t/is "an unknown lens says which there are" (try (lens/spec :grand) false (catch :default e (boolean (re-find #":closed" (.-message e))))))))
