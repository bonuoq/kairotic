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
   :octave true    ; an octave off (a pitch tracker's usual error) still counts, at a cost
   :model :greedy}) ; :greedy (the best note ahead, at once), :hmm (a probability for every note) or :dtw (frame by
                    ; frame, against what the score should sound like): see below

(defn score
  "The notes a tree is followed by: its first voice's sounds, in order ({:id :midi :ws :wd :beat :wire})."
  [tree]
  (mapv (fn [e] (select-keys e [:id :midi :ws :wd :beat :wire :listen :name :rest])) (ct/events tree)))

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
  "A follower at the beginning of a score. opts: :ahead :band :octave, :wires (by default its notes'), :profiles
   (what rehearsals learned: learn), :model (:greedy, or :hmm: a probability for every event)."
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

;; ───────── how a note sounds (discussion #308) ─────────
;; Each note has a profile: what is expected to be heard there. By default, from the notation (its pitch class as a
;; chroma); learned from takes that kept what each note sounded like (:profile, by follow rms chroma …): for each
;; descriptor its mean, how much it varies, and a weight — how well it tells the note from its neighbours. A note
;; heard is matched by pitch and, where descriptors are heard, by how near they are to the note's profile; a sound
;; without a pitch (a multiphonic, a noise) by the profile alone.

(defn listen-profile
  "What a score says is to be heard at an event (:listen), as a profile: {descriptor value}, a value or a [lo hi]
   range (its middle, half its width as the spread), :chroma as the pitch classes that sound ([4 11 5]) or 12 values."
  [l]
  (when (map? l)
    (let [ps (for [[k v] l]
               (cond
                 (and (= :chroma k) (sequential? v) (= 12 (count v)) (every? number? v)) [k (vec v) nil]
                 (and (= :chroma k) (sequential? v) (every? integer? v))
                 [k (reduce (fn [c pc] (assoc c (mod pc 12) 1)) (vec (repeat 12 0)) v) nil]
                 (and (sequential? v) (= 2 (count v)) (every? number? v))
                 (let [[lo hi] (sort v)] [k (/ (+ lo hi) 2) (/ (- hi lo) 2)])
                 (number? v) [k v nil]
                 :else nil))
          ps (remove nil? ps)]
      (when (seq ps)
        {:mean (into {} (map (fn [[k m]] [k m]) ps))
         :sd (into {} (keep (fn [[k _ sd]] (when sd [k sd])) ps))
         :w (into {} (map (fn [[k]] [k 1]) ps))}))))

(defn default-profile
  "What the notation says an event sounds like: a note's pitch class, as a chroma, and what its :listen says (which
   takes the place of the pitch's chroma when it names one: a multiphonic)."
  [e]
  (let [base (when-let [m (:midi e)]
               {:mean {:chroma (assoc (vec (repeat 12 0)) (mod (js/Math.round m) 12) 1)} :w {:chroma 1}})
        l (listen-profile (:listen e))]
    (if l
      {:mean (merge (:mean base) (:mean l)) :sd (:sd l) :w (merge (:w base) (:w l))}
      base)))

(defn- vdist [a b]
  ;; between two vectors: 1 − their cosine (0 the same shape, 1 unrelated)
  (let [dot (reduce + (map * a b)) na (js/Math.sqrt (reduce + (map * a a))) nb (js/Math.sqrt (reduce + (map * b b)))]
    (if (or (zero? na) (zero? nb)) 1 (- 1 (/ dot (* na nb))))))

(defn- kdist
  "How far a value heard is from a mean, in its spread (numbers) or as 1 − cosine × 3 (vectors), at most 3."
  [o m sd]
  (min 3 (cond (and (number? o) (number? m)) (/ (js/Math.abs (- o m)) (max (if (and sd (pos? sd)) sd (* 0.1 (js/Math.abs m))) 1e-6))
               (and (sequential? o) (sequential? m) (= (count o) (count m))) (* 3 (vdist o m))
               :else 3)))

(defn obs-dist
  "How far what is heard (obs: {descriptor value}) is from a profile ({:mean :sd :w}): the weighted mean of each
   descriptor's distance (0 … 3), over the descriptors both have; nil if they share none."
  [prof obs]
  (let [ks (filter #(and (contains? obs %) (contains? (:mean prof) %)) (keys (:w prof)))
        ws (map #(get-in prof [:w %] 1) ks)]
    (when (and (seq ks) (pos? (reduce + ws)))
      (/ (reduce + (map (fn [k w] (* w (kdist (get obs k) (get-in prof [:mean k]) (get-in prof [:sd k])))) ks ws))
         (reduce + ws)))))

(defn- mean-of [xs]
  (if (number? (first xs))
    (/ (reduce + xs) (count xs))
    (apply mapv (fn [& v] (/ (reduce + v) (count v))) xs)))

(defn- sd-of [xs m]
  (if (number? m)
    (js/Math.sqrt (/ (reduce + (map #(let [d (- % m)] (* d d)) xs)) (count xs)))
    (/ (reduce + (map #(vdist % m) xs)) (count xs))))

(defn learn
  "What rehearsals learned of how each note sounds, from takes that kept what each note sounded like (:profile):
   {note-id {:n takes :mean {k v} :sd {k v} :w {k weight}}}. A descriptor weighs more the better its mean tells the
   note from the notes beside it, for how little it varies (weights of a note sum to 1)."
  [evs takes]
  (let [ids (mapv :id (remove :rest evs))
        heard (into {} (for [id ids
                             :let [ps (keep #(get-in % [:profile id]) takes)]
                             :when (seq ps)]
                         [id (let [ks (distinct (mapcat keys ps))]
                               (into {} (for [k ks :let [xs (vec (keep #(get % k) ps))] :when (seq xs)
                                              :when (or (every? number? xs) (and (every? sequential? xs) (apply = (map count xs))))]
                                          [k (let [m (mean-of xs)] {:mean m :sd (sd-of xs m) :n (count xs)})])))]))
        r4 (fn [x] (if (number? x) (/ (js/Math.round (* 10000 x)) 10000) (mapv #(/ (js/Math.round (* 10000 %)) 10000) x)))]
    (into {}
          (for [[i id] (map-indexed vector ids) :let [h (get heard id)] :when h]
            (let [nbrs (keep #(get heard (get ids %)) [(dec i) (inc i)])
                  raw (into {} (for [[k {:keys [mean sd]}] h]
                                 (let [sep (if (seq nbrs)
                                             (reduce min (map #(if-let [o (get-in % [k :mean])] (kdist o mean sd) 3) nbrs))
                                             1)]
                                   [k (/ (+ 0.1 sep) (+ 0.1 (if (number? mean) 0 sd)))])))
                  tot (reduce + (vals raw))]
              [id {:n (reduce max (map :n (vals h)))
                   :mean (into {} (map (fn [[k v]] [k (r4 (:mean v))]) h))
                   :sd (into {} (map (fn [[k v]] [k (r4 (:sd v))]) h))
                   :w (into {} (map (fn [[k v]] [k (r4 (/ v tot))]) raw))}])))))

(defn confidence
  "How sure a follower can be at each note (discussion #308, step 5): 0 … 1, by note id. A note is easy to find when it
   sounds unlike the notes beside it (by its profile, learned or from the notation) and, once rehearsed, when the
   takes found it; a note the takes often missed, or that sounds like its neighbours, is where to rehearse more."
  [evs profiles takes]
  (let [ns (vec (remove :rest evs))
        prof (fn [e] (or (get profiles (:id e)) (default-profile e)))
        tk (filter #(map? (:when %)) takes)
        r2 (fn [x] (/ (js/Math.round (* 100 x)) 100))]
    (into {}
          (for [[i e] (map-indexed vector ns) :let [p (prof e)] :when p]
            (let [nbrs (keep #(get ns %) [(dec i) (inc i)])
                  sep (if (seq nbrs) (reduce min (map #(or (when-let [q (prof %)] (obs-dist p (:mean q))) 3) nbrs)) 3)
                  apart (min 1 (/ sep 1.5))
                  played (when (seq tk) (/ (count (filter #(contains? (:when %) (:id e)) tk)) (count tk)))
                  sure (cond (get profiles (:id e)) (+ 0.4 (* 0.6 (or played 1)))
                             played (+ 0.3 (* 0.5 played))
                             :else 0.6)]
              [(:id e) (r2 (* (+ 0.25 (* 0.75 apart)) sure))])))))

(defn profile-at "The profile of note j: learned, or from the notation." [st j]
  (let [e (get-in st [:evs j])] (or (get (:profiles st) (:id e)) (default-profile e))))

(defn- candidates [st t midi obs]
  (let [{:keys [evs next ahead band octave]} st
        ;; the next `ahead` notes (a rest with a wire is no note: it is not heard)
        js (take ahead (filter #(not (:rest (get evs %))) (range next (count evs))))]
    (for [[n j] (map-indexed vector js)
          :let [e (get evs j)
                pitched (and midi (:midi e))
                [d oct] (if pitched (dist midi (:midi e) band octave) [0 false])
                od (when (seq obs) (obs-dist (profile-at st j) obs))]
          ;; with a pitch, a note: by pitch, and the profile weighs in; without one (a multiphonic, a noise), or an
          ;; event without a pitch (a rest with :listen): by the profile
          :when (if pitched d (and od (<= od 1)))]
      ;; the cost: the notes it would skip, how far it is in pitch (an octave off costs more), how far from what is
      ;; heard (its profile), how far from when it was expected (in its own written length, so that a short note
      ;; expected late weighs as much as a long one)
      [(+ n (* 0.5 d) (if oct 0.75 0) (* 0.5 (or od 0))
          (if (:last st) (/ (js/Math.abs (- t (expected st j))) (max 0.25 (* 2 (:wd e)))) 0))
       j])))

(defn- arrive
  "The performer is at note j at t (heard there, or told): the state and what that sets off ([:at …] and wires)."
  [st t j]
  (let [e (get-in st [:evs j])
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
    [st3 (into [[:at {:id (:id e) :i j :beat (:beat e) :t t :skipped (count (remove #(:rest (get-in st [:evs %])) (range (:next st) j)))}]] found)]))

(declare hear-hmm)

(defn hear
  "A note heard at t (seconds) at midi (with decimals; nil for a sound without a pitch, found by what is heard of it
   alone), and what is heard of it (obs: {descriptor value}, from follow's descriptor inlets). → [state found], found a vector of [:at {…}] and
   [:wire {…}] (the wires that went on): nothing if it is not a note of the score near where the performer is (a
   wrong note, an ornament) — but the elastic wires due by then."
  ([st t midi] (hear st t midi nil))
  ([st t midi obs]
  (case (:model st)
    ;; frame by frame (dtw-step): a note heard says nothing by itself
    :dtw [st []]
    :hmm (hear-hmm st t midi obs)
  (let [[st early] (tick st t)
        cs (candidates st t midi obs)]
    (if (empty? cs)
      [(update st :extra inc) early]
      (let [[st found] (arrive st t (second (first (sort-by first cs))))]
        [st (into early found)]))))))

(defn- rewind
  "Back to note j: the notes from j on are to be played again (the take keeps the new attempt), their wires to go on
   again."
  [st j]
  (let [again (set (keep (fn [w] (when (>= (:note w) j) (:id w))) (:wires st)))]
    (-> st
        (update :order (fn [o] (vec (filter #(< % j) o))))
        (update :played (fn [p] (apply dissoc p (map :id (subvec (:evs st) j)))))
        (update :pending into again)
        (assoc :next j :last nil))))

(defn here
  "The performer is told to be at note j at t (a correction in a rehearsal, discussion #308: \"I am here\"). Ahead, as
   if heard there; back (they start again), the notes from j on are to be played again (the take keeps this
   attempt) and their wires to go on again."
  [st t j]
  (let [st (if (< j (:next st)) (rewind st j) st)
        [st early] (tick st t)
        [st found] (arrive st t j)]
    [(-> st (update :corrected (fnil inc 0)) (assoc :belief {j 1} :since {j t})) (into early found)]))

;; ───────── the probabilistic follower (:model :hmm, discussion #308) ─────────
;; A hidden Markov model over the events of the score, in the manner of Antescofo (Cont): instead of one bet, a
;; probability for every event that the performer may be at. Each sound heard moves it: from each event the performer
;; may be at to the next ones (one ahead likely, each skipped one less so), weighed by how well the sound fits each
;; (pitch, and what is heard of it against its profile) and by when it comes against when each was expected (at the
;; performer's tempo, from when the performer reached the event it comes from); or it stays, the sound taken for a
;; wrong note. The follower is where the probability is greatest: a doubtful sound lowers a probability instead of
;; losing the place, and a wrong step is undone when the next sounds point elsewhere (back there, its wires to go on
;; again). The rest — wires, ticks, takes, corrections — is the same as the greedy follower's.

(def ^:private p-next 0.8)      ; going on to the next event
(def ^:private p-skip 0.15)     ; each event skipped multiplies by this
(def ^:private p-wrong 0.08)    ; a sound that is no event (a wrong note, an ornament): the performer stays
(def ^:private l-wrong 0.05)    ; how well a wrong note fits (against an event's fit)

(defn- fit
  "How well a sound fits event j (0 … 1): its pitch (an octave off a little), and what is heard of it against the
   event's profile; a sound or an event without a pitch by the profile alone."
  [st j midi obs]
  (let [e (get-in st [:evs j])
        od (when (seq obs) (obs-dist (profile-at st j) obs))
        g (fn [d s] (js/Math.exp (- (/ (* d d) (* 2 s s)))))]
    (cond
      (and midi (:midi e))
      (let [d (js/Math.abs (- midi (:midi e)))
            o (js/Math.abs (- (mod (+ (- midi (:midi e)) 6) 12) 6))]
        (* (max (g d 0.35) (if (and (:octave st) (> d 6) (<= d 24.6)) (* 0.25 (g o 0.35)) 0))
           (if od (js/Math.exp (- od)) 1)))
      od (js/Math.exp (* -2 od))
      :else 0.001)))

(defn- timing
  "How likely event j comes at t, from event i reached at since: at the performer's rate, within its written length."
  [st i since j t]
  (if (or (neg? i) (nil? since))
    1
    (let [wi (get-in st [:evs i :ws]) wj (get-in st [:evs j :ws])
          e (+ since (* (:rate st) (- wj wi)))
          s (max 0.2 (+ (* 0.5 (get-in st [:evs j :wd])) (* 0.15 (js/Math.abs (- wj wi)))))
          z (/ (- t e) s)]
      (js/Math.exp (- (/ (* z z) 2))))))

(defn- heard-after
  "The events the performer makes (not the electronics' own) after i, at most n."
  [st i n]
  (take n (filter #(not (:rest (get-in st [:evs %]))) (range (inc i) (count (:evs st))))))

(defn- hmm-hear [st t midi obs]
  (let [b (or (:belief st) {-1 1})
        since (or (:since st) {})
        n (* 2 (:ahead st))
        ;; from each event it may be at, on to the next ones, or staying (the sound taken for a wrong note)
        moves (for [[i pi] b :when (> pi 1e-4)
                    [k j] (map-indexed vector (heard-after st i n))]
                [j (* pi p-next (js/Math.pow p-skip k) (fit st j midi obs) (timing st i (get since i) j t))])
        stays (for [[i pi] b] [i (* pi p-wrong l-wrong)])
        moved (reduce (fn [m [j p]] (update m j (fnil + 0) p)) {} moves)
        b2 (reduce (fn [m [j p]] (update m j (fnil + 0) p)) moved stays)
        tot (reduce + (vals b2))
        b2 (if (pos? tot) (into {} (keep (fn [[j p]] (let [q (/ p tot)] (when (> q 1e-5) [j q])))) b2) b)
        since2 (reduce (fn [m [j p]] (if (> p (* (get b j 0) p-wrong l-wrong)) (assoc m j t) m)) since moved)
        best (key (apply max-key val b2))
        cur (if-let [[j] (:last st)] j -1)]
    [(assoc st :belief b2 :since since2) best cur]))

(defn- hear-hmm [st t midi obs]
  (let [[st early] (tick st t)
        [st best cur] (hmm-hear st t midi obs)]
    (cond
      (or (= best cur) (neg? best)) [(update st :extra inc) early]
      (> best cur) (let [[st found] (arrive st t best)] [st (into early found)])
      ;; back: an earlier step was wrong (the sounds since point here)
      :else (let [[st found] (arrive (rewind st best) t best)] [(update st :undone (fnil inc 0)) (into early found)]))))

;; ───────── following frame by frame (:model :dtw, discussion #308) ─────────
;; Online dynamic time warping, in the manner of Dixon's MATCH (Arzt & Widmer): no notes are detected. The score is
;; turned into what it should sound like, frame by frame (each event for as long as it lasts — as a take of it played
;; it, or as written —, each frame its profile: learned, :listen or its pitch class, and its pitch); what is heard
;; every hop (the descriptors, and the pitch sounding) is aligned with it, the cheapest path through a band around
;; where the performer was. Where the path is, is where the performer is: entering an event is arriving there. Good
;; with rubato and sounds that are not notes; it never goes back.

(def ^:private dtw-hop 0.05)

(defn reference
  "What a score should sound like, frame by frame (hop seconds): [{:j event :prof profile} …]. Each event lasts as the
   take (its :when) played it, or as written; a note's frames carry its pitch too."
  ([st] (reference st nil dtw-hop))
  ([st take hop]
   (let [evs (:evs st) tw (:when take)
         onset (fn [j] (first (get tw (get-in evs [j :id]))))
         dur (fn [j] (let [o (onset j) o2 (some onset (range (inc j) (count evs)))]
                       (if (and o o2 (> o2 o)) (- o2 o) (or (get-in evs [j :wd]) dtw-hop))))]
     (vec (mapcat (fn [j]
                    (let [e (get evs j)
                          p (when-not (:rest e) (profile-at st j))
                          p (if (and p (:midi e)) (-> p (assoc-in [:mean :midi] (:midi e)) (assoc-in [:sd :midi] 0.5) (assoc-in [:w :midi] 1)) p)]
                      (repeat (max 1 (js/Math.round (/ (dur j) hop))) {:j j :prof p})))
                  (range (count evs)))))))

(defn dtw-start
  "A follower frame by frame: st (start) with its reference (from take, if given)."
  ([st] (dtw-start st nil))
  ([st take] (assoc st :model :dtw :ref (reference st take dtw-hop) :dtw {:i 0 :D nil :pos 0})))

(defn dtw-step
  "What is heard at t (obs: {descriptor value}, :midi when a pitch sounds), one frame. → [state found]."
  [st t obs]
  (let [[st early] (tick st t)
        ref (:ref st) n (count ref)
        {:keys [i D pos]} (:dtw st)
        lo (max 0 (- pos 30)) hi (min (dec n) (+ pos 60))
        d (fn [j] (if-let [p (:prof (get ref j))] (or (obs-dist p obs) 1.5) 1))
        inf js/Infinity
        D2 (reduce (fn [m j]
                     (let [dj (d j)
                           v (if (nil? D)
                               (if (zero? j) dj (+ (get m (dec j) inf) dj))
                               (min (+ (get D j inf) dj)                 ; the performer stays in this frame
                                    (+ (get D (dec j) inf) (* 2 dj))      ; both go on
                                    (+ (get m (dec j) inf) dj)))]         ; the score goes on alone
                       (assoc m j v)))
                   {} (range (if (nil? D) 0 lo) (inc hi)))
        pos2 (key (apply min-key (fn [[j v]] (/ v (+ i j 2))) D2))
        st (assoc st :dtw {:i (inc i) :D D2 :pos (max pos pos2)})
        j (:j (get ref (max pos pos2)))
        cur (if-let [[c] (:last st)] c -1)]
    (if (and j (> j cur) (not (:rest (get-in st [:evs j]))))
      (let [[st found] (arrive st t j)] [st (into early found)])
      [st early])))

(defn view
  "What a follower shows (for a view of it on the tree it follows): the ids played, skipped, the one where the
   performer is, the wires that went on."
  [st]
  (let [evs (:evs st) nx (:next st 0)]
    {:played (set (keys (:played st)))
     :now (when-let [[j] (:last st)] (get-in evs [j :id]))
     :skipped (set (for [i (range nx) :let [e (get evs i)] :when (and (not (:rest e)) (not (contains? (:played st) (:id e))))] (:id e)))
     :fired (set (remove (:pending st) (map :id (:wires st))))}))

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
  "Offline: a performance ([[t midi dur obs] …], seconds; midi nil for a sound without a pitch) followed through a score
   (with :model :dtw, frames instead: [[t obs] …] every hop, obs with :midi when a pitch sounds) → {:found [...] :take take :state st}."
  [evs performance & [opts]]
  (if (= :dtw (:model opts))
    (loop [st (dtw-start (start evs opts) (:reference opts)) [[t obs] & more] performance found []]
      (if (nil? t)
        (let [[st f] (tick st js/Infinity)]
          {:found (into found f) :state st :take (take-of st {:id (or (:id opts) "followed")})})
        (let [[st2 f] (dtw-step st t obs)] (recur st2 more (into found f)))))
  (loop [st (start evs opts) [[t m d obs] & more] performance found []]
    (if (nil? t)
      ;; the end: the elastic wires still pending go on at their time
      (let [[st f] (tick st js/Infinity)]
        {:found (into found f) :state st :take (take-of st {:id (or (:id opts) "followed")})})
      (let [[st2 f] (hear st t m obs)
            st2 (if (and d (seq f)) (release st2 (+ t d)) st2)]
        (recur st2 more (into found f)))))))
