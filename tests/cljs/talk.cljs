;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · tests · talk: what is said in a room (anchors, keeping and asking, pieces) and its clock (#135)
(ns kairotic.test.talk
  (:require [kairotic.talk :as tk]
            [kairotic.test :as t]))

(def ana {:id "p1" :who "w-ana" :name "Ana"})
(def bo {:id "p2" :who "w-bo" :name "Bo"})

(t/run! "talk"
  (fn []
    (t/eq "the rooms of a relay: wss://host/gun → wss://host/signal"
          [(tk/signal-url "wss://kairotic-relay.onrender.com/gun") (tk/signal-url "ws://localhost:8765/gun") (tk/signal-url "nope")]
          ["wss://kairotic-relay.onrender.com/signal" "ws://localhost:8765/signal" nil])
    (t/eq "anchors: a box, a point of the history, a beat" (tk/anchors "@b3 enters at #12, from ^33") [{:box "b3"} {:point 12} {:beat 33}])
    (t/is "... not an e-mail nor a word#1" (empty? (tk/anchors "ana@example.com about take#1")))
    (let [m (tk/message ana "  together from #7  " 1000)]
      (t/eq "a message: trimmed, who, session, name, time, anchors" ((juxt :text :author :peer :name :t :anchors) m)
            ["together from #7" "w-ana" "p1" "Ana" 1000 [{:point 7}]])
      (t/eq "keeping what is yours: at once" (tk/keep-step ana m ["p2"]) [:keep])
      (t/eq "someone else's: ask them" (tk/keep-step bo m ["p1"]) [:ask "p1"])
      (t/eq "someone else's who has left: no" (tk/keep-step bo m []) [:gone]))
    (t/is "nothing to say, no message" (nil? (tk/message ana "   " 0)))
    (let [b64 (apply str (repeat 30000 "Q")) ps (tk/pieces "h1" b64)
          [st whole] (reduce (fn [[st _] p] (tk/gather st p)) [{} nil] (reverse ps))]
      (t/eq "pieces, gathered in any order" [(count ps) (= b64 whole) st] [3 true {}]))
    (let [c (reduce (fn [c [t0 ts t1]] (tk/clock-sample c t0 ts t1)) (tk/new-clock)
                    [[0 510 20] [100 700 180] [200 706 212] [300 830 360] [400 905 410] [500 1000 620]])]
      (t/eq "the clock: offset from the shortest trips, error half of one" [(tk/clock-offset c) (tk/clock-error c)] [500 5])
      (t/eq "... shared time" (tk/shared-time c 1000) 1500))
    (t/is "no clock before a sample" (nil? (tk/shared-time (tk/new-clock) 5)))))
