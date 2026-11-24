;; SPDX-License-Identifier: MPL-2.0
;; homometric · the other rhythms with the same interval vector
;; Part of @kairotic/rhythm. Written against the Kairotic API (api/…).
;; Two rhythms are homometric when they hold the same distances between onsets, as many times each — the
;; same interval vector, the same "histogram" — without being the same necklace turned or seen in a mirror
;; (Toussaint, after crystallography: Patterson, Rosenblatt and Seymour). The two flat rhythms of four onsets
;; in twelve are homometric; so is any half of the pulses of an even cycle with its complement, which gives two
;; drums (high and low congas) the same intervals. Given a rhythm as pulses, it searches every rhythm of as many
;; onsets among as many pulses (up to 7 000 of them: any rhythm of 16 pulses; a moment for the largest) and sends the others it finds, each from its first onset, as a list of
;; pulses (for nth, or a necklace one by one), and how many there are.
(let [onsets-of (fn [ps] (vec (keep-indexed (fn [i x] (when (= 1 x) i)) ps)))
      pulses? (fn [v] (and (sequential? v) (seq v) (every? #{0 1} v)))
      dist (fn [n a b] (let [d (js/Math.abs (- a b))] (min d (- n d))))
      ivec-of (fn [n os] (let [c (frequencies (for [i (range (count os)) j (range (inc i) (count os))] (dist n (nth os i) (nth os j))))]
                           (mapv (fn [d] (get c d 0)) (range 1 (inc (quot n 2))))))
      ;; a necklace up to rotation and mirror, as its smallest form starting at 0 (a bracelet)
      bracelet (fn [n os]
                 (first (sort (for [f [identity (fn [x] (mod (- n x) n))] r (range n)]
                                (vec (sort (map (fn [x] (mod (- (f x) r) n)) os)))))))
      ;; the subsets of 1…n−1 of size m (0 is always an onset: rotations are the same necklace)
      subsets (fn subsets [from n m]
                (cond (zero? m) [[]]
                      (> m (- n from)) []
                      :else (concat (map (fn [s] (cons from s)) (subsets (inc from) n (dec m))) (subsets (inc from) n m))))
      ;; how many rhythms the search goes through: C(n−1, k−1)
      choose (fn [a b] (reduce (fn [acc i] (/ (* acc (- a i)) (inc i))) 1 (range (min b (- a b)))))
      limit 7000
      search (fn [ps]
               (let [n (count ps) os (onsets-of ps) k (count os) target (ivec-of n os) own (bracelet n os)]
                 (if (zero? k) []
                     (->> (subsets 1 n (dec k))
                          (map (fn [s] (vec (cons 0 s))))
                          (filter (fn [o] (= target (ivec-of n o))))
                          (map (fn [o] (bracelet n o)))
                          distinct
                          (remove (fn [b] (= b own)))
                          sort
                          (mapv (fn [b] (let [on (set b)] (mapv (fn [i] (if (on i) 1 0)) (range n)))))))))]
  {;; ── about ──
   :class "homometric"
   :license "MPL-2.0"
   :doc "The other rhythms with the same interval vector (Toussaint, after crystallography): homometric rhythms hold the same distances between onsets, as many times each, without being the same necklace turned or in a mirror — the two flat rhythms of four onsets in twelve; any half of the pulses of an even cycle and its complement, two drums with the same intervals. Given pulses, it searches every rhythm of as many onsets among as many pulses (when they are at most 7 000: any rhythm of 16 pulses) and sends the others it finds, each from its first onset, as a list of pulses (left: for nth, or one by one to a necklace) and how many there are (right); none, an empty list. A bang searches again."
   :usage "homometric"
   :io [1 2]

   ;; ── logic ──
   :receive (fn [{:keys [value state]}]
              (let [st (or state {})
                    go (fn [ps] (if (> (choose (dec (count ps)) (max 0 (dec (count (onsets-of ps))))) limit)
                                  {:state (assoc st :ps ps) :show (str "too many to search (more than " limit " rhythms)")}
                                  (let [hs (search ps)]
                                    {:state (assoc st :ps ps) :show (str (count hs) " homometric")
                                     :out [[1 (count hs)] [0 hs]]})))]
                (cond
                  (and (#{:bang} value) (:ps st)) (go (:ps st))
                  (pulses? value) (if (= (vec value) (:ps st)) {:state st} (go (vec value)))
                  :else {})))})
