;; keyboard · a virtual MIDI keyboard with press and release tied to the mouse
;; First made with Claude inside Kairotic (Gallery, discussion #2), reviewed for the library.
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
      ;; the key under (x, y): black keys first in the upper part; :stop on the strip above
      hit (fn [args x y]
            (let [ks (:keys (layout args))
                  inside (fn [k] (and (>= x (:x k)) (< x (+ (:x k) (:w k)))))
                  white-at (fn [] (:midi (first (filter #(and (:white %) (inside %)) ks))))]
              (cond
                (< y top) :stop
                (< y (+ top bh)) (or (:midi (first (filter #(and (not (:white %)) (inside %)) ks))) (white-at))
                :else (white-at))))
      held-of (fn [state] (if (vector? state) state []))
      sorted-set-of (fn [notes] (vec (sort (distinct notes))))
      ;; outlets: Hz list, MIDI list, gate (1 while any note is held, 0 when none)
      emit (fn [held]
             {:state held :show held
              :out [[0 (mapv hz held)] [1 held] [2 (if (seq held) 1 0)]]})
      ;; only a change of the held notes goes out
      move (fn [old held] (if (= old held) {:state old} (emit held)))]

  {;; ── about ──────────────────────────────────────────────
   :class "keyboard"
   :license "MPL-2.0"
   :doc "Virtual MIDI keyboard with press and release tied to the mouse. Mouse down on a key plays it (gate 1), dragging glides to other keys, mouse up releases it (gate 0); ⇧-click adds notes to a chord that is kept after mouse up; the strip above the keys releases everything. With the word hold, notes stay held after mouse up until the strip is clicked. Left outlet: the held notes in Hz (for synth~ or faust~). Middle: the held MIDI notes. Right: the gate, 1 while a note is held, 0 when none. In: a MIDI number plays it alone, [:on n] adds, [:off n] removes, [:hold [n …]] sets the held notes, :stop releases, :bang sends again."
   :usage "keyboard [lowest-midi-note 48] [number-of-keys 25] [hold]"
   :io [1 3]
   :size (fn [box] [(:width (layout (or (:args box) []))) wh])

   ;; ── arguments ──────────────────────────────────────────
   :args [[:low 48] [:keys 25] [:hold false]]

   ;; ── logic ──────────────────────────────────────────────
   ;; While the mouse is down the gesture sends [:key midi chord?]; on release (:up) it sends either
   ;; [:up] (let go) or [:hold [notes]] (⇧ chord or the hold word): that is what stays in the history,
   ;; so replaying it or receiving it in a shared room never leaves a note stuck.
   :receive (fn [{:keys [state value]}]
              (let [held (held-of state)
                    midi (fn [x] (when (number? x) (api/clamp (js/Math.round x) 0 127)))
                    tag (when (sequential? value) (first value))]
                (cond
                  (= tag :key) (let [[_ k chord] value]
                                 (cond
                                   (= k :stop) (move held [])
                                   (nil? k) {:state held}
                                   chord (move held (sorted-set-of (conj held k)))
                                   :else (move held [k])))
                  (= tag :up) (move held [])
                  (= tag :hold) (move held (sorted-set-of (keep midi (second value))))
                  (and (= tag :on) (midi (second value))) (emit (sorted-set-of (conj held (midi (second value)))))
                  (= tag :off) (emit (vec (remove #(= % (midi (second value))) held)))
                  (number? value) (emit [(midi value)])
                  (= value :bang) (emit held)
                  (= value :stop) (emit [])
                  :else {:state held})))

   :gesture (fn [{:keys [args shown x y fine up]}]
              (if up
                (let [held (if (sequential? shown) (vec shown) [])]
                  (if (or fine (:hold args)) [:hold held] [:up]))
                [:key (hit args x y) (boolean fine)]))

   ;; ── view ───────────────────────────────────────────────
   :draw (fn [{:keys [shown args]}]
           (let [held (set (when (sequential? shown) shown))
                 {ks :keys width :width} (layout args)
                 label (if (seq held) (str/join " " (map note-name (sort held))) "press keys · ⇧ chord · here = off")]
             (concat
              [[:rect {:x 0 :y 0 :w width :h (- top 2) :r 2 :stroke :grid :fill :bg}]
               [:text {:x 4 :y 10 :anchor :start :size 9 :fill :soft} label]]
              (for [k ks :when (:white k)]
                [:rect {:x (:x k) :y top :w kw :h (- wh top) :stroke :soft :fill (if (held (:midi k)) :accent :bg)}])
              (for [k ks :when (and (:white k) (= 0 (mod (:midi k) 12)))]
                [:text {:x (+ (:x k) 8) :y (- wh 3) :anchor :middle :size 8 :fill :soft} (note-name (:midi k))])
              (for [k ks :when (not (:white k))]
                [:rect {:x (:x k) :y top :w bw :h bh :stroke :ink :fill (if (held (:midi k)) :accent :ink)}]))))

   ;; ── help ───────────────────────────────────────────────
   :help {:inlets ["a MIDI number plays it alone; [:on n] adds a note; [:off n] removes it; [:hold [n …]] sets the held notes; :stop releases all; :bang sends again"]
          :outlets ["list of the held notes in Hz (to synth~)" "list of the held MIDI notes" "gate: 1 on mouse down, 0 on mouse up (or when all notes are released)"]
          :try "keyboard → synth~ → dac~: press a key and hold it, then let go. Add the word hold to keep notes after mouse up; ⇧-click builds a chord."}})
