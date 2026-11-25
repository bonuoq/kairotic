;; SPDX-License-Identifier: MPL-2.0
;; vary · again, but different: a rhythm d swaps away, or redrawn below a metrical depth
;; Part of @kairotic/rhythm. Written against the Kairotic API (api/…).
;; Discussion #207 (redo with variation): "again, but different" with a measured likeness. Two readings of
;; how different, both drawn with a seed (the same seed, the same variations in the same order: a room and
;; the history hear the same; each bang the next one):
;;   swaps (by default)  exactly d swaps away (Toussaint's swap distance): each swap takes an onset one pulse
;;                       further from where it was — d = 1 is the same timeline with one onset displaced;
;;   depth               the onsets on the strong pulses kept, down to metrical level d (0 the downbeat, 1
;;                       the half bar…), the others drawn again among the weaker pulses — the same skeleton,
;;                       a new surface: discussion #321's "vary from depth k", for rhythm, with the bar's
;;                       metrical levels (twos, then threes: 16 pulses 2·2·2·2, 12 pulses 2·2·3) as its grammar.
;; With downbeat the first pulse keeps what it has. The variation goes out as pulses, and how it was made as
;; data: the steps from the rhythm given ([:swap from to], or [:remove i] [:add j]), and how far it went.
(let [M 2147483647
      rng (fn [seed i]
            (let [s (volatile! (inc (mod (+ (* 7919 (js/Math.abs (js/Math.round seed))) (* 104729 i) 31337) (dec M))))]
              (dotimes [_ 4] (vreset! s (mod (* @s 16807) M)))
              (fn [] (vreset! s (mod (* @s 16807) M)) (/ (dec @s) (dec M)))))
      onsets-of (fn [ps] (vec (keep-indexed (fn [i x] (when (= 1 x) i)) ps)))
      pulses? (fn [v] (and (sequential? v) (seq v) (every? #{0 1} v)))
      ;; the metrical level of each of n pulses: n's factors, twos first (16 → 2·2·2·2, 12 → 2·2·3, 6 → 2·3);
      ;; pulse i is at the first level whose division reaches it (0 the downbeat)
      factors (fn [n] (let [fs (loop [m n f 2 acc []] (cond (= m 1) acc (zero? (mod m f)) (recur (/ m f) f (conj acc f)) :else (recur m (inc f) acc)))]
                        (vec (sort fs))))
      levels (fn [n] (let [fs (factors n)
                           spans (reductions (fn [span f] (/ span f)) n fs)]   ; n, n/f1, n/f1/f2 … 1
                       (mapv (fn [i] (first (keep-indexed (fn [l span] (when (zero? (mod i span)) l)) spans))) (range n))))
      ;; d swaps, each taking an onset one pulse further from where it was (never past a neighbour)
      by-swaps (fn [ps d r keep0?]
                 (let [n (count ps) home (onsets-of ps)]
                   (loop [cur ps pos home left d steps []]
                     (let [opts (vec (for [i (range (count pos)) dir [-1 1]
                                           :let [p (nth pos i) q (+ p dir) h (nth home i)]
                                           :when (and (< -1 q n) (zero? (nth cur q))
                                                      (> (js/Math.abs (- q h)) (js/Math.abs (- p h)))
                                                      (not (and keep0? (or (= p 0) (= q 0)))))]
                                       [i p q]))]
                       (if (or (zero? left) (empty? opts))
                         {:pulses cur :steps steps :went (- d left)}
                         (let [[i p q] (nth opts (js/Math.floor (* (r) (count opts))))]
                           (recur (assoc cur p 0 q 1) (assoc pos i q) (dec left) (conj steps [:swap p q]))))))))
      ;; the onsets down to level k kept; the others drawn again among the pulses deeper than k
      by-depth (fn [ps k r keep0?]
                 (let [n (count ps) lv (levels n)
                       kept? (fn [i] (or (<= (nth lv i) k) (and keep0? (zero? i))))
                       free (vec (filter (fn [i] (not (kept? i))) (range n)))
                       moving (vec (filter (fn [i] (and (= 1 (nth ps i)) (not (kept? i)))) (range n)))
                       chosen (set (take (count moving) (loop [v free j 0]
                                                           (if (< j (count moving))
                                                             (let [m (+ j (js/Math.floor (* (r) (- (count v) j))))]
                                                               (recur (assoc v j (nth v m) m (nth v j)) (inc j)))
                                                             v))))
                       out (mapv (fn [i] (if (kept? i) (nth ps i) (if (chosen i) 1 0))) (range n))
                       gone (vec (remove chosen moving)) came (vec (remove (set moving) (sort chosen)))]
                   {:pulses out :steps (vec (concat (map (fn [i] [:remove i]) gone) (map (fn [j] [:add j]) came)))
                    :went (count gone) :kept (vec (filter (fn [i] (and (kept? i) (= 1 (nth ps i)))) (range n)))}))
      params (fn [args over] (let [o (merge args over)] {:d (max 0 (js/Math.round (or (:d o) 1))) :seed (or (:seed o) 1)
                                                         :depth (boolean (:depth o)) :downbeat (boolean (:downbeat o))}))
      draw (fn [st args]
             (let [{:keys [d seed depth downbeat]} (params args (:over st)) r (rng seed (:i st))
                   v (if depth (by-depth (:ps st) d r downbeat) (by-swaps (:ps st) d r downbeat))]
               {:state (update st :i inc)
                :show (str (if depth (str "from depth " d) (str d " swap" (when (not= 1 d) "s"))) " · seed " seed " · " (inc (:i st)))
                :out [[1 (merge {:steps (:steps v) :mode (if depth :depth :swaps) :d d :seed seed :draw (inc (:i st))}
                                (if depth {:changed (:went v) :kept (:kept v)} {:swaps (:went v)}))]
                      [0 (:pulses v)]]}))]
  {;; ── about ──
   :class "vary"
   :license "MPL-2.0"
   :doc "Again, but different (discussion #207): a variation of the rhythm on the left (pulses), drawn with a seed — the same seed, the same variations in the same order; each bang the next one, a new rhythm the first again. By default exactly d swaps away (Toussaint's swap distance): each swap takes an onset one pulse further from where it was, never past a neighbour (vary 1: one onset displaced). With depth, the onsets on the strong pulses down to metrical level d are kept (0 the downbeat, 1 the half bar…, the bar's levels its factors, twos first: 16 → 2·2·2·2, 12 → 2·2·3) and the others drawn again among the weaker pulses: the same skeleton, a new surface (discussion #321's \"vary from depth k\"). With downbeat the first pulse keeps what it has. Out: the variation (left, pulses) and how it was made (right): {:steps [[:swap from to] or [:remove i] [:add j] …] :mode :d :seed :draw, and :swaps (how many it could make) or :changed and :kept}. [:d 2], [:seed 7] (or a map of them) change it; :reset starts the draws again."
   :usage "vary [d 1] [seed 1] [depth] [downbeat]"
   :io [1 2]

   ;; ── arguments ──
   :args [[:d 1] [:seed 1] [:depth false] [:downbeat false]]

   ;; ── logic ──
   :receive (fn [{:keys [value state args]}]
              (let [st (or state {:over {} :i 0})]
                (cond
                  (pulses? value) (if (= (vec value) (:ps st)) {:state st} (draw (assoc st :ps (vec value) :i 0) args))
                  (and (#{:bang} value) (:ps st)) (draw st args)
                  (#{:reset} value) {:state (assoc st :i 0)}
                  (and (vector? value) (= 2 (count value)) (#{:d :seed} (first value)) (number? (second value)))
                  (let [s2 (assoc st :over (assoc (:over st) (first value) (second value)) :i 0)] (if (:ps s2) (draw s2 args) {:state s2}))
                  (map? value) (let [s2 (assoc st :over (merge (:over st) (select-keys value [:d :seed :depth :downbeat])) :i 0)]
                                 (if (:ps s2) (draw s2 args) {:state s2}))
                  :else {})))})
