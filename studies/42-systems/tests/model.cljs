;; SPDX-License-Identifier: MPL-2.0
;; Study 42 · systems: the model's tests (the kernel has its own: tests/kernel.html). Open tests/model.html.

(ns systems-tests
  (:require [kairotic.canon :as fu] [clojure.edn :as edn]))

(def results (atom []))
(def notes (atom []))
(defn is [what ok] (swap! results conj [what (boolean ok)]))
(defn note! [s] (swap! notes conj s))

;; the defaults: fourth species, the comes half a bar later, near the canon
(let [p (fu/params) cnt (fu/counter p)]
  (is "fourth species by default: syncopation on, 2/2, the comes a beat later" (and (fu/on? p :syncopation) (= 2 (:b p)) (= 1 (:d p)) (= 15 (:n p))))
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
      ;; the comes, above, holds B4 (6) over the strong beat while the dux moves from G4 to C4: a 7th held above
      D [4 4] C [nil 6]
      parts (fu/vertical-parts (assoc p :k 7) D C 0 6)]
  (note! (str "a 7th held above: " (pr-str parts)))
  (is "a suspension costs less (:suspension-life)" (neg? (:suspension-life parts 0))))

;; the engine writes both voices: the dux a cantus firmus, the comes syncopated
(doseq [s [1 0.8 0.3]]
  (let [p (fu/params :imitation s) cnt (fu/counter p)
        works (mapv #(fu/continue-work p [] [] {:seed % :temp 1 :follow true :cnt cnt}) (range 1 7))
        done (filter #(= (:n p) (count (first %))) works)
        sus (fn [[D C]] (count (filter some? (map #(when (and % (some #{"suspension"} [(:dux %) (:comes %)])) %) (fu/roles p D C)))))]
    (note! (str "imitation " s ": " (count done) " of 6 finished · suspensions " (apply str (interpose " " (map sus done)))))
    (is (str "imitation " s ": the engine finishes every work") (= (count works) (count done)))
    (is (str "imitation " s ": the dux a note a bar")
        (every? (fn [[D]] (every? (fn [t] (or (zero? t) (= (fu/strong? p t) (not= (get D t) (get D (dec t)))))) (range (count D)))) done))
    (is (str "imitation " s ": the comes holds its note over the strong beats")
        (every? (fn [[_ C]] (every? (fn [t] (or (<= t (:d p)) (= t (dec (:n p))) (not (fu/strong? p t)) (= (get C t) (get C (dec t))))) (range (count C)))) done))))

;; systems, as EDN
(is "four systems" (= #{:diatonic :meantone :septimal31 :pentatonic} (set (keys fu/systems))))
(let [p (fu/params)]
  (is "the diatonic system by default" (= (:diatonic fu/systems) (fu/sysdef p)))
  (doseq [k [:diatonic :septimal31 :pentatonic]]
    (let [sd (get fu/systems k)]
      (is (str (name k) ": written and read again as EDN, the same") (= sd (edn/read-string (fu/pretty-system sd)))))))
(let [p (fu/with-system (fu/params) (:pentatonic fu/systems)) cnt (fu/counter p)]
  (note! (str "pentatonic, " (name (fu/mode-name p)) ": " (cnt [] []) " works · the comes " (:k p) " steps"))
  (is "pentatonic: five steps a period, the comes a period below, its first mode" (and (= 5 (fu/period-steps p)) (= -5 (:k p)) (= :penta-C (fu/mode-name p))))
  (is "pentatonic: works" (pos? (cnt [] [])))
  (is "pentatonic: the pitches named by the system" (= ["C4" "G4" "C5"] (mapv fu/pitch-name [0 3 5])))
  (is "pentatonic: a 5th up is a perfect consonance, D–G a dissonance" (and (= :perfect (fu/quality 0 3)) (= :dissonant (fu/quality 1 3))))
  (is "pentatonic: the engine finishes a work" (= (:n p) (count (first (fu/continue-work p [] [] {:seed 3 :temp 0.5 :cnt cnt})))))
  (is "the canon at the 5th: three steps" (= 3 (fu/fifth-steps p))))
(let [p (fu/with-system (fu/params) (:septimal31 fu/systems)) cnt (fu/counter p)]
  (is "septimal: works" (pos? (cnt [] [])))
  (is "septimal: C and B♭⁷, an imperfect consonance; its MIDI between A and B♭" (and (= :imperfect (fu/quality 0 6)) (< 69 (- (fu/midi 6) 0) 70))))
;; an edited system: the 6ths made dissonant, fewer works
(let [p (fu/params)
      sd (assoc-in (:diatonic fu/systems) [:vertical 5] :dissonant)
      q (fu/with-system p (assoc sd :name "no 6ths"))]
  (is "an edited system: the 6ths dissonant, fewer works" (< ((fu/counter (assoc q :mode :dorian)) [] []) ((fu/counter p) [] []))))

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
