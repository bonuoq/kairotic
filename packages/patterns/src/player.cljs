;; player · plays a pattern: by its own clock, one step at a time, or at a position in beats
;; Part of @kairotic/patterns. Written against the Kairotic API (api/…).
;; Like a reader: the pattern comes in on the right (as the buffer does) and time on the left, so one
;; pattern can feed several players that move through it each in its own way.
;;   start / stop      its own clock: every event lasts its :dur in beats, at `player bpm`
;;   bang              one step: the next event, now (from a metro, an onset~, a key…)
;;   a number          a position in beats (a ramp, a counter…): every event is a span that sounds
;;                     while the position is inside it, entered at its onset going forwards and at its
;;                     end going backwards; a jump (seek p, or a step far larger than the ones before)
;;                     is there at once
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
      ;; ── a position in beats: every event is a span, [onset, onset + sustain), and sounds while the
      ;; position is inside it, whichever way the position moves: forwards it is entered at its onset,
      ;; backwards at its end (and then goes out with :dir :back). Spans passed over in one step sound and
      ;; end within it; an event of no length sounds when it is crossed, either way.
      ;; The events made so far are kept in a window (the same ones every time: the seed), so moving back
      ;; does not make the stream again; it holds `cap` events, and only going back further than it does.
      cap 4096
      new-win (fn [p] {:evs [] :i 0 :from 0 :next 0 :maxlen 0 :rest (api/pattern-events p)})
      win (fn [st] (when-let [f (:win st)] (f)))
      with-win (fn [st w] (assoc st :win (constantly w)))
      ;; makes the events that start up to beat b
      extend (fn [w b]
               (loop [w w k 0]
                 (let [s (:rest w) e (first s)]
                   (if (and e (<= (:next w) (+ b eps)) (< k 100000))
                     (let [on (:next w) idx (:i w)
                           w (assoc w :rest (rest s) :next (+ on (api/event-dur e)) :i (inc idx))]
                       (recur (if (api/rest-event? e)
                                w
                                (let [end (+ on (max 0 (api/event-sustain e)))
                                      v (conj (:evs w) {:i idx :e e :on on :end end})
                                      v2 (if (> (count v) cap) (subvec v (quot cap 2)) v)]
                                  (assoc w :evs v2 :from (if (identical? v v2) (:from w) (:on (first v2)))
                                         :maxlen (max (:maxlen w) (- end on)))))
                              (inc k)))
                     w))))
      ;; the window with every event that may be between lo and hi (made again from the beginning if it no
      ;; longer reaches back to lo)
      cover (fn [st lo hi]
              (let [w (or (win st) (new-win (:pattern st)))
                    w (if (and (pos? (:from w)) (< (- lo (:maxlen w)) (:from w))) (new-win (:pattern st)) w)]
                (with-win st (extend w hi))))
      ;; a note that starts: its id and Hz join what sounds (with the span's end and index), the event goes out
      enter (fn [st x dir]
              (let [hz (or (api/event-hz (:e x)) [])
                    n0 (:n st)
                    ids (mapv (fn [i] (keyword (str "p" (+ n0 i 1)))) (range (count hz)))
                    ev (cond-> (assoc (:e x) :beat (:on x))
                         (seq hz) (assoc :hz hz :ids ids)
                         (= dir :back) (assoc :dir :back))]
                [(-> st (assoc :n (+ n0 (count hz)))
                     (update :sounding into (map (fn [id h] [id h (:end x) (:i x)]) ids hz)))
                 ev]))
      leave (fn [st idx] (update st :sounding (fn [s] (vec (remove (fn [[_ _ _ i]] (= i idx)) s)))))
      ;; what goes out at each moment of a step: [[t [[outlet value] …]] …], what sounds after each moment
      frames (fn [st0 moments]
               (loop [st st0 ms (sort-by first moments) acc []]
                 (if-let [[t kind x dir] (first ms)]
                   (let [[st2 o] (case kind
                                   :enter (let [[s ev] (enter st x dir)] [s [[2 ev]]])
                                   :leave [(leave st (:i x)) []])
                         acc (if (and (seq acc) (= t (first (peek acc))))
                               (update-in acc [(dec (count acc)) 1] into o)
                               (conj acc [t (vec o)]))
                         ;; what sounds, after this moment
                         acc (update-in acc [(dec (count acc)) 2] (constantly (:sounding st2)))]
                     (recur st2 (rest ms) acc))
                   [st acc])))
      ;; frames as outputs now and messages to itself later (:spread)
      deliver (fn [st0 st acc at p]
                (let [outs-of (fn [[_ o sounding] before]
                                (concat o (when (not= sounding before) [[1 (mapv first sounding)] [0 (mapv second sounding)]])))
                      ;; each frame against what sounded before it
                      befores (reductions (fn [b [_ _ s]] s) (:sounding st0) acc)
                      now (filter (fn [[t]] (<= t (+ at eps))) (map vector (map first acc) acc befores))
                      later (remove (fn [[t]] (<= t (+ at eps))) (map vector (map first acc) acc befores))]
                  {:state st :show p
                   :out (vec (concat (mapcat (fn [[_ f b]] (outs-of f b)) now) [[3 p]]))
                   :later (vec (for [[t f b] later] [t 0 [:frame (:pgen st) (vec (outs-of f b))]]))}))
      ;; moves to p: motion (what it passes sounds) or a seek (it is there at once)
      position (fn [st p at args seek?]
                 (let [st (if (= :clock (:mode st)) (update st :gen inc) st)
                       prev (when (= :pos (:mode st)) (:pos st))
                       step (when prev (- p prev))
                       last-step (:last-step st)
                       jump? (or seek? (nil? prev)
                                 (> (js/Math.abs step) (or (:limit args) 8))
                                 (and last-step (> (js/Math.abs last-step) eps)
                                      (> (js/Math.abs step) (* (or (:jump args) 8) (js/Math.abs last-step)))))]
                   (cond
                     ;; the same place again: nothing changes
                     (and (not jump?) (< (js/Math.abs step) eps)) {:state st}
                     jump?
                     (let [off (if (seq (:sounding st)) [[1 []] [0 []]] [])
                           st (-> st (assoc :mode :pos :pos p :pos-at at :last-step nil :sounding [] :pgen (inc (or (:pgen st) 0)))
                                  (cover p p))
                           here (filter (fn [x] (if (:edges args)
                                                  (< (js/Math.abs (- (:on x) p)) eps)
                                                  (or (and (<= (:on x) (+ p eps)) (< p (- (:end x) eps)))
                                                      (and (< (js/Math.abs (- (:on x) p)) eps) (<= (- (:end x) (:on x)) eps)))))
                                        (:evs (win st)))
                           ;; there at once: what contains p starts (with :edges, only what starts at p); an
                           ;; event of no length at p sounds and ends
                           moments (mapcat (fn [x] (if (<= (- (:end x) (:on x)) eps)
                                                     [[at :enter x :fwd] [at :leave x]]
                                                     [[at :enter x :fwd]]))
                                           (sort-by :on here))
                           [st2 acc] (frames st moments)
                           r (deliver st st2 acc at p)]
                       (update r :out (fn [o] (vec (concat off o)))))
                     :else
                     (let [fwd? (pos? step)
                           lo (min prev p) hi (max prev p)
                           dt (- at (or (:pos-at st) at))
                           ;; when a boundary b is reached within the step: now, or (spread) as far into
                           ;; the next step as it lies into this one
                           t-of (fn [b] (if (and (:spread args) (pos? dt) (< dt 0.5))
                                          (+ at (* dt (/ (- b prev) step)))
                                          at))
                           st (cover st lo hi)
                           xs (:evs (win st))
                           moments
                           (if fwd?
                             (concat
                              ;; starts it passes: entered, and ended too if it also passes their end
                              (mapcat (fn [x] (if (> (:end x) (+ p eps))
                                                [[(t-of (:on x)) :enter x :fwd (:on x)]]
                                                [[(t-of (:on x)) :enter x :fwd (:on x)] [(t-of (:end x)) :leave x nil (:end x)]]))
                                      (filter (fn [x] (and (> (:on x) (+ prev eps)) (<= (:on x) (+ p eps)))) xs))
                              ;; what sounded and ends within the step
                              (for [[_ _ end i] (:sounding st) :when (and (some? i) (> end (+ prev eps)) (<= end (+ p eps)))]
                                [(t-of end) :leave {:i i} nil end]))
                             (concat
                              ;; ends it passes going back: entered from its end, and left at its onset if it
                              ;; passes that too; an event of no length when its onset is passed
                              (mapcat (fn [x] (let [zero? (<= (- (:end x) (:on x)) eps)]
                                                (if (and (not zero?) (<= (:on x) (+ p eps)))
                                                  [[(t-of (:end x)) :enter x :back (:end x)]]
                                                  [[(t-of (:end x)) :enter x :back (:end x)] [(t-of (:on x)) :leave x nil (:on x)]])))
                                      (filter (fn [x] (let [zero? (<= (- (:end x) (:on x)) eps)]
                                                        (if zero?
                                                          (and (>= (:on x) (- p eps)) (< (:on x) (- prev eps)))
                                                          (and (> (:end x) (+ p eps)) (<= (:end x) (+ prev eps))))))
                                              xs))
                              ;; what sounded and whose onset it passes going back
                              (for [[_ _ _ i] (:sounding st)
                                    :let [x (first (filter (fn [x] (= (:i x) i)) xs))]
                                    :when (and x (> (:on x) (+ p eps)) (<= (:on x) (+ prev eps)))]
                                [(t-of (:on x)) :leave {:i i} nil (:on x)])))
                           ;; in the order it meets them: by time, then by where they are in the direction it
                           ;; moves (and an event that starts and ends at one place, first in, then out)
                           [st2 acc] (frames st (sort-by (fn [[t kind _ _ b]] [t (if fwd? b (- b)) (if (= kind :enter) 0 1)]) moments))]
                       (deliver st (assoc st2 :pos p :last-step step :pos-at at) acc at p)))))
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
   :doc "Plays a pattern (from a pbind or a pattern box, on its right inlet) in one of three ways, chosen by what arrives on the left: start / stop — its own clock, every event lasting its :dur in beats at its bpm (quant: start on a multiple of that many beats); bang — one step, the next event now; a number — a position in beats (a ramp, a counter, a number you drag), where every event is a span from its onset to its end that sounds while the position is inside it: forwards it is entered at its onset, backwards at its end (:dir :back), and the spans passed over in one step sound within it; seek p, or a step more than jump (8) times the one before it or longer than limit (8) beats, goes there at once, sounding what contains p (with edges, only what starts at p); with spread, what a step passes keeps its rhythm, one step later. Out: the Hz of the notes sounding, their voice ids (for synth~ or a polyphonic faust~), the whole event (:beat :hz :ids added) and the beat. A new pattern while it plays goes on from the same beat; the same pattern again changes nothing. Pitch: :freq, :note (MIDI, \"c4\", :c4), or :degree with :scale :root :octave; :dur, :legato or :sustain; :rest is a silence."
   :usage "player [bpm] [quant] [jump] [limit] [edges] [spread]"
   :io [2 4]

   ;; ── arguments ──
   :args [[:bpm 120] [:quant 0] [:jump 8] [:limit 8] [:edges false] [:spread false]]

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
                      (let [st (-> st (assoc :pattern value) (dissoc :win))]
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
                          ;; a position: what sounded stops; the new events sound as the position moves on
                          :pos (let [[st2 off] (silence st)]
                                 {:state (-> st2 (dissoc :win) (assoc :last-step nil :pgen (inc (or (:pgen st2) 0)))) :out off})
                          ;; steps: the new events from the same beat
                          :step {:state (-> st fresh (skip-to (or (:beat st) 0)))}
                          {:state (dissoc st :evs)})))

                    ;; its clock
                    (and (vector? value) (= :tick (first value)))
                    (if (and (= :clock (:mode st)) (= (second value) (:gen st))) (tick st at) {:state st})
                    ;; what a step at a position sends a little later (spread)
                    (and (vector? value) (= :frame (first value)))
                    (if (and (= :pos (:mode st)) (= (second value) (:pgen st))) {:state st :out (nth value 2)} {:state st})
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
                    (let [[st2 off] (silence st)] {:state (assoc st2 :mode nil :gen (inc (:gen st2)) :pgen (inc (or (:pgen st2) 0)) :waiting false) :out off})
                    (= w :reset)
                    (let [[st2 off] (silence st)] {:state (-> st2 fresh (dissoc :win) (assoc :mode nil :pos nil :gen (inc (:gen st2)) :pgen (inc (or (:pgen st2) 0)))) :out off})
                    (= w :bang) (if (:pattern st) (step st at) {:state st :effects [[:print "player: no pattern yet (on its right inlet)"]]})
                    (number? value) (if (:pattern st) (position st value at args false) {:state st})
                    ;; seek p: there at once, without sounding what is in between
                    (and (vector? value) (= :seek (first value)) (number? (second value)))
                    (if (:pattern st) (position st (second value) at args true) {:state st})
                    :else {:state st})
                  (catch :default e
                    {:state (assoc st :mode nil :gen (inc (:gen st)))
                     :effects [[:print (str "player: the pattern failed while playing: " (or (.-message e) e))]]}))))})
