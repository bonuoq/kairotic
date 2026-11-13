;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · Study 39 · meter (discussion #172)
;;
;; Study 38's futuribles of a canon, now with a meter and with dissonance. A beat is strong when it starts a bar:
;; first species has one note per bar (every beat strong), second species two (2/2) or three (3/2), a note per
;; beat. On a strong beat every vertical is a consonance; on a weak one a dissonance may pass, if both voices come
;; to it by step and leave it by step — a passing note (going on the same way) or a neighbour (turning back) —
;; and never two in a row. No 5ths or octaves on consecutive strong beats either.
;;
;; The delay of the comes is counted in beats: an odd delay puts the comes on the other beats, so what is strong
;; in the dux is weak in the comes, and the rules hold for the verticals as they sound.
;;
;; The hard rules and the exact count of the futures are in plain JavaScript (kairotic/kernel.mjs, loaded by the
;; page as window.kairoticKernel): with twice the notes and rules that look further back, Scittle took seconds to
;; count. Everything else — the rule set as data, the soft rules, the futuribles, why?, the engine, the history —
;; is here, as in Study 38.
;;
;;   pitch    a diatonic step on the white keys, 0 = C4 (7 = C5, -4 = F3)
;;   params   {:mode :dorian :k -7 :d 3 :b 2 :n 15 :spacing 11 :invert #{} :rules {id {:on bool :weight w}}}
;;            (:range [lo hi] in steps from the final, if set, replaces the mode's ambitus)
;;            :d the delay in beats · :b beats in a bar (1 = first species) · :n notes of the dux, a note per beat
;;   dux      the notes chosen so far, a vector of pitches

(ns kairotic.canon
  (:require [clojure.string :as str]))

(def K "The kernel (kairotic/kernel.mjs)." (.-kairoticKernel js/window))

;; ───────────────────────── pitches and intervals ─────────────────────────

(def scale [0 2 4 5 7 9 11])
(def letter ["C" "D" "E" "F" "G" "A" "B"])
;; the modes on the white keys, authentic and plagal (hypo-): the final, the tenor (the reciting tone) in steps
;; above the final, and the ambitus in steps from the final — authentic from the final to its octave, plagal from
;; the 4th below to the 5th above — with a step of licence beyond each end
(def modes
  {:dorian         {:final 1 :tenor 4 :plagal false} :hypodorian     {:final 1 :tenor 2 :plagal true}
   :ionian         {:final 0 :tenor 4 :plagal false} :hypoionian     {:final 0 :tenor 2 :plagal true}
   :mixolydian     {:final 4 :tenor 4 :plagal false} :hypomixolydian {:final 4 :tenor 3 :plagal true}
   :aeolian        {:final 5 :tenor 4 :plagal false} :hypoaeolian    {:final 5 :tenor 2 :plagal true}})

(defn octave-of [s] (js/Math.floor (/ s 7)))
(defn semis "Semitones above C4." [s] (+ (* 12 (octave-of s)) (nth scale (mod s 7))))
(defn pitch-name [s] (str (nth letter (mod s 7)) (+ 4 (octave-of s))))
(defn midi [s] (+ 60 (semis s)))
(defn absv [x] (if (neg? x) (- x) x))
(defn sign [x] (cond (pos? x) 1 (neg? x) -1 :else 0))

(def interval-names ["unison" "2nd" "3rd" "4th" "5th" "6th" "7th" "octave"])
(defn interval-name
  "The name of a span of s steps (unsigned): 3rd, 5th, octave, 10th…"
  [s]
  (cond (<= s 7) (nth interval-names s)
        :else (let [n (inc s)] (str n (case (mod n 10) 1 (if (= 11 n) "th" "st") 2 (if (= 12 n) "th" "nd") 3 (if (= 13 n) "th" "rd") "th")))))

(defn quality
  "A vertical between two pitches: :perfect (unison, octave, 5th), :imperfect (3rd, 6th) or :dissonant
  (2nd, 4th, 7th, and the diminished 5th / augmented 4th), counted on the real semitones."
  [a b]
  (let [c (mod (absv (- b a)) 7) st (mod (absv (- (semis b) (semis a))) 12)]
    (case c
      0 :perfect
      4 (if (= st 7) :perfect :dissonant)
      2 :imperfect
      5 :imperfect
      :dissonant)))

(defn melodic-error
  "Why the move a → b is not a melodic interval of first species (nil when it is): steps, 3rds, perfect 4ths
  and 5ths, the ascending minor 6th, the octave."
  [a b]
  (let [s (- b a) n (absv s) st (absv (- (semis b) (semis a)))]
    (cond (<= n 2) nil
          (= n 3) (when (not= st 5) "an augmented 4th (tritone)")
          (= n 4) (when (not= st 7) "a diminished 5th (tritone)")
          (= n 5) (when-not (and (pos? s) (= st 8)) "a 6th (only the minor 6th up)")
          (= n 7) nil
          (= n 6) "a 7th"
          :else "a leap wider than the octave")))

;; ───────────────────────── the rule set, as data ─────────────────────────

(def rules
  "Every rule of the style. Hard rules make a candidate illegal (with a reason); soft rules add to its cost.
  :under :all means the rule is also checked under every inversion asked for."
  [{:id :range            :kind :hard :scope :melodic  :doc "The dux stays in its range."}
   {:id :start            :kind :hard :scope :melodic  :doc "The dux starts on the final, its 5th, its octave or the 4th below, as the ambitus allows."}
   {:id :melodic          :kind :hard :scope :melodic  :doc "Melodic intervals of first species, in both voices (the comes transposed)."}
   {:id :leap-recovery    :kind :hard :scope :melodic  :doc "A leap turns back: after a 4th or a 5th the next move goes the other way; after a 6th or an octave, by step."}
   {:id :consonance       :kind :hard :scope :vertical :under :all :doc "Every vertical on a strong beat is a consonance: unison, 3rd, 5th, 6th, octave (in first species, every vertical)."}
   {:id :weak-dissonance  :kind :hard :scope :vertical :under :all :doc "On a weak beat a dissonance may pass: both voices come to it by step and leave it by step (a passing note or a neighbour), never two in a row."}
   {:id :parallels        :kind :hard :scope :vertical :under :all :doc "No parallel 5ths or octaves (nor by contrary motion)."}
   {:id :strong-parallels :kind :hard :scope :vertical :under :all :doc "No 5ths or octaves on consecutive strong beats."}
   {:id :direct-octaves   :kind :hard :scope :vertical :under :all :doc "No octave nor unison reached by direct (similar) motion, unless the upper voice moves by step: the unison is treated as the octave."}
   {:id :strict-direct    :kind :hard :scope :vertical :default false :doc "Strict, after Fux: not even when the upper voice moves by step (off by default)."}
   {:id :entry-unison     :kind :hard :scope :vertical :doc "The comes does not enter on the unison."}
   {:id :no-crossing      :kind :hard :scope :vertical :doc "The voices do not cross (except in a canon at the unison)."}
   {:id :spacing          :kind :hard :scope :vertical :doc "The voices are never further apart than the canon allows (a 12th by default)."}
   {:id :final            :kind :hard :scope :form     :doc "The dux ends on the final, on a perfect consonance."}
   {:id :approach         :kind :hard :scope :form     :doc "The final is approached by step."}
   ;; the contour: leaps are not penalised for being leaps, only compensated; what costs is a line that stays
   ;; still, hovers, runs one way or repeats itself mechanically
   {:id :leap-size        :kind :soft :scope :melodic  :weight 1   :doc "Leaps cost little, only by their size (a 3rd 0.2, a 4th 0.4, a 5th 0.5, a 6th or an octave 0.8)."}
   {:id :repeat           :kind :soft :scope :melodic  :weight 6   :doc "A repeated note."}
   {:id :contrary-after-leap :kind :soft :scope :melodic :weight 1.2 :doc "After a leap, going on the same way (twice as much leaping again): a leap is compensated by contrary motion."}
   {:id :step-back        :kind :soft :scope :melodic  :weight 1.2 :doc "After a 4th or more, turning back by leap rather than by step (filling the gap)."}
   {:id :leap-after-leap  :kind :soft :scope :melodic  :weight 0.6 :doc "Two leaps in a row."}
   {:id :return           :kind :soft :scope :melodic  :weight 1   :doc "Going straight back to the note before (A B A)."}
   {:id :hover            :kind :soft :scope :melodic  :weight 0.6 :doc "A note heard among the last ones, each time: the line moves on."}
   {:id :run              :kind :soft :scope :melodic  :weight 1.5 :doc "More than four moves the same way."}
   {:id :open             :kind :soft :scope :melodic  :weight 1   :doc "Still inside less than a 5th after six notes: the line opens up."}
   {:id :climax           :kind :soft :scope :melodic  :weight 1.5 :doc "Reaching the highest note again (one climax)."}
   {:id :sequence         :kind :soft :scope :melodic  :weight 1.5 :doc "The last two moves again (two thirds of it for the last three): a mechanical sequence."}
   {:id :motion           :kind :soft :scope :vertical :weight 2.5 :doc "Contrary motion preferred: oblique costs half, similar 0.8 of the weight."}
   {:id :modal            :kind :soft :scope :melodic  :weight 1   :doc "The mode's own notes: the final and the tenor cost less (more on a strong beat)."}
   {:id :direct-perfect   :kind :soft :scope :vertical :weight 3   :doc "Similar motion into a 5th (into an octave or a unison it is not allowed)."}
   {:id :imperfect-run    :kind :soft :scope :vertical :weight 2   :doc "More than three parallel 3rds or 6ths in a row."}
   {:id :passing          :kind :soft :scope :vertical :weight 1   :doc "A dissonance passing on a weak beat: the life of second species (it costs less)."}
   {:id :alternation      :kind :soft :scope :vertical :weight 1.5 :doc "The same vertical as two notes before but not as the last (3 6 3 6 …)."}
   {:id :memory           :kind :soft :scope :memory   :weight 1   :doc "Memory of the work: a figure of two moves it used earlier (not just before) costs less."}
   {:id :novelty          :kind :soft :scope :memory   :weight 0.3 :doc "Novelty: the same move as the last one costs a little more."}])

(def rule-by-id (into {} (map (juxt :id identity)) rules))

(defn default-rules [] (into {} (map (fn [r] [(:id r) (if (= :hard (:kind r)) {:on (:default r true)} {:weight (:weight r)})])) rules))

(def default-params
  {:mode :dorian :k -7 :d 3 :b 2 :n 15 :spacing 11 :invert #{} :rules (default-rules)})

(defn notes-for "The notes of the dux for a number of bars: the last bar holds the final alone." [b bars] (inc (* b (dec bars))))
(defn bars-of [p] (inc (quot (dec (:n p)) (:b p 1))))
(defn strong? [p t] (zero? (mod t (:b p 1))))

(defn params [& {:as overrides}] (merge default-params {:rules (default-rules)} overrides))

(defn on? [p id] (get-in p [:rules id :on] (:default (rule-by-id id) true)))
(defn weight [p id] (get-in p [:rules id :weight] (:weight (rule-by-id id) 0)))

(defn mode-of [p] (get modes (:mode p) (:dorian modes)))
(defn tonic "The final of the mode." [p] (:final (mode-of p)))
(defn tenor "The tenor of the mode (its reciting tone), in the octave of the final." [p] (+ (tonic p) (:tenor (mode-of p))))
(defn plagal? [p] (:plagal (mode-of p)))
(defn ambitus "The range of the dux in steps from the final: the mode's, unless the canon sets its own :range." [p]
  (or (:range p) (if (plagal? p) [-4 5] [-1 8])))
(defn start-notes "Where the dux may start: the final, its 5th, its octave, the 4th below, inside the ambitus." [p]
  (let [t (tonic p) [a b] (ambitus p)] (filterv #(<= (+ t a) % (+ t b)) [t (+ t 4) (+ t 7) (- t 3)])))
(defn lo-hi [p] (let [[a b] (ambitus p) t (tonic p)] [(+ t a) (+ t b)]))
(defn finals "The final in every octave of the range." [p]
  (let [[lo hi] (lo-hi p) t (tonic p)] (filter #(<= lo % hi) (map #(+ t (* 7 %)) (range -2 3)))))

;; ───────────────────────── voices and transforms ─────────────────────────

(defn comes-at "The comes at time t, or nil before it enters (and after the dux written so far)." [p dux t]
  (let [i (- t (:d p))] (when (and (>= i 0) (< i (count dux))) (+ (nth dux i) (:k p)))))

(defn lower-first
  "A vertical [dux comes] as [lower upper] by voice: the comes is the lower voice when it is shifted down
  (or at the unison), the upper one when it is shifted up."
  [p dux-note comes-note]
  (if (pos? (:k p)) [dux-note comes-note] [comes-note dux-note]))

(defn transforms "The original and every inversion asked for, as [name f] with f: [lo hi] → [lo hi]." [p]
  (into [[:orig identity]]
        (map (fn [n] [[:invert n] (fn [[lo hi]] [hi (+ lo (dec n))])]))
        (sort (:invert p))))

(defn transform-label [t] (if (= t :orig) "" (str "under inversion at the " (interval-name (dec (second t))) ": ")))

(defn voices
  "Both voices of the canon written so far, on one time line: {:dux [..] :comes [nil nil ..]} (the comes
  enters at d and finishes d notes after the dux)."
  [p dux]
  (let [d (:d p) len (+ (count dux) (if (seq dux) d 0))]
    {:dux (vec (concat dux (repeat (- len (count dux)) nil)))
     :comes (vec (concat (repeat (min d len) nil) (map #(+ % (:k p)) dux)))}))

(defn inverted
  "The canon under inversion at N: the lower voice taken up N-1 steps, so it sounds above."
  [p dux n]
  (let [{du :dux co :comes} (voices p dux)
        up (fn [x] (when x (+ x (dec n))))]
    (if (pos? (:k p)) {:dux (mapv up du) :comes co} {:dux du :comes (mapv up co)})))

;; ───────────────────────── hard rules: the kernel ─────────────────────────

(defn spec "The canon as the kernel reads it." [p]
  (let [[lo hi] (lo-hi p)]
    #js {:tonic (tonic p) :k (:k p) :d (:d p) :b (:b p 1) :n (:n p) :lo lo :hi hi :spacing (:spacing p 11)
         :invert (clj->js (vec (sort (:invert p)))) :starts (clj->js (start-notes p))
         :on (clj->js (into {} (for [r rules :when (= :hard (:kind r))] [(name (:id r)) (on? p (:id r))])))}))

(defonce kernels (atom {}))

(defn kernel
  "The kernel's canon for p, kept while p is in use (its count is memoized inside it)."
  [p]
  (or (get @kernels p)
      (let [kc (.canon K (spec p))]
        (swap! kernels (fn [m] (assoc (if (> (count m) 24) {} m) p kc)))
        kc)))

(defn last-move [dux] (let [n (count dux)] (when (>= n 2) (- (nth dux (dec n)) (nth dux (- n 2))))))

(defn check
  "Why the note x cannot come next after the dux (nil when it can): every hard rule that is on."
  [p dux x]
  (.check (kernel p) (clj->js dux) x))

(defn dissonant? "Is the vertical [x c] dissonant, as it is or under an inversion asked for?" [p x c]
  (.dissonant (kernel p) x c))

(defn roles
  "What each dissonance is, by time: nil, or {:dux \"passing\"|\"neighbour\"|\"dissonant\" :comes …}."
  [p dux]
  (mapv #(when % (js->clj % :keywordize-keys true)) (.roles (kernel p) (clj->js dux))))

;; ───────────────────────── soft rules: cost ─────────────────────────

(def leap-cost {0 0 1 0 2 0.2 3 0.4 4 0.5 5 0.8 7 0.8})

(defn vertical-class "The vertical at time i, as an interval class (0-6), or nil." [p dux i]
  (let [a (get dux i) c (comes-at p dux i)] (when (and a c) (mod (absv (- a c)) 7))))

(defn cost-parts
  "The soft cost of x after the dux, by rule: {rule-id cost} (only the rules that apply)."
  [p dux x]
  (let [t (count dux) prev (peek dux) m (last-move dux)
        c (comes-at p (conj dux x) t) pc (comes-at p dux (dec t))
        parts (transient {})]
    (when (contains? #{(mod (tonic p) 7) (mod (tenor p) 7)} (mod x 7))
      (assoc! parts :modal (- (* (weight p :modal) (if (and (> (:b p 1) 1) (zero? (mod t (:b p 1)))) 1.5 1)))))
    (when prev
      (let [s (- x prev) n (absv s) all (conj dux x)
            mv (conj (vec (map - (rest dux) dux)) s) L (count mv)]
        (when (pos? n) (assoc! parts :leap-size (* (weight p :leap-size) (get leap-cost n 1.5))))
        (when (zero? n) (assoc! parts :repeat (weight p :repeat)))
        (when (and (>= t 2) (pos? n) (= x (nth dux (- t 2)))) (assoc! parts :return (weight p :return)))
        (let [k (count (filter #(= x %) (take-last 3 (pop dux))))]
          (when (pos? k) (assoc! parts :hover (* k (weight p :hover)))))
        (when (and m (>= (absv m) 2) (pos? n) (= (sign m) (sign s)))
          (assoc! parts :contrary-after-leap (* (weight p :contrary-after-leap) (if (>= n 2) 2 1))))
        (when (and m (>= (absv m) 3) (> n 1)) (assoc! parts :step-back (weight p :step-back)))
        (when (and m (>= (absv m) 2) (>= n 2)) (assoc! parts :leap-after-leap (weight p :leap-after-leap)))
        (when (pos? n)
          (let [run (count (take-while #(and (not (zero? %)) (= (sign %) (sign s))) (rseq mv)))]
            (when (> run 4) (assoc! parts :run (weight p :run)))))
        (when (and (>= t 5) (< (- (apply max all) (apply min all)) 4)) (assoc! parts :open (weight p :open)))
        (when (and (> t 1) (pos? s) (= x (apply max dux))) (assoc! parts :climax (weight p :climax)))
        (cond (and (>= L 4) (= (mv (- L 1)) (mv (- L 3))) (= (mv (- L 2)) (mv (- L 4))) (not= (mv (- L 1)) (mv (- L 2))))
              (assoc! parts :sequence (weight p :sequence))
              (and (>= L 6) (= (subvec mv (- L 3)) (subvec mv (- L 6) (- L 3))))
              (assoc! parts :sequence (* (/ 2 3) (weight p :sequence)))
              (and m (pos? n) (some #(= [m s] [(mv %) (mv (inc %))]) (range 0 (- L 3))))
              (assoc! parts :memory (- (weight p :memory)))
              :else nil)
        (when (and m (= m s) (pos? n)) (assoc! parts :novelty (weight p :novelty)))))
    (when (and c pc prev)
      (let [dx (- x prev) dc (- c pc) [lo hi] (lower-first p x c)
            motion (cond (and (zero? dx) (zero? dc)) :none
                         (or (zero? dx) (zero? dc)) :oblique
                         (= (sign dx) (sign dc)) :similar
                         :else :contrary)]
        (case motion
          :oblique (assoc! parts :motion (* 0.5 (weight p :motion)))
          :similar (assoc! parts :motion (* 0.8 (weight p :motion)))
          nil)
        (when (and (= motion :similar) (= :perfect (quality lo hi)) (= 4 (mod (- hi lo) 7)))
          (assoc! parts :direct-perfect (weight p :direct-perfect)))
        (when (= motion :similar)
          (let [cls (mod (- hi lo) 7)
                run (loop [i (dec t) k 1]
                      (let [a (get dux i) b (comes-at p dux i) a0 (get dux (dec i)) b0 (comes-at p dux (dec i))]
                        (if (and a b a0 b0
                                 (let [[l h] (lower-first p a b)] (and (= :imperfect (quality l h)) (= cls (mod (- h l) 7))))
                                 (= (sign (- a a0)) (sign (- b b0))) (not (zero? (- a a0))))
                          (recur (dec i) (inc k))
                          k)))]
            (when (and (= :imperfect (quality lo hi)) (> run 3))
              (assoc! parts :imperfect-run (weight p :imperfect-run)))))
        (when (and (> (:b p 1) 1) (not (strong? p t)) (dissonant? p x c))
          (assoc! parts :passing (- (weight p :passing))))
        (when (>= t (+ (:d p) 2))
          (let [iv (mod (absv (- x c)) 7) i1 (vertical-class p dux (dec t)) i2 (vertical-class p dux (- t 2))]
            (when (and (= iv i2) (not= iv i1)) (assoc! parts :alternation (weight p :alternation)))))))
    (into {} (remove (fn [[_ v]] (zero? v))) (persistent! parts))))

(defn cost [p dux x] (reduce + 0 (vals (cost-parts p dux x))))

;; ───────────────────────── futuribles ─────────────────────────

(defn counter
  "A function dux → the number of ways to finish the canon from there, under the hard rules (exact: the
  kernel memoizes it on the notes the rules look back at)."
  [p]
  (let [kc (kernel p)] (fn [dux] (.count kc (clj->js dux)))))

(defn bits "The divergence: log2 of the ways to finish (0 when there is one, -1 when there is none)." [c]
  (if (pos? c) (/ (js/Math.log c) (js/Math.log 2)) -1))

(defn outlook
  "The cheapest cost of the next `depth` notes after the dux, among the notes that still have a future
  (0 at the end): how the line can go on from here, beyond the note itself."
  [p dux cnt depth]
  (if (or (<= depth 0) (>= (count dux) (:n p)))
    0
    (let [[lo hi] (lo-hi p)
          xs (filter #(and (nil? (check p dux %)) (pos? (cnt (conj dux %)))) (range lo (inc hi)))]
      (if (empty? xs)
        0
        (apply min (map #(+ (cost p dux %) (outlook p (conj dux %) cnt (dec depth))) xs))))))

(def look-weight
  "How much what can follow counts against the note itself (per note looked ahead)."
  0.5)

(defn fan
  "Every candidate for the next note: {:note :reason (nil when legal) :futures (ways to finish after it)
  :cost :parts :ahead :score}, from low to high. Illegal candidates come with their reason, legal ones that
  lead nowhere with :futures 0. With look > 0, :ahead is the cheapest cost of the next `look` notes after it
  and :score its cost plus look-weight times the mean of that: a note that leads only into a corridor of
  repeated notes scores badly even if it is cheap itself."
  ([p dux] (fan p dux (counter p) 0))
  ([p dux cnt] (fan p dux cnt 0))
  ([p dux cnt look]
   (let [[lo hi] (lo-hi p)]
     (vec (for [x (range lo (inc hi))]
            (let [r (check p dux x)]
              (if r
                {:note x :reason r}
                (let [parts (cost-parts p dux x)
                      c (reduce + 0 (vals parts))
                      fut (cnt (conj dux x))
                      ahead (when (and (pos? look) (pos? fut)) (outlook p (conj dux x) cnt look))]
                  {:note x :futures fut :cost c :parts parts :ahead ahead
                   :score (if ahead (+ c (* look-weight (/ ahead look))) c)}))))))))

;; ───────────────────────── why: which rule closes a future ─────────────────────────
;;
;; A note can be closed in two ways: a hard rule forbids it here (it has a reason), or it is allowed but no
;; canon finishes after it (0 futures), because of what the rules ask further on. To see which rule does it,
;; the futures are counted again with each hard rule turned off, one at a time.

(defn hard-rules-on "The hard rules that are on, in the order of the rule set." [p]
  (filterv #(and (= :hard (:kind %)) (on? p (:id %))) rules))

(defn without "The canon with one rule turned off." [p id] (assoc-in p [:rules id :on] false))

(defn why-rule
  "What turning the hard rule `id` off would open, for the note x after the dux (or, with x nil, for the
  point itself): {:rule id :reason why x is still not allowed without it (nil when it is) :futures n}."
  [p dux x id]
  (let [q (without p id)]
    (if (nil? x)
      {:rule id :futures ((counter q) dux)}
      (let [r (check q dux x)]
        {:rule id :reason r :futures (if r 0 ((counter q) (conj dux x)))}))))

(defn why
  "Every hard rule that is on, with what turning it off alone would open (see why-rule), the ones that open
  the most first. When none opens anything, it takes more than one rule: the note or the point is closed by
  rules together."
  [p dux x]
  (vec (sort-by (comp - :futures) (map #(why-rule p dux x (:id %)) (hard-rules-on p)))))

(defn divergence
  "The ways to finish at every point of the dux: index i is the count after its first i notes."
  ([p dux] (divergence p dux (counter p)))
  ([p dux cnt] (mapv #(cnt (subvec dux 0 %)) (range (inc (count dux))))))

;; ───────────────────────── obligations: what the next notes owe ─────────────────────────

(defn obligations
  "The debts pending at this point, in words, for the next note and the ones after it."
  [p dux]
  (let [t (count dux) n (:n p) m (last-move dux) c (comes-at p (conj dux 0) t) fin (finals p)
        pc (comes-at p dux (dec t)) prev (peek dux)
        diss-before (and prev pc (on? p :weak-dissonance) (dissonant? p prev pc))
        multi (> (:b p 1) 1)]
    (cond-> []
      diss-before
      (conj (str "leave the dissonance by step" (when-let [c2 c] (str " (the comes goes to " (pitch-name c2) ")"))))
      (and (on? p :leap-recovery) m (>= (absv m) 3))
      (conj (if (>= (absv m) 5)
              (str "after the leap of a " (interval-name (absv m)) ": a step " (if (pos? m) "down" "up"))
              (str "after the leap of a " (interval-name (absv m)) ": turn " (if (pos? m) "down" "up") " (by step, better)")))
      (and c (< t n) multi (strong? p t))
      (conj (str "a strong beat: a consonance against the comes on " (pitch-name c)))
      (and c (< t n) multi (not (strong? p t)) (not diss-before))
      (conj (str "a weak beat: against the comes on " (pitch-name c) ", a consonance, or a dissonance passing by step"))
      (and c (< t n) (not multi))
      (conj (str "a consonance against the comes on " (pitch-name c)))
      (and c (seq (:invert p)))
      (conj (str "also inverted at the " (str/join ", " (map #(interval-name (dec %)) (sort (:invert p))))))
      (and (on? p :approach) (= t (- n 2)))
      (conj "approach the final by step")
      (and (on? p :final) (= t (dec n)))
      (conj (str "end on the final (" (str/join " or " (map pitch-name fin)) "), on a perfect consonance"))
      (and (on? p :final) (< t (- n 2)))
      (conj (str "end on the final in " (- n t) " notes")))))

;; ───────────────────────── choosing: seeded, with a temperature ─────────────────────────

(defn rnd
  "A number in [0, 1) for the seed and an index: the same every time (mulberry32)."
  [seed i]
  (let [a (bit-or 0 (+ (js/Math.imul (bit-or 0 seed) 2654435761) (js/Math.imul (inc i) 40503)))
        a (bit-or 0 (+ a 0x6D2B79F5))
        x (js/Math.imul (bit-xor a (unsigned-bit-shift-right a 15)) (bit-or a 1))
        x (bit-xor x (+ x (js/Math.imul (bit-xor x (unsigned-bit-shift-right x 7)) (bit-or x 61))))]
    (/ (unsigned-bit-shift-right (bit-xor x (unsigned-bit-shift-right x 14)) 0) 4294967296)))

(defn temperature
  "The temperature at a point. With :follow, it follows the divergence after Copycat: colder when few
  futures are left (the work is tight), up to temp when there are many (256 ways or more)."
  [temp follow futures]
  (if follow (* temp (min 1 (/ (max 0 (bits futures)) 8))) temp))

(defn choose
  "The engine's choice among the candidates that still have a future: a softmax of -score / temperature
  (the score: the cost and what can follow it), drawn with (rnd seed t); at temperature 0 the best (the
  lowest note on a tie). nil when none."
  [cands seed t temp]
  (let [ok (filterv #(pos? (or (:futures %) 0)) cands)
        sc #(or (:score %) (:cost %))]
    (when (seq ok)
      (if (<= temp 0.001)
        (:note (first (sort-by (juxt sc :note) ok)))
        (let [m (apply min (map sc ok))
              ws (mapv #(js/Math.exp (/ (- m (sc %)) temp)) ok)
              r (* (rnd seed t) (reduce + ws))]
          (loop [i 0 acc 0]
            (let [acc (+ acc (nth ws i))]
              (if (or (< r acc) (= i (dec (count ok)))) (:note (nth ok i)) (recur (inc i) acc)))))))))

(defn continue-dux
  "The dux continued by the engine up to its end, one choice per note. Never stuck while the count from the
  start is not 0, since it only takes candidates with a future."
  [p dux {:keys [seed temp follow cnt look] :or {seed 1 temp 0 follow false look 2}}]
  (let [cnt (or cnt (counter p))]
    (loop [dux dux]
      (if (>= (count dux) (:n p))
        dux
        (let [cs (fan p dux cnt look)
              futures (cnt dux)
              x (choose cs seed (count dux) (temperature temp follow futures))]
          (if x (recur (conj dux x)) dux))))))

;; ───────────────────────── the history: only choices are kept ─────────────────────────
;;
;;   history {:nodes {"root" {:id "root"} "n1" {:id "n1" :parent "root" :note 1 :by :you}} :at "n1" :clock 1}
;;
;; A choice is a node; choosing what was already chosen there goes back to it (no new branch). Going back and
;; choosing another note makes a branch. The futuribles are never in it.

(defn new-history [] {:nodes {"root" {:id "root"}} :at "root" :clock 0})

(defn kids [h id] (sort-by :t (filter #(= id (:parent %)) (vals (:nodes h)))))

(defn path-ids [h id] (loop [id id acc ()] (if (or (nil? id) (= id "root")) (vec acc) (recur (:parent (get-in h [:nodes id])) (cons id acc)))))
(defn dux-at [h id] (mapv #(get-in h [:nodes % :note]) (path-ids h id)))
(defn current-dux [h] (dux-at h (:at h)))

(defn choose-note
  "The note chosen after the point where the history stands (by :you or :engine)."
  [h note by]
  (if-let [k (first (filter #(= note (:note %)) (kids h (:at h))))]
    (assoc h :at (:id k))
    (let [c (inc (:clock h)) id (str "n" c)]
      (-> h (assoc :clock c :at id) (assoc-in [:nodes id] {:id id :parent (:at h) :note note :by by :t c})))))

(defn back [h] (if (= "root" (:at h)) h (assoc h :at (:parent (get-in h [:nodes (:at h)])))))

(defn forward
  "One point forward, along the newest branch from here."
  [h] (if-let [k (last (kids h (:at h)))] (assoc h :at (:id k)) h))

(defn goto [h id] (if (get-in h [:nodes id]) (assoc h :at id) h))

(defn engine-step
  "One note chosen by the engine at the point where the history stands (nil when nothing has a future)."
  [p h cnt {:keys [seed temp follow look] :or {seed 1 temp 0 follow false look 2}}]
  (let [dux (current-dux h)]
    (when (< (count dux) (:n p))
      (when-let [x (choose (fan p dux cnt look) seed (count dux) (temperature temp follow (cnt dux)))]
        (choose-note h x :engine)))))

(defn leaves [h](let [parents (set (keep :parent (vals (:nodes h))))] (remove #(parents (:id %)) (vals (:nodes h)))))
