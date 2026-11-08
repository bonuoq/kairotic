;; SPDX-License-Identifier: MPL-2.0
;; Study 38 · futuribles: the model's tests. Open tests/model.html (served, as the study) to run them.

(ns futuribles-tests
  (:require [kairotic.futuribles :as fu]))

(def results (atom []))
(def notes (atom []))
(defn is [what ok] (swap! results conj [what (boolean ok)]))
(defn note! [s] (swap! notes conj s))

;; pitches and intervals (0 = C4, on the white keys)
(is "C4 G4 is a perfect 5th" (= :perfect (fu/quality 0 4)))
(is "B3 F4 is a diminished 5th, dissonant" (= :dissonant (fu/quality -1 3)))
(is "D4 F4 is a 3rd" (= :imperfect (fu/quality 1 3)))
(is "C4 F4 is a 4th, dissonant" (= :dissonant (fu/quality 0 3)))
(is "C4 C5 is perfect" (= :perfect (fu/quality 0 7)))
(is "F3 is -4, G3 is -3" (= ["F3" "G3"] (map fu/pitch-name [-4 -3])))
(is "F4 up to B4 is a tritone" (some? (fu/melodic-error 3 6)))
(is "E4 up to C5 is a minor 6th, allowed" (nil? (fu/melodic-error 2 7)))
(is "C4 up to A4 is a major 6th, not allowed" (some? (fu/melodic-error 0 5)))
(is "C5 down to E4 is a 6th down, not allowed" (some? (fu/melodic-error 7 2)))
(is "names of compound intervals" (= ["octave" "10th" "12th"] (map fu/interval-name [7 9 11])))

;; the canon: the comes is the dux d notes later, k steps away
(let [p (fu/params :k -7 :d 2)]
  (is "no comes before d" (nil? (fu/comes-at p [1 2 3] 1)))
  (is "the comes at 2 is the dux at 0, an octave down" (= -6 (fu/comes-at p [1 2 3] 2)))
  (is "the voices on one line" (= {:dux [1 2 3 nil nil] :comes [nil nil -6 -5 -4]} (fu/voices p [1 2 3]))))

;; invertible counterpoint as a transform
(let [p (fu/params :k -7 :d 2)
      p10 (assoc p :invert #{10})
      p12 (assoc p :invert #{12})]
  (is "parallel 3rds are fine" (nil? (fu/vertical-error p 3 1 [2 0])))
  (is "parallel 3rds become octaves at the 10th" (re-find #"10th.*parallel octaves" (str (fu/vertical-error p10 3 1 [2 0]))))
  (is "a 6th is fine" (nil? (fu/vertical-error p 5 0 nil)))
  (is "a 6th becomes a 7th at the 12th" (re-find #"12th.*7th" (str (fu/vertical-error p12 5 0 nil))))
  (is "a 3rd stays consonant at the 12th (a 10th)" (nil? (fu/vertical-error p12 2 0 nil)))
  (is "parallel 5ths" (= "parallel 5ths" (fu/vertical-error p 5 1 [4 0])))
  (is "contrary octaves are parallels too" (= "parallel octaves" (fu/vertical-error p 3 3 [7 0])))
  (is "the comes below may not cross above" (= "the voices cross" (fu/vertical-error p 1 3 nil)))
  (is "the inverted canon swaps the voices" (= {:dux [1 2 nil nil] :comes [nil nil 1 2]} (fu/inverted p [1 2] 8))))

;; obligations: a leap is a debt the next note pays
(let [p (fu/params :d 4 :n 12)]
  (is "a 5th up must be recovered by step down" (some? (fu/check p [1 5] 6)))
  (is "a step down pays it" (nil? (fu/check p [1 5] 4)))
  (is "and it is listed as a debt" (re-find #"recover the leap of a 5th" (first (fu/obligations p [1 5])))))

;; the rule set is data: a hard rule turned off lets through what it forbade
(let [p (fu/params :d 4 :n 12)
      off (assoc-in p [:rules :leap-recovery :on] false)]
  (is "with leap recovery off, the leap may continue up" (nil? (fu/check off [1 5] 6))))

;; counting the futures
(let [p (fu/params)                      ; dorian, canon at the octave below, two notes later, 12 notes
      cnt (fu/counter p)
      t0 (js/Date.now)
      total (cnt [])
      ms (- (js/Date.now) t0)]
  (note! (str "dorian canon at the octave below, d = 2, 12 notes: " total " canons (" (.toFixed (fu/bits total) 1) " bits), counted in " ms " ms"))
  (is "there are canons to write" (pos? total))
  (is (str "counted in less than 3 s (" ms " ms)") (< ms 3000))
  (is "a futurible's futures add up to the point's" (= total (reduce + (keep :futures (fu/fan p [] cnt)))))
  (let [dux (fu/continue-dux p [] {:seed 7 :temp 1})]
    (is "the engine finishes the canon" (= (:n p) (count dux)))
    (is "every note it chose is legal" (every? (fn [i] (nil? (fu/check p (subvec dux 0 i) (nth dux i)))) (range (count dux))))
    (is "the same seed gives the same canon" (= dux (fu/continue-dux p [] {:seed 7 :temp 1})))
    (is "ends on the final" (= (fu/tonic p) (mod (peek dux) 7)))
    (let [dv (fu/divergence p dux cnt)]
      (is "the divergence never grows along a line" (every? (fn [[a b]] (>= a b)) (partition 2 1 dv)))
      (is "and ends with one way: the canon itself" (= 1 (peek dv))))
    (note! (str "seed 7: " (apply str (interpose " " (map fu/pitch-name dux))))))
  (is "different seeds, different canons" (< 1 (count (set (map #(fu/continue-dux p [] {:seed % :temp 2}) (range 1 9))))))
  (is "at temperature 0, the cheapest" (= (fu/continue-dux p [] {:seed 1 :temp 0}) (fu/continue-dux p [] {:seed 99 :temp 0}))))

;; guaranteeing inversions narrows the futures
(let [base (fu/params)
      n0 ((fu/counter base) [])
      n8 ((fu/counter (assoc base :invert #{8})) [])
      n12 ((fu/counter (assoc base :invert #{12})) [])]
  (note! (str "invertible at the octave: " n8 " · at the 12th: " n12 " · free: " n0))
  (is "fewer canons when invertible at the octave" (<= n8 n0))
  (is "fewer canons when invertible at the 12th" (<= n12 n0))
  (let [p (assoc base :invert #{12})
        dux (fu/continue-dux p [] {:seed 3 :temp 1})
        {du :dux co :comes} (fu/inverted p dux 12)]
    (when (= (:n p) (count dux))
      (is "inverted at the 12th, every vertical is still consonant"
          (every? (fn [[a b]] (or (nil? a) (nil? b) (not= :dissonant (fu/quality (min a b) (max a b))))) (map vector du co))))))

;; a temperature that follows the divergence
(is "cold when only a few futures are left" (< (fu/temperature 2 true 4) (fu/temperature 2 true 4096)))
(is "as set when it does not follow" (= 2 (fu/temperature 2 false 4)))

;; the history keeps only choices
(let [h (-> (fu/new-history) (fu/choose-note 1 :you) (fu/choose-note 3 :you))
      h2 (-> h fu/back (fu/choose-note 2 :you))
      h3 (-> h2 fu/back (fu/choose-note 3 :you))]
  (is "two choices, two nodes" (= 3 (count (:nodes h))))
  (is "the dux on the path" (= [1 3] (fu/current-dux h)))
  (is "going back and choosing another note is a branch" (and (= 4 (count (:nodes h2))) (= [1 2] (fu/current-dux h2))))
  (is "choosing what was chosen there goes back to it" (and (= 4 (count (:nodes h3))) (= [1 3] (fu/current-dux h3))))
  (is "two leaves" (= 2 (count (fu/leaves h3))))
  (is "forward follows the newest branch" (= [1 2] (fu/current-dux (-> h3 fu/back fu/forward)))))

(let [rs @results bad (remove second rs)]
  (set! (.-kairoticResults js/window) (clj->js {:total (count rs) :failed (mapv first bad)}))
  (let [el (js/document.getElementById "out")]
    (set! (.-textContent el)
          (str (- (count rs) (count bad)) " / " (count rs) " passed\n\n"
               (apply str (for [[w ok] rs] (str (if ok "  ok   " "  FAIL ") w "\n")))
               "\n" (apply str (map #(str "  · " % "\n") @notes))))))
