;; euclid · a Euclidean rhythm, as pulses: k onsets spread as evenly as they can be over n pulses
;; Part of @kairotic/rhythm. Written against the Kairotic API (api/…).
;; Bjorklund's algorithm (Toussaint, "The Euclidean algorithm generates traditional musical rhythms", 2005):
;; E(3,8) is the tresillo, E(5,8) the cinquillo, E(5,16) a rotation of the bossa nova, E(7,12) the bembé.
;; A generator, almost a function: (euclid k n rotation) → pulses, ones and zeros — the common tongue of the
;; rhythm boxes, as Hz are of pitch. It has no view: a necklace shows, edits, measures and writes as a tree
;; what it makes (euclid → necklace → tree).
(let [bjorklund (fn [k n]
                  (cond (<= n 0) []
                        (<= k 0) (vec (repeat n 0))
                        (>= k n) (vec (repeat n 1))
                        :else (loop [a (vec (repeat k [1])) b (vec (repeat (- n k) [0]))]
                                (if (<= (count b) 1)
                                  (vec (apply concat (concat a b)))
                                  (let [m (min (count a) (count b))]
                                    (recur (mapv into (subvec a 0 m) (subvec b 0 m))
                                           (if (> (count a) m) (subvec a m) (subvec b m))))))))
      ;; read from pulse r on: the rhythm in a fixed position against the beat
      rotate (fn [xs r] (let [n (count xs)] (if (zero? n) xs (let [r (mod r n)] (vec (concat (subvec xs r) (subvec xs 0 r)))))))
      pulses-of (fn [args over]
                  (let [o (merge args over)
                        n (api/clamp (js/Math.round (or (:n o) 8)) 1 128)
                        k (api/clamp (js/Math.round (or (:k o) 3)) 0 n)]
                    {:k k :n n :rotation (mod (js/Math.round (or (:rotation o) 0)) n)
                     :pulses (rotate (bjorklund k n) (or (:rotation o) 0))}))
      ;; a change: sent when the pulses are new (the same again changes nothing); a bang sends them anyway
      changed (fn [args st over always?]
                (let [r (pulses-of args over)
                      shown (str "E(" (:k r) "," (:n r) ")" (when (pos? (:rotation r)) (str " ↻" (:rotation r))))]
                  (if (and (not always?) (= (:pulses r) (:sent st)))
                    {:state (assoc st :over over) :show shown}
                    {:state (assoc st :over over :sent (:pulses r)) :show shown :out [[0 (:pulses r)]]})))]
  {;; ── about ──
   :class "euclid"
   :license "MPL-2.0"
   :doc "A Euclidean rhythm (Bjorklund's algorithm, after Toussaint), as pulses: k onsets spread as evenly as they can be over n pulses, from pulse rotation on — euclid 3 8 is the tresillo [1 0 0 1 0 0 1 0], euclid 5 8 the cinquillo, euclid 5 16 a rotation of the bossa nova (euclid 5 16 6 the bossa nova), euclid 7 12 the bembé. A generator with no view: a bang sends the pulses; [:k 5], [:n 16], [:rotation 2] (or a map of them) change them and send them when they are new, a number is k. Pulses are what every rhythm box takes: a necklace after it shows, edits and measures the rhythm, and writes it as a musical tree with pitches (euclid → necklace → tree)."
   :usage "euclid [k 3] [n 8] [rotation 0]"
   :io [1 1]

   ;; ── arguments ──
   :args [[:k 3] [:n 8] [:rotation 0]]

   ;; ── logic ──
   :receive (fn [{:keys [value state args]}]
              (let [st (or state {:over {}})
                    over (:over st)
                    set-over (fn [m] (changed args st (merge over m) false))]
                (cond
                  (#{:bang} value) (changed args st over true)
                  (number? value) (set-over {:k value})
                  (and (vector? value) (= 2 (count value)) (#{:k :n :rotation} (first value)) (number? (second value)))
                  (set-over {(first value) (second value)})
                  (map? value) (set-over (select-keys value [:k :n :rotation]))
                  :else {})))})
