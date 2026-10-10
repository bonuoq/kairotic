;; fifth · adds a just fifth above every frequency
{;; ── about ──────────────────────────────────────────────
 :class "fifth"
 :license "MPL-2.0"
 :doc "Adds a just fifth (3/2) above every frequency, as a voice of its own."
 :usage "fifth"
 :io [2 2]

 ;; ── logic ──────────────────────────────────────────────
 ;; a reader sends ids first (right outlet → inlet 1) and then frequencies (inlet 0)
 :receive (fn [{:keys [inlet value state]}]
            (if (= inlet 1)
              {:state value}
              (let [fs (filterv number? value)
                    ids (if (= (count state) (count fs)) state (range (count fs)))
                    up (fn [i] (keyword (str (if (keyword? i) (name i) i) "-5")))]
                {:out [[1 (vec (concat ids (map up ids)))]
                       [0 (vec (concat fs (map (fn [f] (* f 1.5)) fs)))]]})))}
