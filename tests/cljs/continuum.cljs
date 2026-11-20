;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · a tree drawn as a continuum (kairotic.continuum, Study 52, discussion #217) and its takes
(ns kairotic.test.continuum
  (:require [clojure.string :as str]
            [kairotic.continuum :as ct]
            [kairotic.mei :as mei]
            [kairotic.mt :as mt]
            [kairotic.test :as t]))

(def tree
  [:voice {:key "d" :tempo 60}
   [:measure {:meter [4 4]}
    [:note {:pitch "d4" :dur 1 :id "n0" :tstamp.real 0.05 :dur.real 0.9}]
    [:note {:pitch "f#4" :dur 1 :id "n1" :tstamp.real 1.1 :dur.real 0.8}]
    [:note {:pitch "a4" :dur 2 :id "n2" :tie true :tstamp.real 2.0 :dur.real 3.2}]]
   [:measure {:meter [4 4]}
    [:note {:pitch "a4" :dur 1}]
    [:rest {:dur 1}]
    [:note {:pitch "c4" :dur 2 :id "n3"}]]])

(t/run! "continuum"
  (fn []
    (t/eq "a preset as samples over the piece" (mapv count (vals (ct/preset-res :dissolve))) [ct/N ct/N ct/N])
    (t/eq "… written is 1 throughout, graphic 0" [(set (:time (ct/preset-res :written))) (set (:pitch (ct/preset-res :graphic)))] [#{1} #{0}])
    (t/is "… an unknown one is nil" (nil? (ct/preset-res :nope)))
    (t/eq "a curve at u: interpolated, clamped, a number is itself" [(ct/at [0 1] 0.25) (ct/at [0 1] 2) (ct/at 0.3 0.9)] [0.25 1 0.3])
    (t/eq "note values: a dotted quarter, a half, a sixteenth, a length that is none"
          (mapv (juxt :base :dots :filled :flags :exact) (map ct/note-value [1.5 2 0.25 0.7]))
          [[1 1 true 0 true] [2 0 false 0 true] [0.25 0 true 2 true] [0.5 0 true 1 false]])
    (let [evs (ct/events tree)]
      (t/eq "events: a tied note is one sound, a rest none" (mapv (juxt :id :name :wbeats) evs) [["n0" "d4" 1] ["n1" "f#4" 1] ["n2" "a4" 3] ["n3" "c4" 2]])
      (t/eq "… where they really sounded, or as written" (mapv (juxt :t :ws) evs) [[0.05 0] [1.1 1] [2 2] [6 6]])
      (let [w (ct/project evs (ct/preset-res :written) {:key 2 :bars (ct/bar-starts tree)})
            g (ct/project evs (ct/preset-res :graphic) {:key 2 :bars (ct/bar-starts tree)})]
        (t/eq "written: each note at its beat, as heads with stems" (mapv (juxt :x :head :stem) (take 2 (:notes w))) [[0 1 1] [1 1 1]])
        (t/eq "graphic: at its real time, as a stroke" (mapv (juxt :x :stroke :head) (take 2 (:notes g))) [[0.05 1 0] [1.1 1 0]])
        (t/eq "F# in D major needs no accidental, C does (♮)" (mapv :acc (:notes w)) [nil nil nil "♮"])
        (t/eq "a bar line where the second measure starts" (mapv :x (:bars w)) [4]))
      (let [tk {:id "t1" :name "slow" :when {"n0" [0.2 1.2] "n2" [2.8 3]}}
            t2 (mei/add-take tree tk)]
        (t/eq "with a take: where it played each note, the notes it did not play left out" (mapv (juxt :id :t :dur) (ct/events t2 "t1"))
              [["n0" 0.2 1.2] ["n2" 2.8 3]])
        (t/eq "a take that kept how loud each note sounded (:profile, discussion #308) gives the strokes their weight"
              (mapv :amp (ct/events (mei/add-take tree (assoc tk :profile {"n0" {:rms 0.2} "n2" {:rms 0.4}})) "t1")) [0.5 1])
        (let [s (ct/svg (mt/update-attrs t2 assoc :continuum {:res (ct/preset-res :graphic) :take "t1"}) 600 200)]
          (t/is "the drawing shows the take the tree asks for" (= 2 (count (re-seq #"class=\"ct-stroke\"" s)))))))
    (let [s (ct/svg tree 600 200)]
      (t/is "drawn written: heads with their names, stems, the staff" (and (re-find #"class=\"ct-head\" data-id=\"n1\"" s) (re-find #"<title>f#4 · n1</title>" s)
                                                                       (re-find #"ct-stem" s) (re-find #"ct-staff" s)))
      (t/is "… no strokes" (not (re-find #"ct-stroke" s))))
    (let [s (ct/svg tree 600 200 {:res (ct/preset-res :dissolve)})]
      (t/is "dissolving: heads at the start, strokes at the end" (and (re-find #"ct-head" s) (re-find #"ct-stroke" s))))
    (let [c {:res (ct/preset-res :crystallize)}
          t3 (mt/update-attrs tree assoc :continuum c)]
      (t/is "the continuum is kept in the tree's MEI and read back" (= c (:continuum (mt/attrs (mei/<-mei (mei/->mei t3)))))))))
