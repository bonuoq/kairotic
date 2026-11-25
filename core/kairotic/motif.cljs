;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · motif: what comes back, and how it is related (discussion: one motive layer; issue #108, #309)
;; The vocabulary of Study 60's motif.mjs, in the core, for every part of Kairotic that looks for what comes back:
;; the quantizer (a rhythm played several times), analysis (a melody's motive), and later the engines (#353).
;;
;;   a note        {:on :dur :d :semi :name}: :d diatonic (7 · octave + letter, independent of key), :semi MIDI; on and
;;                 dur in any unit (beats as written, or seconds as played)
;;   viewpoints    the diatonic intervals (steps), the chromatic ones (semitones), the contour (+1, 0, −1), the rhythm
;;                 (each duration over the first's) and the onsets (each inter-onset interval over the first's), after
;;                 Conklin's multiple viewpoints and Lartillot
;;   a relation    first an exact transformation, named: a repetition, a transposition (real) or a sequence (diatonic),
;;                 an inversion, a retrograde, a retrograde inversion, each with its rhythm kept, augmented, diminished
;;                 or changed; else a weighted edit distance over the intervals, the contour and the rhythm, which gives
;;                 a kinship (0 … 1) and the dimensions kept
;;   played time   rhythms compared by their onsets (how long a note is held is articulation) within a tolerance (:tol,
;;                 in octaves of ratio: 0.15 ≈ 11 %), so that what was played a little differently is still the same; `returns` groups spans whose onsets fall at the same places
;;   kinship       its sweet spot (0.65 … 0.9: coherence without literal repetition), and the memory of the work
;; Pure functions on data.

(ns kairotic.motif
  (:require [clojure.string :as str]
            [kairotic.spell :as sp]
            [kairotic.mt :as mt]))

(defn- sign [x] (cond (pos? x) 1 (neg? x) -1 :else 0))
(defn- log2 [x] (/ (js/Math.log x) js/Math.LN2))
(defn- r2 [x] (/ (js/Math.round (* 100 x)) 100))

;; ───────── notes ─────────

(defn pitch-of
  "A pitch — a name (\"C5\", \"bb3\") or a MIDI number (spelled with the fewest alterations, a sharp before a flat) —
   as {:d :semi :name}."
  [p]
  (let [s (cond (number? p) (let [m (js/Math.round p)] (first (sort-by (fn [x] [(js/Math.abs (:alter x)) (- (:alter x))]) (sp/spellings m))))
                :else (sp/parse p))]
    (when-not s (throw (js/Error. (str "not a pitch: " p))))
    {:d (+ (* 7 (:oct s)) (:step s)) :semi (sp/->midi s)
     :name (str (str/upper-case (nth sp/letters (:step s))) (sp/acc-str (:alter s)) (:oct s))}))

(defn notes-of
  "Notes from a melody written a unit a name (\"G4 C5 C5 B4\": a name written again is the note held, longer), or from
   notes [{:on :dur :pitch}] / [[on dur pitch] …] in any unit (as played, in seconds; or as written, in beats)."
  ([melody] (notes-of melody 0))
  ([melody start]
   (if (string? melody)
     (let [names (remove str/blank? (str/split (str/trim melody) #"[\s,]+"))]
       (reduce (fn [out [t nm]]
                 (let [lst (peek out)]
                   (if (and lst (= (:name lst) (:name (pitch-of nm))))
                     (conj (pop out) (update lst :dur inc))
                     (conj out (merge (pitch-of nm) {:on (+ start t) :dur 1})))))
               [] (map-indexed vector names)))
     (vec (sort-by :on (map (fn [n] (if (vector? n)
                                      (let [[on dur p] n] (merge (pitch-of p) {:on on :dur dur}))
                                      (merge (pitch-of (:pitch n)) {:on (or (:on n) (:t n)) :dur (:dur n)})))
                            melody))))))

(defn views
  "The viewpoints of notes: {:dia :chro :contour :rhythm (durations over the first's) :ioi (onset intervals over the first's)}."
  [ns]
  (let [ps (partition 2 1 ns)
        iois (map (fn [[a b]] (- (:on b) (:on a))) ps)]
    {:dia (mapv (fn [[a b]] (- (:d b) (:d a))) ps)
     :chro (mapv (fn [[a b]] (- (:semi b) (:semi a))) ps)
     :contour (mapv (fn [[a b]] (sign (- (:d b) (:d a)))) ps)
     :rhythm (mapv (fn [n] (/ (:dur n) (:dur (first ns)))) ns)
     :ioi (let [f (first iois)] (if (and f (pos? f)) (mapv (fn [x] (/ x f)) iois) []))}))

(defn- eqv [a b] (and (= (count a) (count b)) (every? true? (map (fn [x y] (< (js/Math.abs (- x y)) 1e-9)) a b))))

(def ^:private step-names ["the same pitch" "a 2nd" "a 3rd" "a 4th" "a 5th" "a 6th" "a 7th" "an octave"])

(defn shift-name
  "A diatonic shift in words: \"a 3rd lower\", \"a step higher\", \"an octave lower\", \"at the same pitch\"."
  [s]
  (if (zero? s)
    "at the same pitch"
    (let [a (js/Math.abs s)
          w (cond (= a 1) "a step"
                  (<= a 7) (nth step-names a)
                  (zero? (mod a 7)) (str (/ a 7) " octaves")
                  :else (str (nth step-names (mod a 7)) " and an octave"))]
      (str w " " (if (pos? s) "higher" "lower")))))

;; how close each exact relation is to the motive heard as itself
(def ^:private exact-kinship {:repetition 1 :transposition 0.85 :sequence 0.85 :inversion 0.75 :retrograde 0.7 :retrograde-inversion 0.65})

(defn exact
  "The exact transformation that takes notes M to notes S (as many), or nil: {:kind :shift :rhythm :name :kinship}.
   tol: how far each duration's ratio may be from the motive's (in octaves; 0 for written notes, ~0.15 for played)."
  ([M S] (exact M S 0))
  ([M S tol]
   (when (and (= (count M) (count S)) (>= (count M) 2))
     (let [a (views M) b (views S) shift (- (:d (first S)) (:d (first M)))
           kind (cond (eqv (:dia a) (:dia b)) (if (eqv (:chro a) (:chro b)) (if (zero? shift) :repetition :transposition) :sequence)
                      (eqv (:dia a) (mapv - (:dia b))) :inversion
                      (eqv (:dia a) (mapv - (reverse (:dia b)))) :retrograde
                      (eqv (:dia a) (vec (reverse (:dia b)))) :retrograde-inversion
                      :else nil)]
       (when kind
         ;; the rhythm: kept, augmented (×2), diminished (×½) or another (read backwards for a retrograde); as played
         ;; (tol > 0) by the time from one onset to the next, since how long each note is held is the player's articulation
         (let [rh (fn [ns] (if (pos? tol) (map (fn [[a b]] (- (:on b) (:on a))) (partition 2 1 ns)) (map :dur ns)))
               md (rh M) sd (rh S)
               sdr (if (#{:retrograde :retrograde-inversion} kind) (reverse sd) sd)
               ratio (/ (first sdr) (first md))
               same (every? (fn [[x m]] (<= (js/Math.abs (log2 (/ (/ x m) ratio))) (+ tol 1e-9))) (map vector sdr md))
               near (fn [k] (<= (js/Math.abs (log2 (/ ratio k))) (+ tol 1e-9)))
               rhythm (cond (not same) :another (near 1) :kept (near 2) :augmented (near 0.5) :diminished :else :scaled)
               kind (if (and (= kind :repetition) (not= rhythm :kept)) :sequence kind)
               nm (str/join ", " (remove nil? [(cond (and (= kind :sequence) (zero? shift)) "a variant at the same pitch"
                                                       :else (case kind :repetition "repeated" :transposition "transposed" :sequence "in sequence"
                                                                   :inversion "inverted" :retrograde "backwards" :retrograde-inversion "backwards and inverted"))
                                                 (when-not (or (= kind :repetition) (and (= kind :sequence) (zero? shift))) (shift-name shift))
                                                 (case rhythm :kept nil :another "in another rhythm" :scaled (str "×" (r2 ratio)) (name rhythm))]))]
           {:kind kind :shift shift :rhythm rhythm :name nm :exact true
            :kinship (r2 (* (exact-kinship kind) (case rhythm :kept 1 :another 0.85 0.95)))}))))))

(defn- edit
  "A weighted edit distance (0 … 1, normalized) between two sequences, with a substitution cost sub."
  [a b sub]
  (let [n (count a) m (count b)]
    (if (and (zero? n) (zero? m))
      0
      (let [last-row (reduce (fn [prev i]
                               (reduce (fn [cur j]
                                         (conj cur (min (inc (prev j)) (inc (peek cur))
                                                        (+ (prev (dec j)) (sub (nth a (dec i)) (nth b (dec j)))))))
                                       [i] (range 1 (inc m))))
                             (vec (range (inc m))) (range 1 (inc n)))]
        (/ (peek last-row) (max n m))))))

;; an interval for another: nothing if the same, less when the same way and near, most the other way
(defn- sub-interval [x y] (cond (= x y) 0 (= (sign x) (sign y)) (min 1 (+ 0.25 (* 0.15 (js/Math.abs (- x y))))) :else 1))
(defn- sub-rhythm [x y] (min 1 (js/Math.abs (- (log2 x) (log2 y)))))

(defn relate
  "How S is related to M: the exact transformation if there is one, else a kinship by the weighted edit distances:
   {:kinship :exact :name :kept [:intervals :contour :rhythm …]}."
  ([M S] (relate M S 0))
  ([M S tol]
   (if-let [x (exact M S tol)]
     (assoc x :kept (into [:intervals :contour] (when (#{:kept :augmented :diminished} (:rhythm x)) [:rhythm])))
     (let [a (views M) b (views S)
           dI (edit (:dia a) (:dia b) sub-interval)
           dC (edit (:contour a) (:contour b) (fn [p q] (if (= p q) 0 1)))
           dR (edit (:rhythm a) (:rhythm b) sub-rhythm)
           kept (vec (remove nil? [(when (< dI 0.25) :intervals) (when (< dC 0.25) :contour) (when (< dR 0.25) :rhythm)]))]
       {:kinship (r2 (max 0 (- 1 (+ (* 0.5 dI) (* 0.25 dC) (* 0.25 dR))))) :exact false :kept kept
        :name (if (seq kept) (str "its " (str/join " and " (map name kept)) " kept") "loosely")}))))

(defn find-in
  "The span of notes ns most related to motive M — the whole motive, or its head or its tail (all but its last or its
   first note: a fragment) —: {:from :to (the first note's :on, the last's end) :notes :kinship :exact :name :kept :part},
   or nil. A fragment counts a little less (×0.9), a window one note longer or shorter than the motive less still (−0.05).
   only: :head or :tail, to look for that fragment alone."
  ([M ns] (find-in M ns {}))
  ([M ns {:keys [only tol] :or {tol 0}}]
   (let [M (vec M) ns (vec ns)
         parts (concat (when-not only [[nil M]])
                       (when (>= (count M) 4) (filter (fn [[k]] (or (nil? only) (= only k))) [[:head (pop M)] [:tail (subvec M 1)]])))
         cands (for [[part P] parts
                     len [(count P) (dec (count P)) (inc (count P))]
                     :when (and (>= len 2) (<= len (count ns)) (or (nil? part) (= len (count P))))
                     i (range (inc (- (count ns) len)))
                     :let [S (subvec ns i (+ i len)) r (relate P S tol)
                           k (max 0 (- (* (:kinship r) (if part 0.9 1)) (if (not= len (count P)) 0.05 0)))]]
                 (assoc r :part part :kinship (r2 k) :score (+ k (if (:exact r) 0.001 0))
                        :name (if part (str "its " (name part) ", " (:name r)) (:name r))
                        :from (:on (first S)) :to (+ (:on (peek S)) (:dur (peek S))) :notes (mapv :name S)))]
     (when (seq cands) (dissoc (apply max-key :score (reverse cands)) :score)))))

(defn discover
  "The motive of notes: the span of 3 to 5 notes that recurs most (exactly transformed, not overlapping), earliest
   first; or, none recurring, its head (the first 4 notes, or fewer). {:from :to :notes :why}."
  ([ns] (discover ns 0))
  ([ns tol]
   (let [ns (vec (if (string? ns) (notes-of ns) ns))
         best (reduce (fn [best [len i]]
                        (let [M (subvec ns i (+ i len))
                              hits (reduce (fn [hits j]
                                             (if-let [x (exact M (subvec ns j (+ j len)) tol)]
                                               (if (or (empty? hits) (>= j (+ (:j (peek hits)) len))) (conj hits {:j j :x x}) hits)
                                               hits))
                                           [] (range (+ i len) (inc (- (count ns) len))))
                              score (* (count hits) len)]
                          (if (and (seq hits) (or (nil? best) (> score (:score best)))) {:score score :M M :hits hits} best)))
                      nil (for [len [5 4 3] i (range (inc (- (count ns) len)))] [len i]))
         span (fn [M] {:from (:on (first M)) :to (+ (:on (peek M)) (:dur (peek M))) :notes (mapv :name M)})]
     (if best
       (assoc (span (:M best)) :why (str "it recurs " (if (= 1 (count (:hits best))) "once more" (str (count (:hits best)) " more times"))
                                         ": " (str/join "; " (map (comp :name :x) (:hits best)))))
       (assoc (span (subvec ns 0 (min 4 (count ns)))) :why "nothing recurs exactly: the head of the phrase")))))

(defn memory
  "The memory of the work (Study 38): the share of a melody's three-note figures (two diatonic intervals) heard
   before, in the melodies given."
  [before melody]
  (let [grams (fn [m] (let [v (:dia (views (if (string? m) (notes-of m) m)))] (map vector v (rest v))))
        heard (set (mapcat grams before))
        mine (grams melody)]
    (if (seq mine) (r2 (/ (count (filter heard mine)) (count mine))) 0)))

(defn sweet
  "How welcome a kinship is: most in its sweet spot (0.65 … 0.9), less as a literal repetition, little when far."
  [k] (cond (>= k 0.95) 0.5 (>= k 0.65) 1 :else (max 0 (/ k 0.65))))

;; ───────── returns: a rhythm played several times ─────────

(defn returns
  "Spans that are one rhythm played several times (the quantizer's repetition, issue #108): spans [{:L :rel …}] (:rel
   where each onset falls, as a share of the span) of the same length, as many onsets, each within tol of the mean of
   the returns so far (not of the first: a rhythm played late and early is still one). Groups of spans, in order; with
   one span when it does not come back. The mean of a group (`mean-rel`) is nearer what was meant than any return."
  [spans tol]
  (let [mean (fn [g] (apply mapv (fn [& xs] (/ (reduce + xs) (count g))) (map :rel g)))
        same? (fn [g sp] (let [a (first g)]
                           (and (< (js/Math.abs (- (:L a) (:L sp))) 1e-6) (= (count (:rel a)) (count (:rel sp)))
                                (every? (fn [[x y]] (<= (js/Math.abs (- x y)) tol)) (map vector (mean g) (:rel sp))))))]
    (reduce (fn [gs sp] (if-let [i (first (keep-indexed (fn [i g] (when (same? g sp) i)) gs))]
                          (update gs i conj sp) (conj gs [sp])))
            [] spans)))

(defn mean-rel "Where the onsets of a group of returns fall, on average." [g]
  (apply mapv (fn [& xs] (/ (reduce + xs) (count g))) (map :rel g)))

;; ───────── the motives of a piece, written on its notes (quantize → describe → annotate) ─────────

(defn- r6 [x] (/ (js/Math.round (* 1e6 x)) 1e6))

(defn motives
  "The motives of voices (each a vector of notes, in time order): spans of 3 to 5 notes that come back with the same
   intervals (repeated, transposed, in sequence) or inverted, and the same rhythm (or augmented, diminished), in the
   same voice or another (an imitation). The one that covers most notes first, then the next among what is left, at
   most n (4). [{:label \"a\" :at [{:voice :i :len :rel}]}], :at in time order, the first its statement (:rel nil), the
   others how they are related to it (kairotic.motif's exact)."
  ([voices] (motives voices {}))
  ([voices {:keys [n] :or {n 4}}]
   (let [voices (mapv vec voices)
         ;; a window's class: its steps (or their inversion) and its rhythm as ratios of its first duration
         klass (fn [S inv?] (let [v (views S)] [(if inv? (mapv - (:dia v)) (:dia v)) (mapv r6 (:rhythm v))]))
         windows (for [len [5 4 3] [vi ns] (map-indexed vector voices) i (range (inc (- (count ns) len)))]
                   {:voice vi :i i :len len :notes (subvec ns i (+ i len))})
         free? (fn [covered {:keys [voice i len]}] (not-any? (fn [k] (covered [voice k])) (range i (+ i len))))
         pick (fn [covered]
                (let [ws (filter (partial free? covered) windows)
                      by (group-by (fn [w] [(:len w) (klass (:notes w) false)]) ws)
                      inv (group-by (fn [w] [(:len w) (klass (:notes w) true)]) ws)
                      ;; the occurrences of a class: its windows and its inversions', none overlapping in a voice
                      occ (fn [[k g]] (let [all (sort-by (fn [w] [(:on (first (:notes w))) (:voice w)]) (distinct (concat g (when (some (fn [x] (not= 0 x)) (first (second k))) (get inv k)))))]
                                        (reduce (fn [acc w] (if (some (fn [x] (and (= (:voice x) (:voice w)) (< (:i w) (+ (:i x) (:len x))) (< (:i x) (+ (:i w) (:len w))))) acc) acc (conj acc w)))
                                                [] all)))
                      cands (keep (fn [kg] (let [o (occ kg)] (when (>= (count o) 2) {:at o :score (* (count o) (:len (first o)))}))) by)]
                  ;; the one that covers most notes; of those, the one heard first
                  (first (sort-by (fn [c] [(- (:score c)) (:on (first (:notes (first (:at c)))))]) cands))))]
     (loop [covered #{} out []]
       (if (>= (count out) n)
         out
         (if-let [{:keys [at]} (pick covered)]
           (let [M (:notes (first at))
                 label (str (char (+ 97 (count out))))]
             (recur (into covered (for [w at k (range (:i w) (+ (:i w) (:len w)))] [(:voice w) k]))
                    (conj out {:label label
                               :at (mapv (fn [w j] (assoc (dissoc w :notes) :rel (when (pos? j) (:name (exact M (:notes w))))))
                                         at (range))})))
           out))))))

(defn annotate
  "A tree with its motives written on its notes (the analysis layer): on the first note of each statement and return,
   :motif its label (\"a\", \"b\"…) and, on a return, :motif.rel how it is related to the statement (\"transposed,
   a 4th lower\"). Graces left out; notes already labelled are relabelled."
  ([t] (annotate t {}))
  ([t o]
   (let [x (mt/expand t)
         es (filter (fn [e] (and (= :note (:kind e)) (not (:grace e)) (number? (:pitch e)))) (mt/events x))
         by-voice (vec (vals (group-by (fn [e] (or (:voice e) "")) es)))
         voices (mapv (fn [vs] (mapv (fn [e] (merge (pitch-of (or (:name e) (:pitch e))) {:on (:t e) :dur (:dur e) :path (:path e)})) (sort-by :t vs))) by-voice)
         clean (reduce (fn [t e] (let [n (mt/node-at t (:path e))]
                                   (if (and (mt/node? n) (or (:motif (mt/attrs n)) (:motif.rel (mt/attrs n))))
                                     (mt/apply-op t [:attrs (:path e) (dissoc (mt/attrs n) :motif :motif.rel)]) t)))
                       x es)]
     (reduce (fn [t {:keys [label at]}]
               (reduce (fn [t {:keys [voice i rel]}]
                         (let [path (:path (get-in voices [voice i])) n (mt/node-at t path)]
                           (mt/apply-op t [:attrs path (cond-> (assoc (mt/attrs n) :motif label) rel (assoc :motif.rel rel))])))
                       t at))
             clean (motives voices o)))))
