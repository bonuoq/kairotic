;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · lens: how a tree is written on staves, as a choice and not as part of the music (discussion #380)
;;
;; A tree holds only music: notes, durations, voices with their identity. A lens is a way of looking at it as
;; notation — how many staves, which voice on which staff, the clefs — and is not stored in the tree: a tree box keeps
;; only which lens it shows ([:open] by default, its name and parameters, as it keeps the layers it shows). A lens is
;; a pure function, tree → layout, written in EDN as its name and its parameters:
;;   :open                     open score: each voice on its own staff, from the highest to the lowest, its clef by
;;                             its range (treble, treble an octave down, bass) — {:order :tree} keeps the tree's order
;;   :closed                   closed score: two staves, the upper voices on a treble staff, the lower ones on a bass
;;                             staff (SA · TB) — {:upper 1} how many go on the upper one (half, by default)
;;   :grand                    the grand staff of a keyboard (Bach's inventions, suites, fugues): two staves joined by a
;;                             brace, the upper voices at home on the upper one and the lower ones on the lower one, as
;;                             in the closed score; a voice keeps its identity (its layer, its stems) and crosses to the
;;                             other staff only where it needs to — where its notes would need {:ledgers 2} or more
;;                             ledger lines on their own staff and fewer on the other —, a whole beat at a time (or a
;;                             tuplet, a chord), so that it does not jump staff note by note: MEI's cross-staff notes
;;   [:closed {:upper 1}]      a lens with its parameters
;; (layout t lens) says what a lens makes of a tree; (through t lens) is the tree as that lens writes it, the staves
;; and clefs on its voices (:staff, :clef: what kairotic.mt writes in MEI), to be engraved; the tree itself is left
;; as it was.
;;
;; What older trees carry of their layout (cac partimento's :staff and :clef on its voices, that quantize keeps) is
;; read by the open lens as a hint: a voice with a :staff or a :clef keeps it.
;;
;; To come (#380): in the grand staff, a clef change where a voice stays long in the other register, and voices that
;; move together merged into chords; the ottava systems, hand corrections by note :id, a lens
;; fixed as an edition, and the MEI written through the lens chosen.

(ns kairotic.lens
  (:require [clojure.string :as str]
            [kairotic.mt :as mt]
            [kairotic.optics :as o]))

;; ───────── the voices of a tree, as a lens sees them ─────────

(defn- midis [v]
  (vec (keep (fn [x] (when (= :note (mt/tag x)) (mt/midi-of (mt/attrs x))))
             (tree-seq mt/node? mt/kids (mt/expand v)))))

(defn voices
  "The voices of a tree as a lens sees them: [{:i :path :name :mean :lo :hi :midis :staff :clef}], in the tree's
   order (:staff and :clef what the voice carries, hints of an older layout)."
  [t]
  (let [ps (o/paths t :voices)]
    (vec (map-indexed
          (fn [i p]
            (let [v (o/get-in-node t p) a (if (= :voice (mt/tag v)) (mt/attrs v) {}) ms (midis v)]
              (cond-> {:i i :path p :name (str (or (:name a) (str "voice " (inc i)))) :midis ms}
                (seq ms) (assoc :mean (/ (reduce + ms) (count ms)) :lo (reduce min ms) :hi (reduce max ms))
                (some? (:staff a)) (assoc :staff (str (:staff a)))
                (some? (:clef a)) (assoc :clef (str (:clef a))))))
          ps))))

;; ───────── clefs ─────────

;; the lowest and highest lines of each clef's staff, as MIDI notes
(def staff-lines {"G" [64 77] "F" [43 57] "G8" [52 65]})

(defn ledgers
  "How many ledger lines a note needs on a clef's staff (about: a line every three and a half semitones)."
  [clef m]
  (let [[lo hi] (get staff-lines clef) x (max 0 (- m hi) (- lo m))]
    (js/Math.floor (/ (+ x 0.5) 3.5))))

(defn- mean-ledgers [clef ms] (if (seq ms) (/ (reduce + (map #(ledgers clef %) ms)) (count ms)) 0))

(defn clef-by-range
  "The clef a voice's notes ask for: treble or bass, as kairotic.mt chooses them (by their mean); the treble an
   octave down (G8) only where it saves the ledger lines both of them need (a tenor's range)."
  [ms]
  (if (empty? ms)
    "G"
    (let [mean (/ (reduce + ms) (count ms))
          gf (if (< mean 57) "F" "G")]
      (if (and (<= (mean-ledgers "G8" ms) 0.25) (>= (mean-ledgers gf ms) 0.75)) "G8" gf))))

;; ───────── the lenses ─────────

(defn- by-register
  "The voices from the highest to the lowest (by the mean of their notes; a voice without notes stays after the one
   before it)."
  [vs]
  (let [keyed (reduce (fn [acc v] (conj acc [(or (:mean v) (:k (peek acc)) 1000) v])) [] vs)
        keyed (mapv (fn [[k v]] {:k k :v v}) keyed)]
    (mapv :v (sort-by (fn [{:keys [k v]}] [(- k) (:i v)]) keyed))))

(def satb {"soprano" "S" "alto" "A" "tenor" "T" "bass" "B"})

(defn- staff-name [names]
  (if (every? satb names) (str/join " " (map satb names)) (str/join " · " names)))

(defn- open-layout [vs {:keys [order]}]
  (let [vs (if (= order :tree) vs (by-register vs))]
    (mapv (fn [v] {:voice (:name v) :i (:i v)
                   :staff (or (:staff v) (:name v))
                   :clef (or (:clef v) (clef-by-range (:midis v)))
                   :hint (boolean (or (:staff v) (:clef v)))})
          vs)))

(defn- closed-layout [vs {:keys [upper]}]
  (let [vs (by-register vs) n (count vs)]
    (if (< n 2)
      (open-layout vs {})
      (let [u (max 1 (min (dec n) (or upper (js/Math.ceil (/ n 2)))))
            [up lo] (split-at u vs)
            hi-name (staff-name (map :name up)) lo-name (staff-name (map :name lo))]
        (vec (concat (map (fn [v] {:voice (:name v) :i (:i v) :staff hi-name :clef "G"}) up)
                     (map (fn [v] {:voice (:name v) :i (:i v) :staff lo-name :clef "F"}) lo)))))))

(defn- grand-layout [vs m]
  (mapv (fn [v up?] (assoc v :staff (if up? "upper" "lower") :clef (if up? "G" "F") :label false))
        (closed-layout vs m)
        (let [n (count vs) u (if (< n 2) (if (and (seq vs) (< (or (:mean (first vs)) 60) 57)) 0 1)
                                 (max 1 (min (dec n) (or (:upper m) (js/Math.ceil (/ n 2))))))]
          (concat (repeat u true) (repeat false)))))

;; ───────── crossing staves (the grand staff) ─────────

(defn- beat-of [meter]
  (let [[p q] (or meter [4 4])] (if (and (= q 8) (zero? (mod p 3)) (> p 3)) 1.5 (/ 4 q))))

(defn- events
  "The events of a voice that may cross, with where they start: [{:path :onset :group :midi}] — a note, or a chord
   (its notes' mean), or a tuplet's notes together (one group); onsets in beats from the voice's start."
  [v]
  (let [out (atom []) gid (atom 0)]
    (letfn [(dur [n] (or (:dur (mt/attrs n)) 1))
            (go [n path t meter mstart scale tg]
              (let [tag (mt/tag n) a (mt/attrs n)]
                (case tag
                  (:voice :seq :measure)
                  (let [meter (or (:meter a) meter) mstart (if (= tag :measure) t mstart)]
                    (reduce (fn [t [i k]] (go k (conj path i) t meter mstart scale tg)) t (map-indexed vector (mt/kids n))))
                  :tuplet
                  (let [[p q] (or (:ratio a) [3 2]) g (swap! gid inc)]
                    (reduce (fn [t [i k]] (go k (conj path i) t meter mstart (* scale (/ q p)) [:t g])) t (map-indexed vector (mt/kids n))))
                  :note
                  (let [m (mt/midi-of a)]
                    (when (and m (not (:grace a)))
                      (swap! out conj {:path path :onset t :midi m
                                       :group (or tg [:b mstart (js/Math.floor (/ (- t mstart) (beat-of meter)))])}))
                    (if (:grace a) t (+ t (* scale (dur n)))))
                  :chord
                  (let [ms (keep (fn [k] (when (= :note (mt/tag k)) (mt/midi-of (mt/attrs k)))) (mt/kids n))]
                    (when (seq ms)
                      (swap! out conj {:path path :onset t :midi (/ (reduce + ms) (count ms))
                                       :group (or tg [:b mstart (js/Math.floor (/ (- t mstart) (beat-of meter)))])}))
                    (+ t (* scale (dur n))))
                  :rest (+ t (* scale (dur n)))
                  t)))]
      (go v [] 0 [4 4] 0 1 nil)
      @out)))

(defn crossings
  "Where a voice at home on a staff (clef G or F) crosses to the other one: the paths (inside the voice) of the
   notes and chords drawn there. A note is a candidate where it needs `ledgers` or more ledger lines on its own staff
   and fewer on the other; a beat (or a tuplet) crosses when most of its notes are candidates, all of them together."
  [v home ledgers-max]
  (let [other ({"G" "F" "F" "G"} home)
        evs (events v)
        cand? (fn [{:keys [midi]}] (let [h (ledgers home midi)] (and (>= h ledgers-max) (< (ledgers other midi) h))))]
    (vec (mapcat (fn [[_ es]] (if (> (count (filter cand? es)) (/ (count es) 2)) (map :path es) []))
                 (sort-by (comp :onset first second) (group-by :group evs))))))

(def lenses
  {:open   {:doc "open score: each voice on its own staff, from the highest to the lowest, its clef by its range"
            :layout open-layout}
   :closed {:doc "closed score: the upper voices on a treble staff, the lower ones on a bass staff"
            :layout closed-layout}
   :grand  {:doc "a keyboard's grand staff: two staves in a brace, a voice crossing to the other where it needs to"
            :layout grand-layout :cross true}})

(defn spec
  "A lens as [name params]: nil is the open score; a name, or [name {params}]. Throws on a lens that is not known."
  [x]
  (let [[k m] (cond (nil? x) [:open {}]
                    (keyword? x) [x {}]
                    (and (vector? x) (keyword? (first x))) [(first x) (or (second x) {})]
                    :else (throw (js/Error. (str "A lens is a name (:open, :closed) or [name {params}], not " (pr-str x)))))]
    (when-not (contains? lenses k)
      (throw (js/Error. (str "No lens " (pr-str k) ": the lenses are " (str/join ", " (map pr-str (sort (keys lenses))))))))
    (when-not (map? m) (throw (js/Error. (str "A lens's parameters are a map: " (pr-str m)))))
    [k m]))

(defn layout
  "What a lens makes of a tree: {:lens [name params] :voices [{:voice :i :staff :clef} …] :staves [{:name :clef
   :voices […]} …]}, the voices and the staves in the order they are written."
  ([t] (layout t nil))
  ([t lens]
   (let [[k m :as sp] (spec lens)
         vs ((get-in lenses [k :layout]) (voices t) m)
         staves (reduce (fn [acc {:keys [staff clef voice]}]
                          (if-let [j (first (keep-indexed (fn [j s] (when (= staff (:name s)) j)) acc))]
                            (update-in acc [j :voices] conj voice)
                            (conj acc {:name staff :clef clef :voices [voice]})))
                        [] vs)]
     {:lens sp :voices vs :staves staves})))

(defn through
  "The tree as a lens writes it: its voices in the order of the layout, each with the :staff and :clef the lens gives
   it (what kairotic.mt writes in MEI). A tree that is one voice without a :voice node is left as it is."
  ([t] (through t nil))
  ([t lens]
   (let [[k m] (spec lens)
         cross? (get-in lenses [k :cross])
         ;; crossing staves needs every note's place in time: durations and meters written out
         t (if cross? (mt/with-meters (mt/explicit (mt/expand t))) t)
         {vs :voices} (layout t lens)
         ps (o/paths t :voices)
         ;; the notes a voice draws on the other staff, :cross with that staff's name
         t (if cross?
             (reduce (fn [t {:keys [i staff clef]}]
                       (let [p (nth ps i) other (if (= staff "upper") "lower" "upper")]
                         (reduce (fn [t q] (o/update-in-node t (into p q) (fn [n] (mt/update-attrs n assoc :cross other))))
                                 t (crossings (o/get-in-node t p) clef (or (:ledgers m) 2)))))
                     t vs)
             t)]
     (if (or (empty? vs) (= ps [[]]))
       t
       (let [by-i (into {} (map (fn [v] [(:i v) v]) vs))
             rank (into {} (map-indexed (fn [r v] [(:i v) r]) vs))
             ;; each voice with its staff and clef
             t2 (reduce (fn [t [i p]]
                          (let [{:keys [staff clef label]} (get by-i i)]
                            (o/update-in-node t p (fn [n] (mt/update-attrs n (fn [a] (cond-> (assoc a :clef clef)
                                                                                        (false? label) (assoc :staff-label false)
                                                                                        (not= staff (str (or (:name a) (str "voice " (inc i))))) (assoc :staff staff)
                                                                                        (= staff (str (or (:name a) (str "voice " (inc i))))) (dissoc :staff))))))))
                        t (map-indexed vector ps))
             ;; and in the order of the layout, among the kids of each node that holds voices
             parents (group-by (fn [[_ p]] (vec (butlast p))) (map-indexed vector ps))]
         (reduce (fn [t [pp ivs]]
                   (let [slots (mapv (fn [[_ p]] (last p)) ivs)
                         ordered (sort-by (fn [[i _]] (get rank i)) ivs)]
                     (o/update-in-node t pp
                                       (fn [n] (let [ks (mt/kids n)
                                                     moved (reduce (fn [ks [slot [_ p]]] (assoc ks slot (nth (mt/kids (o/get-in-node t2 pp)) (last p))))
                                                                   ks (map vector slots ordered))]
                                                 (mt/with-kids n moved))))))
                 t2 parents))))))
