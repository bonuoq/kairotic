;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · signal
;; Reading at audio rate. A reader reads a canvas once per message; reader~ reads it once per sample,
;; driven by a signal position (usually a phasor~). The canvas is sampled into a table that is sent to
;; an AudioWorklet whenever it changes, and the worklet interpolates the table while it plays.
;;
;;   phasor~ [hz]                 a ramp signal from 0 to 1, hz times per second (a number changes hz)
;;   reader~ [x|y|path] [voices]  position signal (0…1) on the left, buffer on the right:
;;                                · x (default): along X, one outlet per voice (the first crossings)
;;                                · y: along Y, the same
;;                                · path [stroke]: along a stroke, two outlets x and y
;;   sig~ [value]                 a constant signal; a number changes it
;;
;; The position 0…1 covers the X axis of a canvas, or a freqt from 0 to its last point (y: the Y axis,
;; or the lowest … highest frequency). Where nothing passes the output is 0.

(ns kairotic.signal
  (:require [kairotic.components :as comp]
            [kairotic.canvas :as cv]))

(def table-size 1024)

(def worklet-source
  "class KairoticReader extends AudioWorkletProcessor {
  constructor(o) {
    super();
    this.tab = null; this.n = 0;
    this.port.onmessage = (e) => { this.tab = e.data.tab; this.n = e.data.n; };
  }
  process(inputs, outputs) {
    const inp = inputs[0] && inputs[0][0];
    const out = outputs[0];
    const V = out.length, L = out[0].length, n = this.n, tab = this.tab;
    for (let i = 0; i < L; i++) {
      if (!tab || n < 2) { for (let c = 0; c < V; c++) out[c][i] = 0; continue; }
      let p = inp ? inp[i] : 0;
      p = p < 0 ? 0 : (p > 1 ? 1 : p);
      const f = p * (n - 1), k = Math.min(Math.floor(f), n - 2), r = f - k, k2 = k + 1;
      for (let c = 0; c < V; c++) {
        const a = tab[c * n + k], b = tab[c * n + k2];
        out[c][i] = isNaN(a) ? 0 : (isNaN(b) ? a : a + (b - a) * r);
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

(defn stroke-of [args] (first (remove #{:path :x :y} (filter keyword? args))))

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
      (let [span (if (= mode :y) (cv/y-range d) (cv/x-range d))]
        (dotimes [i n]
          (let [vals (cv/read-along d mode (cv/at-unit span (/ i (dec n))))]
            (doseq [[c [_ v]] (map-indexed vector (take V vals))]
              (aset tab (+ (* c n) i) v))))))
    tab))

(defn send-table! [node]
  (when-let [w @(:worklet node)]
    (when-let [t @(:pending node)]
      (.postMessage (.-port w) #js {:tab t :n table-size})
      (reset! (:pending node) nil))))

;; ───────── classes ─────────

(comp/define! "reader~"
  {:doc "Reads a canvas at audio rate: a position signal from 0 to 1 on the left (a phasor~), the buffer on the right. One signal outlet per voice (along X, or Y with `reader~ y`), or x and y with `reader~ path`."
   :usage "reader~ [x|y|path [stroke]] [voices]"
   :io (fn [b] [2 (voices-of (:args b))]) :dynamic-io true
   :reads-buffer true
   :receive (fn [_] {})
   :audio {:create (fn [ac b _]
                     (let [args (:args b) V (voices-of args)
                           in (.createGain ac)
                           split (.createChannelSplitter ac V)
                           node {:in in :split split :V V :mode (mode-of args) :stroke (stroke-of args)
                                 :worklet (atom nil) :pending (atom nil) :fed (atom ::none) :alive (atom true)
                                 :inlets [[in 0]]
                                 :outlets (vec (for [c (range V)] [split c]))}]
                       (-> (ready ac)
                           (.then (fn [_]
                                    (when @(:alive node)
                                      (let [w (js/AudioWorkletNode. ac "kairotic-reader"
                                                                    #js {:numberOfInputs 1 :numberOfOutputs 1
                                                                         :outputChannelCount #js [V]
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
