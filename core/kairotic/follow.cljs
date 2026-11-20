;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · follow: where a performer is in a tree, from the notes heard (discussion #204, Study 52's Follower)
;;
;; Time advances by occasion, not by the clock: each note heard is matched with a note of the tree a little ahead of
;; where the performer was, by its pitch and by when it was expected. What it finds:
;;   :at    where the performer is: the note (its :id, its index) and its written beat
;;   :wire  a wire reached (written on its note, [:note {… :wire {:send x …}}], discussion #217), what it sends:
;;          rigid  on its note ("on the note"), or, if the note was passed over, at the next note found ("caught up");
;;                 never before its note, never twice
;;          elastic at its note if the performer gets there in time; else on its own at the time the note was expected
;;                 (at the performer's tempo) plus its tolerance ("went on"); led by the electronics (:leader
;;                 :electronics), at that time whatever the performer does ("led")
;; and, kept as it goes, a take (kairotic.mei): where each note it heard was played, in seconds from the start of
;; the piece (the first note found played at its written time).
;;
;; Pure: the state is a map, each note heard returns the new state and what it found. The follow box
;; (@kairotic/analysis) cuts what pitch~ and onset~ hear into notes and calls these through the API.

(ns kairotic.follow
  (:require [kairotic.continuum :as ct]))

(def defaults
  {:ahead 4        ; how many notes ahead of the next expected a note heard may be (the rest are skipped)
   :band 0.6       ; semitones: how far from a written pitch a note heard still is that note
   :octave true})  ; an octave off (a pitch tracker's usual error) still counts, at a cost

(defn score
  "The notes a tree is followed by: its first voice's sounds, in order ({:id :midi :ws :wd :beat :wire})."
  [tree]
  (mapv (fn [e] (select-keys e [:id :midi :ws :wd :beat :wire :name :rest])) (ct/events tree)))

(defn wires
  "The wires of a score, from its notes' :wire ({:send x :kind :rigid|:elastic :tol s :leader :performer|:electronics},
   or a vector of them), each on the index of its note: {:id (the note's, /k for its k-th) :note i :kind :leader :tol
   :send}."
  [evs]
  (vec (mapcat (fn [i e]
                 (let [ws (ct/note-wires (:wire e)) kw (fn [x d] (if (some? x) (keyword (name x)) d))]
                   ;; a rest's wires (an event of the electronics) have no note to wait for: led, at their time
                   (map-indexed (fn [k w] {:id (str (:id e) (when (> (count ws) 1) (str "/" k))) :note i
                                           :kind (if (:rest e) :elastic (kw (:kind w) :rigid))
                                           :leader (if (:rest e) :electronics (kw (:leader w) :performer))
                                           :tol (or (:tol w) 0) :send (:send w)})
                                ws)))
               (range) evs)))

(defn start
  "A follower at the beginning of a score. opts: :ahead :band :octave, :wires (by default its notes')."
  ([evs] (start evs {}))
  ([evs opts]
   (let [ws (vec (or (:wires opts) (wires evs)))]
     (merge defaults (dissoc opts :wires)
            {:evs (vec evs) :next 0 :played {} :order [] :rate 1 :t0 nil :last nil :extra 0
             :wires ws :pending (set (map :id ws))}))))

(defn- dist
  "How far a pitch heard is from a written one, in semitones, if it may be that note: [d octave?], or nil."
  [heard written band octave?]
  (let [d (js/Math.abs (- heard written))
        o (js/Math.abs (- (mod (+ (- heard written) 6) 12) 6))]
    (cond (<= d band) [d false]
          (and octave? (<= o band) (<= d 24.6)) [o true]
          :else nil)))

(defn expected
  "When note j is expected, in the performer's seconds: from the last note found before it, at the rate the
   performer goes (the note itself, if it was heard, does not count)."
  [st j]
  (let [e (get-in st [:evs j])
        i (last (filter #(< % j) (:order st)))]
    (if i
      (+ (first (get-in st [:played (get-in st [:evs i :id])])) (* (:rate st) (- (:ws e) (get-in st [:evs i :ws]))))
      (+ (or (:t0 st) 0) (:ws e)))))

(defn- due
  "When a pending elastic wire goes on without its note (nil for a rigid one)."
  [st w]
  (when (= :elastic (:kind w))
    (+ (expected st (:note w)) (if (= :electronics (:leader w)) 0 (:tol w 0)))))

(defn- fire [st w at status]
  [(update st :pending disj (:id w))
   [:wire {:send (:send w) :wire (:id w) :id (get-in st [:evs (:note w) :id]) :i (:note w) :t at :status status
          :kind (:kind w) :leader (:leader w)}]])

(defn tick
  "Time passes until t: the elastic wires due by then go on (each at its own time). → [state found]."
  [st t]
  (reduce (fn [[st found] w]
            (let [d (and (contains? (:pending st) (:id w)) (due st w))]
              (if (and d (<= d t))
                (let [[st f] (fire st w d (if (= :electronics (:leader w)) "led" "went on"))] [st (conj found f)])
                [st found])))
          [st []] (:wires st)))

(defn next-due
  "When the next pending elastic wire would go on by itself, or nil."
  [st]
  (let [ds (keep (fn [w] (when (contains? (:pending st) (:id w)) (due st w))) (:wires st))]
    (when (seq ds) (reduce min ds))))

(defn- candidates [st t midi]
  (let [{:keys [evs next ahead band octave]} st
        ;; the next `ahead` notes (a rest with a wire is no note: it is not heard)
        js (take ahead (filter #(not (:rest (get evs %))) (range next (count evs))))]
    (for [[n j] (map-indexed vector js)
          :let [e (get evs j) [d oct] (dist midi (:midi e) band octave)]
          :when d]
      ;; the cost: the notes it would skip, how far it is in pitch (an octave off costs more), how far from when it
      ;; was expected (in its own written length, so that a short note expected late weighs as much as a long one)
      [(+ n (* 0.5 d) (if oct 0.75 0)
          (if (:last st) (/ (js/Math.abs (- t (expected st j))) (max 0.25 (* 2 (:wd e)))) 0))
       j])))

(defn hear
  "A note heard at t (seconds) at midi (with decimals). → [state found], found a vector of [:at {…}] and
   [:wire {…}] (the wires that went on): nothing if it is not a note of the score near where the performer is (a
   wrong note, an ornament) — but the elastic wires due by then."
  [st t midi]
  (let [[st early] (tick st t)
        cs (candidates st t midi)]
    (if (empty? cs)
      [(update st :extra inc) early]
      (let [j (second (first (sort-by first cs)))
            e (get-in st [:evs j])
            t0 (or (:t0 st) (- t (:ws e)))
            ;; the rate: written seconds into played ones, held between ½ and 2 (over the last four notes found: the
            ;; performer's tempo changes)
            rate (if-let [[i0 tf] (when-let [i (first (take-last 4 (:order st)))] [i (first (get-in st [:played (get-in st [:evs i :id])]))])]
                   (let [dw (- (:ws e) (get-in st [:evs i0 :ws])) dp (- t tf)]
                     (if (> dw 0.2) (max 0.5 (min 2 (/ dp dw))) (:rate st)))
                   1)
            st2 (-> st
                    (assoc :t0 t0 :next (inc j) :last [j t] :rate rate)
                    (update :played assoc (:id e) [t nil])
                    (update :order conj j))
            ;; the wires up to this note: its own on the note (but one the electronics lead: that keeps its time), the
            ;; rigid ones passed over caught up here, the elastic ones passed over gone on
            [st3 found] (reduce (fn [[st found] w]
                                  (cond
                                    (not (contains? (:pending st) (:id w))) [st found]
                                    (> (:note w) j) [st found]
                                    (and (= (:note w) j) (= :elastic (:kind w)) (= :electronics (:leader w))) [st found]
                                    (= (:note w) j) (let [[st f] (fire st w t "on the note")] [st (conj found f)])
                                    (= :rigid (:kind w)) (let [[st f] (fire st w t "caught up")] [st (conj found f)])
                                    :else (let [[st f] (fire st w (min t (or (due st w) t)) (if (= :electronics (:leader w)) "led" "went on"))] [st (conj found f)])))
                                [st2 []] (:wires st2))]
        [st3 (vec (concat early [[:at {:id (:id e) :i j :beat (:beat e) :t t :skipped (count (remove #(:rest (get-in st [:evs %])) (range (:next st) j)))}]] found))]))))

(defn release
  "The note found last stopped sounding at t: its length is kept in the take."
  [st t]
  (if-let [[j t1] (:last st)]
    (let [id (get-in st [:evs j :id])]
      (if (and (get-in st [:played id]) (nil? (second (get-in st [:played id]))) (> t t1))
        (assoc-in st [:played id 1] (- t t1))
        st))
    st))

(defn take-of
  "What was followed, as a take ({:id :when {note-id [onset dur]}} and what is given in m: :name :made :audio),
   onsets in seconds from the start of the piece; nil if no note was found."
  [st m]
  (when (seq (:played st))
    (let [t0 (:t0 st) r3 (fn [x] (when (number? x) (/ (js/Math.round (* 1000 x)) 1000)))]
      (merge (select-keys m [:name :made :audio])
             {:id (:id m)
              :when (into {} (for [[id [t d]] (:played st) :when id] [id [(r3 (- t t0)) (r3 d)]]))}))))

(defn follow
  "Offline: a performance ([[t midi dur] …], seconds) followed through a score → {:found [...] :take take :state st}."
  [evs performance & [opts]]
  (loop [st (start evs opts) [[t m d] & more] performance found []]
    (if (nil? t)
      ;; the end: the elastic wires still pending go on at their time
      (let [[st f] (tick st js/Infinity)]
        {:found (into found f) :state st :take (take-of st {:id (or (:id opts) "followed")})})
      (let [[st2 f] (hear st t m)
            st2 (if (and d (seq f)) (release st2 (+ t d)) st2)]
        (recur st2 more (into found f))))))
