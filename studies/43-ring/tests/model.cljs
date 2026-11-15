;; SPDX-License-Identifier: MPL-2.0
;; Study 43 · ring: the model's tests. Open tests/model.html.

(ns ring-tests
  (:require [kairotic.ring :as ring]))

(def results (atom []))
(defn is [what ok] (swap! results conj [what (boolean ok)]))

;; time starts at the first message
(let [r (ring/empty-ring 4)]
  (is "an empty ring has no time" (nil? (ring/pos r 10)))
  (let [r (ring/write r 10 60)]
    (is "the first message starts it" (= 0 (ring/pos r 10)))
    (is "and is written at 0" (= [{:t 0 :v 60}] (:events r)))
    (is "time goes on from there" (= 1.5 (ring/pos r 11.5)))))

;; it keeps dur seconds, circular in time
(let [r (reduce (fn [r [t v]] (ring/write r t v)) (ring/empty-ring 2) [[0 60] [1 62] [2 64] [3 65]])]
  (is "what is older than dur is forgotten" (= [62 64 65] (mapv :v (:events r))))
  (is "its window" (= [1 3] (ring/window r 3)))
  (is "a shorter dur forgets at once" (= [64 65] (mapv :v (:events (ring/set-dur r 3 1))))))

;; clear: its time starts again at the next message
(let [r (-> (ring/empty-ring 4) (ring/write 0 1) (ring/write 1 2) ring/clear (ring/write 7 3))]
  (is "clear empties it" (= [{:t 0 :v 3}] (:events r)))
  (is "and the next message is its new 0" (= 7 (:t0 r))))

;; tap: what was there d ago, held, or interpolated between numbers
(let [r (-> (ring/empty-ring 10) (ring/write 0 0) (ring/write 2 10) (ring/write 4 :x))]
  (is "held: the last message at or before" (= 0 (ring/tap r 3 2)))
  (is "... exactly on one" (= 10 (ring/tap r 4 2)))
  (is "interpolated between two numbers" (= 5 (ring/tap r 3 2 true)))
  (is "but not towards a word" (= 10 (ring/tap r 5 2 true)))
  (is "lists of numbers too" (= [5 50] (ring/tap (-> (ring/empty-ring 10) (ring/write 0 [0 0]) (ring/write 2 [10 100])) 3 2 true)))
  (is "before the first message: nothing" (nil? (ring/tap r 1 2)))
  (is "beyond what it keeps: nothing" (nil? (ring/tap (ring/set-dur r 4 3) 4 3.5))))

;; tape: a head that crosses messages, either way; a jump is a seek
(let [r (reduce (fn [r [t v]] (ring/write r t v)) (ring/empty-ring 10) [[0 :a] [1 :b] [2 :c] [3 :d]])]
  (is "forwards: what it passes, in order" (= [:b :c] (mapv :v (ring/crossed r 0.5 2 1.6))))
  (is "a message on the head's start is not sent twice" (= [:c] (mapv :v (ring/crossed r 1 2 1.6))))
  (is "backwards: the latest first" (= [:c :b] (mapv :v (ring/crossed r 2.5 1 1.6))))
  (is "a move larger than jump is a seek: nothing" (empty? (ring/crossed r 0 3 1.6)))
  (is "standing still: nothing" (empty? (ring/crossed r 2 2 1.6)))
  (is "the head is d behind the write head" (= 1.5 (ring/head r 3.5 2))))

;; pipe: the delay a message had when it came in
(is "pipe: out d after it came in" (= 5.5 (ring/pipe-due 3 2.5)))
(is "a negative delay is now" (= 3 (ring/pipe-due 3 -1)))

;; what the page shows
(let [r (-> (ring/empty-ring 4) (ring/write 0 60) (ring/write 0.5 [62 0.8]))]
  (is "the ring as EDN" (= {:dur 4 :events [[0 60] [0.5 [62 0.8]]] :write 1 :read 0.75} (ring/as-edn r 1 0.25))))

(let [rs @results bad (remove second rs)]
  (set! (.-kairoticResults js/window) (clj->js {:total (count rs) :failed (mapv first bad)}))
  (set! (.-textContent (js/document.getElementById "out"))
        (str (- (count rs) (count bad)) " / " (count rs) " passed\n\n"
             (apply str (for [[w ok] rs] (str (if ok "  ok   " "  FAIL ") w "\n"))))))
