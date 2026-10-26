;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · quantize
;; Free time written as measured notation (issue #86): the strokes of a freqt, or the notes of a tree
;; without measures, become a tree of measures, tuplets, ties and grace notes, which kairotic.mt writes
;; as MEI (and Verovio draws). The tree is plain EDN: it can be read, kept and edited like any other.
;;
;; How (after bach.quantize, FOMUS, Nauert):
;;  1. the frame: the meter comes from the bar grid of the buffer (:gx, its cycles: [4] → 4/4,
;;     [1.5 1.5 1] → 8/8 [3+3+2]) or from the options; without a grid, 4/4.
;;  2. each bar is cut in spans (the beats of a simple meter; the groups, or dotted beats, of 6/8, 7/8 …)
;;     and every span tries a set of divisions (1 2 3 4 5 6 7 8, and those of its own units); each
;;     division costs the distance from the starts (and, less, the ends) to its points, how deep the
;;     points it uses are (the beat, its half, its quarters, then much more for 32nds; a third, a fifth…),
;;     being a tuplet (3 less than 5, 5 less than 7) and the notes it loses (two starts that fall on one
;;     point, a note that shrinks to nothing). In a simple meter two beats may also go
;;     together (a half-note triplet). The cheapest plan of each bar wins.
;;     A beat can also be cut in halves (a dotted beat in its eighths), each with its own division.
;;  3. notes that overlap go to different voices (layers of one staff), all on the same points;
;;     the notes are written on those points: chords where starts meet, rests in the gaps,
;;     a tie where a note goes on over a barline or into or out of a tuplet, a grace note for a note too
;;     short for any point. How each value is written (where the beats have to be seen) is kairotic.mt's
;;     work (mt/metric-split), so that hand-written trees get it too.
;;
;; Options (all optional): {:meter "5/8[2+3]" :divs [1 2 3 4 5 6 7 8] :merge [3 5 6] :grace true
;;   :chord 0.04 :legato 0.25 :tempo 72 :w {:err 8 :off 0.35 :cpx 1 :lost 1.5}}. :divs are the divisions a
;; span may take, :merge those of two beats together ([] for none), :chord how close two starts are to be
;; one chord (beats), :legato the largest gap before the next note that is not a rest (beats; 0: every gap
;; is), :key the key the score is written in ("eb", "c#m", :none; without it no signature, and names
;; from the key the notes suggest), :w the weights of the cost; :voices (2) how many voices overlapping notes may take, :overlap how
;; much a note may run into the next and stay in its voice, :nest false for no beats cut in parts, and
;; :fix {beat-start choice} the divisions chosen by hand (n, [n1 n2] or [:merge n]: see `choices`).

(ns kairotic.quantize
  (:require [kairotic.canvas :as cv]
            [kairotic.spell :as sp]
            [kairotic.mt :as mt]))

(def eps 1e-6)
(defn- near? [a b] (< (js/Math.abs (- a b)) eps))
(defn- whole? [x] (near? x (js/Math.round x)))
(defn- gcd [a b] (if (zero? b) (js/Math.abs a) (recur b (mod a b))))

(def defaults
  {:divs [1 2 3 4 5 6 7 8]
   :merge [3 5 6]
   :grace true
   :chord 0.04
   :legato 0.25
   :voices 2
   :nest true
   :overlap 0.15
   :w {:err 8 :off 0.35 :cpx 1 :lost 1.5}})

;; ───────── 1. the frame ─────────

(defn- default-groups [p q]
  (cond (<= q 4) (vec (repeat p 1))
        (and (zero? (mod p 3)) (> p 3)) (vec (repeat (quot p 3) 3))
        (<= p 3) [p]
        :else nil))

(defn meter-of-grid
  "The meter a bar grid (:gx) stands for: its cycles, in beats, counted in quarters when they are whole
   ([4] → 4/4, [3] → 3/4, [2 3] → 5/4 [2+3]), in eighths when they need them ([1.5 1.5] → 6/8,
   [1.5 1.5 1] → 8/8 [3+3+2]), and so on. Without a grid, 4/4."
  [gx]
  (let [cs (vec (or (seq (:cycles gx)) [4]))
        q (first (filter (fn [q] (every? (fn [c] (and (pos? c) (whole? (* c (/ q 4))))) cs)) [4 8 16 32]))]
    (if-not q
      {:meter [4 4]}
      (let [us (mapv (fn [c] (js/Math.round (* c (/ q 4)))) cs) p (reduce + us)]
        (cond-> {:meter [p q]} (and (> (count us) 1) (not= us (default-groups p q))) (assoc :groups us))))))

(defn sane-choice
  "A division chosen for a span: n (the span in n), [n1 n2 …] (cut in parts, each its own division) or
   [:merge n] (with the next beat, in n). nil if it is none of those."
  [c]
  (let [n? (fn [x] (and (number? x) (whole? x) (<= 1 x 24)))]
    (cond (n? c) (js/Math.round c)
          (and (vector? c) (= :merge (first c)) (n? (second c))) [:merge (js/Math.round (second c))]
          (and (vector? c) (<= 2 (count c) 3) (every? n? c)) (mapv js/Math.round c)
          :else nil)))

(defn sane-fix
  "The divisions chosen by hand, {span-start choice} (beats → see sane-choice), without what does not read."
  [f]
  (when (map? f)
    (not-empty (into {} (for [[k v] f :let [c (sane-choice v)] :when (and (number? k) (>= k 0) c)] [k c])))))

(defn sane-spell
  "Names chosen by hand for notes of a quantized score: {[beat midi] name} (the beat where the note starts
   in the score, its MIDI pitch), keeping only names that sound that pitch."
  [m]
  (when (map? m)
    (not-empty (into {} (for [[k v] m
                              :let [[t p] (when (vector? k) k) w (sp/parse v)]
                              :when (and (number? t) (number? p) w (= (sp/->midi w) (js/Math.round p)))]
                          [[t (js/Math.round p)] (sp/->name w)])))))

(defn respell-by-hand
  "A tree with the names chosen by hand (:spell, see sane-spell) on the notes that start at that beat
   with that pitch."
  [t spell]
  (if (empty? spell)
    t
    (let [evs (filter (fn [e] (= :note (:kind e))) (mt/events t))]
      (reduce (fn [t e]
                (if-let [nm (some (fn [[[bt p] v]] (when (and (< (js/Math.abs (- bt (:t e))) 1e-4) (= p (js/Math.round (:pitch e)))) v)) spell)]
                  (mt/apply-op t [:attrs (:path e) (assoc (mt/attrs (mt/node-at t (:path e))) :pitch nm)])
                  t))
              t evs))))

(defn options
  "The options of a quantization, with the defaults, and its meter ({:meter [p q] :groups …}): the one
   given, or that of the bar grid gx."
  [opts gx]
  (let [o (merge defaults (when (map? opts) opts))
        ints (fn [xs] (vec (filter (fn [n] (and (number? n) (whole? n) (<= 1 n 24))) (when (sequential? xs) xs))))]
    (assoc o
           :meter (if (some? (:meter opts)) (mt/meter-of (if (map? (:meter opts)) (:meter opts) {:meter (:meter opts) :groups (:groups opts)}))
                      (meter-of-grid gx))
           :divs (let [d (ints (:divs o))] (if (seq d) d (:divs defaults)))
           :merge (ints (:merge o))
           :chord (let [x (:chord o)] (if (and (number? x) (>= x 0)) x (:chord defaults)))
           :legato (let [x (:legato o)] (if (and (number? x) (>= x 0)) x (:legato defaults)))
           :overlap (let [x (:overlap o)] (if (and (number? x) (>= x 0)) x (:overlap defaults)))
           :voices (let [x (:voices o)] (if (and (number? x) (whole? x) (<= 1 x 4)) (js/Math.round x) (:voices defaults)))
           :fix (sane-fix (:fix o))
           :key (let [k (:key o)] (when (and (some? k) (sp/parse-key k)) k))
           :spell (sane-spell (:spell o))
           :step (when (and (map? gx) (number? (:step gx)) (pos? (:step gx))) (:step gx))
           :w (merge (:w defaults) (when (map? (:w opts)) (:w opts))))))

(defn spans
  "The spans of a bar the quantizer divides, as [start length units] (beats from the bar's start, and
   how many units of the meter): the beats of a simple meter (in 5/4 [2+3] too); the groups of a meter
   in eighths or shorter, or its dotted beats (6/8 in two), or the whole bar (3/8); else pairs of units
   and a last three (7/8 → 2+2+3)."
  [meter]
  (let [{[p q] :meter g :groups} (mt/meter-of meter) u (/ 4 q)
        us (cond (<= q 4) (repeat p 1)
                 (seq g) g
                 (and (zero? (mod p 3)) (> p 3)) (repeat (quot p 3) 3)
                 (<= p 3) [p]
                 :else (let [n2 (quot p 2)] (if (odd? p) (concat (repeat (dec n2) 2) [3]) (repeat n2 2))))
        lens (map (fn [k] (* k u)) us)]
    (mapv vector (reductions + 0 lens) lens us)))

;; ───────── 2. the divisions of a span ─────────

(defn- odd-part [n] (loop [n n] (if (and (pos? n) (even? n)) (recur (/ n 2)) n)))

(defn- largest-prime [n]
  (loop [n n f 2 top 1]
    (cond (< n 2) top
          (> (* f f) n) (max top n)
          (zero? (mod n f)) (recur (/ n f) f f)
          :else (recur n (inc f) top))))

(defn tuplet-of
  "The tuplet n points in a span of L beats need: nil when their unit is a written value (plain or
   dotted: three in a quarter of 6/8 are eighths), [n m] when it is not (n in the time of m: 3 in a
   quarter are [3 2] eighths, 5 are [5 4] sixteenths), or :none when no tuplet writes it."
  [L n]
  (let [u (/ L n) x (* u 64)]
    (if (and (whole? x) (#{1 3} (odd-part (js/Math.round x))))
      nil
      (let [up (loop [w 1] (cond (< w (- u eps)) (recur (* 2 w)) (>= (/ w 2) (- u eps)) (recur (/ w 2)) :else w))
            down (loop [w up] (if (> w (+ u eps)) (recur (/ w 2)) w))
            m (some (fn [w] (let [m (/ L w)] (when (whole? m) (js/Math.round m)))) [up down])]
        (if m [n m] :none)))))

(defn complexity
  "What a division costs before any note is put on it: a tuplet, by its largest prime (3, 5, 7, more),
   a grid of dotted values a little, and a very little more for each point (between two divisions that
   place the notes alike, the simpler one)."
  [L n]
  (let [tup (tuplet-of L n)]
    (+ (* 0.01 n)
       (cond (nil? tup) (if (= 3 (odd-part (js/Math.round (* 64 (/ L n))))) 0.05 0)
             (= :none tup) 99
             :else (let [[a b] tup g (gcd a b)]
                     (case (largest-prime (* (/ a g) (/ b g))) 3 0.25 5 0.5 7 0.7 1.0))))))

(defn depth
  "How deep point k of n in a span of L beats is, as a cost to read a note there: 0 on the beat, little on
   its half, more on its quarters, much on eighths of a beat and below (32nds); in a tuplet, by how many
   parts its fraction of the span has (a third, a fifth …)."
  [L n k]
  (if (zero? (mod k n))
    0
    (if (nil? (tuplet-of L n))
      (let [x (* k (/ L n))
            den (loop [d 1] (if (or (whole? (* x d)) (> d 64)) d (recur (* 2 d))))]
        (case den 1 0 2 0.05 4 0.15 8 0.8 16 1.2 1.5))
      (let [d (/ n (gcd k n))]
        (case d 2 0.05 4 0.15 (+ 0.1 (* 0.05 d)))))))

(defn- points-in [pts a b] (filterv (fn [p] (and (>= (:t p) (- a eps)) (< (:t p) (- b eps)))) pts))

(defn span-options
  "Every division of the span [s, s+L) for the points that fall in it ({:t :kind :on|:off :note i}),
   cheapest first: [{:n :tup :cost}]. merged?: two beats together (only the :merge divisions)."
  [s L units pts o merged?]
  (let [W (:w o)
        divs (distinct (concat (if merged?
                                 (:merge o)
                                 (concat (:divs o) (map (fn [k] (* units k)) [1 2 4])
                                         (when-let [st (:step o)] (let [n (/ L st)] (when (and (whole? n) (<= n 16)) [(js/Math.round n)])))))))]
    (->> (for [n divs
               :when (and (<= 1 n 24) (not (and merged? (= 1 n))))
               :let [tup (tuplet-of L n)]
               :when (not= :none tup)
               :let [g (/ L n)
                     ks (mapv (fn [p] (js/Math.round (/ (- (:t p) s) g))) pts)
                     err (reduce + (map (fn [p k] (* (if (= :on (:kind p)) 1 (:off W)) (js/Math.abs (- (:t p) (+ s (* k g))))))
                                        pts ks))
                     ons (filter (fn [[p _]] (= :on (:kind p))) (map vector pts ks))
                     ;; starts that meet on one point though they were not together: one is lost (or a chord)
                     clash (reduce + (for [[_ grp] (group-by second ons) :when (> (count grp) 1)
                                           :let [ts (map (comp :t first) grp)]]
                                       (if (> (- (apply max ts) (apply min ts)) (:chord o)) (dec (count grp)) 0)))
                     ;; a note that starts and ends on the same point vanishes
                     gone (count (filter (fn [[_ xs]] (and (= 2 (count xs)) (apply = (map second xs))))
                                         (group-by (comp :note first) (map vector pts ks))))
                     deep (reduce + (map (fn [p k] (* (if (= :on (:kind p)) 1 (:off W)) (depth L n k))) pts ks))
                     cost (+ (* (:err W) err)
                             (* (:cpx W) (+ (complexity L n) deep (if merged? 0.1 0)))
                             (* (:lost W) (+ clash gone)))]]
           {:n n :tup tup :cost cost})
         (sort-by :cost)
         vec)))

(defn best-of-span
  "The cheapest way to divide one span [s, s+L) of u units: a division of the whole span, or the span cut
   in parts (halves of a beat, the three eighths of a dotted beat) each with its own division, when one of
   them needs a tuplet the whole span cannot give (an eighth and a triplet of sixteenths). {:s :L :n :tup
   :cost}, with :parts [regions] when it is cut."
  [s L u pts o]
  (let [flat (assoc (first (span-options s L u (points-in pts s (+ s L)) o false)) :s s :L L)
        k (cond (and (= u 3) (zero? (mod (* 64 L) 3))) 3 (or (= u 1) (= u 2)) 2 :else nil)
        nested (when (and k (:nest o))
                 (let [pl (/ L k)
                       parts (mapv (fn [i] (let [ps (+ s (* i pl))]
                                             (assoc (first (span-options ps pl (/ u k) (points-in pts ps (+ ps pl)) o false)) :s ps :L pl)))
                                   (range k))]
                   (when (some :tup parts)
                     {:s s :L L :n k :tup nil :parts parts
                      :cost (+ (reduce + (map :cost parts)) (* (:cpx (:w o)) 0.15))})))]
    (if (and nested (< (:cost nested) (:cost flat))) nested flat)))

(def ^:private forced -1e6)

(defn- fix-at [o s] (some (fn [[k v]] (when (near? k s) v)) (:fix o)))
(defn- merge-choice? [c] (and (vector? c) (= :merge (first c))))

(defn- choose-span
  "The division c chosen for the span [s, s+L) (n, or [n1 n2 …] for its parts) as a region that the plan
   takes whatever it costs, or nil when the span cannot take it."
  [s L u pts o c]
  (let [with (fn [ps pl pu n] (some-> (first (filter (fn [x] (= n (:n x)))
                                                     (span-options ps pl pu (points-in pts ps (+ ps pl)) (update o :divs conj n) false)))
                                      (assoc :s ps :L pl)))]
    (cond (number? c) (some-> (with s L u c) (assoc :cost forced))
          (and (vector? c) (number? (first c)))
          (let [k (count c) pl (/ L k)
                parts (mapv (fn [i n] (with (+ s (* i pl)) pl (/ u k) n)) (range k) c)]
            (when (every? some? parts) {:s s :L L :n k :tup nil :parts parts :cost forced}))
          :else nil)))

(defn bar-plan
  "The cheapest way to divide one bar (it starts at beat b0) for the points in it: its regions
   [{:s :L :n :tup :cost}] in order, each a span (or two beats together) with its division."
  [b0 meter pts o]
  (let [{[_ q] :meter g :groups} (mt/meter-of meter)
        sps (mapv (fn [[s L u]] [(+ b0 s) L u]) (spans meter))
        n (count sps)
        simple? (and (<= q 4) (empty? g))
        ;; a division chosen by hand (:fix) wins; else the cheapest
        single (mapv (fn [[s L u]] (or (let [c (fix-at o s)] (when (and c (not (merge-choice? c))) (choose-span s L u pts o c)))
                                       (best-of-span s L u pts o)))
                     sps)
        merged (fn [i] (when (and simple? (even? i) (< (inc i) n) (near? (second (sps i)) (second (sps (inc i)))))
                         (let [[s L u] (sps i) c (fix-at o s) mc (when (merge-choice? c) (second c))
                               xs (span-options s (* 2 L) (* 2 u) (points-in pts s (+ s L L)) (cond-> o mc (update :merge conj mc)) true)
                               x (if mc (some-> (first (filter (fn [x] (= mc (:n x))) xs)) (assoc :cost forced)) (when (seq (:merge o)) (first xs)))]
                           (when x (assoc x :s s :L (* 2 L))))))
        best (reduce (fn [best i]
                       (let [[c1 p1] (best (dec i))
                             a [(+ c1 (:cost (single (dec i)))) (conj p1 (single (dec i)))]
                             m (when (>= i 2) (merged (- i 2)))
                             b (when m (let [[c2 p2] (best (- i 2))] [(+ c2 (:cost m)) (conj p2 m)]))]
                         (conj best (if (and b (< (first b) (first a))) b a))))
                     [[0 []]] (range 1 (inc n)))]
    ;; a span divided in parts is as many regions
    (vec (mapcat (fn [r] (or (:parts r) [r])) (second (peek best))))))

;; ───────── 3. the notes on the points ─────────

(defn- region-at [rs t] (first (filter (fn [r] (and (>= t (- (:s r) eps)) (< t (- (+ (:s r) (:L r)) eps)))) rs)))

(defn- snap [rs t]
  (if-let [r (region-at rs t)]
    (let [g (/ (:L r) (:n r))] (cv/round-to (+ (:s r) (* g (js/Math.round (/ (- t (:s r)) g)))) 9))
    t))

(defn- unit-at [rs t] (if-let [r (region-at rs t)] (/ (:L r) (:n r)) 1))

(defn- first-attrs [a first?] (if first? a (dissoc a :gliss :art :dyn :text)))

(defn- region-nodes
  "The nodes of the segments that fall in [a, b): notes, chords and rests, cut where the region cuts
   them (the piece before a cut is tied: :tie), with the grace notes before a segment's first piece.
   tup: written durations are the sounding ones × n/m."
  [a b tup segs graces]
  (vec (mapcat (fn [sg]
                 (let [x (max (:s sg) a) e (min (:e sg) b)]
                   (when (> e (+ x eps))
                     (let [;; written values live on a lattice of 1/128 beat (dyadic, or dotted)
                           wd (/ (js/Math.round (* 128 (if tup (* (- e x) (/ (first tup) (second tup))) (- e x)))) 128)
                           first? (near? x (:s sg))
                           tie? (and (:notes sg) (> (:e sg) (+ e eps)))
                           ns (:notes sg)]
                       (concat
                        (when (and first? ns)
                          (for [gn (get graces (cv/round-to (:s sg) 6))]
                            [:note (assoc (dissoc (:attrs gn) :gliss :dur) :grace true)]))
                        [(cond (nil? ns) [:rest {:dur wd}]
                               (= 1 (count ns)) [:note (cond-> (assoc (first-attrs (:attrs (first ns)) first?) :dur wd) tie? (assoc :tie true))]
                               :else (into [:chord (cond-> {:dur wd} tie? (assoc :tie true))]
                                           (for [n ns] [:note (first-attrs (:attrs n) first?)])))])))))
               segs)))

(defn- clean [notes]
  (vec (sort-by (juxt :on (fn [n] (- (or (mt/midi-of (:attrs n)) 0))))
                (filter (fn [n] (and (number? (:on n)) (number? (:off n)) (>= (:on n) 0) (> (:off n) (:on n)))) notes))))

(defn- legato
  "A note released just before the next one of its voice starts (less than :legato beats before it, and
   less than half the time between their starts) reaches it: a small gap is not a rest."
  [notes o]
  (let [ons (vec (distinct (map :on notes)))]
    (mapv (fn [n]
            (if-let [nx (first (filter (fn [t] (> t (+ (:on n) (:chord o)))) ons))]
              (let [gap (- nx (:off n))]
                (if (and (pos? gap) (< gap (:legato o)) (< gap (* 0.5 (- nx (:on n))))) (assoc n :off nx) n))
              n))
          notes)))

(defn separate
  "Notes in free time as voices that do not overlap (beyond :overlap beats): notes that start and end
   together stay together (a chord); each one goes to a voice that is free when it starts, the nearest in
   pitch to that voice's last note, or to a new one, up to :voices; past that, to the voice that ends
   first (whose last note it cuts). The highest voice first."
  [notes o]
  (let [notes (clean notes)
        pitch-of (fn [n] (or (mt/midi-of (:attrs n)) 60))
        mean (fn [ns] (/ (reduce + (map pitch-of ns)) (count ns)))
        together? (fn [a b] (and (< (js/Math.abs (- (:on a) (:on b))) (+ (:chord o) eps))
                                 (< (js/Math.abs (- (:off a) (:off b))) (max (:chord o) (* 0.25 (- (:off b) (:on b)))))))
        events (reduce (fn [evs n] (let [lst (peek evs)] (if (and lst (together? (first lst) n)) (conj (pop evs) (conj lst n)) (conj evs [n]))))
                       [] notes)
        vs (reduce (fn [vs ev]
                     (let [on (:on (first ev)) off (reduce max (map :off ev)) p (mean ev)
                           free (filter (fn [i] (<= (:end (vs i)) (+ on (:overlap o)))) (range (count vs)))
                           pick (cond (seq free) (apply min-key (fn [i] (+ (js/Math.abs (- p (:pitch (vs i)))) (* 0.01 i))) free)
                                      (< (count vs) (:voices o)) nil
                                      :else (apply min-key (fn [i] (:end (vs i))) (range (count vs))))]
                       (cond
                         ;; notes together while several voices are free: each to the nearest of them
                         (and (> (count ev) 1) (> (count free) 1))
                         (reduce (fn [vs [i ns]] (update vs i (fn [v] (-> v (assoc :end (reduce max (map :off ns)) :pitch (mean ns)) (update :notes into ns)))))
                                 vs (group-by (fn [n] (apply min-key (fn [i] (js/Math.abs (- (pitch-of n) (:pitch (vs i))))) free)) ev))
                         (nil? pick) (conj vs {:end off :pitch p :notes (vec ev)})
                         :else (update vs pick (fn [v] (-> v (assoc :end off :pitch p) (update :notes into ev)))))))
                   [] events)]
    (mapv :notes (sort-by (fn [v] (- (mean (:notes v)))) vs))))

(defn plan
  "How the bars are divided for all these notes together (every voice on the same points): the meter,
   its bars, and the regions [{:s :L :n :tup}] of every bar."
  [notes o]
  (let [meter (:meter o)
        {[p q] :meter} meter
        BL (* p (/ 4 q))
        maxoff (reduce max 0 (map :off notes))
        maxon (reduce max 0 (map :on notes))
        nbars (max 1 (js/Math.ceil (- (/ maxoff BL) eps)))
        ;; a last bar where nothing starts and the ends would go back to its start is not a bar
        nbars (let [b0 (* (dec nbars) BL) [_ L1] (first (spans meter))]
                (if (and (> nbars 1) (< maxon (- b0 eps)) (< (- maxoff b0) (* 0.5 L1))) (dec nbars) nbars))
        pts (vec (sort-by :t (mapcat (fn [i n] [{:t (:on n) :kind :on :note i} {:t (:off n) :kind :off :note i}]) (range) notes)))]
    {:meter meter :BL BL :nbars nbars :total (* nbars BL)
     :rs (vec (mapcat (fn [b] (let [b0 (* b BL)] (bar-plan b0 meter (points-in pts b0 (+ b0 BL)) o))) (range nbars)))}))

(defn write-voice
  "One voice's notes (already free of overlaps but for small ones, which are cut) written on a plan as a
   :voice of measures: chords where starts meet, rests in the gaps, ties over barlines and out of tuplets,
   grace notes for notes that shrink to nothing."
  [notes {:keys [meter BL nbars total rs]} o]
  (let [{[p q] :meter g :groups} meter
        qs (mapv (fn [n] (assoc n :qon (snap rs (:on n)) :qoff (min total (snap rs (:off n))))) notes)
        collapsed? (fn [n] (<= (:qoff n) (+ (:qon n) eps)))
        starts (set (map (fn [n] (cv/round-to (:qon n) 6)) (remove collapsed? qs)))
        grace? (fn [n] (and (:grace o) (collapsed? n) (contains? starts (cv/round-to (:qon n) 6))))
        graces (group-by (fn [n] (cv/round-to (:qon n) 6)) (filter grace? qs))
        real (->> qs (remove grace?)
                  (map (fn [n] (if (collapsed? n) (assoc n :qoff (min total (+ (:qon n) (unit-at rs (:qon n))))) n)))
                  (remove collapsed?))
        groups (sort-by key (group-by (fn [n] (cv/round-to (:qon n) 6)) real))
        sounding (map-indexed (fn [j [_ ns]]
                                (let [nxt (some-> (nth groups (inc j) nil) second first :qon)]
                                  {:s (:qon (first ns)) :e (min (or nxt js/Infinity) (reduce max (map :qoff ns)))
                                   :notes (vec (sort-by (fn [n] (mt/midi-of (:attrs n))) ns))}))
                              groups)
        segs (loop [ss sounding t 0 out []]
               (if (empty? ss)
                 (if (< t (- total eps)) (conj out {:s t :e total}) out)
                 (let [sg (first ss)]
                   (recur (rest ss) (:e sg) (cond-> out (> (:s sg) (+ t eps)) (conj {:s t :e (:s sg)}) true (conj sg))))))
        bar-attrs (cond-> {:meter [p q]} (seq g) (assoc :groups (vec g)) (some? (:key o)) (assoc :key (:key o)))]
    (into [:voice {}]
          (for [b (range nbars)
                :let [b0 (* b BL)
                      ;; a tuplet only for a voice that starts or ends something inside it (a note of
                      ;; this voice held through another voice's triplet is not written in a triplet)
                      inside? (fn [r] (some (fn [x] (< (+ (:s r) eps) x (- (+ (:s r) (:L r)) eps))) (mapcat (juxt :s :e) segs)))
                      regs (mapv (fn [r] (if (and (:tup r) (not (inside? r))) (assoc r :tup nil) r))
                                 (filterv (fn [r] (and (>= (:s r) (- b0 eps)) (< (:s r) (- (+ b0 BL) eps)))) rs))
                      ;; plain regions next to each other are written together; a tuplet on its own
                      runs (reduce (fn [acc r]
                                     (let [lst (peek acc)]
                                       (if (and lst (nil? (:tup lst)) (nil? (:tup r)))
                                         (conj (pop acc) (update lst :L + (:L r)))
                                         (conj acc (select-keys r [:s :L :tup])))))
                                   [] regs)]]
            (into [:measure (if (zero? b) bar-attrs {})]
                  (mapcat (fn [{:keys [s L tup]}]
                            (let [ns (region-nodes s (+ s L) tup segs graces)]
                              (if tup [(into [:tuplet {:ratio tup}] ns)] ns)))
                          runs))))))

(defn- voices-of-notes [notes o] (mapv (fn [ns] (legato ns o)) (let [ss (separate notes o)] (if (seq ss) ss [[]]))))

(defn notes->voices
  "Notes in free time ({:on :off :attrs}, beats; :attrs those of the :note each becomes) as voices of
   measures, quantized with the options o (see `options`): separated where they overlap (at most
   :voices), all on one plan, the voices after the first as layers of its staff. nm names them."
  ([notes o] (notes->voices notes o nil))
  ([notes o nm]
   (let [vs (voices-of-notes notes o)
         pl (plan (vec (apply concat vs)) o)
         staff (or nm "voice 1")]
     (vec (map-indexed (fn [i ns]
                         (let [v (write-voice ns pl o)]
                           (cond
                             (= 1 (count vs)) (if nm (mt/update-attrs v assoc :name nm) v)
                             :else (mt/update-attrs v assoc
                                                    :name (if (and nm (zero? i)) nm (str (or nm "voice") " " (inc i)))
                                                    :staff staff))))
                       vs)))))

(defn notes->voice
  "Notes in free time as one voice of measures (overlapping notes are cut where the next one starts)."
  [notes o]
  (first (notes->voices notes (assoc o :voices 1))))

;; ───────── choosing another division (stage 6) ─────────

(defn choices
  "How the beat (or group) that holds beat t can be divided, for these notes in free time: {:s its start
   :pair the start of the two beats it can go with (or nil) :current the division the plan gives it
   :all [the current one, then the others, cheapest first]}. A division is n, [n1 n2] (in parts) or
   [:merge n] (with the next beat)."
  [notes o t]
  (let [all-notes (vec (apply concat (voices-of-notes notes o)))
        {:keys [rs BL meter]} (plan all-notes o)
        current-in (fn [rs s L]
                     (let [here (filterv (fn [r] (and (> (+ (:s r) (:L r)) (+ s eps)) (< (:s r) (- (+ s L) eps)))) rs)]
                       (cond (and (= 1 (count here)) (near? (:L (first here)) L)) (:n (first here))
                             (and (= 1 (count here)) (> (:L (first here)) (+ L eps))) [:merge (:n (first here))]
                             :else (mapv :n here))))
        pts (vec (mapcat (fn [i n] [{:t (:on n) :kind :on :note i} {:t (:off n) :kind :off :note i}]) (range) all-notes))
        {[_ q] :meter g :groups} meter
        b0 (* BL (js/Math.floor (/ (+ t eps) BL)))
        sps (mapv (fn [[s L u]] [(+ b0 s) L u]) (spans meter))
        i (or (first (keep-indexed (fn [i [s L]] (when (and (>= t (- s eps)) (< t (- (+ s L) eps))) i)) sps)) 0)
        [s L u] (sps i)
        simple? (and (<= q 4) (empty? g))
        pair (when simple? (cond (and (even? i) (< (inc i) (count sps)) (near? L (second (sps (inc i))))) i
                                 (and (odd? i) (near? L (second (sps (dec i))))) (dec i)))
        in (points-in pts s (+ s L))
        ;; divisions that put the notes on other points (6 places a triplet where 3 does: it is not another choice)
        flat (->> (span-options s L u in o false)
                  (reduce (fn [[seen out] x]
                            (let [g (/ L (:n x)) k (mapv (fn [p] (cv/round-to (* g (js/Math.round (/ (- (:t p) s) g))) 6)) in)]
                              (if (contains? seen k) [seen out] [(conj seen k) (conj out (:n x))])))
                          [#{} []])
                  second (take 5))
        nested (let [x (best-of-span s L u pts (assoc o :nest true))] (when (:parts x) [(mapv :n (:parts x))]))
        merged (when pair
                 (let [[ps pL pu] (sps pair)]
                   (map (fn [x] [:merge (:n x)])
                        (take 2 (span-options ps (* 2 pL) (* 2 pu) (points-in pts ps (+ ps pL pL)) (assoc o :merge [3 5 6]) true)))))
        current (current-in rs s L)
        ;; the order does not depend on what was chosen: the quantizer's own choice first
        free-o (update o :fix (fn [f] (into {} (remove (fn [[x _]] (or (near? x s) (and pair (near? x (first (sps pair)))))) f))))
        own (current-in (:rs (plan all-notes free-o)) s L)
        all (vec (distinct (concat [own] flat nested merged)))]
    {:s s :pair (when pair (first (sps pair))) :current current
     :all (if (some #{current} all) all (conj all current))}))

(defn next-choice
  "The next way to divide the beat that holds t (see `choices`), as the options with that choice in
   their :fix: {:choice c :s span-start :opts opts'}. opts are the options as they are kept (with :fix)."
  [notes opts gx t]
  (let [{:keys [s pair current all]} (choices notes (options opts gx) t)
        c (nth all (mod (inc (max 0 (.indexOf all current))) (count all)))
        k (if (merge-choice? c) pair s)
        fix (into {} (remove (fn [[x _]] (or (near? x s) (and pair (near? x pair)))) (:fix opts)))]
    {:choice c :s k :opts (assoc (if (map? opts) opts {}) :fix (assoc fix k c))}))

;; ───────── what is quantized ─────────

(defn strokes->notes
  "The strokes of a freqt as notes in free time: each one a note at the pitch of its first point (with
   decimals when it is between semitones), its bends a :gliss, as mt/<-strokes reads them."
  [d]
  (vec (for [[_ s] (cv/sorted-strokes d)
             :let [pts (:pts s) [t0 f0] (first pts) [t1 _] (peek pts)
                   m (cv/hz->midi f0) mr (js/Math.round m)
                   dur (max 0.01 (- t1 t0))
                   gl (mapv (fn [[t f]] [(cv/round-to (/ (- t t0) dur) 3) (+ 0 (cv/round-to (cv/hz->cents f (cv/midi->hz mr)) 1))]) pts)
                   flat? (every? (fn [[_ c]] (< (js/Math.abs (- c (second (first gl)))) 1)) gl)]]
         ;; numbers: the names are chosen afterwards, all together (mt/spell, issue #88)
         {:on t0 :off (+ t0 dur)
          :attrs (cond-> {:pitch (if (< (js/Math.abs (- m mr)) 0.02) mr (cv/round-to m 2))}
                   (not flat?) (assoc :pitch mr :gliss gl))})))

(defn quantize
  "A freqt's buffer as a measured tree (a :voice of :measure nodes), with options (see the top of this
   file); its meter comes from the buffer's bar grid unless :meter is given."
  ([d] (quantize d {}))
  ([d opts]
   (let [o (options opts (:gx d))]
     (let [vs (notes->voices (strokes->notes d) o)
           t (if (= 1 (count vs)) (first vs) (into [:par {}] vs))]
       (respell-by-hand (mt/spell (cond-> t (:tempo opts) (mt/update-attrs assoc :tempo (:tempo opts)))) (:spell o))))))

(defn quantize-tree
  "A tree without measures (notes placed in free time, with :at or durations of any size) as a measured
   tree: each of its voices quantized on its own, in the meter of the options (4/4 by default)."
  ([tree] (quantize-tree tree {}))
  ([tree opts]
   (let [o (options opts nil)
         xt (mt/expand tree)
         evs (filter (fn [e] (= :note (:kind e))) (mt/events xt))
         by-voice (sort-by key (group-by (fn [e] (or (:voice e) "")) evs))
         voices (fn [[nm es]]
                  (notes->voices (for [e es :when (not (:grace e))]
                                   {:on (:t e) :off (+ (:t e) (:dur e))
                                    :attrs (merge (select-keys e [:art :dyn :text :vel :env :gliss])
                                                  ;; a written name stays (with its :cents); numbers are spelled afterwards
                                                  (let [a (mt/attrs (mt/node-at xt (:path e))) w (mt/spelling-of a)]
                                                    (if w
                                                      (cond-> {:pitch (sp/->name w)} (:cents a) (assoc :cents (:cents a)))
                                                      {:pitch (if (whole? (:pitch e)) (js/Math.round (:pitch e)) (cv/round-to (:pitch e) 2))})))})
                                 o (when (seq nm) nm)))
         vs (vec (mapcat voices by-voice))
         t (if (> (count vs) 1) (into [:par {}] vs) (or (first vs) (notes->voice [] o)))]
     (mt/spell (mt/update-attrs t assoc :tempo (or (:tempo opts) (mt/tempo-of tree)))))))

(defn ->score
  "MEI for a score: a measured tree as it is, a tree without measures quantized, a freqt's buffer
   quantized. Returns {:mei :pieces} (see mt/->mei)."
  ([x pre] (->score x pre {}))
  ([x pre opts]
   (cond
     (and (mt/tree? x) (mt/measured? x)) (mt/->mei x pre)
     (mt/tree? x) (mt/->mei (quantize-tree x opts) pre)
     :else (mt/->mei (quantize x opts) pre))))
