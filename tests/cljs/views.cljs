;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · one box, several views of the same data, and any buffer as text (discussion #30)
(ns kairotic.test.views
  (:require [kairotic.components :as comp]
            [kairotic.canvas :as cv]
            [kairotic.test :as t]))

(def fq (-> cv/empty
            (cv/step [:stroke :t1 [[0 440] [1 440]]])
            (cv/step [:stroke :t2 [[1 330] [2.5 293.66]]])
            (cv/step [:tuning (assoc (get cv/tunings "19-tet") :ref 261.63)])
            (cv/step [:grid-x {:step 0.25 :cycles [4]}])))

(def gen (-> cv/generic-empty
             (cv/step [:axis {:x {:lo 0 :hi 4 :log false} :y {:lo -1 :hi 1 :log false}}])
             (cv/step [:stroke :t1 [[0 -1] [2 1] [1 0.5]]])))

(defn round-trip [d] (cv/read-source d (cv/->source d)))

(t/run! "views and sources"
  (fn []
    ;; the views of a class, and the one a box shows
    (t/eq "a tree can be code or score" (comp/views-of {:text "tree"}) [:code :score])
    (t/eq "a freqt can be canvas or score" (comp/views-of {:text "freqt"}) [:canvas :score])
    (t/eq "a tree is code by default" (comp/shown-as {:text "tree"}) :code)
    (t/eq "a tree shown as a score" (comp/shown-as {:text "tree" :view :score}) :score)
    (t/eq "a view its class does not offer is ignored" (comp/shown-as {:text "tree" :view :canvas}) :code)
    (t/eq "a score box can be drawn as a canvas" (comp/shown-as {:text "score" :view :canvas}) :canvas)
    (t/eq "a class without views keeps its display" (comp/shown-as {:text "bang" :view :score}) :bang)

    ;; any buffer as text, and back
    (t/eq "a freqt as text, and back" (round-trip fq) fq)
    (t/eq "a generic canvas as text, and back (strokes in any direction)" (round-trip gen) gen)
    (t/eq "the empty freqt" (round-trip cv/empty) (assoc cv/empty :strokes {}))
    (t/is "a tuning is written by its name" (re-find #":name \"19-tet\" :ref 261.63\}" (cv/->source fq)))
    (t/eq "a tuning by name is read with its cents" (:gy (cv/read-source cv/empty "{:gy {:name \"19-tet\" :ref 261.63}}"))
          (:gy fq))
    (t/eq "a stroke as a map with :pts is read too" (get-in (cv/read-source cv/empty "{:strokes {:t5 {:pts [[0 220] [1 220]]}}}") [:strokes :t5 :pts])
          [[0 220] [1 220]])

    ;; what cannot be read is said, not dropped
    (t/throws "not EDN" (fn [] (cv/read-source cv/empty "{:strokes")))
    (t/throws "not a map" (fn [] (cv/read-source cv/empty "[1 2]")))
    (t/throws "an unknown key" (fn [] (cv/read-source cv/empty "{:strokez {}}")))
    (t/throws "a freqt has no axes" (fn [] (cv/read-source cv/empty "{:ax {:x {:lo 0 :hi 1}}}")))
    (t/throws "a frequency out of range" (fn [] (cv/read-source cv/empty "{:strokes {:t1 [[0 440] [1 90000]]}}")))
    (t/throws "a stroke of one point" (fn [] (cv/read-source cv/empty "{:strokes {:t1 [[0 440]]}}")))
    (t/throws "a bad tuning" (fn [] (cv/read-source cv/empty "{:gy {:name \"no-such-tuning\"}}")))
    (t/throws "a stroke id that is not a keyword" (fn [] (cv/read-source cv/empty "{:strokes {\"t1\" [[0 440] [1 440]]}}")))

    ;; only what changed becomes events
    (t/eq "nothing changed, no events" (cv/diff fq (round-trip fq)) [])
    (let [d2 (cv/read-source fq (-> (cv/->source fq) (.replace "[[0 440] [1 440]]" "[[0 440] [2 440]]")))]
      (t/eq "one stroke changed, one event" (cv/diff fq d2) [[:stroke :t1 [[0 440] [2 440]]]]))
    (let [d2 (update fq :strokes dissoc :t2)]
      (t/eq "a stroke removed is an erase" (cv/diff fq d2) [[:erase :t2]]))
    (let [d2 (assoc fq :gx nil)]
      (t/eq "the grid removed" (cv/diff fq d2) [[:grid-x nil]]))
    (let [src "{:ax {:x {:lo 0 :hi 4 :log false} :y {:lo 0 :hi 10 :log false}} :gx nil :gy nil :strokes {:t1 [[0 -1] [2 1] [1 0.5]]}}"
          d2 (cv/read-source gen src)]
      (t/eq "a new axis on a canvas" (first (cv/diff gen d2)) [:axis {:x {:lo 0 :hi 4 :log false} :y {:lo 0 :hi 10 :log false}}]))
    (let [d2 (cv/read-source fq "{:strokes {:t1 [[0 440] [1 440]] :t9 [[3 220] [4 220]]}}")]
      (t/eq "applying the events gives what was written" (reduce cv/step fq (cv/diff fq d2)) d2)
      (t/eq "... as one batch, one event of the history" (cv/step fq [:batch (cv/diff fq d2)]) d2))

    ;; the models say how their data is written
    (t/is "a freqt's data can be read as text" (string? (comp/source-of {:text "freqt" :data fq})))
    (t/is "an empty canvas too" (string? (comp/source-of {:text "canvas"})))
    (t/eq "a code box gives its source" (comp/source-of {:text "tree" :data {:source "[:voice \"c4\"]"}}) "[:voice \"c4\"]")
    (t/is "a bang has no source" (nil? (comp/source-of {:text "bang"})))))
