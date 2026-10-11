;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · signal
;; Reading at audio rate. A reader reads a canvas once per message; reader~ reads it once per sample,
;; driven by a signal position (usually a phasor~). The canvas is sampled into a table that is sent to
;; an AudioWorklet whenever it changes, and the worklet interpolates the table while it plays.
;;
;;   phasor~ [hz]                 a ramp signal from 0 to 1, hz times per second (a number changes hz)
;;   reader~ [x|y|path] [voices] [gate]
;;                                position signal (0…1) on the left, buffer on the right:
;;                                · x (default): along X, one outlet per voice
;;                                · y: along Y, the same
;;                                · path [stroke]: along a stroke, two outlets x and y
;;                                · gate: then one more outlet per voice (one for path): 1 where the
;;                                  voice has something, 0 where not (into an adsr~)
;;   sig~ [value]                 a constant signal; a number changes it
;;   adsr~ [a d s r]              an envelope (a d r in ms, s from 0 to 1) that follows a gate: a signal
;;                                (reader~ … gate) or numbers (above 0 attacks to that level, 0 releases);
;;                                a bang plays attack and decay and releases; [a d s r] changes its shape,
;;                                and so does dragging over it
;;
;; The position 0…1 covers the X axis of a canvas, or a freqt from 0 to its last point (y: the Y axis,
;; or the lowest … highest frequency). Where nothing passes a voice keeps its last value (so an
;; oscillator it drives does not fall to 0 Hz); the gate says whether it sounds. Voices are given like
;; a synth gives them: a stroke keeps its voice while it lasts, and a new one takes the first free voice.

(ns kairotic.signal
  (:require [kairotic.components :as comp]
            [kairotic.canvas :as cv]))

(def table-size 1024)

(def worklet-source
  "class KairoticReader extends AudioWorkletProcessor {
  // tab: V value channels of n points (NaN where nothing passes). Outputs: the V values, held where
  // nothing passes, then G gates (gate g follows value channel g): 1 where it has something, else 0.
  constructor(o) {
    super();
    this.tab = null; this.n = 0; this.V = 0; this.G = 0;
    this.last = [];
    this.port.onmessage = (e) => {
      const { tab, n, V, G } = e.data;
      this.tab = tab; this.n = n; this.V = V; this.G = G;
      for (let c = 0; c < V; c++) {
        if (this.last[c] === undefined || isNaN(this.last[c])) {
          let v = NaN; for (let i = 0; i < n; i++) { const x = tab[c * n + i]; if (!isNaN(x)) { v = x; break; } }
          this.last[c] = isNaN(v) ? 0 : v;
        }
      }
    };
  }
  process(inputs, outputs) {
    const inp = inputs[0] && inputs[0][0];
    const out = outputs[0];
    const C = out.length, L = out[0].length, n = this.n, tab = this.tab, V = this.V, G = this.G;
    for (let i = 0; i < L; i++) {
      if (!tab || n < 2) { for (let c = 0; c < C; c++) out[c][i] = 0; continue; }
      let p = inp ? inp[i] : 0;
      p = p < 0 ? 0 : (p > 1 ? 1 : p);
      const f = p * (n - 1), k = Math.min(Math.floor(f), n - 2), r = f - k;
      for (let c = 0; c < V && c < C; c++) {
        const a = tab[c * n + k], b = tab[c * n + k + 1];
        if (!isNaN(a)) this.last[c] = isNaN(b) ? a : a + (b - a) * r;
        out[c][i] = this.last[c];
        if (c < G && V + c < C) out[V + c][i] = isNaN(a) ? 0 : 1;
      }
    }
    return true;
  }
}
class KairoticPhasor extends AudioWorkletProcessor {
  static get parameterDescriptors() { return [{ name: 'freq', defaultValue: 1 }]; }
  constructor() { super(); this.ph = 0; }
  process(inputs, outputs, params) {
    const o = outputs[0][0], f = params.freq;
    for (let i = 0; i < o.length; i++) {
      o[i] = this.ph;
      this.ph += (f.length > 1 ? f[i] : f[0]) / sampleRate;
      this.ph -= Math.floor(this.ph);
    }
    return true;
  }
}
class KairoticAdsr extends AudioWorkletProcessor {
  // An envelope that follows a gate: the input signal plus the gate parameter. Above 0 it attacks
  // (to the gate's level, from wherever it is), decays to sustain × that level and stays; at 0 it
  // releases from wherever it is. Times in seconds, every segment linear.
  static get parameterDescriptors() {
    return [{ name: 'gate', defaultValue: 0 },
            { name: 'a', defaultValue: 0.01, minValue: 0, automationRate: 'k-rate' },
            { name: 'd', defaultValue: 0.1, minValue: 0, automationRate: 'k-rate' },
            { name: 's', defaultValue: 0.7, minValue: 0, maxValue: 1, automationRate: 'k-rate' },
            { name: 'r', defaultValue: 0.2, minValue: 0, automationRate: 'k-rate' }];
  }
  constructor() { super(); this.v = 0; this.stage = 0; this.on = false; this.peak = 1; this.rel = 0; }
  process(inputs, outputs, params) {
    const inp = inputs[0] && inputs[0][0], o = outputs[0][0], gp = params.gate;
    const sr = sampleRate, a = params.a[0], d = params.d[0], s = params.s[0], r = params.r[0];
    for (let i = 0; i < o.length; i++) {
      const g = (inp ? inp[i] : 0) + (gp.length > 1 ? gp[i] : gp[0]);
      if (g > 0 && !this.on) { this.on = true; this.peak = g; this.stage = 1; }
      else if (g <= 0 && this.on) { this.on = false; this.stage = 4; this.rel = this.v / Math.max(1, r * sr); }
      if (this.stage === 1) {
        this.v += this.peak / Math.max(1, a * sr);
        if (this.v >= this.peak) { this.v = this.peak; this.stage = 2; }
      } else if (this.stage === 2) {
        const lo = s * this.peak;
        this.v -= (this.peak - lo) / Math.max(1, d * sr);
        if (this.v <= lo) { this.v = lo; this.stage = 3; }
      } else if (this.stage === 3) {
        this.v = s * this.peak;
      } else if (this.stage === 4) {
        this.v -= this.rel;
        if (this.v <= 0) { this.v = 0; this.stage = 0; }
      }
      o[i] = this.v;
    }
    return true;
  }
}
registerProcessor('kairotic-reader', KairoticReader);
registerProcessor('kairotic-phasor', KairoticPhasor);
registerProcessor('kairotic-adsr', KairoticAdsr);
")

(defonce modules (atom {}))

(defn ready
  "Promise that resolves when the worklet module is loaded in this AudioContext."
  [ac]
  (or (get @modules ac)
      (let [url (js/URL.createObjectURL (js/Blob. #js [worklet-source] #js {:type "application/javascript"}))
            p (.addModule (.-audioWorklet ac) url)]
        (swap! modules assoc ac p)
        p)))

;; ───────── tables ─────────

(defn mode-of [args] (cond (some #{:path} args) :path (some #{:y} args) :y :else :x))

(defn voices-of [args]
  (if (= :path (mode-of args)) 2 (max 1 (min 16 (or (comp/num-of (first (filter number? args))) 1)))))

(defn gate? [args] (boolean (some #{:gate} args)))

(defn gates-of [args] (if (gate? args) (if (= :path (mode-of args)) 1 (voices-of args)) 0))

(defn stroke-of [args] (first (remove #{:path :x :y :gate} (filter keyword? args))))

(defn allocate
  "Voices for a run of readings [[[id v] …] …]: a reading keeps the voice its id had at the step
   before, a new id takes the first free voice (none if all V are taken). [{voice v} …]"
  [readings V]
  (first
   (reduce (fn [[acc held] rd]
             (let [ids (set (map first rd))
                   kept (into {} (filter (fn [[vid _]] (ids vid)) held))
                   held (reduce (fn [h [vid _]]
                                  (if (contains? h vid) h
                                      (if-let [free (first (remove (set (vals h)) (range V)))] (assoc h vid free) h)))
                                kept rd)]
               [(conj acc (into {} (keep (fn [[vid v]] (when-let [c (held vid)] [c v])) rd))) held]))
           [[] {}] readings)))

(defn table
  "The buffer d sampled for reader~: a Float32Array of voices × table-size (NaN where nothing passes)."
  [d mode V sid]
  (let [n table-size tab (js/Float32Array. (* V n))]
    (.fill tab js/NaN)
    (case mode
      :path (when-let [pts (cv/stroke-for d sid)]
              (dotimes [i n]
                (when-let [[x y] (cv/point-along d pts (/ i (dec n)))]
                  (aset tab i x)
                  (aset tab (+ n i) y))))
      (let [span (if (= mode :y) (cv/y-range d) (cv/x-range d))
            readings (for [i (range n)] (cv/read-along d mode (cv/at-unit span (/ i (dec n)))))]
        (doseq [[i vs] (map-indexed vector (allocate readings V)) [c v] vs]
          (aset tab (+ (* c n) i) v))))
    tab))

(defn send-table! [node]
  (when-let [w @(:worklet node)]
    (when-let [t @(:pending node)]
      (.postMessage (.-port w) #js {:tab t :n table-size :V (:V node) :G (:G node)})
      (reset! (:pending node) nil))))

;; ───────── classes ─────────

(comp/define! "reader~"
  {:doc "Reads a canvas at audio rate: a position signal from 0 to 1 on the left (a phasor~), the buffer on the right. One signal outlet per voice (along X, or Y with `reader~ y`), or x and y with `reader~ path`; where nothing passes a voice keeps its last value. With `gate`, one more outlet per voice: 1 where it has something, 0 where not (into an adsr~, or a gain~)."
   :usage "reader~ [x|y|path [stroke]] [voices] [gate]"
   :io (fn [b] [2 (+ (voices-of (:args b)) (gates-of (:args b)))]) :dynamic-io true
   :reads-buffer true
   :receive (fn [_] {})
   :audio {:create (fn [ac b _]
                     (let [args (:args b) V (voices-of args) G (gates-of args) C (+ V G)
                           in (.createGain ac)
                           split (.createChannelSplitter ac C)
                           node {:in in :split split :V V :G G :mode (mode-of args) :stroke (stroke-of args)
                                 :worklet (atom nil) :pending (atom nil) :fed (atom ::none) :alive (atom true)
                                 :inlets [[in 0]]
                                 :outlets (vec (for [c (range C)] [split c]))}]
                       (-> (ready ac)
                           (.then (fn [_]
                                    (when @(:alive node)
                                      (let [w (js/AudioWorkletNode. ac "kairotic-reader"
                                                                    #js {:numberOfInputs 1 :numberOfOutputs 1
                                                                         :outputChannelCount #js [C]
                                                                         :channelCount 1 :channelCountMode "explicit"})]
                                        (.connect in w)
                                        (.connect w split)
                                        (reset! (:worklet node) w)
                                        (send-table! node)))))
                           (.catch (fn [e] (js/console.error "reader~" e))))
                       node))
           :feed (fn [node d]
                   (reset! (:pending node) (table (or d cv/empty) (:mode node) (:V node) (:stroke node)))
                   (send-table! node))
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (when-let [w @(:worklet node)] (try (.disconnect w) (catch :default _ nil))))}})

(comp/define! "phasor~"
  {:doc "A ramp signal from 0 to 1, repeated hz times per second (0.25 = once every 4 seconds). A number on the left changes hz."
   :usage "phasor~ [hz]"
   :io [1 1]
   :receive (fn [{:keys [value]}] (if (comp/num-of value) {:effects [[:freq (comp/num-of value)]]} {}))
   :audio {:create (fn [ac b _]
                     (let [out (.createGain ac)
                           hz (atom (or (comp/num-of (first (:args b))) 1))
                           node {:out out :hz hz :worklet (atom nil) :alive (atom true) :outlets [[out 0]]}]
                       (-> (ready ac)
                           (.then (fn [_]
                                    (when @(:alive node)
                                      (let [w (js/AudioWorkletNode. ac "kairotic-phasor" #js {:numberOfInputs 0 :numberOfOutputs 1
                                                                                             :outputChannelCount #js [1]})]
                                        (set! (.-value (.get (.-parameters w) "freq")) @hz)
                                        (.connect w out)
                                        (reset! (:worklet node) w)))))
                           (.catch (fn [e] (js/console.error "phasor~" e))))
                       node))
           :effects {:freq (fn [node x at]
                             (reset! (:hz node) x)
                             (when-let [w @(:worklet node)] (.setValueAtTime (.get (.-parameters w) "freq") x at)))}
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (when-let [w @(:worklet node)] (try (.disconnect w) (catch :default _ nil))))}})

(comp/define! "sig~"
  {:doc "A constant signal (a frequency for osc~, a factor for gain~, a position for reader~). A number on the left changes it."
   :usage "sig~ [value]"
   :io [1 1]
   :receive (fn [{:keys [value]}] (if (comp/num-of value) {:effects [[:value (comp/num-of value)]] :show (comp/num-of value)} {}))
   :audio {:create (fn [ac b _]
                     (let [c (.createConstantSource ac)]
                       (set! (.. c -offset -value) (or (comp/num-of (first (:args b))) 0))
                       (.start c)
                       {:c c :outlets [[c 0]]}))
           :effects {:value (fn [node x at] (.setValueAtTime (.-offset (:c node)) x at))}
           :dispose (fn [node] (try (.stop (:c node)) (catch :default _ nil)))}})

;; ───────── adsr~ ─────────
;; [a d s r]: a, d and r in milliseconds, s (sustain) from 0 to 1 of the gate's level.

(def adsr-default [10 100 0.7 200])

(defn adsr-shape
  "[a d s r] from a list of four numbers (nil if it is not one), kept within range."
  [v]
  (when (and (sequential? v) (= 4 (count v)) (every? number? v))
    (let [[a d s r] v]
      [(comp/clamp a 0 20000) (comp/clamp d 0 20000) (comp/clamp s 0 1) (comp/clamp r 0 20000)])))

(defn adsr-raw
  "The shape written in a box text (raw arguments), the missing ones from the default."
  [args]
  (let [ns (filterv number? args)] (adsr-shape (vec (take 4 (concat ns (drop (count ns) adsr-default)))))))

(defn adsr-of
  "The shape a box has now: what it showed last, its state, or its arguments."
  [{:keys [shown state args]}]
  (or (adsr-shape shown) (adsr-shape state)
      (if (map? args) (adsr-shape [(:a args) (:d args) (:s args) (:r args)]) (adsr-shape (filterv number? args)))
      adsr-default))

;; ── view: the envelope drawn in a 148 × 64 box; the sustain is held for a quarter of the rest ──
(def adsr-x0 6) (def adsr-x1 142) (def adsr-top 8) (def adsr-bottom 46)

(defn adsr-points [[a d s r]]
  (let [total (max 1 (+ a d r)) hold (* 0.25 total)
        k (/ (- adsr-x1 adsr-x0) (+ total hold))
        xa (+ adsr-x0 (* k a)) xd (+ xa (* k d)) xs (+ xd (* k hold)) xr (+ xs (* k r))
        ys (- adsr-bottom (* s (- adsr-bottom adsr-top)))]
    [[adsr-x0 adsr-bottom] [xa adsr-top] [xd ys] [xs ys] [xr adsr-bottom]]))

(defn ms-label [x] (if (>= x 1000) (str (comp/nice (/ x 1000)) "s") (str (js/Math.round x))))

(defn adsr-gesture
  "Dragging over the envelope: on the attack, decay or release a horizontal drag stretches it
   (exponentially, ⇧ finer); a vertical drag on the decay or the sustain moves the sustain."
  [{:keys [start x y dx dy fine] :as m}]
  (let [[a d s r :as sh] (or (adsr-shape start) (adsr-of m))
        [_ [xa] [xd] [xs]] (adsr-points sh)
        x0 (- x dx) k (if fine 4 1)
        stretch (fn [t] (js/Math.round (* (max t 1) (js/Math.pow 2 (/ dx (* 30 k))))))
        sus (fn [] (/ (js/Math.round (* 100 (comp/clamp (- s (/ dy (* 40 k))) 0 1))) 100))]
    (cond
      (< x0 xa) [(stretch a) d s r]
      (< x0 xd) [a (stretch d) (sus) r]
      (< x0 xs) [a d (sus) r]
      :else [a d s (stretch r)])))

(defn adsr-set!
  "Gives the worklet of an adsr~ its shape [a d s r] from time at."
  [node [a d s r] at]
  (when-let [w @(:worklet node)]
    (doseq [[k v] [["a" (/ a 1000)] ["d" (/ d 1000)] ["s" s] ["r" (/ r 1000)]]]
      (.setValueAtTime (.get (.-parameters w) k) v at))))

(comp/define! "adsr~"
  {:doc "An envelope that follows a gate, for the factor of a gain~. On the left a gate: a signal (reader~ … gate) or numbers (above 0 it attacks to that level, 0 releases); a bang plays attack and decay and then releases. A list [a d s r] changes its shape (a, d, r in ms; s, the sustain, from 0 to 1), and so does dragging over it: attack, decay and release sideways, sustain up and down (⇧ finer); on release the new shape is written in the box."
   :usage "adsr~ [a d s r]"
   :io [1 1]
   :args [[:a 10] [:d 100] [:s 0.7] [:r 200]]
   :persist (fn [[a d s r]] {:a a :d d :s s :r r})
   :size [148 64]
   :receive (fn [{:keys [value] :as m}]
              (let [sh (adsr-of m)]
                (cond
                  (adsr-shape value) (let [v (adsr-shape value)] {:state v :show v :effects [[:shape v]]})
                  (= value :bang) {:state sh :show sh :effects [[:bang sh]]}
                  (comp/num-of value) {:state sh :show sh :effects [[:gate (max 0 (comp/num-of value))]]}
                  :else {:state sh :show sh})))
   :gesture adsr-gesture
   :derive (fn [m]
             (let [[a d s r :as sh] (adsr-of m)]
               {:pts (adsr-points sh)
                :label (str "a " (ms-label a) " · d " (ms-label d) " · s " (comp/nice s) " · r " (ms-label r))}))
   :view [[:rect {:x 2 :y 2 :w 144 :h 60 :r 4 :stroke :grid :fill :bg}]
          [:line {:x1 6 :y1 46 :x2 142 :y2 46 :stroke :grid}]
          [:path {:points :$pts :stroke :accent :weight 1.5}]
          [:text {:x 6 :y 58 :size 9 :fill :soft} :$label]]
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac) out (.createGain ac)
                           shape (atom (or (adsr-shape (:state b)) (adsr-raw (:args b))))
                           node {:in in :out out :shape shape :worklet (atom nil) :alive (atom true)
                                 :inlets [[in 0]] :outlets [[out 0]]}]
                       (-> (ready ac)
                           (.then (fn [_]
                                    (when @(:alive node)
                                      (let [w (js/AudioWorkletNode. ac "kairotic-adsr"
                                                                    #js {:numberOfInputs 1 :numberOfOutputs 1 :outputChannelCount #js [1]
                                                                         :channelCount 1 :channelCountMode "explicit"})]
                                        (.connect in w) (.connect w out)
                                        (reset! (:worklet node) w)
                                        (adsr-set! node @shape (.-currentTime ac))))))
                           (.catch (fn [e] (js/console.error "adsr~" e))))
                       node))
           ;; a new text (dragging over it rewrites it): the new shape, without rebuilding the node
           :update (fn [node b at] (let [v (adsr-raw (:args b))] (reset! (:shape node) v) (adsr-set! node v at)))
           :effects {:shape (fn [node v at] (reset! (:shape node) v) (adsr-set! node v at))
                     :gate (fn [node g at] (when-let [w @(:worklet node)] (.setValueAtTime (.get (.-parameters w) "gate") g at)))
                     :bang (fn [node [a d] at]
                             (when-let [w @(:worklet node)]
                               (let [gp (.get (.-parameters w) "gate")]
                                 (.setValueAtTime gp 1 at)
                                 (.setValueAtTime gp 0 (+ at (/ (+ a d) 1000) 0.001)))))}
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (when-let [w @(:worklet node)] (try (.disconnect w) (catch :default _ nil))))}})
