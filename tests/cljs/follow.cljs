;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · following a performer through a tree (kairotic.follow, discussion #204) and the take it keeps
(ns kairotic.test.follow
  (:require [kairotic.follow :as fl]
            [kairotic.continuum :as ct]
            [kairotic.mei :as mei]
            [kairotic.test :as t]))

(def tree
  [:voice {:tempo 60}
   [:measure {:meter [4 4]} "c4/1" [:note {:pitch "d4" :dur 1 :wire {:send :swell}}] "e4/1 f4"]
   [:measure "g4/1 a4 b4 c5"]])

(def midis [60 62 64 65 67 69 71 72])

(defn- played [rate t0 xs] (mapv (fn [[i m]] [(+ t0 (* rate i)) m (* 0.8 rate)]) xs))

(t/run! "follow"
  (fn []
    (let [sc (fl/score tree)]
      (t/eq "the score: the notes of the tree, named as takes name them, the wire kept"
            (mapv (juxt :id :midi :beat :wire) sc)
            [["n0" 60 0 nil] ["n1" 62 1 {:send :swell}] ["n2" 64 2 nil] ["n3" 65 3 nil] ["n4" 67 4 nil] ["n5" 69 5 nil] ["n6" 71 6 nil] ["n7" 72 7 nil]])
      (let [{:keys [found take state]} (fl/follow sc (played 1.25 0.3 (map-indexed vector midis)))]
        (t/eq "played slower than written, every note found, at its beat" (mapv :beat (keep (fn [[k x]] (when (= k :at) x)) found)) [0 1 2 3 4 5 6 7])
        (t/eq "… the wire on its note" (keep (fn [[k x]] (when (= k :wire) [(:send x) (:status x)])) found) [[:swell "on the note"]])
        (t/is "… at the performer's tempo" (< (js/Math.abs (- (:rate state) 1.25)) 0.01))
        (t/eq "… the take: each note where it was played, from the start of the piece, and how long"
              (mapv #(get-in take [:when %]) ["n0" "n1" "n7"]) [[0 1] [1.25 1] [8.75 1]]))
      (let [{:keys [found state]} (fl/follow sc (played 1 0 [[0 60] [1 62] [1.5 66] [2 64] [3 65]]))]
        (t/eq "a wrong note between two is let pass" (mapv :id (keep (fn [[k x]] (when (= k :at) x)) found)) ["n0" "n1" "n2" "n3"])
        (t/is "… and counted" (= 1 (:extra state))))
      (let [{:keys [found take]} (fl/follow sc (played 1 0 [[0 60] [2 64] [3 65]]))]
        (t/eq "a note left out is skipped" (mapv (juxt :id :skipped) (keep (fn [[k x]] (when (= k :at) x)) found)) [["n0" 0] ["n2" 1] ["n3" 0]])
        (t/eq "… its wire caught up at the next note found, once" (keep (fn [[k x]] (when (= k :wire) [(:send x) (:id x) (:status x)])) found)
              [[:swell "n1" "caught up"]])
        (t/is "… and not in the take" (nil? (get-in take [:when "n1"]))))
      (let [{:keys [found]} (fl/follow sc (played 1 0 [[0 60] [1 62] [2 52] [3 65]]))]
        (t/eq "a note heard an octave off (a tracker's usual error) is still that note" (mapv :id (keep (fn [[k x]] (when (= k :at) x)) found)) ["n0" "n1" "n2" "n3"]))
      (let [{:keys [found state]} (fl/follow sc (played 1 0 [[0 60] [1 72]]))]
        (t/eq "a note too far ahead is not where the performer is" [(mapv :id (keep (fn [[k x]] (when (= k :at) x)) found)) (:extra state)] [["n0"] 1])))
    ;; wires on their notes (discussion #217): rigid on n3, elastic on n5 (half a second of tolerance), led by the
    ;; electronics on n6
    (let [wt [:voice {:tempo 60}
              [:measure {:meter [4 4]} "c4/1" [:note {:pitch "d4" :dur 1 :wire {:send :swell}}] "e4/1" [:note {:pitch "f4" :dur 1 :wire {:send :a}}]]
              [:measure "g4/1" [:note {:pitch "a4" :dur 1 :wire {:send :b :kind :elastic :tol 0.5}}]
               [:note {:pitch "b4" :dur 1 :wire [{:send :c :kind :elastic :leader :electronics} {:send :d}]}] "c5/1"]]
          sc (fl/score wt)
          ws (fl/wires sc)
          run (fn [perf] (let [{:keys [found]} (fl/follow sc perf {:wires ws})]
                           (vec (keep (fn [[k x]] (when (and (= k :wire) (not (#{:swell :d} (:send x)))) [(:send x) (:status x) (:t x)])) found))))]
      (t/eq "the wires of a score, on their notes (one or several)"
            (mapv (juxt :id :note :kind :leader :send) ws)
            [["n1" 1 :rigid :performer :swell] ["n3" 3 :rigid :performer :a] ["n5" 5 :elastic :performer :b]
             ["n6/0" 6 :elastic :electronics :c] ["n6/1" 6 :rigid :performer :d]])
      (t/eq "played in time: rigid and elastic on their notes; led by the electronics, at its own time"
            (run (played 1 0 (map-indexed vector midis))) [[:a "on the note" 3] [:b "on the note" 5] [:c "led" 6]])
      (t/eq "the performer stops after the fifth note: the elastic wire goes on at its time plus its tolerance, the led one at its time, the rigid ones never"
            (run (played 1 0 (take 5 (map-indexed vector midis)))) [[:a "on the note" 3] [:b "went on" 5.5] [:c "led" 6]])
      (t/eq "a note left out: its rigid wire caught up at the next"
            (run (played 1 0 [[0 60] [1 62] [2 64] [4 67] [5 69] [6 71] [7 72]])) [[:a "caught up" 4] [:b "on the note" 5] [:c "led" 6]])
      (t/eq "late at the elastic wire's note: it went on without it"
            (first (filter #(= :b (first %)) (run (played 1 0 [[0 60] [1 62] [2 64] [3 65] [4 67] [6.2 69]]))))
            [:b "went on" 5.5])
      (t/is "when the next elastic wire would go on by itself"
            (= 5.5 (fl/next-due (reduce (fn [st [t m]] (first (fl/hear st t m))) (fl/start sc {:wires ws}) (played 1 0 (take 5 (map-indexed vector midis)))))))
      (t/eq "… kept in the MEI, on their notes" (mapv (juxt :note :kind :leader :send) (fl/wires (fl/score (mei/<-mei (mei/->mei wt)))))
            (mapv (juxt :note :kind :leader :send) ws))
      (t/is "the continuum draws them" (let [s (ct/svg wt 600 200)] (and (re-find #"ct-wire ct-rigid\" data-wire=\"n3\"" s) (re-find #"ct-wire ct-elastic ct-led\" data-wire=\"n6/0\"" s)))))
    ;; a rest with a wire: the electronics' own event, led at its time (from where the performer is)
    (let [et [:voice {:tempo 60} [:measure {:meter [4 4]} "c4/1 d4" [:rest {:dur 1 :wire {:send :hit}}] "e4/1"]]
          sc (fl/score et)
          go (fn [perf] (vec (keep (fn [[k x]] (when (= k :wire) [(:send x) (:status x) (:t x)])) (:found (fl/follow sc perf)))))]
      (t/eq "its wire, led at its time at the performer's tempo, though nothing is heard there" (go [[0 60 0.8] [1.2 62 0.8] [3.6 64 0.8]]) [[:hit "led" 2.4]])
      (t/eq "the notes around it are found, and the rest is not a note skipped"
            (mapv (juxt :id :skipped) (keep (fn [[k x]] (when (= k :at) x)) (:found (fl/follow sc [[0 60 0.8] [1 62 0.8] [3 64 0.8]]))))
            [["n0" 0] ["n1" 0] ["n2" 0]])
      (t/is "the continuum draws it" (re-find #"ct-wire ct-elastic ct-led\" data-wire=\"r2\"" (ct/svg et 600 200))))
    (let [mt-tree [:voice {:tempo 60} [:measure {:meter [4 4]} [:rest {:dur 1 :wire {:send :a}}] [:rest {:dur 1}] [:note {:pitch "c4" :dur 2}]]
                   [:measure {:meter [4 4]} [:note {:pitch "d4" :dur 1}] [:rest {:dur 2 :wire {:send :b :kind :elastic}}] [:note {:pitch "e4" :dur 1}]]]
          m (mei/->mei mt-tree) back (mei/<-mei m)
          wired (fn [t] (vec (keep (fn [x] (when (and (vector? x) (= :rest (first x)) (:wire (second x))) (second x))) (tree-seq vector? seq t))))]
      (t/eq "rests with wires come back from the MEI (it writes rests in a row as one), where they were" (wired back) (wired mt-tree))
      (t/is "… and the MEI is a fixpoint" (= m (mei/->mei back))))
    (let [rep [:voice {:tempo 60} [:measure {:meter [4 4]} "c4/1 c4 c4 d4"]]
          {:keys [found]} (fl/follow (fl/score rep) [[0 60 0.5] [1.1 60 0.5] [2.3 60 0.5] [3.2 62 0.5]])]
      (t/eq "repeated notes, one after the other" (mapv :id (keep (fn [[k x]] (when (= k :at) x)) found)) ["n0" "n1" "n2" "n3"]))
    (let [{:keys [take]} (fl/follow (fl/score tree) (played 1.25 0.3 (map-indexed vector midis)) {:id "f1"})
          t2 (mei/add-take tree take)]
      (t/eq "the take of a tree written without ids, shown by its continuum" (mapv (juxt :id :t) (take-while #(< (:t %) 3) (ct/events t2 "f1")))
            [["n0" 0] ["n1" 1.25] ["n2" 2.5]])
      (let [onsets (fn [tk] (into {} (map (fn [[k v]] [k (first v)])) (:when tk)))]
        (t/eq "… and in its MEI" (onsets (first (mei/takes (mei/<-mei (mei/->mei (mei/with-note-ids t2)))))) (onsets take))))))
