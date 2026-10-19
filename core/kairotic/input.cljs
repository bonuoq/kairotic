;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · input
;; Sound from outside, and sound back into messages and pictures.
;;
;;   adc~ [channel …]          audio input (the microphone or the sound card): one outlet per channel
;;                             written after it (adc~ 1 by default). Asks for the microphone at ▶.
;;   snapshot~ [ms] [rms|peak|db]
;;                             a signal as numbers, every ms (50 by default): its value, or its level
;;                             (rms, peak, or rms in dB). Sends only what changed.
;;   scope~ [ms] [zoom]        an oscilloscope in the patch: the last ms (20) of the signal, steady on a
;;                             rising zero crossing; drag up/down to zoom, sideways for the time.
;;
;; The audio nodes cannot send messages: they report what they find to their own box (api/report!),
;; which receives it on inlet :audio and decides what to send, show and keep, in its pure :receive.
;; The loops over samples run in an AudioWorklet (api/tap): the page only handles small arrays.

(ns kairotic.input
  (:require [clojure.string :as str]
            [kairotic.components :as comp]
            [kairotic.api :as api]))

;; ───────── the microphone: one stream for every adc~ ─────────

(defn adc-channels
  "The input channels of an adc~ (1-based): its numbers, or 1."
  [b] (let [cs (filterv (fn [x] (and (number? x) (>= x 1))) (:args b))] (if (seq cs) (mapv js/Math.floor cs) [1])))

(def max-channels 32)

;; {:ac :p (Promise of {:stream :source :split :have}) :users n :closing timeout}
(defonce mic (atom nil))

(defn constraints
  "What is asked of the microphone: its sound as it is (no echo cancellation, noise suppression or
   automatic gain, which are made for speech and change music), with as many channels as it has."
  [n]
  (clj->js {:audio {:channelCount {:ideal (max 2 n)}
                    :echoCancellation false :noiseSuppression false :autoGainControl false}}))

(defn close! [m]
  (.then (:p m)
         (fn [{:keys [stream source split]}]
           (try (.disconnect source) (.disconnect split) (catch :default _ nil))
           (doseq [t (array-seq (.getTracks stream))] (.stop t)))
         (fn [_] nil)))

(defn open!
  "Promise of the shared input ({:stream :source :split :have}) in AudioContext ac, opened the first
   time an adc~ asks (asking for the microphone) and shared by every adc~ after."
  [ac n]
  (let [m @mic]
    (if (and m (identical? (:ac m) ac))
      (do (when-let [t (:closing m)] (js/clearTimeout t))
          (swap! mic (fn [m] (-> m (update :users inc) (dissoc :closing))))
          (:p m))
      (let [md (.-mediaDevices js/navigator)
            p (if-not (and md (.-getUserMedia md))
                (js/Promise.reject (js/Error. "this page cannot use a microphone (it needs https or localhost)"))
                (.then (.getUserMedia md (constraints n))
                       (fn [stream]
                         (let [source (.createMediaStreamSource ac stream)
                               split (.createChannelSplitter ac max-channels)
                               track (first (array-seq (.getAudioTracks stream)))
                               have (when track (.-channelCount (.getSettings track)))]
                           (.connect source split)
                           {:stream stream :source source :split split :have have}))))]
        (when m (close! m))
        ;; a refusal is not kept: the next ▶ asks again
        (.catch p (fn [_] (when (identical? (:p @mic) p) (reset! mic nil))))
        (reset! mic {:ac ac :p p :users 1})
        p))))

(defn release!
  "An adc~ no longer listens. When none does, the microphone is closed a moment later (an adc~ rebuilt
   because its text changed takes it again in between, without asking)."
  []
  (when-let [m @mic]
    (if (> (:users m) 1)
      (swap! mic update :users dec)
      (swap! mic assoc :users 0
             :closing (js/setTimeout (fn [] (let [m @mic]
                                              (when (and m (zero? (:users m)))
                                                (reset! mic nil)
                                                (close! m))))
                                     2000)))))

(defn report-error [e] {:error (str "adc~: " (or (.-message e) e))})

(comp/define! "adc~"
  {:doc "Audio input (the microphone or the sound card): one outlet per input channel, the ones written after it (adc~ 1 by default; adc~ 1 2 for stereo). At ▶ it asks for the microphone, and takes its sound as it is, without the echo cancellation, noise suppression and automatic gain made for speech. Every adc~ shares one stream."
   :usage "adc~ [channel …]"
   :license "MPL-2.0"
   :io (fn [b] [0 (count (adc-channels b))]) :dynamic-io true
   :receive (fn [{:keys [inlet value]}]
              (if (and (= inlet :audio) (map? value) (:error value))
                {:effects [[:print (:error value)]]}
                {}))
   :audio {:create (fn [ac b _]
                     (let [cs (adc-channels b)
                           outs (vec (for [_ cs] (.createGain ac)))
                           alive (atom true)
                           node {:outs outs :alive alive :outlets (vec (for [g outs] [g 0]))}]
                       (-> (open! ac (apply max cs))
                           (.then (fn [{:keys [split have]}]
                                    (when @alive
                                      (doseq [[c g] (map vector cs outs) :when (<= c max-channels)]
                                        (.connect split g (dec c)))
                                      (when-let [missing (seq (filter (fn [c] (and (number? have) (> c have))) cs))]
                                        (api/report! (:id b) {:error (str "adc~: the input has " have " channel"
                                                                          (when (not= 1 have) "s") ": channel "
                                                                          (str/join " " missing) " is silent")}
                                                     nil)))))
                           (.catch (fn [e] (when @alive (api/report! (:id b) (report-error e) nil)))))
                       node))
           :key (fn [b] (adc-channels b))
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (doseq [g (:outs node)] (try (.disconnect g) (catch :default _ nil)))
                      (release!))}})

;; ───────── snapshot~: a signal as numbers ─────────

(def snapshot-modes #{:rms :peak :db})

(defn snapshot-value
  "The number a snapshot~ sends for a block [last rms peak] of the tap."
  [mode [last rms peak]]
  (case mode
    :rms rms
    :peak peak
    :db (comp/nice (api/db rms))
    last))

(defn level-unit
  "Where a value of a snapshot~ stands on its bar (0…1): levels as they are, dB from -60 to 0."
  [mode v]
  (when (number? v)
    (case mode
      (:rms :peak) (comp/clamp v 0 1)
      :db (comp/clamp (/ (+ v 60) 60) 0 1)
      nil)))

(defn snapshot-ms [x] (comp/clamp (or (comp/num-of x) 50) 5 10000))

(comp/define! "snapshot~"
  {:doc "A signal as numbers: every ms (50 by default) its last value, or with a word its level over that time — rms, peak, or db (the rms in decibels). It sends only what changed, so a constant signal sends once. A number on the left changes ms; a bang sends the last value again. With adc~ it is a level meter; with phasor~, an envelope or faust~ it brings a signal back into the messages."
   :usage "snapshot~ [ms] [rms|peak|db]"
   :license "MPL-2.0"
   :io [1 1]
   :size [104 30]
   :args [[:ms 50] [:mode nil]]
   :receive (fn [{:keys [inlet value state args]}]
              (let [mode (snapshot-modes (:mode args))]
                (cond
                  (= inlet :audio)
                  (let [block (first value)
                        v (when block (snapshot-value mode (vec (array-seq block))))]
                    (if (and (number? v) (not= v state))
                      {:state v :show v :out [[0 v]]}
                      {}))
                  (= value :bang) (if (number? state) {:out [[0 state]] :show state} {})
                  (comp/num-of value) {:effects [[:ms (snapshot-ms value)]]}
                  :else {})))
   :derive (fn [{:keys [shown args]}]
             (let [mode (snapshot-modes (:mode args)) u (level-unit mode shown)]
               {:label (str (if (number? shown) (comp/nice shown) "–") (when (= mode :db) " dB"))
                :bar (if u (* 96 u) 0)
                :tag (if mode (name mode) "value")}))
   :view [[:rect {:x 2 :y 2 :w 100 :h 26 :r 3 :stroke :grid :fill :bg}]
          [:rect {:x 4 :y 22 :w :$bar :h 4 :r 1 :stroke nil :fill :accent}]
          [:text {:x 6 :y 16 :size 11} :$label]
          [:text {:x 98 :y 16 :anchor :end :size 8 :fill :soft} :$tag]]
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac)
                           args (comp/args-for (comp/lookup "snapshot~") (:text b))
                           hop (fn [ms] (js/Math.max 16 (js/Math.round (* (.-sampleRate ac) (/ ms 1000)))))
                           ms (snapshot-ms (:ms args))
                           node {:in in :hop hop :tap (atom nil) :alive (atom true) :inlets [[in 0]] :outlets []}]
                       (-> (api/tap ac {:mode :summary :size (hop ms) :hop (hop ms)}
                                    (fn [data at _] (when @(:alive node) (api/report! (:id b) data at))))
                           (.then (fn [w] (if @(:alive node) (do (.connect in w) (reset! (:tap node) w))
                                              (try (.disconnect w) (catch :default _ nil)))))
                           (.catch (fn [e] (js/console.error "snapshot~" e))))
                       node))
           :update (fn [node b _]
                     (when-let [w @(:tap node)]
                       (let [h ((:hop node) (snapshot-ms (:ms (comp/args-for (comp/lookup "snapshot~") (:text b)))))]
                         (api/retap w {:size h :hop h}))))
           :effects {:ms (fn [node ms _]
                           (when-let [w @(:tap node)] (let [h ((:hop node) ms)] (api/retap w {:size h :hop h}))))}
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (try (.disconnect (:in node)) (catch :default _ nil)))}})

;; ───────── scope~: an oscilloscope ─────────

(def scope-w 168)
(def scope-h 84)
(def scope-columns 160)   ; one [min max] pair per pixel of the trace (x from 4 to 164)

(defn scope-ms [x] (comp/clamp (or (comp/num-of x) 20) 1 2000))
(defn scope-zoom [x] (comp/clamp (or (comp/num-of x) 1) 0.125 64))

(defn trace-points
  "The polyline of a trace: columns pairs [min max] (a Float32Array or a seq) as points from x 4 to 164,
   around the middle line, `zoom` times taller (clipped to the box)."
  [col zoom]
  (let [xs (vec (array-seq col)) k (quot (count xs) 2)
        mid (/ scope-h 2) half (- mid 6)
        y (fn [v] (comp/clamp (- mid (* v zoom half)) 4 (- scope-h 4)))]
    (when (pos? k)
      (vec (for [i (range k) j [0 1]]
             [(+ 4 (* (- scope-w 8) (/ i (max 1 (dec k))))) (y (nth xs (+ (* 2 i) j)))])))))

(defn scope-view [m]
  (let [{:keys [ms zoom]} (merge (:args m) (when (map? (:state m)) (:state m)))]
    {:ms (scope-ms ms) :zoom (scope-zoom zoom)}))

(comp/define! "scope~"
  {:doc "An oscilloscope in the patch: the last ms (20 by default) of the signal on its left, drawn from a rising zero crossing so a periodic wave stands still. zoom makes it taller. Drag up or down over it to zoom (⇧ finer) and sideways to change the time; on release both stay in the box text. A number on the left changes ms."
   :usage "scope~ [ms] [zoom]"
   :license "MPL-2.0"
   :io [1 0]
   :size [168 84]
   :args [[:ms 20] [:zoom 1]]
   :persist (fn [{:keys [ms zoom]}] {:ms (comp/nice ms) :zoom (comp/nice zoom)})
   :receive (fn [{:keys [inlet value] :as m}]
              (let [{:keys [ms zoom] :as v} (scope-view m)]
                (cond
                  (= inlet :audio) {:show (assoc v :pts (trace-points (first value) zoom))}
                  (and (map? value) (contains? value :zoom))
                  (let [nv {:ms (scope-ms (:ms value)) :zoom (scope-zoom (:zoom value))}]
                    {:state nv :effects [[:ms (:ms nv)]]})
                  (comp/num-of value) (let [nv (assoc v :ms (scope-ms value))] {:state nv :effects [[:ms (:ms nv)]]})
                  :else {})))
   ;; from what it showed on press (or its text): not from its state, which the drag itself changes
   :gesture (fn [{:keys [start dx dy fine] :as m}]
              (let [{:keys [ms zoom]} (if (and (map? start) (:ms start)) start (scope-view (dissoc m :state)))
                    k (if fine 4 1)]
                {:ms (scope-ms (* ms (js/Math.pow 2 (/ dx (* 40 k)))))
                 :zoom (scope-zoom (* zoom (js/Math.pow 2 (/ (- dy) (* 40 k)))))}))
   :derive (fn [{:keys [shown] :as m}]
             (let [{:keys [ms zoom]} (scope-view m)]
               {:pts (when (map? shown) (:pts shown))
                :label (str (comp/nice ms) " ms" (when (not= zoom 1) (str " · ×" (comp/nice zoom))))}))
   :view [[:rect {:x 2 :y 2 :w 164 :h 80 :r 4 :stroke :grid :fill :bg}]
          [:line {:x1 4 :y1 42 :x2 164 :y2 42 :stroke :grid}]
          [:path {:points :$pts :stroke :accent :weight 1}]
          [:text {:x 162 :y 78 :anchor :end :size 8 :fill :soft} :$label]]
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac)
                           sr (.-sampleRate ac)
                           samples (fn [ms] (js/Math.max 32 (js/Math.round (* sr (/ ms 1000)))))
                           ms (scope-ms (:ms (comp/args-for (comp/lookup "scope~") (:text b))))
                           node {:in in :samples samples :tap (atom nil) :alive (atom true) :inlets [[in 0]] :outlets []}]
                       ;; about 30 pictures a second
                       (-> (api/tap ac {:mode :trace :size (samples ms) :hop (js/Math.round (/ sr 30)) :columns scope-columns}
                                    (fn [data at _] (when @(:alive node) (api/report! (:id b) data at))))
                           (.then (fn [w] (if @(:alive node) (do (.connect in w) (reset! (:tap node) w))
                                              (try (.disconnect w) (catch :default _ nil)))))
                           (.catch (fn [e] (js/console.error "scope~" e))))
                       node))
           :update (fn [node b _]
                     (when-let [w @(:tap node)]
                       (api/retap w {:size ((:samples node) (scope-ms (:ms (comp/args-for (comp/lookup "scope~") (:text b)))))})))
           :effects {:ms (fn [node ms _] (when-let [w @(:tap node)] (api/retap w {:size ((:samples node) ms)})))}
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (try (.disconnect (:in node)) (catch :default _ nil)))}})
