;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · links carry a patch as data, never code (kairotic.links)
(ns kairotic.test.links
  (:require [clojure.string :as str]
            [kairotic.links :as links]
            [kairotic.test :as t]))

(t/run! "links"
  (fn []
    (let [code "(box :b1 \"osc~ 440\" 20 20)\n(connect :b1 0 :b2 0)\n(tree! :b3 [:voice {:name \"m\"} \"c4+e4/1 g4\"])\n(inside :b4 (box :b1 \"inlet\" 0 0))\n(code :b5 \"process = _;\")"]
      (t/eq "patch calls go through, written again"
            (links/read-code code)
            (str/join "\n" ["(box :b1 \"osc~ 440\" 20 20)" "(connect :b1 0 :b2 0)"
                            "(tree! :b3 [:voice {:name \"m\"} \"c4+e4/1 g4\"])"
                            "(inside :b4 (box :b1 \"inlet\" 0 0))" "(code :b5 \"process = _;\")"]))
      (t/is "a + inside a string stays" (str/includes? (links/read-code code) "c4+e4")))
    (t/eq "comments and blank lines are not calls" (links/read-code ";; boxes\n\n(box :b1 \"bang\" 0 0)\n") "(box :b1 \"bang\" 0 0)")
    (t/eq "an empty link is an empty patch" (links/read-code "") "")
    (t/throws "a call that is not a patch call" #(links/read-code "(js/alert 1)"))
    (t/throws "a def" #(links/read-code "(def x 1)"))
    (t/throws "an expression as an argument" #(links/read-code "(box :b1 (str \"osc~\" 440) 0 0)"))
    (t/throws "a symbol as an argument" #(links/read-code "(box :b1 x 0 0)"))
    (t/throws "a call hidden in a vector" #(links/read-code "(tree! :b1 [:voice (js/alert 1)])"))
    (t/throws "a call hidden inside `inside`" #(links/read-code "(inside :b4 (js/alert 1))"))
    (t/is "literal? accepts nested data" (links/literal? {:a [1 "b" #{:c}] :d nil}))
    (t/is "literal? refuses a list" (not (links/literal? [1 '(a)])))))
