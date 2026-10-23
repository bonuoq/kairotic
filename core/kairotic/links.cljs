;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · links that carry a patch (Study 22)
;; A link (?code=…, ?src=…) and a patch Claude makes (Study 23) carry the patch as code. That code is
;; read as data (EDN: reading evaluates nothing) and only the calls a patch is made of go through, with
;; literal arguments, so a link cannot run code in the page. What goes through is written again and
;; evaluated by the page as gestures.

(ns kairotic.links
  (:require [clojure.string :as str]
            [clojure.edn :as edn]))

(def calls
  "The calls a patch is made of."
  '#{box connect present view resize code stroke axis grid-x grid-y tuning tree! presets! sample! inside layer mark project})

(defn literal?
  "Plain data all the way down: numbers, strings, keywords, booleans, nil, vectors, maps, sets."
  [x]
  (cond (or (symbol? x) (seq? x)) false
        (map? x) (every? (fn [[k v]] (and (literal? k) (literal? v))) x)
        (coll? x) (every? literal? x)
        :else true))

(defn call?
  "Whether a form is a patch call with literal arguments (`inside` holds patch calls)."
  [f]
  (and (seq? f) (contains? calls (first f))
       (if (= 'inside (first f))
         (and (keyword? (second f)) (every? call? (drop 2 f)))
         (every? literal? (rest f)))))

(defn read-code
  "The code of a link, read as data and written again with only the calls a patch is made of. Throws if
   anything else is in it."
  [src]
  (let [forms (edn/read-string (str "[" src "\n]"))
        bad (first (remove call? forms))]
    (when bad
      (throw (js/Error. (str "a link can only make a patch; it cannot run "
                             (let [t (pr-str bad)] (if (> (count t) 60) (str (subs t 0 60) "…") t))))))
    (str/join "\n" (map pr-str forms))))
