;; spectrum~ · the spectrum of a sound, drawn in the patch
;; Part of @kairotic/analysis. Written against the Kairotic API (api/…). The spectrum is Meyda's (MIT,
;; meyda.js.org), loaded from jsDelivr the first time one is needed.
(let [meyda-url "npm:meyda@5.6.3/dist/web/meyda.min.js"
      size 2048                 ; the frames every analysis box of the package uses (see features~)
      w 240 h 96 cols 116       ; the picture: 116 columns of 2 px, from x 4 to 236
      floor -90                 ; dB at the bottom
      ;; for each bin of the spectrum, its column on a log scale of frequency from lo to hi (nil outside)
      column-map (fn [sr lo hi]
                   (let [l0 (js/Math.log lo) span (- (js/Math.log hi) l0)]
                     (vec (for [k (range (/ size 2))]
                            (let [f (* k (/ sr size))]
                              (when (and (>= f lo) (< f hi))
                                (js/Math.floor (* cols (/ (- (js/Math.log f) l0) span)))))))))
      ;; the loudest bin of each column, in dB below a full-scale sine (whose bin is size/4 with Hann)
      columns (fn [spec cmap]
                (let [out (js/Array. cols)]
                  (.fill out floor)
                  (loop [k 1]
                    (when (< k (count cmap))
                      (when-let [c (nth cmap k)]
                        (let [a (aget spec k)
                              d (if (> a 1e-9) (* 20 (/ (js/Math.log (/ a (/ size 4))) js/Math.LN10)) floor)]
                          (when (> d (aget out c)) (aset out c d))))
                      (recur (inc k))))
                  ;; columns with no bin of their own (low frequencies) take the one before
                  (loop [c 1]
                    (when (< c cols)
                      (when (= floor (aget out c)) (aset out c (aget out (dec c))))
                      (recur (inc c))))
                  (vec out)))
      points (fn [ds]
               (vec (map-indexed (fn [i d] [(+ 4 (* 2 i)) (+ 4 (* (- h 18) (/ (- (api/clamp d floor 0)) (- floor))))]) ds)))]
  {;; ── about ──
   :class "spectrum~"
   :license "MPL-2.0"
   :doc "The spectrum of the signal on its left, drawn in the patch about 30 times a second: frequency on a log scale from lo to hi Hz (40 and 16000 by default), level in dB from -90 to 0. Computed with Meyda."
   :usage "spectrum~ [lo hi]"
   :io [1 0]
   :size [240 96]
   :args [[:lo 40] [:hi 16000]]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value]}]
              (cond
                (and (= inlet :audio) (:error value)) {:effects [[:print (:error value)]]}
                (and (= inlet :audio) (vector? value)) {:show value}
                :else {}))

   ;; ── view ──
   :derive (fn [{:keys [shown args]}]
             {:pts (when (vector? shown) (points shown))
              :range (str (api/nice (:lo args)) " – " (api/nice (:hi args)) " Hz")})
   :view [[:rect {:x 2 :y 2 :w 236 :h 92 :r 4 :stroke :grid :fill :bg}]
          [:line {:x1 4 :y1 30 :x2 236 :y2 30 :stroke :grid}]
          [:line {:x1 4 :y1 54 :x2 236 :y2 54 :stroke :grid}]
          [:path {:points :$pts :stroke :accent :weight 1.2}]
          [:text {:x 234 :y 90 :anchor :end :size 8 :fill :soft} :$range]]

   ;; ── audio ──
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac)
                           sr (.-sampleRate ac)
                           [lo hi] (api/padded (:args b) [40 16000])
                           cmap (column-map sr (api/clamp (min lo hi) 10 20000) (api/clamp (max lo hi) 20 (/ sr 2)))
                           node {:in in :M (atom nil) :alive (atom true) :inlets [[in 0]] :outlets []}
                           on-block (fn [data at & _]
                                      (when-let [M @(:M node)]
                                        (set! (.-bufferSize M) size)
                                        (set! (.-sampleRate M) sr)
                                        (let [spec (.extract M "amplitudeSpectrum" (first data))]
                                          (api/report! (:id b) (columns spec cmap) at))))]
                       (-> (api/load-script meyda-url)
                           (.then (fn [_] (reset! (:M node) (.-Meyda js/window))))
                           (.catch (fn [e] (api/report! (:id b) {:error (str "spectrum~: " (.-message e))} nil))))
                       (-> (api/tap ac {:mode :frames :size size :hop (js/Math.round (/ sr 30))} on-block)
                           (.then (fn [w] (if @(:alive node) (.connect in w) (try (.disconnect w) (catch :default _ nil)))))
                           (.catch (fn [e] (js/console.error "spectrum~" e))))
                       node))
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (try (.disconnect (:in node)) (catch :default _ nil)))}})
