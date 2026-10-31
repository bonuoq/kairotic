;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · quantization: free time → measured notation (kairotic.quantize, issue #86)
(ns kairotic.test.quantize
  (:require [clojure.string :as str]
            [kairotic.mt :as mt]
            [kairotic.quantize :as qz]
            [kairotic.canvas :as cv]
            [kairotic.test :as t]))

(defn- buffer
  "A freqt buffer of flat strokes [start end midi] …, with a bar grid gx."
  [gx & ns]
  {:gx gx :gy nil
   :strokes (into {} (map-indexed (fn [i [t0 t1 m]] [(keyword (str "t" (inc i))) {:pts [[t0 (cv/midi->hz m)] [t1 (cv/midi->hz m)]]}]) ns))})

(defn- rhythm "[t dur pitch] of the notes of a tree, as it sounds (ties joined)." [tree]
  (mapv (fn [e] [(:t e) (:dur e) (mt/pitch-name (js/Math.round (:pitch e)))]) (mt/notes tree)))

(defn- nodes [tree tg] (filter (fn [x] (and (mt/node? x) (= tg (mt/tag x)))) (tree-seq mt/node? mt/kids tree)))

(t/run! "quantize"
  (fn []
    ;; the frame
    (t/eq "no bar grid: 4/4" (qz/meter-of-grid nil) {:meter [4 4]})
    (t/eq "cycles of whole beats count quarters" (mapv qz/meter-of-grid [{:cycles [3]} {:cycles [2 3]}])
          [{:meter [3 4]} {:meter [5 4] :groups [2 3]}])
    (t/eq "cycles of half beats count eighths: 6/8, 8/8 [3+3+2]" (mapv qz/meter-of-grid [{:cycles [1.5 1.5]} {:cycles [1.5 1.5 1]}])
          [{:meter [6 8]} {:meter [8 8] :groups [3 3 2]}])
    (t/eq "spans: the beats of 4/4, the dotted beats of 6/8, 2+2+3 in 7/8"
          [(mapv second (qz/spans [4 4])) (mapv second (qz/spans [6 8])) (mapv second (qz/spans [7 8]))]
          [[1 1 1 1] [1.5 1.5] [1 1 1.5]])
    (t/eq "tuplets a division needs (none for written or dotted units)"
          (mapv (fn [[L n]] (qz/tuplet-of L n)) [[1 3] [1 4] [1.5 3] [1.5 2] [1 5] [2 3] [1.5 5] [1 6]])
          [[3 2] nil nil nil [5 4] [3 2] [5 3] [6 4]])
    (t/is "a 32nd position costs more than a sixteenth's, a sixteenth's more than an eighth's"
          (< (qz/depth 1 2 1) (qz/depth 1 4 1) (qz/depth 1 8 1)))

    ;; strokes → measures
    (let [exact (buffer nil [0 1 60] [1 1.5 62] [1.5 2 64] [2 4 65])
          sloppy (buffer nil [0.03 0.95 60] [1.02 1.52 62] [1.47 2.1 64] [2.05 3.9 65])
          q (qz/quantize exact)]
      (t/is "a freqt quantized is a measured tree" (mt/measured? q))
      (t/eq "... that sounds as drawn" (rhythm q) [[0 1 "c4"] [1 0.5 "d4"] [1.5 0.5 "e4"] [2 2 "f4"]])
      (t/eq "the same rhythm drawn loosely is the same tree" (qz/quantize sloppy) q)
      (t/is "... and has no errors" (empty? (mt/problems q))))
    (let [q (qz/quantize (buffer nil [0 0.33 60] [0.34 0.66 62] [0.67 1 64] [1 2 65]))]
      (t/eq "three notes in a beat are a triplet" (map (comp :ratio mt/attrs) (nodes q :tuplet)) [[3 2]])
      (t/eq "... of eighths" (map (comp :dur mt/attrs) (mt/kids (first (nodes q :tuplet)))) [0.5 0.5 0.5]))
    (let [q (qz/quantize (buffer nil [0 0.66 60] [0.67 1.33 62] [1.34 2 64] [2 4 65]))]
      (t/eq "three notes in two beats are a half-note triplet (quarters, 3:2)"
            (map (fn [x] [(:ratio (mt/attrs x)) (map (comp :dur mt/attrs) (mt/kids x))]) (nodes q :tuplet))
            [[[3 2] [1 1 1]]]))
    (let [q (qz/quantize (buffer nil [3 5 60] [5 8 62]))]
      (t/eq "a note over the barline is tied, and sounds once" (rhythm q) [[3 2 "c4"] [5 3 "d4"]])
      (t/eq "... with :tie on its first piece" (count (filter (comp :tie mt/attrs) (nodes q :note))) 1))
    (let [q (qz/quantize (buffer nil [0 0.333 60] [0.333 1.5 62] [1.5 2 64]))]
      (t/eq "a note that leaves a tuplet is tied out of it" (rhythm q) [[0 0.333333 "c4"] [0.333333 1.166667 "d4"] [1.5 0.5 "e4"]]))
    (let [q (qz/quantize (buffer nil [0.95 1.0 67] [1.0 2 65] [2 4 64]))]
      (t/eq "a note too short for any point is a grace note" (map (comp :pitch mt/attrs) (filter (comp :grace mt/attrs) (nodes q :note))) ["g4"])
      (t/eq "... that takes no time" (mt/duration q) 4))
    (let [b (buffer nil [0 0.8 60] [1 2 62] [2 4 64])]
      (t/eq "a small gap before the next note is not a rest (legato)" (count (nodes (qz/quantize b) :rest)) 0)
      (t/eq "... and :legato 0 keeps every gap" (count (nodes (qz/quantize b {:legato 0}) :rest)) 1))
    (t/eq "a last bar where only an end spills over is not written"
          (count (nodes (qz/quantize (buffer nil [0 2 60] [2 4.04 62])) :measure)) 1)
    (let [q (qz/quantize (buffer {:step 0.5 :cycles [1.5 1.5]} [0 1 60] [1 1.5 62] [1.5 3 64]))]
      (t/eq "the bar grid gives the meter (6/8)" (:meter (mt/attrs (first (nodes q :measure)))) [6 8])
      (t/eq "... and :meter overrides it" (:meter (mt/attrs (first (nodes (qz/quantize (buffer {:step 0.5 :cycles [1.5 1.5]} [0 3 60]) {:meter "3/4"}) :measure))))
            [3 4]))
    (let [q (qz/quantize (buffer nil [0 1 60] [0 1 64] [0 1 67]))]
      (t/eq "notes that start together are a chord" (count (nodes q :chord)) 1))
    (let [q (qz/quantize (buffer nil [0 0.5 60.4]))]
      (t/eq "a pitch between semitones keeps its cents beside its name" (select-keys (mt/attrs (first (nodes q :note))) [:pitch :cents]) {:pitch "c4" :cents 40}))
    (t/eq "an empty buffer is one bar of rest" (count (nodes (qz/quantize cv/empty) :measure)) 1)

    ;; trees without measures
    (let [free [:par [:note {:at 0 :pitch "c4" :dur 1.5}] [:note {:at 1.5 :pitch "d4" :dur 0.5}] [:note {:at 2 :pitch "e4" :dur 2}]]
          q (qz/quantize-tree free)]
      (t/is "a tree without measures is quantized into measures" (mt/measured? q))
      (t/eq "... and sounds as before" (rhythm q) (rhythm free)))
    (let [q (qz/quantize-tree (mt/canon 2 7 "c4/1 d4 e4 f4"))]
      (t/eq "each voice of a tree on its own" (count (nodes q :voice)) 2))

    ;; the score
    (let [{:keys [mei pieces]} (qz/->score (buffer nil [0 0.33 60] [0.34 0.66 62] [0.67 1 64] [1 2 65]) "q-")]
      (t/is "->score writes MEI with the tuplet" (str/includes? mei "<tuplet num=\"3\" numbase=\"2\""))
      (t/is "... and pieces to place a cursor" (seq pieces)))
    (t/is "->score of a measured tree writes it as it is"
          (str/includes? (:mei (qz/->score [:voice [:measure {:meter [3 4]} "c4/3"]] "q-")) "meter.count=\"3\""))

    ;; stage 4: voices
    (let [d (buffer nil [0 2 60] [2 4 59] [0 0.5 72] [0.5 1 74] [1 2 76] [2 4 77])
          q (qz/quantize d)]
      (t/eq "notes that overlap go to two voices, the higher first" (map (comp first mt/pitches) (nodes q :voice)) ["c5" "c4"])
      (t/eq "... sharing one staff" (distinct (map (comp :staff mt/attrs) (nodes q :voice))) ["voice 1"])
      (t/is "... written as two layers" (str/includes? (:mei (qz/->score d "v-")) "<layer n=\"2\""))
      (t/eq "... and :voices 1 keeps one voice (cutting)" (count (nodes (qz/quantize d {:voices 1}) :voice)) 1))
    (t/eq "notes that start and end together are a chord in one voice"
          (count (nodes (qz/quantize (buffer nil [0 4 64] [0 4 67] [0 1 60] [1 2 62])) :chord)) 1)
    (t/eq "two simultaneous notes of two moving lines go one to each"
          (count (nodes (qz/quantize (buffer nil [0 2 72] [0 1 60] [1 2 62] [2 4 74] [2 4 60])) :chord)) 0)
    (let [q (qz/quantize (buffer nil [4 8 57] [4 5 72] [5 5.33 71] [5.33 5.67 72] [5.67 6 74] [6 8 72]))
          low (last (nodes q :voice))]
      (t/eq "a note held through the other voice's triplet is not written in a triplet" (count (nodes low :tuplet)) 0))

    ;; nested divisions
    (let [q (qz/quantize (buffer nil [0 0.5 72] [0.5 0.667 74] [0.667 0.833 76] [0.833 1 77] [1 2 79]))]
      (t/eq "an eighth and a triplet of sixteenths" (map (comp :ratio mt/attrs) (nodes q :tuplet)) [[3 2]])
      (t/eq "... of sixteenths" (map (comp :dur mt/attrs) (mt/kids (first (nodes q :tuplet)))) [0.25 0.25 0.25])
      (t/eq "... and :nest false makes it one division of the beat"
            (map (comp :ratio mt/attrs) (nodes (qz/quantize (buffer nil [0 0.5 72] [0.5 0.667 74] [0.667 0.833 76] [0.833 1 77] [1 2 79]) {:nest false}) :tuplet))
            [[6 4]]))

    ;; stage 5: microtones and glissandi
    (let [mei (:mei (mt/->mei [:voice [:measure {:meter [2 4]} [:note {:pitch 60.5 :dur 1}] [:note {:pitch 61.5 :dur 1}]]] "m-"))]
      (t/is "a quarter tone above c is c quarter-sharp" (str/includes? mei "accid=\"1qs\""))
      (t/is "... and above c# three quarters sharp" (str/includes? mei "accid=\"3qs\"")))
    (let [bend {:gx nil :gy nil :strokes {:t1 {:pts [[0 (cv/midi->hz 72)] [1 (cv/midi->hz 72)] [2 (cv/midi->hz 70.9)]]}
                                         :t2 {:pts [[2 (cv/midi->hz 71)] [3 (cv/midi->hz 71)]]}
                                         :t3 {:pts [[3 (cv/midi->hz 67)] [4 (cv/midi->hz 69.5)]]}}}
          mei (:mei (qz/->score bend "g-"))]
      (t/is "a stroke that bends into the next note: a glissando line" (str/includes? mei "<gliss "))
      (t/is "... and one that bends into nothing: a text" (str/includes? mei "gliss. ")))

    ;; stage 6: other divisions, chosen and kept
    (let [d (buffer nil [0 0.36 60] [0.36 0.62 62] [0.62 1 64] [1 2 65] [2 4 67])
          ns (qz/strokes->notes d)
          ch (qz/choices ns (qz/options nil nil) 0.4)]
      (t/eq "the beat's current division is the quantizer's, first" [(:current ch) (first (:all ch))] [3 3])
      (t/is "... then others, and two beats together" (and (some #{4} (:all ch)) (some (fn [c] (and (vector? c) (= :merge (first c)))) (:all ch))))
      (t/is "... none placing the notes where another does (6 is not there: it puts them where 3 does)" (not (some #{6} (:all ch))))
      (t/eq ":fix chooses a division by hand" (map (comp :ratio mt/attrs) (nodes (qz/quantize d {:fix {0 4}}) :tuplet)) [])
      (let [{:keys [choice opts]} (qz/next-choice ns nil nil 0.4)]
        (t/eq "next-choice takes the next division and keeps it in :fix" [choice (:fix opts)] [(second (:all ch)) {0 (second (:all ch))}])
        (t/eq "... and the next one after it" (:choice (qz/next-choice ns opts nil 0.4)) (nth (:all ch) 2)))
      (t/eq "a choice that does not read is dropped" (qz/sane-fix {0 4 1 "x" -2 3 2 [:merge 3] 3 [2 3]}) {0 4 2 [:merge 3] 3 [2 3]}))
    (let [d (cv/step (buffer nil [0 1 60]) [:quantize {:meter "3/4" :nonsense 1}])]
      (t/eq "a freqt keeps its quantization options ([:quantize opts])" (:quant d) {:meter "3/4"})
      (t/eq "... nil goes back to the defaults" (:quant (cv/step d [:quantize nil])) nil)
      (t/eq "... they are part of its text" (:quant (cv/read-source cv/empty (cv/->source d))) {:meter "3/4"})
      (t/eq "... and of the difference between two buffers" (cv/diff (buffer nil [0 1 60]) d) [[:quantize {:meter "3/4"}]])
      (t/throws "a canvas has no :quant" (fn [] (cv/read-source cv/generic-empty "{:quant {:meter \"3/4\"} :strokes {}}"))))))

(t/run! "quantization: coherence across beats (issue #108)"
  (fn []
    (let [free (fn [ons dur] (into [:par] (map (fn [o] [:note {:at o :dur dur :pitch 60}]) ons)))
          tup? (fn [q] (boolean (re-find #":tuplet" (pr-str q))))
          late (free [0 0.5 1 1.62 2 2.5 3 3.5] 0.45)]
      (t/is "without coherence, one eighth played late makes its beat a triplet" (tup? (qz/quantize-tree late {:meter [4 4] :w {:coh 0}})))
      (t/is "with it (the default), a lone triplet among eighths stays eighths" (not (tup? (qz/quantize-tree late {:meter [4 4]}))))
      (t/eq "a run of triplets played loosely stays triplets"
            (mapv :t (mt/notes (qz/quantize-tree (free [0 0.34 0.66 1 1.33 1.68 2 2.34 2.66 3] 0.3) {:meter [4 4]})))
            [0 0.333333 0.666667 1 1.333333 1.666667 2 2.333333 2.666667 3])
      (t/eq "the kinds of division" (mapv qz/family [{:n 1} {:n 4} {:n 3 :tup [3 2]} {:n 5 :tup [5 4]} {:n 2 :parts [{:n 2} {:n 3 :tup [3 2]}]}])
            [:none :bin 3 5 3])
      (t/eq "... by the points the notes use: two eighths on a grid of six in two beats are binary"
            (qz/family {:n 6 :tup [6 4] :need 2 :L 2}) :bin)
      (t/is "after a bar of triplets, two eighths are not written as a tuplet"
            (let [q (qz/quantize-tree (into [:par] (map (fn [[o d]] [:note {:at o :dur d :pitch 60}]) [[0 0.95] [1.02 0.3] [1.36 0.3] [1.68 0.3] [2.03 0.95] [3 0.48] [3.52 0.45] [4 2]])) {:meter [3 4]})]
              (= 1 (count (re-seq #":tuplet" (pr-str q)))))))))
