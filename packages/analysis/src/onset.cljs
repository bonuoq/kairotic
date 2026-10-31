;; onset~ · the beginnings of sounds: a note, a stroke, a syllable
;; Part of @kairotic/analysis. Written against the Kairotic API (api/…). The spectrum is Meyda's (MIT,
;; meyda.js.org), loaded from jsDelivr the first time one is needed.
(let [meyda-url "npm:meyda@5.6.3/dist/web/meyda.min.js"
      size 2048                 ; the frames every analysis box of the package uses (see features~)
      bins 256                  ; the spectrum up to about 6 kHz at 48 kHz: where onsets are heard
      ;; how much the spectrum grew since the frame before, relative to what sounds now (0 steady … 1
      ;; from silence): what grows counts, what fades does not
      flux (fn [cur prev]
             (if-not prev
               0
               (loop [i 1 up 0 all 0]
                 (if (< i bins)
                   (let [a (aget cur i) d (- a (aget prev i))]
                     (recur (inc i) (if (pos? d) (+ up d) up) (+ all a)))
                   (if (> all 1e-6) (/ up all) 0)))))
      median (fn [xs] (if (empty? xs) 0 (nth (sort xs) (quot (count xs) 2))))
      gate 0.005                ; rms under it (about -46 dB) is silence
      ;; the decision, pure: an onset where the flux rises above threshold × the median of the last
      ;; frames (and above 0.1) while the energy does not fall (a sound cut at once spreads its spectrum like an
      ;; attack, but its energy goes down: not an onset), not sooner than ms after the last one
      detect (fn [state {:keys [flux rms]} at threshold ms]
               (let [hist (vec (take-last 16 (:hist state)))
                     m (median hist)
                     over (and (> rms gate) (> flux 0.1) (> flux (* threshold m)) (>= rms (or (:rms state) 0)))
                     fire (and over (not (:over state)) (or (nil? (:last state)) (>= (- at (:last state)) (/ ms 1000))))]
                 [(cond-> (assoc state :hist (conj hist flux) :over over :rms rms) fire (assoc :last at))
                  (when fire (/ (js/Math.round (* 100 flux)) 100))]))]
  {;; ── about ──
   :class "onset~"
   :license "MPL-2.0"
   :doc "The beginnings of sounds in the signal on its left — a note, a stroke, a syllable —: a bang on the left for each, and how strong it was (the growth of its spectrum, 0…1) on the second outlet; on the third, that growth for every frame (the onset strength envelope, for beat tracking: issue #106). threshold (3) is how far above the usual change of the last frames an onset must rise, while the energy does not fall (a sound cut at once is not an onset); ms (80) the least time between two. Every 512 samples (about 11 ms), on frames of 2048. An onset is reported with the frame it is first seen in: measured on sines, plucked tones and noise bursts that start at a known sample, 6 ms after it as a median (0.7 to 10.7 ms: one hop), and 11 ms for a new note over a held one. [:threshold x] and [:ms y] change them while it listens, and a [:segment …] from form~ makes it forget the usual change of the section before (so a quiet section after a loud one is not deaf). Into a counter, a metro that follows, a sample's rec, or the right inlet of transcribe (its strength, as the weight of the note)."
   :usage "onset~ [threshold] [ms]"
   :io [1 3]
   :size [64 30]
   :args [[:threshold 3] [:ms 80]]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (cond
                (and (= inlet :audio) (:error value)) {:effects [[:print (:error value)]]}
                ;; adaptive: [:threshold x] and [:ms y] change them while it listens (from form~, a message box…);
                ;; a [:segment …] from form~ forgets the usual change of the section before
                (and (vector? value) (= 2 (count value)) (#{:threshold :ms} (first value)) (number? (second value)))
                {:state (assoc-in state [:set (first value)] (second value)) :show {:label (str (name (first value)) " " (api/nice (second value)))}}
                (and (vector? value) (= :segment (first value)))
                {:state (assoc state :hist [])}
                (and (= inlet :audio) (map? value))
                (let [[st strength] (detect state value at (api/clamp (or (get-in state [:set :threshold]) (:threshold args)) 1 50)
                                            (api/clamp (or (get-in state [:set :ms]) (:ms args)) 10 2000))]
                  ;; the flux of every frame on the third outlet: the onset strength envelope (issue #106)
                  (let [env [2 (/ (js/Math.round (* 1000 (:flux value))) 1000)]]
                    (if strength
                      {:state st :out [[1 strength] [0 :bang] env] :show {:at at :strength strength}}
                      {:state st :out [env]})))
                :else {}))

   ;; ── view: a dot that lights on each onset ──
   :derive (fn [{:keys [shown]}]
             {:label (cond (:strength shown) (str (:strength shown)) (:label shown) (:label shown) :else "onset")})
   :view [[:rect {:x 2 :y 2 :w 60 :h 26 :r 3 :stroke :grid :fill :bg}]
          [:circle {:cx 15 :cy 15 :r 6 :stroke :accent :fill :accent}]
          [:text {:x 26 :y 19 :size 10 :fill :soft} :$label]]

   ;; ── audio ──
   :audio {:create (fn [ac b _]
                     (let [in (.createGain ac)
                           sr (.-sampleRate ac)
                           node {:in in :M (atom nil) :prev (atom nil) :alive (atom true) :inlets [[in 0]] :outlets []}
                           on-block (fn [data at & _]
                                      (when-let [M @(:M node)]
                                        (set! (.-bufferSize M) size)
                                        (set! (.-sampleRate M) sr)
                                        (let [r (.extract M #js ["amplitudeSpectrum" "rms"] (first data))
                                              cur (.-amplitudeSpectrum r)
                                              f (flux cur @(:prev node))]
                                          (reset! (:prev node) (.slice cur 0 bins))
                                          (api/report! (:id b) {:flux f :rms (.-rms r)} at))))]
                       (-> (api/load-script meyda-url)
                           (.then (fn [_] (reset! (:M node) (.-Meyda js/window))))
                           (.catch (fn [e] (api/report! (:id b) {:error (str "onset~: " (.-message e))} nil))))
                       (-> (api/tap ac {:mode :frames :size size :hop 512} on-block)
                           (.then (fn [w] (if @(:alive node) (.connect in w) (try (.disconnect w) (catch :default _ nil)))))
                           (.catch (fn [e] (js/console.error "onset~" e))))
                       node))
           :dispose (fn [node]
                      (reset! (:alive node) false)
                      (try (.disconnect (:in node)) (catch :default _ nil)))}})
