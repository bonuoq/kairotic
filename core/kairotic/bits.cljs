;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · bits: the length of a description (discussions #342, #399; the motive layer)
;; The same measure as @kairotic/rules' bits.mjs, for the core (what kairotic.compress counts in): a sequence said as
;; words costs the bits a listener learning it as it goes needs for each,
;;
;;   bits(word) = −log2( (count(word) + inverse · count(invert(word)) + alpha / kinds) / (N + alpha) )
;;
;; a word heard before cheap (the more, the cheaper), its inversion half as good, a new one dear. Words are strings
;; "head:field,field…|field…", as in bits.mjs, so that the same words cost the same in both. A lexicon is data:
;; {:counts {word n} :n N :alpha :kinds :inverse}.

(ns kairotic.bits
  (:require [clojure.string :as str]))

(defn word "A word: its head and its fields (\"Q\" [2 0 1] → \"Q:2,0,1\")." [head fields] (str head ":" (str/join "," fields)))

(defn invert
  "A word's inversion: every number field negated (after \":\", \",\" or \"|\"), 0 staying 0."
  [w]
  (str/replace w #"(^|[:,|])(-?\d+)(?=$|[,|])" (fn [[_ s n]] (str s (let [x (- (js/parseInt n 10))] (if (zero? x) 0 x))))))

(defn lexicon
  "What has been heard: nothing yet (or these words, once each)."
  ([] (lexicon nil {}))
  ([words] (lexicon words {}))
  ([words {:keys [alpha kinds inverse] :or {alpha 1 kinds 40 inverse 0.5}}]
   (reduce (fn [lx w] (-> lx (update-in [:counts w] (fnil inc 0)) (update :n inc)))
           {:counts {} :n 0 :alpha alpha :kinds kinds :inverse inverse}
           words)))

(defn add "The lexicon with word w heard once more." [lx w] (-> lx (update-in [:counts w] (fnil inc 0)) (update :n inc)))
(defn heard "How many times word w has been heard." [lx w] (get-in lx [:counts w] 0))

(defn bits
  "What word w costs to hear now, in bits."
  [{:keys [counts n alpha kinds inverse]} w]
  (let [c (get counts w 0) i (invert w) ci (if (= i w) 0 (get counts i 0))]
    (- (/ (js/Math.log (/ (+ c (* inverse ci) (/ alpha kinds)) (+ n alpha))) js/Math.LN2))))

(defn length-of
  "A sequence of words' length, heard in order: {:bits :per-word :words (how many different)}."
  ([ws] (length-of ws {}))
  ([ws o]
   (let [[b lx] (reduce (fn [[b lx] w] [(+ b (bits lx w)) (add lx w)]) [0 (lexicon nil o)] ws)]
     {:bits b :per-word (if (seq ws) (/ b (count ws)) 0) :words (count (:counts lx))})))

(defn economy-of
  "An engine's soft preference for a word heard before: economy · (bits(word) − bits(a word never heard)) / 4, a
   discount (≤ 0); 0 where economy is 0."
  [lx w economy]
  (if (and economy (not (zero? economy))) (* economy (/ (- (bits lx w) (bits lx "")) 4)) 0))
