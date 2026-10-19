;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · presets (issue #35)
;; The keyframes of the history (◆ snapshots, takes kept from Perform) as presets of the work: switch to
;; one, morph between two, or make a new one from what changes and what remains among them.
;;
;; A configuration is what a preset holds: the text of every box, sub-patches included — its arguments,
;; and the values that controls keep in their text (a knob). Boxes that were added or removed, lines and
;; buffers are not part of it, so switching never rebuilds the patch. Configurations are keyed by the id
;; the engine knows a box by (:b5.b2 is :b2 inside the sub-patch :b5).
;;
;; This file is pure: the page reads the keyframes from the history and writes what these functions
;; return (app/page/15-presets.cljs). The `presets` box only asks the page to do it (an effect).

(ns kairotic.presets
  (:require [clojure.string :as str]
            [kairotic.components :as comp]
            [kairotic.release :as rel]))

;; ───────── configurations ─────────

(defn fid
  "The engine id of box `id` of the sub-patch at `path` (as kairotic.engine/flat-id)."
  [path id]
  (if (empty? path) id (keyword (str (str/join "." (map name path)) "." (name id)))))

(defn path-of
  "Back from an engine id to the ids that lead to it: :b5.b2 → [:b5 :b2]."
  [f]
  (mapv keyword (str/split (name f) #"\.")))

(defn configuration
  "The texts of the boxes of a patch and of its embedded sub-patches, by engine id."
  ([p] (configuration p []))
  ([p path]
   (reduce (fn [acc [id b]]
             (let [acc (assoc acc (fid path id) (str (:text b)))]
               (if (and (= "patch" (comp/klass (:text b))) (map? (:data b)))
                 (merge acc (configuration (:data b) (conj path id)))
                 acc)))
           (sorted-map) (:boxes p))))

(defn words [text] (vec (remove str/blank? (str/split (str/trim (str text)) #"\s+"))))

(defn num
  "The number a word writes, or nil."
  [w]
  (when (and (string? w) (re-matches #"-?(\d+\.?\d*|\.\d+)(e-?\d+)?" w)) (js/parseFloat w)))

(defn decimals
  "How many decimals a number is written with."
  [w]
  (let [[_ d] (re-matches #"-?\d*\.(\d+)" (str w))] (count d)))

;; ───────── controls: boxes that keep their value in their text ─────────

(defn- probe
  "What a :persist function makes of x (a map of arguments), or nil if it does not take it."
  [persist x]
  (try (let [m (persist x)] (when (and (map? m) (seq m)) m)) (catch :default _ nil)))

(defn control
  "The value a control box keeps in its text — a class with :persist and :args — as {:ks [argument …]
   :v value :log bool :d definition}, or nil for any other box. The value is a number (a knob: [:initial])
   or a vector of numbers (an envelope keeps [a d s r], a pad [x y]): which arguments hold it is asked of
   :persist itself."
  [text]
  (let [d (comp/lookup (comp/klass text))]
    (when (and d (fn? (:persist d)) (sequential? (:args d)))
      (let [args (comp/args-for d text)]
        (when (map? args)
          (if-let [m (probe (:persist d) 1)]
            (let [k (first (keys m)) v (get args k)]
              (when (and (= 1 (count m)) (number? v))
                {:ks [k] :v v :log (true? (:log args)) :d d}))
            ;; a vector: the place of each argument is the number it got from [1 2 3 …]
            (when-let [m (probe (:persist d) (vec (range 1 17)))]
              (let [ks (mapv key (sort-by val (filter (fn [[_ x]] (number? x)) m)))
                    v (mapv (fn [k] (get args k)) ks)]
                (when (and (= (count ks) (count m)) (every? number? v))
                  {:ks ks :v v :log false :d d})))))))))

(defn control-text
  "The text of a control with the value v kept in it, as a drag leaves it on release."
  [text v]
  (when-let [{:keys [d]} (control text)]
    (when-let [m (probe (:persist d) v)]
      (comp/args-text d (comp/klass text) (merge (comp/args-for d text) m)))))

;; ───────── recall: switch to a configuration ─────────

(defn recall-changes
  "The boxes that are both now and in the target and whose text differs there: {id text}."
  [now target]
  (into (sorted-map)
        (for [[f t] target :let [t0 (get now f)] :when (and (some? t0) (not= (words t0) (words t)))] [f t])))

;; ───────── morph: between two configurations ─────────

(defn lerp
  "Between a and b at t (0…1); geometric if log? and both are positive (frequencies). Vectors of numbers
   (an envelope) go element by element."
  [a b t log?]
  (cond
    (and (vector? a) (vector? b)) (mapv (fn [x y] (lerp x y t log?)) a b)
    (and log? (pos? a) (pos? b)) (* a (js/Math.pow (/ b a) t))
    :else (+ a (* (- b a) t))))

(defn between
  "A position x among n keyframes (1 = the first) as [a b t]: halfway from 1 to 2 is 1.5 → [1 2 0.5]."
  [x n]
  (cond (< n 2) [1 1 0]
        :else (let [x (max 1 (min n x))
                    a (min (dec n) (js/Math.floor x))]
                [a (inc a) (- x a)])))

(defn morph-values
  "The values the controls take at t between configurations a and b: {id value}. Only controls of the same
   class now, in a and in b; not those in `exclude` (the boxes that drive the morph); and only those that
   differ between a and b or whose text keeps another value now."
  ([now a b t] (morph-values now a b t #{}))
  ([now a b t exclude]
   (into (sorted-map)
         (for [[f tn] now
               :when (not (contains? exclude f))
               :let [ta (get a f) tb (get b f)]
               :when (and ta tb (= (comp/klass tn) (comp/klass ta) (comp/klass tb)))
               :let [cn (control tn) ca (control ta) cb (control tb)]
               :when (and cn ca cb (= (:ks cn) (:ks ca) (:ks cb))
                          (or (not= (:v ca) (:v cb)) (not= (:v cn) (:v ca))))]
           [f (lerp (:v ca) (:v cb) t (or (:log ca) (:log cb)))]))))

(defn keep-changes
  "The texts that keep the values of a morph ({id value}) in the controls now: {id text}."
  [now values]
  (into (sorted-map)
        (for [[f v] values :let [t (get now f) t2 (when t (control-text t v))]
              :when (and t2 (not= (words t) (words t2)))]
          [f t2])))

;; ───────── generate: what changes and what remains ─────────

(defn variation
  "What changes and what remains among configurations: for every box that is in all of them, with the same
   class and as many words, one entry per word — {:same w} if it is the same in all, {:lo :hi :int :places}
   for numbers that change (their range, whether all are whole, the decimals they are written with), or
   {:words [w …]} for words that change. Boxes that do not fit are left out."
  [cfgs]
  (if (empty? cfgs)
    (sorted-map)
    (into (sorted-map)
          (for [f (keys (first cfgs))
                :let [ws (mapv (fn [c] (when-let [t (get c f)] (words t))) cfgs)]
                :when (and (every? seq ws) (apply = (map count ws)) (apply = (map first ws)))]
            [f (vec (for [i (range (count (first ws)))
                          :let [col (mapv (fn [w] (nth w i)) ws) ns (map num col)]]
                      (cond (apply = col) {:same (first col)}
                            (every? some? ns) {:lo (apply min ns) :hi (apply max ns)
                                               :int (every? (fn [w] (zero? (decimals w))) col)
                                               :places (apply max (map decimals col))}
                            :else {:words (vec (sort (distinct col)))})))]))))

(defn rng
  "A generator of numbers in [0, 1) from a seed (mulberry32): the same seed, the same numbers."
  [seed]
  (let [s (atom (bit-or (js/Math.floor (or seed 0)) 0))]
    (fn []
      (let [x (swap! s (fn [x] (bit-or (+ x 0x6D2B79F5) 0)))
            t (js/Math.imul (bit-xor x (unsigned-bit-shift-right x 15)) (bit-or x 1))
            t (bit-xor t (+ t (js/Math.imul (bit-xor t (unsigned-bit-shift-right t 7)) (bit-or t 61))))]
        (/ (unsigned-bit-shift-right (bit-xor t (unsigned-bit-shift-right t 14)) 0) 4294967296)))))

(defn- fixed [v d] (str (js/parseFloat (.toFixed v d))))

(defn- pick-word [{:keys [same lo hi int places words]} log? rand]
  (cond
    (some? same) same
    words (nth words (min (dec (count words)) (js/Math.floor (* (rand) (count words)))))
    :else (let [u (rand)
                v (lerp lo hi u (and log? (pos? lo)))]
            (if int (str (js/Math.round v)) (fixed v (inc places))))))

(defn generate-changes
  "A new configuration from what changes and what remains among `cfgs`, for the boxes that are now: what is
   the same in all of them stays, numbers that change take a value within their range (geometric in a box
   written with log), words that change are one of theirs. `rand` gives numbers in [0, 1). {id text}."
  [now cfgs rand]
  (into (sorted-map)
        (for [[f spec] (variation cfgs)
              :let [t0 (get now f)]
              :when (some? t0)
              :let [log? (some (fn [s] (= "log" (:same s))) spec)
                    ws (mapv (fn [s] (pick-word s log? rand)) spec)]
              :when (not= ws (words t0))]
          [f (str/join " " ws)])))

;; ───────── the box ─────────

(defn- ask [x] {:state nil :effects [[:presets x]]})

(comp/define! "presets"
  {:doc "Presets from the keyframes of the history (◆ snapshots, takes kept): a number or a label recalls one, a position on the right morphs between two, a bang makes a new one from what changes and what remains."
   :usage "presets [label or number …]"
   :io [2 1]
   ;; presets kept in the box (issue #45): part of the patch, so they travel in its code, links and embeds.
   ;; A box that keeps presets uses them instead of the keyframes of the history.
   :model {:empty {:presets []}
           :step (fn [d [op x]] (case op :store {:presets (rel/sane-presets x)} :clear {:presets []} d))
           :load (fn [x] {:presets (rel/sane-presets (:presets x))})
           :code (fn [id d] (when (seq (:presets d)) [(str "(presets! " id " " (pr-str (:presets d)) ")")]))}
   :receive (fn [{:keys [inlet value state]}]
              (if (= inlet 1)
                (cond (not (number? value)) {}
                      ;; the same position again changes nothing
                      (= value (:x state)) {}
                      :else {:state {:x value} :effects [[:presets [:morph-at value]]]})
                (cond
                  (number? value) (if (integer? value)
                                    (ask [:recall value])
                                    {:effects [[:print "presets: a position between keyframes goes to the right inlet (1.5: halfway from 1 to 2)"]]})
                  (= value :bang) (ask [:generate nil])
                  (= value :keep) (ask [:keep])
                  (or (keyword? value) (string? value)) (ask [:recall (name value)])
                  (and (vector? value) (= :recall (first value))) (ask [:recall (second value)])
                  (and (vector? value) (= :generate (first value))) (ask [:generate (second value)])
                  (and (vector? value) (= :morph (first value)) (= 4 (count value)) (number? (nth value 3)))
                  (ask (into [:morph] (rest value)))
                  :else {:effects [[:print (str "presets: " (pr-str value) " is not understood: a number or a label recalls, bang generates, [:morph a b t], keep")]]})))})
