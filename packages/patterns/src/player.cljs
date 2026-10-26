;; player · plays a pattern: by its own clock, one step at a time, or at a position in beats
;; Part of @kairotic/patterns. Written against the Kairotic API (api/…).
;; Like a reader: the pattern comes in on the right (as the buffer does) and time on the left, so one
;; pattern can feed several players that move through it each in its own way.
;;   start / stop      its own clock: every event lasts its :dur in beats, at `player bpm`
;;   bang              one step: the next event, now (from a metro, an onset~, a key…)
;;   a number          a position in beats: the events whose start it crosses (a ramp, a counter…);
;;                     backwards, or a jump, moves there without sounding what is in between
;; Out: the Hz of the notes sounding (left) after their voice ids (second), as mt play and reader do
;; (for synth~ and a polyphonic faust~), the whole event (third) and the beat (right).
;; Its logic is pure: the stream it plays is kept in its state, in this tab; nothing of it is in the work.
(let [eps 1e-9
      burst 64                                        ; events in one instant, at most (a chord, a jump)
      spb (fn [st] (/ 60 (:bpm st)))                  ; seconds per beat
      word (fn [v] (cond (keyword? v) v
                         (string? v) (keyword v)
                         (and (vector? v) (keyword? (first v)) (= 1 (count v))) (first v)
                         :else nil))
      ;; the stream it plays: kept behind a function, so that printing its state (or the engine's) never
      ;; walks an endless sequence
      evs (fn [st] (when-let [f (:evs st)] (f)))
      with-evs (fn [st s] (assoc st :evs (constantly s)))
      ;; a new stream of its pattern, from the beginning
      fresh (fn [st] (if-let [p (:pattern st)] (-> st (with-evs (api/pattern-events p)) (assoc :beat 0)) (dissoc st :evs)))
      ;; [event onset st-after] for the next event, or nil
      take-next (fn [st] (when-let [e (first (evs st))]
                           [e (:beat st) (-> st (with-evs (rest (evs st))) (update :beat + (api/event-dur e)))]))
      ;; leaves out the events that start before beat b (a new pattern, a jump)
      skip-to (fn [st b]
                (loop [st st i 0]
                  (let [e (first (evs st))]
                    (if (and e (< (:beat st) (- b eps)) (< i 100000))
                      (recur (-> st (with-evs (rest (evs st))) (update :beat + (api/event-dur e))) (inc i))
                      st))))
      ;; what sounds: [[id hz until-beat] …] → ids (sent first) and Hz
      sound-outs (fn [st] [[1 (mapv first (:sounding st))] [0 (mapv second (:sounding st))]])
      ;; plays one event that starts on beat `onset` at time `at`: its notes join what sounds; the event
      ;; goes out whole (with its :beat, :hz and :ids); a clock or a step lets its notes go after their
      ;; sustain, a position when it passes their end
      play (fn [st e onset at]
             (if (api/rest-event? e)
               [st [] []]
               (let [hz (or (api/event-hz e) [])
                     n0 (:n st)
                     ids (mapv (fn [i] (keyword (str "p" (+ n0 i 1)))) (range (count hz)))
                     sus (api/event-sustain e)
                     st (-> st (assoc :n (+ n0 (count hz)))
                            (update :sounding into (map vector ids hz (repeat (+ onset sus)))))
                     ev (cond-> (assoc e :beat onset) (seq hz) (assoc :hz hz :ids ids))]
                 [st [[2 ev]]
                  (if (and (seq ids) (not= :pos (:mode st))) [[(+ at (* sus (spb st))) 0 [:off ids]]] [])])))
      ;; plays every event that starts on or before beat b (and after the last one played)
      play-until (fn [st b at]
                   (loop [st st outs [] later [] k 0]
                     (let [nx (take-next st)]
                       (if (and nx (<= (second nx) (+ b eps)) (< k burst))
                         (let [[e onset st2] nx [st3 o l] (play st2 e onset at)]
                           (recur st3 (into outs o) (into later l) (inc k)))
                         [st outs later]))))
      ;; everything that sounds goes silent
      silence (fn [st] [(assoc st :sounding []) (if (seq (:sounding st)) [[1 []] [0 []]] [])])
      ;; what goes out after some events were played: them, then what sounds if it changed, then the beat
      result (fn [before st outs later b]
               {:state st :later later :show b
                :out (vec (concat outs (when (not= (:sounding before) (:sounding st)) (sound-outs st)) (when b [[3 b]])))})
      ;; its own clock: the tick of the events that start on beat (:tick st)
      tick (fn [st at]
             (let [[st2 outs later] (play-until st (:tick st) at)
                   more? (some? (first (evs st2)))
                   nb (:beat st2)]
               (result st (if more? (assoc st2 :tick nb) (assoc st2 :mode nil :tick nil)) outs
                       (if more? (conj later [(+ (:t0 st2) (* nb (spb st2))) 0 [:tick (:gen st2)]]) later)
                       (:tick st))))
      start (fn [st at args]
              (let [[st0 off] (silence st)
                    q (:quant args)
                    b (/ at (spb st0))                ; the beat of the AudioContext clock now
                    sb (if (and (number? q) (pos? q)) (* q (js/Math.ceil (- (/ b q) eps))) b)
                    t0 (* sb (spb st0))
                    g (inc (:gen st0))
                    st1 (-> st0 fresh (assoc :mode :clock :gen g :t0 t0 :tick 0 :waiting false))]
                {:state st1 :out off :later [[t0 0 [:tick g]]]}))
      ;; the events still to come, each with the beat it starts on (to count them, without playing them)
      ahead (fn [st]
              (letfn [(ah [evs b] (lazy-seq (when-let [e (first evs)] (cons [e b] (ah (rest evs) (+ b (api/event-dur e)))))))]
                (ah (evs st) (:beat st))))
      ;; a position in beats
      position (fn [st p at]
                 (let [st (if (= :clock (:mode st)) (update st :gen inc) st)
                       prev (when (and (= :pos (:mode st)) (:evs st)) (:pos st))
                       ;; forward from where it was: the events whose start it crosses, (prev, p], unless
                       ;; they are too many for one instant (then it is a jump)
                       crossed (when (and prev (>= p (- prev eps)))
                                 (count (take (inc burst) (take-while (fn [[_ b]] (<= b (+ p eps))) (ahead st)))))]
                   (if (and crossed (<= crossed burst))
                     (let [[st2 outs later] (play-until st p at)
                           st3 (-> st2 (update :sounding (fn [s] (vec (remove (fn [[_ _ until]] (<= until (+ p eps))) s))))
                                   (assoc :pos p))]
                       (result st st3 outs later p))
                     ;; from elsewhere (the start, back, a jump, another way of moving): from the beginning to
                     ;; p, silently (the same seed gives the same events), and what starts exactly at p sounds
                     (let [[st0 off] (silence st)
                           st1 (-> st0 fresh (assoc :mode :pos) (skip-to p))
                           [st2 outs later] (play-until st1 p at)]
                       (update (result st0 (assoc st2 :pos p) outs later p) :out (fn [o] (vec (concat off o))))))))
      ;; one step: the next event now (with those of :dur 0 right after it, a chord), going on from where
      ;; its steps or its clock were; at the end, again from the beginning
      step (fn [st at]
             (let [st (cond-> st (= :clock (:mode st)) (update :gen inc))
                   st (if (and (:evs st) (#{:step :clock} (:mode st)) (first (evs st))) st (fresh st))
                   st (assoc st :mode :step)]
               (if-let [[_ onset _] (take-next st)]
                 (let [[st2 outs later] (play-until st onset at)] (result st st2 outs later onset))
                 {:state st :out [[3 0]]})))]
  {;; ── about ──
   :class "player"
   :license "MPL-2.0"
   :doc "Plays a pattern (from a pbind or a pattern box, on its right inlet) in one of three ways, chosen by what arrives on the left: start / stop — its own clock, every event lasting its :dur in beats at its bpm (quant: start on a multiple of that many beats); bang — one step, the next event now; a number — a position in beats, sounding the events whose start it crosses (a ramp, a counter), and moving silently when it goes back or jumps. Out: the Hz of the notes sounding, their voice ids (for synth~ or a polyphonic faust~), the whole event (:beat :hz :ids added) and the beat. A new pattern while it plays goes on from the same beat; the same pattern again changes nothing. Pitch: :freq, :note (MIDI, \"c4\", :c4), or :degree with :scale :root :octave; :dur, :legato or :sustain; :rest is a silence."
   :usage "player [bpm] [quant]"
   :io [2 4]

   ;; ── arguments ──
   :args [[:bpm 120] [:quant 0]]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (let [st (or state {:gen 0 :n 0 :sounding [] :bpm (max 1 (or (:bpm args) 120)) :mode nil})
                    w (word value)]
                (try
                  (cond
                    ;; the pattern, on the right
                    (= inlet 1)
                    (cond
                      (not (api/pattern? value)) {:state st :effects [[:print "player: its right inlet takes a pattern (from a pbind or a pattern box)"]]}
                      (= (:key value) (:key (:pattern st))) {:state st}          ; the same again: nothing changes
                      :else
                      (let [st (assoc st :pattern value)]
                        (case (:mode st)
                          ;; its own clock: the new events from the beat it is on, without stopping
                          :clock (if (:waiting st)
                                   (start st at args)
                                   (let [now-beat (/ (- at (:t0 st)) (spb st))
                                         st (-> st fresh (skip-to now-beat) (update :gen inc))
                                         nb (:beat st)]
                                     (if (first (evs st))
                                       {:state (assoc st :tick nb) :later [[(+ (:t0 st) (* nb (spb st))) 0 [:tick (:gen st)]]]}
                                       {:state (assoc st :mode nil)})))
                          ;; a position: the new events after it
                          :pos {:state (-> st fresh (skip-to (+ (:pos st) eps)))}
                          ;; steps: the new events from the same beat
                          :step {:state (-> st fresh (skip-to (or (:beat st) 0)))}
                          {:state (dissoc st :evs)})))

                    ;; its clock
                    (and (vector? value) (= :tick (first value)))
                    (if (and (= :clock (:mode st)) (= (second value) (:gen st))) (tick st at) {:state st})
                    ;; notes that end (a clock or steps)
                    (and (vector? value) (= :off (first value)))
                    (let [ids (set (second value)) st2 (update st :sounding (fn [s] (vec (remove (fn [[id]] (ids id)) s))))]
                      (if (= st2 st) {:state st} {:state st2 :out (sound-outs st2)}))
                    (and (vector? value) (= :bpm (first value)) (number? (second value)) (pos? (second value)))
                    (let [nbpm (second value)]
                      (if (= :clock (:mode st))
                        ;; the same beat now, at the new tempo: the next tick is moved, nothing jumps
                        (let [now-beat (/ (- at (:t0 st)) (spb st))
                              st2 (assoc st :bpm nbpm :gen (inc (:gen st)))
                              st2 (assoc st2 :t0 (- at (* now-beat (spb st2))))]
                          {:state st2 :later [[(+ (:t0 st2) (* (:tick st2) (spb st2))) 0 [:tick (:gen st2)]]]})
                        {:state (assoc st :bpm nbpm)}))

                    (= w :start)
                    (if (:pattern st) (start st at args) {:state (assoc st :mode :clock :waiting true)
                                                          :effects [[:print "player: waiting for a pattern on its right inlet"]]})
                    (= w :stop)
                    (let [[st2 off] (silence st)] {:state (assoc st2 :mode nil :gen (inc (:gen st2)) :waiting false) :out off})
                    (= w :reset)
                    (let [[st2 off] (silence st)] {:state (-> st2 fresh (assoc :mode nil :pos nil :gen (inc (:gen st2)))) :out off})
                    (= w :bang) (if (:pattern st) (step st at) {:state st :effects [[:print "player: no pattern yet (on its right inlet)"]]})
                    (number? value) (if (:pattern st) (position st value at) {:state st})
                    :else {:state st})
                  (catch :default e
                    {:state (assoc st :mode nil :gen (inc (:gen st)))
                     :effects [[:print (str "player: the pattern failed while playing: " (or (.-message e) e))]]}))))})
