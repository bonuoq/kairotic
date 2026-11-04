;; SPDX-License-Identifier: MPL-2.0
;; Study 36 · talk: the model's tests. Open tests/talk.html (served, as the study) to run them.

(ns talk-tests
  (:require [kairotic.talk :as tk]))

(def results (atom []))
(defn is [what ok] (swap! results conj [what (boolean ok)]))

(def ana {:id "p1" :who "w-ana" :name "Ana"})
(def bo {:id "p2" :who "w-bo" :name "Bo"})

;; anchors
(is "anchors: a box, a point, a beat" (= [{:box "b3"} {:point 12} {:beat 33}] (tk/anchors "@b3 enters at #12, from ^33")))
(is "anchors: a fractional beat, no repeats" (= [{:beat 4.5} {:box "faust~2"}] (tk/anchors "^4.5 ^4.5 then @faust~2")))
(is "anchors: an e-mail or a word#1 is not one" (empty? (tk/anchors "write ana@example.com about take#1")))
(is "anchors: none" (empty? (tk/anchors "just words")))

;; messages
(let [m (tk/message ana "  together from #7  " 1000)]
  (is "message: trimmed, with author, session, name and time" (= ["together from #7" "w-ana" "p1" "Ana" 1000] ((juxt :text :author :peer :name :t) m)))
  (is "message: its anchors" (= [{:point 7}] (:anchors m))))
(is "message: nothing to say, no message" (nil? (tk/message ana "   " 0)))
(is "message: long text is cut" (= 2000 (count (:text (tk/message ana (apply str (repeat 3000 "a")) 0)))))

;; keeping
(let [m (tk/message ana "mine" 0)]
  (is "keep: what is mine, at once" (= [:keep] (tk/keep-step ana m ["p2"])))
  (is "keep: someone else's, ask them" (= [:ask "p1"] (tk/keep-step bo m ["p1"])))
  (is "keep: someone else's who has left, no" (= [:gone] (tk/keep-step bo m [])))
  (let [k (tk/kept m bo 5000)]
    (is "kept: says who made it and who kept it" (= ["w-ana" "Ana" "w-bo" 5000] ((juxt :author :name :kept-by :at) k)))
    (is "kept: only what lasts (no session, no id)" (and (nil? (:peer k)) (nil? (:id k)) (= "mine" (:text k))))))
(is "kept: a note keeps its sound and length"
    (= {:kind :note :author "w-bo" :name "Bo" :kept-by "w-bo" :at 1 :sound "ab12" :dur 2.5}
       (tk/kept {:kind :note :author "w-bo" :name "Bo" :peer "p2" :sound "ab12" :dur 2.5 :blob "x"} bo 1)))

;; pieces
(let [b64 (apply str (repeat 30000 "Q"))
      ps (tk/pieces "h1" b64)
      [st whole] (reduce (fn [[st _] p] (tk/gather st p)) [{} nil] (shuffle ps))]
  (is "pieces: small enough" (every? #(<= (count (:data %)) tk/piece-size) ps))
  (is "pieces: three of them" (= 3 (count ps)))
  (is "gather: in any order, the whole again" (= b64 whole))
  (is "gather: nothing left waiting" (= {} st)))
(let [[st w] (tk/gather {} {:hash "h" :i 0 :n 2 :data "ab"})]
  (is "gather: half is not whole" (and (nil? w) (= {"h" {0 "ab"}} st))))

;; talkers
(is "talkers: me first, then the others who talk"
    (= ["Me" "Ana"] (tk/talkers {"p1" {:talk true :name "Ana"} "p2" {:talk false :name "Bo"}} true "Me")))

;; report
(let [rs @results failed (remove second rs)
      text (str (- (count rs) (count failed)) " / " (count rs) " pass"
                (apply str (map (fn [[w]] (str "\n✗ " w)) failed)))]
  (set! (.-textContent (js/document.getElementById "out")) text)
  (set! (.-kairoticResults js/window) (clj->js {:total (count rs) :failed (mapv first failed)})))
