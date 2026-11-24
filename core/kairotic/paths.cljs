;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · paths: open form — a work of fragments and rules of succession, the performer choosing the path, and
;; the follower deciding it (discussion #212, Study 70)
;;
;; The work is a tree:
;;   [:open {:name "XI" :start :any :end {:repeat 3} :tempo 72}
;;    [:frag {:id :A :next :any :not #{:A} :near 6 :then {:tempo 1.5 :dyn "pp" :touch "staccato"}} …notes…]
;;    [:frag {:id :Z :final true} …]]
;; :start :any or a set of ids; :end {:repeat n} (a fragment come a n-th time ends it, as in Klavierstück XI),
;; {:after n} (n fragments), or a fragment's :final; :next :any or a set; :not a set; :near n (the next at most n swaps
;; away, the rhythms as necklaces of 16 pulses, a pulse a sixteenth); :then how the next fragment is played (:tempo a
;; factor of the work's, :dyn, :touch).
;;
;; A performance is a path (ids). What can come next are the form's futuribles (choices); a fragment heard is
;; recognised among them by its opening (recognize: each a hypothesis, the alignment of its pitches with what is
;; heard, wrong, missed and added notes allowed); once a performance is over it is read again whole (decode).
;;
;; Pure. The paths box (@kairotic/analysis) holds a work and a performance and calls these through the API.

(ns kairotic.paths
  (:require [kairotic.mt :as mt]))

;; ───────── the work, from its tree ─────────

(defn- kw [x] (cond (keyword? x) x (string? x) (keyword x) :else x))
(defn- kws [x] (if (or (= x :any) (= x "any") (nil? x)) x (set (map kw x))))

(defn open?
  "Is x the tree of an open work?" [x]
  (and (vector? x) (= :open (first x))))

(defn work
  "An open work from its tree: {:name :start :end :tempo :first :frags [{:id :next :not :near :then :final :tree
   :notes [{:t :dur :pitch} …] :midi [pitches in time order] :pulses}]}."
  [tree]
  (let [a (if (map? (second tree)) (second tree) {})
        kids (filter (fn [x] (and (vector? x) (= :frag (first x)))) (drop (if (map? (second tree)) 2 1) tree))]
    {:name (:name a) :tempo (or (:tempo a) 72) :start (kws (or (:start a) :any)) :end (:end a)
     :first (merge {:tempo 1 :dyn "mf" :touch "normal"} (:first a))
     :frags (vec (map-indexed
                  (fn [i f]
                    (let [fa (if (map? (second f)) (second f) {})
                          body (into [:seq] (drop (if (map? (second f)) 2 1) f))
                          ns (mt/notes body)]
                      (cond-> {:id (kw (or (:id fa) (keyword (str "F" (inc i))))) :tree body
                               :notes (mapv (fn [e] (select-keys e [:t :dur :pitch])) ns)
                               :midi (mapv :pitch ns)
                               :pulses (vec (sort (distinct (map (fn [e] (mod (js/Math.round (* 4 (:t e))) 16)) ns))))}
                        (some? (:next fa)) (assoc :next (kws (:next fa)))
                        (some? (:not fa)) (assoc :not (kws (:not fa)))
                        (number? (:near fa)) (assoc :near (:near fa))
                        (map? (:then fa)) (assoc :then (:then fa))
                        (:final fa) (assoc :final true))))
                  kids))}))

(defn frag [w id] (first (filter #(= (:id %) (kw id)) (:frags w))))
(defn ids [w] (mapv :id (:frags w)))

;; ───────── rhythm as geometry: a fragment's onsets on a cycle of 16 pulses ─────────

(defn swap-distance
  "Moving onsets to neighbouring pulses, one swap a step, the least over the rotations of b (a necklace); nil when
   they have not as many onsets."
  ([a b] (swap-distance a b 16))
  ([a b n]
   (when (= (count a) (count b))
     (apply min (for [r (range n)]
                  (let [rb (sort (map #(mod (+ % r) n) b))]
                    (reduce + (map (fn [x y] (js/Math.abs (- x y))) a rb))))))))

(defn rhythm-distance
  "Between two fragments' rhythms: their swap distance, or (not as many onsets) the pulses where one strikes and the
   other not, the least over rotations."
  [fa fb]
  (let [a (:pulses fa) b (:pulses fb)]
    (or (swap-distance a b)
        (apply min (for [r (range 16)]
                     (let [B (set (map #(mod (+ % r) 16) b)) A (set a)]
                       (+ (count (remove B a)) (count (remove A B)))))))))

;; ───────── the form ─────────

(defn done?
  "Has the performance ended?" [w path]
  (boolean
   (when (seq path)
     (let [e (:end w)]
       (or (and (:repeat e) (>= (apply max (vals (frequencies path))) (:repeat e)))
           (and (:after e) (>= (count path) (:after e)))
           (:final (frag w (peek (vec path)))))))))

(defn choices
  "The fragments that can come next (ids, in the work's order); [] when the performance has ended."
  [w path]
  (cond
    (done? w path) []
    (empty? path) (let [s (:start w)] (if (set? s) (filterv s (ids w)) (ids w)))
    :else
    (let [last-f (frag w (peek (vec path)))
          nx (:next last-f)]
      (cond->> (if (set? nx) (filterv nx (ids w)) (ids w))
        (:not last-f) (filterv (complement (:not last-f)))
        (:near last-f) (filterv (fn [id] (<= (rhythm-distance last-f (frag w id)) (:near last-f))))))))

(defn legal?
  "Is a path one the work allows?" [w path]
  (let [p (vec path)]
    (every? (fn [i] (some #{(p i)} (choices w (subvec p 0 i)))) (range (count p)))))

(defn draw
  "A performance drawn at random (r: a function giving a number in [0, 1)), at most mx fragments."
  ([w] (draw w js/Math.random 64))
  ([w r mx]
   (loop [p []]
     (let [cs (choices w p)]
       (if (or (empty? cs) (>= (count p) mx)) p (recur (conj p (nth cs (js/Math.floor (* (r) (count cs)))))))))))

(defn indications
  "How the next fragment is played after a path: {:tempo :dyn :touch}, the work's first ones and each :then since."
  [w path]
  (reduce (fn [ind id] (merge ind (:then (frag w id)))) (:first w) path))

(defn fragment-tree
  "The fragment as a tree to play, with the indications the path before it left: a voice at the work's tempo times
   theirs, its dynamic written first, its touch an attribute."
  [w path id]
  (let [ind (indications w path) f (frag w id)]
    (into [:voice {:name (name id) :tempo (* (:tempo w) (or (:tempo ind) 1)) :touch (:touch ind)}
           [:dyn {:mark (or (:dyn ind) "mf")}]]
          (rest (:tree f)))))

(defn fragment-seconds
  "How long a fragment lasts played after a path, in seconds." [w path id]
  (let [ind (indications w path)]
    (/ (* 60 (mt/duration (:tree (frag w id)))) (* (:tempo w) (or (:tempo ind) 1)))))

(defn realize
  "A path as one tree to play: its fragments one after the other, each with the indications the one before left."
  [w path]
  (into [:seq {:name (or (:name w) "paths")}]
        (map-indexed (fn [i id] (fragment-tree w (subvec (vec path) 0 i) id)) path)))

;; ───────── following: which fragment is being played ─────────

(defn- sub [a b]
  (let [d (js/Math.abs (- a b))]
    (cond (zero? d) 0 (zero? (mod d 12)) 0.6 :else (min 1.2 (+ 0.5 (/ d 12))))))

(defn align
  "The cost of the best alignment of everything heard (MIDI) with an opening of ref; heard beyond ref's end costs
   `beyond` a note (the next fragment's, not known yet), so a short fragment and a long one are judged on the same notes."
  ([heard ref] (align heard ref 0.4))
  ([heard ref beyond]
   (let [n (count heard) m (count ref) heard (vec heard) ref (vec ref)]
     (loop [i 1 prev (vec (range (inc m))) at-end (+ m (* beyond n))]
       (if (> i n)
         (apply min at-end (subvec prev 0 m))
         (let [cur (reduce (fn [cur j] (conj cur (min (+ (prev (dec j)) (sub (heard (dec i)) (ref (dec j))))
                                                       (inc (prev j)) (inc (cur (dec j))))))
                           [i] (range 1 (inc m)))]
           (recur (inc i) cur (min at-end (+ (cur m) (* beyond (- n i)))))))))))

(defn end-costs
  "The costs of all of ref's notes aligned with every beginning of what is heard: [cost for i notes heard]."
  [heard ref]
  (let [heard (vec heard) n (count heard)]
    (reduce (fn [col r]
              (reduce (fn [nx i] (conj nx (min (+ (col (dec i)) (sub (heard (dec i)) r)) (inc (col i)) (inc (nx (dec i))))))
                      [(inc (first col))] (range 1 (inc n))))
            (vec (range (inc n))) ref)))

(defn consumed
  "How many of the notes heard a fragment's notes took: the cheapest end, on a tie the nearest to as many as it has."
  [heard ref]
  (let [cs (end-costs heard ref) m (count ref)]
    (first (sort-by (fn [i] [(cs i) (js/Math.abs (- i m))]) (range (count cs))))))

(defn recognize
  "Which of the fragments that can come next is being played, from the pitches heard since the last one ended:
   [{:id :cost :p} …] best first — p a softmax of the costs at temperature temp."
  ([w path heard] (recognize w path heard 0.35))
  ([w path heard temp]
   (let [cs (choices w path)]
     (if (or (empty? cs) (empty? heard))
       (mapv (fn [id] {:id id :cost 0 :p (/ 1 (max 1 (count cs)))}) cs)
       (let [scored (mapv (fn [id] {:id id :cost (align heard (:midi (frag w id)))}) cs)
             lo (apply min (map :cost scored))
             ws (map (fn [x] (js/Math.exp (- (/ (- (:cost x) lo) temp)))) scored)
             z (reduce + ws)]
         (vec (sort-by :cost (map (fn [x wt] (assoc x :p (/ wt z))) scored ws))))))))

;; A performance followed live: the state {:path :heard (since the fragment that sounds began) :decided (its id, once
;; sure) :all (every note heard)}; each note heard moves it on.

(defn follow-start [] {:path [] :heard [] :decided nil :all [] :decisions []})

(defn hear
  "A note heard (MIDI) → [state found]: found [[:frag id {:after n :p p}] …] when a fragment is recognised (it sure,
   p ≥ sure, or the only one that can come, or heard longer than any could be)."
  ([w st m] (hear w st m 0.9))
  ([w st m sure]
   (loop [st (-> st (update :heard conj m) (update :all conj m)) found []]
     (cond
       (done? w (:path st)) [st found]
       ;; the fragment that sounds is known: has it ended? (two notes it does not account for: the next has begun)
       (:decided st)
       (let [h (:heard st) c (consumed h (:midi (frag w (:decided st))))]
         (if (>= (- (count h) c) 2)
           (recur (assoc st :heard (subvec h c) :decided nil) found)
           [st found]))
       :else
       (let [cs (choices w (:path st))
             most (inc (apply max 0 (map #(count (:midi (frag w %))) cs)))
             h (:heard st)
             r (recognize w (:path st) h)
             best (first r)]
         (if (and best (or (>= (:p best) sure) (= 1 (count cs)) (>= (count h) most)))
           (recur (-> st (update :path conj (:id best)) (assoc :decided (:id best))
                      (update :decisions conj {:id (:id best) :after (count h) :p (:p best)}))
                  (conj found [:frag (:id best) {:after (count h) :p (:p best)}]))
           [st found]))))))

(defn decode
  "A whole performance read again once it is over (the notes heard, MIDI): the path the work allows whose fragments,
   one after another, best account for every note — a beam of the best readings at each point of the performance.
   → {:path :cost}."
  ([w heard] (decode w heard {}))
  ([w heard {:keys [beam ends] :or {beam 16 ends 3}}]
   (let [H (vec heard) N (count H)
         frag-midi (into {} (map (fn [f] [(:id f) (:midi f)]) (:frags w)))]
     (loop [k 0 at {0 [{:path [] :cost 0}]} best nil]
       (if (> k N)
         best
         (let [here (take beam (sort-by :cost (get at k)))
               best (reduce (fn [b h] (let [c (+ (:cost h) (- N k) (if (done? w (:path h)) 0 1.5))]
                                        (if (or (nil? b) (< c (:cost b))) {:path (:path h) :cost c} b)))
                            best here)
               at (if (= k N)
                    at
                    (reduce (fn [at h]
                              (reduce (fn [at id]
                                        (let [ps (frag-midi id)
                                              cs (end-costs (subvec H k (min N (+ k (* 2 (count ps)) 2))) ps)
                                              top (take ends (sort-by (fn [i] [(cs i) (js/Math.abs (- i (count ps)))]) (range 1 (count cs))))]
                                          (reduce (fn [at i] (update at (+ k i) (fnil conj []) {:path (conj (:path h) id) :cost (+ (:cost h) (cs i))}))
                                                  at top)))
                                      at (choices w (:path h))))
                            at here))]
           (recur (inc k) (dissoc at k) best)))))))

;; ───────── the performances ─────────

(defn path-distance
  "The fragments to change, add or leave out to make one performance the other." [a b]
  (let [a (vec a) b (vec b)]
    (peek (reduce (fn [prev i]
                    (reduce (fn [cur j] (conj cur (min (+ (prev (dec j)) (if (= (a (dec i)) (b (dec j))) 0 1)) (inc (prev j)) (inc (cur (dec j))))))
                            [i] (range 1 (inc (count b)))))
                  (vec (range (inc (count b)))) (range 1 (inc (count a)))))))

(defn branches
  "The performances (paths) as a tree of branches: {:id :n :children}; a common beginning one branch." [paths]
  (letfn [(grow [node p]
            (if (empty? p)
              node
              (let [id (first p) cs (:children node)
                    i (first (keep-indexed (fn [i c] (when (= (:id c) id) i)) cs))
                    c (if i (cs i) {:id id :n 0 :children []})
                    c (grow (update c :n inc) (rest p))]
                (assoc node :children (if i (assoc cs i c) (conj cs c))))))]
    (reduce grow {:id nil :n (count paths) :children []} paths)))
