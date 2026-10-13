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
;;
;; All accept :stroke and :fill with a palette colour, and :weight in pixels.
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
         (when (number? (:weight o)) (str " stroke-width=\"" (n (max 0 (min 24 (:weight o)))) "\"")))))

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

(defn shape [f]
  (if-not (and (vector? f) (keyword? (first f)))
    ""
    (let [[kind o text] f o (if (map? o) o {})]
      (case kind
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
        ""))))

(defn svg
  "The SVG (as text) of a list of shapes."
  [shapes]
  (if (sequential? shapes)
    (apply str (map shape (take max-shapes (remove nil? shapes))))
    ""))

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
