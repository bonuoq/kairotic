;; SPDX-License-Identifier: MPL-2.0
;; Study 47 · heads: the model's tests. Open tests/heads.html.

(ns heads-tests
  (:require [kairotic.heads :as h]))

(def results (atom []))
(defn is [what ok] (swap! results conj [what (boolean ok)]))

(defn run
  "Advances st to time until in steps of 0.05 s; plays (a map {time value}) are played when their time comes, after
   the heads have moved there. Returns [st outs], outs as [time reader-id value]."
  [st until plays]
  (loop [i (inc (js/Math.round (/ (:t st) 0.05))) st st outs []]
    (let [t (* i 0.05)]
      (if (> t (+ until 1e-9))
        [st outs]
        (let [st (h/advance st t)
              outs (into outs (map (fn [[id v]] [t id v]) (:out st)))
              st (reduce (fn [st [at v]] (if (< (js/Math.abs (- at t)) 0.025) (h/play st v) st)) st plays)]
          (recur (inc i) st outs))))))

(def near (fn [a b] (< (js/Math.abs (- a b)) 0.06)))

;; a canon: a reader 1 s behind the writer, at speed 1
(let [st (h/start (h/span 8 true) [(h/writer :w {}) (h/reader :r {:of :w :d 1})])
      [_ outs] (run st 3 {0.2 60 0.7 62})]
  (is "a canon: what is written comes back d later" (and (= [60 62] (mapv #(nth % 2) outs)) (near (ffirst outs) 1.2) (near (first (second outs)) 1.7))))

;; an augmentation: first the distance, then the speed (0.5: it falls behind)
(let [st (h/start (h/span 8 true) [(h/writer :w {}) (h/reader :r {:of :w :d 1 :speed 0.5})])
      [_ outs] (run st 7 {0.2 60 1.2 62 2.2 64})]
  (is "speed 0.5: an augmentation, twice as slow" (and (= [60 62 64] (mapv #(nth % 2) outs))
                                                       (near (first (nth outs 0)) 2.4) (near (first (nth outs 1)) 4.4) (near (first (nth outs 2)) 6.4))))

;; backwards: a reader on its own clock, at speed −1, reads what was written in reverse
(let [st (h/start (h/span 8 false) [(h/writer :w {}) (h/reader :r {:at :clock :p0 8 :speed -1})])
      [_ outs] (run st 8 {1 60 2 62 3 64})]
  (is "speed −1: the notes in reverse order" (= [64 62 60] (mapv #(nth % 2) outs)))
  (is "... when the head meets them (it reaches 3 at 5 s)" (near (ffirst outs) 5)))

;; a hand: a jump is a seek
(let [st (-> (h/start (h/span 8 false) [(h/writer :w {}) (h/reader :r {:at :hand :p 0 :jump 0.5})]))
      [st _] (run st 4 {1 60 2 62 3 64})
      st (h/advance (h/set-head st :r #(assoc % :target 5)) 4.05)
      jumped (:out st)
      st (h/advance (h/set-head st :r #(assoc % :target 3.2)) 4.1)
      jumped2 (:out st)
      st (h/advance (h/set-head st :r #(assoc % :target 2.9)) 4.15)]
  (is "by hand, a jump larger than jump is a seek: nothing of what lies between" (and (empty? jumped) (empty? jumped2)))
  (is "... a small move sends what it crosses" (= [[:r 64]] (:out st))))

;; writing over: :ovr replaces what it passes, :mix leaves it
(let [st (h/start (h/span 4 true) [(h/writer :w {})])
      [st _] (run st 4.6 {0.5 60})]
  (is ":ovr: a writer going round the ring replaces what it passes" (empty? (get-in st [:sp :events]))))
(let [st (h/start (h/span 4 true) [(h/writer :w {:mode :mix})])
      [st _] (run st 4.6 {0.5 60})]
  (is ":mix: it leaves it (an overdub)" (= [60] (mapv :v (get-in st [:sp :events])))))

;; from both ends: two writers, from the start forwards and from the end backwards — a palindrome without rules
(let [st (h/start (h/span 8 false) [(h/writer :a {:mode :mix}) (h/writer :b {:p0 8 :speed -1 :mode :mix})
                                    (h/reader :r {:at :clock :p0 -8 :speed 1})])
      [st outs] (run st 16 {1 60 2 62 3 64})]
  (is "two writers from both ends: what you play is written at both" (= [1 2 3 5 6 7] (mapv #(js/Math.round (:p %)) (get-in st [:sp :events]))))
  (is "... and read forwards it is a palindrome" (= [60 62 64 64 62 60] (mapv #(nth % 2) outs))))

;; several readers on one span: a canon in three voices
(let [st (h/start (h/span 8 true) [(h/writer :w {}) (h/reader :r1 {:of :w :d 1}) (h/reader :r2 {:of :w :d 2})])
      [_ outs] (run st 3 {0.5 60})]
  (is "two readers: a canon in three voices" (and (= [[:r1 60] [:r2 60]] (mapv (fn [[_ id v]] [id v]) outs))
                                                  (near (ffirst outs) 1.5) (near (first (second outs)) 2.5))))

;; a reader whose distance changes: a new distance now, then its speed again
(let [st (h/start (h/span 8 true) [(h/writer :w {}) (h/reader :r {:of :w :d 1 :speed 0.5})])
      [st _] (run st 2 {})
      st (h/set-head st :r #(assoc % :d 0.5))]
  (is "a new d: the drift starts again" (and (= 0 (:drift (h/head st :r))) (near (- 2 0.5) (:p (h/head (h/advance st 2.0001) :r))))))
;; a ring: an event is met again at each turn
(let [st (h/start (h/span 2 true) [(h/writer :w {:mode :mix :listen true}) (h/reader :r {:of :w :d 0.5})])
      [_ outs] (run st 3 {0.2 60})]
  (is "on a ring a reader meets what is kept at every turn" (= [60 60] (mapv #(nth % 2) outs))))
(is "where a head is on the span, wrapped on a ring" (let [st (h/advance (h/start (h/span 2 true) [(h/writer :w {})]) 5.5)] (near (h/at-span st :w) 1.5)))

;; a writer on a signal: a clock moved by a slow wave — what is played evenly is written unevenly
(let [st (h/start (h/span 16 false) [(h/writer :w {:at :signal :depth 0.5 :rate 0.25 :mode :mix})])
      [st _] (run st 3.5 {1 60 2 62 3 64})]
  (is "a writer on a signal: played at 1, 2, 3 s, written at 1.5, 2, 2.5"
      (= [1.5 2 2.5] (mapv #(/ (js/Math.round (* 100 (:p %))) 100) (get-in st [:sp :events])))))

;; a writer's jump: a move larger than it is a seek, which replaces nothing between
(let [sp (-> (h/span 8 false) (h/write-at 2 60) (h/write-at 4 62) (h/write-at 6 64))
      st (h/start sp [(h/writer :w {:at :hand :target 1})])
      st (h/advance (h/set-head st :w #(assoc % :target 1.8)) 0.05)
      after-seek (mapv :v (get-in st [:sp :events]))
      st (h/advance (h/set-head st :w #(assoc % :target 2.1)) 0.1)]
  (is "a writer moved by more than its jump replaces nothing (a seek)" (= [60 62 64] after-seek))
  (is "... moved by less, it replaces what it passes" (= [62 64] (mapv :v (get-in st [:sp :events])))))

;; still: :ovr replaces what was written there before, not what arrives with it
(let [st (h/start (h/span 8 false) [(h/writer :w {:p0 1 :speed 0})])
      st (h/play (h/advance st 1) 60)
      chord (mapv :v (get-in (h/play st 64) [:sp :events]))
      st (h/play (h/advance st 2) 64)]
  (is "a still writer (:ovr): a later note replaces the one where it is" (= [64] (mapv :v (get-in st [:sp :events]))))
  (is "... notes that arrive together stay (a chord)" (= #{60 64} (set chord))))
(let [st (h/start (h/span 8 false) [(h/writer :w {:p0 1 :speed 0 :mode :mix})])
      st (-> st (h/advance 1) (h/play 60) (h/advance 2) (h/play 64))]
  (is "... with :mix both stay (an overdub)" (= #{60 64} (set (map :v (get-in st [:sp :events]))))))

;; feedback: a writer that listens to a reader writes again what it sends — a perpetual canon (a round)
(let [st (h/start (h/span 8 true) [(h/writer :w {:listen #{:in :r}}) (h/reader :r {:of :w :d 2})])
      [st outs] (run st 9 {0.5 60})]
  (is "a writer listening to its reader: what you play comes back every 2 s"
      (and (= [60 60 60 60] (mapv #(nth % 2) outs)) (every? true? (map (fn [[t] w] (near t w)) outs [2.5 4.5 6.5 8.5]))))
  (is "... and the ring keeps one copy for each turn of d (going round, the writer replaces the old ones)"
      (= 4 (count (get-in st [:sp :events])))))
(let [st (h/start (h/span 8 true) [(h/writer :w {}) (h/reader :r {:of :w :d 2})])
      [_ outs] (run st 9 {0.5 60})]
  (is "a writer that listens only to the keys: the note comes back once a turn" (= [60] (mapv #(nth % 2) (filter #(< (first %) 8) outs)))))

;; :rec t and :ovr t: a writer sent to t, at speed 1
(let [st (h/start (h/span 8 false) [(h/writer :w {})])
      [st _] (run st 3 {1 60 2 62})
      rec (h/cue st :w :rec 1.5)
      st (h/cue st :w :ovr 0.5)
      [st _] (run st 4 {})]
  (is ":rec t cuts what is after t" (= [60] (mapv :v (get-in rec [:sp :events]))))
  (is ":ovr t: from t at speed 1 (a second later it is at t + 1)" (near 1.5 (h/at-span st :w)))
  (is "... replacing what it passes, and nothing it jumped over" (= [62] (mapv :v (get-in st [:sp :events])))))

(let [rs @results bad (remove second rs)]
  (set! (.-kairoticResults js/window) (clj->js {:total (count rs) :failed (mapv first bad)}))
  (set! (.-textContent (js/document.getElementById "out"))
        (str (- (count rs) (count bad)) " / " (count rs) " passed\n\n"
             (apply str (for [[w ok] rs] (str (if ok "  ok   " "  FAIL ") w "\n"))))))
