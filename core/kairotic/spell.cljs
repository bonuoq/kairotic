;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · spell
;; How a pitch is written (issue #88): a letter, an alteration and an octave, not only a MIDI number.
;; G# and Ab sound alike and are written apart; the line of fifths (… Bb F C G D A E B F# C# …, one
;; integer each: C = 0, G = 1, F = -1) says how far a name is from another, so that transposing,
;; inverting and choosing a name for a sound are arithmetic on it (as in Ooloi ADR-0026 or music21).
;;
;;   a spelling   {:step 0…6 (c d e f g a b) :alter -2…2 :oct n}       "bb4", "f##3", "fx3", "ebb2", "c4"
;;   an interval  "M3" "-P5" "A4" "d5" "m9" … , or [steps semitones]
;;   a key        "eb" "c#m" "d dorian" "f lydian" :none, or a key signature as a number (3: three sharps)
;;
;; Spelling the notes that have no name (numbers, Hz, a freqt's strokes): `spell-steps` chooses, for each
;; note, the name nearest the key on the line of fifths, with melodic and vertical sense (a Viterbi over
;; the onsets: chromatic notes rise as sharps and fall as flats, no augmented seconds where a minor
;; third does, chords stacked in thirds), the key given or estimated per bar (Temperley's profiles).

(ns kairotic.spell
  (:require [clojure.string :as str]))

(def letters ["c" "d" "e" "f" "g" "a" "b"])
(def natural-pc [0 2 4 5 7 9 11])
(def natural-fifths [0 2 4 -1 1 3 5])

;; ───────── spellings ─────────

(defn parse
  "A pitch name → {:step :alter :oct}: \"bb4\", \"f#3\", \"fs3\", \"f##3\", \"fx3\", \"ebb2\", \"cn4\"; nil if
   it is not one. c4 is middle C."
  [s]
  (when-let [[_ l acc o] (and (or (string? s) (keyword? s))
                              (re-matches #"(?i)\s*([a-g])(##|#|x|s|bb|b|n)?(-?\d+)\s*" (name s)))]
    {:step (.indexOf letters (str/lower-case l))
     :alter (case (some-> acc str/lower-case) ("##" "x") 2 ("#" "s") 1 "bb" -2 "b" -1 0)
     :oct (js/parseInt o 10)}))

(defn ->midi [{:keys [step alter oct]}] (+ (* 12 (inc oct)) (natural-pc step) alter))

(defn fifths "Where a spelling is on the line of fifths (C 0, G 1, F -1, F# 6, Bb -2)." [{:keys [step alter]}]
  (+ (natural-fifths step) (* 7 alter)))

(defn acc-str [alter] (case alter 2 "##" 1 "#" -1 "b" -2 "bb" ""))

(defn ->name "{:step 6 :alter -1 :oct 4} → \"bb4\"." [{:keys [step alter oct] :as sp}]
  (when sp (str (letters step) (acc-str alter) oct)))

(defn from-fifths
  "The spelling at position f of the line of fifths that sounds midi (an integer), or nil."
  [f midi]
  (let [base (- (mod (inc f) 7) 1)
        alter (/ (- f base) 7)
        step (.indexOf natural-fifths base)
        oct (- (/ (- midi (natural-pc step) alter) 12) 1)]
    (when (and (>= step 0) (== oct (js/Math.round oct))) {:step step :alter alter :oct oct})))

(defn spellings
  "Every way to write an integer MIDI pitch with at most two sharps or flats, fewest alterations first:
   61 → c#4, db4 (and b##3)."
  [midi]
  (let [pc (mod midi 12)]
    (->> (range 7)
         (keep (fn [step]
                 (let [alter (- (mod (+ (- pc (natural-pc step)) 6) 12) 6)]
                   (when (<= (js/Math.abs alter) 2)
                     {:step step :alter alter :oct (- (/ (- midi (natural-pc step) alter) 12) 1)}))))
         (sort-by (fn [sp] (js/Math.abs (:alter sp))))
         vec)))

;; ───────── intervals ─────────

(def ^:private simple-semis [0 2 4 5 7 9 11])

(defn interval
  "An interval as [steps semitones]: \"M3\" → [2 4], \"-P5\" → [-4 -7], \"A4\" → [3 6], \"d5\" → [4 6],
   \"m9\" → [8 13]; [steps semitones] as it is; nil if it does not read."
  [x]
  (cond
    (and (vector? x) (= 2 (count x)) (every? integer? x)) x
    (or (string? x) (keyword? x))
    (when-let [[_ sign q n] (re-matches #"\s*([+-]?)(P|M|m|A+|d+)(\d+)\s*" (name x))]
      (let [n (js/parseInt n 10) s (mod (dec n) 7) octs (quot (dec n) 7)
            perfect? (#{0 3 4} s)
            adj (cond (= q "P") (when perfect? 0)
                      (= q "M") (when-not perfect? 0)
                      (= q "m") (when-not perfect? -1)
                      (str/starts-with? q "A") (count q)
                      (str/starts-with? q "d") (- (+ (count q) (if perfect? 0 1))))]
        (when (and (pos? n) (some? adj))
          (let [st (+ s (* 7 octs)) se (+ (simple-semis s) (* 12 octs) adj) k (if (= sign "-") -1 1)]
            [(* k st) (* k se)]))))
    :else nil))

(defn interval-of-semitones
  "The interval a transposition by n semitones is written as: 1 → m2, 6 → A4 (or d5: dim? true), 7 → P5."
  ([n] (interval-of-semitones n false))
  ([n dim?]
   (let [k (if (neg? n) -1 1) a (js/Math.abs n) o (quot a 12) r (mod a 12)
         steps ([0 1 1 2 2 3 (if dim? 4 3) 4 5 5 6 6] r)]
     [(* k (+ steps (* 7 o))) n])))

(defn transpose-spelling
  "A spelling moved by an interval [steps semitones]: c4 + M3 = e4, c4 + A4 = f#4, c4 - m2 = b3."
  [{:keys [step oct] :as sp} [steps semis]]
  (let [s (+ step steps) nstep (mod s 7) noct (+ oct (js/Math.floor (/ s 7)))
        target (+ (->midi sp) semis)
        natural (+ (* 12 (inc noct)) (natural-pc nstep))]
    {:step nstep :alter (- target natural) :oct noct}))

(defn invert-spelling
  "A spelling mirrored around a pivot spelling: on the line of fifths and in pitch (c4 around e4 = g#4)."
  [sp pivot]
  (or (from-fifths (- (* 2 (fifths pivot)) (fifths sp)) (- (* 2 (->midi pivot)) (->midi sp)))
      sp))

;; ───────── keys ─────────

(def mode-offsets {:major 0 :ionian 0 :dorian -2 :phrygian -4 :lydian 1 :mixolydian -1 :minor -3 :aeolian -3 :locrian -5})

(defn parse-key
  "A key → {:sig n (sharps +, flats -) :tonic fifths :mode kw}, {:none true} for :none (atonal: no key),
   or nil. \"eb\", \"Eb\", \"c#m\", \"c# minor\", \"d dorian\", a number (a signature: 3 is A major's)."
  [k]
  (cond
    (nil? k) nil
    (or (= k :none) (= (str/lower-case (name (if (keyword? k) k (str k)))) "none")) {:none true :sig 0}
    (and (number? k) (integer? k) (<= -7 k 7)) {:sig k :tonic k :mode :major}
    (map? k) (when (integer? (:sig k)) k)
    (or (string? k) (keyword? k))
    (when-let [[_ l acc m] (re-matches #"(?i)\s*([a-g])(##|#|x|s|bb|b)?\s*(m|min|minor|maj|major|ionian|dorian|phrygian|lydian|mixolydian|aeolian|locrian)?\s*" (name k))]
      (let [tonic (fifths {:step (.indexOf letters (str/lower-case l))
                           :alter (case (some-> acc str/lower-case) ("##" "x") 2 ("#" "s") 1 "bb" -2 "b" -1 0)})
            mode (case (some-> m str/lower-case) ("m" "min" "minor") :minor (nil "maj" "major") :major (keyword (str/lower-case m)))
            sig (+ tonic (mode-offsets mode))]
        (when (<= -7 sig 7) {:sig sig :tonic tonic :mode mode})))
    :else nil))

(defn mei-key-sig "A signature as MEI writes it: 3 → \"3s\", -2 → \"2f\", 0 → \"0\"." [sig]
  (cond (pos? sig) (str sig "s") (neg? sig) (str (- sig) "f") :else "0"))

(defn key-alter
  "The alteration a signature gives a step: in 2 sharps, F and C are sharp (1); in 1 flat, B is flat (-1)."
  [sig step]
  (let [x (natural-fifths step)]
    (cond (and (pos? sig) (< x (dec sig))) 1
          (and (neg? sig) (> x (+ 5 sig))) -1
          :else 0)))

(defn key-center "The middle of a key's notes on the line of fifths (its signature + 2)." [sig] (+ sig 2))

;; Temperley's key profiles (Music and Probability, 2007): they weigh notes outside a key lower than
;; Krumhansl–Kessler's, which tells A minor from E major in a few notes (C is far from E major)
(def ^:private major-profile [5.0 2.0 3.5 2.0 4.5 4.0 2.0 4.5 2.0 3.5 1.5 4.0])
(def ^:private minor-profile [5.0 2.0 3.5 4.5 2.0 4.0 2.0 4.5 3.5 2.0 1.5 4.0])

(defn- correlation [xs ys]
  (let [n (count xs) mx (/ (reduce + xs) n) my (/ (reduce + ys) n)
        sxy (reduce + (map (fn [x y] (* (- x mx) (- y my))) xs ys))
        sxx (reduce + (map (fn [x] (* (- x mx) (- x mx))) xs))
        syy (reduce + (map (fn [y] (* (- y my) (- y my))) ys))]
    (if (or (zero? sxx) (zero? syy)) 0 (/ sxy (js/Math.sqrt (* sxx syy))))))

(defn tonic-fifths
  "Where a tonic of pitch class pc is on the line of fifths, so that its key (in mode) has the fewest
   alterations: pc 1 major → Db (-5), pc 1 minor → C# (7)."
  [pc mode]
  (let [r (mod (* 7 pc) 12) off (mode-offsets mode)]
    (first (sort-by (fn [f] [(js/Math.abs (+ f off)) (- f)]) [r (- r 12)]))))

(defn estimate-key
  "The key whose profile best matches a duration per pitch class (a vector of 12), as parse-key gives
   it, with :score its correlation (between two that fit alike, fewer alterations); nil when there is
   nothing to hear."
  [weights]
  (when (pos? (reduce + weights))
    (let [rot (fn [p k] (vec (for [i (range 12)] (p (mod (- i k) 12)))))
          ;; between keys that fit as well, the one with fewer alterations
          best (apply max-key (fn [x] (- (:score x) (* 0.01 (js/Math.abs (:sig x)))))
                      (for [k (range 12) [mode p] [[:major major-profile] [:minor minor-profile]]
                            :let [tonic (tonic-fifths k mode)]]
                        {:pc k :mode mode :tonic tonic :sig (+ tonic (mode-offsets mode)) :score (correlation weights (rot p k))}))]
      (select-keys best [:sig :tonic :mode :score]))))

;; ───────── spelling notes ─────────

(defn- step-cost
  "How a set of spellings sounds as one onset in a key: far from the key's notes (center ± 3), double
   alterations, and a chord spread wider than a tritone's span on the line of fifths."
  [sps center]
  (let [fs (map fifths sps)]
    (+ (reduce + (map (fn [f] (let [d (js/Math.abs (- f center))] (if (<= d 3) 0 (* 0.8 (- d 3))))) fs))
       (* 2.5 (count (filter (fn [sp] (= 2 (js/Math.abs (:alter sp)))) sps)))
       (* 0.05 (reduce + (map (fn [sp] (js/Math.abs (:alter sp))) sps)))
       (if (> (count fs) 1) (* 0.4 (max 0 (- (- (apply max fs) (apply min fs)) 6))) 0))))

(defn- move-cost
  "How one voice moves from spelling a to b in a key of signature sig: an augmented or diminished step
   (more than six fifths apart: C to D#, E to Gb) costs; a raised note that falls a semitone, or a
   lowered one that rises, costs more than the key's preference (chromatic lines rise in sharps and fall
   in flats)."
  [a b sig]
  (let [d (js/Math.abs (- (fifths b) (fifths a)))
        semis (- (->midi b) (->midi a))]
    (+ (if (<= d 6) 0 (* 0.7 (- d 6)))
       (cond (and (= semis -1) (> (:alter a) (key-alter sig (:step a)))) 2
             (and (= semis 1) (< (:alter a) (key-alter sig (:step a)))) 2
             :else 0))))

(defn- combos [xss]
  (reduce (fn [acc xs] (for [a acc x xs] (conj a x))) [[]] xss))

(defn spell-steps
  "Names for notes in time: steps [{:sig n :notes [{:id :midi (an integer) :voice :fixed spelling-or-nil}]}],
   one per onset, in order (:sig the key there). Returns {id spelling}. A note that is written keeps its
   name (:fixed); the others take the names that cost least over the whole line (Viterbi): near the key,
   moving well in their voice, stacked well in their chord."
  [steps]
  (let [cands (fn [{:keys [sig notes]}]
                (let [c (key-center sig)
                      per (mapv (fn [n] (if (:fixed n)
                                          [(:fixed n)]
                                          (vec (take 3 (sort-by (fn [sp] (js/Math.abs (- (fifths sp) c))) (spellings (:midi n)))))))
                                notes)]
                  (if (> (reduce * 1 (map count per)) 81)
                    [(mapv first per)]                       ; too many notes at once: each its nearest
                    (vec (combos per)))))
        layers (mapv (fn [st] (let [cs (cands st) c (key-center (:sig st))]
                                {:step st :states (mapv (fn [sps] {:sps sps :static (step-cost sps c)}) cs)}))
                     steps)
        trans (fn [prev-st prev-sps st sps]
                (let [pv (into {} (map (fn [n sp] [(:voice n) sp]) (:notes prev-st) prev-sps))]
                  (reduce + (map (fn [n sp] (if-let [a (get pv (:voice n))] (move-cost a sp (:sig st)) 0)) (:notes st) sps))))
        dp (reduce (fn [acc {:keys [step states]}]
                     (if (empty? acc)
                       [(mapv (fn [s] {:cost (:static s) :back nil :sps (:sps s)}) states)]
                       (let [prev (peek acc) pst (:step (nth layers (dec (count acc))))]
                         (conj acc (mapv (fn [s]
                                           (let [[bi bc] (reduce (fn [[bi bc] [i p]]
                                                                   (let [c (+ (:cost p) (trans pst (:sps p) step (:sps s)))]
                                                                     (if (< c bc) [i c] [bi bc])))
                                                                 [0 js/Infinity] (map-indexed vector prev))]
                                             {:cost (+ bc (:static s)) :back bi :sps (:sps s)}))
                                         states)))))
                   [] layers)]
    (if (empty? dp)
      {}
      (loop [i (dec (count dp))
             j (first (apply min-key second (map-indexed (fn [j s] [j (:cost s)]) (peek dp))))
             out {}]
        (if (neg? i)
          out
          (let [s (nth (nth dp i) j) st (:step (nth layers i))]
            (recur (dec i) (:back s) (into out (map (fn [n sp] [(:id n) sp]) (:notes st) (:sps s))))))))))
