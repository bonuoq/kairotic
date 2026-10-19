;; chroma~ · how much of each pitch class a sound has
;; Part of @kairotic/analysis. Written against the Kairotic API (api/…). The chroma is Meyda's (MIT,
;; meyda.js.org), loaded from jsDelivr the first time one is needed.
(let [meyda-url "npm:meyda@5.6.3/dist/web/meyda.min.js"
      size 2048                 ; the frames every analysis box of the package uses (see features~)
      gate 0.005                ; rms under it is silence: no strongest class
      classes [:c :c# :d :d# :e :f :f# :g :g# :a :a# :b]
      names ["C" "C#" "D" "D#" "E" "F" "F#" "G" "G#" "A" "A#" "B"]
      strongest (fn [xs] (when (seq xs) (nth classes (first (apply max-key (fn [[_ v]] v) (map-indexed vector xs))))))
      ;; a picture of 12 bars in 168 × 64
      bar-w 13 x0 6 base 46 tall 38]
  {;; ── about ──
   :class "chroma~"
   :license "MPL-2.0"
   :doc "How much of each pitch class the signal on its left has, every ms (40 by default): a list of 12 values from C to B (0…1, the strongest 1) on the left, and the strongest class as a word (:c, :c#, … :b) on the right when it changes. Silence sends nothing. Chords, keys and drones become data for mt and the patch. Computed with Meyda."
   :usage "chroma~ [ms]"
   :io [1 2]
   :size [168 64]
   :args [[:ms 40]]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state]}]
              (cond
                (and (= inlet :audio) (:error value)) {:effects [[:print (:error value)]]}
                (and (= inlet :audio) (map? value) (> (or (:rms value) 0) gate) (= 12 (count (:chroma value))))
                (let [xs (:chroma value) top (strongest xs)
                      outs (cond-> []
                             (not= top (:top state)) (conj [1 top])
                             (not= xs (:xs state)) (conj [0 xs]))]
                  (if (seq outs) {:state {:xs xs :top top} :out outs :show xs} {}))
                :else {}))

   ;; ── view ──
   :draw (fn [{:keys [shown]}]
           (let [xs (if (and (sequential? shown) (= 12 (count shown))) shown (repeat 12 0))
                 top (when (some pos? xs) (apply max xs))]
             (into [[:rect {:x 2 :y 2 :w 164 :h 60 :r 4 :stroke :grid :fill :bg}]]
                   (mapcat (fn [i v n]
                             (let [h (* tall (api/clamp v 0 1)) x (+ x0 (* i bar-w))]
                               [[:rect {:x x :y (- base h) :w (- bar-w 3) :h h :r 1 :stroke nil
                                        :fill (if (and top (= v top)) :kairos :accent)}]
                                [:text {:x (+ x (/ (- bar-w 3) 2)) :y 58 :anchor :middle :size 7 :fill :soft} n]]))
                           (range 12) xs names))))

   ;; ── audio ──
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac)
                           sr (.-sampleRate ac)
                           ms (api/clamp (or (first (filter number? (:args b))) 40) 10 2000)
                           node {:in in :M (atom nil) :alive (atom true) :inlets [[in 0]] :outlets []}
                           on-block (fn [data at & _]
                                      (when-let [M @(:M node)]
                                        (set! (.-bufferSize M) size)
                                        (set! (.-sampleRate M) sr)
                                        (let [r (.extract M #js ["chroma" "rms"] (first data))
                                              xs (mapv (fn [x] (/ (js/Math.round (* 100 (if (js/isFinite x) x 0))) 100))
                                                       (array-seq (.-chroma r)))]
                                          (api/report! (:id b) {:chroma xs :rms (.-rms r)} at))))]
                       (-> (api/load-script meyda-url)
                           (.then (fn [_] (reset! (:M node) (.-Meyda js/window))))
                           (.catch (fn [e] (api/report! (:id b) {:error (str "chroma~: " (.-message e))} nil))))
                       (-> (api/tap ac {:mode :frames :size size :hop (js/Math.round (* sr (/ ms 1000)))} on-block)
                           (.then (fn [w] (if @(:alive node) (.connect in w) (try (.disconnect w) (catch :default _ nil)))))
                           (.catch (fn [e] (js/console.error "chroma~" e))))
                       node))
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (try (.disconnect (:in node)) (catch :default _ nil)))}})
