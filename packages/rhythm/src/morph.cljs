;; morph · from one rhythm to another, swap by swap
;; Part of @kairotic/rhythm. Written against the Kairotic API (api/…).
;; Toussaint's swap distance does not only measure how far two rhythms are: it gives the way, the swaps
;; (an onset exchanged with the silence beside it) that turn one into the other with the fewest moves. A
;; ratio 0…1 is a point on that way: the rhythm after that share of its swaps — always a real rhythm, never a
;; blurred average (discussion #206: a merge of two branches as a musical operation). The way is sent as data
;; too, a derivation of steps — the operations a distance counts (parse) are the ones a morph or a variation
;; makes (generate), the same grammar read both ways (discussion #321).
;; Onsets are paired in order; with different numbers of onsets, as the directed swap distance pairs them
;; (each onset of the shorter rhythm to its own of the other): the ones left over go first (from A) or
;; appear last (into B). The swaps take turns, one pulse each, so the rhythm changes evenly along the way.
(let [onsets-of (fn [ps] (vec (keep-indexed (fn [i x] (when (= 1 x) i)) ps)))
      pulses? (fn [v] (and (sequential? v) (seq v) (every? #{0 1} v)))
      ;; the onsets of the shorter list paired, in order, with those of the longer one, the least moving in
      ;; all: [[u v] …] and the onsets of the longer one left over
      pairing (fn [us vs]
                (let [flip? (> (count us) (count vs)) [a b] (if flip? [vs us] [us vs]) p (count a) q (count b)
                      d (fn [x y] (js/Math.abs (- x y)))
                      ;; cost[i][j]: the first i of a among the first j of b; choice to walk back
                      table (reduce (fn [rows i]
                                      (conj rows (reduce (fn [row j]
                                                           (conj row (min (if (> j i) (peek row) js/Infinity)
                                                                          (+ (get-in rows [(dec i) (dec j)]) (d (nth a (dec i)) (nth b (dec j)))))))
                                                         [js/Infinity] (range 1 (inc q)))))
                                    [(vec (repeat (inc q) 0))] (range 1 (inc p)))
                      pairs (loop [i p j q acc ()]
                              (cond (zero? i) acc
                                    (and (> j i) (= (get-in table [i j]) (get-in table [i (dec j)]))) (recur i (dec j) acc)
                                    :else (recur (dec i) (dec j) (conj acc [(nth a (dec i)) (nth b (dec j))]))))
                      used (set (map second pairs))
                      left (vec (remove used b))]
                  (if flip?
                    {:pairs (mapv (fn [[x y]] [y x]) pairs) :removed left :added []}
                    {:pairs (vec pairs) :removed [] :added left})))
      ;; the way: first the onsets of A left over go, then the paired ones move a pulse at a time, taking turns
      ;; (one blocked by a neighbour waits for it), then the onsets of B left over appear
      way (fn [A B]
            (let [n (count A) {:keys [pairs removed added]} (pairing (onsets-of A) (onsets-of B))
                  start (reduce (fn [ps i] (assoc ps i 0)) (vec A) removed)
                  k (count pairs)
                  ;; taking turns: after onset i moves, the search for the next move starts at i + 1
                  moves (loop [ps start pos (mapv first pairs) nxt 0 acc []]
                          (let [mv (first (for [o (range k)
                                                :let [i (mod (+ nxt o) k) p (nth pos i) t (second (nth pairs i))]
                                                :when (not= p t)
                                                :let [q (if (< p t) (inc p) (dec p))]
                                                :when (and (< -1 q n) (zero? (nth ps q)))]
                                            [i p q]))]
                            (if-not mv
                              acc
                              (let [[i p q] mv]
                                (recur (assoc ps p 0 q 1) (assoc pos i q) (inc i) (conj acc [:swap p q]))))))]
              (vec (concat (map (fn [i] [:remove i]) removed) moves (map (fn [j] [:add j]) added)))))
      apply-step (fn [ps [op a b]] (case op :swap (assoc ps a 0 b 1) :remove (assoc ps a 0) :add (assoc ps a 1) ps))
      at (fn [A steps t] (reduce apply-step (vec A) (take (js/Math.round (* (api/clamp t 0 1) (count steps))) steps)))
      send (fn [st]
             (let [{:keys [a b t]} st]
               (if (and a b (= (count a) (count b)))
                 (let [steps (way a b) r (at a steps t)
                       n-swaps (count (filter (fn [s] (= :swap (first s))) steps))]
                   {:state (assoc st :steps steps)
                    :show (str "→ " (js/Math.round (* 100 t)) "% · " n-swaps " swaps")
                    :out [[1 {:steps steps :swaps n-swaps :at (js/Math.round (* t (count steps))) :of (count steps)}] [0 r]]})
                 {:state st :show (cond (nil? a) "no rhythm yet (left)" (nil? b) "no target yet (middle)"
                                        :else (str (count a) " pulses towards " (count b) ": not morphed"))})))]
  {;; ── about ──
   :class "morph"
   :license "MPL-2.0"
   :doc "From one rhythm to another, swap by swap (Toussaint's swap distance as a way, discussion #206). Pulses on the left (A, hot) and on the middle inlet (B, the target, cold), both of n pulses; a ratio 0…1 on the right (hot): the rhythm after that share of the swaps that turn A into B with the fewest moves — always a real rhythm. Onsets paired in order (with different numbers, as the directed swap distance pairs them: the ones of A left over go first, those of B appear last); the swaps take turns, a pulse each, so the rhythm changes evenly. Out: the pulses at the ratio (left) and the way as data (right): {:steps [[:swap from to] [:remove i] [:add j] …] :swaps :at :of}. A bang sends it again. The ratio can be the args' (morph 0.5)."
   :usage "morph [ratio 0]"
   :io [3 2]

   ;; ── arguments ──
   :args [[:ratio 0]]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args]}]
              (let [st (or state {:t (api/clamp (or (:ratio args) 0) 0 1)})]
                (case inlet
                  1 (if (pulses? value) {:state (assoc st :b (vec value))} {})
                  2 (if (number? value) (send (assoc st :t (api/clamp value 0 1))) {})
                  (cond (#{:bang} value) (send st)
                        (pulses? value) (send (assoc st :a (vec value)))
                        (number? value) (send (assoc st :t (api/clamp value 0 1)))
                        :else {}))))})
