;; features~ · descriptors of a sound, every few milliseconds
;; Part of @kairotic/analysis. Written against the Kairotic API (api/…). The descriptors are Meyda's
;; (MIT, meyda.js.org), loaded from jsDelivr the first time one is needed.
(let [meyda-url "npm:meyda@5.6.3/dist/web/meyda.min.js"
      ;; every analysis box of the package uses frames of this size: Meyda is one object for the whole
      ;; page and keeps some filter banks for the size it saw first
      size 2048
      aliases {:centroid :spectralCentroid :flatness :spectralFlatness :rolloff :spectralRolloff
               :spread :spectralSpread :kurtosis :spectralKurtosis :skewness :spectralSkewness
               :slope :spectralSlope :crest :spectralCrest :sharpness :perceptualSharpness}
      known #{:rms :energy :zcr :loudness :mfcc :chroma :spectralCentroid :spectralFlatness :spectralRolloff
              :spectralSpread :spectralKurtosis :spectralSkewness :spectralSlope :spectralCrest
              :perceptualSharpness :perceptualSpread}
      feats (fn [args]
              (let [ws (->> args (filter keyword?) (map (fn [k] (get aliases k k))) (filter known) distinct vec)]
                (if (seq ws) ws [:rms :spectralCentroid :spectralFlatness])))
      hop-ms (fn [args] (api/clamp (or (first (filter number? args)) 20) 5 1000))
      ok? (fn [x] (and (number? x) (js/isFinite x)))
      ;; a value as it leaves the box: Hz where Meyda gives bins, the total of loudness, lists rounded
      value (fn [k v sr]
              (cond
                (#{:spectralCentroid :spectralSpread} k) (when (ok? v) (api/nice (* v (/ sr size))))
                (= k :loudness) (when v (let [t (.-total v)] (when (ok? t) (api/nice t))))
                (#{:mfcc :chroma} k) (when v (let [xs (vec (array-seq v))] (when (every? ok? xs) (mapv api/nice xs))))
                :else (when (ok? v) (api/nice v))))]
  {;; ── about ──
   :class "features~"
   :license "MPL-2.0"
   :doc "Descriptors of the signal on its left, every ms (20 by default), one outlet for each word written after it, in order: rms, energy, zcr, loudness, centroid and spread (in Hz), flatness, rolloff (Hz), kurtosis, skewness, slope, crest, sharpness, perceptualSpread, mfcc (13 values) and chroma (12). Without words: rms centroid flatness. Each outlet sends only what changed. Computed with Meyda."
   :usage "features~ [ms] [descriptor …]"
   :io (fn [b] [1 (count (feats (:args b)))])
   :dynamic-io true

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args]}]
              (cond
                (and (= inlet :audio) (:error value)) {:effects [[:print (:error value)]]}
                (and (= inlet :audio) (map? value))
                (let [fs (feats args)
                      outs (vec (keep-indexed (fn [i k] (let [v (get value k)]
                                                          (when (and (some? v) (not= v (get state k))) [i v])))
                                              fs))]
                  (if (seq outs) {:state (merge state (select-keys value fs)) :out outs} {}))
                :else {}))

   ;; ── audio ──
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac)
                           sr (.-sampleRate ac)
                           fs (feats (:args b))
                           names (clj->js (mapv name fs))
                           node {:in in :M (atom nil) :tap (atom nil) :alive (atom true) :inlets [[in 0]] :outlets []}
                           on-block (fn [data at & _]
                                      (when-let [M @(:M node)]
                                        (set! (.-bufferSize M) size)
                                        (set! (.-sampleRate M) sr)
                                        (let [r (.extract M names (first data))]
                                          (api/report! (:id b) (into {} (for [k fs] [k (value k (aget r (name k)) sr)])) at))))]
                       (-> (api/load-script meyda-url)
                           (.then (fn [_] (reset! (:M node) (.-Meyda js/window))))
                           (.catch (fn [e] (api/report! (:id b) {:error (str "features~: " (.-message e))} nil))))
                       (-> (api/tap ac {:mode :frames :size size :hop (js/Math.round (* sr (/ (hop-ms (:args b)) 1000)))} on-block)
                           (.then (fn [w] (if @(:alive node) (do (.connect in w) (reset! (:tap node) w))
                                              (try (.disconnect w) (catch :default _ nil)))))
                           (.catch (fn [e] (js/console.error "features~" e))))
                       node))
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (try (.disconnect (:in node)) (catch :default _ nil)))}})
