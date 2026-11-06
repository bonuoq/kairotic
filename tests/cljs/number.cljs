;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · number: it keeps its value in its text, like a knob
(ns kairotic.test.number
  (:require [kairotic.components :as comp]
            [kairotic.presets :as pst]
            [kairotic.test :as t]))

(defn recv [text m]
  (let [d (comp/lookup "number")]
    ((:receive d) (merge {:args (comp/args-for d text)} m))))

(t/run! "number"
  (fn []
    (t/eq "it starts from the number in its text" (:out (recv "number 440" {:value :bang})) [[0 440]])
    (t/eq "... or 0" (:out (recv "number" {:value :bang})) [[0 0]])
    (t/eq "a number sets it and sends it on" (select-keys (recv "number 440" {:value 3}) [:state :out]) {:state 3 :out [[0 3]]})
    (t/eq "it still reads raw arguments" (:out ((:receive (comp/lookup "number")) {:args [7] :value :bang})) [[0 7]])
    (let [d (comp/lookup "number")]
      (t/eq "let go, its value is written in its text" (comp/args-text d "number" (merge (comp/args-for d "number 2") ((:persist d) 523.25))) "number 523.25")
      (t/eq "... 0 as the bare class" (comp/args-text d "number" ((:persist d) 0)) "number"))
    (t/eq "it is a control for presets (they morph it)" (:v (pst/control "number 440")) 440)
    (t/eq "... whose text a preset writes" (pst/control-text "number 440" 220) "number 220")))
