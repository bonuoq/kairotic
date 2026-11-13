;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · page · boxes that cover each other (issue #166, 2)
;; Where a box is drawn is written in the work, but how big it is is only known once it is drawn: a faust~ grows
;; with the sliders its code compiles to, a score with the notation Verovio draws. So boxes placed by hand (in a
;; help patch, say) can end up under one another.
;;   (overlaps)  the pairs of boxes on screen that cover each other, as they are drawn now
;;   (tidy)      moves boxes down until none covers another, as one event; they keep their order and columns
;;   (layout-settled?)  every box has its size: code boxes compiled, scores drawn (or failed)
;; The help patches are checked in CI (tests/helplayout.mjs): none of their steps has boxes over one another.

(defn box-rects
  "The boxes on screen as {id [x y w h]}, at the size they are drawn."
  []
  (into {} (for [[id b] (:boxes (scene-of (current)))
                 :let [[x y] (box-pos id b) [w h] (box-dims id b)]]
             [id [x y w h]])))

(def overlap-margin
  "How much two boxes may share before they cover each other (a line, a port, a pixel of rounding)."
  3)

(defn covers?
  "Do the rectangles [x y w h] a and b share more than a sliver?"
  [[ax ay aw ah] [bx by bw bh]]
  (and (> (- (min (+ ax aw) (+ bx bw)) (max ax bx)) overlap-margin)
       (> (- (min (+ ay ah) (+ by bh)) (max ay by)) overlap-margin)))

(defn overlaps
  "The pairs of boxes on screen that cover each other: [[:b2 :b5] …], each pair in the order of its ids."
  ([] (overlaps (box-rects)))
  ([rects]
   (let [ids (vec (sort-by id-z (keys rects)))]
     (vec (for [i (range (count ids)) j (range (inc i) (count ids))
                :let [a (nth ids i) b (nth ids j)]
                :when (covers? (get rects a) (get rects b))]
            [a b])))))

(defn layout-settled?
  "Has every box on screen its size: its code compiled (or failed), its score drawn (or failed)?"
  []
  (let [p (scene-of (current))]
    (every? (fn [[id b]]
              (case (display-of b)
                :code (let [d (box-def b) src (str (get-in b [:data :source]))]
                        (or (str/blank? src) (not= :compiling (:status (cbox/compiled (:language d) src)))))
                :score (or (= :error @vrv-status) (some? (get @score-cache id)))
                true))
            (:boxes p))))

(defn tidy-moves
  "Where boxes go so that none covers another: from the top, each box that covers one placed before it goes
   down below it (and below anything it then meets), in its own column. {id [x y]} of the boxes that move."
  [rects]
  (let [gap 14
        order (sort-by (fn [id] (let [[x y] (get rects id)] [y x (id-z id)])) (keys rects))]
    (loop [[id & more] order placed {} moves {}]
      (if (nil? id)
        moves
        (let [[x y w h] (get rects id)
              y2 (loop [y y n 0]
                   (let [hit (filter (fn [[_ r]] (covers? [x y w h] r)) placed)]
                     (if (and (seq hit) (< n 200))
                       (recur (+ gap (reduce max (map (fn [[_ [_ ry _ rh]]] (+ ry rh)) hit))) (inc n))
                       y)))]
          (recur more (assoc placed id [x y2 w h]) (if (not= y2 y) (assoc moves id [x (js/Math.round y2)]) moves)))))))

(defn tidy
  "Moves boxes down until none covers another, as they are drawn now (a faust~ with its sliders, a score with its
   notation): (tidy). One event of the history; returns the boxes moved."
  []
  (when @pres-mode (fail "In presentation the boxes are where the performer sees them: (tidy) works on the patch"))
  (let [moves (tidy-moves (box-rects))]
    (dispatch-all! (for [[id [x y]] (sort-by key moves)] [:move id x y]))
    (vec (sort-by id-z (keys moves)))))
