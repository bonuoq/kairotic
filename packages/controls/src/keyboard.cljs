;; keyboard · a virtual MIDI keyboard with press and release tied to the mouse
;; Part of @kairotic/controls. Written against the Kairotic API (api/…).
;; First made with Claude inside Kairotic (Gallery, discussion #2), reviewed for the package.
(let [;; ── layout (shared by logic and view) ─────────────────
      white? #{0 2 4 5 7 9 11}
      names ["C" "C#" "D" "D#" "E" "F" "F#" "G" "G#" "A" "A#" "B"]
      note-name (fn [n] (str (nth names (mod n 12)) (dec (quot n 12))))
      hz (fn [n] (* 440 (js/Math.pow 2 (/ (- n 69) 12))))
      kw 16 bw 10 top 14 bh 40 wh 66
      layout (fn [args]
               (let [[lo n] (api/padded (if (map? args) [(:low args) (:keys args)] args) [48 25])
                     notes (range lo (min 128 (+ lo (max 1 n))))
                     step (fn [[acc wi] m]
                            (if (white? (mod m 12))
                              [(conj acc {:midi m :white true :x (* wi kw) :w kw}) (inc wi)]
                              [(conj acc {:midi m :white false :x (- (* wi kw) (/ bw 2)) :w bw}) wi]))
                     [ks wn] (reduce step [[] 0] notes)]
                 {:keys ks :width (* wn kw)}))
      ;; the key under (x, y), black keys first in the upper part, :stop on the strip above;
      ;; with the velocity of the touch: soft at the top of the key, full at its bottom edge
      hit (fn [args x y]
            (let [ks (:keys (layout args))
                  inside (fn [k] (and (>= x (:x k)) (< x (+ (:x k) (:w k)))))
                  white-at (fn [] (:midi (first (filter #(and (:white %) (inside %)) ks))))
                  black-at (fn [] (:midi (first (filter #(and (not (:white %)) (inside %)) ks))))
                  vel (fn [y0 y1] (api/clamp (+ 0.25 (* 0.75 (/ (- y y0) (- y1 y0)))) 0.25 1))]
              (cond
                (< y top) [:stop 1]
                (and (< y (+ top bh)) (black-at)) [(black-at) (vel top (+ top bh))]
                :else [(white-at) (vel top wh)])))

      ;; state: {:held [midi …] most recent first · :vel 0–1 · :keep true when the notes stay after mouse up}
      held-of (fn [state] (vec (if (map? state) (:held state) [])))
      vel-of (fn [state] (or (when (map? state) (:vel state)) 0.8))
      front (fn [held k] (vec (cons k (remove #(= % k) held))))
      ;; outlets, sent in this order: voice ids (1), velocity (3), Hz (0), gate (2) —
      ;; ids before Hz as a reader does, gain before the gate opens
      emit (fn [held vel keep]
             {:state {:held held :vel vel :keep (boolean keep)} :show held
              :out [[1 held] [3 [:gain vel]] [0 (mapv hz held)] [2 (if (seq held) 1 0)]]})
      ;; only a change of the held notes goes out
      move (fn [state held vel keep]
             (if (= (held-of state) held)
               {:state {:held held :vel vel :keep (boolean keep)}}
               (emit held vel keep)))]

  {;; ── about ──────────────────────────────────────────────
   :class "keyboard"
   :license "MPL-2.0"
   :doc "Virtual MIDI keyboard. Press a key to play it and let go to release it; dragging glides from key to key. ⇧-click toggles a note in a chord that stays after mouse up (⇧-drag adds every key it passes); a plain click starts over; the strip above the keys releases everything. With the word hold every note stays (a latch) until the strip is clicked. Where the key is touched sets the velocity: soft at the top, full at the bottom. Outlets: Hz (0, most recent note first), voice ids = the MIDI numbers (1), gate (2), [:gain velocity] (3). For synth~ connect 0→0 and 1→1; for faust~ connect 0 and 3 to its left inlet."
   :usage "keyboard [lowest-midi-note 48] [number-of-keys 25] [hold]"
   :io [1 4]
   :size (fn [box] [(:width (layout (or (:args box) []))) wh])

   ;; ── arguments ──────────────────────────────────────────
   :args [[:low 48] [:keys 25] [:hold false]]

   ;; ── logic ──────────────────────────────────────────────
   ;; While the mouse is down the gesture sends [:key k vel] (plain), [:toggle k vel] (⇧ on press)
   ;; or [:add k vel] (⇧ while dragging). On release (:up) it sends [:up], or [:hold [notes] vel]
   ;; when the notes stay: that is what goes into the history and to the rest of a room, so
   ;; replaying it never leaves a note stuck and a chord arrives whole.
   :receive (fn [{:keys [state value args]}]
              (let [held (held-of state)
                    vel (vel-of state)
                    latch (:hold args)
                    midi (fn [x] (when (number? x) (api/clamp (js/Math.round x) 0 127)))
                    tag (when (sequential? value) (first value))
                    [_ k v] (when tag value)
                    v (if (number? v) v vel)]
                (cond
                  (#{:key :toggle :add} tag)
                  (cond
                    (= k :stop) (move state [] vel false)
                    (nil? k) {:state state}
                    (= tag :key) (move state [k] v latch)
                    (= tag :add) (move state (front held k) v true)
                    (some #(= % k) held) (move state (vec (remove #(= % k) held)) vel true)
                    :else (move state (front held k) v true))
                  (= tag :up) (move state [] vel false)
                  (= tag :hold) (move state (vec (distinct (keep midi k))) v true)
                  (and (= tag :on) (midi k)) (emit (front held (midi k)) v true)
                  (= tag :off) (emit (vec (remove #(= % (midi k)) held)) vel true)
                  (number? value) (emit [(midi value)] vel latch)
                  (= value :bang) (emit held vel (:keep state))
                  (= value :stop) (emit [] vel false)
                  :else {:state state})))

   :gesture (fn [{:keys [args state shown x y dx dy fine up]}]
              (if up
                (let [held (if (sequential? shown) (vec shown) [])]
                  (if (and (seq held) (or (:hold args) (:keep state)))
                    [:hold held (:vel state)]
                    [:up]))
                (let [[k vel] (hit args x y)]
                  (cond
                    (not fine) [:key k vel]
                    (and (zero? dx) (zero? dy)) [:toggle k vel]
                    :else [:add k vel]))))

   ;; ── view ───────────────────────────────────────────────
   :draw (fn [{:keys [shown args state]}]
           (let [held (set (when (sequential? shown) shown))
                 {ks :keys width :width} (layout args)
                 kept (and (map? state) (:keep state) (seq held))
                 label (if (seq held)
                         (str (when kept "◆ ") (str/join " " (map note-name (sort held))))
                         (if (:hold args) "hold · click = latch · ⇧ chord · here = off" "press keys · ⇧ chord · here = off"))]
             (concat
              [[:rect {:x 0 :y 0 :w width :h (- top 2) :r 2 :stroke :grid :fill :bg}]
               [:text {:x 4 :y 10 :anchor :start :size 9 :fill (if kept :accent :soft)} label]]
              (for [k ks :when (:white k)]
                [:rect {:x (:x k) :y top :w kw :h (- wh top) :stroke :soft :fill (if (held (:midi k)) :accent :bg)}])
              (for [k ks :when (and (:white k) (= 0 (mod (:midi k) 12)))]
                [:text {:x (+ (:x k) 8) :y (- wh 3) :anchor :middle :size 8 :fill :soft} (note-name (:midi k))])
              (for [k ks :when (not (:white k))]
                [:rect {:x (:x k) :y top :w bw :h bh :stroke :ink :fill (if (held (:midi k)) :accent :ink)}]))))

   ;; ── help ───────────────────────────────────────────────
   :help {:inlets ["a MIDI number plays it alone; [:on n] adds a note and [:off n] removes it (both kept); [:hold [n …]] sets the held notes; :stop releases all; :bang sends again"]
          :outlets ["list of the held notes in Hz, most recent first (synth~, faust~)"
                    "voice ids: the held MIDI numbers, sent before the Hz (right inlet of synth~)"
                    "gate: 1 while a note is held, 0 when none (adsr~)"
                    "[:gain velocity], 0.25–1, before the Hz (left inlet of faust~)"]
          :try "keyboard → synth~ (0→0, 1→1) → dac~: press, hold, let go; ⇧-click several keys for a chord, ⇧-click one again to take it out, click the strip to release. With faust~: outlets 0 and 3 to its left inlet, and touch lower on the keys to play louder."}})
