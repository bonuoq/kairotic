;; SPDX-License-Identifier: MPL-2.0
;; Study 41 · suspensions: the model's tests (the kernel has its own: tests/kernel.html). Open tests/model.html.

(ns suspensions-tests
  (:require [kairotic.canon :as fu]))

(def results (atom []))
(def notes (atom []))
(defn is [what ok] (swap! results conj [what (boolean ok)]))
(defn note! [s] (swap! notes conj s))

;; the defaults: fourth species, after a rest, near the canon
(let [p (fu/params) cnt (fu/counter p)]
  (is "fourth species by default: syncopation on, 2/2, after a rest" (and (fu/on? p :syncopation) (= 2 (:b p)) (= 1 (:phase p)) (= 14 (:n p))))
  (is "a degree of 0.8" (= 0.8 (:imitation p)))
  (is "the kernel counts the works over pairs" (= (cnt [] []) (reduce + (keep :futures (fu/fan p [] [] cnt)))))
  (is "fourth species off: second species with ties, more works"
      (> ((fu/counter (fu/without p :syncopation)) [] []) (cnt [] []))))

;; a note held costs a tie, and the line's costs look at the notes struck
(let [p (fu/params)]
  (is "a note held costs a tie" (contains? (fu/melodic-parts p [1 3] 3 2 true) :tie))
  (is "and nothing for a repeated note" (not (contains? (fu/melodic-parts p [1 3] 3 2 true) :repeat)))
  (is "after a note held, a return to the note before counts as on the notes struck"
      (contains? (fu/melodic-parts p [1 3 3] 1 3 false) :return)))

;; a suspension costs less
(let [p (fu/params :imitation 0)
      ;; the dux holds A4 (5) over the strong beat (after the rest) while the comes moves from A3 to B3: a 7th held above
      D [5] C [-2]
      parts (fu/vertical-parts p D C 5 -1)]
  (note! (str "a 7th held above: " (pr-str parts)))
  (is "a suspension costs less (:suspension-life)" (neg? (:suspension-life parts 0))))

;; the engine writes both voices, the dux syncopated
(doseq [s [1 0.8 0.3]]
  (let [p (fu/params :imitation s) cnt (fu/counter p)
        works (mapv #(fu/continue-work p [] [] {:seed % :temp 1 :follow true :cnt cnt}) (range 1 7))
        done (filter #(= (:n p) (count (first %))) works)
        sus (fn [[D C]] (count (filter some? (map #(when (and % (some #{"suspension"} [(:dux %) (:comes %)])) %) (fu/roles p D C)))))]
    (note! (str "imitation " s ": " (count done) " of 6 finished · suspensions " (apply str (interpose " " (map sus done)))))
    (is (str "imitation " s ": the engine finishes every work") (= (count works) (count done)))
    (is (str "imitation " s ": the dux holds its note over every strong beat")
        (every? (fn [[D]] (every? (fn [t] (or (zero? t) (= t (dec (:n p))) (not (fu/strong? p t)) (= (get D t) (get D (dec t))))) (range (count D)))) done))))

;; the history keeps pairs; another comes is a branch (as in Study 40)
(let [h (-> (fu/new-history) (fu/choose-pair 1 nil :you :engine) (fu/choose-pair 1 nil :you :engine))
      h2 (fu/change-comes h 4)]
  (is "a note held is a choice like any other" (= [1 1] (fu/current-dux h)))
  (is "another comes for the last pair is a branch" (and (= [nil 4] (fu/current-comes h2)) (= 2 (count (fu/leaves h2))))))

(let [rs @results bad (remove second rs)]
  (set! (.-kairoticResults js/window) (clj->js {:total (count rs) :failed (mapv first bad)}))
  (let [el (js/document.getElementById "out")]
    (set! (.-textContent el)
          (str (- (count rs) (count bad)) " / " (count rs) " passed\n\n"
               (apply str (for [[w ok] rs] (str (if ok "  ok   " "  FAIL ") w "\n")))
               "\n" (apply str (map #(str "  · " % "\n") @notes))))))
