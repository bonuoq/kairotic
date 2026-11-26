;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · compress: the shortest description of a piece (discussion #399; the motive layer, step 3)
;; Study 66's compress.mjs, in the core. A piece is a stream of notes in the order they begin (simultaneous ones from
;; low to high), each its pitch (MIDI), how long it lasts and how long until the next begins (in 16ths). Its
;; description is a set of rules and the piece written with them; its length is counted in bits (minimum description
;; length): a note written out costs its pitch and its rhythm; a rule costs once what it says, and each use only what
;; changes. Three kinds of rule, the formulas a Baroque prelude is made of:
;;   figure  a pattern of a few pitches with its rhythm, used over other pitches: [0 1 2 3 4 2 3 4] over C E G C E
;;   motif   the same intervals and rhythm from another pitch: a transposed repetition, a sequence
;;   repeat  the same, n times in a row
;; Rules are found greedily, the one that saves most bits first; the description can always be written out again
;; (expand), the same notes. For the quantizer's :describe it is a diagnosis, not a preference: how much of what was
;; written is said by its own formulas (kairotic.motif finds the motives; this, how much they explain).

(ns kairotic.compress
  (:require [clojure.string :as str]
            [kairotic.bits :as bits]))

(def pitch-bits 7)
(defn- log2 [x] (/ (js/Math.log (max 1 x)) js/Math.LN2))
(defn- r4 [x] (/ (js/Math.round (* 1e4 x)) 1e4))
(defn- rkey [x] (str (r4 (:d x)) "/" (r4 (:g x))))

(defn stream
  "A piece from notes [[onset dur midi] …] (16ths): its notes in order, each with the gap to the next onset."
  [notes]
  (let [ns (vec (sort-by (fn [[t _ p]] [t p]) notes))]
    (vec (map-indexed (fn [i [t d p]] {:p p :d d :g (if (< (inc i) (count ns)) (- (first (ns (inc i))) t) d)}) ns))))

(defn notes-of-stream "Notes [[onset dur midi] …] back from a stream." [tokens]
  (first (reduce (fn [[out t] x] [(conj out [t (:d x) (:p x)]) (+ t (:g x))]) [[] 0] tokens)))

(defn model "The cost model of a piece: bits of a note's pitch and of its rhythm (as many rhythms as the piece has)." [tokens]
  {:pitch pitch-bits :rhythm (max 1 (log2 (count (set (map rkey tokens))))) :interval 5})

(defn- note? [x] (and (contains? x :p) (not (:rule x))))

(defn- cost
  "Bits of an item: a note written out, or a use of a rule (which rule, and what it is given)."
  [x M n-rules]
  (if (note? x)
    (+ (:pitch M) (:rhythm M))
    (let [which (+ 1 (log2 (inc n-rules)))]
      (case (:kind (:rule x))
        :figure (+ which (* (count (:pitches x)) (:pitch M)))
        :motif (+ which (:pitch M))
        :repeat (+ 1 (log2 (:n x)) (reduce + (map (fn [y] (cost y M n-rules)) (:body x))))
        which))))

(defn- rule-cost "What a rule costs to write once." [rule M]
  (let [L (count (:rhythm rule))]
    (if (= :figure (:kind rule))
      (+ 2 (log2 L) (log2 (:k rule)) (* L (+ (log2 (:k rule)) (:rhythm M))))
      (+ 2 (log2 L) (* (dec L) (:interval M)) (* L (:rhythm M))))))

(defn- figure-of [span]
  (let [order (vec (distinct (map :p span)))
        idx (mapv (fn [x] (.indexOf order (:p x))) span)]
    {:key (str "F" (str/join "," idx) "|" (str/join "," (map rkey span))) :idx idx :pitches order}))

(defn- motif-of [span]
  {:key (str "M" (str/join "," (map (fn [x] (- (:p x) (:p (first span)))) span)) "|" (str/join "," (map rkey span)))
   :start (:p (first span))})

(defn expand "A description's items written out again: its notes ({:p :d :g})." [items]
  (vec (mapcat (fn [x]
                 (cond (note? x) [(select-keys x [:p :d :g])]
                       (= :repeat (:kind (:rule x))) (apply concat (repeat (:n x) (expand (:body x))))
                       (= :figure (:kind (:rule x))) (map (fn [i r] {:p ((:pitches x) i) :d (:d r) :g (:g r)}) (:idx (:rule x)) (:rhythm (:rule x)))
                       :else (map (fn [s r] {:p (+ (:start x) s) :d (:d r) :g (:g r)}) (:steps (:rule x)) (:rhythm (:rule x)))))
               items)))

(defn- best-rule
  "The figure or motif, over spans of 3 … max-l notes written out, whose uses save most bits (by: :gain, :each, :long)."
  [items M n-rules max-l by]
  (let [items (vec items)
        groups (persistent!
                (reduce (fn [g [L i]]
                          (let [span (subvec items i (+ i L))]
                            (if-not (every? note? span)
                              g
                              (reduce (fn [g k] (let [cur (get g (:key k))]
                                                  (assoc! g (:key k) (if cur (update cur :at conj i) {:L L :kind (if (= \F (first (:key k))) :figure :motif) :at [i] :info k :span span}))))
                                      g [(figure-of span) (motif-of span)]))))
                        (transient {})
                        (for [L (range 3 (inc max-l)) i (range (inc (- (count items) L)))] [L i])))
        lit (+ (:pitch M) (:rhythm M))]
    (reduce (fn [best {:keys [L kind at info span]}]
              (let [at (first (reduce (fn [[out end] i] (if (> i end) [(conj out i) (+ i L -1)] [out end])) [[] -1] at))]
                (if (< (count at) 2)
                  best
                  (let [rhythm (mapv (fn [x] {:d (:d x) :g (:g x)}) span)
                        rule (if (= kind :figure)
                               {:kind :figure :idx (:idx info) :k (count (:pitches info)) :rhythm rhythm}
                               {:kind :motif :steps (mapv (fn [x] (- (:p x) (:p (first span)))) span) :rhythm rhythm})
                        use (+ (log2 (+ n-rules 2)) 1 (if (= kind :figure) (* (:k rule) (:pitch M)) (:pitch M)))
                        gain (- (* (count at) (- (* L lit) use)) (rule-cost rule M))
                        score (case by :gain gain :each (/ gain (count at)) (+ (* L 1e6) gain))]
                    (if (and (pos? gain) (or (nil? best) (> score (:score best))))
                      {:gain gain :score score :rule rule :at at :L L}
                      best)))))
            nil (vals groups))))

(defn- apply-rule [items {:keys [rule at L]}]
  (let [starts (set at) items (vec items)]
    (loop [i 0 out []]
      (cond (>= i (count items)) out
            (starts i) (let [span (subvec items i (+ i L))]
                         (recur (+ i L) (conj out (if (= :figure (:kind rule)) {:rule rule :pitches (:pitches (figure-of span))} {:rule rule :start (:p (first span))}))))
            :else (recur (inc i) (conj out (items i)))))))

(defn- strip [x]
  (cond (sequential? x) (mapv strip x)
        (note? x) [(:p x) (:d x) (:g x)]
        (= :repeat (:kind (:rule x))) [:R (:n x) (strip (:body x))]
        :else [(:id (:rule x)) (or (:pitches x) (:start x))]))

(defn- best-repeat "A span of items said again at once, n times: the run that saves most." [items M n-rules max-l]
  (let [items (vec items) N (count items)]
    (reduce (fn [best [L i]]
              (let [body (subvec items i (+ i L)) sb (strip body)
                    n (loop [n 1] (if (and (<= (+ i (* (inc n) L)) N) (= (strip (subvec items (+ i (* n L)) (+ i (* (inc n) L)))) sb)) (recur (inc n)) n))]
                (if (< n 2)
                  best
                  (let [c (reduce + (map (fn [y] (cost y M n-rules)) body))
                        gain (- (* (dec n) c) (+ 1 (log2 n)))]
                    (if (and (pos? gain) (or (nil? best) (> gain (:gain best)))) {:gain gain :i i :L L :n n :body body} best)))))
            nil (for [L (range 1 (inc max-l)) i (range (inc (- N (* 2 L))))] [L i]))))

(defn compress
  "The shortest description found of notes [[onset dur midi] …] (16ths): {:rules :items :bits :raw :ratio :tokens :model},
   each rule {:id :kind …}, the items the piece written with them (notes, uses {:rule :pitches|:start}, repeats {:n :body}).
   max-l (16) the longest rule; by (:gain, :each or :long) the order rules are taken in, else the shortest of the three."
  ([notes] (compress notes {}))
  ([notes {:keys [max-l by] :or {max-l 16}}]
   (if-not by
     (apply min-key :bits (map (fn [b] (compress notes {:max-l max-l :by b})) [:gain :each :long]))
     (let [tokens (stream notes) M (model tokens)
           [rules items] (loop [rules [] items tokens]
                           (if-let [b (best-rule items M (count rules) max-l by)]
                             (let [rule (assoc (:rule b) :id (str (if (= :figure (:kind (:rule b))) "F" "M") (inc (count rules))))]
                               (recur (conj rules rule) (apply-rule items (assoc b :rule rule))))
                             [rules items]))
           items (loop [items items]
                   (if-let [r (best-repeat items M (count rules) max-l)]
                     (recur (vec (concat (subvec (vec items) 0 (:i r)) [{:rule {:kind :repeat} :n (:n r) :body (:body r)}] (subvec (vec items) (+ (:i r) (* (:n r) (:L r)))))))
                     items))
           raw (* (count tokens) (+ (:pitch M) (:rhythm M)))
           b (+ (reduce + (map (fn [r] (rule-cost r M)) rules)) (reduce + (map (fn [x] (cost x M (count rules))) items)))]
       {:rules rules :items items :bits (js/Math.round b) :raw (js/Math.round raw) :ratio (if (pos? raw) (/ b raw) 1) :tokens tokens :model M :by by}))))

(defn lossless? "Is the description the piece? (expanded, every note again, its rhythm and its pitch)" [c]
  (= (map (juxt :p :d :g) (expand (:items c))) (map (juxt :p :d :g) (:tokens c))))

(defn describe-rule "What a rule is, in words." [r]
  (if (= :motif (:kind r))
    (let [up (- (peek (:steps r)) (first (:steps r)))]
      (str "motif of " (count (:steps r)) " notes (" (str/join " " (:steps r)) "), " (cond (pos? up) "rising" (neg? up) "falling" :else "returning")))
    (str (if (= (take (:k r) (:idx r)) (range (:k r))) "broken chord" "figure") " over " (:k r) " notes: " (str/join " " (:idx r)))))

;; ───────── the uses as a listener hears them (bits, as Study 66 and 67 count them) ─────────

(def ^:private step-bits (log2 25))

(defn code-length
  "The length of a description with its uses coded as heard: a lexicon (kairotic.bits) for each context — which rule
   comes, a voice's step from its pitch before —, a word never heard an escape and its literal. {:bits :ratio :parts}."
  [c]
  (let [M (:model c) R (count (:rules c))
        say (fn [lx ctx w literal]
              (let [l (get lx ctx (bits/lexicon))]
                (if (pos? (bits/heard l w))
                  [(bits/bits l w) (assoc lx ctx (bits/add l w))]
                  [(+ (bits/bits l "esc") literal) (assoc lx ctx (-> l (bits/add "esc") (bits/add w)))])))
        voice (fn [lx before p] (if (nil? before) (say lx "pitch" (str "p:" p) pitch-bits)
                                    (let [d (- p before)] (if (<= (js/Math.abs d) 12) (say lx "voice" (str "v|" d) step-bits) (say lx "voice" "esc" pitch-bits)))))
        walk (fn walk [[parts lx last] x]
               (cond (note? x) [(update parts :notes + (:pitch M) (:rhythm M)) lx last]
                     (= :repeat (:kind (:rule x))) (reduce walk [(update parts :repeats + 1 (log2 (:n x))) lx last] (:body x))
                     :else (let [id (:id (:rule x))
                                 [b lx] (say lx "which" (str "use:" id) (log2 R))
                                 before (get last id [])
                                 ps (if (= :figure (:kind (:rule x))) (:pitches x) [(:start x)])
                                 [pb lx] (reduce (fn [[s lx] [i p]] (let [[b lx] (voice lx (get before i) p)] [(+ s b) lx])) [0 lx] (map-indexed vector ps))]
                             [(-> parts (update :which + b) (update :pitches + pb)) lx (assoc last id ps)])))
        [parts] (reduce walk [{:rules (reduce + (map (fn [r] (rule-cost r M)) (:rules c))) :which 0 :pitches 0 :notes 0 :repeats 0} {} {}] (:items c))
        b (reduce + (vals parts))]
    {:bits (js/Math.round b) :ratio (if (pos? (:raw c)) (/ b (:raw c)) 1) :parts (into {} (map (fn [[k v]] [k (js/Math.round v)]) parts))}))

;; ───────── in a tree: how much of what is written its own formulas say (for the quantizer's :describe) ─────────

(defn of-notes
  "The description of notes [[onset dur midi] …] in beats (a quarter 1, as kairotic.mt's events): compress in 16ths, then
   coded as heard. {:bits (as heard) :raw :ratio :rules [{:id :kind :uses :what}]}, or nil for fewer than 6 notes."
  [notes]
  (when (>= (count notes) 6)
    (let [c (compress (mapv (fn [[t d p]] [(r4 (* 4 t)) (r4 (* 4 d)) (js/Math.round p)]) notes) {:max-l 12})
          k (code-length c)
          uses (frequencies (keep (fn [x] (:id (:rule x))) (tree-seq (fn [x] (and (map? x) (:body x))) :body {:body (:items c)})))]
      {:bits (:bits k) :raw (:raw c) :ratio (/ (js/Math.round (* 1000 (:ratio k))) 1000)
       :rules (mapv (fn [r] {:id (:id r) :kind (:kind r) :uses (get uses (:id r) 0) :what (describe-rule r)}) (:rules c))})))
