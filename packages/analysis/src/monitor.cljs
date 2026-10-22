;; monitor · the messages that arrive, drawn over the last seconds
;; Part of @kairotic/analysis. Written against the Kairotic API (api/…).
;; One lane per inlet. What a lane draws depends on what arrives: a number is a line in the range it has
;; had in the window, a list of numbers is a strip of cells (one row per element: chroma, mfcc…), and
;; anything else (a bang, a word) is a mark. Time is that of the messages: the right edge is the last one.
(let [L 56                      ; the column of names and values, on the left
      budget 360                ; cells for all the strips of a box (the patch draws at most 600 shapes)
      seconds (fn [args] (api/clamp (or (first (filter number? args)) 6) 0.5 120))
      names (fn [args] (vec (filter keyword? args)))
      lanes (fn [args] (let [ns (names args)] (if (seq ns) (count ns) 1)))
      kind (fn [v] (cond (number? v) :line
                         (and (sequential? v) (seq v) (every? number? v)) :cells
                         :else :mark))
      label (fn [v] (cond (number? v) (str (api/nice v))
                          (sequential? v) (str "[" (count v) "]")
                          (= v :bang) "bang"
                          (keyword? v) (name v)
                          :else (let [s (str v)] (if (> (count s) 10) (str (subs s 0 9) "…") s))))
      ;; keeps a value: a line keeps about 150 points in the window, a strip about 48, marks all
      ;; (64 at most); what left the window goes, but one point before it stays for the line to enter
      keep-in (fn [pts at v win]
                (let [k (kind v) [t-last v-last] (peek pts)
                      step (case k :line (/ win 150) :cells (/ win 48) 0)
                      pts (if (and t-last (= k (kind v-last)) (pos? step) (< (- at t-last) step))
                            (conj (pop pts) [t-last v])
                            (conj pts [at v]))
                      pts (if (and (= k :mark) (> (count pts) 64)) (subvec pts (- (count pts) 64)) pts)
                      old (count (take-while (fn [[t]] (< t (- at win))) pts))]
                  (if (> old 1) (subvec pts (dec old)) pts)))]
  {;; ── about ──
   :class "monitor"
   :license "MPL-2.0"
   :doc "Draws the messages that arrive over the last seconds (6 by default), one lane per inlet: a lane for each word written after the seconds, which names it (monitor 6 rms centroid chroma has 3 inlets), or one lane without words. A number is drawn as a line in the range it has had in the window, a list of numbers as a strip with one row per element (chroma, mfcc), anything else (a bang, a word) as a mark. Time is that of the messages: the right edge is the last one. Sends nothing."
   :usage "monitor [seconds] [name …]"
   :io (fn [b] [(lanes (:args b)) 0])
   :dynamic-io true
   :size (fn [b] [300 (+ 8 (* 44 (lanes (:args b))))])

   ;; ── logic ──
   ;; the state is what is drawn: {:t last instant :lanes {inlet [[at value] …]}}
   :receive (fn [{:keys [inlet value state args at]}]
              (if (and (integer? inlet) (some? value) (number? at))
                (let [win (seconds args)
                      ;; the engine started again (its clock went back): start from nothing
                      state (if (and (:t state) (< at (- (:t state) 1))) nil state)
                      s (-> (or state {:lanes {}})
                            (assoc :t (max at (or (:t state) at)))
                            (update-in [:lanes inlet] (fn [pts] (keep-in (or pts []) at value win))))]
                  {:state s :show s})
                {}))

   ;; ── view ──
   :draw (fn [{:keys [shown args w h]}]
           (let [win (seconds args) n (lanes args) ns (names args)
                 lh (/ (- h 8) n) x0 L x1 (- w 6) pw (- x1 x0)
                 t1 (or (:t shown) 0) t0 (- t1 win)
                 tx (fn [at] (+ x0 (* pw (/ (- at t0) win))))
                 strips (max 1 (count (filter (fn [i] (= :cells (kind (second (peek (get-in shown [:lanes i])))))) (range n))))]
             (into
              [[:rect {:x 2 :y 2 :w (- w 4) :h (- h 4) :r 4 :stroke :grid :fill :bg}]]
              (mapcat
               (fn [i]
                 (let [pts (get-in shown [:lanes i] []) top (+ 4 (* i lh)) bottom (+ top lh -4)
                       last-v (second (peek pts)) k (kind last-v)
                       title (if-let [nm (get ns i)] (name nm) (str "in " i))]
                   (concat
                    [[:text {:x 8 :y (+ top 12) :size 9 :fill :ink} title]
                     (when (some? last-v) [:text {:x 8 :y (+ top 24) :size 8 :fill :soft} (label last-v)])
                     (when (pos? i) [:line {:x1 6 :y1 (- top 2) :x2 x1 :y2 (- top 2) :stroke :grid :weight 1}])]
                    (case k
                      :line
                      (let [ps (filter (fn [[_ v]] (number? v)) pts)
                            vs (map second ps)
                            lo (if (seq vs) (apply min vs) 0) hi (if (seq vs) (apply max vs) 1)
                            [lo hi] (if (< (- hi lo) 1e-9) [(- lo 0.5) (+ hi 0.5)] [lo hi])
                            ty (fn [v] (- bottom (* (- bottom top 2) (/ (- v lo) (- hi lo)))))
                            xys (mapv (fn [[at v]] [(api/clamp (tx at) x0 x1) (ty v)]) ps)]
                        [[:text {:x 8 :y (+ top 35) :size 7 :fill :soft} (str (api/nice lo) "…" (api/nice hi))]
                         (when (> (count xys) 1) [:path {:points xys :stroke :accent :weight 1.4}])
                         (when-let [[x y] (peek xys)] [:circle {:cx x :cy y :r 2.4 :fill :accent :stroke nil}])])
                      :cells
                      (let [ps (filterv (fn [[at v]] (and (>= at t0) (= :cells (kind v)))) pts)
                            rows (reduce max 1 (map (fn [[_ v]] (count v)) ps))
                            cols (max 8 (min 48 (js/Math.floor (/ budget strips rows))))
                            cw (/ pw cols) ch (/ (- bottom top) rows)
                            ;; each column: the mean of what arrived in its slice of time (or the last value before)
                            col-of (fn [at] (api/clamp (js/Math.floor (/ (- at t0) (/ win cols))) 0 (dec cols)))
                            buckets (reduce (fn [m [at v]] (update m (col-of at) (fnil conj []) v)) {} ps)
                            mean (fn [vs] (mapv (fn [j] (/ (reduce + (map (fn [v] (or (get v j) 0)) vs)) (count vs))) (range rows)))
                            cells (into {} (for [[c vs] buckets] [c (mean vs)]))
                            all (mapcat identity (vals cells))
                            lo (if (seq all) (apply min all) 0) hi (if (seq all) (apply max all) 1)
                            span (max 1e-9 (- hi lo))]
                        (for [[c vs] cells [j v] (map-indexed vector vs)
                              :let [u (/ (- v lo) span)] :when (> u 0.05)]
                          [:rect {:x (+ x0 (* c cw)) :y (+ top (* (- rows j 1) ch)) :w (+ cw 0.4) :h (max 0.6 (- ch 0.6))
                                  :fill :accent :stroke nil :opacity (api/clamp u 0 1)}]))
                      :mark
                      (mapcat (fn [[at v]]
                                (let [x (tx at)]
                                  (when (>= x x0)
                                    [[:line {:x1 x :y1 (+ top 2) :x2 x :y2 bottom :stroke :kairos :weight 1.4}]
                                     (when-not (= v :bang) [:text {:x (+ x 3) :y (+ top 12) :size 8 :fill :kairos} (label v)])])))
                              pts)))))
               (range n)))))})
