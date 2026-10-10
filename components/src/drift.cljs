;; drift · a slow random walk in pitch, different for every voice
{;; ── about ──────────────────────────────────────────────
 :class "drift"
 :license "MPL-2.0"
 :doc "Detunes every frequency with a slow random walk (in cents), different for every voice."
 :usage "drift [max-cents]"
 :io [2 2]

 ;; ── arguments ──────────────────────────────────────────
 :args [[:max-cents 25]]

 ;; ── logic ──────────────────────────────────────────────
 :receive (fn [{:keys [inlet value state args]}]
            (let [limit (:max-cents args)
                  st (or state {:ids nil :cents {}})]
              (cond
                ;; ids arrive before the frequencies (right outlet of a reader)
                (= inlet 1) {:state (assoc st :ids value) :out [[1 value]]}
                (sequential? value)
                (let [ids (or (:ids st) (range (count value)))
                      cents (into {} (for [i ids]
                                       [i (comp/clamp (+ (get (:cents st) i 0) (- (* 4 (js/Math.random)) 2))
                                                      (- limit) limit)]))]
                  {:state (assoc st :cents cents)
                   :out [[0 (mapv (fn [i f] (* f (js/Math.pow 2 (/ (get cents i 0) 1200)))) ids value)]]})
                :else {:state st})))}
