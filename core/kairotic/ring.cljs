;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · ring and writer: a span of time for messages and the heads that write it (discussion "Heads on a span
;; of time"; Studies 44 and 47). The model is kairotic.span; reader reads a ring (components.cljs).
;;
;;   ring [seconds]
;;     left: any value, written where its time is (its implicit write head, a tape head: what is older than one
;;           turn is gone); a writer's edits ([:write p v mode], [:cut a b], [:erase]); :clear (empty, its time
;;           starts again at the next message); [:data] → what it keeps, on the left
;;     right outlet: the buffer, for a reader or a writer (on their right inlet); :start goes out on it when the
;;           ring's time starts, so a reader given a d begins to follow
;;
;;   writer [ovr|mix] [jump s] [norm]
;;     left: what is written where the writer is; :rec t / :ovr t (msg :rec 2) send it to t, moving on at speed 1
;;           and replacing what it passes (:rec on a ring also erases everything, as rec t cuts what is after t);
;;           :stop holds it where it is
;;     middle: the buffer (a ring's right outlet), to know its length
;;     right: a position (seconds of the span, or 0…1 with norm), from any source — a ramp, a counter, a
;;           phasor~ through snapshot~. Moving, with ovr (the default) it erases what it passes; a move larger than
;;           its jump is a seek, which erases nothing between
;;     out: edits for the ring (its left inlet). Without a position, it writes where the ring's head is

(ns kairotic.ring
  (:require [kairotic.components :as comp]
            [kairotic.span :as span]))

(def tick 0.05)

(defn- after-word
  "The number after word k in the raw args (reader d 1 → 1)."
  [args k]
  (let [x (second (drop-while #(not= k %) args))] (when (number? x) x)))

;; ───────── ring ─────────

(defn- summary [r at]
  {:dur (:dur r) :n (count (span/alive r at)) :on (boolean (:t0 r))
   :p (when-let [h (span/head r at)] (span/wrap r h))})

(defn ring-receive [{:keys [state args value at]}]
  (let [dur (or (comp/num-of (first args)) 8)
        r (assoc (or state (span/ring dur)) :dur dur)
        done (fn [r2]
               (cond-> {:state r2 :show (summary r2 at)}
                 ;; its time starts now: the readers on its buffer are told
                 (and (nil? (:t0 r)) (:t0 r2)) (assoc :out [[1 :start]])))]
    (cond
      (nil? value) {}
      (= value :clear) {:state (span/ring dur) :show (summary (span/ring dur) at)}
      (and (vector? value) (= :write (first value)))
      (let [[_ p v mode] value] (done (span/write r at p v (or mode :mix))))
      (and (vector? value) (= :cut (first value)))
      (let [[_ a b] value] {:state (span/cut r at a b) :show (summary r at)})
      (= value [:erase]) {:state (span/erase r) :show (summary (span/erase r) at)}
      (= value [:data])
      {:out [[0 {:dur dur :events (mapv (fn [e] [(span/wrap r (:t e)) (:v e)]) (span/alive r at))}]]}
      :else (done (span/write r at value)))))

(comp/define! "ring"
  {:doc "A span of time for messages: it keeps what reached it in the last seconds (8 by default), each at its time. Its time starts at its first message; its write head goes round as a tape head, so what is older than one turn is gone. Its right outlet is the buffer for a reader (d behind, then a speed: a canon, a delay; or at a position from any source) and for a writer (several heads, anywhere, at any speed). :clear empties it, and its time starts again."
   :usage "ring [seconds]"
   :license "MPL-2.0"
   :io [1 2]
   :size [124 30]
   :receive ring-receive
   :derive (fn [{:keys [shown]}]
             {:label (str "ring " (comp/nice (or (:dur shown) 8)) " s · " (or (:n shown) 0) " kept")})
   :view [[:rect {:x 2 :y 2 :w 120 :h 26 :r 13 :stroke :grid :fill :bg}]
          [:text {:x 10 :y 19 :size 10 :fill :soft} :$label]]})

;; ───────── writer ─────────

(defn writer-args [args]
  {:mode (if (some #{:mix} args) :mix :ovr)
   :jump (or (after-word args :jump) 0.5)
   :norm (boolean (some #{:norm} args))})

(defn- clock-at [{:keys [clock]} at] (when clock (+ (:p clock) (- at (:at clock)))))

(defn writer-receive [{:keys [state args inlet value at buffer]}]
  (let [{:keys [mode jump norm]} (writer-args args)
        st (or state {})
        l (when (span/ring? buffer) (:dur buffer))
        gen (inc (:gen st 0))
        cue (fn [kind t]
              (let [t (or t 0)]
                {:state (assoc st :clock {:at at :p t} :p t :gen gen)
                 :out (if (= kind :rec) [[0 [:erase]]] [])
                 :later [[(+ at tick) 0 [:tick gen]]]}))]
    (cond
      ;; the buffer's wire (:start when the ring's time starts): nothing to do
      (= inlet 1) {}
      ;; a position, from any source
      (= inlet 2)
      (if-let [u (comp/num-of value)]
        (let [q (if norm (* u (or l 1)) u)
              prev (when-not (:clock st) (:p st))
              p (if (and prev l) (+ prev (span/shortest l (mod prev l) q)) q)
              seek (or (nil? prev) (> (js/Math.abs (- p prev)) jump))]
          (cond-> {:state (-> st (assoc :p p :gen gen) (dissoc :clock))}
            (and (= mode :ovr) (not seek)) (assoc :out [[0 [:cut prev p]]])))
        {})
      ;; :rec t and :ovr t: to t, then at speed 1, replacing
      (or (#{:rec :ovr} value) (and (vector? value) (#{:rec :ovr} (first value))))
      (let [[kind t] (if (vector? value) value [value 0])]
        (cue kind (comp/num-of t)))
      (= value :stop) {:state (-> st (assoc :p (or (clock-at st at) (:p st)) :gen gen) (dissoc :clock))}
      ;; moving on its own clock it erases what it passes, a little at a time
      (comp/tick? value nil)
      (if (and (:clock st) (= (second value) (:gen st)))
        (let [p (clock-at st at)]
          {:state (assoc st :p p) :out [[0 [:cut (:p st) p]]] :later [[(+ at tick) 0 [:tick (:gen st)]]]})
        {})
      :else
      (let [p (or (clock-at st at) (:p st) :now)
            m (if (:clock st) :ovr mode)]
        ;; on its clock, first what it passed since the last tick is erased, then the value is written
        {:state (cond-> st (:clock st) (assoc :p p))
         :out (cond-> []
                (and (:clock st) (number? (:p st)) (not= p (:p st))) (conj [0 [:cut (:p st) p]])
                true (conj [0 [:write p value m]]))}))))

(comp/define! "writer"
  {:doc "A write head on a buffer (a ring): what reaches its left inlet is written where it is. Its position comes in on the right, from any source (a ramp, a counter, a phasor~ through snapshot~), in seconds of the span (0…1 with norm); without one it writes where the ring's head is. Moving, it replaces what it passes, as a tape head — silence too (ovr, the default) — or leaves it (mix); a move larger than its jump is a seek. :rec t / :ovr t send it to t, moving on at speed 1. Its outlet goes to the ring's left inlet; the ring's right outlet to its middle inlet."
   :usage "writer [ovr|mix] [jump s] [norm]"
   :license "MPL-2.0"
   :io [3 1]
   :reads-buffer true
   :receive writer-receive})
