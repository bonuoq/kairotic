;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · Study 46 · crab live: the game, pure (no sound, no page), on Study 43's mirror kernel (mirror.mjs).
;;
;; In a crab canon the other voice is your line backwards: at beat t it plays your note n−1−t. Study 43 writes it
;; from both ends to the middle; here that order is played, live:
;;
;;   the first half   you choose your note at beat t among the ones that can still close the work; the engine
;;                    answers at the same beat with its note — which is your note n−1−t, the end of your own line,
;;                    chosen among the ones with a future (the futuribles, counted exactly)
;;   the middle       the whole work is written: the rest of your line (the engine's answers, read backwards) is
;;                    the score you must read, sent out once, as an outlet would
;;   the second half  you read it; the engine plays your first half backwards
;;
;; A note you play that cannot close the work is taken as the nearest that can (between two as near, the one with
;; more futures), and it says so, as the comes box does. With a table canon the other voice is also upside down.
;;
;; A game is a map — {:o kernel :rng f :M [notes, nil where not written] :t beat :log [...] :score nil} — and each
;; move returns the next one, with what sounded at that beat in :last. o is mirror(spec) (the JS kernel); its
;; notes are steps of the system (numbers).

(ns kairotic.crab-live)

(defn leap-cost
  "Study 43's taste: steps and small leaps, a repeated note or a large leap costs more."
  [a b]
  (if (or (nil? a) (nil? b))
    0
    (get {0 1.5 1 0 2 0.3 3 0.6 4 0.7 5 1 7 1} (js/Math.abs (- b a)) 2)))

(defn seeded
  "A random in [0, 1) from a seed (Park–Miller), so a game can be played again."
  [seed]
  (let [s (atom (max 1 (mod seed 2147483647)))]
    (fn [] (swap! s (fn [x] (mod (* x 16807) 2147483647))) (/ (dec @s) 2147483646))))

(defn- cand [c] {:note (.-note c) :reason (.-reason c) :futures (.-futures c)})

(defn- live? [c] (and (nil? (:reason c)) (pos? (or (:futures c) 0))))

(defn pick
  "The candidate with a future of least cost, a little at random."
  [cands cost rng]
  (let [ok (filter live? cands)]
    (when (seq ok) (apply min-key (fn [c] (+ (cost (:note c)) (* 0.9 (rng)))) ok))))

(defn- n-of [g] (.-n (:o g)))
(defn- steps [g] (.-steps (:o g)))

(defn js-M
  "The line as the kernel reads it: an array with holes where nothing is written yet."
  [M n]
  (let [a (js/Array. n)]
    (doseq [[i v] (map-indexed vector M)] (when (some? v) (aset a i v)))
    a))

(defn create
  "A new game on kernel o (mirror(spec) with transform crab or table); rng a function giving [0, 1)."
  ([o] (create o js/Math.random))
  ([o rng] {:o o :rng rng :M (vec (repeat (.-n o) nil)) :t 0 :log [] :score nil :last nil}))

(defn phase [g]
  (let [t (:t g)] (cond (< t (steps g)) :choose (< t (n-of g)) :read :else :done)))

(defn options
  "What you may play now: in the first half each note with its futures (or why it cannot be); then the one written."
  [g]
  (case (phase g)
    :choose (mapv cand (.fan (:o g) (js-M (:M g) (n-of g)) (:t g)))
    :read [{:note (get (:M g) (:t g)) :reason nil :futures 1}]
    []))

(defn nearest
  "The note that will be played for x: x if it can close the work, else the nearest that can (more futures between
   two as near); nil when none can."
  [g x]
  (let [vs (filter live? (options g))]
    (cond (empty? vs) nil
          (some #(= x (:note %)) vs) x
          :else (:note (first (sort-by (juxt #(js/Math.abs (- (:note %) x)) #(- (:futures %))) vs))))))

(defn beat-at
  "What sounds at beat t once it is written: yours and the engine's (the other voice)."
  [g t]
  (let [o (:o g) e (get (:M g) (.source o t))]
    {:t t :you (get (:M g) t) :engine (when (some? e) (.T o e))}))

(defn rest-score
  "The rest of your line from the middle: the score you must read, as [beat note] pairs."
  [g]
  (vec (for [t (range (steps g) (n-of g))] [t (get (:M g) t)])))

(defn- after [g b]
  (let [g (if (and (not= :choose (phase g)) (nil? (:score g))) (assoc g :score (rest-score g)) g)
        b (if (and (:score g) (= (:t b) (dec (steps g)))) (assoc b :score (:score g)) b)]
    (-> g (update :log conj b) (assoc :last b))))

(defn choose
  "You play x at this beat of the first half: your note (or the nearest that can close the work) and the engine's
   answer, written at both ends. At the middle the rest of your line comes out as the score. nil after the middle."
  [g x]
  (when (= :choose (phase g))
    (let [a (nearest g x) o (:o g) t (:t g) n (n-of g)]
      (if (nil? a)
        (assoc g :last {:t t :stuck true})
        (let [pos (vec (aget (.-order o) t))
              M1 (assoc (:M g) (first pos) a)
              M2 (if (= 2 (count pos))
                   ;; the engine's note: the end of your line, among those with a future, joining the note after it
                   (let [q (second pos)
                         cs (mapv cand (.fanSecond o (js-M M1 n) t a))
                         c (pick cs (fn [z] (leap-cost z (get M1 (inc q)))) (:rng g))]
                     (assoc M1 q (:note c)))
                   M1)
              g2 (assoc g :M M2 :t (inc t))]
          (after g2 (assoc (beat-at g2 t) :played x :corrected (not= a x))))))))

(defn auto
  "The engine plays your note for you (on a pulse, when you did not): the most plausible."
  [g]
  (when (= :choose (phase g))
    (if-let [c (pick (options g) (fn [x] (leap-cost (get (:M g) (dec (:t g))) x)) (:rng g))]
      (let [g2 (choose g (:note c))] (assoc-in (update g2 :log (fn [l] (conj (pop l) (assoc (peek l) :auto true)))) [:last :auto] true))
      (assoc g :last {:t (:t g) :stuck true}))))

(defn read-beat
  "A beat of the second half: your note as written (you read it) and the engine's, your first half backwards."
  [g]
  (when (= :read (phase g))
    (let [b (beat-at g (:t g))]
      (-> g (update :t inc) (update :log conj b) (assoc :last b)))))

(defn voices
  "The two voices as written so far (nil where not yet): yours, and the other one."
  [g]
  (let [l (.lines (:o g) (js-M (:M g) (n-of g)))
        clean (fn [arr] (mapv (fn [v] (when-not (undefined? v) v)) (array-seq arr)))]
    {:you (clean (.-D l)) :engine (clean (.-C l))}))

(defn ways
  "The ways to close the work from where the game is (exact; 1 once it is written)."
  [g]
  (if (= :choose (phase g)) (.count (:o g) (js-M (:M g) (n-of g)) (:t g)) 1))
