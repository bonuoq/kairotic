;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · mt (musical time)
;; Musical-temporal data as EDN trees, in the hiccup style: [:tag {attributes} & children].
;; It is the common language of notation, composition and CAC in Kairotic: components take trees and
;; return trees, and a canvas, a freqt or a score can show one. Like bach's llll it nests freely;
;; unlike it, attributes have names, so any extra data (bach's slots) is just one more key.
;;
;; Time is in beats (a quarter note = 1); :tempo (beats per minute, 60 by default) turns it into seconds.
;;
;;   sequential  :seq :voice :section :measure {:meter [3 4]} :tuplet {:ratio [3 2]}   children one after another
;;   simultaneous :par :piece :chord                                                 children at once
;;   leaves      :note {:pitch "c4" | 60.5 | :hz 440, :dur 1}   :rest {:dur 1}
;;               :param {:name :cutoff :value 400 :to 2000 :dur 4}   a parameter change (a ramp with :to)
;;               :dyn {:mark "mf"} · {:mark "<" :dur 2}           a dynamic, or a hairpin
;;               :text {:text "dolce"}                            a text indication
;;               :use {:ref :motif :transpose 5}                  a fragment defined in :defs, varied
;;   strings     "c4/1 e4/.5 r/1 c4+e4+g4/2"                      melody shorthand inside any container
;;
;; Any node may carry :at (an offset from the start of its parent; it does not move the parent's
;; cursor), :id, and any other key. Notes also take :art [:staccato :accent], :dyn "p", :text "…",
;; :gliss [[0 0] [1 -150]] (cents over the note's duration), :env [[0 0] [0.1 1] [1 0]], :vel 0.8.
;; A note without :dur lasts as long as the previous one of its container (1 at first). :defs (a map
;; of fragments) can sit in the attributes of any container; [:use {:ref k}] takes them from there.

(ns kairotic.mt
  (:require [clojure.string :as str]
            [clojure.edn :as edn]
            [kairotic.canvas :as cv]
            [kairotic.score :as sc]))

;; ───────── nodes ─────────

(def seq-tags #{:seq :voice :measure :tuplet})
(def par-tags #{:par :chord})
;; a work: in a :piece or a :section, voices (and :par) sound together from its start, and anything
;; else — sections in a piece, measures in a section — follows in order
(def block-tags #{:piece :section})
(def mark-tags #{:param :dyn :text})
(def known-tags (into (into (into (into #{:note :rest :use} seq-tags) par-tags) block-tags) mark-tags))

(defn node? [x] (and (vector? x) (keyword? (first x))))
(defn tag [n] (when (node? n) (first n)))
(defn attrs [n] (let [a (second n)] (if (map? a) a {})))
(defn kids [n] (if (map? (second n)) (subvec n 2) (subvec n 1)))
(defn make [t a ks] (into (if (seq a) [t a] [t]) ks))
;; a node keeps its metadata (where it comes from in the written tree) when it changes
(defn with-attrs [n a] (with-meta (make (tag n) a (kids n)) (meta n)))
(defn with-kids [n ks] (with-meta (make (tag n) (attrs n) ks) (meta n)))
(defn update-attrs [n f & args] (with-attrs n (apply f (attrs n) args)))

(defn tree? "Is x a musical tree (or a string of melody)?" [x] (or (node? x) (string? x)))

;; ───────── pitch ─────────

(def pc-names ["c" "c#" "d" "d#" "e" "f" "f#" "g" "g#" "a" "a#" "b"])

(defn midi-of
  "The pitch of a note as a MIDI number (with decimals for microtones), or nil."
  [a]
  (cond
    (number? (:hz a)) (when (pos? (:hz a)) (cv/hz->midi (:hz a)))
    (some? (:pitch a)) (when-let [m (sc/pitch (:pitch a))] (+ m (or (:cents a) 0) 0))
    :else nil))

(defn pitch-name
  "60 → \"c4\"; a fractional pitch stays a number."
  [m]
  (if (and (number? m) (= m (js/Math.round m)))
    (str (nth pc-names (mod m 12)) (dec (js/Math.floor (/ m 12))))
    m))

(defn set-midi
  "Writes a new pitch in the attributes of a note, in the same kind of value it had (name, number or Hz)."
  [a m]
  (cond
    (number? (:hz a)) (assoc a :hz (cv/round-to (cv/midi->hz m) 3))
    (string? (:pitch a)) (assoc (dissoc a :cents) :pitch (pitch-name (cv/round-to m 3)))
    (keyword? (:pitch a)) (assoc (dissoc a :cents) :pitch (pitch-name (cv/round-to m 3)))
    :else (assoc (dissoc a :cents) :pitch (cv/round-to m 3))))

;; ───────── melody shorthand ─────────

(defn melody
  "\"c4/1 d4/.5 r/1 c4+e4+g4/2 f4\" → nodes. A token without /dur keeps the previous duration."
  [txt]
  (loop [toks (remove str/blank? (str/split (str/trim (str txt)) #"\s+")) prev 1 out []]
    (if (empty? toks)
      out
      (let [[p d] (str/split (first toks) #"/" 2)
            dur (if (seq d) (let [x (js/parseFloat d)] (if (js/isNaN x) prev x)) prev)
            node (if (= "r" (str/lower-case p))
                   [:rest {:dur dur}]
                   (let [ps (str/split p #"\+")]
                     (doseq [x ps] (when-not (sc/pitch x) (throw (js/Error. (str "I don't understand the note «" x "» (use c4, f#3, bb2)")))))
                     (if (= 1 (count ps))
                       [:note {:pitch (str/lower-case (first ps)) :dur dur}]
                       (into [:chord {:dur dur}] (for [x ps] [:note {:pitch (str/lower-case x)}])))))]
        (recur (rest toks) dur (conj out node))))))

;; ───────── transformations (tree → tree) ─────────

(defn walk-notes
  "Applies f to the attributes of every note."
  [f n]
  (cond
    (not (node? n)) n
    (= :note (tag n)) (with-attrs n (f (attrs n)))
    :else (with-kids n (mapv (fn [k] (walk-notes f k)) (kids n)))))

(defn first-pitch [n]
  (cond (not (node? n)) nil
        (= :note (tag n)) (midi-of (attrs n))
        :else (some first-pitch (kids n))))

(declare expand)

(defn transpose
  "Moves every pitch by n semitones (decimals: microtones)."
  [n tree]
  (walk-notes (fn [a] (if-let [m (midi-of a)] (set-midi a (+ m n)) a)) (expand tree)))

(defn invert
  "Mirrors every pitch around a pivot (by default, the first pitch)."
  ([tree] (invert nil tree))
  ([pivot tree]
   (let [t (expand tree)
         p (or (if (or (string? pivot) (keyword? pivot)) (sc/pitch pivot) pivot) (first-pitch t) 60)]
     (walk-notes (fn [a] (if-let [m (midi-of a)] (cond-> (set-midi a (- (* 2 p) m))
                                                    (:gliss a) (assoc :gliss (mapv (fn [[x c]] [x (- c)]) (:gliss a))))
                           a))
                 t))))

(defn explicit
  "Writes in every note, rest and chord of a sequence the duration it takes from the previous one."
  [n]
  (if-not (node? n)
    n
    (let [seqy (seq-tags (tag n))]
      (with-kids n
        (loop [ks (kids n) prev 1 out []]
          (if (empty? ks)
            out
            (let [k (first ks)
                  durable (and (node? k) (#{:note :rest :chord} (tag k)) (not (:at (attrs k))))
                  d (when durable (or (:dur (attrs k)) prev))
                  k (explicit (if (and durable seqy) (update-attrs k assoc :dur d) k))]
              (recur (rest ks) (if (and durable seqy) d prev) (conj out k)))))))))

(defn with-meters
  "Writes in every measure the meter it takes from the previous one (4/4 at first)."
  [tree]
  (let [last-m (atom [4 4])]
    (letfn [(go [n]
              (cond
                (not (node? n)) n
                (= :measure (tag n)) (let [m (or (:meter (attrs n)) @last-m)]
                                       (reset! last-m m)
                                       (make :measure (assoc (attrs n) :meter m) (mapv go (kids n))))
                :else (with-kids n (mapv go (kids n)))))]
      (go tree))))

(defn scale-meter
  "The meter of a measure whose durations are multiplied by f: 4/4 × 2 = 8/4, 3/4 × 0.5 = 3/8."
  [[p q] f]
  (let [p2 (* p f) q2 (/ q f)]
    (cond (= p2 (js/Math.round p2)) [p2 q]
          (and (= q2 (js/Math.round q2)) (pos? q2)) [p q2]
          :else [p2 q])))

(defn augment
  "Multiplies every duration (and offset) by f: 2 doubles, 0.5 halves. Measures change their meter."
  [f tree]
  (letfn [(go [n]
            (if-not (node? n)
              n
              (let [a (attrs n)
                    a (cond-> a
                        (number? (:dur a)) (update :dur * f)
                        (number? (:at a)) (update :at * f)
                        (and (= :measure (tag n)) (vector? (:meter a))) (update :meter scale-meter f))]
                (make (tag n) a (mapv go (kids n))))))]
    (go (with-meters (explicit (expand tree))))))

(defn retrograde
  "Plays it backwards: the children of every sequence in reverse order (glissandi too)."
  [tree]
  (letfn [(go [n]
            (cond
              (not (node? n)) n
              (= :note (tag n)) (let [a (attrs n)]
                                  (if (:gliss a)
                                    (let [g (:gliss a) end (second (peek g))]
                                      (with-attrs n (-> (set-midi a (+ (midi-of a) (/ end 100)))
                                                        (assoc :gliss (vec (reverse (mapv (fn [[x c]] [(- 1 x) (- c end)]) g)))))))
                                    n))
              (seq-tags (tag n)) (with-kids n (vec (reverse (mapv go (kids n)))))
              (block-tags (tag n)) (let [ks (mapv go (kids n))
                                         together? (fn [k] (or (not (node? k)) (#{:voice :par} (tag k)) (some? (:at (attrs k)))))
                                         slots (vec (keep-indexed (fn [i k] (when-not (together? k) i)) ks))
                                         moved (zipmap slots (reverse (map ks slots)))]
                                     (with-kids n (vec (map-indexed (fn [i k] (get moved i k)) ks))))
              :else (with-kids n (mapv go (kids n)))))]
    (go (with-meters (explicit (expand tree))))))

(defn rotate
  "Moves the first k elements of the top sequence to its end (negative k: the other way)."
  [k tree]
  (let [t (with-meters (explicit (expand tree))) ks (kids t) n (count ks)]
    (if (zero? n) t (let [k (mod k n)] (with-kids t (vec (concat (drop k ks) (take k ks))))))))

(declare measured? duration)

(defn as-voice [t nm] (if (= :voice (tag t)) (update-attrs t assoc :name nm) [:voice {:name nm} t]))

(defn canon
  "The tree against itself, entering `delay` beats later and transposed by `interval`. When it is
   written in measures and the delay is a whole number of them, the second voice enters after rest bars."
  ([delay tree] (canon delay 0 tree))
  ([delay interval tree]
   (let [t (with-meters (explicit (expand tree)))
         first-m (first (filter (fn [x] (and (node? x) (= :measure (tag x)))) (tree-seq node? kids t)))
         [p q] (when first-m (:meter (attrs first-m)))
         bar (when p (* p (/ 4 q)))
         bars (when bar (/ delay bar))]
     (if (and bars (pos? bars) (= bars (js/Math.round bars)))
       (let [v2 (as-voice (transpose interval t) "comes")
             rests (vec (repeat bars [:measure {:meter [p q]} [:rest {:dur bar}]]))]
         [:par {:name "canon"} (as-voice t "dux") (with-kids v2 (into rests (kids v2)))])
       [:par {:name "canon"} (as-voice t "dux") [:voice {:name "comes"} [:seq {:at delay} (transpose interval t)]]]))))

(defn apply-ops
  "The variations a [:use …] or a box can ask for, in a fixed order."
  [a tree]
  (cond->> tree
    (:transpose a) (transpose (:transpose a))
    (some? (:invert a)) (invert (if (true? (:invert a)) nil (:invert a)))
    (:retrograde a) retrograde
    (:augment a) (augment (:augment a))))

;; ───────── expansion: strings and references ─────────

(def op-keys #{:ref :transpose :invert :retrograde :augment})

(defn- from [x src] (if (node? x) (with-meta x src) x))

(defn expand*
  "Expands n; every node remembers where it was written: {:src path} (and {:sub [i …]} inside a
   melody string); nodes that come from :defs have no :src."
  ([n defs depth] (expand* n defs depth nil))
  ([n defs depth path]
  (cond
    (string? n) (vec (map-indexed (fn [i x]
                                    (let [x (if (= :chord (tag x))
                                              (with-kids x (vec (map-indexed (fn [j k] (from k (when path {:src path :sub [i j]}))) (kids x))))
                                              x)]
                                      (from x (when path {:src path :sub [i]}))))
                                  (melody n)))
    (not (node? n)) []
    (= :use (tag n))
    (let [a (attrs n) r (:ref a) k (if (string? r) (keyword r) r) d (get defs k)]
      (when (> depth 24) (throw (js/Error. (str "Fragments that use each other without end (" r ")"))))
      (when-not d (throw (js/Error. (str "No fragment " (pr-str r) " in :defs"))))
      (let [xs (expand* d defs (inc depth) nil)
            body (if (= 1 (count xs)) (first xs) (into [:seq] xs))
            varied (apply-ops a body)
            extra (apply dissoc a op-keys)]
        [(from (if (seq extra) [:seq extra varied] varied) (if path {:src path :use true} (meta n)))]))
    :else
    (let [a (attrs n) defs (merge defs (:defs a))]
      [(from (make (tag n) (dissoc a :defs)
                   (vec (apply concat (map-indexed (fn [i k] (expand* k defs depth (when path (conj path i)))) (kids n)))))
             (if path {:src path} (meta n)))]))))

(defn expand
  "Strings become notes and [:use …] the fragments they name, varied. A list of nodes becomes a :seq."
  [x]
  (cond
    (string? x) (into [:seq] (melody x))
    (and (sequential? x) (not (node? x))) (expand (into [:seq] x))
    :else (first (expand* x {} 0 nil))))

(defn expand-source
  "Expands a written tree remembering, in each node's metadata, where it was written ({:src path},
   {:sub [i]} inside a melody string), and in the root which box it comes from ({:from :b2}): a score
   that shows it can then edit the written tree."
  [t box-id]
  (vary-meta (first (expand* t {} 0 [])) assoc :from box-id))

;; ───────── time: flattening ─────────

(defn- add-ev [acc ev] (conj! acc ev))

(defn place
  "Places node n at t (beats) with a time scale; adds its events to acc and returns where it ends."
  [n t scale ctx acc]
  (let [tg (tag n) a (attrs n)]
    (cond
      (= :note tg)
      (let [d (* scale (or (:dur a) (:dur ctx) 1)) m (midi-of a)]
        (when m
          (add-ev acc (merge (dissoc a :pitch :hz :cents :dur :at :id)
                             {:kind :note :t t :dur d :pitch m :voice (:voice ctx) :path (:path ctx)}
                             (when (:id a) {:id (:id a)}))))
        (+ t d))

      (= :rest tg) (+ t (* scale (or (:dur a) (:dur ctx) 1)))

      (mark-tags tg)
      (do (add-ev acc (merge (dissoc a :at) {:kind tg :t t :dur (* scale (or (:dur a) 0)) :voice (:voice ctx) :path (:path ctx)}))
          t)

      (= :chord tg)
      (let [d (* scale (or (:dur a) (:dur ctx) 1))]
        (doseq [[i k] (map-indexed vector (kids n)) :when (node? k)]
          (place k t 1 {:voice (:voice ctx) :dur d :path (conj (:path ctx) i)} acc))
        (+ t d))

      (block-tags tg)
      (let [ctx (cond-> ctx (:tempo a) (assoc :tempo (:tempo a)))]
        (loop [ks (map-indexed vector (kids n)) cur t end t]
          (if (empty? ks)
            (max cur end)
            (let [[i k] (first ks)]
              (if-not (node? k)
                (recur (rest ks) cur end)
                (let [ka (attrs k) c2 (assoc ctx :path (conj (:path ctx) i) :dur nil)]
                  (cond
                    (some? (:at ka)) (recur (rest ks) cur (max end (place k (+ t (* scale (:at ka))) scale c2 acc)))
                    (#{:voice :par} (tag k)) (recur (rest ks) cur (max end (place k t scale c2 acc)))
                    :else (let [e (place k cur scale c2 acc)] (recur (rest ks) e (max end e))))))))))

      (par-tags tg)
      (let [ctx ctx]
        (reduce (fn [end [i k]]
                  (if (node? k)
                    (let [at (:at (attrs k))
                          s (+ t (* scale (or at 0)))
                          e (place k s scale (assoc ctx :path (conj (:path ctx) i) :dur nil) acc)]
                      (max end e))
                    end))
                t (map-indexed vector (kids n))))

      (seq-tags tg)
      (let [scale (cond
                    (and (= :tuplet tg) (vector? (:ratio a))) (let [[p q] (:ratio a)] (* scale (/ q p)))
                    :else scale)
            voice (if (= :voice tg) (or (:name a) (:id a) (str "v" (count (:path ctx)) "-" (last (:path ctx)))) (:voice ctx))]
        (loop [ks (map-indexed vector (kids n)) cur t prev nil]
          (if (empty? ks)
            cur
            (let [[i k] (first ks)]
              (if-not (node? k)
                (recur (rest ks) cur prev)
                (let [ka (attrs k)
                      durable (#{:note :rest :chord} (tag k))
                      prev (if (and durable (:dur ka)) (:dur ka) prev)
                      c2 {:voice voice :dur (when durable prev) :path (conj (:path ctx) i) :tempo (:tempo ctx)}]
                  (if (some? (:at ka))
                    (do (place k (+ t (* scale (:at ka))) scale c2 acc) (recur (rest ks) cur prev))
                    (recur (rest ks) (place k cur scale c2 acc) prev))))))))

      :else t)))

(defn events
  "The flat list of events of a tree, in time order: {:kind :note|:param|:dyn|:text, :t :dur (beats),
   :pitch (MIDI) for notes, :voice, :path (where it is in the tree), and every other key of the node}."
  [tree]
  (let [t (expand tree) acc (transient [])]
    (place t 0 1 {:path [] :voice nil} acc)
    (->> (persistent! acc)
         (map (fn [e] (-> e (update :t cv/round-to 6) (update :dur cv/round-to 6))))
         (sort-by (juxt :t (fn [e] (- (or (:pitch e) 0)))))
         vec)))

(defn duration "How long a tree lasts, in beats." [tree]
  (let [t (expand tree) acc (transient [])] (cv/round-to (place t 0 1 {:path []} acc) 6)))

(defn tempo-of [tree] (or (:tempo (attrs (expand tree))) 60))

(defn notes [tree] (filterv (fn [e] (= :note (:kind e))) (events tree)))

(defn pitches "The pitches, in time order (names when they are whole)." [tree] (mapv (comp pitch-name :pitch) (notes tree)))

(defn summary [tree]
  (try
    (let [es (events tree) ns (filter (fn [e] (= :note (:kind e))) es)
          vs (count (distinct (keep :voice ns)))]
      (str (count ns) " notes" (when (> vs 1) (str " · " vs " voices")) " · " (cv/fmt (duration tree)) " beats"
           (let [k (count (remove (fn [e] (= :note (:kind e))) es))] (when (pos? k) (str " · " k " marks")))))
    (catch :default e (str "error: " (.-message e)))))

;; ───────── checking ─────────

(defn problems
  "What is wrong in a tree (unknown tags, notes without pitch, measures that do not add up): a list of texts."
  [tree]
  (let [out (atom [])
        say (fn [& xs] (swap! out conj (apply str xs)))]
    (letfn [(go [n path]
              (cond
                (string? n) (try (melody n) (catch :default e (say (.-message e))))
                (not (node? n)) (say "not a node at " (pr-str path) ": " (pr-str n))
                :else
                (let [tg (tag n) a (attrs n)]
                  (when-not (known-tags tg) (say "unknown tag " tg " at " (pr-str path)))
                  (when (and (= :note tg) (nil? (midi-of a))) (say "a note without a pitch I understand at " (pr-str path) ": " (pr-str a)))
                  (when (and (:dur a) (not (and (number? (:dur a)) (>= (:dur a) 0)))) (say "a duration is a number of beats at " (pr-str path)))
                  (when (and (= :measure tg) (vector? (:meter a)))
                    (let [[p q] (:meter a) want (* p (/ 4 q))
                          got (try (duration (into [:seq] (kids n))) (catch :default _ nil))]
                      (when (and got (> (js/Math.abs (- got want)) 1e-6))
                        (say "measure " (pr-str path) " lasts " (cv/fmt got) " beats; its meter " p "/" q " asks for " (cv/fmt want)))))
                  (doseq [[i k] (map-indexed vector (kids n))] (go k (conj path i))))))]
      (go tree [])
      (when (empty? @out)
        (try (expand tree) (catch :default e (say (.-message e))))))
    @out))

(defn warning? "A problem that does not stop the tree from being read and played (a measure that does not add up)." [msg]
  (str/starts-with? msg "measure "))

(defn errors "The problems that make a tree unusable." [t] (vec (remove warning? (problems t))))
(defn warnings "The problems a tree can live with while it is being written." [t] (vec (filter warning? (problems t))))

;; ───────── reading (EDN text → tree) and writing (tree → text) ─────────

(defn read-tree
  "EDN text → tree (one form; several become a :seq). Only reads data: nothing is evaluated."
  [text]
  (let [forms (edn/read-string (str "[" text "\n]"))]
    (cond (empty? forms) nil
          (= 1 (count forms)) (first forms)
          :else (into [:seq] forms))))

(defn pp
  "A tree as text, one container per line, indented."
  ([tree] (pp tree 0))
  ([n depth]
   (if-not (node? n)
     (pr-str n)
     (let [a (attrs n) ks (kids n)
           head (str "[" (pr-str (tag n)) (when (seq a) (str " " (pr-str a))))
           nested? (some (fn [k] (and (node? k) (seq (kids k)))) ks)]
       (if (or (not nested?) (empty? ks))
         (str head (apply str (map (fn [k] (str " " (pp k 0))) ks)) "]")
         (str head
              (apply str (map (fn [k] (str "\n" (apply str (repeat (inc depth) " ")) (pp k (inc depth)))) ks))
              "]"))))))

;; ───────── conversions: canvas, freqt, score ─────────

(defn ->strokes
  "A tree as freqt data: one stroke per note (Hz over beats), with its glissando."
  [tree]
  (let [ns (notes tree)]
    {:strokes (into {}
                    (for [[i e] (map-indexed vector ns)
                          :let [t0 (:t e) d (max 0.01 (:dur e)) hz (cv/midi->hz (:pitch e))
                                g (or (:gliss e) [[0 0] [1 0]])
                                g (if (< (count g) 2) [[0 0] [1 0]] g)]]
                      [(keyword (str "t" (inc i)))
                       {:pts (mapv (fn [[x c]] [(cv/round-to (+ t0 (* d x)) 4) (cv/round-to (cv/cents->hz c hz) 3)]) g)}]))
     :gx nil :gy nil}))

(defn ->canvas
  "A tree as data for a generic canvas: time along X, pitch along a log Y."
  [tree]
  (let [d (->strokes tree)
        ys (mapcat (fn [[_ s]] (map second (:pts s))) (:strokes d))
        lo (if (seq ys) (/ (apply min ys) 1.2) 100) hi (if (seq ys) (* (apply max ys) 1.2) 1000)]
    (assoc d :ax {:x {:lo 0 :hi (max 1 (duration tree)) :log false} :y {:lo lo :hi hi :log true}})))

(defn <-strokes
  "Freqt (or canvas) data as a tree: one note per stroke, placed with :at; bends become :gliss."
  [d]
  (into [:voice {:name "strokes"}]
        [(into [:par]
               (for [[_ s] (cv/sorted-strokes d)
                     :let [pts (:pts s) [t0 f0] (first pts) [t1 _] (peek pts)
                           m (cv/hz->midi f0) mr (js/Math.round m)
                           dur (max 0.01 (- t1 t0))
                           g (mapv (fn [[t f]] [(cv/round-to (/ (- t t0) dur) 3) (cv/round-to (cv/hz->cents f (cv/midi->hz mr)) 1)]) pts)
                           flat? (every? (fn [[_ c]] (< (js/Math.abs (- c (second (first g)))) 1)) g)]]
                 [:note (cond-> {:at (cv/round-to t0 4) :dur (cv/round-to dur 4)
                                 :pitch (if (< (js/Math.abs (- m mr)) 0.02) (pitch-name mr) (cv/round-to m 2))}
                          (not flat?) (assoc :pitch (pitch-name mr) :gliss g))]))]))

(defn ->voice
  "A tree as the voice data kairotic.score draws approximately (a sixteenth grid)."
  [tree]
  (let [ns (notes tree)]
    {:tempo (tempo-of tree) :meter [4 4]
     :events (into {} (for [[i e] (map-indexed vector ns)
                            :let [m (:pitch e) mr (js/Math.round m) dv (js/Math.round (* 100 (- m mr)))]]
                        [(keyword (str "e" (inc i)))
                         (cond-> {:t (:t e) :pitch (max 0 (min 127 mr)) :dur (max 0.25 (:dur e))}
                           (>= (js/Math.abs dv) 5) (assoc :txt (str (when (pos? dv) "+") dv)))]))}))

;; ───────── measured notation (MEI) ─────────
;; When a voice is written in :measure nodes, each one becomes a bar: notes, rests, chords and tuplets
;; as written, with dynamics, articulations and texts. Without measures, the score is an approximation
;; on a sixteenth grid (kairotic.score).

(def mei-durs [[4 "1" 0] [3 "2" 1] [2 "2" 0] [1.5 "4" 1] [1 "4" 0] [0.75 "8" 1] [0.5 "8" 0]
               [0.375 "16" 1] [0.25 "16" 0] [0.1875 "32" 1] [0.125 "32" 0] [0.0625 "64" 0]])

(defn split-dur
  "A duration in beats as written values ([beats mei-dur dots] …), tied when it needs more than one."
  [d]
  (loop [left d out []]
    (if (or (< left 0.03) (> (count out) 8))
      (if (empty? out) [[d "64" 0]] out)
      (let [[b du dots] (or (first (filter (fn [[b]] (<= b (+ left 1e-6))) mei-durs)) (peek mei-durs))]
        (recur (- left b) (conj out [b du dots]))))))

(def artic-names {:staccato "stacc" :accent "acc" :tenuto "ten" :marcato "marc" :staccatissimo "stacciss"
                  :fermata nil :spiccato "spicc" :up-bow "upbow" :down-bow "dnbow"})

(defn esc-xml [s] (-> (str s) (str/replace "&" "&amp;") (str/replace "<" "&lt;") (str/replace "\"" "&quot;")))

(defn measured? [tree] (boolean (some (fn [x] (and (node? x) (= :measure (tag x)))) (tree-seq node? kids (expand tree)))))

(defn voices-of
  "The voices of a tree: its :voice nodes, or the whole tree as one voice."
  [t]
  (let [vs (filter (fn [x] (and (node? x) (= :voice (tag x)))) (tree-seq node? kids t))]
    (if (seq vs) (vec vs) [[:voice t]])))

(defn measures-of [v]
  (letfn [(go [n] (cond (not (node? n)) []
                        (= :measure (tag n)) [n]
                        :else (mapcat go (kids n))))]
    (vec (go v))))

(defn ->mei
  "Measured notation of a tree. Returns {:mei text :pieces [{:id :t :staff}]} (ids → beats, for cursors)."
  [tree pre]
  (let [t (explicit (expand tree))
        ;; the work in sections (or one), each with its voices; a voice is a staff, by name, across sections
        sections (letfn [(go [n] (cond (not (node? n)) []
                                       (= :section (tag n)) [n]
                                       :else (mapcat go (kids n))))]
                   (let [ss (vec (go t))] (if (seq ss) ss [t])))
        sec-voices (mapv (fn [sc] (vec (map-indexed (fn [i v] [(or (:name (attrs v)) (str "voice " (inc i))) v]) (voices-of sc))))
                         sections)
        staves (vec (distinct (mapcat (fn [vs] (map first vs)) sec-voices)))
        staff-of (zipmap staves (map inc (range)))
        bar-list (vec (mapcat (fn [si vs]
                                (let [mss (mapv (fn [[k v]] [k (measures-of v)]) vs)
                                      n (reduce max 1 (map (comp count second) mss))]
                                  (for [i (range n)]
                                    {:cells (into {} (for [[k ms] mss :let [m (get ms i)] :when m] [k m]))
                                     :label (when (and (zero? i) (> (count sections) 1)) (:name (attrs (nth sections si))))
                                     :end (and (= i (dec n)) (< si (dec (count sections))))})))
                              (range) sec-voices))
        nbars (count bar-list)
        meter-at (fn [i] (or (some (fn [j] (some (fn [m] (:meter (attrs m))) (vals (:cells (nth bar-list j)))))
                                   (reverse (range (inc (max 0 (min i (dec nbars)))))))
                             [4 4]))
        counter (atom 0)
        nid (fn [] (str "m-" pre (swap! counter inc)))
        pieces (atom [])
        ctrl (atom {})                       ; bar → control events (dynam, dir, hairpin, tie)
        ctl! (fn [bar x] (swap! ctrl update bar (fnil conj []) x))
        bar-start (atom {})
        _ (reduce (fn [acc i] (swap! bar-start assoc i acc) (let [[p q] (meter-at i)] (+ acc (* p (/ 4 q))))) 0 (range (inc nbars)))
        tstamp (fn [bar beat] (let [[_ q] (meter-at bar)] (cv/round-to (inc (* beat (/ q 4))) 4)))
        where (fn [abs]                      ; absolute beat → [bar beat-in-bar]
                (let [bar (or (last (filter (fn [i] (<= (get @bar-start i) (+ abs 1e-6))) (range nbars))) 0)]
                  [bar (- abs (get @bar-start bar))]))
        note-xml (fn [a staff abs id durattr art? src]
                   (let [m (midi-of a) mr (js/Math.round m) pc (mod mr 12) dv (js/Math.round (* 100 (- m mr)))
                         acc (case (nth pc-names pc) ("c#" "d#" "f#" "g#" "a#") "s" nil)
                         arts (when art? (let [x (:art a) xs (if (sequential? x) x (when x [x]))]
                                           (seq (keep (fn [k] (get artic-names (keyword k))) xs))))]
                     (swap! pieces conj {:id id :t abs :staff staff :src src})
                     (str "<note xml:id=\"" id "\" pname=\"" (subs (nth pc-names pc) 0 1) "\" oct=\"" (dec (js/Math.floor (/ mr 12))) "\""
                          (when acc (str " accid=\"" acc "\"")) durattr
                          (when arts (str " artic=\"" (str/join " " arts) "\""))
                          (if (>= (js/Math.abs dv) 5)
                            (str "><verse n=\"1\"><syl>" (when (pos? dv) "+") dv "</syl></verse></note>")
                            "/>"))))
        marks! (fn [a staff bar id]
                 (when-let [d (:dyn a)] (ctl! bar (str "<dynam staff=\"" staff "\" startid=\"#" id "\">" (esc-xml d) "</dynam>")))
                 (when-let [x (:text a)] (ctl! bar (str "<dir staff=\"" staff "\" startid=\"#" id "\"><rend fontstyle=\"italic\">" (esc-xml x) "</rend></dir>"))))
        ;; writes the children of a container; scale converts written beats to sounding beats (tuplets)
        layer (fn layer [ks staff bar abs scale]
                (loop [ks ks abs abs out ""]
                  (if (empty? ks)
                    [out abs]
                    (let [k (first ks) a (attrs k) tg (tag k)]
                      (cond
                        (not (node? k)) (recur (rest ks) abs out)
                        (mark-tags tg)
                        (let [[b beat] (where abs)]
                          (case tg
                            :dyn (let [mk (str (:mark a))]
                                   (if (#{"<" ">"} mk)
                                     (let [[b2 beat2] (where (+ abs (* scale (or (:dur a) 1))))]
                                       (ctl! b (str "<hairpin staff=\"" staff "\" form=\"" (if (= "<" mk) "cres" "dim") "\" tstamp=\"" (tstamp b beat)
                                                    "\" tstamp2=\"" (- b2 b) "m+" (tstamp b2 beat2) "\"/>")))
                                     (ctl! b (str "<dynam staff=\"" staff "\" tstamp=\"" (tstamp b beat) "\">" (esc-xml mk) "</dynam>"))))
                            :text (ctl! b (str "<dir staff=\"" staff "\" tstamp=\"" (tstamp b beat) "\"><rend fontstyle=\"italic\">" (esc-xml (:text a)) "</rend></dir>"))
                            nil)
                          (recur (rest ks) abs out))
                        (= :tuplet tg)
                        (let [[p q] (or (:ratio a) [3 2])
                              [inner end] (layer (kids k) staff bar abs (* scale (/ q p)))]
                          (recur (rest ks) end (str out "<tuplet num=\"" p "\" numbase=\"" q "\" bracket.visible=\"true\" num.visible=\"true\">" inner "</tuplet>")))
                        (#{:seq :section :voice} tg)
                        (let [[inner end] (layer (kids k) staff bar abs scale)] (recur (rest ks) end (str out inner)))
                        (#{:note :rest :chord} tg)
                        (let [d (or (:dur a) 1)
                              parts (split-dur d)
                              [b _] (where abs)
                              xml (loop [ps parts pabs abs prev-ids nil acc ""]
                                    (if (empty? ps)
                                      acc
                                      (let [[pb du dots] (first ps)
                                            durattr (str " dur=\"" du "\"" (when (pos? dots) " dots=\"1\""))
                                            first? (nil? prev-ids)
                                            [x ids] (case tg
                                                      :rest (let [id (nid)] (swap! pieces conj {:id id :t pabs :staff staff :src (meta k)})
                                                              [(str "<rest xml:id=\"" id "\"" durattr "/>") nil])
                                                      :note (let [id (nid)] [(note-xml a staff pabs id durattr first? (meta k)) [id]])
                                                      :chord (let [cid (nid)
                                                                   ns (filter (fn [n] (and (node? n) (= :note (tag n)) (midi-of (attrs n)))) (kids k))
                                                                   ids (mapv (fn [_] (nid)) ns)]
                                                               [(str "<chord xml:id=\"" cid "\"" durattr
                                                                     (let [x (:art a) xs (if (sequential? x) x (when x [x]))
                                                                           arts (seq (keep (fn [kk] (get artic-names (keyword kk))) xs))]
                                                                       (when (and first? arts) (str " artic=\"" (str/join " " arts) "\"")))
                                                                     ">"
                                                                     (apply str (map (fn [n id] (note-xml (attrs n) staff pabs id "" first? (meta n))) ns ids))
                                                                     "</chord>")
                                                                ids]))]
                                        (when (and first? (seq ids)) (marks! a staff b (first ids)))
                                        (when (and prev-ids ids)
                                          (doseq [[s e] (map vector prev-ids ids)]
                                            (ctl! b (str "<tie startid=\"#" s "\" endid=\"#" e "\"/>"))))
                                        (recur (rest ps) (+ pabs (* scale pb)) ids (str acc x)))))]
                          (recur (rest ks) (+ abs (* scale d)) (str out xml)))
                        :else (recur (rest ks) abs out))))))
        clefs (mapv (fn [k] (let [ps (for [vs sec-voices [kk v] vs :when (= kk k)
                                           n (tree-seq node? kids v) :when (= :note (tag n))
                                           :let [m (midi-of (attrs n))] :when m] m)
                                  mean (if (seq ps) (/ (reduce + ps) (count ps)) 64)]
                              (if (< mean 57) ["F" 4] ["G" 2])))
                    staves)
        bars (vec (for [i (range nbars)
                        :let [{:keys [cells label end]} (nth bar-list i)
                              staff-xml (apply str
                                               (for [k staves
                                                     :let [staff (staff-of k) m (get cells k)
                                                           [xml _] (if m (layer (kids m) staff i (get @bar-start i) 1) ["" 0])]]
                                                 (str "<staff n=\"" staff "\"><layer n=\"1\">"
                                                      (if (seq xml) xml (str "<mRest xml:id=\"" (nid) "\"/>"))
                                                      "</layer></staff>")))]]
                    (do (when (seq label)
                          (ctl! i (str "<dir staff=\"1\" tstamp=\"1\" place=\"above\"><rend fontweight=\"bold\">" (esc-xml label) "</rend></dir>")))
                        (str "<measure n=\"" (inc i) "\"" (when end " right=\"dbl\"") ">"
                             staff-xml
                             (apply str (get @ctrl i))
                             "</measure>"))))
        [p0 q0] (meter-at 0)]
    {:mei (str "<?xml version=\"1.0\" encoding=\"UTF-8\"?>"
               "<mei xmlns=\"http://www.music-encoding.org/ns/mei\" meiversion=\"5.0\">"
               "<meiHead><fileDesc><titleStmt><title>Kairotic</title></titleStmt><pubStmt/></fileDesc></meiHead>"
               "<music><body><mdiv><score>"
               "<scoreDef meter.count=\"" p0 "\" meter.unit=\"" q0 "\" key.sig=\"0\">"
               "<staffGrp" (when (> (count staves) 1) " bar.thru=\"false\"") ">"
               (apply str (for [[i [shape line]] (map-indexed vector clefs)
                                :let [k (nth staves i)]]
                            (str "<staffDef n=\"" (inc i) "\" lines=\"5\" clef.shape=\"" shape "\" clef.line=\"" line "\""
                                 (when (or (> (count staves) 1) (not (str/starts-with? k "voice "))) (str " label=\"" (esc-xml k) "\""))
                                 "/>")))
               "</staffGrp></scoreDef><section>"
               (apply str
                      (map-indexed (fn [i x]
                                     ;; a change of meter is written before its bar
                                     (if (and (pos? i) (not= (meter-at i) (meter-at (dec i))))
                                       (let [[p q] (meter-at i)] (str "<scoreDef meter.count=\"" p "\" meter.unit=\"" q "\"/>" x))
                                       x))
                                   bars))
               "</section></score></mdiv></body></music></mei>")
     :pieces (vec (sort-by :t @pieces))}))

(defn ->score
  "MEI for a score box: measured when the tree has measures, an approximation on a sixteenth grid if not."
  [tree pre]
  (if (measured? tree) (->mei tree pre) (sc/->mei-voice (->voice tree) pre)))

;; ───────── playing: change points for a synth and parameters ─────────

(defn schedule
  "What a player sends, in seconds: [[sec [[outlet value] …]] …]. Outlet 0: the Hz of the notes sounding
   (a list), sent after outlet 1: their ids (one voice per note, for synth~); outlet 2: parameters
   [name value] (ramps in small steps); outlet 3: marks [:dyn \"mf\"] [:text \"…\"]."
  [tree]
  (let [k (/ 60 (tempo-of tree))
        es (events tree)
        ns (filter (fn [e] (= :note (:kind e))) es)
        nid (into {} (map-indexed (fn [i e] [e (keyword (str "n" (inc i)))]) ns))
        hz-at (fn [e t] (let [u (if (pos? (:dur e)) (/ (- t (:t e)) (:dur e)) 0)
                              g (:gliss e)
                              c (if (and g (>= (count g) 2))
                                  (let [[[x0 c0] [x1 c1]] (or (first (filter (fn [[[a] [b]]] (<= a u b)) (partition 2 1 g)))
                                                              [(first g) (peek g)])]
                                    (if (= x0 x1) c1 (+ c0 (* (- c1 c0) (/ (- u x0) (- x1 x0))))))
                                  0)]
                          (cv/round-to (cv/cents->hz c (cv/midi->hz (:pitch e))) 3)))
        points (sort (distinct (concat (mapcat (fn [e] (concat [(:t e) (+ (:t e) (:dur e))]
                                                               (when (:gliss e) (map (fn [[x]] (+ (:t e) (* x (:dur e)))) (:gliss e)))))
                                               ns)
                                       [0])))
        sound (for [t points
                    :let [on (filter (fn [e] (and (<= (:t e) (+ t 1e-9)) (< (+ t 1e-9) (+ (:t e) (:dur e))))) ns)]]
                [(* k t) [[1 (mapv nid on)] [0 (mapv (fn [e] (hz-at e t)) on)]]])
        params (mapcat (fn [e]
                         (let [nm (:name e) v0 (:value e) v1 (:to e) d (:dur e)]
                           (if (and (number? v0) (number? v1) (pos? d))
                             (for [i (range 21)] [(* k (+ (:t e) (* d (/ i 20)))) [[2 [nm (cv/round-to (+ v0 (* (- v1 v0) (/ i 20))) 4)]]]])
                             [[(* k (:t e)) [[2 [nm v0]]]]])))
                       (filter (fn [e] (= :param (:kind e))) es))
        marks (for [e es :when (#{:dyn :text} (:kind e))]
                [(* k (:t e)) [[3 [(:kind e) (or (:mark e) (:text e))]]]])]
    (->> (concat sound params marks)
         (group-by first)
         (sort-by key)
         (mapv (fn [[t xs]] [t (vec (mapcat second xs))])))))

;; ───────── editing: operations on paths, and the difference between two trees ─────────
;; A path is the list of child indices from the root ([] is the root; attributes are not counted).
;; These operations are the events of a tree box's history (Study 20), so an edit is one node:
;;   [:set path x]        replaces the node (or string) at path
;;   [:attrs path {…}]    replaces its attributes
;;   [:insert path x]     inserts x so that it ends up at path
;;   [:remove path]       removes the node at path

(defn node-at "The node (or string) at path, or nil." [t path]
  (reduce (fn [n i] (when (and (node? n) (integer? i)) (get (kids n) i))) t path))

(defn- update-at [t path f]
  (if (empty? path)
    (f t)
    (let [i (first path) ks (kids t)]
      (if (and (node? t) (integer? i) (< -1 i (count ks)))
        (with-kids t (assoc ks i (update-at (get ks i) (rest path) f)))
        (throw (js/Error. (str "no node at " (pr-str path))))))))

(defn apply-op
  "The tree after one edit operation (or an error if its path does not exist)."
  [t [op path x]]
  (let [path (vec path)]
    (case op
      :set (update-at t path (constantly x))
      :attrs (update-at t path (fn [n] (if (node? n) (with-attrs n (or x {})) n)))
      :insert (do (when (empty? path) (throw (js/Error. "insert needs a parent")))
                  (update-at t (pop path)
                             (fn [n] (let [ks (kids n) i (max 0 (min (peek path) (count ks)))]
                                       (with-kids n (into (conj (subvec ks 0 i) x) (subvec ks i)))))))
      :remove (do (when (empty? path) (throw (js/Error. "the root cannot be removed")))
                  (update-at t (pop path)
                             (fn [n] (let [ks (kids n) i (peek path)]
                                       (if (< -1 i (count ks)) (with-kids n (into (subvec ks 0 i) (subvec ks (inc i)))) n)))))
      (throw (js/Error. (str "unknown edit " (pr-str op)))))))

(defn- lcs-pairs
  "Pairs [i j] of equal elements of a and b, in order (longest common subsequence)."
  [a b]
  (let [n (count a) m (count b)
        dp (make-array (* (inc n) (inc m)))
        at (fn [i j] (or (aget dp (+ (* i (inc m)) j)) 0))]
    (doseq [i (range (dec n) -1 -1) j (range (dec m) -1 -1)]
      (aset dp (+ (* i (inc m)) j)
            (if (= (nth a i) (nth b j)) (inc (at (inc i) (inc j))) (max (at (inc i) j) (at i (inc j))))))
    (loop [i 0 j 0 out []]
      (cond (or (>= i n) (>= j m)) out
            (= (nth a i) (nth b j)) (recur (inc i) (inc j) (conj out [i j]))
            (>= (at (inc i) j) (at i (inc j))) (recur (inc i) j out)
            :else (recur i (inc j) out)))))

(declare diff)

(defn- diff-kids [a b path]
  (let [anchors (lcs-pairs a b)
        bounds (concat [[-1 -1]] anchors [[(count a) (count b)]])
        segments (map (fn [[[i0 j0] [i1 j1]]] [(inc i0) i1 (inc j0) j1]) (partition 2 1 bounds))]
    ;; from right to left, so that the indices of what is still to do do not move
    (vec (mapcat (fn [[os oe ns ne]]
                   (let [olds (subvec a os oe) news (subvec b ns ne) k (min (count olds) (count news))]
                     (concat
                      (for [i (range (dec (count olds)) (dec k) -1)] [:remove (conj path (+ os i))])
                      (for [i (range k (count news))] [:insert (conj path (+ os i)) (nth news i)])
                      (mapcat (fn [i] (diff (nth olds i) (nth news i) (conj path (+ os i)))) (range (dec k) -1 -1)))))
                 (reverse segments)))))

(defn diff
  "The edit operations that turn tree a into tree b, node by node (as few as it reasonably can)."
  ([a b] (diff a b []))
  ([a b path]
   (cond
     (= a b) []
     (and (node? a) (node? b) (= (tag a) (tag b)))
     (vec (concat (diff-kids (kids a) (kids b) path)
                  (when (not= (attrs a) (attrs b)) [[:attrs path (attrs b)]])))
     :else [[:set path b]])))

(defn ops-summary "A short description of an edit, for the history and the REPL." [[op path x]]
  (str (name op) " " (pr-str path)
       (case op
         (:set :insert) (str " " (let [t (pr-str x)] (if (> (count t) 60) (str (subs t 0 57) "…") t)))
         :attrs (str " " (pr-str x))
         "")))
