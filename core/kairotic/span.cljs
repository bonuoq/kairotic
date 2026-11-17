;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · span: a ring of messages and its heads, pure (discussion "Heads on a span of time", Studies 44 and 47)
;;
;; A ring keeps what was written in the last `dur` seconds. Its time starts at its first message (or the first
;; one after :clear); its implicit write head is where that time is, and as a tape head it erases what it passes:
;; what is older than one turn is gone. Positions on the ring are seconds in [0, dur) (the span's own units);
;; events keep the time they belong to, unwrapped (seconds since the start), so a head that goes round is still
;; moving forwards and an event is met again at every turn.
;;
;;   {:ring true :dur 8 :t0 at-or-nil :events [{:t seconds-since-start :v value :w instant-written} …]}
;;
;; Writers (other boxes) send it edits: [:write p v mode] at position p (or :now, the head) — with :ovr it
;; replaces what was written there before, not what arrives with it (a chord stays) —, [:cut a b] (what a writer
;; passed going from a to b: forwards (a, b], backwards [b, a)), [:erase] (everything; time goes on).
;; Readers meet the events they cross (crossings), in the order they meet them.

(ns kairotic.span)

(def eps 1e-9)

(defn ring
  "An empty ring that keeps dur seconds, waiting for its first message to start its time."
  [dur]
  {:ring true :dur (if (and (number? dur) (pos? dur)) dur 8) :t0 nil :events []})

(defn ring? [x] (and (map? x) (true? (:ring x))))

(defn head
  "Where the ring's write head is at instant at (seconds since its start, unwrapped), or nil before it starts."
  [r at]
  (when-let [t0 (:t0 r)] (- at t0)))

(defn wrap
  "A position of the span, in [0, dur)."
  [r p]
  (let [l (:dur r) x (mod p l)] (if (< (- l x) eps) 0 x)))

(defn start
  "The ring's time starts at at, if it had not."
  [r at]
  (if (:t0 r) r (assoc r :t0 at)))

(defn alive
  "What the ring keeps at instant at: what was written within one turn of the head."
  [r at]
  (if-let [h (head r at)]
    (let [lo (+ (- h (:dur r)) eps)]
      (filterv (fn [e] (> (:t e) lo)) (:events r)))
    []))

(defn- prune [r at] (assoc r :events (alive r at)))

(defn- place
  "The time an event written at position p (wrapped) belongs to: the latest one, not after the head."
  [r at p]
  (let [h (head r at)] (- h (mod (- h (wrap r p)) (:dur r)))))

(defn- same-place? [r a b] (let [d (mod (- a b) (:dur r))] (or (< d 1e-6) (< (- (:dur r) d) 1e-6))))

(defn write
  "Writes v at instant at: at the head (p :now or nil) or at position p. With :ovr, what was written there before
   (at another instant) goes; what arrives with it stays."
  ([r at v] (write r at :now v :mix))
  ([r at p v mode]
   (let [r (prune (start r at) at)
         t (if (or (nil? p) (= :now p)) (head r at) (place r at p))
         keep? (fn [e] (not (and (= :ovr mode) (not= (:w e) at) (same-place? r (:t e) t))))]
     (assoc r :events (vec (sort-by :t (conj (filterv keep? (:events r)) {:t t :v v :w at})))))))

(defn- in-sweep?
  "Is position x (wrapped) met by a head going from a to b (unwrapped)? Forwards (a, b], backwards [b, a)."
  [l x a b]
  (if (< a b)
    (let [k (js/Math.ceil (/ (- (+ a eps) x) l)) y (+ x (* k l))] (<= y (+ b eps)))
    (let [k (js/Math.floor (/ (- (- a eps) x) l)) y (+ x (* k l))] (>= y (- b eps)))))

(defn crossings
  "The events met going from a to b (positions of the span, unwrapped: a move of more than a turn meets an event
   more than once), in the order they are met, as [position-where-met event]."
  [r at a b]
  (let [l (:dur r) es (alive r at)]
    (cond
      (or (nil? a) (nil? b) (= a b)) []
      (< a b)
      (->> (for [e es
                 :let [k0 (js/Math.ceil (/ (- (+ a eps) (:t e)) l))]
                 k (range k0 (inc (js/Math.floor (/ (- (+ b eps) (:t e)) l))))]
             [(+ (:t e) (* k l)) e])
           (sort-by first) vec)
      :else
      (->> (for [e es
                 :let [k0 (js/Math.floor (/ (- (- a eps) (:t e)) l))]
                 k (range k0 (dec (js/Math.ceil (/ (- (- b eps) (:t e)) l))) -1)]
             [(+ (:t e) (* k l)) e])
           (sort-by (comp - first)) vec))))

(defn cut
  "What a writer passed going from a to b (positions, unwrapped) is gone."
  [r at a b]
  (let [r (prune r at) l (:dur r)]
    (if (or (nil? a) (nil? b) (= a b) (nil? (:t0 r)))
      r
      (let [lo (min a b) hi (max a b)]
        (if (>= (- hi lo) l)
          (assoc r :events [])
          (assoc r :events (filterv (fn [e] (not (in-sweep? l (:t e) a b))) (:events r))))))))

(defn erase "Everything is gone; time goes on." [r] (assoc r :events []))

(defn shortest
  "The move from position a to position q on a ring of length l: the one shorter than half a turn (a phasor~ that
   goes back to 0 has gone on, not back)."
  [l a q]
  (let [d (mod (- q a) l)] (if (> d (/ l 2)) (- d l) d)))

;; ───────── a reader that follows the ring's head ─────────
;; d behind it, then drifting by (1 − speed) for each second: first the distance, then the speed (Study 47).
;; Its position at instant T: head(T) − d − drift0 − (1 − speed)·(T − since).

(defn follow-at
  "Where a following reader is at instant T (unwrapped), or nil before the ring starts."
  [r {:keys [d speed drift0 since]} T]
  (when-let [h (head r T)]
    (- h d (or drift0 0) (* (- 1 speed) (- T (or since T))))))

(defn when-met
  "The instant a following reader at position p at instant T (moving at speed) meets position x."
  [p T speed x]
  (if (zero? speed) T (max T (+ T (/ (- x p) speed)))))
