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
    ;; "I am here" (discussion #308): a correction while rehearsing
    (let [sc (fl/score tree)
          heard (reduce (fn [st [t m]] (first (fl/hear st t m))) (fl/start sc) [[0 60] [1 62]])
          [ahead found] (fl/here heard 2.5 4)
          [back _] (fl/here ahead 3 1)]
      (t/eq "told it is ahead: there, as if heard, the notes between skipped" [(:now (fl/view ahead)) (:skipped (fl/view ahead))] ["n4" #{"n2" "n3"}])
      (t/is "… what it sets off is said" (= "n4" (:id (second (first found)))))
      (t/eq "told it is back: from there again, the later notes to be played again"
            [(:now (fl/view back)) (:played (fl/view back)) (:next back)] ["n1" #{"n0" "n1"} 2])
      (t/is "… and the wire on that note goes on again" (some #(= "n1" (:id (second %))) (filter #(= :wire (first %)) (second (fl/here ahead 3 1))))))
    ;; how a note sounds: from the notation, learned from takes, and matched by it (discussion #308, steps 2–4)
    (let [sc (fl/score [:voice {:tempo 60} [:measure {:meter [4 4]} "c4/1 d4 e4 f4"]])
          ch (fn [& pcs] (reduce (fn [v p] (assoc v p 1)) (vec (repeat 12 0)) pcs))
          ids (fn [found] (mapv :id (keep (fn [[k x]] (when (= k :at) x)) found)))]
      (t/eq "from the notation: a note's pitch class, as a chroma" (:mean (fl/default-profile (nth sc 2))) {:chroma (ch 4)})
      (t/eq "a sound without a pitch (pitch~ hears none) is found by its chroma"
            (ids (:found (fl/follow sc [[0 60 0.8] [1 62 0.8] [2 nil 0.8 {:chroma (ch 4)}] [3 65 0.8]]))) ["n0" "n1" "n2" "n3"])
      (t/eq "… and not when it sounds like none of the notes ahead"
            (ids (:found (fl/follow sc [[0 60 0.8] [1 62 0.8] [2 nil 0.8 {:chroma (ch 9)}]]))) ["n0" "n1"])
      ;; two rehearsals: the third note is a multiphonic (a chroma of E, B and F, noisy); the others are plain notes
      (let [take (fn [fl e-chroma] {:id (str "r" fl) :profile {"n0" {:chroma (ch 0) :flatness 0.1} "n1" {:chroma (ch 2) :flatness 0.12}
                                                             "n2" {:chroma e-chroma :flatness fl} "n3" {:chroma (ch 5) :flatness 0.1}}})
            ps (fl/learn sc [(take 0.7 (ch 4 11 5)) (take 0.8 (ch 4 11 5 6))])]
        (t/eq "learned from the takes that kept it: each note's mean, how much it varies, from how many takes"
              [(get-in ps ["n2" :n]) (get-in ps ["n2" :mean :flatness]) (get-in ps ["n2" :sd :flatness])] [2 0.75 0.05])
        (t/is "… and its weights: the multiphonic is told from its neighbours by how noisy it is more than by its chroma"
              (> (get-in ps ["n2" :w :flatness]) (get-in ps ["n2" :w :chroma])))
        (t/eq "with what was learned, the multiphonic is found by what is heard of it"
              (ids (:found (fl/follow sc [[0 60 0.8] [1 62 0.8] [2 nil 0.8 {:chroma (ch 4 11 5) :flatness 0.74}] [3 65 0.8]] {:profiles ps})))
              ["n0" "n1" "n2" "n3"])
        (t/is "… where its notation alone would not (its chroma is not E's)"
              (> (fl/obs-dist (fl/default-profile (nth sc 2)) {:chroma (ch 4 11 5)}) (fl/obs-dist (get ps "n2") {:chroma (ch 4 11 5) :flatness 0.74})))))
;; the probabilistic follower (:model :hmm, discussion #308)
    (let [sc (fl/score [:voice {:tempo 60} [:measure {:meter [4 4]} "c4/1 d4 e4 f4"] [:measure "g4/1"]])
          perf [[0 60 0.4] [0.5 64 0.3] [1 62 0.8] [2 64 0.8] [3 65 0.8] [4 67 0.8]]
          when-of (fn [st] (into (sorted-map) (map (fn [[k [t]]] [k t])) (:played st)))
          g (fl/follow sc perf)
          h (fl/follow sc perf {:model :hmm})]
      (t/is "a slip that sounds like a later note: the greedy follower jumps there and loses the note it skipped"
            (not (contains? (:played (:state g)) "n1")))
      (t/eq "the probabilistic one jumps too, and undoes it when the next sounds point back"
            [(when-of (:state h)) (:undone (:state h))] [{"n0" 0 "n1" 1 "n2" 2 "n3" 3 "n4" 4} 1])
      (t/eq "played slower than written, every note found, as the greedy one does"
            (mapv :beat (keep (fn [[k x]] (when (= k :at) x)) (:found (fl/follow (fl/score tree) (played 1.25 0.3 (map-indexed vector midis)) {:model :hmm}))))
            [0 1 2 3 4 5 6 7])
      (t/eq "a wrong note between two: it stays where it was"
            (mapv :id (keep (fn [[k x]] (when (= k :at) x)) (:found (fl/follow (fl/score tree) (played 1 0 [[0 60] [1 62] [1.5 66] [2 64] [3 65]]) {:model :hmm}))))
            ["n0" "n1" "n2" "n3"]))
;; following frame by frame (:model :dtw, discussion #308)
    (let [sc (fl/score [:voice {:tempo 60} [:measure {:meter [4 4]} "c4/1 d4 e4 f4"]])
          frames (fn [rate glitch] (vec (for [k (range 110) :let [t (* k 0.05) i (min 3 (js/Math.floor (/ t rate)))]]
                                          [t {:midi (if (and glitch (= k 12)) 64 (nth [60 62 64 65] i))}])))
          arrivals (fn [found] (mapv (fn [x] [(:id x) (/ (js/Math.round (* 100 (:t x))) 100)]) (keep (fn [[k x]] (when (= k :at) x)) found)))]
      (t/eq "what the score should sound like: a frame every 50 ms, each event as long as it is written"
            [(count (fl/reference (fl/start sc))) (get-in (first (fl/reference (fl/start sc))) [:prof :mean :midi])] [80 60])
      (t/eq "frame by frame, slower than written: each note reached when it begins to sound"
            (arrivals (:found (fl/follow sc (frames 1.25 false) {:model :dtw}))) [["n0" 0] ["n1" 1.25] ["n2" 2.5] ["n3" 3.75]])
      (t/eq "… a frame heard wrong (an E in the middle of the C) does not move it"
            (arrivals (:found (fl/follow sc (frames 1.25 true) {:model :dtw}))) [["n0" 0] ["n1" 1.25] ["n2" 2.5] ["n3" 3.75]])
      (t/eq "… and timed by a take, the reference lasts as the take played it"
            (count (fl/reference (fl/start sc) {:when {"n0" [0 1] "n1" [2 1] "n2" [3 1] "n3" [4 1]}} 0.05)) 100))
;; :listen — what a score says is to be heard at an event (discussion #308)
    (let [lt [:voice {:tempo 60} [:measure {:meter [4 4]} "c4/1"
                                  [:rest {:dur 1 :listen {:flatness [0.6 1] :loudness [0.5 1]} :wire {:send :hit}}]
                                  [:note {:pitch "e4" :dur 1 :listen {:chroma [4 11 5]}}] "f4/1"]]
          sc (fl/score lt)
          ids (fn [found] (mapv :id (keep (fn [[k x]] (when (= k :at) x)) found)))
          sent (fn [found] (vec (keep (fn [[k x]] (when (= k :wire) [(:send x) (:status x)])) found)))]
      (t/eq "a rest with :listen is an event the performer makes, without a pitch" (mapv (juxt :id :midi) sc) [["n0" 60] ["r1" nil] ["n1" 64] ["n2" 65]])
      (t/eq "its profile is what :listen says: a range's middle, half its width as its spread"
            (select-keys (fl/default-profile (nth sc 1)) [:mean :sd]) {:mean {:flatness 0.8 :loudness 0.75} :sd {:flatness 0.2 :loudness 0.25}})
      (t/eq "a note's :listen chroma takes the place of its pitch's (a multiphonic)" (get-in (fl/default-profile (nth sc 2)) [:mean :chroma]) [0 0 0 0 1 1 0 0 0 0 0 1])
      (t/eq "the probabilistic follower hears them too"
            (ids (:found (fl/follow sc [[0 60 0.8] [1 nil 0.5 {:flatness 0.85 :loudness 0.9}] [2 nil 0.8 {:chroma [0 0 0 0 1 1 0 0 0 0 0 1]}] [3 65 0.8]] {:model :hmm})))
            ["n0" "r1" "n1" "n2"])
      (let [{:keys [found]} (fl/follow sc [[0 60 0.8] [1 nil 0.5 {:flatness 0.85 :loudness 0.9}] [2 nil 0.8 {:chroma [0 0 0 0 1 1 0 0 0 0 0 1]}] [3 65 0.8]])]
        (t/eq "the noise is heard where :listen says it is, the multiphonic too" (ids found) ["n0" "r1" "n1" "n2"])
        (t/eq "… and the noise's wire goes on when it is heard, as a note's" (sent found) [[:hit "on the note"]]))
      (t/eq "a quiet, pitched-less sound is not the loud noise"
            (ids (:found (fl/follow sc [[0 60 0.8] [1 nil 0.5 {:flatness 0.1 :loudness 0.1}]]))) ["n0"])
      (t/is "the continuum marks what is to be heard there" (re-find #"ct-head ct-listen\" data-id=\"r1\"" (ct/svg lt 600 200))))
    ;; how sure a follower can be at each note (discussion #308, step 5)
    (let [sc (fl/score [:voice {:tempo 60} [:measure {:meter [4 4]} "c4/1 c4 d4 f4"]])]
      (t/eq "from the notation: a note like its neighbour is harder to be sure of"
            (fl/confidence sc nil nil) {"n0" 0.15 "n1" 0.15 "n2" 0.6 "n3" 0.6})
      (let [ps (into {} (map (fn [e] [(:id e) (fl/default-profile e)]) sc))]
        (t/eq "once rehearsed: a note the takes missed is less sure"
              (select-keys (fl/confidence sc ps [{:when {"n2" [2 1] "n3" [3 1]}} {:when {"n3" [3 1]}}]) ["n2" "n3"])
              {"n2" 0.7 "n3" 1})))
    (let [rep [:voice {:tempo 60} [:measure {:meter [4 4]} "c4/1 c4 c4 d4"]]
          {:keys [found]} (fl/follow (fl/score rep) [[0 60 0.5] [1.1 60 0.5] [2.3 60 0.5] [3.2 62 0.5]])]
      (t/eq "repeated notes, one after the other" (mapv :id (keep (fn [[k x]] (when (= k :at) x)) found)) ["n0" "n1" "n2" "n3"]))
    (let [{:keys [take]} (fl/follow (fl/score tree) (played 1.25 0.3 (map-indexed vector midis)) {:id "f1"})
          t2 (mei/add-take tree take)]
      (t/eq "the take of a tree written without ids, shown by its continuum" (mapv (juxt :id :t) (take-while #(< (:t %) 3) (ct/events t2 "f1")))
            [["n0" 0] ["n1" 1.25] ["n2" 2.5]])
      (let [onsets (fn [tk] (into {} (map (fn [[k v]] [k (first v)])) (:when tk)))]
        (t/eq "… and in its MEI" (onsets (first (mei/takes (mei/<-mei (mei/->mei (mei/with-note-ids t2)))))) (onsets take))))))
