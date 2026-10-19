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
;;                                  voice has something, 0 where not (into an adsr~ of @kairotic/synth)
;;   sig~ [value]                 a constant signal; a number changes it
;;
;; The position 0…1 covers the X axis of a canvas, or a freqt from 0 to its last point (y: the Y axis,
;; or the lowest … highest frequency). Where nothing passes a voice keeps its last value (so an
;; oscillator it drives does not fall to 0 Hz); the gate says whether it sounds. Voices are given like
;; a synth gives them: a stroke keeps its voice while it lasts, and a new one takes the first free voice.

(ns kairotic.signal
  (:require [kairotic.components :as comp]
            [kairotic.canvas :as cv]
            [kairotic.api :as api]
            [kairotic.sounds :as snd]))

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
registerProcessor('kairotic-reader', KairoticReader);
registerProcessor('kairotic-phasor', KairoticPhasor);
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

(defn readings
  "What the canvas holds at each of n points of the span (as cv/read-along gives it, in stroke order), but
   each stroke is only asked where it can pass: between its lowest and highest coordinate on that axis.
   A canvas of short notes is crossed by one or two strokes at a time, not by all of them."
  [d mode span n]
  (let [k (if (= mode :y) 1 0)
        logs [(cv/x-log? d) (cv/y-log? d)]
        strokes (vec (for [[id s] (cv/sorted-strokes d) :let [cs (map (fn [p] (nth p k)) (:pts s))]]
                       [id (:pts s) (apply min cs) (apply max cs)]))]
    (vec (for [i (range n)]
           (let [v (cv/at-unit span (/ i (dec n)))]
             (vec (mapcat (fn [[id pts lo hi]]
                            (when (and (<= lo v) (<= v hi))
                              (map-indexed (fn [j val] [(if (zero? j) id (keyword (str (name id) "-" (inc j)))) val])
                                           (cv/crossings pts k v logs))))
                          strokes)))))))

(defn compute-table
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
      (let [span (if (= mode :y) (cv/y-range d) (cv/x-range d))]
        (doseq [[i vs] (map-indexed vector (allocate (readings d mode span n) V)) [c v] vs]
          (aset tab (+ (* c n) i) v))))
    tab))

;; Several reader~ often read the same canvas the same way, and a canvas that has not changed must not
;; be sampled again: the tables are kept by what they depend on (the buffer compared by value).
(defonce tables (atom []))   ; [[key table] …], the newest last
(def tables-kept 16)

(defn table [d mode V sid]
  (let [k [d mode V sid]]
    (or (some (fn [[k2 t]] (when (= k k2) t)) @tables)
        (let [t (compute-table d mode V sid)]
          (swap! tables (fn [ts] (vec (take-last tables-kept (conj ts [k t])))))
          t))))

(defn send-table! [node]
  (when-let [w @(:worklet node)]
    (when-let [t @(:pending node)]
      (.postMessage (.-port w) #js {:tab t :n table-size :V (:V node) :G (:G node)})
      (reset! (:pending node) nil))))

;; ───────── a reader~ that reads a sound ─────────
;; A sample box (kairotic.sounds) is a buffer too: then the reader~ plays it, the position 0…1 going from
;; its start to its end, through a player worklet that takes the place of the table reader.

(defn route!
  "Puts the table reader (:table) or the player (:sound) between the position and the outlets."
  [node which]
  (let [w @(:worklet node) pl @(:player node) in (:in node)]
    (doseq [x [w pl] :when x]
      (try (.disconnect in x) (catch :default _ nil))
      (try (.disconnect x) (catch :default _ nil)))
    (when-let [x (if (= which :sound) pl w)]
      (.connect in x) (.connect x (:split node)))
    (reset! (:route node) which)))

(defn play-sound!
  "Gives a reader~ the sound described by d: from this browser's store (or fetched from its URL), into
   its player."
  [node d]
  (reset! (:route node) :sound)
  (-> (snd/sound-for d)
      (.then (fn [s]
               (when (and @(:alive node) (= d @(:fed node)))
                 (if-not s
                   (api/report! (:id node) {:error (str "reader~: the sound of the sample is not in this browser"
                                                        " (recorded elsewhere): (load-sound! :bN) brings a file into it")} nil)
                   (-> (or @(:player node) (snd/player (:ac node) (:V node) (:G node)))
                       (js/Promise.resolve)
                       (.then (fn [pl]
                                (when @(:alive node)
                                  (reset! (:player node) pl)
                                  (snd/give! pl s)
                                  (when (= :sound @(:route node)) (route! node :sound))))))))))
      (.catch (fn [e] (api/report! (:id node) {:error (str "reader~: " (or (.-message e) e))} nil)))))

;; ───────── classes ─────────

(comp/define! "reader~"
  {:doc "Reads a canvas at audio rate: a position signal from 0 to 1 on the left (a phasor~), the buffer on the right. One signal outlet per voice (along X, or Y with `reader~ y`), or x and y with `reader~ path`; where nothing passes a voice keeps its last value. With `gate`, one more outlet per voice: 1 where it has something, 0 where not (into an adsr~, or a gain~)."
   :usage "reader~ [x|y|path [stroke]] [voices] [gate]"
   :io (fn [b] [2 (+ (voices-of (:args b)) (gates-of (:args b)))]) :dynamic-io true
   :reads-buffer true
   :receive (fn [{:keys [inlet value]}]
              (if (and (= inlet :audio) (:error value)) {:effects [[:print (:error value)]]} {}))
   :audio {:create (fn [ac b _]
                     (let [args (:args b) V (voices-of args) G (gates-of args) C (+ V G)
                           in (.createGain ac)
                           split (.createChannelSplitter ac C)
                           node {:in in :split split :V V :G G :mode (mode-of args) :stroke (stroke-of args)
                                 :ac ac :id (:id b) :player (atom nil) :route (atom :table)
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
                                        (reset! (:worklet node) w)
                                        (when (= :table @(:route node)) (route! node :table))
                                        (send-table! node)))))
                           (.catch (fn [e] (js/console.error "reader~" e))))
                       node))
           :feed (fn [node d]
                   (if (snd/sample? d)
                     (play-sound! node d)
                     (do (when (= :sound @(:route node)) (route! node :table))
                         (reset! (:pending node) (table (or d cv/empty) (:mode node) (:V node) (:stroke node)))
                         (send-table! node))))
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (doseq [x [@(:worklet node) @(:player node)] :when x] (try (.disconnect x) (catch :default _ nil))))}})

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

;; adsr~ moved to the package @kairotic/synth (Study 14)
