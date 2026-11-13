;; SPDX-License-Identifier: MPL-2.0
;; Study 39 · meter: the model's tests (the kernel has its own: tests/kernel.html). Open tests/model.html, served.

(ns meter-tests
  (:require [kairotic.canon :as fu]))

(def results (atom []))
(def notes (atom []))
(defn is [what ok] (swap! results conj [what (boolean ok)]))
(defn note! [s] (swap! notes conj s))

;; the canon: second species in 2/2 by default, the comes three beats later (on the other beats)
(let [p (fu/params)]
  (is "2/2 by default" (= 2 (:b p)))
  (is "8 bars: 15 notes, the last bar the final alone" (and (= 15 (:n p)) (= 8 (fu/bars-of p))))
  (is "notes for 6 bars of 3/2" (= 16 (fu/notes-for 3 6)))
  (is "a strong beat starts a bar" (and (fu/strong? p 0) (not (fu/strong? p 1)) (fu/strong? p 2)))
  (is "the comes three beats later" (= (+ 1 (:k p)) (fu/comes-at p [1 2 3 4] 3))))

;; the hard rules come from the kernel, the rule set from here
(let [p (fu/params) cnt (fu/counter p)]
  (is "the kernel counts the canons" (= 445443 (cnt [])))
  (is "a futurible's futures add up to the point's" (= (cnt []) (reduce + (keep :futures (fu/fan p [] cnt)))))
  (is "the start rule, through the kernel" (re-find #"starts on the final" (str (fu/check p [] 2))))
  (is "a rule turned off here is off in the kernel" (nil? (fu/check (fu/without p :start) [] 2)))
  (is "every hard rule on is asked about by why" (= (count (fu/hard-rules-on p)) (count (fu/why p [] 1))))
  (is "strict-direct is off by default" (not (fu/on? p :strict-direct))))

;; the mode: final, tenor and ambitus
(let [hd (fu/params :mode :hypodorian)]
  (is "hypodorian: the final D, the tenor F" (= ["D4" "F4"] (map fu/pitch-name [(fu/tonic hd) (fu/tenor hd)])))
  (is "a plagal ambitus: from the 4th below to the 5th above, a step of licence" (= [-3 6] (fu/lo-hi hd)))
  (is "it may start on the 4th below" (some #{-2} (fu/start-notes hd)))
  (is "the tenor costs less, on a strong beat more" (< (:modal (fu/cost-parts hd [1 2] 3)) (:modal (fu/cost-parts hd [1] 3)) 0)))

;; dissonance: never on a strong beat; on a weak one it passes, and it costs less
(let [p (fu/params) cnt (fu/counter p)
      lines (mapv #(fu/continue-dux p [] {:seed % :temp 1 :follow true :cnt cnt}) (range 1 31))
      finished (filter #(= (:n p) (count %)) lines)
      with-diss (filter (fn [dux] (some some? (fu/roles p dux))) finished)
      moves (mapcat #(map - (rest %) %) finished)]
  (is "the engine finishes every canon" (= (count lines) (count finished)))
  (is "no dissonance on a strong beat"
      (every? (fn [dux] (every? (fn [t] (let [c (fu/comes-at p dux t)]
                                          (or (nil? c) (not (fu/strong? p t)) (not (fu/dissonant? p (nth dux t) c)))))
                                (range (count dux))))
              finished))
  (note! (str (count with-diss) " of " (count finished) " canons by the engine pass through a dissonance · repeated notes "
              (.toFixed (* 100 (/ (count (filter zero? moves)) (count moves))) 1) "%"))
  (is "some pass through a dissonance" (pos? (count with-diss)))
  (when-let [dux (first with-diss)]
    (let [t (first (keep-indexed (fn [i r] (when r i)) (fu/roles p dux)))
          parts (fu/cost-parts p (subvec dux 0 t) (nth dux t))]
      (is "a dissonance that passes costs less" (neg? (:passing parts 0)))
      (is "and the next note owes its way out" (re-find #"leave the dissonance by step" (apply str (fu/obligations p (subvec dux 0 (inc t)))))))))

;; an odd delay puts the comes on the other beats; at the octave, one beat later, no canon at all
(is "the comes one beat later at the octave: no canon" (zero? ((fu/counter (fu/params :d 1)) [])))
(is "first species still works: a note per bar" (pos? ((fu/counter (fu/params :b 1 :d 2 :n 12)) [])))
(is "3/2 too" (pos? ((fu/counter (fu/params :b 3 :d 2 :n (fu/notes-for 3 5))) [])))

;; the history keeps only choices
(let [h (-> (fu/new-history) (fu/choose-note 1 :you) (fu/choose-note 3 :you))
      h2 (-> h fu/back (fu/choose-note 2 :you))]
  (is "a branch" (and (= 4 (count (:nodes h2))) (= [1 2] (fu/current-dux h2)) (= 2 (count (fu/leaves h2))))))

(let [rs @results bad (remove second rs)]
  (set! (.-kairoticResults js/window) (clj->js {:total (count rs) :failed (mapv first bad)}))
  (let [el (js/document.getElementById "out")]
    (set! (.-textContent el)
          (str (- (count rs) (count bad)) " / " (count rs) " passed\n\n"
               (apply str (for [[w ok] rs] (str (if ok "  ok   " "  FAIL ") w "\n")))
               "\n" (apply str (map #(str "  · " % "\n") @notes))))))
