;; form~ · how alike the moments are: a self-similarity matrix over the last seconds, its changes, its periods
;; Part of @kairotic/analysis. Written against the Kairotic API (api/…): the matrix, novelty and beat spectrum
;; are those of the core (kairotic.structure, issue #120), through api/ssm, api/novelty-at, api/beat-spectrum.
;; What arrives (a chroma, descriptors, an onset envelope) is gathered into one frame every step seconds; each
;; new frame is compared with all those of the window. A segment begins where the frames before are alike
;; among themselves and unlike the ones after (Foote 2000), and the lag at which frames are most alike is the
;; period that repeats (Foote & Uchihashi 2001).
(let [G 20                      ; the matrix drawn: G × G cells at most (the patch draws at most 600 shapes)
      bins 8                    ; a stream of numbers: each frame is the shape of its step, in 8 slices
      settings (fn [args state]
                 (let [o (:set state)
                       seconds (api/clamp (or (:seconds o) (:seconds args) 20) 2 120)
                       step (api/clamp (or (:step o) (:step args) 0.25) 0.02 4)
                       kernel (api/clamp (or (:kernel o) (:kernel args) 2) (* 2 step) (/ seconds 3))]
                   {:seconds seconds :step step :kernel kernel
                    :L (max 1 (js/Math.round (/ kernel step)))
                    :N (max 4 (js/Math.round (/ seconds step)))}))
      frame-of (fn [xs]
                 ;; vectors: their mean; numbers: the values of the step, resampled into bins slices
                 (if (sequential? (first xs))
                   (let [d (reduce max 0 (map count xs))]
                     (mapv (fn [j] (/ (reduce + (map (fn [v] (or (get v j) 0)) xs)) (count xs))) (range d)))
                   (let [v (vec xs) n (count v)]
                     (mapv (fn [j] (let [a (js/Math.floor (/ (* j n) bins)) b (max (inc a) (js/Math.floor (/ (* (inc j) n) bins)))
                                         s (subvec v (min a (dec n)) (min b n))]
                                     (/ (reduce + s) (max 1 (count s)))))
                           (range bins)))))
      usable (fn [v] (cond (number? v) v
                           (and (sequential? v) (seq v) (every? number? v)) (vec v)
                           :else nil))
      ;; the matrix drawn: the mean of each block of frames
      cells (fn [S]
              (let [n (:n S) g (min G n) blk (fn [k] [(js/Math.floor (/ (* k n) g)) (js/Math.floor (/ (* (inc k) n) g))])]
                (vec (for [r (range g)]
                       (let [[a b] (blk r)]
                         (vec (for [c (range g)]
                                (let [[x y] (blk c) cnt (* (- b a) (- y x))]
                                  (/ (reduce + (for [i (range a b) j (range x y)] (api/ssm-at S i j))) (max 1 cnt))))))))))
      mean-sd (fn [xs] (let [n (max 1 (count xs)) m (/ (reduce + xs) n)]
                         [m (js/Math.sqrt (/ (reduce + (map (fn [x] (* (- x m) (- x m))) xs)) n))]))
      r3 (fn [x] (/ (js/Math.round (* 1000 x)) 1000))
      ;; a frame is complete: into the window, and what it tells
      close (fn [state {:keys [N L step kernel]}]
              (let [f (frame-of (:acc state))
                    t (+ (:t0 state) (/ step 2))
                    frames (vec (take-last N (conj (or (:frames state) []) [t f])))
                    S (api/ssm (mapv second frames))
                    n (:n S)
                    i (- n 1 L)
                    nov (when (>= i L) (api/novelty-at S L i))
                    nt (when nov (first (frames i)))
                    hist (if nov (vec (take-last N (conj (or (:nov state) []) [nt (max 0 nov)]))) (or (:nov state) []))
                    ;; a boundary: the novelty of the frame before is a peak, high for this window, and the last
                    ;; boundary is at least two kernels away
                    vs (mapv second hist) k (count vs)
                    [m sd] (mean-sd vs)
                    peak (when (>= k 3)
                           (let [[tp p] (hist (- k 2))]
                             (when (and (> p (vs (- k 3))) (>= p (vs (dec k))) (> p (max 0.05 (+ m sd)))
                                        (or (nil? (:last state)) (>= (- tp (:last state)) (* 2 kernel))))
                               tp)))
                    bs (when (>= n 8) (api/beat-spectrum S (quot n 2)))
                    ;; a period is a lag more alike than the lags before it (a real dip between): music that does
                    ;; not change is alike at every lag, and has none
                    lag (some (fn [[l x]] (when (and (>= l 2) (> (- x (reduce min (subvec bs 1 l))) 0.1)) l))
                              (when bs (api/periods bs)))
                    period (when lag (r3 (* lag step)))
                    s (cond-> (assoc state :frames frames :nov hist
                                     :cells (cells S) :period (or period (:period state)))
                        peak (assoc :last peak :marks (vec (take-last 8 (conj (or (:marks state) []) peak)))))]
                {:state s
                 :out (cond-> []
                        nov (conj [0 (r3 (max 0 nov))])
                        (and period (not= period (:period state))) (conj [2 period])
                        peak (conj [3 [:segment {:t (or (:last state) (first (first frames))) :at peak
                                                 :length (r3 (- peak (or (:last state) (first (first frames)))))
                                                 :period (or period (:period state))}]]
                                   [1 :bang]))}))]
  {;; ── about ──
   :class "form~"
   :license "MPL-2.0"
   :doc "How alike the moments of what arrives are, over the last seconds (20): a self-similarity matrix, drawn, of one frame every step seconds (0.25) — the mean of the lists that arrived in it (a chroma~, a features~ mfcc), or, for a stream of numbers (onset~'s third outlet, an rms), the shape of its values. On the left the novelty of each frame (0…1: how much the music changes there, by a checkerboard of kernel seconds (2) on each side, so it comes kernel seconds late); a bang on the second outlet where a segment begins (a novelty peak high for the window, two kernels after the last at least), and, on the fourth, [:segment {:t :at :length :period}] for the segment it ends; on the third, the period that repeats most in the window, in seconds (the bar, the phrase), when it changes. [:seconds x], [:step x] and [:kernel x] change them, clear forgets. Into onset~ (a [:segment …] makes it forget the usual change of the section before: adaptive onsets), a message box with [:threshold x], or a print. Self-similarity after Foote (1999, 2000, 2001); the same functions for a whole take or a tree are api/ssm, api/novelty, api/boundaries and api/note-frames."
   :usage "form~ [seconds] [step] [kernel]"
   :io [1 4]
   :size [220 128]
   :args [[:seconds 20] [:step 0.25] [:kernel 2]]

   ;; ── logic ──
   ;; the state: {:frames [[t vector] …] :acc [values of the frame under way] :t0 its start :nov [[t value] …]
   ;;             :last the last boundary :marks boundaries :cells the matrix drawn :period :set what messages changed}
   :receive (fn [{:keys [value state args at]}]
              (cond
                (= value :clear) {:state (select-keys state [:set]) :show nil}
                (and (vector? value) (= 2 (count value)) (#{:seconds :step :kernel} (first value)) (number? (second value)))
                (let [s (-> (select-keys state [:set]) (assoc-in [:set (first value)] (second value)))] {:state s :show nil})
                (and (usable value) (number? at))
                (let [o (settings args state)
                      ;; the engine started again (its clock went back), or the kind of what arrives changed: from nothing
                      state (if (or (and (:t0 state) (< at (- (:t0 state) 1)))
                                    (and (seq (:acc state)) (not= (number? (first (:acc state))) (number? (usable value)))))
                              (select-keys state [:set]) state)
                      v (usable value)]
                  ;; a value a step after the frame under way began closes it, and begins the next
                  (if (and (:t0 state) (seq (:acc state)) (>= (- at (:t0 state)) (:step o)))
                    (let [{s :state out :out} (close state o)
                          s (assoc s :acc [v] :t0 at)]
                      (cond-> {:state s :show (select-keys s [:cells :nov :marks :period :frames])}
                        (seq out) (assoc :out out)))
                    {:state (cond-> (update state :acc (fnil conj []) v) (nil? (:t0 state)) (assoc :t0 at))}))
                :else {}))

   ;; ── view: the matrix (time runs down and to the right), the novelty under it, the period ──
   :draw (fn [{:keys [shown args state w h]}]
           (let [{:keys [step kernel seconds]} (settings args state)
                 cs (:cells shown) g (count cs)
                 side (- h 12) x0 6 y0 6 cw (if (pos? g) (/ side g) side)
                 frames (:frames shown)
                 t0 (first (first frames)) t1 (first (peek frames))
                 px0 (+ x0 side 10) px1 (- w 6) pw (- px1 px0)
                 tx (fn [t] (if (and t0 t1 (> t1 t0)) (+ px0 (* pw (/ (- t t0) (- t1 t0)))) px0))
                 ny0 (+ y0 34) ny1 (- h 8)
                 nov (filter (fn [[t]] (and t0 (>= t t0))) (:nov shown))
                 ty (fn [v] (- ny1 (* (- ny1 ny0) (api/clamp v 0 1))))]
             (into
              [[:rect {:x 2 :y 2 :w (- w 4) :h (- h 4) :r 4 :stroke :grid :fill :bg}]
               [:rect {:x x0 :y y0 :w side :h side :stroke :grid :fill :bg}]
               [:text {:x px0 :y (+ y0 10) :size 10 :fill :ink} "form"]
               [:text {:x px0 :y (+ y0 23) :size 8 :fill :soft}
                (if-let [p (:period shown)] (str "period " (api/nice p) " s") (str (api/nice seconds) " s · " (api/nice step) " · " (api/nice kernel)))]
               [:line {:x1 px0 :y1 ny1 :x2 px1 :y2 ny1 :stroke :grid :weight 1}]]
              (concat
               (for [r (range g) c (range g) :let [v ((cs r) c)] :when (> v 0.1)]
                 [:rect {:x (+ x0 (* c cw)) :y (+ y0 (* r cw)) :w (+ cw 0.3) :h (+ cw 0.3)
                         :fill :accent :stroke nil :opacity (api/clamp (* v v) 0 1)}])
               (let [xys (mapv (fn [[t v]] [(api/clamp (tx t) px0 px1) (ty v)]) nov)]
                 (when (> (count xys) 1) [[:path {:points xys :stroke :accent :weight 1.2}]]))
               (for [t (:marks shown) :when (and t0 (>= t t0))]
                 [:line {:x1 (tx t) :y1 ny0 :x2 (tx t) :y2 ny1 :stroke :kairos :weight 1.2}])))))})
