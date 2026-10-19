;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · release (issue #45)
;; A release is a compact history: one point per keyframe, each written as the changes from the one before,
;; ending at the work as it is. Forgetting points of a history squashes them the same way. Both need the
;; changes that turn one patch into another, as events of the history: patch-diff. And presets that
;; travel with the patch (in its EDN, in links and embeds) keep only what changes between their keyframes:
;; stored-presets.
;;
;; Pure: the page reads and writes the history (app/page/16-release.cljs).

(ns kairotic.release
  (:require [clojure.string :as str]))

;; ───────── the changes from one patch to another ─────────

(def box-keys
  "What a box keeps besides its text and place, and the event that sets each (nil removes it)."
  [:present :view :size :recipe])

(defn- set-ev [k id v]
  (case k
    :present (if v (into [:present id] v) [:present id nil])
    :view [:view id v]
    :size (if v (into [:size id] v) [:size id nil])
    :recipe [:recipe id v]))

(defn patch-diff
  "The events that turn patch p into patch q (top level; a sub-patch that changed is written whole, as the
   data of its box). Applying them in order, with the step of the history, gives q."
  [p q]
  (let [pb (:boxes p) qb (:boxes q)
        gone (sort (remove (fn [id] (contains? qb id)) (keys pb)))
        lines-p (set (:lines p)) lines-q (set (:lines q))
        ;; lines that a deleted box takes with it are not disconnected again
        alive? (fn [[a _ b _]] (and (contains? qb a) (contains? qb b)))
        ;; the order of lines is the order messages fan out in: kept as it is in q
        kept (filter (fn [l] (and (contains? lines-q l) (alive? l))) (:lines p))
        in-order? (= (vec (concat kept (remove lines-p (:lines q)))) (vec (:lines q)))
        old-lines (if in-order? (remove lines-q (:lines p)) (:lines p))
        new-lines (if in-order? (remove lines-p (:lines q)) (:lines q))]
    (vec
     (concat
      (for [id gone] [:delete id])
      (mapcat
       (fn [[id b]]
         (let [a (get pb id)
               new? (or (nil? a) (not (contains? pb id)))]
           (concat
            (cond new? [[:box id (:text b) (:x b) (:y b)]]
                  :else (concat (when (not= (:text a) (:text b)) [[:text id (:text b)]])
                                (when (or (not= (:x a) (:x b)) (not= (:y a) (:y b))) [[:move id (:x b) (:y b)]])))
            (for [k box-keys :when (not= (get a k) (get b k)) :when (or (not new?) (some? (get b k)))]
              (set-ev k id (get b k)))
            (when (and (not= (:data a) (:data b)) (or (not new?) (some? (:data b))))
              [[:data id (:data b)]]))))
       (sort-by key qb))
      (for [l old-lines :when (alive? l)] (into [:disconnect] l))
      (for [l new-lines] (into [:connect] l))))))

(defn as-event
  "Several events as one event of the history: nothing, the event itself, or a [:batch …]."
  [evs]
  (case (count evs) 0 nil 1 (first evs) [:batch (vec evs)]))

;; ───────── presets that travel with the patch ─────────

(defn stored-presets
  "Keyframes as presets a box can keep in its data: [{:label :kind :texts {id text}}], where :texts holds only
   the boxes whose text is not the same in all of them (with a single keyframe, every box). `kfs` is
   [{:label :kind :config {id text}}]."
  [kfs]
  (let [cfgs (map :config kfs)
        ids (distinct (mapcat keys cfgs))
        changing (if (< (count kfs) 2)
                   (set ids)
                   (set (filter (fn [id] (not (apply = (map (fn [c] (get c id)) cfgs)))) ids)))]
    (vec (for [{:keys [label kind config]} kfs]
           (cond-> {:kind (or kind :snapshot)
                    :texts (into (sorted-map) (filter (fn [[id _]] (changing id)) config))}
             (seq (str label)) (assoc :label (str label)))))))

(defn sane-presets
  "Stored presets as they may arrive from anyone (a link, a room): only labels, kinds and texts."
  [x]
  (if (sequential? x)
    (vec (for [p x :when (and (map? p) (map? (:texts p)))]
           (cond-> {:kind (if (keyword? (:kind p)) (:kind p) :snapshot)
                    :texts (into (sorted-map) (for [[k v] (:texts p) :when (and (keyword? k) (string? v))] [k v]))}
             (string? (:label p)) (assoc :label (:label p)))))
    []))
