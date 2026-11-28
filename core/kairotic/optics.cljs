;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · optics: paths into a musical tree (kairotic.mt), to read a part of it and to change it in place
;; (discussion #380). It grows with what the lenses and the composition need.
;;
;; A path is a vector of steps; each step goes from the nodes reached so far to some of the nodes inside them:
;;   :voices            every voice (the outermost :voice nodes; a tree without them is one voice, itself)
;;   [:voice k]         one voice: its index (0 the first), or its :name
;;   :measures          every measure            [:measures a b]   the measures a to b (from 1, both included)
;;   :notes             every note (in chords too)                 :rests   every rest
;;   :chords            every chord
;;   [:tag :t]          every node of that tag   [:where f]   (or f itself) the outermost nodes for which (f node)
;;   [:nth i]           the i-th child (or the integer i)
;;   [:id x]            the node whose :id is x
;; As in the optics of functional programming (Haskell's lens, Clojure's Specter), what is reached can be read or
;; changed, and changing it leaves everything else as it was:
;;   (view t path)       the nodes reached, in order           (view1 t path)   the first of them
;;   (over t path f)     the tree with each of them as (f node)
;;   (put t path x)      the tree with each of them as x
;; e.g. (over t [[:voice "soprano"] [:measures 3 5]] #(mt/transpose 2 %)) moves those measures of the soprano up a
;; tone, and nothing else. The laws: (view (put t p x) p) is x for every node reached, and (put t p (view1 t p))
;; changes nothing. Paths go through the tree as it is written: a melody written as a string ("c4 e4 g4") is one
;; leaf until it is expanded (mt/expand).

(ns kairotic.optics
  (:require [kairotic.mt :as mt]))

(declare get-in-node)

(defn- children [n] (if (mt/node? n) (mt/kids n) []))

(defn- outermost
  "The paths (relative to n, n itself included) of the outermost nodes inside n for which (ok? node)."
  [n ok?]
  (letfn [(go [x path]
            (cond (not (mt/node? x)) []
                  (ok? x) [path]
                  :else (vec (mapcat (fn [i k] (go k (conj path i))) (range) (children x)))))]
    (go n [])))

(defn- every-inside
  "The paths of every node inside n (n included) for which (ok? node), outer before inner."
  [n ok?]
  (letfn [(go [x path]
            (if-not (mt/node? x)
              []
              (into (if (ok? x) [path] [])
                    (mapcat (fn [i k] (go k (conj path i))) (range) (children x)))))]
    (go n [])))

(defn- tagged? [t] (fn [x] (= t (mt/tag x))))

(defn- voice-paths [n]
  (let [ps (outermost n (tagged? :voice))] (if (seq ps) ps [[]])))

(defn- step-paths
  "The paths, relative to node n, that one step reaches."
  [n s]
  (cond
    (= s :voices) (voice-paths n)
    (= s :measures) (outermost n (tagged? :measure))
    (= s :notes) (every-inside n (tagged? :note))
    (= s :rests) (every-inside n (tagged? :rest))
    (= s :chords) (outermost n (tagged? :chord))
    (integer? s) (if (< -1 s (count (children n))) [[s]] [])
    (fn? s) (outermost n s)
    (and (vector? s) (= :voice (first s)))
    (let [k (second s) ps (voice-paths n)]
      (if (integer? k)
        (if (< -1 k (count ps)) [(nth ps k)] [])
        (let [nm (if (keyword? k) (name k) (str k))]
          (vec (filter (fn [p] (= nm (str (:name (mt/attrs (get-in-node n p)))))) ps)))))
    (and (vector? s) (= :measures (first s)))
    (let [[_ a b] s ps (outermost n (tagged? :measure)) a (or a 1) b (or b a)]
      (vec (keep-indexed (fn [i p] (when (<= a (inc i) b) p)) ps)))
    (and (vector? s) (= :tag (first s))) (outermost n (tagged? (second s)))
    (and (vector? s) (= :where (first s))) (outermost n (second s))
    (and (vector? s) (= :nth (first s))) (step-paths n (second s))
    (and (vector? s) (= :id (first s))) (let [x (second s)] (outermost n (fn [y] (= x (:id (mt/attrs y))))))
    :else (throw (js/Error. (str "optics: not a step of a path: " (pr-str s))))))

(defn get-in-node
  "The node at an index path (child indices from the root), or nil."
  [t path]
  (reduce (fn [n i] (let [ks (children n)] (if (< -1 i (count ks)) (nth ks i) (reduced nil)))) t path))

(defn update-in-node
  "The tree with the node at an index path as (f node)."
  [t path f]
  (if (empty? path)
    (f t)
    (let [i (first path) ks (children t)]
      (if (< -1 i (count ks))
        ;; the node as it was written, an empty attribute map included: only that child changes
        (let [head (if (map? (second t)) 2 1)]
          (with-meta (assoc t (+ head i) (update-in-node (nth ks i) (rest path) f)) (meta t)))
        (throw (js/Error. (str "optics: no node at " (pr-str path))))))))

(defn paths
  "The index paths (child indices from the root) a path reaches in t, in the tree's order."
  [t path]
  (reduce (fn [ps s]
            (vec (distinct (mapcat (fn [p] (map (fn [q] (into p q)) (step-paths (get-in-node t p) s))) ps))))
          [[]] (if (vector? path) path [path])))

(defn view "The nodes a path reaches in t, in order." [t path] (mapv (fn [p] (get-in-node t p)) (paths t path)))
(defn view1 "The first node a path reaches in t, or nil." [t path] (first (view t path)))

(defn over
  "The tree with every node a path reaches as (f node) (the inner ones first, when one holds another)."
  [t path f]
  (reduce (fn [t p] (update-in-node t p f)) t (sort (comp - compare) (paths t path))))

(defn put "The tree with every node a path reaches as x." [t path x] (over t path (constantly x)))

(defn over-attrs
  "The tree with the attributes of every node a path reaches as (f attrs): (over-attrs t [:voices] assoc :clef \"G\")."
  [t path f & args]
  (over t path (fn [n] (apply mt/update-attrs n f args))))
