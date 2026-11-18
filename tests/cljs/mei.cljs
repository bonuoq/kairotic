;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · a tree in MEI and back (kairotic.mei, Study 55, discussion #217), and what quantize keeps of
;; where the notes really sounded
(ns kairotic.test.mei
  (:require [clojure.string :as str]
            [kairotic.mei :as mei]
            [kairotic.mt :as mt]
            [kairotic.quantize :as qz]
            [kairotic.treecanvas :as tc]
            [kairotic.test :as t]))

(defn- hz [m] (/ (js/Math.round (* 100 (* 440 (js/Math.pow 2 (/ (- m 69) 12))))) 100))
(defn- ev ([tt dur m amp] {:t tt :dur dur :hz (hz m) :amp amp}) ([tt dur m amp m2] (assoc (ev tt dur m amp) :hz2 (hz m2))))

(def phrase [(ev 0 0.5 62 0.5) (ev 0.5 0.5 64 0.55) (ev 1 1 66 0.7) (ev 2 0.5 69 0.6) (ev 2.55 0.45 67.8 0.4)
             (ev 3.05 1.4 71 0.75 74) (ev 4.55 0.4 73.3 0.5) (ev 5 1 74 0.9) (ev 6.1 0.35 76.4 0.3) (ev 6.5 1.6 69 0.55 61.5)])
(def gesture [(ev 0 1.2 55 0.3 67.4) (ev 1.3 0.2 70.6 0.8) (ev 1.55 0.2 69.1 0.7) (ev 1.8 0.9 66.5 0.4 72.2)
              (ev 2.9 0.15 80 0.9) (ev 3.2 2 60.3 0.25 58) (ev 5.4 0.3 75 0.6) (ev 5.8 1.4 77 0.8 64)])
(def continuum {:res {:time [1 0.5 0] :pitch [1 1 0] :glyph [1 0.5 0]}
                :wires [{:id "w1" :note 2 :kind "rigid"}] :electronics [{:wire "w1" :kind "drone" :hz 73.42 :dur 3.2}]})

(def foreign
  (str "<?xml version=\"1.0\" encoding=\"UTF-8\"?><mei xmlns=\"http://www.music-encoding.org/ns/mei\" meiversion=\"5.0\"><meiHead/>"
       "<music><body><mdiv><score><scoreDef><staffGrp><staffDef n=\"1\" lines=\"5\"><clef shape=\"G\" line=\"2\"/><keySig sig=\"1s\"/><meterSig count=\"3\" unit=\"4\"/></staffDef></staffGrp></scoreDef>"
       "<section><measure n=\"1\"><staff n=\"1\"><layer n=\"1\"><note xml:id=\"n1\" pname=\"g\" oct=\"4\" dur=\"4\"/>"
       "<beam><note xml:id=\"n2\" pname=\"f\" oct=\"4\" dur=\"8\"/><note xml:id=\"n3\" pname=\"e\" oct=\"4\" dur=\"8\"/></beam>"
       "<note xml:id=\"n4\" pname=\"d\" oct=\"4\" dur=\"4\"/></layer></staff><tie startid=\"#n4\" endid=\"#n5\"/></measure>"
       "<measure n=\"2\"><staff n=\"1\"><layer n=\"1\"><note xml:id=\"n5\" pname=\"d\" oct=\"4\" dur=\"4\"/><rest xml:id=\"r1\" dur=\"4\"/>"
       "<note xml:id=\"n6\" pname=\"f\" oct=\"4\" dur=\"4\"><accid accid=\"n\"/></note></layer></staff></measure>"
       "<measure n=\"3\"><staff n=\"1\"><layer n=\"1\"><note xml:id=\"n7\" pname=\"b\" oct=\"4\" dur=\"4\" dots=\"1\" accid=\"f\"/>"
       "<note xml:id=\"n8\" pname=\"f\" oct=\"4\" dur=\"8\"/><rest xml:id=\"r2\" dur=\"4\"/></layer></staff></measure></section></score></mdiv></body></music></mei>"))

(t/run! "mei"
  (fn []
    ;; a line (Study 52) through the tree and the MEI, for several keys, meters and tempi
    (doseq [[nm line opts] [["the phrase in D, 4/4 at 60" phrase {:bpm 60 :key 2 :continuum continuum}]
                            ["the gesture in C, 4/4 at 72" gesture {:bpm 72 :key 0}]
                            ["the phrase in F, 3/4 at 90" phrase {:bpm 90 :key -1 :meter [3 4]}]
                            ["the gesture in A, 2/4 at 50, on eighths" gesture {:bpm 50 :key 3 :meter [2 4] :div 2}]]]
      (doseq [[what ok] (:checks (mei/round-trip line opts))] (t/is (str nm ": " what) ok)))

    (let [tr (mei/line->tree [{:t 0 :dur 3 :hz 440 :amp 0.5} {:t 3.1 :dur 0.9 :hz 220 :amp 0.25 :hz2 330}] {:bpm 60 :meter [2 4]})
          m (mei/->mei tr)]
      (t/is "a note across a barline: two pieces, the first tied, the MEI ties them" (and (re-find #"<tie startid=" m) (= tr (mei/<-mei m))))
      (t/is "MEI's gestural attributes: @tstamp.real, @dur.real, @vel" (and (re-find #"tstamp\.real=\"00:00:03\.100\"" m) (re-find #"dur\.real=\"0\.9\"" m) (re-find #"vel=\"64\"" m)))
      (t/is "… and <extMeta type=\"kairotic\"> for the rest" (re-find #"<extMeta type=\"kairotic\">" m))
      (t/eq "the line back: the tied note one event, with the names the MEI gave" (mapv (juxt :t :dur :name) (mei/tree->line (mei/<-mei m))) [[0 3 "a4"] [3.1 0.9 "a3"]]))

    ;; two voices
    (let [v1 (mei/line->tree (take 5 phrase) {:bpm 60 :key 2 :name "upper"})
          v2 (mei/line->tree (map #(update % :hz / 2) (take 5 gesture)) {:bpm 60 :key 2 :name "lower"})
          tr [:par {:tempo 60} v1 v2]
          m (mei/->mei tr)]
      (t/is "two voices: two staves" (= 2 (count (re-seq #"<staffDef " m))))
      (t/is "… read back, the same tree" (= tr (mei/<-mei m)))
      (t/is "… and the same MEI" (= m (mei/->mei (mei/<-mei m)))))

    ;; a MEI written elsewhere (key and meter as elements, an accidental as an element)
    (let [tr (mei/<-mei foreign)]
      (t/eq "a MEI from elsewhere reads as its notation"
            tr [:voice {:name "voice 1" :key 1}
                [:measure {:meter [3 4]} [:note {:pitch "g4" :dur 1}] [:note {:pitch "f#4" :dur 0.5}] [:note {:pitch "e4" :dur 0.5}] [:note {:pitch "d4" :dur 1 :tie true}]]
                [:measure {:meter [3 4]} [:note {:pitch "d4" :dur 1}] [:rest {:dur 1}] [:note {:pitch "f4" :dur 1}]]
                [:measure {:meter [3 4]} [:note {:pitch "bb4" :dur 1.5}] [:note {:pitch "f#4" :dur 0.5}] [:rest {:dur 1}]]])
      (t/is "… and is a fixpoint once written here" (let [m (mei/->mei tr)] (and (= tr (mei/<-mei m)) (= m (mei/->mei (mei/<-mei m)))))))
    (t/is "not MEI says so" (try (mei/<-mei "<html>") false (catch :default _ true)))
    (t/is "MusicXML is told from MEI" (and (mei/musicxml? "<?xml version=\"1.0\"?><score-partwise version=\"4.0\">") (not (mei/musicxml? foreign))))

    ;; quantize keeps where the notes really sounded
    (let [free [:voice {:tempo 120} [:par [:note {:pitch "c4" :at 0 :dur 1.1}] [:note {:pitch "e4" :at 1.05 :dur 0.9}] [:note {:pitch "g4" :at 3 :dur 2}]]]
          q (qz/quantize-tree free {:meter [4 4]})
          ns (filter #(= :note (mt/tag %)) (tree-seq mt/node? mt/kids q))
          real (mapv (comp (juxt :tstamp.real :dur.real) mt/attrs) ns)]
      (t/eq "quantized, each note keeps where it really sounded (seconds at the tree's tempo: 120)" (take 3 real) [[0 0.55] [0.525 0.45] [1.5 1]])
      (t/is "… on its first piece only (the g4 over the barline: its second piece has none)" (= [nil nil] (last real)))
      (t/is "… unless asked not to (:real false)" (every? nil? (map (comp :tstamp.real mt/attrs) (filter #(= :note (mt/tag %)) (tree-seq mt/node? mt/kids (qz/quantize-tree free {:meter [4 4] :real false}))))))
      (let [f (tc/free-form q {:real true}) ats (mapv (comp (juxt :at :dur) mt/attrs) (mt/kids (first (mt/kids f))))]
        (t/eq "made free again (unquantize!), the notes go back where they sounded" ats [[0 1.1] [1.05 0.9] [3 2]]))
      (t/is "the roll's free form keeps the written times" (= [0 1 3] (take 3 (mapv (comp :at mt/attrs) (mt/kids (first (mt/kids (tc/free-form q))))))))
      (let [m (mei/->mei q)]
        (t/is "a quantized tree as MEI: its real times as @tstamp.real" (re-find #"tstamp\.real=\"00:00:00\.525\"" m))
        (t/is "… MEI → tree → MEI holds" (= m (mei/->mei (mei/<-mei m))))))

    ;; takes (discussion #289): several performances of one tree, on its root
    (let [tr (mei/line->tree (take 4 phrase) {:bpm 60 :key 2})
          tk {:id "t1" :name "Tuesday" :audio "a1b2c3" :when {"e0" [0.02 0.48] "e2" [1.03 0.95] "e3" [2.1 0.4]}}
          t2 (mei/add-take tr tk)
          m (mei/->mei t2)]
      (t/is "a take goes to MEI's performance module: a <when> per note played, pointing at it"
            (and (re-find #"<performance xml:id=\"perf-t1\" label=\"Tuesday\"><recording xml:id=\"rec-t1\" betype=\"time\"><avFile target=\"a1b2c3\"/>" m)
                 (= 3 (count (re-seq #"<when " m))) (re-find #"absolute=\"00:00:01\.030\" data=\"#k-" m)))
      (t/is "… before <body>" (< (.indexOf m "<performance") (.indexOf m "<body>")))
      (t/is "… and comes back exactly: tree → MEI → tree, MEI → tree → MEI" (and (= t2 (mei/<-mei m)) (= m (mei/->mei (mei/<-mei m)))))
      (t/eq "the line of a take: where it played each note it played" (mapv (juxt :id :t :dur) (mei/tree->line t2 {:take "t1"}))
            [["e0" 0.02 0.48] ["e2" 1.03 0.95] ["e3" 2.1 0.4]])
      (t/eq "… the line's own time is untouched" (mapv :t (mei/tree->line t2)) [0 0.5 1 2])
      (t/eq "promoted, the take is the line's time" (mapv (juxt :t :dur) (take 3 (mei/tree->line (mei/promote-take t2 "t1"))))
            [[0.02 0.48] [0.5 0.5] [1.03 0.95]])
      (t/eq "a take from a line played" (mei/take-of-line [{:id "e0" :t 0.1 :dur 0.4} {:t 9 :dur 1}] {:id "t2" :audio "x"})
            {:id "t2" :when {"e0" [0.1 0.4]} :audio "x"})
      (t/is "takes added and removed" (and (= ["t1" "t2"] (mapv :id (mei/takes (mei/add-take t2 {:id "t2" :when {}}))))
                                           (= [] (mei/takes (mei/remove-take t2 "t1"))))))
    (let [fm (str/replace foreign "<music><body>"
                          "<music><performance label=\"concert\"><recording betype=\"time\"><avFile target=\"take.wav\"/><when absolute=\"00:00:01.500\" data=\"#n2\"/><when absolute=\"00:00:02.250\" data=\"#n3\"/></recording></performance><body>")
          tr (mei/<-mei fm)]
      (t/eq "a MEI from elsewhere with a performance: its take, the notes it points at get their xml:id"
            [(:takes (second tr)) (keep (comp :id second) (filter #(= :note (first %)) (tree-seq vector? seq tr)))]
            [[{:id "take1" :when {"n2" [1.5 nil] "n3" [2.25 nil]} :name "concert" :audio "take.wav"}] ["n2" "n3"]])
      (t/eq "… and its line: where the take played them, for as long as they are written" (mapv (juxt :id :t :dur) (mei/tree->line tr {:take "take1"}))
            [["n2" 1.5 0.5] ["n3" 2.25 0.5]]))
    (let [q [:voice [:measure {:meter [4 4]} [:note {:pitch "c4" :dur 2}] [:note {:pitch "d4" :dur 2 :tie true}]]
             [:measure {:meter [4 4]} [:note {:pitch "d4" :dur 1}] [:rest {:dur 1}] [:note {:pitch "e4" :dur 2 :id "n1"}]]]]
      (t/eq "ensure-ids: an :id for every note that begins a sound, none for a tied piece, the ones used skipped"
            (keep (comp :id second) (filter #(= :note (first %)) (tree-seq vector? seq (mei/ensure-ids q)))) ["n0" "n2" "n1"]))))
