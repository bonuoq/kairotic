;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · Study 40 · imitation (discussion #172)
;;
;; In Studies 38 and 39 the comes is not chosen: it is the dux d beats later, k steps away. Here it is a voice of its
;; own, chosen note by note, and how much it imitates the dux is a degree, from 1 to 0 (:imitation):
;;
;;   1          a canon: the comes is the dux's note (a hard rule, in the kernel)
;;   0.5 – 0.9  some notes changed for near ones: within a 3rd of the dux's note (hard), each step away costing
;;              more the nearer the degree is to 1 (the soft rule :imitation)
;;   0.2 – 0.4  only the motion is imitated: going the other way than the dux went costs
;;   below 0.2  free counterpoint
;;
;; A point of the work is a time; a step chooses a pair, the dux's note and the comes's. You choose the dux, the
;; engine the comes (the cheapest, by its own line, the verticals and the imitation), and you can change the comes.
;; Both voices end together, as a canon breaks off into its cadence. The rest — meter, dissonance, modes, the rule
;; set as data, the futuribles counted exactly (over pairs, in kairotic/kernel.mjs), why?, the history — is Study 39's.
;;
;;   params   {:mode :dorian :k -7 :d 3 :b 2 :n 15 :spacing 11 :invert #{} :imitation 0.8 :rules {…}}
;;   D, C     the dux and the comes so far: two vectors of the same length (C has nil before the comes enters)

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
   {:id :start            :kind :hard :scope :melodic  :doc "Each voice starts on the final, its 5th, its octave or the 4th below (the comes shifted), as the ambitus allows."}
   {:id :melodic          :kind :hard :scope :melodic  :doc "Melodic intervals of first species, in both voices."}
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
   {:id :imitation        :kind :soft :scope :imitation :weight 1  :doc "How the comes imitates the dux, by the degree set: near notes cost by their distance from the dux's (0.5–0.9), a motion the other way costs (0.2–0.4); a canon (1) is a hard rule, below 0.2 there is none."}
   {:id :memory           :kind :soft :scope :memory   :weight 1   :doc "Memory of the work: a figure of two moves it used earlier (not just before) costs less."}
   {:id :novelty          :kind :soft :scope :memory   :weight 0.3 :doc "Novelty: the same move as the last one costs a little more."}])

(def rule-by-id (into {} (map (juxt :id identity)) rules))

(defn default-rules [] (into {} (map (fn [r] [(:id r) (if (= :hard (:kind r)) {:on (:default r true)} {:weight (:weight r)})])) rules))

(def default-params
  {:mode :dorian :k -7 :d 3 :b 2 :n 15 :spacing 11 :invert #{} :imitation 0.8 :rules (default-rules)})

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

(defn band "The band of a degree of imitation: :canon, :near, :motion or :free." [s]
  (cond (>= s 0.999) :canon (>= s 0.5) :near (>= s 0.2) :motion :else :free))

(defn model-note "The comes's note in a strict canon at time t: the dux's, d beats before, k steps away." [p D t]
  (let [i (- t (:d p))] (when (and (>= i 0) (< i (count D))) (+ (nth D i) (:k p)))))

(defn lower-first
  "A vertical [dux comes] as [lower upper] by voice: the comes is the lower voice when it is shifted down
  (or at the unison), the upper one when it is shifted up."
  [p dux-note comes-note]
  (if (pos? (:k p)) [dux-note comes-note] [comes-note dux-note]))

(defn inverted
  "The work under inversion at N: the lower voice taken up N-1 steps, so it sounds above."
  [p D C n]
  (let [up (fn [x] (when x (+ x (dec n))))]
    (if (pos? (:k p)) {:dux (mapv up D) :comes (vec C)} {:dux (vec D) :comes (mapv up C)})))

;; ───────────────────────── hard rules: the kernel ─────────────────────────

(defn spec "The work as the kernel reads it." [p]
  (let [[lo hi] (lo-hi p)]
    #js {:tonic (tonic p) :k (:k p) :d (:d p) :b (:b p 1) :n (:n p) :lo lo :hi hi :spacing (:spacing p 11)
         :invert (clj->js (vec (sort (:invert p)))) :starts (clj->js (start-notes p)) :imitation (:imitation p 1)
         :on (clj->js (into {} (for [r rules :when (= :hard (:kind r))] [(name (:id r)) (on? p (:id r))])))}))

(defonce kernels (atom {}))

(defn kernel "The kernel's work for p, kept while p is in use (its count is memoized inside it)." [p]
  (or (get @kernels p)
      (let [kc (.canon K (spec p))]
        (swap! kernels (fn [m] (assoc (if (> (count m) 24) {} m) p kc)))
        kc)))

(defn js-line [v] (clj->js (mapv #(if (nil? %) nil %) v)))

(defn check-dux "Why x cannot be the dux's next note (nil when it can), by the dux's own rules." [p D C x]
  (.checkDux (kernel p) (js-line D) (js-line C) x))

(defn check-pair "Why the comes's c cannot sound with the dux's x next (nil when it can)." [p D C x c]
  (.checkPair (kernel p) (js-line D) (js-line C) x c))

(defn dissonant? [p x c] (.dissonant (kernel p) x c))

(defn roles "What each dissonance is, by time: nil, or {:dux … :comes …}." [p D C]
  (mapv #(when % (js->clj % :keywordize-keys true)) (.roles (kernel p) (js-line D) (js-line C))))

(defn counter "A function (D, C) → the ways to finish the work from there (exact)." [p]
  (let [kc (kernel p)] (fn [D C] (.count kc (js-line D) (js-line C)))))

(defn last-move [line] (let [n (count line)] (when (>= n 2) (- (nth line (dec n)) (nth line (- n 2))))))

;; ───────────────────────── soft rules: cost ─────────────────────────

(def leap-cost {0 0 1 0 2 0.2 3 0.4 4 0.5 5 0.8 7 0.8})

(defn melodic-parts
  "The soft cost of x after a line, by rule (the line's own shape). t is the time of x; modal? whether the
  mode's notes count (for the dux)."
  [p line x t modal?]
  (let [prev (peek line) m (last-move line) parts (transient {})]
    (when (and modal? (contains? #{(mod (tonic p) 7) (mod (tenor p) 7)} (mod x 7)))
      (assoc! parts :modal (- (* (weight p :modal) (if (and (> (:b p 1) 1) (strong? p t)) 1.5 1)))))
    (when prev
      (let [s (- x prev) n (absv s) all (conj line x) tl (count line)
            mv (conj (vec (map - (rest line) line)) s) L (count mv)]
        (when (pos? n) (assoc! parts :leap-size (* (weight p :leap-size) (get leap-cost n 1.5))))
        (when (zero? n) (assoc! parts :repeat (weight p :repeat)))
        (when (and (>= tl 2) (pos? n) (= x (nth line (- tl 2)))) (assoc! parts :return (weight p :return)))
        (let [k (count (filter #(= x %) (take-last 3 (pop line))))]
          (when (pos? k) (assoc! parts :hover (* k (weight p :hover)))))
        (when (and m (>= (absv m) 2) (pos? n) (= (sign m) (sign s)))
          (assoc! parts :contrary-after-leap (* (weight p :contrary-after-leap) (if (>= n 2) 2 1))))
        (when (and m (>= (absv m) 3) (> n 1)) (assoc! parts :step-back (weight p :step-back)))
        (when (and m (>= (absv m) 2) (>= n 2)) (assoc! parts :leap-after-leap (weight p :leap-after-leap)))
        (when (pos? n)
          (let [run (count (take-while #(and (not (zero? %)) (= (sign %) (sign s))) (rseq mv)))]
            (when (> run 4) (assoc! parts :run (weight p :run)))))
        (when (and (>= tl 5) (< (- (apply max all) (apply min all)) 4)) (assoc! parts :open (weight p :open)))
        (when (and (> tl 1) (pos? s) (= x (apply max line))) (assoc! parts :climax (weight p :climax)))
        (cond (and (>= L 4) (= (mv (- L 1)) (mv (- L 3))) (= (mv (- L 2)) (mv (- L 4))) (not= (mv (- L 1)) (mv (- L 2))))
              (assoc! parts :sequence (weight p :sequence))
              (and (>= L 6) (= (subvec mv (- L 3)) (subvec mv (- L 6) (- L 3))))
              (assoc! parts :sequence (* (/ 2 3) (weight p :sequence)))
              (and m (pos? n) (some #(= [m s] [(mv %) (mv (inc %))]) (range 0 (- L 3))))
              (assoc! parts :memory (- (weight p :memory)))
              :else nil)
        (when (and m (= m s) (pos? n)) (assoc! parts :novelty (weight p :novelty)))))
    (into {} (remove (fn [[_ v]] (zero? v))) (persistent! parts))))

(defn vclass [p D C i] (let [a (get D i) c (get C i)] (when (and a c) (mod (absv (- a c)) 7))))

(defn vertical-parts "The soft cost of the vertical [x c] at the next time, by rule." [p D C x c]
  (let [t (count D) prev (peek D) pc (peek C) parts (transient {})]
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
                      (let [a (get D i) b (get C i) a0 (get D (dec i)) b0 (get C (dec i))]
                        (if (and a b a0 b0
                                 (let [[l h] (lower-first p a b)] (and (= :imperfect (quality l h)) (= cls (mod (- h l) 7))))
                                 (= (sign (- a a0)) (sign (- b b0))) (not (zero? (- a a0))))
                          (recur (dec i) (inc k))
                          k)))]
            (when (and (= :imperfect (quality lo hi)) (> run 3))
              (assoc! parts :imperfect-run (weight p :imperfect-run)))))
        (when (and (> (:b p 1) 1) (not (strong? p t)) (dissonant? p x c))
          (assoc! parts :passing (- (weight p :passing))))
        (when (>= t 2)
          (let [iv (mod (absv (- x c)) 7) i1 (vclass p D C (dec t)) i2 (vclass p D C (- t 2))]
            (when (and i1 i2 (= iv i2) (not= iv i1)) (assoc! parts :alternation (weight p :alternation)))))))
    (into {} (remove (fn [[_ v]] (zero? v))) (persistent! parts))))

(defn imitation-cost
  "What the comes's c costs for how it imitates the dux, by the degree: in :near, by its distance from the dux's
  note (the nearer the degree to 1, the more); in :motion, going the other way than the dux went."
  [p D C c]
  (let [s (:imitation p 1) t (count D) w (weight p :imitation) m (model-note p D t)]
    (case (band s)
      :near (if m (* w (absv (- c m)) (+ 1 (* 6 (/ (- s 0.5) 0.4)))) 0)
      :motion (let [i (- t (:d p)) md (when (>= i 1) (- (nth D i) (nth D (dec i)))) pc (peek C) cm (when pc (- c pc))]
                (if (and md cm)
                  (+ (if (not= (sign md) (sign cm)) (* w (+ 1 (* 4 (/ (- s 0.2) 0.3)))) 0)
                     (* w 0.3 s (absv (- cm md))))
                  0))
      0)))

(defn comes-line [C] (vec (drop-while nil? C)))

(defn pair-parts
  "The soft cost of the comes's c with the dux's x at the next time: the vertical, the comes's own line (its
  rules as comes/…) and the imitation."
  [p D C x c]
  (if (nil? c)
    {}
    (let [t (count D)
          own (into {} (map (fn [[k v]] [(keyword "comes" (name k)) v])) (melodic-parts p (comes-line C) c t false))
          im (imitation-cost p D C c)]
      (cond-> (merge (vertical-parts p D C x c) own)
        (pos? im) (assoc :imitation im)))))

(defn total [parts] (reduce + 0 (vals parts)))

;; ───────────────────────── futuribles ─────────────────────────

(defn bits "The divergence: log2 of the ways to finish (0 when there is one, -1 when there is none)." [c]
  (if (pos? c) (/ (js/Math.log c) (js/Math.log 2)) -1))

(defn fan-comes
  "The comes's candidates with the dux's x at the next time: {:note :reason} or {:note :futures :cost :parts}."
  [p D C x cnt]
  (mapv (fn [e]
          (let [c (.-note e) r (.-reason e)]
            (if r
              {:note c :reason r}
              (let [parts (pair-parts p D C x c)]
                {:note c :futures (cnt (conj D x) (conj C c)) :cost (total parts) :parts parts}))))
        (.fanComes (kernel p) (js-line D) (js-line C) x)))

(defn best-comes "The comes's candidate with a future that costs least (nil when none)." [cands]
  (first (sort-by (juxt :cost #(or (:note %) -100)) (filter #(pos? (or (:futures %) 0)) cands))))

(defn fan
  "The dux's candidates at the next time: {:note :reason} or {:note :futures :cost :parts :comes :score}: :comes
  is the comes's best note with it, and :score the dux's own cost plus that pair's."
  [p D C cnt]
  (let [t (count D)]
    (mapv (fn [e]
            (let [x (.-note e) r (.-reason e)]
              (if r
                {:note x :reason r}
                (let [parts (melodic-parts p D x t true)
                      cs (when (pos? (.-futures e)) (fan-comes p D C x cnt))
                      bc (best-comes cs)
                      own (total parts)]
                  {:note x :futures (.-futures e) :cost own :parts parts :comes (:note bc) :comes-parts (:parts bc)
                   :score (+ own (or (:cost bc) 0))}))))
          (.fanDux (kernel p) (js-line D) (js-line C)))))

(defn divergence "The ways to finish at every point: index i is the count after the first i pairs." [p D C cnt]
  (mapv #(cnt (subvec D 0 %) (subvec C 0 %)) (range (inc (count D)))))

;; ───────────────────────── why ─────────────────────────

(defn hard-rules-on "The hard rules that are on, in the order of the rule set." [p]
  (filterv #(and (= :hard (:kind %)) (on? p (:id %))) rules))

(defn without "The work with one rule turned off." [p id] (assoc-in p [:rules id :on] false))

(defn why-rule
  "What turning the hard rule `id` off would open, for the dux's note x next (or, with x nil, for the point):
  {:rule id :reason (nil when x is allowed without it) :futures n}."
  [p D C x id]
  (let [q (without p id)]
    (if (nil? x)
      {:rule id :futures ((counter q) D C)}
      (let [e (first (filter #(= x (.-note %)) (.fanDux (kernel q) (js-line D) (js-line C))))]
        {:rule id :reason (.-reason e) :futures (or (.-futures e) 0)}))))

(defn why [p D C x] (vec (sort-by (comp - :futures) (map #(why-rule p D C x (:id %)) (hard-rules-on p)))))

;; ───────────────────────── obligations ─────────────────────────

(defn obligations "The debts pending at this point, in words." [p D C]
  (let [t (count D) n (:n p) m (last-move D) cm (last-move (comes-line C)) fin (finals p)
        prev (peek D) pc (peek C) mn (model-note p D t) s (:imitation p 1)
        diss-before (and prev pc (on? p :weak-dissonance) (dissonant? p prev pc))
        multi (> (:b p 1) 1)
        leap (fn [who mv] (if (>= (absv mv) 5)
                            (str who "after the leap of a " (interval-name (absv mv)) ": a step " (if (pos? mv) "down" "up"))
                            (str who "after the leap of a " (interval-name (absv mv)) ": turn " (if (pos? mv) "down" "up") " (by step, better)")))]
    (cond-> []
      diss-before (conj "leave the dissonance by step, in both voices")
      (and (on? p :leap-recovery) m (>= (absv m) 3)) (conj (leap "" m))
      (and (on? p :leap-recovery) cm (>= (absv cm) 3)) (conj (leap "the comes: " cm))
      (and mn (< t n) (= :canon (band s))) (conj (str "a canon: the comes sounds " (pitch-name mn)))
      (and mn (< t n) (= :near (band s))) (conj (str "the comes near " (pitch-name mn) " (within a 3rd)"))
      (and mn (< t n) (= :motion (band s))) (conj "the comes moves as the dux moved")
      (and (< t n) multi (>= t (:d p))) (conj (if (strong? p t) "a strong beat: a consonance between the voices"
                                                  "a weak beat: a consonance, or a dissonance passing by step in both voices"))
      (and (seq (:invert p)) (< t n)) (conj (str "also inverted at the " (str/join ", " (map #(interval-name (dec %)) (sort (:invert p))))))
      (and (on? p :approach) (= t (- n 2))) (conj "approach the final by step")
      (and (on? p :final) (= t (dec n))) (conj (str "end on the final (" (str/join " or " (map pitch-name fin)) "), on a perfect consonance"))
      (and (on? p :final) (< t (- n 2))) (conj (str "end on the final in " (- n t) " notes")))))

;; ───────────────────────── choosing ─────────────────────────

(defn rnd "A number in [0, 1) for the seed and an index: the same every time (mulberry32)." [seed i]
  (let [a (bit-or 0 (+ (js/Math.imul (bit-or 0 seed) 2654435761) (js/Math.imul (inc i) 40503)))
        a (bit-or 0 (+ a 0x6D2B79F5))
        x (js/Math.imul (bit-xor a (unsigned-bit-shift-right a 15)) (bit-or a 1))
        x (bit-xor x (+ x (js/Math.imul (bit-xor x (unsigned-bit-shift-right x 7)) (bit-or x 61))))]
    (/ (unsigned-bit-shift-right (bit-xor x (unsigned-bit-shift-right x 14)) 0) 4294967296)))

(defn temperature "The temperature, colder where few futures are left when it follows the divergence." [temp follow futures]
  (if follow (* temp (min 1 (/ (max 0 (bits futures)) 8))) temp))

(defn choose
  "The engine's choice among the candidates with a future: a softmax of -score / temperature drawn with
  (rnd seed i); at temperature 0 the best. Returns the candidate (nil when none)."
  [cands seed i temp]
  (let [ok (filterv #(pos? (or (:futures %) 0)) cands)
        sc #(or (:score %) (:cost %))]
    (when (seq ok)
      (if (<= temp 0.001)
        (first (sort-by (juxt sc :note) ok))
        (let [m (apply min (map sc ok))
              ws (mapv #(js/Math.exp (/ (- m (sc %)) temp)) ok)
              r (* (rnd seed i) (reduce + ws))]
          (loop [j 0 acc 0]
            (let [acc (+ acc (nth ws j))]
              (if (or (< r acc) (= j (dec (count ok)))) (nth ok j) (recur (inc j) acc)))))))))

(defn engine-pair
  "The engine's pair at the next time: [dux comes], or nil. The dux by its score, then the comes by its cost."
  [p D C cnt {:keys [seed temp follow] :or {seed 1 temp 0 follow false}}]
  (let [t (count D) T (temperature temp follow (cnt D C))]
    (when-let [dx (choose (fan p D C cnt) seed t T)]
      (let [cc (choose (fan-comes p D C (:note dx) cnt) seed (+ 1000 t) T)]
        (when cc [(:note dx) (:note cc)])))))

(defn continue-work "The work continued by the engine to its end: [D C]." [p D C opts]
  (let [cnt (or (:cnt opts) (counter p))]
    (loop [D D C C]
      (if (>= (count D) (:n p))
        [D C]
        (if-let [[x c] (engine-pair p D C cnt opts)] (recur (conj D x) (conj C c)) [D C])))))

;; ───────────────────────── the history: only choices are kept ─────────────────────────
;;
;;   a node {:id :parent :note x :comes c :by :you|:engine :cby :you|:engine :t}
;; A choice of a pair is a node; choosing another comes at the last point is a branch, as any other choice.

(defn new-history [] {:nodes {"root" {:id "root"}} :at "root" :clock 0})
(defn kids [h id] (sort-by :t (filter #(= id (:parent %)) (vals (:nodes h)))))
(defn path-ids [h id] (loop [id id acc ()] (if (or (nil? id) (= id "root")) (vec acc) (recur (:parent (get-in h [:nodes id])) (cons id acc)))))
(defn dux-at [h id] (mapv #(get-in h [:nodes % :note]) (path-ids h id)))
(defn comes-at [h id] (mapv #(get-in h [:nodes % :comes]) (path-ids h id)))
(defn current-dux [h] (dux-at h (:at h)))
(defn current-comes [h] (comes-at h (:at h)))

(defn choose-pair "The pair chosen after the point where the history stands." [h x c by cby]
  (if-let [k (first (filter #(and (= x (:note %)) (= c (:comes %))) (kids h (:at h))))]
    (assoc h :at (:id k))
    (let [n (inc (:clock h)) id (str "n" n)]
      (-> h (assoc :clock n :at id) (assoc-in [:nodes id] {:id id :parent (:at h) :note x :comes c :by by :cby cby :t n})))))

(defn back [h] (if (= "root" (:at h)) h (assoc h :at (:parent (get-in h [:nodes (:at h)])))))
(defn forward [h] (if-let [k (last (kids h (:at h)))] (assoc h :at (:id k)) h))
(defn goto [h id] (if (get-in h [:nodes id]) (assoc h :at id) h))

(defn change-comes
  "Another comes for the last pair: a branch beside it (the dux's note kept, chosen by whoever chose it)."
  [h c]
  (let [nd (get-in h [:nodes (:at h)])]
    (if (= "root" (:at h)) h (choose-pair (back h) (:note nd) c (:by nd) :you))))

(defn engine-step "One pair chosen by the engine at the point where the history stands (nil when none)." [p h cnt opts]
  (let [D (current-dux h) C (current-comes h)]
    (when (< (count D) (:n p))
      (when-let [[x c] (engine-pair p D C cnt opts)] (choose-pair h x c :engine :engine)))))

(defn leaves [h] (let [parents (set (keep :parent (vals (:nodes h))))] (remove #(parents (:id %)) (vals (:nodes h)))))
