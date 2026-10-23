;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · shapes
;; A component's own view is described with data, not HTML: a list of shapes in box
;; coordinates (0,0 top left). This way a class written by anyone can be drawn in the patch
;; without being able to inject markup into the page, and it follows its light or dark theme.
;;
;;   [:rect   {:x :y :w :h :r}]
;;   [:circle {:cx :cy :r}]
;;   [:line   {:x1 :y1 :x2 :y2}]
;;   [:arc    {:cx :cy :r :from :to}]             degrees: 0 up, clockwise
;;   [:needle {:cx :cy :r :angle :r0}]            a radial line from radius r0 (default 0) to r at `angle` degrees
;;   [:path   {:points [[x y] …] :closed true}]   a polyline (a waveform, an envelope…)
;;   [:text   {:x :y :anchor :start|:middle|:end :size 11} "text"]
;;   [:curve  {:points [[x y] …]}]                 a smooth path through the points (Catmull–Rom)
;;   [:group  {:x :y :rotate :scale} [shape …]]    shapes moved (x y), turned (degrees, clockwise) and scaled
;;                                                  together; groups can hold groups (4 deep)
;;
;; All accept :stroke and :fill with a palette colour, :weight in pixels and :opacity (0…1).
;; Any shape can also carry :hit k (a keyword or a number): pressing it, the component learns k (in the
;; m of its :gesture, as :hit), so a view can have parts to click: the nodes of a graph, the keys of
;; a scale. The last shape with :hit under the press wins (the one drawn on top).
;; Palette: :ink :soft :accent :kairos :bg :grid (nil = no stroke or no fill).
;; nils in the list are ignored, so you can write (when cond [:text …]).
;;
;; Templates: a component's :view is a list of shapes where any value can be a hole, a keyword
;; that starts with $ (:$angle, :$label). `fill` replaces each hole with the value of the same
;; key (without the $) in a map: the one its :derive returns, merged over the declared args and
;; the box context (:shown :w :h). A hole with no value becomes nil.

(ns kairotic.shapes
  (:require [clojure.string :as str]
            [clojure.walk :as walk]))

(def palette #{:ink :soft :accent :kairos :bg :grid})
(def max-shapes 600)   ; shapes per box

(defn esc [s]
  (-> (str s) (str/replace "&" "&amp;") (str/replace "<" "&lt;") (str/replace ">" "&gt;") (str/replace "\"" "&quot;")))

(defn n
  "A safe number for an SVG attribute (with two decimals)."
  [x]
  (if (and (number? x) (js/isFinite x)) (/ (js/Math.round (* x 100)) 100) 0))

(defn classes [o stroke fill]
  (let [s (if (contains? o :stroke) (:stroke o) stroke)
        f (if (contains? o :fill) (:fill o) fill)]
    (str " class=\"shape" (when (palette s) (str " s-" (name s))) (when (palette f) (str " f-" (name f))) "\""
         (when (number? (:weight o)) (str " stroke-width=\"" (n (max 0 (min 24 (:weight o)))) "\""))
         (when (number? (:opacity o)) (str " opacity=\"" (n (max 0 (min 1 (:opacity o)))) "\"")))))

(defn polar
  "Point at distance r from the centre, with the angle in degrees (0 up, clockwise)."
  [cx cy r a]
  (let [t (* a (/ js/Math.PI 180))]
    [(+ cx (* r (js/Math.sin t))) (- cy (* r (js/Math.cos t)))]))

(defn arc-d [cx cy r from to]
  (let [span (- to from)]
    (when (> (js/Math.abs span) 0.01)
      (if (>= (js/Math.abs span) 359.99)
        (str "M" (n (- cx r)) " " (n cy) "a" (n r) " " (n r) " 0 1 0 " (n (* 2 r)) " 0a" (n r) " " (n r) " 0 1 0 " (n (* -2 r)) " 0")
        (let [[x1 y1] (polar cx cy r from) [x2 y2] (polar cx cy r to)]
          (str "M" (n x1) " " (n y1) "A" (n r) " " (n r) " 0 " (if (> (js/Math.abs span) 180) 1 0) " " (if (pos? span) 1 0)
               " " (n x2) " " (n y2)))))))

(defn curve-d
  "The SVG path of a smooth curve through the points (Catmull–Rom as cubic Béziers)."
  [ps]
  (let [ps (vec ps) c (count ps) P (fn [i] (nth ps (max 0 (min (dec c) i))))]
    (when (>= c 2)
      (str "M" (n (first (P 0))) " " (n (second (P 0)))
           (apply str (for [i (range (dec c))]
                        (let [[x0 y0] (P (dec i)) [x1 y1] (P i) [x2 y2] (P (inc i)) [x3 y3] (P (+ i 2))]
                          (str " C" (n (+ x1 (/ (- x2 x0) 6))) " " (n (+ y1 (/ (- y2 y0) 6)))
                               " " (n (- x2 (/ (- x3 x1) 6))) " " (n (- y2 (/ (- y3 y1) 6)))
                               " " (n x2) " " (n y2)))))))))

(defn points-of [o] (filter (fn [p] (and (sequential? p) (= 2 (count p)))) (take 2000 (:points o))))

(declare shapes-str)

(defn shape
  ([f] (shape f 0))
  ([f depth]
  (if-not (and (vector? f) (keyword? (first f)))
    ""
    (let [[kind o text] f o (if (map? o) o {})]
      (case kind
        :curve (if-let [d (curve-d (points-of o))] (str "<path d=\"" d "\"" (classes o :ink nil) "></path>") "")
        :group (if (or (> depth 3) (not (sequential? text)))
                 ""
                 (str "<g transform=\"translate(" (n (:x o 0)) "," (n (:y o 0)) ") rotate(" (n (:rotate o 0)) ") scale("
                      (n (let [k (:scale o 1)] (if (and (number? k) (pos? k)) (min 20 k) 1))) ")\""
                      (when (number? (:opacity o)) (str " opacity=\"" (n (max 0 (min 1 (:opacity o)))) "\"")) ">"
                      (shapes-str text (inc depth)) "</g>"))
        :rect (str "<rect x=\"" (n (:x o)) "\" y=\"" (n (:y o)) "\" width=\"" (n (max 0 (:w o 0))) "\" height=\"" (n (max 0 (:h o 0)))
                   "\" rx=\"" (n (:r o 0)) "\"" (classes o :ink nil) "></rect>")
        :circle (str "<circle cx=\"" (n (:cx o)) "\" cy=\"" (n (:cy o)) "\" r=\"" (n (max 0 (:r o 0))) "\"" (classes o :ink nil) "></circle>")
        :line (str "<line x1=\"" (n (:x1 o)) "\" y1=\"" (n (:y1 o)) "\" x2=\"" (n (:x2 o)) "\" y2=\"" (n (:y2 o)) "\"" (classes o :ink nil) "></line>")
        :arc (if-let [d (arc-d (n (:cx o)) (n (:cy o)) (n (:r o)) (n (:from o 0)) (n (:to o 360)))]
               (str "<path d=\"" d "\"" (classes o :ink nil) "></path>")
               "")
        :needle (let [cx (n (:cx o)) cy (n (:cy o)) a (n (:angle o 0))
                      [x1 y1] (polar cx cy (n (:r0 o 0)) a)
                      [x2 y2] (polar cx cy (n (:r o 0)) a)]
                  (str "<line x1=\"" (n x1) "\" y1=\"" (n y1) "\" x2=\"" (n x2) "\" y2=\"" (n y2) "\"" (classes o :ink nil) "></line>"))
        :path (let [ps (filter (fn [p] (and (sequential? p) (= 2 (count p)))) (take 2000 (:points o)))]
                (if (< (count ps) 2)
                  ""
                  (str "<" (if (:closed o) "polygon" "polyline") " points=\""
                       (str/join " " (map (fn [[x y]] (str (n x) "," (n y))) ps)) "\"" (classes o :ink nil) "></"
                       (if (:closed o) "polygon" "polyline") ">")))
        :text (str "<text x=\"" (n (:x o)) "\" y=\"" (n (:y o)) "\" text-anchor=\""
                   (case (:anchor o) :middle "middle" :end "end" "start") "\""
                   " font-size=\"" (n (max 7 (min 28 (or (:size o) 11)))) "\"" (classes o nil :ink) ">"
                   (esc (let [s (str text)] (if (> (count s) 80) (subs s 0 80) s))) "</text>")
        "")))))

(defn shapes-str [shapes depth]
  (if (sequential? shapes)
    (apply str (map (fn [f] (shape f depth)) (take max-shapes (remove nil? shapes))))
    ""))

(defn svg
  "The SVG (as text) of a list of shapes."
  [shapes]
  (shapes-str shapes 0))

;; ───────── pressing a shape (:hit) ─────────
;; Where a press lands is worked out from the shapes themselves (the view is drawn above the patch and
;; does not take the pointer), in the coordinates of the box.

(defn- num [x d] (if (and (number? x) (js/isFinite x)) x d))

(defn- seg-dist [[px py] [ax ay] [bx by]]
  (let [dx (- bx ax) dy (- by ay) L2 (+ (* dx dx) (* dy dy))
        u (if (zero? L2) 0 (max 0 (min 1 (/ (+ (* (- px ax) dx) (* (- py ay) dy)) L2))))]
    (js/Math.hypot (- px (+ ax (* u dx))) (- py (+ ay (* u dy))))))

(defn- inside-polygon? [[x y] ps]
  (let [ps (vec ps) c (count ps)]
    (loop [i 0 j (dec c) in false]
      (if (>= i c)
        in
        (let [[xi yi] (nth ps i) [xj yj] (nth ps j)
              cross (and (not= (> yi y) (> yj y))
                         (< x (+ xi (/ (* (- xj xi) (- y yi)) (- yj yi)))))]
          (recur (inc i) i (if cross (not in) in)))))))

(defn covers?
  "Whether shape f (not a group) covers the point [x y] of its own coordinates (strokes within 4 px)."
  [f [x y :as p]]
  (let [[kind o text] f o (if (map? o) o {})]
    (case kind
      :rect (and (<= (num (:x o) 0) x (+ (num (:x o) 0) (num (:w o) 0))) (<= (num (:y o) 0) y (+ (num (:y o) 0) (num (:h o) 0))))
      :circle (<= (js/Math.hypot (- x (num (:cx o) 0)) (- y (num (:cy o) 0))) (max 4 (num (:r o) 0)))
      :arc (let [d (js/Math.hypot (- x (num (:cx o) 0)) (- y (num (:cy o) 0)))] (< (js/Math.abs (- d (num (:r o) 0))) 5))
      :line (< (seg-dist p [(num (:x1 o) 0) (num (:y1 o) 0)] [(num (:x2 o) 0) (num (:y2 o) 0)]) 4)
      :needle (let [cx (num (:cx o) 0) cy (num (:cy o) 0) a (num (:angle o) 0)]
                (< (seg-dist p (polar cx cy (num (:r0 o) 0) a) (polar cx cy (num (:r o) 0) a)) 4))
      (:path :curve) (let [ps (vec (points-of o))]
                       (or (and (:closed o) (> (count ps) 2) (inside-polygon? p ps))
                           (some (fn [[a b]] (< (seg-dist p a b) 4)) (map vector ps (rest ps)))))
      :text (let [sz (max 7 (min 28 (num (:size o) 11))) w (* 0.62 sz (count (str text)))
                  x0 (case (:anchor o) :middle (- (num (:x o) 0) (/ w 2)) :end (- (num (:x o) 0) w) (num (:x o) 0))]
              (and (<= x0 x (+ x0 w)) (<= (- (num (:y o) 0) sz) y (+ (num (:y o) 0) 3))))
      false)))

(defn- into-group
  "The point p of the outside, in the coordinates inside a group (its translate, rotate and scale undone)."
  [o [x y]]
  (let [x (- x (num (:x o) 0)) y (- y (num (:y o) 0))
        t (* (- (num (:rotate o) 0)) (/ js/Math.PI 180))
        k (let [k (:scale o 1)] (if (and (number? k) (pos? k)) k 1))
        xr (- (* x (js/Math.cos t)) (* y (js/Math.sin t)))
        yr (+ (* x (js/Math.sin t)) (* y (js/Math.cos t)))]
    [(/ xr k) (/ yr k)]))

(defn- group-covers?
  "Whether any shape of a group (or of the groups inside it) covers the point."
  [kids p depth]
  (and (sequential? kids) (< depth 4)
       (some (fn [f]
               (when (and (vector? f) (keyword? (first f)))
                 (let [[kind o ks] f o (if (map? o) o {})]
                   (if (= kind :group) (group-covers? ks (into-group o p) (inc depth)) (covers? f p)))))
             (take max-shapes (remove nil? kids)))))

(defn hit-at
  "The :hit of the shape drawn on top at [x y] (box coordinates), or nil. A group with :hit is hit
   wherever one of its shapes is; a :hit inside it, more precise, wins."
  ([shapes p] (hit-at shapes p 0))
  ([shapes p depth]
   (when (sequential? shapes)
     (reduce (fn [found f]
               (if-not (and (vector? f) (keyword? (first f)))
                 found
                 (let [[kind o kids] f o (if (map? o) o {})
                       inner (when (and (= kind :group) (< depth 4)) (hit-at kids (into-group o p) (inc depth)))
                       own (when (and (some? (:hit o)) (not= kind :group) (covers? f p)) (:hit o))
                       g (when (and (= kind :group) (some? (:hit o)) (group-covers? kids (into-group o p) depth)) (:hit o))]
                   (or inner g own found))))
             nil (take max-shapes (remove nil? shapes))))))

(defn dist-to
  "How far the point [x y] is from shape f (not a group): 0 when it covers it."
  [f [x y :as p]]
  (if (covers? f p)
    0
    (let [[kind o text] f o (if (map? o) o {})]
      (case kind
        :rect (let [x0 (num (:x o) 0) y0 (num (:y o) 0) x1 (+ x0 (num (:w o) 0)) y1 (+ y0 (num (:h o) 0))]
                (js/Math.hypot (max (- x0 x) 0 (- x x1)) (max (- y0 y) 0 (- y y1))))
        :circle (max 0 (- (js/Math.hypot (- x (num (:cx o) 0)) (- y (num (:cy o) 0))) (max 4 (num (:r o) 0))))
        :arc (js/Math.abs (- (js/Math.hypot (- x (num (:cx o) 0)) (- y (num (:cy o) 0))) (num (:r o) 0)))
        :line (seg-dist p [(num (:x1 o) 0) (num (:y1 o) 0)] [(num (:x2 o) 0) (num (:y2 o) 0)])
        :needle (let [cx (num (:cx o) 0) cy (num (:cy o) 0) a (num (:angle o) 0)]
                  (seg-dist p (polar cx cy (num (:r0 o) 0) a) (polar cx cy (num (:r o) 0) a)))
        (:path :curve) (let [ps (vec (points-of o))]
                         (if (< (count ps) 2) js/Infinity (apply min (map (fn [[a b]] (seg-dist p a b)) (map vector ps (rest ps))))))
        :text (let [sz (max 7 (min 28 (num (:size o) 11))) w (* 0.62 sz (count (str text)))
                    x0 (case (:anchor o) :middle (- (num (:x o) 0) (/ w 2)) :end (- (num (:x o) 0) w) (num (:x o) 0))
                    y0 (- (num (:y o) 0) sz) y1 (+ (num (:y o) 0) 3)]
                (js/Math.hypot (max (- x0 x) 0 (- x (+ x0 w))) (max (- y0 y) 0 (- y y1))))
        js/Infinity))))

(defn- hit-dists
  "[[hit distance] …] of every shape with :hit (a group with :hit: its nearest shape), in the outside
   coordinates (a scaled group scales its distances)."
  [shapes p depth k]
  (when (and (sequential? shapes) (< depth 5))
    (mapcat (fn [f]
              (when (and (vector? f) (keyword? (first f)))
                (let [[kind o kids] f o (if (map? o) o {})]
                  (if (= kind :group)
                    (let [q (into-group o p)
                          gk (* k (let [s (:scale o 1)] (if (and (number? s) (pos? s)) s 1)))
                          inner (hit-dists kids q (inc depth) gk)]
                      (concat inner
                              (when (some? (:hit o))
                                (let [ds (keep (fn [g] (when (and (vector? g) (keyword? (first g)) (not= :group (first g)))
                                                         (* gk (dist-to g q))))
                                               (take max-shapes (remove nil? kids)))]
                                  (when (seq ds) [[(:hit o) (apply min ds)]])))))
                    (when (some? (:hit o)) [[(:hit o) (* k (dist-to f p))]])))))
            (take max-shapes (remove nil? shapes)))))

(defn hit-near
  "Like hit-at, but forgiving: when no shape with :hit is under [x y], the nearest one within tol px
   (10 by default), so small parts (a node, a key, a point) are easy to press."
  ([shapes p] (hit-near shapes p 10))
  ([shapes p tol]
   (or (hit-at shapes p)
       (let [[h d] (first (sort-by second (hit-dists shapes p 0 1)))]
         (when (and (some? h) (<= d tol)) h)))))

(defn only-hit
  "The shapes that make the part k of a view (those with :hit k, inside their groups), to draw it again
   highlighted; a group with :hit k keeps all its shapes."
  [shapes k]
  (when (sequential? shapes)
    (vec (keep (fn [f]
                 (when (and (vector? f) (keyword? (first f)))
                   (let [[kind o kids] f o (if (map? o) o {})]
                     (cond
                       (= (:hit o) k) f
                       (= kind :group) (let [ks (only-hit kids k)] (when (seq ks) [:group o ks]))
                       :else nil))))
               (take max-shapes (remove nil? shapes))))))

;; ───────── templates ─────────

(defn hole
  "The key a hole stands for (:$angle → :angle), or nil if x is not a hole."
  [x]
  (when (and (keyword? x) (nil? (namespace x)) (str/starts-with? (name x) "$") (> (count (name x)) 1))
    (keyword (subs (name x) 1))))

(defn fill
  "Replaces the holes of a shapes template with the values in `vals`."
  [template vals]
  (walk/postwalk (fn [x] (if-let [k (hole x)] (get vals k) x)) template))
