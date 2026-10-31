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
            [kairotic.tempo :as tm]
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

(def tempo-levels
  "How a tree is performed in time (issue #106): at a tempo of 60 to 150 bpm drawn by the seed, in seconds, its
   tempo bending (:bend, a slow wave, ± that share), held back at the end (:rit, that share slower over the last
   four beats), with onsets spread by :onset beats and notes played :art to 1 × their length."
  [[:steady {:onset 0.015 :art 0.9 :bend 0 :rit 0}]
   [:rubato {:onset 0.03 :art 0.85 :bend 0.06 :rit 0.15}]
   [:free {:onset 0.05 :art 0.75 :bend 0.12 :rit 0.25}]])

(defn perform-timed
  "The notes of a measured tree played in time (see tempo-levels), in seconds from the first note (which comes
   0.3 s in): {:perf [:par [:note {:at :dur :pitch}] …] :bpm the mean tempo (quarters per minute)}."
  [tree {:keys [onset art bend rit]} seed]
  (let [r (rng (+ 1000 seed))
        bpm (+ 60 (* 90 (r))) ph (* 2 js/Math.PI (r))
        ns (mt/notes tree)
        B (+ 4 (reduce max 0 (map (fn [n] (+ (:t n) (:dur n))) ns)))
        f (fn [b] (* (+ 1 (* bend (js/Math.sin (+ ph (/ (* 2 js/Math.PI b) 12)))))
                     (- 1 (* rit (max 0 (min 1 (/ (- b (- B 8)) 4)))))))
        step 0.05
        table (vec (reductions + 0 (map (fn [i] (* step (/ 60 (* bpm (f (* (+ i 0.5) step)))))) (range (js/Math.ceil (/ (+ B 4) step))))))
        sec (fn [b] (let [x (/ (max 0 b) step) i (min (- (count table) 2) (js/Math.floor x))]
                      (+ (table i) (* (- x i) (- (table (inc i)) (table i))))))
        t0 (- (sec (or (some (fn [n] (when-not (:grace n) (:t n))) ns) 0)) 0.3)
        out (for [n ns
                  :let [g (:grace n)
                        tb (+ (:t n) (* (or onset 0) (gauss r)))
                        on (if g (- (sec (:t n)) 0.05) (sec tb))
                        off (if g (+ on 0.04) (sec (+ tb (* (:dur n) (+ art (* (- 1 art) (r)))))))]]
              [:note {:at (/ (js/Math.round (* (- on t0) 1e4)) 1e4) :dur (max 0.02 (/ (js/Math.round (* (- off on) 1e4)) 1e4)) :pitch (:pitch n)}])
        last-b (reduce max 0 (map (fn [n] (+ (:t n) (:dur n))) ns))]
    {:perf (into [:par] out)
     :bpm (* 60 (/ last-b (max 1e-6 (- (sec last-b) (sec 0)))))}))

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

(defn- tempo-check
  "How the tempo found compares with the one played: :tempo-ok within 6 %, :tempo-octave when it is half, double,
   two thirds or three halves of it (the beat found at another level)."
  [found played]
  (let [x (/ found played) near (fn [k] (< (js/Math.abs (- x k)) (* 0.06 k)))]
    {:tempo-ok (near 1) :tempo-octave (boolean (some near [0.5 2 (/ 2 3) 1.5 (/ 1 3) 3]))}))

(defn run-piece
  "One piece at one level and seed: the comparison, :ms the time it took, :error if the quantizer failed. With
   :timed? (a level of tempo-levels), the piece is played in seconds and quantized through the beats found
   (:time :track), and the tempo found is checked against the one played."
  [piece [lv cfg] seed {:keys [key? qopts timed?]}]
  (let [w (mt/expand (:tree piece))
        {:keys [perf bpm]} (if timed? (perform-timed w cfg seed) {:perf (perform w cfg seed)})
        t0 (js/Date.now)]
    (try
      (let [q (qz/quantize-tree perf (cond-> (piece-opts piece key? qopts) timed? (assoc :time :track)))]
        (cond-> (assoc (compare-notes w q) :id (:id piece) :source (:source piece) :level lv :ms (- (js/Date.now) t0))
          timed? (merge {:tempo-played bpm :tempo-found (:tempo (mt/attrs q))} (tempo-check (:tempo (mt/attrs q)) bpm))))
      (catch :default e
        {:id (:id piece) :source (:source piece) :level lv :error (.-message e) :notes (count (remove :grace (mt/notes w)))}))))

(defn run-corpus
  "Every piece at every level, with seeds 1…seeds: a vector of results."
  ([corpus] (run-corpus corpus {}))
  ([corpus {:keys [seeds timed?] :or {seeds 1} :as opts}]
   (vec (for [piece corpus lv (if timed? tempo-levels levels) s (range 1 (inc seeds))] (run-piece piece lv s opts)))))

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
             :spelling (rate (:names s) (:named s))
             :tempo (let [ts (filter :tempo-played rs)] (rate (count (filter :tempo-ok ts)) (count ts)))
             :octave (let [ts (filter :tempo-played rs)] (rate (count (filter :tempo-octave ts)) (count ts))))))

(defn report
  "A table of the totals by source and level, as text (Markdown)."
  [rs]
  (let [pct (fn [x] (if (nil? x) "–" (str (.toFixed (* 100 x) 1) "%")))
        rows (for [[src by-src] (sort-by (comp str key) (group-by :source rs))
                   [lv _] (concat levels tempo-levels)
                   :let [xs (filter (fn [r] (= lv (:level r))) by-src) s (totals xs)]
                   :when (seq xs)]
               (str "| " (name src) " | " (name lv) " | " (:pieces s) " | " (pct (:perfect s)) " | " (pct (:onsets s)) " | "
                    (pct (:precision s)) " | " (pct (:durations s)) " | " (pct (:spelling s)) " | "
                    (:tuplets-added s) " / " (:tuplets-lost s) " | " (:graces-found s) " / " (:graces s) " | " (:errors s) " | "
                    (pct (:tempo s)) " | " (pct (:octave s)) " | " (.toFixed (/ (:ms s) (max 1 (:pieces s))) 0) " |"))]
    (str/join "\n" (concat ["| source | level | runs | perfect | onsets | precision | durations | spelling | tuplets +/− | graces | errors | tempo | tempo ×½ ×2 ×⅔… | ms |"
                            "|---|---|---|---|---|---|---|---|---|---|---|---|---|---|"]
                           rows))))

;; ───────── real performances: the beats found against the beats annotated (ASAP, issue #106) ─────────

(defn f-measure
  "How well times found match times annotated: each annotated time matched by at most one found time within
   tol seconds (MIREX uses 70 ms). {:f :p :r}."
  [found annotated tol]
  (let [pool (atom (vec (sort found)))
        hits (count (filter (fn [a] (when-let [i (first (keep-indexed (fn [i x] (when (<= (js/Math.abs (- x a)) tol) i)) @pool))]
                                      (swap! pool (fn [p] (into (subvec p 0 i) (subvec p (inc i))))) true))
                            annotated))
        p (if (seq found) (/ hits (count found)) 0) r (if (seq annotated) (/ hits (count annotated)) 0)]
    {:f (if (pos? (+ p r)) (/ (* 2 p r) (+ p r)) 0) :p p :r r}))

(defn run-performed
  "One real performance ({:notes [[on off midi] …] seconds, :beats, :downbeats annotated, :meter}): the time map
   the quantizer finds (:time :track), its beats taken at the level of the annotated ones (as many to the bar),
   and compared with them: beat and downbeat F-measures (70 ms), and the tempo found over the one annotated."
  [{:keys [id notes beats downbeats meter]} qopts]
  (let [ns (mapv (fn [[a b m v]] {:on a :off b :attrs (cond-> {:pitch m} v (assoc :vel v))}) notes)
        t0 (js/Date.now)
        o (qz/options (merge {:meter meter :time :track} qopts) nil)
        m (qz/time-map-of ns o)
        ms (- (js/Date.now) t0)
        {[p q] :meter} (:meter o) BL (* p (/ 4 q))
        per-bar (let [ds (vec downbeats)
                      ks (for [[a b] (partition 2 1 ds)] (count (filter (fn [t] (and (>= t (- a 1e-3)) (< t (- b 1e-3)))) beats)))]
                  (if (seq ks) (nth (vec (sort ks)) (quot (count ks) 2)) p))
        ub (/ BL (max 1 per-bar))
        lo (- (first beats) 0.5) hi (+ (peek (vec beats)) 0.5)]
    (if-not m
      {:id id :source :asap :error "no beats found" :beat-f 0 :down-f 0}
      (let [b0 (tm/->beat m lo) b1 (tm/->beat m hi)
            at (fn [unit] (filter (fn [t] (<= lo t hi)) (map (fn [k] (tm/->time m (* k unit))) (range (js/Math.ceil (/ b0 unit)) (inc (js/Math.floor (/ b1 unit)))))))
            ann-tempo (let [ds (map (fn [[a b]] (- b a)) (partition 2 1 beats))] (* 60 (/ ub (nth (vec (sort ds)) (quot (count ds) 2)))))
            found-tempo (tm/tempo-of-map m)]
        {:id id :source :asap :ms ms :meter [p q]
         :beat-f (:f (f-measure (at ub) beats 0.07))
         ;; the same at any metric level (as MIREX's AMLt): the beats found halved, doubled, in thirds,
         ;; tripled (with each phase), so that following the pulse can be told from choosing its level
         :beat-f-any (reduce max (for [[k ph] [[1 0] [0.5 0] [2 0] [2 1] [(/ 1 3) 0] [3 0] [3 1] [3 2]]]
                                   (:f (f-measure (map (fn [t] t) (filter (fn [t] (<= lo t hi))
                                                                          (map (fn [i] (tm/->time m (* (+ (* i k) (* ph 1)) ub)))
                                                                               (range (js/Math.ceil (/ (- (/ b0 ub) ph) k)) (inc (js/Math.floor (/ (- (/ b1 ub) ph) k)))))))
                                                  beats 0.07))))
         :down-f (:f (f-measure (at BL) downbeats 0.07))
         :tempo-ratio (/ found-tempo ann-tempo)}))))

(defn performed-report
  "The beat tracking of real performances, as a table (Markdown): the mean beat and downbeat F-measures, how often
   the tempo is found (within 6 %) or found at another level (½, 2, ⅔, 3/2…)."
  [rs]
  (let [n (count rs) mean (fn [k] (/ (reduce + (map k rs)) (max 1 n)))
        pct (fn [x] (str (.toFixed (* 100 x) 1) "%"))
        ok (count (filter (fn [r] (when-let [x (:tempo-ratio r)] (< (js/Math.abs (- x 1)) 0.06))) rs))
        oct (count (filter (fn [r] (when-let [x (:tempo-ratio r)] (some (fn [k] (< (js/Math.abs (- x k)) (* 0.06 k))) [0.5 2 (/ 2 3) 1.5 (/ 1 3) 3 0.25 4]))) rs))]
    (str "| performances | beat F (70 ms) | beat F, any level | downbeat F | tempo | tempo at another level | ms |\n|---|---|---|---|---|---|---|\n"
         "| " n " | " (pct (mean :beat-f)) " | " (pct (mean (fn [r] (or (:beat-f-any r) 0)))) " | " (pct (mean :down-f)) " | " (pct (/ ok (max 1 n))) " | " (pct (/ oct (max 1 n))) " | " (.toFixed (mean (fn [r] (or (:ms r) 0))) 0) " |")))

;; ───────── sung notes: what transcribe writes against a manual transcription (cante2midi, issue #106) ─────────

(defn- cents [hz midi] (* 100 (- (+ 69 (* 12 (/ (js/Math.log (/ hz 440)) js/Math.LN2))) midi)))

(defn note-f
  "How well notes found ([on dur hz]) match notes transcribed by hand ([on dur midi]), as in MIREX note
   tracking: each manual note matched by at most one found note, the nearest onset first. :on onsets within
   tol (50 ms); :pitch also the pitch within 50 cents; :off also the offset within 20 % of the note (50 ms at
   least). {:on {:f :p :r} :pitch … :off …}."
  [found truth tol]
  (let [score (fn [ok?]
                (let [fs (vec (sort-by first found))
                      used (atom #{})
                      hits (count (filter (fn [[a :as ref]]
                                            (when-let [i (->> (range (count fs))
                                                              (filter (fn [i] (and (not (@used i)) (<= (js/Math.abs (- (first (fs i)) a)) tol) (ok? (fs i) ref))))
                                                              (sort-by (fn [i] (js/Math.abs (- (first (fs i)) a))))
                                                              first)]
                                              (swap! used conj i) true))
                                          truth))
                      p (if (seq found) (/ hits (count found)) 0) r (if (seq truth) (/ hits (count truth)) 0)]
                  {:f (if (pos? (+ p r)) (/ (* 2 p r) (+ p r)) 0) :p p :r r}))
        pitch? (fn [[_ _ hz] [_ _ m]] (<= (js/Math.abs (cents hz m)) 50))
        off? (fn [[a d] [b e]] (<= (js/Math.abs (- (+ a d) (+ b e))) (max 0.05 (* 0.2 e))))]
    {:on (score (constantly true)) :pitch (score pitch?) :off (score (fn [x y] (and (pitch? x y) (off? x y))))}))

(defn transcribed
  "The notes transcribe (its component map, d) writes from an f0 ([t0 dt [hz …]], 0 where no voice), heard as
   pitch~ would send it, at 60 bpm (beats are seconds): [[on dur hz] …]. args override its own."
  [d [t0 dt hzs] args]
  (let [rcv (:receive d)
        args (merge {:bpm 60 :mode nil :min-ms 60} args)
        step (fn [[st outs] m] (let [r (rcv (assoc m :state st :args args))]
                                 [(if (contains? r :state) (:state r) st) (into outs (map second (:out r)))]))
        ;; pitch~ sends only what changes
        [st outs] (reduce (fn [acc [i hz]] (step acc {:inlet 0 :value hz :at (+ t0 (* i dt))}))
                          (step [nil []] {:inlet 0 :value :rec :at 0})
                          (keep-indexed (fn [i hz] (when (or (zero? i) (not= hz (nth hzs (dec i)))) [i hz])) hzs))
        [_ outs] (step [st outs] {:inlet 0 :value :stop :at (+ t0 (* (count hzs) dt))})]
    (->> outs
         (mapcat (fn [[k edits]] (when (= k :batch) edits)))
         (keep (fn [[k pts]] (when (= k :stroke) (let [[[a hz]] pts [b] (peek pts)] [a (- b a) hz]))))
         (sort-by first) vec)))

(defn run-transcribed
  "One sung piece ({:truth :auto :f0}): what transcribe writes from its f0 against the manual transcription,
   and the authors' automatic transcription against it too, for reference."
  [{:keys [id truth auto f0]} d args]
  (let [t0 (js/Date.now)
        ns (transcribed d f0 args)
        ms (- (js/Date.now) t0)
        as-hz (fn [ns] (mapv (fn [[a b m]] [a b (* 440 (js/Math.pow 2 (/ (- m 69) 12)))]) ns))]
    {:id id :source :cante2midi :ms ms :notes (count ns) :truth (count truth)
     :ours (note-f ns truth 0.05)
     :auto (when (seq auto) (note-f (as-hz auto) truth 0.05))}))

(defn transcribed-report
  "Note tracking of sung pieces, as a table (Markdown): mean F-measures of onsets, onsets and pitch, and with
   offsets too, for transcribe and for the reference transcription."
  [rs]
  (let [n (count rs)
        mean (fn [k path] (/ (reduce + (map (fn [r] (or (get-in r [k path :f]) 0)) rs)) (max 1 n)))
        pct (fn [x] (str (.toFixed (* 100 x) 1) "%"))
        row (fn [label k] (str "| " label " | " (pct (mean k :on)) " | " (pct (mean k :pitch)) " | " (pct (mean k :off)) " |"))]
    (str "| " n " pieces · " (reduce + (map :truth rs)) " notes (" (reduce + (map :notes rs)) " written) | onset F (50 ms) | + pitch (50 ¢) | + offset |\n|---|---|---|---|\n"
         (row "transcribe (from the f0)" :ours) "\n"
         (row "automatic transcription of cante2midi" :auto))))

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

(t/run! "note tracking measure (cante2midi, issue #106)"
  (fn []
    (let [truth [[1 0.5 60] [2 0.5 62] [3 1 64]]
          hz (fn [m] (* 440 (js/Math.pow 2 (/ (- m 69) 12))))
          r (note-f [[1.03 0.5 (hz 60)] [2.01 0.5 (hz 63)] [3 0.4 (hz 64)] [4 1 (hz 65)]] truth 0.05)]
      (t/eq "onsets within 50 ms; with pitch within 50 cents; with offsets within 20 %"
            (mapv (fn [k] [(get-in r [k :p]) (get-in r [k :r])]) [:on :pitch :off]) [[0.75 1] [0.5 (/ 2 3)] [0.25 (/ 1 3)]]))))
