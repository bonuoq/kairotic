;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · sounds
;; Recorded and loaded sound. Its samples are too big for the history of a work: they are kept in this
;; browser (IndexedDB) under the hash of the samples, and the history keeps only a description,
;;   {:audio "5a2c…" :sr 48000 :frames 96000 :channels 1 :peaks [[-0.4 0.38] …]}
;; whose peaks are enough to draw it anywhere. A work opened in another browser shows the sound and
;; says it is not there; (load-sound! :bN) brings a file in. The loops over samples are JavaScript
;; (kairotic/sounds.mjs).
;;
;;   sample [seconds]   a buffer of sound: what reaches its left inlet is recorded on `rec` until `stop`
;;                      (or until it has `seconds`, 60 by default). Its right outlet is the buffer for a
;;                      reader~, which plays it at the position of a phasor~; a bang sends its length in
;;                      seconds on the left, and so does every new recording.

(ns kairotic.sounds
  (:require [clojure.string :as str]
            [kairotic.components :as comp]
            [kairotic.api :as api]))

;; ───────── the store ─────────

(defonce lib* (atom nil))
(defn lib
  "Promise of the native part (kairotic/sounds.mjs), loaded the first time a sound is needed."
  []
  (or @lib* (reset! lib* ((.-kairoticImport js/window) "kairotic/sounds.mjs"))))

(defonce cache (atom {}))    ; hash → {:sr n :chans #js [Float32Array …]}
(defonce status (atom {}))   ; hash → :here | :missing | :checking

(def peak-columns 120)

(defn sample?
  "A description of a sound (the data of a sample box), not an empty one."
  [d] (and (map? d) (string? (:audio d)) (pos? (or (:frames d) 0))))

(defn seconds [d] (if (sample? d) (/ (:frames d) (:sr d)) 0))

(defn sane
  "The description of a sound as it may be kept in the history, or {} if it is not one."
  [d]
  (let [n (fn [x] (and (number? x) (js/isFinite x) (pos? x)))]
    (if (and (map? d) (string? (:audio d)) (re-matches #"[0-9a-f]{8,64}" (:audio d))
             (n (:sr d)) (n (:frames d)))
      {:audio (:audio d) :sr (:sr d) :frames (js/Math.floor (:frames d))
       :channels (max 1 (min 32 (js/Math.floor (or (:channels d) 1))))
       :peaks (vec (for [p (take 2000 (:peaks d)) :when (and (sequential? p) (= 2 (count p)) (every? number? p))]
                     (mapv (fn [x] (comp/clamp x -1 1)) p)))}
      {})))

(defn sound
  "Promise of the sound kept under hash h ({:sr :chans}), or nil if this browser does not have it."
  [h]
  (if-let [s (get @cache h)]
    (js/Promise.resolve s)
    (-> (lib)
        (.then (fn [L] (.get L h)))
        (.then (fn [r]
                 (if r
                   (let [s {:sr (.-sr r) :chans (.-chans r)}]
                     (swap! cache assoc h s) (swap! status assoc h :here) s)
                   (do (swap! status assoc h :missing) nil)))))))

(defn check!
  "Finds out (once) whether this browser has the sound of hash h: (get @status h) then says it."
  [h]
  (when (and (string? h) (nil? (get @status h)))
    (swap! status assoc h :checking)
    (.catch (sound h) (fn [_] (swap! status assoc h :missing)))))

(defn keep!
  "Keeps a sound (sample rate, a JS array of Float32Array, one per channel) in this browser. Promise of
   its description, the data of a sample box."
  [sr chans]
  (.then (lib)
         (fn [L]
           (.then (.hash L chans sr)
                  (fn [h]
                    (.then (.put L h sr chans)
                           (fn [_]
                             (swap! cache assoc h {:sr sr :chans chans})
                             (swap! status assoc h :here)
                             {:audio h :sr sr :frames (.-length (aget chans 0)) :channels (.-length chans)
                              :peaks (js->clj (.peaks L chans peak-columns))})))))))

;; ───────── playing: the worklet a reader~ uses for a sound ─────────

(def player-source
  "class KairoticPlayer extends AudioWorkletProcessor {
  // Plays a sound at the position of its input (0…1 from the start to the end), interpolating between
  // samples: output channel c plays channel c of the sound (or its last one); after V value channels come
  // G gate channels, 1 while it has a sound. A message {chans} gives it the sound.
  constructor(o) {
    super();
    const p = (o && o.processorOptions) || {};
    this.V = p.V || 1; this.G = p.G || 0; this.chans = null;
    this.port.onmessage = (e) => { this.chans = e.data.chans && e.data.chans.length ? e.data.chans : null; };
  }
  process(inputs, outputs) {
    const inp = inputs[0] && inputs[0][0], out = outputs[0], ch = this.chans;
    const L = out[0].length, n = ch ? ch[0].length : 0;
    for (let i = 0; i < L; i++) {
      let p = inp ? inp[i] : 0;
      p = p < 0 ? 0 : (p > 1 ? 1 : p);
      const f = p * (n - 1), k = Math.floor(f), r = f - k;
      for (let c = 0; c < out.length; c++) {
        if (c < this.V) {
          if (n < 2) { out[c][i] = 0; continue; }
          const s = ch[Math.min(c, ch.length - 1)];
          out[c][i] = k + 1 < n ? s[k] + (s[k + 1] - s[k]) * r : s[n - 1];
        } else out[c][i] = n ? 1 : 0;
      }
    }
    return true;
  }
}
registerProcessor('kairotic-player', KairoticPlayer);
")

(defn player
  "Promise of a player worklet with V value channels and G gate channels (the outlets of a reader~)."
  [ac V G]
  (api/worklet-node ac "kairotic-player" player-source
                    {:numberOfInputs 1 :numberOfOutputs 1 :outputChannelCount [(+ V G)]
                     :channelCount 1 :channelCountMode "explicit" :processorOptions {:V V :G G}}))

(defn give!
  "Gives a player the sound s ({:chans}), or none (nil)."
  [pl s]
  (.postMessage (.-port pl) #js {:chans (if s (:chans s) #js [])}))

;; ───────── the sample box ─────────

(def block 4096)

(defn sample-seconds [x] (comp/clamp (or (comp/num-of x) 60) 0.1 600))

(defn finish!
  "The end of a recording: its blocks become one sound, kept in this browser and written as the data
   of the box (through the page, an event of the history); the box hears it on inlet :audio."
  [node id]
  (when-let [{:keys [blocks sr max]} @(:rec node)]
    (reset! (:rec node) nil)
    (-> (lib)
        (.then (fn [L]
                 (let [s (.concat L (clj->js blocks) max)]
                   (if (zero? (.-length s))
                     (js/Promise.reject (js/Error. "nothing was recorded"))
                     (keep! sr #js [s])))))
        (.then (fn [d]
                 (api/effect! id [:sample [:set d]])
                 (api/report! id {:done d} nil)))
        (.catch (fn [e] (api/report! id {:error (str "sample: " (or (.-message e) e))} nil))))))

(defn start!
  "rec: a new take (unless one is going on); the box hears that it started."
  [node at]
  (when-not @(:rec node)
    (let [sr (.-sampleRate (:ac node))]
      (reset! (:rec node) {:blocks [] :n 0 :sr sr :max (js/Math.floor (* sr @(:seconds node)))})
      (when-let [w @(:tap node)] (api/retap w {:active true}))
      (api/report! (:id node) {:started true} at))))

(defn stop!
  "stop: what was heard until now (the worklet hands its last samples at once) becomes the take."
  [node]
  (when @(:rec node)
    (if-let [w @(:tap node)]
      (api/retap w {:flush true :active false})
      (finish! node (:id node)))))

(defn on-block!
  "A block heard while recording: kept; at the end (stop, or the length of the box) the take is finished."
  [node data {:keys [last]}]
  (when-let [r @(:rec node)]
    (let [b (first data)
          r (swap! (:rec node) (fn [r] (-> r (update :blocks conj b) (update :n + (.-length b)))))
          full (>= (:n r) (:max r))]
      (when full (when-let [w @(:tap node)] (api/retap w {:active false})))
      (if (or last full)
        (finish! node (:id node))
        (api/report! (:id node) {:progress (/ (:n r) (:sr r)) :level (when-let [L @(:L node)] (.peak L b))} nil)))))

(defn wave-points
  "The waveform of a description: its peaks as a zigzag from x0 to x1 around the line at y mid."
  [peaks x0 x1 mid half]
  (let [k (count peaks)]
    (vec (for [i (range k) :let [[lo hi] (nth peaks i)
                                 x (+ x0 (* (- x1 x0) (/ i (max 1 (dec k)))))]
               y [(- mid (* hi half)) (- mid (* lo half))]]
           [x y]))))

(defn fmt-s [s] (str (comp/nice s) " s"))

(comp/define! "sample"
  {:doc "A buffer of sound. What reaches its left inlet is recorded on `rec` until `stop` (or until it has seconds, 60 by default), replacing what it had; `clear` empties it. Its right outlet is the buffer for a reader~, which plays it at the position of a phasor~ (0 the start, 1 the end); a bang sends its length in seconds on the left, and so does every new recording. The sound stays in this browser; the work keeps its picture. (load-sound! :bN) brings in a file, (save-sound :bN) saves it as WAV."
   :usage "sample [seconds]"
   :license "MPL-2.0"
   :io [1 2]
   :size [240 72]
   :args [[:seconds 60]]
   :model {:empty {}
           :step (fn [d [op x]] (case op :set (sane x) :clear {} d))
           :load sane
           :code (fn [id d] (when (sample? d) [(str "(sample! " id " " (pr-str d) ")")]))}
   :receive (fn [{:keys [inlet value state data]}]
              (let [rec? (:rec state)]
                (cond
                  (= inlet :audio)
                  (cond
                    (:started value) {:state (assoc state :rec true) :show {:rec 0}}
                    (:progress value) (if rec? {:show {:rec (:progress value) :level (:level value)}} {})
                    (:done value) {:state (dissoc state :rec) :show nil :out [[0 (seconds (:done value))]]}
                    (:error value) {:state (dissoc state :rec) :show nil :effects [[:print (:error value)]]}
                    :else {})
                  ;; the node says when it starts (only while ▶ is on: without it there is no sound to record)
                  (= value :rec) {:effects [[:rec true]]}
                  (= value :stop) {:effects [[:rec false]]}
                  (= value :bang) (if (sample? data) {:out [[0 (seconds data)]]} {})
                  (= value :clear) {:effects [[:sample [:clear]]]}
                  :else {})))
   :draw (fn [{:keys [data shown w h]}]
           (let [w (or w 240) h (or h 72) mid (/ (- h 12) 2) d (when (sample? data) data)
                 here (when d (get @status (:audio d)))]
             (when d (check! (:audio d)))
             [[:rect {:x 2 :y 2 :w (- w 4) :h (- h 4) :r 4 :stroke :grid :fill :bg}]
              [:line {:x1 6 :y1 (+ 2 mid) :x2 (- w 6) :y2 (+ 2 mid) :stroke :grid}]
              (when d [:path {:points (wave-points (:peaks d) 6 (- w 6) (+ 2 mid) (- mid 4))
                              :stroke (if (= here :missing) :soft :accent) :weight 1}])
              (if (:rec shown)
                [:text {:x 8 :y (- h 7) :size 10 :fill :kairos} (str "● rec " (fmt-s (:rec shown)))]
                [:text {:x 8 :y (- h 7) :size 9 :fill :soft}
                 (if d
                   (str (fmt-s (seconds d)) " · " (comp/nice (/ (:sr d) 1000)) " kHz"
                        (when (> (:channels d) 1) (str " · " (:channels d) " ch"))
                        (when (= here :missing) " · not in this browser"))
                   "empty · rec records what reaches it")])
              (when (and (:rec shown) (number? (:level shown)))
                [:rect {:x (- w 70) :y (- h 13) :w (* 60 (comp/clamp (:level shown) 0 1)) :h 4 :r 1 :stroke nil :fill :kairos}])]))
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac)
                           secs (sample-seconds (:seconds (comp/args-for (comp/lookup "sample") (:text b))))
                           node {:ac ac :id (:id b) :in in :seconds (atom secs) :tap (atom nil) :L (atom nil) :rec (atom nil)
                                 :alive (atom true) :inlets [[in 0]] :outlets []}]
                       (.then (lib) (fn [L] (reset! (:L node) L)))
                       (-> (api/tap ac {:mode :frames :size block :hop block :active false}
                                    (fn [data _ _ flags] (on-block! node data flags)))
                           (.then (fn [w]
                                    (if @(:alive node)
                                      (do (.connect in w) (reset! (:tap node) w)
                                          (when @(:rec node) (api/retap w {:active true})))
                                      (try (.disconnect w) (catch :default _ nil)))))
                           (.catch (fn [e] (js/console.error "sample" e))))
                       node))
           :update (fn [node b _]
                     (reset! (:seconds node) (sample-seconds (:seconds (comp/args-for (comp/lookup "sample") (:text b))))))
           :effects {:rec (fn [node on at] (if on (start! node at) (stop! node)))}
           ;; ■ while recording keeps what was heard until then
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (when @(:rec node) (finish! node (:id node)))
                      (try (.disconnect (:in node)) (catch :default _ nil)))}})
