;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · a benchmark for the quantizer (issue #105)
;;
;; A corpus of measured trees whose notation is known is "performed" (its notes moved in time and shortened
;; by a seeded generator, at several levels of imprecision), quantized back (kairotic.quantize), and compared
;; with what was written: onsets in place, durations, notes lost or added, tuplets that appear or disappear,
;; grace notes, and written names (pitch spelling, issue #88).
;;
;; The corpus here is Kairotic's own (MPL). Outside corpora (Essen, SymbTr) are fetched into a local cache by
;; tests/quantize-corpus/fetch.mjs and run by tests/quantize-corpus/bench.mjs, with this same code.
(ns kairotic.qbench
  (:require [clojure.string :as str]
            [kairotic.mt :as mt]
            [kairotic.quantize :as qz]
            [kairotic.test :as t]))

;; ───────── performing a tree ─────────

(defn rng
  "A seeded generator of numbers in [0, 1) (mulberry32): the same seed, the same performance."
  [seed]
  (let [a (atom (bit-or seed 0))]
    (fn []
      (swap! a (fn [x] (bit-or (+ x 0x6d2b79f5) 0)))
      (let [x @a
            t (js/Math.imul (bit-xor x (unsigned-bit-shift-right x 15)) (bit-or x 1))
            t (bit-xor t (+ t (js/Math.imul (bit-xor t (unsigned-bit-shift-right t 7)) (bit-or t 61))))]
        (/ (unsigned-bit-shift-right (bit-xor t (unsigned-bit-shift-right t 14)) 0) 4294967296)))))

(defn- gauss [r] (* (js/Math.sqrt (* -2 (js/Math.log (max 1e-12 (r))))) (js/Math.cos (* 2 js/Math.PI (r)))))

(def levels
  "How a tree is performed: :onset is the spread of its onsets (beats, Gaussian), :art how short its notes may be
   played (each between art × and 1 × its duration), :drift a slow wander of the beat (beats)."
  [[:exact {:onset 0 :art 1 :drift 0}]
   [:tight {:onset 0.02 :art 0.9 :drift 0}]
   [:loose {:onset 0.05 :art 0.75 :drift 0.03}]
   [:rough {:onset 0.08 :art 0.6 :drift 0.06}]])

(defn perform
  "The notes of a measured tree as free notes ([:par [:note {:at :dur :pitch}] …], pitches as numbers, without
   names), moved by a level of imprecision with a seed. A grace note is played short, just before its note."
  [tree {:keys [onset art drift]} seed]
  (let [r (rng seed)
        ns (mt/notes tree)
        ;; the drift: a smooth wander, the same for notes close in time
        ph (* 2 js/Math.PI (r))
        dr (fn [t] (* (or drift 0) (js/Math.sin (+ ph (* 0.4 t)))))
        out (for [n ns
                  :let [g (:grace n)
                        t (+ (:t n) (dr (:t n)) (* (or onset 0) (gauss r)))
                        at (if g (- t 0.08) t)
                        dur (if g 0.06 (* (:dur n) (+ art (* (- 1 art) (r)))))]]
              [:note {:at (max 0 (/ (js/Math.round (* at 1e4)) 1e4)) :dur (max 0.03 (/ (js/Math.round (* dur 1e4)) 1e4)) :pitch (:pitch n)}])]
    (into [:par] out)))

;; ───────── comparing ─────────

(defn- near? [a b eps] (< (js/Math.abs (- a b)) eps))
(defn dyadic? "An onset on a binary division of the beat (down to 1/64)?" [t] (let [x (* t 64)] (near? x (js/Math.round x) 1e-3)))

(defn compare-notes
  "What the quantized tree q keeps of the written tree w: counts of their notes, matched (same onset within 1e-3
   beat, same pitch within 5 cents), durations equal, written names equal (where w names them, without cents),
   onsets off the binary grid (tuplets) added or lost, and grace notes found again."
  [w q]
  (let [wn (mt/notes w) qn (mt/notes q)
        [wg wm] ((juxt filter remove) :grace wn)
        [qg qm] ((juxt filter remove) :grace qn)
        pool (atom (vec qm))
        take! (fn [n] (when-let [i (first (keep-indexed (fn [i x] (when (and (near? (:t x) (:t n) 1e-3) (near? (:pitch x) (:pitch n) 0.05)) i)) @pool))]
                        (let [x (nth @pool i)] (swap! pool (fn [p] (into (subvec p 0 i) (subvec p (inc i))))) x)))
        pairs (keep (fn [n] (when-let [x (take! n)] [n x])) wm)
        named (filter (fn [[n _]] (and (:name n) (== (:pitch n) (js/Math.round (:pitch n))))) pairs)
        wt (set (map (fn [n] (js/Math.round (* 1000 (:t n)))) (remove (comp dyadic? :t) wm)))
        qt (set (map (fn [n] (js/Math.round (* 1000 (:t n)))) (remove (comp dyadic? :t) qm)))]
    {:notes (count wm) :found (count qm) :matched (count pairs)
     :durs (count (filter (fn [[n x]] (near? (:dur n) (:dur x) 1e-3)) pairs))
     :named (count named) :names (count (filter (fn [[n x]] (= (:name n) (:name x))) named))
     :tuplets (count wt) :tuplets-added (count (remove wt qt)) :tuplets-lost (count (remove qt wt))
     :graces (count wg) :graces-found (count (filter (fn [g] (some (fn [x] (and (near? (:t x) (:t g) 1e-3) (near? (:pitch x) (:pitch g) 0.05))) qg)) wg))}))

(defn perfect?
  "Every note in place, with its duration, and nothing added."
  [m] (and (= (:matched m) (:notes m) (:found m) (:durs m))))

;; ───────── running ─────────

(defn piece-opts
  "The options of the quantizer for a piece: its meter (and groups), its key if asked, and any options
   given to the whole run (qopts: {:w {:coh 1}} …)."
  [{:keys [meter groups key]} key? qopts]
  (merge-with (fn [a b] (if (and (map? a) (map? b)) (merge a b) b))
              (cond-> {:meter meter} groups (assoc :groups groups) (and key? key) (assoc :key key))
              qopts))

(defn run-piece
  "One piece at one level and seed: the comparison, :ms the time it took, :error if the quantizer failed."
  [piece [lv cfg] seed {:keys [key? qopts]}]
  (let [w (mt/expand (:tree piece))
        p (perform w cfg seed)
        t0 (js/Date.now)]
    (try
      (let [q (qz/quantize-tree p (piece-opts piece key? qopts))]
        (assoc (compare-notes w q) :id (:id piece) :source (:source piece) :level lv :ms (- (js/Date.now) t0)))
      (catch :default e
        {:id (:id piece) :source (:source piece) :level lv :error (.-message e) :notes (count (remove :grace (mt/notes w)))}))))

(defn run-corpus
  "Every piece at every level, with seeds 1…seeds: a vector of results."
  ([corpus] (run-corpus corpus {}))
  ([corpus {:keys [seeds] :or {seeds 1} :as opts}]
   (vec (for [piece corpus lv levels s (range 1 (inc seeds))] (run-piece piece lv s opts)))))

(def ^:private sum-keys [:notes :found :matched :durs :named :names :tuplets :tuplets-added :tuplets-lost :graces :graces-found :ms])

(defn totals
  "The sums of results, with the rates: :onsets (matched / written), :precision (matched / found), :durations
   (equal / matched), :spelling (names equal / named), :perfect (pieces), :errors."
  [rs]
  (let [s (reduce (fn [acc r] (merge-with + acc (select-keys r sum-keys))) (zipmap sum-keys (repeat 0)) rs)
        rate (fn [a b] (if (pos? b) (/ (js/Math.round (* 1000 (/ a b))) 1000) nil))]
    (assoc s :pieces (count rs)
             :errors (count (filter :error rs))
             :perfect (rate (count (filter (fn [r] (and (not (:error r)) (perfect? r))) rs)) (count rs))
             :onsets (rate (:matched s) (:notes s))
             :precision (rate (:matched s) (:found s))
             :durations (rate (:durs s) (:matched s))
             :spelling (rate (:names s) (:named s)))))

(defn report
  "A table of the totals by source and level, as text (Markdown)."
  [rs]
  (let [pct (fn [x] (if (nil? x) "–" (str (.toFixed (* 100 x) 1) "%")))
        rows (for [[src by-src] (sort-by (comp str key) (group-by :source rs))
                   [lv _] levels
                   :let [xs (filter (fn [r] (= lv (:level r))) by-src) s (totals xs)]
                   :when (seq xs)]
               (str "| " (name src) " | " (name lv) " | " (:pieces s) " | " (pct (:perfect s)) " | " (pct (:onsets s)) " | "
                    (pct (:precision s)) " | " (pct (:durations s)) " | " (pct (:spelling s)) " | "
                    (:tuplets-added s) " / " (:tuplets-lost s) " | " (:graces-found s) " / " (:graces s) " | " (:errors s) " | "
                    (.toFixed (/ (:ms s) (max 1 (:pieces s))) 0) " |"))]
    (str/join "\n" (concat ["| source | level | runs | perfect | onsets | precision | durations | spelling | tuplets +/− | graces | errors | ms |"
                            "|---|---|---|---|---|---|---|---|---|---|---|---|"]
                           rows))))

;; ───────── Kairotic's own corpus ─────────
;; Small cases, each about one thing the quantizer has to get right. MPL, like the rest of the repository.

(def own
  [{:id "quarters" :meter [4 4] :tree [:voice [:measure {:meter [4 4]} "c4/1 d4 e4 f4"] [:measure "g4/2 g4/2"]]}
   {:id "eighths" :meter [4 4] :tree [:voice [:measure {:meter [4 4]} "c4/.5 d4 e4 f4 g4 a4 b4 c5"] [:measure "c5/4"]]}
   {:id "dotted" :meter [4 4] :tree [:voice [:measure {:meter [4 4]} "c4/1.5 d4/.5 e4/1.5 f4/.5"] [:measure "g4/.75 a4/.25 b4/1 c5/2"]]}
   {:id "syncopation" :meter [4 4] :tree [:voice [:measure {:meter [4 4]} "c4/.5 d4/1 e4/1 f4/1 g4/.5"] [:measure "a4/1 b4/.5 c5/1.5 r/1"]]}
   {:id "triplets" :meter [4 4] :tree [:voice [:measure {:meter [4 4]} [:tuplet {:ratio [3 2]} "c4/.5 d4 e4"] "f4/1" [:tuplet {:ratio [3 2]} "g4/.5 a4 b4"] "c5/1"]
                                       [:measure "c5/2" [:tuplet {:ratio [3 2]} "b4/1 a4 g4"]]]}
   {:id "sixteenths" :meter [2 4] :tree [:voice [:measure {:meter [2 4]} "c4/.25 d4 e4 f4 g4/.5 a4/.5"] [:measure "b4/.25 c5 b4 a4 g4/1"]]}
   {:id "eighth and triplet sixteenths" :meter [2 4] :tree [:voice [:measure {:meter [2 4]} "c4/.5" [:tuplet {:ratio [3 2]} "d4/.25 e4 f4"] "g4/1"] [:measure "a4/2"]]}
   {:id "6/8" :meter [6 8] :tree [:voice [:measure {:meter [6 8]} "c4/1 d4/.5 e4/1 f4/.5"] [:measure "g4/1.5 a4/.5 b4 c5"] [:measure "c5/3"]]}
   {:id "waltz with a tie" :meter [3 4] :tree [:voice [:measure {:meter [3 4]} "c4/1 e4 g4"] [:measure [:note {:pitch "c5" :dur 3 :tie true}]] [:measure "c5/1 b4 a4"] [:measure "g4/3"]]}
   {:id "7/8 2+2+3" :meter [7 8] :groups [2 2 3] :tree [:voice [:measure {:meter "7/8[2+2+3]"} "c4/.5 d4 e4 f4 g4/1.5"] [:measure "a4/1 g4/1 f4/.5 e4 d4"]]}
   {:id "5/8 3+2" :meter [5 8] :groups [3 2] :tree [:voice [:measure {:meter "5/8[3+2]"} "c4/1.5 d4/1"] [:measure "e4/.5 f4 g4 a4/1"]]}
   {:id "rests" :meter [4 4] :tree [:voice [:measure {:meter [4 4]} "r/.5 c4/.5 d4/1 r/1 e4/1"] [:measure "f4/.5 r/.5 g4/2 r/1"]]}
   {:id "grace note" :meter [4 4] :tree [:voice [:measure {:meter [4 4]} "c4/1" [:note {:pitch "e4" :dur 0.25 :grace true}] "d4/1 e4/2"] [:measure "f4/4"]]}
   {:id "quintuplet" :meter [4 4] :tree [:voice [:measure {:meter [4 4]} [:tuplet {:ratio [5 4]} "c4/.25 d4 e4 f4 g4"] "a4/1 b4/2"] [:measure "c5/4"]]}
   {:id "two voices" :meter [4 4] :tree [:par [:voice [:measure {:meter [4 4]} "e5/2 d5/2"] [:measure "c5/4"]]
                                         [:voice [:measure {:meter [4 4]} "c4/1 g3 c4 g3"] [:measure "c4/4"]]]}
   {:id "chords" :meter [4 4] :tree [:voice [:measure {:meter [4 4]} "c4+e4+g4/2 d4+f4+a4/2"] [:measure "e4+g4+c5/4"]]}
   {:id "chromatic line" :meter [4 4] :tree [:voice [:measure {:meter [4 4]} "c4/.5 c#4 d4 d#4 e4 eb4 d4 db4"] [:measure "c4/4"]]}
   {:id "pickup" :meter [3 4] :tree [:voice [:measure {:meter [3 4]} "r/2 g4/1"] [:measure "c5/1 b4/.5 a4 g4/1"] [:measure "e4/3"]]}
   {:id "tie over the barline" :meter [4 4] :tree [:voice [:measure {:meter [4 4]} "c4/2" [:note {:pitch "d4" :dur 2 :tie true}]] [:measure "d4/1 e4/3"]]}
   {:id "in E flat" :meter [4 4] :key "eb" :tree [:voice {:key "eb"} [:measure {:meter [4 4]} "eb4/1 f4/.5 g4 ab4/1 bb4"] [:measure "c5/.5 bb4 ab4 g4 f4/2"]]}])

(defn own-corpus [] (mapv (fn [p] (assoc p :source :own)) own))

;; ───────── the unit test ─────────
;; Thresholds a little below what the quantizer reaches now: a change that makes it worse fails here; one that
;; makes it better can raise them. (The full table: tests/quantize-corpus/bench.mjs.)

(t/run! "quantization benchmark (own corpus)"
  (fn []
    (let [rs (run-corpus (own-corpus) {:seeds 3})
          at (fn [lv] (totals (filter (fn [r] (= lv (:level r))) rs)))
          exact (at :exact) tight (at :tight) loose (at :loose)]
      (t/eq "no piece makes the quantizer fail" (vec (keep (fn [r] (when (:error r) [(:id r) (:error r)])) rs)) [])
      (t/is (str "played exactly, every piece comes back as written (" (:perfect exact) ")") (>= (:perfect exact) 1))
      (t/is (str "played tightly: onsets " (:onsets tight) ", durations " (:durations tight)) (and (>= (:onsets tight) 0.97) (>= (:durations tight) 0.9)))
      (t/is (str "played loosely: onsets " (:onsets loose)) (>= (:onsets loose) 0.85))
      (t/is (str "spelling of the written names, played exactly: " (:spelling exact)) (>= (:spelling exact) 0.95))
      (t/is "the report is a table" (str/starts-with? (report rs) "| source |")))))
