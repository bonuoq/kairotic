;; synth~ · a polyphonic triangle-wave synthesizer, one voice per id
;; Part of @kairotic/synth. Written against the Kairotic API (api/…).
(let [;; each id is a voice: a new id attacks, one that continues glides to its new frequency at `at`,
      ;; one that disappears is switched off
      voices! (fn [node pairs at]
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
                                      [vid {:osc o :g g}])))))))]
  {;; ── about ──
   :class "synth~"
   :license "MPL-2.0"
   :doc "Polyphonic triangle-wave synthesizer: frequencies on the left (a number or a list), voice ids on the right (from a reader). :stop silences it."
   :usage "synth~"
   :io [2 1]

   ;; ── logic ──
   :receive (fn [{:keys [state inlet value]}]
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

   ;; ── audio ──
   :audio {:create (fn [ac _ _] (let [out (.createGain ac)] (set! (.. out -gain -value) 0.3)
                                  {:outlets [[out 0]] :out out :voices (atom {})}))
           :effects {:voices voices!}
           :dispose (fn [node] (doseq [[_ v] @(:voices node)] (try (.stop (:osc v)) (catch :default _ nil))))}})
