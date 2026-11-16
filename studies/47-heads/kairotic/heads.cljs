;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · Study 47 · heads: the model (pure)
;; A span of time and the heads that write and read it (the discussion "Heads on a span of time"): one model for
;; the ring of Study 44, the canons of Studies 38–46 and the buffers of the app (canvas, freqt, sample).
;;
;;   the span    what is written, as events {:p position :v value} in seconds: circular (a ring, of len seconds:
;;               positions wrap) or fixed (a work of len seconds: positions stop at its ends)
;;   a writer    a head with a position of its own: it writes what arrives where it is. Moving, it replaces what
;;               it passes over (:ovr, the default) or leaves it (:mix: an overdub); still, :ovr replaces what was
;;               written where it is before (not what arrives at the same moment: a chord stays). A move larger
;;               than its jump is a seek, which replaces nothing between. What arrives is what it listens to: the
;;               keys (an inlet), or what a reader sends (a connection), so a reader's notes can be written again
;;               (feedback: a round)
;;   a reader    a head that sends what it crosses, in the order it meets it, either way; a move larger than its
;;               jump is a seek, which sends nothing of what lies between (as the patterns player does)
;;
;; Where a head is comes from one of four sources, as in the app a position comes from a ramp, a phasor~, an lfo or
;; a hand:
;;   :clock   from a start p0, at a speed s (seconds of the span per second; negative: backwards)
;;   :signal  a clock moved by a slow wave: p0 + s·t + depth·sin(2π·rate·t), a position that varies (speed
;;            s ± 2π·rate·depth; beyond s it goes backwards at times)
;;   :follow  a reader d behind a writer, first the distance, then the speed: at speed 1 it stays d behind (a
;;            canon), at 0.5 it falls behind (an augmentation), at −1 it goes back over what was written (a crab,
;;            in chunks on a ring)
;;   :hand    wherever it is put (:target: a slider, a drag): a variable control
;; :rec t and :ovr t (as the record box has them) are a writer sent to t, moving on at speed 1 (cue).
;; Transformations of the values (k, an inversion) are not the heads' business: other boxes do them in a patch.
;;
;; Positions of the heads are kept unwrapped (a real line), so a head that goes round a ring is still moving
;; forwards; they are wrapped only to meet the events.

(ns kairotic.heads)

(def eps 1e-9)

;; ───────── the span ─────────

(defn span
  "An empty span of len seconds: circular (a ring) or not (a fixed work)."
  [len circular]
  {:len len :circular (boolean circular) :events []})

(defn- wrap [sp p] (if (:circular sp) (let [l (:len sp) x (mod p l)] (if (< (- l x) eps) 0 x)) p))

(defn- inside? [sp p] (or (:circular sp) (and (>= p (- eps)) (<= p (+ (:len sp) eps)))))

(defn write-at
  "Writes value v at position p (wrapped on a ring; outside a fixed span nothing is written)."
  ([sp p v] (write-at sp p v nil false))
  ([sp p v t replace]
   (if (inside? sp p)
     (let [q (wrap sp p)
           ;; replacing: what was written here before (at another time) goes; what arrives with it stays (a chord)
           keep? (fn [e] (not (and replace (< (js/Math.abs (- (:p e) q)) 1e-6) (not= (:t e) t))))]
       (update sp :events (fn [es] (vec (sort-by :p (conj (filterv keep? es) {:p q :v v :t t}))))))
     sp)))

(defn- hits
  "The events met going from a to b (unwrapped positions), in the order they are met: forwards those in (a, b],
   backwards those in [b, a). On a ring an event is met at each of its turns within the move."
  [sp a b]
  (let [l (:len sp) es (:events sp)]
    (cond
      (= a b) []
      (not (:circular sp))
      (if (< a b)
        (filterv (fn [e] (and (> (:p e) (+ a eps)) (<= (:p e) (+ b eps)))) es)
        (vec (rseq (filterv (fn [e] (and (>= (:p e) (- b eps)) (< (:p e) (- a eps)))) es))))
      (< a b)
      (vec (for [k (range (js/Math.floor (/ a l)) (inc (js/Math.floor (/ b l))))
                 e es :let [x (+ (:p e) (* k l))]
                 :when (and (> x (+ a eps)) (<= x (+ b eps)))]
             e))
      :else
      (vec (for [k (range (js/Math.floor (/ a l)) (dec (js/Math.floor (/ b l))) -1)
                 e (rseq es) :let [x (+ (:p e) (* k l))]
                 :when (and (>= x (- b eps)) (< x (- a eps)))]
             e)))))

(defn crossed
  "What a reader going from a to b sends: the events it meets, unless the move is larger than jump (a seek)."
  [sp a b jump]
  (if (or (nil? a) (nil? b) (> (js/Math.abs (- b a)) jump)) [] (hits sp a b)))

(defn- erase
  "A writer moving from a to b over-writes: what it passes is gone (not what is where it starts)."
  [sp a b]
  (let [gone (set (hits sp a b))]
    (if (seq gone) (update sp :events (fn [es] (filterv (complement gone) es))) sp)))

;; ───────── heads ─────────

(defn writer
  "A writer: {:at :clock :p0 0 :speed 1 :jump 0.5} by default; :mode :ovr (replace what it passes) or :mix.
   :listen what it writes: true (the keys, an inlet), false, a reader's id, or a set of them (:in for the keys)."
  [id opts]
  (merge {:id id :role :write :at :clock :p0 0 :speed 1 :mode :ovr :jump 0.5 :p nil :listen true} opts))

(defn hears?
  "Does writer h write what comes from src (:in, the keys; or a reader's id)?"
  [h src]
  (let [l (:listen h)]
    (cond (true? l) (= src :in) (set? l) (contains? l src) (keyword? l) (= l src) :else false)))

(defn reader
  "A reader: {:at :follow :of writer-id :d 1 :speed 1 :jump 0.5} by default, or :at :clock (from :p0 at :speed)
   or :at :hand."
  [id opts]
  (merge {:id id :role :read :at :follow :of :w :d 1 :speed 1 :jump 0.5 :p nil :drift 0} opts))

(defn- place
  "Where head h is at time t (seconds since the start), given where the writers are now."
  [h t writers]
  (case (:at h)
    :clock (+ (:p0 h) (* (:speed h) t))
    :signal (+ (:p0 h) (* (:speed h) t) (* (or (:depth h) 0) (js/Math.sin (* 2 js/Math.PI (or (:rate h) 0.25) t))))
    :follow (when-let [w (get writers (:of h))] (- w (:d h) (:drift h)))
    ;; by hand: where it is put (:target), the head moving there from where it was at the next step
    :hand (if (some? (:target h)) (:target h) (:p h))
    (:p h)))

(defn- clamp
  "A writer on a fixed span stays inside it (it stops at its ends)."
  [sp p] (if (:circular sp) p (max 0 (min (:len sp) p))))

(defn start
  "A state at time 0: the span and its heads in their places."
  [sp heads]
  (let [ws (into {} (for [h heads :when (= :write (:role h))] [(:id h) (clamp sp (place h 0 {}))]))
        ;; (a writer stays on a fixed span; a reader may wait before its start, so it meets what is at 0)
        hs (mapv (fn [h] (assoc h :p (if (= :write (:role h)) (get ws (:id h)) (place h 0 ws)))) heads)]
    {:sp sp :heads hs :t 0 :out []}))

(defn advance
  "The heads at time t (seconds since the start, later than the last): writers move first (replacing what they pass,
   with :ovr), then readers, which send what they cross. :out holds [reader-id value] in the order they sounded."
  [{:keys [sp heads] :as st} t]
  (let [dt (- t (:t st))
        ;; a reader that follows drifts by (1 − speed) for each second: first the distance, then the speed
        heads (mapv (fn [h] (if (and (= :read (:role h)) (= :follow (:at h))) (update h :drift + (* (- 1 (:speed h)) dt)) h)) heads)
        [sp ws heads]
        (reduce (fn [[sp ws hs] h]
                  (if (= :write (:role h))
                    (let [p (clamp sp (place h t ws))
                          ;; a move larger than its jump is a seek: nothing between is replaced
                          seek (or (nil? (:p h)) (> (js/Math.abs (- p (:p h))) (or (:jump h) 0.5)))
                          sp (if (and (= :ovr (:mode h)) (not seek)) (erase sp (:p h) p) sp)]
                      [sp (assoc ws (:id h) p) (conj hs (assoc h :p p))])
                    [sp ws (conj hs h)]))
                [sp {} []] heads)
        out (atom [])
        heads (mapv (fn [h]
                      (if (= :read (:role h))
                        (let [p (place h t ws)]
                          (doseq [e (crossed sp (:p h) p (:jump h))] (swap! out conj [(:id h) (:v e)]))
                          (assoc h :p p))
                        h))
                    heads)
        ;; what the readers sent, written by the writers that listen to them (a connection: feedback)
        sp (reduce (fn [sp h]
                     (if (= :write (:role h))
                       (reduce (fn [sp [rid v]] (if (hears? h rid) (write-at sp (:p h) v t (= :ovr (:mode h))) sp)) sp @out)
                       sp))
                   sp heads)]
    {:sp sp :heads heads :t t :out @out}))

(defn play
  "Value v arrives (the keys, an inlet): every writer that listens to it writes it where it is."
  [st v]
  (update st :sp (fn [sp] (reduce (fn [sp h] (if (and (= :write (:role h)) (hears? h :in))
                                                (write-at sp (:p h) v (:t st) (= :ovr (:mode h)))
                                                sp))
                                  sp (:heads st)))))

(defn set-head
  "Changes a head (its d, speed, position by hand, jump…). A reader's new d is a new distance now: its drift starts
   again from 0, as a distance comes first and a speed after it."
  [st id f]
  (update st :heads (fn [hs] (mapv (fn [h] (if (= id (:id h))
                                             (let [h2 (f h)] (if (not= (:d h2) (:d h)) (assoc h2 :drift 0) h2))
                                             h))
                                   hs))))

(defn cue
  "The shortcuts :rec t and :ovr t: writer id goes to t now (a seek: nothing between is replaced) and moves on at
   speed 1, replacing what it passes. :rec t also cuts what is after t — on a ring, everything — as the record
   box's rec t does."
  [st id kind t]
  (let [sp (:sp st)
        t (if (:circular sp) t (max 0 (min (:len sp) t)))
        st (set-head st id #(assoc % :at :clock :p0 (- t (:t st)) :speed 1 :mode :ovr :p t))]
    (if (= kind :rec)
      (update-in st [:sp :events] (fn [es] (if (:circular sp) [] (filterv #(< (:p %) (- t eps)) es))))
      st)))

(defn head [st id] (first (filter #(= id (:id %)) (:heads st))))

(defn at-span
  "Where a head is on the span (wrapped on a ring), or nil."
  [st id]
  (when-let [p (:p (head st id))] (wrap (:sp st) p)))
