;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · open form (kairotic.paths, discussion #212): the work from its tree, its choices, a path played,
;; a performance followed and read again
(ns kairotic.test.paths
  (:require [kairotic.paths :as paths]
            [kairotic.mt :as mt]
            [kairotic.test :as t]))

(def tree
  [:open {:name "four cells" :start :any :end {:repeat 2} :tempo 60}
   [:frag {:id :A :then {:tempo 1.5 :dyn "pp"}} "c4/0.5 e4 g4 c5"]
   [:frag {:id :B :not #{:B} :then {:dyn "f"}} "b3/0.75 d4/0.25 f4/0.5 g4"]
   [:frag {:id :C :next #{:A :D} :then {:tempo 0.75 :dyn "p"}} "a4/1 e4"]
   [:frag {:id :D :then {:tempo 1.25}} "f4/0.25 a4 c5 a4 f4/1"]])

(def w (paths/work tree))
(defn midis [id] (:midi (paths/frag w id)))

(t/run! "open form"
  (fn []
    (t/eq "the work from its tree: four fragments, their pitches" [(paths/ids w) (midis :A)] [[:A :B :C :D] [60 64 67 72]])
    (t/eq "any first" (paths/choices w []) [:A :B :C :D])
    (t/eq "after C only A or D; after B anything but B" [(paths/choices w [:C]) (paths/choices w [:B])] [[:A :D] [:A :C :D]])
    (t/is "it ends when a fragment comes a second time" (and (paths/done? w [:A :B :A]) (empty? (paths/choices w [:A :B :A])) (not (paths/done? w [:A :B]))))
    (t/is "legal and not" (and (paths/legal? w [:C :D :A]) (not (paths/legal? w [:C :B])) (not (paths/legal? w [:B :B]))))
    (t/is "a performance drawn is legal and has ended" (every? (fn [_] (let [p (paths/draw w)] (and (paths/legal? w p) (paths/done? w p)))) (range 20)))
    (t/eq "the rhythms as necklaces: D's onsets on 16 pulses" (:pulses (paths/frag w :D)) [0 1 2 3 4])
    (t/eq "the indications after A: faster, pp" (select-keys (paths/indications w [:A]) [:tempo :dyn]) {:tempo 1.5 :dyn "pp"})
    (let [f (paths/fragment-tree w [:A] :B)]
      (t/is "a fragment to play: a voice at the tempo A left, its dynamic first, its notes"
            (and (= :voice (first f)) (= 90 (:tempo (second f))) (= [:dyn {:mark "pp"}] (nth f 2)) (= ["b3" "d4" "f4" "g4"] (mt/pitches f)))))
    (t/eq "how long: B after A, 2 beats at 90" (paths/fragment-seconds w [:A] :B) (/ 4 3))
    (t/eq "a path as one tree: its notes one fragment after the other" (count (mt/notes (paths/realize w [:C :D :A]))) 11)
    ;; following
    (t/eq "recognised among the candidates from its opening" (:id (first (paths/recognize w [] [69 64]))) :C)
    (let [heard (concat (midis :C) (midis :D) [60 63 67 72]) ; A with a wrong note
          [st found] (reduce (fn [[st fs] m] (let [[st f] (paths/hear w st m 0.9)] [st (into fs f)])) [(paths/follow-start) []] heard)]
      (t/eq "followed note by note: C, D, A (one wrong note), each found from its first notes" (mapv second found) [:C :D :A])
      (t/is "… decided before each fragment ended" (every? (fn [[_ _ {:keys [after]}]] (<= after 3)) found))
      (t/eq "read again whole: the same" (:path (paths/decode w (:all st))) [:C :D :A]))
    (t/eq "the distance between two performances" (paths/path-distance [:A :B :C] [:A :C]) 1)
    (t/eq "performances as branches: a common beginning one branch" (mapv :n (:children (paths/branches [[:A :B] [:A :C] [:D]]))) [2 1])))
