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
;;  :audio    {:create  (fn [ac box env] node)     env = {:master …}
;;                                                 node = {:inlets [[AudioNode i]] :outlets [[AudioNode o]] …}
;;             :effects {k (fn [node x at])}
;;             :key     (fn [box] x)        if it changes, the node is rebuilt
;;             :dispose (fn [node])}
;;  :model    {:empty x :step (fn [d ev]) :load (fn [x]) :code (fn [id d] lines)}   box data with its own history
;;  :display  :text | :canvas | :score | :code | :number | :msg | :bang     how the patch shows built-in boxes
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
;;                                           dragging, and on release stays in the history as (send :bN value)
;;  :language "faust"                       for code boxes
;;  :template "…"                           initial source of a code box
;;  :params   …                             parameters
;;  :reads-buffer true                      receives in m the canvas connected to its right inlet
;;  :origin   :core | :work | :user
;;  :from     :bN}                          the box that defines a work class

(ns kairotic.components
  (:require [clojure.string :as str]
            [kairotic.canvas :as cv]))

(defonce registry (atom {}))

(defn define!
  "Registers (or replaces) a component. Returns its name."
  [klass-name d]
  (swap! registry assoc klass-name (merge {:display :text :origin :core :io [1 1]} d {:class klass-name}))
  klass-name)

(defn lookup [klass-name] (get @registry klass-name))

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

(defn args-for
  "The :args a component receives: the parsed map if it declares :args, else the raw vector."
  [d text]
  (let [raw (args-of text) spec (:args d)]
    (if (and (sequential? spec) (every? (fn [x] (and (vector? x) (keyword? (first x)))) spec))
      (parse-args spec raw)
      raw)))

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

(defn reader [{:keys [inlet value buffer buffer-id]}]
  (if (and (zero? inlet) (num-of value))
    (let [t (num-of value) r (if buffer (cv/read-at buffer t) [])]
      ;; as in Max, first the right outlet (ids) and then the left one (frequencies)
      {:out [[1 (mapv first r)] [0 (mapv second r)]] :show {:t t :from buffer-id :n (count r)}})
    {}))

(defn canvas-box [{:keys [inlet value]}]
  (if (and (zero? inlet) (num-of value))
    {:out [[0 (num-of value)]] :show {:t (num-of value)}}
    {}))

(def canvas-model {:empty cv/empty :step cv/step :load (fn [x] (cv/step cv/empty [:load x])) :code cv/->code})

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
(define! "canvas" {:doc "Graphic buffer of frequency over time. A number on the inlet (or a click) comes out on the left; the right outlet is the buffer for a reader."
                   :io [1 2] :display :canvas :receive canvas-box :model canvas-model})
(define! "score" {:doc "The same buffer as a canvas, drawn as an approximate score." :io [1 2] :display :score :receive canvas-box :model canvas-model})
(define! "reader" {:doc "Reads the buffer connected to its right inlet at the position that comes in on the left: ids on the right and Hz on the left."
                   :io [2 2] :receive reader :reads-buffer true})
(doseq [[n io] [["state" [1 1]] ["transition" [2 1]] ["instruction" [1 0]] ["region" [1 1]]]]
  (define! n {:doc "Kairotic class with no semantics yet." :io io}))

;; ───────── core: audio ─────────

(defn voices!
  "synth~: each id is a voice. A new id attacks, one that continues glides its frequency to the new
   value at `at`, and one that disappears is switched off."
  [node pairs at]
  (let [ac (.-context (:out node)) vs @(:voices node) incoming (into {} pairs)]
    (doseq [[vid {:keys [osc g]}] vs :when (not (contains? incoming vid))]
      (.setTargetAtTime (.-gain g) 0 at 0.03)
      (.stop osc (+ at 0.4)))
    (reset! (:voices node)
            (into {}
                  (for [[vid hz] (take 16 pairs)]
                    (if-let [v (get vs vid)]
                      (do (.linearRampToValueAtTime (.-frequency (:osc v)) hz at) [vid v])
                      (let [o (.createOscillator ac) g (.createGain ac)]
                        (set! (.-type o) "triangle")
                        (.setValueAtTime (.-frequency o) hz at)
                        (.setValueAtTime (.-gain g) 0 at)
                        (.linearRampToValueAtTime (.-gain g) 0.2 (+ at 0.015))
                        (.connect o g)
                        (.connect g (:out node))
                        (.start o at)
                        [vid {:osc o :g g}])))))))

(defn synth [{:keys [state inlet value]}]
  (cond
    (= inlet 1) {:state (assoc state :ids (if (sequential? value) (vec value) [value]))}
    (number? value) {:state (dissoc state :ids) :effects [[:voices [[:v0 value]]]]}
    (sequential? value)
    (let [fs (filterv number? value)
          ids (:ids state)
          ids (if (= (count ids) (count fs)) ids (mapv (fn [i] (keyword (str "v" i))) (range (count fs))))]
      {:state (dissoc state :ids) :effects [[:voices (mapv vector ids fs)]]})
    (= value :stop) {:effects [[:voices []]]}
    :else {}))

(define! "synth~" {:doc "Polyphonic triangle-wave synthesizer: frequencies on the left, voice ids on the right."
                   :io [2 1] :receive synth
                   :audio {:create (fn [ac _ _] (let [out (.createGain ac)] (set! (.. out -gain -value) 0.3)
                                                  {:outlets [[out 0]] :out out :voices (atom {})}))
                           :effects {:voices voices!}
                           :dispose (fn [node] (doseq [[_ v] @(:voices node)] (try (.stop (:osc v)) (catch :default _ nil))))}})
(define! "osc~" {:doc "Sine oscillator; a number on the left changes its frequency." :usage "osc~ [hz]" :io [2 1]
                 :receive (fn [{:keys [inlet value]}] (if (and (zero? inlet) (num-of value)) {:effects [[:freq (num-of value)]]} {}))
                 :audio {:create (fn [ac c _] (let [o (.createOscillator ac) g (.createGain ac)]
                                                (set! (.. o -frequency -value) (or (num-of (first (:args c))) 440))
                                                (set! (.. g -gain -value) 0.15)
                                                (.connect o g) (.start o)
                                                {:osc o :outlets [[g 0]]}))
                         :effects {:freq (fn [node x at] (.linearRampToValueAtTime (.-frequency (:osc node)) x at))}
                         :dispose (fn [node] (try (.stop (:osc node)) (catch :default _ nil)))}})
(define! "gain~" {:doc "Gain: signal on the left, factor on the right." :usage "gain~ [factor]" :io [2 1]
                  :receive (fn [{:keys [inlet value]}] (if (and (= 1 inlet) (num-of value)) {:effects [[:gain (num-of value)]]} {}))
                  :audio {:create (fn [ac c _] (let [g (.createGain ac)] (set! (.. g -gain -value) (or (num-of (first (:args c))) 0.5))
                                                 {:g g :inlets [[g 0]] :outlets [[g 0]]}))
                          :effects {:gain (fn [node x at] (.setTargetAtTime (.-gain (:g node)) x at 0.01))}}})
(define! "dac~" {:doc "Audio output (both inlets go to the speakers)." :io [2 0]
                 :receive (fn [_] {})
                 :audio {:create (fn [_ _ env] {:inlets [[(:master env) 0] [(:master env) 0]] :outlets []})}})

(defn listing
  "The registered components: [[class doc usage origin] …]."
  []
  (vec (for [[k d] (sort-by key @registry)] [k (:doc d) (:usage d) (:origin d)])))
