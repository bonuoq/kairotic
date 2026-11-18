;; chance · k onsets among n pulses, drawn with a seed
;; Part of @kairotic/rhythm. Written against the Kairotic API (api/…).
;; A generator of pulses, as euclid is, with chance instead of evenness: each bang draws another rhythm of k
;; onsets among n pulses. The draws are the seed's: draw i of seed s is always the same rhythm, so the same
;; seed plays the same game for everyone in a room and again from the history (:reset starts its draws
;; again). Against euclid's, a necklace's measures say how even or uneven chance came out.
(let [M 2147483647
      ;; Park–Miller, started from the seed and the number of the draw, a few turns to mix them
      rng (fn [seed i]
            (let [s (volatile! (inc (mod (+ (* 7919 (js/Math.abs (js/Math.round seed))) (* 104729 i) 12345) (dec M))))]
              (dotimes [_ 4] (vreset! s (mod (* @s 16807) M)))
              (fn [] (vreset! s (mod (* @s 16807) M)) (/ (dec @s) (dec M)))))
      ;; k of the n pulses, as a shuffle stopped after k (Fisher–Yates)
      draw (fn [k n seed i]
             (let [r (rng seed i)
                   picked (loop [xs (vec (range n)) j 0]
                            (if (= j k) (set (subvec xs 0 k))
                                (let [m (+ j (js/Math.floor (* (r) (- n j)))) xj (nth xs j) xm (nth xs m)]
                                  (recur (assoc xs j xm m xj) (inc j)))))]
               (mapv (fn [p] (if (picked p) 1 0)) (range n))))
      params (fn [args over]
               (let [o (merge args over)
                     n (api/clamp (js/Math.round (or (:n o) 8)) 1 128)]
                 {:n n :k (api/clamp (js/Math.round (or (:k o) 3)) 0 n) :seed (or (:seed o) 1)}))]
  {;; ── about ──
   :class "chance"
   :license "MPL-2.0"
   :doc "A generator of pulses, as euclid, with chance instead of evenness: each bang draws another rhythm of k onsets among n pulses, sent as pulses (ones and zeros) for a necklace. The draws are the seed's — the same seed, the same rhythms in the same order, for everyone in a room and again from the history; :reset starts its draws again. [:k 5], [:n 16], [:seed 7] (or a map of them) change it and start again; a number is k."
   :usage "chance [k 3] [n 8] [seed 1]"
   :io [1 1]

   ;; ── arguments ──
   :args [[:k 3] [:n 8] [:seed 1]]

   ;; ── logic ──
   :receive (fn [{:keys [value state args]}]
              (let [st (or state {:over {} :i 0})
                    again (fn [over] {:state {:over over :i 0} :show (let [p (params args over)] (str (:k p) "/" (:n p) " · seed " (:seed p)))})]
                (cond
                  (#{:bang} value) (let [p (params args (:over st)) i (:i st)]
                                     {:state (assoc st :i (inc i)) :show (str (:k p) "/" (:n p) " · seed " (:seed p) " · draw " (inc i))
                                      :out [[0 (draw (:k p) (:n p) (:seed p) i)]]})
                  (#{:reset} value) (again (:over st))
                  (number? value) (again (assoc (:over st) :k value))
                  (and (vector? value) (= 2 (count value)) (#{:k :n :seed} (first value)) (number? (second value)))
                  (again (assoc (:over st) (first value) (second value)))
                  (map? value) (again (merge (:over st) (select-keys value [:k :n :seed])))
                  :else {})))})
