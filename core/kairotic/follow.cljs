;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · follow: where a performer is in a tree, from the notes heard (discussion #204, Study 52's Follower)
;;
;; Time advances by occasion, not by the clock: each note heard is matched with a note of the tree a little ahead of
;; where the performer was, by its pitch and by when it was expected. What it finds:
;;   :at    where the performer is: the note (its :id, its index) and its written beat
;;   :cue   a note with a :cue (any value) reached: played ("on the note"), or passed over and caught up at a later
;;          note ("caught up") — what is to happen there happens once, never twice, never before
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
  "The notes a tree is followed by: its first voice's sounds, in order ({:id :midi :ws :wd :beat :cue})."
  [tree]
  (mapv (fn [e] (select-keys e [:id :midi :ws :wd :beat :cue :name])) (ct/events tree)))

(defn start
  "A follower at the beginning of a score. opts: :ahead :band :octave."
  ([evs] (start evs {}))
  ([evs opts]
   (merge defaults opts
          {:evs (vec evs) :next 0 :played {} :order [] :rate 1 :t0 nil :last nil :extra 0 :cued #{}})))

(defn- dist
  "How far a pitch heard is from a written one, in semitones, if it may be that note: [d octave?], or nil."
  [heard written band octave?]
  (let [d (js/Math.abs (- heard written))
        o (js/Math.abs (- (mod (+ (- heard written) 6) 12) 6))]
    (cond (<= d band) [d false]
          (and octave? (<= o band) (<= d 24.6)) [o true]
          :else nil)))

(defn expected
  "When note j is expected, in the performer's seconds: from the last note found, at the rate the performer goes."
  [st j]
  (let [e (get-in st [:evs j])]
    (if-let [[i t] (:last st)]
      (+ t (* (:rate st) (- (:ws e) (get-in st [:evs i :ws]))))
      (:ws e))))

(defn- candidates [st t midi]
  (let [{:keys [evs next ahead band octave]} st
        hi (min (count evs) (+ next ahead))]
    (for [j (range next hi)
          :let [e (get evs j) [d oct] (dist midi (:midi e) band octave)]
          :when d]
      ;; the cost: the notes it would skip, how far it is in pitch (an octave off costs more), how far from when it
      ;; was expected (in its own written length, so that a short note expected late weighs as much as a long one)
      [(+ (- j next) (* 0.5 d) (if oct 0.75 0)
          (if (:last st) (/ (js/Math.abs (- t (expected st j))) (max 0.25 (* 2 (:wd e)))) 0))
       j])))

(defn hear
  "A note heard at t (seconds) at midi (with decimals). → [state found], found a vector of [:at {…}] and
   [:cue {…}]: nothing if it is not a note of the score near where the performer is (a wrong note, an ornament)."
  [st t midi]
  (let [cs (candidates st t midi)]
    (if (empty? cs)
      [(update st :extra inc) []]
      (let [j (second (first (sort-by first cs)))
            e (get-in st [:evs j])
            t0 (or (:t0 st) (- t (:ws e)))
            ;; the rate: written seconds into played ones, from the first note found to this one, held between ½ and 2
            ;; (over the last four notes found: the performer's tempo changes)
            rate (if-let [[i0 tf] (when-let [i (first (take-last 4 (:order st)))] [i (first (get-in st [:played (get-in st [:evs i :id])]))])]
                   (let [dw (- (:ws e) (get-in st [:evs i0 :ws])) dp (- t tf)]
                     (if (> dw 0.2) (max 0.5 (min 2 (/ dp dw))) (:rate st)))
                   1)
            st2 (-> st
                    (assoc :t0 t0 :next (inc j) :last [j t] :rate rate)
                    (update :played assoc (:id e) [t nil])
                    (update :order conj j))
            ;; the cues up to this note: this one on the note, the ones passed over caught up here
            cues (for [i (range (:next st) (inc j))
                       :let [c (get-in st [:evs i])]
                       :when (and (some? (:cue c)) (not (contains? (:cued st) i)))]
                   [:cue {:cue (:cue c) :id (:id c) :i i :t t :status (if (= i j) "on the note" "caught up")}])]
        [(update st2 :cued into (map (comp :i second) cues))
         (into [[:at {:id (:id e) :i j :beat (:beat e) :t t :skipped (- j (:next st))}]] cues)]))))

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
      {:found found :state st :take (take-of st {:id (or (:id opts) "followed")})}
      (let [[st2 f] (hear st t m)
            st2 (if (and d (seq f)) (release st2 (+ t d)) st2)]
        (recur st2 more (into found f))))))
