;; synth~ · a polyphonic triangle-wave synthesizer, one voice per id
;; Part of @kairotic/synth. Written against the Kairotic API (api/…).
(let [;; each id is a voice: a new id attacks (at the level [:gain v] set, 0.5 by default), one that continues
      ;; glides to its new frequency at `at`, one that disappears is switched off
      voices! (fn [node [pairs level] at]
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
                                      (.linearRampToValueAtTime (.-gain g) (* 0.4 level) (+ at 0.015))
                                      (.connect o g)
                                      (.connect g (:out node))
                                      (.start o at)
                                      [vid {:osc o :g g}])))))))]
  {;; ── about ──
   :class "synth~"
   :license "MPL-2.0"
   :doc "Polyphonic triangle-wave synthesizer: frequencies on the left (a number or a list), voice ids on the right (from a reader). [:gain v] (0…1, 0.5 by default) sets the level of the notes that start after it, as a player sends an event's :amp. :stop silences it."
   :usage "synth~"
   :io [2 1]

   ;; ── logic ──
   :receive (fn [{:keys [state inlet value]}]
              (let [level (if (number? (:level state)) (:level state) 0.5)]
                (cond
                  (= inlet 1) {:state (assoc state :ids (if (sequential? value) (vec value) [value]))}
                  ;; the level of the notes that start next (an event's :amp, from a player)
                  (and (vector? value) (#{:gain :amp :vel :velocity} (first value)) (number? (second value)))
                  {:state (assoc state :level (api/clamp (second value) 0 1))}
                  (number? value) {:state (dissoc state :ids) :effects [[:voices [[[:v0 value]] level]]]}
                  (sequential? value)
                  (let [fs (filterv number? value)
                        ids (:ids state)
                        ids (if (= (count ids) (count fs)) ids (mapv (fn [i] (keyword (str "v" i))) (range (count fs))))]
                    {:state (dissoc state :ids) :effects [[:voices [(mapv vector ids fs) level]]]})
                  (= value :stop) {:effects [[:voices [[] level]]]}
                  :else {})))

   ;; ── audio ──
   :audio {:create (fn [ac _ _] (let [out (.createGain ac)] (set! (.. out -gain -value) 0.3)
                                  {:outlets [[out 0]] :out out :voices (atom {})}))
           :effects {:voices voices!}
           :dispose (fn [node] (doseq [[_ v] @(:voices node)] (try (.stop (:osc v)) (catch :default _ nil))))}})
