;; SPDX-License-Identifier: MPL-2.0
;; Study 46 · crab live: the game's tests (kairotic/live.cljs on Study 43's kernel). Open tests/live.html.

(ns crab-live-tests
  (:require [kairotic.crab-live :as cl]))

(def K (.-kairoticKernel js/window))
(def Mi (.-kairoticMirror js/window))

(def results (atom []))
(defn is [what ok] (swap! results conj [what (boolean ok)]))

(defn crab
  "A crab (or table) canon in dorian: bars of b beats, ending on a strong beat."
  ([bars] (crab bars "crab" -7 2))
  ([bars kind k b]
   (let [D (.-DIATONIC K) m (aget (.-modes D) "dorian") tonic (.-final m) amb (.-ambitus m)]
     ;; the system goes in as the kernel keeps it (its object), beside the rest of the spec as data
     (.mirror Mi (js/Object.assign (clj->js {:tonic tonic :lo (+ tonic (aget amb 0)) :hi (+ tonic (aget amb 1)) :n (inc (* b (dec bars))) :b b
                                             :spacing 11 :starts (mapv #(+ tonic %) (array-seq (.-starts m)))
                                             :transform {:kind kind :k k :axis tonic}})
                                   #js {:system D})))))

(defn play-out
  "Plays a game to the end: the engine chooses for you, or a note at random among those that can close it."
  [g r]
  (loop [g g]
    (case (cl/phase g)
      :choose (recur (if (< (r) 0.5)
                       (cl/auto g)
                       (let [vs (filterv #(and (nil? (:reason %)) (pos? (or (:futures %) 0))) (cl/options g))]
                         (cl/choose g (:note (nth vs (js/Math.floor (* (r) (count vs)))))))))
      :read (recur (cl/read-beat g))
      g)))

(let [o (crab 5)]                                    ; 9 beats: 5 steps, the 5th the middle alone
  (let [g (cl/create o (cl/seeded 1))
        ok (filterv #(and (nil? (:reason %)) (pos? (or (:futures %) 0))) (cl/options g))]
    (is "it starts choosing, at beat 1" (and (= :choose (cl/phase g)) (= 0 (:t g))))
    (is "the notes you may play are those that can close the work (and the others say why not)"
        (and (seq ok) (some :reason (cl/options g))))
    (let [g1 (cl/choose g (:note (first ok))) b (:last g1)]
      (is "your note is written at the start and the engine's at the end" (and (= (:note (first ok)) (get (:M g1) 0)) (some? (get (:M g1) (dec (.-n o))))))
      (is "the engine sounds the end of your line, transposed" (and (= (:engine b) (.T o (get (:M g1) (dec (.-n o))))) (= (:you b) (:note (first ok)))))))
  (let [b (:last (cl/choose (cl/create o (cl/seeded 2)) 99))]
    (is "a note that cannot close the work is taken as the nearest that can, and said" (and (:corrected b) (= 99 (:played b)) (not= 99 (:you b)))))

  ;; whole games: always finished, always a crab
  (let [games (for [seed (range 1 26)] (play-out (cl/create o (cl/seeded seed)) (cl/seeded (+ 3 (* 7 seed)))))
        steps (.-steps o) n (.-n o)]
    (is "25 games, each finished" (every? #(= :done (cl/phase %)) games))
    (is "... each a whole crab under the rules (the kernel accepts it)" (every? #(= 1 (.count o (cl/js-M (:M %) n) steps)) games))
    (is "... the score comes out once, at the middle, the rest of your line"
        (every? (fn [g] (let [with (filter :score (:log g))] (and (= 1 (count with)) (= (dec steps) (:t (first with))) (= (:score (first with)) (cl/rest-score g))))) games))
    (is "... and after it each voice plays the other's past backwards"
        (every? (fn [g] (every? (fn [b] (and (= (:you b) (get (:M g) (:t b))) (= (:engine b) (.T o (get (:M g) (- n 1 (:t b)))))))
                                (filter #(>= (:t %) steps) (:log g))))
                games)))

  (let [g (loop [g (cl/create o (cl/seeded 5))] (if (= :choose (cl/phase g)) (recur (cl/auto g)) g))
        v (cl/voices g) n (.-n o)]
    (is "the voices: the other one is yours backwards" (every? (fn [t] (= (get (:engine v) t) (.T o (get (:you v) (- n 1 t))))) (range n)))
    (is "the score is to be read from the middle on" (and (= (- n (.-steps o)) (count (cl/rest-score g))) (= (.-steps o) (first (first (cl/rest-score g))))))
    (is "no choosing after the middle" (and (nil? (cl/choose g 3)) (nil? (cl/auto g)))))
  (let [g (loop [g (cl/create o (cl/seeded 3))] (if (< (:t g) (dec (.-steps o))) (recur (cl/auto g)) g))
        b (:last (cl/auto g))]
    (is "an odd crab: the middle beat alone, your note against itself transposed"
        (and (= 1 (.-length (aget (.-order o) (dec (.-steps o))))) (= (:engine b) (.T o (:you b)))))))

(let [e (crab 4) g (play-out (cl/create e (cl/seeded 9)) (cl/seeded 11))]
  (is "a shorter crab, 7 beats, finished" (= 1 (.count e (cl/js-M (:M g) (.-n e)) (.-steps e)))))
(let [tb (crab 4 "table" 0 2) g (play-out (cl/create tb (cl/seeded 4)) (cl/seeded 6)) v (cl/voices g) n (.-n tb)]
  (is "a table canon live: the other voice backwards and upside down"
      (and (= 1 (.count tb (cl/js-M (:M g) n) (.-steps tb)))
           (every? (fn [t] (= (get (:engine v) t) (+ (- (* 2 (.-axis tb)) (get (:you v) (- n 1 t))) (.-k tb)))) (range n)))))
(let [t3 (crab 4 "crab" -7 3)]
  ;; 3/2: the crab ends on a strong beat, so strong beats mirror strong beats; 4 bars are 10 beats, a middle of two
  (is "3/2: 10 beats, the middle a pair" (and (= 10 (.-n t3)) (= 2 (.-length (aget (.-order t3) (dec (.-steps t3)))))))
  (is "3/2: 10 games, each a crab the kernel accepts"
      (every? (fn [seed] (let [g (play-out (cl/create t3 (cl/seeded seed)) (cl/seeded (* 13 seed))) v (cl/voices g) n (.-n t3)]
                           (and (= 1 (.count t3 (cl/js-M (:M g) n) (.-steps t3)))
                                (every? (fn [t] (= (get (:engine v) t) (.T t3 (get (:you v) (- n 1 t))))) (range n)))))
              (range 1 11))))
(is "the same seed, the same game" (= (:M (play-out (cl/create (crab 4) (cl/seeded 7)) (cl/seeded 8)))
                                       (:M (play-out (cl/create (crab 4) (cl/seeded 7)) (cl/seeded 8)))))

(let [rs @results bad (remove second rs)]
  (set! (.-kairoticResults js/window) (clj->js {:total (count rs) :failed (mapv first bad)}))
  (set! (.-textContent (js/document.getElementById "out"))
        (str (- (count rs) (count bad)) " / " (count rs) " passed\n\n"
             (apply str (for [[w ok] rs] (str (if ok "  ok   " "  FAIL ") w "\n"))))))
