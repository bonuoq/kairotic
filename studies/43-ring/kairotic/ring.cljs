;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · Study 43 · ring: the model
;; A circular buffer of messages indexed by time, for a delay that can change while it plays.
;;
;; Time starts at the first message (or the first one after a clear): every message is written with its
;; position, the seconds since then. The ring keeps the last `dur` seconds and forgets what is older, so it is
;; circular in time, not in a count of messages (a window of the last n messages is xf/partition n 1).
;;
;; Three ways to read it, the open question of the study:
;;   pipe  each message goes out d seconds after it came in, with the d it had then (pipe-due)
;;   tape  a read head d seconds behind the write head goes through the buffer and sends what it crosses,
;;         in either direction: a d that changes fast compresses, stretches or reverses what it reads; a jump
;;         of d is a seek, which sends nothing of what lies between (crossed, as the patterns player does)
;;   tap   on demand: what was there d seconds ago (the last message written at or before that position), or,
;;         with interpolation, the value between the two messages around it when they are numbers (tap)
;; Everything here is pure: the page holds the clock and calls these with `now` in seconds.

(ns kairotic.ring)

(defn empty-ring
  "A ring that keeps dur seconds, waiting for its first message to start its time."
  [dur]
  {:dur dur :t0 nil :events []})

(defn pos
  "Where the write head is at now: the seconds since the first message, or nil before it."
  [r now]
  (when-let [t0 (:t0 r)] (- now t0)))

(defn- prune
  "Forgets what is older than dur behind position p."
  [r p]
  (let [lo (- p (:dur r))]
    (update r :events (fn [es] (into [] (drop-while (fn [e] (< (:t e) lo))) es)))))

(defn write
  "Writes value v at now: the first message starts the ring's time."
  [r now v]
  (let [r (if (:t0 r) r (assoc r :t0 now))
        p (pos r now)]
    (-> r (update :events conj {:t p :v v}) (prune p))))

(defn clear
  "Empties the ring: its time starts again at the next message."
  [r]
  (assoc r :t0 nil :events []))

(defn set-dur
  "Changes how much it keeps (a shorter one forgets at once what no longer fits)."
  [r now dur]
  (let [r (assoc r :dur dur)] (if-let [p (pos r now)] (prune r p) r)))

(defn window
  "[from to]: the positions the ring holds at now."
  [r now]
  (when-let [p (pos r now)] [(max 0 (- p (:dur r))) p]))

(defn head
  "The read head of a delay d: d seconds behind the write head (nil before the first message)."
  [r now d]
  (when-let [p (pos r now)] (- p d)))

(defn- num-like? [v] (or (number? v) (and (vector? v) (seq v) (every? number? v))))

(defn- lerp [a b u]
  (if (number? a) (+ a (* u (- b a))) (mapv (fn [x y] (+ x (* u (- y x)))) a b)))

(defn value-at
  "What the ring holds at position q: the last message written at or before q (as a sample and hold), or, with
   interp, the value between the messages around q when both are numbers (or lists of numbers of one length).
   nil before the first message, or when q is outside what it keeps."
  [r now q interp]
  (when-let [[lo hi] (window r now)]
    (when (and (<= lo q) (<= q hi))
      (let [es (:events r)
            i (loop [i -1] (if (and (< (inc i) (count es)) (<= (:t (nth es (inc i))) q)) (recur (inc i)) i))]
        (when (>= i 0)
          (let [a (nth es i) b (get es (inc i))]
            (if (and interp b (num-like? (:v a)) (num-like? (:v b))
                     (or (number? (:v a)) (= (count (:v a)) (count (:v b))))
                     (> (:t b) (:t a)))
              (lerp (:v a) (:v b) (/ (- q (:t a)) (- (:t b) (:t a))))
              (:v a))))))))

(defn tap
  "tap: what was there d seconds ago (held, or interpolated with interp)."
  ([r now d] (tap r now d false))
  ([r now d interp] (when-let [q (head r now d)] (value-at r now q interp))))

(defn crossed
  "The messages a head crosses going from position from to position to, in the order it meets them: forwards
   (from < t <= to) or backwards (to <= t < from, the latest first). A move larger than jump is a seek: nothing."
  [r from to jump]
  (cond
    (or (nil? from) (nil? to) (= from to)) []
    (> (js/Math.abs (- to from)) jump) []
    (< from to) (filterv (fn [e] (and (< from (:t e)) (<= (:t e) to))) (:events r))
    :else (vec (rseq (filterv (fn [e] (and (<= to (:t e)) (< (:t e) from))) (:events r))))))

(defn pipe-due
  "pipe: when a message written at now with delay d goes out."
  [now d]
  (+ now (max 0 d)))

(defn as-edn
  "The ring as the page shows it: what it keeps and where its heads are."
  [r now d]
  (let [p (pos r now)]
    (cond-> {:dur (:dur r) :events (mapv (fn [e] [(/ (js/Math.round (* 1000 (:t e))) 1000) (:v e)]) (:events r))}
      p (assoc :write (/ (js/Math.round (* 1000 p)) 1000) :read (/ (js/Math.round (* 1000 (- p d))) 1000)))))
