;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · treecanvas
;; A tree box seen and drawn as a canvas (discussion #92): the tree is the data, the canvas one more view
;; of it, as the score and the code are. Its notes are strokes of frequency over time (each with an id
;; that leads back to where the note is written), and what is drawn on the canvas becomes edits of the
;; tree (kairotic.mt/apply-op), so the history stays a history of the tree.
;;
;;  · A tree without measures is free time: drawing adds a note placed with :at, dragging moves it,
;;    erasing removes it. A free tree is kept as [:voice {…} [:par [:note {:at t :dur d :pitch p} …]]];
;;    one written otherwise (a melody string, a sequence) takes that form the first time a note's time
;;    changes (a change of pitch alone is written where the note is).
;;  · A tree with measures stays measured: a change of pitch alone is written in the note; a change of
;;    time re-quantizes the bars it touches (kairotic.quantize, in that bar's meter); with ⌥ a note leaves
;;    the measures for a free voice of the tree ({:name "free"}), as a stroke drawn freehand does.
;;  · Its grid and tuning are attributes of the tree's root: {:grid {:step 0.25 :cycles [4]} :tuning {…}};
;;    a measured tree without :grid shows its bars, and a tree without :tuning is drawn in semitones
;;    (12-tet; :tuning false is continuous frequency).

(ns kairotic.treecanvas
  (:require [kairotic.canvas :as cv]
            [kairotic.mt :as mt]
            [kairotic.quantize :as qz]))

(def eps 1e-6)

;; ───────── the view ─────────

(defn- note-events [x] (filterv (fn [e] (= :note (:kind e))) (mt/events x)))

(defn- pts-of
  "The points of a note as a stroke: [t hz], its :gliss bending it."
  [e]
  (let [t0 (:t e) d (max 0.01 (:dur e)) hz (cv/midi->hz (:pitch e))
        g (let [g (:gliss e)] (if (and (sequential? g) (>= (count g) 2)) g [[0 0] [1 0]]))]
    (mapv (fn [[x c]] [(cv/round-to (+ t0 (* d x)) 4) (cv/round-to (cv/cents->hz c hz) 3)]) g)))

(defn- grid-of
  "The canvas grid of a tree: its root's :grid, else the bars of its first measure, else none."
  [x]
  (or (cv/sane-gx (:grid (mt/attrs x)))
      (when-let [m (first (mt/measures-of (first (mt/voices-of (mt/with-meters x)))))]
        (let [{[p q] :meter g :groups} (mt/meter-of m) u (/ 4 q)]
          {:step (min 0.25 u) :cycles (if (seq g) (mapv (fn [k] (* k u)) g) [(* p u)])}))))

(defn view-data
  "A tree as the data of a freqt-like canvas: {:strokes {:n1 {:pts …}} :gx :gy :ids {:n1 {…}}}, where :ids
   says for each stroke the note it is: its place in the expanded tree (:path), where it is written
   (:src :sub, or :rtm/:use when it is not written as a note), its voice, start, duration and pitch."
  [tree]
  (let [x (mt/expand-source (or tree [:voice]) nil)
        evs (note-events x)
        ids (into {} (map-indexed (fn [i e]
                                    (let [n (mt/node-at x (:path e)) m (meta n)]
                                      [(keyword (str "n" (inc i)))
                                       {:path (:path e) :src (:src m) :sub (:sub m) :rtm (:rtm m) :use (:use m)
                                        :voice (:voice e) :t (:t e) :dur (:dur e) :pitch (:pitch e)
                                        :attrs (mt/attrs n)}]))
                                  evs))]
    {:strokes (into {} (map-indexed (fn [i e] [(keyword (str "n" (inc i))) {:pts (pts-of e)}]) evs))
     :gx (grid-of x)
     ;; a tree is written in semitones unless it says otherwise: 12-tet, its :tuning, or false (continuous)
     :gy (let [a (mt/attrs x)]
           (if (contains? a :tuning) (cv/sane-gy (:tuning a)) (assoc (get cv/tunings "12-tet") :ref cv/default-ref)))
     :ids ids}))

;; ───────── strokes → notes ─────────

(defn- note-of-pts
  "The note a stroke is: placed at its first point, as long as it lasts, at the pitch of its first point
   (a name kept as it was when it still fits, see mt/set-midi), its bends a :gliss. was: the attributes the
   note had (its marks are kept)."
  [pts was]
  (let [[t0 f0] (first pts) [t1 _] (peek pts)
        m (cv/hz->midi f0) mr (js/Math.round m)
        dur (max 0.01 (- t1 t0))
        g (mapv (fn [[t f]] [(cv/round-to (/ (- t t0) dur) 3) (+ 0 (cv/round-to (cv/hz->cents f (cv/midi->hz mr)) 1))]) pts)
        flat? (every? (fn [[_ c]] (< (js/Math.abs (- c (second (first g)))) 1)) g)
        exact (if (< (js/Math.abs (- m mr)) 0.02) mr (cv/round-to m 2))
        base (dissoc (or was {}) :gliss :at :dur :tie :grace)
        a (if (some? (:pitch base)) (mt/set-midi base (if flat? exact mr)) (assoc base :pitch (if flat? exact mr)))]
    (cond-> (assoc (dissoc a :hz) :at (cv/round-to t0 4) :dur (cv/round-to dur 4))
      (not flat?) (assoc :gliss g))))

(defn free-form
  "A tree as free time: [:voice {its root's attributes} [:par [:note {:at …}] …]], every note placed where
   it sounds (ties joined), with the name it was written with."
  [tree]
  (let [x (mt/expand tree)
        root (dissoc (mt/attrs x) :at :dur)
        notes (for [e (note-events x)]
                (let [a (mt/attrs (mt/node-at x (:path e)))]
                  [:note (cond-> (merge (select-keys a [:art :dyn :text :vel :env :gliss :cents :id :grace])
                                        {:at (cv/round-to (:t e) 4) :dur (cv/round-to (:dur e) 4)
                                         :pitch (if (mt/spelling-of a) (:pitch a) (:pitch e))})
                           (number? (:hz a)) (-> (dissoc :pitch) (assoc :hz (:hz a))))]))]
    [:voice (dissoc root :meter :groups) (into [:par] notes)]))

(defn- canonical-free?
  "Is a tree written as free-form writes it (so that a note's path is [0 i])?"
  [tree]
  (and (mt/node? tree) (= :voice (mt/tag tree)) (= 1 (count (mt/kids tree)))
       (let [p (first (mt/kids tree))]
         (and (mt/node? p) (= :par (mt/tag p))
              (every? (fn [k] (and (mt/node? k) (= :note (mt/tag k)) (number? (:at (mt/attrs k))))) (mt/kids p))))))

;; ───────── where a note is written ─────────

(defn writable
  "Edits that make a written note editable (a melody string becomes its nodes) and the path of the note:
   [ops path], or nil when it comes from a fragment (:defs) or a proportional rhythm (:rtm)."
  [t {:keys [src sub use rtm]}]
  (cond
    (or use rtm (nil? src)) nil
    (nil? sub) [[] src]
    :else (let [s (mt/node-at t src) nodes (mt/melody s) parent (pop src) idx (peek src)]
            [(into [[:remove src]] (map-indexed (fn [k n] [:insert (conj parent (+ idx k)) n]) nodes))
             (into (conj parent (+ idx (first sub))) (rest sub))])))

(defn- not-written [info]
  (throw (js/Error. (if (:rtm info)
                      "That note comes from a proportional rhythm (:rtm): edit its :shares or :pitches"
                      "That note comes from a fragment (:defs): edit the fragment, or write it out"))))

;; ───────── measured trees: re-quantizing the bars a change touches ─────────

(defn- voice-nodes
  "The :voice nodes of x with the name mt/events gives their notes (:name, :id, or v<depth>-<index>), or
   the whole tree as one voice (named nil) when it has none."
  [x]
  (let [found (atom [])]
    (letfn [(go [n path]
              (when (mt/node? n)
                (if (= :voice (mt/tag n))
                  (swap! found conj [(or (:name (mt/attrs n)) (:id (mt/attrs n)) (str "v" (count path) "-" (last path))) n])
                  (doseq [[i k] (map-indexed vector (mt/kids n))] (go k (conj path i))))))]
      (go x []))
    (if (seq @found) @found [[nil x]])))

(defn- bars-of
  "The measures of each voice of the expanded tree x: {voice [{:src :start :len :attrs :meter} …]}."
  [x]
  (let [x (mt/with-meters x)]
    (into {} (for [[k v] (voice-nodes x)
                   :let [ms (mt/measures-of v)
                         lens (map (fn [m] (let [[p q] (:meter (mt/attrs m))] (* p (/ 4 q)))) ms)]]
               [k (mapv (fn [m s l] {:src (:src (meta m)) :use (:use (meta m)) :start s :len l :attrs (mt/attrs m)
                                     :meter (select-keys (mt/attrs m) [:meter :groups])})
                        ms (reductions + 0 lens) lens)]))))

(defn- voice-key
  "The key bars-of uses for an event's voice."
  [bars e]
  (if (contains? bars (:voice e)) (:voice e) (first (keys bars))))

(defn- requantize-bar
  "The new children of one measure (start s, length L, its meter) for these notes in free time
   ({:on :off :attrs}, beats): each one clipped to the bar, and tied (:tie) when it goes on past it."
  [notes {:keys [start len meter]}]
  (let [end (+ start len)
        inside (for [n notes :let [on (max (:on n) start) off (min (:off n) end)] :when (> off (+ on eps))]
                 {:on (- on start) :off (- off start)
                  :attrs (cond-> (:attrs n) (> (:off n) (+ end eps)) (assoc :tie true))})
        v (qz/notes->voice (vec inside) (qz/options {:meter meter :voices 1 :legato 0} nil))
        m (first (filter (fn [k] (and (mt/node? k) (= :measure (mt/tag k)))) (mt/kids v)))]
    (vec (mt/kids m))))

(defn- measured-ops
  "Ops that re-quantize, in the voice vk, the bars a change touches: the notes of that voice (as they
   sound) with `change` applied (a function of that list of notes), written again in every bar that
   touches [t0, t1]."
  [x bars vk change t0 t1]
  (let [bs (get bars vk)
        evs (filter (fn [e] (= (voice-key bars e) vk)) (note-events x))
        notes (change (mapv (fn [e] (let [a (mt/attrs (mt/node-at x (:path e)))]
                                      {:path (:path e) :on (:t e) :off (+ (:t e) (:dur e))
                                       :attrs (merge (select-keys a [:art :dyn :text :vel :env :gliss :cents :id])
                                                     {:pitch (if-let [s (mt/spelling-of a)] (:pitch a) (:pitch e))})}))
                            evs))
        touched (filter (fn [b] (and (< (:start b) (- t1 eps)) (> (+ (:start b) (:len b)) (+ t0 eps)))) bs)
        touched (if (seq touched) touched (take-last 1 bs))]
    (when (some (fn [b] (or (:use b) (nil? (:src b)))) touched)
      (throw (js/Error. "Those bars come from a fragment (:defs): write them out to edit them")))
    (vec (for [b touched]
           [:set (:src b) (into [:measure (:attrs b)] (requantize-bar notes b))]))))

(defn- free-voice-ops
  "Ops that put a note in the free voice of a measured tree ({:name \"free\"}), making it when there is none."
  [tree note]
  (let [free-i (when (= :par (mt/tag tree))
                 (first (keep-indexed (fn [i k] (when (and (mt/node? k) (= :voice (mt/tag k)) (= "free" (:name (mt/attrs k)))) i))
                                      (mt/kids tree))))]
    (if free-i
      (let [v (nth (mt/kids tree) free-i) p (first (mt/kids v))]
        (if (and (mt/node? p) (= :par (mt/tag p)))
          [[:insert [free-i 0 (count (mt/kids p))] note]]
          [[:insert [free-i (count (mt/kids v))] note]]))
      [[:set [] [:par (if (= :par (mt/tag tree)) (into [:par (mt/attrs tree)] (mt/kids tree)) tree)
                 [:voice {:name "free"} [:par note]]]]])))

;; ───────── canvas events → tree edits ─────────

(defn- root-attrs-op [tree f] [:attrs [] (f (mt/attrs tree))])

(defn edit-ops
  "The edits of the tree (mt/apply-op operations) that make a canvas event on its view: [:stroke id pts]
   (a new id draws a note), [:move id dt cents], [:stretch id k], [:erase id], [:clear], [:grid-x gx],
   [:tuning gy] or [:batch [events]]. opts: {:free true} takes a note of a measured tree out of the
   measures (⌥). Throws, saying why, for a note that is not written as one (:defs, :rtm)."
  ([tree ev] (edit-ops tree ev {}))
  ([tree [op & args :as ev] opts]
   (let [tree (or tree [:voice [:par]])]
     (case op
       :batch (loop [t tree evs (filter vector? (first args)) out []]
                (if (empty? evs)
                  out
                  (let [ops (edit-ops t (first evs) opts)]
                    (recur (reduce mt/apply-op t ops) (rest evs) (into out ops)))))
       :grid-x [(root-attrs-op tree (fn [a] (if-let [g (cv/sane-gx (first args))] (assoc a :grid g) (dissoc a :grid))))]
       (:tuning :grid-y) [(root-attrs-op tree (fn [a] (if-let [g (cv/sane-gy (first args))] (assoc a :tuning g) (assoc a :tuning false))))]
       :clear [[:set [] [:voice (dissoc (mt/attrs tree) :meter :groups) [:par]]]]
       (:stroke :move :stretch :erase)
       (let [v (view-data tree)
             v2 (cv/step (dissoc v :ids) ev)
             sid (if (and (= op :stroke) (keyword? (first args))) (first args) (first args))
             old (get-in v [:strokes sid :pts])
             new (get-in v2 [:strokes sid :pts])
             new (if (and (= op :stroke) (not (keyword? (first args)))) (cv/sane-pts (first args)) new)
             info (get-in v [:ids sid])
             measured? (mt/measured? tree)]
         (cond
           (and (not= op :stroke) (nil? info)) []
           (and (= op :stroke) (nil? new)) []
           ;; a new note
           (nil? old)
           (let [note [:note (note-of-pts new nil)]]
             (cond
               (and measured? (:free opts)) (free-voice-ops tree note)
               measured?
               (let [x (mt/expand-source tree nil) bars (bars-of x)
                     a (mt/attrs note) on (:at a) off (+ (:at a) (:dur a))
                     ;; the voice whose notes are nearest in pitch around there
                     evs (note-events x)
                     near (filter (fn [e] (< (js/Math.abs (- (:t e) on)) 8)) evs)
                     vk (if (seq near)
                          (voice-key bars (apply min-key (fn [e] (js/Math.abs (- (:pitch e) (mt/midi-of a)))) near))
                          (first (keys bars)))]
                 (measured-ops x bars vk (fn [ns] (conj ns {:on on :off off :attrs (dissoc a :at :dur)})) on off))
               (canonical-free? tree) [[:insert [0 (count (mt/kids (first (mt/kids tree))))] note]]
               :else (let [f (free-form tree)] (into [[:set [] f]] (edit-ops f ev opts)))))
           ;; erased
           (nil? new)
           (cond
             ;; in measures, an erased note leaves a rest as long (or leaves its chord)
             measured?
             (let [[pre target] (or (writable tree info) (not-written info))
                   t1 (reduce mt/apply-op tree pre)
                   n (mt/node-at t1 target)
                   in-chord? (= :chord (mt/tag (mt/node-at t1 (pop target))))
                   d (or (:dur (mt/attrs n)) (:dur (mt/attrs (mt/node-at (mt/explicit t1) target))) 1)]
               (conj pre (if in-chord? [:remove target] [:set target [:rest {:dur d}]])))
             (canonical-free? tree) [[:remove (:src info)]]
             :else (let [[pre target] (or (writable tree info) (not-written info))]
                     (conj pre [:remove target])))
           ;; changed
           :else
           (let [[a0 _] (first old) [a1 _] (peek old) [b0 _] (first new) [b1 _] (peek new)
                 same-time? (and (< (js/Math.abs (- a0 b0)) 1e-3) (< (js/Math.abs (- a1 b1)) 1e-3))
                 was (:attrs info)
                 changed (note-of-pts new was)]
             (cond
               ;; a change of pitch alone: in the note, wherever it is written
               (and same-time? (not (:free opts)))
               (let [[pre target] (or (writable tree info) (not-written info))
                     n (mt/node-at (reduce mt/apply-op tree pre) target)]
                 (conj pre [:attrs target (cond-> (merge (dissoc (mt/attrs n) :cents :hz :pitch) (dissoc changed :at :dur))
                                            (not (:gliss changed)) (dissoc :gliss))]))
               (and measured? (:free opts))
               (let [x (mt/expand-source tree nil) bars (bars-of x)
                     out (measured-ops x bars (voice-key bars {:voice (:voice info)})
                                       (fn [ns] (vec (remove (fn [n] (= (:path n) (:path info))) ns)))
                                       (:t info) (+ (:t info) (:dur info)))
                     t2 (reduce mt/apply-op tree out)]
                 (into out (free-voice-ops t2 [:note changed])))
               measured?
               (let [x (mt/expand-source tree nil) bars (bars-of x)
                     a changed]
                 (measured-ops x bars (voice-key bars {:voice (:voice info)})
                               (fn [ns] (conj (vec (remove (fn [n] (= (:path n) (:path info))) ns))
                                              {:on (:at a) :off (+ (:at a) (:dur a)) :attrs (dissoc a :at :dur)}))
                               (min (:t info) (:at a)) (max (+ (:t info) (:dur info)) (+ (:at a) (:dur a)))))
               (canonical-free? tree) [[:set (:src info) [:note (merge (dissoc was :gliss) changed)]]]
               :else (let [f (free-form tree)] (into [[:set [] f]] (edit-ops f ev opts)))))))
       []))))
