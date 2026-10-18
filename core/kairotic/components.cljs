;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · components
;; Every box class is a component: a map of data and functions, registered by name.
;; The patch, the engine and the projection to code only consult this registry, so adding
;; a class (from the core, from a library or written by whoever uses the system) touches nothing else.
;;
;; {:class    "ramp"                        the first word of the box text
;;  :doc      "…"  :usage "ramp from to seconds [loop]"
;;  :license  "MPL-2.0"                     SPDX id
;;  :args     [[:min 0] [:max 1] [:initial :min] [:log false] [:name nil]]
;;                                           declared arguments, in order. The kind of the default decides how
;;                                           the words of the box text fill them: a number (or the key of an
;;                                           earlier argument) takes the next number; true/false is a flag that is
;;                                           on when its own name is written ("log"); anything else (nil, a
;;                                           string) takes the next free word, as a keyword. With :args, the m
;;                                           of :receive, :derive, :draw and :gesture gets :args as that map
;;                                           (without it, :args is the raw vector of words and numbers).
;;  :io       [2 1] | (fn [box] [inlets outlets])     box = {:text :args :data}
;;  :dynamic-io true                         its ports depend on something computed (lines are not pruned)
;;  :receive  (fn [m] result)                messages; pure. m = {:id :state :args :inlet :value :at :data
;;                                           :buffer :buffer-id}
;;                                           result = {:state :out [[o v]] :later [[at i v]] :effects [[k x]] :show v}
;;                                           The same value again must change nothing that is going on: data
;;                                           boxes send what they hold again after ■, when a line or a box
;;                                           before it is new, or in a room. A player does not start over, a
;;                                           learner does not learn it twice (compare with what :state keeps).
;;  :audio    {:create  (fn [ac box env] node)     box = {:text :args (raw) :data :id :state}, env = {:master …}
;;                                                 node = {:inlets [[AudioNode i]] :outlets [[AudioNode o]] …}
;;                                                 (an inlet can be an AudioParam: a signal is added to it)
;;             :effects {k (fn [node x at])}
;;             :key     (fn [box] x)        if it changes, the node is rebuilt
;;             :update  (fn [node box at])  with it, a new text does not rebuild the node: it gets the
;;                                          new box (:text :args …) instead (and its state is forgotten)
;;             :wired   (fn [node inlets])  after wiring: the set of inlets that receive a signal
;;             :feed    (fn [node data])    the buffer at its right inlet, whenever it changes (:reads-buffer)
;;             :dispose (fn [node])}
;;  :model    {:empty x :step (fn [d ev]) :load (fn [x]) :code (fn [id d] lines)}   box data with its own history
;;            With :source (fn [d] text), :read (fn [d text] d2) and :diff (fn [d d2] events) its data can
;;            also be read and edited as text, in the code window (discussion #30): read throws on bad
;;            text, and what diff returns is applied as one [:batch events] of the history.
;;  :display  :text | :canvas | :score | :code | :number | :msg | :bang     how the patch shows built-in boxes
;;  :views    [:code :score]                 the displays a box of this class can switch between, the first
;;                                           one its default: each box keeps its choice, (view :bN :score),
;;                                           and its data stays the same (discussion #30)
;;  :size     [width height] | (fn [box] [w h])  a box with its own view (drawing and gestures), handle not counted
;;  :view     shapes                        a shapes template (kairotic.shapes) whose values can be holes,
;;                                           keywords starting with $ (:$angle). Plain data: preferred over :draw
;;  :derive   (fn [m] {key value})          pure; the values for the holes of :view. Same m as :draw.
;;                                           Holes can also name an argument (:$min) or :shown, :w, :h
;;  :draw     (fn [m] shapes)               escape hatch; pure; m = {:shown :state :args :text :data :w :h};
;;                                           :shown is the last thing the box returned as :show
;;  :gesture  (fn [m] value)                dragging over the box; m = the one of :draw plus {:start :x :y :dx :dy :fine}
;;                                           (:start = what was shown on press; x, y local; dx, dy since the press;
;;                                           :fine with ⇧). The value reaches inlet 0 of the box itself while
;;                                           dragging. On release it is called once more with :up true, and
;;                                           what it returns stays in the history as (send :bN value) (a
;;                                           :gesture that ignores :up repeats its last value: knob, sliders)
;;  :persist  (fn [value] {arg value})      with :args: what a gesture leaves in the box text. On release, instead of
;;                                           (send! :bN value) the patch writes (text! :bN "class …") with these
;;                                           arguments, so the change stays in the work
;;  :parse    (fn [text] args)             instead of :args: reads the arguments from the whole box text (the
;;                                           functions of clojure.core as boxes read theirs as EDN)
;;  :language "faust"                       for code boxes
;;  :template "…"                           initial source of a code box
;;  :params   …                             parameters
;;  :reads-buffer true                      receives in m the canvas connected to its right inlet
;;  :patch    {:boxes … :lines …}          an abstraction: the class is a patch. Its inlet/inlet~ and
;;                                           outlet/outlet~ boxes, ordered left to right, are its ports, and
;;                                           $1 $2 … in the texts of its boxes take the words of the box text.
;;                                           The engine expands it in place (kairotic.engine/flatten-patch)
;;  :origin   :core | :work | :user
;;  :from     :bN}                          the box that defines a work class

(ns kairotic.components
  (:require [clojure.string :as str]
            [kairotic.score :as sc]
            [kairotic.canvas :as cv]))

(defonce registry (atom {}))
;; how a musical tree becomes a buffer of strokes (set by kairotic.mtboxes; kairotic.mt is not required here)
(defonce tree-buffer (atom nil))

(declare patch-io)

(defn define!
  "Registers (or replaces) a component. Returns its name. An abstraction (:patch) gets its ports
   from its inlet and outlet boxes."
  [klass-name d]
  (let [d (if (map? (:patch d))
            (assoc d :io (fn [_] (patch-io (:patch d))) :dynamic-io true :abstraction true)
            d)]
    (swap! registry assoc klass-name (merge {:display :text :origin :core :io [1 1]} d {:class klass-name})))
  klass-name)

;; classes that are not registered but can be made when a box asks for them (kairotic.corefns: the
;; functions of clojure.core): each is (fn [class-name] definition-or-nil). A registered class comes first.
(defonce fallbacks (atom []))

(defn lookup [klass-name]
  (or (get @registry klass-name)
      (some (fn [f] (f klass-name)) @fallbacks)))

;; ───────── text of a box ─────────

(defn klass [text] (first (str/split (str/trim (str text)) #"\s+")))

(defn token [s]
  (if (re-matches #"-?(\d+\.?\d*|\.\d+)(e-?\d+)?" s) (js/parseFloat s) (keyword s)))

(defn args-of [text] (mapv token (rest (remove str/blank? (str/split (str/trim (str text)) #"\s+")))))

(defn box-info [b] {:text (:text b) :args (args-of (:text b)) :data (:data b)})

(defn io
  "Inlets and outlets of a box (a map with :text and, if it has it, :data)."
  [b]
  (let [d (lookup (klass (:text b))) x (:io d)]
    (cond (fn? x) (x (box-info b)) (vector? x) x :else [1 1])))

(defn dynamic?
  "Ports that must not be pruned: computed ones (a compilation) and those of classes defined by the
   work itself or that do not exist yet, because they depend on when their definition is evaluated."
  [b]
  (let [d (lookup (klass (:text b)))]
    (boolean (or (nil? d) (:dynamic-io d) (= :work (:origin d))))))

(defn model-of [b] (:model (lookup (klass (:text b)))))

;; classes that became a view of another one: a box written with the old name is read as the new
;; class, in that view (discussion #30: a score box is a freqt shown as a score)
(def renamed {"score" ["freqt" :score]})

(defn upgrade-box
  "A box of a renamed class, as its new class in the matching view (its arguments kept); others unchanged."
  [b]
  (let [t (str/trim (str (:text b))) k (klass t)]
    (if-let [[nk v] (get renamed k)]
      (let [b (assoc b :text (str nk (subs t (count k))))]
        ;; the view it showed: its old default becomes v; another view it could show stays, if the new
        ;; class has it and it is not that class's default
        (if (or (nil? (:view b)) (= (:view b) v))
          (assoc b :view v)
          (let [vs (:views (lookup nk))]
            (if (and (some #{(:view b)} vs) (not= (:view b) (first vs))) b (dissoc b :view)))))
      b)))

(defn views-of "The displays a box can switch between (none, or one, if its class has no :views)." [b]
  (:views (lookup (klass (:text b)))))

(defn shown-as
  "How a box is shown: the view it chose, if its class offers it, or the :display of its class."
  [b]
  (let [d (lookup (klass (:text b))) v (:view b)]
    (if (and (keyword? v) (some #{v} (:views d))) v (or (:display d) :text))))

(defn source-of
  "The data of a box as text, to edit (a code box's source, or what its model's :source writes), or nil."
  [b]
  (let [m (model-of b)]
    (cond (fn? (:source m)) ((:source m) (or (:data b) (:empty m)))
          (= :code (:display (lookup (klass (:text b))))) (str (get-in b [:data :source]))
          :else nil)))

(defn own-view?
  "Does the box have its own view (a :draw or a :view)?"
  [b]
  (let [d (lookup (klass (:text b)))]
    (boolean (or (fn? (:draw d)) (some? (:view d))))))

(defn size-of
  "Size of a box's own view, bounded to something reasonable."
  [b]
  (let [s (:size (lookup (klass (:text b))))
        s (if (fn? s) (try (s (box-info b)) (catch :default _ nil)) s)]
    (if (and (sequential? s) (= 2 (count s)) (every? number? s))
      [(max 24 (min 480 (first s))) (max 16 (min 480 (second s)))]
      [64 64])))

;; ───────── patches inside patches ─────────
;; A sub-patch (an embedded `patch` box, or an instance of an abstraction) talks to the outside
;; through its inlet/outlet boxes: message ones (inlet, outlet) and audio ones (inlet~, outlet~)
;; share the numbering, ordered by their position from left to right, as in Max.

(def inlet-classes #{"inlet" "inlet~"})
(def outlet-classes #{"outlet" "outlet~"})

(defn patch-ports
  "The ids of a patch's inlet and outlet boxes, in port order: {:inlets [...] :outlets [...]}."
  [p]
  (let [of (fn [classes]
             (->> (:boxes p)
                  (filter (fn [[_ b]] (contains? classes (klass (:text b)))))
                  (sort-by (fn [[id b]] [(or (:x b) 0) (or (:y b) 0) (name id)]))
                  (mapv first)))]
    {:inlets (of inlet-classes) :outlets (of outlet-classes)}))

(defn patch-io [p] (let [{:keys [inlets outlets]} (patch-ports p)] [(count inlets) (count outlets)]))

(defn subpatch?
  "Is the box a sub-patch (embedded or an abstraction)?"
  [b]
  (let [k (klass (:text b))]
    (or (= k "patch") (map? (:patch (lookup k))))))

;; ───────── utilities for writing components ─────────

(defn parse-args
  "Fills a declared :args spec from the raw words and numbers of a box text (see the header)."
  [spec raw]
  (let [words (filter keyword? raw)
        flag-names (set (keep (fn [[k d]] (when (boolean? d) (name k))) spec))
        written (set (map name words))]
    (loop [[[k d :as item] & more] spec
           nums (filter number? raw)
           free (remove (fn [w] (flag-names (name w))) words)
           acc {}]
      (if-not item
        acc
        (cond
          (boolean? d) (recur more nums free (assoc acc k (if (contains? written (name k)) true d)))
          (or (number? d) (and (keyword? d) (contains? acc d)))
          (recur more (rest nums) free (assoc acc k (cond (seq nums) (first nums) (keyword? d) (get acc d) :else d)))
          :else (recur more nums (rest free) (assoc acc k (if (seq free) (first free) d))))))))

(defn num-text [x] (if (== x (js/Math.round x)) (str (js/Math.round x)) (str (/ (js/Math.round (* x 10000)) 10000))))

(defn args-text
  "The text of a box of class k whose arguments are `vals` (a map), written in the order of the :args
   spec of d: the numbers (those still at their default at the end are left out), then flags and words."
  [d k vals]
  (let [spec (:args d)
        dflt (fn [x] (if (keyword? x) (get vals x) x))
        nums (for [[a v] spec :when (or (number? v) (and (keyword? v) (not (boolean? v))))]
               [(get vals a (dflt v)) (dflt v)])
        nums (reverse (drop-while (fn [[v d0]] (= v d0)) (reverse nums)))
        flags (for [[a v] spec :when (and (boolean? v) (get vals a))] (name a))
        words (for [[a v] spec :when (not (or (number? v) (keyword? v) (boolean? v)))
                    :let [w (get vals a)] :when w] (if (keyword? w) (name w) (str w)))]
    (str/join " " (concat [k] (map (comp num-text first) nums) flags words))))

(defn args-for
  "The :args a component receives: the parsed map if it declares :args, else the raw vector."
  [d text]
  (let [raw (args-of text) spec (:args d)]
    (cond
      (fn? (:parse d)) ((:parse d) text)
      (and (sequential? spec) (every? (fn [x] (and (vector? x) (keyword? (first x)))) spec)) (parse-args spec raw)
      :else raw)))

(defn clamp
  "x between a and b (in either order)."
  [x a b] (max (min a b) (min (max a b) x)))

(defn nice
  "A value rounded to a sensible precision for display and sending."
  [v]
  (let [a (js/Math.abs v)
        e (cond (>= a 100) 1 (>= a 10) 10 (>= a 1) 100 :else 1000)]
    (/ (js/Math.round (* v e)) e)))

(defn to-unit
  "Where v lies between lo and hi, as 0…1 (logarithmically if log? and both are positive)."
  [v lo hi log?]
  (let [u (cond (= lo hi) 0
                (and log? (pos? lo) (pos? hi) (pos? v)) (/ (js/Math.log (/ v lo)) (js/Math.log (/ hi lo)))
                :else (/ (- v lo) (- hi lo)))]
    (if (js/isFinite u) (clamp u 0 1) 0)))

(defn from-unit
  "The value at u (0…1) between lo and hi, rounded with `nice`."
  [u lo hi log?]
  (let [u (clamp u 0 1)]
    (nice (if (and log? (pos? lo) (pos? hi)) (* lo (js/Math.pow (/ hi lo) u)) (+ lo (* u (- hi lo)))))))

(defn num-of [v] (cond (number? v) v (and (sequential? v) (number? (first v))) (first v) :else nil))
(defn map-num [f v] (cond (number? v) (f v) (sequential? v) (mapv (fn [x] (if (number? x) (f x) x)) v) :else v))
(defn r6 [x] (/ (js/Math.round (* x 1e6)) 1e6))
(defn tick? [v g] (and (vector? v) (= :tick (first v)) (or (nil? g) (= g (second v)))))
(def grain 0.01)

;; ───────── core: messages ─────────

(defn arit [op]
  (fn [{:keys [state args inlet value]}]
    (let [b (if (some? state) state (or (num-of (first args)) 0))]
      (cond (= inlet 1) {:state (or (num-of value) b)}
            (or (number? value) (sequential? value)) {:state b :out [[0 (map-num (fn [x] (op x b)) value)]]}
            :else {:state b}))))

(defn ramp [{:keys [state args inlet value at]}]
  (let [[a b s lp] args
        st (or state {:gen 0 :a (or (num-of a) 0) :b (or (num-of b) 1) :s (max 0.01 (or (num-of s) 1))
                      :loop (= lp :loop) :on false})
        start (fn [st a b s]
                (let [g (inc (:gen st))]
                  {:state (assoc st :gen g :a a :b b :s s :t0 at :on true)
                   :out [[0 a]] :show a :later [[(+ at grain) 0 [:tick g]]]}))]
    (cond
      (tick? value nil)
      (if (and (:on st) (tick? value (:gen st)))
        (let [u (/ (- at (:t0 st)) (:s st))]
          (cond
            (and (>= u 1) (:loop st)) (start st (:a st) (:b st) (:s st))
            (>= u 1) {:state (assoc st :on false) :out [[0 (:b st)]] :show (:b st)}
            :else (let [v (r6 (+ (:a st) (* u (- (:b st) (:a st)))))]
                    {:state st :out [[0 v]] :show v :later [[(+ at grain) 0 [:tick (:gen st)]]]})))
        {:state st})
      (= inlet 1) {:state (assoc st :loop (boolean (and (num-of value) (not (zero? (num-of value))))))}
      (= value :bang) (start st (:a st) (:b st) (:s st))
      (= value :stop) {:state (assoc st :on false :gen (inc (:gen st)))}
      (and (sequential? value) (= 3 (count value)) (every? number? value))
      (let [[a b s] value] (start st a b (max 0.01 s)))
      (number? value) {:state (assoc st :on false :gen (inc (:gen st))) :out [[0 value]] :show value}
      :else {:state st})))

(defn metro [{:keys [state args inlet value at]}]
  (let [st (or state {:on false :ms (max 5 (or (num-of (first args)) 500)) :gen 0})
        next-tick (fn [st] [[(+ at (/ (:ms st) 1000)) 0 [:tick (:gen st)]]])]
    (cond
      (tick? value nil) (if (and (:on st) (tick? value (:gen st)))
                          {:state st :out [[0 :bang]] :show :bang :later (next-tick st)}
                          {:state st})
      (= inlet 1) {:state (assoc st :ms (max 5 (or (num-of value) (:ms st))))}
      (or (= value 0) (= value :stop)) {:state (assoc st :on false :gen (inc (:gen st)))}
      (or (= value :bang) (number? value) (= value :start))
      (let [st (assoc st :on true :gen (inc (:gen st)))]
        {:state st :out [[0 :bang]] :show :bang :later (next-tick st)})
      :else {:state st})))

(defn counter [{:keys [state args inlet value]}]
  (let [[step mx mn] args
        step (or (num-of step) 1) mn (or (num-of mn) 0) mx (num-of mx)
        v (if (some? state) state mn)]
    (cond
      (= inlet 1) {:state (or (num-of value) v)}
      (= value :reset) {:state mn}
      (or (= value :bang) (number? value))
      (let [nv (r6 (+ v step)) nv (if (and mx (>= nv mx)) mn nv)]
        {:state nv :out [[0 v]] :show v})
      :else {:state v})))

(defn number-box [{:keys [state args value]}]
  (let [cur (if (some? state) state (or (num-of (first args)) 0))]
    (cond (= value :bang) {:state cur :out [[0 cur]] :show cur}
          (num-of value) (let [v (num-of value)] {:state v :out [[0 v]] :show v})
          :else {:state cur})))

(defn reader [{:keys [inlet value buffer buffer-id args]}]
  (cond
    ;; reader path [stroke]: a position from 0 to 1 along a stroke, in the order it was drawn → [x y]
    (and (zero? inlet) (num-of value) (some #{:path} args))
    (let [sid (first (remove #{:path} (filter keyword? args)))
          u (clamp (num-of value) 0 1)
          pts (when buffer (cv/stroke-for buffer sid))
          pt (when pts (cv/point-along buffer pts u))]
      (if pt
        {:out [[0 pt]] :show {:t u :from buffer-id :axis :path :pt pt}}
        {}))
    (and (zero? inlet) (num-of value))
    (let [axis (if (some #{:y} args) :y :x)
          t (num-of value) r (if buffer (cv/read-along buffer axis t) [])]
      ;; as in Max, first the right outlet (ids) and then the left one (values)
      {:out [[1 (mapv first r)] [0 (mapv second r)]] :show {:t t :from buffer-id :n (count r) :axis axis}})
    :else
    {}))

;; ───── what a canvas, freqt or score takes on its left inlet (issue #26) ─────
;; · a number: comes out on the left and moves the cursor (as a click does)
;; · a musical tree ([:voice …]): shown live over the buffer; (keep! :bN) writes it in
;; · an edit: changes the buffer, as one event of the history (the same as the commands of the REPL)
;;     [:stroke [[x y] …]] · [:stroke :t3 [[x y] …]] · [:note t pitch dur] (pitch: MIDI or "c4")
;;     [:move :t1 dx dy] · [:stretch :t1 k] · [:erase :t1] · [:clear]
;;     [:axis :x lo hi] · [:axis :y lo hi :log] · [:grid-x step cycles] · [:grid-y step] · [:tuning "19-tet" ref]
;;     [:batch [edit …]]: several at once, one event
;; · a question: the answer comes out on the left, nothing changes
;;     [:read x] (or [:read :y v]) → [[stroke value] …] · [:strokes] → [:t1 …] · [:get :t1] → its points
;;     [:count] · [:end] (where the last stroke ends) · [:range] / [:range :y] → [lo hi] · [:data] → the buffer

(def canvas-edits #{:stroke :note :move :stretch :erase :clear :axis :grid-x :grid-y :tuning :batch})
(def canvas-questions #{:read :strokes :get :count :end :range :data})

(defn canvas-edit?
  "An edit for a canvas (and not a musical tree: [:note {…}] is a node of a tree, [:note 0 \"c4\" 1] an edit)."
  [v]
  (and (vector? v) (contains? canvas-edits (first v))
       (or (not= :note (first v)) (cv/num? (second v)))))

(defn canvas-question? [v] (and (vector? v) (contains? canvas-questions (first v))))

(defn canvas-event
  "One message as an event of the buffer d (ids given to new strokes), or nil if it does not read."
  [d [op & args]]
  (case op
    :stroke (let [[a b] args] (if (keyword? a) [:stroke a b] [:stroke (cv/next-id d) a]))
    :note (let [[t p dur] args
                hz (cond (cv/num? p) (if (cv/generic? d) p (cv/midi->hz p))
                         (string? p) (some-> (sc/pitch p) cv/midi->hz))]
            (when (and (cv/num? t) (cv/num? dur) (pos? dur) hz)
              [:stroke (cv/next-id d) [[t (cv/round-to hz 3)] [(+ t dur) (cv/round-to hz 3)]]]))
    (:move :stretch :erase :clear) (into [op] args)
    :axis (let [[k lo hi lg] args]
            (cond (map? k) [:axis k]
                  (#{:x :y} k) [:axis (assoc (or (:ax d) cv/default-ax) k {:lo lo :hi hi :log (= lg :log)})]))
    :grid-x (let [[s cs] args] [:grid-x (if (map? s) s (when (cv/num? s) {:step s :cycles (or cs [])}))])
    :grid-y (let [[s] args] [:grid-y (if (map? s) s (when (cv/num? s) {:step s}))])
    :tuning (let [[x ref] args
                  base (cond (map? x) x
                             (string? x) (or (get cv/tunings (str/lower-case x)) (cv/parse-scl x)))]
              (when base [:tuning (cond-> base (cv/num? ref) (assoc :ref ref) (not (cv/num? ref)) (update :ref #(or % cv/default-ref)))]))
    nil))

(defn canvas-events
  "The messages (an edit, or [:batch [edits]]) as events of the buffer d, each one applied before the next
   is read (so new strokes get new ids); those that change nothing are left out."
  [d msg]
  (let [msgs (if (= :batch (first msg)) (filter vector? (second msg)) [msg])]
    (first (reduce (fn [[evs d] m]
                     (let [e (canvas-event d m) d2 (when e (cv/step d e))]
                       (if (and e (not= d2 d)) [(conj evs e) d2] [evs d])))
                   [[] d] msgs))))

(defn canvas-answer
  "The answer to a question about the buffer d."
  [d [q & args]]
  (case q
    :read (let [[a b] args] (if (#{:x :y} a) (cv/read-along d a b) (cv/read-along d :x a)))
    :strokes (mapv first (cv/sorted-strokes d))
    :get (get-in d [:strokes (first args) :pts])
    :count (count (:strokes d))
    :end (cv/end-t d)
    :range (vec (take 2 (if (= :y (first args)) (cv/y-range d) (cv/x-range d))))
    :data d
    nil))

(defn canvas-receiver
  "The left inlet of a canvas (empty: its buffer before anything is drawn)."
  [empty]
  (fn [{:keys [inlet value state data]}]
    (let [d (or data empty)]
      (cond
        (not (zero? inlet)) {:state state}
        (canvas-edit? value)
        (let [evs (canvas-events d value)]
          (if (seq evs)
            {:state state :effects [[:canvas-edit evs]]}
            {:state state :effects [[:print (str "canvas: " (pr-str value) " changes nothing (an id that is not there, or points it cannot take)")]]}))
        (canvas-question? value)
        (let [a (canvas-answer d value)] {:state state :out (if (some? a) [[0 a]] [])})
        (and (vector? value) (keyword? (first value)))
        {:state (assoc state :tree value) :show {:tree value}}
        (num-of value)
        {:state state :out [[0 (num-of value)]] :show (cond-> {:t (num-of value)} (:tree state) (assoc :tree (:tree state)))}
        :else {:state state}))))

(def canvas-box (canvas-receiver cv/empty))

(def canvas-model {:empty cv/generic-empty :step cv/step :load (fn [x] (cv/step cv/generic-empty [:load x])) :code cv/->code
                   :source cv/->source :read cv/read-source :diff cv/diff})
(def freqt-model {:empty cv/empty :step cv/step :load (fn [x] (cv/step cv/empty [:load x])) :code cv/->code
                  :source cv/->source :read cv/read-source :diff cv/diff})

(define! "loadbang" {:doc "Sends a bang when the engine starts (▶)." :io [0 1] :receive (fn [_] {:out [[0 :bang]]})})
(define! "bang" {:doc "A button: when pressed (or on receiving anything) it sends a bang." :io [1 1] :display :bang
                 :receive (fn [_] {:out [[0 :bang]] :show :bang})})
(define! "msg" {:doc "Message: when pressed it sends its content (a value, a list or a word such as stop)." :usage "msg 0 8 4"
                :io [1 1] :display :msg
                :receive (fn [{:keys [args]}] {:out [[0 (case (count args) 0 :bang 1 (first args) (vec args))]] :show :bang})})
(define! "number" {:doc "A draggable number; sends it when it changes or on receiving a bang." :usage "number [initial]"
                   :io [1 1] :display :number :receive number-box})
(define! "print" {:doc "Writes to the REPL whatever it receives." :io [1 0] :receive (fn [{:keys [value]}] {:effects [[:print value]]})})
(define! "mtof" {:doc "MIDI pitch → Hz (lists too)." :receive (fn [{:keys [value]}] (if (or (number? value) (sequential? value)) {:out [[0 (map-num cv/midi->hz value)]]} {}))})
(define! "ftom" {:doc "Hz → MIDI pitch (lists too)." :receive (fn [{:keys [value]}] (if (or (number? value) (sequential? value)) {:out [[0 (map-num cv/hz->midi value)]]} {}))})
(doseq [[op-name op] [["+" +] ["-" -] ["*" *] ["/" (fn [a b] (if (zero? b) 0 (/ a b)))]]]
  (define! op-name {:doc (str "Arithmetic: left inlet " op-name " argument (or the last thing that came in on the right); lists too.")
                    :usage (str op-name " n") :io [2 1] :receive (arit op)}))
(define! "metro" {:doc "Sends periodic bangs: 1 or bang starts it, 0 or stop stops it." :usage "metro ms" :io [2 1] :receive metro})
(define! "counter" {:doc "Each bang sends the value and advances one step; goes back to the minimum on reaching the maximum." :usage "counter step [max] [min]" :io [2 1] :receive counter})
(define! "ramp" {:doc "Linear motion: a bang (or [a b s]) goes from a to b in s seconds; a number jumps there." :usage "ramp a b s [loop]" :io [2 1] :receive ramp})
(define! "canvas" {:doc "Graphic buffer for any numeric data: strokes in a plane with axes of any range, linear or log ((axis :b1 :y -1 1)). A number on the inlet (or a click) comes out on the left; edits on the inlet ([:stroke pts], [:erase :t1], [:clear], [:batch [...]]) change it, and questions ([:read x], [:strokes], [:get :t1], [:data]) are answered on the left. The right outlet is the buffer for a reader, which can read it along X or Y."
                   :io [1 2] :display :canvas :receive (canvas-receiver cv/generic-empty) :model canvas-model})
(define! "freqt" {:doc "Graphic buffer of frequency over time: Hz on a log scale, time from 0, tunings (Scala) and bar grids, drawn as a canvas or as a score ((view :b1 :score), ⇄ in its header). A number on the inlet (or a click) comes out on the left; edits on the inlet ([:note t \"c4\" dur], [:stroke pts], [:erase :t1], [:clear], [:batch [...]]) change it, and questions ([:read t], [:strokes], [:end], [:data]) are answered on the left. The second outlet is the buffer for a reader. A musical tree on the inlet is shown over it, measured; shown as a score, the edits you make on that tree's notes leave by the third outlet ([:edit …]): connect it back to the tree box."
                  :io [1 3] :display :canvas :views [:canvas :score] :receive canvas-box :model freqt-model})
(define! "reader" {:doc "Reads the buffer (canvas, freqt) connected to its right inlet at the position that comes in on the left — along X, or along Y with `reader y`: ids on the right and the values on the left (every crossing). With `reader path [stroke]` a position from 0 to 1 travels along a stroke in the order it was drawn and gives [x y]."
                   :usage "reader [x|y|path [stroke]]"
                   :io [2 2] :receive reader :reads-buffer true})
(doseq [[n io] [["state" [1 1]] ["transition" [2 1]] ["instruction" [1 0]] ["region" [1 1]]]]
  (define! n {:doc "Kairotic class with no semantics yet." :io io}))

;; ───────── core: audio ─────────

;; synth~ moved to the package @kairotic/synth (Study 14)

(define! "osc~" {:doc "Sine oscillator. A number on the left changes its frequency; a signal on the left (from reader~, sig~…) is its frequency in Hz."
                 :usage "osc~ [hz]" :io [2 1]
                 :receive (fn [{:keys [inlet value]}] (if (and (zero? inlet) (num-of value)) {:effects [[:freq (num-of value)]]} {}))
                 :audio {:create (fn [ac c _] (let [o (.createOscillator ac) g (.createGain ac)
                                                    base (atom (or (num-of (first (:args c))) 440))]
                                                (set! (.. o -frequency -value) @base)
                                                (set! (.. g -gain -value) 0.15)
                                                (.connect o g) (.start o)
                                                {:osc o :base base :inlets [[(.-frequency o) 0]] :outlets [[g 0]]}))
                         :effects {:freq (fn [node x at] (reset! (:base node) x) (.linearRampToValueAtTime (.-frequency (:osc node)) x at))}
                         ;; with a signal on the left the frequency is only that signal
                         :wired (fn [node ins] (set! (.. (:osc node) -frequency -value) (if (contains? ins 0) 0 @(:base node))))
                         :dispose (fn [node] (try (.stop (:osc node)) (catch :default _ nil)))}})
(define! "gain~" {:doc "Gain: signal on the left, factor on the right — a number, or a signal (an envelope, a reader~) that then is the factor."
                  :usage "gain~ [factor]" :io [2 1]
                  :receive (fn [{:keys [inlet value]}] (if (and (= 1 inlet) (num-of value)) {:effects [[:gain (num-of value)]]} {}))
                  :audio {:create (fn [ac c _] (let [g (.createGain ac) base (atom (or (num-of (first (:args c))) 0.5))]
                                                 (set! (.. g -gain -value) @base)
                                                 {:g g :base base :inlets [[g 0] [(.-gain g) 0]] :outlets [[g 0]]}))
                          :effects {:gain (fn [node x at] (reset! (:base node) x) (.setTargetAtTime (.-gain (:g node)) x at 0.01))}
                          :wired (fn [node ins] (set! (.. (:g node) -gain -value) (if (contains? ins 1) 0 @(:base node))))}})
(defn dac-channels
  "The output channels of a dac~ (1-based): its numbers, or 1 2."
  [b] (let [cs (filterv (fn [x] (and (number? x) (>= x 1))) (:args b))] (if (seq cs) cs [1 2])))

(define! "dac~" {:doc "Audio output: each inlet is an output channel, the ones written after it (dac~ 1 2 by default; dac~ 1 2 3 4 … if the sound card has them)."
                 :usage "dac~ [channel …]"
                 :io (fn [b] [(count (dac-channels b)) 0]) :dynamic-io true
                 :receive (fn [_] {})
                 :audio {:create (fn [_ b env]
                                   {:inlets (vec (for [c (dac-channels b)]
                                                   [(or ((:channel env) (dec c)) (:silent env)) 0]))
                                    :outlets []})
                         :key (fn [b] (dac-channels b))}})

;; ───────── space ─────────
;; pan~ and space~ moved to the package @kairotic/spatial (Study 14)

;; ───────── core: ports of a sub-patch ─────────
;; Seen from inside, an inlet only has an outlet and an outlet only has an inlet; seen from
;; the parent patch they are the ports of the sub-patch box. They just pass on what arrives.

(defn pass-on [{:keys [value]}] {:out [[0 value]]})

(defn pass-audio [ac _ _]
  (let [g (.createGain ac)] {:inlets [[g 0]] :outlets [[g 0]] :g g}))

(define! "inlet" {:doc "An inlet of the sub-patch it is in (inlets are numbered left to right). Passes on the messages that arrive at it."
                  :io [0 1] :receive pass-on})
(define! "outlet" {:doc "An outlet of the sub-patch it is in (numbered left to right). Sends out of the sub-patch what arrives at it."
                   :io [1 0] :receive pass-on})
(define! "inlet~" {:doc "An audio inlet of the sub-patch it is in (numbered left to right, together with the message inlets)."
                   :io [0 1] :receive (fn [_] {}) :audio {:create pass-audio}})
(define! "outlet~" {:doc "An audio outlet of the sub-patch it is in (numbered left to right, together with the message outlets)."
                    :io [1 0] :receive (fn [_] {}) :audio {:create pass-audio}})

(defn listing
  "The registered components: [[class doc usage origin] …]."
  []
  (vec (for [[k d] (sort-by key @registry)] [k (:doc d) (:usage d) (:origin d)])))
