;; SPDX-License-Identifier: MPL-2.0
;; Kairotic · record
;; Any stream of numbers written into a canvas (or a freqt) as strokes over time: an envelope from
;; snapshot~, a descriptor from features~, a gesture on a knob, a position. Then it can be edited like
;; any drawing and read again with reader~, as an automation.
;;
;;   record [lo hi] [log] [tolerance]
;;     left: numbers; rec starts a take from 0 (its first write clears the buffer), stop ends it
;;     right: a bang ends the stroke that is being drawn; the next number begins another
;;     out: edits for the canvas (or freqt) on its inlet
;;
;; Senders such as snapshot~ only send what changed, so a value holds until the next one: the stroke is a
;; staircase (each new value starts where the last one held), simplified within `tolerance` (in the units
;; of the values; 1% of their range without it). Time is seconds from rec (a freqt reads them as beats:
;; one a second, at 60). With lo hi the Y axis of a canvas is set to them (log with `log`); without them it
;; follows the values; X follows the take. A freqt keeps its own axes and takes only values from 1 to
;; 30000 (Hz). It writes at most every 2 seconds, each write one event of the history.

(ns kairotic.record
  (:require [kairotic.components :as comp]))

(def flush-every 2)
(def max-points 2000)

(defn r4 [x] (/ (js/Math.round (* x 10000)) 10000))

(defn simplify
  "Ramer–Douglas–Peucker for a time series: keeps the points whose value is more than eps away from the
   line between the ones kept around them (the error measured in value, not in a mixed distance)."
  [pts eps]
  (if (< (count pts) 3)
    (vec pts)
    (let [pts (vec pts)
          keep? (fn keep? [a b acc]
                  (if (<= (- b a) 1)
                    acc
                    (let [[ta va] (nth pts a) [tb vb] (nth pts b)
                          dt (- tb ta)
                          err (fn [i] (let [[t v] (nth pts i)
                                            line (if (zero? dt) va (+ va (* (- vb va) (/ (- t ta) dt))))]
                                        (js/Math.abs (- v line))))
                          [i e] (reduce (fn [[bi be] i] (let [x (err i)] (if (> x be) [i x] [bi be]))) [a -1] (range (inc a) b))]
                      (if (> e eps) (keep? i b (keep? a i (conj acc i))) acc))))
          idx (sort (keep? 0 (dec (count pts)) #{0 (dec (count pts))}))]
      (mapv (fn [i] (nth pts i)) idx))))

(defn args-of
  "lo hi tolerance (numbers in that order) and the word log, from the raw words of the box."
  [args]
  (let [ns (filterv number? args)]
    {:lo (get ns 0) :hi (get ns 1) :tol (get ns 2) :log (boolean (some #{:log} args))}))

(defn tolerance [state]
  (or (:tol state)
      (let [lo (or (:lo state) (:min state)) hi (or (:hi state) (:max state))]
        (if (and lo hi (> hi lo)) (* 0.01 (- hi lo)) 0))))

(defn axes
  "The axes a canvas should have now, as edits (a freqt leaves them out)."
  [state]
  (let [t1 (max 1 (:t-end state 0))
        lo (or (:lo state) (:min state)) hi (or (:hi state) (:max state))
        [lo hi] (cond (and lo hi (< lo hi)) (if (:lo state) [lo hi] (let [m (* 0.05 (- hi lo))] [(- lo m) (+ hi m)]))
                      (and lo hi) [(- lo 0.5) (+ hi 0.5)]
                      :else nil)]
    (cond-> [[:axis :x 0 (r4 t1)]]
      lo (conj (cond-> [:axis :y (r4 lo) (r4 hi)] (and (:log state) (pos? lo)) (conj :log))))))

(defn stroke-edit [state [id pts]]
  (let [ps (simplify pts (tolerance state))
        ps (if (> (count ps) max-points) (vec (take-nth (js/Math.ceil (/ (count ps) max-points)) ps)) ps)]
    (when (>= (count ps) 2) [:stroke id (mapv (fn [[t v]] [(r4 t) (r4 v)]) ps)])))

(defn write-out
  "[state edit later]: the strokes that changed since the last write, with the axes, as one [:batch …],
   at most every flush-every seconds (force: now)."
  [state at force]
  (let [dirty (:dirty state)]
    (cond
      (empty? dirty) [state nil nil]
      (or force (nil? (:sent state)) (>= (- at (:sent state)) flush-every))
      (let [strokes (keep (fn [id] (stroke-edit state [id (get-in state [:strokes id])])) (sort-by name dirty))]
        ;; a stroke of one point waits for the next one (nothing is written, nothing is marked as sent)
        (if (seq strokes)
          [(assoc state :dirty #{} :sent at :pending false :fresh false)
           [:batch (vec (concat (when (:fresh state) [[:clear]]) (axes state) strokes))]
           nil]
          [state nil nil]))
      (:pending state) [state nil nil]
      :else [(assoc state :pending true) nil [(+ (:sent state) flush-every) 0 [:flush]]])))

(defn add-value
  "A value v at instant at: it continues the stroke being drawn (a step from where the last value held),
   or begins one."
  [state v at]
  (let [t (- at (:t0 state))
        id (:cur state)
        state (if id state (-> state (update :n inc) (as-> s (assoc s :cur (keyword (str "r" (:n s)))))))
        id (:cur state)
        pts (get-in state [:strokes id] [])
        [_ lv] (peek pts)
        pts (cond-> pts (and lv (not= lv v)) (conj [t lv]) true (conj [t v]))]
    (-> state
        (assoc-in [:strokes id] pts)
        (update :dirty conj id)
        (assoc :t-end t)
        (update :min (fn [m] (if (some? m) (min m v) v)))
        (update :max (fn [m] (if (some? m) (max m v) v))))))

(defn end-stroke
  "The stroke being drawn ends: held until now, so a value that never changed still has a length."
  [state at]
  (if-let [id (:cur state)]
    (let [t (- at (:t0 state)) [lt lv] (peek (get-in state [:strokes id]))]
      (cond-> (dissoc state :cur)
        (and lv (> t lt)) (-> (update-in [:strokes id] conj [t lv]) (update :dirty conj id) (assoc :t-end t))))
    state))

(defn result [[st edit later]]
  (cond-> {:state st :show (select-keys st [:on :n])}
    edit (assoc :out [[0 edit]])
    later (assoc :later [later])))

(comp/define! "record"
  {:doc "Writes any stream of numbers into a canvas (or a freqt) as strokes over time: an envelope (snapshot~ 50 rms), a descriptor (features~), a knob, a position. rec starts a take from 0 (its first write clears the buffer), stop ends it; a bang on the right ends a stroke, and the next number begins another. A value holds until the next one (snapshot~ sends only what changed), simplified within tolerance (1% of the range without it). Time in seconds from rec. With lo hi the Y axis of a canvas is set to them (log with log); without them it follows the values. It writes at most every 2 seconds, each write one event of the history; then reader~ reads it back as an automation."
   :usage "record [lo hi] [log] [tolerance]"
   :license "MPL-2.0"
   :io [2 1]
   :size [124 30]
   :receive (fn [{:keys [inlet value state args at]}]
              (let [state (or state {})]
                (cond
                  (= value :rec)
                  (let [{:keys [lo hi tol log]} (args-of args)]
                    {:state {:on true :t0 at :lo lo :hi hi :tol tol :log log :n 0 :strokes {} :dirty #{} :fresh true}
                     :show {:on true :n 0}})
                  (not (:on state)) {}
                  (= value :stop)
                  (let [[st edit _] (write-out (end-stroke state at) at true)]
                    (cond-> {:state (assoc st :on false) :show {:on false :n (:n st)}}
                      edit (assoc :out [[0 edit]])))
                  (= value [:flush]) (result (write-out (assoc state :pending false) at false))
                  (= inlet 1) (result (write-out (end-stroke state at) at false))
                  (and (number? value) (js/isFinite value)) (result (write-out (add-value state value at) at false))
                  :else {})))
   :derive (fn [{:keys [shown]}]
             {:label (str (if (:on shown) "● recording · " "record · ") (or (:n shown) 0)
                          (if (= 1 (:n shown)) " stroke" " strokes"))})
   :view [[:rect {:x 2 :y 2 :w 120 :h 26 :r 3 :stroke :grid :fill :bg}]
          [:text {:x 8 :y 19 :size 10 :fill :soft} :$label]]})
