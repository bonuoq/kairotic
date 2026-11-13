;; SPDX-License-Identifier: MPL-2.0
;; Study 40 · imitation: the model's tests (the kernel has its own: tests/kernel.html). Open tests/model.html.

(ns imitation-tests
  (:require [kairotic.canon :as fu]))

(def results (atom []))
(def notes (atom []))
(defn is [what ok] (swap! results conj [what (boolean ok)]))
(defn note! [s] (swap! notes conj s))

(is "the bands" (= [:canon :near :near :motion :motion :free] (map fu/band [1 0.9 0.5 0.4 0.2 0.1])))

(let [p (fu/params) cnt (fu/counter p)]
  (is "a degree of 0.8 by default" (= 0.8 (:imitation p)))
  (is "where a canon would put the comes" (= (+ 1 (:k p)) (fu/model-note p [1 2 3 4] 3)))
  (is "the kernel counts the works over pairs" (= (cnt [] []) (reduce + (keep :futures (fu/fan p [] [] cnt)))))
  (is "near the canon: a step away costs" (pos? (fu/imitation-cost p [1 2 3] [nil nil nil] (+ 2 (:k p)))))
  (is "on the canon's note it costs nothing" (zero? (fu/imitation-cost p [1 2 3] [nil nil nil] (+ 1 (:k p)))))
  (is "nearer to 1, a step away costs more"
      (< (fu/imitation-cost (assoc p :imitation 0.5) [1 2 3] [nil nil nil] (+ 2 (:k p)))
         (fu/imitation-cost (assoc p :imitation 0.9) [1 2 3] [nil nil nil] (+ 2 (:k p)))))
  (let [q (assoc p :imitation 0.3) D [1 3 2 4] C [nil nil nil -6]]
    (is "imitating the motion: going the other way costs" (> (fu/imitation-cost q D C -7) (fu/imitation-cost q D C -5))))
  (is "free: no imitation at all" (zero? (fu/imitation-cost (assoc p :imitation 0) [1 2 3] [nil nil nil] 5)))
  (is "the comes's own line has its costs, as comes/…"
      (some #(= "comes" (namespace %)) (keys (fu/pair-parts p [1 2 3 4 5] [nil nil nil -6 -5] 6 -5)))))

;; the engine writes both voices
(doseq [s [1 0.7 0.3 0]]
  (let [p (fu/params :imitation s) cnt (fu/counter p)
        works (mapv #(fu/continue-work p [] [] {:seed % :temp 1 :follow true :cnt cnt}) (range 1 9))
        done (filter #(= (:n p) (count (first %))) works)
        dev (fn [[D C]] (count (filter (fn [t] (and (get C t) (not= (get C t) (fu/model-note p D t)))) (range (count D)))))]
    (note! (str "imitation " s ": " (count done) " of 8 finished · notes of the comes off the canon: " (apply str (interpose " " (map dev done)))))
    (is (str "imitation " s ": the engine finishes every work") (= (count works) (count done)))
    (case s
      1 (is "at 1 the comes is the canon's" (every? zero? (map dev done)))
      0.7 (is "at 0.7 the comes stays within a 3rd of the canon's notes"
              (every? (fn [[D C]] (every? (fn [t] (or (nil? (get C t)) (<= (fu/absv (- (get C t) (fu/model-note p D t))) 2))) (range (count D)))) done))
      nil)))

;; the history keeps pairs; another comes is a branch
(let [p (fu/params) cnt (fu/counter p)
      h (-> (fu/new-history) (fu/choose-pair 1 nil :you :engine) (fu/choose-pair 3 nil :you :engine))
      h2 (fu/change-comes h 4)]
  (is "pairs on the path" (and (= [1 3] (fu/current-dux h)) (= [nil nil] (fu/current-comes h))))
  (is "another comes for the last pair is a branch, the dux kept"
      (and (= [1 3] (fu/current-dux h2)) (= [nil 4] (fu/current-comes h2)) (= 2 (count (fu/leaves h2)))))
  (is "the change is yours" (= :you (get-in h2 [:nodes (:at h2) :cby]))))

(let [rs @results bad (remove second rs)]
  (set! (.-kairoticResults js/window) (clj->js {:total (count rs) :failed (mapv first bad)}))
  (let [el (js/document.getElementById "out")]
    (set! (.-textContent el)
          (str (- (count rs) (count bad)) " / " (count rs) " passed\n\n"
               (apply str (for [[w ok] rs] (str (if ok "  ok   " "  FAIL ") w "\n")))
               "\n" (apply str (map #(str "  · " % "\n") @notes))))))
