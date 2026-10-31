;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · played time as beats (kairotic.tempo, issue #106), and grace notes as they are played
(ns kairotic.test.tempo
  (:require [kairotic.mt :as mt]
            [kairotic.tempo :as tm]
            [kairotic.quantize :as qz]
            [kairotic.test :as t]))

(defn- played
  "Notes written as [beat duration] played at bpm (seconds), from 0.4 s, each held 90 % of its length; bend
   speeds and slows the beat a little (a sine, that share of a beat)."
  [bpm bend ns]
  (let [sec (fn [b] (+ 0.4 (* (/ 60 bpm) b) (* bend (/ 60 bpm) (js/Math.sin (* 0.5 b)))))]
    (mapv (fn [[b d]] {:on (sec b) :off (sec (+ b (* 0.9 d)))}) ns)))

(def ^:private tune
  ;; a pickup, then three bars of 3/4
  [[2 1] [3 1] [4 0.5] [4.5 0.5] [5 1] [6 1.5] [7.5 0.5] [8 1] [9 2] [11 1] [12 1] [13 0.5] [13.5 0.5] [14 1] [15 3]])

(t/run! "played time (kairotic.tempo)"
  (fn []
    (t/eq "onsets closer than a chord are one, weighing more" (count (tm/onsets [{:on 0 :off 1} {:on 0.02 :off 1} {:on 1 :off 2}] tm/defaults)) 2)
    (let [os (tm/onsets (played 96 0 tune) tm/defaults) P (tm/period os tm/defaults)]
      (t/is (str "the period of a melody played at 96 bpm: " P) (< (js/Math.abs (- P (/ 60 96))) 0.02))
      (t/is "the beats found are about a period apart"
            (every? (fn [[a b]] (< (js/Math.abs (- (- b a) (/ 60 96))) 0.05)) (partition 2 1 (tm/track os P tm/defaults)))))
    (t/eq "too few onsets: no period" (tm/period (tm/onsets [{:on 0 :off 1} {:on 1 :off 2}] tm/defaults) tm/defaults) nil)
    (let [m [[1 0] [2 1] [3 3]]]
      (t/eq "a time map is linear between its points" (mapv (fn [t] (tm/->beat m t)) [1 1.5 2 2.5]) [0 0.5 1 2])
      (t/eq "... and beyond them, at the period of the nearest two" (mapv (fn [t] (tm/->beat m t)) [0 4]) [-1 5]))
    (t/eq "the tempo of a map, the median of its stretches" (tm/tempo-of-map [[0 0] [1 1] [2 2] [3 4]]) 60)
    (t/eq "a kept map is two points at least, both increasing" [(tm/sane-map [[0 0] [1 1]]) (tm/sane-map [[0 0]]) (tm/sane-map [[0 0] [1 0]])]
          [[[0 0] [1 1]] nil nil])
    (t/eq "the beat a meter is felt in" (mapv tm/tactus [[4 4] [3 4] [6 8] [2 2] [5 8]]) [[1 4] [1 3] [1.5 2] [2 2] [0.5 5]])
    ;; the whole way: played → beats → measures
    (let [perf (into [:par] (map (fn [n] [:note {:at (:on n) :dur (- (:off n) (:on n)) :pitch 60}]) (played 96 0.04 tune)))
          q (qz/quantize-tree perf {:meter [3 4] :time :track})]
      ;; (the last note, played shorter than written with nothing after it, comes back a little short)
      (t/eq "a melody played at 96 bpm with a little rubato, written in its rhythm (the bar may start elsewhere)"
            (let [ts (mapv :t (mt/notes q))] (mapv (fn [x] (- x (first ts))) ts)) (mapv (fn [[b]] (- b 2)) tune))
      (t/eq "... with its durations" (butlast (mapv :dur (mt/notes q))) (butlast (mapv second tune)))
      (t/is (str "... at its tempo: " (:tempo (mt/attrs q))) (<= 92 (:tempo (mt/attrs q)) 100))
      (t/eq "with the time of a downbeat (its second note), the pickup is where it was"
            (mapv :t (mt/notes (qz/quantize-tree perf {:meter [3 4] :time :track :downbeat (:on (nth (played 96 0.04 tune) 1))})))
            (mapv first tune)))
    (let [perf (into [:par] (map (fn [n] [:note {:at (:on n) :dur (- (:off n) (:on n)) :pitch 60}]) (played 96 0 tune)))
          m (qz/time-map-of (qz/tree-notes perf) (qz/options {:meter [3 4] :time :track} nil))]
      (t/eq "a map kept gives the same score as the one found"
            (mapv :t (mt/notes (qz/quantize-tree perf {:meter [3 4] :time m})))
            (mapv :t (mt/notes (qz/quantize-tree perf {:meter [3 4] :time :track})))))))

(t/run! "grace notes as they are played"
  (fn []
    (let [free (fn [ns] (into [:par] (map (fn [[o d p]] [:note {:at o :dur d :pitch p}]) ns)))
          q (qz/quantize-tree (free [[0 1 60] [0.94 0.05 64] [1 1 62] [2 2 60]]) {:meter [4 4]})
          ns (mt/notes q)]
      (t/eq "a very short note just before a long one is its grace note" (mapv (juxt :t :grace) (filter :grace ns)) [[1 true]])
      (t/eq "... and the beat is not divided for it" (mapv (juxt :t :dur) (remove :grace ns)) [[0 1] [1 1] [2 2]])
      (t/eq "a run of short notes is not grace notes"
            (count (filter :grace (mt/notes (qz/quantize-tree (free [[0 0.12 60] [0.125 0.12 62] [0.25 0.12 64] [0.375 0.12 65] [0.5 1 67]]) {:meter [4 4]}))))
            0)
      (t/eq "with :grace false it is a note" (count (filter :grace (mt/notes (qz/quantize-tree (free [[0 1 60] [0.94 0.05 64] [1 1 62] [2 2 60]]) {:meter [4 4] :grace false}))))
            0))))

(t/run! "the strength of a note, from the weight of its stroke"
  (fn []
    (let [d {:strokes {:t1 {:pts [[0 220] [1 220]] :look {:w 2.8}} :t2 {:pts [[1 220] [2 220]]} :t3 {:pts [[2 220] [3 220]] :look {:w 1}}}}
          ns (sort-by :on (qz/strokes->notes d))]
      (t/eq "a stroke's weight is its note's :vel (as an event's :amp: 0.4 … 2.8 → 0 … 1); without one, none"
            (mapv (comp :vel :attrs) ns) [1 nil 0.25]))
    (t/is "an onset played louder weighs more"
          (let [[a b] (tm/onsets [{:on 0 :off 1 :attrs {:vel 1}} {:on 1 :off 2 :attrs {:vel 0.1}}] tm/defaults)] (> (:w a) (:w b))))
    (t/eq "... unless :accent is off" (let [[a b] (tm/onsets [{:on 0 :off 1 :attrs {:vel 127}} {:on 1 :off 2 :attrs {:vel 10}}] (assoc tm/defaults :accent false))] (= (:w a) (:w b))) true)))
