;; swap · how far apart two rhythms are (Toussaint's swap distance)
;; Part of @kairotic/rhythm. Written against the Kairotic API (api/…).
;; Two rhythms of n pulses, as pulses. A swap exchanges an onset and the silence beside it, and the swap
;; distance is how many of them turn one rhythm into the other: an onset moved far counts more than one moved
;; near, which the Hamming distance (how many pulses differ) cannot tell. With the same number of onsets it
;; is the sum of |uᵢ − vᵢ| over the onsets in order; with different numbers, the directed swap distance (each
;; onset of the shorter rhythm goes to its own onset of the other, the least moving in all). Around the circle
;; a swap may cross the end of the bar; as necklaces, the rhythms are also compared at every rotation (the
;; one that brings them closest is said). For the futuribles and the agents: is a variation still the same
;; timeline? Both inlets take pulses (euclid's, a necklace's outlet 2); the left one compares, the right one
;; is the reference (cold).
(let [onsets-of (fn [ps] (vec (keep-indexed (fn [i x] (when (= 1 x) i)) ps)))
      rotate (fn [xs r] (let [n (count xs)] (if (zero? n) xs (let [r (mod r n)] (vec (concat (subvec xs r) (subvec xs 0 r)))))))
      pulses? (fn [v] (and (sequential? v) (seq v) (every? #{0 1} v)))
      cdist (fn [n a b] (let [d (js/Math.abs (- a b))] (min d (- n d))))
      ;; onsets in order, each of the shorter list to its own of the longer one, the least moving in all
      ;; (dynamic programming over both lists: the directed swap distance; with equal lengths, Σ|uᵢ − vᵢ|)
      assign (fn [d us vs]
               (let [[a b] (if (<= (count us) (count vs)) [us vs] [vs us]) p (count a) q (count b)]
                 (cond (zero? p) 0
                       :else (loop [i 0 row (vec (repeat (inc q) 0))]
                               (if (= i p)
                                 (peek row)
                                 (recur (inc i)
                                        (reduce (fn [nr j]
                                                  (conj nr (min (if (> j (inc i)) (peek nr) js/Infinity)
                                                                (+ (nth row (dec j)) (d (nth a i) (nth b (dec j)))))))
                                                [js/Infinity] (range 1 (inc q)))))))))
      linear (fn [A B] (assign (fn [x y] (js/Math.abs (- x y))) (onsets-of A) (onsets-of B)))
      ;; around the circle: with as many onsets, the best cyclic shift of the pairing; otherwise the best place
      ;; to cut the circle open
      circular (fn [A B]
                 (let [n (count A) us (onsets-of A) vs (onsets-of B) k (count us)]
                   (cond (or (empty? us) (empty? vs)) (if (= (count us) (count vs)) 0 nil)
                         (= k (count vs)) (apply min (for [s (range k)] (reduce + (map (fn [i] (cdist n (nth us i) (nth vs (mod (+ i s) k)))) (range k)))))
                         :else (apply min (for [c (range n)]
                                            (assign (fn [x y] (cdist n x y)) (onsets-of (rotate A c)) (onsets-of (rotate B c))))))))
      hamming (fn [A B] (count (filter false? (map = A B))))
      compare-them (fn [A B]
                     (let [n (count A) ka (count (onsets-of A)) kb (count (onsets-of B))
                           ;; a rhythm without onsets is not far from another one by swaps: only from silence
                           none? (and (or (zero? ka) (zero? kb)) (not= ka kb))
                           rs (vec (for [r (range n)] (circular A (rotate B r))))
                           best (when-not none? (apply min rs))
                           hs (vec (for [r (range n)] (hamming A (rotate B r))))]
                       {:n n :k [ka kb]
                        :swap (when-not none? (linear A B)) :circular (when-not none? (circular A B))
                        :necklace best :rotation (when best (first (keep-indexed (fn [r x] (when (= x best) r)) rs)))
                        :hamming (hamming A B) :necklace-hamming (apply min hs)}))]
  {;; ── about ──
   :class "swap"
   :license "MPL-2.0"
   :doc "How far apart two rhythms are (Toussaint's swap distance). Both inlets take pulses of n pulses (euclid's, a necklace's outlet 2): the left one is compared with the right one, the reference (cold). A swap exchanges an onset and the silence beside it; the swap distance is how many turn one rhythm into the other — an onset moved far counts more than one moved near, as the Hamming distance (how many pulses differ) cannot tell. With different numbers of onsets, the directed swap distance (each onset of the shorter rhythm to its own of the other). Out, a map: {:swap — in the bar —, :circular — a swap may cross the end of the bar —, :necklace — the best over every rotation of the reference — and :rotation, the one that gives it, :hamming and :necklace-hamming, :n, :k [onsets of each]}. Rhythms of different lengths are not compared. A bang compares again."
   :usage "swap"
   :io [2 1]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state]}]
              (let [st (or state {})]
                (cond
                  (= inlet 1) (if (pulses? value) {:state (assoc st :ref (vec value))} {})
                  (and (#{:bang} value) (:a st)) (let [A (:a st) B (:ref st)]
                                                   (if (and B (= (count A) (count B))) {:out [[0 (compare-them A B)]]} {}))
                  (pulses? value) (let [A (vec value) B (:ref st)]
                                    (cond (nil? B) {:state (assoc st :a A) :show "no reference yet (right inlet)"}
                                          (not= (count A) (count B)) {:state (assoc st :a A) :show (str (count A) " pulses against " (count B) ": not compared")}
                                          :else (let [m (compare-them A B)]
                                                  {:state (assoc st :a A) :show (str "swap " (:swap m) " · necklace " (:necklace m)) :out [[0 m]]})))
                  :else {})))})
