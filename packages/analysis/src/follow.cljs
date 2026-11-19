;; follow · where a performer is in a tree, from what pitch~ and onset~ hear (discussion #204)
;; Part of @kairotic/analysis. Written against the Kairotic API (api/…). Pure logic: no audio of its own.
(let [;; ── a note heard: where the pitch settles ──
      settle-s 0.06      ; seconds a new pitch must hold before it is a new note (a slide or a vibrato that passes is not)
      onset-s 0.15       ; an onset at most this long before a pitch begins the note there (onset~ hears the attack first)
      apart 0.6          ; semitones: a pitch this far from the note that sounds is another note
      r3 (fn [x] (/ (js/Math.round (* x 1000)) 1000))
      shown (fn [st] {:on (:on st) :notes (count (:score st)) :at (:at st) :found (count (get-in st [:fl :played])) :cue (:cue st)})
      ;; a note begins at t (seconds from start) at midi: the follower hears it
      note-on (fn [st t midi]
                (let [fl (if (:cur st) (api/follow-release (:fl st) t) (:fl st))
                      [fl found] (api/follow-hear fl t midi)
                      at (last (keep (fn [[k x]] (when (= k :at) x)) found))
                      cues (keep (fn [[k x]] (when (= k :cue) x)) found)]
                  [(cond-> (assoc st :fl fl :cur {:t t :midi midi} :pend nil)
                     at (assoc :at (:beat at))
                     (seq cues) (assoc :cue (:cue (last cues))))
                   (vec (concat (when at [[0 (:beat at)] [1 [:note (:id at)]]])
                                (map (fn [c] [2 (:cue c)]) cues)))]))
      out-of (fn [[st outs] extra] (cond-> {:state st :show (shown st)} (seq outs) (assoc :out outs) extra (merge extra)))
      ;; one value of pitch~ (Hz; 0 when it hears none), at t
      hear (fn [st hz t]
             (let [cur (:cur st) m (when (pos? hz) (api/hz->midi hz))]
               (cond
                 (nil? m) [(cond-> (assoc st :pend nil :cur nil) cur (update :fl api/follow-release t)) []]
                 ;; after silence, or an onset just before: a note begins
                 (nil? cur) (note-on st (if (and (:onset st) (<= (- t (:onset st)) onset-s)) (:onset st) t) m)
                 (and (:onset st) (> (:onset st) (+ (:t cur) 0.05)) (<= (- t (:onset st)) onset-s))
                 (note-on (assoc st :onset nil) (:onset st) m)
                 ;; near the note that sounds: still it
                 (<= (js/Math.abs (- m (:midi cur))) apart) [(assoc st :pend nil) []]
                 ;; another pitch: a new note if it holds (a look again in a moment, as pitch~ sends only changes)
                 (and (:pend st) (<= (js/Math.abs (- m (second (:pend st)))) 0.5) (>= (- t (first (:pend st))) settle-s))
                 (note-on st (first (:pend st)) m)
                 (and (:pend st) (<= (js/Math.abs (- m (second (:pend st)))) 0.5)) [st []]
                 :else [(assoc st :pend [t m]) []])))]
  {;; ── about ──
   :class "follow"
   :license "MPL-2.0"
   :doc "Follows a performer through a tree (discussion #204): a tree on the right (from a tree box), Hz on the left (from pitch~: 0 when it hears none) and onsets in the middle (from onset~: a note begins there even on the same pitch). start begins at the top of the tree, stop ends. Each note heard is matched with a note of the tree a little ahead of where the performer was, by its pitch (an octave off still counts) and by when it was expected at the tempo the performer goes; wrong notes and ornaments are let pass, skipped notes are skipped. Out: the written beat where the performer is, [:note id], the :cue of each note that has one when it is reached (or passed over: caught up at the next note found, once), and at stop the take — where each note was played, in seconds — as [:take {…}]: into the tree box's inlet it is kept only for you (a message [:take … :work] keeps it in the tree), and its continuum can show it."
   :usage "follow [ahead] [band]"
   :io [3 4]
   :size [124 30]
   :args [[:ahead 4] [:band 0.6]]

   ;; ── logic ──
   :receive (fn [{:keys [inlet value state args at]}]
              (let [st (or state {})]
                (cond
                  ;; the tree to follow
                  (= inlet 2)
                  (if (and (vector? value) (keyword? (first value)))
                    (let [sc (api/follow-score value)] {:state (assoc st :score sc :tree-at at) :show (shown (assoc st :score sc))})
                    {})
                  (= value :start)
                  (if (seq (:score st))
                    (let [st (assoc st :on true :t0 at :fl (api/follow-start (:score st) {:ahead (api/clamp (:ahead args) 1 32) :band (api/clamp (:band args) 0.1 2)})
                                    :cur nil :pend nil :onset nil :at nil :cue nil)]
                      {:state st :show (shown st)})
                    {:effects [[:print "follow: no tree yet (connect a tree box to its right inlet)"]]})
                  (not (:on st)) {}
                  (= value :stop)
                  (let [t (- at (:t0 st))
                        fl (if (:cur st) (api/follow-release (:fl st) t) (:fl st))
                        n (inc (or (:takes st) 0))
                        tk (api/follow-take fl {:id (str "follow-" (r3 (:t0 st))) :name (str "followed " n)
                                                :made (.toISOString (js/Date.))})
                        st (assoc st :on false :fl fl :cur nil :takes n)]
                    (cond-> {:state st :show (shown st)} tk (assoc :out [[3 [:take tk]]])))
                  (= inlet 1) {:state (assoc st :onset (- at (:t0 st)))}
                  (and (= value [:settle]) (:pend st)) (out-of (hear st (api/midi->hz (second (:pend st))) (- at (:t0 st))) nil)
                  (and (= inlet 0) (number? value))
                  (let [t (- at (:t0 st)) [st2 outs] (hear st value t)]
                    (out-of [st2 outs] (when (and (:pend st2) (not= (:pend st2) (:pend st)))
                                         {:later [[(+ at settle-s 0.005) 0 [:settle]]]})))
                  :else {})))

   ;; ── view ──
   :derive (fn [{:keys [shown]}]
             {:label (cond (:on shown) (str "● follow · " (if (:at shown) (str "beat " (api/nice (:at shown))) "…") (when (:cue shown) (str " · " (:cue shown))))
                           :else (str "follow · " (or (:notes shown) 0) " notes"))})
   :view [[:rect {:x 2 :y 2 :w 120 :h 26 :r 3 :stroke :grid :fill :bg}]
          [:text {:x 8 :y 19 :size 10 :fill :soft} :$label]]})
